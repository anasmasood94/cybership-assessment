import type { UpsConfig } from "../../config/index.js";
import type { RateRequest, RateResponse } from "../../domain/models.js";
import { RateRequestSchema } from "../../validation/schemas.js";
import { CarrierError, CarrierErrorCode } from "../../domain/errors.js";
import type { CarrierClient } from "../types.js";
import { UpsAuthenticator } from "./auth.js";
import { UpsRatingOperation } from "./rating.js";
import type { ZodError } from "zod";

function formatZodError(error: ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
}

/**
 * UPS carrier client — the public entry point for all UPS operations.
 *
 * Currently supports rating; additional operations (label purchase,
 * tracking, address validation) can be added as new operation classes
 * without modifying this client's constructor or getRates logic.
 */
export class UpsCarrierClient implements CarrierClient {
  readonly name = "UPS" as const;
  private ratingOperation: UpsRatingOperation;

  constructor(config: UpsConfig) {
    const auth = new UpsAuthenticator(config);
    this.ratingOperation = new UpsRatingOperation(config, auth);
  }

  async getRates(request: RateRequest): Promise<RateResponse> {
    const validation = RateRequestSchema.safeParse(request);
    if (!validation.success) {
      throw new CarrierError(
        CarrierErrorCode.VALIDATION_ERROR,
        `Invalid rate request: ${formatZodError(validation.error)}`,
        { carrier: "UPS", retryable: false },
      );
    }

    return this.ratingOperation.execute(request);
  }
}
