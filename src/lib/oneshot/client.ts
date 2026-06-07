const ONE_SHOT_API_BASE = process.env.ONE_SHOT_API_BASE ?? "https://api.1shotapi.com/v0";
const ONE_SHOT_TOKEN_URL = process.env.ONE_SHOT_TOKEN_URL ?? "https://api.1shotapi.com/v0/token";

interface OAuth2TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const clientId = process.env.ONE_SHOT_API_CLIENT_ID;
  const clientSecret = process.env.ONE_SHOT_API_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "ONE_SHOT_API_CLIENT_ID and ONE_SHOT_API_CLIENT_SECRET must be set"
    );
  }

  const res = await fetch(ONE_SHOT_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`1Shot OAuth2 failed (${res.status}): ${text}`);
  }

  const data: OAuth2TokenResponse = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };

  return data.access_token;
}

async function apiFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getAccessToken();
  return fetch(`${ONE_SHOT_API_BASE}${path}`, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
}

export interface ExecuteMethodParams {
  methodId: string;
  args: Record<string, unknown>;
}

export interface ExecuteMethodResult {
  tx_hash: string;
  status: string;
  chain_id?: number;
}

export interface BusinessMethod {
  id: string;
  name: string;
  description: string;
  chain_id: number;
  contract_address: string;
}

export async function getBusinessMethods(): Promise<BusinessMethod[]> {
  const businessId = process.env.ONE_SHOT_API_BUSINESS_ID;
  if (!businessId) {
    throw new Error("ONE_SHOT_API_BUSINESS_ID must be set");
  }
  const res = await apiFetch(`/business/${businessId}/methods`);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to fetch business methods (${res.status}): ${text}`);
  }
  const data = await res.json();
  return data.methods ?? data.data ?? data;
}

export async function executeMethod(
  methodId: string,
  args: Record<string, unknown>
): Promise<ExecuteMethodResult> {

  const walletId = process.env.ONE_SHOT_API_TREASURY_WALLET_ID;

  const body: Record<string, unknown> = { args };

  if (walletId) {
    body.wallet_id = walletId;
  }

  const res = await apiFetch(`/methods/${methodId}/execute`, {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`1Shot executeMethod failed (${res.status}): ${text}`);
  }

  return res.json();
}

const RELAYER_URL_MAINNET = "https://relayer.1shotapi.com/relayers";
const RELAYER_URL_DEV = "https://relayer.1shotapi.dev/relayers";

function getRelayerUrl(chainId: string): string {
  // Use dev relayer for Sepolia (11155111) and Base Sepolia (84532)
  if (chainId === "11155111" || chainId === "84532") {
    return RELAYER_URL_DEV;
  }
  return RELAYER_URL_MAINNET;
}

export async function getRelayerCapabilities(chainIds: string[]) {
  // Use the first chainId to determine the relayer URL
  const url = getRelayerUrl(chainIds[0]);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "relayer_getCapabilities",
      params: [chainIds],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`relayer_getCapabilities failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  if (data.error) {
    throw new Error(`relayer_getCapabilities RPC error: ${JSON.stringify(data.error)}`);
  }

  return data.result;
}

export async function estimateRelayerTransaction(params: Record<string, unknown>) {
  const chainId = String(params.chainId);
  const url = getRelayerUrl(chainId);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "relayer_estimate7710Transaction",
      params,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`relayer_estimate7710Transaction failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  if (data.error) {
    throw new Error(`relayer_estimate7710Transaction RPC error: ${JSON.stringify(data.error)}`);
  }

  return data.result; // Estimate7710TransactionResult
}

export async function sendRelayerTransaction(params: Record<string, unknown>) {
  const chainId = String(params.chainId);
  const url = getRelayerUrl(chainId);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "relayer_send7710Transaction",
      params,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`relayer_send7710Transaction failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  if (data.error) {
    throw new Error(`relayer_send7710Transaction RPC error: ${JSON.stringify(data.error)}`);
  }

  return data.result; // TaskId
}

export async function getRelayerStatus(taskId: string, chainId: string = "84532") {
  const url = getRelayerUrl(chainId);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "relayer_getStatus",
      params: { id: taskId, logs: false },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`relayer_getStatus failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  if (data.error) {
    throw new Error(`relayer_getStatus RPC error: ${JSON.stringify(data.error)}`);
  }

  return data.result;
}

export async function testMethod(
  methodId: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const res = await apiFetch(`/methods/${methodId}/test`, {
    method: "POST",
    body: JSON.stringify({ args }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "") ?? "";
    throw new Error(`1Shot testMethod failed (${res.status}): ${text}`);
  }

  return res.json();
}

export function resetTokenCache(): void {
  cachedToken = null;
}
