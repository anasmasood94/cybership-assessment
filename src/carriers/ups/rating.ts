import type { UpsConfig } from "../../config/index.js";
import { CarrierError, CarrierErrorCode } from "../../domain/errors.js";
import type { RateRequest, RateResponse } from "../../domain/models.js";
import { HttpClient } from "../../http/client.js";
import type { CarrierAuthenticator, CarrierOperation } from "../types.js";
import {
  buildUpsRateRequest,
  mapUpsRatedShipmentToQuote,
} from "./mapper.js";
import type { UpsRateResponseWrapper } from "./types.js";

const API_VERSION = "v2409";

/**
 * UPS Rating operation.
 *
 * Handles building the UPS-specific request, calling the API, and mapping
 * the response back to domain types. Auth is injected so the operation
 * never manages credentials directly.
 */
export class UpsRatingOperation
  implements CarrierOperation<RateRequest, RateResponse>
{
  private httpClient: HttpClient;

  constructor(
    config: UpsConfig,
    private auth: CarrierAuthenticator,
  ) {
    this.httpClient = new HttpClient({
      baseURL: config.baseUrl,
      timeoutMs: 10_000,
    });
  }

  async execute(request: RateRequest): Promise<RateResponse> {
    const requestOption = request.serviceCode ? "Rate" : "Shop";
    const upsRequest = buildUpsRateRequest(request);
    const url = `/rating/${API_VERSION}/${requestOption}`;

    let token: string;
    try {
      token = await this.auth.getAccessToken();
    } catch (error) {
      if (error instanceof CarrierError) throw error;
      throw new CarrierError(
        CarrierErrorCode.AUTHENTICATION_ERROR,
        "Failed to obtain UPS access token",
        { carrier: "UPS", retryable: true },
      );
    }

    let response;
    try {
      response = await this.httpClient.post<UpsRateResponseWrapper>(
        url,
        upsRequest,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            transId: crypto.randomUUID(),
            transactionSrc: "carrier-integration-service",
          },
        },
      );
    } catch (error) {
      if (error instanceof CarrierError) {
        // On auth failure, invalidate token and re-throw
        if (error.code === CarrierErrorCode.AUTHENTICATION_ERROR) {
          this.auth.invalidateToken();
        }
        error.details.carrier = "UPS";
        throw error;
      }
      throw new CarrierError(
        CarrierErrorCode.UNKNOWN_ERROR,
        `UPS rating request failed: ${error instanceof Error ? error.message : "unknown"}`,
        { carrier: "UPS", retryable: false },
      );
    }

    return this.parseResponse(response.data);
  }

  private parseResponse(data: UpsRateResponseWrapper): RateResponse {
    try {
      const rateResponse = data?.RateResponse;
      if (!rateResponse) {
        throw new CarrierError(
          CarrierErrorCode.PARSE_ERROR,
          "UPS response missing RateResponse envelope",
          { carrier: "UPS" },
        );
      }

      const ratedShipments = rateResponse.RatedShipment;
      if (!ratedShipments || !Array.isArray(ratedShipments)) {
        throw new CarrierError(
          CarrierErrorCode.PARSE_ERROR,
          "UPS response missing or invalid RatedShipment array",
          { carrier: "UPS" },
        );
      }

      const quotes = ratedShipments.map(mapUpsRatedShipmentToQuote);

      return { quotes };
    } catch (error) {
      if (error instanceof CarrierError) throw error;
      throw new CarrierError(
        CarrierErrorCode.PARSE_ERROR,
        `Failed to parse UPS rate response: ${error instanceof Error ? error.message : "unknown"}`,
        { carrier: "UPS" },
      );
    }
  }
}
