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
/* Historial de salidas: producciones y ajustes de estante. Viaja dentro del doc
   meta (como calNotes) — por eso se CAPA a las últimas OUTFLOWS_MAX entradas: el
   registro financiero de verdad son las compras/recibos, esto es el "qué salió y
   cuándo" informativo. Más nuevo primero. */
let outflows = []; // {id, type:'production'|'adjust', recipeId, recipeName, count, items:[{ingId, ingName, qty, unit}], date, createdAt, by, byLabel}
const OUTFLOWS_MAX = 400;

let showRecipeModal = false, draftRecipe = null, editingRecipeId = null;
let recipeScanState = 'idle', recipeScanError = '', recipeScanNote = '', recipeScanRequestId = 0;
let showProduceModal = false, produceRecipeId = null, produceCount = 1;
let showOutflowsModal = false;
/* Escáner de estante: mismos estados/patrones que el escáner de productos (pb*),
   con su propia cámara — ver el guard de render() en app-04, que también protege
   este <video> de ser arrancado por un redibujado de fondo. */
let showShelfModal = false, shelfState = 'camera', shelfItems = [], shelfUnmatched = [], shelfError = '', shelfRequestId = 0;
let shelfCamStream = null;

function recipeById(id){ return recipes.find(r => r.id === id); }
function recipePhotoSrc(r){
  if(!r || !r.photo) return null;
  if(r.photo.base64) return `data:${r.photo.mediaType || 'image/jpeg'};base64,${r.photo.base64}`;
  return r.photo.url || null;
}
function recordOutflow(entry){
  outflows.unshift(entry);
  if(outflows.length > OUTFLOWS_MAX) outflows.length = OUTFLOWS_MAX;
}

