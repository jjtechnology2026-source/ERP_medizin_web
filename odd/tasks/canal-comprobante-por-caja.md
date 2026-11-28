# Canal de comprobante detectado por terminal: fiscal o POS80 — sin fallback

Documento de **planificación**. No contiene cambios de código: describe el modelo
objetivo, el estado medido hoy, el plan de implementación por fase y las decisiones que faltan
tomar. Revisado el 18/11/2026: el canal **no se configura, se detecta** (revisión L5), con
persistencia por capas, identidad de terminal, verificación previa al cobro y matriz de fallos.

Relacionado: `odd/tasks/cuadre-fiscal-fallback-no-fiscal.md` (diagnóstico del descuadre
X/Z) y `odd/tasks/fiscal-service-error-capture.md` (captura de fallos del servicio fiscal).

## Specs

- **S1** — El canal **se detecta, no se configura**. Si el servicio fiscal está presente en la
  computadora, se va por la máquina fiscal.
  > "si se detecta que está el servicio fiscal en la computadora, sabés que vas a ir por la
  > máquina fiscal"
- **S2** — Si el servicio fiscal **no** está, se va por la POS80.
  > "si no detecta el servicio fiscal es que va a ir para la post 80"
- **S3** — Si el servicio fiscal **está** pero la máquina fiscal falla, es un **error**: no hay
  fallback a POS80 y la venta no se registra.
  > "si falla, borrar el fallback de la pos 80" · "si está activo el servicio fiscal y lanza un
  > error… me tiene que mandar un mensaje: mirá, falló porque la máquina fiscal no quiso
  > imprimir"
- **S4** — Sin papel no hay venta, en los dos canales. Si la POS80 no imprime, tampoco se
  registra.
  > "si falla la post 80 no inserta en la base de datos, es decir no se manda"
- **S5** — La presencia del servicio se verifica **constantemente**, y se confirma **al momento
  de vender** (no se decide con un estado viejo).
  > "verificando constantemente si está el servicio fiscal activo… tienes que verificar con el
  > health, saber que está vivo"
- **S6** — El mensaje de error dice el motivo concreto, no "error desconocido".
  > "falló porque la máquina fiscal no quiso imprimir, tal tal tal"
- **S7** — Se elimina el modo "vender sin imprimir": no hay venta sin documento.
  > "vamos a quitar el caso de que es puro vender normal… venta sin mandar por la fiscal ni por
  > la post 80"

**Specs derogadas por esta revisión:** la S4 anterior (tercer canal `registro`) y la S5 anterior
(canal declarado por caja) quedan sin efecto. Una farmacia con varias cajas ahora es una
farmacia con varias computadoras, y cada una detecta lo suyo.

## Tasks

Implementación de esta revisión (detección). F3/F4 quedan abiertas.

| ID | Qué | Specs | Estado |
| --- | --- | --- | --- |
| **T1** | `modules/cash-register/lib/channel-detect.ts`: resolver el canal con confirmación (dos lecturas para declarar ausencia), motivo explícito y seams inyectables para test. | S1, S2, S5, S6 | Hecho (`144c837`) |
| **T2** | `isPrinterPaired()` en `pos80-usb.ts`: saber si la POS80 está emparejada **sin** abrir el selector. | S2 | Hecho (`144c837`) |
| **T3** | `runOrderFallback`: si el papel no salió, **no** se registra la orden (hoy se registra igual). | S4 | Hecho (`020b0a4`) |
| **T4** | Ruta de venta `local` por canal: fiscal con máquina muda → error con motivo y sin POS80; POS80 solo con servicio ausente. | S1-S3, S6 | Hecho (`020b0a4`) |
| **T5** | `PaymentDialog`: preparar la POS80 solo en canal `pos80` (el gesto de WebUSB se pide antes de los awaits). | S2 | Hecho (`020b0a4`) |
| **T6** | Tests: `test/channel-detect.test.mjs` nuevo + reescritura de los que pinnean el fallback. | S1-S6 | Hecho (`144c837`, `020b0a4`) |
| **T7** | Evidencia `canal` + `motivo_canal` + `terminal_id` en la orden. | R8 | Pendiente: requiere `Backend-administrativo` |
| **T8** | Camino `digital` (`usesDigitalBilling`) sujeto al canal. | S3 | Hecho (`020b0a4`) — el canal manda; con el servicio vivo y emisión fallida es error con aviso de verificar el listado, porque la orden pudo existir ya en el backend |
| **T9** | Vigilante continuo de `/health` para la UI, **solo del lado del POS**. | S5 | Pendiente — no toca `service_fiscal`: el servicio ya expone `/health` y eso alcanza |
| **T10** | Papel POS80 impreso + backend que rechaza: se informa y no se anuncia venta registrada. | S4, R6 | Hecho (`894d015`) |
| **T11** | Documentos derivados por canal: NC, reimpresión, X y Z dejan de cruzar a POS80 con el servicio vivo. | S3, R7 | Hecho (commit siguiente) |
| **T12** | Vigilante del `/health` del lado del POS, para que el operador vea el canal antes de cobrar. | S5 | Hecho (commit siguiente) |
| **T13** | Evidencia de canal por orden en `Backend-administrativo`. | R8 | En curso |

## Estado medido hoy

### 1. El fallback es implícito y está cableado en el camino de venta

`modules/cash-register/store/cashier-workflow.store.ts`:

| Línea | Qué hace |
| --- | --- |
| `:319` | `fiscalAvailable === false` (health caído al abrir el pago) → `runFallback()` |
| `:336` | `createInvoice` lanzó → `runFallback()` |
| `:339` | respondió 200 pero sin `fiscal_number` → `runFallback()` |
| `:426,434` | venta `digital`: fallo de transporte o `isFiscalFailure` → `runOrderFallback()` |

No hay canal declarado: el POS80 es el destino de **todo** fallo fiscal, y el cajero no lo elige.

### 2. La venta se registra aunque el papel **no** haya salido

`modules/cash-register/lib/fiscal-fallback-flow.ts:196-225` (`runOrderFallback`): primero
imprime, después —si la llamada original falló por transporte— reenvía la orden. El resultado
del print **no condiciona** el registro: solo se devuelve como `printError` informativo.

