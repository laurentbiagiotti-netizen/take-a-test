import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sameOrigin } from "@/lib/security/request";

/** Vérifie que l'appelant est surveillant ou admin (et anti-CSRF pour les POST). */
export async function requireStaff(req: NextRequest, adminOnly = false):
  Promise<{ userId: string; role: "admin" | "proctor" } | { res: NextResponse }> {
  if (req.method !== "GET" && !sameOrigin(req)) return { res: NextResponse.json({ error: "bad_origin" }, { status: 403 }) };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { res: NextResponse.json({ error: "not_signed_in" }, { status: 401 }) };
  const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const ok = adminOnly ? p?.role === "admin" : p?.role === "admin" || p?.role === "proctor";
  if (!ok) return { res: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  return { userId: user.id, role: p!.role };
}
