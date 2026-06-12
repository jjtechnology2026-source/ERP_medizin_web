## Modulo Facturacion Digital

### Emitir nota de credito

Endpoint:

- POST /admin/Facturacion/nota_credito

DTO de entrada real:

```json
{
  "id_pharmacy": "pharmacy-1",
  "entidad": "SMART",
  "tasa_cambio": 36.5,
  "rif_emisor": "J123456789",
  "tracking_id": "TRACK-1",
  "numero_control_interno": "INT-1",
  "cliente": {
    "rif": "V12345678",
    "razon_social": "Juan Perez",
    "direccion": "Caracas",
    "telefono": "04141234567",
    "correo": "juan@correo.com"
  },
  "documento_afectado": {
    "numero_documento": "A000123",
    "fecha_emision": "2026-04-20",
    "monto_total": 7,
    "motivo": "Devolucion"
  },
  "items": [
    {
      "descripcion": "Acetaminofen",
      "codigo_plu": "7591234567890",
      "cantidad": 2,
      "precio_unitario": 3.5,
      "vat": 16,
      "es_exento": false
    }
  ]
}
```

JSON de salida tolerado por _parseFacturaResponse:

```json
{
  "success": true,
  "numero_control": "NC0001",
  "numeroControl": "NC0001",
  "tracking_id": "TRACK-NC-1",
  "trackingId": "TRACK-NC-1",
  "url_pdf": "https://.../nc.pdf",
  "urlPdf": "https://.../nc.pdf",
  "fecha": "2026-04-20",
  "message": "Operacion exitosa",
  "resp": {
    "numerointerno": "INT-NC-1",
    "numero_interno": "INT-NC-1",
    "numeroInterno": "INT-NC-1",
    "numerocontrol": "NC0001",
    "trackingid": "TRACK-NC-1",
    "tracking_id": "TRACK-NC-1",
    "trackingId": "TRACK-NC-1",
    "urlpdf": "https://.../nc.pdf",
    "url_pdf": "https://.../nc.pdf",
    "urlPdf": "https://.../nc.pdf",
    "fecha": "2026-04-20"
  },
  "error": null
}
```

