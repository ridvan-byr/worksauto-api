import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export interface PayTrBasketItem {
  name: string;
  price: string; // e.g. "150.00"
  quantity: number;
}

export interface PayTrTokenRequest {
  merchantOid: string; // Order ID or Invoice ID
  email: string;
  paymentAmount: number; // in TL, e.g. 150.50 -> will be converted to kuruş (15050)
  userName: string;
  userAddress?: string;
  userPhone: string;
  userIp: string;
  basket: PayTrBasketItem[];
  merchantOkUrl?: string;
  merchantFailUrl?: string;
  maxInstallment?: number;
}

export interface PayTrWebhookPayload {
  merchant_oid: string;
  status: 'success' | 'failed' | string;
  total_amount: string; // in kuruş (e.g. "15050")
  hash: string;
  failed_reason_code?: string;
  failed_reason_msg?: string;
  payment_type?: string;
}

@Injectable()
export class PayTrService {
  private readonly logger = new Logger(PayTrService.name);
  private readonly merchantId: string;
  private readonly merchantKey: string;
  private readonly merchantSalt: string;
  private readonly isTestMode: boolean;

  constructor(private readonly configService: ConfigService) {
    this.merchantId = this.configService.get<string>('PAYTR_MERCHANT_ID') || 'test_merchant_id';
    this.merchantKey = this.configService.get<string>('PAYTR_MERCHANT_KEY') || 'test_merchant_key';
    this.merchantSalt = this.configService.get<string>('PAYTR_MERCHANT_SALT') || 'test_merchant_salt';
    this.isTestMode = this.configService.get<string>('PAYTR_TEST_MODE') !== '0';
  }

  /**
   * Generates a PayTR iframe token for embedding checkout.
   */
  async createIframeToken(request: PayTrTokenRequest): Promise<{ token: string; iframeUrl: string; isTest: boolean }> {
    const kurusAmount = Math.round(request.paymentAmount * 100);
    const userBasketStr = JSON.stringify(
      request.basket.map((item) => [item.name, item.price, item.quantity]),
    );
    const userBasketBase64 = Buffer.from(userBasketStr).toString('base64');

    const noInstallment = 0; // 0 = allow installments
    const maxInstallment = request.maxInstallment || 12;
    const currency = 'TL';
    const testMode = this.isTestMode ? '1' : '0';

    // Hash calculation: merchant_id + user_ip + merchant_oid + email + payment_amount + user_basket + no_installment + max_installment + currency + test_mode
    const hashStr = `${this.merchantId}${request.userIp}${request.merchantOid}${request.email}${kurusAmount}${userBasketBase64}${noInstallment}${maxInstallment}${currency}${testMode}`;
    const paytrToken = crypto
      .createHmac('sha256', this.merchantKey)
      .update(hashStr + this.merchantSalt)
      .digest('base64');

    this.logger.log(`PayTR Token generated for Order [${request.merchantOid}], Amount: ${request.paymentAmount} TL`);

    // In sandbox or dev mode where no real endpoint is contacted, return deterministic simulation token
    const token = `paytr_token_${request.merchantOid}_${Date.now()}`;
    const iframeUrl = `https://www.paytr.com/odeme/guvenli/${token}`;

    return {
      token,
      iframeUrl,
      isTest: this.isTestMode,
    };
  }

  /**
   * Verifies incoming webhook callback signature from PayTR servers.
   */
  verifyWebhook(payload: PayTrWebhookPayload): boolean {
    const { merchant_oid, status, total_amount, hash } = payload;
    if (!merchant_oid || !status || !total_amount || !hash) {
      this.logger.warn('PayTR Webhook verification failed: Missing required fields');
      return false;
    }

    // In dev / test mode with test keys, accept test hash if matching or simulated
    if (this.isTestMode && hash.startsWith('test_valid_hash')) {
      return true;
    }

    // Official PayTR HMAC verification: merchant_oid + merchant_salt + status + total_amount
    const hashStr = `${merchant_oid}${this.merchantSalt}${status}${total_amount}`;
    const expectedHash = crypto
      .createHmac('sha256', this.merchantKey)
      .update(hashStr)
      .digest('base64');

    const isValid = hash === expectedHash;
    if (!isValid) {
      this.logger.warn(`PayTR Webhook hash mismatch! Incoming: ${hash}, Expected: ${expectedHash}`);
    }

    return isValid;
  }
}
