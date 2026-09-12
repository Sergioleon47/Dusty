/* ---------- ICONOS DE LÍNEA (reemplazan emoji sueltos como "ícono de UI") ---------
   Antes varios estados vacíos/insignias usaban un emoji (📦 🧾 ☁️ 📷 🔔 🕘) como si
   fuera un ícono — se ve distinto en cada sistema operativo/navegador y desentona
   con el resto de la app, que ya usa un lenguaje visual propio y consistente de
   íconos de línea (el gear de ajustes, la nube de sincronizar, el lápiz de editar,
   los de la barra inferior). Este set junta esos mismos trazos en un solo lugar
   para poder reusarlos como badge en vez de texto plano. */
const LINE_ICONS = {
  box: `<path d="M12.89 1.45l8 4A2 2 0 0 1 22 7.24v9.53a2 2 0 0 1-1.11 1.79l-8 4a2 2 0 0 1-1.79 0l-8-4a2 2 0 0 1-1.1-1.8V7.24a2 2 0 0 1 1.11-1.79l8-4a2 2 0 0 1 1.78 0z"/><polyline points="2.32 6.16 12 11 21.68 6.16"/><line x1="12" y1="22.76" x2="12" y2="11"/>`,
  receipt: `<path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2z"/><line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="15" y2="11"/>`,
  cloud: `<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>`,
  /* check y search nacieron para el aviso de "no hay resultados": ahí el ícono
     dice de qué se trata (todo en orden / no encontré nada) mejor que el box
     genérico al que caía el fallback. */
  check: `<circle cx="12" cy="12" r="9"/><polyline points="8.5 12.2 11 14.7 15.8 9.6"/>`,
  search: `<circle cx="11" cy="11" r="7"/><line x1="16.2" y1="16.2" x2="21" y2="21"/>`,
  camera: `<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>`,
  bell: `<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>`,
  clock: `<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>`,
  printer: `<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>`,
  share: `<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>`,
  chart: `<line x1="6" y1="20" x2="6" y2="15"/><line x1="12" y1="20" x2="12" y2="9"/><line x1="18" y1="20" x2="18" y2="4"/>`,
  barcode: `<line x1="4" y1="5" x2="4" y2="19"/><line x1="8" y1="5" x2="8" y2="19"/><line x1="12" y1="5" x2="12" y2="19"/><line x1="16" y1="5" x2="16" y2="19"/><line x1="20" y1="5" x2="20" y2="19"/>`,
  bolt: `<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>`,
  tag: `<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.83z"/><line x1="7" y1="7" x2="7.01" y2="7"/>`,
  // Hoja de ayuda y alta rápida (auditoría de primer minuto 2026-09-07).
  edit: `<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>`,
  'chevron-down': `<polyline points="6 9 12 15 18 9"/>`,
};
function lineIcon(name, size){
  const s = size||18;
  return `<svg viewBox="0 0 24 24" width="${s}" height="${s}" stroke="currentColor" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${LINE_ICONS[name]||LINE_ICONS.box}</svg>`;
}

/* Categoría de ícono por ingrediente, heurística por palabras clave en el nombre.
   Placeholder de apariencia — cuando definamos el contenido real se puede
   reemplazar por un selector manual o por categoría. */
function stockIconKey(name){
  const n = (name||'').toLowerCase();
  if(/beef|res\b|steak|carne de res|ground beef|molida/.test(n)) return 'beef';
  if(/pork|cerdo|bacon|tocino|jamon|jamón|\bham\b/.test(n)) return 'pork';
  if(/sausage|salchicha|chorizo/.test(n)) return 'sausage';
  if(/chicken|pollo/.test(n)) return 'chicken';
  if(/shrimp|camar/.test(n)) return 'shrimp';
  if(/fish|pescado|seafood|marisco|salmon|tilapia|atun|tuna/.test(n)) return 'fish';
  if(/\beggs?\b|huevo/.test(n)) return 'egg';
  if(/cheese|queso/.test(n)) return 'cheese';
  if(/milk|leche|cream|crema|butter|mantequilla|yogurt|yogur/.test(n)) return 'dairy';
  if(/tomato|tomate/.test(n)) return 'tomato';
  if(/onion|cebolla/.test(n)) return 'onion';
  if(/garlic|\bajo\b/.test(n)) return 'garlic';
  if(/lettuce|lechuga|spinach|espinaca|kale|arugula|r[úu]cula|greens/.test(n)) return 'lettuce';
  if(/pimienta|black pepper|paprika|comino|cumin|or[ée]gano|canela|cinnamon|clove|chili powder|especia|spice/.test(n)) return 'spice';
  if(/chili|chile|jalape|poblano|serrano|habanero|cayenne/.test(n)) return 'chili';
  if(/pepper|pimiento|piment[oó]n|bell pepper/.test(n)) return 'pepper';
  if(/potato|papas?\b|patata/.test(n)) return 'potato';
  if(/carrot|zanahoria/.test(n)) return 'carrot';
  if(/cucumber|pepino/.test(n)) return 'cucumber';
  if(/avocado|aguacate|palta/.test(n)) return 'avocado';
  if(/lime|lemon|limas?\b|lim[oó]n/.test(n)) return 'lime';
  if(/\bcorn\b|ma[ií]z|elote/.test(n)) return 'corn';
  if(/mushroom|hongo|champi/.test(n)) return 'mushroom';
  if(/tortilla/.test(n)) return 'tortilla';
  if(/bread|brioche|bun\b|\bpan de\b|panecillo/.test(n)) return 'bread';
  if(/\brice\b|arroz/.test(n)) return 'rice';
  if(/pasta|spaghetti|fideo|noodle/.test(n)) return 'pasta';
  if(/flour|harina/.test(n)) return 'flour';
  if(/sugar|az[uú]car/.test(n)) return 'sugar';
  if(/\bsalt\b|\bsal\b/.test(n)) return 'salt';
  if(/ketchup|catsup/.test(n)) return 'ketchup';
  if(/mustard|mostaza/.test(n)) return 'mustard';
  if(/mayo|mayonnaise|mayonesa/.test(n)) return 'mayo';
  if(/vinegar|vinagre/.test(n)) return 'vinegar';
  if(/\boil\b|aceite/.test(n)) return 'oil';
  if(/soda|soft drink|refresco|gaseosa|\bcola\b|sprite|pepsi/.test(n)) return 'soda';
  if(/juice|jugo|zumo/.test(n)) return 'juice';
  if(/coffee|caf[eé]/.test(n)) return 'coffee';
  if(/\bbeer\b|cerveza/.test(n)) return 'beer';
  if(/\bwine\b|\bvino\b/.test(n)) return 'wine';
  if(/\bwater\b|\baguas?\b/.test(n)) return 'water';
  if(/napkin|servilleta|paper towel|toalla de papel/.test(n)) return 'napkin';
  if(/\bcups?\b|\bvasos?\b|container|envase|to-go|takeout/.test(n)) return 'cup';
  if(/\bice\b|hielo/.test(n)) return 'ice';
  if(/soap|jab[oó]n|detergent|detergente|cleaner|limpiador/.test(n)) return 'soap';
  return 'box';
}

/* Plantillas reutilizables (botella / saco) para que las categorías de despensa
   y bebidas compartan la misma silueta y solo cambien de color. */
function bottleIconParts(bodyColor, capColor){
  return `<rect x="19" y="7" width="6" height="6" rx="1" fill="${capColor}"/>
    <path d="M17 15c0-2 1-3 2-3h8c1 0 2 1 2 3v4c3 2 4 5 4 9v9c0 2-2 4-4 4H17c-2 0-4-2-4-4v-9c0-4 1-7 4-9z" fill="${bodyColor}"/>
    <circle cx="24" cy="30" r="1.6" fill="#fff" opacity=".45"/>`;
}
function sackIconParts(bodyColor, accentColor){
  return `<rect x="15" y="22" width="18" height="18" rx="3" fill="${bodyColor}"/>
    <path d="M18 22c0-6 3-11 6-11s6 5 6 11" fill="none" stroke="${accentColor}" stroke-width="2"/>`;
}

/* Íconos ilustrados planos (no fotos), dibujados a mano para que combinen con el
   estilo de la app en vez de depender de los emoji del sistema operativo (que
   se ven distinto en cada celular/navegador). */
const STOCK_ICONS = {
  beef: `<path d="M10 27c-2-6 1-13 8-16 8-4 18-2 21 5 2 6-1 12-6 14-2 5-8 8-13 6-3-1-5-3-6-6-2-1-3-2-4-3z" fill="#C97B63"/>
    <circle cx="18" cy="24" r="1.6" fill="#fff" opacity=".55"/>
    <circle cx="24" cy="29" r="1.6" fill="#fff" opacity=".55"/>
    <circle cx="27" cy="22" r="1.4" fill="#fff" opacity=".45"/>`,
  chicken: `<ellipse cx="19" cy="17" rx="12" ry="10" fill="#E8A23C"/>
    <path d="M23 25c2 4 6 8 10 10 2 1 3 3 1 5s-4 1-5-1c-2-4-6-8-10-10z" fill="#F0D6A3"/>`,
  shrimp: `<path d="M33 11c5 2 7 9 4 15-3 6-10 9-17 7-5-1-8-6-6-10 1-3 4-4 7-3" fill="#E8896B"/>
    <path d="M14 25c-2 2-3 5-1 7 2 1 5 0 6-3" fill="#F3B49D"/>
    <circle cx="31" cy="15" r="1.5" fill="#7A2E1E"/>`,
  fish: `<path d="M6 24c6-8 17-10 25-6l7 6-7 6c-8 4-19 2-25-6z" fill="#6FAFC9"/>
    <path d="M38 24l6-4.5v9z" fill="#5D9CB6"/>
    <circle cx="15" cy="22" r="1.6" fill="#1C3E4A"/>`,
  cheese: `<path d="M6 34 L23 9 L42 34 Z" fill="#F0C23C"/>
    <circle cx="21" cy="27" r="2" fill="#D9A72B"/>
    <circle cx="29" cy="25" r="1.5" fill="#D9A72B"/>
    <circle cx="26" cy="31" r="1.6" fill="#D9A72B"/>`,
  tomato: `<circle cx="24" cy="27" r="14" fill="#D9463A"/>
    <path d="M18 14c2-3 6-4 6-4s4 1 6 4" stroke="#4C9A5B" stroke-width="3" fill="none" stroke-linecap="round"/>
    <ellipse cx="19" cy="22" rx="3" ry="2" fill="#fff" opacity=".25"/>`,
  tortilla: `<circle cx="24" cy="24" r="16" fill="#E8C58A"/>
    <circle cx="24" cy="24" r="16" fill="none" stroke="#C9A15C" stroke-width="2" stroke-dasharray="2 3.4"/>`,
  bread: `<path d="M8 30c0-11 7-19 16-19s16 8 16 19c0 3-2 4-4 4H12c-2 0-4-1-4-4z" fill="#D9A15C"/>
    <path d="M14 26c2-4 6-6 10-6s8 2 10 6" stroke="#B87F3D" stroke-width="2" fill="none" stroke-linecap="round" opacity=".6"/>`,
  flour: `<path d="M24 6v18" stroke="#C9A227" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M24 10c-3-2-6-1-7 1 1 3 4 3 7 1M24 10c3-2 6-1 7 1-1 3-4 3-7-1" fill="#E3C94A"/>
    <path d="M24 16c-3-2-6-1-7 1 1 3 4 3 7 1M24 16c3-2 6-1 7 1-1 3-4 3-7-1" fill="#E3C94A"/>
    <rect x="17" y="24" width="14" height="16" rx="2" fill="#F0E4C0"/>
    <path d="M17 31h14" stroke="#C9A227" stroke-width="1.4"/>`,
  oil: bottleIconParts('#8AA23C','#6E8F3A'),
  dairy: `<path d="M16 10l4-4h8l4 4v26a2 2 0 0 1-2 2H18a2 2 0 0 1-2-2z" fill="#EAF2F7"/>
    <path d="M20 6h8l-4 4z" fill="#D7E6EE"/>
    <rect x="16" y="20" width="16" height="12" fill="#CFE0EA"/>`,
  pork: `<path d="M10 20c-1-4 2-8 7-8 2-3 6-3 8 0 5 0 8 4 7 8-1 5-6 9-11 9s-10-4-11-9z" fill="#E8A38E"/>
    <path d="M14 20h4M22 19h4M30 21h4" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".7"/>`,
  sausage: `<path d="M10 18c3-4 8-6 13-4 3-6 12-6 16 0 4 3 5 9 1 13-5 5-14 5-20 0-6-3-11-6-10-9z" fill="#C9614A"/>
    <path d="M15 16c2 2 2 6 0 8M23 13c2 2 2 6 0 8M31 15c2 2 2 6 0 8" stroke="#A84836" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
  egg: `<ellipse cx="24" cy="26" rx="10" ry="13" fill="#F5EFE0"/>
    <ellipse cx="24" cy="26" rx="10" ry="13" fill="none" stroke="#E3D8BC" stroke-width="1.2"/>
    <ellipse cx="20" cy="21" rx="2.4" ry="1.6" fill="#fff" opacity=".6"/>`,
  onion: `<circle cx="24" cy="26" r="13" fill="#E4C9E0"/>
    <path d="M18 15c2-4 4-6 6-6s4 2 6 6" stroke="#B98CB0" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M16 20c4-2 12-2 16 0M15 26c5-2 13-2 18 0M16 32c4 2 12 2 16 0" stroke="#D2AACB" stroke-width="1.3" fill="none" opacity=".8"/>`,
  garlic: `<path d="M24 9c6 0 10 6 10 14 0 8-5 14-10 14s-10-6-10-14c0-8 4-14 10-14z" fill="#F2EEE3"/>
    <path d="M24 9v28M18 15c2 3 2 8 0 10M30 15c-2 3-2 8 0 10" stroke="#DCD5C2" stroke-width="1.3" fill="none"/>
    <path d="M20 8c1-2 3-3 4-3s3 1 4 3" stroke="#C9C0A6" stroke-width="2" fill="none" stroke-linecap="round"/>`,
  lettuce: `<path d="M24 9c9 0 15 7 15 16s-7 14-15 14-15-6-15-14S15 9 24 9z" fill="#8FC15C"/>
    <path d="M17 17c2 4 2 10 0 14M24 12c1 6 1 13 0 18M31 17c-2 4-2 10 0 14" stroke="#6FA344" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
  spice: `<rect x="16" y="16" width="16" height="18" rx="3" fill="#E0DCCB"/>
    <rect x="15" y="9" width="18" height="7" rx="2" fill="#C97B4A"/>
    <circle cx="21" cy="24" r="1.1" fill="#C97B4A"/><circle cx="27" cy="27" r="1.1" fill="#C97B4A"/><circle cx="24" cy="30" r="1.1" fill="#C97B4A"/>`,
  chili: `<path d="M13 13c9-4 21-2 23 6 1 5-3 10-10 10-9 0-16-7-17-13-1-2 1-3 4-3z" fill="#D9463A"/>
    <path d="M13 13c-2-2-2-5 0-6" stroke="#4C9A5B" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
  pepper: `<path d="M22 9c1-2 3-2 4 0l1 3c4 0 8 4 7 9-1 6-6 12-10 12s-9-6-9-12c0-4 2-8 5-9z" fill="#D9463A"/>
    <path d="M22 8c1-2 4-3 6-1" stroke="#4C9A5B" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
  potato: `<ellipse cx="24" cy="25" rx="14" ry="10" fill="#C99A63"/>
    <circle cx="18" cy="23" r="1.3" fill="#8A6636"/><circle cx="28" cy="27" r="1.3" fill="#8A6636"/><circle cx="24" cy="20" r="1.1" fill="#8A6636"/>`,
  carrot: `<path d="M16 14c9-3 18 1 20 10-7 5-18 4-22-2-2-3-1-6 2-8z" fill="#E8823C"/>
    <path d="M16 14l-4-5M20 12l-2-6M24 13l1-6" stroke="#5C9A4C" stroke-width="2" fill="none" stroke-linecap="round"/>`,
  cucumber: `<rect x="8" y="20" width="32" height="10" rx="5" fill="#7FB554" transform="rotate(-8 24 25)"/>`,
  avocado: `<path d="M24 8c7 3 11 11 11 18a11 11 0 0 1-22 0c0-7 4-15 11-18z" fill="#6FA35A"/>
    <circle cx="24" cy="27" r="6" fill="#8A5A32"/>`,
  lime: `<circle cx="24" cy="24" r="14" fill="#9AC63C"/>
    <path d="M24 12v24M14 20l20 8M14 28l20-8" stroke="#7FA82C" stroke-width="1" opacity=".5"/>`,
  corn: `<path d="M22 8c6 0 9 5 9 14s-4 18-9 18-9-9-9-18 3-14 9-14z" fill="#F0C23C"/>
    <path d="M18 13h8M17 18h9M17 23h9M18 28h7M19 32h5" stroke="#D9A72B" stroke-width="1.4"/>
    <path d="M22 8c-3-3-8-3-10 0M26 8c3-3 8-3 10 0" stroke="#6FA35A" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
  mushroom: `<path d="M10 22c0-7 6-12 14-12s14 5 14 12c0 2-2 3-4 3H14c-2 0-4-1-4-3z" fill="#C97B63"/>
    <rect x="20" y="25" width="8" height="13" rx="3" fill="#F0E4D0"/>
    <circle cx="16" cy="18" r="1" fill="#fff" opacity=".5"/><circle cx="24" cy="15" r="1.2" fill="#fff" opacity=".5"/><circle cx="31" cy="19" r="1" fill="#fff" opacity=".5"/>`,
  rice: sackIconParts('#F5F2E8','#DDD6BE'),
  pasta: `<path d="M12 34c2-8 2-16 0-24M20 34c2-8 2-16 0-24M28 34c2-8 2-16 0-24M36 34c2-8 2-16 0-24" stroke="#E8C158" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  sugar: sackIconParts('#FFFFFF','#E3E3E3'),
  salt: sackIconParts('#EAF2F5','#CFE0E6'),
  ketchup: bottleIconParts('#D9463A','#7A2E1E'),
  mustard: bottleIconParts('#E8C23C','#7A6A1E'),
  mayo: bottleIconParts('#F5F2E8','#C9C2A6'),
  vinegar: bottleIconParts('#C9A15C','#6E5A2E'),
  water: bottleIconParts('#BFE0EE','#6FAFC9'),
  soap: bottleIconParts('#8FC1D9','#5C93A8'),
  soda: `<rect x="16" y="8" width="16" height="30" rx="4" fill="#D9463A"/>
    <rect x="16" y="8" width="16" height="6" rx="3" fill="#C43A2F"/>
    <ellipse cx="24" cy="10" rx="6" ry="1.6" fill="#B23327"/>`,
  juice: `<path d="M17 10h14l2 5v19a2 2 0 0 1-2 2H17a2 2 0 0 1-2-2V15z" fill="#E8A23C"/>
    <path d="M17 10h14l1 3H16z" fill="#D9903A"/>
    <rect x="22" y="6" width="4" height="6" fill="#F0C77A"/>`,
  coffee: `<path d="M12 18h20v10a10 10 0 0 1-10 10 10 10 0 0 1-10-10z" fill="#6E4A2E"/>
    <path d="M32 20h3a4 4 0 0 1 0 8h-3" fill="none" stroke="#6E4A2E" stroke-width="2.4"/>
    <path d="M17 12c1-2 3-2 3-4M23 12c1-2 3-2 3-4" stroke="#B99A7C" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
  beer: `<path d="M14 16h16v18a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4z" fill="#E8A23C"/>
    <path d="M30 20h4a3 3 0 0 1 0 6h-4" fill="none" stroke="#C9862E" stroke-width="2.2"/>
    <path d="M14 16c-1-4 2-6 6-5 1-3 6-3 7 0 3-1 6 1 5 5z" fill="#F5F0E0"/>`,
  wine: `<path d="M18 8h12l-2 12a4 4 0 0 1-8 0z" fill="#7A2E4A"/>
    <rect x="23" y="26" width="2" height="9" fill="#7A2E4A"/>
    <rect x="18" y="35" width="12" height="2.4" rx="1.2" fill="#7A2E4A"/>`,
  napkin: `<rect x="10" y="10" width="28" height="28" rx="3" fill="#FFFFFF" stroke="#DADCE0" stroke-width="1.4"/>
    <path d="M10 24h28M24 10v28" stroke="#DADCE0" stroke-width="1.2"/>`,
  cup: `<path d="M14 14h20l-2 20a3 3 0 0 1-3 3H19a3 3 0 0 1-3-3z" fill="#F0C23C"/>
    <ellipse cx="24" cy="14" rx="10" ry="2.4" fill="#E0A62B"/>`,
  ice: `<rect x="13" y="13" width="22" height="22" rx="3" fill="#CDEBF5"/>
    <path d="M13 13l22 22M35 13L13 35" stroke="#fff" stroke-width="1.6" opacity=".7"/>`,
  box: `<path d="M8 16l16-8 16 8-16 8-16-8z" fill="#B9BEC4"/>
    <path d="M8 16v16l16 8V24z" fill="#9AA0A6"/>
    <path d="M40 16v16l-16 8V24z" fill="#CBD0D6"/>`,
};

/* EXPERIMENTO: fotos reales (Wikimedia Commons, de libre uso) para las categorías más
   comunes, en vez del ícono plano dibujado a mano — para comparar cómo se ven. Necesitan
   internet para cargar (a diferencia de los SVG, que son parte del archivo); si no cargan
   (sin señal), el círculo simplemente se queda vacío en vez de mostrar un ícono roto. */
/* Un brillo suave arriba-a-la-izquierda le da a cualquier ícono plano una sensación
   de profundidad/pulido (como un ícono de app premium) sin tener que rehacer a mano
   cada una de las 46 ilustraciones — se agrega una sola vez acá, encima de lo que sea. */
function stockIconFallbackSvg(key){
  return `<svg viewBox="0 0 48 48">${STOCK_ICONS[key] || STOCK_ICONS.box}<ellipse cx="17" cy="13" rx="10" ry="6.5" fill="#fff" opacity="0.22"/></svg>`;
}
function stockIconSvg(item){
  // Acepta tanto un ingrediente completo (para poder usar su foto propia si tiene)
  // como, por compatibilidad, un string suelto con el nombre.
  const name = typeof item==='string' ? item : (item && item.name) || '';
  const key = stockIconKey(name);
  // 1. Prioridad máxima: foto que el usuario subió a mano para este producto
  //    específico — pensado para productos que no son comida (electrodomésticos,
  //    ferretería, etc.), donde ningún ícono automático tiene sentido.
  const ownPhoto = item && typeof item==='object' ? itemPhotoSrc(item) : null;
  if(ownPhoto){
    // escapeHtml en el src: la foto (url/mediaType) puede venir de un compañero de equipo
    // vía Firestore; sin escapar, un " en esos campos rompe el atributo e inyecta onerror.
    // key siempre sale de la whitelist de stockIconKey (constante), así que ahí no hay riesgo.
    return `<img src="${escapeHtml(ownPhoto)}" alt="" ${imgLoadAttr(ownPhoto)} decoding="async" onerror="this.outerHTML=stockIconFallbackSvg('${key}')">`;
  }
  // (El experimento de fotos genéricas hotlinkeadas de Wikimedia se quitó: era
  // una dependencia externa en una app por lo demás autocontenida — IPs de los
  // usuarios viajando a un tercero en cada Dashboard, círculos vacíos offline, y
  // Wikimedia desaconseja el hotlinking. Los 46 íconos SVG propios ya cubren todo.)
  return stockIconFallbackSvg(key);
}
function stockStatus(pct){ return pct>=60 ? 'ok' : pct>=20 ? 'warn' : 'crit'; }
// A diferencia de stockStatus (pct alto = bien, queda stock), acá pct alto = mal
// (ya gastaste esa parte del presupuesto) — la escala va al revés a propósito.
function budgetStatus(pct){ return pct>=100 ? 'crit' : pct>=80 ? 'warn' : 'ok'; }

