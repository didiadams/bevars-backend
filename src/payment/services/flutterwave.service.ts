import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export interface CreateVirtualAccountParams {
  email: string;
  txRef: string;
  amount: number;
  currency?: string;
  firstName: string;
  lastName: string;
  narration?: string;
}

export interface VirtualAccountResponse {
  status: string;
  message: string;
  data: {
    response_code: string;
    response_message: string;
    order_ref: string;
    account_number: string;
    account_status: string;
    frequency: number;
    bank_name: string;
    created_at: string;
    expiry_date: string;
    note: string;
    amount: number;
  };
}

export interface TransferParams {
  bankCode: string;
  accountNumber: string;
  amount: number;
  currency: string;
  narration: string;
  reference: string;
  beneficiaryName: string;
  debitCurrency?: string;
}

export interface TransferResponse {
  status: string;
  message: string;
  data: {
    id: number;
    account_number: string;
    bank_code: string;
    full_name: string;
    created_at: string;
    currency: string;
    debit_currency: string;
    amount: number;
    fee: number;
    status: string;
    reference: string;
    narration: string;
    complete_message: string;
    requires_approval: number;
    is_approved: number;
    bank_name: string;
  };
}

export interface FxRateResponse {
  status: string;
  message: string;
  data: {
    rate: number;
    source: {
      currency: string;
      amount: number;
    };
    destination: {
      currency: string;
      amount: number;
    };
  };
}

export interface VerifyAccountParams {
  accountNumber: string;
  bankCode: string;
}

export interface VerifyAccountResponse {
  status: string;
  message: string;
  data: {
    account_number: string;
    account_name: string;
  };
}

export interface CreatePaymentLinkParams {
  txRef: string;
  amount: number;
  currency: string;
  redirectUrl: string;
  customerEmail: string;
  customerName: string;
  title: string;
  description: string;
  orderId: string;
}

export interface PaymentLinkResponse {
  status: string;
  message: string;
  data: {
    link: string;
  };
}

@Injectable()
export class FlutterwaveService {
  private readonly logger = new Logger(FlutterwaveService.name);
  private readonly client: AxiosInstance;
  private readonly secretKey: string;
  private readonly publicKey: string;
  private readonly baseUrl: string;

  constructor(private configService: ConfigService) {
    this.secretKey = this.configService.get<string>('FLW_SECRET_KEY') || '';
    this.publicKey = this.configService.get<string>('FLW_PUBLIC_KEY') || '';
    this.baseUrl = this.configService.get<string>('FLW_BASE_URL') || 'https://api.flutterwave.com/v3';

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Create a virtual account for buyer to deposit funds
   * This creates a unique bank account number for each order
   */
  async createVirtualAccount(params: CreateVirtualAccountParams): Promise<VirtualAccountResponse> {
    try {
      const payload = {
        email: params.email,
        is_permanent: false,
        tx_ref: params.txRef,
        amount: params.amount,
        currency: params.currency || 'USD',
        firstname: params.firstName,
        lastname: params.lastName,
        narration: params.narration || `Bevars Escrow - ${params.txRef}`,
      };

      this.logger.log(`Creating virtual account for tx_ref: ${params.txRef}`);
      const response = await this.client.post('/virtual-account-numbers', payload);
      
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to create virtual account: ${error.message}`, error.response?.data);
      throw error;
    }
  }

  /**
   * Verify a transaction by its ID
   */
  async verifyTransaction(transactionId: string): Promise<any> {
    try {
      this.logger.log(`Verifying transaction: ${transactionId}`);
      const response = await this.client.get(`/transactions/${transactionId}/verify`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to verify transaction: ${error.message}`, error.response?.data);
      throw error;
    }
  }

  /**
   * Get current FX rate
   */
  async getFxRate(from: string = 'USD', to: string = 'NGN', amount: number = 1): Promise<FxRateResponse> {
    try {
      const response = await this.client.get(`/rates?from=${from}&to=${to}&amount=${amount}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get FX rate: ${error.message}`, error.response?.data);
      throw error;
    }
  }

  /**
   * Initiate a bank transfer (payout to exporter)
   */
  async initiateTransfer(params: TransferParams): Promise<TransferResponse> {
    try {
      const payload = {
        account_bank: params.bankCode,
        account_number: params.accountNumber,
        amount: params.amount,
        narration: params.narration,
        currency: params.currency,
        reference: params.reference,
        beneficiary_name: params.beneficiaryName,
        debit_currency: params.debitCurrency || 'NGN',
      };

      this.logger.log(`Initiating transfer: ${params.reference} - ${params.amount} ${params.currency}`);
      const response = await this.client.post('/transfers', payload);
      
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to initiate transfer: ${error.message}`, error.response?.data);
      throw error;
    }
  }

  /**
   * Get transfer status
   */
  async getTransferStatus(transferId: number): Promise<any> {
    try {
      const response = await this.client.get(`/transfers/${transferId}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get transfer status: ${error.message}`, error.response?.data);
      throw error;
    }
  }

  /**
   * Verify bank account (get account name)
   */
  async verifyBankAccount(params: VerifyAccountParams): Promise<VerifyAccountResponse> {
    try {
      const payload = {
        account_number: params.accountNumber,
        account_bank: params.bankCode,
      };

      this.logger.log(`Verifying bank account: ${params.accountNumber}`);
      const response = await this.client.post('/accounts/resolve', payload);
      
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to verify bank account: ${error.message}`, error.response?.data);
      throw error;
    }
  }

  /**
   * Get list of Nigerian banks
   */
  async getBanks(country: string = 'NG'): Promise<any> {
    try {
      const response = await this.client.get(`/banks/${country}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get banks: ${error.message}`, error.response?.data);
      throw error;
    }
  }

  /**
   * Create a hosted payment link for card payments
   * This creates a checkout page URL where buyers can pay with card
   */
  async createPaymentLink(params: CreatePaymentLinkParams): Promise<PaymentLinkResponse> {
    try {
      const payload = {
        tx_ref: params.txRef,
        amount: params.amount,
        currency: params.currency,
        redirect_url: params.redirectUrl,
        customer: {
          email: params.customerEmail,
          name: params.customerName,
        },
        customizations: {
          title: params.title,
          description: params.description,
          logo: 'https://bevars.com/logo.png',
        },
        meta: {
          orderId: params.orderId,
        },
      };

      this.logger.log(`Creating payment link for tx_ref: ${params.txRef}`);
      const response = await this.client.post('/payments', payload);
      
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to create payment link: ${error.message}`, error.response?.data);
      throw error;
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(signature: string, payload: string): boolean {
    const webhookSecret = this.configService.get<string>('FLW_WEBHOOK_SECRET') || '';
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(payload)
      .digest('hex');
    
    return signature === expectedSignature;
  }
}
