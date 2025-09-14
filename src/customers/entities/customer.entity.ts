import { Entity, PrimaryGeneratedColumn, Column, OneToOne, OneToMany } from 'typeorm';
import { Exclude } from 'class-transformer';
import { CustomerLogin } from './customerLogin.entity';
import { CustomerAddress } from './customerAddress.entity';
import { CustomerWishlist } from './customerWishlist.entity';
import { Cart } from './cart.customer.entity';

@Entity()
export class Customer {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: false })
  firstName: string;

  @Column({ nullable: false })
  lastName: string;

  @Column({ nullable: false })
  phone_number: string;

  @OneToOne(() => CustomerLogin, (customerLogin) => customerLogin.customer)
  login: CustomerLogin;

  @OneToOne(() => Cart, (cart) => cart.customer)
  @Exclude({ toPlainOnly: true })
  cart: Cart;

  @OneToMany(() => CustomerAddress, (address) => address.customer)
  addresses: CustomerAddress[];

  @OneToMany(() => CustomerWishlist, (wishlist) => wishlist.customer)
  wishlists: CustomerWishlist[];
}
