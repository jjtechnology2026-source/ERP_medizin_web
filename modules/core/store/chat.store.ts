export interface ChatMessage {
  text: string;
  sender: "pharmacy" | "client";
  timestamp: number;
}

const messagesByOrder = new Map<string, ChatMessage[]>();

export function addChatMessage(orderId: string, msg: ChatMessage) {
  const list = messagesByOrder.get(orderId) ?? [];
  list.push(msg);
  messagesByOrder.set(orderId, list);
}

export function getChatMessages(orderId: string): ChatMessage[] {
  return messagesByOrder.get(orderId) ?? [];
}
