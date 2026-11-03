/** Modèles prêts à l'emploi pour les simulations (type « sim »). */
import type { FwPacket } from "./firewall";

export type SimTemplate = { level: "b1" | "b3" | "m1"; domain: string; points: number; minutes: number; prompt: string; options: any; correct: any };

/* ---------------------------------------------------------------- B1 */

export const SIM_PRIVACY: SimTemplate = {
  level: "b1", domain: "Réflexes cyber", points: 4, minutes: 6,
  prompt: "Léa, 17 ans, vous prête son téléphone : son compte sur l'appli photo est grand ouvert. Protégez-la en réglant son compte comme le ferait une personne prudente. Explorez tous les écrans de l'appli (profil, publications, demandes, réglages).",
  options: {
    kind: "privacy", help: false,
    account: { name: "Léa Martin", handle: "lea.mrtn", followers: "1 204", following: "380",
      bio: "📍 12 rue des Lilas, Lille · 📞 06 12 34 56 78 · Lycée Jean-Moulin, terminale 🎓" },
    posts: [
      { id: "p1", art: "identite", caption: "Enfin ma nouvelle carte d'identité 😎", likes: 87 },
      { id: "p2", art: "coucher", caption: "Coucher de soleil sur la plage 🌅", likes: 214 },
      { id: "p3", art: "maison", caption: "Notre nouvelle maison !! 🏡 (on emménage samedi)", likes: 152 },
      { id: "p4", art: "chat", caption: "Mochi fait la sieste 😴", likes: 341 },
      { id: "p5", art: "billet", caption: "Départ pour Barcelone demain 6 h, la maison sera vide une semaine ✈️", likes: 98 },
    ],
    requests: [
      { id: "r1", name: "Cadeaux Gratuits Officiel", handle: "cadeaux.gratuits.0fficiel", info: "0 publication · 3 abonnés · compte créé cette semaine" },
      { id: "r2", name: "Inès Bernard", handle: "ines.brnd", info: "14 amis en commun · dans la même classe" },
      { id: "r3", name: "Agence Mannequins Paris", handle: "agence.mannequins.casting", info: "« Tu es très jolie, envoie-nous des photos en privé »" },
    ],
    settings: { private: false, location: true, messages: "tous", tags: "tous", activity: true, twofa: false },
  },
  correct: {
    settings: { private: true, location: false, messages: "abonnes", tags: "abonnes", activity: false, twofa: true },
    deleted: ["p1", "p3", "p5"], kept: ["p2", "p4"],
    requests: { r1: "refuse", r2: "accept", r3: "refuse" },
    bio_forbid: ["rue des lilas", "06 12", "0612"],
  },
};

export const SIM_OSINT: SimTemplate = {
  level: "b1", domain: "Réflexes cyber", points: 4, minutes: 6,
  prompt: "Exercice autorisé : Marc a accepté qu'on teste la sécurité de sa messagerie. Elle permet de réinitialiser le mot de passe en répondant à des questions secrètes. Lisez son profil public, puis essayez de répondre à sa place. Enfin, dites ce qui l'aurait protégé.",
  options: {
    kind: "osint", help: false,
    profile: { name: "Marc Lemoine", handle: "marc.lemoine.photo", bio: "Photographe amateur 📷 · Breton dans l'âme · papa de deux loulous", followers: "642",
      posts: [
        { date: "il y a 3 jours", art: "chien", text: "Il y a 9 ans aujourd'hui, Caramel entrait dans ma vie 🐶 Mon tout premier chien, toujours là ❤️" },
        { date: "il y a 2 semaines", art: "phare", text: "Week-end à Quimper, ma ville natale. Rien ne vaut la Bretagne 🌊 #quimper #bzh" },
        { date: "il y a 1 mois", text: "Retrouvailles avec les anciens de l'école primaire Jules-Ferry, 30 ans après ! On n'a pas changé (ou presque) 😂" },
        { date: "il y a 2 mois", art: "gateau", text: "45 ans aujourd'hui 🎂 Merci pour tous vos messages !" },
      ] },
    mail: { brand: "Mailo", email: "marc.lemoine@mailo.example" },
    questions: [
      { id: "animal", label: "Quel est le nom de votre premier animal de compagnie ?" },
      { id: "ville", label: "Dans quelle ville êtes-vous né ?" },
      { id: "ecole", label: "Comment s'appelait votre école primaire ?" },
    ],
    choices: [
      { id: "a", text: "Mettre une majuscule au début de chaque réponse" },
      { id: "b", text: "Donner des réponses inventées (que lui seul connaît, notées dans un gestionnaire de mots de passe) et activer la double authentification" },
      { id: "c", text: "Changer de question secrète pour « Quelle est votre date de naissance ? »" },
      { id: "d", text: "Publier seulement le week-end" },
    ],
  },
  correct: { answers: { animal: "Caramel", ville: "Quimper", ecole: ["Jules-Ferry", "Jules Ferry", "école Jules-Ferry", "ecole jules ferry", "école primaire Jules-Ferry", "JulesFerry"] }, choice: "b" },
};

