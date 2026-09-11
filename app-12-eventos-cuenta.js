/* ===== HANDLERS DE CUENTA, EQUIPO Y SESIÓN =====
   Salieron de attachEvents() (app-07), que habia crecido a 1753 lineas en UNA
   funcion: para tocar un handler de esta pantalla habia que leerlas todas para
   estar seguro de no pisar el de otra. Ahora los handlers viven al lado de la
   pantalla que manejan, que es el patron que Dusty ya usaba para Produccion
   (attachProductionEvents) y para la calculadora de pedido (attachOrderCalcEvents).

   El codigo NO cambio: se movio tal cual, linea por linea. Se mantienen los dos
   patrones de siempre — handlers como propiedades on* (morphdom conserva nodos
   entre renders, asignar pisa en vez de apilar) y campos de texto que escriben
   en el estado sin re-render.

   Llamada desde attachEvents() en cada render. */
function attachAccountEvents(){
  /* ---------- opinión, nube, entrar ---------- */
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
    // Sin conexión y "no se pudo guardar" explican QUÉ pasó y qué se hace; el
    // fallo además reintenta ahí mismo en vez de esperar el backoff.
    if(isOffline){ showToast(t('cloud_sync_offline'), 'info'); return; }
    if(cloudSyncIsFailing()){
      showToast(t('cloud_sync_failed_retry'), 'error');
      clearTimeout(cloudSyncRetryTimer);
      cloudSyncRetryDelayMs = 2000;
      if(cloudSyncDirty) syncAllToFirestore();
      return;
    }
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

  /* ---------- equipo y sesión ---------- */
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

  /* ---------- compartir cuenta y categorías ---------- */
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
  /* ---------- cuenta ---------- */
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
  /* ---------- encuesta de salida ---------- */
  const exitOverlay=document.getElementById('exit-survey-overlay');
  if(exitOverlay){
    exitOverlay.onmousedown=(e)=>{ if(e.target===exitOverlay) closeExitSurvey(); };
    const closeBtn=document.getElementById('btn-close-exit-survey');
    if(closeBtn) closeBtn.onclick=closeExitSurvey;
    const acceptBtn=document.getElementById('btn-exit-accept');
    if(acceptBtn) acceptBtn.onclick=async ()=>{
      sendExitFeedback('retention_offer_accepted', null, '');
      closeExitSurvey();
      // El mes gratis se aplica DE VERDAD (claim-retention: +30 días al mes
      // gratis de esta cuenta, una sola vez) y se refresca el estado de acceso.
      try{
        const idToken = await currentUser.getIdToken();
        const res = await fetch(urlFuncion('/.netlify/functions/claim-retention'), { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+idToken}, body:'{}' });
        const parsed = await res.json().catch(()=>({}));
        if(res.ok && parsed && parsed.state) setAccessState(parsed.state);
      }catch(e){ console.warn('[Dusty] claim-retention:', e && e.message); }
      showToast(t('exit_thanks_offer'));
    };
    const nextBtn=document.getElementById('btn-exit-next');
    if(nextBtn) nextBtn.onclick=()=>{ exitStep++; render(); };
    const delBtn=document.getElementById('btn-exit-delete');
    // Sin closeExitSurvey(): eso consumiría el flag de "volver a Ajustes" a
    // mitad de la cadena — el flag debe sobrevivir hasta el cierre del modal
    // de borrado (cancelar ahí también devuelve a Ajustes).
    if(delBtn) delBtn.onclick=()=>{ showExitSurvey=false; openDeleteAccountModal(); };
  }

  /* ---------- borrar la cuenta ---------- */
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

}