Retorno interno:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Nota de credito emitida correctamente",
  "details": null,
  "response": {
    "success": true,
    "numero_control": "NC0001",
    "resp": {
      "numerointerno": "INT-NC-1",
      "numerocontrol": "NC0001",
      "trackingid": "TRACK-NC-1",
      "urlpdf": "https://.../nc.pdf",
      "fecha": "2026-04-20"
    },
    "error": null
  },
  "updatedOrder": null,
  "showAlertDialog": false,
  "alertDialogType": "warning"
}
```

### Emitir nota de debito

Endpoint:

- POST /admin/Facturacion/nota_debito

DTO de entrada real:

- Mismo contrato que nota_credito.

JSON de salida:

- Misma estructura de FacturaResponse.

Retorno interno:

- Mismo shape de DigitalBillingNoteResult, con message exitoso Nota de debito emitida correctamente.

### Generar reporte Z digital

Endpoint:

- GET /admin/Facturacion/reporte_z

Query params requeridos:

- fecha
- rif
- id_pharmacy
- entidad

Query param opcional:

- sucursa

Ejemplo:

```http
GET /admin/Facturacion/reporte_z?fecha=2026-04-20&rif=J123456789&id_pharmacy=pharmacy-1&entidad=SMART&sucursa=001
```

JSON de salida completo que DigitalBillingZReportResponse puede absorber:

```json
{
  "data": {
    "empresa": {
      "razonsocial": "Farmacia Medizin",
      "rif": "J123456789",
      "direccion": "Caracas",
      "telefono": "02125551234",
      "email": "admin@medizin.com"
    },
    "Fecha_Reporte": "2026-04-20",
    "control_consecutivos": {
      "documento_inicial": "A000100",
      "documento_final": "A000120",
      "total_documentos": 21,
      "documentos_esperados": 21,
      "secuencia_completa": true,
      "numeros_faltantes": [],
      "alerta_consecutivos": false,
      "mensaje_alerta": ""
    },
    "ReporteZ": {
      "NroControl_Inicial": "A000100",
      "NroControl_Final": "A000120",
      "total_facturas": 21,
      "venta_base": "100.00",
      "venta_iva": "16.00",
      "total_venta": "116.00",
      "devol_base": "0.00",
      "devol_iva": "0.00",
      "total_devol": "0.00",
      "total_igtf": "0.00",
      "Total_z": "116.00",
      "Total": "116.00",
      "dif_z": "0.00"
    },
    "anulaciones_otros_dias": {
      "base": "0.00",
      "iva": "0.00",
      "total": "0.00",
      "cantidad": 0
    },
    "sucursal": "001",
    "fecha": "2026-04-20",
    "caja": {
      "id": "cash-1",
      "codigo": "CAJA-01",
      "nombre": "Caja Principal",
      "monto_base_ves": 1000,
      "monto_base_usd": 20,
      "ubicacion": "Planta baja",
      "estado": "cerrada",
      "created_at": "2026-04-20T08:00:00.000Z"
    },
    "fondo_inicial": {
      "ves": 1000,
      "usd": 20
    },
    "fondo_final": {
      "ves": 1200,
      "usd": 25
    },
    "total_ventas": {
      "ves": 5000,
      "usd": 100
    },
    "total_gastos": {
      "ves": 200,
      "usd": 4
    },
    "total_retirado": {
      "ves": 300,
      "usd": 6
    },
    "diferencia_acumulada": {
      "ves": 0,
      "usd": 0
    },
    "cantidad_turnos": 2,
    "detalle_sesiones": [
      {
        "id": "session-1",
        "caja_id": "cash-1",
        "usuario_apertura_id": "user-open-1",
        "usuario_cierre_id": "user-close-1",
        "fecha_apertura": "2026-04-20T08:00:00.000Z",
        "fecha_cierre": "2026-04-20T18:00:00.000Z",
        "monto_apertura_ves": 1000,
        "monto_apertura_usd": 20,
        "monto_cierre_fisico_ves": 1200,
        "monto_cierre_fisico_usd": 25,
        "total_ventas_ves": 5000,
        "total_ventas_usd": 100,
        "total_gastos_ves": 200,
        "total_gastos_usd": 4,
        "diferencia_ves": 0,
        "diferencia_usd": 0,
        "estado": "cerrada",
        "estado_apertura": "aprobada",
        "usuario_aprobacion_apertura_id": "supervisor-1",
        "fecha_aprobacion_apertura": "2026-04-20T08:05:00.000Z",
        "estado_cierre": "aprobado",
        "usuario_aprobacion_cierre_id": "supervisor-2",
        "fecha_aprobacion_cierre": "2026-04-20T18:10:00.000Z",
        "observaciones_cierre": "Sin novedad"
      }
    ]
  }
}
```

Notas del parser:

- Si no existe data, intenta parsear la raiz completa como DigitalBillingZReportData.
- ReporteZ tambien se acepta como Reportez o reportez.
- Total_z tambien se acepta como total_z.
- Total tambien se acepta como total.

Retorno interno:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Reporte Z generado correctamente",
  "report": {
    "data": {
      "empresa": {
        "razonsocial": "Farmacia Medizin",
        "rif": "J123456789",
        "direccion": "Caracas",
        "telefono": "02125551234",
        "email": "admin@medizin.com"
      },
      "Fecha_Reporte": "2026-04-20",
      "control_consecutivos": {
        "documento_inicial": "A000100",
        "documento_final": "A000120",
        "total_documentos": 21,
        "documentos_esperados": 21,
        "secuencia_completa": true,
        "numeros_faltantes": [],
        "alerta_consecutivos": false,
        "mensaje_alerta": ""
      },
      "ReporteZ": {
        "NroControl_Inicial": "A000100",
        "NroControl_Final": "A000120",
        "total_facturas": 21,
        "venta_base": "100.00",
        "venta_iva": "16.00",
        "total_venta": "116.00",
        "devol_base": "0.00",
        "devol_iva": "0.00",
        "total_devol": "0.00",
        "total_igtf": "0.00",
        "Total_z": "116.00",
        "Total": "116.00",
        "dif_z": "0.00"
      },
      "anulaciones_otros_dias": {
        "base": "0.00",
        "iva": "0.00",
        "total": "0.00",
        "cantidad": 0
      },
      "sucursal": "001",
      "fecha": "2026-04-20",
      "caja": {
        "id": "cash-1",
        "codigo": "CAJA-01",
        "nombre": "Caja Principal",
        "monto_base_ves": 1000,
        "monto_base_usd": 20,
        "ubicacion": "Planta baja",
        "estado": "cerrada",
        "created_at": "2026-04-20T08:00:00.000Z"
      },
      "fondo_inicial": {
        "ves": 1000,
        "usd": 20
      },
      "fondo_final": {
        "ves": 1200,
        "usd": 25
      },
      "total_ventas": {
        "ves": 5000,
        "usd": 100
      },
      "total_gastos": {
        "ves": 200,
        "usd": 4
      },
      "total_retirado": {
        "ves": 300,
        "usd": 6
      },
      "diferencia_acumulada": {
        "ves": 0,
        "usd": 0
      },
      "cantidad_turnos": 2,
      "detalle_sesiones": [
        {
          "id": "session-1",
          "caja_id": "cash-1",
          "usuario_apertura_id": "user-open-1",
          "usuario_cierre_id": "user-close-1",
          "fecha_apertura": "2026-04-20T08:00:00.000Z",
          "fecha_cierre": "2026-04-20T18:00:00.000Z",
          "monto_apertura_ves": 1000,
          "monto_apertura_usd": 20,
          "monto_cierre_fisico_ves": 1200,
          "monto_cierre_fisico_usd": 25,
          "total_ventas_ves": 5000,
          "total_ventas_usd": 100,
          "total_gastos_ves": 200,
          "total_gastos_usd": 4,
          "diferencia_ves": 0,
          "diferencia_usd": 0,
          "estado": "cerrada",
          "estado_apertura": "aprobada",
          "usuario_aprobacion_apertura_id": "supervisor-1",
          "fecha_aprobacion_apertura": "2026-04-20T08:05:00.000Z",
          "estado_cierre": "aprobado",
          "usuario_aprobacion_cierre_id": "supervisor-2",
          "fecha_aprobacion_cierre": "2026-04-20T18:10:00.000Z",
          "observaciones_cierre": "Sin novedad"
        }
      ]
    }
  },
  "rawPayloadJson": "{...payload original serializado...}",
  "details": null
}
```