# Quotra App — Full Codebase Audit

## Summary

| Area | Issues Found | Severity |
|------|-------------|----------|
| Architecture | 6 | 🔴 3 High, 🟡 3 Medium |
| Security | 3 | 🔴 2 High, 🟡 1 Medium |
| Web3 / Wallet | 4 | 🔴 1 High, 🟡 3 Medium |
| Supabase / Auth | 3 | 🟡 3 Medium |
| Error Handling | 3 | 🟡 3 Medium |
| Code Quality | 5 | 🟢 5 Low |
| Testing | 2 | 🟡 2 Medium |

---

## 🔴 High Severity

### H-01: Module-level `QueryClient` (tanstack-query anti-pattern)

**File:** `src/components/Providers.tsx:9`

```ts
const queryClient = new QueryClient(); // module-level — BAD
```

TanStack Query v5 docs explicitly warn: *Do NOT create a `QueryClient` at module level — it creates cache sharing across all users/requests.* Must be created inside `React.useState` lazy initializer (or a React ref).

**Fix:** Move inside the component:

```ts
const [queryClient] = useState(() => new QueryClient({
  defaultOptions: { queries: { staleTime: 60 * 1000 } },
}));
```

---

### H-02: Middleware file location — Next.js 16 may not detect it

**File:** `src/middleware/index.ts`

Next.js expects the middleware file at `src/middleware.ts` (a single exported `middleware` function). The project wraps it in `src/middleware/index.ts` → `src/middleware/chain.ts`. This is a custom convention — there is **no guarantee** Next.js auto-discovers middleware in an `index.ts` file under a `middleware/` directory.

**Fix:** Either:
- Rename `src/middleware/index.ts` → `src/middleware.ts` (export the chain directly)
- Or keep the pattern but verify via `next build` that middleware is being invoked. If not, fall back to a root `src/middleware.ts` re-export.

---

### H-03: Hardcoded JWT development secret in production code

**File:** `src/lib/jwt.ts:5`

```ts
const DEVELOPMENT_SECRET = "quotra-dev-secret-change-in-production";
```

If this falls through to production (e.g., missing `JWT_SECRET` env var), **anyone who reads the source can forge JWTs**. The fallback path provides zero security.

**Fix:** Remove the fallback entirely — throw if `JWT_SECRET` is not set:

```ts
if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET env var is required");
```

---

### H-04: BigInt → Number precision loss

**Files:**
- `src/middleware/x402.ts:57` — `Number(validatedPayment.amount)`
- `app/api/listings/route.ts:97` — `Number(parseResult.data.price_per_request)`

BigInt values > 2^53 lose precision when cast to JavaScript `Number`. Wei amounts (18 decimals) easily exceed this.

**Fix:** Keep values as `bigint` or `string` through the entire pipeline. Cast only at display/UI layer with a proper formatter.

---

### H-05: Gateway confirms payment before verifying stream delivery

**File:** `app/api/gateway/[...path]/route.ts`

The gateway marks a transaction as confirmed **before the AI streaming response completes**. If the stream fails midway, the user has already been charged.

**Fix:** Implement a two-phase pattern: 1) hold payment in escrow, 2) confirm after streaming completes or consumer acknowledges receipt.

---

### H-06: Duplicate provider nesting — WagmiProvider & QueryClientProvider

**Files:**
- `src/components/Providers.tsx` — creates `QueryClientProvider` + `WagmiProvider` + `Web3Provider`
- `src/providers/Web3Provider.tsx` — creates `WagmiProvider` + `QueryClientProvider`

If `Web3Provider` is also mounted in the component tree (or gets imported elsewhere), `WagmiProvider` and `QueryClientProvider` will nest twice. This causes subtle bugs with hooks and caching.

**Fix:** Consolidate all providers into a single file. Remove `Web3Provider.tsx` or have it only provide Web3-specific context without re-creating WagmiProvider/QueryClientProvider.

---

## 🟡 Medium Severity

### M-01: wagmi v3 missing SSR configuration

**File:** `src/lib/web3/config.ts`

```ts
export const wagmiConfig = createConfig({
  chains: [baseSepolia],
  transports: { [baseSepolia.id]: http() },
});
```

Missing `ssr: true` and `storage: createStorage({ storage: cookieStorage })` — these are required for proper SSR hydration with Next.js App Router.

**Fix:**

```ts
import { cookieStorage, createStorage } from "wagmi";

export const wagmiConfig = createConfig({
  chains: [baseSepolia],
  transports: { [baseSepolia.id]: http() },
  ssr: true,
  storage: createStorage({ storage: cookieStorage }),
});
```

---

### M-02: All dashboard/marketplace pages use hardcoded mock data

**Files:**
- `app/dashboard/consumer/page.tsx`
- `app/dashboard/provider/page.tsx`
- `app/marketplace/page.tsx`

None make actual Supabase queries. Data is hardcoded with TODO comments.

**Fix:** Replace mock data with actual `createServerClient()` queries (or TanStack Query for client-side). Pages are Server Components — use `supabase-server.ts`.

---

### M-03: Inconsistent error response format

**Files using `Response.json()`:**
- `src/middleware/auth.ts`
- `src/middleware/x402.ts`

**Files using `NextResponse.json()`:**
- All `app/api/*/route.ts` files

