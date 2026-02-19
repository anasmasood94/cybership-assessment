/**
 * UPS Rating API raw request/response types.
 *
 * These mirror the UPS API schema exactly and are NEVER exposed to callers.
 * The mapper layer translates between these and our domain models.
 */

// ─── Request Types ───

export interface UpsRateRequestWrapper {
  RateRequest: UpsRateRequest;
}

export interface UpsRateRequest {
  Request: {
    TransactionReference?: {
      CustomerContext?: string;
    };
  };
  Shipment: UpsShipment;
}

export interface UpsShipment {
  Shipper: UpsShipper;
  ShipTo: UpsShipTo;
  ShipFrom: UpsShipFrom;
  Service?: UpsService;
  Package: UpsPackage | UpsPackage[];
  PaymentDetails?: {
    ShipmentCharge: Array<{
      Type: string;
      BillShipper?: { AccountNumber: string };
    }>;
  };
  ShipmentRatingOptions?: {
    NegotiatedRatesIndicator?: string;
  };
  NumOfPieces?: string;
}

export interface UpsShipper {
  Name?: string;
  ShipperNumber?: string;
  Address: UpsAddress;
}

export interface UpsShipTo {
  Name?: string;
  Address: UpsShipToAddress;
}

export interface UpsShipFrom {
  Name?: string;
  Address: UpsAddress;
}

export interface UpsAddress {
  AddressLine: string[];
  City?: string;
  StateProvinceCode?: string;
  PostalCode?: string;
  CountryCode: string;
}

export interface UpsShipToAddress extends UpsAddress {
  ResidentialAddressIndicator?: string;
}

export interface UpsService {
  Code: string;
  Description?: string;
}

export interface UpsPackage {
  PackagingType: {
    Code: string;
    Description?: string;
  };
  Dimensions?: {
    UnitOfMeasurement: { Code: string; Description?: string };
    Length: string;
    Width: string;
    Height: string;
  };
  PackageWeight: {
    UnitOfMeasurement: { Code: string; Description?: string };
    Weight: string;
  };
}

// ─── Response Types ───

export interface UpsRateResponseWrapper {
  RateResponse: UpsRateResponse;
}

export interface UpsRateResponse {
  Response: {
    ResponseStatus: {
      Code: string;
      Description: string;
    };
    Alert?: Array<{
      Code: string;
      Description: string;
    }>;
    TransactionReference?: {
      CustomerContext?: string;
    };
  };
  RatedShipment: UpsRatedShipment[];
}

export interface UpsRatedShipment {
  Service: UpsService;
  RatedShipmentAlert?: Array<{
    Code: string;
    Description: string;
  }>;
  BillingWeight: {
    UnitOfMeasurement: { Code: string; Description?: string };
    Weight: string;
  };
  TransportationCharges: UpsCharge;
  ServiceOptionsCharges?: UpsCharge;
  TotalCharges: UpsCharge;
  NegotiatedRateCharges?: {
    TotalCharge: UpsCharge;
  };
  GuaranteedDelivery?: {
    BusinessDaysInTransit?: string;
    DeliveryByTime?: string;
  };
  RatedPackage?: Array<{
    TransportationCharges?: UpsCharge;
    ServiceOptionsCharges?: UpsCharge;
    TotalCharges: UpsCharge;
    Weight?: string;
    BillingWeight?: {
      UnitOfMeasurement: { Code: string; Description?: string };
      Weight: string;
    };
  }>;
  TimeInTransit?: {
    ServiceSummary?: {
      EstimatedArrival?: {
        Arrival?: {
          Date?: string;
          Time?: string;
        };
        BusinessDaysInTransit?: string;
      };
    };
  };
}

export interface UpsCharge {
  CurrencyCode: string;
  MonetaryValue: string;
}

// ─── Error Response Types ───

export interface UpsErrorResponse {
  response: {
    errors: Array<{
      code: string;
      message: string;
    }>;
  };
}

// ─── Service Code Mapping ───

export const UPS_SERVICE_CODES: Record<string, string> = {
  "01": "UPS Next Day Air",
  "02": "UPS 2nd Day Air",
  "03": "UPS Ground",
  "07": "UPS Worldwide Express",
  "08": "UPS Worldwide Expedited",
  "11": "UPS Standard",
  "12": "UPS 3 Day Select",
  "13": "UPS Next Day Air Saver",
  "14": "UPS Next Day Air Early",
  "54": "UPS Worldwide Express Plus",
  "59": "UPS 2nd Day Air A.M.",
  "65": "UPS Worldwide Saver",
  "71": "UPS Worldwide Express Freight Midday",
  "72": "UPS Worldwide Economy DDP",
  "75": "UPS Heavy Goods",
  "96": "UPS Worldwide Express Freight",
};
