import { encodeForRecipe, type RecipeStep } from "./decode";
import { suggestKey } from "./headers";

/**
 * Exemples prêts à l'emploi insérés quand l'admin ajoute une question pratique.
 * Il n'a plus qu'à adapter l'énoncé, les données et la réponse.
 */
const LOGS = [
  ["alice", "10.0.0.12", "2026-10-02 08:41", 1], ["bob", "10.0.0.15", "2026-10-02 09:02", 1],
  ["carla", "185.220.101.7", "2026-10-02 02:13", 0], ["carla", "185.220.101.7", "2026-10-02 02:14", 0],
  ["carla", "185.220.101.7", "2026-10-02 02:15", 1], ["dimitri", "10.0.0.31", "2026-10-02 10:20", 1],
  ["emma", "10.0.0.44", "2026-10-02 13:05", 1], ["alice", "10.0.0.12", "2026-10-02 18:30", 1],
  ["fares", "45.83.64.2", "2026-10-03 03:47", 1], ["bob", "10.0.0.15", "2026-10-03 08:55", 1],
  ["gael", "10.0.0.52", "2026-10-03 04:10", 1], ["emma", "10.0.0.44", "2026-10-03 12:40", 0],
  ["emma", "10.0.0.44", "2026-10-03 12:41", 1], ["dimitri", "10.0.0.31", "2026-10-03 01:59", 1],
  ["fares", "45.83.64.2", "2026-10-03 03:52", 1], ["alice", "10.0.0.12", "2026-10-04 07:58", 1],
] as const;
const SETUP = [
  "CREATE TABLE connexions (id INTEGER PRIMARY KEY, login TEXT, ip TEXT, heure TEXT, succes INTEGER);",
  ...LOGS.map(([l, ip, h, s], i) => `INSERT INTO connexions VALUES (${i + 1}, '${l}', '${ip}', '${h}', ${s});`),
  "CREATE TABLE comptes (login TEXT PRIMARY KEY, service TEXT, admin INTEGER);",
  "INSERT INTO comptes VALUES ('alice','RH',0),('bob','Compta',0),('carla','IT',1),('dimitri','IT',0),('emma','Direction',0),('fares','IT',1),('gael','Accueil',0);",
].join("\n");

const DECODE_RECIPE: RecipeStep[] = [{ op: "from_base64" }, { op: "rot13" }];
const DECODE_FLAG = "CYBER{r0t13_3t_b4s3_64}";

const pk = (id: string, label: string, src_ip: string, dst_port: number, protocol: string, country: string, hour: number, expected: "allow" | "block") =>
  ({ id, label, src_ip, dst_port, protocol, country, hour, expected });

const MAIL = `Received: from mx.cybersup-ecole.example (mx.cybersup-ecole.example [192.0.2.25])
        by mail.cybersup-ecole.example with ESMTPS id 7Hq2; Tue, 3 Nov 2026 08:14:09 +0100
Received: from relay.mailflux.example (relay.mailflux.example [198.51.100.77])
        by mx.cybersup-ecole.example with ESMTP id 41fd; Tue, 3 Nov 2026 08:14:06 +0100
Received: from pc-0451 (unknown [203.0.113.45])
        by relay.mailflux.example with SMTP id x9k2; Tue, 3 Nov 2026 08:13:21 +0100
Authentication-Results: mx.cybersup-ecole.example;
       spf=fail (sender IP is 203.0.113.45) smtp.mailfrom=banque-horizon-secure.example;
       dkim=none (message not signed);
       dmarc=fail action=quarantine header.from=banque-horizon.example
From: "Service Client Banque Horizon" <securite@banque-horizon.example>
Reply-To: <support-client@verif-compte-urgent.example>
Return-Path: <bounce@banque-horizon-secure.example>
To: <etudiant@cybersup-ecole.example>
Subject: [URGENT] Votre compte sera suspendu sous 24 h
Date: Tue, 3 Nov 2026 08:13:19 +0100
Message-ID: <20261103071319.4471@pc-0451>`;
const MAIL_ASK = ["origin_ip", "spf", "reply_to", "verdict"] as const;
const MAIL_KEY = Object.fromEntries(MAIL_ASK.map((k) => [k, suggestKey(MAIL)[k]]));

