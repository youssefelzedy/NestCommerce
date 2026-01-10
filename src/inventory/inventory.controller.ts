import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReserveStockDto } from './dto/reserve-stock.dto';
import { AlertStatus } from './entities/stock-alert.entity';

interface RequestWithUser extends Request {
  user: {
    id: number;
    email: string;
    customerId: number;
  };
}

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  // ==================== STOCK STATUS ====================

  @Get('products/:productId/status')
  async getProductStockStatus(@Param('productId', ParseIntPipe) productId: number) {
    const [physicalStock, reservedStock, availableStock] = await Promise.all([
      this.inventoryService.getPhysicalStock(productId),
      this.inventoryService.getReservedStock(productId),
      this.inventoryService.getAvailableStock(productId),
    ]);

    return {
      productId,
      physicalStock,
      reservedStock,
      availableStock,
      status: availableStock > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK',
    };
  }

  @Get('availability/:productId')
  async checkAvailability(
    @Param('productId', ParseIntPipe) productId: number,
    @Query('quantity', ParseIntPipe) quantity: number,
  ) {
    return this.inventoryService.checkAvailability(productId, quantity);
  }

  @Get('low-stock')
  async getLowStockAlert(@Query('status') status?: string) {
    // 1. Convert string to AlertStatus enum (if provided)
    const alertStatus = status ? (status as AlertStatus) : undefined;
    // 2. Call this.inventoryService.getLowStockAlerts(...)
    const alerts = await this.inventoryService.getLowStockAlerts(alertStatus);

    // 3. Return formatted response
    return {
      count: alerts.length,
      alerts: alerts.map((alert) => ({
        id: alert.id,
        productId: alert.productId,
        productName: alert.product?.name,
        currentStock: alert.currentStock,
        threshold: alert.alertThreshold,
        status: alert.alertStatus,
        createdAt: alert.createdAt,
      })),
    };
  }

  // ==================== RESERVATIONS ====================

  @UseGuards(JwtAuthGuard)
  @Post('reserve')
  async reserveStock(@Request() req: RequestWithUser, @Body() dto: ReserveStockDto) {
    const reservation = await this.inventoryService.reserveStock(
      dto.productId,
      dto.quantity,
      req.user.customerId,
      dto.cartId,
    );

    return {
      message: 'Stock reserved successfully',
      reservation: {
        id: reservation.id,
        productId: reservation.productId,
        quantity: reservation.reservedQuantity,
        expiresAt: reservation.expiresAt,
        status: reservation.status,
      },
    };
  }

  @UseGuards(JwtAuthGuard)
  @Delete('reserve/:reservationId')
  async releaseReservation(@Param('reservationId', ParseIntPipe) reservationId: number) {
    return this.inventoryService.releaseReservation(reservationId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('reserve/:reservationId/confirm')
  async confirmReservation(
    @Param('reservationId', ParseIntPipe) reservationId: number,
    @Query('orderId') orderId?: number,
  ) {
    const reservation = await this.inventoryService.confirmReservation(reservationId, orderId);

    return {
      message: 'Reservation confirmed and stock deducted',
      reservation: {
        id: reservation.id,
        productId: reservation.productId,
        quantity: reservation.reservedQuantity,
        status: reservation.status,
      },
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('reservations/me')
  async getMyReservations(@Request() req: RequestWithUser) {
    const reservations = await this.inventoryService.getCustomerReservations(req.user.customerId);

    return {
      count: reservations.length,
      reservations: reservations.map((r) => ({
        id: r.id,
        productId: r.productId,
        productName: r.product?.name,
        quantity: r.reservedQuantity,
        expiresAt: r.expiresAt,
        status: r.status,
      })),
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('reserve/:reservationId/update')
  async updateReservationQuantity(
    @Param('reservationId', ParseIntPipe) reservationId: number,
    @Query('quantity', ParseIntPipe) quantity: number,
  ) {
    const reservation = await this.inventoryService.updateReservationQuantity(
      reservationId,
      quantity,
    );

    return {
      message: 'Reservation updated',
      reservation: {
        id: reservation.id,
        productId: reservation.productId,
        quantity: reservation.reservedQuantity,
        expiresAt: reservation.expiresAt,
        status: reservation.status,
      },
    };
  }

  // ==================== ADMIN: CLEANUP ====================

  @Post('cleanup/expired-reservations')
  async cleanupExpiredReservations() {
    // TODO: Add admin guard
    const result = await this.inventoryService.cleanupExpiredReservations();

    return {
      message: `Cleaned up ${result.cleaned} expired reservations`,
      ...result,
    };
  }
}
