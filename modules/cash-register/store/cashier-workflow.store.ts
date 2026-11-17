import { create } from "zustand";
import type { CashierWorkflowState, CashierClosePhysicalCount } from "@/modules/cash-register/types/cashier.types";
import { cashierAccountantService } from "@/modules/cash-register/api/cashier-accountant.service";
import { useCurrencyStore } from "@/modules/core/store/currency.store";
import { useCurrentOrderStore } from "@/modules/cash-register/store/current-order.store";
import { useAuthStore } from "@/modules/auth/store/useAuthStore";
import fiscalPrinterClient from "@/modules/cash-register/api/fiscal-printer-client";
import { buildFiscalPayload } from "@/modules/cash-register/lib/fiscal-payload";
import { reconcileFiscalTotal } from "@/modules/cash-register/lib/money";
import { isFiscalFailure } from "@/modules/cash-register/lib/fiscal-fallback";
import { runOrderFallback } from "@/modules/cash-register/lib/fiscal-fallback-flow";
import { persistLocalSale, quoteBlockReasonForCart, issuedFiscalForCart, cartSignature, matchesControlNumber, type IssuedFiscalDocument } from "@/modules/cash-register/lib/local-sale-persist";
import { printNoFiscalTicket } from "@/modules/cash-register/lib/pos80-print";
import {
  resolveAuthorizedCajaId,
  describeSessionResolutionError,
  describeSessionBindingMismatch,
  decideSessionAutoOpen,
} from "@/modules/cash-register/lib/cash-session-binding";

interface CashierWorkflowStore extends CashierWorkflowState {
  pharmacyId: string | undefined;
  currentRate: number;
  /**
   * Comprobantes fiscales ya emitidos, indexados por carrito. Mientras exista
   * uno para el carrito en curso, esa venta no puede volver a pedir un COO (ni
   * como venta ni como presupuesto). Es un mapa y no un slot unico porque el POS
   * cobra varios carritos: el comprobante de uno no puede borrarse al registrar
   * otro.
   */
  fiscalIssued: Record<string, IssuedFiscalDocument>;
  load: (pharmacyId?: string) => Promise<void>;
  ensureSession: () => Promise<void>;
  selectCashBox: (id: string | null) => void;
  openSession: () => Promise<void>;
  registerSale: (saleType?: "local" | "digital") => Promise<{ facturacion: any; ordenId: string; fiscalFallback?: boolean; printError?: string } | null>;
  saveQuote: () => Promise<{ quoteNumber: string | null; ordenId: string; order: Record<string, any> } | null>;
  saveDeliveryNote: () => Promise<{ quoteNumber: string | null; ordenId: string; order: Record<string, any> } | null>;
  checkFiscalHealth: () => Promise<void>;
  requestCloseSession: (
    physicalCount: CashierClosePhysicalCount,
    options?: { observations?: string; openNewTurn?: boolean; nextCashierId?: string }
  ) => Promise<void>;
  issueCreditNote: (invoiceId: string, reason: string) => Promise<void>;
  clearMessages: () => void;
  setError: (msg: string | null) => void;
  setInfo: (msg: string | null) => void;
}

const initialState: CashierWorkflowState &
  Pick<CashierWorkflowStore, "currentRate" | "fiscalIssued"> = {
  isLoading: false,
  isSubmitting: false,
  isCashierRole: true,
  cashBoxes: [],
  activeSession: null,
  sessionInvoices: [],
  sessionTransactions: [],
  selectedCashBoxId: null,
  errorMessage: null,
  infoMessage: null,
  lastQuoteNumber: null,
  currentRate: 0,
  fiscalAvailable: null,
  fiscalIssued: {},
};

// Un solo intento de auto-apertura por montaje del POS: evita reintentos en
// cada `load()` cuando la caja no se puede abrir (inactiva, sin cajas, etc.).
let autoOpenAttempted = false;

/**
 * true si el comprobante con ese numero de control ya figura entre las facturas
 * de la sesion. Es la unica lectura con la que el POS decide NO reenviar una
 * venta cuya persistencia fallo.
 */