Y `cashier-workflow.store.ts:301` cierra con `infoMessage: "Venta procesada"` sin mirar
`printOutcome.printed`.

Consecuencia: hoy, si la POS80 no imprime, la venta **sí** entra al backend y el cajero ve
"Venta procesada". Es exactamente el caso que S3 prohíbe. (Medido, no inferido.)

### 3. No existe el canal "solo registro" — y con este modelo no va a existir

`saleType` tiene dos valores: `"local"` (máquina fiscal + `POST /admin/Orders/orders/local`) y
`"digital"` (backend emite). Los dos terminan en papel POS80 cuando algo falla.

Los únicos caminos que persisten sin papel son **cotización** (`submitQuote` →
`/admin/Orders/cotizacion`) y **nota de entrega** (`submitDeliveryNote` →
`/admin/Orders/nota-entrega`). Ninguno es una venta: no descuentan stock ni cobran.

### 4. La caja no tiene ninguna configuración de impresión

- La caja existe solo del lado del backend: `GET /admin/cajas` →
  `modules/cash-register/api/cashier-accountant.service.ts:227`, con `parseCashBox` (`:27-42`)
  y campos `id, code, name, location, pharmacyId, baseAmountVes, baseAmountUsd, status`
  (`modules/cash-register/types/cashier.types.ts:5-14`). **Ningún** campo de impresión ni serie.
- El binding terminal→caja es por agente: `profile.cajaId`
  (`modules/auth/api/auth.services.ts:131`), resuelto en
  `modules/cash-register/lib/cash-session-binding.ts:52`.
- Todo lo del dispositivo es **local del navegador**: `localStorage "fiscal-serial-port"`
  (`modules/settings/components/FiscalConfigCard.tsx:43-56`), `"fiscal-implementation"`
  (`modules/cash-register/api/fiscal-printer-client.ts:24-45`), servicio en
  `http://127.0.0.1:8000` (`:1`). La POS80 se empareja por WebUSB
  (`modules/cash-register/lib/pos80-usb.ts`).

Este repo no tiene backend propio: solo `app/api/proxy/route.ts`,
`app/api/auth/[...nextauth]/route.ts` y `app/api/orders/stats/route.ts`.

### 5. Los documentos derivados también tienen fallback cruzado

| Superficie | Fiscal | POS80 |
| --- | --- | --- |
| Venta | `cashier-workflow.store.ts:319-339` | `:293 runFallback` |
| Nota de crédito | `orders/components/FiscalNoteDialog.tsx:142` | `:176 runNoteFallback` |
| NC desde facturas | `facturas/components/FacturaNotaCreditoDialog.tsx:109,271` | `:340` |
| Reimpresión | `orders/components/OrderDetailModal.tsx:98` | ídem |
| Cierre Z | `components/ZReportDialog.tsx:163 reportZ()` | `:207 printZReportFallback` |
| Reporte X | `settings/components/FiscalConfigCard.tsx:420 reportX()` | `:440 runXReportFallback` |

Cada uno decide por su cuenta, con la misma regla implícita "si falla, cae a POS80".

### 6. El Z está atado a la farmacia, no a la caja — y esto rompe el modelo nuevo

- El DTO del backend no tiene caja: `CreateZReportDto {z_number, fiscal_serial, fiscal_date,
  invoices}` (`modules/cash-register/types/fiscal-z-report.types.ts`), búsqueda por
  fecha + `zNumber`.
- El Z de POS80 **se inventa la identidad**: `z_number` = `HHMMSS` de la impresión y
  `fiscal_serial` = `${pharmacyId||"NF"}-${fiscal_date}-${z_number}`
  (`modules/cash-register/lib/fiscal-fallback.ts:141,179`).
- Los registros locales están keyed por farmacia: `"last-z-print"`
  (`fiscal-fallback.ts:280-330`) y `"no-fiscal-z-reports"` con clave
  `pharmacyId|fiscalDate|zNumber` (`:228`). El comentario del propio código dice: *"un Z
  impreso en otra caja no aparece acá"*.
- `modules/cash-register/lib/z-report.ts` suma por sesión; el guard
  `z-report-day-guard.ts:96-200` compara contra el serial de la máquina con alcance
  `serial` o `pharmacy`.

Con varias cajas y canales distintos, un Z identificado por farmacia es indistinguible: no se
puede saber qué caja cerró con qué canal. Esto hay que arreglarlo **antes** de S5, no después.

### 7. Qué queda pinneado si se saca el fallback

`test/fiscal-fallback.test.mjs:215-258`, `test/local-sale-fiscal-cart.test.mjs:281`,
`test/z-report-split.test.mjs:66-69`, `test/z-report.test.mjs:86-146`,
`test/z-report-day-guard.test.mjs:85`, `test/local-sale-persist.test.mjs`.

Estos tests no son un obstáculo: son la red que hay que reescribir a la regla nueva, uno por
regla (S1-S7), no borrar.

## Modelo propuesto

### El canal se detecta en la terminal

```
si el servicio fiscal responde en 127.0.0.1:8000  →  canal = fiscal
si no responde                            →  canal = pos80
```

Sin campo que configurar y sin pantalla que recordar. El canal es un **hecho del equipo en ese
momento**, no una preferencia guardada.

Y la distinción que hace que todo lo demás funcione: **"servicio vivo" y "máquina lista" son
dos cosas distintas**.

| Pregunta | Cómo se responde | Qué decide |
| --- | --- | --- |
| ¿Está el servicio fiscal? | `GET /health` | **el canal**: fiscal o POS80 |
| ¿Responde la máquina? | `GET /printer/status` | **si esta venta puede emitir** |

El servicio responde `/health` aunque la impresora esté apagada o sin cable. Por eso S3 existe:
con el servicio vivo el canal es fiscal, y si la máquina no imprime, es error. Nunca POS80.

### Reglas del modelo

- **R1 · El canal se resuelve con una verificación fresca, al momento de vender.** No se usa el
  valor de un chequeo de hace treinta segundos, ni el del diálogo de pago abierto (el defecto
  actual: `fiscalAvailable` se lee de `cashier-workflow.store.ts:319` con un valor cacheado).
