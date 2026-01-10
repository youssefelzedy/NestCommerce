import { IsInt, IsPositive, IsOptional } from 'class-validator';

export class ReserveStockDto {
  @IsInt()
  @IsPositive()
  productId: number;

  @IsInt()
  @IsPositive()
  quantity: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  cartId?: number;
}
