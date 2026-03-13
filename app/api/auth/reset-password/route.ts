import { NextResponse } from "next/server";
import { z } from "zod";

const AUTH_API_BASE_URL = process.env.STAFF_API_BASE_URL || process.env.CUSTOMER_API_BASE_URL;

const bodySchema = z.object({
  token: z.string().min(10),
  newPassword: z.string().min(1),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  if (!AUTH_API_BASE_URL) {
    return NextResponse.json(
      { message: "Auth backend not configured (STAFF_API_BASE_URL/CUSTOMER_API_BASE_URL missing)." },
      { status: 501 }
    );
  }

  const res = await fetch(`${AUTH_API_BASE_URL}/api/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed.data),
  });

  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
