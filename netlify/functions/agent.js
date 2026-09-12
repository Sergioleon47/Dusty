// netlify/functions/agent.js
//
// EL AGENTE DE DUSTY (2026-09-11). Recibe la conversación del usuario y le
// pide a Claude que la resuelva con HERRAMIENTAS: el modelo no toca datos,
// decide qué acción de Dusty corresponde (agregar un gasto, un trabajo, una
// categoría; consultar por cobrar, presupuesto, agenda) y con qué parámetros.
// La app ejecuta la acción en el teléfono —con las mismas validaciones, permisos
// y sincronización de siempre— y le devuelve el resultado para que redacte la
// respuesta. Cada vuelta (pedido → herramientas → respuesta) pasa por acá.
//
// Cupo propio, aparte de los escaneos: una vuelta de texto cuesta ~1/20 de un
// escaneo con foto. Se cuenta por período en users/{owner}/meta/billing
// (agentUsed/agentPeriod), con el pase de dueño de siempre.
const {
  admin, isAllowedOrigin, verifyCallerInfo, isUnlimitedAccount,
  currentBillingPeriod, callerCanUseAccount, checkIpRateLimit, getAccessState,
  reserveScanQuota, refundScanUsage,
  subscriptionRequiredResponse, withCors
} = require('./lib/patron-admin');

const AGENT_MODEL = process.env.AGENT_MODEL || 'claude-haiku-4-5-20251001';
// Modelo GRANDE para pedidos complejos (pedido del usuario 2026-09-11: "cuando sea
// una pregunta compleja, que pueda responder con más calidad"). El mismo que
// leen los recibos. Solo cuando needsBigModel lo decide: 3-4x el costo por pedido.
const AGENT_MODEL_BIG = process.env.AGENT_MODEL_BIG || 'claude-sonnet-5';
const AGENT_LIMIT_TRIAL = 60;        // vueltas de por vida en el trial anónimo
const AGENT_LIMIT_MONTH = 600;       // vueltas por mes con cuenta
const MAX_MESSAGES = 30;             // historial que se acepta por pedido
const MAX_TEXT = 4000;               // chars por bloque de texto/resultado