- **R2 · Un fallo de impresión no cambia el canal.** Si la máquina fiscal falla, el canal sigue
  siendo fiscal: se muestra el error y **no** se prueba la POS80. Cambiar de canal por un fallo
  de la máquina es reintroducir el fallback por la puerta de atrás.
- **R3 · El canal solo cambia cuando el servicio deja de estar, y de forma sostenida.** Una
  lectura fallida aislada no alcanza (ver histéresis, más abajo).
- **R4 · Papel antes de registrar, y si no hay papel se revierte.** El registro al backend
  ocurre **después** de la evidencia de que el documento existe (COO fiscal, o
  `printed: true` de la POS80). Si el documento no salió, la venta **se tira para atrás**, no
  entra al backend y se muestra el motivo.
- **R5 · El reintento re-emite el documento, no la venta.** La venta fallida deja el carrito
  **intacto**. El botón de reintentar vuelve a pedir el documento **por el mismo canal** donde
  falló, y solo cuando el documento sale se inserta en el backend.
- **R6 · El registro está atado al papel, en las dos direcciones.** Si el papel **salió**, la
  venta **debe** registrarse: reintentar y reconciliar (`local-sale-persist.ts` ya hace la
  escritura única y la reconciliación). Fail-closed aplica a "no hay papel", nunca a "el papel
  existe y el backend falló".
- **R7 · Sin fallback cruzado en ninguna superficie.** Venta, NC, reimpresión, X y Z: cada una
  usa el canal detectado en ese momento. Un fallo del canal no prueba el otro canal.
- **R8 · Lo que se guarda es evidencia, no política.** Cada venta registra **por qué canal
  salió** y **por qué** (servicio presente / servicio ausente). Sin eso no hay reporte ni
  auditoría posible, y la decisión de canal queda invisible.

### La válvula de escape se volvió invisible (y hay que hacerla visible)

Antes la salida era "cambiar el canal, auditado". Ahora que el canal se detecta, la salida real
en una farmacia es **apagar el servicio fiscal**: con el servicio caído, la terminal se pasa a
POS80 sola y sigue vendiendo.

- Ventaja: no hay que explicarle a nadie cómo configurar nada. La farmacia nunca se queda sin
  poder cobrar por un problema de software.
- Costo: ese cambio de canal **no deja rastro de intención**. Nadie sabe si el servicio se cayó
  solo o si alguien lo apagó para poder vender. Y con el servicio caído, la máquina fiscal deja
de registrar: eso es exactamente el origen del descuadre de X y Z de noviembre.

Por eso R8 no es prolijidad: es la única forma de que esto sea auditable. Cada venta por POS80
dice "el servicio fiscal no estaba", y el cierre de caja lo cuenta.

### Lo que sí hay que decidir: qué cuenta como "está vivo"

La detección ingenua (un `GET /health` que falló = servicio ausente) tiene tres formas de
producir un ticket por POS80 que no debía existir:

1. **El servicio se reinicia.** La tarea de actualización corre cada 30 minutos
   (`public/install-fiscal-service.ps1:311`) y reinicia el servicio: hay una ventana de segundos
   donde `/health` no responde. Con detección ingenua, una venta en esa ventana imprime POS80 y
   la fiscal nunca se entera.
2. **Un hipo del proceso.** Un GC, un antivirus, un timeout corto: una lectura fallida aislada.
3. **La ventana de arranque.** El servicio tarda en levantar cuando la PC viene de un corte.

Contramedidas, todas necesarias:

- **Histéresis:** "ausente" exige ausencia sostenida (por ejemplo 3 lecturas fallidas en ~10 s),
  no una. Y para volver a fiscal, una lectura buena confirmada con `printer/status`.
- **Confirmación al vender:** la decisión final se toma con una lectura fresca; el estado del
  vigilante es solo para anticipar la UI, nunca la fuente de verdad.
- **El servicio declara su estado de reinicio** en `/health` ("arrancando", "actualizando")
  para que esa ventana no se confunda con ausencia.
- **Actualización fuera de horario de atención**, configurable, en vez de cada 30 minutos a
  cualquier hora.

## Cómo se queda configurado (para no reconfigurar cada rato)

El pedido no es "que se pueda configurar", es que **no haya que volver a configurarlo**. Eso se
gana poniendo cada dato en la capa que le corresponde y verificándolo antes de vender, no
dejándolo en memoria del navegador.

### Las cuatro capas, y qué pasa si algo se pierde

| Capa | Qué guarda | Dónde vive (hoy) | Se borra el navegador | PC nueva | Se reinstala el servicio |
| --- | --- | --- | --- | --- | --- |
| **Detección** | si el servicio fiscal responde | `/health` en `127.0.0.1:8000`, leído en vivo | — | — | — |
| **Evidencia** | qué canal emitió cada venta y por qué | **no existe** → orden + cierre (backend) | — | — | — |
| **Hardware fiscal** | marca, puerto, baudios | servicio fiscal: `serial_config.json` (`../service_fiscal/app/persistence.py:14,26,39-53`, re-aplicado al arrancar `run.py:70-73`) **y** espejo en `localStorage["fiscal-serial-port"]` (`FiscalConfigCard.tsx:43-58`) | intacto en el servicio, se pierde el espejo | **se pierde entero** | **riesgo real**: el instalador no escribe `HKA_SERIAL_PORT` (`public/install-fiscal-service.ps1:74-79`) y `run.py:60-63` autodetecta: depende de que el archivo sobreviva |
| **Emparejamiento POS80** | permiso USB del navegador (clase 7) | Chrome, por origen — `navigator.usb.getDevices()` (`pos80-usb.ts:53-56`) | **se pierde** | **se pierde** | intacto |
| **Arranque** | tarea AtLogOn + update cada 30 min | Windows, vía instalador (`install-fiscal-service.ps1:306,311`) | intacto | **se pierde** | se re-registra |

Lo que hoy no existe es la primera fila. Y las otras tres nunca se **verifican**: la app entra y
vende sin preguntar si esta terminal está en condiciones.

### El síntoma de que el modelo está mal

