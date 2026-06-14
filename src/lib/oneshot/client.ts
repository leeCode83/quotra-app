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


