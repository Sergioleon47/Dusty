/* ===== HANDLERS DE AJUSTES =====
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
function attachSettingsEvents(){
  /* ---------- idioma, interruptores, temas, opinión ---------- */
  const btnLangToggle=document.getElementById('btn-lang-toggle');
  if(btnLangToggle) btnLangToggle.onclick=()=>setLang(uiLang==='es'?'en':'es');
  // Latidos de aviso (Ajustes): interruptor, se aplica al instante y queda en el
  // dispositivo — misma mecánica que el tema.
  /* ¿Este negocio fabrica? Prende o apaga la pestaña Producción. Se guarda como
     'on'/'off' explícito: una vez que el usuario opina, deja de decidirlo la
     cantidad de recetas — si no, borrar la última receta le sacaría la pestaña
     que acaba de pedir. */
  const productionTabToggle=document.getElementById('production-tab-toggle');
  if(productionTabToggle) productionTabToggle.onchange=()=>{
    productionTabPref = productionTabToggle.checked ? 'on' : 'off';
    try{ localStorage.setItem('patron_production_tab', productionTabPref); }catch(e){}
    render();
  };
  const pulseToggle=document.getElementById('pulse-toggle');
  if(pulseToggle) pulseToggle.onchange=()=>{
    dustyPulse = !!pulseToggle.checked;
    applyPulsePref();
    try{ localStorage.setItem('patron_pulse', dustyPulse ? 'on' : 'off'); }catch(e){}
    render();
  };
  // Tema de colores (Ajustes): al instante y sin Guardar — ver setDustyTheme (app-05).
  document.querySelectorAll('[data-set-theme]').forEach(b=>{
    b.onclick=()=>{
      if(setDustyTheme(b.dataset.setTheme)) render(); // re-pinta el selector con el circulito activo nuevo
    };
  });
  // El "?" abre la hoja de AYUDA; el reporte de problemas está al pie de esa hoja.
  // Ayuda vive en Ajustes (Dashboard reorganizado 2026-09-07): se cierra Ajustes,
  // se abre la hoja, y al cerrarla se vuelve a Ajustes (settingsReturnPending).
  const btnFeedback=document.getElementById('btn-feedback');
  if(btnFeedback) btnFeedback.onclick=()=>{ if(showAlertSettingsModal){ settingsReturnPending=true; showAlertSettingsModal=false; } openHelpModal(); };
  // "Hoy" del Dashboard: cada número abre el Inventario ya filtrado (filtros
  // rápidos); Salud del stock lo abre entero.
  /* ---------- ayuda y presentación del equipo ---------- */
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
  /* ---------- formato de moneda ---------- */
  const moneyFmtSel=document.getElementById('money-format-select');
  if(moneyFmtSel) moneyFmtSel.onchange=()=>{ setMoneyFormatPref(moneyFmtSel.value); render(); };

  /* (La introducción — idioma, bienvenida, tema — cablea sus propios botones al
     construirse: ver startOnboarding en app-06. No pasa por acá.) */

  /* ---------- gestionar categorías ---------- */
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
  /* ---------- exportar, importar, alertas ---------- */
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
  /* ---------- ajustes de alertas ---------- */
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
    // Cuenta: hijo de Ajustes — al cerrarse vuelve acá
    // (settingsReturnPending), como Categorías y el Conteo.
    const btnOpenAccount=document.getElementById('btn-open-account');
    if(btnOpenAccount) btnOpenAccount.onclick=()=>{ settingsReturnPending=true; showAlertSettingsModal=false; showAccountModal=true; render(); };
  }

}
