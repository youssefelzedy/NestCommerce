import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { Customer } from './customer.entity';
import { CartItem } from './cart.item.entity';

@Entity()
export class Cart {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => Customer, (customer) => customer.cart, {
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  @Exclude({ toPlainOnly: true })
  customer: Customer;

  @OneToMany(() => CartItem, (cartItem) => cartItem.cart, {
    cascade: true,
  })
  items: CartItem[];

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalAmount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
