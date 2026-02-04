import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

function backendNotConfigured() {
  return NextResponse.json(
    { message: "Staff backend not configured (STAFF_API_BASE_URL is missing)." },
    { status: 501 }
  );
}

function getAuthHeader(session: any) {
  const token = session?.user?.staffToken;
  return token ? { Authorization: `Bearer ${token}` } : null;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const authHeader = getAuthHeader(session);
  if (!authHeader) {
    console.info("[staff-profile][api] missing auth");
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const backend = process.env.STAFF_API_BASE_URL;
  if (!backend) return backendNotConfigured();

  const res = await fetch(`${backend}/api/staff/profile`, {
    headers: authHeader,
  });

  const data = await res.json().catch(() => ({}));
  console.info("[staff-profile][api] GET", { status: res.status, ok: res.ok });
  return NextResponse.json(data, { status: res.status });
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  const authHeader = getAuthHeader(session);
  if (!authHeader) {
    console.info("[staff-profile][api] missing auth");
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const backend = process.env.STAFF_API_BASE_URL;
  if (!backend) return backendNotConfigured();

  const body = await req.json().catch(() => ({}));
  const res = await fetch(`${backend}/api/staff/profile`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeader },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  console.info("[staff-profile][api] PUT", { status: res.status, ok: res.ok });
  return NextResponse.json(data, { status: res.status });
}
