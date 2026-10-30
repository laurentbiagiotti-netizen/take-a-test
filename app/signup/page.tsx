"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const supabase = createClient();
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setErr(null);
    // Role is hard-locked to candidate. Admins are provisioned via SQL/dashboard.
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName, role: "candidate" } },
    });
    if (error) { setLoading(false); return setErr(error.message); }
    setLoading(false);
    router.push("/dashboard");
    router.refresh();
  };

  return (
    <main className="max-w-md mx-auto px-6 py-16">
      <h1 className="h1">Créer un compte candidat</h1>
      <p className="text-sm text-muted mt-1">Vous avez reçu une invitation ? Utilisez exactement l&apos;adresse e-mail à laquelle elle a été envoyée.</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <input className="input" placeholder="Nom et prénom" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        <input className="input" type="email" placeholder="Adresse e-mail" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="input" type="password" placeholder="Mot de passe (12 caractères minimum)" value={password} onChange={(e) => setPassword(e.target.value)} minLength={12} required />
        {err && <p className="text-sm text-danger">{err}</p>}
        <button className="btn w-full justify-center" disabled={loading}>{loading ? "Création…" : "Créer le compte"}</button>
      </form>
      <p className="mt-4 text-sm text-muted">Déjà un compte ? <Link href="/login" className="underline">Se connecter</Link></p>
    </main>
  );
}
