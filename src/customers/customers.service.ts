import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { Product } from 'src/products/entities/product.entity';
import { Customer } from './entities/customer.entity';
import { CustomerLogin } from './entities/customerLogin.entity';
import { CustomerAddress } from './entities/customerAddress.entity';
import { CustomerWishlist } from './entities/customerWishlist.entity';
import { Cart } from './entities/cart.customer.entity';
import { CartItem } from './entities/cart.item.entity';

import { AddItemWishlistDto } from './dto/add.item.wishlist.customer';
import { RemoveItemWishlistDto } from './dto/remove.item.wishlist.customer';
import { RegisterCustomerDto } from '../auth/dto/register.customer.dto';
import { AddItemCartDto } from './dto/add.item.cart.customer';
import { RemoveItemCartDto } from './dto/remove.item.cart.customer';

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
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Cart)
    private readonly cartRepository: Repository<Cart>,
    private readonly dataSource: DataSource,
    @InjectRepository(CartItem)
    private readonly cartItemRepository: Repository<CartItem>,
  ) {}

  async createCustomer(registerDto: RegisterCustomerDto) {
    // Validate customer data
    if (!registerDto.firstName || !registerDto.lastName || !registerDto.phone_number) {
      throw new BadRequestException('Customer data is incomplete');
    }

    // Check if email already exists (outside transaction)
    const existingLogin = await this.customerLoginRepository.findOne({
      where: { email: registerDto.email },
    });

    if (existingLogin) {
      throw new ConflictException('Email already exists');
    }

    // Use transaction for all database operations
    return this.dataSource.transaction(async (manager) => {
      try {
        // Create customer
        const customer = manager.create(Customer, {
          firstName: registerDto.firstName,
          lastName: registerDto.lastName,
          phone_number: registerDto.phone_number,
        });
        const savedCustomer = await manager.save(customer);

        // Create cart
        const cart = manager.create(Cart, {
          customer: savedCustomer,
        });
        await manager.save(cart);

        // Create login
        const customerLogin = manager.create(CustomerLogin, {
          email: registerDto.email,
          password: await this.hashPassword(registerDto.password),
          customer: savedCustomer,
        });
        await manager.save(customerLogin);

        // Generate confirmation code
        const confirmationCode = this.generateConfirmationCode();
        customerLogin.emailConfirmationCode = confirmationCode;
        customerLogin.emailConfirmationCodeExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
        await manager.save(customerLogin);

        return {
          message: 'Registration successful. Please check your email for the confirmation code.',
          customer: savedCustomer,
          emailConfirmationCode: confirmationCode,
        };
      } catch (error) {
        // Log the specific error
        console.error('Failed to create customer:', error);
        throw new ConflictException('Failed to create customer account');
      }
    });
  }

  async validatePassword(plainText: string, hashedPassword: string): Promise<boolean> {
    return await (bcrypt.compare as (plain: string, hashed: string) => Promise<boolean>)(
      plainText,
      hashedPassword,
    );
  }

  private async hashPassword(password: string): Promise<string> {
    return await (bcrypt.hash as (data: string, rounds: number) => Promise<string>)(password, 10);
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

  async findCustomerById(customerId: number): Promise<Customer> {
    const customer = await this.customersRepository.findOne({
      where: { id: customerId },
      relations: ['login', 'addresses', 'wishlists', 'cart'],
    });

    if (!customer) {
      throw new UnauthorizedException('Customer not found');
    }

    return customer;
  }

  async findCustomerLoginByEmail(email: string): Promise<CustomerLogin> {
    const customerLogin = await this.customerLoginRepository.findOne({
      where: { email },
      relations: ['customer'],
    });

    if (!customerLogin) {
      throw new UnauthorizedException('Customer login not found');
    }

    return customerLogin;
  }

  async addAddress(
    customerId: number,
    addressDto: Partial<CustomerAddress>,
  ): Promise<CustomerAddress> {
    const customer = await this.customersRepository.findOne({ where: { id: customerId } });

    if (!customer) {
      throw new UnauthorizedException('Customer not found');
    }

    const address = this.customerAddressRepository.create({
      ...addressDto,
      customer,
    });

    return await this.customerAddressRepository.save(address);
  }

  async getWishlistItems(customerId: number): Promise<CustomerWishlist[]> {
    const customer = await this.customersRepository.findOne({ where: { id: customerId } });

    if (!customer) {
      throw new UnauthorizedException('Customer not found');
    }

    return await this.customerWishlistRepository.find({
      where: { customer },
      relations: ['product'],
    });
  }

  async addItemToWishList(
    dto: AddItemWishlistDto,
  ): Promise<{ message: string; ItemWishlist: CustomerWishlist }> {
    const customerAccount = await this.customersRepository.findOne({
      where: { id: dto.customerId },
    });

    if (!customerAccount) {
      throw new ConflictException('Customer Not Found');
    }

    const productItem = await this.productRepository.findOne({
      where: { id: dto.productId },
    });

    if (!productItem) {
      throw new ConflictException('Product Not Found');
    }

    // Check if this product is already in the customer's wishlist
    const existingItem = await this.customerWishlistRepository.findOne({
      where: { customer: { id: dto.customerId }, product: { id: dto.productId } },
    });

    if (existingItem) {
      throw new ConflictException('Item already exists in the Wishlist!');
    }

    // Create a new Wishlist item
    const itemWishlist = new CustomerWishlist();
    itemWishlist.customer = customerAccount;
    itemWishlist.product = productItem;
    const savedItemWishlist = await this.customerWishlistRepository.save(itemWishlist);

    return {
      message: 'item was added to the Wishlist successful!',
      ItemWishlist: savedItemWishlist,
    };
  }

  async removeItemFromWishList(
    customerWishlist: RemoveItemWishlistDto,
  ): Promise<{ message: string }> {
    const item = await this.customerWishlistRepository.findOne({
      where: { id: customerWishlist.itemId },
    });

    if (!item) {
      throw new ConflictException('Item not found in the Wishlist!');
    }

    await this.customerWishlistRepository.remove(item);

    return {
      message: 'Item was removed from the Wishlist successfully!',
    };
  }

  async addToCart(dto: AddItemCartDto) {
    return this.dataSource.transaction(async (transactionManager) => {
      const customer = await transactionManager.findOne(Customer, {
        where: { id: dto.customerId },
      });

      if (!customer) {
        throw new UnauthorizedException('Customer not found');
      }

      const product = await transactionManager.findOne(Product, { where: { id: dto.productId } });

      if (!product) {
        throw new UnauthorizedException('Product not found');
      }

      if (dto.quantity <= 0) {
        throw new BadRequestException('Quantity must be greater than zero');
      }

      if (product.stock < dto.quantity) {
        throw new BadRequestException('Insufficient stock for the requested product');
      }

      const cart = await transactionManager.findOne(Cart, {
        where: { customer: { id: dto.customerId } },
        relations: ['items', 'items.product'],
      });

      if (!cart) {
        throw new UnauthorizedException('Cart not found for this customer');
      }

      // Check if the product is already in the cart
      const existingCartItem = cart.items.find((item) => item.product.id === dto.productId);
      product.stock -= dto.quantity;
      await transactionManager.save(product);
      if (existingCartItem) {
        // Update quantity if product already in cart
        existingCartItem.quantity += dto.quantity;
        await transactionManager.save(existingCartItem);
      } else {
        // Add new product to cart
        const newCartItem = transactionManager.create(CartItem, {
          product,
          quantity: dto.quantity,
          price: parseFloat(String(product.price)),
          cart,
        });
        await transactionManager.save(newCartItem);
        cart.items.push(newCartItem);
      }

      //Calculate the total cart value (sum of all items' price × quantity)
      cart.totalAmount = cart.items.reduce((total, item) => total + item.price * item.quantity, 0);
      await transactionManager.save(cart);
      return {
        message: 'Product added to cart successfully',
        cartId: cart.id,
        totalAmount: cart.totalAmount,
        itemCount: cart.items.length,
      };
    });
  }

  async getCart(customerId: number) {
    const customer = await this.customersRepository.findOne({ where: { id: customerId } });

    if (!customer) {
      throw new UnauthorizedException('Customer not found');
    }

    const cart = await this.cartRepository.findOne({
      where: { customer: { id: customerId } },
      relations: ['items', 'items.product'],
    });

    if (!cart) {
      throw new UnauthorizedException('Cart not found for this customer');
    }

    return {
      message: 'Cart retrieved successfully',
      cart,
    };
  }

  // // Update Cart Item
  // async updateCartItem(customerId: number, itemId: number, quantity: number) {
  //   // Update quantity
  //   // Recalculate cart total
  // }

  async removeFromCart(dto: RemoveItemCartDto) {
    return this.dataSource.transaction(async (transactionManager) => {
      try {
        const customer = await transactionManager.findOne(Customer, {
          where: { id: dto.customerId },
        });

        if (!customer) {
          throw new UnauthorizedException('Customer not found');
        }

        const cart = await transactionManager.findOne(Cart, {
          where: { customer: { id: dto.customerId } },
          relations: ['items', 'items.product'],
        });

        if (!cart) {
          throw new UnauthorizedException('Cart not found for this customer');
        }

        const itemIndex = cart.items.findIndex((item) => item.id === dto.itemId);
        if (itemIndex === -1) {
          throw new BadRequestException('Item not found in cart');
        }

        const cartItem = cart.items[itemIndex];

        // Restore product stock
        const product = await transactionManager.findOne(Product, {
          where: { id: cartItem.product.id },
        });

        if (product) {
          product.stock += cartItem.quantity;
          await transactionManager.save(product);
        }

        // Remove item from cart
        await transactionManager.remove(CartItem, cartItem);

        // No need to splice - recalculate with the remaining items
        const updatedCart = await transactionManager.findOne(Cart, {
          where: { id: cart.id },
          relations: ['items'],
        });

        if (!updatedCart) {
          throw new UnauthorizedException('Cart not found for this customer');
        }

        updatedCart.totalAmount = updatedCart.items.reduce(
          (total, item) => total + item.price * item.quantity,
          0,
        );

        await transactionManager.save(updatedCart);

        return {
          message: 'Item removed from cart successfully',
          cartId: updatedCart.id,
          totalAmount: updatedCart.totalAmount,
          itemCount: updatedCart.items.length,
        };
      } catch (error) {
        console.error('Failed to remove item from cart:', error);
        throw new BadRequestException('Failed to remove item from cart');
      }
    });
  }

  // // Clear Cart
  // async clearCart(customerId: number) {
  //   // Remove all items
  //   // Reset total
  // }
}
