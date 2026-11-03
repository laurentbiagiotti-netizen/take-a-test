"use client";
import { useMemo, useState } from "react";
import { DECODE_OPS, encodeForRecipe, type RecipeStep } from "@/lib/questions/decode";
import type { FwPacket } from "@/lib/questions/firewall";
import type { QType } from "@/lib/questions/kinds";

type Props = { type: QType; options: any; correct: any; onChange: (p: { options: any; correct: any }) => void };

const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <label className="block text-sm">{label}{hint && <span className="text-xs text-faint ml-2">{hint}</span>}<div className="mt-1">{children}</div></label>
);

/* Paquets : une ligne par paquet « libellé ; IP ; port ; protocole ; pays ; heure ; autoriser|bloquer » */
const packetsToText = (ps: FwPacket[] = []) => ps.map((p) => [p.label || "", p.src_ip, p.dst_port, p.protocol, p.country || "", p.hour ?? "", p.expected === "block" ? "bloquer" : "autoriser"].join(" ; ")).join("\n");
function textToPackets(t: string, prefix: string): { packets: FwPacket[]; error: string | null } {
  const lines = t.split("\n").map((l) => l.trim()).filter(Boolean);
  const packets: FwPacket[] = [];
  for (const [i, l] of lines.entries()) {
    const c = l.split(";").map((x) => x.trim());
    if (c.length < 7) return { packets, error: `Ligne ${i + 1} : 7 champs attendus` };
    const exp = c[6].toLowerCase().startsWith("b") ? "block" : c[6].toLowerCase().startsWith("a") ? "allow" : null;
    if (!exp) return { packets, error: `Ligne ${i + 1} : « autoriser » ou « bloquer » attendu` };
    packets.push({ id: `${prefix}${i + 1}`, label: c[0], src_ip: c[1], dst_port: parseInt(c[2], 10), protocol: c[3] || "tcp", country: c[4] || undefined, hour: c[5] === "" ? undefined : parseInt(c[5], 10), expected: exp });
  }
  return { packets, error: null };
}

