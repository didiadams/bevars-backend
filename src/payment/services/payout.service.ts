import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PayoutRecord, PayoutStatus } from '../entities/payout-record.entity';
import { EscrowTransaction, TransactionStatus } from '../entities/escrow-transaction.entity';
import { FlutterwaveService } from './flutterwave.service';
import { Exporter } from '../../exporter/entities/exporter.entity';

@Injectable()
export class PayoutService {
  private readonly logger = new Logger(PayoutService.name);
  private readonly MAX_RETRIES = 3;

  constructor(
    @InjectRepository(PayoutRecord)
    private payoutRepo: Repository<PayoutRecord>,
    @InjectRepository(EscrowTransaction)
    private transactionRepo: Repository<EscrowTransaction>,
    @InjectRepository(Exporter)
    private exporterRepo: Repository<Exporter>,
    private flutterwaveService: FlutterwaveService,
  ) {}

  /**
   * Process a pending payout
   */
  async processPayout(payoutId: string): Promise<PayoutRecord> {
    const payout = await this.payoutRepo.findOne({
      where: { id: payoutId },
      relations: ['exporter', 'exporter.user'],
    });

    if (!payout) {
      throw new NotFoundException(`Payout ${payoutId} not found`);
    }

    if (payout.status !== PayoutStatus.PENDING && payout.status !== PayoutStatus.FAILED) {
      throw new BadRequestException(`Payout is already ${payout.status}`);
    }

    // Validate bank details
    if (!payout.bankCode || !payout.accountNumber) {
      const exporter = await this.exporterRepo.findOne({
        where: { id: payout.exporterId },
      });

      if (!(exporter as any)?.bankCode || !(exporter as any)?.accountNumber) {
        payout.status = PayoutStatus.ON_HOLD;
        payout.errorMessage = 'Exporter bank details not configured';
        await this.payoutRepo.save(payout);
        throw new BadRequestException('Exporter bank details not configured');
      }

      payout.bankCode = (exporter as any).bankCode;
      payout.accountNumber = (exporter as any).accountNumber;
      payout.bankName = (exporter as any).bankName;
      payout.accountName = (exporter as any).accountName;
    }

    try {
      // Get current FX rate
      const fxResponse = await this.flutterwaveService.getFxRate('USD', 'NGN', payout.sourceAmount);
      const rate = fxResponse.data.rate;
      const destinationAmount = payout.sourceAmount * rate;

      payout.exchangeRate = rate;
      payout.destinationAmount = destinationAmount;
      payout.status = PayoutStatus.PROCESSING;
      await this.payoutRepo.save(payout);

      // Generate unique reference
      const reference = `BEV-PAY-${payout.id.slice(0, 8)}-${Date.now()}`;

      // Initiate transfer
      const transferResponse = await this.flutterwaveService.initiateTransfer({
        bankCode: payout.bankCode,
        accountNumber: payout.accountNumber,
        amount: destinationAmount,
        currency: 'NGN',
        narration: `Bevars payout for order ${payout.orderId.slice(0, 8)}`,
        reference,
        beneficiaryName: payout.accountName || 'Bevars Exporter',
      });

      payout.flutterwaveTransferId = String(transferResponse.data.id);
      payout.flutterwaveReference = reference;
      payout.providerResponse = transferResponse.data;

      if (transferResponse.data.status === 'SUCCESS' || transferResponse.data.status === 'SUCCESSFUL') {
        payout.status = PayoutStatus.COMPLETED;
        payout.completedAt = new Date();
      } else if (transferResponse.data.status === 'PENDING') {
        payout.status = PayoutStatus.PROCESSING;
      } else {
        payout.status = PayoutStatus.FAILED;
        payout.errorMessage = transferResponse.data.complete_message || 'Transfer failed';
      }

      await this.payoutRepo.save(payout);

      // Update related escrow transaction
      if (payout.escrowTransactionId) {
        await this.transactionRepo.update(payout.escrowTransactionId, {
          status: payout.status === PayoutStatus.COMPLETED ? TransactionStatus.COMPLETED : TransactionStatus.PROCESSING,
          flutterwaveTransferId: payout.flutterwaveTransferId,
          exchangeRate: rate,
          destinationAmount,
          destinationCurrency: 'NGN',
          completedAt: payout.status === PayoutStatus.COMPLETED ? new Date() : null,
        });
      }

      this.logger.log(`Processed payout ${payoutId}: ${payout.status}`);
      return payout;

    } catch (error) {
      this.logger.error(`Payout processing failed: ${error.message}`, error.stack);
      
      payout.status = PayoutStatus.FAILED;
      payout.errorMessage = error.message;
      payout.retryCount = (payout.retryCount || 0) + 1;
      payout.lastRetryAt = new Date();
      await this.payoutRepo.save(payout);

      throw error;
    }
  }

