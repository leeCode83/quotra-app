# Quotra — Product Requirements Document (PRD)
> Version: 2.0.0 | Last Updated: May 2026 | Status: Active Development
> 
> **Changelog v2.0:** Fixed payment atomicity contradiction, added escrow treasury model, added request hard limits to prevent per-call pricing exploit, replaced per-call on-chain split with provider manual claim, clarified ERC-7710 vs Supabase responsibility boundary, clarified ERC-7715 role as session auth only, added consumer_permissions to gateway validation, added replay attack protection, fixed race condition with pre-call reservation model, added revoke delegation flow, clarified Vercel runtime separation, updated wording (ETH-free not gasless, OpenAI-inspired not OpenAI-compatible).
> 
> **Implementation Status (May 2026):**
> - ✅ 9.7 Claim minimum threshold — added `BELOW_MINIMUM_CLAIM` check at $0.001 to `app/api/escrow/claim/route.ts`
> - ✅ 9.8 Revoke cascade — both `/api/escrow/revoke` and `/api/listings/[id]` DELETE now cascade to `consumer_permissions.status='revoked'`
> - ✅ Auth Layer JWT expiry — `JWT_EXPIRY` changed from `"1h"` → `"24h"` in `src/lib/jwt.ts`
> - ✅ 9.5 Consumer ERC-7715 flow — `GrantPermissionButton.tsx` uses `native-token-allowance` with `allowanceAmount: 0n` (session auth), delegatee → `NEXT_PUBLIC_PAY_TO_ADDRESS`
> - ✅ 9.2 Provider ERC-7710 delegation — `useDelegation.ts` rewritten to `createProviderDelegation()`: `from: providerSmartAccount → to: QUOTRA_SERVER_ACCOUNT` (matches PRD direction)

---

