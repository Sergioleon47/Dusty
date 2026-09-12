/* ================= REPORTS: el informe del mes en PDF (2026-09-11) =================
   Pedido del usuario: "permitir que Dusty al final de cada mes pueda imprimir los
   recaps y expense report", botón "Reports". Un solo botón, dos salidas:
     - en el teléfono (app instalada o navegador móvil) abre la hoja de COMPARTIR
       del sistema con el PDF adjunto — WhatsApp al contador, Drive, correo;
     - en escritorio (o donde compartir archivos no exista) lo DESCARGA.
   "Imprimir" en la web es guardar ese PDF; en Android/iPhone window.print() no
   existe, por eso el PDF se genera acá, en el dispositivo, sin librerías (no hay
   CDN en una app que se vende como offline) y sin pasar por el servidor.

   Qué trae el informe de un mes (o de un año, desde el Cierre en modo año):
     1. Resumen: gastos, mercadería comprada, presupuesto y restante/excedido,
        recibos del período, y contra el período anterior. Si hubo salidas
        (ventas/merma), el P&L: ingresos, costo de lo vendido, bruta y neta.
     2. Gastos por categoría (expense report), con tope si lo tiene.
     3. Detalle de recibos y gastos: fecha, proveedor/descripción, tipo, total.
     4. Compras por producto (los 15 de más gasto).
   Los números salen de las MISMAS funciones que el Cierre de mes y el modal de
   presupuesto (periodFinancials, expenseByCategoryForMonth, receiptSplit,
   effectiveBudgetForMonth): el PDF no puede contar una historia distinta a la
   pantalla.

   El escritor de PDF (DustyPdf) es mínimo a propósito: A4, Helvetica y
   Helvetica-Bold con WinAnsiEncoding (cubre acentos y ñ), texto, líneas y
   rectángulos, paginado automático con pie "página x de y". Nada de imágenes ni
   fuentes incrustadas — un informe de números no las necesita, y así el archivo
   pesa unos KB. */