/* ---------- herramientas (lo único que el agente puede hacer) ---------- */
const TOOLS = [
  { name: 'add_expense', description: 'Registra un gasto sin recibo (o una compra de mercadería en efectivo). Úsala cuando el usuario diga que gastó/pagó algo. Va a los gastos del mes, al presupuesto y al cierre de mes.',
    input_schema: { type: 'object', properties: {
      amount: { type: 'number', description: 'Monto pagado, positivo' },
      description: { type: 'string', description: 'Qué se pagó, corto (ej. "Combustible", "Taller Gómez")' },
      category: { type: 'string', description: 'Nombre de una categoría de gasto del usuario (ver contexto). Elegí la que mejor calce; omití si no hay ninguna que calce.' },
      date: { type: 'string', description: 'YYYY-MM-DD. Omití para hoy.' },
      kind: { type: 'string', enum: ['expense', 'investment'], description: 'expense = gasto operativo (default). investment = compra de mercadería para revender.' }
    }, required: ['amount'] } },
  { name: 'add_job', description: 'Crea un trabajo de servicios (viaje, visita, alquiler, limpieza...) con cliente y precio. Solo si el negocio presta servicios.',
    input_schema: { type: 'object', properties: {
      client: { type: 'string' }, service: { type: 'string', description: 'Nombre del servicio; si coincide con uno de la lista del usuario, usá ese nombre exacto' },
      price: { type: 'number' }, date: { type: 'string', description: 'YYYY-MM-DD, omití para hoy' },
      asset: { type: 'string', description: 'Nombre del equipo/activo usado (de la lista del usuario)' },
      paid: { type: 'boolean', description: 'true si ya cobró' }, due_days: { type: 'integer', description: 'Días para cobrar si está pendiente (default 15)' },
      repeat: { type: 'string', enum: ['weekly', 'biweekly', 'monthly'], description: 'Solo si el usuario dice que se repite' }
    }, required: ['client', 'price'] } },
  { name: 'mark_paid', description: 'Marca como cobrado un trabajo pendiente. Identificalo por cliente (y monto o fecha si hay varios).',
    input_schema: { type: 'object', properties: { client: { type: 'string' }, amount: { type: 'number' }, date: { type: 'string' }, job_id: { type: 'string', description: 'Si lo sabés por una consulta previa' } }, required: [] } },
  { name: 'add_category', description: 'Crea una categoría nueva. kind=expense para categorías de gasto (combustible, uniformes...), kind=inventory para categorías de productos.',
    input_schema: { type: 'object', properties: { name: { type: 'string' }, kind: { type: 'string', enum: ['expense', 'inventory'] } }, required: ['name', 'kind'] } },
  { name: 'log_maintenance', description: 'Registra un mantenimiento hecho a un equipo/activo (cambio de aceite, frenos, revisión). Con costo, queda como gasto del activo.',
    input_schema: { type: 'object', properties: { asset: { type: 'string' }, what: { type: 'string' }, date: { type: 'string' }, km: { type: 'number', description: 'Odómetro actual si lo dice' }, cost: { type: 'number' } }, required: ['asset', 'what'] } },
  { name: 'add_asset', description: 'Da de alta un equipo/activo (camión, cámara, máquina, herramienta).',
    input_schema: { type: 'object', properties: { name: { type: 'string' }, model: { type: 'string' }, km: { type: 'number' }, purchase_price: { type: 'number' }, purchase_date: { type: 'string' } }, required: ['name'] } },
  { name: 'add_service', description: 'Agrega un servicio a la lista de precios del usuario.',
    input_schema: { type: 'object', properties: { name: { type: 'string' }, price: { type: 'number' }, unit: { type: 'string', enum: ['fixed', 'km', 'day', 'hour'] }, description: { type: 'string' } }, required: ['name'] } },
  { name: 'add_item', description: 'Agrega un producto al inventario (negocio que vende productos).',
    input_schema: { type: 'object', properties: { name: { type: 'string' }, qty: { type: 'number' }, unit: { type: 'string', description: 'unidad, caja, lb, kg, oz, g, ml, l' }, cost_per_unit: { type: 'number' }, sale_price: { type: 'number' }, category: { type: 'string' } }, required: ['name'] } },
  { name: 'add_note', description: 'Anota un recordatorio en el calendario de Dusty en una fecha (o recurrente en lenguaje natural dentro del texto).',
    input_schema: { type: 'object', properties: { text: { type: 'string' }, date: { type: 'string', description: 'YYYY-MM-DD; omití si el texto ya dice cuándo' } }, required: ['text'] } },
  { name: 'set_budget', description: 'Fija el presupuesto mensual de gastos.',
    input_schema: { type: 'object', properties: { amount: { type: 'number' } }, required: ['amount'] } },
  { name: 'query', description: 'Consulta datos de Dusty. Usala ANTES de responder cualquier pregunta con números o listas: no inventes cifras.',
    input_schema: { type: 'object', properties: {
      topic: { type: 'string', enum: ['collect', 'budget', 'agenda', 'expenses', 'jobs', 'inventory', 'month', 'assets', 'services', 'categories'],
        description: 'collect=por cobrar; budget=presupuesto del mes; agenda=próximos días; expenses=gastos por categoría en un rango; jobs=trabajos en un rango; inventory=stock (críticos y búsqueda); month=cierre del mes (ingresos, gastos, ganancia); assets=equipos y mantenimientos; services=lista de precios; categories=categorías' },
      from: { type: 'string', description: 'YYYY-MM-DD' }, to: { type: 'string' }, category: { type: 'string' }, text: { type: 'string', description: 'Filtro por nombre (cliente, producto, activo)' }, days: { type: 'integer', description: 'Para agenda: cuántos días (default 7)' }
    }, required: ['topic'] } },
  { name: 'scan_receipt', description: 'La foto que acaba de mandar el usuario es un RECIBO O FACTURA DE COMPRA (líneas de productos con precios, ticket de supermercado, factura de proveedor, boleta de luz/agua/internet): mandala al escáner de recibos de Dusty, que la lee con más precisión y deja revisar línea por línea. No leas vos el recibo ni registres el gasto a mano.',
    input_schema: { type: 'object', properties: {}, required: [] } },
  { name: 'open_screen', description: 'Abre una pantalla de Dusty para que el usuario la vea.',
    input_schema: { type: 'object', properties: { screen: { type: 'string', enum: ['collect', 'jobs', 'equipment', 'inventory', 'receipts', 'budget', 'recap', 'settings', 'services', 'scan'] } }, required: ['screen'] } },
  { name: 'print', description: 'Genera un PDF para compartir o imprimir: el informe del mes, la cuenta de cobro de un trabajo, o la ficha de un equipo.',
    input_schema: { type: 'object', properties: { what: { type: 'string', enum: ['month_report', 'job_invoice', 'asset_sheet'] }, client: { type: 'string' }, asset: { type: 'string' }, month: { type: 'string', description: 'YYYY-MM, default el actual' } }, required: ['what'] } }
];

