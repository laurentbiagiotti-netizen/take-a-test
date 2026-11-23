/**
 * Convocation à une épreuve et relance des absents. Le texte est préparé ici.
 * Sans compte de l'école relié (page « Mails et agenda »), l'équipe l'envoie elle-même ;
 * avec, la plateforme envoie la convocation à l'inscription et une seule relance après l'épreuve.
 */
export type ConvocationInput = {
  email: string; fullName?: string | null; code: string; extraMinutes?: number;
  testTitle: string; durationMinutes: number; opensAt?: string | null; closesAt?: string | null;
  origin: string; testId: string;
};

/** Lien d'accès direct : le code est après #, il n'est jamais envoyé au serveur ni journalisé. */
export const accessLink = (origin: string, code: string) => `${origin}/acces#code=${code}`;

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
    `1. Ouvrez ce lien personnel : ${accessLink(i.origin, i.code)}`,
    `2. Ou rendez-vous sur ${i.origin}/acces et saisissez votre code : ${i.code}`,
    "Aucun compte à créer. Ce code est personnel : ne le transmettez à personne.",
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
    "La caméra n'enregistre pas en continu : une photo n'est prise qu'en cas d'anomalie, et aucune décision n'est automatique. Vos données et vos droits, et la possibilité de passer l'épreuve en présentiel :",
    `${i.origin}/confidentialite`,
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

/** Relance unique, envoyée deux heures après la fin de l'épreuve aux inscrits qui ne l'ont pas passée. */
export function relance(i: { email: string; fullName?: string | null; testTitle: string; endedAt: string }): { to: string; subject: string; body: string } {
  const first = (i.fullName || "").trim().split(/\s+/)[0];
  return {
    to: i.email,
    subject: `Épreuve « ${i.testTitle} » : nous n'avons pas reçu votre copie`,
    body: [
      `Bonjour${first ? " " + first : ""},`,
      "",
      `Vous étiez convoqué(e) à l'épreuve « ${i.testTitle} », qui s'est terminée le ${fmt(i.endedAt)}, et nous n'avons pas reçu votre copie.`,
      "",
      "Merci de répondre à ce message pour nous indiquer ce qui s'est passé (empêchement, problème technique, autre), afin que nous puissions convenir d'une solution.",
      "",
      "Cordialement,",
      "L'équipe pédagogique de Cybersup",
    ].join("\n"),
  };
}

/** Marge d'installation ajoutée à la durée de l'épreuve pour former le créneau (pièce d'identité, caméra, lecture des consignes). */
export const SLOT_MARGIN_MIN = 15;
/** Fin du créneau d'un candidat : début + durée de l'épreuve + temps supplémentaire + marge. Même règle que _slot_window en base. */
export const slotEnd = (slotAt: string, durationMinutes: number, extraMinutes = 0) =>
  new Date(+new Date(slotAt) + (durationMinutes + extraMinutes + SLOT_MARGIN_MIN) * 60000).toISOString();

const CONSIGNES = [
  "- un ordinateur (pas de téléphone ni de tablette) avec Chrome, Edge, Firefox ou Safari, et un seul écran ;",
  "- une webcam et une connexion stable ;",
  "- un endroit calme où vous serez seul(e).",
];

