/**
 * Quotra Consumer Flow — End-to-End Test Script
 *
 * Prerequisites:
 *   1. .env.local terisi lengkap
 *   2. Consumer sudah grant ERC-7715 permission via MetaMask
 *   3. Ada listing aktif di database
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/test-consumer-flow.ts <listing-id>
 *
 * Environment variables:
 *   TEST_PRIVATE_KEY=0x... (consumer EOA private key, termasuk 0x prefix)
 *   NEXT_PUBLIC_APP_URL=http://localhost:3000 (default)
 */

import { http, createPublicClient, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { x402Client } from "@x402/core/client";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { toClientEvmSigner } from "@x402/evm";
import { wrapFetchWithPayment } from "@x402/fetch";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

async function main() {
  const listingId = process.argv[2];
  if (!listingId) {
    console.error("Usage: npx tsx --env-file=.env.local scripts/test-consumer-flow.ts <listing-id>");
    process.exit(1);
  }

  const pk = process.env.TEST_PRIVATE_KEY as Hex | undefined;
  if (!pk) {
    console.error("Missing TEST_PRIVATE_KEY environment variable");
    process.exit(1);
  }

  // 1. Create signer from private key
  const account = privateKeyToAccount(pk);
  const publicClient = createPublicClient({ chain: baseSepolia, transport: http() });
  const signer = toClientEvmSigner(account, publicClient);

  const consumerAddress = account.address.toLowerCase();
  console.log(`Consumer address: ${consumerAddress}`);

  // 2. Check permission
  console.log(`\n1. Checking permission for listing ${listingId}...`);
  const permissionRes = await fetch(
    `${APP_URL}/api/permissions/${listingId}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet_address: consumerAddress }),
    },
  );
  const permissionData = await permissionRes.json();
  console.log(`   Response: ${permissionRes.status}`, permissionData);

  if (!permissionRes.ok || !permissionData?.hasPermission) {
    console.error("\nPermission not granted. Grant ERC-7715 session permission via MetaMask first.");
    process.exit(1);
  }
  console.log("   Permission ACTIVE! Continuing...\n");

  // 3. Create x402 client with ExactEvmScheme
  console.log("2. Creating x402 payment client...");
  const client = new x402Client();
  registerExactEvmScheme(client, { signer });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fetchWithPayment = wrapFetchWithPayment(fetch, client as any);

  // 4. Call gateway (x402 handles 402 → payment → retry automatically)
  console.log("3. Calling gateway with x402 payment...\n");
  const gateWayRes = await fetchWithPayment(
    `${APP_URL}/api/v1/${listingId}/chat`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-wallet-address": consumerAddress,
      },
      body: JSON.stringify({
        chat: "Hello, what AI model are you using?",
        maxOutputTokens: 100,
      }),
    },
  );

  const gatewayData = await gateWayRes.json();
  console.log(`\nGateway response: ${gateWayRes.status}`);
  console.log(JSON.stringify(gatewayData, null, 2));

  if (gateWayRes.ok) {
    console.log("\n✓ CONSUMER FLOW SUCCESSFUL!");
  } else {
    console.error("\n✗ CONSUMER FLOW FAILED");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
