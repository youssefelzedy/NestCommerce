import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { CategoriesModule } from "./categories/categories.module";
import { ProductsModule } from "./products/products.module";
import { CustomersModule } from "./customers/customers.module";
import * as dotenv from "dotenv";

dotenv.config();

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: "mysql",
      host: process.env.DATABASE_HOST || "localhost",
      port: +(process.env.DATABASE_PORT || 3306),
      username: process.env.DATABASE_USERNAME || "root",
      password: process.env.DATABASE_PASSWORD || "root",
      database: process.env.DATABASE_NAME || "nestdb",
      autoLoadEntities: true, // automatically load all @Entity() classes
      synchronize: true, // dev only: auto create/update tables
    }),
    CategoriesModule,
    ProductsModule,
    CustomersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
