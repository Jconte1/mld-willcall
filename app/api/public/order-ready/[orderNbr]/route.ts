import { NextResponse } from "next/server";
import { z } from "zod";

const CUSTOMER_API_BASE_URL = process.env.CUSTOMER_API_BASE_URL;

const querySchema = z.object({
  token: z.string().min(1),
});

export async function GET(req: Request, context: { params: { orderNbr: string } }) {
  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse({ token: searchParams.get("token") });
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid token" }, { status: 400 });
  }

  if (!CUSTOMER_API_BASE_URL) {
    return NextResponse.json({ message: "Customer backend not configured" }, { status: 501 });
  }

  const res = await fetch(
    `${CUSTOMER_API_BASE_URL}/api/public/order-ready/${context.params.orderNbr}?token=${encodeURIComponent(
      parsed.data.token
    )}`
  );
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
