/**
 * Quotra Proxy Middleware
 *
 * Simple pass-through proxy for Next.js 16.
 * All request authentication and payment gating is handled
 * individually by each route handler via @x402/next withX402
 * or by checking the x-wallet-address header directly.
 *
 * No JWT, no Bearer token, no custom middleware pipeline.
 */

import { NextRequest, NextResponse } from "next/server";

export async function proxy(_request: NextRequest): Promise<NextResponse> {
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
