import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

/**
 * First line of defence for PAGES only: unauthenticated visitors are sent to /login.
 * Real authorization (roles, ownership) happens server-side in lib/permissions.ts and in each API route.
 */
export async function middleware(req: NextRequest) {
  if (req.nextUrl.pathname === "/login") return NextResponse.next();

  const token = req.cookies.get("nw_session")?.value;
  const secret = process.env.AUTH_SECRET;

  if (token && secret) {
    try {
      await jwtVerify(token, new TextEncoder().encode(secret));
      return NextResponse.next();
    } catch {
      // fall through to redirect
    }
  }

  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
