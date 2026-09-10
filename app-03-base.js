/* ================= IDIOMA (ES/EN) =================
   El idioma solo afecta los textos de la interfaz (botones, títulos, ayudas).
   Los nombres/categorías de productos que el usuario ingresa NUNCA se traducen —
   siempre quedan en inglés, para que el emparejamiento con el texto del OCR de
   recibos no se confunda entre idiomas. */
let uiLang = 'en'; // inglés es el idioma principal de la app; español el secundario
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
  // Inglés por defecto: solo un navegador/celular configurado en español arranca en
  // español — cualquier otro idioma del mundo cae en inglés (antes era al revés).
  uiLang = savedLang || (navigator.language && navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en');
}catch(e){}
function setLang(l){
  uiLang = l;
  try{ localStorage.setItem('patron_lang', l); }catch(e){}
  render();
}
// Formato regional de montos (auditoría de presupuesto 2026-09-07): preferencia del
// dispositivo, como el idioma. Sin preferencia: '$1.000,00' si el celular está en
// español (salvo México, que usa coma), '$1,000.00' en inglés, y lo de siempre si no.
let moneyFormatPref = 'plain';
try{
  const savedFmt = localStorage.getItem('patron_money_format');
  if(savedFmt){ moneyFormatPref = savedFmt; }
  else{
    const nl = (navigator.language||'').toLowerCase();
    moneyFormatPref = nl.startsWith('es') ? (nl==='es-mx' || nl==='es-us' ? 'us' : 'latam') : (nl.startsWith('en') ? 'us' : 'plain');
  }
  setMoneyStyle(moneyFormatPref);
}catch(e){}
function setMoneyFormatPref(f){
  moneyFormatPref = (f==='us' || f==='latam') ? f : 'plain';
  setMoneyStyle(moneyFormatPref);
  try{ localStorage.setItem('patron_money_format', moneyFormatPref); }catch(e){}
}
const I18N = {
  es: {
    tab_dashboard:'Dashboard', tab_inventory:'Inventario', tab_receipts:'Recibos',
    tab_production:'Producción',
    prod_tab_label:'Fabrico mis productos',
    prod_tab_helper:'Prende la pestaña Producción abajo. Si la apagas, ahí vuelven los Recibos — el calendario del Dashboard te lleva igual.',
    dash_see_all_months:'Ver todos los meses',
    dash_budget_of:'Presupuesto:', dash_edit_budget:'Editar',
    dash_scan_receipt:'Escanear recibo', price_updated:'precio actualizado',
    stock_of:'de', stock_critical_alerts:'Alertas críticas:',
    stock_suggested_order:'Pedido sugerido:', stock_view_detail:'Ver detalle',
    suggested_order_title:'Pedido sugerido', suggested_order_sub:'Productos en nivel crítico y cuánto haría falta pedir para volver al objetivo.',
    suggested_order_empty:'Por ahora ningún producto está en nivel crítico.', suggested_order_row_note:'Tienes',
    suggested_order_ghost_note:'Así se va a ver cuando algún producto llegue a nivel crítico:',
    /* Nombres de ejemplo de las filas borrosas: productos comunes, cortos, que se
       entienden en cualquier rubro. No son datos del usuario. */
    so_ex1:'Arroz', so_ex2:'Aceite', so_ex3:'Servilletas',
    cc_btn:'Conteo cíclico', cc_title:'Conteo cíclico', cc_sub:'Cada cierto número de días, cuentas a mano una parte del inventario para mantener los datos al día — cada vez le toca a productos distintos.',
    cc_due_note:'Toca contar {n} producto(s) hoy. Anota lo que ves en el estante; lo que dejes en blanco no se modifica.',
    cc_not_due_note:'Ya estás al día. El próximo conteo te toca el', cc_next_now:'hoy',
    cc_current:'Tienes registrado', cc_counted_placeholder:'Cantidad contada', cc_save_btn:'Guardar conteo',
    cc_settings_title:'Configuración del conteo', cc_pct_label:'% del inventario', cc_interval_label:'Cada cuántos días',
    cc_settings_helper:'Por ejemplo, 20% cada 3 días — así en unas dos semanas ya pasaste por todo el inventario.',
    share_account_btn:'🔗 Compartir cuenta',
    dash_team_title:'Equipo', dash_team_sub:'Comparte con tu empleado',
    settings_inventory_title:'Inventario',
    budget_exp_title:'Gastos y servicios',
    budget_exp_note:'Estas categorías no aparecen en el inventario: son gasto (luz, agua, consumos), no mercadería. Toca una para editarla.',
    budget_exp_uncat:'Servicios',
    budget_spent_line:'Gastado este mes: {amount}',
    srv_pro_not_configured:'La función Pro no está activada todavía en el servidor',
    srv_needs_account:'Quitar fondo necesita una cuenta guardada',
    budget_spent_no_bills_note:'Ese monto viene de tus recibos del mes (pestaña Recibos) — las filas de abajo son solo un ejemplo de cómo se ve esta lista.',
    budget_exp_example_tag:'ejemplo',
    budget_exp_empty_note:'Así se va a ver: escanea una boleta (luz, agua, internet) o un consumo Eat out y aparecen acá solos — o agrega uno a mano con el botón.',
    budget_exp_add_btn:'+ Servicio',
    budget_exp_scan_btn:'📷 Escanear boleta',
    lbl_bill_amount:'Monto ($)',
    expense_register_payment:'Registrar el pago de este mes',
    expense_register_payment_hint:'Crea el gasto del mes ya mismo (mueve el presupuesto). Desmárcalo si después vas a escanear la boleta, para no contarlo dos veces.',
    expense_payment_logged:'Pago de {name} registrado en el mes ✓',
    expense_pay_btn:'Registrar el pago de este mes',
    expense_paid_tag:'Pagado este mes',
    expense_pay_no_amount:'Este gasto no tiene monto — ábrelo y ponle uno primero.',
    expense_item_note:'Gasto del negocio: no se vende ni lleva stock — vive en el botón de Presupuesto.',
    account_btn:'👤 Cuenta', account_title:'Cuenta',
    btn_export_data:'Exportar respaldo (.json)', btn_import_data:'Importar respaldo (.json)',
    backup_section_title:'Respaldo local', backup_section_hint:'Guarda o restaura una copia de tus datos en un archivo — independiente de la sincronización en la nube.',
    import_invalid:'Ese archivo no es un respaldo válido de Dusty.',
    import_confirm:'Esto va a reemplazar todo el inventario, recibos y compras actuales con los del archivo. ¿Continuar?',
    import_success:'Respaldo importado correctamente.',
    import_blocked_team:'Estás usando el inventario compartido de un equipo. Sal del equipo antes de importar un respaldo, para no sobrescribir los datos del equipo.',
    empty_inventory_title:'Inventario vacío', empty_inventory_sub:'Agrega tu primer producto para empezar a llevar tu inventario.',
    sync_loading_title:'Cargando tu inventario…', sync_loading_sub:'Estamos trayendo tus datos desde la nube — no debería tardar mucho.',
    dash_empty_title:'Vamos a armar tu inventario', dash_empty_sub:'Escanea tu primer recibo y Dusty carga los productos y precios solo, o agrega uno a mano si prefieres empezar simple.',
    dash_empty_scan_btn:'Escanear recibo', dash_empty_manual_btn:'+ Agregar producto a mano',
    empty_receipts_title:'Aún no hay recibos guardados',
    inv_in_stock_suffix:'en stock',
    th_ingredient:'Producto', th_cost_unit:'Costo/unidad', lbl_stock:'Cantidad en stock',
    btn_edit:'Editar', btn_delete:'Eliminar',
    no_supplier_name:'Proveedor sin nombre', product_singular:'producto', products_plural:'productos',
    rec_search_placeholder:'Buscar por proveedor o producto...', rec_no_matches:'Ningún recibo coincide con la búsqueda.',
    rec_month_total:'Total del mes', btn_print:'Imprimir', btn_share:'Enviar',
    btn_cal_prev:'Mes anterior', btn_cal_next:'Mes siguiente',
    btn_cal_year_view:'Ver todo el año', btn_cal_month_view:'Volver al mes',
    rec_amount_search_placeholder:'Buscar por monto o producto...',
    confirm_delete_bill_payments:'Este gasto tiene {n} pago(s) registrado(s) este mes por {total}. ¿Borrarlos también?\n\nSi eliges que no, ese dinero sigue contando en el presupuesto del mes — es un gasto que ya ocurrió. Los pagos de meses anteriores no se tocan.',
    confirm_delete_receipt:'¿Eliminar este recibo? También se van a quitar las compras que generó del historial y del gasto mensual.',
    confirm_revert_inventory:'¿También quieres restar del inventario las cantidades que agregó este recibo? Si ya usaste o vendiste ese stock, elige "Cancelar" para dejar las cantidades actuales como están.',
    /* Qué se restó al borrar (reporte del usuario: "borré todos los recibos y el
       Valor no bajó"). El borrado no decía nada, así que un número que no se
       movía se leía como una falla de la app aunque fuera lo correcto. */
    receipt_deleted_spend:'Recibo borrado · −{amount} en {month}',
    receipt_deleted_stock:'−{qty} restadas del inventario',
    receipt_deleted_stock_kept:'las cantidades del inventario quedaron como estaban',
    confirm_delete_item:'¿Eliminar "{name}" del inventario?',
    ph_title_prefix:'Historial de precio — ', ph_sub:'Costo por unidad en cada compra registrada, de más vieja a más reciente',
    ph_up:'Subió', ph_down:'Bajó', ph_since_first:'desde tu primera compra registrada',
    ph_no_change:'Sin cambios importantes desde tu primera compra registrada',
    ph_not_enough:'Todavía no hay suficiente historial — se necesitan al menos 2 compras de este producto para armar la gráfica. Por ahora tienes',
    supplier_compare_title:'Comparar proveedores', cheapest_label:'más barato', avg_price_label:'prom.',
    supplier_compare_helper:'Según el precio de la última compra a cada proveedor.', ph_full_history_label:'Historial completo',
    btn_cancel:'Cancelar', btn_close:'Cerrar',
    settings_title:'Ajustes', settings_sub:'Cada cambio se aplica al instante.',
    settings_appearance_title:'Apariencia', settings_alerts_title:'Alertas',
    settings_account_title:'Cuenta', settings_device_note:'El tema, los latidos, el idioma y el formato se guardan en este dispositivo.',
    ms_title:'Gasto por mes', ms_sub:'Cuánto gastaste cada mes, comparado con tu presupuesto',
    ms_no_purchases:'Todavía no hay compras registradas.', ms_current_month:'este mes',
    alert_threshold_label:'Umbral de alerta (%)', alert_helper:'Cualquier aumento se marca en amarillo. A partir de este % se marca en rojo, como algo que requiere revisión inmediata.',
    budget_title:'Presupuesto mensual', budget_label:'Monto ($)', budget_placeholder:'Ej. 2000',
    budget_helper:'Se repite todos los meses hasta que lo cambies. Déjalo vacío para no mostrar la barra de presupuesto.',
    /* Presupuesto con ritmo, avisos e historial (auditoría 2026-09-07). */
    budget_set_cta:'Fíjalo →',
    budget_line:'Gastos {spent} de {budget}', budget_left:'Quedan {amount}', budget_over:'Excedido por {amount}',
    budget_pace_fast:'⚡ Vas rápido: a este ritmo cierras en {proj}', budget_pace_ok:'A este ritmo cierras en {proj}', budget_pace_over:'🔴 Ya pasaste el presupuesto del mes',
    budget_pace_today:'Hoy deberías ir por {amount}',
    budget_committed:'con {amount} por pagar ({names})',
    budget_alert_warn_title:'Vas por el {pct}% del presupuesto', budget_alert_warn_sub:'Quedan {left} para el resto del mes. Toca para ver los gastos.',
    budget_alert_fast_title:'⚡ Vas más rápido que el presupuesto',
    budget_carry_note:'incluye {amount} que sobró de {month}',
    budget_rollover_label:'Arrastrar lo que sobra al mes siguiente', budget_rollover_helper:'Si un mes gastas menos, la diferencia se suma al presupuesto del mes que viene (como mucho, se duplica).',
    budget_caps_title:'Topes por categoría', budget_caps_helper:'Opcional: un máximo por rubro. La barra de cada categoría se pinta contra su tope.',
    budget_cap_of:'de {cap}',
    budget_open_recap:'💲 Ver cierre de mes',
    budget_cogs_line:'Costo de mercadería: {p}% de las ventas · objetivo {t}%',
    money_format_label:'Formato de montos',
    budget_alert_fast_sub:'A este ritmo cierras en {proj}. Toca para ver los gastos.',
    budget_alert_over_title:'Te pasaste del presupuesto', budget_alert_over_sub:'Excedido por {amount}. Toca para revisar los gastos.',
    budget_toast_warn:'🟡 Ojo: vas por el {pct}% del presupuesto. Quedan {left}.', budget_toast_over:'🔴 Te pasaste del presupuesto por {amount}.',
    budget_alert_pct_label:'Aviso de presupuesto (%)', budget_alert_pct_helper:'Te avisamos una vez al cruzar este % del presupuesto del mes, y otra al pasarte.',
    budget_locked_note:'El presupuesto lo define el dueño de la cuenta. Tú puedes registrar gastos.',
    budget_history_note:'Los meses cerrados conservan el presupuesto que tenían.',
    budget_bycat_title:'Gastado este mes por categoría',
    budget_cogs_label:'Objetivo de costo sobre ventas (%)', budget_cogs_helper:'Opcional, para gastronomía: cuánto de lo vendido debería irse en mercadería (entre 28 y 35% es lo normal). Se compara en el Cierre de mes.',
    recap_cogs_ratio:'{p}% de las ventas · objetivo {t}%', recap_under_budget:'🎉 Cerraste bajo presupuesto',
    /* Una tarjeta por mes, en frases (rediseño 2026-09-09): el gráfico apilado con
       eje de montos, línea punteada y leyenda de tres colores pedía leer un gráfico
       para saber algo tan simple como "cuánto gasté y cuánto me quedaba". */
    ms_line_now:'Llevas {exp} de {bud}. Te quedan {left}.',
    ms_line_past:'Gastaste {exp} de {bud}. Te quedaron {left}.',
    ms_line_over:'Gastaste {exp} y tu tope era {bud}. Te pasaste por {over}.',
    ms_line_nb:'Gastaste {exp}. Ese mes no tenías un tope puesto.',
    ms_line_nb_now:'Llevas {exp}. Todavía no pusiste un tope para este mes.',
    ms_card_goods:'Además compraste {inv} de mercadería (eso no es gasto: queda como stock).',
    ms_ghost_note:'Así se van a ver tus meses anteriores cuando tengas gastos registrados:',
    cal_month_receipts:'{n} recibos en este mes',
    manual_spend_category:'Categoría (opcional)',
    spend_future_date_confirm:'La fecha es futura. ¿Guardar igual?', spend_future_date_note:'Ojo: esa fecha es futura — el gasto va a caer en un mes que todavía no empezó.',
    btn_manage_categories:'Categorías', categories_title:'Categorías de inventario',
    categories_sub:'Agrupa tus productos como quieras — Comida, Hogar, Ropa, Mantenimiento, o las que necesites.',
    categories_empty:'No tienes categorías — todo el inventario aparece en una sola lista.',
    categories_new_placeholder:'Nueva categoría', categories_add_btn:'+ Agregar',
    categories_helper:'Borrar una categoría no borra sus productos — solo dejan de estar agrupados, y pasan a "Sin categoría".',
    categories_uncategorized:'Sin categoría', lbl_category:'Categoría', category_none_option:'Sin categoría',
    btn_save:'Guardar', btn_alert_settings:'Configuración',
    /* Auditoría de primer minuto 2026-09-07: el "?" abre AYUDA (las preguntas del
       primer día) y el reporte de problemas vive al pie de esa hoja. */
    help_title:'¿Cómo funciona Dusty?', help_sub:'Las preguntas del primer día, respondidas cortito.',
    help_q1:'¿Qué puedo escanear?', help_a1:'Recibos y facturas de compras, boletas de luz, agua o internet, productos sueltos (foto o código de barras) y el estante entero para contar stock. Todo sale del botón de la cámara.',
    help_q2:'¿Se guarda sin cuenta?', help_a2:'Sí. Todo queda en este teléfono desde el primer segundo. Cuando quieras verlo en otro dispositivo, toca Guardar mi cuenta: nombre, email y un PIN, y no se pierde nada.',
    help_q3:'¿Cómo comparto con mi socio?', help_a3:'Desde Compartir cuenta en el tablero: le mandas un link y los dos ven y actualizan el mismo inventario, recibos y presupuesto.',
    help_q4:'¿Y si me equivoco?', help_a4:'Antes de guardar un recibo revisas y corriges cada línea. Y cualquier producto o recibo se edita o se borra tocándolo.',
    help_report_btn:'Reportar un problema',
    /* Primeros pasos en el tablero vacío (efecto de progreso dotado: el primero ya
       viene tildado) y festejo del primer escaneo. */
    first_steps_title:'Primeros pasos', first_step_lang:'Elegiste tu idioma', first_step_scan:'Escanea tu primer recibo', first_step_budget:'Fija un presupuesto mensual',
    first_scan_toast_one:'¡Listo! 1 producto cargado desde tu primer recibo.', first_scan_toast_many:'¡Listo! {n} productos cargados desde tu primer recibo.',
    trial_scans_left:'Te quedan {n} escaneos gratis.', trial_scans_last:'Te queda 1 escaneo gratis.',
    save_account_hint_toast:'Tus datos ya viven en este teléfono. Para verlos en otro, toca ☁ Guardar arriba.',
    trial_save_short:'Guardar',
    /* Alta rápida: nombre, costo y cantidad; el resto plegado. */
    item_quick_sub:'Con el nombre y el costo alcanza para empezar.', item_quick_more_btn:'Más detalles', item_quick_more_hint:'foto, categoría, precio de venta, SKU',
    team_intro_btn:'Entendido, compartir',
    welcome_go_dashboard:'Ver el tablero primero',
    cloud_sync_signed_out:'Iniciar sesión para sincronizar en la nube',
    cloud_sync_signed_in:'✓ Sincronizado como {email}',
    cloud_sync_pending:'Sincronizando cambios con la nube — todavía puede faltar ver lo último de tu equipo',
    export_working:'Armando el respaldo…',
    export_done:'Respaldo descargado',
    btn_undo:'Deshacer',
    inv_restored_n:'{n} producto(s) restaurado(s)',
    inv_no_match_search:'Ningún producto coincide con “{q}”',
    inv_clear_search:'Borrar la búsqueda',
    inv_filter_none_crit:'Ningún producto está en crítico. Todo tu stock está por encima del mínimo.',
    inv_filter_none_count:'No toca contar nada hoy.',
    inv_filter_none_nophoto:'Todos tus productos ya tienen foto.',
    inv_clear_filter:'Ver todos los productos',
    cloud_sync_offline:'Sin conexión — todo lo que hagas se guarda en este teléfono y sube solo al volver la señal',
    cloud_sync_failed:'No se pudo guardar en la nube — tus datos están en este teléfono. Tocá para reintentar',
    cloud_sync_failed_retry:'Reintentando guardar en la nube… Tus datos siguen a salvo en este teléfono',
    offline_bar:'Sin conexión · todo se guarda en este teléfono',
    btn_login:'Iniciar sesión', btn_account_cta:'Entrar',
    auth_signin_title:'Iniciar sesión', auth_signup_title:'Crear cuenta',
    scan_requires_account:'Crea una cuenta gratis para escanear recibos — así tu inventario queda respaldado y puedes verlo desde cualquier dispositivo.',
    trial_upgrade_title:'Guarda tu cuenta',
    trial_upgrade_sub:'Con tu nombre, tu email y un PIN entras desde cualquier dispositivo — y todo lo que cargaste hasta ahora queda tal cual, no se pierde nada.',
    trial_upgrade_btn:'Crear mi cuenta',
    trial_save_account_cta:'Guardar mi cuenta',
    trial_scans_over_note:'Usaste los escaneos gratis de prueba. Guarda tu cuenta y sigue escaneando justo donde quedaste.',
    trial_inventory_limit_note:'Llegaste al límite de productos de la prueba. Guarda tu cuenta para seguir agregando sin ese tope.',
    trial_email_in_use:'Ese email ya tiene una cuenta. Toca "Iniciar sesión" abajo para entrar con ella.',
    pb_open_btn:'📷 Escanear productos',
    pb_title:'Arma tu inventario con una foto',
    pb_sub:'Saca UNA foto con varios productos a la vista (el estante, la mesa, las compras) — la IA identifica cada uno y los agregas todos juntos.',
    pb_loading:'Identificando los productos de la foto…',
    pb_none_found:'No se reconoció ningún producto en la foto — prueba con más luz o más de cerca.',
    pb_review_hint:'Se detectaron {n} productos. Revisa cada uno, desmarca los que no quieras, y corrige lo que haga falta antes de agregar.',
    pb_already_in_inventory:'Ya está en tu inventario — quedó destildado para no duplicarlo.',
    pb_low_confidence:'La IA no está segura de este — revisa el nombre antes de agregar.',
    pb_cost_ph:'Costo',
    pb_add_btn:'Agregar {n} al inventario',
    ids_found_in_inventory:'Ya está en tu inventario',
    ids_stock:'Stock',
    ids_cost:'Costo',
    ids_scan_again:'Escanear otro',
    ids_open_item:'Ver producto',
    auth_continue_google:'Continuar con Google', auth_or:'o', auth_password:'Contraseña',
    auth_forgot_password:'¿Olvidaste tu contraseña?', auth_no_account:'¿No tienes cuenta?',
    auth_have_account:'¿Ya tienes cuenta?', auth_create_account:'Crear cuenta', auth_loading:'Un momento…',
    auth_err_email_in_use:'Ya existe una cuenta con ese email — prueba iniciar sesión en vez de crear una nueva.',
    auth_err_invalid_email:'Ese email no parece válido.',
    auth_err_weak_password:'La contraseña necesita al menos 6 caracteres.',
    auth_err_wrong_password:'Email o contraseña incorrectos.',
    auth_err_user_not_found:'No hay ninguna cuenta con ese email.',
    auth_err_too_many:'Demasiados intentos — espera un momento y prueba de nuevo.',
    auth_err_generic:'Algo salió mal. Prueba de nuevo.',
    auth_err_provider_disabled:'El inicio de sesión con email todavía no está activado — prueba con Google, o avísale al administrador.',
    auth_err_need_email:'Escribe tu email primero.',
    auth_err_need_both:'Completa el email y la contraseña.',
    auth_reset_sent:'Te mandamos un email para restablecer tu contraseña.',
    team_title:'Compartir inventario', team_sign_out_btn:'Cerrar sesión',
    team_your_code_hint:'Cualquiera que entre este código en su propia cuenta va a ver y editar el mismo inventario que tú.',
    team_your_code_label:'Tu código', team_copy_btn:'Copiar', team_copied:'¡Copiado!',
    team_members_label:'Personas con acceso', team_remove_btn:'Quitar',
    team_remove_confirm:'¿Quitarle el acceso a esta persona? Va a dejar de ver este inventario.',
    team_you_owner_label:'Tú (dueño/a)', team_no_members_yet:'Todavía nadie se unió con tu código.',
    presence_active_now:'Activo ahora', presence_last_seen:'Última vez {when}', presence_never:'Nunca se conectó',
    team_join_label:'¿Alguien te compartió un código?', team_join_placeholder:'CÓDIGO',
    team_join_btn:'Unirme',
    team_join_confirm:'Vas a empezar a ver el inventario compartido de {email}. Lo que tengas guardado en esta cuenta ahora mismo no se va a mostrar más. ¿Continuar?',
    team_viewing_shared:'Estás viendo el inventario compartido de {email}.',
    account_owner_hint:'Estás viendo el inventario compartido de esta cuenta',
    activity_modal_title:'Actividad del inventario',
    activity_empty:'Todavía no hay cambios registrados.',
    activity_you:'Tú',
    inv_select_btn:'Seleccionar', inv_select_done:'Listo',
    inv_select_hint:'Toca los productos para seleccionarlos.',
    inv_selected_n:'{n} seleccionado(s)', inv_select_all:'Todos',
    inv_share_selected:'Compartir ({n})',
    inv_share_no_photos:'Ninguno de los marcados tiene foto',
    inv_share_partial:'{n} sin foto quedaron fuera',
    inv_share_failed:'No se pudo compartir',
    inv_share_unsupported:'Este dispositivo no puede compartir archivos',
    inv_delete_selected:'Borrar ({n})',
    inv_move_to_prod:'A producción ({n})',
    move_prod_ok:'Listo: una pieza con {n} de tus productos adentro. Ponle nombre y foto.',
    move_prod_some:'Listo: una pieza con {n} de tus productos. Dejé afuera {f} (los gastos y las piezas ya hechas no sirven de insumo).',
    move_prod_none:'Eso no puede ser insumo de nada: los gastos y las piezas ya hechas no cuentan.',
    move_prod_kept:'Tus productos siguen en el Inventario — acá solo dicen de qué está hecha la pieza. Al producir se descuentan solos.',
    confirm_delete_selected:'¿Borrar {n} producto(s)? Esta acción no se puede deshacer.',
    inv_deleted_n:'{n} producto(s) borrado(s)',
    activity_items_bulk_deleted:'borró {n} productos',
    activity_items_bulk_restored:'restauró {n} productos',
    activity_item_created:'agregó', activity_item_edited:'editó', activity_item_deleted:'eliminó',
    activity_scan_applied:'actualizó {n} producto(s) desde un recibo',
    activity_last_edit:'Última edición: {who} — {when}',
    time_just_now:'ahora mismo', time_minutes_ago:'hace {n} min', time_hours_ago:'hace {n} h',
    time_days_ago:'hace {n} d',
    team_leave_btn:'Dejar de ver este inventario compartido',
    team_leave_confirm:'¿Dejar de ver este inventario compartido? Vas a volver a tu propia cuenta.',
    team_err_need_code:'Escribe un código primero.',
    team_err_not_found:'Ese código no existe. Revísalo con la persona que te lo compartió.',
    team_err_self:'Ese es tu propio código — compartíselo a otra persona.',
    team_err_generic:'Algo salió mal. Prueba de nuevo.',
    team_share_btn:'Compartir', team_share_msg:'Te comparto el inventario en Dusty — abre este link y entra con tu nombre y un PIN:',
    team_join_title:'Unirme con un código', team_join_hint:'Alguien te compartió un código de invitación. Pon tu nombre y elige un PIN — no hace falta ningún email.',
    team_pinlogin_title:'Entrar con nombre y PIN', team_pinlogin_hint:'Si ya te uniste antes a un inventario compartido, entra con el mismo código, tu nombre y tu PIN.',
    team_pin_name_label:'Tu nombre', team_pin_name_placeholder:'Ej. Juan',
    team_pin_label:'Elige un PIN (mínimo 8 caracteres)', team_pin_confirm_label:'Repite el PIN',
    team_back_to_normal_login:'← Volver', team_have_code_link:'¿Te compartieron un código?',
    team_have_pin_link:'Ya tengo nombre y PIN',
    auth_err_need_name:'Escribe tu nombre primero.', auth_err_need_pin:'Escribe tu PIN.',
    auth_err_pin_short:'El PIN tiene que tener al menos 8 caracteres.',
    auth_err_pin_mismatch:'Los dos PIN no coinciden.',
    auth_err_name_taken:'Ese nombre ya está en uso en Dusty — prueba agregando tu apellido o algo que lo distinga.',
    auth_err_pin_wrong:'Nombre o PIN incorrecto.',
    feedback_title:'Reportar un problema', feedback_sub:'Cuéntanos qué pasó — lo vamos a revisar apenas podamos.',
    feedback_placeholder:'Ej. Al escanear un recibo de 3 páginas, la última no se leyó bien...',
    feedback_send:'Enviar', feedback_sent:'¡Gracias! Ya recibimos tu mensaje.',
    feedback_error:'No se pudo enviar — revisa tu conexión y prueba de nuevo.',
    delete_account_btn:'Eliminar cuenta', delete_account_title:'Eliminar cuenta',
    delete_account_warning:'Esto borra tu inventario, compras, recibos y fotos para siempre — no se puede deshacer.',
    delete_account_warning_team:'Eres dueño/a de un inventario compartido — {n} persona(s) más van a perder el acceso.',
    delete_account_reauth_sub:'Por seguridad, confirma que eres tú antes de borrar la cuenta.',
    delete_account_continue_btn:'Continuar', delete_account_confirm_btn:'Sí, eliminar mi cuenta',
    delete_account_google_reauth_btn:'Confirmar con Google',
    delete_account_success:'Tu cuenta fue eliminada.',
    privacy_policy_link:'Política de privacidad',
    welcome_title:'Bienvenido a Dusty', welcome_sub:'Así funciona, en 2 pasos:',
    welcome_step1_title:'Escanea, y listo', welcome_step1_sub:'Sácale una foto a cualquier recibo, factura o boleta — de una compra, un proveedor, o hasta luz, agua o internet — y tu inventario se actualiza solo, al toque.',
    welcome_step2_title:'Nosotros vigilamos los números', welcome_step2_sub:'Te avisamos si un precio sube raro, si el stock se está por acabar, o si te estás por pasar del presupuesto del mes.',
    welcome_step3_title:'Mejor en equipo', welcome_step3_sub:'Comparte un código y listo: los dos ven y actualizan el mismo inventario, recibos y presupuesto, siempre sincronizado.',
    welcome_btn:'Escanear mi primer recibo', welcome_next_btn:'Siguiente', welcome_back_btn:'Atrás', welcome_skip_btn:'Saltar',
    rd_scanned_on:'escaneado el', rd_applied_label:'Productos aplicados al inventario', rd_applied_to:'aplicado a:',
    rd_photo_alt:'Foto del recibo de',
    item_edit_title:'Editar producto', item_new_title:'Nuevo producto',
    item_sub:'Unidad y costo por unidad de este producto',
    btn_upload_photo:'📷 Subir foto', item_photo_helper:'Útil sobre todo para productos que no son comida — así se reconocen a simple vista.',
    btn_scan_product:'📷 Escanear producto', btn_scan_barcode:'🔲 Código de barras',
    product_scan_loading:'Identificando el producto…',
    product_scan_error:'No se pudo identificar el producto — completa los datos a mano.',
    barcode_scan_title:'Código de barras', barcode_scan_hint:'Apunta la cámara al código de barras del producto',
    barcode_scan_camera_error:'No se pudo acceder a la cámara — revisa los permisos del navegador.',
    barcode_scan_looking:'Buscando el producto…',
    lbl_sale_price:'Precio de venta', lbl_profit_pct:'% de ganancia',
    lbl_sku:'SKU / Código', ph_sku_example:'Ej. SKU-1042', lbl_item_supplier:'Proveedor',
    lbl_name:'Nombre', ph_name_example:'Ej. Medium shrimp',
    item_name_required:'Ponle un nombre al producto para poder guardarlo.',
    lbl_unit:'Unidad', lbl_cost_unit:'Costo por unidad',
    item_helper:'Al registrar una compra o escanear un recibo, el costo se actualiza solo.',
    item_section_basic:'Datos básicos', item_section_pricing:'Precio y ganancia', item_section_ids:'Identificación y stock',
    btn_remove_photo:'Quitar foto', lbl_qty_bought:'Cantidad comprada',
    lbl_total_paid:'Precio total pagado', lbl_supplier:'Proveedor',
    ph_supplier_example:'Ej. US Foods', lbl_date:'Fecha',
    lbl_invoice_total:'Total de la factura', ph_invoice_total:'Ej. 245.90',
    invoice_total_helper:'Este es el monto que se usa para el gasto del mes — corrígelo si no coincide con el total impreso del recibo.',
    scan_title:'Escanear recibo', scan_sub:'El sistema detecta los productos y precios, tú confirmas antes de aplicar',
    scan_tap_photo:'Toca para sacar una foto', scan_upload_gallery_btn:'o sube una desde la galería',
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
    scan_quality_hint:'Una o más fotos pueden ser difíciles de leer — puedes sacarlas de nuevo (❌ y agregar otra) o leer igual y revisar bien cada producto después.',
    scan_low_confidence_hint:'Esta lectura tiene bastante incertidumbre — puede que la foto no se haya leído bien del todo. Revisa cada producto con cuidado, o cancela y prueba con otra foto más clara.',
    scan_tip_manual:'Tip: si la conexión falla en vivo, puedes registrar la compra manualmente y seguir con la demo.',
    /* Auditoría de cámaras 2026-09-07 */
    scan_tip_frame:'Recibo entero, plano y sin sombra. Si es largo, sácalo en dos fotos.',
    pb_tip:'Los productos de frente, con la etiqueta a la vista y sin que se tapen entre sí.',
    scan_slow_note:'Sigue leyendo… las facturas largas y las fotos con muchos productos tardan un poco más.',
    scan_cancel_reading:'Cancelar lectura',
    scan_truncated_note:'Parece que falta el final del recibo (el total no se ve completo).',
    scan_add_page_after:'+ Agregar otra página',
    scan_apply_summary:'Aplicar {n} · {total}',
    scan_row_ok:'Leído bien', scan_row_collapse:'Listo, cerrar ▴', scan_matched_as:'≈ {name}', scan_ref_hint:'Toca para ver la foto grande',
    scan_lbl_match:'Producto', scan_lbl_qty:'Cantidad', scan_lbl_unit:'Unidad', scan_lbl_price:'Total línea',
    quality_gate_title:'Esta foto puede leerse mal', quality_use_anyway:'Usar igual', quality_retake:'Sacar otra',
    pb_add_row:'+ Agregar uno que la IA no vio', pb_cost_ph_novisible:'sin precio en la foto',
    shelf_unmatched_to_pb:'Darlos de alta con esta foto',
    scan_uses_one:'Cada identificación usa 1 escaneo del cupo.',
    barcode_lib_error:'No se pudo cargar el lector de códigos — revisa la conexión y prueba de nuevo.',
    barcode_manual_ph:'o escribe el código', barcode_manual_btn:'Buscar', barcode_torch:'🔦 Linterna', barcode_torch_unsupported:'Este teléfono no permite prender la linterna desde acá.',
    barcode_notfound_code:'No encontramos el código {code}. Lo guardamos como SKU: completa el nombre a mano o identifícalo con una foto.',
    barcode_write_name:'Escribir el nombre', barcode_identify_photo:'📷 Identificar con una foto',
    item_scan_detected:'Detectado: {v}', item_scan_use:'Usar',
    scan_dup_confirm_label:'Sí, es una compra distinta — aplicar de todos modos',
    lbl_detected_products:'Productos detectados — confirma o corrige cada uno', ph_product_name:'Nombre del producto',
    title_remove_product:'Eliminar este producto',
    scan_unrecognized:'No reconocido en tu inventario — edita el nombre/cantidad o confirma como producto nuevo',
    scan_qty_unverified:'No se pudo confirmar la cantidad leída del recibo — revísala antes de aplicar',
    scan_qty_review:'Confianza media en esta lectura — conviene revisarla',
    scan_category_unsure:'No estamos seguros en qué categoría va — elige una',
    price_alerts_title:'Cambios de precio recientes',
    // Notas de calendario (parser de lenguaje natural portado de Nudgy — nudgy-core.js)
    day_modal_notes_title:'Notas', day_modal_empty:'Sin recibos ni notas este día — escribe la primera abajo.',
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
    budget_placeholder_suggested:'Ej. {n} — vienes gastando {s} al mes',
    price_unit_mismatch:'unidad distinta', price_unit_mismatch_hint:'Las últimas dos compras de este producto se registraron en unidades distintas (ej. libras vs. cajas), así que no se puede comparar el precio de forma confiable.',
    price_implausible:'revisar precio', price_implausible_hint:'Este cambio es demasiado grande para ser un precio real (probablemente una cantidad o un precio mal leído en algún recibo viejo) — abre el historial de precios de este producto para encontrar y corregir la compra con el dato raro.',
    ph_excluded_units:'{n} compra(s) en otra unidad no se incluyen acá, para no comparar precios que no son compatibles.',
    opt_add_new_ing:'+ Agregar como producto nuevo', ph_qty_short:'Cant.', ph_price_short:'Precio',
    scan_no_products_left:'No quedan productos por confirmar. El lector de texto no es perfecto — si no detectó algo, agrégalo a mano.',
    btn_add_product_manually:'+ Agregar producto a mano', btn_confirm_apply:'Confirmar y actualizar inventario',
    btn_retry_scan:'Intentar de nuevo',
    err_img_process:'No se pudo procesar la imagen', err_img_read:'No se pudo leer la imagen',
    err_scan_no_connection:'No hay conexión a internet — escanear recibos necesita estar conectado. El inventario que ya tienes guardado lo puedes seguir viendo sin problema; vuelve a intentar el escaneo cuando tengas señal.',
    err_no_text:'No se detectó texto en la imagen — intenta con una foto más clara y bien iluminada',
    err_generic_receipt:'Ocurrió un error leyendo el recibo',
    err_scan_too_big:'Las fotos pesan demasiado para mandarlas juntas — prueba con menos páginas por vez.',
    err_scan_timeout:'El lector tardó demasiado con este recibo — prueba de nuevo; si es muy largo, escanéalo en menos páginas por vez.',
    err_function_not_found:'No se pudo conectar con el lector de recibos. Revisá tu conexión y probá de nuevo; si sigue igual, podés cargar la compra a mano mientras tanto.',
    err_function_not_found_product:'No se pudo conectar con el identificador de productos — revisa que la función esté publicada en Netlify (netlify/functions/identify-product.js) y que tenga la API key de Anthropic configurada.',
    err_scan_auth_required:'Inicia sesión de nuevo para escanear recibos.',
    err_scan_quota_exceeded:'Llegaste al límite de escaneos de tu plan este mes. Espera al próximo mes o sube de plan para seguir escaneando.',
    fallback_no_product_name:'Producto sin nombre', fallback_scanned:'Escaneado', fallback_unspecified:'Sin especificar',
    storage_full_warning:'⚠ No se pudo guardar este cambio — el almacenamiento del navegador está lleno. Anda a la pestaña Recibos, abre un recibo viejo que ya no necesites y toca "Eliminar" para liberar espacio (las fotos son lo que más ocupa). Después vuelve a intentar el cambio.',
    unit_unidad:'unidad', unit_caja:'caja', unit_servicio:'servicio',
    // Producción y salidas (recetas + escáner de estante — app-08)
    prod_section_title:'Producción',
    /* "Receta" es palabra de cocina y Dusty no es solo para cocinas (observación
       del usuario 2026-09-10 desde su negocio de material eléctrico: "ahí debe
       decir catálogo"). Lo que se guarda acá es el CATÁLOGO de lo que el negocio
       fabrica — un tablero eléctrico no se hace con una receta. Las claves siguen
       diciendo recipe_ porque así se llama el dato en el código; lo que cambia es
       lo que lee el usuario. */
    prod_new_recipe:'+ Agregar al catálogo', prod_new_recipe_short:'+ Agregar',
    prod_no_recipes:'Armá acá el catálogo de lo que fabricás — al registrar una producción, los insumos se descuentan del inventario solos y ves el costo por pieza.',
    prod_cost_each:'por pieza', prod_components_n:'{n} insumo(s)',
    prod_produce_btn:'Producir', prod_outflows_link:'Salidas',
    recipe_new_title:'Nuevo en el catálogo', recipe_edit_title:'Editar del catálogo',
    recipe_sub:'Qué insumos lleva cada pieza — al producir, se descuentan solos del inventario.',
    recipe_name_label:'Nombre', recipe_name_ph:'Ej. Collar Luna',
    recipe_scan_btn:'📷 Completar con una foto de la pieza',
    recipe_scan_hint:'Sácale una foto a la pieza terminada — la IA sugiere insumos y cantidades como borrador, tú corriges y confirmas.',
    recipe_scan_loading:'Contando con cuidado…',
    recipe_scan_none:'No se reconoció ningún insumo de tu inventario en la foto.',
    recipe_scan_unmatched:'Vistos en la foto pero no están en tu inventario (no se agregaron): {list}',
    recipe_components_label:'Insumos por pieza',
    recipe_no_components_yet:'Todavía no hay insumos — agrégalos a mano o empieza con una foto de la pieza.',
    recipe_add_component:'+ Agregar insumo', recipe_pick_product:'Elige un producto', recipe_qty_ph:'Cant.',
    recipe_remove_component:'Quitar este insumo',
    recipe_cost_line:'Costo por pieza',
    recipe_cost_missing:'{n} insumo(s) ya no existen en el inventario — el costo es parcial.',
    recipe_need_name:'Ponle un nombre.',
    recipe_need_components:'Agrega al menos un insumo con su cantidad.',
    recipe_delete_confirm:'¿Sacar "{name}" del catálogo? El inventario y el historial no se tocan.',
    produce_title:'Registrar producción',
    produce_sub:'Cuántas piezas hiciste — el stock de cada insumo se descuenta al confirmar.',
    produce_count_label:'Piezas producidas',
    produce_deduct_header:'Se descuenta del inventario',
    produce_short_note:'Según tu stock registrado faltan {n} {u} — queda en 0. Si en físico tenías más, corrige el stock después.',
    produce_missing_note:'Este insumo ya no existe en el inventario — no se descuenta.',
    produce_batch_cost:'Costo de esta producción',
    produce_price_label:'Precio de venta por pieza ($)',
    produce_income_line:'Ingreso estimado: {amount}',
    produce_no_price_note:'Sin precio de venta, esta producción no suma Ingresos en el Cierre de mes — puedes escribirlo acá solo por esta vez.',
    produce_confirm_btn:'Confirmar producción',
    shelf_banner_title:'Reducción',
    shelf_banner_sub:'Foto de tu estante → stock al día, sin contar a mano',
    shelf_title:'Escanear estante',
    shelf_sub:'Saca una foto del estante completo — la IA lee cantidades y niveles, tú confirmas antes de que se ajuste nada.',
    shelf_tip:'Mejor foto: todo el estante en cuadro con aire alrededor, buena luz, de frente o desde una esquina alta.',
    shelf_loading:'Contando con cuidado — puede tardar unos segundos…',
    shelf_none:'No se reconoció ningún producto en la foto — prueba con más luz o más de cerca.',
    shelf_review_hint:'Revisa cada lectura y corrige lo que haga falta. Solo se ajustan las filas marcadas.',
    shelf_current:'Registrado', shelf_detected:'Leído en la foto',
    shelf_final_label:'Dejar stock en',
    shelf_price_label:'Vendido a',
    shelf_price_empty_note:'Sin precio, esta venta te descuenta el costo pero no suma ingresos: el mes va a mostrar una pérdida que no fue real.',
    shelf_conf_alta:'confianza alta', shelf_conf_media:'revisar', shelf_conf_baja:'verifica esto',
    shelf_fill_note:'~{p}% del envase', shelf_sticker_note:'con marca {c}',
    shelf_increase_blocked:'La lectura ({n}) es mayor que el stock registrado ({c}) — este escáner solo descuenta. Si el stock real es mayor, edita el producto a mano.',
    rec_show_more:'Mostrar {n} más', rec_showing_n:'Mostrando {shown} de {total} recibos',
    srv_auth_required:'Inicia sesión para escanear.',
    srv_bad_request:'La app mandó un pedido inválido — actualiza la página e intenta de nuevo.',
    srv_too_many_pages:'Máximo 5 páginas por recibo.',
    srv_image_too_big:'La imagen es demasiado grande — prueba de nuevo desde la app.',
    srv_no_access:'No tienes acceso a esa cuenta.',
    srv_rate_limited:'Demasiados escaneos seguidos — espera un rato y prueba de nuevo.',
    srv_quota_check_failed:'No se pudo verificar tu cupo de escaneos — intenta de nuevo.',
    srv_upstream_error:'El lector de IA está saturado en este momento — tu cupo no se descontó, prueba en un minuto.',
    srv_internal:'Algo falló en el servidor — prueba de nuevo.',
    shelf_info_badge_aria:'Qué hace este escáner',
    shelf_info_title:'Escáner de salidas — solo descuenta',
    shelf_info_text:'Sácale una foto al estante y ajusta cuánto queda de cada producto, o a una nota escrita (ej. "Harina −2") y descuenta cada línea. Nunca suma stock: para aumentar, edita el producto a mano.',
    oc_card_label:'Calculadora de pedido', oc_card_hint:'Toca para armar un pedido',
    oc_title:'Calculadora de pedido', oc_clear:'Limpiar',
    oc_sub:'Tu inventario como teclas — precio de la última compra',
    oc_empty:'Toca los productos de abajo para armar el pedido',
    oc_total:'Total del pedido',
    oc_minus_aria:'Menos {name}', oc_plus_aria:'Más {name}', oc_type_aria:'Escribir cantidad de {name}',
    oc_search_ph:'Buscar producto…', oc_no_match:'Ningún producto coincide', oc_close:'Cerrar',
    inv_value_label:'Valor',
    spend_expenses:'Gastos operativos',
    dash_investment_of:'Inversión de', ph_capacity_example:'Ej. 500',
    manual_kind_label:'Tipo', manual_kind_expense:'Gasto operativo', manual_kind_investment:'Inversión (mercadería)',
    recap_btn:'💲 Cierre de mes', recap_title:'Tu mes en Dusty',
    recap_revenue:'Ingresos (est.)', recap_cogs:'Costo de lo vendido',
    recap_gross:'Ganancia bruta', recap_net:'Ganancia neta',
    recap_margin:'margen', recap_compare:'⇄ Comparar',
    recap_mode_month:'Mes', recap_mode_year:'Año',
    recap_value_today:'Valor del inventario (hoy)',
    recap_est_note:'Ganancias estimadas según tus salidas registradas (producciones y escáner de salidas) × tus precios de venta.',
    recap_no_outflows:'Sin salidas registradas en este período — registra producciones o usá el escáner de salidas y acá aparecen las ganancias estimadas.',
    recap_pl_title:'Resultados (estimados)', recap_vs:'vs {p}',
    recap_demo_btn:'✨ Ejemplo', recap_demo_note:'Datos de muestra — así se verá tu cierre después de dos años usando Dusty. Registra tus recibos y salidas y este será tu resultado real.',
    recap_receipts:'Recibos del mes', recap_budget_used:'Presupuesto usado',
    recap_empty:'Todavía no hay movimientos este mes — escanea tu primer recibo y acá se arma la historia.',
    recap_cash_title:'Movimiento de caja', recap_cash_purchases:'Compras de mercadería',
    recap_cash_net:'Caja neta (est.)', recap_new_delta:'nuevo',
    recap_base_prev:'vs mes anterior', recap_base_yoy:'vs año pasado',
    recap_no_base:'sin datos de {p}',
    recap_verdict_pos:'En positivo', recap_verdict_neg:'En rojo',
    recap_budget_left:'Quedan {amount}', recap_budget_over:'Excedido por {amount}',
    recap_ytd:'{y} acumulado', recap_ytd_base:'{y} mismo período',
    recap_trend_label:'Ganancia neta · últimos 13 meses',
    recap_compare_hint:'Toca dos períodos para compararlos lado a lado',
    recap_compare_delta:'Δ Cambio',
    recap_margin_gross:'Margen bruto', recap_margin_net:'Margen neto',
    recap_bridge_label:'De ingresos a ganancia neta',
    recap_wf_rev:'Ing.', recap_wf_cogs:'COGS', recap_wf_exp:'Gtos.', recap_wf_net:'Neta',
    recipe_sale_price_label:'Precio de venta por pieza',
    recipe_sale_price_helper:'Cuando vendas una pieza, esto es lo que suma como ingreso. Sin precio, la venta igual te descuenta el costo pero no suma nada, y el mes te muestra una pérdida que no fue real.',
    /* MOTIVO DE SALIDA (revisión contable 2026-09-10). Antes esto era UN motivo
       para toda la foto y arrancaba en "Ventas", así que sacar una foto del
       estante daba por vendido todo lo que hubiera bajado — inflaba los Ingresos
       sin que nadie lo eligiera. Ahora se pregunta, sin nada preseleccionado, y
       cada renglón puede ir por su lado (de 8 productos, 7 se vendieron y 1 se
       pudrió es lo normal). Sin tecnicismos: la pantalla nunca dice "motivo de
       salida", "COGS" ni "transferencia de costo". */
    shelf_reason_label:'Estas salidas fueron:',
    shelf_reason_ask:'¿Qué pasó con esto?',
    shelf_reason_ask_sub:'Elige una y se aplica a toda la lista. Después puedes cambiar cualquier renglón.',
    shelf_reason_sale:'💵 Lo vendí', shelf_reason_loss:'🗑️ Se dañó o se perdió',
    shelf_reason_internal:'🍕 Lo usé para producción',
    shelf_reason_sale_hint:'Entra plata. La ganancia se calcula con lo que te costó.',
    shelf_reason_internal_hint:'No entra plata todavía. Ese costo pasa a lo que estás fabricando.',
    shelf_reason_loss_hint:'Plata que perdiste. No es una venta.',
    shelf_row_reason:'En este renglón:',
    shelf_internal_note:'El costo de lo que sacaste pasa a lo que estás fabricando — no cuenta como venta.',
    shelf_loss_note:'Se cuenta como pérdida, no como venta.',
    shelf_reason_missing:'Falta decir qué pasó con {n} renglón(es).',
    scan_total_mismatch:'El total del recibo ({total}) difiere mucho de la suma de las líneas ({sum}) — revisa los montos antes de guardar.',
    inv_potential_label:'Potencial de venta', inv_potential_missing:'{n} sin precio de venta',
    team_profits_toggle:'Los miembros pueden ver ganancias y el valor del inventario',
    team_profits_helper:'Apagado: cada miembro ve costos y stock, pero no el % de ganancia, el precio de venta ni el Valor. Solo tú controlas esto.',
    manual_spend_title:'Agregar gasto sin recibo',
    manual_spend_sub:'Se suma al gasto del mes como un recibo manual — lo puedes ver y borrar después en Recibos.',
    manual_spend_amount:'Monto', manual_spend_desc:'Descripción (opcional)',
    manual_spend_ph:'Ej. Compra en efectivo', manual_expense_label:'Gasto manual',
    manual_spend_save:'Agregar gasto', manual_spend_added:'Gasto agregado al mes',
    manual_spend_err:'Pon un monto mayor a 0.',
    exit_title:'Antes de que te vayas…',
    exit_offer_title:'Quédate un mes — gratis',
    exit_offer_sub:'Cuéntanos qué te falló y te damos 30 días gratis mientras lo reparamos. Tus datos quedan intactos, y leemos cada respuesta.',
    exit_accept_offer:'Acepto el mes gratis', exit_continue_delete:'Quiero eliminar igual',
    exit_reason_title:'¿Qué fue lo que falló?', exit_reason_sub:'Tu respuesta va directo a la lista de reparación.',
    exit_r_use:'No la uso lo suficiente', exit_r_scan:'El escáner lee mal',
    exit_r_missing:'Me falta una función', exit_r_price:'Muy complicada de usar', exit_r_other:'Otra razón',
    exit_reason_ph:'Cuéntanos más (opcional)…', exit_next:'Continuar',
    exit_final_title:'Gracias por probar Dusty', exit_final_sub:'Se va a abrir la confirmación final de eliminación. La puerta queda abierta — tu email podrá crear una cuenta nueva cuando quieras.',
    exit_delete_btn:'Eliminar mi cuenta', exit_thanks_offer:'¡Gracias por la chance! Estamos en eso — tienes 30 días gratis.',
    inv_layout_label:'Vista del inventario',
    inv_layout_cols2:'Dos columnas', inv_layout_cols3:'Tres columnas',
    inv_layout_cols4:'Cuatro columnas',
    inv_tool_order:'Pedido', inv_tool_count:'Conteo',
    inv_quick_crit:'Crítico', inv_quick_count:'Toca contar', inv_quick_nophoto:'Sin foto',
    inv_sort_label:'Orden', inv_sort_name:'Nombre', inv_sort_stock:'Menos stock', inv_sort_value:'Mayor valor',
    inv_search_ph:'Buscar entre {n} productos', inv_more:'ver los {n} restantes', inv_less:'ver menos',
    inv_group_toggle_aria:'Plegar o desplegar la categoría',
    dash_today:'Hoy', dash_tool_products:'Productos', dash_tool_manual:'A mano',
    dash_stat_crit:'Críticos', dash_stat_count:'Toca contar', dash_stat_health:'Salud del stock',
    dash_suggested_none:'Nada por reponer esta semana', dash_suggested_n:'{n} producto(s) por reponer',
    dash_last_receipt:'Último recibo', dash_last_receipt_none:'Todavía no escaneaste ninguno',
    dash_calendar_title:'Recibos', dash_calendar_sub:'{n} escaneados',
    prod_empty_title:'Tu catálogo está vacío',
    prod_empty_sub:'Agregá lo que fabricás y qué insumos lleva cada pieza — Dusty te dice cuánto te cuesta hacerla.',
    prod_search_ph:'Buscar entre {n}...', prod_no_sale_price:'Sin precio de venta',
    prod_sort_name:'Nombre', prod_sort_price:'Precio más alto', prod_sort_made:'Menos hechas',
    prod_in_stock:'{n} en stock', prod_none_made:'Todavía sin fabricar',
    prod_share_selected:'Compartir {n}', prod_share_copied:'Catálogo copiado — pegalo donde quieras.',
    prod_delete_confirm:'¿Sacar {n} del catálogo? Dejás de ofrecerlos; el inventario y el historial no se tocan.',
    prod_delete_has_stock:'Ojo: {n} tienen piezas hechas. Esas piezas siguen en tu inventario con su costo — sacarlos del catálogo no las borra.',
    produce_done:'Fabricaste {n} × {name} · {amount} en materiales',
    bom_title:'Qué lleva', bom_col_item:'Insumo', bom_col_qty:'Cantidad',
    bom_col_cost:'Costo/u', bom_col_subtotal:'Subtotal',
    bom_total:'Te cuesta hacerlo', bom_gone:'Insumo borrado',
    bom_edit_btn:'Editar', bom_edit_title:'Editá lo que lleva', bom_col_qty_each:'Por pieza',
    bom_edit_helper:'Cambiá las cantidades o agregá un insumo con la lista de abajo. Se guarda solo — no vas a tener que rehacerlo la próxima vez.',
    bom_sale_line:'Si las vendés: {sale} · te quedan {profit}',
    bom_short_note:'No te alcanza el stock de algún insumo. Podés producir igual: lo que falte queda en cero y lo corregís después.',
    bom_produce_btn:'Hacer {n}',
    dash_activity_none:'Sin cambios nuevos', dash_activity_n:'{n} cambio(s) sin ver', dash_production_sub:'Recetas, producir y salidas',
    // Dashboard "anillo + cuadrícula" (maqueta aprobada 2026-09-08).
    dash_badge_ok:'OK', dash_badge_alert:'Alerta', dash_badge_due:'Toca',
    dash_tile_health:'{p}% salud del stock', dash_tile_health_none:'Sin datos todavía', dash_tile_count_none:'Nada pendiente',
    dash_ring_spent:'gastado', dash_kv_expenses:'Gastos', dash_kv_budget:'Presupuesto', dash_kv_invest:'Inversión', dash_kv_left:'Quedan', dash_kv_over:'Excedido',
    dash_add_spend_chip:'＋ Gasto',
    settings_help_btn:'❓ Ayuda y reportar un problema',
    theme_title:'Tema de colores',
    pulse_label:'Latidos de aviso', pulse_helper:'Las palpitaciones de Inventario (conteo pendiente, stock crítico) y de Presupuesto (barra, alerta, punto del Dashboard). Apágalas si te distraen o para ahorrar batería.',
    pulse_on:'Prendidos', pulse_off:'Apagados',
    switch_on:'Prendido', switch_off:'Apagado',
    scan_similar_note:'Se parece a «{name}» — ¿es el mismo producto?',
    scan_opt_existing:'Ya está en mi inventario', scan_opt_new:'Producto nuevo',
    opt_eat_out:'☕ Eat out — solo gasto, no inventario',
    eat_out_category:'Eat out', expense_only_tag:'Solo gasto — sin stock',
    category_new_tag:'nueva', btn_add_manually:'Agregar a mano', inv_search_aria:'Buscar producto',
    category_create_option:'Crear categoría nueva…', category_create_ph:'Nombre de la categoría',
    pv_change:'Cambiar foto', pv_delete_confirm:'¿Quitar la foto de este producto? El ícono automático vuelve a usarse.',
    pv_photo_of:'Foto de {name}',
    oc_send:'Enviar pedido', oc_copy:'Copiar',
    oc_copied:'Pedido copiado — pégalo en WhatsApp, email o donde quieras',
    oc_order_title:'Pedido — {name}', oc_est_total:'Total estimado',
    shelf_capacity_ask:'¿Cuánto es este envase lleno?',
    shelf_capacity_helper:'Se guarda en el producto — la próxima el % se convierte solo en {u}.',
    shelf_unmatched_title:'Vistos en la foto pero no están en tu inventario',
    shelf_unmatched_hint:'Agrégalos primero con "Escanear productos" si quieres que el estante también los ajuste.',
    shelf_apply_btn:'Ajustar {n} producto(s)',
    outflows_title:'Salidas de inventario',
    outflows_sub:'Producciones y ajustes de estante — qué bajó (o se corrigió) y cuándo.',
    outflows_empty:'Todavía no hay salidas registradas.',
    outflow_production:'Producción', outflow_adjust:'Ajuste de estante',
    activity_production:'registró la producción de {n} ×', activity_stock_adjust:'ajustó {n} producto(s) con un escaneo de estante',
    activity_recipe_created:'agregó al catálogo', activity_recipe_edited:'editó del catálogo', activity_recipe_deleted:'sacó del catálogo',
    capacity_label:'Capacidad del envase lleno',
    capacity_helper:'Opcional — cuánto trae el envase/frasco lleno. El escáner de estante lo usa para convertir "% de llenado" en cantidad real.',
  },
  en: {
    tab_dashboard:'Dashboard', tab_inventory:'Inventory', tab_receipts:'Receipts',
    tab_production:'Production',
    prod_tab_label:'I make my own products',
    prod_tab_helper:'Turns on the Production tab below. Turn it off and Receipts goes back there — the Dashboard calendar still takes you to them.',
    dash_see_all_months:'See all months',
    dash_budget_of:'Budget:', dash_edit_budget:'Edit',
    dash_scan_receipt:'Scan receipt', price_updated:'price updated',
    stock_of:'of', stock_critical_alerts:'Critical alerts:',
    stock_suggested_order:'Suggested order:', stock_view_detail:'View detail',
    suggested_order_title:'Suggested order', suggested_order_sub:'Products at critical stock level and how much to order to get back to target.',
    suggested_order_empty:'No products are at a critical level right now.', suggested_order_row_note:'You have',
    suggested_order_ghost_note:'This is how it will look when a product hits a critical level:',
    so_ex1:'Rice', so_ex2:'Oil', so_ex3:'Napkins',
    cc_btn:'Cycle count', cc_title:'Cycle count', cc_sub:"Every few days, you count a slice of inventory by hand to keep the data fresh — a different set of products each time.",
    cc_due_note:"{n} product(s) are due for a count today. Fill in what you see on the shelf; anything left blank won't change.",
    cc_not_due_note:"You're all caught up. Next count is due on", cc_next_now:'today',
    cc_current:'Currently on record', cc_counted_placeholder:'Counted quantity', cc_save_btn:'Save count',
    cc_settings_title:'Count settings', cc_pct_label:'% of inventory', cc_interval_label:'Every how many days',
    cc_settings_helper:"E.g. 20% every 3 days — that way you cycle through the whole inventory in about two weeks.",
    share_account_btn:'🔗 Share account',
    dash_team_title:'Team', dash_team_sub:'Share with your staff',
    settings_inventory_title:'Inventory',
    budget_exp_title:'Bills & services',
    budget_exp_note:'These categories don\'t show in your inventory: they\'re spending (utilities, eat out), not stock. Tap one to edit it.',
    budget_exp_uncat:'Services',
    budget_spent_line:'Spent this month: {amount}',
    srv_pro_not_configured:'The Pro feature is not enabled on the server yet',
    srv_needs_account:'Removing backgrounds needs a saved account',
    budget_spent_no_bills_note:'That amount comes from your receipts this month (Receipts tab) — the rows below are just an example of how this list looks.',
    budget_exp_example_tag:'sample',
    budget_exp_empty_note:'This is how it will look: scan a bill (electricity, water, internet) or an eat-out receipt and they show up here on their own — or add one by hand with the button.',
    budget_exp_add_btn:'+ Bill',
    budget_exp_scan_btn:'📷 Scan a bill',
    lbl_bill_amount:'Amount ($)',
    expense_register_payment:'Log this month\'s payment',
    expense_register_payment_hint:'Adds this month\'s expense right away (moves the budget bar). Uncheck it if you\'ll scan the bill later, so the month isn\'t counted twice.',
    expense_payment_logged:'{name} payment logged for this month ✓',
    expense_pay_btn:'Log this month\'s payment',
    expense_paid_tag:'Paid this month',
    expense_pay_no_amount:'This bill has no amount — open it and set one first.',
    expense_item_note:'Business expense: not sold, no stock — it lives in the Budget button.',
    account_btn:'👤 Account', account_title:'Account',
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
    inv_in_stock_suffix:'in stock',
    th_ingredient:'Product', th_cost_unit:'Cost/unit', lbl_stock:'Quantity in stock',
    btn_edit:'Edit', btn_delete:'Delete',
    no_supplier_name:'Unnamed supplier', product_singular:'product', products_plural:'products',
    rec_search_placeholder:'Search by supplier or product...', rec_no_matches:'No receipts match your search.',
    rec_month_total:'Month total', btn_print:'Print', btn_share:'Share',
    btn_cal_prev:'Previous month', btn_cal_next:'Next month',
    btn_cal_year_view:'View the whole year', btn_cal_month_view:'Back to month',
    rec_amount_search_placeholder:'Search by amount or item...',
    confirm_delete_bill_payments:"This bill has {n} payment(s) logged this month totaling {total}. Delete those too?\n\nIf you choose no, that money keeps counting toward this month in the budget — it is spending that already happened. Payments from earlier months are left alone.",
    confirm_delete_receipt:"Delete this receipt? This will also remove the purchases it created from your history and monthly spend.",
    confirm_revert_inventory:"Also subtract from inventory the quantities this receipt added? If you already used or sold that stock, choose \"Cancel\" to leave the current quantities as they are.",
    receipt_deleted_spend:'Receipt deleted · −{amount} in {month}',
    receipt_deleted_stock:'−{qty} subtracted from inventory',
    receipt_deleted_stock_kept:'inventory quantities were left as they were',
    confirm_delete_item:'Delete "{name}" from inventory?',
    ph_title_prefix:'Price history — ', ph_sub:'Cost per unit for each recorded purchase, oldest to most recent',
    ph_up:'Went up', ph_down:'Went down', ph_since_first:'since your first recorded purchase',
    ph_no_change:'No significant change since your first recorded purchase',
    ph_not_enough:'Not enough history yet — you need at least 2 purchases of this product to build the chart. So far you have',
    supplier_compare_title:'Compare suppliers', cheapest_label:'cheapest', avg_price_label:'avg.',
    supplier_compare_helper:"Based on the most recent purchase from each supplier.", ph_full_history_label:'Full history',
    btn_cancel:'Cancel', btn_close:'Close',
    settings_title:'Settings', settings_sub:'Every change applies instantly.',
    settings_appearance_title:'Appearance', settings_alerts_title:'Alerts',
    settings_account_title:'Account', settings_device_note:'Theme, pulses, language and format are saved on this device.',
    ms_title:'Spending by month', ms_sub:'How much you spent each month, next to your budget',
    ms_no_purchases:'No purchases recorded yet.', ms_current_month:'this month',
    alert_threshold_label:'Alert threshold (%)', alert_helper:"Any increase is flagged in yellow. From this % on it's flagged in red, as something that needs immediate review.",
    budget_title:'Monthly budget', budget_label:'Amount ($)', budget_placeholder:'E.g. 2000',
    budget_helper:'Repeats every month until you change it. Leave it blank to hide the budget bar.',
    budget_set_cta:'Set it →',
    budget_line:'Expenses {spent} of {budget}', budget_left:'{amount} left', budget_over:'Over by {amount}',
    budget_pace_fast:'⚡ Going fast: at this pace you close at {proj}', budget_pace_ok:'At this pace you close at {proj}', budget_pace_over:'🔴 You are past this month\'s budget',
    budget_pace_today:'Today you should be around {amount}',
    budget_committed:'with {amount} still to pay ({names})',
    budget_alert_warn_title:'You are at {pct}% of the budget', budget_alert_warn_sub:'{left} left for the rest of the month. Tap to see expenses.',
    budget_alert_fast_title:'⚡ You are outpacing the budget',
    budget_carry_note:'includes {amount} left over from {month}',
    budget_rollover_label:'Carry what is left to the next month', budget_rollover_helper:'If you spend less one month, the difference is added to next month\'s budget (at most, it doubles).',
    budget_caps_title:'Caps by category', budget_caps_helper:'Optional: a maximum per category. Each category bar is painted against its cap.',
    budget_cap_of:'of {cap}',
    budget_open_recap:'💲 See month recap',
    budget_cogs_line:'Cost of goods: {p}% of sales · target {t}%',
    money_format_label:'Amount format',
    budget_alert_fast_sub:'At this pace you close at {proj}. Tap to see expenses.',
    budget_alert_over_title:'You went over budget', budget_alert_over_sub:'Over by {amount}. Tap to review expenses.',
    budget_toast_warn:'🟡 Heads up: you are at {pct}% of the budget. {left} left.', budget_toast_over:'🔴 You went over budget by {amount}.',
    budget_alert_pct_label:'Budget warning (%)', budget_alert_pct_helper:'We warn you once when you cross this % of the monthly budget, and again when you go over.',
    budget_locked_note:'The budget is set by the account owner. You can still log expenses.',
    budget_history_note:'Closed months keep the budget they had.',
    budget_bycat_title:'Spent this month by category',
    budget_cogs_label:'Cost-of-goods target over sales (%)', budget_cogs_helper:'Optional, for food businesses: how much of what you sell should go to goods (28 to 35% is typical). Compared in the Month recap.',
    recap_cogs_ratio:'{p}% of sales · target {t}%', recap_under_budget:'🎉 Closed under budget',
    ms_line_now:'You are at {exp} of {bud}. You have {left} left.',
    ms_line_past:'You spent {exp} of {bud}. You had {left} left.',
    ms_line_over:'You spent {exp} and your cap was {bud}. You went over by {over}.',
    ms_line_nb:'You spent {exp}. There was no cap set that month.',
    ms_line_nb_now:'You are at {exp}. No cap set for this month yet.',
    ms_card_goods:'You also bought {inv} of goods (that is not spending: it stays as stock).',
    ms_ghost_note:'This is how your past months will look once you record spending:',
    cal_month_receipts:'{n} receipts this month',
    manual_spend_category:'Category (optional)',
    spend_future_date_confirm:'That date is in the future. Save anyway?', spend_future_date_note:'Heads up: that date is in the future — the expense will land in a month that has not started yet.',
    btn_manage_categories:'Categories', categories_title:'Inventory categories',
    categories_sub:'Group your products however you want — Food, Household, Clothing, Maintenance, or whatever you need.',
    categories_empty:'No categories yet — the whole inventory shows as a single list.',
    categories_new_placeholder:'New category', categories_add_btn:'+ Add',
    categories_helper:'Deleting a category doesn\'t delete its products — they just stop being grouped, and move to "Uncategorized".',
    categories_uncategorized:'Uncategorized', lbl_category:'Category', category_none_option:'Uncategorized',
    btn_save:'Save', btn_alert_settings:'Settings',
    help_title:'How does Dusty work?', help_sub:'First-day questions, answered short.',
    help_q1:'What can I scan?', help_a1:'Purchase receipts and invoices, electricity, water or internet bills, single products (photo or barcode) and the whole shelf to count stock. All from the camera button.',
    help_q2:'Is it saved without an account?', help_a2:'Yes. Everything stays on this phone from the first second. When you want it on another device, tap Save my account: name, email and a PIN, and nothing is lost.',
    help_q3:'How do I share with my partner?', help_a3:'From Share account on the dashboard: send them a link and you both see and update the same inventory, receipts and budget.',
    help_q4:'What if I make a mistake?', help_a4:'Before saving a receipt you review and fix every line. And any product or receipt can be edited or deleted by tapping it.',
    help_report_btn:'Report an issue',
    first_steps_title:'First steps', first_step_lang:'You picked your language', first_step_scan:'Scan your first receipt', first_step_budget:'Set a monthly budget',
    first_scan_toast_one:'Done! 1 product loaded from your first receipt.', first_scan_toast_many:'Done! {n} products loaded from your first receipt.',
    trial_scans_left:'You have {n} free scans left.', trial_scans_last:'You have 1 free scan left.',
    save_account_hint_toast:'Your data already lives on this phone. To see it on another one, tap ☁ Save up top.',
    trial_save_short:'Save',
    item_quick_sub:'Name and cost are enough to get started.', item_quick_more_btn:'More details', item_quick_more_hint:'photo, category, sale price, SKU',
    team_intro_btn:'Got it, share',
    welcome_go_dashboard:'See the dashboard first',
    cloud_sync_signed_out:'Sign in to sync to the cloud',
    cloud_sync_signed_in:'✓ Synced as {email}',
    cloud_sync_pending:'Syncing changes with the cloud — you may not be seeing your team\'s latest yet',
    export_working:'Building the backup…',
    export_done:'Backup downloaded',
    btn_undo:'Undo',
    inv_restored_n:'{n} product(s) restored',
    inv_no_match_search:'No product matches “{q}”',
    inv_clear_search:'Clear the search',
    inv_filter_none_crit:'No product is critical. All your stock is above its minimum.',
    inv_filter_none_count:'Nothing due for a count today.',
    inv_filter_none_nophoto:'All your products already have a photo.',
    inv_clear_filter:'See all products',
    cloud_sync_offline:"No connection — everything you do is saved on this phone and uploads when you're back online",
    cloud_sync_failed:"Couldn't save to the cloud — your data is safe on this phone. Tap to retry",
    cloud_sync_failed_retry:'Retrying the cloud save… Your data is still safe on this phone',
    offline_bar:'No connection · everything is saved on this phone',
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
    pb_loading:'Identifying the products in the photo…',
    pb_none_found:'No products were recognized in the photo — try with more light or closer up.',
    pb_review_hint:'{n} products detected. Review each one, untick the ones you don\'t want, and fix anything before adding.',
    pb_already_in_inventory:'Already in your inventory — unticked so it isn\'t duplicated.',
    pb_low_confidence:'The AI isn\'t sure about this one — double-check the name before adding.',
    pb_cost_ph:'Cost',
    pb_add_btn:'Add {n} to inventory',
    ids_found_in_inventory:'Already in your inventory',
    ids_stock:'Stock',
    ids_cost:'Cost',
    ids_scan_again:'Scan another',
    ids_open_item:'View product',
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
    activity_modal_title:'Inventory activity',
    activity_empty:'No changes recorded yet.',
    activity_you:'You',
    inv_select_btn:'Select', inv_select_done:'Done',
    inv_select_hint:'Tap products to select them.',
    inv_selected_n:'{n} selected', inv_select_all:'All',
    inv_share_selected:'Share ({n})',
    inv_share_no_photos:'None of the selected has a photo',
    inv_share_partial:'{n} without a photo were left out',
    inv_share_failed:"Couldn't share",
    inv_share_unsupported:"This device can't share files",
    inv_delete_selected:'Delete ({n})',
    inv_move_to_prod:'To production ({n})',
    move_prod_ok:'Done: one piece made of {n} of your products. Give it a name and a photo.',
    move_prod_some:'Done: one piece made of {n} of your products. I left out {f} (expenses and finished pieces cannot be inputs).',
    move_prod_none:'That cannot be an input to anything: expenses and finished pieces do not count.',
    move_prod_kept:'Your products stay in Inventory — here they only say what the piece is made of. Producing subtracts them on its own.',
    confirm_delete_selected:'Delete {n} product(s)? This cannot be undone.',
    inv_deleted_n:'{n} product(s) deleted',
    activity_items_bulk_deleted:'deleted {n} products',
    activity_items_bulk_restored:'restored {n} products',
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
    team_pin_label:'Pick a PIN (at least 8 characters)', team_pin_confirm_label:'Repeat the PIN',
    team_back_to_normal_login:'← Back', team_have_code_link:'Did someone share a code with you?',
    team_have_pin_link:'I already have a name and PIN',
    auth_err_need_name:'Enter your name first.', auth_err_need_pin:'Enter your PIN.',
    auth_err_pin_short:'The PIN needs to be at least 8 characters.',
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
    welcome_title:'Welcome to Dusty', welcome_sub:'Here\'s how it works, in 2 steps:',
    welcome_step1_title:'Scan it, and you\'re done', welcome_step1_sub:'Snap a photo of any receipt, invoice, or bill — a purchase, a supplier, even electricity, water, or internet — and your inventory updates itself, instantly.',
    welcome_step2_title:'We keep an eye on the numbers', welcome_step2_sub:'We\'ll flag a price that jumps, stock running low, or your monthly budget getting close to the edge.',
    welcome_step3_title:'Better as a team', welcome_step3_sub:'Share a code and you\'re set: you both see and update the same inventory, receipts, and budget, always in sync.',
    welcome_btn:'Scan my first receipt', welcome_next_btn:'Next', welcome_back_btn:'Back', welcome_skip_btn:'Skip',
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
    lbl_sale_price:'Sale price', lbl_profit_pct:'Profit %',
    lbl_sku:'SKU / Code', ph_sku_example:'e.g. SKU-1042', lbl_item_supplier:'Supplier',
    lbl_name:'Name', ph_name_example:'e.g. Medium shrimp',
    item_name_required:'Give the product a name so it can be saved.',
    lbl_unit:'Unit', lbl_cost_unit:'Cost per unit',
    item_helper:'When you log a purchase or scan a receipt, the cost updates automatically.',
    item_section_basic:'Basic info', item_section_pricing:'Price & profit', item_section_ids:'Identification & stock',
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
    scan_tip_frame:'Whole receipt, flat and without shadows. If it is long, take it in two photos.',
    pb_tip:'Products facing the camera, labels visible, not covering each other.',
    scan_slow_note:'Still reading… long invoices and photos with many products take a bit longer.',
    scan_cancel_reading:'Cancel reading',
    scan_truncated_note:'It looks like the end of the receipt is missing (the total is not fully visible).',
    scan_add_page_after:'+ Add another page',
    scan_apply_summary:'Apply {n} · {total}',
    scan_row_ok:'Read fine', scan_row_collapse:'Done, collapse ▴', scan_matched_as:'≈ {name}', scan_ref_hint:'Tap to see the photo full size',
    scan_lbl_match:'Product', scan_lbl_qty:'Quantity', scan_lbl_unit:'Unit', scan_lbl_price:'Line total',
    quality_gate_title:'This photo may read poorly', quality_use_anyway:'Use anyway', quality_retake:'Retake',
    pb_add_row:'+ Add one the AI missed', pb_cost_ph_novisible:'no price in the photo',
    shelf_unmatched_to_pb:'Add them with this photo',
    scan_uses_one:'Each identification uses 1 scan of your quota.',
    barcode_lib_error:'Could not load the barcode reader — check your connection and try again.',
    barcode_manual_ph:'or type the code', barcode_manual_btn:'Search', barcode_torch:'🔦 Flashlight', barcode_torch_unsupported:'This phone does not allow turning on the flashlight from here.',
    barcode_notfound_code:'Could not find code {code}. Saved as SKU: type the name by hand or identify it with a photo.',
    barcode_write_name:'Type the name', barcode_identify_photo:'📷 Identify with a photo',
    item_scan_detected:'Detected: {v}', item_scan_use:'Use',
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
    err_scan_too_big:'The photos are too heavy to send together — try fewer pages at a time.',
    err_scan_timeout:'The reader took too long on this receipt — try again; if it is very long, scan fewer pages at a time.',
    err_function_not_found:"Couldn't connect to the receipt reader. Check your connection and try again; you can log the purchase by hand in the meantime.",
    err_function_not_found_product:"Couldn't connect to the product identifier — check that the function is published on Netlify (netlify/functions/identify-product.js) and has the Anthropic API key configured.",
    err_scan_auth_required:'Sign in again to scan receipts.',
    err_scan_quota_exceeded:"You've reached your plan's scan limit for this month. Wait until next month or upgrade your plan to keep scanning.",
    fallback_no_product_name:'Unnamed product', fallback_scanned:'Scanned', fallback_unspecified:'Unspecified',
    storage_full_warning:'⚠ This change could not be saved — your browser storage is full. Go to the Receipts tab, open an old receipt you no longer need, and tap "Delete" to free up space (photos take up the most room). Then try the change again.',
    unit_unidad:'unit', unit_caja:'case', unit_servicio:'service',
    // Production & outflows (recipes + shelf scanner — app-08)
    prod_section_title:'Production',
    prod_new_recipe:'+ Add to catalog', prod_new_recipe_short:'+ Add',
    prod_no_recipes:'Build your catalog of what you make here — logging a production run deducts the supplies from inventory on its own, and shows your cost per piece.',
    prod_cost_each:'per piece', prod_components_n:'{n} supply(ies)',
    prod_produce_btn:'Produce', prod_outflows_link:'Outflows',
    recipe_new_title:'New catalog item', recipe_edit_title:'Edit catalog item',
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
    recipe_remove_component:'Remove this supply',
    recipe_cost_line:'Cost per piece',
    recipe_cost_missing:'{n} supply(ies) no longer exist in inventory — the cost is partial.',
    recipe_need_name:'Give it a name.',
    recipe_need_components:'Add at least one supply with its quantity.',
    recipe_delete_confirm:'Remove "{name}" from the catalog? Inventory and history are not touched.',
    produce_title:'Log production',
    produce_sub:'How many pieces you made — each supply\'s stock is deducted when you confirm.',
    produce_count_label:'Pieces produced',
    produce_deduct_header:'Deducted from inventory',
    produce_short_note:'Your recorded stock is {n} {u} short — it stops at 0. If you physically had more, correct the stock afterwards.',
    produce_missing_note:'This supply no longer exists in inventory — nothing is deducted.',
    produce_batch_cost:'Cost of this run',
    produce_price_label:'Sale price per piece ($)',
    produce_income_line:'Estimated income: {amount}',
    produce_no_price_note:'Without a sale price, this run adds no Income to the month recap — you can type one here just for this time.',
    produce_confirm_btn:'Confirm production',
    shelf_banner_title:'Reduction',
    shelf_banner_sub:'One photo of your shelf → stock up to date, no hand counting',
    shelf_title:'Scan shelf',
    shelf_sub:'Take a photo of the whole shelf — the AI reads quantities and fill levels, you confirm before anything is adjusted.',
    shelf_tip:'Best photo: the whole shelf in frame with some air around it, good light, straight on or from a high corner.',
    shelf_loading:'Counting carefully — this can take a few seconds…',
    shelf_none:'No products were recognized in the photo — try more light or closer up.',
    shelf_review_hint:'Review each reading and correct anything off. Only checked rows get adjusted.',
    shelf_current:'On record', shelf_detected:'Read from photo',
    shelf_final_label:'Set stock to',
    shelf_price_label:'Sold at',
    shelf_price_empty_note:'Without a price, this sale subtracts the cost but adds no income: the month will show a loss that never happened.',
    shelf_conf_alta:'high confidence', shelf_conf_media:'double-check', shelf_conf_baja:'verify this',
    shelf_fill_note:'~{p}% of container', shelf_sticker_note:'marked {c}',
    shelf_increase_blocked:'The reading ({n}) is higher than the recorded stock ({c}) — this scanner only deducts. If your real stock is higher, edit the product by hand.',
    rec_show_more:'Show {n} more', rec_showing_n:'Showing {shown} of {total} receipts',
    srv_auth_required:'Sign in to scan.',
    srv_bad_request:'The app sent an invalid request — refresh the page and try again.',
    srv_too_many_pages:'A receipt can have at most 5 pages.',
    srv_image_too_big:'That image is too large — try again from the app.',
    srv_no_access:'You do not have access to that account.',
    srv_rate_limited:'Too many scans in a row — wait a bit and try again.',
    srv_quota_check_failed:'Could not verify your scan quota — try again.',
    srv_upstream_error:'The AI reader is overloaded right now — your quota was not charged, try again in a minute.',
    srv_internal:'Something failed on the server — try again.',
    shelf_info_badge_aria:'What this scanner does',
    shelf_info_title:'Outflow scanner — deduct only',
    shelf_info_text:'Snap a photo of your shelf to adjust how much remains of each product, or of a written note (e.g. "Flour −2") to deduct each line. It never adds stock: to increase, edit the product by hand.',
    oc_card_label:'Order calculator', oc_card_hint:'Tap to build an order',
    oc_title:'Order calculator', oc_clear:'Clear',
    oc_sub:'Your inventory as keys — last purchase price',
    oc_empty:'Tap the products below to build your order',
    oc_total:'Order total',
    oc_minus_aria:'Less {name}', oc_plus_aria:'More {name}', oc_type_aria:'Type amount of {name}',
    oc_search_ph:'Search product…', oc_no_match:'No product matches', oc_close:'Close',
    inv_value_label:'Value',
    spend_expenses:'Operating expenses',
    dash_investment_of:'Investment for', ph_capacity_example:'e.g. 500',
    manual_kind_label:'Type', manual_kind_expense:'Operating expense', manual_kind_investment:'Stock investment',
    recap_btn:'💲 Month recap', recap_title:'Your month in Dusty',
    recap_revenue:'Revenue (est.)', recap_cogs:'Cost of goods sold',
    recap_gross:'Gross profit', recap_net:'Net profit',
    recap_margin:'margin', recap_compare:'⇄ Compare',
    recap_mode_month:'Month', recap_mode_year:'Year',
    recap_value_today:'Inventory value (today)',
    recap_est_note:'Profits estimated from your recorded outflows (production runs and the outflow scanner) × your sale prices.',
    recap_no_outflows:'No outflows recorded in this period — log production runs or use the outflow scanner and estimated profits appear here.',
    recap_pl_title:'Results (estimated)', recap_vs:'vs {p}',
    recap_demo_btn:'✨ Example', recap_demo_note:'Sample data — this is how your recap will look after two years of using Dusty. Log your receipts and outflows and this becomes your real result.',
    recap_receipts:'Receipts this month', recap_budget_used:'Budget used',
    recap_empty:'No activity this month yet — scan your first receipt and the story starts here.',
    recap_cash_title:'Cash movement', recap_cash_purchases:'Inventory purchases',
    recap_cash_net:'Net cash (est.)', recap_new_delta:'new',
    recap_base_prev:'vs prior month', recap_base_yoy:'vs last year',
    recap_no_base:'no data for {p}',
    recap_verdict_pos:'In the black', recap_verdict_neg:'In the red',
    recap_budget_left:'{amount} left', recap_budget_over:'Over by {amount}',
    recap_ytd:'{y} to date', recap_ytd_base:'same period {y}',
    recap_trend_label:'Net profit · last 13 months',
    recap_compare_hint:'Tap two periods to compare them side by side',
    recap_compare_delta:'Δ Change',
    recap_margin_gross:'Gross margin', recap_margin_net:'Net margin',
    recap_bridge_label:'From revenue to net profit',
    recap_wf_rev:'Rev', recap_wf_cogs:'COGS', recap_wf_exp:'Exp', recap_wf_net:'Net',
    recipe_sale_price_label:'Sale price per piece',
    recipe_sale_price_helper:'When you sell a piece, this is what counts as income. Without a price, the sale still subtracts the cost but adds nothing, and the month shows a loss that never happened.',
    shelf_reason_label:'These outflows were:',
    shelf_reason_ask:'What happened to this?',
    shelf_reason_ask_sub:'Pick one and it applies to the whole list. You can change any row afterwards.',
    shelf_reason_sale:'💵 I sold it', shelf_reason_loss:'🗑️ It broke or went bad',
    shelf_reason_internal:'🍕 I used it for production',
    shelf_reason_sale_hint:'Money comes in. Profit is worked out from what it cost you.',
    shelf_reason_internal_hint:'No money yet. That cost moves to what you are making.',
    shelf_reason_loss_hint:'Money you lost. Not a sale.',
    shelf_row_reason:'On this row:',
    shelf_internal_note:'What you took out moves its cost to what you are making — it does not count as a sale.',
    shelf_loss_note:'Counted as a loss, not a sale.',
    shelf_reason_missing:'Still need to say what happened to {n} row(s).',
    scan_total_mismatch:'The receipt total ({total}) is far from the line-item sum ({sum}) — double-check the amounts before saving.',
    inv_potential_label:'Sale potential', inv_potential_missing:'{n} without sale price',
    team_profits_toggle:'Members can see profits and inventory value',
    team_profits_helper:'Off: members see costs and stock, but not profit %, sale price, or the Value header. Only you control this.',
    manual_spend_title:'Add expense without receipt',
    manual_spend_sub:'Adds to the month’s spending as a manual receipt — you can view and delete it later in Receipts.',
    manual_spend_amount:'Amount', manual_spend_desc:'Description (optional)',
    manual_spend_ph:'e.g. Cash purchase', manual_expense_label:'Manual expense',
    manual_spend_save:'Add expense', manual_spend_added:'Expense added to the month',
    manual_spend_err:'Enter an amount greater than 0.',
    exit_title:'Before you go…',
    exit_offer_title:'Stay one month — free',
    exit_offer_sub:'Tell us what went wrong and get 30 days free while we fix it. Your data stays intact, and we read every answer.',
    exit_accept_offer:'I’ll take the free month', exit_continue_delete:'Delete anyway',
    exit_reason_title:'What went wrong?', exit_reason_sub:'Your answer goes straight to the repair list.',
    exit_r_use:'I don’t use it enough', exit_r_scan:'The scanner misreads',
    exit_r_missing:'Missing a feature', exit_r_price:'Too complicated to use', exit_r_other:'Something else',
    exit_reason_ph:'Tell us more (optional)…', exit_next:'Continue',
    exit_final_title:'Thanks for trying Dusty', exit_final_sub:'The final delete confirmation will open next. The door stays open — your email can create a fresh account anytime.',
    exit_delete_btn:'Delete my account', exit_thanks_offer:'Thanks for the chance! We’re on it — you have 30 days free.',
    inv_layout_label:'Inventory view',
    inv_layout_cols2:'Two columns', inv_layout_cols3:'Three columns',
    inv_layout_cols4:'Four columns',
    inv_tool_order:'Order', inv_tool_count:'Count',
    inv_quick_crit:'Critical', inv_quick_count:'To count', inv_quick_nophoto:'No photo',
    inv_sort_label:'Sort', inv_sort_name:'Name', inv_sort_stock:'Lowest stock', inv_sort_value:'Highest value',
    inv_search_ph:'Search {n} products', inv_more:'show the other {n}', inv_less:'show fewer',
    inv_group_toggle_aria:'Collapse or expand the category',
    dash_today:'Today', dash_tool_products:'Products', dash_tool_manual:'By hand',
    dash_stat_crit:'Critical', dash_stat_count:'To count', dash_stat_health:'Stock health',
    dash_suggested_none:'Nothing to restock this week', dash_suggested_n:'{n} product(s) to restock',
    dash_last_receipt:'Last receipt', dash_last_receipt_none:'None scanned yet',
    dash_calendar_title:'Receipts', dash_calendar_sub:'{n} scanned',
    prod_empty_title:'Your catalog is empty',
    prod_empty_sub:'Add what you make and the supplies each piece takes — Dusty tells you what it costs to make.',
    prod_search_ph:'Search {n}...', prod_no_sale_price:'No sale price',
    prod_sort_name:'Name', prod_sort_price:'Highest price', prod_sort_made:'Fewest made',
    prod_in_stock:'{n} in stock', prod_none_made:'None made yet',
    prod_share_selected:'Share {n}', prod_share_copied:'Catalog copied — paste it anywhere.',
    prod_delete_confirm:'Remove {n} from the catalog? You stop offering them; inventory and history are not touched.',
    prod_delete_has_stock:'Heads up: {n} have pieces made. Those pieces stay in your inventory with their cost — removing them from the catalog does not delete them.',
    produce_done:'Made {n} of {name} · {amount} in materials',
    bom_title:'What it takes', bom_col_item:'Supply', bom_col_qty:'Quantity',
    bom_col_cost:'Cost/u', bom_col_subtotal:'Subtotal',
    bom_total:'Costs you to make', bom_gone:'Supply deleted',
    bom_edit_btn:'Edit', bom_edit_title:'Edit what it takes', bom_col_qty_each:'Per piece',
    bom_edit_helper:'Change the amounts or add a supply with the list below. It saves on its own — you will not have to redo it next time.',
    bom_sale_line:'If you sell them: {sale} · you keep {profit}',
    bom_short_note:'You are short on some supply. You can still make them: whatever is missing lands at zero and you fix it after.',
    bom_produce_btn:'Make {n}',
    dash_activity_none:'No new changes', dash_activity_n:'{n} unseen change(s)', dash_production_sub:'Recipes, produce and outflows',
    dash_badge_ok:'OK', dash_badge_alert:'Alert', dash_badge_due:'Due',
    dash_tile_health:'{p}% stock health', dash_tile_health_none:'No data yet', dash_tile_count_none:'Nothing pending',
    dash_ring_spent:'spent', dash_kv_expenses:'Expenses', dash_kv_budget:'Budget', dash_kv_invest:'Investment', dash_kv_left:'Left', dash_kv_over:'Over',
    dash_add_spend_chip:'＋ Expense',
    settings_help_btn:'❓ Help and report a problem',
    theme_title:'Color theme',
    pulse_label:'Alert pulses', pulse_helper:'The pulsing in Inventory (count due, critical stock) and Budget (bar, alert card, Dashboard dot). Turn them off if they distract you or to save battery.',
    pulse_on:'On', pulse_off:'Off',
    switch_on:'On', switch_off:'Off',
    scan_similar_note:'Looks like “{name}” — is it the same product?',
    scan_opt_existing:'Already in my inventory', scan_opt_new:'New item',
    opt_eat_out:'☕ Eat out — expense only, no stock',
    eat_out_category:'Eat out', expense_only_tag:'Expense only — no stock',
    category_new_tag:'new', btn_add_manually:'Add manually', inv_search_aria:'Search products',
    category_create_option:'Create new category…', category_create_ph:'Category name',
    pv_change:'Change photo', pv_delete_confirm:'Remove this product’s photo? The automatic icon will be used again.',
    pv_photo_of:'Photo of {name}',
    oc_send:'Send order', oc_copy:'Copy',
    oc_copied:'Order copied — paste it into WhatsApp, email, or anywhere',
    oc_order_title:'Order — {name}', oc_est_total:'Estimated total',
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
// Fallback en inglés (el idioma principal): una clave que exista solo en un idioma
// se muestra en inglés, no en español.
function t(key){ return (I18N[uiLang] && I18N[uiLang][key]) || I18N.en[key] || I18N.es[key] || key; }

/* Aviso flotante con el estilo de la app — reemplaza a los alert() del sistema, que
   dentro del WebView de Android se ven especialmente crudos y BLOQUEAN el hilo.
   Vive en #toast-root (fuera de #app: morphdom no lo toca), se apila hasta 3, se
   descarta solo (los errores duran más) o con un toque. type: 'info'|'success'|'error'. */
/* Tercer parámetro opcional {label, onClick} (auditoría 2026-09-09): el aviso
   puede llevar un botón — así nació el "Deshacer" de los borrados, que hasta
   ahora no existía en ninguna parte de la app. Con acción el aviso dura más (la
   decisión de deshacer necesita leerse) y NO se cierra al tocarlo en cualquier
   lado, solo con el botón o solo. */
/* VIBRACIÓN AL CONFIRMAR (pedido del usuario 2026-09-09, lista de pulido).
   La app ya vibraba al cambiar de pestaña (hapticTabTick en app-06) con el
   plugin Haptics de Capacitor, que ya viene instalado — así que esto no agrega
   ninguna dependencia ni ningún permiso nuevo, y en el navegador no hace nada.
   Se engancha al aviso en vez de a cada botón: un aviso ES la confirmación de
   que algo pasó, así que ahí ya están todos los momentos que importan —guardar
   un producto, aplicar un escaneo, marcar un pago, borrar— sin tener que tocar
   veinte manejadores y sin que se olvide ninguno el día que se agregue otro.
   Los avisos informativos ("Armando el respaldo…") NO vibran: no confirman nada
   todavía. */
function hapticAviso(tipo){
  try{
    const H = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics;
    if(!H || !H.notification) return;
    if(tipo === 'success') H.notification({type:'SUCCESS'}).catch(()=>{});
    else if(tipo === 'error') H.notification({type:'ERROR'}).catch(()=>{});
  }catch(e){}
}
function showToast(message, type, action){
  hapticAviso(type);
  try{
    const root = document.getElementById('toast-root');
    if(!root){ alert(message); return; } // último recurso si el shell no lo tiene
    const el = document.createElement('div');
    el.className = 'toast toast-' + (type || 'info') + (action ? ' toast-action' : '');
    const txt = document.createElement('span');
    txt.textContent = String(message);
    el.appendChild(txt);
    root.appendChild(el);
    while(root.children.length > 3) root.removeChild(root.firstChild);
    let gone = false;
    const dismiss = ()=>{
      if(gone) return;
      gone = true;
      el.classList.add('toast-out');
      setTimeout(()=>{ if(el.parentNode) el.parentNode.removeChild(el); }, 260);
    };
    if(action && action.label && typeof action.onClick==='function'){
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'toast-btn';
      btn.textContent = action.label;
      btn.onclick = (ev)=>{ ev.stopPropagation(); dismiss(); try{ action.onClick(); }catch(e){ console.error('[Dusty] acción del aviso falló:', e); } };
      el.appendChild(btn);
      setTimeout(dismiss, 8000); // más aire: hay que decidir, no solo leer
    } else {
      el.onclick = dismiss;
      setTimeout(dismiss, type === 'error' ? 6500 : 4200);
    }
  }catch(e){}
}
function unitLabel(u){ return u==='unidad' ? t('unit_unidad') : u==='caja' ? t('unit_caja') : u==='servicio' ? t('unit_servicio') : u; }
/* ¿Este ítem es GASTO y no mercadería? (agua/luz = unidad 'servicio', consumos
   Eat out = expenseOnly). Misma regla que usa spendSplitForMonth para el P&L.
   Estos ítems viven en el botón de Presupuesto (pedido del usuario 2026-09-05),
   no en el inventario: no salen en la grilla, chips, anillo de salud, conteo
   cíclico ni calculadora de pedido. */
function isExpenseItem(i){ return !!(i && (i.expenseOnly || i.unit==='servicio')); }

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
  // Solo mercadería real: contar "Luz CFE" o un café de Eat out no significa
  // nada (qty 0 por diseño) — los ítems de gasto quedan fuera de la rotación.
  const countable = inventory.filter(i=>!isExpenseItem(i));
  if(countable.length===0) return [];
  const n = Math.min(countable.length, Math.max(1, Math.round(countable.length*(cycleCountPct/100))));
  const list = [];
  for(let i=0;i<n;i++){ list.push(countable[(cycleCountCursor+i)%countable.length]); }
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
/* Cache de blob-URLs para fotos en base64 (auditoría de rendimiento 2026-09-04):
   inyectar el data-URI completo (135-270KB por página) como src en los templates
   era el costo #1 de cada render — cada tap concatenaba y parseaba varios MB de
   HTML. Con el cache, el template lleva un "blob:..." de ~50 caracteres y el
   decode del base64 ocurre UNA vez por foto por sesión. Sin evicción a propósito:
   está acotado por las fotos vivas en el estado (la evicción de 30 días de abajo)
   y un blob-URL huérfano solo retiene memoria hasta cerrar la pestaña. */
const _photoUrlCache = new Map(); // base64 -> blob: URL
function cachedPhotoUrl(base64, mediaType){
  let u = _photoUrlCache.get(base64);
  if(u) return u;
  try{
    const bin = atob(base64);
    const arr = new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++) arr[i] = bin.charCodeAt(i);
    u = URL.createObjectURL(new Blob([arr], {type: mediaType||'image/jpeg'}));
  }catch(e){
    u = `data:${mediaType||'image/jpeg'};base64,${base64}`; // fallback: el camino de siempre
  }
  _photoUrlCache.set(base64, u);
  return u;
}
// Versión cacheada de receiptImageSrc (patron-core) para los TEMPLATES — misma
// prioridad (base64 local primero, URL de Storage después), src corto.
function receiptImgSrc(img){
  if(!img) return null;
  if(img.base64) return cachedPhotoUrl(img.base64, img.mediaType);
  return img.url || null;
}
/* Atributo loading para las <img> de los templates (auditoría de scroll
   2026-09-07). loading="lazy" en TODAS las fotos hacía que las miniaturas que
   ya viven en memoria (blob:/data: — 300px, cero red) recién se pidieran y
   decodificaran al entrar en pantalla: cada tarjeta aparecía vacía un cuadro y
   la foto "saltaba" adentro mientras se scrolleaba — eso es el parpadeo. Las
   de memoria van eager (decoding="async" ya las decodifica fuera del hilo de
   pintado); lazy queda SOLO para las URLs de Storage, que sí cuestan red. */
function imgLoadAttr(src){
  return (src && /^https?:/.test(src)) ? 'loading="lazy"' : '';
}
/* Tamaño con el que se guarda la FOTO DE UN PRODUCTO, uno solo para los tres
   caminos por los que puede entrar: asignarla a un producto existente, el alta a
   mano y el recorte del escaneo en lote. Antes eran 400, 300 y 300 px, así que el
   mismo producto se veía mejor o peor según cómo lo hubieras cargado.
   560 px (auditoría 2026-09-09): desde que la foto ocupa la tarjeta entera —antes
   era un círculo de 48 px— el tile de 2 columnas mide ~175 px de ancho, que en un
   iPhone de DPR 3 pide ~525 px reales; a 300-400 se veía blanda. Pesa ~30-45 KB en
   base64 (medido), así que sigue entrando en localStorage y en el documento de
   Firestore, que se lleva la foto adentro (a diferencia de recibos y recetas, que
   suben el archivo aparte a Storage). El visor a pantalla completa todavía la
   agranda: subir más pediría subir las fotos de producto a Storage. */
const ITEM_PHOTO_SIDE = 560;
const ITEM_PHOTO_QUALITY = 0.82;
function itemPhotoSrc(item){
  if(!item || !item.photo) return null;
  if(item.photo.base64) return cachedPhotoUrl(item.photo.base64, item.photo.mediaType);
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
/* true si loadState() no pudo interpretar lo guardado (ver el catch de más
   abajo). Mientras esté en true, saveState() NO escribe: pisar la clave con el
   estado vacío destruiría los datos que todavía se pueden rescatar de
   `<clave>_corrupto`. Se limpia sola en cuanto el usuario carga algo real. */
let stateLoadFailed = false;
function saveState(){
  if(stateLoadFailed){
    // Un dato real nuevo (importar respaldo, un producto, un recibo) significa
    // que el usuario ya siguió adelante: se libera el freno y se guarda normal.
    if(inventory.length || receipts.length || purchases.length) stateLoadFailed = false;
    else return;
  }
  let localOk = true;
  // ETAPA A del PLAN-SYNC: sellar updatedAt/updatedBy en cada doc cuyo contenido
  // cambió desde el guardado anterior (ver stampLocalEdits en app-02) — el sello es
  // lo que permite al reconcile decidir por contenido qué versión gana.
  stampLocalEdits();
  evictOldReceiptPhotos();
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      inventory, purchases, receipts, aliasMap, priceAlertThreshold,
      cycleCountPct, cycleCountIntervalDays, cycleCountLastDate, cycleCountCursor,
      deletedInventoryIds, deletedReceiptIds, deletedPurchaseIds,
      businessName, monthlyBudget, budgetMeta, profitsVisibleToMembers, categories, expenseCategories, calNotes, deletedCalNoteIds,
      recipes, outflows, outflowArchive, deletedRecipeIds
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
          businessName, monthlyBudget, budgetMeta, profitsVisibleToMembers, categories, expenseCategories, calNotes, deletedCalNoteIds,
          recipes, outflows, outflowArchive, deletedRecipeIds
        }));
        retried = true;
      }
    }catch(e2){}
    if(!retried){
      console.warn('No se pudo guardar en localStorage (¿espacio lleno?)', e);
      showToast(t('storage_full_warning'), 'error');
      localOk = false;
    }
  }
  // Clave: scheduleCloudSync() se llama AUNQUE localStorage haya fallado. Antes estaba
  // dentro del try, después del setItem — si el almacenamiento estaba lleno, el cambio no
  // solo no se guardaba local, tampoco subía a la nube (que sí tiene espacio), y se perdía
  // al cerrar la app. Ahora la nube — la vía de escape real — recibe el cambio igual.
  scheduleCloudSync();
  // Avisos de presupuesto: cualquier cambio de datos puede cruzar un umbral.
  checkBudgetAlerts();
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
  if(typeof data.profitsVisibleToMembers==='boolean') profitsVisibleToMembers = data.profitsVisibleToMembers;
  if(Array.isArray(data.deletedInventoryIds)) deletedInventoryIds = data.deletedInventoryIds;
  if(Array.isArray(data.deletedReceiptIds)) deletedReceiptIds = data.deletedReceiptIds;
  if(Array.isArray(data.deletedPurchaseIds)) deletedPurchaseIds = data.deletedPurchaseIds;
  if(typeof data.businessName==='string') businessName = data.businessName;
  if(data.monthlyBudget===null || typeof data.monthlyBudget==='number') monthlyBudget = data.monthlyBudget;
  if(data.budgetMeta && typeof data.budgetMeta==='object') budgetMeta = normalizeBudgetMeta(data.budgetMeta);
  if(Array.isArray(data.categories)) categories = data.categories;
  if(Array.isArray(data.expenseCategories)) expenseCategories = data.expenseCategories;
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
  if(data.outflowArchive && typeof data.outflowArchive==='object' && !Array.isArray(data.outflowArchive)) outflowArchive = data.outflowArchive;
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
    /* AUDITORÍA 2026-09-09: antes esto solo hacía console.warn y seguía con el
       estado VACÍO — y el primer saveState() (cualquier toque del usuario)
       pisaba la clave con los datos vacíos. Para alguien sin cuenta en la nube
       eso es pérdida total y silenciosa de su inventario. Ahora se marca la
       carga como fallida: saveState() no escribe hasta que el usuario decida,
       se conserva una copia del original en otra clave, y se avisa. */
    console.warn('No se pudo leer localStorage', e);
    stateLoadFailed = true;
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(raw) localStorage.setItem(STORAGE_KEY + '_corrupto', raw);
    }catch(e2){}
    reportClientError(e, 'loadState');
  }
}
/* Respaldo manual: exporta todo el estado a un .json descargable, e importa uno
   de vuelta. Es la única forma de no perder todo si el localStorage se llena
   (las fotos de recibos en base64 pesan) o si el usuario cambia de dispositivo. */
