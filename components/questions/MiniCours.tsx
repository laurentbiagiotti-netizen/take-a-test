"use client";

/**
 * « Le petit cours » : quelques lignes, au début de l'exercice, pour un candidat
 * qui ne connaît rien au sujet (B1). On mesure s'il comprend vite et applique,
 * pas ce qu'il savait déjà. Activé par l'option « help » de la question.
 */
const COURS: Record<string, { titre: string; lignes: string[] }> = {
  sql: { titre: "Une base de données, c'est quoi ?", lignes: [
    "C'est un ensemble de tableaux (des « tables »). Chaque ligne est un enregistrement, chaque colonne une information.",
    "On l'interroge en SQL : SELECT colonne FROM table WHERE condition ;",
    "Exemple : SELECT login FROM comptes WHERE admin = 1 ; affiche les logins des administrateurs.",
    "DISTINCT évite les doublons. Le bouton « Exécuter » vous montre le résultat : essayez, vous ne cassez rien.",
  ] },
  decode: { titre: "Encoder n'est pas chiffrer", lignes: [
    "Un message peut être transformé plusieurs fois pour le rendre illisible à première vue.",
    "Base64 : un texte qui ne contient que des lettres, des chiffres, + et /, souvent terminé par « = ».",
    "ROT13 : chaque lettre est remplacée par celle qui est 13 places plus loin dans l'alphabet (A devient N).",
    "Ajoutez une opération, regardez le résultat, recommencez : quand le texte devient lisible, vous avez trouvé.",
  ] },
  password: { titre: "Qu'est-ce qu'un mot de passe solide ?", lignes: [
    "Un attaquant essaie d'abord les mots de passe connus (azerty, 123456…) puis les mots du dictionnaire avec des variantes.",
    "Remplacer a par @ ou o par 0 ne le trompe pas : il connaît ces astuces.",
    "Ce qui compte vraiment, c'est la longueur et le côté imprévisible (plusieurs mots au hasard par exemple).",
  ] },
  blocks: { titre: "Un pare-feu, comment ça marche ?", lignes: [
    "C'est le gardien à l'entrée du réseau : pour chaque connexion, il décide « autoriser » ou « bloquer ».",
    "Une IP est l'adresse d'une machine (ex. 88.12.4.9). 10.0.0.0/8 veut dire « toutes les adresses qui commencent par 10. ».",
    "Le port indique le service demandé : 80 et 443 pour un site web, 22 pour SSH (prendre la main à distance sur un serveur).",
    "Le pare-feu lit vos règles de haut en bas et applique la première qui correspond ; sinon, la politique par défaut.",
  ] },
  headers: { titre: "Comment lire le « passeport » d'un mail", lignes: [
    "Chaque serveur qui transporte un mail ajoute une ligne « Received ». Le premier saut est le vrai point de départ.",
    "« From » est l'expéditeur affiché : il se falsifie facilement. « Reply-To » est l'adresse où partira votre réponse.",
    "SPF vérifie que le serveur avait le droit d'envoyer pour ce domaine ; DKIM vérifie une signature. « fail » ou « none » est mauvais signe.",
  ] },
  netpuzzle: { titre: "Le principe", lignes: [
    "Chaque case est un morceau de câble. Cliquez dessus pour la faire tourner d'un quart de tour.",
    "Le carré central est le serveur ; les petits écrans sont les postes. Tout ce qui est relié au serveur devient orange.",
    "Astuce : commencez par les bords et les coins, où les câbles n'ont pas beaucoup de choix.",
  ] },
};

export default function MiniCours({ type }: { type: string }) {
  const c = COURS[type];
  if (!c) return null;
  return (
    <details open className="rounded-lg border border-accent/30 bg-accent/5 p-3 text-sm mb-4">
      <summary className="cursor-pointer font-semibold text-accent">Le petit cours : {c.titre}</summary>
      <ul className="mt-2 space-y-1.5 list-disc pl-5 text-fg/90">{c.lignes.map((l) => <li key={l}>{l}</li>)}</ul>
    </details>
  );
}
