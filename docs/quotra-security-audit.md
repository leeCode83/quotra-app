# Quotra Security Audit Report

**Date:** 12 June 2026  
**Type:** Static Source Code Analysis  
**Scope:** Full stack (frontend, API, DB schema, web3 layer, infra config)  
**Tools:** npm audit, ESLint, manual code review

---

## Vulnerability Summary

| Severity    | Count  |
| ----------- | ------ |
| 🔴 Critical | 3      |
| 🟠 High     | 3      |
| 🟡 Medium   | 6      |
| 🟢 Low      | 4      |
| **Total**   | **16** |

---

## 🔴 Critical Findings

### C-01: Supabase Service Role Key Exposed Everywhere — RLS Completely Bypassed

**Files:**

- `src/lib/supabase-admin.ts:6`
- `src/lib/supabase-server.ts:4`
- `app/api/permissions/route.ts:4-7`
- `app/api/permissions/[listingId]/route.ts:4-7`

The `SUPABASE_SERVICE_ROLE_KEY` (full admin access) is used in all server-side database operations. The comment in `supabase-server.ts` reads:

```ts
// Demo hack: Always return the supabaseAdmin client
// This completely bypasses RLS for any server-side interaction.
```

RLS policies are defined in the schema but never enforced because every API route uses the admin client. A compromise of any server-side route gives full database access — read/write all providers, listings, transactions, and decrypted key material.

**Risk:** If any API route is exploited (SSRF, RCE, dependency vuln), attacker gains full Supabase admin access.

**Remediation:** Create a per-request authenticated Supabase client using `createServerClient` from `@supabase/ssr` with the anon key, populating auth context from verified wallet signatures or x402 payment proofs. Reserve `supabaseAdmin` for admin-only operations behind additional authorization checks.

---

### C-02: x-wallet-address Header is Trivially Spoofable

**Files:** All API routes including:

- `app/api/providers/route.ts`
- `app/api/providers/listings/route.ts`
- `app/api/escrow/claim/route.ts`
- `app/api/listings/[id]/route.ts`
- `app/api/escrow/revoke/route.ts`
- `app/api/permissions/route.ts`

Every route uses the `x-wallet-address` HTTP header as the sole authentication mechanism. This header is set by the client and is trivial to forge — any attacker can impersonate any wallet address.

```ts
// app/api/providers/listings/route.ts:19
const walletAddress = request.headers.get("x-wallet-address")?.toLowerCase();
if (!walletAddress) {
  return NextResponse.json(
    { error: "Unauthorized: x-wallet-address header required" },
    { status: 401 },
  );
}
```

No signature, no challenge-response, no proof of address ownership is ever verified.

**Remediation:** Require cryptographically signed challenges (e.g., EIP-712 typed signatures) or rely on x402 payment proofs which include the verified consumer address from the `PAYMENT-SIGNATURE` header (as done in `app/api/v1/[listingId]/chat/route.ts`). The gateway route demonstrates the correct pattern — use it as the standard.

---

### C-03: Webhook Endpoint Has No Authentication

**File:** `app/api/webhooks/oneshot/route.ts`

The 1Shot webhook endpoint accepts POST requests from any origin with no authentication, no signature verification, no IP whitelist, and no API key.

```ts
export async function POST(request: NextRequest) {
  const body: OneShotWebhookPayload = await request.json();
  // no signature check, no auth, no IP restriction
  // directly updates transactions and claim_history tables
```

An attacker can forge webhook payloads to:

- Mark failed transactions as completed
- Mark pending transactions as failed
- Update claim history status fields

**Remediation:** Verify webhook payloads using HMAC signature verification (1Shot provides signed webhooks). Validate webhook source IP against 1Shot's published IP ranges. Use a shared webhook secret.

---

## 🟠 High Findings

### H-01: Encryption Key Env Var Name Falls Back to Generic Name

**File:** `src/lib/encryption.ts:36`

```ts
const hexKey = process.env.QUOTRA_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY;
```

The fallback to `ENCRYPTION_KEY` (no prefix) risks collision with other services on shared hosting/Vercel environments. If another service on the same platform uses `ENCRYPTION_KEY`, API keys could be encrypted/decrypted with the wrong key.

