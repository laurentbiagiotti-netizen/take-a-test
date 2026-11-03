/**
 * Type de question « evtx » : enquête dans l'Observateur d'événements Windows.
 * Les journaux sont fournis en JSON (format propre, ou sortie « evtx_dump -o jsonl »
 * de l'outil open source omerbenamram/evtx, MIT ou Apache 2.0, convertie par
 * fromEvtxDump). Le candidat filtre, lit les événements et répond à des questions ;
 * la note compare ses réponses aux valeurs attendues.
 */
export type EvLevel = "Information" | "Avertissement" | "Erreur" | "Critique" | "Succès de l'audit" | "Échec de l'audit";
export type EvEvent = { rid: number; log: string; level: EvLevel; time: string; source: string; eventId: number; task?: string; computer: string; message: string; data?: Record<string, string> };
export type EvQuestion = { id: string; label: string; placeholder?: string };
export type EvtxOptions = { logs: EvEvent[]; questions: EvQuestion[]; help?: boolean };
export type EvtxKey = Record<string, string | string[]>;

const norm = (s: unknown) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, "").replace(/^0(\d:)/, "$1");

export function gradeEvtx(o: EvtxOptions, key: EvtxKey | null, resp: any, points: number): number {
  const qs = (o.questions || []).filter((q) => key?.[q.id] !== undefined);
  if (!qs.length) return 0;
  const a = resp?.answers && typeof resp.answers === "object" ? resp.answers : {};
  const ok = qs.filter((q) => ([] as string[]).concat(key![q.id] as any).some((k) => norm(k) === norm(a[q.id]))).length;
  return Math.round(points * ok / qs.length * 100) / 100;
}

export function validEvtx(o: any, key: any): string | null {
  if (!Array.isArray(o?.logs) || !o.logs.length || o.logs.length > 3000) return "1 à 3 000 événements";
  if (o.logs.some((e: any) => !e || typeof e.message !== "string" || !Number.isInteger(e.eventId) || typeof e.log !== "string")) return "Événement mal formé (log, eventId, message)";
  if (!Array.isArray(o.questions) || !o.questions.length) return "Au moins une question";
  for (const q of o.questions) if (key?.[q.id] === undefined || key[q.id] === "") return `Réponse attendue manquante : « ${q.label} »`;
  return null;
}

const LEVEL_FROM_NUM: Record<string, EvLevel> = { "1": "Critique", "2": "Erreur", "3": "Avertissement", "4": "Information", "0": "Information" };

/** Convertit la sortie JSON Lines de « evtx_dump -o jsonl » en événements pour l'exercice. */
export function fromEvtxDump(jsonl: string, log: string, rid0 = 1): EvEvent[] {
  const out: EvEvent[] = [];
  for (const line of jsonl.split(/\r?\n/)) {
    if (!line.trim().startsWith("{")) continue;
    let r: any; try { r = JSON.parse(line); } catch { continue; }
    const ev = r.Event || r, sys = ev.System || {};
    const id = Number(sys.EventID?.["#text"] ?? sys.EventID);
    const data: Record<string, string> = {};
    const ed = ev.EventData || ev.UserData || {};
    for (const [k, v] of Object.entries(ed)) if (typeof v !== "object") data[k] = String(v);
    const kw = String(sys.Keywords || "");
    const level: EvLevel = kw === "0x8010000000000000" ? "Échec de l'audit" : kw === "0x8020000000000000" ? "Succès de l'audit" : LEVEL_FROM_NUM[String(sys.Level ?? 4)] || "Information";
    const t = String(sys.TimeCreated?.["#attributes"]?.SystemTime || "").replace("T", " ").slice(0, 19);
    out.push({
      rid: Number(sys.EventRecordID) || rid0 + out.length, log, level, time: t, source: sys.Provider?.["#attributes"]?.Name || "", eventId: id,
      task: String(sys.Task ?? ""), computer: String(sys.Computer || ""),
      message: Object.entries(data).map(([k, v]) => `${k} : ${v}`).join("\n"), data,
    });
  }
  return out;
}
