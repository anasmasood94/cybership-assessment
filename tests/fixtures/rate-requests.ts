import type { RateRequest } from "../../src/domain/models.js";

export const VALID_DOMESTIC_RATE_REQUEST: RateRequest = {
  origin: {
    name: "Test Shipper",
    addressLines: ["100 Main Street"],
    city: "Timonium",
    stateProvinceCode: "MD",
    postalCode: "21093",
    countryCode: "US",
  },
  destination: {
    name: "Test Recipient",
    addressLines: ["200 Elm Street"],
    city: "Alpharetta",
    stateProvinceCode: "GA",
    postalCode: "30005",
    countryCode: "US",
  },
  packages: [
    {
      weight: { value: 5, unit: "LB" },
      dimensions: { length: 10, width: 8, height: 6, unit: "IN" },
    },
  ],
};

export const VALID_RATE_REQUEST_WITH_SERVICE: RateRequest = {
  ...VALID_DOMESTIC_RATE_REQUEST,
  serviceCode: "03",
};

export const VALID_MULTI_PACKAGE_REQUEST: RateRequest = {
  ...VALID_DOMESTIC_RATE_REQUEST,
  packages: [
    {
      weight: { value: 3, unit: "LB" },
      dimensions: { length: 10, width: 8, height: 6, unit: "IN" },
    },
    {
      weight: { value: 7, unit: "LB" },
      dimensions: { length: 15, width: 12, height: 10, unit: "IN" },
    },
  ],
};

export const VALID_INTERNATIONAL_REQUEST: RateRequest = {
  origin: {
    addressLines: ["100 Main Street"],
    city: "Alpharetta",
    stateProvinceCode: "GA",
    postalCode: "30005",
    countryCode: "US",
  },
  destination: {
    addressLines: ["103 avenue des Champs-Elysees"],
    city: "STARZACH",
    postalCode: "72181",
    countryCode: "DE",
  },
  packages: [
    {
      weight: { value: 2, unit: "KG" },
      dimensions: { length: 20, width: 15, height: 10, unit: "CM" },
    },
  ],
};

export const INVALID_REQUEST_MISSING_ORIGIN: Partial<RateRequest> = {
  destination: {
    addressLines: ["200 Elm Street"],
    city: "Alpharetta",
    stateProvinceCode: "GA",
    postalCode: "30005",
    countryCode: "US",
  },
  packages: [{ weight: { value: 5, unit: "LB" } }],
};

export const INVALID_REQUEST_NO_PACKAGES: Partial<RateRequest> = {
  origin: {
    addressLines: ["100 Main Street"],
    city: "Timonium",
    stateProvinceCode: "MD",
    postalCode: "21093",
    countryCode: "US",
  },
  destination: {
    addressLines: ["200 Elm Street"],
    city: "Alpharetta",
    stateProvinceCode: "GA",
    postalCode: "30005",
    countryCode: "US",
  },
  packages: [],
};

export const INVALID_REQUEST_BAD_COUNTRY: RateRequest = {
  origin: {
    addressLines: ["100 Main Street"],
    city: "Timonium",
    stateProvinceCode: "MD",
    postalCode: "21093",
    countryCode: "USA",
  },
  destination: {
    addressLines: ["200 Elm Street"],
    city: "Alpharetta",
    stateProvinceCode: "GA",
    postalCode: "30005",
    countryCode: "US",
  },
  packages: [{ weight: { value: 5, unit: "LB" } }],
};

export const INVALID_REQUEST_NEGATIVE_WEIGHT: RateRequest = {
  origin: {
    addressLines: ["100 Main Street"],
    city: "Timonium",
    stateProvinceCode: "MD",
    postalCode: "21093",
    countryCode: "US",
  },
  destination: {
    addressLines: ["200 Elm Street"],
    city: "Alpharetta",
    stateProvinceCode: "GA",
    postalCode: "30005",
    countryCode: "US",
  },
  packages: [{ weight: { value: -1, unit: "LB" } }],
};
