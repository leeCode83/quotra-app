/**
 * Authentication middleware for Next.js API routes
 * Validates JWT tokens and passes wallet_address to handlers
 */

import { verifyJWT } from "@/lib/jwt";
import { NextRequest, NextResponse } from "next/server";

/**
 * Auth context passed to handlers after successful authentication
 */
export interface AuthContext {
  wallet_address: string;
}

/**
 * Extended Next.js Request with auth context
 * This allows handlers to access auth info via request.auth
 */
export interface AuthenticatedRequest extends NextRequest {
  auth: AuthContext;
}

/**
 * Auth handler function signature - receives auth context
 */
export type AuthHandler<T = AuthContext> = (
  request: AuthenticatedRequest,
  context: T
) => Promise<Response> | Response;

/**
 * Wraps an API route handler with JWT authentication
 *
 * Extracts Bearer token from Authorization header,
 * verifies it using verifyJWT(), and passes decoded
 * payload (wallet_address, sub) to the handler via context.
 *
 * @param handler - The actual API route handler
 * @returns Wrapped handler that enforces authentication
 *
 * @example
 * ```typescript
 * // In your API route:
 * export const GET = withAuth(async (request, context) => {
 *   const { wallet_address } = context;
 *   // Use wallet_address for authorized operations
 *   return Response.json({ address: wallet_address });
 * });
 * ```
 */
export function withAuth<T = AuthContext>(
  handler: AuthHandler<T>
): (request: NextRequest) => Promise<Response> {
  return async (request: NextRequest) => {
    // Extract Authorization header
    const authHeader = request.headers.get("Authorization");

    if (!authHeader) {
      return jsonResponse(
        { error: "Missing Authorization header" },
        401
      );
    }

    // Validate Bearer token format
    if (!authHeader.startsWith("Bearer ")) {
      return jsonResponse(
        { error: "Invalid Authorization header format. Use: Bearer <token>" },
        401
      );
    }

    const token = authHeader.slice(7); // Remove "Bearer " prefix

    if (!token) {
      return jsonResponse(
        { error: "Missing JWT token" },
        401
      );
    }

    // Verify JWT and extract payload
    let decoded: Record<string, unknown>;
    try {
      decoded = await verifyJWT(token);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid token";
      return jsonResponse(
        { error: `JWT verification failed: ${message}` },
        401
      );
    }

    // Extract wallet_address from decoded payload
    const wallet_address = decoded.wallet_address as string | undefined;

    if (!wallet_address) {
      return jsonResponse(
        { error: "Token missing wallet_address claim" },
        401
      );
    }

    // Validate wallet address format (0x + 40 hex chars)
    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet_address)) {
      return jsonResponse(
        { error: "Invalid wallet_address format in token" },
        401
      );
    }

    // Create authenticated request with auth context
    const authenticatedRequest = request as AuthenticatedRequest;
    authenticatedRequest.auth = {
      wallet_address,
    };

    // Create context object for the handler
    const context: T = {
      wallet_address,
    } as T;

    // Call the actual handler with auth context
    try {
      return await handler(authenticatedRequest, context);
    } catch (error) {
      console.error("[Auth] Handler error:", error);
      return jsonResponse(
        { error: "Internal server error" },
        500
      );
    }
  };
}

/**
 * Creates a JSON response with proper headers
 */
function jsonResponse(
  data: Record<string, unknown>,
  status: number
): Response {
  return NextResponse.json(data, { status });
}

/**
 * Helper to create a 401 Unauthorized response
 */
export function unauthorized(message: string): Response {
  return jsonResponse({ error: message }, 401);
}

/**
 * Helper to create a 500 Internal Server Error response
 */
export function serverError(message: string): Response {
  return jsonResponse({ error: message }, 500);
}
