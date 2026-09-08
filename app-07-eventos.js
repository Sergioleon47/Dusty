/* ================= EVENTOS ================= */
// Varios controles clave de la app (el botón grande de "Escanear", cada tarjeta de
// recibo, las celdas del calendario, el ícono de subir foto) son <div>/<span> con
// onclick nada más — sin tabindex ni rol, un usuario que navega solo con teclado no
// puede llegar a ellos ni activarlos. Se los marca acá, en un solo lugar genérico
// (en vez de repetir tabindex/role/keydown a mano en cada punto de render), así que
// cualquier onclick que ya se les haya asignado en attachEvents() sigue funcionando
// igual con Enter/Espacio.
function makeKeyboardClickable(el){
  // Los atributos se re-ponen SIEMPRE: las plantillas no los emiten, así que
  // morphdom se los quita al nodo conservado en cada parcheo (morphAttrs borra
  // todo atributo que no esté en el HTML nuevo). Por eso mismo el guard de "ya
  // cableado" NO puede vivir en el atributo tabindex — vivía ahí, y como morphdom
  // lo borraba, cada render volvía a pasar el guard y apilaba OTRO listener de
  // keydown en el mismo nodo (Enter disparaba N clicks tras N renders). El guard
  // vive ahora en una propiedad del nodo, que morphdom no toca.
  el.setAttribute('tabindex','0');
  if(!el.hasAttribute('role')) el.setAttribute('role','button');
  if(el.__kbClickable) return;
  el.__kbClickable = true;
  el.addEventListener('keydown', e=>{
    if(e.key==='Enter' || e.key===' '){ e.preventDefault(); el.click(); }
  });
}
/* ===== Accesibilidad de modales, genérica para los ~24 (sin tocar plantillas) =====
   - role="dialog" + aria-modal en cada .modal (atributos idempotentes por render;
     morphdom puede quitarlos al parchear, así que se re-aplican como los tabindex
     de makeKeyboardClickable).
   - Al ABRIR un modal, el foco entra a su primer control y se recuerda dónde
     estaba; al cerrarse el último modal, el foco vuelve ahí — sin esto, un usuario
     de teclado/lector de pantalla quedaba "detrás" del overlay.
   - Trampa de Tab (listener de document, una sola vez): con un modal abierto, Tab
     circula solo entre los controles del modal DE ARRIBA. */