export const PRACTICAL_TEMPLATES = {
  headers: {
    prompt: "Un étudiant a reçu ce mail et vous demande s'il doit cliquer. Analysez ses en-têtes.",
    options: { raw: MAIL, view: "table", ask: MAIL_ASK, help: true },
    correct: MAIL_KEY,
    points: 2,
  },
  subnet: {
    prompt: "Un technicien doit configurer une nouvelle machine. À partir de son adresse, retrouvez les informations du réseau.",
    options: { mode: "basic", prefixes: [24, 25, 26, 27, 28], ask: ["network", "broadcast", "hosts"], help: true },
    correct: null,
    points: 2,
  },
  netpuzzle: {
    prompt: "Le serveur central (le carré) doit être relié à tous les postes de la salle. Remettez les câbles dans le bon sens.",
    options: { w: 5, h: 5, help: true },
    correct: null,
    points: 2,
  },
  sql: {
    prompt: "La table connexions trace les ouvertures de session. Trouvez les comptes qui se sont connectés avec succès entre 2 h et 4 h du matin (2 h 00 à 3 h 59). Affichez seulement la colonne login, une fois par compte.",
    options: { mode: "query", setup: SETUP, show_tables: true, help: true },
    correct: { expected_sql: "SELECT DISTINCT login FROM connexions WHERE succes = 1 AND CAST(strftime('%H', heure) AS INTEGER) BETWEEN 2 AND 3;", ordered: false },
    points: 2,
  },
  decode: {
    prompt: "Ce message a été intercepté sur le réseau de l'école. Il cache un flag. Construisez la recette qui le décode, puis recopiez le flag.",
    options: { input: encodeForRecipe(DECODE_FLAG, DECODE_RECIPE), help: true },
    correct: { answers: [DECODE_FLAG], case_sensitive: true, recipe: DECODE_RECIPE },
    points: 2,
  },
  password: {
    prompt: "Classez ces mots de passe du plus facile à casser au plus robuste.",
    options: { mode: "rank", help: true, items: [
      { id: "p1", text: "azerty123" }, { id: "p2", text: "P@ssw0rd2024" }, { id: "p3", text: "Marseille13!" },
      { id: "p4", text: "tortue-velo-nuage-47" }, { id: "p5", text: "j7#Qx!r9Lw2$" },
    ] },
    correct: null,
    points: 2,
  },
  blocks: {
    prompt: "Programmez le pare-feu du serveur web de l'école :\n• le site (ports 80 et 443) doit rester accessible à tous ;\n• SSH (port 22) seulement depuis le réseau interne 10.0.0.0/8 ;\n• tout le reste est bloqué.",
    options: { help: true, sample: [
      pk("s1", "Visiteur du site", "88.12.4.9", 443, "tcp", "FR", 14, "allow"),
      pk("s2", "Admin au bureau", "10.0.4.20", 22, "tcp", "FR", 10, "allow"),
      pk("s3", "SSH depuis internet", "185.220.101.7", 22, "tcp", "DE", 3, "block"),
      pk("s4", "Base de données exposée", "45.83.64.2", 3306, "tcp", "RU", 2, "block"),
    ] },
    correct: { packets: [
      pk("h1", "", "92.184.10.3", 80, "tcp", "FR", 9, "allow"), pk("h2", "", "51.15.2.8", 443, "tcp", "FR", 22, "allow"),
      pk("h3", "", "203.0.113.5", 443, "tcp", "US", 4, "allow"), pk("h4", "", "10.1.2.3", 22, "tcp", "FR", 11, "allow"),
      pk("h5", "", "10.200.0.9", 22, "tcp", "FR", 23, "allow"), pk("h6", "", "10.0.0.7", 443, "tcp", "FR", 15, "allow"),
      pk("h7", "", "11.0.0.4", 22, "tcp", "US", 3, "block"), pk("h8", "", "192.168.1.10", 22, "tcp", "FR", 9, "block"),
      pk("h9", "", "185.220.101.7", 22, "tcp", "DE", 2, "block"), pk("h10", "", "45.83.64.2", 3389, "tcp", "RU", 1, "block"),
      pk("h11", "", "10.0.0.8", 3306, "tcp", "FR", 10, "block"), pk("h12", "", "88.12.4.9", 21, "tcp", "FR", 12, "block"),
      pk("h13", "", "8.8.8.8", 53, "udp", "US", 5, "block"), pk("h14", "", "10.3.3.3", 80, "tcp", "FR", 16, "allow"),
      pk("h15", "", "77.136.4.1", 80, "tcp", "FR", 20, "allow"), pk("h16", "", "100.64.0.1", 22, "tcp", "FR", 8, "block"),
    ] },
    points: 3,
  },
} as const;

