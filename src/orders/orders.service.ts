import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { Order, OrderStatus } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Cart } from '../customers/entities/cart.customer.entity';
import { Product } from '../products/entities/product.entity';

import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { OrderQueryDto } from './dto/order-query.dto';

import {
  OrderCreatedEventPayload,
  OrderStatusChangedEventPayload,
  OrderCancelledEventPayload,
} from './events/order.events';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(Cart)
    private readonly cartRepository: Repository<Cart>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private readonly validStatusTransitions: Record<OrderStatus, OrderStatus[]> = {
    [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
    [OrderStatus.CONFIRMED]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
    [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
    [OrderStatus.DELIVERED]: [],
    [OrderStatus.CANCELLED]: [],
  };

  async createOrderFromCart(customerId: number, _createOrderDto: CreateOrderDto): Promise<Order> {
    return this.dataSource.transaction(async (manager) => {
      // Get customer's cart
      const cart = await manager.findOne(Cart, {
        where: { customer: { id: customerId } },
        relations: ['items', 'items.product'],
      });

      if (!cart || !cart.items || cart.items.length === 0) {
        throw new BadRequestException('Cart is empty or not found');
      }

      // Validate customer exists
      const customer = await manager.findOne(Customer, {
        where: { id: customerId },
      });

      if (!customer) {
        throw new NotFoundException('Customer not found');
      }

      // Calculate total price and validate products
      let totalPrice = 0;
      const orderItems: Partial<OrderItem>[] = [];

      for (const cartItem of cart.items) {
        const product = await manager.findOne(Product, {
          where: { id: cartItem.product.id },
        });

        if (!product) {
          throw new BadRequestException(`Product ${cartItem.product.id} not found`);
        }

        if (product.stock < cartItem.quantity) {
          throw new BadRequestException(
            `Insufficient stock for product ${product.name}. Available: ${product.stock}, Required: ${cartItem.quantity}`,
          );
        }

        const subtotal = Number(product.price) * cartItem.quantity;
        totalPrice += subtotal;

        orderItems.push({
          productId: product.id,
          quantity: cartItem.quantity,
          unitPrice: Number(product.price),
          subtotal,
        });

        // Update product stock
        product.stock -= cartItem.quantity;
        await manager.save(Product, product);
      }

      // Create order
      const order = manager.create(Order, {
        customerId,
        totalPrice,
        status: OrderStatus.PENDING,
      });

      const savedOrder = await manager.save(Order, order);

      // Create order items
      const orderItemEntities = orderItems.map((item) =>
        manager.create(OrderItem, {
          ...item,
          orderId: savedOrder.id,
        }),
      );

      await manager.save(OrderItem, orderItemEntities);

      // Clear the cart
      await manager.remove(cart.items);
      cart.totalAmount = 0;
      await manager.save(Cart, cart);

      // Emit event
      const eventPayload: OrderCreatedEventPayload = {
        orderId: savedOrder.id,
        customerId,
        totalPrice,
      };

      this.eventEmitter.emit('order.created', eventPayload);

      // Return order with items
      const finalOrder = await manager.findOne(Order, {
        where: { id: savedOrder.id },
        relations: ['items', 'items.product'],
      });

      if (!finalOrder) {
        throw new Error('Failed to retrieve created order');
      }

      return finalOrder;
    });
  }

  async getOrderById(orderId: number, customerId?: number): Promise<Order> {
    const queryBuilder = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .leftJoinAndSelect('order.customer', 'customer')
      .where('order.id = :orderId', { orderId });

    if (customerId) {
      queryBuilder.andWhere('order.customerId = :customerId', { customerId });
    }

    const order = await queryBuilder.getOne();

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async getOrdersByCustomer(
    customerId: number,
    queryDto: OrderQueryDto,
  ): Promise<{
    orders: Order[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const { page = 1, limit = 10, status, fromDate, toDate } = queryDto;
    const skip = (page - 1) * limit;

    const queryBuilder = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .where('order.customerId = :customerId', { customerId })
      .orderBy('order.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (status) {
      queryBuilder.andWhere('order.status = :status', { status });
    }

    if (fromDate) {
      queryBuilder.andWhere('order.createdAt >= :fromDate', { fromDate });
    }

    if (toDate) {
      queryBuilder.andWhere('order.createdAt <= :toDate', { toDate });
    }

    const [orders, total] = await queryBuilder.getManyAndCount();

    return {
      orders,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateOrderStatus(
    orderId: number,
    updateStatusDto: UpdateOrderStatusDto,
    customerId?: number,
  ): Promise<Order> {
    return this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, {
        where: { id: orderId },
        relations: ['customer'],
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      if (customerId && order.customerId !== customerId) {
        throw new ForbiddenException('Access denied to this order');
      }

      // Validate status transition
      const validNextStatuses = this.validStatusTransitions[order.status] || [];
      if (!validNextStatuses.includes(updateStatusDto.status)) {
        throw new BadRequestException(
          `Invalid status transition from ${order.status} to ${updateStatusDto.status}`,
        );
      }

      const oldStatus = order.status;
      order.status = updateStatusDto.status;

      await manager.save(Order, order);

      // Emit event
      const eventPayload: OrderStatusChangedEventPayload = {
        orderId: order.id,
        oldStatus,
        newStatus: updateStatusDto.status,
      };

      this.eventEmitter.emit('order.status.changed', eventPayload);

      const finalOrder = await manager.findOne(Order, {
        where: { id: orderId },
        relations: ['items', 'items.product', 'customer'],
      });

      if (!finalOrder) {
        throw new Error('Failed to retrieve updated order');
      }

      return finalOrder;
    });
  }

  async cancelOrder(
    orderId: number,
    cancelDto: CancelOrderDto,
    customerId?: number,
  ): Promise<Order> {
    return this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, {
        where: { id: orderId },
        relations: ['items', 'items.product'],
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      if (customerId && order.customerId !== customerId) {
        throw new ForbiddenException('Access denied to this order');
      }

      // Check if order can be cancelled
      const cancellableStatuses = [OrderStatus.PENDING, OrderStatus.CONFIRMED];
      if (!cancellableStatuses.includes(order.status)) {
        throw new BadRequestException(
          `Cannot cancel order in ${order.status} status. Order can only be cancelled when PENDING or CONFIRMED.`,
        );
      }

      // Restore product stock
      for (const item of order.items) {
        const product = await manager.findOne(Product, {
          where: { id: item.productId },
        });

        if (product) {
          product.stock += item.quantity;
          await manager.save(Product, product);
        }
      }

      const oldStatus = order.status;
      order.status = OrderStatus.CANCELLED;

      await manager.save(Order, order);

      // Emit events
      const statusChangedPayload: OrderStatusChangedEventPayload = {
        orderId: order.id,
        oldStatus,
        newStatus: OrderStatus.CANCELLED,
      };

      const cancelledPayload: OrderCancelledEventPayload = {
        orderId: order.id,
        reason: cancelDto.reason,
      };

      this.eventEmitter.emit('order.status.changed', statusChangedPayload);
      this.eventEmitter.emit('order.cancelled', cancelledPayload);

      const finalOrder = await manager.findOne(Order, {
        where: { id: orderId },
        relations: ['items', 'items.product', 'customer'],
      });

      if (!finalOrder) {
        throw new Error('Failed to retrieve cancelled order');
      }

      return finalOrder;
    });
  }

  async getOrderItems(orderId: number, customerId?: number): Promise<OrderItem[]> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['customer'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (customerId && order.customerId !== customerId) {
      throw new ForbiddenException('Access denied to this order');
    }

    return this.orderItemRepository.find({
      where: { orderId },
      relations: ['product'],
      order: { id: 'ASC' },
    });
  }
}
