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

const CAT = { horno: 'cat_baking', cocina: 'cat_kitchen' };

const inventory = [
  { id:'i1', name:'All-Purpose Flour', unit:'lb', costPerUnit:0.52, qtyOnHand:44, stockFullRef:50, salePrice:1.2, categoryId:CAT.horno,    supplier:'Sysco', sku:'FLR-50' },
  { id:'i2', name:'Brown Sugar',       unit:'lb', costPerUnit:0.88, qtyOnHand:26, stockFullRef:30, salePrice:1.95, categoryId:CAT.horno,    supplier:'Sysco', sku:'SGR-30' },
  { id:'i3', name:'Butter',            unit:'lb', costPerUnit:3.40, qtyOnHand:19, stockFullRef:24, salePrice:7.5, categoryId:CAT.horno,    supplier:'Dairy Co', sku:'BTR-24' },
  { id:'i4', name:'Whole Milk',        unit:'gal',costPerUnit:3.95, qtyOnHand:9,  stockFullRef:12, salePrice:6.9, categoryId:CAT.cocina,   supplier:'Dairy Co', sku:'MLK-12' },
  { id:'i5', name:'Chicken Breast',    unit:'lb', costPerUnit:2.85, qtyOnHand:40, stockFullRef:48, salePrice:6.4, categoryId:CAT.cocina,   supplier:'Restaurant Depot', sku:'CHK-48' },
  { id:'i6', name:'Eggs',              unit:'unidad', costPerUnit:0.22, qtyOnHand:300, stockFullRef:360, salePrice:0.55, categoryId:CAT.horno,   supplier:'Dairy Co', sku:'EGG-360' },
  { id:'i7', name:'Paper Towels 12pk', unit:'caja', costPerUnit:18.90, qtyOnHand:2, stockFullRef:8, salePrice:34.9, categoryId:CAT.cocina,   supplier:'Costco', sku:'PPR-12' },
  { id:'i8', name:'Olive Oil',         unit:'gal',costPerUnit:22.50, qtyOnHand:5,  stockFullRef:6,  salePrice:44.0, categoryId:CAT.cocina,  supplier:'Sysco', sku:'OIL-6' },
];

// Un precio que subió: es lo que dispara el aviso de cambio de precio, o sea una
// de las cosas que la ficha quiere mostrar funcionando.
inventory[0].lastPriceChangePct = 6.2;
inventory[0].prevCostPerUnit = 0.49;

const purchases = [
  { id:'p1', ingId:'i1', qty:50, unit:'lb',  totalPrice:26.00, supplier:'Sysco',             date:diasAtras(2) },
  { id:'p2', ingId:'i5', qty:48, unit:'lb',  totalPrice:136.80,supplier:'Restaurant Depot',  date:diasAtras(4) },
  { id:'p3', ingId:'i3', qty:24, unit:'lb',  totalPrice:81.60, supplier:'Dairy Co',          date:diasAtras(9) },
  { id:'p4', ingId:'i6', qty:360,unit:'unidad', totalPrice:79.20, supplier:'Dairy Co',       date:diasAtras(11) },
  { id:'p5', ingId:'i8', qty:6,  unit:'gal', totalPrice:135.00,supplier:'Sysco',             date:diasAtras(17) },
];

const linea = (ingId, rawName, qty, unit, totalPrice) => ({ ingId, rawName, qty, unit, totalPrice });

const receipts = [
  { id:'rc1', date:diasAtras(2),  supplier:'Sysco',            total:26.00,  itemCount:1, createdAt:diasAtras(2),
    appliedItems:[ linea('i1','All-Purpose Flour',50,'lb',26.00) ] },
  { id:'rc2', date:diasAtras(4),  supplier:'Restaurant Depot', total:136.80, itemCount:1, createdAt:diasAtras(4),
    appliedItems:[ linea('i5','Chicken Breast',48,'lb',136.80) ] },
  { id:'rc3', date:diasAtras(6),  supplier:'City Power',       total:145.30, itemCount:1, createdAt:diasAtras(6),
    manual:true, manualKind:'expense', appliedItems:[] },
  { id:'rc4', date:diasAtras(9),  supplier:'Dairy Co',         total:81.60,  itemCount:1, createdAt:diasAtras(9),
    appliedItems:[ linea('i3','Butter',24,'lb',81.60) ] },
  { id:'rc5', date:diasAtras(11), supplier:'Dairy Co',         total:79.20,  itemCount:1, createdAt:diasAtras(11),
    appliedItems:[ linea('i6','Eggs',360,'unidad',79.20) ] },
];

