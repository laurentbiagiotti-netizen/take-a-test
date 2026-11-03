"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AdState, AdUser } from "@/lib/questions/adsim";

/**
 * Console « Utilisateurs et ordinateurs Active Directory » (dsa.msc) et
 * « Gestion des stratégies de groupe » (gpmc.msc), reproduites dans le navigateur :
 * arborescence, liste, menu contextuel (clic droit), assistant de création,
 * fenêtre Propriétés à onglets. Rien n'est envoyé à un vrai annuaire.
 */
type Sel = { kind: "user"; id: string } | { kind: "group"; id: string } | null;
type Menu = { x: number; y: number; items: { label: string; act: () => void; sep?: boolean; disabled?: boolean }[] } | null;

const W = { font: "'Segoe UI', Tahoma, 'DM Sans', sans-serif" };
const I = {
  domain: <svg width="16" height="16" viewBox="0 0 16 16"><rect x="1" y="3" width="14" height="10" rx="1" fill="#3b82c4" /><rect x="3" y="5" width="10" height="2" fill="#bfe0ff" /><rect x="3" y="9" width="6" height="2" fill="#bfe0ff" /></svg>,
  ou: <svg width="16" height="16" viewBox="0 0 16 16"><path d="M1 4h5l1 1h8v8H1z" fill="#e8b84a" /><rect x="9" y="8" width="5" height="4" fill="#fff" stroke="#8a6d1f" strokeWidth=".6" /></svg>,
  user: <svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="5" r="3" fill="#4a7fb5" /><path d="M2 15c0-4 3-6 6-6s6 2 6 6z" fill="#4a7fb5" /></svg>,
  userOff: <svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="5" r="3" fill="#8aa1b8" /><path d="M2 15c0-4 3-6 6-6s6 2 6 6z" fill="#8aa1b8" /><circle cx="12" cy="12" r="3.5" fill="#fff" stroke="#333" /><path d="M10 12h4" stroke="#333" strokeWidth="1.5" /></svg>,
  group: <svg width="16" height="16" viewBox="0 0 16 16"><circle cx="5.5" cy="5" r="2.5" fill="#3f8f5a" /><circle cx="10.5" cy="5" r="2.5" fill="#56a872" /><path d="M0 14c0-3 2.5-5 5.5-5S11 11 11 14z" fill="#3f8f5a" /><path d="M6 14c0-3 2-5 4.5-5S16 11 16 14z" fill="#56a872" /></svg>,
  gpo: <svg width="16" height="16" viewBox="0 0 16 16"><rect x="2" y="1" width="11" height="14" fill="#fff" stroke="#666" /><path d="M4 5h7M4 8h7M4 11h5" stroke="#3b82c4" /></svg>,
};

const btn = "px-3 py-1 border border-[#adadad] bg-[#e1e1e1] hover:bg-[#e5f1fb] hover:border-[#0078d7] text-[12px] text-black disabled:opacity-50";
const field = "w-full border border-[#7a7a7a] px-1.5 py-0.5 text-[12px] text-black bg-white focus:outline-none focus:border-[#0078d7]";

function Dialog({ title, onClose, children, width = 420 }: { title: string; onClose: () => void; children: React.ReactNode; width?: number }) {
  return (
    <div className="absolute inset-0 z-20 flex items-start justify-center pt-10 bg-black/10" onMouseDown={(e) => e.stopPropagation()}>
      <div className="bg-[#f0f0f0] border border-[#0078d7] shadow-xl text-black" style={{ width, ...W }} role="dialog" aria-label={title}>
        <div className="flex items-center justify-between px-2 h-7 bg-white text-[12px]"><span>{title}</span><button onClick={onClose} className="px-2 hover:bg-[#e81123] hover:text-white" aria-label="Fermer">✕</button></div>
        <div className="p-3 text-[12px]">{children}</div>
      </div>
    </div>
  );
}

