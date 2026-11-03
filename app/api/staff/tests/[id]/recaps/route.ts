import { NextRequest, NextResponse } from "next/server";
import { zipSync } from "fflate";
import { adminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth/staff";
import { recapData } from "@/lib/pdf/data";
import { recapFilename, renderRecap } from "@/lib/pdf/recap";

export const runtime = "nodejs";
export const maxDuration = 300;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Toutes les fiches de correction d'une épreuve (copies rendues ou closes), dans un .zip. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireStaff(req);
  if ("res" in s) return s.res;
  if (!UUID.test(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const admin = adminClient();
  const { data: test } = await admin.from("tests").select("title").eq("id", id).maybeSingle();
  if (!test) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { data: attempts } = await admin.from("attempts").select("id").eq("test_id", id).in("status", ["submitted", "expired", "terminated"]);
  if (!attempts?.length) return NextResponse.json({ error: "Aucune copie terminée." }, { status: 404 });
  const files: Record<string, Uint8Array> = {};
  // Une à une : la mémoire reste raisonnable même pour une grosse session.
  for (const a of attempts) {
    const d = await recapData(admin, a.id);
    if (!d) continue;
    let name = recapFilename(d.candidate, d.test);
    if (files[name]) name = name.replace(/\.pdf$/, `-${a.id.slice(0, 6)}.pdf`);
    files[name] = new Uint8Array(await renderRecap(d));
  }
  const zip = zipSync(files, { level: 6 });
  const slug = String(test.title).normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").slice(0, 60).toLowerCase();
  return new NextResponse(zip, { headers: {
    "Content-Type": "application/zip", "Cache-Control": "no-store",
    "Content-Disposition": `attachment; filename="fiches-${slug || id}.zip"`,
  } });
}
