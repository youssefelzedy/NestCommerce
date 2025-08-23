import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Not, Repository } from "typeorm";
import { Product } from "./product.entity";
import { CreateProductDto } from "./dto/create-product.dto";
import { CategoriesService } from "src/categories/categories.service";

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product) private readonly repo: Repository<Product>,
    private readonly categoriesService: CategoriesService,
  ) {}

  async create(dto: CreateProductDto) {
    const category = await this.categoriesService.findOne(dto.categoryId);

    if (!category) {
      throw new NotFoundException("Category not found");
    }

    // note: price in entity is string; cast here for DECIMAL
    const product = this.repo.create({
      name: dto.name,
      description: dto.description,
      price: Number(dto.price.toFixed(2)),
      stock: dto.stock,
      discountPercentage: dto.discountPercentage ?? 0,
      imageUrl: dto.imageUrl,
      category,
    });

    return this.repo.save(product);
  }

  findAll() {
    return this.repo.find({ relations: ["category"] });
  }

  findOne(id: number) {
    return this.repo.findOne({
      where: { id: id },
      relations: ["category"],
    });
  }

  findTopRated() {
    // Sort products by rating and show only first 10
    return this.repo.find({
      where: { rating: Not(IsNull()) },
      order: { rating: "DESC" },
      relations: ["category"],
      take: 10,
    });
  }

  findTopDiscounted() {
    // Sort Products by discount percentage and show only first 10
    return this.repo.find({
      where: { discountPercentage: Not(IsNull()) },
      order: { discountPercentage: "DESC" },
      relations: ["category"],
      take: 10,
    });
  }
}
