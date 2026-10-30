import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth/staff";
import { kickWebhooks } from "@/lib/webhooks";

const ACTIONS = new Set(["reset_session", "extend_time", "terminate", "review_identity", "reset_attempt"]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireStaff(req);
  if ("res" in s) return s.res;
  const body = await req.json().catch(() => null);
  if (!body || !ACTIONS.has(body.action)) return NextResponse.json({ error: "bad_action" }, { status: 400 });
  const { data, error } = await adminClient().rpc("staff_action", {
    p_actor: s.userId, p_attempt: id, p_action: body.action, p_arg: body.arg ?? {},
  });
  if (error) return NextResponse.json({ error: error.message.split(":")[0] }, { status: 400 });
  if (body.action === "terminate") kickWebhooks();
  return NextResponse.json(data);
}
