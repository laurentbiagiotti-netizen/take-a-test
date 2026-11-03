"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { notify } from "@/components/Toaster";
import { VERDICT_BADGE, VERDICT_LABEL, fmt20, type Report, type Verdict } from "@/lib/exam/verdict";

const ERR: Record<string, string> = {
  reason_required: "Indiquez le motif de la décision.",
  attempt_not_finished: "La copie n'est pas encore rendue.",
};

/**
 * Note sur 20 et résultat (Test réussi, À statuer, Test échoué), avec la
 * décision forcée par l'équipe : toujours motivée, journalisée et transmise
 * aux outils reliés (webhook attempt.verdict).
 */
export default function VerdictPanel({ attemptId, report, finished }: { attemptId: string; report: Report | null; finished: boolean }) {
  const router = useRouter();
  const [choice, setChoice] = useState<Verdict>(report?.verdict_override?.verdict || report?.verdict_auto || "review");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  if (!report) return null;

  const send = async (verdict: Verdict | null) => {
    setBusy(true);
    const r = await fetch(`/api/staff/attempts/${attemptId}/action`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_verdict", arg: { verdict, reason } }),
    });
    setBusy(false);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return notify(ERR[j.error] || j.error || "Erreur");
    setReason("");
    notify(verdict ? "Décision enregistrée." : "Décision automatique rétablie.", "ok");
    router.refresh();
  };

  const v = report.verdict;
  const o = report.verdict_override;
  return (
    <div className="card space-y-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="font-semibold">Résultat</div>
        <div className="flex items-center gap-3">
          <span className="font-display text-2xl">{fmt20(report.score20)}</span>
          {v ? <span className={VERDICT_BADGE[v]}>{VERDICT_LABEL[v]}</span> : <span className="text-muted">copie non rendue</span>}
        </div>
      </div>
      {report.thresholds && (
        <p className="text-xs text-muted">
          Réussi à partir de {report.thresholds.pass}/20, échoué sous {report.thresholds.fail}/20, à statuer entre les deux.
          {report.needs_manual ? " Une réponse rédigée reste à corriger : le résultat attend votre correction." : ""}
          {report.below_floors?.length ? ` Sous le plancher en : ${report.below_floors.join(", ")}.` : ""}
        </p>
      )}
      {o && (
        <p className="text-xs">
          Décision forcée{o.by ? ` par ${o.by}` : ""} le {new Date(o.at).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}
          {report.verdict_auto ? ` (calcul automatique : ${VERDICT_LABEL[report.verdict_auto]})` : ""}. Motif : {o.reason}
        </p>
      )}
      {finished && (
        <div className="flex flex-wrap items-end gap-2 pt-2 border-t">
          <label className="text-xs text-muted">Décision
            <select className="input mt-1 !w-auto" value={choice} onChange={(e) => setChoice(e.target.value as Verdict)}>
              {(["pass", "review", "fail"] as Verdict[]).map((k) => <option key={k} value={k}>{VERDICT_LABEL[k]}</option>)}
            </select>
          </label>
          <label className="text-xs text-muted flex-1 min-w-[220px]">Motif (obligatoire, consigné au journal)
            <input className="input mt-1" maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="Ex. entretien très convaincant, panne réseau pendant l'exercice…" />
          </label>
          <button className="btn" disabled={busy || reason.trim().length < 3} onClick={() => send(choice)}>Forcer la décision</button>
          {o && <button className="btn-secondary" disabled={busy} onClick={() => send(null)}>Revenir au calcul automatique</button>}
        </div>
      )}
    </div>
  );
}
