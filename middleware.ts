import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Protect staff routes and enforce must-change-password.

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  const isCustomerSetupRequired =
    Boolean((token as any)?.type === "customer") &&
    (Boolean((token as any)?.mustChangePassword) || Boolean((token as any)?.mustCompleteProfile));

  // Keep customers on dashboard root until one-time setup is complete.
  if (isCustomerSetupRequired && pathname !== "/") {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  if (!pathname.startsWith("/staff")) {
    return NextResponse.next();
  }

  // Public staff routes
  const isLogin = pathname === "/staff/login";
  const isLogout = pathname === "/staff/logout";
  const isChangePassword = pathname === "/staff/change-password";
  const isForbidden = pathname === "/staff/forbidden";

  if (isLogin) {
    return NextResponse.next();
  }

  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/staff/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Force password change before allowing anything else.
  if ((token as any).mustChangePassword && !isChangePassword && !isLogout) {
    const url = req.nextUrl.clone();
    url.pathname = "/staff/change-password";
    return NextResponse.redirect(url);
  }

  // Admin-only routes.
  if (pathname.startsWith("/staff/users") && (token as any).role !== "ADMIN") {
    if (isForbidden) return NextResponse.next();
    const url = req.nextUrl.clone();
    url.pathname = "/staff/forbidden";
    return NextResponse.rewrite(url, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/schedule", "/items", "/details", "/confirmation", "/orders/:path*", "/appointments/:path*", "/staff/:path*"],
};