/* ---------- el manual: quién es, qué hace Dusty, cómo hablar ---------- */
function systemPrompt(lang) {
  const es = lang === 'es';
  return `${es ? 'Sos el asistente de Dusty' : 'You are the Dusty assistant'}, ${es ? 'una app para negocios chicos que lleva inventario, gastos, presupuesto, recibos escaneados y —si el negocio presta servicios— trabajos, cobros, equipo y mantenimientos. Hablás como un empleado de confianza: corto, concreto, sin adornos.' : 'an app for small businesses that tracks inventory, expenses, budget, scanned receipts and, for service businesses, jobs, payments, equipment and maintenance. You talk like a trusted employee: short, concrete, no fluff.'}

${es ? 'CÓMO FUNCIONA DUSTY' : 'HOW DUSTY WORKS'}
- ${es ? 'Gastos: cada pago es un "recibo" (escaneado o a mano). Tiene monto, fecha y categoría de gasto. Entra al presupuesto del mes y al cierre de mes.' : 'Expenses: each payment is a "receipt" (scanned or by hand) with amount, date and expense category. It counts against the monthly budget and the month close.'}
- ${es ? 'Inventario (si vende productos): productos con stock, costo y precio de venta; "críticos" son los que están por agotarse.' : 'Inventory (if it sells products): items with stock, cost and sale price; "critical" ones are about to run out.'}
- ${es ? 'Servicios (si presta servicios): TRABAJOS con cliente, servicio, precio, equipo usado y cobro (cobrado / pendiente con vencimiento). POR COBRAR es lo pendiente. EQUIPO/ACTIVOS son camiones, máquinas, herramientas; tienen MANTENIMIENTOS programados por km y/o meses. La lista de SERVICIOS trae precios. Los CONTRATOS son trabajos que se repiten.' : 'Services (if it provides services): JOBS with client, service, price, equipment used and payment (paid / pending with due date). TO COLLECT is what is pending. EQUIPMENT/ASSETS are trucks, machines, tools; they have scheduled MAINTENANCE by km and/or months. The SERVICES list carries prices. CONTRACTS are repeating jobs.'}
- ${es ? 'Calendario: recibos, notas, trabajos, vencimientos de cobro y mantenimientos, todo en el mismo calendario.' : 'Calendar: receipts, notes, jobs, payment due dates and maintenance, all in one calendar.'}

${es ? 'JERGA (cualquier país; entendé la intención, no la palabra exacta)' : 'SLANG (any country; read the intent, not the exact word)'}
- ${es ? '"cuartos", "plata", "lana", "feria", "billete", "money" = dinero. "un chin", "un poquito" = poco. "la guagua", "el camión", "la troca", "la van", "la blanca" = un equipo/activo (buscalo en la lista). "viaje", "flete", "vuelta", "carrera", "servicio", "trabajo", "laburo", "chamba" = un trabajo. "me pagaron", "cobré", "me cayó" = marcar cobrado. "me deben", "lo que me falta cobrar" = por cobrar. "gasolina", "nafta", "diésel", "combustible", "gas" = categoría Combustible. "el aceite", "los frenos", "las gomas/llantas" = mantenimiento.' : '"cash", "dough", "bucks" = money. "the truck", "the van", "the rig", "the white one" = an asset (look it up in the list). "run", "trip", "haul", "gig", "job" = a job. "they paid me", "got paid" = mark paid. "what they owe me" = to collect. "gas", "diesel", "fuel" = Fuel category. "oil", "brakes", "tires" = maintenance.'}

${es ? 'REGLAS' : 'RULES'}
1. ${es ? 'Solo podés hacer lo que las herramientas permiten. Si el pedido no existe en Dusty, decilo en una frase y ofrecé lo más cercano.' : 'You can only do what the tools allow. If the request does not exist in Dusty, say so in one sentence and offer the closest thing.'}
2. ${es ? 'Para responder con números o listas SIEMPRE consultá primero (query). Nunca inventes cifras ni nombres.' : 'To answer with numbers or lists ALWAYS query first. Never invent figures or names.'}
3. ${es ? 'Nombres de clientes, equipos, categorías, productos y servicios: usá los de las listas del contexto (aunque el usuario los diga distinto). Si no hay ninguno parecido, usá lo que dijo el usuario.' : 'Client, asset, category, item and service names: use the ones from the context lists (even if the user says them differently). If nothing is close, use what the user said.'}
4. ${es ? 'Si falta un dato imprescindible (el monto de un gasto, el cliente o el precio de un trabajo), preguntá UNA sola cosa, corta. Lo demás asumilo con sentido común (fecha = hoy, cobro = pendiente a 15 días) y decilo en la respuesta.' : 'If an essential piece is missing (an expense amount, a job client or price), ask ONE short question. Assume the rest sensibly (date = today, payment = pending in 15 days) and say so.'}
5. ${es ? 'Podés encadenar varias herramientas en un mismo pedido ("gasté 500 en gasolina y 200 en peajes" son dos gastos).' : 'You may chain several tools for one request ("spent 500 on gas and 200 on tolls" is two expenses).'}
6. ${es ? 'Respondé en el idioma del usuario, en 1 a 3 frases, con los montos formateados ($1,450.00). Sin markdown, sin listas largas, sin emojis salvo uno al inicio si ayuda.' : 'Answer in the user\'s language, 1 to 3 sentences, amounts formatted ($1,450.00). No markdown, no long lists, at most one emoji.'}
7. ${es ? 'Las acciones que escriben las confirma el usuario en la app antes de ejecutarse; si el resultado dice "cancelled", no insistas.' : 'Write actions are confirmed by the user in the app before running; if a result says "cancelled", do not insist.'}
9. ${es ? 'Sí podés dar consejos y análisis de SU negocio (precios, márgenes, qué cliente o equipo rinde más, dónde recortar) siempre que salgan de sus datos (consultá primero). Lo que no tenga que ver con el negocio ni con Dusty (temas generales, otras apps) no lo respondas: una frase y de vuelta a lo suyo.' : 'You MAY give advice and analysis about THEIR business (prices, margins, which client or asset performs best, where to cut) as long as it comes from their data (query first). Anything unrelated to the business or Dusty (general topics, other apps): one sentence and back to their business.'}
10. ${es ? 'FOTOS: si el usuario manda una foto, primero decidí qué es. Recibo o factura de compra → scan_receipt (siempre, sin excepción). Cualquier otro documento (orden de trabajo, presupuesto de un cliente, factura de taller, lista a mano, captura de un pedido, contrato) → leelo, decí en una frase qué entendiste y proponé la acción que corresponda con las herramientas (un trabajo, un mantenimiento, una nota, un gasto). Si no se lee, decilo y pedí otra foto. Nunca inventes montos que no se vean.' : 'PHOTOS: when the user sends a photo, first decide what it is. A purchase receipt or invoice → scan_receipt (always). Any other document (work order, client quote, workshop invoice, handwritten list, order screenshot, contract) → read it, say in one sentence what you understood and propose the matching action with the tools (a job, a maintenance, a note, an expense). If unreadable, say so and ask for another photo. Never invent amounts you cannot see.'}
8. ${es ? 'Fechas: el contexto trae la fecha de hoy. "ayer", "el lunes", "la semana pasada" se resuelven desde ahí.' : 'Dates: the context carries today\'s date. Resolve "yesterday", "Monday", "last week" from it.'}`;
}

