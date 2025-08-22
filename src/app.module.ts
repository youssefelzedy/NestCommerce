import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { CategoriesModule } from "./categories/categories.module";
import { ProductsModule } from "./products/products.module";

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: "mysql",
      host: process.env.DB_HOST || "localhost",
      port: +(process.env.DB_PORT || 3306),
      username: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "root",
      database: process.env.DB_NAME || "nestdb",
      autoLoadEntities: true, // automatically load all @Entity() classes
      synchronize: true, // dev only: auto create/update tables
    }),
    CategoriesModule,
    ProductsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