/* El "lleno" de la barra es stockFullRef: el nivel que quedó después de la ÚLTIMA
   entrada de stock (compra escaneada, alta con cantidad, edición al alza, conteo
   mayor). Decisión del usuario 2026-09-03: "siempre que entre, la barra full" —
   entra mercadería → 100% verde; solo las salidas la van bajando. stockTarget
   quedó como override manual futuro, y para ítems viejos sin marca todavía, la
   estimación de siempre. Un ingrediente sin compras y en 0 no es "crítico" de
   verdad — se marca aparte ('none') en vez de asustar con todo en rojo el día 1. */
function stockRowsData(){
  // Los ítems de GASTO (servicios, Eat out) no son mercadería: viven en el
  // botón de Presupuesto, no en estas grillas (pedido del usuario 2026-09-05).
  // Y los PRODUCTOS TERMINADOS viven en la pestaña Producción: son stock igual,
  // pero mezclarlos acá haría parecer que se compran, cuando se fabrican.
  return inventory.filter(i=>!isExpenseItem(i) && !i.finishedGood).map(i=>{
    const hasHistory = (i.qtyOnHand||0)>0 || purchasesForIng(i.id).length>0;
    const target = i.stockFullRef || i.stockTarget || Math.max(Math.round((i.qtyOnHand||0)*1.5), 10);
    const pct = target>0 ? Math.min(100, Math.round(((i.qtyOnHand||0)/target)*100)) : 0;
    /* AGOTADO: tuvo movimiento alguna vez y hoy esta en CERO — vendiste todo.
       Es EXACTAMENTE la misma condicion que ya lo volvia critico, asi que no
       cambia ningun numero: sigue contando en la baldosa del Dashboard y en el
       chip Critico, que es donde el usuario quiere verlo para reponerlo. Lo
       unico nuevo es que ahora tiene nombre, y con nombre se puede dibujar
       distinto. Un producto que NUNCA tuvo stock no es agotado: es nuevo. */
    const agotado = hasHistory && (i.qtyOnHand||0)===0;
    return {ing:i, target, pct, agotado, status: hasHistory ? stockStatus(pct) : 'none'};
  });
}

/* Búsqueda laxa del inventario: cada letra/número filtra en vivo, sin exigir
   precisión (pedido del usuario) — se normaliza (minúsculas, sin acentos) y cada
   palabra tecleada solo tiene que APARECER en el nombre, en cualquier orden:
   "12 cab" encuentra "Non-Metallic Sheathed Cable (12-2...)". */
let invSearch = '';
function invSearchNorm(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,''); }
function invMatches(name, q){
  const nq = invSearchNorm(q).trim();
  if(!nq) return true;
  const nn = invSearchNorm(name);
  return nq.split(/\s+/).every(tok=>nn.includes(tok));
}
function dashboardView(){
  /* DASHBOARD reorganizado (maqueta aprobada por el usuario 2026-09-07, "ármalo
     así mismo"): menos repetido, más "qué hago hoy".
     1. dos botones arriba (Ayuda vive en Ajustes) — ver topbar en app-04;
     2. UN solo bloque de presupuesto: inversión del mes + gastos con barra y
        "quedan" en la misma tarjeta (adiós a la franja repetida de abajo);
     3. fila de herramientas con nombre, como Inventario: Productos ·
        Escanear recibo (grande) · A mano — sin la órbita de emojis; Compartir
        cuenta vive en Ajustes › Cuenta;
     4. "Hoy": Críticos / Toca contar / Salud del stock — cada número abre el
        Inventario ya filtrado (reemplaza "Estado del inventario", que era el
        Inventario otra vez con su selector de vista);
     5. Pedido sugerido como fila con su línea;
     6. Último recibo como fila. Producción y Cambios siguen como filas: sin
        ellas el hub y la actividad quedaban inalcanzables. */
  const months = allMonths();
  // SIEMPRE el mes calendario (auditoría de presupuesto 2026-09-07).
  const currentMonthKey = localMonthStr();
  const currentSpend = spendForMonth(currentMonthKey);
  const allRows = inventory.length>0 ? stockRowsData() : [];
  const critRows = allRows.filter(r=>r.status==='crit');
  const ccDueIds = inventory.length>0 ? cycleCountDueIds() : new Set();
  const graded = allRows.filter(r=>r.status!=='none');
  const healthPct = graded.length ? Math.round(graded.filter(r=>r.status==='ok').length/graded.length*100) : null;
  const lastReceipt = receipts.filter(r=>r && !r.manual).sort((a,b)=>String(b.date).localeCompare(String(a.date)))[0] || receipts.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date)))[0] || null;
  const unread = (currentUser || hadCloudSessionBefore()) ? unreadActivityCount() : 0;
  const scanSvg = '<svg viewBox="0 0 24 24" width="30" height="30" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>';
  return `
  ${/* 2. Bloque único de presupuesto — TAMBIÉN el primer día. Hasta el
       2026-09-11 el tablero vacío se reemplazaba por "Primeros pasos" arriba y
       "Vamos a armar tu inventario" abajo (escondiendo las baldosas): el usuario
       lo vio y lo rechazó — "es casi obligatorio escanear una vez la app avanza
       hasta ahí; quiero que entre al dashboard completo y que el usuario haga lo
       que quiera desde ahí". Ahora el Dashboard se ve IGUAL con o sin datos:
       presupuesto, herramientas y todas las baldosas (en cero). No volver a
       poner una pantalla de "primero escanea".
       Maqueta "anillo + cuadrícula" (aprobada 2026-09-08): anillo con el %
       gastado + cuatro cifras; la tarjeta toma el color del estado del
       presupuesto en los temas App Store (--tile-ok/warn/crit). */''}
  ${(()=>{
    const sp = spendSplitForMonth(currentMonthKey);
    const p = budgetPace(currentMonthKey);
    const canEdit = canSeeFinancials();
    const addChip = `<button type="button" class="dash-chip primary" id="btn-add-manual-spend" title="${t('manual_spend_title')}" aria-label="${t('manual_spend_title')}">${t('dash_add_spend_chip')}</button>`;
    // El lápiz va PEGADO a la cifra del presupuesto (pedido del usuario
    // 2026-09-08: arriba, junto a "+ Gasto", las dos pastillas se parecían y
    // no se sabía cuál era cuál) — edita lo que tiene al lado. "+ Gasto" queda
    // solo arriba como acción principal (chip blanco sólido).
    const pencil = canEdit ? `
        <button type="button" class="dash-kv-edit" id="btn-edit-budget" title="${t('dash_edit_budget')}" aria-label="${t('dash_edit_budget')}">
          <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
        </button>` : '';
    const seeAll = `<button class="link-btn" id="btn-open-monthly-spend" style="padding:10px 10px 10px 0;margin-top:2px;margin-bottom:-10px;">${t('dash_see_all_months')} ›</button>`;
    if(!p){
      // Sin presupuesto fijado: la inversión del mes grande y el "Fijalo →".
      // Pedido del usuario 2026-09-11: la tarjeta NUNCA es blanca — sin
      // presupuesto arranca del verde (clase ok, el mismo --tile-ok del estado
      // "bien") y recién cambia a ámbar/rojo según el presupuesto. Vale para
      // todos los temas: --tile-ok sale del color de dinero de cada uno.
      return `
  <div class="stat-card dash-month dash-budget ok nobudget">
    <div class="dash-budget-head"><span class="stat-label">${servicesOnly() ? t('dash_collected_of') : t('dash_investment_of')} ${monthLabel(currentMonthKey, uiLang)}</span>${addChip}</div>
    <div class="stat-value" style="margin-top:4px;">${money(servicesOnly() ? paidRevenueForMonth(currentMonthKey) : sp.invested)}</div>
    ${canEdit ? `
    <button id="btn-edit-budget" class="budget-set-cta" type="button">
      <span style="font-size:calc(12.5px * var(--fs, 1));font-weight:600;">${t('dash_budget_of')}</span>
      <span class="budget-set-link">${t('budget_set_cta')}</span>
    </button>` : ''}
    ${seeAll}
  </div>`;
    }
    // Anillo: r=40 → circunferencia 251.3; el trazo avanza con el % gastado
    // (tope 100). Mismos estados ok/warn/crit que la barra de siempre.
    const CIRC = 251.3;
    const pctShown = Math.min(Math.max(p.pct, 0), 100);
    const dash = (CIRC * (1 - pctShown/100)).toFixed(1);
    return `
  <div class="stat-card dash-month dash-budget ${p.status}">
    <div class="dash-budget-head"><span class="stat-label">${monthLabel(currentMonthKey, uiLang)}</span>${addChip}</div>
    <div class="dash-budget-body">
      <div class="dash-ring" role="img" aria-label="${Math.round(p.pct)}% ${t('dash_ring_spent')}">
        <svg viewBox="0 0 96 96"><circle class="dash-ring-track" cx="48" cy="48" r="40" stroke-width="10" fill="none"/><circle class="dash-ring-fill ${p.status}" cx="48" cy="48" r="40" stroke-width="10" fill="none" stroke-linecap="round" stroke-dasharray="${CIRC}" stroke-dashoffset="${dash}"/></svg>
        <div class="dash-ring-center"><b>${Math.round(p.pct)}%</b><small>${t('dash_ring_spent')}</small></div>
      </div>
      ${/* kvb: un monto de 6+ cifras lleva la clase .long (letra más chica) para
           que NUNCA se parta en dos líneas — ver .dash-kv b en dusty.css
           (auditoría UX 2026-09-11). */''}
      ${(()=>{ const kvb=(v,cls)=>{ const s=money(v); return `<b class="${cls||''}${s.length>9?' long':''}">${s}`; }; return `
      <div class="dash-kv">
        <div><span>${t('dash_kv_expenses')}</span>${kvb(p.expense)}</b></div>
        <div><span>${t('dash_kv_budget')}</span>${kvb(p.budget)}${pencil}</b></div>
        ${servicesOnly() ? `<div><span>${t('dash_kv_collected')}</span>${kvb(paidRevenueForMonth(currentMonthKey),'pos')}</b></div>` : `<div><span>${t('dash_kv_invest')}</span>${kvb(sp.invested,'pos')}</b></div>`}
        ${p.left>=0
          ? `<div><span>${t('dash_kv_left')}</span>${kvb(p.left,'pos')}</b></div>`
          : `<div><span>${t('dash_kv_over')}</span>${kvb(-p.left,'neg')}</b></div>`}
      </div>`; })()}
    </div>
    ${budgetNotesHtml(p)}${cogsRatioHtml(currentMonthKey)}
    ${seeAll}
  </div>`;
  })()}
  ${budgetAlertCard()}${svcOverdueCard()}${svcMaintCard()}

  ${/* 3. Herramientas con nombre (mismos ids de siempre: btn-scan-products,
       btn-scan-fab, btn-new-item — attachEvents los encuentra igual). Los
       anillos toman su color de --tool-* (degradés en los temas App Store). */''}
  ${/* Modo Servicios sin productos (app-15): Trabajo · Escanear recibo · Gasto. */''}
  ${servicesOnly() ? svcToolsHtml(scanSvg) : `
  <div class="inv-tools" style="margin:4px 0 16px;">
    <button type="button" class="inv-tool" id="btn-scan-products" title="${t('pb_open_btn')}">
      <span class="inv-tool-ring tool-products">${lineIcon('box',24)}</span>
      <span class="inv-tool-label">${t('dash_tool_products')}</span>
    </button>
    <div class="inv-tool" style="min-width:76px;">
      <button type="button" class="shelf-scan-fab" id="btn-scan-fab" title="${t('dash_scan_receipt')}" aria-label="${t('dash_scan_receipt')}">
        <div class="scan-fab-ring"></div>
        <div class="scan-fab-ring delay"></div>
        ${scanSvg}
      </button>
      <span class="inv-tool-label" style="font-weight:800;">${t('dash_scan_receipt')}</span>
    </div>
    <button type="button" class="inv-tool" id="btn-new-item" title="${t('btn_add_manually')}">
      <span class="inv-tool-ring tool-manual">＋</span>
      <span class="inv-tool-label">${t('dash_tool_manual')}</span>
    </button>
  </div>`}

  ${/* Sin productos (modo Servicios) el inventario está vacío SIEMPRE: la espera
       se juzga por trabajos y activos, si no el esqueleto tapaba el tablero en
       cada sincronización. */''}
  ${(servicesOnly() ? (svcJobs().length===0 && !(bizProfile.assets||[]).length) : inventory.length===0) && cloudSyncPending ? loadingSkeleton('dashboard') : `
  ${/* 4. HOY + módulos, en cuadrícula de dos columnas (maqueta 2026-09-08):
       Críticos cambia de color con el estado (pedido del usuario 2026-09-08):
       azul con todo en orden, ROJO (--tile-crit, el mismo del presupuesto
       excedido) en cuanto hay un producto crítico; lleva la salud del stock
       como subtítulo. Toca contar lleva el
       primer producto que toca) abren el Inventario filtrado; Pedido sugerido,
       Último recibo, Producción y Actividad son las filas de antes, ahora como
       tarjetas con ícono. Mismos ids y data-* que siempre. */''}
  <div class="dash-section-label">${t('dash_today')}</div>
  <div class="dash-grid">
    ${/* Modo Servicios (app-15): Trabajos · Por cobrar · Mantenimiento; las de
         productos (Críticos, Toca contar, Pedido) solo si vende productos. */''}
    ${sellsProducts() ? `
    <button type="button" class="dash-tile t1 ${critRows.length>0?'alert':''}" data-dash-stat="crit">
      <span class="dash-tile-badge ${critRows.length>0?'crit':'ok'}">${critRows.length>0 ? t('dash_badge_alert') : t('dash_badge_ok')}</span>
      <span class="dash-tile-icon" aria-hidden="true">${critRows.length>0?'⚠️':'🛡️'}</span>
      <b class="dash-tile-num ${critRows.length>0?'crit':''}">${critRows.length}</b>
      <span class="dash-tile-title">${t('dash_stat_crit')}</span>
      <span class="dash-tile-sub">${healthPct===null ? t('dash_tile_health_none') : t('dash_tile_health').replace('{p}', healthPct)}</span>
    </button>
    ${(()=>{
      const dueNames = inventory.filter(i=>ccDueIds.has(i.id)).map(i=>invShortName(i.name));
      const sub = dueNames.length===0 ? t('dash_tile_count_none') : escapeHtml(dueNames[0]) + (dueNames.length>1 ? ` +${dueNames.length-1}` : '');
      return `
    <button type="button" class="dash-tile t2" data-dash-stat="count">
      <span class="dash-tile-badge ${ccDueIds.size>0?'warn':'ok'}">${ccDueIds.size>0 ? t('dash_badge_due') : t('dash_badge_ok')}</span>
      <span class="dash-tile-icon" aria-hidden="true">🔢</span>
      <b class="dash-tile-num ${ccDueIds.size>0?'warn':''}">${ccDueIds.size}</b>
      <span class="dash-tile-title">${t('dash_stat_count')}</span>
      <span class="dash-tile-sub">${sub}</span>
    </button>`;
    })()}
    ${/* 5. Pedido sugerido (mismo id btn-suggested-order). */''}
    <button type="button" class="dash-tile t3" id="btn-suggested-order">
      <span class="dash-tile-icon" aria-hidden="true">🛒</span>
      <span class="dash-tile-title">${t('stock_suggested_order').replace(/:$/,'')}</span>
      <span class="dash-tile-sub">${critRows.length>0 ? t('dash_suggested_n').replace('{n}', critRows.length) : t('dash_suggested_none')}</span>
      <span class="dash-tile-chev">›</span>
    </button>` : ''}
    ${usesServices() ? svcDashTilesHtml() : ''}
    ${/* 6. EL CALENDARIO — pero SOLO cuando Recibos dejó de ser pestaña
         (observación del usuario 2026-09-10: "el calendario se queda aunque no
         produzca??"). Tenía razón: con la pestaña Recibos abajo, el calendario
         acá arriba es lo mismo dos veces, y encima se come media pantalla para
         decir "ninguno escaneado". Esta tarjeta existe para REEMPLAZAR la
         pestaña; si la pestaña está, no hace falta.
         Así, un negocio que no fabrica ve el Dashboard exactamente como antes:
         su tarjeta de "Último recibo", que abre esa ficha de un toque.
         Cuando sí fabrica, Producción toma la pestaña y el calendario aparece
         acá, a dos columnas — un mes de 7 columnas en media tarjeta no se lee.
         Tocarlo abre Recibos y el calendario chico se AGRANDA hasta el grande
         (view-transition-name compartido, ver openReceiptsSheet en app-07). */''}
    ${TAB_ORDER[2]==='recibos' ? `
    <div class="dash-tile t4 ${lastReceipt?'':'static'}" ${lastReceipt ? `data-view-receipt="${lastReceipt.id}" role="button" tabindex="0"` : ''}>
      <span class="dash-tile-icon" aria-hidden="true">🧾</span>
      <span class="dash-tile-title">${t('dash_last_receipt')}</span>
      <span class="dash-tile-sub">${lastReceipt ? `${escapeHtml(lastReceipt.supplier)||t('no_supplier_name')} · ${money(lastReceipt.total)} · ${escapeHtml(lastReceipt.date||'')}` : t('dash_last_receipt_none')}</span>
      ${lastReceipt ? '<span class="dash-tile-chev">›</span>' : ''}
    </div>` : `
    <div class="dash-tile t4" id="dash-calendar-tile" role="button" tabindex="0">
      <span class="dash-tile-title">${t('dash_calendar_title')}</span>
      <span class="dash-tile-sub">${escapeHtml(monthLabel(localMonthStr(), uiLang))}${receipts.length>0 ? ` · ${t('dash_calendar_sub').replace('{n}', String(receipts.length))}` : ''}</span>
      ${miniCalendarWidget()}
    </div>`}
    ${(!servicesOnly() || usesProduction()) ? `
    <button type="button" class="dash-tile t5" id="btn-production-hub">
      <span class="dash-tile-icon" aria-hidden="true">🍳</span>
      <span class="dash-tile-title">${t('prod_section_title')}</span>
      <span class="dash-tile-sub">${t('dash_production_sub')}</span>
      <span class="dash-tile-chev">›</span>
    </button>` : ''}
    ${usesServices() && sellsProducts() ? svcEquipoTileHtml() : ''}
    ${/* EQUIPO: compartir la cuenta para que un empleado escanee y cuente.
         Quedó SOLO en Ajustes › Cuenta —a tres toques, entre la copia de
         seguridad y la política de privacidad— cuando la fila del inventario
         que también lo traía dejó de dibujarse (ver el borrado de
         inventoryMenuRow). Para el dueño que acaba de contratar a alguien ese
         no es un lugar donde se le ocurra buscar, así que vuelve al Dashboard.
         Mismo id que usaba aquella fila: attachEvents ya lo cablea a
         shareAccountFlow, no hay lógica nueva.
         VA ANTES de Actividad a propósito: esa tarjeta es condicional (pide
         sesión o haberla tenido), así que sin sesión quedan seis tarjetas —
         tres filas parejas— en vez de una suelta al final.
         Reusa t1 (azul) porque solo hay seis tonos definidos por tema y una de
         las siete tiene que repetir; Críticos, el otro t1, casi siempre está en
         rojo cuando hay alertas y queda arriba del todo, lejos de esta. */''}
    <button type="button" class="dash-tile t1" id="btn-share-account">
      <span class="dash-tile-icon" aria-hidden="true">👥</span>
      <span class="dash-tile-title">${t('dash_team_title')}</span>
      <span class="dash-tile-sub">${t('dash_team_sub')}</span>
      <span class="dash-tile-chev">›</span>
    </button>
    ${(currentUser || hadCloudSessionBefore()) ? `
    <button type="button" class="dash-tile t6" id="btn-inventory-activity">
      <span class="dash-tile-icon" aria-hidden="true">📈</span>
      <span class="dash-tile-title">${t(servicesOnly() ? 'svc_activity_title' : 'activity_modal_title')}</span>
      <span class="dash-tile-sub">${unread>0 ? t('dash_activity_n').replace('{n}', unread) : t('dash_activity_none')}</span>
      ${unread>0 ? `<span class="dash-tile-count">${unread>99?'99+':unread}</span>` : '<span class="dash-tile-chev">›</span>'}
    </button>` : ''}
  </div>`}
  ${svcAgendaHtml()}
  ${priceAlertsCard()}
  `;
}

/* La fila de acciones del inventario (inventoryMenuRow) se borró acá el
   2026-09-08: quedó definida pero SIN NINGUNA LLAMADA tras una reorganización
   anterior, así que no se dibujaba en ninguna pantalla mientras su comentario
   seguía afirmando que "el botón del menú del Dashboard sigue". Sus cinco
   botones viven todos en el Dashboard con los mismos ids —Escanear productos y
   Alta manual en .inv-tools, Actividad y Producción como tarjetas, y Compartir
   cuenta en la tarjeta de Equipo que reemplaza a este bloque—, así que no se
   perdió ningún acceso: se sacó código que confundía al leer el archivo. */
/* "Primeros pasos" y "Vamos a armar tu inventario" (las dos tarjetas del tablero
   vacío, 2026-09-07 → 2026-09-10) se borraron el 2026-09-11: el Dashboard se ve
   igual con o sin datos — ver el comentario del bloque de presupuesto arriba. */

/* ---------- INVENTARIO ---------- */
/* Vista del inventario elegida por el usuario: 'cols2', 'cols3' o 'cols4' (la más
   densa, pedida el 2026-09-06). Persiste como preferencia del dispositivo.
   La de una columna ('rows') se eliminó el 2026-09-09: con la foto llenando la
   tarjeta quedaba un producto por pantalla. El dispositivo que la tenía guardada
   cae en cols2 al no pasar el filtro de abajo. */
let invLayout = 'cols2';
try{ const v = localStorage.getItem('patron_inv_layout'); if(['cols2','cols3','cols4'].includes(v)) invLayout = v; }catch(e){}
// Un solo render tras tocar el selector viaja por View Transition (ver render(),
// app-04): con view-transition-name por tarjeta, cada una VUELA a su nueva
// posición/tamaño en vez del redibujado seco — el morph estilo iOS que faltaba.
let invLayoutTransitionPending = false;
// true SOLO durante el render del cambio de vista: ahí las tarjetas llevan su
// view-transition-name (ver stockRowHtml). Lo maneja render() en app-04.
let invLayoutVtActive = false;
// Id del recibo cuya tarjeta lleva view-transition-name en este render (la que
// está abriendo o cerrando su detalle). Lo maneja render() en app-04.
let receiptVtTargetId = null;
let lastReceiptDetailId = null;
/* Inventario reorganizado (maqueta aprobada 2026-09-07, pensado para 100+
   productos): orden elegible, tres filtros rápidos, grupos plegables que
   recuerdan su estado y "ver los restantes" en los grupos grandes. */
