import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth/staff";

/** Fil de messages d'une tentative, côté surveillant. GET : lit (et marque lu), POST : répond. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireStaff(req);
  if ("res" in s) return s.res;
  const admin = adminClient();
  const { error } = await admin.rpc("staff_read_messages", { p_actor: s.userId, p_attempt: id });
  if (error) return NextResponse.json({ error: error.message.split(":")[0] }, { status: 400 });
  const { data } = await admin.from("exam_messages").select("id, sender, body, created_at, read_at")
    .eq("attempt_id", id).order("id").limit(200);
  return NextResponse.json({ messages: data || [] });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireStaff(req);
  if ("res" in s) return s.res;
  const body = await req.json().catch(() => null);
  if (typeof body?.body !== "string") return NextResponse.json({ error: "message_invalid" }, { status: 400 });
  const { data, error } = await adminClient().rpc("staff_send_message", { p_actor: s.userId, p_attempt: id, p_body: body.body });
  if (error) return NextResponse.json({ error: error.message.split(":")[0] }, { status: 400 });
  return NextResponse.json(data);
}
