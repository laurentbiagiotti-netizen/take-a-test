import { redirect } from "next/navigation";
import { staffPageGuard } from "@/lib/auth/staff";

export const dynamic = "force-dynamic";

/** Toute la zone /admin exige un compte staff authentifié en double facteur. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const g = await staffPageGuard();
  if ("redirect" in g) redirect(g.redirect);
  return <>{children}</>;
}
