import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Rafraîchit le cookie d'auth Supabase et transmet le chemin demandé aux
// pages serveur (nécessaire pour vérifier le hash Safe Exam Browser, qui
// porte sur l'URL exacte, requête comprise).
export async function middleware(req: NextRequest) {
  const forwarded = new Headers(req.headers);
  forwarded.set("x-cx-path", req.nextUrl.pathname + req.nextUrl.search);
  let res = NextResponse.next({ request: { headers: forwarded } });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (list: { name: string; value: string; options?: any }[]) => {
          list.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: { headers: forwarded } });
          list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        },
      },
    }
  );
  try { await supabase.auth.getUser(); } catch { /* coupure réseau : la page revérifie */ }
  return res;
}

export const config = {
  matcher: ["/admin/:path*", "/dashboard/:path*", "/test/:path*"],
};
