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
let agentAttach = [];      // fotos listas para mandar: {file, base64, mediaType, thumb}
let agentLastFiles = [];   // las de la última vuelta, por si el agente las deriva al escáner
let showAgentCam = false;

const AGENT_WRITE_TOOLS = ['add_expense','add_job','mark_paid','add_category','log_maintenance','add_asset','add_service','add_item','add_note','set_budget',
  // Corregir / ajustar / borrar (2026-09-11): mismas confirmaciones que el resto.
  'adjust_stock','update_item','delete_item','update_expense','delete_expense','update_job','delete_job','update_asset','add_maintenance_plan','update_service','delete_service','rename_category','delete_category','delete_note',
  // Cotizaciones y clientes (app-17, 2026-09-11): crear/mandar/aceptar cotizaciones y guardar datos de clientes.
  'create_quote','quote_action','add_client','update_client'];
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
    // Cotizaciones y clientes guardados (app-17).
    if(typeof quotesAgentContext==='function') quotesAgentContext().forEach(l=>lines.push(l));
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
// Fecha real (isValidDateStr): '2026-02-30' tiene la forma pero no existe.
function agentDate(v){ return isValidDateStr(v) ? v : localDateStr(); }
function agentNum(v){ const n = Number(v); return Number.isFinite(n) ? n : null; }