**Remediation:** Remove the `ENCRYPTION_KEY` fallback. Use only `QUOTRA_ENCRYPTION_KEY`.

---

### H-02: No CSRF Protection on Any State-Changing Endpoint

**Scope:** All POST/PATCH/DELETE routes

Cookie-based auth via Supabase SSR (`supabase-middleware.ts`) sets session cookies, but no route implements CSRF tokens, `SameSite=Strict`, or Origin header validation. Combined with the spoofable `x-wallet-address` header, a CSRF attack can execute any state change on behalf of an authenticated user.

**Remediation:** Add Origin/Referer header validation middleware. Verify `x-wallet-address` matches the authenticated Supabase session when cookies are present.

---

### H-03: Internal Error Messages Leaked to Clients

**Files:** All API route error handlers

Multiple routes return internal error details to the client:

```ts
return NextResponse.json(
  {
    error: "Internal server error",
    details: err instanceof Error ? err.message : "Unknown error",
  },
  { status: 500 },
);
```

The `details` field leaks implementation-specific error messages from Supabase errors, encryption failures, and 1Shot API failures.

**Remediation:** Log full error details server-side, return only generic error messages to clients. Remove the `details` field from production error responses.

---

## 🟡 Medium Findings

### M-01: 8 Moderate npm Vulnerabilities (Direct + Transitive)

| Advisory            | Package      | CVSS | Details                     |
| ------------------- | ------------ | ---- | --------------------------- |
| GHSA-qx2v-qp2m-jg93 | postcss      | 6.1  | XSS in CSS stringify output |
| GHSA-w5hq-g745-h8pq | uuid         | 7.5  | Buffer bounds check missing |
| Transitive          | @metamask/\* | Mod  | Via @metamask/utils + uuid  |

All 8 vulnerabilities are moderate severity. The `uuid` vulnerability (CVSS 7.5) affects `@metamask/utils` and propagates to `@metamask/smart-accounts-kit` and `@metamask/x402`.

**Remediation:** Update `@metamask/smart-accounts-kit` to v1.5.0 (major bump, may need compatibility testing). Update `next` (v16.2.6 → v16.2.9).

---

### M-02: No Rate Limiting on Any API Endpoint

**Scope:** All API routes

No route implements rate limiting. The playground free trial has a 3-call lifetime limit per wallet+listing, but there is no per-second/minute rate limiting anywhere. An attacker can:

- Exhaust provider quota through rapid calls
- Flood the database with provider/listing registrations
- Submit unlimited claim requests

**Remediation:** Add rate limiting middleware using `@upstash/rate-limit` or express-rate-limit-style pattern. Apply different limits per route type (e.g., 10 req/s for chat, 1 req/s for claims).

---

### M-03: No Request Body Size Limits

**Files:** All routes using `request.json()` or `request.text()`

No payload size validation before JSON parsing. The gateway validator limits chat to 32,000 characters but parses the full body first. An attacker can send multi-megabyte payloads to cause memory exhaustion on serverless functions.

**Remediation:** Read `Content-Length` header and reject requests above a threshold (e.g., 1MB for most routes). Use streaming body parsers where possible.

---

### M-04: No Security Headers Configured

**File:** `next.config.ts`

No security headers are set. Missing:

- `Content-Security-Policy` (XSS mitigation)
- `X-Frame-Options` (clickjacking)
- `X-Content-Type-Options` (MIME sniffing)
- `Strict-Transport-Security` (HSTS)
- `Referrer-Policy`

**Remediation:** Add `headers()` config in `next.config.ts`:

```ts
async headers() {
  return [{
    source: '/(.*)',
    headers: [
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Content-Security-Policy', value: "default-src 'self'" },
    ],
  }];
}
```

---

### M-05: No Structured Logging or Audit Trail

All error logging uses `console.error` with no structured format, no log levels, no request IDs, and no centralized aggregation. Security-relevant events (failed auth attempts, permission grants, claims) are not logged or monitored.

**Remediation:** Implement structured logging with `pino` or `winston`. Log all auth failures, permission grants, and claim operations with correlation IDs.

---

### M-06: 31 Packages Behind Latest Versions

