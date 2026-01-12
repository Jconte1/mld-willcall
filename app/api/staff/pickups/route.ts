import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const STAFF_API_BASE_URL = process.env.STAFF_API_BASE_URL;

function getAuthHeader(session: any) {
  const token = session?.user?.staffToken;
  return token ? { Authorization: `Bearer ${token}` } : null;
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const authHeader = getAuthHeader(session);
  if (!authHeader) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (!STAFF_API_BASE_URL) {
    return NextResponse.json({ message: "Staff backend not configured" }, { status: 501 });
  }

  const url = new URL(req.url);
  const res = await fetch(`${STAFF_API_BASE_URL}/api/staff/pickups?${url.searchParams.toString()}`, {
    headers: authHeader,
  });

  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const authHeader = getAuthHeader(session);
  if (!authHeader) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (!STAFF_API_BASE_URL) {
    return NextResponse.json({ message: "Staff backend not configured" }, { status: 501 });
  }

  const body = await req.json().catch(() => ({}));
  const res = await fetch(`${STAFF_API_BASE_URL}/api/staff/pickups`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
