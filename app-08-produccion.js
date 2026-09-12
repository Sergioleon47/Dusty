/* ================= PRODUCCIÓN Y SALIDAS =================
   La otra mitad del ciclo de inventario. Los recibos automatizan las ENTRADAS
   (escaneás la factura, el stock sube solo); este módulo automatiza las SALIDAS:
   - Recetas/modelos: qué insumos lleva cada pieza que el negocio produce. Registrar
     "hice 3 del modelo Luna" descuenta los insumos solos y de paso da el costo por
     pieza — conteo humano una vez, perfecto para siempre, sin fotos ni cupo.
   - Escáner de estante: una foto del estante → la IA lee cantidades y niveles
     (modo stock de identify-product.js, con thinking y reglas anti-trampa) → el
     usuario confirma → el stock se ajusta. El descuento NUNCA es automático sin
     confirmación: la IA identifica muy bien y cuenta "más o menos" — la pantalla
     de confirmación es la diferencia entre una feature confiable y una peligrosa.
   Las cantidades puras (costo de receta, plan de producción, % → cantidad) viven
   en patron-core.js con tests — acá va el estado, la interfaz y el pegamento. */

/* ---------- ESTADO ---------- */
let recipes = [];          // {id, name, photo:{base64,mediaType}|null, components:[{ingId, qty}], createdAt, lastEditedBy, lastEditedAt}
let deletedRecipeIds = []; // lápidas — mismo mecanismo que deletedInventoryIds (ver app-01)
/* Historial de salidas: producciones y ajustes de estante — y desde el modo
   Servicios, también los TRABAJOS (type:'service') y las COTIZACIONES
   (type:'quote'). Viaja dentro del doc meta (como calNotes) — por eso se CAPA a
   OUTFLOWS_MAX entradas: el registro financiero de verdad son las compras/recibos,
   esto es el "qué salió y cuándo" informativo. Más nuevo primero. El corte lo
   hace capOutflows (patron-core), que nunca descarta un registro abierto (ver
   outflowIsOpen). */
let outflows = []; // {id, type:'production'|'adjust', recipeId, recipeName, count, items:[{ingId, ingName, qty, unit, costAt, priceAt}], date, createdAt, by, byLabel, reason?, saleTotal?, costTotal?}
const OUTFLOWS_MAX = 400;
/* Resumen financiero de las salidas que el cap evictó: {'YYYY-MM': {revenue, cogs}}.
   Sin esto, el Cierre de mes perdía ingresos de los meses viejos en silencio a
   medida que el cap de 400 iba descartando salidas (revisión de contador
   2026-09-04). Se alimenta en recordOutflow con los MISMOS números (outflowPL,
   app-03) que usaría periodFinancials, así el total del mes no cambia al evictar.
   Viaja en meta como outflows; se mergea por máximo por mes (la evicción es
   determinística sobre los mismos docs, dos dispositivos convergen al mismo valor). */
let outflowArchive = {};

let showRecipeModal = false, draftRecipe = null, editingRecipeId = null;
let recipeScanState = 'idle', recipeScanError = '', recipeScanNote = '', recipeScanRequestId = 0;
let showProduceModal = false, produceRecipeId = null, produceCount = 1;
// Precio de venta POR PIEZA de esta corrida, editable al registrarla (pedido del
// usuario 2026-09-06): arranca en el salePrice de la receta y vale solo para esta
// producción — no toca la receta. Vacío + receta sin precio = fuera del P&L.
let produceSalePrice = '';
let showOutflowsModal = false;
/* Escáner de estante: mismos estados/patrones que el escáner de productos (pb*),
   con su propia cámara — ver el guard de render() en app-04, que también protege
   este <video> de ser arrancado por un redibujado de fondo. */
let showShelfModal = false, shelfState = 'camera', shelfItems = [], shelfUnmatched = [], shelfError = '', shelfRequestId = 0;
/* Qué representan las salidas de este ajuste. ARRANCA EN null A PROPÓSITO
   (revisión contable 2026-09-10): antes era 'sale' por defecto, así que una foto
   del estante daba por VENDIDO todo lo que hubiera bajado y sumaba ingresos que
   nadie eligió. Ahora se pregunta. Este valor es solo el "aplicar a todos" de la
   cabecera; el que manda es el de cada renglón (shelfItems[i].reason), porque de
   8 productos 7 se vendieron y 1 se pudrió es el caso normal, no el raro. */
let shelfReason = null;
// Burbuja de instrucciones del badge "−" del escáner de estante (ver shelfScanFab).
/* Qué zona tiene abierta la burbuja de instrucciones: null | 'inv' | 'prod'.
   Dejó de ser un booleano cuando el escáner pasó a vivir en DOS pantallas: el
   .shelf-info-backdrop es position:fixed sobre toda la ventana, así que con un
   booleano las dos copias lo dibujaban a la vez y la de la pantalla oculta
   quedaba igual tapando los toques de la visible. */
let showShelfInfoBubble = null;
let shelfCamStream = null;

function recipeById(id){ return recipes.find(r => r.id === id); }
function recipePhotoSrc(r){
  if(!r || !r.photo) return null;
  if(r.photo.base64) return `data:${r.photo.mediaType || 'image/jpeg'};base64,${r.photo.base64}`;
  return r.photo.url || null;
}
/* ================= EL PRODUCTO TERMINADO ES UN ÍTEM DEL INVENTARIO =================
   (spec del usuario 2026-09-10: "para guardar lo que se produce, tu aplicación
   debe tener una categoría separada en el inventario llamada Productos
   Terminados", y "a la hora de la venta salga todo calculado del inventario y
   ganancias del mes".)

   La decisión de fondo: NO es una categoría, es una BANDERA del ítem
   (finishedGood). Una categoría es una etiqueta que el usuario renombra, borra y
   llena con lo que quiera; la diferencia entre materia prima y producto terminado
   es estructural —cambia la contabilidad— y no puede depender de que nadie toque
   una etiqueta. Dusty ya usa ese patrón con expenseOnly.

   Y es un ítem del inventario, no una lista aparte, porque así el producto
   terminado hereda GRATIS todo lo que ya existe: entra en el Valor del inventario,
   el escáner de reducción lo puede vender (con su motivo por renglón), outflowPL
   le calcula ingreso y costo de lo vendido, y el Cierre de mes lo suma. Una lista
   paralela habría obligado a duplicar las cuatro cosas.

   La receta sigue siendo la COMPOSICIÓN (qué lleva); el ítem es el STOCK (cuántas
   hay y a cuánto salieron). Se emparejan por recipeId. */
/* ID DETERMINISTA del producto terminado (auditoría de datos 2026-09-12): sale
   de la receta, no del azar. Dos teléfonos del mismo equipo que fabricaban la
   misma pieza por primera vez sin señal creaban cada uno SU ítem terminado con
   un id distinto; al sincronizar quedaban dos filas para la misma receta —
   finishedItemFor solo veía la primera, la segunda quedaba huérfana (sumaba al
   Valor del inventario pero no se podía producir sobre ella ni renombrar) y
   hasta podía ofrecerse como insumo de su propia receta. Con el mismo id en los
   dos lados, el sync por documento los funde en uno solo. Los terminados
   creados antes conservan su id al azar: finishedItemFor empareja por recipeId,
   no por el id, y dedupeFinishedItems funde cualquier duplicado que haya
   quedado de aquella carrera. */
function finishedItemId(recipe){ return 'fg-' + recipe.id; }
function finishedItemFor(recipe){
  if(!recipe) return null;
  return inventory.find(i => i && i.finishedGood && i.recipeId === recipe.id) || null;
}
/* Lo crea si todavía no existe. Nace en CERO y sin costo: la primera producción
   es la que le pone cantidad y precio (ver applyProduction). Un producto terminado
   que naciera con stock sería inventario que nadie fabricó. */
function ensureFinishedItem(recipe){
  let item = finishedItemFor(recipe);
  if(item) return item;
  item = {
    id: finishedItemId(recipe), name: recipe.name, unit: 'unidad',
    costPerUnit: 0, qtyOnHand: 0, stockFullRef: null,
    salePrice: Number(recipe.salePrice)>0 ? recipe.salePrice : 0,
    photo: recipe.photo || null,
    finishedGood: true, recipeId: recipe.id, categoryId: null
  };
  if(currentUser){ item.lastEditedBy = currentUserLabel(); item.lastEditedAt = new Date().toISOString(); }
  inventory.push(item);
  return item;
}
/* El nombre, la foto y el precio de venta viven en la RECETA y se espejan al ítem
   al guardarla: si no, renombrar la receta dejaba el stock con el nombre viejo y
   el usuario veía dos cosas distintas que en realidad son una. El costo y la
   cantidad NO se espejan nunca — esos los pone producir y vender, no el formulario. */
function syncFinishedItem(recipe){
  const item = finishedItemFor(recipe);
  if(!item) return;
  item.name = recipe.name;
  item.photo = recipe.photo || null;
  if(Number(recipe.salePrice) > 0) item.salePrice = recipe.salePrice;
}
/* Dos (o más) productos terminados para la MISMA receta se funden en uno: la
   cantidad se suma y el costo queda como promedio ponderado de los dos stocks
   (weightedAvgCost), así el Valor del inventario no cambia ni un centavo. Gana
   el id determinista (finishedItemId) si existe; si no, el id menor — el mismo
   criterio en todos los dispositivos, para que todos elijan el mismo ganador.
   Los perdedores se borran con lápida (deletedInventoryIds), igual que un
   borrado a mano, así la nube tampoco los devuelve. Corre al principio de cada
   saveState (idempotente: sin duplicados no toca nada). Devuelve si cambió algo. */
function dedupeFinishedItems(){
  const byRecipe = new Map();
  inventory.forEach(i=>{
    if(!i || !i.finishedGood || !i.recipeId) return;
    const arr = byRecipe.get(i.recipeId) || [];
    arr.push(i);
    byRecipe.set(i.recipeId, arr);
  });
  let changed = false;
  byRecipe.forEach((list, recipeId)=>{
    if(list.length < 2) return;
    const detId = 'fg-' + recipeId;
    list.sort((a,b)=> ((a.id===detId?0:1) - (b.id===detId?0:1)) || String(a.id).localeCompare(String(b.id)));
    const keep = list[0];
    list.slice(1).forEach(dup=>{
      const q0 = Number(keep.qtyOnHand)||0, q1 = Number(dup.qtyOnHand)||0;
      keep.costPerUnit = weightedAvgCost(q0, keep.costPerUnit, q1, q1*(Number(dup.costPerUnit)||0));
      keep.qtyOnHand = roundQty(q0 + q1);
      if(!(keep.stockFullRef>0) || keep.qtyOnHand > keep.stockFullRef) keep.stockFullRef = keep.qtyOnHand;
      if(!(Number(keep.salePrice)>0) && Number(dup.salePrice)>0) keep.salePrice = dup.salePrice;
      if(!keep.photo && dup.photo) keep.photo = dup.photo;
      if(currentUser){ keep.lastEditedBy = currentUserLabel(); keep.lastEditedAt = new Date().toISOString(); }
      inventory = inventory.filter(i=>i!==dup);
      if(!deletedInventoryIds.includes(dup.id)) deletedInventoryIds.push(dup.id);
      changed = true;
    });
  });
  return changed;
}
/* Antes de descartar una salida, su aporte financiero se consolida en el archivo
   mensual — la historia del P&L no se achica (revisión de contador 2026-09-04).
   Comparten esto recordOutflow, la carga del estado (applyStateData, app-03) y
   los dos merges con la nube (app-02): los cuatro cortan con la MISMA
   capOutflows (patron-core, con pruebas) y archivan lo mismo que descartan. */
function archiveEvictedOutflows(evicted){
  (evicted||[]).forEach(o=>{
    const pl = outflowPL(o);
    const k = o && monthKey(o.date);
    if(!pl || !k) return;
    const a = outflowArchive[k] || (outflowArchive[k] = {revenue:0, cogs:0});
    /* Idempotente por id (auditoría de la auditoría 2026-09-12): la misma salida
       volvía a archivarse cuando un merge con la nube la traía de vuelta (otro
       teléfono que aún la tenía, o este mismo si cerró la app antes de subir la
       evicción) y el ingreso de un trabajo de $100 quedaba en $200 para siempre.
       El mes recuerda qué ids ya consolidó; el merge (app-02) los une y descarta
       de la lista viva cualquier salida ya archivada (outflowArchivedIds). */
    if(!Array.isArray(a.ids)) a.ids = [];
    if(o.id){
      if(a.ids.indexOf(o.id)>=0) return;
      a.ids.push(o.id);
      if(a.ids.length>OUTFLOW_ARCHIVE_IDS_MAX) a.ids.splice(0, a.ids.length-OUTFLOW_ARCHIVE_IDS_MAX);
    }
    a.revenue = roundQty(a.revenue + pl.revenue);
    a.cogs = roundQty(a.cogs + pl.cogs);
    a.internalUse = roundQty((a.internalUse||0) + (pl.internalUse||0));
  });
}
function recordOutflow(entry){
  outflows.unshift(entry);
  trimOutflows();
}
/* Aplica el tope al historial. Qué se evicta lo decide capOutflows (patron-core,
   con pruebas): las más viejas que ya están cerradas — NUNCA un trabajo de
   servicios sin cobrar, la plantilla de un contrato ni una cotización abierta
   (auditoría de Servicios 2026-09-12: un cobro pendiente de enero desaparecía de
   Por cobrar al pasar las 400 salidas, y su precio quedaba archivado como si se
   hubiera cobrado). */
function trimOutflows(){
  if(outflows.length <= OUTFLOWS_MAX) return false;
  const cut = capOutflows(outflows, OUTFLOWS_MAX);
  archiveEvictedOutflows(cut.evicted);
  if(!cut.evicted.length) return false;
  outflows.length = 0;
  cut.kept.forEach(o=>outflows.push(o));
  return true;
}

/* ---------- LLAMADA AL MODO STOCK (leer cantidades de una foto) ---------- */
// Hermana de identifyProductsFromPhoto (app-06) pero con stock:true — devuelve
// lecturas de cantidad ({name, matched_inventory_name, reading, count,
// fill_percent, ...}) en vez de datos de alta. Mismo cupo, mismos errores. Si el
// trial agota el cupo, tira un Error con .trialQuota=true y cada llamador decide
// qué modal cerrar antes de ofrecer guardar la cuenta.
async function readStockFromPhoto(image){
  // Usa el núcleo compartido callDustyAI (app-06) — sin onTrialQuota a propósito:
  // acá NO se abre ningún modal desde adentro; el Error lleva .trialQuota y cada
  // llamador decide qué cerrar antes de ofrecer guardar la cuenta.
  const parsed = await callDustyAI('/.netlify/functions/identify-product', {
    image: image,
    stock: true,
    // Las notas visibles (visible_note, sticker_color) salen en el idioma de la
    // app del usuario — sin esto llegaban SIEMPRE en español (fuga reportada).
    lang: uiLang,
    inventoryNames: inventory.map(i => i.name)
  }, {
    notFoundKey: 'err_function_not_found_product',
    genericKey: 'product_scan_error'
  });
  return Array.isArray(parsed.products) ? parsed.products : [];
}

/* El % de llenado que devolvió la IA, o null. El contrato dice "número o null",
   pero si el servidor OMITE la clave llega undefined, y undefined!==null es true:
   con esa comparación suelta la fila mostraba "~undefined% del envase", pedía una
   capacidad que no hacía falta, y al escribirla calculaba cap × undefined = NaN.
   Un solo lugar decide qué cuenta como porcentaje. */
function fillPct(v){
  const n = Number(v);
  return (v===null || v===undefined || v==='' || !Number.isFinite(n)) ? null : n;
}

// Empareja una lectura del modo stock contra el inventario: primero el match de la
// IA (entiende abreviaturas/marcas), después la coincidencia literal de nombre —
// mismo criterio en cascada que ya usa processProductBatchSource.
function matchStockReading(p){
  const aiMatch = p.matched_inventory_name
    ? inventory.find(i => i.name.trim().toLowerCase() === p.matched_inventory_name.trim().toLowerCase())
    : null;
  return aiMatch || inventory.find(i => i.name.trim().toLowerCase() === (p.name||'').trim().toLowerCase()) || null;
}

