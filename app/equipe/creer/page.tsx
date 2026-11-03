"use client";
import { useState } from "react";
import Link from "next/link";
import { Field, PasswordField, PasswordMeter, passwordScore } from "@/components/auth/fields";

/** Création du premier administrateur, avec le code d'installation du serveur. */
export default function StaffSetupPage() {
  const [token, setToken] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordScore(password).score < 2) return setErr("Choisissez un mot de passe plus solide (voir l'indicateur).");
    setLoading(true); setErr(null);
    const r = await fetch("/api/setup", {
      method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, full_name: fullName, email, password }),
    }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setLoading(false);
    if (r?.ok) return setDone(true);
    setErr(j.error || "Connexion perdue, réessayez.");
  };

  if (done) {
    return (
      <main className="max-w-md mx-auto px-6 py-16">
        <h1 className="h1">Compte administrateur créé</h1>
        <p className="text-muted mt-3">Connectez-vous : l&apos;application d&apos;authentification (double authentification) vous sera demandée à la première connexion.</p>
        <Link href="/login?next=/admin" className="btn mt-6 inline-flex">Se connecter</Link>
      </main>
    );
  }

  return (
    <main className="max-w-md mx-auto px-6 py-16">
      <h1 className="h1">Premier administrateur</h1>
      <p className="text-sm text-muted mt-2">Une seule fois, à l&apos;installation. Le code d&apos;installation est la valeur STAFF_SETUP_TOKEN de la configuration du serveur. Cette page se ferme dès qu&apos;un administrateur existe.</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <Field label="Code d'installation" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" spellCheck={false} required />
        <Field label="Prénom et nom" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        <Field label="Adresse e-mail" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <div>
          <PasswordField autoComplete="new-password" hint="Astuce : une phrase de plusieurs mots est longue et facile à retenir." value={password} onChange={(e) => setPassword(e.target.value)} minLength={12} required />
          <PasswordMeter value={password} />
        </div>
        {err && <p className="text-sm text-danger" role="alert">{err}</p>}
        <button className="btn w-full justify-center" disabled={loading}>{loading ? "Création…" : "Créer le compte administrateur"}</button>
      </form>
    </main>
  );
}
