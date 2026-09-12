/* ================= COTIZACIONES PARA CLIENTES + REGISTRO DE CLIENTES (2026-09-11) =================
   Pedido del usuario: "permite que la IA pueda hacer cotizaciones a los usuarios
   para enviarlas a los clientes" y "guardar la información de los clientes
   (correos, etc.) para que se puedan enviar automáticamente".

   COTIZACIÓN = outflow type:'quote' (misma plomería que los trabajos, que son
   type:'service': sincroniza por id con la nube, borrado suave con deleted:true,
   y outflowPL la ignora — una cotización es una promesa, no una venta). Cuando el
   cliente acepta, se crea el TRABAJO (type:'service', con quoteId) y la cotización
   queda 'accepted' con su jobId: ahí sí entra a Por cobrar, al calendario y al P&L.
   Forma: {id, type:'quote', date, client, clientId, lines:[{desc, qty, unit, price,
   serviceId, itemId}], discount, taxPct, validDays, notes, status:'draft'|'sent'|
   'accepted'|'rejected', sentAt, acceptedAt, jobId, createdAt, byLabel, byAgent}.
   Los totales salen SIEMPRE de quoteTotals (patron-core, con pruebas).

   CLIENTES viven en bizProfile.clients (normalizeBizProfile los limpia): {id, name,
   phone, email, notes}. El nombre sigue siendo texto libre en trabajos y
   cotizaciones (como siempre); si coincide con un cliente guardado, la app usa su
   teléfono (WhatsApp directo al número) y su correo (envío con el PDF adjunto).

   El ASISTENTE (app-16) llama a quoteFromAgent / quoteAgentAction / clientFromAgent
   de acá: nunca arma el registro él mismo. */
let showQuotesSheet = false, showQuoteModal = false, draftQuote = null, quoteModalError = '', quotesSearch = '';
let showClientsSheet = false, showClientModal = false, draftClient = null, clientModalError = '';
const QUOTE_VALID_DAYS = [7, 15, 30, 60];

/* ---------- datos ---------- */
function svcQuotes(){ return outflows.filter(o=>o && o.type==='quote' && !o.deleted); }
function quoteById(id){ return outflows.find(o=>o && o.type==='quote' && o.id===id && !o.deleted) || null; }
function quoteNum(q){ return String((q && q.id)||'').replace(/^q/, '').slice(-6).toUpperCase(); }
function quoteValidUntil(q){ return addDaysStr(q.date||localDateStr(), q.validDays||15); }
// Estado que se MUESTRA: aceptada/rechazada mandan; si no, vencida por fecha; si no, enviada o borrador.
function quoteState(q, today){
  today = today || localDateStr();
  if(q.status==='accepted' || q.status==='rejected') return q.status;
  if(quoteValidUntil(q) < today) return 'expired';
  return q.status==='sent' ? 'sent' : 'draft';
}
function quoteStateLabel(st){ return t('qt_st_'+st); }
function quoteTagClass(st){ return st==='accepted' ? 'ok' : (st==='expired' || st==='rejected') ? 'crit' : 'warn'; }
function quoteIsOpen(q){ const st = quoteState(q); return st==='draft' || st==='sent'; }
function quoteTitleLine(q){
  const first = (q.lines||[])[0];
  const more = (q.lines||[]).length - 1;
  return first ? (first.desc + (more>0 ? ` +${more}` : '')) : t('qt_job_name').replace('{num}', quoteNum(q));
}
function quoteFmtQty(n){ const v = Number(n)||0; return String(Math.round(v*100)/100); }

/* ---------- clientes ---------- */
function svcClients(){ return (bizProfile && Array.isArray(bizProfile.clients)) ? bizProfile.clients : []; }
function clientById(id){ return svcClients().find(c=>c.id===id) || null; }
function clientNorm(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim(); }
function clientByName(name){
  const q = clientNorm(name); if(!q) return null;
  return svcClients().find(c=>clientNorm(c.name)===q) || null;
}
function clientPhoneDigits(c){ return String((c && c.phone)||'').replace(/\D+/g, ''); }
function clientEmailOk(c){ return !!(c && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(c.email||'').trim())); }
// Crea o actualiza un cliente por nombre. Devuelve el cliente.
function upsertClient(fields){
  if(!bizProfile.clients) bizProfile.clients = [];
  const name = String((fields && fields.name)||'').trim().slice(0, 60);
  if(!name) return null;
  let c = (fields && fields.id) ? clientById(fields.id) : clientByName(name);
  if(!c){ c = {id: uid('cl'), name, phone: '', email: '', notes: '', createdAt: new Date().toISOString()}; bizProfile.clients.push(c); }
  c.name = name;
  if(fields.phone!==undefined) c.phone = String(fields.phone||'').trim().slice(0, 30);
  if(fields.email!==undefined) c.email = String(fields.email||'').trim().slice(0, 80);
  if(fields.notes!==undefined) c.notes = String(fields.notes||'').trim().slice(0, 200);
  return c;
}

/* ---------- baldosa del Dashboard (la dibuja svcDashTilesHtml, app-15) ---------- */
function svcQuotesTileHtml(){
  const open = svcQuotes().filter(quoteIsOpen);
  const today = localDateStr();
  const soon = open.filter(q=>quoteValidUntil(q) <= addDaysStr(today, 3)).length;
  const badge = open.length ? (soon ? {cls:'warn', label:t('qt_st_expiring')} : {cls:'ok', label:t('qt_tile_open_badge')}) : {cls:'', label:t('qt_tile')};
  const total = open.reduce((s,q)=>s+quoteTotals(q).total, 0);
  return `
    <button type="button" class="dash-tile ${sellsProducts() ? 't4' : 't2'}" id="btn-svc-quotes">
      <span class="dash-tile-badge ${badge.cls}">${badge.label}</span>
      <span class="dash-tile-icon" aria-hidden="true">📄</span>
      <b class="dash-tile-num">${open.length}</b>
      <span class="dash-tile-title">${t('qt_tile')}</span>
      <span class="dash-tile-sub">${open.length ? t('qt_tile_sub').replace('{amount}', svcMoneyShort(total)) : t('qt_tile_none')}</span>
    </button>`;
}

/* ---------- HOJA: lista de cotizaciones ---------- */
function quotesSheet(){
  const q = quotesSearch.trim();
  const list = svcQuotes().filter(x=>!q || invMatches((x.client||'')+' '+(x.lines||[]).map(l=>l.desc).join(' '), q))
    .sort((a,b)=>String(b.date).localeCompare(String(a.date)) || String(b.createdAt||'').localeCompare(String(a.createdAt||''))).slice(0, 120);
  const open = svcQuotes().filter(quoteIsOpen).length;
  let lastKey = '';
  const body = `
    <div class="sub svc-sub">${t('qt_sub')}</div>
    <button class="btn btn-primary" id="btn-quotes-new" style="width:100%;margin-bottom:12px;">${t('qt_new_btn')}</button>
    ${svcQuotes().length>5 ? `
    <div class="inv-search-wrap" style="width:100%;margin-bottom:10px;">
      <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" fill="none" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
      <input id="quotes-search" type="search" value="${escapeHtml(quotesSearch)}" placeholder="${t('qt_search')}" aria-label="${t('qt_search')}" autocomplete="off">
    </div>` : ''}
    ${list.length===0 ? `<div class="helper-note" style="margin:8px 0;">${svcQuotes().length ? t('inv_no_results') : t('qt_empty')}</div>` : list.map(x=>{
      const k = monthKey(x.date); const head = k!==lastKey ? `<div class="dash-section-label" style="margin-top:10px;">${monthLabel(k, uiLang)}</div>` : ''; lastKey = k;
      const st = quoteState(x);
      const tot = quoteTotals(x).total;
      return `${head}
    <div class="matched-item svc-row ${st==='expired'?'svc-row-crit':''}" data-open-quote="${escapeHtml(x.id)}" role="button" tabindex="0">
      <span class="svc-row-ic">${x.byAgent ? '✨' : '📄'}</span>
      <span class="svc-row-tx">
        <b>${escapeHtml(x.client||'')}</b>
        <small>#${quoteNum(x)} · ${escapeHtml(quoteTitleLine(x))} · ${escapeHtml(svcShortDate(x.date))}</small>
        <span class="dash-tile-badge svc-tag ${quoteTagClass(st)}">${quoteStateLabel(st)}</span>
      </span>
      <span class="svc-row-amt"><b style="color:${st==='accepted'?'var(--money-pos)':st==='expired'||st==='rejected'?'var(--ink-soft)':'var(--ink)'};">${svcMoneyShort(tot)}</b></span>
    </div>`; }).join('')}
    ${open>0 ? `<div class="helper-note" style="margin-top:10px;">${t('qt_open_hint').replace('{n}', String(open))}</div>` : ''}`;
  return svcSheet('quotes-sheet-overlay', t('qt_title'), body, 'btn-close-quotes-sheet');
}

