# Carrier Integration Service

A shipping carrier integration service in TypeScript that wraps the UPS Rating API to fetch shipping rates. Built with extensibility in mind — adding a new carrier (FedEx, USPS, DHL) or a new operation (label purchase, tracking, address validation) requires no changes to existing code.

## Quick Start

```bash
# Install dependencies
npm install

# Run tests (no API key required)
npm test

# Type-check
npm run lint

# Build
npm run build

# Run CLI demo
npm run demo
```

## Project Structure

```
src/
├── config/              # Configuration layer (env vars)
├── domain/              # Carrier-agnostic domain models & errors
│   ├── models.ts        # Address, Package, RateRequest, RateQuote, etc.
│   └── errors.ts        # CarrierError with codes & structured details
├── validation/          # Zod schemas for runtime input validation
├── http/                # HTTP client wrapper (translates low-level failures)
├── carriers/
│   ├── types.ts         # CarrierClient, CarrierAuthenticator, CarrierRegistry
│   └── ups/
│       ├── auth.ts      # OAuth 2.0 client-credentials with token caching
│       ├── types.ts     # UPS-specific API request/response shapes
│       ├── mapper.ts    # Bidirectional domain ↔ UPS type mapping
│       ├── rating.ts    # UPS rating operation
│       └── client.ts    # UPS carrier client (public entry point)
├── services/
│   └── shipping-service.ts  # High-level facade orchestrating carriers
├── demo.ts              # CLI demonstration
└── index.ts             # Public API exports

tests/
├── fixtures/            # Realistic UPS API response & request fixtures
└── integration/         # Integration tests (83 total)
    ├── ups-auth.test.ts       # OAuth token lifecycle
    ├── ups-rating.test.ts     # Request building & response parsing
    ├── ups-client.test.ts     # End-to-end with validation
    ├── shipping-service.test.ts  # Multi-carrier orchestration
    ├── mapper.test.ts         # Domain ↔ UPS mapping
    └── validation.test.ts     # Zod schema validation
```

## Design Decisions

### 1. Layered Architecture with Clear Boundaries

The codebase separates concerns into distinct layers:

- **Domain layer** (`domain/`) — Carrier-agnostic types that callers interact with. `RateRequest`, `RateQuote`, `Address`, `Package` are defined here and never reference any carrier-specific format.
- **Carrier layer** (`carriers/ups/`) — All UPS-specific knowledge is encapsulated here: raw API types, request/response mapping, authentication, and the operation implementation.
- **Service layer** (`services/`) — `ShippingService` is the public facade that routes requests through the `CarrierRegistry` to the appropriate carrier client.

This means callers never see UPS's raw request/response format. They work exclusively with domain types.

### 2. Extensible Carrier & Operation Pattern

**Adding a new carrier** (e.g., FedEx):
1. Create `src/carriers/fedex/` with its own auth, types, mapper, and client
2. Implement `CarrierClient` interface
3. Register it: `registry.register(new FedExCarrierClient(config))`
4. Zero changes to UPS code, domain types, or the ShippingService

**Adding a new operation** (e.g., label purchase):
1. Create a new operation class (like `UpsLabelOperation`) implementing `CarrierOperation<LabelRequest, LabelResponse>`
2. Add the method to `CarrierClient` interface
3. The operation pattern keeps each API call isolated with its own mapper

### 3. UPS OAuth 2.0 with Token Lifecycle Management

`UpsAuthenticator` implements the client-credentials flow:
- Acquires tokens by POSTing to the UPS OAuth endpoint with Base64-encoded client credentials
- **Caches** tokens in memory and reuses them until expiry
- Applies a **60-second buffer** before the actual expiry to avoid edge cases
- **Deduplicates** concurrent token requests (if 3 calls hit simultaneously, only 1 HTTP request is made)
- Supports explicit `invalidateToken()` for forced refresh (called automatically on 401)
- All token-fetch failures (network errors, timeouts, etc.) are surfaced as `AUTHENTICATION_ERROR`

### 4. Structured Error Handling

Every error is a `CarrierError` with:
- **`code`**: Machine-readable enum (`VALIDATION_ERROR`, `AUTHENTICATION_ERROR`, `TIMEOUT_ERROR`, `RATE_LIMIT_ERROR`, etc.)
- **`message`**: Human-readable description
- **`details`**: Structured metadata (`httpStatus`, `upstreamCode`, `upstreamMessage`, `carrier`, `retryable`)

This enables callers to handle errors programmatically:
```typescript
try {
  const quotes = await shippingService.getRates("UPS", request);
} catch (error) {
  if (isCarrierError(error)) {
    if (error.details.retryable) { /* retry logic */ }
    if (error.code === CarrierErrorCode.RATE_LIMIT_ERROR) { /* back off */ }
  }
}
```

The HTTP client translates low-level Axios errors into structured `CarrierError` instances, covering: network failures, timeouts, HTTP 4xx/5xx, and malformed responses.

### 5. Runtime Validation with Zod

All inputs are validated before any external call:
- Address fields (country code length, address line count, postal code)
- Package constraints (positive weight, valid unit enums, positive dimensions)
- Rate request structure (at least one package, required fields)

Validation errors include the specific field path and constraint that failed.

### 6. Type Safety

- Domain models are the only types exposed to callers
- UPS API types (`UpsRateRequestWrapper`, `UpsRatedShipment`, etc.) are internal to the UPS carrier module
- The mapper is the single translation point between the two type systems
- All external API responses are validated/parsed before being returned

### 7. Multi-Carrier Rate Shopping

`ShippingService.shopRates()` queries all registered carriers concurrently via `Promise.allSettled`. One carrier's failure doesn't block others — errors are collected alongside successful quotes, and results are sorted by price.

## Test Coverage

83 integration tests covering:

| Category | Tests | What's Verified |
|----------|-------|----------------|
| OAuth Auth | 9 | Token acquisition, caching, refresh on expiry, invalidation, dedup, network/timeout errors |
| Rating Operation | 22 | Request building (Shop vs Rate, dimensions, weight units, multi-package, international), response parsing, all error codes (400, 401, 429, 500, network, timeout, malformed JSON) |
| Client E2E | 8 | Input validation (missing origin, empty packages, bad country, negative weight), full auth→rate flow, token reuse |
| ShippingService | 6 | Single-carrier routing, multi-carrier aggregation, error isolation, sorting, missing carrier |
| Mapper | 22 | Address mapping, weight/dimension unit conversion, single/multi package, service code lookup, charge parsing, warning extraction |
| Validation | 16 | Schema acceptance/rejection for all field constraints |

All tests use **nock** to stub HTTP calls with realistic UPS API payloads derived from the official API documentation.

## Environment Variables

See `.env.example` for the full list:

| Variable | Required | Description |
|----------|----------|-------------|
| `UPS_CLIENT_ID` | Yes | UPS OAuth client ID |
| `UPS_CLIENT_SECRET` | Yes | UPS OAuth client secret |
| `UPS_ACCOUNT_NUMBER` | No | UPS shipper account number (for negotiated rates) |
| `UPS_BASE_URL` | No | API base URL (defaults to production) |
| `UPS_OAUTH_URL` | No | OAuth token URL (defaults to production) |
| `REQUEST_TIMEOUT_MS` | No | HTTP timeout in ms (defaults to 10000) |
| `LOG_LEVEL` | No | Log level (defaults to "info") |