let lastOverlayCount = 0;
let focusBeforeModal = null;
function modalFocusables(overlay){
  return [...overlay.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
    .filter(el=>!el.disabled && el.offsetParent!==null);
}
function topOverlay(){
  const all = document.querySelectorAll('.overlay');
  return all.length ? all[all.length-1] : null;
}
function manageModalA11y(){
  const overlays = document.querySelectorAll('.overlay');
  overlays.forEach(ov=>{
    const modal = ov.querySelector('.modal');
    if(modal){
      modal.setAttribute('role','dialog');
      modal.setAttribute('aria-modal','true');
      ensureModalBackBtn(ov, modal);
    }
  });
  const count = overlays.length;
  if(count > lastOverlayCount){
    // Se abrió un modal: recordar el foco de la página y entrar al modal.
    if(lastOverlayCount === 0) focusBeforeModal = document.activeElement;
    const top = topOverlay();
    // El foco entra al DIÁLOGO (contenedor con tabindex=-1), no a un campo de
    // texto: enfocar un input abría el teclado del teléfono sin que nadie lo
    // pidiera (feedback del usuario). Lectores de pantalla anuncian el diálogo
    // igual, y Tab lleva al primer control cuando el usuario quiere.
    const modalEl = top ? top.querySelector('.modal') : null;
    if(modalEl && (!document.activeElement || !top.contains(document.activeElement))){
      modalEl.setAttribute('tabindex','-1');
      try{ modalEl.focus({preventScroll:true}); }catch(e){}
    }
  } else if(count === 0 && lastOverlayCount > 0){
    // Se cerró el último modal: devolver el foco a donde estaba.
    if(focusBeforeModal && document.contains(focusBeforeModal)){
      try{ focusBeforeModal.focus({preventScroll:true}); }catch(e){}
    }
    focusBeforeModal = null;
  }
  lastOverlayCount = count;
}
/* "ATRÁS" ARRIBA EN TODAS LAS PANTALLAS (pedido del usuario 2026-09-08: "a
   veces entro y no tengo forma de darle atrás"). De 38 modales solo 4 traían
   la ✕ arriba; el resto cerraba con un Cancelar/Cerrar al FINAL (en los
   largos, fuera de la vista) o tocando fuera. Acá se inyecta la misma ✕
   (.modal-close-btn) como primer hijo de cada .modal que no la tenga, y al
   tocarla se usa el cierre PROPIO del modal, sin duplicar lógica: primero el
   botón btn-close-* del modal, si no su btn-cancel-*, y si no hay ninguno
   el toque fuera (mousedown sobre el overlay, que cada uno ya escucha).
   Se salta el de idioma (hay que elegir) y los que ya traen su X propia. */
function ensureModalBackBtn(ov, modal){
  if(ov.id==='lang-choice-overlay') return;
  if(modal.querySelector('.modal-close-btn')) return;
  if(modal.querySelector('button[id$="-x"]')) return;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'modal-close-btn modal-back-btn';
  btn.setAttribute('aria-label', t('btn_close'));
  btn.textContent = '✕';
  btn.onclick = (ev)=>{
    ev.preventDefault(); ev.stopPropagation();
    const own = modal.querySelector('button[id^="btn-close-"]:not(.modal-back-btn)') || modal.querySelector('button[id^="btn-cancel-"]');
    if(own){ own.click(); return; }
    ov.dispatchEvent(new MouseEvent('mousedown', {bubbles:true, cancelable:true}));
  };
  modal.prepend(btn);
}
let modalTabTrapAttached = false;
// "Edit budget" (Dashboard) abre el modal de ajustes pidiendo foco directo en el
// campo de presupuesto — se consume en el attach del overlay, un solo render.
// Selector de archivo + resize para la foto de un producto — lo usan el toque en
// la miniatura sin foto (lista) y el botón "cambiar" del visor de foto.
// afterSet (opcional): corre tras guardar la foto nueva — lo usa el modo fotos
// del Catálogo para subir la foto de una RECETA a Storage (uploadRecipePhoto);
// las fotos de productos no lo necesitan (viajan dentro de su doc de inventario).
// useCamera: abre la CÁMARA del teléfono directo (capture) en vez del selector
// de galería/archivos — reporte del usuario 2026-09-06 sobre el botón del
// Catálogo: "es una cámara, no un scanner", tocar un producto debe disparar la
// cámara al instante. En computadora el atributo se ignora solo (selector normal).
function promptItemPhotoUpload(item, afterSet, useCamera){
  const input = document.createElement('input');
  input.type='file';
  input.accept='image/*';
  if(useCamera) input.setAttribute('capture','environment');
  input.style.display='none';
  document.body.appendChild(input);
  // Si el usuario cierra el selector sin elegir, "change" nunca dispara — sin esto
  // el <input> quedaba huérfano en el body acumulándose en cada intento cancelado.
  // "cancel" no está en todos los navegadores; donde no, el peor caso es el de antes.
  input.addEventListener('cancel', ()=>{ if(input.parentNode) input.parentNode.removeChild(input); });
  input.onchange=async ()=>{
    const file=input.files[0];
    if(input.parentNode) input.parentNode.removeChild(input);
    if(!file || !/^image\//.test(file.type)) return;
    try{
      const img = await loadImageFromFile(file);
      // 400px (auditoría 2026-09-07): el tile de 2 columnas mide ~168px, que en
      // un iPhone (DPR 3) pide ~500px — a 300 se veía blando. 400 a q0.78 pesa
      // ~35KB en base64: entra holgado en localStorage y en el doc de Firestore.
      item.photo = resizeToBase64(img, 400, 0.78);
      // La foto cambió por FUERA del flujo del catálogo: la versión en alta que
      // hubiera quedado ya no corresponde a esta imagen — mejor sin alta que
      // con una vieja de otra foto.
      delete item.photoHiUrl; delete item.photoThumbUrl;
      saveState();
      if(item.inCatalog) scheduleCatalogAutoPublish();
      if(afterSet) afterSet();
      render();
    }catch(err){
      showToast(err.message || t('err_img_process'), 'error');
    }
  };
  input.click();
}
function attachModalTabTrap(){
  if(modalTabTrapAttached) return;
  modalTabTrapAttached = true;
  document.addEventListener('keydown', (e)=>{
    if(e.key !== 'Tab') return;
    const top = topOverlay();
    if(!top) return;
    const focusables = modalFocusables(top);
    if(focusables.length === 0) return;
    const first = focusables[0], last = focusables[focusables.length-1];
    const inside = top.contains(document.activeElement);
    if(!inside){ e.preventDefault(); first.focus(); return; }
    if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
    else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
  });
}
function attachEvents(){
  document.querySelectorAll('.bottom-nav-item').forEach(t=>{ t.onclick=()=>{ switchToTab(t.dataset.tab); }; });
  manageModalA11y();
  attachModalTabTrap();
  document.querySelectorAll('#btn-scan-fab, [data-view-receipt], [data-cal-day], [data-photo-item], [data-open-item], [data-history-item], [data-cat-toggle], [data-assign-photo], #btn-critical-alerts').forEach(makeKeyboardClickable);
  attachViewSwipeHandlers();
  attachCategoryChipDragHandlers();
  const btnLangToggle=document.getElementById('btn-lang-toggle');
  if(btnLangToggle) btnLangToggle.onclick=()=>setLang(uiLang==='es'?'en':'es');
  // Latidos de aviso (Ajustes): interruptor, se aplica al instante y queda en el
  // dispositivo — misma mecánica que el tema.
  const pulseToggle=document.getElementById('pulse-toggle');
  if(pulseToggle) pulseToggle.onchange=()=>{
    dustyPulse = !!pulseToggle.checked;
    applyPulsePref();
    try{ localStorage.setItem('patron_pulse', dustyPulse ? 'on' : 'off'); }catch(e){}
    render();
  };
  // Tema de colores (Ajustes): se aplica AL INSTANTE con el atributo en <html>
  // — el CSS hace el resto — y queda guardado en el dispositivo. Sin Guardar.
  document.querySelectorAll('[data-set-theme]').forEach(b=>{
    b.onclick=()=>{
      const id=b.dataset.setTheme;
      if(dustyTheme===id) return;
      dustyTheme=id;
      if(id==='night') document.documentElement.removeAttribute('data-dusty-theme');
      else document.documentElement.setAttribute('data-dusty-theme', id);
      try{ localStorage.setItem('patron_theme', id); }catch(e){}
      render(); // re-pinta el selector con el circulito activo nuevo
    };
  });
  // El "?" abre la hoja de AYUDA; el reporte de problemas está al pie de esa hoja.
  // Ayuda vive en Ajustes (Dashboard reorganizado 2026-09-07): se cierra Ajustes,
  // se abre la hoja, y al cerrarla se vuelve a Ajustes (settingsReturnPending).
  const btnFeedback=document.getElementById('btn-feedback');
  if(btnFeedback) btnFeedback.onclick=()=>{ if(showAlertSettingsModal){ settingsReturnPending=true; showAlertSettingsModal=false; } openHelpModal(); };
  // "Hoy" del Dashboard: cada número abre el Inventario ya filtrado (filtros
  // rápidos); Salud del stock lo abre entero.
  document.querySelectorAll('[data-dash-stat]').forEach(b=>{
    b.onclick=()=>{
      const k=b.dataset.dashStat;
      invQuickFilter = (k==='crit'||k==='count') ? k : null;
      inventoryCategoryFilter=null; invSearch='';
      if(activeTab==='inventario') render(); else switchToTab('inventario');
    };
  });
  const helpOverlay=document.getElementById('help-overlay');
  if(helpOverlay){
    helpOverlay.onmousedown=(e)=>{ if(e.target===helpOverlay) closeHelpModal(); };
    const btnCloseHelp=document.getElementById('btn-close-help');
    if(btnCloseHelp) btnCloseHelp.onclick=closeHelpModal;
    const btnHelpReport=document.getElementById('btn-help-report');
    if(btnHelpReport) btnHelpReport.onclick=()=>{ closeHelpModal(); openFeedbackModal(); };
    // Acordeón: abrir una pregunta cierra las demás (una respuesta a la vez).
    helpOverlay.querySelectorAll('details.help-q').forEach(d=>{
      d.ontoggle=()=>{ if(d.open) helpOverlay.querySelectorAll('details.help-q').forEach(o=>{ if(o!==d) o.open=false; }); };
    });
  }
  // Tarjeta "Mejor en equipo" (una vez, al primer Compartir).
  const teamIntroOverlay=document.getElementById('team-intro-overlay');
  if(teamIntroOverlay){
    teamIntroOverlay.onmousedown=(e)=>{ if(e.target===teamIntroOverlay) closeTeamIntroModal(false); };
    const btnTeamIntroGo=document.getElementById('btn-team-intro-go');
    if(btnTeamIntroGo) btnTeamIntroGo.onclick=()=>closeTeamIntroModal(true);
  }
  // Primeros pasos del tablero vacío.
  const fsScan=document.getElementById('fs-scan');
  if(fsScan){ fsScan.onclick=openScanModal; fsScan.onkeydown=(e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); openScanModal(); } }; }
  const btnBudgetAlert=document.getElementById('btn-budget-alert');
  if(btnBudgetAlert){ btnBudgetAlert.onclick=openBudgetModal; btnBudgetAlert.onkeydown=(e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); openBudgetModal(); } }; }
  const fsBudget=document.getElementById('fs-budget');
  if(fsBudget){ fsBudget.onclick=openBudgetModal; fsBudget.onkeydown=(e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); openBudgetModal(); } }; }
  // Botones de los estados vacíos de Inventario y Recibos.
  const btnInvEmptyScan=document.getElementById('btn-inv-empty-scan');
  if(btnInvEmptyScan) btnInvEmptyScan.onclick=openScanModal;
  const btnInvEmptyManual=document.getElementById('btn-inv-empty-manual');
  if(btnInvEmptyManual) btnInvEmptyManual.onclick=()=>openItemModal(null);
  const btnRecEmptyScan=document.getElementById('btn-rec-empty-scan');
  if(btnRecEmptyScan) btnRecEmptyScan.onclick=openScanModal;
  // Alta rápida → ficha completa.
  const btnItemMore=document.getElementById('btn-item-more');
  if(btnItemMore) btnItemMore.onclick=expandItemModal;
  const feedbackOverlay=document.getElementById('feedback-overlay');
  if(feedbackOverlay){
    feedbackOverlay.onmousedown=(e)=>{ if(e.target===feedbackOverlay) closeFeedbackModal(); };
    const btnCancelFeedback=document.getElementById('btn-cancel-feedback');
    if(btnCancelFeedback) btnCancelFeedback.onclick=closeFeedbackModal;
    const btnCloseFeedback=document.getElementById('btn-close-feedback');
    if(btnCloseFeedback) btnCloseFeedback.onclick=closeFeedbackModal;
    const feedbackMsgInp=document.getElementById('feedback-message');
    if(feedbackMsgInp) feedbackMsgInp.oninput=(e)=>{ feedbackMessage=e.target.value; };
    const btnSendFeedback=document.getElementById('btn-send-feedback');
    if(btnSendFeedback) btnSendFeedback.onclick=sendFeedback;
  }
  // La nube ya NO abre el modal de equipo (arrancado de raíz 2026-09-04: eso
  // vive en "Compartir cuenta" del menú del Dashboard) — queda como indicador
  // de sincronización; tocarla dice el estado en un toast.
  const btnCloudSync=document.getElementById('btn-cloud-sync');
  if(btnCloudSync) btnCloudSync.onclick=()=>{
    showToast(cloudSyncDirty ? t('cloud_sync_pending') : t('cloud_sync_signed_in').replace('{email}', currentUserLabel()), cloudSyncDirty ? 'info' : 'success');
  };
  const btnCloudSignIn=document.getElementById('btn-cloud-sign-in');
  if(btnCloudSignIn) btnCloudSignIn.onclick=()=>{
    // El modal no necesita el SDK para dibujarse — se abre al toque y Firebase
    // se precalienta atrás (los botones de adentro ya esperan la carga solos).
    ensurePatronFirebaseReady().catch(()=>{});
    // Sesión anónima del trial: el mismo botón ofrece GUARDAR la cuenta (convertirla
    // en real conservando los datos) en vez del login común.
    if(currentUser && currentUser.isAnonymous) openUpgradeModal();
    else openAuthModal();
  };

  /* Modal de equipo (compartir inventario) */
  const teamOverlay=document.getElementById('team-overlay');
  if(teamOverlay){
    teamOverlay.onmousedown=(e)=>{ if(e.target===teamOverlay) closeTeamModal(); };
    document.getElementById('btn-close-team').onclick=closeTeamModal;
    const btnCloseTeamX=document.getElementById('btn-close-team-x');
    if(btnCloseTeamX) btnCloseTeamX.onclick=closeTeamModal;
    // Toggle del dueño: ganancias/Valor visibles para miembros — viaja por meta.
    const teamProfitsCb=document.getElementById('team-profits-visible');
    if(teamProfitsCb) teamProfitsCb.onchange=()=>{
      profitsVisibleToMembers = teamProfitsCb.checked;
      saveState();
    };
    const btnCopyCode=document.getElementById('btn-copy-invite-code');
    if(btnCopyCode) btnCopyCode.onclick=()=>{
      copyInviteCode();
      const original=btnCopyCode.textContent;
      btnCopyCode.textContent=t('team_copied');
      setTimeout(()=>{ btnCopyCode.textContent=original; }, 1500);
    };
    const btnShareCode=document.getElementById('btn-share-invite-code');
    if(btnShareCode) btnShareCode.onclick=shareInviteCode;
    const btnLeaveTeam=document.getElementById('btn-leave-team');
    if(btnLeaveTeam) btnLeaveTeam.onclick=leaveTeam;
    const teamJoinInput=document.getElementById('team-join-input');
    if(teamJoinInput) teamJoinInput.oninput=(e)=>{ teamJoinCode=e.target.value; };
    const btnJoinTeam=document.getElementById('btn-join-team');
    if(btnJoinTeam) btnJoinTeam.onclick=joinTeam;
    document.querySelectorAll('[data-remove-member]').forEach(btn=>{
      btn.onclick=()=>removeMember(btn.getAttribute('data-remove-member'));
    });
  }

  /* Modal de inicio de sesión */
  const authOverlay=document.getElementById('auth-overlay');
  if(authOverlay){
    authOverlay.onmousedown=(e)=>{ if(e.target===authOverlay) closeAuthModal(); };
    document.getElementById('btn-cancel-auth').onclick=closeAuthModal;
    const switchSignup=document.getElementById('btn-switch-signup');
    if(switchSignup) switchSignup.onclick=(e)=>{ e.preventDefault(); authMode='signup'; authError=''; render(); };
    const switchSignin=document.getElementById('btn-switch-signin');
    if(switchSignin) switchSignin.onclick=(e)=>{ e.preventDefault(); authMode='signin'; authError=''; render(); };
    const switchJoin=document.getElementById('btn-switch-join');
    if(switchJoin) switchJoin.onclick=(e)=>{ e.preventDefault(); authMode='join'; authError=''; render(); };
    const switchPinlogin=document.getElementById('btn-switch-pinlogin');
    if(switchPinlogin) switchPinlogin.onclick=(e)=>{ e.preventDefault(); authMode='pinlogin'; authError=''; render(); };
    // Los campos de abajo solo existen en algunos de los modos (signin/signup vs.
    // join vs. pinlogin) — cada uno se cablea solo si el modo actual lo dibujó.
    const googleBtn=document.getElementById('btn-google-auth');
    if(googleBtn) googleBtn.onclick=signInWithGoogle;
    const emailInp=document.getElementById('auth-email');
    if(emailInp) emailInp.oninput=(e)=>{ authEmail=e.target.value; };
    const passwordInp=document.getElementById('auth-password');
    if(passwordInp) passwordInp.oninput=(e)=>{ authPassword=e.target.value; };
    const forgotBtn=document.getElementById('btn-forgot-password');
    if(forgotBtn) forgotBtn.onclick=()=>{
      const email=document.getElementById('auth-email').value.trim();
      if(!email){ authError=t('auth_err_need_email'); render(); return; }
      authLoading=true; authError=''; render();
      firebase.auth().sendPasswordResetEmail(email).then(()=>{
        authError=t('auth_reset_sent');
      }).catch(err=>{
        authError=authErrorMessage(err.code);
      }).then(()=>{
        authLoading=false; render();
      });
    };
    const joinCodeInp=document.getElementById('auth-join-code');
    if(joinCodeInp) joinCodeInp.oninput=(e)=>{ authJoinCode=e.target.value; };
    const nameInp=document.getElementById('auth-name');
    if(nameInp) nameInp.oninput=(e)=>{ authName=e.target.value; };
    const pinInp=document.getElementById('auth-pin');
    if(pinInp) pinInp.oninput=(e)=>{ authPin=e.target.value; };
    const pinConfirmInp=document.getElementById('auth-pin-confirm');
    if(pinConfirmInp) pinConfirmInp.oninput=(e)=>{ authPinConfirm=e.target.value; };
    document.getElementById('btn-submit-auth').onclick=()=>{
      if(authMode==='join'){ submitQuickJoin(); return; }
      if(authMode==='pinlogin'){ submitPinLogin(); return; }
      if(authMode==='upgrade'){ submitUpgrade(); return; }
      const email=document.getElementById('auth-email').value.trim();
      const password=document.getElementById('auth-password').value;
      if(!email || !password){ authError=t('auth_err_need_both'); render(); return; }
      authLoading=true; authError=''; render();
      const action = authMode==='signup'
        ? firebase.auth().createUserWithEmailAndPassword(email, password)
        : firebase.auth().signInWithEmailAndPassword(email, password);
      action.catch(err=>{
        authError=authErrorMessage(err.code);
      }).then(()=>{
        authLoading=false; render();
      });
    };
  }

  const btnOpenMonthlySpend = document.getElementById('btn-open-monthly-spend');
  if(btnOpenMonthlySpend) btnOpenMonthlySpend.onclick = openMonthlySpendModal;
  const monthlySpendOverlay = document.getElementById('monthly-spend-overlay');
  if(monthlySpendOverlay){
    monthlySpendOverlay.onmousedown=(e)=>{ if(e.target===monthlySpendOverlay) closeMonthlySpendModal(); };
    const closeMonthlySpendBtn = document.getElementById('btn-close-monthly-spend');
    if(closeMonthlySpendBtn) closeMonthlySpendBtn.onclick = closeMonthlySpendModal;
    const btnMonthlyRecap = document.getElementById('btn-monthly-open-recap');
    if(btnMonthlyRecap) btnMonthlyRecap.onclick = ()=>{ closeMonthlySpendModal(); monthRecapKey=localMonthStr(); recapMode='month'; showMonthRecap=true; render(); };
  }
  // Formato de montos: se aplica al toque (sin esperar Guardar).
  const moneyFmtSel=document.getElementById('money-format-select');
  if(moneyFmtSel) moneyFmtSel.onchange=()=>{ setMoneyFormatPref(moneyFmtSel.value); render(); };

  const langChoiceOverlay = document.getElementById('lang-choice-overlay');
  if(langChoiceOverlay){
    // Cerrar tocando el fondo (sin elegir) sigue de largo con la adivinanza inicial —
    // igual que cualquier otro overlay de la app, no queda trabado si alguien lo toca
    // sin querer.
    langChoiceOverlay.onmousedown=(e)=>{ if(e.target===langChoiceOverlay) chooseLangAndContinue(uiLang); };
    document.querySelectorAll('[data-choose-lang]').forEach(btn=>{
      btn.onclick = ()=> chooseLangAndContinue(btn.dataset.chooseLang);
    });
  }

  const welcomeOverlay = document.getElementById('welcome-overlay');
  if(welcomeOverlay){
    welcomeOverlay.onmousedown=(e)=>{ if(e.target===welcomeOverlay) closeWelcomeModal(); };
    const welcomeNextBtn = document.getElementById('btn-welcome-next');
    if(welcomeNextBtn) welcomeNextBtn.onclick = advanceWelcomeStep;
    const welcomeBackBtn = document.getElementById('btn-welcome-back');
    if(welcomeBackBtn) welcomeBackBtn.onclick = retreatWelcomeStep;
    const welcomeSkipBtn = document.getElementById('btn-welcome-skip');
    if(welcomeSkipBtn) welcomeSkipBtn.onclick = closeWelcomeModal;
    const welcomeDashBtn = document.getElementById('btn-welcome-dashboard');
    if(welcomeDashBtn) welcomeDashBtn.onclick = closeWelcomeModal;
    document.querySelectorAll('[data-jump-step]').forEach(dot=>{
      dot.onclick = ()=> jumpToWelcomeStep(+dot.dataset.jumpStep);
    });
    // Deslizar el dedo (o arrastrar con el mouse) sobre la tarjeta del paso para
    // avanzar/retroceder, además de los botones — un umbral de 40px evita que un
    // toque que solo quiso tocar la tarjeta dispare un cambio de paso sin querer.
    const welcomeStepCard = document.querySelector('.welcome-step-card');
    if(welcomeStepCard){
      welcomeStepCard.onpointerdown=(e)=>{ welcomeSwipeStartX = e.clientX; };
      welcomeStepCard.onpointerup=(e)=>{
        if(welcomeSwipeStartX===null) return;
        const dx = e.clientX - welcomeSwipeStartX;
        welcomeSwipeStartX = null;
        if(Math.abs(dx) < 40) return;
        if(dx < 0) advanceWelcomeStep(); else retreatWelcomeStep();
      };
    }
  }

  const btnNewItem=document.getElementById('btn-new-item'); if(btnNewItem) btnNewItem.onclick=()=>openItemModal(null);
  // Gestión de categorías y conteo cíclico viven en Ajustes (2026-09-04) — al
  // abrirlos se cierra el modal de Ajustes primero (si no, quedaba encima).
  const btnManageCategories=document.getElementById('btn-manage-categories');
  if(btnManageCategories) btnManageCategories.onclick=()=>{ settingsReturnPending=true; showAlertSettingsModal=false; openCategoriesModal(); };
  // "Compartir cuenta" (menú del Dashboard): con sesión real abre el modal de
  // equipo directo; trial anónimo → guardar la cuenta primero; sin sesión →
  // login. Mismo criterio que los botones de nube del topbar.
  // La tarjeta "Mejor en equipo" (ex paso 3 del tutorial) se muestra acá, la
  // primera vez — en el momento en que sirve — y después sigue con lo de siempre.
  // El mismo flujo sirve al botón del menú del Dashboard y al de Cuenta en
  // Ajustes (auditoría 2026-09-07); desde Cuenta se cierra ese submodal antes.
  const shareAccountFlow=()=>openTeamIntroOrContinue(()=>{
    if(currentUser && !currentUser.isAnonymous){ openTeamModal(); return; }
    ensurePatronFirebaseReady().catch(()=>{});
    if(currentUser && currentUser.isAnonymous) openUpgradeModal();
    else openAuthModal();
  });
  const btnShareAccount=document.getElementById('btn-share-account');
  if(btnShareAccount) btnShareAccount.onclick=shareAccountFlow;
  const btnShareAccountSettings=document.getElementById('btn-share-account-settings');
  if(btnShareAccountSettings) btnShareAccountSettings.onclick=()=>{ settingsReturnPending=false; showAccountModal=false; shareAccountFlow(); };
  document.querySelectorAll('[data-open-category]').forEach(btn=>{
    btn.onclick=()=>{
      inventoryCategoryFilter = btn.dataset.openCategory;
      // Los chips viven en Inventario (intercambio 2026-09-04): estando ahí,
      // switchToTab a la misma pestaña solo "asienta" sin redibujar — el filtro
      // recién elegido necesita un render explícito.
      if(activeTab==='inventario') render(); else switchToTab('inventario');
    };
  });
  const btnClearCategoryFilter=document.getElementById('btn-clear-category-filter');
  if(btnClearCategoryFilter) btnClearCategoryFilter.onclick=()=>{ inventoryCategoryFilter=null; render(); };

  const categoriesOverlay=document.getElementById('categories-overlay');
  if(categoriesOverlay){
    categoriesOverlay.onmousedown=(e)=>{ if(e.target===categoriesOverlay) closeCategoriesModal(); };
    const btnCancelCategories=document.getElementById('btn-cancel-categories');
    if(btnCancelCategories) btnCancelCategories.onclick=closeCategoriesModal;
    document.querySelectorAll('[data-category-name]').forEach(inp=>{
      inp.oninput=()=>{ draftCategories[parseInt(inp.dataset.categoryName,10)].name = inp.value; };
    });
    document.querySelectorAll('[data-remove-category]').forEach(btn=>{
      btn.onclick=()=>{ draftCategories.splice(parseInt(btn.dataset.removeCategory,10),1); render(); };
    });
    // Reordenar categorías: presionar y arrastrar una fila (el input y la x quedan
    // afuera del gesto, ver el chequeo de closest() más abajo). Handlers como
    // propiedades on* (no addEventListener): desde que renderApp() parchea el DOM
    // con morphdom, una fila puede SOBREVIVIR al render — asignar la propiedad pisa
    // el handler viejo en vez de apilar uno nuevo, y el estado del gesto (pendingTimer)
    // arranca limpio en cada re-cableado. Los listeners de document que arma un
    // arrastre se siguen sacando solos al soltar.
    document.querySelectorAll('.category-edit-row[data-cat-id]').forEach(row=>{
      const list = row.closest('.category-edit-list');
      let pendingTimer = null, pendingStart = null;
      const cancelPending = (e)=>{
        if(pendingTimer && (!e || e.pointerId===pendingStart.pointerId)){ clearTimeout(pendingTimer); pendingTimer=null; }
      };
      row.onpointerdown=(e)=>{
        if(e.pointerType==='mouse' && e.button!==0) return;
        if(pendingTimer || e.target.closest('input, .stock-row-x-btn')) return;
        pendingStart = {x:e.clientX, y:e.clientY, pointerId:e.pointerId};
        pendingTimer = setTimeout(()=>{
          pendingTimer = null;
          beginCategoryDrag(row, list, pendingStart.pointerId, pendingStart.y);
        }, 350);
      };
      row.onpointermove=(e)=>{
        if(!pendingTimer || e.pointerId!==pendingStart.pointerId) return;
        if(Math.abs(e.clientX-pendingStart.x)>10 || Math.abs(e.clientY-pendingStart.y)>10) cancelPending(e);
      };
      row.onpointerup=cancelPending;
      row.onpointercancel=cancelPending;
    });
    const newCategoryInput=document.getElementById('new-category-name');
    const addCategory=()=>{
      const name=(newCategoryInput.value||'').trim();
      if(!name) return;
      draftCategories.push({id:uid('cat'), name});
      render();
    };
    const btnAddCategory=document.getElementById('btn-add-category');
    if(btnAddCategory) btnAddCategory.onclick=addCategory;
    if(newCategoryInput) newCategoryInput.onkeydown=(e)=>{ if(e.key==='Enter'){ e.preventDefault(); addCategory(); } };
    const btnSaveCategories=document.getElementById('btn-save-categories');
    if(btnSaveCategories) btnSaveCategories.onclick=()=>{
      const cleaned = draftCategories.map(c=>({id:c.id, name:c.name.trim()})).filter(c=>c.name);
      // Cualquier categoría que estaba antes y ya no está en la lista guardada (se
      // borró o se descartó por quedar sin nombre) deja huérfanos a los productos que
      // la tenían asignada — se les saca la categoría en vez de dejarlos apuntando a
      // un id que ya no existe en ningún lado. inventarioView ya los agrupa aparte
      // en "Sin categoría" cuando categoryId no matchea ninguna categoría real, pero
      // limpiar el dato ahora evita que revivan solos si la categoría se recrea después
      // con el mismo nombre (nuevo id, ya no sería la misma).
      const keptIds = new Set(cleaned.map(c=>c.id));
      const removedIds = new Set(categories.filter(c=>!keptIds.has(c.id)).map(c=>c.id));
      if(removedIds.size>0){
        inventory.forEach(i=>{ if(i.categoryId && removedIds.has(i.categoryId)) i.categoryId=null; });
      }
      categories = cleaned;
      saveState();
      closeCategoriesModal();
    };
  }
  const btnExportData=document.getElementById('btn-export-data'); if(btnExportData) btnExportData.onclick=()=>exportData();
  const btnImportData=document.getElementById('btn-import-data'); const importFileInput=document.getElementById('import-file-input');
  if(btnImportData && importFileInput) btnImportData.onclick=()=>importFileInput.click();
  if(importFileInput) importFileInput.onchange=(e)=>{ const f=e.target.files[0]; importFileInput.value=''; if(f) importData(f); };
  const openAlertSettings=()=>{
    draftThreshold=priceAlertThreshold;
    draftBusinessName=businessName;
    draftMonthlyBudget=monthlyBudget;
    showAlertSettingsModal=true; render();
  };
  const btnAlertSettings=document.getElementById('btn-alert-settings');
  if(btnAlertSettings) btnAlertSettings.onclick=openAlertSettings;
  // El lápiz del presupuesto abre su propio mini-modal (budgetModal, app-05) —
  // el presupuesto salió de Ajustes de raíz (pedido del usuario 2026-09-04).
  const btnEditBudget=document.getElementById('btn-edit-budget');
  if(btnEditBudget) btnEditBudget.onclick=openBudgetModal;
  const budgetOverlay=document.getElementById('budget-overlay');
  if(budgetOverlay){
    budgetOverlay.onmousedown=(e)=>{ if(e.target===budgetOverlay) closeBudgetModal(); };
    const btnCancelBudget=document.getElementById('btn-cancel-budget');
    if(btnCancelBudget) btnCancelBudget.onclick=closeBudgetModal;
    const btnSaveBudget=document.getElementById('btn-save-budget');
    if(btnSaveBudget) btnSaveBudget.onclick=()=>{
      // Solo quien ve finanzas cambia el monto (auditoría 2026-09-07); cero o
      // negativo = vacío (antes se guardaba un 0 que no era ni presupuesto ni vacío).
      if(canSeeFinancials()){
        const budgetRaw=document.getElementById('budget-input').value.trim();
        const v = budgetRaw==='' ? null : parseFloat(budgetRaw);
        setMonthlyBudget((Number.isFinite(v) && v>0) ? v : null);
        const cogsInp=document.getElementById('cogs-target-input');
        if(cogsInp){ const c=parseFloat(cogsInp.value); budgetMeta.cogsTargetPct = (Number.isFinite(c) && c>0 && c<100) ? c : null; }
        const roll=document.getElementById('budget-rollover-input');
        if(roll) budgetMeta.rollover = !!roll.checked;
        // Topes por categoría: vacío o 0 = sin tope.
        const caps={};
        document.querySelectorAll('[data-cat-cap]').forEach(inp=>{ const v=parseFloat(inp.value); if(Number.isFinite(v) && v>0) caps[inp.dataset.catCap]=Math.round(v*100)/100; });
        budgetMeta.byCategory = caps;
        resetFinancialCache();
      }
      saveState();
      closeBudgetModal();
    };
    // Agregar gasto/servicio a mano: la ficha de siempre, prellenada con unidad
    // "servicio" — con esa unidad el ítem queda clasificado como gasto solo
    // (isExpenseItem) y vive acá, nunca en el inventario.
    const btnAddExpense=document.getElementById('btn-add-expense-item');
    if(btnAddExpense) btnAddExpense.onclick=()=>{
      openItemModal(null);
      if(draftItem){ draftItem.unit='servicio'; render(); }
    };
    // Fotografiar la boleta: el escáner de recibos de siempre (cierra Budget
    // primero — el escáner es pantalla completa y maneja solo trial/login).
    const btnScanBill=document.getElementById('btn-scan-bill');
    if(btnScanBill) btnScanBill.onclick=()=>{ closeBudgetModal(); openScanModal(); };
    // Cruce con el Cierre de mes del mes actual.
    const btnBudgetRecap=document.getElementById('btn-budget-open-recap');
    if(btnBudgetRecap) btnBudgetRecap.onclick=()=>{ closeBudgetModal(); monthRecapKey=localMonthStr(); recapMode='month'; showMonthRecap=true; render(); };
    // ＋ por fila: registra el pago de ESTE mes del bill (recibo manual de
    // gasto) sin abrir nada — la barra del presupuesto reacciona al instante.
    // stopPropagation: la fila entera abre la ficha, el ＋ no debe hacerlo.
    document.querySelectorAll('[data-pay-bill]').forEach(b=>{
      b.onclick=(e)=>{
        e.stopPropagation();
        const item=inventory.find(i=>i.id===b.dataset.payBill);
        if(!item) return;
        if(!(item.costPerUnit>0)){ showToast(t('expense_pay_no_amount'), 'error'); return; }
        receipts.push({
          id: uid('r'), images: [], supplier: item.name, date: localDateStr(),
          total: Math.round(item.costPerUnit*100)/100, itemCount: 0, appliedItems: [],
          createdAt: new Date().toISOString(), purchaseIds: [], manual: true,
          manualKind: 'expense', billItemId: item.id
        });
        saveState();
        showToast(t('expense_payment_logged').replace('{name}', item.name));
        render();
      };
    });
  }

  /* Catálogo para clientes — pestaña propia (catalogoView, app-05). Sus nodos
     viven SIEMPRE en el DOM (las 4 páginas del carrusel se renderizan juntas),
     así que se enganchan directo, sin overlay que chequear. */
  {
    // El número se guarda al confirmar el campo (y también al publicar) — así
    // sobrevive salir de la pestaña sin publicar.
    const waInp=document.getElementById('catalog-wa-input');
    if(waInp) waInp.onchange=()=>{ catalogWhatsApp=waInp.value.trim(); saveState(); };
    // La selección vive EN cada ítem/receta (inCatalog) y sincroniza con ellos.
    // Tarjeta-botón como en el Inventario: tocarla marca/desmarca (el render
    // repinta el ✓ y el atenuado). Sello de edición en recetas: el merge por
    // lastEditedAt (app-02) necesita saber que esta copia es la más nueva, o un
    // snapshot viejo desmarcaría.
    // FAB de cámara (capture: dispara la cámara del teléfono al toque) y botón
    // de galería (sin capture: abre la fototeca) — los dos desembocan en el
    // mismo modal de asignar. input.click() corre DENTRO del gesto del usuario,
    // obligatorio para que iOS lo acepte.
    const openCatalogPhotoPicker=(useCamera)=>{
      const input=document.createElement('input');
      input.type='file'; input.accept='image/*';
      if(useCamera) input.setAttribute('capture','environment');
      input.style.display='none';
      document.body.appendChild(input);
      input.addEventListener('cancel', ()=>{ if(input.parentNode) input.parentNode.removeChild(input); });
      input.onchange=async ()=>{
        const file=input.files[0];
        if(input.parentNode) input.parentNode.removeChild(input);
        if(!file || !/^image\//.test(file.type)) return;
        try{
          const img=await loadImageFromFile(file);
          showCatalogCameraModal=false; // con foto elegida, el modal de cámara cede al de asignar
          catalogPendingOriginal = resizeToBase64(img, 400, 0.78);
          catalogPendingPhoto = catalogPendingOriginal;
          catalogPendingFilter = 'original';
          catalogAssignSuggestion = null;
          // Base COMPLETA para el editor (recorte/ajustes se hornean desde acá,
          // no desde el thumbnail) — la misma imagen alimenta a la IA de abajo.
          // 1600px q0.92: la base de calidad del catálogo (la alta se hornea de acá).
          catalogEditFull = resizeToBase64(img, 1600, 0.92);
          catalogEdit = Object.assign({}, CATALOG_EDIT_DEFAULTS);
          catalogEditorOpen = false; catalogEditPreviewUrl = null;
          catalogEditCutout = null; catalogEditFullBackup = null; catalogEditBg='#ffffff'; catalogRemovingBg=false;
          // Cámara inteligente: la IA identifica el producto EN PARALELO mientras
          // el modal ya está abierto — la foto para la IA va a 1400px (a 300px el
          // thumbnail no alcanza para leer etiquetas). Solo cuentas reales (gasta
          // 1 escaneo del cupo); si falla o no reconoce, silencio y lista manual.
          // Aviso de calidad (no bloquea: la vista previa y el editor están ahí mismo).
          try{ const w = assessImageQuality(img); if(w) showToast(t('scan_quality_'+w)+'. '+t('catalog_quality_hint'), 'error'); }catch(e){}
          const canDetect = catalogSuggestOn && currentUser && !currentUser.isAnonymous
            && (inventory.some(i=>i && !isExpenseItem(i)) || recipes.some(r=>r && r.id));
          if(canDetect){
            const detectImg = catalogEditFull;
            const reqId = ++catalogAssignReqId;
            catalogAssignDetecting = true;
            identifyProductFromPhoto(detectImg).then(res=>{
              if(reqId!==catalogAssignReqId || !catalogPendingOriginal) return;
              catalogAssignDetecting = false;
              catalogAssignSuggestion = resolveCatalogSuggestion(res);
              render();
            }).catch(()=>{
              if(reqId!==catalogAssignReqId) return;
              catalogAssignDetecting = false;
              render();
            });
          }
          render();
        }catch(err){ showToast(err.message || t('err_img_process'), 'error'); }
      };
      input.click();
    };
    // Cámara SIN capture (fusión con Galería, pedido del usuario): la hoja
    // nativa del teléfono ofrece "Tomar foto" y "Fototeca" en el mismo toque.
    // Intro única (2026-09-07): la misma hoja de fotos que los tres escáneres —
    // nativa en iOS (input sin capture), de Dusty en Android (elige el input).
    // Intro única (captura del usuario 2026-09-07): el botón abre el MISMO modal
    // con caja punteada que los tres escáneres; la hoja de fotos, al tocar la caja.
    const btnCatalogPhoto=document.getElementById('btn-catalog-photo');
    if(btnCatalogPhoto) btnCatalogPhoto.onclick=()=>{ showCatalogCameraModal=true; render(); };
    const catCamOverlay=document.getElementById('catalog-camera-overlay');
    if(catCamOverlay){
      const closeCatCam=()=>{ showCatalogCameraModal=false; render(); };
      catCamOverlay.onmousedown=(e)=>{ if(e.target===catCamOverlay) closeCatCam(); };
      document.getElementById('btn-cancel-catalog-camera').onclick=closeCatCam;
      // La caja abre la cámara directo; el link, la galería (intro única final).
      document.getElementById('catalog-drop-zone').onclick=()=>openCatalogPhotoPicker(true);
      const btnCatGallery=document.getElementById('btn-catalog-gallery');
      if(btnCatGallery) btnCatGallery.onclick=()=>openCatalogPhotoPicker(false);
    }
    // Interruptor "Reconocer el producto con IA" en el modal de asignar: preferencia
    // del dispositivo; al prenderlo con una foto pendiente, reconoce ahora.
    const catSuggestToggle=document.getElementById('catalog-suggest-toggle');
    if(catSuggestToggle) catSuggestToggle.onchange=()=>{
      catalogSuggestOn = !!catSuggestToggle.checked;
      try{ localStorage.setItem('patron_catalog_suggest', catalogSuggestOn ? 'on' : 'off'); }catch(e){}
      if(catalogSuggestOn && catalogEditFull && !catalogAssignSuggestion && !catalogAssignDetecting && currentUser && !currentUser.isAnonymous){
        const reqId = ++catalogAssignReqId;
        catalogAssignDetecting = true; render();
        identifyProductFromPhoto(catalogEditFull).then(res=>{
          if(reqId!==catalogAssignReqId || !catalogPendingOriginal) return;
          catalogAssignDetecting = false; catalogAssignSuggestion = resolveCatalogSuggestion(res); render();
        }).catch(()=>{ if(reqId!==catalogAssignReqId) return; catalogAssignDetecting = false; render(); });
      } else render();
    };
    {
    }
    // COLLAGE — DISEÑO PRIMERO (pedido del usuario 2026-09-06): tocar Collage
    // abre el menú de layouts; elegir uno dispara el selector de fotos con la
    // cantidad exacta que ese diseño necesita.
    // PLANTILLAS (pedido del usuario 2026-09-07): abre el modal y arma la vista
    // previa; cada chip re-arma la página (sin esperar Guardar).
    const btnCatalogTemplates=document.getElementById('btn-catalog-templates');
    // La galería de miniaturas se dibuja DESPUÉS de la vista previa grande (la
    // grande es lo primero que se ve); cambiar formato/estilo/alcance las re-dibuja.
    if(btnCatalogTemplates) btnCatalogTemplates.onclick=()=>{ showTemplateModal=true; tplPage=0; tplPreviewUrl=null; render(); refreshTemplatePreview().then(refreshTemplateThumbs); };
    const tplOverlay=document.getElementById('template-overlay');
    if(tplOverlay){
      const closeTpl=()=>{ showTemplateModal=false; tplPreviewUrl=null; tplReq++; tplThumbsReq++; render(); };
      tplOverlay.onmousedown=(e)=>{ if(e.target===tplOverlay) closeTpl(); };
      document.getElementById('btn-close-template').onclick=closeTpl;
      const rerender=()=>{ tplPreviewUrl=null; render(); refreshTemplatePreview().then(refreshTemplateThumbs); };
      document.querySelectorAll('[data-tpl-kind]').forEach(b=>{ b.onclick=()=>{ tplKind=b.dataset.tplKind; tplPage=0; rerender(); }; });
      document.querySelectorAll('[data-tpl-format]').forEach(b=>{ b.onclick=()=>{ tplFormat=b.dataset.tplFormat; tplPage=0; rerender(); }; });
      document.querySelectorAll('[data-tpl-style]').forEach(b=>{ b.onclick=()=>{ tplStyle=b.dataset.tplStyle; rerender(); }; });
      document.querySelectorAll('[data-tpl-scope]').forEach(b=>{ b.onclick=()=>{ tplScope=b.dataset.tplScope; tplPage=0; rerender(); }; });
      const offerSel=document.getElementById('tpl-offer-select');
      if(offerSel) offerSel.onchange=()=>{ tplOfferId=offerSel.value; rerender(); };
      const prev=document.getElementById('tpl-prev'), next=document.getElementById('tpl-next');
      if(prev) prev.onclick=()=>{ if(tplPage>0){ tplPage--; rerender(); } };
      if(next) next.onclick=()=>{ tplPage++; rerender(); };
      // Guardar: descarga la página actual (en iOS abre la imagen; ahí se guarda
      // con "Guardar imagen" o por Compartir). Compartir: TODAS las páginas como
      // archivos por la hoja nativa; sin hoja, descarga y avisa.
      const dl=(file)=>{ const a=document.createElement('a'); a.href=URL.createObjectURL(file); a.download=file.name; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 1500); };
      const btnSave=document.getElementById('btn-save-template');
      if(btnSave) btnSave.onclick=async ()=>{
        try{ btnSave.disabled=true; const files=await templatePageFiles(); const f=files[tplPage]||files[0]; if(f){ dl(f); showToast(t('tpl_saved')); } }
        catch(e){ showToast(e.message||t('err_img_process'),'error'); }
        btnSave.disabled=false;
      };
      const btnShare=document.getElementById('btn-share-template');
      if(btnShare) btnShare.onclick=async ()=>{
        try{
          btnShare.disabled=true;
          const files=await templatePageFiles();
          if(navigator.canShare && navigator.canShare({files})){ try{ await navigator.share({files, title: businessName||'Dusty'}); }catch(e){ if(!(e && e.name==='AbortError')) throw e; } }
          else { files.forEach(dl); showToast(t('tpl_shared_fallback'),'info'); }
        }catch(e){ showToast(e.message||t('err_img_process'),'error'); }
        btnShare.disabled=false;
      };
    }
    const btnCatalogCollage=document.getElementById('btn-catalog-collage');
    if(btnCatalogCollage) btnCatalogCollage.onclick=()=>{
      collageImgsCache=[]; collageChosenLayout=null;
      showCollageLayoutModal=true;
      render();
    };
    // Patrón iOS Fotos: "Seleccionar" alterna el modo; sin modo, tocar ABRE la
    // foto completa; con modo, tocar marca/desmarca para el catálogo.
    const btnCatalogSelect=document.getElementById('btn-catalog-select');
    // La ayuda del modo sale como toast al ENTRAR (no en línea: empujaba la
    // grilla ~35px al aparecer y desaparecer — verificación 2026-09-07).
    if(btnCatalogSelect) btnCatalogSelect.onclick=()=>{
      catalogSelectMode=!catalogSelectMode;
      render();
      if(catalogSelectMode) showToast(t('catalog_select_hint'), 'info');
    };
    // Todos / Ninguno (auditoría 2026-09-07, patrón iOS Fotos).
    const setAllCatalog=(val)=>{
      const stamp=(o)=>{ if(currentUser){ o.lastEditedBy=currentUserLabel(); o.lastEditedAt=new Date().toISOString(); } };
      inventory.forEach(i=>{ if(i && !isExpenseItem(i) && !!i.inCatalog!==val){ i.inCatalog=val; stamp(i); } });
      recipes.forEach(r=>{ if(r && r.id && !!r.inCatalog!==val){ r.inCatalog=val; stamp(r); } });
      catalogHaptic();
      saveState(); scheduleCatalogAutoPublish(); render();
    };
    const btnSelAll=document.getElementById('btn-catalog-select-all');
    if(btnSelAll) btnSelAll.onclick=()=>setAllCatalog(true);
    const btnSelNone=document.getElementById('btn-catalog-select-none');
    if(btnSelNone) btnSelNone.onclick=()=>setAllCatalog(false);
    // Compartir = el menú NATIVO del teléfono directo (comparación del usuario
    // 2026-09-06 con la hoja de compartir de iOS: cero formularios en el medio).
    // Solo si todavía no hay catálogo publicado se abre Publicación — no hay
    // nada que compartir aún. Los ajustes viven en el engranaje de al lado.
    const btnShareTop=document.getElementById('btn-catalog-share-top');
    if(btnShareTop) btnShareTop.onclick=async()=>{
      const url=catalogUrl();
      if(!url){ showCatalogPublishModal=true; render(); return; }
      await shareCatalogLink(url);
    };
    const publishOverlay=document.getElementById('catalog-publish-overlay');
    if(publishOverlay){
      publishOverlay.onmousedown=(e)=>{ if(e.target===publishOverlay) closeCatalogPublishModal(); };
      const btnClosePub=document.getElementById('btn-close-catalog-publish');
      if(btnClosePub) btnClosePub.onclick=closeCatalogPublishModal;
      // Canales (chips) y redes (inputs): guardan al toque/confirmar.
      document.querySelectorAll('[data-cat-channel]').forEach(ch=>{
        ch.onclick=()=>{ const k=ch.dataset.catChannel; catalogChannels[k]=!catalogChannels[k]; saveState(); render(); };
      });
      document.querySelectorAll('[data-cat-social]').forEach(inp=>{
        inp.onchange=()=>{ catalogChannels[inp.dataset.catSocial]=inp.value.trim(); saveState(); };
      });
    }
    // Tarjetas: toque = ver la foto (o marcar, en modo selección). PRESIÓN LARGA
    // (500 ms, Material 3 / Google Fotos) entra al modo selección marcando esa
    // tarjeta, y sin levantar el dedo se puede ARRASTRAR por la grilla para
    // marcar varias con el mismo estado. Cada marca vibra (Android / Capacitor).
    const parseCat=(s)=>{ const sep=s.indexOf(':'); return {kind:s.slice(0,sep), id:s.slice(sep+1)}; };
    const catTarget=({kind,id})=> kind==='item' ? inventory.find(i=>i.id===id) : recipes.find(x=>x && x.id===id);
    const setCat=(target, val)=>{
      if(!target || !!target.inCatalog===val) return false;
      target.inCatalog=val;
      if(currentUser){ target.lastEditedBy=currentUserLabel(); target.lastEditedAt=new Date().toISOString(); }
      return true;
    };
    // El estado del gesto vive FUERA de attachEvents (catSel*, arriba del todo):
    // cada marca re-renderiza y vuelve a enganchar — una variable local se
    // perdería a mitad del arrastre.
    document.querySelectorAll('[data-cat-toggle]').forEach(el=>{
      el.onclick=()=>{
        if(catSelLongPressed){ catSelLongPressed=false; return; } // ya lo resolvió la presión larga
        const s=parseCat(el.dataset.catToggle);
        const target=catTarget(s);
        if(!target) return;
        if(!catalogSelectMode){
          // Vuelo miniatura → visor: el nombre de transición va en la miniatura
          // tocada ANTES del render (estado viejo) y en la foto del visor (nuevo).
          document.querySelectorAll('[data-cat-toggle] img').forEach(i=>{ i.style.viewTransitionName=''; });
          const im=el.querySelector('img'); if(im) im.style.viewTransitionName='catalog-photo';
          catalogViewPhoto=s;
          render();
          return;
        }
        setCat(target, !target.inCatalog);
        catalogHaptic();
        saveState();
        scheduleCatalogAutoPublish();
        render();
      };
      el.onpointerdown=(ev)=>{
        if(ev.pointerType==='mouse' && ev.button!==0) return;
        clearTimeout(catSelLongTimer);
        catSelLongPressed=false;
        const x0=ev.clientX, y0=ev.clientY;
        catSelLongTimer=setTimeout(()=>{
          const s=parseCat(el.dataset.catToggle);
          const target=catTarget(s); if(!target) return;
          catSelLongPressed=true;
          const val=!target.inCatalog;
          if(!catalogSelectMode){ catalogSelectMode=true; showToast(t('catalog_select_hint'), 'info'); }
          setCat(target, val);
          catalogHaptic();
          catSelDrag={val, touched:new Set([el.dataset.catToggle])};
          saveState(); scheduleCatalogAutoPublish(); render();
        }, 500);
        const cancel=()=>{ clearTimeout(catSelLongTimer); };
        el.onpointermove=(mv)=>{ if(Math.hypot(mv.clientX-x0, mv.clientY-y0)>10) cancel(); };
        el.onpointerup=el.onpointercancel=el.onpointerleave=cancel;
      };
    });
    // Arrastre de selección: el dedo pasa por otras tarjetas (elementFromPoint,
    // porque el pointer quedó en la primera) y les copia el estado. El handler
    // vive en el documento (sobrevive a los re-renders de cada marca).
    document.onpointermove=(mv)=>{
      if(!catSelDrag) return;
      const under=document.elementFromPoint(mv.clientX, mv.clientY);
      const tileEl=under && under.closest ? under.closest('[data-cat-toggle]') : null;
      if(!tileEl) return;
      const key=tileEl.dataset.catToggle;
      if(catSelDrag.touched.has(key)) return;
      catSelDrag.touched.add(key);
      if(setCat(catTarget(parseCat(key)), catSelDrag.val)){ catalogHaptic(); saveState(); scheduleCatalogAutoPublish(); render(); }
    };
    document.onpointerup=document.onpointercancel=()=>{ catSelDrag=null; };
    // Selector de diseño del collage: elegir uno abre las fotos (la cantidad
    // que pide el diseño), y con ellas compone y entra al flujo normal.
    const collageOverlay=document.getElementById('collage-layout-overlay');
    if(collageOverlay){
      const dropCollage=()=>{ collageImgsCache=[]; collageChosenLayout=null; showCollageLayoutModal=false; render(); };
      collageOverlay.onmousedown=(e)=>{ if(e.target===collageOverlay) dropCollage(); };
      const btnCancelCollage=document.getElementById('btn-cancel-collage');
      if(btnCancelCollage) btnCancelCollage.onclick=dropCollage;
      document.querySelectorAll('[data-collage-layout]').forEach(lb=>{
        lb.onclick=()=>{
          collageChosenLayout=lb.dataset.collageLayout;
          const need=collageLayoutCount(collageChosenLayout);
          const input=document.createElement('input');
          input.type='file'; input.accept='image/*'; input.multiple=true;
          input.style.display='none';
          document.body.appendChild(input);
          input.addEventListener('cancel', ()=>{ if(input.parentNode) input.parentNode.removeChild(input); });
          input.onchange=async ()=>{
            const files=[...input.files].filter(f=>/^image\//.test(f.type)).slice(0, need);
            if(input.parentNode) input.parentNode.removeChild(input);
            if(files.length<need){ showToast(t('catalog_collage_need_n').replace('{n}', need), 'info'); return; }
            try{
              const imgs=[];
              for(const f of files) imgs.push(await loadImageFromFile(f));
              collageImgsCache=imgs;
              await finishCollage(collageChosenLayout);
            }catch(err){ showToast(err.message || t('err_img_process'), 'error'); }
          };
          input.click();
        };
      });
      const finishCollage=async (layoutId)=>{
          try{
            const composite = await composeCollageLayout(layoutId);
            catalogEditFull = composite;
            const compImg = await loadB64Image(composite);
            catalogPendingOriginal = resizeToBase64(compImg, 400, 0.78);
            catalogPendingPhoto = catalogPendingOriginal;
            catalogPendingFilter='original';
            catalogAssignSuggestion=null; catalogAssignDetecting=false; catalogAssignReqId++;
            catalogEdit=Object.assign({}, CATALOG_EDIT_DEFAULTS);
            catalogEditorOpen=false; catalogEditPreviewUrl=null; catalogEditBackup=null;
            catalogEditCutout=null; catalogEditFullBackup=null; catalogEditBg='#ffffff';
            collageImgsCache=[]; showCollageLayoutModal=false;
            render();
          }catch(err){ showToast(err.message || t('err_img_process'), 'error'); }
        };
    }
    // ===== VISOR DE FOTO (auditoría "smooth" 2026-09-07) =====
    // Gestos con Pointer Events sobre el escenario (la <img> no recibe eventos):
    // un dedo suelto = tocar (foto: chrome on/off · fondo: cerrar · doble: zoom),
    // arrastrar horizontal = foto anterior/siguiente, hacia abajo = cerrar;
    // dos dedos = pellizco; con zoom, un dedo = mover. El fondo no scrollea
    // (body.catalog-viewer-open) y Escape/flechas viven en el keydown global.
    const catalogViewerEl=document.getElementById('catalog-photo-viewer');
    document.body.classList.toggle('catalog-viewer-open', !!catalogViewerEl);
    if(catalogViewerEl){
      const stage=document.getElementById('cv-stage');
      const img=document.getElementById('cv-img');
      // Placeholder → alta: la miniatura ya está; la alta la pisa apenas baja.
      if(img && img.dataset.hi){
        const hi=new Image(); hi.decoding='async';
        hi.onload=()=>{ if(!document.body.contains(img) || img.dataset.hi!==hi.src) return; img.src=hi.src; img.classList.remove('cv-placeholder'); };
        hi.src=img.dataset.hi;
      }
      const closeViewer=()=>{
        catalogViewerReturnTo = catalogViewPhoto;
        catalogViewPhoto=null;
        render();
        // El nombre de transición de la miniatura se consume después del vuelo.
        setTimeout(()=>{ catalogViewerReturnTo=null; document.querySelectorAll('[data-cat-toggle] img').forEach(i=>{ i.style.viewTransitionName=''; }); }, 600);
      };
      const step=(dir)=>{
        const list=catalogViewerList();
        const idx=list.findIndex(x=>x.kind===catalogViewPhoto.kind && x.id===catalogViewPhoto.id);
        const next=list[idx+dir];
        if(!next){ if(img){ img.style.transition='transform .2s'; img.style.transform=''; } return; }
        catalogViewPhoto=next; render();
      };
      document.getElementById('cv-close').onclick=(e)=>{ e.stopPropagation(); closeViewer(); };
      const btnShare=document.getElementById('cv-share');
      if(btnShare) btnShare.onclick=(e)=>{ e.stopPropagation(); shareCatalogPhoto(catalogViewPhoto); };
      const btnToggle=document.getElementById('cv-toggle');
      if(btnToggle) btnToggle.onclick=(e)=>{
        e.stopPropagation();
        const target=catalogViewerObj(catalogViewPhoto); if(!target) return;
        target.inCatalog=!target.inCatalog;
        if(currentUser){ target.lastEditedBy=currentUserLabel(); target.lastEditedAt=new Date().toISOString(); }
        catalogHaptic();
        saveState(); scheduleCatalogAutoPublish(); render();
      };
      // ----- estado del gesto -----
      // Vive en cvGesture (nivel de módulo): un render de fondo a mitad del
      // gesto (snapshot de Firestore, re-sync del viewport) vuelve a enganchar
      // estos handlers, y con variables locales se perdía el zoom, el pellizco
      // en curso y hasta el primer toque del doble tap.
      const key=catalogViewPhoto.kind+':'+catalogViewPhoto.id;
      if(cvGesture.key!==key){ cvGesture={key, scale:1, tx:0, ty:0, pts:new Map(), pinch:null, drag:null, lastTap:0, tapTimer:null}; }
      const G=cvGesture;
      const apply=(anim)=>{ if(!img) return; img.style.transition = anim ? 'transform .22s cubic-bezier(.32,.72,.25,1), opacity .22s' : 'none'; img.style.transform=`translate(${G.tx}px,${G.ty}px) scale(${G.scale})`; };
      const clampPan=()=>{
        if(!img) return;
        const w=img.clientWidth*G.scale, h=img.clientHeight*G.scale;
        const mx=Math.max(0,(w-stage.clientWidth)/2), my=Math.max(0,(h-stage.clientHeight)/2);
        G.tx=Math.min(mx,Math.max(-mx,G.tx)); G.ty=Math.min(my,Math.max(-my,G.ty));
      };
      // Re-render con zoom puesto o chrome oculto: el DOM nuevo lo vuelve a mostrar.
      if(G.scale>1 || G.tx || G.ty) apply(false);
      catalogViewerEl.classList.toggle('cv-chrome-hidden', !!G.chromeHidden);
      const insideImg=(x,y)=>{ if(!img) return false; const r=img.getBoundingClientRect(); return x>=r.left && x<=r.right && y>=r.top && y<=r.bottom; };
      const zoomAt=(x,y)=>{
        if(G.scale>1){ G.scale=1; G.tx=0; G.ty=0; apply(true); return; }
        const r=stage.getBoundingClientRect();
        const px=x-(r.left+r.width/2), py=y-(r.top+r.height/2);
        G.scale=2.5; G.tx=px*(1-G.scale); G.ty=py*(1-G.scale); clampPan(); apply(true);
      };
      stage.onpointerdown=(ev)=>{
        ev.preventDefault();
        try{ stage.setPointerCapture(ev.pointerId); }catch(e){}
        // Un pointerup que el sistema se tragó dejaría un dedo "fantasma" y el
        // visor creería que siempre hay pellizco: los dedos sin novedades en
        // 1,5 s se descartan.
        const now=Date.now();
        G.pts.forEach((p,id)=>{ if(id!==ev.pointerId && now-(p.t||0)>1500) G.pts.delete(id); });
        if(G.pts.size===0) G.pinch=null;
        G.pts.set(ev.pointerId,{x:ev.clientX,y:ev.clientY,t:now});
        if(G.pts.size===2){
          const [a,b]=[...G.pts.values()];
          G.pinch={d0:Math.hypot(a.x-b.x,a.y-b.y)||1, s0:G.scale, tx0:G.tx, ty0:G.ty};
          G.drag=null;
          if(G.tapTimer){ clearTimeout(G.tapTimer); G.tapTimer=null; }
        } else if(G.pts.size===1){
          G.drag={x0:ev.clientX,y0:ev.clientY,t0:Date.now(),tx0:G.tx,ty0:G.ty,moved:false};
        }
      };
      stage.onpointermove=(ev)=>{
        if(!G.pts.has(ev.pointerId)) return;
        G.pts.set(ev.pointerId,{x:ev.clientX,y:ev.clientY,t:Date.now()});
        if(G.pinch && G.pts.size>=2){
          const [a,b]=[...G.pts.values()];
          const d=Math.hypot(a.x-b.x,a.y-b.y)||1;
          G.scale=Math.min(4,Math.max(1,G.pinch.s0*d/G.pinch.d0));
          G.tx=G.pinch.tx0; G.ty=G.pinch.ty0; clampPan(); apply(false);
          return;
        }
        if(!G.drag) return;
        const dx=ev.clientX-G.drag.x0, dy=ev.clientY-G.drag.y0;
        if(!G.drag.moved && Math.hypot(dx,dy)>8) G.drag.moved=true;
        if(!G.drag.moved) return;
        if(G.scale>1){ G.tx=G.drag.tx0+dx; G.ty=G.drag.ty0+dy; clampPan(); apply(false); return; }
        if(Math.abs(dx)>Math.abs(dy)){ G.tx=dx; G.ty=0; }
        else { G.tx=0; G.ty=dy<0 ? dy*0.25 : dy; }
        if(img){ img.style.transition='none'; img.style.transform=`translate(${G.tx}px,${G.ty}px)`; img.style.opacity=String(Math.max(.3,1-Math.max(0,G.ty)/320)); }
      };
      const endPointer=(ev)=>{
        G.pts.delete(ev.pointerId);
        if(G.pinch){
          if(G.pts.size<2){ G.pinch=null; if(G.scale<1.05){ G.scale=1; G.tx=0; G.ty=0; } clampPan(); apply(true); }
          return;
        }
        if(!G.drag) return;
        const d=G.drag; G.drag=null;
        const dx=ev.clientX-d.x0, dy=ev.clientY-d.y0, dt=Date.now()-d.t0;
        // Con zoom, un arrastre es un paneo (ya aplicado): solo se asienta. Un
        // toque sin movimiento sigue abajo — el doble tap tiene que poder
        // volver a 1x y el simple ocultar el chrome también con zoom.
        if(G.scale>1 && d.moved){ clampPan(); apply(true); return; }
        if(d.moved){
          if(img) img.style.opacity='';
          const fast = dt<250;
          if(Math.abs(dx)>Math.abs(dy) && (Math.abs(dx)>60 || (fast && Math.abs(dx)>25))){ G.tx=0; G.ty=0; step(dx<0?1:-1); return; }
          if(dy>90 || (fast && dy>40)){ closeViewer(); return; }
          G.tx=0; G.ty=0; apply(true); return;
        }
        // Toque sin movimiento: fondo cierra; sobre la foto, doble = zoom,
        // simple (esperando 260 ms por si viene el segundo) = chrome on/off.
        const now=Date.now();
        if(!insideImg(ev.clientX,ev.clientY)){ closeViewer(); return; }
        if(now-G.lastTap<300){ G.lastTap=0; if(G.tapTimer){ clearTimeout(G.tapTimer); G.tapTimer=null; } zoomAt(ev.clientX,ev.clientY); return; }
        G.lastTap=now;
        G.tapTimer=setTimeout(()=>{ G.tapTimer=null; G.chromeHidden=!G.chromeHidden; const el=document.getElementById('catalog-photo-viewer'); if(el) el.classList.toggle('cv-chrome-hidden', G.chromeHidden); }, 260);
      };
      stage.onpointerup=endPointer; stage.onpointercancel=endPointer;
      // Rueda del mouse (escritorio): zoom suave.
      stage.onwheel=(ev)=>{ ev.preventDefault(); G.scale=Math.min(4,Math.max(1,G.scale*(ev.deltaY<0?1.15:0.87))); if(G.scale===1){G.tx=0;G.ty=0;} clampPan(); apply(false); };
      // Precarga de las vecinas: el siguiente deslizamiento no espera.
      try{
        const list=catalogViewerList();
        const idx=list.findIndex(x=>x.kind===catalogViewPhoto.kind && x.id===catalogViewPhoto.id);
        [list[idx-1], list[idx+1]].forEach(s=>{ const o=catalogViewerObj(s); if(o && o.photoHiUrl){ const p=new Image(); p.src=o.photoHiUrl; } });
      }catch(e){}
    }
    const btnPublishCatalog=document.getElementById('btn-publish-catalog');
    if(btnPublishCatalog) btnPublishCatalog.onclick=publishCatalogNow;
    const btnUnpublishCatalog=document.getElementById('btn-unpublish-catalog');
    if(btnUnpublishCatalog) btnUnpublishCatalog.onclick=unpublishCatalogNow;
    const btnCopyCatalogLink=document.getElementById('btn-copy-catalog-link');
    if(btnCopyCatalogLink) btnCopyCatalogLink.onclick=async()=>{
      const url=catalogUrl(); if(!url) return;
      try{ await navigator.clipboard.writeText(url); showToast(t('catalog_copied_toast')); }
      catch(e){ prompt('', url); }
    };
    const btnShareCatalogLink=document.getElementById('btn-share-catalog-link');
    if(btnShareCatalogLink) btnShareCatalogLink.onclick=async()=>{
      const url=catalogUrl(); if(!url) return;
      await shareCatalogLink(url);
    };
    // Modal "¿de qué producto es esta foto?" (tras sacarla o subirla)
    const assignOverlay=document.getElementById('catalog-assign-overlay');
    if(assignOverlay){
      const dropPending=()=>{
        catalogPendingPhoto=null; catalogPendingOriginal=null; catalogPendingFilter='original';
        catalogAssignSuggestion=null; catalogAssignDetecting=false; catalogAssignReqId++;
        catalogEditFull=null; catalogEdit=Object.assign({}, CATALOG_EDIT_DEFAULTS);
        catalogEditorOpen=false; catalogEditPreviewUrl=null; catalogEditBackup=null;
        catalogEditCutout=null; catalogEditFullBackup=null; catalogEditBg='#ffffff'; catalogRemovingBg=false;
        catalogEnhancing=false; catalogStaging=false; catalogStageOpen=false;
        catalogAiEnd(); catalogEditGuide=false; catalogAssignQuery='';
        render();
      };
      assignOverlay.onmousedown=(e)=>{ if(e.target===assignOverlay) dropPending(); };
      const btnCancelAssign=document.getElementById('btn-cancel-assign-photo');
      if(btnCancelAssign) btnCancelAssign.onclick=dropPending;
      // Chips de filtro: cada uno recalcula desde el ORIGINAL (nunca filtro
      // sobre filtro) y la vista previa se actualiza con el render.
      document.querySelectorAll('[data-photo-filter]').forEach(chip=>{
        chip.onclick=async ()=>{
          const key=chip.dataset.photoFilter;
          if(key===catalogPendingFilter || !catalogPendingOriginal) return;
          try{
            const filtered = await applyCatalogFilter(catalogPendingOriginal, key);
            // Si mientras filtraba se cerró el modal (cancelar), no revivirlo.
            if(!catalogPendingOriginal) return;
            catalogPendingFilter = key;
            catalogPendingPhoto = filtered;
            render();
          }catch(err){ showToast(err.message || t('err_img_process'), 'error'); }
        };
      });
      // Abrir el editor (snapshot para que Cancelar deshaga lo tocado)
      const btnOpenEditor=document.getElementById('btn-open-photo-editor');
      if(btnOpenEditor) btnOpenEditor.onclick=()=>{
        catalogEditBackup = Object.assign({}, catalogEdit);
        catalogEditorOpen = true;
        catalogEditTab = 'light';
        render();
        refreshCatalogEditPreview();
      };
      // Asignar la foto pendiente a un producto/receta (fila de la lista, la
      // sugerencia de la IA, o el producto recién creado desde el buscador).
      const assignPendingTo=(kind, target)=>{
        if(!target || !catalogPendingPhoto) return;
        // DESHACER (auditoría 2026-09-07): si ya tenía foto, se guarda lo
        // anterior y el toast ofrece volver atrás durante 6 s.
        const prev = target.photo ? {photo:target.photo, hi:target.photoHiUrl, thumb:target.photoThumbUrl, inCat:target.inCatalog} : null;
        const newPhoto = catalogPendingPhoto;
        target.photo = newPhoto;
        delete target.photoHiUrl; delete target.photoThumbUrl; // la alta nueva llega en segundo plano
        // Foto sacada DESDE el Catálogo = el producto va al catálogo
        // (verificación 2026-09-07): antes quedaba con foto nueva pero sin
        // el ✓, y no aparecía en la página pública hasta entrar a
        // Seleccionar y marcarlo a mano — el paso que nadie espera dar.
        target.inCatalog = true;
        if(currentUser){ target.lastEditedBy=currentUserLabel(); target.lastEditedAt=new Date().toISOString(); }
        // Captura para la subida en ALTA (corre en segundo plano después de
        // limpiar el estado — por eso las copias, no los globales).
        const hiFull=catalogEditFull, hiEdit=Object.assign({}, catalogEdit), hiFilter=catalogPendingFilter;
        catalogPendingPhoto=null; catalogPendingOriginal=null; catalogPendingFilter='original';
        catalogAssignSuggestion=null; catalogAssignDetecting=false; catalogAssignReqId++; catalogAssignQuery='';
        catalogEditFull=null; catalogEdit=Object.assign({}, CATALOG_EDIT_DEFAULTS);
        catalogEditorOpen=false; catalogEditPreviewUrl=null; catalogEditBackup=null;
        catalogEditCutout=null; catalogEditFullBackup=null; catalogEditBg='#ffffff'; catalogRemovingBg=false;
        saveState();
        scheduleCatalogAutoPublish();
        uploadCatalogHiRes(target, kind, hiFull, hiEdit, hiFilter, newPhoto);
        // La foto de una receta viaja por Storage (meta solo lleva la referencia).
        if(kind==='recipe') uploadRecipePhoto(target);
        if(prev){
          showActionToast(t('catalog_photo_replaced').replace('{name}', target.name), t('catalog_undo'), ()=>{
            target.photo=prev.photo;
            if(prev.hi) target.photoHiUrl=prev.hi; else delete target.photoHiUrl;
            if(prev.thumb) target.photoThumbUrl=prev.thumb; else delete target.photoThumbUrl;
            target.inCatalog=prev.inCat;
            if(currentUser){ target.lastEditedBy=currentUserLabel(); target.lastEditedAt=new Date().toISOString(); }
            saveState(); scheduleCatalogAutoPublish(); render();
          });
        } else {
          showToast(t('catalog_photo_saved').replace('{name}', target.name));
        }
        render();
      };
      document.querySelectorAll('[data-assign-photo]').forEach(el=>{
        el.onclick=()=>{
          const s=el.dataset.assignPhoto, sep=s.indexOf(':');
          const kind=s.slice(0,sep), id=s.slice(sep+1);
          const target = kind==='item' ? inventory.find(i=>i.id===id) : recipes.find(x=>x && x.id===id);
          assignPendingTo(kind, target);
        };
      });
      // BUSCADOR (filtra en vivo, sin re-render) + "Crear «nombre» con esta foto".
      // El texto vive en catalogAssignQuery para sobrevivir al render que trae
      // la sugerencia de la IA (morphdom repone el value del input).
      const searchInp=document.getElementById('catalog-assign-search');
      const createRow=document.getElementById('catalog-assign-create');
      if(searchInp){
        const rows=[...assignOverlay.querySelectorAll('#catalog-assign-list [data-assign-photo]')];
        const emptyEl=document.getElementById('catalog-assign-empty');
        const norm=(s)=>String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
        const applyFilter=()=>{
          const raw=searchInp.value.trim(), q=norm(raw);
          let shown=0;
          rows.forEach(r=>{ const ok=!q || norm(r.textContent).indexOf(q)!==-1; r.style.display=ok?'':'none'; if(ok) shown++; });
          if(emptyEl) emptyEl.hidden = !(q && shown===0);
          if(createRow){
            const show=raw.length>=2;
            createRow.hidden=!show; createRow.style.display=show?'flex':'none';
            const lab=document.getElementById('catalog-assign-create-label');
            if(lab) lab.textContent=t('catalog_assign_create').replace('{name}', raw);
          }
        };
        if(searchInp.value!==catalogAssignQuery) searchInp.value=catalogAssignQuery;
        applyFilter();
        searchInp.oninput=()=>{ catalogAssignQuery=searchInp.value; applyFilter(); };
        searchInp.onkeydown=(e)=>{ if(e.key==='Enter' && createRow && !createRow.hidden){ e.preventDefault(); createRow.click(); } };
      }
      if(createRow) createRow.onclick=()=>{
        const name=(searchInp ? searchInp.value : '').trim();
        if(!name || !catalogPendingPhoto) return;
        // Mismo esqueleto que draftItem (app-06): producto vendible, sin categoría.
        const item={id:uid('i'), name, unit:mostUsedInventoryUnit('unidad'), costPerUnit:0, qtyOnHand:0, salePrice:0,
          sku:'', supplier:'', categoryId:null, capacityFull:null, createdAt:new Date().toISOString()};
        if(currentUser){ item.createdBy=currentUserLabel(); }
        inventory.push(item);
        assignPendingTo('item', item);
      };
    }
    // Editor de foto (encima del modal de asignar)
    const editorOverlay=document.getElementById('catalog-editor-overlay');
    if(editorOverlay){
      const closeEditor=(revert)=>{
        if(revert && catalogEditBackup) catalogEdit = Object.assign({}, catalogEditBackup);
        catalogEditorOpen=false; catalogEditPreviewUrl=null;
        render();
      };
      editorOverlay.onmousedown=(e)=>{ if(e.target===editorOverlay) closeEditor(true); };
      const btnCancelEdit=document.getElementById('btn-cancel-edit');
      if(btnCancelEdit) btnCancelEdit.onclick=()=>closeEditor(true);
      const btnApplyEdit=document.getElementById('btn-apply-edit');
      if(btnApplyEdit) btnApplyEdit.onclick=async ()=>{
        try{
          btnApplyEdit.disabled=true;
          // El resultado editado pasa a ser el NUEVO original del borrador: los
          // filtros (Vívido, etc.) del modal se recalculan sobre él. Acá SÍ se
          // hornean brillo/contraste/saturación (misma matemática que el CSS).
          const out = await bakeCatalogEdit(400, true);
          catalogPendingOriginal = out;
          catalogPendingPhoto = out;
          catalogPendingFilter = 'original';
          catalogEditorOpen=false; catalogEditPreviewUrl=null;
          render();
        }catch(err){ btnApplyEdit.disabled=false; showToast(err.message || t('err_img_process'), 'error'); }
      };
      // QUITAR FONDO (Pro): start → poll → PNG transparente → compuesto sobre
      // blanco (después se cambia el color sin volver a llamar a la IA).
      const btnRemoveBg=document.getElementById('btn-remove-bg');
      if(btnRemoveBg) btnRemoveBg.onclick=async ()=>{
        if(catalogRemovingBg || !catalogEditFull) return;
        if(!currentUser || currentUser.isAnonymous){ openUpgradeModal(t('catalog_needs_account_note')); return; }
        catalogRemovingBg=true; catalogAiBegin('rembg', 12); render();
        try{
          const opts={notFoundKey:'err_function_not_found', genericKey:'catalog_rembg_error'};
          const start=await callDustyAI('/.netlify/functions/remove-bg', {action:'start', imageBase64:catalogEditFull.base64, mediaType:catalogEditFull.mediaType||'image/jpeg'}, opts);
          let result=null;
          for(let i=0;i<55 && !result;i++){
            await new Promise(r=>setTimeout(r,1600));
            if(!catalogEditorOpen || !catalogEditFull){ catalogRemovingBg=false; catalogAiEnd(); return; } // canceló mientras tanto
            if(catalogAiCancelled()){ catalogRemovingBg=false; catalogAiEnd(); render(); showToast(t('catalog_ai_cancelled'), 'info'); return; }
            const st=await callDustyAI('/.netlify/functions/remove-bg', {action:'status', id:start.id}, opts);
            if(st.status==='succeeded') result=st;
            else if(st.status==='failed') throw new Error(st.error || t('catalog_rembg_error'));
          }
          if(!result) throw new Error(t('catalog_rembg_error'));
          if(!catalogEditFullBackup) catalogEditFullBackup=catalogEditFull;
          catalogEditCutout={base64:result.imageBase64, mediaType:result.mediaType||'image/png'};
          catalogEditBg='#ffffff';
          await composeCatalogCutout();
          catalogRemovingBg=false; catalogAiEnd();
          render();
          refreshCatalogEditPreview();
          showToast(t('catalog_rembg_done'));
        }catch(err){
          catalogRemovingBg=false; catalogAiEnd();
          render();
          showToast(err.message || t('catalog_rembg_error'), 'error');
        }
      };
      // MEJORAR CON IA (súper-resolución): se manda una copia a 800px y Real-ESRGAN
      // la devuelve al doble con el detalle reconstruido — el resultado (re-encodado
      // a JPEG 1600) pasa a ser la nueva base de edición.
      const btnEnhance=document.getElementById('btn-enhance-photo');
      if(btnEnhance) btnEnhance.onclick=async ()=>{
        if(catalogEnhancing || catalogRemovingBg || !catalogEditFull) return;
        if(!currentUser || currentUser.isAnonymous){ openUpgradeModal(t('catalog_needs_account_note')); return; }
        catalogEnhancing=true; catalogAiBegin('enhance', 25); render();
        try{
          const srcImg = await loadB64Image(catalogEditFull);
          const small = resizeToBase64(srcImg, 800, 0.9);
          const opts={notFoundKey:'err_function_not_found', genericKey:'catalog_enhance_error'};
          const start=await callDustyAI('/.netlify/functions/enhance-photo', {action:'start', imageBase64:small.base64, mediaType:'image/jpeg'}, opts);
          let result=null;
          for(let i=0;i<55 && !result;i++){
            await new Promise(r=>setTimeout(r,1600));
            if(!catalogEditorOpen || !catalogEditFull){ catalogEnhancing=false; catalogAiEnd(); return; }
            if(catalogAiCancelled()){ catalogEnhancing=false; catalogAiEnd(); render(); showToast(t('catalog_ai_cancelled'), 'info'); return; }
            const st=await callDustyAI('/.netlify/functions/enhance-photo', {action:'status', id:start.id}, opts);
            if(st.status==='succeeded') result=st;
            else if(st.status==='failed') throw new Error(st.error || t('catalog_enhance_error'));
          }
          if(!result) throw new Error(t('catalog_enhance_error'));
          const enhancedImg = await loadB64Image({base64:result.imageBase64, mediaType:result.mediaType||'image/png'});
          if(!catalogEditFullBackup) catalogEditFullBackup=catalogEditFull;
          catalogEditFull = resizeToBase64(enhancedImg, 1600, 0.9);
          // La foto mejorada reemplaza a la base: si había recorte de fondo, ya no
          // corresponde a esta imagen nueva.
          catalogEditCutout=null;
          catalogEnhancing=false; catalogAiEnd();
          render();
          refreshCatalogEditPreview();
          showToast(t('catalog_enhance_done'));
        }catch(err){
          catalogEnhancing=false; catalogAiEnd();
          render();
          showToast(err.message || t('catalog_enhance_error'), 'error');
        }
      };
      // ESCENARIO IA (FLUX Kontext): el botón abre los presets; tocar uno (o
      // "Generar" con texto propio) manda la foto actual y la instrucción, y el
      // resultado —producto ambientado con luz y sombras coherentes— pasa a ser
      // la nueva base de edición.
      const STAGE_PROMPTS={
        wood:'Place this product on a rustic wooden table with soft natural morning light. Professional product photography, realistic shadows, shallow depth of field. Keep the product exactly as it is.',
        kitchen:'Place this product on a bright modern kitchen counter with a marble surface and soft daylight. Professional product photography, realistic shadows. Keep the product exactly as it is.',
        studio:'Place this product in a clean professional photo studio with a soft gradient background and a gentle reflection under it. Commercial product photography lighting. Keep the product exactly as it is.',
        shelf:'Place this product on a neat, well-lit retail store shelf. Commercial product photography, realistic shadows. Keep the product exactly as it is.'
      };
      const runStage=async (prompt)=>{
        if(catalogStaging || !catalogEditFull) return;
        if(!currentUser || currentUser.isAnonymous){ openUpgradeModal(t('catalog_needs_account_note')); return; }
        catalogStaging=true; catalogStageOpen=false; catalogAiBegin('stage', 30); render();
        try{
          const srcImg = await loadB64Image(catalogEditFull);
          const small = resizeToBase64(srcImg, 1024, 0.9);
          const opts={notFoundKey:'err_function_not_found', genericKey:'catalog_stage_error'};
          const start=await callDustyAI('/.netlify/functions/stage-photo', {action:'start', imageBase64:small.base64, mediaType:'image/jpeg', prompt}, opts);
          let result=null;
          for(let i=0;i<55 && !result;i++){
            await new Promise(r=>setTimeout(r,1600));
            if(!catalogEditorOpen || !catalogEditFull){ catalogStaging=false; catalogAiEnd(); return; }
            if(catalogAiCancelled()){ catalogStaging=false; catalogAiEnd(); render(); showToast(t('catalog_ai_cancelled'), 'info'); return; }
            const st=await callDustyAI('/.netlify/functions/stage-photo', {action:'status', id:start.id}, opts);
            if(st.status==='succeeded') result=st;
            else if(st.status==='failed') throw new Error(st.error || t('catalog_stage_error'));
          }
          if(!result) throw new Error(t('catalog_stage_error'));
          const staged = await loadB64Image({base64:result.imageBase64, mediaType:result.mediaType||'image/jpeg'});
          if(!catalogEditFullBackup) catalogEditFullBackup=catalogEditFull;
          catalogEditFull = resizeToBase64(staged, 1600, 0.9);
          catalogEditCutout=null;
          catalogStaging=false; catalogAiEnd();
          render();
          refreshCatalogEditPreview();
          showToast(t('catalog_stage_done'));
        }catch(err){
          catalogStaging=false; catalogAiEnd();
          render();
          showToast(err.message || t('catalog_stage_error'), 'error');
        }
      };
      const btnStage=document.getElementById('btn-stage-photo');
      if(btnStage) btnStage.onclick=()=>{ catalogStageOpen=!catalogStageOpen; render(); };
      document.querySelectorAll('[data-stage-preset]').forEach(pc=>{
        pc.onclick=()=>runStage(STAGE_PROMPTS[pc.dataset.stagePreset]);
      });
      const btnStageGo=document.getElementById('btn-stage-go');
      if(btnStageGo) btnStageGo.onclick=()=>{
        const txt=(document.getElementById('stage-custom-input')?.value||'').trim();
        if(!txt) return;
        runStage('Place this product in this scene: '+txt+'. Professional product photography, realistic lighting and shadows. Keep the product exactly as it is.');
      };
      document.querySelectorAll('[data-edit-bg]').forEach(sw=>{
        sw.onclick=async ()=>{
          catalogEditBg=sw.dataset.editBg;
          await composeCatalogCutout();
          render();
          refreshCatalogEditPreview();
        };
      });
      const btnRembgRevert=document.getElementById('btn-rembg-revert');
      if(btnRembgRevert) btnRembgRevert.onclick=()=>{
        if(catalogEditFullBackup) catalogEditFull=catalogEditFullBackup;
        catalogEditCutout=null; catalogEditFullBackup=null;
        render();
        refreshCatalogEditPreview();
      };
      const btnEditAuto=document.getElementById('btn-edit-auto');
      if(btnEditAuto) btnEditAuto.onclick=()=>{ catalogEdit.auto=!catalogEdit.auto; btnEditAuto.classList.toggle('on', catalogEdit.auto); refreshCatalogEditPreview(); };
      const btnEditRotate=document.getElementById('btn-edit-rotate');
      if(btnEditRotate) btnEditRotate.onclick=()=>{ catalogEdit.rot=(catalogEdit.rot+90)%360; catalogEdit.offX=0.5; catalogEdit.offY=0.5; render(); refreshCatalogEditPreview(); };
      // RESTABLECER todo (auditoría 2026-09-07): vuelve a los valores neutros
      // sin tocar la base (la foto original, o la mejorada/recortada por IA).
      const btnEditReset=document.getElementById('btn-edit-reset');
      if(btnEditReset) btnEditReset.onclick=()=>{ catalogEdit=Object.assign({}, CATALOG_EDIT_DEFAULTS); render(); refreshCatalogEditPreview(); };
      // FORMATO del recorte (1:1 / 4:5 / Original) y guía del 85%.
      document.querySelectorAll('[data-edit-ratio]').forEach(rb=>{
        rb.onclick=()=>{ catalogEdit.ratio=rb.dataset.editRatio; catalogEdit.offX=0.5; catalogEdit.offY=0.5; render(); refreshCatalogEditPreview(); };
      });
      const btnEditGuide=document.getElementById('btn-edit-guide');
      if(btnEditGuide) btnEditGuide.onclick=()=>{ catalogEditGuide=!catalogEditGuide; render(); };
      // ANTES / DESPUÉS: presión larga sobre la foto muestra la base tal cual
      // (sin ajustes ni filtro CSS) con el badge "Original"; soltar vuelve.
      const wrapCompare=document.getElementById('catalog-edit-wrap');
      const origImg=document.getElementById('catalog-edit-original');
      const origBadge=document.getElementById('catalog-edit-badge');
      let compareTimer=null, comparing=false;
      const showOriginal=async ()=>{
        if(!catalogEditFull || !origImg) return;
        comparing=true;
        // Misma base, MISMO encuadre pero sin luz/color/nitidez: así se compara
        // solo la edición, no el recorte.
        try{
          const neutral=Object.assign({}, CATALOG_EDIT_DEFAULTS, {rot:catalogEdit.rot, tilt:catalogEdit.tilt, ratio:catalogEdit.ratio, zoom:catalogEdit.zoom, offX:catalogEdit.offX, offY:catalogEdit.offY});
          const out=await bakeCatalogEdit(480, false, null, neutral);
          if(!comparing) return;
          origImg.src='data:image/jpeg;base64,'+out.base64;
          origImg.hidden=false; if(origBadge) origBadge.hidden=false;
        }catch(e){}
      };
      const hideOriginal=()=>{ clearTimeout(compareTimer); compareTimer=null; if(!comparing) return; comparing=false; if(origImg) origImg.hidden=true; if(origBadge) origBadge.hidden=true; };
      const btnAiCancel=document.getElementById('btn-ai-cancel');
      if(btnAiCancel) btnAiCancel.onclick=()=>{ if(catalogAiJob) catalogAiJob.cancelled=true; };
      // FLUIDEZ (reporte del usuario: "no se siente al ritmo de la foto"):
      // - brillo/contraste/saturación se aplican como CSS filter sobre el <img>
      //   en CADA tick del deslizador — GPU, instantáneo, sin hornear nada.
      //   Se hornean recién al tocar "Listo".
      // - zoom y arrastre se muestran con transform CSS en vivo y el horneado
      //   real (recorte de verdad) corre al soltar.
      // - nitidez es el único que hornea con debounce (no existe en CSS).
      const previewImg=()=>document.getElementById('catalog-edit-preview');
      let bakeTimer=null;
      // Mientras se arrastra: horneado a 320px (menos de la mitad del costo del
      // de 480 — sigue al dedo); el de 480 nítido llega al soltar (onchange).
      const scheduleBake=()=>{ clearTimeout(bakeTimer); bakeTimer=setTimeout(()=>refreshCatalogEditPreview(320), 120); };
      const liveTransform=()=>{
        const img=previewImg();
        if(img) img.style.transform='scale('+(catalogEdit.zoom/catalogEditBakedZoom)+')';
      };
      // Pestañas del editor (Luz/Color/Encuadre/PRO)
      document.querySelectorAll('[data-edit-tab]').forEach(tb=>{
        tb.onclick=()=>{ catalogEditTab=tb.dataset.editTab; render(); };
      });
      document.querySelectorAll('[data-edit-slider]').forEach(sl=>{
        // DOBLE TAP en el deslizador = volver al neutro (Lightroom Mobile).
        // dblclick cubre mouse; en touch se detectan dos pointerdown en 300 ms.
        const resetSlider=()=>{
          const k=sl.dataset.editSlider;
          const neutral = k==='zoom' ? 100 : 0;
          sl.value=String(neutral);
          sl.dispatchEvent(new Event('input', {bubbles:true}));
          sl.dispatchEvent(new Event('change', {bubbles:true}));
        };
        let lastDown=0;
        sl.onpointerdown=()=>{ const now=Date.now(); if(now-lastDown<300){ lastDown=0; resetSlider(); } else lastDown=now; };
        sl.ondblclick=(e)=>{ e.preventDefault(); resetSlider(); };
        sl.oninput=()=>{
          const k=sl.dataset.editSlider, v=parseInt(sl.value,10)||0;
          // El numerito junto al deslizador acompaña en vivo, sin re-render — y
          // se enciende en celeste apenas el ajuste sale del punto neutro.
          const valEl=document.querySelector('[data-edit-val="'+k+'"]');
          if(valEl){
            valEl.textContent=sl.value;
            const neutral=parseInt(valEl.dataset.editNeutral,10)||0;
            valEl.style.color = (parseInt(sl.value,10)||0)!==neutral ? 'var(--sky-ink)' : 'var(--ink-soft)';
          }
          // "Restablecer" se enciende con el primer ajuste (sin esperar un render).
          const rb=document.getElementById('btn-edit-reset');
          if(rb && rb.disabled){ rb.disabled=false; rb.style.opacity='1'; }
          if(k==='zoom'){
            catalogEdit.zoom = Math.max(1, v/100);
            liveTransform();
            return;
          }
          // Sombras/luces/temperatura no existen en CSS filter: hornean con el
          // mismo debounce corto que la nitidez (el preview de 480px es rápido).
          if(k==='sharp' || k==='temp' || k==='shadows' || k==='highlights' || k==='tilt'){ catalogEdit[k]=v; scheduleBake(); return; }
          catalogEdit[k] = v;
          const img=previewImg();
          if(img) img.style.filter = cssFilterForEdit();
        };
        sl.onchange=()=>{
          const k=sl.dataset.editSlider;
          if(k==='zoom' || k==='sharp' || k==='temp' || k==='shadows' || k==='highlights' || k==='tilt'){ clearTimeout(bakeTimer); refreshCatalogEditPreview(480); }
          // b/c/s: nada que hornear — viven en el CSS hasta "Listo".
        };
      });
      // Arrastre del encuadre: el <img> se corre por transform mientras el dedo
      // se mueve (fluido) y al soltar se hornea el recorte real (que además fija
      // el encuadre a los bordes de la foto).
      const wrap=document.getElementById('catalog-edit-wrap');
      if(wrap){
        wrap.onpointerdown=(ev)=>{
          if(!catalogEditFull) return;
          ev.preventDefault();
          try{ wrap.setPointerCapture(ev.pointerId); }catch(e){}
          const startX=ev.clientX, startY=ev.clientY;
          const startOffX=catalogEdit.offX, startOffY=catalogEdit.offY;
          const rect=wrap.getBoundingClientRect();
          const dispW=rect.width || 1, dispH=rect.height || 1;
          let moved=false;
          // Presión larga quieta (350 ms) = ver el original; mover = encuadrar.
          clearTimeout(compareTimer);
          compareTimer=setTimeout(()=>{ if(!moved) showOriginal(); }, 350);
          wrap.onpointermove=(mv)=>{
            const dx=mv.clientX-startX, dy=mv.clientY-startY;
            if(!moved && Math.hypot(dx,dy)<6) return;
            if(comparing) return;
            if(!moved){ moved=true; clearTimeout(compareTimer); }
            catalogEdit.offX = Math.min(1, Math.max(0, startOffX - (dx/dispW)/catalogEdit.zoom));
            catalogEdit.offY = Math.min(1, Math.max(0, startOffY - (dy/dispH)/catalogEdit.zoom));
            const img=previewImg();
            if(img) img.style.transform='translate('+dx+'px,'+dy+'px) scale('+(catalogEdit.zoom/catalogEditBakedZoom)+')';
          };
          wrap.onpointerup=wrap.onpointercancel=()=>{
            wrap.onpointermove=null; wrap.onpointerup=null; wrap.onpointercancel=null;
            const wasComparing=comparing;
            hideOriginal();
            // Sin movimiento no hay nada que hornear (antes cada toque re-horneaba).
            if(moved && !wasComparing) refreshCatalogEditPreview();
          };
        };
      }
    }
  }

  const alertSettingsOverlay=document.getElementById('alert-settings-overlay');
  if(alertSettingsOverlay){
    alertSettingsOverlay.onmousedown=(e)=>{ if(e.target===alertSettingsOverlay){ showAlertSettingsModal=false; render(); } };
    const closeAlertSettingsBtn=document.getElementById('btn-close-alert-settings');
    if(closeAlertSettingsBtn) closeAlertSettingsBtn.onclick=()=>{ showAlertSettingsModal=false; render(); };
    // Un solo botón abajo: Cerrar (auditoría de Ajustes 2026-09-07 — todo se
    // aplica al instante, así que Guardar/Cancelar ya no tenían sentido).
    const cancelAlertBtn=document.getElementById('btn-cancel-alert-settings');
    if(cancelAlertBtn) cancelAlertBtn.onclick=()=>{ showAlertSettingsModal=false; render(); };
    // Umbrales: se guardan al SOLTAR el campo (onchange), con la misma
    // validación de siempre; un valor inválido vuelve al guardado.
    const thrInp=document.getElementById('alert-threshold-input');
    if(thrInp) thrInp.onchange=()=>{
      const val=parseFloat(thrInp.value);
      if(val>0 && val<=100) priceAlertThreshold=val; else thrInp.value=String(priceAlertThreshold);
      saveState();
    };
    const bInp=document.getElementById('budget-alert-input');
    if(bInp) bInp.onchange=()=>{
      const b=parseFloat(bInp.value);
      if(Number.isFinite(b) && b>=10 && b<100) budgetMeta.alertPct=b; else bInp.value=String(budgetMeta.alertPct);
      saveState();
    };
    // Publicación del catálogo y Cuenta: hijos de Ajustes — al cerrarse
    // vuelven acá (settingsReturnPending), como Categorías y el Conteo.
    const btnOpenCatalogPublish=document.getElementById('btn-open-catalog-publish');
    if(btnOpenCatalogPublish) btnOpenCatalogPublish.onclick=()=>{ settingsReturnPending=true; showAlertSettingsModal=false; showCatalogPublishModal=true; render(); };
    const btnOpenAccount=document.getElementById('btn-open-account');
    if(btnOpenAccount) btnOpenAccount.onclick=()=>{ settingsReturnPending=true; showAlertSettingsModal=false; showAccountModal=true; render(); };
  }

  const accountOverlay=document.getElementById('account-overlay');
  if(accountOverlay){
    accountOverlay.onmousedown=(e)=>{ if(e.target===accountOverlay) closeAccountModal(); };
    const btnCloseAccountFooter=document.getElementById('btn-close-account-footer');
    if(btnCloseAccountFooter) btnCloseAccountFooter.onclick=closeAccountModal;
    // Cerrar sesión (vivía en el modal de equipo): cierra todo sin volver a
    // Ajustes — deslogueado, no hay Ajustes pendiente que tenga sentido.
    const btnSignOutAccount=document.getElementById('btn-sign-out-account');
    if(btnSignOutAccount) btnSignOutAccount.onclick=()=>{
      settingsReturnPending=false; showAccountModal=false;
      try{ firebase.auth().signOut(); }catch(e){}
      render();
    };
    const btnOpenDeleteAccount=document.getElementById('btn-open-delete-account');
    // La encuesta de salida (mes gratis + razón) se interpone ANTES del modal
    // real de eliminación — ver exitSurveyModal en app-06. Cuenta se cierra SIN
    // consumir el flag: cancelar la encuesta o el borrado devuelve a Ajustes.
    if(btnOpenDeleteAccount) btnOpenDeleteAccount.onclick=()=>{ showAccountModal=false; openExitSurvey(); };
  }

  // Cierre de mes: hoja a página completa con una columna por período.
  const btnMonthRecap=document.getElementById('btn-month-recap');
  if(btnMonthRecap) btnMonthRecap.onclick=()=>{
    monthRecapKey = calendarViewMonth || localMonthStr(); // el mes que se está mirando
    // Base de comparación consistente para TODAS las columnas: arranca en
    // año-contra-año solo si ya existe al menos un par mes↔mismo mes.
    recapBaseMode = recapDefaultBaseMode();
    showMonthRecap=true; render();
    // La hoja arranca en la columna del mes mirado (puede no ser la primera).
    requestAnimationFrame(()=>{
      const foc=document.querySelector('.recap-col.focus');
      if(foc) foc.scrollIntoView({inline:'start', block:'nearest'});
    });
  };
  const recapSheet=document.getElementById('recap-sheet');
  if(recapSheet && showMonthRecap){
    document.getElementById('btn-close-month-recap').onclick=()=>{
      showMonthRecap=false; recapMode='month'; recapDemo=false;
      recapCompare=false; recapComparePick=[]; render();
    };
    // Modo mes/año: recalcula las columnas al nuevo grano. Las claves elegidas
    // para comparar son del grano viejo — se descartan.
    document.querySelectorAll('[data-recap-mode]').forEach(b=>{
      b.onclick=()=>{
        const mode=b.dataset.recapMode;
        if(mode===recapMode) return;
        recapMode=mode; recapComparePick=[]; render();
      };
    });
    // Comparador A | B | Δ: el chip prende el modo elegir; tocar una columna la
    // elige (o des-elige), y la tercera elegida reemplaza a la más vieja.
    const btnCompare=document.getElementById('btn-recap-compare');
    if(btnCompare) btnCompare.onclick=()=>{
      recapCompare=!recapCompare; recapComparePick=[]; render();
    };
    document.querySelectorAll('[data-recap-pick]').forEach(el=>{
      el.onclick=()=>{
        const k=el.dataset.recapPick;
        const i=recapComparePick.indexOf(k);
        if(i>=0) recapComparePick.splice(i,1);
        else{
          if(recapComparePick.length>=2) recapComparePick.shift();
          recapComparePick.push(k);
        }
        render();
      };
    });
    // Base de comparación (mes anterior ⇄ año pasado): global, todas las
    // columnas cambian de vara juntas — nunca varas mezcladas en pantalla.
    document.querySelectorAll('[data-recap-base]').forEach(b=>{
      b.onclick=()=>{
        const m=b.dataset.recapBase;
        if(m===recapBaseMode) return;
        recapBaseMode=m; render();
      };
    });
    // Ejemplo: columnas de muestra con dos años de un negocio creciendo,
    // para que el usuario nuevo vea el resultado antes de tener datos propios.
    const btnDemo=document.getElementById('btn-recap-demo');
    if(btnDemo) btnDemo.onclick=()=>{
      recapDemo=!recapDemo; recapComparePick=[]; render();
      // Al encender, arrancar en la columna más nueva (el "hoy" de la muestra).
      if(recapDemo) requestAnimationFrame(()=>{
        const rail=document.getElementById('recap-cols');
        if(rail) rail.scrollLeft=0;
      });
    };
  }
  // Gasto manual sin recibo: el monto del mes es un botón que abre el modal.
  const btnAddManualSpend=document.getElementById('btn-add-manual-spend');
  if(btnAddManualSpend) btnAddManualSpend.onclick=openManualSpendModal;
  const manualSpendOverlay=document.getElementById('manual-spend-overlay');
  if(manualSpendOverlay){
    manualSpendOverlay.onmousedown=(e)=>{ if(e.target===manualSpendOverlay) closeManualSpendModal(); };
    document.getElementById('btn-cancel-manual-spend').onclick=closeManualSpendModal;
    document.getElementById('btn-save-manual-spend').onclick=saveManualSpend;
    document.querySelectorAll('[data-ms-kind]').forEach(b=>{
      b.onclick=()=>{
        manualSpendKind=b.dataset.msKind;
        // Sin render(): un redibujado pisaría lo ya tipeado en monto/descripción.
        document.querySelectorAll('[data-ms-kind]').forEach(x=>x.classList.toggle('on', x===b));
      };
    });
  }
  // Encuesta de salida: navegación de pasos, oferta y traspaso al delete real.
  const exitOverlay=document.getElementById('exit-survey-overlay');
  if(exitOverlay){
    exitOverlay.onmousedown=(e)=>{ if(e.target===exitOverlay) closeExitSurvey(); };
    const closeBtn=document.getElementById('btn-close-exit-survey');
    if(closeBtn) closeBtn.onclick=closeExitSurvey;
    const acceptBtn=document.getElementById('btn-exit-accept');
    if(acceptBtn) acceptBtn.onclick=()=>{
      sendExitFeedback('retention_offer_accepted', null, '');
      closeExitSurvey();
      showToast(t('exit_thanks_offer'));
    };
    document.querySelectorAll('[data-exit-reason]').forEach(b=>{
      b.onclick=()=>{ exitReason=b.dataset.exitReason; render(); };
    });
    const nextBtn=document.getElementById('btn-exit-next');
    if(nextBtn) nextBtn.onclick=()=>{
      if(exitStep===1){
        const txt=(document.getElementById('exit-reason-text')?.value||'').trim().slice(0,500);
        sendExitFeedback('exit_survey', exitReason, txt);
      }
      exitStep++; render();
    };
    const delBtn=document.getElementById('btn-exit-delete');
    // Sin closeExitSurvey(): eso consumiría el flag de "volver a Ajustes" a
    // mitad de la cadena — el flag debe sobrevivir hasta el cierre del modal
    // de borrado (cancelar ahí también devuelve a Ajustes).
    if(delBtn) delBtn.onclick=()=>{ showExitSurvey=false; openDeleteAccountModal(); };
  }

  const deleteAccountOverlay=document.getElementById('delete-account-overlay');
  if(deleteAccountOverlay){
    deleteAccountOverlay.onmousedown=(e)=>{ if(e.target===deleteAccountOverlay && !deleteAccountLoading) closeDeleteAccountModal(); };
    const btnCancelDeleteAccount=document.getElementById('btn-cancel-delete-account');
    if(btnCancelDeleteAccount) btnCancelDeleteAccount.onclick=()=>{ if(!deleteAccountLoading) closeDeleteAccountModal(); };
    const btnContinueDeleteAccount=document.getElementById('btn-continue-delete-account');
    if(btnContinueDeleteAccount) btnContinueDeleteAccount.onclick=()=>{ deleteAccountStep='reauth'; deleteAccountError=''; render(); };
    const deleteAccountPasswordInp=document.getElementById('delete-account-password');
    if(deleteAccountPasswordInp) deleteAccountPasswordInp.oninput=(e)=>{ deleteAccountPassword=e.target.value; };
    const btnConfirmDeleteAccount=document.getElementById('btn-confirm-delete-account');
    if(btnConfirmDeleteAccount) btnConfirmDeleteAccount.onclick=performAccountDeletion;
  }

  const btnCriticalAlerts=document.getElementById('btn-critical-alerts');
  if(btnCriticalAlerts) btnCriticalAlerts.onclick=()=>{
    // Los críticos ya no se listan en el Dashboard (solo lo pendiente de conteo,
    // inversión 2026-09-04) — este atajo salta a la pestaña Inventario y los hace
    // latir allá (los tiles de Inventario llevan data-status para esto).
    const flash=()=>{
      const critRows = document.querySelectorAll('[data-status="crit"]');
      if(critRows.length===0) return;
      critRows[0].scrollIntoView({behavior:'smooth', block:'center'});
      critRows.forEach(r=>r.classList.add('crit-flash'));
      setTimeout(()=>critRows.forEach(r=>r.classList.remove('crit-flash')), 2400);
    };
    if(activeTab!=='inventario'){
      switchToTab('inventario');
      requestAnimationFrame(()=>requestAnimationFrame(flash));
    } else flash();
  };
  const btnSuggestedOrder=document.getElementById('btn-suggested-order');
  if(btnSuggestedOrder) btnSuggestedOrder.onclick=()=>{ showSuggestedOrderModal=true; render(); };
  const suggestedOrderOverlay=document.getElementById('suggested-order-overlay');
  if(suggestedOrderOverlay){
    suggestedOrderOverlay.onmousedown=(e)=>{ if(e.target===suggestedOrderOverlay){ showSuggestedOrderModal=false; render(); } };
    const closeSuggestedBtn=document.getElementById('btn-close-suggested-order');
    if(closeSuggestedBtn) closeSuggestedBtn.onclick=()=>{ showSuggestedOrderModal=false; render(); };
  }

  const btnInventoryActivity=document.getElementById('btn-inventory-activity');
  if(btnInventoryActivity) btnInventoryActivity.onclick=openActivityModal;
  const activityOverlay=document.getElementById('activity-overlay');
  if(activityOverlay){
    activityOverlay.onmousedown=(e)=>{ if(e.target===activityOverlay) closeActivityModal(); };
    const closeActivityBtn=document.getElementById('btn-close-activity');
    if(closeActivityBtn) closeActivityBtn.onclick=closeActivityModal;
  }

  const btnCycleCount=document.getElementById('btn-cycle-count');
  if(btnCycleCount) btnCycleCount.onclick=()=>{ settingsReturnPending=true; showAlertSettingsModal=false; openCycleCountModal(); };
  const ccBanner=document.getElementById('cc-banner');
  if(ccBanner) ccBanner.onclick=openCycleCountModal;
  const cycleCountOverlay=document.getElementById('cycle-count-overlay');
  if(cycleCountOverlay){
    cycleCountOverlay.onmousedown=(e)=>{ if(e.target===cycleCountOverlay) closeCycleCountModal(); };
    const cancelCcBtn=document.getElementById('btn-close-cycle-count');
    if(cancelCcBtn) cancelCcBtn.onclick=closeCycleCountModal;
    const saveCcBtn=document.getElementById('btn-save-cycle-count');
    if(saveCcBtn) saveCcBtn.onclick=()=>{
      const pct=parseFloat(document.getElementById('cc-pct-input').value);
      const interval=parseFloat(document.getElementById('cc-interval-input').value);
      if(pct>0 && pct<=100) cycleCountPct=pct;
      if(interval>0) cycleCountIntervalDays=interval;

      if(isCycleCountDue()){
        const batch=cycleCountBatch();
        document.querySelectorAll('[data-cc-count]').forEach(inp=>{
          const val=parseFloat(inp.value);
          if(!isNaN(val) && val>=0){
            const ing=inventory.find(i=>i.id===inp.dataset.ccCount);
            if(ing){
              ing.qtyOnHand=val;
              // Contar MÁS que el "lleno" conocido = había una entrada sin registrar:
              // ese nivel pasa a ser el nuevo 100%. Contar menos es consumo — no toca.
              if(val > (ing.stockFullRef||0)) ing.stockFullRef = val;
            }
          }
        });
        cycleCountLastDate=localDateStr();
        // El cursor rota sobre la lista CONTABLE (sin ítems de gasto) — mismo
        // universo que usa cycleCountBatch para armar cada tanda.
        cycleCountCursor=(cycleCountCursor+batch.length)%Math.max(inventory.filter(i=>!isExpenseItem(i)).length,1);
      }
      saveState();
      closeCycleCountModal();
    };
  }

  const btnScanFab=document.getElementById('btn-scan-fab');
  if(btnScanFab) btnScanFab.onclick=openScanModal;
  const btnDashEmptyScan=document.getElementById('btn-dash-empty-scan');
  if(btnDashEmptyScan) btnDashEmptyScan.onclick=openScanModal;
  const btnDashEmptyManual=document.getElementById('btn-dash-empty-manual');
  if(btnDashEmptyManual) btnDashEmptyManual.onclick=()=>openItemModal(null);
  const btnDashEmptyBatch=document.getElementById('btn-dash-empty-batch');
  if(btnDashEmptyBatch) btnDashEmptyBatch.onclick=openProductBatchModal;
  const btnScanProducts=document.getElementById('btn-scan-products');
  if(btnScanProducts) btnScanProducts.onclick=openProductBatchModal;

  /* Modal del escáner de productos (lote + identificador, un solo flujo) */
  const pbOverlay=document.getElementById('product-batch-overlay');
  if(pbOverlay){
    pbOverlay.onmousedown=(e)=>{ if(e.target===pbOverlay) closeProductBatchModal(); };
    document.getElementById('btn-cancel-pb').onclick=closeProductBatchModal;
    const pbFile=document.getElementById('pb-photo-file');
    const pbGalleryFile=document.getElementById('pb-photo-file-gallery');
    // Intro única: la caja abre la cámara directo; el link, la galería.
    const pbDz=document.getElementById('pb-drop-zone');
    if(pbDz && pbFile) pbDz.onclick=()=>pbFile.click();
    const btnPbGallery=document.getElementById('btn-pb-gallery');
    if(btnPbGallery && pbGalleryFile) btnPbGallery.onclick=()=>pbGalleryFile.click();
    const onPbFile=async (e)=>{
      const file=e.target.files[0];
      e.target.value='';
      if(!file || !/^image\//.test(file.type)) return;
      try{
        const img = await loadImageFromFile(file);
        gateProductBatchSource(img);
      }catch(err){
        stopScannerCamera();
        pbState='error'; pbError=err.message||t('product_scan_error'); render();
      }
    };
    if(pbFile) pbFile.onchange=onPbFile;
    if(pbGalleryFile) pbGalleryFile.onchange=onPbFile;
    const btnPbAgain=document.getElementById('btn-pb-again');
    if(btnPbAgain) btnPbAgain.onclick=restartScannerCamera;
    // Aviso de calidad, cancelar lectura y fila manual (auditoría 2026-09-07).
    const btnPbQualityUse=document.getElementById('btn-pb-quality-use');
    if(btnPbQualityUse) btnPbQualityUse.onclick=()=>{ if(pbPendingImg) processProductBatchSource(pbPendingImg); };
    const btnPbQualityRetake=document.getElementById('btn-pb-quality-retake');
    if(btnPbQualityRetake) btnPbQualityRetake.onclick=()=>{ pbPendingImg=null; restartScannerCamera(); };
    const btnPbCancelReading=document.getElementById('btn-pb-cancel-reading');
    if(btnPbCancelReading) btnPbCancelReading.onclick=cancelProductBatchReading;
    const btnPbAddRow=document.getElementById('btn-pb-add-row');
    if(btnPbAddRow) btnPbAddRow.onclick=addManualProductBatchRow;
    const btnPbOpenItem=document.getElementById('btn-pb-open-item');
    if(btnPbOpenItem) btnPbOpenItem.onclick=()=>{
      const item=inventory.find(i=>i.id===pbMatchedId);
      closeProductBatchModal();
      if(item) openItemModal(item);
    };
    // "Producto nuevo" desde el estado matched: el escáner emparejó por parecido
    // pero el usuario sabe que es OTRO producto — pasa a revisión con la línea
    // lista para agregarse aparte (destildada de duplicado y seleccionada).
    const btnPbAddAsNew=document.getElementById('btn-pb-add-as-new');
    if(btnPbAddAsNew) btnPbAddAsNew.onclick=()=>{
      if(pbItems[0]){ pbItems[0].dupOfId=null; pbItems[0].selected=true; }
      pbMatchedId=null;
      pbState='review';
      render();
    };
    const btnApplyPb=document.getElementById('btn-apply-pb');
    if(btnApplyPb) btnApplyPb.onclick=applyProductBatch;
    // Los campos de cada fila escriben directo en pbItems — el checkbox re-renderiza
    // (cambia la opacidad de la fila y el contador del botón), el resto no re-dibuja
    // nada para no pisar el tipeo (misma razón que handleProfitFieldInput).
    document.querySelectorAll('[data-pb-selected]').forEach(cb=>{
      cb.onchange=()=>{ const it=pbItems[+cb.getAttribute('data-pb-selected')]; if(it){ it.selected=cb.checked; render(); } };
    });
    document.querySelectorAll('[data-pb-name]').forEach(inp=>{
      inp.oninput=()=>{ const it=pbItems[+inp.getAttribute('data-pb-name')]; if(it) it.name=inp.value; };
    });
    document.querySelectorAll('[data-pb-unit]').forEach(sel=>{
      sel.onchange=()=>{ const it=pbItems[+sel.getAttribute('data-pb-unit')]; if(it) it.unit=sel.value; };
    });
    document.querySelectorAll('[data-pb-qty]').forEach(inp=>{
      inp.oninput=()=>{ const it=pbItems[+inp.getAttribute('data-pb-qty')]; if(it) it.qty=inp.value; };
    });
    document.querySelectorAll('[data-pb-cost]').forEach(inp=>{
      inp.oninput=()=>{ const it=pbItems[+inp.getAttribute('data-pb-cost')]; if(it) it.cost=inp.value; };
    });
    document.querySelectorAll('[data-pb-category]').forEach(sel=>{
      // Mismo criterio que data-scan-category en recibos: elegir (aunque sea "Sin
      // categoría") apaga el aviso de "no estamos seguros". "__create__" muestra
      // el campo de nombre de la fila (crear sin salir — pedido del usuario).
      sel.onchange=()=>{
        const idx=+sel.getAttribute('data-pb-category');
        const it=pbItems[idx]; if(!it) return;
        if(sel.value==='__create__'){
          const inp=document.querySelector(`[data-pb-newcat="${idx}"]`);
          if(inp){ inp.style.display='block'; inp.focus(); }
          return;
        }
        it.categoryId=sel.value||null; it.categoryTouched=true; render();
      };
    });
    document.querySelectorAll('[data-pb-newcat]').forEach(inp=>{
      const idx=+inp.getAttribute('data-pb-newcat');
      const commit=()=>{
        const it=pbItems[idx]; if(!it) return;
        const name=inp.value.trim();
        if(!name){
          const sel=document.querySelector(`[data-pb-category="${idx}"]`);
          if(sel) sel.value = (typeof it.categoryId==='string' && !it.categoryId.startsWith('__')) ? it.categoryId : (it.categoryId||'');
          inp.style.display='none';
          return;
        }
        let cat = categories.find(c=>c.name.trim().toLowerCase()===name.toLowerCase());
        if(!cat){ cat={id:uid('cat'), name}; categories.push(cat); saveState(); }
        it.categoryId=cat.id; it.categoryTouched=true;
        inp.value='';
        render();
      };
      inp.onblur=commit;
      inp.onkeydown=(e)=>{
        if(e.key==='Enter'){ e.preventDefault(); inp.blur(); }
        else if(e.key==='Escape'){ inp.value=''; inp.blur(); }
      };
    });
  }

  document.querySelectorAll('[data-view-receipt]').forEach(card=>{
    card.onclick=()=>{ showReceiptDetail=card.dataset.viewReceipt; showDayModal=null; render(); };
  });
  // Cualquier día del calendario abre el modal unificado del día (recibos + notas).
  document.querySelectorAll('[data-cal-day]').forEach(cell=>{
    cell.onclick=()=>{ showDayModal=cell.dataset.calDay; dayNoteDraft=''; render(); };
  });
  const dayModalOverlay=document.getElementById('day-modal-overlay');
  if(dayModalOverlay){
    dayModalOverlay.onmousedown=(e)=>{ if(e.target===dayModalOverlay){ showDayModal=null; dayNoteDraft=''; render(); } };
    const closeDayModalBtn=document.getElementById('btn-close-day-modal');
    if(closeDayModalBtn) closeDayModalBtn.onclick=()=>{ showDayModal=null; dayNoteDraft=''; render(); };
    // Compositor de notas: la vista previa se actualiza tocando el DOM directo en
    // cada tecla (sin render() — un redibujado completo por tecla haría perder el
    // foco del teclado en el celular); render() recién al agregar o borrar.
    const noteInput=document.getElementById('day-note-input');
    const notePreview=document.getElementById('day-note-preview');
    const notePreviewText=document.getElementById('day-note-preview-text');
    if(noteInput){
      // dayNoteDraft es la fuente de verdad, no el atributo value del HTML:
      // morphdom actualiza ATRIBUTOS pero no pisa la PROPIEDAD .value de un input
      // que el usuario ya tocó — sin esta línea, agregar una nota dejaba el texto
      // recién guardado adentro del input en vez de limpiarlo.
      noteInput.value = dayNoteDraft;
      noteInput.oninput=()=>{
        dayNoteDraft=noteInput.value;
        const previewStr = calNotePreviewText(dayNoteDraft);
        if(notePreviewText) notePreviewText.textContent=previewStr;
        if(notePreview) notePreview.style.display=previewStr?'':'none';
      };
      noteInput.onkeydown=(e)=>{ if(e.key==='Enter') addDayNote(); };
    }
    const addNoteBtn=document.getElementById('btn-add-day-note');
    if(addNoteBtn) addNoteBtn.onclick=addDayNote;
    document.querySelectorAll('[data-delete-note]').forEach(btn=>{
      btn.onclick=()=>{
        const id=btn.dataset.deleteNote;
        const deleted=calNotes.find(n=>n.id===id);
        calNotes=calNotes.filter(n=>n.id!==id);
        // Lápida: sin esto, otro dispositivo que no se enteró re-subiría su copia
        // de meta con la nota adentro y la revivía (mismo bug ya arreglado para
        // productos/recibos, ver deletedInventoryIds).
        if(!deletedCalNoteIds.includes(id)) deletedCalNoteIds.push(id);
        saveState();
        if(deleted) logActivity('note_deleted', deleted.text);
        render();
      };
    });
  }
  const receiptDetailOverlay=document.getElementById('receipt-detail-overlay');
  if(receiptDetailOverlay){
    receiptDetailOverlay.onmousedown=(e)=>{ if(e.target===receiptDetailOverlay){ showReceiptDetail=null; render(); } };
    const closeBtn=document.getElementById('btn-close-receipt-detail');
    if(closeBtn) closeBtn.onclick=()=>{ showReceiptDetail=null; render(); };
    const currentReceipt = receipts.find(x=>x.id===showReceiptDetail);
    const deleteBtn=document.getElementById('btn-delete-receipt');
    if(deleteBtn && currentReceipt) deleteBtn.onclick=()=>deleteReceipt(currentReceipt.id);
    const printBtn=document.getElementById('btn-print-receipt');
    if(printBtn && currentReceipt) printBtn.onclick=()=>printReceipt(currentReceipt);
    const shareBtn=document.getElementById('btn-share-receipt');
    if(shareBtn && currentReceipt) shareBtn.onclick=()=>shareReceipt(currentReceipt);
  }

  const btnCalPrev=document.getElementById('btn-cal-prev');
  if(btnCalPrev) btnCalPrev.onclick=()=>{ setCalendarMonth(shiftMonthStr(calendarViewMonth,-1)); render(); };
  const btnCalNext=document.getElementById('btn-cal-next');
  if(btnCalNext) btnCalNext.onclick=()=>{ setCalendarMonth(shiftMonthStr(calendarViewMonth,1)); render(); };
  const btnCalMonthLabel=document.getElementById('btn-cal-month-label');
  if(btnCalMonthLabel) btnCalMonthLabel.onclick=()=>{ calendarShowYearPicker=!calendarShowYearPicker; render(); };
  const btnCalPrevYear=document.getElementById('btn-cal-prev-year');
  if(btnCalPrevYear) btnCalPrevYear.onclick=()=>{ setCalendarMonth(shiftMonthStr(calendarViewMonth,-12)); render(); };
  const btnCalNextYear=document.getElementById('btn-cal-next-year');
  if(btnCalNextYear) btnCalNextYear.onclick=()=>{ setCalendarMonth(shiftMonthStr(calendarViewMonth,12)); render(); };
  document.querySelectorAll('[data-cal-select-month]').forEach(btn=>{
    btn.onclick=()=>{ setCalendarMonth(btn.dataset.calSelectMonth); calendarShowYearPicker=false; render(); };
  });
  const btnShowMoreReceipts=document.getElementById('btn-show-more-receipts');
  if(btnShowMoreReceipts) btnShowMoreReceipts.onclick=()=>{ receiptsShownLimit += RECEIPTS_WINDOW_STEP; render(); };
  const receiptSearchInp=document.getElementById('receipt-search');
  if(receiptSearchInp) receiptSearchInp.oninput=(e)=>{
    // render() reemplaza el innerHTML entero (recrea el <input>), así que sin esto
    // el cursor/foco se perdería en cada letra que se escribe en la búsqueda
    const cursorPos = e.target.selectionStart;
    receiptSearchQuery = e.target.value;
    receiptsShownLimit = RECEIPTS_WINDOW_STEP; // buscar resetea la ventana de recibos
    try{
      if(receiptSearchQuery) localStorage.setItem('patron_receipt_search', receiptSearchQuery);
      else localStorage.removeItem('patron_receipt_search');
    }catch(e){}
    scheduleSearchTriggeredRender(()=>{
      const freshInp = document.getElementById('receipt-search');
      if(freshInp){ freshInp.focus(); freshInp.setSelectionRange(cursorPos, cursorPos); }
    });
  };
  const calAmountInp=document.getElementById('cal-amount-search');
  if(calAmountInp) calAmountInp.oninput=(e)=>{
    const cursorPos = e.target.selectionStart;
    applyCalendarSearch(e.target.value);
    scheduleSearchTriggeredRender(()=>{
      const freshInp = document.getElementById('cal-amount-search');
      if(freshInp){ freshInp.focus(); freshInp.setSelectionRange(cursorPos, cursorPos); }
    });
  };

  document.querySelectorAll('[data-history-item]').forEach(b=>{ b.onclick=()=>openPriceHistoryModal(b.dataset.historyItem); });
  const priceHistoryOverlay=document.getElementById('price-history-overlay');
  if(priceHistoryOverlay){
    priceHistoryOverlay.onmousedown=(e)=>{ if(e.target===priceHistoryOverlay) closePriceHistoryModal(); };
    const closeHistoryBtn=document.getElementById('btn-close-price-history');
    if(closeHistoryBtn) closeHistoryBtn.onclick=closePriceHistoryModal;
  }

  document.querySelectorAll('[data-edit-item]').forEach(b=>{ b.onclick=()=>openItemModal(inventory.find(i=>i.id===b.dataset.editItem)); });
  document.querySelectorAll('[data-delete-stock-item]').forEach(b=>{
    b.onclick=(e)=>{ e.stopPropagation(); deleteStockItem(b.dataset.deleteStockItem, b); };
  });
  // Buscador del inventario (vive en la pestaña Inventario desde 2026-09-04 —
  // se busca donde están todos los ítems): filtra en vivo con cada tecla,
  // patrón debounce+foco de receipt-search (el render recrea el input a mitad
  // de tipeo sin esto).
  const invSearchInp=document.getElementById('inv-search');
  if(invSearchInp) invSearchInp.oninput=(e)=>{
    const cursorPos=e.target.selectionStart;
    invSearch=e.target.value;
    scheduleSearchTriggeredRender(()=>{
      const fresh=document.getElementById('inv-search');
      if(fresh){ fresh.focus(); try{ fresh.setSelectionRange(cursorPos,cursorPos); }catch(err){} }
    });
  };
  // Selector de vista del inventario (fila / 2 col / 3 col) — preferencia local.
  document.querySelectorAll('[data-inv-layout]').forEach(b=>{
    b.onclick=()=>{
      if(invLayout===b.dataset.invLayout) return;
      invLayout=b.dataset.invLayout;
      try{ localStorage.setItem('patron_inv_layout', invLayout); }catch(e){}
      invLayoutTransitionPending=true; // este render anima (View Transition, app-04)
      render();
    };
  });
  // Inventario reorganizado (maqueta 2026-09-07): orden, filtros rápidos, chip
  // "Todos", grupos plegables y "ver los restantes".
  const invSortSel=document.getElementById('inv-sort');
  if(invSortSel) invSortSel.onchange=()=>{
    invSort=invSortSel.value;
    try{ localStorage.setItem('patron_inv_sort', invSort); }catch(e){}
    invLayoutTransitionPending=true; render();
  };
  document.querySelectorAll('[data-inv-quick]').forEach(b=>{
    b.onclick=()=>{ const k=b.dataset.invQuick; invQuickFilter = (invQuickFilter===k) ? null : k; render(); };
  });
  // "Todos": con un filtro de categoría puesto lo quita; ya sin filtro (pedido
  // del usuario 2026-09-08: "cuando le doy no hace nada") PLIEGA todos los
  // grupos, y el toque siguiente los despliega todos — misma memoria por
  // dispositivo que el chevron de cada grupo (patron_inv_collapsed).
  const invAllChip=document.querySelector('[data-inv-all]');
  if(invAllChip) invAllChip.onclick=()=>{
    if(inventoryCategoryFilter){ inventoryCategoryFilter=null; render(); return; }
    const heads=[...document.querySelectorAll('[data-inv-group]')];
    if(heads.length===0) return;
    const anyOpen = heads.some(h=>!h.classList.contains('collapsed'));
    heads.forEach(h=>{ const k=h.dataset.invGroup; if(anyOpen) invCollapsed.add(k); else invCollapsed.delete(k); });
    try{ localStorage.setItem('patron_inv_collapsed', JSON.stringify([...invCollapsed])); }catch(e){}
    render();
  };
  document.querySelectorAll('[data-inv-group]').forEach(h=>{
    h.onclick=()=>{
      const k=h.dataset.invGroup;
      if(invCollapsed.has(k)) invCollapsed.delete(k); else invCollapsed.add(k);
      try{ localStorage.setItem('patron_inv_collapsed', JSON.stringify([...invCollapsed])); }catch(e){}
      render();
    };
    h.onkeydown=(e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); h.click(); } };
  });
  document.querySelectorAll('[data-inv-more]').forEach(b=>{
    b.onclick=()=>{ const k=b.dataset.invMore; if(invExpanded.has(k)) invExpanded.delete(k); else invExpanded.add(k); render(); };
  });
  // Tarjeta-botón del inventario: tocar el ítem abre su ficha (editar/eliminar).
  document.querySelectorAll('[data-open-item]').forEach(el=>{
    el.onclick=()=>{
      const item=inventory.find(x=>x.id===el.dataset.openItem);
      if(item) openItemModal(item);
    };
  });
  // Tocar el ícono en la lista: CON foto abre el visor grande (reconocer el ítem
  // cuando la miniatura no alcanza); SIN foto, el selector para subir una directo.
  document.querySelectorAll('[data-photo-item]').forEach(el=>{
    el.onclick=(e)=>{
      e.stopPropagation();
      const item = inventory.find(x=>x.id===el.dataset.photoItem);
      if(!item) return;
      if(itemPhotoSrc(item)){ photoViewItemId = item.id; render(); }
      else promptItemPhotoUpload(item);
    };
  });
  const pvOverlay=document.getElementById('photo-viewer-overlay');
  if(pvOverlay){
    const closeViewer=()=>{ photoViewItemId=null; render(); };
    pvOverlay.onmousedown=(e)=>{ if(e.target===pvOverlay) closeViewer(); };
    document.getElementById('pv-close').onclick=closeViewer;
    document.getElementById('pv-change').onclick=()=>{
      const item=inventory.find(x=>x.id===photoViewItemId);
      if(item) promptItemPhotoUpload(item); // el visor queda abierto y muestra la nueva
    };
    document.getElementById('pv-delete').onclick=()=>{
      const item=inventory.find(x=>x.id===photoViewItemId);
      if(!item) return;
      if(!confirm(t('pv_delete_confirm'))) return;
      item.photo=null;
      if(currentUser){ item.lastEditedBy=currentUserLabel(); item.lastEditedAt=new Date().toISOString(); }
      photoViewItemId=null;
      saveState(); render();
    };
  }

  /* Modal ingrediente */
  const itemOverlay=document.getElementById('item-overlay');
  if(itemOverlay){
    itemOverlay.onmousedown=(e)=>{ if(e.target===itemOverlay) closeItemModal(); };
    document.getElementById('btn-cancel-item').onclick=closeItemModal;
    const btnCloseItemModal=document.getElementById('btn-close-item-modal');
    if(btnCloseItemModal) btnCloseItemModal.onclick=closeItemModal;
    // Eliminar desde la ficha (las filas ya no tienen ✕): deleteStockItem pide
    // confirmación por su cuenta; si el usuario canceló, el ítem sigue y el
    // modal queda abierto.
    const btnDeleteItemModal=document.getElementById('btn-delete-item-modal');
    if(btnDeleteItemModal) btnDeleteItemModal.onclick=()=>{
      const id=draftItem && draftItem.id;
      if(!id) return;
      deleteStockItem(id, btnDeleteItemModal);
      if(!inventory.some(i=>i.id===id)) closeItemModal();
    };
    const itemPhotoFile=document.getElementById('item-photo-file');
    const btnUploadItemPhoto=document.getElementById('btn-upload-item-photo');
    if(btnUploadItemPhoto && itemPhotoFile) btnUploadItemPhoto.onclick=()=>itemPhotoFile.click();
    if(itemPhotoFile) itemPhotoFile.onchange=async (e)=>{
      const file=e.target.files[0];
      itemPhotoFile.value='';
      if(!file || !/^image\//.test(file.type)) return;
      try{
        const img = await loadImageFromFile(file);
        // Es solo un ícono chico en la lista — 300px/calidad 0.75 alcanza de sobra
        // y pesa muy poco, a diferencia de las fotos de recibos.
        draftItem.photo = resizeToBase64(img, 300, 0.75);
        render();
      }catch(err){
        showToast(err.message || t('err_img_process'), 'error');
      }
    };
    const btnRemoveItemPhoto=document.getElementById('btn-remove-item-photo');
    if(btnRemoveItemPhoto) btnRemoveItemPhoto.onclick=()=>{ draftItem.photo=null; render(); };
    const btnScanProduct=document.getElementById('btn-scan-product');
    const itemScanPhotoFile=document.getElementById('item-scan-photo-file');
    if(btnScanProduct && itemScanPhotoFile) btnScanProduct.onclick=()=>{
      // Trial anónimo: la cuenta se crea en segundo plano mientras el usuario elige
      // la foto; identifyProductFromPhoto() la espera antes de llamar a la API.
      // Cuenta real desconectada → login de siempre (ver everHadRealAccount).
      if(!currentUser){
        if(everHadRealAccount()){ ensurePatronFirebaseReady().catch(()=>{}); openAuthModal(t('scan_requires_account')); return; }
        ensureTrialAccount().catch(()=>{});
      }
      itemScanPhotoFile.click();
    };
    if(itemScanPhotoFile) itemScanPhotoFile.onchange=async (e)=>{
      const file=e.target.files[0];
      itemScanPhotoFile.value='';
      if(!file || !/^image\//.test(file.type)) return;
      // Token de petición: si se dispara un segundo escaneo antes de que vuelva el
      // primero, la respuesta vieja se descarta — sin esto, una respuesta lenta y
      // vieja podía pisar el formulario que ya había rellenado una más nueva.
      const scanReq = ++productScanRequestId;
      productScanState='loading'; productScanError=''; render();
      try{
        const img = await loadImageFromFile(file);
        const image = resizeToBase64(img, 1400, 0.9);
        const result = await identifyProductFromPhoto(image);
        if(scanReq !== productScanRequestId) return;
        // Si el usuario cerró el modal mientras la IA respondía, closeItemModal ya puso
        // draftItem en null — tocarlo acá tiraba un TypeError. Se descarta el resultado.
        if(!draftItem){ productScanState='idle'; return; }
        // Lo que el usuario YA escribió no se pisa (auditoría 2026-09-07): se
        // rellenan solo los campos vacíos; para los ocupados queda un chip
        // "Detectado: X · Usar". El costo solo si la foto mostraba un precio.
        const g = id => document.getElementById(id);
        if(g('fi-name')) draftItem.name = g('fi-name').value;
        if(g('fi-cost')) draftItem.costPerUnit = g('fi-cost').value;
        if(g('fi-sku')) draftItem.sku = g('fi-sku').value;
        productScanSuggest = {};
        const nameTyped = String(draftItem.name||'').trim();
        if(result.name){ if(!nameTyped) draftItem.name = result.name; else if(result.name!==nameTyped) productScanSuggest.name = {label:result.name, value:result.name}; }
        if(result.unit && result.unit!==draftItem.unit){
          if(!nameTyped) draftItem.unit = result.unit; else productScanSuggest.unit = {label:unitLabel(result.unit), value:result.unit};
        }
        if(result.price_visible===true && typeof result.cost_per_unit==='number'){
          const costTyped = parseFloat(draftItem.costPerUnit)>0;
          if(!costTyped) draftItem.costPerUnit = result.cost_per_unit; else if(result.cost_per_unit!==parseFloat(draftItem.costPerUnit)) productScanSuggest.cost = {label:money(result.cost_per_unit), value:result.cost_per_unit};
        }
        if(result.sku){ if(!String(draftItem.sku||'').trim()) draftItem.sku = result.sku; else if(result.sku!==draftItem.sku) productScanSuggest.sku = {label:result.sku, value:result.sku}; }
        if(result.category){
          const match = categories.find(c=>c.name===result.category);
          if(match){ if(!draftItem.categoryId) draftItem.categoryId = match.id; else if(draftItem.categoryId!==match.id) productScanSuggest.category = {label:match.name, value:match.id}; }
        }
        // Ya sacó la foto para identificar el producto — reusarla como ícono (mismo
        // tamaño/calidad que sube "Subir foto" a mano) evita que tenga que sacar una
        // segunda foto para lo mismo. Se pisa a propósito aunque ya hubiera una: si
        // volvió a escanear, es porque quiere una foto nueva.
        draftItem.photo = resizeToBase64(img, 300, 0.75);
        productScanState='idle';
        render();
      }catch(err){
        if(scanReq !== productScanRequestId) return;
        productScanState='error'; productScanError = err.message || t('product_scan_error');
        render();
      }
    };
    const btnScanBarcode=document.getElementById('btn-scan-barcode');
    if(btnScanBarcode) btnScanBarcode.onclick=openBarcodeScanModal;
    // Chips "Detectado: X · Usar" (identificación con foto sobre campos ya escritos).
    document.querySelectorAll('[data-scan-suggest]').forEach(chip=>{
      chip.onclick=()=>{
        const k=chip.dataset.scanSuggest; const s=productScanSuggest && productScanSuggest[k]; if(!s) return;
        const g = id => document.getElementById(id);
        if(g('fi-name')) draftItem.name = g('fi-name').value;
        if(g('fi-cost')) draftItem.costPerUnit = g('fi-cost').value;
        if(g('fi-sku')) draftItem.sku = g('fi-sku').value;
        if(k==='name') draftItem.name = s.value;
        else if(k==='unit') draftItem.unit = s.value;
        else if(k==='cost') draftItem.costPerUnit = s.value;
        else if(k==='sku') draftItem.sku = s.value;
        else if(k==='category') draftItem.categoryId = s.value;
        delete productScanSuggest[k];
        render();
      };
    });
    // Recalcula el % de ganancia en vivo mientras se escribe el costo o el precio de
    // venta. Antes esto llamaba a render() (reconstruía la ventana entera) para
    // actualizar el número — pero como el modal tiene una animación de entrada, cada
    // letra que se escribía volvía a disparar esa animación, y la ventana "temblaba"
    // con cada tecla. Ahora solo se actualiza el numerito de la ganancia directamente
    // en el DOM, sin tocar el resto de la ventana — ni tiembla, ni hace falta el truco
    // de devolver el foco/cursor de antes (el campo nunca se destruye).
    function handleProfitFieldInput(){
      const saleEl = document.getElementById('fi-sale-price');
      if(!saleEl) return; // sin permiso financiero la fila de ganancia no existe
      const cost = document.getElementById('fi-cost').value;
      const sale = saleEl.value;
      const margin = profitMarginPct(cost, sale);
      const display = margin===null ? '—' : `${margin.toFixed(0)}%`;
      const color = margin===null ? 'var(--ink-soft)' : margin<0 ? 'var(--tomato)' : margin<15 ? 'var(--saffron)' : 'var(--basil)';
      const el = document.getElementById('fi-profit-display');
      if(el){ el.textContent = display; el.style.color = color; }
    }
    const fiCostInp=document.getElementById('fi-cost');
    const fiSalePriceInp=document.getElementById('fi-sale-price');
    if(fiCostInp) fiCostInp.oninput=handleProfitFieldInput;
    if(fiSalePriceInp) fiSalePriceInp.oninput=handleProfitFieldInput;
    // Crear categoría sin salir de la ficha: elegir "＋ Crear categoría nueva…"
    // muestra el campo de nombre (el foco acá SÍ corresponde: el usuario acaba de
    // pedir escribir); Enter o salir del campo la crea y la deja seleccionada,
    // Escape o vacío cancela y vuelve a la selección anterior.
    const fiCategorySel=document.getElementById('fi-category');
    const fiNewCatInp=document.getElementById('fi-new-category');
    if(fiCategorySel && fiNewCatInp){
      fiCategorySel.onchange=()=>{
        if(fiCategorySel.value==='__create__'){
          fiNewCatInp.style.display='block';
          fiNewCatInp.focus();
        } else {
          fiNewCatInp.style.display='none';
          if(draftItem) draftItem.categoryId = fiCategorySel.value || null;
        }
      };
      const commitNewCat=()=>{
        const name=fiNewCatInp.value.trim();
        if(!name){
          fiCategorySel.value = (draftItem && draftItem.categoryId) || '';
          fiNewCatInp.style.display='none';
          return;
        }
        let cat = categories.find(c=>c.name.trim().toLowerCase()===name.toLowerCase());
        if(!cat){ cat={id:uid('cat'), name}; categories.push(cat); saveState(); }
        if(draftItem) draftItem.categoryId=cat.id;
        fiNewCatInp.value='';
        render();
      };
      fiNewCatInp.onblur=commitNewCat;
      fiNewCatInp.onkeydown=(e)=>{
        if(e.key==='Enter'){ e.preventDefault(); fiNewCatInp.blur(); }
        else if(e.key==='Escape'){ fiNewCatInp.value=''; fiNewCatInp.blur(); }
      };
    }
    // Espejo del creador de arriba pero para las categorías de GASTO (lista
    // expenseCategories, universo aparte del inventario): la ficha de gasto
    // renderiza fi-exp-category en vez de fi-category. Compartir nombre con una
    // categoría de inventario es válido — ids y listas nunca se cruzan.
    const fiExpCategorySel=document.getElementById('fi-exp-category');
    const fiNewExpCatInp=document.getElementById('fi-new-exp-category');
    if(fiExpCategorySel && fiNewExpCatInp){
      fiExpCategorySel.onchange=()=>{
        if(fiExpCategorySel.value==='__create__'){
          fiNewExpCatInp.style.display='block';
          fiNewExpCatInp.focus();
        } else {
          fiNewExpCatInp.style.display='none';
          if(draftItem) draftItem.expenseCategoryId = fiExpCategorySel.value || null;
        }
      };
      const commitNewExpCat=()=>{
        const name=fiNewExpCatInp.value.trim();
        if(!name){
          fiExpCategorySel.value = (draftItem && draftItem.expenseCategoryId) || '';
          fiNewExpCatInp.style.display='none';
          return;
        }
        let cat = expenseCategories.find(c=>c.name.trim().toLowerCase()===name.toLowerCase());
        if(!cat){ cat={id:uid('xcat'), name}; expenseCategories.push(cat); saveState(); }
        if(draftItem) draftItem.expenseCategoryId=cat.id;
        fiNewExpCatInp.value='';
        render();
      };
      fiNewExpCatInp.onblur=commitNewExpCat;
      fiNewExpCatInp.onkeydown=(e)=>{
        if(e.key==='Enter'){ e.preventDefault(); fiNewExpCatInp.blur(); }
        else if(e.key==='Escape'){ fiNewExpCatInp.value=''; fiNewExpCatInp.blur(); }
      };
    }
    document.getElementById('btn-save-item').onclick=()=>{
      const nameInput=document.getElementById('fi-name');
      const name=nameInput.value.trim();
      if(!name){
        // Feedback directo en el DOM (sin render(), que re-dispararía la animación
        // de entrada del modal): borde rojo + mensaje debajo del campo + foco. El
        // error se limpia solo apenas se empieza a escribir un nombre.
        nameInput.setAttribute('aria-invalid','true');
        let errEl=document.getElementById('fi-name-error');
        if(!errEl){
          errEl=document.createElement('div');
          errEl.id='fi-name-error';
          errEl.className='field-error';
          nameInput.insertAdjacentElement('afterend', errEl);
        }
        errEl.textContent=t('item_name_required');
        nameInput.oninput=()=>{
          if(nameInput.value.trim()){
            nameInput.removeAttribute('aria-invalid');
            const e=document.getElementById('fi-name-error');
            if(e) e.remove();
            nameInput.oninput=null;
          }
        };
        nameInput.scrollIntoView({block:'center', behavior:'smooth'});
        nameInput.focus({preventScroll:true});
        return;
      }
      const item={
        id:draftItem.id, name,
        // La ficha de GASTO (servicios/Eat out) no renderiza unidad, stock,
        // precio de venta, SKU ni capacidad — cada campo ausente conserva el
        // valor que el ítem ya tenía en vez de pisarlo (mismo criterio que ya
        // usaba salePrice sin permiso financiero).
        unit:(el=>el ? el.value : draftItem.unit)(document.getElementById('fi-unit')),
        // Math.max(0,…): stock/costo/precio negativos tipeados a mano contaminaban
        // el Valor del inventario y el potencial (auditoría 2026-09-04).
        costPerUnit:Math.max(0, parseFloat(document.getElementById('fi-cost').value)||0),
        updated:draftItem.updated||false,
        qtyOnHand:(el=>el ? Math.max(0, parseFloat(el.value)||0) : (draftItem.qtyOnHand||0))(document.getElementById('fi-stock')),
        photo:draftItem.photo||null,
        salePrice:(el=>el ? Math.max(0, parseFloat(el.value)||0) : (draftItem.salePrice||0))(document.getElementById('fi-sale-price')),
        sku:(el=>el ? el.value.trim() : (draftItem.sku||''))(document.getElementById('fi-sku')),
        supplier:(el=>el ? el.value.trim() : (draftItem.supplier||''))(document.getElementById('fi-supplier')),
        // expenseOnly viaja SIEMPRE: sin esto, editar un ítem de Eat out por la
        // ficha lo "convertía" en producto normal en silencio (bug pre-existente).
        expenseOnly:!!draftItem.expenseOnly,
        // '__create__' es la opción "crear nueva" sin nombre confirmado — nunca
        // debe guardarse como si fuera un id de categoría real. La ficha de
        // gasto no renderiza fi-category (usa fi-exp-category, lista aparte).
        categoryId:(el=>el ? ((v=>v==='__create__' ? null : (v||null))(el.value)) : null)(document.getElementById('fi-category')),
        expenseCategoryId:(el=>el ? ((v=>v==='__create__' ? null : (v||null))(el.value)) : (draftItem.expenseCategoryId||null))(document.getElementById('fi-exp-category')),
        // Capacidad del envase lleno (para el escáner de estante) — vacío o 0 se
        // guarda como null, nunca como un cero que el escáner tomaría por real.
        capacityFull:(()=>{ const el=document.getElementById('fi-capacity'); if(!el) return draftItem.capacityFull||null; const v=parseFloat(el.value); return Number.isFinite(v) && v>0 ? v : null; })()
      };
      // stockFullRef no tiene campo en el formulario, así que hay que arrastrarlo a
      // mano (este objeto se reconstruye desde cero y lo perdería). Subir el stock
      // a mano cuenta como entrada → ese nivel es el nuevo "lleno"; bajarlo es
      // consumo/corrección y deja la marca como estaba.
      {
        const prev = inventory.find(i=>i.id===draftItem.id);
        const prevQty = prev ? (prev.qtyOnHand||0) : 0;
        if(!prev || item.qtyOnHand > prevQty) item.stockFullRef = item.qtyOnHand || null;
        else item.stockFullRef = (prev && prev.stockFullRef) || null;
      }
      // El "quién y cuándo" solo tiene sentido si hay una cuenta detrás — un uso 100%
      // local, sin sesión, no tiene a quién atribuirle el cambio.
      if(currentUser){ item.lastEditedBy = currentUserLabel(); item.lastEditedAt = new Date().toISOString(); }
      // Si en el rato que el modal estuvo abierto llegó un snapshot remoto que borró
      // este mismo ítem (otro dispositivo/miembro del equipo lo eliminó), idx da -1 —
      // "inventory[-1]=item" crearía una propiedad no indexada que el resto de la app
      // (JSON.stringify, forEach, el sync a Firestore) ignora por completo, así que la
      // edición se perdía en silencio. En ese caso se re-crea el ítem en vez de perderlo.
      const idx = editingItem ? inventory.findIndex(i=>i.id===editingItem) : -1;
      const wasEditing = editingItem && idx!==-1;
      if(idx!==-1) inventory[idx]=item;
      else inventory.push(item);
      // Bill nuevo con "registrar el pago de este mes" marcado: se crea el
      // recibo manual de gasto AHORA — es lo que mueve la barra del presupuesto
      // y el gasto del mes (el ítem solo es el catálogo). Mismo shape que el
      // gasto manual de siempre: aparece en Recibos y se borra como cualquiera.
      const regPay = document.getElementById('fi-register-payment');
      if(regPay && regPay.checked && isExpenseItem(item) && item.costPerUnit>0){
        receipts.push({
          id: uid('r'), images: [], supplier: item.name, date: localDateStr(),
          total: Math.round(item.costPerUnit*100)/100, itemCount: 0, appliedItems: [],
          createdAt: new Date().toISOString(), purchaseIds: [], manual: true,
          manualKind: 'expense', billItemId: item.id
        });
        showToast(t('expense_payment_logged').replace('{name}', item.name));
      }
      saveState();
      logActivity(wasEditing ? 'item_edited' : 'item_created', name);
      closeItemModal();
    };
  }

  /* Modal código de barras */
  const barcodeScanOverlay=document.getElementById('barcode-scan-overlay');
  if(barcodeScanOverlay){
    barcodeScanOverlay.onmousedown=(e)=>{ if(e.target===barcodeScanOverlay) closeBarcodeScanModal(); };
    const btnCloseBarcodeScan=document.getElementById('btn-close-barcode-scan');
    if(btnCloseBarcodeScan) btnCloseBarcodeScan.onclick=closeBarcodeScanModal;
    const btnBarcodeRetry=document.getElementById('btn-barcode-retry');
    if(btnBarcodeRetry) btnBarcodeRetry.onclick=()=>{
      barcodeScanState='scanning'; render();
      startBarcodeScanner();
    };
    // Entrada manual del código, linterna, y las dos salidas de "no encontrado"
    // (el código ya quedó como SKU): escribir el nombre o identificar con foto.
    const manualInp=document.getElementById('barcode-manual-input');
    const btnManual=document.getElementById('btn-barcode-manual');
    const goManual=async ()=>{
      const code=(manualInp && manualInp.value||'').replace(/\s+/g,'');
      if(!/^\d{6,14}$/.test(code)) return;
      await stopBarcodeScanner();
      lookupBarcode(code);
    };
    if(btnManual) btnManual.onclick=goManual;
    if(manualInp) manualInp.onkeydown=(e)=>{ if(e.key==='Enter'){ e.preventDefault(); goManual(); } };
    const btnTorch=document.getElementById('btn-barcode-torch');
    if(btnTorch) btnTorch.onclick=toggleBarcodeTorch;
    const btnBarcodeWrite=document.getElementById('btn-barcode-write');
    if(btnBarcodeWrite) btnBarcodeWrite.onclick=()=>{ showBarcodeScanModal=false; barcodeScanState='scanning'; render(); };
    const btnBarcodeIdentify=document.getElementById('btn-barcode-identify');
    if(btnBarcodeIdentify) btnBarcodeIdentify.onclick=()=>{
      showBarcodeScanModal=false; barcodeScanState='scanning'; render();
      const inp=document.getElementById('item-scan-photo-file'); if(inp) inp.click();
    };
  }

  /* Modal escaneo de recibo */
  const scanOverlay=document.getElementById('scan-overlay');
  if(scanOverlay){
    scanOverlay.onmousedown=(e)=>{ if(e.target===scanOverlay) closeScanModal(); };
    document.getElementById('btn-cancel-scan').onclick=()=>{
      // En modo lote, salir a mitad de la cola no pierde nada de lo ya guardado
      // (cada recibo se guarda al confirmarlo) — pero sí conviene decir qué quedó afuera.
      if(scanBatchMode && scanState==='matched'){
        scanQueueSkipped += scanQueue.length + 1; // el que está en pantalla también queda sin guardar
        scanQueue = [];
        finishScanBatch();
        return;
      }
      closeScanModal();
    };

    const dz=document.getElementById('drop-zone');
    const fileInput=document.getElementById('receipt-file');
    const galleryInput=document.getElementById('receipt-file-gallery');
    // Dos inputs separados (cámara forzada vs. galería) en vez de uno solo sin
    // "capture" — un input de archivo sin capture puede, según el WebView/Android,
    // saltar directo al explorador de archivos y esconder la opción de cámara (bug
    // reportado por un usuario real: "no puede tirar fotos, solo puede subir").
    // Mismo patrón ya usado en item-photo-file (subir, sin capture) vs.
    // item-scan-photo-file (cámara, con capture) más arriba en este archivo.
    // La galería permite elegir varias fotos de una (input "multiple") — un tester real
    // reportó que si ya tenía varias fotos de páginas de un mismo recibo guardadas, tener
    // que agregarlas de a una (cada tap volvía a abrir la cámara) era muy lento. Se
    // procesan en orden, una por una (await), para que las páginas queden en el orden en
    // que las eligió y no en el orden en que cada una termina de cargar/redimensionar.
    const onScanFilesChosen=(input)=>async(e)=>{
      const files=Array.from(e.target.files||[]);
      input.value=''; // permite volver a elegir el mismo archivo para otra página si hace falta
      for(const f of files) await addScanPage(f);
    };
    if(fileInput) fileInput.onchange=onScanFilesChosen(fileInput);
    if(galleryInput) galleryInput.onchange=onScanFilesChosen(galleryInput);
    // Intro única: la caja y "Agregar página" abren la cámara directo; los
    // links de galería, el input sin capture.
    if(dz) dz.onclick=()=>fileInput.click();
    const galleryBtn=document.getElementById('btn-scan-gallery');
    if(galleryBtn) galleryBtn.onclick=()=>galleryInput.click();
    const addPageBtn=document.getElementById('btn-add-scan-page');
    if(addPageBtn) addPageBtn.onclick=()=>fileInput.click();
    const addPageGalleryBtn=document.getElementById('btn-add-scan-gallery');
    if(addPageGalleryBtn) addPageGalleryBtn.onclick=()=>galleryInput.click();
    const processBtn=document.getElementById('btn-process-scan');
    if(processBtn) processBtn.onclick=()=>processReceiptImage();
    document.querySelectorAll('[data-remove-scan-page]').forEach(b=>{
      b.onclick=()=>{
        const idx = parseInt(b.dataset.removeScanPage);
        scanImages.splice(idx,1);
        scanImagesHiRes.splice(idx,1);
        scanSourceFiles.splice(idx,1);
        scanPageWarnings.splice(idx,1);
        render();
      };
    });

    document.querySelectorAll('[data-scan-mode]').forEach(b=>{
      b.onclick=()=>{
        scanBatchMode = b.dataset.scanMode==='batch';
        render();
      };
    });
    const skipQueuedBtn=document.getElementById('btn-skip-queued');
    if(skipQueuedBtn) skipQueuedBtn.onclick=()=>skipQueuedReceipt();

    const retryBtn=document.getElementById('btn-retry-scan');
    if(retryBtn) retryBtn.onclick=()=>{ scanState='idle'; render(); };
    // Cancelar la lectura SIN perder las páginas; la respuesta tardía se descarta.
    const cancelReadingBtn=document.getElementById('btn-cancel-reading');
    if(cancelReadingBtn) cancelReadingBtn.onclick=()=>{ scanRequestId++; endAiWait(); scanState='idle'; render(); };
    // Recibo cortado → volver a las páginas para agregar otra y leer de nuevo.
    const addPageAfterBtn=document.getElementById('btn-scan-add-page-after');
    if(addPageAfterBtn) addPageAfterBtn.onclick=()=>{ scanState='idle'; scanTruncated=false; render(); };
    // Foto de referencia: tira de miniaturas → visor a pantalla completa.
    document.querySelectorAll('[data-scan-view]').forEach(im=>{ im.onclick=()=>{ scanPhotoView=+im.dataset.scanView; render(); }; });
    const scanViewer=document.getElementById('scan-photo-viewer');
    if(scanViewer) scanViewer.onclick=()=>{ scanPhotoView=null; render(); };
    // Filas compactas: expandir al tocar, colapsar con el botón.
    document.querySelectorAll('[data-scan-expand]').forEach(row=>{
      const open=()=>{ const it=scanExtracted[+row.dataset.scanExpand]; if(it){ it.expanded=true; render(); } };
      row.onclick=open; row.onkeydown=(e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); open(); } };
    });
    document.querySelectorAll('[data-scan-collapse]').forEach(b=>{
      b.onclick=(e)=>{ e.stopPropagation(); const it=scanExtracted[+b.dataset.scanCollapse]; if(it){ it.expanded=false; render(); } };
    });

    document.querySelectorAll('[data-scan-name]').forEach(inp=>{
      inp.onchange=()=>{ scanExtracted[parseInt(inp.dataset.scanName)].rawName=inp.value; render(); };
    });
    document.querySelectorAll('[data-scan-match]').forEach(sel=>{
      sel.onchange=()=>{ scanExtracted[parseInt(sel.dataset.scanMatch)].matchedIngId=sel.value; render(); };
    });
    // "Es otro producto — agregarlo aparte": la salida de un toque de la alerta de
    // match por parecido. Al aplicar, el alias aprende rawName→producto nuevo, así
    // el próximo recibo ya no lo vuelve a emparejar con el parecido.
    document.querySelectorAll('[data-scan-make-new]').forEach(b=>{
      b.onclick=()=>{
        const item=scanExtracted[parseInt(b.dataset.scanMakeNew)];
        if(!item) return;
        item.matchedIngId='__new__';
        item.newIngName=null;
        render();
      };
    });
    document.querySelectorAll('[data-scan-confirm-match]').forEach(b=>{
      b.onclick=()=>{
        const item=scanExtracted[parseInt(b.dataset.scanConfirmMatch)];
        if(!item) return;
        item.fuzzyConfirmed=true;
        render();
      };
    });
    // Solo aparece para productos nuevos (ver isUnrecognized en scanModal) — Claude
    // sugiere una categoría con su propio criterio; si propuso una que no existe
    // todavía, el value es el sentinel "__newcat__:<nombre>" (se crea recién al
    // confirmar, en applyScanResults). El value vacío ("") sigue siendo "sin
    // categoría" — coincide con category_none_option.
    document.querySelectorAll('[data-scan-category]').forEach(sel=>{
      // categoryTouched: una vez que la persona eligió (aunque sea "Sin categoría"),
      // el aviso de "no estamos seguros" deja de mostrarse — ya no es verdad.
      sel.onchange=()=>{ const it=scanExtracted[parseInt(sel.dataset.scanCategory)]; it.suggestedCategoryId=sel.value||null; it.categoryTouched=true; render(); };
    });
    document.querySelectorAll('[data-scan-qty]').forEach(inp=>{
      inp.onchange=()=>{ const it=scanExtracted[parseInt(inp.dataset.scanQty)]; it.qty=parseFloat(inp.value)||0; it.qtyVerified=true; it.confidence='alta'; render(); };
    });
    // Mismo criterio que data-scan-qty de arriba: si lo corrige a mano, ya no hace
    // falta seguir marcándolo como "confianza baja/media" — la persona ya lo revisó.
    document.querySelectorAll('[data-scan-unit]').forEach(sel=>{
      sel.onchange=()=>{ const it=scanExtracted[parseInt(sel.dataset.scanUnit)]; it.unit=sel.value; it.confidence='alta'; render(); };
    });
    document.querySelectorAll('[data-scan-price]').forEach(inp=>{
      inp.onchange=()=>{ scanExtracted[parseInt(inp.dataset.scanPrice)].totalPrice=parseFloat(inp.value)||0; render(); };
    });
    document.querySelectorAll('[data-remove-scan-item]').forEach(b=>{
      b.onclick=()=>{ scanExtracted.splice(parseInt(b.dataset.removeScanItem),1); render(); };
    });
    const addScanItemBtn=document.getElementById('btn-add-scan-item');
    if(addScanItemBtn) addScanItemBtn.onclick=()=>{
      // La unidad por defecto de una fila agregada a mano copia a sus vecinas del
      // MISMO recibo (si la factura vino toda en lb, lo que faltó leer casi seguro
      // también es lb); sin vecinas, la más usada del inventario; sin nada, 'unidad'.
      const unitCounts={};
      scanExtracted.forEach(it=>{ if(it && it.unit) unitCounts[it.unit]=(unitCounts[it.unit]||0)+1; });
      let defUnit=null, n=0;
      Object.keys(unitCounts).forEach(u=>{ if(unitCounts[u]>n){ n=unitCounts[u]; defUnit=u; } });
      if(!defUnit || defUnit==='servicio') defUnit=mostUsedInventoryUnit('unidad');
      scanExtracted.push({rawName:'', qty:1, totalPrice:0, unit:defUnit, matchedIngId:'__new__', qtyVerified:true, confidence:'alta', mergedCount:1});
      render();
    };

    const supplierInp=document.getElementById('scan-supplier');
    if(supplierInp) supplierInp.oninput=(e)=>scanSupplier=e.target.value;
    const dateInp=document.getElementById('scan-date');
    if(dateInp) dateInp.oninput=(e)=>{ scanDate=e.target.value; if(scanDate && scanDate>localDateStr()) showToast(t('spend_future_date_note'), 'error'); };
    const invoiceTotalInp=document.getElementById('scan-invoice-total');
    if(invoiceTotalInp) invoiceTotalInp.oninput=(e)=>{ const v=parseFloat(e.target.value); scanInvoiceTotal=isNaN(v)?null:v; };
    const dupCheck=document.getElementById('scan-dup-confirm');
    if(dupCheck) dupCheck.onchange=(e)=>{ scanDuplicateConfirmed=e.target.checked; render(); };
    // Sin render(): solo guarda la decisión — redibujar acá haría perder el scroll
    // de una lista de confirmación larga por marcar/desmarcar un checkbox.
    const payReminderChk=document.getElementById('scan-pay-reminder');
    if(payReminderChk) payReminderChk.onchange=(e)=>{ scanPayReminder=e.target.checked; };

    const applyBtn=document.getElementById('btn-apply-scan');
    if(applyBtn) applyBtn.onclick=applyScanResults;
  }

  // Producción y salidas (recetas, producir, escáner de estante, historial) — app-08.
  attachProductionEvents();
  // Calculadora de pedido (tarjeta + panel en Inventario) — app-05.
  attachOrderCalcEvents();
}