/* ---------------------------------------------------------------- B3 */

export const SIM_PATCH: SimTemplate = {
  level: "b3", domain: "Réseaux", points: 4, minutes: 7,
  prompt: "Ticket #2063 : le premier étage vient d'être recâblé et plus rien ne marche. Brassez chaque prise murale vers un port du switch SW-ETAGE1 qui appartient au bon VLAN, d'après la documentation du switch. Un port ne reçoit qu'un seul câble, et le port 24 (liaison montante) ne doit pas être utilisé.",
  options: {
    kind: "patch", help: false,
    vlans: [
      { id: 10, name: "VLAN 10 · Comptabilité", color: "#3b82f6" }, { id: 20, name: "VLAN 20 · Pédagogie", color: "#22c55e" },
      { id: 30, name: "VLAN 30 · Téléphonie IP", color: "#a855f7" }, { id: 99, name: "VLAN 99 · Wi-Fi invités", color: "#f59e0b" },
    ],
    ports: [
      ...[1, 2, 3, 4, 5, 6].map((n) => ({ n, vlan: 10 })), ...[7, 8, 9, 10, 11, 12].map((n) => ({ n, vlan: 20 })),
      ...[13, 14, 15, 16].map((n) => ({ n, vlan: 30 })), ...[17, 18, 19, 20].map((n) => ({ n, vlan: 99 })),
      ...[21, 22, 23].map((n) => ({ n, vlan: 20 })), { n: 24, vlan: "trunk" },
    ],
    plugs: [
      { id: "B101-1", label: "B101-1", device: "PC de la comptable", vlan: 10 },
      { id: "B101-2", label: "B101-2", device: "Téléphone IP de la compta", vlan: 30 },
      { id: "B102-1", label: "B102-1", device: "PC du formateur, salle B102", vlan: 20 },
      { id: "B102-2", label: "B102-2", device: "Vidéoprojecteur, salle B102", vlan: 20 },
      { id: "B103-1", label: "B103-1", device: "Imprimante de la compta", vlan: 10 },
      { id: "ACC-1", label: "ACC-1", device: "Borne Wi-Fi invités, accueil", vlan: 99 },
      { id: "ACC-2", label: "ACC-2", device: "Téléphone IP de l'accueil", vlan: 30 },
    ],
  },
  correct: null,
};

const FW_PACKETS: FwPacket[] = [
  { id: "w1", label: "Visiteur du site (HTTPS)", src_ip: "88.12.4.9", dst_port: 443, protocol: "tcp", expected: "allow" },
  { id: "w2", label: "Visiteur du site (HTTP)", src_ip: "77.141.2.30", dst_port: 80, protocol: "tcp", expected: "allow" },
  { id: "w3", label: "Admin depuis le réseau d'administration (SSH)", src_ip: "10.0.99.14", dst_port: 22, protocol: "tcp", expected: "allow" },
  { id: "w4", label: "Robot sur Internet (SSH)", src_ip: "185.220.101.7", dst_port: 22, protocol: "tcp", expected: "block" },
  { id: "w5", label: "Poste du LAN élèves (SSH)", src_ip: "10.0.20.55", dst_port: 22, protocol: "tcp", expected: "block" },
  { id: "w6", label: "Supervision (SNMP)", src_ip: "10.0.99.5", dst_port: 161, protocol: "udp", expected: "allow" },
  { id: "w7", label: "SNMP depuis Internet", src_ip: "45.83.64.2", dst_port: 161, protocol: "udp", expected: "block" },
  { id: "w8", label: "Base de données depuis Internet", src_ip: "45.83.64.2", dst_port: 3306, protocol: "tcp", expected: "block" },
  { id: "w9", label: "RDP depuis Internet", src_ip: "91.92.93.94", dst_port: 3389, protocol: "tcp", expected: "block" },
  { id: "w10", label: "HTTPS depuis le LAN élèves", src_ip: "10.0.20.12", dst_port: 443, protocol: "tcp", expected: "allow" },
];

