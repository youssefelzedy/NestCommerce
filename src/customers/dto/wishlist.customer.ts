import { IsString, MinLength, IsArray, ValidateNested, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { Product } from 'src/products/product.entity';

export class CreateCustomerWishlistDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  customerId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Product)
  products: Product[];
}
