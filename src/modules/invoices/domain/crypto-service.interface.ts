export const CRYPTO_SERVICE = Symbol('CRYPTO_SERVICE');

/**
 * Şifreleme/Çözme servis arayüzü.
 * Application katmanı bu arayüzü kullanır; Infrastructure CryptoService bunu uygular.
 * Clean Architecture: Domain/Application katmanları framework bağımsız kalır.
 */
export interface ICryptoService {
  encrypt(plainText?: string | null): string | null;
  decrypt(cipherText?: string | null): string | null;
}
