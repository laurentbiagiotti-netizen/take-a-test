import type { Metadata } from "next";

export const metadata: Metadata = { title: "Suivi en direct" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
