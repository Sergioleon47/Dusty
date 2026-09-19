# Publicar Dusty — todo en un solo lugar

Estado a hoy (22/08/2026). Todo lo que se generó hoy queda listado acá, con
dónde vive cada cosa.

---

## 0. DÓNDE QUEDAMOS — leer esto primero en la próxima sesión

- Ya se creó la cuenta de desarrollador de Google Play ("Dusty Inventory"),
  y **ya se pasaron las 3 verificaciones obligatorias** (identidad, celular
  Android, teléfono de contacto) — esa parte está 100% resuelta, no hay que
  repetir nada de eso.
- Se creó la app en Play Console ("Create app"). El primer intento falló
  porque **`com.dusty.app` ya estaba tomado por otro desarrollador** — se
  cambió el ID del paquete a **`com.dusty.inventory`** (sí pasó el check de
  disponibilidad) en TODO el proyecto (`build.gradle`, `capacitor.config.json`,
  `MainActivity.java`, `strings.xml`) y se generó un `.aab` nuevo firmado con
  ese ID (mismo keystore de siempre, no cambió nada ahí).
- **La app "Dusty" ya está creada y confirmada en Play Console** con el ID
  `com.dusty.inventory` (visible en el dashboard, app id `4973403439393192869`)
  — no hay que repetir el formulario "Create app".
- **Ya se subió y publicó el `.aab` en el track de Internal testing**
  (release "1 (1.0)", disponible para internal testers, 22/08/2026).
- **Ya se completaron en Play Console:** Privacy policy, Ads (No), Content
  rating (cuestionario completo, categoría "All Other App Types"), Target
  audience (18+), Data safety completo, Government apps (No), Financial
  features (No), Health (No), Advertising ID (No), categoría de la app
  (Business) y datos de contacto, y la ficha de Play Store completa
  (descripción corta/larga, ícono, 4 screenshots, feature graphic generado
  con `sharp`).
- **Cuenta de prueba para el revisor de Google** (para "Sign in details"):
  email `sergioleon47+dustyreview@hotmail.com` / contraseña
  `DustyReview2026!` — cuenta real creada en la app, separada de la cuenta
  personal del usuario.
- **✅ ¡Se llegó a los 12 testers reales!** (verificado recargando la
  página después de guardar): ohknee1986@gmail.com,
  folziegirlie2@yahoo.com, folzman26@gmail.com, nidiagarcia.rd@gmail.com,
  mariocelle1995@gmail.com, caego23@gmail.com, gioserfeliz14@gmail.com,
  Karla.trizzino@gmail.com, altagraciafeliz.af@gmail.com,
  antonioblackwell05@gmail.com, jtbayleee@gmail.com, punk0188@yahoo.com.
  Se subió al track de closed testing, 177 países/regiones habilitados.
  - **⚠️ `manney.reginald@yahoo.com` falló la validación** ("This email
    address doesn't exist" — no tiene cuenta de Google asociada, ver nota
    abajo) y se descartó — `punk0188@yahoo.com` lo reemplazó como el
    tester número 12.
- **✅ El versionCode 3 ya fue aprobado y publicado por Google** (visto en
  Play Console: notificación "App update published", y "Latest release: 3
  (1.0)" en el resumen del track de Closed testing - Alpha).
- **✅ RESUELTO — causa raíz del "Your changes couldn't be saved":** no era
  un bug de la UI ni un límite de cuenta. Play Console valida cada email
  contra una cuenta de Google real, y si **cualquiera** de la lista falla
  esa validación, bloquea el guardado de la lista COMPLETA sin decir cuál
  — el modal solo marca la fila con un ícono rojo y el tooltip "This email
  address doesn't exist" (hay que pasar el mouse por el ícono, o mirar el
  accessibility tree, para verlo). En esta sesión el email
  **oscarpensacola@icloud.com** era el que fallaba esa validación (no tiene
  cuenta de Google asociada) — se sacó de la lista y el resto (8) guardó
  sin problema. Truco aparte que también ayudó: escribir todos los emails
  separados por coma y presionar Enter una sola vez al final, en vez de
  uno por uno — así no hay riesgo de perder el foco a mitad de carga.
  - **Para la próxima sesión:** si `oscarpensacola@icloud.com` era un
    typo, pedirle al usuario el email correcto y agregarlo. Si no, hace
    falta que esa persona tenga (o cree) una cuenta de Google con ese
    mismo email para poder sumarla como tester — sino, usar otro email
    suyo. Cuando aparezca este mismo error con cualquier otro email
    nuevo, el mismo método (sacar el que tiene el ícono rojo, guardar el
    resto, resolver aparte el que falló) funciona.
  - Todavía quedan 3 emails de otra lista del usuario que estaban cortados
    en una captura de pantalla (sin confirmar dominio completo):
    claude.test.dusty@exa... (probablemente de prueba, no una persona real),
    cecilia.wcs7p8@patron... (dominio incierto), dublas@patron-team.l...
    (dominio incierto). "karla@nextchapterhom..." de esa misma lista se
    reemplazó por el email confirmado Karla.trizzino@gmail.com de arriba.
