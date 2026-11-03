"use client";
import { useEffect, useRef, useState } from "react";
import { decide, FW_FIELDS, FW_OPS, type FwCond, type FwPacket, type FwProgram } from "@/lib/questions/firewall";

/**
 * Pare-feu en blocs (Blockly, Apache 2.0). Les blocs ne génèrent pas de code :
 * l'espace de travail est converti en règles JSON, évaluées sur des paquets.
 */
let defined = false;
function defineBlocks(B: any) {
  if (defined) return;
  defined = true;
  B.common.defineBlocksWithJsonArray([
    {
      type: "fw_policy", message0: "Pare-feu, politique par défaut : %1",
      args0: [{ type: "field_dropdown", name: "DEFAULT", options: [["tout autoriser", "allow"], ["tout bloquer", "block"]] }],
      message1: "%1", args1: [{ type: "input_statement", name: "RULES", check: "Rule" }],
      message2: "(la première règle qui correspond s'applique)",
      colour: 20, deletable: false, tooltip: "Les paquets qui ne correspondent à aucune règle suivent la politique par défaut",
    },
    {
      type: "fw_rule", message0: "si %1 alors %2",
      args0: [{ type: "input_value", name: "COND", check: "Boolean" },
        { type: "field_dropdown", name: "ACTION", options: [["bloquer", "block"], ["autoriser", "allow"]] }],
      previousStatement: "Rule", nextStatement: "Rule", colour: 210, inputsInline: true,
    },
    {
      type: "fw_cmp", message0: "%1 %2 %3",
      args0: [{ type: "field_dropdown", name: "FIELD", options: FW_FIELDS.map(([v, l]) => [l, v]) },
        { type: "field_dropdown", name: "OP", options: FW_OPS.map(([v, l]) => [l, v]) },
        { type: "field_input", name: "VALUE", text: "22" }],
      output: "Boolean", colour: 160, tooltip: "Réseau : 10.0.0.0/8 ; liste : FR, BE, CH",
    },
    { type: "fw_and", message0: "%1 et %2", args0: [{ type: "input_value", name: "A", check: "Boolean" }, { type: "input_value", name: "B", check: "Boolean" }], output: "Boolean", colour: 260, inputsInline: true },
    { type: "fw_or", message0: "%1 ou %2", args0: [{ type: "input_value", name: "A", check: "Boolean" }, { type: "input_value", name: "B", check: "Boolean" }], output: "Boolean", colour: 260, inputsInline: true },
    { type: "fw_not", message0: "pas %1", args0: [{ type: "input_value", name: "A", check: "Boolean" }], output: "Boolean", colour: 260 },
  ]);
}

function condOf(b: any): FwCond | null {
  if (!b) return null;
  switch (b.type) {
    case "fw_cmp": return { field: b.getFieldValue("FIELD"), op: b.getFieldValue("OP"), value: String(b.getFieldValue("VALUE") || "") };
    case "fw_and": case "fw_or": {
      const a = condOf(b.getInputTargetBlock("A")), c = condOf(b.getInputTargetBlock("B"));
      if (!a || !c) return a || c;
      return b.type === "fw_and" ? { and: [a, c] } : { or: [a, c] };
    }
    case "fw_not": { const a = condOf(b.getInputTargetBlock("A")); return a ? { not: a } : null; }
  }
  return null;
}

function programOf(ws: any): FwProgram {
  const top = ws.getTopBlocks(false).find((b: any) => b.type === "fw_policy");
  const prog: FwProgram = { default: top?.getFieldValue("DEFAULT") === "block" ? "block" : "allow", rules: [] };
  let r = top?.getInputTargetBlock("RULES");
  while (r && prog.rules.length < 50) {
    if (r.type === "fw_rule") prog.rules.push({ cond: condOf(r.getInputTargetBlock("COND")), action: r.getFieldValue("ACTION") === "allow" ? "allow" : "block" });
    r = r.getNextBlock();
  }
  return prog;
}

const TOOLBOX = {
  kind: "flyoutToolbox",
  contents: [
    { kind: "block", type: "fw_rule" },
    { kind: "block", type: "fw_cmp", fields: { FIELD: "dst_port", OP: "eq", VALUE: "22" } },
    { kind: "block", type: "fw_cmp", fields: { FIELD: "src_ip", OP: "in_cidr", VALUE: "10.0.0.0/8" } },
    { kind: "block", type: "fw_cmp", fields: { FIELD: "country", OP: "in_list", VALUE: "FR, BE" } },
    { kind: "block", type: "fw_and" }, { kind: "block", type: "fw_or" }, { kind: "block", type: "fw_not" },
  ],
};