/* ---------- LA PESTAÑA PRODUCCIÓN (pedido del usuario 2026-09-10) ----------
   Producción tomó el lugar que dejó Recibos en la barra de abajo. Es un CATÁLOGO
   —lo que este negocio fabrica— con la misma forma que el de Inventario: misma
   grilla, mismas fichas con foto, mismo buscador laxo (invMatches). Se reusan las
   clases .inv-grid/.inv-tile a propósito: no es "clonar la arquitectura del
   inventario", es la misma, con otra lista adentro.
   Todavía sin stock de producto terminado — eso entra en el paso siguiente, con
   bomRows y weightedAvgCost (ya en patron-core, con pruebas). */
let prodSearch = '';
let prodSelectMode = false;
let prodSelected = new Set();
function prodExitSelect(){ prodSelectMode = false; prodSelected.clear(); }

/* El MISMO orden ⇅ que Inventario, con las tres preguntas que tiene sentido
   hacerle a un catálogo (pedido del usuario 2026-09-10 sobre una captura del
   control de Inventario). Igual que allá, la preferencia es del aparato: queda
   guardada en localStorage y no viaja al equipo.
   Las etiquetas dicen la dirección ("Precio más alto", "Menos hechas") porque
   una flecha sola no le dice a nadie hacia dónde ordena. */
let prodSort = 'name'; // 'name' | 'price' | 'made'
try{ const v = localStorage.getItem('patron_prod_sort'); if(['name','price','made'].includes(v)) prodSort = v; }catch(e){}

function prodSortRecipes(arr){
  const lista = arr.slice();
  const porNombre = (a,b)=>String(a.name||'').localeCompare(String(b.name||''));
  if(prodSort==='price'){
    // Sin precio no es "cero": es "todavía no lo puse", y va al final para no
    // ensuciar el podio de las caras.
    const p = (r)=>{ const n = Number(r.salePrice); return (Number.isFinite(n) && n>0) ? n : -1; };
    lista.sort((a,b)=>p(b)-p(a) || porNombre(a,b));
  }else if(prodSort==='made'){
    const hechas = (r)=>{ const it = finishedItemFor(r); return it ? (Number(it.qtyOnHand)||0) : 0; };
    lista.sort((a,b)=>hechas(a)-hechas(b) || porNombre(a,b));
  }else{
    lista.sort(porNombre);
  }
  return lista;
}

const prodSortIcon = '<svg viewBox="0 0 20 20" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round"><path d="M6 4v12M6 16l-3-3M6 16l3-3M14 16V4M14 4l-3 3M14 4l3 3"/></svg>';

function produccionView(){
  const lista = prodSortRecipes(recipes.filter(r=>invMatches(r.name, prodSearch)));
  /* Las MISMAS capacidades que Inventario (pedido del usuario 2026-09-10): foto,
     seleccionar, borrar, compartir y las columnas. Se reusan sus clases y su
     preferencia de columnas (invLayout) a propósito — son la misma pantalla con
     otra lista adentro, y que se sientan distintas sería el error. */
  /* El escáner de reducción también acá (pedido del usuario 2026-09-10: "qué tal
     si ponemos ese mismo scanner en la pantalla de producción"). Es exactamente
     el mismo —mismo modal, mismos motivos venta/producción/merma— porque las
     piezas terminadas YA son ítems del inventario (ensureFinishedItem), así que
     la IA las reconoce y las cuenta sin ningún cambio. Lo que faltaba era la
     puerta: para descontar dos tableros vendidos había que irse a Inventario. */
  const herramienta = `<div class="inv-tools">${shelfScanFab('prod')}</div>`;
  /* "ELEGIR" VIVE EN LA BARRA, NO EN UNA FILA PROPIA. Es la misma mudanza que
     ya se hizo en Inventario a pedido del usuario ("select en el medio"): una
     fila entera para un solo chip se comia 45px de alto para nada, y las dos
     pantallas hacen lo mismo asi que tienen que verse igual. */
  const chips = '';
  const barra = prodSelectMode ? `
    <div class="inv-sticky">
      <div class="inv-selbar">
        ${/* LA SALIDA. Mismo caso que en Inventario: la barra de seleccion
             REEMPLAZA a la de herramientas, y "Elegir" acaba de mudarse alli,
             asi que sin este boton el modo seleccion no tendria ninguna forma de
             cerrarse. Id propio (btn-prod-sel-exit) y no el mismo del otro: dos
             nodos con el mismo id dejan a uno sin manejador. */''}
        <button type="button" class="category-chip quick on" id="btn-prod-sel-exit">✓ ${t('inv_select_done')}</button>
        <strong>${t('inv_selected_n').replace('{n}', prodSelected.size)}</strong>
        <button type="button" class="link-btn" id="btn-prod-sel-all">${t('inv_select_all')}</button>
        ${/* Compartir = el catálogo para el cliente: foto, nombre y PRECIO. Nunca
             el costo ni el margen — ver shareSelectedRecipes. */''}
        <button type="button" class="btn btn-sm" id="btn-prod-sel-share" ${prodSelected.size?'':'disabled'}
          style="margin-left:auto;background:var(--basil);color:var(--on-accent);">${t('prod_share_selected').replace('{n}', prodSelected.size)}</button>
        <button type="button" class="btn btn-sm" id="btn-prod-sel-delete" ${prodSelected.size?'':'disabled'}
          style="background:var(--tomato);color:var(--on-accent);">${t('inv_delete_selected').replace('{n}', prodSelected.size)}</button>
      </div>
    </div>` : `
    <div class="inv-sticky">
      ${/* prod-toolbar: esta barra lleva un botón más que la de Inventario
           ("+ Agregar") y con min-width en el buscador desbordaba hacia la
           IZQUIERDA (la lupa quedaba fuera de pantalla en 360-430 px). El
           buscador cede ancho — ver .prod-toolbar en dusty.css (auditoría UX
           2026-09-11). */''}
      <div class="inv-toolbar prod-toolbar" style="align-items:center;gap:8px;margin:0;">
        <div class="inv-search-wrap">
          <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" fill="none" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
          <input id="prod-search" type="search" value="${escapeHtml(prodSearch)}" placeholder="${t('prod_search_ph')}" autocomplete="off">
        </div>
        ${/* En el medio, entre el buscador y vista/orden — igual que Inventario.
             Con el catalogo vacio no se dibuja: marcar piezas cuando no hay
             ninguna no hace nada. */''}
        ${recipes.length ? `<button type="button" class="category-chip quick" id="btn-prod-select" style="flex-shrink:0;">${t('inv_select_btn')}</button>` : ''}
        ${invLayoutToggleHtml().replace('</div>', `
          <span class="inv-sort-wrap ${prodSort!=='name'?'on':''}" title="${t('inv_sort_label')}">${prodSortIcon}
            <select id="prod-sort" aria-label="${t('inv_sort_label')}">
              <option value="name" ${prodSort==='name'?'selected':''}>${t('prod_sort_name')}</option>
              <option value="price" ${prodSort==='price'?'selected':''}>${t('prod_sort_price')}</option>
              <option value="made" ${prodSort==='made'?'selected':''}>${t('prod_sort_made')}</option>
            </select>
          </span></div>`)}
        <button type="button" class="btn btn-primary btn-sm" id="btn-new-recipe-tab" style="flex-shrink:0;">${t('prod_new_recipe_short')}</button>
      </div>
    </div>`;
  if(recipes.length===0){
    /* EL CATALOGO VACIO LLEVA LA CAMARA DE REDUCCION EN LUGAR DEL MEDALLON
       (pedido del usuario 2026-09-10 sobre una captura, con el circulo marcado:
       "quita ese circulo de raiz y pon la camara roja que reduce").
       El medallon del emptyState es decorativo: ocupa el lugar mas visible de la
       pantalla sin hacer nada. La camara ahi si hace algo — y ademas resuelve que
       hasta ahora la herramienta de Reduccion NO aparecia con el catalogo vacio,
       porque esta rama sale antes de dibujarla.
       Se arma a mano en vez de con emptyState() porque emptyState lo usa TODA la
       app (inventario vacio, recibos vacios, filtros sin resultado) y ahi el
       medallon sigue siendo lo correcto: se copia su estructura, no se toca.
       SIN INVENTARIO NO SE PONE: un escaner que resta no tiene nada que restar, y
       un boton que no puede hacer nada es peor que el dibujo. Ahi vuelve el
       medallon de siempre. */
    if(inventory.length === 0){
      return emptyState('tag', t('prod_empty_title'), t('prod_empty_sub'), true,
        `<button type="button" class="btn btn-primary" id="btn-new-recipe-empty">${t('prod_new_recipe')}</button>`);
    }
    /* SOMBRAS DE COMO SE VERA EL CATALOGO (pedido del usuario 2026-09-10: "pon
       items ficticios o sombras asi mismo, como lo hiciste"). Mismo recurso que
       ya usan el Pedido sugerido y Gasto por mes, y por la misma razon que quedo
       escrita alla: la pantalla vacia decia que no hay nada pero no dejaba
       entender QUE aparece aca cuando si lo hay.
       Son fichas de EJEMPLO de verdad —mismas clases .inv-grid/.inv-tile, misma
       grilla de 3 columnas, misma forma— pero DESENFOCADAS y desvanecidas, con el
       blur creciendo hacia abajo: se lee la forma sin poder confundirlas con
       datos propios. Los nombres son genericos, NUNCA del inventario del usuario.
       aria-hidden y pointer-events:none — no son tocables ni las anuncia un
       lector de pantalla: son un dibujo, no contenido.
       Se van solas apenas exista una pieza, porque esta rama solo corre con el
       catalogo vacio. */
    const fantasmas = [
      {n:t('prod_ex1'), o:'.62', blur:'1.1px'},
      {n:t('prod_ex2'), o:'.42', blur:'2px'},
      {n:t('prod_ex3'), o:'.26', blur:'2.9px'},
    ].map(g=>`
      <div class="inv-tile ghost" aria-hidden="true" style="opacity:${g.o};filter:blur(${g.blur});">
        <div class="inv-tile-top">
          <div class="stock-icon-ring" style="width:48px;height:48px;flex-shrink:0;">${lineIcon('tag',20)}</div>
          <div class="inv-tile-name">${escapeHtml(g.n)}</div>
        </div>
      </div>`).join('');
    /* LA BARRA BAJA AL HUECO DEL BOTON DUPLICADO (pedido del usuario 2026-09-10
       sobre una captura: el "+ Agregar al catalogo" tachado en rojo, el menu y
       la nota marcados en verde — "una cosa ya la tienes dos veces y ponlo
       abajo el menu donde hice la marca verde"). Tenia razon en las dos partes.
       1) EL DUPLICADO. "+ Agregar" ya vive en la barra, asi que el boton amarillo
          del centro era el MISMO boton dos veces en una pantalla de tres cosas:
          los dos llaman a openRecipeModal(null), sin una sola diferencia. Se va
          el del centro y queda el de la barra. (El otro btn-new-recipe-empty, el
          de la rama sin inventario de mas arriba, SE QUEDA: alla no hay barra,
          es el unico camino, y por eso el manejador sigue existiendo.)
       2) DONDE VA LA BARRA. Con el catalogo vacio, arriba era un techo de
          controles apagados — buscar entre nada, ordenar nada, tres tamanos de
          una rejilla que no existe — y encima tapaba lo unico que si hace algo:
          la camara. Puesta en el hueco que dejo el boton tachado queda pegada a
          la nota de abajo y hace de puente: primero la accion, despues "asi se
          va a ver" y las fichas fantasma.
       Va FUERA del .empty-state y con position:static a proposito: .empty-state
       centra el texto y le comeria la forma de barra, y quedarse pegada arriba
       (sticky) no tiene sentido en una pantalla que casi no hace scroll.
       Sigue siendo la barra de verdad, no un dibujo como las fichas de abajo: su
       "+ Agregar" es el unico camino para crear la primera pieza.
       Nada de esto sobrevive a la primera pieza — con una sola, esta rama ya no
       corre y la barra vuelve sola a su sitio de siempre, arriba. */
    return `<div class="empty-state" style="padding:16px 20px 0;">
      <div class="inv-tools" style="margin:0 0 14px;">${shelfScanFab('prod', true)}</div>
      <h3 style="margin:0 0 6px;">${t('prod_empty_title')}</h3>
      <p style="margin:0;font-size:calc(13px * var(--fs, 1));">${t('prod_empty_sub')}</p>
    </div>
    <div class="prod-empty-bar">${barra}</div>
    <div class="empty-state" style="padding:0 20px 40px;">
      <div class="prod-ghost-note">${t('prod_ghost_note')}</div>
      <div class="inv-grid cols3 prod-ghost-grid">${fantasmas}</div>
    </div>`;
  }

  /* LA FICHA DEL CATÁLOGO: FOTO Y NOMBRE, NADA MÁS (pedido del usuario
     2026-09-10: "que se vean exactamente como estos pero sin descripción, que
     esté oculta y solo salga cuando se haga click").
     Y hay una razón de peso además de la estética: esta es la pantalla que se le
     muestra —o se le manda— a un cliente. Con el precio de venta y el % de
     ganancia impresos en cada tarjeta, mostrar el catálogo era regalar el margen.
     Precio, margen, costo por pieza y cuántas hay hechas viven un toque adentro,
     en la ficha, y ahí además están detrás de canSeeFinancials.
     Es la misma tarjeta de Inventario, con las mismas clases: sin las dos líneas
     de meta, todas quedan del mismo alto y ninguna se estira. */
  const tiles = lista.map(r=>{
    const foto = recipePhotoSrc(r);
    const marcado = prodSelectMode && prodSelected.has(r.id);
    return `
    <div class="inv-tile${marcado?' sel':''}" data-key="prodtile:${r.id}" ${prodSelectMode
        ? `data-prod-select="${r.id}" aria-pressed="${marcado}"`
        : `data-open-finished="${r.id}"`} role="button" tabindex="0" title="${escapeHtml(r.name)}">
      ${prodSelectMode ? `<span class="inv-tile-check" aria-hidden="true">${marcado?'✓':''}</span>` : ''}
      <div class="inv-tile-top">
        ${/* La foto NO abre el selector de foto acá. En la grilla ocupa casi toda
             la tarjeta, así que tocar el centro —lo que cualquiera hace para ver
             un producto— terminaba abriendo la galería en vez de los detalles.
             En un catálogo la foto ES el contenido: la tarjeta entera abre la
             ficha, y la foto se cambia desde adentro. */''}
        <div class="stock-icon-ring" style="width:48px;height:48px;flex-shrink:0;">
          ${foto ? `<img src="${escapeHtml(foto)}" alt="" loading="lazy">` : lineIcon('tag',20)}
        </div>
        <div class="inv-tile-name">${escapeHtml(invShortName(r.name))}</div>
      </div>
    </div>`;
  }).join('');
  return herramienta + chips + barra + `<div class="inv-grid ${invLayout}">${tiles}</div>`;
}

/* Compartir el CATÁLOGO con un cliente: foto, nombre y precio de venta. Nunca el
   costo, el margen ni cuántas hay hechas — esa es la vista interna, y el margen en
   manos de un cliente es lo más caro que se puede filtrar. Dusty ya tomó esta
   misma decisión al sacar los % de la lista pública de Inventario. */
async function shareSelectedRecipes(){
  const elegidas = recipes.filter(r=>prodSelected.has(r.id));
  if(elegidas.length===0) return;
  const lineas = elegidas.map(r=>{
    const venta = Number(r.salePrice)||0;
    return '• ' + r.name + (venta>0 ? ' — ' + money(venta) : '');
  });
  const texto = (businessName ? businessName + '\n\n' : '') + lineas.join('\n');
  const files = [];
  elegidas.forEach(r=>{
    if(!r.photo || !r.photo.base64) return;
    const safe = (r.name||'foto').replace(/[^\w\- ]+/g,'').trim().slice(0,40) || 'foto';
    const ext = /png/i.test(r.photo.mediaType||'') ? '.png' : '.jpg';
    try{ files.push(fileFromBase64(r.photo.base64, r.photo.mediaType, safe + ext)); }catch(e){}
  });
  try{
    const datos = (files.length && navigator.canShare && navigator.canShare({files}))
      ? {files, text: texto} : {text: texto};
    if(navigator.share){ await navigator.share(datos); return; }
    await navigator.clipboard.writeText(texto);
    showToast(t('prod_share_copied'));
  }catch(e){
    if(e && e.name==='AbortError') return; // el usuario cerró el panel de compartir
    try{ await navigator.clipboard.writeText(texto); showToast(t('prod_share_copied')); }catch(e2){}
  }
}

