/**
 * JWT sign/verify utilities using jose library
 * Used for authenticating wallet-based sessions
 */

import { SignJWT, jwtVerify, JWTPayload } from "jose";

const JWT_ALGORITHM = "HS256";
const JWT_EXPIRY = "24h";

/**
 * Gets the JWT secret from environment variable
 * @returns Uint8Array - The JWT secret as bytes
 * @throws Error if JWT_SECRET environment variable is not set
 */
export function getJWTSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is not set. Set it in .env.local");
  }
  return new TextEncoder().encode(secret);
}

/**
 * Signs a JWT with wallet_address in payload
 * @param payload - Additional payload data to include
 * @param subject - Optional subject (sub) claim
 * @returns Promise<string> - Signed JWT token
 * @throws Error if signing fails
 */
export async function signJWT(
  payload: Record<string, unknown>,
  subject?: string
): Promise<string> {
  try {
    const secret = getJWTSecret();

    const jwt = await new SignJWT(payload)
      .setProtectedHeader({ alg: JWT_ALGORITHM })
      .setIssuedAt()
      .setExpirationTime(JWT_EXPIRY)
      .setSubject(subject ?? (payload.wallet_address as string));

    const token = await jwt.sign(secret);
    return token;
  } catch (error) {
    throw new Error(
      `Failed to sign JWT: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Verifies and decodes a JWT token
 * @param token - The JWT token to verify
 * @returns Promise<Record<string, unknown>> - Decoded payload
 * @throws Error if verification fails
 */
export async function verifyJWT(
  token: string
): Promise<Record<string, unknown>> {
  try {
    const secret = getJWTSecret();

    const { payload } = await jwtVerify(token, secret, {
      algorithms: [JWT_ALGORITHM],
    });

    return payload as Record<string, unknown>;
  } catch (error) {
    throw new Error(
      `Failed to verify JWT: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

// Re-export JWTPayload type for use in other modules
export type { JWTPayload };