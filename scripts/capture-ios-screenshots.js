/* Captura las pantallas de Dusty a resolución nativa de iPhone Pro Max.
 *
 * Por qué existe: las capturas de la ficha de Play son de 1080px de ancho, y
 * Apple pide 1290x2796. Agrandarlas pierde nitidez, y sacarlas del simulador
 * exige tener la Mac delante. Acá se abre la app de verdad en Chromium con el
 * tamaño lógico de un iPhone Pro Max (430x932) a densidad 3x, que da exactamente
 * 1290x2796 de píxeles reales — la misma medida que Apple quiere, renderizada
 * a esa resolución en vez de escalada hasta ella.
 *
 * Los datos son de demostración y se inyectan en localStorage antes de que la
 * app arranque: una ficha con el inventario vacío no vende nada, y usar datos
 * reales de alguien en la App Store no corresponde.
 *
 * Uso:
 *   npm run build                       (genera www/)
 *   cd www && python3 -m http.server 8787 &
 *   node scripts/capture-ios-screenshots.js
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const URL_BASE = process.env.DUSTY_URL || 'http://localhost:8787/index.html';
const DESTINO = 'store-screenshots/ios/raw';
// Playwright trae su propio Chromium, pero en este entorno la versión instalada
// no coincide con la que el paquete espera; con CHROMIUM_PATH se apunta a la que
// sí está. Sin la variable se usa el Chromium que maneja Playwright.
const CHROMIUM = process.env.CHROMIUM_PATH || undefined;

const hoy = new Date();
const iso = (d) => d.toISOString().slice(0, 10);
const diasAtras = (n) => iso(new Date(hoy.getTime() - n * 86400000));

const CAT = { horno:'cat_baking', lacteos:'cat_dairy', cocina:'cat_kitchen', empaque:'cat_packaging' };

/* Los datos son de una panadería inventada, y son deliberadamente abundantes: con
   ocho productos y tres recetas las pantallas se veían huecas —media grilla en
   blanco, un "sin datos" donde va lo interesante— y una ficha así no convence a
   nadie. Un negocio real tiene decenas de productos, compras todas las semanas y
   producción registrada, y eso es lo que tiene que mostrar la captura.
   Poner datos reales de alguien en la App Store no corresponde, de ahí el invento. */
const PRODUCTOS = [
  // [id, nombre, unidad, costo, precioVenta, enStock, stockLleno, categoría, proveedor]
  ['i1','All-Purpose Flour','lb',0.52,1.20,44,50,CAT.horno,'Sysco'],
  ['i2','Bread Flour','lb',0.61,1.40,38,45,CAT.horno,'Sysco'],
  ['i3','Brown Sugar','lb',0.88,1.95,26,30,CAT.horno,'Sysco'],
  ['i4','Granulated Sugar','lb',0.64,1.50,41,50,CAT.horno,'Sysco'],
  ['i5','Active Dry Yeast','lb',4.20,9.00,6,8,CAT.horno,'Sysco'],
  ['i6','Baking Powder','lb',2.15,4.80,7,9,CAT.horno,'Sysco'],
  ['i7','Cocoa Powder','lb',5.40,11.50,9,12,CAT.horno,'Gourmet Supply'],
  ['i8','Vanilla Extract','gal',48.00,98.00,2,3,CAT.horno,'Gourmet Supply'],
  ['i9','Butter','lb',3.40,7.50,19,24,CAT.lacteos,'Dairy Co'],
  ['i10','Whole Milk','gal',3.95,6.90,9,12,CAT.lacteos,'Dairy Co'],
  ['i11','Heavy Cream','gal',6.80,12.40,5,8,CAT.lacteos,'Dairy Co'],
  ['i12','Cream Cheese','lb',3.10,6.75,14,18,CAT.lacteos,'Dairy Co'],
  ['i13','Eggs','unidad',0.22,0.55,300,360,CAT.lacteos,'Dairy Co'],
  ['i14','Buttermilk','gal',4.40,8.20,4,6,CAT.lacteos,'Dairy Co'],
  ['i15','Chicken Breast','lb',2.85,6.40,40,48,CAT.cocina,'Restaurant Depot'],
  ['i16','Olive Oil','gal',22.50,44.00,5,6,CAT.cocina,'Sysco'],
  ['i17','Sea Salt','lb',1.10,2.60,12,15,CAT.cocina,'Sysco'],
  ['i18','Black Pepper','lb',7.80,16.00,3,4,CAT.cocina,'Gourmet Supply'],
  ['i19','Yellow Onions','lb',0.74,1.80,28,35,CAT.cocina,'Produce Direct'],
  ['i20','Fresh Spinach','lb',2.40,5.50,11,16,CAT.cocina,'Produce Direct'],
  ['i21','Bakery Boxes 9in','caja',0.38,0.90,180,240,CAT.empaque,'Uline'],
  ['i22','Parchment Paper','caja',24.90,48.00,4,6,CAT.empaque,'Uline'],
  ['i23','Paper Towels 12pk','caja',18.90,34.90,2,8,CAT.empaque,'Costco'],
  ['i24','Takeout Bags','caja',31.50,62.00,5,7,CAT.empaque,'Uline'],
];

