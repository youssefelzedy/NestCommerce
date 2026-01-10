import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Product } from '../../products/entities/product.entity';
import { Customer } from '../../customers/entities/customer.entity';
import { Cart } from '../../customers/entities/cart.customer.entity';

export enum ReservationStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

@Entity('stock_reservations')
export class StockReservation {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ name: 'product_id' })
  productId: number;

  @ManyToOne(() => Product, { nullable: false })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ name: 'customer_id' })
  customerId: number;

  @ManyToOne(() => Customer, { nullable: false })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @Column({ name: 'reserved_quantity', type: 'int' })
  reservedQuantity: number;

  @Column({
    type: 'enum',
    enum: ReservationStatus,
    default: ReservationStatus.ACTIVE,
  })
  status: ReservationStatus;

  @Column({
    name: 'expires_at',
    type: 'timestamp',
    comment: 'Reservation expiry time (typically created_at + 30 minutes)',
  })
  expiresAt: Date;

  @Column({ name: 'cart_id', nullable: true })
  cartId: number;

  @ManyToOne(() => Cart, { nullable: true })
  @JoinColumn({ name: 'cart_id' })
  cart: Cart;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
