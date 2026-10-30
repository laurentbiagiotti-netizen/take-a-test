import type { Metadata } from "next";

export const metadata: Metadata = { title: "Épreuve d'essai" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
