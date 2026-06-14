# Quotra — Product Requirements Document (PRD)
> Version: 2.2.0 | Last Updated: June 2026 | Status: Active Development
> 
> **Changelog v2.0:** Fixed payment atomicity contradiction, added escrow treasury model, added request hard limits to prevent per-call pricing exploit, replaced per-call on-chain split with provider manual claim, clarified ERC-7710 vs Supabase responsibility boundary, clarified ERC-7715 role as session auth only, added consumer_permissions to gateway validation, added replay attack protection, fixed race condition with pre-call reservation model, added revoke delegation flow, clarified Vercel runtime separation, updated wording (ETH-free not gasless, OpenAI-inspired not OpenAI-compatible).
> 
> **Changelog v2.1:** Auth layer restructured — JWT retained for API route authentication (wallet sign-in → nonce → signature → JWT). Custom `withAuth`/`chain.ts` middleware deleted and replaced by `createRouteClient()` utility. `@x402/next` SDK handles payment intercept + verification. Provider and consumer permissions use ERC-7710/ERC-7715/ERC-7702 via `@metamask/smart-accounts-kit`. ~800 lines of custom auth/middleware cleaned up.

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
**Target Tracks:** Best Use of x402 + ERC-7710, Best 1Shot API Project
**Submission Deadline:** 15 June 2026

### What is Quotra?
Quotra is a decentralized, peer-to-peer AI API marketplace. Users who hold active subscriptions to premium AI providers (OpenAI, Anthropic, Gemini) can monetize their idle quota by listing it on Quotra. Other users can consume LLM API access by paying USDC per call — without needing a credit card, without subscriptions, and without commitment.

The core innovation is the combination of:
- **ERC-7710 delegation** — on-chain authorization layer for providers to cryptographically grant quota access
- **x402 micropayments** — HTTP-native USDC payment per API call, settled to Quotra treasury (escrow)
- **MetaMask Smart Accounts** — ETH-free UX for all users via 1Shot Relayer
- **Premium AI Providers** — OpenAI, Anthropic, and Gemini as the anchor LLM backends
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

### Pain Point 2: Idle AI Subscription Waste & Strict Credit Card Barriers
Users who subscribe to premium AI services like OpenAI, Anthropic, or Gemini often do not fully utilize their monthly credit allocation or usage limits. This results in wasted spend. Moreover, these top-tier platforms strictly require credit card billing to obtain an API key, which blocks many users in emerging markets from accessing their powerful capabilities directly.

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
- Sub-500ms gateway overhead (excluding AI Provider latency)

---

## 4. Target Market & User Personas

### Persona 1: Adit — The Consumer
- **Who:** Computer science student, Indonesia, 20 years old
- **Problem:** Wants to build an AI chatbot for a class project, cannot set up OpenAI billing without a credit card
- **Behavior:** Has MetaMask, holds some USDC from previous crypto activities
- **Goal:** Access LLM API per-call, spend only what he needs, no subscription

### Persona 2: Rina — The Provider
- **Who:** Freelance developer, Jakarta, 27 years old
- **Problem:** Subscribed to OpenAI and Anthropic premium tiers but only uses ~30% of her monthly limits
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
4. **Permissionless listing** — any AI Provider subscriber can become a provider instantly

---

## 6. Product Scope

### In Scope (MVP — Hackathon)
- Provider onboarding: connect wallet, register API keys (OpenAI, Anthropic, Gemini), set delegation rules, list quota
- Consumer marketplace: browse providers, filter by model, view price/call and remaining quota
- ERC-7710 delegation signing via MetaMask Smart Accounts Kit
- ERC-7715 consumer session permission grant
- x402 payment flow per API call → settles to Quotra treasury
- Next.js API Gateway: validate session → check quota → intercept payment → forward to AI provider → return response
- Treasury escrow: all payments accumulate in treasury, provider claims manually
- Delegation state tracking in Supabase (off-chain quota enforcement)
- Multi-key support: one provider can list multiple API keys/models independently
- OpenAI-inspired request/response format (partial compatibility)
- Stateless multi-turn chat (consumer manages message history)
- Request hard limits: `max_input_chars` + `max_completion_tokens` per listing
- Replay attack protection via unique payment tx hash
- Base Sepolia Testnet deployment