function closeItemModal(){ showItemModal=false; editingItem=null; draftItem=null; render(); }

/* Guarda la nota escrita en el modal de día. El parser de Nudgy (buildCalNote)
   decide si es una nota fija de ese día, una fecha que el texto pide explícita
   ("mañana", "el 15 de octubre") o una recurrencia ("cada mes") — el texto del
   usuario se guarda tal cual lo escribió, nunca se reformatea (regla de Nudgy). */
function addDayNote(){
  const raw = dayNoteDraft.trim();
  if(!raw || !showDayModal) return;
  const built = buildCalNote(raw, showDayModal);
  calNotes.push(Object.assign(built, {
    id: uid('note'),
    createdAt: new Date().toISOString()
  }));
  dayNoteDraft='';
  saveState();
  logActivity('note_created', built.text);
  render();
}

/* ===== Catálogo — helpers compartidos (auditoría "smooth" 2026-09-07) ===== */
// Estado del gesto de selección (presión larga + arrastre) — fuera de
// attachEvents porque cada marca re-renderiza y vuelve a enganchar.
let catSelDrag=null, catSelLongTimer=null, catSelLongPressed=false;
// Estado del gesto del visor de fotos (zoom, pellizco, doble tap, chrome) —
// también fuera de attachEvents, por el mismo motivo.
let cvGesture={key:null};
// Texto del buscador del modal de asignar (sobrevive a los renders).
let catalogAssignQuery='';
// Vibración corta al marcar (Capacitor en la app nativa; navigator.vibrate en
// Android web; iOS Safari no expone hápticos — ahí queda el feedback visual).
function catalogHaptic(){
  try{
    const H = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics;
    if(H){ H.impact({style:'LIGHT'}).catch(()=>{}); return; }
    if(navigator.vibrate) navigator.vibrate(10);
  }catch(e){}
}
// Progreso/cancelar de las funciones PRO: la barra avanza contra el tiempo
// esperado del modelo (sin re-render — se mueve el ancho del div directo).
let catalogAiTimer=null;
function catalogAiBegin(kind, expectSec){
  catalogAiJob={kind, startedAt:Date.now(), expectSec, cancelled:false};
  clearInterval(catalogAiTimer);
  catalogAiTimer=setInterval(()=>{
    const bar=document.getElementById('catalog-ai-bar');
    if(!bar || !catalogAiJob) return;
    const pct=Math.min(95, ((Date.now()-catalogAiJob.startedAt)/1000)/catalogAiJob.expectSec*100);
    bar.style.width=pct.toFixed(0)+'%';
  }, 800);
}
function catalogAiCancelled(){ return !!(catalogAiJob && catalogAiJob.cancelled); }
function catalogAiEnd(){ catalogAiJob=null; clearInterval(catalogAiTimer); catalogAiTimer=null; }
// Compartir el LINK del catálogo: título + texto + url (antes iba la url pelada
// y en Mensajes/WhatsApp llegaba un link sin explicación). Sin hoja nativa:
// copia el link y abre WhatsApp con el mensaje armado.
async function shareCatalogLink(url){
  const text = businessName ? t('catalog_share_text').replace('{biz}', businessName) : t('catalog_share_text_nobiz');
  if(navigator.share){
    try{ await navigator.share({title: businessName || 'Dusty', text, url}); return; }
    catch(e){ if(e && e.name==='AbortError') return; }
  }
  try{ await navigator.clipboard.writeText(url); showToast(t('catalog_copied_toast')); }catch(e){}
  try{ window.open('https://wa.me/?text='+encodeURIComponent(text+' '+url), '_blank', 'noopener'); }catch(e){}
}
// Compartir la FOTO de un producto como archivo (el caso número uno del que
// vende por WhatsApp). Orden: la alta por la URL de descarga de Firebase (la
// pública de storage.googleapis.com no manda CORS), si no la miniatura local.
// En iOS Safari, files + url comparte la URL de la página — por eso el link
// va DENTRO del texto y nunca como url.
async function shareCatalogPhoto(s){
  const obj=catalogViewerObj(s); if(!obj) return;
  const url=catalogUrl();
  const text = obj.name + (obj.salePrice>0 ? ' · '+money(obj.salePrice) : '') + (businessName ? ' · '+businessName : '') + (url ? '\n'+url : '');
  let blob=null;
  try{
    if(obj.photoHiUrl && currentUser && !currentUser.isAnonymous && window.firebase && firebase.storage){
      const uid=syncUid();
      const path='catalogHires/'+uid+'/'+(s.kind==='recipe'?'r-':'i-')+obj.id+'.jpg';
      const dl=await firebase.storage().ref(path).getDownloadURL();
      const r=await fetch(dl); if(r.ok) blob=await r.blob();
    }
  }catch(e){}
  if(!blob && obj.photo && obj.photo.base64){
    try{ const r=await fetch(cachedPhotoUrl(obj.photo.base64, obj.photo.mediaType)); blob=await r.blob(); }catch(e){}
  }
  if(!blob && obj.photo && obj.photo.url){
    try{ const r=await fetch(obj.photo.url); if(r.ok) blob=await r.blob(); }catch(e){}
  }
  if(!blob){ showToast(t('catalog_share_no_photo'), 'info'); return; }
  const safe=(obj.name||'foto').replace(/[^\w\- ]+/g,'').trim().slice(0,40) || 'foto';
  const file=new File([blob], safe+'.jpg', {type: blob.type || 'image/jpeg'});
  if(navigator.canShare && navigator.canShare({files:[file]})){
    try{ await navigator.share({files:[file], title: obj.name, text}); return; }
    catch(e){ if(e && e.name==='AbortError') return; }
  }
  if(navigator.share){
    try{ await navigator.share({title: obj.name, text, url: url||undefined}); return; }
    catch(e){ if(e && e.name==='AbortError') return; }
  }
  // Escritorio sin hoja de compartir: texto al portapapeles y WhatsApp web.
  try{ await navigator.clipboard.writeText(text); showToast(t('catalog_share_photo_ready')); }catch(e){}
  try{ window.open('https://wa.me/?text='+encodeURIComponent(text), '_blank', 'noopener'); }catch(e){}
}