export default function FirewallBlocks({ q, value, onText }: { q: any; value: any; onText: (r: any) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const [prog, setProg] = useState<FwProgram | null>(value?.program || null);
  const [err, setErr] = useState(false);
  const sample: FwPacket[] = q.options?.sample || [];
  const emit = useRef(onText); emit.current = onText;

  useEffect(() => {
    let ws: any, disposed = false;
    (async () => {
      try {
        const B: any = await import("blockly/core");
        await import("blockly/blocks");
        const fr: any = await import("blockly/msg/fr");
        await (document as any).fonts?.ready;
        if (disposed || !host.current) return;
        B.setLocale(fr.default || fr);
        defineBlocks(B);
        const theme = B.Theme.defineTheme("cybersup", {
          base: B.Themes.Classic, name: "cybersup",
          componentStyles: { workspaceBackgroundColour: "#0b0e16", toolboxBackgroundColour: "#10141f", flyoutBackgroundColour: "#161b29",
            flyoutOpacity: 1, scrollbarColour: "#323b55", insertionMarkerColour: "#fd7119", cursorColour: "#fd7119" },
          fontStyle: { family: "\"DM Sans\", system-ui, sans-serif", weight: "500", size: 11 },
        });
        ws = B.inject(host.current, { toolbox: TOOLBOX, theme, media: "/vendor/blockly/", sounds: false, trashcan: true, renderer: "thrasos", move: { scrollbars: true, drag: true, wheel: true },
          zoom: { controls: true, startScale: 0.9 }, grid: { spacing: 24, length: 2, colour: "#1c2233", snap: true } });
        if (value?.state) { try { B.serialization.workspaces.load(value.state, ws); } catch { /* état illisible : on repart de zéro */ } }
        if (!ws.getTopBlocks(false).some((b: any) => b.type === "fw_policy")) {
          const p = ws.newBlock("fw_policy"); p.initSvg(); p.render(); p.moveBy(30, 30);
        }
        let t: any;
        ws.addChangeListener((e: any) => {
          if (e.isUiEvent) return;
          clearTimeout(t);
          t = setTimeout(() => {
            const program = programOf(ws);
            setProg(program);
            emit.current({ program, state: B.serialization.workspaces.save(ws) });
          }, 300);
        });
        setProg(programOf(ws));
      } catch (e) { console.error(e); setErr(true); }
    })();
    return () => { disposed = true; ws?.dispose(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.id]);

  return (
    <div className="space-y-4">
      {err ? <p className="text-danger text-sm">L&apos;éditeur de blocs n&apos;a pas pu se charger. Rechargez la page.</p>
        : <div ref={host} className="h-[440px] rounded-xl overflow-hidden border border-line" aria-label="Espace de travail du pare-feu : glissez des blocs depuis la gauche" />}
      <p className="text-xs text-faint">Glissez une règle « si … alors » sous le bloc orange, puis une condition dans la règle. Réseau au format 10.0.0.0/8, liste séparée par des virgules.</p>
      {sample.length > 0 && (
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted mb-1">Paquets d&apos;exemple et décision de votre pare-feu</div>
          <div className="overflow-auto rounded-lg border border-line">
            <table className="w-full text-xs font-mono">
              <thead className="bg-surface-2"><tr>{["Paquet", "IP source", "Port", "Proto", "Pays", "Heure", "Votre pare-feu"].map((h) => <th key={h} className="text-left px-3 py-2 text-muted">{h}</th>)}</tr></thead>
              <tbody>
                {sample.map((p) => {
                  const d = prog ? decide(prog, p) : null;
                  return (
                    <tr key={p.id} className="border-t border-line">
                      <td className="px-3 py-1.5 font-sans">{p.label || p.id}</td><td className="px-3">{p.src_ip}</td><td className="px-3">{p.dst_port}</td>
                      <td className="px-3">{p.protocol}</td><td className="px-3">{p.country || "-"}</td><td className="px-3">{p.hour ?? "-"}</td>
                      <td className={`px-3 font-semibold ${d === "block" ? "text-danger" : "text-ok"}`}>{d === "block" ? "bloqué" : d === "allow" ? "autorisé" : "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-faint mt-1">La correction utilise d&apos;autres paquets, que vous ne voyez pas.</p>
        </div>
      )}
    </div>
  );
}
