# Modo de facturación de la farmacia: digital, fiscal o simple

Documento de **planificación**. No contiene cambios de código. Complementa
`odd/tasks/canal-comprobante-por-caja.md` (que resuelve *por dónde* sale el papel de una
terminal) — esto resuelve *qué documento tiene que existir*, que es una decisión distinta y
anterior.

## Specs

- **S1** — La farmacia declara, al crearse, con qué emite:
  > "hay tres posibilidades: o vas con facturación digital, o vas con máquina fiscal, o va simple"
- **S2** — `simple` **no** es "no registrar": la orden, la factura, las transacciones y el
  inventario se hacen igual.
  > "igualmente tienes que insertar la orden, crear la factura, crear todas las transacciones,
  > hacer ese proceso"
- **S3** — `simple` no pasa por la máquina fiscal, ni por la POS80, ni por facturación digital.
  > "simple es que no va a pasar por la máquina fiscal ni por la pos ni por facturación digital"
- **S4** — El modo se elige al crear la farmacia, no venta por venta.
  > "tú puedes escoger cuando se crea la farmacia"

## Tasks

| ID | Qué | Repo | Estado |
| --- | --- | --- | --- |
| **T1** | `ModelPharmacy.modo_facturacion` (`digital`\|`fiscal`\|`simple`) + `modoFacturacion` en `PresentAgent`, derivado de `active_modules` cuando falta (compatibilidad). | Backend | Hecho (`b050003b`) |
| **T2** | Tercera rama en `pipeline.rs`: `simple` no llama a TFHKA ni a la máquina fiscal; secuencia `SIMPLE-<n>` por farmacia (idiom de `cotizacion_secuencia`). | Backend | Hecho (`f732e463`) |
| **T3** | `es_movimiento_fiscal: false` y `tipo_comprobante: "no_fiscal"` en la factura/transacción del modo `simple`. | Backend | Hecho (`f732e463`) |
| **T4** | Selector de modo en `CrearFarmaciaModal` y `EditarFarmaciaModal` (precedente `MODULOS`). | Admin general | Hecho (`e5384d2`) |
| **T5** | `modoFacturacion` en el perfil del ERP (`auth.services.ts`) y tercer camino en `registerSale`. | ERP | Hecho (`af4ab35`) |
| **T6** | Reportes: el libro fiscal y el Z excluyen `tipo_comprobante = "no_fiscal"` y lo desglosan; el arqueo cuenta el efectivo de las ventas `simple`. | Backend + ERP | Hecho en backend (`0e7a5e4f`) |

### Topología confirmada (28/11/2026)

- `pharmacies` y `factura` son **SCHEMALESS** (`INFO FOR DB`): los campos nuevos **no** necesitan migración.
- El modo, si falta el campo, se deriva de `pharmacy.active_modules.contains(DigitalBilling)` — es lo que hoy alimenta `usesDigitalBilling` (`agent/src/infrastructure/repositories.rs:453-457` → `adapters/present.rs:27`). Así **ninguna farmacia cambia de comportamiento**.
- El alta vive en `Backend-administrativo`: `POST /admin/Pharmacy/createpharmacy` con `web::Json<ModelPharmacy>`, y el formulario en `general-administrative-medizin./features/farmacias/components/CrearFarmaciaModal.tsx`.
- `es_movimiento_fiscal: true` está hardcodeado en `accountant/src/infrastructure/repositories/new.rs:1376` (`build_transaccion_fiscal`).
- Secuencia por farmacia: precedente `cotizacion_secuencia:{farmacia}` → `COT-{farmacia}-{n}` (`orders_actions/src/infrastructure/repositories.rs:2502,2531`).

## Lo que ya existe (medido el 28/11/2026)

La cadena contable **ya corre completa** y no depende del modo: lo verifiqué con una venta real
digital (`orders:ORD-1795882202902`, Corporacion Tial, 203,80 Bs).

| Paso | Registro | Cuándo |
| --- | --- | --- |
| Orden | `orders` | t=0 |
| Stock (`pharmacy_inventory`, CAS `applied_order`) | — | asíncrono |
| Movimiento de inventario | `movimiento_inventario` (Venta / Salida, `venta_numero_control`) | +2 s |
| Factura | `factura` (+ `detalle_factura`) | +3 s |
| Transacción | `transaccion` (`comprobante_id`, `monto_ves`, `es_movimiento_fiscal`) | +3 s |
| Ingreso y CxC (solo crédito/Cashea) | `acumular_ingreso_venta`, `movimientos_financieros` | +3 s |

Todo eso lo dispara un pipeline **después** de responder el HTTP
(`pipeline.rs:610`, `tokio::spawn`), y por eso la respuesta no trae `facturacion`.

### Dónde se decide hoy

