import { NextResponse } from "next/server";
import { z } from "zod";

const CUSTOMER_API_BASE_URL = process.env.CUSTOMER_API_BASE_URL;

const schema = z.object({
  userId: z.string().min(1),
  email: z.string().email(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid input", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  if (!CUSTOMER_API_BASE_URL) {
    return NextResponse.json(
      { message: "Customer backend not configured" },
      { status: 501 }
    );
  }

  const res = await fetch(`${CUSTOMER_API_BASE_URL}/api/customer/pickups/${params.id}/cancel`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed.data),
  });

  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
