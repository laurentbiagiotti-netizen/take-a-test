import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth/staff";
import { randomHex, sha256Hex } from "@/lib/security/tokens";
import { API_SCOPES } from "@/lib/api/scopes";
import { validCidr } from "@/lib/security/cidr";
import { seal } from "@/lib/security/secretbox";

/** Création d'une clé d'API : la clé complète n'est affichée QU'UNE fois. */
export async function POST(req: NextRequest) {
  const s = await requireStaff(req, true);
  if ("res" in s) return s.res;
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim().slice(0, 100);
  const scopes: string[] = Array.isArray(body.scopes) ? body.scopes.filter((x: string) => API_SCOPES.includes(x as any)) : [];
  const days = Number(body.expires_in_days || 0);
  const cidrs: string[] = Array.isArray(body.allowed_cidrs) ? body.allowed_cidrs.map((c: string) => String(c).trim()).filter(Boolean) : [];
  const bad = cidrs.find((c) => !validCidr(c));
  if (bad) return NextResponse.json({ error: `Plage IP invalide : ${bad}` }, { status: 400 });
  const requireSignature = body.require_signature !== false;
  if (!name || !scopes.length) return NextResponse.json({ error: "Nom et au moins une portée requis" }, { status: 400 });
  if (scopes.some((x) => x.endsWith(":write")) && !cidrs.length) {
    return NextResponse.json({ error: "Une clé avec une portée d'écriture doit être limitée à des adresses IP" }, { status: 400 });
  }

  const prefix = randomHex(6);
  const secret = randomHex(24);
  const key = `cxk_${prefix}_${secret}`;
  const signingSecret = randomHex(32);
  let sealed: string;
  try { sealed = await seal(signingSecret, `api_key:${prefix}`); }
  catch { return NextResponse.json({ error: "API_SECRETS_KEY n'est pas configurée sur le serveur" }, { status: 500 }); }
  const { data, error } = await adminClient().from("api_keys").insert({
    name, prefix, key_hash: await sha256Hex(key), scopes, created_by: s.userId,
    expires_at: days > 0 ? new Date(Date.now() + days * 86400_000).toISOString() : null,
    allowed_cidrs: cidrs, require_signature: requireSignature, signing_secret_enc: sealed,
  }).select("id, name, prefix, scopes, expires_at, created_at, allowed_cidrs, require_signature").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ...data, key, signing_secret: signingSecret });
}

export async function DELETE(req: NextRequest) {
  const s = await requireStaff(req, true);
  if ("res" in s) return s.res;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
  await adminClient().from("api_keys").update({ revoked_at: new Date().toISOString() }).eq("id", id);
  return NextResponse.json({ ok: true });
}
