# Quotra

A decentralized peer-to-peer marketplace for AI API access. Providers list AI model endpoints, consumers discover and purchase usage — all secured by wallet-based authentication and on-chain payments.

## Features

- **Wallet Authentication** — Sign in with MetaMask (or any wagmi-compatible wallet). No passwords, no emails.
- **AI API Marketplace** — Browse, filter, and discover AI model endpoints from independent providers.
- **Provider Dashboard** — Register as a provider, list your AI models, manage listings, and track earnings.
- **Consumer Dashboard** — View purchased permissions, transaction history, and active listings.
- **x402 Payments** — Pay per request via the Coinbase x402 facilitator protocol using Base Sepolia testnet.
- **Escrow Claims** — Providers claim earned funds through an escrow smart contract.
- **API Key Encryption** — AES-256-GCM encrypted storage of provider API keys using Web Crypto API.
- **JWT Sessions** — Wallet-based JWT sessions for secure API route access.
- **Supabase Backend** — PostgreSQL database with serverless client (Row Level Security disabled — auth enforced at application layer).

## Tech Stack

| Layer      | Technology                                                              |
| ---------- | ----------------------------------------------------------------------- |
| Framework  | Next.js 16 (App Router)                                                 |
| UI         | React 19, Tailwind CSS v4, Radix UI, Lucide Icons                      |
| Language   | TypeScript (strict)                                                     |
| Web3       | wagmi v3, viem v2, WalletConnect                                        |
| Database   | Supabase (PostgreSQL)                                                   |
| State      | TanStack Query v5                                                       |
| Auth       | Custom wallet-based JWT (jose library) + Supabase SSR                    |
| Payments   | x402 facilitator (Coinbase)                                             |
| Validation | zod v4                                                                  |
| Testing    | Vitest v4, Testing Library, jsdom                                       |
| Linting    | ESLint v9 (flat config)                                                 |

## Prerequisites

- Node.js 20+
- npm 10+
- MetaMask browser extension
- Base Sepolia test ETH (for payment testing)

## Getting Started

### 1. Clone & Install

```bash
git clone https://github.com/leeCode83/quotra-app.git
cd quotra-app
npm install
```

### 2. Environment Variables

Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

| Variable                              | Required | Description                                      |
| ------------------------------------- | -------- | ------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`            | Yes      | Supabase project URL                             |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`       | Yes      | Supabase anonymous key                           |
| `SUPABASE_SERVICE_ROLE_KEY`           | For admin | Supabase service role key (escrow operations)    |
| `JWT_SECRET`                          | Yes      | Secret for signing wallet-based JWTs             |
| `VENICE_API_KEY`                      | Yes      | Venice.ai API key (AI gateway integration)       |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`| Yes      | WalletConnect Cloud project ID                   |
| `NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL`    | No       | Custom RPC URL for Base Sepolia (has default)    |
| `X402_FACILITATOR_URL`                | No       | x402 facilitator URL (has default)               |
| `NEXT_PUBLIC_APP_URL`                 | No       | App URL for callbacks (default: localhost:3000)  |
| `ADMIN_PRIVATE_KEY`                   | For escrow | Private key for server-side escrow withdrawals |

### 3. Database Setup

Run the schema in your Supabase project SQL Editor:

```
supabase/schema.sql
```

This creates all tables, indexes, and functions. Row Level Security is disabled — access control is handled at the application layer via JWT verification.

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command             | Description                                    |
| ------------------- | ---------------------------------------------- |
| `npm run dev`       | Start development server                       |
| `npm run build`     | Production build (runs typecheck automatically)|
| `npm run start`     | Start production server                        |
| `npm run lint`      | Lint all files with ESLint                     |
| `npm run typecheck` | Run TypeScript type checking                   |
| `npm run test`      | Run all tests (Vitest)                         |
| `npm run test:watch`| Run tests in watch mode                        |

## Project Structure

```
quotra-app/
├── app/                          # Next.js App Router pages & API routes
│   ├── api/                      # Backend API routes
│   │   ├── consumers/register/   # Consumer registration
│   │   ├── escrow/claim/         # Escrow claim withdrawal
│   │   ├── escrow/revoke/        # Escrow revocation
│   │   ├── gateway/[...path]/    # AI API gateway proxy
│   │   ├── listings/             # Listing CRUD
│   │   └── providers/register/   # Provider registration
│   ├── dashboard/                # Provider & consumer dashboards
│   ├── marketplace/              # API listing marketplace
│   └── wallet/                   # Wallet & transaction history
├── src/
│   ├── components/               # Shared UI components
│   │   ├── ui/                   # Radix UI primitives
│   │   └── web3/                 # Web3-specific components
│   ├── hooks/                    # Custom React hooks
│   ├── lib/                      # Core utilities
│   │   ├── web3/                 # wagmi config, contracts, provider
│   │   └── __tests__/            # Unit tests
│   ├── middleware/                # Middleware chain (auth, x402)
│   ├── providers/                # React context providers
│   └── types/                    # TypeScript type definitions
├── proxy.ts                      # Next.js 16 proxy (edge middleware)
├── supabase/
│   └── schema.sql                # Database schema
└── vitest.config.ts              # Test configuration
```

## Architecture Overview

### Authentication Flow

1. User connects MetaMask wallet
2. Wallet signs a message (SIWE-style)
3. Backend verifies the signature and issues a JWT containing `wallet_address`
4. Subsequent API requests include the JWT in the `Authorization: Bearer` header
5. The proxy middleware (`src/proxy.ts`) validates the JWT before requests reach API routes

### Payment Flow (x402)

1. Consumer requests an AI API endpoint through the gateway
2. Gateway calculates the cost based on the listing's `price_per_request`
3. Consumer's wallet sends a transaction with the required amount
4. x402 facilitator verifies the transaction
5. Gateway proxies the request to the provider's AI API endpoint
6. Transaction is marked as confirmed after the response is fully streamed

### Smart Contracts

The escrow contract on Base Sepolia handles:
- **Deposits** — Consumers fund transactions
- **Withdrawals** — Providers claim earned funds
- **Revocations** — Refund failed or cancelled transactions

## Testing

```bash
# Run all tests
npm run test

# Run in watch mode
npm run test:watch
```

The test suite covers:
- JWT signing and verification
- Input validation schemas
- x402 payment middleware
- Auth middleware
- Web3 contract interactions
- Encryption utilities

## Deployment

Deploy to Vercel:

```bash
npm install -g vercel
vercel
```

Ensure all environment variables are configured in your Vercel project settings.