async function findIssuedInvoice(
  cashBoxId: string | undefined,
  control: string,
): Promise<boolean> {
  const facturas = await cashierAccountantService.fetchSessionInvoices(cashBoxId);
  return facturas.some((factura) => matchesControlNumber(factura.controlNumber, control));
}

/** carrito que se esta cobrando: ata el comprobante fiscal a su venta. */
function currentCart(): Record<string, any> | undefined {
  return useCurrentOrderStore.getState().getCurrentOrder();
}

/** comprobante emitido para el carrito en curso, si lo hay. */
function issuedForCurrentCart(
  issued: Record<string, IssuedFiscalDocument>,
): IssuedFiscalDocument | undefined {
  const id = currentCart()?.id;
  return id ? issued[String(id)] : undefined;
}

export const useCashierWorkflowStore = create<CashierWorkflowStore>((set, get) => ({
  ...initialState,
  pharmacyId: undefined,

  load: async (pharmacyId?: string) => {
    const effectivePharmacyId = pharmacyId || get().pharmacyId;
    if (!effectivePharmacyId) {
      set({ isLoading: false, errorMessage: "No se pudo determinar la farmacia" });
      return;
    }

    set({ isLoading: true, errorMessage: null, pharmacyId: effectivePharmacyId });

    const rate = useCurrencyStore.getState().getEffectiveRate();
    set({ currentRate: rate });

    const assignedCaja = useAuthStore.getState().profile?.cajaId;

    // P2 cash-session-attribution: el terminal se ata a SU caja y nunca opera
    // sobre la sesión de otra. Fuente única: la caja asignada al agente
    // (`agents.cajaId`), que es lo único que el backend autoriza para un
    // `caja_id`. Derivarla de la sesión o de la selección era circular (B1): el
    // segundo `load()` de una cajera sin caja asignada mandaba un `caja_id` que
    // el backend rechaza con 403 y dejaba el terminal bloqueado sin poder vender.
    const boundCajaId = resolveAuthorizedCajaId(assignedCaja);

    let sessionResolutionError: string | null = null;

    const [cashBoxes, rawSession] = await Promise.all([
      (async () => {
        try {
          return await cashierAccountantService.fetchCashBoxes(effectivePharmacyId);
        } catch (e: any) {
          console.error("❌ [Store load] fetchCashBoxes failed:", e.response?.data || e.message);
          return [];
        }
      })(),
      (async () => {
        try {
          return await cashierAccountantService.fetchActiveSession(boundCajaId ?? undefined);
        } catch (e: any) {
          const bindingMessage = describeSessionResolutionError(e);
          if (bindingMessage) {
            // 409 (ambigüedad) o 403 (caja no asignada): ruidoso y sin
            // fallback a la búsqueda por usuario.
            sessionResolutionError = bindingMessage;
            console.error("❌ [Store load] fetchActiveSession binding rejected:", bindingMessage);
            return null;
          }
          console.error("❌ [Store load] fetchActiveSession failed:", e.response?.data || e.message);
          return null;
        }
      })(),
    ]);

    const resolvedSession = rawSession && (rawSession.id || rawSession.cashBoxId) ? rawSession : null;

    // Gate de atadura: si el backend devolvió una sesión de otra caja (o no hay
    // caja atada que la confirme), se rechaza explícitamente.
    const bindingMismatch = describeSessionBindingMismatch(resolvedSession, boundCajaId);
    const activeSession = bindingMismatch ? null : resolvedSession;

    let sessionInvoices: any[] = [];
    let sessionTransactions: any[] = [];

    if (activeSession && activeSession.approvalStatus === "approved") {
      const [inv, tx] = await Promise.all([
        (async () => {
          try {
            return await cashierAccountantService.fetchSessionInvoices(activeSession.cashBoxId);
          } catch (e: any) {
            console.error("❌ [Store load] fetchSessionInvoices failed:", e.response?.data || e.message);
            return [];
          }
        })(),
        (async () => {
          try {
            return await cashierAccountantService.fetchSessionTransactions(activeSession.cashBoxId);
          } catch (e: any) {
            console.error("❌ [Store load] fetchSessionTransactions failed:", e.response?.data || e.message);
            return [];
          }
        })(),
      ]);
      sessionInvoices = inv;
      sessionTransactions = tx;
    }

    set({
      isLoading: false,
      errorMessage: sessionResolutionError ?? bindingMismatch,
      cashBoxes,
      activeSession,
      sessionInvoices,
      sessionTransactions,
      selectedCashBoxId:
        activeSession?.cashBoxId ??
        (assignedCaja && cashBoxes.some((cb) => cb.id === assignedCaja)
          ? assignedCaja
          : cashBoxes[0]?.id) ??
        null,
    });
  },

  selectCashBox: (id) => set({ selectedCashBoxId: id }),

  openSession: async () => {
    const { selectedCashBoxId } = get();
    if (!selectedCashBoxId) {
      set({ errorMessage: "Selecciona una caja primero" });
      return;
    }
    set({ isSubmitting: true, errorMessage: null });
    try {
      await cashierAccountantService.openSession(selectedCashBoxId);
      set({
        isSubmitting: false,
        infoMessage: "Apertura enviada. Debe ser aprobada antes de cobrar.",
      });
      await get().load();
    } catch (error: any) {
      const mensaje = error.response?.data?.message || "Error al solicitar apertura de caja";
      console.error("❌ [openSession] Error:", mensaje);
      set({ isSubmitting: false, errorMessage: mensaje });
    }
  },

  /**
   * Abre la caja sola al entrar al POS cuando la caja del terminal es
   * inequívoca, para que la jornada arranque sin que el cajero tenga que abrir
   * nada ni esperar una aprobación. El backend aprueba la apertura del agente de
   * la farmacia, así que la sesión queda operativa de inmediato.
   *
   * Un solo intento por montaje: si falla (por ejemplo, la caja está inactiva),
   * no se reintenta en cada `load()` y la tarjeta de turno sigue ofreciendo el
   * botón manual.
   */
  ensureSession: async () => {
    const { activeSession, cashBoxes } = get();
    const assignedCaja = useAuthStore.getState().profile?.cajaId;
    const decision = decideSessionAutoOpen({
      hasActiveSession: Boolean(activeSession?.id),
      boundCajaId: resolveAuthorizedCajaId(assignedCaja),
      availableCajaIds: cashBoxes.map((cb) => cb.id),
      alreadyAttempted: autoOpenAttempted,
    });

    if (!decision.open) return;

    autoOpenAttempted = true;
    set({ isSubmitting: true });
    try {
      await cashierAccountantService.openSession(decision.cajaId);
      await get().load();
    } catch (error: any) {
      console.warn(
        "[ensureSession] no se pudo abrir la caja automáticamente:",
        error?.response?.data?.message || error?.message,
      );
    } finally {
      set({ isSubmitting: false });
    }
  },

  registerSale: async (saleType: "local" | "digital" = "local") => {
    const { activeSession } = get();
    if (!activeSession?.id) {
      set({ errorMessage: "No hay sesión de caja activa" });
      return null;
    }

    const profile = useAuthStore.getState().profile;
    if (!profile) {
      set({ errorMessage: "No hay perfil de usuario" });
      return null;
    }

    const header = {
      name: String(profile.pharmacyName || profile.name_group || profile.name || ""),
      rif: String(profile.rif || ""),
      address: String(profile.pharmacyAddress || ""),
      phone: String(profile.pharmacyPhone || ""),
    };

    const order = useCurrentOrderStore.getState().buildModelOrder(profile);
    if (!order) {
      set({ errorMessage: "No hay productos en la orden" });
      return null;
    }

    set({ isSubmitting: true, errorMessage: null });
    try {
      // Fallback "No Fiscal": imprime en la POS80 y persiste la venta. Es el
      // unico camino cuando la fiscal no puede emitir el comprobante.
      const runFallback = async () => {
        const outcome = await runOrderFallback({
          header,
          order,
          initialResult: null,
          transportFailed: true,
          saleType,
          sessionId: activeSession.id,
          submitOrder: cashierAccountantService.submitOrder,
          print: printNoFiscalTicket,
        });
        set({ isSubmitting: false, infoMessage: "Venta procesada" });
        await get().load();
        return outcome;
      };

      if (saleType === "local") {
        // Si esta misma venta ya emitio su comprobante (el registro fallo y el
        // cajero vuelve a cobrar), NO se le pide otro a la fiscal: se reusa el
        // COO. Volver a imprimir aqui emitia un segundo comprobante fiscal.
        const cart = currentCart();
        const alreadyIssued = issuedFiscalForCart(get().fiscalIssued[String(order.id)], cart);

        // /health verificado como caido al abrir el pago: la fiscal no puede
        // emitir, directo a No Fiscal sin intentar (sin falsos positivos).
        // Con un comprobante ya emitido para este carrito no se puede caer a No
        // Fiscal: ese papel fiscal existe y hay que registrar ESA venta.
        if (get().fiscalAvailable === false && !alreadyIssued) return await runFallback();

        let controlNumber: string;
        let fiscalSerial: string | null;

        if (alreadyIssued) {
          controlNumber = alreadyIssued.control;
          fiscalSerial = alreadyIssued.serial;
        } else {
          const fiscalPayload = buildFiscalPayload(order);
          let fiscalResult: Awaited<ReturnType<typeof fiscalPrinterClient.createInvoice>> | null = null;
          try {
            fiscalResult = await fiscalPrinterClient.createInvoice(fiscalPayload);
          } catch (error: any) {
            const mensaje = error.response?.data?.detail || error.response?.data?.message || error.message || "Error al procesar la venta";
            console.error("❌ [registerSale] Error fiscal local:", mensaje);
            // La fiscal fallo (rechazo/void, o servicio caido a mitad de venta): No Fiscal.
            return await runFallback();
          }
          // 200 sin numero de control: la fiscal no emitio COO -> No Fiscal.
          if (!fiscalResult?.fiscal_number) return await runFallback();

          const recon = reconcileFiscalTotal(fiscalResult.total, fiscalPayload.items);
          if (recon) {
            order.observaciones = order.observaciones ? `${order.observaciones} ${recon}` : recon;
          }
          controlNumber = fiscalResult.fiscal_number;
          fiscalSerial = fiscalResult.fiscal_serial ?? null;
        }

        order.numeroControlInterno = controlNumber;
        // Serial fiscal de la maquina: se guarda junto al numero de control para
        // poder conciliar el libro de ventas contra el papel. Nunca se inventa.
        order.serieFiscal = fiscalSerial;

        // Desde aca el comprobante existe en el papel: la venta se registra o se
        // reconcilia, pero nunca se "recupera" como presupuesto.
        set({
          fiscalIssued: {
            ...get().fiscalIssued,
            [String(order.id)]: {
              control: controlNumber,
              serial: fiscalSerial,
              orderId: String(order.id),
              signature: cartSignature(cart),
            },
          },
        });

        const persist = await persistLocalSale({
          order,
          saleType: "local",
          sessionId: activeSession.id,
          controlNumber,
          // Volver a cobrar el mismo carrito es un reintento: primero se pregunta
          // al libro si el comprobante ya quedo registrado.
          reconcileFirst: Boolean(alreadyIssued),
          submitOrder: cashierAccountantService.submitOrder,
          findPersistedInvoice: (control) => findIssuedInvoice(activeSession.cashBoxId, control),
        });

        if (!persist.persisted) {
          const mensaje = persist.uncertainty
            ? `La máquina fiscal emitió el comprobante ${controlNumber}, pero no se pudo confirmar si la venta quedó registrada. Verifique el libro de ventas antes de reintentar: reintentar a ciegas duplica el comprobante.`
            : `La máquina fiscal emitió el comprobante ${controlNumber} y la venta no se pudo registrar: ${persist.error ?? "error desconocido"}. Verifique el libro de ventas antes de reintentar: la orden pudo guardarse igual.`;
          console.error("❌ [registerSale] Persistencia local fallida:", mensaje);
          set({ isSubmitting: false, errorMessage: mensaje });
          return null;
        }

        // Solo se descarta el comprobante de ESTE carrito: los de otros carritos
        // siguen pendientes de registrar y no se pueden perder.
        const remaining = { ...get().fiscalIssued };
        delete remaining[String(order.id)];
        set({
          isSubmitting: false,
          fiscalIssued: remaining,
          infoMessage: persist.reconciled
            ? "Venta registrada: el comprobante ya estaba en el libro"
            : "Venta procesada exitosamente",
        });
        await get().load();
        return persist.result;
      }

      let result: Awaited<ReturnType<typeof cashierAccountantService.submitOrder>> | null = null;
      let transportFailed = false;
      try {
        result = await cashierAccountantService.submitOrder(order, saleType, activeSession.id);
      } catch (error) {
        transportFailed = true;
        console.error(
          "❌ [registerSale] Error fiscal digital:",
          error instanceof Error ? error.message : "Error de transporte",
        );
      }

      // Exito real del canal digital: respondio con numero de control.
      if (!transportFailed && !isFiscalFailure(result?.facturacion)) {
        set({ isSubmitting: false, infoMessage: "Venta procesada exitosamente" });
        await get().load();
        return result;
      }

      // Fallback "No Fiscal": los montos no se tocan; solo se sintetizan los
      // campos fiscales. Se persiste por el endpoint existente y solo se
      // reintenta cuando la llamada original fallo por transporte.
      const outcome = await runOrderFallback({
        header,
        order,
        initialResult: result,
        transportFailed,
        saleType,
        sessionId: activeSession.id,
        submitOrder: cashierAccountantService.submitOrder,
        print: printNoFiscalTicket,
      });

      set({ isSubmitting: false, infoMessage: "Venta procesada" });
      await get().load();
      return outcome;
    } catch (error: any) {
      const mensaje = error.response?.data?.message || error.message || "Error al procesar la venta";
      console.error("❌ [registerSale] Error:", mensaje);
      set({ isSubmitting: false, errorMessage: mensaje });
      return null;
    }
  },

  saveQuote: async () => {
    // Una venta cuyo comprobante fiscal ya salio no puede guardarse como
    // presupuesto: al llamarla de nuevo a venta la fiscal emite un segundo COO.
    const blocked = quoteBlockReasonForCart(issuedForCurrentCart(get().fiscalIssued), currentCart());
    if (blocked) {
      set({ errorMessage: blocked });
      return null;
    }

    const { activeSession } = get();
    if (!activeSession?.id) {
      set({ errorMessage: "No hay sesión de caja activa" });
      return null;
    }

    const profile = useAuthStore.getState().profile;
    if (!profile) {
      set({ errorMessage: "No hay perfil de usuario" });
      return null;
    }

    // Cotización: sin pagos, sin stock, sin fiscal ni printer. El rate/totales
    // quedan congelados en el body (buildModelOrder con saleStatus="Quoted").
    const order = useCurrentOrderStore.getState().buildModelOrder(profile, "Quoted");
    if (!order) {
      set({ errorMessage: "No hay productos en la orden" });
      return null;
    }

    set({ isSubmitting: true, errorMessage: null });
    try {
      const result = await cashierAccountantService.submitQuote(order, activeSession.id);
      set({
        isSubmitting: false,
        lastQuoteNumber: result.quoteNumber,
        infoMessage: "Cotización guardada",
      });
      return { ...result, order };
    } catch (error: any) {
      const mensaje =
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.message ||
        "Error al guardar la cotización";
      console.error("❌ [saveQuote] Error:", mensaje);
      set({ isSubmitting: false, errorMessage: mensaje });
      return null;
    }
  },

  saveDeliveryNote: async () => {
    // Igual que la cotizacion: con el comprobante fiscal ya emitido, sacar la
    // venta por nota de entrega la vuelve a facturar al convertirla a venta.
    const blockedNote = quoteBlockReasonForCart(issuedForCurrentCart(get().fiscalIssued), currentCart());
    if (blockedNote) {
      set({ errorMessage: blockedNote });
      return null;
    }

    const { activeSession } = get();
    if (!activeSession?.id) {
      set({ errorMessage: "No hay sesión de caja activa" });
      return null;
    }

    const profile = useAuthStore.getState().profile;
    if (!profile) {
      set({ errorMessage: "No hay perfil de usuario" });
      return null;
    }

    // Nota de entrega: sin pagos, sin stock, sin fiscal ni printer. El rate/totales
    // quedan congelados en el body (buildModelOrder con saleStatus="DeliveryNote").
    const order = useCurrentOrderStore.getState().buildModelOrder(profile, "DeliveryNote");
    if (!order) {
      set({ errorMessage: "No hay productos en la orden" });
      return null;
    }

    set({ isSubmitting: true, errorMessage: null });
    try {
      const result = await cashierAccountantService.submitDeliveryNote(order, activeSession.id);
      set({
        isSubmitting: false,
        lastQuoteNumber: result.quoteNumber,
        infoMessage: "Nota de entrega guardada",
      });
      return { ...result, order };
    } catch (error: any) {
      const mensaje =
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.message ||
        "Error al guardar la nota de entrega";
      console.error("❌ [saveDeliveryNote] Error:", mensaje);
      set({ isSubmitting: false, errorMessage: mensaje });
      return null;
    }
  },

  checkFiscalHealth: async () => {
    try {
      const health = await fiscalPrinterClient.getHealth();
      set({ fiscalAvailable: health?.status === "ok" });
    } catch {
      set({ fiscalAvailable: false });
    }
  },

  requestCloseSession: async (physicalCount, options = {}) => {
    const { activeSession } = get();
    if (!activeSession) {
      set({ errorMessage: "No hay sesión activa" });
      return;
    }
    set({ isSubmitting: true, errorMessage: null });
    try {
      await cashierAccountantService.requestCloseSession({
        caja_id: activeSession.cashBoxId,
        conteo_fisico: physicalCount,
        observaciones: options.observations,
        abrir_nuevo_turno: options.openNewTurn ?? false,
        nuevo_cajero_id: options.nextCashierId,
      });
      set({
        isSubmitting: false,
        infoMessage: "Cierre solicitado exitosamente",
        activeSession: null,
      });
    } catch (error: any) {
      const mensaje = error.response?.data?.message || "Error al solicitar cierre";
      console.error("❌ [requestCloseSession] Error:", mensaje);
      set({ isSubmitting: false, errorMessage: mensaje });
    }
  },

  issueCreditNote: async (invoiceId, reason) => {
    const { activeSession } = get();
    if (!activeSession) return;
    set({ isSubmitting: true });
    try {
      const invoice = get().sessionInvoices.find((i) => i.id === invoiceId);
      if (!invoice) throw new Error("Factura no encontrada");

      await cashierAccountantService.createCreditNote({
        factura_id: invoiceId,
        sesion_caja_id: activeSession.id,
        numero_control: cashierAccountantService.buildControlNumber("NC"),
        motivo: reason,
        tasa_cambio: invoice.exchangeRate || 1,
        detalles: invoice.lines.map((l) => ({
          detalle_factura_id: l.id,
          descripcion: l.description,
          cantidad: l.quantity,
          precio_unitario_ves: l.unitPriceVes,
          iva_porcentaje: l.vatPercentage,
        })),
        movimientos_caja: [{ moneda: "VES", monto_original: invoice.totalVes, metodo_pago: "EFECTIVO" }],
      });
      set({ isSubmitting: false, infoMessage: "Nota de crédito emitida" });
      await get().load();
    } catch (error: any) {
      const mensaje = error.response?.data?.message || "Error al emitir nota de crédito";
      set({ isSubmitting: false, errorMessage: mensaje });
    }
  },

  clearMessages: () => set({ errorMessage: null, infoMessage: null }),
  setError: (msg) => set({ errorMessage: msg }),
  setInfo: (msg) => set({ infoMessage: msg }),
}));
