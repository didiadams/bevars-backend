import { Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards, NotFoundException, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrderService } from './order.service';
import { OrderStatus } from './entities/order.entity';
import { OrderDocumentType } from './entities/order-document.entity';

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

    // Return enriched version for consistency
    return this.orderService.findOneWithDerived(order.id, req.user.id);
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

  @Patch(':orderId/confirm-delivery')
  async confirmDelivery(@Param('orderId') orderId: string, @Request() req) {
    return this.orderService.confirmDelivery(orderId, req.user.id);
  }

  @Post(':orderId/dispute')
  async openDispute(@Param('orderId') orderId: string, @Body() dto: { note?: string }, @Request() req) {
    return this.orderService.openDispute(orderId, req.user.id, dto.note);
  }

  @Post(':orderId/dispute/withdraw')
  async withdrawDispute(@Param('orderId') orderId: string, @Request() req) {
    return this.orderService.withdrawDispute(orderId, req.user.id);
  }

  // Internal/admin: assign a mediator to the dispute
  @Post(':orderId/dispute/assign')
  async assignMediation(@Param('orderId') orderId: string, @Body() dto: { mediatorUserId: string }, @Request() req) {
    return this.orderService.assignMediation(orderId, dto.mediatorUserId, req.user.id);
  }

  // Mediation: resolve dispute with an outcome
  @Post(':orderId/dispute/resolve')
  async resolveDispute(@Param('orderId') orderId: string, @Body() dto: { outcome: string; note?: string }, @Request() req) {
    return this.orderService.resolveDispute(orderId, req.user.id, dto.outcome, dto.note);
  }

  // Get dispute details (notes, escalation timestamp, assigned mediator)
  @Get(':orderId/dispute')
  async getDispute(@Param('orderId') orderId: string, @Request() req) {
    return this.orderService.findOne(orderId, req.user.id);
  }

  // Dispute context: previous status required docs + existing docs
  @Get(':orderId/dispute-context')
  async getDisputeContext(@Param('orderId') orderId: string, @Request() req) {
    return this.orderService.getDisputeContext(orderId, req.user.id);
  }

  // Exporter requests buyer approval after uploading required docs
  @Post(':orderId/request-approval')
  async requestApproval(@Param('orderId') orderId: string, @Body() dto: { targetStatus: OrderStatus }, @Request() req) {
    return this.orderService.requestApproval(orderId, dto.targetStatus, req.user.id);
  }

  // Buyer approves a pending approval
  @Post(':orderId/approve')
  async approve(@Param('orderId') orderId: string, @Request() req) {
    return this.orderService.approvePendingApproval(orderId, req.user.id);
  }

  // Buyer rejects a pending approval
  @Post(':orderId/reject')
  async reject(@Param('orderId') orderId: string, @Body() dto: { reason?: string }, @Request() req) {
    return this.orderService.rejectPendingApproval(orderId, req.user.id, dto.reason);
  }

  @Post(':orderId/reviews')
  async createReview(@Param('orderId') orderId: string, @Body() dto: { rating: number; comment?: string; role: 'exporter' | 'global_buyer' }, @Request() req) {
    return this.orderService.createReview(orderId, req.user.id, dto.rating, dto.comment || '', dto.role);
  }

  @Get(':orderId/reviews')
  async listReviews(@Param('orderId') orderId: string, @Request() req) {
    return this.orderService.listReviews(orderId, req.user.id);
  }

  // Simple document upload (expects frontend to upload to storage and provide URL + type)
  @Post(':orderId/documents')
  async uploadDocument(
    @Param('orderId') orderId: string,
    @Body() dto: { url?: string; fileUrl?: string; type?: string },
    @Request() req,
  ) {
    // Debug: log incoming document registration attempts so we can verify
    // whether the frontend POST reaches the backend and with what payload.
    try {
      console.log(`[order.controller] uploadDocument request - orderId=${orderId} rawType=${dto?.type} url=${dto?.url || dto?.fileUrl} userId=${req?.user?.id}`);
    } catch (e) {
      // ignore logging errors
    }

    // Normalize/alias mapping delegated to service
    const rawType = String(dto?.type || '').trim();
    const chosenType = this.orderService.normalizeDocumentType(rawType);

    const url = dto?.url || dto?.fileUrl;
    return this.orderService.addDocument(orderId, chosenType as any, url as any, req.user.id);
  }

  @Get(':orderId/documents')
  async listDocuments(@Param('orderId') orderId: string, @Request() req) {
    return this.orderService.listDocuments(orderId, req.user.id);
  }

  // Get required docs for a specific order and status (includes dynamic requirements like phytosanitary for agricultural orders)
  @Get(':orderId/required-docs/:status')
  async getOrderRequiredDocs(
    @Param('orderId') orderId: string,
    @Param('status') status: string,
    @Request() req,
  ) {
    // Validate the order belongs to this user
    await this.orderService.findOne(orderId, req.user.id);
    const requiredDocs = await this.orderService.getRequiredDocsForOrder(orderId, status as any);
    return {
      orderId,
      status,
      requiredDocs,
    };
  }

  // Canonical required-docs map (avoid frontend drift)
  @Get('meta/required-docs')
  async getRequiredDocsMap() {
    return this.orderService.getRequiredDocsMap();
  }

  // Consolidated lifecycle meta: statuses, approval-required, required-docs, document types
  @Get('meta/lifecycle')
  async getLifecycleMeta() {
    return this.orderService.getLifecycleMeta();
  }

  // Force a lifecycle meta version bump (admin-only in future). For now basic role hint via query.
  @Post('meta/lifecycle/refresh')
  async refreshLifecycleMeta(@Request() req, @Query('force') force?: string) {
    // Placeholder: in future, enforce admin guard/role. Optionally allow ?force=true.
    if (force !== 'true') {
      // Always bump; clients still decide to re-fetch if version changes.
      this.orderService.bumpLifecycleMetaVersion();
    } else {
      this.orderService.bumpLifecycleMetaVersion();
    }
    return { ok: true, version: this.orderService.getLifecycleMeta().version };
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
    return this.orderService.findOneWithDerived(orderId, req.user.id);
  }

  @Get('number/:orderNumber')
  async getOrderByNumber(@Param('orderNumber') orderNumber: string) {
    return this.orderService.findByOrderNumber(orderNumber);
  }
}