## Table of Contents
1. [Project Overview](#1-project-overview)
2. [Problem Statement](#2-problem-statement)
3. [Goals & Success Metrics](#3-goals--success-metrics)
4. [Target Market & User Personas](#4-target-market--user-personas)
5. [Competitive Analysis](#5-competitive-analysis)
6. [Product Scope](#6-product-scope)
7. [User Stories](#7-user-stories)
8. [Auth Layer Architecture](#8-auth-layer-architecture)
9. [Functional Requirements](#9-functional-requirements)
10. [Non-Functional Requirements](#10-non-functional-requirements)
11. [System Architecture](#11-system-architecture)
12. [Tech Stack](#12-tech-stack)
13. [Database Schema](#13-database-schema)
14. [API Specification](#14-api-specification)
15. [Blockchain & Smart Contract Spec](#15-blockchain--smart-contract-spec)
16. [Payment & Settlement Model](#16-payment--settlement-model)
17. [Security Spec](#17-security-spec)
18. [Business Model & Revenue](#18-business-model--revenue)
19. [Edge Cases & Error Handling](#19-edge-cases--error-handling)
20. [UI/UX Requirements](#20-uiux-requirements)
21. [Out of Scope (Post-Hackathon)](#21-out-of-scope-post-hackathon)
22. [Submission Checklist](#22-submission-checklist)

---

## 1. Project Overview

**Project Name:** Quotra
**Tagline:** *"Sell your idle AI quota, buy LLM access per-call — no credit card, no commitment."*
**Hackathon:** MetaMask Smart Accounts Kit × 1Shot API Dev Cook-Off
**Target Track:** Best Use of x402 + ERC-7710
**Submission Deadline:** 15 June 2026

### What is Quotra?
Quotra is a decentralized, peer-to-peer AI API marketplace. Users who hold active Venice AI subscriptions can monetize their idle quota by listing it on Quotra. Other users can consume LLM API access by paying USDC per call — without needing a credit card, without subscriptions, and without commitment.

The core innovation is the combination of:
- **ERC-7710 delegation** — on-chain authorization layer for providers to cryptographically grant quota access
- **x402 micropayments** — HTTP-native USDC payment per API call, settled to Quotra treasury (escrow)
- **MetaMask Smart Accounts** — ETH-free UX for all users via 1Shot Relayer
- **Venice AI** — privacy-first, open model provider as the anchor LLM backend
- **Escrow treasury model** — all payments flow through Quotra treasury; providers claim earnings manually

### Key Design Decisions
- **Payment goes to treasury first (escrow)**, not directly to provider — simplifies atomicity and refund handling
- **ERC-7710 is authorization layer**, not quota enforcer — quota tracked off-chain in Supabase for speed
- **ERC-7715 is session auth only** — not for payment, not for quota
- **Provider claim model** — provider manually triggers USDC withdrawal from treasury to wallet

---

## 2. Problem Statement

### Pain Point 1: Credit Card Barrier
Developers, students, and hackathon builders in Southeast Asia (and other emerging markets) cannot access premium LLM APIs because these platforms require credit card billing setup. Many users do not have credit cards or are uncomfortable providing card details for experimental or short-term projects.

### Pain Point 2: Idle AI Subscription Waste
Users who subscribe to Venice AI's Pro, Pro+, or Max plans often do not fully utilize their monthly credit allocation. This results in wasted spend — subscriptions that auto-renew without delivering full value.

### Gap in the Market
No existing platform enables:
- P2P (user-to-user) monetization of AI quota
- Per-call payment via crypto (USDC) without fiat billing
- On-chain, auditable, revocable permission management for API key sharing
- Revenue flowing directly to individual quota holders (not to a platform middleman)

---

## 3. Goals & Success Metrics

### Hackathon Goals
| Goal | Success Metric |
|------|---------------|
| Demonstrate x402 + ERC-7710 core flow | Full end-to-end flow works in demo |
| Provider can list quota | Provider registers key, delegation signed on Base Sepolia |
| Consumer can pay per call | Consumer pays USDC, receives LLM response |
| Treasury escrow model works | Payment settles to treasury, provider can claim |
| ETH-free UX for both users | Neither provider nor consumer needs ETH |

### Product Goals (Post-Hackathon)
- 100 active providers listing quota within 3 months
- $1,000 monthly USDC volume through platform
- Sub-500ms gateway overhead (excluding Venice AI latency)

---

## 4. Target Market & User Personas

### Persona 1: Adit — The Consumer
- **Who:** Computer science student, Indonesia, 20 years old
- **Problem:** Wants to build an AI chatbot for a class project, cannot set up OpenAI billing without a credit card
- **Behavior:** Has MetaMask, holds some USDC from previous crypto activities
- **Goal:** Access LLM API per-call, spend only what he needs, no subscription

### Persona 2: Rina — The Provider
- **Who:** Freelance developer, Jakarta, 27 years old
- **Problem:** Subscribed to Venice AI Pro+ ($68/month) but only uses ~30% of her 7,500 monthly credits
- **Behavior:** Active in crypto, comfortable with wallets and DeFi
- **Goal:** Monetize her idle quota, earn passive USDC income from her subscription

### Persona 3: Bimo — The Hackathon Builder
- **Who:** Hackathon participant, needs LLM access fast
- **Problem:** No time to set up billing, needs a working API endpoint in minutes
- **Goal:** Browse Quotra, connect wallet, get endpoint, start building immediately

---

## 5. Competitive Analysis

| Platform | Payment | P2P | On-chain Permission | No Credit Card |
|----------|---------|-----|-------------------|----------------|
| **OpenRouter** | Fiat/Crypto | ❌ (centralized reseller) | ❌ | Partial |
| **Replicate** | Fiat only | ❌ | ❌ | ❌ |
| **AI/ML API** | Fiat only | ❌ | ❌ | ❌ |
| **Quotra** | USDC via x402 | ✅ | ✅ ERC-7710 | ✅ |

### Why OpenRouter Can't Just Copy This
OpenRouter is a centralized reseller — they buy API access wholesale and resell. Their revenue model depends on being the middleman. Quotra routes revenue P2P (90% to individual provider), which is structurally incompatible with OpenRouter's model.

### Key Differentiators
1. **P2P revenue** — 90% goes to individual provider wallet, not platform
2. **On-chain authorization** — ERC-7710 delegation is auditable, revocable
3. **ETH-free** — USDC from any wallet, gas costs covered via 1Shot
4. **Permissionless listing** — any Venice AI subscriber can become a provider instantly

---

## 6. Product Scope

### In Scope (MVP — Hackathon)
- Provider onboarding: connect wallet, register Venice AI key, set delegation rules, list quota
- Consumer marketplace: browse providers, filter by model, view price/call and remaining quota
- ERC-7710 delegation signing via MetaMask Smart Accounts Kit
- ERC-7715 consumer session permission grant
- x402 payment flow per API call → settles to Quotra treasury
- Next.js API Gateway: validate session → check quota → intercept payment → forward to Venice AI → return response
- Treasury escrow: all payments accumulate in treasury, provider claims manually
- Delegation state tracking in Supabase (off-chain quota enforcement)
- Multi-key support: one provider can list multiple Venice AI keys/models independently
- OpenAI-inspired request/response format (partial compatibility)
- Stateless multi-turn chat (consumer manages message history)
- Request hard limits: `max_input_chars` + `max_completion_tokens` per listing
- Replay attack protection via unique payment tx hash
- Base Sepolia Testnet deployment

### Out of Scope (Post-Hackathon)
- Provider/consumer rating & review system
- Mainnet deployment
- Support for non-Venice AI model providers
- Streaming responses (SSE)
- Pre-funded consumer wallets / deposit system
- Mobile app
- Advanced provider analytics (charts, graphs)
- Per-token pricing model
- On-chain quota enforcement (ERC-7710 caveat enforcer for call count)
- Automated batch settlement cron job

---

## 7. User Stories

### Provider Stories
| ID | Story | Priority |
|----|-------|----------|
| P1 | As a provider, I want to connect my MetaMask Smart Account so I can register on Quotra | Must Have |
| P2 | As a provider, I want to input my Venice AI API key securely so it is never exposed to anyone | Must Have |
| P3 | As a provider, I want to set price per call, max calls, max input chars, max completion tokens, and expiry | Must Have |
| P4 | As a provider, I want to list multiple Venice AI keys for different models independently | Must Have |
| P5 | As a provider, I want my delegation signed without needing ETH for gas | Must Have |
| P6 | As a provider, I want to see my pending and claimed earnings | Should Have |
| P7 | As a provider, I want to revoke a listing at any time to stop new consumers from using it | Should Have |
| P8 | As a provider, I want to claim my accumulated USDC earnings from the treasury to my wallet | Must Have |

### Consumer Stories
| ID | Story | Priority |
|----|-------|----------|
| C1 | As a consumer, I want to connect my MetaMask Smart Account to start using Quotra | Must Have |
| C2 | As a consumer, I want to browse available providers filtered by model and price | Must Have |
| C3 | As a consumer, I want to request a session permission to use a provider's quota | Must Have |
| C4 | As a consumer, I want to make a single API call and pay only for that call in USDC | Must Have |
| C5 | As a consumer, I want to receive a response in a consistent, predictable format | Must Have |
| C6 | As a consumer, I want multi-turn chat by sending message history in each request | Must Have |
| C7 | As a consumer, I want to pay without needing ETH in my wallet | Must Have |
| C8 | As a consumer, I want to see my call history and total USDC spent | Should Have |

---

## 8. Auth Layer Architecture ✅

Quotra has 4 auth layers. Each layer has a distinct, non-overlapping responsibility. Understanding this is critical for implementation.

| Layer | Technology | Responsibility | When Used |
|-------|-----------|---------------|-----------|
| **Identity** | Wallet address | Who you are | Login, all authenticated actions |
| **Session Auth** | ERC-7715 | Consumer granted access to a specific listing | Once per listing per consumer |
| **Request Auth** | JWT (HS256) | Cache of ERC-7715 approval — avoid wallet sign per call | Every API gateway request |
| **Payment** | x402 USDC | Pay for the API call | Every API gateway request |

### Why JWT is NOT removed
Without JWT, every API call would require a wallet signature — adding ~500ms+ and a MetaMask popup per request. JWT is a stateless cache of the ERC-7715 session approval, valid for 24 hours.

### Auth Layer Flow
```
ONETIME (per listing):
  Consumer → ERC-7715 wallet approval → Server issues JWT

PER-CALL:
  Consumer → JWT (identity + session proof) → x402 (payment proof) → Venice AI call
```

### What Each Layer Does NOT Do
- ERC-7715 does NOT handle payment — that is x402
- ERC-7715 does NOT enforce quota — that is Supabase
- JWT does NOT replace ERC-7715 — it caches it
- x402 does NOT authenticate identity — that is JWT + wallet

---

## 9. Functional Requirements

### 9.1 Authentication & Wallet
- All users authenticate via MetaMask Smart Account (not EOA)
- No username/password — wallet address is identity
- Wagmi handles wallet state on frontend
- Viem handles all contract reads/writes
- Wallet signature required for: provider registration, consumer permission request, provider claim earnings

### 9.2 Provider Registration Flow
1. Provider connects MetaMask Smart Account
2. Provider fills listing form:
   - Venice AI API key (plaintext input, encrypted server-side before storage)
   - Model name (selected from Venice AI supported model list)
   - Price per call in USDC (minimum: $0.0001, maximum: $1.00)
   - Max total calls (minimum: 10, maximum: 100,000)
   - Max input chars per request (minimum: 100, maximum: 8,000, default: 2,000)
   - Max completion tokens per request (minimum: 50, maximum: 2,000, default: 500)
   - Expiry duration (options: 7 / 14 / 30 / 90 days)
3. Frontend sends form data to `/api/provider/register`
4. Server-side: encrypt Venice AI key using AES-256-GCM → store ciphertext + IV + auth_tag in Supabase
5. Server-side: create delegation object via MetaMask Smart Accounts Kit:
   - `delegator`: provider wallet address
   - `delegatee`: Quotra server-side session account address
   - `authority`: ROOT_AUTHORITY (0xff...ff)
   - `caveats`: expiry timestamp only (call count enforced off-chain in Supabase)
   - `salt`: random bytes
6. Provider signs delegation via MetaMask wallet (EIP-712 typed data)
7. 1Shot Relayer submits signed delegation on-chain — provider pays no ETH
8. Server stores: `listingId`, `delegationId`, `signedDelegation` object, encrypted key → Supabase
9. Public endpoint auto-generated: `POST /api/v1/[delegationId]/chat`
10. Listing appears in marketplace

> **✅ Implementation status:** `useDelegation.ts` rewritten with `createProviderDelegation()` — delegation direction fixed to `from: providerSmartAccount → to: QUOTRA_SERVER_ACCOUNT` (uses `NEXT_PUBLIC_PAY_TO_ADDRESS`). Built on `@metamask/smart-accounts-kit` (not `delegation-toolkit`). Scope uses `NativeTokenTransferAmount` with `0n` max (equivalent to ROOT_AUTHORITY for smart-accounts-kit API). The delegation flow is not yet integrated with the registration API — integration is planned in Phase 3.

### 9.3 On-Chain vs Off-Chain Responsibility ✅

This is critical for understanding what blockchain actually secures in Quotra.

**On-chain (ERC-7710 / Base Sepolia):**
- Provider's cryptographic intent to grant access — signed delegation is immutable proof
- Expiry enforcement via timestamp caveat (block-level guarantee)
- Revocation authority — provider can invalidate delegation on-chain
- Payment settlement — USDC transfers via x402

**Off-chain (Supabase):**
- Call count quota tracking (`remaining_calls`) — faster, no RPC per call
- Consumer permission tracking (`consumer_permissions`)
- Transaction history and earnings accumulation
- API routing and key management

**Why off-chain quota tracking is valid:**
Blockchain is the trust anchor (provider signed delegation = provider consented). Off-chain handles operational metering for performance. This is standard pattern (e.g., payment channels, state channels). The on-chain delegation is proof of consent; Supabase is the execution ledger.

### 9.4 Consumer Marketplace
- List all `active` + non-expired listings from Supabase
- Display per listing: provider wallet (truncated 6+4 chars), model name, price/call, remaining calls, expiry date, max input chars, max completion tokens
- Filter by: model name, max price/call
- Sort by: price low→high (default), remaining calls high→low
- Marketplace readable without wallet connection

### 9.5 Consumer Permission Flow (ERC-7715 Session Auth)
1. Consumer selects a listing on marketplace
2. Consumer clicks "Use This Provider"
3. Consumer must connect MetaMask Smart Account if not already connected
4. Frontend calls `wallet_grantPermissions` (ERC-7715) via MetaMask Smart Accounts Kit:
   ```typescript
   const permissionRequest = {
     chainId: 84532,                          // Base Sepolia
     address: QUOTRA_SERVER_ACCOUNT,          // Quotra's server-side account
     expiry: Math.floor(Date.now()/1000) + 86400,  // 24h session
     signer: { type: "account", data: { address: consumerWallet } },
     permissions: [{
       type: "native-token-transfer",
       data: { allowance: "0" }               // session auth only, not spending
     }]
   }
   ```
5. Consumer approves in MetaMask — this is the session authorization grant
6. Frontend sends ERC-7715 proof + wallet address + delegationId to `/api/consumer/permission`
7. Server verifies ERC-7715 proof is valid for this consumer + listing
8. Server auto-creates consumer record if not exists, then upserts row into `consumer_permissions` table (UPDATE if exists, INSERT if not, status: active, expires_at: 24h) ✅
9. Server generates signed JWT:
   ```json
   {
     "consumerWallet": "0x...",
     "delegationId": "string",
     "permissionId": "uuid",
     "iat": 1234567890,
     "exp": 1234567890 + 86400
   }
   ```
10. Consumer receives: endpoint URL + JWT consumer token
11. Consumer stores JWT client-side (localStorage or in-memory)

> **✅ Implementation status:** `GrantPermissionButton.tsx` uses `requestExecutionPermissions` (smart-accounts-kit's wrapper for `wallet_grantPermissions`) with `native-token-allowance` type and `allowanceAmount: 0n`. Delegatee set to `NEXT_PUBLIC_PAY_TO_ADDRESS` (Quotra server account). Expiry: 24h (86400s). The `/api/permissions` POST endpoint stores the proof but does not yet return a JWT — JWT generation will be added in Phase 3.

### 9.6 API Gateway Flow (Core — Revised for Atomicity)

**Endpoint:** `POST /api/v1/[delegationId]/chat`

**Critical design:** Payment settles to Quotra treasury first. Provider earnings accumulate in DB. No on-chain write in the critical path after payment verification.

**Step-by-step:**

```
Step 1: JWT Validation
  - Extract Authorization: Bearer <token>
  - Verify JWT signature (HS256, JWT_SECRET)
  - Check JWT not expired
  - Extract: consumerWallet, delegationId, permissionId
  → Fail: 401 INVALID_TOKEN / TOKEN_EXPIRED

Step 2: Permission Check (consumer_permissions table)
  - Query: SELECT id FROM consumer_permissions
           WHERE id = permissionId
           AND consumer wallet matches
           AND listing delegation matches
           AND status = 'active'
           AND expires_at > now()
  → Fail: 401 PERMISSION_EXPIRED / PERMISSION_REVOKED

Step 3: Listing Validation (listings table)
  - Query listing by delegationId
  - Check: status = 'active'
  - Check: expires_at > now()
  - Check: remaining_calls > 0
  → Fail: 404 LISTING_NOT_FOUND / 410 LISTING_EXPIRED / 410 NO_CALLS_REMAINING

Step 4: Request Validation (hard limits)
  - Count total chars in all message content combined
  - Check: total_input_chars <= listing.max_input_chars
  - Check: requested max_tokens <= listing.max_completion_tokens
  → Fail: 400 REQUEST_TOO_LARGE

Step 5: x402 Payment Intercept
  - If request does NOT have X-PAYMENT header:
    → Return 402 Payment Required:
      {
        "x402Version": 1,
        "accepts": [{
          "scheme": "exact",
          "network": "base-sepolia",
          "maxAmountRequired": "<price_in_usdc_smallest_unit>",
          "resource": "/api/v1/[delegationId]/chat",
          "description": "Quotra API call - [model_name]",
          "mimeType": "application/json",
          "payTo": "QUOTRA_TREASURY_ADDRESS",
          "maxTimeoutSeconds": 60,
          "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
          "extra": { "name": "USD Coin", "version": "2" }
        }]
      }
  - Consumer wallet pays USDC to QUOTRA_TREASURY_ADDRESS via 1Shot Relayer
  - Consumer retries request with X-PAYMENT header

Step 6: Payment Proof Verification
  - Call Coinbase x402 Facilitator: POST https://api.cdp.coinbase.com/platform/v2/x402/verify
    Body: { payload: X-PAYMENT value, requirements: paymentRequirements }
  - Facilitator returns: { isValid: boolean, invalidReason?: string }
  → Fail: 402 PAYMENT_PROOF_INVALID

Step 7: Replay Attack Prevention
  - Extract tx_hash from verified payment proof
  - Attempt INSERT into transactions table with tx_hash
  - transactions.payment_tx_hash has UNIQUE CONSTRAINT
  - If INSERT fails (duplicate key) → 402 PAYMENT_ALREADY_USED
  - If INSERT succeeds → transaction row created with status = 'pending'

Step 8: Quota Reservation (pre-call decrement)
  - Atomic SQL:
    UPDATE listings
    SET remaining_calls = remaining_calls - 1
    WHERE delegation_id = $1 AND remaining_calls > 0
    RETURNING remaining_calls
  - If RETURNING is empty → 410 NO_CALLS_REMAINING
    (rollback: update transaction status to 'refund_pending')

Step 9: Venice AI Call
  - Fetch ciphertext + IV + auth_tag from Supabase
  - Decrypt Venice AI key in-memory (AES-256-GCM)
  - Build Venice AI request (OpenAI-compatible format)
  - POST to Venice AI API with decrypted key in Authorization header
  - Minimize decrypted key lifetime in application scope — do not persist
  - Timeout: 30 seconds

Step 10a: Venice AI SUCCESS
  - Update transaction: status = 'completed', provider_pending_usdc = price * 0.90
  - Accumulate earnings: UPDATE listings SET total_calls_made = total_calls_made + 1
  - Accumulate provider earnings: UPDATE providers SET pending_earnings_usdc = pending_earnings_usdc + (price * 0.90)
  - Return Venice AI response to consumer (200 OK)

Step 10b: Venice AI FAILURE
  - Update transaction: status = 'refund_pending'
  - Rollback quota reservation: remaining_calls += 1
  - Do NOT credit provider earnings
  - Trigger refund flow: treasury owes consumer full payment amount
  - Return 502 VENICE_AI_ERROR to consumer
  - Consumer will be refunded from treasury (see Section 16)
```

### 9.7 Provider Claim Earnings Flow ✅
1. Provider visits dashboard — sees `pending_earnings_usdc` balance
2. Provider clicks "Claim Earnings"
3. Frontend calls `/api/provider/claim`
4. Server reads `pending_earnings_usdc` from providers table
5. If balance < $0.001 → reject (minimum claim threshold)
6. Server initiates USDC transfer from QUOTRA_TREASURY to provider wallet
7. 1Shot Relayer executes transfer — provider pays no ETH
8. On success: reset `pending_earnings_usdc = 0`, insert claim record
9. Return success + tx hash to frontend

### 9.8 Provider Revoke Listing Flow ✅
1. Provider clicks "Revoke" on a listing in dashboard
2. Frontend calls `/api/provider/listing/[listingId]/revoke`
3. Server: update listing `status = 'revoked'` in Supabase
4. Server: update all active `consumer_permissions` for this listing to `status = 'revoked'`
5. Listing disappears from marketplace immediately
6. Existing consumer JWTs for this listing will fail at Step 2 (permission check)
7. On-chain delegation revocation: post-hackathon feature

> **✅ Implementation status:** Cascade for Step 4 is fully implemented in both `/api/listings/[id]` (DELETE) and `/api/revoke` (POST) — both update `consumer_permissions.status = 'revoked'` for the listing's active permissions via a single SQL `UPDATE`. PostgreSQL DELETE CASCADE also propagates from listings → consumer_permissions.

> **Note:** For hackathon MVP, revocation is off-chain (Supabase soft delete). This is sufficient because gateway always checks Supabase before processing. On-chain revocation via ERC-7710 is deferred to post-hackathon.

### 9.9 Multi-Key Provider Support ✅
- One provider wallet can create multiple listings
- Each listing = one Venice AI key + one delegation + independent settings
- Each listing has independently configurable: model, price, max calls, max input chars, max completion tokens, expiry
- All listings appear separately on marketplace
- Provider can revoke individual listings without affecting others

### 9.10 Multi-Turn Chat (Stateless)
- Gateway is fully stateless — no server-side conversation history stored
- Consumer sends full message history in each request:
  ```json
  {
    "model": "llama-3.3-70b",
    "messages": [
      { "role": "system", "content": "You are a helpful assistant." },
      { "role": "user", "content": "Hello" },
      { "role": "assistant", "content": "Hi! How can I help?" },
      { "role": "user", "content": "Explain blockchain." }
    ],
    "temperature": 0.7,
    "max_tokens": 500
  }
  ```
- Each request = one API call = one USDC payment regardless of history length
- Hard limit: total combined character count of all `content` fields ≤ `listing.max_input_chars`
- This prevents abuse: sending 50-message history counts against max_input_chars

---

## 10. Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| **Performance** | Gateway overhead ≤ 500ms (excluding x402 verify + Venice AI latency) |
| **Availability** | Vercel deployment — 99.9% uptime SLA |
| **Security** | Venice AI keys: never logged, never stored plaintext, never returned in any response |
| **Scalability** | Stateless gateway — horizontally scalable on Vercel serverless |
| **Format** | OpenAI-inspired request/response format (partial compatibility) |
| **Network** | Base Sepolia Testnet (chainId: 84532) |
| **Payment Token** | USDC on Base Sepolia: `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| **Vercel Runtime** | Gateway API routes: Node.js runtime (NOT Edge) — required for crypto operations and blockchain reads |

### Vercel Runtime Separation
```
Frontend pages     → Edge Runtime (fast, global CDN)
/api/marketplace   → Edge Runtime (read-only DB query)
/api/v1/[id]/chat  → Node.js Runtime (x402 verify, AES decrypt, Venice AI call)
/api/provider/*    → Node.js Runtime (AES encrypt, delegation signing)
```
> **Why this matters:** x402 facilitator HTTP calls, AES-256-GCM crypto, and Supabase writes with transactions require Node.js runtime. Placing these on Edge Runtime will cause silent failures or timeout errors.

---

## 11. System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                          QUOTRA PLATFORM                              │
│                                                                        │
│  ┌───────────────┐        ┌──────────────────────────────────────┐   │
│  │   PROVIDER    │        │         NEXT.JS APP (Vercel)          │   │
│  │               │        │                                        │   │
│  │ MetaMask      │───────▶│  Frontend (App Router / Edge)         │   │
│  │ Smart Account │        │  - Landing Page                       │   │
│  │               │        │  - Provider Dashboard                 │   │
│  │ 1. Input key  │        │  - Consumer Marketplace               │   │
│  │ 2. Set rules  │        │  - Wagmi wallet state                 │   │
│  │ 3. Sign ERC-  │        │                                        │   │
│  │    7710 deleg.│        │  API Routes (Node.js Runtime)         │   │
│  │ 4. Claim USDC │        │  POST /api/v1/[delegationId]/chat     │   │
│  └───────────────┘        │  POST /api/provider/register          │   │
│                           │  POST /api/provider/claim             │   │
│  ┌───────────────┐        │  POST /api/provider/listing/[id]/revoke│  │
│  │   CONSUMER    │        │  POST /api/consumer/permission        │   │
│  │               │        │  GET  /api/marketplace                │   │
│  │ MetaMask      │───────▶│                                        │   │
│  │ Smart Account │        └──────────────┬───────────────────────┘   │
│  │               │                       │                            │
│  │ 1. Browse     │        ┌──────────────▼───────────────────────┐   │
│  │ 2. ERC-7715   │        │              SUPABASE                 │   │
│  │    approve    │        │  - providers (wallet, pending_earn)   │   │
│  │ 3. Call API   │        │  - listings (key enc, quota, limits)  │   │
│  │ 4. Pay USDC   │        │  - consumers                         │   │
│  └───────────────┘        │  - consumer_permissions               │   │
│                           │  - transactions (replay protection)   │   │
│                           │  - claim_history                      │   │
│                           └──────────────────────────────────────┘   │
│                                                                        │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                      EXTERNAL SERVICES                          │  │
│  │                                                                  │  │
│  │  MetaMask Smart Accounts Kit  ←→  ERC-7710 delegation signing  │  │
│  │  MetaMask Smart Accounts Kit  ←→  ERC-7715 session permission  │  │
│  │  1Shot API Relayer            ←→  ETH-free tx submission        │  │
│  │  Coinbase x402 Facilitator    ←→  Payment verify/settle         │  │
│  │  Venice AI API                ←→  LLM inference (text)         │  │
│  │  Base Sepolia Testnet         ←→  USDC settlement, delegation  │  │
│  │  QUOTRA_TREASURY_ADDRESS      ←→  Payment escrow               │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

### Data Flow: Provider Registration
```
Provider (browser)
  → fill form
  → POST /api/provider/register
  → server: AES-256-GCM encrypt Venice AI key
  → server: build ERC-7710 delegation object
  → server: return delegation for provider to sign (EIP-712)
  → provider: signs delegation in MetaMask
  → server: 1Shot Relayer submits signed delegation on-chain
  → server: store delegation + encrypted key in Supabase
  → listing live on marketplace
```

### Data Flow: Consumer API Call
```
Consumer (app/code)
  → POST /api/v1/[delegationId]/chat (no X-PAYMENT)
  → gateway: validate JWT → check consumer_permissions → check listing
  → gateway: return 402 + payment requirements
  → consumer wallet: pay USDC to QUOTRA_TREASURY via 1Shot
  → consumer: retry POST with X-PAYMENT header
  → gateway: verify payment via Coinbase x402 Facilitator (HTTP)
  → gateway: prevent replay (unique tx_hash insert)
  → gateway: decrement remaining_calls (quota reservation)
  → gateway: decrypt Venice AI key → forward request → get response
  → gateway: update transaction (completed) + provider pending earnings
  → consumer: receives LLM response (200 OK)
```

---

## 12. Tech Stack

| Technology | Role | Notes |
|-----------|------|-------|
| **Next.js 14** (App Router) | Frontend + API Gateway | Single repo, TypeScript, Vercel deployment ✅ |
| **TypeScript** | All codebase | Strict mode ✅ |
| **Tailwind CSS** | Styling | Utility-first ✅ |
| **shadcn/ui** | UI Components | Accessible, composable ✅ |
| **MetaMask Smart Accounts Kit** (`@metamask/delegation-toolkit`) | ERC-7710 delegation + ERC-7715 permission | Core hackathon requirement |
| **Viem** | Contract reads/writes, EIP-712 signing, chain interaction | TypeScript-native ✅ |
| **Wagmi** | React hooks for wallet state | Built on Viem ✅ |
| **ERC-7710** | On-chain delegation (authorization layer) | Provider signs once; gateway redeems |
| **ERC-7715** | Consumer session permission grant | One-time per listing per consumer |
| **x402 Protocol** (`@x402/next`, `@x402/core`) | HTTP-native per-call USDC payment | Intercept in Next.js API Route via `withX402` wrapper and `HTTPFacilitatorClient` ✅ |
| **1Shot API** | ETH-free tx relay | Provider delegation + consumer payments + provider claim ✅ |
| **Venice AI API** | LLM model provider | Text only, OpenAI-compatible API format ✅ |
| **Supabase** | PostgreSQL database | RLS enabled, all quota tracking ✅ |
| **Vercel** | Deployment | Edge + Node.js runtime separation ✅ |
| **Base Sepolia** | Blockchain network | chainId: 84532 ✅ |
| **USDC** | Payment token | Base Sepolia USDC ✅ |

---

## 13. Database Schema

> ✅ All 6 table definitions implemented exactly as specified below (schema.sql).

### Table: `providers`
```sql
CREATE TABLE providers (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address        TEXT NOT NULL UNIQUE,
  pending_earnings_usdc NUMERIC(18, 8) NOT NULL DEFAULT 0,  -- accumulated, not yet claimed
  total_earned_usdc     NUMERIC(18, 8) NOT NULL DEFAULT 0,  -- all-time claimed + pending
  created_at            TIMESTAMPTZ DEFAULT now()
);
```

### Table: `listings`
```sql
CREATE TABLE listings (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id           UUID REFERENCES providers(id) ON DELETE CASCADE,
  delegation_id         TEXT NOT NULL UNIQUE,       -- ERC-7710 delegation hash/id
  signed_delegation     JSONB NOT NULL,             -- full signed delegation object (for redemption)
  encrypted_key         TEXT NOT NULL,              -- AES-256-GCM ciphertext
  key_iv                TEXT NOT NULL,              -- AES IV (hex)
  key_auth_tag          TEXT NOT NULL,              -- AES auth tag (hex)
  model_name            TEXT NOT NULL,              -- e.g. "llama-3.3-70b"
  price_per_call_usdc   NUMERIC(18, 8) NOT NULL,    -- e.g. 0.001
  max_calls             INTEGER NOT NULL,
  remaining_calls       INTEGER NOT NULL,
  max_input_chars       INTEGER NOT NULL DEFAULT 2000,
  max_completion_tokens INTEGER NOT NULL DEFAULT 500,
  total_calls_made      INTEGER NOT NULL DEFAULT 0,
  expires_at            TIMESTAMPTZ NOT NULL,
  status                TEXT NOT NULL DEFAULT 'active', -- active | revoked | expired
  created_at            TIMESTAMPTZ DEFAULT now()
);
```

### Table: `consumers`
```sql
CREATE TABLE consumers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address  TEXT NOT NULL UNIQUE,
  total_spent_usdc NUMERIC(18, 8) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now()
);
```

### Table: `consumer_permissions`
```sql
CREATE TABLE consumer_permissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id     UUID NOT NULL REFERENCES consumers(id) ON DELETE CASCADE,
  listing_id      UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  erc7715_proof   TEXT NOT NULL,                -- raw ERC-7715 proof from MetaMask
  granted_at      TIMESTAMPTZ DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL,         -- 24h from granted_at
  status          TEXT NOT NULL DEFAULT 'active' -- active | revoked | expired
);
```

### Table: `transactions`
```sql
CREATE TABLE transactions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id            UUID NOT NULL REFERENCES listings(id),
  consumer_id           UUID NOT NULL REFERENCES consumers(id),
  payment_tx_hash       TEXT NOT NULL UNIQUE,     -- UNIQUE: replay attack protection
  amount_usdc           NUMERIC(18, 8) NOT NULL,  -- total paid by consumer
  provider_amount_usdc  NUMERIC(18, 8) NOT NULL,  -- 90% — credited to provider pending
  platform_amount_usdc  NUMERIC(18, 8) NOT NULL,  -- 10% — stays in treasury
  status                TEXT NOT NULL DEFAULT 'pending', -- pending | completed | refund_pending | refunded
  prompt_tokens         INTEGER,                  -- from Venice AI response
  completion_tokens     INTEGER,                  -- from Venice AI response
  created_at            TIMESTAMPTZ DEFAULT now(),
  completed_at          TIMESTAMPTZ
);
```

### Table: `claim_history`
```sql
CREATE TABLE claim_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id     UUID NOT NULL REFERENCES providers(id),
  amount_usdc     NUMERIC(18, 8) NOT NULL,
  tx_hash         TEXT,                   -- on-chain USDC transfer tx hash
  status          TEXT NOT NULL DEFAULT 'pending', -- pending | completed | failed
  created_at      TIMESTAMPTZ DEFAULT now()
);
```

### RLS Policies
```sql
-- Listings: publicly readable when active
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "marketplace_read_active" ON listings
  FOR SELECT USING (status = 'active' AND expires_at > now());

-- Providers: read own record only
ALTER TABLE providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "provider_own_record" ON providers
  FOR ALL USING (wallet_address = current_setting('app.wallet_address', true));

-- Transactions: read by involved provider or consumer
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- consumer_permissions: read own permissions only
ALTER TABLE consumer_permissions ENABLE ROW LEVEL SECURITY;
```

### Database Indexes ✅
```sql
-- Performance optimization indexes
CREATE INDEX idx_listings_provider_id ON listings(provider_id);
CREATE INDEX idx_listings_active ON listings(status, expires_at) WHERE status = 'active';
CREATE INDEX idx_consumer_permissions_consumer_id ON consumer_permissions(consumer_id);
CREATE INDEX idx_consumer_permissions_listing_id ON consumer_permissions(listing_id);
CREATE INDEX idx_consumer_permissions_active ON consumer_permissions(status, expires_at) WHERE status = 'active';
CREATE INDEX idx_transactions_listing_id ON transactions(listing_id);
CREATE INDEX idx_transactions_consumer_id ON transactions(consumer_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_claim_history_provider_id ON claim_history(provider_id);
CREATE INDEX idx_claim_history_status ON claim_history(status);
```

### Critical SQL: Atomic Quota Reservation
```sql
-- Reserve a call slot before Venice AI call (prevents race condition)
-- Returns empty if no calls remaining
UPDATE listings
SET remaining_calls = remaining_calls - 1
WHERE delegation_id = $1
  AND remaining_calls > 0
  AND status = 'active'
  AND expires_at > now()
RETURNING id, remaining_calls;

-- Rollback if Venice AI fails
UPDATE listings
SET remaining_calls = remaining_calls + 1
WHERE delegation_id = $1;
```

---

## 14. API Specification

### 14.1 Provider Registration
```
POST /api/provider/register
Content-Type: application/json

Request:
{
  "walletAddress": "0x...",
  "veniceApiKey": "string",             // plaintext, AES-encrypted server-side immediately
  "modelName": "llama-3.3-70b",
  "pricePerCallUsdc": 0.001,            // min: 0.0001, max: 1.00
  "maxCalls": 500,                       // min: 10, max: 100000
  "maxInputChars": 2000,                // min: 100, max: 8000
  "maxCompletionTokens": 500,           // min: 50, max: 2000
  "expiryDays": 30,                     // allowed: 7, 14, 30, 90
  "signedDelegation": { ... }           // ERC-7710 signed delegation object from MetaMask
}

Response 201:
{
  "listingId": "uuid",
  "delegationId": "string",
  "endpoint": "https://quotra.app/api/v1/{delegationId}/chat",
  "expiresAt": "2026-07-01T00:00:00Z"
}

Errors:
  400: { "error": "INVALID_MODEL" | "INVALID_PRICE" | "INVALID_KEY" | "INVALID_PARAMS" }
  500: { "error": "DELEGATION_SUBMIT_FAILED" | "ENCRYPTION_FAILED" }
```

### 14.2 Marketplace Listings
```
GET /api/marketplace?model=&maxPrice=&sort=

Query params:
  model     (optional) exact model name filter
  maxPrice  (optional) max price per call USDC (float)
  sort      (optional) "price_asc" | "calls_desc" (default: "price_asc")

Response 200:
{
  "listings": [
    {
      "delegationId": "string",
      "providerWallet": "0x1234...5678",
      "modelName": "llama-3.3-70b",
      "pricePerCallUsdc": 0.001,
      "remainingCalls": 487,
      "maxInputChars": 2000,
      "maxCompletionTokens": 500,
      "expiresAt": "2026-07-01T00:00:00Z"
    }
  ]
}
```

### 14.3 Consumer Permission Request
```
POST /api/consumer/permission
Content-Type: application/json

Request:
{
  "walletAddress": "0x...",
  "delegationId": "string",
  "erc7715Proof": "string"         // raw ERC-7715 proof from wallet_grantPermissions
}

Response 200:
{
  "consumerToken": "eyJ...",       // JWT HS256, expires 24h
  "endpoint": "https://quotra.app/api/v1/{delegationId}/chat",
  "permissionId": "uuid",
  "expiresAt": "2026-06-16T00:00:00Z"
}

Errors:
  400: { "error": "INVALID_PROOF" }
  404: { "error": "LISTING_NOT_FOUND" }
  410: { "error": "LISTING_EXPIRED" | "LISTING_REVOKED" | "NO_CALLS_REMAINING" }
```

### 14.4 LLM API Gateway (Core Endpoint)
```
POST /api/v1/[delegationId]/chat
Authorization: Bearer <consumer_token>
Content-Type: application/json

Request Body:
{
  "model": "llama-3.3-70b",            // must match listing model
  "messages": [
    { "role": "system", "content": "string" },   // optional
    { "role": "user", "content": "string" }      // required, at least 1
  ],
  "temperature": 0.7,                  // optional, 0.0–2.0, default 0.7
  "max_tokens": 500                    // optional, max = listing.max_completion_tokens
}

Validation:
  - Sum of all message content chars <= listing.max_input_chars
  - max_tokens (if provided) <= listing.max_completion_tokens
  - messages array: 1–50 items
  - Each message content: non-empty string

First response (no payment):
  HTTP 402 Payment Required
  Header: PAYMENT-REQUIRED: <json_payment_requirements>
  {
    "x402Version": 1,
    "accepts": [{
      "scheme": "exact",
      "network": "base-sepolia",
      "maxAmountRequired": "<price_in_atomic_units>",
      "resource": "/api/v1/[delegationId]/chat",
      "description": "Quotra - [model_name] - 1 call",
      "mimeType": "application/json",
      "payTo": "QUOTRA_TREASURY_ADDRESS",
      "maxTimeoutSeconds": 60,
      "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      "extra": { "name": "USD Coin", "version": "2" }
    }]
  }

Second response (with X-PAYMENT / PAYMENT-SIGNATURE header):
  200 OK:
  {
    "id": "chatcmpl-...",
    "object": "chat.completion",
    "model": "llama-3.3-70b",
    "choices": [{
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "string"
      },
      "finish_reason": "stop"
    }],
    "usage": {
      "prompt_tokens": 20,
      "completion_tokens": 150,
      "total_tokens": 170
    }
  }

Error responses:
  400: { "error": "REQUEST_TOO_LARGE", "detail": "Input exceeds max_input_chars: 2000" }
  400: { "error": "INVALID_REQUEST", "detail": "..." }
  401: { "error": "INVALID_TOKEN" | "TOKEN_EXPIRED" | "PERMISSION_EXPIRED" | "PERMISSION_REVOKED" }
  402: { "error": "PAYMENT_PROOF_INVALID" | "PAYMENT_ALREADY_USED" }
  404: { "error": "LISTING_NOT_FOUND" }
  410: { "error": "LISTING_EXPIRED" | "LISTING_REVOKED" | "NO_CALLS_REMAINING" }
  502: { "error": "VENICE_AI_ERROR" | "VENICE_KEY_INVALID" | "VENICE_RATE_LIMITED" }
  504: { "error": "VENICE_TIMEOUT" }
  500: { "error": "INTERNAL_ERROR" }
```

### 14.5 Provider Dashboard
```
GET /api/provider/dashboard
Authorization: Bearer <wallet_signature>

Response 200:
{
  "walletAddress": "0x...",
  "pendingEarningsUsdc": 4.50,        // SUM(provider_amount_usdc) from completed transactions
  "totalEarnedUsdc": 12.30,           // all-time including claimed
  "listings": [
    {
      "listingId": "uuid",
      "delegationId": "string",
      "modelName": "llama-3.3-70b",
      "status": "active",
      "remainingCalls": 487,
      "totalCallsMade": 13,
      "pendingEarningsUsdc": 0.013,
      "maxInputChars": 2000,
      "maxCompletionTokens": 500,
      "pricePerCallUsdc": 0.001,
      "expiresAt": "2026-07-01T00:00:00Z"
    }
  ],
  "claimHistory": [
    {
      "amount": 8.00,
      "txHash": "0x...",
      "status": "completed",
      "createdAt": "2026-06-01T00:00:00Z"
    }
  ]
}
```

### 14.6 Provider Claim Earnings ✅
```
POST /api/provider/claim
Authorization: Bearer <wallet_signature>

Response 200:
{
  "claimId": "uuid",
  "amountUsdc": 4.50,
  "txHash": "0x...",
  "status": "completed"
}

Errors:
  400: { "error": "BELOW_MINIMUM_CLAIM" }    // < $0.001 USDC
  500: { "error": "CLAIM_FAILED" }
```

> **✅ Implementation status:** Claim endpoint at `app/api/escrow/claim/route.ts` enforces `$0.001` minimum via `BELOW_MINIMUM_CLAIM` error response. Implements nonce-based idempotency to prevent double-claims.

### 14.7 Provider Revoke Listing
```
POST /api/provider/listing/[listingId]/revoke
Authorization: Bearer <wallet_signature>

Response 200:
{
  "listingId": "uuid",
  "status": "revoked"
}

Errors:
  403: { "error": "NOT_YOUR_LISTING" }
  404: { "error": "LISTING_NOT_FOUND" }
  410: { "error": "ALREADY_REVOKED" }
```

### 14.8 Update Listing (PATCH) ✅
```
PATCH /api/listings/[id]
Authorization: Bearer <wallet_signature>
Content-Type: application/json

Request:
{
  "name": "string",
  "description": "string",
  "model_name": "string",
  "price_per_call_usdc": 0.001,
  "max_calls": 500,
  "max_input_chars": 2000,
  "max_completion_tokens": 500,
  "expires_at": "2026-07-01T00:00:00Z"
}

Response 200:
{
  "success": true,
  "listing": { ... }
}

Errors:
  400: { "error": "Validation failed" }
  403: { "error": "Forbidden: not listing owner" }
  404: { "error": "Listing not found" }
```

---

## 15. Blockchain & Smart Contract Spec

### Network
- **Network:** Base Sepolia Testnet ✅
- **Chain ID:** 84532 ✅
- **RPC:** `https://sepolia.base.org`

### Tokens
- **USDC (Base Sepolia):** `0x036CbD53842c5426634e7929541eC2318f3dCF7e` ✅

### MetaMask Smart Accounts Kit Usage
- Use `@metamask/delegation-toolkit` — do NOT deploy custom ERC-7710 contracts ✅
- Use existing Delegation Framework contracts deployed on Base Sepolia by MetaMask
- `toMetaMaskSmartAccount()` creates Smart Account for both provider and consumer

```typescript
import { Implementation, toMetaMaskSmartAccount } from '@metamask/delegation-toolkit'
import { createPublicClient, http } from 'viem'
import { baseSepolia } from 'viem/chains'

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http()
})

const smartAccount = await toMetaMaskSmartAccount({
  client: publicClient,
  implementation: Implementation.Hybrid,
  deployParams: [signerAddress, [], [], []],
  deploySalt: '0x',
  signer: { account: signerAccount }
})
```

### ERC-7710 Delegation Structure (via smart-accounts-kit) ✅
```typescript
import { toMetaMaskSmartAccount } from '@metamask/smart-accounts-kit'
import { createDelegation } from '@metamask/delegation-toolkit'
import { baseSepolia } from 'viem/chains'

// The delegation direction matches PRD spec: provider → QUOTRA_SERVER_ACCOUNT
const delegation = createDelegation({
  from: providerSmartAccount.address,          // delegator (provider)
  to: QUOTRA_SERVER_ACCOUNT_ADDRESS,           // delegatee (Quotra backend)
  caveats: [
    // Expiry only — call count enforced off-chain via Supabase
    { type: 'expiry', data: Math.floor(expiryTimestamp) }
  ]
})

const signedDelegation = await providerSmartAccount.signDelegation({ delegation })
```

> **✅ Implementation status:** `useDelegation.ts` provides `createProviderDelegation()` using smart-accounts-kit. Delegation direction: `from: providerSmartAccount → to: NEXT_PUBLIC_PAY_TO_ADDRESS`. Not yet submitted on-chain — integration with registration API (Phase 3).

### ERC-7715 Consumer Session Permission (via smart-accounts-kit) ✅
```typescript
import { requestExecutionPermissions } from '@metamask/smart-accounts-kit'

// smart-accounts-kit wrapper for wallet_grantPermissions (ERC-7715)
const permissions = await requestExecutionPermissions({
  chainId: 84532,                            // Base Sepolia
  address: QUOTRA_SERVER_ACCOUNT_ADDRESS,     // delegatee (Quotra backend)
  expiry: Math.floor(Date.now() / 1000) + 86400,  // 24h session
  signer: {
    type: 'account',
    data: { address: consumerWallet }
  },
  permissions: [{
    type: 'native-token-allowance',           // PRD said native-token-transfer
    data: { allowanceAmount: 0n }             // session auth only, not spending
  }]
})
```

> **✅ Implementation status:** `GrantPermissionButton.tsx` calls `requestExecutionPermissions` (smart-accounts-kit's ERC-7715 wrapper) with `native-token-allowance` / `allowanceAmount: 0n`. Permission proof sent to `/api/permissions` POST endpoint and stored in `consumer_permissions` table. JWT generation is pending (Phase 3).

### 1Shot API Integration
All on-chain transactions are submitted via 1Shot Relayer — neither provider nor consumer needs ETH. ✅

| Action | Who | Gas Payer |
|--------|-----|-----------|
| Submit signed ERC-7710 delegation | Provider | 1Shot (gas in USDC) |
| ERC-7715 permission grant | Consumer | 1Shot (gas in USDC) |
| x402 USDC payment to treasury | Consumer | 1Shot (gas in USDC) |
| Provider claim earnings | Provider | 1Shot (gas in USDC) |

### x402 Facilitator Integration
```typescript
import { facilitator } from '@coinbase/x402'

// In gateway: verify payment proof
const verifyResult = await facilitator.verify(
  paymentPayload,     // from X-PAYMENT / PAYMENT-SIGNATURE header
  paymentRequirements // from step 5 of gateway flow
)

if (!verifyResult.isValid) {
  return Response.json({ error: 'PAYMENT_PROOF_INVALID' }, { status: 402 })
}
```

### Treasury Address
- `QUOTRA_TREASURY_ADDRESS` — Quotra-controlled wallet on Base Sepolia
- All x402 payments settle here first
- Provider claim = USDC transfer from treasury to provider wallet
- Platform fee (10%) stays in treasury permanently

---

## 16. Payment & Settlement Model

### Overview
Quotra uses an **escrow treasury model**. All consumer payments flow to Quotra treasury first. Provider earnings accumulate in database. Provider claims earnings manually. ✅

```
Consumer pays $0.001 USDC
  → x402 settles to QUOTRA_TREASURY
  → DB: transaction.provider_amount_usdc += $0.0009 (90%)
  → DB: transaction.platform_amount_usdc += $0.0001 (10%)
  → DB: providers.pending_earnings_usdc += $0.0009

Provider claims:
  → Provider clicks "Claim" on dashboard
  → USDC transfer: QUOTRA_TREASURY → provider.wallet ($0.0009)
  → DB: providers.pending_earnings_usdc = 0
```

### Why Escrow Treasury (not direct split per call)
1. **Atomicity:** Payment to treasury is settled by x402 facilitator. Venice AI call happens after. If Venice AI fails, refund comes from treasury — no partial state.
2. **No per-call on-chain tx:** Eliminates latency and gas cost of splitting on-chain per request.
3. **Refund capability:** Treasury can refund consumer for failed Venice AI calls without requiring provider to return funds.
4. **Simplicity:** One treasury address, one settle target for x402.

### Refund Flow (Venice AI failure after payment)
```
1. Venice AI returns error (5xx, timeout, or invalid key)
2. Gateway: update transaction.status = 'refund_pending'
3. Gateway: rollback quota reservation (remaining_calls += 1)
4. Gateway: do NOT credit provider pending_earnings
5. Treasury: owes consumer full payment amount (recorded in transactions table)
6. Refund execution: background process or manual (post-hackathon automation)
   → For hackathon demo: refund triggered manually or via admin endpoint
```

### Provider Claim Rules
- Minimum claim: $0.001 USDC
- No maximum claim limit
- Gas for claim sponsored by 1Shot
- Claim is atomic: reads pending amount → executes transfer → resets to 0

### Revenue Split Summary ✅
| Recipient | Amount | Timing |
|-----------|--------|--------|
| Quotra treasury (10%) | $0.0001 per $0.001 call | Immediate (x402 settle) |
| Provider (90%) | $0.0009 per $0.001 call | Accumulated; claimed on demand |

---

## 17. Security Spec

### API Key Encryption ✅
```
Algorithm:   AES-256-GCM
Key source:  ENCRYPTION_KEY environment variable (Vercel) — never in DB
Per-key:     unique random IV generated per encryption operation

Storage in Supabase:
  listings.encrypted_key   → AES-256-GCM ciphertext (hex)
  listings.key_iv          → initialization vector (hex, 12 bytes)
  listings.key_auth_tag    → authentication tag (hex, 16 bytes)

Decrypt flow (server-side only, in Node.js API Route):
  1. Fetch ciphertext + IV + auth_tag from Supabase
  2. Load ENCRYPTION_KEY from process.env
  3. createDecipheriv('aes-256-gcm', key, iv)
  4. decipher.setAuthTag(auth_tag)
  5. Decrypt → raw Venice AI key string
  6. Use immediately in Venice AI Authorization header
  7. Minimize decrypted key lifetime — do not assign to outer scope variables
  8. Key is never: logged, returned in response, stored in DB, or sent to client
```

### Consumer Token (JWT) ✅
```
Algorithm: HS256
Secret:    JWT_SECRET (Vercel environment variable, min 32 chars)
Payload:
  {
    consumerWallet: "0x...",    // validated against request on every call
    delegationId: "string",     // validated against URL param
    permissionId: "uuid",       // checked against consumer_permissions table
    iat: unix_timestamp,
    exp: unix_timestamp + 86400 // 24h
  }
Validation order: signature → expiry → permissionId active in DB → wallet match
```

> **✅ Implementation status:** `JWT_EXPIRY` constant in `src/lib/jwt.ts` set to `"24h"`. HS256 signing with `JWT_SECRET` env var. All gateway routes validate JWT before processing. The `/api/permissions` endpoint stores the permission proof in `consumer_permissions` but does not yet issue a JWT — that will be added in Phase 3.

### Replay Attack Prevention ✅
```
Every processed payment has its tx_hash stored in transactions table.
UNIQUE CONSTRAINT on transactions.payment_tx_hash.

Flow:
  1. Extract tx_hash from verified x402 payment proof
  2. INSERT INTO transactions (payment_tx_hash, status='pending', ...)
  3. If INSERT throws unique_violation → 402 PAYMENT_ALREADY_USED
  4. If INSERT succeeds → proceed to quota reservation + Venice AI call

This guarantees one payment proof = one API call. No reuse possible.
```

### Input Validation Rules ✅
| Field | Rule |
|-------|------|
| `pricePerCallUsdc` | numeric, min 0.0001, max 1.00 |
| `maxCalls` | integer, min 10, max 100000 |
| `maxInputChars` | integer, min 100, max 8000 |
| `maxCompletionTokens` | integer, min 50, max 2000 |
| `expiryDays` | enum: 7, 14, 30, 90 |
| `messages` | array, min 1 item, max 50 items |
| `messages[].content` | non-empty string, sum of all ≤ listing.max_input_chars |
| `max_tokens` (request) | integer, max = listing.max_completion_tokens |
| `walletAddress` | valid EVM address, checksum validated |
| `temperature` | float, 0.0–2.0 |

### Venice AI Key Protection — Absolute Rules
- **NEVER** log Venice AI key at any log level (info, debug, error)
- **NEVER** return Venice AI key in any API response or error message
- **NEVER** store Venice AI key in plaintext (DB, file, environment variable)
- **NEVER** expose Venice AI key in frontend bundle, client-side code, or browser devtools
- **NEVER** pass Venice AI key through Redis, message queue, or any persistence layer
- Encryption happens in the same API Route that receives the key — no transport in plaintext

### Rate Limiting
- Per `delegationId`: max 10 requests/second (prevents quota draining)
- Per `consumerWallet`: max 100 requests/minute
- Implemented via Vercel middleware or simple in-memory counter

---

## 18. Business Model & Revenue

### Revenue Stream
**Platform fee: 10% of every consumer payment, accumulated in treasury**

```
Consumer pays: $0.001 USDC
→ QUOTRA_TREASURY receives: $0.001 USDC (full amount via x402)
→ Provider pending: +$0.0009 (90%) — claimed on demand
→ Platform keeps: $0.0001 (10%) — stays in treasury after provider claims
```

### Revenue Projections (Illustrative)
| Daily Calls | Avg Price/Call | Daily Platform Revenue |
|-------------|---------------|----------------------|
| 1,000 | $0.001 | $0.10 |
| 10,000 | $0.001 | $1.00 |
| 100,000 | $0.001 | $10.00 |

### Provider Economics Example
Rina (Venice AI Pro+, $68/month, 7,500 credits):
- Lists 5,000 credits as quota on Quotra at $0.001/call
- If fully consumed: 5,000 × $0.0009 = **$4.50 USDC earned**
- Net cost of subscription effectively reduced: $68 - $4.50 = $63.50

### Provider Pricing Freedom
- Providers set their own `price_per_call_usdc`
- Marketplace competition drives toward efficient equilibrium
- Differentiation: model quality, price, remaining calls, max context (max_input_chars)

---

## 19. Edge Cases & Error Handling

### Listing State Errors
| Scenario | Detection | Response |
|---------|-----------|----------|
| Listing not found | No row in DB | 404 `LISTING_NOT_FOUND` |
| Listing expired | `expires_at < now()` in DB | 410 `LISTING_EXPIRED` — auto-set status='expired' |
| Listing revoked | `status = 'revoked'` | 410 `LISTING_REVOKED` |
| No calls remaining | `remaining_calls <= 0` | 410 `NO_CALLS_REMAINING` |

### Auth & Permission Errors
| Scenario | Detection | Response |
|---------|-----------|----------|
| JWT invalid | HS256 verify fail | 401 `INVALID_TOKEN` |
| JWT expired | `exp < now()` | 401 `TOKEN_EXPIRED` |
| JWT wallet mismatch | JWT wallet ≠ request wallet | 401 `WALLET_MISMATCH` |
| Consumer permission expired | `consumer_permissions.expires_at < now()` | 401 `PERMISSION_EXPIRED` |
| Consumer permission revoked | `consumer_permissions.status = 'revoked'` | 401 `PERMISSION_REVOKED` |
| Permission not found | No active row in consumer_permissions | 401 `PERMISSION_NOT_FOUND` |

### Request Validation Errors
| Scenario | Detection | Response |
|---------|-----------|----------|
| Input too long | Sum of chars > max_input_chars | 400 `REQUEST_TOO_LARGE` with detail |
| Too many tokens requested | max_tokens > listing.max_completion_tokens | 400 `REQUEST_TOO_LARGE` with detail |
| Empty messages | messages array empty | 400 `INVALID_REQUEST` |
| Too many messages | messages.length > 50 | 400 `INVALID_REQUEST` |

### Payment Errors
| Scenario | Detection | Response |
|---------|-----------|----------|
| No payment header | No X-PAYMENT on second request | 402 Payment Required (normal x402 flow) |
| Payment proof invalid | Coinbase facilitator verify returns isValid=false | 402 `PAYMENT_PROOF_INVALID` |
| Payment timeout | No payment within 60s | 402 `PAYMENT_TIMEOUT` |
| Replay attack | Duplicate tx_hash insert fails | 402 `PAYMENT_ALREADY_USED` |
| Wrong payment amount | Proof amount < required | 402 `PAYMENT_AMOUNT_MISMATCH` |
| Wrong payTo address | Proof payTo ≠ treasury | 402 `PAYMENT_WRONG_RECIPIENT` |

### Venice AI Errors (all trigger quota rollback + refund_pending)
| Scenario | Detection | Response |
|---------|-----------|----------|
| Venice AI key invalid | 401 from Venice | 502 `VENICE_KEY_INVALID` + mark listing status='error' |
| Venice AI rate limited | 429 from Venice | 503 `VENICE_RATE_LIMITED` — retry once after 1s |
| Venice AI timeout | No response in 30s | 504 `VENICE_TIMEOUT` |
| Venice AI server error | 5xx from Venice | 502 `VENICE_AI_ERROR` |

### Atomicity — Venice AI Failure After Payment
```
When Venice AI fails AFTER payment has been verified:
  1. transaction.status = 'refund_pending'          // flag for refund
  2. listings.remaining_calls += 1                  // rollback quota reservation
  3. providers.pending_earnings NOT credited         // provider does not earn
  4. consumer.wallet owes refund from treasury      // treasury owes full amount
  5. Return 502/504 to consumer                     // with message: "Payment will be refunded"

Refund execution (hackathon: manual/admin endpoint):
  POST /api/admin/process-refunds
  → Find all transactions where status = 'refund_pending'
  → Execute USDC transfer: treasury → consumer.wallet for each
  → Update transaction.status = 'refunded'
```

### Race Condition — Concurrent Calls
```
Problem: 50 concurrent requests, all read remaining_calls=10, all pass validation
Solution: Atomic SQL with WHERE remaining_calls > 0 + RETURNING

Only the rows successfully decremented proceed. Others get empty RETURNING
→ reject with NO_CALLS_REMAINING

No row locks needed — PostgreSQL UPDATE with conditional WHERE is atomic.
```

### Provider Registration Edge Cases
| Scenario | Handling |
|---------|---------|
| Provider registers same key twice | Allowed — different listingId, independent quota |
| Max calls set to 0 | Form validation reject: minimum 10 |
| Expiry set less than 7 days | Form validation reject: minimum 7 days |
| ERC-7710 delegation submit fails | 500 `DELEGATION_SUBMIT_FAILED` — key not stored |
| Invalid Venice AI key format | 400 `INVALID_KEY` — basic format validation before storage |

### Provider Claim Edge Cases
| Scenario | Handling |
|---------|---------|
| Claim amount < $0.001 | 400 `BELOW_MINIMUM_CLAIM` |
| Treasury has insufficient USDC | 500 `CLAIM_FAILED` — alert operator |
| 1Shot Relayer fails | 500 `CLAIM_FAILED` — retry manually via dashboard |

---

## 20. UI/UX Requirements

### Pages & Routes
| Route | Description | Auth Required |
|-------|-------------|--------------|
| `/` | Landing page — hero, tagline, CTA | No |
| `/marketplace` | Browse all active listings | No (connect to use) |
| `/marketplace/[delegationId]` | Listing detail + permission request | Yes (consumer) |
| `/dashboard` | Provider earnings + listings management | Yes (provider) |
| `/dashboard/new` | Create new listing form | Yes (provider) |
| `/docs` | API usage docs, request/response examples | No |

### Key UI Components
- **Wallet Connect Button** — MetaMask Smart Account connection (Wagmi)
- **Listing Card** — model badge, price/call, remaining calls progress bar (X of Y), max context info, expiry countdown
- **Provider Registration Form** — step-by-step wizard UI (Auth → Register → Delegation → Create Listing) with visual step indicator ✅
- **Marketplace View** — toggle between grid and list views, full-text client-side search across name, description, model, and provider ✅
- **Consumer Token Modal** — displays endpoint URL + JWT token, copy buttons, expiry info
- **Earnings Panel** — pending USDC amount + "Claim" button
- **Transaction History Table** — timestamp, amount, model, status (consumer + provider views)
- **Revoke Confirmation Dialog** — clear warning that revoke affects all active consumers

### Design Principles
- Marketplace browsable without wallet — lower barrier to discovery
- Wallet connect only when action requires it (create listing, request permission, claim)
- Error states must be human-readable — no raw error codes or contract revert strings
- ETH-free UX — never show "you need ETH" message anywhere
- Mobile-responsive — consumer use case common on mobile

### Error Message Examples (UI Copy)
| Error Code | UI Message |
|-----------|-----------|
| `TOKEN_EXPIRED` | "Your session has expired. Please reconnect to this provider." |
| `NO_CALLS_REMAINING` | "This provider has used up all available calls. Try another provider." |
| `LISTING_REVOKED` | "This provider listing is no longer available." |
| `REQUEST_TOO_LARGE` | "Your message is too long for this provider. Max: 2,000 characters." |
| `VENICE_AI_ERROR` | "The AI model returned an error. Your payment will be refunded." |
| `PAYMENT_PROOF_INVALID` | "Payment could not be verified. Please try again." |

---

## 21. Out of Scope (Post-Hackathon)

| Feature | Reason Deferred |
|---------|----------------|
| Provider/consumer rating & review system | Requires review infra, reputation system |
| On-chain revocation via ERC-7710 | Soft delete in Supabase sufficient for demo |
| Per-token pricing model | More complex, flat per-call sufficient for PoC |
| Automated batch settlement cron | Manual claim sufficient for hackathon |
| Mainnet deployment | Risk mitigation — testnet only for hackathon |
| Non-Venice AI providers (OpenAI, Anthropic) | Potential ToS risk |
| Streaming responses (SSE) | Complex interaction with x402 per-call model |
| Pre-funded consumer deposit | Pure per-call simpler for MVP |
| Mobile app | Time constraint |
| Advanced provider analytics | Basic earnings view sufficient |
| Multi-chain support | Base Sepolia only |
| DAO governance for fee | Post product-market-fit |
| Provider key update without relisting | Provider creates new listing instead |
| Automated refund processing | Manual admin endpoint for hackathon |
| Listing health check / Venice key pre-validation | Manual revoke if key invalid |

---

## 22. Submission Checklist

### Technical Requirements
- [ ] MetaMask Smart Accounts Kit integrated (core — ERC-7710 + ERC-7715)
- [ ] ERC-7710 delegation signing in provider registration flow
- [ ] ERC-7715 session permission in consumer permission flow
- [ ] Viem used for all contract interaction
- [ ] x402 payment flow working end-to-end
- [ ] Coinbase x402 Facilitator used for payment verification
- [ ] 1Shot Relayer integrated (provider + consumer ETH-free)
- [ ] Venice AI API integrated as model backend
- [ ] Base Sepolia Testnet live deployment
- [ ] Supabase schema deployed with all 6 tables
- [ ] UNIQUE constraint on `transactions.payment_tx_hash` (replay protection)
- [ ] Atomic quota reservation SQL implemented
- [ ] AES-256-GCM encryption for Venice AI keys
- [ ] Escrow treasury model working (payments to treasury, provider claim)
- [ ] Node.js runtime on gateway API routes (not Edge)

### Demo Script (End-to-End)
1. Connect MetaMask Smart Account as Provider
2. Register Venice AI key → set price, limits, expiry → sign ERC-7710 delegation
3. Listing appears on marketplace
4. Connect different MetaMask Smart Account as Consumer
5. Browse marketplace → select listing
6. Approve ERC-7715 session permission → receive JWT + endpoint
7. Make API call (no payment header) → receive 402 + payment requirements
8. Consumer wallet pays USDC to treasury (via 1Shot)
9. Retry with payment proof → receive LLM response (200 OK)
10. Dashboard: Provider sees pending earnings
11. Provider clicks "Claim" → USDC arrives in provider wallet

### Submission Artifacts
- [ ] GitHub repository — public, clear README with setup instructions
- [ ] Live Vercel deployment URL
- [ ] Demo video (max 3 minutes, covers demo script above)
- [ ] Project description: one-liner, problem, solution, tech stack used
- [ ] Track declaration: **Best Use of x402 + ERC-7710**

---

*Document maintained by: Ale | Quotra PRD v2.0 | Hackathon submission target: 15 June 2026*