/* Borrado múltiple del catálogo. NO toca el inventario ni el historial: sacar algo
   del catálogo es dejar de ofrecerlo, no deshacer lo que ya se fabricó ni lo que ya
   se vendió. El stock de producto terminado que quedara sigue en el inventario,
   con su costo — borrar la ficha no puede evaporar mercadería que existe. */
function deleteSelectedRecipes(){
  const elegidas = recipes.filter(r=>prodSelected.has(r.id));
  if(elegidas.length===0) return;
  const conStock = elegidas.filter(r=>{ const t2 = finishedItemFor(r); return t2 && (Number(t2.qtyOnHand)||0) > 0; });
  let aviso = t('prod_delete_confirm').replace('{n}', String(elegidas.length));
  if(conStock.length) aviso += '\n\n' + t('prod_delete_has_stock').replace('{n}', String(conStock.length));
  if(!confirm(aviso)) return;
  elegidas.forEach(r=>{
    if(!deletedRecipeIds.includes(r.id)) deletedRecipeIds.push(r.id);
    if(r.photo && r.photo.path && currentUser){
      try{ firebase.storage().ref(r.photo.path).delete().catch(()=>{}); }catch(e){}
    }
  });
  const ids = new Set(elegidas.map(r=>r.id));
  recipes = recipes.filter(r=>!ids.has(r.id));
  prodExitSelect();
  saveState();
  logActivity('recipe_deleted', elegidas.length===1 ? elegidas[0].name : String(elegidas.length));
  hapticGolpe('MEDIUM');
  render();
}

/* ---------- VISTA: sección en Inventario ---------- */
/* El escáner de estante como ÚNICO botón redondo junto al título de Inventario
   (mismo lenguaje que el FAB del Dashboard). Producción entra como un botón normal
   más en la fila de acciones (ver inv-header-actions en app-05) — sin elementos
   visuales nuevos compitiendo con el FAB. */
function shelfScanFab(zona, hero){
  const z = zona || 'inv';
  if(inventory.length === 0) return '';
  /* MODO "hero": la presentacion del catalogo vacio (pedido del usuario
     2026-09-10). Ahi la camara no es una herramienta mas en una fila: es lo unico
     que hay en la pantalla, en el lugar donde antes vivia un medallon decorativo.
     Por eso va mas grande (96px contra 66) y SIN etiqueta debajo — "quita donde
     dice reduccion, quitalo de raiz esa parte" —: el texto de abajo existe para
     distinguirla de las otras dos herramientas de la fila de Inventario, y aca no
     hay otras. El signo pasa a "+/−" y a una pastilla, porque un circulo de 26px
     no lo aguanta.
     En Inventario NO cambia nada: ahi sigue siendo una de tres y necesita su
     nombre. */
  // Los dos .scan-fab-ring son el MISMO efecto de pulso del botón de escanear del
  // Dashboard (fabPulse + delay) — pedido del usuario: los dos escáneres de la app
  // laten igual y a la misma altura de pantalla.
  // Inventario reorganizado (maqueta aprobada 2026-09-07): el FAB vive en la
  // fila de herramientas con su NOMBRE debajo — "Reducción" desde el pedido del
  // usuario 2026-09-09 ("a ese botón ponle reducción"): nombra lo que HACE con
  // el stock, no el gesto de sacar la foto, y le hace juego al badge "−". El
  // qué-y-cómo sigue en el tooltip (shelf_banner_sub) y en la burbuja.
  /* El badge "−" volvió (pedido del usuario 2026-09-09 sobre una captura, con la
     esquina marcada: "ponle el signo negativo como estaba"). En la maqueta se
     había sacado suponiendo que el nombre debajo alcanzaba, pero el nombre dice
     QUÉ escanea, no en qué DIRECCIÓN mueve el stock: este escáner resta y el del
     Dashboard suma, y el signo es lo único que los distingue de un vistazo.
     Sigue abriendo la burbuja de instrucciones al tocarlo, igual que antes.
     El .shelf-fab-wrap ahora envuelve solo el botón —no toda la herramienta—
     porque el badge se ancla abajo a la izquierda de su caja: colgado de la
     herramienta entera caía al lado del texto. La burbuja sí queda colgada de la
     herramienta (.inv-tool ya es position:relative) para abrirse por debajo del
     nombre y no taparlo. */
  return `
  <div class="inv-tool${hero?' shelf-hero':''}" style="min-width:76px;">
    <span class="shelf-fab-wrap" style="display:block;">
      ${/* data-* y no id: la MISMA herramienta se dibuja en Inventario y en
           Producción, y dos nodos con el mismo id habrían dejado a uno de los
           dos sin handler (getElementById devuelve solo el primero). */''}
      <button type="button" class="shelf-scan-fab" data-shelf-scan="${z}"
        title="${t('shelf_banner_title')} — ${t('shelf_banner_sub')}"
        aria-label="${t('shelf_banner_title')}">
        <div class="scan-fab-ring"></div>
        <div class="scan-fab-ring delay"></div>
        ${lineIcon('camera',30)}
      </button>
      <button type="button" class="shelf-minus-badge${hero?' hero':''}" data-shelf-info="${z}" aria-label="${t('shelf_info_badge_aria')}" aria-expanded="${showShelfInfoBubble===z?'true':'false'}">${hero?'+/−':'−'}</button>
    </span>
    ${hero ? '' : `<span class="inv-tool-label" style="font-weight:800;">${t('shelf_banner_title')}</span>`}
    ${showShelfInfoBubble===z ? `
    <div class="shelf-info-backdrop" data-shelf-info-close="${z}"></div>
    <div class="shelf-info-bubble" data-shelf-info-close="${z}" role="tooltip">
      <strong>${t('shelf_info_title')}</strong>
      ${t('shelf_info_text')}
    </div>` : ''}
  </div>`;
}

/* Hub de Producción: la tarjeta que antes vivía en la pestaña, ahora como modal —
   recetas con producir/editar, nueva receta y el historial de salidas. */
let showProductionHub = false;
function productionHubModal(){
  return `
  <div class="overlay" id="production-hub-overlay">
    <div class="modal">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
        <h3 class="navy" style="margin:0;">${t('prod_section_title')}</h3>
        ${outflows.length>0 ? `<button type="button" class="link-btn" id="btn-open-outflows" style="padding:6px 4px;">${t('prod_outflows_link')}</button>` : ''}
      </div>
      ${recipes.length===0 ? `<div class="helper-note" style="margin:14px 0 4px;">${t('prod_no_recipes')}</div>` : recipes.map(r=>{
        const cost = recipeCostTotal(r.components, inventory);
        const photo = recipePhotoSrc(r);
        return `
        <div class="prod-recipe-row">
          <div class="stock-icon-ring" style="width:40px;height:40px;flex-shrink:0;">
            ${photo ? `<img src="${escapeHtml(photo)}" alt="" loading="lazy">` : lineIcon('tag',18)}
          </div>
          <div style="flex:1;min-width:0;">
            <div class="stock-name">${escapeHtml(r.name)}</div>
            <div class="stock-caption">${money(cost.total)} ${t('prod_cost_each')} · ${t('prod_components_n').replace('{n}', (r.components||[]).length)}${cost.missing>0 ? ` · <span style="color:var(--saffron-ink);">⚠</span>` : ''}</div>
          </div>
          <button type="button" class="stock-icon-btn edit" data-edit-recipe="${r.id}" title="${t('btn_edit')}">
            <svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
          </button>
          <button type="button" class="btn btn-primary btn-sm" data-produce-recipe="${r.id}">${t('prod_produce_btn')}</button>
        </div>`;
      }).join('')}
      <div class="modal-actions">
        <button class="btn btn-ghost" id="btn-close-production-hub">${t('btn_close')}</button>
        <button class="btn btn-primary" id="btn-new-recipe">${t('prod_new_recipe')}</button>
      </div>
    </div>
  </div>`;
}

/* ---------- FICHA DEL PRODUCTO TERMINADO (spec del usuario 2026-09-10) ----------
   "Al ejecutar onClick sobre una tarjeta o foto de producto terminado, desplegar
   una vista detallada estructurada en columnas: Insumo · Cantidad Requerida ·
   Costo Unitario Aplicado · Subtotal."
   Las cuatro columnas salen de bomRows (patron-core, con pruebas). El multiplicador
   de arriba las recalcula en vivo: con 1 se lee "qué lleva UNA", con 20 se lee "qué
   necesito para el lote" — la misma tabla contesta las dos preguntas.
   Los costos se muestran solo a quien puede ver números financieros: esta es la
   pantalla que dice cuánto te cuesta cada pieza, o sea tu margen, y es justo la que
   un cliente no debería ver. */
/* LA DESCRIPCIÓN DE UNA PIEZA ES LO QUE LLEVA (pedido del usuario 2026-09-10:
   "es bien importante que se describa cuánto de cada ítem del inventario tiene en
   la descripción"). "3 × Cable 10-2 · 8 × Breaker 20A" — cantidad por pieza y
   nombre del insumo, en una línea. Es la misma información que la tabla de
   composición, comprimida para caber donde no entra una tabla: bajo el nombre en
   la ficha, y como pie del visor de foto.
   Un insumo borrado sale marcado, nunca omitido en silencio: una composición a la
   que le falta un renglón se lee como completa y no lo está. */
function recipeComposition(rec, max){
  const filas = bomRows(rec ? rec.components : [], inventory, 1);
  if(filas.length===0) return '';
  const tope = max || filas.length;
  const partes = filas.slice(0, tope).map(f=>
    f.missing ? '⚠ ' + t('bom_gone') : `${roundQty(f.qty)} × ${f.name}`);
  if(filas.length > tope) partes.push('+' + (filas.length - tope));
  return partes.join(' · ');
}
let showFinishedItemModal = null; // id de la receta abierta
// Edición de la composición DENTRO de la ficha: sin salir a otra pantalla, que es
// lo que hacía falta para que "poder editarlo" sea un toque y no dos.
let finishedEditMode = false;
let finishedProduceCount = 1;
function openFinishedItemModal(recipeId){
  if(!requireWriteAccess()) return;
  showFinishedItemModal = recipeId; finishedProduceCount = 1; finishedEditMode = false; render();
}
function closeFinishedItemModal(){ showFinishedItemModal = null; finishedEditMode = false; render(); }
function finishedItemModal(){
  const rec = recipeById(showFinishedItemModal);
  if(!rec){ showFinishedItemModal = null; return ''; }
  const n = finishedEditMode ? 1 : Math.max(1, Math.round(Number(finishedProduceCount)||1));
  const filas = bomRows(rec.components, inventory, n);
  const total = bomTotal(filas);
  const term = finishedItemFor(rec);
  const hechas = term ? roundQty(Number(term.qtyOnHand)||0) : 0;
  const costoUnit = term ? Number(term.costPerUnit)||0 : 0;
  const venta = Number(rec.salePrice)||0;
  const plan = productionPlan(rec.components, n, inventory);
  const falta = plan.some(p=>p.short>0 || p.missing);
  const ver = canSeeFinancials();
  const foto = recipePhotoSrc(rec);
  return `
  <div class="overlay" id="finished-item-overlay">
    <div class="modal wide">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
        ${/* Acá SÍ: la foto de la ficha abierta se toca para cambiarla. Es un
             gesto deliberado, sobre un elemento chico y con su tooltip — no el
             centro de una tarjeta que el usuario tocó para ver el producto. */''}
        <div class="stock-icon-ring" data-photo-recipe="${rec.id}" title="${t('btn_upload_photo')}" style="cursor:pointer;width:52px;height:52px;flex-shrink:0;">
          ${foto ? `<img src="${escapeHtml(foto)}" alt="">` : lineIcon('tag',22)}
        </div>
        <div style="flex:1;min-width:0;">
          <h3 class="basil" style="margin:0 0 2px;">${escapeHtml(rec.name)}</h3>
          ${/* Precio, margen, stock y costo: todo lo que se sacó de la tarjeta
               para no mostrárselo a un cliente aparece acá, un toque adentro. */''}
          ${/* Sin precio no es un dato que falta y ya: es lo que decide si vender
               esta pieza suma ingresos o solo resta costo. Va en el color de aviso. */''}
          <div class="sub" style="margin:0;">${venta>0 ? `<b>${money(venta)}</b>` : `<b style="color:var(--saffron-ink);">⚠ ${t('prod_no_sale_price')}</b>`}${(()=>{
            if(!ver) return '';
            const m = (venta>0 && total>0) ? profitMarginPct(roundQty(total/n), venta) : null;
            return m===null ? '' : ` · <span style="color:${m<15?'var(--saffron-ink)':'var(--basil-ink)'};font-weight:700;">${m.toFixed(0)}%</span>`;
          })()}</div>
          <div class="sub" style="margin:0;">${hechas>0 ? t('prod_in_stock').replace('{n}', String(hechas)) : t('prod_none_made')}${ver && hechas>0 ? ` · ${money(costoUnit)} ${t('prod_cost_each')}` : ''}</div>
          ${(()=>{ const c = recipeComposition(rec); return c ? `<div class="sub" style="margin:2px 0 0;opacity:.75;">${escapeHtml(c)}</div>` : ''; })()}
        </div>
        <button type="button" class="stock-icon-btn edit" id="btn-edit-recipe-from-item" title="${t('btn_edit')}">
          <svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
        </button>
      </div>

      ${finishedEditMode ? '' : `
      <div class="field" style="margin-bottom:12px;">
        <label>${t('produce_count_label')}</label>
        <div class="qty-stepper">
          <button type="button" id="btn-fi-minus" ${n<=1?'disabled':''}>−</button>
          <input id="fi-produce-count" type="number" inputmode="numeric" min="1" step="1" value="${escapeHtml(n)}">
          <button type="button" id="btn-fi-plus">+</button>
        </div>
      </div>`}

      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 0 6px;">
        <label style="font-size:calc(12px * var(--fs, 1));font-weight:600;color:var(--ink-soft);">${finishedEditMode ? t('bom_edit_title') : t('bom_title')}</label>
        <button type="button" class="link-btn" id="btn-fi-edit-bom" style="padding:4px 2px;">${finishedEditMode ? '✓ '+t('inv_select_done') : t('bom_edit_btn')}</button>
      </div>
      ${/* EN MODO EDICIÓN el multiplicador se esconde y las cantidades vuelven a
           ser POR PIEZA. Con el multiplicador puesto, la columna mostraría "15 lb"
           para 5 piezas y editar ahí sería editar un número que no es el que se
           guarda — la definición de la pieza es cuánto lleva UNA. */''}
      <div class="bom-table${finishedEditMode ? ' editing' : ''}">
        <div class="bom-row bom-head">
          <span>${t('bom_col_item')}</span><span>${finishedEditMode ? t('bom_col_qty_each') : t('bom_col_qty')}</span>
          ${ver && !finishedEditMode ? `<span>${t('bom_col_cost')}</span><span>${t('bom_col_subtotal')}</span>` : ''}
          ${finishedEditMode ? '<span></span>' : ''}
        </div>
        ${filas.map((f,idx)=>`
        <div class="bom-row ${f.missing?'missing':''}">
          <span>${f.name ? escapeHtml(f.name) : `⚠ ${t('bom_gone')}`}</span>
          ${finishedEditMode
            ? `<span><input data-bom-qty="${idx}" type="number" inputmode="decimal" step="0.01" min="0" value="${escapeHtml(f.qtyPerPiece)}" style="width:100%;text-align:right;"></span>
               <span><button type="button" class="link-btn" data-bom-del="${idx}" title="${t('recipe_remove_component')}" style="color:var(--tomato-ink);padding:2px 4px;">✕</button></span>`
            : `<span>${escapeHtml(f.qty)} ${escapeHtml(unitLabel(f.unit))}</span>
               ${ver ? `<span>${f.cost===null ? '—' : money(f.cost)}</span><span>${f.missing ? '—' : money(f.subtotal)}</span>` : ''}`}
        </div>`).join('')}
        ${ver && !finishedEditMode ? `
        <div class="bom-row bom-total">
          <span>${t('bom_total')}</span><span></span><span></span><span>${money(total)}</span>
        </div>` : ''}
      </div>
      ${finishedEditMode ? `
      <div class="field" style="margin:10px 0 0;">
        <select id="fi-bom-add">${recipeIngOptions(null)}</select>
      </div>
      <div class="helper-note" style="margin:8px 0 0;">${t('bom_edit_helper')}</div>` : ''}
      ${ver && venta>0 ? `<div class="helper-note" style="margin:10px 0 0;">${t('bom_sale_line')
          .replace('{sale}', money(roundQty(venta*n)))
          .replace('{profit}', money(roundQty(venta*n - total)))}</div>` : ''}
      ${falta ? `<div style="font-size:calc(11.5px * var(--fs, 1));font-weight:700;color:var(--saffron-ink);background:var(--saffron-soft);padding:7px 10px;border-radius:8px;margin-top:10px;">⚠ ${t('bom_short_note')}</div>` : ''}

      <div class="modal-actions">
        <button class="btn btn-ghost" id="btn-close-finished-item">${t('btn_close')}</button>
        ${finishedEditMode ? '' : `<button class="btn btn-primary" id="btn-fi-produce" ${filas.length===0?'disabled':''}>${t('bom_produce_btn').replace('{n}', String(n))}</button>`}
      </div>
    </div>
  </div>`;
}