/* ---------- ¿pedido complejo? → modelo grande ----------
   Análisis, comparaciones, consejos, proyecciones, varios montos o frases largas
   con varias acciones. Lo simple (un gasto, un trabajo, quién me debe) queda en
   el modelo rápido. Se decide por el ÚLTIMO texto del usuario, así una vuelta
   con resultados de herramientas sigue con el mismo modelo que la empezó. */
const COMPLEX_RE = /\b(compar|convien|conven|mejor|peor|por qu[eé]|porque|anali|recomend|deber[ií]a|tendenc|promedio|proyec|margen|rentab|diferenc|versus|vs\.?|estrateg|optimi|ahorr|reduc|subir|bajar el precio|cu[aá]nto m[aá]s|cu[aá]nto menos|should|why|compare|better|worse|recommend|advice|advise|trend|average|forecast|profit|margin|analy|optimi|save money|raise|lower the price|what if|si subo|si bajo|resumen|summary|explic|explain)/i;
function lastUserText(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== 'user') continue;
    const tb = m.content.find(b => b.type === 'text');
    if (tb) return tb.text;
  }
  return '';
}
function needsBigModel(text) {
  const t = String(text || '');
  if (COMPLEX_RE.test(t)) return true;
  const amounts = (t.match(/\d[\d.,]*/g) || []).length;
  if (amounts >= 3) return true;
  const clauses = t.split(/\b(y|and|menos|pero|but|excepto|except)\b/i).length;
  return t.length > 160 || clauses >= 5;
}

