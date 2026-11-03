"use client";
/* Simulations réalistes (type « sim ») : appli photo, réinitialisation de mot de passe, baie de brassage,
 * pare-feu en interface web, capture réseau. La note est calculée par le serveur sur l'état final. */
import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import AppWindow from "@/components/questions/AppWindow";
import { ART } from "@/components/questions/FeedArt";
import { decide, type FwPacket } from "@/lib/questions/firewall";
import { rulesToProgram, type FwWebRule } from "@/lib/questions/sim";

type P = { q: any; value: any; onChange: (r: any) => void; onText: (r: any) => void };

function Phone({ children, bar }: { children: ReactNode; bar?: ReactNode }) {
  return (
    <div className="mx-auto w-[400px] max-w-full rounded-[2.8rem] bg-[#111] p-[11px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] ring-1 ring-white/10">
      <div className="relative rounded-[2.2rem] overflow-hidden bg-white text-[#111] h-[min(720px,calc(100vh-11rem))] min-h-[520px] flex flex-col">
        <div className="flex items-center justify-between px-7 pt-3 pb-1 text-[13px] font-semibold" aria-hidden>
          <span>09:41</span><span className="absolute left-1/2 -translate-x-1/2 top-2.5 w-28 h-7 rounded-full bg-black" /><span>📶 🔋</span>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain">{children}</div>
        {bar}
      </div>
    </div>
  );
}
const Thumb = ({ art }: { art?: string }) => { const A = art ? ART[art] : null; return A ? <A /> : <div className="aspect-[16/9] bg-[#eee]" />; };
const Toggle = ({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) => (
  <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onClick}
    className={`w-12 h-7 rounded-full transition-colors relative shrink-0 ${on ? "bg-[#0095f6]" : "bg-[#c7c7cc]"}`}>
    <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-all ${on ? "left-[1.4rem]" : "left-0.5"}`} />
  </button>
);

/* ================================================================ Réglages de confidentialité (appli photo) */
function Privacy({ q, value, onChange, onText }: P) {
  const o = q.options;
  const st = value?.state || {};
  const settings = { ...o.settings, bio: o.account.bio, ...(st.settings || {}) };
  const deleted: string[] = st.deleted || [];
  const requests: Record<string, string> = st.requests || {};
  const [tab, setTab] = useState<"profil" | "activite" | "reglages" | "post" | "edit" | "accueil">("profil");
  const [post, setPost] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const save = (patch: any, typed = false) => (typed ? onText : onChange)({ state: { settings, deleted, requests, ...patch } });
  const set = (k: string, v: any, typed = false) => save({ settings: { ...settings, [k]: v } }, typed);
  const posts = o.posts.filter((p: any) => !deleted.includes(p.id));
  const cur = o.posts.find((p: any) => p.id === post);
  const pending = o.requests.filter((r: any) => !requests[r.id]).length;
  const Row = ({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) => (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-[#efefef]"><div className="flex-1 min-w-0"><div className="text-[15px]">{title}</div>{sub && <div className="text-[12.5px] text-[#737373] leading-snug">{sub}</div>}</div>{children}</div>
  );
  const Choice = ({ k, label }: { k: string; label: string }) => (
    <div className="px-4 py-3 border-b border-[#efefef]">
      <div className="text-[15px] mb-2">{label}</div>
      <div className="flex gap-2">{[["tous", "Tout le monde"], ["abonnes", "Mes abonnés"], ["personne", "Personne"]].map(([v, l]) => (
        <button key={v} type="button" onClick={() => set(k, v)} className={`flex-1 rounded-lg border py-1.5 text-[13px] ${settings[k] === v ? "border-[#0095f6] bg-[#e0f1ff] text-[#0064d1] font-semibold" : "border-[#dbdbdb]"}`}>{l}</button>
      ))}</div>
    </div>
  );
  const header = (title: string, back?: () => void) => (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-[#efefef] sticky top-0 bg-white z-10">
      {back && <button type="button" className="text-[22px] leading-none" onClick={back} aria-label="Retour">‹</button>}
      <b className="text-[17px] flex-1">{title}</b>
    </div>
  );

  let screen: ReactNode = null;
  if (tab === "accueil") screen = (<>{header("Pictogram")}<div className="p-6 text-center text-[#737373] text-[14px]">Votre fil d&apos;actualité est à jour. Allez sur votre profil (👤) pour vérifier votre compte.</div></>);
  if (tab === "profil") screen = (
    <>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#efefef]">
        {settings.private && <span aria-label="compte privé">🔒</span>}<b className="text-[18px] flex-1">{o.account.handle}</b>
        <button type="button" className="text-[22px]" aria-label="Menu et réglages" onClick={() => setTab("reglages")}>☰</button>
      </div>
      <div className="px-4 pt-4 flex items-center gap-6">
        <span className="w-20 h-20 rounded-full p-[3px] bg-gradient-to-tr from-[#feda75] via-[#d62976] to-[#4f5bd5] shrink-0"><span className="w-full h-full rounded-full bg-[#fbcfe8] border-2 border-white grid place-items-center text-2xl font-bold text-[#9d174d]">L</span></span>
        <div className="flex-1 grid grid-cols-3 text-center text-[13px]">
          <div><b className="block text-[16px]">{posts.length}</b>publications</div><div><b className="block text-[16px]">{o.account.followers}</b>abonnés</div><div><b className="block text-[16px]">{o.account.following}</b>abonnements</div>
        </div>
      </div>
      <div className="px-4 pt-3 text-[14px]"><b>{o.account.name}</b><p className="whitespace-pre-wrap">{settings.bio}</p></div>
      <div className="px-4 py-3 flex gap-2"><button type="button" className="flex-1 rounded-lg bg-[#efefef] py-1.5 text-[14px] font-semibold" onClick={() => setTab("edit")}>Modifier le profil</button><button type="button" className="flex-1 rounded-lg bg-[#efefef] py-1.5 text-[14px] font-semibold">Partager le profil</button></div>
      <div className="grid grid-cols-3 gap-[2px] border-t border-[#efefef]">
        {posts.map((p: any) => <button key={p.id} type="button" className="aspect-square overflow-hidden grid place-items-center bg-[#eee]" onClick={() => { setPost(p.id); setMenu(false); setTab("post"); }} aria-label={p.caption}><div className="w-[180%]"><Thumb art={p.art} /></div></button>)}
      </div>
    </>
  );
  if (tab === "edit") screen = (
    <>
      {header("Modifier le profil", () => setTab("profil"))}
      <label className="block px-4 py-3 text-[13px] text-[#737373]">Bio<textarea className="mt-1 w-full rounded-lg border border-[#dbdbdb] p-2 text-[15px] text-[#111] min-h-[90px]" maxLength={150} value={settings.bio} onChange={(e) => set("bio", e.target.value, true)} /></label>
      <div className="px-4 text-[12px] text-[#737373]">La bio est visible par tous, même si le compte est privé.</div>
      <div className="px-4 pt-3"><button type="button" className="w-full rounded-lg bg-[#0095f6] text-white py-2 font-semibold" onClick={() => setTab("profil")}>Terminé</button></div>
    </>
  );
  if (tab === "post" && cur) screen = (
    <>
      {header("Publications", () => setTab("profil"))}
      <div className="flex items-center gap-2 px-3 py-2"><span className="w-8 h-8 rounded-full bg-[#fbcfe8] grid place-items-center text-sm font-bold text-[#9d174d]">L</span><b className="text-[14px] flex-1">{o.account.handle}</b>
        <button type="button" className="text-[20px] px-2" aria-label="Options de la publication" onClick={() => setMenu(!menu)}>⋯</button></div>
      {menu && (
        <div className="mx-3 mb-2 rounded-xl border border-[#dbdbdb] overflow-hidden text-[15px] text-center shadow">
          <button type="button" className="w-full py-3 text-[#ed4956] font-semibold border-b border-[#efefef]" onClick={() => { save({ deleted: [...deleted, cur.id] }); setTab("profil"); }}>Supprimer</button>
          <button type="button" className="w-full py-3 border-b border-[#efefef]" onClick={() => setMenu(false)}>Archiver</button>
          <button type="button" className="w-full py-3" onClick={() => setMenu(false)}>Annuler</button>
        </div>
      )}
      <Thumb art={cur.art} />
      <div className="px-3 py-2 text-[22px] flex gap-4" aria-hidden><span>♡</span><span>💬</span><span>➤</span></div>
      <div className="px-3 text-[14px]"><b>{cur.likes} J&apos;aime</b></div>
      <div className="px-3 py-1 text-[14px]"><b>{o.account.handle}</b> {cur.caption}</div>
    </>
  );
  if (tab === "activite") screen = (
    <>
      {header("Demandes d'abonnement")}
      {o.requests.map((r: any) => (
        <div key={r.id} className="flex items-center gap-3 px-4 py-3 border-b border-[#efefef]">
          <span className="w-11 h-11 rounded-full bg-[#e5e7eb] grid place-items-center font-bold text-[#555] shrink-0">{r.name.slice(0, 1)}</span>
          <div className="flex-1 min-w-0"><b className="text-[14px] block truncate">{r.handle}</b><div className="text-[12.5px] text-[#737373] leading-snug">{r.name} · {r.info}</div></div>
          {requests[r.id] ? <span className="text-[12.5px] text-[#737373]">{requests[r.id] === "accept" ? "Abonné(e)" : "Refusée"}</span> : (
            <div className="flex flex-col gap-1">
              <button type="button" className="rounded-lg bg-[#0095f6] text-white text-[13px] font-semibold px-3 py-1" onClick={() => save({ requests: { ...requests, [r.id]: "accept" } })}>Confirmer</button>
              <button type="button" className="rounded-lg bg-[#efefef] text-[13px] font-semibold px-3 py-1" onClick={() => save({ requests: { ...requests, [r.id]: "refuse" } })}>Supprimer</button>
            </div>
          )}
        </div>
      ))}
    </>
  );
  if (tab === "reglages") screen = (
    <>
      {header("Paramètres et confidentialité", () => setTab("profil"))}
      <div className="px-4 pt-3 pb-1 text-[12px] font-semibold text-[#737373] uppercase">Qui peut voir votre contenu</div>
      <Row title="Compte privé" sub="Seuls les abonnés que vous acceptez voient vos photos."><Toggle label="Compte privé" on={!!settings.private} onClick={() => set("private", !settings.private)} /></Row>
      <Row title="Ajouter la position aux publications" sub="Affiche le lieu exact où la photo a été prise."><Toggle label="Position" on={!!settings.location} onClick={() => set("location", !settings.location)} /></Row>
      <Row title="Statut d'activité" sub="Montre quand vous êtes en ligne."><Toggle label="Statut d'activité" on={!!settings.activity} onClick={() => set("activity", !settings.activity)} /></Row>
      <div className="px-4 pt-4 pb-1 text-[12px] font-semibold text-[#737373] uppercase">Comment les autres peuvent interagir</div>
      <Choice k="messages" label="Qui peut vous envoyer des messages privés" />
      <Choice k="tags" label="Qui peut vous identifier sur des photos" />
      <div className="px-4 pt-4 pb-1 text-[12px] font-semibold text-[#737373] uppercase">Sécurité</div>
      <Row title="Authentification à deux facteurs" sub="Un code est demandé en plus du mot de passe sur un nouvel appareil."><Toggle label="Double authentification" on={!!settings.twofa} onClick={() => set("twofa", !settings.twofa)} /></Row>
    </>
  );

  const bar = (
    <div className="flex justify-around py-3 border-t border-[#efefef] text-[22px] bg-white">
      {[["accueil", "⌂", "Accueil"], ["reglages", "⚙", "Réglages"], ["activite", "♡", "Activité"], ["profil", "👤", "Profil"]].map(([k, i, l]) => (
        <button key={k} type="button" aria-label={l} onClick={() => setTab(k as any)} className={`relative ${tab === k ? "" : "opacity-50"}`}>{i}{k === "activite" && pending > 0 && <span className="absolute -top-1 -right-2 bg-[#ff3040] text-white text-[10px] rounded-full w-4 h-4 grid place-items-center">{pending}</span>}</button>
      ))}
    </div>
  );
  return (
    <div className="grid lg:grid-cols-[400px_1fr] gap-6 items-start">
      <Phone bar={bar}>{screen}</Phone>
      <div className="rounded-xl border border-line bg-surface-2/60 p-5 space-y-3 text-sm">
        <div className="text-base font-semibold">Le téléphone de Léa</div>
        <p className="text-muted">L&apos;appli fonctionne comme une vraie : touchez les icônes du bas, le menu ☰ du profil, les photos (puis ⋯) et « Modifier le profil ».</p>
        <ul className="space-y-1.5 text-fg/90">
          <li>👤 <b>Profil</b> : ce que tout le monde voit (bio, photos).</li>
          <li>♡ <b>Activité</b> : les demandes d&apos;abonnement en attente.</li>
          <li>⚙ <b>Réglages</b> : confidentialité et sécurité du compte.</li>
        </ul>
        <p className="text-xs text-faint">Rien n&apos;est corrigé pendant l&apos;épreuve : c&apos;est l&apos;état du compte à la fin qui compte.</p>
      </div>
    </div>
  );
}

/* ================================================================ Question secrète devinable */
function Osint({ q, value, onChange, onText }: P) {
  const o = q.options;
  const st = value?.state || {};
  const answers: Record<string, string> = st.answers || {};
  const [sent, setSent] = useState(false);
  const save = (patch: any, typed = false) => (typed ? onText : onChange)({ state: { answers, choice: st.choice, ...patch } });
  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-[400px_1fr] gap-6 items-start">
        <Phone>
          <div className="flex items-center gap-2 px-4 py-3 border-b border-[#efefef]"><b className="text-[18px] flex-1">{o.profile.handle}</b><span className="text-[13px] text-[#737373]">profil public</span></div>
          <div className="px-4 py-3 flex items-center gap-4">
            <span className="w-16 h-16 rounded-full bg-[#bfdbfe] grid place-items-center text-2xl font-bold text-[#1e3a8a]">M</span>
            <div><b>{o.profile.name}</b><div className="text-[13px] text-[#737373]">{o.profile.followers} abonnés</div></div>
          </div>
          <p className="px-4 pb-3 text-[14px]">{o.profile.bio}</p>
          {o.profile.posts.map((p: any, i: number) => (
            <div key={i} className="border-t border-[#efefef]">
              {p.art && <Thumb art={p.art} />}
              <div className="px-4 py-2 text-[14px]"><b>{o.profile.handle}</b> {p.text}<div className="text-[12px] text-[#737373] mt-0.5">{p.date}</div></div>
            </div>
          ))}
        </Phone>
        <AppWindow title={o.mail.brand} kind="browser" url={`https://${o.mail.brand.toLowerCase()}.example/compte/mot-de-passe-oublie`} bodyClass="bg-[#f6f8fc] text-[#1f1f1f] text-[14px]">
          <div className="p-6 grid place-items-center">
            <form className="w-full max-w-md bg-white rounded-2xl shadow border border-[#e5e7eb] p-6 space-y-4" onSubmit={(e) => { e.preventDefault(); setSent(true); }}>
              <div className="text-xl font-semibold">Mot de passe oublié</div>
              <div className="rounded-lg bg-[#eef2ff] px-3 py-2 text-[13px]">Compte : <b>{o.mail.email}</b></div>
              <p className="text-[13px] text-[#5f6368]">Pour réinitialiser votre mot de passe, répondez à vos questions de sécurité.</p>
              {o.questions.map((x: any) => (
                <label key={x.id} className="block text-[13px] text-[#3c4043]">{x.label}
                  <input className="mt-1 w-full rounded-md border border-[#c4c7c5] px-3 py-2 text-[15px] text-[#1f1f1f] bg-white outline-none focus:border-[#0b57d0]" maxLength={80} autoComplete="off"
                    value={answers[x.id] || ""} onChange={(e) => { setSent(false); save({ answers: { ...answers, [x.id]: e.target.value } }, true); }} />
                </label>
              ))}
              <button className="w-full rounded-full bg-[#0b57d0] text-white py-2.5 font-semibold">Continuer</button>
              {sent && <div className="rounded-lg bg-[#fef7e0] text-[#7a5b00] text-[13px] px-3 py-2">Réponses enregistrées. (Pendant l&apos;épreuve, le site ne dit pas si elles sont justes.)</div>}
            </form>
          </div>
        </AppWindow>
      </div>
      <div className="rounded-xl border border-line bg-surface-2/60 p-5">
        <div className="text-base font-semibold mb-3">Qu&apos;est-ce qui aurait protégé Marc ?</div>
        <div className="grid gap-2" role="radiogroup">
          {o.choices.map((c: any) => (
            <button key={c.id} type="button" role="radio" aria-checked={st.choice === c.id} onClick={() => save({ choice: c.id })}
              className={`text-left rounded-lg border-2 px-4 py-3 ${st.choice === c.id ? "border-accent bg-accent/10" : "border-line hover:border-line-strong"}`}>{c.text}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ================================================================ Baie de brassage */
function Patch({ q, value, onChange }: P) {
  const o = q.options;
  const links: Record<string, number> = value?.state?.links || {};
  const [sel, setSel] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<{ x1: number; y1: number; x2: number; y2: number; c: string }[]>([]);
  const colors = ["#ef4444", "#3b82f6", "#22c55e", "#eab308", "#a855f7", "#f97316", "#06b6d4", "#ec4899"];
  const save = (l: Record<string, number>) => onChange({ state: { links: l } });
  const clickPort = (n: number) => {
    if (sel) { const l = { ...links, [sel]: n }; save(l); setSel(null); return; }
    const owner = Object.keys(links).find((k) => links[k] === n);
    if (owner) { const l = { ...links }; delete l[owner]; save(l); }
  };
  useLayoutEffect(() => {
    const b = box.current; if (!b) return;
    const r0 = b.getBoundingClientRect();
    const out: typeof lines = [];
    o.plugs.forEach((p: any, i: number) => {
      const n = links[p.id]; if (!n) return;
      const a = b.querySelector(`[data-plug="${p.id}"]`)?.getBoundingClientRect(); const z = b.querySelector(`[data-port="${n}"]`)?.getBoundingClientRect();
      if (a && z) out.push({ x1: a.left + a.width / 2 - r0.left, y1: a.bottom - r0.top - 4, x2: z.left + z.width / 2 - r0.left, y2: z.top - r0.top + 6, c: colors[i % colors.length] });
    });
    setLines((prev) => (JSON.stringify(prev) === JSON.stringify(out) ? prev : out));
  }, [JSON.stringify(links), o.plugs]); // eslint-disable-line react-hooks/exhaustive-deps
  const groups = useMemo(() => {
    const g: { vlan: any; ports: number[] }[] = [];
    for (const p of o.ports) { const last = g[g.length - 1]; if (last && last.vlan === p.vlan) last.ports.push(p.n); else g.push({ vlan: p.vlan, ports: [p.n] }); }
    return g;
  }, [o.ports]);
  const vname = (v: any) => (v === "trunk" ? "trunk (liaison montante)" : o.vlans.find((x: any) => x.id === v)?.name || `VLAN ${v}`);
  const ports = o.ports.map((p: any) => p.n);
  return (
    <div className="grid xl:grid-cols-[1fr_20rem] gap-5 items-start">
      <div ref={box} className="relative rounded-xl bg-[#2a2d33] border border-black/40 p-4 space-y-10 select-none overflow-x-auto">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-white/50 mb-2">Panneau de brassage : prises murales de l&apos;étage</div>
          <div className="flex gap-2 flex-wrap">
            {o.plugs.map((p: any, i: number) => (
              <button key={p.id} type="button" data-plug={p.id} onClick={() => setSel(sel === p.id ? null : p.id)}
                className={`w-[6.6rem] rounded-md border p-2 text-left transition ${sel === p.id ? "border-[#facc15] bg-[#facc15]/15 ring-2 ring-[#facc15]" : "border-white/15 bg-[#1c1e22] hover:border-white/40"}`}>
                <div className="flex items-center gap-1.5"><span className="w-4 h-3.5 rounded-sm border border-white/40 bg-black" style={links[p.id] ? { background: colors[i % colors.length] } : {}} /><b className="text-[12px] text-white font-mono">{p.label}</b></div>
                <div className="text-[10.5px] text-white/60 leading-tight mt-1">{p.device}</div>
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wider text-white/50 mb-2">Switch SW-ETAGE1 · 24 ports</div>
          <div className="inline-block rounded-md bg-[#15171a] border border-white/10 px-3 py-2">
            {[0, 1].map((row) => (
              <div key={row} className="flex gap-1 my-1">
                {ports.filter((n: number) => (row === 0 ? n % 2 === 1 : n % 2 === 0)).map((n: number) => {
                  const owner = Object.keys(links).find((k) => links[k] === n);
                  const idx = owner ? o.plugs.findIndex((p: any) => p.id === owner) : -1;
                  return (
                    <button key={n} type="button" data-port={n} onClick={() => clickPort(n)} title={owner ? `Port ${n} : ${owner} (cliquez pour débrancher)` : `Port ${n}`}
                      className={`w-8 h-8 rounded-[3px] border text-[9px] font-mono flex flex-col items-center justify-end pb-0.5 ${sel ? "hover:border-[#facc15]" : ""} ${owner ? "border-white/50" : "border-white/20"} bg-black`}>
                      <span className="w-2.5 h-1 rounded-full mb-auto mt-0.5" style={{ background: owner ? "#22c55e" : "#3f3f46" }} />
                      {owner && <span className="w-5 h-2.5 rounded-sm mb-0.5" style={{ background: colors[idx % colors.length] }} />}
                      <span className="text-white/60">{n}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-white/50">{sel ? `Prise ${sel} sélectionnée : cliquez sur un port du switch.` : "Cliquez sur une prise, puis sur un port. Cliquez sur un port occupé pour le débrancher."}</p>
        </div>
        <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden>
          {lines.map((l, i) => <path key={i} d={`M${l.x1} ${l.y1} C ${l.x1} ${l.y1 + 80}, ${l.x2} ${l.y2 - 80}, ${l.x2} ${l.y2}`} stroke={l.c} strokeWidth="3.5" fill="none" opacity=".9" />)}
        </svg>
      </div>
      <div className="space-y-3">
        <AppWindow title="Terminal : SW-ETAGE1" dark bodyClass="bg-[#0c0c0c] text-[#d4d4d4] text-[12px] font-mono p-3">
          <div className="text-[#89d185]">SW-ETAGE1# show vlan brief</div>
          <pre className="whitespace-pre-wrap mt-1 leading-5">{groups.map((g) => `${g.ports.length > 1 ? `Gi0/${g.ports[0]}-${g.ports[g.ports.length - 1]}` : `Gi0/${g.ports[0]}`}`.padEnd(12) + vname(g.vlan)).join("\n")}</pre>
        </AppWindow>
        <div className="rounded-lg border border-line p-3 text-xs space-y-1">
          {o.vlans.map((v: any) => <div key={v.id} className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm" style={{ background: v.color }} />{v.name}</div>)}
        </div>
      </div>
    </div>
  );
}

/* ================================================================ Pare-feu en interface web */
function FwWeb({ q, value, onChange }: P) {
  const o = q.options;
  const rules: FwWebRule[] = value?.state?.rules || o.rules || [];
  const [applied, setApplied] = useState<string>(JSON.stringify(rules));
  const [edit, setEdit] = useState<number | null>(null);
  const [draft, setDraft] = useState<FwWebRule>({ action: "pass", proto: "tcp", src: "any", port: "", descr: "" });
  const save = (r: FwWebRule[]) => onChange({ state: { rules: r } });
  const dirty = JSON.stringify(rules) !== applied;
  const prog = useMemo(() => rulesToProgram(JSON.parse(applied)), [applied]);
  const samples: FwPacket[] = o.samples || [];
  const startEdit = (i: number | null) => { setEdit(i); setDraft(i === null ? { action: "pass", proto: "tcp", src: "any", port: "", descr: "" } : { ...rules[i] }); };
  const commit = () => { const r = rules.slice(); if (edit === -1) r.push(draft); else if (edit !== null) r[edit] = draft; save(r); setEdit(null); };
  const inp = "rounded border border-[#ced4da] bg-white px-2 py-1 text-[13px] text-[#212529]";
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-line bg-surface-2/60 p-4 text-sm">
        <div className="font-semibold mb-1">Demande (ticket #2071)</div>
        <ul className="list-disc pl-5 space-y-0.5 text-fg/90">{o.ticket.map((t: string) => <li key={t}>{t}</li>)}</ul>
      </div>
      <AppWindow title="Pare-feu" kind="browser" url="https://fw-ecole.local/firewall_rules.php?if=dmz" bodyClass="bg-[#f5f5f5] text-[#212529] text-[13px]">
        <div className="bg-[#212121] text-white/90 px-4 py-2 flex gap-5 text-[13px]"><b className="text-white">🛡 fw-ecole</b>{["Système", "Interfaces", "Pare-feu", "Services", "VPN", "État", "Diagnostics"].map((m) => <span key={m} className={m === "Pare-feu" ? "text-white" : "text-white/60"}>{m} ▾</span>)}</div>
        <div className="p-4 space-y-3">
          <div className="text-[18px]">Pare-feu / Règles / <b>DMZ</b></div>
          {dirty && (
            <div className="rounded border border-[#f0ad4e] bg-[#fcf8e3] px-3 py-2 flex items-center gap-3 text-[#8a6d3b]">La configuration des règles a été modifiée. Vous devez appliquer les modifications pour qu&apos;elles prennent effet.
              <button type="button" className="ml-auto rounded bg-[#5cb85c] text-white px-3 py-1 font-semibold" onClick={() => setApplied(JSON.stringify(rules))}>✔ Appliquer les modifications</button></div>
          )}
          <div className="flex gap-1 text-[13px]">{["WAN", "LAN", "DMZ", "ADMIN"].map((t) => <span key={t} className={`px-3 py-1.5 rounded-t border border-b-0 ${t === "DMZ" ? "bg-white border-[#ddd] font-semibold" : "border-transparent text-[#337ab7]"}`}>{t}</span>)}</div>
          <div className="bg-white border border-[#ddd] rounded-b rounded-tr overflow-auto">
            <table className="w-full [&_td]:text-[#212529]">
              <thead className="bg-[#424242] text-white text-[12px]"><tr>{["", "Action", "Protocole", "Source", "Destination", "Port", "Description", ""].map((h, i) => <th key={i} className="text-left px-2 py-1.5 font-semibold">{h}</th>)}</tr></thead>
              <tbody>
                {rules.map((r, i) => (
                  <tr key={i} className="border-b border-[#eee]">
                    <td className="px-2 text-[#999]">{i + 1}</td>
                    <td className="px-2 py-1.5 font-bold">{r.action === "pass" ? <span className="text-[#5cb85c]">✔ Autoriser</span> : <span className="text-[#d9534f]">✖ Bloquer</span>}</td>
                    <td className="px-2 uppercase">{r.proto === "any" ? "*" : r.proto}</td><td className="px-2 font-mono">{r.src === "any" ? "*" : r.src}</td>
                    <td className="px-2 font-mono">10.0.1.10</td><td className="px-2 font-mono">{!r.port || r.port === "any" ? "*" : r.port}</td><td className="px-2 text-[#555]">{r.descr}</td>
                    <td className="px-2 whitespace-nowrap text-[#337ab7]">
                      <button type="button" aria-label="Monter" disabled={i === 0} className="px-1 disabled:opacity-30" onClick={() => { const x = rules.slice(); [x[i - 1], x[i]] = [x[i], x[i - 1]]; save(x); }}>▲</button>
                      <button type="button" aria-label="Descendre" disabled={i === rules.length - 1} className="px-1 disabled:opacity-30" onClick={() => { const x = rules.slice(); [x[i + 1], x[i]] = [x[i], x[i + 1]]; save(x); }}>▼</button>
                      <button type="button" aria-label="Modifier" className="px-1" onClick={() => startEdit(i)}>✎</button>
                      <button type="button" aria-label="Supprimer" className="px-1 text-[#d9534f]" onClick={() => save(rules.filter((_, k) => k !== i))}>🗑</button>
                    </td>
                  </tr>
                ))}
                <tr className="bg-[#fafafa] text-[#888] italic"><td className="px-2">∞</td><td className="px-2 py-1.5">✖ Bloquer</td><td className="px-2">*</td><td className="px-2">*</td><td className="px-2">*</td><td className="px-2">*</td><td className="px-2">Règle implicite : tout ce qui n&apos;est pas autorisé est bloqué</td><td /></tr>
              </tbody>
            </table>
          </div>
          {edit === null ? <button type="button" className="rounded bg-[#5cb85c] text-white px-3 py-1.5 font-semibold" onClick={() => startEdit(-1)}>＋ Ajouter une règle</button> : (
            <div className="bg-white border border-[#ddd] rounded p-3 grid sm:grid-cols-[auto_1fr] gap-x-3 gap-y-2 items-center max-w-2xl">
              <b className="sm:col-span-2 text-[14px]">{edit === -1 ? "Nouvelle règle" : `Modifier la règle ${edit + 1}`}</b>
              <span>Action</span><select className={inp} value={draft.action} onChange={(e) => setDraft({ ...draft, action: e.target.value as any })}><option value="pass">Autoriser (Pass)</option><option value="block">Bloquer (Block)</option></select>
              <span>Protocole</span><select className={inp} value={draft.proto} onChange={(e) => setDraft({ ...draft, proto: e.target.value as any })}><option value="tcp">TCP</option><option value="udp">UDP</option><option value="any">Tous</option></select>
              <span>Source</span><input className={`${inp} font-mono`} value={draft.src} placeholder="any, une IP ou un réseau (10.0.99.0/24)" onChange={(e) => setDraft({ ...draft, src: e.target.value })} />
              <span>Port de destination</span><input className={`${inp} font-mono`} value={draft.port} placeholder="any, 22, ou 80,443" onChange={(e) => setDraft({ ...draft, port: e.target.value })} />
              <span>Description</span><input className={inp} value={draft.descr} onChange={(e) => setDraft({ ...draft, descr: e.target.value })} />
              <div className="sm:col-span-2 flex gap-2 pt-1"><button type="button" className="rounded bg-[#337ab7] text-white px-3 py-1.5 font-semibold" onClick={commit}>💾 Enregistrer</button><button type="button" className="rounded border border-[#ccc] px-3 py-1.5" onClick={() => setEdit(null)}>Annuler</button></div>
            </div>
          )}
          {!!samples.length && (
            <div>
              <div className="text-[14px] font-semibold mt-2 mb-1">État / Journaux système / Pare-feu (règles appliquées)</div>
              <table className="w-full bg-white border border-[#ddd] text-[12px] font-mono [&_td]:text-[#212529]">
                <thead className="bg-[#eee]"><tr>{["Action", "Source", "Port", "Proto", ""].map((h) => <th key={h} className="text-left px-2 py-1">{h}</th>)}</tr></thead>
                <tbody>{samples.map((p) => { const d = decide(prog, p); return (
                  <tr key={p.id} className="border-t border-[#eee]"><td className="px-2 py-1">{d === "allow" ? <span className="text-[#5cb85c]">✔ pass</span> : <span className="text-[#d9534f]">✖ block</span>}</td><td className="px-2">{p.src_ip}</td><td className="px-2">{p.dst_port}</td><td className="px-2">{p.protocol}</td><td className="px-2 font-sans text-[#777]">{p.label}</td></tr>
                ); })}</tbody>
              </table>
            </div>
          )}
        </div>
      </AppWindow>
    </div>
  );
}

/* ================================================================ Capture réseau */
const PROTO_BG: Record<string, string> = { ARP: "#faf0d7", DNS: "#daeeff", TCP: "#e7e6ff", FTP: "#e7e6ff", HTTP: "#e4ffc7", "TLSv1.3": "#e7e6ff" };
function filterPkt(f: string, p: any): boolean | null {
  const t = f.trim().toLowerCase();
  if (!t) return true;
  const ip = t.match(/^ip\.(addr|src|dst)\s*==\s*([\d.]+)$/);
  if (ip) return ip[1] === "addr" ? p.src === ip[2] || p.dst === ip[2] : (ip[1] === "src" ? p.src : p.dst) === ip[2];
  const c = t.match(/^frame contains\s+"(.+)"$/);
  if (c) return `${p.info} ${(p.details || []).join(" ")}`.toLowerCase().includes(c[1]);
  const protos: Record<string, string[]> = { arp: ["ARP"], dns: ["DNS"], ftp: ["FTP"], http: ["HTTP"], tls: ["TLSv1.3"], tcp: ["TCP", "FTP", "HTTP", "TLSv1.3"], udp: ["DNS"], ip: ["DNS", "TCP", "FTP", "HTTP", "TLSv1.3"] };
  if (protos[t]) return protos[t].includes(p.proto);
  return null;
}
function Pcap({ q, value, onChange, onText }: P) {
  const o = q.options;
  const st = value?.state || {};
  const answers: Record<string, string> = st.answers || {};
  const [filter, setFilter] = useState(""); const [applied, setApplied] = useState("");
  const [sel, setSel] = useState<number>(1);
  const [follow, setFollow] = useState<number | null>(null);
  const save = (patch: any, typed = false) => (typed ? onText : onChange)({ state: { answers, choice: st.choice, ...patch } });
  const valid = filterPkt(filter, o.packets[0]) !== null;
  const shown = o.packets.filter((p: any) => filterPkt(applied, p) !== false);
  const cur = o.packets.find((p: any) => p.no === sel) || o.packets[0];
  const hex = useMemo(() => { const b = Array.from(new TextEncoder().encode(cur.info)).slice(0, 64); const rows: string[] = []; for (let i = 0; i < b.length; i += 16) rows.push(`${i.toString(16).padStart(4, "0")}  ${b.slice(i, i + 16).map((x) => x.toString(16).padStart(2, "0")).join(" ").padEnd(48)}  ${b.slice(i, i + 16).map((x) => (x >= 32 && x < 127 ? String.fromCharCode(x) : ".")).join("")}`); return rows.join("\n"); }, [cur]);
  const stream = follow !== null ? o.packets.filter((p: any) => p.stream === follow && p.proto === "FTP") : [];
  const client = o.packets.find((p: any) => p.stream === follow)?.src;
  return (
    <div className="space-y-5">
      <AppWindow title={`${o.file} : analyseur de paquets`} bodyClass="bg-white text-[#1d1d1d] text-[12px]">
        <div className="flex gap-4 px-3 py-1 bg-[#f0f0f0] border-b border-[#ccc] text-[12px]">{["Fichier", "Éditer", "Vue", "Aller", "Capture", "Analyser", "Statistiques"].map((m) => <span key={m}>{m}</span>)}</div>
        <form className="flex items-center gap-2 px-2 py-1.5 border-b border-[#ccc]" onSubmit={(e) => { e.preventDefault(); if (valid) setApplied(filter); }}>
          <span className="text-[#777]" aria-hidden>🔖</span>
          <input aria-label="Filtre d'affichage" className={`flex-1 font-mono px-2 py-1 border outline-none ${!filter ? "bg-white border-[#bbb]" : valid ? "bg-[#afffaf] border-[#7c7]" : "bg-[#ffafaf] border-[#c77]"}`} placeholder="Appliquer un filtre d'affichage… (ex. ftp, dns, ip.addr == 10.0.10.23, frame contains &quot;PASS&quot;)" value={filter} onChange={(e) => setFilter(e.target.value)} />
          <button className="px-2 py-1 border border-[#bbb] bg-[#f6f6f6]">Appliquer</button>
          {applied && <button type="button" className="px-2 py-1 border border-[#bbb] bg-[#f6f6f6]" onClick={() => { setFilter(""); setApplied(""); }}>✕</button>}
        </form>
        <div className="max-h-64 overflow-auto border-b border-[#ccc]">
          <table className="w-full font-mono text-[11.5px] text-[#1d1d1d]">
            <thead className="sticky top-0 bg-[#f3f3f3] text-left"><tr>{["N°", "Temps", "Source", "Destination", "Protocole", "Long.", "Info"].map((h) => <th key={h} className="px-2 py-0.5 font-normal border-r border-[#ddd]">{h}</th>)}</tr></thead>
            <tbody>{shown.map((p: any) => (
              <tr key={p.no} onClick={() => setSel(p.no)} className="cursor-default" style={{ background: p.no === sel ? "#3874d8" : PROTO_BG[p.proto] || "#fff", color: p.no === sel ? "#fff" : "#1d1d1d" }}>
                <td className="px-2">{p.no}</td><td className="px-2">{p.t}</td><td className="px-2">{p.src}</td><td className="px-2">{p.dst}</td><td className="px-2">{p.proto}</td><td className="px-2">{p.len}</td><td className="px-2 whitespace-nowrap">{p.info}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <div className="grid md:grid-cols-2 border-b border-[#ccc]">
          <div className="p-2 font-mono text-[11.5px] leading-5 border-r border-[#ccc] min-h-[8rem] text-[#1d1d1d]">
            <div>▸ Frame {cur.no}: {cur.len} octets sur le réseau</div>
            <div>▸ Ethernet II</div>
            {cur.proto !== "ARP" && <div>▸ Internet Protocol Version 4, Src: {cur.src}, Dst: {cur.dst}</div>}
            {(cur.details || []).map((d: string, i: number) => <div key={i} className="whitespace-pre">{d.startsWith(" ") ? d : `▾ ${d}`}</div>)}
            {cur.stream !== undefined && <button type="button" className="mt-2 px-2 py-0.5 border border-[#bbb] bg-[#f6f6f6] font-sans" onClick={() => setFollow(cur.stream)}>Suivre le flux TCP</button>}
          </div>
          <pre className="p-2 font-mono text-[11.5px] leading-5 text-[#333] overflow-auto">{hex}</pre>
        </div>
        <div className="px-2 py-0.5 bg-[#f0f0f0] text-[11px] text-[#555] flex gap-4"><span>Paquets : {o.packets.length}</span><span>Affichés : {shown.length}</span>{applied && <span>Filtre : {applied}</span>}</div>
      </AppWindow>
      {follow !== null && (
        <AppWindow title={`Suivre le flux TCP (tcp.stream eq ${follow})`} bodyClass="bg-white text-[12px]">
          <pre className="p-3 font-mono leading-5 whitespace-pre-wrap max-h-64 overflow-auto">{stream.map((p: any, i: number) => <div key={i} style={{ color: p.src === client ? "#a40000" : "#0000a4", background: p.src === client ? "#fbeded" : "#ededfb" }}>{p.info.replace(/^(Request|Response): /, "")}</div>)}</pre>
          <div className="px-3 py-1.5 border-t text-[11px] text-[#555] flex"><span>En rouge : le client · en bleu : le serveur</span><button type="button" className="ml-auto px-2 border border-[#bbb]" onClick={() => setFollow(null)}>Fermer</button></div>
        </AppWindow>
      )}
      <div className="rounded-xl border border-line bg-surface-2/60 p-5 space-y-4">
        <div className="text-base font-semibold">Votre analyse</div>
        <div className="grid sm:grid-cols-2 gap-3">
          {o.questions.map((x: any) => (
            <label key={x.id} className="block text-sm">{x.label}
              <input className="input mt-1 font-mono" maxLength={80} autoComplete="off" spellCheck={false} placeholder={x.placeholder} value={answers[x.id] || ""} onChange={(e) => save({ answers: { ...answers, [x.id]: e.target.value } }, true)} />
            </label>
          ))}
        </div>
        <div className="text-sm font-medium">Que recommandez-vous ?</div>
        <div className="grid gap-2" role="radiogroup">
          {o.choices.map((c: any) => (
            <button key={c.id} type="button" role="radio" aria-checked={st.choice === c.id} onClick={() => save({ choice: c.id })}
              className={`text-left rounded-lg border-2 px-4 py-2.5 text-sm ${st.choice === c.id ? "border-accent bg-accent/10" : "border-line hover:border-line-strong"}`}>{c.text}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function SimQuestion(props: P) {
  switch (props.q?.options?.kind) {
    case "privacy": return <Privacy {...props} />;
    case "osint": return <Osint {...props} />;
    case "patch": return <Patch {...props} />;
    case "fwweb": return <FwWeb {...props} />;
    case "pcap": return <Pcap {...props} />;
  }
  return <p className="text-sm text-danger">Simulation inconnue.</p>;
}