/* ---------- MODAL: editor de cotización ---------- */
function openQuoteModal(quoteId, preset){
  // Ver una cotización existente no pide permiso de escritura (misma regla que
  // los trabajos: una cuenta en solo lectura tiene que poder mirar); crear una
  // nueva, guardar, aceptar, rechazar y eliminar sí lo piden.
  if(!quoteId && !requireWriteAccess()) return;
  const q = quoteId ? quoteById(quoteId) : null;
  draftQuote = q ? {
    id: q.id, client: q.client||'', clientId: q.clientId||null, date: q.date||localDateStr(), validDays: q.validDays||bizProfile.quoteValidDays||15,
    lines: (q.lines||[]).map(l=>Object.assign({}, l)), discount: q.discount||0, taxPct: (q.taxPct!==undefined && q.taxPct!==null) ? q.taxPct : (bizProfile.taxPct||0),
    notes: q.notes||''
  } : Object.assign({ id: null, client: '', clientId: null, date: localDateStr(), validDays: bizProfile.quoteValidDays||15, lines: [], discount: 0, taxPct: bizProfile.taxPct||0, notes: '' }, preset||{});
  if(!draftQuote.lines.length) draftQuote.lines.push({desc:'', qty:1, unit:'', price:''});
  showQuoteModal = true; quoteModalError = '';
  render();
}
function closeQuoteModal(){ showQuoteModal = false; draftQuote = null; quoteModalError = ''; render(); }
function quoteDraftTotalsHtml(){
  const tt = quoteTotals(draftQuote);
  return `
    <div class="recap-row"><span class="recap-label">${t('qt_subtotal')}</span><span class="recap-col-val">${money(tt.subtotal)}</span></div>
    ${tt.discount>0 ? `<div class="recap-row"><span class="recap-label">${t('qt_discount')}</span><span class="recap-col-val">−${money(tt.discount)}</span></div>` : ''}
    ${tt.tax>0 ? `<div class="recap-row"><span class="recap-label">${t('qt_tax').replace('%', '')} ${Number(draftQuote.taxPct)||0}%</span><span class="recap-col-val">${money(tt.tax)}</span></div>` : ''}
    <div class="recap-row svc-line-big"><span class="recap-label">${t('qt_total')}</span><span class="recap-col-val"><strong style="color:var(--money-pos);">${money(tt.total)}</strong></span></div>`;
}
function quoteModal(){
  const d = draftQuote; if(!d) return '';
  const saved = d.id ? quoteById(d.id) : null;
  const st = saved ? quoteState(saved) : 'draft';
  const catalog = (bizProfile.catalog||[]);
  const products = sellsProducts() ? inventory.filter(i=>i && !isExpenseItem(i) && (i.salePrice||0)>0) : [];
  const cl = d.clientId ? clientById(d.clientId) : clientByName(d.client);
  const locked = st==='accepted';
  const chips = catalog.slice(0, 8);
  return `
  <div class="overlay" id="quote-overlay">
    <div class="modal">
      <h3 class="navy">${d.id ? t('qt_edit')+' #'+quoteNum(saved||d) : t('qt_new')}</h3>
      <div class="sub">${saved && saved.byAgent ? '✨ '+t('qt_by_agent_sub')+' · ' : ''}${t('qt_modal_sub')}</div>
      ${saved ? `<div style="margin:-6px 0 10px;"><span class="dash-tile-badge svc-tag ${quoteTagClass(st)}" style="margin:0;">${quoteStateLabel(st)}</span> <span style="font-size:calc(11.5px * var(--fs, 1));color:var(--ink-soft);margin-left:6px;">${t('qt_valid_until').replace('{d}', svcShortDate(quoteValidUntil(saved)))}</span></div>` : ''}
      <div class="field"><label for="qt-client">${t('qt_client')}</label>
        <input id="qt-client" type="text" maxlength="60" value="${escapeHtml(d.client)}" placeholder="${t('qt_client_ph')}" list="qt-clients-list" autocomplete="off" ${locked?'disabled':''}>
        <datalist id="qt-clients-list">${svcClientNames().map(n=>`<option value="${escapeHtml(n)}"></option>`).join('')}</datalist>
        ${cl ? `<div class="qt-client-meta">${clientPhoneDigits(cl) ? `<span>📞 ${escapeHtml(cl.phone)}</span>` : ''}${clientEmailOk(cl) ? `<span>✉️ ${escapeHtml(cl.email)}</span>` : ''}<button type="button" class="link-btn" id="btn-qt-edit-client">${t('cl_edit_link')}</button></div>`
             : (d.client.trim() ? `<div class="qt-client-meta"><button type="button" class="link-btn" id="btn-qt-save-client">${t('cl_save_link')}</button></div>` : '')}
      </div>
      <div class="field-row">
        <div class="field"><label for="qt-date">${t('lbl_date')}</label><input id="qt-date" type="date" value="${escapeHtml(d.date)}" ${locked?'disabled':''}></div>
        <div class="field"><label for="qt-valid">${t('qt_valid')}</label><select id="qt-valid" ${locked?'disabled':''}>${QUOTE_VALID_DAYS.map(n=>`<option value="${n}" ${Number(d.validDays)===n?'selected':''}>${t('qt_days').replace('{n}', String(n))}</option>`).join('')}</select></div>
      </div>
      <div class="field"><label>${t('qt_lines')}</label>
        <datalist id="qt-desc-list">${catalog.map(c=>`<option value="${escapeHtml(c.name)}"></option>`).join('')}${products.map(p=>`<option value="${escapeHtml(p.name)}"></option>`).join('')}</datalist>
        <div class="qt-lines">
          <div class="qt-line qt-line-head"><span>${t('qt_line_desc')}</span><span>${t('qt_line_qty')}</span><span>${t('qt_line_price')}</span><span></span></div>
          ${d.lines.map((l,i)=>`
          <div class="qt-line">
            <input type="text" maxlength="80" data-ql="${i}" data-qf="desc" value="${escapeHtml(l.desc||'')}" placeholder="${t('qt_line_desc_ph')}" list="qt-desc-list" autocomplete="off" ${locked?'disabled':''}>
            <input type="number" min="0" step="0.01" inputmode="decimal" data-ql="${i}" data-qf="qty" value="${escapeHtml(l.qty===''||l.qty===undefined?'':String(l.qty))}" placeholder="1" ${locked?'disabled':''}>
            <input type="number" min="0" step="0.01" inputmode="decimal" data-ql="${i}" data-qf="price" value="${escapeHtml(l.price===''||l.price===undefined||l.price===null?'':String(l.price))}" placeholder="0.00" ${locked?'disabled':''}>
            ${locked ? '<span></span>' : `<button type="button" class="link-btn svc-x" data-ql-del="${i}" aria-label="${t('btn_delete')}">✕</button>`}
          </div>`).join('')}
        </div>
        ${quoteModalError ? `<div style="font-size:calc(12px * var(--fs, 1));color:var(--tomato);margin-top:4px;">${quoteModalError}</div>` : ''}
        ${locked ? '' : `<div class="svc-row-actions" style="margin:8px 0 0;"><button type="button" class="btn btn-ghost btn-sm" id="btn-qt-add-line">${t('qt_add_line')}</button></div>`}
        ${(!locked && chips.length) ? `<div style="font-size:calc(11px * var(--fs, 1));font-weight:700;color:var(--ink-soft);margin:10px 0 6px;">${t('qt_quick')}</div>
        <div class="svc-seg">${chips.map(c=>`<button type="button" class="exit-reason-chip" data-qt-chip="${escapeHtml(c.id)}">${escapeHtml(c.name)}${c.price>0 ? ' · '+svcServicePrice(c) : ''}</button>`).join('')}</div>` : ''}
      </div>
      <div class="field-row">
        <div class="field"><label for="qt-discount">${t('qt_discount')}</label><input id="qt-discount" type="number" min="0" step="0.01" inputmode="decimal" value="${escapeHtml(d.discount?String(d.discount):'')}" placeholder="0.00" ${locked?'disabled':''}></div>
        <div class="field"><label for="qt-tax">${t('qt_tax')}</label><input id="qt-tax" type="number" min="0" max="100" step="0.01" inputmode="decimal" value="${escapeHtml(d.taxPct?String(d.taxPct):'')}" placeholder="0" ${locked?'disabled':''}></div>
      </div>
      <div class="field"><label for="qt-notes">${t('qt_notes')}</label><textarea id="qt-notes" rows="2" maxlength="300" placeholder="${t('qt_notes_ph')}" ${locked?'disabled':''}>${escapeHtml(d.notes)}</textarea></div>
      <div class="settings-card svc-card" id="qt-totals">${quoteDraftTotalsHtml()}</div>
      <div class="modal-actions">
        <button class="btn btn-ghost" id="btn-cancel-quote">${locked ? t('btn_close') : t('btn_cancel')}</button>
        ${locked ? '' : `<button class="btn btn-primary" id="btn-save-quote">${t('qt_save')}</button>`}
      </div>
      ${saved ? `
      <div class="qt-actions">
        <button type="button" class="btn btn-ghost btn-sm" id="btn-qt-pdf">📄 ${t('qt_send_pdf')}</button>
        <button type="button" class="btn btn-ghost btn-sm" id="btn-qt-wa">💬 ${t('qt_send_wa')}</button>
        <button type="button" class="btn btn-ghost btn-sm" id="btn-qt-email">✉️ ${t('qt_send_email')}</button>
      </div>
      ${st==='accepted' ? `<div class="helper-note" style="margin:8px 0 0;">✅ ${t('qt_accepted_note')}${saved.jobId && jobById(saved.jobId) ? ` <button type="button" class="link-btn" id="btn-qt-open-job">${t('qt_open_job')}</button>` : ''}</div>` : `
      <div class="qt-actions">
        <button type="button" class="btn btn-primary btn-sm" id="btn-qt-accept" style="background:var(--money-pos);">✅ ${t('qt_accept')}</button>
        ${st!=='rejected' ? `<button type="button" class="btn btn-ghost btn-sm" id="btn-qt-reject">${t('qt_reject')}</button>` : ''}
        <button type="button" class="btn btn-ghost btn-sm" id="btn-qt-delete" style="color:var(--tomato);">${t('qt_delete')}</button>
      </div>`}` : ''}
    </div>
  </div>`;
}
function readQuoteDraftFromDom(){
  const g = (id)=>document.getElementById(id);
  const d = draftQuote; if(!d) return;
  if(g('qt-client')) d.client = g('qt-client').value.trim();
  if(g('qt-date') && g('qt-date').value) d.date = g('qt-date').value;
  if(g('qt-valid')) d.validDays = parseInt(g('qt-valid').value, 10) || 15;
  if(g('qt-discount')) d.discount = parseFloat(g('qt-discount').value) || 0;
  if(g('qt-tax')) d.taxPct = parseFloat(g('qt-tax').value) || 0;
  if(g('qt-notes')) d.notes = g('qt-notes').value.trim();
  document.querySelectorAll('[data-ql]').forEach(inp=>{
    const l = d.lines[parseInt(inp.dataset.ql, 10)]; if(!l) return;
    if(inp.dataset.qf==='desc') l.desc = inp.value.trim();
    else if(inp.dataset.qf==='qty') l.qty = inp.value==='' ? '' : parseFloat(inp.value);
    else if(inp.dataset.qf==='price') l.price = inp.value==='' ? '' : parseFloat(inp.value);
  });
  const c = clientByName(d.client);
  d.clientId = c ? c.id : null;
}
// Precio sugerido para una descripción: servicio de la lista (por su unidad) o
// producto con precio de venta. Devuelve {price, unit, serviceId, itemId} o null.
function quoteSuggestForDesc(desc){
  const q = clientNorm(desc); if(!q) return null;
  const c = (bizProfile.catalog||[]).find(x=>clientNorm(x.name)===q);
  if(c) return {price: c.price>0 ? c.price : null, unit: c.unit||'fixed', serviceId: c.id, itemId: null};
  if(sellsProducts()){
    const it = inventory.find(i=>i && !isExpenseItem(i) && clientNorm(i.name)===q);
    if(it) return {price: (it.salePrice||0)>0 ? it.salePrice : null, unit: it.unit||'', serviceId: null, itemId: it.id};
  }
  return null;
}
function cleanQuoteLines(lines){
  return (lines||[]).map(l=>{
    const desc = String(l.desc||'').trim().slice(0, 80);
    const qty = Number(l.qty); const price = Number(l.price);
    if(!desc) return null;
    const sug = quoteSuggestForDesc(desc) || {};
    return { desc, qty: (Number.isFinite(qty) && qty>0) ? Math.round(qty*100)/100 : 1, unit: String(l.unit||sug.unit||'').slice(0, 20),
      price: (Number.isFinite(price) && price>=0) ? Math.round(price*100)/100 : 0, serviceId: l.serviceId||sug.serviceId||null, itemId: l.itemId||sug.itemId||null };
  }).filter(Boolean);
}
// Guarda (nueva o editada). Devuelve la cotización o null si falta algo.
function saveQuoteFromDraft(opts){
  if(!requireWriteAccess()) return false;
  readQuoteDraftFromDom();
  const d = draftQuote;
  const lines = cleanQuoteLines(d.lines);
  if(!d.client || !lines.length || !lines.some(l=>l.price>0)){ quoteModalError = t('qt_err'); render(); return null; }
  let q = d.id ? quoteById(d.id) : null;
  const fields = { client: d.client.slice(0, 60), clientId: d.clientId||null, date: d.date, validDays: QUOTE_VALID_DAYS.indexOf(Number(d.validDays))>=0 ? Number(d.validDays) : 15,
    lines, discount: Math.max(0, Math.round((Number(d.discount)||0)*100)/100), taxPct: Math.min(100, Math.max(0, Math.round((Number(d.taxPct)||0)*100)/100)), notes: d.notes.slice(0, 300) };
  if(q){
    Object.assign(q, fields, { lastEditedAt: new Date().toISOString() });
  } else {
    q = Object.assign({ id: uid('q'), type:'quote', status:'draft', sentAt:null, acceptedAt:null, jobId:null, items: [], createdAt: new Date().toISOString(),
      byLabel: (typeof currentUserLabel==='function' && currentUser) ? currentUserLabel() : '', byAgent: !!(opts && opts.byAgent) }, fields);
    recordOutflow(q);
  }
  // Los últimos impuesto/validez usados quedan como default del negocio.
  if(fields.taxPct!==bizProfile.taxPct || fields.validDays!==bizProfile.quoteValidDays){ bizProfile.taxPct = fields.taxPct; bizProfile.quoteValidDays = fields.validDays; }
  d.id = q.id;
  saveState();
  logActivity('quote_saved', q.client, money(quoteTotals(q).total));
  return q;
}
function markQuoteSent(q){
  if(!q || q.status==='accepted' || q.status==='rejected') return;
  if(q.status!=='sent'){ q.status = 'sent'; q.sentAt = q.lastEditedAt = new Date().toISOString(); saveState(); logActivity('quote_sent', q.client, money(quoteTotals(q).total)); }
}
function rejectQuote(q){ if(!q) return; q.status = 'rejected'; q.lastEditedAt = new Date().toISOString(); saveState(); }
function deleteQuote(q){ if(!q) return; q.deleted = true; q.deletedAt = q.lastEditedAt = new Date().toISOString(); saveState(); logActivity('quote_deleted', q.client); }
// El cliente dijo que sí: la cotización se vuelve TRABAJO (pendiente de cobro) y
// queda enlazada. Devuelve el trabajo.
/* Qué PRODUCTOS del inventario lleva una cotización y cuánto sale de cada uno.
   Solo líneas con itemId que sigan siendo mercadería (no gastos). Igual que el
   escáner de reducción, nunca deja stock negativo: si no alcanza sale lo que hay
   y "short" anota lo que faltó. Varias líneas del mismo producto se descuentan
   en orden contra el stock que va quedando. Cada fila tiene la forma de una
   salida por venta (reason/costAt/priceAt), lista para job.items y outflowPL. */