export default function AdConsole({ q, value, onChange }: { q: any; value: any; onChange: (r: any) => void }) {
  const initial: AdState = q.options?.initial;
  const [s, setS] = useState<AdState>(() => (value?.state ? value.state : JSON.parse(JSON.stringify(initial))));
  const [ou, setOu] = useState<string>(s.ous.find((o) => o.parent === null)?.id || "");
  const [open, setOpen] = useState<Set<string>>(() => new Set(s.ous.map((o) => o.id)));
  const [sel, setSel] = useState<Sel>(null);
  const [menu, setMenu] = useState<Menu>(null);
  const [view, setView] = useState<"dsa" | "gpmc">("dsa");
  const [dlg, setDlg] = useState<null | { t: "newUser" | "newGroup" | "newOu" | "move" | "props" | "reset" | "addGroup" | "link"; id?: string }>(null);
  const [log, setLog] = useState<string[]>([]);
  const [done, setDone] = useState<boolean[]>(() => value?.done || (q.options?.tasks || []).map(() => false));
  const host = useRef<HTMLDivElement>(null);

  const commit = (n: AdState, msg?: string) => { setS(n); onChange({ state: n, done }); if (msg) setLog((l) => [msg, ...l].slice(0, 6)); };
  useEffect(() => { onChange({ state: s, done }); }, [done]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const c = () => setMenu(null); window.addEventListener("click", c); return () => window.removeEventListener("click", c); }, []);

  const children = (pid: string | null) => s.ous.filter((o) => o.parent === pid);
  const items = useMemo(() => [
    ...s.ous.filter((o) => o.parent === ou).map((o) => ({ kind: "ou" as const, id: o.id, name: o.name, type: "Unité d'organisation", desc: "" })),
    ...s.users.filter((u) => u.ou === ou).map((u) => ({ kind: "user" as const, id: u.sam, name: u.name, type: "Utilisateur", desc: u.enabled ? u.sam : `${u.sam} (désactivé)` })),
    ...s.groups.filter((g) => g.ou === ou).map((g) => ({ kind: "group" as const, id: g.name, name: g.name, type: "Groupe de sécurité - Global", desc: `${s.users.filter((u) => u.groups.includes(g.name)).length} membre(s)` })),
  ], [s, ou]);

  const upd = (sam: string, f: (u: AdUser) => AdUser, msg: string) => commit({ ...s, users: s.users.map((u) => (u.sam === sam ? f({ ...u, groups: [...u.groups] }) : u)) }, msg);
  const ctx = (e: React.MouseEvent, items: NonNullable<Menu>["items"]) => {
    e.preventDefault(); e.stopPropagation();
    const r = host.current!.getBoundingClientRect();
    setMenu({ x: e.clientX - r.left, y: e.clientY - r.top, items });
  };
  const userMenu = (u: AdUser): NonNullable<Menu>["items"] => [
    { label: "Ajouter à un groupe…", act: () => setDlg({ t: "addGroup", id: u.sam }) },
    { label: u.enabled ? "Désactiver le compte" : "Activer le compte", act: () => upd(u.sam, (x) => ({ ...x, enabled: !x.enabled }), `${u.sam} : compte ${u.enabled ? "désactivé" : "activé"}`) },
    { label: "Réinitialiser le mot de passe…", act: () => setDlg({ t: "reset", id: u.sam }) },
    { label: "Déplacer…", act: () => setDlg({ t: "move", id: u.sam }) },
    { label: "Supprimer", sep: true, act: () => { if (confirm(`Voulez-vous vraiment supprimer l'objet utilisateur « ${u.name} » ?`)) commit({ ...s, users: s.users.filter((x) => x.sam !== u.sam) }, `${u.sam} supprimé`); } },
    { label: "Propriétés", sep: true, act: () => setDlg({ t: "props", id: u.sam }) },
  ];
  const ouMenu = (id: string): NonNullable<Menu>["items"] => [
    { label: "Nouveau › Utilisateur", act: () => { setOu(id); setDlg({ t: "newUser" }); } },
    { label: "Nouveau › Groupe", act: () => { setOu(id); setDlg({ t: "newGroup" }); } },
    { label: "Nouveau › Unité d'organisation", act: () => { setOu(id); setDlg({ t: "newOu" }); } },
  ];

  const Tree = ({ pid, depth }: { pid: string | null; depth: number }) => (
    <>{children(pid).map((o) => {
      const kids = children(o.id).length > 0;
      const links = s.gpos.filter((g) => g.links.includes(o.id));
      return (
        <div key={o.id}>
          <div className={`flex items-center gap-1 h-[22px] pr-2 cursor-default whitespace-nowrap ${ou === o.id ? "bg-[#cce8ff]" : "hover:bg-[#e5f3ff]"}`} style={{ paddingLeft: 4 + depth * 14 }}
            onClick={() => { setOu(o.id); setSel(null); }} onContextMenu={(e) => { setOu(o.id); ctx(e, view === "dsa" ? ouMenu(o.id) : [{ label: "Lier un objet GPO existant…", act: () => setDlg({ t: "link", id: o.id }) }]); }}>
            <button className="w-3 text-[10px] text-[#555]" onClick={(e) => { e.stopPropagation(); setOpen((x) => { const n = new Set(x); if (n.has(o.id)) n.delete(o.id); else n.add(o.id); return n; }); }}>{kids || (view === "gpmc" && links.length) ? (open.has(o.id) ? "▾" : "▸") : ""}</button>
            {I.ou}<span>{o.name}</span>
          </div>
          {open.has(o.id) && <>
            {view === "gpmc" && links.map((g) => (
              <div key={g.name} className="flex items-center gap-1 h-[22px] text-[#1a1a1a] hover:bg-[#e5f3ff] whitespace-nowrap" style={{ paddingLeft: 22 + (depth + 1) * 14 }}
                onContextMenu={(e) => ctx(e, [{ label: "Supprimer le lien", act: () => commit({ ...s, gpos: s.gpos.map((x) => (x.name === g.name ? { ...x, links: x.links.filter((l) => l !== o.id) } : x)) }, `Lien « ${g.name} » supprimé de ${o.name}`) }])}>
                <span className="relative">{I.gpo}<span className="absolute -bottom-0.5 -left-0.5 text-[9px]">↗</span></span><span>{g.name}</span>
              </div>
            ))}
            <Tree pid={o.id} depth={depth + 1} />
          </>}
        </div>
      );
    })}</>
  );

  const user = dlg?.id ? s.users.find((u) => u.sam === dlg.id) : undefined;
  const tasks: string[] = q.options?.tasks || [];

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-line bg-surface-2/60 p-3">
        <div className="text-[11px] uppercase tracking-wider text-muted mb-2">Demandes du jour (cochez-les au fur et à mesure, pour vous repérer)</div>
        <ol className="space-y-1.5 text-sm">
          {tasks.map((t, i) => (
            <li key={i} className="flex items-start gap-2">
              <input type="checkbox" className="mt-1" checked={!!done[i]} onChange={(e) => setDone((d) => d.map((x, k) => (k === i ? e.target.checked : x)))} aria-label={`Demande ${i + 1} traitée`} />
              <span className={done[i] ? "text-muted line-through" : ""}>{i + 1}. {t}</span>
            </li>
          ))}
        </ol>
      </div>

      <div ref={host} className="relative select-none border border-[#7a7a7a] bg-[#f0f0f0] text-black overflow-hidden rounded-sm" style={W}
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}>
        <div className="flex items-center justify-between h-8 px-3 bg-white text-[12px] border-b border-[#ddd]">
          <span className="flex items-center gap-2">{view === "dsa" ? I.domain : I.gpo}{view === "dsa" ? "Utilisateurs et ordinateurs Active Directory" : "Gestion de stratégie de groupe"}</span>
          <span className="text-[#666]">— ☐ ✕</span>
        </div>
        <div className="flex gap-4 px-2 h-6 items-center text-[12px] bg-[#f0f0f0] border-b border-[#ddd]">
          {[["dsa", "Utilisateurs et ordinateurs AD"], ["gpmc", "Stratégies de groupe (GPMC)"]].map(([k, l]) => (
            <button key={k} className={`px-2 h-full ${view === k ? "bg-[#cce8ff]" : "hover:bg-[#e5f3ff]"}`} onClick={() => { setView(k as any); setSel(null); }}>{l}</button>
          ))}
          <span className="text-[#888]">Fichier  Action  Affichage  ?</span>
        </div>
        {view === "dsa" && (
          <div className="flex gap-1 px-2 py-1 border-b border-[#ddd] text-[12px]">
            <button className={btn} onClick={() => setDlg({ t: "newUser" })} title="Créer un utilisateur dans le conteneur actuel">{I.user}</button>
            <button className={btn} onClick={() => setDlg({ t: "newGroup" })} title="Créer un groupe dans le conteneur actuel">{I.group}</button>
            <button className={btn} onClick={() => setDlg({ t: "newOu" })} title="Créer une unité d'organisation">{I.ou}</button>
            <button className={btn} disabled={sel?.kind !== "user"} onClick={() => sel?.kind === "user" && setDlg({ t: "props", id: sel.id })}>Propriétés</button>
            <span className="ml-auto self-center text-[#555]">Clic droit sur un objet pour plus d’actions</span>
          </div>
        )}
        <div className="grid grid-cols-[230px_1fr] h-[380px] bg-white">
          <div className="border-r border-[#ccc] overflow-auto text-[12px] py-1 text-[#1a1a1a]">
            <div className="flex items-center gap-1 h-[22px] px-1 font-medium">{I.domain}{s.domain}</div>
            <Tree pid={null} depth={1} />
          </div>
          <div className="overflow-auto text-[12px] text-[#1a1a1a] [&_td]:text-[#1a1a1a] [&_th]:text-[#1a1a1a]">
            {view === "dsa" ? (
              <table className="w-full">
                <thead><tr className="text-left border-b border-[#ddd]">{["Nom", "Type", "Description"].map((h) => <th key={h} className="font-normal px-2 py-1 border-r border-[#eee]">{h}</th>)}</tr></thead>
                <tbody>
                  {items.map((it) => {
                    const u = it.kind === "user" ? s.users.find((x) => x.sam === it.id) : undefined;
                    const on = sel && sel.kind === it.kind && sel.id === it.id;
                    return (
                      <tr key={it.kind + it.id} className={`cursor-default ${on ? "bg-[#cce8ff]" : "hover:bg-[#e5f3ff]"}`}
                        onClick={() => setSel(it.kind === "ou" ? null : { kind: it.kind, id: it.id } as Sel)}
                        onDoubleClick={() => (it.kind === "ou" ? setOu(it.id) : it.kind === "user" ? setDlg({ t: "props", id: it.id }) : setDlg({ t: "props", id: `group:${it.id}` }))}
                        onContextMenu={(e) => { if (it.kind === "user" && u) { setSel({ kind: "user", id: it.id }); ctx(e, userMenu(u)); } else if (it.kind === "group") { setSel({ kind: "group", id: it.id }); ctx(e, [{ label: "Propriétés (membres)", act: () => setDlg({ t: "props", id: `group:${it.id}` }) }]); } else ctx(e, ouMenu(it.id)); }}>
                        <td className="px-2 py-[3px] flex items-center gap-1.5">{it.kind === "ou" ? I.ou : it.kind === "group" ? I.group : u?.enabled === false ? I.userOff : I.user}{it.name}</td>
                        <td className="px-2">{it.type}</td><td className="px-2 text-[#555]">{it.desc}</td>
                      </tr>
                    );
                  })}
                  {!items.length && <tr><td colSpan={3} className="px-2 py-3 text-[#777]">Il n’y a aucun élément à afficher dans cet affichage.</td></tr>}
                </tbody>
              </table>
            ) : (
              <div className="p-3 space-y-2">
                <div className="font-medium">Objets de stratégie de groupe</div>
                <table className="w-full border border-[#ddd]">
                  <thead><tr className="text-left bg-[#f7f7f7]"><th className="font-normal px-2 py-1">Nom</th><th className="font-normal px-2">Liée à</th></tr></thead>
                  <tbody>{s.gpos.map((g) => (
                    <tr key={g.name} className="border-t border-[#eee]"><td className="px-2 py-1 flex items-center gap-1.5">{I.gpo}{g.name}</td>
                      <td className="px-2 text-[#555]">{g.links.map((l) => s.ous.find((o) => o.id === l)?.name).filter(Boolean).join(", ") || "(non liée)"}</td></tr>
                  ))}</tbody>
                </table>
                <p className="text-[#555]">Clic droit sur une unité d’organisation, à gauche, pour y lier une GPO ; clic droit sur un lien pour le supprimer.</p>
              </div>
            )}
          </div>
        </div>
        <div className="h-6 px-2 flex items-center text-[11px] text-[#444] border-t border-[#ccc] bg-[#f0f0f0] truncate">{log[0] || `${items.length} objet(s)`}</div>

        {menu && (
          <div className="absolute z-30 bg-[#f2f2f2] border border-[#ccc] shadow-lg py-1 text-[12px] min-w-[220px]" style={{ left: Math.min(menu.x, 520), top: Math.min(menu.y, 360) }} onClick={(e) => e.stopPropagation()}>
            {menu.items.map((m, i) => (
              <div key={i}>{m.sep && <div className="my-1 border-t border-[#ccc]" />}
                <button className="w-full text-left px-6 py-1 hover:bg-[#91c9f7]/60 disabled:opacity-50" disabled={m.disabled} onClick={() => { setMenu(null); m.act(); }}>{m.label}</button>
              </div>
            ))}
          </div>
        )}

        {dlg?.t === "newUser" && <NewUser ouName={s.ous.find((o) => o.id === ou)?.name || ""} domain={s.domain} taken={s.users.map((u) => u.sam.toLowerCase())}
          onClose={() => setDlg(null)} onCreate={(u) => { commit({ ...s, users: [...s.users, { ...u, ou, groups: [], enabled: true }] }, `${u.sam} créé dans ${s.ous.find((o) => o.id === ou)?.name}`); setDlg(null); }} />}
        {dlg?.t === "newGroup" && <NameDialog title="Nouvel objet - Groupe" label="Nom du groupe :" onClose={() => setDlg(null)}
          onOk={(name) => { if (!s.groups.some((g) => g.name === name)) commit({ ...s, groups: [...s.groups, { name, ou }] }, `Groupe ${name} créé`); setDlg(null); }} />}
        {dlg?.t === "newOu" && <NameDialog title="Nouvel objet - Unité d'organisation" label="Nom :" onClose={() => setDlg(null)}
          onOk={(name) => { commit({ ...s, ous: [...s.ous, { id: `ou-${Date.now()}`, name, parent: ou }] }, `OU ${name} créée`); setDlg(null); }} />}
        {dlg?.t === "move" && user && (
          <Dialog title="Déplacer" onClose={() => setDlg(null)} width={360}>
            <p className="mb-2">Déplacer l’objet dans le conteneur :</p>
            <div className="border border-[#7a7a7a] bg-white max-h-48 overflow-auto">
              {s.ous.map((o) => <button key={o.id} className="flex w-full items-center gap-1 px-2 py-0.5 hover:bg-[#cce8ff] text-left" onClick={() => { upd(user.sam, (x) => ({ ...x, ou: o.id }), `${user.sam} déplacé vers ${o.name}`); setDlg(null); }}>{I.ou}{o.name}</button>)}
            </div>
          </Dialog>
        )}
        {dlg?.t === "reset" && user && (
          <Dialog title="Réinitialiser le mot de passe" onClose={() => setDlg(null)} width={380}>
            <ResetPw onOk={(must) => { upd(user.sam, (x) => ({ ...x, mustChange: must }), `Mot de passe de ${user.sam} réinitialisé`); setDlg(null); }} onClose={() => setDlg(null)} />
          </Dialog>
        )}
        {dlg?.t === "addGroup" && user && (
          <Dialog title="Sélectionnez des groupes" onClose={() => setDlg(null)} width={360}>
            <div className="border border-[#7a7a7a] bg-white max-h-48 overflow-auto">
              {s.groups.filter((g) => !user.groups.includes(g.name)).map((g) => <button key={g.name} className="flex w-full items-center gap-1 px-2 py-0.5 hover:bg-[#cce8ff] text-left" onClick={() => { upd(user.sam, (x) => ({ ...x, groups: [...x.groups, g.name] }), `${user.sam} ajouté à ${g.name}`); setDlg(null); }}>{I.group}{g.name}</button>)}
            </div>
          </Dialog>
        )}
        {dlg?.t === "link" && dlg.id && (
          <Dialog title="Sélectionner un objet GPO" onClose={() => setDlg(null)} width={380}>
            <div className="border border-[#7a7a7a] bg-white max-h-48 overflow-auto">
              {s.gpos.filter((g) => !g.links.includes(dlg.id!)).map((g) => <button key={g.name} className="flex w-full items-center gap-1 px-2 py-0.5 hover:bg-[#cce8ff] text-left" onClick={() => { commit({ ...s, gpos: s.gpos.map((x) => (x.name === g.name ? { ...x, links: [...x.links, dlg.id!] } : x)) }, `GPO « ${g.name} » liée à ${s.ous.find((o) => o.id === dlg.id)?.name}`); setDlg(null); }}>{I.gpo}{g.name}</button>)}
            </div>
          </Dialog>
        )}
        {dlg?.t === "props" && dlg.id?.startsWith("group:") && (() => {
          const gname = dlg.id!.slice(6);
          return (
            <Dialog title={`Propriétés de : ${gname}`} onClose={() => setDlg(null)}>
              <div className="flex gap-1 mb-2"><span className="px-2 py-0.5 bg-white border border-[#adadad] border-b-white">Membres</span></div>
              <div className="border border-[#7a7a7a] bg-white max-h-56 overflow-auto">
                {s.users.filter((u) => u.groups.includes(gname)).map((u) => (
                  <div key={u.sam} className="flex items-center justify-between px-2 py-0.5 hover:bg-[#e5f3ff]"><span className="flex items-center gap-1">{I.user}{u.name} ({u.sam})</span>
                    <button className={btn} onClick={() => upd(u.sam, (x) => ({ ...x, groups: x.groups.filter((g) => g !== gname) }), `${u.sam} retiré de ${gname}`)}>Supprimer</button></div>
                ))}
              </div>
              <div className="flex justify-end mt-3"><button className={btn} onClick={() => setDlg(null)}>OK</button></div>
            </Dialog>
          );
        })()}
        {dlg?.t === "props" && user && <UserProps u={user} s={s} onClose={() => setDlg(null)}
          onSave={(n) => { upd(user.sam, () => n, `Propriétés de ${user.sam} enregistrées`); setDlg(null); }} />}
      </div>
    </div>
  );
}

