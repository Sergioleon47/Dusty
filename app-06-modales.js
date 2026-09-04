/* ================= MODAL: ELIMINAR CUENTA ================= */
function openDeleteAccountModal(){
  deleteAccountStep='confirm'; deleteAccountPassword=''; deleteAccountError=''; deleteAccountLoading=false;
  showDeleteAccountModal=true; render();
}
function closeDeleteAccountModal(){ showDeleteAccountModal=false; render(); }

// Firebase exige una sesión "reciente" antes de dejar borrar una cuenta
// (reauthenticateWith* falla con auth/requires-recent-login si no) — se rama por
// proveedor real: 'password' cubre tanto una cuenta normal de email/contraseña
// como las cuentas sintéticas de nombre+PIN del modo equipo (teamPinEmail()), que
// también son 'password' por debajo. 'google.com' reusa el mismo patrón
// popup-con-fallback-a-redirect que ya usa signInWithGoogle().
async function performAccountDeletion(){
  if(!currentUser) return;
  deleteAccountLoading = true; deleteAccountError=''; render();
  try{
    const provider = (currentUser.providerData[0] && currentUser.providerData[0].providerId) || 'password';
    if(provider==='google.com'){
      try{
        await currentUser.reauthenticateWithPopup(new firebase.auth.GoogleAuthProvider());
      }catch(err){
        const popupFailed = err && (err.code==='auth/popup-blocked' || err.code==='auth/operation-not-supported-in-this-environment' || err.code==='auth/cancelled-popup-request');
        if(popupFailed){
          // El popup no se pudo abrir — se reintenta con redirect, pero a
          // diferencia del popup, esto recarga la página entera. No hay forma
          // liviana de "retomar el borrado solo" después de volver de un
          // redirect sin sumar bastante más estado — en la práctica alcanza con
          // que, al volver, la sesión ya cuenta como reciente y un segundo toque
          // en "Eliminar cuenta" complete el resto sin pedir reautenticar de nuevo.
          await currentUser.reauthenticateWithRedirect(new firebase.auth.GoogleAuthProvider());
          return;
        }
        throw err;
      }
    } else {
      if(!deleteAccountPassword){ deleteAccountError=t('auth_err_need_both'); deleteAccountLoading=false; render(); return; }
      const cred = firebase.auth.EmailAuthProvider.credential(currentUser.email, deleteAccountPassword);
      await currentUser.reauthenticateWithCredential(cred);
    }

    // getIdToken(true) fuerza un token fresco — el que ya estaba en memoria puede
    // ser de antes de reautenticar, y el servidor (delete-account.js) exige uno
    // válido para saber a qué cuenta borrar.
    const idToken = await currentUser.getIdToken(true);
    const response = await fetch('/.netlify/functions/delete-account', {
      method:'POST',
      headers:{'Content-Type':'application/json', 'Authorization':'Bearer '+idToken},
      body: JSON.stringify({})
    });
    const parsed = await response.json().catch(()=>({}));
    if(!response.ok || parsed.error){ throw new Error(parsed.error || t('auth_err_generic')); }

    // La cuenta ya no existe del lado del servidor — se limpia todo localmente
    // (listeners, estado en memoria, localStorage) y se cierra sesión, en vez de
    // esperar a que onAuthStateChanged se entere solo de una cuenta que ya no está.
    detachFirestoreListeners();
    detachTeamListener();
    stopPresenceHeartbeat();
    try{ await firebase.auth().signOut(); }catch(e){}
    inventory=[]; purchases=[]; receipts=[]; deletedInventoryIds=[]; deletedReceiptIds=[]; deletedPurchaseIds=[]; aliasMap={};
    joinedOwnerUid=null; joinedOwnerEmail=''; lastSyncedUid=null;
    try{
      localStorage.removeItem('patron_had_session');
      // La marca permanente de "este dispositivo tuvo cuenta real" sí se borra al
      // ELIMINAR la cuenta (ya no existe) — es el único lugar donde corresponde.
      localStorage.removeItem('patron_ever_real_account');
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    }catch(e){}
    showDeleteAccountModal=false; deleteAccountLoading=false;
    showToast(t('delete_account_success'), 'success');
    render();
  }catch(err){
    deleteAccountLoading=false;
    if(err && err.code==='auth/popup-closed-by-user'){ render(); return; } // cerró el popup, no es un error real
    if(err && (err.code==='auth/wrong-password' || err.code==='auth/invalid-credential')) deleteAccountError=t('auth_err_wrong_password');
    else { console.error('[Dusty] account deletion failed:', err); deleteAccountError = (err && err.message) || t('auth_err_generic'); }
    render();
  }
}

function deleteAccountModal(){
  const isOwner = teamMembers.length>0 && !joinedOwnerUid;
  const isGoogle = !!(currentUser && currentUser.providerData[0] && currentUser.providerData[0].providerId==='google.com');
  return `
  <div class="overlay" id="delete-account-overlay">
    <div class="modal">
      <h3 class="tomato">${t('delete_account_title')}</h3>
      ${deleteAccountStep==='confirm' ? `
        <div class="sub">${t('delete_account_warning')}</div>
        ${isOwner ? `<div class="scan-error" style="margin-top:-6px;">⚠ ${t('delete_account_warning_team').replace('{n}', teamMembers.length)}</div>` : ''}
        <div class="modal-actions">
          <button class="btn btn-ghost" id="btn-cancel-delete-account">${t('btn_cancel')}</button>
          <button class="btn btn-primary" id="btn-continue-delete-account" style="background:var(--tomato);color:var(--on-accent);">${t('delete_account_continue_btn')}</button>
        </div>
      ` : `
        <div class="sub">${t('delete_account_reauth_sub')}</div>
        ${deleteAccountError ? `<div class="scan-error" style="margin-bottom:12px;">${escapeHtml(deleteAccountError)}</div>` : ''}
        ${isGoogle ? '' : `
        <div class="field"><label>${t('auth_password')}</label><input id="delete-account-password" type="password" value="${escapeHtml(deleteAccountPassword)}" placeholder="••••••••" autocomplete="current-password"></div>
        `}
        <div class="modal-actions">
          <button class="btn btn-ghost" id="btn-cancel-delete-account" ${deleteAccountLoading?'disabled':''}>${t('btn_cancel')}</button>
          <button class="btn btn-primary" id="btn-confirm-delete-account" style="background:var(--tomato);color:var(--on-accent);" ${deleteAccountLoading?'disabled':''}>${deleteAccountLoading ? t('auth_loading') : (isGoogle ? t('delete_account_google_reauth_btn') : t('delete_account_confirm_btn'))}</button>
        </div>
      `}
    </div>
  </div>`;
}

function suggestedOrderModal(){
  const rows = stockRowsData().filter(r=>r.status==='crit');
  return `
  <div class="overlay" id="suggested-order-overlay">
    <div class="modal">
      <h3 class="basil">${t('suggested_order_title')}</h3>
      <div class="sub">${t('suggested_order_sub')}</div>
      ${rows.length===0 ? `<div class="helper-note" style="margin:0 0 8px;">${t('suggested_order_empty')}</div>` : `
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:8px;">
        ${rows.map(r=>{
          const need = Math.max(r.target - (r.ing.qtyOnHand||0), 0);
          return `
          <div class="matched-item" style="cursor:default;">
            <div class="mi-top">
              <strong>${escapeHtml(r.ing.name)}</strong>
              <span>${need} ${escapeHtml(unitLabel(r.ing.unit))}</span>
            </div>
            <div style="font-size:12px;color:var(--ink-soft);">${t('suggested_order_row_note')} ${escapeHtml(r.ing.qtyOnHand||0)} ${escapeHtml(unitLabel(r.ing.unit))} ${t('stock_of')} ${escapeHtml(r.target)} ${escapeHtml(unitLabel(r.ing.unit))}</div>
          </div>`;
        }).join('')}
      </div>`}
      <div class="modal-actions">
        <button class="btn btn-primary" id="btn-close-suggested-order">${t('btn_close')}</button>
      </div>
    </div>
  </div>`;
}

function openCycleCountModal(){
  draftCycleCountPct = cycleCountPct;
  draftCycleCountInterval = cycleCountIntervalDays;
  showCycleCountModal = true; render();
}
function closeCycleCountModal(){ showCycleCountModal=false; render(); }

function cycleCountModal(){
  const due = isCycleCountDue();
  const batch = due ? cycleCountBatch() : [];
  const nextDueDate = cycleCountLastDate ? addDaysStr(cycleCountLastDate, cycleCountIntervalDays) : t('cc_next_now');
  return `
  <div class="overlay" id="cycle-count-overlay">
    <div class="modal">
      <h3 class="navy">${t('cc_title')}</h3>
      <div class="sub">${t('cc_sub')}</div>

      ${due ? `
        <div class="helper-note" style="margin-top:-4px;">${t('cc_due_note').replace('{n}', batch.length)}</div>
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:18px;">
          ${batch.map(i=>`
            <div class="matched-item" style="cursor:default;">
              <div class="mi-top">
                <span class="mi-icon" style="background:var(--basil);">${lineIcon('box',12)}</span>
                <strong style="flex:1;">${escapeHtml(i.name)}</strong>
                <span>${t('cc_current')}: ${escapeHtml(i.qtyOnHand||0)} ${escapeHtml(unitLabel(i.unit))}</span>
              </div>
              <div class="mi-fields">
                <input type="number" step="0.01" placeholder="${t('cc_counted_placeholder')}" data-cc-count="${i.id}" style="flex:1;">
              </div>
            </div>
          `).join('')}
        </div>
      ` : `
        <div class="status-pill-success">
          <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
          ${t('cc_not_due_note')} ${nextDueDate}
        </div>
      `}

      <div class="settings-card">
        ${settingsCardHeader('clock','var(--sky-soft)','var(--sky-ink)',t('cc_settings_title'))}
        <div class="field-row">
          <div class="field"><label>${t('cc_pct_label')}</label><input id="cc-pct-input" type="number" min="1" max="100" step="1" value="${escapeHtml(draftCycleCountPct)}"></div>
          <div class="field"><label>${t('cc_interval_label')}</label><input id="cc-interval-input" type="number" min="1" max="90" step="1" value="${escapeHtml(draftCycleCountInterval)}"></div>
        </div>
        <div class="helper-note" style="margin-bottom:0;">${t('cc_settings_helper')}</div>
      </div>

      <div class="modal-actions">
        <button class="btn btn-ghost" id="btn-close-cycle-count">${t('btn_cancel')}</button>
        <button class="btn btn-primary" id="btn-save-cycle-count">${due ? t('cc_save_btn') : t('btn_save')}</button>
      </div>
    </div>
  </div>`;
}

/* Nombre de view-transition para la transición "hero" tarjeta→detalle de un recibo:
   la tarjeta de la grilla y el modal de detalle del MISMO recibo comparten este
   nombre, así el navegador anima una expandiéndose hasta la otra al abrir (y al
   revés al cerrar) en vez del fundido genérico. Regla clave: el nombre debe ser
   único en pantalla en cada instante — por eso la tarjeta se queda SIN nombre
   mientras su detalle está abierto (ver el ternario en la grilla), porque tarjeta
   y modal conviven en el DOM y un nombre duplicado hace que el navegador salte la
   transición entera. Los ids locales son uid('r') (siempre identificador CSS
   válido); el replace es por si un dato viejo de la nube trae otra cosa. */
function receiptVtName(id){ return 'receipt-'+String(id).replace(/[^a-zA-Z0-9_-]/g,''); }
function receiptDetailModal(){
  const r = receipts.find(x=>x.id===showReceiptDetail);
  if(!r) return '';
  return `
  <div class="overlay" id="receipt-detail-overlay">
    <div class="modal wide" style="view-transition-name:${receiptVtName(r.id)};">
      <h3 class="navy">${escapeHtml(r.supplier)||t('no_supplier_name')}</h3>
      <div class="sub">${escapeHtml(r.date)} &middot; ${t('rd_scanned_on')} ${new Date(r.createdAt).toLocaleDateString()}</div>
      ${receiptImages(r).map((img,idx)=>`<img class="receipt-preview" src="${escapeHtml(receiptImageSrc(img))}" alt="${t('rd_photo_alt')} ${escapeHtml(r.supplier)||t('no_supplier_name')} (${idx+1}/${receiptImages(r).length})" style="margin-bottom:6px;" onerror="this.outerHTML='<div class=&quot;receipt-preview&quot;></div>'">`).join('')}
      <label style="display:block;font-size:12px;font-weight:600;color:var(--ink-soft);margin-bottom:8px;">${t('rd_applied_label')}</label>
      ${(r.appliedItems||[]).map(it=>`
        <div class="matched-item" style="cursor:default;">
          <div class="mi-top"><strong>${escapeHtml(it.rawName)}</strong><span>${money(it.totalPrice)}</span></div>
          <div style="font-size:12px;color:var(--ink-soft);">${escapeHtml(it.qty)} ${escapeHtml(unitLabel(it.unit))} &middot; ${t('rd_applied_to')} ${escapeHtml(it.ingName)}</div>
        </div>
      `).join('')}
      <div class="modal-actions">
        <button class="btn btn-ghost" id="btn-delete-receipt" style="color:var(--tomato);border-color:color-mix(in srgb, var(--tomato) 35%, var(--panel));">${t('btn_delete')}</button>
        <button class="btn btn-ghost btn-icon" id="btn-print-receipt">${lineIcon('printer',15)} ${t('btn_print')}</button>
        <button class="btn btn-ghost btn-icon" id="btn-share-receipt">${lineIcon('share',15)} ${t('btn_share')}</button>
        <button class="btn btn-primary" id="btn-close-receipt-detail">${t('btn_close')}</button>
      </div>
    </div>
  </div>`;
}

function emptyState(iconName,title,sub,compact){
  return `<div class="empty-state" ${compact?'style="padding:16px 20px 40px;"':''}><div class="em-icon-badge">${lineIcon(iconName,28)}</div><h3 style="margin:0 0 6px;">${title}</h3>${sub?`<p style="margin:0;font-size:13px;">${sub}</p>`:''}</div>`;
}

/* ================= MODAL: IDIOMA (primera pantalla que ve un usuario nuevo) ================= */
// Su propia pantalla, separada del tutorial de bienvenida — antes compartían modal, así
// que alguien que no lee ni español ni inglés se encontraba con un párrafo entero
// ilegible antes de llegar a los botones que se lo iban a arreglar. Arrancamos con una
// adivinanza (navigator.language, ver arriba en la carga de uiLang) pero se la
// confirmamos acá en vez de asumirla calladamente. Los nombres de los idiomas van
// fijos en su propio idioma (nunca "Inglés"/"Spanish" traducidos) porque alguien que
// no lee el idioma activo todavía tiene que poder reconocer el suyo igual.
function chooseLangAndContinue(lang){
  setLang(lang);
  showLangChoiceModal = false;
  showWelcomeModal = true;
  render();
}
function langChoiceModal(){
  return `
  <div class="overlay" id="lang-choice-overlay">
    <div class="modal" style="text-align:center;">
      <div style="font-size:34px;margin-bottom:14px;">🌐</div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        ${/* Inglés primero: es el idioma principal de la app. */''}
        <button type="button" data-choose-lang="en" class="btn btn-primary" style="padding:14px;font-size:15px;">English</button>
        <button type="button" data-choose-lang="es" class="btn btn-primary" style="padding:14px;font-size:15px;">Español</button>
      </div>
    </div>
  </div>`;
}

/* ================= MODAL: BIENVENIDA (primera vez que se abre la app) ================= */
// Un color lleno por paso (no solo el ícono, como antes) para que avanzar se sienta
// como pasar de página en vez de leer una lista estática — mismos colores que ya
// usa el resto de la app para agrupar conceptos (ver el comentario de settingsCardHeader
// más arriba) más "tomato" para el paso de equipo, que en todos lados es el color de
// "compartir/positivo" en Configuración.
// Antes eran 5 pasos (uno por feature suelta); un usuario nos dijo que se sentía largo
// para lo poco que hace falta saber antes de arrancar. Bajado a 3, agrupando por lo que
// el usuario realmente hace ("escaneo" + "se actualiza solo" son un solo momento, igual
// que "te avisamos" + "presupuesto" son las dos caras de "controlamos los números").
const WELCOME_STEPS = [
  {scene:'scan', icon:'camera', bg:'var(--sky-soft)',     fg:'var(--sky)',        titleKey:'welcome_step1_title', subKey:'welcome_step1_sub'},
  {scene:'bell', icon:'bell',   bg:'var(--saffron-soft)', fg:'var(--saffron-ink)',titleKey:'welcome_step2_title', subKey:'welcome_step2_sub'},
  {scene:'team', icon:'share',  bg:'var(--tomato-soft)',  fg:'var(--tomato-ink)', titleKey:'welcome_step3_title', subKey:'welcome_step3_sub'}
];
/* Mini-ilustración animada de cada paso del tutorial (estilos .ws-* en el CSS) —
   reemplaza al icono estático de antes por una escena en movimiento de lo que el
   paso promete: el recibo escaneándose, la campana sonando, el equipo presente. */
function welcomeScene(scene){
  if(scene==='scan') return `<div class="ws-scene"><div class="ws-receipt"><i></i><i></i><i></i><i></i><div class="ws-beam"></div></div></div>`;
  if(scene==='bell') return `<div class="ws-scene"><span class="ws-bell-wrap">${lineIcon('bell',26)}<span class="ws-badge"></span></span></div>`;
  return `<div class="ws-scene"><span class="ws-avatar a1"></span><span class="ws-avatar a2"></span><span class="ws-avatar a3"></span></div>`;
}
function closeWelcomeModal(){
  showWelcomeModal = false;
  welcomeStep = 0;
  welcomeStepAnimated = false;
  try{ localStorage.setItem('patron_onboarded','1'); }catch(e){}
  render();
}
function advanceWelcomeStep(){
  if(welcomeStep < WELCOME_STEPS.length-1){ welcomeStepDir=1; welcomeStep++; welcomeStepAnimated = false; render(); }
  else closeWelcomeModal();
}
function retreatWelcomeStep(){
  if(welcomeStep>0){ welcomeStepDir=-1; welcomeStep--; welcomeStepAnimated = false; render(); }
}
// Saltar directo a un paso tocando su puntito, en vez de tener que ir de a uno — la
// dirección del deslizamiento se calcula igual que avanzar/retroceder a mano, así el
// salto se siente consistente con el resto del tutorial en vez de un corte seco.
function jumpToWelcomeStep(i){
  if(i===welcomeStep || i<0 || i>=WELCOME_STEPS.length) return;
  welcomeStepDir = i>welcomeStep ? 1 : -1;
  welcomeStep = i;
  welcomeStepAnimated = false;
  render();
}
function welcomeModal(){
  const step = WELCOME_STEPS[welcomeStep];
  const isLast = welcomeStep === WELCOME_STEPS.length-1;
  // Ver el comentario de welcomeStepAnimated más arriba: la primera vez que se
  // dibuja este paso se deja animar (animClass vacío); cualquier redibujado
  // posterior del MISMO paso llega con animClass=' no-anim' y salta la animación.
  const animClass = welcomeStepAnimated ? ' no-anim' : '';
  const dirClass = welcomeStepDir<0 ? ' dir-back' : '';
  welcomeStepAnimated = true;
  return `
  <div class="overlay${animClass}" id="welcome-overlay">
    <div class="modal${animClass}">
      ${!isLast ? `<button type="button" class="welcome-skip-btn" id="btn-welcome-skip">${t('welcome_skip_btn')}</button>` : ''}
      <h3 class="basil">${t('welcome_title')}</h3>
      <div class="sub">${t('welcome_sub')}</div>
      <div class="welcome-step-card${animClass}${dirClass}" style="background:${step.bg};">
        ${welcomeScene(step.scene)}
        <strong class="welcome-step-title">${t(step.titleKey)}</strong>
        <div class="welcome-step-sub">${t(step.subKey)}</div>
      </div>
      <div class="welcome-progress-row">
        <div class="welcome-progress-track"><div class="welcome-progress-fill" style="width:${Math.round((welcomeStep+1)/WELCOME_STEPS.length*100)}%;"></div></div>
        <span class="welcome-progress-pct">${Math.round((welcomeStep+1)/WELCOME_STEPS.length*100)}%</span>
      </div>
      <div class="welcome-dots">
        ${WELCOME_STEPS.map((s,i)=>`<span class="welcome-dot${i===welcomeStep?' active':''}" data-jump-step="${i}" style="background:${i===welcomeStep?s.fg:'var(--line)'};"></span>`).join('')}
      </div>
      <div class="modal-actions">
        ${welcomeStep>0 ? `<button type="button" class="btn btn-ghost" id="btn-welcome-back">${t('welcome_back_btn')}</button>` : ''}
        <button type="button" class="btn btn-primary" id="btn-welcome-next">${isLast ? t('welcome_btn') : t('welcome_next_btn')}</button>
      </div>
    </div>
  </div>`;
}

/* ================= MODAL: INICIAR SESIÓN (Google o email/contraseña) ================= */
// "note" es opcional: un mensaje informativo (no un error) que explica POR QUÉ se le
// pide iniciar sesión justo ahora — por ejemplo, al tocar "Escanear recibo" sin cuenta
// (ver openScanModal). Sin esto, alguien que nunca vio la app se encontraba con un
// login pelado, sin entender qué lo disparó.
function openAuthModal(note){ authMode='signin'; authError=''; authContextNote=note||''; authLoading=false; authEmail=''; authPassword=''; authName=''; authPin=''; authPinConfirm=''; authJoinCode=''; showAuthModal=true; render(); }
/* "Guardá tu cuenta": convierte la cuenta anónima del trial en una real con solo
   nombre + email + PIN (el PIN es el password de Firebase, mínimo 6 — mismo criterio
   que las cuentas de equipo por PIN). linkWithCredential conserva el MISMO uid, así
   que todo lo escaneado/cargado durante la prueba queda intacto, sin migrar nada.
   Se abre cuando el trial toca un límite (escaneos o inventario) o desde el botón
   del header cuando la sesión es anónima. */
function openUpgradeModal(note){ authMode='upgrade'; authError=''; authContextNote=note||''; authLoading=false; authEmail=''; authPassword=''; authName=''; authPin=''; authPinConfirm=''; authJoinCode=''; showAuthModal=true; render(); }
function submitUpgrade(){
  const name=(document.getElementById('auth-name')?.value||'').trim();
  const email=(document.getElementById('auth-email')?.value||'').trim();
  if(!name){ authError=t('auth_err_need_name'); render(); return; }
  if(!email){ authError=t('auth_err_need_email'); render(); return; }
  if(authPin.length<8){ authError=t('auth_err_pin_short'); render(); return; }
  if(authPin!==authPinConfirm){ authError=t('auth_err_pin_mismatch'); render(); return; }
  authLoading=true; authError=''; render();
  // Si nunca escaneó (llegó acá por el límite de inventario, sin cuenta anónima
  // todavía), se crea la anónima primero — un solo camino de conversión para todos.
  ensureTrialAccount().then(user=>{
    const cred = firebase.auth.EmailAuthProvider.credential(email, authPin);
    return user.linkWithCredential(cred)
      .then(()=>user.updateProfile({displayName:name}))
      // El objeto en memoria no siempre refleja el link al instante — se refresca
      // para que isAnonymous pase a false y la UI (header, límites) lo vea ya.
      .then(()=>user.reload())
      .then(()=>{ currentUser=firebase.auth().currentUser; });
  }).then(()=>{
    // linkWithCredential NO re-dispara onAuthStateChanged (el usuario es el mismo
    // objeto), así que la marca permanente de "esta persona ya tuvo cuenta real"
    // no se ponía hasta una recarga — si cerraba sesión antes de recargar, el
    // próximo toque a "Escanear" le creaba una cuenta anónima nueva en silencio
    // (justo lo que everHadRealAccount() existe para impedir).
    try{ localStorage.setItem('patron_ever_real_account','1'); }catch(e){}
    showAuthModal=false; authError=''; authContextNote='';
    authEmail=''; authPin=''; authPinConfirm=''; authName='';
  }).catch(err=>{
    if(err && err.code==='auth/email-already-in-use') authError=t('trial_email_in_use');
    else if(err && err.code==='auth/invalid-email') authError=t('auth_err_invalid_email');
    else authError=authErrorMessage(err && err.code);
  }).then(()=>{
    authLoading=false; render();
  });
}
function closeAuthModal(){ showAuthModal=false; authError=''; authContextNote=''; authEmail=''; authPassword=''; authName=''; authPin=''; authPinConfirm=''; authJoinCode=''; render(); }
/* PIN de equipo: en vez de pedirle un email a alguien que solo necesita entrar al
   inventario compartido de otra persona, se arma una cuenta real de Firebase Auth
   por atrás con un email inventado que sale del nombre (así puede volver a entrar
   después solo con nombre+PIN, sin tener que recordar ningún email). El PIN es el
   password real de esa cuenta — por eso tiene que tener al menos 6 caracteres, el
   mínimo que exige Firebase, aunque en la práctica funcione como un PIN. */
function slugifyName(name){
  return (name||'').toString().normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'').slice(0,40);
}
// El email se arma con nombre + código de equipo (no solo el nombre) para que quede
// aislado por negocio: dos cuentas distintas de Dusty pueden tener cada una a su
// propia "Maria" sin pisarse ni poder loguearse una en la cuenta de la otra.
function teamPinEmail(name, code){ return slugifyName(name)+'.'+(code||'').toString().trim().toLowerCase()+'@patron-team.local'; }
// Formato viejo (solo nombre, sin código) — se usa como respaldo al iniciar sesión
// para no dejar afuera a cuentas creadas antes de este cambio.
function legacyTeamPinEmail(name){ return slugifyName(name)+'@patron-team.local'; }
// Para mostrar en pantalla: el nombre real de una cuenta de nombre+PIN (guardado en
// displayName al crearla) en vez de su email inventado — para cuentas normales
// (Google/email), sigue siendo el email de siempre.
function currentUserLabel(){
  if(!currentUser) return '';
  return currentUser.displayName || currentUser.email || '';
}
/* currentUser arranca en null en CADA carga de página y recién se llena cuando
   Firebase termina de cargar y confirmar la sesión (siempre tarda un momento, hay
   red de por medio) — mientras tanto, cualquier parte de la interfaz que dependa
   de "hay sesión iniciada" cambiaría de forma visible apenas Firebase responde
   (ej. el botón de "Cambios" en Inventario aparecía de golpe y encogía a los otros
   dos botones de al lado, que reparten el ancho entre los tres). patron_had_session
   se sabe DESDE EL PRIMER dibujado (no depende de red), así que usarlo en vez de
   currentUser para decidir el LAYOUT deja todo asentado en su lugar final desde el
   principio — el contenido en sí (los datos) sigue esperando a Firebase como
   siempre, pero la forma de la pantalla no pega el salto. */
