"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { API_SCOPES } from "@/lib/api/scopes";
import { randomHex } from "@/lib/security/tokens";

const EVENTS = ["attempt.submitted", "attempt.terminated", "attempt.expired"];

export default function ApiAdmin() {
  const supabase = createClient();
  const [keys, setKeys] = useState<any[]>([]);
  const [hooks, setHooks] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>(["results:read"]);
  const [days, setDays] = useState(365);
  const [newKey, setNewKey] = useState<{ key: string; signing_secret: string } | null>(null);
  const [cidrs, setCidrs] = useState("");
  const [requireSig, setRequireSig] = useState(true);
  const [hookUrl, setHookUrl] = useState("");
  const [newSecret, setNewSecret] = useState<string | null>(null);

  const load = async () => {
    const { data: k } = await supabase.from("api_keys").select("id, name, prefix, scopes, created_at, expires_at, last_used_at, revoked_at, allowed_cidrs, require_signature").order("created_at", { ascending: false });
    setKeys(k || []);
    const { data: h } = await supabase.from("webhooks").select("id, url, events, active, created_at").order("created_at", { ascending: false });
    setHooks(h || []);
  };
  useEffect(() => { load(); }, []);

  const createKey = async () => {
    const r = await fetch("/api/admin/api-keys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, scopes, expires_in_days: days, require_signature: requireSig, allowed_cidrs: cidrs.split(/[\s,]+/).filter(Boolean) }) });
    const j = await r.json();
    if (!r.ok) return alert(j.error);
    setNewKey({ key: j.key, signing_secret: j.signing_secret }); setName(""); setCidrs(""); load();
  };

  const revoke = async (id: string) => {
    if (!confirm("Révoquer cette clé ? Les intégrations qui l'utilisent cesseront de fonctionner.")) return;
    await fetch(`/api/admin/api-keys?id=${id}`, { method: "DELETE" }); load();
  };

  const addHook = async () => {
    let u: URL;
    try { u = new URL(hookUrl); } catch { return alert("URL invalide"); }
    if (u.protocol !== "https:") return alert("HTTPS obligatoire");
    if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|\[?::1)/.test(u.hostname)) return alert("Adresse interne refusée");
    const secret = randomHex(32);
    const { error } = await supabase.from("webhooks").insert({ url: hookUrl, secret, events: EVENTS });
    if (error) return alert(error.message);
    setNewSecret(secret); setHookUrl(""); load();
  };

  return (
    <main className="max-w-4xl mx-auto px-6 py-10 space-y-8">
      <div>
        <a href="/admin" className="text-sm text-muted">← Retour</a>
        <h1 className="h1 mt-2">API et webhooks</h1>
        <p className="text-sm text-muted mt-1">Documentation : <a className="underline" href="/openapi.yaml" target="_blank">openapi.yaml</a> · base : <code>/api/v1</code></p>
      </div>

      <section className="card space-y-3">
        <h2 className="h2">Nouvelle clé d&apos;API</h2>
        <input className="input" placeholder="Nom (ex. Synchro Grimp)" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="flex flex-wrap gap-3 text-sm">
          {API_SCOPES.map((s) => (
            <label key={s} className="flex items-center gap-1">
              <input type="checkbox" checked={scopes.includes(s)} onChange={(e) => setScopes((cur) => e.target.checked ? [...cur, s] : cur.filter((x) => x !== s))} />
              <code>{s}</code>
            </label>
          ))}
        </div>
        <label className="text-sm block">Expiration (jours, 0 = jamais)
          <input className="input mt-1 w-32" type="number" min={0} value={days} onChange={(e) => setDays(parseInt(e.target.value) || 0)} />
        </label>
        <label className="text-sm block text-muted">Adresses IP autorisées (CIDR, une par ligne ; vide = toutes)
          <textarea className="input mt-1 font-mono text-xs" rows={2} placeholder={"203.0.113.10/32\n100.64.0.0/10"} value={cidrs} onChange={(e) => setCidrs(e.target.value)} />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={requireSig} onChange={(e) => setRequireSig(e.target.checked)} />
          Exiger la signature HMAC de chaque requête (horodatage + nonce anti-rejeu) : recommandé
        </label>
        <button className="btn" onClick={createKey} disabled={!name || !scopes.length}>Créer la clé</button>
        {newKey && (
          <div className="bg-surface-2 border border-warn/40 rounded-md p-3 text-sm space-y-2">
            <b>Copiez ces deux valeurs maintenant, elles ne seront plus jamais affichées :</b>
            <div>Clé d&apos;API <code className="block mt-1 break-all select-all text-accent">{newKey.key}</code></div>
            <div>Secret de signature <code className="block mt-1 break-all select-all text-accent">{newKey.signing_secret}</code></div>
            <p className="text-xs text-muted">Exemple de client signé : <code>scripts/api-client.mjs</code> dans le dépôt.</p>
          </div>
        )}
      </section>

      <section>
        <h2 className="h2">Clés existantes</h2>
        <table className="mt-2 w-full text-sm">
          <thead className="text-left text-muted"><tr><th className="py-1">Nom</th><th>Préfixe</th><th>Portées</th><th>Sécurité</th><th>Dernier usage</th><th>État</th><th></th></tr></thead>
          <tbody>
            {keys.map((k) => {
              const expired = k.expires_at && new Date(k.expires_at) < new Date();
              return (
                <tr key={k.id} className="border-t">
                  <td className="py-1">{k.name}</td>
                  <td><code>cxk_{k.prefix}_…</code></td>
                  <td className="text-xs">{k.scopes.join(", ")}</td>
                  <td className="text-xs">{k.require_signature ? "signée" : "non signée"}{k.allowed_cidrs?.length ? ` · ${k.allowed_cidrs.length} plage(s) IP` : " · toutes IP"}</td>
                  <td>{k.last_used_at ? new Date(k.last_used_at).toLocaleString("fr-FR") : "-"}</td>
                  <td>{k.revoked_at ? "révoquée" : expired ? "expirée" : "active"}</td>
                  <td>{!k.revoked_at && <button className="text-danger" onClick={() => revoke(k.id)}>révoquer</button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="card space-y-3">
        <h2 className="h2">Webhooks</h2>
        <p className="text-sm text-muted">Appelés à chaque copie rendue, interrompue ou expirée. Signature HMAC-SHA256 dans l&apos;en-tête <code>X-Cybersup-Signature</code>.</p>
        <div className="flex gap-2">
          <input className="input flex-1" placeholder="https://…" value={hookUrl} onChange={(e) => setHookUrl(e.target.value)} />
          <button className="btn" onClick={addHook} disabled={!hookUrl}>Ajouter</button>
        </div>
        {newSecret && (
          <div className="bg-surface-2 border border-warn/40 rounded p-3 text-sm">
            <b>Secret de signature (à copier dans le service destinataire) :</b>
            <code className="block mt-1 break-all select-all">{newSecret}</code>
          </div>
        )}
        <ul className="text-sm">
          {hooks.map((h) => (
            <li key={h.id} className="border-t py-1 flex justify-between gap-2">
              <span className="truncate">{h.url} <span className="text-muted">({h.events.join(", ")})</span></span>
              <span className="flex gap-3 shrink-0">
                <button className="underline" onClick={async () => { await supabase.from("webhooks").update({ active: !h.active }).eq("id", h.id); load(); }}>{h.active ? "désactiver" : "activer"}</button>
                <button className="text-danger" onClick={async () => { if (confirm("Supprimer ?")) { await supabase.from("webhooks").delete().eq("id", h.id); load(); } }}>supprimer</button>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
