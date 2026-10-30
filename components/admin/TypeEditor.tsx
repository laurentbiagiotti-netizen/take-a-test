"use client";
import { useState } from "react";
import { parseCsv, type QType } from "@/lib/questions/kinds";

/**
 * Éditeurs des types « fun » avec des formats de saisie simples :
 *  - ordre       : une étape par ligne, dans l'ordre correct
 *  - association : « gauche => droite » par ligne (« => leurre » pour un leurre)
 *  - repérage    : une ligne par élément, « * » devant les bons
 *  - réponse courte : réponses acceptées + données (CSV ou texte)
 */
type Props = { type: QType; options: any; correct: any; onChange: (p: { options: any; correct: any }) => void };

const id = (p: string, i: number) => `${p}${i + 1}`;

function initialDraft(type: QType, o: any, c: any): string {
  try {
    if (type === "ordering") return (c || []).map((k: string) => o.find((x: any) => x.id === k)?.text ?? "").join("\n");
    if (type === "matching") {
      const used = new Set(Object.values(c || {}));
      const lines = (o?.left || []).map((l: any) => `${l.text} => ${o.right.find((r: any) => r.id === c?.[l.id])?.text ?? ""}`);
      for (const r of o?.right || []) if (!used.has(r.id)) lines.push(`=> ${r.text}`);
      return lines.join("\n");
    }
    if (type === "hotspot") {
      const seg = (s: any) => (c || []).includes(s.id) ? "* " : "";
      if (o?.layout === "table") return [(o.columns || []).join(" ; "), ...(o.segments || []).map((s: any) => seg(s) + (s.cells || []).join(" ; "))].join("\n");
      return (o?.segments || []).map((s: any) => seg(s) + s.text).join("\n");
    }
  } catch { /* brouillon vide */ }
  return "";
}

