"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { safeNextPath } from "@/lib/security/redirect";
import { createClient } from "@/lib/supabase/client";
import { Field, PasswordField, authMessage } from "@/components/auth/fields";

function LoginInner() {
  const supabase = createClient();
  const router = useRouter();
  const params = useSearchParams();
  // Anti open-redirect : chemin interne uniquement
  const next = safeNextPath(params.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setErr(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return setErr(authMessage(error.message));
    router.push(next);
    router.refresh();
  };

  return (
    <main className="max-w-md mx-auto px-6 py-16">
      <h1 className="h1">Espace équipe</h1>
      <p className="text-sm text-muted mt-2">Connexion réservée à l&apos;équipe Cybersup (administration, surveillance, correction).</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <Field label="Adresse e-mail" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <PasswordField autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <div className="text-right -mt-2"><Link href="/forgot-password" className="text-xs underline">Mot de passe oublié ?</Link></div>
        {err && <p className="text-sm text-danger" role="alert">{err}</p>}
        <button className="btn w-full justify-center" disabled={loading}>{loading ? "Connexion…" : "Se connecter"}</button>
      </form>
      <div className="mt-6 card text-sm">
        <div className="font-medium">Vous êtes candidat ?</div>
        <p className="text-muted mt-1">Pas de compte à créer : utilisez le code de votre convocation.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/acces" className="btn-secondary">Entrer mon code</Link>
          <Link href="/demo" className="btn-secondary">Tester mon matériel</Link>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="p-10">Chargement…</main>}>
      <LoginInner />
    </Suspense>
  );
}
