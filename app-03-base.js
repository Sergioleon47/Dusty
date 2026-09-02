/* ================= IDIOMA (ES/EN) =================
   El idioma solo afecta los textos de la interfaz (botones, títulos, ayudas).
   Los nombres/categorías de productos que el usuario ingresa NUNCA se traducen —
   siempre quedan en inglés, para que el emparejamiento con el texto del OCR de
   recibos no se confunda entre idiomas. */
let uiLang = 'es';
try{
  // 'platocost_lang' es el nombre viejo del producto, de antes de renombrarse a
  // PATRON — se sigue leyendo una sola vez acá (y se migra a la clave nueva de una)
  // para que a nadie que ya tenía la app instalada se le resetee el idioma elegido.
  const savedLang = localStorage.getItem('patron_lang') || localStorage.getItem('platocost_lang');
  if(savedLang){
    localStorage.setItem('patron_lang', savedLang);
    localStorage.removeItem('platocost_lang');
  }
  // Sin preferencia guardada todavía (primera visita): arrancamos con una mejor
  // adivinanza que el navegador/celular del usuario ya sabe (navigator.language),
  // en vez de asumir español siempre — igual se lo confirmamos explícitamente en
  // el modal de bienvenida (ver welcomeModal()), esto es solo el estado inicial
  // mientras carga esa pantalla.
  uiLang = savedLang || (navigator.language && navigator.language.toLowerCase().startsWith('en') ? 'en' : 'es');
}catch(e){}
function setLang(l){
  uiLang = l;
  try{ localStorage.setItem('patron_lang', l); }catch(e){}
  render();
}
const I18N = {
  es: {
    tab_dashboard:'Dashboard', tab_inventory:'Inventario', tab_receipts:'Recibos',
    dash_spending_of:'Gasto de', dash_see_all_months:'Ver todos los meses',
    dash_budget_of:'Presupuesto:', dash_edit_budget:'Editar',
    dash_scan_receipt:'Escanear recibo', price_updated:'precio actualizado',
    stock_status_title:'Estado del inventario', stock_of:'de', stock_critical_alerts:'Alertas críticas:',
    stock_no_data_caption:'Sin compras registradas todavía — no se puede evaluar el stock',
    stock_suggested_order:'Pedido sugerido:', stock_view_detail:'Ver detalle',
    suggested_order_title:'Pedido sugerido', suggested_order_sub:'Productos en nivel crítico y cuánto haría falta pedir para volver al objetivo.',
    suggested_order_empty:'Por ahora ningún producto está en nivel crítico.', suggested_order_row_note:'Tenés',
    cc_btn:'Conteo cíclico', cc_title:'Conteo cíclico', cc_sub:'Cada cierto número de días, contás a mano una parte del inventario para mantener los datos al día — cada vez le toca a productos distintos.',
    cc_due_note:'Toca contar {n} producto(s) hoy. Anotá lo que ves en el estante; lo que dejes en blanco no se modifica.',
    cc_not_due_note:'Ya estás al día. El próximo conteo te toca el', cc_next_now:'hoy',
    cc_current:'Tenés registrado', cc_counted_placeholder:'Cantidad contada', cc_save_btn:'Guardar conteo',
    cc_settings_title:'Configuración del conteo', cc_pct_label:'% del inventario', cc_interval_label:'Cada cuántos días',
    cc_settings_helper:'Por ejemplo, 20% cada 3 días — así en unas dos semanas ya pasaste por todo el inventario.',
    cc_banner_text:'Toca para contar {n} producto(s) — conteo cíclico',
    cc_filtered_note:'Mostrando solo lo que toca contar hoy.', cc_show_all_link:'Ver todo el inventario',
    cc_show_pending_link:'Ver solo lo pendiente de contar',
    btn_export_data:'Exportar respaldo (.json)', btn_import_data:'Importar respaldo (.json)',
    backup_section_title:'Respaldo local', backup_section_hint:'Guarda o restaura una copia de tus datos en un archivo — independiente de la sincronización en la nube.',
    import_invalid:'Ese archivo no es un respaldo válido de Dusty.',
    import_confirm:'Esto va a reemplazar todo el inventario, recibos y compras actuales con los del archivo. ¿Continuar?',
    import_success:'Respaldo importado correctamente.',
    import_blocked_team:'Estás usando el inventario compartido de un equipo. Salí del equipo antes de importar un respaldo, para no sobrescribir los datos del equipo.',
    empty_inventory_title:'Inventario vacío', empty_inventory_sub:'Agrega tu primer producto para empezar a llevar tu inventario.',
    sync_loading_title:'Cargando tu inventario…', sync_loading_sub:'Estamos trayendo tus datos desde la nube — no debería tardar mucho.',
    dash_empty_title:'Vamos a armar tu inventario', dash_empty_sub:'Escaneá tu primer recibo y Dusty carga los productos y precios solo, o agregá uno a mano si preferís empezar simple.',
    dash_empty_scan_btn:'Escanear recibo', dash_empty_manual_btn:'+ Agregar producto a mano',
    empty_receipts_title:'Aún no hay recibos guardados',
    inv_title:'Inventario', inv_sub:'Tus productos y su costo actual por unidad, siempre al día',
    inv_in_stock_suffix:'en stock',
    btn_new_item:'+ Nuevo producto',
    th_ingredient:'Producto', th_cost_unit:'Costo/unidad', lbl_stock:'Cantidad en stock',
    btn_edit:'Editar', btn_delete:'Eliminar',
    rec_title:'Recibos', rec_sub:'Historial de recibos escaneados o subidos — cada uno alimentó el inventario automáticamente',
    no_supplier_name:'Proveedor sin nombre', product_singular:'producto', products_plural:'productos',
    rec_search_placeholder:'Buscar por proveedor o producto...', rec_no_matches:'Ningún recibo coincide con la búsqueda.',
    rec_month_total:'Total del mes', btn_print:'Imprimir', btn_share:'Enviar',
    btn_cal_prev:'Mes anterior', btn_cal_next:'Mes siguiente', day_receipts_title:'Recibos de ese día',
    btn_cal_year_view:'Ver todo el año', btn_cal_month_view:'Volver al mes',
    rec_amount_search_placeholder:'Buscar por monto o producto...',
    confirm_delete_receipt:'¿Eliminar este recibo? También se van a quitar las compras que generó del historial y del gasto mensual.',
    confirm_revert_inventory:'¿También querés restar del inventario las cantidades que agregó este recibo? Si ya usaste o vendiste ese stock, elegí "Cancelar" para dejar las cantidades actuales como están.',
    confirm_delete_item:'¿Eliminar "{name}" del inventario?',
    ph_title_prefix:'Historial de precio — ', ph_sub:'Costo por unidad en cada compra registrada, de más vieja a más reciente',
    ph_up:'Subió', ph_down:'Bajó', ph_since_first:'desde tu primera compra registrada',
    ph_no_change:'Sin cambios importantes desde tu primera compra registrada',
    ph_not_enough:'Todavía no hay suficiente historial — se necesitan al menos 2 compras de este producto para armar la gráfica. Por ahora tenés',
    supplier_compare_title:'Comparar proveedores', cheapest_label:'más barato', avg_price_label:'prom.',
    supplier_compare_helper:'Según el precio de la última compra a cada proveedor.', ph_full_history_label:'Historial completo',
    btn_cancel:'Cancelar', btn_close:'Cerrar',
    ms_title:'Gasto por mes', ms_sub:'Todos los meses con compras registradas, uno al lado del otro',
    ms_no_purchases:'Todavía no hay compras registradas.', ms_current_month:'mes actual',
    alert_title:'Alertas de precio', alert_sub:'Ajustá cuándo un aumento de precio al escanear un recibo se marca como algo que requiere revisión inmediata.',
    business_name_title:'Nombre del negocio', business_name_label:'Nombre', business_name_placeholder:'Ej. Pedro\'s',
    business_name_helper:'Si lo completás, reemplaza el título "Inventario" en esta cuenta. Dejalo vacío para no cambiar nada. Solo afecta a esta cuenta, nunca a otras.',
    alert_threshold_title:'Alertas de precio al escanear', alert_threshold_label:'Umbral de alerta (%)', alert_helper:'Cualquier aumento se marca en amarillo. A partir de este % se marca en rojo, como algo que requiere revisión inmediata.',
    budget_title:'Presupuesto mensual', budget_label:'Monto ($)', budget_placeholder:'Ej. 2000',
    budget_helper:'Se repite todos los meses hasta que lo cambies. Dejalo vacío para no mostrar la barra de presupuesto.',
    btn_manage_categories:'Categorías', categories_title:'Categorías de inventario',
    categories_sub:'Agrupá tus productos como quieras — Comida, Hogar, Ropa, Mantenimiento, o las que necesites.',
    categories_empty:'No tenés categorías — todo el inventario aparece en una sola lista.',
    categories_new_placeholder:'Nueva categoría', categories_add_btn:'+ Agregar',
    categories_helper:'Borrar una categoría no borra sus productos — solo dejan de estar agrupados, y pasan a "Sin categoría".',
    categories_uncategorized:'Sin categoría', lbl_category:'Categoría', category_none_option:'Sin categoría',
    inv_filtered_by_category:'Mostrando: {name}', btn_clear_category_filter:'Ver todo',
    empty_category_title:'Nada por acá todavía', empty_category_sub:'Esta categoría no tiene productos asignados.',
    btn_save:'Guardar', btn_alert_settings:'Configuración',
    btn_feedback:'Reportar un problema',
    cloud_sync_signed_out:'Iniciar sesión para sincronizar en la nube',
    cloud_sync_signed_in:'Sincronizado como {email} — toca para compartir o cerrar sesión',
    cloud_sync_pending:'Sincronizando cambios con la nube — todavía puede faltar ver lo último de tu equipo',
    btn_login:'Iniciar sesión', btn_account_cta:'Entrar',
    auth_signin_title:'Iniciar sesión', auth_signup_title:'Crear cuenta',
    scan_requires_account:'Creá una cuenta gratis para escanear recibos — así tu inventario queda respaldado y podés verlo desde cualquier dispositivo.',
    trial_upgrade_title:'Guardá tu cuenta',
    trial_upgrade_sub:'Con tu nombre, tu email y un PIN entrás desde cualquier dispositivo — y todo lo que cargaste hasta ahora queda tal cual, no se pierde nada.',
    trial_upgrade_btn:'Crear mi cuenta',
    trial_save_account_cta:'Guardar mi cuenta',
    trial_scans_over_note:'Usaste los escaneos gratis de prueba. Guardá tu cuenta y seguí escaneando justo donde quedaste.',
    trial_inventory_limit_note:'Llegaste al límite de productos de la prueba. Guardá tu cuenta para seguir agregando sin ese tope.',
    trial_email_in_use:'Ese email ya tiene una cuenta. Tocá "Iniciar sesión" abajo para entrar con ella.',
    pb_open_btn:'📷 Escanear productos',
    pb_title:'Armá tu inventario con una foto',
    pb_sub:'Sacá UNA foto con varios productos a la vista (el estante, la mesa, las compras) — la IA identifica cada uno y los agregás todos juntos.',
    pb_tap_photo:'Tocá para sacar la foto',
    pb_loading:'Identificando los productos de la foto…',
    pb_retry:'Probar con otra foto',
    pb_none_found:'No se reconoció ningún producto en la foto — probá con más luz o más de cerca.',
    pb_review_hint:'Se detectaron {n} productos. Revisá cada uno, destildá los que no quieras, y corregí lo que haga falta antes de agregar.',
    pb_already_in_inventory:'Ya está en tu inventario — quedó destildado para no duplicarlo.',
    pb_low_confidence:'La IA no está segura de este — revisá el nombre antes de agregar.',
    pb_cost_ph:'Costo',
    pb_add_btn:'Agregar {n} al inventario',
    ids_open_btn:'🔎 Identificar',
    ids_title:'¿Qué producto es?',
    ids_sub:'Apuntá la cámara al producto y tocá el botón — te decimos qué es y si ya lo tenés en tu inventario.',
    ids_capture:'Identificar',
    ids_use_native_camera:'📷 Usar la cámara del sistema',
    ids_loading:'Identificando el producto…',
    ids_found_in_inventory:'Ya está en tu inventario',
    ids_not_in_inventory:'No está en tu inventario todavía',
    ids_stock:'Stock',
    ids_cost:'Costo',
    ids_scan_again:'Escanear otro',
    ids_open_item:'Ver producto',
    ids_add_item:'+ Agregarlo',
    auth_continue_google:'Continuar con Google', auth_or:'o', auth_password:'Contraseña',
    auth_forgot_password:'¿Olvidaste tu contraseña?', auth_no_account:'¿No tenés cuenta?',
    auth_have_account:'¿Ya tenés cuenta?', auth_create_account:'Crear cuenta', auth_loading:'Un momento…',
    auth_err_email_in_use:'Ya existe una cuenta con ese email — probá iniciar sesión en vez de crear una nueva.',
    auth_err_invalid_email:'Ese email no parece válido.',
    auth_err_weak_password:'La contraseña necesita al menos 6 caracteres.',
    auth_err_wrong_password:'Email o contraseña incorrectos.',
    auth_err_user_not_found:'No hay ninguna cuenta con ese email.',
    auth_err_too_many:'Demasiados intentos — esperá un momento y probá de nuevo.',
    auth_err_generic:'Algo salió mal. Probá de nuevo.',
    auth_err_provider_disabled:'El inicio de sesión con email todavía no está activado — probá con Google, o avisale al administrador.',
    auth_err_need_email:'Escribí tu email primero.',
    auth_err_need_both:'Completá el email y la contraseña.',
    auth_reset_sent:'Te mandamos un email para restablecer tu contraseña.',
    team_title:'Compartir inventario', team_sign_out_btn:'Cerrar sesión',
    team_your_code_hint:'Cualquiera que entre este código en su propia cuenta va a ver y editar el mismo inventario que vos.',
    team_your_code_label:'Tu código', team_copy_btn:'Copiar', team_copied:'¡Copiado!',
    team_members_label:'Personas con acceso', team_remove_btn:'Quitar',
    team_remove_confirm:'¿Quitarle el acceso a esta persona? Va a dejar de ver este inventario.',
    team_you_owner_label:'Vos (dueño/a)', team_no_members_yet:'Todavía nadie se unió con tu código.',
    presence_active_now:'Activo ahora', presence_last_seen:'Última vez {when}', presence_never:'Nunca se conectó',
    team_join_label:'¿Alguien te compartió un código?', team_join_placeholder:'CÓDIGO',
    team_join_btn:'Unirme',
    team_join_confirm:'Vas a empezar a ver el inventario compartido de {email}. Lo que tengas guardado en esta cuenta ahora mismo no se va a mostrar más. ¿Continuar?',
    team_viewing_shared:'Estás viendo el inventario compartido de {email}.',
    account_owner_hint:'Estás viendo el inventario compartido de esta cuenta',
    btn_inventory_activity:'Cambios', activity_modal_title:'Actividad del inventario',
    activity_empty:'Todavía no hay cambios registrados.',
    activity_you:'Vos',
    activity_item_created:'agregó', activity_item_edited:'editó', activity_item_deleted:'eliminó',
    activity_scan_applied:'actualizó {n} producto(s) desde un recibo',
    activity_last_edit:'Última edición: {who} — {when}',
    time_just_now:'ahora mismo', time_minutes_ago:'hace {n} min', time_hours_ago:'hace {n} h',
    time_days_ago:'hace {n} d',
    team_leave_btn:'Dejar de ver este inventario compartido',
    team_leave_confirm:'¿Dejar de ver este inventario compartido? Vas a volver a tu propia cuenta.',
    team_err_need_code:'Escribí un código primero.',
    team_err_not_found:'Ese código no existe. Revisalo con la persona que te lo compartió.',
    team_err_self:'Ese es tu propio código — compartíselo a otra persona.',
    team_err_generic:'Algo salió mal. Probá de nuevo.',
    team_share_btn:'Compartir', team_share_msg:'Te comparto el inventario en Dusty — abrí este link y entrá con tu nombre y un PIN:',
    team_join_title:'Unirme con un código', team_join_hint:'Alguien te compartió un código de invitación. Poné tu nombre y elegí un PIN — no hace falta ningún email.',
    team_pinlogin_title:'Entrar con nombre y PIN', team_pinlogin_hint:'Si ya te uniste antes a un inventario compartido, entrá con el mismo código, tu nombre y tu PIN.',
    team_pin_name_label:'Tu nombre', team_pin_name_placeholder:'Ej. Juan',
    team_pin_label:'Elegí un PIN (mínimo 6 caracteres)', team_pin_confirm_label:'Repetí el PIN',
    team_back_to_normal_login:'← Volver', team_have_code_link:'¿Te compartieron un código?',
    team_have_pin_link:'Ya tengo nombre y PIN',
    auth_err_need_name:'Escribí tu nombre primero.', auth_err_need_pin:'Escribí tu PIN.',
    auth_err_pin_short:'El PIN tiene que tener al menos 6 caracteres.',
    auth_err_pin_mismatch:'Los dos PIN no coinciden.',
    auth_err_name_taken:'Ese nombre ya está en uso en Dusty — probá agregando tu apellido o algo que lo distinga.',
    auth_err_pin_wrong:'Nombre o PIN incorrecto.',
    feedback_title:'Reportar un problema', feedback_sub:'Contanos qué pasó — lo vamos a revisar apenas podamos.',
    feedback_placeholder:'Ej. Al escanear un recibo de 3 páginas, la última no se leyó bien...',
    feedback_send:'Enviar', feedback_sent:'¡Gracias! Ya recibimos tu mensaje.',
    feedback_error:'No se pudo enviar — revisá tu conexión y probá de nuevo.',
    delete_account_btn:'Eliminar cuenta', delete_account_title:'Eliminar cuenta',
    delete_account_warning:'Esto borra tu inventario, compras, recibos y fotos para siempre — no se puede deshacer.',
    delete_account_warning_team:'Sos dueño/a de un inventario compartido — {n} persona(s) más van a perder el acceso.',
    delete_account_reauth_sub:'Por seguridad, confirmá que sos vos antes de borrar la cuenta.',
    delete_account_continue_btn:'Continuar', delete_account_confirm_btn:'Sí, eliminar mi cuenta',
    delete_account_google_reauth_btn:'Confirmar con Google',
    delete_account_success:'Tu cuenta fue eliminada.',
    privacy_policy_link:'Política de privacidad',
    welcome_title:'Bienvenido a Dusty', welcome_sub:'Así funciona, en 3 pasos:',
    welcome_step1_title:'Escaneá, y listo', welcome_step1_sub:'Sacale una foto a cualquier recibo, factura o boleta — de una compra, un proveedor, o hasta luz, agua o internet — y tu inventario se actualiza solo, al toque.',
    welcome_step2_title:'Nosotros vigilamos los números', welcome_step2_sub:'Te avisamos si un precio sube raro, si el stock se está por acabar, o si te estás por pasar del presupuesto del mes.',
    welcome_step3_title:'Mejor en equipo', welcome_step3_sub:'Compartí un código y listo: los dos ven y actualizan el mismo inventario, recibos y presupuesto, siempre sincronizado.',
    welcome_btn:'¡Listo, vamos!', welcome_next_btn:'Siguiente', welcome_back_btn:'Atrás', welcome_skip_btn:'Saltar',
    rd_scanned_on:'escaneado el', rd_applied_label:'Productos aplicados al inventario', rd_applied_to:'aplicado a:',
    rd_photo_alt:'Foto del recibo de',
    item_edit_title:'Editar producto', item_new_title:'Nuevo producto',
    item_sub:'Unidad y costo por unidad de este producto',
    btn_upload_photo:'📷 Subir foto', item_photo_helper:'Útil sobre todo para productos que no son comida — así se reconocen a simple vista.',
    btn_scan_product:'📷 Escanear producto', btn_scan_barcode:'🔲 Código de barras',
    product_scan_loading:'Identificando el producto…',
    product_scan_error:'No se pudo identificar el producto — completá los datos a mano.',
    barcode_scan_title:'Código de barras', barcode_scan_hint:'Apuntá la cámara al código de barras del producto',
    barcode_scan_camera_error:'No se pudo acceder a la cámara — revisá los permisos del navegador.',
    barcode_scan_looking:'Buscando el producto…',
    barcode_not_found:'No encontramos ese código — completá los datos a mano.',
    lbl_sale_price:'Precio de venta', lbl_profit_pct:'% de ganancia', lbl_profit_pct_short:'ganancia',
    lbl_sku:'SKU / Código', ph_sku_example:'Ej. SKU-1042', lbl_item_supplier:'Proveedor',
    lbl_name:'Nombre', ph_name_example:'Ej. Medium shrimp',
    item_name_required:'Ponele un nombre al producto para poder guardarlo.',
    lbl_unit:'Unidad', lbl_cost_unit:'Costo por unidad',
    item_helper:'Al registrar una compra o escanear un recibo, el costo se actualiza solo.',
    item_section_photo:'Foto', item_section_basic:'Datos básicos', item_section_pricing:'Precio y ganancia', item_section_ids:'Identificación y stock',
    btn_remove_photo:'Quitar foto', lbl_qty_bought:'Cantidad comprada',
    lbl_total_paid:'Precio total pagado', lbl_supplier:'Proveedor',
    ph_supplier_example:'Ej. US Foods', lbl_date:'Fecha',
    lbl_invoice_total:'Total de la factura', ph_invoice_total:'Ej. 245.90',
    invoice_total_helper:'Este es el monto que se usa para el gasto del mes — corrígelo si no coincide con el total impreso del recibo.',
    scan_title:'Escanear recibo', scan_sub:'El sistema detecta los productos y precios, tú confirmas antes de aplicar',
    scan_tap_photo:'Toca para tomar una foto', scan_upload_gallery_btn:'o subí una desde la galería',
    scan_add_gallery_btn:'+ agregar varias desde la galería',
    scan_reading:'Leyendo el recibo con IA (puede tardar unos segundos)...',
    scan_page:'Página', scan_add_page:'Agregar otra página', scan_read_btn:'Leer recibo',
    scan_mode_pages:'Un solo recibo', scan_mode_batch:'Varios recibos',
    scan_mode_pages_hint:'Las fotos se leen como páginas de un mismo recibo.',
    scan_mode_batch_hint:'Cada foto puede tener uno o varios recibos distintos (por ejemplo, tickets apoyados juntos en la mesa). Se van a cargar de a uno para que los confirmes.',
    scan_add_receipt:'Agregar otra foto',
    batch_progress:'Recibo {n} de {total}',
    btn_skip_receipt:'Saltear este', btn_save_and_next:'Guardar y seguir', btn_finish_batch:'Terminar',
    batch_done_saved:'Recibos guardados: {n}', batch_done_skipped:'Recibos que quedaron sin guardar: {n}',
    batch_done_failed:'Fotos que no se pudieron leer: {n}',
    scan_quality_dark:'Se ve oscura', scan_quality_flat:'Se ve lavada/con reflejo', scan_quality_blurry:'Se ve borrosa',
    scan_quality_hint:'Una o más fotos pueden ser difíciles de leer — podés sacarlas de nuevo (❌ y agregar otra) o leer igual y revisar bien cada producto después.',
    scan_low_confidence_hint:'Esta lectura tiene bastante incertidumbre — puede que la foto no se haya leído bien del todo. Revisá cada producto con cuidado, o cancelá y probá con otra foto más clara.',
    scan_tip_manual:'Tip: si la conexión falla en vivo, puedes registrar la compra manualmente y seguir con la demo.',
    scan_dup_confirm_label:'Sí, es una compra distinta — aplicar de todos modos',
    lbl_detected_products:'Productos detectados — confirma o corrige cada uno', ph_product_name:'Nombre del producto',
    title_remove_product:'Eliminar este producto',
    scan_unrecognized:'No reconocido en tu inventario — edita el nombre/cantidad o confirma como producto nuevo',
    scan_qty_unverified:'No se pudo confirmar la cantidad leída del recibo — revísala antes de aplicar',
    scan_qty_review:'Confianza media en esta lectura — conviene revisarla',
    scan_category_unsure:'No estamos seguros en qué categoría va — elegí una',
    price_alerts_title:'Cambios de precio recientes',
    // Notas de calendario (parser de lenguaje natural portado de Nudgy — nudgy-core.js)
    day_modal_notes_title:'Notas', day_modal_empty:'Sin recibos ni notas este día — escribí la primera abajo.',
    note_input_placeholder:'Nota nueva… ej. "pagar la luz cada mes", "proveedor el lunes 8am"',
    note_add_btn:'Agregar', note_delete_title:'Eliminar nota',
    note_prev_daily:'Todos los días', note_prev_weekly:'Cada', note_prev_yearly:'Cada año el',
    note_prev_every_n_days:'Cada {n} días', note_prev_every_month:'Cada mes', note_prev_every_n_months:'Cada {n} meses',
    note_prev_every_year:'Cada año', note_prev_every_n_years:'Cada {n} años',
    note_prev_every_hour:'Cada hora', note_prev_every_n_hours:'Cada {n} horas',
    note_prev_until:'hasta',
    activity_note_created:'agregó la nota', activity_note_deleted:'eliminó la nota',
    // Fase 2: recordatorio de pago al escanear un recibo de servicio
    scan_pay_reminder_label:'Recordarme este pago cada mes',
    scan_pay_reminder_sub:'Se marca en el calendario todos los meses, el día {d} — lo ves en la pestaña Recibos.',
    scan_pay_reminder_exists:'Ya hay un recordatorio mensual para {s} en el calendario.',
    budget_placeholder_suggested:'Ej. {n} — venís gastando {s} al mes',
    price_unit_mismatch:'unidad distinta', price_unit_mismatch_hint:'Las últimas dos compras de este producto se registraron en unidades distintas (ej. libras vs. cajas), así que no se puede comparar el precio de forma confiable.',
    price_implausible:'revisar precio', price_implausible_hint:'Este cambio es demasiado grande para ser un precio real (probablemente una cantidad o un precio mal leído en algún recibo viejo) — abrí el historial de precios de este producto para encontrar y corregir la compra con el dato raro.',
    ph_excluded_units:'{n} compra(s) en otra unidad no se incluyen acá, para no comparar precios que no son compatibles.',
    opt_add_new_ing:'+ Agregar como producto nuevo', ph_qty_short:'Cant.', ph_price_short:'Precio',
    scan_no_products_left:'No quedan productos por confirmar. El lector de texto no es perfecto — si no detectó algo, agrégalo a mano.',
    btn_add_product_manually:'+ Agregar producto a mano', btn_confirm_apply:'Confirmar y actualizar inventario',
    btn_retry_scan:'Intentar de nuevo',
    err_img_process:'No se pudo procesar la imagen', err_img_read:'No se pudo leer la imagen',
    err_scan_no_connection:'No hay conexión a internet — escanear recibos necesita estar conectado. El inventario que ya tenés guardado lo podés seguir viendo sin problema; volvé a intentar el escaneo cuando tengas señal.',
    err_no_text:'No se detectó texto en la imagen — intenta con una foto más clara y bien iluminada',
    err_generic_receipt:'Ocurrió un error leyendo el recibo',
    err_function_not_found:'No se pudo conectar con el lector de recibos — revisa que la función esté publicada en Netlify (netlify/functions/extract-receipt.js) y que tenga la API key de Anthropic configurada.',
    err_function_not_found_product:'No se pudo conectar con el identificador de productos — revisa que la función esté publicada en Netlify (netlify/functions/identify-product.js) y que tenga la API key de Anthropic configurada.',
    err_scan_auth_required:'Iniciá sesión de nuevo para escanear recibos.',
    err_scan_quota_exceeded:'Llegaste al límite de escaneos de tu plan este mes. Esperá al próximo mes o subí de plan para seguir escaneando.',
    fallback_no_product_name:'Producto sin nombre', fallback_scanned:'Escaneado', fallback_unspecified:'Sin especificar',
    storage_full_warning:'⚠ No se pudo guardar este cambio — el almacenamiento del navegador está lleno. Anda a la pestaña Recibos, abrí un recibo viejo que ya no necesites y tocá "Eliminar" para liberar espacio (las fotos son lo que más ocupa). Después volvé a intentar el cambio.',
    unit_unidad:'unidad', unit_caja:'caja', unit_servicio:'servicio',
    // Producción y salidas (recetas + escáner de estante — app-08)
    prod_section_title:'Producción',
    prod_new_recipe:'+ Nueva receta',
    prod_no_recipes:'Guardá lo que producís como recetas — al registrar una producción, los insumos se descuentan del inventario solos y ves el costo por pieza.',
    prod_cost_each:'por pieza', prod_components_n:'{n} insumo(s)',
    prod_produce_btn:'Producir', prod_outflows_link:'Salidas',
    recipe_new_title:'Nueva receta', recipe_edit_title:'Editar receta',
    recipe_sub:'Qué insumos lleva cada pieza — al producir, se descuentan solos del inventario.',
    recipe_name_label:'Nombre', recipe_name_ph:'Ej. Collar Luna',
    recipe_scan_btn:'📷 Completar con una foto de la pieza',
    recipe_scan_hint:'Sacale una foto a la pieza terminada — la IA sugiere insumos y cantidades como borrador, vos corregís y confirmás.',
    recipe_scan_loading:'Contando con cuidado…',
    recipe_scan_none:'No se reconoció ningún insumo de tu inventario en la foto.',
    recipe_scan_unmatched:'Vistos en la foto pero no están en tu inventario (no se agregaron): {list}',
    recipe_components_label:'Insumos por pieza',
    recipe_no_components_yet:'Todavía no hay insumos — agregalos a mano o empezá con una foto de la pieza.',
    recipe_add_component:'+ Agregar insumo', recipe_pick_product:'Elegí un producto', recipe_qty_ph:'Cant.',
    recipe_cost_line:'Costo por pieza',
    recipe_cost_missing:'{n} insumo(s) ya no existen en el inventario — el costo es parcial.',
    recipe_need_name:'Ponele un nombre a la receta.',
    recipe_need_components:'Agregá al menos un insumo con su cantidad.',
    recipe_delete_confirm:'¿Eliminar la receta "{name}"? El inventario y el historial no se tocan.',
    produce_title:'Registrar producción',
    produce_sub:'Cuántas piezas hiciste — el stock de cada insumo se descuenta al confirmar.',
    produce_count_label:'Piezas producidas',
    produce_deduct_header:'Se descuenta del inventario',
    produce_short_note:'Según tu stock registrado faltan {n} {u} — queda en 0. Si en físico tenías más, corregí el stock después.',
    produce_missing_note:'Este insumo ya no existe en el inventario — no se descuenta.',
    produce_batch_cost:'Costo de esta producción',
    produce_confirm_btn:'Confirmar producción',
    shelf_banner_title:'Escanear estante',
    shelf_banner_sub:'Foto de tu estante → stock al día, sin contar a mano',
    shelf_title:'Escanear estante',
    shelf_sub:'Sacá una foto del estante completo — la IA lee cantidades y niveles, vos confirmás antes de que se ajuste nada.',
    shelf_tip:'Mejor foto: todo el estante en cuadro con aire alrededor, buena luz, de frente o desde una esquina alta.',
    shelf_loading:'Contando con cuidado — puede tardar unos segundos…',
    shelf_none:'No se reconoció ningún producto en la foto — probá con más luz o más de cerca.',
    shelf_review_hint:'Revisá cada lectura y corregí lo que haga falta. Solo se ajustan las filas marcadas.',
    shelf_current:'Registrado', shelf_detected:'Leído en la foto',
    shelf_final_label:'Dejar stock en',
    shelf_conf_alta:'confianza alta', shelf_conf_media:'revisar', shelf_conf_baja:'verificá esto',
    shelf_fill_note:'~{p}% del envase', shelf_sticker_note:'con marca {c}',
    shelf_capacity_ask:'¿Cuánto es este envase lleno?',
    shelf_capacity_helper:'Se guarda en el producto — la próxima el % se convierte solo en {u}.',
    shelf_unmatched_title:'Vistos en la foto pero no están en tu inventario',
    shelf_unmatched_hint:'Agregalos primero con "Escanear productos" si querés que el estante también los ajuste.',
    shelf_apply_btn:'Ajustar {n} producto(s)',
    outflows_title:'Salidas de inventario',
    outflows_sub:'Producciones y ajustes de estante — qué bajó (o se corrigió) y cuándo.',
    outflows_empty:'Todavía no hay salidas registradas.',
    outflow_production:'Producción', outflow_adjust:'Ajuste de estante',
    activity_production:'registró la producción de {n} ×', activity_stock_adjust:'ajustó {n} producto(s) con un escaneo de estante',
    activity_recipe_created:'creó la receta', activity_recipe_edited:'editó la receta', activity_recipe_deleted:'eliminó la receta',
    capacity_label:'Capacidad del envase lleno',
    capacity_helper:'Opcional — cuánto trae el envase/frasco lleno. El escáner de estante lo usa para convertir "% de llenado" en cantidad real.',
  },
  en: {
    tab_dashboard:'Dashboard', tab_inventory:'Inventory', tab_receipts:'Receipts',
    dash_spending_of:'Spending for', dash_see_all_months:'See all months',
    dash_budget_of:'Budget:', dash_edit_budget:'Edit',
    dash_scan_receipt:'Scan receipt', price_updated:'price updated',
    stock_status_title:'Inventory status', stock_of:'of', stock_critical_alerts:'Critical alerts:',
    stock_no_data_caption:"No purchases logged yet — can't evaluate stock level",
    stock_suggested_order:'Suggested order:', stock_view_detail:'View detail',
    suggested_order_title:'Suggested order', suggested_order_sub:'Products at critical stock level and how much to order to get back to target.',
    suggested_order_empty:'No products are at a critical level right now.', suggested_order_row_note:'You have',
    cc_btn:'Cycle count', cc_title:'Cycle count', cc_sub:"Every few days, you count a slice of inventory by hand to keep the data fresh — a different set of products each time.",
    cc_due_note:"{n} product(s) are due for a count today. Fill in what you see on the shelf; anything left blank won't change.",
    cc_not_due_note:"You're all caught up. Next count is due on", cc_next_now:'today',
    cc_current:'Currently on record', cc_counted_placeholder:'Counted quantity', cc_save_btn:'Save count',
    cc_settings_title:'Count settings', cc_pct_label:'% of inventory', cc_interval_label:'Every how many days',
    cc_settings_helper:"E.g. 20% every 3 days — that way you cycle through the whole inventory in about two weeks.",
    cc_banner_text:'Tap to count {n} product(s) — cycle count',
    cc_filtered_note:'Showing only what needs counting today.', cc_show_all_link:'View full inventory',
    cc_show_pending_link:'Show only what needs counting',
    btn_export_data:'Export backup (.json)', btn_import_data:'Import backup (.json)',
    backup_section_title:'Local backup', backup_section_hint:'Save or restore a copy of your data as a file — independent from cloud sync.',
    import_invalid:'That file is not a valid Dusty backup.',
    import_confirm:'This will replace all current inventory, receipts and purchases with the ones in the file. Continue?',
    import_success:'Backup imported successfully.',
    import_blocked_team:'You are using a team\'s shared inventory. Leave the team before importing a backup, so you don\'t overwrite the team\'s data.',
    empty_inventory_title:'Empty inventory', empty_inventory_sub:'Add your first product to start tracking your inventory.',
    sync_loading_title:'Loading your inventory…', sync_loading_sub:"We're pulling your data from the cloud — this shouldn't take long.",
    dash_empty_title:'Let\'s build your inventory', dash_empty_sub:'Scan your first receipt and Dusty loads the products and prices on its own, or add one by hand if you\'d rather keep it simple.',
    dash_empty_scan_btn:'Scan receipt', dash_empty_manual_btn:'+ Add product by hand',
    empty_receipts_title:'No receipts saved yet',
    inv_title:'Inventory', inv_sub:'Your products and their current cost per unit, always up to date',
    inv_in_stock_suffix:'in stock',
    btn_new_item:'+ New product',
    th_ingredient:'Product', th_cost_unit:'Cost/unit', lbl_stock:'Quantity in stock',
    btn_edit:'Edit', btn_delete:'Delete',
    rec_title:'Receipts', rec_sub:'History of scanned or uploaded receipts — each one automatically updated your inventory',
    no_supplier_name:'Unnamed supplier', product_singular:'product', products_plural:'products',
    rec_search_placeholder:'Search by supplier or product...', rec_no_matches:'No receipts match your search.',
    rec_month_total:'Month total', btn_print:'Print', btn_share:'Share',
    btn_cal_prev:'Previous month', btn_cal_next:'Next month', day_receipts_title:'Receipts for that day',
    btn_cal_year_view:'View the whole year', btn_cal_month_view:'Back to month',
    rec_amount_search_placeholder:'Search by amount or item...',
    confirm_delete_receipt:"Delete this receipt? This will also remove the purchases it created from your history and monthly spend.",
    confirm_revert_inventory:"Also subtract from inventory the quantities this receipt added? If you already used or sold that stock, choose \"Cancel\" to leave the current quantities as they are.",
    confirm_delete_item:'Delete "{name}" from inventory?',
    ph_title_prefix:'Price history — ', ph_sub:'Cost per unit for each recorded purchase, oldest to most recent',
    ph_up:'Went up', ph_down:'Went down', ph_since_first:'since your first recorded purchase',
    ph_no_change:'No significant change since your first recorded purchase',
    ph_not_enough:'Not enough history yet — you need at least 2 purchases of this product to build the chart. So far you have',
    supplier_compare_title:'Compare suppliers', cheapest_label:'cheapest', avg_price_label:'avg.',
    supplier_compare_helper:"Based on the most recent purchase from each supplier.", ph_full_history_label:'Full history',
    btn_cancel:'Cancel', btn_close:'Close',
    ms_title:'Spending by month', ms_sub:'All months with recorded purchases, side by side',
    ms_no_purchases:'No purchases recorded yet.', ms_current_month:'current month',
    alert_title:'Price alerts', alert_sub:'Adjust when a price increase on a scanned receipt gets flagged as something that needs immediate review.',
    business_name_title:'Business name', business_name_label:'Name', business_name_placeholder:"E.g. Pedro's",
    business_name_helper:'If you fill this in, it replaces the "Inventory" title on this account. Leave it blank to change nothing. Only affects this account, never others.',
    alert_threshold_title:'Price alerts when scanning', alert_threshold_label:'Alert threshold (%)', alert_helper:"Any increase is flagged in yellow. From this % on it's flagged in red, as something that needs immediate review.",
    budget_title:'Monthly budget', budget_label:'Amount ($)', budget_placeholder:'E.g. 2000',
    budget_helper:'Repeats every month until you change it. Leave it blank to hide the budget bar.',
    btn_manage_categories:'Categories', categories_title:'Inventory categories',
    categories_sub:'Group your products however you want — Food, Household, Clothing, Maintenance, or whatever you need.',
    categories_empty:'No categories yet — the whole inventory shows as a single list.',
    categories_new_placeholder:'New category', categories_add_btn:'+ Add',
    categories_helper:'Deleting a category doesn\'t delete its products — they just stop being grouped, and move to "Uncategorized".',
    categories_uncategorized:'Uncategorized', lbl_category:'Category', category_none_option:'Uncategorized',
    inv_filtered_by_category:'Showing: {name}', btn_clear_category_filter:'View all',
    empty_category_title:'Nothing here yet', empty_category_sub:'This category has no products assigned.',
    btn_save:'Save', btn_alert_settings:'Settings',
    btn_feedback:'Report an issue',
    cloud_sync_signed_out:'Sign in to sync to the cloud',
    cloud_sync_signed_in:'Synced as {email} — tap to share or sign out',
    cloud_sync_pending:'Syncing changes with the cloud — you may not be seeing your team\'s latest yet',
    btn_login:'Log in', btn_account_cta:'Sign in',
    auth_signin_title:'Log in', auth_signup_title:'Create account',
    scan_requires_account:'Create a free account to scan receipts — that way your inventory is backed up and you can check it from any device.',
    trial_upgrade_title:'Save your account',
    trial_upgrade_sub:'With your name, email and a PIN you can sign in from any device — and everything you added so far stays exactly as it is.',
    trial_upgrade_btn:'Create my account',
    trial_save_account_cta:'Save my account',
    trial_scans_over_note:'You used up the free trial scans. Save your account and keep scanning right where you left off.',
    trial_inventory_limit_note:'You reached the trial product limit. Save your account to keep adding without that cap.',
    trial_email_in_use:'That email already has an account. Tap "Log in" below to use it.',
    pb_open_btn:'📷 Scan products',
    pb_title:'Build your inventory from one photo',
    pb_sub:'Take ONE photo with several products in view (the shelf, the table, your haul) — the AI identifies each one and you add them all at once.',
    pb_tap_photo:'Tap to take the photo',
    pb_loading:'Identifying the products in the photo…',
    pb_retry:'Try another photo',
    pb_none_found:'No products were recognized in the photo — try with more light or closer up.',
    pb_review_hint:'{n} products detected. Review each one, untick the ones you don\'t want, and fix anything before adding.',
    pb_already_in_inventory:'Already in your inventory — unticked so it isn\'t duplicated.',
    pb_low_confidence:'The AI isn\'t sure about this one — double-check the name before adding.',
    pb_cost_ph:'Cost',
    pb_add_btn:'Add {n} to inventory',
    ids_open_btn:'🔎 Identify',
    ids_title:'What product is this?',
    ids_sub:'Point the camera at the product and tap the button — we tell you what it is and whether it\'s already in your inventory.',
    ids_capture:'Identify',
    ids_use_native_camera:'📷 Use the system camera',
    ids_loading:'Identifying the product…',
    ids_found_in_inventory:'Already in your inventory',
    ids_not_in_inventory:'Not in your inventory yet',
    ids_stock:'Stock',
    ids_cost:'Cost',
    ids_scan_again:'Scan another',
    ids_open_item:'View product',
    ids_add_item:'+ Add it',
    auth_continue_google:'Continue with Google', auth_or:'or', auth_password:'Password',
    auth_forgot_password:'Forgot your password?', auth_no_account:"Don't have an account?",
    auth_have_account:'Already have an account?', auth_create_account:'Create account', auth_loading:'One moment…',
    auth_err_email_in_use:'An account with that email already exists — try logging in instead.',
    auth_err_invalid_email:"That email doesn't look valid.",
    auth_err_weak_password:'Password needs at least 6 characters.',
    auth_err_wrong_password:'Wrong email or password.',
    auth_err_user_not_found:'No account found with that email.',
    auth_err_too_many:'Too many attempts — wait a bit and try again.',
    auth_err_generic:'Something went wrong. Try again.',
    auth_err_provider_disabled:"Email sign-in isn't enabled yet — try Google, or let the admin know.",
    auth_err_need_email:'Enter your email first.',
    auth_err_need_both:'Fill in both email and password.',
    auth_reset_sent:'We sent you an email to reset your password.',
    team_title:'Share inventory', team_sign_out_btn:'Sign out',
    team_your_code_hint:'Anyone who enters this code in their own account will see and edit the same inventory as you.',
    team_your_code_label:'Your code', team_copy_btn:'Copy', team_copied:'Copied!',
    team_members_label:'People with access', team_remove_btn:'Remove',
    team_remove_confirm:"Remove this person's access? They'll stop seeing this inventory.",
    team_you_owner_label:'You (owner)', team_no_members_yet:'No one has joined with your code yet.',
    presence_active_now:'Active now', presence_last_seen:'Last seen {when}', presence_never:'Never signed in',
    team_join_label:'Did someone share a code with you?', team_join_placeholder:'CODE',
    team_join_btn:'Join',
    team_join_confirm:"You're about to start viewing {email}'s shared inventory. Whatever is saved in this account right now will no longer be shown. Continue?",
    team_viewing_shared:"You're viewing {email}'s shared inventory.",
    account_owner_hint:"You're viewing this account's shared inventory",
    btn_inventory_activity:'Changes', activity_modal_title:'Inventory activity',
    activity_empty:'No changes recorded yet.',
    activity_you:'You',
    activity_item_created:'added', activity_item_edited:'edited', activity_item_deleted:'deleted',
    activity_scan_applied:'updated {n} product(s) from a receipt',
    activity_last_edit:'Last edited: {who} — {when}',
    time_just_now:'just now', time_minutes_ago:'{n} min ago', time_hours_ago:'{n} h ago',
    time_days_ago:'{n} d ago',
    team_leave_btn:'Stop viewing this shared inventory',
    team_leave_confirm:"Stop viewing this shared inventory? You'll go back to your own account.",
    team_err_need_code:'Enter a code first.',
    team_err_not_found:"That code doesn't exist. Check it with whoever shared it with you.",
    team_err_self:'That\'s your own code — share it with someone else.',
    team_err_generic:'Something went wrong. Try again.',
    team_share_btn:'Share', team_share_msg:"I'm sharing the Dusty inventory with you — open this link and sign in with your name and a PIN:",
    team_join_title:'Join with a code', team_join_hint:"Someone shared an invite code with you. Enter your name and pick a PIN — no email needed.",
    team_pinlogin_title:'Sign in with name and PIN', team_pinlogin_hint:'If you already joined a shared inventory, sign in with the same code, your name, and your PIN.',
    team_pin_name_label:'Your name', team_pin_name_placeholder:'e.g. John',
    team_pin_label:'Pick a PIN (at least 6 characters)', team_pin_confirm_label:'Repeat the PIN',
    team_back_to_normal_login:'← Back', team_have_code_link:'Did someone share a code with you?',
    team_have_pin_link:'I already have a name and PIN',
    auth_err_need_name:'Enter your name first.', auth_err_need_pin:'Enter your PIN.',
    auth_err_pin_short:'The PIN needs to be at least 6 characters.',
    auth_err_pin_mismatch:"The two PINs don't match.",
    auth_err_name_taken:"That name is already used on Dusty — try adding your last name or something to tell it apart.",
    auth_err_pin_wrong:'Wrong name or PIN.',
    feedback_title:'Report an issue', feedback_sub:"Tell us what happened — we'll take a look as soon as we can.",
    feedback_placeholder:"E.g. When scanning a 3-page receipt, the last page didn't read correctly...",
    feedback_send:'Send', feedback_sent:"Thanks! We got your message.",
    feedback_error:"Couldn't send it — check your connection and try again.",
    delete_account_btn:'Delete account', delete_account_title:'Delete account',
    delete_account_warning:"This permanently deletes your inventory, purchases, receipts, and photos — this can't be undone.",
    delete_account_warning_team:"You own a shared inventory — {n} other person/people will lose access.",
    delete_account_reauth_sub:"For your security, confirm it's really you before deleting the account.",
    delete_account_continue_btn:'Continue', delete_account_confirm_btn:'Yes, delete my account',
    delete_account_google_reauth_btn:'Confirm with Google',
    delete_account_success:'Your account has been deleted.',
    privacy_policy_link:'Privacy policy',
    welcome_title:'Welcome to Dusty', welcome_sub:'Here\'s how it works, in 3 steps:',
    welcome_step1_title:'Scan it, and you\'re done', welcome_step1_sub:'Snap a photo of any receipt, invoice, or bill — a purchase, a supplier, even electricity, water, or internet — and your inventory updates itself, instantly.',
    welcome_step2_title:'We keep an eye on the numbers', welcome_step2_sub:'We\'ll flag a price that jumps, stock running low, or your monthly budget getting close to the edge.',
    welcome_step3_title:'Better as a team', welcome_step3_sub:'Share a code and you\'re set: you both see and update the same inventory, receipts, and budget, always in sync.',
    welcome_btn:'All set, let\'s go!', welcome_next_btn:'Next', welcome_back_btn:'Back', welcome_skip_btn:'Skip',
    rd_scanned_on:'scanned on', rd_applied_label:'Products applied to inventory', rd_applied_to:'applied to:',
    rd_photo_alt:'Receipt photo from',
    item_edit_title:'Edit product', item_new_title:'New product',
    item_sub:'Unit and cost per unit of this product',
    btn_upload_photo:'📷 Upload picture', item_photo_helper:"Especially useful for non-food products — so they're recognizable at a glance.",
    btn_scan_product:'📷 Scan product', btn_scan_barcode:'🔲 Barcode',
    product_scan_loading:'Identifying the product…',
    product_scan_error:"Couldn't identify the product — fill in the details by hand.",
    barcode_scan_title:'Barcode', barcode_scan_hint:"Point the camera at the product's barcode",
    barcode_scan_camera_error:"Couldn't access the camera — check your browser permissions.",
    barcode_scan_looking:'Looking up the product…',
    barcode_not_found:"Couldn't find that barcode — fill in the details by hand.",
    lbl_sale_price:'Sale price', lbl_profit_pct:'Profit %', lbl_profit_pct_short:'profit',
    lbl_sku:'SKU / Code', ph_sku_example:'e.g. SKU-1042', lbl_item_supplier:'Supplier',
    lbl_name:'Name', ph_name_example:'e.g. Medium shrimp',
    item_name_required:'Give the product a name so it can be saved.',
    lbl_unit:'Unit', lbl_cost_unit:'Cost per unit',
    item_helper:'When you log a purchase or scan a receipt, the cost updates automatically.',
    item_section_photo:'Photo', item_section_basic:'Basic info', item_section_pricing:'Price & profit', item_section_ids:'Identification & stock',
    btn_remove_photo:'Remove photo', lbl_qty_bought:'Quantity bought',
    lbl_total_paid:'Total price paid', lbl_supplier:'Supplier',
    ph_supplier_example:'e.g. US Foods', lbl_date:'Date',
    lbl_invoice_total:'Invoice total', ph_invoice_total:'e.g. 245.90',
    invoice_total_helper:"This is the amount used for the month's spending — correct it if it doesn't match the printed total on the receipt.",
    scan_title:'Scan receipt', scan_sub:'The system extracts the products and prices, you confirm before applying',
    scan_tap_photo:'Tap to take a photo', scan_upload_gallery_btn:'or upload one from your gallery',
    scan_add_gallery_btn:'+ add several from your gallery',
    scan_reading:'Reading the receipt with AI (this can take a few seconds)...',
    scan_page:'Page', scan_add_page:'Add another page', scan_read_btn:'Read receipt',
    scan_mode_pages:'One receipt', scan_mode_batch:'Several receipts',
    scan_mode_pages_hint:'The photos are read as pages of a single receipt.',
    scan_mode_batch_hint:'Each photo can hold one or several separate receipts (for example, tickets laid out together on the table). They will be loaded one at a time for you to confirm.',
    scan_add_receipt:'Add another photo',
    batch_progress:'Receipt {n} of {total}',
    btn_skip_receipt:'Skip this one', btn_save_and_next:'Save and continue', btn_finish_batch:'Finish',
    batch_done_saved:'Receipts saved: {n}', batch_done_skipped:'Receipts left unsaved: {n}',
    batch_done_failed:'Photos that could not be read: {n}',
    scan_quality_dark:'Looks dark', scan_quality_flat:'Looks washed out/glare', scan_quality_blurry:'Looks blurry',
    scan_quality_hint:"One or more photos may be hard to read — you can retake them (❌ and add another) or read anyway and double-check each product afterward.",
    scan_low_confidence_hint:"This reading has a lot of uncertainty — the photo may not have been fully readable. Review each product carefully, or cancel and try again with a clearer photo.",
    scan_tip_manual:"Tip: if the connection fails live, you can log the purchase manually and keep going.",
    scan_dup_confirm_label:"Yes, it's a different purchase — apply anyway",
    lbl_detected_products:'Detected products — confirm or correct each one', ph_product_name:'Product name',
    title_remove_product:'Remove this product',
    scan_unrecognized:'Not recognized in your inventory — edit the name/quantity or confirm as a new product',
    scan_qty_unverified:"Couldn't confirm the quantity read from the receipt — double-check it before applying",
    scan_qty_review:'Medium confidence on this reading — worth double-checking',
    scan_category_unsure:"We're not sure which category this goes in — pick one",
    price_alerts_title:'Recent price changes',
    // Calendar notes (natural-language parser ported from Nudgy — nudgy-core.js)
    day_modal_notes_title:'Notes', day_modal_empty:'No receipts or notes this day — write the first one below.',
    note_input_placeholder:'New note… e.g. "pay electricity every month", "supplier on monday 8am"',
    note_add_btn:'Add', note_delete_title:'Delete note',
    note_prev_daily:'Every day', note_prev_weekly:'Every', note_prev_yearly:'Every year on',
    note_prev_every_n_days:'Every {n} days', note_prev_every_month:'Every month', note_prev_every_n_months:'Every {n} months',
    note_prev_every_year:'Every year', note_prev_every_n_years:'Every {n} years',
    note_prev_every_hour:'Every hour', note_prev_every_n_hours:'Every {n} hours',
    note_prev_until:'until',
    activity_note_created:'added the note', activity_note_deleted:'deleted the note',
    // Fase 2: payment reminder when scanning a service receipt
    scan_pay_reminder_label:'Remind me of this payment every month',
    scan_pay_reminder_sub:'Marked on the calendar every month on day {d} — see it in the Receipts tab.',
    scan_pay_reminder_exists:'There is already a monthly reminder for {s} on the calendar.',
    budget_placeholder_suggested:'e.g. {n} — you spend about {s} a month',
    price_unit_mismatch:'unit changed', price_unit_mismatch_hint:"The last two purchases of this product were logged in different units (e.g. pounds vs. cases), so the price can't be compared reliably.",
    price_implausible:'check price', price_implausible_hint:"This change is too large to be a real price (probably a misread quantity or price on an old receipt) — open this product's price history to find and fix the purchase with the odd number.",
    ph_excluded_units:"{n} purchase(s) in a different unit aren't included here, to avoid comparing prices that aren't compatible.",
    opt_add_new_ing:'+ Add as new product', ph_qty_short:'Qty.', ph_price_short:'Price',
    scan_no_products_left:"No products left to confirm. The text reader isn't perfect — if it missed something, add it by hand.",
    btn_add_product_manually:'+ Add product by hand', btn_confirm_apply:'Confirm and update inventory',
    btn_retry_scan:'Try again',
    err_img_process:"Couldn't process the image", err_img_read:"Couldn't read the image",
    err_scan_no_connection:"No internet connection — scanning receipts needs you to be online. You can still see the inventory you've already saved; try scanning again once you're back on the network.",
    err_no_text:'No text detected in the image — try a clearer, better-lit photo',
    err_generic_receipt:'Something went wrong reading the receipt',
    err_function_not_found:"Couldn't connect to the receipt reader — check that the function is published on Netlify (netlify/functions/extract-receipt.js) and has the Anthropic API key configured.",
    err_function_not_found_product:"Couldn't connect to the product identifier — check that the function is published on Netlify (netlify/functions/identify-product.js) and has the Anthropic API key configured.",
    err_scan_auth_required:'Sign in again to scan receipts.',
    err_scan_quota_exceeded:"You've reached your plan's scan limit for this month. Wait until next month or upgrade your plan to keep scanning.",
    fallback_no_product_name:'Unnamed product', fallback_scanned:'Scanned', fallback_unspecified:'Unspecified',
    storage_full_warning:'⚠ This change could not be saved — your browser storage is full. Go to the Receipts tab, open an old receipt you no longer need, and tap "Delete" to free up space (photos take up the most room). Then try the change again.',
    unit_unidad:'unit', unit_caja:'case', unit_servicio:'service',
    // Production & outflows (recipes + shelf scanner — app-08)
    prod_section_title:'Production',
    prod_new_recipe:'+ New recipe',
    prod_no_recipes:'Save what you make as recipes — logging a production run deducts the supplies from inventory on its own, and shows your cost per piece.',
    prod_cost_each:'per piece', prod_components_n:'{n} supply(ies)',
    prod_produce_btn:'Produce', prod_outflows_link:'Outflows',
    recipe_new_title:'New recipe', recipe_edit_title:'Edit recipe',
    recipe_sub:'What goes into each piece — producing deducts it from inventory automatically.',
    recipe_name_label:'Name', recipe_name_ph:'E.g. Luna Necklace',
    recipe_scan_btn:'📷 Fill in from a photo of the piece',
    recipe_scan_hint:'Snap a photo of the finished piece — the AI drafts the supplies and quantities, you correct and confirm.',
    recipe_scan_loading:'Counting carefully…',
    recipe_scan_none:'None of your inventory items were recognized in the photo.',
    recipe_scan_unmatched:'Seen in the photo but not in your inventory (not added): {list}',
    recipe_components_label:'Supplies per piece',
    recipe_no_components_yet:'No supplies yet — add them by hand or start from a photo of the piece.',
    recipe_add_component:'+ Add supply', recipe_pick_product:'Pick a product', recipe_qty_ph:'Qty.',
    recipe_cost_line:'Cost per piece',
    recipe_cost_missing:'{n} supply(ies) no longer exist in inventory — the cost is partial.',
    recipe_need_name:'Give the recipe a name.',
    recipe_need_components:'Add at least one supply with its quantity.',
    recipe_delete_confirm:'Delete the recipe "{name}"? Inventory and history are not touched.',
    produce_title:'Log production',
    produce_sub:'How many pieces you made — each supply\'s stock is deducted when you confirm.',
    produce_count_label:'Pieces produced',
    produce_deduct_header:'Deducted from inventory',
    produce_short_note:'Your recorded stock is {n} {u} short — it stops at 0. If you physically had more, correct the stock afterwards.',
    produce_missing_note:'This supply no longer exists in inventory — nothing is deducted.',
    produce_batch_cost:'Cost of this run',
    produce_confirm_btn:'Confirm production',
    shelf_banner_title:'Scan shelf',
    shelf_banner_sub:'One photo of your shelf → stock up to date, no hand counting',
    shelf_title:'Scan shelf',
    shelf_sub:'Take a photo of the whole shelf — the AI reads quantities and fill levels, you confirm before anything is adjusted.',
    shelf_tip:'Best photo: the whole shelf in frame with some air around it, good light, straight on or from a high corner.',
    shelf_loading:'Counting carefully — this can take a few seconds…',
    shelf_none:'No products were recognized in the photo — try more light or closer up.',
    shelf_review_hint:'Review each reading and correct anything off. Only checked rows get adjusted.',
    shelf_current:'On record', shelf_detected:'Read from photo',
    shelf_final_label:'Set stock to',
    shelf_conf_alta:'high confidence', shelf_conf_media:'double-check', shelf_conf_baja:'verify this',
    shelf_fill_note:'~{p}% of container', shelf_sticker_note:'marked {c}',
    shelf_capacity_ask:'How much is this container when full?',
    shelf_capacity_helper:'Saved on the product — next time the % converts to {u} on its own.',
    shelf_unmatched_title:'Seen in the photo but not in your inventory',
    shelf_unmatched_hint:'Add them first with "Scan products" if you want shelf scans to adjust them too.',
    shelf_apply_btn:'Adjust {n} product(s)',
    outflows_title:'Inventory outflows',
    outflows_sub:'Production runs and shelf adjustments — what went down (or got corrected) and when.',
    outflows_empty:'No outflows recorded yet.',
    outflow_production:'Production', outflow_adjust:'Shelf adjustment',
    activity_production:'logged a production of {n} ×', activity_stock_adjust:'adjusted {n} product(s) with a shelf scan',
    activity_recipe_created:'created the recipe', activity_recipe_edited:'edited the recipe', activity_recipe_deleted:'deleted the recipe',
    capacity_label:'Full container capacity',
    capacity_helper:'Optional — how much the container/jar holds when full. The shelf scanner uses it to turn "% full" into a real quantity.',
  }
};
function t(key){ return (I18N[uiLang] && I18N[uiLang][key]) || I18N.es[key] || key; }
function unitLabel(u){ return u==='unidad' ? t('unit_unidad') : u==='caja' ? t('unit_caja') : u==='servicio' ? t('unit_servicio') : u; }

