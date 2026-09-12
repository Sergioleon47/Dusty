/* ===== HANDLERS DE LOS ESCÁNERES =====
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
function attachScannerEvents(){
  /* ---------- escáner de productos en lote ---------- */
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
    // El botón "Agregar N al inventario" se actualiza SIN re-render al escribir el
    // nombre de una fila a mano: antes seguía en "Agregar 0" (deshabilitado) hasta
    // tocar el checkbox, y el usuario creía que no andaba (auditoría UX 2026-09-11).
    const refreshPbApplyBtn=()=>{
      const btn=document.getElementById('btn-apply-pb'); if(!btn) return;
      const n=pbItems.filter(it=>it && it.selected && String(it.name||'').trim()).length;
      btn.disabled=n===0; btn.textContent=t('pb_add_btn').replace('{n}', n);
    };
    document.querySelectorAll('[data-pb-name]').forEach(inp=>{
      inp.oninput=()=>{ const it=pbItems[+inp.getAttribute('data-pb-name')]; if(it) it.name=inp.value; refreshPbApplyBtn(); };
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

  /* ---------- código de barras ---------- */
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

  /* ---------- escáner de recibos ---------- */
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
    // Se bloquea al primer toque (auditoría 2026-09-09): aplica N productos, crea
    // el recibo y dispara la subida de fotos; un doble toque nervioso lo hacía
    // dos veces. El render siguiente lo repinta habilitado si hiciera falta.
    if(applyBtn) applyBtn.onclick=()=>{
      if(applyBtn.disabled) return;
      applyBtn.disabled = true;
      applyScanResults();
    };
  }

  // Producción y salidas (recetas, producir, escáner de estante, historial) — app-08.
}
