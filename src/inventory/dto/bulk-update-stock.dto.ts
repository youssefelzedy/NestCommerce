import { IsArray, ValidateNested, IsInt, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';

class BulkStockItem {
  @IsInt()
  @IsPositive()
  productId: number;

  @IsInt()
  @IsPositive()
  quantity: number;
}

export class BulkUpdateStockDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkStockItem)
  items: BulkStockItem[];
}
