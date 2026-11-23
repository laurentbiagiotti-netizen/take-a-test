import { redirect } from "next/navigation";
import { staffPageGuard } from "@/lib/auth/staff";
import AdminNav from "@/components/admin/AdminNav";

export const dynamic = "force-dynamic";

export const metadata = { title: "Administration" };

/** Toute la zone /admin exige un compte de l'équipe authentifié en double facteur. */

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const g = await staffPageGuard();
  if ("redirect" in g) redirect(g.redirect);
  return (
    <div className="lg:flex min-h-[calc(100vh-4rem)]">
      <AdminNav isAdmin={g.role === "admin"} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
