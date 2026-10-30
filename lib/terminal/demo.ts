import type { Scenario } from "./shell";

/**
 * Démo publique : « Serveur compromis ». Une enquête avec des missions
 * à accomplir en ligne de commande, vérifiées automatiquement.
 */
export const DEMO_SCENARIO: Scenario = {
  user: "recrue",
  hostname: "web-prod-01",
  home: "/home/recrue",
  motd:
    "ALERTE SOC : le serveur web-prod-01 consomme 98 % de CPU depuis cette nuit.\n" +
    "Tu es l'analyste d'astreinte. Lis ~/MISSION.txt puis remplis les missions (panneau de droite).\n" +
    "Tape « help » pour la liste des commandes.",
  files: {
    "/home/recrue/MISSION.txt":
      "Briefing\n--------\n" +
      "1. Trouve le processus qui mine de la cryptomonnaie et arrête-le.\n" +
      "2. Le mineur se relance via une tâche planifiée : repère le script et supprime-le.\n" +
      "3. Identifie l'IP de l'attaquant dans les journaux d'accès et note-la dans ~/rapport/ip.txt\n" +
      "   (crée le dossier rapport si besoin).\n" +
      "4. Le fichier ~/.ssh/id_rsa est lisible par tout le monde : corrige ses droits (600).\n" +
      "5. Bonus : un flag CYBER{...} est caché quelque part, encodé en base64.\n",
    "/home/recrue/.ssh/id_rsa": { content: "-----BEGIN OPENSSH PRIVATE KEY-----\n(clé de démonstration)\n-----END OPENSSH PRIVATE KEY-----\n", mode: "644" },
    "/home/recrue/.ssh/authorized_keys": "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIExemple recrue@laptop\n",
    "/home/recrue/notes.txt": "Penser à vérifier les tâches cron avec crontab -l.\nLes logs nginx sont dans /var/log/nginx.\n",
    "/var/log/nginx/access.log": [
      "10.0.0.4 - - [29/Oct/2026:21:02:11] \"GET / HTTP/1.1\" 200 512",
      "10.0.0.4 - - [29/Oct/2026:21:02:15] \"GET /login HTTP/1.1\" 200 834",
      "198.51.100.23 - - [29/Oct/2026:23:40:58] \"GET /admin HTTP/1.1\" 403 120",
      "198.51.100.23 - - [29/Oct/2026:23:41:02] \"GET /admin/../../etc/passwd HTTP/1.1\" 403 120",
      "198.51.100.23 - - [29/Oct/2026:23:41:13] \"POST /upload.php HTTP/1.1\" 200 64",
      "198.51.100.23 - - [29/Oct/2026:23:41:20] \"GET /uploads/shell.php?cmd=wget HTTP/1.1\" 200 18",
      "10.0.0.9 - - [30/Oct/2026:08:02:44] \"GET /favicon.ico HTTP/1.1\" 404 0",
      "10.0.0.4 - - [30/Oct/2026:08:03:01] \"GET / HTTP/1.1\" 200 512",
    ].join("\n") + "\n",
    "/var/log/auth.log": "Oct 29 23:39:01 sshd[811]: Failed password for root from 203.0.113.9\nOct 29 23:39:04 sshd[811]: Failed password for root from 203.0.113.9\n",
    "/var/www/html/uploads/shell.php": "<?php system($_GET['cmd']); ?>\n",
    "/tmp/.x/update.sh": { content: "#!/bin/bash\n# relance le mineur\n/tmp/.x/kworkerd --pool pool.minexmr.example:4444 &\n", mode: "755", owner: "recrue" },
    "/tmp/.x/kworkerd": { content: "(binaire)", mode: "755", owner: "recrue" },
    "/opt/backup/.cache": "Q1lCRVJ7cGVyc2lzdGFuY2VfZGVtYW50ZWxlZX0K\n",
    "/etc/hostname": "web-prod-01\n",
    "/etc/passwd": "root:x:0:0:root:/root:/bin/bash\nwww-data:x:33:33:www-data:/var/www:/usr/sbin/nologin\nrecrue:x:1000:1000:Recrue SOC:/home/recrue:/bin/bash\n",
    "/root/notes.txt": "Rien à voir ici.\n",
  },
  dirs: [{ path: "/tmp/.x", owner: "recrue" }],
  denied: ["/root"],
  processes: [
    { pid: 1, user: "root", cmd: "/sbin/init", cpu: 0.0, mem: 0.1 },
    { pid: 412, user: "root", cmd: "/usr/sbin/sshd -D", cpu: 0.0, mem: 0.3 },
    { pid: 733, user: "www-data", cmd: "nginx: worker process", cpu: 0.4, mem: 1.2 },
    { pid: 1337, user: "recrue", cmd: "/tmp/.x/kworkerd --pool pool.minexmr.example:4444", cpu: 97.8, mem: 12.4 },
    { pid: 2048, user: "recrue", cmd: "-bash", cpu: 0.0, mem: 0.2 },
  ],
  listen: [
    { port: 22, process: "sshd" },
    { port: 80, process: "nginx" },
    { port: 4444, process: "kworkerd", addr: "127.0.0.1" },
  ],
  interfaces: [{ name: "eth0", ip: "10.0.0.12/24" }],
  crontab: "*/5 * * * * /tmp/.x/update.sh >/dev/null 2>&1",
  sudo: ["cat", "ls"],
  objectives: [
    { id: "kill", title: "Arrêter le processus de minage", check: { type: "process_absent", name: "kworkerd" } },
    { id: "script", title: "Supprimer le script de relance", check: { type: "absent", path: "/tmp/.x/update.sh" } },
    { id: "ip", title: "Noter l'IP de l'attaquant dans ~/rapport/ip.txt", check: { type: "equals", path: "/home/recrue/rapport/ip.txt", text: "198.51.100.23" } },
    { id: "ssh", title: "Mettre ~/.ssh/id_rsa en 600", check: { type: "mode", path: "/home/recrue/.ssh/id_rsa", mode: "600" } },
  ],
};

/** Flag bonus du terminal de démo (vérifié côté serveur). */
export const DEMO_FLAG = "CYBER{persistance_demantelee}";
