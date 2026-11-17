// Persistencia de la venta local DESPUES de que la maquina fiscal emitio.
//
// La fiscal imprime primero y el backend persiste despues: si esa persistencia
// falla, el comprobante ya existe en el papel y en el libro pero la venta queda
// sin registrar (y sin descontar stock). Reintentar a ciegas es exactamente lo
// que produce comprobantes duplicados con el MISMO numero de control, asi que
// la regla es: reconciliar antes de reenviar, y reenviar solo con evidencia de
// que no se guardo.

export interface LocalSaleFacturacionLike {
  success?: boolean;
  numeroControl?: string | null;
  urlPdf?: string | null;
  error?: string | null;
}

export interface LocalSaleResultLike {
  ordenId: string;
  facturacion?: LocalSaleFacturacionLike;
}

export interface PersistLocalSaleInputs<TResult extends LocalSaleResultLike> {
  order: Record<string, unknown>;
  saleType: "local" | "digital";
  sessionId: string;
  /** Numero de control (COO) que la maquina fiscal ya imprimio. */
  controlNumber: string;
  /**
   * true cuando ya hubo un intento fallido para esta misma venta: antes de
   * volver a enviar se pregunta si el comprobante ya quedo registrado.
   */
  reconcileFirst?: boolean;
  submitOrder: (
    order: Record<string, unknown>,
    saleType: "local" | "digital",
    sessionId: string,
  ) => Promise<TResult>;
  /**
   * true si el comprobante con ese control ya figura entre las facturas de la
   * sesion. Se usa solo cuando la escritura fallo, para no duplicarla.
   */
  findPersistedInvoice: (controlNumber: string) => Promise<boolean>;
}

export interface PersistLocalSaleOutcome<TResult extends LocalSaleResultLike> {
  result: TResult | null;
  /** La venta quedo registrada en el backend (por el envio o por reconciliacion). */
  persisted: boolean;
  /** Se encontro el comprobante ya registrado: no se reenvio nada. */
  reconciled: boolean;
  /**
   * La reconciliacion no pudo determinarse. No se reenvio nada porque no hay
   * forma de saber si la escritura se completo: hay que revisar a mano.
   */
  uncertainty?: boolean;
  error?: string;
}

function messageOf(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  const shaped = error as {
    response?: { data?: { message?: string; error?: string } };
    message?: string;
  } | null;
  return shaped?.response?.data?.message || shaped?.response?.data?.error || shaped?.message || fallback;
}

/**
 * Registra la venta cuya factura ya salio de la maquina fiscal.
 *
 * Una sola escritura, nunca dos. El backend confirma la venta antes de que la
 * fila de `factura` exista (esa la escribe un `run_facturacion` desacoplado del
 * pipeline de venta), y no hay endpoint para buscar una orden por numero de
 * control. O sea: despues de un fallo de transporte NO HAY LECTURA que pruebe
 * que la orden no se guardo, y la orden tampoco tiene clave de idempotencia.
 *
 * Por eso no se reintenta solo:
 *  1. Se envia una vez.
 *  2. Si resuelve, la venta esta registrada.
 *  3. Si falla, se consulta la factura solo para reconocer el caso bueno (la
 *     escritura si se completo y se perdio la respuesta).
 *  4. Si no aparece -o no se puede consultar- se informa el comprobante y se
 *     para. Reenviar a ciegas es lo que duplica la orden; que lo decida el
 *     cajero, con el COO a la vista, es mas barato que un duplicado fiscal.
 *
 * `reconcileFirst` es para la decision manual posterior: antes de volver a
 * escribir se pregunta otra vez si el comprobante ya quedo registrado.
 */
export async function persistLocalSale<TResult extends LocalSaleResultLike>(
  inputs: PersistLocalSaleInputs<TResult>,
): Promise<PersistLocalSaleOutcome<TResult>> {
  const { order, saleType, sessionId } = inputs;
  const control = (inputs.controlNumber || "").trim();

  const reconciled = (): PersistLocalSaleOutcome<TResult> => ({
    // El comprobante ya esta en el libro: se devuelve el control fiscal real sin
    // inventar un ordenId (el POS solo lee `facturacion` de este resultado).
    result: {
      ordenId: "",
      facturacion: { success: true, numeroControl: control, urlPdf: null, error: null },
    } as unknown as TResult,
    persisted: true,
    reconciled: true,
  });

  const notPersisted = (
    message: string,
    uncertainty: boolean,
  ): PersistLocalSaleOutcome<TResult> => ({
    result: null,
    persisted: false,
    reconciled: false,
    ...(uncertainty ? { uncertainty: true } : {}),
    error: message,
  });

  // Decision manual de re-cobrar: primero se pregunta si ya quedo registrado.
  if (inputs.reconcileFirst && control) {
    try {
      if (await inputs.findPersistedInvoice(control)) return reconciled();
    } catch {
      return notPersisted(
        "No se pudo verificar si la venta quedó registrada.",
        true,
      );
    }
  }

  try {
    const result = await inputs.submitOrder(order, saleType, sessionId);
    return { result, persisted: true, reconciled: false };
  } catch (firstError) {
    const firstMessage = messageOf(firstError, "Error al registrar la venta");

    // Sin comprobante fiscal emitido no hay nada que reconciliar, pero tampoco
    // hay lectura que pruebe que la orden no se guardo: una sola escritura.
    if (!control) return notPersisted(firstMessage, false);

    try {
      if (await inputs.findPersistedInvoice(control)) return reconciled();
    } catch {
      // La escritura pudo completarse y perderse la respuesta: no se reenvia.
      return notPersisted(firstMessage, true);
    }

    // La factura no aparece, pero la orden pudo guardarse igual.
    return notPersisted(firstMessage, false);
  }
}