`FiscalConfigCard.tsx:180-235` re-aplica el puerto al servicio **cada 15 segundos**, con un
throttle de 30 s por puerto, y escribe el resultado de vuelta en `localStorage`. Eso no es
persistencia: es un parche que existe porque no hay un "estado de la terminal" que alguien
pueda consultar. Con una verificación explícita, ese bucle se elimina.

### Falta la identidad de la terminal

No hay ninguna en el repo (ni device id, ni nombre de equipo, ni registro de terminal). Lo más
parecido es `profile.cajaId` = `agents.cajaId` (`modules/auth/api/auth.services.ts:131`), o sea
la caja está atada al **usuario**, no al equipo.

Propuesta: el servicio fiscal expone `terminal_id` en `/health`, derivado de algo estable del
Windows (MachineGuid / serial del volumen) y guardado en `serial_config.json` la primera vez.
La app lo lee y lo reporta al servidor.

Ya no sirve para elegir canal (eso se detecta), pero sigue siendo necesario para otra cosa: sin
`terminal_id` una venta por POS80 no dice **en qué equipo** pasó, y el reporte de "cuántas
ventas quedaron sin documento fiscal" se vuelve un número suelto. Con `terminal_id`, cada
cierre y cada venta quedan atados a la computadora que los emitió, y se puede ver qué terminal
perdió el servicio y cuándo.

### Detección continua y verificación al cobrar

Dos piezas, con roles distintos y sin confundirlas:

**1. Vigilante (`watchdog`).** Sondea `GET /health` cada pocos segundos y mantiene un estado
vivo. Sirve para la UI ("máquina fiscal activa" / "servicio no detectado") y para anticipar.
**Nunca** decide una venta: su valor puede tener segundos de antigüedad.

**2. Verificación al cobrar (`preflight`).** Decide esta venta, con lectura fresca y tiempo
límite corto. Responde:

```
canalEstado = {
  canal: "fiscal" | "pos80",
  servicio: "vivo" | "ausente" | "arrancando",
  maquina: "ok" | "apagada" | "sin_papel" | "error(motivo)",
  listo: boolean,
  motivo?: string,
}
```

- `GET /health` → `servicio`. "Vivo" decide **canal = fiscal**.
- `GET /printer/status` → `maquina`. Solo se consulta con el servicio vivo, y es lo que
  convierte "hay servicio" en "puedo emitir". Los dos ya existen
  (`fiscal-printer-client.ts:150-176`).
- `servicio: ausente` **sostenido** → `canal = pos80`, y ahí sí se verifica
  `navigator.usb.getDevices()` filtrado por clase 7: pareado sí/no **sin abrir el selector**
  (`pos80-usb.ts:53-56`, `prepairPrinter()` `:131-140`).

Se ejecuta en tres momentos: al abrir sesión, antes del diálogo de pago
(`PaymentDialog.tsx:342`) y después de cualquier fallo. Es lo que convierte "fail-closed" en
algo usable en vez de un error genérico a mitad de cobro.

### Puesta a punto por terminal: una vez, guiada

Ya existe media infraestructura: `medizin-fiscal://install` (`FiscalConfigCard.tsx:325-350`),
descarga firmada con SHA256 (`install-fiscal-service.ps1:44-53`), tareas registradas
(`:306,311`), `/health` con polling. Lo que falta es que ese flujo sea **la puesta a punto de
la terminal** y no solo la instalación del servicio: un checklist, ejecutable por el técnico
que arma la PC, que termina con un veredicto.

1. Servicio instalado y respondiendo `/health` (existe).
2. `POST /config/detect` → puerto detectado y **persistido en el servicio**
   (`PUT /config/serial-port`, existe), guardando además VID/PID/serie del adaptador.
3. `GET /printer/status` verde: la máquina responde de verdad, no solo el servicio.
4. POS80 emparejada: un gesto del técnico, una vez (aplica a cualquier terminal, porque el
   canal puede pasar a POS80 sin aviso si el servicio cae).
5. Terminal registrada en el servidor con `terminal_id`, versiones y fecha.

Dos reglas que hacen que esto no se degrade:

- **En una terminal con servicio fiscal instalado, el checklist no da verde si la máquina no
  responde.** Si el servicio está pero la máquina no, esa caja no vende hasta arreglarlo: es
  S3, y es lo que evita vender todo el día por POS80 sin que nadie lo note.
- **El emparejamiento POS80 se verifica siempre**, porque es lo único que separa "servicio
  caído" de "servicio caído y la caja además no puede vender".

### El puerto COM cambia solo

Un USB re-enumerado puede cambiar de `COM5` a `COM7` sin que nadie toque nada. Por eso el
preflight no compara nombres de puerto: compara **identidad del adaptador**. Si el COM guardado
ya no existe pero el dispositivo con el mismo VID/PID está en otro COM, se re-aplica, se
registra el cambio y se sigue. Si el dispositivo no está, es `falta` con motivo.

### Lo que no se puede automatizar (límite honesto)

En una PC nueva con POS80, Windows necesita el driver del adaptador (Zadig, VID `0483:070b` —
`docs/pos80-webusb-setup.md:5-8`). Eso no lo puede hacer la app sin intervención. La puesta a
punto tiene que **detectarlo y decirlo**, no fingir que la terminal está lista: si el driver
falta, `getDevices()` viene vacío y hoy se confunde con "no emparejada".

## Fases

Ordenadas para que ninguna fase deje el camino fiscal a medio tocar. Cada una trae qué se
construye, cómo se garantiza que no se rompe y cómo se verifica.

### F1 · Detección, verificación y puesta a punto (no cambia la venta)

Con detección el backend se simplifica: **ya no hay campo de canal que configurar**. Lo que se
agrega es evidencia.

**Se construye**

- Módulo `detect-channel` + `watchdog` (sondeo de `/health`) + `preflight` (`canalEstado`), con
  histéresis: "ausente" exige ausencia sostenida, nunca una lectura fallida aislada.
- Consumo en la apertura de sesión (`cash-session-binding.ts:45-61`) y antes del diálogo de pago
  (`PaymentDialog.tsx:342`).