/* AUDITORÍA 2026-09-09: serializa el inventario, las compras y los recibos CON
   las fotos en base64 — con cientos de recibos son varios segundos de hilo
   bloqueado, y no había ni spinner ni aviso: la app parecía colgada. Ahora
   avisa que está armando el respaldo, cede un cuadro para que ese aviso llegue
   a pintarse, y confirma al terminar. */
function exportData(){
  showToast(t('export_working'), 'info');
  setTimeout(exportDataNow, 60);
}
function exportDataNow(){
  const payload = {
    inventory, purchases, receipts, aliasMap, priceAlertThreshold,
    cycleCountPct, cycleCountIntervalDays, cycleCountLastDate, cycleCountCursor,
    businessName, monthlyBudget, budgetMeta, profitsVisibleToMembers, categories, expenseCategories, calNotes, deletedCalNoteIds,
    recipes, outflows, outflowArchive, deletedRecipeIds,
    exportedAt: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `patron-backup-${localDateStr()}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  showToast(t('export_done'), 'success');
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
    catch(e){ showToast(t('import_invalid'), 'error'); return; }
    if(!data || !Array.isArray(data.inventory) || !Array.isArray(data.receipts)){ showToast(t('import_invalid'), 'error'); return; }
    // Importar mientras estás dentro del inventario de un equipo escribiría este backup
    // PERSONAL sobre el árbol del dueño y borraría (por diff) todo lo del equipo que no
    // esté en el backup — un miembro podía aniquilar el inventario compartido con un
    // import. Se bloquea con un aviso claro en vez de arriesgarlo.
    if(joinedOwnerUid){ showToast(t('import_blocked_team'), 'error'); return; }
    // Validación de forma: cada producto/recibo/compra debe ser un objeto con id. Un solo
    // elemento inválido (null, o sin id) rompía el render o el sync (doc(undefined)).
    const validItems = (arr)=> Array.isArray(arr) && arr.every(x=>x && typeof x==='object' && typeof x.id==='string');
    if(!validItems(data.inventory) || !validItems(data.receipts) || (data.purchases!==undefined && !validItems(data.purchases))){
      showToast(t('import_invalid'), 'error'); return;
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
    // Des-entierro en la NUBE (ver pendingUntombstone en app-02): quitar la lápida
    // local no alcanza con lápidas por unión — la copia de la nube la re-agregaba
    // y el doc restaurado se re-borraba solo en segundos. Se anotan TODOS los ids
    // del backup (arrayRemove de un id que no está es un no-op) y el próximo sync
    // los saca de los arrays remotos.
    markRestoredIds({
      deletedInventoryIds: Array.from(restoredInv),
      deletedReceiptIds: Array.from(restoredRec),
      deletedPurchaseIds: Array.from(restoredPur),
      deletedCalNoteIds: (data.calNotes||[]).map(n=>n && n.id).filter(Boolean),
      deletedRecipeIds: Array.from(restoredRecipes)
    });
    saveState();
    render();
    showToast(t('import_success'), 'success');
  };
  reader.onerror = ()=> showToast(t('import_invalid'), 'error');
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
  if(Math.abs(pct)>300) return `<span style="color:var(--money-warn-ink);font-size:11px;font-weight:700;margin-left:6px;white-space:nowrap;" title="${t('price_implausible_hint')}">⚠ ${t('price_implausible')}</span>`;
  const up = pct>0.5, down = pct<-0.5;
  const color = up?'var(--money-neg)':down?'var(--money-pos)':'var(--ink-soft)';
  const arrow = up?'▲':down?'▼':'→';
  return `<span style="color:${color};font-size:11px;font-weight:700;margin-left:6px;white-space:nowrap;">${arrow} ${Math.abs(pct).toFixed(0)}%</span>`;
}
/* Cambios de precio notables, para mostrar en el dashboard sin que el usuario tenga
   que estar escaneando un recibo en ese momento — un umbral más chico que
   priceAlertThreshold (que es el que dispara la alerta fuerte al escanear), porque
   acá es solo un resumen informativo, no una confirmación bloqueante. */
/* Índice de compras por producto, construido UNA vez por render (ver renderApp).
   Sin esto, cada render recalculaba O(inventario × compras) con un sort de TODAS
   las compras por cada producto (lastPriceChangePct filtra y ordena la lista
   entera): con 300 productos y 5,000 compras eran millones de operaciones y
   cientos de sorts por cada tap en un teléfono. */
let purchasesByIngIndex = null;
function buildPurchasesByIng(){
  const m = Object.create(null);
  purchases.forEach(p=>{ if(!p || !p.ingId) return; (m[p.ingId] || (m[p.ingId]=[])).push(p); });
  return m;
}
function purchasesForIng(ingId){
  if(purchasesByIngIndex) return purchasesByIngIndex[ingId] || [];
  // Fuera de un render (índice sin construir): el camino lento de siempre.
  return purchases.filter(p=>p && p.ingId===ingId);
}
function recentPriceAlerts(){
  return inventory
    .map(i=>({ing:i, pct:lastPriceChangePct(i.id, purchasesForIng(i.id))}))
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
/* ===== PRESUPUESTO: ritmo, comprometido, avisos (auditoría 2026-09-07) =====
   Un solo cálculo (budgetPace) alimenta la tarjeta del tablero, el modal de
   presupuesto, la tarjeta de alerta y los toasts — así todos dicen lo mismo. */
// ¿Este bill ya se pagó en el mes? Por id del bill (recibos nuevos) o por nombre
// (recibos viejos que no lo guardaban), o porque una boleta escaneada lo aplicó.
function billPaidInMonth(item, key){
  return receipts.some(r=> monthKey(r.date)===key
    && ((r.manual && r.manualKind==='expense' && (r.billItemId ? r.billItemId===item.id : r.supplier===item.name))
      || (r.appliedItems||[]).some(it=>it.ingId===item.id)));
}
function budgetPace(key){
  const eff = effectiveBudgetForMonth(key);
  if(!eff) return null;
  const [y,m] = key.split('-').map(Number);
  const isCurrent = key===localMonthStr();
  // Comprometido: bills con monto que todavía no se pagaron este mes.
  let committed=0; const committedNames=[];
  if(isCurrent){
    inventory.forEach(i=>{ if(isExpenseItem(i) && i.costPerUnit>0 && !billPaidInMonth(i, key)){ committed+=i.costPerUnit; committedNames.push(i.name); } });
  }
  // El cálculo puro vive en patron-core (computeBudgetPace), probado con Node.
  const p = computeBudgetPace({
    budget: eff.budget, expense: spendSplitForMonth(key).expense,
    daysInMonth: new Date(y, m, 0).getDate(), dayOfMonth: new Date().getDate(),
    isCurrent, threshold: budgetMeta.alertPct, committed, carry: eff.carry
  });
  if(!p) return null;
  p.key = key; p.base = eff.base; p.committedNames = committedNames;
  return p;
}
// "Costo de mercadería: 32% de las ventas · objetivo 30%" — solo con ventas y objetivo.
function cogsRatioHtml(key){
  const tgt = budgetMeta.cogsTargetPct;
  if(!tgt) return '';
  const fin = periodFinancials(key);
  if(!fin || !(fin.revenue>0)) return '';
  const ratio = fin.cogs/fin.revenue*100;
  const good = ratio<=tgt;
  return `<div class="budget-pace ${good?'ok':'warn'}" style="color:${good?'var(--money-pos-ink)':'var(--money-neg-ink)'};">${good?'✅':'⚠️'} ${t('budget_cogs_line').replace('{p}', ratio.toFixed(0)).replace('{t}', String(tgt))}</div>`;
}
// Las dos líneas bajo la barra: "Gastos $X de $Y · Quedan $Z" y la nota de ritmo.
function budgetSummaryHtml(p){
  const line1 = `<div class="budget-line">${t('budget_line').replace('{spent}', `<b>${money(p.expense)}</b>`).replace('{budget}', money(p.budget))} · ${p.left>=0
    ? `<b class="budget-left">${t('budget_left').replace('{amount}', money(p.left))}</b>`
    : `<b class="budget-over">${t('budget_over').replace('{amount}', money(-p.left))}</b>`}</div>`;
  return line1 + budgetNotesHtml(p);
}
// Solo las notas (ritmo, comprometido, arrastre) sin la línea de "Gastos $X de
// $Y": la tarjeta del Dashboard con anillo (2026-09-08) ya muestra esas cifras
// grandes a la derecha del anillo y no las repite.
function budgetNotesHtml(p){
  let pace='';
  if(p.pct>=100) pace = t('budget_pace_over');
  else if(p.fast) pace = t('budget_pace_fast').replace('{proj}', money(p.projected));
  // Solo con gasto real (Dashboard reorganizado 2026-09-07): "a este ritmo
  // cerrás en $0.00" con cero gastado no dice nada.
  else if(p.projected!==null && p.day>=5 && p.expense>0) pace = t('budget_pace_ok').replace('{proj}', money(p.projected));
  let committed='';
  if(p.committed>0 && p.left>0){
    const names = (p.committedNames||[]).slice(0,2).join(', ') + ((p.committedNames||[]).length>2 ? '…' : '');
    committed = t('budget_committed').replace('{amount}', money(p.committed)).replace('{names}', escapeHtml(names));
  }
  // Arrastre: aclarar que el presupuesto de este mes incluye lo que sobró del anterior.
  const carry = p.carry>0 ? t('budget_carry_note').replace('{amount}', money(p.carry)).replace('{month}', monthLabel(shiftMonthStr(p.key||localMonthStr(), -1), uiLang)) : '';
  const notes = [pace, committed, carry].filter(Boolean);
  return notes.length ? `<div class="budget-pace ${p.status}">${notes.join(' · ')}</div>` : '';
}
// Barra con la marca de "hoy deberías ir por acá" y el tramo fantasma de lo comprometido.
function budgetBarHtml(p){
  const w = Math.min(Math.max(p.pct,2),100);
  const ghost = (p.committed>0 && p.pct<100) ? `<div class="budget-ghost" style="left:${w.toFixed(1)}%;width:${Math.min(100-w, p.committed/p.budget*100).toFixed(1)}%;"></div>` : '';
  const mark = p.isCurrent ? `<i class="pace-mark" style="left:${p.expectedPct.toFixed(1)}%;" title="${escapeHtml(t('budget_pace_today').replace('{amount}', money(p.budget*p.day/p.daysIn)))}"></i>` : '';
  return `<div class="budget-bar-track pace-track"><div class="budget-bar-fill ${p.status}" style="--fill:${(w/100).toFixed(3)};"></div>${ghost}${mark}</div>`;
}
// Gasto operativo del mes agrupado por categoría de GASTO — recibos reales
// (manuales con categoría, pagos de bills, líneas de servicio escaneadas).
function expenseByCategoryForMonth(key){
  const sums = {}; const cache = finCache();
  // Clave por id de categoría ('' = sin categoría) para poder cruzar con los topes.
  const add = (cid, amt)=>{ const k = (cid && expenseCategories.some(c=>c.id===cid)) ? cid : ''; sums[k]=(sums[k]||0)+(amt||0); };
  receipts.filter(r=>monthKey(r.date)===key).forEach(r=>{
    const s = receiptSplit(r, cache);
    if(!(s.expense>0)) return;
    if(r.manual){
      let cid = r.expenseCategoryId||null;
      if(!cid && r.billItemId){ const it = cache.byId.get(r.billItemId); cid = it ? (it.expenseCategoryId||null) : null; }
      add(cid, s.expense);
      return;
    }
    // Mismo factor pro-rata que la barra del presupuesto: los dos números salen
    // del mismo reparto, así no pueden contar historias distintas.
    const f = s.factor||1;
    s.expenseLines.forEach(it=>{
      const ing = it.ingId ? cache.byId.get(it.ingId) : null;
      add(ing ? (ing.expenseCategoryId||null) : null, (it.totalPrice||0)*f);
    });
    if(s.unassignedExpense>0) add(null, s.unassignedExpense);
  });
  return Object.keys(sums).map(id=>{
    const c = id ? expenseCategories.find(c=>c.id===id) : null;
    // "Sin categoría" (no "Servicios"): en esta lista conviven con categorías reales
    // y una de ellas puede llamarse justamente Servicios.
    return { id, name: c ? c.name : t('categories_uncategorized'), amount: sums[id], cap: (id && budgetMeta.byCategory[id]>0) ? budgetMeta.byCategory[id] : null };
  }).sort((a,b)=>b.amount-a.amount);
}
// Tarjeta de alerta del tablero: solo cuando el mes va en amarillo o rojo.
function budgetAlertCard(){
  const p = budgetPace(localMonthStr());
  if(!p || p.status==='ok') return '';
  const over = p.pct>=100;
  // Tres casos con su propio título: pasado, sobre el umbral, o todavía debajo
  // pero yendo a un ritmo que cierra por encima ("vas rápido").
  const fastOnly = !over && p.fast && p.pct<p.threshold;
  const title = over ? t('budget_alert_over_title')
    : fastOnly ? t('budget_alert_fast_title')
    : t('budget_alert_warn_title').replace('{pct}', String(Math.round(p.pct)));
  const sub = over ? t('budget_alert_over_sub').replace('{amount}', money(-p.left))
    : (fastOnly ? t('budget_alert_fast_sub').replace('{proj}', money(p.projected)) : t('budget_alert_warn_sub').replace('{left}', money(p.left)));
  return `
  <div class="budget-alert-card ${p.status}" id="btn-budget-alert" role="button" tabindex="0">
    <span class="ba-icon">${over ? '🔴' : '🟡'}</span>
    <span class="ba-text"><b>${title}</b><span>${sub}</span></span>
    <span class="ba-chev">›</span>
  </div>`;
}
/* Aviso UNA vez por mes y por nivel (umbral y 100%): toast al cruzarlo. Corre al
   final de saveState (cualquier cambio de datos, propio o del equipo). Se arma
   recién después del arranque (ver el final de app-07). */
/* El "ya avisado" es POR DISPOSITIVO (localStorage, por cuenta y mes): así el dueño
   recibe su toast aunque el gasto que cruzó la línea lo haya cargado un miembro en
   otro teléfono. Antes viajaba por la nube y solo lo veía quien guardaba. */
let budgetAlertsArmed = false;
function budgetAlertedLevel(key){
  try{
    const who = (typeof syncUid==='function' && syncUid()) || 'local';
    const map = JSON.parse(localStorage.getItem('patron_budget_alerted')||'{}');
    return Number(map[who+':'+key])||0;
  }catch(e){ return 0; }
}
function setBudgetAlertedLevel(key, level){
  try{
    const who = (typeof syncUid==='function' && syncUid()) || 'local';
    const map = JSON.parse(localStorage.getItem('patron_budget_alerted')||'{}');
    map[who+':'+key] = level;
    localStorage.setItem('patron_budget_alerted', JSON.stringify(map));
  }catch(e){}
}
function checkBudgetAlerts(){
  if(!budgetAlertsArmed) return;
  try{
    const key = localMonthStr();
    const p = budgetPace(key);
    if(!p) return;
    const level = p.pct>=100 ? 100 : p.pct>=p.threshold ? p.threshold : 0;
    if(!level || level<=budgetAlertedLevel(key)) return;
    setBudgetAlertedLevel(key, level);
    showToast(level>=100
      ? t('budget_toast_over').replace('{amount}', money(-p.left))
      : t('budget_toast_warn').replace('{pct}', String(Math.round(p.pct))).replace('{left}', money(p.left)),
      level>=100 ? 'error' : 'info');
  }catch(e){}
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
/* División del gasto del mes (idea del usuario 2026-09-03): comprar mercadería
   NO es "gastar" — es convertir plata en stock (vive en el Valor del inventario).
   invested = líneas que entraron al inventario; expense = servicios (unidad
   'servicio'), consumos Eat out (productos expenseOnly), gastos manuales y
   recibos sin líneas. El resto del total (impuestos/cargos que no vienen como
   línea) se reparte proporcionalmente entre ambos lados. Clasifica solo, sin
   pedirle nada al usuario — todo sale de datos que los recibos ya tienen. */
/* Cache POR RENDER de los cálculos financieros: el Cierre de mes abierto llama
   periodFinancials hasta ~85 veces por render (columnas + bases + YTD + sparkline)
   y cada llamada barría receipts/outflows/inventory completos — cientos de ms por
   tap con años de datos. El cache vive UN ciclo de render (renderApp lo resetea al
   arrancar), así nunca puede quedar desactualizado entre mutaciones y pantalla. */
let finRenderCache = null;
function resetFinancialCache(){ finRenderCache = null; }
function finCache(){
  if(!finRenderCache){
    const byId = new Map(), byName = new Map();
    inventory.forEach(i=>{ if(i){ byId.set(i.id, i); if(i.name) byName.set(i.name, i); } });
    finRenderCache = { byId, byName, split:{}, fin:{} };
  }
  return finRenderCache;
}
/* ¿Esta línea de un recibo escaneado es GASTO (servicio, consumo) o INVERSIÓN
   (mercadería que entra al inventario)? Clasificación con snapshot: expenseOnly
   se congela al aplicar el escaneo (renombrar o borrar el producto ya no
   reclasifica meses cerrados). Las líneas viejas sin snapshot caen al lookup por
   id/nombre de siempre. Vive suelta porque la usan DOS cálculos que tienen que
   contar exactamente lo mismo: la barra del presupuesto (spendSplitForMonth) y
   el desglose por categoría (expenseByCategoryForMonth). */
function receiptLineIsExpense(it, cache){
  if(!it) return false;
  if(it.unit==='servicio') return true;
  if(typeof it.expenseOnly==='boolean') return it.expenseOnly;
  const ing = (it.ingId && cache.byId.get(it.ingId)) || (it.ingName ? cache.byName.get(it.ingName) : null);
  return !!(ing && ing.expenseOnly);
}
/* Reparte UN recibo escaneado entre inversión y gasto, con el factor que
   distribuye impuestos/cargos que no vienen como línea (y normaliza si el total
   impreso quedó por debajo de la suma de las líneas). Devuelve también las
   líneas de gasto YA multiplicadas por ese factor, para que el desglose por
   categoría sume exactamente lo mismo que la barra — antes el desglose usaba
   totalPrice crudo y se quedaba corto justo por los impuestos, y un recibo sin
   ninguna línea aplicada (nada se pudo emparejar) desaparecía entero del
   desglose aunque su total sí contara como gasto en la barra. */
function receiptSplit(r, cache){
  const total = r.total||0;
  if(r.manual){
    return r.manualKind==='investment'
      ? {invested: total, expense: 0, expenseLines: [], unassignedExpense: 0}
      : {invested: 0, expense: total, expenseLines: [], unassignedExpense: 0}; // el gasto manual sí tiene categoría propia
  }
  let inv=0, exp=0; const expLines=[];
  (r.appliedItems||[]).forEach(it=>{
    const amt = it.totalPrice||0;
    if(receiptLineIsExpense(it, cache)){ exp += amt; expLines.push(it); }
    else inv += amt;
  });
  const itemsSum = inv+exp;
  // Sin líneas con monto, el recibo entero es gasto y no hay a qué categoría
  // atribuirlo por línea: queda "sin asignar" (lo toma "Sin categoría").
  if(itemsSum<=0) return {invested: 0, expense: total, expenseLines: [], unassignedExpense: total};
  const factor = total/itemsSum;
  return {invested: inv*factor, expense: exp*factor, expenseLines: expLines, factor, unassignedExpense: 0};
}
function spendSplitForMonth(key){
  const cache = finCache();
  if(cache.split[key]) return cache.split[key];
  let invested=0, expense=0;
  receipts.filter(r=>monthKey(r.date)===key).forEach(r=>{
    const s = receiptSplit(r, cache);
    invested += s.invested; expense += s.expense;
  });
  return (cache.split[key] = {invested, expense});
}

/* ESTADO DE RESULTADOS por período — la estructura multi-paso estándar de un
   P&L de negocio chico (Ingresos → COGS → Bruta → Gastos operativos → Neta, con
   márgenes %). `key` acepta 'YYYY-MM' (mes) o 'YYYY' (año entero).
   HONESTIDAD CONTABLE: Dusty no registra ventas — los ingresos se ESTIMAN desde
   las salidas registradas (producciones + escáner de salidas) × precio de venta,
   y el COGS desde esas mismas salidas × costo. Si el período no tiene salidas,
   hadOutflows=false y la UI muestra una guía en vez de ceros engañosos. */
function periodSpendSplit(key){
  if(key.length===4){
    let invested=0, expense=0;
    for(let m=1;m<=12;m++){
      const s = spendSplitForMonth(key+'-'+String(m).padStart(2,'0'));
      invested+=s.invested; expense+=s.expense;
    }
    return {invested, expense};
  }
  return spendSplitForMonth(key);
}
/* Aporte de UNA salida al P&L (revisión de contador 2026-09-04) — devuelve
   {revenue, cogs} o null si la salida no puede estimarse honestamente:
   - adjust: cada baja de estante es venta estimada (qty × precio) salvo que el
     usuario la haya marcado como pérdida/merma (reason:'loss') — la merma cuenta
     su costo (COGS de lo perdido) pero NUNCA infla los Ingresos.
   - production: se estima por el precio de la PIEZA (recipe.salePrice × count),
     no por el salePrice de los insumos consumidos; sin precio de pieza la
     producción queda FUERA del P&L (antes pintaba pérdidas ficticias).
   Los snapshots costAt/priceAt congelan los precios del día de la salida; las
   salidas viejas sin snapshot caen al precio actual (lo mejor disponible). */
function outflowPL(o){
  if(!o) return null;
  const cache = finCache();
  if(o.type==='production'){
    /* PRODUCIR ES UN TRASPASO, NO UNA VENTA (revisión contable 2026-09-10).
       Desde que el producto terminado existe como stock (producedItemId), fabricar
       no aporta NADA al resultado del mes: la plata no se gana ni se pierde, cambia
       de forma — sale de materia prima y entra al terminado, con el Valor del
       inventario igual antes y después. El ingreso aparece cuando esa pieza SE
       VENDE, y ahí lo calcula la salida de estante con su costo promedio.
       Contarlo acá además sería contarlo dos veces.
       Las producciones VIEJAS (sin producedItemId) conservan su comportamiento —
       estimaban el ingreso por el precio de la pieza— para que los meses ya
       cerrados no se reescriban solos. */
    if(o.producedItemId) return null;
    const rec = typeof recipeById==='function' ? recipeById(o.recipeId) : null;
    const sale = (typeof o.saleTotal==='number' && o.saleTotal>0) ? o.saleTotal
      : (rec && (rec.salePrice||0)>0 ? (o.count||0)*rec.salePrice : 0);
    if(!(sale>0)) return null;
    let cogs = (typeof o.costTotal==='number') ? o.costTotal : null;
    if(cogs===null){
      cogs = 0;
      (o.items||[]).forEach(it=>{
        const ing = cache.byId.get(it.ingId);
        const c = (typeof it.costAt==='number') ? it.costAt : (ing ? ing.costPerUnit||0 : 0);
        cogs += Math.abs(it.qty||0)*c;
      });
    }
    return {revenue: sale, cogs};
  }
  let revenue=0, cogs=0, internalUse=0, any=false;
  (o.items||[]).forEach(it=>{
    const q = Math.abs(it.qty||0);
    if(!q) return;
    const ing = cache.byId.get(it.ingId);
    if(ing && ing.expenseOnly) return;
    const hasSnap = typeof it.costAt==='number';
    if(!hasSnap && !ing) return; // salida vieja de un producto borrado: sin datos
    const cost = hasSnap ? it.costAt : (ing.costPerUnit||0);
    const price = (typeof it.priceAt==='number') ? it.priceAt : (ing ? ing.salePrice||0 : 0);
    any = true;
    /* MOTIVO POR RENGLÓN (revisión contable 2026-09-10). Las salidas viejas no lo
       tienen por línea: ahí manda el del ajuste entero, como siempre. */
    const reason = it.reason || (o.reason==='loss' ? 'loss' : o.reason==='internal' ? 'internal' : 'sale');
    if(reason==='internal'){
      /* CONSUMO INTERNO: la mercadería salió del estante para fabricar otra cosa.
         No es una venta (no entra plata) y NO es costo de lo vendido — el COGS es
         el costo de lo que SE VENDIÓ. Su costo es un TRASPASO: deja de ser materia
         prima y pasa a valer dentro de lo que estás fabricando. Se lleva aparte
         para poder mostrarlo como lo que es y no como ganancia ni como pérdida.
         Mientras el producto terminado no exista como stock, esta cifra es la
         única huella de esa plata — por eso no se descarta. */
      internalUse += q*cost;
      return;
    }
    cogs += q*cost;
    if(reason!=='loss' && price>0) revenue += q*price;
  });
  return any ? {revenue, cogs, internalUse} : null;
}
function periodFinancials(key){
  const cache = finCache();
  if(cache.fin[key]) return cache.fin[key];
  const sp = periodSpendSplit(key);
  const inPeriod = d => key.length===4 ? String(d||'').slice(0,4)===key : monthKey(d)===key;
  let revenue=0, cogs=0, internalUse=0, hadOutflows=false;
  outflows.forEach(o=>{
    if(!o || !inPeriod(o.date)) return;
    const pl = outflowPL(o);
    if(!pl) return;
    hadOutflows = true;
    revenue += pl.revenue;
    cogs += pl.cogs;
    internalUse += pl.internalUse||0;
  });
  // Salidas viejas que el cap de 400 evictó: su aporte vive consolidado por mes
  // en outflowArchive (app-08) — el P&L histórico ya no se achica en silencio.
  Object.keys(outflowArchive||{}).forEach(k=>{
    if(key.length===4 ? k.slice(0,4)!==key : k!==key) return;
    const a = outflowArchive[k];
    if(!a) return;
    revenue += a.revenue||0;
    cogs += a.cogs||0;
    hadOutflows = true;
  });
  const gross = revenue - cogs;
  const net = gross - sp.expense;
  return (cache.fin[key] = {
    invested: sp.invested, expense: sp.expense,
    // Materiales que salieron del estante para fabricar. No suma ni resta en el
    // resultado: es plata que cambió de forma, no que se ganó ni se perdió.
    internalUse,
    revenue, cogs, gross, net,
    grossMarginPct: revenue>0 ? gross/revenue*100 : null,
    netMarginPct: revenue>0 ? net/revenue*100 : null,
    hadOutflows,
    receiptsCount: receipts.filter(r=>inPeriod(r.date)).length
  });
}

/* La unidad con la que este negocio REALMENTE trabaja: la más repetida en su
   inventario. Un abarrotes que carga todo por "unidad" no debería ver "lb"
   preseleccionado en cada producto nuevo (y viceversa para una cocina que pesa
   todo). Con inventario vacío se usa el fallback que se pida — el alta manual
   mantiene 'lb' (el default histórico) y la fila manual del escaneo 'unidad'. */
function mostUsedInventoryUnit(fallback){
  const counts = {};
  // Solo mercadería (bug cazado en la auditoría de cámaras 2026-09-07): con un
  // bill ("Luz", unidad servicio) cargado antes que el primer producto, la unidad
  // más usada era "servicio" y "Nuevo producto" abría como ficha de GASTO, sin
  // foto ni escáneres.
  inventory.forEach(i=>{ if(i.unit && i.unit!=='servicio' && !isExpenseItem(i)) counts[i.unit] = (counts[i.unit]||0)+1; });
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

