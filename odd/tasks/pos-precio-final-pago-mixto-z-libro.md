# POS: precio final directo, cobro mixto caja/crédito y separación Z / libro de ventas

Origen: pedidos de la operadora (Jir) por WhatsApp el 2026-11-13, 17:30–20:12 (hora local).
Ecosistema verificado (2026-11-14): POS = `ERP_medizin_web`, panel contable = `pharmacy-administrator-medizin`,
API = `Backend-administrativo` (Rust + SurrealDB), impresión = `service_fiscal`. Los `S#` son citas textuales de sus audios.

## Specs

**S1 — Precio final directo (audio 17:34, 36 s).**
"…coloca el precio final. Las personas en vez de colocar precio por precio de costo y ganancia, o sea, pueden colocar precio de costo, pero precio final, que también lo puedan colocar así directamente, no por ganancia, o sea, que puedan colocar precio de costo y precio de venta de un solo coñazo. Pues esa opción también agrégale allí."

**S2 — Cobro mixto: parte efectivo, parte crédito (audio 18:38, 44 s).**
"Caja debe funcionar de que tú haces la orden, ¿Verdad? La persona te entrega una parte en efectivo y el resto se va a crédito, a cuenta por cobrar. Y yo lo tenía que se registraba como un pago unitario que se hacía la cuenta de caja con el monto total. ¿Puedes ponerlo así, por favor?"

**S3 — Confirmación de alcance de S2 (audio 18:40, 5 s).**
"Pero lo de caja así, ponlo así y lo otro yo, lo demás me encargo yo."

**S4 — Z y libro de ventas como dos operaciones separadas (audio 18:39, 84 s).**
"Dile a OpenCode que te separe esas dos operaciones. Cuando tú le des imprimir reporte Z, que simplemente se imprime reporte Z en la máquina fiscal y la parte de llevar, o sea, él lleva toda la parte de todas las ventas de la farmacia en grupo hacia el libro de ventas… todo lo que tú subes de la parte contable del libro de venta, ármamelo en un botón diferente y que yo simplemente pueda imprimir el reporte Z con el mismo botón, pero esa otra operación que está allí en conjunto, que la acepta."

**S5 — Plazo y prioridad (audio 18:39, 84 s).**
"Creo que esas son las dos funciones que por lo menos necesito hacer hoy en la noche. Si puedes darla tú, por favor."

**S6 — Confirma antes de dormir (texto 19:25).**
"Confírmame eso rey pa acostarme hoy tranquilo."

**S7 — Reimprimir factura: retirado, no requiere cambio (audios 17:32 y 17:34).**
"Mira, puedes hacer que la opción de reimprimir factura sirva, que a mí no me sirve." → "Sí, reimprimiendo está sirviendo y no lo he colocado para que lo arregles allí." + "Con impresora fiscal no se puede reimprimir." La vía es nota de crédito.

**S8 — Estado actual de la parte de crédito (audio 18:40, 22 s).**
"la parte del crédito ya yo lo dejé listo, ya yo lo subí, ya yo subí ese cambio."

**S9 — Ventas desfasadas de hoy (audio 18:40, 22 s).**
"hoy todas esas ventas que están desfasadas, o sea, tendré que hacer una nota de crédito y volver a hacerlas para que puedan cuadrar perfecto, pero decidí dejarlas así hoy."

## Tasks

