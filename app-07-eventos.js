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
let modalTabTrapAttached = false;
// "Edit budget" (Dashboard) abre el modal de ajustes pidiendo foco directo en el
// campo de presupuesto — se consume en el attach del overlay, un solo render.
let pendingBudgetFocus = false;
// Selector de archivo + resize para la foto de un producto — lo usan el toque en
// la miniatura sin foto (lista) y el botón "cambiar" del visor de foto.
function promptItemPhotoUpload(item){
  const input = document.createElement('input');
  input.type='file';
  input.accept='image/*';
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
      item.photo = resizeToBase64(img, 300, 0.75);
      saveState(); render();
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
  document.querySelectorAll('#btn-scan-fab, [data-view-receipt], [data-cal-day], [data-photo-item], [data-open-item], [data-history-item], #btn-critical-alerts').forEach(makeKeyboardClickable);
  attachViewSwipeHandlers();
  attachCategoryChipDragHandlers();
  const btnLangToggle=document.getElementById('btn-lang-toggle');
  if(btnLangToggle) btnLangToggle.onclick=()=>setLang(uiLang==='es'?'en':'es');
  const btnFeedback=document.getElementById('btn-feedback');
  if(btnFeedback) btnFeedback.onclick=()=>openFeedbackModal();
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
  const btnCloudSync=document.getElementById('btn-cloud-sync');
  if(btnCloudSync) btnCloudSync.onclick=()=>{ openTeamModal(); };
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
    document.getElementById('btn-sign-out-team').onclick=()=>{ closeTeamModal(); firebase.auth().signOut(); };
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
  }

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
  const btnManageCategories=document.getElementById('btn-manage-categories');
  if(btnManageCategories) btnManageCategories.onclick=openCategoriesModal;
  document.querySelectorAll('[data-open-category]').forEach(btn=>{
    btn.onclick=()=>{
      inventoryCategoryFilter = btn.dataset.openCategory;
      switchToTab('inventario');
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
  const btnEditBudget=document.getElementById('btn-edit-budget');
  // "Edit budget" abre el MISMO modal de ajustes, pero el campo de presupuesto es
  // la tercera tarjeta — en un teléfono queda abajo del pliegue y parecía que el
  // botón llevaba a un menú equivocado. El flag hace que al abrir por acá el modal
  // aparezca ya scrolleado al presupuesto y con el teclado listo en ese campo.
  if(btnEditBudget) btnEditBudget.onclick=()=>{ pendingBudgetFocus=true; openAlertSettings(); };

  const alertSettingsOverlay=document.getElementById('alert-settings-overlay');
  if(alertSettingsOverlay){
    if(pendingBudgetFocus){
      pendingBudgetFocus=false;
      // Solo scroll, SIN focus(): enfocar abriría el teclado del teléfono solo —
      // dónde escribir lo decide el usuario tocando el campo (pedido explícito).
      const bi=document.getElementById('budget-input');
      if(bi) bi.scrollIntoView({block:'center'});
    }
    alertSettingsOverlay.onmousedown=(e)=>{ if(e.target===alertSettingsOverlay){ showAlertSettingsModal=false; render(); } };
    const closeAlertSettingsBtn=document.getElementById('btn-close-alert-settings');
    if(closeAlertSettingsBtn) closeAlertSettingsBtn.onclick=()=>{ showAlertSettingsModal=false; render(); };
    const cancelAlertBtn=document.getElementById('btn-cancel-alert-settings');
    if(cancelAlertBtn) cancelAlertBtn.onclick=()=>{ showAlertSettingsModal=false; render(); };
    const saveAlertBtn=document.getElementById('btn-save-alert-settings');
    if(saveAlertBtn) saveAlertBtn.onclick=()=>{
      const val=parseFloat(document.getElementById('alert-threshold-input').value);
      if(val>0) priceAlertThreshold=val;
      const nameVal=document.getElementById('business-name-input').value;
      businessName = nameVal.trim();
      const budgetRaw=document.getElementById('budget-input').value.trim();
      monthlyBudget = budgetRaw==='' ? null : Math.max(0, parseFloat(budgetRaw)||0);
      saveState();
      showAlertSettingsModal=false; render();
    };
    const btnOpenDeleteAccount=document.getElementById('btn-open-delete-account');
    if(btnOpenDeleteAccount) btnOpenDeleteAccount.onclick=()=>{ showAlertSettingsModal=false; openDeleteAccountModal(); };
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
    // Las filas del Dashboard ahora son .inv-tile (mismo rediseño que Inventario)
    // — el selector matchea por data-status, presente solo en esas tarjetas.
    const critRows = document.querySelectorAll('[data-status="crit"]');
    if(critRows.length===0) return;
    critRows[0].scrollIntoView({behavior:'smooth', block:'center'});
    critRows.forEach(r=>r.classList.add('crit-flash'));
    setTimeout(()=>critRows.forEach(r=>r.classList.remove('crit-flash')), 2400);
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
  if(btnCycleCount) btnCycleCount.onclick=openCycleCountModal;
  const ccBanner=document.getElementById('cc-banner');
  if(ccBanner) ccBanner.onclick=openCycleCountModal;
  // Mismo canal animado que el selector de vista: al alternar "ver inventario
  // completo" / "solo lo que toca contar", las tarjetas que quedan vuelan a su
  // nueva posición y las que entran/salen se funden (View Transition, app-04).
  const btnShowFullInv=document.getElementById('btn-show-full-inventory');
  if(btnShowFullInv) btnShowFullInv.onclick=(e)=>{ e.stopPropagation(); showFullInventoryDespiteCycleCount=true; invLayoutTransitionPending=true; render(); };
  const btnShowPendingOnly=document.getElementById('btn-show-pending-only');
  if(btnShowPendingOnly) btnShowPendingOnly.onclick=(e)=>{ e.stopPropagation(); showFullInventoryDespiteCycleCount=false; invLayoutTransitionPending=true; render(); };
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
        cycleCountCursor=(cycleCountCursor+batch.length)%Math.max(inventory.length,1);
        // Conteo terminado -> vuelve a filtrar por defecto la próxima vez que toque
        // contar, aunque acá el usuario hubiera elegido ver el inventario completo.
        showFullInventoryDespiteCycleCount=false;
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
    const btnPbCapture=document.getElementById('btn-pb-capture');
    if(btnPbCapture) btnPbCapture.onclick=()=>{
      const frame=captureScannerFrame();
      if(frame) processProductBatchSource(frame);
      // Sin cuadro (la cámara nunca arrancó — permiso negado, sin cámara): el
      // respaldo es la cámara nativa del sistema.
      else pbFile?.click();
    };
    const btnPbNative=document.getElementById('btn-pb-native');
    if(btnPbNative && pbFile) btnPbNative.onclick=()=>pbFile.click();
    const btnPbGallery=document.getElementById('btn-pb-gallery');
    if(btnPbGallery && pbGalleryFile) btnPbGallery.onclick=()=>pbGalleryFile.click();
    const onPbFile=async (e)=>{
      const file=e.target.files[0];
      e.target.value='';
      if(!file || !/^image\//.test(file.type)) return;
      try{
        const img = await loadImageFromFile(file);
        processProductBatchSource(img);
      }catch(err){
        stopScannerCamera();
        pbState='error'; pbError=err.message||t('product_scan_error'); render();
      }
    };
    if(pbFile) pbFile.onchange=onPbFile;
    if(pbGalleryFile) pbGalleryFile.onchange=onPbFile;
    const btnPbAgain=document.getElementById('btn-pb-again');
    if(btnPbAgain) btnPbAgain.onclick=restartScannerCamera;
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
  // Buscador del Dashboard: filtra en vivo con cada tecla, patrón debounce+foco
  // de receipt-search (el render recrea el input a mitad de tipeo sin esto).
  const dashInvSearch=document.getElementById('dash-inv-search');
  if(dashInvSearch) dashInvSearch.oninput=(e)=>{
    const cursorPos=e.target.selectionStart;
    invSearch=e.target.value;
    scheduleSearchTriggeredRender(()=>{
      const fresh=document.getElementById('dash-inv-search');
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
        if(result.name) draftItem.name = result.name;
        if(result.unit) draftItem.unit = result.unit;
        if(typeof result.cost_per_unit==='number') draftItem.costPerUnit = result.cost_per_unit;
        if(result.sku) draftItem.sku = result.sku;
        if(result.category){
          const match = categories.find(c=>c.name===result.category);
          if(match) draftItem.categoryId = match.id;
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
    // Recalcula el % de ganancia en vivo mientras se escribe el costo o el precio de
    // venta. Antes esto llamaba a render() (reconstruía la ventana entera) para
    // actualizar el número — pero como el modal tiene una animación de entrada, cada
    // letra que se escribía volvía a disparar esa animación, y la ventana "temblaba"
    // con cada tecla. Ahora solo se actualiza el numerito de la ganancia directamente
    // en el DOM, sin tocar el resto de la ventana — ni tiembla, ni hace falta el truco
    // de devolver el foco/cursor de antes (el campo nunca se destruye).
    function handleProfitFieldInput(){
      const cost = document.getElementById('fi-cost').value;
      const sale = document.getElementById('fi-sale-price').value;
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
        unit:document.getElementById('fi-unit').value,
        costPerUnit:parseFloat(document.getElementById('fi-cost').value)||0,
        updated:draftItem.updated||false,
        qtyOnHand:parseFloat(document.getElementById('fi-stock').value)||0,
        photo:draftItem.photo||null,
        salePrice:parseFloat(document.getElementById('fi-sale-price').value)||0,
        sku:document.getElementById('fi-sku').value.trim(),
        supplier:document.getElementById('fi-supplier').value.trim(),
        // '__create__' es la opción "crear nueva" sin nombre confirmado — nunca
        // debe guardarse como si fuera un id de categoría real.
        categoryId:(v=>v==='__create__' ? null : (v||null))(document.getElementById('fi-category').value),
        // Capacidad del envase lleno (para el escáner de estante) — vacío o 0 se
        // guarda como null, nunca como un cero que el escáner tomaría por real.
        capacityFull:(()=>{ const v=parseFloat(document.getElementById('fi-capacity').value); return Number.isFinite(v) && v>0 ? v : null; })()
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
    // sugiere una categoría con su propio criterio, pero cuando no encuentra ninguna
    // que le calce bien (o directamente no hay categorías creadas todavía) esto
    // queda en blanco con un aviso, en vez de guardar el producto sin categoría en
    // silencio. El value queda vacío ("") a propósito para "sin categoría", nunca
    // "__new__" ni ningún otro sentinel — coincide con category_none_option de abajo.
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
    if(dateInp) dateInp.oninput=(e)=>scanDate=e.target.value;
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

document.addEventListener('keydown', (e)=>{
  if(e.key !== 'Escape') return;
  if(showItemModal){ closeItemModal(); return; }
  if(showScanModal){ closeScanModal(); return; }
  if(showPriceHistoryModal){ closePriceHistoryModal(); return; }
  if(showMonthlySpendModal){ closeMonthlySpendModal(); return; }
  if(showCycleCountModal){ closeCycleCountModal(); return; }
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
