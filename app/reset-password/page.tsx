"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { PasswordField, PasswordMeter, authMessage, passwordScore } from "@/components/auth/fields";

function ResetInner() {
  const supabase = createClient();
  const router = useRouter();
  const params = useSearchParams();
  const [ready, setReady] = useState<"wait" | "ok" | "bad">("wait");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Le lien reçu par e-mail porte un code à échanger contre une session temporaire
  useEffect(() => {
    const code = params.get("code");
    (async () => {
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        setReady(error ? "bad" : "ok");
      } else {
        const { data } = await supabase.auth.getSession();
        setReady(data.session ? "ok" : "bad");
      }
    })();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordScore(password).score < 2) return setErr("Choisissez un mot de passe plus solide (voir l'indicateur).");
    setLoading(true); setErr(null);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return setErr(authMessage(error.message));
    router.push("/dashboard");
    router.refresh();
  };

  return (
    <main className="max-w-md mx-auto px-6 py-16">
      <h1 className="h1">Nouveau mot de passe</h1>
      {ready === "wait" && <p className="text-muted mt-4">Vérification du lien…</p>}
      {ready === "bad" && (
        <div className="card mt-6 text-sm" role="alert">
          <p>Ce lien a expiré ou a déjà servi.</p>
          <Link href="/forgot-password" className="btn-secondary mt-4 inline-flex">Demander un nouveau lien</Link>
        </div>
      )}
      {ready === "ok" && (
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <PasswordField label="Nouveau mot de passe" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={12} required />
            <PasswordMeter value={password} />
          </div>
          {err && <p className="text-sm text-danger" role="alert">{err}</p>}
          <button className="btn w-full justify-center" disabled={loading}>{loading ? "Enregistrement…" : "Enregistrer"}</button>
        </form>
      )}
    </main>
  );
}

export default function ResetPassword() {
  return <Suspense fallback={<main className="p-10">Chargement…</main>}><ResetInner /></Suspense>;
}