function hadCloudSessionBefore(){
  try{ return !!localStorage.getItem('patron_had_session'); }catch(e){ return false; }
}
/* "Quién está activo": cada miembro (no el dueño — a sí mismo obviamente se ve
   activo, no necesita Firestore para saberlo) manda una señal cada 30s mientras
   tiene la pestaña visible, escribiendo en SU PROPIO doc de membresía (mismo
   permiso de siempre: cada quien escribe su propio users/{dueño}/members/{miUid}).
   El dueño, mirando la lista de miembros en tiempo real, decide "activo ahora" si
   la última señal es reciente — no es instantáneo como un chat, pero para saber
   quién está usando la app en este momento alcanza, y el costo extra en Firestore
   es mínimo comparado con la sincronización del inventario. */
const PRESENCE_INTERVAL_MS = 30000;
const PRESENCE_ACTIVE_WINDOW_MS = PRESENCE_INTERVAL_MS * 3;
let presenceHeartbeatTimer = null;
function sendPresenceHeartbeat(){
  if(!currentUser || !joinedOwnerUid) return;
  if(typeof document!=='undefined' && document.visibilityState==='hidden') return;
  membersRef(joinedOwnerUid).doc(currentUser.uid).set({lastActive: new Date().toISOString()}, {merge:true}).catch(()=>{});
}
function startPresenceHeartbeat(){
  stopPresenceHeartbeat();
  sendPresenceHeartbeat();
  presenceHeartbeatTimer = setInterval(sendPresenceHeartbeat, PRESENCE_INTERVAL_MS);
}
function stopPresenceHeartbeat(){
  if(presenceHeartbeatTimer) clearInterval(presenceHeartbeatTimer);
  presenceHeartbeatTimer = null;
}
function isRecentlyActive(iso){
  return !!iso && (Date.now() - new Date(iso).getTime()) < PRESENCE_ACTIVE_WINDOW_MS;
}
// Reusado tanto por joinTeam() (alguien que ya tenía cuenta) como por submitQuickJoin()
// (cuenta nueva con nombre+PIN recién creada) — es la parte de "empezar a mirar el
// inventario del dueño" que es idéntica en los dos casos.
function applyJoinedTeam(ownerUid, ownerEmail){
  detachFirestoreListeners();
  detachTeamListener();
  // Esta limpieza es una transición de árbol de datos, no una edición real — no debe
  // disparar una subida a la nube con estado vacío (ver nota completa en joinTeam()).
  applyingRemoteSnapshot = true;
  // Se limpia TODO el estado sincronizable — este bloque olvidaba calNotes y
  // recetas/salidas: al unirse a un equipo, las recetas personales quedaban en
  // pantalla dentro del contexto del equipo y la próxima edición las subía al
  // inventario del dueño (y al revés al salir).
  inventory=[]; purchases=[]; receipts=[]; deletedInventoryIds=[]; deletedReceiptIds=[]; deletedPurchaseIds=[]; aliasMap={}; calNotes=[]; deletedCalNoteIds=[]; recipes=[]; outflows=[]; deletedRecipeIds=[]; resetSyncedHashes();
  joinedOwnerUid = ownerUid; joinedOwnerEmail = ownerEmail;
  lastSyncedUid = ownerUid;
  saveState();
  applyingRemoteSnapshot = false;
  attachFirestoreListeners(joinedOwnerUid);
  startPresenceHeartbeat();
}
function submitQuickJoin(){
  const code = (authJoinCode||'').trim().toUpperCase();
  const name = (authName||'').trim();
  if(!code){ authError=t('team_err_need_code'); render(); return; }
  if(!name){ authError=t('auth_err_need_name'); render(); return; }
  if(authPin.length<8){ authError=t('auth_err_pin_short'); render(); return; }
  if(authPin!==authPinConfirm){ authError=t('auth_err_pin_mismatch'); render(); return; }
  authLoading=true; authError=''; render();
  ensurePatronFirebaseReady().then(()=>inviteCodeRef(code).get()).then(doc=>{
    if(!doc.exists){ const e=new Error('not-found'); e.code='not-found'; throw e; }
    const ownerUid = doc.data().ownerUid, ownerEmail = doc.data().ownerEmail||'';
    const email = teamPinEmail(name, code);
    return firebase.auth().createUserWithEmailAndPassword(email, authPin).then(cred=>{
      // Se guarda el nombre real en el perfil de Firebase — currentUserLabel() lo usa
      // en vez del email inventado en todos los lugares que muestran "quién sos"
      // (tooltip de sincronizado, reportar un problema, lista de miembros si esta
      // cuenta después invita a alguien más).
      return cred.user.updateProfile({ displayName: name }).then(()=>
        // `code` obligatorio: las reglas exigen probar un código de invitación válido de
        // este dueño para crear la membresía (mismo motivo que en joinTeam()).
        membersRef(ownerUid).doc(cred.user.uid).set({ email: name, joinedAt: new Date().toISOString(), code })
      )
        .then(()=>joinedRef(cred.user.uid).set({ownerUid, ownerEmail}))
        .then(()=>{
          // No se confía en que el listener genérico de onAuthStateChanged (que puede
          // disparar en cualquier momento apenas se crea la cuenta) se entere solo del
          // doc "joined" recién escrito — se fuerza acá mismo, así queda bien sin
          // importar el orden en que lleguen los eventos.
          applyJoinedTeam(ownerUid, ownerEmail);
        });
    });
  }).then(()=>{
    authLoading=false; showAuthModal=false;
    authName=''; authPin=''; authPinConfirm=''; authJoinCode='';
    render();
  }).catch(err=>{
    authLoading=false;
    if(err && err.code==='not-found') authError=t('team_err_not_found');
    else if(err && err.code==='auth/email-already-in-use') authError=t('auth_err_name_taken');
    else if(err && err.code==='auth/weak-password') authError=t('auth_err_pin_short');
    else { console.error('[Dusty] quick join failed:', err); authError=t('auth_err_generic'); }
    render();
  });
}
function submitPinLogin(){
  const name = (authName||'').trim();
  const code = (authJoinCode||'').trim().toUpperCase();
  if(!code){ authError=t('team_err_need_code'); render(); return; }
  if(!name){ authError=t('auth_err_need_name'); render(); return; }
  if(!authPin){ authError=t('auth_err_need_pin'); render(); return; }
  authLoading=true; authError=''; render();
  ensurePatronFirebaseReady().then(()=>{
    return firebase.auth().signInWithEmailAndPassword(teamPinEmail(name, code), authPin).catch(err=>{
      // Cuentas creadas antes de que el email empezara a incluir el código de equipo
      // todavía usan el formato viejo (solo nombre) — se reintenta una vez ahí para
      // no dejarlas afuera. Con la protección de enumeración de emails activada en
      // la consola de Firebase, "esa cuenta no existe" ya no llega como
      // auth/user-not-found sino como auth/invalid-credential genérico — por eso el
      // reintento cubre los dos códigos. Si el problema era el PIN (no el email), el
      // reintento con el formato viejo también falla y el usuario ve el mismo error
      // de siempre; solo cuesta un intento de red de más.
      if(err && (err.code==='auth/user-not-found' || err.code==='auth/invalid-credential')){
        return firebase.auth().signInWithEmailAndPassword(legacyTeamPinEmail(name), authPin);
      }
      throw err;
    });
  }).then(()=>{
    authLoading=false; showAuthModal=false;
    authName=''; authPin=''; authJoinCode=''; render();
  }).catch(err=>{
    authLoading=false;
    authError = (err && (err.code==='auth/user-not-found' || err.code==='auth/wrong-password' || err.code==='auth/invalid-credential')) ? t('auth_err_pin_wrong') : t('auth_err_generic');
    if(err && err.code!=='auth/user-not-found' && err.code!=='auth/wrong-password' && err.code!=='auth/invalid-credential') console.error('[Dusty] pin login failed:', err);
    render();
  });
}
function authErrorMessage(code){
  const map = {
    'auth/email-already-in-use': t('auth_err_email_in_use'),
    'auth/invalid-email': t('auth_err_invalid_email'),
    'auth/weak-password': t('auth_err_weak_password'),
    'auth/wrong-password': t('auth_err_wrong_password'),
    'auth/user-not-found': t('auth_err_user_not_found'),
    'auth/invalid-credential': t('auth_err_wrong_password'),
    'auth/too-many-requests': t('auth_err_too_many'),
    'auth/operation-not-allowed': t('auth_err_provider_disabled')
  };
  return (code && map[code]) || t('auth_err_generic');
}
// La misma lógica popup->redirect que ya usaba el botón de la nube directamente,
// ahora reusada tanto ahí (para cerrar sesión) como desde el botón de Google
// dentro de este modal.
function signInWithGoogle(){
  authLoading = true; authError=''; render();
  return ensurePatronFirebaseReady().then(()=>{
    return firebase.auth().signInWithPopup(new firebase.auth.GoogleAuthProvider());
  }).catch(err=>{
    const popupFailed = err && (err.code==='auth/popup-blocked' || err.code==='auth/operation-not-supported-in-this-environment' || err.code==='auth/cancelled-popup-request');
    if(popupFailed) return firebase.auth().signInWithRedirect(new firebase.auth.GoogleAuthProvider());
    if(err && err.code!=='auth/popup-closed-by-user'){
      console.error('[Dusty] sign-in failed:', err);
      authError = authErrorMessage(err.code);
    }
  }).catch(err=>{
    console.error('[Dusty] sign-in redirect failed:', err);
  }).then(()=>{
    authLoading = false; render();
  });
}
function authModal(){
  if(authMode==='upgrade'){
    return `
    <div class="overlay" id="auth-overlay">
      <div class="modal">
        <h3 class="navy">${t('trial_upgrade_title')}</h3>
        ${authContextNote ? `<div class="helper-note" style="background:var(--navy-wash);color:var(--navy-ink);border-radius:8px;padding:10px 12px;margin-bottom:12px;">${escapeHtml(authContextNote)}</div>` : ''}
        <p style="font-size:13px;color:var(--ink-soft);">${t('trial_upgrade_sub')}</p>
        ${authError ? `<div class="scan-error" style="margin-bottom:12px;">${escapeHtml(authError)}</div>` : ''}
        <div class="field"><label>${t('team_pin_name_label')}</label><input id="auth-name" type="text" value="${escapeHtml(authName)}" placeholder="${t('team_pin_name_placeholder')}" autocomplete="name"></div>
        <div class="field"><label>Email</label><input id="auth-email" type="email" value="${escapeHtml(authEmail)}" placeholder="tu@email.com" autocomplete="email"></div>
        <div class="field"><label>${t('team_pin_label')}</label><input id="auth-pin" type="password" inputmode="numeric" value="${escapeHtml(authPin)}" placeholder="••••••" autocomplete="new-password"></div>
        <div class="field"><label>${t('team_pin_confirm_label')}</label><input id="auth-pin-confirm" type="password" inputmode="numeric" value="${escapeHtml(authPinConfirm)}" placeholder="••••••" autocomplete="new-password"></div>
        <div class="modal-actions">
          <button class="btn btn-ghost" id="btn-cancel-auth">${t('btn_cancel')}</button>
          <button class="btn btn-primary" id="btn-submit-auth" ${authLoading?'disabled':''}>${authLoading ? t('auth_loading') : t('trial_upgrade_btn')}</button>
        </div>
        <div style="text-align:center;margin-top:12px;font-size:12.5px;color:var(--ink-soft);">
          ${t('auth_have_account')} <a href="#" id="btn-switch-signin" style="color:var(--navy-ink);font-weight:600;">${t('btn_login')}</a>
        </div>
      </div>
    </div>`;
  }
  if(authMode==='join' || authMode==='pinlogin'){
    return `
    <div class="overlay" id="auth-overlay">
      <div class="modal">
        <h3 class="basil">${authMode==='join' ? t('team_join_title') : t('team_pinlogin_title')}</h3>
        <p style="font-size:13px;color:var(--ink-soft);">${authMode==='join' ? t('team_join_hint') : t('team_pinlogin_hint')}</p>
        ${authError ? `<div class="scan-error" style="margin-bottom:12px;">${escapeHtml(authError)}</div>` : ''}
        <div class="field"><label>${t('team_join_placeholder')}</label><input id="auth-join-code" type="text" value="${escapeHtml(authJoinCode)}" placeholder="${t('team_join_placeholder')}" style="text-transform:uppercase;"></div>
        <div class="field"><label>${t('team_pin_name_label')}</label><input id="auth-name" type="text" value="${escapeHtml(authName)}" placeholder="${t('team_pin_name_placeholder')}" autocomplete="name"></div>
        <div class="field"><label>${t('team_pin_label')}</label><input id="auth-pin" type="password" inputmode="numeric" value="${escapeHtml(authPin)}" placeholder="••••••" autocomplete="${authMode==='join'?'new-password':'current-password'}"></div>
        ${authMode==='join' ? `<div class="field"><label>${t('team_pin_confirm_label')}</label><input id="auth-pin-confirm" type="password" inputmode="numeric" value="${escapeHtml(authPinConfirm)}" placeholder="••••••" autocomplete="new-password"></div>` : ''}
        <div class="modal-actions">
          <button class="btn btn-ghost" id="btn-cancel-auth">${t('btn_cancel')}</button>
          <button class="btn btn-primary" id="btn-submit-auth" ${authLoading?'disabled':''}>${authLoading ? t('auth_loading') : (authMode==='join' ? t('team_join_btn') : t('btn_login'))}</button>
        </div>
        <div style="text-align:center;margin-top:12px;font-size:12.5px;color:var(--ink-soft);">
          <a href="#" id="btn-switch-signin" style="color:var(--navy);font-weight:600;">${t('team_back_to_normal_login')}</a>
        </div>
      </div>
    </div>`;
  }
  return `
  <div class="overlay" id="auth-overlay">
    <div class="modal">
      <h3 class="navy">${authMode==='signup' ? t('auth_signup_title') : t('auth_signin_title')}</h3>
      ${authContextNote ? `<div class="helper-note" style="background:var(--navy-wash);color:var(--navy);border-radius:8px;padding:10px 12px;margin-bottom:12px;">${escapeHtml(authContextNote)}</div>` : ''}
      <button type="button" class="btn btn-ghost" id="btn-google-auth" style="width:100%;display:flex;align-items:center;justify-content:center;gap:8px;" ${authLoading?'disabled':''}>
        <svg viewBox="0 0 48 48" width="18" height="18"><path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h11.8c-.5 2.7-2.1 5-4.4 6.6v5.4h7.1c4.2-3.9 6.6-9.6 6.6-16.5z"/><path fill="#34A853" d="M24 46c6 0 11-2 14.6-5.4l-7.1-5.4c-2 1.3-4.5 2.1-7.5 2.1-5.8 0-10.7-3.9-12.4-9.1H4.3v5.6C7.9 41.1 15.4 46 24 46z"/><path fill="#FBBC05" d="M11.6 28.2c-.4-1.3-.7-2.7-.7-4.2s.2-2.9.7-4.2v-5.6H4.3C2.8 17.1 2 20.4 2 24s.8 6.9 2.3 9.8z"/><path fill="#EA4335" d="M24 10.7c3.3 0 6.2 1.1 8.5 3.3l6.3-6.3C34.9 4.2 30 2 24 2 15.4 2 7.9 6.9 4.3 14.2l7.3 5.6c1.7-5.2 6.6-9.1 12.4-9.1z"/></svg>
        ${t('auth_continue_google')}
      </button>
      <div style="text-align:center;color:var(--ink-soft);font-size:11.5px;margin:12px 0;">${t('auth_or')}</div>
      ${authError ? `<div class="scan-error" style="margin-bottom:12px;">${escapeHtml(authError)}</div>` : ''}
      <div class="field"><label>Email</label><input id="auth-email" type="email" value="${escapeHtml(authEmail)}" placeholder="tu@email.com" autocomplete="email"></div>
      <div class="field"><label>${t('auth_password')}</label><input id="auth-password" type="password" value="${escapeHtml(authPassword)}" placeholder="••••••••" autocomplete="${authMode==='signup'?'new-password':'current-password'}"></div>
      ${authMode==='signin' ? `<button type="button" class="link-btn" id="btn-forgot-password" style="padding:0;">${t('auth_forgot_password')}</button>` : ''}
      <div class="modal-actions">
        <button class="btn btn-ghost" id="btn-cancel-auth">${t('btn_cancel')}</button>
        <button class="btn btn-primary" id="btn-submit-auth" ${authLoading?'disabled':''}>${authLoading ? t('auth_loading') : (authMode==='signup'?t('auth_create_account'):t('btn_login'))}</button>
      </div>
      <div style="text-align:center;margin-top:12px;font-size:12.5px;color:var(--ink-soft);">
        ${authMode==='signin'
          ? `${t('auth_no_account')} <a href="#" id="btn-switch-signup" style="color:var(--navy);font-weight:600;">${t('auth_create_account')}</a>`
          : `${t('auth_have_account')} <a href="#" id="btn-switch-signin" style="color:var(--navy);font-weight:600;">${t('btn_login')}</a>`}
      </div>
      <div style="text-align:center;margin-top:10px;font-size:12.5px;">
        <a href="#" id="btn-switch-join" style="color:var(--ink-soft);">${t('team_have_code_link')}</a>
        &nbsp;·&nbsp;
        <a href="#" id="btn-switch-pinlogin" style="color:var(--ink-soft);">${t('team_have_pin_link')}</a>
      </div>
    </div>
  </div>`;
}

/* ================= MODAL: EQUIPO (compartir inventario) ================= */
// Círculo de color con la inicial de cada persona — mismo truco que settingsCardHeader
// (bubbles de color en vez de texto plano apilado), rotando por 4 colores ya usados en
// el resto de la app para que cada fila se distinga de un vistazo, no solo por el texto.
const TEAM_AVATAR_COLORS = [
  {bg:'var(--navy-wash)', fg:'var(--navy)'},
  {bg:'var(--sky-soft)', fg:'var(--sky-ink)'},
  {bg:'var(--saffron-soft)', fg:'var(--saffron-ink)'},
  {bg:'var(--basil-soft)', fg:'var(--basil-ink)'}
];
function teamAvatarBubble(label, idx){
  const c = TEAM_AVATAR_COLORS[idx % TEAM_AVATAR_COLORS.length];
  const initial = (label||'?').trim().charAt(0).toUpperCase() || '?';
  return `<span style="flex-shrink:0;width:28px;height:28px;border-radius:50%;background:${c.bg};color:${c.fg};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;">${escapeHtml(initial)}</span>`;
}
function teamModal(){
  return `
  <div class="overlay" id="team-overlay">
    <div class="modal">
      <h3 class="basil">${t('team_title')}</h3>
      ${joinedOwnerUid ? `
        <div class="settings-card" style="background:var(--basil-soft);">
          ${settingsCardHeader('cloud','var(--basil-soft)','var(--basil-ink)',t('team_title'))}
          <p style="font-size:13px;color:var(--basil-ink);margin:0;">${t('team_viewing_shared').replace('{email}', escapeHtml(joinedOwnerEmail))}</p>
        </div>
        <button type="button" class="btn btn-ghost" id="btn-leave-team" style="width:100%;" ${teamLoading?'disabled':''}>${t('team_leave_btn')}</button>
      ` : `
        <div class="settings-card">
          ${settingsCardHeader('share','var(--basil-soft)','var(--basil-ink)',t('team_your_code_label'))}
          <div style="display:flex;gap:8px;align-items:center;">
            <input id="team-code-display" type="text" value="${escapeHtml(teamInviteCode)}" readonly placeholder="${teamLoading?'…':''}" style="font-weight:700;letter-spacing:2px;text-align:center;">
            ${(typeof navigator!=='undefined' && navigator.share) ? `<button type="button" class="btn btn-ghost" id="btn-share-invite-code" ${teamInviteCode?'':'disabled'}>${t('team_share_btn')}</button>` : ''}
            <button type="button" class="btn btn-ghost" id="btn-copy-invite-code" ${teamInviteCode?'':'disabled'}>${t('team_copy_btn')}</button>
          </div>
          <div class="helper-note" style="margin-bottom:0;">${t('team_your_code_hint')}</div>
        </div>

        ${/* Visibilidad financiera — SOLO el dueño la controla (esta rama del
             modal es la del dueño). Apagado por defecto: los miembros ven costos
             y stock pero no ganancias ni el Valor. Viaja por meta al equipo. */''}
        <div class="settings-card">
          <label style="display:flex;align-items:center;gap:10px;cursor:pointer;">
            <input type="checkbox" id="team-profits-visible" ${profitsVisibleToMembers?'checked':''} style="width:18px;height:18px;accent-color:var(--basil);flex-shrink:0;">
            <span style="font-size:13.5px;font-weight:600;color:var(--ink);">${t('team_profits_toggle')}</span>
          </label>
          <div class="helper-note" style="margin:8px 0 0;">${t('team_profits_helper')}</div>
        </div>

        <div class="settings-card">
          ${settingsCardHeader('clock','var(--navy-wash)','var(--navy)',t('team_members_label'))}
          <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--border);">
            <span style="font-size:13px;display:flex;align-items:center;gap:8px;">${teamAvatarBubble(currentUserLabel()||t('team_you_owner_label'),0)}${t('team_you_owner_label')}</span>
            <span style="font-size:10px;font-weight:700;color:var(--basil-ink);background:var(--basil-soft);padding:2px 8px;border-radius:20px;">${t('presence_active_now')}</span>
          </div>
          ${teamMembers.map((m,idx)=>`
            <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--border);gap:8px;">
              <span style="font-size:13px;display:flex;align-items:center;gap:8px;min-width:0;flex:1;">
                ${teamAvatarBubble(m.email||m.id, idx+1)}
                <span style="overflow-wrap:anywhere;">${escapeHtml(m.email||m.id)}</span>
              </span>
              <span style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
                ${isRecentlyActive(m.lastActive)
                  ? `<span style="font-size:10px;font-weight:700;color:var(--basil-ink);background:var(--basil-soft);padding:2px 8px;border-radius:20px;">${t('presence_active_now')}</span>`
                  : `<span style="font-size:11px;color:var(--ink-soft);">${m.lastActive ? t('presence_last_seen').replace('{when}', timeAgo(m.lastActive)) : t('presence_never')}</span>`}
                <button type="button" class="link-btn" data-remove-member="${escapeHtml(m.id)}" style="padding:0;color:var(--tomato);">${t('team_remove_btn')}</button>
              </span>
            </div>
          `).join('')}
          ${teamMembers.length===0 ? `<div class="helper-note" style="margin:8px 0 0;">${t('team_no_members_yet')}</div>` : ''}
        </div>

        <div class="settings-card" style="margin-bottom:0;">
          ${settingsCardHeader('share','var(--sky-soft)','var(--sky-ink)',t('team_join_label'))}
          <div style="display:flex;gap:8px;">
            <input id="team-join-input" type="text" value="${escapeHtml(teamJoinCode)}" placeholder="${t('team_join_placeholder')}" style="text-transform:uppercase;">
            <button type="button" class="btn btn-ghost" id="btn-join-team" ${teamLoading?'disabled':''}>${t('team_join_btn')}</button>
          </div>
        </div>
      `}
      ${teamError ? `<div class="scan-error" style="margin-top:12px;">${escapeHtml(teamError)}</div>` : ''}
      <div class="modal-actions">
        <button class="btn btn-ghost" id="btn-sign-out-team">${t('team_sign_out_btn')}</button>
        <button class="btn btn-primary" id="btn-close-team">${t('btn_close')}</button>
      </div>
    </div>
  </div>`;
}

/* ================= MODAL: REPORTAR UN PROBLEMA ================= */
/* Requiere sesión iniciada porque escribe en Firestore (una escritura sin
   autenticar sería una puerta abierta para que cualquiera llene la base de
   datos de basura). Si no hay sesión, cae al link de email de siempre. */
function openFeedbackModal(){
  if(!currentUser){ openFeedbackEmail(); return; }
  feedbackMessage=''; feedbackSubmitting=false; feedbackSent=false;
  showFeedbackModal=true; render();
}
function closeFeedbackModal(){ showFeedbackModal=false; render(); }
function sendFeedback(){
  const message = document.getElementById('feedback-message').value.trim();
  if(!message) return;
  feedbackSubmitting=true; render();
  firebase.firestore().collection('feedback').add({
    uid: currentUser.uid, email: currentUser.email, name: currentUserLabel(), message,
    userAgent: navigator.userAgent, createdAt: new Date().toISOString()
  }).then(()=>{
    feedbackSent=true;
  }).catch(err=>{
    console.error('[Dusty] feedback send failed:', err);
    showToast(t('feedback_error'), 'error');
  }).then(()=>{
    feedbackSubmitting=false; render();
  });
}
/* ================= CIERRE DE MES =================
   La "conclusión" del arco (conversación con el usuario 2026-09-03): la app pide
   datos todos los días — este modal es el momento de cosecha, donde se los
   devuelve digeridos: inversión, gastos, presupuesto, valor y potencial del
   inventario, producto estrella, mayor proveedor y el mayor cambio de precio.
   Todo se calcula de datos que ya existen; cero estado nuevo que sincronizar. */
