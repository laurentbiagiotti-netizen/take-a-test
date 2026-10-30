import type { Metadata } from "next";

export const metadata: Metadata = { title: "Épreuve en cours" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
