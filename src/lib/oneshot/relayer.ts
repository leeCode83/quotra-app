const RELAYER_URL =
  process.env.ONE_SHOT_RELAYER_URL ??
  "https://relayer.1shotapi.com/relayers";

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse<T = unknown> {
  jsonrpc: "2.0";
  id: number;
  result?: T;
  error?: { code: number; message: string };
}

let requestId = 1;

async function jsonRpcCall<T = unknown>(
  method: string,
  params?: Record<string, unknown>
): Promise<T> {
  const body: JsonRpcRequest = {
    jsonrpc: "2.0",
    id: requestId++,
    method,
    params,
  };

  const res = await fetch(RELAYER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "") ?? "";
    throw new Error(`Relayer HTTP error (${res.status}): ${text}`);
  }

  const data: JsonRpcResponse<T> = await res.json();

  if (data.error) {
    throw new Error(`Relayer error (${data.error.code}): ${data.error.message}`);
  }

  return data.result as T;
}

export interface RelayerCapabilities {
  chains: {
    chain_id: number;
    supported_fee_tokens: {
      address: string;
      symbol: string;
      decimals: number;
    }[];
    relayer_address: string;
  }[];
}

export interface FeeData {
  chain_id: number;
  fee_token: string;
  estimated_fee: string;
  estimated_gas: string;
  gas_price: string;
  conversion_rate?: string;
}

export interface TxStatus {
  status: "pending" | "confirmed" | "failed";
  tx_hash?: string;
  block_number?: number;
  error?: string;
}

export interface Send7710Result {
  status: string;
  tx_hash: string;
  relayer_tx_id: string;
}

export interface Estimate7710Result {
  estimated_gas: string;
  estimated_fee: string;
  fee_token: string;
}

export async function getCapabilities(): Promise<RelayerCapabilities> {
  return jsonRpcCall<RelayerCapabilities>("relayer_getCapabilities");
}

/**
 * Returns the correct targetAddress (relayer address) from capabilities for a given chainId.
 * This address must be used as the 'to' address for delegation.
 */
export async function getRelayerTargetAddress(chainId: number): Promise<string> {
  const caps = await getCapabilities();
  const chainCaps = caps.chains.find(c => c.chain_id === chainId);
  if (!chainCaps) {
    throw new Error(`Chain ${chainId} not supported by relayer`);
  }
  return chainCaps.relayer_address;
}

export async function getFeeData(
  chainId: number,
  feeToken: string
): Promise<FeeData> {
  return jsonRpcCall<FeeData>("relayer_getFeeData", {
    chain_id: chainId,
    fee_token: feeToken,
  });
}

export async function send7710Transaction(params: {
  chain_id: number;
  delegation_id: string;
  delegation_json: Record<string, unknown>;
  signed_delegation: string;
  consumer_address: string;
  call_data: string;
  fee_token: string;
  max_fee?: string;
}): Promise<Send7710Result> {
  return jsonRpcCall<Send7710Result>(
    "relayer_send7710Transaction",
    params
  );
}

export async function getStatus(
  relayerTxId: string
): Promise<TxStatus> {
  return jsonRpcCall<TxStatus>("relayer_getStatus", {
    relayer_tx_id: relayerTxId,
  });
}

export async function estimate7710Transaction(params: {
  chain_id: number;
  delegation_id: string;
  delegation_json: Record<string, unknown>;
  signed_delegation: string;
  consumer_address: string;
  call_data: string;
}): Promise<Estimate7710Result> {
  return jsonRpcCall<Estimate7710Result>(
    "relayer_estimate7710Transaction",
    params
  );
}
