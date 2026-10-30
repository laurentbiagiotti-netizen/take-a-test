import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { clientIp } from "@/lib/security/request";
import { sha256Hex, timingSafeEqual } from "@/lib/security/tokens";
import { ipInCidrs } from "@/lib/security/cidr";
import { hmacHex, open } from "@/lib/security/secretbox";
import type { ApiScope } from "./scopes";

/**
 * Authentification des appels à l'API v1.
 *  - Clé :  Authorization: Bearer cxk_<prefix>_<secret>
 *  - Seul le SHA-256 de la clé est stocké ; comparaison en temps constant
 *  - Portées (scopes) par clé, expiration, révocation
 *  - Quota par clé et par minute (API_RATE_LIMIT, 120 par défaut)
 *  - Liste d'IP autorisées par clé (allowed_cidrs)
 *  - Signature HMAC-SHA256 de chaque requête, horodatée (±5 min), avec
 *    nonce à usage unique (anti-rejeu) :
 *      X-Cx-Timestamp: <secondes unix>
 *      X-Cx-Nonce:     <16 à 64 caractères [A-Za-z0-9_-]>
 *      X-Cx-Signature: hex(HMAC_SHA256(secret_de_signature,
 *                        "<ts>\n<nonce>\n<MÉTHODE>\n<chemin?requête>\n<sha256_hex(corps)>"))
 *    Le secret de signature est chiffré en base (AES-GCM, clé API_SECRETS_KEY).
 *  - Chaque appel est journalisé dans api_audit
 */
export type ApiCtx = {
  keyId: string;
  actorId: string | null;
  scopes: string[];
  admin: ReturnType<typeof adminClient>;
  req: NextRequest;
};

type Handler<P> = (ctx: ApiCtx, params: P) => Promise<NextResponse>;

export function apiError(status: number, error: string, message?: string) {
  return NextResponse.json({ error, message: message || error }, { status, headers: { "Cache-Control": "no-store" } });
}

