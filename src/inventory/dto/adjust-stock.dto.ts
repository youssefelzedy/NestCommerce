import { IsInt, IsPositive, IsOptional, IsString, IsEnum } from 'class-validator';
import { TransactionType } from '../entities/inventory-transaction.entity';

export class AdjustStockDto {
  @IsInt()
  @IsPositive()
  productId: number;

  @IsInt()
  quantity: number; // Can be negative for reductions

  @IsEnum(TransactionType)
  transactionType: TransactionType;

  @IsString()
  reason: string;

  @IsOptional()
  @IsString()
  referenceType?: string;

  @IsOptional()
  @IsInt()
  referenceId?: number;
}
