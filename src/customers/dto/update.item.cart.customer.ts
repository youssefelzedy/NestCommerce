import { IsInt, IsPositive, Min } from 'class-validator';

export class UpdateItemCartDto {
  @IsInt()
  @IsPositive()
  customerId: number;

  @IsInt()
  @IsPositive()
  itemId: number;

  @IsInt()
  @Min(0, { message: 'Quantity must be at least 0' })
  quantity: number;
}