function quoteStockItems(q){
  const out = [];
  const left = new Map();
  (q && Array.isArray(q.lines) ? q.lines : []).forEach(l=>{
    if(!l || !l.itemId) return;
    const ing = inventory.find(i=>i && i.id===l.itemId && !isExpenseItem(i));
    if(!ing) return;
    const wanted = roundQty(Number(l.qty)||0);
    if(!(wanted>0)) return;
    const cur = left.has(ing.id) ? left.get(ing.id) : roundQty(Math.max(0, Number(ing.qtyOnHand)||0));
    const qty = roundQty(Math.min(cur, wanted));
    left.set(ing.id, roundQty(cur - qty));
    out.push({ingId: ing.id, ingName: ing.name, qty, unit: ing.unit, reason: 'sale',
      costAt: Number(ing.costPerUnit)||0, priceAt: roundQty(Number(l.price)||0), short: roundQty(wanted - qty)});
  });
  return out;
}
function acceptQuote(q, opts){
  if(!q) return null;
  if(q.status==='accepted' && q.jobId){
    const ya = jobById(q.jobId);
    // Ya es un trabajo vigente: idempotente. Si ese trabajo se eliminó, aceptar
    // de nuevo crea uno nuevo (antes devolvía el borrado y no pasaba nada).
    if(ya && !ya.deleted) return ya;
  }
  /* Un trabajo VIVO que ya nació de esta cotización (la cotización volvió a
     "enviada" al borrarlo en un teléfono, pero el trabajo revivió cobrado desde
     otro): se re-enlaza en vez de crear un segundo trabajo por el mismo dinero
     (auditoría de la auditoría 2026-09-12). */
  const vivo = svcJobs().find(j=>j.quoteId===q.id);
  if(vivo){
    q.status = 'accepted'; q.acceptedAt = q.acceptedAt || new Date().toISOString(); q.jobId = vivo.id; q.lastEditedAt = new Date().toISOString();
    saveState();
    return vivo;
  }
  const tt = quoteTotals(q);
  const date = (opts && opts.date) || localDateStr();
  const dueDays = 15;
  const first = (q.lines||[])[0];
  const svc = first && first.serviceId ? serviceById(first.serviceId) : null;
  /* LOS PRODUCTOS DE LA COTIZACIÓN SALEN DEL INVENTARIO (auditoría de datos
     2026-09-12). Una cotización mezcla servicios y productos físicos (líneas
     con itemId). Antes, al aceptarla, el trabajo llevaba el total como ingreso
     pero el stock no se movía y el Cierre de mes no tenía costo de lo vendido:
     ganancia bruta inflada y mercadería fantasma en el Valor del inventario.
     Ahora cada línea con producto es una salida por venta como la del escáner
     de reducción (costAt/priceAt congelados al día), colgada del trabajo
     (job.items): outflowPL le suma el COGS y el ingreso sigue siendo el precio
     del trabajo, que ya incluye esas líneas. Eliminar el trabajo devuelve el
     stock (restoreJobStock, app-15). */
  const items = quoteStockItems(q).filter(it=>it.qty>0);
  items.forEach(it=>{
    const ing = inventory.find(i=>i && i.id===it.ingId);
    if(!ing) return;
    ing.qtyOnHand = roundQty(Math.max(0, (Number(ing.qtyOnHand)||0) - it.qty));
    if(currentUser){ ing.lastEditedBy = currentUserLabel(); ing.lastEditedAt = new Date().toISOString(); }
  });
  const job = { id: uid('job'), type:'service', date, client: q.client, serviceName: quoteTitleLine(q).slice(0, 60), serviceId: svc ? svc.id : null, assetId: null,
    price: tt.total, paid: false, dueDate: addDaysStr(date, dueDays), dueDays, paidDate: null, repeat: null, items, createdAt: new Date().toISOString(),
    quoteId: q.id, byLabel: (typeof currentUserLabel==='function' && currentUser) ? currentUserLabel() : '', byAgent: !!(opts && opts.byAgent) };
  recordOutflow(job);
  q.status = 'accepted'; q.acceptedAt = new Date().toISOString(); q.jobId = job.id; q.lastEditedAt = q.acceptedAt;
  saveState();
  logActivity('quote_accepted', q.client, money(tt.total));
  logActivity('job_saved', job.client, job.serviceName);
  if(items.length) logActivity('stock_adjust', '', String(items.length));
  return job;
}
// Texto corto de lo que salió del inventario al aceptar, para el aviso.
function quoteStockToast(job){
  const salidas = (job && Array.isArray(job.items) ? job.items : []).filter(it=>it.qty>0);
  if(!salidas.length) return '';
  return ' · ' + t('qt_accepted_stock').replace('{list}', salidas.map(it=>`${quoteFmtQty(it.qty)} ${unitLabel(it.unit)} ${it.ingName}`).join(', '));
}

