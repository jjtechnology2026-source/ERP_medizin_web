# Mara POS — nueva identidad visual en ERP y Admin

Aplica la identidad de marca **Mara POS** (assets en `~ /Descargas/ABDM`: SVG + PNG) al ERP de farmacia y al panel administrativo, reemplazando la marca anterior.
Alcance: `ERP_medizin_web` y `pharmacy-administrator-medizin`, ambos desplegados en Railway.

## Specs

S1 — Assets de marca. "yo te voy a pasar una carpeta donde hay unos SVG y unos PNG para que la actualice lo que es la identidad visual en vez de ser Mazing se daba Maraposo".
Los archivos entregados definen el nombre real: **Mara POS**, tagline "Agiliza · Controla · Escala", azul `#0057FF`, tinta `#1A2E35`, superficie `#F5F5F5` y degradado petróleo `#134B4F` → esmeralda `#019C96`.

S2 — Nueva presentación. "quiero que todo busca bien, todo busca excelente como tener una nueva presentación ahora con esos colores y mejor dicho con esa nueva identidad visual".
Logos nuevos en navbar, sidebar, login, loading y favicon; paleta de marca centralizada en tokens; superficies de autenticación con el degradado de marca.

S3 — Ambos proyectos. "necesito que hagas tanto en este proyecto como en el proyecto administrativo, el administrador de farmacias también aplique lo mismo".
Misma identidad, mismos tokens y mismos assets en las dos aplicaciones.

S4 — Cierre con entrega. "cuando termines me avisas haces Geek Comic haces un push y verificas que todo se monte en Railway".
Commits en inglés con Conventional Commits, push a la rama que despliega cada servicio (`master` en ERP, `main` en Admin) y verificación del deploy en Railway.

## Tasks

| ID | Spec | Qué | Rama | Commit |
| --- | --- | --- | --- | --- |
| T1 | S1, S2 | Assets de marca en `public/` (logo, logo light, wordmark, wordmark light, mark, mark light, icon) + favicon | feat/mara-pos-identity | `feat(brand): add Mara POS logo assets` |
| T2 | S2 | Tokens de marca en `globals.css` (ink, teal, emerald, gradiente, primary `#0057FF`) | feat/mara-pos-identity | `feat(brand): add Mara POS design tokens` |
| T3 | S2, S3 | ERP: metadata, navbar, login, loading, settings, page title, PDF de inventario | feat/mara-pos-identity | `feat(brand): apply Mara POS identity to ERP` |
| T4 | S2, S3 | Admin: metadata, auth layout, login, sidebar, layout, información, page title | feat/mara-pos-identity | `feat(brand): apply Mara POS identity to admin panel` |
| T5 | S2 | `pnpm build` verde en los dos proyectos | feat/mara-pos-identity | (evidencia) |
| T6 | S4 | Push a `master` / `main` y verificación del deploy en Railway | master / main | (evidencia) |

## Addendum — caja lista al iniciar la jornada

S5 — "verifica que ya mañana cuando la gente comience a utilizar el sistema ya esté lo guiada en las cajas, es decir que no tengan que abrirla ... si no es que ya puedan trabajar de una sola vez".
La apertura de caja no puede dejar a nadie afuera el primer día de la jornada: si la caja del terminal es inequívoca, el POS la abre solo y el backend aprueba la apertura del agente de la farmacia.

| ID | Spec | Qué | Commit |
| --- | --- | --- | --- |
| T7 | S5 | Backend: la apertura se aprueba sola también cuando el agente pertenece a la farmacia de la caja (no solo con `agents.cajaId`), con test de integración | `feat(caja): aprobar la apertura del agente de la farmacia` |
| T8 | S5 | ERP: `decideSessionAutoOpen` + `ensureSession`; el POS abre la caja asignada (o la única caja) al entrar | `feat(caja): abrir la caja del terminal al entrar al POS` |

## Log

L1 — Pedido original (voz, 20/10/2026): "yo te voy a pasar una carpeta donde hay unos SVG y unos PNG para que la actualice lo que es la identidad visual en vez de ser Mazing se daba Maraposo, creo que se llama algo así pero quiero que todo busca bien, todo busca excelente como tener una nueva presentación ahora con esos colores y mejor dicho con esa nueva identidad visual necesito que hagas tanto en este proyecto como en el proyecto administrativo, el administrador de farmacias también aplique lo mismo es decir esos colores van a cambiar identidad visual, es muy importante cuando termines me avisas haces Geek Comic haces un push y verificas que todo se monte en Railway".
L2 — Los assets entregados (`mara/SVG/MARA POS (1).svg`, `(2).svg` y 4 PNG 1080×1080) confirman el nombre "Mara POS" y la tagline "Agiliza · Controla · Escala"; los colores se toman de los SVG y del degradado de las piezas sociales.
L3 — La caja se abre sola cuando es inequívoca; con varias cajas y sin asignación se mantiene la elección manual, que ahora también queda aprobada al instante.
