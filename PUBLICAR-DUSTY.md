# Publicar Dusty — todo en un solo lugar

Estado a hoy (22/08/2026). Todo lo que se generó hoy queda listado acá, con
dónde vive cada cosa.

---

## 0. DÓNDE QUEDAMOS — leer esto primero en la próxima sesión

- Ya se creó la cuenta de desarrollador de Google Play ("Dusty Inventory"),
  y **ya se pasaron las 3 verificaciones obligatorias** (identidad, celular
  Android, teléfono de contacto) — esa parte está 100% resuelta, no hay que
  repetir nada de eso.
- Se empezó a crear la app en Play Console ("Create app"). El primer intento
  falló porque **`com.dusty.app` ya estaba tomado por otro desarrollador** —
  se cambió el ID del paquete a **`com.dusty.inventory`** (sí pasó el check
  de disponibilidad) en TODO el proyecto (`build.gradle`, `capacitor.config.json`,
  `MainActivity.java`, `strings.xml`) y se generó un `.aab` nuevo firmado con
  ese ID (mismo keystore de siempre, no cambió nada ahí).
- **Falta terminar de completar el formulario "Create app"** en Play Console
  con el nombre de paquete correcto (`com.dusty.inventory`) y confirmar que
  quede creada.
- Después de eso: subir el `.aab` firmado (sección 1 de este archivo) al
  track de pruebas cerradas, completar Data Safety y clasificación de
  contenido (todo el texto ya redactado más abajo), y armar los 12 testers.

---

## 1. Estado del build firmado

| Cosa | Dato |
|---|---|
| Archivo del keystore | `android/keystore/dusty-upload.jks` (NO está en git) |
| Contraseña del keystore | `gvWhU4lZrqxnolndkKj0Z4hh` |
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
- [ ] Feature graphic (1024x500)
- [ ] Cuenta de desarrollador de Google Play ($25, individual, sin negocio registrado)
- [ ] Subir el `.aab` al track de pruebas cerradas
- [ ] Conseguir 12 testers reales, esperar 14 días (requisito de Google para cuentas nuevas)
- [ ] Completar cuestionario de clasificación de contenido en Play Console
- [ ] Completar formulario de Data Safety en Play Console (con el contenido de arriba)
- [ ] Promover a producción

---

## 5. Otras cosas pendientes (fuera de Play Store)

- Probar un escaneo de recibo real (con la cámara del celular, no el emulador)
- El repo de GitHub y la app ya se llaman "Dusty" — la carpeta local sigue como `PATRON` por una limitación de esta sesión de Claude Code (no afecta nada real)
