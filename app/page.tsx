import Link from "next/link";

const POINTS = [
  { n: "01", t: "Navigateur verrouillé", d: "Safe Exam Browser vérifié sur chaque requête, clé propre à chaque examen." },
  { n: "02", t: "Surveillance serveur", d: "Chrono, infractions et clôture décidés par le serveur, jamais par le navigateur." },
  { n: "03", t: "Un sujet par candidat", d: "Tirage dans une banque de questions, ordre mélangé, terminal Linux intégré." },
  { n: "04", t: "Traçabilité", d: "Journal inaltérable, vérification d'identité, double authentification du staff." },
];

export default function Home() {
  return (
    <main className="max-w-6xl mx-auto px-6 py-16">
      <section className="max-w-3xl">
        <h1 className="font-display uppercase text-4xl md:text-5xl leading-[1.05]">
          <span className="text-accent">Examens surveillés</span><br />
          <span className="text-fg">tests d&apos;admission</span>
        </h1>
        <p className="mt-5 text-lg text-muted max-w-2xl">
          La plateforme d&apos;évaluation de Cybersup : QCM, réponses rédigées et défis en terminal Linux,
          dans un environnement verrouillé et contrôlé de bout en bout.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/login" className="btn">Accéder à mes examens</Link>
          <Link href="/demo" className="btn-secondary">Essayer la démo</Link>
        </div>
      </section>

      <section className="mt-16 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {POINTS.map((p) => (
          <div key={p.n} className="card">
            <div className="font-display text-3xl text-accent">{p.n}</div>
            <div className="h2 mt-3">{p.t}</div>
            <p className="text-sm text-muted mt-2">{p.d}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
