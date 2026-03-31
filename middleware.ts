import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Protect staff routes and enforce must-change-password.

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasBasePath = pathname.startsWith("/willcall/");
  const routePath = hasBasePath ? pathname.slice("/willcall".length) : pathname;
  const pathPrefix = hasBasePath ? "/willcall" : "";

  if (!routePath.startsWith("/staff")) {
    return NextResponse.next();
  }

  // Public staff routes
  const isLogin = routePath === "/staff/login";
  const isLogout = routePath === "/staff/logout";
  const isChangePassword = routePath === "/staff/change-password";
  const isForbidden = routePath === "/staff/forbidden";

  if (isLogin) {
    return NextResponse.next();
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = `${pathPrefix}/staff/login`;
    url.searchParams.set("next", routePath);
    return NextResponse.redirect(url);
  }

  // Force password change before allowing anything else.
  if ((token as any).mustChangePassword && !isChangePassword && !isLogout) {
    const url = req.nextUrl.clone();
    url.pathname = `${pathPrefix}/staff/change-password`;
    return NextResponse.redirect(url);
  }

  // Admin-only routes.
  if (routePath.startsWith("/staff/users") && (token as any).role !== "ADMIN") {
    if (isForbidden) return NextResponse.next();
    const url = req.nextUrl.clone();
    url.pathname = `${pathPrefix}/staff/forbidden`;
    return NextResponse.rewrite(url, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/staff/:path*", "/willcall/staff/:path*"],
};
