import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);

function logAuthRequest(req: Request, method: "GET" | "POST") {
  const url = new URL(req.url);
  const action = url.pathname.split("/").filter(Boolean).slice(-2).join("/");
  console.info("[willcall][next-auth] request", {
    method,
    pathname: url.pathname,
    action,
    host: req.headers.get("host"),
    forwardedHost: req.headers.get("x-forwarded-host"),
    forwardedProto: req.headers.get("x-forwarded-proto"),
    nextauthUrl: process.env.NEXTAUTH_URL,
    appBasePath: process.env.NEXT_PUBLIC_APP_BASE_PATH,
  });
}

export async function GET(req: Request, ctx: any) {
  logAuthRequest(req, "GET");
  return handler(req, ctx);
}

export async function POST(req: Request, ctx: any) {
  logAuthRequest(req, "POST");
  return handler(req, ctx);
}
