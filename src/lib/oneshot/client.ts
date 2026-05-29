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

export interface ExecuteAsDelegatorParams {
  methodId: string;
  delegationId: string;
  args: Record<string, unknown>;
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

export async function executeAsDelegator(
  methodId: string,
  delegationId: string,
  args: Record<string, unknown>
): Promise<ExecuteMethodResult> {
  const body: Record<string, unknown> = {
    args,
    delegation_id: delegationId,
  };

  const res = await apiFetch(`/methods/${methodId}/executeAsDelegator`, {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`1Shot executeAsDelegator failed (${res.status}): ${text}`);
  }

  return res.json();
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
