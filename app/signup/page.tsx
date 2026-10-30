"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Field, PasswordField, PasswordMeter, authMessage, passwordScore } from "@/components/auth/fields";

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
    if (passwordScore(password).score < 2) return setErr("Choisissez un mot de passe plus solide (voir l'indicateur).");
    setLoading(true); setErr(null);
    // Rôle verrouillé à « candidat » : les comptes de l'équipe sont créés à part.
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName, role: "candidate" } },
    });
    setLoading(false);
    if (error) return setErr(authMessage(error.message));
    router.push("/dashboard");
    router.refresh();
  };

  return (
    <main className="max-w-md mx-auto px-6 py-16">
      <h1 className="h1">Créer un compte candidat</h1>
      <p className="text-sm text-muted mt-2">Utilisez exactement l&apos;adresse e-mail qui a reçu votre convocation : c&apos;est elle qui vous donne accès à l&apos;épreuve.</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <Field label="Prénom et nom" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        <Field label="Adresse e-mail" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <div>
          <PasswordField autoComplete="new-password" hint="Astuce : une phrase de plusieurs mots est longue et facile à retenir." value={password} onChange={(e) => setPassword(e.target.value)} minLength={12} required />
          <PasswordMeter value={password} />
        </div>
        {err && <p className="text-sm text-danger" role="alert">{err}</p>}
        <button className="btn w-full justify-center" disabled={loading}>{loading ? "Création…" : "Créer le compte"}</button>
      </form>
      <p className="mt-4 text-sm text-muted">Déjà un compte ? <Link href="/login" className="underline">Se connecter</Link></p>
    </main>
  );
}
