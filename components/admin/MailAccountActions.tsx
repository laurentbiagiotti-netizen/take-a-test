"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { notify } from "@/components/Toaster";

export default function MailAccountActions({ connected }: { connected: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const off = async () => {
    if (!confirm("Débrancher le compte ?\n\nPlus aucune convocation ni relance ne partira, et l'agenda ne sera plus mis à jour.")) return;
    setBusy(true);
    const r = await fetch("/api/admin/google/disconnect", { method: "POST" });
    setBusy(false);
    if (!r.ok) return notify("Débranchement impossible.");
    notify("Compte débranché.", "ok"); router.refresh();
  };
  return (
    <div className="flex flex-wrap gap-2">
      <a className={connected ? "btn-secondary" : "btn"} href="/api/admin/google/connect">{connected ? "Changer de compte" : "Relier un compte Google de l'école"}</a>
      {connected && <button className="btn-secondary" disabled={busy} onClick={off}>Débrancher</button>}
    </div>
  );
}
