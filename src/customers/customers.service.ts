import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import bcrypt from 'bcrypt';

import { Customer } from './customer.entity';
import { CustomerLogin } from './customerLogin.entity';
import { CustomerAddress } from './customerAddress.entity';
import { CustomerWishlist } from './customerWishlist.entity';
import { RegisterCustomerDto } from '../auth/dto/register.customer.dto';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private readonly customersRepository: Repository<Customer>,
    @InjectRepository(CustomerLogin)
    private readonly customerLoginRepository: Repository<CustomerLogin>,
    @InjectRepository(CustomerAddress)
    private readonly customerAddressRepository: Repository<CustomerAddress>,
    @InjectRepository(CustomerWishlist)
    private readonly customerWishlistRepository: Repository<CustomerWishlist>,
  ) {}

  async createCustomer(registerDto: RegisterCustomerDto) {
    // Check if email already exists
    const existingLogin = await this.customerLoginRepository.findOne({
      where: { email: registerDto.email },
    });

    if (existingLogin) {
      throw new ConflictException('Email already exists');
    }

    // Create a new customer info
    const customer = new Customer();
    customer.firstName = registerDto.firstName;
    customer.lastName = registerDto.lastName;
    customer.phone_number = registerDto.phone_number;
    const savedCustomer = await this.customersRepository.save(customer);

    // Create a new customer login
    const customerLogin = new CustomerLogin();
    customerLogin.email = registerDto.email;
    customerLogin.password = await this.hashPassword(registerDto.password);
    customerLogin.customer = savedCustomer;
    await this.customerLoginRepository.save(customerLogin);
    const newCustomerWithConfirmationCode = await this.confirmationCodeProcess(customerLogin);

    return {
      message: 'Registration successful. Please check your email for the confirmation code.',
      customer: savedCustomer,
      emailConfirmationCode: newCustomerWithConfirmationCode.emailConfirmationCode,
    };
  }

  async findCustomerLoginByEmail(email: string): Promise<CustomerLogin | null> {
    return this.customerLoginRepository.findOne({
      where: { email },
      relations: ['customer'],
    });
  }

  async findCustomerById(id: number, requestingUserId?: number): Promise<Customer | null> {
    const customerAccount = await this.customersRepository.findOne({
      where: { id },
    });

    if (!customerAccount) {
      return null;
    }

    // If requestingUserId is provided (from JWT), verify it matches the customer's ID
    if (requestingUserId && id !== requestingUserId) {
      throw new UnauthorizedException('You can only access your own profile');
    }

    return customerAccount;
  }

  async validatePassword(plainText: string, hashedPassword: string): Promise<boolean> {
    try {
      return await bcrypt.compare(plainText, hashedPassword);
    } catch (_) {
      throw new Error('Failed to validate password');
    }
  }

  private async hashPassword(password: string): Promise<string> {
    try {
      return await bcrypt.hash(password, 10);
    } catch (_) {
      throw new Error('Failed to hash password');
    }
  }

  async confirmationCodeProcess(customerLogin: CustomerLogin): Promise<CustomerLogin> {
    const customerConfirmationCode = this.generateConfirmationCode();
    customerLogin.emailConfirmationCode = customerConfirmationCode;
    customerLogin.emailConfirmationCodeExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes from now
    await this.customerLoginRepository.save(customerLogin);
    return customerLogin;
  }

  async saveCustomerLogin(customerLogin: CustomerLogin): Promise<CustomerLogin> {
    return await this.customerLoginRepository.save(customerLogin);
  }

  private generateConfirmationCode(): string {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    return code;
  }
}
