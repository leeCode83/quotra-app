/**
 * Chain composition utility for middleware
 * Allows composing multiple middleware layers left-to-right
 */

import { NextRequest, NextResponse } from "next/server";
import type { AuthContext } from "./auth";
import type { PaymentContext } from "./x402";

/**
 * A single middleware layer in the chain
 * Each middleware transforms request and passes to next
 */
export type Middleware = (
  request: NextRequest,
  context?: Record<string, unknown>
) => Promise<Response> | Response;

/**
 * Composes multiple middleware into a single handler
 *
 * Middleware are applied left-to-right (first to last).
 * Each middleware receives the request and can:
 * - Return a response early (short-circuit)
 * - Transform the request and pass to next middleware
 * - Add properties to the request object for downstream handlers
 *
 * @param middlewares - Array of middleware functions to compose
 * @returns Single handler that applies all middleware in sequence
 *
 * @example
 * ```typescript
 * // Compose auth and payment middleware
 * const handler = chain([
 *   withAuth,
 *   withX402,
 * ], myRouteHandler);
 *
 * // Or with multiple middleware layers
 * const composed = chain([logRequest, validateInput, withAuth], handler);
 * ```
 */
export function chain(
  middlewares: Middleware[]
): (request: NextRequest) => Promise<Response> {
  if (middlewares.length === 0) {
    throw new Error("At least one middleware must be provided");
  }

  return async (request: NextRequest) => {
    const currentRequest = request;
    let currentContext: Record<string, unknown> = {};

    // Iterate through middleware chain
    for (let i = 0; i < middlewares.length; i++) {
      const middleware = middlewares[i];
      const response = await middleware(currentRequest, currentContext);

      // If middleware returns a response, short-circuit the chain
      // This happens when auth fails, payment fails, etc.
      if (response.status >= 400) {
        return response;
      }

      // Update request from middleware output for next middleware
      // Middleware may have added context properties
      if ("auth" in currentRequest) {
        currentContext = { ...currentContext, ...((currentRequest as unknown as AuthContext).wallet_address
          ? { wallet_address: (currentRequest as unknown as AuthContext).wallet_address }
          : {}) };
      }
    }

    // All middleware passed - continue to final handler
    // This shouldn't be reached in normal usage since
    // chain() returns a request handler, not a route handler
    // The actual route handler should be passed as last argument
    return NextResponse.json(
      { error: "Chain completed without handler" },
      { status: 500 }
    );
  };
}

/**
 * Creates a chained handler with a final route handler
 *
 * @param middlewares - Array of middleware to apply first
 * @param handler - Final route handler called after all middleware pass
 * @returns Complete request handler
 *
 * @example
 * ```typescript
 * const handler = withChain(
 *   [withAuth, withX402],
 *   async (request, context) => {
 *     // context has wallet_address (from auth)
 *     // context has payment (from x402)
 *     return Response.json({ success: true });
 *   }
 * );
 *
 * export const POST = handler;
 * ```
 */
export function withChain<T extends AuthContext & PaymentContext>(
  middlewares: Middleware[],
  handler: (request: NextRequest, context: T) => Promise<Response> | Response
): (request: NextRequest) => Promise<Response> {
  if (middlewares.length === 0) {
    // No middleware - just return handler wrapped
    return async (request: NextRequest) => handler(request, {} as T);
  }

  return async (request: NextRequest) => {
    const currentRequest = request;
    let enrichedContext: Record<string, unknown> = {};

    // Apply each middleware in sequence
    for (const middleware of middlewares) {
      const response = await middleware(currentRequest, enrichedContext);

      // Short-circuit on error response
      if (response.status >= 400) {
        return response;
      }

      // Preserve context from enriched request
      if ("auth" in currentRequest) {
        const auth = (currentRequest as AuthenticatedRequest).auth;
        if (auth) {
          enrichedContext = {
            ...enrichedContext,
            wallet_address: auth.wallet_address,
          };
        }
      }

      if ("payment" in currentRequest) {
        const payment = (currentRequest as PaymentAuthenticatedRequest).payment;
        if (payment) {
          enrichedContext = {
            ...enrichedContext,
            payment,
          };
        }
      }
    }

    // All middleware passed - call the final handler
    return handler(currentRequest, enrichedContext as T);
  };
}

// Type imports for context propagation
type AuthenticatedRequest = NextRequest & { auth?: AuthContext };
type PaymentAuthenticatedRequest = NextRequest & { payment?: PaymentContext["payment"] };