/* ---------- MODAL: RECETA (crear/editar) ---------- */
function openRecipeModal(recipe){
  if(!requireWriteAccess()) return;
  draftRecipe = recipe
    ? {id:recipe.id, name:recipe.name, photo:recipe.photo||null, salePrice:recipe.salePrice||null, components:(recipe.components||[]).map(c=>({...c}))}
    : {id:uid('rc'), name:'', photo:null, salePrice:null, components:[]};
  editingRecipeId = recipe ? recipe.id : null;
  recipeScanState='idle'; recipeScanError=''; recipeScanNote=''; recipeScanRequestId++;
  showRecipeModal = true; render();
}
/* Cuáles de los marcados pueden ser insumo de verdad. Vive aparte porque la
   cuenta la necesitan DOS lugares y tienen que decir lo mismo: el número del
   botón ("vas a mover N") y la acción ("moví N"). Cuando el botón contaba los
   marcados a secas, prometía 3 y movía 2 — un gasto marcado entre los tres
   inflaba el número y el usuario se enteraba después, por el toast. */
function prodEligibleSelected(){
  return inventory.filter(i => i && invSelected.has(i.id) && !isExpenseItem(i) && !i.finishedGood);
}

/* MOVER LO SELECCIONADO DEL INVENTARIO AL CATÁLOGO (idea del usuario 2026-09-10).
   Marcás en Inventario los productos que usás para hacer UNA cosa y con un botón
   se arma la pieza: los seleccionados entran como sus insumos, uno de cada uno
   por pieza, y se abre la ficha para ponerle nombre y foto. Es el camino corto
   para el usuario que ya tiene su inventario cargado y no quiere volver a elegir
   producto por producto en un selector.

   SE HACE UNA SOLA PIEZA, no una por producto marcado: si marcaste cable y
   breakers es porque con los dos hacés un tablero, no dos productos distintos.
   Eso es lo que pidió el usuario y es además lo único que tiene sentido.

   LOS PRODUCTOS NO SE VAN DEL INVENTARIO, y esto no es un detalle: "mover" acá
   es "usar como receta", no "sacar de la lista". Producir DESCUENTA esos insumos
   del inventario, así que si el botón los borrara no quedaría de dónde
   descontar, la composición apuntaría a productos que ya no existen y la pieza
   se quedaría sin costo. El stock y el costo de cada insumo son justamente lo
   que le da precio a la pieza.

   Cantidad 1 de cada uno como punto de partida: marcar productos no dice cuántos
   lleva cada pieza. Se corrige en la misma ficha, en la tabla de composición, que
   ya se edita ahí mismo. */
function moveSelectedToProduction(){
  // Un gasto (luz, alquiler) no es un insumo: no tiene stock del que descontar.
  // Y una pieza terminada tampoco entra acá — se filtran sin drama, avisando.
  const elegidos = prodEligibleSelected();
  const descartados = invSelected.size - elegidos.length;
  if(elegidos.length === 0){
    showToast(t('move_prod_none'), 'error');
    return;
  }
  // Si tenía Producción apagada, prenderla: sin esto la pieza caía en una pestaña
  // que el usuario no puede ver.
  if(!usesProduction()){ productionTabPref = 'on'; try{ localStorage.setItem('patron_production_tab','on'); }catch(e){} }
  refreshTabOrder();
  activeTab = 'produccion';
  draftRecipe = {
    id: uid('rc'), name: '', photo: null, salePrice: null,
    components: elegidos.map(i => ({ ingId: i.id, qty: 1 }))
  };
  editingRecipeId = null;
  recipeScanState='idle'; recipeScanError=''; recipeScanNote=''; recipeScanRequestId++;
  showRecipeModal = true;
  invExitSelect();
  showToast(descartados > 0
    ? t('move_prod_some').replace('{n}', String(elegidos.length)).replace('{f}', String(descartados))
    : t('move_prod_ok').replace('{n}', String(elegidos.length)));
  render();
}

function closeRecipeModal(){ recipeScanRequestId++; showRecipeModal=false; draftRecipe=null; editingRecipeId=null; render(); }

// Opciones del selector de insumo, ordenadas por nombre para encontrarlas rápido.
/* Qué puede ser insumo de una pieza. Dos exclusiones:
   - LA PIEZA MISMA. Su producto terminado no puede ser insumo de sí mismo:
     producir consumiría justo lo que está creando, y el costo se perseguiría la
     cola. Se excluye SOLO el propio, no todos los terminados — usar una pieza que
     también fabricás dentro de otra (una caja de registro dentro de un tablero)
     es manufactura legítima y hay que dejarla.
   - LOS ÍTEMS DE GASTO (luz, internet, Eat out). Un tablero no se construye con
     una boleta de luz; ofrecerla como insumo solo sirve para meter la pata. */
function recipeIngOptions(selectedId){
  const propio = (draftRecipe && finishedItemFor(draftRecipe)) || null;
  const sorted = inventory
    .filter(i => i && !isExpenseItem(i) && !(propio && i.id===propio.id))
    .sort((a,b)=>a.name.localeCompare(b.name));
  return `<option value="">${t('recipe_pick_product')}</option>` +
    sorted.map(i=>`<option value="${i.id}" ${selectedId===i.id?'selected':''}>${escapeHtml(i.name)} (${escapeHtml(unitLabel(i.unit))})</option>`).join('');
}

function recipeModal(){
  const cost = recipeCostTotal(draftRecipe.components.filter(c=>c.ingId), inventory);
  const photo = recipePhotoSrc(draftRecipe);
  return `
  <div class="overlay" id="recipe-overlay">
    <div class="modal wide">
      <h3 class="basil">${editingRecipeId ? t('recipe_edit_title') : t('recipe_new_title')}</h3>
      <div class="sub">${t('recipe_sub')}</div>

      <div class="settings-card">
        ${settingsCardHeader('tag','var(--basil-soft)','var(--basil-ink)',t('item_section_basic'))}
        <div style="display:flex;align-items:center;gap:12px;">
          <div class="stock-icon-ring" style="width:52px;height:52px;flex-shrink:0;">
            ${photo ? `<img src="${escapeHtml(photo)}" alt="">` : lineIcon('tag',20)}
          </div>
          <div class="field" style="flex:1;margin-bottom:0;">
            <label for="recipe-name">${t('recipe_name_label')}</label>
            <input id="recipe-name" type="text" value="${escapeHtml(draftRecipe.name)}" placeholder="${t('recipe_name_ph')}">
          </div>
        </div>
        <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">
          <button type="button" class="btn btn-ghost btn-sm" id="btn-recipe-photo" style="flex:1;">${t('btn_upload_photo')}</button>
          <button type="button" class="btn btn-ghost btn-sm" id="btn-recipe-scan" ${recipeScanState==='loading'?'disabled':''} style="flex:2;">${t('recipe_scan_btn')}</button>
          <input type="file" id="recipe-photo-file" accept="image/*" style="display:none;">
          ${/* Dos entradas para la MISMA lectura: la de arriba lleva capture y abre
               la cámara directo (estás parado frente a la pieza); la de abajo, sin
               capture, abre la galería. Era el único escáner de la app sin salida a
               la galería — Recibos, Productos y el de reducción ya la tenían, y si
               la foto de la pieza ya estaba en el teléfono no había forma de usarla. */''}
          <input type="file" id="recipe-scan-file" accept="image/*" capture="environment" style="display:none;">
          <input type="file" id="recipe-scan-file-gallery" accept="image/*" style="display:none;">
        </div>
        ${recipeScanState==='loading' ? '' : `<button type="button" id="btn-recipe-scan-gallery" class="dz-gallery-link" style="margin:10px auto 0;">${t('scan_upload_gallery_btn')}</button>`}
        <div class="helper-note" style="margin:8px 0 0;">${t('recipe_scan_hint')}</div>
        ${recipeScanState==='loading' ? `<div class="scan-status" style="margin:12px 0 0;"><div class="spinner"></div> ${t('recipe_scan_loading')}</div>` : ''}
        ${recipeScanState==='error' ? `<div class="scan-error" style="margin:12px 0 0;">⚠ ${escapeHtml(recipeScanError)}</div>` : ''}
        ${recipeScanNote ? `<div class="helper-note" style="margin:12px 0 0;background:var(--saffron-soft);color:var(--saffron-ink);border-radius:8px;padding:8px 10px;">${escapeHtml(recipeScanNote)}</div>` : ''}
      </div>

      <div class="settings-card">
        ${settingsCardHeader('box','var(--navy-wash)','var(--navy)',t('recipe_components_label'))}
        ${draftRecipe.components.length===0 ? `<div class="helper-note" style="margin:0 0 10px;">${t('recipe_no_components_yet')}</div>` : ''}
        ${draftRecipe.components.map((c,idx)=>{
          const ing = inventory.find(i=>i.id===c.ingId);
          return `
          <div class="recipe-comp-row">
            <select data-rcomp-ing="${idx}" style="flex:2;min-width:0;">${recipeIngOptions(c.ingId)}</select>
            <input data-rcomp-qty="${idx}" type="number" inputmode="decimal" step="0.01" min="0" value="${escapeHtml(c.qty??'')}" placeholder="${t('recipe_qty_ph')}" style="flex:1;min-width:64px;">
            <span class="recipe-comp-unit">${ing ? escapeHtml(unitLabel(ing.unit)) : ''}</span>
            <button type="button" class="stock-row-x-btn" data-rcomp-remove="${idx}" title="${t('btn_delete')}">✕</button>
          </div>`;
        }).join('')}
        <button type="button" class="btn btn-ghost btn-sm" id="btn-add-component" style="margin-top:6px;">${t('recipe_add_component')}</button>
        ${/* La duda que deja el botón "A producción" del Inventario: ¿mis productos
             se fueron? No. Se dice acá, donde aparece la respuesta, y no solo en
             un toast que se va en tres segundos. */''}
        ${draftRecipe.components.filter(c=>c.ingId).length>0
          ? `<div class="helper-note" style="margin:8px 0 0;">${t('move_prod_kept')}</div>` : ''}
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:14px;padding-top:12px;border-top:1px solid var(--line);">
          <span style="font-size:calc(13px * var(--fs, 1));font-weight:700;color:var(--ink);">${t('recipe_cost_line')}</span>
          <span id="recipe-cost-display" style="font-family:'IBM Plex Mono';font-weight:700;font-size:calc(16px * var(--fs, 1));color:var(--money-pos);">${money(cost.total)}</span>
        </div>
        ${cost.missing>0 ? `<div class="helper-note" style="margin:8px 0 0;color:var(--saffron-ink);">⚠ ${t('recipe_cost_missing').replace('{n}', cost.missing)}</div>` : ''}
        ${/* Precio de venta por pieza (opcional): la ÚNICA forma honesta de que el
             Cierre de mes estime ingresos de una producción — antes se valuaban
             los insumos consumidos al salePrice de cada insumo, que inventaba
             ingresos o pérdidas (revisión de contador 2026-09-04). */''}
        ${/* El precio LATE cuando falta, igual que el costo y el precio de venta de
             un ítem del inventario (needsValueClass, app-06). Es el mismo aviso
             porque es el mismo agujero: medido 2026-09-10, vender 2 piezas de $231
             sin precio cargado daba $0 de ingresos y $462 de costo — una venta real
             registrada como pérdida pura. Sigue sin ser obligatorio (una pieza
             puede fabricarse solo para consumo interno), pero ya no se pasa por
             alto sin querer. */''}
        <div class="field" style="margin:12px 0 0;">
          <label for="recipe-sale-price">${t('recipe_sale_price_label')}</label>
          <input id="recipe-sale-price"${needsValueClass(draftRecipe.salePrice)} type="number" step="0.01" min="0" inputmode="decimal" value="${draftRecipe.salePrice??''}" placeholder="0.00">
          <div class="helper-note" style="margin:6px 0 0;">${t('recipe_sale_price_helper')}</div>
        </div>
      </div>

      <div class="modal-actions">
        ${editingRecipeId ? `<button class="btn btn-ghost" id="btn-delete-recipe" style="color:var(--tomato);border-color:color-mix(in srgb, var(--tomato) 35%, var(--panel));">${t('btn_delete')}</button>` : ''}
        <button class="btn btn-ghost" id="btn-cancel-recipe">${t('btn_cancel')}</button>
        <button class="btn btn-primary" id="btn-save-recipe">${t('btn_save')}</button>
      </div>
    </div>
  </div>`;
}

// Actualiza SOLO el numerito del costo en el DOM mientras se tipean cantidades —
// mismo truco que handleProfitFieldInput: un render() completo por tecla re-dispara
// la animación de entrada del modal y "tiembla".
function refreshRecipeCostDisplay(){
  const el = document.getElementById('recipe-cost-display');
  if(!el || !draftRecipe) return;
  const cost = recipeCostTotal(draftRecipe.components.filter(c=>c.ingId), inventory);
  el.textContent = money(cost.total);
}

/* La foto de la pieza terminada como asistente de la receta: el modo stock lee los
   insumos que reconoce del inventario + una cantidad estimada, y PRELLENA el
   borrador — el usuario corrige y confirma. La estimación es humilde a propósito
   (la visión identifica muy bien y cuenta ±10%): por eso llena un formulario
   editable, no guarda nada sola. */
