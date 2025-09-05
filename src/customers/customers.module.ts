import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer } from './customer.entity';
import { CustomerLogin } from './customerLogin.entity';
import { CustomerAddress } from './customerAddress.entity';
import { CustomerWishlist } from './customerWishlist.entity';
import { Product } from 'src/products/product.entity';
import { CustomersService } from './customers.service';
import { CustomersController } from './customers.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Customer, CustomerLogin, CustomerAddress, CustomerWishlist, Product]),
    forwardRef(() => AuthModule),
  ],
  providers: [CustomersService],
  controllers: [CustomersController],
  exports: [CustomersService],
})
export class CustomersModule {}