/* ---------- PDF de la cotización (mismo escritor que la cuenta de cobro) ---------- */
function buildQuotePdf(q){
  const pdf = DustyPdf();
  const tt = quoteTotals(q);
  const name = svcPdfHeader(pdf, t('qt_pdf_title') + ' · #' + quoteNum(q));
  const cl = q.clientId ? clientById(q.clientId) : clientByName(q.client);
  pdf.line(`${t('qt_client')}: ${q.client||''}`, {size: 11, bold: true, lh: 18});
  const contact = [cl && cl.phone ? cl.phone : '', cl && clientEmailOk(cl) ? cl.email : ''].filter(Boolean).join('   ·   ');
  if(contact) pdf.line(contact, {size: 9.5, color: [0.35, 0.35, 0.4], lh: 15});
  pdf.line(`${t('lbl_date')}: ${q.date||''}   ·   ${t('qt_valid_until').replace('{d}', quoteValidUntil(q))}`, {size: 9.5, color: [0.35, 0.35, 0.4], lh: 15});
  pdf.gap(10);
  // Unidad traducida ("3 h", "2 días", "20 unidades"), no el token interno ('hour', 'unidad').
  const unitTxt = (qty, u)=> !u || u==='fixed' ? '' : ' ' + svcUnitQtyLabel(qty, u);
  const rows = (q.lines||[]).map(l=>({desc: l.desc, qty: quoteFmtQty(l.qty)+unitTxt(l.qty, l.unit), unit: money(l.price||0), total: money(Math.round((Number(l.qty)||0)*(Number(l.price)||0)*100)/100)}));
  rows.push({desc: t('qt_subtotal'), qty: '', unit: '', total: money(tt.subtotal), _muted: true});
  if(tt.discount>0) rows.push({desc: t('qt_discount'), qty: '', unit: '', total: '-'+money(tt.discount), _muted: true});
  if(tt.tax>0) rows.push({desc: `${t('qt_tax').replace('%','').trim()} ${q.taxPct}%`, qty: '', unit: '', total: money(tt.tax), _muted: true});
  rows.push({desc: t('rp_total'), qty: '', unit: '', total: money(tt.total), _bold: true});
  pdf.table([{key:'desc', label: t('rd_col_desc')}, {key:'qty', label: t('rd_col_qty'), w: 70, align:'right'}, {key:'unit', label: t('qt_line_price'), w: 90, align:'right'}, {key:'total', label: t('rp_col_total'), w: 100, align:'right'}], rows);
  pdf.gap(12);
  if(q.notes){ pdf.line(t('qt_notes'), {size: 10, bold: true, lh: 16}); String(q.notes).split(/\n+/).forEach(s=>pdf.line(s, {size: 9.5, lh: 14})); pdf.gap(6); }
  if(bizProfile.quoteTerms){ pdf.line(t('qt_terms_label'), {size: 10, bold: true, lh: 16}); String(bizProfile.quoteTerms).split(/\n+/).forEach(s=>pdf.line(s, {size: 9.5, lh: 14})); pdf.gap(6); }
  pdf.line(t('qt_pdf_thanks'), {size: 9, color: [0.45, 0.45, 0.5], lh: 14});
  return pdf.build((n, total)=>({left: name + ' · ' + t('qt_pdf_title') + ' #' + quoteNum(q), right: t('rp_page').replace('{n}', n).replace('{t}', total)}));
}
function quoteFileName(q){
  const who = svcFileSlug(q.client, t('svc_client'));
  return `${svcFileSlug('', t('qt_title'))}-${quoteNum(q)}-${who}`;
}
function downloadQuotePdf(q){
  let bytes; try{ bytes = buildQuotePdf(q); }catch(e){ console.error('[Dusty] cotización PDF:', e); showToast(t('rp_failed'), 'error'); return; }
  svcSharePdf(bytes, quoteFileName(q), t('qt_pdf_title') + ' #' + quoteNum(q) + ' · ' + (q.client||''));
  markQuoteSent(q);
}

