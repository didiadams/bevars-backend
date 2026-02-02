import {
  Controller,
  Get,
  Post,
  Query,
  Body,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FlutterwaveService } from '../services/flutterwave.service';
import { ResponseService } from '../../common/services/response.service';

/**
 * Public payment endpoints - no authentication required
 * These are utility endpoints for bank lookup and verification
 */
@Controller('payment')
export class PublicPaymentController {
  private isTestMode: boolean;

  constructor(
    private flutterwaveService: FlutterwaveService,
    private responseService: ResponseService,
    private configService: ConfigService,
  ) {
    // Check if using Flutterwave test keys
    const secretKey = this.configService.get<string>('FLW_SECRET_KEY') || '';
    this.isTestMode = secretKey.includes('_TEST');
  }

  /**
   * Get Nigerian banks list (for exporter bank setup)
   * Public endpoint - no auth required
   */
  @Get('banks')
  async getBanks(@Query('country') country: string = 'NG') {
    const banks = await this.flutterwaveService.getBanks(country);
    return this.responseService.sendSuccess('Banks retrieved', banks.data);
  }

  /**
   * Verify bank account name
   * Public endpoint - no auth required
   * In test mode, returns mock data since Flutterwave test only allows bank 044
   */
  @Post('verify-account')
  async verifyBankAccount(
    @Body('accountNumber') accountNumber: string,
    @Body('bankCode') bankCode: string,
  ) {
    // In test mode, mock the verification to allow development
    if (this.isTestMode) {
      // Return a mock verified account for testing
      const mockAccountName = `Test Account ${accountNumber.slice(-4)}`;
      return this.responseService.sendSuccess('Account verified (test mode)', {
        account_number: accountNumber,
        account_name: mockAccountName,
        bank_code: bankCode,
      });
    }

    const result = await this.flutterwaveService.verifyBankAccount({
      accountNumber,
      bankCode,
    });

    return this.responseService.sendSuccess('Account verified', result.data);
  }

  /**
   * Get current FX rate
   * Public endpoint - no auth required
   */
  @Get('fx-rate')
  async getFxRate(
    @Query('from') from: string = 'USD',
    @Query('to') to: string = 'NGN',
    @Query('amount') amount: number = 1,
  ) {
    const rate = await this.flutterwaveService.getFxRate(from, to, amount);
    return this.responseService.sendSuccess('FX rate retrieved', rate.data);
  }
}
