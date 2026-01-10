import {
  IsArray,
  ValidateNested,
  IsInt,
  IsPositive,
  IsEnum,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum StockUpdateType {
  ADD = 'ADD', // Add to existing stock
  SUBTRACT = 'SUBTRACT', // Subtract from existing stock
  SET = 'SET', // Set absolute stock value
}

class BulkStockItem {
  @IsInt()
  @IsPositive()
  productId: number;

  @IsInt()
  @Min(0) // Allow 0 for SET operations
  quantity: number;

  @IsEnum(StockUpdateType)
  @IsOptional()
  updateType?: StockUpdateType; // Defaults to SET if not provided
}

export class BulkUpdateStockDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkStockItem)
  items: BulkStockItem[];

  @IsString()
  @IsOptional()
  reason?: string; // Optional reason for audit trail
}