Edge functions (`@vercel/edge`) may handle `Response` differently from `NextResponse`. **Pick one format** — `NextResponse.json()` is the standard for App Router Route Handlers.

---

### M-04: No React Error Boundaries

No `<ErrorBoundary>` wrapper exists anywhere. If any client component throws during render, the entire page crashes.

**Fix:** Add a root `ErrorBoundary` in `layout.tsx` wrapping `<Providers>`, and individual boundaries for critical sections (marketplace, wallet).

---

### M-05: Supabase RLS trusts non-standard JWT claim `wallet_address`

**File:** `supabase/schema.sql`

The RLS policy reads `auth.jwt() ->> 'wallet_address'`. This claim is set by the **app's custom JWT** (via `jose`), not by Supabase Auth. If Supabase Auth issues the session token (which it does — the app uses Supabase Auth for login), that JWT will **not** contain `wallet_address`.

**Fix:** Either:
- Don't rely on RLS for wallet address — use a `service_role` API route with explicit checks
- Or sync `wallet_address` to Supabase Auth's `raw_user_meta_data` so it appears in Supabase-managed JWTs

---

### M-06: `cookies()` called synchronously — Next.js 16 requires async

**Files:**
- `src/lib/supabase-middleware.ts` — calls `cookies().getAll()` and `cookies().set()`
- `src/middleware/auth.ts` — calls `cookies().get()`

Next.js 16 changed `cookies()`, `headers()`, and `draftMode()` to be **async** (breaking change from v15). Calling them synchronously will throw or return undefined.

**Fix:** Use `const cookieStore = await cookies()` before calling `.get()`/`.set()`.

---

### M-07: No test for the x402 middleware

**File:** `src/middleware/__tests__/middleware.test.ts`

Only tests auth middleware. x402 payment validation has no test coverage.

**Fix:** Add tests covering valid/invalid x402 headers, expired payments, wrong amounts, and stream failure scenarios.

---

### M-08: `void _ctx` pattern in middleware test defeats purposeless unused param lint

**File:** `src/middleware/__tests__/middleware.test.ts`

```ts
const _ctx = { waitUntil: vi.fn() }; void _ctx;
```

The `_ctx` parameter is unused because the middleware chain doesn't pass context. This indicates the middleware test helpers are incomplete — the chain should pass context for proper integration testing.

**Fix:** Either remove `_ctx` params from test helpers if unused, or implement actual context passing through the chain.

---

### M-09: encryption.ts uses AES-CBC without authentication

**File:** `src/lib/encryption.ts`

AES-CBC is **malleable** without HMAC authentication. An attacker can modify ciphertexts undetected.

**Fix:** Use AES-GCM (authenticated encryption) instead. Node.js `crypto.createCipheriv` with `aes-256-gcm`.

---

## 🟢 Low Severity

### L-01: `ListingCard` uses `any` type for listing prop

**File:** `src/components/ListingCard.tsx`

The `listing` prop is typed as `any`. Should use the existing `Listing` type or a Supabase-generated type.

---

### L-02: Unused imports across dashboard pages

**Files:**
- `app/dashboard/consumer/page.tsx` — unused `ArrowDownRight`, `Loader2`, `Skeleton` imports
- `app/dashboard/provider/page.tsx` — unused `Link`, `Pencil`, `ArrowRight`, `Skeleton`, `cn` imports

These were cleaned by eslint but the imports themselves remain. Should be fully removed.

---

### L-03: No TypeScript strict check on build

No `npm run typecheck` in build pipeline. Type errors exist in test files (TS2416, TS2556) that would fail strict mode.

---

### L-04: `src/actions/` directory is empty

Likely intended for Next.js Server Actions. Currently unused.

---

### L-05: No consistent import ordering

Files mix third-party imports, local imports, and type imports without consistent grouping or ordering.

---

## Appendix: Library Stack & Versions

| Library | Version | Notes |
|---------|---------|-------|
| Next.js | 16.2.6 | App Router. Middleware at root `middleware.ts`. Async cookies/headers. |
| React | 19.2.4 | React 19 stable. No `forwardRef` needed for some patterns. |
| TypeScript | ^5 | Strict mode enabled. |
| @supabase/supabase-js | 2.106.2 | SSR via @supabase/ssr |
| @supabase/ssr | 0.10.3 | `createServerClient` requires `cookies.getAll` |
| wagmi | 3.6.16 | v3 API — `WagmiProvider`, `useAccount`, etc. |
| viem | 2.51.2 | Peer dependency of wagmi. |
| TanStack Query | 5.100.14 | Object-format hooks only. |
| jose | 6.2.3 | JWT sign/verify. Secret as `Uint8Array`. |
| zod | 4.4.3 | v4 — `z.function()` uses `{input, output}` object. |
| Radix UI | various | Dialog, Select, Tabs, ScrollArea, Separator, Slot. |
| Tailwind CSS | v4 | PostCSS config. No `tailwind.config.ts`. |
| lucide-react | 1.16.0 | Icon library. |
| WalletConnect | — | Project ID in env vars. |
| Base Sepolia | — | Target testnet. RPC URL in env vars. |
| Vitest | 4.1.7 | Test runner with jsdom + React Testing Library. |
