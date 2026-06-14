import * as ed from "@noble/ed25519";
import Crypto from "node:crypto";
import stringify from "safe-stable-stringify";

ed.hashes.sha512 = (m: Uint8Array) =>
  new Uint8Array(Crypto.createHash("sha512").update(Buffer.from(m)).digest());

type Jwk = { kty: "OKP"; crv: "Ed25519"; kid: string; x: string };
type Jwks = { keys: Jwk[] };

let jwksCache: { fetchedAt: number; keys: Map<string, Uint8Array> } | null = null;
const JWKS_TTL_MS = 10 * 60_000;
const JWKS_URL = "https://relayer.1shotapi.com/.well-known/jwks.json";

function base64urlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/").padEnd(b64url.length + (4 - (b64url.length % 4)) % 4, "=");
  return new Uint8Array(Buffer.from(b64, "base64"));
}

async function getJwks(force = false): Promise<Map<string, Uint8Array>> {
  if (!force && jwksCache && Date.now() - jwksCache.fetchedAt < JWKS_TTL_MS) return jwksCache.keys;
  const res = await fetch(JWKS_URL);
  if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);
  const { keys } = (await res.json()) as Jwks;
  const map = new Map<string, Uint8Array>();
  for (const k of keys) {
    if (k.kty === "OKP" && k.crv === "Ed25519") map.set(k.kid, base64urlToBytes(k.x));
  }
  jwksCache = { fetchedAt: Date.now(), keys: map };
  return map;
}

export async function verifyRelayerWebhook(body: Record<string, unknown>): Promise<boolean> {
  const sigB64 = body.signature as string | undefined;
  const keyId = body.keyId as string | undefined;
  if (!sigB64 || !keyId) return false;

  let keys = await getJwks();
  let pub = keys.get(keyId);
  if (!pub) {
    keys = await getJwks(true);
    pub = keys.get(keyId);
    if (!pub) return false;
  }

  const rest: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (k !== "signature") rest[k] = v;
  }
  const message = new TextEncoder().encode(stringify(rest) as string);
  const sig = new Uint8Array(Buffer.from(sigB64, "base64"));
  return ed.verify(sig, message, pub);
}
