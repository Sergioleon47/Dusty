// nudgy-core.test.js
//
// Pruebas del parser de notas de calendario portado desde Nudgy. Se corren con:
//   node --test
// El reloj se congela con nudgySetNow() en cada test que dependa de "hoy" — sin
// eso, "mañana" o "en 3 días" darían un resultado distinto según el día en que se
// corran los tests y fallarían al azar.

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  nudgySetNow, parseNoteInput, buildCalNote, calNotesOnDate, calNoteEmoji,
  calDateStr, calDateFromStr, extractTime, extractUntilDate, recurringMatchesDay
} = require('./nudgy-core.js');

// Lunes 2026-09-07, 10:00 de la mañana — un ancla arbitraria pero fija.
const FROZEN = '2026-09-07T10:00:00';
test.beforeEach(()=>nudgySetNow(FROZEN));

test('fecha específica en español ("el 15 de diciembre a las 3pm")', ()=>{
  const n = buildCalNote('pagar aguinaldo el 15 de diciembre de 2026 a las 3pm', null);
  assert.equal(n.date, '2026-12-15');
  assert.equal(n.hour, 15);
  assert.equal(n.minute, 0);
  assert.equal(n.recurring, null);
});

test('fecha sin año se vuelve recordatorio anual (comportamiento Nudgy)', ()=>{
  const p = parseNoteInput('cumpleaños de mamá el 15 de agosto');
  assert.equal(p.recurring.type, 'yearly');
  assert.equal(p.recurring.month, 7);
  assert.equal(p.recurring.day, 15);
});

test('inglés "August 15th, 2026" (orden mes-día)', ()=>{
  const n = buildCalNote('renew license August 15th, 2026', null);
  assert.equal(n.date, '2026-08-15');
});

test('"mañana" con typo ("manana") resuelve al día siguiente del ancla', ()=>{
  const n = buildCalNote('viene el proveedor manana', null);
  assert.equal(n.date, '2026-09-08');
});

test('día de semana con typo ("imercoles" = miércoles próximo)', ()=>{
  const n = buildCalNote('pedido grande el imercoles', null);
  assert.equal(n.date, '2026-09-09'); // el lunes 7 + 2 días = miércoles 9
});

test('"en 3 días" es relativo al ahora congelado', ()=>{
  const n = buildCalNote('revisar stock en 3 dias', null);
  assert.equal(n.date, '2026-09-10');
});

test('"cada mes" produce recurrencia mensual sin fecha fija', ()=>{
  const n = buildCalNote('pagar la renta cada mes', null);
  assert.equal(n.date, null);
  assert.equal(n.recurring.type, 'everyNMonths');
  assert.equal(n.recurring.n, 1);
});

test('"cada dos semanas" NO existe como patrón — cae a nota sin fecha anclada al día', ()=>{
  // Documentación viva de una limitación heredada de Nudgy: semanas solo funcionan
  // como "todos los lunes" / "de lunes a viernes", no como "cada 2 semanas".
  const n = buildCalNote('algo cada dos semanas', '2026-09-20');
  assert.equal(n.recurring, null);
  assert.equal(n.date, '2026-09-20'); // ancla del día abierto en el modal
});

test('"todos los lunes" pinta los lunes del calendario', ()=>{
  const note = {text:'conteo todos los lunes', recurring:{type:'weekly', weekdays:[1]}, createdAt: FROZEN, date:null};
  assert.equal(calNotesOnDate([note], '2026-09-14').length, 1); // lunes
  assert.equal(calNotesOnDate([note], '2026-09-15').length, 0); // martes
});

test('"cada 3 días" ancla en createdAt y respeta el intervalo', ()=>{
  const note = {text:'turno rotativo cada 3 dias', recurring:{type:'everyNDays', n:3}, createdAt: FROZEN, date:null};
  assert.equal(calNotesOnDate([note], '2026-09-07').length, 1); // día 0
  assert.equal(calNotesOnDate([note], '2026-09-08').length, 0);
  assert.equal(calNotesOnDate([note], '2026-09-10').length, 1); // día 3
});