let invSort = 'name'; // 'name' | 'stock' | 'value'
try{ const v = localStorage.getItem('patron_inv_sort'); if(['name','stock','value'].includes(v)) invSort = v; }catch(e){}
let invQuickFilter = null; // null | 'crit' | 'count' | 'nophoto' — solo en memoria
let invCollapsed = new Set();
try{ const v = JSON.parse(localStorage.getItem('patron_inv_collapsed')||'[]'); if(Array.isArray(v)) invCollapsed = new Set(v); }catch(e){}
let invExpanded = new Set(); // grupos grandes ya desplegados enteros (memoria)
const INV_GROUP_PREVIEW = 12;
function invGroupKey(g){ return g.id || '__none'; }
/* DESGLOSE de Valor / Potencial de venta (pedido del usuario 2026-09-11: que las
   dos tarjetas sean botones que muestren el detalle y el porqué del número).
   Cabecera con el número grande en su color (verde = valor invertido, azul =
   potencial), la fórmula en una línea, barras por categoría y la lista por
   producto con su cuenta (cantidad × precio = monto); en Potencial, además la
   ganancia potencial y los productos sin precio que no suman. Tocar un producto
   abre su ficha (data-open-item, el handler de siempre). */
let showInvDetail = null; // null | 'value' | 'potential'
/* Vista de la lista "Por producto" del desglose (pedido del usuario 2026-09-11:
   el mismo selector de columnas del Inventario, en los DOS desgloses): lista,
   2 o 3 columnas. Preferencia del dispositivo; la lee app-10 al tocar. */
let ivdLayout = 'list';
try{ const v = localStorage.getItem('patron_ivd_layout'); if(['list','cols2','cols3'].includes(v)) ivdLayout = v; }catch(e){}
function ivdLayoutToggleHtml(){
  const ic = {
    list:'<svg viewBox="0 0 20 20" width="15" height="15" fill="currentColor"><rect x="2" y="3" width="16" height="4" rx="1.2"/><rect x="2" y="9" width="16" height="4" rx="1.2"/><rect x="2" y="15" width="16" height="3" rx="1.2"/></svg>',
    cols2:'<svg viewBox="0 0 20 20" width="15" height="15" fill="currentColor"><rect x="2" y="3" width="7" height="7" rx="1.5"/><rect x="11" y="3" width="7" height="7" rx="1.5"/><rect x="2" y="12" width="7" height="7" rx="1.5"/><rect x="11" y="12" width="7" height="7" rx="1.5"/></svg>',
    cols3:'<svg viewBox="0 0 20 20" width="15" height="15" fill="currentColor"><rect x="1" y="3" width="5" height="5" rx="1.2"/><rect x="7.5" y="3" width="5" height="5" rx="1.2"/><rect x="14" y="3" width="5" height="5" rx="1.2"/><rect x="1" y="12" width="5" height="5" rx="1.2"/><rect x="7.5" y="12" width="5" height="5" rx="1.2"/><rect x="14" y="12" width="5" height="5" rx="1.2"/></svg>'
  };
  const opt = (val, label)=>`<button type="button" data-ivd-layout="${val}" class="${ivdLayout===val?'on':''}" aria-label="${label}" aria-pressed="${ivdLayout===val}" title="${label}">${ic[val]}</button>`;
  return `<div class="inv-layout-toggle ivd-layout" role="group" aria-label="${t('inv_layout_label')}">${opt('list', t('ivd_layout_list'))}${opt('cols2', t('inv_layout_cols2'))}${opt('cols3', t('inv_layout_cols3'))}</div>`;
}
function invDetailModal(){
  const kind = showInvDetail;
  const isVal = kind==='value';
  const items = inventory.filter(i=>i && !isExpenseItem(i) && (i.qtyOnHand||0)>0);
  const amt = (i)=> isVal ? (i.qtyOnHand||0)*(i.costPerUnit||0) : ((i.salePrice||0)>0 ? (i.qtyOnHand||0)*(i.salePrice||0) : 0);
  const priced = isVal ? items : items.filter(i=>(i.salePrice||0)>0);
  const unpriced = isVal ? [] : items.filter(i=>!((i.salePrice||0)>0));
  const total = priced.reduce((s,i)=>s+amt(i),0);
  const costOfPriced = priced.reduce((s,i)=>s+(i.qtyOnHand||0)*(i.costPerUnit||0),0);
  const profit = total - costOfPriced;
  // El signo va ANTES del $ ("-$24.00", no "$-24.00"): un producto con precio
  // de venta por debajo del costo muestra ganancia negativa en su fila y puede
  // dejar negativa la ganancia potencial del encabezado.
  const fmt = (n)=>(n<0?'-':'')+'$'+Math.abs(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  const nProd = (n)=> n===1 ? t('ivd_products_1') : t('ivd_products_n').replace('{n}', n);
  const byCat = groupRowsByCategory(priced.map(i=>({ing:i}))).map(g=>({name:g.name, n:g.rows.length, sum:g.rows.reduce((s,r)=>s+amt(r.ing),0)})).sort((a,b)=>b.sum-a.sum);
  const rows = priced.slice().sort((a,b)=>amt(b)-amt(a));
  // Mismos colores que las tarjetas de arriba: verde (--tile-ok / --money-pos)
  // para el valor, azul (--tile-1 / --hue-1) para el potencial.
  const color = isVal ? 'var(--money-pos)' : 'var(--hue-1, var(--navy))';
  const soft = isVal ? 'var(--tile-ok)' : 'var(--tile-1)';
  return `
  ${/* Sin overlay-fast (pedido del usuario 2026-09-11: la entrada era demasiado
       rápida): entra al ritmo normal de los modales de la app (.75s, curva iOS),
       que es el "más nativo" que pidió el usuario para todos. */''}
  <div class="overlay" id="inv-detail-overlay">
    <div class="modal ivd ${isVal?'ivd-value':'ivd-potential'}" role="dialog" aria-modal="true" aria-label="${isVal?t('ivd_value_title'):t('ivd_potential_title')}">
      <button type="button" class="modal-close-btn" id="btn-close-inv-detail" aria-label="${t('btn_close')}">✕</button>
      <div class="ivd-hero" style="background:${soft};">
        <div class="ivd-hero-label">${isVal?'':'🏷 '}${isVal?t('ivd_value_title'):t('ivd_potential_title')}</div>
        <div class="ivd-hero-value">${fmt(total)}</div>
        <div class="ivd-hero-how">${isVal?t('ivd_value_how'):t('ivd_potential_how')}</div>
        ${!isVal && priced.length ? `
        <div class="ivd-hero-kpis">
          <span><b>${fmt(profit)}</b>${t('ivd_profit')}${costOfPriced>0?` · ${Math.round(profit/costOfPriced*100)}% ${t('ivd_margin')}`:''}</span>
          <span><b>${fmt(costOfPriced)}</b>${t('ivd_cost_of')}</span>
        </div>` : ''}
      </div>
      ${items.length===0 ? `<div class="helper-note">${t('ivd_empty')}</div>` : `
      ${byCat.length>1 ? `
      <div class="ivd-section">${t('ivd_by_category')}</div>
      <div class="ivd-cats">
        ${byCat.map(c=>`
        <div class="ivd-cat">
          <div class="ivd-cat-top"><span>${escapeHtml(c.name)} <small>${nProd(c.n)}</small></span><b style="color:${color};">${fmt(c.sum)} <small>· ${total>0?Math.round(c.sum/total*100):0}%</small></b></div>
          <div class="ivd-bar"><i style="width:${total>0?Math.max(2,Math.round(c.sum/total*100)):0}%;background:${color};"></i></div>
        </div>`).join('')}
      </div>` : ''}
      <div class="ivd-section">${t('ivd_by_product')} <small>${nProd(rows.length)}</small><span class="ivd-section-tools">${ivdLayoutToggleHtml()}</span></div>
      ${/* El id cambia con la vista: morphdom RECREA el contenedor al cambiar de
           lista a columnas (y viceversa) y los hijos entran con la animación
           escalonada de ivdItemIn (--i = su posición); en los redibujados de
           fondo el id es el mismo, el nodo se conserva y nada vuelve a animar
           (pedido del usuario 2026-09-11: "que no entren tan rápido"). */''}
      <div class="${ivdLayout==='list' ? 'ivd-rows' : 'ivd-grid '+ivdLayout}" id="ivd-list-${kind}-${ivdLayout}">
        ${rows.map((i, idx)=>{
          const unit = isVal ? (i.costPerUnit||0) : (i.salePrice||0);
          const m = !isVal ? (i.qtyOnHand||0)*((i.salePrice||0)-(i.costPerUnit||0)) : 0;
          if(ivdLayout!=='list') return `
        <div class="ivd-tile" data-open-item="${i.id}" role="button" tabindex="0" title="${escapeHtml(i.name)}" style="--i:${idx};">
          <span class="stock-icon-ring" style="width:40px;height:40px;flex-shrink:0;overflow:hidden;">${stockIconSvg(i)}</span>
          <span class="ivd-tile-name">${escapeHtml(i.name)}</span>
          <b class="ivd-tile-amt" style="color:${color};">${fmt(amt(i))}</b>
          <span class="ivd-tile-calc">${escapeHtml(i.qtyOnHand||0)} × ${fmt(unit)}${!isVal ? `<br><span style="color:${m>=0?'var(--money-pos)':'var(--money-neg, var(--tomato))'};">${m>=0?'+':''}${fmt(m)}</span>` : ''}</span>
        </div>`;
          return `
        <div class="ivd-row" data-open-item="${i.id}" role="button" tabindex="0" style="--i:${idx};">
          <span class="stock-icon-ring" style="width:34px;height:34px;flex-shrink:0;overflow:hidden;">${stockIconSvg(i)}</span>
          <span class="ivd-row-main"><span class="ivd-row-name">${escapeHtml(i.name)}</span><span class="ivd-row-calc">${escapeHtml(i.qtyOnHand||0)} ${escapeHtml(unitLabel(i.unit))} × ${fmt(unit)}${!isVal ? ` · <span style="color:${m>=0?'var(--money-pos)':'var(--money-neg, var(--tomato))'};">${m>=0?'+':''}${fmt(m)}</span>` : ''}</span></span>
          <b class="ivd-row-amt" style="color:${color};">${fmt(amt(i))}</b>
        </div>`;}).join('')}
      </div>
      ${unpriced.length ? `
      <div class="ivd-section" style="color:var(--saffron-ink);">${t('ivd_no_price')} <small>${nProd(unpriced.length)}</small></div>
      <div class="ivd-rows">
        ${unpriced.map(i=>`
        <div class="ivd-row" data-open-item="${i.id}" role="button" tabindex="0">
          <span class="stock-icon-ring" style="width:34px;height:34px;flex-shrink:0;overflow:hidden;">${stockIconSvg(i)}</span>
          <span class="ivd-row-main"><span class="ivd-row-name">${escapeHtml(i.name)}</span><span class="ivd-row-calc">${escapeHtml(i.qtyOnHand||0)} ${escapeHtml(unitLabel(i.unit))} · ${fmt(i.costPerUnit||0)}/${escapeHtml(unitLabel(i.unit))}</span></span>
          <span class="ivd-set-price">${t('ivd_set_price')} ›</span>
        </div>`).join('')}
      </div>` : ''}
      <div class="helper-note" style="margin-top:10px;">${t('ivd_tap_hint')}</div>`}
      <div class="modal-actions">
        <button class="btn btn-primary" id="btn-close-inv-detail-footer" style="width:100%;">${t('btn_close')}</button>
      </div>
    </div>
  </div>`;
}
function invSortRows(rows){
  const arr = rows.slice();
  /* "Menos stock" ordena por PORCENTAJE de llenado (r.pct), no por unidades
     sueltas (auditoría con 400 productos 2026-09-08). Comparar qtyOnHand entre
     productos distintos es comparar 5 cajas contra 20 litros: no dice cuál se
     está acabando. Con el orden viejo, un producto con 5 de 5 (100%, sano)
     quedaba ARRIBA de uno con 20 de 200 (10%, crítico) — por eso la lista
     mostraba anillos verdes entre los rojos y parecía desordenada. pct es el
     mismo número que pinta el anillo de cada tarjeta, así color y orden ahora
     dicen lo mismo. Las filas siempre traen pct (ver stockRowsData). */
  if(invSort==='stock') arr.sort((a,b)=>a.pct-b.pct || String(a.ing.name).localeCompare(String(b.ing.name)));
  else if(invSort==='value') arr.sort((a,b)=>((b.ing.qtyOnHand||0)*(b.ing.costPerUnit||0))-((a.ing.qtyOnHand||0)*(a.ing.costPerUnit||0)) || String(a.ing.name).localeCompare(String(b.ing.name)));
  else arr.sort((a,b)=>String(a.ing.name).localeCompare(String(b.ing.name), undefined, {sensitivity:'base'}));
  return arr;
}
/* CAMBIO DE VISTA SIN REDIBUJAR TODO (auditoría con 400 productos 2026-09-08).
   Tocar fila/2/3/4 columnas disparaba un render() completo: plantilla entera de
   las páginas del carrusel + morphdom, medido en 34-61 ms de escritorio (el triple en un
   teléfono) — un tirón en cada toque. Pero del layout solo dependen DOS cosas:
   la clase de cada .inv-grid (el marcado de la tarjeta es idéntico en las cuatro
   vistas, lo diferencia el CSS) y qué botón del selector queda marcado. Se
   escriben a mano, igual que commitTabSwitchLight hace con el cambio de pestaña.
   La animación NO se pierde: los nombres de View Transition se ponen sobre los
   nodos vivos antes de la captura, y como son los MISMOS nodos antes y después,
   el navegador anima cada tarjeta hacia su posición nueva igual que antes. */
function applyInvLayoutLight(){
  const grids = [...document.querySelectorAll('.inv-grid')];
  if(!grids.length){ render(); return; }
  const aplicar = ()=>{
    grids.forEach(g=>{
      g.classList.remove('cols2','cols3','cols4');
      g.classList.add(invLayout);
    });
    document.querySelectorAll('[data-inv-layout]').forEach(b=>{
      const on = b.dataset.invLayout===invLayout;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
    });
    syncViewportHeight(); // el alto de la grilla cambia con la cantidad de columnas
  };
  if(!document.startViewTransition || reducedMotionQuery.matches){ aplicar(); return; }
  const nombrados = [...document.querySelectorAll('.inv-tile[data-ing-id]')];
  nombrados.forEach(el=>{
    el.style.viewTransitionName = 'invtile-' + String(el.dataset.ingId).replace(/[^a-zA-Z0-9_-]/g, '');
  });
  const limpiar = ()=>{ nombrados.forEach(el=>{ el.style.viewTransitionName = ''; }); };
  const vt = document.startViewTransition(aplicar);
  vt.ready.catch(()=>{}); // una transición salteada rechaza ready — no es un error
  vt.finished.then(limpiar, limpiar);
}
function invLayoutToggleHtml(){
  const opt = (val, label, icon)=>`<button type="button" data-inv-layout="${val}" class="${invLayout===val?'on':''}" aria-label="${label}" aria-pressed="${invLayout===val}" title="${label}">${icon}</button>`;
  const sq = (n)=>{
    if(n===2) return '<svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor"><rect x="2" y="3" width="7" height="7" rx="1.5"/><rect x="11" y="3" width="7" height="7" rx="1.5"/><rect x="2" y="12" width="7" height="7" rx="1.5"/><rect x="11" y="12" width="7" height="7" rx="1.5"/></svg>';
    if(n===3) return '<svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor"><rect x="1" y="3" width="5" height="5" rx="1.2"/><rect x="7.5" y="3" width="5" height="5" rx="1.2"/><rect x="14" y="3" width="5" height="5" rx="1.2"/><rect x="1" y="12" width="5" height="5" rx="1.2"/><rect x="7.5" y="12" width="5" height="5" rx="1.2"/><rect x="14" y="12" width="5" height="5" rx="1.2"/></svg>';
    return '<svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor"><rect x="0.6" y="4.4" width="3.8" height="3.8" rx="1"/><rect x="5.6" y="4.4" width="3.8" height="3.8" rx="1"/><rect x="10.6" y="4.4" width="3.8" height="3.8" rx="1"/><rect x="15.6" y="4.4" width="3.8" height="3.8" rx="1"/><rect x="0.6" y="11.8" width="3.8" height="3.8" rx="1"/><rect x="5.6" y="11.8" width="3.8" height="3.8" rx="1"/><rect x="10.6" y="11.8" width="3.8" height="3.8" rx="1"/><rect x="15.6" y="11.8" width="3.8" height="3.8" rx="1"/></svg>';
  };
  return `<div class="inv-layout-toggle" role="group" aria-label="${t('inv_layout_label')}">
    ${opt('cols2', t('inv_layout_cols2'), sq(2))}
    ${opt('cols3', t('inv_layout_cols3'), sq(3))}
    ${opt('cols4', t('inv_layout_cols4'), sq(4))}
  </div>`;
}
/* Agrupa las filas de inventario por categoría, en el orden en que el usuario las
   tiene definidas — los productos sin categoría (o con una categoría que ya no
   existe, ej. se borró) van todos juntos al final en "Sin categoría". Solo se
   arman grupos con al menos una fila, para no mostrar encabezados vacíos. */
function groupRowsByCategory(rows){
  const groups = categories.map(c=>({id:c.id, name:c.name, rows:[]}));
  const groupById = {};
  groups.forEach(g=>{ groupById[g.id]=g; });
  const uncategorized = {id:null, name:t('categories_uncategorized'), rows:[]};
  rows.forEach(r=>{
    const cid = r.ing.categoryId;
    const g = (cid && groupById[cid]) ? groupById[cid] : uncategorized;
    g.rows.push(r);
  });
  return groups.concat([uncategorized]).filter(g=>g.rows.length>0);
}
/* Rediseño 2026-09-03 (pedido del usuario): cada ítem es UNA tarjeta-botón —
   tocarla abre su ficha (y ahí se edita o elimina; la ✕ y el lápiz de la fila
   se fueron). Sin botones laterales, las tarjetas entran en una grilla de 2
   columnas (.inv-grid) y la lista pide la mitad de scroll. El ícono conserva
   su toque propio (foto/subir foto) con stopPropagation. */
/* Nombre ABREVIADO para la tarjeta (el completo vive en la ficha y en el
   title): con paréntesis, última palabra de antes + primer dato de adentro —
   "Non-Metallic Sheathed Cable (14-3 w/Ground, 250 ft)" → "Cable 14-3",
   exactamente el formato que el usuario pidió. Sin paréntesis, el nombre tal
   cual (el clamp de 2 líneas corta lo que no entre). */
function invShortName(name){
  const m = String(name||'').match(/^([^(]+)\(([^)]*)\)/);
  if(m){
    const before = m[1].trim().split(/\s+/);
    const base = before[before.length-1] || '';
    const detail = (m[2].split(/[,;]/)[0]||'').trim().split(/\s+/)[0] || '';
    const short = (base+' '+detail).trim();
    if(short) return short;
  }
  return name;
}
/* SELECCIÓN MÚLTIPLE EN INVENTARIO (pedido del usuario 2026-09-09: "no tengo
   forma de borrar ítems más rápido, las borradas es de uno a uno"). Con 400
   productos, borrar de a uno —cada uno con su confirmación— no es viable.
   El lenguaje es el de siempre: botón "Seleccionar" y tocar para marcar.
   invSelected guarda ids: sobrevive a que la lista se reordene, se filtre o se
   busque mientras seleccionás, cosa que no pasaría con índices. */
let invSelectMode = false;
let invSelected = new Set();
/* ===== COMPARTIR EL PEDIDO (idea del usuario 2026-09-10) =====
   "Pedido sugerido" ya calculaba qué falta, pero solo tenía botón de Cerrar: veías
   la lista y no había forma de mandársela a nadie. Y "Compartir" del modo selección
   manda FOTOS —sirve para mostrarle algo a un cliente, no para pedirle a un
   proveedor—, así que faltaba justo el paso final.

   AGRUPADO POR PROVEEDOR, que es lo que el usuario pidió ("a quien tenga que
   ordenar"): un pedido con cables de una ferretería y breakers de otra no se manda
   junto. Los que no tienen proveedor cargado van al final, en su propio grupo, sin
   inventarles uno.

   CUÁNTO PEDIR sale del mismo cálculo que ya usa el Pedido sugerido: target menos
   lo que hay, con piso en 0 — el target es stockFullRef, el nivel al que llegó la
   última vez que entró mercadería. No se inventa un número nuevo ni se pide el
   doble "por las dudas".

   NO manda precios de venta ni márgenes: esto va a un proveedor. */
function orderTextForRows(rows){
  const porProveedor = new Map();
  rows.forEach(r=>{
    const falta = Math.max(roundQty((r.target||0) - (r.ing.qtyOnHand||0)), 0);
    if(!(falta > 0)) return;
    const prov = (r.ing.supplier||'').trim();
    if(!porProveedor.has(prov)) porProveedor.set(prov, []);
    porProveedor.get(prov).push('• ' + r.ing.name + ' — ' + falta + ' ' + unitLabel(r.ing.unit));
  });
  if(porProveedor.size === 0) return '';
  // Los sin proveedor van ULTIMOS, siempre: son los que el usuario todavia tiene
  // que decidir a quien pedirle, y arriba de todo empujaban abajo a los grupos que
  // si estan listos para mandar. (Se intento con un \u0000 al principio del nombre
  // para que ordenara solo; localeCompare lo pone PRIMERO, no ultimo.)
  const bloques = [...porProveedor.entries()]
    .sort((a,b)=>{
      if(!a[0] && b[0]) return 1;
      if(a[0] && !b[0]) return -1;
      return a[0].localeCompare(b[0]);
    })
    .map(([prov, lineas])=>(prov || t('order_no_supplier')) + '\n' + lineas.join('\n'));
  return (businessName ? businessName + ' — ' : '') + t('order_share_title') + '\n\n' + bloques.join('\n\n');
}
async function shareOrderText(texto){
  if(!texto){ showToast(t('order_nothing'), 'error'); return; }
  try{
    if(navigator.share){ await navigator.share({text: texto}); return; }
    await navigator.clipboard.writeText(texto);
    showToast(t('order_copied'));
  }catch(e){
    if(e && e.name==='AbortError') return;   // cerró el panel de compartir
    try{ await navigator.clipboard.writeText(texto); showToast(t('order_copied')); }catch(e2){}
  }
}
// Desde el modo selección: solo lo marcado.
function shareSelectedOrder(){
  const rows = stockRowsData().filter(r=>invSelected.has(r.ing.id));
  shareOrderText(orderTextForRows(rows));
}
// Desde "Pedido sugerido": todo lo que está en nivel crítico.
function shareSuggestedOrder(){
  shareOrderText(orderTextForRows(stockRowsData().filter(r=>r.status==='crit')));
}

function invExitSelect(){ invSelectMode = false; invSelected.clear(); }
function stockRowHtml(r, ccDueIds){
  const i = r.ing;
  // Nombre de View Transition único y estable por tarjeta (custom-ident: solo
  // letras/números/guiones) — es lo que permite que el cambio de vista anime
  // cada tarjeta hacia su nueva celda en lugar de fundir la lista entera.
  // view-transition-name SOLO durante el cambio de vista fila/2col/3col
  // (auditoría de parpadeo 2026-09-08): con el nombre puesto siempre, CADA
  // View Transition de la app (cerrar cualquier modal, abrir un recibo)
  // capturaba una capa por tarjeta — 150 productos = 150 capas
  // por cierre de modal, el "congelado + parpadeo" con inventarios grandes.
  // invLayoutVtActive lo prende render() (app-04) solo para ese render.
  const vtName = invLayoutVtActive ? 'invtile-' + String(i.id).replace(/[^a-zA-Z0-9_-]/g, '') : '';
  return `
  ${/* data-status: lo usa el atajo "Alertas críticas" del Dashboard para saltar
       acá y hacer latir los críticos (ya no se listan en el Dashboard). */''}
  ${/* En modo selección la tarjeta MARCA en vez de abrir la ficha: se cambia
       data-open-item por data-inv-select para que el handler de siempre no se
       dispare, en vez de dejar los dos y depender del orden de los listeners.
       La FOTO sigue el mismo criterio (reporte del usuario 2026-09-09: "los
       botones se confunden porque piensa que quiero ver la imagen"): desde que
       llena la tarjeta, su toque —abrir el visor o pedir una foto— se comía casi
       toda el área de marcado. En modo selección se le quita data-photo-item, así
       que tocar CUALQUIER parte del ítem marca. */''}
  ${/* .agotado la pinta como una sombra A COLOR (pedido del usuario 2026-09-10:
       "una sombra a color, no blanco y negro"). Al volver a entrar stock la
       clase se cae sola —sale de qtyOnHand— y la tarjeta revive con su
       transicion. No hace falta ningun estado guardado ni ninguna accion del
       usuario: es el mismo dato de siempre, dibujado distinto. */''}
  <div class="inv-tile ${r.agotado?'agotado ':''}${ccDueIds.has(i.id)?'cc-due-blink':''}${invSelectMode && invSelected.has(i.id)?' sel':''}" data-key="invtile:${i.id}" ${invSelectMode ? `data-inv-select="${i.id}" aria-pressed="${invSelected.has(i.id)}"` : `data-open-item="${i.id}"`} role="button" tabindex="0" data-ing-id="${i.id}" data-status="${r.status}" title="${escapeHtml(i.name)}"${vtName ? ` style="view-transition-name:${vtName};"` : ''}>
    ${invSelectMode ? `<span class="inv-tile-check" aria-hidden="true">${invSelected.has(i.id)?'✓':''}</span>` : ''}
    <div class="inv-tile-top">
      <div class="stock-icon-ring ${r.status!=='ok'?r.status:''}"${invSelectMode ? '' : ` data-photo-item="${i.id}" title="${t('btn_upload_photo')}"`} style="${invSelectMode?'':'cursor:pointer;'}width:48px;height:48px;flex-shrink:0;">${stockIconSvg(i)}</div>
      <div class="inv-tile-name">${escapeHtml(invShortName(i.name))}${i.updated?`<span class="price-updated">${t('price_updated')}</span>`:''}</div>
    </div>
    ${/* Sin marginBadge: los % de ganancia salen de la vista pública de la lista
         (pedido del usuario — pantallas compartidas). La ganancia vive en la
         ficha, y solo para quien canSeeFinancials() lo permite. */''}
    <div class="inv-row-meta">${money(i.costPerUnit)}/${escapeHtml(unitLabel(i.unit))}${priceChangeBadge(lastPriceChangePct(i.id, purchasesForIng(i.id)))}</div>
    <div class="stock-caption" style="margin:0;">${i.expenseOnly ? t('expense_only_tag') : `${escapeHtml(i.qtyOnHand||0)} ${escapeHtml(unitLabel(i.unit))} ${t('inv_in_stock_suffix')}`}</div>
  </div>`;
}
/* ---------- CALCULADORA DE PEDIDO (pestaña Inventario) ----------
   El teclado son los propios productos del inventario (ícono + nombre + precio de
   la última compra) y cada toque suma una línea al pedido; la cantidad también se
   puede escribir directa tocando el número (multiplicar 24 × precio sin 24 toques).
   Todo vive SOLO en memoria: es una calculadora de bolsillo, no un documento — no
   toca saveState() ni viaja a Firestore, y se limpia al recargar. */
let orderCalcOpen = false;
let orderCalcQty = {};
let orderCalcEditingId = null;
let orderCalcSearch = '';
/* Un pedido a medio armar sobrevive al refresh (pedido del usuario: "que no se
   desaparezca el trabajo"): cantidades y si la hoja estaba abierta van a
   localStorage en cada cambio. Ids de productos ya borrados se ignoran solos
   (todas las lecturas filtran contra el inventario actual). */
try{
  const s = JSON.parse(localStorage.getItem('patron_order_calc_v1')||'null');
  if(s && typeof s==='object'){
    if(s.qty && typeof s.qty==='object') orderCalcQty = s.qty;
    orderCalcOpen = !!s.open;
  }
}catch(e){}
function orderCalcPersist(){
  try{ localStorage.setItem('patron_order_calc_v1', JSON.stringify({open:orderCalcOpen, qty:orderCalcQty})); }catch(e){}
}
const ORDER_CALC_KEYS_VISIBLE = 9;

function orderCalcProducts(){
  // Los más comprados primero: en un inventario grande, las 9 teclas visibles
  // deben ser las que el usuario pide siempre, no las primeras por orden de alta.
  // Sin los "solo gasto" (Eat out): un pedido al proveedor no lleva cafés.
  return inventory.filter(i=>!isExpenseItem(i)).sort((a,b)=>
    purchasesForIng(b.id).length - purchasesForIng(a.id).length
    || a.name.localeCompare(b.name, undefined, {numeric:true}));
}
function orderCalcTotal(){
  return Object.entries(orderCalcQty).reduce((s,[id,q])=>{
    const ing = inventory.find(i=>i.id===id);
    return s + (ing ? q*(ing.costPerUnit||0) : 0);
  },0);
}
function ocFmtQty(n){ return String(Math.round(n*100)/100); }
// El pedido como texto plano listo para WhatsApp/SMS/email — el menú de compartir
// del sistema (o el portapapeles como plan B) se encarga del "a dónde".
function orderCalcText(){
  const name = businessName.trim() || 'Dusty';
  const lines = orderCalcProducts().filter(i=>orderCalcQty[i.id])
    .map(i=>`• ${ocFmtQty(orderCalcQty[i.id])} ${unitLabel(i.unit||'unidad')} ${i.name}`);
  return `${t('oc_order_title').replace('{name}', name)} (${localDateStr()})\n\n${lines.join('\n')}\n\n${t('oc_est_total')}: ${money(orderCalcTotal())}`;
}
function orderCalcKey(i){
  return `<button type="button" class="oc-key" data-oc-add="${i.id}">
    <span class="stock-icon-ring" style="width:34px;height:34px;flex-shrink:0;">${stockIconSvg(i)}</span>
    <span class="oc-key-name">${escapeHtml(i.name)}</span>
    <span class="oc-key-price">${money(i.costPerUnit||0)}/${escapeHtml(unitLabel(i.unit||'unidad'))}</span>
  </button>`;
}
function orderCalcLine(i){
  const q = orderCalcQty[i.id];
  const sub = q*(i.costPerUnit||0);
  const name = escapeHtml(i.name);
  return `<div class="oc-line">
    <span class="oc-line-name">${name}</span>
    <button type="button" class="oc-step" data-oc-minus="${i.id}" aria-label="${t('oc_minus_aria').replace('{name}',name)}">&minus;</button>
    ${orderCalcEditingId===i.id
      ? `<input id="oc-qty-input" type="number" min="0" step="any" inputmode="decimal" value="${q}" aria-label="${t('oc_type_aria').replace('{name}',name)}">`
      : `<button type="button" class="oc-qty" data-oc-edit="${i.id}" aria-label="${t('oc_type_aria').replace('{name}',name)}">${ocFmtQty(q)} ${escapeHtml(unitLabel(i.unit||'unidad'))}</button>`}
    <button type="button" class="oc-step" data-oc-plus="${i.id}" aria-label="${t('oc_plus_aria').replace('{name}',name)}">+</button>
    <span class="oc-line-sub">${money(sub)}</span>
  </div>`;
}
function orderCalcPanel(){
  // Hoja de pantalla completa que SUBE desde abajo al tocar la tarjeta (pedido del
  // usuario: "que suba la pantalla completa"). Se renderiza siempre y solo cambia
  // la clase .open — así morphdom no la recrea y la transición de transform corre.
  // Con toda la pantalla, el teclado entero va con scroll y el buscador filtra en
  // inventarios grandes (50+ productos) — ya no hace falta la partición 9+flecha.
  // CERRADA, solo el cascarón (mismo truco que monthRecapModal): generar el
  // teclado completo con las fotos de todos los productos en CADA render de
  // fondo multiplicaba el HTML ×2 sin que nadie lo viera (perf 2026-09-04).
  if(!orderCalcOpen){
    return `<div class="oc-sheet" id="oc-panel" role="dialog" aria-modal="true" aria-label="${t('oc_title')}" aria-hidden="true"></div>`;
  }
  const prods = orderCalcProducts();
  const query = orderCalcSearch.trim().toLowerCase();
  const filtered = query ? prods.filter(i=>(i.name||'').toLowerCase().includes(query)) : prods;
  const lines = prods.filter(i=>orderCalcQty[i.id]).map(orderCalcLine).join('');
  return `
  <div class="oc-sheet ${orderCalcOpen?'open':''}" id="oc-panel" role="dialog" aria-modal="true" aria-label="${t('oc_title')}"${orderCalcOpen?'':' aria-hidden="true"'}>
    <div class="oc-sheet-head">
      <span class="oc-title" style="flex:1;">${t('oc_title')}</span>
      <button type="button" class="link-btn" id="oc-clear" style="padding:4px 8px;">${t('oc_clear')}</button>
      <button type="button" class="oc-close" id="oc-close" aria-label="${t('oc_close')}">✕</button>
    </div>
    <div class="oc-sub">${t('oc_sub')}</div>
    <div class="oc-ticket">${lines || `<div class="oc-empty">${t('oc_empty')}</div>`}</div>
    <div class="oc-total-row">
      <span class="oc-total-label" style="flex:1;">${t('oc_total')}</span>
      <span class="oc-total">${money(orderCalcTotal())}</span>
    </div>
    ${/* La fila se renderiza SIEMPRE (deshabilitada sin líneas): si apareciera
         recién con la primera línea, el teclado entero saltaba 50px hacia abajo
         justo debajo del dedo del usuario — medido en el pase anti-saltos. */''}
    <div class="oc-send-row">
      ${(typeof navigator!=='undefined' && navigator.share) ? `<button type="button" class="btn btn-primary" id="oc-share" style="flex:1;" ${lines?'':'disabled'}>${t('oc_send')}</button>` : ''}
      <button type="button" class="btn btn-ghost" id="oc-copy" style="flex:1;" ${lines?'':'disabled'}>${t('oc_copy')}</button>
    </div>
    ${prods.length > ORDER_CALC_KEYS_VISIBLE ? `
    <div class="field" style="margin-bottom:10px;"><input id="oc-search" type="text" value="${escapeHtml(orderCalcSearch)}" placeholder="${t('oc_search_ph')}"></div>` : ''}
    <div class="oc-scroll">
      ${query && !filtered.length ? `<div class="oc-empty">${t('oc_no_match')}</div>` : `<div class="oc-pad">${filtered.map(orderCalcKey).join('')}</div>`}
    </div>
  </div>`;
}
// Llamada desde attachEvents() (app-07) en cada render, mismo patrón que
// attachProductionEvents: handlers como propiedades on* (morphdom-safe).
function attachOrderCalcEvents(){
  const card = document.getElementById('oc-card');
  if(card){
    const toggle = ()=>{ orderCalcOpen = !orderCalcOpen; orderCalcPersist(); render(); };
    card.onclick = toggle;
    card.onkeydown = (e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); toggle(); } };
  }
  document.querySelectorAll('[data-oc-add]').forEach(b=>{
    b.onclick = ()=>{ const id=b.dataset.ocAdd; orderCalcQty[id]=(orderCalcQty[id]||0)+1; orderCalcPersist(); render(); };
  });
  document.querySelectorAll('[data-oc-minus]').forEach(b=>{
    b.onclick = ()=>{ const id=b.dataset.ocMinus; const v=(orderCalcQty[id]||0)-1; if(v>0) orderCalcQty[id]=v; else delete orderCalcQty[id]; orderCalcPersist(); render(); };
  });
  document.querySelectorAll('[data-oc-plus]').forEach(b=>{
    b.onclick = ()=>{ const id=b.dataset.ocPlus; orderCalcQty[id]=(orderCalcQty[id]||0)+1; orderCalcPersist(); render(); };
  });
  document.querySelectorAll('[data-oc-edit]').forEach(b=>{
    b.onclick = ()=>{ orderCalcEditingId = b.dataset.ocEdit; render(); };
  });
  const inp = document.getElementById('oc-qty-input');
  if(inp){
    if(document.activeElement!==inp){ inp.focus(); inp.select(); }
    inp.onblur = ()=>{
      const id = orderCalcEditingId; if(!id) return;
      const v = parseFloat(inp.value);
      // Tope defensivo: un dedazo tipo 999999999 no debe producir un total absurdo.
      if(!isNaN(v) && v>0) orderCalcQty[id] = Math.min(v, 999999); else delete orderCalcQty[id];
      orderCalcEditingId = null; orderCalcPersist(); render();
    };
    // stopPropagation en Escape: solo cancela la edición de la cantidad; sin él
    // el listener global cerraba la hoja entera (auditoría UX 2026-09-11).
    inp.onkeydown = (e)=>{
      if(e.key==='Enter'){ e.preventDefault(); e.stopPropagation(); inp.blur(); }
      else if(e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); orderCalcEditingId = null; render(); }
    };
  }
  const close = document.getElementById('oc-close');
  if(close) close.onclick = ()=>{ orderCalcOpen = false; orderCalcEditingId = null; orderCalcPersist(); render(); };
  const sheet = document.getElementById('oc-panel');
  if(sheet) sheet.onkeydown = (e)=>{ if(e.key==='Escape'){ orderCalcOpen = false; orderCalcEditingId = null; orderCalcPersist(); render(); } };
  const search = document.getElementById('oc-search');
  if(search) search.oninput = (e)=>{
    // Mismo patrón que receipt-search: render con debounce restaurando foco y
    // cursor, porque el redibujado recrea el <input> a mitad de tipeo.
    const cursorPos = e.target.selectionStart;
    orderCalcSearch = e.target.value;
    scheduleSearchTriggeredRender(()=>{
      const fresh = document.getElementById('oc-search');
      if(fresh){ fresh.focus(); fresh.setSelectionRange(cursorPos, cursorPos); }
    });
  };
  const clear = document.getElementById('oc-clear');
  if(clear) clear.onclick = ()=>{ orderCalcQty = {}; orderCalcEditingId = null; orderCalcPersist(); render(); };
  const share = document.getElementById('oc-share');
  if(share) share.onclick = ()=>{ navigator.share({ title:'Dusty', text: orderCalcText() }).catch(()=>{}); };
  const copy = document.getElementById('oc-copy');
  if(copy) copy.onclick = ()=>{
    navigator.clipboard.writeText(orderCalcText())
      .then(()=>showToast(t('oc_copied')))
      .catch(()=>{});
  };
}

