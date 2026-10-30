import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { appUrl } from "@/lib/security/env";
import { sameOrigin } from "@/lib/security/request";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "bad_origin" }, { status: 403 });
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", appUrl()), 303);
}