async function runRecipeScan(file){
  const requestId = ++recipeScanRequestId;
  recipeScanState='loading'; recipeScanError=''; recipeScanNote=''; render();
  try{
    const img = await loadImageFromFile(file);
    const image = resizeToBase64(img, 1400, 0.9);
    const products = await readStockFromPhoto(image);
    if(requestId !== recipeScanRequestId || !showRecipeModal || !draftRecipe) return;
    const unmatched = [];
    let added = 0;
    const propio = (draftRecipe && finishedItemFor(draftRecipe)) || null;
    products.forEach(p=>{
      const ing = matchStockReading(p);
      // Mismo criterio que el selector de insumos (ver recipeIngOptions): ni la
      // pieza misma ni un ítem de gasto pueden entrar como insumo, aunque la IA
      // los reconozca en la foto.
      if(!ing || isExpenseItem(ing) || (propio && ing.id===propio.id)){ unmatched.push(p.name); return; }
      const qty = detectedQtyFromReading(p, ing.capacityFull);
      const existing = draftRecipe.components.find(c=>c.ingId===ing.id);
      if(existing){
        if(qty!==null) existing.qty = qty;
      } else {
        draftRecipe.components.push({ingId: ing.id, qty: qty!==null ? qty : ''});
      }
      added++;
    });
    // La misma foto sirve de ícono de la receta si todavía no tiene uno — es la
    // foto de la pieza terminada, exactamente lo que la fila quiere mostrar.
    if(!draftRecipe.photo) draftRecipe.photo = resizeToBase64(img, 300, 0.75);
    if(added===0){
      recipeScanState='error';
      recipeScanError = t('recipe_scan_none');
    } else {
      recipeScanState='idle';
      if(unmatched.length>0) recipeScanNote = t('recipe_scan_unmatched').replace('{list}', unmatched.join(', '));
    }
    render();
  }catch(err){
    if(requestId !== recipeScanRequestId) return;
    if(err && err.trialQuota){ closeRecipeModal(); openUpgradeModal(t('trial_scans_over_note')); return; }
    if(!showRecipeModal) return;
    recipeScanState='error'; recipeScanError = err.message || t('product_scan_error');
    render();
  }
}

function saveRecipeFromModal(){
  const nameInput = document.getElementById('recipe-name');
  const name = (nameInput ? nameInput.value : draftRecipe.name).trim();
  if(!name){ showToast(t('recipe_need_name'), 'error'); return; }
  const components = draftRecipe.components
    .map(c=>({ingId:c.ingId, qty: roundQty(parseFloat(c.qty)||0)}))
    .filter(c=>c.ingId && c.qty>0);
  if(components.length===0){ showToast(t('recipe_need_components'), 'error'); return; }
  const spInput = document.getElementById('recipe-sale-price');
  const sp = spInput ? roundQty(Math.max(0, parseFloat(spInput.value)||0)) : (draftRecipe.salePrice||0);
  const rec = {id: draftRecipe.id, name, photo: draftRecipe.photo||null, components,
    salePrice: sp>0 ? sp : null,
    createdAt: (editingRecipeId && recipeById(editingRecipeId)?.createdAt) || new Date().toISOString()};
  if(currentUser){ rec.lastEditedBy = currentUserLabel(); rec.lastEditedAt = new Date().toISOString(); }
  const idx = editingRecipeId ? recipes.findIndex(r=>r.id===editingRecipeId) : -1;
  if(idx!==-1) recipes[idx]=rec; else recipes.push(rec);
  // El stock de esta pieza (si ya se produjo alguna vez) sigue al nombre, la foto
  // y el precio de la receta — ver syncFinishedItem.
  syncFinishedItem(rec);
  saveState();
  // Fire-and-forget, como las fotos de recibos: la foto se sube a Storage y por
  // meta viaja solo la referencia; si falla, catchUpRecipePhotoUploads reintenta.
  uploadRecipePhoto(rec);
  logActivity(idx!==-1 ? 'recipe_edited' : 'recipe_created', name);
  closeRecipeModal();
}

function deleteRecipeFromModal(){
  const rec = editingRecipeId ? recipeById(editingRecipeId) : null;
  if(!rec) return;
  if(!confirm(t('recipe_delete_confirm').replace('{name}', rec.name))) return;
  recipes = recipes.filter(r=>r.id!==rec.id);
  // Lápida: sin esto, otro dispositivo re-subiría su copia de meta con la receta
  // adentro y la revivía — mismo mecanismo que deletedCalNoteIds.
  if(!deletedRecipeIds.includes(rec.id)) deletedRecipeIds.push(rec.id);
  // La foto en Storage se limpia best-effort — un archivo huérfano no es grave
  // (solo el dueño/equipo pueden leerlo), pero mejor no acumular basura.
  if(rec.photo && rec.photo.path && currentUser){
    try{ firebase.storage().ref(rec.photo.path).delete().catch(()=>{}); }catch(e){}
  }
  saveState();
  logActivity('recipe_deleted', rec.name);
  closeRecipeModal();
}

/* Quitar la foto de una pieza desde el visor. El archivo en Storage se borra
   best-effort (un huérfano no es grave, pero mejor no acumular basura); el
   .photo=null y el saveState los hace quien llama. */
function dropRecipePhoto(rec){
  if(!rec || !rec.photo || !rec.photo.path || !currentUser) return;
  try{ firebase.storage().ref(rec.photo.path).delete().catch(()=>{}); }catch(e){}
}

/* ---------- MODAL: REGISTRAR PRODUCCIÓN ---------- */
function openProduceModal(recipeId){
  if(!requireWriteAccess()) return;
  produceRecipeId = recipeId; produceCount = 1;
  const rec = recipeById(recipeId);
  produceSalePrice = (rec && Number(rec.salePrice)>0) ? rec.salePrice : '';
  showProduceModal = true; render();
}
function closeProduceModal(){ showProduceModal=false; produceRecipeId=null; render(); }

function produceModal(){
  const rec = recipeById(produceRecipeId);
  if(!rec) return '';
  const plan = productionPlan(rec.components, produceCount, inventory);
  const cost = recipeCostTotal(rec.components, inventory);
  const batchCost = roundQty(cost.total * (Number(produceCount)||0));
  const photo = recipePhotoSrc(rec);
  return `
  <div class="overlay" id="produce-overlay">
    <div class="modal">
      <h3 class="basil">${t('produce_title')}</h3>
      <div class="sub">${t('produce_sub')}</div>

      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
        <div class="stock-icon-ring" style="width:44px;height:44px;flex-shrink:0;">
          ${photo ? `<img src="${escapeHtml(photo)}" alt="">` : lineIcon('tag',18)}
        </div>
        <strong style="flex:1;font-size:calc(15px * var(--fs, 1));">${escapeHtml(rec.name)}</strong>
      </div>

      <div class="field" style="margin-bottom:16px;">
        <label>${t('produce_count_label')}</label>
        <div class="qty-stepper">
          <button type="button" id="btn-produce-minus" ${produceCount<=1?'disabled':''}>−</button>
          <input id="produce-count-input" type="number" inputmode="numeric" min="1" step="1" value="${escapeHtml(produceCount)}">
          <button type="button" id="btn-produce-plus">+</button>
        </div>
      </div>

      <label style="display:block;font-size:calc(12px * var(--fs, 1));font-weight:600;color:var(--ink-soft);margin:0 0 8px;">${t('produce_deduct_header')}</label>
      ${plan.map(p=>{
        if(p.missing) return `<div class="matched-item" style="cursor:default;opacity:.7;"><div class="mi-top"><strong style="flex:1;">?</strong></div><div style="font-size:calc(11px * var(--fs, 1));font-weight:700;color:var(--tomato-ink);">⚠ ${t('produce_missing_note')}</div></div>`;
        return `
        <div class="matched-item" style="cursor:default;">
          <div class="mi-top">
            <strong style="flex:1;">${escapeHtml(p.name)}</strong>
            <span style="font-family:'IBM Plex Mono';font-size:calc(12.5px * var(--fs, 1));color:var(--ink-soft);white-space:nowrap;">${escapeHtml(p.current)} → <strong style="color:var(--ink);">${escapeHtml(p.after)}</strong> ${escapeHtml(unitLabel(p.unit))}</span>
          </div>
          <div style="font-size:calc(12px * var(--fs, 1));color:var(--ink-soft);">−${escapeHtml(p.deduct)} ${escapeHtml(unitLabel(p.unit))}</div>
          ${p.short>0 ? `<div style="font-size:calc(11px * var(--fs, 1));font-weight:700;color:var(--saffron-ink);background:var(--saffron-soft);padding:5px 8px;border-radius:6px;margin-top:6px;">⚠ ${t('produce_short_note').replace('{n}', p.short).replace('{u}', escapeHtml(unitLabel(p.unit)))}</div>` : ''}
        </div>`;
      }).join('')}

      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:10px;">
        <span style="font-size:calc(13px * var(--fs, 1));font-weight:700;color:var(--ink);">${t('produce_batch_cost')}</span>
        <span style="font-family:'IBM Plex Mono';font-weight:700;font-size:calc(16px * var(--fs, 1));color:var(--money-pos);">${money(batchCost)}</span>
      </div>

      ${(()=>{
        // Precio de venta por pieza: queda en el producto terminado (es lo que
        // usan Potencial de venta y la Reducción al vender). NO es un ingreso:
        // producir no es vender (ver applyProduction), así que el texto muestra
        // "al venderlas" y no un "ingreso estimado" que nunca se registraba
        // (auditoría UX 2026-09-11).
        const pd = parseFloat(produceSalePrice);
        const unitSale = (Number.isFinite(pd) && pd>0) ? pd : 0;
        const count = Math.max(1, Math.round(Number(produceCount)||1));
        return `
      <div class="field" style="margin-top:12px;">
        <label>${t('produce_price_label')}</label>
        <input id="produce-price-input" type="number" inputmode="decimal" min="0" step="0.01" value="${escapeHtml(produceSalePrice)}" placeholder="0.00">
        ${unitSale>0
          ? `<div class="helper-note" style="margin:6px 0 0;">${t('produce_income_line').replace('{amount}', money(roundQty(count*unitSale)))}</div>`
          : `<div style="font-size:calc(11px * var(--fs, 1));font-weight:600;color:var(--saffron-ink);background:var(--saffron-soft);padding:5px 8px;border-radius:6px;margin-top:6px;">ℹ ${t('produce_no_price_note')}</div>`}
      </div>`;
      })()}

      <div class="modal-actions">
        <button class="btn btn-ghost" id="btn-cancel-produce">${t('btn_cancel')}</button>
        <button class="btn btn-primary" id="btn-confirm-produce" ${plan.length===0?'disabled':''}>${t('produce_confirm_btn')}</button>
      </div>
    </div>
  </div>`;
}

function applyProduction(){
  // Mismo candado que al abrir el modal: si la cuenta se cerró mientras el
  // modal estaba abierto (402 de otra llamada), Firestore rechazaría la escritura
  // y el descuento quedaría solo en este teléfono, distinto de la nube.
  if(!requireWriteAccess()) return;
  const rec = recipeById(produceRecipeId);
  if(!rec) return;
  const count = Math.max(1, Math.round(Number(produceCount)||1));
  const plan = productionPlan(rec.components, count, inventory);
  if(plan.length===0) return;
  const items = [];
  plan.forEach(p=>{
    if(p.missing) return;
    const ing = inventory.find(i=>i.id===p.ingId);
    if(!ing) return;
    ing.qtyOnHand = p.after;
    if(currentUser){ ing.lastEditedBy = currentUserLabel(); ing.lastEditedAt = new Date().toISOString(); }
    // Lo REALMENTE descontado (si faltaba stock, el descuento se frenó en 0).
    // costAt: snapshot del costo unitario de HOY — sin él, el P&L de meses viejos
    // se revaluaba a precios actuales y borrar un producto borraba su historia.
    items.push({ingId: p.ingId, ingName: p.name, qty: roundQty(p.deduct - p.short), unit: p.unit,
      costAt: Number(ing.costPerUnit)||0});
  });
  // saleTotal/costTotal: el P&L de una producción se estima por el precio de la
  // PIEZA — el escrito en el modal para ESTA corrida (puede diferir del de la
  // receta: descuentos, precio del día), o el de la receta si el campo quedó
  // vacío/inválido. Sin ninguno de los dos, la corrida queda fuera del P&L.
  const costTotal = roundQty(items.reduce((s,it)=>s + Math.abs(it.qty)*it.costAt, 0));
  /* LA SEGUNDA PATA DE LA TRANSFERENCIA. Producir saca materia prima (arriba) y
     mete PRODUCTO TERMINADO acá. Sin esto la plata desaparecía: salía la harina y
     no entraba la pizza, así que el Valor del inventario bajaba sin motivo y el
     P&L se inventaba un ingreso al FABRICAR para tapar el agujero.
     El costo del terminado sale del PROMEDIO PONDERADO (weightedAvgCost, en
     patron-core con pruebas): 100 piezas a $4 más una tanda de 50 que costó $300
     dan $4.6667, no $6. Es lo que hace que fabricar en tandas a precios distintos
     deje un costo real y no el de la última tanda. */
  const terminado = ensureFinishedItem(rec);
  const stockPrevio = Number(terminado.qtyOnHand)||0;
  terminado.costPerUnit = weightedAvgCost(stockPrevio, terminado.costPerUnit, count, costTotal);
  terminado.qtyOnHand = roundQty(stockPrevio + count);
  // Entrada de stock: este nivel es el nuevo "lleno" de la barra, igual que una
  // compra en el inventario de siempre.
  terminado.stockFullRef = terminado.qtyOnHand;
  // El precio escrito en el modal SÍ se usa (auditoría UX 2026-09-11: antes se
  // pedía, se mostraba y se tiraba): queda como precio de venta del terminado,
  // que es lo que ve Potencial de venta y lo que propone la Reducción al vender.
  const precioPieza = parseFloat(produceSalePrice);
  if(Number.isFinite(precioPieza) && precioPieza > 0) terminado.salePrice = roundQty(precioPieza);
  if(currentUser){ terminado.lastEditedBy = currentUserLabel(); terminado.lastEditedAt = new Date().toISOString(); }
  /* PRODUCIR NO ES VENDER, y desde que el terminado existe como stock, contarlo
     como ingreso sería contarlo DOS VECES (al fabricar y al vender). Por eso esta
     corrida ya no lleva saleTotal: producedItemId la marca como del modelo nuevo y
     outflowPL la deja fuera del P&L (ver app-03). Las producciones VIEJAS conservan
     su saleTotal y su comportamiento, así que los meses cerrados no se mueven. */
  recordOutflow({
    id: uid('o'), type:'production', recipeId: rec.id, recipeName: rec.name, count,
    producedItemId: terminado.id, producedUnitCost: terminado.costPerUnit,
    items, costTotal, date: localDateStr(), createdAt: new Date().toISOString(),
    by: currentUser ? currentUser.uid : null, byLabel: currentUser ? currentUserLabel() : ''
  });
  saveState();
  showToast(t('produce_done')
    .replace('{n}', String(count))
    .replace('{name}', rec.name)
    .replace('{amount}', money(costTotal)));
  logActivity('production', rec.name, String(count));
  closeProduceModal();
}

/* ---------- MODAL: HISTORIAL DE SALIDAS ---------- */
function outflowsModal(){
  return `
  <div class="overlay" id="outflows-overlay">
    <div class="modal">
      <h3 class="navy">${t('outflows_title')}</h3>
      <div class="sub">${t('outflows_sub')}</div>
      ${outflows.length===0 ? `<div class="helper-note" style="margin:0 0 8px;">${t('outflows_empty')}</div>` :
      outflows.filter(o=>o.type!=='quote' && !(o.type==='service' && o.deleted)).map(o=>`
        <div class="matched-item" style="cursor:default;">
          <div class="mi-top">
            <span class="mi-icon" style="background:${o.type==='production'?'var(--basil)':'var(--sky)'};">${lineIcon(o.type==='production'?'tag':'camera',12)}</span>
            <strong style="flex:1;">${o.type==='production'
              ? `${t('outflow_production')} — ${escapeHtml(o.count)} × "${escapeHtml(o.recipeName)}"`
              : o.type==='service' ? `${t('outflow_service')} — ${escapeHtml(o.client||'')} · ${money(o.price||0)}`
              : t('outflow_adjust')}</strong>
            <span style="font-size:calc(11px * var(--fs, 1));color:var(--ink-soft);white-space:nowrap;">${timeAgo(o.createdAt)}</span>
          </div>
          <div style="font-size:calc(12px * var(--fs, 1));color:var(--ink-soft);display:flex;flex-wrap:wrap;gap:4px 12px;">
            ${(o.items||[]).map(it=>`<span style="white-space:nowrap;">${it.qty>=0?'−':'+'}${escapeHtml(Math.abs(it.qty))} ${escapeHtml(unitLabel(it.unit))} ${escapeHtml(it.ingName)}</span>`).join('')}
          </div>
          ${o.byLabel ? `<div style="font-size:calc(11px * var(--fs, 1));color:var(--ink-soft);margin-top:4px;">${escapeHtml(o.byLabel)}</div>` : ''}
        </div>
      `).join('')}
      <div class="modal-actions">
        <button class="btn btn-primary" id="btn-close-outflows" style="width:100%;">${t('btn_close')}</button>
      </div>
    </div>
  </div>`;
}

