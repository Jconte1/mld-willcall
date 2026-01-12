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
  baid: z
    .string()
    .transform((v) => v.replace(/\s+/g, "").toUpperCase())
    .refine((v) => /^BA\d{7}$/.test(v), { message: "BAID must be BA followed by 7 digits" }),
  password: z.string().min(6, "Password must be at least 6 characters"),
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
  return NextResponse.json(data, { status: res.status });
}
