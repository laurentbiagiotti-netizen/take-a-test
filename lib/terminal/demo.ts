import type { Scenario } from "./shell";

/**
 * Scénario de la démo publique : une petite enquête ludique pour découvrir
 * le terminal. Les flags restent côté serveur (vérifiés par /api/demo/check).
 */
export const DEMO_SCENARIO: Scenario = {
  user: "recrue",
  hostname: "cybersup-lab",
  home: "/home/recrue",
  motd: "Bienvenue sur le serveur d'entraînement Cybersup. Tapez « help » pour la liste des commandes.",
  files: {
    "/home/recrue/LISEZMOI.txt":
      "Mission : un intrus a laissé des traces sur ce serveur.\nRetrouve les 3 flags au format CYBER{...}.\n1. Un fichier caché dort dans ton dossier personnel.\n2. Les journaux du serveur web racontent une drôle d'histoire.\n3. Le dernier message a été encodé... pour ne pas être lu trop vite.\n",
    "/home/recrue/.flag_cache": "Bien joué, les fichiers cachés commencent par un point.\nCYBER{ls_-a_revele_tout}\n",
    "/home/recrue/notes/todo.txt": "- relire les logs dans /var/log\n- penser à grep\n",
    "/var/log/nginx/access.log":
      "10.0.0.4 - - [29/Oct/2026:09:12:01] \"GET / HTTP/1.1\" 200\n10.0.0.4 - - [29/Oct/2026:09:12:07] \"GET /login HTTP/1.1\" 200\n203.0.113.66 - - [29/Oct/2026:23:41:13] \"GET /admin?debug=CYBER{grep_trouve_l_aiguille} HTTP/1.1\" 403\n10.0.0.9 - - [30/Oct/2026:08:02:44] \"GET /favicon.ico HTTP/1.1\" 404\n",
    "/var/log/auth.log": "Oct 29 23:40:58 sshd[811]: Failed password for root from 203.0.113.66\nOct 29 23:41:02 sshd[811]: Failed password for root from 203.0.113.66\n",
    "/tmp/.msg": "Q1lCRVJ7YmFzZTY0X25lX2NhY2hlX3JpZW59Cg==\n",
    "/etc/hostname": "cybersup-lab\n",
    "/etc/motd": "Accès réservé. Toute activité est journalisée.\n",
    "/root/secret.txt": "Raté : ce dossier est réservé à root.\n",
  },
  denied: ["/root"],
  env: { INDICE: "regarde dans /tmp" },
};

export const DEMO_FLAGS: Record<string, string> = {
  cache: "CYBER{ls_-a_revele_tout}",
  logs: "CYBER{grep_trouve_l_aiguille}",
  b64: "CYBER{base64_ne_cache_rien}",
};

export const DEMO_CHALLENGES = [
  { id: "cache", title: "Fichier caché", hint: "Les fichiers cachés n'apparaissent qu'avec une option de ls." },
  { id: "logs", title: "Journaux web", hint: "Cherche « CYBER » dans les journaux de /var/log." },
  { id: "b64", title: "Message encodé", hint: "Un fichier caché de /tmp contient du base64 : base64 -d." },
];