/* ---------- MODAL: ESCÁNER DE ESTANTE ---------- */
function openShelfModal(){
  if(!requireWriteAccess()) return;
  showShelfInfoBubble = null; // abrir el escáner cierra la burbuja de instrucciones
  if(!currentUser){
    // Mismo trato que los otros escáneres: cuenta real desconectada → login;
    // si no, trial anónimo en segundo plano y el modal abre al instante.
    if(everHadRealAccount()){
      ensurePatronFirebaseReady().catch(()=>{});
      openAuthModal(t('scan_requires_account'));
      return;
    }
    ensureTrialAccount().catch(()=>{});
  }
  shelfRequestId++;
  shelfState='camera'; shelfItems=[]; shelfUnmatched=[]; shelfError=''; shelfReason=null;
  showShelfModal = true; render();
  // Intro única (2026-09-07): el mismo modal con caja punteada que Recibos y
  // Productos; la hoja de fotos recién al tocar la caja. El visor en vivo se
  // retiró.
}
function closeShelfModal(){ shelfRequestId++; stopShelfCamera(); showShelfModal=false; render(); }
function restartShelfCamera(){
  shelfRequestId++;
  shelfState='camera'; shelfItems=[]; shelfUnmatched=[]; shelfError='';
  render();
}
function stopShelfCamera(){
  if(!shelfCamStream) return;
  const s = shelfCamStream;
  shelfCamStream = null;
  try{ s.getTracks().forEach(tr=>tr.stop()); }catch(e){}
}
// (El visor en vivo por getUserMedia se retiró el 2026-09-07 — intro única de
// cámara, ver openPhotoSource en app-06. shelfCamStream queda declarado porque
// el guard de render() lo consulta; ahora es siempre null.)

// Aviso de calidad antes de gastar el escaneo (compartido con Recibos y Productos).
function gateShelfSource(source){
  let warn = null;
  try{ warn = assessImageQuality(source); }catch(e){}
  if(warn){ shelfPendingImg = source; shelfQualityWarn = warn; shelfState='quality'; render(); return; }
  processShelfSource(source);
}
function cancelShelfReading(){ shelfRequestId++; endAiWait(); shelfState='camera'; render(); }
// Precio de la última salida registrada de este producto (cuando no tiene precio
// de venta cargado, cada escaneo lo pedía de nuevo).
function lastSalePriceFor(ingId){
  for(const o of outflows){
    if(!o || !Array.isArray(o.items)) continue;
    const it = o.items.find(x=>x && x.ingId===ingId && Number(x.priceAt)>0);
    if(it) return it.priceAt;
  }
  return '';
}
// Los no reconocidos del estante pasan a "Productos" con la MISMA foto, sin otro
// escaneo: la lista de revisión se arma con lo que la IA ya leyó (nombre, cuántos
// vio, su recorte) y el usuario los da de alta desde ahí.
function shelfUnmatchedToProductBatch(){
  if(!shelfUnmatched.length) return;
  const src = shelfLastSource;
  const items = shelfUnmatched.map(p=>{
    const count = Number(p.count);
    return { name: p.name||'', unit:'unidad', cost:'', qty: (Number.isFinite(count) && count>0) ? count : 1, sku:'', categoryId:null,
      confidence: p.confidence||'baja', photo: (src && p.box) ? cropToBase64(src, p.box, 300, 0.75) : null, selected:true, dupOfId:null };
  });
  closeShelfModal();
  pbRequestId++;
  pbItems = items; pbSourceImg = src; pbState='review'; pbError=''; pbMatchedId=null; pbPendingImg=null;
  showProductBatchModal = true;
  render();
}
async function processShelfSource(source){
  const requestId = ++shelfRequestId;
  stopShelfCamera();
  shelfPendingImg = null; shelfQualityWarn = null; shelfLastSource = source;
  shelfState='loading'; shelfError=''; beginAiWait(); render();
  try{
    /* La foto más nítida que manda la app (pedido del usuario 2026-09-10: "que
       esta cámara tome fotos más nítidas, con las mismas funciones"). Antes iba
       a 2000/0.88; ahora al mismo techo que el escáner de recibos —el más alto
       que Dusty ya usa en producción, así que no es un número inventado: 2576 px
       de lado largo y 0.92 de calidad. resizeToBase64 nunca agranda, así que
       esto no infla una foto chica: solo deja de tirar píxeles cuando la cámara
       del teléfono los dio (un celular saca 3000-4000 px de lado). Importa acá
       más que en ningún otro escáner porque hay que leer etiquetas chicas y
       CONTAR piezas en una repisa entera, no un solo producto de cerca. */
    const image = resizeToBase64(source, SCAN_MAX_SIDE_FOR_READING, 0.92);
    const products = await readStockFromPhoto(image);
    endAiWait();
    if(requestId !== shelfRequestId || !showShelfModal) return;
    shelfItems = [];
    shelfUnmatched = [];
    products.forEach(p=>{
      const ing = matchStockReading(p);
      if(!ing){ shelfUnmatched.push(p); return; }
      const cur = roundQty(Number(ing.qtyOnHand)||0);
      // Modo lista escrita: la foto era una NOTA de salidas ("-1"), no un estante —
      // el delta se fuerza negativo también acá (defensa por si el servidor viejo
      // sigue desplegado) y se aplica sobre el stock actual con piso en 0.
      // El guard de null/''/0 es obligatorio: Number(null) es 0 (finito), así que
      // sin él una fila que el servidor anuló (delta fuera de rango) aparecía
      // pre-marcada con "detectado = stock actual" en vez de quedar inerte.
      const deltaOk = p.reading==='ajuste' && p.delta!==null && p.delta!==undefined && p.delta!=='' && Number.isFinite(Number(p.delta)) && Number(p.delta)!==0;
      let detected = deltaOk
        ? roundQty(Math.max(0, cur - Math.abs(Number(p.delta))))
        : (p.reading==='ajuste' ? null : detectedQtyFromReading(p, ing.capacityFull));
      // Este escáner es EXCLUSIVAMENTE para descontar: una lectura de estante que
      // daría MÁS stock del registrado no se aplica — la fila se muestra excluida
      // con su explicación, y si el stock real es mayor, eso se corrige editando
      // el producto a mano (una decisión consciente, no un efecto del escáner).
      let blockedNote = null;
      if(detected!==null && detected > cur){
        blockedNote = t('shelf_increase_blocked').replace('{n}', detected).replace('{c}', cur);
        detected = null;
      }
      // fill_percent sin capacidad declarada: la fila queda esperando ese dato —
      // se pide inline y el % se convierte solo, sin obligar a abrir el producto.
      const needsCapacity = detected===null && !blockedNote && fillPct(p.fill_percent)!==null && !(Number(ing.capacityFull)>0);
      shelfItems.push({
        ingId: ing.id,
        reading: p.reading, count: p.count, fill_percent: fillPct(p.fill_percent),
        sticker_color: p.sticker_color, confidence: p.confidence, visible_note: blockedNote || p.visible_note,
        detected, finalQty: detected!==null ? detected : '',
        needsCapacity, capacityDraft: '',
        // Precio de venta de ESTA salida, editable en la revisión (pedido del
        // usuario 2026-09-06: "a veces no vendemos al precio que registramos").
        // Arranca en el salePrice del producto; vacío = el producto no tiene
        // precio y sin escribir uno acá la venta no suma Ingresos al Cierre.
        salePriceDraft: Number(ing.salePrice)>0 ? ing.salePrice : lastSalePriceFor(ing.id),
        // Sin motivo hasta que el usuario diga qué pasó — ver la nota en shelfReason.
        reason: null,
        // Recorte de lo que la IA contó, para verificar de un vistazo.
        photo: p.box ? cropToBase64(source, p.box, 300, 0.75) : null,
        include: detected!==null
      });
    });
    shelfState = (shelfItems.length>0 || shelfUnmatched.length>0) ? 'review' : 'empty';
    render();
  }catch(err){
    endAiWait();
    if(requestId !== shelfRequestId) return;
    if(err && err.trialQuota){ closeShelfModal(); openUpgradeModal(t('trial_scans_over_note')); return; }
    if(!showShelfModal) return;
    shelfState='error'; shelfError = err.message || t('product_scan_error');
    render();
  }
}

function shelfConfidencePill(conf){
  const map = {
    alta:  {bg:'var(--basil-soft)',   fg:'var(--basil-ink)'},
    media: {bg:'var(--sky-soft)',     fg:'var(--sky-ink)'},
    baja:  {bg:'var(--saffron-soft)', fg:'var(--saffron-ink)'}
  };
  const c = map[conf] || map.baja;
  return `<span style="font-size:calc(10px * var(--fs, 1));font-weight:700;padding:2px 8px;border-radius:20px;background:${c.bg};color:${c.fg};white-space:nowrap;">${t('shelf_conf_'+(map[conf]?conf:'baja'))}</span>`;
}

function shelfDeltaPill(current, finalQty, unit){
  const delta = roundQty((Number(finalQty)||0) - (Number(current)||0));
  if(delta===0) return `<span style="font-size:calc(11px * var(--fs, 1));color:var(--ink-soft);">=</span>`;
  const up = delta>0;
  return `<span style="font-size:calc(11px * var(--fs, 1));font-weight:700;color:${up?'var(--basil-ink)':'var(--ink-soft)'};white-space:nowrap;">${up?'+':'−'}${Math.abs(delta)} ${escapeHtml(unitLabel(unit))}</span>`;
}

function shelfScanModal(){
  const includedCount = shelfItems.filter(it=>it.include && it.finalQty!=='' && Number.isFinite(Number(it.finalQty))).length;
  // Renglones listos para aplicar pero todavía sin decir qué pasó con ellos:
  // mientras haya uno, el botón no se habilita. Suponer "venta" es justamente lo
  // que inflaba los ingresos, y suponer cualquier otra cosa sería igual de falso.
  const sinMotivo = shelfItems.filter(it=>it.include && it.finalQty!=='' && Number.isFinite(Number(it.finalQty)) && !it.reason).length;
  return `
  <div class="overlay" id="shelf-overlay">
    <div class="modal wide">
      <h3 class="sky">${t('shelf_title')}</h3>

      ${shelfState==='camera' ? `
        <div class="sub">${t('shelf_sub')}</div>
        ${/* Misma caja que Recibos y Productos (intro única): la cámara directo; galería por el link. */''}
        <div class="drop-zone" id="shelf-drop-zone">
          <div class="dz-icon">${lineIcon('camera',26)}</div>
          <div style="font-weight:600;font-size:calc(13.5px * var(--fs, 1));">${t('scan_tap_photo')}</div>
        </div>
        <button type="button" id="btn-shelf-gallery" class="dz-gallery-link">${t('scan_upload_gallery_btn')}</button>
        <div class="helper-note" style="margin:0;">💡 ${t('shelf_tip')}</div>
        ${scanQuotaLineHtml()}
      ` : ''}
      <input type="file" id="shelf-photo-file" accept="image/*" capture="environment" style="display:none;">
      <input type="file" id="shelf-photo-file-gallery" accept="image/*" style="display:none;">

      ${shelfState==='quality' && shelfPendingImg ? qualityGateHtml(shelfPendingImg, shelfQualityWarn, 'btn-shelf-quality-use', 'btn-shelf-quality-retake') : ''}
      ${shelfState==='loading' ? `<div class="scan-status"><div class="spinner"></div> ${t('shelf_loading')}</div>${aiWaitSlowHtml()}<button type="button" class="scan-cancel-reading" id="btn-shelf-cancel-reading">${t('scan_cancel_reading')}</button>` : ''}
      ${shelfPhotoView!==null && shelfItems[shelfPhotoView] && shelfItems[shelfPhotoView].photo ? photoViewerHtml(`data:${shelfItems[shelfPhotoView].photo.mediaType};base64,${shelfItems[shelfPhotoView].photo.base64}`, 'shelf-photo-viewer') : ''}
      ${shelfState==='error' ? `<div class="scan-error">⚠ ${escapeHtml(shelfError)}</div>` : ''}
      ${shelfState==='empty' ? `<div class="scan-error">⚠ ${t('shelf_none')}</div>` : ''}

      ${shelfState==='review' ? `
        ${shelfItems.length>0 ? `<div style="font-size:calc(12.5px * var(--fs, 1));color:var(--ink-soft);margin-bottom:10px;">${t('shelf_review_hint')}</div>` : ''}
        ${/* LA PREGUNTA. Va acá, después de leer la foto y antes de aplicar nada:
             es el paso intermedio que convierte "restar inventario" en un
             movimiento con significado contable. Tres opciones, ninguna marcada
             de entrada, cada una con una línea que dice qué le hace a la plata —
             para que la respuesta no dependa de entender contabilidad. */''}
        ${shelfItems.length>0 ? `<div class="exit-reason-ask">
          <div class="era-title">${t('shelf_reason_ask')}</div>
          <div class="era-sub">${t('shelf_reason_ask_sub')}</div>
          <div class="era-options">
            ${[['sale','shelf_reason_sale','shelf_reason_sale_hint'],
               ['internal','shelf_reason_internal','shelf_reason_internal_hint'],
               ['loss','shelf_reason_loss','shelf_reason_loss_hint']].map(([val,label,hint])=>`
              <button type="button" class="era-option ${shelfReason===val?'on':''}" data-shelf-reason="${val}">
                <span class="era-option-label">${t(label)}</span>
                <span class="era-option-hint">${t(hint)}</span>
              </button>`).join('')}
          </div>
        </div>` : ''}
        ${shelfItems.map((it,idx)=>{
          const ing = inventory.find(i=>i.id===it.ingId);
          if(!ing) return '';
          const metaBits = [];
          metaBits.push(`${t('shelf_current')}: <strong style="color:var(--ink);">${escapeHtml(ing.qtyOnHand||0)} ${escapeHtml(unitLabel(ing.unit))}</strong>`);
          if(it.detected!==null) metaBits.push(`${t('shelf_detected')}: <strong style="color:var(--ink);">${escapeHtml(it.detected)} ${escapeHtml(unitLabel(ing.unit))}</strong>`);
          if(fillPct(it.fill_percent)!==null && it.reading!=='unidades') metaBits.push(t('shelf_fill_note').replace('{p}', fillPct(it.fill_percent)));
          if(it.sticker_color) metaBits.push(t('shelf_sticker_note').replace('{c}', escapeHtml(it.sticker_color)));
          return `
          <div class="matched-item" style="${it.include?'':'opacity:.55;'}">
            <div class="mi-top">
              <input data-shelf-include="${idx}" type="checkbox" ${it.include?'checked':''} style="width:18px;height:18px;flex-shrink:0;accent-color:var(--navy);">
              ${it.photo ? `<img class="shelf-thumb" data-shelf-view="${idx}" src="data:${it.photo.mediaType};base64,${it.photo.base64}" alt="">` : `<div class="stock-icon-ring" style="width:34px;height:34px;flex-shrink:0;">${stockIconSvg(ing)}</div>`}
              <strong style="flex:1;min-width:0;overflow-wrap:anywhere;">${escapeHtml(ing.name)}</strong>
              ${shelfConfidencePill(it.confidence)}
            </div>
            <div style="font-size:calc(12px * var(--fs, 1));color:var(--ink-soft);display:flex;flex-wrap:wrap;gap:4px 12px;margin-bottom:8px;">
              ${metaBits.map(b=>`<span>${b}</span>`).join('')}
            </div>
            ${it.visible_note ? `<div style="font-size:calc(11px * var(--fs, 1));font-weight:600;color:var(--saffron-ink);background:var(--saffron-soft);padding:5px 8px;border-radius:6px;margin-bottom:8px;">ℹ ${escapeHtml(it.visible_note)}</div>` : ''}
            ${it.needsCapacity ? `
            <div style="background:var(--sky-soft);border-radius:8px;padding:8px 10px;margin-bottom:8px;">
              <div style="font-size:calc(11.5px * var(--fs, 1));font-weight:700;color:var(--sky-ink);margin-bottom:6px;">${t('shelf_capacity_ask')}</div>
              <div style="display:flex;align-items:center;gap:8px;">
                <input data-shelf-capacity="${idx}" type="number" inputmode="decimal" step="0.01" min="0" value="${escapeHtml(it.capacityDraft)}" placeholder="${t('ph_capacity_example')}" style="flex:1;">
                <span style="font-size:calc(12px * var(--fs, 1));color:var(--sky-ink);font-weight:700;">${escapeHtml(unitLabel(ing.unit))}</span>
              </div>
              <div style="font-size:calc(10.5px * var(--fs, 1));color:var(--sky-ink);margin-top:5px;">${t('shelf_capacity_helper').replace('{u}', escapeHtml(unitLabel(ing.unit)))}</div>
            </div>` : ''}
            <div class="mi-fields" style="align-items:center;">
              <label style="font-size:calc(11px * var(--fs, 1));font-weight:700;color:var(--ink-soft);white-space:nowrap;">${t('shelf_final_label')}</label>
              <input data-shelf-final="${idx}" type="number" inputmode="decimal" step="0.01" min="0" value="${escapeHtml(it.finalQty)}" style="flex:1;min-width:70px;">
              <span style="font-size:calc(12px * var(--fs, 1));color:var(--ink-soft);">${escapeHtml(unitLabel(ing.unit))}</span>
              <span data-shelf-delta="${idx}">${shelfDeltaPill(ing.qtyOnHand||0, it.finalQty, ing.unit)}</span>
            </div>
            ${/* El motivo DE ESTE RENGLÓN. La cabecera pone el de todos de un
                 toque; acá se corrige el que sea distinto, sin volver arriba. */''}
            ${it.include ? `
            <div class="row-reason">
              <span class="rr-label">${t('shelf_row_reason')}</span>
              <button type="button" class="rr-chip ${it.reason==='sale'?'on':''}" data-row-reason="${idx}" data-reason-val="sale">${t('shelf_reason_sale')}</button>
              <button type="button" class="rr-chip ${it.reason==='internal'?'on':''}" data-row-reason="${idx}" data-reason-val="internal">${t('shelf_reason_internal')}</button>
              <button type="button" class="rr-chip ${it.reason==='loss'?'on':''}" data-row-reason="${idx}" data-reason-val="loss">${t('shelf_reason_loss')}</button>
            </div>` : ''}
            ${/* Precio de venta de ESTA salida: solo si el renglón es una venta.
                 Ni la merma ni el consumo interno generan ingresos, así que
                 pedirles un precio sería invitar a inventarlo. */''}
            ${it.include && it.reason==='sale' ? `
            <div class="mi-fields" style="align-items:center;margin-top:6px;">
              <label style="font-size:calc(11px * var(--fs, 1));font-weight:700;color:var(--ink-soft);white-space:nowrap;">${t('shelf_price_label')}</label>
              ${/* Late cuando está vacío, como cualquier casilla que la contabilidad
                   necesita. Es el último punto donde se puede evitar registrar una
                   venta con $0 de ingreso y el costo completo. */''}
              <input data-shelf-price="${idx}"${it.salePriceDraft==='' ? ' class="field-needs-value"' : ''} type="number" inputmode="decimal" step="0.01" min="0" value="${escapeHtml(it.salePriceDraft)}" placeholder="0.00" style="flex:1;min-width:70px;">
              <span style="font-size:calc(12px * var(--fs, 1));color:var(--ink-soft);">$/${escapeHtml(unitLabel(ing.unit))}</span>
            </div>
            ${it.salePriceDraft==='' ? `<div style="font-size:calc(11px * var(--fs, 1));font-weight:600;color:var(--saffron-ink);background:var(--saffron-soft);padding:5px 8px;border-radius:6px;margin-top:6px;">ℹ ${t('shelf_price_empty_note')}</div>` : ''}` : ''}
            ${it.include && it.reason==='internal' ? `<div class="row-reason-note internal">🍕 ${t('shelf_internal_note')}</div>` : ''}
            ${it.include && it.reason==='loss' ? `<div class="row-reason-note loss">🗑️ ${t('shelf_loss_note')}</div>` : ''}
          </div>`;
        }).join('')}
        ${shelfUnmatched.length>0 ? `
        <div class="helper-note" style="margin-top:12px;background:var(--inset);border-radius:8px;padding:10px 12px;">
          <strong style="display:block;font-size:calc(12px * var(--fs, 1));color:var(--ink);margin-bottom:4px;">${t('shelf_unmatched_title')}</strong>
          ${shelfUnmatched.map(p=>escapeHtml(p.name)).join(' · ')}
          <div style="margin-top:5px;font-size:calc(11px * var(--fs, 1));">${t('shelf_unmatched_hint')}</div>
          ${/* Salida real (antes era un callejón: cerrar, abrir Productos y sacar la misma foto). */''}
          <button type="button" class="btn btn-primary btn-sm" id="btn-shelf-unmatched-to-pb" style="margin-top:8px;">${t('shelf_unmatched_to_pb')}</button>
        </div>` : ''}
      ` : ''}

      ${shelfState==='review' && sinMotivo>0 ? `<div class="reason-missing-note">${t('shelf_reason_missing').replace('{n}', sinMotivo)}</div>` : ''}

      <div class="modal-actions">
        <button class="btn btn-ghost" id="btn-cancel-shelf">${t(shelfState==='review'?'btn_close':'btn_cancel')}</button>
        ${['review','error','empty'].includes(shelfState) ? `<button class="btn btn-ghost" id="btn-shelf-again">${t('ids_scan_again')}</button>` : ''}
        ${shelfState==='review' && shelfItems.length>0 ? `<button class="btn btn-primary" id="btn-apply-shelf" ${(includedCount===0||sinMotivo>0)?'disabled':''}>${t('shelf_apply_btn').replace('{n}', includedCount)}</button>` : ''}
      </div>
    </div>
  </div>`;
}