function NameDialog({ title, label, onOk, onClose }: { title: string; label: string; onOk: (n: string) => void; onClose: () => void }) {
  const [n, setN] = useState("");
  return (
    <Dialog title={title} onClose={onClose} width={380}>
      <label className="block">{label}<input autoFocus className={`${field} mt-1`} value={n} maxLength={64} onChange={(e) => setN(e.target.value)} /></label>
      <div className="flex justify-end gap-2 mt-3"><button className={btn} disabled={!n.trim()} onClick={() => onOk(n.trim())}>OK</button><button className={btn} onClick={onClose}>Annuler</button></div>
    </Dialog>
  );
}

function NewUser({ ouName, domain, taken, onCreate, onClose }: { ouName: string; domain: string; taken: string[]; onCreate: (u: { sam: string; name: string; mustChange: boolean }) => void; onClose: () => void }) {
  const [step, setStep] = useState(1);
  const [p, setP] = useState(""); const [n, setN] = useState(""); const [sam, setSam] = useState("");
  const [pw, setPw] = useState(""); const [pw2, setPw2] = useState(""); const [must, setMust] = useState(true);
  const dup = taken.includes(sam.trim().toLowerCase());
  return (
    <Dialog title="Nouvel objet - Utilisateur" onClose={onClose}>
      <p className="mb-2 flex items-center gap-1">{I.user} Créer dans : {domain}/{ouName}</p>
      {step === 1 ? (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2"><label>Prénom :<input className={field} value={p} onChange={(e) => setP(e.target.value)} /></label><label>Nom :<input className={field} value={n} onChange={(e) => setN(e.target.value)} /></label></div>
          <label className="block">Nom complet :<input className={field} readOnly value={`${p} ${n}`.trim()} /></label>
          <label className="block">Nom d’ouverture de session de l’utilisateur :<div className="flex gap-1 items-center"><input className={field} value={sam} onChange={(e) => setSam(e.target.value)} /><span className="whitespace-nowrap">@{domain}</span></div></label>
          {dup && <p className="text-[#c42b1c]">Ce nom d’ouverture de session existe déjà.</p>}
          <div className="flex justify-end gap-2 pt-2"><button className={btn} disabled={!p.trim() || !n.trim() || !/^[a-zA-Z0-9._-]{2,40}$/.test(sam.trim()) || dup} onClick={() => setStep(2)}>Suivant &gt;</button><button className={btn} onClick={onClose}>Annuler</button></div>
        </div>
      ) : (
        <div className="space-y-2">
          <label className="block">Mot de passe :<input type="password" className={field} value={pw} onChange={(e) => setPw(e.target.value)} /></label>
          <label className="block">Confirmer le mot de passe :<input type="password" className={field} value={pw2} onChange={(e) => setPw2(e.target.value)} /></label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={must} onChange={(e) => setMust(e.target.checked)} />L’utilisateur doit changer le mot de passe à la prochaine ouverture de session</label>
          <label className="flex items-center gap-2 text-[#666]"><input type="checkbox" disabled />Le mot de passe n’expire jamais</label>
          {pw && pw2 && pw !== pw2 && <p className="text-[#c42b1c]">Les mots de passe ne correspondent pas.</p>}
          <div className="flex justify-end gap-2 pt-2"><button className={btn} onClick={() => setStep(1)}>&lt; Précédent</button>
            <button className={btn} disabled={!pw || pw !== pw2} onClick={() => onCreate({ sam: sam.trim(), name: `${p.trim()} ${n.trim()}`, mustChange: must })}>Terminer</button>
            <button className={btn} onClick={onClose}>Annuler</button></div>
        </div>
      )}
    </Dialog>
  );
}

