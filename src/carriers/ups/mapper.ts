/**
 * Bidirectional mapper between our domain models and UPS API types.
 *
 * This is the only place that knows about both sides. If the UPS API changes
 * schema, only this file (and the UPS types) need updating.
 */

import type {
  Address,
  Dimensions,
  Package,
  PackageWeight,
  RateQuote,
  RateRequest,
  WeightUnit,
} from "../../domain/models.js";
import { CarrierError, CarrierErrorCode } from "../../domain/errors.js";
import type {
  UpsAddress,
  UpsPackage,
  UpsRatedShipment,
  UpsRateRequestWrapper,
  UpsShipToAddress,
} from "./types.js";
import { UPS_SERVICE_CODES } from "./types.js";

// ─── Domain → UPS ───

const WEIGHT_UNIT_TO_UPS: Record<WeightUnit, string> = {
  LB: "LBS",
  KG: "KGS",
  OZ: "OZS",
};

const DIMENSION_UNIT_TO_UPS: Record<string, string> = {
  IN: "IN",
  CM: "CM",
};

function mapAddressToUps(addr: Address): UpsAddress {
  return {
    AddressLine: addr.addressLines,
    City: addr.city,
    StateProvinceCode: addr.stateProvinceCode,
    PostalCode: addr.postalCode,
    CountryCode: addr.countryCode,
  };
}

function mapAddressToUpsShipTo(addr: Address): UpsShipToAddress {
  return {
    ...mapAddressToUps(addr),
    ResidentialAddressIndicator: addr.residential ? "Y" : undefined,
  };
}

function mapDimensionsToUps(dim: Dimensions) {
  return {
    UnitOfMeasurement: {
      Code: DIMENSION_UNIT_TO_UPS[dim.unit],
      Description: dim.unit === "IN" ? "Inches" : "Centimeters",
    },
    Length: dim.length.toString(),
    Width: dim.width.toString(),
    Height: dim.height.toString(),
  };
}

function mapWeightToUps(weight: PackageWeight) {
  return {
    UnitOfMeasurement: {
      Code: WEIGHT_UNIT_TO_UPS[weight.unit],
      Description: weight.unit === "LB" ? "Pounds" : weight.unit === "KG" ? "Kilograms" : "Ounces",
    },
    Weight: weight.value.toString(),
  };
}

function mapPackageToUps(pkg: Package): UpsPackage {
  return {
    PackagingType: {
      Code: "02",
      Description: "Customer Supplied Package",
    },
    Dimensions: pkg.dimensions
      ? mapDimensionsToUps(pkg.dimensions)
      : undefined,
    PackageWeight: mapWeightToUps(pkg.weight),
  };
}

export function buildUpsRateRequest(
  request: RateRequest,
): UpsRateRequestWrapper {
  const packages = request.packages.map(mapPackageToUps);

  return {
    RateRequest: {
      Request: {
        TransactionReference: {
          CustomerContext: "carrier-integration-service",
        },
      },
      Shipment: {
        Shipper: {
          Name: request.origin.name ?? "Shipper",
          ShipperNumber: request.shipperAccountNumber,
          Address: mapAddressToUps(request.origin),
        },
        ShipTo: {
          Name: request.destination.name ?? "Recipient",
          Address: mapAddressToUpsShipTo(request.destination),
        },
        ShipFrom: {
          Name: request.origin.name ?? "Shipper",
          Address: mapAddressToUps(request.origin),
        },
        Service: request.serviceCode
          ? { Code: request.serviceCode, Description: UPS_SERVICE_CODES[request.serviceCode] }
          : undefined,
        Package: packages.length === 1 ? packages[0] : packages,
        PaymentDetails: request.shipperAccountNumber
          ? {
              ShipmentCharge: [
                {
                  Type: "01",
                  BillShipper: {
                    AccountNumber: request.shipperAccountNumber,
                  },
                },
              ],
            }
          : undefined,
        NumOfPieces: packages.length > 1 ? packages.length.toString() : undefined,
      },
    },
  };
}

// ─── UPS → Domain ───

const UPS_WEIGHT_UNIT_TO_DOMAIN: Record<string, WeightUnit> = {
  LBS: "LB",
  KGS: "KG",
  OZS: "OZ",
};

function parseCharge(charge: { CurrencyCode: string; MonetaryValue: string }) {
  return {
    currency: charge.CurrencyCode,
    amount: parseFloat(charge.MonetaryValue),
  };
}

export function mapUpsRatedShipmentToQuote(
  rated: UpsRatedShipment,
): RateQuote {
  const serviceCode = rated.Service.Code;
  const serviceName =
    rated.Service.Description ||
    UPS_SERVICE_CODES[serviceCode] ||
    `UPS Service ${serviceCode}`;

  const billingWeightUnit =
    UPS_WEIGHT_UNIT_TO_DOMAIN[rated.BillingWeight.UnitOfMeasurement.Code];
  if (!billingWeightUnit) {
    throw new CarrierError(
      CarrierErrorCode.PARSE_ERROR,
      `Unknown UPS weight unit: ${rated.BillingWeight.UnitOfMeasurement.Code}`,
      { carrier: "UPS" },
    );
  }

  const warnings = rated.RatedShipmentAlert?.map((a) => a.Description);

  const estimatedDeliveryDays = rated.GuaranteedDelivery?.BusinessDaysInTransit
    ? parseInt(rated.GuaranteedDelivery.BusinessDaysInTransit, 10)
    : rated.TimeInTransit?.ServiceSummary?.EstimatedArrival?.BusinessDaysInTransit
      ? parseInt(rated.TimeInTransit.ServiceSummary.EstimatedArrival.BusinessDaysInTransit, 10)
      : undefined;

  return {
    carrier: "UPS",
    serviceCode,
    serviceName,
    totalCharges: parseCharge(rated.TotalCharges),
    transportationCharges: parseCharge(rated.TransportationCharges),
    serviceOptionsCharges: rated.ServiceOptionsCharges
      ? parseCharge(rated.ServiceOptionsCharges)
      : undefined,
    billingWeight: {
      value: parseFloat(rated.BillingWeight.Weight),
      unit: billingWeightUnit,
    },
    guaranteedDelivery: !!rated.GuaranteedDelivery,
    estimatedDeliveryDays,
    warnings,
  };
}
