# Plan: rediseño de la sincronización (escrituras por-doc + merge de lápidas)

**Fecha:** 2026-09-01 · **Estado:** COMPLETO (2026-09-02). Etapa D + satélites en
91bcd2c; etapas A+B+C+E en 7536292. Nota de implementación: en vez del dirty set
marcado a mano en call sites, se usa detección por hash (espejo persistido de lo
que la nube tiene, hash53 sobre stableStringify) — misma arquitectura, cobertura
automática de todos los caminos de mutación. Falta SOLO la validación real de dos
perfiles de navegador con la cuenta de equipo (protocolo de abajo) antes de
empaquetar el próximo AAB. Ojo con clientes mezclados: un Android viejo (vc≤9,
sync de estado completo) puede pisar escrituras por-doc de la web nueva — subir
el próximo AAB pronto si el equipo mezcla web y Android.
**Motivación:** la auditoría del 2026-09-01 encontró que el sync actual puede
perder ediciones en silencio. Los tres problemas comparten una sola raíz:
**el estado se sincroniza por reemplazo completo, sin comparar contenido.**

## Los tres problemas (con el código de hoy)

1. **Ediciones offline se pierden al relanzar** — `reconcileLocalOnlyData`
   (app-02-nube.js) solo sube documentos cuyo *id* no existe en la nube.
   Una edición a un doc existente hecha sin red (o cortada por el debounce de
   400ms al cerrar la app) nunca se sube: el primer snapshot la pisa con la
   versión vieja de la nube y `saveState()` la borra también de local.
2. **"Último en escribir gana" sobre TODO** — `syncAllToFirestore` reescribe
   con `batch.set` todos los docs de las 3 colecciones + meta ante cualquier
   cambio. Dos miembros editando cosas distintas a la vez → el commit más
   tardío pisa el doc del otro (el snapshot intermedio se descarta porque
   `cloudSyncDirty` es true).
3. **Lápidas que se pisan** — `deletedInventoryIds` & co. viajan como array
   completo dentro del doc de meta. Dos borrados simultáneos en dispositivos
   distintos → el segundo commit escribe su array local sin el borrado del
   primero → un tercer dispositivo offline resucita el producto borrado.

## Diseño objetivo

### A. Sello de versión por documento
Cada ítem/compra/recibo gana dos campos al editarse localmente:

- `updatedAt`: ISO timestamp de la última edición **local** (ya existe
  `lastEditedAt` para inventario cuando hay sesión — se generaliza: siempre,
  con o sin sesión, y también en compras y recibos).
- `updatedBy`: uid del que editó (para desempate estable si dos relojes
  chocan: gana el timestamp; a igual timestamp, gana el uid menor).

Con eso, "¿quién tiene la versión buena?" deja de ser "el que escribió último
en Firestore" y pasa a ser comparable por contenido.

### B. Escrituras por-doc (dirty set) en vez de estado completo
- Nuevo estado: `dirtyDocs = { inventory:Set, purchases:Set, receipts:Set, meta:boolean }`.
- Todo camino que hoy hace `saveState()` tras mutar un doc marca su id como
  dirty (helper `markDirty('inventory', id)` — los call sites ya pasan por
  pocas funciones: guardar producto, aplicar escaneo, borrar, conteo cíclico).
- `syncAllToFirestore` pasa a escribir **solo los docs dirty** (y los limpia
  del set al confirmar el commit; si el commit falla, quedan dirty y el
  backoff existente reintenta). Los docs no tocados no se escriben nunca →
  el problema 2 desaparece para ediciones a docs distintos.
- El `dirtyDocs` se persiste en localStorage junto con el estado — así una
  edición hecha 200ms antes de que el SO mate la app sigue marcada como
  pendiente en el próximo arranque (cierra la ventana del debounce).

### C. Reconcile por contenido (no solo por id faltante)
`reconcileLocalOnlyData` compara, para cada id presente en ambos lados:
- si el doc local está en `dirtyDocs` **o** su `updatedAt` es más nuevo que el
  remoto → se sube el local;
