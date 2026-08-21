// Arma los archivos fuente que espera @capacitor/assets (modo "Custom") en assets/,
// a partir de los mismos íconos que ya usa la PWA (icon-512.png / icon-512-maskable.png)
// — así el ícono nativo de Android es el mismo diseño que ya se ve en el navegador/PWA,
// no uno nuevo. Se corre una sola vez (o cuando cambie el ícono fuente), no en cada build.
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const ASSETS = path.join(ROOT, 'assets');

const BG_LIGHT = '#F0F2F5'; // manifest.json background_color
const BRAND = '#E8562C';    // manifest.json theme_color
const BG_DARK = '#1C1E21';  // mismo gris oscuro que .overlay usa como scrim

async function run() {
  // icon-only: se muestra completo, sin recorte (PWA/ícono heredado) -> la versión
  // full-bleed, sin el padding extra que pide el recorte adaptativo de Android.
  await sharp(path.join(ROOT, 'icon-512.png'))
    .resize(1024, 1024)
    .toFile(path.join(ASSETS, 'icon-only.png'));

  // icon-foreground: SÍ se recorta con distintas formas de máscara según el launcher
  // -> usa la versión "maskable" que ya tiene el padding calculado para eso.
  await sharp(path.join(ROOT, 'icon-512-maskable.png'))
    .resize(1024, 1024)
    .toFile(path.join(ASSETS, 'icon-foreground.png'));

  // icon-background: el foreground de arriba ya es 100% opaco de borde a borde, así que
  // este fondo nunca se termina viendo — es solo el resguardo que pide el formato.
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: BRAND } })
    .png()
    .toFile(path.join(ASSETS, 'icon-background.png'));

  // Splash: el ícono completo (con su propio degradé) centrado sobre el mismo fondo
  // claro que ya usa la app (background_color de manifest.json) — así la transición
  // de la pantalla de carga a la app real se siente continua, no un salto de color.
  const logo = await sharp(path.join(ROOT, 'icon-512.png')).resize(820, 820).toBuffer();
  await sharp({ create: { width: 2732, height: 2732, channels: 4, background: BG_LIGHT } })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(path.join(ASSETS, 'splash.png'));

  await sharp({ create: { width: 2732, height: 2732, channels: 4, background: BG_DARK } })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(path.join(ASSETS, 'splash-dark.png'));

  console.log('Listo: assets/icon-only.png, icon-foreground.png, icon-background.png, splash.png, splash-dark.png');
}

run().catch(err => { console.error(err); process.exit(1); });
