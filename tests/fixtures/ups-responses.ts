/**
 * Realistic UPS API response fixtures derived from UPS API documentation.
 * Used in integration tests to verify parsing and mapping logic.
 */

import type {
  UpsRateResponseWrapper,
  UpsErrorResponse,
} from "../../src/carriers/ups/types.js";

export const VALID_RATE_RESPONSE: UpsRateResponseWrapper = {
  RateResponse: {
    Response: {
      ResponseStatus: {
        Code: "1",
        Description: "Success",
      },
      Alert: [
        {
          Code: "110971",
          Description:
            "Your invoice may vary from the displayed reference rates",
        },
      ],
      TransactionReference: {
        CustomerContext: "carrier-integration-service",
      },
    },
    RatedShipment: [
      {
        Service: { Code: "03", Description: "UPS Ground" },
        RatedShipmentAlert: [
          {
            Code: "110971",
            Description:
              "Your invoice may vary from the displayed reference rates",
          },
        ],
        BillingWeight: {
          UnitOfMeasurement: { Code: "LBS", Description: "Pounds" },
          Weight: "5.0",
        },
        TransportationCharges: { CurrencyCode: "USD", MonetaryValue: "11.30" },
        ServiceOptionsCharges: { CurrencyCode: "USD", MonetaryValue: "0.00" },
        TotalCharges: { CurrencyCode: "USD", MonetaryValue: "11.30" },
        RatedPackage: [
          {
            TransportationCharges: {
              CurrencyCode: "USD",
              MonetaryValue: "11.30",
            },
            ServiceOptionsCharges: {
              CurrencyCode: "USD",
              MonetaryValue: "0.00",
            },
            TotalCharges: { CurrencyCode: "USD", MonetaryValue: "11.30" },
            Weight: "5.0",
            BillingWeight: {
              UnitOfMeasurement: { Code: "LBS", Description: "Pounds" },
              Weight: "5.0",
            },
          },
        ],
      },
    ],
  },
};

export const VALID_SHOP_RESPONSE: UpsRateResponseWrapper = {
  RateResponse: {
    Response: {
      ResponseStatus: {
        Code: "1",
        Description: "Success",
      },
      Alert: [
        {
          Code: "110971",
          Description:
            "Your invoice may vary from the displayed reference rates",
        },
      ],
    },
    RatedShipment: [
      {
        Service: { Code: "03", Description: "UPS Ground" },
        RatedShipmentAlert: [
          {
            Code: "110971",
            Description:
              "Your invoice may vary from the displayed reference rates",
          },
        ],
        BillingWeight: {
          UnitOfMeasurement: { Code: "LBS", Description: "Pounds" },
          Weight: "5.0",
        },
        TransportationCharges: { CurrencyCode: "USD", MonetaryValue: "11.30" },
        ServiceOptionsCharges: { CurrencyCode: "USD", MonetaryValue: "0.00" },
        TotalCharges: { CurrencyCode: "USD", MonetaryValue: "11.30" },
        GuaranteedDelivery: {
          BusinessDaysInTransit: "5",
        },
        RatedPackage: [
          {
            TotalCharges: { CurrencyCode: "USD", MonetaryValue: "11.30" },
            Weight: "5.0",
          },
        ],
      },
      {
        Service: { Code: "02", Description: "UPS 2nd Day Air" },
        BillingWeight: {
          UnitOfMeasurement: { Code: "LBS", Description: "Pounds" },
          Weight: "5.0",
        },
        TransportationCharges: { CurrencyCode: "USD", MonetaryValue: "24.50" },
        ServiceOptionsCharges: { CurrencyCode: "USD", MonetaryValue: "0.00" },
        TotalCharges: { CurrencyCode: "USD", MonetaryValue: "24.50" },
        GuaranteedDelivery: {
          BusinessDaysInTransit: "2",
        },
        RatedPackage: [
          {
            TotalCharges: { CurrencyCode: "USD", MonetaryValue: "24.50" },
            Weight: "5.0",
          },
        ],
      },
      {
        Service: { Code: "01", Description: "UPS Next Day Air" },
        BillingWeight: {
          UnitOfMeasurement: { Code: "LBS", Description: "Pounds" },
          Weight: "5.0",
        },
        TransportationCharges: { CurrencyCode: "USD", MonetaryValue: "45.80" },
        ServiceOptionsCharges: { CurrencyCode: "USD", MonetaryValue: "0.00" },
        TotalCharges: { CurrencyCode: "USD", MonetaryValue: "45.80" },
        GuaranteedDelivery: {
          BusinessDaysInTransit: "1",
        },
        RatedPackage: [
          {
            TotalCharges: { CurrencyCode: "USD", MonetaryValue: "45.80" },
            Weight: "5.0",
          },
        ],
      },
      {
        Service: { Code: "12", Description: "UPS 3 Day Select" },
        BillingWeight: {
          UnitOfMeasurement: { Code: "LBS", Description: "Pounds" },
          Weight: "5.0",
        },
        TransportationCharges: { CurrencyCode: "USD", MonetaryValue: "18.20" },
        ServiceOptionsCharges: { CurrencyCode: "USD", MonetaryValue: "0.00" },
        TotalCharges: { CurrencyCode: "USD", MonetaryValue: "18.20" },
        GuaranteedDelivery: {
          BusinessDaysInTransit: "3",
        },
        RatedPackage: [
          {
            TotalCharges: { CurrencyCode: "USD", MonetaryValue: "18.20" },
            Weight: "5.0",
          },
        ],
      },
    ],
  },
};

