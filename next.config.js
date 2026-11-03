/** @type {import('next').NextConfig} */
// La CSP (avec nonce par requête) est posée par middleware.ts.

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), display-capture=(), fullscreen=(self), payment=(), usb=(), serial=(), hid=(), bluetooth=(), clipboard-read=()" },
  { key: "Cache-Control", value: "no-store, max-age=0" },
];

module.exports = {
  reactStrictMode: true,
  // PDFKit lit ses polices standard sur le disque : pas d'empaquetage.
  serverExternalPackages: ["pdfkit", "sql.js", "@zxcvbn-ts/core", "@zxcvbn-ts/language-common", "@zxcvbn-ts/language-fr"],
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};
