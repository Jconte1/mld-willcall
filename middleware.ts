import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Protect staff routes and enforce must-change-password.

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  const isCustomerSetupRequired =
    Boolean((token as any)?.type === "customer") &&
    (Boolean((token as any)?.mustChangePassword) ||
      Boolean((token as any)?.mustCompleteProfile));

  // Keep customers on dashboard root until one-time setup is complete.
  if (isCustomerSetupRequired && pathname !== "/willcall") {
    const url = req.nextUrl.clone();
    url.pathname = "/willcall";
    return NextResponse.redirect(url);
  }

  const staffPath = pathname === "/willcall/staff" || pathname.startsWith("/willcall/staff/");

  if (!staffPath) {
    return NextResponse.next();
  }

  // Public staff routes
  const isLogin = pathname === "/willcall/staff/login";
  const isLogout = pathname === "/willcall/staff/logout";
  const isChangePassword = pathname === "/willcall/staff/change-password";
  const isForbidden = pathname === "/willcall/staff/forbidden";

  if (isLogin) {
    return NextResponse.next();
  }

  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/willcall/staff/login";
    url.searchParams.set("next", pathname.replace(/^\/willcall/, "") || "/");
    return NextResponse.redirect(url);
  }

  // Force password change before allowing anything else.
  if ((token as any).mustChangePassword && !isChangePassword && !isLogout) {
    const url = req.nextUrl.clone();
    url.pathname = "/willcall/staff/change-password";
    return NextResponse.redirect(url);
  }

  // Admin-only routes.
  if (pathname.startsWith("/willcall/staff/users") && (token as any).role !== "ADMIN") {
    if (isForbidden) return NextResponse.next();

    const url = req.nextUrl.clone();
    url.pathname = "/willcall/staff/forbidden";

    return NextResponse.rewrite(url, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/willcall",
    "/willcall/schedule",
    "/willcall/items",
    "/willcall/details",
    "/willcall/confirmation",
    "/willcall/orders/:path*",
    "/willcall/appointments/:path*",
    "/willcall/staff/:path*",
  ],
};