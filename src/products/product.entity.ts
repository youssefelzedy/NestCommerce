import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
} from "typeorm";
import { Category } from "../categories/category.entity";
import { CustomerWishlist } from "src/customers/customerWishlist.entity";

@Entity()
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: "text", nullable: true })
  description: string;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  price: number;

  @Column()
  stock: number;

  @Column({ nullable: true })
  imageUrl: string;

  @Column({ type: "decimal", precision: 2, scale: 1, default: 0 })
  rating: number;

  @Column({ type: "int", default: 0 })
  soldCount: number;

  @Column({ type: "decimal", precision: 5, scale: 2, default: 0 })
  discountPercentage: number;

  @ManyToOne(() => Category, (category) => category.products, {
    onDelete: "SET NULL",
    nullable: true,
  })
  category: Category | null;

  @OneToMany(() => CustomerWishlist, (wishlist) => wishlist.product)
  wishlists: CustomerWishlist[];
}
