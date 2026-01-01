import { IsString, IsOptional } from 'class-validator';

export class CancelOrderDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