document.addEventListener('keydown', (e)=>{
  // Visor de foto del Catálogo: flechas = anterior/siguiente (escritorio).
  if(catalogViewPhoto && (e.key==='ArrowLeft' || e.key==='ArrowRight')){
    const list=catalogViewerList();
    const idx=list.findIndex(x=>x.kind===catalogViewPhoto.kind && x.id===catalogViewPhoto.id);
    const next=list[idx + (e.key==='ArrowRight' ? 1 : -1)];
    if(next){ catalogViewPhoto=next; render(); }
    e.preventDefault();
    return;
  }
  if(e.key !== 'Escape') return;
  // Modales del Catálogo (auditoría 2026-09-07: ninguno cerraba con Escape).
  // De adentro hacia afuera: el editor está encima del modal de asignar.
  if(catalogViewPhoto){ const btn=document.getElementById('cv-close'); if(btn) btn.click(); else { catalogViewPhoto=null; render(); } return; }
  if(catalogEditorOpen){ const btn=document.getElementById('btn-cancel-edit'); if(btn) btn.click(); return; }
  if(catalogPendingPhoto){ const btn=document.getElementById('btn-cancel-assign-photo'); if(btn) btn.click(); return; }
  if(showCatalogCameraModal){ showCatalogCameraModal=false; render(); return; }
  if(showCollageLayoutModal){ const btn=document.getElementById('btn-cancel-collage'); if(btn) btn.click(); return; }
  if(showTemplateModal){ const btn=document.getElementById('btn-close-template'); if(btn) btn.click(); else { showTemplateModal=false; render(); } return; }
  if(showCatalogPublishModal){ closeCatalogPublishModal(); return; }
  if(showItemModal){ closeItemModal(); return; }
  if(showScanModal){ closeScanModal(); return; }
  if(showPriceHistoryModal){ closePriceHistoryModal(); return; }
  if(showMonthlySpendModal){ closeMonthlySpendModal(); return; }
  if(showCycleCountModal){ closeCycleCountModal(); return; }
  if(showBudgetModal){ closeBudgetModal(); return; }
  if(showAccountModal){ closeAccountModal(); return; }
  if(showAlertSettingsModal){ showAlertSettingsModal=false; render(); return; }
  if(showDeleteAccountModal){ if(!deleteAccountLoading) closeDeleteAccountModal(); return; }
  if(showSuggestedOrderModal){ showSuggestedOrderModal=false; render(); return; }
  if(showReceiptDetail){ showReceiptDetail=null; render(); return; }
  if(showDayModal){ showDayModal=null; dayNoteDraft=''; render(); return; }
  // Estos faltaban: sin Escape, el modal de equipo además dejaba vivo su setInterval de
  // refresco (teamModalRefreshTimer) porque solo closeTeamModal() lo limpia. El de barras
  // apaga la cámara al cerrarse. El de idioma (langChoice) es la primera elección
  // obligatoria de un usuario nuevo, así que a propósito NO se cierra con Escape.
  if(showTeamModal){ closeTeamModal(); return; }
  if(showAuthModal){ closeAuthModal(); return; }
  if(showActivityModal){ closeActivityModal(); return; }
  if(showCategoriesModal){ closeCategoriesModal(); return; }
  if(showFeedbackModal){ closeFeedbackModal(); return; }
  if(showBarcodeScanModal){ closeBarcodeScanModal(); return; }
  // El escáner de productos APAGA su cámara al cerrarse — si se cerrara por
  // cualquier otro camino sin apagar, scannerCamStream quedaría vivo y el guard
  // de render() dejaría la app entera sin redibujar nunca más.
  if(showProductBatchModal){ closeProductBatchModal(); return; }
  // Producción (app-08) — el escáner de estante apaga su cámara igual que el de productos.
  if(showShelfModal){ closeShelfModal(); return; }
  if(showProduceModal){ closeProduceModal(); return; }
  if(showRecipeModal){ closeRecipeModal(); return; }
  if(showOutflowsModal){ showOutflowsModal=false; render(); return; }
  if(showProductionHub){ showProductionHub=false; render(); return; }
  if(showWelcomeModal){ closeWelcomeModal(); return; }
});

