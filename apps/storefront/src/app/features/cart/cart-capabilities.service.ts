/**
 * Cart capabilities implementation for Refactoring Phase C — Cart
 * Isolation.
 *
 * Sole `CartCapabilities` implementation, owned by the cart feature.
 * Delegates read-only cart access and session lifecycle triggers to
 * the real cart services — owns no slot, no identity, and no
 * transport itself. Route-provided through `provideCartCapabilities()`
 * (never at root): consuming routes install the full cart trio plus
 * this facade in one call, and their pages inject `CART_CAPABILITIES`
 * only.
 */

import { Injectable, inject, type Provider } from '@angular/core';
import type { Subscription } from 'rxjs';
import { CART_CAPABILITIES, type CartCapabilities } from './cart-capabilities';
import { AuthenticatedCartService } from './state/authenticated-cart.service';
import { CartState } from './state/cart-state';
import { GuestCartService } from './state/guest-cart.service';

export { CART_CAPABILITIES, type CartCapabilities };

@Injectable()
export class CartCapabilitiesService implements CartCapabilities {
  private readonly carts = inject(CartState);
  private readonly guests = inject(GuestCartService);
  private readonly authCarts = inject(AuthenticatedCartService);

  readonly cart = this.carts.cart;
  readonly data = this.carts.data;
  readonly error = this.carts.error;

  loadCart(): Subscription {
    return this.carts.loadCart();
  }

  readonly guestIdentity = this.guests.identity;

  initializeGuest(): Subscription {
    return this.guests.initialize();
  }

  synchronize(): Subscription {
    return this.authCarts.synchronize();
  }

  establishAuthenticated(): Subscription {
    return this.authCarts.establishAuthenticated();
  }
}

/**
 * Installs the route-scoped cart capability stack: the real cart
 * trio (state + lifecycles, same instances the cart page uses) plus
 * the `CART_CAPABILITIES` facade over them. Consuming routes spread
 * this into their parent `providers` — pages inject the token only.
 */
export function provideCartCapabilities(): Provider[] {
  return [
    CartState,
    GuestCartService,
    AuthenticatedCartService,
    CartCapabilitiesService,
    { provide: CART_CAPABILITIES, useExisting: CartCapabilitiesService },
  ];
}
