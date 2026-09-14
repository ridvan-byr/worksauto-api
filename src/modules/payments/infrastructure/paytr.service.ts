import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
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
    this.merchantId = this.configService.get<string>('PAYTR_MERCHANT_ID') || '';
    this.merchantKey =
      this.configService.get<string>('PAYTR_MERCHANT_KEY') || '';
    this.merchantSalt =
      this.configService.get<string>('PAYTR_MERCHANT_SALT') || '';
    this.isTestMode = this.configService.get<string>('PAYTR_TEST_MODE') !== '0';
  }

  /**
   * Generates a PayTR iframe token for embedding checkout.
   */
  async createIframeToken(
    request: PayTrTokenRequest,
  ): Promise<{ token: string; iframeUrl: string; isTest: boolean }> {
    if (!this.merchantId || !this.merchantKey || !this.merchantSalt)
      throw new ServiceUnavailableException('PayTR is not configured.');
    if (
      !request.userAddress ||
      !request.merchantOkUrl ||
      !request.merchantFailUrl
    )
      throw new ServiceUnavailableException(
        'Payment address and return URLs are required.',
      );
    const kurusAmount = Math.round(request.paymentAmount * 100);
    const userBasketStr = JSON.stringify(
      request.basket.map((item) => [item.name, item.price, item.quantity]),
    );
    const userBasketBase64 = Buffer.from(userBasketStr).toString('base64');

    const noInstallment = 1; // 0 = allow installments
    const maxInstallment = 0; // Installments disabled; callback must match the attempted amount.
    const currency = 'TL';
    const testMode = this.isTestMode ? '1' : '0';

    // Hash calculation: merchant_id + user_ip + merchant_oid + email + payment_amount + user_basket + no_installment + max_installment + currency + test_mode
    const hashStr = `${this.merchantId}${request.userIp}${request.merchantOid}${request.email}${kurusAmount}${userBasketBase64}${noInstallment}${maxInstallment}${currency}${testMode}`;
    const paytrToken = crypto
      .createHmac('sha256', this.merchantKey)
      .update(hashStr + this.merchantSalt)
      .digest('base64');

    this.logger.log(
      `PayTR Token generated for Order [${request.merchantOid}], Amount: ${request.paymentAmount} TL`,
    );

    const response = await fetch('https://www.paytr.com/odeme/api/get-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: AbortSignal.timeout(15000),
      body: new URLSearchParams({
        merchant_id: this.merchantId,
        user_ip: request.userIp,
        merchant_oid: request.merchantOid,
        email: request.email,
        payment_amount: String(kurusAmount),
        paytr_token: paytrToken,
        user_basket: userBasketBase64,
        no_installment: String(noInstallment),
        max_installment: String(maxInstallment),
        currency,
        test_mode: testMode,
        user_name: request.userName,
        user_address: request.userAddress,
        user_phone: request.userPhone,
        merchant_ok_url: request.merchantOkUrl,
        merchant_fail_url: request.merchantFailUrl,
        timeout_limit: '30',
        debug_on: '0',
      }),
    });
    const result = await response.json();
    if (
      !response.ok ||
      result.status !== 'success' ||
      typeof result.token !== 'string'
    ) {
      throw new ServiceUnavailableException(
        'PayTR could not create a payment session.',
      );
    }
    const token = result.token;
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
      this.logger.warn(
        'PayTR Webhook verification failed: Missing required fields',
      );
      return false;
    }

    if (
      !this.merchantKey ||
      !this.merchantSalt ||
      !['success', 'failed'].includes(status) ||
      !/^\d+$/.test(total_amount)
    )
      return false;

    // Official PayTR HMAC verification: merchant_oid + merchant_salt + status + total_amount
    const hashStr = `${merchant_oid}${this.merchantSalt}${status}${total_amount}`;
    const expectedHash = crypto
      .createHmac('sha256', this.merchantKey)
      .update(hashStr)
      .digest('base64');

    const received = Buffer.from(hash);
    const expected = Buffer.from(expectedHash);
    const isValid =
      received.length === expected.length &&
      crypto.timingSafeEqual(received, expected);
    if (!isValid) {
      this.logger.warn('PayTR webhook signature mismatch.');
    }

    return isValid;
  }
}
