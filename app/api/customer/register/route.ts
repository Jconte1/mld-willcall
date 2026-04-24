import { NextResponse } from "next/server";
import { z } from "zod";

const CUSTOMER_API_BASE_URL = process.env.CUSTOMER_API_BASE_URL;

const schema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Enter a valid email").transform((v) => v.toLowerCase().trim()),
  phone: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length === 10, { message: "Enter a 10-digit phone number" }),
  zip: z
    .string()
    .transform((v) => v.replace(/\D/g, "").slice(0, 5))
    .refine((v) => /^\d{5}$/.test(v), { message: "ZIP must be 5 digits" }),
  baid: z
    .string()
    .transform((v) => v.replace(/\s+/g, "").toUpperCase())
    .refine((v) => /^BA\d{7}$/.test(v), { message: "BAID must be BA followed by 7 digits" }),
  inviteCode: z.string().min(6, "Invite code is required"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[0-9]/, "Password must include at least 1 number")
    .regex(/[^A-Za-z0-9]/, "Password must include at least 1 symbol"),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid input", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  console.info("[customer-register][api] request", {
    email: parsed.data.email,
    baid: parsed.data.baid,
  });

  if (!CUSTOMER_API_BASE_URL) {
    // In this app, customer registration is backed by the willcall backend.
    return NextResponse.json(
      { message: "Customer registration backend not configured" },
      { status: 501 }
    );
  }

  const res = await fetch(`${CUSTOMER_API_BASE_URL}/api/customer/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed.data),
  });

  const data = await res.json().catch(() => ({}));
  console.info("[customer-register][api] response", {
    email: parsed.data.email,
    baid: parsed.data.baid,
    status: res.status,
    ok: res.ok,
    reasonCode: (data as any)?.reasonCode,
    message: (data as any)?.message,
  });
  return NextResponse.json(data, { status: res.status });
}
