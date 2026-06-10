import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Protect staff routes and enforce must-change-password.
const rawBasePath = process.env.NEXT_PUBLIC_APP_BASE_PATH || "";
const appBasePath =
  rawBasePath && rawBasePath !== "/" ? rawBasePath.replace(/\/+$/, "") : "";
const canonicalWillCallUrl = "https://www.mld.com/willcall";
const legacyRedirectHosts = new Set(["mld-willcall.vercel.app"]);

function withoutBasePath(pathname: string) {
  if (!appBasePath) return pathname || "/";
  if (pathname === appBasePath) return "/";
  if (pathname.startsWith(`${appBasePath}/`)) {
    return pathname.slice(appBasePath.length) || "/";
  }
  return pathname || "/";
}

function legacyRedirectUrl(req: NextRequest) {
  const destination = new URL(canonicalWillCallUrl);
  const internalPath = withoutBasePath(req.nextUrl.pathname);

  if (internalPath !== "/") {
    destination.pathname = `${destination.pathname.replace(/\/+$/, "")}${internalPath}`;
  }

  destination.search = req.nextUrl.search;
  return destination;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const host = req.headers.get("host")?.toLowerCase().split(":")[0] || "";

  if (legacyRedirectHosts.has(host)) {
    return NextResponse.redirect(legacyRedirectUrl(req));
  }

  const appPathname = withoutBasePath(pathname);
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const staffPath = appPathname === "/staff" || appPathname.startsWith("/staff/");

  const isCustomerSetupRequired =
    Boolean((token as any)?.type === "customer") &&
    (Boolean((token as any)?.mustChangePassword) ||
      Boolean((token as any)?.mustCompleteProfile));

  // Keep customers on dashboard root until one-time setup is complete.
  if (!staffPath && isCustomerSetupRequired && appPathname !== "/") {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  if (!staffPath) {
    return NextResponse.next();
  }

  // Public staff routes
  const isLogin = appPathname === "/staff/login";
  const isLogout = appPathname === "/staff/logout";
  const isChangePassword = appPathname === "/staff/change-password";
  const isForbidden = appPathname === "/staff/forbidden";

  if (isLogin) {
    return NextResponse.next();
  }

  if (!token || (token as any).type !== "staff") {
    const url = req.nextUrl.clone();
    url.pathname = "/staff/login";
    url.searchParams.set("next", appPathname || "/");
    return NextResponse.redirect(url);
  }

  // Force password change before allowing anything else.
  if ((token as any).mustChangePassword && !isChangePassword && !isLogout) {
    const url = req.nextUrl.clone();
    url.pathname = "/staff/change-password";
    return NextResponse.redirect(url);
  }

  // Admin-only routes.
  if (appPathname.startsWith("/staff/users") && (token as any).role !== "ADMIN") {
    if (isForbidden) return NextResponse.next();

    const url = req.nextUrl.clone();
    url.pathname = "/staff/forbidden";

    return NextResponse.rewrite(url, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!(?:willcall/)?_next/static|(?:willcall/)?_next/image|favicon.ico|.*\\..*).*)",
  ],
};
