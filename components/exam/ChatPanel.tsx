"use client";
import { useEffect, useRef, useState } from "react";

export type ChatMessage = { id: number; sender: "candidate" | "staff"; body: string; created_at: string };

/**
 * Messagerie avec le surveillant pendant l'épreuve. Les messages arrivent avec le
 * battement de cœur (toutes les 10 secondes) ; l'envoi passe par la session d'examen.
 */
export function ChatPanel({ messages, send }: { messages: ChatMessage[]; send: (body: string) => Promise<string | null> }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seen, setSeen] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const staff = messages.filter((m) => m.sender === "staff");
  const lastStaff = staff.length ? staff[staff.length - 1].id : 0;
  const unread = staff.filter((m) => m.id > seen).length;

  useEffect(() => { if (open) setSeen(lastStaff); }, [open, lastStaff]);
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight }); }, [open, messages.length]);

  const submit = async () => {
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true); setError(null);
    const err = await send(body);
    setBusy(false);
    if (err) setError(err); else setDraft("");
  };

  return (
    <div className="fixed bottom-4 left-4 z-[55] select-text">
      {!open && unread > 0 && (
        <div className="mb-2 max-w-xs card !p-3 border-accent text-sm" role="status" aria-live="polite">
          <b className="text-accent">Message du surveillant</b>
          <p className="mt-1 line-clamp-3">{staff[staff.length - 1].body}</p>
        </div>
      )}
      {open ? (
        <div className="card !p-0 w-[min(22rem,calc(100vw-2rem))] shadow-2xl" role="dialog" aria-label="Messages avec le surveillant">
          <div className="flex items-center justify-between px-4 py-3 border-b border-line">
            <b className="text-sm">Surveillant</b>
            <button className="text-muted text-sm hover:text-fg" onClick={() => setOpen(false)} aria-label="Fermer">Fermer</button>
          </div>
          <div ref={listRef} className="max-h-72 overflow-auto px-4 py-3 space-y-2 text-sm" aria-live="polite">
            {messages.length === 0 && <p className="text-muted">Un problème technique, une question sur une consigne ? Écrivez ici, le surveillant vous répond. Il ne peut pas vous aider sur le fond des questions.</p>}
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.sender === "candidate" ? "justify-end" : ""}`}>
                <div className={`px-3 py-2 rounded-lg max-w-[85%] whitespace-pre-wrap break-words ${m.sender === "candidate" ? "bg-accent/15" : "bg-surface-2 border border-line"}`}>
                  {m.body}
                  <div className="text-[10px] text-faint mt-1">{m.sender === "staff" ? "Surveillant · " : ""}{new Date(m.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-line p-3">
            <label htmlFor="chat-draft" className="sr-only">Votre message</label>
            <textarea id="chat-draft" className="input min-h-[3.5rem] resize-none" maxLength={1000} value={draft}
              onChange={(e) => setDraft(e.target.value)} placeholder="Votre message…"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }} />
            {error && <p className="text-danger text-xs mt-1" role="alert">{error}</p>}
            <div className="flex justify-between items-center mt-2">
              <span className="text-[11px] text-faint">Entrée pour envoyer</span>
              <button className="btn !py-1.5" onClick={submit} disabled={busy || !draft.trim()}>{busy ? "Envoi…" : "Envoyer"}</button>
            </div>
          </div>
        </div>
      ) : (
        <button className="btn-secondary bg-surface shadow-lg" onClick={() => setOpen(true)}>
          Écrire au surveillant
          {unread > 0 && <span className="ml-1 px-1.5 rounded-full bg-accent text-bg text-xs font-bold">{unread}</span>}
        </button>
      )}
    </div>
  );
}
