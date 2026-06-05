import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Protect staff routes and enforce must-change-password.

const OLD_WILLCALL_HOST = "mld-willcall.vercel.app";
const NEW_WILLCALL_HOST = "www.mld.com";
const NEW_WILLCALL_BASE_PATH = "/willcall";

export async function middleware(req: NextRequest) {
  const { pathname, hostname } = req.nextUrl;

  // Redirect old standalone Vercel app URLs to the new /willcall location.
  // This runs ONLY on mld-willcall.vercel.app, so www.mld.com will not loop.
  if (hostname === OLD_WILLCALL_HOST) {
    const url = req.nextUrl.clone();

    url.protocol = "https:";
    url.hostname = NEW_WILLCALL_HOST;
    url.port = "";

    let cleanPath = pathname;

    // Strip any accidental existing /willcall prefixes before adding exactly one.
    while (
      cleanPath === NEW_WILLCALL_BASE_PATH ||
      cleanPath.startsWith(`${NEW_WILLCALL_BASE_PATH}/`)
    ) {
      cleanPath = cleanPath.slice(NEW_WILLCALL_BASE_PATH.length) || "/";
    }

    url.pathname =
      cleanPath === "/"
        ? NEW_WILLCALL_BASE_PATH
        : `${NEW_WILLCALL_BASE_PATH}${cleanPath}`;

    // Use 307 while testing so browsers are less likely to cache bad redirects.
    // Change to 308 later once confirmed working.
    return NextResponse.redirect(url, 307);
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  const isCustomerSetupRequired =
    Boolean((token as any)?.type === "customer") &&
    (Boolean((token as any)?.mustChangePassword) ||
      Boolean((token as any)?.mustCompleteProfile));

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
  matcher: [
    /*
      Match page routes, but skip:
      - API routes
      - Next static/image assets
      - favicon
      - files with extensions like .png, .svg, .css, .js
    */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};