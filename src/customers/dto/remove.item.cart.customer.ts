import { IsNumber } from 'class-validator';

export class RemoveItemCartDto {
  @IsNumber()
  customerId: number;

  @IsNumber()
  itemId: number;
}
