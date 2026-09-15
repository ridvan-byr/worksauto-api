export function calculateInvoiceTotals(
  items: Array<{ quantity: number; unitPrice: number; kdvRate?: number }>,
) {
  let subtotalCents = 0;
  let taxCents = 0;
  for (const item of items) {
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unitPrice);
    const rate = Number(item.kdvRate ?? 20);
    if (
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      !Number.isFinite(unitPrice) ||
      unitPrice < 0 ||
      !Number.isFinite(rate) ||
      rate < 0 ||
      rate > 100
    ) {
      throw new Error('Invalid invoice line quantity, price or tax rate.');
    }
    const lineCents = Math.round(unitPrice * 100) * quantity;
    subtotalCents += lineCents;
    taxCents += Math.round((lineCents * rate) / 100);
  }
  return {
    subtotal: subtotalCents / 100,
    kdvAmount: taxCents / 100,
    grandTotal: (subtotalCents + taxCents) / 100,
  };
}