export const VALID_NEGOTIATED_RATE_RESPONSE: UpsRateResponseWrapper = {
  RateResponse: {
    Response: {
      ResponseStatus: {
        Code: "1",
        Description: "Success",
      },
    },
    RatedShipment: [
      {
        Service: { Code: "03", Description: "UPS Ground" },
        BillingWeight: {
          UnitOfMeasurement: { Code: "LBS", Description: "Pounds" },
          Weight: "5.0",
        },
        TransportationCharges: { CurrencyCode: "USD", MonetaryValue: "11.30" },
        ServiceOptionsCharges: { CurrencyCode: "USD", MonetaryValue: "0.00" },
        TotalCharges: { CurrencyCode: "USD", MonetaryValue: "11.30" },
        NegotiatedRateCharges: {
          TotalCharge: { CurrencyCode: "USD", MonetaryValue: "9.50" },
        },
        RatedPackage: [
          {
            TotalCharges: { CurrencyCode: "USD", MonetaryValue: "11.30" },
          },
        ],
      },
    ],
  },
};

export const VALID_OAUTH_TOKEN_RESPONSE = {
  token_type: "Bearer",
  issued_at: "1719230400000",
  client_id: "test-client-id",
  access_token: "eyJhbGciOiJSUzM4NCIsInR5cCI6IkpXVCJ9.test-token",
  expires_in: "14399",
  status: "approved",
};

export const EXPIRED_OAUTH_TOKEN_RESPONSE = {
  token_type: "Bearer",
  issued_at: "1719216000000",
  client_id: "test-client-id",
  access_token: "eyJhbGciOiJSUzM4NCIsInR5cCI6IkpXVCJ9.expired-token",
  expires_in: "1",
  status: "approved",
};

export const UPS_400_ERROR: UpsErrorResponse = {
  response: {
    errors: [
      {
        code: "111210",
        message:
          "The requested service is unavailable between the selected locations.",
      },
    ],
  },
};

export const UPS_401_ERROR = {
  response: {
    errors: [
      {
        code: "250003",
        message: "Invalid Access License number",
      },
    ],
  },
};

export const UPS_429_ERROR = {
  response: {
    errors: [
      {
        code: "429001",
        message: "Rate limit exceeded. Please retry after some time.",
      },
    ],
  },
};

export const UPS_500_ERROR = {
  response: {
    errors: [
      {
        code: "500001",
        message: "Internal Server Error",
      },
    ],
  },
};