export const SIM_FWWEB: SimTemplate = {
  level: "b3", domain: "Cybersécurité", points: 4, minutes: 8,
  prompt: "Ticket #2071 : le serveur web de l'école (srv-dmz, 10.0.1.10) vient d'être placé en DMZ. Configurez les règles du pare-feu pour ce serveur, puis appliquez. Le pare-feu bloque tout ce qu'aucune règle n'autorise, et les règles sont lues de haut en bas.",
  options: {
    kind: "fwweb", help: false,
    ticket: [
      "Le site doit être accessible à tout le monde en HTTP (80) et HTTPS (443).",
      "SSH (22) seulement depuis le réseau d'administration 10.0.99.0/24.",
      "La supervision 10.0.99.5 interroge le serveur en SNMP (UDP 161).",
      "Rien d'autre : ni base de données, ni bureau à distance depuis l'extérieur.",
    ],
    rules: [{ action: "pass", proto: "any", src: "any", port: "any", descr: "Règle temporaire de l'installateur (tout autoriser)" }],
    samples: FW_PACKETS.slice(0, 6).map((p) => ({ id: p.id, label: p.label, src_ip: p.src_ip, dst_port: p.dst_port, protocol: p.protocol })),
  },
  correct: { packets: FW_PACKETS },
};

type Pkt = { no: number; t: string; src: string; dst: string; proto: string; len: number; info: string; details?: string[]; stream?: number };
const P = (no: number, t: string, src: string, dst: string, proto: string, len: number, info: string, details?: string[], stream?: number): Pkt => ({ no, t, src, dst, proto, len, info, details, stream });
const FTP = (no: number, t: string, src: string, dst: string, info: string) => P(no, t, src, dst, "FTP", 60 + info.length, info,
  [`Transmission Control Protocol, Src: ${src}, Dst: ${dst}`, "File Transfer Protocol (FTP)", `    ${info}\\r\\n`], 1);

