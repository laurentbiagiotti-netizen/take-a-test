/** @type {import('next').NextConfig} */
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseWs = supabase.replace(/^http/, "ws");
const dev = process.env.NODE_ENV !== "production";

// Politique de sécurité du contenu : aucune ressource tierce, pas d'iframe,
// pas de plugin. 'unsafe-inline' reste nécessaire aux scripts d'hydratation
// de Next.js sans nonce ; 'unsafe-eval' uniquement en développement.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabase}`.trim(),
  "media-src 'self' blob:",
  "font-src 'self'",
  `connect-src 'self' ${supabase} ${supabaseWs}`.trim(),
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  ...(dev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), display-capture=(), fullscreen=(self), payment=(), usb=(), serial=(), hid=(), bluetooth=(), clipboard-read=()" },
  { key: "Cache-Control", value: "no-store, max-age=0" },
];

module.exports = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};
