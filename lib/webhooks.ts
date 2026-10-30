import { adminClient } from "@/lib/supabase/admin";

/**
 * Envoi des webhooks depuis la boîte d'envoi (remplie par la base à chaque
 * clôture de tentative, donc rien n'est perdu si l'appli redémarre).
 *
 * Signature : en-tête  X-Cybersup-Signature: t=<unix>,v1=<hex>
 *   v1 = HMAC-SHA256(secret, `${t}.${corps}`)
 * Le destinataire doit vérifier la signature et refuser un t trop ancien.
 */
async function hmacHex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function deliverPendingWebhooks(limit = 20): Promise<{ delivered: number; failed: number }> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { delivered: 0, failed: 0 };
  const admin = adminClient();
  const { data: rows } = await admin.from("webhook_outbox")
    .select("id, event, payload, attempts, webhook:webhooks(url, secret, active)")
    .is("delivered_at", null).lte("next_try_at", new Date().toISOString()).lt("attempts", 8)
    .order("id").limit(limit);

  let delivered = 0, failed = 0;
  for (const row of (rows || []) as any[]) {
    const wh = row.webhook;
    if (!wh?.active) continue;
    const body = JSON.stringify(row.payload);
    const t = Math.floor(Date.now() / 1000);
    const sig = await hmacHex(wh.secret, `${t}.${body}`);
    let error: string | null = null;
    try {
      const r = await fetch(wh.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Cybersup-Exam-Webhooks/1.0",
          "X-Cybersup-Event": row.event,
          "X-Cybersup-Delivery": String(row.id),
          "X-Cybersup-Signature": `t=${t},v1=${sig}`,
        },
        body,
        redirect: "manual",
        signal: AbortSignal.timeout(8000),
      });
      if (r.status < 200 || r.status >= 300) error = `HTTP ${r.status}`;
    } catch (e: any) {
      error = String(e?.message || e).slice(0, 300);
    }
    if (!error) {
      delivered++;
      await admin.from("webhook_outbox").update({ delivered_at: new Date().toISOString(), attempts: row.attempts + 1, last_error: null }).eq("id", row.id);
    } else {
      failed++;
      const backoffSec = Math.min(3600, 30 * 2 ** row.attempts);
      await admin.from("webhook_outbox").update({
        attempts: row.attempts + 1, last_error: error,
        next_try_at: new Date(Date.now() + backoffSec * 1000).toISOString(),
      }).eq("id", row.id);
    }
  }
  return { delivered, failed };
}

/** Lance l'envoi sans bloquer la réponse HTTP. */
export function kickWebhooks() {
  deliverPendingWebhooks().catch((e) => console.error("[webhooks]", e));
}
