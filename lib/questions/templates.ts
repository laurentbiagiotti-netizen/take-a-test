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
