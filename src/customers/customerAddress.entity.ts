import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from "typeorm";
import { Customer } from "../customers/customer.entity";

@Entity()
export class CustomerAddress {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  street: string;

  @Column({ nullable: true })
  floorNo: string;

  @Column({ nullable: true })
  aptNo: string;

  @Column()
  city: string;

  @Column()
  country: string;

  @ManyToOne(() => Customer, (customer) => customer.addresses, {
    onDelete: "CASCADE",
  })
  customer: Customer;
}