/* ---------- WhatsApp: al número guardado del cliente, o a elegir contacto ---------- */
function quoteWhatsappText(q){
  const tt = quoteTotals(q);
  const lines = (q.lines||[]).map(l=>`• ${quoteFmtQty(l.qty)} × ${l.desc}: ${money(Math.round((Number(l.qty)||0)*(Number(l.price)||0)*100)/100)}`).join('\n');
  return t('qt_wa_msg').replace('{client}', q.client||'').replace('{num}', quoteNum(q)).replace('{lines}', lines).replace('{total}', money(tt.total)).replace('{until}', svcShortDate(quoteValidUntil(q)));
}
function quoteWhatsapp(q){
  const cl = q.clientId ? clientById(q.clientId) : clientByName(q.client);
  const digits = clientPhoneDigits(cl);
  const url = 'https://wa.me/' + (digits ? digits : '') + '?text=' + encodeURIComponent(quoteWhatsappText(q));
  if(!digits) showToast(t('qt_no_phone_hint'), 'info');
  try{ window.open(url, '_blank', 'noopener'); }catch(e){ location.href = url; }
  markQuoteSent(q);
}

/* ---------- Correo con el PDF adjunto (función send-quote de Netlify) ----------
   Si el servidor no tiene proveedor de correo configurado (RESEND_API_KEY) o la
   cuenta no puede usarlo, se abre la app de correo del teléfono con el texto
   listo — el PDF se comparte aparte. Nunca se queda mudo. */
function quoteEmailFallback(q, cl, why){
  const subject = t('qt_email_subject').replace('{num}', quoteNum(q)).replace('{biz}', (businessName||'Dusty').trim());
  const body = t('qt_email_body').replace('{client}', q.client||'').replace('{num}', quoteNum(q)).replace('{total}', money(quoteTotals(q).total)).replace('{until}', svcShortDate(quoteValidUntil(q))) + '\n\n' + quoteWhatsappText(q);
  showToast(why || t('qt_email_fallback'), 'info');
  const url = 'mailto:' + encodeURIComponent(cl.email) + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  try{ location.href = url; }catch(e){}
}
async function sendQuoteEmail(q){
  const cl = q.clientId ? clientById(q.clientId) : clientByName(q.client);
  if(!clientEmailOk(cl)){ showToast(t('qt_email_needs'), 'error'); return false; }
  let bytes; try{ bytes = buildQuotePdf(q); }catch(e){ showToast(t('rp_failed'), 'error'); return false; }
  let b64 = ''; try{ let s = ''; const arr = new Uint8Array(bytes); for(let i=0;i<arr.length;i++) s += String.fromCharCode(arr[i]); b64 = btoa(s); }catch(e){ quoteEmailFallback(q, cl); return false; }
  const subject = t('qt_email_subject').replace('{num}', quoteNum(q)).replace('{biz}', (businessName||'Dusty').trim());
  const text = t('qt_email_body').replace('{client}', q.client||'').replace('{num}', quoteNum(q)).replace('{total}', money(quoteTotals(q).total)).replace('{until}', svcShortDate(quoteValidUntil(q))) + '\n\n' + quoteWhatsappText(q);
  showToast(t('qt_email_sending'), 'info');
  try{
    const res = await callDustyAI('/.netlify/functions/send-quote', { to: cl.email, clientName: q.client, subject, text, pdfBase64: b64, fileName: quoteFileName(q)+'.pdf', lang: uiLang }, { notFoundKey: 'qt_email_fallback', genericKey: 'qt_email_fallback', silent: true });
    if(res && res.ok){ markQuoteSent(q); q.emailedAt = new Date().toISOString(); q.emailedTo = cl.email; saveState(); showToast(t('qt_email_sent').replace('{to}', cl.email)); render(); return true; }
    quoteEmailFallback(q, cl, res && res.error ? res.error : null);
    return false;
  }catch(e){
    // callDustyAI lanza con el mensaje ya traducido (sin conexión, sin sesión,
    // correo no configurado en el servidor...): se muestra ese y se abre la
    // app de correo como salida.
    quoteEmailFallback(q, cl, e && e.message ? e.message : null);
    return false;
  }
}

