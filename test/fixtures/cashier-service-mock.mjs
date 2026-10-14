/**
 * Fixture de `@/modules/cash-register/api/cashier-accountant.service`.
 *
 * Fiel al backend arreglado (P1 de `cash-session-attribution`), no conveniente:
 * un `caja_id` se autoriza SOLO cuando es la caja asignada al agente
 * (`agents.cajaId`), y un usuario con dos o más sesiones abiertas recibe 409 en
 * vez de una sesión elegida en silencio. Un fake permisivo no reproduce B1, así
 * que la fidelidad acá es el punto.
 */

const state = {
  assignedCajaId: null,
  openSessions: [],
  cashBoxes: [],
  forbiddenCajaIds: [],
  calls: [],
};

export function resetCashierServiceMock({
  assignedCajaId = null,
  openSessions = [],
  cashBoxes = [],
  forbiddenCajaIds = [],
} = {}) {
  state.assignedCajaId = assignedCajaId;
  state.openSessions = openSessions;
  state.cashBoxes = cashBoxes;
  state.forbiddenCajaIds = forbiddenCajaIds;
  state.calls = [];
}

/** Llamadas registradas, opcionalmente filtradas por nombre de método. */
export function cashierServiceCalls(fn) {
  return state.calls.filter((call) => (fn ? call.fn === fn : true));
}

function normalize(value) {
  if (typeof value !== "string") return null;
  const bare = value.startsWith("caja:") ? value.slice("caja:".length) : value;
  return bare.length > 0 ? bare : null;
}

function httpError(status, message) {
  const error = new Error(message);
  error.response = { status, data: { message } };
  return error;
}

function sessionsOfCaja(cajaId) {
  return state.openSessions.filter((s) => normalize(s.cashBoxId) === normalize(cajaId));
}

const CAJA_NO_ASIGNADA = "La caja solo puede ser consultada por el agente al que esta asignada";

export const cashierAccountantService = {
  async fetchActiveSession(cashBoxId) {
    state.calls.push({ fn: "fetchActiveSession", args: [cashBoxId] });

    // Sin caja_id: resolución por usuario, la más reciente si hay una sola;
    // 409 explícito si hay más de una (nunca elige).
    if (cashBoxId == null || cashBoxId === "") {
      if (state.openSessions.length === 0) return null;
      if (state.openSessions.length === 1) return state.openSessions[0];
      throw httpError(
        409,
        `Hay ${state.openSessions.length} sesiones de caja abiertas (${state.openSessions
          .map((s) => normalize(s.cashBoxId))
          .join(", ")}). Indique caja_id para elegir una`,
      );
    }

    // Con caja_id: autorizado solo para la caja asignada al agente.
    if (normalize(cashBoxId) !== normalize(state.assignedCajaId)) {
      throw httpError(403, CAJA_NO_ASIGNADA);
    }
    if (state.forbiddenCajaIds.some((id) => normalize(id) === normalize(cashBoxId))) {
      throw httpError(403, CAJA_NO_ASIGNADA);
    }

    const sessions = sessionsOfCaja(cashBoxId);
    if (sessions.length > 1) {
      throw httpError(
        409,
        `Hay ${sessions.length} sesiones de caja abiertas (${normalize(cashBoxId)}). Indique caja_id para elegir una`,
      );
    }
    return sessions[0] ?? null;
  },

  async fetchCashBoxes() {
    state.calls.push({ fn: "fetchCashBoxes", args: [] });
    return state.cashBoxes;
  },

  async fetchSessionInvoices() {
    state.calls.push({ fn: "fetchSessionInvoices", args: [] });
    return [];
  },

  async fetchSessionTransactions() {
    state.calls.push({ fn: "fetchSessionTransactions", args: [] });
    return [];
  },

  async openSession(cashBoxId) {
    state.calls.push({ fn: "openSession", args: [cashBoxId] });
  },

  async requestCloseSession(payload) {
    state.calls.push({ fn: "requestCloseSession", args: [payload] });
  },

  async submitOrder(_order, _saleType, sesionCajaId) {
    state.calls.push({ fn: "submitOrder", args: [sesionCajaId] });
    return {
      facturacion: { success: true, numeroControl: null, urlPdf: null, error: null },
      ordenId: "orden-1",
    };
  },

  async fetchNextCashiers() {
    return [];
  },

  async createInvoiceFromOrder() {
    return null;
  },

  async fetchInvoiceDetail() {
    return null;
  },

  async fetchCurrentRate() {
    return 0;
  },
};