- `terminal_id` en el servicio fiscal, expuesto en `/health`, persistido en `serial_config.json`.
  El hardware se guarda como `{vid, pid, serial_adapter, port, brand}`, no solo como puerto.
- Evidencia por venta: `canal` (`fiscal` | `pos80`) y `motivo_canal` (`servicio presente` /
  `servicio ausente`) + `terminal_id` en la orden. Es campo nuevo en `Backend-administrativo`,
  no configuración.
- `/health` declara los estados `arrancando` / `actualizando` para que esa ventana no se lea
  como ausencia.
- Checklist de puesta a punto sobre `medizin-fiscal://install` + pantalla de veredicto.
- **Cerrar `/configuraciones`**: hoy la ruta no tiene `permit`
  (`components/ui/sidebar/menuConstants.tsx:118-126`) y cualquier usuario logueado puede entrar
  a la configuración fiscal, incluido desinstalar el servicio — que con este modelo **cambia el
  canal de la caja**. Es la superficie más delicada del sistema.
- Keyear por terminal los registros locales de Z de POS80 (`fiscal-fallback.ts:228,280-330`) y
  el cierre de `z-report.ts`, para que un cierre diga de qué equipo salió.
- Cerrar la deuda del Z por serie que ya señala `cuadre-fiscal-fallback-no-fiscal.md`: una
  factura sin `serie_fiscal` hoy no entra a ningún Z. Con canales que pueden mezclarse, dejar
  facturas afuera es peor que antes.
- **Verificar el drift del instalador**: `public/install-fiscal-service.ps1:74-79` no escribe
  `HKA_SERIAL_PORT` mientras `run.py:60-63` y `persistence.py:1-9` asumen que el instalador sí
  fija un puerto. Si una reinstalación deja el servicio autodetectando, la configuración **sí**
  se pierde: ese es exactamente el "configurar cada rato" que hay que eliminar.

**Cómo se garantiza**

- Un solo dueño del hardware: el servicio fiscal es el único que abre el puerto. El navegador
  solo lee estado. Se elimina el bucle de re-aplicación de `FiscalConfigCard.tsx:180-235`.
- Reinstalar el servicio **no pisa** el `serial_config.json` (el instalador no lo toca; queda
  como test de regresión del checklist).
- La detección **no reacciona a un fallo de impresión**: solo a la ausencia del servicio (R2).

**Verificación**: borrar todo el `localStorage` y recargar → la terminal sigue detectando su
canal, sin reconfigurar nada. Apagar el servicio y vender → sale por POS80 y la venta queda
marcada como `servicio ausente`. Matar el servicio **durante** una venta fiscal → error con
motivo, no un ticket por POS80.

### F2 · La venta obedece al canal detectado (el cambio de fondo)

- Router de venta en `cashier-workflow.store.ts`: reemplaza `fiscalAvailable === false →
  runFallback` (`:319`), `:336`, `:339` y el fallback del camino digital (`:426,434`) por el
  canal del `preflight` fresco, con **una sola rama por canal y cero fallback**.
- `fiscal` (servicio vivo): máquina fiscal primero. Si falla —sin papel, apagada, rechazo— se
  revierte el cobro y se muestra el motivo. **No se prueba la POS80**: es S3.
- `pos80` (servicio ausente sostenido): `printNoFiscalTicket` primero; si `printed === false`,
  no se envía la orden. El carrito queda intacto y el reintentar vuelve a imprimir.
- `checkFiscalHealth` (`cashier-workflow.store.ts:548-553`, único llamador
  `PaymentDialog.tsx:111`) se reemplaza por el `preflight`: deja de ser un valor cacheado que
  gatea silenciosamente.
- La venta ya emitida (`fiscalIssued` + `alreadyIssued`, `:317-327`) sigue mandando: con COO
  impreso nunca se re-emite ni se cambia de canal (R6).
- Cada orden registra `canal` + `motivo_canal` (R8).

**Verificación**: con el servicio fiscal vivo y la máquina apagada → error con motivo, la orden
no aparece en el backend, y **no** sale ticket por POS80. Con el servicio apagado → sale por
POS80 y queda marcada. Con la POS80 desconectada y sin servicio → error con motivo, sin
registro.

### F3 · Documentos derivados

NC, reimpresión, X y Z siguen el canal detectado y no cruzan:

- `FiscalNoteDialog.tsx:176`, `FacturaNotaCreditoDialog.tsx:340`,
  `OrderDetailModal.tsx:98`, `ZReportDialog.tsx:207`, `FiscalConfigCard.tsx:440`.
- Un documento derivado usa **el canal del momento**, con la misma regla: si el servicio está
  vivo y la máquina falla, error y no POS80.
- Si el servicio está ausente, la NC se imprime por POS80 (es el único canal que existe en esa
  terminal) y queda marcada como `servicio ausente`.
- `runZReportFallback` (`fiscal-fallback-flow.ts`) queda sin uso productivo (ya lo está: hoy
  solo lo usan los tests) y el Z toma la identidad de la caja (R6).

### F4 · Control, reporte y vigilancia

- Panel: ventas por canal, por terminal y por día; contador de **intentos rechazados** por canal
  (no son ventas: son ventas que no ocurrieron) con su motivo, para ver qué equipo está
  fallando antes de que lo reporte la operadora.
- El cierre muestra el canal de la terminal y bloquea el cierre si quedó **papel emitido sin
  registrar** (R6: el caso inverso, que sí es una venta y no puede perderse).
- El cierre declara, si el día tuvo los dos canales, cuántas ventas fueron por cada uno y que la
  máquina fiscal no contó las de POS80.
- Reusar `fiscal_service_event` (`fiscal-service-error-capture.md`, T3-T4) como evidencia
  cuando el canal fiscal falle: hace diagnosticable el fallo sin abrir el camino de venta.
- Estado de terminales visible: por cada `terminal_id`, canal, versiones del servicio, último
  chequeo verde y último fallo. Es el panel que evita el llamado "no sé qué le pasa a esa caja".
