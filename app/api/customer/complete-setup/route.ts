import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";

const CUSTOMER_API_BASE_URL = process.env.CUSTOMER_API_BASE_URL;

const schema = z.object({
  name: z.string().min(2, "Name is required"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[0-9]/, "Password must include at least 1 number")
    .regex(/[^A-Za-z0-9]/, "Password must include at least 1 symbol"),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.id || user?.type !== "customer") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  if (!CUSTOMER_API_BASE_URL) {
    return NextResponse.json(
      { message: "Customer onboarding backend not configured" },
      { status: 501 }
    );
  }

  const res = await fetch(`${CUSTOMER_API_BASE_URL}/api/customer/complete-setup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: user.id,
      name: parsed.data.name,
      password: parsed.data.password,
    }),
  });

  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}