let showMonthRecap=false, monthRecapKey=null;
let recapMode='month';
function recapKeyLabel(key){ return key.length===4 ? key : monthLabel(key, uiLang); }
// Períodos con actividad (recibos o salidas), del más nuevo al más viejo, con el
// período actual siempre presente — son las columnas de la hoja. Cap a 24.
function recapPeriodKeys(mode){
  const set = new Set();
  receipts.forEach(r=>{ const k=monthKey(r.date); if(k) set.add(mode==='year'?k.slice(0,4):k); });
  outflows.forEach(o=>{ const k=monthKey(o.date); if(k) set.add(mode==='year'?k.slice(0,4):k); });
  set.add(mode==='year' ? localMonthStr().slice(0,4) : localMonthStr());
  return [...set].sort().reverse().slice(0,24);
}
// Base de comparación de una columna: para meses, el MISMO MES del año anterior
// si tiene actividad (year-over-year, pedido del usuario: al completarse un año,
// septiembre se compara con septiembre); si no, el mes anterior. Años: año previo.
function recapBaseKey(key, keysWithData){
  if(key.length===4) return String(Number(key)-1);
  const lastYear = (Number(key.slice(0,4))-1) + key.slice(4);
  if(keysWithData.has(lastYear)) return lastYear;
  return shiftMonthStr(key, -1);
}
function monthRecapModal(){
  // PÁGINA COMPLETA por columnas (rediseño 2026-09-04): reusa .oc-sheet — hereda
  // el position:fixed correcto, la subida animada y el guard del swipe de tabs.
  // Se renderiza SIEMPRE (el shell) para que la transición CSS pueda correr;
  // el contenido solo se computa abierta. Una columna por período con TODO
  // adentro; cada valor lleva su delta contra la base que elige recapBaseKey
  // (mismo mes del año pasado cuando existe — year-over-year — si no, el mes
  // anterior). Ver periodFinancials en app-03 para la honestidad de estimados.
  let body='';
  if(showMonthRecap){
    const keys = recapPeriodKeys(recapMode);
    // Claves con actividad real: deciden la base YoY y si una columna muestra deltas.
    const withData = new Set();
    receipts.forEach(r=>{ const k=monthKey(r.date); if(k) withData.add(recapMode==='year'?k.slice(0,4):k); });
    outflows.forEach(o=>{ const k=monthKey(o.date); if(k) withData.add(recapMode==='year'?k.slice(0,4):k); });
    const nowKey = recapMode==='year' ? localMonthStr().slice(0,4) : localMonthStr();
    const focusKey = recapMode==='year' ? (monthRecapKey||nowKey).slice(0,4) : (monthRecapKey||nowKey);
    const invValue = inventory.reduce((s,i)=>s+(i.qtyOnHand||0)*(i.costPerUnit||0),0);
    const potential = inventory.filter(i=>!i.expenseOnly && (i.salePrice||0)>0).reduce((s,i)=>s+(i.qtyOnHand||0)*(i.salePrice||0),0);
    const posNeg = (v)=> v>=0 ? 'var(--basil)' : 'var(--tomato)';
    const pctTxt = (p)=> p===null ? '' : `<div class="recap-note">${p.toFixed(0)}% ${t('recap_margin')}</div>`;
    // Delta chico bajo el valor: ▲/▼ % contra la base (gastos: bajar es bueno).
    const badge=(a,b,goodUp)=>{
      if(b===null || (a===0 && b===0)) return '';
      const delta = b!==0 ? (a-b)/Math.abs(b)*100 : 100;
      const good = goodUp===false ? delta<=0 : delta>=0;
      const shown = Math.abs(delta)>=1000 ? '999+' : Math.abs(delta).toFixed(0);
      return `<span class="recap-delta">${delta===0?'＝':`<span style="color:${good?'var(--basil)':'var(--tomato)'};">${delta>0?'▲':'▼'} ${shown}%</span>`}</span>`;
    };
    const crow=(icon,label,value,color,extra)=>`
      <div class="recap-row"><span class="recap-label">${icon} ${label}</span>
        <span class="recap-col-val"><strong style="color:${color||'var(--ink)'};">${value}</strong>${extra||''}</span></div>`;
    const cols = keys.map((k,idx)=>{
      const fin = periodFinancials(k);
      const baseKey = recapBaseKey(k, withData);
      const base = withData.has(baseKey) ? periodFinancials(baseKey) : null;
      const isCur = k===nowKey;
      const d=(a,b,gU)=> base ? badge(a,b,gU) : '';
      const emptyCol = fin.receiptsCount===0 && fin.invested===0 && fin.expense===0 && !fin.hadOutflows;
      return `
      <div class="recap-col ${k===focusKey?'focus':''}" style="animation-delay:${Math.min(idx,8)*70}ms">
        <div class="recap-col-head">
          <div class="recap-col-period">${recapKeyLabel(k)}</div>
          ${base ? `<div class="recap-col-vs">${t('recap_vs').replace('{p}', recapKeyLabel(baseKey))}</div>` : ''}
        </div>
        ${emptyCol ? `<div class="oc-empty" style="margin:14px 0;">${t('recap_empty')}</div>` : `
        ${crow('📦', t('spend_invested'), money(fin.invested), 'var(--basil)', d(fin.invested, base&&base.invested, true))}
        ${crow('💸', t('spend_expenses'), money(fin.expense), 'var(--saffron)', d(fin.expense, base&&base.expense, false))}
        ${monthlyBudget && recapMode==='month' ? crow('🎯', t('recap_budget_used'), Math.round(fin.expense/monthlyBudget*100)+'%', budgetStatus(Math.round(fin.expense/monthlyBudget*100))==='crit'?'var(--tomato)':'var(--ink)') : ''}
        <div class="recap-section-title">${t('recap_pl_title')}</div>
        ${fin.hadOutflows ? `
        ${crow('🧾', t('recap_revenue'), money(fin.revenue), 'var(--sky-bright)', d(fin.revenue, base&&base.revenue, true))}
        ${crow('📤', t('recap_cogs'), money(fin.cogs), null, d(fin.cogs, base&&base.cogs, false))}
        ${crow('💹', t('recap_gross'), money(fin.gross), posNeg(fin.gross), (d(fin.gross, base&&base.gross, true))+pctTxt(fin.grossMarginPct))}
        ${crow('🏁', t('recap_net'), money(fin.net), posNeg(fin.net), (d(fin.net, base&&base.net, true))+pctTxt(fin.netMarginPct))}`
        : `<div class="recap-note" style="padding:6px 2px;">${t('recap_no_outflows')}</div>`}
        ${crow('🧾', t('recap_receipts'), String(fin.receiptsCount), null, d(fin.receiptsCount, base&&base.receiptsCount, true))}
        ${isCur && canSeeFinancials() ? `
        <div class="recap-section-title"></div>
        ${crow('💰', t('recap_value_today'), money(invValue), 'var(--basil)')}
        ${potential>0 ? crow('🏷', t('inv_potential_label'), money(potential), 'var(--sky-bright)') : ''}` : ''}
        `}
      </div>`;
    }).join('');
    body = `
    <div class="recap-mode" style="margin:2px 0 10px;">
      <button type="button" class="exit-reason-chip ${recapMode==='month'?'on':''}" data-recap-mode="month">${t('recap_mode_month')}</button>
      <button type="button" class="exit-reason-chip ${recapMode==='year'?'on':''}" data-recap-mode="year">${t('recap_mode_year')}</button>
    </div>
    <div class="recap-cols" id="recap-cols">${cols}</div>
    <div class="recap-note" style="padding:10px 2px 4px;">${t('recap_est_note')}</div>`;
  }
  return `
  <div class="oc-sheet ${showMonthRecap?'open':''}" id="recap-sheet" role="dialog" aria-modal="true" aria-label="${t('recap_title')}"${showMonthRecap?'':' aria-hidden="true"'}>
    <div class="oc-sheet-head">
      <span class="oc-title" style="flex:1;">${t('recap_title')}</span>
      <button type="button" class="oc-close" id="btn-close-month-recap" aria-label="${t('btn_close')}">✕</button>
    </div>
    ${body}
  </div>`;
}

/* ================= GASTO MANUAL (sin recibo) =================
   Tocar el monto del mes en el Dashboard abre esto: un gasto en efectivo o sin
   recibo entra como RECIBO MANUAL (mismo shape, sin fotos ni productos) — así
   suma al mes, aparece en el calendario y la lista de Recibos, sincroniza por
   doc como cualquier recibo, y se borra con el flujo de siempre. Editar "el
   número" directo no existe a propósito: el gasto es la suma de sus recibos. */
let showManualSpendModal=false, manualSpendError=false, manualSpendKind='expense';
function openManualSpendModal(){ showManualSpendModal=true; manualSpendError=false; manualSpendKind='expense'; render(); }
function closeManualSpendModal(){ showManualSpendModal=false; render(); }
function saveManualSpend(){
  const amt = parseFloat(document.getElementById('ms-amount').value);
  if(isNaN(amt) || amt<=0){ manualSpendError=true; render(); return; }
  const desc = (document.getElementById('ms-desc').value||'').trim();
  const date = document.getElementById('ms-date').value || localDateStr();
  const rec = {
    id: uid('r'), images: [], supplier: desc || t('manual_expense_label'), date,
    total: Math.round(amt*100)/100, itemCount: 0, appliedItems: [],
    createdAt: new Date().toISOString(), purchaseIds: [], manual: true,
    // 'expense' (default) va a gastos operativos; 'investment' a inversión —
    // una compra de mercadería en efectivo sin recibo también existe.
    manualKind: manualSpendKind
  };
  receipts.push(rec);
  saveState();
  logActivity('receipt_added', rec.supplier);
  closeManualSpendModal();
  showToast(t('manual_spend_added'));
}
function manualSpendModal(){
  return `
  <div class="overlay" id="manual-spend-overlay">
    <div class="modal">
      <h3 class="saffron">${t('manual_spend_title')}</h3>
      <div class="sub">${t('manual_spend_sub')}</div>
      <div class="field"><label>${t('manual_kind_label')}</label>
        <div style="display:flex;gap:8px;">
          <button type="button" class="exit-reason-chip ${manualSpendKind==='expense'?'on':''}" data-ms-kind="expense" style="flex:1;">💸 ${t('manual_kind_expense')}</button>
          <button type="button" class="exit-reason-chip ${manualSpendKind==='investment'?'on':''}" data-ms-kind="investment" style="flex:1;">📦 ${t('manual_kind_investment')}</button>
        </div>
      </div>
      <div class="field"><label for="ms-amount">${t('manual_spend_amount')}</label>
        <input id="ms-amount" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0.00">
        ${manualSpendError ? `<div style="font-size:12px;color:var(--tomato);margin-top:4px;">${t('manual_spend_err')}</div>` : ''}
      </div>
      <div class="field"><label for="ms-desc">${t('manual_spend_desc')}</label>
        <input id="ms-desc" type="text" maxlength="60" placeholder="${t('manual_spend_ph')}"></div>
      <div class="field"><label for="ms-date">${t('lbl_date')}</label>
        <input id="ms-date" type="date" value="${localDateStr()}"></div>
      <div class="modal-actions">
        <button class="btn btn-ghost" id="btn-cancel-manual-spend">${t('btn_cancel')}</button>
        <button class="btn btn-primary" id="btn-save-manual-spend">${t('manual_spend_save')}</button>
      </div>
    </div>
  </div>`;
}

/* ================= ENCUESTA DE SALIDA (retención) =================
   Se interpone ANTES del modal real de eliminar cuenta. Tres pasos con la misma
   barra de progreso y porcentaje del tutorial de bienvenida (pedido del usuario:
   "que no aburra, bien dinámico") — cada paso entra con la animación del tutorial
   porque su contenedor cambia de id y morphdom lo recrea. Lo PRIMERO es la oferta
   del mes gratis (regla del usuario); las respuestas van a la colección feedback
   con kind propio, y aceptar la oferta cierra todo sin tocar la cuenta. */
let showExitSurvey=false, exitStep=0, exitReason=null;
const EXIT_REASONS=['use','scan','missing','price','other'];
function openExitSurvey(){ showExitSurvey=true; exitStep=0; exitReason=null; render(); }
function closeExitSurvey(){ showExitSurvey=false; render(); }
function sendExitFeedback(kind, reason, text){
  try{
    if(!currentUser || typeof firebase==='undefined') return;
    firebase.firestore().collection('feedback').add({
      uid: currentUser.uid, email: currentUser.email||'', name: currentUserLabel(),
      message: `[${kind}] ${reason?('reason='+reason+' '):''}${text||''}`.trim(),
      userAgent: navigator.userAgent, createdAt: new Date().toISOString()
    }).catch(()=>{});
  }catch(e){}
}
function exitSurveyModal(){
  const pct = Math.round((exitStep+1)/3*100);
  const steps = [`
      <div class="exit-step" id="exit-step-0">
        <div class="exit-emoji">🎁</div>
        <h3 class="basil" style="text-align:center;">${t('exit_offer_title')}</h3>
        <div class="sub" style="text-align:center;">${t('exit_offer_sub')}</div>
        <button type="button" class="btn btn-primary" id="btn-exit-accept" style="width:100%;margin-top:14px;">${t('exit_accept_offer')}</button>
        <button type="button" class="btn btn-ghost" id="btn-exit-next" style="width:100%;margin-top:8px;">${t('exit_continue_delete')}</button>
      </div>`,`
      <div class="exit-step" id="exit-step-1">
        <h3 class="saffron" style="text-align:center;">${t('exit_reason_title')}</h3>
        <div class="sub" style="text-align:center;">${t('exit_reason_sub')}</div>
        <div class="exit-reasons">
          ${EXIT_REASONS.map(r=>`<button type="button" class="exit-reason-chip ${exitReason===r?'on':''}" data-exit-reason="${r}">${t('exit_r_'+r)}</button>`).join('')}
        </div>
        <textarea id="exit-reason-text" rows="2" placeholder="${t('exit_reason_ph')}" style="width:100%;margin-top:10px;"></textarea>
        <button type="button" class="btn btn-primary" id="btn-exit-next" style="width:100%;margin-top:12px;" ${exitReason?'':'disabled'}>${t('exit_next')}</button>
      </div>`,`
      <div class="exit-step" id="exit-step-2">
        <div class="exit-emoji">👋</div>
        <h3 class="tomato" style="text-align:center;">${t('exit_final_title')}</h3>
        <div class="sub" style="text-align:center;">${t('exit_final_sub')}</div>
        <button type="button" class="btn btn-primary" id="btn-exit-delete" style="width:100%;margin-top:14px;background:var(--tomato);border-color:var(--tomato);">${t('exit_delete_btn')}</button>
      </div>`];
  return `
  <div class="overlay" id="exit-survey-overlay">
    <div class="modal">
      <button type="button" class="modal-close-btn" id="btn-close-exit-survey" aria-label="${t('btn_cancel')}">✕</button>
      <h3 class="navy" style="margin-bottom:2px;">${t('exit_title')}</h3>
      <div class="welcome-progress-row" style="margin:10px 0 14px;">
        <div class="welcome-progress-track"><div class="welcome-progress-fill" style="width:${pct}%;"></div></div>
        <span class="welcome-progress-pct">${pct}%</span>
      </div>
      ${steps[exitStep]}
    </div>
  </div>`;
}

function feedbackModal(){
  return `
  <div class="overlay" id="feedback-overlay">
    <div class="modal">
      <h3 class="tomato">${t('feedback_title')}</h3>
      ${feedbackSent ? `
        <div class="helper-note" style="margin:12px 0;">${t('feedback_sent')}</div>
        <div class="modal-actions"><button class="btn btn-primary" id="btn-close-feedback" style="width:100%;">${t('btn_close')}</button></div>
      ` : `
        <div class="sub">${t('feedback_sub')}</div>
        <div class="field"><textarea id="feedback-message" rows="5" placeholder="${t('feedback_placeholder')}">${escapeHtml(feedbackMessage)}</textarea></div>
        <div class="modal-actions">
          <button class="btn btn-ghost" id="btn-cancel-feedback">${t('btn_cancel')}</button>
          <button class="btn btn-primary" id="btn-send-feedback" ${feedbackSubmitting?'disabled':''}>${feedbackSubmitting ? t('auth_loading') : t('feedback_send')}</button>
        </div>
      `}
    </div>
  </div>`;
}

/* ================= MODAL: INGREDIENTE ================= */
function openItemModal(item){
  // Límite del trial: sin cuenta real, el inventario llega hasta TRIAL_INVENTORY_LIMIT
  // productos. Se frena ACÁ (antes de abrir el formulario) y no en "Guardar", para no
  // hacerle tipear un producto entero a alguien que no va a poder guardarlo. Editar
  // los que ya existen sigue permitido siempre.
  if(!item && isTrialUser() && inventory.length>=TRIAL_INVENTORY_LIMIT){
    openUpgradeModal(t('trial_inventory_limit_note'));
    return;
  }
  // unit arranca en la unidad más usada del propio inventario (el hábito real del
  // negocio), no en un 'lb' fijo — un campo menos que corregir en cada alta.
  draftItem = item ? {...item} : {id:uid('i'), name:'', unit:mostUsedInventoryUnit('lb'), costPerUnit:'', qtyOnHand:0, salePrice:'', sku:'', supplier:'', categoryId:null, capacityFull:null};
  editingItem = item ? item.id : null;
  showItemModal = true; render();
}
// profitMarginPct ahora vive en patron-core.js.
function marginBadge(item){
  const margin = profitMarginPct(item.costPerUnit, item.salePrice);
  if(margin===null) return '';
  const color = margin<0 ? 'var(--tomato)' : margin<15 ? 'var(--saffron)' : 'var(--basil)';
  return `<span style="color:${color};font-size:11px;font-weight:700;margin-left:6px;white-space:nowrap;">· ${margin.toFixed(0)}% ${t('lbl_profit_pct_short')}</span>`;
}
function itemModal(){
  return `
  <div class="overlay" id="item-overlay">
    <div class="modal">
      ${/* ✕ arriba: la ficha es larga y salir no debe requerir scrollear hasta
           el Cancel del fondo (pedido del usuario). Mismo patrón sticky que el
           modal de ajustes (.modal-close-btn). */''}
      <button type="button" class="modal-close-btn" id="btn-close-item-modal" aria-label="${t('btn_cancel')}">✕</button>
      <h3 class="navy">${editingItem?t('item_edit_title'):t('item_new_title')}</h3>
      <div class="sub">${t('item_sub')}</div>
      ${editingItem && draftItem.lastEditedBy ? `<div class="helper-note">${t('activity_last_edit').replace('{who}', escapeHtml(draftItem.lastEditedBy)).replace('{when}', timeAgo(draftItem.lastEditedAt))}</div>` : ''}

      <div class="settings-card">
        ${/* Sin el encabezado "📷 Photo" (pedido del usuario): la foto y sus
             botones se explican solos y la ficha gana altura. */''}
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
          <div class="stock-icon-ring" style="width:56px;height:56px;flex-shrink:0;">${stockIconSvg(draftItem)}</div>
          <div>
            <button type="button" class="btn btn-ghost btn-sm" id="btn-upload-item-photo">${t('btn_upload_photo')}</button>
            ${itemPhotoSrc(draftItem) ? `<button type="button" class="btn btn-ghost btn-sm" id="btn-remove-item-photo" style="margin-left:6px;">${t('btn_remove_photo')}</button>` : ''}
            <div style="font-size:11px;color:var(--ink-soft);margin-top:4px;">${t('item_photo_helper')}</div>
          </div>
          <input type="file" id="item-photo-file" accept="image/*" style="display:none;">
        </div>
        <div style="display:flex;gap:8px;">
          <button type="button" class="btn btn-ghost btn-sm" id="btn-scan-product" ${productScanState==='loading'?'disabled':''} style="flex:1;">${t('btn_scan_product')}</button>
          <button type="button" class="btn btn-ghost btn-sm" id="btn-scan-barcode" ${productScanState==='loading'?'disabled':''} style="flex:1;">${t('btn_scan_barcode')}</button>
          <input type="file" id="item-scan-photo-file" accept="image/*" capture="environment" style="display:none;">
        </div>
        ${productScanState==='loading' ? `<div class="scan-status" style="margin-top:14px;margin-bottom:0;"><div class="spinner"></div> ${t('product_scan_loading')}</div>` : ''}
        ${productScanState==='error' ? `<div class="scan-error" style="margin-top:14px;margin-bottom:0;">⚠ ${productScanError||t('product_scan_error')}</div>` : ''}
      </div>

      <div class="settings-card">
        ${settingsCardHeader('box','var(--navy-wash)','var(--navy)',t('item_section_basic'))}
        <div class="field"><label for="fi-name">${t('lbl_name')}</label><input id="fi-name" type="text" value="${escapeHtml(draftItem.name)}" placeholder="${t('ph_name_example')}"></div>
        <div class="field" style="margin-bottom:0;">
          <label for="fi-category">${t('lbl_category')}</label>
          <select id="fi-category">
            <option value="">${t('category_none_option')}</option>
            ${categories.map(c=>`<option value="${c.id}" ${draftItem.categoryId===c.id?'selected':''}>${escapeHtml(c.name)}</option>`).join('')}
            ${/* Crear la categoría acá mismo, sin salir a "Manage categories"
                 (pedido del usuario): elegir esta opción muestra el campo de
                 nombre de abajo; Enter o salir del campo la crea y la deja
                 seleccionada. */''}
            <option value="__create__">＋ ${t('category_create_option')}</option>
          </select>
          <input id="fi-new-category" type="text" maxlength="30" placeholder="${t('category_create_ph')}" style="display:none;margin-top:8px;">
        </div>
      </div>

      <div class="settings-card">
        ${settingsCardHeader('chart','var(--basil-soft)','var(--basil-ink)',t('item_section_pricing'))}
        <div class="field-row">
          <div class="field"><label for="fi-unit">${t('lbl_unit')}</label>
            <select id="fi-unit">${['lb','kg','oz','g','ml','l','unidad','caja','servicio'].map(u=>`<option value="${u}" ${draftItem.unit===u?'selected':''}>${unitLabel(u)}</option>`).join('')}</select>
          </div>
          <div class="field"><label for="fi-cost">${t('lbl_cost_unit')}</label><input id="fi-cost" type="number" step="0.01" value="${escapeHtml(draftItem.costPerUnit)}" placeholder="0.00"></div>
        </div>
        ${/* Precio de venta y % de ganancia: SOLO para quien el dueño lo permite
             (canSeeFinancials) — un miembro sin permiso ve costo y stock, pero no
             la ganancia. El save conserva el salePrice previo cuando el campo no
             se renderiza (ver el guard en app-07). */''}
        ${canSeeFinancials() ? `
        <div class="field-row" style="margin-bottom:0;">
          <div class="field" style="margin-bottom:0;"><label for="fi-sale-price">${t('lbl_sale_price')}</label><input id="fi-sale-price" type="number" step="0.01" value="${escapeHtml(draftItem.salePrice||'')}" placeholder="0.00"></div>
          <div class="field" style="margin-bottom:0;"><label id="fi-profit-label">${t('lbl_profit_pct')}</label>
            ${(()=>{
              const margin = profitMarginPct(draftItem.costPerUnit, draftItem.salePrice);
              const display = margin===null ? '—' : `${margin.toFixed(0)}%`;
              const color = margin===null ? 'var(--ink-soft)' : margin<0 ? 'var(--tomato)' : margin<15 ? 'var(--saffron)' : 'var(--basil)';
              return `<div id="fi-profit-display" role="status" aria-labelledby="fi-profit-label" style="padding:9px 11px;font-size:14px;font-weight:700;color:${color};">${display}</div>`;
            })()}
          </div>
        </div>` : ''}
      </div>

      <div class="settings-card">
        ${settingsCardHeader('printer','var(--saffron-soft)','var(--saffron-ink)',t('item_section_ids'))}
        <div class="field-row">
          <div class="field"><label for="fi-sku">${t('lbl_sku')}</label><input id="fi-sku" type="text" value="${escapeHtml(draftItem.sku||'')}" placeholder="${t('ph_sku_example')}"></div>
          <div class="field"><label for="fi-supplier">${t('lbl_item_supplier')}</label><input id="fi-supplier" type="text" value="${escapeHtml(draftItem.supplier||'')}" placeholder="${t('ph_supplier_example')}"></div>
        </div>
        <div class="field-row" style="margin-bottom:0;">
          <div class="field" style="margin-bottom:0;"><label for="fi-stock">${t('lbl_stock')}</label><input id="fi-stock" type="number" step="0.01" value="${escapeHtml(draftItem.qtyOnHand||0)}"></div>
          <div class="field" style="margin-bottom:0;"><label for="fi-capacity">${t('capacity_label')}</label><input id="fi-capacity" type="number" step="0.01" min="0" value="${escapeHtml(draftItem.capacityFull||'')}" placeholder="${t('ph_capacity_example')}"></div>
        </div>
        <div class="helper-note" style="margin:8px 0 0;">${t('capacity_helper')}</div>
      </div>

      <div class="helper-note">${t('item_helper')}</div>
      <div class="modal-actions">
        ${/* Eliminar vive ACÁ desde que las filas del inventario no tienen ✕:
             tocar el ítem abre esta ficha, y desde acá se edita o se borra. */''}
        ${editingItem ? `<button class="btn btn-ghost" id="btn-delete-item-modal" style="margin-right:auto;color:var(--tomato);">${t('btn_delete')}</button>` : ''}
        <button class="btn btn-ghost" id="btn-cancel-item">${t('btn_cancel')}</button>
        <button class="btn btn-primary" id="btn-save-item">${t('btn_save')}</button>
      </div>
    </div>
  </div>`;
}