/* ---------- LLAMADA AL MODO STOCK (leer cantidades de una foto) ---------- */
// Hermana de identifyProductsFromPhoto (app-06) pero con stock:true — devuelve
// lecturas de cantidad ({name, matched_inventory_name, reading, count,
// fill_percent, ...}) en vez de datos de alta. Mismo cupo, mismos errores. Si el
// trial agota el cupo, tira un Error con .trialQuota=true y cada llamador decide
// qué modal cerrar antes de ofrecer guardar la cuenta.
async function readStockFromPhoto(image){
  if(!currentUser){
    try{ await ensureTrialAccount(); }
    catch(e){ throw new Error(t(e && e.code==='trial/real-account-exists' ? 'err_scan_auth_required' : 'err_scan_no_connection')); }
  }
  let idToken;
  try{ idToken = await currentUser.getIdToken(); }
  catch(tokenErr){ throw new Error(t('err_scan_auth_required')); }
  let response;
  try{
    response = await fetch('/.netlify/functions/identify-product', {
      method: 'POST',
      headers: {'Content-Type':'application/json', 'Authorization':'Bearer '+idToken},
      body: JSON.stringify({
        image,
        stock: true,
        ownerUid: syncUid(),
        inventoryNames: inventory.map(i => i.name)
      })
    });
  }catch(netErr){
    throw new Error(t('err_scan_no_connection'));
  }
  let parsed;
  try{ parsed = await response.json(); }
  catch(parseErr){ throw new Error(t('err_function_not_found_product')); }
  if(response.status===429 && parsed.quotaExceeded){
    if(currentUser && currentUser.isAnonymous){
      const err = new Error(t('trial_scans_over_note'));
      err.trialQuota = true;
      throw err;
    }
    throw new Error(t('err_scan_quota_exceeded'));
  }
  if(!response.ok || parsed.error){
    throw new Error(parsed.error || t('product_scan_error'));
  }
  return Array.isArray(parsed.products) ? parsed.products : [];
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

/* ---------- VISTA: sección en Inventario ---------- */
/* El banner del escáner de estante ocupa el espacio que se liberó al mover el
   header de marca al Dashboard — es LA acción nueva de esta pestaña: "esta
   pantalla ES tu stock, desde acá lo mantenés al día". */
function shelfScanBanner(){
  if(inventory.length === 0) return '';
  return `
  <button type="button" class="shelf-scan-banner" id="btn-shelf-scan">
    <span class="ssb-icon">${lineIcon('camera',20)}</span>
    <span class="ssb-text">
      <strong>${t('shelf_banner_title')}</strong>
      <small>${t('shelf_banner_sub')}</small>
    </span>
    <span class="ssb-chevron">›</span>
  </button>`;
}

function productionSection(){
  if(inventory.length === 0) return '';
  return `
  <div class="stock-card" style="margin-bottom:18px;">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
      <h3 class="stock-card-title" style="margin:0;">${t('prod_section_title')}</h3>
      <span style="display:flex;gap:8px;align-items:center;">
        ${outflows.length>0 ? `<button type="button" class="link-btn" id="btn-open-outflows" style="padding:6px 4px;">${t('prod_outflows_link')}</button>` : ''}
        <button type="button" class="btn btn-ghost btn-sm" id="btn-new-recipe">${t('prod_new_recipe')}</button>
      </span>
    </div>
    ${recipes.length===0 ? `
    <div class="helper-note" style="margin:10px 0 2px;">${t('prod_no_recipes')}</div>
    ` : recipes.map(r=>{
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
  </div>`;
}

/* ---------- MODAL: RECETA (crear/editar) ---------- */
function openRecipeModal(recipe){
  draftRecipe = recipe
    ? {id:recipe.id, name:recipe.name, photo:recipe.photo||null, components:(recipe.components||[]).map(c=>({...c}))}
    : {id:uid('rc'), name:'', photo:null, components:[]};
  editingRecipeId = recipe ? recipe.id : null;
  recipeScanState='idle'; recipeScanError=''; recipeScanNote=''; recipeScanRequestId++;
  showRecipeModal = true; render();
}
function closeRecipeModal(){ recipeScanRequestId++; showRecipeModal=false; draftRecipe=null; editingRecipeId=null; render(); }

// Opciones del selector de insumo, ordenadas por nombre para encontrarlas rápido.
function recipeIngOptions(selectedId){
  const sorted = [...inventory].sort((a,b)=>a.name.localeCompare(b.name));
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
          <input type="file" id="recipe-scan-file" accept="image/*" capture="environment" style="display:none;">
        </div>
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
            <input data-rcomp-qty="${idx}" type="number" step="0.01" min="0" value="${escapeHtml(c.qty??'')}" placeholder="${t('recipe_qty_ph')}" style="flex:1;min-width:64px;">
            <span class="recipe-comp-unit">${ing ? escapeHtml(unitLabel(ing.unit)) : ''}</span>
            <button type="button" class="stock-row-x-btn" data-rcomp-remove="${idx}" title="${t('btn_delete')}">✕</button>
          </div>`;
        }).join('')}
        <button type="button" class="btn btn-ghost btn-sm" id="btn-add-component" style="margin-top:6px;">${t('recipe_add_component')}</button>
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:14px;padding-top:12px;border-top:1px solid var(--line);">
          <span style="font-size:13px;font-weight:700;color:var(--ink);">${t('recipe_cost_line')}</span>
          <span id="recipe-cost-display" style="font-family:'IBM Plex Mono';font-weight:700;font-size:16px;color:var(--basil);">${money(cost.total)}</span>
        </div>
        ${cost.missing>0 ? `<div class="helper-note" style="margin:8px 0 0;color:var(--saffron-ink);">⚠ ${t('recipe_cost_missing').replace('{n}', cost.missing)}</div>` : ''}
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
    products.forEach(p=>{
      const ing = matchStockReading(p);
      if(!ing){ unmatched.push(p.name); return; }
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
  if(!name){ alert(t('recipe_need_name')); return; }
  const components = draftRecipe.components
    .map(c=>({ingId:c.ingId, qty: roundQty(parseFloat(c.qty)||0)}))
    .filter(c=>c.ingId && c.qty>0);
  if(components.length===0){ alert(t('recipe_need_components')); return; }
  const rec = {id: draftRecipe.id, name, photo: draftRecipe.photo||null, components,
    createdAt: (editingRecipeId && recipeById(editingRecipeId)?.createdAt) || new Date().toISOString()};
  if(currentUser){ rec.lastEditedBy = currentUserLabel(); rec.lastEditedAt = new Date().toISOString(); }
  const idx = editingRecipeId ? recipes.findIndex(r=>r.id===editingRecipeId) : -1;
  if(idx!==-1) recipes[idx]=rec; else recipes.push(rec);
  saveState();
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
  saveState();
  logActivity('recipe_deleted', rec.name);
  closeRecipeModal();
}

/* ---------- MODAL: REGISTRAR PRODUCCIÓN ---------- */
function openProduceModal(recipeId){
  produceRecipeId = recipeId; produceCount = 1;
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
        <strong style="flex:1;font-size:15px;">${escapeHtml(rec.name)}</strong>
      </div>

      <div class="field" style="margin-bottom:16px;">
        <label>${t('produce_count_label')}</label>
        <div class="qty-stepper">
          <button type="button" id="btn-produce-minus" ${produceCount<=1?'disabled':''}>−</button>
          <input id="produce-count-input" type="number" min="1" step="1" value="${escapeHtml(produceCount)}">
          <button type="button" id="btn-produce-plus">+</button>
        </div>
      </div>

      <label style="display:block;font-size:12px;font-weight:600;color:var(--ink-soft);margin:0 0 8px;">${t('produce_deduct_header')}</label>
      ${plan.map(p=>{
        if(p.missing) return `<div class="matched-item" style="cursor:default;opacity:.7;"><div class="mi-top"><strong style="flex:1;">?</strong></div><div style="font-size:11px;font-weight:700;color:var(--tomato-ink);">⚠ ${t('produce_missing_note')}</div></div>`;
        return `
        <div class="matched-item" style="cursor:default;">
          <div class="mi-top">
            <strong style="flex:1;">${escapeHtml(p.name)}</strong>
            <span style="font-family:'IBM Plex Mono';font-size:12.5px;color:var(--ink-soft);white-space:nowrap;">${escapeHtml(p.current)} → <strong style="color:var(--ink);">${escapeHtml(p.after)}</strong> ${escapeHtml(unitLabel(p.unit))}</span>
          </div>
          <div style="font-size:12px;color:var(--ink-soft);">−${escapeHtml(p.deduct)} ${escapeHtml(unitLabel(p.unit))}</div>
          ${p.short>0 ? `<div style="font-size:11px;font-weight:700;color:var(--saffron-ink);background:var(--saffron-soft);padding:5px 8px;border-radius:6px;margin-top:6px;">⚠ ${t('produce_short_note').replace('{n}', p.short).replace('{u}', unitLabel(p.unit))}</div>` : ''}
        </div>`;
      }).join('')}

      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:10px;">
        <span style="font-size:13px;font-weight:700;color:var(--ink);">${t('produce_batch_cost')}</span>
        <span style="font-family:'IBM Plex Mono';font-weight:700;font-size:16px;color:var(--basil);">${money(batchCost)}</span>
      </div>

      <div class="modal-actions">
        <button class="btn btn-ghost" id="btn-cancel-produce">${t('btn_cancel')}</button>
        <button class="btn btn-primary" id="btn-confirm-produce" ${plan.length===0?'disabled':''}>${t('produce_confirm_btn')}</button>
      </div>
    </div>
  </div>`;
}

function applyProduction(){
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
    items.push({ingId: p.ingId, ingName: p.name, qty: roundQty(p.deduct - p.short), unit: p.unit});
  });
  recordOutflow({
    id: uid('o'), type:'production', recipeId: rec.id, recipeName: rec.name, count,
    items, date: localDateStr(), createdAt: new Date().toISOString(),
    by: currentUser ? currentUser.uid : null, byLabel: currentUser ? currentUserLabel() : ''
  });
  saveState();
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
      outflows.map(o=>`
        <div class="matched-item" style="cursor:default;">
          <div class="mi-top">
            <span class="mi-icon" style="background:${o.type==='production'?'var(--basil)':'var(--sky)'};">${lineIcon(o.type==='production'?'tag':'camera',12)}</span>
            <strong style="flex:1;">${o.type==='production'
              ? `${t('outflow_production')} — ${escapeHtml(o.count)} × "${escapeHtml(o.recipeName)}"`
              : t('outflow_adjust')}</strong>
            <span style="font-size:11px;color:var(--ink-soft);white-space:nowrap;">${timeAgo(o.createdAt)}</span>
          </div>
          <div style="font-size:12px;color:var(--ink-soft);display:flex;flex-wrap:wrap;gap:4px 12px;">
            ${(o.items||[]).map(it=>`<span style="white-space:nowrap;">${it.qty>=0?'−':'+'}${escapeHtml(Math.abs(it.qty))} ${escapeHtml(unitLabel(it.unit))} ${escapeHtml(it.ingName)}</span>`).join('')}
          </div>
          ${o.byLabel ? `<div style="font-size:11px;color:var(--ink-soft);margin-top:4px;">${escapeHtml(o.byLabel)}</div>` : ''}
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
  shelfState='camera'; shelfItems=[]; shelfUnmatched=[]; shelfError='';
  showShelfModal = true; render();
  startShelfCamera();
}
function closeShelfModal(){ shelfRequestId++; stopShelfCamera(); showShelfModal=false; render(); }
function restartShelfCamera(){
  shelfRequestId++;
  shelfState='camera'; shelfItems=[]; shelfUnmatched=[]; shelfError='';
  render();
  startShelfCamera();
}
function stopShelfCamera(){
  if(!shelfCamStream) return;
  const s = shelfCamStream;
  shelfCamStream = null;
  try{ s.getTracks().forEach(tr=>tr.stop()); }catch(e){}
}
function startShelfCamera(){
  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return; // queda el respaldo del input capture
  const requestId = shelfRequestId;
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(stream=>{
    const video = document.getElementById('shelf-video');
    if(requestId !== shelfRequestId || !showShelfModal || !video){
      try{ stream.getTracks().forEach(tr=>tr.stop()); }catch(e){}
      return;
    }
    shelfCamStream = stream;
    video.srcObject = stream;
    video.play().catch(()=>{});
  }).catch(()=>{
    render(); // sin permiso/cámara: el input capture nativo sigue disponible
  });
}
function captureShelfFrame(){
  const video = document.getElementById('shelf-video');
  if(!video || !shelfCamStream || !video.videoWidth) return null;
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth; canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  return canvas;
}

async function processShelfSource(source){
  const requestId = ++shelfRequestId;
  stopShelfCamera();
  shelfState='loading'; shelfError=''; render();
  try{
    const image = resizeToBase64(source, 1400, 0.9);
    const products = await readStockFromPhoto(image);
    if(requestId !== shelfRequestId || !showShelfModal) return;
    shelfItems = [];
    shelfUnmatched = [];
    products.forEach(p=>{
      const ing = matchStockReading(p);
      if(!ing){ shelfUnmatched.push(p); return; }
      const detected = detectedQtyFromReading(p, ing.capacityFull);
      // fill_percent sin capacidad declarada: la fila queda esperando ese dato —
      // se pide inline y el % se convierte solo, sin obligar a abrir el producto.
      const needsCapacity = detected===null && p.fill_percent!==null && !(Number(ing.capacityFull)>0);
      shelfItems.push({
        ingId: ing.id,
        reading: p.reading, count: p.count, fill_percent: p.fill_percent,
        sticker_color: p.sticker_color, confidence: p.confidence, visible_note: p.visible_note,
        detected, finalQty: detected!==null ? detected : '',
        needsCapacity, capacityDraft: '',
        include: detected!==null
      });
    });
    shelfState = (shelfItems.length>0 || shelfUnmatched.length>0) ? 'review' : 'empty';
    render();
  }catch(err){
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
  return `<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;background:${c.bg};color:${c.fg};white-space:nowrap;">${t('shelf_conf_'+(map[conf]?conf:'baja'))}</span>`;
}

