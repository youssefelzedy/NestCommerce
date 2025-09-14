import { IsNumber } from 'class-validator';

export class RemoveItemWishlistDto {
  @IsNumber()
  productId: number;
}
