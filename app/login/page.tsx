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
  const [gLoading, setGLoading] = useState(false);
  const urlErr = params.get("error");
  const ssoErr = urlErr === "non_autorise" ? "Ce compte Google n'a pas accès à l'espace équipe. Utilisez votre adresse @cybersup.ai autorisée."
    : urlErr === "google" ? `La connexion Google a échoué, réessayez.${params.get("detail") ? ` (${params.get("detail")})` : ""}` : null;

  const google = async () => {
    setGLoading(true); setErr(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNextPath(params.get("next"), "/admin"))}`,
        queryParams: { hd: "cybersup.ai", prompt: "select_account" },
      },
    });
    if (error) { setGLoading(false); setErr(authMessage(error.message)); }
  };

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
      <button type="button" onClick={google} disabled={gLoading}
        className="mt-6 w-full inline-flex items-center justify-center gap-3 px-4 py-2.5 rounded-md border border-line-strong bg-surface text-fg text-sm font-semibold shadow-sm hover:border-accent disabled:opacity-50 transition-colors">
        <svg aria-hidden width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
        {gLoading ? "Redirection vers Google…" : "Se connecter avec Google"}
      </button>
      <p className="text-xs text-faint mt-2 text-center">Compte Google Workspace @cybersup.ai de l&apos;équipe uniquement.</p>
      {(ssoErr || err) && <p className="text-sm text-danger mt-3" role="alert">{ssoErr || err}</p>}
      <details className="mt-6 text-sm">
        <summary className="cursor-pointer text-muted hover:text-fg">Connexion de secours par mot de passe</summary>
        <form onSubmit={submit} className="mt-4 space-y-4">
          <Field label="Adresse e-mail" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <PasswordField autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <div className="text-right -mt-2"><Link href="/forgot-password" className="text-xs underline">Mot de passe oublié ?</Link></div>
          <button className="btn-secondary w-full justify-center" disabled={loading}>{loading ? "Connexion…" : "Se connecter"}</button>
        </form>
      </details>
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
