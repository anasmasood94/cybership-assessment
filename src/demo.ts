/**
 * CLI demo — demonstrates how to use the carrier integration service.
 *
 * Run with: npm run demo
 *
 * Since no live UPS credentials are required for the assessment, this demo
 * will fail at the auth step when run against the real API. It serves to
 * show the public API surface and how callers would use the service.
 */

import { loadConfig } from "./config/index.js";
import { CarrierRegistry } from "./carriers/types.js";
import { UpsCarrierClient } from "./carriers/ups/client.js";
import { ShippingService } from "./services/shipping-service.js";
import { isCarrierError } from "./domain/errors.js";
import type { RateRequest } from "./domain/models.js";

async function main() {
  console.log("=== Carrier Integration Service Demo ===\n");

  let config;
  try {
    config = loadConfig();
  } catch (error) {
    if (isCarrierError(error)) {
      console.log(`Configuration: ${error.message}`);
      console.log(
        "Copy .env.example to .env and fill in your credentials to run against the live API.\n",
      );
    }
    console.log("Proceeding with demo using example request/response shapes...\n");
    showExampleUsage();
    return;
  }

  const registry = new CarrierRegistry();
  registry.register(new UpsCarrierClient(config.ups));

  const shippingService = new ShippingService(registry);

  const rateRequest: RateRequest = {
    origin: {
      name: "Sender",
      addressLines: ["100 Main Street"],
      city: "Timonium",
      stateProvinceCode: "MD",
      postalCode: "21093",
      countryCode: "US",
    },
    destination: {
      name: "Recipient",
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

  console.log("Requesting rates for shipment:");
  console.log(`  From: ${rateRequest.origin.city}, ${rateRequest.origin.stateProvinceCode}`);
  console.log(`  To:   ${rateRequest.destination.city}, ${rateRequest.destination.stateProvinceCode}`);
  console.log(`  Package: ${rateRequest.packages[0].weight.value}${rateRequest.packages[0].weight.unit}\n`);

  try {
    const result = await shippingService.shopRates(rateRequest);

    console.log(`\nReceived ${result.quotes.length} rate quote(s):\n`);
    for (const quote of result.quotes) {
      console.log(`  ${quote.serviceName}: $${quote.totalCharges.amount.toFixed(2)} ${quote.totalCharges.currency}`);
    }

    if (result.errors.length > 0) {
      console.log(`\n${result.errors.length} carrier(s) returned errors:`);
      for (const err of result.errors) {
        console.log(`  ${err.carrier}: ${err.error.message}`);
      }
    }
  } catch (error) {
    if (isCarrierError(error)) {
      console.log(`Error [${error.code}]: ${error.message}`);
      console.log("Details:", JSON.stringify(error.details, null, 2));
    } else {
      console.error("Unexpected error:", error);
    }
  }
}

function showExampleUsage() {
  console.log("Example RateRequest:");
  console.log(
    JSON.stringify(
      {
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
        packages: [
          {
            weight: { value: 5, unit: "LB" },
            dimensions: { length: 10, width: 8, height: 6, unit: "IN" },
          },
        ],
      },
      null,
      2,
    ),
  );
  console.log("\nExample RateQuote:");
  console.log(
    JSON.stringify(
      {
        carrier: "UPS",
        serviceCode: "03",
        serviceName: "UPS Ground",
        totalCharges: { currency: "USD", amount: 12.55 },
        transportationCharges: { currency: "USD", amount: 12.55 },
        billingWeight: { value: 5, unit: "LB" },
      },
      null,
      2,
    ),
  );
}

main();
