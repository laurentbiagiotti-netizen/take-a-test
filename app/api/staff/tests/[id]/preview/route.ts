import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth/staff";
import { genCode } from "@/lib/security/tokens";
import { appUrl } from "@/lib/security/env";
import { accessLink } from "@/lib/exam/convocation";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Aperçu d'une épreuve par un admin, comme un candidat : un compte candidat
 * dédié (un par admin et par épreuve), un code neuf et une copie remise à zéro
 * à chaque fois. Marche aussi sur une épreuve non publiée. Le lien s'ouvre
 * dans une fenêtre privée pour ne pas remplacer la session de l'admin.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireStaff(req, true);
  if ("res" in s) return s.res;
  if (!UUID.test(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const admin = adminClient();
  const { data: test } = await admin.from("tests").select("id, title").eq("id", id).maybeSingle();
  if (!test) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { data: me } = await admin.from("profiles").select("full_name, email").eq("id", s.userId).maybeSingle();

  const email = `apercu-${s.userId.slice(0, 8)}-${id.slice(0, 8)}@exam.cybersup.ai`;
  // Copie précédente effacée : chaque aperçu repart de zéro
  const { data: prev } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
  if (prev) await admin.from("attempts").delete().eq("test_id", id).eq("candidate_id", prev.id);

  const code = genCode();
  const { error } = await admin.from("invites").upsert({
    test_id: id, email, code, preview: true, used_at: null, used_by: null,
    full_name: `Aperçu : ${me?.full_name || me?.email || "admin"}`,
  }, { onConflict: "test_id,email" });
  if (error) return NextResponse.json({ error: "Impossible de préparer l'aperçu." }, { status: 500 });
  return NextResponse.json({ link: accessLink(appUrl(), code), code });
}
