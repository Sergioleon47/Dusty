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
    return `<img src="${escapeHtml(ownPhoto)}" alt="" loading="lazy" onerror="this.outerHTML=stockIconFallbackSvg('${key}')">`;
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
  return inventory.map(i=>{
    // Ítems "solo gasto" (Eat out): rastrean plata, no mercadería — nunca son
    // críticos ni pintan barra roja, y con qtyOnHand 0 tampoco suman al valor.
    if(i.expenseOnly) return {ing:i, target:0, pct:0, status:'none'};
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
      <div class="inv-tile ${ccDueIds.has(r.ing.id)?'cc-due-blink':''}" data-open-item="${r.ing.id}" role="button" tabindex="0" data-ing-id="${r.ing.id}" data-status="${r.status}" title="${escapeHtml(r.ing.name)}" style="view-transition-name:dashtile-${String(r.ing.id).replace(/[^a-zA-Z0-9_-]/g,'')};">
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
  const months = allMonths();
  const currentMonthKey = months[0] || localMonthStr();
  const currentSpend = spendForMonth(currentMonthKey);

  return `

  <div class="grid-summary">
    <div class="stat-card">
      ${/* Rediseño 2026-09-03 (pedido del usuario): el número grande es la
           INVERSIÓN del mes (recibos de mercadería — verde, se convierte en
           Valor); abajo los GASTOS OPERATIVOS (comida, gasolina, luz, agua,
           bills, gastos manuales — ámbar), que son lo ÚNICO que consume el
           budget: el presupuesto es para operar el negocio, no para invertir.
           Tocar la fila de gastos agrega un gasto manual sin recibo. */''}
      ${/* Sin la fila de gastos (la tachó el usuario — era redundante): el número
           grande + lápiz para cargar entradas manuales (gasto O inversión, el
           modal pregunta el tipo), y el % del budget ya cuenta la historia de los
           gastos operativos. */''}
      ${(()=>{
        const sp = spendSplitForMonth(currentMonthKey);
        return `
      <div class="stat-label">${t('dash_investment_of')} ${monthLabel(currentMonthKey, uiLang)}</div>
      <div style="display:flex;align-items:center;gap:10px;">
        <div class="stat-value" style="color:var(--basil);margin:0;">${money(sp.invested)}</div>
        <button type="button" class="dash-pencil-btn" id="btn-add-manual-spend" title="${t('manual_spend_title')}" aria-label="${t('manual_spend_title')}">
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
        </button>
      </div>`;
      })()}
      ${monthlyBudget ? (()=>{
        const expenseNow = spendSplitForMonth(currentMonthKey).expense;
        const pct = Math.round((expenseNow/monthlyBudget)*100);
        return `
        <div class="budget-bar-track"><div class="budget-bar-fill ${budgetStatus(pct)}" style="width:${Math.min(Math.max(pct,3),100)}%;"></div></div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px;gap:8px;">
          <span style="font-size:12.5px;color:var(--ink-soft);font-weight:600;">${t('dash_budget_of')} <strong style="font-size:14px;color:var(--ink);">${money(monthlyBudget)}</strong> (${pct}%)</span>
          ${/* Lápiz en vez del texto "Edit" (lo tachó el usuario). */''}
          <button type="button" class="dash-pencil-btn" id="btn-edit-budget" title="${t('dash_edit_budget')}" aria-label="${t('dash_edit_budget')}">
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
          </button>
        </div>`;
      })() : `
        <button id="btn-edit-budget" style="all:unset;cursor:pointer;display:flex;align-items:baseline;gap:6px;margin-top:10px;padding:10px 10px 10px 0;margin-bottom:-10px;">
          <span style="font-size:12.5px;color:var(--ink-soft);font-weight:600;">${t('dash_budget_of')}</span>
          <span style="font-size:16px;font-weight:800;color:var(--navy);">${money(0)}</span>
        </button>`}
      <button class="link-btn" id="btn-open-monthly-spend" style="padding:10px 10px 10px 0;margin-top:2px;margin-bottom:-10px;">${t('dash_see_all_months')}</button>
    </div>
    <div class="scan-card" id="btn-scan-fab" title="${t('dash_scan_receipt')}" style="display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;">
      <!-- Órbita decorativa: todo lo que Dusty puede escanear girando despacio
           alrededor del botón (recibos, productos, códigos de barras, servicios,
           precios). Tres capas de span por burbuja: la de afuera la posiciona en
           su ángulo, la del medio deshace ese ángulo (estático), y la de adentro
           contra-rota animada — así los íconos quedan siempre derechos mientras
           la órbita entera gira. aria-hidden: es puro adorno, el botón ya se
           anuncia solo. -->
      <div class="scan-orbit" aria-hidden="true">
        ${[['🧾',0],['📦',72],['🛒',144],['💡',216],['🏷️',288]].map(([emoji,deg])=>`
        <span class="so-arm" style="transform:rotate(${deg}deg) translate(var(--so-r));">
          <span class="so-unrot" style="transform:rotate(${-deg}deg);">
            <span class="so-bubble">${emoji}</span>
          </span>
        </span>`).join('')}
      </div>
      <div class="scan-fab-mini scan-fab-mini-lg">
        <div class="scan-fab-ring"></div>
        <div class="scan-fab-ring delay"></div>
        ${scanIconSvg()}
      </div>
    </div>
  </div>

  ${inventory.length===0 ? (cloudSyncPending ? emptyState('cloud',t('sync_loading_title'),t('sync_loading_sub')) : dashboardEmptyState()) : ''}
  ${inventory.length>0 ? inventoryMenuRow() : ''}
  ${priceAlertsCard()}
  ${stockAnalyticsCard()}
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
    ${/* Escanear primero y en amarillo (es EL camino recomendado: la IA nombra,
         categoriza y llena todo); el alta manual queda segunda y neutra, como
         el resto del menú — reordenado a pedido del usuario 2026-09-03. */''}
    <button class="btn btn-primary inv-row-btn" id="btn-scan-products">${t('pb_open_btn')}</button>
    <button class="btn btn-ghost inv-row-btn" id="btn-new-item">${t('btn_add_manually')}</button>
    ${/* Sin este botón, el hub de Producción entero (recetas, producir, y el
         historial de salidas que alimenta el escáner de estante) queda inalcanzable:
         attachProductionEvents() lo cablea pero nadie lo renderizaba — se quitó
         el 2026-09-02 "por ahora" y las salidas del escáner quedaron invisibles. */''}
    <button class="btn btn-ghost inv-row-btn" id="btn-production-hub">${t('prod_section_title')}</button>
    ${/* "Crear categoría" con botón propio (pedido del usuario 2026-09-04); la
         GESTIÓN de categorías y el conteo cíclico se mudaron a Ajustes — son
         configuración, no acciones del día a día (ver alertSettingsModal). */''}
    <button class="btn btn-ghost inv-row-btn" id="btn-create-category">${t('btn_create_category')}</button>
    ${(currentUser || hadCloudSessionBefore()) ? `
    <button class="btn btn-ghost inv-row-btn" id="btn-inventory-activity">
      ${t('btn_inventory_activity')}${unreadActivityCount()>0?`<span class="count-badge">${unreadActivityCount()>99?'99+':unreadActivityCount()}</span>`:''}
    </button>
    ` : ''}
  </div>`;
}
/* Fila de chips de categoría — vive en INVENTARIO (antes en el Dashboard):
   tocar uno filtra la lista a esa categoría (data-open-category en attachEvents
   y el filtro inventoryCategoryFilter). El número es cuántos productos tiene
   esa categoría ahora mismo, no un conteo fijo. Se arrastra para reordenar. */
function categoryChipsRow(){
  return `
  ${/* margin/padding inferior a 0: dentro del section-head, el margen propio de
       la fila + el del section-head apilaban ~38px de vacío hasta el banner
       (captura del usuario 2026-09-04) — con el margen del section-head alcanza. */''}
  <div class="category-chip-row" style="flex:1 1 100%;min-width:0;margin-bottom:0;padding-bottom:2px;">
    ${categories.map(c=>{
      const count = inventory.filter(i=>i.categoryId===c.id).length;
      return `<button type="button" class="category-chip" data-open-category="${c.id}">${escapeHtml(c.name)}<span>${count}</span></button>`;
    }).join('')}
  </div>
  `;
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
   grande — accesibilidad para quien no ve bien), 'cols2' o 'cols3'. Solo esas
   tres opciones (pedido explícito). Persiste como preferencia del dispositivo. */
let invLayout = 'cols2';
try{ const v = localStorage.getItem('patron_inv_layout'); if(['rows','cols2','cols3'].includes(v)) invLayout = v; }catch(e){}
// Un solo render tras tocar el selector viaja por View Transition (ver render(),
// app-04): con view-transition-name por tarjeta, cada una VUELA a su nueva
// posición/tamaño en vez del redibujado seco — el morph estilo iOS que faltaba.
let invLayoutTransitionPending = false;
function invLayoutToggleHtml(){
  const opt = (val, label, icon)=>`<button type="button" data-inv-layout="${val}" class="${invLayout===val?'on':''}" aria-label="${label}" aria-pressed="${invLayout===val}" title="${label}">${icon}</button>`;
  const sq = (n)=>{
    if(n===1) return '<svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor"><rect x="2" y="3" width="16" height="4" rx="1.2"/><rect x="2" y="9" width="16" height="4" rx="1.2"/><rect x="2" y="15" width="16" height="3" rx="1.2"/></svg>';
    if(n===2) return '<svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor"><rect x="2" y="3" width="7" height="7" rx="1.5"/><rect x="11" y="3" width="7" height="7" rx="1.5"/><rect x="2" y="12" width="7" height="7" rx="1.5"/><rect x="11" y="12" width="7" height="7" rx="1.5"/></svg>';
    return '<svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor"><rect x="1" y="3" width="5" height="5" rx="1.2"/><rect x="7.5" y="3" width="5" height="5" rx="1.2"/><rect x="14" y="3" width="5" height="5" rx="1.2"/><rect x="1" y="12" width="5" height="5" rx="1.2"/><rect x="7.5" y="12" width="5" height="5" rx="1.2"/><rect x="14" y="12" width="5" height="5" rx="1.2"/></svg>';
  };
  return `<div class="inv-layout-toggle" role="group" aria-label="${t('inv_layout_label')}">
    ${opt('rows', t('inv_layout_rows'), sq(1))}
    ${opt('cols2', t('inv_layout_cols2'), sq(2))}
    ${opt('cols3', t('inv_layout_cols3'), sq(3))}
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
  const vtName = 'invtile-' + String(i.id).replace(/[^a-zA-Z0-9_-]/g, '');
  return `
  ${/* data-status: lo usa el atajo "Alertas críticas" del Dashboard para saltar
       acá y hacer latir los críticos (ya no se listan en el Dashboard). */''}
  <div class="inv-tile ${ccDueIds.has(i.id)?'cc-due-blink':''}" data-open-item="${i.id}" role="button" tabindex="0" data-ing-id="${i.id}" data-status="${r.status}" title="${escapeHtml(i.name)}" style="view-transition-name:${vtName};">
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
  return inventory.filter(i=>!i.expenseOnly).sort((a,b)=>
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
  const allRows = stockRowsData();
  const ccDue = isCycleCountDue();
  const ccDueIds = cycleCountDueIds();
  const filterCategory = inventoryCategoryFilter ? categories.find(c=>c.id===inventoryCategoryFilter) : null;
  // INVERSIÓN 2026-09-04 (pedido del usuario): Inventario muestra SIEMPRE el
  // catálogo completo — el filtro "solo lo que toca contar" se mudó al Dashboard,
  // que ahora lista únicamente los pendientes de conteo. Acá los pendientes solo
  // parpadean (cc-due-blink) y el banner sigue abriendo el conteo.
  // La lupa vive ACÁ (pedido del usuario, captura 2026-09-04): se busca donde
  // están todos los ítems. Filtra también dentro de una categoría abierta.
  const rows = (filterCategory
    ? allRows.filter(r=>r.ing.categoryId===filterCategory.id)
    : allRows).filter(r=>invMatches(r.ing.name, invSearch));
  const groups = groupRowsByCategory(rows);
  // Valor total del inventario (cantidad × costo de cada producto) — vive arriba a
  // la izquierda, encima de la calculadora. Reemplaza al título "Inventario"
  // (pedido del usuario: la pestaña de abajo ya dice dónde estás, no repetirlo);
  // el nombre del negocio, si existe, queda encima del valor.
  const invValue = inventory.reduce((s,i)=>s+(i.qtyOnHand||0)*(i.costPerUnit||0),0);
  return `
  <div class="section-head">
    <div style="min-width:0;flex:1 1 100%;">${filterCategory ? `<h2>${escapeHtml(filterCategory.name)}</h2>` : ''}</div>
    ${/* El FAB del escáner de estante va ANTES que la fila de botones (pedido del
         usuario: el menú debajo del escáner) y en su propia fila a la derecha,
         calibrado para quedar en la MISMA posición de pantalla (alto Y ancho) que el
         botón de escanear del Dashboard — al deslizar entre pestañas, los dos
         escáneres laten en el mismo punto. Medido a 375px, ver .shelf-fab-row. */''}
    ${/* Columna izquierda del hueco junto al escáner: Valor del inventario arriba
         y la calculadora debajo, apilados — espejo de la columna de gasto del
         Dashboard. El valor DENTRO de la fila (no en el encabezado) evita el
         bloque flotante con aire muerto que quedaba arriba. */''}
    ${!filterCategory ? `<div class="shelf-fab-row">${inventory.length>0 ? `
      <div class="inv-left-col">
        ${canSeeFinancials() ? (()=>{
          // Potencial de venta: qty × precio de venta de cada producto que lo
          // tiene puesto. Los que no tienen precio de venta no suman (y se avisa
          // cuántos faltan) — mejor un potencial honesto-parcial que uno inflado
          // mezclando costos. expenseOnly no participa (qty 0 por diseño).
          const withSale = inventory.filter(i=>!i.expenseOnly && (i.salePrice||0)>0);
          const missingSale = inventory.filter(i=>!i.expenseOnly && !(i.salePrice>0) && (i.qtyOnHand||0)>0).length;
          const potential = withSale.reduce((s,i)=>s+(i.qtyOnHand||0)*(i.salePrice||0),0);
          return `
        <div>
          <div class="inv-value-label">${t('inv_value_label')}</div>
          <div class="inv-total-value">$${invValue.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
          ${potential>0 ? `
          <div class="inv-potential">
            <span class="inv-potential-label">🏷 ${t('inv_potential_label')}</span>
            <span class="inv-potential-value">$${potential.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
            ${missingSale>0 ? `<span class="inv-potential-note">${t('inv_potential_missing').replace('{n}', missingSale)}</span>` : ''}
          </div>` : ''}
        </div>`;
        })() : ''}
        ${orderCalcCard()}
      </div>` : ''}${shelfScanFab()}</div>` : ''}
    ${/* Los chips de categoría viven acá desde el intercambio 2026-09-04 (el
         menú de botones se fue al Dashboard, ver inventoryMenuRow): filtran la
         lista que tienen justo debajo. */''}
    ${inventory.length>0 && categories.length>0 && !filterCategory ? categoryChipsRow() : ''}
  </div>
  ${/* Producción y escáner de estante (app-08) viven arriba como los dos botones
       redondos junto al título — las recetas se abren en su propio modal (hub). */''}
  ${filterCategory ? `
  <div class="alert-banner" id="category-filter-banner" style="background:var(--navy-wash);border-color:transparent;color:var(--navy-ink);justify-content:space-between;">
    <span>${t('inv_filtered_by_category').replace('{name}', escapeHtml(filterCategory.name))}</span>
    <button type="button" class="link-btn" id="btn-clear-category-filter" style="padding:0;color:var(--navy-ink);">${t('btn_clear_category_filter')}</button>
  </div>` : (ccDue && inventory.length>0 ? `
  <div class="alert-banner" id="cc-banner" style="cursor:pointer;">
    <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/><path d="M9 15l2 2 4-4"/></svg>
    <span>${t('cc_banner_text').replace('{n}', cycleCountBatch().length)}</span>
  </div>` : '')}
  ${inventory.length===0 ? (cloudSyncPending ? emptyState('cloud',t('sync_loading_title'),t('sync_loading_sub')) : emptyState('box',t('empty_inventory_title'),t('empty_inventory_sub'))) : (
    // Sin la caja .stock-card alrededor: las tarjetas ya son cajas por sí
    // mismas — caja dentro de caja era redundante (captura del usuario). La
    // lupa a la izquierda (margin-right:auto de .inv-search-wrap) y el selector
    // de vista a la derecha — la barra se renderiza AUNQUE la búsqueda no
    // encuentre nada, para poder borrar lo tipeado.
    `<div class="inv-toolbar" style="align-items:center;gap:8px;">
      <div class="inv-search-wrap">
        <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" fill="none" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
        <input id="inv-search" type="search" value="${escapeHtml(invSearch)}" aria-label="${t('inv_search_aria')}" autocomplete="off">
      </div>
      ${invLayoutToggleHtml()}
    </div>` + (
    rows.length===0
      ? (invSearch.trim() ? `<div class="oc-empty" style="margin:14px 0;">${t('oc_no_match')}</div>`
        : (filterCategory ? emptyState('box',t('empty_category_title'),t('empty_category_sub')) : emptyState('box',t('empty_inventory_title'),t('empty_inventory_sub'))))
      : (groups.length>1
      ? groups.map(g=>`
        <div class="category-group-header">${escapeHtml(g.name)} <span>${g.rows.length}</span></div>
        <div class="inv-grid ${invLayout}" style="margin-bottom:16px;">${g.rows.map(r=>stockRowHtml(r,ccDueIds)).join('')}</div>
      `).join('')
      : `<div class="inv-grid ${invLayout}">${rows.map(r=>stockRowHtml(r,ccDueIds)).join('')}</div>`))
  )}
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
      <div class="cal-day ${r?'has-receipt':''} ${dayNotes.length?'has-note':''} ${isToday?'today':''} ${isBlink?'blink':''}" data-cal-day="${dateStr}" ${r?`title="${multi?dayReceipts.length+' '+t('products_plural'):escapeHtml(r.supplier)||t('no_supplier_name')}"`:dayNotes.length?`title="${escapeHtml(dayNotes[0].text)}"`:''}>
        ${cover ? `<img src="${escapeHtml(receiptImgSrc(cover))}" alt="" loading="lazy" onerror="this.style.display='none'">`
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
              ${cover ? `<img src="${escapeHtml(receiptImgSrc(cover))}" alt="" loading="lazy" onerror="this.style.display='none'">` : `<span style="display:flex;color:var(--ink-soft);">${lineIcon('receipt',18)}</span>`}
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
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
      <div class="field" style="margin:0;width:100%;max-width:220px;"><input id="cal-amount-search" type="text" inputmode="decimal" value="${escapeHtml(calendarAmountQuery)}" placeholder="${t('rec_amount_search_placeholder')}"></div>
    </div>
  </div>
  ${receiptCalendarWidget()}
  ${receipts.length>0 ? `<div class="field" style="max-width:340px;"><input id="receipt-search" type="text" value="${escapeHtml(receiptSearchQuery)}" placeholder="${t('rec_search_placeholder')}"></div>` : ''}
  ${receipts.length===0 ? emptyState('receipt',t('empty_receipts_title'),'',true) :
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
          <div class="dish-card" style="cursor:pointer;position:relative;${showReceiptDetail===r.id?'':`view-transition-name:${receiptVtName(r.id)};`}" data-view-receipt="${r.id}">
            ${cover ? `<img src="${escapeHtml(receiptImgSrc(cover))}" alt="" loading="lazy" style="width:100%;height:140px;object-fit:cover;" onerror="this.outerHTML='<div style=&quot;width:100%;height:140px;background:var(--inset);&quot;></div>'">` : `<div style="width:100%;height:140px;background:var(--inset);"></div>`}
            ${imgs.length>1 ? `<span style="position:absolute;top:10px;right:10px;background:rgba(0,0,0,0.6);color:#fff;font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;">${imgs.length}p</span>` : ''}
            <div style="padding:14px 16px;">
              <div style="font-weight:700;font-size:14px;">${escapeHtml(r.supplier)||t('no_supplier_name')}</div>
              <div style="font-size:11.5px;color:var(--ink-soft);margin:3px 0 8px;">${escapeHtml(r.date)} &middot; ${escapeHtml(r.itemCount)} ${r.itemCount!==1?t('products_plural'):t('product_singular')}</div>
              <div style="font-family:'IBM Plex Mono';font-weight:700;color:var(--navy);font-size:15px;">${money(r.total)}</div>
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
  const trendColor = changePct>3 ? 'var(--tomato)' : changePct<-3 ? 'var(--basil)' : 'var(--navy)';

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
    const color = up?'var(--tomato-ink)':down?'var(--basil)':'var(--ink-soft)';
    const bg = up?'var(--tomato-soft)':down?'var(--basil-soft)':'var(--inset)';
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

function monthlySpendChart(monthsAsc, currentMonthKey){
  const W = 560, H = 200, padL = 52, padR = 16, padT = 16, padB = 28;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const spends = monthsAsc.map(m=>spendForMonth(m));
  const max = Math.max(...spends, 1);

  const n = monthsAsc.length;
  const slot = innerW / n;
  const barW = Math.min(slot * 0.55, 24);

  const gridLines = [0,0.5,1].map(f=>{
    const y = padT + innerH*(1-f);
    const val = max*f;
    return `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W-padR}" y2="${y.toFixed(1)}" stroke="var(--line)" stroke-width="1"/>
      <text x="${padL-8}" y="${(y+3).toFixed(1)}" text-anchor="end" font-size="10" fill="var(--ink-soft)" font-family="IBM Plex Mono">${money(val)}</text>`;
  }).join('');

  // El mes actual se destaca con el mismo degradé navy→basil de la marca (brand-mark,
  // el ícono de escanear, el badge del dashboard vacío) en vez de un azul plano —
  // así el ojo va directo al mes que importa sin perder la comparación con el resto.
  const barGradId = 'ms-grad-'+(__chartGradientSeq++);
  const bars = monthsAsc.map((m,i)=>{
    const spend = spends[i];
    const barH = max>0 ? (spend/max)*innerH : 0;
    const x = padL + i*slot + (slot-barW)/2;
    const y = padT + innerH - barH;
    const isCurrent = m===currentMonthKey;
    const fill = isCurrent ? `url(#${barGradId})` : '#3c434d';
    return `
      <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(barH,2).toFixed(1)}" rx="4" fill="${fill}">
        <title>${escapeHtml(monthLabel(m, uiLang))} · ${money(spend)}</title>
      </rect>
      <text x="${(x+barW/2).toFixed(1)}" y="${(y-6).toFixed(1)}" text-anchor="middle" font-size="10" font-weight="700" fill="var(--ink)" font-family="IBM Plex Mono">${money(spend)}</text>
      <text x="${(x+barW/2).toFixed(1)}" y="${(padT+innerH+16).toFixed(1)}" text-anchor="middle" font-size="10" fill="var(--ink-soft)" font-family="IBM Plex Mono">${escapeHtml(monthLabel(m, uiLang))}</text>
    `;
  }).join('');

  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;">
    <defs>
      <linearGradient id="${barGradId}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--basil)"/>
        <stop offset="100%" stop-color="var(--navy)"/>
      </linearGradient>
    </defs>
    ${gridLines}
    ${bars}
  </svg>`;
}

function monthlySpendModal(){
  const months = allMonths();
  const currentMonthKey = months[0] || localMonthStr();
  const monthsAsc = [...months].reverse(); // más viejo primero, para leer izquierda a derecha en el tiempo

  return `
  <div class="overlay" id="monthly-spend-overlay">
    <div class="modal wide">
      <h3 class="navy">${t('ms_title')}</h3>
      <div class="sub">${t('ms_sub')}</div>
      ${monthsAsc.length===0 ? `
        <div class="helper-note" style="margin:0 0 16px;">${t('ms_no_purchases')}</div>
      ` : `
        <div style="margin:14px 0;overflow-x:auto;">${monthlySpendChart(monthsAsc, currentMonthKey)}</div>
        <div class="ing-list-mini" style="max-height:180px;">
          ${[...monthsAsc].reverse().map(m=>`
            <div class="ing-list-mini-item">
              <span>${escapeHtml(monthLabel(m, uiLang))} ${m===currentMonthKey?`<span class="price-updated">${t('ms_current_month')}</span>`:''}</span>
              <span class="mono-cell">${money(spendForMonth(m))}</span>
            </div>
          `).join('')}
        </div>
      `}
      <div class="modal-actions">
        <button class="btn btn-ghost" id="btn-close-monthly-spend" style="flex:1;">${t('btn_close')}</button>
      </div>
    </div>
  </div>`;
}

// Encabezado chico reusado por cada tarjeta de esta pantalla — mismo círculo de
// color + ícono que ya usa welcomeModal() para sus 4 pasos, para que "Configuración"
// se sienta parte de la misma familia visual que el resto de la app (categorías con
// sus burbujas de color, el dashboard con sus íconos por tarjeta) en vez de ser la
// única pantalla que todavía es puro texto plano apilado.
function settingsCardHeader(icon, bg, fg, title){
  return `
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
    <span style="flex-shrink:0;width:32px;height:32px;border-radius:50%;background:${bg};color:${fg};display:flex;align-items:center;justify-content:center;">${lineIcon(icon,16)}</span>
    <label style="font-size:13px;font-weight:700;color:var(--ink);">${title}</label>
  </div>`;
}
function alertSettingsModal(){
  return `
  <div class="overlay" id="alert-settings-overlay">
    <div class="modal">
      <button type="button" class="modal-close-btn" id="btn-close-alert-settings" aria-label="${t('btn_cancel')}">✕</button>
      <h3 class="saffron">${t('alert_title')}</h3>
      <div class="sub">${t('alert_sub')}</div>

      ${/* La sección "Business name" se eliminó de raíz (pedido del usuario) —
           el campo, su guardado y el título que pintaba en Inventario. */''}
      <div class="settings-card">
        ${settingsCardHeader('bell','var(--saffron-soft)','var(--saffron-ink)',t('alert_threshold_title'))}
        <div class="field">
          <label>${t('alert_threshold_label')}</label>
          <input id="alert-threshold-input" type="number" min="1" max="100" step="1" value="${escapeHtml(draftThreshold)}">
        </div>
        <div class="helper-note" style="margin-bottom:0;">${t('alert_helper')}</div>
      </div>

      <div class="settings-card">
        ${settingsCardHeader('chart','var(--basil-soft)','var(--basil-ink)',t('budget_title'))}
        <div class="field">
          <label>${t('budget_label')}</label>
          ${(()=>{
            /* Placeholder inteligente: si nunca definió presupuesto pero YA hay
               gasto registrado, se le sugiere su propio gasto reciente redondeado
               hacia arriba — un número real de SU negocio en vez de un "Ej. 2000"
               inventado. Es placeholder (no value) a propósito: prellenar el input
               guardaría un presupuesto que nunca eligió con solo tocar "Guardar". */
            let ph = t('budget_placeholder');
            const noBudget = draftMonthlyBudget===null || draftMonthlyBudget===undefined || draftMonthlyBudget==='';
            if(noBudget){
              const prev = spendForMonth(shiftMonthStr(localMonthStr(), -1));
              const curr = spendForMonth(localMonthStr());
              const base = prev>0 ? prev : curr;
              if(base>0){
                const sugerido = Math.ceil(base/50)*50;
                ph = t('budget_placeholder_suggested').replace('{n}', sugerido).replace('{s}', money(base));
              }
            }
            return `<input id="budget-input" type="number" min="0" step="1" placeholder="${escapeHtml(ph)}" value="${draftMonthlyBudget!==null && draftMonthlyBudget!==undefined ? draftMonthlyBudget : ''}">`;
          })()}
        </div>
        <div class="helper-note" style="margin-bottom:0;">${t('budget_helper')}</div>
      </div>

      ${/* Categorías (gestión) y Conteo cíclico viven acá desde 2026-09-04
           (pedido del usuario): son configuración del inventario, no acciones
           del día a día. Sus ids son los de siempre — los handlers de
           attachEvents los encuentran igual, solo cierran este modal antes. */''}
      <div class="settings-card">
        ${settingsCardHeader('box','var(--navy-wash)','var(--navy)',t('settings_inventory_title'))}
        <div style="display:flex;flex-direction:column;gap:8px;">
          <button class="btn btn-ghost btn-sm" id="btn-manage-categories">${t('btn_manage_categories')}</button>
          <button class="btn btn-ghost btn-sm" id="btn-cycle-count" style="position:relative;">
            ${t('cc_btn')}${isCycleCountDue()?'<span class="cc-due-dot"></span>':''}
          </button>
        </div>
      </div>

      <div class="settings-card">
        ${settingsCardHeader('cloud','var(--sky-soft)','var(--sky-ink)',t('backup_section_title'))}
        <div style="display:flex;flex-direction:column;gap:8px;">
          <button class="btn btn-ghost btn-sm" id="btn-export-data">${t('btn_export_data')}</button>
          <button class="btn btn-ghost btn-sm" id="btn-import-data">${t('btn_import_data')}</button>
        </div>
        <input type="file" id="import-file-input" accept="application/json" style="display:none;">
        <div class="helper-note" style="margin-top:10px;margin-bottom:0;">${t('backup_section_hint')}</div>
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
        <button class="btn btn-ghost" id="btn-cancel-alert-settings">${t('btn_cancel')}</button>
        <button class="btn btn-primary" id="btn-save-alert-settings">${t('btn_save')}</button>
      </div>
    </div>
  </div>`;
}

