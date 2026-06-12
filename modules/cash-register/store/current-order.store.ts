import { create } from "zustand";
import type { Payment, PaymentMethod, CashPayment, DollarPayment, CardPayment, MobilePayment, BiopagoPayment } from "@/modules/cash-register/types/cashier.types";
import type { Medication, Order } from "@/modules/orders/types/orders";

interface CurrentOrderState {
  orders: Order[];
  currentOrderIndex: number;
  selectedPaymentMethod: PaymentMethod;
  activePaymentMethods: PaymentMethod[];
  payments: Record<PaymentMethod, Payment>;
}

interface CurrentOrderActions {
  newOrder: () => void;
  deleteOrder: () => void;
  deleteAllOrders: () => void;
  switchOrder: (index: number) => void;
  addMedication: (med: Medication, quantity: number) => { success: boolean; error?: string };
  removeMedication: (index: number) => void;
  updateQuantity: (index: number, quantity: number) => { success: boolean; error?: string };
  setCustomerField: (field: string, value: string) => void;
  setPaymentMethod: (method: PaymentMethod) => void;
  togglePaymentMethod: (method: PaymentMethod) => void;
  setPayment: (payment: Payment) => void;
  autoDistributePayment: (total: number, rate: number) => void;
  getCurrentOrder: () => Order;
  getComputedTotals: () => { subtotal: number; totalVat: number; total: number; itemCount: number };
  getPaymentsForInvoice: () => Payment[];
  resetPayments: () => void;
  clearCurrentOrder: () => void;
}

function createEmptyOrder(): Order {
  return {
    date: new Date().toISOString(),
    id: `ORD-${Date.now()}`,
    nameGroup: "",
    idAgent: "",
    nameAgent: "",
    idPharmacy: "",
    idGroup: "",
    medications: [],
    totalreal: 0,
    totalsystem: 0,
    rifEmisor: "",
    client: { id: "", documento: "", name: "", email: "", direccion: "", phone: "" },
    payments: [],
    rate: 1,
    gender: "",
    saleStatus: "Pending",
    isControlled: false,
    saleType: "local",
    address: "",
    pharmacy: "",
    facturacion: { success: false, numero_control: null, resp: null, error: null },
    observation: null,
  };
}

function createDefaultPayments(): Record<PaymentMethod, Payment> {
  return {
    efectivo: { type: "efectivo", amount: 0, change: 0 },
    dolares: { type: "dolares", amount: 0, change: 0 },
    tarjeta: { type: "tarjeta", amount: 0, punto: "", cardType: "", reference: "" },
    pagomovil: { type: "pagomovil", amount: 0, reference: "", bank: "" },
    biopago: { type: "biopago", amount: 0, reference: "", bank: "" },
  };
}

type CurrentOrderStore = CurrentOrderState & CurrentOrderActions;

