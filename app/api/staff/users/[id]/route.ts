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

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const authHeader = getAuthHeader(session);
  if (!authHeader) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const backend = process.env.STAFF_API_BASE_URL;
  if (!backend) return backendNotConfigured();

  const res = await fetch(`${backend}/api/staff/users/${params.id}`, {
    headers: authHeader,
  });

  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const authHeader = getAuthHeader(session);
  if (!authHeader) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const backend = process.env.STAFF_API_BASE_URL;
  if (!backend) return backendNotConfigured();

  const body = await req.json().catch(() => ({}));
  const res = await fetch(`${backend}/api/staff/users/${params.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeader },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