/* ================= UTILIDADES ================= */
function uid(p){return p+Math.random().toString(36).slice(2,9);}
// money, localDateStr, localMonthStr, addDaysStr, daysBetweenStr ahora viven en
// patron-core.js (cargado arriba con <script src>) — quedan disponibles igual como
// funciones globales, solo que ahora se pueden probar solas con Node.
function isCycleCountDue(){
  if(inventory.length===0) return false;
  if(!cycleCountLastDate) return true; // nunca se hizo un conteo -> toca ahora
  return daysBetweenStr(cycleCountLastDate, localDateStr()) >= cycleCountIntervalDays;
}
/* Toma el siguiente % del inventario a partir de cycleCountCursor, rotando (con wrap-around)
   para que cada conteo cíclico caiga sobre productos distintos en vez de repetir los mismos. */
function cycleCountBatch(){
  if(inventory.length===0) return [];
  const n = Math.min(inventory.length, Math.max(1, Math.round(inventory.length*(cycleCountPct/100))));
  const list = [];
  for(let i=0;i<n;i++){ list.push(inventory[(cycleCountCursor+i)%inventory.length]); }
  return list;
}
// Ids de los productos que le tocan en la tanda de conteo cíclico ACTUAL — para
// resaltarlos en pantalla (sombra roja en Inventario, parpadeo suave en Dashboard).
// Vacío si todavía no toca contar nada.
function cycleCountDueIds(){
  return isCycleCountDue() ? new Set(cycleCountBatch().map(i=>i.id)) : new Set();
}
// escapeHtml, money e isValidDateStr ahora viven en patron-core.js (con tests) — son
// la defensa central contra el XSS entre miembros de un equipo y contra que un dato mal
// tipado (un total en texto) tire render() entero. receiptImages también vive allá.
/* La foto que el usuario subió a mano para un producto (pensada para productos
   que no son comida, donde ningún ícono automático tiene sentido) — local en
   base64 mientras no haya sincronización en la nube, URL de Storage una vez que
   la fase de fotos en la nube esté lista. Devuelve null si no tiene ninguna. */
