## Resumen por Modulo

### auth

- GET /login_agent
- POST /auth/refresh-token

### orders

- POST /admin/Orders/insertorder
- POST /admin/Orders/orders/local
- GET /admin/Orders/health
- GET /admin/Orders/get
- GET /admin/Orders/SearchOrders

### medications y stock

- POST /admin/Medications/upsert
- GET /admin/Medications/health
- POST /Medications/list
- POST /Medications/Create
- POST /admin/MedicationImage/Upload
- GET https://backendadministrativo-production.up.railway.app/admin/MedicationImage/download/{imageUrl}

### users

- POST /admin/User/createuser
- POST /admin/User/searchuser/{id}

### audit

- POST /admin/audit/logs
- GET /admin/audit/logs

### facturacion digital

- POST /admin/Facturacion/nota_credito
- POST /admin/Facturacion/nota_debito
- GET /admin/Facturacion/reporte_z

### auxiliares

- GET /Rate
- GET https://medizins.com/updateApp/checkLatestVersion

## Riesgos y Rarezas que TypeScript Debe Preservar o Corregir

- Hay endpoints GET con body.
- Hay endpoints fuera del prefijo /admin.
- Hay respuestas toleradas con multiples formas y aliases.
- El cliente depende de side effects de auditoria automatica.
- El cache local se usa como fallback funcional, no solo como optimizacion.
- En /admin/Medications/upsert, quantity se rellena con stock.
- En pagos de ordenes, el JSON HTTP de Card usa cardType pero el modelo local usa type.
- Las imagenes usan otro host distinto del backend principal.