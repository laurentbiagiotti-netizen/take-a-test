"use client";
import { useId, useState, type InputHTMLAttributes } from "react";

/** Champ avec étiquette toujours visible (et non un simple texte gris qui disparaît). */
export function Field({ label, hint, ...props }: { label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-fg">{label}</label>
      <input id={id} className="input mt-1.5" aria-describedby={hint ? `${id}-hint` : undefined} {...props} />
      {hint && <p id={`${id}-hint`} className="text-xs text-muted mt-1">{hint}</p>}
    </div>
  );
}

export function PasswordField({ label = "Mot de passe", hint, ...props }: { label?: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  const [show, setShow] = useState(false);
  return (
    <div>
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="block text-sm font-medium text-fg">{label}</label>
        <button type="button" className="text-xs text-muted hover:text-fg" onClick={() => setShow((s) => !s)} aria-controls={id}>
          {show ? "Masquer" : "Afficher"}
        </button>
      </div>
      <input id={id} className="input mt-1.5" type={show ? "text" : "password"} aria-describedby={hint ? `${id}-hint` : undefined} {...props} />
      {hint && <p id={`${id}-hint`} className="text-xs text-muted mt-1">{hint}</p>}
    </div>
  );
}

/** Robustesse : la longueur compte d'abord (12 minimum), puis la variété. */
export function passwordScore(p: string): { score: 0 | 1 | 2 | 3; label: string } {
  if (p.length < 12) return { score: 0, label: p.length ? `Encore ${12 - p.length} caractère${12 - p.length > 1 ? "s" : ""}` : "12 caractères minimum" };
  const kinds = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(p)).length;
  const common = /(azerty|qwerty|password|motdepasse|123456|cybersup|admin)/i.test(p);
  if (common) return { score: 1, label: "Trop prévisible" };
  if (p.length >= 16 || kinds >= 3) return { score: 3, label: "Solide" };
  return { score: kinds >= 2 ? 2 : 1, label: kinds >= 2 ? "Correct" : "Faible : mélangez les caractères ou allongez" };
}

export function PasswordMeter({ value }: { value: string }) {
  const { score, label } = passwordScore(value);
  const color = ["bg-danger", "bg-danger", "bg-warn", "bg-ok"][score];
  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex gap-1" aria-hidden>
        {[1, 2, 3].map((i) => <div key={i} className={`h-1 flex-1 rounded ${score >= i ? color : "bg-surface-2"}`} />)}
      </div>
      <p className={`text-xs mt-1 ${score === 3 ? "text-ok" : score === 2 ? "text-warn" : "text-muted"}`}>{label}</p>
    </div>
  );
}

/** Messages de Supabase traduits pour les candidats. */
export function authMessage(m: string): string {
  if (/invalid login credentials/i.test(m)) return "E-mail ou mot de passe incorrect.";
  if (/email not confirmed/i.test(m)) return "Adresse e-mail pas encore confirmée : ouvrez le lien reçu par e-mail.";
  if (/already registered|already exists/i.test(m)) return "Un compte existe déjà avec cette adresse : connectez-vous ou réinitialisez le mot de passe.";
  if (/rate limit|too many/i.test(m)) return "Trop de tentatives : patientez une minute puis réessayez.";
  if (/password/i.test(m) && /(short|least|weak)/i.test(m)) return "Mot de passe trop faible : 12 caractères minimum.";
  return m;
}