const recipes = [
  { id:'r1', name:'Croissant (dozen)', salePrice:42, components:[{ingId:'i1', qty:3},{ingId:'i3', qty:1.5},{ingId:'i6', qty:6}] },
  { id:'r2', name:'Chicken Pot Pie',   salePrice:14, components:[{ingId:'i5', qty:0.6},{ingId:'i1', qty:0.4},{ingId:'i4', qty:0.2}] },
  { id:'r3', name:'Banana Bread',      salePrice:9,  components:[{ingId:'i1', qty:1.2},{ingId:'i2', qty:0.5},{ingId:'i6', qty:2}] },
  { id:'r4', name:'Butter Cookies (24)', salePrice:18, components:[{ingId:'i1', qty:2},{ingId:'i2', qty:0.8},{ingId:'i3', qty:1}] },
];

// Producciones ya registradas. Sin esto el recap del mes muestra "No outflows
// recorded in this period" donde deberían ir las ganancias estimadas: el
// apartado más vendedor de esa pantalla quedaba vacío. Cada corrida descuenta
// insumos y deja precio y costo del momento, que es de donde salen las
// estimaciones (ver periodSpendSplit en app-03).
const outflows = [
  { id:'o1', type:'production', recipeId:'r1', recipeName:'Croissant (dozen)', count:14,
    items:[{ ingId:'i1', ingName:'All-Purpose Flour', qty:42, unit:'lb', costAt:0.52 },
           { ingId:'i3', ingName:'Butter', qty:21, unit:'lb', costAt:3.40 },
           { ingId:'i6', ingName:'Eggs', qty:84, unit:'unidad', costAt:0.22 }],
    saleTotal:588, costTotal:112.32, date:diasAtras(3), createdAt:diasAtras(3) },
  { id:'o2', type:'production', recipeId:'r3', recipeName:'Banana Bread', count:30,
    items:[{ ingId:'i1', ingName:'All-Purpose Flour', qty:36, unit:'lb', costAt:0.52 },
           { ingId:'i2', ingName:'Brown Sugar', qty:15, unit:'lb', costAt:0.88 },
           { ingId:'i6', ingName:'Eggs', qty:60, unit:'unidad', costAt:0.22 }],
    saleTotal:270, costTotal:45.12, date:diasAtras(6), createdAt:diasAtras(6) },
  { id:'o3', type:'production', recipeId:'r4', recipeName:'Butter Cookies (24)', count:18,
    items:[{ ingId:'i1', ingName:'All-Purpose Flour', qty:36, unit:'lb', costAt:0.52 },
           { ingId:'i2', ingName:'Brown Sugar', qty:14.4, unit:'lb', costAt:0.88 },
           { ingId:'i3', ingName:'Butter', qty:18, unit:'lb', costAt:3.40 }],
    saleTotal:324, costTotal:92.59, date:diasAtras(10), createdAt:diasAtras(10) },
];

const ESTADO = {
  inventory, purchases, recipes, receipts,
  aliasMap: {}, priceAlertThreshold: 5,
  cycleCountEnabled: true, cycleCountPct: 20, cycleCountIntervalDays: 7,
  cycleCountLastDate: diasAtras(7), cycleCountCursor: 0,
  deletedInventoryIds: [], deletedReceiptIds: [], deletedPurchaseIds: [],
  businessName: 'Bluebird Bakery', monthlyBudget: 800, budgetMeta: {},
  bizProfile: {}, profitsVisibleToMembers: true,
  categories: [
    { id:CAT.horno,  name:'Baking' },
    { id:CAT.cocina, name:'Kitchen' },
  ],
  expenseCategories: [], calNotes: [], deletedCalNoteIds: [],
  outflows, outflowArchive: {}, deletedRecipeIds: [],
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
  { archivo: 'receipts',   tab: 'recibos' },
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

  // Resumen del mes: no está en la barra de abajo, se entra por el enlace de la
  // tarjeta de presupuesto en el dashboard.
  const dash = page.locator('.bottom-nav-item[data-tab="dashboard"]');
  if (await dash.count()) {
    await dash.first().click();
    await page.waitForTimeout(1000);
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

  await browser.close();
})();