/* ---------- escritor de PDF ---------- */
// Anchos de Helvetica (AFM estándar, ASCII 32..126, en milésimas de em): para
// alinear a la derecha y recortar textos largos. Bold se estima un 6% más
// ancho; los acentuados usan el ancho de la letra base (556 si no se sabe).
const PDF_HELV_W = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
// Caracteres fuera de Latin-1 que sí tiene WinAnsi (y que la app usa en textos).
const PDF_WINANSI = {'€':0x80,'…':0x85,'‘':0x91,'’':0x92,'“':0x93,'”':0x94,'•':0x95,'–':0x96,'—':0x97,'™':0x99};
function DustyPdf(){
  const W = 595.28, H = 841.89, M = 48;
  const pages = []; let ops = null, y = 0;
  const pdf = { W, H, M, lineH: 14 };
  function toBytes(str){
    let out = '';
    for(const ch of String(str)){
      let c = ch.codePointAt(0);
      if(PDF_WINANSI[ch] !== undefined) c = PDF_WINANSI[ch];
      else if(c > 255){ const base = ch.normalize('NFD')[0]; c = base.codePointAt(0) <= 255 ? base.codePointAt(0) : 63; }
      if(c === 40 || c === 41 || c === 92) out += '\\' + ch;
      else if(c < 32 || c > 126) out += '\\' + ('000' + c.toString(8)).slice(-3);
      else out += String.fromCharCode(c);
    }
    return out;
  }
  function width(str, size, bold){
    let w = 0;
    for(const ch of String(str)){
      let c = ch.codePointAt(0);
      if(c > 126){ const base = ch.normalize('NFD')[0]; c = base.codePointAt(0); }
      w += (c >= 32 && c <= 126) ? PDF_HELV_W[c - 32] : 556;
    }
    return w / 1000 * size * (bold ? 1.06 : 1);
  }
  pdf.width = width;
  function newPage(){ ops = []; pages.push(ops); y = H - M; }
  pdf.ensure = function(need){ if(!ops || y - need < M + 24) newPage(); };
  pdf.y = ()=> y;
  pdf.setY = v => { y = v; };
  pdf.gap = v => { y -= v; };
  pdf.color = (r,g,b)=> ops.push(`${r} ${g} ${b} rg`);
  // Texto en (x, y-base). align: 'left' | 'right' | 'center'. maxW recorta con "…".
  pdf.text = function(x, yy, str, opt){
    opt = opt || {};
    const size = opt.size || 10, bold = !!opt.bold;
    let s = String(str == null ? '' : str);
    if(opt.maxW){ while(s.length > 1 && width(s, size, bold) > opt.maxW) s = s.slice(0, -2) + '…'; }
    let dx = 0;
    if(opt.align === 'right') dx = -width(s, size, bold);
    else if(opt.align === 'center') dx = -width(s, size, bold) / 2;
    const col = opt.color || [0.11, 0.11, 0.12];
    ops.push(`BT ${col[0]} ${col[1]} ${col[2]} rg /${bold ? 'F2' : 'F1'} ${size} Tf 1 0 0 1 ${(x + dx).toFixed(2)} ${yy.toFixed(2)} Tm (${toBytes(s)}) Tj ET`);
  };
  // Una línea de texto que baja el cursor.
  pdf.line = function(str, opt){
    opt = opt || {};
    const size = opt.size || 10, lh = opt.lh || size * 1.4;
    pdf.ensure(lh);
    y -= lh;
    pdf.text(opt.x != null ? opt.x : M, y + (lh - size) / 2, str, opt);
  };
  pdf.rule = function(gray){
    pdf.ensure(8);
    y -= 4;
    ops.push(`${gray || 0.85} G 0.6 w ${M} ${y.toFixed(2)} m ${(W - M).toFixed(2)} ${y.toFixed(2)} l S`);
    y -= 4;
  };
  pdf.rect = function(x, yy, w, h, rgb){ ops.push(`${rgb[0]} ${rgb[1]} ${rgb[2]} rg ${x.toFixed(2)} ${yy.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`); };
  // Tabla: cols = [{key, label, w, align}], rows = objetos. Cabecera gris, filas
  // alternadas, salta de página repitiendo la cabecera.
  pdf.table = function(cols, rows, opt){
    opt = opt || {};
    const size = opt.size || 9.5, lh = 17;
    const totalW = W - 2 * M;
    const fixed = cols.reduce((s, c)=> s + (c.w || 0), 0);
    const flex = cols.filter(c=> !c.w).length;
    const flexW = flex ? (totalW - fixed) / flex : 0;
    const xs = []; let cx = M;
    cols.forEach(c=>{ const w = c.w || flexW; xs.push({x: cx, w}); cx += w; });
    const head = ()=>{
      pdf.ensure(lh * 2);
      y -= lh;
      pdf.rect(M, y, totalW, lh, [0.95, 0.95, 0.97]);
      cols.forEach((c, i)=>{
        const ax = c.align === 'right' ? xs[i].x + xs[i].w - 6 : xs[i].x + 6;
        pdf.text(ax, y + 5, c.label, {size: size - 0.5, bold: true, align: c.align === 'right' ? 'right' : 'left', color: [0.35, 0.35, 0.4]});
      });
    };
    head();
    rows.forEach((r, ri)=>{
      if(y - lh < M + 24){ newPage(); head(); }
      y -= lh;
      if(ri % 2) pdf.rect(M, y, totalW, lh, [0.985, 0.985, 0.99]);
      cols.forEach((c, i)=>{
        const ax = c.align === 'right' ? xs[i].x + xs[i].w - 6 : xs[i].x + 6;
        pdf.text(ax, y + 5, r[c.key], {size, bold: !!r._bold, align: c.align === 'right' ? 'right' : 'left', maxW: xs[i].w - 12, color: r._muted ? [0.5, 0.5, 0.55] : undefined});
      });
    });
    y -= 2;
    ops.push(`0.85 G 0.6 w ${M} ${y.toFixed(2)} m ${(W - M).toFixed(2)} ${y.toFixed(2)} l S`);
  };
  // Serializa: catálogo, páginas, dos fuentes, un contenido por página, xref.
  pdf.build = function(footer){
    const objs = [];
    const add = s => { objs.push(s); return objs.length; };
    const catalog = add(null), pagesObj = add(null);
    const f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    const f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    const pageIds = [];
    pages.forEach((pOps, i)=>{
      const foot = footer ? footer(i + 1, pages.length) : null;
      const extra = foot ? [`BT 0.55 0.55 0.6 rg /F1 8 Tf 1 0 0 1 ${M} ${(M - 18).toFixed(2)} Tm (${toBytes(foot.left || '')}) Tj ET`,
        `BT 0.55 0.55 0.6 rg /F1 8 Tf 1 0 0 1 ${(W - M - width(foot.right || '', 8)).toFixed(2)} ${(M - 18).toFixed(2)} Tm (${toBytes(foot.right || '')}) Tj ET`] : [];
      const stream = pOps.concat(extra).join('\n');
      const content = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
      const pid = add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${content} 0 R >>`);
      pageIds.push(pid);
    });
    objs[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
    objs[pagesObj - 1] = `<< /Type /Pages /Kids [${pageIds.map(id=> id + ' 0 R').join(' ')}] /Count ${pageIds.length} >>`;
    let out = '%PDF-1.4\n%âãÏÓ\n';
    const offsets = [];
    objs.forEach((body, i)=>{ offsets.push(out.length); out += `${i + 1} 0 obj\n${body}\nendobj\n`; });
    const xref = out.length;
    out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
    offsets.forEach(o=>{ out += ('0000000000' + o).slice(-10) + ' 00000 n \n'; });
    out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    const bytes = new Uint8Array(out.length);
    for(let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
    return bytes;
  };
  newPage();
  return pdf;
}

/* ---------- el informe ---------- */
function reportPeriodLabel(key){ return key.length === 4 ? key : monthLabel(key, uiLang); }
function reportPrevKey(key){
  if(key.length === 4) return String(Number(key) - 1);
  return shiftMonthStr(key, -1);
}
function reportInPeriod(key, d){ return key.length === 4 ? String(d || '').slice(0, 4) === key : monthKey(d) === key; }
// Gastos por categoría para un año: suma de los 12 meses (la función de mes ya
// hace el reparto pro-rata correcto; no se reimplementa).
function reportExpenseByCategory(key){
  if(key.length !== 4) return expenseByCategoryForMonth(key);
  const sums = new Map();
  for(let m = 1; m <= 12; m++){
    expenseByCategoryForMonth(key + '-' + String(m).padStart(2, '0')).forEach(c=>{
      const prev = sums.get(c.id) || {id: c.id, name: c.name, amount: 0, cap: null};
      prev.amount += c.amount; sums.set(c.id, prev);
    });
  }
  return [...sums.values()].sort((a, b)=> b.amount - a.amount);
}
function reportDelta(cur, prev){
  if(!(prev > 0)) return cur > 0 ? t('rp_new') : '—';
  const d = (cur - prev) / prev * 100;
  if(Math.abs(d) < 0.5) return '=';
  // Guion ASCII: el escritor de PDF es WinAnsi y el signo menos tipográfico (U+2212) salía como '?'.
  return (d > 0 ? '+' : '-') + Math.abs(Math.round(d)) + '%';
}
function buildMonthReport(key){
  resetFinancialCache();
  const pdf = DustyPdf();
  const M = pdf.M, W = pdf.W;
  const fin = periodFinancials(key);
  const prevFin = periodFinancials(reportPrevKey(key));
  const isYear = key.length === 4;
  const budget = isYear ? null : effectiveBudgetForMonth(key);
  const name = (businessName || '').trim() || 'Dusty';
  const today = localDateStr(new Date());

  // Cabecera: negocio, período, fecha. Una franja azul finita arriba, nada más.
  pdf.rect(M, pdf.H - M + 10, W - 2 * M, 3, [0.25, 0.56, 0.89]);
  pdf.line(name, {size: 18, bold: true, lh: 28});
  pdf.line(t('rp_title') + ' · ' + reportPeriodLabel(key), {size: 12, color: [0.35, 0.35, 0.4], lh: 18});
  pdf.line(t('rp_generated').replace('{d}', today), {size: 8.5, color: [0.55, 0.55, 0.6], lh: 14});
  pdf.gap(6);

  // 1. Resumen
  pdf.line(t('rp_summary'), {size: 12.5, bold: true, lh: 24});
  const rows = [];
  const kv = (label, value, note)=> rows.push({label, value, note: note || ''});
  kv(t('rp_expenses'), money(fin.expense), t('rp_vs_prev').replace('{d}', reportDelta(fin.expense, prevFin.expense)));
  kv(t('rp_invested'), money(fin.invested), t('rp_vs_prev').replace('{d}', reportDelta(fin.invested, prevFin.invested)));
  if(budget && budget.budget > 0){
    const left = budget.budget - fin.expense;
    kv(t('rp_budget'), money(budget.budget), Math.round(fin.expense / budget.budget * 100) + '% ' + t('rp_used'));
    kv(left >= 0 ? t('rp_left') : t('rp_over'), money(Math.abs(left)), '');
  }
  kv(t('rp_receipts'), String(fin.receiptsCount), '');
  // Ganancias solo con permiso financiero (mismo criterio que el cierre de mes en pantalla).
  if(fin.hadOutflows && (typeof canSeeFinancials!=='function' || canSeeFinancials())){
    kv(t('recap_revenue'), money(fin.revenue), t('rp_vs_prev').replace('{d}', reportDelta(fin.revenue, prevFin.revenue)));
    kv(t('recap_cogs'), money(fin.cogs), '');
    kv(t('recap_gross'), money(fin.gross), fin.grossMarginPct != null ? Math.round(fin.grossMarginPct) + '% ' + t('recap_margin') : '');
    kv(t('recap_net'), money(fin.net), fin.netMarginPct != null ? Math.round(fin.netMarginPct) + '% ' + t('recap_margin') : '');
  }
  pdf.table([{key: 'label', label: t('rp_col_concept')}, {key: 'value', label: t('rp_col_amount'), w: 120, align: 'right'}, {key: 'note', label: '', w: 150, align: 'right'}], rows);
  pdf.gap(14);

  // 2. Gastos por categoría
  pdf.line(t('rp_by_category'), {size: 12.5, bold: true, lh: 24});
  const cats = reportExpenseByCategory(key);
  const totalExp = cats.reduce((s, c)=> s + c.amount, 0);
  if(cats.length === 0){
    pdf.line(t('rp_none'), {size: 9.5, color: [0.5, 0.5, 0.55]});
  } else {
    const crows = cats.map(c=>({name: c.name, amount: money(c.amount), pct: totalExp > 0 ? Math.round(c.amount / totalExp * 100) + '%' : '', cap: c.cap ? money(c.cap) : ''}));
    crows.push({name: t('rp_total'), amount: money(totalExp), pct: '100%', cap: '', _bold: true});
    pdf.table([{key: 'name', label: t('rp_col_category')}, {key: 'amount', label: t('rp_col_amount'), w: 110, align: 'right'}, {key: 'pct', label: '%', w: 60, align: 'right'}, {key: 'cap', label: t('rp_col_cap'), w: 100, align: 'right'}], crows);
  }
  pdf.gap(14);

  // 3. Detalle de recibos y gastos
  pdf.line(t('rp_detail'), {size: 12.5, bold: true, lh: 24});
  const cache = finCache();
  const list = receipts.filter(r=> r && reportInPeriod(key, r.date)).sort((a, b)=> String(a.date).localeCompare(String(b.date)));
  if(list.length === 0){
    pdf.line(t('rp_none'), {size: 9.5, color: [0.5, 0.5, 0.55]});
  } else {
    let sum = 0;
    const rrows = list.map(r=>{
      const s = receiptSplit(r, cache);
      sum += r.total || 0;
      const kind = s.expense > 0 && s.invested > 0 ? t('rp_kind_mixed') : (s.invested > 0 ? t('rp_kind_goods') : t('rp_kind_expense'));
      return {date: r.date || '', who: (r.supplier || '').trim() || t('no_supplier_name'), kind, total: money(r.total || 0)};
    });
    rrows.push({date: '', who: t('rp_total'), kind: '', total: money(sum), _bold: true});
    pdf.table([{key: 'date', label: t('rp_col_date'), w: 80}, {key: 'who', label: t('rp_col_who')}, {key: 'kind', label: t('rp_col_kind'), w: 90}, {key: 'total', label: t('rp_col_total'), w: 100, align: 'right'}], rrows);
  }
  pdf.gap(14);

  // 4. Compras por producto (top 15 por gasto)
  const byIng = new Map();
  purchases.forEach(p=>{
    if(!p || !reportInPeriod(key, p.date)) return;
    const prev = byIng.get(p.ingId) || {ingId: p.ingId, qty: 0, unit: p.unit || '', total: 0};
    prev.qty += Number(p.qty) || 0; prev.total += Number(p.totalPrice) || 0; if(!prev.unit) prev.unit = p.unit || '';
    byIng.set(p.ingId, prev);
  });
  const top = [...byIng.values()].sort((a, b)=> b.total - a.total).slice(0, 15);
  if(top.length){
    pdf.line(t('rp_by_product'), {size: 12.5, bold: true, lh: 24});
    const prow = top.map(p=>{
      const it = cache.byId ? cache.byId.get(p.ingId) : null;
      const nm = (it && it.name) || (inventory.find(i=> i.id === p.ingId) || {}).name || '—';
      return {name: nm, qty: (Math.round(p.qty * 100) / 100) + ' ' + (unitLabel ? unitLabel(p.unit) : p.unit), total: money(p.total)};
    });
    pdf.table([{key: 'name', label: t('rp_col_product')}, {key: 'qty', label: t('rp_col_qty'), w: 120, align: 'right'}, {key: 'total', label: t('rp_col_total'), w: 100, align: 'right'}], prow);
  }
  // Modo Servicios (app-15): trabajos, totales y resultado por activo.
  if(typeof svcReportSection === 'function') svcReportSection(pdf, key);
  pdf.gap(10);
  pdf.line(t(typeof servicesOnly === 'function' && servicesOnly() ? 'recap_est_note_svc' : 'recap_est_note'), {size: 8, color: [0.55, 0.55, 0.6], lh: 12});

  return pdf.build((n, total)=>({left: name + ' · ' + t('rp_title') + ' · ' + reportPeriodLabel(key), right: t('rp_page').replace('{n}', n).replace('{t}', total)}));
}

/* ---------- salida: compartir o descargar ----------
   Auditoría de la auditoría 2026-09-12: adentro de la app de Android (WebView
   de Capacitor) no existe navigator.share y el <a download> no baja nada —
   ningún PDF salía del teléfono, pero la app igual avisaba "descargado" (y,
   peor, una cotización quedaba marcada "enviada"). Con
   Capacitor.isNativePlatform() se prueba primero @capacitor/share +
   @capacitor/filesystem (escribe el PDF en caché y abre la hoja nativa);
   navigator.share/<a download> quedan para el navegador de escritorio o PWA,
   donde sí funcionan. SIN await antes de compartir (iOS exige el gesto): el
   PDF se arma en memoria de forma síncrona, así que la hoja abre dentro del
   mismo toque. sharePdfBytes() nunca rechaza: la promesa se cumple con
   true/false según si el archivo de verdad salió del teléfono — de eso
   depende, por ejemplo, si una cotización se puede marcar "enviada"
   (downloadQuotePdf, app-17). */
function bytesToBase64(bytes){
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = ''; const chunk = 0x8000;
  for(let i = 0; i < arr.length; i += chunk) s += String.fromCharCode.apply(null, arr.subarray(i, i + chunk));
  return btoa(s);
}
function sharePdfBytes(bytes, fileName, title){
  const cap = window.Capacitor;
  const isNative = !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
  const Share = isNative && cap.Plugins && cap.Plugins.Share;
  const Filesystem = isNative && cap.Plugins && cap.Plugins.Filesystem;
  if(Share && Filesystem){
    return Filesystem.writeFile({path: fileName, data: bytesToBase64(bytes), directory: 'CACHE'})
      .then(res => Share.share({title, url: res.uri, dialogTitle: title}))
      .then(()=> true)
      .catch(e=>{ console.error('[Dusty] no se pudo compartir el PDF:', e); showToast(t('rp_share_failed'), 'error'); return false; });
  }
  const file = new File([bytes], fileName, {type: 'application/pdf'});
  if(navigator.canShare && navigator.canShare({files: [file]})){
    return navigator.share({files: [file], title}).then(()=> true)
      .catch(e=>{ if(e && e.name === 'AbortError') return false; return downloadBlob(file, fileName); });
  }
  return Promise.resolve(downloadBlob(file, fileName));
}
function downloadMonthReport(key){
  let bytes;
  try{ bytes = buildMonthReport(key); }
  catch(e){ console.error('[Dusty] no se pudo armar el informe:', e); showToast(t('rp_failed'), 'error'); return; }
  const safeName = ((businessName || 'dusty').trim() || 'dusty').replace(/[^\w\- ]+/g, '').trim().slice(0, 30).replace(/\s+/g, '-') || 'dusty';
  const fileName = `${safeName}-${key}.pdf`;
  sharePdfBytes(bytes, fileName, t('rp_title') + ' · ' + reportPeriodLabel(key));
}
function downloadBlob(blob, fileName){
  try{
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileName; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=> URL.revokeObjectURL(url), 4000);
    showToast(t('rp_downloaded'), 'success');
    return true;
  }catch(e){
    showToast(t('rp_failed'), 'error');
    return false;
  }
}
// Botón "Reports" (texto fijo: es el nombre que pidió el usuario en los dos
// idiomas) — se dibuja en el Cierre de mes y en cada tarjeta de mes.
function reportButtonHtml(key, extraClass){
  return `<button type="button" class="btn btn-ghost btn-sm rp-btn ${extraClass || ''}" data-report-key="${escapeHtml(key)}" title="${t('rp_btn_hint')}">${t('rp_btn')}</button>`;
}
/* ---------- COMPROBANTE en PDF (un recibo, sin foto) ----------
   Pedido del usuario 2026-09-11: "que se imprima la información extraída, no
   la foto". Cabecera con negocio, proveedor, fecha y tipo; tabla de líneas con
   cantidad, precio unitario y total; total pagado. Mismo escritor que el
   informe mensual, así se imprime o comparte desde la hoja nativa. */
function receiptKindLabel(r, cache){
  const s = receiptSplit(r, cache || finCache());
  return s.expense > 0 && s.invested > 0 ? t('rp_kind_mixed') : (s.invested > 0 ? t('rp_kind_goods') : t('rp_kind_expense'));
}
function receiptLineRows(r){
  return (r.appliedItems || []).map(it=>{
    const qty = Number(it.qty) || 0, tot = Number(it.totalPrice) || 0;
    return { desc: (it.rawName || '').trim() || '—', applied: it.ingName ? (t('rd_applied_to') + ' ' + it.ingName) : '', qty: qty ? (Math.round(qty * 100) / 100) + ' ' + unitLabel(it.unit) : '', unit: qty > 0 ? money(tot / qty) : '—', total: money(tot) };
  });
}
function pdfReceiptBlock(pdf, r, cache){
  const rows = receiptLineRows(r);
  if(rows.length === 0){ pdf.line(t('rb_no_lines'), {size: 9, color: [0.5, 0.5, 0.55], lh: 14}); return; }
  const tr = rows.map(x=>({desc: x.desc + (x.applied ? '  ·  ' + x.applied : ''), qty: x.qty, unit: x.unit, total: x.total}));
  tr.push({desc: t('lbl_total_paid'), qty: '', unit: '', total: money(r.total || 0), _bold: true});
  pdf.table([{key: 'desc', label: t('rd_col_desc')}, {key: 'qty', label: t('rd_col_qty'), w: 90, align: 'right'}, {key: 'unit', label: t('rd_col_unit'), w: 80, align: 'right'}, {key: 'total', label: t('rd_col_total'), w: 90, align: 'right'}], tr, {size: 9});
}
function buildReceiptPdf(r){
  resetFinancialCache();
  const pdf = DustyPdf(); const M = pdf.M, W = pdf.W; const cache = finCache();
  const name = (businessName || '').trim() || 'Dusty';
  pdf.rect(M, pdf.H - M + 10, W - 2 * M, 3, [0.25, 0.56, 0.89]);
  pdf.line(name, {size: 18, bold: true, lh: 28});
  pdf.line(t('rd_pdf_title') + ' · ' + ((r.supplier || '').trim() || t('no_supplier_name')), {size: 12, color: [0.35, 0.35, 0.4], lh: 18});
  pdf.line(`${t('rp_col_date')}: ${r.date || ''}   ·   ${t('rd_kind_label')}: ${receiptKindLabel(r, cache)}   ·   ${t('rd_id_label')} ${String(r.id || '').slice(-6).toUpperCase()}`, {size: 9, color: [0.45, 0.45, 0.5], lh: 15});
  pdf.line(t('rp_generated').replace('{d}', localDateStr(new Date())), {size: 8.5, color: [0.55, 0.55, 0.6], lh: 14});
  pdf.gap(8);
  pdf.line(t('rd_ledger_title'), {size: 12.5, bold: true, lh: 24});
  pdfReceiptBlock(pdf, r, cache);
  pdf.gap(10);
  pdf.line(t('recap_est_note'), {size: 8, color: [0.55, 0.55, 0.6], lh: 12});
  return pdf.build((n, total)=>({left: name + ' · ' + t('rd_pdf_title') + ' · ' + (r.date || ''), right: t('rp_page').replace('{n}', n).replace('{t}', total)}));
}
function downloadReceiptPdf(r){
  const bytes = buildReceiptPdf(r);
  const safeName = ((businessName || 'dusty').trim() || 'dusty').replace(/[^\w\- ]+/g, '').trim().slice(0, 30).replace(/\s+/g, '-') || 'dusty';
  const who = ((r.supplier || '').trim() || 'recibo').replace(/[^\w\- ]+/g, '').trim().slice(0, 24).replace(/\s+/g, '-') || 'recibo';
  const fileName = `${safeName}-${r.date || 'sin-fecha'}-${who}.pdf`;
  sharePdfBytes(bytes, fileName, t('rd_pdf_title') + ' · ' + (r.date || ''));
}

/* ---------- CONSTRUCTOR DE REPORTES por rango (mezclar días y meses) ----------
   Pedido del usuario 2026-09-11: "permitir mezclar y hacer reportes de diferentes
   días y meses, organizado como un profesional contable". Rango Desde/Hasta con
   atajos (hoy, semana, mes, mes pasado, año), filtro por proveedor y la opción
   de incluir el detalle línea por línea. El PDF: resumen del período, gastos por
   categoría, y el detalle POR DÍA con subtotal de día, subtotal de mes cuando
   cambia el mes, total del período y compras por producto. */
let showReportBuilder = false;
let rbFrom = localDateStr(new Date()).slice(0, 8) + '01', rbTo = localDateStr(new Date()), rbQuick = 'month', rbSupplier = '', rbDetail = true;
function rbQuickRange(kind){
  const now = new Date(); const today = localDateStr(now);
  if(kind === 'today') return [today, today];
  if(kind === 'week'){ const d = new Date(now); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow); return [localDateStr(d), today]; }
  if(kind === 'month') return [today.slice(0, 8) + '01', today];
  if(kind === 'last'){ const k = shiftMonthStr(today.slice(0, 7), -1); const [y, m] = k.split('-').map(Number); const last = new Date(y, m, 0).getDate(); return [k + '-01', k + '-' + String(last).padStart(2, '0')]; }
  if(kind === 'year') return [today.slice(0, 4) + '-01-01', today];
  return [rbFrom, rbTo];
}
function rbReceipts(){
  const a = rbFrom <= rbTo ? rbFrom : rbTo, b = rbFrom <= rbTo ? rbTo : rbFrom;
  return receipts.filter(r=> r && r.date && r.date >= a && r.date <= b && (!rbSupplier || (r.supplier || '').trim() === rbSupplier))
    .sort((x, y)=> String(x.date).localeCompare(String(y.date)) || String(x.createdAt || '').localeCompare(String(y.createdAt || '')));
}
function rbDayLabel(dateStr){
  const d = calDateFromStr(dateStr);
  const wd = CAL_NOTE_WEEKDAYS[uiLang][d.getDay()];
  return wd.charAt(0).toUpperCase() + wd.slice(1) + ' ' + d.getDate() + ' ' + MONTH_NAMES[uiLang][d.getMonth()] + ' ' + d.getFullYear();
}
function reportBuilderModal(){
  const list = rbReceipts();
  const total = list.reduce((s, r)=> s + (r.total || 0), 0);
  const suppliers = [...new Set(receipts.map(r=> (r.supplier || '').trim()).filter(Boolean))].sort((a, b)=> a.localeCompare(b));
  const chip = (k, label)=>`<button type="button" class="exit-reason-chip ${rbQuick === k ? 'on' : ''}" data-rb-quick="${k}" style="font-size:calc(13px * var(--fs, 1));padding:8px 13px;">${label}</button>`;
  return `
  <div class="overlay overlay-fast" id="report-builder-overlay">
    <div class="modal">
      <h3 class="navy">${t('rb_title')}</h3>
      <div class="sub">${t('rb_sub')}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        ${chip('today', t('rb_quick_today'))}${chip('week', t('rb_quick_week'))}${chip('month', t('rb_quick_month'))}${chip('last', t('rb_quick_last'))}${chip('year', t('rb_quick_year'))}${chip('custom', t('rb_quick_custom'))}
      </div>
      <div style="display:flex;gap:10px;margin-top:12px;">
        <div class="field" style="flex:1;margin:0;"><label>${t('rb_from')}</label><input id="rb-from" type="date" value="${escapeHtml(rbFrom)}"></div>
        <div class="field" style="flex:1;margin:0;"><label>${t('rb_to')}</label><input id="rb-to" type="date" value="${escapeHtml(rbTo)}"></div>
      </div>
      ${suppliers.length > 1 ? `
      <div class="field" style="margin-top:12px;"><label>${t('rb_supplier')}</label>
        <select id="rb-supplier"><option value="">${t('rb_supplier_all')}</option>${suppliers.map(s=>`<option value="${escapeHtml(s)}" ${rbSupplier === s ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('')}</select>
      </div>` : ''}
      <label style="display:flex;align-items:center;gap:10px;margin-top:12px;font-size:calc(13.5px * var(--fs, 1));font-weight:600;cursor:pointer;">
        <input type="checkbox" id="rb-detail" ${rbDetail ? 'checked' : ''} style="width:18px;height:18px;"> ${t('rb_detail')}
      </label>
      <div class="helper-note" style="margin:14px 0 0;font-weight:700;color:${list.length ? 'var(--ink)' : 'var(--ink-soft)'};">${list.length ? t('rb_count').replace('{n}', list.length).replace('{total}', money(total)) : t('rb_empty')}</div>
      <div class="modal-actions">
        <button class="btn btn-ghost" id="btn-close-report-builder">${t('btn_close')}</button>
        <button class="btn btn-primary" id="btn-generate-report" ${list.length ? '' : 'disabled'}>${t('rb_generate')}</button>
      </div>
    </div>
  </div>`;
}
function buildRangeReport(){
  resetFinancialCache();
  const list = rbReceipts();
  const a = rbFrom <= rbTo ? rbFrom : rbTo, b = rbFrom <= rbTo ? rbTo : rbFrom;
  const pdf = DustyPdf(); const M = pdf.M, W = pdf.W; const cache = finCache();
  const name = (businessName || '').trim() || 'Dusty';
  pdf.rect(M, pdf.H - M + 10, W - 2 * M, 3, [0.25, 0.56, 0.89]);
  pdf.line(name, {size: 18, bold: true, lh: 28});
  pdf.line(t('rb_pdf_title') + ' · ' + t('rb_period').replace('{a}', a).replace('{b}', b) + (rbSupplier ? '  ·  ' + t('rb_filter_supplier').replace('{s}', rbSupplier) : ''), {size: 12, color: [0.35, 0.35, 0.4], lh: 18});
  pdf.line(t('rp_generated').replace('{d}', localDateStr(new Date())), {size: 8.5, color: [0.55, 0.55, 0.6], lh: 14});
  pdf.gap(6);
  // 1. Resumen del período
  let expense = 0, invested = 0, total = 0; const byCat = new Map(); const byIng = new Map();
  list.forEach(r=>{
    const s = receiptSplit(r, cache); expense += s.expense; invested += s.invested; total += r.total || 0;
    (r.appliedItems || []).forEach(it=>{
      const ing = it.ingId ? cache.byId.get(it.ingId) : null;
      const isExp = it.unit === 'servicio' || it.expenseOnly === true || (ing && isExpenseItem(ing));
      if(isExp){ const c = ing && ing.expenseCategoryId ? expenseCategories.find(x=> x.id === ing.expenseCategoryId) : null; const k = c ? c.name : t('categories_uncategorized'); byCat.set(k, (byCat.get(k) || 0) + (Number(it.totalPrice) || 0) * (s.factor || 1)); }
      const key = it.ingId || ('raw:' + (it.rawName || '')); const prev = byIng.get(key) || {name: (ing && ing.name) || it.rawName || '—', qty: 0, unit: it.unit || '', total: 0};
      prev.qty += Number(it.qty) || 0; prev.total += Number(it.totalPrice) || 0; byIng.set(key, prev);
    });
    // Gasto que ninguna línea explica (impuestos, recibo sin líneas): a Sin categoría, como la barra del presupuesto.
    if(!r.manual && s.unassignedExpense > 0){ const k = t('categories_uncategorized'); byCat.set(k, (byCat.get(k) || 0) + s.unassignedExpense); }
    if(r.manual && r.manualKind !== 'investment'){ const c = r.expenseCategoryId ? expenseCategories.find(x=> x.id === r.expenseCategoryId) : null; const k = c ? c.name : t('categories_uncategorized'); byCat.set(k, (byCat.get(k) || 0) + (r.total || 0)); }
  });
  pdf.line(t('rb_summary'), {size: 12.5, bold: true, lh: 24});
  const days = new Set(list.map(r=> r.date)).size;
  pdf.table([{key: 'label', label: t('rp_col_concept')}, {key: 'value', label: t('rp_col_amount'), w: 130, align: 'right'}], [
    {label: t('rb_grand_total'), value: money(total), _bold: true},
    {label: t('rp_expenses'), value: money(expense)},
    {label: t('rp_invested'), value: money(invested)},
    {label: t('rp_receipts'), value: String(list.length) + '  ·  ' + days + ' ' + (uiLang === 'en' ? 'days' : 'días')}
  ]);
  pdf.gap(12);
  if(byCat.size){
    pdf.line(t('rp_by_category'), {size: 12.5, bold: true, lh: 24});
    const cats = [...byCat.entries()].sort((x, y)=> y[1] - x[1]); const te = cats.reduce((s, c)=> s + c[1], 0);
    pdf.table([{key: 'name', label: t('rp_col_category')}, {key: 'amount', label: t('rp_col_amount'), w: 110, align: 'right'}, {key: 'pct', label: '%', w: 60, align: 'right'}], cats.map(([n, v])=>({name: n, amount: money(v), pct: te > 0 ? Math.round(v / te * 100) + '%' : ''})));
    pdf.gap(12);
  }
  // 2. Detalle por día (con subtotal de día y de mes)
  pdf.line(t('rb_by_day'), {size: 12.5, bold: true, lh: 24});
  let curDay = null, curMonth = null, daySum = 0, monthSum = 0;
  const flushDay = ()=>{ if(curDay === null) return; pdf.line(t('rb_day_subtotal') + '   ' + money(daySum), {size: 9.5, bold: true, lh: 16, color: [0.2, 0.2, 0.25], x: M + 8}); daySum = 0; };
  const flushMonth = ()=>{ if(curMonth === null) return; pdf.rule(0.7); pdf.line(t('rb_month_subtotal').replace('{m}', monthLabel(curMonth, uiLang)) + '   ' + money(monthSum), {size: 10.5, bold: true, lh: 20}); pdf.gap(4); monthSum = 0; };
  list.forEach(r=>{
    const mk = monthKey(r.date);
    if(r.date !== curDay){ flushDay(); if(mk !== curMonth){ flushMonth(); curMonth = mk; } curDay = r.date; pdf.gap(4); pdf.line(rbDayLabel(r.date), {size: 10.5, bold: true, lh: 20, color: [0.25, 0.56, 0.89]}); }
    daySum += r.total || 0; monthSum += r.total || 0;
    pdf.line(((r.supplier || '').trim() || t('no_supplier_name')) + '   ·   ' + receiptKindLabel(r, cache) + '   ·   ' + money(r.total || 0), {size: 10, bold: true, lh: 17, x: M + 8});
    if(rbDetail){ if((r.appliedItems || []).length){ pdfReceiptBlock(pdf, r, cache); pdf.gap(4); } }
  });
  flushDay(); flushMonth();
  pdf.gap(6);
  pdf.rect(M, pdf.y() - 22, W - 2 * M, 22, [0.93, 0.95, 0.99]); pdf.text(M + 8, pdf.y() - 15, t('rb_grand_total'), {size: 11, bold: true}); pdf.text(W - M - 8, pdf.y() - 15, money(total), {size: 11, bold: true, align: 'right'}); pdf.gap(30);
  // 3. Compras por producto
  const top = [...byIng.values()].sort((x, y)=> y.total - x.total).slice(0, 25);
  if(top.length){
    pdf.line(t('rp_by_product'), {size: 12.5, bold: true, lh: 24});
    pdf.table([{key: 'name', label: t('rp_col_product')}, {key: 'qty', label: t('rp_col_qty'), w: 120, align: 'right'}, {key: 'total', label: t('rp_col_total'), w: 100, align: 'right'}], top.map(p=>({name: p.name, qty: (Math.round(p.qty * 100) / 100) + ' ' + unitLabel(p.unit), total: money(p.total)})));
  }
  pdf.gap(10);
  pdf.line(t('recap_est_note'), {size: 8, color: [0.55, 0.55, 0.6], lh: 12});
  return pdf.build((n, tot)=>({left: name + ' · ' + t('rb_pdf_title') + ' · ' + a + ' → ' + b, right: t('rp_page').replace('{n}', n).replace('{t}', tot)}));
}
function downloadRangeReport(){
  let bytes;
  try{ bytes = buildRangeReport(); }
  catch(e){ console.error('[Dusty] no se pudo armar el reporte:', e); showToast(t('rp_failed'), 'error'); return; }
  const safeName = ((businessName || 'dusty').trim() || 'dusty').replace(/[^\w\- ]+/g, '').trim().slice(0, 30).replace(/\s+/g, '-') || 'dusty';
  const fileName = `${safeName}-reporte-${rbFrom}-${rbTo}.pdf`;
  sharePdfBytes(bytes, fileName, t('rb_pdf_title'));
}
function attachReportEvents(){
  document.querySelectorAll('[data-report-key]').forEach(b=>{
    b.onclick = (ev)=>{ ev.stopPropagation(); downloadMonthReport(b.dataset.reportKey); };
  });
  const btnRb = document.getElementById('btn-report-builder');
  if(btnRb) btnRb.onclick = ()=>{ showReportBuilder = true; render(); };
  const rbOv = document.getElementById('report-builder-overlay');
  if(rbOv){
    const close = ()=>{ showReportBuilder = false; render(); };
    rbOv.onmousedown = (e)=>{ if(e.target === rbOv) close(); };
    document.getElementById('btn-close-report-builder').onclick = close;
    document.querySelectorAll('[data-rb-quick]').forEach(b=>{ b.onclick = ()=>{ rbQuick = b.dataset.rbQuick; if(rbQuick !== 'custom'){ const [a, z] = rbQuickRange(rbQuick); rbFrom = a; rbTo = z; } render(); }; });
    const fromInp = document.getElementById('rb-from'), toInp = document.getElementById('rb-to');
    if(fromInp) fromInp.onchange = ()=>{ if(fromInp.value){ rbFrom = fromInp.value; rbQuick = 'custom'; render(); } };
    if(toInp) toInp.onchange = ()=>{ if(toInp.value){ rbTo = toInp.value; rbQuick = 'custom'; render(); } };
    const sup = document.getElementById('rb-supplier');
    if(sup) sup.onchange = ()=>{ rbSupplier = sup.value; render(); };
    const det = document.getElementById('rb-detail');
    if(det) det.onchange = ()=>{ rbDetail = !!det.checked; };
    // SIN await antes de navigator.share (iOS exige el gesto).
    const gen = document.getElementById('btn-generate-report');
    if(gen) gen.onclick = ()=> downloadRangeReport();
  }
}