function shelfDeltaPill(current, finalQty, unit){
  const delta = roundQty((Number(finalQty)||0) - (Number(current)||0));
  if(delta===0) return `<span style="font-size:11px;color:var(--ink-soft);">=</span>`;
  const up = delta>0;
  return `<span style="font-size:11px;font-weight:700;color:${up?'var(--basil-ink)':'var(--ink-soft)'};white-space:nowrap;">${up?'+':'−'}${Math.abs(delta)} ${escapeHtml(unitLabel(unit))}</span>`;
}

function shelfScanModal(){
  const includedCount = shelfItems.filter(it=>it.include && it.finalQty!=='' && Number.isFinite(Number(it.finalQty))).length;
  return `
  <div class="overlay" id="shelf-overlay">
    <div class="modal wide">
      <h3 class="sky">${t('shelf_title')}</h3>

      ${shelfState==='camera' ? `
        <div class="sub">${t('shelf_sub')}</div>
        <div style="position:relative;border-radius:12px;overflow:hidden;background:#111;min-height:220px;display:flex;align-items:center;justify-content:center;">
          <video id="shelf-video" autoplay playsinline muted style="width:100%;max-height:340px;object-fit:cover;display:block;"></video>
          <button id="btn-shelf-capture" title="${t('ids_capture')}" style="position:absolute;bottom:14px;left:50%;transform:translateX(-50%);width:58px;height:58px;border-radius:50%;border:4px solid #fff;background:rgba(255,255,255,.25);cursor:pointer;"></button>
        </div>
        <div class="helper-note" style="margin:10px 0 0;">💡 ${t('shelf_tip')}</div>
        <div style="display:flex;justify-content:center;gap:14px;margin:6px 0 0;">
          <button type="button" id="btn-shelf-native" style="background:none;border:none;color:var(--sky-ink);font-size:12.5px;font-weight:600;cursor:pointer;padding:6px 8px;">${t('ids_use_native_camera')}</button>
          <button type="button" id="btn-shelf-gallery" style="background:none;border:none;color:var(--sky-ink);font-size:12.5px;font-weight:600;cursor:pointer;padding:6px 8px;">${t('scan_upload_gallery_btn')}</button>
        </div>
      ` : ''}
      <input type="file" id="shelf-photo-file" accept="image/*" capture="environment" style="display:none;">
      <input type="file" id="shelf-photo-file-gallery" accept="image/*" style="display:none;">

      ${shelfState==='loading' ? `<div class="scan-status"><div class="spinner"></div> ${t('shelf_loading')}</div>` : ''}
      ${shelfState==='error' ? `<div class="scan-error">⚠ ${escapeHtml(shelfError)}</div>` : ''}
      ${shelfState==='empty' ? `<div class="scan-error">⚠ ${t('shelf_none')}</div>` : ''}

      ${shelfState==='review' ? `
        ${shelfItems.length>0 ? `<div style="font-size:12.5px;color:var(--ink-soft);margin-bottom:10px;">${t('shelf_review_hint')}</div>` : ''}
        ${shelfItems.map((it,idx)=>{
          const ing = inventory.find(i=>i.id===it.ingId);
          if(!ing) return '';
          const metaBits = [];
          metaBits.push(`${t('shelf_current')}: <strong style="color:var(--ink);">${escapeHtml(ing.qtyOnHand||0)} ${escapeHtml(unitLabel(ing.unit))}</strong>`);
          if(it.detected!==null) metaBits.push(`${t('shelf_detected')}: <strong style="color:var(--ink);">${escapeHtml(it.detected)} ${escapeHtml(unitLabel(ing.unit))}</strong>`);
          if(it.fill_percent!==null && it.reading!=='unidades') metaBits.push(t('shelf_fill_note').replace('{p}', it.fill_percent));
          if(it.sticker_color) metaBits.push(t('shelf_sticker_note').replace('{c}', escapeHtml(it.sticker_color)));
          return `
          <div class="matched-item" style="${it.include?'':'opacity:.55;'}">
            <div class="mi-top">
              <input data-shelf-include="${idx}" type="checkbox" ${it.include?'checked':''} style="width:18px;height:18px;flex-shrink:0;accent-color:var(--navy);">
              <div class="stock-icon-ring" style="width:34px;height:34px;flex-shrink:0;">${stockIconSvg(ing)}</div>
              <strong style="flex:1;min-width:0;overflow-wrap:anywhere;">${escapeHtml(ing.name)}</strong>
              ${shelfConfidencePill(it.confidence)}
            </div>
            <div style="font-size:12px;color:var(--ink-soft);display:flex;flex-wrap:wrap;gap:4px 12px;margin-bottom:8px;">
              ${metaBits.map(b=>`<span>${b}</span>`).join('')}
            </div>
            ${it.visible_note ? `<div style="font-size:11px;font-weight:600;color:var(--saffron-ink);background:var(--saffron-soft);padding:5px 8px;border-radius:6px;margin-bottom:8px;">ℹ ${escapeHtml(it.visible_note)}</div>` : ''}
            ${it.needsCapacity ? `
            <div style="background:var(--sky-soft);border-radius:8px;padding:8px 10px;margin-bottom:8px;">
              <div style="font-size:11.5px;font-weight:700;color:var(--sky-ink);margin-bottom:6px;">${t('shelf_capacity_ask')}</div>
              <div style="display:flex;align-items:center;gap:8px;">
                <input data-shelf-capacity="${idx}" type="number" step="0.01" min="0" value="${escapeHtml(it.capacityDraft)}" placeholder="Ej. 500" style="flex:1;">
                <span style="font-size:12px;color:var(--sky-ink);font-weight:700;">${escapeHtml(unitLabel(ing.unit))}</span>
              </div>
              <div style="font-size:10.5px;color:var(--sky-ink);margin-top:5px;">${t('shelf_capacity_helper').replace('{u}', unitLabel(ing.unit))}</div>
            </div>` : ''}
            <div class="mi-fields" style="align-items:center;">
              <label style="font-size:11px;font-weight:700;color:var(--ink-soft);white-space:nowrap;">${t('shelf_final_label')}</label>
              <input data-shelf-final="${idx}" type="number" step="0.01" min="0" value="${escapeHtml(it.finalQty)}" style="flex:1;min-width:70px;">
              <span style="font-size:12px;color:var(--ink-soft);">${escapeHtml(unitLabel(ing.unit))}</span>
              <span data-shelf-delta="${idx}">${shelfDeltaPill(ing.qtyOnHand||0, it.finalQty, ing.unit)}</span>
            </div>
          </div>`;
        }).join('')}
        ${shelfUnmatched.length>0 ? `
        <div class="helper-note" style="margin-top:12px;background:var(--inset);border-radius:8px;padding:10px 12px;">
          <strong style="display:block;font-size:12px;color:var(--ink);margin-bottom:4px;">${t('shelf_unmatched_title')}</strong>
          ${shelfUnmatched.map(p=>escapeHtml(p.name)).join(' · ')}
          <div style="margin-top:5px;font-size:11px;">${t('shelf_unmatched_hint')}</div>
        </div>` : ''}
      ` : ''}

      <div class="modal-actions">
        <button class="btn btn-ghost" id="btn-cancel-shelf">${t(shelfState==='review'?'btn_close':'btn_cancel')}</button>
        ${['review','error','empty'].includes(shelfState) ? `<button class="btn btn-ghost" id="btn-shelf-again">${t('ids_scan_again')}</button>` : ''}
        ${shelfState==='review' && shelfItems.length>0 ? `<button class="btn btn-primary" id="btn-apply-shelf" ${includedCount===0?'disabled':''}>${t('shelf_apply_btn').replace('{n}', includedCount)}</button>` : ''}
      </div>
    </div>
  </div>`;
}

