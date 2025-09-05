import { IsString, IsEmail, IsNotEmpty } from 'class-validator';

export class LoginCustomerDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}