  /**
   * Retry a failed payout
   */
  async retryPayout(payoutId: string, adminId?: string): Promise<PayoutRecord> {
    const payout = await this.payoutRepo.findOne({ where: { id: payoutId } });
    
    if (!payout) {
      throw new NotFoundException(`Payout ${payoutId} not found`);
    }

    if (payout.status !== PayoutStatus.FAILED) {
      throw new BadRequestException('Can only retry failed payouts');
    }

    if (payout.retryCount >= this.MAX_RETRIES) {
      throw new BadRequestException(`Max retries (${this.MAX_RETRIES}) exceeded. Manual intervention required.`);
    }

    payout.processedBy = adminId;
    await this.payoutRepo.save(payout);

    return this.processPayout(payoutId);
  }

  /**
   * Check and update payout status from Flutterwave
   */
  async syncPayoutStatus(payoutId: string): Promise<PayoutRecord> {
    const payout = await this.payoutRepo.findOne({ where: { id: payoutId } });
    
    if (!payout) {
      throw new NotFoundException(`Payout ${payoutId} not found`);
    }

    if (!payout.flutterwaveTransferId) {
      throw new BadRequestException('No Flutterwave transfer ID to check');
    }

    try {
      const response = await this.flutterwaveService.getTransferStatus(
        parseInt(payout.flutterwaveTransferId),
      );

      const status = response.data?.status?.toUpperCase();
      payout.providerResponse = response.data;

      if (status === 'SUCCESS' || status === 'SUCCESSFUL') {
        payout.status = PayoutStatus.COMPLETED;
        payout.completedAt = new Date();
      } else if (status === 'FAILED') {
        payout.status = PayoutStatus.FAILED;
        payout.errorMessage = response.data?.complete_message || 'Transfer failed';
      }

      await this.payoutRepo.save(payout);
      return payout;

    } catch (error) {
      this.logger.error(`Failed to sync payout status: ${error.message}`);
      throw error;
    }
  }

  /**
   * List payouts with filters
   */
  async listPayouts(
    page: number = 1,
    limit: number = 20,
    filters?: {
      status?: PayoutStatus;
      exporterId?: string;
      orderId?: string;
    },
  ): Promise<{ data: PayoutRecord[]; total: number; page: number; limit: number }> {
    const query = this.payoutRepo.createQueryBuilder('payout')
      .leftJoinAndSelect('payout.exporter', 'exporter')
      .leftJoinAndSelect('exporter.user', 'user')
      .leftJoinAndSelect('payout.order', 'order');

    if (filters?.status) {
      query.andWhere('payout.status = :status', { status: filters.status });
    }
    if (filters?.exporterId) {
      query.andWhere('payout.exporterId = :exporterId', { exporterId: filters.exporterId });
    }
    if (filters?.orderId) {
      query.andWhere('payout.orderId = :orderId', { orderId: filters.orderId });
    }

    query.orderBy('payout.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await query.getManyAndCount();

    return { data, total, page, limit };
  }

  /**
   * Get payout statistics
   */
  async getPayoutStats(): Promise<{
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    totalAmountPaid: number;
    totalFees: number;
  }> {
    const stats = await this.payoutRepo.createQueryBuilder('payout')
      .select('payout.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(payout.netAmount)', 'totalAmount')
      .addSelect('SUM(payout.platformFee)', 'totalFees')
      .groupBy('payout.status')
      .getRawMany();

    const result = {
      total: 0,
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      totalAmountPaid: 0,
      totalFees: 0,
    };

    for (const row of stats) {
      const count = parseInt(row.count);
      result.total += count;
      
      switch (row.status) {
        case PayoutStatus.PENDING:
          result.pending = count;
          break;
        case PayoutStatus.PROCESSING:
          result.processing = count;
          break;
        case PayoutStatus.COMPLETED:
          result.completed = count;
          result.totalAmountPaid = parseFloat(row.totalAmount) || 0;
          result.totalFees = parseFloat(row.totalFees) || 0;
          break;
        case PayoutStatus.FAILED:
          result.failed = count;
          break;
      }
    }

    return result;
  }
}