- Ventana de actualización: la tarea de update corre cada 30 minutos (`install-fiscal-service.ps1:311`)
  y reinicia el servicio. Con fail-closed, una actualización en horario de atención **frena la
  caja**: la ventana se configura fuera de horario y, si igual se cruza, el preflight lo dice
  con ese motivo y no con "error desconocido".

## Matriz de fallos (qué garantiza el diseño)

El punto de la fase 1 no es la prolijidad: es que cada fila de acá tenga respuesta escrita antes
de tocar la venta.

| Situación | Qué pasa con la venta | Qué la salva |
| --- | --- | --- |
| Se borra el navegador / caché | Sigue funcionando | El canal no estaba guardado en ningún lado: se detecta |
| PC nueva **sin** servicio fiscal | Vende por POS80 | Detección; el checklist empareja la POS80 una vez |
| PC nueva **con** servicio fiscal | No vende hasta que la máquina responda | Checklist: servicio verde pero máquina muda = no da verde |
| Servicio fiscal no arrancó | Vende por POS80, marcado `servicio ausente` | Detección + R8 (evidencia) |
| Tarea programada no registrada | Al día siguiente vende por POS80 | Mismo caso: el reporte lo muestra, no se disimula |
| **El servicio se reinicia por la actualización** (cada 30 min) | **Riesgo de ticket POS80 espurio** | Histéresis + estado `actualizando` en `/health` + ventana fuera de horario |
| Un hipo aislado de `/health` | Nada: sigue fiscal | Histéresis: hace falta ausencia sostenida |
| Cambió el COM por re-enumeración | Vende | Detección por VID/PID + re-aplicación registrada |
| Máquina fiscal apagada **con servicio vivo** | **Error, no POS80** | `printer/status` en preflight; S3 |
| Sin papel / papel trabado | Error, no POS80 | Error de `POST /invoices` con motivo; carrito intacto |
| Alguien apagó el servicio para poder vender | Vende por POS80 | Nada lo impide **por diseño**; R8 lo hace visible por venta y en el cierre |
| Servicio muere **a mitad** de una venta fiscal | Error con motivo; no se reintenta sola | Respuesta ambigua = no hay evidencia de que no salió; se consulta estado antes de reintentar (regla de `local-sale-persist.ts`) |
| USB desconectado **a mitad** de impresión POS80 | Se frena, no se registra | Igual que arriba: la ambigüedad no se reintenta sola |
| Corte de luz a mitad de venta | Puede existir papel sin fila | Al volver: se reconcilia contra el libro y el último número de la máquina (R6) |
| Red caída **después** de que salió el papel | Se registra igual | R6: papel emitido obliga a registrar |
| Backend rechaza la orden con papel ya emitido | Se informa el COO, no se re-emite | `quoteBlockReason` / `fiscalIssued` ya lo impiden |
| Día con los dos canales (servicio cayó al mediodía) | Venta por venta está bien | R8: el cierre declara cuántas fueron por cada canal; la máquina fiscal no contó las de POS80 |
| Driver USB faltante en PC nueva | No vende por POS80 | El checklist lo dice como "driver faltante", no como "no emparejada" |
| Dos cajas en la misma PC | Comparten canal | Consecuencia de detectar por equipo: el hardware es uno |

## Riesgos

| Riesgo | Cuándo pega | Mitigación |
| --- | --- | --- |
| **Fail-closed frena la caja** (corte de luz, papel trabado) | F2 | Aceptado por decisión. La única salida es apagar el servicio (**visible por R8**), no un fallback |
| **Facturas huérfanas** si se implementa "no registra" sin R6 | F2 | `local-sale-persist.ts` es la pieza que ya cumple R6: no se toca su contrato |
| **Ticket POS80 espurio en la ventana de reinicio del servicio** | F1 | Histéresis + estado `actualizando` + ventana de actualización fuera de horario |
| **Un día con dos canales** deja la Z fiscal incompleta | F2/F4 | R8: canal por venta + el cierre declara el conteo por canal |
| **Reescribir el camino fiscal** (`saleType: "local"`) | F2 | Fases separadas; un commit por regla; tests reescritos uno por S# |
| **Backend sin los campos de evidencia** bloquea F1 | F1 | Es multi-repo: `Backend-administrativo` requiere deploy |
| **Drift del instalador**: sin `HKA_SERIAL_PORT`, una reinstalación deja el puerto autodetectado | F1 | Verificarlo y fijar el puerto en el instalador; test de regresión del checklist |
| **`/configuraciones` abierta a cualquiera** (incluido desinstalar el servicio = cambiar de canal) | F1 | Gate por `permit`/rol antes de F2 |
| **POS80 depende del permiso del navegador y del driver** | F1 | `terminal_id` + checklist que separa "falta driver" de "no emparejada" |
| **Alguien apaga el servicio para poder vender** | siempre | No se puede impedir: se hace **visible** (R8) y se reporta por terminal |

## Decisiones tomadas

1. **Alcance del fail-closed: revertir, no acumular.** Si el canal falla, la venta no se
   procesa: se tira para atrás con el motivo a la vista. No hay venta pendiente ni cola. El
   carrito queda intacto y el reintento vuelve a pedir el documento al mismo canal; recién con
   el documento emitido se inserta en el backend (R4, R5).
   > "si falló, listo, tiras para atrás… no se pudo procesar la orden por el motivo y decirle el
   > motivo. Y eso y nada más… el botón reintentar, se intenta por la máquina fiscal, por
   > ejemplo, así fuera donde falló, y después se inserta en el backend"
2. ~~El canal vive en el servidor, como campo de la caja.~~ **Derogada el 18/11/2026**: el canal
   ya no se configura, se detecta (S1). El servidor guarda **evidencia** (`canal`,
   `motivo_canal`, `terminal_id`), no política.
3. ~~`registro` es un modo permanente de la caja.~~ **Derogada el 18/11/2026**: el tercer canal
   no existe (S7). Solo hay fiscal y POS80.

## Decisiones que faltan (son del negocio, no del código)

4. **Qué cuenta como "servicio vivo".** Recomiendo: ausencia sostenida (3 lecturas fallidas en
   ~10 s) + estado `actualizando` declarado por el servicio. El número exacto se calibra contra
   la PC real de una farmacia, midiendo cuánto tarda en levantar después de un corte. Sin esto,
   un reinicio de la tarea de actualización imprime un ticket POS80 que no debía existir.
