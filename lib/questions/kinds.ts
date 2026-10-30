/**
 * Types de questions : formats, validation (éditeur admin et API) et
 * barème (identique à la fonction SQL _grade, utilisé par la démo).
 */
export type QType = "mcq_single" | "mcq_multi" | "long_text" | "terminal" | "ordering" | "matching" | "hotspot" | "short_answer";

export const TYPE_LABEL: Record<QType, string> = {
  mcq_single: "QCM, une réponse",
  mcq_multi: "QCM, plusieurs réponses",
  long_text: "Réponse rédigée",
  terminal: "Défi terminal",
  ordering: "Remettre dans l'ordre",
  matching: "Associer",
  hotspot: "Trouver dans le document",
  short_answer: "Réponse courte / analyse de données",
};

export type Item = { id: string; text: string };
export type HotspotLayout = "code" | "log" | "email" | "table";
export type HotspotOptions = {
  layout: HotspotLayout;
  multi?: boolean;
  header?: { from?: string; to?: string; subject?: string; date?: string };
  columns?: string[];
  segments: { id: string; text?: string; cells?: string[] }[];
};
export type DataBlock = { kind: "table"; columns: string[]; rows: string[][] } | { kind: "text"; text: string };
export type ShortOptions = { data?: DataBlock | null; placeholder?: string };

const isStr = (x: unknown, max = 2000) => typeof x === "string" && x.length <= max;
const items = (x: unknown, min: number, max: number) =>
  Array.isArray(x) && x.length >= min && x.length <= max && x.every((i: any) => isStr(i?.id, 64) && isStr(i?.text, 1000));

/** Valide options + clé d'un type ; renvoie un message d'erreur ou null. */
export function validateQuestion(type: QType, options: any, key: any): string | null {
  switch (type) {
    case "ordering":
      if (!items(options, 2, 20)) return "2 à 20 étapes attendues";
      if (!Array.isArray(key) || key.length !== options.length || new Set(key).size !== key.length || key.some((k: string) => !options.find((o: Item) => o.id === k)))
        return "L'ordre correct doit contenir chaque étape une fois";
      return null;
    case "matching": {
      if (!items(options?.left, 2, 20) || !items(options?.right, 2, 20)) return "2 à 20 éléments de chaque côté";
      if (!key || typeof key !== "object") return "Associations attendues";
      for (const [l, r] of Object.entries(key)) {
        if (!options.left.find((o: Item) => o.id === l) || !options.right.find((o: Item) => o.id === r)) return "Association invalide";
      }
      if (!Object.keys(key).length) return "Au moins une association";
      return null;
    }
    case "hotspot": {
      if (!["code", "log", "email", "table"].includes(options?.layout)) return "Mise en page inconnue";
      const segs = options?.segments;
      if (!Array.isArray(segs) || segs.length < 2 || segs.length > 300) return "2 à 300 lignes ou éléments";
      if (segs.some((s: any) => !isStr(s?.id, 64) || (!isStr(s?.text, 2000) && !(Array.isArray(s?.cells) && s.cells.every((c: any) => isStr(c, 500))))))
        return "Ligne invalide";
      if (!Array.isArray(key) || !key.length || key.some((k: string) => !segs.find((s: any) => s.id === k))) return "Indiquez au moins un élément à repérer";
      return null;
    }
    case "short_answer":
      if (!key || !Array.isArray(key.answers) || !key.answers.length || key.answers.some((a: any) => !isStr(a, 500) || !a.trim()))
        return "Au moins une réponse acceptée";
      if (options?.data && !["table", "text"].includes(options.data.kind)) return "Données invalides";
      if (options?.data?.kind === "table" && (!Array.isArray(options.data.rows) || options.data.rows.length > 2000)) return "Tableau de 2000 lignes maximum";
      return null;
    default:
      return null;
  }
}

const norm = (t: string, cs: boolean) => { const x = (t || "").trim().replace(/\s+/g, " "); return cs ? x : x.toLowerCase(); };
const r2 = (x: number) => Math.round(x * 100) / 100;

/** Barème (crédit partiel), miroir de _grade en SQL. */
export function grade(type: QType, points: number, resp: any, key: any): number {
  if (!resp || typeof resp !== "object") return 0;
  const strArr = (x: any): string[] => (Array.isArray(x) ? Array.from(new Set(x.filter((v: any) => typeof v === "string"))) : []);
  switch (type) {
    case "mcq_single": case "mcq_multi": {
      const sel = strArr(resp.selected);
      return key?.length && sel.length === key.length && sel.every((s) => key.includes(s)) ? points : 0;
    }
    case "ordering": {
      const o = Array.isArray(resp.order) ? resp.order : [];
      return key?.length ? r2(points * key.filter((k: string, i: number) => o[i] === k).length / key.length) : 0;
    }
    case "matching": {
      const n = Object.keys(key || {}).length;
      const pairs = resp.pairs && typeof resp.pairs === "object" ? resp.pairs : {};
      return n ? r2(points * Object.entries(key).filter(([l, r]) => pairs[l] === r).length / n) : 0;
    }
    case "hotspot": {
      const sel = strArr(resp.selected);
      const tp = sel.filter((s) => key.includes(s)).length, fp = sel.length - tp;
      return key?.length ? r2(points * Math.max(0, tp - fp) / key.length) : 0;
    }
    case "short_answer":
      if (typeof resp.text !== "string") return 0;
      return (key?.answers || []).some((a: string) => norm(a, !!key.case_sensitive) === norm(resp.text, !!key.case_sensitive)) ? points : 0;
    default:
      return 0;
  }
}

/** Analyse un CSV simple (séparateur , ou ;) pour les questions « données ». */
export function parseCsv(text: string): { columns: string[]; rows: string[][] } {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim()).slice(0, 2001);
  const sep = (lines[0] || "").includes(";") ? ";" : ",";
  const split = (l: string) => {
    const out: string[] = []; let cur = "", q = false;
    for (let i = 0; i < l.length; i++) {
      const c = l[i];
      if (q) { if (c === '"' && l[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
      else if (c === '"') q = true; else if (c === sep) { out.push(cur); cur = ""; } else cur += c;
    }
    out.push(cur); return out.map((x) => x.trim());
  };
  const [head, ...rest] = lines.map(split);
  return { columns: head || [], rows: rest };
}
