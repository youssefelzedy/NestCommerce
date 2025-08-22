import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
} from "@nestjs/common";
import { ProductsService } from "./products.service";
import { CreateProductDto } from "./dto/create-product.dto";

@Controller("products")
export class ProductsController {
  constructor(private readonly service: ProductsService) {}

  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(":id")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }
}