- si no → se acepta el remoto (como hoy).
Los ids que solo existen local se siguen subiendo; las lápidas se siguen
respetando. Esto cierra el problema 1.

### D. Lápidas por unión, no por reemplazo
Dos cambios complementarios:
- **Escritura**: `deletedInventoryIds/deletedReceiptIds/deletedPurchaseIds`
  se escriben con `FieldValue.arrayUnion(...ids)` (solo los ids nuevos de esta
  sesión) en vez de `set` del array completo.
- **Lectura** (`applyRemoteMetaSnapshot`): el array local pasa a ser
  `union(local, remoto)` en vez de `remoto`.
Una lápida ya no puede desaparecer por una carrera → problema 3 cerrado.
(La poda de lápidas viejas —hoy no existe— puede quedar para después: son
strings cortos, crecen lento.)

### E. Snapshots con dirty granular
Hoy un snapshot entero se descarta si `cloudSyncDirty` es true (se pierde lo
que traía de otros). Con el dirty set, el snapshot se aplica **doc por doc**:
- doc remoto cuyo id NO está dirty → se acepta;
- doc remoto cuyo id SÍ está dirty → gana el local (se va a subir enseguida).
Así las ediciones de un compañero llegan aunque yo esté a mitad de un guardado.

## Arreglos satélite que entran en el mismo trabajo

- **Catch del lookup de equipo** (app-02-nube.js:112): hoy conecta listeners
  sin reconcile si `joinedRef().get()` falla → puede pisar datos locales o
  vaciar la copia local de un miembro. Debe reintentar con backoff en vez de
  conectar "a ciegas".
- **Carrera submitQuickJoin vs onAuthStateChanged** (app-06-modales.js:439):
  el handler de auth debe abortar su attach si `joinedOwnerUid` cambió
  mientras esperaba (comparar el uid objetivo antes y después del await).
- **`ensureInviteCode` no atómico** (app-02-nube.js:~630): pasar las dos
  escrituras a un `batch()`, y al leer un código ya existente verificar que el
  doc de `inviteCodes/` exista (repararlo si no).

## Orden de implementación (cada paso deployable por separado)

1. **D (lápidas por unión)** — chico, autocontenido, cierra el caso más feo
   (resucitar borrados). Sin migración.
2. **A (updatedAt/updatedBy en cada edición)** — solo escritura de campos
   nuevos; los docs viejos sin el campo se tratan como "más viejos que
   cualquiera" (comportamiento de hoy). Sin migración.
3. **B (dirty set + escrituras por-doc)** — el corazón. `syncAllToFirestore`
   conserva su firma; cambia qué escribe.
4. **C (reconcile por contenido)** — depende de A y B.
5. **E (snapshots granulares)** — depende de B.
6. Satélites (catch del lookup, carrera del join, batch del invite code) —
   independientes, se pueden intercalar.

## Cómo probarlo (antes de subir a los testers)

- **Dos perfiles de navegador** con la misma cuenta de equipo: editar docs
  distintos a la vez (no debe perderse ninguno), editar el MISMO doc a la vez
  (debe ganar el `updatedAt` más nuevo, determinista), borrar en A mientras
  B está offline y B edita otra cosa al volver (el borrado debe sobrevivir).
- **Offline**: DevTools → offline, editar un producto existente, cerrar la
  pestaña, reabrir con red → la edición debe estar en la nube.
- **Debounce**: editar y cerrar la pestaña en <400ms → al reabrir debe subir
  (gracias al dirty set persistido).
- Verificación final en dispositivo real / emulador Android (el cierre por
  el SO no se puede simular bien en el navegador de escritorio).

## Qué NO cambia

- El formato de los docs en Firestore (solo se agregan `updatedAt`/`updatedBy`).
- Las reglas de seguridad (ya validan por membresía; nada nuevo que permitir).
- El flujo de fotos (Storage) — ya quedó bien con el fix del base64 del
  2026-09-01.
