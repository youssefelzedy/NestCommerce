import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { OrderService } from './orders.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { OrderQueryDto } from './dto/order-query.dto';

interface RequestWithUser extends Request {
  user: {
    id: number;
    email: string;
    customerId: number;
  };
}

@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async createOrder(@Request() req: RequestWithUser, @Body() createOrderDto: CreateOrderDto) {
    const order = await this.orderService.createOrderFromCart(req.user.customerId, createOrderDto);
    return {
      message: 'Order created successfully',
      order,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get(':orderId')
  async getOrderById(
    @Request() req: RequestWithUser,
    @Param('orderId', ParseIntPipe) orderId: number,
  ) {
    const order = await this.orderService.getOrderById(orderId, req.user.customerId);
    return {
      message: 'Order retrieved successfully',
      order,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('customer/:customerId')
  async getOrdersByCustomer(
    @Request() req: RequestWithUser,
    @Param('customerId', ParseIntPipe) customerId: number,
    @Query() queryDto: OrderQueryDto,
  ) {
    // Ensure customer can only access their own orders
    if (req.user.customerId !== customerId) {
      customerId = req.user.customerId;
    }

    const result = await this.orderService.getOrdersByCustomer(customerId, queryDto);
    return {
      message: 'Orders retrieved successfully',
      ...result,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':orderId/status')
  async updateOrderStatus(
    @Request() req: RequestWithUser,
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body() updateStatusDto: UpdateOrderStatusDto,
  ) {
    const order = await this.orderService.updateOrderStatus(
      orderId,
      updateStatusDto,
      req.user.customerId,
    );
    return {
      message: 'Order status updated successfully',
      order,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':orderId/cancel')
  async cancelOrder(
    @Request() req: RequestWithUser,
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body() cancelDto: CancelOrderDto,
  ) {
    const order = await this.orderService.cancelOrder(orderId, cancelDto, req.user.customerId);
    return {
      message: 'Order cancelled successfully',
      order,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get(':orderId/items')
  async getOrderItems(
    @Request() req: RequestWithUser,
    @Param('orderId', ParseIntPipe) orderId: number,
  ) {
    const items = await this.orderService.getOrderItems(orderId, req.user.customerId);
    return {
      message: 'Order items retrieved successfully',
      items,
    };
  }
}
