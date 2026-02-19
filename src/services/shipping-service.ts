import type { CarrierName, RateRequest, RateQuote } from "../domain/models.js";
import { CarrierError, CarrierErrorCode } from "../domain/errors.js";
import type { CarrierRegistry } from "../carriers/types.js";

export interface ShippingRateResult {
  quotes: RateQuote[];
  errors: Array<{
    carrier: string;
    error: CarrierError;
  }>;
}

/**
 * High-level service that orchestrates rate requests across one or more
 * carriers. Callers interact with this facade rather than individual
 * carrier clients.
 */
export class ShippingService {
  constructor(private registry: CarrierRegistry) {}

  /**
   * Get rates from a specific carrier.
   */
  async getRates(
    carrier: CarrierName,
    request: RateRequest,
  ): Promise<RateQuote[]> {
    const client = this.registry.get(carrier);
    if (!client) {
      throw new CarrierError(
        CarrierErrorCode.CONFIGURATION_ERROR,
        `Carrier "${carrier}" is not registered`,
        { carrier, retryable: false },
      );
    }

    const response = await client.getRates(request);
    return response.quotes;
  }

  /**
   * Shop rates across all registered carriers. Collects results from each
   * carrier independently — one carrier's failure does not block others.
   */
  async shopRates(request: RateRequest): Promise<ShippingRateResult> {
    const carriers = this.registry.getAll();
    if (carriers.length === 0) {
      throw new CarrierError(
        CarrierErrorCode.CONFIGURATION_ERROR,
        "No carriers registered",
        { retryable: false },
      );
    }

    const results = await Promise.allSettled(
      carriers.map(async (client) => ({
        carrier: client.name,
        response: await client.getRates(request),
      })),
    );

    const quotes: RateQuote[] = [];
    const errors: ShippingRateResult["errors"] = [];

    for (const result of results) {
      if (result.status === "fulfilled") {
        quotes.push(...result.value.response.quotes);
      } else {
        const error =
          result.reason instanceof CarrierError
            ? result.reason
            : new CarrierError(
                CarrierErrorCode.UNKNOWN_ERROR,
                result.reason?.message ?? "Unknown error",
              );
        errors.push({
          carrier: error.details.carrier ?? "UNKNOWN",
          error,
        });
      }
    }

    // Sort by total charges ascending for easy comparison
    quotes.sort((a, b) => a.totalCharges.amount - b.totalCharges.amount);

    return { quotes, errors };
  }
}