function nImagesReserved(res) { return (res && Number.isFinite(res.count)) ? res.count : 1; }

/* ---------- cupo del agente ---------- */
async function reserveAgentTurn(ownerUid, caller) {
  if (await isUnlimitedAccount(ownerUid)) return { allowed: true, limit: null, used: null };
  const db = admin.firestore();
  const ref = db.doc(`users/${ownerUid}/meta/billing`);
  const period = currentBillingPeriod();
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() : {};
    let limit, used;
    if (caller.isAnonymous) { limit = AGENT_LIMIT_TRIAL; used = data.agentTotal || 0; }
    else { limit = AGENT_LIMIT_MONTH; used = data.agentPeriod === period ? (data.agentUsed || 0) : 0; }
    if (used + 1 > limit) return { allowed: false, limit, used };
    tx.set(ref, {
      agentUsed: (data.agentPeriod === period ? (data.agentUsed || 0) : 0) + 1,
      agentPeriod: period,
      agentTotal: (data.agentTotal || 0) + 1
    }, { merge: true });
    return { allowed: true, limit, used: used + 1 };
  });
}

/* ---------- limpieza del historial que manda el cliente ---------- */
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
function cleanMessages(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  const src = raw.slice(-MAX_MESSAGES);
  // Las fotos viajan solo en el ÚLTIMO mensaje del usuario: las anteriores se
  // reemplazan por una marca, si no cada vuelta volvería a pagar todas las imágenes.
  let lastUserIdx = -1; src.forEach((m, i) => { if (m && m.role === 'user') lastUserIdx = i; });
  src.forEach((m, idx) => {
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) return;
    let content = m.content;
    if (typeof content === 'string') content = [{ type: 'text', text: content }];
    if (!Array.isArray(content)) return;
    const blocks = content.map(b => {
      if (!b || typeof b !== 'object') return null;
      if (b.type === 'text') return typeof b.text === 'string' && b.text.trim() ? { type: 'text', text: b.text.slice(0, MAX_TEXT) } : null;
      if (b.type === 'tool_use') return (typeof b.id === 'string' && typeof b.name === 'string') ? { type: 'tool_use', id: b.id, name: b.name, input: (b.input && typeof b.input === 'object') ? b.input : {} } : null;
      if (b.type === 'tool_result') return typeof b.tool_use_id === 'string' ? { type: 'tool_result', tool_use_id: b.tool_use_id, content: String(b.content == null ? '' : b.content).slice(0, MAX_TEXT) } : null;
      if (b.type === 'image') {
        if (idx !== lastUserIdx) return { type: 'text', text: '[imagen enviada antes]' };
        const src = b.source || {};
        if (src.type !== 'base64' || typeof src.data !== 'string' || !src.data || src.data.length > 7000000) return null;
        return { type: 'image', source: { type: 'base64', media_type: IMAGE_TYPES.indexOf(src.media_type) >= 0 ? src.media_type : 'image/jpeg', data: src.data } };
      }
      return null;
    }).filter(Boolean);
    // Máximo 3 fotos por mensaje.
    let imgs = 0; for (let i = blocks.length - 1; i >= 0; i--) { if (blocks[i].type === 'image' && ++imgs > 3) blocks.splice(i, 1); }
    if (blocks.length) out.push({ role: m.role, content: blocks });
  });
  // La conversación tiene que empezar por el usuario y alternar; si el recorte
  // dejó un assistant primero, se descarta.
  while (out.length && out[0].role !== 'user') out.shift();
  return out;
}