function itemPhotoSrc(item){
  if(!item || !item.photo) return null;
  if(item.photo.base64) return `data:${item.photo.mediaType||'image/jpeg'};base64,${item.photo.base64}`;
  if(item.photo.url) return item.photo.url;
  return null;
}

/* ================= PERSISTENCIA (localStorage) ================= */
const STORAGE_KEY = 'patron_data_v1';
const LEGACY_STORAGE_KEY = 'platocost_data_v1'; // nombre viejo del producto — ver loadState()
/* Evicción de fotos de recibos viejos: el base64 local se guarda "para siempre" y a
   ~135-270KB por página, la cuota de localStorage (~5MB) se llena con apenas 20-40
   recibos — el primer muro duro que choca una tienda real, y la única señal era el
   alert de espacio lleno. Regla: si el recibo tiene más de 30 días Y todas sus
   páginas ya están subidas a Storage (tienen url), el base64 se suelta —
   receiptImageSrc() cae solo a la url, así que la foto se sigue viendo (con red).
   Los recibos recientes conservan su base64 (se abren al instante y sin conexión,
   que es cuando más se consultan). Corre en cada saveState: es un escaneo barato
   de campos, no decodifica nada. */
const RECEIPT_PHOTO_LOCAL_DAYS = 30;
function evictOldReceiptPhotos(){
  const cutoff = Date.now() - RECEIPT_PHOTO_LOCAL_DAYS*24*60*60*1000;
  let evicted = false;
  receipts.forEach(r=>{
    if(!Array.isArray(r.images) || r.images.length===0) return;
    const created = r.createdAt ? new Date(r.createdAt).getTime() : NaN;
    if(!(created < cutoff)) return; // reciente (o sin fecha legible): se queda
    if(!r.images.every(img=>img && img.url)) return; // alguna página sin subir: intacto
    r.images.forEach(img=>{ if(img.base64){ delete img.base64; evicted = true; } });
  });
  return evicted;
}
function saveState(){
  let localOk = true;
  evictOldReceiptPhotos();
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      inventory, purchases, receipts, aliasMap, priceAlertThreshold,
      cycleCountPct, cycleCountIntervalDays, cycleCountLastDate, cycleCountCursor,
      deletedInventoryIds, deletedReceiptIds, deletedPurchaseIds,
      businessName, monthlyBudget, categories, calNotes, deletedCalNoteIds,
      recipes, outflows, deletedRecipeIds
    }));
  }catch(e){
    // El motivo más común es que el almacenamiento del navegador se llenó (las fotos
    // de recibos son lo que más espacio ocupa). Antes de molestar al usuario, se
    // intenta la vía de emergencia: soltar el base64 de TODA página ya subida a
    // Storage (sin esperar los 30 días de la evicción normal) y reintentar UNA vez.
    // Solo si ni así entra, se avisa — y a esa altura el aviso es genuino: hay
    // recibos con fotos sin subir (offline largo) ocupando todo el espacio.
    let retried = false;
    try{
      let freed = false;
      receipts.forEach(r=>{
        if(!Array.isArray(r.images)) return;
        r.images.forEach(img=>{ if(img && img.url && img.base64){ delete img.base64; freed = true; } });
      });
      if(freed){
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          inventory, purchases, receipts, aliasMap, priceAlertThreshold,
          cycleCountPct, cycleCountIntervalDays, cycleCountLastDate, cycleCountCursor,
          deletedInventoryIds, deletedReceiptIds, deletedPurchaseIds,
          businessName, monthlyBudget, categories, calNotes, deletedCalNoteIds,
          recipes, outflows, deletedRecipeIds
        }));
        retried = true;
      }
    }catch(e2){}
    if(!retried){
      console.warn('No se pudo guardar en localStorage (¿espacio lleno?)', e);
      alert(t('storage_full_warning'));
      localOk = false;
    }
  }
  // Clave: scheduleCloudSync() se llama AUNQUE localStorage haya fallado. Antes estaba
  // dentro del try, después del setItem — si el almacenamiento estaba lleno, el cambio no
  // solo no se guardaba local, tampoco subía a la nube (que sí tiene espacio), y se perdía
  // al cerrar la app. Ahora la nube — la vía de escape real — recibe el cambio igual.
  scheduleCloudSync();
  return localOk;
}
function applyStateData(data){
  if(Array.isArray(data.inventory)) inventory = data.inventory;
  if(Array.isArray(data.purchases)) purchases = data.purchases;
  if(Array.isArray(data.receipts)) receipts = data.receipts;
  if(data.aliasMap && typeof data.aliasMap==='object') aliasMap = data.aliasMap;
  if(typeof data.priceAlertThreshold==='number') priceAlertThreshold = data.priceAlertThreshold;
  if(typeof data.cycleCountPct==='number') cycleCountPct = data.cycleCountPct;
  if(typeof data.cycleCountIntervalDays==='number') cycleCountIntervalDays = data.cycleCountIntervalDays;
  if(typeof data.cycleCountLastDate==='string') cycleCountLastDate = data.cycleCountLastDate;
  if(typeof data.cycleCountCursor==='number') cycleCountCursor = data.cycleCountCursor;
  if(Array.isArray(data.deletedInventoryIds)) deletedInventoryIds = data.deletedInventoryIds;
  if(Array.isArray(data.deletedReceiptIds)) deletedReceiptIds = data.deletedReceiptIds;
  if(Array.isArray(data.deletedPurchaseIds)) deletedPurchaseIds = data.deletedPurchaseIds;
  if(typeof data.businessName==='string') businessName = data.businessName;
  if(data.monthlyBudget===null || typeof data.monthlyBudget==='number') monthlyBudget = data.monthlyBudget;
  if(Array.isArray(data.categories)) categories = data.categories;
  // Las lápidas de notas se aplican ANTES de las notas: un snapshot de la nube que
  // todavía traiga una nota borrada en este dispositivo llega ya filtrado.
  if(Array.isArray(data.deletedCalNoteIds)) deletedCalNoteIds = data.deletedCalNoteIds;
  if(Array.isArray(data.calNotes)) calNotes = data.calNotes.filter(n=>n && n.id && !deletedCalNoteIds.includes(n.id));
  // Recetas y salidas (app-08) — mismas reglas que las notas: lápidas primero, y un
  // snapshot que todavía traiga una receta borrada acá llega ya filtrado.
  if(Array.isArray(data.deletedRecipeIds)) deletedRecipeIds = data.deletedRecipeIds;
  if(Array.isArray(data.recipes)){
    // Mismo criterio que las fotos de recibos: si ESTE dispositivo ya tiene el
    // base64 de la foto (la sacó él), lo conserva al aplicar el snapshot — la nube
    // manda solo referencias {url,...} (ver recipesForCloud) y sin este merge cada
    // snapshot le arrancaría el base64 local y la foto pasaría a depender de la red.
    const localRecipePhotos = {};
    recipes.forEach(r=>{ if(r && r.id && r.photo && r.photo.base64) localRecipePhotos[r.id] = r.photo; });
    recipes = data.recipes.filter(r=>r && r.id && !deletedRecipeIds.includes(r.id)).map(r=>{
      const localPhoto = localRecipePhotos[r.id];
      if(localPhoto && (!r.photo || !r.photo.base64)){
        return Object.assign({}, r, { photo: Object.assign({}, localPhoto, r.photo || {}) });
      }
      return r;
    });
  }
  if(Array.isArray(data.outflows)) outflows = data.outflows.filter(o=>o && o.id).slice(0, OUTFLOWS_MAX);
}
function loadState(){
  try{
    // Si ya existe la clave nueva, listo — ya se migró en una carga anterior. Si no,
    // se lee la vieja (de cuando la app se llamaba PlatoCost) UNA sola vez y se
    // reescribe bajo el nombre nuevo, para no resetear el inventario de nadie que
    // ya la tenía instalada solo por el rename.
    let raw = localStorage.getItem(STORAGE_KEY);
    if(!raw){
      raw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if(raw){
        localStorage.setItem(STORAGE_KEY, raw);
        localStorage.removeItem(LEGACY_STORAGE_KEY);
      }
    }
    if(!raw) return;
    applyStateData(JSON.parse(raw));
  }catch(e){
    console.warn('No se pudo leer localStorage', e);
  }
}
/* Respaldo manual: exporta todo el estado a un .json descargable, e importa uno
   de vuelta. Es la única forma de no perder todo si el localStorage se llena
   (las fotos de recibos en base64 pesan) o si el usuario cambia de dispositivo. */
