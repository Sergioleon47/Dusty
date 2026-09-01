/* ================= NUDGY-CORE =================
   Parser de lenguaje natural para las notas del calendario, extraído del proyecto
   hermano Nudgy (Desktop/nudgy/index.html) — el mismo motor que ahí convierte texto
   libre en alarmas, acá convierte texto libre en notas de calendario de Dusty.

   Reglas de esta copia:
   - La LÓGICA de cada extractor se mantiene textual respecto a Nudgy (mismo estilo
     `var`, mismos regex) a propósito: es código probado en producción y cada
     "modernización" sería una oportunidad de romperlo en silencio. Si Nudgy arregla
     un bug de parsing, el arreglo se puede traer copiando la función de vuelta.
   - Todo lo que en Nudgy significaba "ahora" (new Date()) acá pasa por nowDate(),
     para que los tests puedan congelar el reloj con __setNow() y ser deterministas.
     Es el ÚNICO cambio dentro de los cuerpos portados.
   - Sin DOM, sin estado de la app, sin i18n: funciones puras de texto → datos.
     El texto de la vista previa ("se repite cada lunes") lo arma la app con su
     propio t(), no este archivo.
   - El parsing entiende español e inglés SIEMPRE, sin importar el idioma de la UI
     (mismo criterio que Nudgy).

   Qué se portó: fechas ("15 de agosto", "august 15th", "el 12", "hoy", "mañana",
   días de semana con typos tolerados), horas ("a las 2 y media", "8 de la noche",
   "noon"), tiempo relativo ("en 3 días"), recurrencias ("cada mes", "cada 2
   semanas"→no, "cada 2 días/meses/años/horas", "todos los lunes", "lunes y
   miércoles", "de lunes a viernes", "entre semana") y cortes ("hasta diciembre",
   "hasta las 8pm").
   Qué NO se portó (a propósito, no lo usa el calendario de Dusty todavía):
   rangos de días ("del 1 al 15 de agosto"), próxima-ocurrencia para alarmas,
   export .ics, checklists. Viven en Nudgy si algún día hacen falta. */

// Reloj congelable: los tests fijan un "ahora" para que "mañana" o "en 3 días"
// den siempre el mismo resultado. En la app nunca se llama a __setNow.
var _nudgyNow = null;
function nudgySetNow(iso){ _nudgyNow = iso; }
function nowDate(){ return _nudgyNow ? new Date(_nudgyNow) : new Date(); }

// ---------- Fuzzy matching (typos comunes) ----------
// Levenshtein clásico + transposición de letras adyacentes contada como UNA sola
// edición — "imercoles" (primeras dos letras al revés) queda a distancia 1 de
// "miercoles" y pasa el umbral de tolerancia.
function levenshtein(a, b){
  a = a.toLowerCase(); b = b.toLowerCase();
  var m = a.length, n = b.length;
  var dp = [];
  for (var i = 0; i <= m; i++){ dp.push([i]); }
  for (var j = 0; j <= n; j++){ dp[0][j] = j; }
  for (i = 1; i <= m; i++){
    for (j = 1; j <= n; j++){
      if (a[i-1] === b[j-1]) dp[i][j] = dp[i-1][j-1];
      else dp[i][j] = 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
      if (i > 1 && j > 1 && a[i-1] === b[j-2] && a[i-2] === b[j-1]){
        dp[i][j] = Math.min(dp[i][j], dp[i-2][j-2] + 1);
      }
    }
  }
  return dp[m][n];
}
// Guardia previa a correr levenshtein contra cada nombre de día/mes: la primera
// letra tiene que coincidir, O las primeras dos están traspuestas.
function firstLettersFuzzyOk(w, base){
  if (w[0] === base[0]) return true;
  return w.length > 1 && base.length > 1 && w[0] === base[1] && w[1] === base[0];
}

// ---------- Constantes de parsing (bilingües) ----------
var nudgyMonthsEs = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
var nudgyMonthsEn = ['January','February','March','April','May','June','July','August','September','October','November','December'];
var nudgyDayWords = {
  'domingo':0,'lunes':1,'martes':2,'miercoles':3,'miércoles':3,'jueves':4,'viernes':5,'sabado':6,'sábado':6,
  'sunday':0,'monday':1,'tuesday':2,'wednesday':3,'thursday':4,'friday':5,'saturday':6
};
// Números escritos en letras ("dos", "three"), acotados SOLO a las posiciones de
// cantidad de los regex de abajo — nunca un reemplazo general del texto, así "una"
// en "una reunión" no se toca.
var numberWordsEs = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7,
  ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15,
  dieciseis: 16, 'dieciséis': 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20,
  veintiuno: 21, veintiuna: 21, veintidos: 22, 'veintidós': 22, veintitres: 23, 'veintitrés': 23,
  veinticuatro: 24, veinticinco: 25, veintiseis: 26, 'veintiséis': 26, veintisiete: 27,
  veintiocho: 28, veintinueve: 29, treinta: 30
};
var numberWordsEn = {
  zero: 0, a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30
};
var numberWordNames = Object.keys(numberWordsEs).concat(Object.keys(numberWordsEn));
numberWordNames.sort(function(a, b){ return b.length - a.length; });
var NUM_TOKEN_SRC = '(?:\\d{1,3}|' + numberWordNames.join('|') + ')';
function parseNumberToken(s){
  if (s == null) return null;
  var low = s.toLowerCase();
  if (numberWordsEs.hasOwnProperty(low)) return numberWordsEs[low];
  if (numberWordsEn.hasOwnProperty(low)) return numberWordsEn[low];
  var n = parseInt(s, 10);
  return isNaN(n) ? null : n;
}