### Out of Scope (Post-Hackathon)
- Provider/consumer rating & review system
- Mainnet deployment
- Support for open-source or non-premium model providers
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
| P2 | As a provider, I want to input my AI Provider API key securely so it is never exposed to anyone | Must Have |
| P3 | As a provider, I want to set price per call, max calls, max input chars, max completion tokens, and expiry | Must Have |
| P4 | As a provider, I want to list multiple AI Provider keys for different models independently | Must Have |
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

## 8. Auth Layer Architecture

Quotra has 3 auth layers. Each layer has a distinct, non-overlapping responsibility.

| Layer | Technology | Responsibility | When Used |
|-------|-----------|---------------|-----------|
| **Identity** | Wallet address | Who you are | Connect, all authenticated actions |
| **Session** | JWT (HS256, 24h expiry) | Authenticated session after wallet sign-in | All API routes (providers, escrow, consumer) |
| **Payment** | x402 USDC (ERC-7710) | Pay + authenticate every API call | POST /api/v1/[listingId]/chat |

### Wallet Sign-In Flow
1. User connects MetaMask wallet → gets address
2. Frontend calls `POST /api/auth/nonce` with wallet address → receives signable message
3. User signs message in MetaMask (EIP-4361 style)
4. Frontend calls `POST /api/auth/login` with address + signature → receives JWT (24h expiry)
5. JWT stored in memory, sent as `Authorization: Bearer <jwt>` on all subsequent requests
6. Server validates JWT via `createRouteClient()` — extracts wallet address, gates API access

### What Each Layer Does NOT Do
- JWT does NOT handle payment — that is x402
- ERC-7715 does NOT replace JWT — it is for session permissions (consumer grant to use a listing)
- x402 does NOT authenticate identity — wallet address from payment proof does

### ERC-7715 Supplementary Role
In addition to JWT, ERC-7715 execution permissions are used for:
- **Provider listing creation**: `erc20-token-periodic` permission for 1Shot Relayer fee allowance (1 USDC/day, 90 days)
- **Consumer session auth**: `native-token-allowance` (0 value, 7 day expiry) to create ephemeral session key for x402 payment flow
- These are stored in `consumer_permissions` table alongside JWT-based wallet identity

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
   - API key (OpenAI/Anthropic/Gemini) (plaintext input, encrypted server-side before storage)
   - Model name (selected from supported model list for the chosen provider)
   - Price per call in USDC (minimum: $0.0001, maximum: $1.00)
   - Max total calls (minimum: 10, maximum: 100,000)
   - Max input chars per request (minimum: 100, maximum: 8,000, default: 2,000)
   - Max completion tokens per request (minimum: 50, maximum: 2,000, default: 500)
   - Expiry duration (options: 7 / 14 / 30 / 90 days)
3. Frontend requests execution permissions via ERC-7715 (`wallet_requestExecutionPermissions` via MetaMask Smart Accounts Kit).
   - Permission requested is `erc20-token-periodic` for USDC to allow the 1Shot Relayer to pull fees for gas abstraction.
4. Provider approves the permission grant in MetaMask.
5. Frontend receives `permissionsContext` and `delegationManager` from MetaMask.
6. Frontend sends form data + permission objects to `/api/providers/listings`.
7. Server-side: encrypt API key using AES-256-GCM → store ciphertext + IV + auth_tag in Supabase.
8. Server stores: `listingId`, `delegationId` (context hash), `permissions_context`, `delegation_manager`, encrypted key → Supabase.
9. Public endpoint auto-generated: `POST /api/v1/[delegationId]/chat`
10. Listing appears in marketplace

> **✅ Implementation status:** `useDelegation.ts` implemented using native ERC-7715 `wallet_requestExecutionPermissions` (`erc7715ProviderActions`) instead of legacy `erc7715Actions`. Permission payload uses `erc20-token-periodic`. Database modified to drop `signed_delegation` constraint and use `permissions_context` and `delegation_manager`.

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

