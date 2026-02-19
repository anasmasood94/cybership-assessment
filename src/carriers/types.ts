/**
 * Carrier abstraction layer.
 *
 * Every carrier implements `CarrierClient` and registers operations under
 * well-known names (e.g. "rating"). Adding a new carrier means implementing
 * this interface — existing carrier code is never touched.
 */

import type {
  CarrierName,
  RateRequest,
  RateResponse,
} from "../domain/models.js";

/**
 * A single operation a carrier supports (e.g. rating, label purchase, tracking).
 * Each operation type has its own request/response generics.
 */
export interface CarrierOperation<TReq, TRes> {
  execute(request: TReq): Promise<TRes>;
}

/**
 * Authenticator contract — each carrier has its own auth mechanism.
 */
export interface CarrierAuthenticator {
  getAccessToken(): Promise<string>;
  /** Force-clear any cached token so the next call re-authenticates. */
  invalidateToken(): void;
}

/**
 * The main carrier client interface. Every carrier exposes a `getRates` method
 * and can optionally expose additional operations.
 */
export interface CarrierClient {
  readonly name: CarrierName;
  getRates(request: RateRequest): Promise<RateResponse>;
}

/**
 * Registry that holds all configured carriers, keyed by name.
 */
export class CarrierRegistry {
  private carriers = new Map<CarrierName, CarrierClient>();

  register(carrier: CarrierClient): void {
    this.carriers.set(carrier.name, carrier);
  }

  get(name: CarrierName): CarrierClient | undefined {
    return this.carriers.get(name);
  }

  getAll(): CarrierClient[] {
    return Array.from(this.carriers.values());
  }

  has(name: CarrierName): boolean {
    return this.carriers.has(name);
  }
}
