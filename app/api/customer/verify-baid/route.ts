import { NextResponse } from "next/server";
import { z } from "zod";

const CUSTOMER_API_BASE_URL = process.env.CUSTOMER_API_BASE_URL;

const schema = z.object({
  baid: z
    .string()
    .transform((v) => v.replace(/\s+/g, "").toUpperCase())
    .refine((v) => /^BA\d{7}$/.test(v), { message: "BAID must be BA followed by 7 digits" }),
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

  // Forward to backend if configured.
  if (CUSTOMER_API_BASE_URL) {
    const res = await fetch(`${CUSTOMER_API_BASE_URL}/api/customer/verify-baid`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Backend will normalize/case-handle; we still pass a clean value.
      body: JSON.stringify({ baid: parsed.data.baid.toLowerCase() }),
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.ok === true) console.log(`[verify-baid] BAID found: ${parsed.data.baid}`);
    return NextResponse.json(data, { status: res.status });
  }

  return NextResponse.json(
    { message: "BAID verification backend not configured" },
    { status: 501 }
  );
}
