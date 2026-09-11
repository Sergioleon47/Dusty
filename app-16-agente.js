/* ================= EL AGENTE DE DUSTY (2026-09-11) =================
   Pedido del usuario: "un agente AI audible que haga lo que el cliente le pida":
   "ábreme una categoría", "hazme la suma", "gasté 2.900 y ponlo en gastos".

   CÓMO ESTÁ ARMADO (tres piezas, ninguna toca datos por su cuenta):
   1. El servidor (netlify/functions/agent.js) le manda a Claude el manual de
      Dusty, la lista de HERRAMIENTAS y un resumen corto de los datos del
      usuario (agentContext). Claude devuelve texto y/o llamadas a herramientas.
   2. Esta capa EJECUTA cada herramienta acá, en el teléfono, con las mismas
      funciones que usan los botones (saveState, recordOutflow, receipts.push,
      openJobModal...), con los mismos permisos (requireWriteAccess) y la misma
      sincronización. Las que ESCRIBEN se muestran primero como tarjeta de
      confirmación; las consultas y abrir pantallas corren directo.
   3. Voz: el micrófono usa el reconocimiento del sistema (Web Speech API, sin
      costo ni servidor) y la respuesta se lee con speechSynthesis. Donde no
      exista reconocimiento, el micrófono no se muestra y queda el teclado.

   Cupo propio en el servidor (agentUsed por mes / agentTotal en el trial), y
   detrás de un interruptor de Ajustes (patron_agent): apagado, no aparece. */

let agentEnabled = true;
try{ if(localStorage.getItem('patron_agent')==='off') agentEnabled = false; }catch(e){}
let agentVoiceOut = false;
try{ if(localStorage.getItem('patron_agent_voice')==='on') agentVoiceOut = true; }catch(e){}
let showAgentSheet = false;
let agentMessages = [];   // historial en formato de la API (user/assistant con bloques)
let agentUi = [];         // lo que se ve: {kind:'user'|'bot'|'card'|'note', text, ...}
let agentBusy = false;
let agentPending = null;  // {id, name, input, resolve} — herramienta esperando confirmación
let agentDraft = '';
let agentListening = false, agentRecognizer = null;
let agentError = '';

const AGENT_WRITE_TOOLS = ['add_expense','add_job','mark_paid','add_category','log_maintenance','add_asset','add_service','add_item','add_note','set_budget'];
const AGENT_MAX_HOPS = 6;

function agentAvailable(){ return agentEnabled; }
function agentSpeechSupported(){ return !!(window.SpeechRecognition || window.webkitSpeechRecognition); }

/* ---------- contexto: lo que Claude no puede saber solo ---------- */
function agentContext(){
  const lines = [];
  const today = localDateStr();
  const dt = new Date(today+'T00:00:00');
  lines.push(`Hoy: ${today} (${(CAL_NOTE_WEEKDAYS[uiLang]||CAL_NOTE_WEEKDAYS.en)[dt.getDay()]}). Idioma: ${uiLang}. Moneda con formato ${money(1234.5)}.`);
  if(businessName) lines.push(`Negocio: ${businessName}`);
  lines.push(`Perfil: vende productos=${sellsProducts()?'sí':'no'}; presta servicios=${usesServices()?'sí':'no'}; fabrica=${usesProduction()?'sí':'no'}.`);
  lines.push(`Categorías de gasto: ${expenseCategories.map(c=>c.name).join(', ') || '(ninguna)'}`);
  if(sellsProducts()){
    lines.push(`Categorías de productos: ${(categories||[]).map(c=>c.name).join(', ') || '(ninguna)'}`);
    const names = inventory.filter(i=>!isExpenseItem(i)).map(i=>i.name).slice(0, 80);
    lines.push(`Productos (${inventory.length}): ${names.join(', ') || '(ninguno)'}${inventory.length>80 ? ' …' : ''}`);
  }
  if(usesServices()){
    lines.push(`Clientes: ${svcClientNames().slice(0, 60).join(', ') || '(ninguno)'}`);
    lines.push(`Equipos/activos: ${(bizProfile.assets||[]).map(a=>a.name+(a.model?' ('+a.model+')':'')).join(', ') || '(ninguno)'}`);
    lines.push(`Servicios con precio: ${(bizProfile.catalog||[]).map(c=>`${c.name}${c.price>0?' '+svcServicePrice(c):''}`).join('; ') || '(ninguno)'}`);
    const cs = collectStats();
    lines.push(`Por cobrar: ${money(cs.pending)} (${cs.list.length} trabajos, ${cs.overdueCount} vencidos).`);
  }
  try{
    const p = budgetPace(localMonthStr());
    lines.push(p ? `Presupuesto del mes: ${money(p.budget)}, gastado ${money(p.expense)} (${Math.round(p.pct)}%).` : `Sin presupuesto fijado. Gastado este mes: ${money(spendSplitForMonth(localMonthStr()).expense)}.`);
  }catch(e){}
  return lines.join('\n');
}

