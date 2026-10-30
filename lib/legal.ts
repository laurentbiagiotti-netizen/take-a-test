/**
 * Informations légales affichées dans la notice candidats (/confidentialite).
 * À compléter avec le DPO avant la mise en ligne (variables d'environnement
 * NEXT_PUBLIC_LEGAL_*). Tant qu'une valeur manque, la notice affiche « à compléter ».
 */
const v = (x: string | undefined) => (x && x.trim()) || "[à compléter]";

export const LEGAL = {
  controller: v(process.env.NEXT_PUBLIC_LEGAL_CONTROLLER),       // raison sociale et adresse du responsable de traitement
  dpoContact: v(process.env.NEXT_PUBLIC_LEGAL_DPO_CONTACT),      // adresse pour exercer ses droits
  admissionsContact: v(process.env.NEXT_PUBLIC_LEGAL_ADMISSIONS), // demander une épreuve en présentiel
  host: v(process.env.NEXT_PUBLIC_LEGAL_HOST),                   // hébergeur et pays d'hébergement
  resultsRetention: v(process.env.NEXT_PUBLIC_LEGAL_RESULTS_RETENTION), // ex. « jusqu'à la fin de la campagne d'admission »
  updatedAt: "30 octobre 2026",
};
