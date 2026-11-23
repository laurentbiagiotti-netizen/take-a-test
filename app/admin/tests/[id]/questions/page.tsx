"use client";
import { notify } from "@/components/Toaster";
import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Field, Num, Section, Toggle, inputCls } from "@/components/admin/form";
import { useClasses } from "@/lib/admin/classes";
import StudentPreview from "@/components/admin/StudentPreview";
import { createClient } from "@/lib/supabase/client";
import { genCode } from "@/lib/security/tokens";
import TypeEditor from "@/components/admin/TypeEditor";
import { ALL_TEMPLATES, PACKS, type PackKey } from "@/lib/questions/templates";
import { validateQuestion, TYPE_LABEL as KIND_LABEL } from "@/lib/questions/kinds";
import { TOOLS } from "@/lib/external/tools";
import { checkKey } from "@/lib/external/grade";
import ExcelTools from "@/components/admin/ExcelTools";
import ExamFileTools from "@/components/admin/ExamFileTools";
import ImportFromTests from "@/components/admin/ImportFromTests";
import BankPicker from "@/components/admin/BankPicker";
import { normLevel } from "@/lib/admin/bank";
import { loadDrafts } from "@/lib/admin/load-questions";
import { writeQuestions } from "@/lib/admin/save-questions";
import DylanBank, { type BankQuestion } from "@/components/admin/DylanBank";
import { shortClass } from "@/lib/exam/convocation";

type QType = "mcq_single" | "mcq_multi" | "long_text" | "terminal" | "ordering" | "matching" | "hotspot" | "short_answer" | "external" | "sql" | "decode" | "password" | "blocks" | "headers" | "subnet" | "netpuzzle" | "sokoban" | "robot" | "adsim" | "tickets" | "feed" | "evtx" | "bash" | "sim";
type ExternalDraft = { tool: string; label: string; time_limit_min: string; scenario: string; answer_key: string };
const FUN_TYPES: QType[] = ["ordering", "matching", "hotspot", "short_answer", "sql", "decode", "password", "blocks", "headers", "subnet", "netpuzzle", "sokoban", "robot", "adsim", "tickets", "feed", "evtx", "bash", "sim"];
type Option = { id: string; text: string; image_url?: string | null };
type Question = {
  id?: string; test_id: string; position: number; type: QType;
  prompt: string; options: Option[] | any; correct: string[] | any;
  points: number; image_url?: string | null;
  domain?: string | null; variant_group?: string | null;
  explanation?: string | null; time_limit_s?: number | null;
  terminal?: { scenario: string; flag: string } | null;
  external?: ExternalDraft | null;
  difficulty?: string | null;
};