function inventarioView(){
  /* INVENTARIO reorganizado (maqueta aprobada por el usuario 2026-09-07, "hazlo
     exactamente así", pensado para 100+ productos):
     1. franja de números (Valor · Potencial de venta) lado a lado;
     2. fila de herramientas con nombre: Pedido, Conteo (punto
        cuando toca), Escanear estante (el FAB, con su badge "−");
     3. debajo, el buscador con la vista y el ORDEN — se queda fijo al scrollear;
     4. una sola fila de chips: Seleccionar y los tres filtros rápidos
        (Crítico, Toca contar, Sin foto). Las categorías NO están: se repetían
        con los encabezados de grupo de abajo (pedido del usuario 2026-09-09);
     5. chips de categoría como filtro justo sobre la lista, con "Todos";
     6. grupos plegables (recuerdan su estado) y "ver los restantes" pasados
        los 12 — lo plegado no se dibuja, así la pestaña sigue liviana. */
  const allRows = stockRowsData();
  const ccDue = isCycleCountDue();
  const ccDueIds = cycleCountDueIds();
  const sellRows = allRows.filter(r=>!isExpenseItem(r.ing));
  const quick = { crit: sellRows.filter(r=>r.status==='crit'), count: sellRows.filter(r=>ccDueIds.has(r.ing.id)), nophoto: sellRows.filter(r=>!itemPhotoSrc(r.ing)) };
  const searching = !!invSearch.trim();
  let rows = allRows;
  if(invQuickFilter && quick[invQuickFilter]){ const ids = new Set(quick[invQuickFilter].map(r=>r.ing.id)); rows = rows.filter(r=>ids.has(r.ing.id)); }
  rows = invSortRows(rows.filter(r=>invMatches(r.ing.name, invSearch)));
  /* Agrupar por categoría SOLO en el orden por nombre (auditoría 2026-09-08).
     Agrupar y ordenar se peleaban: con 400 productos en 5 categorías, "Menos
     stock" mostraba los 12 más vacíos DE CADA grupo (60 tarjetas) en vez de
     los 12 más vacíos de todos — un producto crítico de Bebidas quedaba
     escondido bajo un grupo sin abrir, y la lista visible no era monótona.
     Por nombre, agrupar es navegar (tiene sentido); por urgencia o por valor,
     lo que se quiere es un ranking, así que va lista plana. */
  const groups = invSort==='name'
    ? groupRowsByCategory(rows)
    : [{id:'__rank', name: invSort==='stock' ? t('inv_sort_stock') : t('inv_sort_value'), rows}];
  const total = sellRows.length;
  // Los ítems de GASTO no cuentan: no son mercadería y ninguna fila de esta
  // pestaña los muestra (stockRowsData ya los filtra) — sumarlos hacía que el
  // número de arriba no coincidiera con nada de lo que se ve abajo.
  const invValue = inventory.filter(i=>!isExpenseItem(i)).reduce((s,i)=>s+(i.qtyOnHand||0)*(i.costPerUnit||0),0);
  const fmt = (n)=>'$'+n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  const withSale = inventory.filter(i=>!i.expenseOnly && (i.salePrice||0)>0);
  const missingSale = inventory.filter(i=>!i.expenseOnly && !(i.salePrice>0) && (i.qtyOnHand||0)>0).length;
  const potential = withSale.reduce((s,i)=>s+(i.qtyOnHand||0)*(i.salePrice||0),0);
  const ocTotal = orderCalcTotal();
  const countSvg = '<svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/><path d="M9 15l2 2 4-4"/></svg>';
  const sortIcon = '<svg viewBox="0 0 20 20" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round"><path d="M6 4v12M6 16l-3-3M6 16l3-3M14 16V4M14 4l-3 3M14 4l3 3"/></svg>';
  const quickChip = (k, label)=>{ const n = quick[k].length; return `<button type="button" class="category-chip quick ${invQuickFilter===k?'on':''} ${n===0?'zero':''}" data-inv-quick="${k}" aria-pressed="${invQuickFilter===k}">${label}<span>${n}</span></button>`; };
  const groupHtml = (g)=>{
    const key = invGroupKey(g);
    // Con búsqueda o filtro rápido no se pliega ni se recorta: el usuario está buscando algo.
    const collapsed = !searching && !invQuickFilter && invCollapsed.has(key);
    const canTrim = !searching && !invQuickFilter && g.rows.length > INV_GROUP_PREVIEW && !invExpanded.has(key);
    const shown = canTrim ? g.rows.slice(0, INV_GROUP_PREVIEW) : g.rows;
    const moreBtn = canTrim
      ? `<button type="button" class="inv-more" data-inv-more="${key}">${t('inv_more').replace('{n}', g.rows.length-INV_GROUP_PREVIEW)} ▾</button>`
      : (invExpanded.has(key) && g.rows.length > INV_GROUP_PREVIEW ? `<button type="button" class="inv-more" data-inv-more="${key}">${t('inv_less')} ▴</button>` : '');
    return `
      <div class="category-group-header inv-group ${collapsed?'collapsed':''}" data-key="invgrp:${key}" data-inv-group="${key}" role="button" tabindex="0" aria-expanded="${!collapsed}" aria-label="${t('inv_group_toggle_aria')}">${escapeHtml(g.name)} <span>${g.rows.length}</span></div>
      ${collapsed ? '' : `<div class="inv-grid ${invLayout}" style="margin-bottom:${moreBtn ? 4 : 16}px;">${shown.map(r=>stockRowHtml(r,ccDueIds)).join('')}</div>${moreBtn}`}`;
  };
  const toolbar = invLayoutToggleHtml().replace('</div>', `
          <span class="inv-sort-wrap ${invSort!=='name'?'on':''}" title="${t('inv_sort_label')}">${sortIcon}
            <select id="inv-sort" aria-label="${t('inv_sort_label')}">
              <option value="name" ${invSort==='name'?'selected':''}>${t('inv_sort_name')}</option>
              <option value="stock" ${invSort==='stock'?'selected':''}>${t('inv_sort_stock')}</option>
              <option value="value" ${invSort==='value'?'selected':''}>${t('inv_sort_value')}</option>
            </select>
          </span></div>`);
  return `
  ${inventory.length>0 && canSeeFinancials() ? `
  ${/* Las dos tarjetas son BOTONES (pedido del usuario 2026-09-11): abren el
       desglose de cómo se llega a ese número — ver invDetailModal. */''}
  <div class="inv-stats">
    <button type="button" class="inv-stat" id="btn-inv-value" aria-haspopup="dialog" title="${t('ivd_see_detail')}"><div class="inv-stat-label">${t('inv_value_label')}</div><div class="inv-stat-value">${fmt(invValue)}</div><span class="inv-stat-chev" aria-hidden="true">›</span></button>
    <button type="button" class="inv-stat" id="btn-inv-potential" aria-haspopup="dialog" title="${t('ivd_see_detail')}"><div class="inv-stat-label">🏷 ${t('inv_potential_label')}</div><div class="inv-stat-value">${fmt(potential)}</div>${missingSale>0 ? `<div class="inv-stat-note">${t('inv_potential_missing').replace('{n}', missingSale)}</div>` : ''}<span class="inv-stat-chev" aria-hidden="true">›</span></button>
  </div>` : ''}
  ${inventory.length>0 ? `
  <div class="inv-tools">
    ${/* Pedido: mismo id oc-card que la tarjeta vieja — attachOrderCalcEvents lo abre. */''}
    <button type="button" class="inv-tool" id="oc-card" aria-expanded="${orderCalcOpen}" title="${t('oc_card_label')}">
      <span class="inv-tool-ring tool-order">🧮</span>
      ${ocTotal>0 ? `<span class="inv-tool-badge">${money(ocTotal)}</span>` : ''}
      <span class="inv-tool-label">${t('inv_tool_order')}</span>
    </button>
    ${/* Escanear estante en el MEDIO (pedido del usuario 2026-09-08, "ponla en
         el medio"), como el escáner de recibos del Dashboard. */''}
    ${shelfScanFab()}
    ${/* Conteo: mismo id cc-banner que la línea roja vieja — abre el conteo cíclico. */''}
    <button type="button" class="inv-tool" id="cc-banner" title="${t('cc_btn')}">
      <span class="inv-tool-ring tool-count">${countSvg}</span>
      ${ccDue ? '<span class="inv-tool-dot"></span>' : ''}
      <span class="inv-tool-label">${t('inv_tool_count')}</span>
    </button>
  </div>` : ''}
  ${inventory.length===0 ? (cloudSyncPending ? loadingSkeleton('inventario') : emptyState('box',t('empty_inventory_title'),t('empty_inventory_sub'),false,
      `<button type="button" class="btn btn-primary" id="btn-inv-empty-scan">${t('dash_empty_scan_btn')}</button>
       <button type="button" class="btn btn-ghost" id="btn-inv-empty-manual">${t('dash_empty_manual_btn')}</button>`)) : `
    ${/* UNA SOLA FILA DE CHIPS, arriba del todo (opción elegida por el usuario
         2026-09-09 sobre tres maquetas). Antes eran TRES franjas de controles
         —categorías, filtros rápidos, buscador— y los productos empezaban
         recién a media pantalla; así se gana una fila entera. Debajo va el
         buscador con el selector de vista y el orden, pegados a la lista.
         Adentro: Seleccionar primero (es lo que se busca al querer borrar
         varios), después los tres filtros rápidos y al final las categorías.
         La fila scrollea a lo ancho, como ya lo hacían las dos por separado. */''}
    ${/* Seleccionar SALIO de esta fila (pedido del usuario 2026-09-10) y la razon
         es de fondo: los otros tres ACHICAN la lista, Seleccionar cambia lo que
         hace tocar una tarjeta. Juntos en la misma fila, la fila enseñaba algo
         falso. Ahora esta fila es solo filtros, y Seleccionar vive con los otros
         controles de la lista (vista, orden), que ademas quedan pegados arriba
         al scrollear. */''}
    <div class="inv-chips">
      ${quickChip('crit', t('inv_quick_crit'))}${quickChip('count', t('inv_quick_count'))}${quickChip('nophoto', t('inv_quick_nophoto'))}
    </div>
    ${/* Barra de selección: reemplaza a la de búsqueda mientras el modo está
         activo (buscar y seleccionar a la vez confunde qué queda marcado al
         cambiar el filtro). El contador cuenta TODO lo seleccionado, incluso lo
         que el filtro actual no muestra — por eso el borrado dice cuántos son. */''}
    ${invSelectMode ? `
    <div class="inv-sticky">
      <div class="inv-selbar">
        ${/* LA SALIDA vive acá, y es obligatoria: esta barra REEMPLAZA a la del
             buscador, asi que el boton "Seleccionar" de arriba no existe mientras
             estas adentro. Antes se salia por ese mismo boton, que vivia en la
             fila de filtros y quedaba visible; al mudarlo, sin este el modo
             seleccion no tenia ninguna salida. */''}
        <button type="button" class="category-chip quick on" id="btn-inv-sel-exit">✓ ${t('inv_select_done')}</button>
        <strong>${t('inv_selected_n').replace('{n}', invSelected.size)}</strong>
        <button type="button" class="link-btn" id="btn-inv-sel-all">${t('inv_select_all')}</button>
        ${/* Compartir las fotos de lo marcado por la hoja nativa del sistema
             (pedido del usuario 2026-09-09) — ver shareSelectedItemPhotos. */''}
        <button type="button" class="btn btn-sm" id="btn-inv-sel-share" ${invSelected.size?'':'disabled'}
          style="margin-left:auto;background:var(--basil);color:var(--on-accent);">${t('inv_share_selected').replace('{n}', invSelected.size)}</button>
        ${/* Tercer botón (idea del usuario 2026-09-10): marcás lo que usás para
             hacer una cosa y se arma la pieza del catálogo con eso adentro.
             Va ANTES de Borrar a propósito — el rojo queda último, que es donde
             se espera lo que destruye. Los productos NO se van del inventario:
             ver moveSelectedToProduction en app-08.
             POR QUE ES DE CONTORNO Y NO RELLENO. La paleta tiene tres colores de
             accion y dos ya estan tomados: Compartir es --basil y Borrar es
             --tomato. --sky no servia (es un ALIAS de --basil, dusty.css linea 36:
             salia del MISMO verde en los 18 temas). --navy choca con el rojo en 7
             temas y --saffron en 2 (coral, crema), donde queda a
             distancia 32-52 de Borrar: dos botones casi del mismo naranja-rojo y
             uno destruye. Todo medido tema por tema, no supuesto.
             La salida no es buscar un cuarto color que la paleta no tiene, sino
             distinguir por PESO: relleno = las dos acciones de siempre, contorno =
             la nueva. Asi el unico boton rojo macizo sigue siendo el que borra,
             que es como tiene que ser.
             EL TEXTO VA EN --ink, NO EN --saffron-ink. Los tokens -ink estan hechos
             para leerse sobre su propio -soft, no sobre --panel: medido sobre los
             pixeles dibujados, con --saffron-ink este boton caia a 1.7:1 en
             "electrico" y 2.5:1 en "miel" — ilegible. Con --ink sobre el -soft el
             contraste lo garantiza el tema, y el color sigue estando en el borde y
             en el fondo, que es donde hace de identidad. La primera verificacion no
             lo vio porque medi que los botones se distinguieran ENTRE SI, no que su
             texto se leyera. */''}
        ${(()=>{
          /* El número del botón cuenta los que DE VERDAD van a entrar, no los
             marcados a secas: con un gasto marcado entre tres, decía "(3)" y
             movía 2. Un botón no puede prometer un número y hacer otro.
             Si quedaron marcados que no sirven, se dice acá mismo y antes de
             tocar nada, no después en un aviso que se va solo. */''
          const listos = (typeof prodEligibleSelected==='function') ? prodEligibleSelected().length : invSelected.size;
          const fuera = invSelected.size - listos;
          return `<button type="button" class="btn btn-ghost btn-sm" id="btn-inv-sel-toprod" ${listos?'':'disabled'}
            title="${fuera>0 ? escapeHtml(t('inv_move_to_prod_skip').replace('{f}', String(fuera))) : ''}"
            style="background:var(--saffron-soft);border-color:var(--saffron);color:var(--ink);font-weight:700;">${t('inv_move_to_prod').replace('{n}', listos)}${fuera>0 ? ` <span style="opacity:.7;font-weight:600;">−${fuera}</span>` : ''}</button>`;
        })()}
        ${/* Pedir: manda el PEDIDO (texto, agrupado por proveedor), no las fotos.
             Son dos acciones distintas con dos destinatarios distintos —Compartir
             es para mostrarle algo a un cliente, Pedir es para el proveedor— y por
             eso tienen nombres distintos y no un solo boton ambiguo.
             De contorno como "A produccion": el unico relleno rojo sigue siendo el
             que borra. */''}
        <button type="button" class="btn btn-ghost btn-sm" id="btn-inv-sel-order" ${invSelected.size?'':'disabled'}
          style="border-color:var(--basil);color:var(--ink);font-weight:700;">${t('inv_order_selected').replace('{n}', invSelected.size)}</button>
        <button type="button" class="btn btn-sm" id="btn-inv-sel-delete" ${invSelected.size?'':'disabled'}
          style="background:var(--tomato);color:var(--on-accent);">${t('inv_delete_selected').replace('{n}', invSelected.size)}</button>
      </div>
    </div>` : `
    <div class="inv-sticky">
      <div class="inv-toolbar" style="align-items:center;gap:8px;margin:0;">
        <div class="inv-search-wrap">
          <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" fill="none" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
          <input id="inv-search" type="search" value="${escapeHtml(invSearch)}" placeholder="${t('inv_search_ph').replace('{n}', total)}" aria-label="${t('inv_search_aria')}" autocomplete="off">
        </div>
        ${/* En el medio, entre el buscador y vista/orden (donde lo puso el usuario). */''}
        <button type="button" class="category-chip quick" id="btn-inv-select" style="flex-shrink:0;">${t('inv_select_btn')}</button>
        ${toolbar}
      </div>
    </div>`}
    ${/* SIN RESULTADOS con salida, y con el mensaje correcto (auditoría
         2026-09-09). Antes los tres casos —búsqueda, filtro rápido y ambos—
         mostraban "Ningún producto coincide" sin ninguna forma de volver. Peor:
         tocar "Sin foto" cuando TODAS las fotos están puestas es una buena
         noticia, y se presentaba como un error. Ahora cada filtro dice lo que
         de verdad pasó y siempre hay un botón para salir. */''}
    ${rows.length===0
      ? (searching || invQuickFilter ? (()=>{
          const filtroVacio = invQuickFilter && !searching;
          const msg = filtroVacio
            ? t('inv_filter_none_' + (invQuickFilter==='nophoto' ? 'nophoto' : invQuickFilter))
            : t('inv_no_match_search').replace('{q}', escapeHtml(invSearch.trim()));
          /* Con el mismo emptyState que usa toda la app (ícono en su medallón,
             título y botón), no un div suelto: escrito a mano quedaba un texto
             flotando sobre 700px de negro y se leía como "se rompió algo"
             (revisado 2026-09-09). */
          const icono = filtroVacio ? (invQuickFilter==='crit' ? 'check' : invQuickFilter==='count' ? 'clock' : 'camera') : 'search';
          const salida = `<button type="button" class="btn btn-ghost btn-sm" id="btn-inv-clear-filters">${filtroVacio ? t('inv_clear_filter') : t('inv_clear_search')}</button>`;
          return emptyState(icono, msg, '', false, salida);
        })()
        : emptyState('box',t('empty_inventory_title'),t('empty_inventory_sub')))
      : groups.map(groupHtml).join('')}
  `}
  `;
}

