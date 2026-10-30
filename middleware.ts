import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ipInCidrs } from "@/lib/security/cidr";
import { clientIp } from "@/lib/security/request";

/**
 * 1. Liste d'IP autorisées pour l'administration (ADMIN_ALLOWED_CIDRS),
 *    par exemple le réseau de l'école ou Tailscale.
 * 2. Politique de sécurité du contenu avec nonce unique par requête :
 *    aucun script ne s'exécute sans le nonce (plus de 'unsafe-inline').
 * 3. Rafraîchissement du cookie Supabase, et transmission du chemin exact
 *    aux pages (vérification du hash Safe Exam Browser).
 */
const ADMIN_PATHS = [/^\/admin(\/|$)/, /^\/api\/admin\//, /^\/api\/staff\//, /^\/api\/seb\//, /^\/mfa(\/|$)/];
const AUTH_PATHS = [/^\/admin/, /^\/dashboard/, /^\/test\//, /^\/mfa/];

function csp(nonce: string): string {
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const dev = process.env.NODE_ENV !== "production";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${supabase}`.trim(),
    "media-src 'self' blob:",
    "font-src 'self'",
    `connect-src 'self' ${supabase} ${supabase.replace(/^http/, "ws")}`.trim(),
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "worker-src 'self' blob:",
    ...(!dev && (process.env.APP_URL || "").startsWith("https://") ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  const allow = (process.env.ADMIN_ALLOWED_CIDRS || "").split(/[\s,]+/).filter(Boolean);
  if (allow.length && ADMIN_PATHS.some((r) => r.test(path)) && !ipInCidrs(clientIp(req), allow)) {
    return new NextResponse("Accès à l'administration refusé depuis ce réseau.", { status: 403 });
  }

  const nonce = btoa(crypto.randomUUID());
  const policy = csp(nonce);
  const forwarded = new Headers(req.headers);
  forwarded.set("x-nonce", nonce);
  forwarded.set("content-security-policy", policy);
  forwarded.set("x-cx-path", path + req.nextUrl.search);

  let res = NextResponse.next({ request: { headers: forwarded } });
  if (AUTH_PATHS.some((r) => r.test(path))) {
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
  }
  res.headers.set("Content-Security-Policy", policy);
  return res;
}

export const config = {
  matcher: [
    { source: "/((?!_next/static|_next/image|favicon\\.ico$|cybersup-logo-blanc\\.svg$|openapi\\.yaml$).*)" },
  ],
};
