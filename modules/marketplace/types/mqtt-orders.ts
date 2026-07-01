export interface MarketplaceOrderSummary {
  _source?: "mqtt" | "redis";
  orderId: string;
  clientName: string;
  clientAddress: string;
  clientPhone?: string;
  clientIdNumber?: string;
  total?: number;
  items?: Array<{
    name: string;
    barcode?: string;
    quantity: number;
    price?: number;
  }>;
  saleType?: string;
  createdAt?: string;
}

export type FeedbackType = "success" | "error" | "none";

export interface FeedbackState {
  type: FeedbackType;
  title: string;
  message: string;
}

export interface MqttOrdersContextValue {
  queuedOrders: MarketplaceOrderSummary[];
  currentOrder: MarketplaceOrderSummary | null;
  mqttConnected: boolean;
  acceptOrder: (orderId?: string) => Promise<boolean>;
  rejectOrder: (orderId?: string, reason?: string) => Promise<boolean>;
  dismissOrder: () => void;
  focusOrder: (orderId: string) => void;
  removeFromQueue: (orderId: string) => void;
  secondsLeft: number;
  feedback: FeedbackState;
  clearFeedback: () => void;
  mqttError: string | null;
  clearMqttError: () => void;
}