### 9.5 Consumer Permission Flow (ERC-7715 Session Auth) ✅ (Simplified v2.1)
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
8. Server upserts row into `consumer_permissions` table (status: active, expires_at: 24h) ✅
9. Consumer receives: endpoint URL for this listing
10. Consumer calls endpoint using `x402Fetch()` — no JWT/Bearer token needed

> **JWT removed in v2.1.** Consumer auth is now purely x402 + ERC-7715. `@x402/next` SDK handles payment intercept + verification natively. Consumers use `x402Fetch()` which auto-handles the 402 → pay → retry flow.

> **✅ Implementation status:** `GrantPermissionButton.tsx` uses `requestExecutionPermissions` with `native-token-allowance` / `allowanceAmount: 0n`. Permission stored in `consumer_permissions`. No JWT needed.

### 9.6 API Gateway Flow (Core — Revised for Atomicity)

**Endpoint:** `POST /api/v1/[delegationId]/chat`

**Critical design:** Payment settles to Quotra treasury first. Provider earnings accumulate in DB. No on-chain write in the critical path after payment verification.

**Step-by-step:**

```
Step 1: x402 Payment Intercept (handled by @x402/next withX402 wrapper)
  - Consumer calls endpoint via x402Fetch()
  - withX402 intercepts: no X-PAYMENT header → returns 402 + payment requirements
  - Consumer wallet pays USDC to QUOTRA_TREASURY via 1Shot Relayer
  - x402Fetch() auto-retries with payment proof
  - withX402 verifies proof via MetaMask x402 Facilitator (HTTP)
  - withX402 prevents replay (unique tx_hash insert)
  - withX402 inserts transaction row (status = 'pending')
  → Fail: 402 PAYMENT_PROOF_INVALID / PAYMENT_ALREADY_USED

Step 2: Listing Validation (listings table)
  - Query listing by delegationId
  - Check: status = 'active'
  - Check: expires_at > now()
  - Check: remaining_calls > 0
  → Fail: 404 LISTING_NOT_FOUND / 410 LISTING_EXPIRED / 410 NO_CALLS_REMAINING

Step 3: Request Validation (hard limits)
  - Count total chars in all message content combined
  - Check: total_input_chars <= listing.max_input_chars
  - Check: requested max_tokens <= listing.max_completion_tokens
  → Fail: 400 REQUEST_TOO_LARGE

Step 4: Quota Reservation (pre-call decrement)
  - Atomic SQL:
    UPDATE listings
    SET remaining_calls = remaining_calls - 1
    WHERE delegation_id = $1 AND remaining_calls > 0
    RETURNING remaining_calls
  - If RETURNING is empty → 410 NO_CALLS_REMAINING
    (rollback: update transaction status to 'refund_pending')

Step 5: AI Provider Call
  - Fetch ciphertext + IV + auth_tag from Supabase
  - Decrypt API key in-memory (AES-256-GCM)
  - Build provider request (format based on chosen model)
  - POST to chosen AI API with decrypted key in header
  - Minimize decrypted key lifetime in application scope — do not persist
  - Timeout: 30 seconds

Step 6a: AI Provider SUCCESS
  - Update transaction: status = 'completed', provider_pending_usdc = price * 0.90
  - Accumulate earnings: UPDATE listings SET total_calls_made = total_calls_made + 1
  - Accumulate provider earnings: UPDATE providers SET pending_earnings_usdc = pending_earnings_usdc + (price * 0.90)
  - Return AI response to consumer (200 OK)

Step 6b: AI Provider FAILURE
  - Update transaction: status = 'refund_pending'
  - Rollback quota reservation: remaining_calls += 1
  - Do NOT credit provider earnings
  - Trigger refund flow: treasury owes consumer full payment amount
  - Return 502 AI_PROVIDER_ERROR to consumer
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
- Each listing = one API key (OpenAI/Anthropic/Gemini) + one delegation + independent settings
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

### 9.11 Playground (Free Trial) ✅
- Independent free trial interface allowing consumers to test a listing's model directly in the browser without payment.
- **Quota Limit**: Maximum of 3 free calls per wallet per listing.
- **No Permissions**: Does not require ERC-7715 permission or x402 payment.
- **Streaming UI**: Uses Vercel AI SDK to stream text generation incrementally to the UI for immediate feedback.
- **Markdown Rendering**: Render responses as compiled GitHub Flavored Markdown (tables, lists, formatting).

---

## 10. Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| **Performance** | Gateway overhead ≤ 500ms (excluding x402 verify + AI Provider latency) |
| **Availability** | Vercel deployment — 99.9% uptime SLA |
| **Security** | AI Provider keys: never logged, never stored plaintext, never returned in any response |
| **Scalability** | Stateless gateway — horizontally scalable on Vercel serverless |
| **Format** | OpenAI-inspired request/response format (partial compatibility) |
| **Network** | Base Sepolia Testnet (chainId: 84532) |
| **Payment Token** | USDC on Base Sepolia: `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| **Vercel Runtime** | Gateway API routes: Node.js runtime (NOT Edge) — required for crypto operations and blockchain reads |

