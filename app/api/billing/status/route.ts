import { NextResponse } from "next/server";
import { getBillingAccess } from "@/lib/billing/access";

export const dynamic = "force-dynamic";

export async function GET() {
  const access = await getBillingAccess();

  if (!access.authenticated) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (access.status === "billing_unavailable") {
    return NextResponse.json({ error: "Unable to load billing status" }, { status: 500 });
  }

  return NextResponse.json({
    status: access.status,
    allowed: access.allowed,
    subscription: access.subscription,
  });
}
