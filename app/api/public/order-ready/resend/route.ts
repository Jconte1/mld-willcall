import { NextResponse } from "next/server";
import { z } from "zod";

const CUSTOMER_API_BASE_URL = process.env.CUSTOMER_API_BASE_URL;

const schema = z
  .object({
    orderNbr: z.string().min(1),
    email: z.string().email().optional(),
    phone: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.email && !data.phone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "email or phone is required",
      });
    }
    if (data.email && data.phone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "provide only one of email or phone",
      });
    }
  });

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "If your information matches, you will receive a link shortly." },
      { status: 200 }
    );
  }

  if (!CUSTOMER_API_BASE_URL) {
    return NextResponse.json(
      { message: "Customer backend not configured" },
      { status: 501 }
    );
  }

  const res = await fetch(`${CUSTOMER_API_BASE_URL}/api/public/order-ready/resend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed.data),
  });

  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
