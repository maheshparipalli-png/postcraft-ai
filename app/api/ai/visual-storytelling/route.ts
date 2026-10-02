import { NextResponse } from "next/server";
import { getBillingAccess } from "@/lib/billing/access";
import { createClient } from "@/lib/supabase/server";
import { generateVisualStorytellingPlan } from "@/lib/ai/visual-storytelling";
import type { VisualStyle } from "@/lib/postcard/visual-styles";

export const maxDuration = 120;
const styles = new Set<VisualStyle>(["editorial","cartoon","hand-drawn","3d","anime","watercolor","cinematic"]);

export async function POST(request: Request) {
  const access=await getBillingAccess();
  if(!access.allowed) return NextResponse.json({error:access.authenticated?"An active PostCraft subscription or trial is required.":"Sign in to use Visual Studio."},{status:access.authenticated?402:401});
  try {
    const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser();
    if(!user) return NextResponse.json({error:"Authentication required."},{status:401});
    const body=await request.json();
    const headline=typeof body?.headline==="string"?body.headline.trim():"";
    const sourceBody=typeof body?.body==="string"?body.body.trim():"";
    const closing=typeof body?.closing==="string"?body.closing.trim():"";
    const visualStyle=typeof body?.visualStyle==="string"?body.visualStyle as VisualStyle:"editorial";
    const conceptIndex=Number.isInteger(body?.conceptIndex) && body.conceptIndex >= 0 && body.conceptIndex <= 3 ? body.conceptIndex : 0;
    if(!headline&&!sourceBody) return NextResponse.json({error:"Add an idea or LinkedIn post first."},{status:400});
    if(!styles.has(visualStyle)) return NextResponse.json({error:"Unsupported visual style."},{status:400});
    const plan=await generateVisualStorytellingPlan({headline,body:sourceBody,closing},visualStyle,conceptIndex);
    return NextResponse.json({ok:true,plan},{headers:{"Cache-Control":"no-store"}});
  } catch(error) {
    console.error("[PostCraft] visual storytelling failed",{message:error instanceof Error?error.message:String(error)});
    return NextResponse.json({error:error instanceof Error?error.message:"Could not analyze the visual idea."},{status:500});
  }
}
