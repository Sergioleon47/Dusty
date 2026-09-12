/* ================= MODO SERVICIOS (2026-09-11) =================
   Pedido del usuario: "Vamos a ejecutarlo a la perfección como un organizador de
   inventarios. Ve y ejecuta exactamente. No cambies colores, UI, UX." — sobre la
   maqueta "Dusty en modo Servicios" (9 pantallas) aprobada el mismo día.

   Un negocio que PRESTA SERVICIOS (fletes refrigerados, alquiler de equipo,
   reparaciones) no compra mercadería para revender: cobra TRABAJOS, gasta en
   combustible/peajes/seguro, y lo que tiene es EQUIPO (camiones, cámaras) que
   hay que mantener. Dusty ya tenía el 80 % (recibos, gastos por categoría,
   presupuesto, cierre de mes, equipo de trabajo); esto agrega el 20 % que faltaba
   SIN una pantalla nueva de otro estilo: mismas baldosas, mismas herramientas
   con nombre, mismas hojas a pantalla completa, mismos modales.

   DÓNDE VIVE CADA COSA (para no inventar sincronización nueva):
   - bizProfile (meta, viaja a la nube como budgetMeta — ver normalizeBizProfile
     en patron-core): {sells, services, remindOverdue, maintDays, assets[],
     catalog[]}. "Fabrica" sigue siendo productionTabPref (preferencia del
     dispositivo, como siempre).
   - TRABAJOS: son salidas (outflows) con type:'service' — así entran al P&L del
     Cierre de mes por outflowPL (ingreso = precio), se sincronizan con el merge
     por id que ya existe, y se archivan por mes si pasan el tope de 400.
     Se borran con deleted:true (borrado suave): el merge de outflows resucitaría
     un elemento quitado del arreglo.
   - GASTOS DE UN TRABAJO / DE UN ACTIVO: recibos de siempre (escaneados o a
     mano) con jobId y/o assetId. receiptAttach se lo pone al PRÓXIMO recibo
     que se cree (ver applyScan y saveManualSpend en app-06).

   PESTAÑAS: con servicios y SIN venta de productos, Inventario se vuelve
   "Equipo" (equipoView); con ambos, Equipo y activos se abre desde una baldosa
   del Dashboard como hoja completa. Ver refreshTabOrder (app-01). */

let receiptAttach = null; // {jobId, assetId} — lo consume el próximo recibo creado
let showEquipoSheet = false, showAssetSheet = null, showCollectSheet = false, showJobsSheet = false, showServicesSheet = false;
let showJobModal = false, draftJob = null, jobExpenseFormOpen = false, jobModalError = '';
let showAssetModal = false, draftAsset = null, assetModalError = '';
let showMaintModal = false, draftMaint = null, maintModalError = '';
let showMaintLogModal = false, maintLogAssetId = null, maintLogPlanId = '', maintLogError = '';
let showServiceModal = false, draftService = null, serviceModalError = '';
let equipoSearch = '', jobsSearch = '';
let showExpenseCatsSheet = false;
/* Auditoría de Servicios 2026-09-12:
   - assetSheetMonth: mes que muestra la ficha de activo (null = el actual); la
     ficha y su PDF ya no están clavados al mes calendario de hoy.
   - assetSheetShowAllMaint: el historial de mantenimientos hechos desplegado entero.
   - jobsAssetFilter / receiptsAssetFilter: "Ver todos" desde la ficha abre la lista
     de Trabajos o la de Recibos filtrada por ESE activo (antes abría la lista
     general de todo el negocio, sin ninguna marca de cuáles eran del activo).
   - jobsShownLimit: la lista de Trabajos se cortaba en 120 sin aviso; ahora es una
     ventana con "Mostrar más", igual que la de Recibos. */
let assetSheetMonth = null, assetSheetShowAllMaint = false, jobsAssetFilter = null, receiptsAssetFilter = null;
const JOBS_WINDOW_STEP = 60;
let jobsShownLimit = JOBS_WINDOW_STEP;

const SVC_ASSET_EMOJIS = ['🚚','🚛','🚐','🚗','🏍️','❄️','🏗️','🔧','🧰','🖥️','🏠','⚙️'];
const SVC_MAINT_EMOJIS = ['🛢️','🛞','📋','🔧','🧊','🔋','🧯','🧹','⚙️'];

/* ---------- perfil ---------- */
function usesServices(){ return !!(bizProfile && bizProfile.services); }
function sellsProducts(){ return !usesServices() || bizProfile.sells!==false; }
function servicesOnly(){ return usesServices() && !sellsProducts(); }
/* Categorías de gasto típicas de un negocio de servicios, agregadas UNA vez al
   prender el modo (si no existen ya con ese nombre). Las del usuario no se tocan. */
function ensureServiceCategories(){
  const want = uiLang==='en' ? ['Fuel','Tolls','Insurance','Maintenance','Helper'] : ['Combustible','Peajes','Seguro','Mantenimiento','Ayudante'];
  const have = new Set(expenseCategories.map(c=>String(c.name||'').trim().toLowerCase()));
  let added = false;
  want.forEach(n=>{ if(!have.has(n.toLowerCase())){ expenseCategories.push({id:uid('cat'), name:n}); added = true; } });
  return added;
}
function setBizFlags(sells, services){
  // Al menos una de las dos prendida: sin ninguna el tablero no tendría nada que mostrar.
  if(!sells && !services) sells = true;
  // Con Producción prendida el inventario no se puede apagar: es de donde salen
  // los insumos de las recetas (misma regla que en la introducción, 2026-09-11).
  if(!sells && typeof usesProduction==='function' && usesProduction()) sells = true;
  bizProfile.sells = !!sells;
  bizProfile.services = !!services;
  if(services && !bizProfile.catsSeeded){ ensureServiceCategories(); bizProfile.catsSeeded = true; }
  saveState();
  refreshTabOrder();
  render();
}

/* ---------- trabajos ---------- */
function svcJobs(){ return outflows.filter(o=>o && o.type==='service' && !o.deleted); }
// Solo trabajos VIVOS: un borrado suave no se abre, no se cobra ni lo encuentra
// el asistente (auditoría 2026-09-12: una cotización aceptada cuyo trabajo se
// eliminó abría un fantasma). La regla de contratos mira outflows directo.
function jobById(id){ return outflows.find(o=>o && o.type==='service' && o.id===id && !o.deleted) || null; }
/* Un solo punto para cobrar y para eliminar (modal, Por cobrar y asistente
   hacían cada uno su copia y ya divergían): sella lastEditedAt para el merge de la
   nube; al eliminar, retira las próximas del contrato y suelta la cotización que
   lo creó (vuelve a "enviada" para poder aceptarla de nuevo). */
function markJobPaid(job, when){
  if(!job || job.deleted) return false;
  job.paid = true; job.paidDate = when || localDateStr(); job.dueDate = null; job.lastEditedAt = new Date().toISOString();
  return true;
}
function deleteJob(job){
  if(!job || job.deleted) return {pruned: 0, restocked: 0};
  job.deleted = true; job.deletedAt = job.lastEditedAt = new Date().toISOString();
  const pruned = svcAfterJobDelete(job);
  // Un trabajo nacido de una cotización con productos (acceptQuote, app-17)
  // descontó esa mercadería del inventario al aceptarse: eliminarlo es decir "no
  // pasó", así que la devuelve al estante una sola vez (auditoría de datos
  // 2026-09-12; restoreJobStock es idempotente por job.stockRestored).
  const restocked = restoreJobStock(job);
  if(job.quoteId && typeof quoteById==='function'){
    const q = quoteById(job.quoteId);
    if(q && q.jobId===job.id){ q.status = 'sent'; q.jobId = null; q.acceptedAt = null; q.lastEditedAt = new Date().toISOString(); }
  }
  return {pruned, restocked};
}
/* Un trabajo nacido de una cotización con PRODUCTOS (acceptQuote, app-17) descontó
   esa mercadería del inventario al aceptarse (job.items, con costAt y priceAt
   congelados). Eliminar el trabajo es decir "no pasó": la mercadería vuelve al
   estante, una sola vez (stockRestored). Devuelve cuántos productos volvieron.
   El P&L ya no lo cuenta: outflowPL ignora los trabajos borrados. */
function restoreJobStock(job){
  if(!job || job.stockRestored || !Array.isArray(job.items) || !job.items.length) return 0;
  let n = 0;
  job.items.forEach(it=>{
    const ing = inventory.find(i=>i && i.id===it.ingId);
    const q = Math.abs(Number(it && it.qty)||0);
    if(!ing || !(q>0)) return;
    ing.qtyOnHand = roundQty((Number(ing.qtyOnHand)||0) + q);
    if(!(ing.stockFullRef>0) || ing.qtyOnHand > ing.stockFullRef) ing.stockFullRef = ing.qtyOnHand;
    if(currentUser){ ing.lastEditedBy = currentUserLabel(); ing.lastEditedAt = new Date().toISOString(); }
    n++;
  });
  job.stockRestored = true;
  return n;
}
function assetById(id){ return (bizProfile.assets||[]).find(a=>a.id===id) || null; }
function serviceById(id){ return (bizProfile.catalog||[]).find(c=>c.id===id) || null; }
function jobReceipts(jobId){ return receipts.filter(r=>r && r.jobId===jobId); }
/* UNA sola forma de contar un recibo en las vistas por trabajo y por activo: el
   total entero. Para el dueño, lo que gastó en un trabajo o en un camión es el
   ticket completo (combustible, repuestos, lo que sea); la separación entre gasto
   y mercadería es cosa del Cierre de mes (receiptSplit). Antes convivían tres
   cuentas —total en el modal y en "Desde siempre", solo la parte de gasto en el
   mes y en el Cierre— y la ficha se contradecía a sí misma (auditoría de la
   auditoría 2026-09-12). */
function svcReceiptAmount(r){ return Number(r && r.total)||0; }
function jobExpenseTotal(job){ return jobReceipts(job.id).reduce((s,r)=>s+svcReceiptAmount(r),0); }
// Costo de la mercadería que salió con el trabajo (cotización con productos
// aceptada, app-17: job.items con costAt congelado) — la misma regla que outflowPL,
// para que el modal, la ficha del activo y el Cierre digan la misma ganancia.
function jobCogs(job){ return (job && Array.isArray(job.items) ? job.items : []).reduce((s,it)=>s+Math.abs(Number(it && it.qty)||0)*(Number(it && it.costAt)||0),0); }
function jobIsOverdue(j, today){ today = today||localDateStr(); return !j.paid && !!j.dueDate && j.dueDate<today; }
function jobsForMonth(key){ return svcJobs().filter(j=>monthKey(j.date)===key); }
// Cobrado en el mes = trabajos marcados como cobrados, por la fecha en que se cobraron.
function paidRevenueForMonth(key){ return svcJobs().filter(j=>j.paid && monthKey(j.paidDate||j.date)===key).reduce((s,j)=>s+(Number(j.price)||0),0); }
function collectStats(){
  const today = localDateStr();
  let pending=0, overdue=0, overdueCount=0; const clients = new Set(); const list = [];
  svcJobs().forEach(j=>{
    if(j.paid) return;
    pending += Number(j.price)||0;
    clients.add(String(j.client||'').trim().toLowerCase());
    list.push(j);
    if(jobIsOverdue(j, today)){ overdue += Number(j.price)||0; overdueCount++; }
  });
  list.sort((a,b)=>String(a.dueDate||a.date).localeCompare(String(b.dueDate||b.date)));
  return {pending, overdue, overdueCount, clients: clients.size, list, paidMonth: paidRevenueForMonth(localMonthStr())};
}
function svcClientNames(){
  const seen = new Map();
  const add = (n)=>{ n = String(n||'').trim(); if(n && !seen.has(n.toLowerCase())) seen.set(n.toLowerCase(), n); };
  // Clientes guardados primero (app-17: con teléfono y correo), después los de
  // trabajos y cotizaciones que se escribieron a mano.
  ((bizProfile && bizProfile.clients)||[]).forEach(c=>add(c.name));
  svcJobs().forEach(j=>add(j.client));
  if(typeof svcQuotes==='function') svcQuotes().forEach(q=>add(q.client));
  return [...seen.values()].sort((a,b)=>a.localeCompare(b));
}
/* ---------- activos ---------- */
function assetReceipts(assetId, key){
  // Con jobId y el trabajo VIVO manda el trabajo (si cambió de equipo, el recibo
  // lo sigue; un recibo nunca cuenta en dos activos). Si el trabajo ya no está
  // (eliminado, o recortado por el tope de 400 salidas) vale el assetId propio del
  // recibo: el gasto del camión no desaparece porque el trabajo se borró — la
  // ficha del recibo sigue diciendo "Activo: Camión 1" y el texto de confirmación
  // promete que "sus gastos quedan como recibos" (auditoría de la auditoría 2026-09-12).
  const jobAsset = new Map(svcJobs().map(j=>[j.id, j.assetId||null]));
  return receipts.filter(r=>{
    if(!r || (key && monthKey(r.date)!==key)) return false;
    if(r.jobId && jobAsset.has(r.jobId)) return jobAsset.get(r.jobId)===assetId;
    return r.assetId===assetId;
  });
}
/* revenue = FACTURADO con el activo (trabajos por fecha, cobrados o no); paid = lo
   que de esos trabajos ya se cobró (antes la ficha llamaba "Cobrado" al facturado
   y contradecía a Por cobrar, auditoría 2026-09-12); cogs = mercadería que salió
   con esos trabajos (cotizaciones con productos); expense = recibos del activo,
   total entero (svcReceiptAmount); net = revenue − cogs − expense, la misma
   cuenta que el Cierre de mes. Los trabajos que el tope de 400 salidas ya
   consolidó en el archivo (byAsset, app-08) se suman para que "Desde siempre" y
   los meses viejos no se achiquen en silencio. */