/* ------------------------------------------------------------------
 * Packs d'exercices pratiques, construits à partir des grilles de Dylan
 * (QCM et entretiens d'admission 2026, Drive « Tests d'admission »).
 *  - B1 : aucun prérequis, on cherche les pépites (logique, curiosité,
 *    capacité à apprendre vite) : « le petit cours » est affiché.
 *  - B3 : acquis de sortie de BTS SIO SISR ou CIEL IR, orientés
 *    administration et support ; rien du programme de B3 (pas de pentest).
 * ------------------------------------------------------------------ */
const it = (id: string, text: string) => ({ id, text });
const L = (id: string, text: string) => ({ id, text });

export type PackQuestion = { type: string; prompt: string; domain: string; points: number; time_limit_s: number; options: any; correct: any };

const B3_LOGS = [
  "CREATE TABLE connexions (id INTEGER PRIMARY KEY, compte TEXT, pays TEXT, heure TEXT, succes INTEGER);",
  ...([
    ["m.durand", "FR", "2026-10-05 08:12", 1], ["m.durand", "FR", "2026-10-05 13:40", 1], ["s.leroy", "FR", "2026-10-05 09:01", 1],
    ["s.leroy", "RO", "2026-10-06 03:17", 0], ["s.leroy", "RO", "2026-10-06 03:18", 0], ["s.leroy", "RO", "2026-10-06 03:19", 1],
    ["a.benali", "FR", "2026-10-06 07:55", 1], ["compta01", "FR", "2026-10-06 02:30", 1], ["k.martin", "ES", "2026-10-06 10:05", 1],
    ["k.martin", "FR", "2026-10-07 08:47", 1], ["j.petit", "NG", "2026-10-07 04:02", 1], ["j.petit", "FR", "2026-10-07 09:15", 1],
    ["a.benali", "FR", "2026-10-07 23:58", 1], ["svc.backup", "FR", "2026-10-08 01:00", 1], ["m.durand", "BR", "2026-10-08 02:44", 0],
  ] as const).map(([c, p, h, s], i) => `INSERT INTO connexions VALUES (${i + 1}, '${c}', '${p}', '${h}', ${s});`),
].join("\n");