const inventory = PRODUCTOS.map(([id,name,unit,costPerUnit,salePrice,qtyOnHand,stockFullRef,categoryId,supplier]) => ({
  id, name, unit, costPerUnit, salePrice, qtyOnHand, stockFullRef, categoryId, supplier,
  updated:false, photo:null, sku:'',
}));

// Un precio que subió: es lo que dispara el aviso de cambio de precio, o sea una
// de las cosas que la ficha quiere mostrar funcionando.
inventory[0].lastPriceChangePct = 6.2;
inventory[0].prevCostPerUnit = 0.49;

const linea = (ingId, rawName, qty, unit, totalPrice) => ({ ingId, rawName, qty, unit, totalPrice });
const porNombre = (n) => inventory.find(i => i.name === n);
const compra = (n, qty, total) => { const i = porNombre(n); return linea(i.id, i.name, qty, i.unit, total); };

/* El gasto del mes NO sale de purchases sino de los recibos (spendSplitForMonth en
   app-03 recorre receipts): sin estos el dashboard mostraba $0.00 y el anillo en
   0%, que es lo peor que puede mostrar una ficha de tienda. Van repartidos a lo
   largo del mes para que el calendario de la tarjeta de recibos se vea poblado. */
const receipts = [
  { id:'rc1',  date:diasAtras(1),  supplier:'Sysco',            total:184.60, itemCount:4, createdAt:diasAtras(1),
    appliedItems:[ compra('All-Purpose Flour',50,26.00), compra('Bread Flour',45,27.45), compra('Granulated Sugar',50,32.00), compra('Vanilla Extract',2,96.00) ] },
  { id:'rc2',  date:diasAtras(2),  supplier:'Produce Direct',   total:64.30,  itemCount:2, createdAt:diasAtras(2),
    appliedItems:[ compra('Yellow Onions',35,25.90), compra('Fresh Spinach',16,38.40) ] },
  { id:'rc3',  date:diasAtras(4),  supplier:'Restaurant Depot', total:136.80, itemCount:1, createdAt:diasAtras(4),
    appliedItems:[ compra('Chicken Breast',48,136.80) ] },
  { id:'rc4',  date:diasAtras(5),  supplier:'City Power',       total:212.40, itemCount:1, createdAt:diasAtras(5),
    manual:true, manualKind:'expense', appliedItems:[] },
  { id:'rc5',  date:diasAtras(7),  supplier:'Dairy Co',         total:238.90, itemCount:4, createdAt:diasAtras(7),
    appliedItems:[ compra('Butter',24,81.60), compra('Whole Milk',12,47.40), compra('Heavy Cream',8,54.40), compra('Cream Cheese',18,55.80) ] },
  { id:'rc6',  date:diasAtras(9),  supplier:'Uline',            total:168.60, itemCount:3, createdAt:diasAtras(9),
    appliedItems:[ compra('Bakery Boxes 9in',240,91.20), compra('Parchment Paper',2,49.80), compra('Takeout Bags',1,31.50) ] },
  { id:'rc7',  date:diasAtras(11), supplier:'Dairy Co',         total:79.20,  itemCount:1, createdAt:diasAtras(11),
    appliedItems:[ compra('Eggs',360,79.20) ] },
  { id:'rc8',  date:diasAtras(13), supplier:'City Water',       total:88.15,  itemCount:1, createdAt:diasAtras(13),
    manual:true, manualKind:'expense', appliedItems:[] },
  { id:'rc9',  date:diasAtras(15), supplier:'Gourmet Supply',   total:112.00, itemCount:2, createdAt:diasAtras(15),
    appliedItems:[ compra('Cocoa Powder',12,64.80), compra('Black Pepper',4,31.20) ] },
  { id:'rc10', date:diasAtras(16), supplier:'Sysco',            total:96.70,  itemCount:3, createdAt:diasAtras(16),
    appliedItems:[ compra('Olive Oil',3,67.50), compra('Sea Salt',15,16.50), compra('Active Dry Yeast',3,12.60) ] },
  { id:'rc11', date:diasAtras(18), supplier:'Internet Co',      total:74.99,  itemCount:1, createdAt:diasAtras(18),
    manual:true, manualKind:'expense', appliedItems:[] },
];

