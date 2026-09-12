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
function jobById(id){ return outflows.find(o=>o && o.type==='service' && o.id===id) || null; }
function assetById(id){ return (bizProfile.assets||[]).find(a=>a.id===id) || null; }
function serviceById(id){ return (bizProfile.catalog||[]).find(c=>c.id===id) || null; }
function jobReceipts(jobId){ return receipts.filter(r=>r && r.jobId===jobId); }
function jobExpenseTotal(job){ return jobReceipts(job.id).reduce((s,r)=>s+(Number(r.total)||0),0); }
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
  const jobIds = new Set(svcJobs().filter(j=>j.assetId===assetId).map(j=>j.id));
  return receipts.filter(r=>r && (r.assetId===assetId || (r.jobId && jobIds.has(r.jobId))) && (!key || monthKey(r.date)===key));
}
function assetMonthStats(asset, key){
  const jobs = jobsForMonth(key).filter(j=>j.assetId===asset.id);
  const revenue = jobs.reduce((s,j)=>s+(Number(j.price)||0),0);
  const expense = assetReceipts(asset.id, key).reduce((s,r)=>s+(Number(r.total)||0),0);
  return {revenue, jobs: jobs.length, expense, net: revenue-expense};
}
const SVC_MAINT_RANK = {overdue:3, soon:2, ok:1, none:0};
function assetMaintInfo(asset){
  const today = localDateStr(); let worst = null;
  (asset.maint||[]).forEach(m=>{
    const st = maintStatus(m, asset, today, bizProfile.maintDays);
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
function svcFmtNum(n){ return Math.round(Math.abs(n)).toLocaleString('en-US'); }
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
  return unit==='km' ? '/km' : unit==='day' ? `/${t('svc_unit_day_short')}` : unit==='hour' ? '/h' : '';
}
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
      <span class="inv-tool-ring tool-products">🚚</span>
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
function svcDashTilesHtml(){
  const today = localDateStr();
  const jobsToday = svcJobs().filter(j=>j.date===today);
  const cs = collectStats();
  const mo = svcMaintOverview();
  const firstJob = jobsToday[0];
  const collectBadge = cs.pending>0 ? {cls:'warn', label:t('svc_tag_pending')} : {cls:'ok', label:t('svc_tag_ok')};
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
    <div class="inv-stat static svc-stat-mid"><div class="inv-stat-label">${t('svc_stat_value')}</div><div class="inv-stat-value">${svcMoneyShort(value)}</div></div>
    <div class="inv-stat static"><div class="inv-stat-label">${t('svc_stat_month_spend')}</div><div class="inv-stat-value">${svcMoneyShort(monthSpend)}</div></div>
  </div>` : ''}
  <div class="inv-tools" style="margin:0 0 6px;">
    <button type="button" class="inv-tool" id="btn-new-asset" title="${t('svc_asset_new')}">
      <span class="inv-tool-ring tool-products">🚚</span>
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
      <span class="inv-tool-ring tool-count">🔧</span>
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
function assetSheet(){
  const a = assetById(showAssetSheet);
  if(!a) return '';
  const key = localMonthStr();
  const st = assetMonthStats(a, key);
  const today = localDateStr();
  const bought = [a.purchaseDate ? t('svc_bought').replace('{when}', svcMonthYear(a.purchaseDate)) : '', a.purchasePrice>0 ? money(a.purchasePrice) : '', a.km!==null && a.km!==undefined ? `${svcFmtNum(a.km)} ${distU()}` : ''].filter(Boolean).join(' · ');
  const recs = assetReceipts(a.id).sort((x,y)=>String(y.date).localeCompare(String(x.date))).slice(0,6);
  const plans = (a.maint||[]).map(m=>({m, st: maintStatus(m, a, today, bizProfile.maintDays)}))
    .sort((x,y)=> SVC_MAINT_RANK[y.st.status]-SVC_MAINT_RANK[x.st.status] || svcMaintUrgency(x.st)-svcMaintUrgency(y.st));
  const every = (m)=>[m.everyKm>0 ? tu('svc_every_km').replace('{n}', svcFmtNum(m.everyKm)) : '', m.everyMonths>0 ? t('svc_every_months').replace('{n}', String(m.everyMonths)) : ''].filter(Boolean).join(uiLang==='en' ? ' or ' : ' o ');
  const body = `
    <h3 class="navy svc-sheet-title">${escapeHtml(a.emoji||'🚚')} ${escapeHtml(a.name)}${a.model ? ` · ${escapeHtml(a.model)}` : ''}
      <button type="button" class="stock-icon-btn edit svc-title-edit" id="btn-edit-asset" title="${t('svc_edit_asset')}" aria-label="${t('svc_edit_asset')}"><svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
    </h3>
    <div class="sub svc-sub">${bought || t('svc_no_purchase_data')}</div>
    ${canSeeFinancials() ? `
    <div class="dash-grid" style="margin-top:4px;">
      <div class="dash-tile t3 static svc-mini-tile">
        <b class="dash-tile-num">${svcMoneyShort(st.revenue)}</b>
        <span class="dash-tile-title">${t('svc_collected_with')}</span>
        <span class="dash-tile-sub">${t('svc_jobs_month_n').replace('{n}', String(st.jobs))}</span>
      </div>
      <div class="dash-tile twarn static svc-mini-tile">
        <b class="dash-tile-num">${svcMoneyShort(st.expense)}</b>
        <span class="dash-tile-title">${t('svc_expenses_month')}</span>
        <span class="dash-tile-sub">${monthLabel(key, uiLang)}</span>
      </div>
    </div>
    <div class="recap-row svc-line-big"><span class="recap-label">${t('svc_leaves_month')}</span><span class="recap-col-val"><strong style="color:${st.net>=0?'var(--money-pos)':'var(--money-neg)'};">${st.net<0?'−':''}${money(Math.abs(st.net))}</strong></span></div>` : ''}
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
      <div class="svc-card-head"><span>${t('svc_last_expenses')}</span>${recs.length ? `<button type="button" class="link-btn" id="btn-asset-all-receipts">${t('svc_see_all')}</button>` : ''}</div>
      ${recs.length===0 ? `<div class="helper-note" style="margin:4px 0 2px;">${t('svc_no_expenses')}</div>` : recs.map(r=>`
      <div class="recap-row svc-plan" data-view-receipt="${escapeHtml(r.id)}" role="button" tabindex="0">
        <span class="recap-label">${svcReceiptLabel(r)} · ${escapeHtml(svcShortDate(r.date))}</span>
        <span class="recap-col-val"><strong>${money(r.total)}</strong></span>
      </div>`).join('')}
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
      <div class="inv-stat static svc-stat-mid"><div class="inv-stat-label">${t('svc_stat_overdue')}</div><div class="inv-stat-value">${svcMoneyShort(cs.overdue)}</div></div>
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
function jobsSheet(){
  const today = localDateStr();
  const q = jobsSearch.trim();
  const list = svcJobs().filter(j=>!q || invMatches((j.client||'')+' '+(j.serviceName||''), q))
    .sort((a,b)=>String(b.date).localeCompare(String(a.date)) || String(b.createdAt||'').localeCompare(String(a.createdAt||''))).slice(0, 120);
  let lastKey = '';
  const body = `
    <div class="sub svc-sub" style="display:flex;align-items:center;justify-content:space-between;gap:10px;"><span>${t('svc_jobs_sub')}</span>${reportButtonHtml(localMonthStr())}</div>
    <button class="btn btn-primary" id="btn-jobs-new" style="width:100%;margin-bottom:12px;">${t('svc_new_job_btn')}</button>
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
        <small>${escapeHtml(j.serviceName||'')}${j.serviceName?' · ':''}${escapeHtml(svcShortDate(j.date))}${asset ? ` · ${escapeHtml(asset.name)}` : ''}${j.repeat ? ` · ${svcRepeatLabel(j.repeat).toLowerCase()}` : ''}${exp>0 ? ` · ${t('svc_expenses_short')} ${svcMoneyShort(exp)}` : ''}</small>
        <span class="dash-tile-badge svc-tag ${j.paid?'ok':over?'crit':'warn'}">${j.paid ? t('svc_tag_paid') : over ? t('svc_tag_overdue') : t('svc_tag_pending')}</span>
      </span>
      <span class="svc-row-amt"><b style="color:${j.paid?'var(--money-pos)':over?'var(--money-neg)':'var(--ink)'};">${svcMoneyShort(j.price||0)}</b></span>
    </div>`; }).join('')}`;
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
  if(!requireWriteAccess()) return;
  const j = jobId ? jobById(jobId) : null;
  draftJob = j ? {
    id:j.id, client:j.client||'', serviceName:j.serviceName||'', serviceId:j.serviceId||null, date:j.date||localDateStr(),
    assetId:j.assetId||null, price:j.price||'', paid:!!j.paid, dueDays: j.dueDays || ((j.dueDate && j.date) ? Math.max(1, daysBetweenStr(j.date, j.dueDate)) : 15), pending:[],
    repeat: j.repeat||null, parentId: j.parentId||null
  } : { id:null, client:'', serviceName:'', serviceId:null, date:localDateStr(), assetId:presetAssetId||null, price:'', paid:false, dueDays:15, pending:[], repeat:null, parentId:null };
  showJobModal = true; jobExpenseFormOpen = false; jobModalError = '';
  render();
}
function closeJobModal(){ showJobModal = false; draftJob = null; jobExpenseFormOpen = false; render(); }
function jobDraftExpenses(){
  const saved = draftJob.id ? jobReceipts(draftJob.id).map(r=>({desc: r.supplier, amount: Number(r.total)||0, cat: receiptCatName(r), id:r.id})) : [];
  const pend = draftJob.pending.map((p,i)=>({desc:p.desc, amount:p.amount, cat: (expenseCategories.find(c=>c.id===p.categoryId)||{}).name||'', pendingIdx:i}));
  return saved.concat(pend);
}
function jobProfitHtml(){
  const price = Number(draftJob.price)||0;
  const exp = jobDraftExpenses().reduce((s,e)=>s+e.amount,0);
  const gain = price-exp;
  const pct = price>0 ? Math.round(gain/price*100) : null;
  return `<strong style="color:${gain>=0?'var(--money-pos)':'var(--money-neg)'};">${gain<0?'−':''}${money(Math.abs(gain))}${pct!==null ? ` · ${pct}%` : ''}</strong>`;
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
      ${assets.length ? `
      <div class="field"><label>${t('svc_asset_used')}</label>
        <div class="svc-seg">
          <button type="button" class="exit-reason-chip ${!d.assetId?'on':''}" data-job-asset="">${t('svc_asset_none')}</button>
          ${assets.map(a=>`<button type="button" class="exit-reason-chip ${d.assetId===a.id?'on':''}" data-job-asset="${escapeHtml(a.id)}">${escapeHtml(a.emoji||'')} ${escapeHtml(a.name)}</button>`).join('')}
        </div>
      </div>` : ''}
      <div class="field"><label for="job-price">${t('svc_price')}</label>
        <input id="job-price" type="number" min="0" step="0.01" inputmode="decimal" value="${escapeHtml(d.price)}" placeholder="0.00">
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
      <div class="recap-row svc-line-big" style="margin-top:8px;"><span class="recap-label">${t('svc_job_profit')}</span><span class="recap-col-val" id="svc-job-profit">${jobProfitHtml()}</span></div>
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
        ${!d.paid ? `<div class="svc-due-row"><label for="job-due">${t('svc_due_days')}</label><select id="job-due">${[7,15,30,60].map(n=>`<option value="${n}" ${d.dueDays===n?'selected':''}>${n} ${t('svc_days_word')}</option>`).join('')}</select></div>` : ''}
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" id="btn-cancel-job">${t('btn_cancel')}</button>
        <button class="btn btn-primary" id="btn-save-job">${t('svc_save_job')}</button>
      </div>
      ${d.id ? `<div class="svc-row-actions" style="margin:6px 0 0;"><button type="button" class="btn btn-ghost btn-sm" id="btn-print-job">🖨 ${t('svc_print_invoice')}</button><button type="button" class="btn btn-ghost btn-sm" id="btn-delete-job" style="color:var(--tomato);">${t('svc_delete_job')}</button></div>` : ''}
    </div>
  </div>`;
}
function readJobDraftFromDom(){
  const g = (id)=>document.getElementById(id);
  if(g('job-client')) draftJob.client = g('job-client').value.trim();
  if(g('job-service')) draftJob.serviceName = g('job-service').value.trim();
  if(g('job-date') && g('job-date').value) draftJob.date = g('job-date').value;
  if(g('job-price')) draftJob.price = g('job-price').value;
  if(g('job-due')) draftJob.dueDays = parseInt(g('job-due').value,10)||15;
  const c = (bizProfile.catalog||[]).find(x=>x.name.toLowerCase()===draftJob.serviceName.toLowerCase());
  draftJob.serviceId = c ? c.id : null;
}
// Guarda el trabajo (nuevo o editado) y sus gastos a mano pendientes. Devuelve el
// trabajo guardado o null si faltan cliente/precio.
function saveJobFromDraft(){
  readJobDraftFromDom();
  const d = draftJob;
  const price = parseFloat(d.price);
  if(!d.client || !(price>=0) || isNaN(price)){ jobModalError = t('svc_job_err'); render(); return null; }
  // 4. Choque de equipo: se avisa y se deja decidir.
  const clash = svcClash(d);
  if(clash && !confirm(t('svc_clash_confirm').replace('{asset}', (assetById(d.assetId)||{}).name||'').replace('{client}', clash.client||''))) return null;
  let job = d.id ? jobById(d.id) : null;
  const dueDate = d.paid ? null : addDaysStr(d.date, d.dueDays||15);
  const repeat = (!d.parentId && SVC_REPEATS.indexOf(d.repeat)>=0) ? d.repeat : null;
  if(job){
    const wasPaid = job.paid;
    // Cambió la regla del contrato: las próximas salen desde la fecha nueva.
    if(job.repeat!==repeat || job.date!==d.date) job.lastGenerated = null;
    Object.assign(job, { client:d.client, serviceName:d.serviceName, serviceId:d.serviceId, date:d.date, assetId:d.assetId||null,
      price: Math.round(price*100)/100, paid:d.paid, dueDate, dueDays: d.dueDays||15, repeat, paidDate: d.paid ? (wasPaid ? (job.paidDate||localDateStr()) : localDateStr()) : null,
      lastEditedAt: new Date().toISOString() });
  } else {
    job = { id: uid('job'), type:'service', date:d.date, client:d.client, serviceName:d.serviceName, serviceId:d.serviceId, assetId:d.assetId||null,
      price: Math.round(price*100)/100, paid:d.paid, dueDate, dueDays: d.dueDays||15, repeat, paidDate: d.paid ? localDateStr() : null,
      items: [], createdAt: new Date().toISOString(), byLabel: (typeof currentUserLabel==='function' && currentUser) ? currentUserLabel() : '' };
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
        <input id="asset-name" type="text" maxlength="60" value="${escapeHtml(d.name)}" placeholder="${t('svc_asset_name_ph')}">
        ${assetModalError ? `<div style="font-size:calc(12px * var(--fs, 1));color:var(--tomato);margin-top:4px;">${assetModalError}</div>` : ''}
      </div>
      <div class="field"><label for="asset-model">${t('svc_asset_model')}</label><input id="asset-model" type="text" maxlength="60" value="${escapeHtml(d.model)}" placeholder="Isuzu NPR"></div>
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
        ${useOdo(a) ? `<div class="field"><label for="maint-km">${tu('svc_every_km_label')}</label><input id="maint-km" type="number" min="1" step="1" inputmode="numeric" value="${escapeHtml(d.everyKm)}" placeholder="5000"></div>` : ''}
        <div class="field"><label for="maint-months">${t('svc_every_months_label')}</label><input id="maint-months" type="number" min="1" step="1" inputmode="numeric" value="${escapeHtml(d.everyMonths)}" placeholder="3"></div>
      </div>
      <div class="field-row">
        <div class="field"><label for="maint-last">${t('svc_last_done')}</label><input id="maint-last" type="date" value="${escapeHtml(d.lastDate)}"></div>
        ${useOdo(a) ? `<div class="field"><label for="maint-lastkm">${tu('svc_last_km')}</label><input id="maint-lastkm" type="number" min="0" step="1" inputmode="numeric" value="${escapeHtml(d.lastKm)}" placeholder="—"></div>` : ''}
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
  if(!d.name || (!everyKm && !everyMonths)){ maintModalError = t('svc_maint_err'); render(); return false; }
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
        ${useOdo(a) ? `<div class="field"><label for="mlog-km">${tu('svc_log_km')}</label><input id="mlog-km" type="number" min="0" step="1" inputmode="numeric" value="${(a.km===null||a.km===undefined)?'':escapeHtml(a.km)}" placeholder="—"></div>` : ''}
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
  if(plan){ plan.lastDate = date; if(km!==null) plan.lastKm = km; }
  if(km!==null) a.km = km;
  if(cost>0){
    const catM = expenseCategories.find(c=>/manten|mainten/i.test(c.name));
    receipts.push({ id: uid('r'), images: [], supplier: `${plan ? plan.name : desc} · ${a.name}`, date, total: Math.round(cost*100)/100,
      itemCount: 0, appliedItems: [], createdAt: new Date().toISOString(), purchaseIds: [], manual: true, manualKind: 'expense',
      expenseCategoryId: catM ? catM.id : null, assetId: a.id });
  }
  saveState();
  logActivity('maint_logged', a.name, plan ? plan.name : desc);
  showToast(t('svc_logged'));
  return true;
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
  const units = [['fixed', t('svc_unit_fixed')],['km', t('svc_unit_km')],['day', t('svc_unit_day')],['hour', t('svc_unit_hour')]];
  return `
  <div class="overlay" id="service-overlay">
    <div class="modal">
      <h3 class="navy">${d.id ? t('svc_service') : t('svc_service_new')}</h3>
      <div class="sub">${t('svc_catalog_sub')}</div>
      <div class="field"><label for="service-name">${t('svc_service_name')}</label>
        <input id="service-name" type="text" maxlength="60" value="${escapeHtml(d.name)}" placeholder="${t('svc_service_name_ph')}">
        ${serviceModalError ? `<div style="font-size:calc(12px * var(--fs, 1));color:var(--tomato);margin-top:4px;">${serviceModalError}</div>` : ''}
      </div>
      <div class="field"><label for="service-desc">${t('svc_service_desc')}</label><input id="service-desc" type="text" maxlength="80" value="${escapeHtml(d.desc)}" placeholder="${t('svc_service_desc_ph')}"></div>
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
    html += `<div class="recap-note">${t('recap_jobs_n').replace('{n}', String(jobs.length))}</div>`;
  }
  const perAsset = assets.map(a=>{
    const rev = jobs.filter(j=>j.assetId===a.id).reduce((s,j)=>s+(Number(j.price)||0),0);
    const exp = assetReceipts(a.id).filter(r=>inPeriod(r.date)).reduce((s,r)=>s+(Number(r.total)||0),0);
    return {a, net: rev-exp, any: rev>0 || exp>0};
  }).filter(x=>x.any);
  if(perAsset.length){
    html += `<div class="recap-section-title">${t('recap_by_asset')}</div>` + perAsset.map(x=>crow(x.a.emoji||'🚚', escapeHtml(x.a.name), (x.net<0?'−':'+')+money(Math.abs(x.net)), x.net>=0?'var(--money-pos)':'var(--money-neg)')).join('');
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
  const url = 'https://wa.me/?text='+encodeURIComponent(msg);
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
  document.querySelectorAll('[data-open-asset]').forEach(el=>{ el.onclick = ()=>svcShow(()=>{ showAssetSheet = el.dataset.openAsset; }); });
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
  // Se cierran las DOS hojas (activo y Equipo) y se redibuja ANTES de cambiar de
  // pestaña: switchToTab solo anima el carrusel y no toca los overlays, así que
  // sin el render() la ficha quedaba tapando Recibos (auditoría UX 2026-09-11).
  on('btn-asset-all-receipts', ()=>{ showAssetSheet = null; showEquipoSheet = false; render(); openReceiptsSheet(); });
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
    j.paid = true; j.paidDate = localDateStr(); j.dueDate = null;
    saveState(); logActivity('job_paid', j.client, money(j.price||0)); showToast(t('svc_marked_paid')); render();
  }; });
  document.querySelectorAll('[data-open-job]').forEach(el=>{ el.onclick = ()=>openJobModal(el.dataset.openJob); });

  /* Trabajos */
  const closeJobs = ()=>svcShow(()=>{ showJobsSheet = false; });
  overlayClose('jobs-sheet-overlay', closeJobs);
  on('btn-close-jobs-sheet', closeJobs);
  on('btn-jobs-new', ()=>openJobModal(null));
  const js = g('jobs-search');
  if(js) searchLive(js, v=>{ jobsSearch = v; });

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
  overlayClose('job-overlay', closeJobModal);
  on('btn-cancel-job', closeJobModal);
  on('btn-save-job', ()=>{ if(saveJobFromDraft()){ showToast(t('svc_job_saved')); closeJobModal(); } });
  on('btn-print-job', ()=>{ const j = jobById(draftJob.id); if(j) downloadJobPdf(j); });
  on('btn-delete-job', ()=>{
    if(!confirm(t('svc_job_delete_confirm'))) return;
    const j = jobById(draftJob.id);
    if(j){ j.deleted = true; j.deletedAt = new Date().toISOString(); saveState(); logActivity('job_deleted', j.client); }
    showToast(t('svc_job_deleted')); closeJobModal();
  });
  if(draftJob){
    const price = g('job-price');
    const refresh = ()=>{ readJobDraftFromDom(); const el = g('svc-job-profit'); if(el) el.innerHTML = jobProfitHtml(); };
    if(price) price.oninput = refresh;
    const svc = g('job-service');
    if(svc) svc.oninput = ()=>{
      // Servicio de la lista: completa el precio si todavía está vacío.
      const c = (bizProfile.catalog||[]).find(x=>x.name.toLowerCase()===svc.value.trim().toLowerCase());
      if(c && c.price>0 && price && !price.value){ price.value = String(c.price); }
      refresh();
    };
    document.querySelectorAll('[data-job-asset]').forEach(b=>{ b.onclick = ()=>{ readJobDraftFromDom(); draftJob.assetId = b.dataset.jobAsset || null; render(); }; });
    document.querySelectorAll('[data-job-paid]').forEach(b=>{ b.onclick = ()=>{ readJobDraftFromDom(); draftJob.paid = b.dataset.jobPaid==='1'; render(); }; });
    document.querySelectorAll('[data-job-repeat]').forEach(b=>{ b.onclick = ()=>{ readJobDraftFromDom(); draftJob.repeat = b.dataset.jobRepeat || null; render(); }; });
    const due = g('job-due');
    if(due) due.onchange = ()=>{ readJobDraftFromDom(); render(); };
    on('btn-job-exp-open', ()=>{ readJobDraftFromDom(); jobExpenseFormOpen = true; render(); });
    on('btn-job-exp-add', ()=>{
      readJobDraftFromDom();
      const amt = parseFloat((g('job-exp-amount')||{}).value);
      if(!(amt>0)){ showToast(t('manual_spend_err'), 'error'); return; }
      draftJob.pending.push({desc: (g('job-exp-desc')||{}).value.trim(), amount: amt, categoryId: g('job-exp-cat') ? g('job-exp-cat').value||null : null});
      jobExpenseFormOpen = false; render();
    });
    document.querySelectorAll('[data-job-exp-del]').forEach(b=>{ b.onclick = ()=>{ readJobDraftFromDom(); draftJob.pending.splice(parseInt(b.dataset.jobExpDel,10), 1); render(); }; });
    on('btn-job-scan', ()=>{
      // El recibo escaneado se cuelga de ESTE trabajo: se guarda primero.
      const job = saveJobFromDraft(); if(!job) return;
      receiptAttach = {jobId: job.id, assetId: job.assetId||null};
      showJobModal = false; draftJob = null; jobExpenseFormOpen = false;
      openScanModal();
    });
  }

  /* Modal de activo */
  overlayClose('asset-overlay', closeAssetModal);
  on('btn-cancel-asset', closeAssetModal);
  on('btn-save-asset', ()=>{ if(saveAssetFromDraft()) closeAssetModal(); });
  on('btn-delete-asset', ()=>{
    const a = assetById(draftAsset.id); if(!a) return;
    if(!confirm(t('svc_asset_delete_confirm').replace('{name}', a.name))) return;
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
    if(j.date) want.set(svcNoteId('job', j.id), {text: `${j.client||''}${j.serviceName ? ' · '+j.serviceName : ''}`, date: j.date, icon: '🚚', jobId: j.id, svcKind: 'job'});
    if(!j.paid && j.dueDate) want.set(svcNoteId('due', j.id), {text: t('svc_note_due').replace('{client}', j.client||'').replace('{amount}', money(j.price||0)), date: j.dueDate, icon: '💵', jobId: j.id, svcKind: 'due'});
  });
  (bizProfile.assets||[]).forEach(a=>(a.maint||[]).forEach(m=>{
    const st = maintStatus(m, a, today, bizProfile.maintDays);
    if(st.dueDate) want.set(svcNoteId('mt', a.id, m.id), {text: `${m.name} · ${a.name}`, date: st.dueDate, icon: m.emoji||'🔧', assetId: a.id, planId: m.id, svcKind: 'maint'});
  }));
  let changed = false;
  calNotes = calNotes.filter(n=>{
    if(!n.svcKind || want.has(n.id)) return true;
    if(!deletedCalNoteIds.includes(n.id)) deletedCalNoteIds.push(n.id);
    changed = true;
    return false;
  });
  want.forEach((w, id)=>{
    if(deletedCalNoteIds.includes(id)) return;
    const ex = calNotes.find(n=>n.id===id);
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
    if(cs.overdueCount && map.due!==today){ msgs.push([t('svc_toast_overdue').replace('{n}', String(cs.overdueCount)).replace('{amount}', money(cs.overdue)), 'error']); map.due = today; }
    else if(bizProfile.remindDays>0 && map.dueSoon!==today && cs.list.some(j=>j.dueDate && j.dueDate>today && j.dueDate<=addDaysStr(today, bizProfile.remindDays))){
      const soon = cs.list.filter(j=>j.dueDate && j.dueDate>today && j.dueDate<=addDaysStr(today, bizProfile.remindDays));
      msgs.push([t('svc_toast_due_soon').replace('{n}', String(soon.length)).replace('{days}', String(bizProfile.remindDays)).replace('{amount}', money(soon.reduce((s,j)=>s+(Number(j.price)||0),0))), 'info']); map.dueSoon = today;
    }
    else if(dueToday.length && map.dueToday!==today){ msgs.push([t('svc_toast_due_today').replace('{n}', String(dueToday.length)).replace('{amount}', money(dueToday.reduce((s,j)=>s+(Number(j.price)||0),0))), 'info']); map.dueToday = today; }
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
  const file = new File([bytes], fn, {type: 'application/pdf'});
  if(navigator.canShare && navigator.canShare({files: [file]})){
    navigator.share({files: [file], title}).catch(e=>{ if(!e || e.name !== 'AbortError') downloadBlob(file, fn); });
    return;
  }
  downloadBlob(file, fn);
}
function jobStatusLabel(j){ return j.paid ? t('svc_tag_paid') : (jobIsOverdue(j) ? t('svc_tag_overdue') : t('svc_tag_pending')); }
// Cuenta de cobro de UN trabajo, para el cliente: sin los gastos internos.
function buildJobPdf(j){
  const pdf = DustyPdf();
  const name = svcPdfHeader(pdf, t('svc_invoice_title') + ' · ' + t('rd_id_label') + ' ' + String(j.id||'').slice(-6).toUpperCase());
  const asset = j.assetId ? assetById(j.assetId) : null;
  pdf.line(`${t('svc_client')}: ${j.client||''}`, {size: 11, bold: true, lh: 18});
  pdf.line(`${t('lbl_date')}: ${j.date||''}${asset ? '   ·   '+t('svc_asset_used')+': '+asset.name : ''}`, {size: 9.5, color: [0.35, 0.35, 0.4], lh: 15});
  pdf.gap(10);
  pdf.table([{key:'desc', label: t('rd_col_desc')}, {key:'qty', label: t('rd_col_qty'), w: 70, align:'right'}, {key:'total', label: t('rp_col_total'), w: 110, align:'right'}],
    [{desc: j.serviceName || t('svc_job_edit'), qty: '1', total: money(j.price||0)}, {desc: t('rp_total'), qty: '', total: money(j.price||0), _bold: true}]);
  pdf.gap(12);
  pdf.line(`${t('svc_collect_label')}: ${jobStatusLabel(j)}${!j.paid && j.dueDate ? '   ·   '+t('svc_invoice_due')+' '+j.dueDate : ''}${j.paid && j.paidDate ? '   ·   '+t('svc_paid_on').replace('{when}', j.paidDate) : ''}`, {size: 10, bold: true, lh: 16});
  pdf.gap(6);
  pdf.line(t('svc_invoice_thanks'), {size: 9, color: [0.45, 0.45, 0.5], lh: 14});
  return pdf.build((n, total)=>({left: name + ' · ' + t('svc_invoice_title') + ' · ' + (j.date||''), right: t('rp_page').replace('{n}', n).replace('{t}', total)}));
}
function downloadJobPdf(j){
  let bytes; try{ bytes = buildJobPdf(j); }catch(e){ console.error('[Dusty] cuenta de cobro:', e); showToast(t('rp_failed'), 'error'); return; }
  const who = (j.client||'cliente').replace(/[^\w\- ]+/g, '').trim().slice(0, 24).replace(/\s+/g, '-') || 'cliente';
  svcSharePdf(bytes, `${j.date||'sin-fecha'}-${who}`, t('svc_invoice_title') + ' · ' + (j.client||''));
}
// Ficha de un activo: resultado del mes, mantenimientos con estado, gastos.
function buildAssetPdf(a){
  resetFinancialCache();
  const pdf = DustyPdf();
  const key = localMonthStr(), today = localDateStr();
  const name = svcPdfHeader(pdf, `${t('svc_tool_asset')} · ${a.name}${a.model ? ' · '+a.model : ''}`);
  const st = assetMonthStats(a, key);
  const rows = [];
  if(a.purchaseDate || a.purchasePrice>0) rows.push({label: t('svc_purchase_date'), value: a.purchaseDate||'—', note: a.purchasePrice>0 ? money(a.purchasePrice) : ''});
  if(a.km!==null && a.km!==undefined) rows.push({label: tu('svc_km'), value: svcFmtNum(a.km)+' '+distU(), note: ''});
  rows.push({label: t('svc_collected_with'), value: money(st.revenue), note: t('svc_jobs_month_n').replace('{n}', String(st.jobs))});
  rows.push({label: t('svc_expenses_month'), value: money(st.expense), note: monthLabel(key, uiLang)});
  rows.push({label: t('svc_leaves_month'), value: (st.net<0?'-':'')+money(Math.abs(st.net)), note: '', _bold: true});
  pdf.line(monthLabel(key, uiLang), {size: 12.5, bold: true, lh: 24});
  pdf.table([{key:'label', label: t('rp_col_concept')}, {key:'value', label: t('rp_col_amount'), w: 120, align:'right'}, {key:'note', label:'', w: 150, align:'right'}], rows);
  pdf.gap(14);
  pdf.line(t('svc_maints'), {size: 12.5, bold: true, lh: 24});
  const plans = (a.maint||[]);
  if(!plans.length) pdf.line(t('svc_maint_no_plan'), {size: 9.5, color: [0.5, 0.5, 0.55]});
  else pdf.table([{key:'name', label: t('svc_maint_name')}, {key:'every', label: t('svc_pdf_every'), w: 150}, {key:'last', label: t('svc_last_done'), w: 90}, {key:'status', label: t('svc_pdf_status'), w: 110, align:'right'}],
    plans.map(m=>{ const s = maintStatus(m, a, today, bizProfile.maintDays); return {name: m.name, every: [m.everyKm>0 ? tu('svc_every_km').replace('{n}', svcFmtNum(m.everyKm)) : '', m.everyMonths>0 ? t('svc_every_months').replace('{n}', String(m.everyMonths)) : ''].filter(Boolean).join(' / '), last: m.lastDate || '—', status: s.status==='none' ? t('svc_maint_no_date') : (s.status==='overdue' ? t('svc_tag_overdue')+' · ' : '') + svcMaintWhen(s)}; }));
  pdf.gap(14);
  pdf.line(t('svc_last_expenses'), {size: 12.5, bold: true, lh: 24});
  const recs = assetReceipts(a.id).sort((x,y)=>String(y.date).localeCompare(String(x.date))).slice(0, 60);
  if(!recs.length) pdf.line(t('rp_none'), {size: 9.5, color: [0.5, 0.5, 0.55]});
  else {
    let sum = 0;
    const rr = recs.map(r=>{ sum += Number(r.total)||0; return {date: r.date||'', who: (r.supplier||'').trim() || t('no_supplier_name'), cat: receiptCatName(r), total: money(r.total||0)}; });
    rr.push({date:'', who: t('rp_total'), cat:'', total: money(sum), _bold: true});
    pdf.table([{key:'date', label: t('rp_col_date'), w: 80}, {key:'who', label: t('rp_col_who')}, {key:'cat', label: t('rp_col_category'), w: 110}, {key:'total', label: t('rp_col_total'), w: 100, align:'right'}], rr);
  }
  return pdf.build((n, total)=>({left: name + ' · ' + a.name, right: t('rp_page').replace('{n}', n).replace('{t}', total)}));
}
function downloadAssetPdf(a){
  let bytes; try{ bytes = buildAssetPdf(a); }catch(e){ console.error('[Dusty] ficha de activo:', e); showToast(t('rp_failed'), 'error'); return; }
  const who = a.name.replace(/[^\w\- ]+/g, '').trim().slice(0, 24).replace(/\s+/g, '-') || 'activo';
  svcSharePdf(bytes, `${localMonthStr()}-${who}`, a.name);
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
    rows.push({date:'', client: t('svc_pdf_billed'), svc:'', status:'', total: money(billed), _bold: true});
    rows.push({date:'', client: t('svc_stat_paid_month'), svc:'', status:'', total: money(paid), _bold: true});
    rows.push({date:'', client: t('svc_stat_pending'), svc:'', status:'', total: money(billed-paid), _bold: true});
    pdf.table([{key:'date', label: t('rp_col_date'), w: 70}, {key:'client', label: t('svc_client'), w: 130}, {key:'svc', label: t('svc_service')}, {key:'status', label: t('svc_pdf_status'), w: 75}, {key:'total', label: t('rp_col_total'), w: 85, align:'right'}], rows);
    pdf.gap(14);
  }
  const per = (bizProfile.assets||[]).map(a=>{
    const rev = jobs.filter(j=>j.assetId===a.id).reduce((s,j)=>s+(Number(j.price)||0),0);
    const exp = assetReceipts(a.id).filter(r=>inPeriod(r.date)).reduce((s,r)=>s+(Number(r.total)||0),0);
    return {a, rev, exp};
  }).filter(x=>x.rev>0 || x.exp>0);
  if(per.length){
    pdf.line(t('recap_by_asset'), {size: 12.5, bold: true, lh: 24});
    pdf.table([{key:'name', label: t('svc_tool_asset')}, {key:'rev', label: t('recap_revenue_jobs'), w: 110, align:'right'}, {key:'exp', label: t('spend_expenses'), w: 110, align:'right'}, {key:'net', label: t('recap_net'), w: 110, align:'right'}],
      per.map(x=>({name: x.a.name, rev: money(x.rev), exp: money(x.exp), net: (x.rev-x.exp<0?'-':'')+money(Math.abs(x.rev-x.exp))})));
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
function svcNextDate(dateStr, repeat){
  if(repeat==='weekly') return addDaysStr(dateStr, 7);
  if(repeat==='biweekly') return addDaysStr(dateStr, 14);
  if(repeat==='monthly'){
    const d = new Date(dateStr+'T00:00:00'); const day = d.getDate();
    d.setDate(1); d.setMonth(d.getMonth()+1);
    const last = new Date(d.getFullYear(), d.getMonth()+1, 0).getDate();
    d.setDate(Math.min(day, last));
    return localDateStr(d);
  }
  return null;
}
// Genera las próximas ocurrencias de cada contrato hasta 14 días adelante. Cada
// ocurrencia es un trabajo normal (se edita, se cobra, se imprime) colgado del
// contrato por parentId; una ocurrencia borrada no se vuelve a crear. Corre al
// principio de cada saveState, antes de sincronizar el calendario.
function svcGenerateRecurring(){
  if(!usesServices()) return false;
  const horizon = addDaysStr(localDateStr(), 14);
  let changed = false;
  const today = localDateStr();
  svcJobs().filter(j=>j.repeat && SVC_REPEATS.indexOf(j.repeat)>=0 && !j.parentId).forEach(tpl=>{
    let last = tpl.lastGenerated || tpl.date, guard = 0;
    /* Solo hacia ADELANTE (auditoría UX 2026-09-11): activar "Se repite" sobre un
       trabajo de enero creaba al instante 37 trabajos pasados, todos como cobros
       vencidos. Sin lastGenerated (recién activado) se salta a la última
       ocurrencia anterior a hoy sin crear nada; recién de ahí nacen las próximas. */
    if(!tpl.lastGenerated && last < today){
      let skip = 0;
      while(skip++ < 400){ const n = svcNextDate(last, tpl.repeat); if(!n || n >= today) break; last = n; }
    }
    while(guard++ < 60){
      const next = svcNextDate(last, tpl.repeat);
      if(!next || next>horizon) break;
      const exists = outflows.some(o=>o && o.type==='service' && o.parentId===tpl.id && o.date===next);
      if(!exists){
        recordOutflow({ id: uid('job'), type:'service', date: next, client: tpl.client, serviceName: tpl.serviceName, serviceId: tpl.serviceId||null,
          assetId: tpl.assetId||null, price: tpl.price, paid: false, dueDate: addDaysStr(next, tpl.dueDays||15), paidDate: null, dueDays: tpl.dueDays||15,
          parentId: tpl.id, items: [], createdAt: new Date().toISOString(), byLabel: tpl.byLabel||'' });
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
  return svcJobs().find(j=>j.id!==d.id && j.assetId===d.assetId && j.date===d.date) || null;
}