function svcAssetStats(asset, jobs, recs, archived){
  const revenue = jobs.reduce((s,j)=>s+(Number(j.price)||0),0) + (archived.revenue||0);
  const paid = jobs.filter(j=>j.paid).reduce((s,j)=>s+(Number(j.price)||0),0) + (archived.paid||0);
  const cogs = jobs.reduce((s,j)=>s+jobCogs(j),0) + (archived.cogs||0);
  const expense = recs.reduce((s,r)=>s+svcReceiptAmount(r),0);
  return {revenue, paid, cogs, jobs: jobs.length + (archived.jobs||0), expense, net: revenue-cogs-expense};
}
// Aporte archivado del activo en los meses que pasan el filtro (todos sin filtro).
function svcArchivedForAssetPeriod(assetId, monthOk){
  const out = {revenue:0, paid:0, cogs:0, jobs:0};
  Object.keys(outflowArchive||{}).forEach(k=>{
    if(monthOk && !monthOk(k+'-01')) return;
    const a = outflowArchive[k] && outflowArchive[k].byAsset && outflowArchive[k].byAsset[assetId];
    if(!a) return;
    out.revenue += a.revenue||0; out.paid += a.paid||0; out.cogs += a.cogs||0; out.jobs += a.jobs||0;
  });
  return out;
}
// En un mes (key) o en todos (sin key).
function svcArchivedForAsset(assetId, key){ return svcArchivedForAssetPeriod(assetId, key ? (d=>monthKey(d)===key) : null); }
function assetMonthStats(asset, key){
  return svcAssetStats(asset, jobsForMonth(key).filter(j=>j.assetId===asset.id), assetReceipts(asset.id, key), svcArchivedForAsset(asset.id, key));
}
// Acumulado desde siempre (la ficha lo muestra como "Desde la compra").
function assetAllTimeStats(asset){
  return svcAssetStats(asset, svcJobs().filter(j=>j.assetId===asset.id), assetReceipts(asset.id), svcArchivedForAsset(asset.id));
}
// Estado de un plan de mantenimiento. Con el odómetro apagado en Ajustes los km
// del activo no cuentan (antes un plan "cada 5.000 km" seguía diciendo "en 3.000
// km" para siempre en una carpa de eventos): solo rige el plazo en meses.
function svcMaintStatus(m, a, today){
  return maintStatus(m, useOdo() ? a : Object.assign({}, a, {km: null}), today || localDateStr(), bizProfile.maintDays);
}
const SVC_MAINT_RANK = {overdue:3, soon:2, ok:1, none:0};
function assetMaintInfo(asset){
  const today = localDateStr(); let worst = null;
  (asset.maint||[]).forEach(m=>{
    const st = svcMaintStatus(m, asset, today);
    const rank = SVC_MAINT_RANK[st.status];
    if(!worst || rank>worst.rank) worst = {rank, plan:m, st};
    else if(rank===worst.rank && rank>0 && svcMaintUrgency(st) < svcMaintUrgency(worst.st)) worst = {rank, plan:m, st};
  });
  return worst;
}
// Para ordenar dos planes del mismo estado: el que vence antes (en días
// equivalentes; 30 km ≈ 1 día es solo un criterio de orden, no una cuenta).
function svcMaintUrgency(st){
  const a = st.daysLeft===null ? Infinity : st.daysLeft;
  const b = st.kmLeft===null ? Infinity : st.kmLeft/30;
  return Math.min(a, b);
}
function svcMaintTag(status){
  if(status==='overdue') return {cls:'crit', label:t('svc_tag_overdue')};
  if(status==='soon') return {cls:'warn', label:t('svc_tag_soon')};
  return {cls:'ok', label:t('svc_tag_ok')};
}
function svcFmtNum(n){ return formatInt(n); }
function svcMonthYear(dateStr){
  const k = monthKey(dateStr); if(!k) return '';
  return monthLabel(k, uiLang).toLowerCase();
}
// "en 1,200 km" / "en 12 días" / "nov 2026" / "vencido hace 6 días".
function svcMaintWhen(st){
  if(st.status==='none') return t('svc_maint_no_date');
  if(st.status==='overdue'){
    if(st.daysLeft!==null && st.daysLeft<0) return t('svc_overdue_days').replace('{n}', String(-st.daysLeft));
    return tu('svc_overdue_km').replace('{n}', svcFmtNum(st.kmLeft));
  }
  const useKm = st.kmLeft!==null && (st.daysLeft===null || st.kmLeft/30 < st.daysLeft);
  if(useKm) return tu('svc_in_km').replace('{n}', svcFmtNum(st.kmLeft));
  if(st.daysLeft<=45) return t('svc_in_days').replace('{n}', String(st.daysLeft));
  return svcMonthYear(st.dueDate);
}
function svcMaintLine(asset){
  const info = assetMaintInfo(asset);
  if(!info) return {text: t('svc_maint_no_plan'), tag: null};
  const tag = info.st.status==='none' ? null : svcMaintTag(info.st.status);
  if(info.st.status==='overdue') return {text: `${info.plan.name} ${svcMaintWhen(info.st)}`, tag: {cls:'crit', label:t('svc_tag_maint')}};
  if(info.st.status==='none') return {text: `${t('svc_maint_next_label')}: ${info.plan.name} · ${t('svc_maint_no_date')}`, tag: null};
  return {text: `${t('svc_maint_next_label')}: ${info.plan.name} ${svcMaintWhen(info.st)}`, tag};
}
function svcMaintOverview(){
  const overdue = [], soon = [];
  (bizProfile.assets||[]).forEach(a=>{
    const info = assetMaintInfo(a);
    if(!info) return;
    if(info.st.status==='overdue') overdue.push({asset:a, plan:info.plan, st:info.st});
    else if(info.st.status==='soon') soon.push({asset:a, plan:info.plan, st:info.st});
  });
  return {overdue, soon};
}
function svcCatEmoji(name){
  const n = String(name||'').toLowerCase();
  if(/combust|fuel|gas|nafta|diesel|di[eé]sel/.test(n)) return '⛽';
  if(/peaje|toll/.test(n)) return '🛣️';
  if(/seguro|insur/.test(n)) return '🛡️';
  if(/manten|mainten|taller|repair|repuesto/.test(n)) return '🔧';
  if(/ayud|helper|staff|personal|sueldo|wage|jornal/.test(n)) return '👷';
  if(/transp|flete|freight/.test(n)) return '🚚';
  return '🧾';
}
// Ícono de un servicio por lo que dice su nombre (sin pedirle nada al usuario).
function svcServiceEmoji(name){
  const n = String(name||'').toLowerCase();
  if(/c[aá]mara|frig|fr[ií]o|refriger|hielo|ice|cold/.test(n) && /alquiler|rent|cámara|camara/.test(n)) return '❄️';
  if(/interurb|ruta|larga|highway|long/.test(n)) return '🛣️';
  if(/carga|descarga|load|mudanza|moving/.test(n)) return '📦';
  if(/viaje|flete|trip|freight|transporte|delivery|env[ií]o/.test(n)) return '🚚';
  if(/repar|fix|repair|service|mantenim/.test(n)) return '🔧';
  if(/limpi|clean/.test(n)) return '🧹';
  if(/instal|install|obra|construc/.test(n)) return '🏗️';
  return '🧾';
}
function receiptCatName(r){
  const c = r && r.expenseCategoryId ? expenseCategories.find(x=>x.id===r.expenseCategoryId) : null;
  return c ? c.name : '';
}
function svcReceiptLabel(r){
  const cat = receiptCatName(r);
  const name = r.manual ? (r.supplier||'') : (r.supplier||t('no_supplier_name'));
  return `${svcCatEmoji(cat||name)} ${escapeHtml(cat && r.manual && cat.toLowerCase()!==String(name).toLowerCase() ? (name ? name : cat) : name)}`;
}
function svcShortDate(dateStr){
  if(!dateStr) return '';
  const today = localDateStr();
  if(dateStr===today) return t('svc_today');
  if(dateStr===addDaysStr(today,-1)) return t('svc_yesterday');
  const [y,m,d] = dateStr.split('-');
  const mn = (MONTH_NAMES[uiLang]||MONTH_NAMES.en)[parseInt(m,10)-1];
  return uiLang==='en' ? `${mn} ${parseInt(d,10)}` : `${parseInt(d,10)} ${mn.toLowerCase()}`;
}
function svcMoneyShort(v){ return money(v).replace(/([.,])00$/, ''); }
function svcUnitSuffix(unit){
  return unit==='km' ? `/${distU()}` : unit==='day' ? `/${t('svc_unit_day_short')}` : unit==='hour' ? '/h' : '';
}
// Etiqueta corta de la unidad de cobro ("h", "día", "km"/"mi"); '' si es por trabajo.
function svcUnitShort(unit){ return svcUnitSuffix(unit).replace(/^\//, ''); }
function svcServicePrice(c){
  if(!(c.price>0)) return '—';
  return c.unit==='fixed' ? t('svc_from').replace('{p}', svcMoneyShort(c.price)) : svcMoneyShort(c.price)+svcUnitSuffix(c.unit);
}

/* ---------- piezas del Dashboard ---------- */
// Herramientas con nombre del modo Servicios (solo cuando no vende productos):
// Trabajo · Escanear recibo · Gasto. Mismos anillos y mismo FAB que siempre.
function svcToolsHtml(scanSvg){
  return `
  <div class="inv-tools" style="margin:4px 0 16px;">
    <button type="button" class="inv-tool" id="btn-new-job" title="${t('svc_job_new')}">
      <span class="inv-tool-ring tool-products">${svcBizEmoji()}</span>
      <span class="inv-tool-label">${t('svc_tool_job')}</span>
    </button>
    <div class="inv-tool" style="min-width:76px;">
      <button type="button" class="shelf-scan-fab" id="btn-scan-fab" title="${t('dash_scan_receipt')}" aria-label="${t('dash_scan_receipt')}">
        <div class="scan-fab-ring"></div>
        <div class="scan-fab-ring delay"></div>
        ${scanSvg}
      </button>
      <span class="inv-tool-label" style="font-weight:800;">${t('dash_scan_receipt')}</span>
    </div>
    <button type="button" class="inv-tool" id="btn-svc-spend" title="${t('manual_spend_title')}">
      <span class="inv-tool-ring tool-manual">＋</span>
      <span class="inv-tool-label">${t('svc_tool_spend')}</span>
    </button>
  </div>`;
}
// Baldosas "Hoy" del modo Servicios: Trabajos · Por cobrar · Mantenimiento.
/* Ícono del negocio para "Trabajo", Equipo y las notas de trabajo del calendario:
   un camión solo si el equipo lleva kilómetros (vehículos); si no, algo neutro
   (una empresa de limpieza o de soporte técnico no tiene camiones). */
function svcBizEmoji(){ return useOdo() ? '🚚' : '🧰'; }
// Ícono de UN trabajo: el del equipo usado, si no el del servicio, si no el del negocio.
function svcJobEmoji(j){
  const a = j && j.assetId ? assetById(j.assetId) : null;
  if(a && a.emoji) return a.emoji;
  if(j && j.serviceName) return svcServiceEmoji(j.serviceName);
  return svcBizEmoji();
}
// ¿El trabajo está en curso ese día? Un alquiler o evento de varios días tiene
// endDate (auditoría 2026-09-12); sin endDate es de un solo día.
function jobCoversDay(j, day){ return !!j && !!j.date && j.date<=day && (j.endDate||j.date)>=day; }
function svcDashTilesHtml(){
  const today = localDateStr();
  const jobsToday = svcJobs().filter(j=>jobCoversDay(j, today));
  const cs = collectStats();
  const mo = svcMaintOverview();
  const firstJob = jobsToday[0];
  // Con algo vencido la insignia dice Vencido (roja), como la de Mantenimiento.
  const collectBadge = cs.overdueCount>0 ? {cls:'crit', label:t('svc_tag_overdue')} : cs.pending>0 ? {cls:'warn', label:t('svc_tag_pending')} : {cls:'ok', label:t('svc_tag_ok')};
  const maintBadge = mo.overdue.length ? {cls:'crit', label:t('svc_tag_overdue')} : mo.soon.length ? {cls:'warn', label:t('svc_tag_soon')} : {cls:'ok', label:t('svc_tag_ok')};
  const maintFirst = mo.overdue[0] || mo.soon[0];
  const maintNum = mo.overdue.length || mo.soon.length;
  return `
    <button type="button" class="dash-tile t1" id="btn-svc-jobs">
      <span class="dash-tile-badge ${jobsToday.length?'ok':''}">${t('svc_badge_today')}</span>
      <span class="dash-tile-icon" aria-hidden="true">🗓️</span>
      <b class="dash-tile-num">${jobsToday.length}</b>
      <span class="dash-tile-title">${t('svc_tile_jobs')}</span>
      <span class="dash-tile-sub">${firstJob ? escapeHtml(firstJob.client||firstJob.serviceName||'')+(jobsToday.length>1 ? ` +${jobsToday.length-1}` : '') : t('svc_jobs_none_today')}</span>
    </button>
    <button type="button" class="dash-tile t5" id="btn-svc-collect">
      <span class="dash-tile-badge ${collectBadge.cls}">${collectBadge.label}</span>
      <span class="dash-tile-icon" aria-hidden="true">💵</span>
      <b class="dash-tile-num ${cs.overdueCount>0?'crit':''}">${svcMoneyShort(cs.pending)}</b>
      <span class="dash-tile-title">${t('svc_tile_collect')}</span>
      <span class="dash-tile-sub">${cs.pending>0 ? t('svc_collect_sub').replace('{c}', String(cs.clients)).replace('{o}', String(cs.overdueCount)) : t('svc_collect_none')}</span>
    </button>
    ${typeof svcQuotesTileHtml==='function' ? svcQuotesTileHtml() : ''}
    ${(bizProfile.assets||[]).length ? `
    <button type="button" class="dash-tile ${mo.overdue.length?'alert':'t3'}" id="btn-svc-maint">
      <span class="dash-tile-badge ${maintBadge.cls}">${maintBadge.label}</span>
      <span class="dash-tile-icon" aria-hidden="true">🔧</span>
      <b class="dash-tile-num ${mo.overdue.length?'crit':''}">${maintNum}</b>
      <span class="dash-tile-title">${t('svc_tile_maint')}</span>
      <span class="dash-tile-sub">${maintFirst ? `${escapeHtml(maintFirst.asset.name)} · ${escapeHtml(maintFirst.plan.name.toLowerCase())}` : t('svc_maint_all_ok')}</span>
    </button>` : ''}`;
}
// Con productos Y servicios, Equipo y activos no es pestaña: es esta baldosa.
function svcEquipoTileHtml(){
  const n = (bizProfile.assets||[]).length;
  return `
    <button type="button" class="dash-tile t2" id="btn-svc-equipo">
      <span class="dash-tile-icon" aria-hidden="true">🚚</span>
      <span class="dash-tile-title">${t('svc_title_equipo')}</span>
      <span class="dash-tile-sub">${t('svc_tile_equipo_sub').replace('{n}', String(n))}</span>
      <span class="dash-tile-chev">›</span>
    </button>`;
}
// Tarjeta de aviso (misma que la del presupuesto) cuando hay cobros vencidos.
function svcOverdueCard(){
  if(!usesServices() || bizProfile.remindOverdue===false) return '';
  const cs = collectStats();
  if(!cs.overdueCount) return '';
  return `
  <div class="budget-alert-card warn" id="btn-collect-alert" role="button" tabindex="0">
    <span class="ba-icon">💵</span>
    <span class="ba-text"><b>${t('svc_overdue_card_title').replace('{n}', String(cs.overdueCount))}</b><span>${t('svc_overdue_card_sub').replace('{amount}', money(cs.overdue))}</span></span>
    <span class="ba-chev">›</span>
  </div>`;
}

/* ---------- EQUIPO Y ACTIVOS (pestaña u hoja) ---------- */
function svcAssetRowHtml(a, key){
  const st = assetMonthStats(a, key);
  const ml = svcMaintLine(a);
  return `
  <div class="matched-item svc-row ${ml.tag && ml.tag.cls==='crit' ? 'svc-row-crit' : ''}" data-open-asset="${escapeHtml(a.id)}" role="button" tabindex="0">
    <span class="svc-row-ic">${escapeHtml(a.emoji||'🚚')}</span>
    <span class="svc-row-tx">
      <b>${escapeHtml(a.name)}${a.model ? ` · ${escapeHtml(a.model)}` : ''}</b>
      <small>${escapeHtml(ml.text)}</small>
      ${ml.tag ? `<span class="dash-tile-badge svc-tag ${ml.tag.cls}">${ml.tag.label}</span>` : ''}
    </span>
    <span class="svc-row-amt"><b>${svcMoneyShort(st.expense)}</b><small>${t('svc_spend_month_short')}</small></span>
  </div>`;
}
function equipoView(){
  const key = localMonthStr();
  const assets = (bizProfile.assets||[]).slice().sort((a,b)=>a.name.localeCompare(b.name));
  if(assets.length<=3) equipoSearch = ''; // sin caja de búsqueda no hay filtro escondido
  const shown = assets.filter(a=>invMatches(a.name+' '+(a.model||''), equipoSearch));
  const value = assets.reduce((s,a)=>s+(a.purchasePrice||0),0);
  const monthSpend = spendSplitForMonth(key).expense;
  const cats = expenseByCategoryForMonth(key);
  const catCount = (cid)=> receipts.filter(r=>monthKey(r.date)===key && (cid ? r.expenseCategoryId===cid : false)).length;
  const scanSvg = '<svg viewBox="0 0 24 24" width="30" height="30" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>';
  return `
  <h3 class="svc-page-title">${t('svc_title_equipo')}</h3>
  ${canSeeFinancials() ? `
  <div class="inv-stats">
    <div class="inv-stat static"><div class="inv-stat-label">${t('svc_stat_assets')}</div><div class="inv-stat-value">${assets.length}</div></div>
    <div class="inv-stat static svc-stat-value"><div class="inv-stat-label">${t('svc_stat_value')}</div><div class="inv-stat-value">${svcMoneyShort(value)}</div></div>
    <div class="inv-stat static"><div class="inv-stat-label">${t('svc_stat_month_spend')}</div><div class="inv-stat-value">${svcMoneyShort(monthSpend)}</div></div>
  </div>` : ''}
  <div class="inv-tools" style="margin:0 0 6px;">
    <button type="button" class="inv-tool" id="btn-new-asset" title="${t('svc_asset_new')}">
      <span class="inv-tool-ring tool-products">${svcBizEmoji()}</span>
      <span class="inv-tool-label">${t('svc_tool_asset')}</span>
    </button>
    <div class="inv-tool" style="min-width:76px;">
      <button type="button" class="shelf-scan-fab" id="btn-scan-fab-equipo" title="${t('dash_scan_receipt')}" aria-label="${t('dash_scan_receipt')}">
        <div class="scan-fab-ring"></div>
        <div class="scan-fab-ring delay"></div>
        ${scanSvg}
      </button>
      <span class="inv-tool-label" style="font-weight:800;">${t('dash_scan_receipt')}</span>
    </div>
    <button type="button" class="inv-tool" id="btn-log-maint" title="${t('svc_log_title')}" ${assets.length===0?'disabled':''}>
      <span class="inv-tool-ring tool-maint">🔧</span>
      <span class="inv-tool-label">${t('svc_tool_maint')}</span>
    </button>
  </div>
  ${assets.length>3 ? `
  <div class="inv-sticky">
    <div class="inv-toolbar" style="align-items:center;gap:8px;margin:0;">
      <div class="inv-search-wrap" style="width:100%;">
        <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" fill="none" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
        <input id="equipo-search" type="search" value="${escapeHtml(equipoSearch)}" placeholder="${t('svc_search_asset')}" aria-label="${t('svc_search_asset')}" autocomplete="off">
      </div>
    </div>
  </div>` : ''}
  ${assets.length===0 ? `<div class="helper-note" style="margin:14px 0 4px;">${t('svc_no_assets')}</div>`
    : shown.length===0 ? `<div class="oc-empty">${t('inv_no_results')}</div>`
    : shown.map(a=>svcAssetRowHtml(a, key)).join('')}
  ${cats.length>0 ? `
  <div class="dash-section-label" style="margin-top:14px;">${t('svc_consumables')}</div>
  ${cats.slice(0,6).map(c=>`
  <div class="matched-item svc-row static">
    <span class="svc-row-ic">${svcCatEmoji(c.name)}</span>
    <span class="svc-row-tx"><b>${escapeHtml(c.name)}</b>${c.id ? `<small>${t('svc_n_receipts').replace('{n}', String(catCount(c.id)))}</small>` : ''}</span>
    <span class="svc-row-amt"><b>${svcMoneyShort(c.amount)}</b></span>
  </div>`).join('')}` : ''}`;
}
function svcSheet(id, title, body, closeId){
  return `
  <div class="overlay sheet-overlay" id="${id}">
    <div class="full-sheet">
      <div class="full-sheet-bar">
        <strong>${title}</strong>
        <button type="button" class="sheet-close" id="${closeId}" aria-label="${t('btn_close')}">
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" stroke-width="2.2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="full-sheet-body">${body}</div>
    </div>
  </div>`;
}
function equipoSheet(){ return svcSheet('equipo-sheet-overlay', t('svc_title_equipo'), equipoView(), 'btn-close-equipo-sheet'); }

/* ---------- FICHA DE ACTIVO ---------- */
/* La ficha (auditoría 2026-09-12): mes navegable (‹ ›) con "Desde siempre",
   FACTURADO (no "cobrado") con lo cobrado al lado, mantenimientos programados,
   historial de mantenimientos hechos, trabajos con el activo y gastos — cada lista
   dice cuántos muestra de cuántos y "Ver todos" abre la lista filtrada por ESTE
   activo. Gasto/escaneo directo del activo sin pasar por un trabajo. */
function assetSheetKey(){ return assetSheetMonth || localMonthStr(); }
// Etiquetas del mes que se mira: "este mes" solo si es el actual; para otro mes,
// con su nombre ("Gastos de agosto"), no "Gastos del mes".
function svcMonthLabels(key){
  const cur = key===localMonthStr(), m = monthLabel(key, uiLang);
  return {
    jobs: (n)=> n===1 ? (cur ? t('svc_job_month_1') : t('svc_job_1')) : (cur ? t('svc_jobs_month_n') : t('svc_jobs_n')).replace('{n}', String(n)),
    expenses: cur ? t('svc_expenses_month') : t('svc_expenses_of').replace('{m}', m),
    net: cur ? t('svc_leaves_month') : t('svc_net_of').replace('{m}', m)
  };
}
// Unidad con plural para una cantidad ("1 día", "3 días", "2 h", "40 km").
function svcUnitQtyLabel(qty, unit){
  if(unit==='hour') return 'h';
  if(unit==='km') return distU();
  if(unit==='day') return Number(qty)===1 ? t('svc_unit_day_short') : t('svc_unit_days_short');
  return typeof unitLabel==='function' ? unitLabel(unit) : String(unit||'');
}
function assetSheet(){
  const a = assetById(showAssetSheet);
  if(!a) return '';
  const key = assetSheetKey(), cur = localMonthStr();
  const st = assetMonthStats(a, key);
  const all = assetAllTimeStats(a);
  const today = localDateStr();
  const fin = canSeeFinancials();
  const showKm = useOdo() && a.km!==null && a.km!==undefined;
  const bought = [a.purchaseDate ? t('svc_bought').replace('{when}', svcMonthYear(a.purchaseDate)) : '', a.purchasePrice>0 ? money(a.purchasePrice) : '', showKm ? `${svcFmtNum(a.km)} ${distU()}` : ''].filter(Boolean).join(' · ');
  const recsAll = assetReceipts(a.id).sort((x,y)=>String(y.date).localeCompare(String(x.date)));
  const recs = recsAll.slice(0,6);
  const jobsAll = svcJobs().filter(j=>j.assetId===a.id).sort((x,y)=>String(y.date).localeCompare(String(x.date)));
  const jobs = jobsAll.slice(0,6);
  const logAll = (a.maintLog||[]).slice().sort((x,y)=>String(y.date).localeCompare(String(x.date)));
  const log = assetSheetShowAllMaint ? logAll : logAll.slice(0,5);
  const plans = (a.maint||[]).map(m=>({m, st: svcMaintStatus(m, a, today)}))
    .sort((x,y)=> SVC_MAINT_RANK[y.st.status]-SVC_MAINT_RANK[x.st.status] || svcMaintUrgency(x.st)-svcMaintUrgency(y.st));
  const every = (m)=>[m.everyKm>0 && useOdo() ? tu('svc_every_km').replace('{n}', svcFmtNum(m.everyKm)) : '', m.everyMonths>0 ? t('svc_every_months').replace('{n}', String(m.everyMonths)) : ''].filter(Boolean).join(uiLang==='en' ? ' or ' : ' o ');
  const nOf = (shown, total)=> total>shown ? t('svc_n_of_total').replace('{n}', String(shown)).replace('{t}', String(total)) : '';
  const logName = (l)=>{ const plan = l.planId ? (a.maint||[]).find(m=>m.id===l.planId) : null; return plan ? `${plan.emoji||'🔧'} ${plan.name}` : `🔧 ${l.desc || t('svc_log_other')}`; };
  // El recibo del registro se abre solo si todavía existe (borrado: fila sin botón).
  const logRid = (l)=> (l.receiptId && receipts.some(r=>r && r.id===l.receiptId)) ? l.receiptId : null;
  const ml = svcMonthLabels(key);
  const body = `
    <h3 class="navy svc-sheet-title">${escapeHtml(a.emoji||'🚚')} ${escapeHtml(a.name)}${a.model ? ` · ${escapeHtml(a.model)}` : ''}
      <button type="button" class="stock-icon-btn edit svc-title-edit" id="btn-edit-asset" title="${t('svc_edit_asset')}" aria-label="${t('svc_edit_asset')}"><svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
    </h3>
    <div class="sub svc-sub">${bought || t('svc_no_purchase_data')}</div>
    <div class="svc-month-nav">
      <button type="button" class="link-btn" id="btn-asset-prev-month" aria-label="${t('svc_prev_month')}" title="${t('svc_prev_month')}">‹</button>
      <b>${monthLabel(key, uiLang)}</b>
      <button type="button" class="link-btn" id="btn-asset-next-month" aria-label="${t('svc_next_month')}" title="${t('svc_next_month')}" ${key>=cur?'disabled':''}>›</button>
    </div>
    ${fin ? `
    <div class="dash-grid" style="margin-top:4px;">
      <div class="dash-tile t3 static svc-mini-tile">
        <b class="dash-tile-num">${svcMoneyShort(st.revenue)}</b>
        <span class="dash-tile-title">${t('svc_billed_with')}</span>
        <span class="dash-tile-sub">${ml.jobs(st.jobs)} · ${t('svc_paid_of_short').replace('{amount}', svcMoneyShort(st.paid))}</span>
      </div>
      <div class="dash-tile twarn static svc-mini-tile">
        <b class="dash-tile-num">${svcMoneyShort(st.expense)}</b>
        <span class="dash-tile-title">${ml.expenses}</span>
        <span class="dash-tile-sub">${monthLabel(key, uiLang)}</span>
      </div>
    </div>
    <div class="recap-row svc-line-big"><span class="recap-label">${ml.net}</span><span class="recap-col-val"><strong style="color:${st.net>=0?'var(--money-pos)':'var(--money-neg)'};">${st.net<0?'−':''}${money(Math.abs(st.net))}</strong></span></div>
    <div class="recap-row"><span class="recap-label">${t('svc_since_purchase')}<small class="svc-plan-sub" style="display:block;">${t('svc_since_purchase_sub').replace('{jobs}', svcJobsCount(all.jobs)).replace('{billed}', svcMoneyShort(all.revenue)).replace('{spent}', svcMoneyShort(all.expense))}</small></span><span class="recap-col-val"><strong style="color:${all.net>=0?'var(--money-pos)':'var(--money-neg)'};">${all.net<0?'−':''}${money(Math.abs(all.net))}</strong></span></div>` : ''}
    <div class="settings-card svc-card">
      <div class="svc-card-head"><span>${t('svc_maints')}</span><button type="button" class="link-btn" id="btn-add-maint">${t('svc_add')}</button></div>
      ${plans.length===0 ? `<div class="helper-note" style="margin:4px 0 2px;">${t('svc_maint_no_plan')}</div>` : plans.map(({m, st})=>{
        const tag = st.status==='none' ? null : svcMaintTag(st.status);
        return `
      <div class="recap-row svc-plan" data-edit-maint="${escapeHtml(m.id)}" role="button" tabindex="0">
        <span class="recap-label"><span>${escapeHtml(m.emoji||'🔧')} ${escapeHtml(m.name)}</span><small class="svc-plan-sub">${escapeHtml(every(m))}</small></span>
        <span class="recap-col-val">${tag ? `<span class="dash-tile-badge svc-tag ${tag.cls}">${st.status==='overdue' ? tag.label : escapeHtml(svcMaintWhen(st))}</span>` : `<small class="svc-plan-sub">${t('svc_maint_no_date')}</small>`}</span>
      </div>`; }).join('')}
    </div>
    <div class="settings-card svc-card">
      <div class="svc-card-head"><span>${t('svc_maint_history')}${nOf(log.length, logAll.length)}</span>${logAll.length>5 ? `<button type="button" class="link-btn" id="btn-asset-all-maint">${assetSheetShowAllMaint ? t('svc_see_less') : t('svc_see_all')}</button>` : ''}</div>
      ${log.length===0 ? `<div class="helper-note" style="margin:4px 0 2px;">${t('svc_maint_history_empty')}</div>` : log.map(l=>`
      <div class="recap-row svc-plan${logRid(l) ? '' : ' static'}" ${logRid(l) ? `data-view-receipt="${escapeHtml(logRid(l))}" role="button" tabindex="0"` : ''}>
        <span class="recap-label"><span>${escapeHtml(logName(l))}</span><small class="svc-plan-sub">${escapeHtml(svcShortDate(l.date))}${useOdo() && l.km!==null && l.km!==undefined ? ` · ${svcFmtNum(l.km)} ${distU()}` : ''}</small></span>
        <span class="recap-col-val"><strong>${l.cost>0 ? money(l.cost) : '—'}</strong></span>
      </div>`).join('')}
    </div>
    <div class="settings-card svc-card">
      <div class="svc-card-head"><span>${t('svc_jobs_with_asset')}${nOf(jobs.length, jobsAll.length)}</span>${jobsAll.length ? `<button type="button" class="link-btn" id="btn-asset-all-jobs">${t('svc_see_all')}</button>` : ''}</div>
      ${jobs.length===0 ? `<div class="helper-note" style="margin:4px 0 2px;">${t('svc_no_jobs_asset')}</div>` : jobs.map(j=>`
      <div class="recap-row svc-plan" data-open-job="${escapeHtml(j.id)}" role="button" tabindex="0">
        <span class="recap-label"><span>${escapeHtml(j.client||'')}</span><small class="svc-plan-sub">${escapeHtml(j.serviceName||'')}${j.serviceName?' · ':''}${escapeHtml(svcShortDate(j.date))}${j.endDate ? ` → ${escapeHtml(svcShortDate(j.endDate))}` : ''}</small></span>
        <span class="recap-col-val"><span class="dash-tile-badge svc-tag ${j.paid?'ok':jobIsOverdue(j, today)?'crit':'warn'}" style="margin:0;">${jobStatusLabel(j)}</span>${fin ? `<strong>${money(j.price||0)}</strong>` : ''}</span>
      </div>`).join('')}
    </div>
    <div class="settings-card svc-card">
      <div class="svc-card-head"><span>${t('svc_last_expenses')}${nOf(recs.length, recsAll.length)}</span>${recsAll.length ? `<button type="button" class="link-btn" id="btn-asset-all-receipts">${t('svc_see_all')}</button>` : ''}</div>
      ${recs.length===0 ? `<div class="helper-note" style="margin:4px 0 2px;">${t('svc_no_expenses')}</div>` : recs.map(r=>`
      <div class="recap-row svc-plan" data-view-receipt="${escapeHtml(r.id)}" role="button" tabindex="0">
        <span class="recap-label">${svcReceiptLabel(r)} · ${escapeHtml(svcShortDate(r.date))}</span>
        <span class="recap-col-val"><strong>${money(r.total)}</strong></span>
      </div>`).join('')}
      <div class="svc-row-actions" style="margin:8px 0 0;">
        <button type="button" class="btn btn-ghost btn-sm" id="btn-asset-scan">${t('svc_scan_receipt_btn')}</button>
        <button type="button" class="btn btn-ghost btn-sm" id="btn-asset-spend">${t('svc_spend_by_hand')}</button>
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" id="btn-asset-log-maint">${t('svc_log_maint')}</button>
      <button class="btn btn-primary" id="btn-asset-new-job">${t('svc_job_new')}</button>
    </div>
    <button type="button" class="link-btn" id="btn-print-asset" style="width:100%;margin-top:6px;">🖨 ${t('svc_print_asset')}</button>`;
  return svcSheet('asset-sheet-overlay', t('svc_tool_asset'), body, 'btn-close-asset-sheet');
}

/* ---------- POR COBRAR ---------- */
function collectSheet(){
  const cs = collectStats();
  const today = localDateStr();
  const weekAgo = addDaysStr(today, -7);
  const paidWeek = svcJobs().filter(j=>j.paid && (j.paidDate||j.date)>=weekAgo).sort((a,b)=>String(b.paidDate||b.date).localeCompare(String(a.paidDate||a.date)));
  const dueTxt = (j)=>{
    if(!j.dueDate) return '';
    const d = daysBetweenStr(today, j.dueDate);
    return d===0 ? t('svc_due_today') : d>0 ? t('svc_due_in').replace('{n}', String(d)) : t('svc_due_ago').replace('{n}', String(-d));
  };
  const paidTxt = (j)=>{
    const p = j.paidDate||j.date;
    return p===today ? t('svc_paid_today') : p===addDaysStr(today,-1) ? t('svc_paid_yesterday') : t('svc_paid_on').replace('{when}', svcShortDate(p));
  };
  const body = `
    <div class="sub svc-sub" style="display:flex;align-items:center;justify-content:space-between;gap:10px;"><span>${t('svc_collect_sub2')}</span>${reportButtonHtml(localMonthStr())}</div>
    <div class="inv-stats">
      <div class="inv-stat static"><div class="inv-stat-label">${t('svc_stat_pending')}</div><div class="inv-stat-value">${svcMoneyShort(cs.pending)}</div></div>
      <div class="inv-stat static svc-stat-overdue"><div class="inv-stat-label">${t('svc_stat_overdue')}</div><div class="inv-stat-value">${svcMoneyShort(cs.overdue)}</div></div>
      <div class="inv-stat static"><div class="inv-stat-label">${t('svc_stat_paid_month')}</div><div class="inv-stat-value">${svcMoneyShort(cs.paidMonth)}</div></div>
    </div>
    ${cs.list.length===0 ? `<div class="oc-empty">${t('svc_collect_empty')}</div>` : cs.list.map(j=>{
      const over = jobIsOverdue(j, today);
      return `
    <div class="matched-item svc-row ${over?'svc-row-crit':''}" data-open-job="${escapeHtml(j.id)}" role="button" tabindex="0">
      <span class="svc-row-ic">${over?'⏰':'💵'}</span>
      <span class="svc-row-tx">
        <b>${escapeHtml(j.client||'')}</b>
        <small>${escapeHtml(j.serviceName||'')}${j.serviceName?' · ':''}${escapeHtml(svcShortDate(j.date))}${j.dueDate ? ` · ${escapeHtml(dueTxt(j))}` : ''}</small>
        <span class="dash-tile-badge svc-tag ${over?'crit':'warn'}">${over ? t('svc_tag_overdue') : t('svc_tag_pending')}</span>
      </span>
      <span class="svc-row-amt"><b style="color:${over?'var(--money-neg)':'var(--ink)'};">${svcMoneyShort(j.price||0)}</b></span>
    </div>
    <div class="svc-row-actions">
      <button type="button" class="btn btn-ghost btn-sm" data-wa-job="${escapeHtml(j.id)}">${t('svc_whatsapp')}</button>
      <button type="button" class="btn btn-primary btn-sm" data-paid-job="${escapeHtml(j.id)}">${t('svc_mark_paid')}</button>
    </div>`; }).join('')}
    ${paidWeek.length ? `
    <div class="dash-section-label" style="margin-top:14px;">${t('svc_paid_week')}</div>
    ${paidWeek.map(j=>`
    <div class="matched-item svc-row" data-open-job="${escapeHtml(j.id)}" role="button" tabindex="0">
      <span class="svc-row-ic">✅</span>
      <span class="svc-row-tx"><b>${escapeHtml(j.client||'')}</b><small>${escapeHtml(j.serviceName||'')}${j.serviceName?' · ':''}${escapeHtml(svcShortDate(j.date))} · ${escapeHtml(paidTxt(j))}</small></span>
      <span class="svc-row-amt"><b style="color:var(--money-pos);">${svcMoneyShort(j.price||0)}</b></span>
    </div>`).join('')}` : ''}`;
  return svcSheet('collect-sheet-overlay', t('svc_collect_title'), body, 'btn-close-collect-sheet');
}

/* ---------- TRABAJOS (lista) ---------- */
// Chip de filtro por activo ("Trabajos con Camión 1 · 40 ✕") para las listas de
// Trabajos y Recibos cuando se llega desde "Ver todos" de la ficha.
function svcAssetFilterChip(asset, labelKey, n, btnId){
  return `<div class="svc-filter-chip"><span>${escapeHtml(asset.emoji||'')} ${t(labelKey).replace('{name}', escapeHtml(asset.name))} · ${n}</span><button type="button" class="stock-row-x-btn" id="${btnId}" title="${t('btn_close')}" aria-label="${t('btn_close')}">✕</button></div>`;
}
function jobsSheet(){
  const today = localDateStr();
  // Con 5 trabajos o menos la caja de búsqueda no se dibuja: un texto que quedó
  // de antes (se borraron trabajos) no puede seguir filtrando a escondidas.
  if(svcJobs().length<=5) jobsSearch = '';
  const q = jobsSearch.trim();
  const fa = jobsAssetFilter ? assetById(jobsAssetFilter) : null;
  // El buscador también encuentra por nombre del equipo ("Retro 2" listaba
  // "Sin resultados" aunque hubiera 40 trabajos con esa máquina).
  const all = svcJobs().filter(j=>(!fa || j.assetId===fa.id) && (!q || invMatches((j.client||'')+' '+(j.serviceName||'')+' '+(((j.assetId && assetById(j.assetId))||{}).name||''), q)))
    .sort((a,b)=>String(b.date).localeCompare(String(a.date)) || String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
  // Ventana con "Mostrar más" (antes se cortaba en 120 sin ningún aviso).
  const list = all.slice(0, jobsShownLimit);
  const hidden = all.length - list.length;
  let lastKey = '';
  const body = `
    <div class="sub svc-sub" style="display:flex;align-items:center;justify-content:space-between;gap:10px;"><span>${t('svc_jobs_sub')}</span>${reportButtonHtml(localMonthStr())}</div>
    <button class="btn btn-primary" id="btn-jobs-new" style="width:100%;margin-bottom:12px;">${t('svc_new_job_btn')}</button>
    ${fa ? svcAssetFilterChip(fa, 'svc_jobs_of_asset', all.length, 'btn-clear-jobs-asset') : ''}
    ${svcJobs().length>5 ? `
    <div class="inv-search-wrap" style="width:100%;margin-bottom:10px;">
      <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" fill="none" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
      <input id="jobs-search" type="search" value="${escapeHtml(jobsSearch)}" placeholder="${t('svc_search_job')}" aria-label="${t('svc_search_job')}" autocomplete="off">
    </div>` : ''}
    ${list.length===0 ? `<div class="helper-note" style="margin:8px 0;">${svcJobs().length ? t('inv_no_results') : t('svc_jobs_empty')}</div>` : list.map(j=>{
      const k = monthKey(j.date); const head = k!==lastKey ? `<div class="dash-section-label" style="margin-top:10px;">${monthLabel(k, uiLang)}</div>` : ''; lastKey = k;
      const over = jobIsOverdue(j, today);
      const asset = j.assetId ? assetById(j.assetId) : null;
      const exp = jobExpenseTotal(j);
      return `${head}
    <div class="matched-item svc-row ${over?'svc-row-crit':''}" data-open-job="${escapeHtml(j.id)}" role="button" tabindex="0">
      <span class="svc-row-ic">${asset ? escapeHtml(asset.emoji||'🚚') : '🧾'}</span>
      <span class="svc-row-tx">
        <b>${j.repeat ? '🔁 ' : ''}${escapeHtml(j.client||'')}</b>
        <small>${escapeHtml(j.serviceName||'')}${j.serviceName?' · ':''}${escapeHtml(svcShortDate(j.date))}${j.endDate ? ` → ${escapeHtml(svcShortDate(j.endDate))}` : ''}${asset ? ` · ${escapeHtml(asset.name)}` : ''}${j.repeat ? ` · ${svcRepeatLabel(j.repeat).toLowerCase()}` : ''}${exp>0 ? ` · ${t('svc_expenses_short')} ${svcMoneyShort(exp)}` : ''}</small>
        <span class="dash-tile-badge svc-tag ${j.paid?'ok':over?'crit':'warn'}">${j.paid ? t('svc_tag_paid') : over ? t('svc_tag_overdue') : t('svc_tag_pending')}</span>
      </span>
      <span class="svc-row-amt"><b style="color:${j.paid?'var(--money-pos)':over?'var(--money-neg)':'var(--ink)'};">${svcMoneyShort(j.price||0)}</b></span>
    </div>`; }).join('')}
    ${hidden>0 ? `
    <div style="text-align:center;margin:14px 0 6px;">
      <button type="button" class="btn btn-ghost" id="btn-jobs-show-more">${t('rec_show_more').replace('{n}', String(Math.min(hidden, JOBS_WINDOW_STEP)))}</button>
      <div class="helper-note" style="margin-top:6px;">${t('svc_jobs_showing_n').replace('{shown}', String(list.length)).replace('{total}', String(all.length))}</div>
    </div>` : ''}`;
  return svcSheet('jobs-sheet-overlay', t('svc_jobs_title'), body, 'btn-close-jobs-sheet');
}

/* ---------- MIS SERVICIOS (lista con precios) ---------- */
function servicesSheet(){
  const list = (bizProfile.catalog||[]).slice().sort((a,b)=>a.name.localeCompare(b.name));
  const body = `
    <div class="sub svc-sub">${t('svc_catalog_sub')}</div>
    <button class="btn btn-primary" id="btn-service-new" style="width:100%;margin-bottom:12px;">${t('svc_add_service_btn')}</button>
    ${list.length===0 ? `<div class="helper-note" style="margin:8px 0;">${t('svc_catalog_empty')}</div>` : list.map((c,i)=>`
    <div class="matched-item svc-row" data-edit-service="${escapeHtml(c.id)}" role="button" tabindex="0">
      <span class="svc-row-ic svc-row-ic-t${(i%4)+1}">${svcServiceEmoji(c.name)}</span>
      <span class="svc-row-tx"><b>${escapeHtml(c.name)}</b>${c.desc ? `<small>${escapeHtml(c.desc)}</small>` : ''}</span>
      <span class="svc-row-amt"><b>${svcServicePrice(c)}</b></span>
    </div>`).join('')}`;
  return svcSheet('services-sheet-overlay', t('svc_catalog_title'), body, 'btn-close-services-sheet');
}

/* ---------- CATEGORÍAS DE GASTO (renombrar, borrar, agregar) ----------
   Pedido del usuario 2026-09-11: "que el usuario pueda quitar lo que no use".
   Las categorías de gasto (Combustible, Peajes...) no tenían dónde borrarse: el
   modal de Categorías de Ajustes es el del inventario. Un recibo cuya categoría
   se borra queda "Sin categoría"; su tope de presupuesto se borra con ella. */
function expenseCatsSheet(){
  const list = expenseCategories.slice();
  const body = `
    <div class="sub svc-sub">${t('svc_xcats_sub')}</div>
    <button class="btn btn-primary" id="btn-xcat-add" style="width:100%;margin-bottom:12px;">${t('svc_xcat_add')}</button>
    ${list.length===0 ? `<div class="helper-note" style="margin:8px 0;">${t('svc_xcats_empty')}</div>` : list.map(c=>`
    <div class="matched-item svc-row static svc-xcat-row">
      <span class="svc-row-ic">${svcCatEmoji(c.name)}</span>
      <input type="text" class="svc-xcat-input" data-xcat-name="${escapeHtml(c.id)}" value="${escapeHtml(c.name)}" maxlength="40" aria-label="${t('svc_service_name')}">
      <button type="button" class="stock-row-x-btn" data-xcat-del="${escapeHtml(c.id)}" title="${t('btn_delete')}">✕</button>
    </div>`).join('')}`;
  return svcSheet('xcats-sheet-overlay', t('svc_set_categories'), body, 'btn-close-xcats-sheet');
}

/* ---------- MODAL: NUEVO TRABAJO ---------- */
function openJobModal(jobId, presetAssetId){
  // Ver e imprimir un trabajo no necesita permiso de escritura (una cuenta en
  // solo-lectura tiene que poder ver qué le debe un cliente); guardar, borrar y
  // escanear sí lo piden en su botón. Crear uno nuevo sí lo pide de entrada.
  if(!jobId && !requireWriteAccess()) return;
  const j = jobId ? jobById(jobId) : null;
  if(jobId && !j) return;
  draftJob = j ? {
    id:j.id, client:j.client||'', serviceName:j.serviceName||'', serviceId:j.serviceId||null, date:j.date||localDateStr(), endDate: j.endDate||'',
    // price 0 (visita de garantía) se muestra como 0, no como vacío: si no, el trabajo no se podía volver a guardar.
    assetId:j.assetId||null, price:(j.price===null||j.price===undefined) ? '' : j.price, qty: j.qty||'', paid:!!j.paid, paidDate: j.paidDate||'', dueDays: j.dueDays || ((j.dueDate && j.date) ? Math.max(1, daysBetweenStr(j.date, j.dueDate)) : 15), pending:[],
    repeat: j.repeat||null, parentId: j.parentId||null
  } : { id:null, client:'', serviceName:'', serviceId:null, date:localDateStr(), endDate:'', assetId:presetAssetId||null, price:'', qty:'', paid:false, paidDate:'', dueDays:15, pending:[], repeat:null, parentId:null };
  showJobModal = true; jobExpenseFormOpen = false; jobModalError = '';
  render();
}
function closeJobModal(){ showJobModal = false; draftJob = null; jobExpenseFormOpen = false; render(); }
// Cancelar / tocar afuera / atrás: si hay gastos a mano agregados y sin guardar
// se pregunta (antes se perdían en silencio, auditoría 2026-09-12).
function closeJobModalAsk(){
  if(draftJob && draftJob.pending && draftJob.pending.length && !confirm(t('svc_discard_confirm').replace('{n}', String(draftJob.pending.length)))) return;
  closeJobModal();
}
function jobDraftExpenses(){
  const saved = draftJob.id ? jobReceipts(draftJob.id).map(r=>({desc: r.supplier, amount: Number(r.total)||0, cat: receiptCatName(r), id:r.id})) : [];
  const pend = draftJob.pending.map((p,i)=>({desc:p.desc, amount:p.amount, cat: (expenseCategories.find(c=>c.id===p.categoryId)||{}).name||'', pendingIdx:i}));
  return saved.concat(pend);
}
function jobProfitHtml(){
  const price = Number(draftJob.price)||0;
  const exp = jobDraftExpenses().reduce((s,e)=>s+e.amount,0);
  // La mercadería que salió con el trabajo (cotización con productos) también
  // cuesta: sin restarla el modal decía "Ganancia 100 %" y el Cierre otra cosa.
  const cogs = draftJob.id ? jobCogs(jobById(draftJob.id)) : 0;
  const gain = price-exp-cogs;
  const pct = price>0 ? Math.round(gain/price*100) : null;
  return `<strong style="color:${gain>=0?'var(--money-pos)':'var(--money-neg)'};">${gain<0?'−':''}${money(Math.abs(gain))}${pct!==null ? ` · ${pct}%` : ''}</strong>${cogs>0 ? `<div class="helper-note" style="margin:2px 0 0;">${t('svc_job_cogs_note').replace('{amount}', money(cogs))}</div>` : ''}`;
}
function jobModal(){
  const d = draftJob; if(!d) return '';
  const assets = (bizProfile.assets||[]);
  const catalog = (bizProfile.catalog||[]);
  const exps = jobDraftExpenses();
  const expTotal = exps.reduce((s,e)=>s+e.amount,0);
  return `
  <div class="overlay" id="job-overlay">
    <div class="modal">
      <h3 class="navy">${d.id ? t('svc_job_edit') : t('svc_job_new')}</h3>
      <div class="sub">${t('svc_job_sub')}</div>
      <div class="field"><label for="job-client">${t('svc_client')}</label>
        <input id="job-client" type="text" maxlength="60" value="${escapeHtml(d.client)}" placeholder="${t('svc_client_ph')}" list="svc-clients-list" autocomplete="off">
        <datalist id="svc-clients-list">${svcClientNames().map(n=>`<option value="${escapeHtml(n)}"></option>`).join('')}</datalist>
      </div>
      <div class="field-row">
        <div class="field"><label for="job-service">${t('svc_service')}</label>
          <input id="job-service" type="text" maxlength="60" value="${escapeHtml(d.serviceName)}" placeholder="${t('svc_service_ph')}" list="svc-catalog-list" autocomplete="off">
          <datalist id="svc-catalog-list">${catalog.map(c=>`<option value="${escapeHtml(c.name)}"></option>`).join('')}</datalist>
        </div>
        <div class="field"><label for="job-date">${t('lbl_date')}</label><input id="job-date" type="date" value="${escapeHtml(d.date)}"></div>
      </div>
      ${/* Alquileres y eventos de varios días: "Hasta" (opcional). Servicios que se
           cobran por hora/día/km (lista de precios): cantidad y el precio se
           calcula solo (auditoría 2026-09-12). */''}
      ${(()=>{ const u = svcJobUnitService(d); return `
      <div class="field-row">
        <div class="field"><label for="job-end">${t('svc_end_date')}</label><input id="job-end" type="date" value="${escapeHtml(d.endDate||'')}" min="${escapeHtml(d.date||'')}"></div>
        ${u ? `<div class="field"><label for="job-qty">${t('svc_qty_label').replace('{u}', escapeHtml(svcUnitShort(u.unit)))}</label><input id="job-qty" type="number" min="0" step="0.5" inputmode="decimal" value="${escapeHtml(d.qty)}" placeholder="1"></div>` : ''}
      </div>`; })()}
      ${assets.length ? `
      <div class="field"><label>${t('svc_asset_used')}</label>
        <div class="svc-seg">
          <button type="button" class="exit-reason-chip ${!d.assetId?'on':''}" data-job-asset="">${t('svc_asset_none')}</button>
          ${assets.map(a=>`<button type="button" class="exit-reason-chip ${d.assetId===a.id?'on':''}" data-job-asset="${escapeHtml(a.id)}">${escapeHtml(a.emoji||'')} ${escapeHtml(a.name)}</button>`).join('')}
        </div>
      </div>` : ''}
      <div class="field"><label for="job-price">${t('svc_price')}</label>
        <input id="job-price" type="number" min="0" step="0.01" inputmode="decimal" value="${escapeHtml(d.price)}" placeholder="0.00">
        <div class="helper-note" id="svc-job-unit-hint" style="margin-top:4px;">${svcJobUnitHint(d)}</div>
        ${jobModalError ? `<div style="font-size:calc(12px * var(--fs, 1));color:var(--tomato);margin-top:4px;">${jobModalError}</div>` : ''}
      </div>
      <div class="settings-card svc-card">
        <div class="svc-card-head"><span>${t('svc_job_expenses')}</span><span style="color:var(--money-warn-ink);">${money(expTotal)}</span></div>
        ${exps.length===0 ? `<div class="helper-note" style="margin:2px 0 6px;">${t('svc_job_expenses_none')}</div>` : exps.map(e=>`
        <div class="recap-row svc-plan">
          <span class="recap-label">${svcCatEmoji(e.cat||e.desc)} ${escapeHtml(e.desc||e.cat||t('manual_expense_label'))}</span>
          <span class="recap-col-val"><strong>${money(e.amount)}</strong>${e.pendingIdx!==undefined ? `<button type="button" class="link-btn svc-x" data-job-exp-del="${e.pendingIdx}" aria-label="${t('btn_delete')}">✕</button>` : ''}</span>
        </div>`).join('')}
        ${jobExpenseFormOpen ? `
        <div class="svc-exp-form">
          <input id="job-exp-desc" type="text" maxlength="60" placeholder="${t('svc_exp_desc')}">
          <input id="job-exp-amount" type="number" min="0" step="0.01" inputmode="decimal" placeholder="${t('svc_exp_amount')}">
          ${expenseCategories.length ? `<select id="job-exp-cat"><option value="">${t('category_none_option')}</option>${expenseCategories.map(c=>`<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`).join('')}</select>` : ''}
          <button type="button" class="btn btn-primary btn-sm" id="btn-job-exp-add">${t('svc_exp_add')}</button>
        </div>` : `
        <div class="svc-row-actions" style="margin-top:8px;">
          <button type="button" class="btn btn-ghost btn-sm" id="btn-job-scan">${t('svc_scan_receipt_btn')}</button>
          <button type="button" class="btn btn-ghost btn-sm" id="btn-job-exp-open">${t('svc_spend_by_hand')}</button>
        </div>`}
      </div>
      ${canSeeFinancials() ? `<div class="recap-row svc-line-big" style="margin-top:8px;"><span class="recap-label">${t('svc_job_profit')}</span><span class="recap-col-val" id="svc-job-profit">${jobProfitHtml()}</span></div>` : ''}
      ${/* 3. Contrato recurrente: el trabajo se repite y Dusty crea los siguientes. */''}
      ${d.parentId ? `<div class="helper-note" style="margin:0 0 12px;">🔁 ${t('svc_rep_child')}</div>` : `
      <div class="field"><label>${t('svc_rep_label')}</label>
        <div class="svc-seg">
          ${[null].concat(SVC_REPEATS).map(r=>`<button type="button" class="exit-reason-chip ${(d.repeat||null)===r?'on':''}" data-job-repeat="${r||''}">${r?'🔁 ':''}${svcRepeatLabel(r)}</button>`).join('')}
        </div>
      </div>`}
      <div class="field" style="margin-top:12px;"><label>${t('svc_collect_label')}</label>
        <div class="svc-seg">
          <button type="button" class="exit-reason-chip ${d.paid?'on':''}" data-job-paid="1">${t('svc_paid')}</button>
          <button type="button" class="exit-reason-chip ${!d.paid?'on':''}" data-job-paid="0">${t('svc_pending_days').replace('{n}', String(d.dueDays))}</button>
        </div>
        ${/* El plazo actual entra en la lista aunque no sea uno de los cuatro (el
             asistente acepta cualquier número de días): si no, el <select> caía en
             "7" y al guardar cualquier otro cambio el vencimiento se movía solo. */''}
        ${!d.paid ? `<div class="svc-due-row"><label for="job-due">${t('svc_due_days')}</label><select id="job-due">${[...new Set([7,15,30,60].concat(d.dueDays>0 ? [d.dueDays] : []))].sort((a,b)=>a-b).map(n=>`<option value="${n}" ${d.dueDays===n?'selected':''}>${n} ${t('svc_days_word')}</option>`).join('')}</select></div>`
        : `<div class="svc-due-row"><label for="job-paid-date">${t('svc_paid_date')}</label><input id="job-paid-date" type="date" value="${escapeHtml(d.paidDate || (d.date && d.date<localDateStr() ? d.date : localDateStr()))}"></div>`}
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" id="btn-cancel-job">${t('btn_cancel')}</button>
        <button class="btn btn-primary" id="btn-save-job">${t('svc_save_job')}</button>
      </div>
      ${d.id ? `<div class="svc-row-actions" style="margin:6px 0 0;"><button type="button" class="btn btn-ghost btn-sm" id="btn-print-job">🖨 ${t('svc_print_invoice')}</button><button type="button" class="btn btn-ghost btn-sm" id="btn-delete-job" style="color:var(--tomato);">${t('svc_delete_job')}</button></div>` : ''}
    </div>
  </div>`;
}
// Servicio de la lista que se cobra por hora/día/km y tiene precio: el trabajo
// lleva cantidad. Por trabajo (fixed) o sin precio: null.
function svcJobUnitService(d){
  const c = (bizProfile.catalog||[]).find(x=>x.name.toLowerCase()===String((d && d.serviceName)||'').trim().toLowerCase());
  if(c && c.unit && c.unit!=='fixed' && c.price>0) return c;
  // El servicio de la lista se renombró, se borró o pasó a "por trabajo" después de
  // guardar este trabajo: la cantidad y la unidad que ya tiene siguen valiendo
  // (la cuenta impresa dice "3 h × $20"), con su precio unitario efectivo.
  const j = d && d.id ? jobById(d.id) : null;
  if(j && j.unit && j.unit!=='fixed' && (Number(j.qty)>0 || Number(j.unitPrice)>0) && String(j.serviceName||'').trim().toLowerCase()===String((d && d.serviceName)||'').trim().toLowerCase()) return {name: j.serviceName, unit: j.unit, price: Number(j.unitPrice)||0};
  return null;
}
function svcJobUnitHint(d){
  const u = svcJobUnitService(d); if(!u) return '';
  const q = parseFloat(d.qty);
  return `${svcMoneyShort(u.price)}${svcUnitSuffix(u.unit)}${q>0 ? ` × ${escapeHtml(String(d.qty))} = ${money(Math.round(q*u.price*100)/100)}` : ` · ${t('svc_qty_hint')}`}`;
}
function readJobDraftFromDom(){
  const g = (id)=>document.getElementById(id);
  if(g('job-client')) draftJob.client = g('job-client').value.trim();
  if(g('job-service')) draftJob.serviceName = g('job-service').value.trim();
  // Fecha vacía o inválida: se lee tal cual y saveJobFromDraft la rechaza (antes se
  // ignoraba en silencio y el trabajo se guardaba con la fecha vieja).
  if(g('job-date')) draftJob.date = g('job-date').value;
  if(g('job-end')) draftJob.endDate = g('job-end').value;
  if(g('job-qty')) draftJob.qty = g('job-qty').value;
  if(g('job-price')) draftJob.price = g('job-price').value;
  if(g('job-due')) draftJob.dueDays = parseInt(g('job-due').value,10)||15;
  // job-paid-date NO se lee acá: su valor por defecto lo pinta el render y solo
  // cuenta si el usuario lo cambió (onchange); si no, al guardar rige la fecha del trabajo.
  const c = (bizProfile.catalog||[]).find(x=>x.name.toLowerCase()===draftJob.serviceName.toLowerCase());
  draftJob.serviceId = c ? c.id : null;
}
// Guarda el trabajo (nuevo o editado) y sus gastos a mano pendientes. Devuelve el
// trabajo guardado o null si faltan cliente/precio.
function saveJobFromDraft(){
  readJobDraftFromDom();
  svcLastPruned = 0; // un trabajo nuevo no hereda el aviso de poda del anterior
  const d = draftJob;
  const price = parseFloat(d.price);
  // Fecha REAL, no solo la forma: '2026-02-30' pasa la regex, y como contrato
  // generaba ocurrencias de un día que no existe (el asistente o un JSON de otro
  // teléfono pueden traerla; el <input type=date> nunca).
  const isDate = (v)=>isValidDateStr(v||'');
  if(!d.client || !(price>=0) || isNaN(price)){ jobModalError = t('svc_job_err'); render(); return null; }
  if(!isDate(d.date)){ jobModalError = t('svc_date_err'); render(); return null; }
  if(isDate(d.endDate) && d.endDate<d.date){ jobModalError = t('svc_end_err'); render(); return null; }
  const endDate = (isDate(d.endDate) && d.endDate>d.date) ? d.endDate : null;
  // 4. Choque de equipo: se avisa y se deja decidir.
  const clash = svcClash(Object.assign({}, d, {endDate}));
  if(clash && !confirm(t('svc_clash_confirm').replace('{asset}', (assetById(d.assetId)||{}).name||'').replace('{client}', clash.client||''))) return null;
  let job = d.id ? jobById(d.id) : null;
  // El trabajo abierto ya no existe (lo eliminó otro teléfono y llegó por la
  // nube): guardar o imprimir NO lo resucita como trabajo nuevo.
  if(d.id && !job){ jobModalError = t('svc_job_gone'); render(); return null; }
  const today = localDateStr();
  const dueDate = d.paid ? null : addDaysStr(d.date, d.dueDays||15);
  const repeat = (!d.parentId && SVC_REPEATS.indexOf(d.repeat)>=0) ? d.repeat : null;
  // Cobrado el: lo que diga el campo; si no, la fecha del trabajo (un trabajo de
  // hace dos semanas cargado hoy como cobrado se cobró ese día, no hoy).
  const paidDate = d.paid ? (isDate(d.paidDate) ? d.paidDate : (d.date<today ? d.date : today)) : null;
  const usvc = svcJobUnitService(d);
  const qty = usvc && parseFloat(d.qty)>0 ? Math.round(parseFloat(d.qty)*100)/100 : null;
  // El precio unitario que se imprime es el EFECTIVO (precio ÷ cantidad): si el
  // usuario ajustó el total o la lista cambió después, la cuenta sigue cerrando
  // ("3 h × $20 = $60"), no "3 h × $50 = $60".
  const unitFields = usvc ? {unit: usvc.unit, unitPrice: qty>0 ? Math.round(price/qty*100)/100 : usvc.price, qty} : {unit: null, unitPrice: null, qty: null};
  if(job){
    const prevAsset = job.assetId||null;
    const next = Object.assign({ client:d.client, serviceName:d.serviceName, serviceId:d.serviceId||null, date:d.date, endDate, assetId:d.assetId||null,
      price: Math.round(price*100)/100, paid:!!d.paid, dueDate, dueDays: d.dueDays||15, repeat, paidDate }, unitFields);
    /* Abrir una ocurrencia para mirarla y tocar Guardar sin cambiar nada NO es una
       edición: si se sellara lastEditedAt igual, la ocurrencia pasaba a "tocada
       por el usuario", dejaba de seguir el precio del contrato y sobrevivía a un
       cambio de regla (dos cobros la misma semana). Solo se escribe si algo cambió
       o si hay gastos a mano por colgar (auditoría de la auditoría 2026-09-12). */
    const nv = v => (v===undefined || v==='') ? null : v;
    const unchanged = Object.keys(next).every(k=>nv(job[k])===nv(next[k]));
    if(unchanged && !d.pending.length){ d.id = job.id; svcLastPruned = 0; return job; }
    // Cambió la regla del contrato (fecha o frecuencia): las próximas salen desde
    // la fecha nueva y las que nacieron de la regla vieja se retiran; si solo
    // cambió precio/cliente/equipo/plazo, las próximas sin tocar lo siguen.
    const ruleChanged = job.repeat!==repeat || job.date!==d.date;
    Object.assign(job, next, { lastEditedAt: new Date().toISOString() });
    // Los gastos del trabajo siguen al equipo: si se corrigió el camión, sus
    // recibos ya no se cuentan en la ficha del camión viejo.
    if(prevAsset!==(job.assetId||null)) receipts.forEach(r=>{ if(r && r.jobId===job.id) r.assetId = job.assetId||null; });
    svcAfterJobEdit(job, ruleChanged);
  } else {
    job = Object.assign({ id: uid('job'), type:'service', date:d.date, endDate, client:d.client, serviceName:d.serviceName, serviceId:d.serviceId, assetId:d.assetId||null,
      price: Math.round(price*100)/100, paid:d.paid, dueDate, dueDays: d.dueDays||15, repeat, paidDate,
      items: [], createdAt: new Date().toISOString(), byLabel: (typeof currentUserLabel==='function' && currentUser) ? currentUserLabel() : '' }, unitFields);
    recordOutflow(job);
  }
  d.pending.forEach(p=>{
    receipts.push({ id: uid('r'), images: [], supplier: p.desc || (expenseCategories.find(c=>c.id===p.categoryId)||{}).name || t('manual_expense_label'),
      date: job.date, total: Math.round(p.amount*100)/100, itemCount: 0, appliedItems: [], createdAt: new Date().toISOString(), purchaseIds: [],
      manual: true, manualKind: 'expense', expenseCategoryId: p.categoryId||null, jobId: job.id, assetId: job.assetId||null });
  });
  d.pending = []; d.id = job.id;
  saveState();
  logActivity('job_saved', job.client, job.serviceName);
  return job;
}

/* ---------- MODAL: ACTIVO ---------- */
function openAssetModal(assetId){
  if(!requireWriteAccess()) return;
  const a = assetId ? assetById(assetId) : null;
  draftAsset = a ? {id:a.id, name:a.name, model:a.model||'', emoji:a.emoji||'🚚', purchaseDate:a.purchaseDate||'', purchasePrice:a.purchasePrice||'', km:(a.km===null||a.km===undefined)?'':a.km}
    : {id:null, name:'', model:'', emoji: useOdo() ? '🚚' : '🧰', purchaseDate:'', purchasePrice:'', km:''};
  showAssetModal = true; assetModalError = ''; render();
}
function closeAssetModal(){ showAssetModal = false; draftAsset = null; render(); }
function assetModal(){
  const d = draftAsset; if(!d) return '';
  return `
  <div class="overlay" id="asset-overlay">
    <div class="modal">
      <h3 class="navy">${d.id ? t('svc_edit_asset') : t('svc_asset_new')}</h3>
      <div class="sub">${t('svc_asset_sub')}</div>
      <div class="field"><label>${t('svc_asset_icon')}</label>
        <div class="svc-seg">${SVC_ASSET_EMOJIS.map(e=>`<button type="button" class="exit-reason-chip svc-emoji ${d.emoji===e?'on':''}" data-asset-emoji="${e}">${e}</button>`).join('')}</div>
      </div>
      <div class="field"><label for="asset-name">${t('svc_asset_name')}</label>
        <input id="asset-name" type="text" maxlength="60" value="${escapeHtml(d.name)}" placeholder="${useOdo() ? t('svc_asset_name_ph') : t('svc_asset_name_ph_gen')}">
        ${assetModalError ? `<div style="font-size:calc(12px * var(--fs, 1));color:var(--tomato);margin-top:4px;">${assetModalError}</div>` : ''}
      </div>
      <div class="field"><label for="asset-model">${t('svc_asset_model')}</label><input id="asset-model" type="text" maxlength="60" value="${escapeHtml(d.model)}" placeholder="${useOdo() ? t('svc_asset_model_ph') : t('svc_asset_model_ph_gen')}"></div>
      <div class="field-row">
        <div class="field"><label for="asset-date">${t('svc_purchase_date')}</label><input id="asset-date" type="date" value="${escapeHtml(d.purchaseDate)}"></div>
        <div class="field"><label for="asset-price">${t('svc_purchase_price')}</label><input id="asset-price" type="number" min="0" step="0.01" inputmode="decimal" value="${escapeHtml(d.purchasePrice)}" placeholder="0.00"></div>
      </div>
      ${useOdo() ? `
      <div class="field"><label for="asset-km">${tu('svc_km')}</label><input id="asset-km" type="number" min="0" step="1" inputmode="numeric" value="${escapeHtml(d.km)}" placeholder="—"></div>
      <div class="helper-note">${t('svc_km_helper')}</div>` : ''}
      <div class="modal-actions">
        <button class="btn btn-ghost" id="btn-cancel-asset">${t('btn_cancel')}</button>
        <button class="btn btn-primary" id="btn-save-asset">${t('btn_save')}</button>
      </div>
      ${d.id ? `<button type="button" class="link-btn" id="btn-delete-asset" style="width:100%;margin-top:6px;color:var(--tomato);">${t('svc_delete_asset')}</button>` : ''}
    </div>
  </div>`;
}
function saveAssetFromDraft(){
  const g = (id)=>document.getElementById(id);
  const d = draftAsset;
  d.name = (g('asset-name')||{}).value ? g('asset-name').value.trim() : '';
  d.model = g('asset-model') ? g('asset-model').value.trim() : '';
  d.purchaseDate = g('asset-date') ? g('asset-date').value : '';
  d.purchasePrice = g('asset-price') ? g('asset-price').value : '';
  d.km = g('asset-km') ? g('asset-km').value : ((d.km===null||d.km===undefined) ? '' : d.km);
  if(!d.name){ assetModalError = t('svc_asset_err'); render(); return false; }
  const num = (v)=>{ const n = parseFloat(v); return (v!=='' && Number.isFinite(n) && n>=0) ? n : null; };
  let a = d.id ? assetById(d.id) : null;
  if(!a){ a = {id: uid('as'), maint: [], createdAt: new Date().toISOString()}; bizProfile.assets.push(a); }
  Object.assign(a, {name:d.name, model:d.model, emoji:d.emoji||'🚚', purchaseDate: /^\d{4}-\d{2}-\d{2}$/.test(d.purchaseDate) ? d.purchaseDate : null, purchasePrice: num(d.purchasePrice), km: num(d.km)});
  saveState();
  logActivity('asset_saved', a.name);
  showToast(t('svc_asset_saved'));
  return true;
}

/* ---------- MODAL: MANTENIMIENTO PROGRAMADO (plan) ---------- */
function openMaintModal(assetId, maintId){
  if(!requireWriteAccess()) return;
  const a = assetById(assetId); if(!a) return;
  const m = maintId ? (a.maint||[]).find(x=>x.id===maintId) : null;
  draftMaint = m ? {assetId, id:m.id, name:m.name, emoji:m.emoji||'🔧', everyKm:m.everyKm||'', everyMonths:m.everyMonths||'', lastDate:m.lastDate||'', lastKm:(m.lastKm===null||m.lastKm===undefined)?'':m.lastKm}
    : {assetId, id:null, name:'', emoji:'🔧', everyKm:'', everyMonths:'', lastDate: localDateStr(), lastKm: (a.km===null||a.km===undefined)?'':a.km};
  showMaintModal = true; maintModalError = ''; render();
}
function closeMaintModal(){ showMaintModal = false; draftMaint = null; render(); }
function maintModal(){
  const d = draftMaint; if(!d) return '';
  const a = assetById(d.assetId);
  return `
  <div class="overlay" id="maint-overlay">
    <div class="modal">
      <h3 class="navy">${t('svc_maint_new')}</h3>
      <div class="sub">${escapeHtml(a ? a.name : '')} · ${t('svc_maint_sub')}</div>
      <div class="field"><label>${t('svc_asset_icon')}</label>
        <div class="svc-seg">${SVC_MAINT_EMOJIS.map(e=>`<button type="button" class="exit-reason-chip svc-emoji ${d.emoji===e?'on':''}" data-maint-emoji="${e}">${e}</button>`).join('')}</div>
      </div>
      <div class="field"><label for="maint-name">${t('svc_maint_name')}</label>
        <input id="maint-name" type="text" maxlength="60" value="${escapeHtml(d.name)}" placeholder="${t('svc_maint_name_ph')}">
        ${maintModalError ? `<div style="font-size:calc(12px * var(--fs, 1));color:var(--tomato);margin-top:4px;">${maintModalError}</div>` : ''}
      </div>
      <div class="field-row">
        ${/* useOdo() global, no por activo: un camión cargado sin odómetro también
             puede tener su plan "cada 5.000 km" (los km del registro lo inician). */''}
        ${useOdo() ? `<div class="field"><label for="maint-km">${tu('svc_every_km_label')}</label><input id="maint-km" type="number" min="1" step="1" inputmode="numeric" value="${escapeHtml(d.everyKm)}" placeholder="5000"></div>` : ''}
        <div class="field"><label for="maint-months">${t('svc_every_months_label')}</label><input id="maint-months" type="number" min="1" step="1" inputmode="numeric" value="${escapeHtml(d.everyMonths)}" placeholder="3"></div>
      </div>
      <div class="field-row">
        <div class="field"><label for="maint-last">${t('svc_last_done')}</label><input id="maint-last" type="date" value="${escapeHtml(d.lastDate)}"></div>
        ${useOdo() ? `<div class="field"><label for="maint-lastkm">${tu('svc_last_km')}</label><input id="maint-lastkm" type="number" min="0" step="1" inputmode="numeric" value="${escapeHtml(d.lastKm)}" placeholder="—"></div>` : ''}
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" id="btn-cancel-maint">${t('btn_cancel')}</button>
        <button class="btn btn-primary" id="btn-save-maint">${t('btn_save')}</button>
      </div>
      ${d.id ? `<button type="button" class="link-btn" id="btn-delete-maint" style="width:100%;margin-top:6px;color:var(--tomato);">${t('svc_delete_maint')}</button>` : ''}
    </div>
  </div>`;
}
function saveMaintFromDraft(){
  const g = (id)=>document.getElementById(id);
  const d = draftMaint; const a = assetById(d.assetId); if(!a) return false;
  d.name = g('maint-name') ? g('maint-name').value.trim() : '';
  const num = (v, min)=>{ const n = parseFloat(v); return (v!=='' && Number.isFinite(n) && n>=min) ? n : null; };
  // Campos de km ocultos (sin odómetro): se conserva lo que ya tenía el plan.
  const everyKm = g('maint-km') ? num(g('maint-km').value, 1) : num(d.everyKm, 1), everyMonths = num(g('maint-months').value, 1);
  if(!d.name || (!everyKm && !everyMonths)){ maintModalError = useOdo() ? t('svc_maint_err') : t('svc_maint_err_months'); render(); return false; }
  let m = d.id ? (a.maint||[]).find(x=>x.id===d.id) : null;
  if(!m){ m = {id: uid('mt')}; a.maint = a.maint||[]; a.maint.push(m); }
  const lastDate = g('maint-last').value;
  Object.assign(m, {name:d.name, emoji:d.emoji||'🔧', everyKm, everyMonths, lastDate: /^\d{4}-\d{2}-\d{2}$/.test(lastDate) ? lastDate : null, lastKm: g('maint-lastkm') ? num(g('maint-lastkm').value, 0) : num(d.lastKm, 0)});
  saveState();
  return true;
}

/* ---------- MODAL: REGISTRAR MANTENIMIENTO (hecho) ---------- */
function openMaintLogModal(assetId){
  if(!requireWriteAccess()) return;
  const assets = bizProfile.assets||[];
  if(!assets.length) return;
  maintLogAssetId = assetId || assets[0].id;
  const a = assetById(maintLogAssetId);
  const info = a ? assetMaintInfo(a) : null;
  maintLogPlanId = info && info.st.status!=='ok' ? info.plan.id : ((a && a.maint && a.maint[0]) ? a.maint[0].id : '');
  showMaintLogModal = true; maintLogError = ''; render();
}
function closeMaintLogModal(){ showMaintLogModal = false; render(); }
function maintLogModal(){
  const a = assetById(maintLogAssetId); if(!a) return '';
  const assets = bizProfile.assets||[];
  return `
  <div class="overlay" id="maint-log-overlay">
    <div class="modal">
      <h3 class="navy">${t('svc_log_title')}</h3>
      <div class="sub">${t('svc_log_sub')}</div>
      ${assets.length>1 ? `
      <div class="field"><label for="mlog-asset">${t('svc_tool_asset')}</label>
        <select id="mlog-asset">${assets.map(x=>`<option value="${escapeHtml(x.id)}" ${x.id===a.id?'selected':''}>${escapeHtml(x.emoji||'')} ${escapeHtml(x.name)}</option>`).join('')}</select></div>` : ''}
      <div class="field"><label for="mlog-plan">${t('svc_log_which')}</label>
        <select id="mlog-plan">
          ${(a.maint||[]).map(m=>`<option value="${escapeHtml(m.id)}" ${m.id===maintLogPlanId?'selected':''}>${escapeHtml(m.emoji||'')} ${escapeHtml(m.name)}</option>`).join('')}
          <option value="" ${!maintLogPlanId?'selected':''}>${t('svc_log_other')}</option>
        </select></div>
      <div class="field" id="mlog-desc-wrap" ${maintLogPlanId?'hidden':''}><label for="mlog-desc">${t('svc_maint_name')}</label><input id="mlog-desc" type="text" maxlength="60" placeholder="${t('svc_log_desc_ph')}"></div>
      <div class="field-row">
        <div class="field"><label for="mlog-date">${t('lbl_date')}</label><input id="mlog-date" type="date" value="${localDateStr()}"></div>
        ${useOdo() ? `<div class="field"><label for="mlog-km">${tu('svc_log_km')}</label><input id="mlog-km" type="number" min="0" step="1" inputmode="numeric" value="${(a.km===null||a.km===undefined)?'':escapeHtml(a.km)}" placeholder="—"></div>` : ''}
      </div>
      <div class="field"><label for="mlog-cost">${t('svc_log_cost')}</label><input id="mlog-cost" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0.00">
        ${maintLogError ? `<div style="font-size:calc(12px * var(--fs, 1));color:var(--tomato);margin-top:4px;">${maintLogError}</div>` : ''}
      </div>
      <div class="helper-note">${t('svc_log_cost_helper')}</div>
      <div class="modal-actions">
        <button class="btn btn-ghost" id="btn-cancel-maint-log">${t('btn_cancel')}</button>
        <button class="btn btn-primary" id="btn-save-maint-log">${t('svc_log_save')}</button>
      </div>
    </div>
  </div>`;
}
function saveMaintLog(){
  const g = (id)=>document.getElementById(id);
  const a = assetById(maintLogAssetId); if(!a) return false;
  const planId = g('mlog-plan') ? g('mlog-plan').value : '';
  const plan = planId ? (a.maint||[]).find(m=>m.id===planId) : null;
  const desc = g('mlog-desc') ? g('mlog-desc').value.trim() : '';
  const date = (g('mlog-date') && g('mlog-date').value) || localDateStr();
  const kmV = g('mlog-km') ? g('mlog-km').value : '';
  const km = kmV!=='' && Number.isFinite(parseFloat(kmV)) && parseFloat(kmV)>=0 ? parseFloat(kmV) : null;
  const costV = g('mlog-cost') ? g('mlog-cost').value : '';
  const cost = costV!=='' ? parseFloat(costV) : 0;
  if(!plan && !desc){ maintLogError = t('svc_maint_err_name'); render(); return false; }
  if(costV!=='' && !(cost>=0)){ maintLogError = t('manual_spend_err'); render(); return false; }
  svcLogMaintenance(a, {plan, desc, date, km, cost});
  saveState();
  logActivity('maint_logged', a.name, plan ? plan.name : desc);
  showToast(t('svc_logged'));
  return true;
}
/* UN solo registro de "mantenimiento hecho" para el modal y el asistente (app-16
   tenía su copia: movía el plan y creaba el recibo, pero no dejaba rastro en el
   historial — auditoría de la auditoría 2026-09-12). Qué hace: mueve lastDate /
   lastKm del plan y el odómetro del activo SOLO hacia adelante (registrar un
   cambio de aceite de hace dos meses, que faltaba cargar, no puede "retroceder"
   el plan ni el odómetro), crea el recibo si hubo costo y guarda la entrada del
   historial con el NOMBRE del plan copiado en desc: si el plan se borra o se
   renombra después, el historial sigue diciendo qué se hizo. No guarda ni avisa:
   eso lo hace el llamador. Devuelve la entrada creada. */
function svcLogMaintenance(a, o){
  const plan = o.plan || null;
  const desc = String((plan ? plan.name : o.desc)||'').trim().slice(0, 60);
  const date = isValidDateStr(o.date||'') ? o.date : localDateStr();
  const km = (o.km!==null && o.km!==undefined && Number.isFinite(Number(o.km)) && Number(o.km)>=0) ? Number(o.km) : null;
  const cost = Number(o.cost)>0 ? Math.round(Number(o.cost)*100)/100 : 0;
  if(plan){
    if(!plan.lastDate || date>=plan.lastDate){ plan.lastDate = date; if(km!==null) plan.lastKm = km; }
    else if(km!==null && !(plan.lastKm>=km)) plan.lastKm = km;
  }
  if(km!==null && !(Number(a.km)>km)) a.km = km;
  let receiptId = null;
  if(cost>0){
    const catM = expenseCategories.find(c=>/manten|mainten/i.test(c.name));
    receiptId = uid('r');
    receipts.push(Object.assign({ id: receiptId, images: [], supplier: `${desc} · ${a.name}`, date, total: cost,
      itemCount: 0, appliedItems: [], createdAt: new Date().toISOString(), purchaseIds: [], manual: true, manualKind: 'expense',
      expenseCategoryId: catM ? catM.id : null, assetId: a.id }, o.byAgent ? {byAgent: true} : {}));
  }
  // Historial del activo (auditoría 2026-09-12): antes un mantenimiento sin costo
  // —una correa en garantía— no dejaba rastro en ningún lado.
  a.maintLog = a.maintLog || [];
  const entry = { id: uid('ml'), date, planId: plan ? plan.id : null, desc, km, cost, receiptId };
  a.maintLog.unshift(entry);
  if(a.maintLog.length>300) a.maintLog.length = 300;
  return entry;
}

/* ---------- MODAL: SERVICIO (lista de precios) ---------- */
function openServiceModal(serviceId){
  if(!requireWriteAccess()) return;
  const c = serviceId ? serviceById(serviceId) : null;
  draftService = c ? {id:c.id, name:c.name, desc:c.desc||'', price:c.price||'', unit:c.unit||'fixed'} : {id:null, name:'', desc:'', price:'', unit:'fixed'};
  showServiceModal = true; serviceModalError = ''; render();
}
function closeServiceModal(){ showServiceModal = false; draftService = null; render(); }
function serviceModal(){
  const d = draftService; if(!d) return '';
  const units = [['fixed', t('svc_unit_fixed')],['km', tu('svc_unit_km')],['day', t('svc_unit_day')],['hour', t('svc_unit_hour')]];
  return `
  <div class="overlay" id="service-overlay">
    <div class="modal">
      <h3 class="navy">${d.id ? t('svc_service') : t('svc_service_new')}</h3>
      <div class="sub">${t('svc_catalog_sub')}</div>
      <div class="field"><label for="service-name">${t('svc_service_name')}</label>
        <input id="service-name" type="text" maxlength="60" value="${escapeHtml(d.name)}" placeholder="${useOdo() ? t('svc_service_name_ph') : t('svc_service_name_ph_gen')}">
        ${serviceModalError ? `<div style="font-size:calc(12px * var(--fs, 1));color:var(--tomato);margin-top:4px;">${serviceModalError}</div>` : ''}
      </div>
      <div class="field"><label for="service-desc">${t('svc_service_desc')}</label><input id="service-desc" type="text" maxlength="80" value="${escapeHtml(d.desc)}" placeholder="${useOdo() ? t('svc_service_desc_ph') : t('svc_service_desc_ph_gen')}"></div>
      <div class="field-row">
        <div class="field"><label for="service-price">${t('svc_service_price')}</label><input id="service-price" type="number" min="0" step="0.01" inputmode="decimal" value="${escapeHtml(d.price)}" placeholder="0.00"></div>
        <div class="field"><label for="service-unit">${t('svc_unit')}</label><select id="service-unit">${units.map(([v,l])=>`<option value="${v}" ${d.unit===v?'selected':''}>${l}</option>`).join('')}</select></div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" id="btn-cancel-service">${t('btn_cancel')}</button>
        <button class="btn btn-primary" id="btn-save-service">${t('btn_save')}</button>
      </div>
      ${d.id ? `<button type="button" class="link-btn" id="btn-delete-service" style="width:100%;margin-top:6px;color:var(--tomato);">${t('svc_delete_service')}</button>` : ''}
    </div>
  </div>`;
}
function saveServiceFromDraft(){
  const g = (id)=>document.getElementById(id);
  const d = draftService;
  d.name = g('service-name') ? g('service-name').value.trim() : '';
  if(!d.name){ serviceModalError = t('svc_service_err'); render(); return false; }
  const p = parseFloat(g('service-price').value);
  let c = d.id ? serviceById(d.id) : null;
  if(!c){ c = {id: uid('sv')}; bizProfile.catalog.push(c); }
  Object.assign(c, {name:d.name, desc: g('service-desc').value.trim(), price: (Number.isFinite(p) && p>=0) ? p : null, unit: g('service-unit').value||'fixed'});
  saveState();
  return true;
}

/* ---------- CIERRE DE MES: filas del modo Servicios ---------- */
// Se dibuja dentro de cada columna del Cierre (colHtml en app-06): cuántos
// trabajos, el resultado por activo y los gastos por categoría del período.
function svcRecapRows(key, crow){
  if(!usesServices() || !key) return '';
  const inPeriod = d => key.length===4 ? String(d||'').slice(0,4)===key : monthKey(d)===key;
  const jobs = svcJobs().filter(j=>inPeriod(j.date));
  const assets = bizProfile.assets||[];
  let html = '';
  if(jobs.length){
    html += `<div class="recap-note">${t('recap_jobs_n').replace('{jobs}', svcJobsCount(jobs.length))}</div>`;
  }
  // Misma cuenta que la ficha del activo (svcAssetStats): facturado − mercadería − recibos, archivo incluido.
  const perAsset = assets.map(a=>{
    const st = svcAssetStats(a, jobs.filter(j=>j.assetId===a.id), assetReceipts(a.id).filter(r=>inPeriod(r.date)), svcArchivedForAssetPeriod(a.id, inPeriod));
    return {a, net: st.net, any: st.revenue>0 || st.expense>0 || st.cogs>0};
  }).filter(x=>x.any);
  if(perAsset.length){
    html += `<div class="recap-section-title">${t('recap_by_asset')}</div>` + perAsset.map(x=>crow(escapeHtml(x.a.emoji||svcBizEmoji()), escapeHtml(x.a.name), (x.net<0?'−':'+')+money(Math.abs(x.net)), x.net>=0?'var(--money-pos)':'var(--money-neg)')).join('');
  }
  if(key.length===7){
    const cats = expenseByCategoryForMonth(key);
    if(cats.length){
      const total = cats.reduce((s,c)=>s+c.amount,0)||1;
      html += `<div class="recap-section-title">${t('recap_bycat')}</div><div class="bycat" style="margin-top:2px;">` + cats.slice(0,8).map(c=>`
        <div class="bycat-row"><span class="bycat-name">${svcCatEmoji(c.name)} ${escapeHtml(c.name)}</span><span class="bycat-bar"><i style="width:${Math.min(100, Math.max(4, c.amount/total*100)).toFixed(0)}%;background:var(--money-warn);"></i></span><span class="bycat-amt">${money(c.amount)}</span></div>`).join('') + `</div>`;
    }
  }
  return html;
}

/* ---------- AJUSTES: tarjetas ---------- */
function svcSettingsBizCard(){
  const row = (id, label, sub, on)=>`
        <div class="pulse-row">
          <div class="pulse-text"><b>${label}</b><small>${sub}</small></div>
          <span class="pulse-state">${on ? t('switch_on') : t('switch_off')}</span>
          <label class="pulse-switch" aria-label="${label}">
            <input type="checkbox" id="${id}" ${on?'checked':''}>
            <i></i>
          </label>
        </div>`;
  return `
      <div class="settings-card">
        ${settingsCardHeader('box','var(--navy-wash)','var(--navy)',t('settings_biz_title'))}
        <div class="svc-biz-rows">
        ${row('biz-sells-toggle', t('biz_sells'), t('biz_sells_sub'), sellsProducts())}
        ${row('production-tab-toggle', t('biz_makes'), t('biz_makes_sub'), usesProduction())}
        ${row('biz-services-toggle', t('biz_services'), t('biz_services_sub'), usesServices())}
        </div>
      </div>`;
}
function svcSettingsServicesCard(){
  if(!usesServices()) return '';
  return `
      <div class="settings-card">
        ${settingsCardHeader('tag','var(--navy-wash)','var(--navy)',t('settings_services_title'))}
        <div class="pulse-row" style="margin-top:0;padding-top:0;border-top:0;">
          <div class="pulse-text"><b>${t('svc_set_remind')}</b><small>${t('svc_set_remind_sub')}</small></div>
          <span class="pulse-state">${bizProfile.remindOverdue!==false ? t('switch_on') : t('switch_off')}</span>
          <label class="pulse-switch" aria-label="${t('svc_set_remind')}">
            <input type="checkbox" id="svc-remind-toggle" ${bizProfile.remindOverdue!==false?'checked':''}>
            <i></i>
          </label>
        </div>
        <div class="field" style="margin:12px 0 0;">
          <label for="svc-maint-days">${t('svc_set_maint_days')}</label>
          <select id="svc-maint-days">${[3,7,14,30].map(n=>`<option value="${n}" ${bizProfile.maintDays===n?'selected':''}>${t('svc_days_before').replace('{n}', String(n))}</option>`).join('')}</select>
        </div>
        <div class="field" style="margin:12px 0 0;">
          <label for="svc-remind-days">${t('svc_set_remind_days')}</label>
          <select id="svc-remind-days">${[0,1,3,7].map(n=>`<option value="${n}" ${bizProfile.remindDays===n?'selected':''}>${n===0 ? t('svc_remind_same_day') : t('svc_days_before').replace('{n}', String(n))}</option>`).join('')}</select>
        </div>
        <div class="pulse-row">
          <div class="pulse-text"><b>${t('svc_set_odo')}</b><small>${t('svc_set_odo_sub')}</small></div>
          <span class="pulse-state">${useOdo() ? t('switch_on') : t('switch_off')}</span>
          <label class="pulse-switch" aria-label="${t('svc_set_odo')}">
            <input type="checkbox" id="svc-odo-toggle" ${useOdo()?'checked':''}>
            <i></i>
          </label>
        </div>
        ${useOdo() ? `
        <div class="field" style="margin:12px 0 0;">
          <label for="svc-dist-unit">${t('svc_set_dist')}</label>
          <select id="svc-dist-unit"><option value="km" ${distU()==='km'?'selected':''}>${t('svc_unit_km_long')}</option><option value="mi" ${distU()==='mi'?'selected':''}>${t('svc_unit_mi_long')}</option></select>
        </div>` : ''}
        ${/* Cotizaciones (app-17): defaults que cada cotización nueva trae puestos. */''}
        <div class="field-row" style="margin-top:12px;">
          <div class="field" style="margin:0;"><label for="svc-tax-pct">${t('qt_set_tax')}</label><input id="svc-tax-pct" type="number" min="0" max="100" step="0.01" inputmode="decimal" value="${bizProfile.taxPct ? escapeHtml(String(bizProfile.taxPct)) : ''}" placeholder="0"></div>
          <div class="field" style="margin:0;"><label for="svc-quote-valid">${t('qt_set_valid')}</label><select id="svc-quote-valid">${[7,15,30,60].map(n=>`<option value="${n}" ${(bizProfile.quoteValidDays||15)===n?'selected':''}>${t('qt_days').replace('{n}', String(n))}</option>`).join('')}</select></div>
        </div>
        <div class="field" style="margin:12px 0 0;"><label for="svc-quote-terms">${t('qt_set_terms')}</label><input id="svc-quote-terms" type="text" maxlength="200" value="${escapeHtml(bizProfile.quoteTerms||'')}" placeholder="${t('qt_set_terms_ph')}"></div>
        <div style="display:flex;flex-direction:column;gap:8px;margin-top:12px;">
          <button class="btn btn-ghost btn-sm" id="btn-svc-catalog">${t('svc_set_catalog')}</button>
          <button class="btn btn-ghost btn-sm" id="btn-svc-clients">${t('cl_set_btn')}</button>
          <button class="btn btn-ghost btn-sm" id="btn-svc-categories">${t('svc_set_categories')}</button>
        </div>
      </div>`;
}

/* ---------- WhatsApp ---------- */
function svcWhatsappReminder(j){
  const msg = t('svc_wa_msg').replace('{client}', j.client||'').replace('{service}', j.serviceName||t('svc_job_edit').toLowerCase()).replace('{date}', svcShortDate(j.date)).replace('{amount}', money(j.price||0));
  // Con el teléfono guardado del cliente (app-17) el chat abre directo, como la
  // cotización; sin él, el selector de contactos de WhatsApp.
  const cl = (typeof clientByName==='function') ? clientByName(j.client) : null;
  const digits = (cl && typeof clientPhoneDigits==='function') ? clientPhoneDigits(cl) : '';
  const url = 'https://wa.me/'+(digits||'')+'?text='+encodeURIComponent(msg);
  try{ window.open(url, '_blank', 'noopener'); }catch(e){ location.href = url; }
}

// Abrir/cerrar una hoja con el MISMO fundido que la hoja de Recibos (View
// Transition, ver openReceiptsSheet en app-07); sin soporte, redibuja y listo.
function svcShow(fn){
  fn();
  if(document.startViewTransition){
    // Si el navegador la aborta (pestaña oculta, otra transición encima) el
    // redibujo ya pasó igual: solo se silencia la promesa rechazada.
    // Con la app en segundo plano el navegador la aborta SIN correr el redibujo
    // (visto en pruebas): se redibuja a mano para no dejar el estado a medias.
    if(document.visibilityState==='hidden'){ render(); return; }
    let drawn = false;
    const vt = document.startViewTransition(()=>{ drawn = true; render(); });
    try{ vt.ready.catch(()=>{}); vt.finished.catch(()=>{}); vt.updateCallbackDone.catch(()=>{ if(!drawn) render(); }); }catch(e){}
    return;
  }
  render();
}

/* ---------- EVENTOS ---------- */
function attachServicesEvents(){
  const g = (id)=>document.getElementById(id);
  const on = (id, fn)=>{ const el = g(id); if(el) el.onclick = fn; };
  const overlayClose = (id, fn)=>{ const ov = g(id); if(ov) ov.onmousedown = (e)=>{ if(e.target===ov) fn(); }; };

  /* Dashboard */
  on('btn-new-job', ()=>openJobModal(null));
  on('btn-svc-spend', ()=>openManualSpendModal());
  on('btn-svc-jobs', ()=>svcShow(()=>{ showJobsSheet = true; }));
  on('btn-svc-collect', ()=>svcShow(()=>{ showCollectSheet = true; }));
  on('btn-collect-alert', ()=>svcShow(()=>{ showCollectSheet = true; }));
  on('btn-maint-alert', ()=>{ if(TAB_ORDER[1]==='equipo'){ switchToTab('equipo'); return; } svcShow(()=>{ showEquipoSheet = true; }); });
  on('btn-svc-maint', ()=>{
    // Abre Equipo (pestaña u hoja): ahí está cada activo con su estado.
    if(TAB_ORDER[1]==='equipo'){ switchToTab('equipo'); return; }
    svcShow(()=>{ showEquipoSheet = true; });
  });
  on('btn-svc-equipo', ()=>svcShow(()=>{ showEquipoSheet = true; }));

  /* Equipo y activos */
  on('btn-new-asset', ()=>openAssetModal(null));
  on('btn-scan-fab-equipo', ()=>openScanModal());
  on('btn-log-maint', ()=>openMaintLogModal(null));
  // Buscadores: mismo mecanismo que el del Inventario (render diferido y foco
  // devuelto con el cursor donde estaba), para que no parpadee al escribir.
  const searchLive = (inp, set)=>{ inp.oninput = (e)=>{ const pos = e.target.selectionStart; set(e.target.value); scheduleSearchTriggeredRender(()=>{ const fresh = document.getElementById(inp.id); if(fresh){ fresh.focus(); try{ fresh.setSelectionRange(pos,pos); }catch(err){} } }); }; };
  const es = g('equipo-search');
  if(es) searchLive(es, v=>{ equipoSearch = v; });
  document.querySelectorAll('[data-open-asset]').forEach(el=>{ el.onclick = ()=>svcShow(()=>{ showAssetSheet = el.dataset.openAsset; assetSheetMonth = null; assetSheetShowAllMaint = false; }); });
  on('btn-clear-receipts-asset', ()=>{ receiptsAssetFilter = null; render(); });
  const closeEquipo = ()=>svcShow(()=>{ showEquipoSheet = false; });
  overlayClose('equipo-sheet-overlay', closeEquipo);
  on('btn-close-equipo-sheet', closeEquipo);

  /* Ficha de activo */
  const closeAsset = ()=>svcShow(()=>{ showAssetSheet = null; });
  overlayClose('asset-sheet-overlay', closeAsset);
  on('btn-close-asset-sheet', closeAsset);
  on('btn-edit-asset', ()=>openAssetModal(showAssetSheet));
  on('btn-add-maint', ()=>openMaintModal(showAssetSheet, null));
  on('btn-asset-log-maint', ()=>openMaintLogModal(showAssetSheet));
  on('btn-asset-new-job', ()=>openJobModal(null, showAssetSheet));
  on('btn-print-asset', ()=>{ const a = assetById(showAssetSheet); if(a) downloadAssetPdf(a); });
  on('btn-asset-prev-month', ()=>{ assetSheetMonth = shiftMonthStr(assetSheetKey(), -1); render(); });
  on('btn-asset-next-month', ()=>{ const k = shiftMonthStr(assetSheetKey(), 1); assetSheetMonth = k>=localMonthStr() ? null : k; render(); });
  on('btn-asset-all-maint', ()=>{ assetSheetShowAllMaint = !assetSheetShowAllMaint; render(); });
  // Gasto directo del activo (seguro, patente, reparación) sin pasar por un trabajo:
  // el próximo recibo que se cree queda colgado de ESTE activo (receiptAttach).
  on('btn-asset-scan', ()=>{ if(!requireWriteAccess()) return; receiptAttach = {jobId: null, assetId: showAssetSheet}; openScanModal(); if(!showScanModal){ receiptAttach = null; } });
  on('btn-asset-spend', ()=>{ if(!requireWriteAccess()) return; receiptAttach = {jobId: null, assetId: showAssetSheet}; openManualSpendModal(); if(!showManualSpendModal){ receiptAttach = null; } });
  // "Ver todos": se cierran las DOS hojas (activo y Equipo) y se redibuja ANTES de
  // cambiar de pestaña — switchToTab solo anima el carrusel y no toca los overlays,
  // así que sin el render() la ficha quedaba tapando Recibos (auditoría UX
  // 2026-09-11). Y el destino va FILTRADO por este activo (auditoría 2026-09-12:
  // antes abría la lista general del negocio, sin marca de cuáles eran del activo).
  on('btn-asset-all-receipts', ()=>{
    receiptsAssetFilter = showAssetSheet; receiptSearchQuery = ''; receiptsShownLimit = RECEIPTS_WINDOW_STEP;
    try{ localStorage.removeItem('patron_receipt_search'); }catch(e){}
    showAssetSheet = null; showEquipoSheet = false; render(); openReceiptsSheet({keepAssetFilter: true});
  });
  on('btn-asset-all-jobs', ()=>{
    jobsAssetFilter = showAssetSheet; jobsSearch = ''; jobsShownLimit = JOBS_WINDOW_STEP;
    showAssetSheet = null; showEquipoSheet = false;
    svcShow(()=>{ showJobsSheet = true; });
  });
  document.querySelectorAll('[data-edit-maint]').forEach(el=>{ el.onclick = ()=>openMaintModal(showAssetSheet, el.dataset.editMaint); });

  /* Por cobrar */
  const closeCollect = ()=>svcShow(()=>{ showCollectSheet = false; });
  overlayClose('collect-sheet-overlay', closeCollect);
  on('btn-close-collect-sheet', closeCollect);
  document.querySelectorAll('[data-wa-job]').forEach(b=>{ b.onclick = (e)=>{ e.stopPropagation(); const j = jobById(b.dataset.waJob); if(j) svcWhatsappReminder(j); }; });
  document.querySelectorAll('[data-paid-job]').forEach(b=>{ b.onclick = (e)=>{
    e.stopPropagation();
    if(!requireWriteAccess()) return;
    const j = jobById(b.dataset.paidJob); if(!j) return;
    markJobPaid(j);
    saveState(); logActivity('job_paid', j.client, money(j.price||0)); showToast(t('svc_marked_paid')); render();
  }; });
  document.querySelectorAll('[data-open-job]').forEach(el=>{ el.onclick = ()=>openJobModal(el.dataset.openJob); });

  /* Trabajos */
  const closeJobs = ()=>svcShow(()=>{ showJobsSheet = false; jobsAssetFilter = null; });
  overlayClose('jobs-sheet-overlay', closeJobs);
  on('btn-close-jobs-sheet', closeJobs);
  on('btn-jobs-new', ()=>openJobModal(null));
  on('btn-jobs-show-more', ()=>{ jobsShownLimit += JOBS_WINDOW_STEP; render(); });
  on('btn-clear-jobs-asset', ()=>{ jobsAssetFilter = null; jobsShownLimit = JOBS_WINDOW_STEP; render(); });
  const js = g('jobs-search');
  if(js) searchLive(js, v=>{ jobsSearch = v; jobsShownLimit = JOBS_WINDOW_STEP; });

  /* Mis servicios */
  const closeServices = ()=>svcShow(()=>{ showServicesSheet = false; reopenSettingsIfPending(); });
  overlayClose('services-sheet-overlay', closeServices);
  on('btn-close-services-sheet', closeServices);
  on('btn-service-new', ()=>openServiceModal(null));
  document.querySelectorAll('[data-edit-service]').forEach(el=>{ el.onclick = ()=>openServiceModal(el.dataset.editService); });
  overlayClose('service-overlay', closeServiceModal);
  on('btn-cancel-service', closeServiceModal);
  on('btn-save-service', ()=>{ if(saveServiceFromDraft()) closeServiceModal(); });
  on('btn-delete-service', ()=>{
    if(!confirm(t('svc_delete_confirm'))) return;
    bizProfile.catalog = bizProfile.catalog.filter(c=>c.id!==draftService.id);
    saveState(); closeServiceModal();
  });

  /* Modal de trabajo */
  overlayClose('job-overlay', closeJobModalAsk);
  on('btn-cancel-job', closeJobModalAsk);
  on('btn-save-job', ()=>{ if(!requireWriteAccess()) return; if(saveJobFromDraft()){ showToast(svcLastPruned>0 ? t('svc_job_saved')+' · '+t('svc_children_pruned').replace('{n}', String(svcLastPruned)) : t('svc_job_saved')); closeJobModal(); } });
  // Imprimir guarda primero: la cuenta sale con lo que el usuario ve en pantalla,
  // no con la copia vieja (auditoría 2026-09-12).
  on('btn-print-job', ()=>{
    // Solo lectura: se imprime la copia guardada sin abrir el paywall. Con permiso
    // se guarda primero (lo que se ve es lo que sale) y se redibuja el modal.
    let j = null;
    if(typeof accessLocked==='function' && accessLocked()) j = jobById(draftJob.id);
    else { j = saveJobFromDraft(); if(j) render(); }
    if(j) downloadJobPdf(j);
  });
  on('btn-delete-job', ()=>{
    if(!requireWriteAccess()) return;
    if(!confirm(t('svc_job_delete_confirm'))) return;
    const j = jobById(draftJob.id);
    let pruned = 0, restocked = 0;
    if(j){ ({pruned, restocked} = deleteJob(j)); saveState(); logActivity('job_deleted', j.client); }
    let msg = restocked>0 ? t('svc_job_deleted_stock') : t('svc_job_deleted');
    if(pruned>0) msg += ' · '+t('svc_children_pruned').replace('{n}', String(pruned));
    showToast(msg); closeJobModal();
  });
  if(draftJob){
    const price = g('job-price');
    const refresh = ()=>{ readJobDraftFromDom(); const el = g('svc-job-profit'); if(el) el.innerHTML = jobProfitHtml(); };
    if(price) price.oninput = refresh;
    const svc = g('job-service');
    if(svc) svc.oninput = ()=>{
      // Servicio de la lista: por trabajo completa el precio si está vacío; por
      // hora/día/km aparece el campo de cantidad (redibujo con el cursor donde estaba).
      const before = svcJobUnitService(draftJob);
      const c = (bizProfile.catalog||[]).find(x=>x.name.toLowerCase()===svc.value.trim().toLowerCase());
      if(c && c.price>0 && (!c.unit || c.unit==='fixed') && price && !price.value){ price.value = String(c.price); }
      refresh();
      const after = svcJobUnitService(draftJob);
      if((before && before.id)!==(after && after.id)){
        const pos = svc.selectionStart;
        scheduleSearchTriggeredRender(()=>{ const fresh = document.getElementById('job-service'); if(fresh){ fresh.focus(); try{ fresh.setSelectionRange(pos,pos); }catch(err){} } });
      }
    };
    const qtyI = g('job-qty');
    if(qtyI) qtyI.oninput = ()=>{
      readJobDraftFromDom();
      const u = svcJobUnitService(draftJob); const q = parseFloat(draftJob.qty);
      if(u && q>0 && price) price.value = String(Math.round(q*u.price*100)/100);
      refresh();
      const hint = g('svc-job-unit-hint'); if(hint) hint.innerHTML = svcJobUnitHint(draftJob);
    };
    document.querySelectorAll('[data-job-asset]').forEach(b=>{ b.onclick = ()=>{ readJobDraftFromDom(); draftJob.assetId = b.dataset.jobAsset || null; render(); }; });
    document.querySelectorAll('[data-job-paid]').forEach(b=>{ b.onclick = ()=>{ readJobDraftFromDom(); draftJob.paid = b.dataset.jobPaid==='1'; render(); }; });
    document.querySelectorAll('[data-job-repeat]').forEach(b=>{ b.onclick = ()=>{ readJobDraftFromDom(); draftJob.repeat = b.dataset.jobRepeat || null; render(); }; });
    const due = g('job-due');
    if(due) due.onchange = ()=>{ readJobDraftFromDom(); render(); };
    const pd = g('job-paid-date');
    if(pd) pd.onchange = ()=>{ draftJob.paidDate = pd.value; };
    // Cambió la fecha: el "hasta" (min) y la fecha de cobro por defecto la siguen.
    const dateI = g('job-date');
    if(dateI) dateI.onchange = ()=>{ readJobDraftFromDom(); render(); };
    on('btn-job-exp-open', ()=>{ readJobDraftFromDom(); jobExpenseFormOpen = true; render(); });
    on('btn-job-exp-add', ()=>{
      if(!requireWriteAccess()) return;
      readJobDraftFromDom();
      const amt = parseFloat((g('job-exp-amount')||{}).value);
      if(!(amt>0)){ showToast(t('manual_spend_err'), 'error'); return; }
      draftJob.pending.push({desc: (g('job-exp-desc')||{}).value.trim(), amount: amt, categoryId: g('job-exp-cat') ? g('job-exp-cat').value||null : null});
      jobExpenseFormOpen = false; render();
    });
    document.querySelectorAll('[data-job-exp-del]').forEach(b=>{ b.onclick = ()=>{ readJobDraftFromDom(); draftJob.pending.splice(parseInt(b.dataset.jobExpDel,10), 1); render(); }; });
    on('btn-job-scan', ()=>{
      if(!requireWriteAccess()) return;
      // El recibo escaneado se cuelga de ESTE trabajo: se guarda primero.
      const job = saveJobFromDraft(); if(!job) return;
      receiptAttach = {jobId: job.id, assetId: job.assetId||null};
      showJobModal = false; draftJob = null; jobExpenseFormOpen = false;
      openScanModal();
      // Si el escáner no abrió (sesión vencida, cupo), el enganche no puede quedar
      // esperando al próximo gasto que se cargue desde cualquier otro lado.
      if(!showScanModal){ receiptAttach = null; render(); }
    });
  }

  /* Modal de activo */
  overlayClose('asset-overlay', closeAssetModal);
  on('btn-cancel-asset', closeAssetModal);
  on('btn-save-asset', ()=>{ if(saveAssetFromDraft()) closeAssetModal(); });
  on('btn-delete-asset', ()=>{
    const a = assetById(draftAsset.id); if(!a) return;
    // Cuántos trabajos y recibos quedan sin activo: el usuario decide sabiendo.
    const nj = svcJobs().filter(j=>j.assetId===a.id).length, nr = assetReceipts(a.id).length;
    const msg = t('svc_asset_delete_confirm').replace('{name}', a.name) + ((nj||nr) ? ' '+t('svc_asset_delete_orphans').replace('{j}', String(nj)).replace('{r}', String(nr)) : '');
    if(!confirm(msg)) return;
    bizProfile.assets = bizProfile.assets.filter(x=>x.id!==a.id);
    if(showAssetSheet===a.id) showAssetSheet = null;
    saveState(); closeAssetModal();
  });
  document.querySelectorAll('[data-asset-emoji]').forEach(b=>{ b.onclick = ()=>{ draftAsset.emoji = b.dataset.assetEmoji; document.querySelectorAll('[data-asset-emoji]').forEach(x=>x.classList.toggle('on', x===b)); }; });

  /* Modal de mantenimiento programado */
  overlayClose('maint-overlay', closeMaintModal);
  on('btn-cancel-maint', closeMaintModal);
  on('btn-save-maint', ()=>{ if(saveMaintFromDraft()) closeMaintModal(); });
  on('btn-delete-maint', ()=>{
    const a = assetById(draftMaint.assetId); if(!a) return;
    if(!confirm(t('svc_maint_delete_confirm'))) return;
    a.maint = (a.maint||[]).filter(m=>m.id!==draftMaint.id);
    saveState(); closeMaintModal();
  });
  document.querySelectorAll('[data-maint-emoji]').forEach(b=>{ b.onclick = ()=>{ draftMaint.emoji = b.dataset.maintEmoji; document.querySelectorAll('[data-maint-emoji]').forEach(x=>x.classList.toggle('on', x===b)); }; });

  /* Registrar mantenimiento */
  overlayClose('maint-log-overlay', closeMaintLogModal);
  on('btn-cancel-maint-log', closeMaintLogModal);
  on('btn-save-maint-log', ()=>{ if(saveMaintLog()) closeMaintLogModal(); });
  const mla = g('mlog-asset');
  if(mla) mla.onchange = ()=>{ maintLogAssetId = mla.value; const a = assetById(maintLogAssetId); maintLogPlanId = (a && a.maint && a.maint[0]) ? a.maint[0].id : ''; render(); };
  const mlp = g('mlog-plan');
  if(mlp) mlp.onchange = ()=>{ maintLogPlanId = mlp.value; const w = g('mlog-desc-wrap'); if(w) w.hidden = !!maintLogPlanId; };

  /* Ajustes */
  const sellsT = g('biz-sells-toggle');
  if(sellsT) sellsT.onchange = ()=>setBizFlags(sellsT.checked, usesServices());
  const svcT = g('biz-services-toggle');
  if(svcT) svcT.onchange = ()=>setBizFlags(sellsProducts(), svcT.checked);
  const remT = g('svc-remind-toggle');
  if(remT) remT.onchange = ()=>{ bizProfile.remindOverdue = !!remT.checked; saveState(); render(); };
  const md = g('svc-maint-days');
  if(md) md.onchange = ()=>{ bizProfile.maintDays = parseInt(md.value,10)||7; saveState(); render(); };
  const rdays = g('svc-remind-days');
  if(rdays) rdays.onchange = ()=>{ bizProfile.remindDays = parseInt(rdays.value,10)||0; saveState(); render(); };
  const odo = g('svc-odo-toggle');
  if(odo) odo.onchange = ()=>{ bizProfile.useOdometer = !!odo.checked; saveState(); render(); };
  const du = g('svc-dist-unit');
  if(du) du.onchange = ()=>{ bizProfile.distUnit = du.value==='mi' ? 'mi' : 'km'; saveState(); render(); };
  // Defaults de cotización (app-17): se guardan al confirmar el campo, sin Guardar.
  const taxI = g('svc-tax-pct');
  if(taxI) taxI.onchange = ()=>{ const n = parseFloat(taxI.value); bizProfile.taxPct = (Number.isFinite(n) && n>=0 && n<=100) ? Math.round(n*100)/100 : 0; saveState(); render(); };
  const qv = g('svc-quote-valid');
  if(qv) qv.onchange = ()=>{ bizProfile.quoteValidDays = parseInt(qv.value,10)||15; saveState(); };
  const qterms = g('svc-quote-terms');
  if(qterms) qterms.onchange = ()=>{ bizProfile.quoteTerms = qterms.value.trim().slice(0,200); saveState(); };
  on('btn-svc-catalog', ()=>svcShow(()=>{ settingsReturnPending = true; showAlertSettingsModal = false; showServicesSheet = true; }));
  on('btn-svc-categories', ()=>svcShow(()=>{ settingsReturnPending = true; showAlertSettingsModal = false; showExpenseCatsSheet = true; }));
  /* Categorías de gasto */
  const closeXcats = ()=>svcShow(()=>{ showExpenseCatsSheet = false; reopenSettingsIfPending(); });
  overlayClose('xcats-sheet-overlay', closeXcats);
  on('btn-close-xcats-sheet', closeXcats);
  on('btn-xcat-add', ()=>{ if(!requireWriteAccess()) return; expenseCategories.push({id: uid('xcat'), name: t('svc_xcat_new_name')}); saveState(); render(); });
  document.querySelectorAll('[data-xcat-name]').forEach(inp=>{ inp.onchange = ()=>{ const c = expenseCategories.find(x=>x.id===inp.dataset.xcatName); const v = inp.value.trim(); if(!c) return; if(!v){ inp.value = c.name; return; } c.name = v; saveState(); }; });
  document.querySelectorAll('[data-xcat-del]').forEach(b=>{ b.onclick = ()=>{
    if(!requireWriteAccess()) return;
    const c = expenseCategories.find(x=>x.id===b.dataset.xcatDel); if(!c) return;
    const used = receipts.filter(r=>r && r.expenseCategoryId===c.id).length;
    if(!confirm(t('svc_xcat_del_confirm').replace('{name}', c.name).replace('{n}', String(used)))) return;
    expenseCategories = expenseCategories.filter(x=>x.id!==c.id);
    if(budgetMeta && budgetMeta.byCategory) delete budgetMeta.byCategory[c.id];
    saveState(); render();
  }; });
}

/* ================= CALENDARIO, AVISOS, MILLAS E IMPRESIÓN (2026-09-11, 2.ª tanda) =================
   Pedido del usuario: "cada nuevo servicio debe ir al calendario y el calendario
   debe mandar una alerta de cuándo esa factura se tiene que pagar; los
   mantenimientos deben incluir millas y avisar; todo lo de facturación y
   reportes tiene que poder imprimirse". */

/* ---------- unidad de distancia ---------- */
// km o millas: solo cambia la etiqueta; los números se guardan como se escriben.
// ¿Este equipo lleva kilómetros? Global (Ajustes) y, por activo, solo si tiene
// odómetro cargado. Apagado, todo lo de km desaparece de los formularios.
function useOdo(asset){ return bizProfile.useOdometer!==false && (!asset || (asset.km!==null && asset.km!==undefined)); }
function distU(){ return (bizProfile && bizProfile.distUnit==='mi') ? 'mi' : 'km'; }
function tu(key){ return t(key).replace('{u}', distU()); }

/* ---------- calendario: trabajos, cobros y mantenimientos como notas ----------
   Cada trabajo aparece el día que se hace (🚚), cada cobro pendiente el día que
   vence (💵) y cada mantenimiento por meses el día que toca (🔧). Son notas del
   calendario de siempre (calNotes: se ven en los puntitos, en el modal del día y
   viajan al equipo), con id fijo por origen para actualizarlas en vez de
   duplicarlas. Si el usuario borra una a mano queda su lápida y no se vuelve a
   crear. Corre al principio de cada saveState (idempotente y barato). */
function svcNoteId(kind, a, b){ return 'svc-'+kind+'-'+a+(b ? '-'+b : ''); }
function svcSyncCalendar(){
  if(!usesServices()) return false;
  const want = new Map();
  const today = localDateStr();
  svcJobs().forEach(j=>{
    // Ícono del equipo/servicio, no siempre un camión; un trabajo de varios días
    // dice "hasta el 15" el día que empieza y tiene su nota el día que termina.
    if(j.date) want.set(svcNoteId('job', j.id), {text: `${j.client||''}${j.serviceName ? ' · '+j.serviceName : ''}${j.endDate ? ' · '+t('svc_until').replace('{d}', svcShortDate(j.endDate)) : ''}`, date: j.date, icon: svcJobEmoji(j), jobId: j.id, svcKind: 'job'});
    if(j.date && j.endDate && j.endDate>j.date) want.set(svcNoteId('end', j.id), {text: t('svc_note_end').replace('{client}', j.client||'')+(j.serviceName ? ' · '+j.serviceName : ''), date: j.endDate, icon: '🏁', jobId: j.id, svcKind: 'job'});
    /* 'cobro' y no 'due' (auditoría de datos 2026-09-12): la versión anterior de
       esta función ENTERRABA la nota del cobro al marcar el trabajo cobrado, así
       que las cuentas que ya usaban Servicios tienen lápidas 'svc-due-*'
       guardadas de antes de esa corrección — y una lápida no se puede quitar
       (viaja por unión). Cambiar el nombre del id deja esas lápidas viejas sin
       efecto (las 'svc-due-*' que queden se retiran solas más abajo, como
       cualquier nota derivada que ya no corresponde). */
    if(!j.paid && j.dueDate) want.set(svcNoteId('cobro', j.id), {text: t('svc_note_due').replace('{client}', j.client||'').replace('{amount}', money(j.price||0)), date: j.dueDate, icon: '💵', jobId: j.id, svcKind: 'due'});
  });
  (bizProfile.assets||[]).forEach(a=>(a.maint||[]).forEach(m=>{
    const st = svcMaintStatus(m, a, today);
    if(st.dueDate) want.set(svcNoteId('mt', a.id, m.id), {text: `${m.name} · ${a.name}`, date: st.dueDate, icon: m.emoji||'🔧', assetId: a.id, planId: m.id, svcKind: 'maint'});
  }));
  // Cotizaciones abiertas (app-17): el día que vencen (📄). La nota desaparece
  // sola al aceptarla, rechazarla, borrarla o vencer — misma plomería que los cobros.
  if(typeof svcQuotes==='function') svcQuotes().forEach(q=>{
    if(!quoteIsOpen(q)) return;
    want.set(svcNoteId('qt', q.id), {text: t('svc_note_quote').replace('{num}', quoteNum(q)).replace('{client}', q.client||''), date: quoteValidUntil(q), icon: '📄', quoteId: q.id, svcKind: 'quote'});
  });
  let changed = false;
  /* Las notas svc-* son DERIVADAS: se regeneran acá, desde los trabajos, activos
     y cotizaciones, en cada guardado. Por eso, cuando una deja de corresponder
     (el trabajo se cobró, la cotización se aceptó) se quita SIN lápida —
     auditoría de datos 2026-09-12: antes se enterraba, y si el estado volvía
     atrás ("no, todavía no me pagaron") el cobro no volvía nunca más al
     calendario ni a la agenda: su id fijo ya estaba en deletedCalNoteIds, y una
     lápida no se puede quitar. La lápida queda solo para lo que el usuario borra
     a mano (app-09 / app-16): eso sí no se vuelve a crear. Un dispositivo
     desactualizado que re-suba una nota vieja no la resucita de verdad: su propio
     saveState la vuelve a quitar apenas aplica el snapshot, porque el trabajo
     del que salía ya no la pide. */
  const byId = new Map();
  calNotes = calNotes.filter(n=>{
    if(!n) return false;
    /* Se retira SIN lápida: la quitó el dato (cobro hecho, trabajo borrado, plan
       cumplido), no el usuario. Con lápida, des-cobrar un trabajo por error nunca
       recuperaba su nota 💵 del calendario (auditoría 2026-09-12). Cada
       dispositivo retira la misma nota al aplicar el mismo dato, así que la nube
       converge igual; la lápida queda para lo que el usuario borra a mano. */
    if(!n.svcKind || want.has(n.id)){ if(n.id) byId.set(n.id, n); return true; }
    changed = true;
    return false;
  });
  const tombs = new Set(deletedCalNoteIds);
  want.forEach((w, id)=>{
    if(tombs.has(id)) return;
    const ex = byId.get(id);
    if(ex){
      if(ex.text!==w.text || ex.date!==w.date || ex.icon!==w.icon){ Object.assign(ex, w); changed = true; }
      return;
    }
    calNotes.push(Object.assign({id, hour: null, minute: null, recurring: null, anchorDate: null, createdAt: new Date().toISOString()}, w));
    changed = true;
  });
  return changed;
}

/* ---------- avisos: toast una vez por día, tarjeta en el Dashboard ---------- */
function checkServiceAlerts(){
  if(typeof budgetAlertsArmed==='undefined' || !budgetAlertsArmed || !usesServices()) return;
  try{
    const today = localDateStr();
    let map = {}; try{ map = JSON.parse(localStorage.getItem('patron_svc_alerted')||'{}'); }catch(e){}
    const msgs = [];
    const cs = collectStats();
    const dueToday = cs.list.filter(j=>j.dueDate===today);
    // Tres avisos independientes, cada uno una vez por día: antes eran un
    // if/else if y, con un cobro vencido, los de "vencen en N días" y "vencen hoy"
    // no salían nunca ese día (auditoría 2026-09-12).
    if(cs.overdueCount && map.due!==today){ msgs.push([t('svc_toast_overdue').replace('{n}', String(cs.overdueCount)).replace('{amount}', money(cs.overdue)), 'error']); map.due = today; }
    if(bizProfile.remindDays>0 && map.dueSoon!==today && cs.list.some(j=>j.dueDate && j.dueDate>today && j.dueDate<=addDaysStr(today, bizProfile.remindDays))){
      const soon = cs.list.filter(j=>j.dueDate && j.dueDate>today && j.dueDate<=addDaysStr(today, bizProfile.remindDays));
      msgs.push([t('svc_toast_due_soon').replace('{n}', String(soon.length)).replace('{days}', String(bizProfile.remindDays)).replace('{amount}', money(soon.reduce((s,j)=>s+(Number(j.price)||0),0))), 'info']); map.dueSoon = today;
    }
    if(dueToday.length && map.dueToday!==today){ msgs.push([t('svc_toast_due_today').replace('{n}', String(dueToday.length)).replace('{amount}', money(dueToday.reduce((s,j)=>s+(Number(j.price)||0),0))), 'info']); map.dueToday = today; }
    const mo = svcMaintOverview();
    if(mo.overdue.length && map.maint!==today){ const f = mo.overdue[0]; msgs.push([t('svc_toast_maint_overdue').replace('{what}', `${f.plan.name} · ${f.asset.name}`).replace('{n}', String(mo.overdue.length)), 'error']); map.maint = today; }
    else if(mo.soon.length && map.maintSoon!==today){ const f = mo.soon[0]; msgs.push([t('svc_toast_maint_soon').replace('{what}', `${f.plan.name} · ${f.asset.name}`).replace('{when}', svcMaintWhen(f.st)), 'info']); map.maintSoon = today; }
    if(msgs.length) try{ localStorage.setItem('patron_svc_alerted', JSON.stringify(map)); }catch(e){}
    msgs.forEach((m, i)=>setTimeout(()=>showToast(m[0], m[1]), i*2400));
  }catch(e){}
}
// Tarjeta de mantenimiento (misma que la del presupuesto): vencido en rojo,
// pronto en amarillo. Abre Equipo, donde está cada activo con su estado.
function svcMaintCard(){
  if(!usesServices()) return '';
  const mo = svcMaintOverview();
  const f = mo.overdue[0] || mo.soon[0];
  if(!f) return '';
  const over = mo.overdue.length>0;
  const title = over ? t('svc_maint_card_over').replace('{n}', String(mo.overdue.length)) : t('svc_maint_card_soon').replace('{n}', String(mo.soon.length));
  return `
  <div class="budget-alert-card ${over?'crit':'warn'}" id="btn-maint-alert" role="button" tabindex="0">
    <span class="ba-icon">🔧</span>
    <span class="ba-text"><b>${title}</b><span>${escapeHtml(f.asset.name)} · ${escapeHtml(f.plan.name)} · ${escapeHtml(svcMaintWhen(f.st))}</span></span>
    <span class="ba-chev">›</span>
  </div>`;
}

/* ---------- IMPRESIÓN: cuenta de cobro, ficha de activo, sección del informe ----------
   Mismo escritor de PDF que el informe mensual (DustyPdf, app-14): se comparte
   por la hoja nativa en el teléfono o se descarga en escritorio. */
function svcPdfHeader(pdf, subtitle){
  const name = (businessName || '').trim() || 'Dusty';
  pdf.rect(pdf.M, pdf.H - pdf.M + 10, pdf.W - 2*pdf.M, 3, [0.25, 0.56, 0.89]);
  pdf.line(name, {size: 18, bold: true, lh: 28});
  pdf.line(subtitle, {size: 12, color: [0.35, 0.35, 0.4], lh: 18});
  pdf.line(t('rp_generated').replace('{d}', localDateStr(new Date())), {size: 8.5, color: [0.55, 0.55, 0.6], lh: 14});
  pdf.gap(6);
  return name;
}
function svcSharePdf(bytes, fileName, title){
  const safe = ((businessName || 'dusty').trim() || 'dusty').replace(/[^\w\- ]+/g, '').trim().slice(0, 30).replace(/\s+/g, '-') || 'dusty';
  const fn = `${safe}-${fileName}.pdf`;
  return sharePdfBytes(bytes, fn, title);
}
// "1 trabajo" / "N trabajos" — la misma pantalla decía "1 trabajos" (auditoría de la auditoría 2026-09-12).
function svcJobsCount(n){ return n===1 ? t('svc_job_1') : t('svc_jobs_n').replace('{n}', String(n)); }
function jobStatusLabel(j){ return j.paid ? t('svc_tag_paid') : (jobIsOverdue(j) ? t('svc_tag_overdue') : t('svc_tag_pending')); }
/* N.º de la cuenta de cobro. Un trabajo suelto usa la cola de su id al azar; una
   ocurrencia de contrato tiene id determinista "job-<contrato>-<fecha>" y la cola
   era "-MM-DD", igual para todos los contratos (auditoría de la auditoría
   2026-09-12): se arma con la cola del contrato y la fecha (P4K2-0406). */
function svcInvoiceNum(j){
  const id = String((j && j.id)||'');
  const m = /^job-(.+)-(\d{4})-(\d{2})-(\d{2})$/.exec(id);
  if(m) return m[1].slice(-4).toUpperCase() + '-' + m[3] + m[4];
  return id.slice(-6).toUpperCase();
}
// Cuenta de cobro de UN trabajo, para el cliente: sin los gastos internos.
function buildJobPdf(j){
  const pdf = DustyPdf();
  const name = svcPdfHeader(pdf, t('svc_invoice_title') + ' · ' + t('rd_id_label') + ' ' + svcInvoiceNum(j));
  const asset = j.assetId ? assetById(j.assetId) : null;
  pdf.line(`${t('svc_client')}: ${j.client||''}`, {size: 11, bold: true, lh: 18});
  // " - " y no "→": la fuente del PDF (WinAnsi) no tiene la flecha.
  pdf.line(`${t('lbl_date')}: ${j.date||''}${j.endDate ? ' - '+j.endDate : ''}${asset ? '   ·   '+t('svc_asset_used')+': '+asset.name : ''}`, {size: 9.5, color: [0.35, 0.35, 0.4], lh: 15});
  pdf.gap(10);
  // Por hora/día/km: "3 h × $20" en la descripción y la cantidad en su columna.
  const byUnit = j.qty>0 && j.unit && j.unitPrice>0;
  pdf.table([{key:'desc', label: t('rd_col_desc')}, {key:'qty', label: t('rd_col_qty'), w: 70, align:'right'}, {key:'total', label: t('rp_col_total'), w: 110, align:'right'}],
    [{desc: (j.serviceName || t('svc_job_edit')) + (byUnit ? ` · ${j.qty} ${svcUnitQtyLabel(j.qty, j.unit)} × ${money(j.unitPrice)}` : ''), qty: byUnit ? String(j.qty) : '1', total: money(j.price||0)}, {desc: t('rp_total'), qty: '', total: money(j.price||0), _bold: true}]);
  pdf.gap(12);
  pdf.line(`${t('svc_collect_label')}: ${jobStatusLabel(j)}${!j.paid && j.dueDate ? '   ·   '+t('svc_invoice_due')+' '+j.dueDate : ''}${j.paid && j.paidDate ? '   ·   '+t('svc_paid_on').replace('{when}', j.paidDate) : ''}`, {size: 10, bold: true, lh: 16});
  pdf.gap(6);
  pdf.line(t('svc_invoice_thanks'), {size: 9, color: [0.45, 0.45, 0.5], lh: 14});
  return pdf.build((n, total)=>({left: name + ' · ' + t('svc_invoice_title') + ' · ' + (j.date||''), right: t('rp_page').replace('{n}', n).replace('{t}', total)}));
}
function downloadJobPdf(j){
  let bytes; try{ bytes = buildJobPdf(j); }catch(e){ console.error('[Dusty] cuenta de cobro:', e); showToast(t('rp_failed'), 'error'); return; }
  const who = svcFileSlug(j.client, t('svc_client'));
  svcSharePdf(bytes, `${j.date||svcFileSlug('', t('svc_maint_no_date'))}-${who}`, t('svc_invoice_title') + ' · ' + (j.client||''));
}
// Trozo de nombre de archivo: sin perder acentos ni ñ ('Pérez' → 'Perez', no
// 'Prez'), sin espacios, con reserva traducida en vez de 'cliente'/'activo' fijos.
function svcFileSlug(s, fallback){
  const clean = v => String(v||'').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w\- ]+/g, '').trim().slice(0, 24).replace(/\s+/g, '-');
  return clean(s) || clean(fallback).toLowerCase();
}
// Ficha de un activo: resultado del mes, mantenimientos con estado, gastos.
// Ficha en PDF = lo mismo que la ficha en pantalla (auditoría 2026-09-12): el mes
// que se está mirando, el acumulado, mantenimientos programados y hechos, los
// trabajos y los gastos del mes COMPLETOS (el escritor pagina; antes cortaba en 60
// y la fila "Total" sumaba solo lo impreso). Sin permiso financiero, sin
// facturado/neto — igual que en pantalla.
function buildAssetPdf(a){
  resetFinancialCache();
  const pdf = DustyPdf();
  const key = assetSheetKey(), today = localDateStr();
  const fin = canSeeFinancials();
  const name = svcPdfHeader(pdf, `${t('svc_tool_asset')} · ${a.name}${a.model ? ' · '+a.model : ''}`);
  const st = assetMonthStats(a, key), all = assetAllTimeStats(a);
  const ml = svcMonthLabels(key);
  const rows = [];
  if(a.purchaseDate || a.purchasePrice>0) rows.push({label: t('svc_purchase_date'), value: a.purchaseDate||'—', note: a.purchasePrice>0 ? money(a.purchasePrice) : ''});
  if(useOdo() && a.km!==null && a.km!==undefined) rows.push({label: tu('svc_km'), value: svcFmtNum(a.km)+' '+distU(), note: ''});
  if(fin){
    rows.push({label: t('svc_billed_with'), value: money(st.revenue), note: ml.jobs(st.jobs)});
    rows.push({label: t('svc_pdf_paid_of'), value: money(st.paid), note: ''});
  }
  rows.push({label: ml.expenses, value: money(st.expense), note: monthLabel(key, uiLang)});
  if(fin){
    rows.push({label: ml.net, value: (st.net<0?'-':'')+money(Math.abs(st.net)), note: '', _bold: true});
    // "Desde siempre" en tres filas: la nota de una sola línea se cortaba.
    rows.push({label: `${t('svc_since_purchase')} · ${t('svc_pdf_billed')}`, value: money(all.revenue), note: svcJobsCount(all.jobs)});
    rows.push({label: `${t('svc_since_purchase')} · ${t('spend_expenses')}`, value: money(all.expense), note: ''});
    rows.push({label: `${t('svc_since_purchase')} · ${t('recap_net')}`, value: (all.net<0?'-':'')+money(Math.abs(all.net)), note: '', _bold: true});
  }
  pdf.line(monthLabel(key, uiLang), {size: 12.5, bold: true, lh: 24});
  pdf.table([{key:'label', label: t('rp_col_concept')}, {key:'value', label: t('rp_col_amount'), w: 120, align:'right'}, {key:'note', label:'', w: 150, align:'right'}], rows);
  pdf.gap(14);
  pdf.line(t('svc_maints'), {size: 12.5, bold: true, lh: 24});
  const plans = (a.maint||[]);
  if(!plans.length) pdf.line(t('svc_maint_no_plan'), {size: 9.5, color: [0.5, 0.5, 0.55]});
  else pdf.table([{key:'name', label: t('svc_maint_name')}, {key:'every', label: t('svc_pdf_every'), w: 150}, {key:'last', label: t('svc_last_done'), w: 90}, {key:'status', label: t('svc_pdf_status'), w: 110, align:'right'}],
    plans.map(m=>{ const s = svcMaintStatus(m, a, today); return {name: m.name, every: [m.everyKm>0 && useOdo() ? tu('svc_every_km').replace('{n}', svcFmtNum(m.everyKm)) : '', m.everyMonths>0 ? t('svc_every_months').replace('{n}', String(m.everyMonths)) : ''].filter(Boolean).join(' / '), last: m.lastDate || '—', status: s.status==='none' ? t('svc_maint_no_date') : (s.status==='overdue' ? t('svc_tag_overdue')+' · ' : '') + svcMaintWhen(s)}; }));
  pdf.gap(14);
  const logAllPdf = (a.maintLog||[]).slice().sort((x,y)=>String(y.date).localeCompare(String(x.date)));
  const log = logAllPdf.slice(0, 60);
  if(log.length){
    // Si se recorta, se dice ("60 de 90"): un PDF que calla lo que omite parece completo.
    pdf.line(t('svc_maint_history') + (logAllPdf.length>log.length ? t('svc_n_of_total').replace('{n}', String(log.length)).replace('{t}', String(logAllPdf.length)) : ''), {size: 12.5, bold: true, lh: 24});
    pdf.table([{key:'date', label: t('rp_col_date'), w: 80}, {key:'what', label: t('svc_maint_name')}, {key:'km', label: useOdo() ? distU() : '', w: 80, align:'right'}, {key:'cost', label: t('rp_col_total'), w: 100, align:'right'}],
      log.map(l=>{ const plan = l.planId ? plans.find(m=>m.id===l.planId) : null; return {date: l.date, what: plan ? plan.name : (l.desc || t('svc_log_other')), km: useOdo() && l.km!==null && l.km!==undefined ? svcFmtNum(l.km) : '', cost: l.cost>0 ? money(l.cost) : '—'}; }));
    pdf.gap(14);
  }
  const jobs = jobsForMonth(key).filter(j=>j.assetId===a.id).sort((x,y)=>String(x.date).localeCompare(String(y.date)));
  if(jobs.length){
    pdf.line(t('svc_jobs_with_asset'), {size: 12.5, bold: true, lh: 24});
    const jr = jobs.map(j=>({date: j.date + (j.endDate ? ' - '+j.endDate : ''), client: j.client||'', svc: j.serviceName||'', status: jobStatusLabel(j), total: fin ? money(j.price||0) : ''}));
    if(fin) jr.push({date:'', client: t('rp_total'), svc:'', status:'', total: money(st.revenue), _bold: true});
    pdf.table([{key:'date', label: t('rp_col_date'), w: 95}, {key:'client', label: t('svc_client'), w: 130}, {key:'svc', label: t('svc_service')}, {key:'status', label: t('svc_pdf_status'), w: 75}, {key:'total', label: t('rp_col_total'), w: 85, align:'right'}], jr);
    pdf.gap(14);
  }
  pdf.line(`${t('svc_expenses_month')} · ${monthLabel(key, uiLang)}`, {size: 12.5, bold: true, lh: 24});
  const recs = assetReceipts(a.id, key).sort((x,y)=>String(y.date).localeCompare(String(x.date)));
  if(!recs.length) pdf.line(t('rp_none'), {size: 9.5, color: [0.5, 0.5, 0.55]});
  else {
    let sum = 0;
    const rr = recs.map(r=>{ sum += Number(r.total)||0; return {date: r.date||'', who: (r.supplier||'').trim() || t('no_supplier_name'), cat: receiptCatName(r), total: money(r.total||0)}; });
    rr.push({date:'', who: t('svc_pdf_period_total'), cat:'', total: money(sum), _bold: true});
    pdf.table([{key:'date', label: t('rp_col_date'), w: 80}, {key:'who', label: t('rp_col_who')}, {key:'cat', label: t('rp_col_category'), w: 110}, {key:'total', label: t('rp_col_total'), w: 100, align:'right'}], rr);
  }
  return pdf.build((n, total)=>({left: name + ' · ' + a.name + ' · ' + monthLabel(key, uiLang), right: t('rp_page').replace('{n}', n).replace('{t}', total)}));
}
function downloadAssetPdf(a){
  let bytes; try{ bytes = buildAssetPdf(a); }catch(e){ console.error('[Dusty] ficha de activo:', e); showToast(t('rp_failed'), 'error'); return; }
  const who = svcFileSlug(a.name, t('svc_tool_asset'));
  svcSharePdf(bytes, `${assetSheetKey()}-${who}`, a.name);
}
// Sección de Servicios dentro del informe del mes/año (buildMonthReport, app-14):
// trabajos con estado, totales facturado/cobrado/pendiente, resultado por activo.
function svcReportSection(pdf, key){
  if(!usesServices()) return;
  const inPeriod = d => key.length===4 ? String(d||'').slice(0,4)===key : monthKey(d)===key;
  const jobs = svcJobs().filter(j=>inPeriod(j.date)).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  pdf.line(t('svc_jobs_title'), {size: 12.5, bold: true, lh: 24});
  if(!jobs.length){ pdf.line(t('rp_none'), {size: 9.5, color: [0.5, 0.5, 0.55]}); pdf.gap(14); }
  else {
    let billed = 0, paid = 0;
    const rows = jobs.map(j=>{ billed += Number(j.price)||0; if(j.paid) paid += Number(j.price)||0; const a = j.assetId ? assetById(j.assetId) : null; return {date: j.date||'', client: j.client||'', svc: (j.serviceName||'') + (a ? ' · '+a.name : ''), status: jobStatusLabel(j), total: money(j.price||0)}; });
    // "Cobrado de estos trabajos": lo cobrado ENTRE los trabajos del período (no lo
    // cobrado en el mes por fecha de cobro, que es lo que dice Por cobrar).
    // Las etiquetas van en la columna ancha (servicio): en la de cliente se cortaban.
    rows.push({date:'', client:'', svc: t('svc_pdf_billed'), status:'', total: money(billed), _bold: true});
    rows.push({date:'', client:'', svc: t('svc_pdf_paid_of'), status:'', total: money(paid), _bold: true});
    rows.push({date:'', client:'', svc: t('svc_pdf_pending_of'), status:'', total: money(billed-paid), _bold: true});
    pdf.table([{key:'date', label: t('rp_col_date'), w: 70}, {key:'client', label: t('svc_client'), w: 130}, {key:'svc', label: t('svc_service')}, {key:'status', label: t('svc_pdf_status'), w: 75}, {key:'total', label: t('rp_col_total'), w: 85, align:'right'}], rows);
    pdf.gap(14);
  }
  // Misma cuenta que la ficha del activo y el Cierre (svcAssetStats): la mercadería
  // de las cotizaciones aceptadas va dentro de "gastos" en esta tabla.
  const per = (bizProfile.assets||[]).map(a=>{
    const st = svcAssetStats(a, jobs.filter(j=>j.assetId===a.id), assetReceipts(a.id).filter(r=>inPeriod(r.date)), svcArchivedForAssetPeriod(a.id, inPeriod));
    return {a, rev: st.revenue, exp: st.expense + st.cogs, net: st.net};
  }).filter(x=>x.rev>0 || x.exp>0);
  if(per.length){
    pdf.line(t('recap_by_asset'), {size: 12.5, bold: true, lh: 24});
    pdf.table([{key:'name', label: t('svc_tool_asset')}, {key:'rev', label: t('recap_revenue_jobs'), w: 110, align:'right'}, {key:'exp', label: t('spend_expenses'), w: 110, align:'right'}, {key:'net', label: t('recap_net'), w: 110, align:'right'}],
      per.map(x=>({name: x.a.name, rev: money(x.rev), exp: money(x.exp), net: (x.net<0?'-':'')+money(Math.abs(x.net))})));
    pdf.gap(14);
  }
}

/* ================= CALENDARIO INTELIGENTE (2026-09-11, 3.ª tanda) =================
   Las cinco mejoras aprobadas por el usuario ("manos a la obra"), sobre el
   MISMO calendario: 1) agenda de los próximos 7 días en el Dashboard;
   2) aviso N días antes de cada cobro, con WhatsApp desde la nota; 3) contratos
   recurrentes que generan los trabajos solos; 4) choques de equipo al guardar;
   5) color por tipo en los puntitos. */

/* ---------- 1. agenda: próximos 7 días ---------- */
function svcDayLabel(d, today){
  if(d===today) return t('svc_today');
  if(d===addDaysStr(today, 1)) return t('svc_tomorrow');
  const dt = new Date(d+'T00:00:00');
  const wd = (CAL_NOTE_WEEKDAYS[uiLang]||CAL_NOTE_WEEKDAYS.en)[dt.getDay()];
  return wd.charAt(0).toUpperCase()+wd.slice(1)+' '+dt.getDate();
}
function svcAgendaHtml(){
  if(!usesServices()) return '';
  const today = localDateStr();
  const rows = [];
  for(let i=0; i<7; i++){
    const d = addDaysStr(today, i);
    calNotesOnDate(calNotes, d).forEach(n=>rows.push({d, n}));
  }
  if(!rows.length) return '';
  const MAX = 8;
  const shown = rows.slice(0, MAX);
  const cap = (s)=> s.charAt(0).toUpperCase()+s.slice(1);
  let lastDay = '';
  return `
  <div class="dash-section-label" style="margin-top:14px;">${t('svc_agenda_title')}</div>
  <div class="svc-agenda">
    ${shown.map(({d, n})=>{
      const head = d!==lastDay ? `<span class="svc-agenda-day">${svcDayLabel(d, today)}</span>` : '<span class="svc-agenda-day"></span>';
      lastDay = d;
      const wa = (n.svcKind==='due' && n.jobId) ? `<button type="button" class="btn btn-ghost btn-sm svc-agenda-wa" data-wa-job="${escapeHtml(n.jobId)}" title="${t('svc_whatsapp')}">💬</button>` : '';
      return `
    <div class="svc-agenda-row ${n.svcKind ? 'k-'+n.svcKind : 'k-note'}" data-cal-day="${d}" role="button" tabindex="0">
      ${head}
      <span class="svc-agenda-ic">${escapeHtml(n.icon||'📌')}</span>
      <span class="svc-agenda-tx">${escapeHtml(cap(n.text))}${calNoteWhenText(n) && n.hour!==null && n.hour!==undefined ? ` <small>${escapeHtml(calNoteTimeStr(n.hour, n.minute))}</small>` : ''}</span>
      ${wa}
    </div>`; }).join('')}
    ${rows.length>MAX ? `<div class="helper-note" style="margin:6px 2px 0;">${t('svc_agenda_more').replace('{n}', String(rows.length-MAX))}</div>` : ''}
  </div>`;
}

/* ---------- 3. contratos recurrentes ---------- */
const SVC_REPEATS = ['weekly','biweekly','monthly'];
function svcRepeatLabel(r){ return r==='weekly' ? t('svc_rep_weekly') : r==='biweekly' ? t('svc_rep_biweekly') : r==='monthly' ? t('svc_rep_monthly') : t('svc_rep_none'); }
/* Próxima fecha de una regla. anchorDay es el día del mes del contrato (1-31):
   "cada mes" desde el 31 de enero cae el 28 de febrero, pero el 31 de marzo y
   el 30 de abril — no el 28 para siempre. Encadenar desde la fecha anterior sin
   ancla derivaba al 28 y ya no volvía (auditoría de Servicios 2026-09-12). */
function svcNextDate(dateStr, repeat, anchorDay){
  if(!dateStr) return null;
  if(repeat==='weekly') return addDaysStr(dateStr, 7);
  if(repeat==='biweekly') return addDaysStr(dateStr, 14);
  if(repeat==='monthly'){
    const d = new Date(dateStr+'T00:00:00'); const day = anchorDay>0 ? anchorDay : d.getDate();
    d.setDate(1); d.setMonth(d.getMonth()+1);
    const last = new Date(d.getFullYear(), d.getMonth()+1, 0).getDate();
    d.setDate(Math.min(day, last));
    return localDateStr(d);
  }
  return null;
}
function svcAnchorDay(tpl){ const m = /^\d{4}-\d{2}-(\d{2})$/.exec((tpl && tpl.date)||''); return m ? parseInt(m[1],10) : 0; }
// Fecha PROGRAMADA de una ocurrencia. Si el usuario la movió (el camión fue el
// martes en vez del lunes), occDate conserva la del calendario del contrato: así
// la regla sabe que esa semana ya tiene su trabajo y no crea otro.
function svcOccDate(o){ return (o && (o.occDate || o.date)) || ''; }
// Id determinista por contrato + fecha: dos teléfonos sin conexión generan la
// MISMA ocurrencia con el MISMO id, y el merge por id de la nube la deja una sola
// vez (con uid() al azar quedaban dos cobros iguales después de sincronizar).
function svcChildId(tplId, date){ return 'job-'+tplId+'-'+date; }
// Un contrato de varios días (alquiler de lunes a miércoles) repite la misma duración.
function svcChildEndDate(tpl, next){
  if(!tpl.endDate || !tpl.date || tpl.endDate<=tpl.date) return null;
  return addDaysStr(next, daysBetweenStr(tpl.date, tpl.endDate));
}
/* Sello de "lo tocó la regla, no el usuario". lastEditedAt es lo que decide el
   merge de la nube (gana el más nuevo, ver app-02), así que la regla también
   tiene que sellarlo para que su poda o su cambio de precio no lo pise la copia
   vieja de otro teléfono; ruleAt guarda el MISMO instante para saber después que
   ese sello fue de la regla y la ocurrencia sigue sin tocar. Una edición a mano
   sella lastEditedAt sin ruleAt: desde ahí es del usuario. */
function svcRuleStamp(o){ o.lastEditedAt = o.ruleAt = new Date().toISOString(); }
function svcChildUntouched(o){ return !o.paid && (!o.lastEditedAt || o.lastEditedAt===o.ruleAt) && !jobReceipts(o.id).length; }
/* Ocurrencias FUTURAS de un contrato que Dusty creó y nadie tocó: sin cobrar,
   sin editar a mano, sin gastos colgados. Son las únicas que la regla puede
   rehacer; las pasadas y las tocadas son historia del usuario y no se tocan.
   La de HOY cuenta como futura mientras nadie la haya tocado: la generación sí
   crea ocurrencias para hoy, y si la poda las dejara afuera, cambiar la
   frecuencia dos veces en el mismo día dejaba un cobro de una regla que ya no
   existe (auditoría de la auditoría 2026-09-12). */
function svcUntouchedFutureChildren(tpl, today){
  today = today || localDateStr();
  return svcJobs().filter(o=>o.parentId===tpl.id && o.date>=today && svcChildUntouched(o));
}
// Cambió la regla (fecha o frecuencia) o se eliminó el contrato: las próximas
// que nacieron de la regla vieja se retiran; con la nueva nacen las que toquen.
// Quedan como borradas con prunedByRule para que el merge no las resucite y para
// que, si la regla vuelve a pedir esa fecha, se reviva la misma en vez de crear
// otra con el mismo id.
function svcPruneChildren(tpl){
  let n = 0;
  svcUntouchedFutureChildren(tpl).forEach(o=>{ o.deleted = true; o.prunedByRule = true; o.deletedAt = new Date().toISOString(); svcRuleStamp(o); n++; });
  return n;
}
// Cambió cliente, servicio, precio, equipo o plazo del contrato: las próximas sin
// tocar lo siguen (si no, el precio nuevo recién regía en dos semanas y el
// usuario veía cobros viejos que "no se actualizaban").
function svcPropagateToChildren(tpl){
  let n = 0;
  svcUntouchedFutureChildren(tpl).forEach(o=>{
    Object.assign(o, { client: tpl.client, serviceName: tpl.serviceName, serviceId: tpl.serviceId||null, assetId: tpl.assetId||null,
      price: tpl.price, qty: tpl.qty||null, unit: tpl.unit||null, unitPrice: tpl.unitPrice||null, endDate: svcChildEndDate(tpl, o.date),
      dueDays: tpl.dueDays||15, dueDate: addDaysStr(o.date, tpl.dueDays||15) });
    svcRuleStamp(o);
    n++;
  });
  return n;
}
// Un solo punto para "se editó un trabajo" (modal o asistente): si es la plantilla
// de un contrato, sus ocurrencias futuras sin tocar siguen la regla nueva.
let svcLastPruned = 0; // cuántas ocurrencias futuras retiró la última edición/borrado (para el aviso)
function svcAfterJobEdit(job, ruleChanged){
  svcLastPruned = 0;
  if(!job || job.parentId) return 0;
  if(ruleChanged){ job.lastGenerated = null; svcLastPruned = svcPruneChildren(job); return svcLastPruned; }
  if(job.repeat) svcPropagateToChildren(job);
  return 0;
}
function svcAfterJobDelete(job){ svcLastPruned = (job && job.repeat && !job.parentId) ? svcPruneChildren(job) : 0; return svcLastPruned; }
// Genera las próximas ocurrencias de cada contrato hasta 14 días adelante. Cada
// ocurrencia es un trabajo normal (se edita, se cobra, se imprime) colgado del
// contrato por parentId; una ocurrencia borrada a mano no se vuelve a crear. Corre
// al principio de cada saveState, antes de sincronizar el calendario. El id de
// cada ocurrencia sale del contrato y la fecha (svcChildId), no del azar: dos
// teléfonos sin señal generan la MISMA ocurrencia con el MISMO id, y la unión por
// id de la nube no duplica el cobro.
function svcGenerateRecurring(){
  if(!usesServices()) return false;
  const today = localDateStr();
  const horizon = addDaysStr(today, 14);
  let changed = false;
  // Un contrato con fecha que no existe (2026-02-30) no genera nada: JS la
  // "arregla" al 2 de marzo y salían ocurrencias de un calendario inventado.
  svcJobs().filter(j=>j.repeat && SVC_REPEATS.indexOf(j.repeat)>=0 && !j.parentId && isValidDateStr(j.date)).forEach(tpl=>{
    const anchor = svcAnchorDay(tpl);
    let last = tpl.lastGenerated || tpl.date, guard = 0;
    /* Solo hacia ADELANTE (auditoría UX 2026-09-11): activar "Se repite" sobre un
       trabajo de enero creaba al instante 37 trabajos pasados, todos como cobros
       vencidos. Sin lastGenerated (recién activado) se salta a la última
       ocurrencia anterior a hoy sin crear nada; recién de ahí nacen las próximas.
       El salto no tiene tope chico: con 400 se quedaba corto para un contrato
       semanal de hace años y desde ahí nacían 60 trabajos pasados, todos vencidos. */
    if(!tpl.lastGenerated && last < today){
      let skip = 0;
      while(skip++ < 20000){ const n = svcNextDate(last, tpl.repeat, anchor); if(!n || n >= today) break; last = n; }
      if(svcNextDate(last, tpl.repeat, anchor) < today) return; // fecha inválida o sin llegar: no se inventa nada
    } else if(tpl.lastGenerated && last < addDaysStr(today, -14)){
      /* La app estuvo cerrada semanas: se recuperan solo las fechas de los últimos
         14 días (misma ventana que hacia adelante). Rellenar meses enteros creaba
         cobros vencidos "que no deberían generarse" (pedido del usuario); lo que se
         salta se avisa una vez para que, si esos trabajos sí se hicieron, se
         carguen a mano. */
      let skipped = 0, skip = 0;
      const floor = addDaysStr(today, -14);
      // Solo cuentan como saltadas las fechas que NADIE creó (otro teléfono pudo
      // haberlas generado y ya venir por la nube).
      while(skip++ < 20000){ const n = svcNextDate(last, tpl.repeat, anchor); if(!n || n >= floor) break; last = n; if(!outflows.some(o=>o && o.parentId===tpl.id && svcOccDate(o)===n)) skipped++; }
      // El marcador avanza hasta lo saltado: si no, cada guardado volvía a saltar
      // lo mismo y a avisar de nuevo mientras la próxima quedara fuera del horizonte.
      if(tpl.lastGenerated!==last){ tpl.lastGenerated = last; changed = true; }
      if(skipped>0 && typeof showToast==='function' && typeof t==='function') try{ showToast(t('svc_skipped_notice').replace('{n}', String(skipped)).replace('{client}', tpl.client||''), 'info'); }catch(e){}
    }
    /* Reconciliación: ocurrencias futuras sin tocar que ya no caen en la regla
       (llegaron de otro teléfono que todavía tenía la regla vieja, o el contrato
       se movió sobre una fecha que ya tenía ocurrencia) se retiran. Idempotente;
       lo tocado por una persona no se toca. Solo se juzgan las fechas DENTRO del
       horizonte de este dispositivo: una ocurrencia más allá (la generó otro
       teléfono cuyo "hoy" va adelante, por huso horario o reloj) no está en
       `expected` porque la lista termina en el horizonte, no porque la regla no
       la pida — podarla la perdía para siempre en los dos teléfonos (auditoría
       de la auditoría 2026-09-12). La de hoy sí se juzga (igual que en la poda). */
    const expected = new Set();
    { let d = tpl.date, g = 0; while(g++ < 20000){ d = svcNextDate(d, tpl.repeat, anchor); if(!d || d > horizon) break; if(d >= today) expected.add(d); } }
    svcJobs().forEach(o=>{
      if(o.parentId!==tpl.id || o.date<today || !svcChildUntouched(o)) return;
      const od = svcOccDate(o);
      if(od===tpl.date || (od>=today && od<=horizon && !expected.has(od))){ o.deleted = true; o.prunedByRule = true; o.deletedAt = new Date().toISOString(); svcRuleStamp(o); changed = true; }
    });
    while(guard++ < 60){
      const next = svcNextDate(last, tpl.repeat, anchor);
      if(!next || next>horizon) break;
      const existing = outflows.find(o=>o && o.type==='service' && o.parentId===tpl.id && svcOccDate(o)===next);
      if(!existing){
        recordOutflow({ id: svcChildId(tpl.id, next), type:'service', date: next, occDate: next, endDate: svcChildEndDate(tpl, next), client: tpl.client, serviceName: tpl.serviceName, serviceId: tpl.serviceId||null,
          assetId: tpl.assetId||null, price: tpl.price, qty: tpl.qty||null, unit: tpl.unit||null, unitPrice: tpl.unitPrice||null, paid: false, dueDate: addDaysStr(next, tpl.dueDays||15), paidDate: null, dueDays: tpl.dueDays||15,
          parentId: tpl.id, items: [], createdAt: new Date().toISOString(), byLabel: tpl.byLabel||'' });
        changed = true;
      } else if(existing.deleted && existing.prunedByRule){
        // La retiró una regla anterior y la regla de ahora la vuelve a pedir: revive
        // la misma (mismo id) con los datos actuales del contrato.
        delete existing.deleted; delete existing.deletedAt; delete existing.prunedByRule;
        Object.assign(existing, { date: next, occDate: next, endDate: svcChildEndDate(tpl, next), client: tpl.client, serviceName: tpl.serviceName, serviceId: tpl.serviceId||null, assetId: tpl.assetId||null,
          price: tpl.price, qty: tpl.qty||null, unit: tpl.unit||null, unitPrice: tpl.unitPrice||null, paid: false, paidDate: null, dueDays: tpl.dueDays||15, dueDate: addDaysStr(next, tpl.dueDays||15) });
        svcRuleStamp(existing);
        changed = true;
      }
      last = next;
      if(tpl.lastGenerated!==next){ tpl.lastGenerated = next; changed = true; }
    }
  });
  return changed;
}

/* ---------- 4. choques de equipo ---------- */
// Otro trabajo del MISMO equipo el MISMO día (que no sea este). Se pregunta,
// no se prohíbe: un camión puede hacer dos viajes cortos.
function svcClash(d){
  if(!d.assetId || !d.date) return null;
  // Por rango: un alquiler del 10 al 15 choca con otro del mismo equipo el 12.
  const from = d.date, to = d.endDate || d.date;
  // La propia familia del contrato no choca consigo misma: mover el contrato sobre
  // la fecha de su próxima ocurrencia (la regla la retira), o un alquiler semanal
  // de 7 días cuyas ocurrencias se tocan, pedía confirmar un "choque" falso.
  const fam = new Set([d.id, d.parentId].filter(Boolean));
  return svcJobs().find(j=>j.id!==d.id && j.assetId===d.assetId && !(fam.has(j.id) || fam.has(j.parentId)) && j.date<=to && (j.endDate||j.date)>=from) || null;
}

/* ---------- tick diario ----------
   Las ocurrencias de los contratos y sus notas del calendario nacían solo
   dentro de saveState: abrir la app y MIRAR no creaba la semana siguiente hasta
   que el usuario guardara algo (auditoría 2026-09-12). Corre al arrancar y cada
   vez que la app vuelve al frente en un día distinto; si hubo cambios, guarda y
   redibuja. */
let svcTickDay = '';
function svcDailyTick(){
  if(typeof usesServices!=='function' || !usesServices()) return false;
  const today = localDateStr();
  if(svcTickDay===today) return false;
  const newDay = !!svcTickDay; // ya había corrido otro día: la app amaneció abierta
  svcTickDay = today;
  let changed = false;
  try{ if(svcGenerateRecurring()) changed = true; }catch(e){}
  try{ if(svcSyncCalendar()) changed = true; }catch(e){}
  if(changed) saveState();
  // Día nuevo sin datos nuevos igual se redibuja y avisa: "Hoy", la agenda y los
  // vencidos son de la fecha, no de los datos (antes el Dashboard amanecía con el
  // "Hoy" de ayer hasta que el usuario tocaba algo).
  if(changed || newDay){ render(); if(newDay) try{ checkServiceAlerts(); }catch(e){} }
  return changed;
}
if(typeof document!=='undefined' && document.addEventListener){
  document.addEventListener('visibilitychange', ()=>{ if(document.visibilityState==='visible') try{ svcDailyTick(); }catch(e){} });
  // Después de que app-07 cargue el estado (corre sincrónico antes del timeout).
  setTimeout(()=>{ try{ svcDailyTick(); }catch(e){} }, 0);
}
