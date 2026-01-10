import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, LessThan } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { Product } from '../products/entities/product.entity';
import { InventoryTransaction, TransactionType } from './entities/inventory-transaction.entity';
import { StockAlert } from './entities/stock-alert.entity';
import { StockReservation, ReservationStatus } from './entities/stock-reservation.entity';

@Injectable()
export class InventoryService {
  private readonly RESERVATION_EXPIRY_MINUTES = 30;

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
}
