import { describe, expect, it } from 'vitest';
import {
  CULTURE_CONTEXT,
  CORRELATION_ID_CONTEXT,
  IDEMPOTENCY_KEY_CONTEXT,
  toHttpContext,
} from './request-context';

describe('toHttpContext', () => {
  it('sets only the slots provided by the context', () => {
    const httpContext = toHttpContext({ correlationId: 'flow-1', culture: 'fr' });

    expect(httpContext.get(CORRELATION_ID_CONTEXT)).toBe('flow-1');
    expect(httpContext.get(CULTURE_CONTEXT)).toBe('fr');
    expect(httpContext.get(IDEMPOTENCY_KEY_CONTEXT)).toBeUndefined();
  });

  it('carries the checkout idempotency key when set', () => {
    const httpContext = toHttpContext({ idempotencyKey: 'checkout-attempt-1' });

    expect(httpContext.get(IDEMPOTENCY_KEY_CONTEXT)).toBe('checkout-attempt-1');
    expect(httpContext.get(CORRELATION_ID_CONTEXT)).toBeUndefined();
  });

  it('leaves every slot at its default for an empty context', () => {
    const httpContext = toHttpContext({});

    expect(httpContext.get(CORRELATION_ID_CONTEXT)).toBeUndefined();
    expect(httpContext.get(CULTURE_CONTEXT)).toBeUndefined();
    expect(httpContext.get(IDEMPOTENCY_KEY_CONTEXT)).toBeUndefined();
  });
});