### Vercel Runtime Separation
```
Frontend pages     → Edge Runtime (fast, global CDN)
/api/marketplace   → Edge Runtime (read-only DB query)
/api/v1/[id]/chat  → Node.js Runtime (x402 verify, AES decrypt, AI Provider call)
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
│  │  MetaMask x402 Facilitator    ←→  Payment verify/settle         │  │
│  │  AI Provider API                ←→  LLM inference (text)         │  │
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
  → server: AES-256-GCM encrypt AI Provider key
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
  → x402Fetch(POST /api/v1/[delegationId]/chat)  // @x402/next wraps fetch
  → gateway (withX402): intercepts → returns 402 + payment requirements
  → consumer wallet: pay USDC to QUOTRA_TREASURY via 1Shot
  → x402Fetch(): auto-retries with X-PAYMENT header
  → gateway (withX402): verifies payment via MetaMask x402 Facilitator
  → gateway (withX402): prevents replay (unique tx_hash insert)
  → gateway: check listing → validate request limits → reserve quota
  → gateway: decrypt AI Provider key → forward request → get response
  → gateway: update transaction (completed) + provider pending earnings
  → consumer: receives LLM response (200 OK)
```

---

## 12. Tech Stack

| Technology | Role | Notes |
|-----------|------|-------|
| **Next.js 16** (App Router) | Frontend + API Gateway | Single repo, TypeScript, Vercel deployment ✅ |
| **TypeScript** | All codebase | Strict mode ✅ |
| **Tailwind CSS v4** | Styling | Utility-first ✅ |
| **shadcn/ui + Radix UI** | UI Components | Accessible, composable ✅ |
| **@metamask/smart-accounts-kit** (`^1.6.0`) | ERC-7702 smart accounts + ERC-7710 delegation + ERC-7715 permission | Replaces deprecated `@metamask/delegation-toolkit` ✅ |
| **Viem** (`^2.51.2`) | Contract reads/writes, EIP-712 signing, chain interaction | TypeScript-native ✅ |
| **Wagmi** (`^3.6.16`) | React hooks for wallet state | Built on Viem ✅ |
| **ERC-7710** | On-chain delegation (authorization layer) | Treasury signs delegation for 1Shot relayer claims |
| **ERC-7715** | Consumer + provider permission grants | One-time per listing per user |
| **ERC-7702** | EOA-to-smart-account upgrade | Stateless7702 implementation via smart-accounts-kit |
| **x402 Protocol** (`@x402/next`, `@x402/core`) | HTTP-native per-call USDC payment | Intercept in Next.js API Route via `withX402` wrapper and `HTTPFacilitatorClient` ✅ |
| **1Shot Permissionless Relayer** | ETH-free tx relay via JSON-RPC | Provider claims via `relayer_send7710Transaction` ✅ |
| **Supabase** | PostgreSQL database | RLS enabled, all quota tracking ✅ |
| **Vercel** | Deployment | Node.js runtime for API routes ✅ |
| **Base Sepolia** | Blockchain network | chainId: 84532 ✅ |
| **USDC (Base Sepolia)** | Payment token | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` ✅ |

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
  name                  TEXT NOT NULL,
  permissions_context   JSONB,                      -- ERC-7715 context object
  delegation_manager    TEXT,                       -- ERC-7715 manager address
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

### Table: `playground_trials`
```sql
CREATE TABLE playground_trials (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address  TEXT NOT NULL,
  listing_id      UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  calls_count     INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(wallet_address, listing_id)
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
  prompt_tokens         INTEGER,                  -- from AI Provider response
  completion_tokens     INTEGER,                  -- from AI Provider response
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
  task_id         TEXT,                   -- 1Shot relayer task ID (from relayer_send7710Transaction)
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
CREATE INDEX idx_playground_trials_wallet_listing ON playground_trials(wallet_address, listing_id);
```

### Critical SQL: Atomic Quota Reservation
```sql
-- Reserve a call slot before AI Provider call (prevents race condition)
-- Returns empty if no calls remaining
UPDATE listings
SET remaining_calls = remaining_calls - 1
WHERE delegation_id = $1
  AND remaining_calls > 0
  AND status = 'active'
  AND expires_at > now()
RETURNING id, remaining_calls;

-- Rollback if AI Provider fails
UPDATE listings
SET remaining_calls = remaining_calls + 1
WHERE delegation_id = $1;
```

---

## 14. API Specification

### 14.1 Provider Registration & Listing Creation
```
POST /api/providers             (register provider wallet)
POST /api/providers/listings    (create listing)
Content-Type: application/json

Request:
{
  "walletAddress": "0x...",
  "apiKey": "string",                   // plaintext, AES-encrypted server-side immediately
  "modelName": "gemini-2.0-flash",
  "pricePerCallUsdc": 0.001,            // min: 0.0001, max: 1.00
  "maxCalls": 500,                       // min: 10, max: 100000
  "maxInputChars": 2000,                // min: 100, max: 8000
  "maxCompletionTokens": 500,           // min: 50, max: 2000
  "expiryDays": 30,                     // allowed: 7, 14, 30, 90
  "delegationId": "string",             // ERC-7715 context hash
  "permissionsContext": { ... },        // ERC-7715 granted permissions object
  "delegationManager": "0x..."          // ERC-7715 delegation manager
}

Response 201:
{
  "listingId": "uuid",
  "delegationId": "string",
  "taskId": "string",            -- 1Shot relayer task ID for delegation submission
  "endpoint": "https://quotra.app/api/v1/{delegationId}/chat",
  "expiresAt": "2026-07-01T00:00:00Z"
}

Errors:
  400: { "error": "INVALID_MODEL" | "INVALID_PRICE" | "INVALID_KEY" | "INVALID_PARAMS" }
  500: { "error": "DELEGATION_SUBMIT_FAILED" | "ENCRYPTION_FAILED" }
```

### 14.2 Marketplace Listings
```
GET /api/listings?model=&maxPrice=&sort=

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
POST /api/permissions           (grant permission)
POST /api/permissions/[listingId] (check permission)
Content-Type: application/json

Request:
{
  "walletAddress": "0x...",
  "delegationId": "string",
  "erc7715Proof": "string"         // raw ERC-7715 proof from wallet_grantPermissions
}

Response 200:
{
  "endpoint": "https://quotra.app/api/v1/{delegationId}/chat",
  "permissionId": "uuid",
  "expiresAt": "2026-06-16T00:00:00Z"
}

// JWT removed in v2.1. Consumers use x402Fetch() — no Bearer token needed.

Errors:
  400: { "error": "INVALID_PROOF" }
  404: { "error": "LISTING_NOT_FOUND" }
  410: { "error": "LISTING_EXPIRED" | "LISTING_REVOKED" | "NO_CALLS_REMAINING" }
```

### 14.4 LLM API Gateway (Core Endpoint) ✅ (Simplified v2.1)
```
POST /api/v1/[listingId]/chat
Content-Type: application/json

// No Authorization header. JWT removed in v2.1.
// Payment is handled by @x402/next withX402 wrapper (402 intercept → pay → retry).
// Consumer uses x402Fetch() which auto-handles the full flow.

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

First response (no payment — @x402/next intercepts automatically):
  HTTP 402 Payment Required
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

Second response (with X-PAYMENT — @x402/next verifies and retries):
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
  402: { "error": "PAYMENT_PROOF_INVALID" | "PAYMENT_ALREADY_USED" }
  404: { "error": "LISTING_NOT_FOUND" }
  410: { "error": "LISTING_EXPIRED" | "LISTING_REVOKED" | "NO_CALLS_REMAINING" }
  502: { "error": "VENICE_AI_ERROR" | "VENICE_KEY_INVALID" | "VENICE_RATE_LIMITED" }
  504: { "error": "VENICE_TIMEOUT" }
  500: { "error": "INTERNAL_ERROR" }
```

### 14.5 Provider Dashboard
```
GET /api/providers/dashboard
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
POST /api/escrow/claim
Authorization: Bearer <wallet_signature>

Response 200:
{
  "claimId": "uuid",
  "amountUsdc": 4.50,
  "taskId": "...",              -- 1Shot relayer task ID (tx_hash set later by webhook)
  "status": "submitted"         -- pending webhook confirmation from 1Shot
}

Errors:
  400: { "error": "BELOW_MINIMUM_CLAIM" }    // < $0.001 USDC
  500: { "error": "CLAIM_FAILED" }
```

> **✅ Implementation status:** Claim endpoint at `app/api/escrow/claim/route.ts` enforces `$0.001` minimum via `BELOW_MINIMUM_CLAIM` error response. Implements nonce-based idempotency to prevent double-claims.

### 14.7 Provider Revoke Listing
```
POST /api/escrow/revoke           (revoke via escrow)
DELETE /api/listings/[id]          (soft-delete via status='revoked')
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
PATCH /api/providers/listings/[listingId]
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

### 14.9 Playground Chat (Free Trial) ✅
```
POST /api/playground/chat
Content-Type: application/json

Request Body:
{
  "messages": [{ "role": "user", "content": "string" }],
  "listingId": "string",
  "walletAddress": "0x..."
}

Validation:
  - Check trial usage (max 3 calls per wallet per listing)
  - Verify listing exists and is active

Response 200:
  Streamed text response chunks (text/plain or Vercel AI SDK stream format).

Errors:
  400: { "error": "Missing required fields" }
  403: { "error": "Trial limit reached for this listing" }
  404: { "error": "Listing not found" }
```

### 14.10 Claim History
```
GET /api/escrow/claim
Authorization: Bearer <wallet_signature>

Query params:
  providerId  (optional) filter by provider
  status      (optional) filter by status: pending | completed | failed

Response 200:
{
  "claims": [
    {
      "id": "uuid",
      "providerId": "uuid",
      "amountUsdc": 4.50,
      "taskId": "...",
      "txHash": "0x...",             -- null until webhook confirms on-chain settlement
      "status": "submitted",         -- submitted | completed | failed
      "createdAt": "2026-06-01T00:00:00Z"
    }
  ]
}

Errors:
  401: { "error": "UNAUTHORIZED" }
```

### 14.11 Relayer Webhook
```
POST /api/webhooks/relayer
Content-Type: application/json

Receives status updates from 1Shot Relayer for submitted tasks.
Updates claim_history and transaction records with on-chain tx hashes.

Request:
{
  "taskId": "string",               -- matches the task_id from claim/transaction
  "status": "completed | failed",
  "txHash": "0x...",                -- on-chain transaction hash (present when completed)
  "error": "string"                 -- error detail (present when failed)
}

On receive:
  - Look up record by task_id
  - Update tx_hash if provided
  - Update status to match webhook status
  - No response body expected — 200 OK acknowledges receipt

Errors:
  400: { "error": "INVALID_PAYLOAD" }
  404: { "error": "TASK_NOT_FOUND" }
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
- Use `@metamask/smart-accounts-kit` — do NOT deploy custom ERC-7710 contracts ✅
- Use existing Delegation Framework contracts deployed on Base Sepolia by MetaMask
- `toMetaMaskSmartAccount()` creates Smart Account for both provider and consumer

```typescript
import { Implementation, toMetaMaskSmartAccount } from '@metamask/smart-accounts-kit'
import { createPublicClient, http } from 'viem'
import { baseSepolia } from 'viem/chains'

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http()
})