/* ---------- RECIBOS (historial) ---------- */
// Recuerda qué mes estabas mirando en el calendario de recibos — sin esto, navegar a un
// mes viejo y refrescar la página te devolvía al mes actual, como si te hubieras "perdido".
function setCalendarMonth(m){
  calendarViewMonth = m;
  try{ localStorage.setItem('patron_cal_month', m); }catch(e){}
}
/* Busca por monto ("120" encuentra $120.00) o por nombre de producto comprado
   ("camarón" encuentra un recibo que tenía "Camarones grande"), y marca para
   parpadear en el calendario los días de los recibos que coincidan. Se guarda en
   localStorage para que sobreviva a un refresh de la página — solo se borra si el
   usuario vacía el buscador él mismo, nunca solo. */
function applyCalendarSearch(query){
  calendarAmountQuery = query;
  try{
    if(query) localStorage.setItem('patron_cal_search', query);
    else localStorage.removeItem('patron_cal_search');
  }catch(e){}
  const q = query.trim().toLowerCase();
  if(!q){
    calendarBlinkDates = [];
    return;
  }
  const matches = receipts.filter(r=>{
    const amountMatch = money(r.total).replace('$','').toLowerCase().includes(q);
    const itemMatch = (r.appliedItems||[]).some(it=>((it.rawName||'')+' '+(it.ingName||'')).toLowerCase().includes(q));
    return amountMatch || itemMatch;
  });
  calendarBlinkDates = matches.map(r=>r.date);
  if(matches.length>0) setCalendarMonth(matches[0].date.slice(0,7));
}

/* Se abre al tocar el nombre del mes arriba del calendario — en vez de ir tocando
   "siguiente" doce veces para llegar a otro mes del mismo año, muestra los 12 meses
   como calendarios chiquitos de verdad (con sus días acomodados), no solo el nombre —
   así también se ve de un vistazo en qué días de cada mes hubo recibos (marcados en
   ámbar). Tocar cualquiera de los 12 calendaritos vuelve a la vista grande de ese mes. */
function yearPickerWidget(){
  const year = parseInt(calendarViewMonth.split('-')[0], 10);
  const todayStr = localDateStr();
  const receiptDatesInYear = new Set(
    receipts.filter(r=>r.date && r.date.slice(0,4)===String(year)).map(r=>r.date)
  );
  const miniMonths = MONTH_NAMES[uiLang].map((name, idx)=>{
    const mk = year+'-'+String(idx+1).padStart(2,'0');
    const isCurrent = mk===calendarViewMonth;
    const firstWeekday = new Date(year, idx, 1).getDay();
    const daysInMonth = new Date(year, idx+1, 0).getDate();
    let dayCells = '';
    for(let i=0;i<firstWeekday;i++) dayCells += '<span class="mini-cal-day empty"></span>';
    for(let d=1; d<=daysInMonth; d++){
      const dateStr = mk+'-'+String(d).padStart(2,'0');
      const hasReceipt = receiptDatesInYear.has(dateStr);
      // Los días con nota se tiñen de verde en los 12 calendaritos — así la vista
      // de año también sirve para ubicar pagos/recordatorios, no solo recibos.
      const hasNote = calNotes.length>0 && calNotesOnDate(calNotes, dateStr).length>0;
      const isToday = dateStr===todayStr;
      dayCells += `<span class="mini-cal-day ${hasReceipt?'has-receipt':''} ${!hasReceipt&&hasNote?'has-note':''} ${isToday?'today':''}">${d}</span>`;
    }
    return `
    <button class="cal-year-month ${isCurrent?'current':''}" data-cal-select-month="${mk}">
      <div class="mini-cal-title">${name}</div>
      <div class="mini-cal-grid">${dayCells}</div>
    </button>`;
  }).join('');
  return `
  <div class="cal-widget">
    <div class="cal-header">
      <button class="cal-nav-btn" id="btn-cal-prev-year" title="${t('btn_cal_prev')}">‹</button>
      <button class="cal-month-label" id="btn-cal-month-label" title="${t('btn_cal_month_view')}">${year}<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></button>
      <button class="cal-nav-btn" id="btn-cal-next-year" title="${t('btn_cal_next')}">›</button>
    </div>
    <div class="cal-year-grid">${miniMonths}</div>
  </div>`;
}

/* Calendario del mes, arriba de la lista de recibos. Un bloque de color con los
   números en blanco (maqueta del usuario 2026-09-09): los días que tienen algo se
   marcan con puntitos debajo — uno por recibo hasta tres, y uno ámbar si además
   hay nota (parser de Nudgy). Tocar CUALQUIER día abre el modal unificado del día
   (dayModal): sus recibos con foto, sus notas y el compositor para escribir una
   nueva — un solo modelo mental en vez de tres comportamientos distintos por
   celda, y el lugar donde vive el detalle que la celda ya no muestra. */
function receiptCalendarWidget(){
  if(!calendarViewMonth) calendarViewMonth = localMonthStr();
  if(calendarShowYearPicker) return yearPickerWidget();
  const [y,m] = calendarViewMonth.split('-').map(Number);
  const firstWeekday = new Date(y, m-1, 1).getDay();
  const daysInMonth = new Date(y, m, 0).getDate();
  const todayStr = localDateStr();

  const receiptsByDay = {};
  let monthReceiptCount = 0;
  receipts.forEach(r=>{
    if(!r.date || r.date.slice(0,7)!==calendarViewMonth) return;
    monthReceiptCount++;
    const day = parseInt(r.date.slice(8,10),10);
    if(!receiptsByDay[day]) receiptsByDay[day] = [];
    receiptsByDay[day].push(r);
  });

  /* Los días de los meses vecinos se dibujan atenuados en vez de dejar huecos
     (maqueta del usuario 2026-09-09) — son SOLO decorado: sin data-cal-day no
     son tocables y no abren nada, igual que los huecos vacíos de antes. */
  const cells = [];
  const prevMonthDays = new Date(y, m-1, 0).getDate();
  for(let i=firstWeekday; i>0; i--){
    cells.push(`<div class="cal-day out"><span class="cal-day-num">${prevMonthDays-i+1}</span></div>`);
  }
  for(let day=1; day<=daysInMonth; day++){
    const dateStr = calendarViewMonth+'-'+String(day).padStart(2,'0');
    const dayReceipts = receiptsByDay[day];
    const r = dayReceipts ? dayReceipts[0] : null;
    const multi = dayReceipts && dayReceipts.length>1;
    const isToday = dateStr===todayStr;
    const isBlink = calendarBlinkDates.includes(dateStr);
    // Notas del día (fijas + recurrentes, parser de Nudgy).
    const dayNotes = calNotesOnDate(calNotes, dateStr);
    // Tocar CUALQUIER día abre el modal unificado del día (recibos + notas +
    // compositor) — antes cada celda decidía entre 3 comportamientos distintos.
    /* El día es SIEMPRE su número, y lo que pasa ese día se marca con puntitos
       debajo (maqueta del usuario 2026-09-09) — antes la miniatura del recibo
       tapaba la fecha y cada celda se veía distinta. Un punto por recibo hasta
       tres, más uno de otro color si hay nota; el conteo exacto, la foto y el
       texto de la nota siguen a un toque, en el modal del día. El title conserva
       el detalle para quien pase el mouse. */
    /* La FOTO del recibo vuelve a la celda (pedido del usuario 2026-09-09: "los
       escaneos ya no se ponen encima de la fecha correspondiente"). Se había ido
       con la maqueta del calendario, que puso el número en todos los días; pero
       reconocer el recibo de un vistazo —"el del súper fue el martes"— es
       justamente para lo que se mira este calendario. La celda con recibo pasa a
       ser una casilla con la foto adentro, exactamente del mismo tamaño y forma
       que las demás. El estilo que la hace llenar la casilla va INLINE a
       propósito (además de en dusty.css): si un dispositivo se queda con un CSS
       viejo en caché, la <img> sin ese estilo se dibuja con su proporción
       original y estira la casilla —más alta que las vecinas, que es justo lo
       que reportó el usuario 2026-09-09 con una captura ampliada—. Inline viaja
       con el JS, así que la forma no puede depender de qué CSS quedó cacheado. Los días sin recibo siguen
       mostrando su número, y el puntito ámbar de nota se mantiene en ambos. */
    const cover = dayReceipts && Array.isArray(r.images) ? r.images.find(im=>im && (im.base64 || im.url)) : null;
    const coverSrc = cover ? receiptImgSrc(cover) : null;
    const dots = [];
    if(dayReceipts && !coverSrc) for(let d=0; d<Math.min(dayReceipts.length,3); d++) dots.push('<i></i>');
    // 5. Un punto por TIPO de nota (modo Servicios): trabajo, cobro, mantenimiento, nota.
    if(dayNotes.length){ const kinds = new Set(dayNotes.map(n=>n.svcKind||'note')); ['note','job','due','maint'].forEach(k=>{ if(kinds.has(k)) dots.push(`<i class="note${k==='note'?'':' svc-'+k}"></i>`); }); }
    cells.push(`
      <div class="cal-day ${r?'has-receipt':''} ${coverSrc?'has-photo':''} ${dayNotes.length?'has-note':''} ${isToday?'today':''} ${isBlink?'blink':''}" data-key="cal:${dateStr}" data-cal-day="${dateStr}" ${r?`title="${multi?dayReceipts.length+' '+t('products_plural'):escapeHtml(r.supplier)||t('no_supplier_name')}"`:dayNotes.length?`title="${escapeHtml(dayNotes[0].text)}"`:''}>
        ${/* Día con recibo: el ICONO de recibo en lugar del número (pedido del
             usuario 2026-09-09: "deja todo como está, solo pon el recibo en
             lugar del número"), y la foto encima cuando la hay y carga. Si la
             foto falla (URL de la nube caída) se quita sola y queda el icono —
             antes la casilla quedaba vacía. */''}
        ${r ? `<span class="cal-day-receipt-icon">${lineIcon('receipt',18)}</span>` : `<span class="cal-day-num">${day}</span>`}
        ${coverSrc
          ? `<img class="cal-day-photo" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;" src="${escapeHtml(coverSrc)}" alt="" ${imgLoadAttr(coverSrc)} decoding="async" onerror="this.remove();">
             ${multi ? `<span class="cal-day-badge">&times;${dayReceipts.length}</span>` : ''}`
          : ''}
        ${dots.length ? `<span class="cal-dots">${dots.join('')}</span>` : ''}
      </div>
    `);
  }

  /* SIEMPRE 6 filas (42 celdas), aunque el mes entre en 4 o 5 (auditoría
     2026-09-09): antes el calendario medía 324, 368 o 412px según el mes y al
     pasar de febrero a marzo el widget crecía 88px de golpe — el buscador y la
     lista de recibos daban un salto en la cara del usuario. Con alto fijo,
     cambiar de mes solo cambia los números. */
  const tail = 42 - cells.length;
  for(let d=1; d<=tail; d++) cells.push(`<div class="cal-day out"><span class="cal-day-num">${d}</span></div>`);

  /* El nombre de View Transition lo lleva UNO SOLO a la vez (ver miniCalendarWidget
     y openReceiptsSheet): con el chiquito de la tarjeta y este puestos al mismo
     tiempo, el navegador descarta la transición entera y la hoja aparece de golpe.
     Con la hoja abierta manda este; con la hoja cerrada, el de la tarjeta. */
  return `
  <div class="cal-widget"${showReceiptsSheet ? ' style="view-transition-name:receipts-calendar;"' : ''}>
    <div class="cal-header">
      <button class="cal-nav-btn" id="btn-cal-prev" title="${t('btn_cal_prev')}">‹</button>
      <button class="cal-month-label" id="btn-cal-month-label" title="${t('btn_cal_year_view')}">${monthLabel(calendarViewMonth, uiLang)}<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></button>
      <button class="cal-nav-btn" id="btn-cal-next" title="${t('btn_cal_next')}">›</button>
    </div>
    <div class="cal-grid cal-weekdays">
      ${WEEKDAY_NAMES[uiLang].map(w=>`<div class="cal-weekday">${w}</div>`).join('')}
    </div>
    <div class="cal-grid">
      ${cells.join('')}
    </div>
    ${/* Cuántos recibos tiene el mes que se está mirando (pedido del usuario
         2026-09-09). Solo a partir de dos: con uno solo, la casilla ya lo dice
         todo y la línea sobraría. El ×N de cada casilla sigue contando los del
         día; este cuenta el mes entero. */''}
    ${monthReceiptCount > 1 ? `<div class="cal-month-count">${t('cal_month_receipts').replace('{n}', monthReceiptCount)}</div>` : ''}
    ${usesServices() ? `<div class="svc-legend"><span><i class="svc-job"></i>${t('svc_legend_job')}</span><span><i class="svc-due"></i>${t('svc_legend_due')}</span><span><i class="svc-maint"></i>${t('svc_legend_maint')}</span><span><i></i>${t('svc_legend_note')}</span></div>` : ''}
    ${/* Cierre de mes, ubicado acá (decisión del usuario): resume el mes que el
         calendario está mostrando — la conclusión del arco, junto a sus datos. */''}
    <button type="button" class="cal-recap-btn" id="btn-month-recap">${t('recap_btn')}</button>
  </div>`;
}

