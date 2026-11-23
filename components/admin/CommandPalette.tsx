"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { splitName } from "@/lib/admin/roster";

type Hit = { group: string; label: string; sub?: string; href: string; text: string };
const norm = (s: string) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const PAGES: Hit[] = [
  ["Examens", "/admin", "g e"], ["Classes", "/admin/classes", "g c"], ["Banque de questions", "/admin/banque", "g b"],
  ["Calendrier", "/admin/calendrier", "g k"], ["Pilotage", "/admin/pilotage", "g p"], ["Nouvelle épreuve", "/admin/new", "n"],
].map(([label, href, k]) => ({ group: "Aller à", label, sub: k, href, text: norm(label) }));
const GO: Record<string, string> = { e: "/admin", c: "/admin/classes", b: "/admin/banque", k: "/admin/calendrier", p: "/admin/pilotage" };
const SHORTCUTS: [string, string][] = [["Cmd K ou Ctrl K", "Recherche globale"], ["/", "Recherche globale"], ["g puis e", "Examens"], ["g puis c", "Classes"], ["g puis b", "Banque de questions"],
  ["g puis k", "Calendrier"], ["g puis p", "Pilotage"], ["n", "Nouvelle épreuve"], ["d", "Mode clair ou sombre"], ["?", "Afficher cette aide"], ["Échap", "Fermer"]];

