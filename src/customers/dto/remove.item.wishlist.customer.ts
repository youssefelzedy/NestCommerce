import { IsNumber } from 'class-validator';

export class RemoveItemWishlistDto {
  @IsNumber()
  itemId: number;
}