/* ---------- HOJA + MODAL: clientes ---------- */
function clientsSheet(){
  const list = svcClients().slice().sort((a,b)=>a.name.localeCompare(b.name));
  const body = `
    <div class="sub svc-sub">${t('cl_sub')}</div>
    <button class="btn btn-primary" id="btn-client-new" style="width:100%;margin-bottom:12px;">${t('cl_new_btn')}</button>
    ${list.length===0 ? `<div class="helper-note" style="margin:8px 0;">${t('cl_empty')}</div>` : list.map((c,i)=>`
    <div class="matched-item svc-row" data-edit-client="${escapeHtml(c.id)}" role="button" tabindex="0">
      <span class="svc-row-ic svc-row-ic-t${(i%4)+1}">${escapeHtml((c.name||'?').trim().charAt(0).toUpperCase())}</span>
      <span class="svc-row-tx"><b>${escapeHtml(c.name)}</b><small>${[c.phone ? '📞 '+c.phone : '', clientEmailOk(c) ? '✉️ '+c.email : ''].filter(Boolean).map(escapeHtml).join(' · ') || t('cl_no_contact')}</small></span>
      <span class="svc-row-amt" style="color:var(--ink-soft);">›</span>
    </div>`).join('')}`;
  return svcSheet('clients-sheet-overlay', t('cl_title'), body, 'btn-close-clients-sheet');
}
function openClientModal(clientId, presetName){
  if(!clientId && !requireWriteAccess()) return;
  const c = clientId ? clientById(clientId) : (presetName ? clientByName(presetName) : null);
  draftClient = c ? {id:c.id, name:c.name||'', phone:c.phone||'', email:c.email||'', notes:c.notes||''} : {id:null, name:presetName||'', phone:'', email:'', notes:''};
  showClientModal = true; clientModalError = '';
  render();
}
function closeClientModal(){ showClientModal = false; draftClient = null; render(); }
function clientModal(){
  const d = draftClient; if(!d) return '';
  return `
  <div class="overlay" id="client-overlay">
    <div class="modal">
      <h3 class="navy">${d.id ? t('cl_edit') : t('cl_new')}</h3>
      <div class="sub">${t('cl_sub')}</div>
      <div class="field"><label for="cl-name">${t('cl_name')}</label>
        <input id="cl-name" type="text" maxlength="60" value="${escapeHtml(d.name)}" placeholder="${t('qt_client_ph')}" autocomplete="off">
        ${clientModalError ? `<div style="font-size:calc(12px * var(--fs, 1));color:var(--tomato);margin-top:4px;">${clientModalError}</div>` : ''}
      </div>
      <div class="field"><label for="cl-phone">${t('cl_phone')}</label><input id="cl-phone" type="tel" inputmode="tel" maxlength="30" value="${escapeHtml(d.phone)}" placeholder="5215512345678"></div>
      <div class="field"><label for="cl-email">${t('cl_email')}</label><input id="cl-email" type="email" inputmode="email" maxlength="80" value="${escapeHtml(d.email)}" placeholder="cliente@correo.com" autocomplete="off"></div>
      <div class="field"><label for="cl-notes">${t('cl_notes')}</label><input id="cl-notes" type="text" maxlength="200" value="${escapeHtml(d.notes)}" placeholder="${t('cl_notes_ph')}"></div>
      <div class="modal-actions">
        <button class="btn btn-ghost" id="btn-cancel-client">${t('btn_cancel')}</button>
        <button class="btn btn-primary" id="btn-save-client">${t('cl_save')}</button>
      </div>
      ${d.id ? `<button type="button" class="link-btn" id="btn-delete-client" style="width:100%;margin-top:6px;color:var(--tomato);">${t('cl_delete')}</button>` : ''}
    </div>
  </div>`;
}
function saveClientFromDraft(){
  if(!requireWriteAccess()) return false;
  const g = (id)=>document.getElementById(id);
  const d = draftClient;
  const name = g('cl-name') ? g('cl-name').value.trim() : '';
  if(!name){ clientModalError = t('cl_err'); render(); return null; }
  const email = g('cl-email') ? g('cl-email').value.trim() : '';
  if(email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ clientModalError = t('cl_email_err'); render(); return null; }
  const c = upsertClient({ id: d.id, name, phone: g('cl-phone') ? g('cl-phone').value.trim() : '', email, notes: g('cl-notes') ? g('cl-notes').value.trim() : '' });
  // La cotización abierta, si la hay, adopta el cliente recién guardado.
  if(draftQuote && (!draftQuote.client || clientNorm(draftQuote.client)===clientNorm(name))){ draftQuote.client = c.name; draftQuote.clientId = c.id; }
  saveState();
  return c;
}

