import Link from "next/link";
import { RuleIcon } from "@/components/exam/ui";

const STEPS = [
  { n: "1", t: "Créez votre compte", d: "Avec l'adresse e-mail qui a reçu votre convocation." },
  { n: "2", t: "Testez votre matériel", d: "La veille, sur la page d'essai : caméra, plein écran, types de questions." },
  { n: "3", t: "Passez l'épreuve", d: "Ouvrez le lien de la convocation et saisissez votre code d'accès personnel." },
];

const NEEDS = [
  { icon: "screen", t: "Un ordinateur", d: "Pas de téléphone ni de tablette, un seul écran." },
  { icon: "camera", t: "Une webcam", d: "Elle reste allumée pendant toute l'épreuve." },
  { icon: "clock", t: "Du temps devant vous", d: "Le chrono ne s'arrête pas, même si vous fermez la page." },
  { icon: "lock", t: "Un endroit calme", d: "Seul(e), sans aide extérieure ni autre fenêtre ouverte." },
];

const TEAM = [
  "Chrono, infractions et correction décidés par le serveur",
  "Deux variantes par question : un sujet différent par candidat",
  "Caméra analysée, photos et journal infalsifiable",
  "Double authentification de l'équipe",
];

export default function Home() {
  return (
    <main className="max-w-6xl mx-auto px-6 py-14 space-y-14">
      <section className="max-w-3xl">
        <h1 className="font-display uppercase text-4xl md:text-5xl leading-[1.05]">
          <span className="text-accent">Tests d&apos;admission</span><br />
          <span className="text-fg">Cybersup</span>
        </h1>
        <p className="mt-5 text-lg text-muted max-w-2xl">
          Vous êtes convoqué(e) à une épreuve en ligne : QCM, énigmes et, selon le programme, une mission sur une machine Linux.
          Voici comment ça se passe.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/login" className="btn">Accéder à mon épreuve</Link>
          <Link href="/demo" className="btn-secondary">Faire l&apos;essai</Link>
        </div>
      </section>

      <section aria-labelledby="etapes">
        <h2 id="etapes" className="h2">En trois étapes</h2>
        <ol className="mt-4 grid md:grid-cols-3 gap-4">
          {STEPS.map((s) => (
            <li key={s.n} className="card flex gap-4">
              <span className="font-display text-3xl text-accent leading-none">{s.n}</span>
              <div>
                <div className="font-medium text-fg">{s.t}</div>
                <p className="text-sm text-muted mt-1">{s.d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="besoins">
        <h2 id="besoins" className="h2">Ce qu&apos;il vous faut</h2>
        <ul className="mt-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {NEEDS.map((n) => (
            <li key={n.t} className="card flex gap-3">
              <span className="shrink-0 w-9 h-9 rounded-md bg-accent/10 text-accent flex items-center justify-center"><RuleIcon name={n.icon} /></span>
              <div>
                <div className="font-medium text-fg">{n.t}</div>
                <p className="text-sm text-muted mt-1">{n.d}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-t border-line pt-8" aria-labelledby="equipe">
        <h2 id="equipe" className="text-sm font-medium text-muted">Pour l&apos;équipe pédagogique</h2>
        <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
          {TEAM.map((t) => <li key={t} className="flex items-center gap-2"><span aria-hidden className="w-1.5 h-1.5 rounded-full bg-accent" />{t}</li>)}
        </ul>
      </section>
    </main>
  );
}
