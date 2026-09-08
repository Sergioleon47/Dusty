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

/* ---------- DASHBOARD ---------- */
function scanIconSvg(){
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="48" fill="var(--sky)"/>
    <g transform="translate(23.6,23.6) scale(2.2)" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
      <path d="M5 7h1a2 2 0 0 0 2 -2a1 1 0 0 1 1 -1h6a1 1 0 0 1 1 1a2 2 0 0 0 2 2h1a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-9a2 2 0 0 1 2 -2"/>
      <circle cx="12" cy="13" r="3"/>
    </g>
  </svg>`;
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
  return inventory.filter(i=>!isExpenseItem(i)).map(i=>{
    const hasHistory = (i.qtyOnHand||0)>0 || purchasesForIng(i.id).length>0;
    const target = i.stockFullRef || i.stockTarget || Math.max(Math.round((i.qtyOnHand||0)*1.5), 10);
    const pct = target>0 ? Math.min(100, Math.round(((i.qtyOnHand||0)/target)*100)) : 0;
    return {ing:i, target, pct, status: hasHistory ? stockStatus(pct) : 'none'};
  });
}

/* Esta tarjeta vive en el Dashboard. Sus filas usan .stock-row-static, igual que las
   de Inventario — ninguna de las dos tiene gesto de deslizar propio, porque esta
   pantalla es donde MÁS se usa el gesto de deslizar para cambiar de pestaña
   (attachViewSwipeHandlers) y la tarjeta ocupa casi toda la pantalla: con un gesto de
   arrastre por fila activo ahí, el dedo casi siempre caía sobre una fila y competía
   con el cambio de pestaña. Borrar un producto se hace con la x chica de cada fila
   (deleteStockItem), disponible tanto acá como en Inventario. */
/* Anillo (donut) de salud del inventario: de un vistazo, qué porción está OK vs.
   necesita atención — sin tener que leer fila por fila. Solo cuenta productos con
   datos suficientes para juzgarlos (status !=='none', ver stockRowsData) — un
   inventario recién cargado, todavía sin compras registradas, no se ve "crítico"
   por falta de datos. R=15.915 y circunferencia≈100 es el truco clásico de donut en
   SVG (viewBox 0 0 36 36): cada segmento mide su propio % directo en unidades de
   dasharray, sin tener que convertir a grados. */
function stockHealthRing(rows){
  const graded = rows.filter(r=>r.status!=='none');
  const total = graded.length;
  if(total===0) return '';
  const counts = {ok:0, warn:0, crit:0};
  graded.forEach(r=>counts[r.status]++);
  const R = 15.915, CIRC = 2*Math.PI*R;
  let offset = 0;
  const segments = [
    {n:counts.crit, color:'var(--stock-crit)'},
    {n:counts.warn, color:'var(--stock-warn)'},
    {n:counts.ok, color:'var(--stock-ok)'},
  ].filter(s=>s.n>0).map(s=>{
    const len = (s.n/total)*CIRC;
    const circle = `<circle cx="18" cy="18" r="${R}" fill="none" stroke="${s.color}" stroke-width="4" stroke-dasharray="${len.toFixed(2)} ${(CIRC-len).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}"/>`;
    offset += len;
    return circle;
  }).join('');
  const okPct = Math.round((counts.ok/total)*100);
  const ringTitle = uiLang==='en' ? `${okPct}% of your inventory is at a healthy stock level` : `${okPct}% de tu inventario está en un nivel de stock saludable`;
  return `
  <div style="position:relative;width:46px;height:46px;flex-shrink:0;" title="${ringTitle}">
    <svg viewBox="0 0 36 36" style="width:100%;height:100%;transform:rotate(-90deg);">
      <circle cx="18" cy="18" r="${R}" fill="none" stroke="var(--bg)" stroke-width="4"/>
      ${segments}
    </svg>
    <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;font-family:'Space Grotesk';color:var(--ink);">${okPct}%</div>
  </div>`;
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
function stockAnalyticsCard(){
  if(inventory.length===0) return '';
  const allRows = stockRowsData();
  // El anillo de salud y las alertas críticas miran el inventario ENTERO —
  // son la foto de salud del negocio, no dependen de lo listado abajo.
  const criticalCount = allRows.filter(r=>r.status==='crit').length;
  const ccDueIds = cycleCountDueIds();
  /* INVERSIÓN 2026-09-04 (pedido del usuario): el Dashboard lista SOLO los
     productos que toca contar hoy — es la tarea del día, no el catálogo; el
     inventario completo vive entero en su propia pestaña (que ya no se filtra).
     Antes era al revés: el Dashboard mostraba todo e Inventario se filtraba a
     lo pendiente. Sin conteo pendiente, acá queda una nota y los resúmenes. */
  const rows = allRows.filter(r=>ccDueIds.has(r.ing.id));
  // Sin la caja .stock-card alrededor (mismo criterio que en Inventario, pedido
  // del usuario): las tarjetas ya son cajas — todo vive directo sobre el fondo.
  return `
  <div style="margin-top:8px;">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
      <h3 class="stock-card-title" style="margin:0;">${t('stock_status_title')}</h3>
      ${stockHealthRing(allRows)}
    </div>
    ${rows.length===0 ? `<div class="helper-note" style="margin:12px 0 2px;">${t('dash_cc_empty')}</div>` : `
    ${/* Sin banner ni buscador acá (pedido del usuario, captura 2026-09-04): la
         lista pendiente es corta y se explica sola — el buscador vive en
         Inventario, donde están todos los ítems. Tocar una tarjeta abre su
         ficha y desde ahí se cuenta; el botón de conteo sigue en Inventario.
         Mismo lenguaje que Inventario: tarjetas-botón en la grilla del MISMO
         selector de vista compartido (invLayout). Prefijo dashtile- en el
         view-transition-name: los tiles de Inventario ya usan invtile- y
         nombres duplicados en el DOM abortan la transición. */''}
    <div class="inv-toolbar" style="margin:10px 0 14px;">
      ${invLayoutToggleHtml()}
    </div>
    <div class="inv-grid ${invLayout}">
    ${rows.map(r=>`
      <div class="inv-tile ${ccDueIds.has(r.ing.id)?'cc-due-blink':''}" data-key="stockgrid:${r.ing.id}" data-open-item="${r.ing.id}" role="button" tabindex="0" data-ing-id="${r.ing.id}" data-status="${r.status}" title="${escapeHtml(r.ing.name)}" style="view-transition-name:dashtile-${String(r.ing.id).replace(/[^a-zA-Z0-9_-]/g,'')};">
        <div class="inv-tile-top">
          <div class="stock-icon-ring ${r.status!=='ok'?r.status:''}" data-photo-item="${r.ing.id}" style="cursor:pointer;width:56px;height:56px;flex-shrink:0;" title="${t('btn_upload_photo')}">${stockIconSvg(r.ing)}</div>
          <div class="inv-tile-name">${escapeHtml(invShortName(r.ing.name))}</div>
        </div>
        ${r.status==='none' ? `
        <div class="stock-bar-track"></div>
        <div class="stock-caption stock-caption-muted" style="margin:0;">${r.ing.expenseOnly ? t('expense_only_tag') : t('stock_no_data_caption')}</div>
        ` : `
        <div class="stock-bar-track"><div class="stock-bar-fill ${r.status}" style="width:${Math.max(r.pct,4)}%;"></div></div>
        ${/* Sin la unidad repetida ("16 unit of 16 unit" → "16 of 16", pedido del
             usuario): el texto respira y el espacio ganado fue a la foto. La
             unidad vive en la ficha. */''}
        <div class="stock-caption" style="margin:0;"><strong style="color:var(--stock-${r.status==='ok'?'ok':r.status});">${r.pct}%</strong> · ${escapeHtml(r.ing.qtyOnHand||0)} ${t('stock_of')} ${escapeHtml(r.target)}</div>
        `}
      </div>
    `).join('')}
    </div>
    `}
    <div class="stock-summary">
      <div id="btn-critical-alerts" ${criticalCount>0?'style="cursor:pointer;"':''}>
        <div class="stock-summary-label">${t('stock_critical_alerts')}</div>
        <div class="stock-summary-value">${criticalCount}</div>
      </div>
      <div class="stock-summary-right">
        <div class="stock-summary-label">${t('stock_suggested_order')}</div>
        <button class="btn stock-suggest-btn" id="btn-suggested-order">${t('stock_view_detail')}</button>
      </div>
    </div>
  </div>
  `;
}

function dashboardView(){
  /* DASHBOARD reorganizado (maqueta aprobada por el usuario 2026-09-07, "ármalo
     así mismo"): menos repetido, más "qué hago hoy".
     1. dos botones arriba (Ayuda vive en Ajustes) — ver topbar en app-04;
     2. UN solo bloque de presupuesto: inversión del mes + gastos con barra y
        "quedan" en la misma tarjeta (adiós a la franja repetida de abajo);
     3. fila de herramientas con nombre, como Inventario y Catálogo: Productos ·
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
  const empty = inventory.length===0 && receipts.length===0 && !cloudSyncPending;
  const allRows = inventory.length>0 ? stockRowsData() : [];
  const critRows = allRows.filter(r=>r.status==='crit');
  const ccDueIds = inventory.length>0 ? cycleCountDueIds() : new Set();
  const graded = allRows.filter(r=>r.status!=='none');
  const healthPct = graded.length ? Math.round(graded.filter(r=>r.status==='ok').length/graded.length*100) : null;
  const lastReceipt = receipts.filter(r=>r && !r.manual).sort((a,b)=>String(b.date).localeCompare(String(a.date)))[0] || receipts.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date)))[0] || null;
  const unread = (currentUser || hadCloudSessionBefore()) ? unreadActivityCount() : 0;
  const scanSvg = '<svg viewBox="0 0 24 24" width="30" height="30" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>';
  return `
  ${/* 2. Bloque único de presupuesto (o Primeros pasos el primer día).
       Maqueta "anillo + cuadrícula" (aprobada 2026-09-08): anillo con el %
       gastado + cuatro cifras; la tarjeta toma el color del estado del
       presupuesto en los temas App Store (--tile-ok/warn/crit). */''}
  ${empty ? firstStepsCard() : (()=>{
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
      return `
  <div class="stat-card dash-month dash-budget">
    <div class="dash-budget-head"><span class="stat-label">${t('dash_investment_of')} ${monthLabel(currentMonthKey, uiLang)}</span>${addChip}</div>
    <div class="stat-value" style="color:var(--money-pos);margin-top:4px;">${money(sp.invested)}</div>
    ${canEdit ? `
    <button id="btn-edit-budget" class="budget-set-cta" type="button">
      <span style="font-size:12.5px;color:var(--ink-soft);font-weight:600;">${t('dash_budget_of')}</span>
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
      <div class="dash-kv">
        <div><span>${t('dash_kv_expenses')}</span><b>${money(p.expense)}</b></div>
        <div><span>${t('dash_kv_budget')}</span><b>${money(p.budget)}${pencil}</b></div>
        <div><span>${t('dash_kv_invest')}</span><b class="pos">${money(sp.invested)}</b></div>
        ${p.left>=0
          ? `<div><span>${t('dash_kv_left')}</span><b class="pos">${money(p.left)}</b></div>`
          : `<div><span>${t('dash_kv_over')}</span><b class="neg">${money(-p.left)}</b></div>`}
      </div>
    </div>
    ${budgetNotesHtml(p)}${cogsRatioHtml(currentMonthKey)}
    ${seeAll}
  </div>`;
  })()}
  ${budgetAlertCard()}

  ${/* 3. Herramientas con nombre (mismos ids de siempre: btn-scan-products,
       btn-scan-fab, btn-new-item — attachEvents los encuentra igual). Los
       anillos toman su color de --tool-* (degradés en los temas App Store). */''}
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
  </div>

  ${inventory.length===0 ? (cloudSyncPending ? emptyState('cloud',t('sync_loading_title'),t('sync_loading_sub')) : dashboardEmptyState()) : `
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
    </button>
    ${/* 6. Último recibo (abre su ficha), Producción y Cambios. */''}
    <div class="dash-tile t4 ${lastReceipt?'':'static'}" ${lastReceipt ? `data-view-receipt="${lastReceipt.id}" role="button" tabindex="0"` : ''}>
      <span class="dash-tile-icon" aria-hidden="true">🧾</span>
      <span class="dash-tile-title">${t('dash_last_receipt')}</span>
      <span class="dash-tile-sub">${lastReceipt ? `${escapeHtml(lastReceipt.supplier)||t('no_supplier_name')} · ${money(lastReceipt.total)} · ${escapeHtml(lastReceipt.date||'')}` : t('dash_last_receipt_none')}</span>
      ${lastReceipt ? '<span class="dash-tile-chev">›</span>' : ''}
    </div>
    <button type="button" class="dash-tile t5" id="btn-production-hub">
      <span class="dash-tile-icon" aria-hidden="true">🍳</span>
      <span class="dash-tile-title">${t('prod_section_title')}</span>
      <span class="dash-tile-sub">${t('dash_production_sub')}</span>
      <span class="dash-tile-chev">›</span>
    </button>
    ${(currentUser || hadCloudSessionBefore()) ? `
    <button type="button" class="dash-tile t6" id="btn-inventory-activity">
      <span class="dash-tile-icon" aria-hidden="true">📈</span>
      <span class="dash-tile-title">${t('activity_modal_title')}</span>
      <span class="dash-tile-sub">${unread>0 ? t('dash_activity_n').replace('{n}', unread) : t('dash_activity_none')}</span>
      ${unread>0 ? `<span class="dash-tile-count">${unread>99?'99+':unread}</span>` : '<span class="dash-tile-chev">›</span>'}
    </button>` : ''}
  </div>`}
  ${priceAlertsCard()}
  `;
}

/* INTERCAMBIO 2026-09-04 (pedido del usuario): el menú de acciones del
   inventario (escanear productos, alta manual, producción, conteo, actividad,
   categorías) vive en el DASHBOARD — donde estaban los chips de categoría — y
   los chips se mudaron a la pestaña Inventario, junto a los productos que
   filtran. Los ids no cambian: attachEvents los encuentra igual en cualquier
   pestaña (las tres páginas del carrusel se renderizan siempre). */
function inventoryMenuRow(){
  return `
  <div class="inv-header-actions" style="margin-bottom:16px;">
    ${/* Orden pedido por el usuario 2026-09-04: Escanear primero y en amarillo
         (EL camino recomendado), Alta manual, COMPARTIR CUENTA tercero (abre
         el modal de equipo; sin sesión real, primero login/guardar cuenta),
         Actividad, y Producción DE ÚLTIMO. "Crear categoría" salió de raíz:
         vive en Ajustes → Categorías. Producción sigue acá — sin este botón,
         el hub entero (recetas, producir, historial de salidas) es inalcanzable. */''}
    <button class="btn btn-primary inv-row-btn" id="btn-scan-products">${t('pb_open_btn')}</button>
    <button class="btn btn-ghost inv-row-btn" id="btn-new-item">${t('btn_add_manually')}</button>
    <button class="btn btn-ghost inv-row-btn" id="btn-share-account">${t('share_account_btn')}</button>
    ${(currentUser || hadCloudSessionBefore()) ? `
    <button class="btn btn-ghost inv-row-btn" id="btn-inventory-activity">
      ${t('btn_inventory_activity')}${unreadActivityCount()>0?`<span class="count-badge">${unreadActivityCount()>99?'99+':unreadActivityCount()}</span>`:''}
    </button>
    ` : ''}
    <button class="btn btn-ghost inv-row-btn" id="btn-production-hub">${t('prod_section_title')}</button>
  </div>`;
}
/* Fila de chips de categoría — vive en INVENTARIO (antes en el Dashboard):
   tocar uno filtra la lista a esa categoría (data-open-category en attachEvents
   y el filtro inventoryCategoryFilter). El número es cuántos productos tiene
   esa categoría ahora mismo, no un conteo fijo. Se arrastra para reordenar. */
/* Chips de categoría como FILTRO con "Todos" primero (maqueta 2026-09-07):
   justo sobre la lista, el activo resaltado; "Todos" quita el filtro. El
   Dashboard usa el mismo data-open-category para saltar al Inventario filtrado. */
function categoryChipsRow(){
  const total = inventory.filter(i=>!isExpenseItem(i)).length;
  return `
  <div class="inv-chips">
    <button type="button" class="category-chip ${inventoryCategoryFilter?'':'on'}" data-inv-all="1">${t('inv_all_chip')}<span>${total}</span></button>
    ${categories.map(c=>{
      // Solo mercadería real: las categorías de gasto (Utilities, Eat out)
      // viven en el botón de Presupuesto y acá ni aparecen (chips "0" fuera).
      const count = inventory.filter(i=>i.categoryId===c.id && !isExpenseItem(i)).length;
      if(count===0) return '';
      return `<button type="button" class="category-chip ${inventoryCategoryFilter===c.id?'on':''}" data-open-category="${c.id}" aria-pressed="${inventoryCategoryFilter===c.id}">${escapeHtml(c.name)}<span>${count}</span></button>`;
    }).join('')}
  </div>
  `;
}
/* PRIMEROS PASOS (auditoría de primer minuto 2026-09-07): reemplaza la tarjeta de
   Inversión mientras no hay nada cargado. Tres pasos con el primero YA tildado
   (elegir idioma) — el "efecto de progreso dotado": empezar con ventaja motiva a
   terminar. El paso actual late; el de presupuesto se puede tildar desde acá. */
function firstStepsCard(){
  const budgetDone = !!monthlyBudget;
  const done = 1 + (budgetDone ? 1 : 0);
  const total = 3;
  const step = (cls, id, label, checked)=>`
      <li class="fs-step ${cls}" ${id?`id="${id}" role="button" tabindex="0"`:''}>
        <span class="fs-check" aria-hidden="true">${checked ? '✓' : ''}</span>
        <span class="fs-label">${label}</span>
      </li>`;
  return `
    <div class="stat-card first-steps-card">
      <div class="stat-label">${t('first_steps_title')}</div>
      <div class="fs-progress">
        <div class="fs-track"><div class="fs-fill" style="width:${Math.round(done/total*100)}%;"></div></div>
        <span class="fs-count">${done}/${total}</span>
      </div>
      <ol class="first-steps">
        ${step('done', null, t('first_step_lang'), true)}
        ${step('now', 'fs-scan', t('first_step_scan'), false)}
        ${step(budgetDone ? 'done' : '', 'fs-budget', t('first_step_budget'), budgetDone)}
      </ol>
    </div>`;
}
// Primer día: nada escaneado, nada cargado a mano. Sin esto, el Dashboard quedaba
// con solo la tarjeta de gasto ($0.00) y el botón de escanear — funcional, pero sin
// nada que le explique al usuario qué hacer primero ni por qué está tan vacío.
function dashboardEmptyState(){
  // Ver dashEmptyCardAnimated más arriba: solo anima la primera vez que se dibuja en
  // esta sesión de la app — no en cada redibujado ni cada vez que se vuelve a esta
  // pestaña. El "breathe" del ícono (dash-empty-breathe) SÍ sigue en loop siempre,
  // ese no se toca — es continuo a propósito, no una entrada.
  const animClass = dashEmptyCardAnimated ? ' no-anim' : '';
  dashEmptyCardAnimated = true;
  return `
  <div class="dash-empty-card${animClass}">
    <div class="dash-empty-badge">${lineIcon('box',30)}</div>
    <h3>${t('dash_empty_title')}</h3>
    <p>${t('dash_empty_sub')}</p>
    <div class="dash-empty-actions">
      <button class="btn btn-primary" id="btn-dash-empty-scan">${t('dash_empty_scan_btn')}</button>
      <button class="btn btn-ghost" id="btn-dash-empty-batch">${t('pb_open_btn')}</button>
      <button class="btn btn-ghost" id="btn-dash-empty-manual">${t('dash_empty_manual_btn')}</button>
    </div>
  </div>`;
}

/* ---------- INVENTARIO ---------- */
// Filtro de categoría activado desde los botones del Dashboard — al tocar una
// categoría se guarda su id acá y se cambia a la pestaña Inventario, que lo lee y
// muestra solo esos productos (ver inventarioView). También es preferencia de
// sesión nomás, se resetea solo al recargar.
let inventoryCategoryFilter = null;
/* Vista del inventario elegida por el usuario: 'rows' (una columna, todo más
   grande — accesibilidad para quien no ve bien), 'cols2', 'cols3' o 'cols4'
   (la más densa, pedida el 2026-09-06). Persiste como preferencia del dispositivo. */
let invLayout = 'cols2';
try{ const v = localStorage.getItem('patron_inv_layout'); if(['rows','cols2','cols3','cols4'].includes(v)) invLayout = v; }catch(e){}
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
function invSortRows(rows){
  const arr = rows.slice();
  if(invSort==='stock') arr.sort((a,b)=>(a.ing.qtyOnHand||0)-(b.ing.qtyOnHand||0) || String(a.ing.name).localeCompare(String(b.ing.name)));
  else if(invSort==='value') arr.sort((a,b)=>((b.ing.qtyOnHand||0)*(b.ing.costPerUnit||0))-((a.ing.qtyOnHand||0)*(a.ing.costPerUnit||0)) || String(a.ing.name).localeCompare(String(b.ing.name)));
  else arr.sort((a,b)=>String(a.ing.name).localeCompare(String(b.ing.name), undefined, {sensitivity:'base'}));
  return arr;
}
function invLayoutToggleHtml(){
  const opt = (val, label, icon)=>`<button type="button" data-inv-layout="${val}" class="${invLayout===val?'on':''}" aria-label="${label}" aria-pressed="${invLayout===val}" title="${label}">${icon}</button>`;
  const sq = (n)=>{
    if(n===1) return '<svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor"><rect x="2" y="3" width="16" height="4" rx="1.2"/><rect x="2" y="9" width="16" height="4" rx="1.2"/><rect x="2" y="15" width="16" height="3" rx="1.2"/></svg>';
    if(n===2) return '<svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor"><rect x="2" y="3" width="7" height="7" rx="1.5"/><rect x="11" y="3" width="7" height="7" rx="1.5"/><rect x="2" y="12" width="7" height="7" rx="1.5"/><rect x="11" y="12" width="7" height="7" rx="1.5"/></svg>';
    if(n===3) return '<svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor"><rect x="1" y="3" width="5" height="5" rx="1.2"/><rect x="7.5" y="3" width="5" height="5" rx="1.2"/><rect x="14" y="3" width="5" height="5" rx="1.2"/><rect x="1" y="12" width="5" height="5" rx="1.2"/><rect x="7.5" y="12" width="5" height="5" rx="1.2"/><rect x="14" y="12" width="5" height="5" rx="1.2"/></svg>';
    return '<svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor"><rect x="0.6" y="4.4" width="3.8" height="3.8" rx="1"/><rect x="5.6" y="4.4" width="3.8" height="3.8" rx="1"/><rect x="10.6" y="4.4" width="3.8" height="3.8" rx="1"/><rect x="15.6" y="4.4" width="3.8" height="3.8" rx="1"/><rect x="0.6" y="11.8" width="3.8" height="3.8" rx="1"/><rect x="5.6" y="11.8" width="3.8" height="3.8" rx="1"/><rect x="10.6" y="11.8" width="3.8" height="3.8" rx="1"/><rect x="15.6" y="11.8" width="3.8" height="3.8" rx="1"/></svg>';
  };
  return `<div class="inv-layout-toggle" role="group" aria-label="${t('inv_layout_label')}">
    ${opt('rows', t('inv_layout_rows'), sq(1))}
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
function stockRowHtml(r, ccDueIds){
  const i = r.ing;
  // Nombre de View Transition único y estable por tarjeta (custom-ident: solo
  // letras/números/guiones) — es lo que permite que el cambio de vista anime
  // cada tarjeta hacia su nueva celda en lugar de fundir la lista entera.
  // view-transition-name SOLO durante el cambio de vista fila/2col/3col
  // (auditoría de parpadeo 2026-09-08): con el nombre puesto siempre, CADA
  // View Transition de la app (cerrar cualquier modal, abrir un recibo, el visor
  // del catálogo) capturaba una capa por tarjeta — 150 productos = 150 capas
  // por cierre de modal, el "congelado + parpadeo" con inventarios grandes.
  // invLayoutVtActive lo prende render() (app-04) solo para ese render.
  const vtName = invLayoutVtActive ? 'invtile-' + String(i.id).replace(/[^a-zA-Z0-9_-]/g, '') : '';
  return `
  ${/* data-status: lo usa el atajo "Alertas críticas" del Dashboard para saltar
       acá y hacer latir los críticos (ya no se listan en el Dashboard). */''}
  <div class="inv-tile ${ccDueIds.has(i.id)?'cc-due-blink':''}" data-key="invtile:${i.id}" data-open-item="${i.id}" role="button" tabindex="0" data-ing-id="${i.id}" data-status="${r.status}" title="${escapeHtml(i.name)}"${vtName ? ` style="view-transition-name:${vtName};"` : ''}>
    <div class="inv-tile-top">
      <div class="stock-icon-ring ${r.status!=='ok'?r.status:''}" data-photo-item="${i.id}" style="cursor:pointer;width:48px;height:48px;flex-shrink:0;" title="${t('btn_upload_photo')}">${stockIconSvg(i)}</div>
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
function orderCalcCard(){
  return `<div class="oc-card ${orderCalcOpen?'open':''}" id="oc-card" role="button" tabindex="0" aria-expanded="${orderCalcOpen}">
    <div class="stat-label">${t('oc_card_label')}</div>
    <div class="oc-card-total">🧮 <span>${money(orderCalcTotal())}</span></div>
    <div class="oc-card-hint">${t('oc_card_hint')}</div>
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
    inp.onkeydown = (e)=>{
      if(e.key==='Enter'){ e.preventDefault(); inp.blur(); }
      else if(e.key==='Escape'){ orderCalcEditingId = null; render(); }
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
     2. fila de herramientas con nombre, como el Catálogo: Pedido, Conteo (punto
        cuando toca), Escanear estante (el FAB, sin el badge "−");
     3. buscador fijo arriba al scrollear, con vista y ORDEN en la misma fila;
     4. tres filtros rápidos: Crítico, Toca contar, Sin foto;
     5. chips de categoría como filtro justo sobre la lista, con "Todos";
     6. grupos plegables (recuerdan su estado) y "ver los restantes" pasados
        los 12 — lo plegado no se dibuja, así la pestaña sigue liviana. */
  const allRows = stockRowsData();
  const ccDue = isCycleCountDue();
  const ccDueIds = cycleCountDueIds();
  const filterCategory = inventoryCategoryFilter ? categories.find(c=>c.id===inventoryCategoryFilter) : null;
  const sellRows = allRows.filter(r=>!isExpenseItem(r.ing));
  const quick = { crit: sellRows.filter(r=>r.status==='crit'), count: sellRows.filter(r=>ccDueIds.has(r.ing.id)), nophoto: sellRows.filter(r=>!itemPhotoSrc(r.ing)) };
  const searching = !!invSearch.trim();
  let rows = filterCategory ? allRows.filter(r=>r.ing.categoryId===filterCategory.id) : allRows;
  if(invQuickFilter && quick[invQuickFilter]){ const ids = new Set(quick[invQuickFilter].map(r=>r.ing.id)); rows = rows.filter(r=>ids.has(r.ing.id)); }
  rows = invSortRows(rows.filter(r=>invMatches(r.ing.name, invSearch)));
  const groups = groupRowsByCategory(rows);
  const total = sellRows.length;
  const invValue = inventory.reduce((s,i)=>s+(i.qtyOnHand||0)*(i.costPerUnit||0),0);
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
      <div class="category-group-header inv-group ${collapsed?'collapsed':''}" data-key="invgrp:${key}" data-inv-group="${key}" role="button" tabindex="0" aria-expanded="${!collapsed}" aria-label="${t('inv_group_toggle_aria')}">${escapeHtml(g.name)} <span>${g.rows.length}</span><span class="inv-chev">▾</span></div>
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
  <div class="inv-stats">
    <div class="inv-stat"><div class="inv-stat-label">${t('inv_value_label')}</div><div class="inv-stat-value">${fmt(invValue)}</div></div>
    <div class="inv-stat"><div class="inv-stat-label">🏷 ${t('inv_potential_label')}</div><div class="inv-stat-value">${fmt(potential)}</div>${missingSale>0 ? `<div class="inv-stat-note">${t('inv_potential_missing').replace('{n}', missingSale)}</div>` : ''}</div>
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
  ${inventory.length===0 ? (cloudSyncPending ? emptyState('cloud',t('sync_loading_title'),t('sync_loading_sub')) : emptyState('box',t('empty_inventory_title'),t('empty_inventory_sub'),false,
      `<button type="button" class="btn btn-primary" id="btn-inv-empty-scan">${t('dash_empty_scan_btn')}</button>
       <button type="button" class="btn btn-ghost" id="btn-inv-empty-manual">${t('dash_empty_manual_btn')}</button>`)) : `
    ${/* Orden (pedido del usuario 2026-09-08, captura con las dos filas
         marcadas: "estas dos hay que invertirlas"): categorías ARRIBA,
         después los filtros rápidos, y el buscador con el selector de vista
         ABAJO, justo sobre la lista — sigue fijo al scrollear. */''}
    ${categories.length>0 ? categoryChipsRow() : ''}
    <div class="inv-chips">
      ${quickChip('crit', t('inv_quick_crit'))}${quickChip('count', t('inv_quick_count'))}${quickChip('nophoto', t('inv_quick_nophoto'))}
    </div>
    <div class="inv-sticky">
      <div class="inv-toolbar" style="align-items:center;gap:8px;margin:0;">
        <div class="inv-search-wrap">
          <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" fill="none" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
          <input id="inv-search" type="search" value="${escapeHtml(invSearch)}" placeholder="${t('inv_search_ph').replace('{n}', total)}" aria-label="${t('inv_search_aria')}" autocomplete="off">
        </div>
        ${toolbar}
      </div>
    </div>
    ${rows.length===0
      ? (searching || invQuickFilter ? `<div class="oc-empty" style="margin:14px 0;">${t('oc_no_match')}</div>`
        : (filterCategory ? emptyState('box',t('empty_category_title'),t('empty_category_sub')) : emptyState('box',t('empty_inventory_title'),t('empty_inventory_sub'))))
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

/* Calendario del mes que se muestra arriba de la lista de recibos: cada día con
   un recibo muestra su miniatura; los días con notas (parser de Nudgy) llevan una
   burbujita con el emoji de la primera. Tocar CUALQUIER día abre el modal
   unificado del día (dayModal): sus recibos, sus notas y el compositor para
   escribir una nueva — un solo modelo mental en vez de tres comportamientos
   distintos por celda. Un día con varios recibos muestra el primero con la
   insignia "×N"; se elige cuál abrir desde el mismo modal. */
function receiptCalendarWidget(){
  if(!calendarViewMonth) calendarViewMonth = localMonthStr();
  if(calendarShowYearPicker) return yearPickerWidget();
  const [y,m] = calendarViewMonth.split('-').map(Number);
  const firstWeekday = new Date(y, m-1, 1).getDay();
  const daysInMonth = new Date(y, m, 0).getDate();
  const todayStr = localDateStr();

  const receiptsByDay = {};
  receipts.forEach(r=>{
    if(!r.date || r.date.slice(0,7)!==calendarViewMonth) return;
    const day = parseInt(r.date.slice(8,10),10);
    if(!receiptsByDay[day]) receiptsByDay[day] = [];
    receiptsByDay[day].push(r);
  });

  const cells = [];
  for(let i=0;i<firstWeekday;i++) cells.push('<div class="cal-day empty"></div>');
  for(let day=1; day<=daysInMonth; day++){
    const dateStr = calendarViewMonth+'-'+String(day).padStart(2,'0');
    const dayReceipts = receiptsByDay[day];
    const r = dayReceipts ? dayReceipts[0] : null;
    const multi = dayReceipts && dayReceipts.length>1;
    const isToday = dateStr===todayStr;
    const cover = r ? receiptImages(r)[0] : null;
    const isBlink = calendarBlinkDates.includes(dateStr);
    // Notas del día (fijas + recurrentes, parser de Nudgy) — se marcan con el emoji
    // de la primera en una burbujita, sin competir con la miniatura del recibo.
    const dayNotes = calNotesOnDate(calNotes, dateStr);
    // Tocar CUALQUIER día abre el modal unificado del día (recibos + notas +
    // compositor) — antes cada celda decidía entre 3 comportamientos distintos.
    cells.push(`
      <div class="cal-day ${r?'has-receipt':''} ${dayNotes.length?'has-note':''} ${isToday?'today':''} ${isBlink?'blink':''}" data-key="cal:${dateStr}" data-cal-day="${dateStr}" ${r?`title="${multi?dayReceipts.length+' '+t('products_plural'):escapeHtml(r.supplier)||t('no_supplier_name')}"`:dayNotes.length?`title="${escapeHtml(dayNotes[0].text)}"`:''}>
        ${cover ? `<img src="${escapeHtml(receiptImgSrc(cover))}" alt="" ${imgLoadAttr(receiptImgSrc(cover))} decoding="async" onerror="this.style.display='none'">`
          : r ? `<span class="cal-day-receipt-icon">${lineIcon('receipt',18)}</span>`
          : `<span class="cal-day-num">${day}</span>`}
        ${multi ? `<span class="cal-day-badge">×${dayReceipts.length}</span>` : ''}
        ${/* escapeHtml en el icon: viaja por meta/settings que cualquier miembro
             puede escribir vía SDK — sin escape era un XSS almacenado que corría
             en la sesión de todo el equipo (auditoría 2026-09-04). */''}
        ${dayNotes.length ? `<span class="cal-day-note-dot">${escapeHtml(dayNotes[0].icon||'📌')}${dayNotes.length>1?`<i>${dayNotes.length}</i>`:''}</span>` : ''}
      </div>
    `);
  }

  return `
  <div class="cal-widget">
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
              <div style="font-weight:700;font-size:13.5px;">${escapeHtml(r.supplier)||t('no_supplier_name')}</div>
              <div style="font-size:11.5px;color:var(--ink-soft);">${escapeHtml(r.itemCount)} ${r.itemCount!==1?t('products_plural'):t('product_singular')}</div>
            </div>
            <div style="font-family:'IBM Plex Mono';font-weight:700;color:var(--navy);font-size:14px;flex-shrink:0;">${money(r.total)}</div>
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
function recibosView(){
  const query = receiptSearchQuery.trim().toLowerCase();
  const filtered = receipts.filter(r=>{
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
  <div class="section-head">
    <div><h2>${t('rec_title')}</h2><p>${t('rec_sub')}</p></div>
    ${/* Sin el botón "Scan receipt" (lo tachó el usuario): escanear ya vive en el
         botón grande del Dashboard — acá duplicaba y apretaba el buscador. */''}
    ${/* Sin recibos todavía no hay nada que buscar (auditoría de primer minuto
         2026-09-07): el buscador por monto recién aparece con el primer recibo.
         El calendario sí se muestra siempre (sirve para anotar recordatorios). */''}
    ${receipts.length>0 ? `
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
      <div class="field" style="margin:0;width:100%;max-width:220px;"><input id="cal-amount-search" type="text" inputmode="decimal" value="${escapeHtml(calendarAmountQuery)}" placeholder="${t('rec_amount_search_placeholder')}"></div>
    </div>` : ''}
  </div>
  ${/* El calendario va SIEMPRE (corrección 2026-09-07): esconderlo sin recibos
       dejaba a un usuario nuevo sin poder anotar un recordatorio tocando un día.
       Solo el buscador por monto (arriba) espera al primer recibo. */''}
  ${receiptCalendarWidget()}
  ${receipts.length>0 ? `<div class="field" style="max-width:340px;"><input id="receipt-search" type="text" value="${escapeHtml(receiptSearchQuery)}" placeholder="${t('rec_search_placeholder')}"></div>` : ''}
  ${receipts.length===0 ? emptyState('receipt',t('empty_receipts_title'),'',true,
      `<button type="button" class="btn btn-primary" id="btn-rec-empty-scan">${t('dash_empty_scan_btn')}</button>`) :
    (sorted.length===0 ? `<div class="helper-note" style="margin:4px 0 0;">${t('rec_no_matches')}</div>` :
    groups.map(g=>`
      <div class="section-head" style="margin-top:22px;margin-bottom:10px;">
        <h3 style="margin:0;font-size:14px;text-transform:capitalize;">${g.label}</h3>
        <div style="font-size:12px;color:var(--ink-soft);">${t('rec_month_total')}: <strong style="color:var(--ink);">${money(g.total)}</strong></div>
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
            ${imgs.length>1 ? `<span style="position:absolute;top:10px;right:10px;background:rgba(0,0,0,0.6);color:#fff;font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;">${imgs.length}p</span>` : ''}
            <div style="padding:14px 16px;">
              <div style="font-weight:700;font-size:14px;">${escapeHtml(r.supplier)||t('no_supplier_name')}</div>
              <div style="font-size:11.5px;color:var(--ink-soft);margin:3px 0 8px;">${escapeHtml(r.date)} &middot; ${escapeHtml(r.itemCount)} ${r.itemCount!==1?t('products_plural'):t('product_singular')}</div>
              ${/* Monto = color de dinero fijo (regla 2026-09-06), no el acento del tema. */''}
              <div style="font-family:'IBM Plex Mono';font-weight:700;color:var(--money-pos);font-size:15px;">${money(r.total)}</div>
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
  const W = 560, H = 180, padL = 52, padR = 16, padT = 16, padB = 16;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const prices = points.map(p=>p.unitPrice);
  let min = Math.min(...prices), max = Math.max(...prices);
  if(min===max){ min = min*0.9; max = (max*1.1)||1; } // evita aplanar la gráfica si el precio nunca cambió

  const xFor = (i)=> padL + (points.length===1 ? innerW/2 : (i/(points.length-1))*innerW);
  const yFor = (v)=> padT + innerH - ((v-min)/(max-min))*innerH;

  const first = points[0].unitPrice, last = points[points.length-1].unitPrice;
  const changePct = first>0 ? ((last-first)/first)*100 : 0;
  const trendColor = changePct>3 ? 'var(--money-neg)' : changePct<-3 ? 'var(--money-pos)' : 'var(--navy)';

  const gridLines = [0,0.5,1].map(f=>{
    const y = padT + innerH*f;
    const val = max - (max-min)*f;
    return `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W-padR}" y2="${y.toFixed(1)}" stroke="var(--line)" stroke-width="1"/>
      <text x="${padL-8}" y="${(y+3).toFixed(1)}" text-anchor="end" font-size="10" fill="var(--ink-soft)" font-family="IBM Plex Mono">${money(val)}</text>`;
  }).join('');

  const linePoints = points.map((p,i)=> `${xFor(i).toFixed(1)},${yFor(p.unitPrice).toFixed(1)}`).join(' ');

  const markers = points.map((p,i)=>{
    const x=xFor(i).toFixed(1), y=yFor(p.unitPrice).toFixed(1);
    return `<circle cx="${x}" cy="${y}" r="4" fill="${trendColor}" stroke="var(--panel)" stroke-width="2">
      <title>${escapeHtml(p.date)} · ${escapeHtml(p.supplier)} · ${money(p.unitPrice)}</title>
    </circle>`;
  }).join('');

  const lastX = xFor(points.length-1), lastY = yFor(last);
  const endLabel = `<text x="${lastX.toFixed(1)}" y="${(lastY-10).toFixed(1)}" text-anchor="end" font-size="11" font-weight="700" fill="var(--ink)" font-family="IBM Plex Mono">${money(last)}</text>`;

  // Área bajo la línea con degradado hacia transparente — el mismo dato de siempre,
  // pero se lee de un vistazo como un gráfico "de verdad" en vez de una línea pelada.
  const gradId = 'ph-grad-'+(__chartGradientSeq++);
  const baseline = (padT+innerH).toFixed(1);
  const areaPoints = `${xFor(0).toFixed(1)},${baseline} ${linePoints} ${xFor(points.length-1).toFixed(1)},${baseline}`;

  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;">
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
  </svg>`;
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
          <label style="display:block;font-size:12px;font-weight:700;color:var(--ink);margin-bottom:8px;">${t('supplier_compare_title')}</label>
          <div class="ing-list-mini" style="max-height:150px;">
            ${supplierRows.map((s,idx)=>`
              <div class="ing-list-mini-item">
                <span>${escapeHtml(s.supplier)} ${idx===0?`<span class="price-updated">${t('cheapest_label')}</span>`:''}
                  ${s.count>1?`<div style="font-size:10.5px;color:var(--ink-soft);margin-top:2px;">${t('avg_price_label')} ${money(s.avgPrice)}/${escapeHtml(unitLabel(ing.unit))}</div>`:''}
                </span>
                <span class="mono-cell">${money(s.lastPrice)}/${escapeHtml(unitLabel(ing.unit))}</span>
              </div>
            `).join('')}
          </div>
          <div class="helper-note" style="margin-top:6px;">${t('supplier_compare_helper')}</div>
        ` : ''}
        <label style="display:block;font-size:12px;font-weight:700;color:var(--ink);margin:14px 0 8px;">${t('ph_full_history_label')}</label>
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

/* Gráfico APILADO (auditoría de presupuesto 2026-09-07): mercadería abajo (verde),
   gastos operativos arriba (ámbar) y la línea punteada del presupuesto de CADA mes
   sobre su barra — antes se graficaba el total sin presupuesto, y el presupuesto
   mide solo gastos. Las barras crecen al abrir (animación CSS, .ms-bar). */
function monthlySpendChartStacked(monthsAsc, currentMonthKey){
  // Ancho según la cantidad de meses (auditoría 2026-09-07): con 2 meses en un
  // viewBox de 560 el texto quedaba diminuto en el celular. Cada mes pide ~78px;
  // con muchos meses el svg pide más ancho que la pantalla y el contenedor scrollea.
  const n0 = monthsAsc.length;
  const padL = 52, padR = 16, padT = 18, padB = 28;
  const W = Math.max(300, padL + padR + n0*78), H = 210;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const splits = monthsAsc.map(m=>spendSplitForMonth(m));
  const budgets = monthsAsc.map(m=>budgetForMonth(m)||0);
  const max = Math.max(...splits.map(s=>s.invested+s.expense), ...budgets, 1);
  const n = monthsAsc.length;
  const slot = innerW / n;
  const barW = Math.min(slot * 0.55, 26);
  const yOf = v => padT + innerH - (v/max)*innerH;
  const gridLines = [0,0.5,1].map(f=>{
    const y = padT + innerH*(1-f);
    return `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W-padR}" y2="${y.toFixed(1)}" stroke="var(--line)" stroke-width="1"/>
      <text x="${padL-8}" y="${(y+3).toFixed(1)}" text-anchor="end" font-size="10" fill="var(--ink-soft)" font-family="IBM Plex Mono">${money(max*f)}</text>`;
  }).join('');
  const bars = monthsAsc.map((m,i)=>{
    const s = splits[i];
    const x = padL + i*slot + (slot-barW)/2;
    const invH = (s.invested/max)*innerH, expH = (s.expense/max)*innerH;
    const yInv = padT + innerH - invH, yExp = yInv - expH;
    const isCurrent = m===currentMonthKey;
    const dim = isCurrent ? '' : 'opacity:.55;';
    const total = s.invested + s.expense;
    const b = budgets[i];
    const budgetLine = b>0 ? `<line x1="${(x-6).toFixed(1)}" y1="${yOf(b).toFixed(1)}" x2="${(x+barW+6).toFixed(1)}" y2="${yOf(b).toFixed(1)}" stroke="var(--ink)" stroke-width="1.6" stroke-dasharray="3 3" opacity="${isCurrent?'.9':'.5'}"><title>${escapeHtml(t('ms_legend_budget'))} · ${money(b)}</title></line>` : '';
    return `
      <g class="ms-bar" style="animation-delay:${i*60}ms;">
        <rect x="${x.toFixed(1)}" y="${yInv.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(invH, s.invested>0?2:0).toFixed(1)}" rx="3" fill="var(--money-pos)" style="${dim}"><title>${escapeHtml(t('ms_legend_inv'))} · ${money(s.invested)}</title></rect>
        <rect x="${x.toFixed(1)}" y="${yExp.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(expH, s.expense>0?2:0).toFixed(1)}" rx="3" fill="var(--money-warn)" style="${dim}"><title>${escapeHtml(t('ms_legend_exp'))} · ${money(s.expense)}</title></rect>
      </g>
      ${budgetLine}
      <text x="${(x+barW/2).toFixed(1)}" y="${(Math.min(yExp, b>0?yOf(b):yExp)-6).toFixed(1)}" text-anchor="middle" font-size="10" font-weight="700" fill="var(--ink)" font-family="IBM Plex Mono">${money(total)}</text>
      <text x="${(x+barW/2).toFixed(1)}" y="${(padT+innerH+16).toFixed(1)}" text-anchor="middle" font-size="10" fill="${isCurrent?'var(--ink)':'var(--ink-soft)'}" font-weight="${isCurrent?'700':'400'}" font-family="IBM Plex Mono">${escapeHtml(monthLabel(m, uiLang))}</text>
    `;
  }).join('');
  // Con muchos meses el svg pide más ancho que la pantalla y el contenedor scrollea.
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;min-width:${n0>5 ? n0*66 : 0}px;height:auto;display:block;">
    ${gridLines}
    ${bars}
  </svg>`;
}
function monthlySpendModal(){
  const currentMonthKey = localMonthStr();
  const months = allMonths();
  // El mes actual siempre está, aunque todavía no tenga recibos.
  if(!months.includes(currentMonthKey)) months.unshift(currentMonthKey);
  const monthsAsc = [...months].reverse(); // más viejo primero, para leer izquierda a derecha en el tiempo

  return `
  <div class="overlay" id="monthly-spend-overlay">
    <div class="modal wide">
      <h3 class="navy">${t('ms_title')}</h3>
      <div class="sub">${t('ms_sub')}</div>
      ${monthsAsc.length===0 ? `
        <div class="helper-note" style="margin:0 0 16px;">${t('ms_no_purchases')}</div>
      ` : `
        <div style="margin:14px 0;overflow-x:auto;">${monthlySpendChartStacked(monthsAsc, currentMonthKey)}</div>
        <div class="ms-legend">
          <span><i style="background:var(--money-pos);"></i>${t('ms_legend_inv')}</span>
          <span><i style="background:var(--money-warn);"></i>${t('ms_legend_exp')}</span>
          <span><i class="ms-legend-line"></i>${t('ms_legend_budget')}</span>
        </div>
        <div class="ing-list-mini" style="max-height:180px;">
          ${[...monthsAsc].reverse().map(m=>{
            const s = spendSplitForMonth(m); const b = budgetForMonth(m);
            const detail = b ? t('ms_row_detail').replace('{exp}', money(s.expense)).replace('{pct}', String(Math.round(s.expense/b*100)))
                             : t('ms_row_detail_nb').replace('{exp}', money(s.expense));
            return `
            <div class="ing-list-mini-item">
              <span>${escapeHtml(monthLabel(m, uiLang))} ${m===currentMonthKey?`<span class="price-updated">${t('ms_current_month')}</span>`:''}<div class="ms-row-detail">${detail}</div></span>
              <span class="mono-cell">${money(spendForMonth(m))}</span>
            </div>`;
          }).join('')}
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
// color + ícono que ya usa welcomeModal() para sus 4 pasos, para que "Configuración"
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
  // CLAROS. Bosque, Uva, Rosa y Dorado se quitaron a pedido (sus bloques de
  // CSS también); un dispositivo que los tenía guardados vuelve a Noche.
  {id:'night',          es:'Noche',       en:'Night',     bg:'#0f1115', accent:'#ff6b35'},
  {id:'oceano',         es:'Océano',      en:'Ocean',     bg:'#0d1220', accent:'#4da3ff'},
  {id:'medianoche',     es:'Medianoche',  en:'Midnight',  bg:'#000000', accent:'#22d3ee'},
  // Paletas de referencia del usuario (2026-09-06) — oscuras:
  {id:'esmeralda',      es:'Esmeralda',   en:'Emerald',   bg:'#0C3B2E', accent:'#FFBA00'},
  {id:'indigo',         es:'Índigo',      en:'Indigo',    bg:'#2a2645', accent:'#F0C38E'},
  {id:'rubi',           es:'Rubí',        en:'Ruby',      bg:'#181B24', accent:'#CC324C'},
  {id:'zafiro',         es:'Zafiro',      en:'Sapphire',  bg:'#232e4a', accent:'#73B7F1'},
  // "Store noche" (2026-09-08): las tarjetas del App Store sobre el oscuro.
  {id:'appstore-noche', es:'Store noche', en:'Store dark', bg:'#0f1115', accent:'#71a3e9'},
  // — y claros:
  {id:'claro',          es:'Claro',       en:'Light',     bg:'#f3f4f8', accent:'#e85d24'},
  {id:'crema',          es:'Crema',       en:'Cream',     bg:'#f6f1e7', accent:'#c65b2e'},
  {id:'menta',          es:'Menta',       en:'Mint',      bg:'#eef6f1', accent:'#0fa37f'},
  {id:'pastel',         es:'Pastel',      en:'Pastel',    bg:'#e7f8ff', accent:'#87AEEE'},
  {id:'electrico',      es:'Eléctrico',   en:'Electric',  bg:'#f7f2ff', accent:'#752FFF'},
  {id:'coral',          es:'Coral',       en:'Coral',     bg:'#fdf7e8', accent:'#FF5844'},
  {id:'miel',           es:'Miel',        en:'Honey',     bg:'#FCF1DA', accent:'#E38C4C'},
  // Pedidos por captura 2026-09-07 (Robinhood / App Store):
  {id:'robin',          es:'Robin',       en:'Robin',     bg:'#ffffff', accent:'#00c805'},
  {id:'cupertino',      es:'Cupertino',   en:'Cupertino', bg:'#f2f2f7', accent:'#007aff'},
  // "App Store" (pedido por captura 2026-09-08): tarjetas del Dashboard con los
  // degradados pastel de la pestaña Buscar del App Store, en claro.
  {id:'appstore',       es:'App Store',   en:'App Store', bg:'#ffffff', accent:'#71a3e9'},
];
let dustyTheme = 'night';
try{
  const v = localStorage.getItem('patron_theme');
  if(DUSTY_THEMES.some(x=>x.id===v)) dustyTheme = v;
  // Tema guardado que ya no existe (Bosque/Uva/Rosa/Dorado, quitados el
  // 2026-09-08): se limpia el atributo que puso index.html y la preferencia,
  // para que el dispositivo quede en Noche de verdad y no en un tema fantasma.
  else if(v && v!=='night'){ document.documentElement.removeAttribute('data-dusty-theme'); localStorage.removeItem('patron_theme'); }
}catch(e){}
/* LATIDOS de aviso (pedido del usuario 2026-09-07): un interruptor en Ajustes apaga
   o prende las palpitaciones de Inventario (conteo pendiente, stock crítico, días
   del calendario) y de Presupuesto (barra, tarjeta de alerta, punto del Dashboard).
   Preferencia del dispositivo; el CSS lee html[data-dusty-pulse="off"]. */
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
    <label style="font-size:13px;font-weight:700;color:var(--ink);">${title}</label>
  </div>`;
}
function alertSettingsModal(){
  /* AJUSTES reorganizado (auditoría 2026-09-07): título propio (antes decía
     "Alertas de precio", el nombre de lo que era esta pantalla antes de crecer),
     cinco secciones con nombre en orden de uso — Apariencia, Inventario,
     Alertas, Catálogo, Cuenta — y UNA sola regla de guardado: todo se aplica al
     instante (los umbrales al soltar el campo, como ya lo hacían tema, idioma,
     latidos y formato). Sin Guardar ni Cancelar: un Cerrar abajo y la ✕ arriba. */
  return `
  <div class="overlay" id="alert-settings-overlay">
    <div class="modal">
      <button type="button" class="modal-close-btn" id="btn-close-alert-settings" aria-label="${t('btn_close')}">✕</button>
      <h3 class="saffron">${t('settings_title')}</h3>
      <div class="sub">${t('settings_sub')}</div>

      ${/* 1. APARIENCIA: tema, latidos, idioma y formato de montos — lo que un
           usuario nuevo busca primero. Todo instantáneo y guardado en el dispositivo. */''}
      <div class="settings-card">
        ${settingsCardHeader('tag','var(--navy-wash)','var(--navy)',t('settings_appearance_title'))}
        <div style="font-size:12.5px;font-weight:700;color:var(--ink-soft);margin-bottom:8px;">${t('theme_title')}</div>
        <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px 6px;">
          ${DUSTY_THEMES.map(th=>`
          <button type="button" data-set-theme="${th.id}" aria-pressed="${dustyTheme===th.id}" style="background:none;border:none;padding:0;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:5px;min-width:0;">
            <span style="width:38px;height:38px;border-radius:50%;background:${th.bg};border:2.5px solid ${dustyTheme===th.id?'var(--navy)':'var(--line)'};display:flex;align-items:center;justify-content:center;box-shadow:var(--shadow-sm);">
              <span style="width:16px;height:16px;border-radius:50%;background:${th.accent};"></span>
            </span>
            <span style="font-size:10px;font-weight:700;color:${dustyTheme===th.id?'var(--navy)':'var(--ink-soft)'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;">${uiLang==='en'?th.en:th.es}</span>
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

      ${/* 2. INVENTARIO: categorías y conteo cíclico (configuración, no acciones del día). */''}
      <div class="settings-card">
        ${settingsCardHeader('box','var(--navy-wash)','var(--navy)',t('settings_inventory_title'))}
        <div style="display:flex;flex-direction:column;gap:8px;">
          <button class="btn btn-ghost btn-sm" id="btn-manage-categories">${t('btn_manage_categories')}</button>
          <button class="btn btn-ghost btn-sm" id="btn-cycle-count" style="position:relative;">
            ${t('cc_btn')}${isCycleCountDue()?'<span class="cc-due-dot"></span>':''}
          </button>
        </div>
      </div>

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

      ${/* 4. CATÁLOGO: la publicación (WhatsApp, canales, redes, despublicar). */''}
      <div class="settings-card">
        ${settingsCardHeader('share','var(--sky-soft)','var(--sky-ink)',t('settings_catalog_title'))}
        <button class="btn btn-ghost btn-sm" id="btn-open-catalog-publish" style="width:100%;">${t('settings_catalog_btn')}</button>
      </div>

      ${/* 5. CUENTA: submodal con respaldo, compartir cuenta, cerrar sesión,
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
        <a href="privacy.html" target="_blank" rel="noopener" style="font-size:12px;color:var(--ink-soft);">${t('privacy_policy_link')}</a>
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
function openBudgetModal(){ draftMonthlyBudget = monthlyBudget; showBudgetModal = true; render(); }
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
  return `
  <div class="overlay" id="budget-overlay">
    <div class="modal">
      <h3 class="basil">${t('budget_title')}</h3>
      <div class="field" style="margin-top:10px;">
        <label>${t('budget_label')}</label>
        <input id="budget-input" type="number" min="0" step="0.01" inputmode="decimal" placeholder="${escapeHtml(ph)}" value="${draftMonthlyBudget!==null && draftMonthlyBudget!==undefined ? draftMonthlyBudget : ''}" ${canSeeFinancials()?'':'disabled'}>
      </div>
      ${canSeeFinancials()
        ? `<div class="helper-note">${t('budget_helper')}${Object.keys(budgetMeta.byMonth).some(k=>k<localMonthStr() && budgetMeta.byMonth[k]!==monthlyBudget) ? ' '+t('budget_history_note') : ''}</div>`
        : `<div class="helper-note" style="color:var(--saffron-ink);">${t('budget_locked_note')}</div>`}
      ${canSeeFinancials() ? `
      <div class="field" style="margin-top:4px;">
        <label for="cogs-target-input">${t('budget_cogs_label')}</label>
        <input id="cogs-target-input" type="number" min="1" max="99" step="1" inputmode="numeric" placeholder="30" value="${budgetMeta.cogsTargetPct!==null ? escapeHtml(budgetMeta.cogsTargetPct) : ''}">
      </div>
      <div class="helper-note">${t('budget_cogs_helper')}</div>
      <label class="budget-rollover">
        <input type="checkbox" id="budget-rollover-input" ${budgetMeta.rollover?'checked':''}>
        <span><b>${t('budget_rollover_label')}</b><small>${t('budget_rollover_helper')}</small></span>
      </label>` : ''}
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
            <span style="font-size:13px;color:var(--ink);min-width:0;overflow-wrap:anywhere;">${escapeHtml(name)}${muted?` <span style="font-size:10px;font-weight:700;color:var(--ink-soft);background:var(--inset);border-radius:6px;padding:1px 6px;">${t('budget_exp_example_tag')}</span>`:''}</span>
            <span style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
              <strong style="font-size:13px;font-variant-numeric:tabular-nums;">${amount}</strong>
              ${/* Botón de PAGO por fila (reporte del usuario 2026-09-05: "la
                   barra no se mueve"): los bills creados como puro catálogo no
                   tenían cómo registrar el pago del mes — este ＋ lo crea al
                   toque (recibo manual) y la barra reacciona ya. Verde ✓ si
                   este mes ya se pagó. */''}
              ${id?(paidThisMonth(id,name)
                ? `<span title="${t('expense_paid_tag')}" style="width:26px;height:26px;border-radius:50%;background:var(--basil-soft);color:var(--basil-ink);display:inline-flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;flex-shrink:0;">✓</span>`
                : `<button type="button" class="dash-pencil-btn" data-pay-bill="${id}" title="${t('expense_pay_btn')}" aria-label="${t('expense_pay_btn')}" style="color:var(--basil);border-color:color-mix(in srgb, var(--basil) 35%, var(--panel));font-weight:800;">＋</button>`):''}
              ${id?`<span style="color:var(--ink-soft);font-size:12px;">›</span>`:''}
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

/* ================= CATÁLOGO PARA CLIENTES =================
   Pestaña propia (4.ª del carrusel — pedido del usuario 2026-09-06: "tiene que
   haber otra pantalla"): el dueño marca qué productos/piezas mostrar, pone su
   WhatsApp y publica; una función de Netlify (publish-catalog) escribe el doc
   público y sube las fotos — el cliente final abre patronsc.netlify.app/c/<id>
   (catalogo.html) sin cuenta ni app, y pide por WhatsApp. La selección viaja como
   inCatalog en cada ítem/receta (sincroniza gratis con ellos); el número y el id
   del catálogo viajan por meta. */
let catalogPublishing = false;
let showCatalogPublishModal = false;
// CÁMARA-PRIMERO (iteración con el usuario 2026-09-06: "cuando le doy a la
// cámara no me permite abrir la cámara"): tocar el botón dispara LA CÁMARA al
// instante; con la foto ya sacada, este borrador guarda la imagen mientras un
// modalcito pregunta "¿de qué producto es?" — tocás el producto y queda. Nada
// de modos ni de tocar primero el producto.
let catalogPendingPhoto = null;
// El ORIGINAL de la foto recién sacada/subida + el filtro elegido: los filtros
// se recalculan siempre desde el original (aplicar Vívido sobre B/N arruinaría
// la foto), y catalogPendingPhoto guarda la versión ya filtrada que se asigna.
let catalogPendingOriginal = null;
let catalogPendingFilter = 'original';
// Cámara INTELIGENTE (pedido del usuario 2026-09-06): mientras el modal de
// asignar ya está abierto, la misma IA del identificador de productos mira la
// foto y sugiere de qué producto se trata — la sugerencia aparece resaltada
// arriba de la lista, un toque y listo. Solo cuentas reales (gasta 1 escaneo
// del cupo; el trial de 5 no debe quemarse en silencio) y si falla o no
// reconoce, la lista manual sigue ahí como siempre.
let catalogAssignDetecting = false;
let catalogAssignSuggestion = null; // {kind:'item'|'recipe', id}
let catalogAssignReqId = 0;
/* ---- EDITOR DE FOTO (pedido del usuario 2026-09-06: lo que la gente usa en
   los editores) — recorte/encuadre con zoom y giro, Auto-mejora de un toque y
   deslizadores de brillo/contraste/saturación/nitidez. NO destructivo: los
   ajustes viven en catalogEdit y se re-hornean siempre desde la foto COMPLETA
   (catalogEditFull, 1400px) — el resultado recién pisa el borrador al tocar
   "Listo". Todo a puro canvas/píxel, sin servicios pagos. */
let catalogEditorOpen = false;
let catalogEditFull = null; // base 1400px de la foto recién sacada/subida
// temp/shadows/highlights (2026-09-06, foco del usuario: "brillos e iluminación"):
// los tres controles de LUZ que los editores serios usan más que el brillo —
// temperatura (corrige el color del foco del local), sombras (levanta lo oscuro
// sin lavar el resto) y luces (recupera lo quemado). Van horneados en el preview
// (no existen en CSS filter) con el debounce corto de la nitidez.
// ratio: '1:1' | '4:5' | 'orig' (formato del recorte — auditoría 2026-09-07: la
// vista previa siempre mostraba un cuadrado aunque la alta guardara la forma
// original; ahora lo que se ve es lo que se publica). tilt: enderezado fino en
// grados (−15..15), aparte del giro de 90°.
const CATALOG_EDIT_DEFAULTS = {rot:0, tilt:0, ratio:'1:1', zoom:1, offX:0.5, offY:0.5, bright:0, contrast:0, sat:0, sharp:0, auto:false, temp:0, shadows:0, highlights:0};
let catalogEditGuide = false;      // guía de encuadre 85% (regla de Amazon) visible
let catalogEditSrcAspect = 1;      // ancho/alto de la base ya girada (lienzo del formato "Original")
let catalogAiJob = null;           // {kind, startedAt, expectSec, cancelled} — progreso/cancelar de las funciones PRO
let catalogEdit = Object.assign({}, CATALOG_EDIT_DEFAULTS);
let catalogEditBackup = null;   // para que Cancelar deshaga lo tocado en esta pasada
let catalogEditPreviewUrl = null;
let catalogEditBaking = false;
let catalogEditPrevReq = 0;
/* QUITAR FONDO (la función PRO — pedido del usuario 2026-09-06): la IA de
   segmentación (Replicate, vía remove-background.js) devuelve el producto en
   PNG con transparencia; el recorte se guarda acá y se COMPONE en el cliente
   sobre el color de fondo elegido — cambiar de blanco a crema no vuelve a
   llamar (ni cobrar) a la IA. */
let catalogEditCutout = null;      // PNG transparente del producto
let catalogEditFullBackup = null;  // la foto original, para "volver atrás"
let catalogEditBg = '#ffffff';
let catalogRemovingBg = false;
// "Mejorar con IA" (súper-resolución Real-ESRGAN, la otra pata Pro): true
// mientras la IA reconstruye la foto.
let catalogEnhancing = false;
// "Escenario IA" (FLUX Kontext): genera el ambiente alrededor del producto.
let catalogStaging = false;
let catalogStageOpen = false;
/* Patrón iOS Fotos (pedido del usuario 2026-09-06, con captura de su Library):
   tocar una tarjeta ABRE la foto completa (visor a pantalla completa); marcar
   para el catálogo es un MODO aparte con el botón "Seleccionar" (→ "Listo"),
   igual que Select en iOS — así ver y seleccionar no se pisan nunca. */
let catalogSelectMode = false;
let catalogViewPhoto = null; // {kind:'item'|'recipe', id} — visor abierto
// Al CERRAR el visor, la miniatura de este producto lleva el view-transition-name
// un render (el vuelo de vuelta) — se consume en attachEvents (app-07).
let catalogViewerReturnTo = null;
/* La lista que recorre el visor (deslizar izquierda/derecha): el mismo orden
   en que se ven las tarjetas en la grilla — categorías y después recetas. */
function catalogViewerList(){
  const sellables = inventory.filter(i=>i && !isExpenseItem(i));
  const list = [];
  // Mismo orden que catalogoView: "Faltan fotos", categorías, recetas.
  sellables.filter(i=>!catalogPhotoThumbSrc(i.photo)).forEach(i=>list.push({kind:'item', id:i.id}));
  groupRowsByCategory(sellables.filter(i=>!!catalogPhotoThumbSrc(i.photo)).map(i=>({ing:i}))).forEach(g=>g.rows.forEach(r=>list.push({kind:'item', id:r.ing.id})));
  recipes.filter(r=>r && r.id).forEach(r=>list.push({kind:'recipe', id:r.id}));
  return list;
}
function catalogViewerObj(s){
  if(!s) return null;
  return s.kind==='item' ? inventory.find(i=>i.id===s.id) : recipes.find(r=>r && r.id===s.id);
}
/* VISOR DE FOTO (auditoría "smooth" 2026-09-07, contra iOS Fotos / PhotoSwipe):
   - la miniatura (ya en memoria) aparece AL INSTANTE como placeholder con blur y
     la alta (photoHiUrl) la reemplaza apenas baja — antes el fondo quedaba negro;
   - ✕ arriba, contador "3 de 12", nombre y precio abajo con acciones (Compartir
     foto / Al catálogo); tocar la foto muestra u oculta ese chrome, tocar el
     fondo cierra, deslizar hacia abajo cierra, deslizar a los lados pasa de
     foto, doble tap y pellizco hacen zoom (todo en app-07);
   - role=dialog + aria-modal, Escape cierra (handler global), y el fondo no
     scrollea (body.catalog-viewer-open);
   - vuelo miniatura ↔ visor con view-transition-name compartido (ver render). */
function catalogPhotoViewer(){
  const s = catalogViewPhoto;
  const obj = catalogViewerObj(s);
  if(!obj) return '';
  const list = catalogViewerList();
  const idx = list.findIndex(x=>x.kind===s.kind && x.id===s.id);
  const thumb = catalogPhotoThumbSrc(obj.photo);
  const hi = obj.photoHiUrl || null;
  const inCat = !!obj.inCatalog;
  const counter = idx>=0 ? t('catalog_viewer_counter').replace('{i}', idx+1).replace('{n}', list.length) : '';
  const shareSvg = '<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="10.5" x2="15.4" y2="6.5"/><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/></svg>';
  return `
  <div class="overlay overlay-fast catalog-viewer" id="catalog-photo-viewer" role="dialog" aria-modal="true" aria-label="${escapeHtml(obj.name)}" data-cv-kind="${s.kind}" data-cv-id="${escapeHtml(s.id)}">
    <div class="cv-stage" id="cv-stage">
      ${thumb || hi
        ? `<img id="cv-img" src="${escapeHtml(thumb || hi)}" ${hi && thumb ? `data-hi="${escapeHtml(hi)}" class="cv-placeholder"` : ''} alt="${escapeHtml(obj.name)}" decoding="async" style="view-transition-name:catalog-photo;">`
        : `<div class="cv-empty">${escapeHtml(obj.name)}</div>`}
    </div>
    <div class="cv-top">
      <button type="button" class="cv-btn" id="cv-close" aria-label="${t('catalog_viewer_close')}">✕</button>
      <span class="cv-counter">${counter}</span>
      <span style="width:40px;"></span>
    </div>
    <div class="cv-bottom">
      <div class="cv-name">${escapeHtml(obj.name)}</div>
      ${obj.salePrice>0 ? `<div class="cv-price">${money(obj.salePrice)}</div>` : ''}
      <div class="cv-actions">
        <button type="button" id="cv-share">${shareSvg} ${t('catalog_viewer_share')}</button>
        <button type="button" id="cv-toggle" class="${inCat?'on':''}" aria-pressed="${inCat}">${inCat ? '✓ '+t('catalog_viewer_in') : '+ '+t('catalog_viewer_add')}</button>
      </div>
    </div>
  </div>`;
}
// Escenarios incorporados (2026-09-06, idea "maniquíes y fondos"): texturas
// generadas una vez y servidas como archivos del sitio (/backdrops/*.jpg).
const CATALOG_BACKDROPS = ['studio','wood','marble','linen','concrete','dark'];
async function composeCatalogCutout(){
  if(!catalogEditCutout) return;
  const img = await loadB64Image(catalogEditCutout);
  const W = img.naturalWidth, H = img.naturalHeight;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  // Fondo: color plano o escenario ("bd:<id>") con ajuste cover.
  if(String(catalogEditBg).indexOf('bd:')===0){
    const bg = await new Promise((res, rej)=>{
      const im = new Image();
      im.onload = ()=>res(im);
      im.onerror = ()=>rej(new Error(t('err_img_process')));
      im.src = '/backdrops/' + catalogEditBg.slice(3) + '.jpg';
    });
    const s = Math.max(W/bg.width, H/bg.height);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bg, (W-bg.width*s)/2, (H-bg.height*s)/2, bg.width*s, bg.height*s);
  } else {
    ctx.fillStyle = catalogEditBg;
    ctx.fillRect(0, 0, W, H);
  }
  // SOMBRA SUAVE automática bajo el producto — el truco que evita que "flote".
  // El contorno sale del alfa del recorte escaneado a 80px (barato); la sombra
  // es una elipse con degradado radial apoyada en la base del producto.
  const sc = document.createElement('canvas'); sc.width = sc.height = 80;
  const sx = sc.getContext('2d'); sx.drawImage(img, 0, 0, 80, 80);
  const sd = sx.getImageData(0, 0, 80, 80).data;
  let minX = 80, maxX = 0, maxY = 0;
  for(let y=0; y<80; y++) for(let x2=0; x2<80; x2++){
    if(sd[(y*80+x2)*4+3] > 40){ if(x2<minX) minX=x2; if(x2>maxX) maxX=x2; if(y>maxY) maxY=y; }
  }
  if(maxX > minX){
    const cxP = ((minX+maxX)/2)/80*W, wP = (maxX-minX)/80*W;
    const yP = Math.min(maxY/80*H + H*0.015, H*0.985);
    const rx = wP*0.52, ry = Math.max(H*0.02, wP*0.09);
    const g = ctx.createRadialGradient(cxP, yP, 0, cxP, yP, rx);
    g.addColorStop(0, 'rgba(0,0,0,0.30)');
    g.addColorStop(0.7, 'rgba(0,0,0,0.12)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.translate(cxP, yP); ctx.scale(1, ry/rx); ctx.translate(-cxP, -yP);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cxP, yP, rx, 0, 7); ctx.fill();
    ctx.restore();
  }
  ctx.drawImage(img, 0, 0);
  catalogEditFull = {base64: cv.toDataURL('image/jpeg', 0.9).split(',')[1], mediaType:'image/jpeg'};
}
function loadB64Image(obj){
  return new Promise((res, rej)=>{
    const im = new Image();
    im.onload = ()=>res(im);
    im.onerror = ()=>rej(new Error(t('err_img_process')));
    im.src = 'data:'+(obj.mediaType||'image/jpeg')+';base64,'+obj.base64;
  });
}
/* FLUIDEZ (reporte del usuario 2026-09-06: "no se siente al ritmo del dedo"):
   brillo/contraste/saturación NO se hornean mientras se arrastra — viven como
   CSS filter sobre el preview (GPU, 60fps, instantáneo) y recién se convierten
   en píxeles al tocar "Listo". La matemática del horneado final COPIA la
   semántica de CSS (brightness multiplicativo, contrast alrededor de 127.5,
   saturate con pesos Rec.709) para que lo que ves sea lo que queda. */
function cssFilterForEdit(){
  const e = catalogEdit;
  return `brightness(${1+e.bright/100}) contrast(${1+e.contrast/100}) saturate(${1+e.sat/100})`;
}
// El zoom del ÚLTIMO horneado del preview: mientras se arrastra el zoom o el
// encuadre, el <img> se transforma por CSS relativo a esta base (fluido) y el
// horneado real llega al soltar.
let catalogEditBakedZoom = 1;
// Pestañas del editor (pedido del usuario 2026-09-06: "menú profesional") —
// Luz / Color / Encuadre / PRO, como organizan los editores serios; arranca
// en Luz, el foco que el usuario definió.
let catalogEditTab = 'light';
/* Hornea la foto a outSize px: giro → recorte cuadrado (zoom + encuadre) →
   auto-niveles → nitidez; brillo/contraste/saturación solo cuando
   withAdjust=true (el guardado final) — el preview los muestra por CSS. */
/* Relación alto/ancho del recorte según el formato elegido: 1:1 cuadrado, 4:5
   vertical (Instagram), 'orig' la forma de la foto (ya girada). */
function catalogEditAspect(e, rw, rh){
  if(e.ratio==='4:5') return 1.25;
  if(e.ratio==='orig') return rh/rw;
  return 1;
}
async function bakeCatalogEdit(outSize, withAdjust, fullSrc, editSrc){
  // fullSrc/editSrc opcionales: la subida en ALTA (uploadCatalogHiRes) hornea
  // después de que el estado global ya se limpió, con sus copias capturadas.
  const img = await loadB64Image(fullSrc || catalogEditFull);
  const e = editSrc || catalogEdit;
  const rot = ((e.rot%360)+360)%360;
  const rw = (rot===90||rot===270) ? img.naturalHeight : img.naturalWidth;
  const rh = (rot===90||rot===270) ? img.naturalWidth : img.naturalHeight;
  if(!fullSrc || fullSrc===catalogEditFull) catalogEditSrcAspect = rw/rh;
  const rc = document.createElement('canvas'); rc.width = rw; rc.height = rh;
  const rctx = rc.getContext('2d');
  // Giro de 90° + ENDEREZADO fino (tilt): se gira todo junto y, si hay tilt, se
  // agranda lo justo para que no asomen esquinas vacías (el zoom mínimo que
  // cubre el lienzo tras girar un rectángulo).
  const tilt = Number(e.tilt)||0;
  rctx.translate(rw/2, rh/2); rctx.rotate((rot+tilt)*Math.PI/180);
  if(tilt){
    const a = Math.abs(tilt)*Math.PI/180;
    const cover = Math.max((rw*Math.cos(a)+rh*Math.sin(a))/rw, (rw*Math.sin(a)+rh*Math.cos(a))/rh);
    rctx.scale(cover, cover);
  }
  rctx.drawImage(img, -img.naturalWidth/2, -img.naturalHeight/2);
  // Recorte con el formato elegido (antes: siempre cuadrado).
  const aspect = catalogEditAspect(e, rw, rh); // alto/ancho
  const zoom = Math.max(1, e.zoom);
  let cw = rw, chh = rw*aspect;
  if(chh > rh){ chh = rh; cw = rh/aspect; }
  cw /= zoom; chh /= zoom;
  const cx = Math.min(Math.max(e.offX*rw, cw/2), rw - cw/2);
  const cy = Math.min(Math.max(e.offY*rh, chh/2), rh - chh/2);
  const outW = outSize, outH = Math.max(1, Math.round(outSize*aspect));
  const oc = document.createElement('canvas'); oc.width = outW; oc.height = outH;
  const ctx = oc.getContext('2d');
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(rc, cx-cw/2, cy-chh/2, cw, chh, 0, 0, outW, outH);
  const d = ctx.getImageData(0, 0, outW, outH), p = d.data;
  const clamp = v=>v<0?0:v>255?255:v;
  // LUZ (temperatura / sombras / luces) — antes del auto y de los ajustes: son
  // correcciones de la escena, no de estilo. Pesos cuadráticos por luminancia:
  // sombras solo empuja lo oscuro, luces solo lo brillante.
  if(e.temp || e.shadows || e.highlights){
    const tR = 1 + (e.temp||0)/180, tB = 1 - (e.temp||0)/180;
    const sh = (e.shadows||0)*0.9, hl = (e.highlights||0)*0.9;
    for(let i=0; i<p.length; i+=4){
      let r=p[i]*tR, g=p[i+1], b=p[i+2]*tB;
      const lum = (0.2126*r+0.7152*g+0.0722*b)/255;
      const wS = (1-lum)*(1-lum), wH = lum*lum;
      const lift = sh*wS + hl*wH;
      r+=lift; g+=lift; b+=lift;
      p[i]=clamp(r); p[i+1]=clamp(g); p[i+2]=clamp(b);
    }
  }
  if(e.auto){
    // Auto-niveles POR CANAL con recorte del 1%: estira exposición y contraste
    // y de paso corrige el tinte (la luz amarilla del local) — el clásico "Auto".
    for(let ch=0; ch<3; ch++){
      const hist = new Uint32Array(256);
      for(let i=ch; i<p.length; i+=4) hist[p[i]]++;
      const cut = (p.length/4)*0.01;
      let lo=0, acc=0; while(lo<255 && acc<cut) acc += hist[lo++];
      let hi=255; acc=0; while(hi>0 && acc<cut) acc += hist[hi--];
      const range = Math.max(1, hi-lo);
      for(let i=ch; i<p.length; i+=4) p[i] = clamp((p[i]-lo)*255/range);
    }
  }
  // Misma matemática que el CSS filter del preview (brightness → contrast →
  // saturate, en ese orden) — solo en el horneado FINAL.
  const bF = 1+e.bright/100, cF = 1+e.contrast/100, sF = 1+e.sat/100;
  if(withAdjust && (e.bright || e.contrast || e.sat)){
    for(let i=0; i<p.length; i+=4){
      let r=p[i]*bF, g=p[i+1]*bF, b=p[i+2]*bF;
      r=(r-127.5)*cF+127.5; g=(g-127.5)*cF+127.5; b=(b-127.5)*cF+127.5;
      const lum = 0.2126*r+0.7152*g+0.0722*b;
      r=lum+(r-lum)*sF; g=lum+(g-lum)*sF; b=lum+(b-lum)*sF;
      p[i]=clamp(r); p[i+1]=clamp(g); p[i+2]=clamp(b);
    }
  }
  if(e.sharp>0){
    const amt = e.sharp/100*0.9, w = outW, h = outH, src = new Uint8ClampedArray(p);
    for(let y=1; y<h-1; y++) for(let x=1; x<w-1; x++){
      const i=(y*w+x)*4;
      for(let ch=0; ch<3; ch++){
        const c=i+ch;
        const blur=(src[c-4]+src[c+4]+src[c-w*4]+src[c+w*4]+src[c]*4)/8;
        p[c]=clamp(src[c]+amt*(src[c]-blur));
      }
    }
  }
  ctx.putImageData(d, 0, 0);
  return {base64: oc.toDataURL('image/jpeg', 0.82).split(',')[1], mediaType:'image/jpeg'};
}
/* size: 480 al soltar (nítido); 320 MIENTRAS se arrastra nitidez/temperatura/
   sombras/luces (auditoría 2026-09-07: el horneado de 480 con ajustes medía
   ~90 ms en escritorio, 300-450 en un teléfono medio — a 320 baja a menos de
   la mitad y el deslizador sigue al dedo). */
async function refreshCatalogEditPreview(size){
  if(!catalogEditFull) return;
  const req = ++catalogEditPrevReq;
  catalogEditBaking = true;
  try{
    const out = await bakeCatalogEdit(size||480, false); // sin b/c/s: esos van por CSS
    if(req!==catalogEditPrevReq || !catalogEditorOpen) return;
    catalogEditPreviewUrl = 'data:image/jpeg;base64,'+out.base64;
  }catch(err){}
  if(req!==catalogEditPrevReq) return;
  catalogEditBaking = false;
  catalogEditBakedZoom = catalogEdit.zoom;
  // El preview se actualiza EN el <img> directo (sin render completo): un render
  // por movimiento de deslizador reconstruiría el propio deslizador a mitad del
  // arrastre. La transform temporal (zoom/arrastre en vivo) se resetea porque el
  // horneado nuevo ya la incorpora; el CSS filter se re-aplica por si acaso.
  const img = document.getElementById('catalog-edit-preview');
  if(img && catalogEditPreviewUrl){
    img.src = catalogEditPreviewUrl;
    img.style.transform = '';
    img.style.filter = cssFilterForEdit();
  } else render();
}
function resolveCatalogSuggestion(res){
  if(!res) return null;
  const norm = s=>String(s||'').toLowerCase().trim();
  // 1) La IA ya emparejó contra el inventario (matched_inventory_name exacto).
  const mName = norm(res.matched_inventory_name);
  if(mName){
    const it = inventory.find(i=>i && !isExpenseItem(i) && norm(i.name)===mName);
    if(it) return {kind:'item', id:it.id};
  }
  // 2) Red de seguridad por nombre contenido, productos primero y piezas después.
  const rName = norm(res.name);
  if(rName){
    const it2 = inventory.find(i=>i && !isExpenseItem(i) && (norm(i.name).includes(rName) || rName.includes(norm(i.name))));
    if(it2) return {kind:'item', id:it2.id};
    const rec = recipes.find(r=>r && r.id && (norm(r.name).includes(rName) || rName.includes(norm(r.name))));
    if(rec) return {kind:'recipe', id:rec.id};
  }
  return null;
}
function catalogUrl(){ return catalogId ? (location.origin + '/c/' + catalogId) : null; }
/* PUBLICACIÓN AUTOMÁTICA (2026-09-06, "borra ese settings de raíz"): con el
   catálogo ya publicado, cada cambio relevante (selección, foto asignada, alta
   subida) agenda una republicación silenciosa a los 4s — los cambios seguidos
   se agrupan en una sola. La PRIMERA publicación sigue siendo explícita (el
   modal de Compartir), que es donde se configuran número, canales y redes. */
let catalogAutoPublishTimer = null;
function scheduleCatalogAutoPublish(){
  if(!catalogId || !currentUser || currentUser.isAnonymous) return;
  clearTimeout(catalogAutoPublishTimer);
  catalogAutoPublishTimer = setTimeout(()=>{ publishCatalogNow(true); }, 4000);
}
/* Los 4 filtros de edición más usados (pedido del usuario 2026-09-06), a puro
   píxel (getImageData) a propósito: ctx.filter no existe en Safari viejo y los
   thumbnails de 300px hacen esto instantáneo en cualquier teléfono.
   - vivid: saturación + contraste (el "pop" de producto de Instagram)
   - warm:  temperatura cálida (dorado de comida/atardecer)
   - retro: sepia parcial + negros lavados (look de película)
   - bw:    blanco y negro con un toque de contraste */
async function applyCatalogFilter(orig, key){
  if(!orig) return null;
  if(key==='original') return {base64: orig.base64, mediaType: orig.mediaType};
  const img = await new Promise((res, rej)=>{
    const im = new Image();
    im.onload = ()=>res(im);
    im.onerror = ()=>rej(new Error(t('err_img_process')));
    im.src = 'data:'+(orig.mediaType||'image/jpeg')+';base64,'+orig.base64;
  });
  const cv = document.createElement('canvas');
  cv.width = img.naturalWidth; cv.height = img.naturalHeight;
  const ctx = cv.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, cv.width, cv.height), p = d.data;
  const clamp = v => v<0 ? 0 : v>255 ? 255 : v;
  for(let i=0;i<p.length;i+=4){
    let r=p[i], g=p[i+1], b=p[i+2];
    const lum = 0.299*r + 0.587*g + 0.114*b;
    if(key==='vivid'){
      r = lum+(r-lum)*1.4; g = lum+(g-lum)*1.4; b = lum+(b-lum)*1.4;
      r = (r-128)*1.12+128; g = (g-128)*1.12+128; b = (b-128)*1.12+128;
    } else if(key==='warm'){
      r = r*1.08+10; g = g*1.03+4; b = b*0.92;
    } else if(key==='retro'){
      const sr = r*0.393+g*0.769+b*0.189, sg = r*0.349+g*0.686+b*0.168, sb = r*0.272+g*0.534+b*0.131;
      r = r*0.45+sr*0.55; g = g*0.45+sg*0.55; b = b*0.45+sb*0.55;
      r = r*0.9+22; g = g*0.9+22; b = b*0.9+22;
    } else if(key==='bw'){
      const v = (lum-128)*1.08+128; r = v; g = v; b = v;
    }
    p[i]=clamp(r); p[i+1]=clamp(g); p[i+2]=clamp(b);
  }
  ctx.putImageData(d, 0, 0);
  return {base64: cv.toDataURL('image/jpeg', 0.8).split(',')[1], mediaType: 'image/jpeg'};
}
function catalogPhotoThumbSrc(photo){
  if(!photo) return null;
  if(photo.base64) return cachedPhotoUrl(photo.base64, photo.mediaType);
  return photo.url || null;
}
function catalogoView(){
  const sellables = inventory.filter(i=>i && !isExpenseItem(i));
  const sellableRecipes = recipes.filter(r=>r && r.id);
  // Tarjeta-botón IGUAL que la del Inventario (misma .inv-tile en la misma
  // .inv-grid con el mismo selector fila/2col/3col — pedido del usuario
  // 2026-09-06): tocarla marca/desmarca el producto para el catálogo. La
  // seleccionada va a pleno color con su ✓ verde; la no seleccionada, apagada.
  // Tarjeta = SOLO la foto, semi-cuadrada (pedido del usuario 2026-09-06: sin
  // círculos y sin descripción — igual que la página pública). El nombre y el
  // precio no se muestran; el title/aria los conserva. Sin foto, el nombre
  // centrado hace de imagen (si no, el cuadrado sería mudo). TODAS las fotos van
  // a pleno brillo (el atenuado de las no seleccionadas hacía ver la pantalla
  // apagada — pedido del usuario 2026-09-06); la selección se lee SOLO por el
  // ✓ verde y su borde.
  // Vista de FILAS (verificación 2026-09-07): el cuadrado a todo el ancho daba
  // fichas de 347px de alto con el thumbnail de 300px estirado — una foto por
  // pantalla. En filas la ficha es una línea: foto chica a la izquierda, el
  // nombre completo (acá sí cabe) y el ✓ a la derecha, como la lista de Fotos.
  const tile = (kind, id, name, photoSrc, checked)=>{
    const check = checked
      ? `<span style="width:22px;height:22px;border-radius:50%;background:var(--basil);color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;pointer-events:none;flex-shrink:0;">✓</span>`
      : '';
    const border = checked ? 'border-color:color-mix(in srgb, var(--basil) 55%, var(--line));' : '';
    // Vuelo de VUELTA del visor: la miniatura del producto que se estaba viendo
    // lleva el nombre de transición un render (ver catalogViewerReturnTo).
    const vt = (catalogViewerReturnTo && catalogViewerReturnTo.kind===kind && catalogViewerReturnTo.id===id) ? 'view-transition-name:catalog-photo;' : '';
    if(invLayout==='rows'){
      return `
    <div class="inv-tile" data-key="cat:${kind}:${id}" data-cat-toggle="${kind}:${id}" role="button" tabindex="0" aria-pressed="${checked}" title="${escapeHtml(name)}" style="display:flex;flex-direction:row;align-items:center;gap:12px;padding:8px 12px 8px 8px;${border}">
      <span style="width:58px;height:58px;border-radius:12px;overflow:hidden;flex-shrink:0;background:var(--inset);display:flex;align-items:center;justify-content:center;">
        ${photoSrc
          ? `<img src="${escapeHtml(photoSrc)}" alt="" ${imgLoadAttr(photoSrc)} decoding="async" style="width:100%;height:100%;object-fit:cover;display:block;${vt}">`
          : lineIcon('tag',20)}
      </span>
      <span style="flex:1;min-width:0;font-weight:700;font-size:15px;color:var(--ink);overflow-wrap:anywhere;">${escapeHtml(name)}</span>
      ${check}
    </div>`;
    }
    return `
    <div class="inv-tile" data-key="cat:${kind}:${id}" data-cat-toggle="${kind}:${id}" role="button" tabindex="0" aria-pressed="${checked}" title="${escapeHtml(name)}" style="position:relative;padding:0;overflow:hidden;aspect-ratio:1/1;display:block;${border}">
      ${checked?`<span style="position:absolute;top:6px;right:6px;z-index:2;">${check}</span>`:''}
      ${photoSrc
        ? `<img src="${escapeHtml(photoSrc)}" alt="" ${imgLoadAttr(photoSrc)} decoding="async" style="width:100%;height:100%;object-fit:cover;display:block;${vt}">`
        : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;padding:8px;text-align:center;font-weight:800;font-size:12.5px;color:var(--ink);overflow-wrap:anywhere;background:var(--inset);">${escapeHtml(invShortName(name))}</div>`}
    </div>`;
  };
  const itemTile = (i)=> tile('item', i.id, i.name, catalogPhotoThumbSrc(i.photo), !!i.inCatalog);
  const recipeTile = (r)=> tile('recipe', r.id, r.name, catalogPhotoThumbSrc(r.photo), !!r.inCatalog);
  const url = catalogUrl();
  return `
  ${/* Sin encabezado ni tarjeta de link arriba (el usuario lo tachó de raíz,
       captura 2026-09-06). Lo operativo (WhatsApp, publicar, despublicar)
       vive compacto al FINAL, después de la lista. */''}
  ${/* FILA DE HERRAMIENTAS con etiqueta (referencia del usuario 2026-09-06:
       una app de edición "bien organizada" — botones grandes redondos con su
       nombre debajo, parejos): Galería · CÁMARA (la protagonista, más grande,
       con su badge ✎) · Seleccionar · Compartir. SIEMPRE visible — también sin
       productos todavía (sin la cámara a mano, un usuario nuevo no puede ni
       empezar; bug cazado en la verificación 2026-09-06). */''}
  ${(()=>{
      const tool = (id, inner, label, extra)=>`
        <button type="button" id="${id}" style="display:flex;flex-direction:column;align-items:center;gap:7px;background:none;border:none;cursor:pointer;padding:0;min-width:64px;">
          ${inner}
          <span class="cat-tool-label" style="${extra||''}">${label}</span>
        </button>`;
      const ring = (svg, cls, on)=>`
        <span class="cat-tool-ring ${cls}" style="${on?'outline:3px solid var(--sky);outline-offset:2px;':''}">${svg}</span>`;
      const shareSvg = '<svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="10.5" x2="15.4" y2="6.5"/><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/></svg>';
      const collageSvg = '<svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/></svg>';
      return `
    ${/* Tarjeta elevada estilo "Create New" de InShot (segunda captura del
         usuario): los círculos con gradiente y etiqueta viven juntos en una
         tarjeta redondeada — la casa de las herramientas del catálogo. */''}
    ${/* Sin tarjeta contenedora (el usuario la tachó, captura 2026-09-06): los
         círculos flotan directo sobre la página, cada uno ya trae su sombra. */''}
    ${/* CUADRO DE COLOR (pedido del usuario 2026-09-08, captura del Dashboard
         con la tarjeta verde marcada: "solo poner en el cuadro la cámara y lo
         demás"): la fila de herramientas vive dentro de la misma tarjeta de
         color que el presupuesto (.dash-budget), en VIOLETA (--tile-4, pedido
         del usuario: "la cámara ya es verde, escoge un color con el que el
         menú se vea bien") — contrasta con el coral, el amarillo, el verde y
         la cámara en cualquier tema — con los anillos ribeteados en blanco. */''}
    <div class="stat-card dash-month dash-budget catalog-tools-card">
      ${/* SIN engranaje (el usuario lo borró de raíz): la publicación es
           AUTOMÁTICA — cada cambio del catálogo se publica solo (ver
           scheduleCatalogAutoPublish). La config de una vez vive en la primera
           publicación (Compartir) y después en Ajustes generales. */''}
      ${/* Sin el título "Herramientas del catálogo" (el usuario lo borró de raíz,
           2026-09-07): los tres círculos con su etiqueta ya se explican solos. */''}
      ${/* align-items:flex-end (verificación 2026-09-07): con flex-start las
           etiquetas Collage/Compartir quedaban 25px más arriba que "Cámara"
           (el círculo grande empuja la suya). Alineadas por abajo, las tres
           palabras comparten renglón y la cámara sobresale por arriba — el
           patrón de la fila de herramientas de InShot. */''}
      <div style="display:flex;justify-content:space-evenly;align-items:flex-end;gap:4px;padding:2px 0;">
        ${/* Orden (pedido del usuario 2026-09-06): la CÁMARA primera desde la
             DERECHA — donde cae el pulgar. Galería se FUSIONÓ en la Cámara
             (pedido del usuario: "eso ahí está demasiado"): sin capture, el
             teléfono ofrece Tomar foto y Fototeca en la misma hoja nativa. */''}
        ${tool('btn-catalog-collage', ring(collageSvg, 'cat-collage'), t('catalog_tool_collage'))}
        ${/* PLANTILLAS (pedido del usuario 2026-09-07): catálogo en grilla, lista
             de precios, menú de restaurante u oferta, como imagen para compartir. */''}
        ${tool('btn-catalog-templates', ring('<svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>', 'cat-templates'), t('catalog_tool_templates'))}
        ${tool('btn-catalog-share-top', ring(shareSvg, 'cat-share'), t('catalog_share_btn'))}
        <button type="button" id="btn-catalog-photo" aria-label="${t('catalog_photo_fab_aria')}" style="display:flex;flex-direction:column;align-items:center;gap:7px;background:none;border:none;cursor:pointer;padding:0;min-width:76px;">
          ${/* Mismo porte que los escáneres (76px de .shelf-scan-fab, ícono 32 —
               pedido del usuario 2026-09-07): sin el override de 64px de antes. */''}
          <span class="shelf-fab-wrap" style="display:inline-block;">
            <span class="shelf-scan-fab" style="display:flex;">${lineIcon('camera',32)}</span>
            <span class="shelf-minus-badge" style="pointer-events:none;background:var(--sky);display:flex;align-items:center;justify-content:center;">✎</span>
          </span>
          <span class="cat-tool-label" style="font-weight:800;">${t('catalog_tool_camera')}</span>
        </button>
      </div>
    </div>`;
    })()}
  ${sellables.length===0 && sellableRecipes.length===0
    ? (()=>{
      /* ÍTEMS DE EJEMPLO para el usuario nuevo (pedido 2026-09-06): tarjetas
         ficticias — visuales, no datos, nada que sincronizar — que muestran
         cómo se ve el catálogo (grupos, cuadrados, el ✓ de seleccionado).
         Desaparecen SOLAS en cuanto existe el primer producto real, porque solo
         viven en esta rama vacía. pointer-events:none: no se tocan. */
      const ex = uiLang==='en'
        ? [['👕','T-shirt',true],['☕','Mug',true],['🧢','Cap',false],['🔌','Cable',true]]
        : [['👕','Camiseta',true],['☕','Taza',true],['🧢','Gorra',false],['🔌','Cable',true]];
      return `
      <div class="category-group-header" style="margin-top:26px;">${uiLang==='en'?'Example':'Ejemplo'} <span>${ex.length}</span></div>
      <div class="inv-grid cols2" style="pointer-events:none;">
        ${ex.map(([e,n,chk])=>`
        <div class="inv-tile" style="position:relative;padding:0;overflow:hidden;aspect-ratio:1/1;display:block;opacity:.8;${chk?'border-color:color-mix(in srgb, var(--basil) 55%, var(--line));':''}">
          ${chk?`<span style="position:absolute;top:6px;right:6px;z-index:2;width:22px;height:22px;border-radius:50%;background:var(--basil);color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;">✓</span>`:''}
          <div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;background:var(--inset);">
            <span style="font-size:40px;">${e}</span>
            <span style="font-weight:800;font-size:13.5px;color:var(--ink);">${n}</span>
            <span style="font-size:10px;font-weight:700;color:var(--ink-soft);background:var(--raised);border-radius:6px;padding:2px 8px;">${t('budget_exp_example_tag')}</span>
          </div>
        </div>`).join('')}
      </div>
      <div class="helper-note" style="margin-top:12px;">${t('catalog_examples_note')}</div>`;
    })()
    : `
    ${/* Misma organización que el Inventario: grupos por categoría y las mismas
         tarjetas en la grilla fila/2col/3col con el selector compartido. */''}
    ${/* Seleccionar vive a la IZQUIERDA de esta fila (donde lo señaló el
         usuario, captura 2026-09-06), frente al selector de vista. */''}
    <div class="inv-toolbar" style="justify-content:space-between;align-items:center;gap:8px;margin-top:26px;">
      ${/* Seleccionar SIN caja (pedido del usuario): texto pelado, como el
           "Select" de iOS Fotos — verde cuando el modo está activo. */''}
      <button type="button" id="btn-catalog-select" style="background:none;border:none;cursor:pointer;padding:8px 4px;font-weight:800;font-size:15px;color:${catalogSelectMode?'var(--basil)':'var(--ink)'};">${catalogSelectMode ? '✓ '+t('catalog_select_done') : t('catalog_select_btn')}</button>
      ${/* En modo selección (auditoría 2026-09-07, patrón iOS Fotos / Material 3):
           contador "N seleccionados" + Todos / Ninguno en lugar del selector de
           vista — que ahí no hace falta. */''}
      ${catalogSelectMode ? (()=>{
          const n = sellables.filter(i=>i.inCatalog).length + sellableRecipes.filter(r=>r.inCatalog).length;
          return `
      <span style="display:flex;align-items:center;gap:6px;min-width:0;">
        <span id="catalog-select-count" style="font-size:13px;font-weight:800;color:var(--basil);white-space:nowrap;font-variant-numeric:tabular-nums;">${t('catalog_select_count').replace('{n}', n)}</span>
        <button type="button" class="exit-reason-chip" id="btn-catalog-select-all" style="padding:5px 10px;font-size:12.5px;">${t('catalog_select_all')}</button>
        <button type="button" class="exit-reason-chip" id="btn-catalog-select-none" style="padding:5px 10px;font-size:12.5px;">${t('catalog_select_none')}</button>
      </span>`;
        })() : invLayoutToggleHtml()}
    </div>
    ${/* La ayuda del modo selección ya NO va en línea (verificación 2026-09-07):
         al entrar/salir del modo la nota aparecía y desaparecía empujando toda
         la grilla ~35px — un salto de layout. Ahora sale como toast al entrar
         (app-07), y la grilla no se mueve. */''}
    ${/* "FALTAN FOTOS" primero (auditoría 2026-09-07, patrón de estado vacío de
         NN/g): los productos sin foto se agrupan arriba, con su propio contador,
         en vez de perderse como cuadrados de texto entre los que sí tienen — el
         empujón visible para sacarlas. Con foto, cada uno en su categoría. */''}
    ${(()=>{
        const noPhoto = sellables.filter(i=>!catalogPhotoThumbSrc(i.photo));
        const withPhoto = sellables.filter(i=>!!catalogPhotoThumbSrc(i.photo));
        const gridCls = `inv-grid ${invLayout}${catalogSelectMode?' cat-selecting':''}`;
        return `
    ${noPhoto.length>0 ? `
      <div class="category-group-header" style="color:var(--saffron-ink, var(--ink-soft));">📷 ${t('catalog_missing_photos')} <span>${noPhoto.length}</span></div>
      <div class="${gridCls}" style="margin-bottom:16px;">${noPhoto.map(itemTile).join('')}</div>` : ''}
    ${groupRowsByCategory(withPhoto.map(i=>({ing:i}))).map(g=>`
      <div class="category-group-header">${escapeHtml(g.name)} <span>${g.rows.length}</span></div>
      <div class="${gridCls}" style="margin-bottom:16px;">${g.rows.map(r=>itemTile(r.ing)).join('')}</div>
    `).join('')}
    ${sellableRecipes.length>0 ? `
      <div class="category-group-header">${t('catalog_recipes_header')} <span>${sellableRecipes.length}</span></div>
      <div class="${gridCls}" style="margin-bottom:16px;">${sellableRecipes.map(recipeTile).join('')}</div>` : ''}`;
      })()}`}
  ${/* Sin bloque de publicación en la página (el usuario lo tachó de raíz,
       captura 2026-09-06): la pestaña queda limpia — herramientas y fotos.
       Todo lo de publicar vive en el MODAL que abre la herramienta Compartir. */''}
  <div style="height:26px;"></div>`;
}

/* ================= COLLAGE CON DISEÑOS =================
   (referencia del usuario 2026-09-06: la galería de layouts de las apps de
   collage). Tras elegir 2-4 fotos se abre el selector: cuadrículas clásicas y
   los "Pinboard" — fotos inclinadas estilo polaroid con marco blanco y sombra
   sobre fondo de estudio. Curado para fotos de producto. */
/* MODAL DE CÁMARA del Catálogo (intro única, captura del usuario 2026-09-07):
   el mismo modal con caja punteada que Recibos, Productos y Estante — título,
   una línea, la caja "Tocá para sacar o elegir una foto" y Cancelar. Tocar la
   caja abre la CÁMARA directo y el link de abajo la galería (decisión final
   del usuario: sin hojas intermedias); con la foto elegida este modal se
   cierra y aparece el de asignar. */
let showCatalogCameraModal = false;
function catalogCameraModal(){
  return `
  <div class="overlay overlay-fast" id="catalog-camera-overlay">
    <div class="modal">
      <h3 class="sky">${t('catalog_camera_title')}</h3>
      <div class="sub">${t('catalog_camera_sub')}</div>
      <div class="drop-zone" id="catalog-drop-zone">
        <div class="dz-icon">${lineIcon('camera',26)}</div>
        <div style="font-weight:600;font-size:13.5px;">${t('scan_tap_photo')}</div>
      </div>
      <button type="button" id="btn-catalog-gallery" class="dz-gallery-link">${t('scan_upload_gallery_btn')}</button>
      <div class="scan-tip">📷 ${t('catalog_tip')}</div>
      ${scanQuotaLineHtml()}
      <div class="modal-actions" style="margin-top:0;">
        <button class="btn btn-ghost" id="btn-cancel-catalog-camera" style="width:100%;">${t('btn_cancel')}</button>
      </div>
    </div>
  </div>`;
}
/* ================= PLANTILLAS (pedido del usuario 2026-09-07) =================
   Cuarta herramienta del Catálogo: arma una IMAGEN lista para compartir o
   imprimir con los productos — catálogo en grilla, lista de precios, menú de
   restaurante u oferta — en formato post (1080²), historia (1080×1920) u hoja
   (1240×1754, A4 a 150 dpi). Todo a canvas local con las miniaturas base64
   (nunca URLs remotas: pintarlas mancharía el canvas y no se podría exportar).
   Varias páginas cuando no entran; Compartir manda todas como archivos. */
let showTemplateModal = false;
let tplKind = 'grid', tplFormat = 'post', tplStyle = 'dark', tplScope = 'catalog';
let tplPage = 0, tplOfferId = null, tplRendering = false, tplReq = 0;
let tplPreviewUrl = null;
const TPL_FORMATS = { post:[1080,1080], story:[1080,1920], sheet:[1240,1754] };
const TPL_STYLES = {
  dark:  {bg:'#0f1522', panel:'#171d2c', ink:'#f2f4f8', soft:'#9aa3b5', accent:'#6fd38f', line:'#2a3244', serif:false},
  light: {bg:'#ffffff', panel:'#f3f4f6', ink:'#151515', soft:'#6b7280', accent:'#2f7d4f', line:'#e5e7eb', serif:false},
  warm:  {bg:'#f6efe3', panel:'#fff9ef', ink:'#2b1d12', soft:'#8a705a', accent:'#b5532a', line:'#e6d8c3', serif:true}
};
function templateItems(){
  const useAll = tplScope==='all';
  const out = [];
  inventory.filter(i=>i && !isExpenseItem(i) && (useAll || i.inCatalog)).forEach(i=>{
    const cat = categories.find(c=>c.id===i.categoryId);
    out.push({id:i.id, name:i.name, price:Number(i.salePrice)||0, unit:i.unit||'', photo:(i.photo && i.photo.base64) ? i.photo : null, category: cat ? cat.name : ''});
  });
  recipes.filter(r=>r && r.id && (useAll || r.inCatalog)).forEach(r=>{
    out.push({id:r.id, name:r.name, price:Number(r.salePrice)||0, unit:'', photo:(r.photo && r.photo.base64) ? r.photo : null, category: t('catalog_recipes_header')});
  });
  return out;
}
// Cuántos productos entran por página en cada diseño y formato.
function tplCapacity(kind, fmt){
  const c = { grid:{post:9, story:15, sheet:20}, list:{post:12, story:24, sheet:32}, menu:{post:11, story:22, sheet:30}, offer:{post:1, story:1, sheet:1}, cats:{post:5, story:9, sheet:11} };
  return c[kind][fmt];
}
function tplPages(kind = tplKind){
  const items = templateItems();
  if(kind==='offer'){
    const one = items.find(i=>i.id===tplOfferId) || items[0];
    return one ? [[one]] : [];
  }
  if(kind==='cats'){
    // POR CATEGORÍAS (referencia del usuario 2026-09-07: banda de color a la
    // izquierda y tarjetas blancas con foto redonda, "Pizza · 25 items"):
    // la primera página es la portada con una tarjeta por categoría; después,
    // una tarjeta por producto agrupada por categoría, en el mismo estilo.
    // Sirve igual para un menú de restaurante o un catálogo de ferretería.
    const cap = tplCapacity('cats', tplFormat);
    const groups = {}; const order = [];
    items.forEach(it=>{ const k=it.category||''; if(!(k in groups)){ groups[k]=[]; order.push(k); } groups[k].push(it); });
    const cats = order.map(k=>({name: k || t('categories_uncategorized'), count: groups[k].length, photo: (groups[k].find(i=>i.photo)||{}).photo || null}));
    const pages = [];
    for(let i=0;i<cats.length;i+=cap) pages.push({cover:true, cats:cats.slice(i,i+cap)});
    const lines = []; order.forEach(k=>{ if(k) lines.push({h:k}); groups[k].forEach(it=>lines.push({it})); });
    for(let i=0;i<lines.length;i+=cap) pages.push(lines.slice(i,i+cap));
    return pages;
  }
  if(kind==='menu'){
    // Agrupado por categoría (en el orden del usuario); los encabezados
    // también cuentan como renglón. Un grupo puede seguir en la página siguiente.
    const cap = tplCapacity('menu', tplFormat);
    const groups = {}; const order = [];
    items.forEach(it=>{ const k=it.category||''; if(!(k in groups)){ groups[k]=[]; order.push(k); } groups[k].push(it); });
    const lines = []; order.forEach(k=>{ if(k) lines.push({h:k}); groups[k].forEach(it=>lines.push({it})); });
    const pages = []; for(let i=0;i<lines.length;i+=cap) pages.push(lines.slice(i,i+cap));
    return pages;
  }
  const cap = tplCapacity(kind, tplFormat);
  const pages = []; for(let i=0;i<items.length;i+=cap) pages.push(items.slice(i,i+cap));
  return pages;
}
// --- helpers de dibujo ---
function tplRoundRect(ctx, x, y, w, h, r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
function tplCover(ctx, im, x, y, w, h, r){
  ctx.save(); tplRoundRect(ctx,x,y,w,h,r); ctx.clip();
  const s = Math.max(w/im.naturalWidth, h/im.naturalHeight);
  const dw = im.naturalWidth*s, dh = im.naturalHeight*s;
  ctx.drawImage(im, x+(w-dw)/2, y+(h-dh)/2, dw, dh); ctx.restore();
}
function tplFont(st, weight, size){ return `${weight} ${size}px ${st.serif ? 'Georgia, "Times New Roman", serif' : '-apple-system, "Segoe UI", Roboto, sans-serif'}`; }
function tplFit(ctx, text, maxW){ let s=String(text||''); if(ctx.measureText(s).width<=maxW) return s; while(s.length>1 && ctx.measureText(s+'…').width>maxW) s=s.slice(0,-1); return s+'…'; }
function tplWrap(ctx, text, maxW, maxLines){
  const words = String(text||'').split(/\s+/); const lines=[]; let cur='';
  for(const w of words){ const tst = cur ? cur+' '+w : w; if(ctx.measureText(tst).width<=maxW || !cur) cur=tst; else { lines.push(cur); cur=w; if(lines.length===maxLines) break; } }
  if(lines.length<maxLines && cur) lines.push(cur);
  if(lines.length===maxLines && words.join(' ')!==lines.join(' ')) lines[maxLines-1]=tplFit(ctx, lines[maxLines-1]+'…', maxW);
  return lines;
}
function tplPriceText(it){ return it.price>0 ? money(it.price) + (it.unit && it.unit!=='unidad' ? '/'+unitLabel(it.unit) : '') : t('tpl_price_ask'); }
async function tplImages(items){
  const map = new Map();
  await Promise.all(items.filter(it=>it && it.photo).map(async it=>{ try{ map.set(it.id, await loadB64Image(it.photo)); }catch(e){} }));
  return map;
}
async function composeTemplatePage(page, pageIdx, total, kind = tplKind){
  const [W,H] = TPL_FORMATS[tplFormat]; const st = TPL_STYLES[tplStyle];
  const cv = document.createElement('canvas'); cv.width=W; cv.height=H;
  const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high';
  ctx.fillStyle = st.bg; ctx.fillRect(0,0,W,H);
  const pad = Math.round(W*0.06);
  const title = businessName || 'Dusty';
  // Encabezado: nombre del negocio + qué es.
  ctx.fillStyle = st.ink; ctx.textBaseline='top'; ctx.textAlign='left';
  ctx.font = tplFont(st, 800, Math.round(W*0.052)); ctx.fillText(tplFit(ctx, title, W-pad*2), pad, pad);
  ctx.fillStyle = st.soft; ctx.font = tplFont(st, 600, Math.round(W*0.026));
  const sub = kind==='menu' ? '' : t('tpl_kind_'+kind) + (total>1 ? ' · '+t('tpl_page').replace('{i}', pageIdx+1).replace('{n}', total) : '');
  if(sub) ctx.fillText(sub, pad, pad + Math.round(W*0.062));
  const top = pad + Math.round(W*(sub ? 0.11 : 0.085));
  // Pie: WhatsApp / link.
  const footH = Math.round(W*0.06);
  const foot = catalogWhatsApp ? `${t('tpl_menu_footer')} · +${String(catalogWhatsApp).replace(/\D/g,'')}` : (catalogUrl() ? catalogUrl().replace(/^https?:\/\//,'') : '');
  if(foot){ ctx.fillStyle = st.soft; ctx.font = tplFont(st, 600, Math.round(W*0.024)); ctx.textAlign='center'; ctx.fillText(tplFit(ctx, foot, W-pad*2), W/2, H-pad-Math.round(W*0.03)); ctx.textAlign='left'; }
  const bodyH = H - top - pad - footH;
  const isLines = Array.isArray(page) && (kind==='menu' || kind==='cats');
  const items = isLines ? page.filter(l=>l.it).map(l=>l.it) : (Array.isArray(page) ? page : []);
  const imgs = (kind==='grid' || kind==='offer' || kind==='cats') ? await tplImages(items) : new Map();
  if(kind==='grid'){
    const cols = tplFormat==='sheet' ? 4 : 3;
    const rows = Math.ceil(tplCapacity('grid', tplFormat)/cols);
    const gap = Math.round(W*0.022);
    const cw = (W - pad*2 - gap*(cols-1)) / cols;
    const ch = Math.min(cw*1.45, (bodyH - gap*(rows-1)) / rows);
    page.forEach((it, i)=>{
      const x = pad + (i%cols)*(cw+gap), y = top + Math.floor(i/cols)*(ch+gap);
      ctx.fillStyle = st.panel; tplRoundRect(ctx, x, y, cw, ch, Math.round(W*0.02)); ctx.fill();
      // Foto arriba (56%), abajo dos renglones de nombre y el precio con aire
      // entre ambos (verificación 2026-09-07: con 62% la segunda línea del
      // nombre pisaba el precio).
      const ph = ch*0.56; const im = imgs.get(it.id);
      if(im) tplCover(ctx, im, x, y, cw, ph, Math.round(W*0.02));
      else { ctx.fillStyle = st.line; tplRoundRect(ctx, x, y, cw, ph, Math.round(W*0.02)); ctx.fill(); }
      ctx.fillStyle = st.ink; ctx.font = tplFont(st, 700, Math.round(cw*0.085));
      const lines = tplWrap(ctx, it.name, cw - Math.round(W*0.03), 2);
      lines.forEach((ln,k)=>ctx.fillText(ln, x+Math.round(W*0.015), y+ph+Math.round(cw*0.06)+k*Math.round(cw*0.105)));
      ctx.fillStyle = it.price>0 ? st.accent : st.soft; ctx.font = tplFont(st, 800, Math.round(cw*0.1));
      ctx.fillText(tplPriceText(it), x+Math.round(W*0.015), y+ch-Math.round(cw*0.15));
    });
  } else if(kind==='list'){
    const rowH = bodyH / tplCapacity('list', tplFormat);
    const fs = Math.min(Math.round(rowH*0.42), Math.round(W*0.034));
    page.forEach((it, i)=>{
      const y = top + i*rowH;
      ctx.fillStyle = st.line; ctx.fillRect(pad, y+rowH-1, W-pad*2, 1);
      ctx.fillStyle = st.ink; ctx.font = tplFont(st, 600, fs); ctx.textAlign='left';
      const price = tplPriceText(it); ctx.font = tplFont(st, 800, fs); const pw = ctx.measureText(price).width;
      ctx.font = tplFont(st, 600, fs); ctx.fillText(tplFit(ctx, it.name, W-pad*2-pw-Math.round(W*0.03)), pad, y+(rowH-fs)/2);
      ctx.fillStyle = it.price>0 ? st.accent : st.soft; ctx.font = tplFont(st, 800, fs); ctx.textAlign='right'; ctx.fillText(price, W-pad, y+(rowH-fs)/2); ctx.textAlign='left';
    });
  } else if(kind==='menu'){
    const rowH = bodyH / tplCapacity('menu', tplFormat);
    const fs = Math.min(Math.round(rowH*0.44), Math.round(W*0.034));
    let y = top;
    page.forEach(l=>{
      if(l.h){
        ctx.fillStyle = st.accent; ctx.font = tplFont(st, 800, Math.round(fs*0.8)); ctx.textAlign='left';
        ctx.fillText(String(l.h).toUpperCase(), pad, y+rowH*0.5-fs*0.4);
        ctx.fillStyle = st.line; ctx.fillRect(pad, y+rowH-2, W-pad*2, 2);
      } else {
        const it = l.it; const price = tplPriceText(it);
        ctx.fillStyle = it.price>0 ? st.ink : st.soft; ctx.font = tplFont(st, 800, fs); ctx.textAlign='right'; const pw = ctx.measureText(price).width;
        ctx.fillText(price, W-pad, y+(rowH-fs)/2);
        ctx.fillStyle = st.ink; ctx.font = tplFont(st, 500, fs); ctx.textAlign='left';
        const name = tplFit(ctx, it.name, W-pad*2-pw-Math.round(W*0.06)); ctx.fillText(name, pad, y+(rowH-fs)/2);
        // Puntitos guía entre nombre y precio, el alma de un menú.
        const nx = pad + ctx.measureText(name).width + Math.round(W*0.012), ex = W-pad-pw-Math.round(W*0.012);
        ctx.fillStyle = st.soft; for(let dx=nx; dx<ex; dx+=Math.round(fs*0.45)) ctx.fillRect(dx, y+rowH*0.5+fs*0.28, 2, 2);
      }
      y += rowH;
    });
  } else if(kind==='cats'){
    // Banda de color a la izquierda bajo el encabezado, tarjetas claras con la
    // foto redonda asomando por el borde izquierdo y la flecha a la derecha.
    const band = Math.round(W*0.2);
    // La banda arranca DEBAJO del encabezado (verificación 2026-09-07: pisaba el
    // subtítulo "Página 1 de 5").
    ctx.fillStyle = st.accent; ctx.fillRect(0, top - Math.round(pad*0.15), band, H - top + Math.round(pad*0.15));
    const cardX = Math.round(band*0.55), cardW = W - cardX - pad, r = Math.round(W*0.03);
    const rows = page.cover ? page.cats : page; const n = tplCapacity('cats', tplFormat);
    const gap = Math.round(W*0.028); const ch = Math.min((bodyH - gap*(n-1))/n, W*0.19);
    const cardBg = tplStyle==='dark' ? st.panel : '#ffffff';
    // Fotos de las categorías de la portada (las de los productos ya están en imgs).
    const coverImgs = new Map();
    if(page.cover) await Promise.all(page.cats.map(async (c,i)=>{ if(c.photo){ try{ coverImgs.set(i, await loadB64Image(c.photo)); }catch(e){} } }));
    rows.forEach((row, i)=>{
      const y = top + i*(ch+gap);
      if(!page.cover && row.h){
        ctx.fillStyle = st.accent; ctx.font = tplFont(st, 800, Math.round(ch*0.26)); ctx.textAlign='left';
        // El rótulo de la categoría va a la DERECHA de la banda (no encima).
        ctx.fillText(String(row.h).toUpperCase(), band + Math.round(W*0.03), y + ch*0.5 - Math.round(ch*0.13));
        return;
      }
      const name = page.cover ? row.name : row.it.name;
      const sub = page.cover ? t('tpl_items_n').replace('{n}', row.count) : tplPriceText(row.it);
      const im = page.cover ? coverImgs.get(i) : imgs.get(row.it.id);
      ctx.save(); ctx.shadowColor='rgba(0,0,0,0.16)'; ctx.shadowBlur=Math.round(W*0.02); ctx.shadowOffsetY=Math.round(W*0.005);
      ctx.fillStyle = cardBg; tplRoundRect(ctx, cardX, y, cardW, ch, r); ctx.fill(); ctx.restore();
      const d = Math.round(ch*0.82), px = cardX - Math.round(d*0.38), py = y + Math.round((ch-d)/2);
      if(im){ ctx.save(); ctx.shadowColor='rgba(0,0,0,0.22)'; ctx.shadowBlur=Math.round(W*0.015); ctx.beginPath(); ctx.arc(px+d/2, py+d/2, d/2, 0, Math.PI*2); ctx.closePath(); ctx.fillStyle=cardBg; ctx.fill(); ctx.restore();
        ctx.save(); ctx.beginPath(); ctx.arc(px+d/2, py+d/2, d/2 - Math.round(W*0.004), 0, Math.PI*2); ctx.closePath(); ctx.clip();
        const s = Math.max(d/im.naturalWidth, d/im.naturalHeight); ctx.drawImage(im, px+d/2-im.naturalWidth*s/2, py+d/2-im.naturalHeight*s/2, im.naturalWidth*s, im.naturalHeight*s); ctx.restore(); }
      else { ctx.fillStyle = st.line; ctx.beginPath(); ctx.arc(px+d/2, py+d/2, d/2, 0, Math.PI*2); ctx.fill(); }
      const tx = px + d + Math.round(W*0.03), maxW = cardW - (tx - cardX) - Math.round(ch*0.9);
      ctx.fillStyle = tplStyle==='dark' ? st.ink : '#1f2a44'; ctx.font = tplFont(st, 800, Math.round(ch*0.27)); ctx.textAlign='left';
      ctx.fillText(tplFit(ctx, name, maxW), tx, y + Math.round(ch*0.2));
      ctx.fillStyle = (!page.cover && !(row.it.price>0)) ? st.soft : (page.cover ? st.soft : st.accent); ctx.font = tplFont(st, page.cover ? 500 : 800, Math.round(ch*0.19));
      ctx.fillText(sub, tx, y + Math.round(ch*0.56));
      // Flecha en círculo, pegada al borde derecho de la tarjeta.
      const cr = Math.round(ch*0.24), cx = cardX + cardW - Math.round(cr*0.6), cy = y + ch/2;
      ctx.save(); ctx.shadowColor='rgba(0,0,0,0.16)'; ctx.shadowBlur=Math.round(W*0.012); ctx.fillStyle=cardBg; ctx.beginPath(); ctx.arc(cx, cy, cr, 0, Math.PI*2); ctx.fill(); ctx.restore();
      ctx.strokeStyle = st.accent; ctx.lineWidth = Math.max(2, Math.round(W*0.004)); ctx.lineCap='round'; ctx.beginPath(); ctx.moveTo(cx-cr*0.18, cy-cr*0.32); ctx.lineTo(cx+cr*0.16, cy); ctx.lineTo(cx-cr*0.18, cy+cr*0.32); ctx.stroke();
    });
  } else if(kind==='offer'){
    const it = page[0]; const im = imgs.get(it.id);
    const ph = Math.round(bodyH*0.6);
    if(im) tplCover(ctx, im, pad, top, W-pad*2, ph, Math.round(W*0.03)); else { ctx.fillStyle=st.panel; tplRoundRect(ctx,pad,top,W-pad*2,ph,Math.round(W*0.03)); ctx.fill(); }
    // Etiqueta OFERTA
    ctx.fillStyle = st.accent; tplRoundRect(ctx, pad+Math.round(W*0.03), top+Math.round(W*0.03), Math.round(W*0.26), Math.round(W*0.075), Math.round(W*0.02)); ctx.fill();
    ctx.fillStyle = st.bg; ctx.font = tplFont(st, 900, Math.round(W*0.036)); ctx.textAlign='center'; ctx.fillText(t('tpl_offer_label'), pad+Math.round(W*0.03)+Math.round(W*0.13), top+Math.round(W*0.03)+Math.round(W*0.019)); ctx.textAlign='left';
    ctx.fillStyle = st.ink; ctx.font = tplFont(st, 800, Math.round(W*0.06));
    const lines = tplWrap(ctx, it.name, W-pad*2, 2); lines.forEach((ln,k)=>ctx.fillText(ln, pad, top+ph+Math.round(W*0.04)+k*Math.round(W*0.072)));
    ctx.fillStyle = st.accent; ctx.font = tplFont(st, 900, Math.round(W*0.12));
    ctx.fillText(tplPriceText(it), pad, top+ph+Math.round(W*0.04)+lines.length*Math.round(W*0.072)+Math.round(W*0.02));
  }
  return cv;
}
async function refreshTemplatePreview(){
  const req = ++tplReq; tplRendering = true;
  try{
    const pages = tplPages();
    if(pages.length===0){ tplPreviewUrl=null; tplRendering=false; return; }
    if(tplPage>=pages.length) tplPage = pages.length-1;
    const cv = await composeTemplatePage(pages[tplPage], tplPage, pages.length);
    if(req!==tplReq || !showTemplateModal) return;
    tplPreviewUrl = cv.toDataURL('image/jpeg', 0.86);
  }catch(e){ tplPreviewUrl=null; }
  if(req!==tplReq) return;
  tplRendering = false;
  const img = document.getElementById('tpl-preview');
  if(img && tplPreviewUrl){ img.src = tplPreviewUrl; img.style.opacity='1'; const sp=document.getElementById('tpl-spinner'); if(sp) sp.hidden=true; }
  else render();
}
async function templatePageFiles(){
  const pages = tplPages(); const files = [];
  for(let i=0;i<pages.length;i++){
    const cv = await composeTemplatePage(pages[i], i, pages.length);
    const blob = await new Promise(res=>cv.toBlob(res, 'image/jpeg', 0.92));
    const base = (businessName || 'dusty').replace(/[^\w\- ]+/g,'').trim().slice(0,30) || 'dusty';
    files.push(new File([blob], `${base}-${t('tpl_kind_'+tplKind).toLowerCase().replace(/\s+/g,'-')}${pages.length>1?'-'+(i+1):''}.jpg`, {type:'image/jpeg'}));
  }
  return files;
}
/* GALERÍA de miniaturas (pedido del usuario 2026-09-07: "que se vean las maquetas
   para que el cliente vea cómo va a quedar"): cada diseño se dibuja de verdad
   con los productos del usuario, en chico, y se elige tocando la miniatura.
   Se re-dibujan al cambiar formato, estilo o alcance (la clave lo resume). */
const TPL_KINDS = ['cats','grid','menu','list','offer'];
let tplThumbs = {};       // {kind: dataURL} para la clave actual
let tplThumbsKey = '';
let tplThumbsReq = 0;
async function refreshTemplateThumbs(){
  const key = tplFormat+'|'+tplStyle+'|'+tplScope+'|'+(tplOfferId||'')+'|'+templateItems().length;
  if(tplThumbsKey===key && Object.keys(tplThumbs).length===TPL_KINDS.length) return;
  const req = ++tplThumbsReq;
  tplThumbsKey = key; tplThumbs = {};
  for(const k of TPL_KINDS){
    try{
      const pages = tplPages(k);
      if(pages.length===0) continue;
      const cv = await composeTemplatePage(pages[0], 0, pages.length, k);
      if(req!==tplThumbsReq) return;
      const tw = 240, th = Math.round(tw*cv.height/cv.width);
      const sm = document.createElement('canvas'); sm.width=tw; sm.height=th;
      const c2 = sm.getContext('2d'); c2.imageSmoothingEnabled=true; c2.imageSmoothingQuality='high'; c2.drawImage(cv,0,0,tw,th);
      tplThumbs[k] = sm.toDataURL('image/jpeg', 0.8);
      // La miniatura entra en su tarjeta sin re-render (no pisar los chips).
      const img = document.querySelector('[data-tpl-card="'+k+'"] img');
      if(img){ img.src = tplThumbs[k]; img.style.opacity='1'; const sp=img.parentElement.querySelector('.spinner'); if(sp) sp.remove(); }
    }catch(e){}
  }
}
function templateModal(){
  const items = templateItems();
  const pages = tplPages();
  const [W,H] = TPL_FORMATS[tplFormat];
  const chip = (attr, val, cur, label)=>`<button type="button" class="exit-reason-chip ${cur===val?'on':''}" data-${attr}="${val}" style="font-size:13px;padding:8px 13px;">${label}</button>`;
  return `
  <div class="overlay overlay-fast" id="template-overlay">
    <div class="modal" style="display:flex;flex-direction:column;overflow:hidden;">
      <h3 class="sky" style="flex-shrink:0;">${t('tpl_title')}</h3>
      <div class="sub" style="flex-shrink:0;margin-bottom:10px;">${t('tpl_sub')}</div>
      <div style="flex:1;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;">
        ${/* Galería: cada diseño dibujado en chico con los productos reales. */''}
        <div class="tpl-gallery">
          ${TPL_KINDS.map(k=>`
          <button type="button" class="tpl-card ${tplKind===k?'on':''}" data-tpl-kind="${k}" data-tpl-card="${k}" aria-pressed="${tplKind===k}">
            <span class="tpl-thumb" style="aspect-ratio:${W}/${H};">
              ${tplThumbs[k] ? `<img src="${tplThumbs[k]}" alt="" style="opacity:1;">` : `<img src="" alt="" style="opacity:0;"><div class="spinner"></div>`}
            </span>
            <span class="tpl-card-label">${t('tpl_kind_'+k)}</span>
          </button>`).join('')}
        </div>
        <div class="helper-note" style="margin:6px 0 4px;">${t('tpl_gallery_hint')}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">
          ${['post','story','sheet'].map(f=>chip('tpl-format', f, tplFormat, t('tpl_format_'+f))).join('')}
          <span style="width:8px;"></span>
          ${['dark','light','warm'].map(s=>chip('tpl-style', s, tplStyle, t('tpl_style_'+s))).join('')}
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;align-items:center;">
          ${chip('tpl-scope','catalog',tplScope,t('tpl_scope_catalog'))}${chip('tpl-scope','all',tplScope,t('tpl_scope_all'))}
          ${tplKind==='offer' && items.length>0 ? `<select id="tpl-offer-select" style="flex:1;min-width:120px;">${items.map(i=>`<option value="${escapeHtml(i.id)}" ${(tplOfferId||items[0].id)===i.id?'selected':''}>${escapeHtml(i.name)}</option>`).join('')}</select>` : ''}
        </div>
        ${pages.length===0 ? `<div class="helper-note" style="margin-top:12px;">${t('tpl_empty')}</div>` : `
        <div style="position:relative;margin:12px auto 0;width:100%;max-width:${tplFormat==='story'?'52%':tplFormat==='sheet'?'70%':'88%'};aspect-ratio:${W}/${H};background:#151515;border-radius:10px;overflow:hidden;box-shadow:var(--shadow);">
          <img id="tpl-preview" src="${tplPreviewUrl||''}" alt="" style="width:100%;height:100%;display:block;object-fit:contain;opacity:${tplPreviewUrl?1:0};transition:opacity .2s;">
          <div id="tpl-spinner" ${tplPreviewUrl&&!tplRendering?'hidden':''} style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:8px;color:#fff;font-size:13px;font-weight:700;"><div class="spinner"></div> ${t('tpl_rendering')}</div>
        </div>
        ${pages.length>1 ? `
        <div style="display:flex;align-items:center;justify-content:center;gap:14px;margin-top:8px;">
          <button type="button" class="btn btn-ghost btn-sm" id="tpl-prev" ${tplPage===0?'disabled':''}>‹</button>
          <span style="font-size:13px;font-weight:700;color:var(--ink-soft);">${t('tpl_page').replace('{i}', tplPage+1).replace('{n}', pages.length)}</span>
          <button type="button" class="btn btn-ghost btn-sm" id="tpl-next" ${tplPage>=pages.length-1?'disabled':''}>›</button>
        </div>` : ''}`}
      </div>
      <div class="modal-actions" style="flex-shrink:0;">
        <button class="btn btn-ghost" id="btn-close-template">${t('btn_close')}</button>
        <button class="btn btn-ghost" id="btn-save-template" ${pages.length===0?'disabled':''}>${t('tpl_save')}</button>
        <button class="btn btn-primary" id="btn-share-template" ${pages.length===0?'disabled':''}>${t('tpl_share')}</button>
      </div>
    </div>
  </div>`;
}
let showCollageLayoutModal = false;
let collageImgsCache = []; // elementos Image — viven acá, no en estado serializable
let collageChosenLayout = null; // el diseño elegido ANTES de elegir las fotos
const COLLAGE_LAYOUTS = { 2:['v2','h2','pin2'], 3:['bigL3','cols3','pin3'], 4:['grid4','bigT4','pin4'] };
function collageLayoutCount(id){
  for(const n of [2,3,4]) if(COLLAGE_LAYOUTS[n].indexOf(id)!==-1) return n;
  return 2;
}
function collagePreviewSvg(id){
  const r=(x,y,w,h,rot)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="none" stroke="currentColor" stroke-width="2.4" ${rot?`transform="rotate(${rot} ${x+w/2} ${y+h/2})"`:''}/>`;
  const map={
    v2:r(4,4,27,52)+r(35,4,27,52),
    h2:r(4,4,58,25)+r(4,31,58,25),
    pin2:r(8,8,34,34,-8)+r(28,22,26,26,9),
    bigL3:r(4,4,27,52)+r(35,4,27,25)+r(35,31,27,25),
    cols3:r(4,4,17,52)+r(24,4,17,52)+r(44,4,17,52),
    pin3:r(6,6,26,26,-7)+r(34,8,24,24,6)+r(18,30,28,24,-3),
    grid4:r(4,4,27,25)+r(35,4,27,25)+r(4,31,27,25)+r(35,31,27,25),
    bigT4:r(4,4,58,30)+r(4,38,16,18)+r(24,38,16,18)+r(44,38,16,18),
    pin4:r(6,6,24,22,-6)+r(34,6,24,22,7)+r(6,32,24,22,5)+r(34,32,24,22,-7)
  };
  return `<svg viewBox="0 0 66 60" width="72" height="66" style="color:var(--ink);">${map[id]||''}</svg>`;
}
function collageLayoutModal(){
  // DISEÑO PRIMERO (pedido del usuario 2026-09-06: al tocar Collage saltaba el
  // selector de archivos — debía salir el menú de diseños): se muestran TODOS
  // los layouts agrupados por cantidad de fotos; elegir uno abre las fotos.
  return `
  <div class="overlay overlay-fast" id="collage-layout-overlay">
    <div class="modal">
      <h3 class="sky">${t('catalog_collage_pick')}</h3>
      ${[2,3,4].map(n=>`
      <div style="font-size:12.5px;font-weight:800;color:var(--ink-soft);margin:14px 2px 8px;">${n} ${t('catalog_collage_photos')}</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        ${COLLAGE_LAYOUTS[n].map(id=>`
        <button type="button" data-collage-layout="${id}" style="background:var(--raised);border:1px solid var(--line);border-radius:14px;padding:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:transform .15s;">${collagePreviewSvg(id)}</button>`).join('')}
      </div>`).join('')}
      <div class="modal-actions">
        <button class="btn btn-ghost" id="btn-cancel-collage" style="width:100%;">${t('btn_cancel')}</button>
      </div>
    </div>
  </div>`;
}
async function composeCollageLayout(layoutId){
  const imgs = collageImgsCache;
  const S = 1600, gap = 8;
  const cv = document.createElement('canvas'); cv.width = cv.height = S;
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  const cell = (im,x,y,w,h)=>{
    const s = Math.max(w/im.naturalWidth, h/im.naturalHeight);
    const dw = im.naturalWidth*s, dh = im.naturalHeight*s;
    ctx.save(); ctx.beginPath(); ctx.rect(x,y,w,h); ctx.clip();
    ctx.drawImage(im, x+(w-dw)/2, y+(h-dh)/2, dw, dh);
    ctx.restore();
  };
  // Tarjeta polaroid: marco blanco, rotación y sombra — el alma del Pinboard.
  const card = (im,cx,cy,w,h,rot)=>{
    const pad = S*0.018;
    ctx.save();
    ctx.translate(cx,cy); ctx.rotate(rot*Math.PI/180);
    ctx.shadowColor='rgba(0,0,0,0.30)'; ctx.shadowBlur=S*0.02; ctx.shadowOffsetY=S*0.008;
    ctx.fillStyle='#ffffff';
    ctx.fillRect(-w/2-pad, -h/2-pad, w+pad*2, h+pad*2);
    ctx.shadowColor='transparent';
    const s = Math.max(w/im.naturalWidth, h/im.naturalHeight);
    const dw = im.naturalWidth*s, dh = im.naturalHeight*s;
    ctx.beginPath(); ctx.rect(-w/2,-h/2,w,h); ctx.clip();
    ctx.drawImage(im, -dw/2, -dh/2, dw, dh);
    ctx.restore();
  };
  if(layoutId.indexOf('pin')===0){
    const g = ctx.createRadialGradient(S/2,S*0.35,S*0.1,S/2,S*0.6,S);
    g.addColorStop(0,'#f4f4f5'); g.addColorStop(1,'#d8d8db');
    ctx.fillStyle=g; ctx.fillRect(0,0,S,S);
  } else { ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,S,S); }
  const half=(S-gap)/2, third=(S-2*gap)/3;
  if(layoutId==='v2'){ cell(imgs[0],0,0,half,S); cell(imgs[1],half+gap,0,half,S); }
  else if(layoutId==='h2'){ cell(imgs[0],0,0,S,half); cell(imgs[1],0,half+gap,S,half); }
  else if(layoutId==='pin2'){ card(imgs[0],S*0.42,S*0.42,S*0.52,S*0.52,-6); card(imgs[1],S*0.68,S*0.68,S*0.40,S*0.40,8); }
  else if(layoutId==='bigL3'){ cell(imgs[0],0,0,half,S); cell(imgs[1],half+gap,0,half,half); cell(imgs[2],half+gap,half+gap,half,half); }
  else if(layoutId==='cols3'){ cell(imgs[0],0,0,third,S); cell(imgs[1],third+gap,0,third,S); cell(imgs[2],2*(third+gap),0,third,S); }
  else if(layoutId==='pin3'){ card(imgs[0],S*0.32,S*0.32,S*0.40,S*0.40,-7); card(imgs[1],S*0.72,S*0.30,S*0.36,S*0.36,6); card(imgs[2],S*0.52,S*0.72,S*0.44,S*0.38,-3); }
  else if(layoutId==='grid4'){ cell(imgs[0],0,0,half,half); cell(imgs[1],half+gap,0,half,half); cell(imgs[2],0,half+gap,half,half); cell(imgs[3],half+gap,half+gap,half,half); }
  else if(layoutId==='bigT4'){ const y2=S*0.58+gap, h2=S-y2; cell(imgs[0],0,0,S,S*0.58); cell(imgs[1],0,y2,third,h2); cell(imgs[2],third+gap,y2,third,h2); cell(imgs[3],2*(third+gap),y2,third,h2); }
  else if(layoutId==='pin4'){ card(imgs[0],S*0.30,S*0.28,S*0.36,S*0.32,-6); card(imgs[1],S*0.72,S*0.28,S*0.36,S*0.32,7); card(imgs[2],S*0.30,S*0.72,S*0.36,S*0.32,5); card(imgs[3],S*0.72,S*0.72,S*0.36,S*0.32,-7); }
  else { cell(imgs[0],0,0,half,S); if(imgs[1]) cell(imgs[1],half+gap,0,half,S); }
  return {base64: cv.toDataURL('image/jpeg',0.9).split(',')[1], mediaType:'image/jpeg'};
}

/* Modal de PUBLICACIÓN (abre la herramienta Compartir de la tarjeta): WhatsApp,
   publicar/actualizar, y con link ya publicado las acciones de compartirlo. */
// Cerrar Publicación vuelve a Ajustes si se abrió desde ahí (auditoría de
// Ajustes 2026-09-07: era el único hijo que no volvía); desde Compartir del
// Catálogo, settingsReturnPending es false y no pasa nada extra.
function closeCatalogPublishModal(){ showCatalogPublishModal=false; reopenSettingsIfPending(); render(); }
function catalogPublishModal(){
  const url = catalogUrl();
  return `
  <div class="overlay overlay-fast" id="catalog-publish-overlay">
    <div class="modal">
      <h3 class="sky">${t('catalog_publish_header')}</h3>
      <div class="field" style="margin-top:10px;">
        <label>${t('catalog_wa_label')}</label>
        <input id="catalog-wa-input" type="tel" inputmode="numeric" placeholder="5215512345678" value="${escapeHtml(catalogWhatsApp)}">
      </div>
      ${/* Canales de pedido a elección del dueño (SMS/llamadas usan el mismo
           número) + sus redes — el cliente ve TODOS los habilitados. */''}
      <div style="margin-top:10px;">
        <label style="display:block;font-size:12px;font-weight:600;color:var(--ink-soft);margin-bottom:6px;">${t('catalog_channels_label')}</label>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button type="button" class="exit-reason-chip on" disabled style="opacity:.8;">💬 WhatsApp</button>
          <button type="button" class="exit-reason-chip ${catalogChannels.sms?'on':''}" data-cat-channel="sms">✉️ ${t('catalog_ch_sms')}</button>
          <button type="button" class="exit-reason-chip ${catalogChannels.call?'on':''}" data-cat-channel="call">📞 ${t('catalog_ch_call')}</button>
        </div>
      </div>
      <div style="margin-top:12px;">
        <label style="display:block;font-size:12px;font-weight:600;color:var(--ink-soft);margin-bottom:6px;">${t('catalog_socials_label')}</label>
        <div style="display:flex;flex-direction:column;gap:8px;">
          <input data-cat-social="instagram" type="text" placeholder="Instagram: ${t('catalog_social_ph')}" value="${escapeHtml(catalogChannels.instagram||'')}">
          <input data-cat-social="facebook" type="text" placeholder="Facebook: ${t('catalog_social_ph')}" value="${escapeHtml(catalogChannels.facebook||'')}">
          <input data-cat-social="tiktok" type="text" placeholder="TikTok: ${t('catalog_social_ph')}" value="${escapeHtml(catalogChannels.tiktok||'')}">
        </div>
      </div>
      <button class="btn btn-primary" id="btn-publish-catalog" style="width:100%;margin-top:14px;" ${catalogPublishing?'disabled':''}>${catalogPublishing ? t('catalog_publishing') : t(catalogId ? 'catalog_update_btn' : 'catalog_publish_btn')}</button>
      ${url ? `
      <div style="display:flex;gap:8px;margin-top:12px;">
        <button type="button" class="btn btn-ghost btn-sm" id="btn-copy-catalog-link" style="flex:1;">${t('catalog_copy_btn')}</button>
        <button type="button" class="btn btn-ghost btn-sm" id="btn-share-catalog-link" style="flex:1;">${t('catalog_share_btn')}</button>
        <a class="btn btn-ghost btn-sm" href="${escapeHtml(url)}" target="_blank" rel="noopener" style="flex:1;text-align:center;">${t('catalog_open_btn')}</a>
      </div>
      <div style="text-align:center;margin-top:10px;">
        <button type="button" class="link-btn" id="btn-unpublish-catalog" style="color:var(--tomato);padding:4px 8px;">${t('catalog_unpublish_btn')}</button>
      </div>` : ''}
      <div class="modal-actions">
        <button class="btn btn-ghost" id="btn-close-catalog-publish" style="width:100%;">${t('btn_close')}</button>
      </div>
    </div>
  </div>`;
}
/* Foto recién sacada con la cámara del Catálogo: modalcito que pregunta a qué
   producto/pieza pertenece — la vista previa arriba, la lista tocable abajo. */
function catalogAssignModal(){
  const src = catalogPendingPhoto ? cachedPhotoUrl(catalogPendingPhoto.base64, catalogPendingPhoto.mediaType) : null;
  const row = (kind, obj)=>{
    const thumb = catalogPhotoThumbSrc(obj.photo);
    return `
    <div data-assign-photo="${kind}:${obj.id}" role="button" tabindex="0" style="display:flex;align-items:center;gap:10px;padding:8px 2px;border-bottom:1px solid var(--line);cursor:pointer;">
      <span class="stock-icon-ring" style="width:34px;height:34px;flex-shrink:0;overflow:hidden;">${thumb?`<img src="${escapeHtml(thumb)}" alt="" style="width:100%;height:100%;object-fit:cover;">`:lineIcon('tag',14)}</span>
      <span style="flex:1;min-width:0;font-size:13.5px;font-weight:600;overflow-wrap:anywhere;">${escapeHtml(obj.name)}</span>
      <span style="color:var(--ink-soft);">›</span>
    </div>`;
  };
  return `
  ${/* UN solo scroll (verificación 2026-09-07): antes la lista tenía su propio
       scroll de 40vh ADENTRO de un modal que también scrolleaba (770px de
       contenido en 713 de alto) — el dedo caía en dos regiones distintas y el
       Cancelar quedaba escondido abajo. Ahora el modal es una columna flex a
       88vh: foto, chips y sugerencia fijos arriba, la lista toma lo que queda
       y es lo ÚNICO que scrollea, y Cancelar siempre a la vista. */''}
  <div class="overlay overlay-fast" id="catalog-assign-overlay">
    <div class="modal" style="display:flex;flex-direction:column;overflow:hidden;">
      <h3 class="sky" style="flex-shrink:0;">${t('catalog_assign_title')}</h3>
      ${/* Vista previa ENTERA (contain sobre fondo oscuro — auditoría 2026-09-07):
           con cover una foto 4:3 se veía recortada y el usuario no sabía cómo
           iba a quedar. */''}
      ${src ? `<div style="width:100%;height:200px;background:#151515;border-radius:12px;overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center;"><img src="${escapeHtml(src)}" alt="" style="max-width:100%;max-height:100%;object-fit:contain;display:block;"></div>` : ''}
      ${/* Filtros (los 4 más usados + original): recalculan desde el original y
           la vista previa de arriba muestra el resultado al instante. */''}
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;flex-shrink:0;">
        ${catalogEditFull ? `<button type="button" class="exit-reason-chip" id="btn-open-photo-editor" style="font-weight:800;">✂️ ${t('catalog_edit_btn')}</button>` : ''}
        ${['original','vivid','warm','retro','bw'].map(k=>`<button type="button" class="exit-reason-chip ${catalogPendingFilter===k?'on':''}" data-photo-filter="${k}">${t('catalog_filter_'+k)}</button>`).join('')}
      </div>
      ${/* Reconocer con IA: se dice que usa 1 escaneo y se puede apagar (antes
           gastaba el cupo en silencio, auditoría 2026-09-07). */''}
      ${(currentUser && !currentUser.isAnonymous) ? `
      <div class="catalog-suggest-row">
        <span>✨ ${t('catalog_suggest_toggle')} <small>(${t('catalog_suggest_cost')})</small></span>
        <label class="pulse-switch" aria-label="${t('catalog_suggest_toggle')}"><input type="checkbox" id="catalog-suggest-toggle" ${catalogSuggestOn?'checked':''}><i></i></label>
      </div>` : ''}
      ${catalogAssignDetecting ? `<div class="scan-status" style="margin-top:10px;flex-shrink:0;"><div class="spinner"></div> ${t('catalog_detecting')} <small style="color:var(--ink-soft);">(${t('catalog_suggest_cost')})</small></div>` : ''}
      ${(()=>{
        if(!catalogAssignSuggestion) return '';
        const s = catalogAssignSuggestion;
        const obj = s.kind==='item' ? inventory.find(i=>i.id===s.id) : recipes.find(r=>r && r.id===s.id);
        if(!obj) return '';
        return `
      <div style="margin-top:10px;background:var(--sky-soft);border-radius:10px;padding:4px 10px 2px;flex-shrink:0;">
        <div style="font-size:11px;font-weight:800;color:var(--sky-ink);padding-top:4px;">✨ ${t('catalog_suggested')}</div>
        ${row(s.kind, obj)}
      </div>`;
      })()}
      ${/* BUSCADOR (auditoría 2026-09-07): con 80 productos la lista era un scroll
           largo. Filtra en vivo sin re-render (app-07). Sin autofocus, regla de
           la casa: el teclado lo abre el usuario. Y si nada coincide, la fila
           "Crear «texto» con esta foto" — antes había que cancelar, ir a
           Inventario, crear el producto y volver. */''}
      <input id="catalog-assign-search" type="search" placeholder="${t('catalog_assign_search_ph')}" autocomplete="off" style="margin-top:10px;flex-shrink:0;">
      <div id="catalog-assign-create" data-assign-create="1" role="button" tabindex="0" hidden style="display:none;align-items:center;gap:10px;padding:9px 2px;border-bottom:1px solid var(--line);cursor:pointer;flex-shrink:0;">
        <span class="stock-icon-ring" style="width:34px;height:34px;flex-shrink:0;background:var(--basil);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;">+</span>
        <span id="catalog-assign-create-label" style="flex:1;min-width:0;font-size:13.5px;font-weight:800;color:var(--basil-ink);overflow-wrap:anywhere;"></span>
      </div>
      <div id="catalog-assign-list" style="flex:1;min-height:96px;overflow-y:auto;margin-top:6px;-webkit-overflow-scrolling:touch;">
        ${inventory.filter(i=>i && !isExpenseItem(i)).map(i=>row('item', i)).join('')}
        ${recipes.filter(r=>r && r.id).map(r=>row('recipe', r)).join('')}
        <div id="catalog-assign-empty" hidden class="helper-note" style="margin-top:10px;">${t('catalog_assign_no_match')} · ${t('catalog_assign_create_hint')}</div>
      </div>
      <div class="modal-actions" style="flex-shrink:0;">
        <button class="btn btn-ghost" id="btn-cancel-assign-photo" style="width:100%;">${t('btn_cancel')}</button>
      </div>
    </div>
  </div>`;
}
/* SÚPER CALIDAD (caso del usuario 2026-09-06: un restaurante necesita imágenes
   de calidad en su catálogo): tras asignar, se hornea la MISMA edición+filtro a
   1200px y se sube en segundo plano (upload-catalog-photo) — el ítem guarda solo
   la URL (photoHiUrl) y publish-catalog la prefiere sobre el thumbnail de 300px.
   Si falla, silencio: el catálogo usa la normal como siempre. */
async function uploadCatalogHiRes(target, kind, fullSrc, editSrc, filterKey, forPhoto){
  try{
    if(!fullSrc || !currentUser || currentUser.isAnonymous) return;
    // Si el usuario NO tocó el encuadre ni los ajustes, la alta conserva la
    // FORMA ORIGINAL de la foto (el horneado siempre recorta al cuadrado — eso
    // perdía la imagen completa; pedido del usuario 2026-09-06 de poder verla
    // entera). El cuadrado queda solo cuando el encuadre fue una decisión.
    const e = editSrc || {};
    // Con formato "Original" y sin tocar nada, la alta es la foto tal cual
    // (sin recorte). Con 1:1 o 4:5 el formato ya es una decisión: se hornea.
    const untouched = !e.auto && !e.bright && !e.contrast && !e.sat && !e.sharp
      && !e.temp && !e.shadows && !e.highlights && !(Number(e.tilt)||0)
      && (e.zoom||1)===1 && ((e.rot||0)%360)===0
      && (e.ratio==='orig' || e.ratio===undefined)
      && Math.abs((e.offX!==undefined?e.offX:0.5)-0.5)<0.001
      && Math.abs((e.offY!==undefined?e.offY:0.5)-0.5)<0.001;
    let hi;
    if(untouched){
      const im = await loadB64Image(fullSrc);
      hi = resizeToBase64(im, 1440, 0.85);
    } else {
      hi = await bakeCatalogEdit(1440, true, fullSrc, editSrc);
    }
    if(filterKey && filterKey!=='original') hi = await applyCatalogFilter(hi, filterKey);
    // Miniatura de 480px para la GRILLA pública (auditoría 2026-09-07): se
    // deriva de la alta ya terminada, así lleva la misma edición y filtro.
    let thumbB64 = null;
    try{ const him = await loadB64Image(hi); thumbB64 = resizeToBase64(him, 480, 0.8).base64; }catch(err){}

    const res = await callDustyAI('/.netlify/functions/upload-catalog-photo', {
      imageBase64: hi.base64, mediaType: 'image/jpeg', thumbBase64: thumbB64 || undefined,
      itemId: (kind==='recipe' ? 'r-' : 'i-') + target.id
    }, {notFoundKey:'err_function_not_found', genericKey:'err_img_process'});
    if(res && res.url){
      // Si mientras subía el usuario tocó "Deshacer" (o puso otra foto), la alta
      // ya no corresponde a lo que el ítem muestra: no se pisa.
      if(forPhoto && target.photo !== forPhoto) return;
      target.photoHiUrl = res.url;
      if(res.thumbUrl) target.photoThumbUrl = res.thumbUrl; else delete target.photoThumbUrl;
      saveState();
      // La alta llegó DESPUÉS de la auto-publicación del asignado: se agenda
      // otra para que el catálogo público apunte a la versión nítida.
      scheduleCatalogAutoPublish();
    }
  }catch(err){
    console.warn('[Dusty] la foto en alta no se pudo subir (el catálogo usará la normal):', err.message || err);
  }
}

/* El editor en sí: preview cuadrado arrastrable (encuadre), Auto y Girar como
   chips, y los deslizadores. Brillo/contraste/saturación tienen vista previa
   INSTANTÁNEA vía CSS filter mientras arrastrás (el horneado real corre al
   soltar); zoom y nitidez se hornean al soltar. */
function catalogEditorModal(){
  const e = catalogEdit;
  // Fila de deslizador con su VALOR a la derecha (se actualiza en vivo desde
  // app-07 sin re-render) — el detalle que separa un panel casero de uno pro.
  // Tipografías a tamaño de dedo (pedido del usuario 2026-09-06: "las letras
  // están pequeñas") y feedback dinámico: el valor se enciende en celeste cuando
  // el ajuste está activo (≠ del punto neutro) — app-07 lo acompaña en vivo.
  const slider = (key, label, min, max, val)=>{
    const active = key==='zoom' ? val!==100 : val!==0;
    return `
    <div style="display:flex;align-items:center;gap:12px;margin-top:14px;">
      <span style="font-size:14px;font-weight:700;color:var(--ink);width:104px;flex-shrink:0;">${label}</span>
      <input type="range" data-edit-slider="${key}" min="${min}" max="${max}" step="1" value="${val}" style="flex:1;accent-color:var(--sky);height:30px;">
      <span data-edit-val="${key}" data-edit-neutral="${key==='zoom'?100:0}" style="width:40px;text-align:right;font-size:14px;font-weight:800;color:${active?'var(--sky-ink)':'var(--ink-soft)'};font-variant-numeric:tabular-nums;flex-shrink:0;transition:color .15s;">${val}</span>
    </div>`;
  };
  // Ícono ARRIBA y palabra abajo, siempre (verificación 2026-09-07): con
  // "☀️ Luz" en una línea, "Color" y "Encuadre" no entraban en su cuarto de
  // ancho y se partían en dos renglones mientras Luz y PRO quedaban en uno —
  // cuatro pestañas de cuatro formas distintas. En columna las cuatro miden
  // lo mismo y ninguna palabra se corta.
  const tab = (key, icon, label)=>`
    <button type="button" data-edit-tab="${key}" style="flex:1;min-width:0;border:none;cursor:pointer;padding:8px 2px 7px;border-radius:9px;display:flex;flex-direction:column;align-items:center;gap:3px;font-size:12px;font-weight:800;letter-spacing:.01em;white-space:nowrap;transition:background .18s, transform .18s, box-shadow .18s;background:${catalogEditTab===key?'var(--raised)':'transparent'};color:${catalogEditTab===key?'var(--ink)':'var(--ink-soft)'};${catalogEditTab===key?'transform:scale(1.04);box-shadow:var(--shadow);':''}"><span style="font-size:17px;line-height:1;">${icon}</span><span>${label}</span></button>`;
  // Formato del lienzo de la vista previa = el del recorte (1:1, 4:5 u
  // original); el alto se limita para que los deslizadores queden a la vista.
  const asp = e.ratio==='4:5' ? 0.8 : e.ratio==='orig' ? (catalogEditSrcAspect||1) : 1;
  const anyEdit = ['bright','contrast','sat','sharp','temp','shadows','highlights','tilt'].some(k=>Number(e[k])) || e.auto || e.zoom!==1 || (e.rot%360)!==0 || Math.abs(e.offX-0.5)>0.001 || Math.abs(e.offY-0.5)>0.001;
  return `
  ${/* PANTALLA COMPLETA (auditoría 2026-09-07, como Snapseed/Lightroom): antes
       era un modal donde la foto ocupaba el 37% del alto. */''}
  <div class="overlay overlay-fast overlay-full" id="catalog-editor-overlay" role="dialog" aria-modal="true" aria-label="${t('catalog_edit_title')}">
    <div class="modal" style="display:flex;flex-direction:column;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-shrink:0;margin-bottom:8px;">
        <h3 class="sky" style="margin:0;">${t('catalog_edit_title')}</h3>
        <button type="button" class="link-btn" id="btn-edit-reset" ${anyEdit?'':'disabled'} style="padding:6px 8px;font-weight:800;opacity:${anyEdit?1:.45};">↺ ${t('catalog_edit_reset')}</button>
      </div>
      <div id="catalog-edit-wrap" style="position:relative;width:100%;max-width:calc(52vh * ${asp});aspect-ratio:${asp};margin:0 auto;background:#151515;border-radius:12px;overflow:hidden;touch-action:none;cursor:grab;flex-shrink:0;">
        ${/* transition SOLO en filter (dinámica suave al mover brillo/etc); la
             transform queda sin transición — el arrastre del encuadre debe
             seguir al dedo sin lag. */''}
        ${catalogEditPreviewUrl ? `<img id="catalog-edit-preview" src="${catalogEditPreviewUrl}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;pointer-events:none;filter:${cssFilterForEdit()};will-change:transform,filter;transition:filter .15s ease;">` : ''}
        ${/* Antes/después: presión larga sobre la foto muestra la base sin
             ajustes (app-07 pone .cat-edit-compare y este badge). */''}
        <img id="catalog-edit-original" alt="" hidden style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none;z-index:2;">
        <span id="catalog-edit-badge" class="cat-edit-badge" hidden>${t('catalog_edit_original_badge')}</span>
        ${catalogEditGuide ? `<div class="cat-edit-guide"></div>` : ''}
        ${catalogEditBaking ? `<div style="position:absolute;bottom:8px;right:8px;"><div class="spinner"></div></div>` : ''}
      </div>
      <div class="helper-note" style="margin:6px 0 0;font-size:12px;text-align:center;flex-shrink:0;">${t('catalog_edit_compare_hint')}</div>
      ${/* Pestañas segmentadas Luz/Color/Encuadre/PRO — cada grupo respira. */''}
      <div style="display:flex;gap:4px;background:var(--inset);border-radius:10px;padding:4px;margin-top:12px;">
        ${tab('light', '☀️', t('catalog_tab_light'))}
        ${tab('color', '🎨', t('catalog_tab_color'))}
        ${tab('frame', '⤢', t('catalog_tab_frame'))}
        ${tab('pro', '✦', 'PRO')}
      </div>
      ${catalogEditTab==='light' ? `
      <div style="margin-top:12px;">
        <button type="button" class="exit-reason-chip ${e.auto?'on':''}" id="btn-edit-auto" style="font-size:14px;padding:9px 16px;">✨ ${t('catalog_edit_auto')}</button>
      </div>
      ${slider('bright', t('catalog_edit_bright'), -50, 50, e.bright)}
      ${slider('contrast', t('catalog_edit_contrast'), -50, 50, e.contrast)}
      ${slider('shadows', t('catalog_edit_shadows'), -50, 50, e.shadows||0)}
      ${slider('highlights', t('catalog_edit_highlights'), -50, 50, e.highlights||0)}` : ''}
      ${catalogEditTab==='color' ? `
      ${slider('temp', t('catalog_edit_temp'), -50, 50, e.temp||0)}
      ${slider('sat', t('catalog_edit_sat'), -50, 50, e.sat)}
      ${slider('sharp', t('catalog_edit_sharp'), 0, 100, e.sharp)}` : ''}
      ${catalogEditTab==='frame' ? `
      <div class="helper-note" style="margin:10px 0 0;font-size:13px;">${t('catalog_edit_drag_hint')}</div>
      ${/* FORMATO del recorte (1:1 catálogo, 4:5 Instagram, Original) + guía del
           85% (Amazon: el producto llena al menos ese cuadro). */''}
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:12px;">
        <span style="font-size:13.5px;font-weight:700;color:var(--ink);">${t('catalog_edit_ratio')}</span>
        ${[['1:1','1:1'],['4:5','4:5'],['orig',t('catalog_edit_ratio_orig')]].map(([k,l])=>`<button type="button" class="exit-reason-chip ${e.ratio===k?'on':''}" data-edit-ratio="${k}" style="font-size:13.5px;padding:8px 14px;">${l}</button>`).join('')}
        <button type="button" class="exit-reason-chip ${catalogEditGuide?'on':''}" id="btn-edit-guide" style="font-size:13.5px;padding:8px 14px;margin-left:auto;">⌗ ${t('catalog_edit_guide')}</button>
      </div>
      ${slider('zoom', t('catalog_edit_zoom'), 100, 300, Math.round(e.zoom*100))}
      ${slider('tilt', t('catalog_edit_tilt'), -15, 15, e.tilt||0)}
      <div style="margin-top:12px;">
        <button type="button" class="exit-reason-chip" id="btn-edit-rotate" style="font-size:14px;padding:9px 16px;">↻ ${t('catalog_edit_rotate')}</button>
      </div>` : ''}
      ${catalogEditTab==='pro' ? `
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">
        <button type="button" class="exit-reason-chip" id="btn-remove-bg" ${catalogRemovingBg?'disabled':''} style="border-color:var(--sky);color:var(--sky-ink);font-weight:800;font-size:14px;padding:9px 14px;">${catalogRemovingBg ? t('catalog_rembg_working') : '🪄 '+t('catalog_rembg_btn')}</button>
        <button type="button" class="exit-reason-chip" id="btn-enhance-photo" ${catalogEnhancing?'disabled':''} style="border-color:var(--sky);color:var(--sky-ink);font-weight:800;font-size:14px;padding:9px 14px;">${catalogEnhancing ? t('catalog_enhance_working') : '🚀 '+t('catalog_enhance_btn')}</button>
        <button type="button" class="exit-reason-chip ${catalogStageOpen?'on':''}" id="btn-stage-photo" ${catalogStaging?'disabled':''} style="border-color:var(--sky);color:var(--sky-ink);font-weight:800;font-size:14px;padding:9px 14px;">${catalogStaging ? t('catalog_stage_working') : '🏞️ '+t('catalog_stage_btn')}</button>
      </div>
      ${/* PROGRESO + CANCELAR de la función PRO en curso (auditoría 2026-09-07:
           antes se esperaba hasta 88 s sin barra ni salida). La barra avanza
           con el tiempo esperado del modelo (app-07 la mueve sin re-render). */''}
      ${catalogAiJob ? `
      <div id="catalog-ai-job" style="margin-top:12px;background:var(--inset);border-radius:10px;padding:10px 12px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
          <span style="font-size:13px;font-weight:700;color:var(--ink);">${t('catalog_ai_progress').replace('{s}', catalogAiJob.expectSec)}</span>
          <button type="button" class="btn btn-ghost btn-sm" id="btn-ai-cancel">${t('btn_cancel')}</button>
        </div>
        <div class="cat-ai-progress"><div id="catalog-ai-bar" style="width:${Math.min(95, Math.round(((Date.now()-catalogAiJob.startedAt)/1000)/catalogAiJob.expectSec*100))}%;"></div></div>
      </div>` : ''}
      ${catalogEditCutout ? `
      ${/* Fondos: colores planos + ESCENARIOS incorporados (con sombra automática
           en la composición) — el "estudio de fondos" gratis. */''}
      <div style="display:flex;gap:9px;align-items:center;margin-top:12px;flex-wrap:wrap;">
        <span style="font-size:13.5px;font-weight:700;color:var(--ink);">${t('catalog_rembg_bg')}</span>
        ${['#ffffff','#f6f1e7','#e9e9e9','#191919'].map(c=>`<button type="button" data-edit-bg="${c}" aria-label="${c}" style="width:34px;height:34px;border-radius:50%;background:${c};border:2px solid ${catalogEditBg===c?'var(--sky)':'var(--line)'};cursor:pointer;flex-shrink:0;transition:transform .15s;${catalogEditBg===c?'transform:scale(1.12);':''}"></button>`).join('')}
        ${CATALOG_BACKDROPS.map(id=>`<button type="button" data-edit-bg="bd:${id}" aria-label="${id}" title="${id}" style="width:34px;height:34px;border-radius:9px;background-image:url('/backdrops/${id}.jpg');background-size:cover;background-position:center;border:2px solid ${catalogEditBg==='bd:'+id?'var(--sky)':'var(--line)'};cursor:pointer;flex-shrink:0;transition:transform .15s;${catalogEditBg==='bd:'+id?'transform:scale(1.12);':''}"></button>`).join('')}
      </div>` : ''}
      ${catalogStageOpen && !catalogStaging ? `
      ${/* Escenario IA: un toque en un preset genera; o describilo a mano. */''}
      <div style="margin-top:12px;background:var(--inset);border-radius:10px;padding:12px;">
        <div style="font-size:13px;font-weight:800;color:var(--sky-ink);margin-bottom:10px;">🏞️ ${t('catalog_stage_hint')}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button type="button" class="exit-reason-chip" data-stage-preset="wood" style="font-size:14px;padding:9px 14px;">🪵 ${t('catalog_stage_wood')}</button>
          <button type="button" class="exit-reason-chip" data-stage-preset="kitchen" style="font-size:14px;padding:9px 14px;">🍽️ ${t('catalog_stage_kitchen')}</button>
          <button type="button" class="exit-reason-chip" data-stage-preset="studio" style="font-size:14px;padding:9px 14px;">💡 ${t('catalog_stage_studio')}</button>
          <button type="button" class="exit-reason-chip" data-stage-preset="shelf" style="font-size:14px;padding:9px 14px;">🏪 ${t('catalog_stage_shelf')}</button>
        </div>
        <div style="display:flex;gap:8px;margin-top:8px;">
          <input id="stage-custom-input" type="text" placeholder="${t('catalog_stage_custom_ph')}" style="flex:1;">
          <button type="button" class="btn btn-primary btn-sm" id="btn-stage-go">${t('catalog_stage_go')}</button>
        </div>
      </div>` : ''}` : ''}
      ${catalogEditFullBackup ? `<button type="button" class="link-btn" id="btn-rembg-revert" style="margin-top:8px;padding:4px 0;">${t('catalog_rembg_revert')}</button>` : ''}
      <div class="modal-actions">
        <button class="btn btn-ghost" id="btn-cancel-edit">${t('btn_cancel')}</button>
        <button class="btn btn-primary" id="btn-apply-edit">${t('catalog_edit_done')}</button>
      </div>
    </div>
  </div>`;
}
async function publishCatalogNow(auto){
  // Publicar necesita cuenta REAL: el link es permanente y las fotos quedan
  // públicas — una sesión anónima de prueba no debería dejar rastros públicos.
  if(!currentUser || currentUser.isAnonymous){ if(!auto) openUpgradeModal(t('catalog_needs_account_note')); return; }
  const waEl = document.getElementById('catalog-wa-input');
  if(waEl) catalogWhatsApp = waEl.value.trim();
  const items = [];
  // La versión en ALTA (photoHiUrl, 1200px ya editada) manda sobre el thumbnail
  // de 300px — es la diferencia entre una ficha de catálogo nítida y una borrosa.
  const pushEntry = (id, name, price, unit, category, photo, hiUrl, thumbUrl)=>{
    const entry = {id, name, price: price>0 ? price : null, unit, category};
    if(hiUrl){ entry.photoUrl = hiUrl; if(thumbUrl) entry.photoThumbUrl = thumbUrl; }
    else if(photo){
      if(photo.url) entry.photoUrl = photo.url;
      else if(photo.base64){ entry.photoB64 = photo.base64; entry.photoMediaType = photo.mediaType||'image/jpeg'; }
    }
    items.push(entry);
  };
  inventory.filter(i=>i && i.inCatalog && !isExpenseItem(i)).forEach(i=>{
    const cat = categories.find(c=>c.id===i.categoryId);
    pushEntry(i.id, i.name, Number(i.salePrice)||0, i.unit||null, cat?cat.name:null, i.photo, i.photoHiUrl, i.photoThumbUrl);
  });
  recipes.filter(r=>r && r.inCatalog).forEach(r=>{
    pushEntry(r.id, r.name, Number(r.salePrice)||0, null, null, r.photo, r.photoHiUrl, r.photoThumbUrl);
  });
  if(items.length===0){ showToast(t('catalog_none_selected'), 'error'); return; }
  catalogPublishing = true; render();
  try{
    const token = await currentUser.getIdToken();
    const res = await fetch('/.netlify/functions/publish-catalog', {
      method:'POST',
      headers:{'Content-Type':'application/json', 'Authorization':'Bearer '+token},
      body: JSON.stringify({
        catalogId: catalogId || undefined, ownerUid: syncUid(), businessName,
        whatsapp: catalogWhatsApp.replace(/\D/g,''), lang: uiLang, items,
        // Canales elegidos por el dueño (limpios: solo usuario, sin @ ni URL)
        channels: {
          sms: !!catalogChannels.sms, call: !!catalogChannels.call,
          instagram: String(catalogChannels.instagram||'').replace(/^@|\s|https?:\/\/[^\/]+\//g,'').slice(0,40),
          facebook: String(catalogChannels.facebook||'').replace(/^@|\s|https?:\/\/[^\/]+\//g,'').slice(0,60),
          tiktok: String(catalogChannels.tiktok||'').replace(/^@|\s|https?:\/\/[^\/]+\//g,'').slice(0,40)
        }
      })
    });
    const data = await res.json().catch(()=>({}));
    if(!res.ok || !data.catalogId) throw new Error(data.error || ('HTTP '+res.status));
    catalogId = data.catalogId;
    saveState();
    logActivity('catalog_published', '', String(data.itemCount||items.length));
    showToast(t(auto ? 'catalog_auto_updated' : 'catalog_published_toast'));
  }catch(e){
    console.error('[Dusty] no se pudo publicar el catálogo:', e);
    // En automático los errores no molestan (sin señal pasa): el próximo cambio
    // vuelve a agendar. En manual sí se avisa.
    if(!auto) showToast(t('catalog_error'), 'error');
  }
  catalogPublishing = false; render();
}
async function unpublishCatalogNow(){
  if(!currentUser || !catalogId) return;
  if(!confirm(t('catalog_unpublish_confirm'))) return;
  catalogPublishing = true; render();
  try{
    const token = await currentUser.getIdToken();
    const res = await fetch('/.netlify/functions/publish-catalog', {
      method:'POST',
      headers:{'Content-Type':'application/json', 'Authorization':'Bearer '+token},
      body: JSON.stringify({catalogId, ownerUid: syncUid(), unpublish:true})
    });
    if(!res.ok) throw new Error('HTTP '+res.status);
    // El id se CONSERVA a propósito: republicar revive el MISMO link (los QR
    // impresos y los links ya compartidos vuelven a servir).
    showToast(t('catalog_unpublished_toast'));
  }catch(e){
    console.error('[Dusty] no se pudo despublicar el catálogo:', e);
    showToast(t('catalog_error'), 'error');
  }
  catalogPublishing = false; render();
}

