import { Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards, NotFoundException, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrderService } from './order.service';
import { OrderStatus } from './entities/order.entity';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post('create')
  async createOrder(@Body() createDto: {
    offerId: string;
    shippingAddress?: string;
    billingAddress?: string;
    specialInstructions?: string;
  }, @Request() req) {
    return this.orderService.create(createDto);
  }

  @Get('by-offer/:offerId')
  async getOrderByOffer(@Param('offerId') offerId: string, @Request() req) {
    const order = await this.orderService.findByOfferId(offerId);
    if (!order) {
      throw new NotFoundException('No order found for this offer');
    }
    
    // Check access control
    const hasAccess = 
      order.globalBuyer?.userId === req.user.id || 
      order.exporter?.userId === req.user.id;

    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this order');
    }

    return order;
  }

  @Patch(':orderId/cancel')
  async cancelOrder(
    @Param('orderId') orderId: string,
    @Body() cancelDto: { reason?: string },
    @Request() req
  ) {
    return this.orderService.cancel(orderId, req.user.id, cancelDto.reason);
  }

  @Patch(':orderId/update')
  async updateOrder(
    @Param('orderId') orderId: string,
    @Body() updateDto: {
      shippingAddress?: string;
      billingAddress?: string;
      specialInstructions?: string;
      expectedDeliveryDate?: Date;
      notes?: string;
    },
    @Request() req
  ) {
    return this.orderService.update(orderId, updateDto, req.user.id);
  }

  @Patch(':orderId/status')
  async updateOrderStatus(
    @Param('orderId') orderId: string,
    @Body() statusDto: { status: OrderStatus },
    @Request() req
  ) {
    return this.orderService.updateStatus(orderId, statusDto.status, req.user.id);
  }

  @Get('my-orders')
  async getMyOrders(@Request() req, @Query('role') role?: string) {
    const isExporter = role === 'exporter';
    return this.orderService.getMyOrders(req.user.id, isExporter);
  }

  @Get('statistics')
  async getOrderStatistics(@Request() req, @Query('role') role?: string) {
    const isExporter = role === 'exporter';
    return this.orderService.getOrderStatistics(req.user.id, isExporter);
  }

  @Get(':orderId')
  async getOrder(@Param('orderId') orderId: string, @Request() req) {
    return this.orderService.findOne(orderId, req.user.id);
  }

  @Get('number/:orderNumber')
  async getOrderByNumber(@Param('orderNumber') orderNumber: string) {
    return this.orderService.findByOrderNumber(orderNumber);
  }
}
