import { describe, it, expect, beforeEach, afterEach } from "vitest";
import nock from "nock";
import { ShippingService } from "../../src/services/shipping-service.js";
import { CarrierRegistry } from "../../src/carriers/types.js";
import { UpsCarrierClient } from "../../src/carriers/ups/client.js";
import { CarrierErrorCode, CarrierError } from "../../src/domain/errors.js";
import type { UpsConfig } from "../../src/config/index.js";
import type {
  CarrierClient,
  CarrierAuthenticator,
} from "../../src/carriers/types.js";
import type { RateRequest, RateResponse } from "../../src/domain/models.js";
import {
  VALID_OAUTH_TOKEN_RESPONSE,
  VALID_SHOP_RESPONSE,
} from "../fixtures/ups-responses.js";
import { VALID_DOMESTIC_RATE_REQUEST } from "../fixtures/rate-requests.js";

const TEST_CONFIG: UpsConfig = {
  clientId: "test-client-id",
  clientSecret: "test-client-secret",
  baseUrl: "https://onlinetools.ups.com/api",
  oauthUrl: "https://onlinetools.ups.com/security/v1/oauth/token",
};

describe("ShippingService", () => {
  let registry: CarrierRegistry;
  let service: ShippingService;

  beforeEach(() => {
    registry = new CarrierRegistry();
    service = new ShippingService(registry);
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });

  describe("getRates (single carrier)", () => {
    it("should get rates from UPS", async () => {
      nock("https://onlinetools.ups.com")
        .post("/security/v1/oauth/token")
        .reply(200, VALID_OAUTH_TOKEN_RESPONSE);

      nock("https://onlinetools.ups.com")
        .post("/api/rating/v2409/Shop")
        .reply(200, VALID_SHOP_RESPONSE);

      registry.register(new UpsCarrierClient(TEST_CONFIG));
      service = new ShippingService(registry);

      const quotes = await service.getRates(
        "UPS",
        VALID_DOMESTIC_RATE_REQUEST,
      );

      expect(quotes).toHaveLength(4);
      expect(quotes.every((q) => q.carrier === "UPS")).toBe(true);
    });

    it("should throw if carrier is not registered", async () => {
      try {
        await service.getRates("FEDEX", VALID_DOMESTIC_RATE_REQUEST);
        expect.fail("Should have thrown");
      } catch (error: unknown) {
        const err = error as { code: string; message: string };
        expect(err.code).toBe(CarrierErrorCode.CONFIGURATION_ERROR);
        expect(err.message).toContain("FEDEX");
      }
    });
  });

  describe("shopRates (multi-carrier)", () => {
    it("should aggregate results from multiple carriers", async () => {
      // Mock a second carrier
      const mockFedexClient: CarrierClient = {
        name: "FEDEX",
        getRates: async (): Promise<RateResponse> => ({
          quotes: [
            {
              carrier: "FEDEX",
              serviceCode: "GROUND",
              serviceName: "FedEx Ground",
              totalCharges: { currency: "USD", amount: 10.5 },
              transportationCharges: { currency: "USD", amount: 10.5 },
            },
          ],
        }),
      };

      nock("https://onlinetools.ups.com")
        .post("/security/v1/oauth/token")
        .reply(200, VALID_OAUTH_TOKEN_RESPONSE);

      nock("https://onlinetools.ups.com")
        .post("/api/rating/v2409/Shop")
        .reply(200, VALID_SHOP_RESPONSE);

      registry.register(new UpsCarrierClient(TEST_CONFIG));
      registry.register(mockFedexClient);
      service = new ShippingService(registry);

      const result = await service.shopRates(VALID_DOMESTIC_RATE_REQUEST);

      expect(result.quotes.length).toBe(5);
      expect(result.errors).toHaveLength(0);

      const carriers = new Set(result.quotes.map((q) => q.carrier));
      expect(carriers.has("UPS")).toBe(true);
      expect(carriers.has("FEDEX")).toBe(true);
    });

    it("should sort quotes by total charges ascending", async () => {
      const mockCarrier: CarrierClient = {
        name: "FEDEX",
        getRates: async (): Promise<RateResponse> => ({
          quotes: [
            {
              carrier: "FEDEX",
              serviceCode: "PRIORITY",
              serviceName: "FedEx Priority",
              totalCharges: { currency: "USD", amount: 5.0 },
              transportationCharges: { currency: "USD", amount: 5.0 },
            },
          ],
        }),
      };

      nock("https://onlinetools.ups.com")
        .post("/security/v1/oauth/token")
        .reply(200, VALID_OAUTH_TOKEN_RESPONSE);

      nock("https://onlinetools.ups.com")
        .post("/api/rating/v2409/Shop")
        .reply(200, VALID_SHOP_RESPONSE);

      registry.register(new UpsCarrierClient(TEST_CONFIG));
      registry.register(mockCarrier);
      service = new ShippingService(registry);

      const result = await service.shopRates(VALID_DOMESTIC_RATE_REQUEST);

      for (let i = 1; i < result.quotes.length; i++) {
        expect(result.quotes[i].totalCharges.amount).toBeGreaterThanOrEqual(
          result.quotes[i - 1].totalCharges.amount,
        );
      }
    });

    it("should collect errors from failing carriers without blocking others", async () => {
      const failingCarrier: CarrierClient = {
        name: "FEDEX",
        getRates: async (): Promise<RateResponse> => {
          throw new CarrierError(
            CarrierErrorCode.CARRIER_API_ERROR,
            "FedEx service unavailable",
            { carrier: "FEDEX", retryable: true },
          );
        },
      };

      nock("https://onlinetools.ups.com")
        .post("/security/v1/oauth/token")
        .reply(200, VALID_OAUTH_TOKEN_RESPONSE);

      nock("https://onlinetools.ups.com")
        .post("/api/rating/v2409/Shop")
        .reply(200, VALID_SHOP_RESPONSE);

      registry.register(new UpsCarrierClient(TEST_CONFIG));
      registry.register(failingCarrier);
      service = new ShippingService(registry);

      const result = await service.shopRates(VALID_DOMESTIC_RATE_REQUEST);

      // UPS quotes should still be present
      expect(result.quotes.length).toBe(4);
      expect(result.quotes.every((q) => q.carrier === "UPS")).toBe(true);

      // FedEx error should be collected
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].carrier).toBe("FEDEX");
      expect(result.errors[0].error.code).toBe(
        CarrierErrorCode.CARRIER_API_ERROR,
      );
    });

    it("should throw if no carriers are registered", async () => {
      try {
        await service.shopRates(VALID_DOMESTIC_RATE_REQUEST);
        expect.fail("Should have thrown");
      } catch (error: unknown) {
        const err = error as { code: string };
        expect(err.code).toBe(CarrierErrorCode.CONFIGURATION_ERROR);
      }
    });
  });
});
