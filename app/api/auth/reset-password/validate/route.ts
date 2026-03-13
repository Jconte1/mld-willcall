import { NextResponse } from "next/server";

const AUTH_API_BASE_URL = process.env.STAFF_API_BASE_URL || process.env.CUSTOMER_API_BASE_URL;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  if (!token) return NextResponse.json({ message: "Token is required" }, { status: 400 });

  if (!AUTH_API_BASE_URL) {
    return NextResponse.json(
      { message: "Auth backend not configured (STAFF_API_BASE_URL/CUSTOMER_API_BASE_URL missing)." },
      { status: 501 }
    );
  }

  const res = await fetch(
    `${AUTH_API_BASE_URL}/api/auth/reset-password/validate?token=${encodeURIComponent(token)}`,
    { method: "GET" }
  );

  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