export default function TypeEditor({ type, options, correct, onChange }: Props) {
  const [draft, setDraft] = useState(() => initialDraft(type, options, correct));
  const [csv, setCsv] = useState(() => options?.data?.kind === "table" ? [options.data.columns.join(";"), ...options.data.rows.map((r: string[]) => r.join(";"))].join("\n") : options?.data?.kind === "text" ? options.data.text : "");

  if (type === "ordering") {
    const apply = (t: string) => {
      setDraft(t);
      const steps = t.split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 20);
      const items = steps.map((text, i) => ({ id: id("o", i), text }));
      onChange({ options: items, correct: items.map((x) => x.id) });
    };
    return (
      <label className="block text-sm text-muted">Étapes, une par ligne, <b className="text-fg">dans l&apos;ordre correct</b> (elles seront mélangées pour le candidat)
        <textarea className="input mt-1 min-h-[140px]" value={draft} onChange={(e) => apply(e.target.value)} placeholder={"Détecter\nContenir\nÉradiquer\nRestaurer"} />
      </label>
    );
  }

  if (type === "matching") {
    const apply = (t: string) => {
      setDraft(t);
      const left: any[] = [], right: any[] = [], key: Record<string, string> = {};
      for (const line of t.split("\n").slice(0, 40)) {
        const [l, r] = line.split("=>").map((x) => (x ?? "").trim());
        if (!line.includes("=>") || !r) continue;
        let rid = right.find((x) => x.text === r)?.id;
        if (!rid) { rid = id("r", right.length); right.push({ id: rid, text: r }); }
        if (l) { const lid = id("l", left.length); left.push({ id: lid, text: l }); key[lid] = rid; }
      }
      onChange({ options: { left, right }, correct: key });
    };
    return (
      <label className="block text-sm text-muted">Une association par ligne : <code className="text-fg">gauche =&gt; droite</code>. Ajoutez des leurres avec <code className="text-fg">=&gt; réponse piège</code>.
        <textarea className="input mt-1 min-h-[140px] font-mono text-xs" value={draft} onChange={(e) => apply(e.target.value)} placeholder={"22 => SSH\n53 => DNS\n443 => HTTPS\n=> Telnet"} />
      </label>
    );
  }

  if (type === "hotspot") {
    const layout = options?.layout || "code";
    const rebuild = (t: string, patch: any = {}) => {
      const o = { ...options, layout, multi: options?.multi !== false, ...patch };
      const lines = t.split("\n").slice(0, 300);
      const key: string[] = [];
      let segments: any[] = [];
      if (o.layout === "table") {
        const [head, ...rows] = lines.filter((l) => l.trim());
        o.columns = (head || "").split(";").map((x) => x.trim());
        segments = rows.map((r, i) => {
          const star = r.trimStart().startsWith("*");
          if (star) key.push(id("s", i));
          return { id: id("s", i), cells: r.trimStart().replace(/^\*\s?/, "").split(";").map((x) => x.trim()) };
        });
      } else {
        segments = lines.filter((l, i) => l.trim() || o.layout === "code" || i < lines.length - 1).map((l, i) => {
          const star = /^\*\s/.test(l) || l === "*";
          if (star) key.push(id("s", i));
          return { id: id("s", i), text: star ? l.replace(/^\*\s?/, "") : l };
        });
      }
      onChange({ options: { ...o, segments }, correct: key });
    };
    return (
      <div className="space-y-2 text-sm">
        <div className="flex flex-wrap gap-3 items-center">
          <label className="text-muted">Présentation
            <select className="input mt-1 w-auto" value={layout} onChange={(e) => rebuild(draft, { layout: e.target.value })}>
              <option value="code">Code (trouver la ligne fautive)</option>
              <option value="log">Journal (trouver les lignes suspectes)</option>
              <option value="email">Mail (repérer les indices de phishing)</option>
              <option value="table">Tableau de données (repérer les lignes)</option>
            </select>
          </label>
          <label className="flex items-center gap-2 mt-5">
            <input type="checkbox" checked={options?.multi !== false} onChange={(e) => rebuild(draft, { multi: e.target.checked })} /> Plusieurs éléments à trouver
          </label>
        </div>
        {layout === "email" && (
          <div className="grid sm:grid-cols-2 gap-2">
            {(["from", "to", "subject", "date"] as const).map((k) => (
              <input key={k} className="input" placeholder={{ from: "De", to: "À", subject: "Objet", date: "Date" }[k]}
                value={options?.header?.[k] || ""} onChange={(e) => rebuild(draft, { header: { ...(options?.header || {}), [k]: e.target.value } })} />
            ))}
          </div>
        )}
        <label className="block text-muted">
          {layout === "table" ? "Première ligne : colonnes séparées par « ; ». Puis une ligne par enregistrement. Mettez « * » devant les lignes à repérer." :
            "Une ligne par élément. Mettez « * » (étoile + espace) devant les éléments à repérer."}
          <textarea className="input mt-1 min-h-[180px] font-mono text-xs" spellCheck={false} value={draft} onChange={(e) => { setDraft(e.target.value); rebuild(e.target.value); }}
            placeholder={layout === "code" ? "def login(user, pwd):\n* sql = \"SELECT ... '\" + user + \"'\"\n    return db.execute(sql)" : layout === "email" ? "Bonjour,\n* Votre compte sera supprimé dans 2 h\n* Cliquez ici : http://banque-securite.ru" : layout === "table" ? "date ; compte ; montant\n12/10 ; a.martin ; 45\n* 12/10 ; a.martin ; 9800" : "10.0.0.4 GET / 200\n* 198.51.100.23 GET /admin/../../etc/passwd 403"} />
        </label>
      </div>
    );
  }

  if (type === "short_answer") {
    const key = correct && !Array.isArray(correct) ? correct : { answers: [], case_sensitive: false };
    const setData = (t: string, kind: "table" | "text" | "none") => {
      setCsv(t);
      const data = kind === "none" || !t.trim() ? null : kind === "table" ? { kind: "table", ...parseCsv(t) } : { kind: "text", text: t.slice(0, 50000) };
      onChange({ options: { ...(options || {}), data }, correct: key });
    };
    const kind: "table" | "text" | "none" = options?.data?.kind || "none";
    return (
      <div className="space-y-2 text-sm">
        <label className="block text-muted">Réponses acceptées, une par ligne (espaces en trop ignorés)
          <textarea className="input mt-1 font-mono text-xs" rows={3} value={(key.answers || []).join("\n")}
            onChange={(e) => onChange({ options, correct: { ...key, answers: e.target.value.split("\n").map((x) => x.trim()).filter(Boolean) } })} />
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={!!key.case_sensitive} onChange={(e) => onChange({ options, correct: { ...key, case_sensitive: e.target.checked } })} /> Respecter majuscules et minuscules
        </label>
        <label className="block text-muted">Indication dans le champ de réponse
          <input className="input mt-1" value={options?.placeholder || ""} onChange={(e) => onChange({ options: { ...(options || {}), placeholder: e.target.value }, correct: key })} />
        </label>
        <div className="flex gap-3 items-center">
          <span className="text-muted">Données à analyser :</span>
          {(["none", "table", "text"] as const).map((k) => (
            <label key={k} className="flex items-center gap-1">
              <input type="radio" checked={kind === k} onChange={() => setData(csv, k)} />
              {{ none: "aucune", table: "tableau (CSV)", text: "texte / journal" }[k]}
            </label>
          ))}
        </div>
        {kind !== "none" && (
          <textarea className="input font-mono text-xs min-h-[160px]" spellCheck={false} value={csv} onChange={(e) => setData(e.target.value, kind)}
            placeholder={kind === "table" ? "ip;requêtes;pays\n10.0.0.1;12;FR\n198.51.100.23;4021;RU" : "Collez ici un journal, un extrait de fichier…"} />
        )}
      </div>
    );
  }
  return null;
}
