import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

function backendNotConfigured() {
  return NextResponse.json(
    { message: "Staff backend not configured (STAFF_API_BASE_URL is missing)." },
    { status: 501 }
  );
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.staffToken) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const backend = process.env.STAFF_API_BASE_URL;
  if (!backend) return backendNotConfigured();

  const token = process.env.WILLCALL_INVITE_TOKEN;
  if (!token) {
    return NextResponse.json({ message: "Invite token not configured." }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const res = await fetch(`${backend}/api/internal/invites/dispatch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ ...body, sendEmail: true }),
  });

  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
