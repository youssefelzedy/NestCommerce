export interface OrderCreatedEventPayload {
  orderId: number;
  customerId: number;
  totalPrice: number;
}

export interface OrderStatusChangedEventPayload {
  orderId: number;
  oldStatus: string;
  newStatus: string;
}

export interface OrderCancelledEventPayload {
  orderId: number;
  reason?: string;
}