test('"cada mes" en día 31 cae al último día de meses cortos', ()=>{
  const note = {text:'cierre mensual cada mes', recurring:{type:'everyNMonths', n:1}, createdAt:'2026-08-31T09:00:00', date:null};
  assert.equal(calNotesOnDate([note], '2026-09-30').length, 1); // septiembre tiene 30
  assert.equal(calNotesOnDate([note], '2026-10-31').length, 1);
});

test('"hasta diciembre" corta la recurrencia después del último día del mes', ()=>{
  const p = parseNoteInput('pagar cuota cada mes hasta diciembre');
  assert.equal(p.recurring.type, 'everyNMonths');
  const until = new Date(p.recurring.until);
  assert.equal(until.getMonth(), 11);
  const note = {text:'x', recurring:p.recurring, createdAt: FROZEN, date:null};
  assert.equal(calNotesOnDate([note], '2026-10-07').length, 1);
  assert.equal(calNotesOnDate([note], '2027-01-07').length, 0); // pasado el corte
});

test('"hasta el 15 de agosto" SIN recurrencia no se aplica como corte', ()=>{
  // Comportamiento heredado de Nudgy tal cual: sin patrón recurrente, el "hasta X"
  // se descarta como corte y "15 de agosto" (fecha sin año) sigue la regla general
  // de fecha-sin-año = recordatorio ANUAL de ese día.
  const p = parseNoteInput('vacaciones hasta el 15 de agosto');
  assert.equal(p.recurring.type, 'yearly');
  assert.equal(p.recurring.month, 7);
  assert.equal(p.recurring.day, 15);
  assert.equal(p.recurring.until, undefined); // el "hasta" no quedó como corte
});

test('horas habladas: "a las cuatro y media de la tarde" = 16:30', ()=>{
  const t = extractTime('llamar al contador a las cuatro y media de la tarde');
  assert.equal(t.h, 4); assert.equal(t.mnt, 30); assert.equal(t.mer, 'pm');
  const p = parseNoteInput('llamar al contador a las cuatro y media de la tarde');
  assert.equal(p.hour, 16); assert.equal(p.minute, 30);
});

test('"mediodía" y "midnight" como horas exactas', ()=>{
  assert.equal(parseNoteInput('entrega al mediodia').hour, 12);
  assert.equal(parseNoteInput('backup at midnight').hour, 0);
});

test('nota sin ninguna fecha se ancla al día abierto en el modal', ()=>{
  const n = buildCalNote('vino el técnico del freezer', '2026-09-03');
  assert.equal(n.date, '2026-09-03');
  assert.equal(n.recurring, null);
  assert.equal(n.hour, null);
});

test('emoji por tipo de actividad (incluye dominio Dusty)', ()=>{
  assert.equal(calNoteEmoji('pagar la luz'), '💳');
  assert.equal(calNoteEmoji('viene el proveedor de carnes'), '📦');
  assert.equal(calNoteEmoji('conteo de inventario'), '📋');
  assert.equal(calNoteEmoji('cumpleaños de Ana'), '🎂');
  assert.equal(calNoteEmoji('nota cualquiera'), '📌');
});

test('calDateStr/calDateFromStr van y vuelven sin corrimiento de huso', ()=>{
  const s = '2026-01-01';
  assert.equal(calDateStr(calDateFromStr(s)), s);
});

test('"cada mes" escrito en el modal del día 15 se ancla al 15, no a hoy', ()=>{
  // Diferencia deliberada con Nudgy: allá las recurrencias por intervalo se anclan
  // al momento de escribir (no existe "escribir dentro de un día"); acá el día
  // abierto en el modal ES el ancla que el usuario está eligiendo.
  const n = buildCalNote('pagar la renta cada mes', '2026-09-15');
  assert.equal(n.anchorDate, '2026-09-15');
  const note = Object.assign(n, {id:'x', createdAt: FROZEN}); // creada el día 7
  assert.equal(calNotesOnDate([note], '2026-09-15').length, 1);
  assert.equal(calNotesOnDate([note], '2026-10-15').length, 1);
  assert.equal(calNotesOnDate([note], '2026-10-07').length, 0); // el día de creación NO manda
});

test('el texto original nunca se modifica (regla de oro de Nudgy)', ()=>{
  const raw = '  pagar la renta cada mes a las 9am  ';
  const n = buildCalNote(raw, null);
  assert.equal(n.text, raw.trim()); // solo trim de puntas, jamás se reescribe
});