- **✅ La release de closed testing (versionCode 2) ya se envió a revisión
  de Google** (22/08/2026, vía "Publishing overview" → "Submit changes for
  review"). Google dijo que la revisión tarda típicamente unos días.
- **✅ Se generó y envió el versionCode 3** (23/08/2026) con tres arreglos
  reales de esta sesión: onboarding más corto (3 pasos + saltar), el bug de
  "no puedo tomar foto, solo subir" en Escanear recibo (reportado por un
  cliente real), y selección múltiple desde galería para agregar varias
  páginas de un recibo de una sola vez. `npm run cap:sync` + `gradlew
  bundleRelease` (JDK 21, ver sección 1) + subida manual del `.aab` en
  Play Console → "Submit changes for review". Mismo track (Closed testing
  - Alpha), mismos 9 testers de antes.
  - **✅ Bug de la cámara CONFIRMADO arreglado en teléfono real** — el
    cliente que lo reportó probó la build nueva (23/08/2026) y avisó que
    salió todo bien. En el emulador Pixel 8 (Android muy nuevo) cámara y
    galería habían abierto el mismo selector porque ahí Chrome ya no
    distingue el atributo `capture`, así que esa prueba había quedado
    incompleta — pero la confirmación real es la que cuenta, y ya llegó.
  - **Nota técnica: OneDrive traba las carpetas `build/`** de Gradle
    durante la compilación (el proyecto vive en una carpeta sincronizada
    por OneDrive) — si `gradlew` falla con "Unable to delete directory" o
    "not a regular file", borrar la carpeta con el truco de
    `robocopy <carpeta_vacía> <carpeta_build> /MIR` y reintentar
    (`Remove-Item` normal a veces no alcanza por los path largos de
    node_modules).
- **Lo que falta ahora:**
  1. **Esperar los 14 días corridos con los 12 testers** (arrancó el
     23/08/2026) — es el único requisito que falta para poder promover a
     producción.

---

## 1. Estado del build firmado

| Cosa | Dato |
|---|---|
| Archivo del keystore | `android/keystore/dusty-upload.jks` (NO está en git) |
| Contraseña del keystore | **NO va acá** — vive solo en `android/keystore.properties` (fuera de git) y en tu gestor de contraseñas |
| Alias | `dusty-upload` |
| Válido hasta | 15/08/2051 |
| Config de firma | `android/keystore.properties` (NO está en git) — lee las credenciales de arriba |
| .aab firmado ya generado | `android/app/build/outputs/bundle/release/app-release.aab` (5.8 MB) |

**Guardá la contraseña del keystore en un gestor de contraseñas aparte.** Si
se pierde el archivo `.jks` o la contraseña, no hay forma de recuperarlos ni
de volver a firmar una actualización de esta misma ficha en Play Store.

Para generar un `.aab` nuevo después de cualquier cambio de código:
```
npm run cap:sync
cd android
./gradlew.bat bundleRelease
```
(hace falta JAVA_HOME apuntando a un JDK 17-24, no al bundled de Android Studio si ese es Java 25)

---

## 2. Capturas de pantalla

Carpeta `store-screenshots/` en la raíz del proyecto:
- `1-new-product.png` — formulario de producto nuevo
- `2-dashboard.png` — dashboard con inventario cargado
- `3-receipts.png` — calendario de recibos
- `4-settings.png` — configuración

Falta: **feature graphic** (1024x500) — es diseño de marketing, no una
captura de la app, pendiente de armar aparte si querés.

---

## 3. Ficha de Play Store

### Datos básicos
- **Nombre:** Dusty
- **ID del paquete:** com.dusty.inventory
- **Categoría:** Negocios (Business)
- **Precio:** Gratis para descargar por ahora — el plan es cobrar por uso más adelante (freemium). Hoy no hay ningún cobro real implementado en el código (los planes `starter/pro/negocio/equipo` se asignan a mano en Firestore, ver conversación sobre Stripe), así que para esta primera publicación la ficha va como Gratis. Cuando se implemente el cobro real:
  - Si es una suscripción o algo que se "consume" dentro de la app (más escaneos, planes superiores), **Google exige usar Play Billing** — no se puede cobrar con Stripe directo para ese tipo de cosas dentro de una app Android, es política de Play Store, no una limitación técnica nuestra.
  - Hay que volver a este archivo y cambiar la ficha de "Gratis" a "Contiene compras dentro de la app" antes de esa actualización.
- **Política de privacidad:** https://patronsc.netlify.app/privacy.html
- **Sitio web:** https://patronsc.netlify.app

### Descripción corta (máx. 80 caracteres)

**Español:**
```
Escaneá recibos y controlá tu inventario y presupuesto, todo automático
```

**English:**
```
Scan receipts, track inventory and budget — all automatic
```

### Descripción completa (máx. 4000 caracteres)

**Español:**
```
Dusty es tu asistente de inventario y gastos para cualquier negocio — desde
restaurantes hasta tiendas, talleres, o cualquiera que compre y revenda.

ESCANEÁ, Y LISTO
Sacale una foto a un recibo o factura y Dusty lee los productos, precios y
cantidades solo — no hace falta tipear nada. También reconoce boletas de
servicios (luz, agua, internet, renta) y las carga como un gasto único.

TU INVENTARIO SIEMPRE AL DÍA
Cada compra actualiza automáticamente cuánto tenés de cada producto y cuánto
te cuesta. Organizá todo en categorías y llevá un conteo cíclico para
verificar el stock real cada tanto.

TE AVISAMOS ANTES DE QUE TE SORPRENDA
Si el precio de un proveedor sube de golpe, si una cantidad no coincide con
tu promedio habitual, o si tu presupuesto del mes se está por pasar — Dusty
te lo marca antes de que sea un problema.

PRESUPUESTO MENSUAL
Ponés un monto y seguís el avance del mes en tiempo real, con el gasto ya
categorizado automáticamente.

TRABAJÁ EN EQUIPO
Compartí un código de invitación y quien lo use ve y actualiza el mismo
inventario, recibos y presupuesto que vos — todo sincronizado al instante.

FUNCIONA SIN CONEXIÓN
Una vez cargada, la app abre y muestra tu inventario aunque no tengas señal.

Sin tarjetas de crédito escondidas, sin letra chica. Empezá gratis.
```

**English:**
```
Dusty is your inventory and expense assistant for any business — from
restaurants to shops, workshops, or anyone who buys and resells.

SCAN, AND YOU'RE DONE
Snap a photo of a receipt or invoice and Dusty reads the products, prices,
and quantities on its own — no typing required. It also recognizes utility
bills (electricity, water, internet, rent) and logs them as a single expense.

YOUR INVENTORY, ALWAYS CURRENT
Every purchase automatically updates how much you have of each product and
what it costs you. Organize everything into categories, and run cycle counts
to verify real stock every so often.

WE FLAG IT BEFORE IT SURPRISES YOU
If a supplier's price jumps, a quantity doesn't match your usual pattern, or
your monthly budget is about to run out — Dusty flags it before it becomes a
problem.

MONTHLY BUDGET
Set an amount and track the month's progress in real time, with spending
already categorized automatically.

WORK AS A TEAM
Share an invite code and whoever uses it sees and updates the same
inventory, receipts, and budget as you — all synced instantly.

WORKS OFFLINE
Once loaded, the app opens and shows your inventory even without a signal.

No hidden fees, no fine print. Get started for free.
```

### Data safety (formulario de Play Console)

¿La app recopila o comparte datos? **Sí.**

| Tipo de dato | ¿Se recolecta? | ¿Se comparte con terceros? | Propósito |
|---|---|---|---|
| Email | Sí | No | Autenticación de cuenta (Firebase Auth) |
| Nombre | Sí (opcional, modo equipo con PIN) | No | Identificar quién hizo cada cambio |
| Fotos | Sí (fotos de recibos/productos) | **Sí — se manda a la API de Anthropic (Claude) para leer el contenido** | Funcionalidad principal (lectura automática de recibos) |
| Info financiera | Sí (precios, costos, historial de compras) | No | Funcionalidad principal |
| Identificadores de app | Sí (UID de Firebase) | No | Autenticación y sincronización |

**El punto que más atención necesita:** declarar explícitamente que las
fotos de recibos se comparten con Anthropic (terceros) para extraer los
datos — es lo primero que revisa Google.

Otras notas:
- Datos cifrados en tránsito (HTTPS/TLS).
- El usuario puede pedir borrado de datos — ya resuelto (`delete-account.html` + botón "Eliminar cuenta" en la app).
- No se usan para publicidad.

### Clasificación de contenido

Sin violencia, sin contenido para adultos, sin contenido generado por
usuarios visible públicamente — debería calificar para la clasificación
más baja sin problema.

---

## 4. Checklist para publicar

- [x] App renombrada y con identidad visual consistente (Dusty)
- [x] Service worker / funciona offline
- [x] Proyecto Android (Capacitor) armado
- [x] Ícono y splash screen reales
- [x] Keystore de firma generado
- [x] `.aab` firmado generado y verificado
- [x] Texto de la ficha de Play Store (este archivo)
- [x] Formulario de Data Safety redactado
- [x] Capturas de pantalla (4)
- [x] Feature graphic (1024x500) — generado con `sharp` a partir del ícono
- [x] Cuenta de desarrollador de Google Play ($25, individual, sin negocio registrado)
- [x] App creada en Play Console (`com.dusty.inventory`)
- [x] Subir el `.aab` al track de internal testing
- [x] Subir el `.aab` al track de pruebas cerradas (closed testing)
- [ ] Conseguir 12 testers reales (van 3), esperar 14 días (requisito de Google para cuentas nuevas)
- [x] Completar cuestionario de clasificación de contenido en Play Console
- [x] Completar formulario de Data Safety en Play Console (con el contenido de arriba)
- [x] Enviar la release de closed testing a revisión de Google (22/08/2026)
- [ ] Promover a producción (después de la aprobación + 12 testers + 14 días)

---

## 5. Otras cosas pendientes (fuera de Play Store)

- Probar un escaneo de recibo real (con la cámara del celular, no el emulador)
- El repo de GitHub y la app ya se llaman "Dusty" — la carpeta local sigue como `PATRON` por una limitación de esta sesión de Claude Code (no afecta nada real)

---

## 6. iOS / App Store — estado al 18/09/2026

Primera sesión de iOS: se pasó de no tener Xcode a la app corriendo en un
iPhone simulado. El proyecto de `ios/` ya estaba en el repo desde antes
(Capacitor 8 en modo SPM, o sea que se abre `App.xcodeproj` directo, sin
CocoaPods ni `.xcworkspace`).

### Decisión: el origen de iOS se igualó al de Android

`capacitor.config.json` ahora lleva `"server": { "iosScheme": "https" }`. Por
defecto Capacitor sirve la app en iOS desde `capacitor://localhost`, mientras
que en Android la sirve desde `https://localhost`. Esa diferencia es justo la
que suele romper el login con Firebase: `signInWithRedirect` necesita volver al
origen de la app, y un esquema propio como `capacitor://` no es un destino de
redirect válido.

Se eligió igualar el origen en vez de esperar a que falle, porque `https://localhost`
es la configuración que ya funciona en producción en Android, y porque no hay
ninguna instalación de iOS existente a la que este cambio le mueva el
localStorage. El CORS del servidor ya aceptaba los dos orígenes
(`ALLOWED_ORIGIN_PATTERNS` en netlify/functions/lib/patron-admin.js), así que no
hubo que tocar nada del lado del servidor.

**Igual hay que verificarlo en el dispositivo**, y si resultara contraproducente
se vuelve atrás borrando esas tres líneas del config y corriendo `npm run cap:sync`.

### Lo que ya está hecho

- [x] Xcode 27 instalado en la Mac mini (solo el SDK de iOS, sin watchOS/tvOS/visionOS)
- [x] Node 24.21.0 instalado (`sudo installer -pkg node-*.pkg -target /`)
- [x] Repo clonado, `npm install` y `npm run cap:sync` corriendo bien
- [x] La app compila y arranca en el simulador de iPhone — se ve y navega bien
- [x] Apple Developer Program pagado y activado (Individual, orden W1675904247)
- [x] Versión de iOS igualada a Android: `MARKETING_VERSION = 1.8.1`
- [x] Botón "Continuar con Apple" escrito (regla 4.8, ver v189 en sw.js)
- [x] App ID `com.dusty.inventory` con Sign In with Apple habilitado
- [x] Services ID `com.dusty.inventory.web` con el dominio y el return URL de Firebase
- [x] Clave de Sign In with Apple creada y el `.p8` descargado
- [x] `UIRequiredDeviceCapabilities` corregido: `armv7` (32 bits) → `arm64`
- [x] Clave rotada y login con Apple probado en el simulador: entra bien
- [x] El origen `https://localhost` no rompió nada: la app abre y navega igual
- [x] Proveedor de Apple configurado en Firebase (Services ID + Team ID + Key ID + `.p8`)
- [x] App creada en App Store Connect: **Dusty Inventory**, estado "Prepare for Submission"

### Datos de la configuración de Sign In with Apple

No son secretos (son identificadores); el único secreto es el `.p8`, que
**nunca va al repo** — se pega directo en la consola de Firebase y se guarda
aparte, igual que el keystore de Android.

| Dato | Valor |
|---|---|
| Team ID | `595XUA4GA3` |
| Services ID | `com.dusty.inventory.web` |
| Key ID | `Z2264DTB64` |
| Primary App ID | `com.dusty.inventory` |
| Domain (en Apple) | `patron-inventory.firebaseapp.com` |
| Return URL (en Apple) | `https://patron-inventory.firebaseapp.com/__/auth/handler` |

### Sign In with Apple: verificado de punta a punta (19/09/2026)

La clave `Z2264DTB64` se revocó y se reemplazó por una nueva —había quedado
expuesta al fotografiar la pantalla de Firebase con el `.p8` visible— y el
proveedor se recargó en la consola con el Key ID y la clave nuevos. Probado en
el simulador: el botón abre la pantalla de Apple y el login entra, así que el
circuito Apple ID → Apple → Firebase → Dusty está completo.

Regla que salió de eso: el `.p8` no se fotografía, no se pega en un chat y no
entra al repo — como el keystore de Android.

### Lo que sigue, en orden

1. **Probar el login con Apple** en el simulador y anotar si el popup funciona
   dentro del WebView.
3. **Probar en un iPhone real** por cable: la cámara (escaneo de recibos), que
   es lo único que el simulador no puede probar de verdad.

### Verificar en iOS: cuatro lugares que usan APIs de navegador

Encontrados en un barrido del código, no probados todavía. La app ya resolvió
este mismo problema una vez para los PDF (ver `sharePdfBytes` en app-14, que usa
`@capacitor/share` cuando detecta app nativa), así que el patrón del arreglo ya
existe en el repo si hace falta aplicarlo en alguno de estos.

| Dónde | Qué hace | Riesgo |
|---|---|---|
| `app-03-base.js:2073` | Exportar respaldo JSON con `<a download>` | `<a download>` no baja nada en el WebView. Afecta también a Android, no es solo de iOS |
| `app-06-modales.js:4427` | Descargar la imagen de un recibo, mismo `<a download>` | Igual que el anterior |
| `app-06-modales.js:686` | `window.open(url, '_system')` para el checkout de Stripe | `'_system'` es un target de Cordova, no de Capacitor. Sin `@capacitor/browser` puede no abrir nada. Hoy no molesta porque el cobro real no está activo |
| `app-15-servicios.js:1399` y `app-17-cotizaciones.js:420` | Abrir `wa.me` con `window.open` y caer a `location.href` | Si cae al `location.href`, el WebView navega fuera de la app. En iOS el link universal debería saltar a WhatsApp, pero hay que verlo |

`app-06-modales.js:4377` (`printReceiptHtml`) también usa `window.open`, pero
solo se llega ahí si falla el PDF, y si devuelve `null` corta sin romper nada.
4. **Capturas de iPhone** — las de Play no sirven, Apple pide tamaño de iPhone
   (1320x2868 o 1290x2796).
5. **Ficha en App Store Connect**: descripción, URL de privacidad (ya existe
   `privacy.html`) y el cuestionario de App Privacy, que se puede responder con
   la tabla de Data Safety de la sección 3 de este archivo.
6. **Archive y subida** desde Xcode: elegir *Any iOS Device*, Product → Archive,
   Distribute App.

### Camino a la revisión de Apple, en orden

Todo lo de arriba ya está. Esto es lo que falta para apretar "Submit for Review",
en el orden en que hay que hacerlo — cada paso desbloquea al siguiente.

**1. Capturas.** ✅ HECHO — están en `store-screenshots/ios/`, a 1290x2796.

Se generan sin tocar la Mac. `scripts/capture-ios-screenshots.js` abre la app de
verdad en Chromium con el tamaño lógico de un iPhone Pro Max (430x932) a densidad
3x, que da exactamente los 1290x2796 que Apple pide — renderizados a esa
resolución, no escalados hasta ella. Los datos son de una panadería inventada que
se inyecta en localStorage antes de que la app arranque: un inventario vacío no
vende nada, y poner datos reales de alguien en la App Store no corresponde.
Después `scripts/build-ios-screenshots.py` les monta la frase de arriba.

```
npm install --no-save playwright          # solo la primera vez
npm run build
(cd www && python3 -m http.server 8787 &)
node scripts/capture-ios-screenshots.js   # store-screenshots/ios/raw/
python3 scripts/build-ios-screenshots.py  # store-screenshots/ios/
```

Playwright queda fuera de `package.json` a propósito: pesa bastante y solo hace
falta para esto, así que no tiene por qué estar en el `npm install` de todos.

Las capturas de `raw/` también son válidas tal cual para Apple (miden justo
1290x2796): si en algún momento se prefiere la app a pantalla completa sin frase
arriba, se suben esas y listo.

**Alternativa, desde el simulador.** Si se quiere la captura con la barra de
estado de iOS de verdad:
En Xcode elegir un modelo **Pro Max** (Apple pide el tamaño de pantalla grande;
un iPhone Pro a secas da una medida que App Store Connect rechaza) y correr la
app. Conviene entrar con una cuenta real: una app vacía se ve mal en la ficha.
Después, pantalla por pantalla:

```
scripts/ios-sim.sh reset          # desinstala: sin esto el service worker muestra lo viejo
# ▶ en Xcode, entrar con la cuenta, navegar a cada pantalla
scripts/ios-sim.sh shot dashboard
scripts/ios-sim.sh shot inventario
scripts/ios-sim.sh shot recibos
scripts/ios-sim.sh shot reportes
scripts/ios-sim.sh shot produccion
```

Cada captura imprime su tamaño en píxeles para no descubrir recién al subirlas
que estaban mal. Quedan en `store-screenshots/ios/`.

**2. La ficha en App Store Connect.** Todos los textos están en la sección 7 de
este archivo, listos para pegar. Se completan:
- *App Information*: categoría (Business / Productivity) y la URL de privacidad
- *Pricing and Availability*: Free, y **destildar la Unión Europea** — vender ahí
  exige declarar trader status bajo el Digital Services Act, un trámite que no
  vale la pena para la primera versión y que se puede agregar después
- *App Privacy*: la tabla de la sección 7, con Tracking en NO
- *Age Rating*: 4+

**3. El build.** En Xcode, elegir *Any iOS Device (arm64)* arriba (no el
simulador), **Product → Archive**, y desde el Organizer *Distribute App → App
Store Connect*. La primera subida tarda un rato en procesarse del lado de Apple:
el build aparece en la ficha recién cuando termina.

**4. Enviar.** Con la ficha completa y el build procesado, se elige ese build en
la versión 1.8.2 y se manda a revisión. La primera revisión de una cuenta nueva
suele tardar más que las siguientes.

### Para más adelante

Cuando se active el cobro, iOS tiene que ir por StoreKit/IAP igual que Android
por Play Billing. `PLAN-COBRO.md` hoy solo contempla Play + Stripe; falta esa
tercera pata.

---

## 7. Ficha de App Store — textos listos para pegar

La App Store no usa los mismos campos que Play: además de la descripción larga
pide un **subtítulo** y **palabras clave**, y no existe el "texto corto" de
Google. Lo de abajo está adaptado de la sección 3, respetando los límites de
caracteres de Apple (contados, no estimados).

### Datos básicos

| Campo | Valor |
|---|---|
| Name (máx. 30) | `Dusty Inventory` — "Dusty" a secas estaba tomado en la App Store. El nombre debajo del ícono en el teléfono sigue siendo **Dusty** (viene de `CFBundleDisplayName` en el Info.plist), esto es solo el nombre de la ficha, y de paso la palabra "Inventory" ayuda en las búsquedas. |
| Bundle ID | `com.dusty.inventory` |
| Primary category | Business |
| Secondary category | Productivity |
| Price | Free (ver la nota de cobro de la sección 3 — en iOS será StoreKit, no Stripe) |
| Support URL | https://patronsc.netlify.app |
| Marketing URL | https://patronsc.netlify.app |
| Privacy Policy URL | https://patronsc.netlify.app/privacy.html |
| Idiomas | Quedó **English (U.S.)** como principal al crear la app. Si el mercado principal va a ser hispanohablante, conviene agregar español como localización y evaluar cambiar el principal. |

### Subtitle (máx. 30 caracteres)

Español — 30 caracteres:
```
Inventario y gastos sin tipear
```

English — 30 characters:
```
Scan receipts, track inventory
```

### Promotional text (máx. 170 caracteres, se puede cambiar sin nueva revisión)

Español:
```
Sacale una foto al recibo y Dusty carga los productos, precios y cantidades
solo. Tu inventario y tu presupuesto quedan al día sin que escribas nada.
```

English:
```
Snap a photo of the receipt and Dusty fills in the products, prices and
quantities by itself. Your inventory and budget stay current without typing.
```

### Keywords (máx. 100 caracteres en total, separadas por coma, sin espacios)

Apple cuenta los caracteres de todo el campo junto. No repitas palabras que ya
estén en el nombre o el subtítulo — Apple ya indexa esas.

Español — 96 caracteres:
```
recibos,facturas,escanear,stock,almacen,negocio,compras,proveedor,presupuesto,restaurante,tienda
```

English — 96 characters:
```
receipt,invoice,scanner,stock,warehouse,business,expenses,supplier,budget,restaurant,shop,retail
```

### Description

Se reusa tal cual la descripción completa de la sección 3 (está dentro de los
4000 caracteres de Apple). Un solo cambio: donde la versión de Play habla de
"Android", no mencionar plataformas.

### App Privacy (cuestionario de App Store Connect)

Mismo contenido que el Data Safety de la sección 3, traducido a las categorías
de Apple. Se responde en App Store Connect → tu app → App Privacy.

| Categoría de Apple | ¿Se recolecta? | ¿Vinculada al usuario? | ¿Rastreo? | Propósito |
|---|---|---|---|---|
| Contact Info → Email Address | Sí | Sí | No | App Functionality |
| Contact Info → Name | Sí (opcional, modo equipo) | Sí | No | App Functionality |
| User Content → Photos or Videos | Sí (recibos y productos) | Sí | No | App Functionality |
| User Content → Other User Content | Sí (inventario, notas) | Sí | No | App Functionality |
| Financial Info → Other Financial Info | Sí (precios, costos, compras) | Sí | No | App Functionality |
| Identifiers → User ID | Sí (UID de Firebase) | Sí | No | App Functionality |

**Tracking: NO.** Dusty no hace seguimiento entre apps ni vende datos a nadie,
así que la pregunta de App Tracking Transparency se responde que no y no hace
falta el permiso de rastreo.

**Lo que sí hay que declarar con cuidado**, igual que en Play: las fotos de
recibos se mandan a la API de Anthropic para extraer los datos. En el
cuestionario de Apple eso no es "compartir con terceros para publicidad" sino un
proveedor que procesa datos en nombre de la app (Apple lo trata como uso propio
si el tercero no los usa para lo suyo), pero **la política de privacidad tiene
que decirlo explícitamente** — y `privacy.html` ya lo dice.

### Age rating

Sin violencia, sin contenido adulto, sin contenido de usuarios visible
públicamente → 4+.

### Capturas

Apple pide tamaño de iPhone (1320x2868 o 1290x2796), mínimo 1 y hasta 10. Las de
`store-screenshots/play/` NO sirven: son de otra relación de aspecto. Hay que
sacarlas del iPhone real (botón lateral + volumen arriba) una vez que la app
corra ahí. Mismas pantallas que en Play: dashboard, inventario, escaneo de
recibo, reportes, producción.
