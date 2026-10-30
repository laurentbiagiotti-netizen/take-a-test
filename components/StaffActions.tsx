"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function StaffActions({ attemptId, status, identityStatus, isAdmin }: {
  attemptId: string; status: string; identityStatus: string; isAdmin: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [chain, setChain] = useState<string | null>(null);

  const act = async (action: string, arg?: unknown, confirmText?: string) => {
    if (confirmText && !confirm(confirmText)) return;
    setBusy(true);
    const r = await fetch(`/api/staff/attempts/${attemptId}/action`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, arg }),
    });
    setBusy(false);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return alert(j.error || "Erreur");
    if (j.deleted) { router.push("/admin"); return; }
    router.refresh();
  };

  const verify = async () => {
    const r = await fetch(`/api/staff/attempts/${attemptId}/chain`);
    const j = await r.json();
    setChain(j.valid ? `Journal intègre (${j.events} événements)` : `JOURNAL ALTÉRÉ à partir de l'événement #${j.first_broken_id}`);
  };

  const active = status === "in_progress" || status === "pending";
  return (
    <div className="card space-y-3 text-sm">
      <div className="font-semibold">Actions du surveillant</div>
      <div className="flex flex-wrap gap-2">
        {active && <button className="btn-secondary" disabled={busy} onClick={() => act("reset_session", {}, "Autoriser la reprise sur un nouvel appareil ?")}>Autoriser la reprise</button>}
        {active && <button className="btn-secondary" disabled={busy} onClick={() => {
          const m = prompt("Minutes supplémentaires (tiers-temps, incident) :", "10");
          if (m) act("extend_time", { minutes: parseInt(m, 10) });
        }}>Ajouter du temps</button>}
        {active && <button className="btn-secondary text-danger" disabled={busy} onClick={() => {
          const reason = prompt("Motif de l'arrêt (consigné au journal) :");
          if (reason) act("terminate", { reason });
        }}>Arrêter l&apos;épreuve</button>}
        {["submitted", "verified", "rejected"].includes(identityStatus) && <>
          <button className="btn-secondary" disabled={busy} onClick={() => act("review_identity", { ok: true })}>Identité conforme</button>
          <button className="btn-secondary text-danger" disabled={busy} onClick={() => {
            const note = prompt("Motif du refus :");
            if (note !== null) act("review_identity", { ok: false, note });
          }}>Identité non conforme</button>
        </>}
        <button className="btn-secondary" onClick={verify}>Vérifier l&apos;intégrité du journal</button>
        {isAdmin && <button className="btn-secondary text-danger" disabled={busy} onClick={() => act("reset_attempt", {}, "Supprimer définitivement cette tentative (réponses et journal) pour permettre un nouveau passage ?")}>Supprimer la tentative</button>}
      </div>
      {chain && <p className={chain.startsWith("Journal intègre") ? "text-ok" : "text-danger font-semibold"}>{chain}</p>}
    </div>
  );
}