function applyShelfAdjust(){
  const items = [];
  let touched = 0;
  let capSaved = false;
  shelfItems.forEach(it=>{
    const ing = inventory.find(i=>i.id===it.ingId);
    if(!ing) return;
    // La capacidad declarada inline se guarda aunque la fila no se incluya en el
    // ajuste — es un dato del producto, no de esta foto, y costó pedirlo.
    const cap = parseFloat(it.capacityDraft);
    if(Number.isFinite(cap) && cap>0){ ing.capacityFull = roundQty(cap); capSaved = true; }
    if(!it.include) return;
    const finalQty = parseFloat(it.finalQty);
    if(!Number.isFinite(finalQty) || finalQty<0) return;
    const current = roundQty(Number(ing.qtyOnHand)||0);
    // Candado final de "solo descontar": aunque alguien escriba a mano un número
    // mayor al stock actual, este escáner nunca sube inventario — como mucho queda
    // igual (y sin movimiento que registrar). Subir stock es una edición consciente
    // del producto, no un efecto del escáner de salidas.
    const newQty = Math.min(roundQty(finalQty), current);
    touched++;
    if(newQty===current) return; // capacidad guardada arriba, pero sin movimiento que registrar
    ing.qtyOnHand = newQty;
    if(currentUser){ ing.lastEditedBy = currentUserLabel(); ing.lastEditedAt = new Date().toISOString(); }
    // qty siempre positiva: cuánto salió. costAt/priceAt: snapshot de costo y
    // precio de venta de HOY — el P&L histórico deja de moverse cuando cambian
    // los precios o se borra el producto (revisión de contador 2026-09-04).
    // priceAt sale del campo editable de la revisión (el precio REAL de esta
    // venta); si quedó vacío o inválido, cae al salePrice del producto.
    const priceDraft = parseFloat(it.salePriceDraft);
    // reason POR RENGLÓN: es lo que decide si esta salida es ingreso, traspaso a
    // producción o pérdida. El del outflow entero queda solo para las salidas
    // viejas, que no lo tenían por línea (ver outflowPL en app-03).
    const rowReason = (it.reason==='sale' || it.reason==='internal' || it.reason==='loss') ? it.reason : 'sale';
    items.push({ingId: ing.id, ingName: ing.name, qty: roundQty(current - newQty), unit: ing.unit,
      reason: rowReason,
      costAt: Number(ing.costPerUnit)||0,
      // Solo una venta lleva precio: pedirle uno a la merma o al consumo interno
      // sería invitar a inventar un ingreso que no existió.
      priceAt: rowReason!=='sale' ? 0
        : ((Number.isFinite(priceDraft) && priceDraft>=0) ? roundQty(priceDraft) : (Number(ing.salePrice)||0))});
  });
  if(items.length>0){
    recordOutflow({
      id: uid('o'), type:'adjust', recipeId:null, recipeName:'', count:null,
      // Motivo del conjunto: se guarda solo si TODOS los renglones coinciden —
      // con motivos mezclados no hay uno que represente al ajuste, y el que manda
      // es el de cada línea igual.
      reason: (()=>{ const rs=new Set(items.map(i=>i.reason)); return rs.size===1 ? items[0].reason : 'mixed'; })(),
      items, date: localDateStr(), createdAt: new Date().toISOString(),
      by: currentUser ? currentUser.uid : null, byLabel: currentUser ? currentUserLabel() : ''
    });
    logActivity('stock_adjust', '', String(items.length));
  }
  // capSaved cuenta por sí solo: sin él, una capacidad tipeada en una fila
  // excluida quedaba solo en memoria y se perdía al recargar.
  if(touched>0 || items.length>0 || capSaved) saveState();
  closeShelfModal();
}