/* Modal unificado de un día del calendario: recibos de ese día (si hay), notas
   (fijas o recurrentes que caigan ahí) y el compositor de nota nueva con la vista
   previa en vivo del parser de Nudgy — mientras escribís, muestra qué entendió
   ("Cada mes, 9:00 am") ANTES de guardar. */
function dayModal(){
  if(!showDayModal) return '';
  const dayReceipts = receipts.filter(r=>r.date===showDayModal);
  const dayNotes = calNotesOnDate(calNotes, showDayModal);
  const d = calDateFromStr(showDayModal);
  const weekday = CAL_NOTE_WEEKDAYS[uiLang][d.getDay()];
  const title = weekday.charAt(0).toUpperCase()+weekday.slice(1)+' '+d.getDate()+' '+MONTH_NAMES[uiLang][d.getMonth()]+' '+d.getFullYear();
  const previewNow = calNotePreviewText(dayNoteDraft);
  return `
  <div class="overlay" id="day-modal-overlay">
    <div class="modal">
      <h3 class="navy">${title}</h3>
      ${dayReceipts.length===0 && dayNotes.length===0 ? `<div class="sub">${t('day_modal_empty')}</div>` : ''}
      ${dayReceipts.length ? `
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:${dayNotes.length?'16px':'4px'};">
        ${dayReceipts.map(r=>{
          const cover = receiptImages(r)[0];
          return `
          <div class="day-receipt-row" data-view-receipt="${r.id}">
            <div class="day-receipt-thumb">
              ${cover ? `<img src="${escapeHtml(receiptImgSrc(cover))}" alt="" ${imgLoadAttr(receiptImgSrc(cover))} decoding="async" onerror="this.style.display='none'">` : `<span style="display:flex;color:var(--ink-soft);">${lineIcon('receipt',18)}</span>`}
            </div>
            <div style="flex:1;min-width:0;">
              <div style="font-weight:700;font-size:calc(13.5px * var(--fs, 1));">${escapeHtml(r.supplier)||t('no_supplier_name')}</div>
              <div style="font-size:calc(11.5px * var(--fs, 1));color:var(--ink-soft);">${escapeHtml(r.itemCount)} ${r.itemCount!==1?t('products_plural'):t('product_singular')}</div>
            </div>
            <div style="font-family:'IBM Plex Mono';font-weight:700;color:var(--navy);font-size:calc(14px * var(--fs, 1));flex-shrink:0;">${money(r.total)}</div>
          </div>`;
        }).join('')}
      </div>` : ''}
      ${dayNotes.length ? `
      <div class="cal-note-section-title">${t('day_modal_notes_title')}</div>
      <div style="display:flex;flex-direction:column;gap:6px;">
        ${dayNotes.map(n=>`
        <div class="cal-note-row">
          <span class="cal-note-emoji">${escapeHtml(n.icon||'📌')}</span>
          <div style="flex:1;min-width:0;">
            <div class="cal-note-text">${escapeHtml(n.text)}</div>
            ${calNoteWhenText(n) ? `<div class="cal-note-when">${escapeHtml(calNoteWhenText(n))}</div>` : ''}
          </div>
          ${n.svcKind==='due' && n.jobId ? `<button type="button" class="btn btn-ghost btn-sm" data-wa-job="${escapeHtml(n.jobId)}" title="${t('svc_whatsapp')}" style="flex-shrink:0;padding:6px 9px;">💬</button>` : ''}
          <button class="stock-row-x-btn" data-delete-note="${n.id}" title="${t('note_delete_title')}">✕</button>
        </div>`).join('')}
      </div>` : ''}
      <div class="cal-note-composer">
        <input id="day-note-input" type="text" value="${escapeHtml(dayNoteDraft)}" placeholder="${t('note_input_placeholder')}" autocomplete="off">
        <button class="btn btn-primary btn-sm" id="btn-add-day-note">${t('note_add_btn')}</button>
      </div>
      <div id="day-note-preview" class="cal-note-preview" style="${previewNow?'':'display:none;'}">✨ <span id="day-note-preview-text">${escapeHtml(previewNow)}</span></div>
      <div class="modal-actions">
        <button class="btn btn-ghost" id="btn-close-day-modal" style="width:100%;">${t('btn_close')}</button>
      </div>
    </div>
  </div>`;
}

// Tamaño de la ventana de recibos (ver recibosView) — arranca en un paso y crece
// de a pasos con "Mostrar más". El buscador la resetea (app-07).
const RECEIPTS_WINDOW_STEP = 60;
let receiptsShownLimit = RECEIPTS_WINDOW_STEP;
/* EL CALENDARIO EN CHIQUITO para la tarjeta del Dashboard. Es el mismo mes que
   muestra el grande (calendarViewMonth), con las mismas marcas, pero sin nada
   tocable adentro: la tarjeta entera es el botón. Se dibuja aparte y no
   reusando receiptCalendarWidget porque aquel trae encabezado de mes con
   flechas, fotos de recibo por día, puntos de nota y celdas de 44px — en 160px
   de alto eso no se lee, se amontona. Acá cada día es un punto: lleno si hubo
   recibos, aro si es hoy.
   Siempre 6 filas, igual que el grande: así la tarjeta mide lo mismo en febrero
   que en marzo y el Dashboard no da un salto al cambiar de mes. */
function miniCalendarWidget(){
  /* EL MES EN PUNTOS, para que la tarjeta mida lo mismo que las demás (pedido del
     usuario 2026-09-10: "lo quiero del mismo tamaño de las demás para que no
     distorsione nada"). En media tarjeta hay ~21px por columna: un número de día
     ahí queda en 8px, ilegible, y las seis filas estiraban la tarjeta al doble de
     alto que su vecina — y como las dos comparten fila de la grilla, la vecina se
     estiraba con ella. Eso era lo que distorsionaba.
     Sin números sigue siendo un calendario: se ve la forma del mes y en qué días
     hubo movimiento, que es lo que se mira de un vistazo. El día exacto, la foto y
     el monto están a un toque, en Recibos.
     Siempre 6 filas, igual que el calendario grande: así la tarjeta mide lo mismo
     en febrero que en marzo y el Dashboard no da un salto al cambiar de mes.
     El mes va en el subtítulo de la tarjeta, no acá: una línea menos que restar
     al alto disponible. */
  const mes = localMonthStr();
  const [y,m] = mes.split('-').map(Number);
  const primerDia = new Date(y, m-1, 1).getDay();
  const diasDelMes = new Date(y, m, 0).getDate();
  const hoy = localDateStr();
  const conRecibo = new Set();
  receipts.forEach(r=>{ if(r && r.date && r.date.slice(0,7)===mes) conRecibo.add(r.date); });
  const conNota = new Map(); // fecha → tipo más urgente (cobro > mantenimiento > trabajo > nota)
  for(let d=1; d<=diasDelMes; d++){
    const f = mes+'-'+String(d).padStart(2,'0');
    const ns = calNotesOnDate(calNotes, f);
    if(ns.length){ const ks = new Set(ns.map(n=>n.svcKind||'note')); conNota.set(f, ks.has('due') ? 'svc-due' : ks.has('maint') ? 'svc-maint' : ks.has('job') ? 'svc-job' : ''); }
  }
  const celdas = [];
  for(let i=0; i<primerDia; i++) celdas.push('<i class="mc-day out"></i>');
  for(let d=1; d<=diasDelMes; d++){
    const f = mes+'-'+String(d).padStart(2,'0');
    const clases = ['mc-day'];
    if(conRecibo.has(f)) clases.push('has');
    else if(conNota.has(f)){ clases.push('note'); if(conNota.get(f)) clases.push(conNota.get(f)); }
    if(f===hoy) clases.push('today');
    celdas.push(`<i class="${clases.join(' ')}"></i>`);
  }
  while(celdas.length < 42) celdas.push('<i class="mc-day out"></i>');
  const dias = (WEEKDAY_NAMES[uiLang] || WEEKDAY_NAMES.es || []);
  return `
  <div class="dash-cal"${showReceiptsSheet ? '' : ' style="view-transition-name:receipts-calendar;"'}>
    <div class="mc-week">${dias.map(d=>`<span>${escapeHtml(d)}</span>`).join('')}</div>
    <div class="mc-grid">${celdas.join('')}</div>
  </div>`;
}

/* RECIBOS A PANTALLA COMPLETA. La misma vista de siempre (recibosView), ahora
   dentro de una hoja que se abre desde la tarjeta del calendario en vez de ser
   una pestaña. No se duplicó una línea de recibosView: solo cambió por dónde se
   entra. */
function receiptsSheet(){
  return `
  <div class="overlay sheet-overlay" id="receipts-sheet-overlay">
    <div class="full-sheet">
      <div class="full-sheet-bar">
        <strong>${t('tab_receipts')}</strong>
        <button type="button" class="sheet-close" id="btn-close-receipts-sheet" aria-label="${t('btn_close')}">
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" stroke-width="2.2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="full-sheet-body">${recibosView()}</div>
    </div>
  </div>`;
}

