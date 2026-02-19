/**
 * Structured error hierarchy for the carrier integration service.
 *
 * Every error carries a machine-readable `code` and optional `details` so
 * callers can handle failures programmatically without parsing messages.
 */

export enum CarrierErrorCode {
  VALIDATION_ERROR = "VALIDATION_ERROR",
  AUTHENTICATION_ERROR = "AUTHENTICATION_ERROR",
  AUTHORIZATION_ERROR = "AUTHORIZATION_ERROR",
  RATE_LIMIT_ERROR = "RATE_LIMIT_ERROR",
  CARRIER_API_ERROR = "CARRIER_API_ERROR",
  NETWORK_ERROR = "NETWORK_ERROR",
  TIMEOUT_ERROR = "TIMEOUT_ERROR",
  PARSE_ERROR = "PARSE_ERROR",
  CONFIGURATION_ERROR = "CONFIGURATION_ERROR",
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

export interface CarrierErrorDetails {
  carrier?: string;
  httpStatus?: number;
  upstreamCode?: string;
  upstreamMessage?: string;
  retryable: boolean;
}

export class CarrierError extends Error {
  public readonly code: CarrierErrorCode;
  public readonly details: CarrierErrorDetails;

  constructor(
    code: CarrierErrorCode,
    message: string,
    details: Partial<CarrierErrorDetails> = {},
  ) {
    super(message);
    this.name = "CarrierError";
    this.code = code;
    this.details = { retryable: false, ...details };

    // Maintains proper stack trace in V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CarrierError);
    }
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

export function isCarrierError(error: unknown): error is CarrierError {
  return error instanceof CarrierError;
}