const purchases = receipts.flatMap(r => (r.appliedItems||[]).map((it, n) => ({
  id: r.id + '-p' + n, ingId: it.ingId, qty: it.qty, unit: it.unit,
  totalPrice: it.totalPrice, supplier: r.supplier, date: r.date,
})));

const ing = (nombre, qty) => ({ ingId: porNombre(nombre).id, qty });
const recipes = [
  { id:'r1', name:'Croissant (dozen)',   salePrice:42, components:[ing('Bread Flour',3), ing('Butter',1.5), ing('Eggs',6)] },
  { id:'r2', name:'Sourdough Loaf',      salePrice:11, components:[ing('Bread Flour',1.4), ing('Sea Salt',0.05), ing('Active Dry Yeast',0.02)] },
  { id:'r3', name:'Banana Bread',        salePrice:9,  components:[ing('All-Purpose Flour',1.2), ing('Brown Sugar',0.5), ing('Eggs',2)] },
  { id:'r4', name:'Butter Cookies (24)', salePrice:18, components:[ing('All-Purpose Flour',2), ing('Brown Sugar',0.8), ing('Butter',1)] },
  { id:'r5', name:'Chocolate Cake',      salePrice:34, components:[ing('All-Purpose Flour',2.2), ing('Cocoa Powder',0.6), ing('Eggs',8), ing('Butter',1.2)] },
  { id:'r6', name:'Cheesecake',          salePrice:38, components:[ing('Cream Cheese',3), ing('Heavy Cream',0.5), ing('Eggs',6), ing('Granulated Sugar',1)] },
  { id:'r7', name:'Chicken Pot Pie',     salePrice:14, components:[ing('Chicken Breast',0.6), ing('All-Purpose Flour',0.4), ing('Whole Milk',0.2)] },
  { id:'r8', name:'Spinach Quiche',      salePrice:26, components:[ing('Fresh Spinach',0.8), ing('Eggs',8), ing('Heavy Cream',0.4), ing('Bread Flour',1)] },
];

/* Producciones ya registradas. Sin esto el recap del mes muestra "No outflows
   recorded in this period" donde deberían ir las ganancias estimadas: el apartado
   más vendedor de esa pantalla quedaba vacío. */
const produccion = (id, rec, count, dias) => {
  const r = recipes.find(x => x.id === rec);
  const items = r.components.map(c => {
    const i = inventory.find(x => x.id === c.ingId);
    return { ingId:i.id, ingName:i.name, qty:+(c.qty * count).toFixed(2), unit:i.unit, costAt:i.costPerUnit };
  });
  const costTotal = +items.reduce((a, it) => a + it.qty * it.costAt, 0).toFixed(2);
  return { id, type:'production', recipeId:r.id, recipeName:r.name, count, items,
           saleTotal:+(r.salePrice * count).toFixed(2), costTotal,
           date:diasAtras(dias), createdAt:diasAtras(dias) };
};
const outflows = [
  produccion('o1','r1',14,2),  produccion('o2','r2',40,3),
  produccion('o3','r3',30,5),  produccion('o4','r5',9,6),
  produccion('o5','r4',18,8),  produccion('o6','r6',7,10),
  produccion('o7','r8',12,12), produccion('o8','r7',22,14),
];

const ESTADO = {
  inventory, purchases, recipes, receipts, outflows,
  aliasMap: {}, priceAlertThreshold: 5,
  cycleCountEnabled: true, cycleCountPct: 20, cycleCountIntervalDays: 7,
  cycleCountLastDate: diasAtras(7), cycleCountCursor: 0,
  deletedInventoryIds: [], deletedReceiptIds: [], deletedPurchaseIds: [],
  businessName: 'Bluebird Bakery', monthlyBudget: 1800, budgetMeta: {},
  bizProfile: {}, profitsVisibleToMembers: true,
  categories: [
    { id:CAT.horno,   name:'Baking' },
    { id:CAT.lacteos, name:'Dairy' },
    { id:CAT.cocina,  name:'Kitchen' },
    { id:CAT.empaque, name:'Packaging' },
  ],
  expenseCategories: [], calNotes: [], deletedCalNoteIds: [],
  outflowArchive: {}, deletedRecipeIds: [],
  deletedAssetIds: [], deletedMaintIds: [], deletedCatalogIds: [],
  deletedClientIds: [], deletedMaintLogIds: [],
};

