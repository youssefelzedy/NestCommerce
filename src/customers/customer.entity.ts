import { Entity, PrimaryGeneratedColumn, Column, OneToOne, OneToMany } from 'typeorm';
import { CustomerLogin } from '../customers/customerLogin.entity';
import { CustomerAddress } from '../customers/customerAddress.entity';
import { CustomerWishlist } from '../customers/customerWishlist.entity';

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

  @OneToMany(() => CustomerAddress, (address) => address.customer)
  addresses: CustomerAddress[];

  @OneToMany(() => CustomerWishlist, (wishlist) => wishlist.customer)
  wishlists: CustomerWishlist[];
}