/* ================= MODAL: CÓDIGO DE BARRAS ================= */
// La librería de lectura de código de barras (html5-qrcode) pesa lo suyo — se carga
// recién la primera vez que alguien toca "Código de barras", igual que Firebase con
// ensurePatronFirebaseReady() más arriba, así nadie que no use esto paga el costo.
let barcodeLibLoadPromise = null;
function ensureBarcodeLibReady(){
  if(barcodeLibLoadPromise) return barcodeLibLoadPromise;
  barcodeLibLoadPromise = loadExternalScript('https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js');
  return barcodeLibLoadPromise;
}
function openBarcodeScanModal(){
  if(!currentUser){
    // Igual que en openScanModal: cuenta real desconectada → login; si no, trial.
    if(everHadRealAccount()){
      ensurePatronFirebaseReady().catch(()=>{});
      openAuthModal(t('scan_requires_account'));
      return;
    }
    ensureTrialAccount().catch(()=>{});
  }
  barcodeScanState='scanning'; barcodeScanError='';
  showBarcodeScanModal=true; render();
  // render() de arriba ya puso el <div id="barcode-reader"> vacío en el DOM antes de
  // que esta promesa se resuelva (la carga del script es async, el render fue
  // sincrónico) — para cuando entramos acá, el elemento ya existe.
  ensureBarcodeLibReady().then(()=>{
    startBarcodeScanner();
  }).catch(()=>{
    barcodeScanState='error'; barcodeScanError=t('barcode_scan_camera_error'); render();
  });
}
function startBarcodeScanner(){
  const el = document.getElementById('barcode-reader');
  // Si el modal ya se cerró (el usuario tocó "Cancelar") mientras la librería
  // todavía estaba cargando, el div ya no existe — no arrancar la cámara para nada.
  if(!el || typeof Html5Qrcode==='undefined') return;
  barcodeScannerInstance = new Html5Qrcode('barcode-reader', {
    formatsToSupport: [
      Html5QrcodeSupportedFormats.EAN_13, Html5QrcodeSupportedFormats.EAN_8,
      Html5QrcodeSupportedFormats.UPC_A, Html5QrcodeSupportedFormats.UPC_E,
      Html5QrcodeSupportedFormats.CODE_128
    ],
    verbose: false
  });
  barcodeScannerInstance.start(
    { facingMode: 'environment' },
    { fps: 10, qrbox: { width: 260, height: 150 } },
    (decodedText)=>{ onBarcodeDetected(decodedText); },
    ()=>{} // "no se encontró ningún código en este cuadro" — pasa en CADA cuadro sin código, no es un error real
  ).catch(()=>{
    // Si start() nunca llegó a levantar cámara, no queda ningún <video> vivo que
    // proteger — hay que soltar la referencia ACÁ, si no el guard de render() de
    // arriba (que pospone redibujados mientras barcodeScannerInstance exista) deja
    // TODA la app trabada sin volver a redibujar nunca más, no solo este modal.
    barcodeScannerInstance = null;
    barcodeScanState='error'; barcodeScanError=t('barcode_scan_camera_error'); render();
  });
}
async function stopBarcodeScanner(){
  if(!barcodeScannerInstance) return;
  const instance = barcodeScannerInstance;
  barcodeScannerInstance = null;
  try{ await instance.stop(); }catch(e){}
  try{ instance.clear(); }catch(e){}
}
function closeBarcodeScanModal(){
  stopBarcodeScanner();
  showBarcodeScanModal=false; render();
}
// Se llama con cada código que la cámara logra leer — el guard de arriba evita
// procesar el mismo código varias veces seguidas mientras la librería sigue mandando
// cuadros antes de que la cámara termine de apagarse.
async function onBarcodeDetected(code){
  if(barcodeScanState!=='scanning' || !barcodeScannerInstance) return;
  // Se limpia la referencia YA MISMO (no se espera a que termine instance.stop(), que
  // es async) — el guard de render() de arriba pospone cualquier redibujado mientras
  // barcodeScannerInstance exista, así que si esperáramos acá el "Buscando el
  // producto…" de abajo jamás llegaría a pintarse hasta que la cámara termine de
  // apagarse del todo. La cámara igual se apaga en paralelo, sin bloquear la UI.
  const instance = barcodeScannerInstance;
  barcodeScannerInstance = null;
  barcodeScanState='looking'; render();
  try{ await instance.stop(); }catch(e){}
  try{ instance.clear(); }catch(e){}
  try{
    // Open Food Facts: base pública, sin API key, sin costo — cubre bien productos de
    // marca (sobre todo comida/bebida), pero no todo lo que un negocio pueda escanear
    // (insumos genéricos sin marca, por ejemplo). Si no está, se avisa y se completa a
    // mano — nunca se inventa un producto para un código que no se encontró.
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`);
    const data = await res.json();
    if(data && data.status===1 && data.product && (data.product.product_name || data.product.generic_name)){
      draftItem.name = data.product.product_name || data.product.generic_name;
      draftItem.sku = code;
      showBarcodeScanModal=false;
      barcodeScanState='scanning';
      render();
    } else {
      barcodeScanState='notfound'; render();
    }
  }catch(e){
    barcodeScanState='notfound'; render();
  }
}
function barcodeScanModal(){
  return `
  <div class="overlay" id="barcode-scan-overlay">
    <div class="modal">
      <h3 class="navy">${t('barcode_scan_title')}</h3>
      ${barcodeScanState==='scanning' ? `
        <div class="sub">${t('barcode_scan_hint')}</div>
        <div id="barcode-reader" style="border-radius:12px;overflow:hidden;margin:14px 0;background:#000;"></div>
      ` : ''}
      ${barcodeScanState==='looking' ? `<div class="scan-status"><div class="spinner"></div> ${t('barcode_scan_looking')}</div>` : ''}
      ${barcodeScanState==='notfound' ? `<div class="scan-error">⚠ ${t('barcode_not_found')}</div>` : ''}
      ${barcodeScanState==='error' ? `<div class="scan-error">⚠ ${barcodeScanError||t('barcode_scan_camera_error')}</div>` : ''}
      <div class="modal-actions">
        ${barcodeScanState==='notfound' ? `<button class="btn btn-ghost" id="btn-barcode-retry">${t('btn_retry_scan')}</button>` : ''}
        <button class="btn ${barcodeScanState==='notfound'?'btn-primary':'btn-ghost'}" id="btn-close-barcode-scan" style="flex:1;">${t('btn_cancel')}</button>
      </div>
    </div>
  </div>`;
}

/* ================= MODAL: CATEGORÍAS DE INVENTARIO ================= */
function openCategoriesModal(){
  draftCategories = categories.map(c=>({...c}));
  showCategoriesModal = true; render();
}
function closeCategoriesModal(){ showCategoriesModal=false; render(); }
// Confirmado el long-press (ver el pointerdown que llama a esto en attachEvents), la
// fila se levanta y sigue al dedo — mismo truco de reinserción en vivo en el DOM que
// attachCategoryChipDragHandlers ya usa para los chips del Dashboard (reordenar se
// SIENTE al arrastrar, no recién al soltar), solo que en vertical y sin re-basear tx
// contra un límite: acá no hay scroll propio que disputar, el límite es la lista misma.
// draftCategories NUNCA se toca mientras se arrastra — la reordenada real, leyendo el
// DOM (data-cat-id de cada fila), pasa una sola vez al soltar, junto con el único
// render() de todo el gesto.
function beginCategoryDrag(row, list, pointerId, startY){
  if(list) list.classList.add('reordering');
  row.classList.add('dragging');
  row.style.position = 'relative';
  row.style.zIndex = '5';
  let baseY = startY, ty = 0;
  function onMove(e){
    if(e.pointerId!==pointerId) return;
    e.preventDefault();
    ty += e.clientY - baseY;
    baseY = e.clientY;
    row.style.transform = `translateY(${ty}px)`;
    const visualTopBefore = row.getBoundingClientRect().top;
    const prev = row.previousElementSibling;
    const next = row.nextElementSibling;
    let moved = false;
    if(prev && prev.dataset && prev.dataset.catId){
      const r = prev.getBoundingClientRect();
      if(visualTopBefore < r.top + r.height/2){ list.insertBefore(row, prev); moved = true; }
    }
    if(!moved && next && next.dataset && next.dataset.catId){
      const rh = row.getBoundingClientRect().height;
      const r = next.getBoundingClientRect();
      if(visualTopBefore + rh > r.top + r.height/2){ list.insertBefore(row, next.nextElementSibling); moved = true; }
    }
    if(moved){
      // Mismo re-base que los chips: la fila cambió de posición NATURAL en el flujo al
      // reinsertarse — sin esto pegaría un salto seco hacia donde ahora "le toca" estar
      // antes de seguir al dedo.
      const naturalTopPlusOldTy = row.getBoundingClientRect().top;
      const naturalTopNew = naturalTopPlusOldTy - ty;
      ty = visualTopBefore - naturalTopNew;
      row.style.transform = `translateY(${ty}px)`;
    }
  }
  function onUp(e){
    if(e.pointerId!==pointerId) return;
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    document.removeEventListener('pointercancel', onUp);
    row.classList.remove('dragging');
    row.style.transform = ''; row.style.position = ''; row.style.zIndex = '';
    if(list) list.classList.remove('reordering');
    const domOrder = [...list.querySelectorAll('.category-edit-row[data-cat-id]')].map(r=>r.dataset.catId);
    const reordered = domOrder.map(id=>draftCategories.find(c=>c.id===id)).filter(Boolean);
    if(reordered.length===draftCategories.length) draftCategories = reordered;
    render();
  }
  document.addEventListener('pointermove', onMove, {passive:false});
  document.addEventListener('pointerup', onUp);
  document.addEventListener('pointercancel', onUp);
}
// Paleta puramente decorativa para las burbujas de categoría — a diferencia de
// --tomato/--basil/etc en el resto de la app, acá el color no significa nada
// (no es "alerta" ni "todo bien"), solo ayuda a distinguir una fila de otra
// de un vistazo y le da algo de vida a una lista que si no es puro texto plano.
const CATEGORY_BUBBLE_STYLES = [
  {bg:'var(--navy-wash)', fg:'var(--navy)'},
  {bg:'var(--sky-soft)', fg:'var(--sky-ink)'},
  {bg:'var(--saffron-soft)', fg:'var(--saffron-ink)'},
  {bg:'var(--basil-soft)', fg:'var(--basil-ink)'},
  {bg:'var(--tomato-soft)', fg:'var(--tomato-ink)'}
];
function categoriesModal(){
  return `
  <div class="overlay" id="categories-overlay">
    <div class="modal wide">
      <h3 class="navy" style="font-size:21px;">${t('categories_title')}</h3>
      <div class="sub">${t('categories_sub')}</div>
      <div class="category-edit-list" style="display:flex;flex-direction:column;gap:10px;margin:16px 0;">
        ${draftCategories.map((c,idx)=>{
          const style = CATEGORY_BUBBLE_STYLES[idx % CATEGORY_BUBBLE_STYLES.length];
          const initial = (c.name.trim()[0]||'?').toUpperCase();
          return `
          <div class="category-edit-row" data-cat-id="${c.id}">
            <div class="cat-bubble" style="background:${style.bg};color:${style.fg};">${escapeHtml(initial)}</div>
            <input type="text" data-category-name="${idx}" value="${escapeHtml(c.name)}" placeholder="${t('categories_new_placeholder')}">
            <button type="button" class="stock-row-x-btn" data-remove-category="${idx}" title="${t('btn_delete')}">✕</button>
          </div>`;
        }).join('')}
        ${draftCategories.length===0 ? `<div class="helper-note" style="margin:0;">${t('categories_empty')}</div>` : ''}
        <div class="category-edit-row add-row">
          <div class="cat-bubble" style="background:var(--navy-wash);color:var(--navy);font-size:22px;">+</div>
          <input type="text" id="new-category-name" placeholder="${t('categories_new_placeholder')}">
          <button type="button" class="btn btn-primary btn-sm" id="btn-add-category">${t('categories_add_btn')}</button>
        </div>
      </div>
      <div class="helper-note">${t('categories_helper')}</div>
      <div class="modal-actions">
        <button class="btn btn-ghost" id="btn-cancel-categories">${t('btn_cancel')}</button>
        <button class="btn btn-primary" id="btn-save-categories">${t('btn_save')}</button>
      </div>
    </div>
  </div>`;
}

/* ================= MODAL: ACTIVIDAD DEL INVENTARIO ================= */
function activityModal(){
  return `
  <div class="overlay" id="activity-overlay">
    <div class="modal">
      <h3 class="navy">${t('activity_modal_title')}</h3>
      ${activityLog.length===0 ? `
        <div class="empty-state" style="padding:30px 10px;">
          <div class="em-icon-badge">${lineIcon('clock',28)}</div>
          <div>${t('activity_empty')}</div>
        </div>
      ` : activityLog.map(a=>`
        <div class="activity-row">
          <div class="activity-row-by">${escapeHtml(a.by===currentUser.uid ? t('activity_you') : (a.byLabel||'?'))}</div>
          <div class="activity-row-what">${activityVerb(a)}</div>
          <div class="activity-row-when">${timeAgo(a.at)}</div>
        </div>
      `).join('')}
      <div class="modal-actions">
        <button class="btn btn-primary" id="btn-close-activity" style="width:100%;">${t('btn_close')}</button>
      </div>
    </div>
  </div>`;
}

/* ================= MODAL: COMPRA MANUAL ================= */
/* ================= MODAL: ESCANEAR RECIBO (lectura con Claude API vía Netlify Function) ================= */
function openScanModal(){
  // El escaneo le pega a la API de Claude y cuesta plata real cada vez que se usa —
  // a diferencia de cargar productos a mano (gratis, no toca ningún servidor), esto
  // necesita quedar atado a una cuenta identificable. Sin este chequeo, cualquiera que
  // encontrara la URL podía escanear recibos sin límite y sin haber iniciado sesión
  // nunca, y la factura de la API le llegaba igual al dueño de la app.
  if(!currentUser){
    // Dispositivo que ya tuvo cuenta real y está desconectado: login de siempre,
    // NUNCA el trial anónimo — forkearlo en silencio a una cuenta vacía hacía
    // "desaparecer" sus recibos e inventario (ver everHadRealAccount).
    if(everHadRealAccount()){
      ensurePatronFirebaseReady().catch(()=>{});
      openAuthModal(t('scan_requires_account'));
      return;
    }
    // Trial sin fricción: en vez de frenar con un login, se arranca una cuenta
    // anónima en segundo plano (ver ensureTrialAccount) y el modal de escaneo se
    // abre YA. La llamada real a la API (callReceiptReader) espera a que la cuenta
    // esté lista — para cuando el usuario terminó de sacar la foto, casi siempre
    // ya está. Si la creación falla (sin red), el propio flujo de escaneo muestra
    // su error de conexión de siempre.
    ensureTrialAccount().catch(()=>{});
  }
  scanRequestId++;
  scanState='idle'; scanImages=[]; scanImagesHiRes=[]; scanSourceFiles=[]; scanPageWarnings=[]; scanExtracted=[]; scanErrorMsg='';
  scanSupplier=''; scanDate=localDateStr(); scanInvoiceTotal=null;
  scanDuplicateOf=null; scanDuplicateConfirmed=false;
  resetScanBatchState();
  showScanModal=true; render();
}
function resetScanBatchState(){
  scanBatchMode=false; scanQueue=[]; scanQueueTotal=0; scanQueueIndex=0;
  scanQueueSkipped=0; scanQueueSaved=0; scanCurrentImages=null; scanBatchFailedPhotos=0;
}
function closeScanModal(){ scanRequestId++; showScanModal=false; render(); }

function scanModal(){
  return `
  <div class="overlay" id="scan-overlay">
    <div class="modal wide">
      <h3 class="sky">${t('scan_title')}</h3>
      <div class="sub">${t('scan_sub')}</div>

      ${scanState==='idle' && scanImages.length===0 ? `
        <div class="drop-zone" id="drop-zone">
          <div class="dz-icon">${lineIcon('camera',26)}</div>
          <div style="font-weight:600;font-size:13.5px;">${t('scan_tap_photo')}</div>
        </div>
        <button type="button" id="btn-scan-gallery" style="display:block;margin:-8px auto 16px;background:none;border:none;color:var(--sky-ink);font-size:12.5px;font-weight:600;cursor:pointer;padding:4px 8px;">${t('scan_upload_gallery_btn')}</button>
      ` : ''}
      <input type="file" id="receipt-file" accept="image/*" capture="environment" style="display:none;">
      <input type="file" id="receipt-file-gallery" accept="image/*" multiple style="display:none;">

      ${scanState==='idle' && scanImages.length>0 ? `
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px;">
          ${scanImages.map((img,idx)=>{
            const warning = scanPageWarnings[idx];
            return `
            <div style="position:relative;">
              <img src="data:${img.mediaType};base64,${img.base64}" alt="" style="width:92px;height:92px;object-fit:cover;border-radius:8px;border:1px solid ${warning?'var(--saffron)':'var(--line)'};display:block;">
              <button data-remove-scan-page="${idx}" title="${t('btn_remove_photo')}" style="position:absolute;top:-7px;right:-7px;width:22px;height:22px;border-radius:50%;background:var(--tomato);color:var(--on-accent);border:none;font-size:12px;line-height:1;cursor:pointer;">✕</button>
              ${warning ? `<div style="position:absolute;bottom:3px;left:3px;background:var(--saffron);color:var(--on-accent);font-size:12px;width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;" title="${t('scan_quality_'+warning)}">!</div>` : ''}
              <div style="text-align:center;font-size:10.5px;color:var(--ink-soft);margin-top:3px;">${t('scan_page')} ${idx+1}</div>
              ${warning ? `<div style="text-align:center;font-size:9.5px;color:var(--saffron-ink);max-width:92px;">${t('scan_quality_'+warning)}</div>` : ''}
            </div>
          `;
          }).join('')}
        </div>
        ${scanPageWarnings.some(w=>w) ? `<div class="helper-note" style="margin-top:-4px;">${t('scan_quality_hint')}</div>` : ''}
        <div class="scan-mode">
          <button data-scan-mode="pages" class="${scanBatchMode?'':'on'}">${t('scan_mode_pages')}</button>
          <button data-scan-mode="batch" class="${scanBatchMode?'on':''}">${t('scan_mode_batch')}</button>
        </div>
        <div class="helper-note" style="margin-top:-6px;">${scanBatchMode ? t('scan_mode_batch_hint') : t('scan_mode_pages_hint')}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:4px;">
          <button class="btn btn-ghost btn-sm" id="btn-add-scan-page">+ ${t(scanBatchMode?'scan_add_receipt':'scan_add_page')}</button>
          <button class="btn btn-primary btn-sm" id="btn-process-scan">${t('scan_read_btn')}</button>
        </div>
        <button type="button" id="btn-add-scan-gallery" style="display:block;background:none;border:none;color:var(--sky-ink);font-size:11.5px;font-weight:600;cursor:pointer;padding:2px 4px;margin:0 0 14px;">${t('scan_add_gallery_btn')}</button>
      ` : ''}

      ${scanState==='loading' ? (()=>{
        // En modo lote, scanCurrentImages tiene las fotos del recibo que se está
        // leyendo AHORA (la cola avanza de a uno); en modo normal van todas juntas.
        const animImg = (scanCurrentImages && scanCurrentImages[0]) || scanImages[0];
        return `
        ${animImg ? `
        <div class="scan-anim">
          <img src="data:${animImg.mediaType};base64,${animImg.base64}" alt="">
          <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i><i class="corner br"></i>
          <div class="beam"></div>
        </div>` : ''}
        <div class="scan-status"><div class="spinner"></div> ${t('scan_reading')}</div>`;
      })() : ''}
      ${scanState==='error' ? `<div class="scan-error">⚠ ${scanErrorMsg}</div>` : ''}
      ${scanState==='error' ? `<div class="helper-note" style="margin-top:-4px;">${t('scan_tip_manual')}</div>` : ''}

      ${scanState==='matched' && scanBatchMode && scanQueueTotal>0 ? `
        <div class="scan-queue-bar">
          <span>${t('batch_progress').replace('{n}', scanQueueIndex).replace('{total}', scanQueueTotal)}</span>
          <span class="dots">${Array.from({length:scanQueueTotal}, (_,i)=>`<i class="${i+1<scanQueueIndex?'done':i+1===scanQueueIndex?'now':''}"></i>`).join('')}</span>
        </div>
      ` : ''}

      ${scanState==='matched' ? `
        ${scanExtracted.length>0 && (scanExtracted.filter(i=>!i.qtyVerified).length/scanExtracted.length) > 0.4 ? `
        <div class="scan-error" style="background:var(--saffron-soft);color:var(--saffron-ink);">⚠ ${t('scan_low_confidence_hint')}</div>
        ` : ''}
        ${scanDuplicateOf ? `
        <div class="scan-error" style="background:var(--saffron-soft);color:var(--saffron-ink);">
          ⚠ ${uiLang==='en'
            ? `A receipt from <strong>${escapeHtml(scanDuplicateOf.supplier)||'this supplier'}</strong> already exists on ${escapeHtml(scanDuplicateOf.date)} for a similar total (${money(scanDuplicateOf.total)}). This could be the same receipt scanned twice.`
            : `Ya existe un recibo de <strong>${escapeHtml(scanDuplicateOf.supplier)||'este proveedor'}</strong> el ${escapeHtml(scanDuplicateOf.date)} por un total similar (${money(scanDuplicateOf.total)}). Podría ser el mismo recibo escaneado dos veces.`}
          <label style="display:flex;align-items:center;gap:6px;margin-top:8px;font-weight:600;font-size:12.5px;cursor:pointer;">
            <input type="checkbox" id="scan-dup-confirm" ${scanDuplicateConfirmed?'checked':''}> ${t('scan_dup_confirm_label')}
          </label>
        </div>` : ''}

        <div class="field-row">
          <div class="field"><label>${t('lbl_supplier')}</label><input id="scan-supplier" type="text" value="${escapeHtml(scanSupplier)}" placeholder="${t('ph_supplier_example')}"></div>
          <div class="field"><label>${t('lbl_date')}</label><input id="scan-date" type="date" value="${escapeHtml(scanDate)}"></div>
        </div>
        <div class="field">
          <label>${t('lbl_invoice_total')}</label>
          <input id="scan-invoice-total" type="number" step="0.01" value="${scanInvoiceTotal!==null?scanInvoiceTotal:''}" placeholder="${t('ph_invoice_total')}">
        </div>
        <div class="helper-note">${t('invoice_total_helper')}</div>

        ${(()=>{
          const increases = scanExtracted.filter(item=>{
            const ing = inventory.find(i=>i.id===item.matchedIngId);
            if(!ing || item.qty<=0 || ing.costPerUnit<=0) return false;
            const diff = ((item.totalPrice/item.qty - ing.costPerUnit)/ing.costPerUnit)*100;
            return diff>0.5;
          });
          if(increases.length===0) return '';
          const label = increases.length>1 ? `${increases.length} ${t('products_plural')}` : `1 ${t('product_singular')}`;
          const sentence = uiLang==='en'
            ? `<strong>${label}</strong> went up in price on this receipt vs. your current cost — review the details below before confirming`
            : `<strong>${label}</strong> subió de precio en este recibo vs. tu costo actual — revisa los detalles abajo antes de confirmar`;
          return `<div class="scan-error" style="background:var(--tomato-soft);color:var(--tomato-ink);">▲ ${sentence}</div>`;
        })()}

        <label style="display:block;font-size:12px;font-weight:600;color:var(--ink-soft);margin:6px 0 8px;">${t('lbl_detected_products')}</label>
        ${scanExtracted.map((item,idx)=>{
          const matchedIng = inventory.find(i=>i.id===item.matchedIngId);
          const isUnrecognized = item.matchedIngId==='__new__';
          let priceAlert = '';
          if(matchedIng && item.qty>0){
            // Antes esto comparaba item.totalPrice/item.qty (en la unidad que trae ESTE
            // recibo) directo contra matchedIng.costPerUnit (en la unidad que el
            // ingrediente venía usando) sin fijarse si son la misma unidad — un producto
            // que pasó de venderse por lb a venderse por caja mostraba subas de precio
            // de miles por ciento, que no eran un cambio de precio real sino libras
            // comparadas contra cajas. El resto de la app (lastPriceChangePct, el badge
            // del inventario, el gráfico de historial) ya exige "misma unidad" antes de
            // calcular un %; acá faltaba ese mismo chequeo.
            if(item.unit !== matchedIng.unit){
              const sentence = uiLang==='en'
                ? `Unit changed vs. your inventory (was ${escapeHtml(unitLabel(matchedIng.unit))}, this receipt says ${escapeHtml(unitLabel(item.unit))}) — price can't be compared directly. Cost per unit and quantity on hand will reset to the new unit when you confirm.`
                : `Cambió de unidad vs. tu inventario (antes ${escapeHtml(unitLabel(matchedIng.unit))}, este recibo dice ${escapeHtml(unitLabel(item.unit))}) — el precio no se puede comparar directamente. El costo por unidad y la cantidad en stock se reinician a la unidad nueva al confirmar.`;
              priceAlert = `<div style="font-size:11px;font-weight:700;color:var(--ink-soft);background:var(--bg);padding:6px 8px;border-radius:6px;margin-top:8px;">⚠ ${sentence}</div>`;
            } else {
            const newUnitCost = item.totalPrice/item.qty;
            const diffPct = matchedIng.costPerUnit>0 ? ((newUnitCost-matchedIng.costPerUnit)/matchedIng.costPerUnit)*100 : 0;
            if(diffPct>0.5){
              // Cualquier aumento de precio genera alerta — la severidad visual escala con el tamaño del aumento
              const strong = diffPct>=priceAlertThreshold;
              const sentence = uiLang==='en'
                ? `Supplier price went up ${diffPct.toFixed(0)}% vs. current cost (${money(matchedIng.costPerUnit)}/${escapeHtml(unitLabel(matchedIng.unit))} → ${money(newUnitCost)}/${escapeHtml(unitLabel(matchedIng.unit))})${strong?' — confirm the reading is correct':''}`
                : `Precio de proveedor subió ${diffPct.toFixed(0)}% vs. costo actual (${money(matchedIng.costPerUnit)}/${escapeHtml(unitLabel(matchedIng.unit))} → ${money(newUnitCost)}/${escapeHtml(unitLabel(matchedIng.unit))})${strong?' — confirma que la lectura sea correcta':''}`;
              priceAlert = `<div style="font-size:11px;font-weight:700;color:${strong?'var(--tomato-ink)':'var(--saffron)'};background:${strong?'var(--tomato-soft)':'var(--saffron-soft)'};padding:6px 8px;border-radius:6px;margin-top:8px;">▲ ${sentence}</div>`;
            } else if(diffPct<-0.5){
              const sentence = uiLang==='en'
                ? `Price went down ${Math.abs(diffPct).toFixed(0)}% vs. current cost (${money(matchedIng.costPerUnit)}/${escapeHtml(unitLabel(matchedIng.unit))} → ${money(newUnitCost)}/${escapeHtml(unitLabel(matchedIng.unit))})`
                : `Precio bajó ${Math.abs(diffPct).toFixed(0)}% vs. costo actual (${money(matchedIng.costPerUnit)}/${escapeHtml(unitLabel(matchedIng.unit))} → ${money(newUnitCost)}/${escapeHtml(unitLabel(matchedIng.unit))})`;
              priceAlert = `<div style="font-size:11px;font-weight:700;color:var(--basil);background:var(--basil-soft);padding:6px 8px;border-radius:6px;margin-top:8px;">▼ ${sentence}</div>`;
            }
            }
          }
          // Cantidad fuera de lo común vs. el promedio de compras anteriores de este
          // mismo ingrediente — necesita al menos 2 compras previas para tener una base
          // razonable (si no, cualquier primera compra se marcaría como "rara").
          let qtyAlert = '';
          if(matchedIng && item.qty>0){
            const pastQtys = purchases.filter(p=>p.ingId===item.matchedIngId && p.qty>0).map(p=>p.qty);
            if(pastQtys.length>=2){
              const avgQty = pastQtys.reduce((s,q)=>s+q,0)/pastQtys.length;
              const ratio = avgQty>0 ? item.qty/avgQty : 0;
              if(ratio>=2.5 || ratio<=0.4){
                const sentence = uiLang==='en'
                  ? `Unusual quantity: ${item.qty} ${escapeHtml(unitLabel(item.unit))} vs. your usual ~${avgQty.toFixed(1)} ${escapeHtml(unitLabel(item.unit))} — double check the reading`
                  : `Cantidad fuera de lo común: ${item.qty} ${escapeHtml(unitLabel(item.unit))} vs. tu promedio habitual de ~${avgQty.toFixed(1)} ${escapeHtml(unitLabel(item.unit))} — revisá que la lectura sea correcta`;
                qtyAlert = `<div style="font-size:11px;font-weight:700;color:var(--saffron-ink);background:var(--saffron-soft);padding:6px 8px;border-radius:6px;margin-top:8px;">⚠ ${sentence}</div>`;
              }
            }
          }
          const mergedNote = item.mergedCount>1 ? `<div style="font-size:11px;color:var(--ink-soft);margin-top:6px;">ℹ ${uiLang==='en' ? `Combined with ${item.mergedCount-1} similar line(s) from this same receipt` : `Combinado con ${item.mergedCount-1} línea(s) similares del mismo recibo`}</div>` : '';
          const confBorder = item.confidence==='baja' ? '1.5px solid var(--saffron)' : item.confidence==='media' ? '1.5px solid var(--sky)' : '1px solid var(--line)';
          // Bolita de color junto al nombre — mismo lenguaje visual que el resto de la
          // app (ícono en círculo de color): ámbar = todavía no existe en tu inventario,
          // verde = ya emparejado con un producto que ya tenés.
          const miIcon = `<span class="mi-icon" style="background:${isUnrecognized?'var(--saffron)':'var(--basil)'};">${lineIcon(isUnrecognized?'box':'chart',12)}</span>`;
          return `
          <div class="matched-item" style="${isUnrecognized?'border-color:color-mix(in srgb, var(--saffron) 40%, var(--panel));background:var(--saffron-soft);':''}">
            <div class="mi-top">
              ${miIcon}
              <input data-scan-name="${idx}" type="text" value="${escapeHtml(item.rawName)}" placeholder="${t('ph_product_name')}" style="flex:1;border:none;background:transparent;font-weight:700;color:var(--ink);font-size:13px;padding:2px 0;">
              <span style="display:flex;align-items:center;gap:8px;">
                ${money(item.totalPrice)}
                <button class="remove-x" data-remove-scan-item="${idx}" title="${t('title_remove_product')}">✕</button>
              </span>
            </div>
            ${isUnrecognized ? `<div style="font-size:11px;font-weight:700;color:var(--saffron-ink);margin-bottom:8px;">⚠ ${t('scan_unrecognized')}</div>` : ''}
            ${(()=>{
              // Dos decisiones explícitas (pedido del usuario): "ya está en mi
              // inventario" confirma el match y calla la alerta; "producto nuevo"
              // separa la línea. fuzzyConfirmed evita que la alerta reaparezca
              // tras confirmar.
              if(!item.fuzzySuggestedId || item.matchedIngId!==item.fuzzySuggestedId || item.fuzzyConfirmed) return '';
              const m = inventory.find(ing=>ing.id===item.fuzzySuggestedId);
              if(!m) return '';
              return `<div style="font-size:11px;font-weight:700;color:var(--saffron-ink);background:var(--saffron-soft);padding:7px 8px 8px;border-radius:6px;margin-bottom:8px;">⚠ ${t('scan_similar_note').replace('{name}', escapeHtml(m.name))}
                <div style="display:flex;gap:6px;margin-top:6px;">
                  <button type="button" class="btn btn-ghost btn-sm" data-scan-confirm-match="${idx}" style="flex:1;font-size:11px;padding:6px 4px;">${t('scan_opt_existing')}</button>
                  <button type="button" class="btn btn-ghost btn-sm" data-scan-make-new="${idx}" style="flex:1;font-size:11px;padding:6px 4px;">${t('scan_opt_new')}</button>
                </div></div>`;
            })()}
            ${item.confidence==='baja' ? `<div style="font-size:11px;font-weight:700;color:var(--saffron-ink);background:var(--saffron-soft);padding:5px 8px;border-radius:6px;margin-bottom:8px;">⚠ ${t('scan_qty_unverified')}</div>` : ''}
            ${item.confidence==='media' ? `<div style="font-size:11px;font-weight:700;color:var(--sky-ink);background:var(--sky-soft);padding:5px 8px;border-radius:6px;margin-bottom:8px;">ℹ ${t('scan_qty_review')}</div>` : ''}
            <div class="mi-fields">
              <select data-scan-match="${idx}" style="flex:2;">
                <option value="__new__" ${item.matchedIngId==='__new__'?'selected':''}>${t('opt_add_new_ing')}</option>
                <option value="__eatout__" ${item.matchedIngId==='__eatout__'?'selected':''}>${t('opt_eat_out')}</option>
                ${inventory.map(i=>`<option value="${i.id}" ${item.matchedIngId===i.id?'selected':''}>${escapeHtml(i.name)} (${escapeHtml(unitLabel(i.unit))})</option>`).join('')}
              </select>
              <input data-scan-qty="${idx}" type="number" step="0.01" value="${escapeHtml(item.qty)}" style="flex:1;border:${confBorder};" placeholder="${t('ph_qty_short')}">
              <select data-scan-unit="${idx}" style="flex:1;" title="${t('lbl_unit')}">${['lb','kg','oz','g','ml','l','unidad','caja','servicio'].map(u=>`<option value="${u}" ${item.unit===u?'selected':''}>${unitLabel(u)}</option>`).join('')}</select>
              <input data-scan-price="${idx}" type="number" step="0.01" value="${escapeHtml(item.totalPrice)}" style="flex:1;" placeholder="${t('ph_price_short')}">
            </div>
            ${isUnrecognized && categories.length>0 ? `
            <div class="field" style="margin-top:8px;">
              <label style="font-size:10.5px;">${t('lbl_category')}</label>
              <select data-scan-category="${idx}">
                <option value="">${t('category_none_option')}</option>
                ${categories.map(c=>`<option value="${c.id}" ${item.suggestedCategoryId===c.id?'selected':''}>${escapeHtml(c.name)}</option>`).join('')}
              </select>
              ${!item.suggestedCategoryId && !item.categoryTouched ? `<div style="font-size:11px;font-weight:700;color:var(--sky-ink);background:var(--sky-soft);padding:5px 8px;border-radius:6px;margin-top:6px;">ℹ ${t('scan_category_unsure')}</div>` : ''}
            </div>` : ''}
            ${priceAlert}
            ${qtyAlert}
            ${mergedNote}
          </div>`;
        }).join('')}
        ${scanExtracted.length===0 ? `<div style="font-size:12.5px;color:var(--ink-soft);padding:10px 2px;">${t('scan_no_products_left')}</div>` : ''}
        <button class="btn btn-ghost btn-sm" id="btn-add-scan-item" style="margin-top:4px;">${t('btn_add_product_manually')}</button>
        ${scanPayReminderHtml()}
      ` : ''}

      <div class="modal-actions">
        <button class="btn btn-ghost" id="btn-cancel-scan">${t(scanBatchMode && scanState==='matched' ? 'btn_finish_batch' : 'btn_cancel')}</button>
        ${scanState==='matched' && scanBatchMode ? `<button class="btn btn-ghost" id="btn-skip-queued">${t('btn_skip_receipt')}</button>` : ''}
        ${scanState==='matched' ? `<button class="btn btn-primary" id="btn-apply-scan" ${(scanExtracted.length===0 || (scanDuplicateOf && !scanDuplicateConfirmed)) ? 'disabled':''}>${t(scanBatchMode && scanQueue.length>0 ? 'btn_save_and_next' : 'btn_confirm_apply')}</button>` : ''}
        ${scanState==='error' ? `<button class="btn btn-primary" id="btn-retry-scan">${t('btn_retry_scan')}</button>` : ''}
      </div>
    </div>
  </div>`;
}