// La barra de abajo marca cada botón con data-tab (ver bottomNav en app-04), que
// es más estable que el texto: la etiqueta cambia de idioma y va en mayúsculas
// por CSS, así que buscarla por texto falla de maneras poco obvias. Los dos
// últimos lugares de la barra son configurables (inventario/equipo y
// producción/recibos), así que se captura lo que de verdad esté puesto.
const PANTALLAS = [
  { archivo: 'dashboard',  tab: 'dashboard' },
  { archivo: 'inventory',  tab: 'inventario', desplazar: 210 },
  { archivo: 'production', tab: 'produccion' },
];

(async () => {
  fs.mkdirSync(DESTINO, { recursive: true });
  const browser = await chromium.launch(CHROMIUM ? { executablePath: CHROMIUM } : {});
  const ctx = await browser.newContext({
    viewport: { width: 430, height: 932 },   // tamaño lógico de un iPhone Pro Max
    deviceScaleFactor: 3,                     // 430*3 x 932*3 = 1290x2796
    isMobile: true, hasTouch: true, locale: 'en-US',
  });
  const page = await ctx.newPage();

  await page.addInitScript((estado) => {
    localStorage.setItem('patron_lang', 'en');
    localStorage.setItem('patron_onboarded', '1');
    // La grilla de inventario en dos columnas da tarjetas enormes: con 24
    // productos entran seis por pantalla y se lee como una demo con poca carga.
    // A tres columnas entran el doble y parece lo que es, un inventario de
    // verdad. El valor sale de localStorage (ver invLayout en app-05), así que
    // no hace falta ir a tocar el selector.
    localStorage.setItem('patron_inv_layout', 'cols3');
    localStorage.setItem('patron_data_v1', JSON.stringify(estado));
  }, ESTADO);

  await page.goto(URL_BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  for (const { archivo, tab, desplazar } of PANTALLAS) {
    const boton = page.locator(`.bottom-nav-item[data-tab="${tab}"]`);
    if (await boton.count() === 0) {
      console.log(`(sin pestaña "${tab}" en esta configuración — se saltea)`);
      continue;
    }
    await boton.first().click();
    await page.waitForTimeout(1200);
    await page.evaluate(() => window.scrollTo({ top: 0 }));
    await page.waitForTimeout(400);
    if (desplazar) {
      await page.evaluate((y) => window.scrollTo({ top: y }), desplazar);
      await page.waitForTimeout(600);
    }
    const salida = path.join(DESTINO, archivo + '.png');
    await page.screenshot({ path: salida });
    console.log(salida);
  }

  // Las dos pantallas que siguen no están en la barra de abajo. Se abren como
  // hojas a pantalla completa que tapan esa barra, así que hay que cerrarlas con
  // Escape antes de poder volver al dashboard: el orden acá no es cosmético.
  const alDashboard = async () => {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(700);
    const d = page.locator('.bottom-nav-item[data-tab="dashboard"]');
    if (!(await d.count())) return false;
    await d.first().click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(900);
    await page.evaluate(() => window.scrollTo({ top: 0 }));
    await page.waitForTimeout(300);
    return true;
  };

  // Resumen del mes: se entra por el enlace de la tarjeta de presupuesto.
  if (await alDashboard()) {
    const verMeses = page.locator('text=See all months').first();
    if (await verMeses.count()) {
      await verMeses.click();
      await page.waitForTimeout(1500);
      // "See all months" abre un diálogo sobre el dashboard en penumbra, que como
      // captura de tienda se lee a medias. El recap del mes que hay detrás de ese
      // botón es una pantalla entera y cuenta mejor la misma idea.
      const recap = page.locator('text=See month recap').first();
      if (await recap.count()) {
        await recap.click();
        await page.waitForTimeout(1800);
        await page.evaluate(() => window.scrollTo({ top: 0 }));
        await page.waitForTimeout(400);
      }
      const salida = path.join(DESTINO, 'reports.png');
      await page.screenshot({ path: salida });
      console.log(salida);
    } else {
      console.log('(no se encontró "See all months" — se saltea reportes)');
    }
  }

  // Recibos a pantalla completa: la abre la tarjeta del calendario del dashboard
  // (#dash-calendar-tile → openReceiptsSheet en app-07). No está en la barra de
  // abajo cuando hay recetas, porque ese lugar se lo lleva Producción.
  if (await alDashboard()) {
    const calendario = page.locator('#dash-calendar-tile');
    if (await calendario.count()) {
      await calendario.first().click();
      await page.waitForTimeout(1800);
      const salida = path.join(DESTINO, 'receipts.png');
      await page.screenshot({ path: salida });
      console.log(salida);
    } else {
      console.log('(sin tarjeta de calendario — se saltea recibos)');
    }
  }

  await browser.close();
})();