export function withApi<P = Record<string, string>>(scope: ApiScope, handler: Handler<P>) {
  return async (req: NextRequest, context: { params: Promise<P> }) => {
    const admin = adminClient();
    const auth = req.headers.get("authorization") || "";
    const m = /^Bearer\s+(cxk_([a-f0-9]{12})_[a-f0-9]{48})$/i.exec(auth.trim());
    let keyId: string | null = null;
    let res: NextResponse | undefined;
    try {
      if (!m) { res = apiError(401, "unauthorized", "Clé d'API manquante ou mal formée"); return res; }
      const [, key, prefix] = m;
      const { data: k } = await admin.from("api_keys")
        .select("id, key_hash, scopes, revoked_at, expires_at, created_by, allowed_cidrs, require_signature, signing_secret_enc").eq("prefix", prefix.toLowerCase()).maybeSingle();
      const hash = await sha256Hex(key);
      if (!k || !timingSafeEqual(hash, k.key_hash) || k.revoked_at || (k.expires_at && new Date(k.expires_at) < new Date())) {
        res = apiError(401, "unauthorized", "Clé d'API invalide, expirée ou révoquée"); return res;
      }
      keyId = k.id;
      // Une clé ne vaut que tant que son créateur est toujours administrateur.
      const { data: owner } = k.created_by
        ? await admin.from("profiles").select("role").eq("id", k.created_by).maybeSingle()
        : { data: null };
      if (owner?.role !== "admin") { res = apiError(401, "unauthorized", "Le propriétaire de la clé n'est plus administrateur"); return res; }

      // Restriction d'origine réseau
      if (k.allowed_cidrs?.length && !ipInCidrs(clientIp(req), k.allowed_cidrs)) {
        res = apiError(403, "ip_not_allowed", "Adresse IP non autorisée pour cette clé"); return res;
      }

      // Signature HMAC horodatée + nonce unique
      if (k.require_signature) {
        const ts = req.headers.get("x-cx-timestamp") || "";
        const nonce = req.headers.get("x-cx-nonce") || "";
        const sig = (req.headers.get("x-cx-signature") || "").toLowerCase();
        if (!/^\d{10}$/.test(ts) || !/^[A-Za-z0-9_-]{16,64}$/.test(nonce) || !/^[a-f0-9]{64}$/.test(sig)) {
          res = apiError(401, "signature_required", "En-têtes X-Cx-Timestamp, X-Cx-Nonce et X-Cx-Signature requis"); return res;
        }
        if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) { res = apiError(401, "signature_expired", "Horodatage hors fenêtre (±5 min)"); return res; }
        if (!k.signing_secret_enc) { res = apiError(401, "signature_invalid"); return res; }
        const u = new URL(req.url);
        const raw = req.method === "GET" || req.method === "DELETE" ? "" : await req.clone().text();
        const canonical = `${ts}\n${nonce}\n${req.method}\n${u.pathname}${u.search}\n${await sha256Hex(raw)}`;
        const expected = await hmacHex(await open(k.signing_secret_enc, `api_key:${prefix.toLowerCase()}`), canonical);
        if (!timingSafeEqual(expected, sig)) { res = apiError(401, "signature_invalid", "Signature invalide"); return res; }
        const { data: fresh } = await admin.rpc("api_use_nonce", { p_key: k.id, p_nonce: nonce });
        if (fresh !== true) { res = apiError(401, "replay_detected", "Nonce déjà utilisé"); return res; }
      }
      if (!k.scopes.includes(scope)) { res = apiError(403, "insufficient_scope", `Portée requise : ${scope}`); return res; }
      const limit = parseInt(process.env.API_RATE_LIMIT || "120", 10);
      const { data: allowed } = await admin.rpc("api_rate_hit", { p_key: k.id, p_limit: limit });
      if (allowed === false) {
        res = apiError(429, "rate_limited", "Quota dépassé, réessayez dans une minute");
        res.headers.set("Retry-After", "60"); return res;
      }
      res = await handler({ keyId: k.id, actorId: k.created_by, scopes: k.scopes, admin, req }, await context.params);
      res.headers.set("Cache-Control", "no-store");
      return res;
    } catch (e) {
      console.error("[api]", e);
      res = apiError(500, "server_error");
      return res;
    } finally {
      const u = new URL(req.url);
      admin.from("api_audit").insert({
        key_id: keyId, method: req.method, path: u.pathname.slice(0, 300), status: res?.status ?? 500, ip: clientIp(req),
      }).then(() => {}, () => {});
    }
  };
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function body<T = any>(req: NextRequest, max = 512 * 1024): Promise<T | null> {
  const t = await req.text();
  if (t.length > max) return null;
  try { return JSON.parse(t) as T; } catch { return null; }
}

/** Champs de test modifiables via l'API (liste blanche). */
export const TEST_FIELDS = [
  "title", "description", "duration_minutes", "is_published", "require_seb", "invite_only", "require_id_check",
  "draw_count", "shuffle_questions", "shuffle_options", "max_violations", "allow_resume",
  "grace_seconds", "opens_at", "closes_at", "retention_days", "id_verify_before_start", "seb_accept_config_key",
  "pass_mark", "domain_floors", "interview_guide",
] as const;

export function pickTestFields(input: any): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!input || typeof input !== "object") return out;
  for (const f of TEST_FIELDS) if (f in input) out[f] = input[f];
  // Planchers : { "Domaine": 0.3 } uniquement, valeurs entre 0 et 1
  if ("domain_floors" in out) {
    const f = out.domain_floors as any;
    const ok = f && typeof f === "object" && !Array.isArray(f) && Object.keys(f).length <= 50
      && Object.entries(f).every(([k, v]) => k.length <= 100 && typeof v === "number" && v >= 0 && v <= 1);
    if (!ok) delete out.domain_floors;
  }
  return out;
}
