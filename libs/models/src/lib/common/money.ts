/**
 * Shared money model for Refactoring Phase A (step A1).
 *
 * Source of truth: `docs/frontend-contract/DTO_REFERENCE.md` §0
 * (`MoneySplit { unitPriceAmount, currency }`) and `API_CONTRACT.md` §0.3
 * (decimal as JSON number, currency ISO-4217 UPPER `^[A-Z]{3}$`).
 *
 * Canonical structural shape behind the per-feature mirrors (`CartMoney`,
 * `OrderMoney = OrderMoneyResponse`, inline `{ amount, currency }` in
 * checkout/payment models). Features keep their aliases over this shape —
 * nothing is re-declared here that the wire already defines.
 *
 * Backend-authoritative rule: values are assigned only from backend
 * responses — never computed locally. This module performs NO totals
 * math, NO summation, NO float rounding. Pure — throws nothing, no
 * Angular, no HTTP, SSR-safe.
 */

/** Backend-issued money value (amount + ISO-4217 currency). Display only. */
export interface Money {
  readonly amount: number;
  readonly currency: string;
}

/** Backend currency convention (ISO-4217, uppercase, exactly 3 letters). */
export const CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/;

/**
 * Whether `value` is a well-formed ISO-4217 currency code. Structural
 * pre-check only — not a substitute for backend validation. Pure.
 */
export function isValidCurrencyCode(value: unknown): value is string {
  return typeof value === 'string' && CURRENCY_CODE_PATTERN.test(value);
}

/**
 * Whether `value` has the structural money shape (finite numeric amount
 * plus a string currency). Does not validate the code itself — use
 * `isValidCurrencyCode` for that. Pure — throws nothing.
 */
export function isMoney(value: unknown): value is Money {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Partial<Money>;
  return (
    typeof candidate.amount === 'number' &&
    Number.isFinite(candidate.amount) &&
    typeof candidate.currency === 'string'
  );
}

/**
 * Reads the display currency out of a money value verbatim, or `null`
 * when absent/blank. A read — never a computation over amounts. Pure.
 */
export function moneyCurrencyOf(money: Money | null | undefined): string | null {
  const currency = money?.currency;
  return typeof currency === 'string' && currency !== '' ? currency : null;
}

/**
 * Whether two money values share the same currency (both blank counts
 * as sharing — there is nothing to mismatch). Detection only, never
 * conversion. Pure — throws nothing.
 */
export function hasSameCurrency(
  first: Money | null | undefined,
  second: Money | null | undefined,
): boolean {
  return (first?.currency ?? '') === (second?.currency ?? '');
}