export const PACKS: Record<"b1" | "b3", { label: string; minutes: number; questions: PackQuestion[] }> = {
  b1: {
    label: "B1 : logique et curiosité (aucun prérequis)",
    minutes: 20,
    // Chaque consigne se suffit à elle-même : un candidat qui ne lit pas « le petit cours »
    // doit pouvoir répondre avec du bon sens, de l'observation et de la logique.
    questions: [
      { type: "netpuzzle", domain: "Logique et raisonnement", points: 2, time_limit_s: 240,
        prompt: "Le carré au centre est un serveur, les petits écrans sont des ordinateurs. Cliquez sur une case pour la faire tourner. Faites tourner les cases jusqu'à ce que tous les ordinateurs soient reliés au serveur (ils deviennent orange), sans câble qui part dans le vide.",
        options: { w: 5, h: 5, help: true }, correct: null },
      { type: "ordering", domain: "Fonctionnement du numérique", points: 2, time_limit_s: 150,
        prompt: "Pour aller sur un site, votre navigateur fait comme vous pour appeler quelqu'un dont vous ne connaissez que le nom : il cherche d'abord son numéro dans un annuaire, puis il appelle. Remettez les étapes dans l'ordre.",
        options: [it("o1", "Vous tapez www.cybersup.ai et vous appuyez sur Entrée"), it("o2", "Le navigateur demande à l'annuaire d'Internet le numéro (l'adresse IP) du site"),
          it("o3", "L'annuaire répond avec l'adresse IP du site"), it("o4", "Le navigateur contacte l'ordinateur du site à cette adresse"),
          it("o5", "L'ordinateur du site envoie la page"), it("o6", "Le navigateur affiche la page à l'écran")],
        correct: ["o1", "o2", "o3", "o4", "o5", "o6"] },
      { type: "hotspot", domain: "Réflexes cyber", points: 2, time_limit_s: 180,
        prompt: "Voici l'historique des connexions au compte de Léa, qui habite à Lyon et travaille de 9 h à 18 h. Cliquez sur les connexions qui vous semblent suspectes.",
        options: { layout: "table", multi: true, columns: ["Date", "Heure", "Ville", "Appareil", "Résultat"],
          segments: [
            { id: "c1", cells: ["lundi", "08:52", "Lyon", "Ordinateur portable", "réussie"] },
            { id: "c2", cells: ["lundi", "12:30", "Lyon", "Téléphone", "réussie"] },
            { id: "c3", cells: ["mardi", "03:14", "Lagos (Nigeria)", "Ordinateur inconnu", "échec"] },
            { id: "c4", cells: ["mardi", "03:15", "Lagos (Nigeria)", "Ordinateur inconnu", "échec"] },
            { id: "c5", cells: ["mardi", "03:16", "Lagos (Nigeria)", "Ordinateur inconnu", "réussie"] },
            { id: "c6", cells: ["mardi", "09:05", "Lyon", "Ordinateur portable", "réussie"] },
            { id: "c7", cells: ["mercredi", "17:40", "Lyon", "Téléphone", "réussie"] },
            { id: "c8", cells: ["jeudi", "02:47", "Moscou (Russie)", "Ordinateur inconnu", "réussie"] },
          ] },
        correct: ["c3", "c4", "c5", "c8"] },
      { type: "password", domain: "Réflexes cyber", points: 2, time_limit_s: 150,
        prompt: "Un pirate essaie d'abord les mots de passe les plus courants, puis des mots du dictionnaire avec des petites variantes (a remplacé par @, un chiffre à la fin…). Classez ces mots de passe, du plus vite deviné (en haut) au plus difficile à deviner (en bas).",
        options: clone(PRACTICAL_TEMPLATES.password.options), correct: null },
      { type: "headers", domain: "Réflexes cyber", points: 2, time_limit_s: 240,
        prompt: "Un étudiant a reçu ce mail et vous demande s'il doit cliquer. Les informations sont dans les tableaux : lisez-les attentivement, la réponse à chaque question y figure.",
        options: clone(PRACTICAL_TEMPLATES.headers.options), correct: clone(PRACTICAL_TEMPLATES.headers.correct) },
      { type: "decode", domain: "Logique et raisonnement", points: 2, time_limit_s: 240,
        prompt: "Ce message a été brouillé plusieurs fois pour être illisible. À gauche, des boutons appliquent des transformations : essayez-les une par une, regardez le résultat, retirez celles qui n'aident pas. Quand le texte devient lisible et commence par CYBER{, recopiez-le.",
        options: clone(PRACTICAL_TEMPLATES.decode.options), correct: clone(PRACTICAL_TEMPLATES.decode.correct) },
      { type: "blocks", domain: "Logique et raisonnement", points: 2, time_limit_s: 300,
        prompt: "Vous êtes le gardien de l'entrée du serveur de l'école. Chaque visiteur annonce sa porte (le « port ») et son adresse (l'« IP »). Les règles à appliquer :\n• tout le monde peut entrer par les portes 80 et 443 (le site web) ;\n• la porte 22 (la maintenance) seulement pour les adresses qui commencent par 10. ;\n• tout le reste est refusé.\nAssemblez les blocs, puis vérifiez dans le tableau du bas que chaque visiteur reçoit la bonne décision.",
        options: clone(PRACTICAL_TEMPLATES.blocks.options), correct: clone(PRACTICAL_TEMPLATES.blocks.correct) },
    ],
  },
  b3: {
    label: "B3 : administration et support (niveau fin de BTS SIO SISR)",
    minutes: 25,
    questions: [
      { type: "subnet", domain: "Réseaux", points: 2, time_limit_s: 180,
        prompt: "Un poste vient d'être installé. À partir de son adresse, complétez la fiche réseau.",
        options: { mode: "basic", prefixes: [25, 26, 27, 28], ask: ["network", "broadcast", "first", "last", "hosts", "mask"], help: false }, correct: null },
      { type: "subnet", domain: "Réseaux", points: 3, time_limit_s: 300,
        prompt: "L'école déménage dans un nouveau bâtiment. Découpez le bloc reçu entre les services.",
        options: { mode: "vlsm", services: 3, help: false }, correct: null },
      { type: "ordering", domain: "Logique et diagnostic", points: 2, time_limit_s: 120,
        prompt: "Un utilisateur n'a plus Internet. Vous êtes à son poste : dans quel ordre vérifiez-vous ?",
        options: [it("d1", "Le câble, le voyant de la carte réseau, le Wi-Fi activé"), it("d2", "La configuration IP avec ipconfig (une adresse en 169.254 signale un problème de DHCP)"),
          it("d3", "Un ping de la passerelle"), it("d4", "Un ping de 8.8.8.8"), it("d5", "Un ping d'un nom de domaine (s'il échoue alors que 8.8.8.8 répond : DNS)")],
        correct: ["d1", "d2", "d3", "d4", "d5"] },
      { type: "ordering", domain: "Logique et diagnostic", points: 2, time_limit_s: 120,
        prompt: "Ces demandes arrivent en même temps. Classez-les de la plus prioritaire à la moins prioritaire (impact et urgence).",
        options: [it("i1", "Un compte administrateur semble compromis"), it("i2", "La messagerie est en panne pour toute l'entreprise"),
          it("i3", "Un poste est en panne, un poste de secours est disponible"), it("i4", "Le clavier d'un utilisateur a une touche qui accroche")],
        correct: ["i1", "i2", "i3", "i4"] },
      { type: "matching", domain: "Systèmes", points: 2, time_limit_s: 180,
        prompt: "Un nouveau collaborateur de la comptabilité arrive lundi, et un autre part vendredi. Associez chaque situation à la bonne pratique.",
        options: { left: [L("l1", "Il doit accéder au dossier partagé de la comptabilité"), L("l2", "Il demande les droits administrateur pour installer un logiciel"),
          L("l3", "Ses paramètres de poste doivent être identiques à ceux de son service"), L("l4", "Son collègue quitte l'entreprise vendredi"),
          L("l5", "Il reçoit ses identifiants")],
          right: [L("r1", "L'ajouter au groupe « Comptabilité » qui a les droits sur le dossier"), L("r2", "Refuser des droits permanents, vérifier le logiciel et l'installer soi-même"),
          L("r3", "Placer son compte dans l'OU du service, où s'appliquent les GPO"), L("r4", "Désactiver le compte le jour du départ, le supprimer plus tard"),
          L("r5", "Mot de passe temporaire à changer à la première connexion, avec le MFA"), L("r6", "Copier les droits d'un collègue du même service")] },
        correct: { l1: "r1", l2: "r2", l3: "r3", l4: "r4", l5: "r5" } },
      { type: "blocks", domain: "Cybersécurité", points: 3, time_limit_s: 300, prompt: PRACTICAL_TEMPLATES.blocks.prompt, options: { ...clone(PRACTICAL_TEMPLATES.blocks.options), help: false }, correct: clone(PRACTICAL_TEMPLATES.blocks.correct) },
      { type: "sql", domain: "Cybersécurité", points: 2, time_limit_s: 300,
        prompt: "La supervision signale des connexions la nuit depuis l'étranger. Dans la table connexions, trouvez les comptes qui se sont connectés AVEC SUCCÈS entre 0 h et 5 h (0 h 00 à 4 h 59) depuis un autre pays que la France (FR). Affichez la colonne compte, une fois par compte.",
        options: { mode: "query", setup: B3_LOGS, show_tables: true, help: false },
        correct: { expected_sql: "SELECT DISTINCT compte FROM connexions WHERE succes = 1 AND pays <> 'FR' AND CAST(strftime('%H', heure) AS INTEGER) < 5;", ordered: false } },
      { type: "headers", domain: "Cybersécurité", points: 2, time_limit_s: 240,
        prompt: "Une utilisatrice a cliqué sur le lien de ce mail et vous l'a transféré. Avant de lancer la procédure, analysez ses en-têtes.",
        options: { ...clone(PRACTICAL_TEMPLATES.headers.options), view: "raw", help: false, ask: ["origin_ip", "spf", "dkim", "reply_to", "verdict"] },
        correct: { ...clone(PRACTICAL_TEMPLATES.headers.correct), dkim: "none" } },
      { type: "password", domain: "Systèmes", points: 1, time_limit_s: 120,
        prompt: "Vous créez le compte du nouveau collaborateur. Proposez un mot de passe initial conforme à la politique de l'entreprise (évitez un vrai mot de passe).",
        options: { mode: "create", help: false, policy: { min_length: 12, upper: true, lower: true, digit: true, symbol: true, min_score: 3, forbid: ["cybersup", "2026", "azerty"] } }, correct: null },
    ],
  },
};

function clone<T>(x: T): T { return JSON.parse(JSON.stringify(x)); }
