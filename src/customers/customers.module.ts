import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Customer } from "./customer.entity";
import { CustomerLogin } from "./customerLogin.entity";
import { CustomerAddress } from "./customerAddress.entity";
import { CustomerWishlist } from "./customerWishlist.entity";
import { Product } from "src/products/product.entity";
import { CustomersService } from "./customers.service";
import { CustomersController } from "./customers.controller";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Customer,
      CustomerLogin,
      CustomerAddress,
      CustomerWishlist,
      Product,
    ]),
  ],
  providers: [CustomersService],
  controllers: [CustomersController],
})
export class CustomersModule {}