function loadImageFromFile(file){
  return new Promise((resolve,reject)=>{
    const reader = new FileReader();
    reader.onload = ()=>{
      const img = new Image();
      img.onload = ()=>resolve(img);
      img.onerror = ()=> reject(new Error(t('err_img_process')));
      img.src = reader.result;
    };
    reader.onerror = ()=> reject(new Error(t('err_img_read')));
    reader.readAsDataURL(file);
  });
}
/* Redimensiona/comprime una imagen ya cargada a un canvas y la devuelve en base64.
   Se usa dos veces por foto con ajustes distintos (ver addScanPage) — una vez no alcanza
   porque "que pese poco para guardar" y "que se lea bien en un recibo denso tipo factura
   de matriz de punto" son dos objetivos en tensión. */
function resizeToBase64(img, maxSide, quality){
  let {width, height} = img;
  if(width > maxSide || height > maxSide){
    const scale = maxSide / Math.max(width, height);
    width = Math.round(width*scale);
    height = Math.round(height*scale);
  }
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, width, height);
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  return {base64: dataUrl.split(',')[1], mediaType: 'image/jpeg'};
}

/* ================= ESCANEO DE PRODUCTOS EN LOTE =================
   "Armá tu inventario con una foto": una sola foto con varios productos a la
   vista (estante, mesa, alacena) → la IA identifica cada uno por separado →
   lista de confirmación editable → se agregan todos juntos al inventario.
   Es el camino para armar inventario SIN recibos y sin cargar uno a uno.
   Cuesta 1 escaneo del cupo por FOTO (no por producto), igual que un recibo. */

// La imagen original de la foto del lote se guarda acá (no en el estado global:
// un elemento <img> no es serializable ni le hace falta a render()) para poder
// recortar la miniatura de cada producto con la "box" que devuelve la IA.
let pbSourceImg = null;

// Recorta la zona de un producto (box en fracciones 0..1) con un poco de aire
// alrededor y la devuelve como miniatura — mismo tamaño/calidad que la foto que
// sube "Subir foto" a mano, así el ícono queda igual que el de un alta manual.
function cropToBase64(img, box, maxSide, quality){
  try{
    const pad = 0.08; // 8% de aire alrededor del recorte
    let x = (box.x - pad) * img.width;
    let y = (box.y - pad) * img.height;
    let w = (box.w + pad*2) * img.width;
    let h = (box.h + pad*2) * img.height;
    x = Math.max(0, Math.round(x)); y = Math.max(0, Math.round(y));
    w = Math.min(img.width - x, Math.round(w)); h = Math.min(img.height - y, Math.round(h));
    if(w < 20 || h < 20) return null; // recorte demasiado chico para servir de ícono
    const scale = Math.min(1, maxSide / Math.max(w, h));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w*scale); canvas.height = Math.round(h*scale);
    canvas.getContext('2d').drawImage(img, x, y, w, h, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    return {base64: dataUrl.split(',')[1], mediaType: 'image/jpeg'};
  }catch(e){
    return null; // sin miniatura no pasa nada: el producto entra sin foto
  }
}

// Hermana de identifyProductFromPhoto pero con multi:true — el servidor devuelve
// {products:[...]} con un objeto por producto detectado. Usa el núcleo compartido
// callDustyAI (era la CUARTA copia del plumbing que el refactor no había cubierto,
// y ya estaba divergiendo: no marcaba err.trialQuota).
async function identifyProductsFromPhoto(image){
  const parsed = await callDustyAI('/.netlify/functions/identify-product', {
    image: image,
    multi: true,
    categoryNames: categories.map(c=>c.name),
    // Para que la IA empareje cada producto detectado contra lo ya cargado
    // (matched_inventory_name) — es lo que permite que escanear UN producto
    // existente muestre su ficha en vez de ofrecer duplicarlo.
    inventoryNames: inventory.map(i=>i.name)
  }, {
    notFoundKey: 'err_function_not_found_product',
    genericKey: 'product_scan_error',
    onTrialQuota: ()=>{ closeProductBatchModal(); openUpgradeModal(t('trial_scans_over_note')); }
  });
  return Array.isArray(parsed.products) ? parsed.products : [];
}

function openProductBatchModal(){
  if(!currentUser){
    // Mismo trato que el escaneo de recibos: cuenta real desconectada → login;
    // si no, trial anónimo en segundo plano y el modal abre al instante.
    if(everHadRealAccount()){
      ensurePatronFirebaseReady().catch(()=>{});
      openAuthModal(t('scan_requires_account'));
      return;
    }
    ensureTrialAccount().catch(()=>{});
  }
  pbRequestId++;
  pbState='camera'; pbItems=[]; pbError=''; pbSourceImg=null; pbMatchedId=null;
  showProductBatchModal=true; render();
  startScannerCamera();
}
function closeProductBatchModal(){ pbRequestId++; stopScannerCamera(); showProductBatchModal=false; pbSourceImg=null; render(); }
// "Escanear otro": vuelve al visor sin cerrar el modal — para recorrer un estante
// identificando o cargando de a fotos.
function restartScannerCamera(){
  pbRequestId++;
  pbState='camera'; pbItems=[]; pbError=''; pbSourceImg=null; pbMatchedId=null;
  render();
  startScannerCamera();
}

// source: un canvas (cuadro capturado del <video>) o un Image (foto del input nativo/galería)
async function processProductBatchSource(source){
  const requestId = ++pbRequestId;
  stopScannerCamera();
  pbState='loading'; pbError=''; render();
  try{
    const image = resizeToBase64(source, 1400, 0.9);
    const products = await identifyProductsFromPhoto(image);
    // Si mientras la IA pensaba el usuario cerró el modal o disparó otra foto,
    // esta respuesta ya es vieja — se descarta sin tocar nada.
    if(requestId !== pbRequestId || !showProductBatchModal) return;
    pbSourceImg = source;
    pbItems = products.map(p=>{
      // Duplicados: primero el emparejamiento de la IA contra tu inventario
      // (matched_inventory_name — entiende marcas/abreviaturas), después la
      // coincidencia literal de nombre. Un duplicado arranca DESmarcado — el
      // objetivo del lote es armar inventario, no duplicarlo.
      const aiMatch = p.matched_inventory_name
        ? inventory.find(i=>i.name.trim().toLowerCase()===p.matched_inventory_name.trim().toLowerCase())
        : null;
      const dup = aiMatch || inventory.find(i=>i.name.trim().toLowerCase()===p.name.trim().toLowerCase());
      // La IA ahora puede PROPONER una categoría que el usuario no tiene (ve un
      // cable → "Cables"): si no matchea ninguna existente, viaja como sentinel
      // "__newcat__:<nombre>" — el select la muestra preseleccionada como nueva
      // y applyProductBatch la crea de verdad recién al confirmar.
      const catMatch = p.category ? categories.find(c=>c.name.trim().toLowerCase()===p.category.trim().toLowerCase()) : null;
      return {
        name: p.name,
        unit: ['lb','kg','oz','g','ml','l','unidad','caja','servicio'].includes(p.unit) ? p.unit : 'unidad',
        cost: typeof p.cost_per_unit==='number' ? p.cost_per_unit : '',
        // Cantidad en stock: la escribe el usuario en la revisión (la foto muestra
        // QUÉ es el producto, no cuánto hay en total) — vacío = 0, como antes.
        qty: '',
        sku: p.sku || '',
        categoryId: catMatch ? catMatch.id : (p.category && p.category.trim() ? '__newcat__:'+p.category.trim() : null),
        confidence: p.confidence || 'baja',
        photo: p.box ? cropToBase64(source, p.box, 300, 0.75) : null,
        selected: !dup,
        dupOfId: dup ? dup.id : null
      };
    });
    // UN solo producto y ya lo tenés → modo "¿qué es esto?": ficha del producto
    // existente con acceso directo, en vez de una lista de un solo renglón destildado.
    if(pbItems.length===1 && pbItems[0].dupOfId){
      pbMatchedId = pbItems[0].dupOfId;
      pbState = 'matched';
    } else {
      pbState = pbItems.length>0 ? 'review' : 'empty';
    }
    render();
  }catch(err){
    if(requestId !== pbRequestId) return;
    if(!showProductBatchModal) return; // el 429 del trial ya cerró este modal y abrió el suyo
    pbState='error'; pbError = err.message || t('product_scan_error');
    render();
  }
}

function applyProductBatch(){
  const chosen = pbItems.filter(it=>it.selected && it.name.trim());
  if(chosen.length===0) return;
  // Límite del trial: mismo criterio que el alta manual (openItemModal), pero
  // contando el lote entero antes de agregar nada — o entra todo, o se ofrece
  // guardar la cuenta; agregar "solo algunos" en silencio confundiría más.
  if(isTrialUser() && inventory.length + chosen.length > TRIAL_INVENTORY_LIMIT){
    closeProductBatchModal();
    openUpgradeModal(t('trial_inventory_limit_note'));
    return;
  }
  chosen.forEach(it=>{
    // Categoría propuesta por la IA que todavía no existe (sentinel
    // "__newcat__:<nombre>"): se crea DE VERDAD recién acá, al confirmar — y una
    // sola vez aunque varios productos del lote la compartan (el find la
    // encuentra en las siguientes vueltas).
    let categoryId = it.categoryId || null;
    if(typeof categoryId==='string' && categoryId.startsWith('__newcat__:')){
      const catName = categoryId.slice('__newcat__:'.length).trim();
      let cat = categories.find(c=>c.name.trim().toLowerCase()===catName.toLowerCase());
      if(!cat && catName){ cat = {id:uid('cat'), name:catName}; categories.push(cat); }
      categoryId = cat ? cat.id : null;
    }
    const item = {
      id: uid('i'), name: it.name.trim(), unit: it.unit,
      costPerUnit: parseFloat(it.cost)||0, updated:false,
      qtyOnHand: Math.max(0, parseFloat(it.qty)||0), photo: it.photo||null, salePrice: 0,
      stockFullRef: Math.max(0, parseFloat(it.qty)||0) || null,
      sku: (it.sku||'').trim(), supplier: '', categoryId: categoryId
    };
    if(currentUser){ item.lastEditedBy = currentUserLabel(); item.lastEditedAt = new Date().toISOString(); }
    inventory.push(item);
    logActivity('item_created', item.name);
  });
  saveState();
  closeProductBatchModal();
}

/* ================= VISOR DE FOTO DE PRODUCTO =================
   Tocar la miniatura de un producto CON foto la abre en grande (para reconocer
   el ítem cuando la miniatura no alcanza), con un menú mínimo arriba a la
   derecha — cambiar / quitar / cerrar — en botones chicos translúcidos, pedido
   del usuario: "elegante y no muy pronunciado". Sin foto, tocar la miniatura
   sigue abriendo el selector para subir una (promptItemPhotoUpload, app-07). */
let photoViewItemId = null;

