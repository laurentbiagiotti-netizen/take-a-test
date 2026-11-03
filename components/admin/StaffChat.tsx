"use client";
import { useCallback, useEffect, useRef, useState } from "react";

type Msg = { id: number; sender: "candidate" | "staff"; body: string; created_at: string };

/** Fil de messages avec un candidat, ouvert depuis la surveillance en direct. */
export function StaffChat({ attemptId, name, onClose }: { attemptId: string; name: string; onClose: () => void }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/staff/attempts/${attemptId}/messages`, { credentials: "same-origin" });
    const j = await r.json().catch(() => ({}));
    if (r.ok) setMessages(j.messages || []);
  }, [attemptId]);

  useEffect(() => {
    load();
    const i = setInterval(load, 5000);
    return () => clearInterval(i);
  }, [load]);
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight }); }, [messages.length]);

  const send = async () => {
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true); setError(null);
    const r = await fetch(`/api/staff/attempts/${attemptId}/messages`, {
      method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setError(j.error === "attempt_not_running" ? "L'épreuve de ce candidat est terminée." : "Message non envoyé."); return; }
    setDraft(""); load();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <aside className="w-full max-w-md h-full bg-surface border-l border-line flex flex-col" role="dialog" aria-label={`Messages avec ${name}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <div>
            <div className="text-xs text-muted">Messages avec</div>
            <b>{name}</b>
          </div>
          <button className="btn-secondary !py-1" onClick={onClose}>Fermer</button>
        </div>
        <div ref={listRef} className="flex-1 overflow-auto px-5 py-4 space-y-2 text-sm">
          {messages.length === 0 && <p className="text-muted">Aucun message. Le candidat verra le vôtre en bas de son écran dans les 10 secondes.</p>}
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.sender === "staff" ? "justify-end" : ""}`}>
              <div className={`px-3 py-2 rounded-lg max-w-[85%] whitespace-pre-wrap break-words ${m.sender === "staff" ? "bg-accent/15" : "bg-surface-2 border border-line"}`}>
                {m.body}
                <div className="text-[10px] text-faint mt-1">{m.sender === "candidate" ? "Candidat · " : "Vous · "}{new Date(m.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-line p-4">
          <label htmlFor="staff-draft" className="sr-only">Réponse</label>
          <textarea id="staff-draft" className="input min-h-[4rem]" maxLength={1000} value={draft} onChange={(e) => setDraft(e.target.value)}
            placeholder="Votre réponse…" onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
          {error && <p className="text-danger text-xs mt-1" role="alert">{error}</p>}
          <div className="flex justify-end mt-2"><button className="btn" onClick={send} disabled={busy || !draft.trim()}>{busy ? "Envoi…" : "Envoyer"}</button></div>
        </div>
      </aside>
    </div>
  );
}