// Stateless7702 — no deployParams needed, uses EIP-7702 authorization
const smartAccount = await toMetaMaskSmartAccount({
  client: publicClient,
  implementation: Implementation.Stateless7702,
  address: treasuryAddress,
  signer: { account: treasuryAccount }
})
```

### ERC-7710 Delegation Structure (via smart-accounts-kit) ✅
```typescript
import { toMetaMaskSmartAccount } from '@metamask/smart-accounts-kit'
import { createDelegation } from '@metamask/smart-accounts-kit'
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
1. **Atomicity:** Payment to treasury is settled by x402 facilitator. AI Provider call happens after. If AI Provider fails, refund comes from treasury — no partial state.
2. **No per-call on-chain tx:** Eliminates latency and gas cost of splitting on-chain per request.
3. **Refund capability:** Treasury can refund consumer for failed AI Provider calls without requiring provider to return funds.
4. **Simplicity:** One treasury address, one settle target for x402.

### Refund Flow (AI Provider failure after payment)
```
1. AI Provider returns error (5xx, timeout, or invalid key)
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
  5. Decrypt → raw AI Provider key string
  6. Use immediately in AI Provider Authorization header
  7. Minimize decrypted key lifetime — do not assign to outer scope variables
  8. Key is never: logged, returned in response, stored in DB, or sent to client
```

