# Quotra - Tech Stack Overview

This document provides a high-level overview of the core technologies actually implemented and actively used in the Quotra project. It is designed to be easily digestible for presentation purposes.

## Frontend & Core Framework

- **Next.js 14 (App Router) & TypeScript**
  The backbone of the application, serving both the interactive frontend user interface and the backend API gateway.

## Web3 & Smart Accounts

- **MetaMask Smart Accounts Kit**
  Manages user wallet connections and handles the complex logic of smart account creation and operation.

## Payment & Authorization (Core Engine)

- **x402 Protocol**
  The central payment mechanism. It acts as an automated, cryptographically secure paywall that intercepts API requests and deducts USDC for each call.
- **ERC-7710 & ERC-7715**
  The standard protocols used for granting session permissions and delegating spending limits. This completely replaces traditional Web2 authentication methods like JWTs.

## AI & Data Infrastructure

- **Vercel AI SDK**
  A unified orchestration layer that seamlessly routes user prompts to various underlying AI models (including OpenAI, Gemini, and Anthropic) without needing separate, complex integrations for each.
- **Supabase**
  The primary relational database. It securely stores AES-encrypted API keys, tracks user consumption quotas, and maintains immutable transaction histories.

## Network & Assets

- **Base Sepolia**
  The Ethereum Layer-2 network where all smart contracts and user accounts are deployed, chosen for its low fees and high speed.
- **USDC**
  The stablecoin utilized as the sole medium of exchange for all peer-to-peer API transactions on the platform.

## Specialized Backend Services

- **1Shot API**
  Utilized strictly as an automated backend service to trigger smart contract methods, specifically for executing provider payouts from the treasury without requiring manual gas payments.