/** Recherche globale (Cmd+K) : étudiants, examens, questions ; et raccourcis clavier de l'espace équipe. */
export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [help, setHelp] = useState(false);
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const [data, setData] = useState<Hit[] | null>(null);
  const pending = useRef(false);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || data) return;
    const s = createClient();
    Promise.all([
      s.from("tests").select("id, title, formation").order("created_at", { ascending: false }).limit(500),
      s.from("attempts").select("id, test_id, candidate:profiles(first_name, last_name, full_name, email)").neq("status", "pending").order("started_at", { ascending: false }).limit(3000),
      s.from("questions").select("id, test_id, prompt, domain").limit(5000),
      s.from("question_bank").select("id, prompt, domain").limit(3000),
    ]).then(([t, a, qs, b]) => {
      const title = new Map((t.data || []).map((x: any) => [x.id, x.title]));
      setData([
        ...(t.data || []).map((x: any) => ({ group: "Examens", label: x.title, sub: x.formation || "Toutes les promos", href: `/admin/tests/${x.id}`, text: norm(`${x.title} ${x.formation || ""}`) })),
        ...(a.data || []).map((x: any) => { const n = splitName(x.candidate || {}); const name = `${n.first} ${n.last}`.trim() || x.candidate?.email || "Étudiant";
          return { group: "Étudiants", label: name, sub: `${title.get(x.test_id) || "Examen"} · ${x.candidate?.email || ""}`, href: `/admin/attempts/${x.id}`, text: norm(`${name} ${x.candidate?.email || ""}`) }; }),
        ...(qs.data || []).map((x: any) => ({ group: "Questions", label: String(x.prompt).replace(/\s+/g, " ").slice(0, 110), sub: `${title.get(x.test_id) || "Examen"}${x.domain ? ` · ${x.domain}` : ""}`,
          href: `/admin/banque?q=${encodeURIComponent(String(x.prompt).replace(/\s+/g, " ").slice(0, 50))}`, text: norm(x.prompt) })),
        ...(b.data || []).map((x: any) => ({ group: "Questions", label: String(x.prompt).replace(/\s+/g, " ").slice(0, 110), sub: `Banque libre${x.domain ? ` · ${x.domain}` : ""}`,
          href: `/admin/banque?q=${encodeURIComponent(String(x.prompt).replace(/\s+/g, " ").slice(0, 50))}`, text: norm(x.prompt) })),
      ]);
    });
  }, [open, data]);

  const hits = useMemo(() => {
    const words = norm(q).split(/\s+/).filter(Boolean);
    const match = (h: Hit) => words.every((w) => h.text.includes(w));
    if (!words.length) return PAGES;
    const out: Hit[] = PAGES.filter(match);
    for (const g of ["Examens", "Étudiants", "Questions"]) out.push(...(data || []).filter((h) => h.group === g && match(h)).slice(0, 8));
    return out;
  }, [q, data]);
  useEffect(() => { setIdx(0); }, [q]);
  useEffect(() => { list.current?.querySelector(`[data-i="${idx}"]`)?.scrollIntoView({ block: "nearest" }); }, [idx]);

  const go = (href: string) => { setOpen(false); setQ(""); router.push(href); };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setHelp(false); setOpen((o) => !o); return; }
      if (e.key === "Escape") { setOpen(false); setHelp(false); return; }
      const el = e.target as HTMLElement | null;
      if (open || e.metaKey || e.ctrlKey || e.altKey || (el && (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable))) return;
      if (document.querySelector('[role="dialog"]')) return;
      if (pending.current) { pending.current = false; const to = GO[e.key.toLowerCase()]; if (to) { e.preventDefault(); router.push(to); } return; }
      if (e.key === "g") { pending.current = true; setTimeout(() => { pending.current = false; }, 1200); }
      else if (e.key === "/") { e.preventDefault(); setOpen(true); }
      else if (e.key === "?") setHelp((h) => !h);
      else if (e.key === "n") router.push("/admin/new");
      else if (e.key === "d") window.dispatchEvent(new Event("cx-theme-toggle"));
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey); window.addEventListener("cx-palette", onOpen);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("cx-palette", onOpen); };
  }, [open, router]);

  if (help) return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-navy/50 p-4 backdrop-blur-[2px]" role="dialog" aria-modal aria-label="Raccourcis clavier" onClick={() => setHelp(false)}>
      <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-lg uppercase text-navy">Raccourcis clavier</h2>
        <dl className="mt-4 space-y-2 text-sm">
          {SHORTCUTS.map(([k, l]) => <div key={k + l} className="flex items-center justify-between gap-4"><dt className="text-fg/85">{l}</dt><dd><kbd className="rounded-md border border-line-strong bg-surface-2 px-2 py-0.5 font-mono text-xs">{k}</kbd></dd></div>)}
        </dl>
      </div>
    </div>
  );
  if (!open) return null;
  let last = "";
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-navy/50 px-4 pt-[12vh] backdrop-blur-[2px]" role="dialog" aria-modal aria-label="Recherche globale" onClick={() => setOpen(false)}>
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-line px-5">
          <svg aria-hidden viewBox="0 0 20 20" className="h-5 w-5 text-muted"><path fill="currentColor" d="M8.5 3a5.5 5.5 0 0 1 4.38 8.83l3.65 3.64-1.06 1.06-3.64-3.65A5.5 5.5 0 1 1 8.5 3Zm0 1.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" /></svg>
          <input autoFocus className="w-full bg-transparent py-4 text-base text-fg outline-none placeholder:text-faint" placeholder="Chercher un étudiant, un examen, une question…" value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(hits.length - 1, i + 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
              else if (e.key === "Enter" && hits[idx]) go(hits[idx].href);
            }} />
          <kbd className="rounded-md border border-line-strong px-1.5 py-0.5 font-mono text-[11px] text-muted">Échap</kbd>
        </div>
        <div ref={list} className="max-h-[52vh] overflow-y-auto p-2">
          {hits.map((h, i) => {
            const head = h.group !== last; last = h.group;
            return (
              <div key={`${h.group}-${h.href}-${i}`}>
                {head && <div className="px-3 pb-1 pt-3 text-[11px] font-bold uppercase tracking-[0.12em] text-fg/55">{h.group}</div>}
                <button data-i={i} onMouseEnter={() => setIdx(i)} onClick={() => go(h.href)}
                  className={`flex w-full items-center justify-between gap-4 rounded-xl px-3 py-2 text-left ${i === idx ? "bg-navy text-white" : "text-fg"}`}>
                  <span className="min-w-0 truncate text-sm font-medium">{h.label}</span>
                  {h.sub && <span className={`max-w-[45%] shrink-0 truncate text-xs ${i === idx ? "text-white/75" : "text-muted"}`}>{h.sub}</span>}
                </button>
              </div>
            );
          })}
          {!hits.length && <p className="px-3 py-8 text-center text-sm text-muted">{data ? "Aucun résultat." : "Chargement…"}</p>}
        </div>
        <div className="flex gap-4 border-t border-line px-5 py-2.5 text-xs text-muted"><span>↑ ↓ pour choisir</span><span>Entrée pour ouvrir</span><span className="ml-auto">? pour tous les raccourcis</span></div>
      </div>
    </div>
  );
}