### Consumer Token (JWT) — REMOVED in v2.1
```
JWT has been fully removed from the codebase.

Previously:
  Algorithm: HS256
  Secret:    JWT_SECRET
  Payload:   { consumerWallet, delegationId, permissionId, iat, exp }
  Used for:  Request auth (cache of ERC-7715 approval)

Now:
  Consumer auth is purely x402 + ERC-7715.
  @x402/next SDK handles payment intercept, verification, and proof validation.
  No Bearer token, no JWT, no HS256 signing, no manual header extraction.

Files deleted:
  - src/middleware/auth.ts       (withAuth wrapper — 159 lines)
  - src/middleware/x402.ts       (custom withX402 — 241 lines)
  - src/middleware/chain.ts      (middleware chain — 157 lines)
  - src/middleware/index.ts      (re-export — 39 lines)
  - src/proxy.ts                 (re-export only — rewritten with @x402/next)
  - src/middleware/__tests__/*   (x402.test.ts, middleware.test.ts — 938 lines)

Functions removed:
  - verifyGatewayJWT()          (from src/lib/gateway/helpers.ts)
  - checkConsumerPermission()   (from src/lib/gateway/helpers.ts)
```

### Replay Attack Prevention ✅
```
Every processed payment has its tx_hash stored in transactions table.
UNIQUE CONSTRAINT on transactions.payment_tx_hash.

Flow:
  1. Extract tx_hash from verified x402 payment proof
  2. INSERT INTO transactions (payment_tx_hash, status='pending', ...)
  3. If INSERT throws unique_violation → 402 PAYMENT_ALREADY_USED
  4. If INSERT succeeds → proceed to quota reservation + AI Provider call

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

### AI Provider Key Protection — Absolute Rules
- **NEVER** log AI Provider key at any log level (info, debug, error)
- **NEVER** return AI Provider key in any API response or error message
- **NEVER** store AI Provider key in plaintext (DB, file, environment variable)
- **NEVER** expose AI Provider key in frontend bundle, client-side code, or browser devtools
- **NEVER** pass AI Provider key through Redis, message queue, or any persistence layer
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
Rina (AI Provider Pro+, $68/month, 7,500 credits):
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

### Auth & Permission Errors (JWT removed in v2.1)
| Scenario | Detection | Response |
|---------|-----------|----------|
| Permission not found | No active row in consumer_permissions | 401 `PERMISSION_NOT_FOUND` |
| Consumer permission expired | `consumer_permissions.expires_at < now()` | 401 `PERMISSION_EXPIRED` |
| Consumer permission revoked | `consumer_permissions.status = 'revoked'` | 401 `PERMISSION_REVOKED` |

> JWT errors (INVALID_TOKEN, TOKEN_EXPIRED, WALLET_MISMATCH) removed in v2.1. Consumer auth is purely x402 + ERC-7715. No Bearer token/JWT validation in gateway path.

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
| Payment proof invalid | MetaMask x402 Facilitator verify returns isValid=false | 402 `PAYMENT_PROOF_INVALID` |
| Payment timeout | No payment within 60s | 402 `PAYMENT_TIMEOUT` |
| Replay attack | Duplicate tx_hash insert fails | 402 `PAYMENT_ALREADY_USED` |
| Wrong payment amount | Proof amount < required | 402 `PAYMENT_AMOUNT_MISMATCH` |
| Wrong payTo address | Proof payTo ≠ treasury | 402 `PAYMENT_WRONG_RECIPIENT` |

### AI Provider Errors (all trigger quota rollback + refund_pending)
| Scenario | Detection | Response |
|---------|-----------|----------|
| AI Provider key invalid | 401 from AI Provider | 502 `AI_PROVIDER_KEY_INVALID` + mark listing status='error' |
| AI Provider rate limited | 429 from AI Provider | 503 `AI_PROVIDER_RATE_LIMITED` — retry once after 1s |
| AI Provider server error | 5xx from AI Provider | 502 `AI_PROVIDER_ERROR` |

### Atomicity — AI Provider Failure After Payment
```
When AI Provider fails AFTER payment has been verified:
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
| Invalid AI Provider key format | 400 `INVALID_KEY` — basic format validation before storage |

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
| `/playground/[listingId]` | Free trial chat UI with streaming Markdown | Yes (consumer) |
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
| Non-premium AI providers | Kept out of scope to focus on premium models |
| Streaming responses (SSE) for paid gateway | Supported in Playground, but complex interaction with x402 per-call model for main gateway |
| Pre-funded consumer deposit | Pure per-call simpler for MVP |
| Mobile app | Time constraint |
| Advanced provider analytics | Basic earnings view sufficient |
| Multi-chain support | Base Sepolia only |
| DAO governance for fee | Post product-market-fit |
| Provider key update without relisting | Provider creates new listing instead |
| Automated refund processing | Manual admin endpoint for hackathon |
| Listing health check / AI Provider key pre-validation | Manual revoke if key invalid |

