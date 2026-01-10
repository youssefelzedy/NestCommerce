import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer } from './entities/customer.entity';
import { CustomerLogin } from './entities/customerLogin.entity';
import { CustomerAddress } from './entities/customerAddress.entity';
import { CustomerWishlist } from './entities/customerWishlist.entity';
import { Product } from 'src/products/entities/product.entity';
import { Cart } from './entities/cart.customer.entity';
import { CartItem } from './entities/cart.item.entity';

import { CustomersService } from './customers.service';
import { CustomersController } from './customers.controller';
import { AuthModule } from '../auth/auth.module';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Customer,
      CustomerLogin,
      CustomerAddress,
      CustomerWishlist,
      Product,
      Cart,
      CartItem,
    ]),
    forwardRef(() => AuthModule),
    InventoryModule,
  ],
  providers: [CustomersService],
  controllers: [CustomersController],
  exports: [CustomersService],
})
export class CustomersModule {}