// ---------- Extractores de fecha ----------
function extractRelativeTime(text){
  var m = text.match(new RegExp('\\b(?:en|in)\\s+(' + NUM_TOKEN_SRC + ')\\s*(minutos?|mins?|horas?|hrs?|hours?|minutes?|dias?|d[ií]as?|days?|semanas?|weeks?)\\b', 'i'));
  if (!m) return null;
  var qty = parseNumberToken(m[1]);
  if (qty == null) return null;
  var unit = m[2].toLowerCase();
  var target = nowDate();
  if (unit.indexOf('h') === 0){
    target.setHours(target.getHours() + qty);
  } else if (unit.indexOf('semana') === 0 || unit.indexOf('week') === 0){
    target.setDate(target.getDate() + qty * 7);
  } else if (unit.indexOf('dia') === 0 || unit.indexOf('día') === 0 || unit.indexOf('day') === 0){
    target.setDate(target.getDate() + qty);
  } else {
    target.setMinutes(target.getMinutes() + qty);
  }
  return { match: m[0], target: target };
}
function extractSpecificDate(text){
  var reThisMonth = /\b(\d{1,2})\s*de\s*este\s*mes\b/i;
  var m0 = reThisMonth.exec(text);
  if (m0){
    var day0 = parseInt(m0[1], 10);
    if (day0 >= 1 && day0 <= 31) return { match: m0[0], day: day0, month: nowDate().getMonth(), year: null };
  }
  var re = /\b(\d{1,2})\s*(?:de|of)?\s*([a-záéíóúñA-Z]+)(?:\s*(?:de|,)?\s*(\d{4}))?\b/gi;
  var m;
  while ((m = re.exec(text))){
    var day = parseInt(m[1], 10);
    if (day < 1 || day > 31) continue;
    var monthIdx = findMonthIndex(m[2].toLowerCase());
    if (monthIdx === -1) continue;
    var year = m[3] ? parseInt(m[3], 10) : null;
    return { match: m[0], day: day, month: monthIdx, year: year };
  }
  // Orden "Month Day" del inglés ("August 15", "August 15th, 2026") — el regex de
  // arriba solo entiende "Day Month" (la convención del español).
  var reMonthFirst = /\b([a-záéíóúñA-Z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*,?\s*(\d{4}))?\b/gi;
  while ((m = reMonthFirst.exec(text))){
    var day2 = parseInt(m[2], 10);
    if (day2 < 1 || day2 > 31) continue;
    var monthIdx2 = findMonthIndex(m[1].toLowerCase());
    if (monthIdx2 === -1) continue;
    var year2 = m[3] ? parseInt(m[3], 10) : null;
    return { match: m[0], day: day2, month: monthIdx2, year: year2 };
  }
  return null;
}
function findMonthIndex(word){
  for (var mi = 0; mi < 12; mi++){
    var baseEs = nudgyMonthsEs[mi].toLowerCase();
    var baseEn = nudgyMonthsEn[mi].toLowerCase();
    if (word[0] === baseEs[0] && levenshtein(word, baseEs) <= 1) return mi;
    if (word[0] === baseEn[0] && levenshtein(word, baseEn) <= 1) return mi;
  }
  return -1;
}
function extractBareDayOfMonth(text){
  var m = text.match(/\bon\s+the\s+(\d{1,2})(?:st|nd|rd|th)?\b/i);
  if (m){ var d1 = parseInt(m[1], 10); if (d1 >= 1 && d1 <= 31) return { match: m[0], day: d1 }; }
  m = text.match(/\bel\s+(\d{1,2})\b(?!\s*de)/i);
  if (m){ var d2 = parseInt(m[1], 10); if (d2 >= 1 && d2 <= 31) return { match: m[0], day: d2 }; }
  m = text.match(/\b(\d{1,2})(?:st|nd|rd|th)\b/i);
  if (m){ var d3 = parseInt(m[1], 10); if (d3 >= 1 && d3 <= 31) return { match: m[0], day: d3 }; }
  return null;
}
function resolveBareDay(day){
  var now = nowDate();
  // Un número de día puede pasarse del fin de un mes corto (día 30 metido en un
  // Date de febrero) — JS lo desborda a marzo en silencio en vez de recortarlo,
  // así que se limita explícitamente al último día real de cada mes candidato.
  var daysInThisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  var candidate = new Date(now.getFullYear(), now.getMonth(), Math.min(day, daysInThisMonth));
  var todayOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (candidate < todayOnly) {
    var nextMonth = now.getMonth() + 1;
    var daysInNextMonth = new Date(now.getFullYear(), nextMonth + 1, 0).getDate();
    candidate = new Date(now.getFullYear(), nextMonth, Math.min(day, daysInNextMonth));
  }
  return candidate;
}
function extractWeekdayRange(text){
  var names = Object.keys(nudgyDayWords).join('|');
  var m = text.match(new RegExp('\\bde\\s+(' + names + ')\\s+a\\s+(' + names + ')\\b', 'i'));
  if (!m) m = text.match(new RegExp('\\b(' + names + ')\\s+to\\s+(' + names + ')\\b', 'i'));
  if (!m) return null;
  var start = nudgyDayWords[m[1].toLowerCase()];
  var end = nudgyDayWords[m[2].toLowerCase()];
  if (start == null || end == null) return null;
  var days = [];
  var i = start;
  for (var c = 0; c < 7; c++){
    days.push(i);
    if (i === end) break;
    i = (i + 1) % 7;
  }
  return { match: m[0], days: days };
}
// "lunes y miercoles", "lunes, miercoles y viernes", "monday and wednesday" — lista
// de días sueltos (no necesariamente consecutivos), a diferencia del rango de arriba.
function extractWeekdayList(text){
  var names = Object.keys(nudgyDayWords).join('|');
  var reEs = new RegExp('\\b((?:' + names + ')(?:\\s*,\\s*(?:' + names + '))*\\s+y\\s+(?:' + names + '))\\b', 'i');
  var reEn = new RegExp('\\b((?:' + names + ')(?:\\s*,\\s*(?:' + names + '))*\\s+and\\s+(?:' + names + '))\\b', 'i');
  var m = text.match(reEs) || text.match(reEn);
  if (!m) return null;
  var parts = m[1].split(/\s*,\s*|\s+y\s+|\s+and\s+/i);
  var days = [];
  for (var i = 0; i < parts.length; i++){
    var d = nudgyDayWords[parts[i].trim().toLowerCase()];
    if (d != null && days.indexOf(d) === -1) days.push(d);
  }
  if (days.length < 2) return null;
  days.sort(function(a,b){ return a - b; });
  return { match: m[1], days: days };
}

// ---------- Recurrencias ----------
function extractEveryNDays(text){
  var m = text.match(new RegExp('\\bcada\\s+(' + NUM_TOKEN_SRC + ')\\s*d[ií]as\\b', 'i')) ||
          text.match(new RegExp('\\bevery\\s+(' + NUM_TOKEN_SRC + ')\\s*days\\b', 'i'));
  if (!m) return null;
  var n = parseNumberToken(m[1]);
  if (n == null || n < 2) return null;
  return { match: m[0], n: n };
}
function extractEveryNYears(text){
  var m = text.match(new RegExp('\\bcada\\s+(' + NUM_TOKEN_SRC + ')\\s*a[ñn]os\\b', 'i')) ||
          text.match(new RegExp('\\bevery\\s+(' + NUM_TOKEN_SRC + ')\\s*years\\b', 'i'));
  if (m){
    var n = parseNumberToken(m[1]);
    if (n == null || n < 2) return null;
    return { match: m[0], n: n };
  }
  var m2 = text.match(/\bcada\s+a[ñn]o\b/i) || text.match(/\bevery\s+year\b/i);
  if (m2) return { match: m2[0], n: 1 };
  return null;
}
function extractEveryNMonths(text){
  var m = text.match(new RegExp('\\bcada\\s+(' + NUM_TOKEN_SRC + ')\\s*meses\\b', 'i')) ||
          text.match(new RegExp('\\bevery\\s+(' + NUM_TOKEN_SRC + ')\\s*months\\b', 'i'));
  if (m){
    var n = parseNumberToken(m[1]);
    if (n == null || n < 2) return null;
    return { match: m[0], n: n };
  }
  var m2 = text.match(/\bcada\s+mes\b/i) || text.match(/\bevery\s+month\b/i);
  if (m2) return { match: m2[0], n: 1 };
  return null;
}
function extractEveryNHours(text){
  var m = text.match(new RegExp('\\bcada\\s+(' + NUM_TOKEN_SRC + ')\\s*horas?\\b', 'i')) ||
          text.match(new RegExp('\\bevery\\s+(' + NUM_TOKEN_SRC + ')\\s*hours?\\b', 'i'));
  if (m){
    var n = parseNumberToken(m[1]);
    if (n == null || n < 1) return null;
    return { match: m[0], n: n };
  }
  var m2 = text.match(/\bcada\s+hora\b/i) || text.match(/\bevery\s+hour\b/i);
  if (m2) return { match: m2[0], n: 1 };
  return null;
}
function extractRecurringExact(text){
  var everyHours = extractEveryNHours(text);
  if (everyHours) return { type: 'everyNHours', n: everyHours.n, match: everyHours.match };
  var everyDays = extractEveryNDays(text);
  if (everyDays) return { type: 'everyNDays', n: everyDays.n, match: everyDays.match };
  var everyYears = extractEveryNYears(text);
  if (everyYears) return { type: 'everyNYears', n: everyYears.n, match: everyYears.match };
  var everyMonths = extractEveryNMonths(text);
  if (everyMonths) return { type: 'everyNMonths', n: everyMonths.n, match: everyMonths.match };
  var range = extractWeekdayRange(text);
  if (range) return { type: 'weekly', weekdays: range.days, match: range.match };
  var list = extractWeekdayList(text);
  if (list) return { type: 'weekly', weekdays: list.days, match: list.match };
  var wd = text.match(/\bweekdays?\b/i) || text.match(/\bentre\s+semana\b/i) || text.match(/\bd[ií]as?\s+h[áa]biles\b/i);
  if (wd) return { type: 'weekly', weekdays: [1,2,3,4,5], match: wd[0] };
  var m = text.match(/todos\s+los\s+d[ií]as/i) || text.match(/\bevery\s*day\b/i);
  if (m) return { type: 'daily', match: m[0] };
  for (var name in nudgyDayWords){
    var re = new RegExp('todos\\s+los\\s+' + name + 's?\\b', 'i');
    var found = text.match(re);
    if (found) return { type: 'weekly', weekdays: [nudgyDayWords[name]], match: found[0] };
    var re2 = new RegExp('\\bevery\\s+' + name + 's?\\b', 'i');
    var found2 = text.match(re2);
    if (found2) return { type: 'weekly', weekdays: [nudgyDayWords[name]], match: found2[0] };
  }
  return null;
}
function fuzzyRecurringMatch(text){
  var tokens = [];
  var re = /[a-záéíóúñA-Z]+/gi, m;
  while ((m = re.exec(text))) tokens.push({ w: m[0], i: m.index });
  for (var i = 0; i < tokens.length - 2; i++){
    var w0 = tokens[i].w.toLowerCase();
    var w1 = tokens[i+1].w.toLowerCase();
    var w2raw = tokens[i+2].w;
    var w2 = w2raw.toLowerCase().replace(/s$/, '');
    if (w0[0] === 't' && w1[0] === 'l' && levenshtein(w0, 'todos') <= 1 && levenshtein(w1, 'los') <= 1){
      if (levenshtein(w2, 'dia') <= 1) return { type: 'daily', match: text.slice(tokens[i].i, tokens[i+2].i + w2raw.length) };
      for (var name in nudgyDayWords){
        var base = name.replace(/s$/, '');
        if (base.length >= 4 && firstLettersFuzzyOk(w2, base) && levenshtein(w2, base) <= 1){
          return { type: 'weekly', weekdays: [nudgyDayWords[name]], match: text.slice(tokens[i].i, tokens[i+2].i + w2raw.length) };
        }
      }
    }
  }
  return null;
}
function extractRecurring(text){ return extractRecurringExact(text) || fuzzyRecurringMatch(text); }

// ---------- Horas ----------
// "de la tarde" / "at night" / etc — meridiano hablado, equivalente a "am"/"pm".
function extractMeridiemWord(text){
  var m = text.match(/\b(?:de|en)\s+la\s+tarde\b/i) || text.match(/\bin\s+the\s+afternoon\b/i);
  if (m) return { match: m[0], mer: 'pm' };
  m = text.match(/\b(?:de|en)\s+la\s+noche\b/i) || text.match(/\bin\s+the\s+evening\b/i) || text.match(/\bat\s+night\b/i);
  if (m) return { match: m[0], mer: 'pm' };
  m = text.match(/\b(?:de|en)\s+la\s+ma[ñn]ana\b/i) || text.match(/\bin\s+the\s+morning\b/i);
  if (m) return { match: m[0], mer: 'am' };
  m = text.match(/\b(?:de|en)\s+la\s+madrugada\b/i);
  if (m) return { match: m[0], mer: 'am' };
  return null;
}
function extractNoonMidnight(text){
  var m = text.match(/\b(?:al?\s+)?mediod[ií]a\b/i) || text.match(/\bnoon\b/i);
  if (m) return { match: m[0], h: 12, mnt: 0 };
  m = text.match(/\b(?:a\s+la\s+)?medianoche\b/i) || text.match(/\bmidnight\b/i);
  if (m) return { match: m[0], h: 0, mnt: 0 };
  return null;
}
function extractTime(text){
  var noonMidnight = extractNoonMidnight(text);
  if (noonMidnight) return { match: noonMidnight.match, h: noonMidnight.h, mnt: noonMidnight.mnt, mer: null };
  var meridiemInfo = extractMeridiemWord(text);
  var m = text.match(/(\d{1,2}):(\d{2})\s*(a\.?\s?m\.?|p\.?\s?m\.?)?/i);
  if (m){
    var mer0 = m[3] ? m[3].replace(/[.\s]/g,'').toLowerCase() : (meridiemInfo ? meridiemInfo.mer : null);
    return { match: m[0], h: parseInt(m[1],10), mnt: parseInt(m[2],10), mer: mer0 };
  }
  m = text.match(/\b(\d{1,2})\s*(a\.?\s?m\.?|p\.?\s?m\.?)\b/i);
  if (m) return { match: m[0], h: parseInt(m[1],10), mnt: 0, mer: m[2].replace(/[.\s]/g,'').toLowerCase() };
  m = text.match(/a\s*las\s*(\d{3,4})\b/i);
  if (m){
    var d = m[1];
    var h = d.length === 3 ? parseInt(d.slice(0,1),10) : parseInt(d.slice(0,2),10);
    var mnt = d.length === 3 ? parseInt(d.slice(1),10) : parseInt(d.slice(2),10);
    return { match: m[0], h: h, mnt: mnt, mer: null };
  }
  // "a la una" / "a las dos" / "at two" — hora en letras, más el dígito pelado
  // ("a las 8") vía NUM_TOKEN_SRC. También levanta "y media" / "y cuarto".
  m = text.match(new RegExp('\\b(?:a\\s*(?:la|las|los)|at)\\s*(' + NUM_TOKEN_SRC + ')\\b', 'i'));
  if (m){
    var h2 = parseNumberToken(m[1]);
    if (h2 == null) return null;
    var mnt2 = 0;
    var matchText = m[0];
    var restAfter = text.slice(m.index + m[0].length);
    var half = restAfter.match(/^\s*y\s+media\b/i);
    if (half){ mnt2 = 30; matchText += half[0]; }
    else {
      var quarter = restAfter.match(/^\s*y\s+cuarto\b/i);
      if (quarter){ mnt2 = 15; matchText += quarter[0]; }
    }
    return { match: matchText, h: h2, mnt: mnt2, mer: meridiemInfo ? meridiemInfo.mer : null };
  }
  return null;
}
function normalizeHour(h, mnt, mer){
  if (mer === 'pm' && h < 12) h += 12;
  if (mer === 'am' && h === 12) h = 0;
  if (h === 24) h = 0;
  if (h < 0 || h > 23 || mnt < 0 || mnt > 59) return null;
  return { h: h, mnt: mnt };
}

// ---------- Días sueltos ("hoy", "mañana", "el lunes") ----------
function extractDayExact(text){
  var low = text.toLowerCase();
  if (/\bhoy\b|\btoday\b/.test(low)) return { type: 'today', match: low.match(/\bhoy\b|\btoday\b/)[0] };
  var mm = low.match(/\bma[nñ]ana\b|\btomorrow\b/);
  if (mm) return { type: 'tomorrow', match: mm[0] };
  for (var name in nudgyDayWords){
    var re = new RegExp('\\b' + name + '\\b', 'i');
    var found = text.match(re);
    if (found) return { type: 'weekday', weekday: nudgyDayWords[name], match: found[0] };
  }
  return null;
}
function fuzzyDayMatch(text){
  var tokens = text.match(/[a-záéíóúñA-Z]+/gi) || [];
  for (var i = 0; i < tokens.length; i++){
    var raw = tokens[i];
    var wNorm = raw.toLowerCase().replace('ñ', 'n');
    if (wNorm[0] === 'm' && levenshtein(wNorm, 'manana') <= 1) return { type: 'tomorrow', match: raw };
    if (wNorm[0] === 't' && levenshtein(wNorm, 'tomorrow') <= 1) return { type: 'tomorrow', match: raw };
    var w = raw.toLowerCase().replace(/s$/, '');
    for (var name in nudgyDayWords){
      var base = name.replace(/s$/, '');
      if (base.length >= 4 && firstLettersFuzzyOk(w, base) && levenshtein(w, base) <= 1) return { type: 'weekday', weekday: nudgyDayWords[name], match: raw };
    }
  }
  return null;
}
function extractDay(text){ return extractDayExact(text) || fuzzyDayMatch(text); }
function resolveTarget(h, mnt, dayInfo){
  var now = nowDate();
  var target = new Date(now);
  target.setHours(h, mnt, 0, 0);
  if (dayInfo){
    if (dayInfo.type === 'tomorrow') target.setDate(target.getDate() + 1);
    else if (dayInfo.type === 'weekday'){
      var diff = (dayInfo.weekday - now.getDay() + 7) % 7;
      if (diff === 0 && target <= now) diff = 7;
      target.setDate(now.getDate() + diff);
    }
  } else {
    if (target <= now) target.setDate(target.getDate() + 1);
  }
  return target;
}
function resolveDayOnly(dayInfo){
  var now = nowDate();
  var todayOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (dayInfo.type === 'tomorrow'){ var d = new Date(todayOnly); d.setDate(d.getDate() + 1); return d; }
  if (dayInfo.type === 'today') return todayOnly;
  if (dayInfo.type === 'weekday'){
    var diff = (dayInfo.weekday - now.getDay() + 7) % 7;
    if (diff === 0) diff = 7;
    var d2 = new Date(todayOnly); d2.setDate(d2.getDate() + diff); return d2;
  }
  return todayOnly;
}

// ---------- Cortes ("hasta ...") ----------
// "cada 2 horas hasta las 8pm" — corte de reloj dentro del día, solo con everyNHours.
// Anclado al final del texto para no confundirlo con "hasta el 15 de agosto".
function extractUntilHour(text){
  var mer = null, merMatch = '';
  var tailMer = text.match(/(?:\s*(?:de|en)\s+la\s+(?:tarde|noche|ma[ñn]ana|madrugada)|\s*in\s+the\s+(?:morning|afternoon|evening)|\s*at\s+night)\s*$/i);
  var workTail = text;
  if (tailMer){
    var info = extractMeridiemWord(tailMer[0]);
    if (info){ mer = info.mer; merMatch = tailMer[0]; workTail = text.slice(0, text.length - tailMer[0].length); }
  }
  var m = workTail.match(new RegExp('\\bhasta\\s+(?:las?\\s+)?(' + NUM_TOKEN_SRC + ')(?::(\\d{2}))?\\s*(a\\.?\\s?m\\.?|p\\.?\\s?m\\.?)?\\s*$', 'i'));
  if (!m) m = workTail.match(new RegExp('\\b(?:until|through)\\s+(' + NUM_TOKEN_SRC + ')(?::(\\d{2}))?\\s*(a\\.?\\s?m\\.?|p\\.?\\s?m\\.?)?\\s*$', 'i'));
  if (!m) return null;
  var h = parseNumberToken(m[1]);
  if (h == null) return null;
  var mnt = m[2] ? parseInt(m[2], 10) : 0;
  var finalMer = m[3] ? m[3].replace(/[.\s]/g, '').toLowerCase() : mer;
  var norm = normalizeHour(h, mnt, finalMer);
  if (!norm) return null;
  return { match: m[0] + merMatch, h: norm.h, mnt: norm.mnt };
}
// "... hasta el 15 de diciembre" / "until December 15" (también solo el mes:
// "hasta diciembre" = último día de ese mes) — fecha de corte para recurrencias.
function extractUntilDate(text){
  var m = text.match(/\bhasta\s+(?:el\s+)?(.+)/i) || text.match(/\b(?:until|through)\s+(.+)/i);
  if (!m) return null;
  var tail = m[1];
  var specific = extractSpecificDate(tail);
  if (specific){
    var year = specific.year;
    var candidate = new Date(year != null ? year : nowDate().getFullYear(), specific.month, specific.day, 23, 59, 59, 999);
    if (year == null && candidate < nowDate()) candidate.setFullYear(candidate.getFullYear() + 1);
    return { match: m[0], date: candidate };
  }
  for (var mi = 0; mi < 12; mi++){
    var reEs = new RegExp('\\b' + nudgyMonthsEs[mi] + '\\b', 'i');
    var reEn = new RegExp('\\b' + nudgyMonthsEn[mi] + '\\b', 'i');
    if (reEs.test(tail) || reEn.test(tail)){
      var y = nowDate().getFullYear();
      var lastDay = new Date(y, mi + 1, 0).getDate();
      var cand2 = new Date(y, mi, lastDay, 23, 59, 59, 999);
      if (cand2 < nowDate()) cand2 = new Date(y + 1, mi, lastDay, 23, 59, 59, 999);
      return { match: m[0], date: cand2 };
    }
  }
  return null;
}
function recurringFromInfo(recurInfo){
  if (recurInfo.type === 'daily') return { type: 'daily' };
  if (recurInfo.type === 'everyNDays') return { type: 'everyNDays', n: recurInfo.n };
  if (recurInfo.type === 'everyNYears') return { type: 'everyNYears', n: recurInfo.n };
  if (recurInfo.type === 'everyNMonths') return { type: 'everyNMonths', n: recurInfo.n };
  if (recurInfo.type === 'everyNHours') return { type: 'everyNHours', n: recurInfo.n };
  return { type: 'weekly', weekdays: recurInfo.weekdays };
}

// ---------- Entrada principal del parser ----------
// Misma cascada de prioridades que Nudgy: tiempo relativo > fecha específica > día
// pelado del mes > recurrencia > día de la semana. Devuelve {text, hour, minute,
// target (Date con hora), recurring, dateOnly (Date sin hora)} — la app decide cómo
// guardarlo (ver buildCalNote abajo).
function parseNoteInput(raw){
  var untilHourInfo = extractUntilHour(raw);
  var workText = raw;
  if (untilHourInfo){
    var hIdx = raw.indexOf(untilHourInfo.match);
    var hStripped = raw.slice(0, hIdx) + raw.slice(hIdx + untilHourInfo.match.length);
    var hRecur = extractRecurring(hStripped);
    if (hRecur && hRecur.type === 'everyNHours') workText = hStripped;
    else untilHourInfo = null; // el corte de reloj solo aplica a "cada N horas"
  }
  var untilInfo = untilHourInfo ? null : extractUntilDate(raw);
  if (untilInfo){
    var idx = raw.indexOf(untilInfo.match);
    var stripped = raw.slice(0, idx) + raw.slice(idx + untilInfo.match.length);
    if (extractRecurring(stripped)) workText = stripped;
    else untilInfo = null; // sin recurrencia que acotar, "hasta X" es la fecha de la nota
  }

  var relInfo = extractRelativeTime(workText);
  var specificDateInfo = relInfo ? null : extractSpecificDate(workText);
  var bareDayInfo = (relInfo || specificDateInfo) ? null : extractBareDayOfMonth(workText);
  var recurInfo = (relInfo || specificDateInfo || bareDayInfo) ? null : extractRecurring(workText);
  var dayInfo = (relInfo || specificDateInfo || bareDayInfo || recurInfo) ? null : extractDay(workText);
  var timeInfoRaw = extractTime(workText);
  var hour = null, minute = null, target = null, recurring = null, dateOnly = null;

  if (relInfo){
    target = relInfo.target;
    if (timeInfoRaw){
      var relNorm = normalizeHour(timeInfoRaw.h, timeInfoRaw.mnt, timeInfoRaw.mer);
      if (relNorm) target.setHours(relNorm.h, relNorm.mnt, 0, 0);
    }
    hour = target.getHours(); minute = target.getMinutes();
    return { text: raw, hour: hour, minute: minute, target: target, recurring: null, dateOnly: null };
  }
  if (timeInfoRaw){
    var norm = normalizeHour(timeInfoRaw.h, timeInfoRaw.mnt, timeInfoRaw.mer);
    if (norm){ hour = norm.h; minute = norm.mnt; }
  }
  if (specificDateInfo){
    if (specificDateInfo.year != null){
      var dateObj = new Date(specificDateInfo.year, specificDateInfo.month, specificDateInfo.day);
      if (hour != null){ target = new Date(dateObj); target.setHours(hour, minute, 0, 0); }
      else dateOnly = dateObj;
    } else {
      // Fecha sin año ("15 de agosto") — en Nudgy esto es un recordatorio ANUAL
      // (cumpleaños); acá se mantiene igual: se repite cada año ese día.
      recurring = { type: 'yearly', month: specificDateInfo.month, day: specificDateInfo.day };
    }
  } else if (bareDayInfo){
    var bareDate = resolveBareDay(bareDayInfo.day);
    if (hour != null){ target = new Date(bareDate); target.setHours(hour, minute, 0, 0); }
    else dateOnly = bareDate;
  } else if (hour != null){
    if (recurInfo){
      recurring = recurringFromInfo(recurInfo);
    } else if (dayInfo){
      var resolved = resolveDayOnly(dayInfo);
      target = new Date(resolved); target.setHours(hour, minute, 0, 0);
    } else {
      target = resolveTarget(hour, minute, null);
    }
  } else if (recurInfo){
    recurring = recurringFromInfo(recurInfo);
  } else if (dayInfo){
    dateOnly = resolveDayOnly(dayInfo);
  }
  if (recurring && untilInfo) recurring.until = untilInfo.date.toISOString();
  if (recurring && untilHourInfo){ recurring.untilHour = untilHourInfo.h; recurring.untilMinute = untilHourInfo.mnt; }
  return { text: raw, hour: hour, minute: minute, target: target, recurring: recurring, dateOnly: dateOnly };
}

// ---------- Recurrencia → días del calendario ----------
// ¿La recurrencia de esta nota cae en el día `d`? (respetando el corte "until").
// Copiada de recurringMatchesDay de Nudgy — es lo que pinta las notas recurrentes
// en cada celda del calendario sin materializar ocurrencias.
function recurringMatchesDay(recurring, createdAt, d){
  if (recurring.until && d > new Date(recurring.until)) return false;
  if (recurring.type === 'daily') return true;
  if (recurring.type === 'weekly') return recurring.weekdays.indexOf(d.getDay()) !== -1;
  if (recurring.type === 'yearly') return recurring.month === d.getMonth() && recurring.day === d.getDate();
  if (recurring.type === 'everyNDays'){
    var anchor = new Date(createdAt);
    var anchorMid = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
    var dMid = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (dMid < anchorMid) return false;
    var diffDays = Math.round((dMid - anchorMid) / (24*60*60*1000));
    return diffDays % recurring.n === 0;
  }
  if (recurring.type === 'everyNYears'){
    var anchorY = new Date(createdAt);
    if (d.getMonth() !== anchorY.getMonth() || d.getDate() !== anchorY.getDate()) return false;
    var yearsDiff = d.getFullYear() - anchorY.getFullYear();
    return yearsDiff >= 0 && yearsDiff % recurring.n === 0;
  }
  if (recurring.type === 'everyNMonths'){
    var anchorMo = new Date(createdAt);
    var monthsDiff = (d.getFullYear() - anchorMo.getFullYear()) * 12 + (d.getMonth() - anchorMo.getMonth());
    if (monthsDiff < 0 || monthsDiff % recurring.n !== 0) return false;
    var lastDayOfDMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    var expectedDay = Math.min(anchorMo.getDate(), lastDayOfDMonth);
    return d.getDate() === expectedDay;
  }
  if (recurring.type === 'everyNHours'){
    // Dentro del calendario (que trabaja por día) una nota "cada N horas" cuenta
    // para todo día que tenga al menos una ocurrencia.
    var anchorH = new Date(createdAt);
    var anchorFloor = new Date(anchorH.getFullYear(), anchorH.getMonth(), anchorH.getDate(), anchorH.getHours(), anchorH.getMinutes(), 0, 0);
    var dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
    var dayEnd = new Date(dayStart.getTime() + 24*60*60*1000);
    if (dayEnd <= anchorFloor) return false;
    var intervalMs = recurring.n * 60 * 60 * 1000;
    var stepsToDayStart = Math.max(0, Math.ceil((dayStart.getTime() - anchorFloor.getTime()) / intervalMs));
    var firstInDay = new Date(anchorFloor.getTime() + stepsToDayStart * intervalMs);
    return firstInDay < dayEnd;
  }
  return false;
}

// ---------- Adaptación a Dusty ----------
// "YYYY-MM-DD" en hora LOCAL (new Date('YYYY-MM-DD') interpreta UTC y puede caer
// en el día anterior según el huso — por eso ni se usa ni se genera por toISOString).
function calDateStr(d){
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
function calDateFromStr(s){
  var p = s.split('-').map(Number);
  return new Date(p[0], p[1]-1, p[2], 12, 0, 0, 0); // mediodía: inmune a DST
}
// Emoji según el tipo de actividad detectado — la idea es de Nudgy (pickActivityIcon,
// que devolvía iconos de Tabler); acá son emoji (mismo criterio que la órbita del
// botón de escanear: en el teléfono se dibujan a color, sin sumar assets) y se
// agregaron palabras del dominio de Dusty (proveedores, pedidos, vencimientos).
function calNoteEmoji(text){
  var tt = text.toLowerCase();
  if (/cumple|cumpleañ|cumpleanos|birthday/.test(tt)) return '🎂';
  if (/pagar|pago|payment|factura|bill\b|renta|rent\b|vence|vencimiento|due\b/.test(tt)) return '💳';
  if (/proveedor|supplier|entrega|delivery|pedido|\border\b|reponer|restock/.test(tt)) return '📦';
  if (/reuni[oó]n|junta|meeting/.test(tt)) return '👥';
  if (/llamar|llamada|\bcall\b/.test(tt)) return '📞';
  if (/doctor|m[eé]dico|cita|appointment/.test(tt)) return '🩺';
  if (/viaje|vuelo|flight|trip\b/.test(tt)) return '✈️';
  if (/inventario|conteo|inventory|count\b/.test(tt)) return '📋';
  return '📌';
}
/* Convierte lo que escribió el usuario en la forma en que Dusty guarda una nota de
   calendario. anchorDateStr es el día que estaba abierto en el modal:
   - Si el texto no trae NINGUNA información de fecha ("pagar la luz"), la nota se
     ancla a ese día — lo que cualquiera espera al escribir dentro de un día concreto.
   - Si el texto trae una recurrencia por intervalo ("cada mes", "cada 3 días"),
     el ancla del intervalo también es ESE día, no hoy. En Nudgy esas recurrencias
     se anclan al momento de escribir la nota porque allá no existe "escribir dentro
     de un día" — acá sí, y "pagar la renta cada mes" escrito en el 15 tiene que
     caer los 15, no los 1 solo porque hoy es 1. anchorDate viaja en la nota y
     calNotesOnDate lo prefiere sobre createdAt.
   Si el texto pide una fecha explícita ("mañana", "el 20 de octubre"), el parser manda. */
function buildCalNote(raw, anchorDateStr){
  var parsed = parseNoteInput(raw);
  var date = null;
  if (parsed.target) date = calDateStr(parsed.target);
  else if (parsed.dateOnly) date = calDateStr(parsed.dateOnly);
  else if (!parsed.recurring) date = anchorDateStr || calDateStr(nowDate());
  return {
    text: raw.trim(),
    date: date,                       // null si es puramente recurrente
    hour: parsed.hour, minute: parsed.minute,
    recurring: parsed.recurring || null,
    anchorDate: (parsed.recurring && anchorDateStr) ? anchorDateStr : null,
    icon: calNoteEmoji(raw)
  };
}
// Todas las notas (fijas o recurrentes) que caen en un "YYYY-MM-DD".
function calNotesOnDate(notes, dateStr){
  var d = calDateFromStr(dateStr);
  return notes.filter(function(n){
    if (n.recurring){
      // El ancla de las recurrencias por intervalo: el día del modal donde se
      // escribió (anchorDate) si existe; si no, el momento de creación (Nudgy).
      var anchor = n.anchorDate ? (n.anchorDate + 'T12:00:00') : n.createdAt;
      return recurringMatchesDay(n.recurring, anchor, d);
    }
    return n.date === dateStr;
  });
}

// Solo bajo Node (tests) — en el navegador "module" no existe y las funciones
// quedan como globales normales, igual que patron-core.js.
if(typeof module!=='undefined' && module.exports){
  module.exports = {
    nudgySetNow, levenshtein, firstLettersFuzzyOk, parseNumberToken,
    extractRelativeTime, extractSpecificDate, extractBareDayOfMonth, extractWeekdayRange,
    extractWeekdayList, extractRecurring, extractTime, extractDay, extractUntilDate,
    extractUntilHour, normalizeHour, parseNoteInput, recurringMatchesDay,
    calDateStr, calDateFromStr, calNoteEmoji, buildCalNote, calNotesOnDate
  };
}
