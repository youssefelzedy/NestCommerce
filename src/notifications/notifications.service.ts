import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

@Injectable()
export class NotificationsService {
  @OnEvent('inventory.low-stock.detected')
  handleLowStockAlert(payload: {
    alertCount: number;
    products: Array<{
      productId: number;
      productName: string;
      currentStock: number;
      threshold: number;
      shortfall: number;
    }>;
    createdAt: Date;
  }) {
    console.log('🚨 LOW STOCK ALERT DETECTED!');
    console.log('─────────────────────────────');
    console.log(`Total Products: ${payload.alertCount}`);
    console.log('Products:', payload.products);
    console.log('Detected at:', payload.createdAt);
  }

  @OnEvent('inventory.stock-alert.resolved')
  handleStockAlertResolved(payload: {
    alertId: number;
    productId: number;
    previousStock: number;
    newStock: number;
    resolvedAt: Date;
  }) {
    console.log('✅ STOCK ALERT RESOLVED!');
    console.log('─────────────────────────');
    console.log(`Product ID: ${payload.productId}`);
    console.log(`Previous Stock: ${payload.previousStock}`);
    console.log(`New Stock: ${payload.newStock}`);
    console.log(`Resolved at: ${payload.resolvedAt}`);
  }
}