/* ---------- búsqueda tolerante de nombres ---------- */
function agentNorm(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim(); }
function agentFind(list, name, getName){
  if(!name) return null;
  const q = agentNorm(name);
  const items = list.map(x=>({x, n: agentNorm(getName(x))}));
  let hit = items.find(i=>i.n===q); if(hit) return hit.x;
  hit = items.find(i=>i.n.includes(q) || q.includes(i.n)); if(hit) return hit.x;
  const toks = q.split(/\s+/).filter(Boolean);
  hit = items.find(i=>toks.every(tk=>i.n.includes(tk))); if(hit) return hit.x;
  if(typeof levenshtein==='function'){
    let best = null, bd = 99;
    items.forEach(i=>{ const d = levenshtein(i.n, q); if(d<bd){ bd = d; best = i.x; } });
    if(best && bd <= Math.max(2, Math.floor(q.length/4))) return best;
  }
  return null;
}
function agentDate(v){ return (typeof v==='string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) ? v : localDateStr(); }
function agentNum(v){ const n = Number(v); return Number.isFinite(n) ? n : null; }

/* ---------- descripción de una acción para la tarjeta de confirmación ---------- */
function agentDescribe(name, inp){
  const es = uiLang==='es';
  const cat = inp.category ? agentFind(expenseCategories, inp.category, c=>c.name) : null;
  switch(name){
    case 'add_expense': return `${inp.kind==='investment' ? (es?'Compra de mercadería':'Goods purchase') : (es?'Gasto':'Expense')} ${money(agentNum(inp.amount)||0)}${inp.description ? ' · '+inp.description : ''}${cat ? ' · '+cat.name : (inp.category ? ' · '+inp.category+(es?' (nueva)':' (new)') : '')} · ${agentDate(inp.date)===localDateStr() ? (es?'hoy':'today') : agentDate(inp.date)}`;
    case 'add_job': { const a = inp.asset ? agentFind(bizProfile.assets||[], inp.asset, x=>x.name) : null; return `${es?'Trabajo':'Job'}: ${inp.client||'?'}${inp.service ? ' · '+inp.service : ''} · ${money(agentNum(inp.price)||0)}${a ? ' · '+a.name : ''} · ${inp.paid ? (es?'cobrado':'paid') : (es?'pendiente a ':'due in ')+(inp.due_days||15)+(es?' días':' days')}${inp.repeat ? ' · 🔁 '+svcRepeatLabel(inp.repeat).toLowerCase() : ''}`; }
    case 'mark_paid': { const j = agentPickJob(inp); return j ? `${es?'Cobrar':'Mark paid'}: ${j.client} · ${money(j.price||0)} · ${svcShortDate(j.date)}` : (es?'Marcar cobrado (no encontré el trabajo)':'Mark paid (job not found)'); }
    case 'add_category': return `${es?'Categoría nueva':'New category'} "${inp.name}" (${inp.kind==='inventory' ? (es?'productos':'products') : (es?'gasto':'expense')})`;
    case 'log_maintenance': { const a = agentFind(bizProfile.assets||[], inp.asset, x=>x.name); return `${es?'Mantenimiento':'Maintenance'}: ${inp.what} · ${a ? a.name : inp.asset}${agentNum(inp.cost) ? ' · '+money(agentNum(inp.cost)) : ''}${agentNum(inp.km)!==null ? ' · '+svcFmtNum(agentNum(inp.km))+' '+distU() : ''}`; }
    case 'add_asset': return `${es?'Activo nuevo':'New asset'}: ${inp.name}${inp.model ? ' · '+inp.model : ''}${agentNum(inp.purchase_price) ? ' · '+money(agentNum(inp.purchase_price)) : ''}`;
    case 'add_service': return `${es?'Servicio nuevo':'New service'}: ${inp.name}${agentNum(inp.price) ? ' · '+money(agentNum(inp.price)) : ''}`;
    case 'add_item': return `${es?'Producto nuevo':'New item'}: ${inp.name}${agentNum(inp.qty)!==null ? ' · '+inp.qty+' '+(inp.unit||'unidad') : ''}${agentNum(inp.cost_per_unit) ? ' · '+money(agentNum(inp.cost_per_unit)) : ''}`;
    case 'add_note': return `${es?'Nota':'Note'}: "${inp.text}"${inp.date ? ' · '+inp.date : ''}`;
    case 'set_budget': return `${es?'Presupuesto mensual':'Monthly budget'}: ${money(agentNum(inp.amount)||0)}`;
  }
  return name;
}
function agentPickJob(inp){
  if(inp.job_id){ const j = jobById(inp.job_id); if(j) return j; }
  let list = svcJobs().filter(j=>!j.paid);
  if(inp.client){ const c = agentNorm(inp.client); const byC = list.filter(j=>agentNorm(j.client).includes(c) || c.includes(agentNorm(j.client))); if(byC.length) list = byC; }
  if(agentNum(inp.amount)!==null){ const byA = list.filter(j=>Math.abs((j.price||0)-agentNum(inp.amount))<0.01); if(byA.length) list = byA; }
  if(inp.date){ const byD = list.filter(j=>j.date===inp.date); if(byD.length) list = byD; }
  list.sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  return list[0] || null;
}

/* ---------- ejecución de herramientas (la app hace el trabajo) ---------- */
function agentExec(name, inp){
  inp = inp || {};
  const ok = (extra)=>JSON.stringify(Object.assign({ok:true}, extra||{}));
  const fail = (msg)=>JSON.stringify({ok:false, error: msg});
  if(AGENT_WRITE_TOOLS.indexOf(name)>=0 && !requireWriteAccess()) return fail('read-only account');
  switch(name){
    case 'add_expense': {
      const amt = agentNum(inp.amount); if(!(amt>0)) return fail('amount must be > 0');
      let cat = inp.category ? agentFind(expenseCategories, inp.category, c=>c.name) : null;
      if(!cat && inp.category){ cat = {id: uid('xcat'), name: String(inp.category).trim().slice(0,40)}; expenseCategories.push(cat); }
      const desc = String(inp.description||'').trim().slice(0,60) || (cat ? cat.name : t('manual_expense_label'));
      const rec = { id: uid('r'), images: [], supplier: desc, date: agentDate(inp.date), total: Math.round(amt*100)/100, itemCount: 0, appliedItems: [], createdAt: new Date().toISOString(), purchaseIds: [],
        manual: true, manualKind: inp.kind==='investment' ? 'investment' : 'expense', expenseCategoryId: (inp.kind!=='investment' && cat) ? cat.id : null, jobId: null, assetId: null, byAgent: true };
      receipts.push(rec); saveState(); logActivity('receipt_added', rec.supplier); render();
      return ok({receipt_id: rec.id, category: cat ? cat.name : null, date: rec.date});
    }
    case 'add_job': {
      if(!usesServices()) return fail('services mode is off');
      const price = agentNum(inp.price); if(!(price>=0) || !inp.client) return fail('client and price required');
      const asset = inp.asset ? agentFind(bizProfile.assets||[], inp.asset, x=>x.name) : null;
      const svc = inp.service ? agentFind(bizProfile.catalog||[], inp.service, x=>x.name) : null;
      const date = agentDate(inp.date), dueDays = Math.max(1, parseInt(inp.due_days,10)||15);
      const job = { id: uid('job'), type:'service', date, client: String(inp.client).trim().slice(0,60), serviceName: (svc ? svc.name : String(inp.service||'').trim()).slice(0,60), serviceId: svc ? svc.id : null,
        assetId: asset ? asset.id : null, price: Math.round(price*100)/100, paid: !!inp.paid, dueDate: inp.paid ? null : addDaysStr(date, dueDays), dueDays, paidDate: inp.paid ? localDateStr() : null,
        repeat: ['weekly','biweekly','monthly'].indexOf(inp.repeat)>=0 ? inp.repeat : null, items: [], createdAt: new Date().toISOString(), byAgent: true };
      recordOutflow(job); saveState(); logActivity('job_saved', job.client, job.serviceName); render();
      return ok({job_id: job.id, asset: asset ? asset.name : null, due_date: job.dueDate});
    }
    case 'mark_paid': {
      const j = agentPickJob(inp); if(!j) return fail('job not found');
      j.paid = true; j.paidDate = localDateStr(); j.dueDate = null; saveState(); logActivity('job_paid', j.client, money(j.price||0)); render();
      return ok({job_id: j.id, client: j.client, amount: j.price});
    }
    case 'add_category': {
      const nm = String(inp.name||'').trim().slice(0,40); if(!nm) return fail('name required');
      const list = inp.kind==='inventory' ? (categories||(categories=[])) : expenseCategories;
      const ex = agentFind(list, nm, c=>c.name);
      if(ex && agentNorm(ex.name)===agentNorm(nm)) return ok({existed:true, name: ex.name});
      list.push({id: uid(inp.kind==='inventory' ? 'cat' : 'xcat'), name: nm}); saveState(); render();
      return ok({name: nm});
    }
    case 'log_maintenance': {
      const a = agentFind(bizProfile.assets||[], inp.asset, x=>x.name); if(!a) return fail('asset not found');
      const what = String(inp.what||'').trim().slice(0,60); if(!what) return fail('what required');
      const plan = agentFind(a.maint||[], what, m=>m.name);
      const date = agentDate(inp.date), km = agentNum(inp.km), cost = agentNum(inp.cost);
      if(plan){ plan.lastDate = date; if(km!==null) plan.lastKm = km; }
      if(km!==null) a.km = km;
      if(cost>0){
        const catM = expenseCategories.find(c=>/manten|mainten/i.test(c.name));
        receipts.push({ id: uid('r'), images: [], supplier: `${plan ? plan.name : what} · ${a.name}`, date, total: Math.round(cost*100)/100, itemCount: 0, appliedItems: [], createdAt: new Date().toISOString(), purchaseIds: [],
          manual: true, manualKind: 'expense', expenseCategoryId: catM ? catM.id : null, assetId: a.id, byAgent: true });
      }
      saveState(); logActivity('maint_logged', a.name, plan ? plan.name : what); render();
      return ok({asset: a.name, plan: plan ? plan.name : null, cost: cost||0});
    }
    case 'add_asset': {
      const nm = String(inp.name||'').trim().slice(0,60); if(!nm) return fail('name required');
      const a = {id: uid('as'), name: nm, model: String(inp.model||'').trim().slice(0,60), emoji: useOdo() ? '🚚' : '🧰', purchaseDate: /^\d{4}-\d{2}-\d{2}$/.test(inp.purchase_date||'') ? inp.purchase_date : null,
        purchasePrice: agentNum(inp.purchase_price), km: agentNum(inp.km), maint: [], createdAt: new Date().toISOString()};
      bizProfile.assets.push(a); saveState(); logActivity('asset_saved', a.name); render();
      return ok({asset_id: a.id});
    }
    case 'add_service': {
      const nm = String(inp.name||'').trim().slice(0,60); if(!nm) return fail('name required');
      bizProfile.catalog.push({id: uid('sv'), name: nm, desc: String(inp.description||'').trim().slice(0,80), price: agentNum(inp.price), unit: ['fixed','km','day','hour'].indexOf(inp.unit)>=0 ? inp.unit : 'fixed'});
      saveState(); render(); return ok({name: nm});
    }
    case 'add_item': {
      const nm = String(inp.name||'').trim().slice(0,60); if(!nm) return fail('name required');
      let categoryId = null;
      if(inp.category){ let c = agentFind(categories||[], inp.category, x=>x.name); if(!c){ c = {id: uid('cat'), name: String(inp.category).trim().slice(0,40)}; (categories||(categories=[])).push(c); } categoryId = c.id; }
      const unit = ['unidad','caja','lb','kg','oz','g','ml','l'].indexOf(inp.unit)>=0 ? inp.unit : 'unidad';
      const qty = Math.max(0, agentNum(inp.qty)||0);
      const item = { id: uid('i'), name: nm, unit, costPerUnit: agentNum(inp.cost_per_unit)||0, updated:false, qtyOnHand: qty, photo: null, salePrice: agentNum(inp.sale_price)||0, stockFullRef: qty||null, sku: '', supplier: '', categoryId };
      if(currentUser){ item.lastEditedBy = currentUserLabel(); item.lastEditedAt = new Date().toISOString(); }
      inventory.push(item); saveState(); logActivity('item_created', item.name); render();
      return ok({item_id: item.id});
    }
    case 'add_note': {
      const text = String(inp.text||'').trim().slice(0,120); if(!text) return fail('text required');
      const n = buildCalNote(text, inp.date && /^\d{4}-\d{2}-\d{2}$/.test(inp.date) ? inp.date : localDateStr());
      calNotes.push(Object.assign({id: uid('note'), createdAt: new Date().toISOString()}, n)); saveState(); logActivity('note_created', text); render();
      return ok({date: n.date, recurring: !!n.recurring});
    }
    case 'set_budget': {
      const amt = agentNum(inp.amount); if(!(amt>0)) return fail('amount must be > 0');
      setMonthlyBudget(amt); saveState(); render(); return ok({budget: amt});
    }
    case 'query': return agentQuery(inp);
    case 'open_screen': return agentOpen(inp.screen);
    case 'print': {
      if(inp.what==='month_report'){ downloadMonthReport(/^\d{4}-\d{2}$/.test(inp.month||'') ? inp.month : localMonthStr()); return ok(); }
      if(inp.what==='job_invoice'){ const j = agentPickJob({client: inp.client}) || svcJobs().filter(j=>agentNorm(j.client).includes(agentNorm(inp.client||''))).sort((a,b)=>String(b.date).localeCompare(String(a.date)))[0]; if(!j) return fail('job not found'); downloadJobPdf(j); return ok({client: j.client}); }
      if(inp.what==='asset_sheet'){ const a = agentFind(bizProfile.assets||[], inp.asset, x=>x.name); if(!a) return fail('asset not found'); downloadAssetPdf(a); return ok({asset: a.name}); }
      return fail('unknown');
    }
  }
  return fail('unknown tool');
}
function agentQuery(inp){
  const today = localDateStr();
  const from = inp.from && /^\d{4}-\d{2}-\d{2}$/.test(inp.from) ? inp.from : today.slice(0,8)+'01';
  const to = inp.to && /^\d{4}-\d{2}-\d{2}$/.test(inp.to) ? inp.to : today;
  const inRange = d => d>=from && d<=to;
  const q = agentNorm(inp.text||'');
  switch(inp.topic){
    case 'collect': { const cs = collectStats(); return JSON.stringify({pending: cs.pending, overdue: cs.overdue, overdue_count: cs.overdueCount, paid_this_month: cs.paidMonth,
      jobs: cs.list.filter(j=>!q || agentNorm(j.client).includes(q)).slice(0,25).map(j=>({job_id:j.id, client:j.client, service:j.serviceName, date:j.date, due:j.dueDate, amount:j.price, overdue: jobIsOverdue(j)}))}); }
    case 'budget': { const p = budgetPace(localMonthStr()); return JSON.stringify(p ? {budget:p.budget, spent:p.expense, left:p.left, pct:Math.round(p.pct), status:p.status, projected:p.projected} : {budget:null, spent: spendSplitForMonth(localMonthStr()).expense}); }
    case 'agenda': { const days = Math.min(31, Math.max(1, parseInt(inp.days,10)||7)); const out = []; for(let i=0;i<days;i++){ const d = addDaysStr(today,i); calNotesOnDate(calNotes, d).forEach(n=>out.push({date:d, kind:n.svcKind||'note', text:n.text})); } return JSON.stringify({from: today, days, items: out.slice(0,40)}); }
    case 'expenses': { const cache = finCache(); const rows = receipts.filter(r=>r && inRange(r.date)); const byCat = {}; let total = 0;
      rows.forEach(r=>{ const s = receiptSplit(r, cache); const k = receiptCatName(r) || (s.invested>0 && !(s.expense>0) ? t('manual_kind_investment') : t('categories_uncategorized')); byCat[k] = (byCat[k]||0) + (r.total||0); total += r.total||0; });
      const filtered = inp.category ? rows.filter(r=>agentNorm(receiptCatName(r)).includes(agentNorm(inp.category))) : rows;
      return JSON.stringify({from, to, total, by_category: byCat, ...(inp.category ? {category_total: filtered.reduce((s,r)=>s+(r.total||0),0), items: filtered.slice(-20).map(r=>({date:r.date, description:r.supplier, amount:r.total}))} : {count: rows.length})}); }
    case 'jobs': { const list = svcJobs().filter(j=>inRange(j.date) && (!q || agentNorm(j.client+' '+(j.serviceName||'')).includes(q))); return JSON.stringify({from, to, count: list.length, billed: list.reduce((s,j)=>s+(j.price||0),0), paid: list.filter(j=>j.paid).reduce((s,j)=>s+(j.price||0),0), jobs: list.slice(0,30).map(j=>({job_id:j.id, date:j.date, client:j.client, service:j.serviceName, amount:j.price, paid:j.paid, asset:(assetById(j.assetId)||{}).name||null}))}); }
    case 'inventory': { const rows = stockRowsData(); const hit = q ? rows.filter(r=>agentNorm(r.ing.name).includes(q)) : rows; return JSON.stringify({total_items: inventory.length, critical: rows.filter(r=>r.status==='crit').map(r=>r.ing.name).slice(0,30), items: hit.slice(0,30).map(r=>({name:r.ing.name, qty:r.ing.qtyOnHand, unit:r.ing.unit, cost:r.ing.costPerUnit, sale_price:r.ing.salePrice, status:r.status}))}); }
    case 'month': { const key = (inp.from && /^\d{4}-\d{2}/.test(inp.from)) ? inp.from.slice(0,7) : localMonthStr(); const f = periodFinancials(key); return JSON.stringify({month:key, revenue:f.revenue, cogs:f.cogs, expenses:f.expense, invested:f.invested, net:f.net, receipts:f.receiptsCount, jobs: jobsForMonth(key).length}); }
    case 'assets': { const t0 = today; return JSON.stringify({assets: (bizProfile.assets||[]).map(a=>{ const st = assetMonthStats(a, localMonthStr()); return {name:a.name, model:a.model, km:a.km, month_revenue:st.revenue, month_expense:st.expense, maintenance:(a.maint||[]).map(m=>{ const s = maintStatus(m, a, t0, bizProfile.maintDays); return {name:m.name, status:s.status, when: svcMaintWhen(s)}; })}; })}); }
    case 'services': return JSON.stringify({services: (bizProfile.catalog||[]).map(c=>({name:c.name, price:c.price, unit:c.unit, description:c.desc}))});
    case 'categories': return JSON.stringify({expense: expenseCategories.map(c=>c.name), inventory: (categories||[]).map(c=>c.name)});
  }
  return JSON.stringify({ok:false, error:'unknown topic'});
}
function agentOpen(screen){
  const closeAgent = ()=>{ showAgentSheet = false; };
  switch(screen){
    case 'collect': closeAgent(); showCollectSheet = true; break;
    case 'jobs': closeAgent(); showJobsSheet = true; break;
    case 'equipment': closeAgent(); if(TAB_ORDER[1]==='equipo') activeTab = 'equipo'; else showEquipoSheet = true; break;
    case 'inventory': closeAgent(); if(TAB_ORDER[1]==='inventario') activeTab = 'inventario'; else return JSON.stringify({ok:false, error:'no inventory tab'}); break;
    case 'receipts': closeAgent(); if(TAB_ORDER[2]==='recibos') activeTab = 'recibos'; else showReceiptsSheet = true; break;
    case 'budget': closeAgent(); openBudgetModal(); return JSON.stringify({ok:true});
    case 'recap': closeAgent(); monthRecapKey = localMonthStr(); recapMode = 'month'; showMonthRecap = true; break;
    case 'settings': closeAgent(); showAlertSettingsModal = true; break;
    case 'services': closeAgent(); showServicesSheet = true; break;
    case 'scan': closeAgent(); render(); openScanModal(); return JSON.stringify({ok:true});
    default: return JSON.stringify({ok:false, error:'unknown screen'});
  }
  render();
  return JSON.stringify({ok:true});
}

/* ---------- la conversación ---------- */
function agentPush(kind, text, extra){ agentUi.push(Object.assign({kind, text: text||'', at: Date.now()}, extra||{})); }
async function agentCall(){
  const parsed = await callDustyAI('/.netlify/functions/agent', { messages: agentMessages, context: agentContext(), lang: uiLang }, {
    notFoundKey: 'agent_err_generic', genericKey: 'agent_err_generic',
    onTrialQuota: ()=>{ if(typeof openUpgradeModal==='function') openUpgradeModal(); }
  });
  return parsed;
}
function agentWaitConfirm(block){
  return new Promise(resolve=>{
    agentPending = {id: block.id, name: block.name, input: block.input||{}, resolve};
    agentPush('card', agentDescribe(block.name, block.input||{}), {toolId: block.id});
    render(); agentScrollEnd();
  });
}
async function agentSend(text){
  text = String(text||'').trim();
  if(!text || agentBusy) return;
  if(!currentUser && typeof everHadRealAccount==='function' && everHadRealAccount()){ openAuthModal(t('agent_needs_account')); return; }
  agentDraft = ''; agentError = '';
  agentPush('user', text);
  agentMessages.push({role:'user', content:[{type:'text', text}]});
  if(agentMessages.length>28) agentMessages = agentMessages.slice(-28);
  agentBusy = true; render(); agentScrollEnd();
  try{
    for(let hop=0; hop<AGENT_MAX_HOPS; hop++){
      const res = await agentCall();
      const content = Array.isArray(res.content) ? res.content : [];
      agentMessages.push({role:'assistant', content});
      const texts = content.filter(b=>b.type==='text' && b.text && b.text.trim());
      texts.forEach(b=>agentPush('bot', b.text.trim()));
      const uses = content.filter(b=>b.type==='tool_use');
      if(texts.length) { render(); agentScrollEnd(); }
      if(!uses.length || res.stop_reason!=='tool_use') { if(texts.length) agentSpeak(texts.map(b=>b.text).join(' ')); break; }
      const results = [];
      for(const u of uses){
        let result;
        if(AGENT_WRITE_TOOLS.indexOf(u.name)>=0){
          const yes = await agentWaitConfirm(u);
          result = yes ? agentExec(u.name, u.input) : JSON.stringify({ok:false, cancelled:true});
          if(yes){ const card = agentUi.find(c=>c.toolId===u.id); if(card) card.done = JSON.parse(result).ok ? 'ok' : 'fail'; }
        } else {
          try{ result = agentExec(u.name, u.input); }catch(e){ result = JSON.stringify({ok:false, error: String(e && e.message || e)}); }
        }
        results.push({type:'tool_result', tool_use_id: u.id, content: String(result).slice(0, 3500)});
      }
      agentMessages.push({role:'user', content: results});
      render(); agentScrollEnd();
    }
  }catch(e){
    agentError = (e && e.message) || t('agent_err_generic');
    agentPush('note', agentError);
    // El último turno quedó sin respuesta: se saca para que la conversación siga válida.
    if(agentMessages.length && agentMessages[agentMessages.length-1].role==='user') agentMessages.pop();
  }
  agentBusy = false; agentPending = null; render(); agentScrollEnd();
}
function agentScrollEnd(){ requestAnimationFrame(()=>{ const el = document.getElementById('agent-thread'); if(el) el.scrollTop = el.scrollHeight; }); }
function agentReset(){ agentMessages = []; agentUi = []; agentPending = null; agentError = ''; }

/* ---------- voz ---------- */
function agentSpeak(text){
  if(!agentVoiceOut || !('speechSynthesis' in window)) return;
  try{
    const clean = String(text).replace(/[*_#`>]/g,'').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu,'').trim();
    if(!clean) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = uiLang==='es' ? 'es-419' : 'en-US'; u.rate = 1.02;
    window.speechSynthesis.speak(u);
  }catch(e){}
}
function agentListen(){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR) return;
  if(agentListening){ try{ agentRecognizer && agentRecognizer.stop(); }catch(e){} return; }
  try{ window.speechSynthesis && window.speechSynthesis.cancel(); }catch(e){}
  const rec = new SR();
  rec.lang = uiLang==='es' ? 'es-419' : 'en-US'; rec.interimResults = true; rec.maxAlternatives = 1; rec.continuous = false;
  let finalText = '';
  rec.onresult = (ev)=>{
    let interim = '';
    for(let i=ev.resultIndex; i<ev.results.length; i++){ const r = ev.results[i]; if(r.isFinal) finalText += r[0].transcript; else interim += r[0].transcript; }
    const inp = document.getElementById('agent-input'); if(inp) inp.value = (finalText || interim).trim();
  };
  rec.onerror = ()=>{ agentListening = false; agentRecognizer = null; render(); };
  rec.onend = ()=>{
    agentListening = false; agentRecognizer = null;
    const inp = document.getElementById('agent-input');
    const txt = (finalText || (inp ? inp.value : '')).trim();
    render();
    if(txt) agentSend(txt);
  };
  agentRecognizer = rec; agentListening = true; render();
  try{ rec.start(); }catch(e){ agentListening = false; agentRecognizer = null; render(); }
}

/* ---------- pantalla ---------- */
function agentSuggestions(){
  const es = uiLang==='es';
  const s = [];
  if(usesServices()){ s.push(es ? '¿Quién me debe?' : 'Who owes me?'); s.push(es ? 'Trabajo para … hoy, $' : 'Job for … today, $'); }
  s.push(es ? 'Gasté 500 en combustible' : 'Spent 500 on fuel');
  s.push(es ? '¿Qué tengo mañana?' : "What's on tomorrow?");
  s.push(es ? '¿Cómo voy con el presupuesto?' : 'How is my budget?');
  if(sellsProducts()) s.push(es ? '¿Qué productos están críticos?' : 'Which items are critical?');
  return s.slice(0,5);
}
function agentSheet(){
  const es = uiLang==='es';
  const bubbles = agentUi.map(m=>{
    if(m.kind==='user') return `<div class="ag-msg ag-user">${escapeHtml(m.text)}</div>`;
    if(m.kind==='bot') return `<div class="ag-msg ag-bot">${escapeHtml(m.text)}</div>`;
    if(m.kind==='note') return `<div class="ag-note">${escapeHtml(m.text)}</div>`;
    if(m.kind==='card'){
      const pending = agentPending && agentPending.id===m.toolId;
      return `<div class="ag-card ${m.done==='ok'?'done':m.done==='fail'?'fail':pending?'':'cancelled'}">
        <div class="ag-card-text">${m.done==='ok' ? '✅ ' : m.done==='fail' ? '⚠️ ' : ''}${escapeHtml(m.text)}</div>
        ${pending ? `<div class="ag-card-actions"><button type="button" class="btn btn-ghost btn-sm" id="btn-agent-cancel">${t('btn_cancel')}</button><button type="button" class="btn btn-primary btn-sm" id="btn-agent-confirm">${t('agent_confirm')}</button></div>` : (!m.done ? `<div class="ag-card-sub">${t('agent_cancelled')}</div>` : '')}
      </div>`;
    }
    return '';
  }).join('');
  const body = `
    <div class="ag-thread" id="agent-thread">
      ${agentUi.length===0 ? `
      <div class="ag-hello">
        <div class="ag-hello-mark">✨</div>
        <b>${t('agent_hello_title')}</b>
        <span>${t('agent_hello_sub')}</span>
        <div class="ag-chips">${agentSuggestions().map(s=>`<button type="button" class="category-chip" data-agent-say="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join('')}</div>
      </div>` : bubbles}
      ${agentBusy && !agentPending ? `<div class="ag-msg ag-bot ag-typing"><i></i><i></i><i></i></div>` : ''}
    </div>
    <div class="ag-composer">
      ${agentSpeechSupported() ? `<button type="button" class="ag-mic ${agentListening?'on':''}" id="btn-agent-mic" title="${t('agent_mic')}" aria-label="${t('agent_mic')}">${agentListening ? '<span class="ag-mic-dot"></span>' : lineIcon('camera',0) ? '' : ''}<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><path d="M12 17v4"/><path d="M8 21h8"/></svg></button>` : ''}
      <input id="agent-input" type="text" value="${escapeHtml(agentDraft)}" placeholder="${agentListening ? t('agent_listening') : t('agent_placeholder')}" autocomplete="off" ${agentBusy?'disabled':''}>
      <button type="button" class="ag-send" id="btn-agent-send" title="${t('agent_send')}" aria-label="${t('agent_send')}" ${agentBusy?'disabled':''}><svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></svg></button>
    </div>`;
  return `
  <div class="overlay sheet-overlay" id="agent-sheet-overlay">
    <div class="full-sheet ag-sheet">
      <div class="full-sheet-bar">
        <strong>✨ ${t('agent_title')}</strong>
        <div style="display:flex;gap:8px;align-items:center;">
          ${'speechSynthesis' in window ? `<button type="button" class="sheet-close ${agentVoiceOut?'ag-on':''}" id="btn-agent-voice" title="${t('agent_voice_out')}" aria-label="${t('agent_voice_out')}" aria-pressed="${agentVoiceOut}">${agentVoiceOut ? '🔊' : '🔇'}</button>` : ''}
          ${agentUi.length ? `<button type="button" class="sheet-close" id="btn-agent-reset" title="${t('agent_new_chat')}" aria-label="${t('agent_new_chat')}">↺</button>` : ''}
          <button type="button" class="sheet-close" id="btn-close-agent-sheet" aria-label="${t('btn_close')}">
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" stroke-width="2.2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
      </div>
      <div class="full-sheet-body ag-body">${body}</div>
    </div>
  </div>`;
}
// Botón del topbar (junto a Ajustes). Solo con el asistente prendido.
function agentTopbarButtonHtml(){
  if(!agentAvailable()) return '';
  return `<button class="lang-toggle ag-topbtn" id="btn-agent" title="${t('agent_title')}" aria-label="${t('agent_title')}">✨</button>`;
}
// Tarjeta de Ajustes: prender/apagar el asistente y la voz.
function agentSettingsCard(){
  const row = (id, label, sub, on)=>`
        <div class="pulse-row">
          <div class="pulse-text"><b>${label}</b><small>${sub}</small></div>
          <span class="pulse-state">${on ? t('switch_on') : t('switch_off')}</span>
          <label class="pulse-switch" aria-label="${label}"><input type="checkbox" id="${id}" ${on?'checked':''}><i></i></label>
        </div>`;
  return `
      <div class="settings-card">
        ${settingsCardHeader('tag','var(--navy-wash)','var(--navy)','✨ '+t('agent_title'))}
        <div class="svc-biz-rows">
        ${row('agent-toggle', t('agent_set_on'), t('agent_set_on_sub'), agentEnabled)}
        ${'speechSynthesis' in window ? row('agent-voice-toggle', t('agent_voice_out'), t('agent_voice_out_sub'), agentVoiceOut) : ''}
        </div>
        <div class="helper-note" style="margin:10px 0 0;">${t('agent_set_note')}</div>
      </div>`;
}

/* ---------- eventos ---------- */
function attachAgentEvents(){
  const g = (id)=>document.getElementById(id);
  const on = (id, fn)=>{ const el = g(id); if(el) el.onclick = fn; };
  on('btn-agent', ()=>svcShow(()=>{ showAgentSheet = true; }));
  const ov = g('agent-sheet-overlay');
  if(ov){
    const close = ()=>{ try{ agentRecognizer && agentRecognizer.stop(); }catch(e){} try{ window.speechSynthesis && window.speechSynthesis.cancel(); }catch(e){} svcShow(()=>{ showAgentSheet = false; }); };
    ov.onmousedown = (e)=>{ if(e.target===ov) close(); };
    on('btn-close-agent-sheet', close);
    on('btn-agent-reset', ()=>{ agentReset(); render(); });
    on('btn-agent-voice', ()=>{ agentVoiceOut = !agentVoiceOut; try{ localStorage.setItem('patron_agent_voice', agentVoiceOut ? 'on' : 'off'); }catch(e){} if(!agentVoiceOut){ try{ window.speechSynthesis.cancel(); }catch(e){} } render(); });
    on('btn-agent-mic', agentListen);
    const inp = g('agent-input');
    if(inp){
      inp.oninput = ()=>{ agentDraft = inp.value; };
      inp.onkeydown = (e)=>{ if(e.key==='Enter'){ e.preventDefault(); agentSend(inp.value); } };
    }
    on('btn-agent-send', ()=>{ const i = g('agent-input'); if(i) agentSend(i.value); });
    document.querySelectorAll('[data-agent-say]').forEach(b=>{ b.onclick = ()=>{ const s = b.dataset.agentSay; if(/…/.test(s)){ const i = g('agent-input'); if(i){ i.value = s.replace('…','').replace(/\s+/g,' ').trim()+' '; agentDraft = i.value; } return; } agentSend(s); }; });
    on('btn-agent-confirm', ()=>{ const p = agentPending; if(!p) return; agentPending = null; p.resolve(true); });
    on('btn-agent-cancel', ()=>{ const p = agentPending; if(!p) return; agentPending = null; const card = agentUi.find(c=>c.toolId===p.id); if(card) card.done = null; p.resolve(false); });
  }
  const tg = g('agent-toggle');
  if(tg) tg.onchange = ()=>{ agentEnabled = !!tg.checked; try{ localStorage.setItem('patron_agent', agentEnabled ? 'on' : 'off'); }catch(e){} render(); };
  const vt = g('agent-voice-toggle');
  if(vt) vt.onchange = ()=>{ agentVoiceOut = !!vt.checked; try{ localStorage.setItem('patron_agent_voice', agentVoiceOut ? 'on' : 'off'); }catch(e){} render(); };
}