/**
 * Motivo por el que la venta NO puede guardarse como presupuesto, o null si
 * puede. Una vez que la maquina fiscal emitio el comprobante, guardar la orden
 * como cotizacion para "recuperarla" termina en doble facturacion fiscal: la
 * cotizacion se vuelve a pasar a venta y la fiscal emite un segundo COO.
 */
export function quoteBlockReason(fiscalIssuedControl?: string | null): string | null {
  const control = (fiscalIssuedControl ?? "").trim();
  if (!control) return null;
  return (
    `La máquina fiscal ya emitió el comprobante ${control}. Esta venta no se puede ` +
    `guardar como presupuesto: registre la venta o anule el comprobante.`
  );
}

/**
 * Comprobante fiscal ya emitido, atado al CARRITO que lo emitio.
 *
 * El `orderId` es lo que impide los dos errores caros: reusar el COO de una
 * venta en otra distinta (dos ventas apuntando al mismo documento fiscal) y
 * reemitir para el mismo carrito cuando se vuelve a cobrar tras un fallo.
 */
export interface IssuedFiscalDocument {
  control: string;
  serial: string | null;
  /** id estable del carrito (`createEmptyOrder`) que produjo el comprobante. */
  orderId: string;
  /** Contenido del carrito al emitir: ver `cartSignature`. */
  signature: string;
}

/**
 * Huella del contenido del carrito (cliente + lineas). El `orderId` sobrevive a
 * operaciones que reemplazan el contenido (`hydrateFromQuote`, agregar/quitar
 * lineas, cambiar cliente), asi que la identidad de la venta necesita las dos
 * cosas: mismo carrito Y mismos productos. Sin esto, un COO ya impreso se
 * reusaria para otra mercancia y el papel dejaria de coincidir con el sistema.
 */
export function cartSignature(
  order:
    | {
        client?: { documento?: string };
        medications?: Array<{
          barCode?: string;
          name?: string;
          quantity?: number;
          price?: number;
          vat?: number;
        }>;
      }
    | null
    | undefined,
): string {
  // El modelo de orden (`buildModelOrder`) completa el documento vacio con
  // "V-00000000". Normalizar aca hace que la firma no dependa de si se calculo
  // sobre el carrito crudo o sobre el modelo.
  const document =
    String(order?.client?.documento ?? "").trim().toUpperCase() || "V-00000000";
  const lines = (order?.medications ?? [])
    .map((m) => {
      const code = String(m.barCode ?? m.name ?? "").trim().toUpperCase();
      // El IVA define el `tax_code` fiscal: un cambio de IVA o de exento cambia
      // el comprobante, asi que no puede compartir huella con la venta anterior.
      return `${code}:${Number(m.quantity) || 0}:${Number(m.price) || 0}:${Number(m.vat) || 0}`;
    })
    .sort()
    .join("|");
  return `${document}::${lines}`;
}

/**
 * El comprobante emitido SOLO pertenece al carrito si coinciden id y contenido.
 * Cualquier otra cosa devuelve null: se emite un comprobante nuevo en vez de
 * arrastrar uno ajeno.
 */
export function issuedFiscalForCart(
  issued: IssuedFiscalDocument | null | undefined,
  order: (Parameters<typeof cartSignature>[0] & { id?: string }) | null | undefined,
): IssuedFiscalDocument | null {
  if (!issued || !order) return null;
  if (!order.id || issued.orderId !== String(order.id)) return null;
  if (issued.signature !== cartSignature(order)) return null;
  return issued;
}

/**
 * Igual que `quoteBlockReason`, pero solo aplica cuando el comprobante emitido
 * pertenece al carrito que se esta cobrando ahora.
 */
export function quoteBlockReasonForCart(
  issued: IssuedFiscalDocument | null | undefined,
  order: (Parameters<typeof cartSignature>[0] & { id?: string }) | null | undefined,
): string | null {
  const owned = issuedFiscalForCart(issued, order);
  return owned ? quoteBlockReason(owned.control) : null;
}

function normalizeControl(value: string): string {
  return value.trim().toUpperCase().replace(/[^0-9A-Z]/g, "");
}

/**
 * Compara el numero de control guardado con el que imprimio la fiscal.
 *
 * El backend puede devolver el COO con o sin ceros a la izquierda o con
 * separadores ("00052465", "52465", "000-52465"): si esta comparacion diera un
 * falso negativo se reenviaria una venta ya registrada y se duplicaria el
 * comprobante, asi que se normaliza antes de comparar.
 */
export function matchesControlNumber(
  candidate: string | null | undefined,
  control: string,
): boolean {
  const left = normalizeControl(candidate ?? "");
  const right = normalizeControl(control ?? "");
  if (!left || !right) return false;
  if (left === right) return true;
  // Solo se comparan numericamente dos controles puramente numericos: "COT-12"
  // y "12" son documentos distintos.
  if (/^\d+$/.test(left) && /^\d+$/.test(right)) {
    return Number(left) === Number(right);
  }
  return false;
}