export default function PracticalEditor({ type, options, correct, onChange }: Props) {
  const o = options || {}, k = correct || {};
  const set = (opt: any, key: any = k) => onChange({ options: opt, correct: key });

  if (type === "sql") {
    const inj = o.mode === "injection";
    return (
      <div className="space-y-3 rounded-lg border border-line p-3">
        <div className="flex gap-4 text-sm">
          {[["query", "Écrire une requête"], ["injection", "Injection SQL (contourner un formulaire)"]].map(([m, l]) => (
            <label key={m} className="flex items-center gap-2"><input type="radio" checked={(o.mode || "query") === m} onChange={() => set({ ...o, mode: m })} />{l}</label>
          ))}
        </div>
        <Field label="Base de l'exercice" hint="CREATE TABLE et INSERT (SQLite)">
          <textarea className="input font-mono text-xs min-h-[140px]" value={o.setup || ""} onChange={(e) => set({ ...o, setup: e.target.value })} />
        </Field>
        {inj ? <>
          <Field label="Requête vulnérable du serveur" hint="{input} = ce que tape le candidat">
            <input className="input font-mono text-xs" value={o.template || ""} placeholder="SELECT login FROM comptes WHERE login = '{input}' AND mdp = 'xxx'" onChange={(e) => set({ ...o, template: e.target.value })} />
          </Field>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Libellé du champ"><input className="input" value={o.field_label || ""} placeholder="Identifiant" onChange={(e) => set({ ...o, field_label: e.target.value })} /></Field>
            <Field label="Réussi si le résultat contient" hint="ex. admin"><input className="input font-mono" value={k.must_contain || ""} onChange={(e) => set(o, { ...k, must_contain: e.target.value })} /></Field>
          </div>
        </> : <>
          <Field label="Requête de référence" hint="le résultat du candidat doit être identique">
            <textarea className="input font-mono text-xs min-h-[70px]" value={k.expected_sql || ""} onChange={(e) => set(o, { ...k, expected_sql: e.target.value })} />
          </Field>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={!!k.ordered} onChange={(e) => set(o, { ...k, ordered: e.target.checked })} />L&apos;ordre des lignes compte</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={o.show_tables !== false} onChange={(e) => set({ ...o, show_tables: e.target.checked })} />Montrer les tables au candidat</label>
          </div>
        </>}
      </div>
    );
  }

  if (type === "decode") return <DecodeEditor o={o} k={k} set={set} />;

  if (type === "password") {
    const rank = o.mode !== "create";
    const p = o.policy || {};
    return (
      <div className="space-y-3 rounded-lg border border-line p-3">
        <div className="flex gap-4 text-sm">
          {[["rank", "Classer des mots de passe"], ["create", "Créer un mot de passe"]].map(([m, l]) => (
            <label key={m} className="flex items-center gap-2"><input type="radio" checked={(rank ? "rank" : "create") === m}
              onChange={() => set(m === "rank" ? { mode: "rank", items: o.items || [] } : { mode: "create", policy: { min_length: 12, upper: true, digit: true, symbol: true, min_score: 3, forbid: ["cybersup"] } }, null)} />{l}</label>
          ))}
        </div>
        {rank ? (
          <Field label="Mots de passe à classer" hint="un par ligne, dans n'importe quel ordre : le bon classement est calculé par zxcvbn">
            <textarea className="input font-mono text-xs min-h-[110px]" value={(o.items || []).map((i: any) => i.text).join("\n")}
              onChange={(e) => set({ mode: "rank", items: e.target.value.split("\n").filter((x) => x.trim()).slice(0, 8).map((t, i) => ({ id: `p${i + 1}`, text: t.trim() })) }, null)} />
          </Field>
        ) : (
          <div className="grid sm:grid-cols-3 gap-3 text-sm">
            <Field label="Longueur minimale"><input className="input" type="number" min={1} max={64} value={p.min_length ?? 12} onChange={(e) => set({ ...o, policy: { ...p, min_length: parseInt(e.target.value) || 1 } }, null)} /></Field>
            <Field label="Robustesse minimale" hint="score zxcvbn 0 à 4"><input className="input" type="number" min={0} max={4} value={p.min_score ?? 3} onChange={(e) => set({ ...o, policy: { ...p, min_score: Math.min(4, Math.max(0, parseInt(e.target.value) || 0)) } }, null)} /></Field>
            <Field label="Mots interdits" hint="séparés par des virgules"><input className="input" value={(p.forbid || []).join(", ")} onChange={(e) => set({ ...o, policy: { ...p, forbid: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) } }, null)} /></Field>
            {[["upper", "Une majuscule"], ["lower", "Une minuscule"], ["digit", "Un chiffre"], ["symbol", "Un caractère spécial"]].map(([key, l]) => (
              <label key={key} className="flex items-center gap-2"><input type="checkbox" checked={!!p[key]} onChange={(e) => set({ ...o, policy: { ...p, [key]: e.target.checked } }, null)} />{l}</label>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (type === "blocks") return <FirewallEditor o={o} k={k} set={set} />;
  return null;
}

function DecodeEditor({ o, k, set }: { o: any; k: any; set: (o: any, k?: any) => void }) {
  const flag: string = k.answers?.[0] || "";
  const recipe: RecipeStep[] = k.recipe || [];
  const [err, setErr] = useState<string | null>(null);
  const apply = (f: string, r: RecipeStep[]) => {
    try { set({ ...o, input: encodeForRecipe(f, r) }, { answers: f ? [f] : [], case_sensitive: true, recipe: r }); setErr(null); }
    catch (e: any) { setErr(e.message); set(o, { answers: f ? [f] : [], case_sensitive: true, recipe: r }); }
  };
  return (
    <div className="space-y-3 rounded-lg border border-line p-3">
      <Field label="Flag à retrouver"><input className="input font-mono" value={flag} onChange={(e) => apply(e.target.value, recipe)} /></Field>
      <div className="text-sm">Recette de décodage attendue <span className="text-xs text-faint">(le message chiffré est fabriqué automatiquement)</span></div>
      <ol className="space-y-1.5">
        {recipe.map((s, i) => {
          const meta = DECODE_OPS.find((x) => x.op === s.op);
          return (
            <li key={i} className="flex items-center gap-2 text-sm">
              <span className="text-faint w-5">{i + 1}.</span>
              <select className="input !w-auto !py-1" value={s.op} onChange={(e) => apply(flag, recipe.map((x, j) => (j === i ? { op: e.target.value as any } : x)))}>
                {DECODE_OPS.filter((x) => x.op.startsWith("from") || ["rot13", "caesar", "xor", "reverse", "url_decode"].includes(x.op)).map((x) => <option key={x.op} value={x.op}>{x.label}</option>)}
              </select>
              {meta?.arg && <input className="input !w-32 !py-1 font-mono" placeholder={meta.arg} value={s.arg || ""} onChange={(e) => apply(flag, recipe.map((x, j) => (j === i ? { ...x, arg: e.target.value } : x)))} />}
              <button className="text-muted hover:text-danger" onClick={() => apply(flag, recipe.filter((_, j) => j !== i))}>×</button>
            </li>
          );
        })}
      </ol>
      <button className="btn-secondary !py-1 text-xs" onClick={() => apply(flag, [...recipe, { op: "from_base64" }])} disabled={recipe.length >= 8}>+ Étape</button>
      {err && <p className="text-xs text-danger">{err}</p>}
      <Field label="Message chiffré présenté au candidat">
        <pre className="input font-mono text-xs whitespace-pre-wrap break-all min-h-[3rem]">{o.input || ""}</pre>
      </Field>
    </div>
  );
}

function FirewallEditor({ o, k, set }: { o: any; k: any; set: (o: any, k?: any) => void }) {
  const [sample, setSample] = useState(() => packetsToText(o.sample));
  const [hidden, setHidden] = useState(() => packetsToText(k.packets));
  const errS = useMemo(() => textToPackets(sample, "s").error, [sample]);
  const errH = useMemo(() => textToPackets(hidden, "h").error, [hidden]);
  return (
    <div className="space-y-3 rounded-lg border border-line p-3">
      <p className="text-xs text-muted">Une ligne par paquet : <code>libellé ; IP source ; port ; protocole ; pays ; heure ; autoriser|bloquer</code>. Barème : sous 50 % de bonnes décisions sur les paquets cachés, 0 point ; puis au prorata.</p>
      <Field label="Paquets d'exemple" hint="visibles par le candidat, avec la décision de son pare-feu">
        <textarea className="input font-mono text-xs min-h-[90px]" value={sample} onChange={(e) => { setSample(e.target.value); const r = textToPackets(e.target.value, "s"); if (!r.error) set({ ...o, sample: r.packets }); }} />
        {errS && <span className="text-xs text-danger">{errS}</span>}
      </Field>
      <Field label="Paquets de correction" hint="cachés au candidat, avec la décision attendue">
        <textarea className="input font-mono text-xs min-h-[140px]" value={hidden} onChange={(e) => { setHidden(e.target.value); const r = textToPackets(e.target.value, "h"); if (!r.error) set(o, { packets: r.packets }); }} />
        {errH && <span className="text-xs text-danger">{errH}</span>}
      </Field>
    </div>
  );
}
