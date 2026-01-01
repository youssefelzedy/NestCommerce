import { IsNotEmpty, IsOptional, IsNumber, Min } from 'class-validator';

export class CreateOrderDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  cartId?: number;
}
