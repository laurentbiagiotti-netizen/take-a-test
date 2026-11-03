"use client";
import { useMemo, useState } from "react";
import type { EvEvent, EvtxOptions } from "@/lib/questions/evtx";

/** Observateur d'événements Windows (eventvwr.msc) reproduit : journaux, filtre, détail, recherche. */
const W = { font: "'Segoe UI', Tahoma, 'DM Sans', sans-serif" };
const LV: Record<string, string> = { "Information": "ℹ️", "Avertissement": "⚠️", "Erreur": "⛔", "Critique": "🛑", "Succès de l'audit": "🔑", "Échec de l'audit": "🔒" };
const btn = "px-3 py-1 border border-[#adadad] bg-[#e1e1e1] hover:bg-[#e5f1fb] hover:border-[#0078d7] text-[12px] text-black";
const field = "w-full border border-[#7a7a7a] px-1.5 py-0.5 text-[12px] text-black bg-white focus:outline-none focus:border-[#0078d7]";

export default function EventViewer({ q, value, onText }: { q: any; value: any; onText: (r: any) => void }) {
  const o: EvtxOptions = q.options || { logs: [], questions: [] };
  const logs = useMemo(() => Array.from(new Set(o.logs.map((e) => e.log))), [o.logs]);
  const [log, setLog] = useState(logs.includes("Sécurité") ? "Sécurité" : logs[0]);
  const [ids, setIds] = useState(""); const [levels, setLevels] = useState<Set<string>>(new Set());
  const [text, setText] = useState(""); const [dlg, setDlg] = useState(false);
  const [sel, setSel] = useState<EvEvent | null>(null); const [tab, setTab] = useState<"gen" | "det">("gen");
  const [sortAsc, setSortAsc] = useState(false);
  const a: Record<string, string> = value?.answers || {};
  const idSet = useMemo(() => new Set(ids.split(/[,;\s]+/).map((x) => parseInt(x, 10)).filter(Number.isFinite)), [ids]);
  const rows = useMemo(() => o.logs.filter((e) => e.log === log
    && (!idSet.size || idSet.has(e.eventId)) && (!levels.size || levels.has(e.level))
    && (!text.trim() || `${e.message} ${e.source} ${e.eventId}`.toLowerCase().includes(text.trim().toLowerCase())))
    .sort((x, y) => (sortAsc ? x.time.localeCompare(y.time) : y.time.localeCompare(x.time))), [o.logs, log, idSet, levels, text, sortAsc]);
  const filtered = idSet.size > 0 || levels.size > 0 || !!text.trim();
  const fmt = (t: string) => { const [d, h] = t.split(" "); const [y, m, j] = d.split("-"); return `${j}/${m}/${y} ${h}`; };

  return (
    <div className="space-y-4">
      <div className="relative select-none border border-[#7a7a7a] bg-[#f0f0f0] text-[#1a1a1a] overflow-hidden rounded-sm" style={W}>
        <div className="flex items-center justify-between h-8 px-3 bg-white text-[12px] border-b border-[#ddd]"><span>📋 Observateur d&apos;événements</span><span className="text-[#666]">— ☐ ✕</span></div>
        <div className="px-2 h-6 flex items-center text-[12px] text-[#888] border-b border-[#ddd]">Fichier  Action  Affichage  ?</div>
        <div className="grid grid-cols-[170px_1fr_150px] h-[470px] bg-white text-[12px] text-[#1a1a1a] [&_td]:text-[#1a1a1a] [&_th]:text-[#1a1a1a] [&_th]:whitespace-nowrap">
          <div className="border-r border-[#ccc] py-1 overflow-auto">
            <div className="px-2 h-[22px] flex items-center">🖥️ Observateur (local)</div>
            <div className="px-4 h-[22px] flex items-center">📁 Journaux Windows</div>
            {logs.map((l) => (
              <button key={l} className={`w-full text-left pl-8 h-[22px] flex items-center gap-1 ${log === l ? "bg-[#cce8ff]" : "hover:bg-[#e5f3ff]"}`} onClick={() => { setLog(l); setSel(null); }}>📄 {l}</button>
            ))}
          </div>
          <div className="flex flex-col min-w-0">
            <div className="px-2 py-1 bg-[#f7f7f7] border-b border-[#ddd] truncate">
              <b>{log}</b> : nombre d&apos;événements : {o.logs.filter((e) => e.log === log).length}{filtered && <> · <span className="text-[#0067c0]">Filtré : {rows.length} événement(s)</span></>}
            </div>
            <div className="flex-1 overflow-auto border-b border-[#ccc]">
              <table className="w-full">
                <thead className="sticky top-0 bg-white"><tr className="text-left border-b border-[#ddd]">
                  <th className="font-normal px-2 py-1">Niveau</th>
                  <th className="font-normal px-2 cursor-pointer" onClick={() => setSortAsc((x) => !x)}>Date et heure {sortAsc ? "▲" : "▼"}</th>
                  <th className="font-normal px-2">Source</th><th className="font-normal px-2">ID</th><th className="font-normal px-2">Catégorie</th>
                </tr></thead>
                <tbody>{rows.map((e) => (
                  <tr key={e.rid} className={`cursor-default whitespace-nowrap ${sel?.rid === e.rid ? "bg-[#cce8ff]" : "hover:bg-[#e5f3ff]"}`} onClick={() => setSel(e)}>
                    <td className="px-2 py-[2px]">{LV[e.level]} {e.level}</td><td className="px-2">{fmt(e.time)}</td>
                    <td className="px-2 truncate max-w-[10rem]">{e.source}</td><td className="px-2">{e.eventId}</td><td className="px-2">{e.task}</td>
                  </tr>
                ))}</tbody>
              </table>
              {!rows.length && <p className="p-3 text-[#777]">Aucun événement ne correspond au filtre.</p>}
            </div>
            <div className="h-[170px] overflow-auto">
              {sel ? <>
                <div className="px-2 py-1 bg-[#f7f7f7] border-b border-[#ddd]">Événement {sel.eventId}, {sel.source}</div>
                <div className="flex gap-0.5 px-2 pt-1">{[["gen", "Général"], ["det", "Détails"]].map(([k, l]) => <button key={k} className={`px-3 py-0.5 border border-b-0 ${tab === k ? "bg-white border-[#adadad]" : "border-transparent"}`} onClick={() => setTab(k as any)}>{l}</button>)}</div>
                {tab === "gen" ? (
                  <div className="px-3 py-2 border-t border-[#adadad] select-text">
                    <pre className="whitespace-pre-wrap font-[inherit]">{sel.message}</pre>
                    <div className="grid grid-cols-[110px_1fr] gap-x-3 mt-2 text-[#444]">
                      <span>Journal :</span><span>{sel.log}</span><span>Source :</span><span>{sel.source}</span><span>Enregistré :</span><span>{fmt(sel.time)}</span>
                      <span>ID :</span><span>{sel.eventId}</span><span>Ordinateur :</span><span>{sel.computer}</span>
                    </div>
                  </div>
                ) : (
                  <table className="mx-3 my-2 select-text"><tbody>{Object.entries({ EventID: String(sel.eventId), EventRecordID: String(sel.rid), ...(sel.data || {}) }).map(([k, v]) => <tr key={k}><td className="pr-4 text-[#555]">{k}</td><td className="font-mono">{v}</td></tr>)}</tbody></table>
                )}
              </> : <p className="p-3 text-[#777]">Sélectionnez un événement pour voir son détail.</p>}
            </div>
          </div>
          <div className="border-l border-[#ccc] p-2 space-y-1 bg-[#fafafa]">
            <div className="font-medium mb-1">Actions</div>
            <button className="block text-left text-[#0067c0] hover:underline" onClick={() => setDlg(true)}>🔎 Filtrer le journal actuel…</button>
            <button className="block text-left text-[#0067c0] hover:underline disabled:text-[#999]" disabled={!filtered} onClick={() => { setIds(""); setLevels(new Set()); setText(""); }}>✖ Effacer le filtre</button>
            <div className="pt-2"><label className="block text-[#555]">Rechercher…<input className={field} value={text} onChange={(e) => setText(e.target.value)} placeholder="j.dupont, 203.0…" /></label></div>
          </div>
        </div>
        {dlg && (
          <div className="absolute inset-0 z-20 flex items-start justify-center pt-12 bg-black/10">
            <div className="bg-[#f0f0f0] border border-[#0078d7] shadow-xl w-[420px] text-[12px]" role="dialog" aria-label="Filtrer le journal actuel">
              <div className="flex justify-between px-2 h-7 items-center bg-white"><span>Filtrer le journal actuel</span><button onClick={() => setDlg(false)} className="px-2 hover:bg-[#e81123] hover:text-white">✕</button></div>
              <div className="p-3 space-y-3">
                <div><div className="mb-1">Niveau d&apos;événement :</div><div className="grid grid-cols-2 gap-1">
                  {Object.keys(LV).map((l) => <label key={l} className="flex items-center gap-1.5"><input type="checkbox" checked={levels.has(l)} onChange={(e) => setLevels((s) => { const n = new Set(s); if (e.target.checked) n.add(l); else n.delete(l); return n; })} />{l}</label>)}
                </div></div>
                <label className="block">Inclut/exclut des ID d&apos;événement (séparés par des virgules) :<input className={`${field} mt-1`} value={ids} onChange={(e) => setIds(e.target.value)} placeholder="4625, 4740" /></label>
                <div className="flex justify-end gap-2"><button className={btn} onClick={() => setDlg(false)}>OK</button><button className={btn} onClick={() => { setIds(""); setLevels(new Set()); }}>Effacer</button></div>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {o.questions.map((qq) => (
          <label key={qq.id} className="block text-sm rounded-lg border border-line bg-surface-2/50 p-3">{qq.label}
            <input className="input mt-2 font-mono" maxLength={120} placeholder={qq.placeholder || ""} autoComplete="off" spellCheck={false}
              value={a[qq.id] || ""} onChange={(e) => onText({ answers: { ...a, [qq.id]: e.target.value } })} />
          </label>
        ))}
      </div>
    </div>
  );
}
