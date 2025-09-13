import { IsNumber } from 'class-validator';

export class AddItemWishlistDto {
  @IsNumber()
  customerId: number;

  @IsNumber()
  productId: number;
}
