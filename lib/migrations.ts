/**
 * Migrations que cette version du code attend en base, dans l'ordre (même liste que supabase/migrations/ORDRE,
 * vérifié par un test). La page « Mails et agenda » signale celles qui manquent.
 */
export const EXPECTED_MIGRATIONS = [
  "2026-11-17-sans-scan-piece.sql", "2026-11-17-banque-questions.sql", "2026-11-23-plateforme-v2.sql",
  "2026-11-23-mails-agenda.sql", "2026-11-23-creneaux.sql", "2026-11-23-agenda-hubspot.sql", "2026-11-23-suivi.sql",
];
