import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "./middleware/auth";
import { withX402 } from "./middleware/x402";

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

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // Public routes — no middleware needed
  if (pathname === "/" || pathname.startsWith("/_next") || pathname.startsWith("/static") || pathname.startsWith("/favicon")) {
    return NextResponse.next();
  }

  // Public API routes — auth endpoints (login, register, etc.)
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // Payment routes need both JWT auth and x402 payment validation
  // withX402 reads request.auth (set by withAuth) to identify the consumer
  if (pathname.startsWith("/api/purchase") || pathname.startsWith("/api/payments")) {
    const handler = withAuth(withX402(async () => NextResponse.next()));
    return handler(request) as Promise<NextResponse>;
  }

  // All other API routes need JWT auth at minimum
  if (pathname.startsWith("/api/")) {
    const handler = withAuth(async () => NextResponse.next());
    return handler(request) as Promise<NextResponse>;
  }

  // Catch-all: pass through unhandled routes
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
