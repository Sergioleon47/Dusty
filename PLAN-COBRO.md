# Plan: cobro y planes de Dusty

**Fecha:** 2026-09-01 · **Estado:** decidido "manual por ahora"; esto documenta
el camino completo para cuando toque integrarlo de verdad.

## Cómo funciona HOY (sin cobro real)

- Los planes ya existen **solo del lado del servidor**:
  `netlify/functions/lib/patron-admin.js` → `PLAN_SCAN_LIMITS`
  (starter 30 · pro 60 · negocio 120 · equipo 300 escaneos/mes) y
  `DEFAULT_SCAN_LIMIT = 60` para cuentas sin plan asignado.
- El plan de una cuenta se asigna **a mano** en Firestore:
  `users/{uid}/meta/billing` → campo `plan: "pro"` (o el que sea), desde la
  consola de Firebase con permisos de administrador. No hay UI de planes.
- Trial sin registro (desde 2026-09-01): cuentas anónimas de Firebase con
  `TRIAL_SCAN_LIMIT = 5` escaneos **totales** (contra `scansTotal`, no por mes)
  y 30 productos de inventario (límite del cliente, `TRIAL_INVENTORY_LIMIT` en
  app-02-nube.js). Al convertirse en cuenta real (email+PIN) pasan al cupo
  mensual normal.

## El embudo completo (cuando haya cobro)

```
Anónimo (5 escaneos, 30 productos)
   → cuenta gratis (email+PIN / Google): cupo mensual chico
      → plan pago (starter/pro/negocio/equipo): cupo según plan
```

Decisión pendiente de producto: cuánto escaneo mensual le queda a la cuenta
GRATIS registrada. Hoy cae en `DEFAULT_SCAN_LIMIT = 60`, que es más que el plan
starter (30) — **antes de cobrar hay que bajar ese default** (sugerido: 10/mes)
o nadie va a tener motivo para pagar. Es un cambio de una línea, pero afecta a
los testers actuales: hacerlo recién al activar el cobro.

## Restricción clave: la política de Google Play

La app Android se distribuye por Play Store → **las suscripciones/features
digitales compradas DENTRO de la app Android tienen que pasar por Google Play
Billing** (comisión 15% hasta $1M/año con el Play Media/subscription tier).
Está prohibido meter un checkout de Stripe dentro de la app de Play, e incluso
linkear a uno externo (salvo programas regionales específicos). La web/PWA no
tiene esa restricción: ahí Stripe es libre.

Consecuencia práctica: **dos pasarelas, un solo estado**. El campo
`users/{uid}/meta/billing.plan` sigue siendo la única fuente de verdad que las
funciones ya leen — las dos pasarelas solo ESCRIBEN ese campo:

```
Play Billing (app Android) ─┐
                            ├→ webhook/function → meta/billing.plan
Stripe (web/PWA)           ─┘
```

## Fase 1 — Stripe en la web (esfuerzo chico)

1. Productos y precios en Stripe (4 planes, mensual; anual opcional).
2. Netlify function `create-checkout-session`: verifica el ID token (igual que
   extract-receipt), crea la sesión de Stripe Checkout con `client_reference_id
   = uid`, devuelve la URL.
3. Netlify function `stripe-webhook`: en `checkout.session.completed` /
   `customer.subscription.updated|deleted` escribe `plan` (y `stripeCustomerId`)
   en `users/{uid}/meta/billing` con el Admin SDK. Verificar la firma del
   webhook con `STRIPE_WEBHOOK_SECRET`.
4. UI mínima en Configuración: tarjeta "Tu plan" (nombre + escaneos usados/cupo,
   el dato ya existe) + botón "Mejorar plan" → Checkout + botón al portal de
   cliente de Stripe (cancelaciones/facturas, sin UI propia).
5. **En la app Android, esa tarjeta NO muestra botones de pago** (detectar
   Capacitor: `window.Capacitor?.isNativePlatform()`) — solo el estado del plan.
   Cumple la política de Play sin doble código.

## Fase 2 — Play Billing en la app Android (esfuerzo mediano)

1. Productos de suscripción en Play Console (mismos 4 planes, mismos ids
   lógicos: `starter`, `pro`, `negocio`, `equipo`).
2. Plugin de Capacitor: RevenueCat (`@revenuecat/purchases-capacitor`) es el
   camino recomendado — abstrae Play Billing, maneja retos de compra y da
   webhooks propios; la alternativa "a pelo" (cordova-plugin-purchase) es
   gratis pero todo el ciclo de verificación queda a cargo nuestro.
3. Verificación server-side: webhook de RevenueCat (o RTDN de Play + función
   que valida con la API de Play Developer) → escribe el mismo
   `meta/billing.plan`.
4. Regla de oro: **el cliente nunca escribe su propio plan** — Firestore rules
   ya no lo permiten para `meta/billing`… ⚠ verificar esto: hoy
   `users/{uid}/meta/{document=**}` da write al dueño y su equipo, o sea que
   UN CLIENTE PODRÍA ESCRIBIRSE `plan: "equipo"` a mano. No importa mientras el
   plan no valga plata, pero **antes de la Fase 1 hay que excluir
   `meta/billing` de la regla de escritura** (o mover billing fuera de `meta/`)
   y que solo el Admin SDK (funciones) lo escriba.

## Fase 3 — pulido

- Aviso de cupo por agotarse (ej. al 80%) con CTA al upgrade.
- Downgrade/gracia al vencer la suscripción (RevenueCat lo maneja casi solo).
- Precios regionales en Play; impuestos los maneja cada tienda.

## Orden y esfuerzo estimado

| Paso | Esfuerzo | Bloqueado por |
|---|---|---|
| Cerrar escritura de `meta/billing` en rules | chico | nada — **hacerlo primero** |
| Decidir precios y cupo del plan gratis | decisión | nada |
| Fase 1 Stripe web | 1-2 días | precios |
| Fase 2 Play Billing (RevenueCat) | 2-4 días | app fuera de closed testing |
| Fase 3 pulido | incremental | fases 1-2 |
