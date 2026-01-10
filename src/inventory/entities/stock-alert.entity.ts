import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Product } from '../../products/entities/product.entity';

export enum AlertStatus {
  PENDING = 'PENDING',
  NOTIFIED = 'NOTIFIED',
  RESOLVED = 'RESOLVED',
}

@Entity('stock_alerts')
export class StockAlert {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ name: 'product_id' })
  productId: number;

  @ManyToOne(() => Product, { nullable: false })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ name: 'alert_threshold', type: 'int' })
  alertThreshold: number;

  @Column({ name: 'current_stock', type: 'int' })
  currentStock: number;

  @Column({
    name: 'alert_status',
    type: 'enum',
    enum: AlertStatus,
    default: AlertStatus.PENDING,
  })
  alertStatus: AlertStatus;

  @Column({
    name: 'notified_at',
    type: 'timestamp',
    nullable: true,
    comment: 'Set when notification is sent to admin',
  })
  notifiedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