`npm outdated` shows 31 dependencies behind. Key ones:

| Package               | Current | Latest  |
| --------------------- | ------- | ------- |
| next                  | 16.2.6  | 16.2.9  |
| react                 | 19.2.4  | 19.2.7  |
| viem                  | 2.51.2  | 2.52.2  |
| @x402/\*              | 2.13.0  | 2.14.0  |
| @supabase/supabase-js | 2.106.2 | 2.108.1 |

**Remediation:** Run `npm update` for patch/minor bumps. Test major bumps (`@metamask/smart-accounts-kit` 1.5.0) separately.

---

## 🟢 Low Findings

### L-01: Suppressed ESLint Warnings (Code Quality Debt)

4 suppressed warnings across files:

- `react-hooks/set-state-in-effect` in `usePermissions.ts`, `useProviderClaim.ts`, `app/marketplace/[id]/page.tsx`, `app/playground/[listingId]/page.tsx`
- `@typescript-eslint/no-explicit-any` in `app/page.tsx`, `app/marketplace/[id]/page.tsx`, `useX402WithDelegation.ts`

All suppressed with `eslint-disable` comments — these bypass the type system and can hide real bugs.

---

### L-02: Supabase Middleware is Effectively a No-Op

**File:** `src/lib/supabase-middleware.ts`

The `updateSession` function calls `supabase.auth.getUser()` but does nothing with the result — no redirect, no header enforcement, no session validation. It returns the response unchanged.

---

### L-03: .env File Committed to Repository

**File:** `.env` (top-level)

The `.env` file exists in the working directory. `.gitignore` has `.env*` pattern (should ignore it), but if this file was force-added (`git add -f`) or tracked before the gitignore entry, credentials could leak through git history.

**Verification needed:** Run `git ls-files .env` to check if tracked.

---

### L-04: No Containerization (Dockerfile / docker-compose)

No `Dockerfile` or `docker-compose.yml` exists. While this is Vercel-deployed, having no local container setup means inconsistent local development environments and no easy way to replicate production for security testing.

---

## OWASP Top 10 Coverage

| OWASP Category                    | Status      | Related Findings                  |
| --------------------------------- | ----------- | --------------------------------- |
| A01: Broken Access Control        | ❌ FAIL     | C-01, C-02                        |
| A02: Cryptographic Failures       | ✅ PASS     | AES-256-GCM implemented correctly |
| A03: Injection                    | ✅ PASS     | Zod validation on most inputs     |
| A04: Insecure Design              | ❌ FAIL     | C-01, H-02, M-02                  |
| A05: Security Misconfiguration    | ❌ FAIL     | M-04, L-02                        |
| A06: Vulnerable Components        | ❌ FAIL     | M-01, M-06                        |
| A07: Identification/Auth Failures | 🔴 CRITICAL | C-02                              |
| A08: Data Integrity Failures      | ❌ FAIL     | C-03, H-02                        |
| A09: Logging/Monitoring           | ❌ FAIL     | M-05                              |
| A10: SSRF                         | ➖ N/A      | Not assessed statically           |

---

## Recommendations Priority Order

| #   | Action                                                                                               | Finding     |
| --- | ---------------------------------------------------------------------------------------------------- | ----------- |
| 1   | Replace `x-wallet-address` header auth with cryptographic wallet verification or x402 payment proofs | C-02        |
| 2   | Switch from `supabaseAdmin` to authenticated per-request Supabase clients                            | C-01        |
| 3   | Add webhook signature verification for the 1Shot webhook endpoint                                    | C-03        |
| 4   | Add rate limiting to all API endpoints                                                               | M-02        |
| 5   | Update vulnerable dependencies — especially `@metamask/smart-accounts-kit`                           | M-01        |
| 6   | Add HTTP security headers in `next.config.ts`                                                        | M-04        |
| 7   | Remove `details` field from production error responses                                               | H-03        |
| 8   | Add CSP headers to mitigate XSS from postcss vulnerability                                           | M-01 + M-04 |
| 9   | Implement structured logging with audit trail for security events                                    | M-05        |
| 10  | Remove `ENCRYPTION_KEY` fallback in encryption module                                                | H-01        |
