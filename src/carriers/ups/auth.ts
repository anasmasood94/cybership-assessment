import type { UpsConfig } from "../../config/index.js";
import { CarrierError, CarrierErrorCode } from "../../domain/errors.js";
import { HttpClient } from "../../http/client.js";
import type { CarrierAuthenticator } from "../types.js";

interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  issued_at: string;
  expires_in: string;
  status: string;
}

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

const TOKEN_EXPIRY_BUFFER_MS = 60_000;

/**
 * UPS OAuth 2.0 client-credentials flow.
 *
 * Acquires a token, caches it, and transparently refreshes before expiry.
 * The buffer ensures we never present an about-to-expire token.
 */
export class UpsAuthenticator implements CarrierAuthenticator {
  private cache: TokenCache | null = null;
  private pendingRefresh: Promise<string> | null = null;
  private httpClient: HttpClient;

  constructor(private config: UpsConfig) {
    this.httpClient = new HttpClient({ timeoutMs: 10_000 });
  }

  async getAccessToken(): Promise<string> {
    if (this.cache && Date.now() < this.cache.expiresAt) {
      return this.cache.accessToken;
    }

    // Dedup concurrent refresh attempts
    if (this.pendingRefresh) {
      return this.pendingRefresh;
    }

    this.pendingRefresh = this.fetchToken();
    try {
      return await this.pendingRefresh;
    } finally {
      this.pendingRefresh = null;
    }
  }

  invalidateToken(): void {
    this.cache = null;
  }

  private async fetchToken(): Promise<string> {
    try {
      const credentials = Buffer.from(
        `${this.config.clientId}:${this.config.clientSecret}`,
      ).toString("base64");

      const response = await this.httpClient.post<OAuthTokenResponse>(
        this.config.oauthUrl,
        "grant_type=client_credentials",
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${credentials}`,
          },
        },
      );

      const { access_token, expires_in } = response.data;

      if (!access_token) {
        throw new CarrierError(
          CarrierErrorCode.AUTHENTICATION_ERROR,
          "UPS OAuth response missing access_token",
          { carrier: "UPS", retryable: true },
        );
      }

      const expiresInMs = parseInt(expires_in, 10) * 1000;
      this.cache = {
        accessToken: access_token,
        expiresAt: Date.now() + expiresInMs - TOKEN_EXPIRY_BUFFER_MS,
      };

      return access_token;
    } catch (error) {
      if (
        error instanceof CarrierError &&
        error.code === CarrierErrorCode.AUTHENTICATION_ERROR
      ) {
        throw error;
      }

      // Wrap all failures (network, timeout, etc.) as auth errors since
      // from the caller's perspective the token could not be obtained.
      const cause =
        error instanceof CarrierError ? error.message : (error instanceof Error ? error.message : "unknown error");
      throw new CarrierError(
        CarrierErrorCode.AUTHENTICATION_ERROR,
        `UPS authentication failed: ${cause}`,
        {
          carrier: "UPS",
          retryable: true,
        },
      );
    }
  }
}
