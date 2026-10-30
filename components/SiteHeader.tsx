import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function SiteHeader() {
  let signedIn = false, staff = false;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    signedIn = !!user;
    if (user) {
      const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
      staff = p?.role === "admin" || p?.role === "proctor";
    }
  } catch { /* hors ligne : en-tête minimal */ }
  return (
    <header className="border-b border-line bg-bg">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center py-5" aria-label="Accueil Cybersup Exam">
          <img src="/cybersup-logo-blanc.svg" alt="Cybersup" className="h-6 w-auto" />
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/demo" className="px-3 py-2 text-muted hover:text-fg">Démo</Link>
          {signedIn ? (
            <>
              <Link href={staff ? "/admin" : "/dashboard"} className="px-3 py-2 text-muted hover:text-fg">{staff ? "Administration" : "Mes examens"}</Link>
              <form action="/auth/signout" method="post"><button className="btn-secondary">Déconnexion</button></form>
            </>
          ) : (
            <Link href="/login" className="btn">Se connecter</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
