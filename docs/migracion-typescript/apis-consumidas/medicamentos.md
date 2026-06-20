## Modulo Medications e Inventario

### Upsert de medicamentos

Endpoint:

- POST /admin/Medications/upsert

DTO de entrada real:

Un arreglo de medicamentos:

```json
[
  {
    "brand": "Genfar",
    "activeIngredient": "Acetaminofen",
    "dosage": "500mg",
    "tablets": "10",
    "barCode": "7591234567890",
    "name": "Acetaminofen",
    "image": "acetaminofen.webp",
    "category": "Analgesicos",
    "subcategory": "Tabletas",
    "price": 3.5,
    "quantity": 18,
    "stock": 18,
    "description": "...",
    "controlled": false,
    "vat": 16,
    "antibiotic": false,
    "minimum": 5
  }
]
```

Nota importante:

- El servicio envia quantity con el valor de stock, no con medicine.quantity.

JSON de salida:

- 200 o 201.

Retorno interno:

- bool

### Health de medicamentos

Endpoint:

- GET /admin/Medications/health

DTO de entrada:

- Sin body.

JSON de salida:

- 200.

Retorno interno:

- bool

### Listado de medicamentos

Endpoint:

- POST /Medications/list

DTO de entrada real:

- Body literal string "null"
- Header Authorization Bearer token

JSON de salida aceptado:

Dos variantes aceptadas:

```json
[
  {
    "brand": "Genfar",
    "activeIngredient": "Acetaminofen",
    "dosage": "500mg",
    "tablets": "10 tabletas",
    "barCode": "7591234567890",
    "name": "Acetaminofen",
    "image": "acetaminofen.webp",
    "category": "Analgesicos",
    "subcategory": "Tabletas",
    "price": 3.5,
    "quantity": 18,
    "stock": 18,
    "description": "Caja de 10 tabletas",
    "controlled": false,
    "vat": 16,
    "antibiotic": false,
    "minimum": 5
  }
]
```

o

```json
{
  "medications": [
    {
      "brand": "Genfar",
      "activeIngredient": "Acetaminofen",
      "dosage": "500mg",
      "tablets": "10 tabletas",
      "barCode": "7591234567890",
      "name": "Acetaminofen",
      "image": "acetaminofen.webp",
      "category": "Analgesicos",
      "subcategory": "Tabletas",
      "price": 3.5,
      "quantity": 18,
      "stock": 18,
      "description": "Caja de 10 tabletas",
      "controlled": false,
      "vat": 16,
      "antibiotic": false,
      "minimum": 5
    }
  ]
}
```

Retorno interno:

- List<Medicine>
- Si falla, intenta cargar medicamentos.json local como fallback

Observaciones:

- Este endpoint no sigue el prefijo /admin.
- La app guarda la respuesta en un cache local base64.

### Crear producto

Endpoint:

- POST /Medications/Create

DTO de entrada real usado por el flujo actual create_product:

- json.encode(productData), donde productData es una lista de mapas.

El builder actual del modulo genera ProductCreationData con todos estos campos:

```json
[
  {
    "brand": "Genfar",
    "activeIngredient": "Acetaminofen",
    "dosage": "500 mg",
    "tablets": "10 tabletas",
    "barCode": "7591234567890",
    "name": "Acetaminofen",
    "image": "acetaminofen.webp",
    "category": "Analgesicos",
    "subcategory": "Tabletas",
    "price": 3.5,
    "quantity": 20,
    "stock": 20,
    "description": "...",
    "controlled": false,
    "vat": 16,
    "antibiotic": false,
    "minimum": 5,
    "detalle": ""
  }
]
```

Nota:

- Existe un ProductModel legacy con id, presentation y minimun, pero el flujo activo que llama al endpoint usa ProductCreationData y no incluye id ni presentation separados. presentation se embebe en tablets.

JSON de salida:

- Response HTTP generico. El servicio expone el Response completo.

### Subir imagen de medicamento

Endpoint:

- POST /admin/MedicationImage/Upload

Que manda:

```json
{
  "name": "acetaminofen.webp",
  "data": [137, 80, 78, 71]
}
```

JSON de salida:

- Response HTTP generico con informacion de la imagen o confirmacion.

Retorno interno:

- Response completo de Dio

### Descargar imagen de medicamento

Endpoint observado en UI:

- GET https://backendadministrativo-production.up.railway.app/admin/MedicationImage/download/{imageUrl}

Uso:

- Renderizar imagen remota por nombre de archivo.

Observacion:

- Este flujo no usa la base URL principal. En TypeScript conviene aislarlo como un asset endpoint externo.