function ResetPw({ onOk, onClose }: { onOk: (must: boolean) => void; onClose: () => void }) {
  const [a, setA] = useState(""); const [b, setB] = useState(""); const [must, setMust] = useState(true);
  return (
    <div className="space-y-2">
      <label className="block">Nouveau mot de passe :<input type="password" className={field} value={a} onChange={(e) => setA(e.target.value)} /></label>
      <label className="block">Confirmer le mot de passe :<input type="password" className={field} value={b} onChange={(e) => setB(e.target.value)} /></label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={must} onChange={(e) => setMust(e.target.checked)} />L’utilisateur doit changer le mot de passe à la prochaine ouverture de session</label>
      <div className="flex justify-end gap-2 pt-1"><button className={btn} disabled={!a || a !== b} onClick={() => onOk(must)}>OK</button><button className={btn} onClick={onClose}>Annuler</button></div>
    </div>
  );
}

function UserProps({ u, s, onSave, onClose }: { u: AdUser; s: AdState; onSave: (u: AdUser) => void; onClose: () => void }) {
  const [tab, setTab] = useState<"gen" | "compte" | "membre">("gen");
  const [d, setD] = useState<AdUser>({ ...u, groups: [...u.groups] });
  const [pick, setPick] = useState(false);
  return (
    <Dialog title={`Propriétés de : ${u.name}`} onClose={onClose} width={460}>
      <div className="flex gap-0.5 border-b border-[#adadad] mb-2">
        {[["gen", "Général"], ["compte", "Compte"], ["membre", "Membre de"]].map(([k, l]) => (
          <button key={k} className={`px-3 py-1 border border-b-0 ${tab === k ? "bg-white border-[#adadad] -mb-px" : "border-transparent hover:bg-[#e5f1fb]"}`} onClick={() => setTab(k as any)}>{l}</button>
        ))}
      </div>
      <div className="bg-white border border-[#ddd] p-3 min-h-[180px]">
        {tab === "gen" && <div className="space-y-2"><div className="flex items-center gap-2">{I.user}<b>{d.name}</b></div><label className="block">Nom complet :<input className={field} value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} /></label><p className="text-[#555]">Emplacement : {s.ous.find((o) => o.id === d.ou)?.name}</p></div>}
        {tab === "compte" && (
          <div className="space-y-2">
            <label className="block">Nom d’ouverture de session :<input className={field} value={d.sam} readOnly /></label>
            <div className="font-medium pt-1">Options de compte :</div>
            <label className="flex items-center gap-2"><input type="checkbox" checked={!!d.mustChange} onChange={(e) => setD({ ...d, mustChange: e.target.checked })} />L’utilisateur doit changer le mot de passe à la prochaine ouverture de session</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={!d.enabled} onChange={(e) => setD({ ...d, enabled: !e.target.checked })} />Le compte est désactivé</label>
          </div>
        )}
        {tab === "membre" && (
          <div>
            <div className="border border-[#7a7a7a] max-h-36 overflow-auto">
              {d.groups.map((g) => <div key={g} className="flex items-center justify-between px-2 py-0.5 hover:bg-[#e5f3ff]"><span className="flex items-center gap-1">{I.group}{g}</span><button className="text-[#0067c0] hover:underline" onClick={() => setD({ ...d, groups: d.groups.filter((x) => x !== g) })}>Supprimer</button></div>)}
              {!d.groups.length && <div className="px-2 py-1 text-[#777]">Aucun groupe.</div>}
            </div>
            <div className="flex gap-2 mt-2"><button className={btn} onClick={() => setPick((x) => !x)}>Ajouter…</button></div>
            {pick && <div className="border border-[#7a7a7a] mt-2 max-h-28 overflow-auto">{s.groups.filter((g) => !d.groups.includes(g.name)).map((g) => <button key={g.name} className="flex w-full items-center gap-1 px-2 py-0.5 hover:bg-[#cce8ff]" onClick={() => { setD({ ...d, groups: [...d.groups, g.name] }); setPick(false); }}>{I.group}{g.name}</button>)}</div>}
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2 mt-3"><button className={btn} onClick={() => onSave(d)}>OK</button><button className={btn} onClick={onClose}>Annuler</button><button className={btn} onClick={() => onSave(d)}>Appliquer</button></div>
    </Dialog>
  );
}