5. **Camino `digital`.** Hoy una venta `digital` la factura el backend
   (`/admin/Orders/insertorder`) sin máquina local. Con detección, ¿ese camino sigue disponible
   o también queda sujeto al canal detectado?
6. **Inventario real de terminales.** Necesito saber, por farmacia, cuántas computadoras cobran
   y cuáles tienen el servicio fiscal instalado. Con detección por equipo, ese inventario **es**
   la configuración: sin él no se sabe cuántas terminales van a caer a POS80 el día del corte.
7. **La X y la Z con dos canales en el día.** `cuadre-fiscal-fallback-no-fiscal.md` (Propuesta
   D) deja abierto si la X mide turno o caja. Ahora se agrega la pregunta que importa más: si
   el servicio se cayó al mediodía, ¿cómo se declara un cierre que tiene ventas fiscales y
   ventas POS80? La máquina fiscal no conoce las de POS80, así que el Z del ERP y el Z del papel
   no pueden coincidir por construcción. Hay que decidir qué dice el papel y qué dice el ERP.

## Non-goals

- No implementa nada: este documento es planificación.
- No toca el contrato POS↔servicio fiscal (`fiscal-printer-client.ts`) ni el backend en esta
  etapa.
- No resuelve el descuadre de X/Z por sí solo: lo hace **posible**, porque hoy hay tres marcos
  que no coinciden (ver el otro documento).
- No reemplaza la captura de fallos del servicio fiscal: la complementa.

## Slice boundaries

La guía de revisión pide cortes de ~400 líneas cambiadas; esta rama los excede porque el
documento de planificación es un solo artefacto (589 líneas por sí solo). Cortes reales:

1. `b2d1c3d` — el documento de planificación (artefacto único, no se puede partir sin
dejar de leerse como una unidad).
2. `144c837` — detección de canal + emparejamiento POS80 + tests.
3. `020b0a4` — la venta obedece al canal, con el papel como condición del registro.

El corte que importa para revisar es el 3: cambia el camino del dinero. Los otros dos no
alteran comportamiento de venta.

## Log

- **L1** — Pedido original: *"verifica que quiero hacer un camino está en este sistema sabes
  que trabajamos como una post 80 y una máquina fiscal… no vamos a hacer cambios de código,
  vamos a hacer nada más una planificación para poder almacenar eso, es decir esa farmacia
  está almacenada para que imprima por una post 80 o por una máquina fiscal pero no tener el
  arpos 80 como un fallback, sino que por ejemplo si falla la máquina fiscal no envíe nada para
  el back y no vaya para el fallback de la post 80, y bueno si falla la post 80 no inserta en
  la base de datos, es decir no se manda… pero primero tenemos que hacer una implementación y
  una tercera opción que sea… yo quiero registrar mis ventas y aparte de eso hay que tomar el
  caso de que a lo mejor una farmacia tiene varias cajas y una caja sale por una post 80, otra
  caja por la impresora fiscal… porque si la máquina fiscal no está conectada va a salir un
  error y no va a enviar nada por el backend porque saben que no salió nada en la máquina
  fiscal"*.
- **L2** — Medición: el fallback hoy se dispara en cuatro lugares del store y **no** condiciona
  el registro al resultado del papel (`fiscal-fallback-flow.ts:196-225` más
  `cashier-workflow.store.ts:301`). El defecto de S3 existe hoy, y es el inverso del que la
  documentación previa suponía.
- **L3** — Decisiones del 18/11/2026: (a) fail-closed por reversión, sin cola de pendientes —
  falla el canal, la venta no se procesa, se informa el motivo, el carrito queda intacto y el
  reintento re-emite el documento por el mismo canal antes de insertar en el backend; (b) el
  canal es un campo de la caja en el servidor, con auditoría, y el hardware queda local; (c)
  `registro` es un modo permanente de la caja, no por jornada, con la consecuencia operativa
  aceptada de que una caja caída no vende.
- **L4** — Pedido original del 18/11/2026: *"hagamos una planificación de todo, cómo podemos
  hacer cada una de las cosas para que siempre funcione. Por ejemplo, que la configuración se
  quede y no tengan que estar configurando eso cada rato"*. Respuesta: la configuración se
  reparte en cuatro capas (política en el servidor, hardware en el servicio fiscal,
  emparejamiento POS80 en el permiso del navegador, arranque en las tareas de Windows) y se
  verifica con un preflight antes de vender; nada queda en `localStorage` como fuente de verdad.
  F1 se reordena para empezar por ahí, incluido el drift del instalador y el gate de
  `/configuraciones`.
- **L5** — Revisión del 18/11/2026: *"lo que podemos hacer es trabajar en función de que a lo
  mejor no toca configurar… si se detecta que está el servicio fiscal en la computadora, sabés
  que vas a ir por la máquina fiscal y si falla, borrar el fallback de la pos 80. Si no detecta
  el servicio fiscal es que va a ir para la pos 80. Y vamos a quitar el caso de que es puro
  vender normal, es decir venta sin mandar por la fiscal ni por la pos 80… verificando
  constantemente si está el servicio fiscal activo… tienes que verificar con el health, saber
  que está vivo… en caso de que falle me tiene que mandar un mensaje: mirá, falló porque la
  máquina fiscal no quiso imprimir"*. Cambios: el canal pasa de **configurado** a **detectado**
  (S1-S2), se deroga el tercer canal `registro` (S7) y la S4/S5 anteriores; se agregan S5
  (verificación constante + fresca) y S6 (motivo concreto). Se reescriben reglas, matriz de
  fallos y F1/F2; se agrega la sección de histéresis y la consecuencia de que apagar el servicio
  es la nueva válvula invisible.
