/**
 * Convocation à une épreuve d'admission. Le texte est préparé ici et relu par
 * l'équipe avant envoi : la plateforme ne l'envoie jamais toute seule.
 */
export type ConvocationInput = {
  email: string; fullName?: string | null; code: string; extraMinutes?: number;
  testTitle: string; durationMinutes: number; opensAt?: string | null; closesAt?: string | null;
  origin: string; testId: string;
};

const fmt = (d: string) => new Date(d).toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "full", timeStyle: "short" });

export function convocation(i: ConvocationInput): { to: string; subject: string; body: string } {
  const first = (i.fullName || "").trim().split(/\s+/)[0];
  const duration = i.durationMinutes + (i.extraMinutes || 0);
  const window = i.opensAt && i.closesAt ? `entre le ${fmt(i.opensAt)} et le ${fmt(i.closesAt)}`
    : i.opensAt ? `à partir du ${fmt(i.opensAt)}` : i.closesAt ? `avant le ${fmt(i.closesAt)}` : "dès réception de ce message";
  const body = [
    `Bonjour${first ? " " + first : ""},`,
    "",
    `Vous êtes convoqué(e) à l'épreuve « ${i.testTitle} », à passer en ligne ${window}.`,
    `Durée : ${duration} minutes${i.extraMinutes ? ` (dont ${i.extraMinutes} minutes de temps supplémentaire accordé)` : ""}, chronométrées dès le démarrage.`,
    "",
    "Pour passer l'épreuve :",
    `1. Créez votre compte avec cette adresse (${i.email}) : ${i.origin}/signup`,
    `2. Ouvrez l'épreuve : ${i.origin}/test/${i.testId}`,
    `3. Saisissez votre code d'accès personnel : ${i.code}`,
    "",
    "La veille, testez votre matériel sur la page d'essai (caméra, plein écran) :",
    `${i.origin}/demo`,
    "",
    "Ce qu'il vous faut :",
    "- un ordinateur (pas de téléphone ni de tablette) avec Chrome, Edge, Firefox ou Safari, et un seul écran ;",
    "- une webcam et une connexion stable ;",
    "- un endroit calme où vous serez seul(e).",
    "",
    "L'épreuve se passe en plein écran, question par question, sans retour en arrière. Copier-coller et changement de fenêtre sont bloqués.",
    "À la fin, un accusé de réception avec un numéro de référence s'affiche : notez-le.",
    "",
    "Bonne épreuve,",
    "L'équipe admissions Cybersup",
  ].join("\n");
  return { to: i.email, subject: `Convocation : ${i.testTitle}`, body };
}

/** CSV simple (séparateur détecté) → objets, en-têtes en minuscules. */
export function readCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim());
  if (!lines.length) return [];
  const sep = [";", ",", "\t"].sort((a, b) => lines[0].split(b).length - lines[0].split(a).length)[0];
  const split = (l: string) => {
    const out: string[] = []; let cur = "", q = false;
    for (let k = 0; k < l.length; k++) {
      const c = l[k];
      if (q) { if (c === '"' && l[k + 1] === '"') { cur += '"'; k++; } else if (c === '"') q = false; else cur += c; }
      else if (c === '"') q = true; else if (c === sep) { out.push(cur); cur = ""; } else cur += c;
    }
    out.push(cur); return out.map((x) => x.trim());
  };
  const head = split(lines[0]).map((h) => h.toLowerCase());
  return lines.slice(1, 5001).map((l) => { const v = split(l); return Object.fromEntries(head.map((h, k) => [h, v[k] ?? ""])); });
}

export type ImportedCandidate = { email: string; full_name: string | null; extra_minutes: number; external_ref: string | null };

/**
 * Reconnaît les exports HubSpot, Grimp ou un tableur maison :
 * e-mail, prénom / nom (ou nom complet), tiers-temps en minutes, identifiant d'origine.
 */
export function importCandidates(text: string): { rows: ImportedCandidate[]; skipped: number } {
  const trimmed = text.trim();
  if (!/[,;\t]/.test(trimmed.split("\n")[0]) || !/mail/i.test(trimmed.split("\n")[0])) {
    // Simple liste d'adresses
    const rows = Array.from(new Set(trimmed.split(/[\s,;]+/).map((s) => s.toLowerCase()).filter((s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s))))
      .map((email) => ({ email, full_name: null, extra_minutes: 0, external_ref: null }));
    return { rows, skipped: 0 };
  }
  const pick = (r: Record<string, string>, ...keys: RegExp[]) => {
    for (const k of Object.keys(r)) if (keys.some((re) => re.test(k)) && r[k]) return r[k];
    return "";
  };
  const seen = new Set<string>();
  let skipped = 0;
  const rows: ImportedCandidate[] = [];
  for (const r of readCsv(trimmed)) {
    const email = pick(r, /^e-?mail/, /mail/).toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || seen.has(email)) { skipped++; continue; }
    seen.add(email);
    const first = pick(r, /pr[ée]nom/, /first/), last = pick(r, /^nom$/, /last/, /^nom de famille/);
    const full = pick(r, /^nom complet/, /full ?name/, /^name$/) || [first, last].filter(Boolean).join(" ");
    const extra = parseInt(pick(r, /tiers/, /extra/, /am[ée]nagement/, /temps suppl/), 10);
    rows.push({
      email, full_name: full ? full.slice(0, 200) : null,
      extra_minutes: Number.isFinite(extra) ? Math.min(600, Math.max(0, extra)) : 0,
      external_ref: pick(r, /record id/, /^id$/, /hubspot/, /grimp/, /identifiant/).slice(0, 200) || null,
    });
  }
  return { rows, skipped };
}