`pipeline.rs:99` ramifica por un solo dato: si la orden trae `numero_control_interno` (la
máquina fiscal ya emitió) se salta TFHKA; si no, se le pide el comprobante a TFHKA. **No hay
tercera rama.** El "simple" de hoy es el accidente: cuando TFHKA falla, el backend escribe la
factura con `numero_control = "FALLO-####"`.

Y eso es el problema que hay que resolver antes de agregar el modo: hoy **no se distingue "fallé
emitiendo" de "esta farmacia no emite"**. Medido en producción el 28/11: Corporacion Tial, **8 de
8** facturas del día con `FALLO-`; otra farmacia, 2. Si `simple` también escribiera un
`FALLO-`, el libro fiscal sería ilegible.

## Diseño propuesto

### El modo se elige en el administrador general

La farmacia se crea en `general-administrative-medizin` (administrador general), **no** en el ERP.
Por eso la opción de las tres modalidades tiene que aparecer en ese formulario, al crear la
farmacia, y después en su pantalla de edición. Son tres repos, no uno:

| Repo | Qué cambia |
| --- | --- |
| `general-administrative-medizin` | el formulario de alta de farmacia: las tres opciones, y la edición con auditoría |
| `Backend-administrativo` | `pharmacies.modo_facturacion`, la tercera rama del pipeline y los campos de la factura |
| `ERP_medizin_web` | el tercer camino del POS (sin canal, sin impresora) y los reportes |

Y una regla de orden: **el backend primero**. Si el formulario del administrador ofrece `simple`
antes de que el pipeline sepa emitirlo, una farmacia puede quedar en un modo que el backend
todavía no entiende.

### 1. El modo es un campo de la farmacia

```
pharmacy.modo_facturacion ∈ { "digital", "fiscal", "simple" }
```

- Se elige al crear la farmacia, y cambiarlo es un acto auditado (quién, cuándo, de qué a qué,
  por qué) — nunca un toggle del POS.
- **El modo manda sobre la detección de la terminal.** Si la farmacia es `simple`, el POS no
  resuelve canal, no prepara WebUSB y no exige POS80: no hay papel que sacar. La detección de
  `canal-comprobante-por-caja` solo aplica dentro de `fiscal` y `digital` (ahí sí hay documento
  que respetar).

### 2. Tercera rama en el pipeline, no un atajo

En `pipeline.rs` el modo entra **antes** de la rama de `numero_control_interno`:

| Modo | Emisión | Control | `es_movimiento_fiscal` |
| --- | --- | --- | --- |
| `fiscal` | máquina fiscal (POS) → `numero_control_interno` | COO real | `true` |
| `digital` | TFHKA (backend) | COO real de TFHKA | `true` |
| `simple` | **ninguna** | `SIMPLE-<secuencial por farmacia>` | **`false`** |

Y todo lo demás **idéntico**: `detalle_factura`, `transaccion`, ingreso, CxC, `movimiento_inventario`,
stock por CAS. La diferencia entre los tres modos es de una sola escritura, no de camino.

### 3. Que no se pueda confundir "falló" con "no emite"

Hoy `FALLO-####` significa "fallé". Con `simple` tiene que significar otra cosa. Dos campos
obligatorios en `factura`:

- `tipo_comprobante`: `"fiscal" | "no_fiscal" | "fallo"`.
- `modo_facturacion`: el que tenía la farmacia al emitir.

Así `FALLO-` queda reservado a **error**, y `simple` es un estado declarado. Sin esto, el
reporte de "ventas sin documento fiscal" mezcla dos cosas que se arreglan distinto: una es un
bug de emisión, la otra es una decisión del negocio.

### 4. El POS

`registerSale` gana un tercer camino, y es el más simple de los tres:

- `simple` → envía la orden y nada más. Sin detección de canal, sin `/health`, sin WebUSB, sin
  papel. El comprobante contable lo escribe el backend.
- No hay reintento de impresión porque no hay impresión.
- Si la emisión del backend falla, se informa (nunca se inventa papel).

### 5. Reportes y cierres

- El **libro fiscal** filtra `tipo_comprobante = "fiscal"`. Las `simple` no entran.
- El **cierre de caja** declara cuántas ventas fueron `simple` y las muestra aparte: no son
  ventas sin respaldo por accidente, son ventas sin comprobante por decisión.
- El reporte de "facturas en `FALLO`" queda como alarma de emisión, separado.

## Fases

- **F1 · Campo y modo (sin cambiar comportamiento).** `modo_facturacion` en `pharmacies` (backend,
  con su migración y su default por farmacia existente), auditoría del cambio, y que el pipeline lo
  lea y lo registre **sin** usarlo todavía. **El formulario del administrador general** gana las tres
  opciones, deshabilitando `simple` hasta que F2 esté desplegado. Las farmacias existentes quedan en
  su modo actual; nadie pasa a `simple` por default.
