import { NextResponse } from "next/server";
import { z } from "zod";

const CUSTOMER_API_BASE_URL = process.env.CUSTOMER_API_BASE_URL;

const schema = z.object({
  locationId: z.string().min(1),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const parsed = schema.safeParse({
    locationId: searchParams.get("locationId"),
    from: searchParams.get("from"),
    to: searchParams.get("to"),
  });

  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid query parameters" }, { status: 400 });
  }

  if (!CUSTOMER_API_BASE_URL) {
    return NextResponse.json({ message: "Customer backend not configured" }, { status: 501 });
  }

  const params = new URLSearchParams(parsed.data);
  const res = await fetch(`${CUSTOMER_API_BASE_URL}/api/customer/pickups/availability?${params.toString()}`);
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
