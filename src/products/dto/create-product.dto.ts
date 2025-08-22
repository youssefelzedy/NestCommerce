import {
  IsString,
  IsNumber,
  IsOptional,
  Min,
  MinLength,
} from "class-validator";
import { Type } from "class-transformer";

export class CreateProductDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  stock: number;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @Type(() => Number)
  @IsNumber()
  categoryId: number;
}