- T1 · S1 · Precio de venta final directo en el POS — **IMPLEMENTADO (sin commitear)**. `modules/products/lib/pricing.ts` suma `minimumSellingPrice` y `profitFromPrice` (inversa de `derivePrice`, con IVA y descuento, redondeo a 2 decimales, `undefined` cuando la ganancia no es representable). UI en `TabCreateProduct.tsx` (producto nuevo) y `StockFeaturesForm.tsx` (inventario existente): input "Precio final (con IVA)" que fija `profit`, con piso costo+IVA explicado en el mensaje y limpieza del input cuando cambian costo/IVA/ganancia. La ganancia sigue siendo la única fuente de verdad del payload. Tests: 5 nuevos en `test/pricing.test.mjs` (inversa↔directa, descuento, piso, entradas inválidas, `minimumSellingPrice` == `derivePrice` con 0%). Checks: 219 tests verdes en las 11 suites, `tsc --noEmit` exit 0, eslint sin hallazgos nuevos. Commit: pendiente (el árbol ya trae el renombrado `pos58`→`pos80` staged de otro trabajo; no se mezcla).
- T1b · S1 · Precio final en la importación masiva (`BulkImportDialog.tsx`: plantilla, encabezados y parseo de fila). FUERA DE T1 a propósito para no inflar la revisión. Commit: pendiente.
- T2 · S2-S3 · Crédito = fiado del cliente. Documento abierto en el otro repo: `Backend-administrativo/odd/tasks/pos-credito-cxc-y-z-por-serie.md`. Restricción detectada: `reconciliacion.rs:103-143` exige que los movimientos cubran `total_ves`, así que sacar el crédito del vector de cobro no puede romper la aceptación de la factura — hay que separar "vendido" de "efectivo esperado" antes de tocar el POS. Antes de implementar: verificar contra una venta a crédito real si el arqueo sale con faltante.
- T3 · S4 · Z en dos operaciones — **IMPLEMENTADO (sin commitear)**. `ZReportDialog.tsx` tiene `mode: "print" | "register"`: imprimir usa `printZReportFallback` (máquina fiscal o POS80) y no llama `createZReport` ni persiste; registrar usa `createZReport` con la identidad del último print guardada por farmacia en `localStorage` (`last-z-print`) y no imprime. `FiscalConfigCard.tsx` abre cada modo con un click distinto. Test commiteado nuevo: `test/z-report-split.test.mjs` (6 casos), incluido en `npm run test:fiscal` (56 verdes). La ruta acoplada `runZReportFallback`/`persistFallbackZ` quedó exportada solo para la suite del incidente DETODOFARMACY; la UI ya no la usa.
- **LÍMITE CONOCIDO de T3**: el backend sigue scopeando el Z por farmacia y rechazando con 409 un segundo Z del mismo día (`z_reports_impl.rs:325-332`). Con dos máquinas fiscales, el botón "Registrar en libro de ventas" de la segunda va a fallar hasta que se haga el scope por serie fiscal. Imprimir sí funciona siempre; registrar todavía no, para la segunda máquina.
- T4 · S6 · Responderle a Jir con el alcance confirmado y las 3 preguntas abiertas. Ruta: inline. Commit: no aplica.

## Log

