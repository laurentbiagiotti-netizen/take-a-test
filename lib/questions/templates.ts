import { MISSIONS } from "./missions";
import { encodeForRecipe, type RecipeStep } from "./decode";
import { intrusionLogs } from "./evtx-scenario";
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
const MAIL_BODY = "Cher client,\n\nNous avons détecté une activité inhabituelle sur votre compte. Sans vérification de votre part dans les 24 heures, votre compte sera suspendu et vos cartes bloquées.\n\nMerci de confirmer votre identité en cliquant sur le bouton ci-dessous.\n\nLe service client Banque Horizon";
const MAIL_ASK = ["origin_ip", "spf", "reply_to", "verdict"] as const;
const MAIL_KEY = Object.fromEntries(MAIL_ASK.map((k) => [k, suggestKey(MAIL)[k]]));

export const PRACTICAL_TEMPLATES = {
  headers: {
    prompt: "Un étudiant a reçu ce mail et vous demande s'il doit cliquer. Analysez ses en-têtes.",
    options: { raw: MAIL, view: "table", ask: MAIL_ASK, help: true, body: MAIL_BODY, button: { label: "Vérifier mon compte", url: "https://banque-horizon.verif-compte-urgent.example/connexion" } },
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

export type PackQuestion = { type: string; prompt: string; domain: string; points: number; time_limit_s: number; options: any; correct: any; terminal?: { scenario: string; flag: string }; explanation?: string };

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

export const PACKS: Record<"b1" | "b3" | "m1", { label: string; minutes: number; questions: PackQuestion[] }> = {
  m1: { label: "Mastère : SOC et analyse", minutes: 35, questions: [] },
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

/* ---------------- Jeux de logique (B1) et simulations d'administration (B3) ---------------- */

export const SOKOBAN_LEVELS = [
  { map: "#######\n#  .  #\n#  $  #\n# @   #\n#######", par: 4 },
  { map: "######\n#    #\n# $$ #\n#.@ .#\n#    #\n######", par: 16 },
  { map: "########\n#  .   #\n# $##$ #\n#  @ . #\n########", par: 20 },
];
export const ROBOT_LEVELS = [
  { map: "..L.L", start: [0, 0] as [number, number], dir: 1 as const, main: 8, p1: 0 },
  { map: "L..L\n.##.\n.##.\nL..L", start: [0, 0] as [number, number], dir: 1 as const, main: 5, p1: 5 },
  { map: "L.###\n#L.##\n##L.#\n###L#", start: [0, 0] as [number, number], dir: 1 as const, main: 5, p1: 5 },
];

const AD_INITIAL = {
  domain: "ecole.local",
  ous: [
    { id: "ou-ecole", name: "Ecole", parent: null }, { id: "ou-users", name: "Utilisateurs", parent: "ou-ecole" },
    { id: "ou-compta", name: "Comptabilité", parent: "ou-users" }, { id: "ou-peda", name: "Pédagogie", parent: "ou-users" },
    { id: "ou-dir", name: "Direction", parent: "ou-users" }, { id: "ou-pc", name: "Ordinateurs", parent: "ou-ecole" },
    { id: "ou-anciens", name: "Anciens collaborateurs", parent: "ou-ecole" }, { id: "ou-groupes", name: "Groupes", parent: "ou-ecole" },
  ],
  users: [
    { sam: "m.durand", name: "Marie Durand", ou: "ou-compta", enabled: true, groups: ["GG_Compta"] },
    { sam: "k.martin", name: "Kevin Martin", ou: "ou-compta", enabled: true, groups: ["GG_Compta", "GG_VPN"] },
    { sam: "s.leroy", name: "Sophie Leroy", ou: "ou-peda", enabled: true, groups: ["GG_Pedagogie"] },
    { sam: "t.stagiaire", name: "Tom Stagiaire", ou: "ou-peda", enabled: true, groups: ["GG_Pedagogie", "GG_Admins_Locaux"] },
    { sam: "a.benali", name: "Amine Benali", ou: "ou-dir", enabled: true, groups: ["GG_Direction", "GG_VPN"] },
  ],
  groups: ["GG_Compta", "GG_Pedagogie", "GG_Direction", "GG_VPN", "GG_Admins_Locaux"].map((name) => ({ name, ou: "ou-groupes" })),
  gpos: [
    { name: "Fond d'écran de l'école", links: ["ou-ecole"] },
    { name: "Verrouillage de l'écran après 10 min", links: ["ou-users"] },
    { name: "Lecteur réseau Compta (S:)", links: [] },
  ],
};

export const EXTRA_TEMPLATES = {
  sokoban: {
    prompt: "Poussez toutes les caisses sur les cibles. On ne peut que pousser une caisse, pas la tirer. Flèches du clavier ou boutons ; « Annuler » revient d'un coup en arrière. Trois niveaux, du plus simple au plus difficile.",
    options: { levels: SOKOBAN_LEVELS, help: true }, correct: null, points: 3,
  },
  robot: {
    prompt: "Le robot doit allumer toutes les lampes (cases jaunes). Composez son programme avec les boutons, puis lancez-le. La case P1 est une petite routine que vous pouvez appeler plusieurs fois : elle évite de tout réécrire.",
    options: { levels: ROBOT_LEVELS, help: true }, correct: null, points: 3,
  },
  adsim: {
    prompt: "Vous êtes administrateur du domaine ecole.local. Traitez les demandes du jour dans la console Active Directory.",
    options: { initial: AD_INITIAL, help: false, tasks: [
      "Créez le compte de Julie Martin (identifiant j.martin) dans l'OU Comptabilité, avec un mot de passe à changer à la première connexion.",
      "Donnez-lui accès au partage de la comptabilité (groupe GG_Compta) et au VPN (groupe GG_VPN).",
      "Kevin Martin (k.martin) quitte l'école : désactivez son compte et rangez-le dans l'OU Anciens collaborateurs. Ne le supprimez pas.",
      "Le stagiaire t.stagiaire ne doit pas être administrateur des postes : retirez-le du groupe GG_Admins_Locaux.",
      "La GPO « Lecteur réseau Compta (S:) » doit s'appliquer aux seuls utilisateurs de la comptabilité : liez-la à la bonne OU.",
    ] },
    correct: { checks: [
      { kind: "exists", sam: "j.martin" }, { kind: "user_in_ou", sam: "j.martin", ou: "ou-compta" }, { kind: "must_change", sam: "j.martin" },
      { kind: "in_group", sam: "j.martin", group: "GG_Compta" }, { kind: "in_group", sam: "j.martin", group: "GG_VPN" },
      { kind: "disabled", sam: "k.martin" }, { kind: "user_in_ou", sam: "k.martin", ou: "ou-anciens" },
      { kind: "not_in_group", sam: "t.stagiaire", group: "GG_Admins_Locaux" },
      { kind: "gpo_linked", gpo: "Lecteur réseau Compta (S:)", ou: "ou-compta" },
      { kind: "enabled", sam: "m.durand" }, { kind: "in_group", sam: "m.durand", group: "GG_Compta" },
    ] },
    points: 4,
  },
  tickets: {
    prompt: "Vous arrivez au support à 9 h 15 : six tickets attendent. Pour chacun, indiquez l'impact, l'urgence et le groupe qui doit le traiter. La priorité se calcule toute seule, comme dans GLPI.",
    options: { help: false, groups: ["Support poste de travail (N1)", "Réseau et infrastructure (N2)", "Sécurité (RSSI)", "Applications métier"], tickets: [
      { id: "t1", title: "Plus aucun mail", from: "Accueil", text: "Depuis 9 h, personne dans l'école ne reçoit ni n'envoie de mails." },
      { id: "t2", title: "J'ai cliqué sur un lien", from: "Comptabilité", text: "J'ai cliqué sur le lien d'un mail « Microsoft » et j'ai tapé mon mot de passe. Depuis, j'ai des alertes de connexion." },
      { id: "t3", title: "Touche qui accroche", from: "Pédagogie", text: "La touche E de mon clavier accroche un peu, ce n'est pas urgent." },
      { id: "t4", title: "Imprimante du 2e étage", from: "Direction", text: "L'imprimante du 2e étage ne marche plus. Celle du 1er étage fonctionne." },
      { id: "t5", title: "Export de la paie en erreur", from: "Comptabilité", text: "Le logiciel de paie affiche une erreur à l'export. Les virements doivent partir demain matin." },
      { id: "t6", title: "Wi-Fi lent en B12", from: "Pédagogie", text: "Le Wi-Fi est très lent dans la salle B12 pendant les cours, les étudiants n'arrivent pas à charger leurs exercices." },
    ] },
    correct: {
      t1: { impact: "haute", urgence: "haute", groupe: "Réseau et infrastructure (N2)" },
      t2: { impact: "haute", urgence: "haute", groupe: "Sécurité (RSSI)" },
      t3: { impact: "basse", urgence: "basse", groupe: "Support poste de travail (N1)" },
      t4: { impact: "moyenne", urgence: "basse", groupe: "Support poste de travail (N1)" },
      t5: { impact: "moyenne", urgence: "haute", groupe: "Applications métier" },
      t6: { impact: "moyenne", urgence: "moyenne", groupe: "Réseau et infrastructure (N2)" },
    },
    points: 3,
  },
};

export const ALL_TEMPLATES: Record<string, unknown> = { ...PRACTICAL_TEMPLATES, ...EXTRA_TEMPLATES };

// Les jeux de logique rejoignent le pack B1, les simulations d'administration le pack B3.
PACKS.b1.questions.push(
  { type: "sokoban", domain: "Logique et raisonnement", points: 3, time_limit_s: 360, prompt: EXTRA_TEMPLATES.sokoban.prompt, options: clone(EXTRA_TEMPLATES.sokoban.options), correct: null },
  { type: "robot", domain: "Algorithmique", points: 3, time_limit_s: 360, prompt: EXTRA_TEMPLATES.robot.prompt, options: clone(EXTRA_TEMPLATES.robot.options), correct: null },
);
PACKS.b1.minutes = 32;
PACKS.b3.questions.push(
  { type: "adsim", domain: "Systèmes", points: 4, time_limit_s: 480, prompt: EXTRA_TEMPLATES.adsim.prompt, options: clone(EXTRA_TEMPLATES.adsim.options), correct: clone(EXTRA_TEMPLATES.adsim.correct) },
  { type: "tickets", domain: "Logique et diagnostic", points: 3, time_limit_s: 300, prompt: EXTRA_TEMPLATES.tickets.prompt, options: clone(EXTRA_TEMPLATES.tickets.options), correct: clone(EXTRA_TEMPLATES.tickets.correct) },
);
PACKS.b3.minutes = 38;

/** Mission Linux B1 : chasse au trésor guidée, toutes les commandes utiles sont expliquées à l'écran. */
export const B1_TERMINAL = {
  user: "explorateur", hostname: "cybersup-lab", home: "/home/explorateur",
  motd: [
    "Bienvenue sur un vrai terminal Linux (simulé). Ici, on parle à l'ordinateur en tapant des commandes, puis Entrée.",
    "Les 4 commandes dont vous avez besoin :",
    "  ls            liste ce qu'il y a dans le dossier où vous êtes",
    "  ls -a         la même chose, y compris les fichiers cachés (leur nom commence par un point)",
    "  cd dossier    entre dans un dossier ; cd ..  remonte d'un cran",
    "  cat fichier   affiche le contenu d'un fichier",
    "Commencez par : cat LISEZMOI.txt",
  ].join("\n"),
  files: {
    "/home/explorateur/LISEZMOI.txt": "Un agent a caché un code secret dans ce compte.\nIndice 1 : il est rangé quelque part dans le dossier « coffre ».\nIndice 2 : l'agent aime cacher ses fichiers (pensez à ls -a).\nQuand vous l'avez, recopiez le code (il commence par CYBER{) dans la case sous le terminal.\nBonus : créez un dossier nommé « rapport » dans votre dossier personnel (commande : mkdir rapport).\n",
    "/home/explorateur/coffre/etagere/carton.txt": "Rien ici, cherchez encore. Avez-vous essayé ls -a ?\n",
    "/home/explorateur/coffre/etagere/.boite_noire/code.txt": "Bravo ! Le code est : CYBER{l1nux_s4ns_p3ur}\n",
    "/home/explorateur/coffre/notes.txt": "L'étagère n'est pas aussi vide qu'elle en a l'air.\n",
  },
  objectives: [
    { id: "lire", title: "Lire le fichier LISEZMOI.txt", check: { type: "ran", command: "cat" } },
    { id: "cache", title: "Afficher les fichiers cachés avec ls -a", check: { type: "ran", command: "ls" } },
    { id: "dossier", title: "Créer le dossier « rapport »", check: { type: "exists", path: "/home/explorateur/rapport", kind: "dir" } },
  ],
};
PACKS.b1.questions.push({ type: "terminal", domain: "Fonctionnement du numérique", points: 3, time_limit_s: 420,
  prompt: "Chasse au trésor dans un terminal Linux : suivez les indications affichées, aucune connaissance n'est nécessaire.",
  options: null, correct: null, terminal: { scenario: JSON.stringify(B1_TERMINAL, null, 2), flag: "CYBER{l1nux_s4ns_p3ur}" } });
PACKS.b1.minutes = 39;

/* ---------------- Esprit critique (fake news) et culture informatique, pour les B1 ---------------- */

export const FEED_TEMPLATE = {
  prompt: "Ces publications circulent sur un réseau social. Pour chacune, dites si elle est fiable, douteuse (à vérifier avant de la croire) ou fausse, puis cochez les indices qui vous ont guidé. Cliquez sur le nom d'un compte pour voir son profil : c'est souvent là que se cache la réponse. Vous pouvez aussi aimer, partager ou signaler, comme sur un vrai réseau.",
  options: { help: true, ask_reason: true, posts: [
    { id: "f1", author: "Info Rapide 24", handle: "@inforapide24_", badge: "nouveau", age: "il y a 3 jours", date: "il y a 2 h",
      text: "🚨 URGENT !!! À partir de lundi, l'application MessaGo deviendra PAYANTE (4,99 €/mois) sauf si vous partagez ce message à 10 contacts. PARTAGEZ AVANT QUE CE SOIT SUPPRIMÉ !!!", stats: "18 400 partages",
      profile: { bio: "L'info AVANT tout le monde 🔥 Partagez !", created: "il y a 3 jours", followers: "112", following: "4 800", posts: [
        { date: "hier", text: "🚨 Le réseau Wi-Fi des trains sera coupé DÉFINITIVEMENT demain, PARTAGEZ !!!" },
        { date: "il y a 2 jours", text: "Votre forfait mobile va DOUBLER sauf si vous envoyez STOP à ce numéro 👉 …" }] } },
    { id: "f2", author: "Cybersup", handle: "@cybersup", badge: "officiel", date: "hier",
      text: "Maintenance de l'espace candidat samedi de 8 h à 10 h. Les inscriptions restent possibles ensuite. Merci de votre patience.",
      link: { title: "Planning des maintenances", url: "https://www.cybersup.ai/maintenance" }, stats: "42 j'aime",
      profile: { bio: "École de cybersécurité et d'intelligence artificielle.", created: "en mars 2021", followers: "8 900", following: "310", posts: [
        { date: "il y a 4 jours", text: "Portes ouvertes le 15 novembre : venez rencontrer nos formateurs." }] } },
    { id: "f3", author: "Aide Étudiants France", handle: "@aide_etudiants_fr2026", badge: "nouveau", age: "il y a 1 semaine", date: "il y a 5 h",
      text: "Bonne nouvelle 🎉 L'État verse une prime numérique de 500 € à TOUS les étudiants. Inscrivez-vous avant minuit avec votre numéro de carte bancaire pour la recevoir.",
      link: { title: "Prime numérique étudiante : inscription", url: "https://prime-etudiant-gouv.info-officiel.co/inscription" }, stats: "9 100 partages",
      profile: { bio: "Les bons plans pour les étudiants 💸", created: "il y a 1 semaine", followers: "57", following: "2 300", posts: [
        { date: "il y a 3 jours", text: "Gagnez un téléphone dernier cri : il suffit de remplir ce formulaire avec votre adresse et votre date de naissance 📱" }] } },
    { id: "f4", author: "Actu Jeunes", handle: "@actujeunes", date: "il y a 1 jour",
      text: "Selon une étude, les jeunes qui jouent aux jeux vidéo ont de meilleures notes en maths. 🎮➕📈", stats: "31 000 j'aime",
      profile: { bio: "Tendances, buzz et vidéos qui font parler.", created: "en 2019", followers: "240 000", following: "120", posts: [
        { date: "il y a 2 jours", text: "Les chats comprendraient leur prénom, selon des chercheurs 😺" }] } },
    { id: "f5", author: "Le Quotidien du Numérique", handle: "@quotidien_numerique", badge: "media", date: "il y a 3 h",
      text: "Une faille de sécurité dans l'application MessaGo a été corrigée. L'éditeur recommande d'installer la dernière mise à jour depuis le magasin d'applications.",
      link: { title: "Faille dans MessaGo : ce qu'il faut faire", url: "https://www.quotidien-numerique.fr/securite/faille-messago-corrigee" }, stats: "1 200 partages",
      profile: { bio: "Journal en ligne consacré au numérique. Rédaction à Paris.", created: "en 2012", followers: "410 000", following: "900", posts: [
        { date: "hier", text: "Ce que change la nouvelle loi sur les données personnelles, expliqué simplement." }] } },
    { id: "f6", author: "Le Quotidien du Numérique", handle: "@quotidien_numerique_officiel_", badge: "nouveau", age: "il y a 2 jours", date: "il y a 40 min",
      text: "INCROYABLE 😱 Un célèbre youtubeur arrêté pour piratage, regardez la vidéo avant qu'elle soit censurée !",
      link: { title: "La vidéo choc", url: "https://quotidien-numerique.fr.actu-choc.net/video" }, stats: "5 600 partages",
      profile: { bio: "Compte officiel ✅✅", created: "il y a 2 jours", followers: "31", following: "5 000", posts: [
        { date: "hier", text: "😱 Une star de la télé ruinée, regardez avant suppression !" }] } },
    { id: "f7", author: "Thomas", handle: "@thomas_du_75", date: "il y a 6 h",
      text: "Il paraît qu'Internet va être coupé dans toute la France ce week-end pour une maintenance. Quelqu'un a des infos ?", stats: "230 réponses",
      profile: { bio: "Fan de foot et de jeux vidéo.", created: "en 2017", followers: "180", following: "260", posts: [
        { date: "il y a 3 jours", text: "Quelqu'un a testé le nouveau jeu de course ? Ça vaut le coup ?" }] } },
    { id: "f8", author: "Ville de Lyon", handle: "@villedelyon", badge: "officiel", date: "il y a 4 h",
      text: "Travaux : le pont Lafayette sera fermé aux voitures du 12 au 16 novembre. Les bus et les vélos pourront toujours passer.",
      link: { title: "Fermeture du pont Lafayette", url: "https://www.lyon.fr/actualite/travaux/pont-lafayette" }, stats: "860 partages",
      profile: { bio: "Compte officiel de la Ville de Lyon.", created: "en 2010", followers: "320 000", following: "540", posts: [
        { date: "hier", text: "Collecte des encombrants samedi dans le 7e arrondissement." }] } },
    { id: "f9", author: "Météo Choc", handle: "@meteo_choc", date: "il y a 1 h",
      text: "😢 Regardez ces images terribles des inondations d'hier soir à Marseille. Personne n'en parle !!",
      image: "Photo : une rue inondée, des voitures dans l'eau jusqu'aux fenêtres.", stats: "12 300 partages",
      profile: { bio: "Les images météo les plus folles.", created: "en août 2026", followers: "2 100", following: "3 900", posts: [
        { date: "il y a 2 semaines", text: "😢 Regardez ces images terribles des inondations à Nice. Personne n'en parle !! (même photo de rue inondée)" },
        { date: "il y a 2 mois", text: "Inondations à Bordeaux ce matin 😢 (même photo de rue inondée)" }] } },
    { id: "f10", author: "Dr Julien Marchand", handle: "@dr_julien_sante", badge: "nouveau", age: "il y a 2 semaines", date: "il y a 3 h",
      text: "Je suis médecin : ce complément naturel guérit la grippe en 24 h, les laboratoires ne veulent pas que vous le sachiez. -50 % avec mon code JULIEN50 !",
      link: { title: "Boutique officielle", url: "https://super-immunite-shop.biz/julien50" }, stats: "3 400 j'aime",
      profile: { bio: "Médecin 👨‍⚕️ Santé naturelle. Codes promo en lien.", created: "il y a 2 semaines", followers: "640", following: "7 100", posts: [
        { date: "il y a 5 jours", text: "Ce thé détox fait perdre 5 kg en une semaine, code JULIEN50 🍵" },
        { date: "il y a 1 semaine", text: "Les vaccins contre la grippe ne servent à rien, la nature suffit !" }] } },
  ] },
  correct: {
    verdicts: { f1: "faux", f2: "fiable", f3: "faux", f4: "douteux", f5: "fiable", f6: "faux", f7: "douteux", f8: "fiable", f9: "faux", f10: "faux" },
    reasons: {
      f1: ["urgence", "compte_recent"], f2: ["source_fiable", "lien_coherent"], f3: ["donnees", "lien_suspect", "trop_beau", "compte_recent"],
      f4: ["sans_source"], f5: ["source_fiable", "lien_coherent"], f6: ["imitation", "lien_suspect", "compte_recent", "trop_beau"],
      f7: ["sans_source"], f8: ["source_fiable", "lien_coherent"], f9: ["deja_vu", "urgence"], f10: ["vend", "trop_beau", "lien_suspect", "compte_recent"],
    },
  },
  points: 4,
};
(ALL_TEMPLATES as any).feed = FEED_TEMPLATE;

const q = (id: string, prompt: string, opts: string[], good: number[], explanation: string): PackQuestion => ({
  type: good.length > 1 ? "mcq_multi" : "mcq_single", domain: "Culture informatique", points: 1, time_limit_s: 45, prompt, explanation,
  options: opts.map((text, i) => ({ id: `${id}${"abcdef"[i]}`, text })), correct: good.map((i) => `${id}${"abcdef"[i]}`),
});
export const CULTURE_B1: PackQuestion[] = [
  q("c1", "Que garantit le petit cadenas à côté de l'adresse d'un site ?", ["Que le site est honnête", "Que la connexion entre vous et le site est chiffrée", "Que le site est gouvernemental", "Que le site n'a pas de publicité"], [1], "Le cadenas (HTTPS) chiffre la connexion. Un faux site peut très bien en avoir un : il ne prouve pas que le site est honnête."),
  q("c2", "Lequel de ces noms est un moteur de recherche ?", ["Firefox", "Qwant", "Windows", "Bluetooth"], [1], "Qwant est un moteur de recherche (comme Google). Firefox est un navigateur, Windows un système d'exploitation."),
  q("c3", "Lequel de ces logiciels est un système d'exploitation ?", ["Linux", "Word", "Google", "YouTube"], [0], "Le système d'exploitation (Linux, Windows, macOS, Android) fait fonctionner l'ordinateur et ses programmes."),
  q("c4", "Que veut dire « open source » pour un logiciel ?", ["Il est forcément gratuit et sans bug", "Son code source est public : chacun peut le lire, le modifier et le partager", "Il ne fonctionne qu'en ligne", "Il a été créé par un gouvernement"], [1], "Open source = code public et réutilisable selon une licence. Linux, Firefox ou VLC sont open source."),
  q("c5", "Combien de bits contient un octet ?", ["2", "8", "10", "1 000"], [1], "Un octet = 8 bits. Un bit vaut 0 ou 1."),
  q("c6", "À quoi sert la mémoire vive (RAM) d'un ordinateur ?", ["À garder vos photos quand l'ordinateur est éteint", "À stocker temporairement ce que l'ordinateur est en train d'utiliser", "À se connecter au Wi-Fi", "À refroidir le processeur"], [1], "La RAM est la mémoire de travail, effacée à l'extinction. Les fichiers sont gardés sur le disque (SSD ou disque dur)."),
  q("c7", "Que signifie « stocker ses fichiers dans le cloud » ?", ["Les garder sur une clé USB", "Les envoyer sur des serveurs d'une entreprise, accessibles par Internet", "Les supprimer définitivement", "Les imprimer"], [1], "Le cloud, ce sont les ordinateurs (serveurs) de quelqu'un d'autre, auxquels on accède par Internet."),
  q("c8", "Quel est le rôle d'une adresse IP ?", ["Identifier une machine sur un réseau", "Protéger un compte par un mot de passe", "Accélérer la connexion", "Afficher les pages web"], [0], "Comme une adresse postale, l'adresse IP permet aux données de trouver la bonne machine."),
  q("c9", "Alan Turing est célèbre pour :", ["Avoir créé Facebook", "Ses travaux fondateurs de l'informatique et le décryptage d'Enigma pendant la Seconde Guerre mondiale", "Avoir inventé le Wi-Fi", "Avoir fondé Apple"], [1], "Alan Turing est l'un des pères de l'informatique ; son équipe a cassé le chiffrement allemand Enigma."),
  q("c10", "D'où vient le mot « bug » en informatique ?", ["D'un insecte retrouvé coincé dans un ordinateur en 1947", "D'un logiciel appelé Bug", "Du nom d'un pirate", "D'une marque de clavier"], [0], "En 1947, l'équipe de Grace Hopper a trouvé un papillon de nuit coincé dans le calculateur Mark II et l'a noté comme premier « bug »."),
  q("c11", "Cochez les bons réflexes face à un mail qui vous demande votre mot de passe (plusieurs réponses) :", ["Cliquer vite pour ne pas perdre son compte", "Vérifier l'adresse de l'expéditeur", "Aller sur le site en tapant soi-même son adresse", "Répondre avec son mot de passe"], [1, 2], "Un service sérieux ne demande jamais votre mot de passe par mail. On vérifie l'expéditeur et on passe par le site officiel."),
  q("c12", "Qu'est-ce qu'un « hacker éthique » ?", ["Un pirate qui vole des données", "Un spécialiste qui cherche les failles avec l'accord de l'entreprise, pour les faire corriger", "Un logiciel antivirus", "Un réseau social"], [1], "Le hacker éthique (ou pentesteur) teste la sécurité avec autorisation, pour protéger."),
];

PACKS.b1.questions.push({ type: "feed", domain: "Réflexes cyber", points: 4, time_limit_s: 480, prompt: FEED_TEMPLATE.prompt, options: clone(FEED_TEMPLATE.options), correct: clone(FEED_TEMPLATE.correct) }, ...CULTURE_B1);
PACKS.b1.minutes = 56;

/* ---------------- Mastère : enquête dans l'Observateur d'événements Windows ---------------- */
export const EVTX_TEMPLATE = {
  prompt: "Ticket du SOC : « le compte de Jeanne Dupont (j.dupont) se verrouille tous les matins vers 8 h ». Vous avez les journaux du contrôleur de domaine. Trouvez la cause, puis vérifiez s'il ne s'est rien passé d'autre pendant la nuit du 26 au 27 octobre.",
  options: { help: false, logs: intrusionLogs(), questions: [
    { id: "lock_time", label: "Heure du verrouillage du compte le 27 octobre (événement 4740)", placeholder: "hh:mm:ss" },
    { id: "lock_pc", label: "Nom du poste d'où viennent les échecs de connexion de j.dupont", placeholder: "PC-…" },
    { id: "rdp_user", label: "Compte utilisé pour la connexion à distance (RDP) réussie depuis Internet", placeholder: "nom du compte" },
    { id: "rdp_ip", label: "Adresse IP de l'attaquant", placeholder: "x.x.x.x" },
    { id: "new_user", label: "Compte créé par l'attaquant pour garder un accès", placeholder: "nom du compte" },
    { id: "service", label: "Nom du service installé par l'attaquant (journal Système)", placeholder: "nom du service" },
  ] },
  correct: { lock_time: ["07:58:12", "7:58:12"], lock_pc: "PC-COMPTA-07", rdp_user: ["admin.local", "ECOLE\\admin.local"], rdp_ip: "203.0.113.47", new_user: "svc_backup2", service: "UpdaterSvc" },
  points: 6,
};
(ALL_TEMPLATES as any).evtx = EVTX_TEMPLATE;

// Pack Mastère : enquête SOC sur journaux Windows, puis exercices plus offensifs autorisés à ce niveau.
PACKS.m1.questions.push(
  { type: "evtx", domain: "Cybersécurité", points: 6, time_limit_s: 600, prompt: EVTX_TEMPLATE.prompt, options: clone(EVTX_TEMPLATE.options), correct: clone(EVTX_TEMPLATE.correct) },
  { type: "headers", domain: "Cybersécurité", points: 2, time_limit_s: 240, prompt: "Ce mail a été signalé par un utilisateur. Analysez ses en-têtes bruts.",
    options: { ...clone(PRACTICAL_TEMPLATES.headers.options), view: "raw", help: false, ask: ["origin_ip", "spf", "dkim", "dmarc", "reply_to", "verdict"] },
    correct: { ...clone(PRACTICAL_TEMPLATES.headers.correct), dkim: "none", dmarc: "fail" } },
  { type: "sql", domain: "Cybersécurité", points: 2, time_limit_s: 240, prompt: "Ce formulaire de connexion construit sa requête en collant directement ce que tape l'utilisateur. Connectez-vous en tant qu'admin sans connaître son mot de passe.",
    options: { mode: "injection", help: false, setup: "CREATE TABLE comptes (login TEXT, mdp TEXT, role TEXT);\nINSERT INTO comptes VALUES ('admin', 'Xk9!pq2#Lm', 'administrateur'), ('j.dupont', 'Soleil2026', 'utilisateur');",
      template: "SELECT login, role FROM comptes WHERE login = '{input}' AND mdp = 'mot_de_passe_inconnu'", field_label: "Identifiant" },
    correct: { must_contain: "administrateur" } },
  { type: "subnet", domain: "Réseaux", points: 3, time_limit_s: 300, prompt: "Segmentez le réseau du nouveau site entre les services, sans gaspiller d'adresses.",
    options: { mode: "vlsm", services: 4, help: false }, correct: null },
);

// ---------- Scripts Bash (just-bash) : B3 administration, Mastère analyse de journaux ----------
function authLog(rows: [string, string, number][]) {
  const out: string[] = []; let pid = 2100, sec = 0;
  const stamp = () => { sec += 37; const h = 2 + Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s = sec % 60; return `Oct  6 ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`; };
  const queue: string[] = [];
  for (const [user, ip, n] of rows) for (let i = 0; i < n; i++) queue.push(n > 0 && user.startsWith("+") ? `Accepted password for ${user.slice(1)} from ${ip} port ${40000 + i} ssh2` : `Failed password for ${user} from ${ip} port ${50000 + pid % 900 + i} ssh2`);
  for (let i = 0; i < queue.length; i++) { const j = (i * 7) % queue.length; [queue[i], queue[j]] = [queue[j], queue[i]]; }
  for (const l of queue) out.push(`${stamp()} srv-web sshd[${pid++}]: ${l}`);
  return out.join("\n") + "\n";
}
function accessLog(rows: [string, string, number][]) {
  const out: string[] = []; let k = 0;
  for (const [ip, path, status] of rows) out.push(`${ip} - - [06/Oct/2026:10:${String(10 + (k++ % 50)).padStart(2, "0")}:0${k % 10} +0200] "GET ${path} HTTP/1.1" ${status} ${status === 200 ? 5120 + k : 196} "-" "Mozilla/5.0"`);
  return out.join("\n") + "\n";
}

export const BASH_TEMPLATES = {
  ssh: {
    prompt: "Script Bash : rapport des échecs de connexion SSH",
    domain: "Scripting et programmation", points: 3, time_limit_s: 480,
    options: {
      help: false, starter: "#!/bin/bash\n\n",
      mission: "Le serveur web reçoit des tentatives de connexion SSH (journal logs/auth.log). Écrivez un script qui :\n1. crée le fichier rapport.txt avec, pour chaque adresse IP qui a échoué, le nombre d'échecs puis l'IP, de la plus active à la moins active (exemple de ligne : 5 185.220.101.4) ;\n2. affiche à l'écran uniquement le nombre total d'échecs (un nombre seul).\nVotre script sera aussi lancé sur d'autres journaux : il doit fonctionner quel que soit le contenu.",
      files: { "logs/auth.log": authLog([["root", "185.220.101.4", 5], ["admin", "45.155.205.12", 3], ["+j.martin", "10.0.0.25", 2], ["test", "10.0.0.99", 1]]) },
      checks: [{ label: "Le fichier rapport.txt est créé" }, { label: "rapport.txt : bon nombre d'échecs par IP, du plus grand au plus petit" }, { label: "Le total des échecs est affiché" }],
    },
    correct: {
      solution: "grep \"Failed password\" logs/auth.log | awk '{print $(NF-3)}' | sort | uniq -c | sort -rn > rapport.txt\ngrep -c \"Failed password\" logs/auth.log",
      checks: [
        { label: "Le fichier rapport.txt est créé", kind: "exists", path: "rapport.txt" },
        { label: "rapport.txt : bon nombre d'échecs par IP, du plus grand au plus petit", kind: "file", path: "rapport.txt", compare: "lines" },
        { label: "Le total des échecs est affiché", kind: "stdout", compare: "lines" },
      ],
      variants: [{ "logs/auth.log": authLog([["oracle", "203.0.113.7", 7], ["+s.leroy", "10.0.0.31", 3], ["ubuntu", "198.51.100.23", 4], ["pi", "192.0.2.44", 2], ["root", "10.0.0.8", 1]]) }],
    },
  },
  rangement: {
    prompt: "Script Bash : sauvegarde des configurations et nettoyage du cache",
    domain: "Systèmes", points: 3, time_limit_s: 420,
    options: {
      help: false, starter: "#!/bin/bash\n\n",
      mission: "Avant une mise à jour de l'application (dossier app/), écrivez un script qui :\n1. crée le dossier sauvegarde/ et y copie tous les fichiers .conf de app/config (pas les .bak) ;\n2. supprime tous les fichiers .tmp de app/cache, sans toucher aux autres fichiers ;\n3. affiche à l'écran uniquement le nombre de fichiers copiés (un nombre seul).\nVotre script sera aussi lancé sur d'autres dossiers : n'écrivez pas les noms de fichiers à la main.",
      files: {
        "app/config/web.conf": "listen 8080\nroot /srv/www\n", "app/config/db.conf": "host=10.0.0.12\nport=5432\n", "app/config/web.conf.bak": "listen 80\n",
        "app/cache/session-1.tmp": "x", "app/cache/session-2.tmp": "x", "app/cache/LISEZMOI.txt": "Ne pas supprimer ce fichier.\n", "app/logs/app.log": "démarrage OK\n",
      },
      checks: [{ label: "sauvegarde/ contient exactement les fichiers .conf" }, { label: "app/cache ne contient plus que les fichiers à garder" }, { label: "Le nombre de fichiers copiés est affiché" }],
    },
    correct: {
      solution: "mkdir -p sauvegarde\ncp app/config/*.conf sauvegarde/\nrm -f app/cache/*.tmp\nls sauvegarde | wc -l",
      checks: [
        { label: "sauvegarde/ contient exactement les fichiers .conf", kind: "tree", path: "sauvegarde" },
        { label: "app/cache ne contient plus que les fichiers à garder", kind: "tree", path: "app/cache" },
        { label: "Le nombre de fichiers copiés est affiché", kind: "stdout", compare: "lines" },
      ],
      variants: [{
        "app/config/web.conf": "listen 8080\n", "app/config/db.conf": "host=db\n", "app/config/web.conf.bak": "listen 80\n",
        "app/config/mail.conf": "smtp=10.0.0.20\n", "app/config/vpn.conf": "port=1194\n", "app/config/ancien.conf.bak": "x\n",
        "app/cache/cache-a.tmp": "x", "app/cache/cache-b.tmp": "x", "app/cache/cache-c.tmp": "x", "app/cache/important.dat": "garder\n",
      }],
    },
  },
  scanners: {
    prompt: "Script Bash : bloquer les scanners de vulnérabilités web",
    domain: "Cybersécurité", points: 3, time_limit_s: 480,
    options: {
      help: false, starter: "#!/bin/bash\n\n",
      mission: "Le journal du serveur web (logs/access.log, format Apache : l'IP en 1re colonne, le code HTTP en 9e) montre des robots qui cherchent des pages d'administration. Écrivez un script qui :\n1. écrit dans blocklist.txt, une par ligne et triées, les IP qui ont provoqué au moins 3 erreurs 404 ;\n2. affiche à l'écran uniquement le nombre d'IP bloquées (un nombre seul).\nVotre script sera aussi lancé sur d'autres journaux.",
      files: { "logs/access.log": accessLog([
        ["198.51.100.14", "/", 200], ["203.0.113.5", "/wp-login.php", 404], ["203.0.113.5", "/phpmyadmin/", 404], ["198.51.100.14", "/contact", 200],
        ["203.0.113.5", "/.env", 404], ["192.0.2.80", "/favicon.ico", 404], ["203.0.113.5", "/admin", 404], ["45.155.205.3", "/.git/config", 404],
        ["45.155.205.3", "/backup.zip", 404], ["192.0.2.80", "/", 200], ["45.155.205.3", "/config.php", 404], ["198.51.100.14", "/robots.txt", 404],
        ["198.51.100.14", "/plan", 404],
      ]) },
      checks: [{ label: "blocklist.txt contient les bonnes IP, triées" }, { label: "Le nombre d'IP bloquées est affiché" }],
    },
    correct: {
      solution: "awk '$9 == 404 {print $1}' logs/access.log | sort | uniq -c | awk '$1 >= 3 {print $2}' | sort > blocklist.txt\nwc -l < blocklist.txt",
      checks: [
        { label: "blocklist.txt contient les bonnes IP, triées", kind: "file", path: "blocklist.txt", compare: "lines" },
        { label: "Le nombre d'IP bloquées est affiché", kind: "stdout", compare: "lines" },
      ],
      variants: [{ "logs/access.log": accessLog([
        ["10.1.1.1", "/", 200], ["185.7.7.7", "/xmlrpc.php", 404], ["185.7.7.7", "/wp-admin", 404], ["185.7.7.7", "/.aws/credentials", 404],
        ["185.7.7.7", "/shell.php", 404], ["10.1.1.1", "/oups", 404], ["10.1.1.1", "/encore", 404], ["91.92.93.94", "/a", 404],
        ["91.92.93.94", "/b", 404], ["91.92.93.94", "/c", 404], ["10.2.2.2", "/x", 404],
      ]) }],
    },
  },
};
(ALL_TEMPLATES as any).bash = { prompt: BASH_TEMPLATES.ssh.prompt, options: BASH_TEMPLATES.ssh.options, correct: BASH_TEMPLATES.ssh.correct, points: 3 };
for (const [k, t] of [["b3", BASH_TEMPLATES.ssh], ["b3", BASH_TEMPLATES.rangement], ["m1", BASH_TEMPLATES.scanners]] as const) {
  PACKS[k].questions.push({ type: "bash", domain: t.domain, points: t.points, time_limit_s: t.time_limit_s, prompt: t.prompt, options: clone(t.options), correct: clone(t.correct) });
  PACKS[k].minutes += Math.round(t.time_limit_s / 60);
}

// Missions de terminal Linux : 2 de plus en B1, 2 en B3, 1 en Mastère (le décodage a été retiré des packs).
for (const m of MISSIONS) {
  PACKS[m.level].questions.push({ type: "terminal", domain: m.domain, points: m.scenario.objectives?.length || 1, time_limit_s: m.minutes * 60,
    prompt: m.prompt, options: null, correct: null, terminal: { scenario: JSON.stringify(m.scenario, null, 2), flag: "" } });
  PACKS[m.level].minutes += m.minutes;
}
PACKS.b1.minutes -= 4;
PACKS.m1.minutes -= 5;
