import { Controller, Get, Param, UseGuards, Request, Post, Body, Delete } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { AddItemWishlistDto } from './dto/add.item.wishlist.customer';
import { AddItemCartDto } from './dto/add.item.cart.customer';
import { RemoveItemCartDto } from './dto/remove.item.cart.customer';

interface RequestWithUser extends Request {
  user: {
    id: number;
    email: string;
    customerId: number;
  };
}

@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('/me')
  async findOne(@Request() req: RequestWithUser) {
    // req.user contains the decoded JWT payload which includes customerId
    const customer = await this.customersService.findCustomerById(req.user.customerId);
    return customer;
  }

  @UseGuards(JwtAuthGuard)
  @Get('/whishlist/item')
  async getWishlistItems(@Request() req: RequestWithUser) {
    return await this.customersService.getWishlistItems(req.user.customerId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/whishlist/item/add/:productId')
  async addWhishList(@Request() req: RequestWithUser, @Param('productId') productId: number) {
    const dto: AddItemWishlistDto = {
      customerId: req.user.customerId,
      productId,
    };
    return await this.customersService.addItemToWishList(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('/whishlist/item/remove/:productId')
  async removeWhishList(@Param('productId') productId: number) {
    return await this.customersService.removeItemFromWishList({ productId });
  }

  @UseGuards(JwtAuthGuard)
  @Get('/cart')
  async getCartItems(@Request() req: RequestWithUser) {
    return await this.customersService.getCart(req.user.customerId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/cart/item/add/:productId/:quantity')
  async addCartItem(
    @Request() req: RequestWithUser,
    @Param('productId') productId: number,
    @Param('quantity') quantity: number,
  ) {
    const dto: AddItemCartDto = {
      customerId: req.user.customerId,
      productId,
      quantity,
    };
    return await this.customersService.addToCart(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('/cart/item/remove/:productId')
  async removeCartItem(@Request() req: RequestWithUser, @Param('productId') productId: number) {
    const dto: RemoveItemCartDto = {
      customerId: req.user.customerId,
      productId,
    };
    return await this.customersService.removeFromCart(dto);
  }
}
