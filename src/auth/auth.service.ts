import {
  Injectable,
  UnauthorizedException,
  Inject,
  forwardRef,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CustomersService } from '../customers/customers.service';
import { RegisterCustomerDto } from './dto/register.customer.dto';
import { LoginCustomerDto } from './dto/login.customer.dto';
import { CustomerLogin } from '../customers/customerLogin.entity';
import { ConfirmEmailDto } from './dto/confirm-email.dto';
import { ResendConfirmationDto } from './dto/resend-confirmation.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    @Inject(forwardRef(() => CustomersService))
    private readonly customersService: CustomersService,
  ) {}

  async register(registerCustomerDto: RegisterCustomerDto) {
    const result = await this.customersService.createCustomer(registerCustomerDto);

    // Don't return a token for unconfirmed users
    console.log(
      'Customer registered successfully. Confirmation code:',
      result.emailConfirmationCode,
    );
    // In a real app, send this code via email
    console.log('Email sent to:', registerCustomerDto.email);

    return {
      message: 'Registration successful. Please check your email for the confirmation code.',
      customer: result.customer,
    };
  }

  async login(loginCustomerDto: LoginCustomerDto) {
    const customerLogin = await this.customersService.findCustomerLoginByEmail(
      loginCustomerDto.email,
    );

    console.log('Customer login found:', customerLogin);

    if (!customerLogin) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isEmailConfirmed = customerLogin.isEmailConfirmed;
    if (!isEmailConfirmed) {
      throw new UnauthorizedException(
        'Email not confirmed, please confirm your email before logging in.',
      );
    }

    const isPasswordValid = await this.customersService.validatePassword(
      loginCustomerDto.password,
      customerLogin.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateToken(customerLogin);
  }

  async confirmEmail(email: string, code: string) {
    const customerLogin = await this.customersService.findCustomerLoginByEmail(email);
    if (!customerLogin) {
      throw new UnauthorizedException('User not found');
    }

    if (customerLogin.isEmailConfirmed) {
      return { message: 'Email already confirmed' };
    }

    if (!customerLogin.emailConfirmationCode || customerLogin.emailConfirmationCode !== code) {
      throw new UnauthorizedException('Invalid confirmation code');
    }

    if (
      !customerLogin.emailConfirmationCodeExpiresAt ||
      customerLogin.emailConfirmationCodeExpiresAt < new Date()
    ) {
      const updatedLogin = await this.customersService.confirmationCodeProcess(customerLogin);
      console.log('New confirmation code generated:', updatedLogin.emailConfirmationCode);
      console.log('Email sent to:', email);
      throw new UnauthorizedException(
        'Confirmation code expired, a new code has been sent to your email',
      );
    }

    customerLogin.isEmailConfirmed = true;
    customerLogin.emailConfirmationCode = null;
    customerLogin.emailConfirmationCodeExpiresAt = null;
    await this.customersService.saveCustomerLogin(customerLogin);

    return { message: 'Email confirmed successfully' };
  }

  async resendConfirmationCode(email: string) {
    const customerLogin = await this.customersService.findCustomerLoginByEmail(email);

    if (!customerLogin) {
      throw new UnauthorizedException('User not found');
    }

    if (customerLogin.isEmailConfirmed) {
      return { message: 'Email is already confirmed' };
    }

    const updatedLogin = await this.customersService.confirmationCodeProcess(customerLogin);

    // In a real application, send this code via email
    console.log('New confirmation code generated:', updatedLogin.emailConfirmationCode);
    console.log('Email sent to:', email);

    return {
      message: 'A new confirmation code has been sent to your email',
    };
  }

  private generateToken(customerLogin: CustomerLogin) {
    const payload = {
      sub: customerLogin.id,
      email: customerLogin.email,
      customerId: customerLogin.customer.id,
    };

    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}
