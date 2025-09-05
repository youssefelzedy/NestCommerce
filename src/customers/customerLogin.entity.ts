import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { Customer } from '../customers/customer.entity';

@Entity()
export class CustomerLogin {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    unique: true,
  })
  email: string;

  @Column()
  password: string;

  @OneToOne(() => Customer, (customer) => customer.login, {
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  customer: Customer;

  @Column({ default: false })
  isEmailConfirmed: boolean;

  @Column({ type: 'varchar', length: 100, nullable: true })
  emailConfirmationCode: string | null;

  @Column({ type: 'timestamp', nullable: true })
  emailConfirmationCodeExpiresAt: Date | null;
}
