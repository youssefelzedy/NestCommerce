// Events emitted by the Inventory Service

export interface StockReservedEvent {
  reservationId: number;
  productId: number;
  quantity: number;
  customerId: number;
}

export interface ReservationReleasedEvent {
  reservationId: number;
  productId: number;
  quantity: number;
  customerId: number;
}

export interface ReservationConfirmedEvent {
  reservationId: number;
  productId: number;
  quantity: number;
  newStock: number;
  orderId?: number;
}

export interface ReservationExpiredEvent {
  reservationId: number;
  productId: number;
  quantity: number;
  customerId: number;
}

export interface StockAdjustedEvent {
  productId: number;
  transactionType: string;
  quantity: number;
  previousStock: number;
  newStock: number;
  reason: string;
}

export interface LowStockAlertEvent {
  alertId: number;
  productId: number;
  productName: string;
  currentStock: number;
  threshold: number;
}

// Event name constants
export const INVENTORY_EVENTS = {
  STOCK_RESERVED: 'inventory.stock.reserved',
  RESERVATION_RELEASED: 'inventory.reservation.released',
  RESERVATION_CONFIRMED: 'inventory.reservation.confirmed',
  RESERVATION_EXPIRED: 'inventory.reservation.expired',
  STOCK_ADJUSTED: 'inventory.stock.adjusted',
  LOW_STOCK_ALERT: 'inventory.low-stock.alert',
};