exports.needsBigModel = needsBigModel;
exports.handler = withCors(async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: JSON.stringify({ error: 'Método no permitido' }) };
  if (!isAllowedOrigin(event)) return { statusCode: 403, body: JSON.stringify({ error: 'Origen no permitido' }) };
  if (!process.env.ANTHROPIC_API_KEY) return { statusCode: 500, body: JSON.stringify({ error: 'Falta configurar ANTHROPIC_API_KEY en Netlify' }) };

  const caller = await verifyCallerInfo(event);
  if (!caller) return { statusCode: 401, body: JSON.stringify({ error: 'Iniciá sesión para usar el asistente', code: 'auth_required' }) };
  const callerUid = caller.uid;

  let messages, context = '', lang = 'en', ownerUid;
  try {
    const parsed = JSON.parse(event.body || '{}');
    messages = cleanMessages(parsed.messages);
    if (typeof parsed.context === 'string') context = parsed.context.slice(0, 6000);
    if (parsed.lang === 'es') lang = 'es';
    ownerUid = typeof parsed.ownerUid === 'string' && parsed.ownerUid ? parsed.ownerUid : callerUid;
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Body inválido', code: 'bad_request' }) };
  }
  if (!messages.length) return { statusCode: 400, body: JSON.stringify({ error: 'Sin mensaje', code: 'bad_request' }) };

  let quota, scanReservation = null;
  try {
    if (!(await callerCanUseAccount(callerUid, ownerUid))) return { statusCode: 403, body: JSON.stringify({ error: 'No tienes acceso a esa cuenta', code: 'no_access' }) };
    if ((await getAccessState(ownerUid, caller)).locked) return subscriptionRequiredResponse();
    if (!(await checkIpRateLimit(event))) return { statusCode: 429, body: JSON.stringify({ error: 'Demasiados pedidos seguidos — espera un rato', code: 'rate_limited' }) };
    // Solo la vuelta que arranca con un pedido NUEVO del usuario descuenta cupo:
    // las continuaciones con resultados de herramientas son parte del mismo pedido.
    const last = messages[messages.length - 1];
    const isToolTurn = last.role === 'user' && last.content.every(b => b.type === 'tool_result');
    const nImages = (!isToolTurn && last.role === 'user') ? last.content.filter(b => b.type === 'image').length : 0;
    if (nImages) {
      // Una foto por el agente es un escaneo: mismo cupo que el lector de recibos,
      // si no sería la forma de escanear gratis saltándose el límite.
      scanReservation = await reserveScanQuota(ownerUid, caller, nImages);
      if (scanReservation) scanReservation.count = nImages;
      if (!scanReservation.allowed) return { statusCode: 429, body: JSON.stringify({ error: caller.isAnonymous ? 'Usaste los escaneos gratis de prueba. Guarda tu cuenta para seguir.' : 'Llegaste al límite de escaneos de tu plan este mes', quotaExceeded: true }) };
      quota = Number.isFinite(scanReservation.limit) ? { limit: scanReservation.limit, used: scanReservation.used } : null;
    } else if (!isToolTurn) {
      quota = await reserveAgentTurn(ownerUid, caller);
      if (!quota.allowed) return { statusCode: 429, body: JSON.stringify({ error: caller.isAnonymous ? 'Usaste los pedidos gratis de prueba. Guarda tu cuenta para seguir.' : 'Llegaste al límite de pedidos al asistente de este mes', quotaExceeded: true, quota }) };
    }
  } catch (e) {
    console.error('[Dusty] agente: error verificando cupo:', e);
    return { statusCode: 500, body: JSON.stringify({ error: 'No se pudo verificar tu cupo, intenta de nuevo', code: 'quota_check_failed' }) };
  }

  const hasImage = messages.some(m => m.role === 'user' && m.content.some(b => b.type === 'image'));
  // Leer un documento sí necesita el modelo grande.
  const deep = hasImage || needsBigModel(lastUserText(messages));
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: deep ? AGENT_MODEL_BIG : AGENT_MODEL,
        max_tokens: deep ? (hasImage ? 1400 : 1000) : 700,
        // El manual y las herramientas se cachean (no cambian entre pedidos); el
        // contexto del usuario va aparte porque sí cambia.
        system: [
          { type: 'text', text: systemPrompt(lang), cache_control: { type: 'ephemeral' } },
          { type: 'text', text: (lang === 'es' ? 'CONTEXTO DEL USUARIO\n' : 'USER CONTEXT\n') + context }
        ],
        tools: TOOLS.map((t, i) => i === TOOLS.length - 1 ? Object.assign({}, t, { cache_control: { type: 'ephemeral' } }) : t),
        messages
      })
    });
    const data = await response.json();
    if (data.error) {
      console.error('[Dusty] agente: error de la API:', data.error);
      if (scanReservation && scanReservation.period) await refundScanUsage(ownerUid, nImagesReserved(scanReservation), scanReservation.period);
      return { statusCode: 502, body: JSON.stringify({ error: data.error.message || 'Error del asistente', code: 'upstream_error' }) };
    }
    return { statusCode: 200, body: JSON.stringify({ content: data.content || [], stop_reason: data.stop_reason || null, quota: quota || null, model: deep ? 'deep' : 'fast' }) };
  } catch (err) {
    console.error('[Dusty] agente: fallo de red:', err);
    if (scanReservation && scanReservation.period) await refundScanUsage(ownerUid, nImagesReserved(scanReservation), scanReservation.period).catch(()=>{});
    return { statusCode: 500, body: JSON.stringify({ error: 'Error interno', code: 'internal' }) };
  }
});
