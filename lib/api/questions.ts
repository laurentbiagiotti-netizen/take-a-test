import { validateScenario } from "@/lib/terminal/shell";
import { validateQuestion, type QType } from "@/lib/questions/kinds";

const ALL_TYPES = new Set<string>(["mcq_single", "mcq_multi", "long_text", "terminal", "external", "ordering", "matching", "hotspot", "short_answer",
  "sql", "decode", "password", "blocks", "headers", "subnet", "netpuzzle", "sokoban", "robot", "adsim", "tickets", "feed", "evtx", "bash", "sim"]);
const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

/** Contrôle et prépare les lignes à écrire ; renvoie une erreur lisible au premier problème. */
export function build(testId: string, input: any[], start: number) {
  const rows: any[] = [], keyRows: any[] = [], termRows: any[] = [], extRows: any[] = [];
  for (const [i, q] of input.entries()) {
    const n = `Question ${i + 1}`;
    if (!q || !ALL_TYPES.has(q.type) || typeof q.prompt !== "string" || !q.prompt.trim()) return { error: `${n} invalide (type ou énoncé)` };
    const qid = crypto.randomUUID();
    const key = q.correct !== undefined ? q.correct : q.key;
    let options: any = q.options ?? null;
    if (q.type === "mcq_single" || q.type === "mcq_multi") {
      if (!Array.isArray(q.options) || q.options.length < 2) return { error: `${n} : 2 options minimum` };
      options = q.options.map((o: any, k: number) => ({ id: String(o?.id ?? String.fromCharCode(97 + k)).slice(0, 64), text: String(o?.text ?? ""), image_url: o?.image_url ?? null }));
      if (new Set(options.map((o: any) => o.id)).size !== options.length) return { error: `${n} : identifiants d'options en double` };
      const correct = (Array.isArray(key) ? key : [key]).map((c: any) => (typeof c === "number" ? options[c]?.id : options.find((o: any) => o.id === String(c))?.id)).filter(Boolean);
      if (!correct.length) return { error: `${n} : au moins une bonne réponse (index ou id d'option)` };
      if (q.type === "mcq_single" && correct.length !== 1) return { error: `${n} : une seule bonne réponse` };
      keyRows.push({ question_id: qid, correct });
    } else if (q.type === "terminal") {
      const err = validateScenario(q.terminal?.scenario);
      if (err) return { error: `${n} : ${err}` };
      const flag = String(q.terminal?.flag || "").trim();
      if (flag.length > 200) return { error: `${n} : flag de 200 caractères maximum` };
      if (!flag && !(q.terminal.scenario.objectives || []).length) return { error: `${n} : au moins une mission ou un flag` };
      termRows.push({ question_id: qid, scenario: q.terminal.scenario, flag: flag || null });
      options = null;
    } else if (q.type === "external") {
      const x = q.external || {};
      if (!/^[a-z0-9_-]{2,30}$/.test(String(x.tool || ""))) return { error: `${n} : external.tool requis (ex. geoguess)` };
      const t = x.time_limit_s == null ? null : Number(x.time_limit_s);
      if (t !== null && !(Number.isInteger(t) && t >= 30 && t <= 7200)) return { error: `${n} : external.time_limit_s entre 30 et 7200` };
      extRows.push({ question_id: qid, tool: x.tool, label: str(x.label, 200), time_limit_s: t, scenario: x.scenario ?? {}, answer_key: x.answer_key ?? null });
      options = null;
    } else if (q.type !== "long_text") {
      const err = validateQuestion(q.type as QType, q.options, key);
      if (err) return { error: `${n} : ${err}` };
      keyRows.push({ question_id: qid, correct: key ?? null });
    }
    const points = Number(q.points ?? 1);
    if (!(points >= 0 && points <= 1000)) return { error: `${n} : points entre 0 et 1000` };
    const tl = q.time_limit_s == null ? null : Number(q.time_limit_s);
    if (tl !== null && !(Number.isInteger(tl) && tl >= 5 && tl <= 3600)) return { error: `${n} : time_limit_s entre 5 et 3600` };
    rows.push({
      id: qid, test_id: testId, position: start + i, type: q.type, prompt: q.prompt, points,
      image_url: str(q.image_url, 2000), options,
      domain: str(q.domain, 100), variant_group: str(q.variant_group, 100), explanation: str(q.explanation, 5000), time_limit_s: tl,
    });
  }
  return { rows, keyRows, termRows, extRows };
}

