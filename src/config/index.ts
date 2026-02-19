import { CarrierError, CarrierErrorCode } from "../domain/errors.js";

export interface UpsConfig {
  clientId: string;
  clientSecret: string;
  accountNumber?: string;
  baseUrl: string;
  oauthUrl: string;
}

export interface AppConfig {
  ups: UpsConfig;
  requestTimeoutMs: number;
  logLevel: string;
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new CarrierError(
      CarrierErrorCode.CONFIGURATION_ERROR,
      `Missing required environment variable: ${key}`,
    );
  }
  return value;
}

export function loadConfig(): AppConfig {
  return {
    ups: {
      clientId: requireEnv("UPS_CLIENT_ID"),
      clientSecret: requireEnv("UPS_CLIENT_SECRET"),
      accountNumber: process.env["UPS_ACCOUNT_NUMBER"],
      baseUrl:
        process.env["UPS_BASE_URL"] || "https://onlinetools.ups.com/api",
      oauthUrl:
        process.env["UPS_OAUTH_URL"] ||
        "https://onlinetools.ups.com/security/v1/oauth/token",
    },
    requestTimeoutMs: parseInt(
      process.env["REQUEST_TIMEOUT_MS"] || "10000",
      10,
    ),
    logLevel: process.env["LOG_LEVEL"] || "info",
  };
}

/** Build config from explicit values (useful for testing). */
export function createConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    ups: overrides.ups ?? {
      clientId: "test-client-id",
      clientSecret: "test-client-secret",
      baseUrl: "https://onlinetools.ups.com/api",
      oauthUrl: "https://onlinetools.ups.com/security/v1/oauth/token",
    },
    requestTimeoutMs: overrides.requestTimeoutMs ?? 10000,
    logLevel: overrides.logLevel ?? "info",
  };
}
