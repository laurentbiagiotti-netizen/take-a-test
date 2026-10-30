import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth/staff";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireStaff(req);
  if ("res" in s) return s.res;
  const { score, feedback } = await req.json().catch(() => ({}));
  const v = score === null || score === undefined || score === "" ? null : Number(score);
  if (v !== null && !Number.isFinite(v)) return NextResponse.json({ error: "Note invalide" }, { status: 400 });
  const { data, error } = await adminClient().rpc("grade_answer", {
    p_actor: s.userId, p_answer: id, p_score: v, p_feedback: typeof feedback === "string" ? feedback : null,
  });
  if (error) {
    const code = error.message.split(":")[0];
    return NextResponse.json({ error: code === "score_out_of_range" ? "Note hors barème" : code }, { status: 400 });
  }
  return NextResponse.json(data);
}
