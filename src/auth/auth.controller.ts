import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CustomersService } from '../customers/customers.service';
import { RegisterCustomerDto } from './dto/register.customer.dto';
import { LoginCustomerDto } from './dto/login.customer.dto';
import { ConfirmEmailDto } from './dto/confirm-email.dto';
import { ResendConfirmationDto } from './dto/resend-confirmation.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly customersService: CustomersService,
  ) {}

  @Post('register')
  async register(@Body() registerCustomerDto: RegisterCustomerDto) {
    return this.authService.register(registerCustomerDto);
  }

  @Post('login')
  async login(@Body() loginCustomerDto: LoginCustomerDto) {
    return this.authService.login(loginCustomerDto);
  }

  @Post('confirm-email')
  async confirmEmail(@Body() confirmEmailDto: ConfirmEmailDto) {
    return this.authService.confirmEmail(confirmEmailDto);
  }

  @Post('resend-confirmation')
  async resendConfirmationCode(@Body() resendDto: ResendConfirmationDto) {
    return this.authService.resendConfirmationCode(resendDto);
  }
}