- **L1** (usuario, textual): "Necesito que entres al chart de Jikin de WhatsApp y leas los últimos seis mensajes. Creo que son cinco audios y un mensaje. Ella me está pidiendo que haga. Verifica qué quieres que haga."
- **L2** (usuario, textual): "jir" — el chat es `Jir` / 584122356270@s.whatsapp.net. Corrección del dato de L1: los últimos 6 mensajes son 3 audios + 3 textos; el bloque de pedidos son 8 audios de ella entre 17:30 y 18:40.
- **L3** (usuario, textual): "si" — autoriza convertir los pedidos en plan de trabajo (este documento).
- **L4** Evidencia: el flujo de pago YA soporta multi-método (`current-order.store.ts:10-12,200-217`, `PaymentDialog.tsx:470-573`). Lo que falta no es el split de UI, sino que "crédito" hoy cuenta como cobrado (`PaymentDialog.tsx:110-115`) y no existe cuenta por cobrar en ningún lado del repo.
- **L5** Evidencia: el precio de venta se deriva en `modules/products/lib/pricing.ts:16-22` como `(costo / (1 - ganancia/100)) * (1 + IVA/100)` y el backend es la autoridad (`pricing.ts:66-68`). No hay input de precio de venta en ningún formulario.
- **L6** Evidencia: hoy "Generar reporte Z" hace las dos cosas en un solo `step` (`ZReportDialog.tsx:206-268`): imprime en la máquina fiscal y luego `POST /admin/farmacias/{id}/z-reports`, que es lo que alimenta el libro (`fiscal-z-report.service.ts:331-341`).
- **L7** Riesgo detectado en S4: separar el Z del registro contable rompe el supuesto que hoy sostiene el aviso de incidente DETODOFARMACY (`ZReportDialog.tsx:151-156`: "El reporte Z #N se imprimió pero NO quedó registrado… la venta del día no aparecerá en el libro"). Si se imprime sin registrar, quedan documentos fiscales sin contrapartida contable. Requiere decisión explícita.
- **L8** Pregunta abierta de S4: ¿el libro de ventas es uno por farmacia (todas las máquinas fiscales en grupo) o uno por máquina? Hoy el registro es por Z y por serial fiscal; ella habla de "todas las ventas de la farmacia en grupo".
- **L9** Datos que faltan: las dos fotos que mandó (17:35 y 17:36, "¿cuál sería el código?") no están descargadas en la base de WhatsApp (`media_path` nulo); y el final del audio de 84 s ("enfócame ahí en la parte de compra") tiene transcripción dudosa.
- **L10** (usuario, textual): "Verifique que, por ejemplo, tome en cuenta de que esta implementación funciona en conjunto de un proyecto que se llama Administrador de Farmacia en la carpeta de MIS verifique ese proyecto primero para después tomar decisiones." → Habilitó leer `pharmacy-administrator-medizin` y `Backend-administrativo`.
- **L11** Precio: la autoridad es `Backend-administrativo/shape/src/pricing.rs:85-117` (`derive`), con `DerivedPrice` de campo privado y un test que escanea el código para impedir que otro módulo acuñe precios (`http/src/price_derivation_scan.rs:97-105`). `POST /admin/Medications/Create` rechaza `base_price`/`profit_percentage`; los precios se escriben sólo por `MedicationsAgent/increase`. Al facturar, el backend confía en el `price` que manda el POS (`orders_actions/.../use_cases.rs:1148-1165`).
- **L12** Precio, riesgo del sync: `POST /admin/MedicationsAgent/sync-price` recalcula el precio destino desde `base_price + profit_percentage` y reporta `no_price_derived` cuando no puede (`pharmacy-administrator-medizin/features/general/precios/utils/sincronizacionPrecios.ts:14-21,47`). Un precio final tipeado que no cumpla esa relación se sobrescribe o se omite en el próximo sync. La factura de compra del panel también muestra "Precio de venta" como derivado y de sólo lectura (`features/finanzas/shared/components/FormItemRow.tsx:182-196`).
- **L13** Crédito: el backend contradice su propia documentación. `MetodoPagoCaja::Credito` dice "no es dinero, no suma al efectivo esperado" (`shape/src/models/model_accountant.rs:67-69`) pero `clasificar_movimientos` sólo excluye `SaldoFavor` (`accountant/.../reconciliacion.rs:169-174`) y ese vector alimenta el teórico del cierre y el arqueo (`sesion_impl.rs:159-178`, `arqueo_impl.rs:30-45`). Hay que verificarlo contra una venta a crédito real antes de tocar nada.
- **L14** Libro de ventas: vive en el panel contable, no en el POS, y su única fuente es `z_reports` (`features/contable/activos/hooks/useZReports.ts:39`; agrupación por `fiscal_date`, `agruparZReports.ts:104-118`; el export descarta todos los seriales menos el primero, `libroVentasExport.ts:147,254`). El reporte Z del backend sólo agrega `factura`, `nota_credito` y `nota_debito` — no órdenes ni pagos — y no marca nada como cerrado (`z_reports_impl.rs:147-216,366-397`).
- **L16** Decisión D1 (precio): ganancia implícita. El POS calcula el `profit_percentage` desde el precio final tipeado y sigue mandando `base_price` + `profit_percentage` + `vat`. Sin cambios de backend, sobrevive `sync-price`, los reportes de utilidad quedan con el margen real. Límite aceptado: no se puede vender por debajo de costo + IVA con este modelo.
- **L17** Decisión D2 (crédito): `credito` en el POS significa **fiado del cliente**, no tarjeta de crédito. Coincide con la CxC que ya crea el backend y con `POST /admin/movimientos/{id}/abono`.
- **L18** Decisión D3 (Z/libro): se va por backend por serie fiscal (rango por serial + guard por serial + libro por farmacia), no por el atajo de separar botones en el POS.
- **L19** Alcance multi-repo: T1 vive en `ERP_medizin_web` (este repo, autorizado). T2 y T3 viven en `Backend-administrativo` y `pharmacy-administrator-medizin` — otros repos, requieren autorización nueva.
- **L20** Consistencia pendiente (fuera de S1, no implementar sin pedido): la factura de compra del panel contable (`features/finanzas/shared/components/FormItemRow.tsx:160-196`) también carga costo + % ganancia con precio final de sólo lectura; si Jir pide lo mismo ahí, es otra tarea.
- **L21** Implementación T1 (Python: no aplica) — evidencia: `profitFromPrice` redondea a 2 decimales, así que el precio re-derivado puede diferir del tipeado en centésimas. En lugar del aviso modal que pedía el plan original, el precio efectivo se muestra en vivo ("Precio que se cobra" en el alta; el panel de vista previa en el inventario), así que el operador ve el resultado antes de guardar. Se descarta el diálogo extra.
- **L22** El árbol queda con cambios sin commitear a propósito: hay un renombrado `pos58`→`pos80` staged de otro trabajo (15 archivos) que no debe entrar en este commit. Cuando el usuario decida, el commit de T1 es sólo `modules/products/{lib/pricing.ts,components/TabCreateProduct.tsx,components/StockFeaturesForm.tsx}` + `test/pricing.test.mjs`; el de T3 es `modules/cash-register/components/ZReportDialog.tsx`, `modules/settings/components/FiscalConfigCard.tsx`, `modules/cash-register/lib/{fiscal-fallback.ts,fiscal-fallback-flow.ts}`, `test/z-report-split.test.mjs` y la línea de `package.json`.
- **L23** (usuario, textual): "Sabes que Jerry King nos dio una solución, lo que él quiere que haga, vamos a hacer lo que él quiere que haga, ¿me entiendes? Sin complicarnos tanto con la segunda planificación." → Se descarta el programa contable F0–F4 y se implementa literalmente la solución de Jir: Z impreso y Z registrado como dos operaciones, y el fiado fuera de la caja.