- **F2 · La tercera rama.** Emisión `simple` con `SIMPLE-<secuencial>`, `tipo_comprobante` y
  `es_movimiento_fiscal: false`, con la cadena contable completa. Test contra una orden real:
  factura + transacción + movimiento + stock, y **cero** llamadas a TFHKA y a la máquina fiscal.
- **F3 · El POS.** El tercer camino de `registerSale` y la UI sin canal ni impresora.
- **F4 · Reportes.** Libro fiscal filtrado, cierre con el desglose, y la alarma de `FALLO`
  separada.

## Decisiones que hay que tomar antes de F2

1. **Qué recibe el cliente** en modo `simple`: nada, o una nota de venta interna sin membrete
   fiscal. Cambia el POS y el papel.
2. **Si `simple` admite crédito y CxC** igual que los otros modos, o queda restringido a contado.
3. **Numeración**: secuencial independiente por farmacia, y qué pasa si se agota o se reinicia.
4. **Quién puede cambiar el modo** de una farmacia que ya vendió: la contadora tiene que opinar,
   porque cambia qué documento respalda las ventas de ayer.
5. **Las 8 `FALLO` de Corporacion Tial**: mientras no se resuelva la emisión de esa farmacia,
   pasarla a `simple` sería tapar un bug con una decisión de negocio. Primero la causa (TFHKA),
   después el modo.

## Non-goals

- No reemplaza el canal por terminal: `fiscal` sigue necesitando su canal (máquina fiscal o
  POS80) resuelto y verificado.
- No convierte `FALLO` en un modo válido. `FALLO` es un error, siempre.
- No toca el contrato del POS con el servicio fiscal.

## Lo que la verificación del 28/11 dejó como disparador

Antes de planificar el modo `simple` medimos por qué una farmacia digital estaba fallando. Vale
como contexto, porque es exactamente el problema que `simple` no debe tapar:

- **Causa raíz:** la farmacia `pharmacies:01KRFNKFZ7YVRGZQFN02WYJ2WX` no tiene **ninguna**
  credencial en `secure_credentials` (ni `tipo: facturacion` ni de otro tipo). Sin credencial,
  `tfhka_uc.execute` devuelve `Err` en cada venta → `FALLO-####`. **8 de 8** facturas del día.
- **Por qué no se notó:** el camino de fallo escribía `facturacion.success: true` y `error: None`
  hardcodeados (`pipeline.rs`), así que la orden declaraba éxito con un número que no es un
  comprobante. El motivo real solo quedaba en una línea de `tracing::error!`.
- **El contador `FALLO` es global**, compartido por todas las farmacias (`contador_fiscal:FALLO`),
  no por farmacia: los números se intercalan y no sirven para conciliar.
- Comparación que confirma el diagnóstico: la otra farmacia con `FALLO` hoy tiene 28 facturas y
  solo 2 fallidas, porque sus ventas pasan por la **máquina fiscal** (`numero_control_interno`) y
  se saltean TFHKA. La que falla 8 de 8 es la que **solo** factura por backend.

Arreglo de código ya aplicado en el backend (rama `feat/facturacion-fallo-honesto`): el fallo se
persiste como `success: false` con el motivo real (acotado a 500 caracteres), conservando
`FALLO-<n>` para identificar la fila y sin tocar `sale_status`. El ERP ya lo interpreta bien:
muestra `Estado: Error: <motivo>` en el detalle de la orden.

**Lo que este cambio no arregla**, y hay que decirlo: las filas históricas con `FALLO-` y
`success: true` siguen mintiendo, y la credencial de esa farmacia sigue faltando. Ninguna de las
dos cosas se resuelve con código.

## Estado de la implementación (28/11/2026)

Las tres piezas están desplegadas. **Ninguna farmacia está en `simple`**: el modo se elige por farmacia en el administrador general y, mientras nadie lo elija, todo sigue exactamente como antes.

### Lo que quedó funcionando

- El modo se declara en el alta y la edición (`admintest.medizins.com`), con el aviso de que en `simple` las ventas no tendrán comprobante fiscal.
- El backend lee el modo **de la fila de la farmacia**, nunca de lo que manda el POS. En `simple`: no llama TFHKA, escribe `factura.numero_control = SIMPLE-<n>` con secuencia **por farmacia** (`facturacion_simple_secuencia`), `serie_fiscal: None`, `tipo_comprobante: "no_fiscal"` y `es_movimiento_fiscal: false`.
- La cadena contable e inventario corre igual: `detalle_factura`, `transaccion`, ingreso, CxC, `movimiento_inventario`, stock por CAS y MQTT.
- El arqueo **cuenta el efectivo** de esas ventas (antes lo excluía de los dos lados y el cierre habría mostrado la diferencia).
- El Z fiscal no suma las `simple` ni las usa como rango de documentos; viajan en un bloque propio (`non_fiscal_sales`) que ahora sí se persiste.
- El POS tiene el tercer camino: envía y no toca canal, WebUSB ni papel.
- Bug encontrado y cerrado en el camino: el chequeo anti-duplicado de `numero_control` era global, así que la primera venta `simple` de una segunda farmacia colisionaba con el `SIMPLE-1` de la primera.

