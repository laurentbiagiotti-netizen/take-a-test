import type { EvEvent, EvLevel } from "./evtx";
import { rng, int, pick } from "./seed";

/**
 * Scénario Mastère : un compte se verrouille tous les matins… et, en cherchant,
 * on découvre une intrusion nocturne (RDP depuis Internet, compte créé, ajout aux
 * administrateurs, service installé). Journaux générés de façon déterministe, avec du bruit.
 */
const DC = "SRV-DC01.ecole.local";
export function intrusionLogs(): EvEvent[] {
  const r = rng("evtx-mastere-v1");
  const ev: Omit<EvEvent, "rid">[] = [];
  const add = (log: string, level: EvLevel, time: string, source: string, eventId: number, task: string, message: string, data: Record<string, string> = {}, computer = DC) =>
    ev.push({ log, level, time, source, eventId, task, computer, message, data });
  const sec = "Microsoft-Windows-Security-Auditing";
  const users = ["m.durand", "s.leroy", "a.benali", "k.martin", "c.morel", "l.garcia"];
  const pcs = ["PC-COMPTA-03", "PC-PEDA-11", "PC-DIR-01", "PC-PEDA-04", "PC-ACCUEIL-02"];
  // Bruit : ouvertures de session normales sur 3 jours
  for (const day of ["25", "26", "27"]) {
    for (let i = 0; i < 14; i++) {
      const u = pick(r, users), pc = pick(r, pcs), h = int(r, 7, 18), m = int(r, 0, 59);
      const t = `2026-10-${day} ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(int(r, 0, 59)).padStart(2, "0")}`;
      add("Sécurité", "Succès de l'audit", t, sec, 4624, "Logon", `L'ouverture de session d'un compte s'est correctement déroulée.\n\nType d'ouverture de session : 3\nNom du compte : ${u}\nDomaine : ECOLE\nNom de la station de travail : ${pc}\nAdresse du réseau source : 10.20.${int(r, 1, 9)}.${int(r, 10, 200)}`, { TargetUserName: u, LogonType: "3", WorkstationName: pc });
    }
    add("Système", "Information", `2026-10-${day} 06:00:${int(r, 10, 59)}`, "Service Control Manager", 7036, "Aucune", "Le service Windows Update est entré dans l'état : en cours d'exécution.");
    add("Application", "Information", `2026-10-${day} 06:30:0${int(r, 1, 9)}`, "VSS", 8224, "Aucune", "Le service de cliché instantané des volumes est arrêté en raison du délai d'inactivité.");
  }
  // Le compte j.dupont se verrouille chaque matin depuis PC-COMPTA-07 (ancien mot de passe enregistré)
  for (const day of ["25", "26", "27"]) {
    for (let i = 0; i < 5; i++) {
      const t = `2026-10-${day} 07:5${5 + Math.floor(i / 2)}:${String(10 + i * 9).padStart(2, "0")}`;
      add("Sécurité", "Échec de l'audit", t, sec, 4625, "Logon", `Échec d'ouverture de session d'un compte.\n\nType d'ouverture de session : 3\nCompte pour lequel l'ouverture de session a échoué :\n  Nom du compte : j.dupont\n  Domaine : ECOLE\nInformations sur l'échec :\n  Raison de l'échec : nom d'utilisateur inconnu ou mot de passe incorrect.\n  Statut : 0xC000006D  Sous-état : 0xC000006A\nInformations sur le réseau :\n  Nom de la station de travail : PC-COMPTA-07\n  Adresse du réseau source : 10.20.4.37`, { TargetUserName: "j.dupont", WorkstationName: "PC-COMPTA-07", IpAddress: "10.20.4.37", SubStatus: "0xC000006A" });
    }
    add("Sécurité", "Succès de l'audit", `2026-10-${day} ${day === "25" ? "07:58:01" : day === "26" ? "07:57:44" : "07:58:12"}`, sec, 4740, "User Account Management", `Le compte d'un utilisateur a été verrouillé.\n\nCompte verrouillé :\n  Nom du compte : j.dupont\nInformations supplémentaires :\n  Nom de l'ordinateur appelant : PC-COMPTA-07`, { TargetUserName: "j.dupont", CallerComputerName: "PC-COMPTA-07" });
  }
  // Nuit du 26 au 27 : intrusion
  for (let i = 0; i < 12; i++) add("Sécurité", "Échec de l'audit", `2026-10-27 03:0${Math.floor(i / 3)}:${String(5 + i * 4).padStart(2, "0")}`, sec, 4625, "Logon", `Échec d'ouverture de session d'un compte.\n\nType d'ouverture de session : 10\nCompte pour lequel l'ouverture de session a échoué :\n  Nom du compte : ${pick(r, ["administrateur", "admin", "admin.local", "backup"])}\nInformations sur le réseau :\n  Nom de la station de travail : -\n  Adresse du réseau source : 203.0.113.47`, { LogonType: "10", IpAddress: "203.0.113.47" });
  add("Sécurité", "Succès de l'audit", "2026-10-27 03:04:51", sec, 4624, "Logon", "L'ouverture de session d'un compte s'est correctement déroulée.\n\nType d'ouverture de session : 10\nNom du compte : admin.local\nDomaine : ECOLE\nNom de la station de travail : -\nAdresse du réseau source : 203.0.113.47", { TargetUserName: "admin.local", LogonType: "10", IpAddress: "203.0.113.47" });
  add("Sécurité", "Succès de l'audit", "2026-10-27 03:09:17", sec, 4720, "User Account Management", "Un compte d'utilisateur a été créé.\n\nSujet :\n  Nom du compte : admin.local\nNouveau compte :\n  Nom du compte : svc_backup2", { SubjectUserName: "admin.local", TargetUserName: "svc_backup2" });
  add("Sécurité", "Succès de l'audit", "2026-10-27 03:09:40", sec, 4732, "Security Group Management", "Un membre a été ajouté à un groupe local dont la sécurité est activée.\n\nSujet :\n  Nom du compte : admin.local\nMembre :\n  Nom du compte : svc_backup2\nGroupe :\n  Nom du groupe : Administrateurs", { MemberName: "svc_backup2", TargetUserName: "Administrateurs" });
  add("Système", "Information", "2026-10-27 03:12:05", "Service Control Manager", 7045, "Aucune", "Un service a été installé dans le système.\n\nNom du service : UpdaterSvc\nNom du fichier du service : C:\\Users\\Public\\upd.exe\nType de service : service en mode utilisateur\nType de démarrage du service : démarrage automatique\nCompte de service : LocalSystem", { ServiceName: "UpdaterSvc", ImagePath: "C:\\Users\\Public\\upd.exe" });
  add("Application", "Erreur", "2026-10-26 14:22:10", "Application Error", 1000, "(100)", "Nom de l'application défaillante : comptapro.exe, version : 12.4.0\nCode d'exception : 0xc0000005");
  add("Système", "Avertissement", "2026-10-26 22:40:03", "Microsoft-Windows-Time-Service", 129, "Aucune", "NtpClient n'a pas pu définir un homologue de domaine à utiliser comme source de temps.");
  return ev.sort((a, b) => a.time.localeCompare(b.time)).map((e, i) => ({ ...e, rid: 48210 + i }));
}
