import { IsNumber } from 'class-validator';

export class AddItemCartDto {
  @IsNumber()
  customerId: number;

  @IsNumber()
  productId: number;

  @IsNumber()
  quantity: number;
}