function itemPhotoViewerModal(){
  const item = inventory.find(i=>i.id===photoViewItemId);
  const src = item && itemPhotoSrc(item);
  if(!item || !src){ photoViewItemId = null; return ''; }
  const icon = (paths)=>`<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
  return `
  <div class="overlay pv-overlay" id="photo-viewer-overlay">
    <div class="photo-viewer" role="dialog" aria-modal="true" aria-label="${escapeHtml(t('pv_photo_of').replace('{name}', item.name))}">
      <div class="pv-actions">
        <button type="button" class="pv-btn" id="pv-change" title="${t('pv_change')}" aria-label="${t('pv_change')}">${icon('<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>')}</button>
        <button type="button" class="pv-btn pv-btn-danger" id="pv-delete" title="${t('btn_remove_photo')}" aria-label="${t('btn_remove_photo')}">${icon('<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>')}</button>
        <button type="button" class="pv-btn" id="pv-close" title="${t('oc_close')}" aria-label="${t('oc_close')}">${icon('<path d="M18 6L6 18M6 6l12 12"/>')}</button>
      </div>
      <img src="${escapeHtml(src)}" alt="${escapeHtml(item.name)}">
      <div class="pv-caption">${escapeHtml(item.name)}</div>
    </div>
  </div>`;
}

/* ================= CÁMARA DEL ESCÁNER DE PRODUCTOS =================
   Un solo escáner hace TODO (pedido explícito del usuario: no sumar más botones
   al encabezado): sacás una foto y —
   - si hay UN producto y ya está en tu inventario → te muestra su ficha (stock/costo);
   - si hay varios, o es nuevo → lista de confirmación para agregarlos en lote.
   La cámara vive en un <video> manejado a mano (getUserMedia) — mismo trato que el
   lector de código de barras: mientras scannerCamStream exista, render() pospone
   redibujados (ver el guard en app-04-render.js) para no arrancarle el <video>. */
let scannerCamStream = null;

function stopScannerCamera(){
  if(!scannerCamStream) return;
  const s = scannerCamStream;
  scannerCamStream = null;
  try{ s.getTracks().forEach(tr=>tr.stop()); }catch(e){}
}

function startScannerCamera(){
  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
    // Sin getUserMedia (navegador viejo, contexto sin permisos): queda el respaldo
    // de la cámara nativa del sistema vía <input capture> — se dispara con el botón.
    return;
  }
  const requestId = pbRequestId;
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(stream=>{
    // Si el modal se cerró mientras el navegador pedía permiso, apagar y salir.
    const video = document.getElementById('pb-video');
    if(requestId !== pbRequestId || !showProductBatchModal || !video){
      try{ stream.getTracks().forEach(tr=>tr.stop()); }catch(e){}
      return;
    }
    scannerCamStream = stream;
    video.srcObject = stream;
    video.play().catch(()=>{});
  }).catch(()=>{
    // Permiso negado o sin cámara: el modal queda con la cámara nativa del sistema
    // (input capture) como único camino — no es un error.
    render();
  });
}

// Captura el cuadro actual del <video> como imagen — el "tap del obturador".
function captureScannerFrame(){
  const video = document.getElementById('pb-video');
  if(!video || !scannerCamStream || !video.videoWidth) return null;
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth; canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  return canvas;
}

function productBatchModal(){
  const selectedCount = pbItems.filter(it=>it.selected && it.name.trim()).length;
  const matchedItem = pbMatchedId ? inventory.find(i=>i.id===pbMatchedId) : null;
  return `
  <div class="overlay" id="product-batch-overlay">
    <div class="modal wide">
      <h3 class="sky">${t('pb_title')}</h3>

      ${pbState==='camera' ? `
        <div class="sub">${t('pb_sub')}</div>
        <div style="position:relative;border-radius:12px;overflow:hidden;background:#111;min-height:220px;display:flex;align-items:center;justify-content:center;">
          <video id="pb-video" autoplay playsinline muted style="width:100%;max-height:340px;object-fit:cover;display:block;"></video>
          <button id="btn-pb-capture" title="${t('ids_capture')}" style="position:absolute;bottom:14px;left:50%;transform:translateX(-50%);width:58px;height:58px;border-radius:50%;border:4px solid #fff;background:rgba(255,255,255,.25);cursor:pointer;"></button>
        </div>
        <div style="display:flex;justify-content:center;gap:14px;margin:10px 0 0;">
          <button type="button" id="btn-pb-native" style="background:none;border:none;color:var(--sky-ink);font-size:12.5px;font-weight:600;cursor:pointer;padding:6px 8px;">${t('ids_use_native_camera')}</button>
          <button type="button" id="btn-pb-gallery" style="background:none;border:none;color:var(--sky-ink);font-size:12.5px;font-weight:600;cursor:pointer;padding:6px 8px;">${t('scan_upload_gallery_btn')}</button>
        </div>
      ` : ''}
      <input type="file" id="pb-photo-file" accept="image/*" capture="environment" style="display:none;">
      <input type="file" id="pb-photo-file-gallery" accept="image/*" style="display:none;">

      ${pbState==='loading' ? `<div class="scan-status"><div class="spinner"></div> ${t('pb_loading')}</div>` : ''}
      ${pbState==='error' ? `<div class="scan-error">⚠ ${escapeHtml(pbError)}</div>` : ''}
      ${pbState==='empty' ? `<div class="scan-error">⚠ ${t('pb_none_found')}</div>` : ''}

      ${pbState==='matched' && matchedItem ? `
        <div class="helper-note" style="background:var(--basil-soft);color:var(--basil-ink);border-radius:8px;padding:10px 12px;margin-bottom:12px;font-weight:700;">✓ ${t('ids_found_in_inventory')}</div>
        <div class="matched-item">
          <div class="mi-top">
            ${matchedItem.photo ? `<img src="data:${matchedItem.photo.mediaType};base64,${matchedItem.photo.base64}" alt="" style="width:38px;height:38px;border-radius:8px;object-fit:cover;flex-shrink:0;">` : `<span class="mi-icon" style="background:var(--basil);">${lineIcon('box',12)}</span>`}
            <strong style="flex:1;">${escapeHtml(matchedItem.name)}</strong>
          </div>
          <div style="font-size:12.5px;color:var(--ink-soft);display:flex;gap:14px;flex-wrap:wrap;">
            <span>${t('ids_stock')}: <strong style="color:var(--ink);">${matchedItem.qtyOnHand||0} ${escapeHtml(unitLabel(matchedItem.unit))}</strong></span>
            <span>${t('ids_cost')}: <strong style="color:var(--ink);">${money(matchedItem.costPerUnit)}</strong></span>
          </div>
        </div>
      ` : ''}

      ${pbState==='review' ? `
        <div style="font-size:12.5px;color:var(--ink-soft);margin-bottom:10px;">${t('pb_review_hint').replace('{n}', pbItems.length)}</div>
        ${pbItems.map((it,idx)=>{
          const thumb = it.photo ? `<img src="data:${it.photo.mediaType};base64,${it.photo.base64}" alt="" style="width:34px;height:34px;border-radius:8px;object-fit:cover;flex-shrink:0;">`
                                 : `<span class="mi-icon" style="background:var(--sky);">${lineIcon('box',12)}</span>`;
          return `
          <div class="matched-item" style="${it.selected?'':'opacity:.55;'}${it.dupOfId?'border-color:color-mix(in srgb, var(--saffron) 40%, var(--panel));background:var(--saffron-soft);':''}">
            <div class="mi-top">
              <input data-pb-selected="${idx}" type="checkbox" ${it.selected?'checked':''} style="width:18px;height:18px;flex-shrink:0;accent-color:var(--navy);">
              ${thumb}
              <input data-pb-name="${idx}" type="text" value="${escapeHtml(it.name)}" placeholder="${t('ph_product_name')}" style="flex:1;border:none;background:transparent;font-weight:700;color:var(--ink);font-size:13px;padding:2px 0;min-width:0;">
            </div>
            ${it.dupOfId ? `<div style="font-size:11px;font-weight:700;color:var(--saffron-ink);margin-bottom:8px;">⚠ ${t('pb_already_in_inventory')}</div>` : ''}
            ${it.confidence==='baja' && !it.dupOfId ? `<div style="font-size:11px;font-weight:700;color:var(--saffron-ink);background:var(--saffron-soft);padding:5px 8px;border-radius:6px;margin-bottom:8px;">⚠ ${t('pb_low_confidence')}</div>` : ''}
            <div class="mi-fields">
              <select data-pb-unit="${idx}" style="flex:1;" title="${t('lbl_unit')}">${['lb','kg','oz','g','ml','l','unidad','caja','servicio'].map(u=>`<option value="${u}" ${it.unit===u?'selected':''}>${unitLabel(u)}</option>`).join('')}</select>
              <input data-pb-qty="${idx}" type="number" min="0" step="any" inputmode="decimal" value="${escapeHtml(it.qty)}" style="flex:1;" placeholder="${t('ph_qty_short')}" title="${t('lbl_stock')}">
              <input data-pb-cost="${idx}" type="number" step="0.01" value="${escapeHtml(it.cost)}" style="flex:1;" placeholder="${t('pb_cost_ph')}" title="${t('lbl_cost_unit')}">
              <select data-pb-category="${idx}" style="flex:1.4;">
                <option value="">${t('category_none_option')}</option>
                ${(it.categoryId||'').startsWith('__newcat__:') ? `<option value="${escapeHtml(it.categoryId)}" selected>＋ ${escapeHtml(it.categoryId.slice('__newcat__:'.length))} (${t('category_new_tag')})</option>` : ''}
                ${categories.map(c=>`<option value="${c.id}" ${it.categoryId===c.id?'selected':''}>${escapeHtml(c.name)}</option>`).join('')}
                <option value="__create__">＋ ${t('category_create_option')}</option>
              </select>
            </div>
            ${/* Crear la categoría acá mismo (pedido del usuario: "no me permite
                 añadir una categoría" en esta pantalla) — mismo patrón que la
                 ficha: elegir "crear" muestra este campo; Enter/blur la aplica. */''}
            <input data-pb-newcat="${idx}" type="text" maxlength="30" placeholder="${t('category_create_ph')}" style="display:none;margin-top:8px;width:100%;padding:7px 8px;border:1px solid var(--line);border-radius:7px;font-size:12.5px;background:var(--inset);color:var(--ink);">
            ${categories.length>0 && !it.categoryId && !it.categoryTouched && !it.dupOfId && it.selected ? `<div style="font-size:11px;font-weight:700;color:var(--sky-ink);background:var(--sky-soft);padding:5px 8px;border-radius:6px;margin-top:8px;">ℹ ${t('scan_category_unsure')}</div>` : ''}
          </div>`;
        }).join('')}
      ` : ''}

      <div class="modal-actions">
        <button class="btn btn-ghost" id="btn-cancel-pb">${t(pbState==='matched'||pbState==='review' ? 'btn_close' : 'btn_cancel')}</button>
        ${pbState==='review'||pbState==='matched'||pbState==='error'||pbState==='empty' ? `<button class="btn btn-ghost" id="btn-pb-again">${t('ids_scan_again')}</button>` : ''}
        ${/* "Producto nuevo": el match del escáner es por parecido y puede errar
             (cables 12-2 vs 14-3 vs 10-2 — se leen casi igual y son productos
             distintos, captura del usuario). Esta salida pasa al modo revisión
             con la línea destildada de duplicado, para agregarla aparte. */''}
        ${pbState==='matched' && matchedItem && pbItems.length===1 ? `<button class="btn btn-ghost" id="btn-pb-add-as-new">${t('scan_opt_new')}</button>` : ''}
        ${pbState==='matched' && matchedItem ? `<button class="btn btn-primary" id="btn-pb-open-item">${t('ids_open_item')}</button>` : ''}
        ${pbState==='review' ? `<button class="btn btn-primary" id="btn-apply-pb" ${selectedCount===0?'disabled':''}>${t('pb_add_btn').replace('{n}', selectedCount)}</button>` : ''}
      </div>
    </div>
  </div>`;
}

/* Chequeo rápido de calidad de foto, todo en el celular, antes de gastar una llamada a
   Claude — para avisar "esta foto se ve difícil de leer" ANTES de mandarla, no después.
   Es solo un aviso (no bloquea nada): mide oscuridad, poco contraste (típico de un flash
   que lava el papel) y foco/nitidez (con una varianza de Laplaciano, la forma clásica y
   liviana de estimar qué tan borrosa está una imagen sin librerías externas). */
function assessImageQuality(img){
  const S = 240;
  const canvas = document.createElement('canvas');
  canvas.width = S; canvas.height = S;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, S, S);
  const {data} = ctx.getImageData(0, 0, S, S);

  const gray = new Float32Array(S*S);
  for(let i=0;i<S*S;i++){
    gray[i] = 0.299*data[i*4] + 0.587*data[i*4+1] + 0.114*data[i*4+2];
  }

  let sum=0;
  for(let i=0;i<gray.length;i++) sum+=gray[i];
  const mean = sum/gray.length;
  let variance=0;
  for(let i=0;i<gray.length;i++) variance += (gray[i]-mean)*(gray[i]-mean);
  const stddev = Math.sqrt(variance/gray.length);

  let lapSum=0, lapSumSq=0, count=0;
  for(let y=1;y<S-1;y++){
    for(let x=1;x<S-1;x++){
      const idx = y*S+x;
      const lap = 4*gray[idx] - gray[idx-1] - gray[idx+1] - gray[idx-S] - gray[idx+S];
      lapSum += lap; lapSumSq += lap*lap; count++;
    }
  }
  const lapMean = lapSum/count;
  const sharpness = lapSumSq/count - lapMean*lapMean;

  if(mean < 85) return 'dark';
  if(sharpness < 100) return 'blurry';
  if(stddev < 15) return 'flat';
  return null;
}

/* Techo real de resolución del lector de recibos: 2576px de lado largo. Cualquier foto
   más grande que eso la reduce él solo antes de leerla, así que mandar más pixeles no
   sirve de nada — es el límite duro, no una preferencia. Antes se mandaba a 2000px, que
   dejaba ~29% de resolución sin usar: subirlo a 2576 es resolución gratis en cada
   escaneo, y donde más se nota es justo en lo que más costaba (facturas de mayorista
   con letra chica en muchas columnas, y recibos térmicos medio borrosos). */
const SCAN_MAX_SIDE_FOR_READING = 2576;
/* Pero la resolución no es gratis en el camino: el servidor que recibe las fotos tiene
   un tope de ~6MB por pedido, y a 2576px una foto de factura densa pesa ~1MB en base64
   (medido, no estimado) — 5 páginas llegaban a ~4.9MB, demasiado cerca del borde. Sin
   este presupuesto, subir la resolución habría roto justo los escaneos de varias
   páginas que hoy funcionan. La regla: una o dos páginas van a máxima resolución (el
   caso común, y donde más se nota); a partir de ahí se baja lo justo para que el total
   entre con margen. Siempre se manda lo más grande que quepa, nunca menos que antes. */
const SCAN_PAYLOAD_BUDGET_KB = 4200; // margen real bajo el tope de ~6MB del servidor
// Solo aplica al modo normal, donde todas las páginas van juntas en un mismo pedido.
// En modo lote cada foto va en su propio pedido — ver buildImagesForReading().
function bestSideForPageCount(pageCount){
  if(pageCount <= 2) return SCAN_MAX_SIDE_FOR_READING;
  if(pageCount === 3) return 2300;
  if(pageCount === 4) return 2100;
  return 2000; // 5 páginas: la resolución de siempre, que ya sabemos que entra
}

/* Agrega una página más al recibo que se está escaneando. De cada foto sale un par:
   - scanImages: copia liviana (1100px/calidad 0.75) — la que se guarda para siempre en
     el historial, pensada para que no llene el localStorage del navegador.
   - scanImagesHiRes: copia en máxima resolución útil (ver SCAN_MAX_SIDE_FOR_READING),
     solo para mandarle a leer — nunca se guarda, así que no pesa nada a largo plazo.
     Facturas viejas tipo matriz de punto con columnas chicas y apretadas (Sysco, US
     Foods) se leen mal si se manda solo la copia liviana — por eso la separación.
   Se puede llamar varias veces (una por página) antes de mandar todo junto a leer con
   processReceiptImage(). SIGUE EN USO por el flujo de Claude API — no está en el bloque
   de código viejo de más abajo aunque antes vivía ahí. */
async function addScanPage(file){
  try{
    const img = await loadImageFromFile(file);
    scanImages.push(resizeToBase64(img, 1100, 0.75));
    // La copia de máxima resolución se arma acá igual (así una sola página no paga
    // ningún trabajo extra al mandarla), pero si terminan siendo varias páginas se
    // vuelve a armar a la medida justa en processReceiptImage() — ver el presupuesto.
    scanImagesHiRes.push(resizeToBase64(img, SCAN_MAX_SIDE_FOR_READING, 0.92));
    scanSourceFiles.push(file);
    scanPageWarnings.push(assessImageQuality(img));
    scanState='idle';
    render();
  }catch(err){
    scanErrorMsg = err.message || t('err_img_process');
    scanState='error';
    render();
  }
}

/* Arma las fotos a mandar a leer con la mejor resolución que entre en el presupuesto del
   servidor (ver SCAN_PAYLOAD_BUDGET_KB). Empieza por la resolución ideal para esa cantidad
   de páginas y, si el total igual se pasa (fotos excepcionalmente detalladas), baja un
   escalón y vuelve a medir — el tamaño real se mide, nunca se estima. Si algo falla al
   re-codificar, se usa lo que ya había: peor mandar una copia menos afinada que no mandar
   nada. */
async function buildImagesForReading(){
  const pageCount = scanImages.length;
  if(pageCount === 0) return scanImages;
  // Una sola página ya quedó a máxima resolución al agregarla — nada que recalcular.
  if(pageCount === 1 && scanImagesHiRes.length === 1) return scanImagesHiRes;
  if(scanSourceFiles.length !== pageCount) {
    return scanImagesHiRes.length === pageCount ? scanImagesHiRes : scanImages;
  }
  /* En modo lote cada foto viaja SOLA en su propio pedido, así que el presupuesto del
     servidor se aplica por foto y no al total: las 5 pueden ir a máxima resolución sin
     importar cuántas sean. Y son justamente las que más resolución necesitan — varios
     tickets chicos se reparten los pixeles de una sola foto, así que cada uno queda con
     una fracción del detalle que tendría solo. En modo normal (páginas de un mismo
     recibo) sigue midiendo el total, porque ahí todas van juntas en un solo pedido. */
  const perRequest = scanBatchMode;
  const measureKB = perRequest
    ? (list)=> list.reduce((max, im)=> Math.max(max, im.base64.length/1024), 0)
    : (list)=> list.reduce((sum, im)=> sum + im.base64.length/1024, 0);
  try{
    const imgs = await Promise.all(scanSourceFiles.map(f=>loadImageFromFile(f)));
    let side = perRequest ? SCAN_MAX_SIDE_FOR_READING : bestSideForPageCount(pageCount);
    for(let attempt=0; attempt<4; attempt++){
      const built = imgs.map(img=>resizeToBase64(img, side, 0.92));
      if(measureKB(built) <= SCAN_PAYLOAD_BUDGET_KB || side <= 1400) return built;
      side = Math.round(side*0.85); // un escalón menos y se vuelve a medir
    }
    return imgs.map(img=>resizeToBase64(img, 1400, 0.92));
  }catch(err){
    console.error('[Dusty] no se pudo re-armar las fotos para leer, se usan las que ya estaban:', err);
    return scanImagesHiRes.length === pageCount ? scanImagesHiRes : scanImages;
  }
}

/* Núcleo COMPARTIDO de todas las llamadas de IA (leer recibos, identificar un
   producto, leer stock del estante): cuenta trial si hace falta → ID token de
   Firebase (prueba verificable de identidad; el servidor aplica el cupo por plan
   sobre syncUid(), la cuenta dueña del inventario) → fetch a la Netlify Function →
   parse → cupo/errores ya traducidos. Antes vivía copiado tres veces (acá dos, y
   readStockFromPhoto en app-08) y las copias ya estaban divergiendo en el manejo
   del 429 — cualquier cambio de auth/cupo/errores ahora se hace UNA sola vez.
   La API key de Claude vive solo en el servidor de Netlify, nunca en el navegador.
   opts.notFoundKey/genericKey: mensajes específicos del dominio.
   opts.onTrialQuota: qué hacer cuando una cuenta anónima agota el trial (cada
   llamador decide qué modal cerrar/abrir antes de ofrecer guardar la cuenta);
   con o sin callback, el Error tirado lleva .trialQuota = true. */
async function callDustyAI(path, body, opts){
  // Sin sesión todavía (primer escaneo de la vida): se espera acá a la cuenta
  // anónima del trial que quedó creándose en segundo plano al abrir el modal —
  // a esta altura el usuario ya sacó la foto, así que casi siempre ya está lista.
  if(!currentUser){
    try{ await ensureTrialAccount(); }
    catch(e){ throw new Error(t(e && e.code==='trial/real-account-exists' ? 'err_scan_auth_required' : 'err_scan_no_connection')); }
  }
  let idToken;
  try{
    idToken = await currentUser.getIdToken();
  }catch(tokenErr){
    throw new Error(t('err_scan_auth_required'));
  }
  let response;
  try{
    response = await fetch(path, {
      method: 'POST',
      headers: {'Content-Type':'application/json', 'Authorization':'Bearer '+idToken},
      body: JSON.stringify(Object.assign({ ownerUid: syncUid() }, body))
    });
  }catch(netErr){
    // Fallo de RED (el fetch nunca llegó a completarse — sin conexión, DNS, CORS).
    // Nunca un error del servidor, esos se manejan abajo. Confundirlos mandaba a
    // re-sacar la foto a gente cuyo problema era no tener señal.
    throw new Error(t('err_scan_no_connection'));
  }
  let parsed;
  try{
    parsed = await response.json();
  }catch(parseErr){
    // La función de Netlify no devolvió JSON — lo más probable es que no esté
    // publicada y el pedido cayó en una página de error genérica.
    throw new Error(t(opts.notFoundKey));
  }
  if(response.status===429 && parsed.quotaExceeded){
    if(currentUser && currentUser.isAnonymous){
      // Cupo del TRIAL agotado: en vez de un error seco, el llamador puede abrir
      // el modal de "guardá tu cuenta" — el momento exacto en que el usuario ya
      // vio el valor de la app y tiene un motivo concreto para registrarse.
      if(opts.onTrialQuota) opts.onTrialQuota();
      const err = new Error(t('trial_scans_over_note'));
      err.trialQuota = true;
      throw err;
    }
    throw new Error(t('err_scan_quota_exceeded'));
  }
  if(!response.ok || parsed.error){
    // Código estable → mensaje traducido al idioma de la UI. El texto crudo del
    // servidor (español fijo, o el error técnico en inglés de la API de Claude)
    // queda solo como último recurso para servidores viejos sin código.
    if(parsed && parsed.code && I18N.en['srv_'+parsed.code]){
      throw new Error(t('srv_'+parsed.code));
    }
    throw new Error(parsed.error || t(opts.genericKey));
  }
  return parsed;
}

/* Lee un grupo de fotos como recibo(s). Con multi=false son páginas de UN mismo
   documento y devuelve un recibo; con multi=true es una mesa con varios recibos
   apoyados y devuelve {receipts:[...]}. */
async function callReceiptReader(images, multi){
  return callDustyAI('/.netlify/functions/extract-receipt', {
    images: images,
    multi: multi===true ? true : undefined,
    // Nombres del inventario actual para que Claude empareje cada producto de la
    // factura contra lo ya cargado con su propio criterio (abreviaturas, códigos
    // de proveedor). "caseTrackedNames": productos llevados por caja — para esos
    // no hay que desarmar el tamaño de paquete del recibo.
    inventoryNames: inventory.map(i=>i.name),
    caseTrackedNames: inventory.filter(i=>i.unit==='caja').map(i=>i.name),
    // Para sugerir a qué categoría del usuario pertenece cada producto nuevo.
    categoryNames: categories.map(c=>c.name)
  }, {
    notFoundKey: 'err_function_not_found',
    genericKey: 'err_generic_receipt',
    onTrialQuota: ()=>{ closeScanModal(); openUpgradeModal(t('trial_scans_over_note')); }
  });
}

/* Hermana de callReceiptReader() pero para UNA foto de un producto físico — misma
   cuenta, mismo cupo mensual, mismos errores traducidos. */
async function identifyProductFromPhoto(image){
  return callDustyAI('/.netlify/functions/identify-product', {
    image: image,
    categoryNames: categories.map(c=>c.name),
    // matched_inventory_name: el identificador por cámara lo usa para abrir directo
    // el producto existente; el formulario de alta simplemente lo ignora.
    inventoryNames: inventory.map(i=>i.name)
  }, {
    notFoundKey: 'err_function_not_found_product',
    genericKey: 'product_scan_error',
    onTrialQuota: ()=>{ openUpgradeModal(t('trial_scans_over_note')); }
  });
}

async function processReceiptImage(){
  if(scanImages.length===0) return;
  const requestId = scanRequestId;
  scanState='loading';
  scanErrorMsg='';
  render();
  try{
    const imagesToRead = await buildImagesForReading();
    // El modal se pudo haber cerrado/reiniciado (nuevo escaneo) mientras esperábamos
    // la respuesta de Claude — aplicar esos datos ahora pisaría la foto nueva que el
    // usuario ya está mirando. Se descarta en silencio, no es un error real.
    if(requestId!==scanRequestId) return;
    if(scanBatchMode){
      await processReceiptBatch(imagesToRead, requestId);
      return;
    }
    // Modo normal: todas las páginas juntas, como un solo documento.
    const parsed = await callReceiptReader(imagesToRead, false);
    if(requestId!==scanRequestId) return;
    if(!Array.isArray(parsed.items) || parsed.items.length===0){
      throw new Error(t('err_no_text'));
    }

    applyParsedReceiptToScanState(parsed);
    scanState='matched';
    render();
  }catch(err){
    if(requestId!==scanRequestId) return;
    scanErrorMsg = err.message || t('err_generic_receipt');
    scanState='error';
    render();
  }
}

/* Modo lote: cada foto se lee por separado (una llamada por foto, en paralelo) y puede
   traer varios recibos. Se lee foto por foto a propósito, en vez de mandar las 5 juntas:
   cada llamada queda chica y rápida, y si una foto sale mal solo se pierde esa —
   las demás siguen. Todo lo encontrado se acomoda en una cola que después pasa de a
   uno por la pantalla de confirmación de siempre. */
async function processReceiptBatch(imagesToRead, requestId){
  const results = await Promise.all(imagesToRead.map(async (img, idx)=>{
    try{
      const parsed = await callReceiptReader([img], true);
      const list = Array.isArray(parsed.receipts) ? parsed.receipts : (Array.isArray(parsed.items) ? [parsed] : []);
      return {idx, list};
    }catch(err){
      console.error('[Dusty] no se pudo leer la foto '+(idx+1)+' del lote:', err);
      return {idx, list:null, err};
    }
  }));
  // Mismo chequeo que processReceiptImage(): si el modal se cerró/reinició mientras
  // las 5 fotos del lote se leían en paralelo, no metemos esos resultados obsoletos
  // en la cola del escaneo nuevo.
  if(requestId!==scanRequestId) return;

  scanQueue = [];
  scanBatchFailedPhotos = 0;
  let lastError = '';
  results.forEach(res=>{
    if(res.list===null){
      scanBatchFailedPhotos++;
      lastError = (res.err && res.err.message) || '';
      return;
    }
    res.list.forEach(receipt=>{
      if(!receipt || !Array.isArray(receipt.items) || receipt.items.length===0) return;
      // Cada recibo se queda con la foto de la que salió, así el registro guardado
      // muestra la foto correcta y no las 5 del lote.
      scanQueue.push({parsed: receipt, images: scanImages[res.idx] ? [scanImages[res.idx]] : scanImages.slice()});
    });
  });

  if(scanQueue.length===0){
    throw new Error(lastError || t('err_no_text'));
  }

  scanQueueTotal = scanQueue.length;
  scanQueueIndex = 0;
  scanQueueSkipped = 0;
  scanQueueSaved = 0;
  loadNextQueuedReceipt();
  render();
}

/* Saca el próximo recibo de la cola y lo carga en la pantalla de confirmación.
   Devuelve false si ya no queda ninguno. */
function loadNextQueuedReceipt(){
  if(scanQueue.length===0) return false;
  const next = scanQueue.shift();
  scanQueueIndex++;
  scanCurrentImages = next.images || null;
  applyParsedReceiptToScanState(next.parsed);
  scanState='matched';
  return true;
}

/* "Saltear este" — descarta el recibo que se está confirmando sin guardar nada.
   Sirve cuando el lector partió mal una foto o cuando ese recibo ya estaba cargado. */
function skipQueuedReceipt(){
  scanQueueSkipped++;
  if(!loadNextQueuedReceipt()){
    finishScanBatch();
    return;
  }
  render();
}

/* Se llegó al final de la cola: cierra el escáner y, si hubo algo que contar
   (recibos salteados o fotos que no se pudieron leer), lo avisa. */
function finishScanBatch(){
  const saved = scanQueueSaved, skipped = scanQueueSkipped, failed = scanBatchFailedPhotos;
  closeScanModal();
  if(skipped>0 || failed>0){
    const parts = [t('batch_done_saved').replace('{n}', saved)];
    if(skipped>0) parts.push(t('batch_done_skipped').replace('{n}', skipped));
    if(failed>0) parts.push(t('batch_done_failed').replace('{n}', failed));
    showToast(parts.join('\n'), 'info');
  }
}

/* Toma un recibo tal como lo devolvió el lector y lo carga en la pantalla de confirmación
   (proveedor, fecha, total, productos emparejados con el inventario, aviso de duplicado).
   Se extrajo de processReceiptImage() sin cambiarle nada para poder reusarla tal cual con
   cada recibo del modo "varios recibos" — así los recibos de un lote pasan exactamente por
   el mismo camino ya probado que un recibo suelto, incluidas todas las alertas. */
function applyParsedReceiptToScanState(parsed){
    scanSupplier = parsed.supplier || '';
    // Cada recibo nuevo (incluido cada uno de la cola en modo lote) arranca con la
    // oferta de recordatorio de pago pre-marcada — es POR recibo, no una preferencia
    // global: desmarcarla en la boleta de luz no debe apagarla para la de internet.
    scanPayReminder = true;
    // La fecha la lee la IA de la foto: si no es una YYYY-MM-DD real, se usa la de hoy en
    // vez de guardar basura (que además rompería monthKey y el orden por fecha, y —sin el
    // escape que ya agregamos en las vistas— sería un vector de XSS almacenado).
    scanDate = isValidDateStr(parsed.date) ? parsed.date : localDateStr();
    scanInvoiceTotal = typeof parsed.invoice_total==='number' ? parsed.invoice_total : (parseFloat(parsed.invoice_total)||null);
    // Solo se procesan items que sean objetos de verdad — un null o un string en el array
    // (IA con salida rara, o respuesta manipulada) haría explotar el forEach de abajo.
    const parsedItems = Array.isArray(parsed.items) ? parsed.items.filter(it=>it && typeof it==='object') : [];

    // Antes de mapear, combina líneas de este mismo recibo que Claude marcó como el
    // mismo producto NUEVO repetido (ej. una línea por caja y otra por el reempaque
    // en unidades sueltas) — así no se crean dos ingredientes nuevos separados para
    // lo que en realidad es un solo producto. Nunca combina productos que ya matchean
    // con el inventario existente (esos siempre quedan como líneas propias).
    const mergedItems = [];
    const originalIdxToMergedIdx = new Map();
    parsedItems.forEach((it, idx)=>{
      const dupIdx = typeof it.duplicate_of==='number' ? it.duplicate_of : null;
      // originalIdxToMergedIdx guarda a qué entrada de mergedItems fue a parar CADA
      // índice original, se haya fusionado o no (antes solo se guardaba el de los que
      // quedaban como entrada propia). Así una cadena de duplicados de 3+ pasos
      // (C duplicado de B, y B a su vez duplicado de A) resuelve bien: al procesar C,
      // dupIdx=B ya apunta a la entrada de A donde B mismo terminó fusionado, en vez
      // de a un hueco vacío — sin esto, B "desaparecía" del mapa y C se creaba como
      // producto nuevo separado en lugar de sumarse a A.
      const targetMergedIdx = (dupIdx!==null && !it.matched_inventory_name) ? originalIdxToMergedIdx.get(dupIdx) : undefined;
      const target = targetMergedIdx!==undefined ? mergedItems[targetMergedIdx] : null;
      if(target){
        target.quantity = (typeof target.quantity==='number'?target.quantity:parseFloat(target.quantity)||0) + (typeof it.quantity==='number'?it.quantity:parseFloat(it.quantity)||0);
        target.total_price = (typeof target.total_price==='number'?target.total_price:parseFloat(target.total_price)||0) + (typeof it.total_price==='number'?it.total_price:parseFloat(it.total_price)||0);
        target._mergedCount = (target._mergedCount||1) + 1;
        originalIdxToMergedIdx.set(idx, targetMergedIdx);
      } else {
        mergedItems.push(Object.assign({}, it));
        originalIdxToMergedIdx.set(idx, mergedItems.length-1);
      }
    });

    scanExtracted = mergedItems.map(it=>{
      // "clean_name" es el nombre lindo que arma Claude a partir de la descripción cruda
      // del proveedor (soporta abreviaturas/códigos). Si la función no lo manda todavía
      // (versión vieja del servidor), cae de vuelta al campo "name" de antes.
      const displayName = it.clean_name || it.name || t('fallback_no_product_name');
      const nameLower = displayName.toLowerCase().trim();
      let matchedId = null;
      // 1. Prioridad: Claude ya nos dice a qué ingrediente existente corresponde
      //    (le mandamos tu inventario y usa su propio criterio, no comparación literal)
      if(it.matched_inventory_name){
        const byName = inventory.find(ing=>ing.name.toLowerCase().trim()===it.matched_inventory_name.toLowerCase().trim());
        if(byName) matchedId = byName.id;
      }
      // 2. Si no vino o no calzó con nada real, alias aprendido de una corrección manual anterior
      if(!matchedId && aliasMap[nameLower] && inventory.some(ing=>ing.id===aliasMap[nameLower])){
        matchedId = aliasMap[nameLower];
      }
      // 3. Última red de seguridad: coincidencia por texto contenido (el método viejo)
      if(!matchedId){
        const existing = inventory.find(ing=> nameLower.includes(ing.name.toLowerCase()) || ing.name.toLowerCase().includes(nameLower));
        matchedId = existing ? existing.id : '__new__';
      }
      // Categoría sugerida por Claude a partir de las categorías del usuario (ver
      // categoryNames en callReceiptReader) — solo se usa para productos NUEVOS
      // (ver applyScanResults), nunca para pisar la categoría que el usuario ya le
      // haya puesto a mano a un producto existente.
      let suggestedCategoryId = null;
      if(it.category){
        const catMatch = categories.find(c=>c.name.toLowerCase().trim()===String(it.category).toLowerCase().trim());
        if(catMatch) suggestedCategoryId = catMatch.id;
      }
      const itemUnit = it.unit || 'unidad';
      // Un producto puede empezar a comprarse en una unidad distinta con el tiempo
      // (antes por lb, ahora por caja) sin dejar de ser "el mismo producto" para
      // Claude/el alias/la búsqueda por texto — los tres métodos de arriba matchean
      // por NOMBRE, nunca miran la unidad. Si lo que encontraron está en una unidad
      // distinta a la de este recibo, no lo reusamos tal cual (eso mezclaría o
      // pisaría esa otra modalidad, como pasaba antes) — buscamos si ya existe una
      // fila hermana con el mismo nombre en la unidad correcta, y si no existe,
      // dejamos que se cree como producto nuevo (newIngName abajo hace que esa fila
      // nueva se llame igual que la original, para que quede claro que es el mismo
      // producto en otra presentación: "Cebolla roja (lb)" y "Cebolla roja (caja)").
      let newIngName = null;
      if(matchedId && matchedId!=='__new__'){
        const candidate = inventory.find(ing=>ing.id===matchedId);
        if(candidate && candidate.unit!==itemUnit){
          const sibling = inventory.find(ing=> ing.id!==candidate.id
            && ing.name.toLowerCase().trim()===candidate.name.toLowerCase().trim()
            && ing.unit===itemUnit);
          if(sibling){
            matchedId = sibling.id;
          } else {
            matchedId = '__new__';
            newIngName = candidate.name;
          }
        }
      }
      // Match "por parecido": el emparejado quedó apuntando a un producto cuyo
      // nombre NO es idéntico al de esta línea (vino de la IA, de un alias o del
      // texto contenido). Productos que se leen parecido pero SON distintos
      // (pedido del usuario) — la fila muestra una alerta con salida de un toque:
      // "es otro producto, agregarlo aparte". Nombre idéntico = mismo producto,
      // sin ruido. Se guarda el id sugerido: si el usuario cambia el select a
      // mano, la alerta ya no corresponde y desaparece sola.
      let fuzzySuggestedId = null;
      if(matchedId && matchedId!=='__new__'){
        const m = inventory.find(ing=>ing.id===matchedId);
        if(m && m.name.toLowerCase().trim() !== nameLower) fuzzySuggestedId = matchedId;
      }
      // Consumo del momento (café, almuerzo — la IA lo marca con eat_out): arranca
      // en "☕ Eat out": gasto real, pero sin entrar al stock. El usuario puede
      // cambiarlo en el select como cualquier línea. Excepción: si un alias
      // aprendido ya lo apunta a un producto suyo, se respeta esa corrección.
      if(it.eat_out && !(aliasMap[nameLower] && inventory.some(ing=>ing.id===aliasMap[nameLower]))){
        matchedId = '__eatout__'; newIngName = null; fuzzySuggestedId = null;
      }
      return {
        rawName: displayName,
        qty: typeof it.quantity==='number' ? it.quantity : parseFloat(it.quantity)||0,
        totalPrice: typeof it.total_price==='number' ? it.total_price : parseFloat(it.total_price)||0,
        unit: itemUnit,
        matchedIngId: matchedId,
        fuzzySuggestedId: fuzzySuggestedId,
        newIngName: newIngName,
        suggestedCategoryId: suggestedCategoryId,
        // "confidence" tal cual la reporta Claude (alta/media/baja) para distinguir en
        // la pantalla de confirmación qué tan segura está cada línea. qtyVerified se
        // mantiene como antes (solo baja cuenta como "no verificado") para no tocar el
        // banner agregado de "esta lectura tiene mucha incertidumbre".
        confidence: it.confidence || 'alta',
        qtyVerified: it.confidence !== 'baja',
        mergedCount: it._mergedCount || 1
      };
    });

    // Detección de posible recibo duplicado: mismo proveedor + fecha + total aproximado.
    // Preferimos el total impreso de la factura (más confiable) y si no vino, la suma
    // de las líneas leídas — el mismo criterio que se usa para guardar el recibo.
    const compareTotal = scanInvoiceTotal!==null ? scanInvoiceTotal : scanExtracted.reduce((s,it)=>s+it.totalPrice,0);
    scanDuplicateOf = receipts.find(r=>
      (r.supplier||'').trim().toLowerCase()===(scanSupplier||'').trim().toLowerCase() &&
      r.date===scanDate &&
      Math.abs(r.total-compareTotal)<0.5
    ) || null;
    scanDuplicateConfirmed = false;
}

/* Fase 2 Nudgy: ¿este escaneo es un recibo de servicio, y ya existe (o no) un
   recordatorio mensual para este proveedor? La IA marca los servicios con un único
   item de unidad "servicio" (ver el prompt en netlify/functions/extract-receipt.js),
   así que la detección es leer eso — sin heurísticas de nombres acá. El "ya existe"
   se decide por paySupplierKey (proveedor normalizado) guardado en la nota: escanear
   la boleta de luz del mes que viene no debe crear un segundo recordatorio igual. */
function scanServiceInfo(){
  const svc = scanExtracted.find(it=>it && it.unit==='servicio');
  if(!svc) return null;
  const supplier = (scanSupplier||'').trim();
  const key = (supplier || svc.rawName || '').toLowerCase().trim();
  const existing = key ? calNotes.find(n=>n.paySupplierKey===key && n.recurring) : null;
  return {supplier: supplier || (svc.rawName||''), key, existing};
}
function scanPayReminderHtml(){
  const info = scanServiceInfo();
  if(!info || !info.key) return '';
  if(info.existing){
    return `<div class="status-pill-success" style="margin:10px 0 0;">✓ ${t('scan_pay_reminder_exists').replace('{s}', escapeHtml(info.supplier))}</div>`;
  }
  const day = parseInt(scanDate.slice(8,10),10);
  return `
  <label class="scan-pay-reminder">
    <input type="checkbox" id="scan-pay-reminder" ${scanPayReminder?'checked':''}>
    <span>
      <span class="spr-title">🔔 ${t('scan_pay_reminder_label')}</span>
      <span class="spr-sub">${t('scan_pay_reminder_sub').replace('{d}', day)}</span>
    </span>
  </label>`;
}

function applyScanResults(){
  if(scanDuplicateOf && !scanDuplicateConfirmed) return; // seguridad extra, el botón ya debería estar deshabilitado
  // La info de servicio se captura ANTES del forEach de abajo — después de guardar,
  // partes del estado del escaneo ya pueden haber rotado (modo lote).
  const payInfo = scanServiceInfo();

  const appliedItems = [];
  const createdPurchaseIds = [];
  scanExtracted.forEach(item=>{
    if(item.qty<=0 || item.totalPrice<=0 || !item.rawName || !item.rawName.trim()) return;
    let ingId = item.matchedIngId;
    let ingName = '';
    if(ingId==='__eatout__'){
      // Consumo del momento (café, almuerzo): cuenta como GASTO (el recibo entero
      // ya va al gasto por su total) y deja historial de compras, pero NUNCA toca
      // el stock ni el valor del inventario (regla del usuario: gasto e inventario
      // no se contaminan). Vive como producto expenseOnly en la categoría
      // automática "Eat out" — se crea sola la primera vez.
      let eatCat = categories.find(c=>c.name.trim().toLowerCase()==='eat out');
      if(!eatCat){ eatCat = {id:uid('cat'), name:t('eat_out_category')}; categories.push(eatCat); }
      let ing = inventory.find(i=>i.expenseOnly && i.name.trim().toLowerCase()===item.rawName.trim().toLowerCase());
      if(!ing){
        ing = {id:uid('i'), name:item.rawName, unit:item.unit||'unidad', costPerUnit:item.totalPrice/item.qty,
          updated:false, qtyOnHand:0, expenseOnly:true, categoryId:eatCat.id};
        if(currentUser){ ing.lastEditedBy = currentUserLabel(); ing.lastEditedAt = new Date().toISOString(); }
        inventory.push(ing);
      } else {
        ing.costPerUnit = item.totalPrice/item.qty;
      }
      ingId = ing.id;
      ingName = ing.name;
    } else if(ingId==='__new__'){
      // newIngName viene seteado cuando esta fila "nueva" en realidad es una modalidad
      // distinta de un producto que YA existe en otra unidad (ver
      // applyParsedReceiptToScanState) — en ese caso usamos el nombre del producto
      // original, no el texto crudo de esta línea del recibo, para que ambas filas
      // se lean como "el mismo producto, unidad distinta" (ej. "Cebolla roja" en lb
      // y en caja) y no como dos productos sin relación aparente.
      const newIng = {id:uid('i'), name:item.newIngName||item.rawName, unit:item.unit||'unidad', costPerUnit:item.totalPrice/item.qty, updated:true, qtyOnHand:item.qty, stockFullRef:item.qty, categoryId:item.suggestedCategoryId||null};
      if(currentUser){ newIng.lastEditedBy = currentUserLabel(); newIng.lastEditedAt = new Date().toISOString(); }
      inventory.push(newIng);
      ingId = newIng.id;
      ingName = newIng.name;
    } else {
      const ing = inventory.find(i=>i.id===ingId);
      if(ing && ing.expenseOnly){
        // Alias aprendido apunta a un producto "solo gasto" (Eat out): precio al
        // día y nada más — sin stock, sin lleno, sin tocar el valor del inventario.
        ing.costPerUnit = item.totalPrice/item.qty;
        if(currentUser){ ing.lastEditedBy = currentUserLabel(); ing.lastEditedAt = new Date().toISOString(); }
        ingName = ing.name;
      } else if(ing){
        // Si este recibo trae una unidad distinta a la que el ingrediente venía usando
        // (ej. antes se compraba por lb, este recibo dice caja), ing.unit se queda como
        // estaba mientras costPerUnit/qtyOnHand se recalculaban igual con la unidad
        // nueva — el precio guardado terminaba siendo "$46.00/lb" cuando en realidad
        // era $46.00/caja, y el stock sumaba libras con cajas como si fueran lo mismo.
        // Acá se trata un cambio de unidad como lo que es: no hay forma de convertir 12
        // lb en cajas sin que el proveedor diga el factor, así que en vez de sumar dos
        // unidades distintas como si fueran una sola, arrancamos el conteo de stock de
        // nuevo desde esta compra — mismo criterio que ya usa lastPriceChangePct() para
        // no comparar (ni acá, mezclar) unidades distintas.
        const unitChanged = ing.unit !== item.unit;
        if(unitChanged) ing.unit = item.unit;
        ing.costPerUnit = item.totalPrice/item.qty;
        ing.updated = true;
        ing.qtyOnHand = unitChanged ? item.qty : (ing.qtyOnHand||0) + item.qty;
        // Entrada de stock → este nivel es el nuevo "lleno" de la barra (100%).
        ing.stockFullRef = ing.qtyOnHand;
        if(currentUser){ ing.lastEditedBy = currentUserLabel(); ing.lastEditedAt = new Date().toISOString(); }
        ingName = ing.name;
      }
    }
    // Aprende la relación nombre-del-recibo -> ingrediente, para reconocerlo solo la próxima vez
    aliasMap[(item.rawName||'').toLowerCase().trim()] = ingId;

    const purchaseId = uid('p');
    // "unit" se guarda a partir de ahora en cada compra (antes no se guardaba). Sin esto,
    // comparar el precio de dos compras del mismo producto podía estar comparando libras
    // contra cajas sin darse cuenta, mostrando subas de precio "de 800%" que en realidad
    // eran solo un cambio de unidad mal leído — ver lastPriceChangePct().
    purchases.push({id:purchaseId, ingId, qty:item.qty, unit:item.unit, totalPrice:item.totalPrice, supplier:scanSupplier||t('fallback_scanned'), date:scanDate});
    createdPurchaseIds.push(purchaseId);
    appliedItems.push({rawName:item.rawName, qty:item.qty, unit:item.unit, totalPrice:item.totalPrice, ingName});
  });

  if(appliedItems.length>0){
    const itemsSum = appliedItems.reduce((s,i)=>s+i.totalPrice,0);
    // Preferimos el total impreso de la factura (lo que de verdad se pagó, incluye
    // impuestos/cargos que no vienen como línea de producto) sobre la suma de los
    // productos confirmados, que puede quedar corta si algo no se leyó o se sacó de la lista.
    const receiptTotal = scanInvoiceTotal!==null ? scanInvoiceTotal : itemsSum;
    const newReceipt = {
      // En modo lote cada recibo guarda solo la foto de la que salió (scanCurrentImages);
      // en modo normal, todas las páginas como siempre.
      id:uid('r'), images: scanCurrentImages ? scanCurrentImages.slice() : scanImages.slice(),
      supplier:scanSupplier||t('fallback_unspecified'), date:scanDate,
      total: receiptTotal,
      itemCount: appliedItems.length, appliedItems, createdAt: new Date().toISOString(),
      purchaseIds: createdPurchaseIds
    };
    receipts.push(newReceipt);
    // Sin esperar ni bloquear: si hay sesión, sube las fotos a Storage en segundo
    // plano — si falla (sin red, etc.) el recibo ya quedó guardado igual, y la
    // próxima conexión reintenta solo (ver catchUpReceiptPhotoUploads).
    if(currentUser) uploadReceiptImages(newReceipt);
  }
  /* Fase 2 Nudgy: recibo de servicio confirmado + oferta aceptada → recordatorio
     mensual en el calendario, anclado al DÍA DEL RECIBO (la boleta llega más o
     menos el mismo día cada mes) — reusa entera la infraestructura de notas de la
     Fase 1: pinta el calendario, sincroniza al equipo y aparece en el historial. */
  if(appliedItems.length>0 && payInfo && !payInfo.existing && payInfo.key && scanPayReminder){
    const label = (uiLang==='en' ? 'Pay ' : 'Pagar ') + payInfo.supplier;
    calNotes.push({
      id: uid('note'), text: label, date: null, hour: null, minute: null,
      recurring: {type:'everyNMonths', n:1}, anchorDate: scanDate, icon: '💳',
      paySupplierKey: payInfo.key, createdAt: new Date().toISOString()
    });
    logActivity('note_created', label);
  }
  saveState();
  if(appliedItems.length>0) logActivity('scan_applied', '', String(appliedItems.length));

  // En modo lote, guardar un recibo NO cierra el escáner: pasa al siguiente de la cola
  // para que el usuario confirme los 5 seguidos sin volver a sacar fotos.
  if(scanBatchMode){
    if(appliedItems.length>0) scanQueueSaved++;
    if(loadNextQueuedReceipt()){ render(); return; }
    finishScanBatch();
    return;
  }
  closeScanModal();
}

/* Borra un recibo y las compras que generó (así el gasto mensual y el historial de
   precio no quedan contaminados con un recibo escaneado por error o duplicado).
   Los recibos guardados antes de este cambio no tienen purchaseIds — en ese caso
   solo se borra el registro del recibo, sin tocar compras. */
function deleteReceipt(receiptId){
  const r = receipts.find(x=>x.id===receiptId);
  if(!r) return;
  if(!confirm(t('confirm_delete_receipt'))) return;
  const hasPurchases = Array.isArray(r.purchaseIds) && r.purchaseIds.length>0;
  // Si este recibo de verdad afectó el inventario, preguntamos aparte si también
  // hay que restar esas cantidades — no siempre corresponde: si el usuario ya usó/
  // vendió ese stock, revertirlo a ciegas dejaría el inventario mostrando menos de
  // lo que realmente tiene. Las compras (historial de precio, gasto mensual) se
  // borran siempre junto con el recibo, eso no depende de esta respuesta.
  const revertInventory = hasPurchases && confirm(t('confirm_revert_inventory'));
  if(hasPurchases){
    const idSet = new Set(r.purchaseIds);
    if(revertInventory){
      const touchedIngIds = new Set();
      purchases.filter(p=>idSet.has(p.id)).forEach(p=>{
        const ing = inventory.find(i=>i.id===p.ingId);
        if(ing){
          ing.qtyOnHand = Math.max(0, (ing.qtyOnHand||0) - p.qty);
          // Revertir el recibo deshace también la entrada que subió el "lleno":
          // sin esto, la barra quedaría comparando contra un nivel que nunca existió.
          if(ing.stockFullRef){ const r = ing.stockFullRef - p.qty; ing.stockFullRef = r>0 ? r : null; }
          touchedIngIds.add(ing.id);
        }
      });
      // Un producto que este recibo tocó y que no tiene NINGUNA otra compra (ni de
      // antes, ni de otro recibo) fue creado enteramente por este recibo — al
      // revertirlo no debe quedar como fantasma en cero, tiene que desaparecer del
      // todo. Uno que sí tiene historia propia (otro recibo, o se cargó a mano) se
      // queda en la lista, solo con la cantidad ya restada arriba.
      touchedIngIds.forEach(ingId=>{
        const stillHasOtherPurchases = purchases.some(p=>p.ingId===ingId && !idSet.has(p.id));
        if(stillHasOtherPurchases) return;
        const ghostItem = inventory.find(i=>i.id===ingId);
        inventory = inventory.filter(i=>i.id!==ingId);
        if(!deletedInventoryIds.includes(ingId)) deletedInventoryIds.push(ingId);
        if(ghostItem) logActivity('item_deleted', ghostItem.name);
      });
    }
    // Lápidas de las compras borradas: sin esto, un compañero offline las re-subía al
    // reconectar (missingPur en reconcileLocalOnlyData) y el recibo "resucitaba" con ellas.
    r.purchaseIds.forEach(pid=>{ if(!deletedPurchaseIds.includes(pid)) deletedPurchaseIds.push(pid); });
    purchases = purchases.filter(p=>!idSet.has(p.id));
  }
  receipts = receipts.filter(x=>x.id!==receiptId);
  // Lápida del recibo borrado — mismo motivo: evita que reaparezca desde otro dispositivo.
  if(!deletedReceiptIds.includes(receiptId)) deletedReceiptIds.push(receiptId);
  // Borra las fotos de Storage si llegaron a subirse — best-effort: si falla (sin
  // red, sin sesión, lo que sea) no interrumpe ni avisa nada, el recibo ya se borró
  // igual de lo que importa (Firestore/localStorage). Un archivo huérfano en
  // Storage no rompe nada, solo ocupa espacio de sobra.
  // ownerUid (no "uid") a propósito: uid es también el nombre de la función global que
  // genera ids — sombrearla acá es una trampa para cualquier edición futura de esta función.
  const ownerUid = syncUid();
  if(ownerUid && currentUser){
    receiptImages(r).forEach(img=>{
      if(img.path) firebase.storage().ref(img.path).delete().catch(()=>{});
    });
  }
  saveState();
  showReceiptDetail = null;
  render();
}

function printReceipt(r){
  const w = window.open('', '_blank');
  if(!w) return; // ventana emergente bloqueada por el navegador
  const rows = (r.appliedItems||[]).map(it=>`
    <tr><td>${escapeHtml(it.rawName)}</td><td>${escapeHtml(it.qty)} ${escapeHtml(unitLabel(it.unit))}</td><td>${money(it.totalPrice)}</td></tr>
  `).join('');
  const imgsHtml = receiptImages(r).map(img=>`<img src="${escapeHtml(receiptImageSrc(img))}" alt="">`).join('');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${escapeHtml(r.supplier)||t('no_supplier_name')}</title>
    <style>
      body{font-family:-apple-system,sans-serif;padding:24px;color:#1C1C1E;max-width:480px;margin:0 auto;}
      h2{margin:0 0 4px;} .meta{color:#5F6368;font-size:13px;margin-bottom:16px;}
      img{max-width:100%;border-radius:8px;margin-bottom:16px;display:block;}
      table{width:100%;border-collapse:collapse;} th,td{text-align:left;padding:6px 4px;border-bottom:1px solid #ddd;font-size:13px;}
      tfoot td{font-weight:700;border-bottom:none;padding-top:10px;}
    </style></head><body>
    <h2>${escapeHtml(r.supplier)||t('no_supplier_name')}</h2>
    <div class="meta">${escapeHtml(r.date)}</div>
    ${imgsHtml}
    <table>
      <thead><tr><th>${t('th_ingredient')}</th><th>${t('lbl_qty_bought')}</th><th>${t('th_cost_unit').split('/')[0]}</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td colspan="2">${t('lbl_total_paid')}</td><td>${money(r.total)}</td></tr></tfoot>
    </table>
    </body></html>`);
  w.document.close();
  w.focus();
  w.print();
}

