import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const token = session?.user?.staffToken;
  console.info("[staff-change-password][api] session", {
    hasSession: Boolean(session),
    userId: session?.user?.id,
    hasToken: Boolean(token),
  });
  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const backend = process.env.STAFF_API_BASE_URL;

  if (!backend) {
    return NextResponse.json(
      { message: "Staff backend not configured (STAFF_API_BASE_URL is missing)." },
      { status: 501 }
    );
  }

  try {
    const body = await req.json();
    const res = await fetch(`${backend}/api/staff/change-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
