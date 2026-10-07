/**
 * Runtime wholesale price only — does not write to the database.
 * If wholesale is missing/zero:
 *   - use retail − retail_discount (discounted retail)
 *   - if retail_discount is 0, that equals the original retail price
 */
export function effectiveWholesalePrice(product: {
  wholesale_price?: number | null;
  retail_price?: number | null;
  retail_discount?: number | null;
}): number {
  const wholesale = Number(product.wholesale_price) || 0;
  if (wholesale > 0) return wholesale;

  const retail = Number(product.retail_price) || 0;
  const discount = Math.max(0, Number(product.retail_discount) || 0);
  return Math.round(Math.max(0, retail - discount) * 100) / 100;
}