function exportData(){
  const payload = {
    inventory, purchases, receipts, aliasMap, priceAlertThreshold,
    cycleCountPct, cycleCountIntervalDays, cycleCountLastDate, cycleCountCursor,
    businessName, monthlyBudget, categories, calNotes, deletedCalNoteIds,
    recipes, outflows, deletedRecipeIds,
    exportedAt: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `patron-backup-${localDateStr()}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
/* Camino más simple para reportar un problema: abre el cliente de correo del
   usuario con un mail pre-armado. No manda nada solo ni guarda nada — el usuario
   decide si lo envía. Cuando haya cuentas reales, esto se puede reemplazar por
   un formulario que guarde el reporte en la base de datos. */
function openFeedbackEmail(){
  const subject = encodeURIComponent(uiLang==='en' ? 'Dusty — Issue report' : 'Dusty — Reporte de un problema');
  const body = encodeURIComponent(
    (uiLang==='en' ? 'Describe what happened:\n\n\n' : 'Describí qué pasó:\n\n\n') +
    '---\n' + navigator.userAgent
  );
  window.location.href = `mailto:sergioleon47@hotmail.com?subject=${subject}&body=${body}`;
}
function importData(file){
  const reader = new FileReader();
  reader.onload = ()=>{
    let data;
    try{ data = JSON.parse(reader.result); }
    catch(e){ alert(t('import_invalid')); return; }
    if(!data || !Array.isArray(data.inventory) || !Array.isArray(data.receipts)){ alert(t('import_invalid')); return; }
    // Importar mientras estás dentro del inventario de un equipo escribiría este backup
    // PERSONAL sobre el árbol del dueño y borraría (por diff) todo lo del equipo que no
    // esté en el backup — un miembro podía aniquilar el inventario compartido con un
    // import. Se bloquea con un aviso claro en vez de arriesgarlo.
    if(joinedOwnerUid){ alert(t('import_blocked_team')); return; }
    // Validación de forma: cada producto/recibo/compra debe ser un objeto con id. Un solo
    // elemento inválido (null, o sin id) rompía el render o el sync (doc(undefined)).
    const validItems = (arr)=> Array.isArray(arr) && arr.every(x=>x && typeof x==='object' && typeof x.id==='string');
    if(!validItems(data.inventory) || !validItems(data.receipts) || (data.purchases!==undefined && !validItems(data.purchases))){
      alert(t('import_invalid')); return;
    }
    if(!confirm(t('import_confirm'))) return;
    applyStateData(data);
    // El backup es la fuente de verdad de lo que existe: si algún producto/recibo/compra
    // del backup tenía lápida de una sesión anterior, se le quita (el usuario lo está
    // restaurando a propósito) — sin esto, reaparecía un instante y el sync lo borraba solo.
    const restoredInv = new Set(data.inventory.map(i=>i.id));
    const restoredRec = new Set(data.receipts.map(r=>r.id));
    const restoredPur = new Set((data.purchases||[]).map(p=>p.id));
    deletedInventoryIds = deletedInventoryIds.filter(id=>!restoredInv.has(id));
    deletedReceiptIds = deletedReceiptIds.filter(id=>!restoredRec.has(id));
    deletedPurchaseIds = deletedPurchaseIds.filter(id=>!restoredPur.has(id));
    const restoredRecipes = new Set((data.recipes||[]).map(r=>r.id));
    deletedRecipeIds = deletedRecipeIds.filter(id=>!restoredRecipes.has(id));
    saveState();
    render();
    alert(t('import_success'));
  };
  reader.onerror = ()=> alert(t('import_invalid'));
  reader.readAsText(file);
}
// monthKey, MONTH_NAMES, monthLabel, WEEKDAY_NAMES, shiftMonthStr y lastPriceChangePct
// ahora viven en patron-core.js.
function priceChangeBadge(pct){
  if(pct===null) return '';
  if(pct==='unit-mismatch') return `<span style="color:var(--ink-soft);font-size:11px;font-weight:700;margin-left:6px;white-space:nowrap;" title="${t('price_unit_mismatch_hint')}">⚠ ${t('price_unit_mismatch')}</span>`;
  // Un precio de proveedor real casi nunca salta más de ~300% de una compra a la
  // siguiente — cuando lastPriceChangePct() da eso, es mucho más probable que sea
  // una cantidad o un precio mal leído en algún recibo viejo (una coma decimal
  // corrida, un "1" leído donde decía "100") que un cambio de precio de verdad.
  // Mostrar "14141%" como si fuera un hecho es peor que no mostrar nada: se marca
  // como algo para revisar a mano en vez de repetir un número que casi seguro está mal.
  if(Math.abs(pct)>300) return `<span style="color:var(--saffron-ink);font-size:11px;font-weight:700;margin-left:6px;white-space:nowrap;" title="${t('price_implausible_hint')}">⚠ ${t('price_implausible')}</span>`;
  const up = pct>0.5, down = pct<-0.5;
  const color = up?'var(--tomato)':down?'var(--basil)':'var(--ink-soft)';
  const arrow = up?'▲':down?'▼':'→';
  return `<span style="color:${color};font-size:11px;font-weight:700;margin-left:6px;white-space:nowrap;">${arrow} ${Math.abs(pct).toFixed(0)}%</span>`;
}
/* Cambios de precio notables, para mostrar en el dashboard sin que el usuario tenga
   que estar escaneando un recibo en ese momento — un umbral más chico que
   priceAlertThreshold (que es el que dispara la alerta fuerte al escanear), porque
   acá es solo un resumen informativo, no una confirmación bloqueante. */
function recentPriceAlerts(){
  return inventory
    .map(i=>({ing:i, pct:lastPriceChangePct(i.id, purchases)}))
    .filter(x=>x.pct!==null && Math.abs(x.pct)>5)
    .sort((a,b)=>Math.abs(b.pct)-Math.abs(a.pct))
    .slice(0,5);
}
function priceAlertsCard(){
  const alerts = recentPriceAlerts();
  if(alerts.length===0) return '';
  return `
  <div class="stock-card">
    <h3 class="stock-card-title">${t('price_alerts_title')}</h3>
    ${alerts.map(a=>`
      <div data-history-item="${a.ing.id}" style="display:flex;align-items:center;justify-content:space-between;padding:8px 2px;border-bottom:1px solid var(--line);cursor:pointer;">
        <span style="font-size:13px;color:var(--ink);">${escapeHtml(a.ing.name)}</span>
        <span style="display:flex;align-items:center;gap:4px;">${priceChangeBadge(a.pct)}<span style="color:var(--ink-soft);font-size:12px;">›</span></span>
      </div>
    `).join('')}
  </div>`;
}
function allMonths(){
  const set = new Set(receipts.map(r=>monthKey(r.date)));
  return [...set].sort().reverse();
}
/* El gasto del mes se arma solo con el monto real de cada recibo escaneado (no
   la suma de los productos que el OCR logró emparejar, que puede quedar corta
   si algo no se leyó bien). Por ahora el gasto se basa 100% en recibos. */
function spendForMonth(key){
  return receipts.filter(r=>monthKey(r.date)===key).reduce((s,r)=>s+(r.total||0),0);
}

/* La unidad con la que este negocio REALMENTE trabaja: la más repetida en su
   inventario. Un abarrotes que carga todo por "unidad" no debería ver "lb"
   preseleccionado en cada producto nuevo (y viceversa para una cocina que pesa
   todo). Con inventario vacío se usa el fallback que se pida — el alta manual
   mantiene 'lb' (el default histórico) y la fila manual del escaneo 'unidad'. */
function mostUsedInventoryUnit(fallback){
  const counts = {};
  inventory.forEach(i=>{ if(i.unit) counts[i.unit] = (counts[i.unit]||0)+1; });
  let best = fallback, n = 0;
  Object.keys(counts).forEach(u=>{ if(counts[u]>n){ n = counts[u]; best = u; } });
  return best;
}

/* ---------- Notas de calendario (Fase 1 Nudgy — el parser vive en nudgy-core.js) ---------- */
function calNoteTimeStr(h, mnt){
  if(h==null) return '';
  const suffix = h>=12 ? 'pm' : 'am';
  let h12 = h%12; if(h12===0) h12 = 12;
  return h12 + ':' + String(mnt||0).padStart(2,'0') + ' ' + suffix;
}
// Nombres cortos de día para "cada lun, mié" — los WEEKDAY_NAMES de patron-core son
// de UNA letra (cabecera del calendario) y "cada L, M" no se entiende.
const CAL_NOTE_WEEKDAYS = { es:['dom','lun','mar','mié','jue','vie','sáb'], en:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'] };
/* Descripción corta de CUÁNDO cae una nota ("Cada mes", "Cada lun, jue, 8:00 am",
   "15 Oct, 3:30 pm"). La vista previa en vivo del compositor y la línea gris bajo
   cada nota guardada usan esta MISMA función — así nunca cuentan historias
   distintas antes y después de guardar. */
function calNoteWhenText(n){
  const time = calNoteTimeStr(n.hour, n.minute);
  if(n.recurring){
    const r = n.recurring;
    let base = '';
    if(r.type==='daily') base = t('note_prev_daily');
    else if(r.type==='weekly') base = t('note_prev_weekly')+' '+r.weekdays.map(w=>CAL_NOTE_WEEKDAYS[uiLang][w]).join(', ');
    else if(r.type==='yearly') base = t('note_prev_yearly')+' '+r.day+' '+MONTH_NAMES[uiLang][r.month];
    else if(r.type==='everyNDays') base = t('note_prev_every_n_days').replace('{n}', r.n);
    else if(r.type==='everyNMonths') base = r.n===1 ? t('note_prev_every_month') : t('note_prev_every_n_months').replace('{n}', r.n);
    else if(r.type==='everyNYears') base = r.n===1 ? t('note_prev_every_year') : t('note_prev_every_n_years').replace('{n}', r.n);
    else if(r.type==='everyNHours') base = r.n===1 ? t('note_prev_every_hour') : t('note_prev_every_n_hours').replace('{n}', r.n);
    if(!base) return '';
    if(time) base += ', '+time;
    if(r.until){
      const u = new Date(r.until);
      base += ' ('+t('note_prev_until')+' '+u.getDate()+' '+MONTH_NAMES[uiLang][u.getMonth()]+')';
    }
    if(r.untilHour!=null) base += ' ('+t('note_prev_until')+' '+calNoteTimeStr(r.untilHour, r.untilMinute||0)+')';
    return base;
  }
  if(n.date){
    const d = calDateFromStr(n.date);
    let base = d.getDate()+' '+MONTH_NAMES[uiLang][d.getMonth()];
    if(d.getFullYear()!==new Date().getFullYear()) base += ' '+d.getFullYear();
    if(time) base += ', '+time;
    return base;
  }
  return time;
}
// Vista previa en vivo del compositor: qué entendió el parser del texto a medio
// escribir, ANTES de guardar — la idea estrella de Nudgy, intacta.
function calNotePreviewText(raw){
  if(!raw || !raw.trim()) return '';
  let built;
  try{ built = buildCalNote(raw, showDayModal); }catch(e){ return ''; }
  // Si lo único que se entendió es "queda anclada al día abierto", no hay nada
  // nuevo que anunciar — la vista previa solo aparece cuando el parser detectó algo.
  if(!built.recurring && built.date===showDayModal && built.hour==null) return '';
  return calNoteWhenText(built);
}

