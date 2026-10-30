import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/700.css";
import "@fontsource/archivo-black/400.css";
import "@fontsource/jetbrains-mono/400.css";
import "./globals.css";
import type { Metadata } from "next";
import { headers } from "next/headers";
import SiteHeader from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Cybersup Exam",
  description: "Plateforme d'examens surveillés de Cybersup",
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Rendu dynamique obligatoire : chaque page reçoit le nonce CSP de sa requête.
  const h = await headers();
  const path = h.get("x-cx-path") || "";
  const bare = path.startsWith("/test/") || path.startsWith("/demo");
  return (
    <html lang="fr">
      <body className="min-h-screen flex flex-col">
        {!bare && <SiteHeader />}
        <div className="flex-1">{children}</div>
        {!bare && (
          <footer className="border-t border-line py-4 text-center text-xs text-faint">
            Cybersup, l&apos;école qui protège votre avenir
          </footer>
        )}
      </body>
    </html>
  );
}