// Si había una subida pendiente por fallo de red, no hace falta esperar a que venza
// el backoff de onCloudSyncWriteFailed() — apenas el navegador avisa que volvió la
// conexión, se reintenta ahí mismo.
window.addEventListener('online', ()=>{
  if(cloudSyncDirty){ clearTimeout(cloudSyncRetryTimer); syncAllToFirestore(); }
});

/* Reporte de errores en producción: sin esto, si algo se rompe para un usuario real,
   el único rastro queda en SU consola del navegador — nadie más se entera salvo que
   avise. Se manda a una colección aparte de Firestore, de solo escritura (mismo
   criterio que "feedback": nadie puede leer el reporte de otro desde el cliente, el
   dueño los revisa directo desde la consola de Firebase).
   Solo se manda si currentUser ya existe — eso implica que Firebase ya terminó de
   cargar e inicializarse (currentUser solo se setea adentro de onAuthStateChanged).
   A alguien usando la app 100% local, sin cuenta, no hay a dónde mandarle el reporte,
   y forzar la carga de Firebase solo para esto le haría pagar el costo que
   ensurePatronFirebaseReady() evita a propósito para ese caso — se queda con el
   console.error de siempre, como antes.
   El tope de reportes por sesión evita que un error en loop (ej. algo que falla en
   cada render()) genere una tormenta de escrituras a Firestore. */
