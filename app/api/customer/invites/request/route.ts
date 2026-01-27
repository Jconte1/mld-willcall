import { NextResponse } from "next/server";
import { z } from "zod";

const CUSTOMER_API_BASE_URL = process.env.CUSTOMER_API_BASE_URL;

const schema = z.object({
  baid: z
    .string()
    .transform((v) => v.replace(/\s+/g, "").toUpperCase())
    .refine((v) => /^BA\d{7}$/.test(v), { message: "BAID must be BA followed by 7 digits" }),
  zip: z
    .string()
    .transform((v) => v.replace(/\D/g, "").slice(0, 5))
    .refine((v) => /^\d{5}$/.test(v), { message: "ZIP must be 5 digits" }),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid input" }, { status: 400 });
  }

  if (!CUSTOMER_API_BASE_URL) {
    return NextResponse.json({ message: "Customer backend not configured" }, { status: 501 });
  }

  const res = await fetch(`${CUSTOMER_API_BASE_URL}/api/customer/invites/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed.data),
  });

  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
