import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, LessThan } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { Product } from '../products/entities/product.entity';
import { InventoryTransaction, TransactionType } from './entities/inventory-transaction.entity';
import { StockAlert, AlertStatus } from './entities/stock-alert.entity';
import { StockReservation, ReservationStatus } from './entities/stock-reservation.entity';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class InventoryService {
  private readonly RESERVATION_EXPIRY_MINUTES = 30;
  private readonly LOW_STOCK_THRESHOLD = 10;

  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(InventoryTransaction)
    private readonly inventoryTransactionRepository: Repository<InventoryTransaction>,
    @InjectRepository(StockAlert)
    private readonly stockAlertRepository: Repository<StockAlert>,
    @InjectRepository(StockReservation)
    private readonly stockReservationRepository: Repository<StockReservation>,
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ==================== STOCK AVAILABILITY ====================

  /**
   * Get total reserved stock for a product (active reservations only)
   */
  async getReservedStock(productId: number): Promise<number> {
    const result = await this.stockReservationRepository
      .createQueryBuilder('reservation')
      .select('SUM(reservation.reservedQuantity)', 'total')
      .where('reservation.productId = :productId', { productId })
      .andWhere('reservation.status = :status', { status: ReservationStatus.ACTIVE })
      .getRawOne<{ total: string | null }>();

    return parseInt(result?.total || '0', 10);
  }

  /**
   * Get physical stock (what's in the database)
   */
  async getPhysicalStock(productId: number): Promise<number> {
    const product = await this.productRepository.findOne({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException(`Product ${productId} not found`);
    }

    return product.stock;
  }

  /**
   * Get available stock (physical - reserved)
   */
  async getAvailableStock(productId: number): Promise<number> {
    const physicalStock = await this.getPhysicalStock(productId);
    const reservedStock = await this.getReservedStock(productId);
    return physicalStock - reservedStock;
  }

  /**
   * Check if requested quantity is available
   */
  async checkAvailability(
    productId: number,
    requestedQuantity: number,
  ): Promise<{ available: boolean; availableStock: number; message: string }> {
    const availableStock = await this.getAvailableStock(productId);
    const available = availableStock >= requestedQuantity;

    return {
      available,
      availableStock,
      message: available
        ? `${requestedQuantity} units available`
        : `Only ${availableStock} units available, requested ${requestedQuantity}`,
    };
  }

  // ==================== STOCK RESERVATION ====================

  /**
   * Reserve stock when customer adds item to cart
   */
  async reserveStock(
    productId: number,
    quantity: number,
    customerId: number,
    cartId?: number,
  ): Promise<StockReservation> {
    return this.dataSource.transaction(async (manager) => {
      // Check if product exists
      const product = await manager.findOne(Product, {
        where: { id: productId },
        lock: { mode: 'pessimistic_write' }, // Lock row to prevent race conditions
      });

      if (!product) {
        throw new NotFoundException(`Product ${productId} not found`);
      }

      // Calculate available stock (within transaction)
      const reservedStock = await manager
        .createQueryBuilder(StockReservation, 'reservation')
        .select('SUM(reservation.reservedQuantity)', 'total')
        .where('reservation.productId = :productId', { productId })
        .andWhere('reservation.status = :status', { status: ReservationStatus.ACTIVE })
        .getRawOne<{ total: string | null }>();

      const totalReserved = parseInt(reservedStock?.total || '0', 10);
      const availableStock = product.stock - totalReserved;

      if (availableStock < quantity) {
        throw new BadRequestException(
          `Insufficient stock. Available: ${availableStock}, Requested: ${quantity}`,
        );
      }

      // Check for existing active reservation for same product/customer
      const existingReservation = await manager.findOne(StockReservation, {
        where: {
          productId,
          customerId,
          status: ReservationStatus.ACTIVE,
        },
      });

      if (existingReservation) {
        // Update existing reservation quantity
        const newQuantity = existingReservation.reservedQuantity + quantity;
        const newAvailable = availableStock - existingReservation.reservedQuantity;

        if (newAvailable < quantity) {
          throw new BadRequestException(
            `Insufficient stock. Available: ${newAvailable}, Requested additional: ${quantity}`,
          );
        }

        existingReservation.reservedQuantity = newQuantity;
        existingReservation.expiresAt = new Date(
          Date.now() + this.RESERVATION_EXPIRY_MINUTES * 60 * 1000,
        );

        return manager.save(StockReservation, existingReservation);
      }

      // Create new reservation
      const reservation = manager.create(StockReservation, {
        productId,
        customerId,
        cartId,
        reservedQuantity: quantity,
        status: ReservationStatus.ACTIVE,
        expiresAt: new Date(Date.now() + this.RESERVATION_EXPIRY_MINUTES * 60 * 1000),
      });

      const savedReservation = await manager.save(StockReservation, reservation);

      // Emit event
      this.eventEmitter.emit('inventory.stock.reserved', {
        reservationId: savedReservation.id,
        productId,
        quantity,
        customerId,
      });

      return savedReservation;
    });
  }

  /**
   * Release reservation when customer removes item from cart or reservation expires
   */
  async releaseReservation(reservationId: number): Promise<{ message: string }> {
    return this.dataSource.transaction(async (manager) => {
      const reservation = await manager.findOne(StockReservation, {
        where: { id: reservationId },
      });

      if (!reservation) {
        throw new NotFoundException(`Reservation ${reservationId} not found`);
      }

      if (reservation.status !== ReservationStatus.ACTIVE) {
        throw new BadRequestException(`Reservation is already ${reservation.status.toLowerCase()}`);
      }

      reservation.status = ReservationStatus.CANCELLED;
      await manager.save(StockReservation, reservation);

      // Emit event
      this.eventEmitter.emit('inventory.reservation.released', {
        reservationId,
        productId: reservation.productId,
        quantity: reservation.reservedQuantity,
        customerId: reservation.customerId,
      });

      // Check if stock alert can be resolved
      await this.resolveStockAlert(reservation.productId);

      return {
        message: `Reservation ${reservationId} released. ${reservation.reservedQuantity} units now available.`,
      };
    });
  }

  /**
   * Confirm reservation when order is created (converts reservation to actual sale)
   */
  async confirmReservation(reservationId: number, orderId?: number): Promise<StockReservation> {
    return this.dataSource.transaction(async (manager) => {
      const reservation = await manager.findOne(StockReservation, {
        where: { id: reservationId },
        relations: ['product'],
      });

      if (!reservation) {
        throw new NotFoundException(`Reservation ${reservationId} not found`);
      }

      if (reservation.status !== ReservationStatus.ACTIVE) {
        throw new BadRequestException(
          `Cannot confirm reservation. Status is ${reservation.status.toLowerCase()}`,
        );
      }

      // Get product with lock
      const product = await manager.findOne(Product, {
        where: { id: reservation.productId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!product) {
        throw new NotFoundException(`Product ${reservation.productId} not found`);
      }

      // Record previous stock for transaction log
      const previousStock = product.stock;

      // Deduct from physical stock
      product.stock -= reservation.reservedQuantity;
      await manager.save(Product, product);

      // Mark reservation as completed
      reservation.status = ReservationStatus.COMPLETED;
      await manager.save(StockReservation, reservation);

      // Record inventory transaction
      const transaction = manager.create(InventoryTransaction, {
        productId: reservation.productId,
        transactionType: TransactionType.OUT,
        quantity: -reservation.reservedQuantity,
        previousStock,
        newStock: product.stock,
        referenceType: 'ORDER',
        referenceId: orderId,
        reason: `Order confirmed from reservation #${reservationId}`,
      });
      await manager.save(InventoryTransaction, transaction);

      // Emit event
      this.eventEmitter.emit('inventory.reservation.confirmed', {
        reservationId,
        productId: reservation.productId,
        quantity: reservation.reservedQuantity,
        newStock: product.stock,
        orderId,
      });

      await this.resolveStockAlert(reservation.productId);

      return reservation;
    });
  }

  /**
   * Cleanup expired reservations (called by scheduled job)
   */
  async cleanupExpiredReservations(): Promise<{ cleaned: number; reservationIds: number[] }> {
    const now = new Date();

    // Find all expired active reservations
    const expiredReservations = await this.stockReservationRepository.find({
      where: {
        status: ReservationStatus.ACTIVE,
        expiresAt: LessThan(now),
      },
    });

    if (expiredReservations.length === 0) {
      return { cleaned: 0, reservationIds: [] };
    }

    const reservationIds: number[] = [];

    // Update each reservation to EXPIRED status
    for (const reservation of expiredReservations) {
      reservation.status = ReservationStatus.EXPIRED;
      await this.stockReservationRepository.save(reservation);
      reservationIds.push(reservation.id);

      // Emit event for each expired reservation
      this.eventEmitter.emit('inventory.reservation.expired', {
        reservationId: reservation.id,
        productId: reservation.productId,
        quantity: reservation.reservedQuantity,
        customerId: reservation.customerId,
      });

      // Check if stock alert can be resolved after releasing expired reservation
      await this.resolveStockAlert(reservation.productId);
    }

    console.log(`[Inventory] Cleaned up ${reservationIds.length} expired reservations`);

    return {
      cleaned: reservationIds.length,
      reservationIds,
    };
  }

  // ==================== HELPER METHODS ====================

  /**
   * Get all active reservations for a customer
   */
  async getCustomerReservations(customerId: number): Promise<StockReservation[]> {
    return this.stockReservationRepository.find({
      where: {
        customerId,
        status: ReservationStatus.ACTIVE,
      },
      relations: ['product'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get reservation by product and customer
   */
  async getReservationByProductAndCustomer(
    productId: number,
    customerId: number,
  ): Promise<StockReservation | null> {
    return this.stockReservationRepository.findOne({
      where: {
        productId,
        customerId,
        status: ReservationStatus.ACTIVE,
      },
    });
  }

  /**
   * Update reservation quantity (when cart quantity changes)
   */
  async updateReservationQuantity(
    reservationId: number,
    newQuantity: number,
  ): Promise<StockReservation> {
    return this.dataSource.transaction(async (manager) => {
      const reservation = await manager.findOne(StockReservation, {
        where: { id: reservationId },
      });

      if (!reservation) {
        throw new NotFoundException(`Reservation ${reservationId} not found`);
      }

      if (reservation.status !== ReservationStatus.ACTIVE) {
        throw new BadRequestException(`Cannot update ${reservation.status} reservation`);
      }

      if (newQuantity <= 0) {
        // If new quantity is 0 or less, release the reservation
        reservation.status = ReservationStatus.CANCELLED;
        return manager.save(StockReservation, reservation);
      }

      // Check if increasing quantity
      if (newQuantity > reservation.reservedQuantity) {
        const additionalNeeded = newQuantity - reservation.reservedQuantity;

        // Check availability for additional quantity
        const product = await manager.findOne(Product, {
          where: { id: reservation.productId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!product) {
          throw new NotFoundException(`Product not found`);
        }

        const reservedStock = await manager
          .createQueryBuilder(StockReservation, 'r')
          .select('SUM(r.reservedQuantity)', 'total')
          .where('r.productId = :productId', { productId: reservation.productId })
          .andWhere('r.status = :status', { status: ReservationStatus.ACTIVE })
          .andWhere('r.id != :reservationId', { reservationId })
          .getRawOne<{ total: string | null }>();

        const otherReserved = parseInt(reservedStock?.total || '0', 10);
        const availableStock = product.stock - otherReserved - reservation.reservedQuantity;

        if (availableStock < additionalNeeded) {
          throw new BadRequestException(
            `Insufficient stock. Can only add ${availableStock} more units.`,
          );
        }
      }

      reservation.reservedQuantity = newQuantity;
      reservation.expiresAt = new Date(Date.now() + this.RESERVATION_EXPIRY_MINUTES * 60 * 1000);

      return manager.save(StockReservation, reservation);
    });
  }

  // ==================== CART/ORDER INTEGRATION HELPERS ====================

  /**
   * Release reservation by product, customer, and cart (for cart removal)
   */
  async releaseReservationByProductAndCustomer(
    productId: number,
    customerId: number,
    cartId?: number,
  ): Promise<{ message: string }> {
    const whereClause: {
      productId: number;
      customerId: number;
      status: ReservationStatus;
      cartId?: number;
    } = {
      productId,
      customerId,
      status: ReservationStatus.ACTIVE,
    };

    if (cartId) {
      whereClause.cartId = cartId;
    }

    const reservation = await this.stockReservationRepository.findOne({
      where: whereClause,
    });

    if (!reservation) {
      // No active reservation found - this is okay, just return
      return { message: 'No active reservation found to release' };
    }

    return this.releaseReservation(reservation.id);
  }

  /**
   * Update reservation quantity by product and customer (for cart quantity changes)
   */
  async updateReservationQuantityByProductAndCustomer(
    productId: number,
    customerId: number,
    cartId: number,
    newQuantity: number,
  ): Promise<StockReservation> {
    const reservation = await this.stockReservationRepository.findOne({
      where: {
        productId,
        customerId,
        cartId,
        status: ReservationStatus.ACTIVE,
      },
    });

    if (!reservation) {
      // If no existing reservation, create a new one
      if (newQuantity > 0) {
        return this.reserveStock(productId, newQuantity, customerId, cartId);
      }
      throw new NotFoundException(`No active reservation found for product ${productId}`);
    }

    return this.updateReservationQuantity(reservation.id, newQuantity);
  }

  /**
   * Confirm reservation by product and customer (for order creation)
   */
  async confirmReservationByProductAndCustomer(
    productId: number,
    customerId: number,
    cartId: number,
    orderId?: number,
  ): Promise<StockReservation> {
    const reservation = await this.stockReservationRepository.findOne({
      where: {
        productId,
        customerId,
        cartId,
        status: ReservationStatus.ACTIVE,
      },
    });

    if (!reservation) {
      throw new NotFoundException(
        `No active reservation found for product ${productId} and customer ${customerId}`,
      );
    }

    return this.confirmReservation(reservation.id, orderId);
  }

  async checkLowStockAlerts(): Promise<{ product: Product; availableStock: number }[]> {
    const lowStockProducts: { product: Product; availableStock: number }[] = [];
    // 1. Get all products
    const products = await this.productRepository.find();

    if (products.length === 0) {
      return [];
    }
    // 2. For each product, check available stock
    for (const product of products) {
      const availableStock = await this.getAvailableStock(product.id);

      // 3. Filter products where availableStock < threshold
      if (availableStock < this.LOW_STOCK_THRESHOLD) {
        lowStockProducts.push({ product, availableStock });
      }
    }
    // 4. Return the low stock products
    return lowStockProducts;
  }

  async createOrUpdateStockAlert(
    productId: number,
    currentStock: number,
    threshold: number,
  ): Promise<StockAlert> {
    // 1. Find existing PENDING alert for this product
    const existingAlert = await this.stockAlertRepository.findOne({
      where: {
        productId,
        alertStatus: AlertStatus.PENDING,
      },
    });

    // 2. If found, update currentStock and save
    if (existingAlert) {
      existingAlert.currentStock = currentStock;
      existingAlert.alertThreshold = threshold;
      await this.stockAlertRepository.save(existingAlert);
      return existingAlert;
    }

    // 3. If not found, create new alert with PENDING status
    const newAlert = this.stockAlertRepository.create({
      productId,
      currentStock,
      alertThreshold: threshold,
      alertStatus: AlertStatus.PENDING,
    });
    await this.stockAlertRepository.save(newAlert);

    // 4. Return the alert
    return newAlert;
  }

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async handleLowStockCheck(): Promise<void> {
    console.log('[Inventory] Running low stock check...');

    // 1. Get low stock products using checkLowStockAlerts()
    const lowStockProducts = await this.checkLowStockAlerts();

    if (lowStockProducts.length === 0) {
      console.log('[Inventory] No low stock');
      return;
    }
    // 2. For each, call createOrUpdateStockAlert()
    for (const { product, availableStock } of lowStockProducts) {
      await this.createOrUpdateStockAlert(product.id, availableStock, this.LOW_STOCK_THRESHOLD);
    }
    // 3. Emit event with summary for notification system
    this.eventEmitter.emit('inventory.low-stock.detected', {
      alertCount: lowStockProducts.length,
      products: lowStockProducts.map(({ product, availableStock }) => ({
        productId: product.id,
        productName: product.name,
        currentStock: availableStock,
        threshold: this.LOW_STOCK_THRESHOLD,
        shortfall: this.LOW_STOCK_THRESHOLD - availableStock,
      })),
      createdAt: new Date(),
    });
    // 4. Log summary
    console.log(`[Inventory] Found ${lowStockProducts.length} low stock products`);
  }

  async getLowStockAlerts(status?: AlertStatus): Promise<StockAlert[]> {
    // Build where clause conditionally
    const whereClause = status ? { alertStatus: status } : {};

    // Query with optional filter
    const stockAlerts = await this.stockAlertRepository.find({
      where: whereClause,
      relations: ['product'],
      order: { createdAt: 'DESC' },
    });

    return stockAlerts;
  }

  /**
   * Resolve stock alert when stock is replenished
   * Called when stock is added back (restock, return, etc.)
   */
  async resolveStockAlert(productId: number): Promise<StockAlert | null> {
    // 1. Find existing PENDING alert for this product
    const existingAlert = await this.stockAlertRepository.findOne({
      where: {
        productId,
        alertStatus: AlertStatus.PENDING,
      },
    });

    // 2. If no pending alert, return null
    if (!existingAlert) {
      return null;
    }

    // 3. Check if stock is now above threshold
    const availableStock = await this.getAvailableStock(productId);

    if (availableStock >= this.LOW_STOCK_THRESHOLD) {
      // Store the original stock value before updating
      const previousStock = existingAlert.currentStock;

      // 4. Mark alert as RESOLVED
      existingAlert.alertStatus = AlertStatus.RESOLVED;
      existingAlert.currentStock = availableStock;
      await this.stockAlertRepository.save(existingAlert);

      // 5. Emit event for notification
      this.eventEmitter.emit('inventory.stock-alert.resolved', {
        alertId: existingAlert.id,
        productId,
        previousStock,
        newStock: availableStock,
        resolvedAt: new Date(),
      });

      console.log(`[Inventory] Stock alert resolved for product ${productId}`);
      return existingAlert;
    }

    // Stock still below threshold, update current stock but keep PENDING
    existingAlert.currentStock = availableStock;
    await this.stockAlertRepository.save(existingAlert);
    return existingAlert;
  }

  // ==================== BULK OPERATIONS ====================

  /**
   * Bulk update stock for multiple products
   * Supports ADD, SUBTRACT, and SET operations
   * All updates happen in a single transaction - all succeed or all fail
   */
  async bulkUpdateStock(
    items: Array<{ productId: number; quantity: number; updateType?: string }>,
    reason?: string,
  ): Promise<{
    success: boolean;
    updated: number;
    results: Array<{
      productId: number;
      previousStock: number;
      newStock: number;
      updateType: string;
      success: boolean;
      error?: string;
    }>;
  }> {
    const results: Array<{
      productId: number;
      previousStock: number;
      newStock: number;
      updateType: string;
      success: boolean;
      error?: string;
    }> = [];

    return this.dataSource.transaction(async (manager) => {
      for (const item of items) {
        try {
          const updateType = item.updateType || 'SET';

          // Lock the product row to prevent race conditions
          const product = await manager.findOne(Product, {
            where: { id: item.productId },
            lock: { mode: 'pessimistic_write' },
          });

          if (!product) {
            results.push({
              productId: item.productId,
              previousStock: 0,
              newStock: 0,
              updateType,
              success: false,
              error: `Product ${item.productId} not found`,
            });
            continue;
          }

          const previousStock = product.stock;
          let newStock: number;
          let transactionType: TransactionType;
          let quantityChange: number;

          // Calculate new stock based on update type
          switch (updateType) {
            case 'ADD': {
              newStock = previousStock + item.quantity;
              quantityChange = item.quantity;
              transactionType = TransactionType.IN;
              break;
            }

            case 'SUBTRACT': {
              newStock = previousStock - item.quantity;
              quantityChange = -item.quantity;
              transactionType = TransactionType.OUT;

              // Validate against reserved stock
              const reserved = await this.getReservedStock(item.productId);
              if (newStock < reserved) {
                results.push({
                  productId: item.productId,
                  previousStock,
                  newStock: previousStock,
                  updateType,
                  success: false,
                  error: `Cannot reduce stock below reserved amount. Reserved: ${reserved}, Attempted new stock: ${newStock}`,
                });
                continue;
              }
              break;
            }

            case 'SET':
            default: {
              // Validate against reserved stock for SET operations
              const reservedForSet = await this.getReservedStock(item.productId);
              if (item.quantity < reservedForSet) {
                results.push({
                  productId: item.productId,
                  previousStock,
                  newStock: previousStock,
                  updateType,
                  success: false,
                  error: `Cannot set stock below reserved amount. Reserved: ${reservedForSet}, Attempted: ${item.quantity}`,
                });
                continue;
              }

              newStock = item.quantity;
              quantityChange = newStock - previousStock;
              transactionType = quantityChange >= 0 ? TransactionType.IN : TransactionType.OUT;
              break;
            }
          }

          // Validate non-negative stock
          if (newStock < 0) {
            results.push({
              productId: item.productId,
              previousStock,
              newStock: previousStock,
              updateType,
              success: false,
              error: `Stock cannot be negative. Current: ${previousStock}, Attempted: ${newStock}`,
            });
            continue;
          }

          // Update product stock
          product.stock = newStock;
          await manager.save(Product, product);

          // Record inventory transaction
          const transaction = manager.create(InventoryTransaction, {
            productId: item.productId,
            transactionType,
            quantity: quantityChange,
            previousStock,
            newStock,
            referenceType: 'BULK_UPDATE',
            reason: reason || `Bulk stock ${updateType.toLowerCase()}: ${item.quantity} units`,
          });
          await manager.save(InventoryTransaction, transaction);

          // Check and update stock alerts
          const availableStock = await this.getAvailableStock(item.productId);
          await this.createOrUpdateStockAlert(
            item.productId,
            availableStock,
            this.LOW_STOCK_THRESHOLD,
          );
          await this.resolveStockAlert(item.productId);

          results.push({
            productId: item.productId,
            previousStock,
            newStock,
            updateType,
            success: true,
          });
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          results.push({
            productId: item.productId,
            previousStock: 0,
            newStock: 0,
            updateType: item.updateType || 'SET',
            success: false,
            error: errorMessage,
          });
        }
      }

      // Check if all updates were successful
      const allSuccessful = results.every((r) => r.success);
      const successCount = results.filter((r) => r.success).length;

      // If any failed, rollback transaction
      if (!allSuccessful) {
        throw new BadRequestException({
          message: `Bulk update failed. ${successCount}/${items.length} succeeded. Transaction rolled back.`,
          results,
        });
      }

      return {
        success: true,
        updated: successCount,
        results,
      };
    });
  }
}