function applyShelfAdjust(){
  const items = [];
  let touched = 0;
  shelfItems.forEach(it=>{
    const ing = inventory.find(i=>i.id===it.ingId);
    if(!ing) return;
    // La capacidad declarada inline se guarda aunque la fila no se incluya en el
    // ajuste — es un dato del producto, no de esta foto, y costó pedirlo.
    const cap = parseFloat(it.capacityDraft);
    if(Number.isFinite(cap) && cap>0) ing.capacityFull = roundQty(cap);
    if(!it.include) return;
    const finalQty = parseFloat(it.finalQty);
    if(!Number.isFinite(finalQty) || finalQty<0) return;
    const current = roundQty(Number(ing.qtyOnHand)||0);
    const newQty = roundQty(finalQty);
    touched++;
    if(newQty===current) return; // capacidad guardada arriba, pero sin movimiento que registrar
    ing.qtyOnHand = newQty;
    if(currentUser){ ing.lastEditedBy = currentUserLabel(); ing.lastEditedAt = new Date().toISOString(); }
    // qty positiva = salió stock; negativa = apareció más de lo registrado.
    items.push({ingId: ing.id, ingName: ing.name, qty: roundQty(current - newQty), unit: ing.unit});
  });
  if(items.length>0){
    recordOutflow({
      id: uid('o'), type:'adjust', recipeId:null, recipeName:'', count:null,
      items, date: localDateStr(), createdAt: new Date().toISOString(),
      by: currentUser ? currentUser.uid : null, byLabel: currentUser ? currentUserLabel() : ''
    });
    logActivity('stock_adjust', '', String(items.length));
  }
  if(touched>0 || items.length>0) saveState();
  closeShelfModal();
}

