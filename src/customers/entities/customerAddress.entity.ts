import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Customer } from './customer.entity';

@Entity()
export class CustomerAddress {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  aptNo: number;

  @Column()
  street: string;

  @Column()
  city: string;

  @Column()
  country: string;

  @ManyToOne(() => Customer, (customer) => customer.addresses, {
    onDelete: 'CASCADE',
  })
  customer: Customer;
}
