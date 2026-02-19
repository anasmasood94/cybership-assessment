import { describe, it, expect, beforeEach, afterEach } from "vitest";
import nock from "nock";
import { UpsRatingOperation } from "../../src/carriers/ups/rating.js";
import { CarrierErrorCode } from "../../src/domain/errors.js";
import type { CarrierAuthenticator } from "../../src/carriers/types.js";
import type { UpsConfig } from "../../src/config/index.js";
import {
  VALID_RATE_RESPONSE,
  VALID_SHOP_RESPONSE,
  VALID_NEGOTIATED_RATE_RESPONSE,
  UPS_400_ERROR,
  UPS_500_ERROR,
} from "../fixtures/ups-responses.js";
import {
  VALID_DOMESTIC_RATE_REQUEST,
  VALID_RATE_REQUEST_WITH_SERVICE,
  VALID_MULTI_PACKAGE_REQUEST,
  VALID_INTERNATIONAL_REQUEST,
} from "../fixtures/rate-requests.js";

const TEST_CONFIG: UpsConfig = {
  clientId: "test-client-id",
  clientSecret: "test-client-secret",
  baseUrl: "https://onlinetools.ups.com/api",
  oauthUrl: "https://onlinetools.ups.com/security/v1/oauth/token",
};

function createMockAuth(token = "mock-access-token"): CarrierAuthenticator {
  return {
    getAccessToken: async () => token,
    invalidateToken: () => {},
  };
}