### Deuda declarada (no bloquea)

- El **cierre de caja** calcula el desglose de ventas sin comprobante pero `sesion_impl.rs` todavía no lo expone en la respuesta: el número no llega a la pantalla del cierre.
- `useFiscalPrinterConnection` y `FiscalConfigCard` del ERP siguen tratando "no digital" como "tiene máquina fiscal"; en modo `simple` eso muestra una conexión fiscal que no existe.
- Una devolución no fiscal se informa como gasto operativo: la caja cuadra, el desglose no fiscal queda bruto.
- El bloque `non_fiscal_sales` va en VES, igual que los demás bloques del Z: una venta `simple` en USD entra al arqueo (líquido USD) pero no al bloque.
- Las filas históricas con `FALLO-` y `success: true` siguen mintiendo: no hay migración.

## Segunda verificación independiente (28/11, tras desplegar)

Encontró cuatro defectos latentes antes de la primera venta real.

### Cerrado

- **La sesión quedaba con el modo viejo.** El login guarda una foto y el refresh del JWT la
  reutiliza: una farmacia pasada a `simple` seguía imprimiendo comprobante fiscal en su máquina
  mientras el backend escribía `SIMPLE-<n>` — papel fiscal sin registro. Ahora el POS corrige el
  modo en cuanto el backend emite un control `SIMPLE-` (`modules/cash-register/lib/billing-mode-drift.ts`).
  Corrige **solo hacia `simple`**: es la única dirección con consecuencia. Commit `66e8811`.

### Cerrados (28/11, backend `6ae2a13a` + ERP `21dac8b`)

1. **La NC hereda la clase fiscal del documento afectado.** `afectado_es_fiscal()` lee
   `factura.tipo_comprobante` del documento acreditado (una lectura, antes de escribir) y la
   transacción de la nota se escribe con `es_movimiento_fiscal: false` cuando es `no_fiscal`.
   Ausente o ilegible = fiscal: ninguna fila existente cambia. En el ERP, el listado lleva
   `tipo_comprobante` y la NC de una factura no fiscal va por el camino local, no por TFHKA.
2. **Anular una venta `simple` ahora la encuentra.** `OrdenAnulable` lleva
   `facturacion_control` (el número que emitió el backend, `orders.facturacion.numero_control`)
   y `candidatos_numero_control` lo incluye: la resolución por control también busca ahí, así
   que la factura y la transacción se marcan anuladas. Las ventas fiscales resuelven igual que antes.
3. **`modo_facturacion` inválido devuelve 400.** El DTO de escritura valida al deserializar
   (normaliza espacios y mayúsculas); `"SIMPLEE"` o `""` ya no se guardan con 200.

Evidencia: `accountant` 228, `orders_actions` 374, `phamacy_action` 82, `agent` 15, `shape` 83 —
0 fallos; `cargo check --workspace` limpio; ERP `nota-credito` 28, `sale-channel` 21, `fiscal` 69 y
`build` limpio. Deploy backend `SUCCESS` en `dbec848d` (contiene `6ae2a13a`).

### Deuda que sigue abierta (con la ubicación exacta)

- `ventas_no_fiscales_movimiento` se calcula y no se expone en el cierre (`sesion_impl.rs`).
- `numero_control` dejó de ser único global: quedan lecturas globales por control
  (`HAS_FACTURA_FOR_NUMERO_CONTROL_SQL`, `anuladas_scan.rs:790`); hoy solo se usan para ventas fiscales.
- `FALLO` sigue contando como fiscal: falta `tipo_comprobante: "fallo"`.
- Una venta `simple` que quede sin factura es invisible para el barrido de facturas faltantes
  (`SCAN_MISSING_INVOICES_SQL` exige `numero_control_interno`): no se recupera.
- Cambiar el modo no deja auditoría, aunque el plan lo pedía.
- El doble descuento de stock (NC total + anulación) sigue dependiendo de resolver la orden de la
  venta por `numero_control_interno`; con `facturacion_control` en `OrdenAnulable` quedó el dato,
  falta usarlo en `RESOLVER_ORDEN_DE_LA_VENTA_SQL`.

### Incidente de entorno

`node_modules` del ERP desapareció durante la verificación (por eso el verificador no pudo correr los
tests de JS) y se reinstaló con `pnpm install --frozen-lockfile`. Ese fue el motivo de que
`npx tsc` fallara de golpe.
