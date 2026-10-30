import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { deliverPendingWebhooks } from "@/lib/webhooks";
import { timingSafeEqual } from "@/lib/security/tokens";

/**
 * Tâche planifiée (toutes les minutes) :
 *  - clôt les épreuves dont le temps est écoulé (même si le candidat a fermé la page)
 *  - envoie les webhooks en attente
 *  - purge les photos (webcam, identité) au-delà de la durée de conservation (RGPD)
 * Appel : GET avec  Authorization: Bearer <CRON_SECRET>
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET || "";
  const got = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (secret.length < 32 || !timingSafeEqual(got, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const admin = adminClient();
  const { data: expired } = await admin.rpc("expire_overdue_attempts");
  const webhooks = await deliverPendingWebhooks(50);

  let purged = 0;
  const { data: toPurge } = await admin.rpc("media_to_purge");
  for (const row of (toPurge || []) as any[]) {
    const snaps: string[] = (row.snapshot_paths || []).filter(Boolean);
    for (let i = 0; i < snaps.length; i += 100) await admin.storage.from("snapshots").remove(snaps.slice(i, i + 100));
    const ids = row.identity_paths ? Object.values(row.identity_paths as Record<string, string>) : [];
    if (ids.length) await admin.storage.from("identity").remove(ids);
    await admin.rpc("mark_media_purged", { p_attempt: row.attempt_id });
    purged++;
  }
  return NextResponse.json({ expired, webhooks, purged });
}
