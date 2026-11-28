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

- **F1 · Campo y modo (sin cambiar comportamiento).** `modo_facturacion` en `pharmacies`,
  auditoría del cambio, y que el pipeline lo lea y lo registre **sin** usarlo todavía. Las
  farmacias existentes quedan en su modo actual; nadie pasa a `simple` por default.
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
