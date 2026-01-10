import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';

import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

// Entities
import { InventoryTransaction } from './entities/inventory-transaction.entity';
import { StockReservation } from './entities/stock-reservation.entity';
import { StockAlert } from './entities/stock-alert.entity';
import { Product } from '../products/entities/product.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([InventoryTransaction, StockReservation, StockAlert, Product]),
    ScheduleModule.forRoot(),
  ],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService], // Export for Cart/Order services to use
})
export class InventoryModule {}
