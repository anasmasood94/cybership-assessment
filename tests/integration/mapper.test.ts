import { describe, it, expect } from "vitest";
import {
  buildUpsRateRequest,
  mapUpsRatedShipmentToQuote,
} from "../../src/carriers/ups/mapper.js";
import { CarrierErrorCode } from "../../src/domain/errors.js";
import type { RateRequest } from "../../src/domain/models.js";
import type { UpsRatedShipment } from "../../src/carriers/ups/types.js";

describe("UPS Mapper", () => {
  describe("buildUpsRateRequest", () => {
    const baseRequest: RateRequest = {
      origin: {
        name: "Sender Co.",
        addressLines: ["100 Main St", "Suite 200"],
        city: "Baltimore",
        stateProvinceCode: "MD",
        postalCode: "21201",
        countryCode: "US",
      },
      destination: {
        name: "Receiver Inc.",
        addressLines: ["500 Oak Ave"],
        city: "Atlanta",
        stateProvinceCode: "GA",
        postalCode: "30301",
        countryCode: "US",
        residential: true,
      },
      packages: [
        {
          weight: { value: 10, unit: "LB" },
          dimensions: { length: 12, width: 10, height: 8, unit: "IN" },
        },
      ],
    };

    it("should map origin address to Shipper and ShipFrom", () => {
      const result = buildUpsRateRequest(baseRequest);
      const shipment = result.RateRequest.Shipment;

      expect(shipment.Shipper.Name).toBe("Sender Co.");
      expect(shipment.Shipper.Address.AddressLine).toEqual([
        "100 Main St",
        "Suite 200",
      ]);
      expect(shipment.Shipper.Address.City).toBe("Baltimore");
      expect(shipment.Shipper.Address.CountryCode).toBe("US");

      expect(shipment.ShipFrom.Address.AddressLine).toEqual([
        "100 Main St",
        "Suite 200",
      ]);
    });

    it("should map destination address to ShipTo", () => {
      const result = buildUpsRateRequest(baseRequest);
      const shipTo = result.RateRequest.Shipment.ShipTo;

      expect(shipTo.Name).toBe("Receiver Inc.");
      expect(shipTo.Address.City).toBe("Atlanta");
      expect(shipTo.Address.PostalCode).toBe("30301");
      expect(shipTo.Address.ResidentialAddressIndicator).toBe("Y");
    });

    it("should not set ResidentialAddressIndicator when residential is false", () => {
      const nonResidential: RateRequest = {
        ...baseRequest,
        destination: { ...baseRequest.destination, residential: false },
      };

      const result = buildUpsRateRequest(nonResidential);
      expect(
        result.RateRequest.Shipment.ShipTo.Address
          .ResidentialAddressIndicator,
      ).toBeUndefined();
    });

    it("should omit Service when serviceCode is not provided", () => {
      const result = buildUpsRateRequest(baseRequest);
      expect(result.RateRequest.Shipment.Service).toBeUndefined();
    });

    it("should include Service when serviceCode is provided", () => {
      const withService: RateRequest = { ...baseRequest, serviceCode: "01" };
      const result = buildUpsRateRequest(withService);

      expect(result.RateRequest.Shipment.Service).toBeDefined();
      expect(result.RateRequest.Shipment.Service!.Code).toBe("01");
    });

    it("should map package weight with correct UPS unit code", () => {
      const result = buildUpsRateRequest(baseRequest);
      const pkg = result.RateRequest.Shipment.Package;
      const singlePkg = Array.isArray(pkg) ? pkg[0] : pkg;

      expect(singlePkg.PackageWeight.Weight).toBe("10");
      expect(singlePkg.PackageWeight.UnitOfMeasurement.Code).toBe("LBS");
    });

    it("should map KG weight unit to KGS", () => {
      const kgRequest: RateRequest = {
        ...baseRequest,
        packages: [
          {
            weight: { value: 3.5, unit: "KG" },
          },
        ],
      };

      const result = buildUpsRateRequest(kgRequest);
      const pkg = result.RateRequest.Shipment.Package;
      const singlePkg = Array.isArray(pkg) ? pkg[0] : pkg;

      expect(singlePkg.PackageWeight.UnitOfMeasurement.Code).toBe("KGS");
      expect(singlePkg.PackageWeight.Weight).toBe("3.5");
    });

    it("should map CM dimension unit", () => {
      const cmRequest: RateRequest = {
        ...baseRequest,
        packages: [
          {
            weight: { value: 1, unit: "LB" },
            dimensions: { length: 30, width: 20, height: 15, unit: "CM" },
          },
        ],
      };

      const result = buildUpsRateRequest(cmRequest);
      const pkg = result.RateRequest.Shipment.Package;
      const singlePkg = Array.isArray(pkg) ? pkg[0] : pkg;

      expect(singlePkg.Dimensions!.UnitOfMeasurement.Code).toBe("CM");
      expect(singlePkg.Dimensions!.Length).toBe("30");
    });

    it("should include PaymentDetails when account number is provided", () => {
      const withAccount: RateRequest = {
        ...baseRequest,
        shipperAccountNumber: "ABC123",
      };

      const result = buildUpsRateRequest(withAccount);
      const payment = result.RateRequest.Shipment.PaymentDetails;

      expect(payment).toBeDefined();
      expect(payment!.ShipmentCharge[0].Type).toBe("01");
      expect(payment!.ShipmentCharge[0].BillShipper!.AccountNumber).toBe(
        "ABC123",
      );
    });

    it("should send single package as object, not array", () => {
      const result = buildUpsRateRequest(baseRequest);
      expect(Array.isArray(result.RateRequest.Shipment.Package)).toBe(false);
    });

    it("should send multiple packages as array with NumOfPieces", () => {
      const multiPkg: RateRequest = {
        ...baseRequest,
        packages: [
          { weight: { value: 1, unit: "LB" } },
          { weight: { value: 2, unit: "LB" } },
        ],
      };

      const result = buildUpsRateRequest(multiPkg);
      expect(Array.isArray(result.RateRequest.Shipment.Package)).toBe(true);
      expect(
        (result.RateRequest.Shipment.Package as unknown[]).length,
      ).toBe(2);
      expect(result.RateRequest.Shipment.NumOfPieces).toBe("2");
    });
  });

  describe("mapUpsRatedShipmentToQuote", () => {
    const baseRatedShipment: UpsRatedShipment = {
      Service: { Code: "03", Description: "UPS Ground" },
      BillingWeight: {
        UnitOfMeasurement: { Code: "LBS", Description: "Pounds" },
        Weight: "5.0",
      },
      TransportationCharges: { CurrencyCode: "USD", MonetaryValue: "11.30" },
      ServiceOptionsCharges: { CurrencyCode: "USD", MonetaryValue: "2.50" },
      TotalCharges: { CurrencyCode: "USD", MonetaryValue: "13.80" },
    };

    it("should map service code and name", () => {
      const quote = mapUpsRatedShipmentToQuote(baseRatedShipment);
      expect(quote.serviceCode).toBe("03");
      expect(quote.serviceName).toBe("UPS Ground");
    });

    it("should map charges as numbers", () => {
      const quote = mapUpsRatedShipmentToQuote(baseRatedShipment);
      expect(quote.totalCharges).toEqual({ currency: "USD", amount: 13.8 });
      expect(quote.transportationCharges).toEqual({
        currency: "USD",
        amount: 11.3,
      });
      expect(quote.serviceOptionsCharges).toEqual({
        currency: "USD",
        amount: 2.5,
      });
    });

    it("should map billing weight with correct domain unit", () => {
      const quote = mapUpsRatedShipmentToQuote(baseRatedShipment);
      expect(quote.billingWeight).toEqual({ value: 5, unit: "LB" });
    });

    it("should map KGS billing weight to KG", () => {
      const kgShipment: UpsRatedShipment = {
        ...baseRatedShipment,
        BillingWeight: {
          UnitOfMeasurement: { Code: "KGS", Description: "Kilograms" },
          Weight: "2.3",
        },
      };

      const quote = mapUpsRatedShipmentToQuote(kgShipment);
      expect(quote.billingWeight).toEqual({ value: 2.3, unit: "KG" });
    });

    it("should set carrier to UPS", () => {
      const quote = mapUpsRatedShipmentToQuote(baseRatedShipment);
      expect(quote.carrier).toBe("UPS");
    });

    it("should use service code lookup when Description is missing", () => {
      const noDesc: UpsRatedShipment = {
        ...baseRatedShipment,
        Service: { Code: "01" },
      };

      const quote = mapUpsRatedShipmentToQuote(noDesc);
      expect(quote.serviceName).toBe("UPS Next Day Air");
    });

    it("should fall back to generic name for unknown service codes", () => {
      const unknown: UpsRatedShipment = {
        ...baseRatedShipment,
        Service: { Code: "99" },
      };

      const quote = mapUpsRatedShipmentToQuote(unknown);
      expect(quote.serviceName).toBe("UPS Service 99");
    });

    it("should extract guaranteed delivery info", () => {
      const withDelivery: UpsRatedShipment = {
        ...baseRatedShipment,
        GuaranteedDelivery: { BusinessDaysInTransit: "3" },
      };

      const quote = mapUpsRatedShipmentToQuote(withDelivery);
      expect(quote.guaranteedDelivery).toBe(true);
      expect(quote.estimatedDeliveryDays).toBe(3);
    });

    it("should set guaranteedDelivery false when not present", () => {
      const quote = mapUpsRatedShipmentToQuote(baseRatedShipment);
      expect(quote.guaranteedDelivery).toBe(false);
    });

    it("should extract warnings from RatedShipmentAlert", () => {
      const withAlerts: UpsRatedShipment = {
        ...baseRatedShipment,
        RatedShipmentAlert: [
          { Code: "110971", Description: "Rates may vary" },
          { Code: "110920", Description: "Surcharge applied" },
        ],
      };

      const quote = mapUpsRatedShipmentToQuote(withAlerts);
      expect(quote.warnings).toEqual(["Rates may vary", "Surcharge applied"]);
    });

    it("should throw CarrierError for unknown weight unit", () => {
      const badUnit: UpsRatedShipment = {
        ...baseRatedShipment,
        BillingWeight: {
          UnitOfMeasurement: { Code: "XXX", Description: "Unknown" },
          Weight: "5.0",
        },
      };

      expect(() => mapUpsRatedShipmentToQuote(badUnit)).toThrow();
      try {
        mapUpsRatedShipmentToQuote(badUnit);
      } catch (error: unknown) {
        const err = error as { code: string };
        expect(err.code).toBe(CarrierErrorCode.PARSE_ERROR);
      }
    });
  });
});
