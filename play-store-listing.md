# Ficha de Play Store — Dusty

Borrador para copiar/pegar en Play Console. Basado en las funciones reales de la
app, verificadas hoy (no inventé nada que no exista).

## Datos básicos

- **Nombre de la app:** Dusty
- **ID del paquete:** com.dusty.inventory
- **Categoría sugerida:** Negocios (Business) — alternativa: Productividad
- **Tipo:** Gratis
- **Email de contacto:** (el tuyo)
- **Política de privacidad:** https://patronsc.netlify.app/privacy.html
- **Sitio web:** https://patronsc.netlify.app

---

## Descripción corta (máx. 80 caracteres)

### Español
```
Escaneá recibos y controlá tu inventario y presupuesto, todo automático
```
(72 caracteres)

### English
```
Scan receipts, track inventory and budget — all automatic
```
(60 characters)

---

## Descripción completa (máx. 4000 caracteres)

### Español

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

### English

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

---

## Data safety (formulario de Play Console)

### ¿La app recopila o comparte alguno de los tipos de datos requeridos?
**Sí.**

### Datos recopilados

| Tipo de dato | ¿Se recolecta? | ¿Se comparte con terceros? | Propósito |
|---|---|---|---|
| Email | Sí | No | Autenticación de cuenta (Firebase Auth) |
| Nombre | Sí (opcional, modo equipo con PIN) | No | Identificar quién hizo cada cambio |
| Fotos | Sí (fotos de recibos/productos) | Sí — se manda a la API de Anthropic (Claude) para leer el contenido | Funcionalidad principal de la app (lectura automática de recibos) |
| Otra info financiera | Sí (precios, costos, historial de compras) | No | Funcionalidad principal de la app |
| Identificadores de app | Sí (UID de Firebase) | No | Autenticación y sincronización de datos |

### Notas importantes para completar el formulario
- **Las fotos de recibos se envían a un servicio de terceros (Anthropic/Claude) para extraer los datos.** Esto hay que declararlo explícitamente en la sección de "compartir datos" — es el punto que más atención necesita.
- Los datos se **cifran en tránsito** (HTTPS/TLS, Firebase y Netlify Functions).
- El usuario **puede pedir que se borren sus datos** — ya tenés esto resuelto: [delete-account.html](https://patronsc.netlify.app/delete-account.html) y el botón "Eliminar cuenta" dentro de la app.
- Los datos **no se usan para publicidad**.

---

## Cuestionario de clasificación de contenido

App de negocios/productividad sin contenido generado por usuarios visible
públicamente, sin violencia, sin contenido para adultos. Debería calificar
para la clasificación más baja (ej. "Everyone" / "PEGI 3") sin problema —
las preguntas del cuestionario son sobre violencia, lenguaje, contenido
sexual, sustancias, apuestas, etc., y Dusty no tiene nada de eso.

---

## Assets gráficos que faltan (no puedo generarlos yo)

- **Ícono de la app (512x512)** — ya lo tenés, es el mismo `icon-512.png` del proyecto.
- **Feature graphic (1024x500)** — falta crear.
- **Capturas de pantalla** — mínimo 2, recomendado 4-8. Las podemos sacar del emulador cuando quieras (yo puedo tomarlas con adb).
