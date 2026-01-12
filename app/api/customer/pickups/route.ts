import { NextResponse } from "next/server";
import { z } from "zod";

const CUSTOMER_API_BASE_URL = process.env.CUSTOMER_API_BASE_URL;

const slotSchema = z.object({
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
});

const groupSchema = z.object({
  locationId: z.string().min(1),
  orderNbrs: z.array(z.string().min(1)).min(1),
  selectedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  selectedSlots: z.array(slotSchema).min(1),
});

const schema = z.object({
  userId: z.string().min(1),
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  smsOptIn: z.boolean().optional(),
  emailOptIn: z.boolean().optional(),
  vehicleInfo: z.string().optional(),
  notes: z.string().optional(),
  groups: z.array(groupSchema).min(1),
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
    return NextResponse.json(
      { message: "Customer backend not configured" },
      { status: 501 }
    );
  }

  const res = await fetch(`${CUSTOMER_API_BASE_URL}/api/customer/pickups`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed.data),
  });

  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
