/**
 * Outils de l'école utilisables comme exercice dans une épreuve.
 *
 * Deux façons de noter :
 *  - "tool"     : l'outil a son propre serveur, qui note et renvoie le
 *                 résultat signé à /api/external/result (Crime GeoGuess) ;
 *  - "platform" : l'outil n'a pas de serveur ; il affiche le contenu fourni
 *                 par la plateforme et lui renvoie les choix du candidat. Le
 *                 corrigé reste en base et la plateforme note (Cybersup OS).
 *
 * Ce fichier ne contient aucun secret : il peut être importé côté client.
 */
export type GradingMode = "tool" | "platform";

export type ToolInfo = {
  id: string;
  label: string;
  grading: GradingMode;
  defaultUrl: string;
  /** Page d'examen de l'outil (le jeton est passé dans le fragment #t=…). */
  path: string;
  /** Aide affichée dans l'éditeur de l'épreuve. */
  scenarioHelp: string;
  scenarioExample: unknown;
};

export const TOOLS: Record<string, ToolInfo> = {
  crime: {
    id: "crime",
    label: "Crime GeoGuess",
    grading: "tool",
    defaultUrl: "https://crime.cybersup.ai",
    path: "/exam",
    scenarioHelp:
      "Cas imposés (identifiants des cas de Crime GeoGuess) ou tirage au hasard : count, difficulty. " +
      "with_flag ajoute le défi cyber de chaque cas. La note vient du serveur de Crime GeoGuess.",
    scenarioExample: { count: 3, difficulty: "normal", with_flag: true },
  },
  win95: {
    id: "win95",
    label: "Cybersup OS",
    grading: "platform",
    defaultUrl: "https://win95.cybersup.ai",
    path: "/exam",
    scenarioHelp:
      "Liste d'éléments à trier (mails, SMS, adresses web), sans corrigé. Le corrigé va dans le champ " +
      "à part : identifiant de l'élément vers « fraud » ou « legit ». Générez les deux avec " +
      "npm run export:exam dans le projet Cybersup OS.",
    scenarioExample: {
      intro: "Triez ces messages : frauduleux ou légitimes ?",
      items: [{ id: "u1", kind: "url", data: { url: "https://www.impots.gouv.fr" } }],
    },
  },
};

export function toolInfo(id: string | null | undefined): ToolInfo | null {
  return (id && TOOLS[id]) || null;
}
