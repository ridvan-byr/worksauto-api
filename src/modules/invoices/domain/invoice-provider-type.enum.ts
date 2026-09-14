/**
 * E-Fatura sağlayıcı tipleri (Domain-level enum).
 * Prisma InvoiceProviderType'ın domain yansımasıdır.
 * Domain katmanı @prisma/client'a bağımlı olmamalıdır (Clean Architecture).
 */
export enum InvoiceProviderType {
  INTERNAL = 'INTERNAL',
  PARASUT = 'PARASUT',
  NILVERA = 'NILVERA',
  BIZIMHESAP = 'BIZIMHESAP',
  KOLAYBI = 'KOLAYBI',
  QNB_EFINANS = 'QNB_EFINANS',
}
