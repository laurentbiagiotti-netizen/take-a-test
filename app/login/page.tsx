"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { safeNextPath } from "@/lib/security/redirect";
import { createClient } from "@/lib/supabase/client";

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
    if (error) return setErr(error.message);
    router.push(next);
    router.refresh();
  };

  return (
    <main className="max-w-md mx-auto px-6 py-16">
      <h1 className="h1">Connexion</h1>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <input className="input" type="email" placeholder="Adresse e-mail" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="input" type="password" placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {err && <p className="text-sm text-danger">{err}</p>}
        <button className="btn w-full justify-center" disabled={loading}>{loading ? "Connexion…" : "Se connecter"}</button>
      </form>
      <p className="mt-4 text-sm text-muted">Pas encore de compte ? <Link href="/signup" className="underline">Créer un compte</Link></p>
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