/* ---------- EVENTOS ---------- */
// Llamada desde attachEvents() (app-07) en cada render — mismos patrones: handlers
// como propiedades on* (morphdom puede conservar nodos entre renders; asignar pisa
// en vez de apilar), y campos de texto que escriben en el estado sin re-render.
function attachProductionEvents(){
  /* ---------- la pestaña Catálogo ---------- */
  const btnNewRecipeTab=document.getElementById('btn-new-recipe-tab');
  if(btnNewRecipeTab) btnNewRecipeTab.onclick=()=>openRecipeModal(null);
  const btnNewRecipeEmpty=document.getElementById('btn-new-recipe-empty');
  if(btnNewRecipeEmpty) btnNewRecipeEmpty.onclick=()=>openRecipeModal(null);
  const prodSearchInp=document.getElementById('prod-search');
  if(prodSearchInp) prodSearchInp.oninput=()=>{
    prodSearch = prodSearchInp.value;
    scheduleSearchTriggeredRender(()=>{
      const fresh=document.getElementById('prod-search');
      if(fresh){ fresh.focus(); fresh.setSelectionRange(fresh.value.length, fresh.value.length); }
    });
  };
  const prodSortSel=document.getElementById('prod-sort');
  if(prodSortSel) prodSortSel.onchange=()=>{
    prodSort=prodSortSel.value;
    try{ localStorage.setItem('patron_prod_sort', prodSort); }catch(e){}
    render();
  };
  document.querySelectorAll('[data-open-finished]').forEach(el=>{
    el.onclick=()=>openFinishedItemModal(el.dataset.openFinished);
  });
  /* Las MISMAS capacidades que Inventario en Producción (pedido del usuario
     2026-09-10): foto, seleccionar, borrar, compartir y columnas. Se reusan sus
     mismos ayudantes — promptItemPhotoUpload sirve igual para una receta porque
     también tiene .photo; lo único propio es subirla a Storage después. */
  document.querySelectorAll('[data-photo-recipe]').forEach(el=>{
    el.onclick=(e)=>{
      e.stopPropagation();               // la tarjeta abre la ficha; la foto, no
      const r = recipeById(el.dataset.photoRecipe);
      if(!r) return;
      // Con foto: se abre grande (así se ve la pieza terminada de verdad, y ahí
      // mismo están cambiar y quitar). Sin foto: el selector directo, que es lo
      // único que se puede hacer.
      if(recipePhotoSrc(r)){ photoViewItemId = r.id; photoViewKind = 'recipe'; render(); }
      else promptItemPhotoUpload(r, true);
    };
  });
  /* La salida de la barra de seleccion (ver btn-prod-sel-exit en la vista): id
     propio, mismo trabajo que "Elegir" cuando ya estas dentro. */
  const btnProdSelExit=document.getElementById('btn-prod-sel-exit');
  if(btnProdSelExit) btnProdSelExit.onclick=()=>{ prodExitSelect(); render(); };
  const btnProdSelect=document.getElementById('btn-prod-select');
  if(btnProdSelect) btnProdSelect.onclick=()=>{
    if(prodSelectMode) prodExitSelect(); else { prodSelectMode = true; prodSelected.clear(); }
    render();
  };
  document.querySelectorAll('[data-prod-select]').forEach(el=>{
    el.onclick=()=>{
      const id = el.dataset.prodSelect;
      if(prodSelected.has(id)) prodSelected.delete(id); else prodSelected.add(id);
      render();
    };
  });
  const btnProdSelAll=document.getElementById('btn-prod-sel-all');
  if(btnProdSelAll) btnProdSelAll.onclick=()=>{
    // Marca lo que el buscador está mostrando, no el catálogo entero: "todos"
    // significa "todos los que veo", que es lo que el usuario tiene delante.
    const visibles = recipes.filter(r=>invMatches(r.name, prodSearch));
    const faltan = visibles.some(r=>!prodSelected.has(r.id));
    visibles.forEach(r=>{ if(faltan) prodSelected.add(r.id); else prodSelected.delete(r.id); });
    render();
  };
  const btnProdSelShare=document.getElementById('btn-prod-sel-share');
  if(btnProdSelShare) btnProdSelShare.onclick=shareSelectedRecipes;
  const btnProdSelDelete=document.getElementById('btn-prod-sel-delete');
  if(btnProdSelDelete) btnProdSelDelete.onclick=deleteSelectedRecipes;
  const fiOverlay=document.getElementById('finished-item-overlay');
  if(fiOverlay){
    fiOverlay.onmousedown=(e)=>{ if(e.target===fiOverlay) closeFinishedItemModal(); };
    const cerrar=document.getElementById('btn-close-finished-item');
    if(cerrar) cerrar.onclick=closeFinishedItemModal;
    const editar=document.getElementById('btn-edit-recipe-from-item');
    if(editar) editar.onclick=()=>{ const r=recipeById(showFinishedItemModal); closeFinishedItemModal(); if(r) openRecipeModal(r); };
    const menos=document.getElementById('btn-fi-minus');
    if(menos) menos.onclick=()=>{ finishedProduceCount=Math.max(1, (Number(finishedProduceCount)||1)-1); render(); };
    const mas=document.getElementById('btn-fi-plus');
    if(mas) mas.onclick=()=>{ finishedProduceCount=(Number(finishedProduceCount)||1)+1; render(); };
    const campo=document.getElementById('fi-produce-count');
    // onchange y no oninput: re-renderizar por tecla haría temblar la tabla entera
    // mientras se escribe, el mismo problema que ya tuvo la ficha de producto.
    if(campo) campo.onchange=()=>{ finishedProduceCount=Math.max(1, Math.round(parseFloat(campo.value)||1)); render(); };
    /* EDITAR LA COMPOSICIÓN SIN SALIR DE LA FICHA (pedido del usuario 2026-09-10:
       "poder editarlo"). Cada cambio guarda de una: la composición es la
       definición de la pieza y tiene que quedar grabada — el usuario que siempre
       vende lo mismo no puede tener que rehacerla. */
    const editarBom=document.getElementById('btn-fi-edit-bom');
    if(editarBom) editarBom.onclick=()=>{ finishedEditMode = !finishedEditMode; finishedProduceCount = 1; render(); };
    document.querySelectorAll('[data-bom-qty]').forEach(inp=>{
      // onchange y no oninput: re-renderizar por tecla haría saltar la tabla entera.
      inp.onchange=()=>{
        const rec = recipeById(showFinishedItemModal);
        const c = rec && rec.components[+inp.dataset.bomQty];
        if(!c) return;
        const v = roundQty(Math.max(0, parseFloat(inp.value)||0));
        // Cantidad en cero = el insumo ya no forma parte de la pieza; se saca en
        // vez de quedar como un renglón que suma $0 y confunde la composición.
        if(v > 0) c.qty = v; else rec.components.splice(+inp.dataset.bomQty, 1);
        saveState(); render();
      };
    });
    document.querySelectorAll('[data-bom-del]').forEach(b=>{
      b.onclick=()=>{
        const rec = recipeById(showFinishedItemModal);
        if(!rec) return;
        rec.components.splice(+b.dataset.bomDel, 1);
        saveState(); render();
      };
    });
    const agregarBom=document.getElementById('fi-bom-add');
    if(agregarBom) agregarBom.onchange=()=>{
      const rec = recipeById(showFinishedItemModal);
      const id = agregarBom.value;
      if(!rec || !id) return;
      // Si ya está, no se duplica el renglón: se deja donde está para que el
      // usuario le corrija la cantidad en vez de tener el mismo insumo dos veces.
      if(!rec.components.some(c=>c.ingId===id)) rec.components.push({ingId:id, qty:1});
      saveState(); render();
    };
    const producir=document.getElementById('btn-fi-produce');
    if(producir) producir.onclick=()=>{
      const rid = showFinishedItemModal;
      produceRecipeId = rid;
      produceCount = Math.max(1, Math.round(Number(finishedProduceCount)||1));
      applyProduction();          // descuenta insumos y suma producto terminado
      showFinishedItemModal = rid; // la ficha se queda abierta, ya con el stock nuevo
      finishedProduceCount = 1;
      render();
    };
  }
  // Una herramienta por pantalla (Inventario y Producción): se enganchan TODAS,
  // no la primera que aparezca.
  document.querySelectorAll('[data-shelf-scan]').forEach(el=>{ el.onclick=openShelfModal; });
  // Badge "−" y su burbuja de instrucciones: el badge la abre/cierra; tocar la
  // burbuja o cualquier parte de afuera (backdrop transparente) la cierra.
  document.querySelectorAll('[data-shelf-info]').forEach(el=>{
    el.onclick=(e)=>{
      e.stopPropagation();
      const z = el.dataset.shelfInfo;
      showShelfInfoBubble = (showShelfInfoBubble===z) ? null : z;
      render();
    };
  });
  document.querySelectorAll('[data-shelf-info-close]').forEach(el=>{
    el.onclick=()=>{ showShelfInfoBubble=null; render(); };
  });
  const btnProductionHub=document.getElementById('btn-production-hub');
  if(btnProductionHub) btnProductionHub.onclick=()=>{ showProductionHub=true; render(); };
  const hubOverlay=document.getElementById('production-hub-overlay');
  if(hubOverlay){
    hubOverlay.onmousedown=(e)=>{ if(e.target===hubOverlay){ showProductionHub=false; render(); } };
    document.getElementById('btn-close-production-hub').onclick=()=>{ showProductionHub=false; render(); };
  }
  // Estos tres viven DENTRO del hub — al abrirse su destino, el hub se cierra para
  // no apilar dos modales.
  const btnNewRecipe=document.getElementById('btn-new-recipe');
  if(btnNewRecipe) btnNewRecipe.onclick=()=>{ showProductionHub=false; openRecipeModal(null); };
  const btnOpenOutflows=document.getElementById('btn-open-outflows');
  if(btnOpenOutflows) btnOpenOutflows.onclick=()=>{ showProductionHub=false; showOutflowsModal=true; render(); };
  document.querySelectorAll('[data-edit-recipe]').forEach(b=>{
    b.onclick=()=>{ showProductionHub=false; openRecipeModal(recipeById(b.dataset.editRecipe)); };
  });
  document.querySelectorAll('[data-produce-recipe]').forEach(b=>{
    b.onclick=()=>{ showProductionHub=false; openProduceModal(b.dataset.produceRecipe); };
  });

  /* Modal receta */
  const recipeOverlay=document.getElementById('recipe-overlay');
  if(recipeOverlay){
    recipeOverlay.onmousedown=(e)=>{ if(e.target===recipeOverlay) closeRecipeModal(); };
    document.getElementById('btn-cancel-recipe').onclick=closeRecipeModal;
    document.getElementById('btn-save-recipe').onclick=saveRecipeFromModal;
    const btnDeleteRecipe=document.getElementById('btn-delete-recipe');
    if(btnDeleteRecipe) btnDeleteRecipe.onclick=deleteRecipeFromModal;
    const nameInp=document.getElementById('recipe-name');
    if(nameInp) nameInp.oninput=()=>{ if(draftRecipe) draftRecipe.name=nameInp.value; };
    const photoFile=document.getElementById('recipe-photo-file');
    const btnPhoto=document.getElementById('btn-recipe-photo');
    if(btnPhoto && photoFile) btnPhoto.onclick=()=>photoFile.click();
    if(photoFile) photoFile.onchange=async (e)=>{
      const file=e.target.files[0];
      photoFile.value='';
      if(!file || !/^image\//.test(file.type)) return;
      try{
        const img = await loadImageFromFile(file);
        if(draftRecipe){ draftRecipe.photo = resizeToBase64(img, 300, 0.75); render(); }
      }catch(err){ showToast(err.message || t('err_img_process'), 'error'); }
    };
    const scanFile=document.getElementById('recipe-scan-file');
    const scanGallery=document.getElementById('recipe-scan-file-gallery');
    const btnScan=document.getElementById('btn-recipe-scan');
    const btnScanGallery=document.getElementById('btn-recipe-scan-gallery');
    // La cuenta se pide UNA vez, antes de abrir cualquiera de las dos entradas:
    // la lectura la hace la IA igual, venga de la cámara o de la galería.
    const pedirEntrada=(entrada)=>{
      if(!currentUser){
        if(everHadRealAccount()){ ensurePatronFirebaseReady().catch(()=>{}); openAuthModal(t('scan_requires_account')); return; }
        ensureTrialAccount().catch(()=>{});
      }
      entrada.click();
    };
    if(btnScan && scanFile) btnScan.onclick=()=>pedirEntrada(scanFile);
    if(btnScanGallery && scanGallery) btnScanGallery.onclick=()=>pedirEntrada(scanGallery);
    const onRecipeScanFile=(e)=>{
      const file=e.target.files[0];
      e.target.value='';
      if(!file || !/^image\//.test(file.type)) return;
      runRecipeScan(file);
    };
    if(scanFile) scanFile.onchange=onRecipeScanFile;
    if(scanGallery) scanGallery.onchange=onRecipeScanFile;
    const btnAddComp=document.getElementById('btn-add-component');
    if(btnAddComp) btnAddComp.onclick=()=>{ if(draftRecipe){ draftRecipe.components.push({ingId:'', qty:''}); render(); } };
    document.querySelectorAll('[data-rcomp-ing]').forEach(sel=>{
      sel.onchange=()=>{ const c=draftRecipe && draftRecipe.components[+sel.dataset.rcompIng]; if(c){ c.ingId=sel.value; render(); } };
    });
    document.querySelectorAll('[data-rcomp-qty]').forEach(inp=>{
      inp.oninput=()=>{ const c=draftRecipe && draftRecipe.components[+inp.dataset.rcompQty]; if(c){ c.qty=inp.value; refreshRecipeCostDisplay(); } };
    });
    document.querySelectorAll('[data-rcomp-remove]').forEach(b=>{
      b.onclick=()=>{ if(draftRecipe){ draftRecipe.components.splice(+b.dataset.rcompRemove,1); render(); } };
    });
  }

  /* Modal producción */
  const produceOverlay=document.getElementById('produce-overlay');
  if(produceOverlay){
    produceOverlay.onmousedown=(e)=>{ if(e.target===produceOverlay) closeProduceModal(); };
    document.getElementById('btn-cancel-produce').onclick=closeProduceModal;
    const btnConfirm=document.getElementById('btn-confirm-produce');
    if(btnConfirm) btnConfirm.onclick=applyProduction;
    const minus=document.getElementById('btn-produce-minus');
    if(minus) minus.onclick=()=>{ if(produceCount>1){ produceCount--; render(); } };
    const plus=document.getElementById('btn-produce-plus');
    if(plus) plus.onclick=()=>{ produceCount++; render(); };
    const countInp=document.getElementById('produce-count-input');
    // render() en cada cambio para refrescar el plan de descuento en vivo —
    // morphdom no pisa el input con foco, así que el tipeo no se pierde.
    if(countInp) countInp.oninput=()=>{ const v=parseInt(countInp.value,10); produceCount = (Number.isFinite(v) && v>0) ? v : 1; render(); };
    const priceInp=document.getElementById('produce-price-input');
    // render() por tecla como el contador: refresca el "Ingreso estimado" en vivo
    // (morphdom no pisa el input con foco, el tipeo no se pierde).
    if(priceInp) priceInp.oninput=()=>{ produceSalePrice = priceInp.value; render(); };
  }

  /* Modal salidas */
  const outflowsOverlay=document.getElementById('outflows-overlay');
  if(outflowsOverlay){
    outflowsOverlay.onmousedown=(e)=>{ if(e.target===outflowsOverlay){ showOutflowsModal=false; render(); } };
    document.getElementById('btn-close-outflows').onclick=()=>{ showOutflowsModal=false; render(); };
  }

  /* Modal escáner de estante */
  const shelfOverlay=document.getElementById('shelf-overlay');
  if(shelfOverlay){
    shelfOverlay.onmousedown=(e)=>{ if(e.target===shelfOverlay) closeShelfModal(); };
    document.getElementById('btn-cancel-shelf').onclick=closeShelfModal;
    const btnAgain=document.getElementById('btn-shelf-again');
    if(btnAgain) btnAgain.onclick=restartShelfCamera;
    const shelfFile=document.getElementById('shelf-photo-file');
    const shelfGallery=document.getElementById('shelf-photo-file-gallery');
    // Intro única: la caja abre la cámara directo; el link, la galería.
    const shelfDz=document.getElementById('shelf-drop-zone');
    if(shelfDz && shelfFile) shelfDz.onclick=()=>shelfFile.click();
    const btnShelfGallery=document.getElementById('btn-shelf-gallery');
    if(btnShelfGallery && shelfGallery) btnShelfGallery.onclick=()=>shelfGallery.click();
    const onShelfFile=async (e)=>{
      const file=e.target.files[0];
      e.target.value='';
      if(!file || !/^image\//.test(file.type)) return;
      try{
        const img = await loadImageFromFile(file);
        gateShelfSource(img);
      }catch(err){
        stopShelfCamera();
        shelfState='error'; shelfError=err.message||t('product_scan_error'); render();
      }
    };
    if(shelfFile) shelfFile.onchange=onShelfFile;
    if(shelfGallery) shelfGallery.onchange=onShelfFile;
    // Aviso de calidad, cancelar lectura, recortes y no reconocidos → Productos.
    const btnShelfQualityUse=document.getElementById('btn-shelf-quality-use');
    if(btnShelfQualityUse) btnShelfQualityUse.onclick=()=>{ if(shelfPendingImg) processShelfSource(shelfPendingImg); };
    const btnShelfQualityRetake=document.getElementById('btn-shelf-quality-retake');
    if(btnShelfQualityRetake) btnShelfQualityRetake.onclick=()=>{ shelfPendingImg=null; restartShelfCamera(); };
    const btnShelfCancelReading=document.getElementById('btn-shelf-cancel-reading');
    if(btnShelfCancelReading) btnShelfCancelReading.onclick=cancelShelfReading;
    document.querySelectorAll('[data-shelf-view]').forEach(im=>{ im.onclick=(e)=>{ e.stopPropagation(); shelfPhotoView=+im.dataset.shelfView; render(); }; });
    const shelfViewer=document.getElementById('shelf-photo-viewer');
    if(shelfViewer) shelfViewer.onclick=()=>{ shelfPhotoView=null; render(); };
    const btnShelfToPb=document.getElementById('btn-shelf-unmatched-to-pb');
    if(btnShelfToPb) btnShelfToPb.onclick=shelfUnmatchedToProductBatch;
    document.querySelectorAll('[data-shelf-include]').forEach(cb=>{
      cb.onchange=()=>{ const it=shelfItems[+cb.dataset.shelfInclude]; if(it){ it.include=cb.checked; render(); } };
    });
    document.querySelectorAll('[data-shelf-final]').forEach(inp=>{
      // Sin render() por tecla: se actualiza el estado + el pill de delta directo en
      // el DOM (mismo criterio que handleProfitFieldInput) — el contador del botón
      // de aplicar se refresca recién al confirmar el campo (onchange).
      inp.oninput=()=>{
        const idx=+inp.dataset.shelfFinal;
        const it=shelfItems[idx];
        if(!it) return;
        it.finalQty=inp.value;
        const ing=inventory.find(i=>i.id===it.ingId);
        const pill=document.querySelector(`[data-shelf-delta="${idx}"]`);
        if(ing && pill) pill.innerHTML = shelfDeltaPill(ing.qtyOnHand||0, inp.value, ing.unit);
      };
      inp.onchange=()=>render();
    });
    document.querySelectorAll('[data-shelf-price]').forEach(inp=>{
      // Sin render() por tecla (mismo criterio que data-shelf-final); al confirmar
      // el campo se re-renderiza para que el aviso de "sin precio" aparezca o se vaya.
      inp.oninput=()=>{ const it=shelfItems[+inp.dataset.shelfPrice]; if(it) it.salePriceDraft=inp.value; };
      inp.onchange=()=>render();
    });
    document.querySelectorAll('[data-shelf-capacity]').forEach(inp=>{
      inp.oninput=()=>{
        const idx=+inp.dataset.shelfCapacity;
        const it=shelfItems[idx];
        if(!it) return;
        it.capacityDraft=inp.value;
        // Con la capacidad puesta, el % pendiente se convierte en cantidad en vivo.
        const cap=parseFloat(inp.value);
        const pct = fillPct(it.fill_percent);
        if(Number.isFinite(cap) && cap>0 && pct!==null){
          // Tope en el stock actual: este escáner solo descuenta, y sin el tope la
          // conversión cap×% podía pintar un "+N" verde que applyShelfAdjust
          // después descartaba en silencio — la UI prometía una suba que jamás
          // se aplicaba.
          const ingCur = inventory.find(i=>i.id===it.ingId);
          const curQty = roundQty(Number(ingCur && ingCur.qtyOnHand)||0);
          it.finalQty = Math.min(roundQty(cap * Math.min(pct,100) / 100), curQty);
          it.detected = it.finalQty;
          const finalInp=document.querySelector(`[data-shelf-final="${idx}"]`);
          if(finalInp) finalInp.value=it.finalQty;
          const ing=inventory.find(i=>i.id===it.ingId);
          const pill=document.querySelector(`[data-shelf-delta="${idx}"]`);
          if(ing && pill) pill.innerHTML = shelfDeltaPill(ing.qtyOnHand||0, it.finalQty, ing.unit);
          if(!it.include){ it.include=true; const cb=document.querySelector(`[data-shelf-include="${idx}"]`); if(cb) cb.checked=true; }
        }
      };
      inp.onchange=()=>render();
    });
    const btnApply=document.getElementById('btn-apply-shelf');
    if(btnApply) btnApply.onclick=applyShelfAdjust;
    /* La respuesta de la cabecera se aplica a TODOS los renglones marcados — el
       caso común es una foto entera de ventas y no tiene sentido pedir ocho
       toques para eso. Cada renglón se corrige después con sus propios chips. */
    document.querySelectorAll('[data-shelf-reason]').forEach(b=>{
      b.onclick=()=>{
        shelfReason = b.dataset.shelfReason;
        shelfItems.forEach(it=>{ if(it.include) it.reason = shelfReason; });
        render();
      };
    });
    // Corrección de UN renglón (de 8 productos, 7 vendidos y 1 podrido).
    document.querySelectorAll('[data-row-reason]').forEach(b=>{
      b.onclick=()=>{
        const it = shelfItems[+b.dataset.rowReason];
        if(!it) return;
        it.reason = b.dataset.reasonVal;
        render();
      };
    });
  }
}
