import type { SupabaseClient } from "@supabase/supabase-js";
import { EVENT_LABEL } from "@/lib/exam/client";
import type { RecapData, RecapQuestion } from "./recap";

const TYPE_NAME: Record<string, string> = {
  mcq_single: "QCM une réponse", mcq_multi: "QCM plusieurs réponses", long_text: "Réponse rédigée", terminal: "Défi terminal",
  ordering: "Remettre dans l'ordre", matching: "Associer", hotspot: "Repérer", short_answer: "Réponse courte", external: "Exercice dans un outil", sql: "Requête SQL", decode: "Décodage", password: "Mots de passe", blocks: "Pare-feu en blocs", headers: "En-têtes de mail", subnet: "Sous-réseaux", netpuzzle: "Puzzle réseau", sokoban: "Caisses à pousser", robot: "Robot à programmer", adsim: "Console Active Directory", tickets: "Tickets de support", feed: "Vrai ou fake ?",
};
const END: Record<string, string> = {
  submitted: "Copie rendue par le candidat", expired: "Temps écoulé", terminated: "Interrompue par un surveillant",
  in_progress: "En cours", pending: "Pas commencée",
};
const EXTRA_LABEL: Record<string, string> = {
  external_launch: "exercice ouvert", external_completed: "exercice terminé", attempt_started: "début de l'épreuve",
  attempt_submitted: "copie rendue", attempt_expired: "temps écoulé", attempt_terminated: "épreuve interrompue",
  staff_verdict: "décision de l'équipe", staff_suspicion: "suspicion signalée", staff_extend_time: "temps ajouté",
  staff_reset_session: "reprise autorisée", violation_threshold: "seuil d'infractions atteint", camera_refused: "caméra refusée", fast_answers: "réponses anormalement rapides",
  camera_off: "caméra coupée", no_face: "aucun visage", phone_detected: "téléphone visible", room_scan_requested: "scan de la pièce demandé (pause)", room_scan: "pièce filmée au téléphone", exam_resumed: "reprise après la pause", room_scan_missing: "pause sans scan de la pièce (30 min)", fullscreen_return: "retour en plein écran", snapshot: "photo (anomalie)",
};
const TZ = { timeZone: "Europe/Paris" } as const;
const fmt = (d?: string | null) => (d ? new Date(d).toLocaleString("fr-FR", { ...TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "");
const time = (d: string) => new Date(d).toLocaleTimeString("fr-FR", TZ);
const dur = (ms: number) => { const s = Math.round(ms / 1000); return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")} s`; };

function detail(d: any): string {
  if (!d || typeof d !== "object") return "";
  const p: string[] = [];
  if (d.key) p.push(String(d.key));
  if (d.minutes) p.push(`+${d.minutes} min`);
  if (d.reason) p.push(String(d.reason));
  if (d.note) p.push(String(d.note));
  if (d.verdict) p.push(String(d.verdict));
  if (d.tool) p.push(String(d.tool));
  if (d.faces !== undefined) p.push(`${d.faces} visage(s)`);
  if (d.score !== undefined && d.max_score !== undefined) p.push(`${d.score}/${d.max_score}`);
  return p.join(" · ").slice(0, 160);
}

/** Rassemble tout ce qu'il faut pour la fiche d'une tentative (client service_role). */
export async function recapData(admin: SupabaseClient, attemptId: string): Promise<RecapData | null> {
  const { data: a } = await admin.from("attempts")
    .select("*, candidate:profiles(email, full_name), test:tests(title, formation, verdict_pass, verdict_fail)")
    .eq("id", attemptId).maybeSingle();
  if (!a) return null;
  const order: string[] = a.question_order || [];
  const [{ data: report }, { data: qs }, { data: answers }, { data: keys }, { data: events }, { data: exts }, { data: inv }, { data: receipt }] = await Promise.all([
    admin.rpc("_attempt_report", { p_attempt: a.id }),
    order.length ? admin.from("questions").select("id, type, prompt, options, points, domain, explanation").in("id", order) : Promise.resolve({ data: [] as any[] }),
    admin.from("answers").select("question_id, response, score, feedback").eq("attempt_id", a.id),
    order.length ? admin.from("answer_keys").select("question_id, correct").in("question_id", order) : Promise.resolve({ data: [] as any[] }),
    admin.from("proctor_events").select("kind, severity, detail, created_at").eq("attempt_id", a.id).order("id"),
    admin.from("external_sessions").select("question_id, tool, score_ratio, raw_score, raw_max, completed, details").eq("attempt_id", a.id),
    admin.from("invites").select("external_ref, full_name").eq("test_id", a.test_id).eq("email", a.candidate?.email || "").maybeSingle(),
    admin.rpc("_receipt", { p_attempt: a.id }),
  ]);
  const qMap = new Map((qs || []).map((q: any) => [q.id, q]));
  const aMap = new Map((answers || []).map((x: any) => [x.question_id, x]));
  const kMap = new Map((keys || []).map((k: any) => [k.question_id, k.correct]));
  const eMap = new Map((exts || []).map((x: any) => [x.question_id, x]));

  const questions: RecapQuestion[] = order.map((qid, i) => {
    const q: any = qMap.get(qid) || { type: "?", prompt: "(question supprimée)", points: 0 };
    const ans: any = aMap.get(qid);
    const key: any = kMap.get(qid);
    const r = ans?.response || {};
    const max = Number(q.points) || 0;
    let points: number | null = ans?.score ?? null;
    let status: RecapQuestion["status"];
    if (q.type === "long_text" && ans && ans.score === null) status = "manual";
    else if (!ans && q.type !== "external") { status = "none"; points = 0; }
    else {
      const p = Number(points ?? 0);
      status = p >= max && max > 0 ? "full" : p > 0 ? "partial" : "zero";
    }
    const base: RecapQuestion = {
      n: i + 1, prompt: q.prompt, max, points, status, explanation: q.explanation,
      meta: [TYPE_NAME[q.type] || q.type, q.domain || "Sans domaine"].join(" · "),
    };
    if (q.type === "mcq_single" || q.type === "mcq_multi") {
      const chosen: string[] = r.selected || [];
      base.options = (q.options || []).map((o: any) => ({ text: o.text, correct: (key || []).includes(o.id), chosen: chosen.includes(o.id) }));
    } else if (q.type === "sql") {
      base.answer = r.query || "";
    } else if (q.type === "decode") {
      base.answer = r.text || "";
      base.expected = (key?.answers || []).join(" ; ");
    } else if (q.type === "headers" || q.type === "subnet") {
      base.answer = Object.entries(r.fields || r.subnets || {}).map(([k, v]) => `${k} : ${v}`).join("  ");
    } else if (q.type === "netpuzzle") {
      base.answer = `${r.moves || 0} rotation(s) en ${Math.round((r.ms || 0) / 1000)} s`;
    } else if (q.type === "blocks") {
      base.answer = r.program ? `${r.program.rules?.length || 0} règle(s), politique par défaut : ${r.program.default === "block" ? "bloquer" : "autoriser"}` : "";
    } else if (q.type === "password") {
      base.answer = q.options?.mode === "rank" ? (r.order || []).map((id: string, k: number) => `${k + 1}. ${(q.options.items || []).find((x: any) => x.id === id)?.text ?? id}`).join("  ") : r.text ? `${String(r.text).length} caractères` : "";
    } else if (q.type === "short_answer") {
      base.answer = r.text || "";
      base.expected = (key?.answers || []).join(" ; ");
    } else if (q.type === "long_text") {
      base.answer = r.text || "";
      if (ans?.feedback) base.extra = [`Commentaire du correcteur : ${ans.feedback}`];
    } else if (q.type === "terminal") {
      base.answer = r.flag || "";
    } else if (q.type === "ordering") {
      const t = (id: string) => (q.options || []).find((o: any) => o.id === id)?.text ?? id;
      base.answer = (r.order || []).map((id: string, k: number) => `${k + 1}. ${t(id)}`).join("  ");
      base.expected = (key || []).map((id: string, k: number) => `${k + 1}. ${t(id)}`).join("  ");
    } else if (q.type === "matching") {
      const t = (side: string, id: string) => (q.options?.[side] || []).find((o: any) => o.id === id)?.text ?? id;
      base.answer = Object.entries(r.pairs || {}).map(([l, rr]) => `${t("left", l)} -> ${t("right", rr as string)}`).join(" ; ");
      base.expected = Object.entries(key || {}).map(([l, rr]) => `${t("left", l)} -> ${t("right", rr as string)}`).join(" ; ");
    } else if (q.type === "hotspot") {
      const t = (id: string) => { const s = (q.options?.segments || []).find((o: any) => o.id === id); return s?.text ?? (s?.cells || []).join(" | ") ?? id; };
      base.answer = (r.selected || []).map(t).join(" ; ");
      base.expected = (key || []).map(t).join(" ; ");
    } else if (q.type === "external") {
      const x: any = eMap.get(qid);
      const pts = x ? Math.round(max * Number(x.score_ratio || 0) * 100) / 100 : 0;
      base.points = points ?? pts;
      base.status = !x ? "none" : base.points >= max ? "full" : base.points > 0 ? "partial" : "zero";
      base.extra = !x ? ["Exercice jamais ouvert."] : [
        `${x.tool === "crime" ? "Crime GeoGuess" : x.tool === "win95" ? "Cybersup OS" : x.tool} · ${x.completed ? "terminé" : "non terminé"}${x.raw_max ? ` · ${x.raw_score ?? 0} / ${x.raw_max} dans l'outil` : ""}`,
        ...((x.details?.items || []).map((it: any) => `${it.id} (${it.kind}) : ${it.choice === "fraud" ? "frauduleux" : it.choice === "legit" ? "légitime" : "sans réponse"}${it.correct ? ", juste" : ", faux"}`)),
        ...((x.details?.cases || []).map((c: any) => `Enquête ${c.case_id} : ${c.played === false ? "non jouée" : `${Math.round(c.distance_km ?? 0)} km, ${c.score} pts${c.flag_correct === true ? ", défi réussi" : c.flag_correct === false ? ", défi raté" : ""}`}`)),
      ];
    }
    return base;
  });

  const counts = new Map<string, { n: number; serious: boolean }>();
  for (const e of events || []) {
    if (e.severity === "info") continue;
    const label = EVENT_LABEL[e.kind] || EXTRA_LABEL[e.kind] || e.kind;
    const c = counts.get(label) || { n: 0, serious: false };
    c.n += 1; c.serious = c.serious || e.severity !== "warning";
    counts.set(label, c);
  }
  const started = a.started_at ? new Date(a.started_at).getTime() : null;
  const ended = a.submitted_at ? new Date(a.submitted_at).getTime() : null;
  const r: any = report || {};
  return {
    candidate: a.candidate?.full_name || inv?.full_name || a.candidate?.email || "Candidat",
    email: a.candidate?.email || "", ref: inv?.external_ref, test: a.test?.title || "", formation: a.test?.formation,
    attemptId: a.id, started: fmt(a.started_at), ended: fmt(a.submitted_at),
    duration: started && ended ? dur(ended - started) : "", endReason: END[a.status] || a.status, extraMinutes: a.extra_minutes || 0,
    score20: r.score20 ?? null, points: r.score ?? null, max: r.max_score ?? null,
    verdict: r.verdict ?? null, verdictLabel: r.verdict_label || "Non terminé",
    thresholds: `Test réussi à partir de ${r.thresholds?.pass ?? 10}/20, échoué sous ${r.thresholds?.fail ?? 8}/20, « À statuer » entre les deux`,
    override: r.verdict_override ? { label: r.verdict_label, reason: r.verdict_override.reason, by: r.verdict_override.by, auto: r.verdict_auto_label } : null,
    needsManual: !!r.needs_manual, belowFloors: r.below_floors || [],
    domains: (r.domains || []).map((x: any) => ({ name: x.domain, score: Number(x.score), max: Number(x.max), ratio: Number(x.ratio || 0), floor: x.floor ?? null, below: !!x.below })),
    surveillance: Array.from(counts.entries()).sort((x, y) => y[1].n - x[1].n).map(([label, c]) => ({ label, count: c.n, serious: c.serious })),
    violations: a.violation_count || 0, suspicion: a.suspicion_at ? `${fmt(a.suspicion_at)}${a.suspicion_note ? `, ${a.suspicion_note}` : ""}` : null,
    receipt: receipt?.reference || null, ip: a.client_ip || null,
    questions,
    timeline: (events || []).map((e: any) => ({
      time: time(e.created_at), label: EVENT_LABEL[e.kind] || EXTRA_LABEL[e.kind] || e.kind.replace(/_/g, " "),
      serious: e.severity === "violation" || e.severity === "critical", detail: detail(e.detail),
    })),
  };
}