/* ---------- EVENTOS ---------- */
function attachQuotesEvents(){
  const g = (id)=>document.getElementById(id);
  const on = (id, fn)=>{ const el = g(id); if(el) el.onclick = fn; };
  const overlayClose = (id, fn)=>{ const ov = g(id); if(ov) ov.onmousedown = (e)=>{ if(e.target===ov) fn(); }; };

  on('btn-svc-quotes', ()=>svcShow(()=>{ showQuotesSheet = true; }));
  on('btn-svc-clients', ()=>svcShow(()=>{ settingsReturnPending = true; showAlertSettingsModal = false; showClientsSheet = true; }));

  /* Hoja de cotizaciones */
  const closeQuotes = ()=>svcShow(()=>{ showQuotesSheet = false; });
  overlayClose('quotes-sheet-overlay', closeQuotes);
  on('btn-close-quotes-sheet', closeQuotes);
  on('btn-quotes-new', ()=>openQuoteModal(null));
  const qs = g('quotes-search');
  if(qs) qs.oninput = (e)=>{ const pos = e.target.selectionStart; quotesSearch = e.target.value; scheduleSearchTriggeredRender(()=>{ const fresh = document.getElementById('quotes-search'); if(fresh){ fresh.focus(); try{ fresh.setSelectionRange(pos, pos); }catch(err){} } }); };
  document.querySelectorAll('[data-open-quote]').forEach(el=>{ el.onclick = ()=>openQuoteModal(el.dataset.openQuote); });

  /* Modal de cotización */
  overlayClose('quote-overlay', closeQuoteModal);
  on('btn-cancel-quote', closeQuoteModal);
  on('btn-save-quote', ()=>{ if(saveQuoteFromDraft()){ showToast(t('qt_saved')); closeQuoteModal(); } });
  if(draftQuote){
    const live = ()=>{ readQuoteDraftFromDom(); const el = g('qt-totals'); if(el) el.innerHTML = quoteDraftTotalsHtml(); };
    document.querySelectorAll('[data-ql]').forEach(inp=>{
      inp.oninput = ()=>{
        if(inp.dataset.qf==='desc'){
          // Descripción de la lista: completa precio (y unidad) si el precio está vacío.
          const i = parseInt(inp.dataset.ql, 10);
          const priceInp = document.querySelector(`[data-ql="${i}"][data-qf="price"]`);
          const sug = quoteSuggestForDesc(inp.value);
          if(sug && sug.price!==null && priceInp && !priceInp.value){ priceInp.value = String(sug.price); }
        }
        live();
      };
    });
    ['qt-discount','qt-tax','qt-client'].forEach(id=>{ const el = g(id); if(el) el.oninput = live; });
    const dateEl = g('qt-date'); if(dateEl) dateEl.onchange = live;
    const validEl = g('qt-valid'); if(validEl) validEl.onchange = live;
    const clientEl = g('qt-client'); if(clientEl) clientEl.onchange = ()=>{ readQuoteDraftFromDom(); render(); };
    on('btn-qt-add-line', ()=>{ readQuoteDraftFromDom(); draftQuote.lines.push({desc:'', qty:1, unit:'', price:''}); render(); });
    document.querySelectorAll('[data-ql-del]').forEach(b=>{ b.onclick = ()=>{ readQuoteDraftFromDom(); draftQuote.lines.splice(parseInt(b.dataset.qlDel, 10), 1); if(!draftQuote.lines.length) draftQuote.lines.push({desc:'', qty:1, unit:'', price:''}); render(); }; });
    document.querySelectorAll('[data-qt-chip]').forEach(b=>{ b.onclick = ()=>{
      readQuoteDraftFromDom();
      const c = serviceById(b.dataset.qtChip); if(!c) return;
      const empty = draftQuote.lines.findIndex(l=>!String(l.desc||'').trim());
      const line = {desc: c.name, qty: 1, unit: c.unit||'fixed', price: c.price>0 ? c.price : '', serviceId: c.id, itemId: null};
      if(empty>=0) draftQuote.lines[empty] = line; else draftQuote.lines.push(line);
      render();
    }; });
    on('btn-qt-save-client', ()=>{ readQuoteDraftFromDom(); openClientModal(null, draftQuote.client); });
    on('btn-qt-edit-client', ()=>{ readQuoteDraftFromDom(); const c = draftQuote.clientId ? clientById(draftQuote.clientId) : clientByName(draftQuote.client); openClientModal(c ? c.id : null, draftQuote.client); });
    const savedQ = draftQuote.id ? quoteById(draftQuote.id) : null;
    if(savedQ){
      // Solo lectura: se manda la copia guardada sin abrir el paywall (como Imprimir en un trabajo).
      const persist = ()=>{ if(quoteState(savedQ)==='accepted' || (typeof accessLocked==='function' && accessLocked())) return savedQ; return saveQuoteFromDraft() ? quoteById(draftQuote.id) : null; };
      on('btn-qt-pdf', ()=>{ const q = persist(); if(q){ downloadQuotePdf(q); render(); } });
      on('btn-qt-wa', ()=>{ const q = persist(); if(q){ quoteWhatsapp(q); render(); } });
      on('btn-qt-email', ()=>{ const q = persist(); if(q) sendQuoteEmail(q); });
      on('btn-qt-accept', ()=>{
        const q = persist(); if(!q) return;
        const conStock = quoteStockItems(q).length>0;
        if(!confirm(t('qt_accept_confirm').replace('{client}', q.client).replace('{total}', money(quoteTotals(q).total)) + (conStock ? ' ' + t('qt_accept_confirm_stock') : ''))) return;
        const yaAceptada = quoteState(q)==='accepted';
        const job = acceptQuote(q);
        showToast(t('qt_accepted_toast').replace('{client}', q.client) + (yaAceptada ? '' : quoteStockToast(job)));
        closeQuoteModal();
        if(job) openJobModal(job.id);
      });
      on('btn-qt-reject', ()=>{ const q = persist(); if(!q) return; rejectQuote(q); showToast(t('qt_rejected_toast')); closeQuoteModal(); });
      on('btn-qt-delete', ()=>{ if(!requireWriteAccess()) return; if(!confirm(t('qt_delete_confirm'))) return; deleteQuote(savedQ); showToast(t('qt_deleted')); closeQuoteModal(); });
      on('btn-qt-open-job', ()=>{ const j = savedQ.jobId ? jobById(savedQ.jobId) : null; closeQuoteModal(); if(j) openJobModal(j.id); });
    }
  }

  /* Clientes */
  const closeClients = ()=>svcShow(()=>{ showClientsSheet = false; if(typeof reopenSettingsIfPending==='function') reopenSettingsIfPending(); });
  overlayClose('clients-sheet-overlay', closeClients);
  on('btn-close-clients-sheet', closeClients);
  on('btn-client-new', ()=>openClientModal(null));
  document.querySelectorAll('[data-edit-client]').forEach(el=>{ el.onclick = ()=>openClientModal(el.dataset.editClient); });
  overlayClose('client-overlay', closeClientModal);
  on('btn-cancel-client', closeClientModal);
  on('btn-save-client', ()=>{ if(saveClientFromDraft()){ showToast(t('cl_saved')); closeClientModal(); } });
  on('btn-delete-client', ()=>{ if(!requireWriteAccess()) return;
    const c = clientById(draftClient.id); if(!c) return;
    if(!confirm(t('cl_delete_confirm').replace('{name}', c.name))) return;
    bizProfile.clients = svcClients().filter(x=>x.id!==c.id);
    saveState(); closeClientModal();
  });
}

/* ---------- PUENTE CON EL ASISTENTE (app-16 llama a esto) ----------
   create_quote: {client, lines:[{description, qty, unit_price}], discount, tax_pct,
   valid_days, notes, date}. Resuelve cada línea contra la lista de servicios (por
   su unidad) o los productos con precio de venta; si el modelo trae unit_price,
   manda ese. Si a alguna línea le falta precio, NO crea nada: devuelve la lista
   de faltantes para que el asistente pregunte una sola cosa (regla 4). */
