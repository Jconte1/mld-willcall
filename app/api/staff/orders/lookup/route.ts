import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const STAFF_API_BASE_URL = process.env.STAFF_API_BASE_URL;

function getAuthHeader(session: any) {
  const token = session?.user?.staffToken;
  return token ? { Authorization: `Bearer ${token}` } : null;
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
  console.info("[staff-orders-lookup-proxy] request", {
    hasToken: Boolean(session?.user?.staffToken),
    orderNbr: (body as any)?.orderNbr,
  });
  const res = await fetch(`${STAFF_API_BASE_URL}/api/staff/pickups/orders/lookup`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  console.info("[staff-orders-lookup-proxy] response", {
    status: res.status,
    ok: res.ok,
    message: (data as any)?.message,
    hasOrder: Boolean((data as any)?.order),
  });
  return NextResponse.json(data, { status: res.status });
}
