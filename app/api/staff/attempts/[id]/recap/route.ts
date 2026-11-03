import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth/staff";
import { recapData } from "@/lib/pdf/data";
import { recapFilename, renderRecap } from "@/lib/pdf/recap";

export const runtime = "nodejs";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Fiche de correction PDF d'un candidat. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireStaff(req);
  if ("res" in s) return s.res;
  if (!UUID.test(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const d = await recapData(adminClient(), id);
  if (!d) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const pdf = await renderRecap(d);
  return new NextResponse(new Uint8Array(pdf), { headers: {
    "Content-Type": "application/pdf", "Cache-Control": "no-store",
    "Content-Disposition": `inline; filename="${recapFilename(d.candidate, d.test)}"`,
  } });
}
