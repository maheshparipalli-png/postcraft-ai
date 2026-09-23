import { NextResponse } from "next/server";
import { verifySourceUrl } from "@/lib/research/verify-source";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const url = typeof body?.url === "string" ? body.url.trim() : "";
    if (!url || url.length > 2048) {
      return NextResponse.json({ error: "Enter a valid source URL (maximum 2048 characters)." }, { status: 400 });
    }
    return NextResponse.json(await verifySourceUrl(url));
  } catch (error) {
    console.error("Source verification failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "PostCraft could not verify the original source." },
      { status: 502 },
    );
  }
}