/** Rappel envoyé la veille (avec le lien) ou dix minutes avant le créneau. */
export function rappel(kind: "veille" | "10min", i: { email: string; fullName?: string | null; code: string; testTitle: string; slotAt: string; durationMinutes: number; extraMinutes?: number; origin: string }): { to: string; subject: string; body: string } {
  const first = (i.fullName || "").trim().split(/\s+/)[0];
  const link = accessLink(i.origin, i.code);
  const body = kind === "veille" ? [
    `Bonjour${first ? " " + first : ""},`,
    "",
    `Petit rappel : votre test « ${i.testTitle} » a lieu ${fmt(i.slotAt)}, à distance. Durée : ${i.durationMinutes + (i.extraMinutes || 0)} minutes.`,
    "",
    `Votre lien personnel : ${link}`,
    `Votre code, si on vous le demande : ${i.code}`,
    "Le lien s'ouvre dix minutes avant l'heure prévue. Il est personnel : ne le transmettez à personne.",
    "",
    "Dès aujourd'hui, testez votre matériel sur la page d'essai (caméra, plein écran) :",
    `${i.origin}/demo`,
    "",
    "Ce qu'il vous faut :", ...CONSIGNES,
    "",
    "En cas d'empêchement, répondez à ce message.",
    "",
    "À demain,",
    "L'équipe admissions Cybersup",
  ] : [
    `Bonjour${first ? " " + first : ""},`,
    "",
    `Votre test « ${i.testTitle} » commence dans dix minutes. Vous pouvez vous connecter dès maintenant :`,
    link,
    `Code personnel : ${i.code}`,
    "",
    "Installez-vous sur votre ordinateur, seul(e), caméra allumée. Le chronomètre démarre quand vous lancez l'épreuve.",
    "",
    "Bonne épreuve,",
    "L'équipe admissions Cybersup",
  ];
  return { to: i.email, subject: kind === "veille" ? `Rappel : votre test « ${i.testTitle} » demain` : `Votre test « ${i.testTitle} » commence dans 10 minutes`, body: body.join("\n") };
}

/** Description de l'événement d'agenda du candidat : tout ce qu'il faut pour passer le test avec la seule invitation. */
export function eventDescription(i: { code: string; testTitle: string; durationMinutes: number; extraMinutes?: number; origin: string }): string {
  return [
    `Test « ${i.testTitle} », à distance. Durée : ${i.durationMinutes + (i.extraMinutes || 0)} minutes, chronométrées dès le démarrage.`,
    "",
    `Votre lien personnel : ${accessLink(i.origin, i.code)}`,
    `Votre code : ${i.code}`,
    "Le lien s'ouvre dix minutes avant l'heure prévue. Il est personnel : ne le transmettez à personne.",
    "",
    "Ce qu'il vous faut :", ...CONSIGNES,
    "",
    `Page d'essai pour tester votre matériel : ${i.origin}/demo`,
    "En cas d'empêchement, répondez au mail de convocation.",
  ].join("\n");
}

/** Classe en abrégé pour le titre de l'événement : « Bachelor 3 Cybersécurité » devient « B3 Cyber ». */
export function shortClass(formation?: string | null): string {
  const f = (formation || "").trim();
  if (!f) return "";
  return f.replace(/^Bachelor\s*(\d)/i, "B$1").replace(/^Mast[eè]re\s*(\d)/i, "M$1").replace(/^Master\s*(\d)/i, "M$1")
    .replace(/Cybers[ée]curit[ée]/i, "Cyber").replace(/\s+/g, " ").trim();
}

/** Titre de l'événement d'un candidat : « Test technique B3 Cyber - Prénom » (sans classe : « Test technique - Prénom »). */
export const eventTitle = (formation: string | null | undefined, firstName: string) =>
  ["Test technique", shortClass(formation)].filter(Boolean).join(" ") + ` - ${firstName}`;

/** Avis de report : le créneau du candidat a changé après sa convocation. */
export function report(i: { email: string; fullName?: string | null; code: string; testTitle: string; slotAt: string; durationMinutes: number; extraMinutes?: number; origin: string }): { to: string; subject: string; body: string } {
  const first = (i.fullName || "").trim().split(/\s+/)[0];
  return {
    to: i.email,
    subject: `Nouvelle date pour votre test « ${i.testTitle} »`,
    body: [
      `Bonjour${first ? " " + first : ""},`,
      "",
      `La date de votre test « ${i.testTitle} » a changé. Il aura lieu ${fmt(i.slotAt)}, à distance. Durée : ${i.durationMinutes + (i.extraMinutes || 0)} minutes.`,
      "",
      `Votre lien personnel ne change pas : ${accessLink(i.origin, i.code)}`,
      `Votre code, si on vous le demande : ${i.code}`,
      "Le lien s'ouvre dix minutes avant la nouvelle heure. L'ancienne date n'est plus valable.",
      "",
      "Si cette date ne vous convient pas, répondez à ce message.",
      "",
      "Cordialement,",
      "L'équipe admissions Cybersup",
    ].join("\n"),
  };
}
