/**
 * Correction faite par la plateforme pour les outils sans serveur
 * (Cybersup OS) : chaque élément est classé « fraud » ou « legit ».
 * Un bon classement vaut 1, une erreur ou un oubli 0.
 */
export type Verdict = "fraud" | "legit";
export type PlatformItem = { id: string; kind: string; data?: unknown };
export type PlatformScenario = { intro?: string; items: PlatformItem[] };

export const VERDICTS: Verdict[] = ["fraud", "legit"];

export function isScenario(s: unknown): s is PlatformScenario {
  const items = (s as PlatformScenario)?.items;
  return Array.isArray(items) && items.length > 0 && items.length <= 200
    && items.every((i) => i && typeof i.id === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(i.id) && typeof i.kind === "string")
    && new Set(items.map((i) => i.id)).size === items.length;
}

/** Erreurs de cohérence entre scénario et corrigé (éditeur de l'épreuve). */
export function checkKey(scenario: unknown, key: unknown): string[] {
  if (!isScenario(scenario)) return ["Le scénario doit contenir une liste « items » (id, kind) sans doublon."];
  if (!key || typeof key !== "object" || Array.isArray(key)) return ["Le corrigé doit associer chaque id à « fraud » ou « legit »."];
  const k = key as Record<string, unknown>;
  const errs: string[] = [];
  for (const it of scenario.items) {
    if (!VERDICTS.includes(k[it.id] as Verdict)) errs.push(`Corrigé manquant ou invalide pour « ${it.id} ».`);
  }
  for (const id of Object.keys(k)) {
    if (!scenario.items.some((i) => i.id === id)) errs.push(`« ${id} » est dans le corrigé mais pas dans le scénario.`);
  }
  return errs;
}

/** Enlève du scénario tout ce qui pourrait trahir la réponse avant de l'envoyer au navigateur. */
const LEAKY = new Set(["isLegit", "isPhishing", "isScam", "verdict", "answer", "tell", "tells", "tell_substring",
  "safe_reason", "consequence", "explanation", "correct", "legit", "fraud"]);

export function publicScenario(s: PlatformScenario): PlatformScenario {
  const strip = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(strip);
    if (v && typeof v === "object") {
      return Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([k]) => !LEAKY.has(k)).map(([k, x]) => [k, strip(x)]));
    }
    return v;
  };
  return { intro: typeof s.intro === "string" ? s.intro : undefined, items: s.items.map((i) => ({ id: i.id, kind: i.kind, data: strip(i.data) })) };
}

export type GradeResult = {
  ratio: number;
  raw: number;
  max: number;
  details: { answered: number; items: { id: string; kind: string; choice: Verdict | null; correct: boolean }[] };
};

export function gradeChoices(scenario: PlatformScenario, key: Record<string, Verdict>, answers: Record<string, unknown>): GradeResult {
  const items = scenario.items.map((it) => {
    const raw = answers[it.id];
    const choice = VERDICTS.includes(raw as Verdict) ? (raw as Verdict) : null;
    return { id: it.id, kind: it.kind, choice, correct: choice !== null && choice === key[it.id] };
  });
  const raw = items.filter((i) => i.correct).length;
  const max = items.length;
  return { ratio: max ? raw / max : 0, raw, max, details: { answered: items.filter((i) => i.choice).length, items } };
}