/* ---------- EVENTOS ---------- */
// Llamada desde attachEvents() (app-07) en cada render — mismos patrones: handlers
// como propiedades on* (morphdom puede conservar nodos entre renders; asignar pisa
// en vez de apilar), y campos de texto que escriben en el estado sin re-render.
function attachProductionEvents(){
  const btnShelfScan=document.getElementById('btn-shelf-scan');
  if(btnShelfScan) btnShelfScan.onclick=openShelfModal;
  const btnNewRecipe=document.getElementById('btn-new-recipe');
  if(btnNewRecipe) btnNewRecipe.onclick=()=>openRecipeModal(null);
  const btnOpenOutflows=document.getElementById('btn-open-outflows');
  if(btnOpenOutflows) btnOpenOutflows.onclick=()=>{ showOutflowsModal=true; render(); };
  document.querySelectorAll('[data-edit-recipe]').forEach(b=>{
    b.onclick=()=>openRecipeModal(recipeById(b.dataset.editRecipe));
  });
  document.querySelectorAll('[data-produce-recipe]').forEach(b=>{
    b.onclick=()=>openProduceModal(b.dataset.produceRecipe);
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
      }catch(err){ alert(err.message || t('err_img_process')); }
    };
    const scanFile=document.getElementById('recipe-scan-file');
    const btnScan=document.getElementById('btn-recipe-scan');
    if(btnScan && scanFile) btnScan.onclick=()=>{
      if(!currentUser){
        if(everHadRealAccount()){ ensurePatronFirebaseReady().catch(()=>{}); openAuthModal(t('scan_requires_account')); return; }
        ensureTrialAccount().catch(()=>{});
      }
      scanFile.click();
    };
    if(scanFile) scanFile.onchange=(e)=>{
      const file=e.target.files[0];
      scanFile.value='';
      if(!file || !/^image\//.test(file.type)) return;
      runRecipeScan(file);
    };
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
    const btnCapture=document.getElementById('btn-shelf-capture');
    if(btnCapture) btnCapture.onclick=()=>{
      const frame=captureShelfFrame();
      if(frame) processShelfSource(frame);
      else shelfFile?.click(); // sin cámara en vivo: respaldo de la cámara nativa
    };
    const btnNative=document.getElementById('btn-shelf-native');
    if(btnNative && shelfFile) btnNative.onclick=()=>shelfFile.click();
    const btnGallery=document.getElementById('btn-shelf-gallery');
    if(btnGallery && shelfGallery) btnGallery.onclick=()=>shelfGallery.click();
    const onShelfFile=async (e)=>{
      const file=e.target.files[0];
      e.target.value='';
      if(!file || !/^image\//.test(file.type)) return;
      try{
        const img = await loadImageFromFile(file);
        processShelfSource(img);
      }catch(err){
        stopShelfCamera();
        shelfState='error'; shelfError=err.message||t('product_scan_error'); render();
      }
    };
    if(shelfFile) shelfFile.onchange=onShelfFile;
    if(shelfGallery) shelfGallery.onchange=onShelfFile;
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
    document.querySelectorAll('[data-shelf-capacity]').forEach(inp=>{
      inp.oninput=()=>{
        const idx=+inp.dataset.shelfCapacity;
        const it=shelfItems[idx];
        if(!it) return;
        it.capacityDraft=inp.value;
        // Con la capacidad puesta, el % pendiente se convierte en cantidad en vivo.
        const cap=parseFloat(inp.value);
        if(Number.isFinite(cap) && cap>0 && it.fill_percent!==null){
          it.finalQty = roundQty(cap * Math.min(it.fill_percent,100) / 100);
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
  }
}
