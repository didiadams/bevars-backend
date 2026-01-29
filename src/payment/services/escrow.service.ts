import { Injectable, Logger, NotFoundException, BadRequestException, forwardRef, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { EscrowAccount, EscrowStatus } from '../entities/escrow-account.entity';
import { EscrowTransaction, TransactionType, TransactionStatus, TransactionTrigger } from '../entities/escrow-transaction.entity';
import { OrderMilestone, MilestoneType, MilestoneStatus } from '../entities/order-milestone.entity';
import { PayoutRecord, PayoutStatus } from '../entities/payout-record.entity';
import { FlutterwaveService } from './flutterwave.service';
import { PayoutService } from './payout.service';
import { Order, OrderStatus } from '../../order/entities/order.entity';
import { GlobalBuyer } from '../../global-buyer/entities/global-buyer.entity';
import { Exporter } from '../../exporter/entities/exporter.entity';

export interface CreateEscrowDto {
  orderId: string;
  buyerId: string;
  exporterId: string;
  totalAmount: number;
  currency?: string;
  buyerEmail: string;
  buyerFirstName: string;
  buyerLastName: string;
}

export interface ReleaseResult {
  success: boolean;
  transaction?: EscrowTransaction;
  payout?: PayoutRecord;
  error?: string;
}

@Injectable()
export class EscrowService {
  private readonly logger = new Logger(EscrowService.name);
  private readonly PLATFORM_FEE_PERCENT = 2.0; // 2% platform fee

  constructor(
    @InjectRepository(EscrowAccount)
    private escrowAccountRepo: Repository<EscrowAccount>,
    @InjectRepository(EscrowTransaction)
    private escrowTransactionRepo: Repository<EscrowTransaction>,
    @InjectRepository(OrderMilestone)
    private orderMilestoneRepo: Repository<OrderMilestone>,
    @InjectRepository(PayoutRecord)
    private payoutRecordRepo: Repository<PayoutRecord>,
    @InjectRepository(Order)
    private orderRepo: Repository<Order>,
    @InjectRepository(GlobalBuyer)
    private buyerRepo: Repository<GlobalBuyer>,
    @InjectRepository(Exporter)
    private exporterRepo: Repository<Exporter>,
    private flutterwaveService: FlutterwaveService,
    @Inject(forwardRef(() => PayoutService))
    private payoutService: PayoutService,
    private dataSource: DataSource,
  ) {}

  /**
   * Create escrow account and milestones for a new order
   */
  async createEscrow(dto: CreateEscrowDto): Promise<EscrowAccount> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Generate unique reference
      const txRef = `BEV-ESC-${dto.orderId.slice(0, 8)}-${Date.now()}`;

      // Create virtual account via Flutterwave
      let virtualAccountData = null;
      try {
        const vaResponse = await this.flutterwaveService.createVirtualAccount({
          email: dto.buyerEmail,
          txRef,
          amount: dto.totalAmount,
          currency: dto.currency || 'USD',
          firstName: dto.buyerFirstName,
          lastName: dto.buyerLastName,
          narration: `Bevars Order Escrow - ${dto.orderId.slice(0, 8)}`,
        });
        virtualAccountData = vaResponse.data;
      } catch (error) {
        this.logger.warn(`Virtual account creation failed, proceeding without: ${error.message}`);
        // Continue without virtual account - can be created later or use manual deposit
      }

      // Create escrow account
      const escrow = this.escrowAccountRepo.create({
        orderId: dto.orderId,
        buyerId: dto.buyerId,
        exporterId: dto.exporterId,
        totalAmount: dto.totalAmount,
        currency: dto.currency || 'USD',
        platformFeePercent: this.PLATFORM_FEE_PERCENT,
        status: EscrowStatus.AWAITING_DEPOSIT,
        virtualAccountRef: virtualAccountData?.order_ref,
        virtualAccountNumber: virtualAccountData?.account_number,
        virtualAccountBank: virtualAccountData?.bank_name,
        flutterwaveOrderRef: txRef,
      });

      const savedEscrow = await queryRunner.manager.save(escrow);

      // Create milestones
      const milestones = [
        {
          orderId: dto.orderId,
          escrowAccountId: savedEscrow.id,
          type: MilestoneType.DEPOSIT,
          status: MilestoneStatus.AWAITING_PAYMENT,
          sequenceOrder: 1,
          releasePercentage: 0, // Deposit doesn't release, it funds
          releaseAmount: 0,
        },
        {
          orderId: dto.orderId,
          escrowAccountId: savedEscrow.id,
          type: MilestoneType.PRODUCTION,
          status: MilestoneStatus.PENDING,
          sequenceOrder: 2,
          releasePercentage: 0, // No release at production
          releaseAmount: 0,
        },
        {
          orderId: dto.orderId,
          escrowAccountId: savedEscrow.id,
          type: MilestoneType.SHIPMENT,
          status: MilestoneStatus.PENDING,
          sequenceOrder: 3,
          releasePercentage: 70,
          releaseAmount: dto.totalAmount * 0.70,
        },
        {
          orderId: dto.orderId,
          escrowAccountId: savedEscrow.id,
          type: MilestoneType.DELIVERY,
          status: MilestoneStatus.PENDING,
          sequenceOrder: 4,
          releasePercentage: 30,
          releaseAmount: dto.totalAmount * 0.30,
        },
      ];

      for (const milestone of milestones) {
        await queryRunner.manager.save(
          this.orderMilestoneRepo.create(milestone),
        );
      }

      await queryRunner.commitTransaction();
      this.logger.log(`Created escrow account ${savedEscrow.id} for order ${dto.orderId}`);
      
      return savedEscrow;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to create escrow: ${error.message}`, error.stack);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Record a deposit from buyer (called by webhook or manual confirmation)
   */
  async recordDeposit(
    escrowId: string,
    amount: number,
    flutterwaveRef?: string,
    flutterwaveTransactionId?: string,
  ): Promise<EscrowTransaction> {
    const escrow = await this.escrowAccountRepo.findOne({ where: { id: escrowId } });
    if (!escrow) {
      throw new NotFoundException(`Escrow account ${escrowId} not found`);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Create deposit transaction
      const transaction = this.escrowTransactionRepo.create({
        escrowAccountId: escrowId,
        type: TransactionType.DEPOSIT,
        status: TransactionStatus.COMPLETED,
        trigger: TransactionTrigger.BUYER_DEPOSIT,
        amount,
        currency: escrow.currency,
        flutterwaveRef,
        flutterwaveTransactionId,
        description: `Buyer deposit for order ${escrow.orderId}`,
        completedAt: new Date(),
      });

      await queryRunner.manager.save(transaction);

      // Update escrow account
      const newFundedAmount = Number(escrow.fundedAmount) + amount;
      escrow.fundedAmount = newFundedAmount;
      
      if (newFundedAmount >= Number(escrow.totalAmount)) {
        escrow.status = EscrowStatus.FUNDED;
        escrow.fundedAt = new Date();
      } else if (newFundedAmount > 0) {
        escrow.status = EscrowStatus.PARTIALLY_FUNDED;
      }

      await queryRunner.manager.save(escrow);

      // Update deposit milestone
      const depositMilestone = await this.orderMilestoneRepo.findOne({
        where: { orderId: escrow.orderId, type: MilestoneType.DEPOSIT },
      });
      if (depositMilestone) {
        depositMilestone.status = MilestoneStatus.PAYMENT_RECEIVED;
        depositMilestone.completedAt = new Date();
        await queryRunner.manager.save(depositMilestone);
      }

      await queryRunner.commitTransaction();
      this.logger.log(`Recorded deposit of ${amount} for escrow ${escrowId}`);

      return transaction;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Release funds for a milestone
   */
  async releaseMilestone(
    milestoneId: string,
    initiatedBy?: string,
    autoApproved: boolean = false,
  ): Promise<ReleaseResult> {
    const milestone = await this.orderMilestoneRepo.findOne({
      where: { id: milestoneId },
      relations: ['escrowAccount', 'order'],
    });

    if (!milestone) {
      throw new NotFoundException(`Milestone ${milestoneId} not found`);
    }

    const escrow = await this.escrowAccountRepo.findOne({
      where: { id: milestone.escrowAccountId },
    });

    if (!escrow) {
      throw new NotFoundException(`Escrow account not found for milestone`);
    }

    if (escrow.status === EscrowStatus.FROZEN) {
      throw new BadRequestException('Escrow is frozen due to dispute');
    }

    if (escrow.status !== EscrowStatus.FUNDED && escrow.status !== EscrowStatus.PARTIALLY_RELEASED) {
      throw new BadRequestException('Escrow not funded or already released');
    }

    if (milestone.releasePercentage === 0) {
      throw new BadRequestException('This milestone does not release funds');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const releaseAmount = Number(milestone.releaseAmount);
      
      // Calculate platform fee for this release
      const platformFee = releaseAmount * (escrow.platformFeePercent / 100);
      const netAmount = releaseAmount - platformFee;

      // Create release transaction
      const transaction = this.escrowTransactionRepo.create({
        escrowAccountId: escrow.id,
        type: TransactionType.RELEASE,
        status: TransactionStatus.PROCESSING,
        trigger: autoApproved ? TransactionTrigger.AUTO_RELEASE : TransactionTrigger.MILESTONE_RELEASE,
        amount: releaseAmount,
        currency: escrow.currency,
        milestoneId: milestone.id,
        initiatedBy,
        description: `Release for ${milestone.type} milestone`,
      });

      await queryRunner.manager.save(transaction);

      // Create platform fee transaction
      const feeTransaction = this.escrowTransactionRepo.create({
        escrowAccountId: escrow.id,
        type: TransactionType.PLATFORM_FEE,
        status: TransactionStatus.COMPLETED,
        trigger: TransactionTrigger.MILESTONE_RELEASE,
        amount: platformFee,
        currency: escrow.currency,
        description: `Platform fee (${escrow.platformFeePercent}%) for ${milestone.type} milestone`,
        completedAt: new Date(),
      });

      await queryRunner.manager.save(feeTransaction);

      // Get exporter bank details
      const exporter = await this.exporterRepo.findOne({
        where: { id: escrow.exporterId },
        relations: ['user'],
      });

      // Create payout record (actual payout will be processed separately)
      const payout = this.payoutRecordRepo.create({
        orderId: escrow.orderId,
        exporterId: escrow.exporterId,
        escrowTransactionId: transaction.id,
        sourceAmount: netAmount,
        sourceCurrency: escrow.currency,
        destinationAmount: 0, // Will be calculated when processing payout
        destinationCurrency: 'NGN',
        platformFee,
        netAmount,
        status: PayoutStatus.PENDING,
        bankName: (exporter as any)?.bankName,
        bankCode: (exporter as any)?.bankCode,
        accountNumber: (exporter as any)?.accountNumber,
        accountName: (exporter as any)?.accountName || exporter?.user?.firstName + ' ' + exporter?.user?.lastName,
      });

      const savedPayout = await queryRunner.manager.save(payout);

      // Update escrow
      escrow.releasedAmount = Number(escrow.releasedAmount) + releaseAmount;
      escrow.platformFeeCollected = Number(escrow.platformFeeCollected) + platformFee;
      
      if (Number(escrow.releasedAmount) >= Number(escrow.totalAmount)) {
        escrow.status = EscrowStatus.RELEASED;
        escrow.releasedAt = new Date();
      } else {
        escrow.status = EscrowStatus.PARTIALLY_RELEASED;
      }

      await queryRunner.manager.save(escrow);

      // Update milestone
      milestone.status = MilestoneStatus.RELEASED;
      milestone.releasedAt = new Date();
      milestone.autoApproved = autoApproved;
      milestone.verifiedBy = initiatedBy;
      await queryRunner.manager.save(milestone);

      await queryRunner.commitTransaction();
      this.logger.log(`Released ${releaseAmount} for milestone ${milestoneId}`);

      // Auto-process payout to send money directly to exporter's bank
      // This runs after the transaction commits to avoid holding the transaction open
      if (savedPayout.bankCode && savedPayout.accountNumber) {
        setImmediate(async () => {
          try {
            this.logger.log(`Auto-processing payout ${savedPayout.id} for milestone ${milestoneId}`);
            await this.payoutService.processPayout(savedPayout.id);
            this.logger.log(`Payout ${savedPayout.id} processed successfully`);
          } catch (payoutError) {
            this.logger.error(`Auto-payout failed for ${savedPayout.id}: ${payoutError.message}. Will require manual processing.`);
            // Payout stays in PENDING/FAILED status, can be retried via admin dashboard
          }
        });
      } else {
        this.logger.warn(`Payout ${savedPayout.id} created but exporter has no bank details. Manual processing required.`);
      }

      return {
        success: true,
        transaction,
        payout: savedPayout,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to release milestone: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Freeze escrow (during dispute)
   */
  async freezeEscrow(escrowId: string, adminId: string, reason: string): Promise<EscrowAccount> {
    const escrow = await this.escrowAccountRepo.findOne({ where: { id: escrowId } });
    if (!escrow) {
      throw new NotFoundException(`Escrow account ${escrowId} not found`);
    }

    escrow.previousStatus = escrow.status;
    escrow.status = EscrowStatus.FROZEN;
    escrow.lastModifiedBy = adminId;
    escrow.adminNotes = `Frozen: ${reason}`;

    await this.escrowAccountRepo.save(escrow);
    this.logger.log(`Froze escrow ${escrowId} by admin ${adminId}`);

    return escrow;
  }

  /**
   * Unfreeze escrow (after dispute resolution)
   */
  async unfreezeEscrow(escrowId: string, adminId: string): Promise<EscrowAccount> {
    const escrow = await this.escrowAccountRepo.findOne({ where: { id: escrowId } });
    if (!escrow) {
      throw new NotFoundException(`Escrow account ${escrowId} not found`);
    }

    if (escrow.status !== EscrowStatus.FROZEN) {
      throw new BadRequestException('Escrow is not frozen');
    }

    escrow.status = escrow.previousStatus || EscrowStatus.FUNDED;
    escrow.previousStatus = null;
    escrow.lastModifiedBy = adminId;
    escrow.adminNotes = `${escrow.adminNotes || ''}\nUnfrozen by admin`;

    await this.escrowAccountRepo.save(escrow);
    this.logger.log(`Unfroze escrow ${escrowId} by admin ${adminId}`);

    return escrow;
  }

  /**
   * Process refund to buyer
   */
  async processRefund(
    escrowId: string,
    amount: number,
    reason: string,
    adminId: string,
  ): Promise<EscrowTransaction> {
    const escrow = await this.escrowAccountRepo.findOne({ where: { id: escrowId } });
    if (!escrow) {
      throw new NotFoundException(`Escrow account ${escrowId} not found`);
    }

    const availableForRefund = Number(escrow.fundedAmount) - Number(escrow.releasedAmount) - Number(escrow.refundedAmount);
    if (amount > availableForRefund) {
      throw new BadRequestException(`Cannot refund ${amount}. Only ${availableForRefund} available.`);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Create refund transaction
      const transaction = this.escrowTransactionRepo.create({
        escrowAccountId: escrowId,
        type: TransactionType.REFUND,
        status: TransactionStatus.PENDING, // Will be processed via Flutterwave
        trigger: TransactionTrigger.DISPUTE_REFUND,
        amount,
        currency: escrow.currency,
        initiatedBy: adminId,
        description: `Refund: ${reason}`,
      });

      await queryRunner.manager.save(transaction);

      // Update escrow
      escrow.refundedAmount = Number(escrow.refundedAmount) + amount;
      escrow.lastModifiedBy = adminId;

      if (Number(escrow.refundedAmount) >= Number(escrow.fundedAmount)) {
        escrow.status = EscrowStatus.REFUNDED;
        escrow.refundedAt = new Date();
      }

      await queryRunner.manager.save(escrow);

      await queryRunner.commitTransaction();
      this.logger.log(`Processed refund of ${amount} for escrow ${escrowId}`);

      return transaction;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get escrow by order ID
   */
  async getByOrderId(orderId: string): Promise<EscrowAccount | null> {
    return this.escrowAccountRepo.findOne({
      where: { orderId },
      relations: ['transactions', 'buyer', 'exporter'],
    });
  }

  /**
   * Find escrow by tx_ref pattern (for payment verification after redirect)
   * tx_ref format: BEV-ESC-{orderId-prefix}-{timestamp}-card-{timestamp}
   */
  async findByTxRefPattern(txRef: string): Promise<EscrowAccount | null> {
    // Extract the base tx_ref (without -card-timestamp suffix)
    const baseRef = txRef.replace(/-card-\d+$/, '');
    
    return this.escrowAccountRepo.findOne({
      where: { flutterwaveOrderRef: baseRef },
      relations: ['transactions', 'buyer', 'exporter'],
    });
  }

  /**
   * Get escrow with full details
   */
  async getEscrowDetails(escrowId: string): Promise<EscrowAccount> {
    const escrow = await this.escrowAccountRepo.findOne({
      where: { id: escrowId },
      relations: ['transactions', 'buyer', 'exporter', 'order'],
    });

    if (!escrow) {
      throw new NotFoundException(`Escrow account ${escrowId} not found`);
    }

    return escrow;
  }

  /**
   * Get milestones for an order
   */
  async getMilestones(orderId: string): Promise<OrderMilestone[]> {
    return this.orderMilestoneRepo.find({
      where: { orderId },
      order: { sequenceOrder: 'ASC' },
    });
  }

  /**
   * List all escrow accounts (admin)
   */
  async listAll(
    page: number = 1,
    limit: number = 20,
    status?: EscrowStatus,
  ): Promise<{ data: EscrowAccount[]; total: number; page: number; limit: number }> {
    const query = this.escrowAccountRepo.createQueryBuilder('escrow')
      .leftJoinAndSelect('escrow.buyer', 'buyer')
      .leftJoinAndSelect('buyer.user', 'buyerUser')
      .leftJoinAndSelect('escrow.exporter', 'exporter')
      .leftJoinAndSelect('exporter.user', 'exporterUser')
      .leftJoinAndSelect('escrow.order', 'order');

    if (status) {
      query.where('escrow.status = :status', { status });
    }

    query.orderBy('escrow.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await query.getManyAndCount();

    return { data, total, page, limit };
  }
}