---

## 22. Submission Checklist

### Technical Requirements
- [ ] MetaMask Smart Accounts Kit integrated (core — ERC-7710 + ERC-7715 + ERC-7702)
- [ ] ERC-7710 delegation signing in provider registration flow
- [ ] ERC-7715 session permission in consumer permission flow
- [ ] Viem used for all contract interaction
- [ ] x402 payment flow working end-to-end with @x402/next SDK
- [ ] MetaMask x402 Facilitator used for payment verification
- [ ] 1Shot Permissionless Relayer integrated for ETH-free provider claims
- [ ] Ed25519 webhook verification for relayer status updates
- [ ] OpenAI / Anthropic / Google AI provider integrated
- [ ] Base Sepolia Testnet live deployment
- [ ] Supabase schema deployed with all 6 tables
- [ ] UNIQUE constraint on `transactions.payment_tx_hash` (replay protection)
- [ ] Atomic quota reservation SQL implemented
- [ ] AES-256-GCM encryption for AI Provider keys
- [ ] Escrow treasury model working (payments to treasury, provider claim)
- [ ] Node.js runtime on gateway API routes (not Edge)
- [ ] JWT removed — consumer auth = x402 + ERC-7715, no Bearer token needed
- [ ] Custom middleware deleted — @x402/next handles all payment intercept + verification

### Demo Script (End-to-End)
1. Connect MetaMask Smart Account as Provider
2. Register AI Provider key → set price, limits, expiry → sign ERC-7710 delegation
3. Listing appears on marketplace
4. Connect different MetaMask Smart Account as Consumer
5. Browse marketplace → select listing
6. Approve ERC-7715 session permission → receive endpoint URL
7. Call endpoint via `x402Fetch()` → auto 402 intercept → wallet pays USDC → auto retry → receive LLM response
8. Dashboard: Provider sees pending earnings
9. Provider clicks "Claim" → USDC arrives in provider wallet
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
