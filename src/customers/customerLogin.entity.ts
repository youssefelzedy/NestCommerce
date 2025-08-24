import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
} from "typeorm";
import { Customer } from "../customers/customer.entity";

@Entity()
export class CustomerLogin {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    unique: true,
  })
  email: string;

  @Column()
  passwordHash: string;

  @OneToOne(() => Customer, (customer) => customer.login, {
    onDelete: "CASCADE",
  })
  @JoinColumn()
  customer: Customer;
}
