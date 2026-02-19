import { describe, it, expect, beforeEach, afterEach } from "vitest";
import nock from "nock";
import { UpsAuthenticator } from "../../src/carriers/ups/auth.js";
import { CarrierErrorCode } from "../../src/domain/errors.js";
import type { UpsConfig } from "../../src/config/index.js";
import {
  VALID_OAUTH_TOKEN_RESPONSE,
  EXPIRED_OAUTH_TOKEN_RESPONSE,
} from "../fixtures/ups-responses.js";

const TEST_CONFIG: UpsConfig = {
  clientId: "test-client-id",
  clientSecret: "test-client-secret",
  baseUrl: "https://onlinetools.ups.com/api",
  oauthUrl: "https://onlinetools.ups.com/security/v1/oauth/token",
};

describe("UPS OAuth Authentication", () => {
  let auth: UpsAuthenticator;

  beforeEach(() => {
    auth = new UpsAuthenticator(TEST_CONFIG);
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });

  it("should acquire a token with client credentials", async () => {
    const scope = nock("https://onlinetools.ups.com")
      .post("/security/v1/oauth/token", "grant_type=client_credentials")
      .matchHeader(
        "Authorization",
        `Basic ${Buffer.from("test-client-id:test-client-secret").toString("base64")}`,
      )
      .matchHeader("Content-Type", "application/x-www-form-urlencoded")
      .reply(200, VALID_OAUTH_TOKEN_RESPONSE);

    const token = await auth.getAccessToken();

    expect(token).toBe(VALID_OAUTH_TOKEN_RESPONSE.access_token);
    expect(scope.isDone()).toBe(true);
  });

  it("should cache and reuse a valid token", async () => {
    const scope = nock("https://onlinetools.ups.com")
      .post("/security/v1/oauth/token")
      .once()
      .reply(200, VALID_OAUTH_TOKEN_RESPONSE);

    const token1 = await auth.getAccessToken();
    const token2 = await auth.getAccessToken();

    expect(token1).toBe(token2);
    expect(scope.isDone()).toBe(true);
    // nock.once() ensures the endpoint was only called once
  });

  it("should refresh an expired token", async () => {
    // First call: short-lived token (1 second)
    nock("https://onlinetools.ups.com")
      .post("/security/v1/oauth/token")
      .reply(200, EXPIRED_OAUTH_TOKEN_RESPONSE);

    const token1 = await auth.getAccessToken();
    expect(token1).toBe(EXPIRED_OAUTH_TOKEN_RESPONSE.access_token);

    // Expired token has 1s TTL minus 60s buffer → already expired.
    // Second call should fetch a new token.
    const newTokenResponse = {
      ...VALID_OAUTH_TOKEN_RESPONSE,
      access_token: "brand-new-token-after-refresh",
    };

    nock("https://onlinetools.ups.com")
      .post("/security/v1/oauth/token")
      .reply(200, newTokenResponse);

    const token2 = await auth.getAccessToken();
    expect(token2).toBe("brand-new-token-after-refresh");
    expect(token2).not.toBe(token1);
  });

  it("should invalidate token on demand and re-fetch", async () => {
    nock("https://onlinetools.ups.com")
      .post("/security/v1/oauth/token")
      .reply(200, VALID_OAUTH_TOKEN_RESPONSE);

    const token1 = await auth.getAccessToken();
    expect(token1).toBe(VALID_OAUTH_TOKEN_RESPONSE.access_token);

    auth.invalidateToken();

    const refreshedResponse = {
      ...VALID_OAUTH_TOKEN_RESPONSE,
      access_token: "refreshed-token-after-invalidation",
    };

    nock("https://onlinetools.ups.com")
      .post("/security/v1/oauth/token")
      .reply(200, refreshedResponse);

    const token2 = await auth.getAccessToken();
    expect(token2).toBe("refreshed-token-after-invalidation");
  });

  it("should handle 401 from OAuth endpoint", async () => {
    nock("https://onlinetools.ups.com")
      .post("/security/v1/oauth/token")
      .reply(401, {
        response: {
          errors: [{ code: "250003", message: "Invalid credentials" }],
        },
      });

    await expect(auth.getAccessToken()).rejects.toMatchObject({
      code: CarrierErrorCode.AUTHENTICATION_ERROR,
    });
  });

  it("should handle network errors during token fetch", async () => {
    nock("https://onlinetools.ups.com")
      .post("/security/v1/oauth/token")
      .replyWithError("Connection refused");

    await expect(auth.getAccessToken()).rejects.toMatchObject({
      code: CarrierErrorCode.AUTHENTICATION_ERROR,
    });
  });

  it("should handle missing access_token in response", async () => {
    nock("https://onlinetools.ups.com")
      .post("/security/v1/oauth/token")
      .reply(200, { token_type: "Bearer", expires_in: "14399" });

    await expect(auth.getAccessToken()).rejects.toMatchObject({
      code: CarrierErrorCode.AUTHENTICATION_ERROR,
      message: expect.stringContaining("missing access_token"),
    });
  });

  it("should deduplicate concurrent token requests", async () => {
    let callCount = 0;
    nock("https://onlinetools.ups.com")
      .post("/security/v1/oauth/token")
      .reply(() => {
        callCount++;
        return [200, VALID_OAUTH_TOKEN_RESPONSE];
      });

    const [token1, token2, token3] = await Promise.all([
      auth.getAccessToken(),
      auth.getAccessToken(),
      auth.getAccessToken(),
    ]);

    expect(token1).toBe(VALID_OAUTH_TOKEN_RESPONSE.access_token);
    expect(token2).toBe(token1);
    expect(token3).toBe(token1);
    expect(callCount).toBe(1);
  });

  it("should handle timeout during token fetch", async () => {
    nock("https://onlinetools.ups.com")
      .post("/security/v1/oauth/token")
      .delayConnection(15000)
      .reply(200, VALID_OAUTH_TOKEN_RESPONSE);

    await expect(auth.getAccessToken()).rejects.toMatchObject({
      code: CarrierErrorCode.AUTHENTICATION_ERROR,
    });
  }, 15_000);
});