function recibosView(){
  const query = receiptSearchQuery.trim().toLowerCase();
  // Filtro por activo (app-15): "Ver todos" de la ficha de un camión/máquina abre
  // ESTA lista con solo sus gastos (los del activo y los de sus trabajos) y un chip
  // arriba para salir. Antes abría la lista general sin ninguna marca.
  const fa = (typeof receiptsAssetFilter!=='undefined' && receiptsAssetFilter && typeof assetById==='function') ? assetById(receiptsAssetFilter) : null;
  const faIds = fa ? new Set(assetReceipts(fa.id).map(r=>r.id)) : null;
  const filtered = receipts.filter(r=>{
    if(faIds && !faIds.has(r.id)) return false;
    if(!query) return true;
    const supplierMatch = (r.supplier||'').toLowerCase().includes(query);
    const itemMatch = (r.appliedItems||[]).some(it=>(it.rawName||'').toLowerCase().includes(query));
    return supplierMatch || itemMatch;
  });
  const sorted = [...filtered].sort((a,b)=>new Date(b.date)-new Date(a.date));

  /* Ventana: solo se renderizan los primeros N recibos (cada tarjeta son ~10 nodos
     de DOM y las recientes llevan su foto en base64 dentro del HTML — con cientos
     de recibos, construir TODO en cada render se sentía pesado en el teléfono).
     "Mostrar más" agranda la ventana de a tandas; el buscador resetea la ventana
     (ver el handler del buscador en app-07). */
  const windowed = sorted.slice(0, receiptsShownLimit);
  const hiddenCount = sorted.length - windowed.length;

  // Agrupados por mes (más reciente primero) para que se puedan ubicar rápido en vez
  // de scrollear una sola lista larga, igual que ya se hace con el gasto mensual.
  const groups = [];
  windowed.forEach(r=>{
    const key = monthKey(r.date);
    let g = groups.find(g=>g.key===key);
    if(!g){ g = {key, label: monthLabel(key, uiLang), receipts: [], total: 0}; groups.push(g); }
    g.receipts.push(r);
    g.total += r.total||0;
  });

  return `
  ${/* Sin título ni bajada (pedido del usuario 2026-09-09): la pestaña abre
       directo en el calendario — el nombre ya lo dice la barra de abajo.
       Sin el botón "Scan receipt" tampoco: escanear vive en el botón grande del
       Dashboard. Y sin recibos todavía no hay nada que buscar, así que el
       buscador por monto recién aparece con el primero (el calendario sí se
       muestra siempre: sirve para anotar recordatorios). */''}
  ${/* Sin el buscador por monto sobre el calendario (el usuario lo quitó,
       2026-09-09): el bloque azul abre la pestaña a sangre. El buscador por
       proveedor o producto, debajo del calendario, sigue. */''}
  ${/* El calendario va SIEMPRE (corrección 2026-09-07): esconderlo sin recibos
       dejaba a un usuario nuevo sin poder anotar un recordatorio tocando un día.
       Solo el buscador por monto (arriba) espera al primer recibo. */''}
  ${receiptCalendarWidget()}
  ${fa ? svcAssetFilterChip(fa, 'svc_receipts_of_asset', sorted.length, 'btn-clear-receipts-asset') : ''}
  ${/* Buscador + REPORTES (pedido del usuario 2026-09-11): el constructor por
       rango mezcla días y meses en un PDF con la información extraída. */''}
  ${receipts.length>0 ? `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;"><div class="field" style="flex:1;min-width:180px;max-width:340px;margin:0;"><input id="receipt-search" type="text" value="${escapeHtml(receiptSearchQuery)}" placeholder="${t('rec_search_placeholder')}"></div><button type="button" class="btn btn-ghost btn-sm" id="btn-report-builder" title="${t('rb_sub')}">${t('rb_btn')}</button></div>` : ''}
  ${receipts.length===0 ? (cloudSyncPending ? loadingSkeleton('recibos') : emptyState('receipt',t('empty_receipts_title'),'',true,
      `<button type="button" class="btn btn-primary" id="btn-rec-empty-scan">${t('dash_empty_scan_btn')}</button>`)) :
    (sorted.length===0 ? `<div class="helper-note" style="margin:4px 0 0;">${t('rec_no_matches')}</div>` :
    groups.map(g=>`
      <div class="section-head" style="margin-top:22px;margin-bottom:10px;">
        <h3 style="margin:0;font-size:calc(14px * var(--fs, 1));text-transform:capitalize;">${g.label}</h3>
        <div style="font-size:calc(12px * var(--fs, 1));color:var(--ink-soft);">${t('rec_month_total')}: <strong style="color:var(--ink);">${money(g.total)}</strong></div>
      </div>
      <div class="dish-grid">
        ${g.receipts.map(r=>{
          const imgs = receiptImages(r);
          const cover = imgs[0];
          return `
          ${/* view-transition-name SOLO en la tarjeta que vuela hacia/desde su
               detalle (receiptVtTargetId, ver render() en app-04) — antes lo
               llevaban TODAS y cada transición de la app capturaba 120 capas. */''}
          <div class="dish-card" style="cursor:pointer;position:relative;${(receiptVtTargetId===r.id && showReceiptDetail!==r.id)?`view-transition-name:${receiptVtName(r.id)};`:''}" data-view-receipt="${r.id}" data-key="rc:${r.id}">
            ${cover ? `<img src="${escapeHtml(receiptImgSrc(cover))}" alt="" ${imgLoadAttr(receiptImgSrc(cover))} decoding="async" style="width:100%;height:140px;object-fit:cover;" onerror="this.outerHTML='<div style=&quot;width:100%;height:140px;background:var(--inset);&quot;></div>'">` : `<div style="width:100%;height:140px;background:var(--inset);"></div>`}
            ${imgs.length>1 ? `<span style="position:absolute;top:10px;right:10px;background:rgba(0,0,0,0.6);color:#fff;font-size:calc(11px * var(--fs, 1));font-weight:700;padding:2px 8px;border-radius:20px;">${imgs.length}p</span>` : ''}
            <div style="padding:14px 16px;">
              <div style="font-weight:700;font-size:calc(14px * var(--fs, 1));">${escapeHtml(r.supplier)||t('no_supplier_name')}</div>
              <div style="font-size:calc(11.5px * var(--fs, 1));color:var(--ink-soft);margin:3px 0 8px;">${escapeHtml(r.date)} &middot; ${escapeHtml(r.itemCount)} ${r.itemCount!==1?t('products_plural'):t('product_singular')}</div>
              ${/* Monto = color de dinero fijo (regla 2026-09-06), no el acento del tema. */''}
              <div style="font-family:'IBM Plex Mono';font-weight:700;color:var(--money-pos);font-size:calc(15px * var(--fs, 1));">${money(r.total)}</div>
            </div>
          </div>
        `;
        }).join('')}
      </div>
    `).join('') + (hiddenCount>0 ? `
    <div style="text-align:center;margin:18px 0 6px;">
      <button type="button" class="btn btn-ghost" id="btn-show-more-receipts">${t('rec_show_more').replace('{n}', Math.min(hiddenCount, RECEIPTS_WINDOW_STEP))}</button>
      <div class="helper-note" style="margin-top:6px;">${t('rec_showing_n').replace('{shown}', windowed.length).replace('{total}', sorted.length)}</div>
    </div>` : ''))
  }
  `;
}

/* ---------- HISTORIAL DE PRECIO POR INGREDIENTE ---------- */
function openPriceHistoryModal(ingId){ priceHistoryIngId = ingId; showPriceHistoryModal = true; render(); }
function closePriceHistoryModal(){ showPriceHistoryModal = false; priceHistoryIngId = null; render(); }

// id incremental para el <linearGradient> del área del gráfico — un id fijo se
// repetiría si el navegador llegara a tener más de un <svg> de este chart en el DOM
// a la vez (no pasa hoy, pero cuesta cero evitarlo de raíz).
let __chartGradientSeq = 0;
function priceHistoryChart(points){
  /* viewBox de 340 (antes 560): en el teléfono el SVG se pinta a ~300 px, así
     que con 560 los textos de 10 unidades quedaban de 6 px, ilegibles y sin
     crecer con el tamaño de letra. Ahora 1 unidad ≈ 1 px, el margen izquierdo
     sale del monto más largo (antes cortaba el "$"), arriba hay lugar para la
     etiqueta final y abajo van las FECHAS (auditoría UX 2026-09-11). Los
     tamaños de texto los pone .ph-chart en dusty.css, escalados por --fs. */
  const prices = points.map(p=>p.unitPrice);
  let min = Math.min(...prices), max = Math.max(...prices);
  if(min===max){ min = min*0.9; max = (max*1.1)||1; } // evita aplanar la gráfica si el precio nunca cambió
  const W = 340, H = 190, padR = 14, padT = 30, padB = 26;
  const padL = Math.min(120, Math.max(48, Math.max(money(max).length, money(min).length) * 7 + 12));
  const innerW = W - padL - padR, innerH = H - padT - padB;

  const xFor = (i)=> padL + (points.length===1 ? innerW/2 : (i/(points.length-1))*innerW);
  const yFor = (v)=> padT + innerH - ((v-min)/(max-min))*innerH;

  const first = points[0].unitPrice, last = points[points.length-1].unitPrice;
  const changePct = first>0 ? ((last-first)/first)*100 : 0;
  const trendColor = changePct>3 ? 'var(--money-neg)' : changePct<-3 ? 'var(--money-pos)' : 'var(--navy)';

  const gridLines = [0,0.5,1].map(f=>{
    const y = padT + innerH*f;
    const val = max - (max-min)*f;
    return `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W-padR}" y2="${y.toFixed(1)}" stroke="var(--line)" stroke-width="1"/>
      <text x="${padL-8}" y="${(y+3).toFixed(1)}" text-anchor="end" fill="var(--ink-soft)" font-family="IBM Plex Mono">${money(val)}</text>`;
  }).join('');
  // Fechas bajo la línea base: primera, última y (con 3+ puntos) la del medio.
  const dateIdx = points.length>=3 ? [0, Math.floor((points.length-1)/2), points.length-1] : points.map((_,i)=>i);
  const dateLabels = [...new Set(dateIdx)].map(i=>{
    const anchor = points.length===1 ? 'middle' : i===0 ? 'start' : i===points.length-1 ? 'end' : 'middle';
    return `<text x="${xFor(i).toFixed(1)}" y="${(H-8).toFixed(1)}" text-anchor="${anchor}" fill="var(--ink-soft)" font-family="IBM Plex Mono">${escapeHtml(shortDateLabel(points[i].date))}</text>`;
  }).join('');

  const linePoints = points.map((p,i)=> `${xFor(i).toFixed(1)},${yFor(p.unitPrice).toFixed(1)}`).join(' ');

  const markers = points.map((p,i)=>{
    const x=xFor(i).toFixed(1), y=yFor(p.unitPrice).toFixed(1);
    return `<circle cx="${x}" cy="${y}" r="4" fill="${trendColor}" stroke="var(--panel)" stroke-width="2">
      <title>${escapeHtml(p.date)} · ${escapeHtml(p.supplier)} · ${money(p.unitPrice)}</title>
    </circle>`;
  }).join('');

  const lastX = xFor(points.length-1), lastY = yFor(last);
  const endLabel = `<text class="ph-end" x="${Math.min(lastX, W-padR).toFixed(1)}" y="${(lastY-10).toFixed(1)}" text-anchor="end" font-weight="700" fill="var(--ink)" font-family="IBM Plex Mono">${money(last)}</text>`;

  // Área bajo la línea con degradado hacia transparente — el mismo dato de siempre,
  // pero se lee de un vistazo como un gráfico "de verdad" en vez de una línea pelada.
  const gradId = 'ph-grad-'+(__chartGradientSeq++);
  const baseline = (padT+innerH).toFixed(1);
  const areaPoints = `${xFor(0).toFixed(1)},${baseline} ${linePoints} ${xFor(points.length-1).toFixed(1)},${baseline}`;

  return `<svg class="ph-chart" viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;">
    <defs>
      <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${trendColor}" stop-opacity="0.22"/>
        <stop offset="100%" stop-color="${trendColor}" stop-opacity="0"/>
      </linearGradient>
    </defs>
    ${gridLines}
    <polygon points="${areaPoints}" fill="url(#${gradId})"/>
    <polyline points="${linePoints}" fill="none" stroke="${trendColor}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    ${markers}
    ${endLabel}
    ${dateLabels}
  </svg>`;
}
// "11 sep" / "Sep 11" para los ejes: corto, en el idioma de la app.
function shortDateLabel(dateStr){
  const d = new Date(String(dateStr).slice(0,10)+'T00:00:00');
  if(isNaN(d)) return String(dateStr||'');
  try{ return d.toLocaleDateString(uiLang==='es' ? 'es' : 'en', {day:'numeric', month:'short'}).replace('.', ''); }catch(e){ return String(dateStr); }
}

/* Agrupa las compras de un ingrediente por proveedor, para poder comparar quién
   te está cobrando más caro sin tener que leer todo el historial a mano */
function supplierComparisonRows(points){
  const bySupplier = {};
  points.forEach(p=>{
    const key = (p.supplier||'').trim() || t('fallback_unspecified');
    if(!bySupplier[key]) bySupplier[key] = {supplier:key, prices:[], lastDate:'', lastPrice:0};
    bySupplier[key].prices.push(p.unitPrice);
    if(p.date >= bySupplier[key].lastDate){ bySupplier[key].lastDate = p.date; bySupplier[key].lastPrice = p.unitPrice; }
  });
  return Object.values(bySupplier)
    .map(s=>({supplier:s.supplier, lastPrice:s.lastPrice, avgPrice:s.prices.reduce((a,b)=>a+b,0)/s.prices.length, count:s.prices.length}))
    .sort((a,b)=>a.lastPrice-b.lastPrice);
}

function priceHistoryModal(){
  const ing = inventory.find(i=>i.id===priceHistoryIngId);
  if(!ing) return '';
  const allForIng = purchases.filter(p=>p.ingId===ing.id && p.qty>0);
  // Solo se compara el precio entre compras que vinieron en la MISMA unidad que el
  // producto tiene hoy — mezclar libras con cajas en la misma gráfica/tabla daría una
  // tendencia de precio inventada (ver lastPriceChangePct, mismo problema de fondo).
  // Las compras viejas sin "unit" guardado (de antes de este arreglo) también quedan
  // afuera, para no confiar a ciegas en un dato que no se sabe si coincide.
  const points = allForIng
    .filter(p=>p.unit===ing.unit)
    .map(p=>({date:p.date, supplier:p.supplier, unitPrice:p.totalPrice/p.qty}))
    .sort((a,b)=> new Date(a.date)-new Date(b.date));
  const excludedCount = allForIng.length - points.length;
  const supplierRows = supplierComparisonRows(points);

  let summary = '';
  if(points.length>=2){
    const first = points[0].unitPrice, last = points[points.length-1].unitPrice;
    const changePct = first>0 ? ((last-first)/first)*100 : 0;
    const up = changePct>3, down = changePct<-3;
    const color = up?'var(--money-neg-ink)':down?'var(--money-pos)':'var(--ink-soft)';
    const bg = up?'var(--money-neg-soft)':down?'var(--money-pos-soft)':'var(--inset)';
    const arrow = up?'▲':down?'▼':'→';
    const phrase = (up||down)
      ? `${arrow} ${up?t('ph_up'):t('ph_down')} ${Math.abs(changePct).toFixed(0)}% ${t('ph_since_first')} (${points[0].date})`
      : `${arrow} ${t('ph_no_change')} (${points[0].date})`;
    summary = `<div class="scan-status" style="background:${bg};color:${color};">${phrase}</div>`;
  }

  return `
  <div class="overlay" id="price-history-overlay">
    <div class="modal wide">
      <h3 class="saffron">${t('ph_title_prefix')}${escapeHtml(ing.name)}</h3>
      <div class="sub">${t('ph_sub')}</div>
      ${excludedCount>0 ? `<div class="helper-note" style="margin:0 0 10px;">${t('ph_excluded_units').replace('{n}', excludedCount)}</div>` : ''}
      ${points.length<2 ? `
        <div class="helper-note" style="margin:0 0 16px;">${t('ph_not_enough')} ${points.length}.</div>
      ` : `
        ${summary}
        <div style="margin:14px 0;">${priceHistoryChart(points)}</div>
        ${supplierRows.length>=2 ? `
          <label style="display:block;font-size:calc(12px * var(--fs, 1));font-weight:700;color:var(--ink);margin-bottom:8px;">${t('supplier_compare_title')}</label>
          <div class="ing-list-mini" style="max-height:150px;">
            ${supplierRows.map((s,idx)=>`
              <div class="ing-list-mini-item">
                <span>${escapeHtml(s.supplier)} ${idx===0?`<span class="price-updated">${t('cheapest_label')}</span>`:''}
                  ${s.count>1?`<div style="font-size:calc(10.5px * var(--fs, 1));color:var(--ink-soft);margin-top:2px;">${t('avg_price_label')} ${money(s.avgPrice)}/${escapeHtml(unitLabel(ing.unit))}</div>`:''}
                </span>
                <span class="mono-cell">${money(s.lastPrice)}/${escapeHtml(unitLabel(ing.unit))}</span>
              </div>
            `).join('')}
          </div>
          <div class="helper-note" style="margin-top:6px;">${t('supplier_compare_helper')}</div>
        ` : ''}
        <label style="display:block;font-size:calc(12px * var(--fs, 1));font-weight:700;color:var(--ink);margin:14px 0 8px;">${t('ph_full_history_label')}</label>
        <div class="ing-list-mini" style="max-height:160px;">
          ${points.slice().reverse().map(p=>`
            <div class="ing-list-mini-item">
              <span>${escapeHtml(p.date)} &middot; ${escapeHtml(p.supplier)}</span>
              <span class="mono-cell">${money(p.unitPrice)}/${escapeHtml(unitLabel(ing.unit))}</span>
            </div>
          `).join('')}
        </div>
      `}
      <div class="modal-actions">
        <button class="btn btn-ghost" id="btn-close-price-history" style="flex:1;">${t('btn_close')}</button>
      </div>
    </div>
  </div>`;
}

/* ---------- TODOS LOS MESES (comparar gasto mes a mes) ---------- */
function openMonthlySpendModal(){ showMonthlySpendModal = true; render(); }
function closeMonthlySpendModal(){ showMonthlySpendModal = false; render(); }

/* Una TARJETA por mes, en frases (rediseño 2026-09-09 a pedido del usuario:
   "que se entienda como que son niños de 12 años"). Antes esto era un gráfico
   SVG apilado con eje de montos, línea punteada del presupuesto y una leyenda
   de tres colores — había que saber leer un gráfico para responder algo tan
   simple como "cuánto gasté y cuánto me quedaba", y con un solo mes sin datos
   (el caso de recién instalado) el gráfico ocupaba media pantalla sin decir
   nada. Ahora cada mes dice su número grande, una barra contra el tope y una
   frase en castellano llano. Los cálculos son exactamente los mismos.
   La barra mide GASTOS contra el presupuesto (el presupuesto mide solo gastos);
   la mercadería va aparte, en la línea chica de abajo, porque comprar stock no
   es gastar — es convertir plata en inventario. */
function monthlySpendCard(m, currentMonthKey){
  const s = spendSplitForMonth(m), b = budgetForMonth(m) || 0;
  const pct = b ? Math.round(s.expense/b*100) : 0;
  const over = Math.max(s.expense - b, 0), left = Math.max(b - s.expense, 0);
  const isCurrent = m === currentMonthKey;
  // Mismo semáforo que la barra de presupuesto del panel: 80% avisa, 100% se pasó.
  const level = !b ? 'ok' : (pct >= 100 ? 'crit' : pct >= 80 ? 'warn' : 'ok');
  const line = !b
    ? t(isCurrent ? 'ms_line_nb_now' : 'ms_line_nb').replace('{exp}', `<b>${money(s.expense)}</b>`)
    : over > 0
      ? t('ms_line_over').replace('{exp}', `<b>${money(s.expense)}</b>`).replace('{bud}', money(b)).replace('{over}', `<b>${money(over)}</b>`)
      : t(isCurrent ? 'ms_line_now' : 'ms_line_past').replace('{exp}', `<b>${money(s.expense)}</b>`).replace('{bud}', money(b)).replace('{left}', `<b>${money(left)}</b>`);
  return `
    <div class="ms-card ${isCurrent ? 'now' : ''} ${level}">
      <div class="ms-card-head">
        <span class="ms-card-month">${escapeHtml(monthLabel(m, uiLang))}${isCurrent ? `<span class="ms-card-badge">${t('ms_current_month')}</span>` : ''}</span>
        <span class="ms-card-amount">${money(s.expense)}</span>
      </div>
      ${/* "Reports": el informe de ESTE mes en PDF (app-14). */''}
      <div class="ms-card-tools">${reportButtonHtml(m)}</div>
      ${b ? `<div class="ms-track"><i style="width:${Math.min(pct, 100)}%;"></i></div>` : ''}
      <div class="ms-card-line">${line}</div>
      ${s.invested > 0 ? `<div class="ms-card-goods">${t('ms_card_goods').replace('{inv}', money(s.invested))}</div>` : ''}
    </div>`;
}
/* Tarjetas FANTASMA (pedido del usuario 2026-09-09: "sombras imaginarias para
   que el usuario no vea todo en blanco y pueda ver cómo quedaría"). Recién
   instalado solo existe el mes de hoy, vacío, y la pantalla no dejaba entender
   qué va a aparecer ahí. Estas siete sombras usan los nombres REALES de los
   siete meses anteriores y montos de EJEMPLO, escritos con las mismas frases
   que una tarjeta real — pero DESENFOCADAS y desvanecidas (pedido del usuario:
   "ejemplos reales pero que no se vean tan nítidos como reales"), cada vez más
   hacia abajo. Así se entiende de una qué va a decir cada mes, sin que ningún
   número borroso pueda confundirse con plata propia.
   Se dibujan SOLO mientras no haya ni un recibo cargado: con el primero que
   registre el usuario desaparecen todas de golpe (pedido 2026-09-09), para que
   nunca convivan datos de verdad con muestras. */
const MS_GHOST_MONTHS = [
  // % del tope, color y qué tan fuera de foco va cada una. Los porcentajes son
  // variados a propósito: la muestra tiene que dejar ver los tres estados del
  // semáforo, no siete barras iguales.
  {fill:58,  level:'ok',   op:'.62', blur:'1.1px'},
  {fill:86,  level:'warn', op:'.54', blur:'1.5px'},
  {fill:41,  level:'ok',   op:'.46', blur:'1.9px'},
  {fill:104, level:'crit', op:'.38', blur:'2.3px'},
  {fill:67,  level:'ok',   op:'.31', blur:'2.7px'},
  {fill:92,  level:'warn', op:'.25', blur:'3.1px'},
  {fill:35,  level:'ok',   op:'.20', blur:'3.5px'}
];
// Tope de ejemplo cuando el usuario todavía no puso el suyo: sin un número, la
// frase de la tarjeta no se puede armar. Con presupuesto puesto se usa el real.
const MS_GHOST_BUDGET = 450;
function monthlySpendGhostCard(m, g){
  const bud = budgetForMonth(m) || MS_GHOST_BUDGET;
  const exp = Math.round(bud * g.fill / 100);
  const over = Math.max(exp - bud, 0), left = Math.max(bud - exp, 0);
  const line = over > 0
    ? t('ms_line_over').replace('{exp}', `<b>${money(exp)}</b>`).replace('{bud}', money(bud)).replace('{over}', `<b>${money(over)}</b>`)
    : t('ms_line_past').replace('{exp}', `<b>${money(exp)}</b>`).replace('{bud}', money(bud)).replace('{left}', `<b>${money(left)}</b>`);
  return `
    <div class="ms-card ghost ${g.level}" aria-hidden="true" style="opacity:${g.op};filter:blur(${g.blur});">
      <div class="ms-card-head">
        <span class="ms-card-month">${escapeHtml(monthLabel(m, uiLang))}</span>
        <span class="ms-card-amount">${money(exp)}</span>
      </div>
      <div class="ms-track"><i style="width:${Math.min(g.fill,100)}%;"></i></div>
      <div class="ms-card-line">${line}</div>
      <div class="ms-card-goods">${t('ms_card_goods').replace('{inv}', money(Math.round(exp*1.3)))}</div>
    </div>`;
}
function monthlySpendModal(){
  const currentMonthKey = localMonthStr();
  const months = allMonths();
  // El mes actual siempre está, aunque todavía no tenga recibos.
  if(!months.includes(currentMonthKey)) months.unshift(currentMonthKey);

  return `
  <div class="overlay" id="monthly-spend-overlay">
    <div class="modal wide">
      <h3 class="navy">${t('ms_title')}</h3>
      <div class="sub">${t('ms_sub')}</div>
      ${months.length===0 ? `
        <div class="helper-note" style="margin:0 0 16px;">${t('ms_no_purchases')}</div>
      ` : `
        ${/* Del mes de hoy hacia atrás: lo primero que se ve es cómo vas ahora. */''}
        <div class="ms-months">
          ${months.map(m=>monthlySpendCard(m, currentMonthKey)).join('')}
          ${receipts.length===0 ? `
            <div class="ms-ghost-note">${t('ms_ghost_note')}</div>
            ${MS_GHOST_MONTHS.map((g,i)=>monthlySpendGhostCard(shiftMonthStr(currentMonthKey, -(i+1)), g)).join('')}
          ` : ''}
        </div>
      `}
      <div class="modal-actions">
        <button class="btn btn-ghost" id="btn-close-monthly-spend" style="flex:1;">${t('btn_close')}</button>
        ${/* Cruce con el Cierre de mes (auditoría 2026-09-07): antes solo se
             llegaba desde el calendario de Recibos. */''}
        <button class="btn btn-primary" id="btn-monthly-open-recap" style="flex:1;">${t('budget_open_recap')}</button>
      </div>
    </div>
  </div>`;
}

// Encabezado chico reusado por cada tarjeta de esta pantalla — mismo círculo de
// color + ícono que usa el resto de la app, para que "Configuración"
// se sienta parte de la misma familia visual que el resto de la app (categorías con
// sus burbujas de color, el dashboard con sus íconos por tarjeta) en vez de ser la
// única pantalla que todavía es puro texto plano apilado.
/* ================= TEMAS DE COLOR =================
   10 temas elegibles en Ajustes (pedido 2026-09-06). El CSS real vive en
   dusty.css (bloques html[data-dusty-theme]); acá solo la lista para pintar
   los circulitos del selector (bg + acento de muestra) y validar lo guardado.
   Preferencia del DISPOSITIVO (localStorage, como la vista del inventario) —
   no viaja por sync. index.html re-aplica el atributo al abrir, sin parpadeo. */
const DUSTY_THEMES = [
  // Orden (pedido del usuario 2026-09-08): primero los OSCUROS, después los
  // CLAROS. Bosque, Uva, Rosa y Dorado se quitaron a pedido el 2026-09-08, y
  // Store noche, Claro, Menta, Robin y Cupertino el 2026-09-11 (sus bloques de
  // CSS también). Un dispositivo que tenga guardado uno de ellos NO cae a Noche:
  // ver TEMAS_RETIRADOS abajo.
  {id:'night',          es:'Noche',       en:'Night',     bg:'#0f1115', accent:'#ff6b35'},
  {id:'oceano',         es:'Océano',      en:'Ocean',     bg:'#0d1220', accent:'#4da3ff'},
  {id:'medianoche',     es:'Medianoche',  en:'Midnight',  bg:'#000000', accent:'#22d3ee'},
  // Paletas de referencia del usuario (2026-09-06) — oscuras:
  {id:'esmeralda',      es:'Esmeralda',   en:'Emerald',   bg:'#0C3B2E', accent:'#FFBA00'},
  {id:'indigo',         es:'Índigo',      en:'Indigo',    bg:'#2a2645', accent:'#F0C38E'},
  {id:'rubi',           es:'Rubí',        en:'Ruby',      bg:'#181B24', accent:'#CC324C'},
  {id:'zafiro',         es:'Zafiro',      en:'Sapphire',  bg:'#232e4a', accent:'#73B7F1'},
  // Dos colores y nada mas (pedido del usuario 2026-09-11).
  {id:'abeja',          es:'Abeja',       en:'Bee',       bg:'#000000', accent:'#FFD400'},
  // — y claros:
  {id:'crema',          es:'Crema',       en:'Cream',     bg:'#f6f1e7', accent:'#c65b2e'},
  {id:'pastel',         es:'Pastel',      en:'Pastel',    bg:'#e7f8ff', accent:'#87AEEE'},
  {id:'electrico',      es:'Eléctrico',   en:'Electric',  bg:'#f7f2ff', accent:'#752FFF'},
  {id:'coral',          es:'Coral',       en:'Coral',     bg:'#fdf7e8', accent:'#FF5844'},
  {id:'miel',           es:'Miel',        en:'Honey',     bg:'#FCF1DA', accent:'#E38C4C'},
  // "App Store" (pedido por captura 2026-09-08): tarjetas del Dashboard con los
  // degradados pastel de la pestaña Buscar del App Store, en claro.
  {id:'appstore',       es:'App Store',   en:'App Store', bg:'#ffffff', accent:'#71a3e9'},
];
/* TEMAS RETIRADOS -> AL MAS PARECIDO QUE QUEDA (2026-09-11).
   Caer a Noche estaba bien para los cuatro que se quitaron el 2026-09-08, que
   eran oscuros: el usuario ni lo notaba. Pero cuatro de los cinco de ahora son
   CLAROS, y uno de ellos (Cupertino) era el que el propio duenio tenia puesto:
   abrir la app y encontrarla en NEGRO no es una limpieza, es un susto.
   Cada uno va al vecino que de verdad se le parece:
     cupertino  -> appstore   mismo iOS, blanco y azul
     robin      -> appstore   los dos sobre blanco puro
     claro      -> crema      el otro claro de acento naranja
     menta      -> pastel     no queda ningun claro verde; pastel es el otro palido frio
     appstore-noche -> oceano  oscuro de acento azul, que era su sello
   Se reescribe la preferencia guardada, asi que la conversion pasa UNA vez y el
   dispositivo queda con un tema de verdad, no con uno fantasma. */
const TEMAS_RETIRADOS = {cupertino:'appstore', robin:'appstore', claro:'crema', menta:'pastel', 'appstore-noche':'oceano'};
// Por defecto para una instalación nueva (nada guardado todavía, incluida la
// introducción antes de elegir idioma) — pedido del usuario 2026-09-11: "más
// claro y representa más". Mismo cambio en el script de index.html (ANTES del
// primer pintado, ver el comentario ahí) — si se toca uno, tocar el otro. Quien
// ya tenía Noche guardado de antes lo conserva: la rama de abajo lo reescribe.
let dustyTheme = 'appstore';
try{
  const v = localStorage.getItem('patron_theme');
  if(DUSTY_THEMES.some(x=>x.id===v)) dustyTheme = v;
  else if(v && TEMAS_RETIRADOS[v]){
    dustyTheme = TEMAS_RETIRADOS[v];
    document.documentElement.setAttribute('data-dusty-theme', dustyTheme);
    localStorage.setItem('patron_theme', dustyTheme);
  }
  // Cualquier otro guardado que ya no existe (ni siquiera como retirado): se
  // limpia el atributo que puso index.html y la preferencia, para que quede en
  // Noche de verdad — dustyTheme tiene que decir lo mismo que el atributo (o
  // Ajustes mostraría "App Store" resaltado sobre una pantalla oscura).
  else if(v && v!=='night'){ document.documentElement.removeAttribute('data-dusty-theme'); localStorage.removeItem('patron_theme'); dustyTheme = 'night'; }
}catch(e){}
/* Cambiar de tema: se aplica AL INSTANTE con el atributo en <html> (el CSS hace
   el resto) y queda guardado en el dispositivo. Es la única puerta: la usan el
   selector de Ajustes (app-11) y la elección Claro/Oscuro de la introducción
   (startOnboarding en app-06), así los dos hacen exactamente lo mismo. Noche es
   el tema base (:root), por eso va SIN atributo. SIEMPRE guarda, aunque sea el
   tema que ya estaba puesto: una elección explícita (p. ej. "Claro" en la
   introducción, cuando App Store ya era el default) tiene que quedar escrita,
   o se perdería el día que cambie el default. Devuelve true si cambió algo
   visible (para que Ajustes sepa si vale redibujar). */
function setDustyTheme(id){
  if(!DUSTY_THEMES.some(x=>x.id===id)) return false;
  const cambio = dustyTheme !== id;
  dustyTheme = id;
  if(id==='night') document.documentElement.removeAttribute('data-dusty-theme');
  else document.documentElement.setAttribute('data-dusty-theme', id);
  try{ localStorage.setItem('patron_theme', id); }catch(e){}
  return cambio;
}
/* LATIDOS de aviso (pedido del usuario 2026-09-07): un interruptor en Ajustes apaga
   o prende las palpitaciones de Inventario (conteo pendiente, stock crítico, días
   del calendario) y de Presupuesto (barra, tarjeta de alerta, punto del Dashboard).
   Preferencia del dispositivo; el CSS lee html[data-dusty-pulse="off"]. */
/* TAMAÑO DE LETRA (pedido del usuario 2026-09-11: "personas con visión no tan
   sana"): un deslizador en Ajustes, de 90% a 140%, que escala TODA la app con
   zoom en <html> — como el "tamaño de pantalla" del teléfono: letras, botones y
   espacios crecen juntos y el diseño se acomoda solo como en un teléfono más
   angosto. Preferencia del dispositivo (index.html la aplica antes del primer
   pintado para que no salte). */
let dustyFontScale = 100;
try{ const v = parseInt(localStorage.getItem('patron_font_scale')||'100', 10); if(v>=90 && v<=140) dustyFontScale = v; }catch(e){}
function applyFontScale(){
  // SOLO las letras (pedido del usuario 2026-09-11): antes era zoom en <html>,
  // que agrandaba todo — íconos, márgenes, tarjetas — y además desfasaba las
  // medidas en px del carrusel. Ahora es el factor --fs: TODOS los font-size de
  // la app son calc(Npx * var(--fs)) (dusty.css y los templates), así crece el
  // texto y nada más. Al 100% se quita la variable y calc() cae en 1.
  const root = document.documentElement;
  root.style.zoom = '';
  if(dustyFontScale===100) root.style.removeProperty('--fs');
  else root.style.setProperty('--fs', String(dustyFontScale/100));
}
applyFontScale();
let dustyPulse = true;
try{ if(localStorage.getItem('patron_pulse')==='off') dustyPulse = false; }catch(e){}
function applyPulsePref(){
  if(dustyPulse) document.documentElement.removeAttribute('data-dusty-pulse');
  else document.documentElement.setAttribute('data-dusty-pulse', 'off');
}
applyPulsePref();
// (El selector de tema vive dentro de la tarjeta Apariencia de alertSettingsModal
// desde la reorganización de Ajustes del 2026-09-07.)
function settingsCardHeader(icon, bg, fg, title){
  return `
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
    <span style="flex-shrink:0;width:32px;height:32px;border-radius:50%;background:${bg};color:${fg};display:flex;align-items:center;justify-content:center;">${lineIcon(icon,16)}</span>
    <label style="font-size:calc(13px * var(--fs, 1));font-weight:700;color:var(--ink);">${title}</label>
  </div>`;
}
function alertSettingsModal(){
  /* AJUSTES reorganizado (auditoría 2026-09-07): título propio (antes decía
     "Alertas de precio", el nombre de lo que era esta pantalla antes de crecer),
     cuatro secciones con nombre en orden de uso — Apariencia, Inventario,
     Alertas, Cuenta — y UNA sola regla de guardado: todo se aplica al
     instante (los umbrales al soltar el campo, como ya lo hacían tema, idioma,
     latidos y formato). Sin Guardar ni Cancelar: un Cerrar abajo y la ✕ arriba. */
  return `
  <div class="overlay" id="alert-settings-overlay">
    <div class="modal">
      <button type="button" class="modal-close-btn" id="btn-close-alert-settings" aria-label="${t('btn_close')}">✕</button>
      <h3 class="saffron">${t('settings_title')}</h3>
      <div class="sub">${t('settings_sub')}</div>

      ${/* 0. TU NEGOCIO (modo Servicios, app-15): vende / fabrica / presta servicios. */''}
      ${svcSettingsBizCard()}
      ${/* Servicios (app-15): cobros vencidos, aviso de mantenimiento, lista de servicios. */''}
      ${svcSettingsServicesCard()}

      ${/* 1. APARIENCIA: tema, latidos, idioma y formato de montos — lo que un
           usuario nuevo busca primero. Todo instantáneo y guardado en el dispositivo. */''}
      <div class="settings-card">
        ${settingsCardHeader('tag','var(--navy-wash)','var(--navy)',t('settings_appearance_title'))}
        <div style="font-size:calc(12.5px * var(--fs, 1));font-weight:700;color:var(--ink-soft);margin-bottom:8px;">${t('theme_title')}</div>
        <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px 6px;">
          ${DUSTY_THEMES.map(th=>`
          <button type="button" data-set-theme="${th.id}" aria-pressed="${dustyTheme===th.id}" title="${uiLang==='en'?th.en:th.es}" style="background:none;border:none;padding:0;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:5px;min-width:0;">
            <span style="width:38px;height:38px;border-radius:50%;background:${th.bg};border:2.5px solid ${dustyTheme===th.id?'var(--navy)':'var(--line)'};display:flex;align-items:center;justify-content:center;box-shadow:var(--shadow-sm);">
              <span style="width:16px;height:16px;border-radius:50%;background:${th.accent};"></span>
            </span>
            <span style="font-size:calc(10px * var(--fs, 1));font-weight:700;color:${dustyTheme===th.id?'var(--navy)':'var(--ink-soft)'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;">${uiLang==='en'?th.en:th.es}</span>
          </button>`).join('')}
        </div>
        ${/* Interruptor de LATIDOS (pedido del usuario 2026-09-07). */''}
        <div class="pulse-row">
          <div class="pulse-text"><b>${t('pulse_label')}</b><small>${t('pulse_helper')}</small></div>
          <span class="pulse-state">${dustyPulse ? t('pulse_on') : t('pulse_off')}</span>
          <label class="pulse-switch" aria-label="${t('pulse_label')}">
            <input type="checkbox" id="pulse-toggle" ${dustyPulse?'checked':''}>
            <i></i>
          </label>
        </div>
        ${/* Deslizador de TAMAÑO DE LETRA (pedido del usuario 2026-09-11). Se ve
             en vivo mientras se arrastra; el % y el "Aa" acompañan. */''}
        <div class="font-row">
          <div class="pulse-text"><b>${t('font_size_label')}</b><small>${t('font_size_helper')}</small></div>
          <div class="font-ctrl">
            <span class="font-a small" aria-hidden="true">A</span>
            <input type="range" id="font-scale" class="font-slider" min="90" max="140" step="1" value="${dustyFontScale}" aria-label="${t('font_size_label')}">
            <span class="font-a big" aria-hidden="true">A</span>
          </div>
          <div class="font-foot">
            <span class="font-val" id="font-scale-val">${dustyFontScale}%</span>
            <button type="button" class="link-btn" id="font-scale-reset" ${dustyFontScale===100?'disabled':''}>${t('font_size_reset')}</button>
          </div>
        </div>
        ${/* (La fila "Fabrico mis productos" se mudó a la tarjeta Tu negocio, arriba.) */''}
        <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--line);">
          ${/* El rótulo del idioma va en el idioma ACTUAL (pedido del usuario 2026-09-07). */''}
          <button class="btn btn-ghost btn-sm" id="btn-lang-toggle" style="width:100%;">${uiLang==='es'?'🌐 Cambiar a inglés':'🌐 Switch to Spanish'}</button>
          <div class="field" style="margin:12px 0 0;">
            <label for="money-format-select">${t('money_format_label')}</label>
            <select id="money-format-select">
              ${[['plain','$1000.00'],['us','$1,000.00'],['latam','$1.000,00']].map(([v,l])=>`<option value="${v}" ${moneyFormatPref===v?'selected':''}>${l}</option>`).join('')}
            </select>
          </div>
          <div class="helper-note" style="margin:10px 0 0;">${t('settings_device_note')}</div>
        </div>
      </div>

      ${sellsProducts() ? `
      ${/* 2. INVENTARIO: categorías y conteo cíclico (configuración, no acciones del día). */''}
      <div class="settings-card">
        ${settingsCardHeader('box','var(--navy-wash)','var(--navy)',t('settings_inventory_title'))}
        <div style="display:flex;flex-direction:column;gap:8px;">
          <button class="btn btn-ghost btn-sm" id="btn-manage-categories">${t('btn_manage_categories')}</button>
          <button class="btn btn-ghost btn-sm" id="btn-cycle-count" style="position:relative;">
            ${t('cc_btn')}${isCycleCountDue()?'<span class="cc-due-dot"></span>':''}
          </button>
        </div>
      </div>` : ''}

      ${/* 3. ALERTAS: umbral de precio al escanear + aviso de presupuesto. Se
           guardan al soltar el campo (onchange en app-07). */''}
      <div class="settings-card">
        ${settingsCardHeader('bell','var(--saffron-soft)','var(--saffron-ink)',t('settings_alerts_title'))}
        <div class="field">
          <label>${t('alert_threshold_label')}</label>
          <input id="alert-threshold-input" type="number" min="1" max="100" step="1" inputmode="numeric" value="${escapeHtml(priceAlertThreshold)}">
        </div>
        <div class="helper-note">${t('alert_helper')}</div>
        <div class="field" style="margin-top:6px;">
          <label>${t('budget_alert_pct_label')}</label>
          <input id="budget-alert-input" type="number" min="10" max="99" step="5" inputmode="numeric" value="${escapeHtml(budgetMeta.alertPct)}">
        </div>
        <div class="helper-note" style="margin-bottom:0;">${t('budget_alert_pct_helper')}</div>
      </div>

      ${/* 3b. ASISTENTE (app-16): prender/apagar y voz. */''}
      ${agentSettingsCard()}

      ${/* 4. CUENTA: submodal con respaldo, compartir cuenta, cerrar sesión,
           eliminar y privacidad — vuelve acá al cerrarse. */''}
      <div class="settings-card">
        ${settingsCardHeader('cloud','var(--sky-soft)','var(--sky-ink)',t('settings_account_title'))}
        <button class="btn btn-ghost btn-sm" id="btn-open-account" style="width:100%;">${t('account_btn')}</button>
        ${/* Ayuda vive acá desde el Dashboard reorganizado (2026-09-07): el "?"
             salió de la cabecera. Mismo id de siempre — abre la hoja de ayuda. */''}
        <button class="btn btn-ghost btn-sm" id="btn-feedback" style="width:100%;margin-top:8px;">${t('settings_help_btn')}</button>
      </div>

      <div class="modal-actions">
        <button class="btn btn-primary" id="btn-cancel-alert-settings" style="width:100%;">${t('btn_close')}</button>
      </div>
    </div>
  </div>`;
}
/* "Cuenta": submodal de Ajustes (respaldo, compartir, cerrar sesión, eliminar,
   privacidad). Cerrar vuelve a Ajustes (settingsReturnPending). */
let showAccountModal = false;
function closeAccountModal(){ showAccountModal=false; reopenSettingsIfPending(); render(); }
function accountModal(){
  return `
  <div class="overlay" id="account-overlay">
    <div class="modal">
      ${/* Sin ✕ (pedido del usuario): el modal es corto, el botón Cerrar del
           pie está siempre a la vista y el fondo también cierra. */''}
      <h3 class="sky">${t('account_title')}</h3>

      <div class="settings-card">
        ${settingsCardHeader('cloud','var(--sky-soft)','var(--sky-ink)',t('backup_section_title'))}
        <div style="display:flex;flex-direction:column;gap:8px;">
          <button class="btn btn-ghost btn-sm" id="btn-export-data">${t('btn_export_data')}</button>
          <button class="btn btn-ghost btn-sm" id="btn-import-data">${t('btn_import_data')}</button>
        </div>
        <input type="file" id="import-file-input" accept="application/json" style="display:none;">
        <div class="helper-note" style="margin-top:10px;margin-bottom:0;">${t('backup_section_hint')}</div>
      </div>

      ${/* Compartir cuenta (equipo) vive TAMBIÉN acá (auditoría de Ajustes
           2026-09-07): es una acción de Cuenta como cerrar sesión o eliminar;
           el botón del menú del Dashboard sigue. Mismo flujo (app-07). */''}
      <div class="settings-card">
        <button class="btn btn-ghost btn-sm" id="btn-share-account-settings" style="width:100%;">${t('share_account_btn')}</button>
        ${/* Cerrar sesión vive acá (se mudó del modal de equipo 2026-09-04):
             compartir la cuenta y salir de ella son cosas distintas. */''}
        ${currentUser && !currentUser.isAnonymous ? `
        <button class="btn btn-ghost btn-sm" id="btn-sign-out-account" style="width:100%;margin-top:8px;">${t('team_sign_out_btn')}</button>
        ` : ''}
      </div>
      ${currentUser ? `
      <div class="settings-card" style="background:var(--tomato-soft);">
        <button class="btn btn-ghost btn-sm" id="btn-open-delete-account" style="color:var(--tomato);border-color:color-mix(in srgb, var(--tomato) 35%, var(--panel));">${t('delete_account_btn')}</button>
      </div>
      ` : ''}

      <div style="text-align:center;margin-top:6px;">
        <a href="privacy.html" target="_blank" rel="noopener" style="font-size:calc(12px * var(--fs, 1));color:var(--ink-soft);">${t('privacy_policy_link')}</a>
      </div>

      <div class="modal-actions">
        <button class="btn btn-primary" id="btn-close-account-footer" style="width:100%;">${t('btn_close')}</button>
      </div>
    </div>
  </div>`;
}

/* ================= MODAL: PRESUPUESTO MENSUAL =================
   El lápiz del Dashboard abría Ajustes entero scrolleado al campo; ahora el
   presupuesto tiene su propio mini-modal y salió de Ajustes de raíz (pedido
   del usuario 2026-09-04) — un único lugar para editarlo. Sin autofocus
   (regla de la casa: el teclado lo abre el usuario). */
let showBudgetModal = false;
function openBudgetModal(){ if(!requireWriteAccess()) return; draftMonthlyBudget = monthlyBudget; showBudgetModal = true; render(); }
function closeBudgetModal(){ showBudgetModal = false; render(); }
function budgetModal(){
  /* Placeholder inteligente: si nunca definió presupuesto pero YA hay gasto
     registrado, se le sugiere su propio gasto reciente redondeado hacia
     arriba — un número real de SU negocio en vez de un "Ej. 2000" inventado.
     Es placeholder (no value) a propósito: prellenar el input guardaría un
     presupuesto que nunca eligió con solo tocar "Guardar". */
  let ph = t('budget_placeholder');
  const noBudget = draftMonthlyBudget===null || draftMonthlyBudget===undefined || draftMonthlyBudget==='';
  if(noBudget){
    // Solo GASTOS OPERATIVOS (auditoría 2026-09-07): el presupuesto mide eso;
    // sumar la mercadería sugería un número inflado por las compras.
    const prev = spendSplitForMonth(shiftMonthStr(localMonthStr(), -1)).expense;
    const curr = spendSplitForMonth(localMonthStr()).expense;
    const base = prev>0 ? prev : curr;
    if(base>0){
      const sugerido = Math.ceil(base/50)*50;
      ph = t('budget_placeholder_suggested').replace('{n}', sugerido).replace('{s}', money(base));
    }
  }
  /* Interactivo (pedido del usuario 2026-09-11): arriba la MISMA tarjeta del
     Dashboard (verde/ámbar/rojo) que cambia en vivo mientras se escribe el
     monto (ver el oninput en app-09), atajos con los números del propio
     negocio, el arrastre como interruptor, y lo raro (objetivo costo/ventas)
     plegado en "Más opciones". */
  const canEdit = canSeeFinancials();
  const prevExp = spendSplitForMonth(shiftMonthStr(localMonthStr(), -1)).expense;
  const avg3 = (()=>{ let s=0, n=0; for(let i=1;i<=3;i++){ const e=spendSplitForMonth(shiftMonthStr(localMonthStr(), -i)).expense; if(e>0){ s+=e; n++; } } return n ? s/n : 0; })();
  const draftNum = parseFloat(draftMonthlyBudget);
  const p0 = budgetPacePreview(Number.isFinite(draftNum) ? draftNum : NaN, !!budgetMeta.rollover);
  return `
  <div class="overlay" id="budget-overlay">
    <div class="modal budget-modal">
      <button type="button" class="modal-close-btn" id="btn-close-budget" aria-label="${t('btn_cancel')}">✕</button>
      <h3 class="basil">${t('budget_title')}</h3>
      ${budgetTileHtml(p0)}
      <div class="settings-card">
      <div class="field" style="margin-top:0;">
        <label>${t('budget_label')}</label>
        <input id="budget-input" type="number" min="0" step="0.01" inputmode="decimal" placeholder="${escapeHtml(ph)}" value="${draftMonthlyBudget!==null && draftMonthlyBudget!==undefined ? draftMonthlyBudget : ''}" ${canEdit?'':'disabled'}>
      </div>
      ${canEdit ? `
      <div class="budget-quick">
        <button type="button" data-budget-delta="-100">−100</button>
        <button type="button" data-budget-delta="100">+100</button>
        ${prevExp>0 ? `<button type="button" class="suggest" data-budget-set="${Math.ceil(prevExp/50)*50}">${t('budget_quick_prev').replace('{amount}', money(prevExp))}</button>` : ''}
        ${avg3>0 && Math.abs(avg3-prevExp)>1 ? `<button type="button" class="suggest" data-budget-set="${Math.ceil(avg3/50)*50}">${t('budget_quick_avg').replace('{amount}', money(avg3))}</button>` : ''}
      </div>
      <div class="helper-note">${t('budget_amount_hint')}</div>` : ''}
      ${canEdit
        ? `<div class="helper-note">${t('budget_helper')}${Object.keys(budgetMeta.byMonth).some(k=>k<localMonthStr() && budgetMeta.byMonth[k]!==monthlyBudget) ? ' '+t('budget_history_note') : ''}</div>`
        : `<div class="helper-note" style="color:var(--saffron-ink);">${t('budget_locked_note')}</div>`}
      ${canEdit ? `
      <label class="budget-switch-row">
        <span class="txt"><b>${t('budget_rollover_label')}</b><small>${t('budget_rollover_helper')}</small></span>
        <span class="pulse-switch"><input type="checkbox" id="budget-rollover-input" ${budgetMeta.rollover?'checked':''}><i></i></span>
      </label>
      <details class="budget-more">
        <summary>${t('budget_more_options')}</summary>
        <div class="field">
          <label for="cogs-target-input">${t('budget_cogs_label')}</label>
          <input id="cogs-target-input" type="number" min="1" max="99" step="1" inputmode="numeric" placeholder="30" value="${budgetMeta.cogsTargetPct!==null ? escapeHtml(budgetMeta.cogsTargetPct) : ''}">
        </div>
        <div class="helper-note">${t('budget_cogs_helper')}</div>
      </details>` : ''}
      </div>
      ${(()=>{
        /* LA CASA de los ítems de gasto (pedido del usuario 2026-09-05): agua,
           luz, Eat out y demás salieron del inventario (no son mercadería) y
           viven acá, junto al presupuesto que consumen — agrupados por su
           categoría, con su último monto, y tocables (abren la ficha de
           siempre para renombrar/corregir/borrar).
           SIEMPRE visible: sin gastos todavía, muestra filas de EJEMPLO
           (visuales, no datos — nada que sincronizar ni que borrar después)
           para que se vea cómo queda, más el botón de agregar el primero. */
        const exp = inventory.filter(isExpenseItem);
        const spent = spendSplitForMonth(localMonthStr()).expense;
        // paidThisMonth: ¿ya se registró el pago de este bill en el mes? Cuenta el
        // pago manual (recibo manual con el nombre del bill) Y la boleta escaneada
        // (recibo con una línea aplicada a este ítem — el supplier ahí es la
        // empresa, ej. "CFE", no el nombre del bill) — sin la segunda pata, un
        // bill recién escaneado mostraba el ＋ y tocarlo duplicaba el gasto.
        // Por id del bill desde 2026-09-07 (renombrarlo ya no lo "despaga"), ver billPaidInMonth.
        const paidThisMonth = (id,name)=>{ const it = inventory.find(i=>i.id===id); return it ? billPaidInMonth(it, localMonthStr()) : false; };
        const row = (id,name,amount,muted)=>`
          <div ${id?`data-open-item="${id}" role="button" tabindex="0"`:''} style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 2px;border-bottom:1px solid var(--line);${id?'cursor:pointer;':'opacity:.55;'}">
            <span style="font-size:calc(13px * var(--fs, 1));color:var(--ink);min-width:0;overflow-wrap:anywhere;">${escapeHtml(name)}${muted?` <span style="font-size:calc(10px * var(--fs, 1));font-weight:700;color:var(--ink-soft);background:var(--inset);border-radius:6px;padding:1px 6px;">${t('budget_exp_example_tag')}</span>`:''}</span>
            <span style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
              <strong style="font-size:calc(13px * var(--fs, 1));font-variant-numeric:tabular-nums;">${amount}</strong>
              ${/* Botón de PAGO por fila (reporte del usuario 2026-09-05: "la
                   barra no se mueve"): los bills creados como puro catálogo no
                   tenían cómo registrar el pago del mes — este ＋ lo crea al
                   toque (recibo manual) y la barra reacciona ya. Verde ✓ si
                   este mes ya se pagó. */''}
              ${id?(paidThisMonth(id,name)
                ? `<span title="${t('expense_paid_tag')}" style="width:26px;height:26px;border-radius:50%;background:var(--basil-soft);color:var(--basil-ink);display:inline-flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;flex-shrink:0;">✓</span>`
                : `<button type="button" class="dash-pencil-btn" data-pay-bill="${id}" title="${t('expense_pay_btn')}" aria-label="${t('expense_pay_btn')}" style="color:var(--basil);border-color:color-mix(in srgb, var(--basil) 35%, var(--panel));font-weight:800;">＋</button>`):''}
              ${id?`<span style="color:var(--ink-soft);font-size:calc(12px * var(--fs, 1));">›</span>`:''}
            </span>
          </div>`;
        let body='';
        if(exp.length>0){
          const groups = {};
          exp.forEach(i=>{
            // Agrupa por la categoría de GASTO (lista aparte del inventario);
            // ítems viejos sin expenseCategoryId caen al grupo genérico.
            const cat = expenseCategories.find(c=>c.id===i.expenseCategoryId);
            const name = cat ? cat.name : t('budget_exp_uncat');
            (groups[name] = groups[name] || []).push(i);
          });
          body = Object.keys(groups).sort().map(g=>`
            <div class="category-group-header" style="margin-top:8px;">${escapeHtml(g)} <span>${groups[g].length}</span></div>
            ${groups[g].map(i=>row(i.id, i.name, money(i.costPerUnit||0))).join('')}
          `).join('') + `<div class="helper-note" style="margin:10px 0 0;">${t('budget_exp_note')}</div>`;
        } else {
          body = `
            <div class="category-group-header" style="margin-top:8px;">${escapeHtml(t('budget_exp_uncat'))}</div>
            ${row(null, uiLang==='en'?'Electricity':'Luz', money(85), true)}
            ${row(null, uiLang==='en'?'Water':'Agua', money(30), true)}
            ${row(null, 'Internet', money(45), true)}
            <div class="category-group-header" style="margin-top:8px;">Eat out</div>
            ${row(null, uiLang==='en'?'Coffee':'Café', money(6), true)}
            <div class="helper-note" style="margin:10px 0 0;">${t('budget_exp_empty_note')}</div>`;
        }
        return `
      <div class="settings-card" style="margin-top:14px;">
        ${settingsCardHeader('chart','var(--saffron-soft)','var(--saffron-ink)',t('budget_exp_title'))}
        ${/* Los botones de alta PRIMERO, bajo el título (pedido del usuario
             2026-09-08: "vamos a subirlo de primero"): la foto de la boleta se
             toma con el ESCÁNER DE RECIBOS de siempre — la IA detecta el
             servicio y lo trae acá solo, la foto queda en el recibo — y
             "+ Servicio" crea una cuenta recurrente a mano (antes decía
             "+ A mano" y se confundía con el "+ Gasto" del Dashboard). */''}
        <div style="display:flex;gap:8px;margin:0 0 12px;">
          <button type="button" class="btn btn-primary btn-sm" id="btn-scan-bill" style="flex:1.2;">${t('budget_exp_scan_btn')}</button>
          <button type="button" class="btn btn-ghost btn-sm" id="btn-add-expense-item" style="flex:1;">${t('budget_exp_add_btn')}</button>
        </div>
        ${/* Mismo resumen que el tablero (barra con marca de ritmo + "Gastos X de
             Y · Quedan Z") y el gasto real del mes por categoría con mini-barras
             (auditoría 2026-09-07). Sin presupuesto, la línea de siempre. */''}
        ${(()=>{
          const p = budgetPace(localMonthStr());
          if(p) return `<div class="budget-modal-summary">${budgetBarHtml(p)}${budgetSummaryHtml(p)}</div>`;
          return spent>0 ? `<div class="helper-note" style="margin:0 0 8px;">${t('budget_spent_line').replace('{amount}', money(spent))}</div>` : '';
        })()}
        ${(()=>{
          const cats = expenseByCategoryForMonth(localMonthStr());
          if(cats.length===0) return '';
          const max = cats[0].amount||1;
          // Con tope: la barra mide contra el tope y se pinta por estado; sin tope,
          // contra la categoría más grande (solo proporción).
          return `<div class="bycat"><div class="bycat-title">${t('budget_bycat_title')}</div>${cats.map((c,i)=>{
            const pct = c.cap ? c.amount/c.cap*100 : c.amount/max*100;
            const st = c.cap ? (pct>=100 ? 'crit' : pct>=(budgetMeta.alertPct||80) ? 'warn' : 'ok') : '';
            return `
            <div class="bycat-row" style="animation-delay:${i*50}ms;"><span class="bycat-name">${escapeHtml(c.name)}</span><span class="bycat-bar ${st}"><i style="width:${Math.min(100, Math.max(4, pct)).toFixed(0)}%;"></i></span><span class="bycat-amt">${money(c.amount)}${c.cap ? `<small>${t('budget_cap_of').replace('{cap}', money(c.cap))}</small>` : ''}</span></div>`;
          }).join('')}</div>`;
        })()}
        ${/* Topes por categoría (opcional, solo quien ve finanzas). */''}
        ${(canSeeFinancials() && expenseCategories.length>0) ? `
        <details class="budget-caps">
          <summary>${t('budget_caps_title')}${Object.keys(budgetMeta.byCategory).length ? ` <span class="count-badge">${Object.keys(budgetMeta.byCategory).length}</span>` : ''}</summary>
          <div class="helper-note" style="margin:6px 0 8px;">${t('budget_caps_helper')}</div>
          ${expenseCategories.map(c=>`
          <div class="budget-cap-row">
            <label for="cap-${escapeHtml(c.id)}">${escapeHtml(c.name)}</label>
            <input id="cap-${escapeHtml(c.id)}" data-cat-cap="${escapeHtml(c.id)}" type="number" min="0" step="0.01" inputmode="decimal" placeholder="—" value="${budgetMeta.byCategory[c.id]>0 ? escapeHtml(budgetMeta.byCategory[c.id]) : ''}">
          </div>`).join('')}
        </details>` : ''}
        ${/* Sin bills creados pero CON gasto real en el mes, el "Gastado" quedaba
             pegado a las filas de EJEMPLO y parecía que los ejemplos sumaban
             (confusión real del usuario 2026-09-05: "no tengo nada ahí y como
             quiera marca 150%") — se aclara de dónde sale el monto. */''}
        ${spent>0 && exp.length===0 ? `<div class="helper-note" style="margin:0 0 8px;color:var(--saffron-ink);">${t('budget_spent_no_bills_note')}</div>` : ''}
        ${body}
      </div>`;
      })()}
      <button type="button" class="link-btn" id="btn-budget-open-recap" style="width:100%;text-align:center;margin-top:12px;">${t('budget_open_recap')}</button>
      <div class="modal-actions">
        <button class="btn btn-ghost" id="btn-cancel-budget">${t('btn_cancel')}</button>
        <button class="btn btn-primary" id="btn-save-budget">${t('btn_save')}</button>
      </div>
    </div>
  </div>`;
}
