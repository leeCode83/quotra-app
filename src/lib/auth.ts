import { SignJWT, jwtVerify } from "jose";

const ALG = "HS256";

function getSecret(): Uint8Array {
  const secret = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("SUPABASE_JWT_SECRET environment variable is not set");
  }
  return new TextEncoder().encode(secret);
}

export interface JWTPayload {
  wallet_address: string;
  aud: "authenticated";
  role: "authenticated";
  iat: number;
  exp: number;
}

export async function signJWT(
  walletAddress: string,
  expiresInSeconds: number = 3600,
): Promise<string> {
  const secret = getSecret();
  const iat = Math.floor(Date.now() / 1000);
  const jwt = await new SignJWT({
    wallet_address: walletAddress.toLowerCase(),
    aud: "authenticated",
    role: "authenticated",
  })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt(iat)
    .setExpirationTime(iat + expiresInSeconds)
    .sign(secret);

  return jwt;
}

export async function verifyJWT(
  token: string,
): Promise<JWTPayload | null> {
  try {
    const secret = getSecret();
    const { payload } = await jwtVerify(token, secret);
    if (
      typeof payload.wallet_address !== "string" ||
      payload.aud !== "authenticated"
    ) {
      return null;
    }
    return {
      wallet_address: (payload.wallet_address as string).toLowerCase(),
      aud: "authenticated",
      role: "authenticated",
      iat: payload.iat as number,
      exp: payload.exp as number,
    };
  } catch {
    return null;
  }
}

const NONCE_TTL_MS = 5 * 60 * 1000;
const nonceStore = new Map<string, { nonce: string; expiresAt: number }>();

export function generateNonce(address: string): string {
  const nonce = crypto.randomUUID();
  nonceStore.set(address.toLowerCase(), {
    nonce,
    expiresAt: Date.now() + NONCE_TTL_MS,
  });
  return nonce;
}

export function consumeNonce(address: string): string | null {
  const entry = nonceStore.get(address.toLowerCase());
  if (!entry) return null;
  nonceStore.delete(address.toLowerCase());
  if (Date.now() > entry.expiresAt) return null;
  return entry.nonce;
}

function cleanupExpiredNonces(): void {
  const now = Date.now();
  for (const [key, entry] of nonceStore) {
    if (now > entry.expiresAt) nonceStore.delete(key);
  }
}
setInterval(cleanupExpiredNonces, 60_000);