export const SIM_PCAP: SimTemplate = {
  level: "b3", domain: "Réseaux", points: 4, minutes: 8,
  prompt: "Le RSSI a capturé le trafic du poste de la comptabilité (10.0.10.23) pendant qu'il envoie le fichier de paie au prestataire. Analysez la capture : filtrez, ouvrez les paquets, suivez le flux, puis répondez.",
  options: {
    kind: "pcap", help: false, file: "poste-compta.pcapng",
    packets: [
      P(1, "0.000000", "10.0.10.23", "10.0.10.1", "ARP", 42, "Who has 10.0.10.1? Tell 10.0.10.23"),
      P(2, "0.000412", "10.0.10.1", "10.0.10.23", "ARP", 60, "10.0.10.1 is at 00:1a:2b:3c:4d:5e"),
      P(3, "0.010220", "10.0.10.23", "10.0.0.53", "DNS", 78, "Standard query 0x4f1a A ftp.prestataire-paie.example", ["Domain Name System (query)", "    Queries: ftp.prestataire-paie.example: type A, class IN"]),
      P(4, "0.031877", "10.0.0.53", "10.0.10.23", "DNS", 94, "Standard query response 0x4f1a A 203.0.113.80", ["Domain Name System (response)", "    Answers: ftp.prestataire-paie.example: type A, addr 203.0.113.80"]),
      P(5, "0.032400", "10.0.10.23", "203.0.113.80", "TCP", 66, "51544 → 21 [SYN] Seq=0 Win=64240", ["Transmission Control Protocol, Src Port: 51544, Dst Port: 21"], 1),
      P(6, "0.051002", "203.0.113.80", "10.0.10.23", "TCP", 66, "21 → 51544 [SYN, ACK] Seq=0 Ack=1", undefined, 1),
      P(7, "0.051300", "10.0.10.23", "203.0.113.80", "TCP", 54, "51544 → 21 [ACK] Seq=1 Ack=1", undefined, 1),
      FTP(8, "0.072115", "203.0.113.80", "10.0.10.23", "Response: 220 Bienvenue sur le serveur FTP du prestataire"),
      P(9, "0.080011", "10.0.10.23", "142.250.75.238", "TLSv1.3", 571, "Client Hello (SNI=www.google.com)", ["Transport Layer Security", "    Handshake Protocol: Client Hello", "    Contenu chiffré : illisible"]),
      FTP(10, "0.081930", "10.0.10.23", "203.0.113.80", "Request: USER compta.ecole"),
      FTP(11, "0.101245", "203.0.113.80", "10.0.10.23", "Response: 331 Password required for compta.ecole"),
      FTP(12, "0.102877", "10.0.10.23", "203.0.113.80", "Request: PASS Paie#Novembre26"),
      FTP(13, "0.130554", "203.0.113.80", "10.0.10.23", "Response: 230 User compta.ecole logged in"),
      P(14, "0.131002", "10.0.10.23", "142.250.75.238", "TLSv1.3", 1290, "Application Data", ["Transport Layer Security", "    Application Data Protocol: Contenu chiffré"]),
      FTP(15, "0.140301", "10.0.10.23", "203.0.113.80", "Request: STOR paie_novembre_2026.xlsx"),
      FTP(16, "0.161722", "203.0.113.80", "10.0.10.23", "Response: 150 Opening data connection"),
      P(17, "0.170044", "10.0.10.23", "10.0.0.53", "DNS", 70, "Standard query 0x77b2 A intranet.ecole.local"),
      P(18, "0.171003", "10.0.0.53", "10.0.10.23", "DNS", 86, "Standard query response 0x77b2 A 10.0.0.30"),
      P(19, "0.180877", "10.0.10.23", "10.0.0.30", "HTTP", 412, "GET /planning HTTP/1.1", ["Hypertext Transfer Protocol", "    GET /planning HTTP/1.1\\r\\n", "    Host: intranet.ecole.local\\r\\n"]),
      P(20, "0.190112", "10.0.0.30", "10.0.10.23", "HTTP", 1514, "HTTP/1.1 200 OK (text/html)"),
      FTP(21, "0.240661", "203.0.113.80", "10.0.10.23", "Response: 226 Transfer complete"),
      FTP(22, "0.241900", "10.0.10.23", "203.0.113.80", "Request: QUIT"),
    ],
    questions: [
      { id: "proto", label: "Quel protocole transporte un mot de passe en clair ?", placeholder: "nom du protocole" },
      { id: "serveur", label: "Adresse IP du serveur qui reçoit ce mot de passe", placeholder: "x.x.x.x" },
      { id: "user", label: "Identifiant utilisé", placeholder: "identifiant" },
      { id: "pass", label: "Mot de passe intercepté", placeholder: "mot de passe" },
      { id: "fichier", label: "Nom du fichier envoyé", placeholder: "nom du fichier" },
    ],
    choices: [
      { id: "a", text: "Garder FTP mais changer le mot de passe chaque mois" },
      { id: "b", text: "Passer à SFTP (ou FTPS) : la connexion et les identifiants sont chiffrés" },
      { id: "c", text: "Envoyer le fichier par HTTP plutôt que par FTP" },
      { id: "d", text: "Compresser le fichier en .zip avant l'envoi" },
    ],
  },
  correct: { answers: { proto: "FTP", serveur: "203.0.113.80", user: "compta.ecole", pass: "Paie#Novembre26", fichier: "paie_novembre_2026.xlsx" }, choice: "b" },
};

export const SIM_TEMPLATES: Record<string, SimTemplate> = { privacy: SIM_PRIVACY, osint: SIM_OSINT, patch: SIM_PATCH, fwweb: SIM_FWWEB, pcap: SIM_PCAP };