/* Descargar/compartir necesitan un Blob de verdad, no solo un src para mostrar —
   funciona igual para una foto local (fetch de un data: URI, instantáneo) que para
   una que solo vive en Storage (fetch de la URL, por red) — receiptImageSrc() ya
   resuelve cuál de las dos usar. */
async function receiptImageBlob(img){
  const src = receiptImageSrc(img);
  if(!src) return null;
  const res = await fetch(src);
  return res.blob();
}

async function downloadReceiptImage(r){
  const imgs = receiptImages(r);
  for(let idx=0; idx<imgs.length; idx++){
    const img = imgs[idx];
    const blob = await receiptImageBlob(img);
    if(!blob) continue;
    const ext = (img.mediaType||'image/jpeg').includes('png') ? 'png' : 'jpg';
    const suffix = imgs.length>1 ? `-p${idx+1}` : '';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt-${r.date||'sin-fecha'}${suffix}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
}

async function shareReceipt(r){
  const label = `${r.supplier||t('no_supplier_name')} — ${r.date}`;
  const imgs = receiptImages(r);
  if(navigator.share && imgs.length>0){
    try{
      const files = (await Promise.all(imgs.map(async (img,idx)=>{
        const blob = await receiptImageBlob(img);
        if(!blob) return null;
        const ext = (img.mediaType||'image/jpeg').includes('png') ? 'png' : 'jpg';
        const suffix = imgs.length>1 ? `-p${idx+1}` : '';
        return new File([blob], `receipt-${r.date||'sin-fecha'}${suffix}.${ext}`, {type:img.mediaType});
      }))).filter(Boolean);
      const shareData = (navigator.canShare && navigator.canShare({files}))
        ? {files, title:label, text:label}
        : {title:label, text:label};
      await navigator.share(shareData);
      return;
    }catch(e){
      if(e && e.name==='AbortError') return; // el usuario cerró el panel de compartir, no es un error
    }
  }
  // Sin Web Share API disponible (la mayoría de navegadores de escritorio): descarga las fotos
  // para que el usuario las comparta a mano por donde prefiera.
  downloadReceiptImage(r);
}

/* ================= BORRAR UN PRODUCTO (x chica en Dashboard e Inventario) =================
   Antes esto se hacía deslizando la fila hacia la izquierda, pero ese gesto competía
   con el de cambiar de pestaña (el dedo casi siempre cae sobre una fila) y hacía
   fallar la navegación seguido. Ahora ninguna fila tiene gesto propio — se borra con
   un toque directo en la x, que sí pide confirmar (a diferencia del viejo deslizar,
   que ya era en sí mismo un gesto de dos pasos y no necesitaba otra confirmación). */
function removeInventoryItem(id){
  const deletedItem = inventory.find(i=>i.id===id);
  inventory = inventory.filter(i=>i.id!==id);
  if(!deletedInventoryIds.includes(id)) deletedInventoryIds.push(id);
  saveState();
  if(deletedItem) logActivity('item_deleted', deletedItem.name);
}

function deleteStockItem(id, triggerEl){
  const item = inventory.find(i=>i.id===id);
  if(!item) return;
  if(!confirm(t('confirm_delete_item').replace('{name}', item.name))) return;
  // La misma fila (mismo data-ing-id) aparece dos veces en el DOM a la vez: una en
  // la tarjeta de stock del Dashboard y otra en Inventario (las 3 pestañas viven
  // siempre las 3 en el DOM, ver la nota junto a .view-track). Antes esto buscaba
  // con un querySelector global, que siempre devuelve la PRIMERA coincidencia del
  // documento — la del Dashboard, sin importar desde qué pestaña se borró — así que
  // al borrar desde Inventario la animación de colapso corría sobre la copia
  // invisible del Dashboard y la fila que el usuario tenía delante desaparecía de
  // golpe al terminar de redibujar, sin ninguna animación. Partiendo del botón que
  // realmente se tocó (triggerEl) y subiendo al contenedor más cercano, se anima
  // siempre la fila correcta sin importar la pestaña.
  const wrap = triggerEl ? triggerEl.closest('.stock-row-static') : document.querySelector('.stock-row-static[data-ing-id="'+id+'"]');
  const finish = ()=>{ removeInventoryItem(id); render(); };
  if(!wrap){ finish(); return; }
  const h = wrap.getBoundingClientRect().height;
  wrap.style.maxHeight = h+'px';
  wrap.style.overflow = 'hidden';
  requestAnimationFrame(()=>{
    requestAnimationFrame(()=>{
      wrap.style.transition = 'max-height .25s ease, opacity .25s ease';
      wrap.style.maxHeight = '0px';
      wrap.style.opacity = '0';
    });
  });
  setTimeout(finish, 260);
}

function viewportWidthPx(){
  const vp = document.querySelector('.view-viewport');
  return vp ? vp.getBoundingClientRect().width : window.innerWidth;
}
function trackRestPx(tab, vw){ return -(TAB_ORDER.indexOf(tab) * vw); }
// getComputedStyle siempre devuelve la matriz resuelta en píxeles, sin importar si
// el transform actual se escribió en % (el primer dibujado) o en px (una animación
// en curso) — así no hace falta acordarse en qué unidad quedó la última vez.
function currentTrackPx(track){
  const m = getComputedStyle(track).transform;
  if(!m || m==='none') return 0;
  const match = m.match(/matrix\(([^)]+)\)/);
  if(!match) return 0;
  const parts = match[1].split(',').map(parseFloat);
  return parts[4] || 0;
}
/* Resorte de verdad (masa-resorte-amortiguador), no una curva CSS de duración fija.
   Una animación con duración/curva clavadas de antemano se ve IGUAL sin importar
   cómo se soltó el gesto — un flick rápido y un arrastre lento y tímido terminan
   con el mismo tiempito artificial. Acá la velocidad real con la que venía el dedo
   entra directo a la física: algo rápido llega y frena con más carácter, algo
   lento se acomoda suave — y el amortiguamiento se dejó apenas por debajo del
   crítico a propósito, así queda un ínfimo asentamiento al final (se siente vivo)
   sin pasarse a gomoso. Se re-calcula cuadro a cuadro con requestAnimationFrame en
   vez de depender de transition+transitionend, que es lo que hacía que antes se
   sintiera siempre igual de rápido pasara lo que pasara. */
