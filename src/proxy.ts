import { NextResponse } from "next/server";

// Re-export all middleware utilities so imports can migrate from "@/middleware" to "@/proxy"
export {
  withAuth,
  unauthorized,
  serverError,
  type AuthContext,
  type AuthenticatedRequest,
  type AuthHandler,
} from "./middleware/auth";

export {
  withX402,
  paymentRequired,
  conflict,
  serverError as paymentServerError,
  type X402Headers,
  type PaymentContext,
  type PaymentRequest,
  type PaymentHandler,
} from "./middleware/x402";

export {
  chain,
  withChain,
  type Middleware,
} from "./middleware/chain";

export const config = {
  matcher: [
    "/api/:path*",
  ],
};

export async function proxy(): Promise<NextResponse> {
  return NextResponse.next();
}
