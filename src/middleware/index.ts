/**
 * Quotra Middleware
 *
 * Re-exports all middleware utilities for convenient imports
 *
 * @example
 * ```typescript
 * import { withAuth, withX402, withChain } from "@/middleware";
 * ```
 */

// Auth middleware
export {
  withAuth,
  unauthorized,
  serverError,
  type AuthContext,
  type AuthenticatedRequest,
  type AuthHandler,
} from "./auth";

// x402 payment middleware
export {
  withX402,
  paymentRequired,
  conflict,
  serverError as paymentServerError,
  type X402Headers,
  type PaymentContext,
  type PaymentRequest,
  type PaymentHandler,
} from "./x402";

// Chain composition
export {
  chain,
  withChain,
  type Middleware,
} from "./chain";