let clientErrorReportCount = 0;
const MAX_CLIENT_ERROR_REPORTS = 15;
function reportClientError(err, source){
  if(!currentUser || clientErrorReportCount>=MAX_CLIENT_ERROR_REPORTS) return;
  clientErrorReportCount++;
  try{
    firebase.firestore().collection('errorLogs').add({
      message: String((err && (err.message||err)) || err).slice(0,500),
      stack: (err && err.stack) ? String(err.stack).slice(0,2000) : '',
      source,
      uid: currentUser.uid,
      joinedOwnerUid: joinedOwnerUid || null,
      activeTab, uiLang,
      userAgent: navigator.userAgent,
      createdAt: new Date().toISOString()
    }).catch(()=>{}); // si esto también falla, no hay nada más que hacer
  }catch(e){}
}
// El navegador ya loguea solo estos dos casos a consola — acá solo se agrega el envío
// a Firestore, sin duplicar el console.error.
window.addEventListener('error', (e)=>{ reportClientError(e.error || e.message, 'window.onerror'); });
window.addEventListener('unhandledrejection', (e)=>{ reportClientError(e.reason, 'unhandledrejection'); });

loadState();
// Migración de stockFullRef (un solo arranque por dispositivo la necesita de
// verdad): los productos de antes de la feature no tienen marca de "lleno", y
// con la estimación vieja (qty×1.5) la barra quedaba CLAVADA en ~67% — al usar
// stock el objetivo estimado bajaba junto con él y el % no se movía. El nivel
// actual pasa a ser el 100% de cada uno; desde acá, solo las salidas lo bajan.
// No se llama saveState() acá (todavía no corrió todo el boot): el sello y el
// guardado los hace el primer saveState real, y mientras tanto la barra ya
// rinde bien con la marca en memoria.
inventory.forEach(i=>{ if(!i.stockFullRef && (i.qtyOnHand||0) > 0) i.stockFullRef = i.qtyOnHand; });
// ETAPA A del PLAN-SYNC: poblar la línea base de sellado AHORA, con lo recién
// cargado — lo que vino de localStorage no es una edición nueva. Sin esta pasada,
// la primera pasada de stampLocalEdits() ocurría recién en el PRIMER saveState de
// la sesión (una edición real del usuario) y se la tragaba como "solo poblar":
// el primer producto creado/editado de cada sesión quedaba sin updatedAt.
stampLocalEdits();
if(categories===null) categories = defaultCategories();
// Antes el selector de idioma vivía arriba del todo DENTRO del modal de bienvenida,
// compartiendo pantalla con los 4 pasos del tutorial — alguien que no lee ni español
// ni inglés se encontraba con un párrafo entero en un idioma que no entiende antes de
// llegar a los botones que se lo iban a arreglar. Ahora es su propia pantalla, la
// primera que ve cualquiera que arranca de cero, sin nada más compitiendo por su
// atención — recién al elegir pasa al tutorial ya en su idioma (ver langChoiceModal()).
try{ if(!localStorage.getItem('patron_onboarded')) showLangChoiceModal = true; }catch(e){}
try{
  const savedCalSearch = localStorage.getItem('patron_cal_search');
  if(savedCalSearch) applyCalendarSearch(savedCalSearch);
}catch(e){}
// Si el link trae ?join=CODIGO (alguien compartió su código de invitación), se
// autocompleta para que la otra persona no tenga que transcribirlo a mano. Si este
// navegador ya tuvo sesión antes, se asume que va a usar el panel de equipo normal
// (ya logueado) en vez de crear una cuenta nueva con nombre+PIN.
try{
  const joinCodeFromUrl = new URLSearchParams(location.search).get('join');
  if(joinCodeFromUrl){
    history.replaceState(null, '', location.pathname);
    const code = joinCodeFromUrl.toUpperCase();
    if(localStorage.getItem('patron_had_session')){
      teamJoinCode = code;
    } else {
      authJoinCode = code; authMode = 'join'; showAuthModal = true;
    }
  }
}catch(e){}
render();
// Adentro de la app nativa (Capacitor/Android), el splash nativo se queda prendido
// a propósito (launchAutoHide:false en capacitor.config.json) hasta que se lo pide
// desde acá — si no, Android lo esconde apenas el WebView "existe", que puede ser
// bastante antes de que este script termine de cargar y pintar la pantalla real,
// dejando un hueco en blanco de por medio (un flash feo entre splash y contenido).
// Dos requestAnimationFrame en cadena (en vez de uno solo) esperan a que el navegador
// ya haya compuesto el frame con el HTML de arriba, no solo que lo haya encolado.
try{
  if(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.SplashScreen){
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      window.Capacitor.Plugins.SplashScreen.hide().catch(()=>{});
    }));
  }
}catch(e){}
// Si este navegador ya había iniciado sesión antes, se reconecta solo a la nube al
// abrir/refrescar la página — antes había que tocar el botón de nube de nuevo cada
// vez, lo cual además de molesto dejaba a la app sin conectar los listeners hasta
// ese click, aumentando la ventana en la que un dato local podía quedar sin subir.
try{
  if(localStorage.getItem('patron_had_session')){
    cloudSyncPending = true;
    ensurePatronFirebaseReady().catch(()=>{});
    // Resguardo: si por lo que sea (sin red, Firestore caído, un error que no se
    // esperaba) el primer snapshot nunca llega, no dejamos a alguien mirando la
    // pantalla de "cargando" para siempre -- después de un rato razonable se apaga
    // solo y se muestra lo que haya (los datos locales de este dispositivo siguen
    // siendo los mismos de antes, no se perdió nada por este timeout).
    setTimeout(()=>{ if(cloudSyncPending){ cloudSyncPending = false; render(); } }, 8000);
  }
}catch(e){}
// Avisos de presupuesto (auditoría 2026-09-07): se arman recién después del
// arranque (y de la posible bajada de la nube) para no gritar con datos a medio
// cargar; el primer chequeo cubre el caso de abrir la app ya pasado el umbral.
setTimeout(()=>{ budgetAlertsArmed = true; checkBudgetAlerts(); }, 2500);
