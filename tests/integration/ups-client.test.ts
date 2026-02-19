import { describe, it, expect, beforeEach, afterEach } from "vitest";
import nock from "nock";
import { UpsCarrierClient } from "../../src/carriers/ups/client.js";
import { CarrierErrorCode } from "../../src/domain/errors.js";
import type { UpsConfig } from "../../src/config/index.js";
import type { RateRequest } from "../../src/domain/models.js";
import {
  VALID_OAUTH_TOKEN_RESPONSE,
  VALID_SHOP_RESPONSE,
  VALID_RATE_RESPONSE,
} from "../fixtures/ups-responses.js";
import {
  VALID_DOMESTIC_RATE_REQUEST,
  VALID_RATE_REQUEST_WITH_SERVICE,
  INVALID_REQUEST_MISSING_ORIGIN,
  INVALID_REQUEST_NO_PACKAGES,
  INVALID_REQUEST_BAD_COUNTRY,
  INVALID_REQUEST_NEGATIVE_WEIGHT,
} from "../fixtures/rate-requests.js";

const TEST_CONFIG: UpsConfig = {
  clientId: "test-client-id",
  clientSecret: "test-client-secret",
  baseUrl: "https://onlinetools.ups.com/api",
  oauthUrl: "https://onlinetools.ups.com/security/v1/oauth/token",
};

function setupAuthMock() {
  return nock("https://onlinetools.ups.com")
    .post("/security/v1/oauth/token")
    .reply(200, VALID_OAUTH_TOKEN_RESPONSE);
}

describe("UPS Carrier Client (end-to-end with stubbed HTTP)", () => {
  let client: UpsCarrierClient;

  beforeEach(() => {
    client = new UpsCarrierClient(TEST_CONFIG);
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });

  // ─── Validation ───

  describe("Input validation", () => {
    it("should reject request with missing origin", async () => {
      try {
        await client.getRates(
          INVALID_REQUEST_MISSING_ORIGIN as RateRequest,
        );
        expect.fail("Should have thrown");
      } catch (error: unknown) {
        const err = error as { code: string; message: string; details: { retryable: boolean } };
        expect(err.code).toBe(CarrierErrorCode.VALIDATION_ERROR);
        expect(err.message).toContain("origin");
        expect(err.details.retryable).toBe(false);
      }
    });

    it("should reject request with empty packages array", async () => {
      try {
        await client.getRates(
          INVALID_REQUEST_NO_PACKAGES as RateRequest,
        );
        expect.fail("Should have thrown");
      } catch (error: unknown) {
        const err = error as { code: string; message: string };
        expect(err.code).toBe(CarrierErrorCode.VALIDATION_ERROR);
        expect(err.message).toContain("package");
      }
    });

    it("should reject request with invalid country code (3 chars)", async () => {
      try {
        await client.getRates(INVALID_REQUEST_BAD_COUNTRY);
        expect.fail("Should have thrown");
      } catch (error: unknown) {
        const err = error as { code: string; message: string };
        expect(err.code).toBe(CarrierErrorCode.VALIDATION_ERROR);
        expect(err.message).toContain("Country code");
      }
    });

    it("should reject request with negative weight", async () => {
      try {
        await client.getRates(INVALID_REQUEST_NEGATIVE_WEIGHT);
        expect.fail("Should have thrown");
      } catch (error: unknown) {
        const err = error as { code: string; message: string };
        expect(err.code).toBe(CarrierErrorCode.VALIDATION_ERROR);
        expect(err.message).toContain("Weight");
      }
    });
  });

  // ─── Full end-to-end flow ───

  describe("End-to-end rate shopping", () => {
    it("should authenticate, build request, and return normalized rates", async () => {
      setupAuthMock();
      nock("https://onlinetools.ups.com")
        .post("/api/rating/v2409/Shop")
        .reply(200, VALID_SHOP_RESPONSE);

      const result = await client.getRates(VALID_DOMESTIC_RATE_REQUEST);

      expect(result.quotes).toHaveLength(4);
      expect(result.quotes[0].carrier).toBe("UPS");
      expect(result.quotes[0].totalCharges.currency).toBe("USD");
      expect(typeof result.quotes[0].totalCharges.amount).toBe("number");
    });

    it("should authenticate and return single rate when service specified", async () => {
      setupAuthMock();
      nock("https://onlinetools.ups.com")
        .post("/api/rating/v2409/Rate")
        .reply(200, VALID_RATE_RESPONSE);

      const result = await client.getRates(VALID_RATE_REQUEST_WITH_SERVICE);

      expect(result.quotes).toHaveLength(1);
      expect(result.quotes[0].serviceCode).toBe("03");
      expect(result.quotes[0].serviceName).toBe("UPS Ground");
    });

    it("should reuse cached auth token for subsequent requests", async () => {
      // Only one auth call expected
      const authScope = nock("https://onlinetools.ups.com")
        .post("/security/v1/oauth/token")
        .once()
        .reply(200, VALID_OAUTH_TOKEN_RESPONSE);

      nock("https://onlinetools.ups.com")
        .post("/api/rating/v2409/Shop")
        .times(2)
        .reply(200, VALID_SHOP_RESPONSE);

      const result1 = await client.getRates(VALID_DOMESTIC_RATE_REQUEST);
      const result2 = await client.getRates(VALID_DOMESTIC_RATE_REQUEST);

      expect(result1.quotes).toHaveLength(4);
      expect(result2.quotes).toHaveLength(4);
      expect(authScope.isDone()).toBe(true);
    });
  });

  // ─── Auth token refresh on 401 ───

  describe("Auth token lifecycle through rating calls", () => {
    it("should propagate authentication error when token acquisition fails", async () => {
      nock("https://onlinetools.ups.com")
        .post("/security/v1/oauth/token")
        .reply(401, {
          response: {
            errors: [{ code: "250003", message: "Invalid credentials" }],
          },
        });

      try {
        await client.getRates(VALID_DOMESTIC_RATE_REQUEST);
        expect.fail("Should have thrown");
      } catch (error: unknown) {
        const err = error as { code: string };
        expect(err.code).toBe(CarrierErrorCode.AUTHENTICATION_ERROR);
      }
    });
  });
});