let trackSpringFrame = null;
// Cubre TODA la ventana en la que el resorte está animando .view-track a mano —
// no solo mientras el dedo está apoyado (swipeGestureActive cubre eso), sino
// también después de soltar y al tocar un botón de la barra de abajo (ahí no hay
// gesto de arrastre en absoluto). render() la revisa igual que swipeGestureActive
// (ver más abajo) para no reemplazar el nodo que este resorte está animando.
let trackAnimating = false;
function animateTrackTo(track, fromPx, toPx, initialVelocityPxPerSec, onSettled){
  if(trackSpringFrame){ cancelAnimationFrame(trackSpringFrame); trackSpringFrame=null; }
  trackAnimating = true;
  const STIFFNESS = 230;
  const DAMPING = 26; // razón de amortiguamiento ≈ 0.86 — el perfil del paginado de
                       // iOS: ~480ms de asentamiento, desaceleración con carácter
                       // pero SIN rebote visible (simulado y medido antes de elegir
                       // estos números). El rebote de ~7% que probamos antes se
                       // sentía a juguete, no a iPhone — Apple pagina sin rebotar.
  const MASS = 1;
  const REST_EPSILON_PX = 0.4;
  const REST_VELOCITY_EPSILON = 20; // px/s
  const MAX_VELOCITY = 3500; // por si un flick da una velocidad medida irreal
  let pos = fromPx;
  let vel = Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, initialVelocityPxPerSec||0));
  let lastT = null;
  track.style.transition = 'none';
  function frame(now){
    if(lastT===null) lastT = now;
    let dt = (now-lastT)/1000;
    lastT = now;
    dt = Math.min(dt, 0.032); // si el navegador salta un cuadro, no pegar un salto grande
    const accel = (-STIFFNESS*(pos-toPx) - DAMPING*vel) / MASS;
    vel += accel*dt;
    pos += vel*dt;
    const settled = Math.abs(pos-toPx)<REST_EPSILON_PX && Math.abs(vel)<REST_VELOCITY_EPSILON;
    if(settled){
      track.style.transform = `translateX(${toPx}px)`;
      trackSpringFrame = null;
      trackAnimating = false;
      onSettled();
      return;
    }
    track.style.transform = `translateX(${pos}px)`;
    trackSpringFrame = requestAnimationFrame(frame);
  }
  trackSpringFrame = requestAnimationFrame(frame);
}
/* Cambia de pestaña animando el .view-track que YA está en el DOM, en vez de
   redibujar todo de una — un reemplazo de innerHTML no puede animar una transición
   (el elemento nuevo no tiene "posición anterior" de la cual partir), pero mover el
   transform de un nodo que ya existe sí. Recién cuando el resorte se asienta se
   actualiza activeTab y se llama a render() — para ese momento la pantalla ya está
   en su lugar, así que el redibujado no se nota. Se usa tanto al tocar un botón de
   la barra de abajo (sin velocidad inicial, el resorte solo tira hacia el destino)
   como al soltar un gesto de deslizar (con la velocidad real del dedo — ver
   attachViewSwipeHandlers). */
/* Vibración sutil al comprometerse un cambio de pestaña (tap en la barra o soltar
   un swipe que superó el umbral) — el toquecito táctil que las apps nativas dan al
   "encajar" una pantalla. En el navegador o sin el plugin es un no-op silencioso.
   Se dispara al COMPROMETERSE el cambio (cuando arranca el resorte), no al
   asentarse: la sensación tiene que coincidir con el momento de la decisión del
   dedo, no llegar medio segundo tarde. */
function hapticTabTick(){
  try{
    const H = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics;
    if(H) H.impact({style:'LIGHT'}).catch(()=>{});
  }catch(e){}
}
function switchToTab(tab, initialVelocityPxPerSec){
  const track = document.querySelector('.view-track');
  if(!track){
    if(tab!==activeTab){ activeTab=tab; try{ localStorage.setItem('patron_active_tab', activeTab); }catch(e){} }
    render();
    return;
  }
  const vw = viewportWidthPx();
  const fromPx = currentTrackPx(track);
  const toPx = trackRestPx(tab, vw);
  if(tab===activeTab){
    // No cambia de pestaña, solo se asienta de vuelta en su lugar (ej. un arrastre
    // que no llegó al umbral, o el rebote tipo goma en la primera/última pestaña).
    // Igual puede haber quedado un redibujado pospuesto de mientras el dedo estaba
    // apoyado (ver swipeGestureActive en render()) — se aplica recién acá, nunca
    // antes, para no pisar la posición que el resorte todavía está animando a mano.
    animateTrackTo(track, fromPx, toPx, initialVelocityPxPerSec, ()=>{ flushPendingRenderIfAny(); });
    return;
  }
  hapticTabTick();
  document.querySelectorAll('.bottom-nav-item').forEach(b=>{ b.classList.toggle('active', b.dataset.tab===tab); });
  animateTrackTo(track, fromPx, toPx, initialVelocityPxPerSec, ()=>{
    activeTab = tab;
    try{ localStorage.setItem('patron_active_tab', activeTab); }catch(e){}
    renderPendingAfterGesture = false; // este render ya va a mostrar todo al día
    render();
  });
}
/* Deslizar hacia los lados entre pestañas, siguiendo el dedo en tiempo real (como
   cambiar de pantalla de apps en el iPhone) — no interfiere con un modal abierto
   (no se toca nada si hay uno en pantalla), ni con el scroll vertical normal (se
   bloquea el eje apenas se nota cuál de los dos domina).

   Escucha en document (NO en .view-viewport) para que agarre el dedo empiece
   donde empiece el toque — la barra de arriba, una tarjeta, un botón, la barra de
   abajo — no solo el área en blanco entre unas cosas y otras. Por eso se cablea
   UNA SOLA VEZ (viewSwipeAttached), a diferencia del resto de attachEvents() que
   se vuelve a correr en cada render: document nunca se destruye, así que
   engancharse de nuevo cada vez apilaría escuchas repetidas. Los elementos que sí
   cambian en cada render (.view-track, .view-viewport) se buscan de nuevo recién
   cuando hacen falta, nunca se guardan de entrada.

   Mientras el dedo está apoyado, la pantalla lo sigue 1 a 1 en tiempo real (con
   re-base al enganchar y goma asintótica en los bordes, ver pointermove); el
   compromiso final — a qué pestaña queda — se decide recién al soltar (endGesture),
   con la velocidad real de los últimos ~100ms del dedo entrando directo al resorte
   de switchToTab(). */
let viewSwipeAttached = false;
function attachViewSwipeHandlers(){
  if(viewSwipeAttached) return;
  viewSwipeAttached = true;
  const MOVE_LOCK = 10; // px para decidir si el gesto es horizontal o vertical — antes
                         // era 5, muy sensible al temblor natural de los primeros
                         // píxeles de un toque real, lo que a veces trababa el eje en
                         // "vertical" por error y el swipe no arrancaba
  const DIST_FRACTION = 0.2; // % del ancho para comprometerse al cambio arrastrando lento
  const FLICK_VELOCITY = 0.3; // px/ms — un toque rápido cambia de pestaña aunque recorra poco
  // Antes ganaba el eje horizontal recién pasado los 45° (|dx|>|dy| a secas) — un
  // dedo real casi nunca se mueve perfectamente horizontal, así que un deslice
  // apenas un poco inclinado (muy común arrancando desde abajo del pulgar) se
  // trababa en "es scroll vertical" y el cambio de pestaña no agarraba. Con este
  // sesgo, horizontal gana hasta ~63° de inclinación (|dx| > |dy|*0.5) — el scroll
  // vertical de verdad (casi recto para abajo) sigue andando normal, pero un
  // deslice apenas diagonal para cambiar de pestaña ahora sí "agarra".
  const AXIS_BIAS = 0.5;
  let s = null; // estado del gesto en curso, o null si no hay ninguno

  document.addEventListener('pointerdown',(e)=>{
    if(e.pointerType==='mouse' && e.button!==0) return;
    /* Solo el dedo "principal" (el primero apoyado) maneja este gesto — un segundo
       dedo, o la palma tocando de más, se ignora sin romper el gesto en curso.
       Importante: NO se descarta el toque nuevo por haber quedado un gesto anterior
       sin cerrar. Esa protección ("si ya hay uno en curso, ignorar") parecía
       prudente pero era justo lo que causaba el "pongo el dedo y no responde": si
       por cualquier motivo un gesto quedaba sin su pointerup (el navegador se lo
       tragó, el sistema interrumpió, etc.), TODOS los toques siguientes quedaban
       ignorados hasta recargar la página. Un pointerdown principal siempre arranca
       de cero — es imposible quedar trabado. */
    if(e.isPrimary===false) return;
    if(e.target.closest('.overlay')) return; // con un modal abierto, este gesto no aplica
    // La hoja de la calculadora es fixed pero NO es .overlay — sin esta línea,
    // deslizar el dedo dentro de la calculadora abierta arrastraba las pestañas
    // por detrás (y al cerrarla estabas en otra pantalla sin haberlo pedido).
    if(e.target.closest('.oc-sheet')) return;
    const viewport = document.querySelector('.view-viewport');
    const track = document.querySelector('.view-track');
    if(!viewport || !track) return;
    // Si todavía estaba terminando de asentarse la transición anterior, tocar la
    // pantalla la "agarra" ahí mismo donde esté en vez de dejarla terminando sola
    // en paralelo (que compitiera con el gesto nuevo) — startIdx se calcula según
    // activeTab, que recién se actualiza cuando el resorte anterior se asienta, así
    // que cancelarlo ahora evita que ese commit tardío pise el resultado de este
    // gesto nuevo.
    if(trackSpringFrame){ cancelAnimationFrame(trackSpringFrame); trackSpringFrame=null; trackAnimating=false; }
    /* A propósito NO se llama a setPointerCapture acá. Un toque ya viene con
       "captura implícita" al elemento donde empezó, así que sus eventos siguen
       llegando (y burbujeando hasta document) aunque el dedo se mueva por encima de
       otras cosas — capturar a mano no aportaba nada y sí podía romper el gesto si
       algún otro elemento se adelantaba a tomar la captura primero. */
    const vw = viewport.getBoundingClientRect().width;
    s = {
      startX:e.clientX, startY:e.clientY, dx:0, dragPx:0, axis:null, baseX:0,
      vw, startIdx: TAB_ORDER.indexOf(activeTab), startPx: trackRestPx(activeTab, vw),
      pointerId: e.pointerId, track, // se guarda el nodo exacto — ver por qué en pointermove
      samples: [{t:e.timeStamp, x:e.clientX}]
    };
  }, {passive:true});

  /* Curva de goma asintótica de iOS (la de verdad, no un multiplicador lineal):
     cuanto más tirás, menos avanza — se acerca a un límite sin llegar nunca, que es
     exactamente la sensación del borde de una pantalla de iPhone. c=0.55 es la
     constante que usa Apple en UIScrollView. */
  function rubberBand(x, dim){ return (1 - 1/((x*0.55/dim) + 1)) * dim; }

  document.addEventListener('pointermove',(e)=>{
    if(!s || e.pointerId!==s.pointerId) return;
    // Si en el medio del gesto la pantalla se volvió a dibujar entera (ej. llegó un
    // cambio de otro dispositivo del equipo por Firestore mientras deslizabas), el
    // nodo .view-track de ahora ya NO es el mismo que agarramos al empezar — seguir
    // moviendo el viejo (ya fuera del DOM) no haría nada visible, y el nuevo
    // arrancaría en su posición de reposo sin el arrastre. Se aborta limpio en vez
    // de producir un salto o quedar mudo.
    if(document.querySelector('.view-track')!==s.track){ endGestureImpl(e, true); return; }
    s.dx = e.clientX - s.startX;
    const dy = e.clientY - s.startY;
    if(s.axis===null){
      if(Math.abs(s.dx)<MOVE_LOCK && Math.abs(dy)<MOVE_LOCK) return;
      s.axis = Math.abs(s.dx) > Math.abs(dy)*AXIS_BIAS ? 'x' : 'y';
      if(s.axis==='x'){
        s.track.style.transition = 'none';
        // Re-base: el movimiento arranca desde CERO en este punto, no desde donde
        // se apoyó el dedo — sin esto, al confirmarse el eje la pantalla pegaba un
        // salto seco de ~10px (la distancia ya recorrida para detectar el eje), y
        // ese saltito inicial es gran parte de que se sintiera "no profesional".
        // Es lo mismo que hace UIPanGestureRecognizer de iOS.
        s.baseX = e.clientX;
        // A partir de acá, render() pospone cualquier redibujado de fondo (ver la
        // nota junto a su definición) en vez de reemplazar el nodo que este gesto
        // está animando a mano — así un dato que llega de Firestore a mitad de un
        // deslice ya no lo corta en seco.
        swipeGestureActive = true;
      }
    }
    if(s.axis!=='x') return;
    // Muestras para la velocidad de soltado — solo interesan los últimos ~100ms
    // (cómo venía el dedo AL FINAL, no el promedio de todo el arrastre).
    s.samples.push({t:e.timeStamp, x:e.clientX});
    while(s.samples.length>2 && e.timeStamp - s.samples[0].t > 120) s.samples.shift();
    e.preventDefault(); // igual hace falta: evita que el navegador intente su propio scroll/gesto horizontal
    // Sigue el dedo en tiempo real, 1 a 1 — el commit final (a qué pestaña queda y
    // el resorte con el que asienta) recién se decide al soltar, en endGesture.
    s.dragPx = e.clientX - s.baseX;
    let dxPx = s.dragPx;
    const atFirst = s.startIdx===0 && dxPx>0;
    const atLast = s.startIdx===TAB_ORDER.length-1 && dxPx<0;
    if(atFirst || atLast){
      dxPx = Math.sign(dxPx) * rubberBand(Math.abs(dxPx), s.vw);
    } else if(Math.abs(dxPx) > s.vw){
      // Pasada la pestaña vecina no hay más adónde ir (el commit es de a una):
      // goma también, en vez de seguir arrastrando en vano.
      dxPx = Math.sign(dxPx) * (s.vw + rubberBand(Math.abs(dxPx)-s.vw, s.vw*0.5));
    }
    s.track.style.transform = `translateX(${s.startPx + dxPx}px)`;
  }, {passive:false});

  function endGestureImpl(e, isCancel){
    if(!s || (e.pointerId!==undefined && e.pointerId!==s.pointerId)) return;
    const g = s; s = null;
    // El dedo ya se levantó (o el gesto se canceló) — de acá en adelante render() puede
    // volver a dibujar normal. El resorte de asentado sigue animando el nodo actual a
    // mano, sin volver a llamar a render() hasta que se asiente (ver switchToTab), así
    // que soltar la bandera ahora no le pisa el arrastre.
    swipeGestureActive = false;
    if(g.axis!=='x'){ return; } // fue scroll vertical o un toque muy chico — no se tocó el track
    // Velocidad de soltado medida sobre la ventana de muestras (~100ms), igual que
    // el reconocedor de gestos de iOS — usar solo el último par de eventos (como
    // antes) es ruidoso: dos eventos casi simultáneos daban velocidades absurdas o
    // con el signo cambiado, y el gesto "decidía mal" al soltar.
    let velocity = 0; // px/ms
    if(!isCancel && g.samples.length>=2){
      const last = g.samples[g.samples.length-1];
      let first = g.samples[0];
      for(const smp of g.samples){ if(last.t - smp.t <= 100){ first = smp; break; } }
      if(last.t > first.t) velocity = (last.x - first.x)/(last.t - first.t);
    }
    // Un pointercancel (el sistema interrumpió el toque — una llamada entrante, un
    // gesto del navegador, etc.) nunca completa el cambio de pestaña, solo vuelve a
    // donde estaba — soltar de verdad es lo único que puede confirmar un cambio.
    let targetIdx = g.startIdx;
    if(!isCancel){
      const flicked = Math.abs(velocity) > FLICK_VELOCITY && Math.abs(g.dragPx) > 8;
      if(flicked){
        // La DIRECCIÓN del flick la manda la velocidad, no la distancia total —
        // así, arrastrar lejos y "devolver" el dedo con un golpecito al final
        // cancela el cambio, exactamente como en iOS.
        targetIdx = g.startIdx + (velocity < 0 ? 1 : -1);
      } else if(Math.abs(g.dragPx) > g.vw*DIST_FRACTION){
        targetIdx = g.startIdx + (g.dragPx < 0 ? 1 : -1);
      }
      targetIdx = Math.max(0, Math.min(TAB_ORDER.length-1, targetIdx));
    }
    switchToTab(TAB_ORDER[targetIdx], isCancel ? 0 : velocity*1000); // px/ms -> px/s, ver animateTrackTo
  }
  document.addEventListener('pointerup', (e)=>endGestureImpl(e, false));
  document.addEventListener('pointercancel', (e)=>endGestureImpl(e, true));
}

/* Mantener presionado un chip de categoría (en el Dashboard) y arrastrarlo lo mueve
   de lugar entre sus vecinos — el orden final es el que categoryChipsRow() va a
   mostrar de ahí en más, el mismo que categoriesModal() deja editar con flechas.
   Requiere mantener presionado un rato antes de arrancar (en vez de reaccionar al
   primer movimiento, como el swipe de pestañas) porque la fila hace scroll
   horizontal — sin ese margen, cualquier intento de scrollear la fila se
   confundiría con querer reordenar un chip. Se cablea UNA sola vez en document,
   igual que attachViewSwipeHandlers — ver esa función para por qué. */
let categoryChipDragAttached = false;
function attachCategoryChipDragHandlers(){
  if(categoryChipDragAttached) return;
  categoryChipDragAttached = true;
  const LONG_PRESS_MS = 350;
  const MOVE_CANCEL_PX = 10; // moverse esto antes de que se cumpla el long-press cancela: era scroll, no reorder
  let pending = null; // toque en espera de cumplir el long-press, o null
  let drag = null; // arrastre ya confirmado, o null

  document.addEventListener('pointerdown', (e)=>{
    if(e.pointerType==='mouse' && e.button!==0) return;
    if(e.isPrimary===false || drag) return;
    const chip = e.target.closest('.category-chip');
    if(!chip) return;
    const row = chip.closest('.category-chip-row');
    if(!row) return;
    pending = {chip, row, pointerId:e.pointerId, startX:e.clientX, startY:e.clientY};
    pending.timer = setTimeout(()=>{
      if(!pending) return;
      const p = pending; pending = null;
      p.row.classList.add('reordering');
      p.chip.classList.add('dragging');
      p.chip.style.position = 'relative';
      p.chip.style.zIndex = '5';
      drag = {chip:p.chip, row:p.row, pointerId:p.pointerId, baseX:p.startX, tx:0};
    }, LONG_PRESS_MS);
  }, {passive:true});

  document.addEventListener('pointermove', (e)=>{
    if(pending && e.pointerId===pending.pointerId){
      if(Math.abs(e.clientX-pending.startX)>MOVE_CANCEL_PX || Math.abs(e.clientY-pending.startY)>MOVE_CANCEL_PX){
        clearTimeout(pending.timer); pending = null;
      }
      return;
    }
    if(!drag || e.pointerId!==drag.pointerId) return;
    e.preventDefault();
    drag.tx += e.clientX - drag.baseX;
    drag.baseX = e.clientX;
    drag.chip.style.transform = `translateX(${drag.tx}px)`;
    // ¿El chip arrastrado ya cruzó el centro de un vecino? Si sí, cambian de lugar EN
    // EL DOM ahí mismo (no se espera a soltar) para que la fila se sienta "viva"
    // mientras se arrastra, como reordenar apps en un celular de verdad. Al
    // reordenar, el chip arrastrado cambia de posición NATURAL en el flujo — sin
    // volver a basear tx contra esa nueva posición, pegaría un salto seco hacia
    // donde ahora "le toca" estar antes de seguir al dedo (mismo truco de re-base
    // que usa el swipe de pestañas al enganchar un gesto nuevo).
    const visualLeftBefore = drag.chip.getBoundingClientRect().left;
    const prev = drag.chip.previousElementSibling;
    const next = drag.chip.nextElementSibling;
    let moved = false;
    if(prev && prev.classList.contains('category-chip')){
      const r = prev.getBoundingClientRect();
      if(visualLeftBefore < r.left + r.width/2){ drag.row.insertBefore(drag.chip, prev); moved = true; }
    }
    if(!moved && next && next.classList.contains('category-chip')){
      const dw = drag.chip.getBoundingClientRect().width;
      const r = next.getBoundingClientRect();
      if(visualLeftBefore + dw > r.left + r.width/2){ drag.row.insertBefore(drag.chip, next.nextElementSibling); moved = true; }
    }
    if(moved){
      const naturalLeftPlusOldTx = drag.chip.getBoundingClientRect().left;
      const naturalLeftNew = naturalLeftPlusOldTx - drag.tx;
      drag.tx = visualLeftBefore - naturalLeftNew;
      drag.chip.style.transform = `translateX(${drag.tx}px)`;
    }
  }, {passive:false});

  function endPress(e){
    if(pending && (!e || e.pointerId===pending.pointerId)){ clearTimeout(pending.timer); pending = null; }
    if(!drag || (e && e.pointerId!==drag.pointerId)) return;
    const {chip, row} = drag; drag = null;
    chip.classList.remove('dragging');
    chip.style.transform = ''; chip.style.position = ''; chip.style.zIndex = '';
    row.classList.remove('reordering');
    // El orden final es simplemente el orden actual del DOM (cada swap de arriba ya
    // lo fue dejando así) — se traduce a ids y se reordena categories para que
    // coincida, se guarda, y recién ACÁ se redibuja: durante el arrastre en sí nunca
    // se llamó a render(), todo fue manipulación directa del DOM, igual que el
    // resorte del swipe de pestañas nunca reconstruye nada hasta asentarse.
    const domOrder = [...row.querySelectorAll('.category-chip')].map(c=>c.dataset.openCategory);
    const reordered = domOrder.map(id=>categories.find(c=>c.id===id)).filter(Boolean);
    if(reordered.length===categories.length){
      categories = reordered;
      saveState();
    }
    render();
  }
  document.addEventListener('pointerup', endPress);
  document.addEventListener('pointercancel', endPress);
}

