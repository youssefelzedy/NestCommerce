import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Product } from '../../products/entities/product.entity';

export enum TransactionType {
  IN = 'IN',
  OUT = 'OUT',
  ADJUSTMENT = 'ADJUSTMENT',
  RETURN = 'RETURN',
  DAMAGE = 'DAMAGE',
}

@Entity('inventory_transactions')
export class InventoryTransaction {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ name: 'product_id' })
  productId: number;

  @ManyToOne(() => Product, { nullable: false })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({
    name: 'transaction_type',
    type: 'enum',
    enum: TransactionType,
  })
  transactionType: TransactionType;

  @Column({ type: 'int', comment: 'Can be negative for OUT/DAMAGE transactions' })
  quantity: number;

  @Column({ name: 'previous_stock', type: 'int' })
  previousStock: number;

  @Column({ name: 'new_stock', type: 'int' })
  newStock: number;

  @Column({
    name: 'reference_type',
    type: 'varchar',
    length: 50,
    nullable: true,
    comment: 'Order, Return, Manual, etc.',
  })
  referenceType: string;

  @Column({ name: 'reference_id', type: 'int', nullable: true })
  referenceId: number;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({ name: 'created_by', type: 'int', nullable: true, comment: 'User/Admin ID' })
  createdBy: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
