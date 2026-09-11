/* ===== HANDLERS DE INVENTARIO Y LA FICHA DEL PRODUCTO =====
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
function attachInventoryEvents(){
  // Desglose de Valor / Potencial de venta (pedido del usuario 2026-09-11):
  // las dos tarjetas de arriba abren su modal; ✕, Cerrar y el fondo lo cierran.
  const btnInvValue=document.getElementById('btn-inv-value');
  if(btnInvValue) btnInvValue.onclick=()=>{ showInvDetail='value'; render(); };
  const btnInvPotential=document.getElementById('btn-inv-potential');
  if(btnInvPotential) btnInvPotential.onclick=()=>{ showInvDetail='potential'; render(); };
  const invDetailOv=document.getElementById('inv-detail-overlay');
  if(invDetailOv){
    const closeIvd=()=>{ showInvDetail=null; render(); };
    invDetailOv.onmousedown=(e)=>{ if(e.target===invDetailOv) closeIvd(); };
    const x=document.getElementById('btn-close-inv-detail'); if(x) x.onclick=closeIvd;
    const f=document.getElementById('btn-close-inv-detail-footer'); if(f) f.onclick=closeIvd;
  }
  /* ---------- inventario vacío ---------- */
  const btnInvEmptyScan=document.getElementById('btn-inv-empty-scan');
  if(btnInvEmptyScan) btnInvEmptyScan.onclick=openScanModal;
  const btnInvEmptyManual=document.getElementById('btn-inv-empty-manual');
  if(btnInvEmptyManual) btnInvEmptyManual.onclick=()=>openItemModal(null);
  /* ---------- más detalles de la ficha ---------- */
  const btnItemMore=document.getElementById('btn-item-more');
  if(btnItemMore) btnItemMore.onclick=expandItemModal;
  /* ---------- nuevo producto ---------- */
  const btnNewItem=document.getElementById('btn-new-item'); if(btnNewItem) btnNewItem.onclick=()=>openItemModal(null);
  /* ---------- alertas críticas ---------- */
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
  /* ---------- pedido sugerido ---------- */
  const btnSuggestedOrder=document.getElementById('btn-suggested-order');
  if(btnSuggestedOrder) btnSuggestedOrder.onclick=()=>{ showSuggestedOrderModal=true; render(); };
  const btnShareSuggested=document.getElementById('btn-share-suggested-order');
  if(btnShareSuggested) btnShareSuggested.onclick=shareSuggestedOrder;
  const suggestedOrderOverlay=document.getElementById('suggested-order-overlay');
  if(suggestedOrderOverlay){
    suggestedOrderOverlay.onmousedown=(e)=>{ if(e.target===suggestedOrderOverlay){ showSuggestedOrderModal=false; render(); } };
    const closeSuggestedBtn=document.getElementById('btn-close-suggested-order');
    if(closeSuggestedBtn) closeSuggestedBtn.onclick=()=>{ showSuggestedOrderModal=false; render(); };
  }

  /* ---------- actividad ---------- */
  const btnInventoryActivity=document.getElementById('btn-inventory-activity');
  if(btnInventoryActivity) btnInventoryActivity.onclick=openActivityModal;
  const activityOverlay=document.getElementById('activity-overlay');
  if(activityOverlay){
    activityOverlay.onmousedown=(e)=>{ if(e.target===activityOverlay) closeActivityModal(); };
    const closeActivityBtn=document.getElementById('btn-close-activity');
    if(closeActivityBtn) closeActivityBtn.onclick=closeActivityModal;
  }

  /* ---------- conteo cíclico ---------- */
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

  /* ---------- historial de precios ---------- */
  document.querySelectorAll('[data-history-item]').forEach(b=>{ b.onclick=()=>openPriceHistoryModal(b.dataset.historyItem); });
  const priceHistoryOverlay=document.getElementById('price-history-overlay');
  if(priceHistoryOverlay){
    priceHistoryOverlay.onmousedown=(e)=>{ if(e.target===priceHistoryOverlay) closePriceHistoryModal(); };
    const closeHistoryBtn=document.getElementById('btn-close-price-history');
    if(closeHistoryBtn) closeHistoryBtn.onclick=closePriceHistoryModal;
  }

  /* ---------- la lista del inventario y el visor de foto ---------- */
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
      applyInvLayoutLight();
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
  /* MODO SELECCIÓN DEL INVENTARIO (borrado en lote, pedido del usuario
     2026-09-09). Al salir del modo se limpia la selección: dejarla viva
     invisible es la receta para borrar algo que ya no recordás haber marcado. */
  /* Dos botones distintos porque nunca conviven: el de entrar vive en la barra
     del buscador y el de salir en la barra de seleccion, y esas dos barras se
     reemplazan una a la otra. Ids distintos a proposito — dos nodos con el mismo
     id es justo el bug que dejo sin handler a una de las dos herramientas de
     Reduccion cuando paso a vivir en dos pantallas. */
  const alternarSeleccion=()=>{
    if(invSelectMode) invExitSelect();
    else { invSelectMode=true; invSelected.clear(); showToast(t('inv_select_hint'), 'info'); }
    render();
  };
  const btnInvSelect=document.getElementById('btn-inv-select');
  if(btnInvSelect) btnInvSelect.onclick=alternarSeleccion;
  const btnInvSelExit=document.getElementById('btn-inv-sel-exit');
  if(btnInvSelExit) btnInvSelExit.onclick=alternarSeleccion;
  document.querySelectorAll('[data-inv-select]').forEach(el=>{
    el.onclick=()=>{
      const id=el.dataset.invSelect;
      if(invSelected.has(id)) invSelected.delete(id); else invSelected.add(id);
      render();
    };
  });
  const btnSelAll=document.getElementById('btn-inv-sel-all');
  if(btnSelAll) btnSelAll.onclick=()=>{
    // "Todos" = todo lo que la lista muestra AHORA (con su filtro y su búsqueda),
    // no el inventario entero: seleccionar 400 productos invisibles de un toque es
    // justo lo que nadie quiere que pase.
    document.querySelectorAll('[data-inv-select]').forEach(el=>invSelected.add(el.dataset.invSelect));
    render();
  };
  const btnSelShare=document.getElementById('btn-inv-sel-share');
  if(btnSelShare) btnSelShare.onclick=()=>shareSelectedItemPhotos();
  const btnSelToProd=document.getElementById('btn-inv-sel-toprod');
  if(btnSelToProd) btnSelToProd.onclick=moveSelectedToProduction;
  const btnSelOrder=document.getElementById('btn-inv-sel-order');
  if(btnSelOrder) btnSelOrder.onclick=shareSelectedOrder;
  const btnSelDelete=document.getElementById('btn-inv-sel-delete');
  if(btnSelDelete) btnSelDelete.onclick=()=>{
    const n = deleteSelectedInventory([...invSelected]);
    if(n>0){
      invExitSelect();
      showToast(t('inv_deleted_n').replace('{n}', n), 'info', {
        label: t('btn_undo'),
        onClick: ()=>{ const back = undoBulkDelete(); if(back) showToast(t('inv_restored_n').replace('{n}', back), 'success'); }
      });
    }
    render();
  };
  // Salida del callejón de "sin resultados" (auditoría 2026-09-09).
  const btnClearFilters=document.getElementById('btn-inv-clear-filters');
  if(btnClearFilters) btnClearFilters.onclick=()=>{
    invSearch=''; invQuickFilter=null; inventoryCategoryFilter=null;
    render();
    const inp=document.getElementById('inv-search'); if(inp) inp.value='';
  };
  document.querySelectorAll('[data-inv-quick]').forEach(b=>{
    b.onclick=()=>{ const k=b.dataset.invQuick; invQuickFilter = (invQuickFilter===k) ? null : k; render(); };
  });
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
      if(itemPhotoSrc(item)){ photoViewItemId = item.id; photoViewKind='item'; render(); }
      else promptItemPhotoUpload(item);
    };
  });
  const pvOverlay=document.getElementById('photo-viewer-overlay');
  if(pvOverlay){
    // El visor es el mismo para un ítem del inventario y para una pieza del
    // catálogo: los dos guardan la foto en .photo, así que cambiar y quitar
    // corren igual; lo único propio de la pieza es subirla a Storage.
    const target=()=>{ const tg=photoViewTarget(); return tg ? tg.obj : null; };
    const closeViewer=()=>{ photoViewItemId=null; render(); };
    pvOverlay.onmousedown=(e)=>{ if(e.target===pvOverlay) closeViewer(); };
    document.getElementById('pv-close').onclick=closeViewer;
    document.getElementById('pv-change').onclick=()=>{
      const obj=target();
      if(obj) promptItemPhotoUpload(obj, photoViewKind==='recipe'); // el visor queda abierto y muestra la nueva
    };
    document.getElementById('pv-delete').onclick=()=>{
      const obj=target();
      if(!obj) return;
      if(!confirm(t('pv_delete_confirm'))) return;
      if(photoViewKind==='recipe') dropRecipePhoto(obj);
      obj.photo=null;
      if(currentUser){ obj.lastEditedBy=currentUserLabel(); obj.lastEditedAt=new Date().toISOString(); }
      photoViewItemId=null;
      saveState(); render();
    };
  }

  /* ---------- la ficha del producto ---------- */
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
        draftItem.photo = resizeToBase64(img, ITEM_PHOTO_SIDE, ITEM_PHOTO_QUALITY);
        render();
      }catch(err){
        showToast(err.message || t('err_img_process'), 'error');
      }
    };
    const btnRemoveItemPhoto=document.getElementById('btn-remove-item-photo');
    if(btnRemoveItemPhoto) btnRemoveItemPhoto.onclick=()=>{ draftItem.photo=null; render(); };
    const btnScanProduct=document.getElementById('btn-scan-product');
    const itemScanPhotoFile=document.getElementById('item-scan-photo-file');
    const itemScanGallery=document.getElementById('item-scan-photo-file-gallery');
    const btnScanProductGallery=document.getElementById('btn-scan-product-gallery');
    // La cuenta se pide UNA vez, antes de abrir cualquiera de las dos entradas —
    // la lectura es la misma venga de la cámara o de la galería.
    // Trial anónimo: la cuenta se crea en segundo plano mientras el usuario elige
    // la foto; identifyProductFromPhoto() la espera antes de llamar a la API.
    // Cuenta real desconectada → login de siempre (ver everHadRealAccount).
    const pedirFotoProducto=(entrada)=>{
      if(!currentUser){
        if(everHadRealAccount()){ ensurePatronFirebaseReady().catch(()=>{}); openAuthModal(t('scan_requires_account')); return; }
        ensureTrialAccount().catch(()=>{});
      }
      entrada.click();
    };
    if(btnScanProduct && itemScanPhotoFile) btnScanProduct.onclick=()=>pedirFotoProducto(itemScanPhotoFile);
    if(btnScanProductGallery && itemScanGallery) btnScanProductGallery.onclick=()=>pedirFotoProducto(itemScanGallery);
    const onItemScanPhoto=async (e)=>{
      const file=e.target.files[0];
      e.target.value='';
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
    if(itemScanPhotoFile) itemScanPhotoFile.onchange=onItemScanPhoto;
    if(itemScanGallery) itemScanGallery.onchange=onItemScanPhoto;
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
    /* La casilla vacía late (ver .field-needs-value en dusty.css) y tiene que
       dejar de latir EN CUANTO se escribe algo, no al guardar: si siguiera
       latiendo mientras el usuario tipea, el aviso pasaría de recordatorio a
       molestia. Se toca solo la clase de ese input —igual que el numerito de la
       ganancia acá arriba— y no se re-renderiza la ficha: un render por tecla es
       justo lo que hacía temblar esta ventana. */
    function refreshNeedsValue(el){
      if(!el) return;
      el.classList.toggle('field-needs-value', fieldNeedsValue(el.value));
    }
    const fiCostInp=document.getElementById('fi-cost');
    const fiSalePriceInp=document.getElementById('fi-sale-price');
    // El precio de venta no existe en el alta rápida ni en la ficha de gasto, y
    // handleProfitFieldInput se va sin hacer nada cuando falta — por eso el
    // latido se refresca aparte y no colgado de esa función.
    if(fiCostInp) fiCostInp.oninput=()=>{ refreshNeedsValue(fiCostInp); handleProfitFieldInput(); };
    if(fiSalePriceInp) fiSalePriceInp.oninput=()=>{ refreshNeedsValue(fiSalePriceInp); handleProfitFieldInput(); };
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

}
