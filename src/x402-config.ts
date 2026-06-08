/**
 * Quotra x402 Payment Proxy Configuration
 *
 * Sets up the shared @x402/next resource server, facilitator client,
 * and ERC-7710 payment scheme for all payment-gated API routes.
 *
 * Menggunakan MetaMask Facilitator + x402ExactEvmErc7710ServerScheme
 * agar kompatibel dengan consumer yang menggunakan MetaMask Flask (ERC-7710 delegation).
 *
 * How it works:
 *   1. @x402/next withX402 wraps each payment-gated route handler
 *   2. On first request (no PAYMENT-SIGNATURE header): returns 402 + payment requirements
 *      (dengan assetTransferMethod: "erc7710" dan facilitatorAddresses)
 *   3. Consumer wallet membuat ERC-7710 delegation proof via MetaMask Flask
 *   4. x402Fetch() auto-retries dengan PAYMENT-SIGNATURE header
 *   5. withX402 memverifikasi payment melalui MetaMask x402 Facilitator
 *   6. Handler berjalan hanya setelah verifikasi sukses
 *
 * No JWT, no Bearer token, no custom middleware. Pure x402 + ERC-7710.
 */

import { x402ResourceServer } from "@x402/next"
import { HTTPFacilitatorClient } from "@x402/core/http"
import { x402ExactEvmErc7710ServerScheme } from "@metamask/x402"

// MetaMask Facilitator untuk Base Sepolia
const FACILITATOR_URL =
  process.env.X402_FACILITATOR_URL ??
  "https://tx-sentinel-base-sepolia.api.cx.metamask.io/platform/v2/x402"

export const QUOTRA_TREASURY_ADDRESS = (process.env.NEXT_PUBLIC_PAY_TO_ADDRESS ?? "") as `0x${string}`
export const NETWORK = "eip155:84532"

export const facilitatorClient = new HTTPFacilitatorClient({ url: FACILITATOR_URL })

export const server = new x402ResourceServer(facilitatorClient)
  .register(NETWORK, new x402ExactEvmErc7710ServerScheme())
