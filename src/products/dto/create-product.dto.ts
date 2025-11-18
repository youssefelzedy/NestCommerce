import {
  IsString,
  IsNumber,
  IsOptional,
  Min,
  Max,
  MinLength,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CustomerWishlist } from 'src/customers/entities/customerWishlist.entity';

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
  @Min(0)
  @Max(5)
  @IsOptional()
  rating?: number; // default = 0

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  soldCount?: number; // default = 0

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  discountPercentage?: number; // default = 0

  @Type(() => Number)
  @IsNumber()
  categoryId: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomerWishlist)
  wishlists?: CustomerWishlist[];
}
