import { createClient } from "@supabase/supabase-js";
import { encrypt } from "../src/lib/encryption";
import crypto from "crypto";

// Pastikan dijalankan dengan Node 20+ yang menggunakan flag --env-file
// Contoh: npx tsx --env-file=.env scripts/seed.ts

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Harus menggunakan service_role_key untuk bypass RLS

if (!supabaseUrl || !supabaseKey) {
  console.error("Error: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env");
  process.exit(1);
}

if (!process.env.QUOTRA_ENCRYPTION_KEY) {
  console.error("Error: Missing QUOTRA_ENCRYPTION_KEY in env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const providers = [
  { wallet_address: `0x${crypto.randomBytes(20).toString("hex")}`, name: "Venice AI", rawApiKey: "venice_live_7a8b9c1d2e3f4g" },
  { wallet_address: `0x${crypto.randomBytes(20).toString("hex")}`, name: "OpenAI Enterprise", rawApiKey: "sk_proj_9x8c7v6b5n4m" },
  { wallet_address: `0x${crypto.randomBytes(20).toString("hex")}`, name: "Anthropic Provider", rawApiKey: "sk_ant_api03_abcdef" },
  { wallet_address: `0x${crypto.randomBytes(20).toString("hex")}`, name: "Mistral Cloud", rawApiKey: "mistral_xyz123456" },
  { wallet_address: `0x${crypto.randomBytes(20).toString("hex")}`, name: "Groq Fast Inference", rawApiKey: "gsk_abcdef123456" },
  { wallet_address: `0x${crypto.randomBytes(20).toString("hex")}`, name: "Together AI", rawApiKey: "together_def98765" },
];

const consumers = Array.from({ length: 25 }).map(() => ({
  wallet_address: `0x${crypto.randomBytes(20).toString("hex")}`
}));

const listings = [
  {
    name: "Stable Diffusion XL",
    description: "Fast image generation via Venice AI. Optimized for creative art and decentralized inference.",
    model_name: "venice-sdxl",
    price_per_call_usdc: 0.005,
    max_calls: 1000,
    max_input_chars: 500,
    max_completion_tokens: 0,
    providerIdx: 0,
  },
  {
    name: "GPT-4 Turbo",
    description: "Access to OpenAI's GPT-4 Turbo model without subscription. Pay precisely per prompt.",
    model_name: "gpt-4-turbo",
    price_per_call_usdc: 0.01,
    max_calls: 5000,
    max_input_chars: 10000,
    max_completion_tokens: 4096,
    providerIdx: 1,
  },
  {
    name: "GPT-3.5 Fast",
    description: "Cheaper and faster text generation for simple tasks.",
    model_name: "gpt-3.5-turbo",
    price_per_call_usdc: 0.002,
    max_calls: 10000,
    max_input_chars: 8000,
    max_completion_tokens: 2048,
    providerIdx: 1,
  },
  {
    name: "Claude 3.5 Sonnet",
    description: "High-speed reasoning and coding model from Anthropic. Delivered via P2P relay.",
    model_name: "claude-3-5-sonnet",
    price_per_call_usdc: 0.008,
    max_calls: 3000,
    max_input_chars: 8000,
    max_completion_tokens: 4096,
    providerIdx: 2,
  },
  {
    name: "Mixtral 8x7B",
    description: "Open weights model served fast. Excellent for general instruction following.",
    model_name: "mixtral-8x7b",
    price_per_call_usdc: 0.001,
    max_calls: 20000,
    max_input_chars: 32000,
    max_completion_tokens: 8192,
    providerIdx: 3,
  },
  {
    name: "Llama 3 70B (Groq)",
    description: "Lightning fast Llama 3 inference running on LPU hardware.",
    model_name: "llama-3-70b-groq",
    price_per_call_usdc: 0.0015,
    max_calls: 50000,
    max_input_chars: 8000,
    max_completion_tokens: 4096,
    providerIdx: 4,
  },
  {
    name: "Qwen 2.5 Coder",
    description: "Excellent coding model served on reliable infrastructure.",
    model_name: "qwen-2.5-coder",
    price_per_call_usdc: 0.003,
    max_calls: 5000,
    max_input_chars: 16000,
    max_completion_tokens: 8192,
    providerIdx: 5,
  }
];

async function seed() {
  console.log("🌱 Memulai proses seeding database...");

  // 1. Consumers
  console.log("Menambahkan data Consumers...");
  const { data: consumerData, error: consumerErr } = await supabase
    .from('consumers')
    .upsert(consumers, { onConflict: 'wallet_address' })
    .select('id');

  if (consumerErr) throw consumerErr;

  // 2. Providers
  console.log("Menambahkan data Providers...");
  const providerIds: string[] = [];

  for (const p of providers) {
    const { data: providerData, error: providerErr } = await supabase
      .from('providers')
      .upsert({
        wallet_address: p.wallet_address,
        name: p.name
      }, { onConflict: 'wallet_address' })
      .select('id')
      .single();

    if (providerErr) throw providerErr;
    providerIds.push(providerData.id);
  }

  // 3. Listings
  console.log("Menambahkan data Listings...");
  const listingIds: string[] = [];
  
  // Hapus listing lama jika ada agar tidak dobel (optional)
  await supabase.from('listings').delete().in('provider_id', providerIds);

  for (let i = 0; i < listings.length; i++) {
    const { providerIdx, ...listingDataPayload } = listings[i];
    
    // Encrypt the provider's API key for this listing
    const encResult = await encrypt(providers[providerIdx].rawApiKey);

    const { data: listingData, error: listingErr } = await supabase
      .from('listings')
      .insert({
        provider_id: providerIds[providerIdx],
        encrypted_key: encResult.encrypted_key,
        key_iv: encResult.key_iv,
        key_auth_tag: encResult.key_auth_tag,
        delegation_id: crypto.randomUUID(),
        signed_delegation: "0x_dummy_signature",
        remaining_calls: listingDataPayload.max_calls,
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        ...listingDataPayload
      })
      .select('id')
      .single();

    if (listingErr) throw listingErr;
    listingIds.push(listingData.id);
  }

  // 4. Transactions
  console.log("Menambahkan data Transactions (40 dummy transaksi)...");
  const transactions = [];
  for (let i = 0; i < 40; i++) {
    const listingIdx = Math.floor(Math.random() * listingIds.length);
    const consumerIdx = Math.floor(Math.random() * consumerData.length);

    const price = listings[listingIdx].price_per_call_usdc;
    const providerAmount = (price * 0.9).toFixed(6);
    const platformAmount = (price * 0.1).toFixed(6);

    const isCompleted = Math.random() > 0.2;
    transactions.push({
      listing_id: listingIds[listingIdx],
      consumer_id: consumerData[consumerIdx].id,
      payment_tx_hash: `0x${crypto.randomBytes(32).toString('hex')}`,
      amount_usdc: price.toString(),
      provider_amount_usdc: providerAmount,
      platform_amount_usdc: platformAmount,
      status: isCompleted ? 'completed' : 'pending',
      completed_at: isCompleted ? new Date().toISOString() : null
    });
  }

  const { error: txErr } = await supabase
    .from('transactions')
    .insert(transactions);

  if (txErr) throw txErr;

  console.log("✅ Seeding berhasil diselesaikan! Database Anda kini memiliki data dummy yang cantik.");
}

seed().catch(console.error);
