#!/usr/bin/env npx tsx
/**
 * E2E Claim Verification Script — Quotra Permissionless Relayer
 *
 * Hybrid: checks env config + prints step-by-step manual verification
 * instructions. Run with:
 *   npx tsx scripts/e2e-claim-verification.ts
 */

const REQUIRED_ENV_VARS = [
  "TREASURY_PRIVATE_KEY",
  "NEXT_PUBLIC_PAY_TO_ADDRESS",
  "NEXT_PUBLIC_USDC_ADDRESS",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL",
] as const;

const OPTIONAL_ENV_VARS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "ONE_SHOT_API_CLIENT_ID",
  "ONE_SHOT_API_CLIENT_SECRET",
] as const;

function checkEnv() {
  console.log("\n📋 Checking environment configuration...\n");
  
  let allGood = true;
  
  for (const key of REQUIRED_ENV_VARS) {
    const exists = !!process.env[key];
    console.log(`  ${exists ? "✅" : "❌"} ${key}${exists ? ` = ${maskValue(process.env[key]!)}` : ""}`);
    if (!exists) allGood = false;
  }
  
  console.log("");
  for (const key of OPTIONAL_ENV_VARS) {
    const exists = !!process.env[key];
    if (exists) {
      console.log(`  ⚪ ${key} = ${maskValue(process.env[key]!)} (optional, legacy)`);
    }
  }
  
  return allGood;
}

function maskValue(value: string): string {
  if (value.length <= 10) return value;
  if (value.startsWith("0x")) {
    return `${value.slice(0, 10)}...${value.slice(-4)}`;
  }
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function printStep(num: number, title: string, instruction: string) {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  Step ${num}: ${title}`);
  console.log(`${"═".repeat(60)}`);
  console.log(`  ${instruction}`);
  console.log("");
}

async function main() {
  console.log(`${"█".repeat(60)}`);
  console.log("  Quotra E2E Claim Verification");
  console.log(`${"█".repeat(60)}`);
  
  const configOk = checkEnv();
  if (!configOk) {
    console.log("\n❌ Missing required environment variables. Check .env file.");
    process.exit(1);
  }
  
  if (!process.env.NEXT_PUBLIC_PAY_TO_ADDRESS) {
    console.log("\n⚠️  NEXT_PUBLIC_PAY_TO_ADDRESS not set. This must be the treasury EOA address.");
    console.log("   It must match the address derived from TREASURY_PRIVATE_KEY.");
    process.exit(1);
  }
  
  printStep(
    1,
    "Start your local dev server",
    `Run 'npm run dev' in another terminal.\n` +
    `Make sure your .env has the correct values.\n` +
    `Expected: NEXT_PUBLIC_APP_URL = ${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}`
  );
  
  printStep(
    2,
    "Connect a provider wallet",
    "1. Go to http://localhost:3000/dashboard/provider\n" +
    "2. Connect your MetaMask wallet (must be the provider wallet)\n" +
    "3. Register as a provider if not already\n" +
    "4. Create an AI listing with an API key\n" +
    "5. Verify the listing appears in your dashboard"
  );
  
  printStep(
    3,
    "Generate earnings (consumer makes calls)",
    "1. Open the marketplace (http://localhost:3000/marketplace)\n" +
    "2. Find your listing, click 'Try' to go to the playground\n" +
    "3. Send test messages (free trial: 3 calls)\n" +
    "4. OR use a consumer wallet to make paid calls via x402\n" +
    "5. Verify in Supabase: SELECT * FROM transactions WHERE status = 'completed'"
  );
  
  printStep(
    4,
    "Trigger a claim from the provider dashboard",
    "Click the 'Withdraw' / 'Claim' button on the provider dashboard.\n" +
    "OR send a direct API call:\n\n" +
    `curl -X POST ${process.env.NEXT_PUBLIC_APP_URL}/api/escrow/claim \\\n` +
    `  -H 'Authorization: Bearer <JWT_TOKEN>' \\\n` +
    `  -H 'Content-Type: application/json'\n\n` +
    "Expected response:\n" +
    `  { "claimable_amount": 0.5, "task_id": "0x...", "status": "submitted" }`
  );
  
  printStep(
    5,
    "Verify on BaseScan (on-chain USDC transfer)",
    "Check the treasury wallet on BaseScan:\n" +
    `  👛 Treasury: ${process.env.NEXT_PUBLIC_PAY_TO_ADDRESS}\n` +
    `  🔗 BaseScan: https://sepolia.basescan.org/address/${process.env.NEXT_PUBLIC_PAY_TO_ADDRESS}\n\n` +
    "Look for:\n" +
    "  ✅ USDC transfer to the provider wallet\n" +
    "  ✅ USDC fee transfer to the relayer fee collector\n" +
    "  ✅ If treasury was not yet upgraded: EIP-7702 authorization tx\n\n" +
    "Time estimate: 30-90 seconds for Base Sepolia"
  );
  
  printStep(
    6,
    "Verify webhook updated claim_history",
    "Check Supabase:\n" +
    "  SELECT * FROM claim_history ORDER BY created_at DESC LIMIT 5;\n\n" +
    "Expected:\n" +
    "  - task_id is NOT null\n" +
    "  - tx_hash matches the on-chain USDC transfer\n" +
    "  - status = 'completed' (set by webhook type 0)\n\n" +
    "If status is 'pending':\n" +
    "  - Check the relayer webhook was received\n" +
    "  - Check server logs for [relayer-webhook]\n" +
    "  - The webhook endpoint is: POST /api/webhooks/relayer"
  );
  
  printStep(
    7,
    "Verify provider earnings updated",
    "Check Supabase:\n" +
    `  SELECT * FROM providers WHERE wallet_address ILIKE '%<your_wallet>%';\n\n` +
    "Expected:\n" +
    "  - pending_earnings_usdc decreased by the claimed amount\n" +
    "  - total_earned_usdc increased by the claimed amount (90% of earnings)"
  );
  
  console.log(`\n${"═".repeat(60)}`);
  console.log("  Verification Complete!");
  console.log(`${"═".repeat(60)}`);
  console.log("\n  📌 Reference Links:");
  console.log(`  ├─ 1Shot Relayer Docs: https://docs.1shotapi.com/`);
  console.log(`  ├─ MetaMask Smart Accounts Kit: https://docs.metamask.io/smart-accounts-kit/`);
  console.log(`  ├─ EIP-7702: https://eips.ethereum.org/EIPS/eip-7702`);
  console.log(`  └─ EIP-7710: https://eips.ethereum.org/EIPS/eip-7710`);
  console.log(`\n${"═".repeat(60)}\n`);
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
