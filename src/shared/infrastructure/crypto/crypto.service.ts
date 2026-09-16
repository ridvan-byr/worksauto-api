import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class CryptoService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor() {
    const secret =
      process.env.ENCRYPTION_KEY || 'worksauto-e-invoice-secret-key-32b';
    this.key = crypto.createHash('sha256').update(String(secret)).digest();
  }

  encrypt(plainText?: string | null): string | null {
    if (!plainText) return null;
    try {
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
      let encrypted = cipher.update(plainText, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag().toString('hex');
      return `${iv.toString('hex')}:${authTag}:${encrypted}`;
    } catch {
      return null;
    }
  }

  decrypt(cipherText?: string | null): string | null {
    if (!cipherText) return null;
    try {
      const parts = cipherText.split(':');
      if (parts.length !== 3) {
        return cipherText; // Fallback if not encrypted in old format
      }
      const [ivHex, authTagHex, encrypted] = parts;
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch {
      return null;
    }
  }
}
