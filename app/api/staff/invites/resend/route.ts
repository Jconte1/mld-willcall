import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

function backendNotConfigured() {
  return NextResponse.json(
    { message: "Staff backend not configured (STAFF_API_BASE_URL is missing)." },
    { status: 501 }
  );
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.staffToken) {
    console.info("[staff-invite-resend][api] unauthorized (no staff session)", {
      hasSession: Boolean(session),
      hasStaffToken: Boolean(session?.user?.staffToken),
      userEmail: session?.user?.email ?? null,
      userRole: session?.user?.role ?? null,
    });
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const backend = process.env.STAFF_API_BASE_URL;
  if (!backend) {
    console.info("[staff-invite-resend][api] missing STAFF_API_BASE_URL");
    return backendNotConfigured();
  }

  const token = process.env.WILLCALL_INVITE_TOKEN;
  if (!token) {
    console.info("[staff-invite-resend][api] missing WILLCALL_INVITE_TOKEN");
    return NextResponse.json({ message: "Invite token not configured." }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  console.info("[staff-invite-resend][api] dispatching", {
    hasBody: Boolean(body),
    hasCustomerId: Boolean((body as any)?.customerId),
    hasBillingZip: Boolean((body as any)?.billingZip),
    hasEmail: Boolean((body as any)?.email),
  });
  const res = await fetch(`${backend}/api/internal/invites/dispatch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ ...body, sendEmail: true }),
  });

  const data = await res.json().catch(() => ({}));
  console.info("[staff-invite-resend][api] dispatch response", {
    status: res.status,
    ok: res.ok,
    message: (data as any)?.message ?? null,
  });
  return NextResponse.json(data, { status: res.status });
}