export default function EditTest() {
  const { id } = useParams<{ id: string }>();
  const supabase = createClient();
  const [test, setTest] = useState<any>(null);
  const [secrets, setSecrets] = useState<any>({ access_code: null, seb_browser_exam_keys: [], seb_config_keys: [], seb_quit_password_hash: null });
  const [quitPwd, setQuitPwd] = useState("");
  const [locked, setLocked] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [saving, setSaving] = useState(false);
  const [auto, setAuto] = useState<{ state: "idle" | "dirty" | "saving" | "saved" | "invalid"; at?: number; msg?: string }>({ state: "idle" });
  const [now, setNow] = useState(Date.now());
  const [tick, setTick] = useState(0);
  const [drag, setDrag] = useState<number | null>(null);
  const savedRef = useRef(""); const loadedRef = useRef(false); const busyRef = useRef(false); const againRef = useRef(false);
  const [openQ, setOpenQ] = useState<Set<number>>(new Set());
  const [qFilter, setQFilter] = useState("");
  const [qType, setQType] = useState("");
  const toggleQ = (i: number) => setOpenQ((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; });
  const domains = Array.from(new Set(questions.map((q) => q.domain?.trim()).filter(Boolean) as string[])).sort();
  const [link, setLink] = useState("");
  const classes = useClasses();
  const vue = useSearchParams()?.get("vue") === "reglages" ? "reglages" : "questions";
  const [panel, setPanel] = useState<null | "add" | "import">(null);
  const [preview, setPreview] = useState<Question | null>(null);

  // Compte rendu d'un import (lignes écartées, colonnes non reconnues)
  useEffect(() => {
    const msg = new URLSearchParams(window.location.search).get("import");
    if (msg) { notify(msg, "info"); window.history.replaceState(null, "", window.location.pathname); }
  }, []);

  useEffect(() => {
    (async () => {
      const { data: t } = await supabase.from("tests").select("*").eq("id", id).single();
      setTest(t);
      const { data: sec } = await supabase.from("test_secrets").select("*").eq("test_id", id).maybeSingle();
      if (sec) setSecrets(sec);
      // Les copies d'aperçu (« Tester l'épreuve ») ne verrouillent pas les questions
      const { data: started } = await supabase.from("attempts").select("candidate:profiles(email)").eq("test_id", id).neq("status", "pending");
      const { data: previews } = await supabase.from("invites").select("email").eq("test_id", id).eq("preview", true);
      const previewEmails = new Set((previews || []).map((p: any) => p.email));
      setLocked((started || []).some((a: any) => !previewEmails.has(a.candidate?.email)));
      const withKeys = await loadDrafts(supabase as any, id);
      savedRef.current = JSON.stringify(withKeys); loadedRef.current = true;
      setQuestions(withKeys);
      setLink(`${window.location.origin}/test/${id}`);
    })();
  }, [id, supabase]);

  const updateTest = async (patch: any) => {
    setTest((t: any) => ({ ...t, ...patch }));
    const { error } = await supabase.from("tests").update(patch).eq("id", id);
    setMsg(error ? `Erreur : ${error.message}` : null);
  };

  const updateSecrets = async (patch: any) => {
    const next = { ...secrets, ...patch, test_id: id };
    setSecrets(next);
    // Le sel SEB n'est jamais réécrit depuis l'interface (il fixe les Browser Exam Keys).
    const { seb_exam_key_salt: _salt, ...payload } = next;
    const { error } = await supabase.from("test_secrets").upsert(payload);
    setMsg(error ? `Erreur : ${error.message}` : null);
  };

  const generateCode = () => updateSecrets({ access_code: genCode() });

  const keyList = (v: string) => v.split(/[\s,]+/).map((x) => x.trim().toLowerCase()).filter((x) => /^[a-f0-9]{64}$/.test(x));

  const saveQuitPassword = async () => {
    if (!quitPwd) return updateSecrets({ seb_quit_password_hash: null });
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(quitPwd));
    const hex = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
    await updateSecrets({ seb_quit_password_hash: hex });
    setQuitPwd("");
  };

  const toLocalInput = (iso?: string | null) => iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";
  const fromLocalInput = (v: string) => v ? new Date(v).toISOString() : null;

  const uploadImage = async (file: File): Promise<string | null> => {
    if (!/^image\/(png|jpe?g|gif|webp)$/i.test(file.type)) { notify("Images PNG, JPG, GIF ou WebP uniquement."); return null; }
    if (file.size > 5 * 1024 * 1024) { notify("Image trop lourde (5 Mo maximum)."); return null; }
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${id}/${crypto.randomUUID()}.${ext}`;
    const up = await supabase.storage.from("question-images").upload(path, file, { contentType: file.type });
    if (up.error) { notify(up.error.message); return null; }
    const { data: pub } = supabase.storage.from("question-images").getPublicUrl(path);
    return pub.publicUrl;
  };

  const addQuestion = (type: QType) => {
    const isMcq = type === "mcq_single" || type === "mcq_multi";
    setOpenQ((s) => new Set(s).add(questions.length));
    setQFilter(""); setQType("");
    setTimeout(() => document.getElementById(`q-${questions.length}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    setQuestions((qs) => [...qs, {
      test_id: id, position: qs.length, type,
      prompt: type === "terminal" ? "Connecte-toi au serveur et retrouve le flag au format CYBER{...}." : "",
      options: isMcq ? [{ id: crypto.randomUUID(), text: "" }, { id: crypto.randomUUID(), text: "" }] : null,
      correct: isMcq ? [] : type === "short_answer" ? { answers: [], case_sensitive: false } : null, points: 1, image_url: null,
      ...(type === "hotspot" ? { options: { layout: "code", multi: false, segments: [] }, correct: [] } : {}),
      ...(type in ALL_TEMPLATES ? JSON.parse(JSON.stringify(ALL_TEMPLATES[type])) : {}),
      terminal: type === "terminal" ? { scenario: JSON.stringify(TERMINAL_TEMPLATE, null, 2), flag: "CYBER{exemple_a_changer}" } : null,
      external: type === "external" ? externalDraft("crime") : null,
    }]);
  };

  const addPack = (k: PackKey) => {
    const pack = PACKS[k];
    if (!confirm(`Ajouter les ${pack.questions.length} exercices du pack « ${pack.label} » à la fin de l'épreuve ?\n\nIls prennent environ ${pack.minutes} minutes : pensez à allonger la durée, puis à enregistrer.`)) return;
    setQuestions((qs) => [...qs, ...pack.questions.map((p, j) => ({
      test_id: id, position: qs.length + j, type: p.type as QType, prompt: p.prompt, domain: p.domain, points: p.points,
      time_limit_s: p.time_limit_s, options: JSON.parse(JSON.stringify(p.options)), correct: JSON.parse(JSON.stringify(p.correct)),
      image_url: null, terminal: p.terminal ? { ...p.terminal } : null, external: null, explanation: p.explanation ?? null,
    }))]);
    notify(`${pack.questions.length} exercices ajoutés. Allongez la durée d'environ ${pack.minutes} min, puis cliquez sur « Enregistrer ».`);
  };

  const addBank = (bq: BankQuestion[]) => {
    setQuestions((qs) => [...qs, ...bq.map((p, j) => ({
      test_id: id, position: qs.length + j, type: p.type as QType, prompt: p.prompt, domain: p.domain, points: p.points,
      time_limit_s: null, options: JSON.parse(JSON.stringify(p.options)), correct: [...p.correct],
      image_url: null, terminal: null, external: null, explanation: p.explanation ?? null, variant_group: p.variant_group,
    }))]);
    notify(`${bq.length} questions ajoutées. Allongez la durée si besoin, puis cliquez sur « Enregistrer ».`);
  };

  /** Première erreur qui empêche d'enregistrer, ou null. */
  const firstError = (): string | null => {
    for (const [i, q] of questions.entries()) {
      if (FUN_TYPES.includes(q.type)) {
        const err = validateQuestion(q.type as any, q.options, q.correct);
        if (err) return `Question ${i + 1} : ${err}`;
      }
      if (q.type === "external") {
        const err = externalError(q.external);
        if (err) return `Question ${i + 1} : ${err}`;
        continue;
      }
      if (q.type !== "terminal") continue;
      try { const x = JSON.parse(q.terminal?.scenario || ""); if (!x.files) throw new Error(); if (!q.terminal?.flag?.trim() && !(x.objectives || []).length) throw new Error("vide"); }
      catch (e: any) { return `Question ${i + 1} : ${e?.message === "vide" ? "il faut au moins une mission ou un flag" : "scénario JSON invalide (la clé « files » est obligatoire)"}.`; }
    }
    return null;
  };
  const persist = async (silent: boolean) => {
    if (locked) { if (!silent) notify("Des candidats ont déjà composé : les questions sont verrouillées. Dupliquez le test pour le modifier."); return; }
    const bad = firstError();
    if (bad) { setAuto({ state: "invalid", msg: bad }); if (!silent) notify(bad); return; }
    if (busyRef.current) { againRef.current = true; return; }
    busyRef.current = true; setSaving(true); setAuto({ state: "saving" });
    const snapshot = JSON.stringify(questions);
    const err = await writeQuestions(supabase as any, id, JSON.parse(snapshot));
    busyRef.current = false; setSaving(false);
    if (err) { setAuto({ state: "invalid", msg: err }); if (!silent) notify(err); }
    else { savedRef.current = snapshot; setAuto({ state: "saved", at: Date.now() }); }
    if (againRef.current) { againRef.current = false; setTick((t) => t + 1); }
  };
  const saveAll = () => persist(false);

  // Enregistrement automatique : deux secondes après la dernière modification
  useEffect(() => {
    if (!loadedRef.current || locked) return;
    if (questions.some((q: any) => !q.id)) { setQuestions((qs) => qs.map((q: any) => (q.id ? q : { ...q, id: crypto.randomUUID() }))); return; }
    if (JSON.stringify(questions) === savedRef.current) return;
    setAuto((a) => (a.state === "saving" ? a : { state: "dirty" }));
    const h = setTimeout(() => persist(true), 2000);
    return () => clearTimeout(h);
  }, [questions, locked, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const h = setInterval(() => setNow(Date.now()), 5000); return () => clearInterval(h); }, []);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (auto.state === "dirty" || auto.state === "saving") e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [auto.state]);

  if (!test) return <main className="px-8 py-10 text-muted">Chargement…</main>;

  const ADD_GROUPS: [string, [QType, string, string][]][] = [
    ["Questions", [
      ["mcq_single", "QCM", "une seule réponse"], ["mcq_multi", "QCM", "plusieurs réponses"],
      ["short_answer", "Réponse courte", "mot, nombre, donnée"], ["long_text", "Réponse rédigée", "corrigée à la main"],
      ["ordering", "Remettre en ordre", "étapes, procédure"], ["matching", "Associer", "deux colonnes"], ["hotspot", "Repérer", "code, log, mail"],
    ]],
    ["Activités pratiques", [
      ["terminal", "Défi terminal", "Linux simulé"], ["bash", "Script Bash", "noté sur les fichiers"], ["sql", "Requête SQL", "logs, injection"],
      ["headers", "En-têtes de mail", "phishing"], ["subnet", "Sous-réseaux", "valeurs par candidat"], ["blocks", "Pare-feu en blocs", "règles"],
      ["adsim", "Active Directory", "OU, comptes, GPO"], ["evtx", "Journaux Windows", "enquête SOC"], ["tickets", "Tickets de support", "priorisation"],
      ["sim", "Simulation", "appli, pare-feu, capture"], ["password", "Mots de passe", "classer ou créer"], ["external", "Exercice outil", "GeoGuess…"],
    ]],
    ["Logique et culture", [
      ["feed", "Vrai ou fake ?", "fil d'actualité"], ["netpuzzle", "Puzzle réseau", "sans prérequis"],
      ["sokoban", "Caisses à pousser", "persévérance"], ["robot", "Robot", "algorithmique"], ["decode", "Décoder", "base64, hex…"],
    ]],
  ];
  const settingsNav: [string, string][] = [["general", "Général"], ["dates", "Dates et lieu"], ["tirage", "Tirage"], ["admission", "Notation et admission"],
    ["chrono", "Chronomètre"], ["surveillance", "Surveillance"], ["mails", "Mails et agenda"], ["acces", "Accès et Safe Exam Browser"], ["danger", "Zone sensible"]];
  const rules: { domain: string; min: number }[] = test.draw_rules?.domains || [];
  const setRules = (next: { domain: string; min: number }[], balance = !!test.draw_rules?.balance) =>
    updateTest({ draw_rules: next.length || balance ? { domains: next, balance } : null });
  const visible = questions.map((q, i) => ({ q, i })).filter(({ q }) => (!qType || q.type === qType)
    && (!qFilter.trim() || `${q.prompt || ""} ${q.domain || ""}`.toLowerCase().includes(qFilter.trim().toLowerCase())));
  const ago = (at?: number) => { const sec = Math.max(0, Math.round((now - (at || now)) / 1000)); return sec < 8 ? "à l'instant" : sec < 60 ? `il y a ${Math.round(sec / 5) * 5} s` : `il y a ${Math.round(sec / 60)} min`; };
  const sumMin = rules.reduce((a, r) => a + r.min, 0);
  const checks: string[] = [
    !questions.length ? "Aucune question dans l'épreuve." : "",
    questions.filter((q) => !q.domain?.trim()).length ? `${questions.filter((q) => !q.domain?.trim()).length} question(s) sans domaine : pas de résultat par domaine ni de plancher pour elles.` : "",
    questions.filter((q) => !q.prompt?.trim() || validateQuestion(q.type as any, q.options, q.correct)).length ? `${questions.filter((q) => !q.prompt?.trim() || validateQuestion(q.type as any, q.options, q.correct)).length} question(s) à compléter (énoncé ou corrigé manquant).` : "",
    ...rules.map((r) => { const n = questions.filter((q) => (q.domain || "").toLowerCase() === r.domain.toLowerCase()).length; return n < r.min ? `Tirage impossible : ${r.min} question(s) demandée(s) en ${r.domain}, ${n} disponible(s).` : ""; }),
    test.draw_count && sumMin > test.draw_count ? `Tirage impossible : les règles par domaine demandent ${sumMin} questions, pour ${test.draw_count} tirées.` : "",
    test.draw_count && test.draw_count > questions.length ? `Tirage : ${test.draw_count} questions demandées par étudiant, ${questions.length} dans l'épreuve.` : "",
    test.draw_rules?.balance && questions.some((q) => !q.difficulty) ? `Difficulté équilibrée : ${questions.filter((q) => !q.difficulty).length} question(s) sans difficulté.` : "",
    !test.opens_at ? "Pas de date d'ouverture : l'épreuve n'apparaîtra pas dans le calendrier." : "",
    test.opens_at && test.closes_at && +new Date(test.closes_at) <= +new Date(test.opens_at) ? "La fermeture est avant l'ouverture." : "",
    test.opens_at && test.closes_at && (+new Date(test.closes_at) - +new Date(test.opens_at)) / 60000 < test.duration_minutes ? "La fenêtre d'ouverture est plus courte que la durée de l'épreuve." : "",
  ].filter(Boolean);
  const move = (from: number, to: number) => { if (from === to) return; setQuestions((qs) => { const n = [...qs]; const [x] = n.splice(from, 1); n.splice(to, 0, x); return n; }); setOpenQ(new Set()); };
  const canDrag = !locked && !qFilter.trim() && !qType;
  const totalPts = questions.reduce((s, q) => s + (Number(q.points) || 0), 0);
  const DIFF: Record<string, string> = { facile: "bg-[#2fa862]/[0.12] text-[#1f7a44]", moyen: "bg-[#5561c9]/[0.12] text-navy", difficile: "bg-[#c23b17]/10 text-[#b3361a]" };

  return (
    <main className="px-4 sm:px-8 py-6">
      {msg && <p className="mb-4 rounded-xl bg-[#c23b17]/10 px-4 py-2.5 text-sm text-[#b3361a]">{msg}</p>}
      {checks.length > 0 && (
        <details className="mb-5 rounded-2xl border border-[#f08a3e]/40 bg-[#f08a3e]/[0.08] px-5 py-3.5" open={!test.is_published}>
          <summary className="cursor-pointer text-sm font-semibold text-[#a64a12]">{test.is_published ? "Épreuve publiée" : "Avant de publier"} : {checks.length} point(s) à vérifier</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-fg/85">{checks.map((c) => <li key={c}>{c}</li>)}</ul>
        </details>
      )}

      {vue === "reglages" ? (
        <div className="grid gap-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
          <nav aria-label="Sections des réglages" className="hidden lg:block">
            <ul className="sticky top-6 space-y-0.5 text-sm">
              {settingsNav.map(([k, l]) => (
                <li key={k}><a href={`#${k}`} className={`block rounded-lg px-3 py-2 hover:bg-fg/5 ${k === "danger" ? "text-[#b3361a]" : "text-fg/75 hover:text-fg"}`}>{l}</a></li>
              ))}
            </ul>
          </nav>
          <div className="min-w-0 space-y-5">
            <p className="text-sm text-muted">Chaque réglage s&apos;enregistre tout seul.</p>

            <Section id="general" title="Général" desc="Ce que voient les étudiants avant de commencer.">
              <Field label="Titre"><input className={inputCls} value={test.title} onChange={(e) => updateTest({ title: e.target.value })} /></Field>
              <Field label="Présentation" hint="Affichée avant l'épreuve : contenu, durée, matériel autorisé. La première ligne sert de sous-titre dans l'espace équipe.">
                <textarea className={`${inputCls} min-h-[110px]`} value={test.description || ""} onChange={(e) => updateTest({ description: e.target.value })} placeholder="Ex. Bloc 16 Réseau Linux" />
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Durée de l'épreuve"><Num value={test.duration_minutes} min={1} max={600} suffix="min" onChange={(v) => updateTest({ duration_minutes: Math.max(1, v || 1) })} /></Field>
                <Field label="Promo" hint="Choisie aussi au moment de publier.">
                  <input className={inputCls} list="classes" value={test.formation || ""} onChange={(e) => updateTest({ formation: e.target.value || null })} placeholder="Toutes les promos" />
                  <datalist id="classes">{classes.map((c) => <option key={c} value={c} />)}</datalist>
                </Field>
              </div>
            </Section>

            <Section id="dates" title="Dates et lieu" desc="Utilisés par le calendrier pour repérer les chevauchements de promo et de salle.">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Ouverture"><input className={inputCls} type="datetime-local" value={toLocalInput(test.opens_at)} onChange={(e) => updateTest({ opens_at: fromLocalInput(e.target.value) })} /></Field>
                <Field label="Fermeture"><input className={inputCls} type="datetime-local" value={toLocalInput(test.closes_at)} onChange={(e) => updateTest({ closes_at: fromLocalInput(e.target.value) })} /></Field>
                <Field label="Campus">
                  <select className={inputCls} value={test.campus || ""} onChange={(e) => updateTest({ campus: e.target.value || null })}>
                    <option value="">Non précisé</option><option>Puteaux</option><option>Lille</option><option>Marseille</option><option>À distance</option>
                  </select>
                </Field>
                <Field label="Salle"><input className={inputCls} maxLength={100} value={test.room || ""} onChange={(e) => updateTest({ room: e.target.value || null })} placeholder="Ex. Salle Seine" /></Field>
              </div>
            </Section>

            <Section id="tirage" title="Tirage des questions" desc="Chaque étudiant reçoit un sujet différent, tiré dans les questions de l'épreuve.">
              <Toggle checked={!!test.shuffle_questions} onChange={(v) => updateTest({ shuffle_questions: v })} label="Mélanger l'ordre des questions" />
              <Toggle checked={!!test.shuffle_options} onChange={(v) => updateTest({ shuffle_options: v })} label="Mélanger l'ordre des réponses" />
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Nombre de questions par étudiant" hint={`Vide : toutes (${questions.length}).`}>
                  <Num value={test.draw_count} min={1} placeholder="toutes" onChange={(v) => updateTest({ draw_count: v && v > 0 ? Math.round(v) : null })} />
                </Field>
                <Field label="Temps d'activités pratiques" hint="Activités tirées au hasard, de types variés, sans dépasser ce temps. Vide : toutes.">
                  <Num value={test.activity_minutes} min={1} max={600} suffix="min" placeholder="toutes" onChange={(v) => updateTest({ activity_minutes: v && v > 0 ? Math.round(v) : null })} />
                </Field>
              </div>
              <div className="rounded-xl bg-surface-2 p-4">
                <div className="text-sm font-medium">Au moins N questions par domaine</div>
                <p className="mt-0.5 text-xs text-muted">Ex. 4 en Réseau et 3 en Linux ; le reste est complété au hasard jusqu&apos;au nombre de questions.</p>
                <div className="mt-3 space-y-2">
                  {rules.map((r, k) => (
                    <div key={k} className="flex items-center gap-2">
                      <select className={`${inputCls} !w-auto min-w-[12rem]`} value={r.domain} onChange={(e) => setRules(rules.map((x, j) => j === k ? { ...x, domain: e.target.value } : x))}>
                        {[r.domain, ...domains.filter((d) => d !== r.domain)].filter(Boolean).map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                      <span className="text-sm text-muted">au moins</span>
                      <Num width="w-20" value={r.min} min={1} onChange={(v) => setRules(rules.map((x, j) => j === k ? { ...x, min: Math.max(1, Math.round(v || 1)) } : x))} />
                      <span className="text-xs text-muted">sur {questions.filter((q) => (q.domain || "").toLowerCase() === r.domain.toLowerCase()).length} disponibles</span>
                      <button className="ml-auto text-sm text-muted hover:text-[#b3361a]" onClick={() => setRules(rules.filter((_, j) => j !== k))}>Retirer</button>
                    </div>
                  ))}
                  <button className="text-sm font-medium text-accent hover:underline disabled:opacity-40" disabled={!domains.length}
                    onClick={() => setRules([...rules, { domain: domains.find((d) => !rules.some((r) => r.domain === d)) || domains[0], min: 2 }])}>
                    + Ajouter une règle
                  </button>
                  {!domains.length && <p className="text-xs text-muted">Indiquez le domaine des questions pour créer des règles.</p>}
                </div>
                <div className="mt-4 border-t border-line pt-4">
                  <Toggle checked={!!test.draw_rules?.balance} onChange={(v) => setRules(rules, v)} label="Difficulté équilibrée"
                    hint="Faciles, moyennes et difficiles alternent dans le tirage. La difficulté se règle sur chaque question, ou s'estime d'après les copies." />
                  <button className="mt-2 text-sm font-medium text-navy hover:text-accent" onClick={async () => {
                    const { data, error } = await supabase.rpc("estimate_difficulty", { p_test: id });
                    if (error) return notify(error.message);
                    notify(`${data ?? 0} question(s) classée(s) d'après les copies.`, "ok");
                    setQuestions(await loadDrafts(supabase as any, id));
                  }}>Estimer la difficulté d&apos;après les copies (5 copies minimum par question)</button>
                </div>
              </div>
            </Section>

            <Section id="admission" title="Notation et admission" desc="Entre les deux seuils, la décision est « À statuer ». L'équipe peut toujours la forcer, avec un motif.">
              <div className="grid gap-5 sm:grid-cols-3">
                <Field label="« Réussi » à partir de"><Num value={test.verdict_pass ?? 10} min={0} max={20} step={0.5} suffix="/20" onChange={(v) => v != null && v >= 0 && v <= 20 && v >= (test.verdict_fail ?? 8) && updateTest({ verdict_pass: v })} /></Field>
                <Field label="« Échoué » sous"><Num value={test.verdict_fail ?? 8} min={0} max={20} step={0.5} suffix="/20" onChange={(v) => v != null && v >= 0 && v <= 20 && v <= (test.verdict_pass ?? 10) && updateTest({ verdict_fail: v })} /></Field>
                <Field label="Points minimum" hint="Facultatif, en plus de la note."><Num value={test.pass_mark} min={0} step={0.5} suffix="pts" onChange={(v) => updateTest({ pass_mark: v })} /></Field>
              </div>
              <Toggle checked={!!test.partial_points} onChange={(v) => updateTest({ partial_points: v })} label="Points partiels aux QCM à plusieurs réponses" hint="Bonnes cases moins mauvaises, au prorata, jamais négatif." />
              <div>
                <div className="text-sm font-medium">Plancher par domaine</div>
                <p className="mt-0.5 text-xs text-muted">Sous ce pourcentage de réussite dans un domaine, l&apos;étudiant est signalé au jury.</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {domains.map((d) => (
                    <div key={d} className="flex items-center justify-between gap-3 rounded-xl border border-line px-3.5 py-2">
                      <span className="text-sm">{d}</span>
                      <Num width="w-24" value={test.domain_floors?.[d] != null ? Math.round(test.domain_floors[d] * 100) : null} min={0} max={100} suffix="%" placeholder="—"
                        onChange={(v) => { const f = { ...(test.domain_floors || {}) }; if (v == null) delete f[d]; else f[d] = Math.min(100, Math.max(0, v)) / 100; updateTest({ domain_floors: f }); }} />
                    </div>
                  ))}
                  {!domains.length && <span className="text-xs text-muted">Indiquez le domaine des questions pour régler les planchers.</span>}
                </div>
              </div>
              <Field label="Grille d'entretien oral" hint="Affichée sur la fiche jury.">
                <textarea className={`${inputCls} min-h-[140px]`} value={test.interview_guide || ""} onChange={(e) => updateTest({ interview_guide: e.target.value })} />
              </Field>
            </Section>

            <Section id="chrono" title="Chronomètre">
              <div className="grid gap-5 sm:grid-cols-3">
                <Field label="Mode">
                  <select className={inputCls} value={test.timing || "global"} onChange={(e) => updateTest({ timing: e.target.value })}>
                    <option value="global">Durée totale de l&apos;épreuve</option><option value="question">Temps par question</option>
                  </select>
                </Field>
                {test.timing === "question" && <Field label="Temps par défaut d'une question"><Num value={test.question_time_s ?? 60} min={10} max={3600} suffix="s" onChange={(v) => v && v >= 10 && v <= 3600 && updateTest({ question_time_s: v })} /></Field>}
                <Field label="Alerte « réponses trop rapides »" hint="Après 3 réponses de suite sous ce temps. 0 : désactivée."><Num value={test.fast_answer_s ?? 4} min={0} max={60} suffix="s" onChange={(v) => v != null && v >= 0 && v <= 60 && updateTest({ fast_answer_s: v })} /></Field>
              </div>
              <Field label="Tolérance en fin d'épreuve" hint="Délai accordé pour l'envoi de la dernière réponse."><Num value={test.grace_seconds} min={0} max={600} suffix="s" onChange={(v) => updateTest({ grace_seconds: Math.max(0, v || 0) })} /></Field>
            </Section>

            <Section id="surveillance" title="Surveillance" desc="Toujours actifs : caméra analysée, plein écran obligatoire, une question à la fois sans retour en arrière.">
              <Toggle checked={!!test.invite_only} onChange={(v) => updateTest({ invite_only: v })} label="Sur inscription uniquement" hint="Recommandé : seuls les étudiants inscrits peuvent entrer, avec leur code." />
              <Toggle checked={!!test.require_id_check} onChange={(v) => updateTest({ require_id_check: v })} label="Vérification d'identité" hint="Pièce d'identité et selfie avant l'épreuve." />
              {test.require_id_check && <div className="pl-6"><Toggle checked={!!test.id_verify_before_start} onChange={(v) => updateTest({ id_verify_before_start: v })} label="Attendre la validation du surveillant avant de commencer" /></div>}
              <Toggle checked={!!test.allow_resume} onChange={(v) => updateTest({ allow_resume: v })} label="Reprise sur un autre appareil sans le surveillant" />
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Seuil d'alerte" hint="Au-delà, le surveillant est prévenu. L'épreuve n'est jamais arrêtée automatiquement."><Num value={test.max_violations} min={1} max={50} suffix="infr." onChange={(v) => updateTest({ max_violations: Math.max(1, v || 1) })} /></Field>
                <Field label="Conservation des photos et vidéos"><Num value={test.retention_days} min={1} max={3650} suffix="jours" onChange={(v) => updateTest({ retention_days: Math.max(1, v || 90) })} /></Field>
              </div>
            </Section>

            <Section id="mails" title="Mails et agenda" desc="Actifs seulement si un compte de l'école est relié (menu « Mails et agenda »). Rien n'est rétroactif.">
              <Toggle checked={test.mail_convocation !== false} onChange={(v) => updateTest({ mail_convocation: v })} label="Envoyer la convocation à l'inscription"
                hint="Chaque étudiant inscrit reçoit son lien et son code personnels, dès que l'épreuve est publiée." />
              <Toggle checked={test.mail_relance !== false} onChange={(v) => updateTest({ mail_relance: v })} label="Relancer une fois ceux qui ne l'ont pas passée"
                hint="Deux heures après la fin de l'épreuve, un seul mail aux inscrits qui ne l'ont pas commencée." />
              <Toggle checked={!!test.slots} onChange={(v) => updateTest({ slots: v })} label="Créneaux individuels (tests d'admission)"
                hint="Chaque candidat a sa date et son heure, fixées dans l'onglet Inscriptions. Il reçoit la convocation, une invitation d'agenda à son nom, un rappel la veille et un autre dix minutes avant ; son lien ne fonctionne que dans son créneau." />
              <Field label="Inscription automatique depuis l'agenda" hint={`Mot-clé de la classe attendu dans le titre du rendez-vous créé par HubSpot dans l'agenda du compte relié, par exemple « ${shortClass(test.formation) || "B3 Cyber"} » pour « Test technique ${shortClass(test.formation) || "B3 Cyber"} - Prénom ». L'invité du rendez-vous est inscrit à cette épreuve avec ce créneau, puis convoqué. Vide : pas d'inscription automatique.`}>
                <input className={`${inputCls} max-w-xs`} maxLength={60} value={test.agenda_keyword || ""} placeholder={shortClass(test.formation) || "B3 Cyber"}
                  onChange={(e) => updateTest({ agenda_keyword: e.target.value || null })} />
              </Field>
              <p className="text-xs text-muted">Sans créneaux individuels, l&apos;épreuve publiée et datée est portée dans l&apos;agenda du compte, avec sa salle et son campus.</p>
            </Section>

            <Section id="acces" title="Accès et Safe Exam Browser">
              <Field label="Code d'accès commun" hint="Seulement pour une épreuve ouverte sans inscription. Les inscrits utilisent leur code personnel.">
                <div className="flex gap-2">
                  <input className={`${inputCls} font-mono`} placeholder="(aucun)" value={secrets.access_code || ""} onChange={(e) => updateSecrets({ access_code: e.target.value.toUpperCase() || null })} />
                  <button className="btn-secondary shrink-0" onClick={generateCode} type="button">Générer</button>
                  {secrets.access_code && <button className="btn-secondary shrink-0" onClick={() => updateSecrets({ access_code: null })} type="button">Effacer</button>}
                </div>
              </Field>
              {test.is_published && <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm break-all">Lien de l&apos;épreuve : <code>{link}</code></p>}
              <Toggle checked={!!test.require_seb} onChange={(v) => updateTest({ require_seb: v })} label="Safe Exam Browser obligatoire" hint="Vérifié à chaque requête. Les étudiants ouvrent le fichier .seb chiffré que vous leur transmettez." />
              {test.require_seb && (
                <div className="space-y-4 rounded-xl bg-surface-2 p-4">
                  <p className="text-xs leading-relaxed text-muted">
                    1. <a className="underline" href={`/api/seb/${id}`}>Télécharger le .seb</a> (sel propre à cette épreuve). 2. L&apos;ouvrir dans l&apos;outil SEB, onglet « Exam », copier la Browser Exam Key de chaque version de SEB utilisée.
                    3. Réenregistrer le .seb chiffré par mot de passe avant de le distribuer.
                  </p>
                  <Field label="Browser Exam Keys" hint="Une clé de 64 caractères hexadécimaux par ligne.">
                    <textarea key={"bek" + (secrets.seb_browser_exam_keys || []).join()} className={`${inputCls} font-mono text-xs`} rows={2} defaultValue={(secrets.seb_browser_exam_keys || []).join("\n")} onBlur={(e) => updateSecrets({ seb_browser_exam_keys: keyList(e.target.value) })} />
                  </Field>
                  <Toggle checked={!!test.seb_accept_config_key} onChange={(v) => updateTest({ seb_accept_config_key: v })} label="Accepter aussi la Config Key" hint="Plus simple sur un parc hétérogène, mais forgeable par qui obtient le .seb en clair." />
                  {test.seb_accept_config_key && (
                    <Field label="Config Keys">
                      <textarea key={"ck" + (secrets.seb_config_keys || []).join()} className={`${inputCls} font-mono text-xs`} rows={2} defaultValue={(secrets.seb_config_keys || []).join("\n")} onBlur={(e) => updateSecrets({ seb_config_keys: keyList(e.target.value) })} />
                    </Field>
                  )}
                  <Field label={`Mot de passe de sortie ${secrets.seb_quit_password_hash ? "(défini)" : "(aucun)"}`}>
                    <div className="flex gap-2">
                      <input className={inputCls} type="password" autoComplete="new-password" value={quitPwd} onChange={(e) => setQuitPwd(e.target.value)} placeholder="Laisser vide pour supprimer" />
                      <button className="btn-secondary shrink-0" type="button" onClick={saveQuitPassword}>Enregistrer</button>
                    </div>
                  </Field>
                  {!(secrets.seb_browser_exam_keys?.length || (test.seb_accept_config_key && secrets.seb_config_keys?.length)) &&
                    <p className="text-xs font-medium text-[#b3361a]">Aucune clé configurée : personne ne pourra composer.</p>}
                </div>
              )}
            </Section>

            <Section id="danger" title="Zone sensible">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted">Supprime l&apos;épreuve, ses questions, copies, inscriptions et journaux. Irréversible.</p>
                <button className="rounded-xl border border-[#c23b17]/40 px-4 py-2 text-sm font-semibold text-[#b3361a] hover:bg-[#c23b17]/10" onClick={async () => {
                  if (!confirm(`Supprimer « ${test.title} » ?\n\nLes questions, tentatives, réponses, invitations et journaux de cet examen seront aussi supprimés. Action irréversible.`)) return;
                  const { error } = await supabase.from("tests").delete().eq("id", id);
                  if (error) return notify(error.message);
                  window.location.href = "/admin";
                }}>Supprimer l&apos;épreuve</button>
              </div>
            </Section>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {locked && <p className="rounded-xl bg-[#f08a3e]/[0.12] px-4 py-2.5 text-sm text-[#a64a12]">Des étudiants ont composé : les questions sont figées. Dupliquez l&apos;épreuve pour la modifier.</p>}

          <div className="flex flex-wrap items-center gap-3">
            <div className="text-sm text-muted">
              <span className="font-semibold text-fg">{questions.length}</span> question(s) · <span className="font-semibold text-fg">{totalPts}</span> point(s)
              {test.draw_count ? <> · {test.draw_count} tirée(s) par étudiant</> : null}
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {!locked && (
                <span className={`mr-1 text-sm ${auto.state === "invalid" ? "font-medium text-[#b3361a]" : "text-muted"}`} title={auto.msg} aria-live="polite">
                  {auto.state === "saving" ? "Enregistrement…" : auto.state === "dirty" ? "Modifications en attente…" : auto.state === "saved" ? `Enregistré ${ago(auto.at)}`
                    : auto.state === "invalid" ? "Non enregistré : une question est à compléter" : "Enregistrement automatique"}
                </span>
              )}
              <div className="relative">
                <button className="btn-secondary" disabled={locked} onClick={() => setPanel((p) => (p === "import" ? null : "import"))} aria-expanded={panel === "import"}>Importer ▾</button>
              </div>
              <button className="btn-secondary" disabled={locked} onClick={() => setPanel((p) => (p === "add" ? null : "add"))} aria-expanded={panel === "add"}>+ Ajouter une question</button>
              <button className="btn-secondary" onClick={saveAll} disabled={saving || locked}>Enregistrer maintenant</button>
            </div>
          </div>

          {panel === "add" && (
            <div className="rounded-2xl border border-line bg-surface p-5 shadow-[0_14px_34px_-24px_rgba(15,22,64,0.4)]">
              {ADD_GROUPS.map(([g, list]) => (
                <div key={g} className="mb-4 last:mb-0">
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-fg/60">{g}</div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                    {list.map(([t, l, d]) => (
                      <button key={t} className="rounded-xl border border-line px-3 py-2.5 text-left transition-colors hover:border-accent hover:bg-accent/5" onClick={() => { addQuestion(t); setPanel(null); }}>
                        <div className="text-sm font-semibold text-navy">{l}</div><div className="text-xs text-muted">{d}</div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {panel === "import" && (
            <div className="space-y-3 rounded-2xl border border-line bg-surface p-5 shadow-[0_14px_34px_-24px_rgba(15,22,64,0.4)]">
              <BankPicker locked={locked} existing={questions.map((q: any) => q.prompt)} defaultLevel={test.formation ? normLevel(test.formation) : ""}
                onImport={(added) => setQuestions((qs) => [...qs, ...added.map((q, k) => ({ ...q, test_id: id, position: qs.length + k }) as any)])} />
              <ImportFromTests currentId={id} locked={locked} existing={questions.map((q: any) => q.prompt)}
                onImport={(added) => setQuestions((qs) => [...qs, ...added.map((q, k) => ({ ...q, test_id: id, position: qs.length + k }) as any)])} />
              <ExamFileTools test={test} questions={questions as any} locked={locked}
                onImport={(added) => setQuestions((qs) => [...qs, ...added.map((q, k) => ({ ...q, test_id: id, position: qs.length + k }) as any)])} />
              <ExcelTools questions={questions} formation={test.formation || ""} locked={locked}
                onFormation={(f) => updateTest({ formation: f || null })}
                onImport={(added) => setQuestions((qs) => [...qs, ...added.map((q, k) => ({ ...q, test_id: id, position: qs.length + k, image_url: null }))])} />
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface-2/60 p-3 text-sm">
                <span className="mr-1 text-xs text-muted">Packs d&apos;exercices pratiques :</span>
                {(["b1", "b3", "m1", "b1x", "b3x", "m1x"] as const).map((k) => (
                  <button key={k} className="btn-secondary !py-1.5" disabled={locked} onClick={() => addPack(k)}>{PACKS[k].label} · {PACKS[k].questions.length}</button>
                ))}
              </div>
              <DylanBank disabled={locked} onAdd={addBank} />
            </div>
          )}

          {questions.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[14rem]">
                <svg aria-hidden viewBox="0 0 20 20" className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"><path fill="currentColor" d="M8.5 3a5.5 5.5 0 0 1 4.38 8.83l3.65 3.64-1.06 1.06-3.64-3.65A5.5 5.5 0 1 1 8.5 3Zm0 1.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" /></svg>
                <input className={`${inputCls} !pl-10`} placeholder="Rechercher dans les énoncés ou les domaines" value={qFilter} onChange={(e) => setQFilter(e.target.value)} aria-label="Rechercher une question" />
              </div>
              <select className={`${inputCls} !w-auto`} value={qType} onChange={(e) => setQType(e.target.value)} aria-label="Filtrer par type">
                <option value="">Tous les types</option>
                {Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l as string}</option>)}
              </select>
              <button className="text-sm text-muted hover:text-fg" onClick={() => setOpenQ(openQ.size ? new Set() : new Set(questions.map((_, k) => k)))}>{openQ.size ? "Tout replier" : "Tout déplier"}</button>
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(15,22,64,0.04)]">
            {!questions.length && (
              <div className="px-6 py-14 text-center">
                <p className="font-display text-lg uppercase text-navy">Aucune question pour l&apos;instant</p>
                <p className="mt-1 text-sm text-muted">Écrivez une question, ou reprenez celles de la banque, d&apos;un autre examen ou d&apos;un fichier.</p>
                <div className="mt-4 flex justify-center gap-2">
                  <button className="btn" disabled={locked} onClick={() => setPanel("add")}>+ Ajouter une question</button>
                  <button className="btn-secondary" disabled={locked} onClick={() => setPanel("import")}>Importer</button>
                </div>
              </div>
            )}
            {visible.map(({ q, i }) => {
              const err = validateQuestion(q.type as any, q.options, q.correct);
              const isOpen = openQ.has(i);
              return (
                <div key={(q as any).id || i} id={`q-${i}`} className={`scroll-mt-6 border-b border-line last:border-b-0 ${isOpen ? "bg-surface-2/40" : ""} ${drag === i ? "opacity-40" : ""}`}
                  onDragOver={(e) => { if (drag != null) e.preventDefault(); }} onDrop={(e) => { e.preventDefault(); if (drag != null) move(drag, i); setDrag(null); }}>
                  <div className="flex items-center gap-3 px-4 py-3">
                    {canDrag && <span draggable onDragStart={(e) => { setDrag(i); e.dataTransfer.effectAllowed = "move"; }} onDragEnd={() => setDrag(null)}
                      className="-ml-1 cursor-grab select-none px-1 text-faint hover:text-fg active:cursor-grabbing" title="Glisser pour déplacer" aria-hidden>⋮⋮</span>}
                    <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => toggleQ(i)} aria-expanded={isOpen}>
                      <span className="w-8 shrink-0 text-right font-mono text-xs text-faint">{i + 1}</span>
                      <span className="shrink-0 rounded-md bg-navy/[0.07] px-2 py-0.5 text-[11px] font-semibold text-navy">{KIND_LABEL[q.type as keyof typeof KIND_LABEL] || q.type}</span>
                      <span className={`truncate text-[15px] ${q.prompt ? "text-fg" : "italic text-faint"}`}>{(q.prompt || "Énoncé à écrire").replace(/\s+/g, " ").slice(0, 160)}</span>
                      <span className="ml-auto flex shrink-0 items-center gap-2 text-xs text-muted">
                        {q.domain && <span className="hidden rounded-md bg-fg/[0.06] px-2 py-0.5 md:inline">{q.domain}</span>}
                        {q.difficulty && <span className={`hidden rounded-md px-2 py-0.5 sm:inline ${DIFF[q.difficulty]}`}>{q.difficulty}</span>}
                        <span className="tabular-nums">{q.points} pt{q.points > 1 ? "s" : ""}</span>
                        {err && <span className="font-medium text-[#b3361a]" title={err}>à compléter</span>}
                        <span aria-hidden className={`text-base transition-transform ${isOpen ? "rotate-90" : ""}`}>›</span>
                      </span>
                    </button>
                    <button className="shrink-0 text-xs text-muted hover:text-navy" onClick={() => setPreview(q)} title="Voir comme un étudiant">Aperçu</button>
                    <button className="shrink-0 text-xs text-muted hover:text-[#b3361a]" disabled={locked} onClick={() => { if (confirm(`Retirer la question ${i + 1} ?`)) { setQuestions((arr) => arr.filter((_, k) => k !== i)); setOpenQ(new Set()); } }}>Retirer</button>
                  </div>
                  {isOpen && (
                    <div className="space-y-3 border-t border-line bg-surface px-6 py-5">
            {err && <p className="text-xs text-danger">À corriger avant d&apos;enregistrer : {err}</p>}
            <textarea className="input min-h-[96px] text-[15px] leading-relaxed" placeholder="Énoncé de la question" value={q.prompt} onChange={(e) => {
              const v = e.target.value; setQuestions((arr) => arr.map((x, k) => k === i ? { ...x, prompt: v } : x));
            }} />
            <div className="grid sm:grid-cols-6 gap-3 text-sm">
              <label>Points
                <input className="input mt-1" type="number" min={0} value={q.points} onChange={(e) => {
                  const v = parseInt(e.target.value); setQuestions((arr) => arr.map((x, k) => k === i ? { ...x, points: v } : x));
                }} />
              </label>
              <label>Difficulté
                <select className="input mt-1" value={q.difficulty || ""} onChange={(e) => {
                  const v = e.target.value || null; setQuestions((arr) => arr.map((x, k) => k === i ? { ...x, difficulty: v } : x));
                }}>
                  <option value="">Non précisée</option><option value="facile">Facile</option><option value="moyen">Moyenne</option><option value="difficile">Difficile</option>
                </select>
              </label>
              <label className="sm:col-span-2">Domaine (compétence)
                <input className="input mt-1" list="domains" value={q.domain || ""} placeholder="ex. Réseaux" onChange={(e) => {
                  const v = e.target.value; setQuestions((arr) => arr.map((x, k) => k === i ? { ...x, domain: v } : x));
                }} />
              </label>
              <label title="Les questions d'un même groupe sont des variantes : une seule est tirée pour chaque candidat">Groupe de variantes (facultatif)
                <input className="input mt-1" value={q.variant_group || ""} placeholder="ex. reseau-q03" onChange={(e) => {
                  const v = e.target.value; setQuestions((arr) => arr.map((x, k) => k === i ? { ...x, variant_group: v } : x));
                }} />
              </label>
              <label title="Utilisé quand l'épreuve est chronométrée question par question ; vide = temps par défaut">Temps (secondes)
                <input className="input mt-1" inputMode="numeric" value={q.time_limit_s ?? ""} placeholder="défaut" onChange={(e) => {
                  const n = parseInt(e.target.value.replace(/\D/g, ""), 10);
                  setQuestions((arr) => arr.map((x, k) => k === i ? { ...x, time_limit_s: Number.isFinite(n) ? Math.min(3600, n) : null } : x));
                }} />
              </label>
              <label className="sm:col-span-6">Explication (équipe et fiche de correction, jamais le candidat)
                <input className="input mt-1" maxLength={5000} value={q.explanation || ""} onChange={(e) => {
                  const v = e.target.value; setQuestions((arr) => arr.map((x, k) => k === i ? { ...x, explanation: v } : x));
                }} />
              </label>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <label className="btn-secondary cursor-pointer">
                {q.image_url ? "Changer l’image" : "+ Image"}
                <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                  const f = e.target.files?.[0]; if (!f) return;
                  const url = await uploadImage(f);
                  if (url) setQuestions((arr) => arr.map((x, k) => k === i ? { ...x, image_url: url } : x));
                }} />
              </label>
              {q.image_url && (
                <>
                  <a className="text-xs underline" href={q.image_url} target="_blank" rel="noreferrer">voir</a>
                  <button className="text-xs text-danger" onClick={() => setQuestions((arr) => arr.map((x, k) => k === i ? { ...x, image_url: null } : x))}>retirer</button>
                </>
              )}
            </div>
            {q.image_url && <img src={q.image_url} alt="" className="max-h-40 rounded border mt-1" />}


            {FUN_TYPES.includes(q.type) && (
              <TypeEditor key={(q.id || "new") + i} type={q.type as any} options={q.options} correct={q.correct}
                onChange={(p) => setQuestions((arr) => arr.map((x, k) => k === i ? { ...x, ...p } : x))} />
            )}

            {q.type === "external" && q.external && (
              <ExternalEditor value={q.external}
                onChange={(x) => setQuestions((arr) => arr.map((y, k) => k === i ? { ...y, external: x } : y))} />
            )}

            {q.type === "terminal" && q.terminal && (
              <div className="space-y-2">
                <label className="block text-sm text-muted">Flag attendu (facultatif si le scénario a des missions ; comparaison exacte)
                  <input className="input mt-1 font-mono" value={q.terminal.flag} onChange={(e) => {
                    const v = e.target.value; setQuestions((arr) => arr.map((x, k) => k === i ? { ...x, terminal: { ...x.terminal!, flag: v } } : x));
                  }} />
                </label>
                <label className="block text-sm text-muted">Machine simulée (JSON) : user, hostname, home, motd, files (contenu ou {"{"}content, mode, owner{"}"}), dirs, denied, processes, listen, crontab, sudo, objectives. Elle reste sur le serveur : le candidat ne voit que la sortie des commandes et le titre des missions. Format détaillé dans le README.
                  <textarea className="input mt-1 font-mono text-xs min-h-[220px]" spellCheck={false} value={q.terminal.scenario} onChange={(e) => {
                    const v = e.target.value; setQuestions((arr) => arr.map((x, k) => k === i ? { ...x, terminal: { ...x.terminal!, scenario: v } } : x));
                  }} />
                </label>
              </div>
            )}

            {(q.type === "mcq_single" || q.type === "mcq_multi") && q.options && (
              <div className="space-y-2">
                {(q.options as Option[]).map((opt: Option, j: number) => (
                  <div key={opt.id} className="space-y-1">
                    <div className="flex gap-2 items-center">
                      <input
                        type={q.type === "mcq_single" ? "radio" : "checkbox"}
                        name={`correct-${i}`}
                        checked={q.correct?.includes(opt.id) || false}
                        onChange={(e) => {
                          setQuestions((arr) => arr.map((x, k) => {
                            if (k !== i) return x;
                            let cur = x.correct || [];
                            if (q.type === "mcq_single") cur = e.target.checked ? [opt.id] : [];
                            else cur = e.target.checked ? [...cur, opt.id] : cur.filter((c: string) => c !== opt.id);
                            return { ...x, correct: cur };
                          }));
                        }}
                      />
                      <input className="input flex-1" placeholder={`Réponse ${j + 1}`} value={opt.text} onChange={(e) => {
                        const v = e.target.value;
                        setQuestions((arr) => arr.map((x, k) => k === i ? { ...x, options: (x.options as Option[]).map((o: Option) => o.id === opt.id ? { ...o, text: v } : o) } : x));
                      }} />
                      <label className="btn-secondary text-xs cursor-pointer">
                        {opt.image_url ? "img ✓" : "img"}
                        <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                          const f = e.target.files?.[0]; if (!f) return;
                          const url = await uploadImage(f);
                          if (url) setQuestions((arr) => arr.map((x, k) => k === i ? { ...x, options: (x.options as Option[]).map((o: Option) => o.id === opt.id ? { ...o, image_url: url } : o) } : x));
                        }} />
                      </label>
                      <button className="text-sm text-muted" onClick={() => setQuestions((arr) => arr.map((x, k) => k === i ? { ...x, options: (x.options as Option[]).filter((o: Option) => o.id !== opt.id), correct: (x.correct || []).filter((c: string) => c !== opt.id) } : x))}>×</button>
                    </div>
                    {opt.image_url && <img src={opt.image_url} alt="" className="max-h-24 rounded border ml-7" />}
                  </div>
                ))}
                <button className="btn-secondary text-xs" onClick={() => setQuestions((arr) => arr.map((x, k) => k === i ? { ...x, options: [...(x.options || []), { id: crypto.randomUUID(), text: "" }] } : x))}>+ Ajouter une réponse</button>
              </div>
            )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </div>
      )}
      {preview && <StudentPreview q={preview} onClose={() => setPreview(null)} />}
      <datalist id="domains">{domains.map((d) => <option key={d} value={d} />)}</datalist>
    </main>
  );
}

const TERMINAL_TEMPLATE = {
  user: "candidat",
  hostname: "srv-admission",
  home: "/home/candidat",
  motd: "Bienvenue. Lisez ~/MISSION.txt puis accomplissez les missions affichées à droite.",
  files: {
    "/home/candidat/MISSION.txt": "1. Crée le dossier ~/projet\n2. Le fichier ~/secret.txt doit être lisible par toi seul (600)\n3. Arrête le processus « minerd »\n",
    "/home/candidat/secret.txt": { content: "mot de passe wifi : admission2026\n", mode: "644" },
    "/var/backups/note.b64": "Q1lCRVJ7ZXhlbXBsZV9hX2NoYW5nZXJ9Cg==\n",
  },
  denied: ["/root"],
  processes: [
    { pid: 1, user: "root", cmd: "/sbin/init" },
    { pid: 4242, user: "candidat", cmd: "./minerd --donate", cpu: 95.2 },
  ],
  objectives: [
    { id: "dir", title: "Créer le dossier ~/projet", check: { type: "exists", path: "/home/candidat/projet", kind: "dir" } },
    { id: "perm", title: "Protéger ~/secret.txt (600)", check: { type: "mode", path: "/home/candidat/secret.txt", mode: "600" } },
    { id: "kill", title: "Arrêter le processus minerd", check: { type: "process_absent", name: "minerd" } },
  ],
};

function externalDraft(tool: string): ExternalDraft {
  return { tool, label: "", time_limit_min: "10", scenario: JSON.stringify(TOOLS[tool]?.scenarioExample ?? {}, null, 2), answer_key: tool === "win95" ? JSON.stringify({ u1: "legit" }, null, 2) : "" };
}

/** Vérifie un exercice externe avant enregistrement ; renvoie un message ou null. */
function externalError(x: ExternalDraft | null | undefined): string | null {
  if (!x || !TOOLS[x.tool]) return "choisissez un outil.";
  const min = x.time_limit_min.trim() ? parseInt(x.time_limit_min, 10) : null;
  if (min !== null && (!Number.isFinite(min) || min < 1 || min > 120)) return "durée de l'exercice entre 1 et 120 minutes.";
  let scenario: unknown, key: unknown = null;
  try { scenario = JSON.parse(x.scenario); } catch { return "scénario JSON invalide."; }
  if (x.answer_key.trim()) { try { key = JSON.parse(x.answer_key); } catch { return "corrigé JSON invalide."; } }
  if (TOOLS[x.tool].grading === "platform") {
    const errs = checkKey(scenario, key);
    if (errs.length) return errs[0];
  }
  return null;
}

function ExternalEditor({ value, onChange }: { value: ExternalDraft; onChange: (v: ExternalDraft) => void }) {
  const tool = TOOLS[value.tool];
  const set = (p: Partial<ExternalDraft>) => onChange({ ...value, ...p });
  return (
    <div className="space-y-2">
      <div className="grid sm:grid-cols-3 gap-2">
        <label className="block text-sm text-muted">Outil
          <select className="input mt-1" value={value.tool} onChange={(e) => onChange(externalDraft(e.target.value))}>
            {Object.values(TOOLS).map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </label>
        <label className="block text-sm text-muted">Titre affiché (facultatif)
          <input className="input mt-1" maxLength={200} value={value.label} onChange={(e) => set({ label: e.target.value })} />
        </label>
        <label className="block text-sm text-muted">Durée de l&apos;exercice (minutes)
          <input className="input mt-1" inputMode="numeric" value={value.time_limit_min} onChange={(e) => set({ time_limit_min: e.target.value.replace(/\D/g, "") })} />
        </label>
      </div>
      <p className="text-xs text-muted">{tool?.scenarioHelp} Le chronomètre de l&apos;exercice part à son ouverture et ne dépasse jamais la fin de l&apos;épreuve.</p>
      <label className="block text-sm text-muted">Scénario (JSON), envoyé à l&apos;outil
        <textarea className="input mt-1 font-mono text-xs min-h-[160px]" spellCheck={false} value={value.scenario} onChange={(e) => set({ scenario: e.target.value })} />
      </label>
      {tool?.grading === "platform" && (
        <label className="block text-sm text-muted">Corrigé (JSON) : reste sur le serveur, jamais envoyé au candidat
          <textarea className="input mt-1 font-mono text-xs min-h-[100px]" spellCheck={false} value={value.answer_key} onChange={(e) => set({ answer_key: e.target.value })} />
        </label>
      )}
    </div>
  );
}
