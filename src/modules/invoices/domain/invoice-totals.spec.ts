import { describe, it, expect } from 'vitest';
import { calculateInvoiceTotals } from './invoice-totals';

describe('Invoice cent arithmetic', () => {
  it('rounds each tax line and aggregates without floating point drift', () => {
    expect(
      calculateInvoiceTotals([
        { quantity: 3, unitPrice: 0.1, kdvRate: 20 },
        { quantity: 1, unitPrice: 0.03, kdvRate: 20 },
      ]),
    ).toEqual({ subtotal: 0.33, kdvAmount: 0.07, grandTotal: 0.4 });
  });
  it.each([NaN, Infinity, -1])('rejects invalid unit price %s', (price) => {
    expect(() =>
      calculateInvoiceTotals([{ quantity: 1, unitPrice: price }]),
    ).toThrow();
  });
});
