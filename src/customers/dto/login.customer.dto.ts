import { IsString, MinLength, MaxLength } from 'class-validator';

export class LoginCustomerDto {
  @IsString()
  @MinLength(4)
  @MaxLength(200)
  email: string;

  @IsString()
  @MinLength(6)
  @MaxLength(100)
  password: string;
}
