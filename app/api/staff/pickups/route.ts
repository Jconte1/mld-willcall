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
  console.info("[staff-pickups-proxy] GET", {
    path: "/api/staff/pickups",
    query: url.searchParams.toString(),
    hasToken: Boolean(session?.user?.staffToken),
  });
  const res = await fetch(`${STAFF_API_BASE_URL}/api/staff/pickups?${url.searchParams.toString()}`, {
    headers: authHeader,
  });

  const data = await res.json().catch(() => ({}));
  console.info("[staff-pickups-proxy] GET response", {
    status: res.status,
    ok: res.ok,
    count: Array.isArray((data as any)?.pickups) ? (data as any).pickups.length : undefined,
  });
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
  const isLookupRequest = Boolean((body as any)?.lookupOrder) && typeof (body as any)?.orderNbr === "string";
  const target = isLookupRequest
    ? `${STAFF_API_BASE_URL}/api/staff/pickups/orders/lookup`
    : `${STAFF_API_BASE_URL}/api/staff/pickups`;
  const payload = isLookupRequest ? { orderNbr: (body as any).orderNbr } : body;
  console.info("[staff-pickups-proxy] POST", {
    mode: isLookupRequest ? "lookup" : "create",
    target,
    orderNbr: (payload as any)?.orderNbr,
    hasToken: Boolean(session?.user?.staffToken),
  });

  const res = await fetch(target, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  console.info("[staff-pickups-proxy] POST response", {
    mode: isLookupRequest ? "lookup" : "create",
    status: res.status,
    ok: res.ok,
    message: (data as any)?.message,
    hasOrder: Boolean((data as any)?.order),
    hasPickup: Boolean((data as any)?.pickup),
  });
  return NextResponse.json(data, { status: res.status });
}
