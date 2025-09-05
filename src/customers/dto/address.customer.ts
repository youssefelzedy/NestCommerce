import { IsString, IsNumber, MinLength, MaxLength } from 'class-validator';

export class CreateCustomerAddressDto {
  @IsNumber()
  @MinLength(2)
  @MaxLength(100)
  aptNo: number;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  street: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  city: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  country: string;
}
