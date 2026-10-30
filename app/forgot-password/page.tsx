"use client";
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Field, authMessage } from "@/components/auth/fields";

export default function ForgotPassword() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setErr(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    setLoading(false);
    // Même message que l'adresse existe ou non : on ne révèle pas qui a un compte
    if (error && !/not found|no user/i.test(error.message)) return setErr(authMessage(error.message));
    setSent(true);
  };

  return (
    <main className="max-w-md mx-auto px-6 py-16">
      <h1 className="h1">Mot de passe oublié</h1>
      {sent ? (
        <div className="card mt-6 text-sm" role="status">
          <p>Si un compte existe pour <b>{email}</b>, un lien de réinitialisation vient d&apos;être envoyé. Pensez à regarder dans les indésirables.</p>
          <Link href="/login" className="btn-secondary mt-4 inline-flex">Retour à la connexion</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4">
          <p className="text-sm text-muted">Indiquez l&apos;adresse de votre compte : vous recevrez un lien pour choisir un nouveau mot de passe.</p>
          <Field label="Adresse e-mail" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          {err && <p className="text-sm text-danger" role="alert">{err}</p>}
          <button className="btn w-full justify-center" disabled={loading}>{loading ? "Envoi…" : "Recevoir le lien"}</button>
          <p className="text-sm text-muted"><Link href="/login" className="underline">Retour à la connexion</Link></p>
        </form>
      )}
    </main>
  );
}