describe("UPS Rating Operation", () => {
  let rating: UpsRatingOperation;
  let mockAuth: CarrierAuthenticator;

  beforeEach(() => {
    mockAuth = createMockAuth();
    rating = new UpsRatingOperation(TEST_CONFIG, mockAuth);
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });

  // ─── Request Building ───

  describe("Request payload construction", () => {
    it("should build a Shop request when no service code is provided", async () => {
      let capturedBody: Record<string, unknown> | undefined;

      nock("https://onlinetools.ups.com")
        .post("/api/rating/v2409/Shop", (body: Record<string, unknown>) => {
          capturedBody = body;
          return true;
        })
        .matchHeader("Authorization", "Bearer mock-access-token")
        .reply(200, VALID_SHOP_RESPONSE);

      await rating.execute(VALID_DOMESTIC_RATE_REQUEST);

      expect(capturedBody).toBeDefined();
      const rateReq = capturedBody!["RateRequest"] as Record<string, unknown>;
      expect(rateReq).toBeDefined();

      const shipment = rateReq["Shipment"] as Record<string, unknown>;
      expect(shipment["Service"]).toBeUndefined();

      const shipper = shipment["Shipper"] as Record<string, unknown>;
      const shipperAddr = shipper["Address"] as Record<string, unknown>;
      expect(shipperAddr["City"]).toBe("Timonium");
      expect(shipperAddr["StateProvinceCode"]).toBe("MD");
      expect(shipperAddr["PostalCode"]).toBe("21093");
      expect(shipperAddr["CountryCode"]).toBe("US");

      const shipTo = shipment["ShipTo"] as Record<string, unknown>;
      const shipToAddr = shipTo["Address"] as Record<string, unknown>;
      expect(shipToAddr["City"]).toBe("Alpharetta");
      expect(shipToAddr["PostalCode"]).toBe("30005");
    });

    it("should build a Rate request when service code is provided", async () => {
      let capturedBody: Record<string, unknown> | undefined;

      nock("https://onlinetools.ups.com")
        .post("/api/rating/v2409/Rate", (body: Record<string, unknown>) => {
          capturedBody = body;
          return true;
        })
        .reply(200, VALID_RATE_RESPONSE);

      await rating.execute(VALID_RATE_REQUEST_WITH_SERVICE);

      const shipment = (capturedBody!["RateRequest"] as Record<string, unknown>)[
        "Shipment"
      ] as Record<string, unknown>;
      const service = shipment["Service"] as Record<string, unknown>;
      expect(service["Code"]).toBe("03");
    });

    it("should correctly map package dimensions and weight", async () => {
      let capturedBody: Record<string, unknown> | undefined;

      nock("https://onlinetools.ups.com")
        .post("/api/rating/v2409/Shop", (body: Record<string, unknown>) => {
          capturedBody = body;
          return true;
        })
        .reply(200, VALID_SHOP_RESPONSE);

      await rating.execute(VALID_DOMESTIC_RATE_REQUEST);

      const shipment = (capturedBody!["RateRequest"] as Record<string, unknown>)[
        "Shipment"
      ] as Record<string, unknown>;
      const pkg = shipment["Package"] as Record<string, unknown>;

      const dimensions = pkg["Dimensions"] as Record<string, unknown>;
      expect(dimensions["Length"]).toBe("10");
      expect(dimensions["Width"]).toBe("8");
      expect(dimensions["Height"]).toBe("6");

      const dimUOM = dimensions["UnitOfMeasurement"] as Record<string, unknown>;
      expect(dimUOM["Code"]).toBe("IN");

      const weight = pkg["PackageWeight"] as Record<string, unknown>;
      expect(weight["Weight"]).toBe("5");

      const weightUOM = weight["UnitOfMeasurement"] as Record<string, unknown>;
      expect(weightUOM["Code"]).toBe("LBS");
    });

    it("should send multiple packages as an array", async () => {
      let capturedBody: Record<string, unknown> | undefined;

      nock("https://onlinetools.ups.com")
        .post("/api/rating/v2409/Shop", (body: Record<string, unknown>) => {
          capturedBody = body;
          return true;
        })
        .reply(200, VALID_SHOP_RESPONSE);

      await rating.execute(VALID_MULTI_PACKAGE_REQUEST);

      const shipment = (capturedBody!["RateRequest"] as Record<string, unknown>)[
        "Shipment"
      ] as Record<string, unknown>;
      const packages = shipment["Package"] as Array<Record<string, unknown>>;

      expect(Array.isArray(packages)).toBe(true);
      expect(packages).toHaveLength(2);
      expect(
        (packages[0]["PackageWeight"] as Record<string, unknown>)["Weight"],
      ).toBe("3");
      expect(
        (packages[1]["PackageWeight"] as Record<string, unknown>)["Weight"],
      ).toBe("7");
      expect(shipment["NumOfPieces"]).toBe("2");
    });

    it("should map international addresses correctly", async () => {
      let capturedBody: Record<string, unknown> | undefined;

      nock("https://onlinetools.ups.com")
        .post("/api/rating/v2409/Shop", (body: Record<string, unknown>) => {
          capturedBody = body;
          return true;
        })
        .reply(200, VALID_SHOP_RESPONSE);

      await rating.execute(VALID_INTERNATIONAL_REQUEST);

      const shipment = (capturedBody!["RateRequest"] as Record<string, unknown>)[
        "Shipment"
      ] as Record<string, unknown>;

      const shipTo = shipment["ShipTo"] as Record<string, unknown>;
      const addr = shipTo["Address"] as Record<string, unknown>;
      expect(addr["CountryCode"]).toBe("DE");
      expect(addr["PostalCode"]).toBe("72181");
      expect(addr["City"]).toBe("STARZACH");

      // Verify weight unit mapping for KG
      const pkg = shipment["Package"] as Record<string, unknown>;
      const weight = pkg["PackageWeight"] as Record<string, unknown>;
      const uom = weight["UnitOfMeasurement"] as Record<string, unknown>;
      expect(uom["Code"]).toBe("KGS");
    });

    it("should include authorization header with bearer token", async () => {
      const scope = nock("https://onlinetools.ups.com")
        .post("/api/rating/v2409/Shop")
        .matchHeader("Authorization", "Bearer mock-access-token")
        .matchHeader("Content-Type", "application/json")
        .reply(200, VALID_SHOP_RESPONSE);

      await rating.execute(VALID_DOMESTIC_RATE_REQUEST);
      expect(scope.isDone()).toBe(true);
    });
  });

  // ─── Response Parsing ───

  describe("Response parsing and normalization", () => {
    it("should parse a single rate response into domain RateQuote", async () => {
      nock("https://onlinetools.ups.com")
        .post("/api/rating/v2409/Rate")
        .reply(200, VALID_RATE_RESPONSE);

      const result = await rating.execute(VALID_RATE_REQUEST_WITH_SERVICE);

      expect(result.quotes).toHaveLength(1);

      const quote = result.quotes[0];
      expect(quote.carrier).toBe("UPS");
      expect(quote.serviceCode).toBe("03");
      expect(quote.serviceName).toBe("UPS Ground");
      expect(quote.totalCharges).toEqual({ currency: "USD", amount: 11.3 });
      expect(quote.transportationCharges).toEqual({
        currency: "USD",
        amount: 11.3,
      });
      expect(quote.billingWeight).toEqual({ value: 5, unit: "LB" });
    });

    it("should parse multiple rate quotes from a Shop response", async () => {
      nock("https://onlinetools.ups.com")
        .post("/api/rating/v2409/Shop")
        .reply(200, VALID_SHOP_RESPONSE);

      const result = await rating.execute(VALID_DOMESTIC_RATE_REQUEST);

      expect(result.quotes).toHaveLength(4);

      const serviceCodes = result.quotes.map((q) => q.serviceCode);
      expect(serviceCodes).toContain("03");
      expect(serviceCodes).toContain("02");
      expect(serviceCodes).toContain("01");
      expect(serviceCodes).toContain("12");
    });

    it("should include service options charges when present", async () => {
      nock("https://onlinetools.ups.com")
        .post("/api/rating/v2409/Rate")
        .reply(200, VALID_RATE_RESPONSE);

      const result = await rating.execute(VALID_RATE_REQUEST_WITH_SERVICE);
      const quote = result.quotes[0];

      expect(quote.serviceOptionsCharges).toEqual({
        currency: "USD",
        amount: 0,
      });
    });

    it("should extract guaranteed delivery information", async () => {
      nock("https://onlinetools.ups.com")
        .post("/api/rating/v2409/Shop")
        .reply(200, VALID_SHOP_RESPONSE);

      const result = await rating.execute(VALID_DOMESTIC_RATE_REQUEST);

      const groundQuote = result.quotes.find((q) => q.serviceCode === "03");
      expect(groundQuote?.guaranteedDelivery).toBe(true);
      expect(groundQuote?.estimatedDeliveryDays).toBe(5);

      const nextDayQuote = result.quotes.find((q) => q.serviceCode === "01");
      expect(nextDayQuote?.estimatedDeliveryDays).toBe(1);
    });

    it("should include warnings from rated shipment alerts", async () => {
      nock("https://onlinetools.ups.com")
        .post("/api/rating/v2409/Rate")
        .reply(200, VALID_RATE_RESPONSE);

      const result = await rating.execute(VALID_RATE_REQUEST_WITH_SERVICE);
      const quote = result.quotes[0];

      expect(quote.warnings).toBeDefined();
      expect(quote.warnings).toContain(
        "Your invoice may vary from the displayed reference rates",
      );
    });

    it("should handle negotiated rate response", async () => {
      nock("https://onlinetools.ups.com")
        .post("/api/rating/v2409/Rate")
        .reply(200, VALID_NEGOTIATED_RATE_RESPONSE);

      const result = await rating.execute(VALID_RATE_REQUEST_WITH_SERVICE);
      expect(result.quotes).toHaveLength(1);
      expect(result.quotes[0].totalCharges.amount).toBe(11.3);
    });
  });

  // ─── Error Handling ───

  describe("Error handling", () => {
    it("should handle 400 Bad Request with structured error", async () => {
      nock("https://onlinetools.ups.com")
        .post("/api/rating/v2409/Rate")
        .reply(400, UPS_400_ERROR);

      try {
        await rating.execute(VALID_RATE_REQUEST_WITH_SERVICE);
        expect.fail("Should have thrown");
      } catch (error: unknown) {
        const err = error as { code: string; details: { httpStatus: number; upstreamCode: string; carrier: string; retryable: boolean } };
        expect(err.code).toBe(CarrierErrorCode.CARRIER_API_ERROR);
        expect(err.details.httpStatus).toBe(400);
        expect(err.details.upstreamCode).toBe("111210");
        expect(err.details.carrier).toBe("UPS");
        expect(err.details.retryable).toBe(false);
      }
    });

    it("should handle 401 Unauthorized and invalidate token", async () => {
      let tokenInvalidated = false;
      const authWithSpy: CarrierAuthenticator = {
        getAccessToken: async () => "expired-token",
        invalidateToken: () => {
          tokenInvalidated = true;
        },
      };
      rating = new UpsRatingOperation(TEST_CONFIG, authWithSpy);

      nock("https://onlinetools.ups.com")
        .post("/api/rating/v2409/Rate")
        .reply(401, {
          response: {
            errors: [{ code: "250003", message: "Invalid Access License" }],
          },
        });

      try {
        await rating.execute(VALID_RATE_REQUEST_WITH_SERVICE);
        expect.fail("Should have thrown");
      } catch (error: unknown) {
        const err = error as { code: string; details: { retryable: boolean } };
        expect(err.code).toBe(CarrierErrorCode.AUTHENTICATION_ERROR);
        expect(err.details.retryable).toBe(true);
        expect(tokenInvalidated).toBe(true);
      }
    });

    it("should handle 429 Rate Limit Exceeded", async () => {
      nock("https://onlinetools.ups.com")
        .post("/api/rating/v2409/Shop")
        .reply(429, {
          response: {
            errors: [{ code: "429001", message: "Rate limit exceeded" }],
          },
        });

      try {
        await rating.execute(VALID_DOMESTIC_RATE_REQUEST);
        expect.fail("Should have thrown");
      } catch (error: unknown) {
        const err = error as { code: string; details: { retryable: boolean } };
        expect(err.code).toBe(CarrierErrorCode.RATE_LIMIT_ERROR);
        expect(err.details.retryable).toBe(true);
      }
    });

    it("should handle 500 Internal Server Error as retryable", async () => {
      nock("https://onlinetools.ups.com")
        .post("/api/rating/v2409/Shop")
        .reply(500, UPS_500_ERROR);

      try {
        await rating.execute(VALID_DOMESTIC_RATE_REQUEST);
        expect.fail("Should have thrown");
      } catch (error: unknown) {
        const err = error as { code: string; details: { httpStatus: number; retryable: boolean } };
        expect(err.code).toBe(CarrierErrorCode.CARRIER_API_ERROR);
        expect(err.details.httpStatus).toBe(500);
        expect(err.details.retryable).toBe(true);
      }
    });

    it("should handle network errors", async () => {
      nock("https://onlinetools.ups.com")
        .post("/api/rating/v2409/Shop")
        .replyWithError("ECONNREFUSED");

      try {
        await rating.execute(VALID_DOMESTIC_RATE_REQUEST);
        expect.fail("Should have thrown");
      } catch (error: unknown) {
        const err = error as { code: string; details: { retryable: boolean } };
        expect(err.code).toBe(CarrierErrorCode.NETWORK_ERROR);
        expect(err.details.retryable).toBe(true);
      }
    });

    it(
      "should handle timeout errors",
      async () => {
        nock("https://onlinetools.ups.com")
          .post("/api/rating/v2409/Shop")
          .delayConnection(15000)
          .reply(200, VALID_SHOP_RESPONSE);

        try {
          await rating.execute(VALID_DOMESTIC_RATE_REQUEST);
          expect.fail("Should have thrown");
        } catch (error: unknown) {
          const err = error as { code: string; details: { retryable: boolean } };
          expect(err.code).toBe(CarrierErrorCode.TIMEOUT_ERROR);
          expect(err.details.retryable).toBe(true);
        }
      },
      15_000,
    );

    it("should handle malformed JSON response", async () => {
      nock("https://onlinetools.ups.com")
        .post("/api/rating/v2409/Shop")
        .reply(200, "not-json-at-all", {
          "Content-Type": "text/plain",
        });

      try {
        await rating.execute(VALID_DOMESTIC_RATE_REQUEST);
        expect.fail("Should have thrown");
      } catch (error: unknown) {
        const err = error as { code: string };
        expect(err.code).toBe(CarrierErrorCode.PARSE_ERROR);
      }
    });

    it("should handle response missing RateResponse envelope", async () => {
      nock("https://onlinetools.ups.com")
        .post("/api/rating/v2409/Shop")
        .reply(200, { SomethingElse: {} });

      try {
        await rating.execute(VALID_DOMESTIC_RATE_REQUEST);
        expect.fail("Should have thrown");
      } catch (error: unknown) {
        const err = error as { code: string; message: string };
        expect(err.code).toBe(CarrierErrorCode.PARSE_ERROR);
        expect(err.message).toContain("RateResponse");
      }
    });

    it("should handle response with missing RatedShipment array", async () => {
      nock("https://onlinetools.ups.com")
        .post("/api/rating/v2409/Shop")
        .reply(200, {
          RateResponse: {
            Response: {
              ResponseStatus: { Code: "1", Description: "Success" },
            },
          },
        });

      try {
        await rating.execute(VALID_DOMESTIC_RATE_REQUEST);
        expect.fail("Should have thrown");
      } catch (error: unknown) {
        const err = error as { code: string; message: string };
        expect(err.code).toBe(CarrierErrorCode.PARSE_ERROR);
        expect(err.message).toContain("RatedShipment");
      }
    });

    it("should handle auth failure during token acquisition", async () => {
      const failingAuth: CarrierAuthenticator = {
        getAccessToken: async () => {
          throw new Error("OAuth server unreachable");
        },
        invalidateToken: () => {},
      };
      rating = new UpsRatingOperation(TEST_CONFIG, failingAuth);

      try {
        await rating.execute(VALID_DOMESTIC_RATE_REQUEST);
        expect.fail("Should have thrown");
      } catch (error: unknown) {
        const err = error as { code: string };
        expect(err.code).toBe(CarrierErrorCode.AUTHENTICATION_ERROR);
      }
    });
  });
});
