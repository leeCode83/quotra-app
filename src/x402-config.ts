/**
 * Quotra x402 Payment Proxy Configuration
 *
 * Sets up the shared @x402/next resource server, facilitator client,
 * and EVM payment scheme for all payment-gated API routes.
 *
 * This module replaces the previous custom middleware stack
 * (withAuth, withX402, chain.ts) with the native @x402/next SDK.
 *
 * How it works:
 *   1. @x402/next withX402 wraps each payment-gated route handler
 *   2. On first request (no X-PAYMENT header): returns 402 + payment requirements
 *   3. Consumer wallet pays USDC to QUOTRA_TREASURY via 1Shot Relayer
 *   4. x402Fetch() auto-retries with X-PAYMENT header
 *   5. withX402 verifies payment through the Coinbase x402 Facilitator
 *   6. Only on successful verification does the actual handler execute
 *
 * No JWT, no Bearer token, no custom middleware. Pure x402.
 */

import { x402ResourceServer } from "@x402/next"
import { HTTPFacilitatorClient } from "@x402/core/http"
import { ExactEvmScheme } from "@x402/evm/exact/server"

const FACILITATOR_URL = process.env.X402_FACILITATOR_URL ?? "https://x402.org/facilitator"
export const QUOTRA_TREASURY_ADDRESS = process.env.QUOTRA_TREASURY_ADDRESS ?? "0xYourTreasuryAddress"
export const NETWORK = "eip155:84532"

export const facilitatorClient = new HTTPFacilitatorClient({ url: FACILITATOR_URL })

export const server = new x402ResourceServer(facilitatorClient)
  .register(NETWORK, new ExactEvmScheme())
