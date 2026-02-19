/**
 * Carrier-agnostic domain models.
 *
 * These types represent the internal, normalized shapes that callers interact
 * with. They are intentionally decoupled from any carrier's raw API format so
 * that adding a new carrier never leaks external details to consumers.
 */

export interface Address {
  name?: string;
  addressLines: string[];
  city: string;
  stateProvinceCode?: string;
  postalCode: string;
  countryCode: string;
  residential?: boolean;
}

export type WeightUnit = "LB" | "KG" | "OZ";
export type DimensionUnit = "IN" | "CM";

export interface Dimensions {
  length: number;
  width: number;
  height: number;
  unit: DimensionUnit;
}

export interface PackageWeight {
  value: number;
  unit: WeightUnit;
}

export interface Package {
  weight: PackageWeight;
  dimensions?: Dimensions;
}

export interface RateRequest {
  origin: Address;
  destination: Address;
  packages: Package[];
  /** Optional: restrict to a specific service level (e.g. "GROUND", "NEXT_DAY_AIR"). Omit to shop all available services. */
  serviceCode?: string;
  shipperAccountNumber?: string;
}

export interface MonetaryAmount {
  currency: string;
  amount: number;
}

export interface RateQuote {
  carrier: string;
  serviceCode: string;
  serviceName: string;
  totalCharges: MonetaryAmount;
  transportationCharges: MonetaryAmount;
  serviceOptionsCharges?: MonetaryAmount;
  billingWeight?: {
    value: number;
    unit: WeightUnit;
  };
  guaranteedDelivery?: boolean;
  estimatedDeliveryDays?: number;
  warnings?: string[];
}

export interface RateResponse {
  quotes: RateQuote[];
}

export type CarrierName = "UPS" | "FEDEX" | "USPS" | "DHL";