export const useCurrentOrderStore = create<CurrentOrderStore>()((set, get) => ({
  orders: [createEmptyOrder()],
  currentOrderIndex: 0,
  selectedPaymentMethod: "efectivo",
  activePaymentMethods: ["efectivo"],
  payments: createDefaultPayments(),

  newOrder: () => {
    set((s) => ({
      orders: [...s.orders, createEmptyOrder()],
      currentOrderIndex: s.orders.length,
      payments: createDefaultPayments(),
      activePaymentMethods: ["efectivo"],
    }));
  },

  deleteOrder: () => {
    set((s) => {
      const updated = s.orders.filter((_, i) => i !== s.currentOrderIndex);
      const newIndex = Math.min(s.currentOrderIndex, updated.length - 1);
      return {
        orders: updated.length === 0 ? [createEmptyOrder()] : updated,
        currentOrderIndex: newIndex,
      };
    });
  },

  deleteAllOrders: () => {
    set({ orders: [createEmptyOrder()], currentOrderIndex: 0, payments: createDefaultPayments(), activePaymentMethods: ["efectivo"] });
  },

  switchOrder: (index) => {
    set({ currentOrderIndex: index, payments: createDefaultPayments(), activePaymentMethods: ["efectivo"] });
  },

  addMedication: (med, quantity) => {
    const { orders, currentOrderIndex } = get();
    const order = orders[currentOrderIndex];
    if (!order) return { success: false, error: "No hay orden activa" };

    const existingIdx = order.medications.findIndex((m) => m.barCode === med.barCode);
    let updatedMeds: Medication[];

    if (existingIdx >= 0) {
      const existing = order.medications[existingIdx];
      const newQty = existing.quantity + quantity;
      if (newQty > med.stock) {
        return { success: false, error: `Cantidad excede el stock disponible (${med.stock})` };
      }
      updatedMeds = order.medications.map((m, i) =>
        i === existingIdx ? { ...m, quantity: newQty } : m
      );
    } else {
      if (quantity > med.stock) {
        return { success: false, error: `Cantidad excede el stock disponible (${med.stock})` };
      }
      updatedMeds = [...order.medications, { ...med, quantity }];
    }

    const updatedOrders = orders.map((o, i) =>
      i === currentOrderIndex ? { ...o, medications: updatedMeds } : o
    );

    set({ orders: updatedOrders });
    return { success: true };
  },

  removeMedication: (index) => {
    set((s) => {
      const order = s.orders[s.currentOrderIndex];
      if (!order) return s;
      const updatedMeds = order.medications.filter((_, i) => i !== index);
      const updatedOrders = s.orders.map((o, i) =>
        i === s.currentOrderIndex ? { ...o, medications: updatedMeds } : o
      );
      return { orders: updatedOrders };
    });
  },

  updateQuantity: (index, quantity) => {
    const { orders, currentOrderIndex } = get();
    const order = orders[currentOrderIndex];
    if (!order) return { success: false, error: "No hay orden activa" };

    const med = order.medications[index];
    if (!med) return { success: false, error: "Medicamento no encontrado" };
    if (quantity > med.stock) {
      return { success: false, error: `Cantidad excede el stock disponible (${med.stock})` };
    }

    const updatedMeds = order.medications.map((m, i) =>
      i === index ? { ...m, quantity } : m
    );
    const updatedOrders = orders.map((o, i) =>
      i === currentOrderIndex ? { ...o, medications: updatedMeds } : o
    );

    set({ orders: updatedOrders });
    return { success: true };
  },

  setCustomerField: (field, value) => {
    set((s) => {
      const order = s.orders[s.currentOrderIndex];
      if (!order) return s;
      const updatedOrders = s.orders.map((o, i) =>
        i === s.currentOrderIndex
          ? { ...o, client: { ...o.client, [field]: value } }
          : o
      );
      return { orders: updatedOrders };
    });
  },

  setPaymentMethod: (method) => set({ selectedPaymentMethod: method }),

  togglePaymentMethod: (method) => {
    set((s) => {
      const alreadyActive = s.activePaymentMethods.includes(method);
      if (alreadyActive) {
        if (s.activePaymentMethods.length <= 1) return s;
        const updated = s.activePaymentMethods.filter((m) => m !== method);
        return {
          activePaymentMethods: updated,
          selectedPaymentMethod: updated[0],
        };
      } else {
        return {
          activePaymentMethods: [...s.activePaymentMethods, method],
          selectedPaymentMethod: method,
        };
      }
    });
  },

  setPayment: (payment) => {
    set((s) => ({
      payments: { ...s.payments, [payment.type]: payment },
    }));
  },

  autoDistributePayment: (total, rate) => {
    const { activePaymentMethods } = get();
    if (activePaymentMethods.length === 0) return;
    const share = total / activePaymentMethods.length;
    const newPayments = { ...get().payments };

    activePaymentMethods.forEach((method) => {
      const current = newPayments[method];
      if (method === "efectivo") {
        newPayments[method] = { ...current, amount: share, change: Math.max(0, share - total) } as CashPayment;
      } else if (method === "dolares") {
        const usdAmount = share / (rate || 300);
        newPayments[method] = { ...current, amount: usdAmount, change: 0 } as DollarPayment;
      } else if (method === "tarjeta") {
        newPayments[method] = { ...current, amount: share } as CardPayment;
      } else if (method === "pagomovil") {
        newPayments[method] = { ...current, amount: share } as MobilePayment;
      } else if (method === "biopago") {
        newPayments[method] = { ...current, amount: share } as BiopagoPayment;
      }
    });
    set({ payments: newPayments });
  },

  getCurrentOrder: () => {
    return get().orders[get().currentOrderIndex];
  },

  getComputedTotals: () => {
    const order = get().orders[get().currentOrderIndex];
    if (!order) return { subtotal: 0, totalVat: 0, total: 0, itemCount: 0 };

    let subtotal = 0;
    let totalVat = 0;
    let itemCount = 0;

    for (const med of order.medications) {
      const lineTotal = med.price * med.quantity;
      subtotal += lineTotal;
      totalVat += lineTotal * (med.vat / 100);
      itemCount += med.quantity;
    }

    return {
      subtotal,
      totalVat,
      total: subtotal + totalVat,
      itemCount,
    };
  },

  getPaymentsForInvoice: () => {
    const { activePaymentMethods, payments } = get();
    return activePaymentMethods
      .map((m) => payments[m])
      .filter((p) => p.amount > 0);
  },

  resetPayments: () => {
    set({ payments: createDefaultPayments() });
  },

  clearCurrentOrder: () =>
    set((s) => {
      const updated = s.orders.map((o, i) =>
        i === s.currentOrderIndex ? createEmptyOrder() : o
      );
      return { orders: updated, payments: createDefaultPayments(), activePaymentMethods: ["efectivo"] };
    }),
}));