/* ---------- descripción de una acción para la tarjeta de confirmación ---------- */
function agentDescribe(name, inp){
  const es = uiLang==='es';
  const cat = inp.category ? agentFind(expenseCategories, inp.category, c=>c.name) : null;
  switch(name){
    case 'add_expense': return `${inp.kind==='investment' ? (es?'Compra de mercadería':'Goods purchase') : (es?'Gasto':'Expense')} ${money(agentNum(inp.amount)||0)}${inp.description ? ' · '+inp.description : ''}${cat ? ' · '+cat.name : (inp.category ? ' · '+inp.category+(es?' (nueva)':' (new)') : '')} · ${agentDate(inp.date)===localDateStr() ? (es?'hoy':'today') : agentDate(inp.date)}`;
    case 'add_job': { const a = inp.asset ? agentFind(bizProfile.assets||[], inp.asset, x=>x.name) : null; return `${es?'Trabajo':'Job'}: ${inp.client||'?'}${inp.service ? ' · '+inp.service : ''} · ${money(agentNum(inp.price)||0)}${a ? ' · '+a.name : ''}${inp.end_date ? ' · '+(es?'hasta ':'until ')+inp.end_date : ''} · ${inp.paid ? (es?'cobrado':'paid') : (es?'pendiente a ':'due in ')+(inp.due_days||15)+(es?' días':' days')}${inp.repeat ? ' · 🔁 '+svcRepeatLabel(inp.repeat).toLowerCase() : ''}`; }
    case 'mark_paid': { const j = agentPickJob(inp); return j ? `${es?'Cobrar':'Mark paid'}: ${j.client} · ${money(j.price||0)} · ${svcShortDate(j.date)}` : (es?'Marcar cobrado (no encontré el trabajo)':'Mark paid (job not found)'); }
    case 'add_category': return `${es?'Categoría nueva':'New category'} "${inp.name}" (${inp.kind==='inventory' ? (es?'productos':'products') : (es?'gasto':'expense')})`;
    case 'log_maintenance': { const a = agentFind(bizProfile.assets||[], inp.asset, x=>x.name); return `${es?'Mantenimiento':'Maintenance'}: ${inp.what} · ${a ? a.name : inp.asset}${agentNum(inp.cost) ? ' · '+money(agentNum(inp.cost)) : ''}${agentNum(inp.km)!==null ? ' · '+svcFmtNum(agentNum(inp.km))+' '+distU() : ''}`; }
    case 'add_asset': return `${es?'Activo nuevo':'New asset'}: ${inp.name}${inp.model ? ' · '+inp.model : ''}${agentNum(inp.purchase_price) ? ' · '+money(agentNum(inp.purchase_price)) : ''}`;
    case 'add_service': return `${es?'Servicio nuevo':'New service'}: ${inp.name}${agentNum(inp.price) ? ' · '+money(agentNum(inp.price)) : ''}`;
    // Cotizaciones y clientes (app-17).
    case 'create_quote': return typeof quoteDescribeForAgent==='function' ? quoteDescribeForAgent(inp) : `${es?'Cotización':'Quote'}: ${inp.client||'?'}`;
    case 'quote_action': { const act = {send_whatsapp: es?'Mandar por WhatsApp':'Send by WhatsApp', send_pdf: es?'Compartir el PDF':'Share the PDF', send_email: es?'Mandar por correo':'Send by email', accept: es?'Aceptada → crear el trabajo':'Accepted → create the job', reject: es?'Marcar rechazada':'Mark rejected', delete: es?'Eliminar':'Delete'}[inp.action] || inp.action; const q = typeof agentPickQuote==='function' ? agentPickQuote(inp) : null; return `${es?'Cotización':'Quote'}${q ? ' #'+quoteNum(q)+' · '+q.client+' · '+money(quoteTotals(q).total) : (inp.client ? ' · '+inp.client : '')}: ${act}`; }
    case 'add_client': case 'update_client': return `${name==='add_client' ? (es?'Cliente nuevo':'New client') : (es?'Cliente':'Client')}: ${inp.new_name||inp.name||'?'}${inp.phone ? ' · 📞 '+inp.phone : ''}${inp.email ? ' · ✉️ '+inp.email : ''}${inp.notes ? ' · '+String(inp.notes).slice(0,40) : ''}`;
    case 'add_item': return `${es?'Producto nuevo':'New item'}: ${inp.name}${agentNum(inp.qty)!==null ? ' · '+inp.qty+' '+(inp.unit||'unidad') : ''}${agentNum(inp.cost_per_unit) ? ' · '+money(agentNum(inp.cost_per_unit)) : ''}`;
    case 'add_note': return `${es?'Nota':'Note'}: "${inp.text}"${inp.date ? ' · '+inp.date : ''}`;
    case 'set_budget': return `${es?'Presupuesto mensual':'Monthly budget'}: ${money(agentNum(inp.amount)||0)}`;
    case 'adjust_stock': { const it = agentPickItem(inp.item); const nm = it ? it.name : (inp.item||'?'); const q = agentNum(inp.qty)||0; const u = it ? unitLabel(it.unit) : '';
      if(inp.mode==='add') return `${es?'Entra stock':'Stock in'}: +${q} ${u} ${nm}`;
      if(inp.mode==='set') return `${es?'Stock contado':'Counted stock'}: ${nm} = ${q} ${u}`;
      const r = inp.reason==='loss' ? (es?'Merma':'Loss') : inp.reason==='internal' ? (es?'Consumo propio':'Internal use') : (es?'Venta':'Sale');
      const pr = agentNum(inp.price)!==null ? agentNum(inp.price) : (it ? (Number(it.salePrice)||0) : 0);
      return `${r}: ${q} ${u} ${nm}${inp.reason==='sale'||!inp.reason ? ' · '+money(q*pr) : ''}`; }
    case 'update_item': { const it = agentPickItem(inp.item); const ch = []; if(inp.name) ch.push((es?'nombre → ':'name → ')+inp.name); if(agentNum(inp.cost_per_unit)!==null) ch.push((es?'costo ':'cost ')+money(agentNum(inp.cost_per_unit))); if(agentNum(inp.sale_price)!==null) ch.push((es?'precio ':'price ')+money(agentNum(inp.sale_price))); if(inp.unit) ch.push((es?'unidad ':'unit ')+inp.unit); if(inp.category) ch.push((es?'categoría ':'category ')+inp.category); if(agentNum(inp.full_stock)!==null) ch.push((es?'lleno = ':'full = ')+agentNum(inp.full_stock));
      return `${es?'Editar producto':'Edit item'}: ${it ? it.name : inp.item} · ${ch.join(' · ')||'—'}`; }
    case 'delete_item': { const it = agentPickItem(inp.item); return `${es?'ELIMINAR producto':'DELETE item'}: ${it ? it.name+' ('+(it.qtyOnHand||0)+' '+unitLabel(it.unit)+')' : inp.item}`; }
    case 'update_expense': { const r = agentPickReceipt(inp); const ch = []; if(agentNum(inp.new_amount)!==null) ch.push(money(agentNum(inp.new_amount))); if(inp.new_description) ch.push(inp.new_description); if(inp.new_category) ch.push(inp.new_category); if(inp.new_date) ch.push(inp.new_date);
      return `${es?'Corregir gasto':'Fix expense'}: ${r ? r.supplier+' · '+money(r.total||0)+' · '+r.date : (es?'(no encontrado)':'(not found)')} → ${ch.join(' · ')||'—'}`; }
    case 'delete_expense': { const r = agentPickReceipt(inp); return `${es?'BORRAR gasto':'DELETE expense'}: ${r ? r.supplier+' · '+money(r.total||0)+' · '+r.date : (es?'(no encontrado)':'(not found)')}`; }
    case 'update_job': { const j = agentPickJob(Object.assign({}, inp, {any:true})); const ch = []; if(agentNum(inp.new_price)!==null) ch.push(money(agentNum(inp.new_price))); if(inp.new_date) ch.push(inp.new_date); if(inp.new_client) ch.push(inp.new_client); if(inp.new_service) ch.push(inp.new_service); if(inp.new_asset) ch.push(inp.new_asset); if(inp.new_end_date) ch.push((es?'hasta ':'until ')+inp.new_end_date); if(inp.paid===false) ch.push(es?'vuelve a pendiente':'back to pending'); if(inp.paid===true) ch.push(es?'cobrado':'paid'); if(inp.due_days) ch.push((es?'vence en ':'due in ')+inp.due_days+(es?' días':' days'));
      return `${es?'Corregir trabajo':'Fix job'}: ${j ? j.client+' · '+money(j.price||0)+' · '+svcShortDate(j.date) : (es?'(no encontrado)':'(not found)')} → ${ch.join(' · ')||'—'}`; }
    case 'delete_job': { const j = agentPickJob(Object.assign({}, inp, {any:true})); return `${es?'ELIMINAR trabajo':'DELETE job'}: ${j ? j.client+' · '+money(j.price||0)+' · '+svcShortDate(j.date) : (es?'(no encontrado)':'(not found)')}`; }
    case 'update_asset': { const a = agentFind(bizProfile.assets||[], inp.asset, x=>x.name); const ch = []; if(agentNum(inp.km)!==null) ch.push(svcFmtNum(agentNum(inp.km))+' '+distU()); if(inp.name) ch.push(inp.name); if(inp.model) ch.push(inp.model);
      return `${es?'Actualizar equipo':'Update asset'}: ${a ? a.name : inp.asset} → ${ch.join(' · ')||'—'}`; }
    case 'add_maintenance_plan': { const a = agentFind(bizProfile.assets||[], inp.asset, x=>x.name); const ev = [agentNum(inp.every_km)>0 ? (es?'cada ':'every ')+svcFmtNum(agentNum(inp.every_km))+' '+distU() : '', agentNum(inp.every_months)>0 ? (es?'cada ':'every ')+agentNum(inp.every_months)+(es?' meses':' months') : ''].filter(Boolean).join(' / ');
      return `${es?'Programar mantenimiento':'Schedule maintenance'}: ${inp.name} · ${a ? a.name : inp.asset} · ${ev||'—'}`; }
    case 'update_service': { const s = agentFind(bizProfile.catalog||[], inp.service, x=>x.name); const ch = []; if(agentNum(inp.price)!==null) ch.push(money(agentNum(inp.price))); if(inp.unit) ch.push(inp.unit); if(inp.name) ch.push(inp.name);
      return `${es?'Editar servicio':'Edit service'}: ${s ? s.name : inp.service} → ${ch.join(' · ')||'—'}`; }
    case 'delete_service': { const s = agentFind(bizProfile.catalog||[], inp.service, x=>x.name); return `${es?'Quitar servicio':'Remove service'}: ${s ? s.name : inp.service}`; }
    case 'rename_category': return `${es?'Renombrar categoría':'Rename category'}: ${inp.name} → ${inp.new_name}`;
    case 'delete_category': return `${es?'ELIMINAR categoría':'DELETE category'}: ${inp.name} (${inp.kind==='inventory' ? (es?'productos':'products') : (es?'gasto':'expense')})`;
    case 'delete_note': { const n = agentPickNote(inp); return `${es?'Borrar recordatorio':'Delete reminder'}: ${n ? '"'+n.text+'" · '+n.date : (es?'(no encontrado)':'(not found)')}`; }
  }
  return name;
}
/* ---------- localizar el registro que el usuario quiere tocar ---------- */
function agentPickItem(name){ return agentFind(inventory.filter(i=>i && !isExpenseItem(i)), name, i=>i.name); }
function agentPickReceipt(inp){
  if(inp.receipt_id){ const r = receipts.find(x=>x && x.id===inp.receipt_id); if(r) return r; }
  let list = receipts.filter(r=>r).slice().sort((a,b)=>String(b.date).localeCompare(String(a.date)) || String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
  if(inp.description){ const q = agentNorm(inp.description); const byD = list.filter(r=>agentNorm(r.supplier).includes(q) || q.includes(agentNorm(r.supplier)) || agentNorm(receiptCatName(r)||'').includes(q)); if(byD.length) list = byD; }
  if(agentNum(inp.amount)!==null){ const byA = list.filter(r=>Math.abs((r.total||0)-agentNum(inp.amount))<0.01); if(byA.length) list = byA; }
  if(inp.date){ const byDt = list.filter(r=>r.date===inp.date); if(byDt.length) list = byDt; }
  // Sin ninguna pista no se adivina: el agente tiene que consultar primero.
  if(!inp.description && agentNum(inp.amount)===null && !inp.date) return null;
  return list[0] || null;
}
function agentPickNote(inp){
  if(inp.note_id){ const n = calNotes.find(x=>x && x.id===inp.note_id); if(n) return n; }
  let list = calNotes.filter(n=>n && !/^svc-/.test(n.id||''));
  if(inp.date){ const byD = list.filter(n=>n.date===inp.date); if(byD.length) list = byD; }
  return agentFind(list, inp.text, n=>n.text);
}
function agentPickJob(inp){
  // Con job_id la respuesta es ESE trabajo o nada: un id borrado o viejo no cae
  // a "el más parecido" (el asistente cobraba otro trabajo del mismo cliente).
  if(inp.job_id) return jobById(inp.job_id) || null;
  // any: también los cobrados (para corregir o borrar); sin any, solo pendientes (cobrar).
  let list = inp.any ? svcJobs().slice() : svcJobs().filter(j=>!j.paid);
  if(inp.client){ const c = agentNorm(inp.client); const byC = list.filter(j=>agentNorm(j.client).includes(c) || c.includes(agentNorm(j.client))); if(byC.length) list = byC; }
  if(agentNum(inp.amount)!==null){ const byA = list.filter(j=>Math.abs((j.price||0)-agentNum(inp.amount))<0.01); if(byA.length) list = byA; }
  if(inp.date){ const byD = list.filter(j=>j.date===inp.date); if(byD.length) list = byD; }
  // Pendientes: el más viejo primero (es el que se cobra). Con any: el más reciente
  // de los YA HECHOS (fecha <= hoy); las ocurrencias futuras que Dusty generó solas
  // van al final — "el trabajo de Pérez" es el de esta semana, no el de dentro de 14 días.
  const today = localDateStr();
  list.sort((a,b)=>{
    if(!inp.any) return String(a.date).localeCompare(String(b.date));
    const fa = a.date>today ? 1 : 0, fb = b.date>today ? 1 : 0;
    if(fa!==fb) return fa-fb;
    return String(b.date).localeCompare(String(a.date));
  });
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
      // Equipo que no existe o fecha mal escrita: se avisa, no se guarda "algo parecido"
      // en silencio (un trabajo sin equipo y fechado hoy).
      if(inp.asset && !asset) return fail('asset not found: '+(bizProfile.assets||[]).map(x=>x.name).join(', '));
      if(inp.date && !isValidDateStr(inp.date)) return fail('date must be a real YYYY-MM-DD date');
      const svc = inp.service ? agentFind(bizProfile.catalog||[], inp.service, x=>x.name) : null;
      const date = agentDate(inp.date), dueDays = Math.max(1, parseInt(inp.due_days,10)||15);
      const endDate = (isValidDateStr(inp.end_date) && inp.end_date>date) ? inp.end_date : null;
      const clash = asset ? svcClash({id:null, assetId: asset.id, date, endDate}) : null;
      const job = { id: uid('job'), type:'service', date, endDate, client: String(inp.client).trim().slice(0,60), serviceName: (svc ? svc.name : String(inp.service||'').trim()).slice(0,60), serviceId: svc ? svc.id : null,
        assetId: asset ? asset.id : null, price: Math.round(price*100)/100, paid: !!inp.paid, dueDate: inp.paid ? null : addDaysStr(date, dueDays), dueDays, paidDate: inp.paid ? (date<localDateStr() ? date : localDateStr()) : null,
        repeat: ['weekly','biweekly','monthly'].indexOf(inp.repeat)>=0 ? inp.repeat : null, items: [], createdAt: new Date().toISOString(), byAgent: true };
      recordOutflow(job); saveState(); logActivity('job_saved', job.client, job.serviceName); render();
      return ok(Object.assign({job_id: job.id, asset: asset ? asset.name : null, due_date: job.dueDate}, clash ? {asset_clash: {client: clash.client, date: clash.date}} : {}));
    }
    case 'mark_paid': {
      const j = agentPickJob(inp); if(!j) return fail('job not found');
      // Ya cobrado: no se pisa la fecha de cobro (el modelo elegía un job_id cobrado
      // de una consulta anterior y "re-cobraba" un trabajo de agosto hoy).
      if(j.paid) return fail('already paid on '+(j.paidDate||j.date));
      markJobPaid(j); saveState(); logActivity('job_paid', j.client, money(j.price||0)); render();
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
    /* ---- Cotizaciones y clientes (app-17): la app arma y guarda; acá solo se
       traduce el resultado. missing_price → el asistente pregunta UNA cosa. ---- */
    case 'create_quote': {
      if(!usesServices() && !sellsProducts()) return fail('nothing to quote');
      const r = quoteCreateFromAgent(inp);
      return JSON.stringify(r);
    }
    case 'quote_action': return JSON.stringify(quoteAgentAction(inp));
    case 'add_client': case 'update_client': return JSON.stringify(clientFromAgent(inp, name==='update_client'));
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
    /* ---- corregir / ajustar / borrar (2026-09-11) ---- */
    case 'adjust_stock': {
      const it = agentPickItem(inp.item); if(!it) return fail('item not found');
      const q = agentNum(inp.qty); if(!(q>=0)) return fail('qty must be >= 0');
      const cur = Number(it.qtyOnHand)||0;
      const touch = ()=>{ if(currentUser){ it.lastEditedBy = currentUserLabel(); it.lastEditedAt = new Date().toISOString(); } };
      if(inp.mode==='add'){
        it.qtyOnHand = roundQty(cur + q);
        if(!(it.stockFullRef>0) || it.qtyOnHand > it.stockFullRef) it.stockFullRef = it.qtyOnHand;
        touch(); saveState(); logActivity('item_edited', it.name); render();
        return ok({item: it.name, qty: it.qtyOnHand});
      }
      if(inp.mode==='set'){
        it.qtyOnHand = roundQty(q); touch(); saveState(); logActivity('item_edited', it.name); render();
        return ok({item: it.name, qty: it.qtyOnHand, was: cur});
      }
      // remove: una SALIDA como las del escáner de reducción — venta (ingreso),
      // merma (pérdida) o consumo propio — con costo y precio de hoy congelados.
      const out = Math.min(cur, roundQty(q)); if(!(out>0)) return fail('nothing in stock');
      const reason = (inp.reason==='loss' || inp.reason==='internal') ? inp.reason : 'sale';
      const price = reason!=='sale' ? 0 : (agentNum(inp.price)!==null && agentNum(inp.price)>=0 ? roundQty(agentNum(inp.price)) : (Number(it.salePrice)||0));
      it.qtyOnHand = roundQty(cur - out); touch();
      recordOutflow({ id: uid('o'), type:'adjust', recipeId:null, recipeName:'', count:null, reason,
        items:[{ingId: it.id, ingName: it.name, qty: out, unit: it.unit, reason, costAt: Number(it.costPerUnit)||0, priceAt: price}],
        date: localDateStr(), createdAt: new Date().toISOString(), by: currentUser ? currentUser.uid : null, byLabel: currentUser ? currentUserLabel() : '', byAgent: true });
      saveState(); logActivity('stock_adjust', '', '1'); render();
      return ok({item: it.name, removed: out, left: it.qtyOnHand, reason, revenue: reason==='sale' ? roundQty(out*price) : 0, short: out<q ? q-out : 0});
    }
    case 'update_item': {
      const it = agentPickItem(inp.item); if(!it) return fail('item not found');
      const ch = {};
      if(inp.name){ it.name = String(inp.name).trim().slice(0,60); ch.name = it.name; }
      if(agentNum(inp.cost_per_unit)!==null && agentNum(inp.cost_per_unit)>=0){ it.costPerUnit = roundQty(agentNum(inp.cost_per_unit)); ch.cost = it.costPerUnit; }
      if(agentNum(inp.sale_price)!==null && agentNum(inp.sale_price)>=0){ it.salePrice = roundQty(agentNum(inp.sale_price)); ch.sale_price = it.salePrice; }
      if(inp.unit && ['unidad','caja','lb','kg','oz','g','ml','l'].indexOf(inp.unit)>=0){ it.unit = inp.unit; ch.unit = it.unit; }
      if(inp.category){ let c = agentFind(categories||[], inp.category, x=>x.name); if(!c){ c = {id: uid('cat'), name: String(inp.category).trim().slice(0,40)}; (categories||(categories=[])).push(c); } it.categoryId = c.id; ch.category = c.name; }
      if(agentNum(inp.full_stock)!==null && agentNum(inp.full_stock)>0){ it.stockFullRef = roundQty(agentNum(inp.full_stock)); ch.full_stock = it.stockFullRef; }
      if(!Object.keys(ch).length) return fail('nothing to change');
      if(currentUser){ it.lastEditedBy = currentUserLabel(); it.lastEditedAt = new Date().toISOString(); }
      saveState(); logActivity('item_edited', it.name); render();
      return ok({item: it.name, changed: ch});
    }
    case 'delete_item': {
      const it = agentPickItem(inp.item); if(!it) return fail('item not found');
      const nm = it.name; removeInventoryItem(it.id); render();
      return ok({deleted: nm});
    }
    case 'update_expense': {
      const r = agentPickReceipt(inp); if(!r) return fail('expense not found — query receipts first');
      const ch = {};
      if(agentNum(inp.new_amount)!==null){
        if(!r.manual) return fail('scanned receipt: amount must be fixed from the receipt screen (open_screen receipts)');
        if(!(agentNum(inp.new_amount)>0)) return fail('amount must be > 0');
        r.total = Math.round(agentNum(inp.new_amount)*100)/100; ch.amount = r.total;
      }
      if(inp.new_description){ r.supplier = String(inp.new_description).trim().slice(0,60); ch.description = r.supplier; }
      if(inp.new_category){ let cat = agentFind(expenseCategories, inp.new_category, c=>c.name); if(!cat){ cat = {id: uid('xcat'), name: String(inp.new_category).trim().slice(0,40)}; expenseCategories.push(cat); } r.expenseCategoryId = cat.id; ch.category = cat.name; }
      if(inp.new_date && /^\d{4}-\d{2}-\d{2}$/.test(inp.new_date)){ r.date = inp.new_date; ch.date = r.date; }
      if(!Object.keys(ch).length) return fail('nothing to change');
      r.editedAt = new Date().toISOString(); saveState(); render();
      return ok({receipt_id: r.id, changed: ch});
    }
    case 'delete_expense': {
      const r = agentPickReceipt(inp); if(!r) return fail('expense not found — query receipts first');
      if(!r.manual && ((r.purchaseIds||[]).length || (r.appliedItems||[]).length || (r.itemCount||0)>0)) return fail('scanned receipt with products: delete it from the receipt screen (open_screen receipts)');
      receipts = receipts.filter(x=>x.id!==r.id);
      if(!deletedReceiptIds.includes(r.id)) deletedReceiptIds.push(r.id);
      saveState(); render();
      return ok({deleted: r.supplier, amount: r.total, date: r.date});
    }
    case 'update_job': {
      if(!usesServices()) return fail('services mode is off');
      const j = agentPickJob(Object.assign({}, inp, {any:true})); if(!j) return fail('job not found — query jobs first');
      const prevDate = j.date;
      // Se resuelve TODO antes de tocar el trabajo: si el equipo no existe, no
      // queda un cambio a medias sin guardar.
      const newAsset = inp.new_asset ? agentFind(bizProfile.assets||[], inp.new_asset, x=>x.name) : null;
      if(inp.new_asset && !newAsset) return fail('asset not found');
      const ch = {};
      if(agentNum(inp.new_price)!==null && agentNum(inp.new_price)>=0){ j.price = Math.round(agentNum(inp.new_price)*100)/100; ch.price = j.price; }
      // Fecha mal formada o inexistente: se avisa, no se ignora en silencio (el
      // modelo decía "listo, movido al 30 de febrero" y el trabajo seguía igual).
      if(inp.new_date && !isValidDateStr(inp.new_date)) return fail('new_date must be a real YYYY-MM-DD date');
      if(inp.new_date){
        j.date = inp.new_date; ch.date = j.date;
        // El vencimiento acompaña a la fecha (antes quedaba anclado a la vieja y un
        // trabajo movido a octubre aparecía "vencido" en septiembre).
        if(!j.paid){ j.dueDate = addDaysStr(j.date, j.dueDays||15); ch.due_date = j.dueDate; }
        if(j.endDate && j.endDate<=j.date) j.endDate = null;
      }
      if(inp.new_end_date!==undefined && inp.new_end_date!==null){
        if(inp.new_end_date===''){ if(j.endDate){ j.endDate = null; ch.end_date = null; } }
        else if(isValidDateStr(inp.new_end_date) && inp.new_end_date>j.date){ j.endDate = inp.new_end_date; ch.end_date = j.endDate; }
        else return fail('new_end_date must be YYYY-MM-DD and after the job date '+j.date);
      }
      if(inp.new_client){ j.client = String(inp.new_client).trim().slice(0,60); ch.client = j.client; }
      if(inp.new_service){ const svc = agentFind(bizProfile.catalog||[], inp.new_service, x=>x.name); j.serviceName = (svc ? svc.name : String(inp.new_service).trim()).slice(0,60); j.serviceId = svc ? svc.id : null; ch.service = j.serviceName; }
      if(newAsset && j.assetId!==newAsset.id){ j.assetId = newAsset.id; ch.asset = newAsset.name; receipts.forEach(r=>{ if(r && r.jobId===j.id) r.assetId = j.assetId; }); }
      if(inp.paid===true && !j.paid){ j.paid = true; j.paidDate = localDateStr(); j.dueDate = null; ch.paid = true; }
      if(inp.paid===false && j.paid){ j.paid = false; j.paidDate = null; j.dueDate = addDaysStr(j.date, j.dueDays||15); ch.paid = false; }
      if(inp.due_days){ j.dueDays = Math.max(1, parseInt(inp.due_days,10)||15); if(!j.paid){ j.dueDate = addDaysStr(j.date, j.dueDays); ch.due_date = j.dueDate; } }
      if(!Object.keys(ch).length) return fail('nothing to change');
      j.lastEditedAt = new Date().toISOString();
      // Plantilla de un contrato: misma regla que el modal (cambio de fecha =
      // regla nueva, retira las próximas sin tocar; otros cambios se propagan).
      const pruned = svcAfterJobEdit(j, j.date!==prevDate);
      saveState(); logActivity('job_saved', j.client, j.serviceName); render();
      return ok(Object.assign({job_id: j.id, changed: ch}, pruned>0 ? {upcoming_removed: pruned} : {}));
    }
    case 'delete_job': {
      const j = agentPickJob(Object.assign({}, inp, {any:true})); if(!j) return fail('job not found — query jobs first');
      const pruned = deleteJob(j);
      saveState(); logActivity('job_deleted', j.client); render();
      return ok(Object.assign({deleted: j.client, amount: j.price, date: j.date}, pruned>0 ? {upcoming_removed: pruned} : {}));
    }
    case 'update_asset': {
      const a = agentFind(bizProfile.assets||[], inp.asset, x=>x.name); if(!a) return fail('asset not found');
      const ch = {};
      if(agentNum(inp.km)!==null && agentNum(inp.km)>=0){ a.km = agentNum(inp.km); ch.km = a.km; }
      if(inp.name){ a.name = String(inp.name).trim().slice(0,60); ch.name = a.name; }
      if(inp.model){ a.model = String(inp.model).trim().slice(0,60); ch.model = a.model; }
      if(!Object.keys(ch).length) return fail('nothing to change');
      saveState(); logActivity('asset_saved', a.name); render();
      return ok({asset: a.name, changed: ch});
    }
    case 'add_maintenance_plan': {
      const a = agentFind(bizProfile.assets||[], inp.asset, x=>x.name); if(!a) return fail('asset not found');
      const nm = String(inp.name||'').trim().slice(0,60); if(!nm) return fail('name required');
      const everyKm = agentNum(inp.every_km)>0 ? Math.round(agentNum(inp.every_km)) : 0, everyMonths = agentNum(inp.every_months)>0 ? Math.round(agentNum(inp.every_months)) : 0;
      if(!everyKm && !everyMonths) return fail('every_km or every_months required');
      let m = agentFind(a.maint||[], nm, x=>x.name);
      if(!m){ m = {id: uid('mt')}; a.maint = a.maint||[]; a.maint.push(m); }
      Object.assign(m, {name: nm, emoji: m.emoji||'🔧', everyKm, everyMonths, lastDate: agentDate(inp.last_date), lastKm: agentNum(inp.last_km)!==null ? agentNum(inp.last_km) : (a.km||0)});
      saveState(); logActivity('asset_saved', a.name); render();
      return ok({asset: a.name, plan: m.name, every_km: everyKm||null, every_months: everyMonths||null});
    }
    case 'update_service': {
      const s = agentFind(bizProfile.catalog||[], inp.service, x=>x.name); if(!s) return fail('service not found');
      const ch = {};
      if(agentNum(inp.price)!==null && agentNum(inp.price)>=0){ s.price = roundQty(agentNum(inp.price)); ch.price = s.price; }
      if(inp.unit && ['fixed','km','day','hour'].indexOf(inp.unit)>=0){ s.unit = inp.unit; ch.unit = s.unit; }
      if(inp.name){ s.name = String(inp.name).trim().slice(0,60); ch.name = s.name; }
      if(!Object.keys(ch).length) return fail('nothing to change');
      saveState(); render(); return ok({service: s.name, changed: ch});
    }
    case 'delete_service': {
      const s = agentFind(bizProfile.catalog||[], inp.service, x=>x.name); if(!s) return fail('service not found');
      bizProfile.catalog = (bizProfile.catalog||[]).filter(x=>x.id!==s.id); saveState(); render();
      return ok({deleted: s.name});
    }
    case 'rename_category': {
      const list = inp.kind==='inventory' ? (categories||[]) : expenseCategories;
      const c = agentFind(list, inp.name, x=>x.name); if(!c) return fail('category not found');
      const nm = String(inp.new_name||'').trim().slice(0,40); if(!nm) return fail('new_name required');
      const was = c.name; c.name = nm; saveState(); render();
      return ok({was, name: nm});
    }
    case 'delete_category': {
      if(inp.kind==='inventory'){
        const c = agentFind(categories||[], inp.name, x=>x.name); if(!c) return fail('category not found');
        categories = categories.filter(x=>x.id!==c.id); inventory.forEach(i=>{ if(i && i.categoryId===c.id) i.categoryId = null; });
        saveState(); render(); return ok({deleted: c.name});
      }
      const c = agentFind(expenseCategories, inp.name, x=>x.name); if(!c) return fail('category not found');
      const used = receipts.filter(r=>r && r.expenseCategoryId===c.id).length;
      expenseCategories = expenseCategories.filter(x=>x.id!==c.id);
      if(budgetMeta && budgetMeta.byCategory) delete budgetMeta.byCategory[c.id];
      saveState(); render(); return ok({deleted: c.name, receipts_left_uncategorized: used});
    }
    case 'delete_note': {
      const n = agentPickNote(inp); if(!n) return fail('note not found — query notes first');
      calNotes = calNotes.filter(x=>x.id!==n.id);
      if(typeof deletedCalNoteIds!=='undefined' && !deletedCalNoteIds.includes(n.id)) deletedCalNoteIds.push(n.id);
      saveState(); logActivity('note_deleted', n.text); render();
      return ok({deleted: n.text, date: n.date});
    }
    case 'set_preference': {
      const ch = {};
      if(inp.theme==='dark' || inp.theme==='light'){ setDustyTheme(inp.theme==='dark' ? 'night' : 'appstore'); ch.theme = inp.theme; }
      const fs = parseInt(inp.font_scale,10);
      if(fs>=90 && fs<=140){ dustyFontScale = fs; applyFontScale(); try{ localStorage.setItem('patron_font_scale', String(fs)); }catch(e){} ch.font_scale = fs; }
      if(inp.language==='es' || inp.language==='en'){ setLang(inp.language); ch.language = inp.language; }
      if(!Object.keys(ch).length) return fail('nothing to change');
      render(); return ok({changed: ch});
    }
    case 'scan_receipt': {
      // Recibo de compra: al escáner de siempre, con la misma foto ya cargada.
      const files = agentLastFiles.slice(); if(!files.length) return fail('no photo');
      showAgentSheet = false; render();
      openScanModal();
      (async()=>{ for(const f of files){ try{ await addScanPage(f); }catch(e){} } })();
      return ok({opened:'scanner', pages: files.length});
    }
    case 'query': return agentQuery(inp);
    case 'open_screen': return agentOpen(inp.screen, inp.text);
    case 'print': {
      if(inp.what==='month_report'){ downloadMonthReport(/^\d{4}-\d{2}$/.test(inp.month||'') ? inp.month : localMonthStr()); return ok(); }
      if(inp.what==='job_invoice'){ const j = agentPickJob({client: inp.client}) || svcJobs().filter(j=>agentNorm(j.client).includes(agentNorm(inp.client||''))).sort((a,b)=>String(b.date).localeCompare(String(a.date)))[0]; if(!j) return fail('job not found'); downloadJobPdf(j); return ok({client: j.client}); }
      if(inp.what==='quote'){ const q = agentPickQuote(inp); if(!q) return fail('quote not found'); showAgentSheet = false; render(); downloadQuotePdf(q); return ok({quote_id: q.id, client: q.client}); }
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
    case 'quotes': return JSON.stringify(quotesForAgentQuery(inp.text));
    case 'clients': return JSON.stringify(clientsForAgentQuery(inp.text));
    case 'collect': { const cs = collectStats(); return JSON.stringify({pending: cs.pending, overdue: cs.overdue, overdue_count: cs.overdueCount, paid_this_month: cs.paidMonth,
      jobs: cs.list.filter(j=>!q || agentNorm(j.client).includes(q)).slice(0,25).map(j=>({job_id:j.id, client:j.client, service:j.serviceName, date:j.date, due:j.dueDate, amount:j.price, overdue: jobIsOverdue(j)}))}); }
    case 'budget': { const p = budgetPace(localMonthStr()); return JSON.stringify(p ? {budget:p.budget, spent:p.expense, left:p.left, pct:Math.round(p.pct), status:p.status, projected:p.projected} : {budget:null, spent: spendSplitForMonth(localMonthStr()).expense}); }
    case 'agenda': { const days = Math.min(31, Math.max(1, parseInt(inp.days,10)||7)); const out = []; for(let i=0;i<days;i++){ const d = addDaysStr(today,i); calNotesOnDate(calNotes, d).forEach(n=>out.push({date:d, kind:n.svcKind||'note', text:n.text})); } return JSON.stringify({from: today, days, items: out.slice(0,40)}); }
    case 'expenses': { const cache = finCache(); const rows = receipts.filter(r=>r && inRange(r.date)); const byCat = {}; let total = 0;
      rows.forEach(r=>{ const s = receiptSplit(r, cache); const k = receiptCatName(r) || (s.invested>0 && !(s.expense>0) ? t('manual_kind_investment') : t('categories_uncategorized')); byCat[k] = (byCat[k]||0) + (r.total||0); total += r.total||0; });
      const filtered = inp.category ? rows.filter(r=>agentNorm(receiptCatName(r)).includes(agentNorm(inp.category))) : rows;
      return JSON.stringify({from, to, total, by_category: byCat, ...(inp.category ? {category_total: filtered.reduce((s,r)=>s+(r.total||0),0), items: filtered.slice(-20).map(r=>({date:r.date, description:r.supplier, amount:r.total}))} : {count: rows.length})}); }
    case 'jobs': { const list = svcJobs().filter(j=>inRange(j.date) && (!q || agentNorm(j.client+' '+(j.serviceName||'')).includes(q))); return JSON.stringify({from, to, count: list.length, billed: list.reduce((s,j)=>s+(j.price||0),0), paid: list.filter(j=>j.paid).reduce((s,j)=>s+(j.price||0),0), jobs: list.slice(0,30).map(j=>({job_id:j.id, date:j.date, end_date: j.endDate||null, client:j.client, service:j.serviceName, amount:j.price, paid:j.paid, asset:(assetById(j.assetId)||{}).name||null, repeat: j.repeat||null, contract_id: j.parentId||null}))}); }
    case 'inventory': { const rows = stockRowsData(); const hit = q ? rows.filter(r=>agentNorm(r.ing.name).includes(q)) : rows; return JSON.stringify({total_items: inventory.length, critical: rows.filter(r=>r.status==='crit').map(r=>r.ing.name).slice(0,30), items: hit.slice(0,30).map(r=>({name:r.ing.name, qty:r.ing.qtyOnHand, unit:r.ing.unit, cost:r.ing.costPerUnit, sale_price:r.ing.salePrice, status:r.status}))}); }
    case 'month': { const key = (inp.from && /^\d{4}-\d{2}/.test(inp.from)) ? inp.from.slice(0,7) : localMonthStr(); const f = periodFinancials(key); return JSON.stringify({month:key, revenue:f.revenue, cogs:f.cogs, expenses:f.expense, invested:f.invested, net:f.net, receipts:f.receiptsCount, jobs: jobsForMonth(key).length}); }
    case 'assets': { const t0 = today; return JSON.stringify({assets: (bizProfile.assets||[]).map(a=>{ const st = assetMonthStats(a, localMonthStr()); return {name:a.name, model:a.model, km:a.km, month_revenue:st.revenue, month_expense:st.expense, maintenance:(a.maint||[]).map(m=>{ const s = maintStatus(m, a, t0, bizProfile.maintDays); return {name:m.name, status:s.status, when: svcMaintWhen(s)}; })}; })}); }
    case 'services': return JSON.stringify({services: (bizProfile.catalog||[]).map(c=>({name:c.name, price:c.price, unit:c.unit, description:c.desc}))});
    case 'categories': return JSON.stringify({expense: expenseCategories.map(c=>c.name), inventory: (categories||[]).map(c=>c.name)});
    // Con id: para que el agente pueda corregir o borrar el registro exacto.
    case 'receipts': { const rows = receipts.filter(r=>r && inRange(r.date) && (!q || agentNorm(r.supplier+' '+(receiptCatName(r)||'')).includes(q))).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
      return JSON.stringify({from, to, count: rows.length, receipts: rows.slice(0,30).map(r=>({receipt_id:r.id, date:r.date, description:r.supplier, amount:r.total, category: receiptCatName(r)||null, kind: r.manual ? (r.manualKind||'expense') : 'scanned', editable_amount: !!r.manual, items: r.itemCount||0, job: r.jobId ? ((jobById(r.jobId)||{}).client||null) : null, asset: r.assetId ? ((assetById(r.assetId)||{}).name||null) : null}))}); }
    case 'notes': { const days = Math.min(120, Math.max(1, parseInt(inp.days,10)||60)); const lim = addDaysStr(today, days);
      const list = calNotes.filter(n=>n && !/^svc-/.test(n.id||'') && (!q || agentNorm(n.text).includes(q)) && (n.recurring || (n.date>=addDaysStr(today,-30) && n.date<=lim))).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
      return JSON.stringify({count: list.length, notes: list.slice(0,40).map(n=>({note_id:n.id, date:n.date, text:n.text, recurring: !!n.recurring}))}); }
    case 'activity': { const log = (typeof activityLog!=='undefined' && Array.isArray(activityLog)) ? activityLog : []; const rows = log.slice(0,25).map(a=>({when: a.at||a.createdAt||a.ts||null, who: a.byLabel||a.by||a.user||null, type: a.type||null, what: a.itemName||a.item||'', detail: a.detail||''}));
      return JSON.stringify({count: log.length, recent: rows}); }
  }
  return JSON.stringify({ok:false, error:'unknown topic'});
}
function agentOpen(screen, text){
  const closeAgent = ()=>{ showAgentSheet = false; };
  switch(screen){
    // Fichas concretas: el producto, el trabajo o el equipo que nombró el usuario.
    case 'item': { const it = agentPickItem(text); if(!it) return JSON.stringify({ok:false, error:'item not found'}); closeAgent(); render(); openItemModal(it); return JSON.stringify({ok:true, item: it.name}); }
    case 'job': { const j = agentPickJob({client: text, any:true}); if(!j) return JSON.stringify({ok:false, error:'job not found'}); closeAgent(); render(); openJobModal(j.id); return JSON.stringify({ok:true, client: j.client}); }
    // "Abrí el camión 1" = su FICHA (mantenimientos, gastos, trabajos), no el
    // formulario de edición con el botón de eliminar a un toque.
    case 'asset': { const a = agentFind(bizProfile.assets||[], text, x=>x.name); if(!a) return JSON.stringify({ok:false, error:'asset not found'}); closeAgent(); assetSheetMonth = null; assetSheetShowAllMaint = false; showAssetSheet = a.id; render(); return JSON.stringify({ok:true, asset: a.name}); }
    case 'collect': closeAgent(); showCollectSheet = true; break;
    case 'jobs': closeAgent(); showJobsSheet = true; break;
    case 'equipment': closeAgent(); if(TAB_ORDER[1]==='equipo') activeTab = 'equipo'; else showEquipoSheet = true; break;
    case 'inventory': closeAgent(); if(TAB_ORDER[1]==='inventario') activeTab = 'inventario'; else return JSON.stringify({ok:false, error:'no inventory tab'}); break;
    case 'receipts': closeAgent(); if(TAB_ORDER[2]==='recibos') activeTab = 'recibos'; else showReceiptsSheet = true; break;
    case 'budget': closeAgent(); openBudgetModal(); return JSON.stringify({ok:true});
    case 'recap': closeAgent(); monthRecapKey = localMonthStr(); recapMode = 'month'; showMonthRecap = true; break;
    case 'settings': closeAgent(); showAlertSettingsModal = true; break;
    case 'services': closeAgent(); showServicesSheet = true; break;
    // Cotizaciones y clientes (app-17).
    case 'quotes': closeAgent(); showQuotesSheet = true; break;
    case 'quote': { const q = agentPickQuote({client: text, number: text}); if(!q) return JSON.stringify({ok:false, error:'quote not found'}); closeAgent(); render(); openQuoteModal(q.id); return JSON.stringify({ok:true, client: q.client, number: quoteNum(q)}); }
    case 'clients': closeAgent(); showClientsSheet = true; break;
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
  if((!text && !agentAttach.length) || agentBusy) return;
  if(!text) text = t('agent_attach_default');
  if(!currentUser && typeof everHadRealAccount==='function' && everHadRealAccount()){ openAuthModal(t('agent_needs_account')); return; }
  agentDraft = ''; agentError = '';
  // Fotos: van como bloques de imagen delante del texto; en el hilo se ven las miniaturas.
  const attach = agentAttach.slice(); agentAttach = []; agentLastFiles = attach.map(a=>a.file);
  agentPush('user', text, attach.length ? {thumbs: attach.map(a=>a.thumb)} : null);
  agentMessages.push({role:'user', content: attach.map(a=>({type:'image', source:{type:'base64', media_type:a.mediaType, data:a.base64}})).concat([{type:'text', text}])});
  if(agentMessages.length>28) agentMessages = agentMessages.slice(-28);
  agentBusy = true; render(); agentScrollEnd();
  const gen = agentGen; // si el usuario reinicia en el medio, este bucle se abandona
  try{
    for(let hop=0; hop<AGENT_MAX_HOPS; hop++){
      const res = await agentCall();
      if(gen!==agentGen) return;
      const content = Array.isArray(res.content) ? res.content : [];
      agentMessages.push({role:'assistant', content});
      // La foto ya fue leída en este salto: las vueltas siguientes de la misma
      // conversación no la vuelven a subir (el servidor tampoco la reenviaría).
      agentStripImages();
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
          if(gen!==agentGen) return;
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
    if(gen!==agentGen) return; // reiniciado en el medio: la hoja ya está limpia
    agentError = (e && e.message) || t('agent_err_generic');
    agentPush('note', agentError);
    // El último turno quedó sin respuesta: se saca para que la conversación siga válida.
    if(agentMessages.length && agentMessages[agentMessages.length-1].role==='user') agentMessages.pop();
  }
  if(gen!==agentGen) return;
  agentStripImages();
  agentBusy = false; agentPending = null; render(); agentScrollEnd();
}
// Las fotos ya leídas no vuelven a viajar en las vueltas siguientes (pesan y se
// cobrarían de nuevo): quedan como una marca en el historial.
function agentStripImages(){
  agentMessages.forEach(m=>{ if(m.role==='user' && Array.isArray(m.content)) m.content = m.content.map(b=>b.type==='image' ? {type:'text', text:'[imagen enviada antes]'} : b); });
}
function agentScrollEnd(){ requestAnimationFrame(()=>{ const el = document.getElementById('agent-thread'); if(el) el.scrollTop = el.scrollHeight; }); }
/* Reiniciar con una tarjeta de confirmación pendiente dejaba el asistente
   trabado para siempre (auditoría UX 2026-09-11): agentSend seguía esperando la
   promesa de la tarjeta y agentBusy nunca bajaba. Ahora la promesa se resuelve
   como "cancelado", el bucle viejo se abandona por generación (agentGen) y la
   hoja vuelve a la bienvenida lista para escribir. */
let agentGen = 0;
function agentReset(){
  agentGen++;
  if(agentPending){ const p = agentPending; agentPending = null; try{ p.resolve(false); }catch(e){} }
  agentMessages = []; agentUi = []; agentPending = null; agentError = ''; agentBusy = false;
  try{ window.speechSynthesis && window.speechSynthesis.cancel(); }catch(e){}
}

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
    if(m.kind==='user') return `<div class="ag-msg ag-user">${m.thumbs ? `<div class="ag-thumbs">${m.thumbs.map(t=>`<img src="data:${escapeHtml(t.mediaType)};base64,${t.base64}" alt="">`).join('')}</div>` : ''}${escapeHtml(m.text)}</div>`;
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
    ${agentAttach.length ? `<div class="ag-attach">${agentAttach.map((a,i)=>`<span class="ag-attach-item"><img src="data:${escapeHtml(a.thumb.mediaType)};base64,${a.thumb.base64}" alt=""><button type="button" class="ag-attach-x" data-agent-attach-del="${i}" aria-label="${t('btn_delete')}">✕</button></span>`).join('')}<span class="ag-attach-hint">${t('agent_photo_hint')}</span></div>` : ''}
    <div class="ag-composer">
      <button type="button" class="ag-mic" id="btn-agent-cam" title="${t('agent_cam_title')}" aria-label="${t('agent_cam_title')}" ${agentBusy||agentAttach.length>=3?'disabled':''}>${lineIcon('camera',20)}</button>
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
// Cámara del asistente: la MISMA introducción que las otras cámaras de Dusty
// (título, línea explicativa, caja punteada que abre la cámara, link a galería).
function agentCamModal(){
  return `
  <div class="overlay" id="agent-cam-overlay">
    <div class="modal">
      <h3 class="sky">${t('agent_cam_title')}</h3>
      <div class="sub">${t('agent_cam_sub')}</div>
      <div class="drop-zone" id="agent-cam-zone">
        <div class="dz-icon">${lineIcon('camera',26)}</div>
        <div style="font-weight:600;font-size:calc(13.5px * var(--fs, 1));">${t('scan_tap_photo')}</div>
      </div>
      <button type="button" id="btn-agent-cam-gallery" class="dz-gallery-link">${t('scan_upload_gallery_btn')}</button>
      <div class="scan-tip">📷 ${t('agent_photo_hint')}</div>
      <input type="file" id="agent-cam-file" accept="image/*" capture="environment" style="display:none;">
      <input type="file" id="agent-cam-gallery" accept="image/*" multiple style="display:none;">
      <div class="modal-actions"><button class="btn btn-ghost" id="btn-cancel-agent-cam" style="width:100%;">${t('btn_cancel')}</button></div>
    </div>
  </div>`;
}
async function agentAddPhoto(file){
  if(agentAttach.length>=3) return;
  try{
    const img = await loadImageFromFile(file);
    agentAttach.push({ file, base64: resizeToBase64(img, 1600, 0.85).base64, mediaType: 'image/jpeg', thumb: resizeToBase64(img, 220, 0.7) });
  }catch(e){ showToast(t('err_img_process'), 'error'); }
  showAgentCam = false; render();
}
// Botón del topbar (junto a Ajustes). Solo con el asistente prendido.
function agentTopbarButtonHtml(){
  if(!agentAvailable()) return '';
  // Dice "AI" / "IA" en letras (pedido del usuario 2026-09-11), no un símbolo:
  // la sigla se lee al instante en cualquier idioma y va como las pastillas
  // EN/ES del mismo topbar.
  return `<button class="lang-toggle ag-topbtn" id="btn-agent" title="${t('agent_title')}" aria-label="${t('agent_title')}">${t('agent_badge')}</button>`;
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
    on('btn-agent-cam', ()=>{ showAgentCam = true; render(); });
    document.querySelectorAll('[data-agent-attach-del]').forEach(b=>{ b.onclick = ()=>{ agentAttach.splice(parseInt(b.dataset.agentAttachDel,10), 1); render(); }; });
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
  const cam = g('agent-cam-overlay');
  if(cam){
    const closeCam = ()=>{ showAgentCam = false; render(); };
    cam.onmousedown = (e)=>{ if(e.target===cam) closeCam(); };
    on('btn-cancel-agent-cam', closeCam);
    const fileInp = g('agent-cam-file'), galInp = g('agent-cam-gallery');
    const chosen = (input)=>async(e)=>{ const files = Array.from(e.target.files||[]); input.value=''; for(const f of files) await agentAddPhoto(f); };
    if(fileInp) fileInp.onchange = chosen(fileInp);
    if(galInp) galInp.onchange = chosen(galInp);
    on('agent-cam-zone', ()=>fileInp && fileInp.click());
    on('btn-agent-cam-gallery', ()=>galInp && galInp.click());
  }
  const tg = g('agent-toggle');
  if(tg) tg.onchange = ()=>{ agentEnabled = !!tg.checked; try{ localStorage.setItem('patron_agent', agentEnabled ? 'on' : 'off'); }catch(e){} render(); };
  const vt = g('agent-voice-toggle');
  if(vt) vt.onchange = ()=>{ agentVoiceOut = !!vt.checked; try{ localStorage.setItem('patron_agent_voice', agentVoiceOut ? 'on' : 'off'); }catch(e){} render(); };
}
