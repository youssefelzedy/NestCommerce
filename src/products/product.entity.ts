import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from "typeorm";
import { Category } from "../categories/category.entity";

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

  @ManyToOne(() => Category, (category) => category.products, {
    onDelete: "SET NULL",
    nullable: true,
  })
  category: Category | null;
}
