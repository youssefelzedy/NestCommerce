import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  OneToMany,
} from "typeorm";
import { CustomerLogin } from "../customers/customerLogin.entity";
import { CustomerAddress } from "../customers/customerAddress.entity";
import { CustomerWishlist } from "../customers/customerWishlist.entity";

@Entity()
export class Customer {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  first_name: string;

  @Column()
  last_name: string;

  @Column()
  phone_number: string;

  @OneToOne(() => CustomerLogin, (customerLogin) => customerLogin.customer)
  login: CustomerLogin;

  @OneToMany(() => CustomerAddress, (address) => address.customer)
  addresses: CustomerAddress[];

  @OneToMany(() => CustomerWishlist, (wishlist) => wishlist.customer)
  wishlists: CustomerWishlist[];
}
