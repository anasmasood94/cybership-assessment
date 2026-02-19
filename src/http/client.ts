import axios, {
  AxiosError,
  AxiosInstance,
  type AxiosRequestConfig,
} from "axios";
import { CarrierError, CarrierErrorCode } from "../domain/errors.js";

export interface HttpClientConfig {
  baseURL?: string;
  timeoutMs: number;
}

export interface HttpResponse<T = unknown> {
  status: number;
  data: T;
  headers: Record<string, string>;
}

/**
 * Thin wrapper around axios that translates low-level HTTP failures into
 * structured `CarrierError` instances. Carrier-specific clients compose
 * this rather than using axios directly.
 */
export class HttpClient {
  private client: AxiosInstance;

  constructor(config: HttpClientConfig) {
    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeoutMs,
    });
  }

  async post<T>(
    url: string,
    data: unknown,
    config?: AxiosRequestConfig,
  ): Promise<HttpResponse<T>> {
    try {
      const response = await this.client.post<T>(url, data, config);
      return {
        status: response.status,
        data: response.data,
        headers: response.headers as Record<string, string>,
      };
    } catch (error) {
      throw this.translateError(error);
    }
  }

  private translateError(error: unknown): CarrierError {
    if (error instanceof CarrierError) return error;

    if (error instanceof AxiosError) {
      if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
        return new CarrierError(
          CarrierErrorCode.TIMEOUT_ERROR,
          `Request timed out: ${error.message}`,
          { retryable: true },
        );
      }

      if (!error.response) {
        return new CarrierError(
          CarrierErrorCode.NETWORK_ERROR,
          `Network error: ${error.message}`,
          { retryable: true },
        );
      }

      const status = error.response.status;
      const body = error.response.data as Record<string, unknown> | undefined;

      if (status === 401) {
        return new CarrierError(
          CarrierErrorCode.AUTHENTICATION_ERROR,
          "Authentication failed",
          { httpStatus: status, retryable: true },
        );
      }
      if (status === 403) {
        return new CarrierError(
          CarrierErrorCode.AUTHORIZATION_ERROR,
          "Authorization denied",
          { httpStatus: status, retryable: false },
        );
      }
      if (status === 429) {
        return new CarrierError(
          CarrierErrorCode.RATE_LIMIT_ERROR,
          "Rate limit exceeded",
          { httpStatus: status, retryable: true },
        );
      }

      const upstreamErrors = extractUpstreamErrors(body);

      return new CarrierError(
        CarrierErrorCode.CARRIER_API_ERROR,
        upstreamErrors?.message || `Carrier API returned HTTP ${status}`,
        {
          httpStatus: status,
          upstreamCode: upstreamErrors?.code,
          upstreamMessage: upstreamErrors?.message,
          retryable: status >= 500,
        },
      );
    }

    return new CarrierError(
      CarrierErrorCode.UNKNOWN_ERROR,
      error instanceof Error ? error.message : "An unknown error occurred",
      { retryable: false },
    );
  }
}

function extractUpstreamErrors(
  body: Record<string, unknown> | undefined,
): { code: string; message: string } | undefined {
  if (!body) return undefined;

  // UPS error format: { response: { errors: [{ code, message }] } }
  const response = body["response"] as
    | Record<string, unknown>
    | undefined;
  if (response) {
    const errors = response["errors"] as
      | Array<{ code?: string; message?: string }>
      | undefined;
    if (errors?.[0]) {
      return {
        code: errors[0].code || "UNKNOWN",
        message: errors[0].message || "Unknown carrier error",
      };
    }
  }

  return undefined;
}