- **Ambigüedad registrada (L5)** — El pedido contiene una frase que puede leerse al revés:
  *"si está activo el servicio fiscal y lanza un error, esto significa que la pos 80 tiene que
  imprimir por la pos 80"*. Se implementa la lectura consistente con el resto del mensaje
  ("borrar el fallback de la pos 80" y "me tiene que mandar un mensaje: falló porque la máquina
  fiscal no quiso imprimir"): **servicio vivo + máquina que falla = error, nunca POS80**. Si la
  intención fuera la contraria, el diseño vuelve a tener fallback y la S3 cae.
- **L6** — Implementación del 18/11/2026 (T1-T6). Detección en
  `modules/cash-register/lib/channel-detect.ts`: `GET /health` decide el canal, `GET
  /printer/status` decide si la venta puede emitir; la ausencia exige dos lecturas fallidas
  porque la tarea de actualización reinicia el servicio cada 30 minutos. `runOrderFallback` pasó a
  devolver `printed` y **no registra sin papel**. `registerSale` rutea por canal y el camino
  fiscal ya no cae a POS80. `PaymentDialog` prepara WebUSB solo en canal `pos80`, dentro del gesto
  del click. Evidencia: `test:channel` 7/7, `test:fiscal-fallback` 33/33, `test:local-sale-cart`
  7/7, `test:local-sale` 14/14, `test:fiscal` 69/69, `tsc --noEmit` limpio, y lint sin regresión
  (31 problemas antes y después, todos preexistentes). Commits `144c837` y `020b0a4`.
- **L7** — Deuda declarada, no silenciada: T7 (evidencia `canal`/`reason`/`terminal_id` en la
  orden) requiere `Backend-administrativo`; T9 (vigilante continuo y estado `actualizando` del
  servicio) requiere `service_fiscal`. Sin T7 el reporte de "cuántas ventas salieron por POS80 y
  por qué" no existe todavía: hoy solo queda en el log del navegador.
- **L8** — Riesgo residual anotado por el worker: el canal se lee dos veces (diálogo y venta). Si
  el servicio cae entre las dos lecturas, el diálogo pudo preparar la POS80 y la venta falla con
  error (no hay fallback); si pasa lo inverso, la impresión POS80 puede necesitar un gesto de
  WebUSB que ya no está. Es el precio de detectar fresco en vez de reusar estado, y se mitiga con
  T9 (vigilante) en la UI para que el operador lo vea antes de cobrar.
- **L9** — Corrección del 18/11/2026: **no se toca `service_fiscal`**. Ya expone `/health` y eso es
  todo lo que la detección necesita; el estado `actualizando` que proponía T9 se descarta y el
  vigilante queda del lado del POS. Consecuencia: la histéresis (dos lecturas fallidas) es la
  única protección contra la ventana de reinicio, así que su calibración importa más, no menos.
- **L10** — Defecto encontrado al verificar (no por un test que ya existiera, por una sonda): con
  el canal POS80 y el papel ya impreso, si el backend rechazaba la orden, `runOrderFallback` se
  tragaba el error y devolvía `printed: true`; el store anunciaba **"Venta registrada con
  comprobante POS80"** con `errorMessage: null`. Una venta perdida en silencio, con el ticket en
  la mano del cliente: exactamente lo que R6 prohíbe en la dirección inversa. Arreglado: el
  outcome lleva `persisted` + `persistError` y el store muestra el motivo real, con la instrucción
  de no reimprimir. Test: `test/sale-channel.test.mjs` (caso 8), observado en rojo antes del
  arreglo.
- **L11** — Cierre del 18/11/2026 (T11, T12, T13-parcial). **T11**: los documentos derivados ya
  obedecen al canal. Nuevo gate puro `documentChannelBlockReason` en `fiscal-fallback-flow.ts`;
  `printZReportFallback`, `runXReportFallback` y `runNoteFallback` aceptan `channel` y con canal
  fiscal **no** imprimen por POS80 ni persisten. `ZReportDialog` resuelve el canal antes de
  imprimir y su pantalla de error ya no ofrece "Imprimir en la POS80"; `usesDigitalBilling` deja
  de decidir el canal del Z. `FacturaNotaCreditoDialog` y `FiscalConfigCard` (X) rutean por canal.
  La NC de la caja (`modules/orders/components/FiscalNoteDialog.tsx` — la ruta que yo había escrito
  mal) resuelve el canal en el gesto del click y decide con el helper puro
  `describeNoteFallbackOutcome`: papel y registro son dos hechos, y no se anuncia una nota emitida
  sin los dos. Se cerró además el `createCreditNote` sin try/catch que dejaba el diálogo colgado.
  **T12**: `channel-watchdog.ts` + `useChannelStatus` (nie: solo del lado del POS, `service_fiscal`
  intacto), integrado en la pantalla de pago: el cajero ve el canal antes de cobrar y si la máquina
  no responde lo ve en rojo, no al fallar la venta.
- **L12** — Verificación completa antes de publicar: **453 tests, 0 fallos** (22 suites de
  `package.json` + `note-channel` 13 + `channel-watchdog` 9), `tsc --noEmit` limpio, `npm run build`
  exit 0, y `eslint` sin regresión en cada archivo tocado (comparado contra `HEAD` con
  `--stdin-filename`).
- **L13** — Deuda viva que queda declarada: (a) **T13** — la evidencia de canal por orden sigue sin
  existir en la base. `ModelOrder` (`src/shape/src/models/pruebas.rs:77`, repo
  `Backend-administrativo`) **no** tiene `deny_unknown_fields`, así que hoy el POS podría mandar
  `canal`/`motivoCanal`/`terminalId` y el backend los ignoraría en silencio: no rompe, pero tampoco
  guarda. Ese repo está parado en la rama `fix/supplier-scope-grupo` con trabajo ajeno en curso, así
  que el cambio pide rama propia desde `dev`, campos opcionales con `#[serde(default)]`, su review y
  su deploy. (b) `runNoteFallback` acepta `channel` opcional y sin él asume POS80 (lo exige
  `test/fiscal-fallback.test.mjs`): un call site nuevo que lo omita reintroduce el fallback en
  silencio; volverlo obligatorio es un cambio de una línea con su test. (c) La NC de la caja en canal
  POS80 conserva el diseño "imprime primero, reintenta persistir": no se pasó a fail-closed porque no
  es una venta y no se pidió. (d) `fiscalNotesService.createNotaCredito` (camino digital) sigue sin
  try/catch.
