"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * Entrée des candidats : uniquement le code reçu dans la convocation.
 * Le lien de la convocation peut le pré-remplir (#code=XXXX-XXXX-XXXX) :
 * la partie après # ne quitte jamais le navigateur.
 */
export default function AccessPage() {
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const m = window.location.hash.match(/code=([A-Za-z0-9-]{8,40})/);
    if (m) {
      setCode(m[1].toUpperCase());
      history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setErr(null);
    const r = await fetch("/api/access", {
      method: "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }),
    }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (r?.ok && j.redirect) { window.location.assign(j.redirect); return; }
    setLoading(false);
    setErr(j.error || "Connexion perdue, réessayez.");
  };

  return (
    <main className="max-w-md mx-auto px-6 py-16">
      <h1 className="h1">Accéder à mon épreuve</h1>
      <p className="text-sm text-muted mt-2">Saisissez le code personnel indiqué dans votre convocation. Aucun compte à créer.</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <label className="block text-sm">
          Code d&apos;accès
          <input className="input mt-1 font-mono text-lg tracking-widest uppercase" value={code} autoComplete="one-time-code"
            autoCapitalize="characters" spellCheck={false} placeholder="XXXX-XXXX-XXXX" maxLength={40}
            onChange={(e) => setCode(e.target.value.toUpperCase())} required />
        </label>
        {err && <p className="text-sm text-danger" role="alert">{err}</p>}
        <button className="btn w-full justify-center" disabled={loading || !code.trim()}>{loading ? "Vérification…" : "Accéder à l'épreuve"}</button>
      </form>
      <div className="mt-6 card text-sm">
        <div className="font-medium">Avant l&apos;épreuve</div>
        <p className="text-muted mt-1">Testez votre caméra et le plein écran sur la page d&apos;essai, de préférence la veille.</p>
        <Link href="/demo" className="btn-secondary mt-3 inline-flex">Tester mon matériel</Link>
      </div>
      <p className="mt-4 text-xs text-muted">Vos données et vos droits : <a href="/confidentialite" className="underline">notice d&apos;information</a>. Membre de l&apos;équipe ? <Link href="/login" className="underline">Espace équipe</Link></p>
    </main>
  );
}
