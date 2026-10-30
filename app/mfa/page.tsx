"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Double authentification (TOTP) obligatoire pour les admins et surveillants.
 * Premier passage : enrôlement (QR code à scanner dans une application
 * d'authentification), puis saisie du code à 6 chiffres à chaque connexion.
 */
export default function Mfa() {
  const supabase = createClient();
  const router = useRouter();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login?next=/mfa"); return; }
      const { data } = await supabase.auth.mfa.listFactors();
      const verified = data?.totp?.find((f) => f.status === "verified");
      if (verified) { setFactorId(verified.id); return; }
      for (const f of data?.all || []) if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
      const { data: en, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Cybersup Exam" });
      if (error) { setErr(error.message); return; }
      setFactorId(en.id); setQr(en.totp.qr_code); setSecret(en.totp.secret);
    })();
  }, []);

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId) return;
    setBusy(true); setErr(null);
    const { data: ch, error: e1 } = await supabase.auth.mfa.challenge({ factorId });
    if (e1) { setBusy(false); return setErr(e1.message); }
    const { error: e2 } = await supabase.auth.mfa.verify({ factorId, challengeId: ch.id, code: code.trim() });
    setBusy(false);
    if (e2) return setErr("Code incorrect ou expiré.");
    router.replace("/admin");
    router.refresh();
  };

  return (
    <main className="max-w-md mx-auto px-6 py-16">
      <h1 className="h1">Double authentification</h1>
      {qr ? (
        <div className="mt-4 space-y-3 text-sm text-muted">
          <p>Première connexion à l&apos;espace d&apos;administration : scannez ce QR code avec une application d&apos;authentification (Google Authenticator, Microsoft Authenticator, 1Password, Bitwarden…).</p>
          <div className="bg-surface rounded-md p-3 w-fit"><img src={qr} alt="QR code TOTP" width={180} height={180} /></div>
          {secret && <p>Ou saisissez la clé : <code className="text-fg break-all select-all">{secret}</code></p>}
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted">Saisissez le code à 6 chiffres affiché par votre application d&apos;authentification.</p>
      )}
      <form onSubmit={verify} className="mt-6 space-y-3">
        <input className="input font-mono tracking-widest text-center text-lg" inputMode="numeric" autoComplete="one-time-code"
          maxLength={6} placeholder="000000" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} autoFocus />
        {err && <p className="text-sm text-danger">{err}</p>}
        <button className="btn w-full justify-center" disabled={busy || code.length !== 6 || !factorId}>{busy ? "Vérification…" : "Valider"}</button>
      </form>
    </main>
  );
}
