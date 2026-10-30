import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth/staff";

/** Vérifie l'intégrité du journal de surveillance (chaîne de hash). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireStaff(req);
  if ("res" in s) return s.res;
  const { data, error } = await adminClient().rpc("verify_event_chain", { p_attempt: id });
  if (error) return NextResponse.json({ error: "server_error" }, { status: 500 });
  return NextResponse.json(Array.isArray(data) ? data[0] : data);
}
