import { describe, it, expect } from "vitest";
import { RateRequestSchema } from "../../src/validation/schemas.js";
import {
  VALID_DOMESTIC_RATE_REQUEST,
  VALID_INTERNATIONAL_REQUEST,
  VALID_MULTI_PACKAGE_REQUEST,
} from "../fixtures/rate-requests.js";

describe("Validation Schemas", () => {
  describe("RateRequestSchema", () => {
    it("should accept a valid domestic rate request", () => {
      const result = RateRequestSchema.safeParse(VALID_DOMESTIC_RATE_REQUEST);
      expect(result.success).toBe(true);
    });

    it("should accept a valid international rate request", () => {
      const result = RateRequestSchema.safeParse(VALID_INTERNATIONAL_REQUEST);
      expect(result.success).toBe(true);
    });

    it("should accept a multi-package request", () => {
      const result = RateRequestSchema.safeParse(VALID_MULTI_PACKAGE_REQUEST);
      expect(result.success).toBe(true);
    });

    it("should reject missing origin", () => {
      const invalid = { ...VALID_DOMESTIC_RATE_REQUEST, origin: undefined };
      const result = RateRequestSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should reject missing destination", () => {
      const invalid = {
        ...VALID_DOMESTIC_RATE_REQUEST,
        destination: undefined,
      };
      const result = RateRequestSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should reject empty packages array", () => {
      const invalid = { ...VALID_DOMESTIC_RATE_REQUEST, packages: [] };
      const result = RateRequestSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("package");
      }
    });

    it("should reject country code that is not 2 characters", () => {
      const invalid = {
        ...VALID_DOMESTIC_RATE_REQUEST,
        origin: { ...VALID_DOMESTIC_RATE_REQUEST.origin, countryCode: "USA" },
      };
      const result = RateRequestSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should reject negative weight", () => {
      const invalid = {
        ...VALID_DOMESTIC_RATE_REQUEST,
        packages: [{ weight: { value: -5, unit: "LB" as const } }],
      };
      const result = RateRequestSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should reject zero weight", () => {
      const invalid = {
        ...VALID_DOMESTIC_RATE_REQUEST,
        packages: [{ weight: { value: 0, unit: "LB" as const } }],
      };
      const result = RateRequestSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should reject invalid weight unit", () => {
      const invalid = {
        ...VALID_DOMESTIC_RATE_REQUEST,
        packages: [{ weight: { value: 5, unit: "TONS" } }],
      };
      const result = RateRequestSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should reject invalid dimension unit", () => {
      const invalid = {
        ...VALID_DOMESTIC_RATE_REQUEST,
        packages: [
          {
            weight: { value: 5, unit: "LB" as const },
            dimensions: { length: 10, width: 8, height: 6, unit: "FT" },
          },
        ],
      };
      const result = RateRequestSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should reject empty address lines", () => {
      const invalid = {
        ...VALID_DOMESTIC_RATE_REQUEST,
        origin: { ...VALID_DOMESTIC_RATE_REQUEST.origin, addressLines: [] },
      };
      const result = RateRequestSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should reject more than 3 address lines", () => {
      const invalid = {
        ...VALID_DOMESTIC_RATE_REQUEST,
        origin: {
          ...VALID_DOMESTIC_RATE_REQUEST.origin,
          addressLines: ["Line 1", "Line 2", "Line 3", "Line 4"],
        },
      };
      const result = RateRequestSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should accept optional dimensions", () => {
      const noDimensions = {
        ...VALID_DOMESTIC_RATE_REQUEST,
        packages: [{ weight: { value: 5, unit: "LB" as const } }],
      };
      const result = RateRequestSchema.safeParse(noDimensions);
      expect(result.success).toBe(true);
    });

    it("should accept optional service code", () => {
      const noService = { ...VALID_DOMESTIC_RATE_REQUEST };
      delete noService.serviceCode;
      const result = RateRequestSchema.safeParse(noService);
      expect(result.success).toBe(true);
    });

    it("should validate shipper account number length when provided", () => {
      const shortAccount = {
        ...VALID_DOMESTIC_RATE_REQUEST,
        shipperAccountNumber: "ABC",
      };
      const result = RateRequestSchema.safeParse(shortAccount);
      expect(result.success).toBe(false);
    });
  });
});
