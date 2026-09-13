import { describe, it, expect } from 'vitest';
import { CryptoService } from './crypto.service';

describe('CryptoService', () => {
  const service = new CryptoService();

  it('should encrypt and decrypt a string successfully', () => {
    const raw = 'my-super-secret-api-key-12345';
    const encrypted = service.encrypt(raw);
    expect(encrypted).toBeDefined();
    expect(encrypted).not.toEqual(raw);

    const decrypted = service.decrypt(encrypted);
    expect(decrypted).toEqual(raw);
  });

  it('should handle null or empty values gracefully', () => {
    expect(service.encrypt(null)).toBeNull();
    expect(service.encrypt('')).toBeNull();
    expect(service.decrypt(null)).toBeNull();
    expect(service.decrypt('')).toBeNull();
  });
});
