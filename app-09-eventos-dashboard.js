/* ===== HANDLERS DE DASHBOARD, CALENDARIO Y RECIBOS =====
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
function attachDashboardEvents(){
  /* ---------- tarjeta del calendario y hoja de recibos ---------- */
  const calTile=document.getElementById('dash-calendar-tile');
  if(calTile) calTile.onclick=openReceiptsSheet;
  const btnCloseReceipts=document.getElementById('btn-close-receipts-sheet');
  if(btnCloseReceipts) btnCloseReceipts.onclick=closeReceiptsSheet;
  const receiptsOverlay=document.getElementById('receipts-sheet-overlay');
  // Tocar el fondo cierra, igual que el resto de las hojas de la app.
  if(receiptsOverlay) receiptsOverlay.onmousedown=(e)=>{ if(e.target===receiptsOverlay) closeReceiptsSheet(); };
  /* ---------- las tarjetas de números ---------- */
  document.querySelectorAll('[data-dash-stat]').forEach(b=>{
    b.onclick=()=>{
      const k=b.dataset.dashStat;
      invQuickFilter = (k==='crit'||k==='count') ? k : null;
      invSearch='';
      /* El render va SIEMPRE, no solo cuando ya estabas en Inventario. Al cambiar
         de pestaña, switchToTab se asienta con commitTabSwitchLight, que ajusta el
         transform, las clases y la barra de abajo pero NO redibuja el contenido —
         su comentario lo dice: "las tres paginas ya estaban al dia". Eso es cierto
         al deslizar, y falso justo aca, porque la linea de arriba acaba de cambiar
         invQuickFilter. Resultado medido: tocar esta baldosa dejaba el filtro
         puesto en memoria pero llegabas a Inventario con la lista COMPLETA y el
         chip apagado — la baldosa no filtraba nada. Las tres paginas viven en el
         DOM, asi que un render antes del cambio deja Inventario al dia y el
         asentado liviano vuelve a ser correcto. */
      render();
      if(activeTab!=='inventario') switchToTab('inventario');
    };
  });
  /* ---------- escanear, aviso de presupuesto ---------- */
  const fsScan=document.getElementById('fs-scan');
  if(fsScan){ fsScan.onclick=openScanModal; fsScan.onkeydown=(e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); openScanModal(); } }; }
  const btnBudgetAlert=document.getElementById('btn-budget-alert');
  if(btnBudgetAlert){ btnBudgetAlert.onclick=openBudgetModal; btnBudgetAlert.onkeydown=(e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); openBudgetModal(); } }; }
  const fsBudget=document.getElementById('fs-budget');
  if(fsBudget){ fsBudget.onclick=openBudgetModal; fsBudget.onkeydown=(e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); openBudgetModal(); } }; }
  // Botones de los estados vacíos de Inventario y Recibos.
  /* ---------- recibos vacío ---------- */
  const btnRecEmptyScan=document.getElementById('btn-rec-empty-scan');
  if(btnRecEmptyScan) btnRecEmptyScan.onclick=openScanModal;
  // Alta rápida → ficha completa.
  /* ---------- gasto del mes ---------- */
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
  /* ---------- presupuesto ---------- */
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

  /* ---------- cierre de mes ---------- */
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
  /* ---------- gasto a mano ---------- */
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
  /* ---------- escanear y dashboard vacío ---------- */
  const btnScanFab=document.getElementById('btn-scan-fab');
  if(btnScanFab) btnScanFab.onclick=openScanModal;
  const btnDashEmptyScan=document.getElementById('btn-dash-empty-scan');
  if(btnDashEmptyScan) btnDashEmptyScan.onclick=openScanModal;
  const btnScanProducts=document.getElementById('btn-scan-products');
  if(btnScanProducts) btnScanProducts.onclick=openProductBatchModal;

  /* ---------- recibos del calendario y su detalle ---------- */
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

  /* ---------- navegación del calendario y búsqueda ---------- */
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

}
