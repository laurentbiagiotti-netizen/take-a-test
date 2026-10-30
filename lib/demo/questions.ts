import type { QType } from "@/lib/questions/kinds";

/**
 * Questions de la démo publique. Les clés restent sur le serveur : la page
 * ne reçoit que la partie publique, la correction passe par /api/demo/grade.
 */
type DemoQ = { id: string; type: QType; prompt: string; points: number; options: any; key: any };

export const DEMO_QUESTIONS: DemoQ[] = [
  {
    id: "d-qcm", type: "mcq_single", points: 1,
    prompt: "Quelle commande affiche aussi les fichiers cachés d'un dossier ?",
    options: [{ id: "a", text: "ls -l" }, { id: "b", text: "ls -a" }, { id: "c", text: "ls -h" }, { id: "d", text: "ls -r" }],
    key: ["b"],
  },
  {
    id: "d-order", type: "ordering", points: 2,
    prompt: "Remettez dans l'ordre les étapes de la réponse à un incident de sécurité.",
    options: [
      { id: "o1", text: "Détecter et qualifier l'alerte" },
      { id: "o2", text: "Contenir : isoler la machine du réseau" },
      { id: "o3", text: "Éradiquer : supprimer la porte dérobée" },
      { id: "o4", text: "Restaurer le service depuis une sauvegarde saine" },
      { id: "o5", text: "Rédiger le retour d'expérience" },
    ],
    key: ["o1", "o2", "o3", "o4", "o5"],
  },
  {
    id: "d-match", type: "matching", points: 2,
    prompt: "Associez chaque port à son service.",
    options: {
      left: [{ id: "l22", text: "22" }, { id: "l53", text: "53" }, { id: "l443", text: "443" }, { id: "l3389", text: "3389" }],
      right: [{ id: "rssh", text: "SSH" }, { id: "rdns", text: "DNS" }, { id: "rhttps", text: "HTTPS" }, { id: "rrdp", text: "Bureau à distance (RDP)" }],
    },
    key: { l22: "rssh", l53: "rdns", l443: "rhttps", l3389: "rrdp" },
  },
  {
    id: "d-phish", type: "hotspot", points: 2,
    prompt: "Ce mail est un hameçonnage. Cliquez sur tous les indices qui le trahissent.",
    options: {
      layout: "email", multi: true,
      header: { from: "Service Client <securite@cybersup-ecole.co>", to: "vous@cybersup.ai", subject: "URGENT : votre compte étudiant sera supprimé", date: "jeu. 30 oct. 2026, 03:12" },
      segments: [
        { id: "p1", text: "Expéditeur : securite@cybersup-ecole.co" },
        { id: "p2", text: "Bonjour cher(e) étudiant(e)," },
        { id: "p3", text: "Suite à une activité inhabituelle, votre compte sera SUPPRIMÉ dans 2 heures." },
        { id: "p4", text: "Pour l'éviter, confirmez votre mot de passe sur : http://cybersup-login.verif-compte.ru" },
        { id: "p5", text: "Merci de votre compréhension." },
        { id: "p6", text: "Pièce jointe : releve_notes.pdf.exe" },
        { id: "p7", text: "L'équipe pédagogique" },
      ],
    },
    key: ["p1", "p3", "p4", "p6"],
  },
  {
    id: "d-code", type: "hotspot", points: 1,
    prompt: "Ce code de connexion est vulnérable. Cliquez sur la ligne fautive.",
    options: {
      layout: "code", multi: false,
      segments: [
        { id: "c1", text: "def login(request):" },
        { id: "c2", text: "    user = request.form['user']" },
        { id: "c3", text: "    pwd = request.form['password']" },
        { id: "c4", text: "    sql = \"SELECT * FROM users WHERE name='\" + user + \"' AND pass='\" + pwd + \"'\"" },
        { id: "c5", text: "    row = db.execute(sql).fetchone()" },
        { id: "c6", text: "    return redirect('/home') if row else abort(401)" },
      ],
    },
    key: ["c4"],
  },
  {
    id: "d-data", type: "short_answer", points: 2,
    prompt: "Voici un extrait des connexions au VPN. Quel compte s'est connecté depuis le plus grand nombre de pays différents ?",
    options: {
      placeholder: "nom du compte",
      data: {
        kind: "table", columns: ["horodatage", "compte", "pays", "résultat"],
        rows: [
          ["08:01", "a.martin", "FR", "succès"], ["08:14", "l.durand", "FR", "succès"], ["09:02", "a.martin", "FR", "succès"],
          ["09:40", "s.benali", "FR", "succès"], ["10:05", "l.durand", "BR", "échec"], ["10:06", "l.durand", "RU", "échec"],
          ["10:07", "l.durand", "VN", "succès"], ["11:30", "s.benali", "FR", "succès"], ["12:12", "a.martin", "BE", "succès"],
        ],
      },
    },
    key: { answers: ["l.durand"], case_sensitive: false },
  },
];

/** Partie publique, avec étapes et colonne de droite mélangées (jamais dans l'ordre correct). */
export function publicDemoQuestions() {
  const shuffle = <T,>(a: T[]): T[] => {
    for (let t = 0; t < 8; t++) {
      const b = [...a];
      for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
      if (b.some((x, i) => x !== a[i])) return b;
    }
    return [...a].reverse();
  };
  return DEMO_QUESTIONS.map(({ key: _k, ...q }) => {
    if (q.type === "ordering") return { ...q, options: shuffle(q.options) };
    if (q.type === "matching") return { ...q, options: { left: q.options.left, right: shuffle(q.options.right) } };
    return q;
  });
}