function quoteFromAgentInput(inp){
  const client = String((inp && inp.client)||'').trim().slice(0, 60);
  if(!client) return {error: 'client required'};
  const raw = Array.isArray(inp.lines) ? inp.lines : [];
  if(!raw.length) return {error: 'at least one line required'};
  const missing = [];
  const lines = raw.map(l=>{
    const desc = String((l && (l.description||l.desc))||'').trim().slice(0, 80);
    if(!desc) return null;
    const qty = Number(l.qty); const given = Number(l.unit_price);
    const svc = agentFind(bizProfile.catalog||[], desc, x=>x.name);
    const item = (!svc && sellsProducts()) ? agentFind(inventory.filter(i=>i && !isExpenseItem(i)), desc, x=>x.name) : null;
    let price = Number.isFinite(given) && given>=0 ? given : (svc && svc.price>0 ? svc.price : (item && (item.salePrice||0)>0 ? item.salePrice : null));
    if(price===null){ missing.push(desc); price = 0; }
    return { desc: svc ? svc.name : (item ? item.name : desc), qty: (Number.isFinite(qty) && qty>0) ? qty : 1, unit: svc ? (svc.unit||'fixed') : (item ? (item.unit||'') : ''), price, serviceId: svc ? svc.id : null, itemId: item ? item.id : null };
  }).filter(Boolean);
  if(!lines.length) return {error: 'lines need a description'};
  if(missing.length) return {error: 'missing_price', missing};
  const cl = clientByName(client);
  const validDays = QUOTE_VALID_DAYS.indexOf(Number(inp.valid_days))>=0 ? Number(inp.valid_days) : (bizProfile.quoteValidDays||15);
  const taxPct = Number.isFinite(Number(inp.tax_pct)) && inp.tax_pct!==null && inp.tax_pct!==undefined ? Math.min(100, Math.max(0, Number(inp.tax_pct))) : (bizProfile.taxPct||0);
  return { draft: { client: cl ? cl.name : client, clientId: cl ? cl.id : null, date: agentDate(inp.date), validDays, lines: cleanQuoteLines(lines),
    discount: Math.max(0, Number(inp.discount)||0), taxPct, notes: String(inp.notes||'').trim().slice(0, 300) } };
}
function quoteDescribeForAgent(inp){
  const r = quoteFromAgentInput(inp);
  const es = uiLang==='es';
  if(r.error){ return `${es?'Cotización':'Quote'}: ${inp && inp.client ? inp.client : '?'} · ${es?'faltan datos':'missing data'}`; }
  const d = r.draft; const tt = quoteTotals(d);
  const ls = d.lines.map(l=>`${quoteFmtQty(l.qty)} × ${l.desc} ${money(l.price)}`).join(' · ');
  return `${es?'Cotización para':'Quote for'} ${d.client}: ${ls}${tt.discount>0 ? ` · ${es?'desc.':'disc.'} ${money(tt.discount)}` : ''}${tt.tax>0 ? ` · ${es?'imp.':'tax'} ${d.taxPct}%` : ''} · ${es?'total':'total'} ${money(tt.total)} · ${es?'válida':'valid'} ${d.validDays} ${es?'días':'days'}`;
}
// Crea la cotización desde el asistente. Devuelve el objeto de resultado (JSON en app-16).
function quoteCreateFromAgent(inp){
  const r = quoteFromAgentInput(inp);
  if(r.error) return Object.assign({ok:false, error: r.error}, r.missing ? {missing: r.missing} : {});
  draftQuote = r.draft;
  const q = saveQuoteFromDraft({byAgent: true});
  draftQuote = null;
  if(!q) return {ok:false, error: 'client and priced lines required'};
  const tt = quoteTotals(q);
  const cl = q.clientId ? clientById(q.clientId) : null;
  render();
  return {ok:true, quote_id: q.id, number: quoteNum(q), client: q.client, total: tt.total, valid_until: quoteValidUntil(q),
    client_phone: cl && clientPhoneDigits(cl) ? cl.phone : null, client_email: cl && clientEmailOk(cl) ? cl.email : null};
}
function agentPickQuote(inp){
  if(inp && inp.quote_id){ const q = quoteById(inp.quote_id); if(q) return q; }
  let list = svcQuotes().slice();
  if(inp && inp.client){ const c = agentNorm(inp.client); const byC = list.filter(q=>agentNorm(q.client).includes(c) || c.includes(agentNorm(q.client))); if(byC.length) list = byC; }
  if(inp && inp.number){ const n = String(inp.number).replace(/^#/, '').toUpperCase(); const byN = list.filter(q=>quoteNum(q)===n); if(byN.length) list = byN; }
  // Abiertas primero, la más nueva primero.
  list.sort((a,b)=> (quoteIsOpen(b)?1:0)-(quoteIsOpen(a)?1:0) || String(b.date).localeCompare(String(a.date)));
  return list[0] || null;
}
function quoteAgentAction(inp){
  const q = agentPickQuote(inp); if(!q) return {ok:false, error:'quote not found'};
  const action = String((inp && inp.action)||'');
  const cl = q.clientId ? clientById(q.clientId) : clientByName(q.client);
  switch(action){
    case 'send_whatsapp': { showAgentSheet = false; render(); quoteWhatsapp(q); return {ok:true, quote_id:q.id, sent_to: clientPhoneDigits(cl) ? cl.phone : 'contact picker'}; }
    case 'send_pdf': { showAgentSheet = false; render(); downloadQuotePdf(q); return {ok:true, quote_id:q.id}; }
    case 'send_email': {
      if(!clientEmailOk(cl)) return {ok:false, error:'client has no email; ask for it or use add_client'};
      sendQuoteEmail(q); return {ok:true, quote_id:q.id, sending_to: cl.email};
    }
    case 'accept': { const job = acceptQuote(q, {byAgent:true, date: inp.date ? agentDate(inp.date) : null}); render();
      return {ok:true, quote_id:q.id, job_id: job ? job.id : null, amount: quoteTotals(q).total, due_date: job ? job.dueDate : null,
        stock_out: (job && job.items||[]).filter(it=>it.qty>0).map(it=>({item: it.ingName, qty: it.qty, unit: it.unit, short: it.short||0}))}; }
    // Aceptada y con su trabajo vivo: el modal no ofrece rechazar ni eliminar, y el
    // asistente tampoco puede — dejaba el trabajo cobrable y la mercadería
    // descontada sin cotización detrás. Primero se elimina el trabajo (devuelve el
    // stock y reabre la cotización), después se decide.
    case 'reject': { if(q.status==='accepted' && jobById(q.jobId)) return {ok:false, error:'quote already accepted and its job exists; delete the job first (delete_job job_id='+q.jobId+'), that returns the stock and reopens the quote'}; rejectQuote(q); render(); return {ok:true, quote_id:q.id}; }
    case 'delete': { if(q.status==='accepted' && jobById(q.jobId)) return {ok:false, error:'quote already accepted and its job exists; delete the job first (delete_job job_id='+q.jobId+')'}; deleteQuote(q); render(); return {ok:true, quote_id:q.id}; }
    default: return {ok:false, error:'unknown action'};
  }
}
function quotesForAgentQuery(text){
  const qn = agentNorm(text||'');
  const list = svcQuotes().filter(q=>!qn || agentNorm(q.client).includes(qn)).sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0, 25);
  return { open: svcQuotes().filter(quoteIsOpen).length, quotes: list.map(q=>({quote_id:q.id, number:quoteNum(q), client:q.client, date:q.date, status:quoteState(q), valid_until:quoteValidUntil(q), total:quoteTotals(q).total,
    lines: (q.lines||[]).map(l=>({desc:l.desc, qty:l.qty, price:l.price})), job_id: q.jobId||null})) };
}
function clientsForAgentQuery(text){
  const qn = agentNorm(text||'');
  return { clients: svcClients().filter(c=>!qn || agentNorm(c.name).includes(qn)).slice(0, 40).map(c=>({client_id:c.id, name:c.name, phone:c.phone||null, email:c.email||null, notes:c.notes||null})) };
}
function clientFromAgent(inp, mustExist){
  const name = String((inp && inp.name)||'').trim(); if(!name) return {ok:false, error:'name required'};
  const existing = clientByName(name);
  // update_client sobre un cliente que no está guardado: se avisa, no se crea uno
  // nuevo en silencio (el asistente decía "actualizado" y aparecía un registro vacío).
  if(mustExist && !existing) return {ok:false, error:'client not found — use add_client to save it first'};
  const email = inp.email!==undefined && inp.email!==null ? String(inp.email).trim() : undefined;
  if(email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return {ok:false, error:'invalid email'};
  const c = upsertClient({ id: existing ? existing.id : null, name: inp.new_name ? String(inp.new_name).trim() : name, phone: inp.phone!==undefined && inp.phone!==null ? String(inp.phone) : undefined, email, notes: inp.notes!==undefined && inp.notes!==null ? String(inp.notes) : undefined });
  saveState(); render();
  return {ok:true, client_id: c.id, name: c.name, phone: c.phone||null, email: c.email||null, existed: !!existing};
}
// Líneas de contexto para el asistente (agentContext, app-16).
function quotesAgentContext(){
  const out = [];
  const cls = svcClients();
  if(cls.length) out.push(`Clientes guardados (con 📞/✉️ si tienen teléfono/correo): ${cls.slice(0, 50).map(c=>c.name+(clientPhoneDigits(c)?' 📞':'')+(clientEmailOk(c)?' ✉️':'')).join(', ')}`);
  const open = svcQuotes().filter(quoteIsOpen);
  out.push(`Cotizaciones abiertas: ${open.length}${open.length ? ' — '+open.slice(0, 8).map(q=>`#${quoteNum(q)} ${q.client} ${money(quoteTotals(q).total)} (${quoteState(q)})`).join('; ') : ''}. Impuesto por defecto ${bizProfile.taxPct||0}%, validez ${bizProfile.quoteValidDays||15} días.`);
  if(sellsProducts()){
    const priced = inventory.filter(i=>i && !isExpenseItem(i) && (i.salePrice||0)>0).slice(0, 60);
    if(priced.length) out.push(`Productos con precio de venta: ${priced.map(i=>`${i.name} ${money(i.salePrice)}`).join('; ')}`);
  }
  return out;
}
