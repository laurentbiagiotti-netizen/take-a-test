"use client";
import { notify } from "@/components/Toaster";
import PreviewButton from "@/components/admin/PreviewButton";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { genCode } from "@/lib/security/tokens";
import TypeEditor from "@/components/admin/TypeEditor";
import { validateQuestion, TYPE_LABEL as KIND_LABEL } from "@/lib/questions/kinds";
import { TOOLS } from "@/lib/external/tools";
import { checkKey } from "@/lib/external/grade";
import ExcelTools from "@/components/admin/ExcelTools";

type QType = "mcq_single" | "mcq_multi" | "long_text" | "terminal" | "ordering" | "matching" | "hotspot" | "short_answer" | "external";
type ExternalDraft = { tool: string; label: string; time_limit_min: string; scenario: string; answer_key: string };
const FUN_TYPES: QType[] = ["ordering", "matching", "hotspot", "short_answer"];
type Option = { id: string; text: string; image_url?: string | null };
type Question = {
  id?: string; test_id: string; position: number; type: QType;
  prompt: string; options: Option[] | any; correct: string[] | any;
  points: number; image_url?: string | null;
  domain?: string | null; variant_group?: string | null;
  explanation?: string | null; time_limit_s?: number | null;
  terminal?: { scenario: string; flag: string } | null;
  external?: ExternalDraft | null;
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
  const [openQ, setOpenQ] = useState<Set<number>>(new Set());
  const [qFilter, setQFilter] = useState("");
  const [qType, setQType] = useState("");
  const toggleQ = (i: number) => setOpenQ((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; });
  const domains = Array.from(new Set(questions.map((q) => q.domain?.trim()).filter(Boolean) as string[])).sort();
  const [link, setLink] = useState("");

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
      const { data: qs } = await supabase.from("questions").select("*").eq("test_id", id).order("position");
      const ids = (qs || []).map((q: any) => q.id);
      const { data: keys } = ids.length
        ? await supabase.from("answer_keys").select("question_id, correct").in("question_id", ids)
        : { data: [] as any[] };
      const keyMap = new Map((keys || []).map((k: any) => [k.question_id, k.correct]));
      const { data: terms } = ids.length
        ? await supabase.from("question_terminals").select("question_id, scenario, flag").in("question_id", ids)
        : { data: [] as any[] };
      const termMap = new Map((terms || []).map((t: any) => [t.question_id, { scenario: JSON.stringify(t.scenario, null, 2), flag: t.flag }]));
      const { data: exts } = ids.length
        ? await supabase.from("question_externals").select("question_id, tool, scenario, answer_key, time_limit_s, label").in("question_id", ids)
        : { data: [] as any[] };
      const extMap = new Map((exts || []).map((x: any) => [x.question_id, {
        tool: x.tool, label: x.label || "", time_limit_min: x.time_limit_s ? String(Math.round(x.time_limit_s / 60)) : "",
        scenario: JSON.stringify(x.scenario, null, 2), answer_key: x.answer_key ? JSON.stringify(x.answer_key, null, 2) : "",
      }]));
      const withKeys = (qs || []).map((q: any) => ({ ...q, correct: keyMap.get(q.id) || null, terminal: termMap.get(q.id) || null, external: extMap.get(q.id) || null }));
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
      terminal: type === "terminal" ? { scenario: JSON.stringify(TERMINAL_TEMPLATE, null, 2), flag: "CYBER{exemple_a_changer}" } : null,
      external: type === "external" ? externalDraft("crime") : null,
    }]);
  };

  const saveAll = async () => {
    if (locked) { notify("Des candidats ont déjà composé : les questions sont verrouillées. Dupliquez le test pour le modifier."); return; }
    for (const [i, q] of questions.entries()) {
      if (FUN_TYPES.includes(q.type)) {
        const err = validateQuestion(q.type as any, q.options, q.correct);
        if (err) { notify(`Question ${i + 1} : ${err}`); return; }
      }
      if (q.type === "external") {
        const err = externalError(q.external);
        if (err) { notify(`Question ${i + 1} : ${err}`); return; }
        continue;
      }
      if (q.type !== "terminal") continue;
      try { const x = JSON.parse(q.terminal?.scenario || ""); if (!x.files) throw new Error(); if (!q.terminal?.flag?.trim() && !(x.objectives || []).length) throw new Error("vide"); }
      catch (e: any) { notify(`Question ${i + 1} : ${e?.message === "vide" ? "il faut au moins une mission ou un flag" : "scénario JSON invalide (la clé « files » est obligatoire)"}.`); return; }
    }
    setSaving(true);
    const del = await supabase.from("questions").delete().eq("test_id", id);
    if (del.error) { setSaving(false); notify(del.error.message); return; }
    if (questions.length) {
      const rows = questions.map((q, i) => ({
        test_id: id, position: i, type: q.type, prompt: q.prompt,
        options: q.options, points: q.points,
        image_url: q.image_url ?? null,
        domain: q.domain?.trim() || null, variant_group: q.variant_group?.trim() || null,
        explanation: q.explanation?.trim() || null, time_limit_s: q.time_limit_s || null,
      }));
      const { data: inserted } = await supabase.from("questions").insert(rows).select("id");
      // Re-attach answer keys (only for MCQ)
      const keyRows = (inserted || []).map((row: any, idx: number) => ({
        question_id: row.id, correct: questions[idx].correct ?? [],
      })).filter((_, idx) => ["mcq_single", "mcq_multi", ...FUN_TYPES].includes(questions[idx].type));
      if (keyRows.length) await supabase.from("answer_keys").upsert(keyRows);
      const termRows = (inserted || []).map((row: any, idx: number) => questions[idx].type === "terminal" ? ({
        question_id: row.id, scenario: JSON.parse(questions[idx].terminal!.scenario), flag: questions[idx].terminal!.flag.trim() || null,
      }) : null).filter(Boolean);
      if (termRows.length) {
        const { error } = await supabase.from("question_terminals").upsert(termRows as any[]);
        if (error) notify(error.message);
      }
      const extRows = (inserted || []).map((row: any, idx: number) => {
        const x = questions[idx].external;
        if (questions[idx].type !== "external" || !x) return null;
        const minutes = parseInt(x.time_limit_min, 10);
        return {
          question_id: row.id, tool: x.tool, label: x.label.trim() || null,
          time_limit_s: Number.isFinite(minutes) && minutes > 0 ? minutes * 60 : null,
          scenario: JSON.parse(x.scenario), answer_key: x.answer_key.trim() ? JSON.parse(x.answer_key) : null,
        };
      }).filter(Boolean);
      if (extRows.length) {
        const { error } = await supabase.from("question_externals").upsert(extRows as any[]);
        if (error) notify(error.message);
      }
    }
    setSaving(false);
  };

  if (!test) return <main className="p-10">Chargement…</main>;

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <a href="/admin" className="text-sm text-muted">← Examens</a>
      <div className="flex flex-wrap items-start justify-between gap-4 mt-2">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wider text-muted">Modifier l&apos;épreuve</div>
          <h1 className="h1 mt-1 normal-case">{test.title || "Sans titre"}</h1>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm mt-2">
            <a href={`/admin/tests/${id}/invites`} className="text-muted hover:text-fg">Candidats</a>
            <a href={`/admin/tests/${id}/live`} className="text-muted hover:text-fg">En direct</a>
            <a href={`/admin/tests/${id}/attempts`} className="text-muted hover:text-fg">Tentatives</a>
            <a href={`/admin/tests/${id}/dashboard`} className="text-muted hover:text-fg">Tableau de bord</a>
          </div>
        </div>
        <div className="flex items-center gap-4">
        <PreviewButton testId={id} className="btn" />
        <button
          className="text-sm text-danger underline"
          onClick={async () => {
            if (!confirm(`Supprimer « ${test.title} » ?\n\nLes questions, tentatives, réponses, invitations et journaux de cet examen seront aussi supprimés. Action irréversible.`)) return;
            const { error } = await supabase.from("tests").delete().eq("id", id);
            if (error) return notify(error.message);
            window.location.href = "/admin";
          }}
        >Supprimer l&apos;examen</button>
        </div>
      </div>

      <nav aria-label="Sections de l'épreuve" className="sticky top-0 z-30 -mx-6 px-6 py-2 mt-4 bg-bg/90 backdrop-blur border-b border-line flex items-center gap-3 text-sm">
        <div className="flex gap-1 overflow-x-auto min-w-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {[["general", "Général"], ["surveillance", "Surveillance"], ["tirage", "Tirage"], ["admission", "Admission"], ["chrono", "Chrono et notation"], ["acces", "Accès et SEB"], ["questions", `Questions (${questions.length})`]].map(([k, l]) => (
            <a key={k} href={`#${k}`} className="px-3 py-1.5 rounded-md text-muted hover:text-fg hover:bg-surface-2 whitespace-nowrap">{l}</a>
          ))}
        </div>
        <span className={`ml-auto shrink-0 badge ${test.is_published ? "border-ok/40 text-ok" : "border-line-strong text-muted"}`}>{test.is_published ? "Publiée" : "Brouillon"}</span>
        <button className="btn !py-1.5 shrink-0" onClick={saveAll} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</button>
      </nav>
      <p className="text-xs text-faint mt-2">Les réglages s&apos;enregistrent tout seuls ; les questions avec le bouton « Enregistrer les questions ».</p>

      <div id="general" className="card mt-4 space-y-3 scroll-mt-16">
        <label className="block text-sm">Titre
          <input className="input mt-1" value={test.title} onChange={(e) => updateTest({ title: e.target.value })} />
        </label>
        <label className="block text-sm">Présentation affichée aux candidats avant l&apos;épreuve
          <textarea className="input mt-1 min-h-[96px]" value={test.description || ""} onChange={(e) => updateTest({ description: e.target.value })} placeholder="Ce que le candidat doit savoir : contenu, durée, matériel" />
        </label>
        <label className="block text-sm">Durée (minutes)
          <input className="input mt-1" type="number" min={1} max={600} value={test.duration_minutes} onChange={(e) => updateTest({ duration_minutes: parseInt(e.target.value) || 1 })} />
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={test.is_published} onChange={(e) => updateTest({ is_published: e.target.checked })} />
          Publié (visible par les candidats autorisés)
        </label>

        <div className="border-t pt-3 grid grid-cols-2 gap-3 text-sm">
          <label>Ouverture
            <input className="input mt-1" type="datetime-local" value={toLocalInput(test.opens_at)} onChange={(e) => updateTest({ opens_at: fromLocalInput(e.target.value) })} />
          </label>
          <label>Fermeture
            <input className="input mt-1" type="datetime-local" value={toLocalInput(test.closes_at)} onChange={(e) => updateTest({ closes_at: fromLocalInput(e.target.value) })} />
          </label>
        </div>

        <div id="surveillance" className="border-t pt-3 space-y-2 text-sm scroll-mt-16">
          <div className="font-medium">Surveillance</div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={!!test.invite_only} onChange={(e) => updateTest({ invite_only: e.target.checked })} />
            Sur invitation uniquement (recommandé)
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={!!test.require_seb} onChange={(e) => updateTest({ require_seb: e.target.checked })} />
            Safe Exam Browser obligatoire (vérifié sur chaque requête)
          </label>
          <p className="text-muted">Toujours actifs, non désactivables : caméra lancée automatiquement et analysée, plein écran obligatoire, une question à la fois sans retour en arrière.</p>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={!!test.require_id_check} onChange={(e) => updateTest({ require_id_check: e.target.checked })} />
            Vérification d&apos;identité (pièce + selfie) avant l&apos;épreuve
          </label>
          {test.require_id_check && <label className="flex items-center gap-2 pl-6">
            <input type="checkbox" checked={!!test.id_verify_before_start} onChange={(e) => updateTest({ id_verify_before_start: e.target.checked })} />
            Attendre la validation du surveillant avant de laisser commencer
          </label>}
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={!!test.allow_resume} onChange={(e) => updateTest({ allow_resume: e.target.checked })} />
            Autoriser la reprise sur un autre appareil sans intervention du surveillant
          </label>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
            <label title="Au-delà, le surveillant est alerté ; l'épreuve n'est jamais arrêtée automatiquement">Seuil d&apos;alerte (infractions)
              <input className="input mt-1" type="number" min={1} max={50} value={test.max_violations} onChange={(e) => updateTest({ max_violations: parseInt(e.target.value) || 1 })} />
            </label>
            <label title="Au N-ième avertissement, l'épreuve se met en pause et le candidat filme la pièce à 360° avec son téléphone (QR code). 0 = jamais">Scan de la pièce (dès N infractions, 0 = jamais)
              <input className="input mt-1" type="number" min={0} max={50} value={test.room_scan_after ?? 3} onChange={(e) => updateTest({ room_scan_after: Math.max(0, parseInt(e.target.value) || 0) })} />
            </label>
            <label>Tolérance fin (s)
              <input className="input mt-1" type="number" min={0} max={600} value={test.grace_seconds} onChange={(e) => updateTest({ grace_seconds: parseInt(e.target.value) || 0 })} />
            </label>
            <label>Conservation photos et vidéos (j)
              <input className="input mt-1" type="number" min={1} max={3650} value={test.retention_days} onChange={(e) => updateTest({ retention_days: parseInt(e.target.value) || 90 })} />
            </label>
          </div>
        </div>

        <div id="tirage" className="border-t pt-3 space-y-2 text-sm scroll-mt-16">
          <div className="font-medium">Tirage et ordre (chaque candidat a un sujet différent)</div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={!!test.shuffle_questions} onChange={(e) => updateTest({ shuffle_questions: e.target.checked })} />
            Mélanger l&apos;ordre des questions
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={!!test.shuffle_options} onChange={(e) => updateTest({ shuffle_options: e.target.checked })} />
            Mélanger l&apos;ordre des réponses
          </label>
          <label className="block">Tirer au hasard N questions dans la banque (vide = toutes)
            <input className="input mt-1 w-32" type="number" min={1} value={test.draw_count ?? ""} onChange={(e) => updateTest({ draw_count: e.target.value ? parseInt(e.target.value) : null })} />
          </label>
          <p className="text-xs text-muted">Variantes : les questions qui partagent un même « groupe de variantes » sont interchangeables ; chaque candidat n&apos;en reçoit qu&apos;une, tirée au hasard.</p>
        </div>

        <div id="admission" className="border-t pt-3 space-y-2 text-sm scroll-mt-16">
          <div className="font-medium">Admission</div>
          <div className="grid sm:grid-cols-3 gap-3">
            <label className="block">« Test réussi » à partir de (sur 20)
              <input className="input mt-1 w-28" type="number" min={0} max={20} step={0.5} value={test.verdict_pass ?? 10}
                onChange={(e) => { const v = Number(e.target.value); if (v >= 0 && v <= 20 && v >= (test.verdict_fail ?? 8)) updateTest({ verdict_pass: v }); }} />
            </label>
            <label className="block">« Test échoué » sous (sur 20)
              <input className="input mt-1 w-28" type="number" min={0} max={20} step={0.5} value={test.verdict_fail ?? 8}
                onChange={(e) => { const v = Number(e.target.value); if (v >= 0 && v <= 20 && v <= (test.verdict_pass ?? 10)) updateTest({ verdict_fail: v }); }} />
            </label>
            <label className="block">Points minimum en plus (facultatif)
              <input className="input mt-1 w-28" type="number" min={0} step={0.5} value={test.pass_mark ?? ""} onChange={(e) => updateTest({ pass_mark: e.target.value === "" ? null : Number(e.target.value) })} />
            </label>
          </div>
          <p className="text-xs text-muted">
            Entre les deux seuils, le résultat est « À statuer ». Il l&apos;est aussi tant qu&apos;une réponse rédigée n&apos;est pas corrigée,
            ou si un plancher par domaine n&apos;est pas atteint. L&apos;équipe peut toujours forcer la décision, avec un motif.
          </p>
          <div>
            <div>Plancher par domaine (% minimum de réussite ; en dessous, le candidat est signalé au jury)</div>
            <div className="grid sm:grid-cols-2 gap-2 mt-1">
              {domains.map((d) => (
                <label key={d} className="flex items-center justify-between gap-2 border border-line rounded px-2 py-1">
                  <span>{d}</span>
                  <span className="flex items-center gap-1">
                    <input className="input !w-16 !py-0.5" type="number" min={0} max={100} value={test.domain_floors?.[d] != null ? Math.round(test.domain_floors[d] * 100) : ""}
                      onChange={(e) => {
                        const f = { ...(test.domain_floors || {}) };
                        if (e.target.value === "") delete f[d]; else f[d] = Math.min(100, Math.max(0, Number(e.target.value))) / 100;
                        updateTest({ domain_floors: f });
                      }} /> %
                  </span>
                </label>
              ))}
              {!domains.length && <span className="text-xs text-muted">Indiquez le domaine de chaque question pour régler les planchers.</span>}
            </div>
          </div>
          <label className="block">Grille d&apos;entretien oral (affichée sur la fiche jury)
            <textarea className="input mt-1 min-h-[140px] text-sm" value={test.interview_guide || ""} onChange={(e) => updateTest({ interview_guide: e.target.value })} />
          </label>
        </div>

        <div id="chrono" className="border-t pt-3 space-y-2 text-sm scroll-mt-16">
          <div className="font-medium">Chronométrage et notation</div>
          <div className="grid sm:grid-cols-3 gap-3">
            <label className="block">Chronométrage
              <select className="input mt-1" value={test.timing || "global"} onChange={(e) => updateTest({ timing: e.target.value })}>
                <option value="global">Durée totale de l&apos;épreuve</option>
                <option value="question">Temps par question</option>
              </select>
            </label>
            {test.timing === "question" && <label className="block">Temps par défaut d&apos;une question (s)
              <input className="input mt-1 w-28" type="number" min={10} max={3600} value={test.question_time_s ?? 60}
                onChange={(e) => { const v = parseInt(e.target.value); if (v >= 10 && v <= 3600) updateTest({ question_time_s: v }); }} />
            </label>}
            <label className="block" title="0 pour désactiver">Alerte « réponses trop rapides » sous (s)
              <input className="input mt-1 w-28" type="number" min={0} max={60} value={test.fast_answer_s ?? 4}
                onChange={(e) => { const v = parseInt(e.target.value); if (v >= 0 && v <= 60) updateTest({ fast_answer_s: v }); }} />
            </label>
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={!!test.partial_points} onChange={(e) => updateTest({ partial_points: e.target.checked })} />
            Points partiels aux QCM à plusieurs réponses (bonnes cases moins mauvaises, au prorata)
          </label>
          <p className="text-xs text-muted">
            En temps par question, chaque question a son propre chrono (le temps fixé sur la question, sinon celui par défaut ; le tiers-temps s&apos;applique au prorata).
            À zéro, la question est validée automatiquement. L&apos;alerte « réponses trop rapides » prévient le surveillant après 3 réponses de suite données sous le seuil.
          </p>
        </div>

        <div id="acces" className="border-t pt-3 scroll-mt-16">
          <div className="text-sm font-medium">Code d&apos;accès global</div>
          <p className="text-xs text-muted mt-1">Uniquement pour un test non restreint aux invités. Les invités utilisent leur code personnel.</p>
          <div className="flex gap-2 mt-2">
            <input className="input font-mono" placeholder="(aucun)" value={secrets.access_code || ""}
              onChange={(e) => updateSecrets({ access_code: e.target.value.toUpperCase() || null })} />
            <button className="btn-secondary" onClick={generateCode} type="button">Générer</button>
            {secrets.access_code && <button className="btn-secondary" onClick={() => updateSecrets({ access_code: null })} type="button">Effacer</button>}
          </div>
        </div>

        <div className="border-t pt-3 space-y-2 text-sm">
          <div className="font-medium">Clés Safe Exam Browser</div>
          <p className="text-xs text-muted">
            1. <a className="underline" href={`/api/seb/${id}`}>Télécharger le .seb</a> (contient un sel propre à cet examen).
            2. L&apos;ouvrir dans l&apos;outil de configuration SEB, onglet « Exam », copier la <b>Browser Exam Key</b> (une par version et système de SEB utilisés par les candidats).
            3. Réenregistrer le .seb <b>chiffré par mot de passe</b> avant de le distribuer. Une clé de 64 caractères hexadécimaux par ligne.
          </p>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={!!test.seb_accept_config_key} onChange={(e) => updateTest({ seb_accept_config_key: e.target.checked })} />
            Accepter aussi la Config Key (plus simple pour un parc hétérogène, mais forgeable par qui obtient le .seb en clair)
          </label>
          <label className="block">Config Keys
            <textarea key={"ck" + (secrets.seb_config_keys || []).join()} className="input mt-1 font-mono text-xs" rows={2} defaultValue={(secrets.seb_config_keys || []).join("\n")}
              onBlur={(e) => updateSecrets({ seb_config_keys: keyList(e.target.value) })} />
          </label>
          <label className="block">Browser Exam Keys
            <textarea key={"bek" + (secrets.seb_browser_exam_keys || []).join()} className="input mt-1 font-mono text-xs" rows={2} defaultValue={(secrets.seb_browser_exam_keys || []).join("\n")}
              onBlur={(e) => updateSecrets({ seb_browser_exam_keys: keyList(e.target.value) })} />
          </label>
          <div className="flex gap-2 items-end">
            <label className="block flex-1">Mot de passe de sortie SEB {secrets.seb_quit_password_hash ? "(défini)" : "(aucun)"}
              <input className="input mt-1" type="password" autoComplete="new-password" value={quitPwd} onChange={(e) => setQuitPwd(e.target.value)} placeholder="Laisser vide pour supprimer" />
            </label>
            <button className="btn-secondary" type="button" onClick={saveQuitPassword}>Enregistrer</button>
          </div>
          {test.require_seb && !(secrets.seb_browser_exam_keys?.length || (test.seb_accept_config_key && secrets.seb_config_keys?.length)) &&
            <p className="text-danger text-xs">SEB est obligatoire mais aucune clé n&apos;est configurée : personne ne pourra composer.</p>}
        </div>
        {msg && <p className="text-danger text-sm">{msg}</p>}
        {locked && <p className="text-warn text-sm">Des candidats ont composé : les questions sont verrouillées.</p>}

        <div className="border-t pt-3">
          <a href={`/admin/tests/${id}/invites`} className="btn-secondary">Gérer les invitations →</a>
        </div>

        {test.is_published && (
          <div className="space-y-2 border-t pt-3">
            <div className="text-sm bg-surface-2 rounded p-2 break-all">
              Lien à partager : <code>{link}</code>
              {secrets.access_code && <div className="text-xs text-muted mt-1">Code : <code className="font-mono">{secrets.access_code}</code></div>}
            </div>
            <div className="text-sm bg-surface-2 border border-warn/40 rounded p-3">
              <b>Safe Exam Browser</b>
              <p className="mt-1 text-fg">Les candidats ouvrent le fichier .seb chiffré que vous leur transmettez : SEB verrouille le poste et charge l&apos;examen.</p>
              <div className="mt-2"><a className="underline text-accent" href={`/api/seb/${id}`}>Télécharger le .seb (admin)</a></div>
              <p className="mt-1 text-xs text-muted">Les candidats doivent installer SEB : <a className="underline" href="https://safeexambrowser.org/download_en.html" target="_blank" rel="noreferrer">safeexambrowser.org</a></p>
            </div>
          </div>
        )}
      </div>

      <div id="questions" className="mt-8 flex flex-wrap items-center justify-between gap-2 scroll-mt-16">
        <h2 className="h2">Questions</h2>
        <ExcelTools questions={questions} formation={test.formation || ""} locked={locked}
          onFormation={(f) => updateTest({ formation: f || null })}
          onImport={(added) => setQuestions((qs) => [...qs, ...added.map((q, k) => ({ ...q, test_id: id, position: qs.length + k, image_url: null }))])} />
      </div>
      <div className="mt-3">
        <div className="text-xs uppercase tracking-wider text-muted mb-2">Ajouter une question</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {([
            ["mcq_single", "QCM", "une seule réponse"],
            ["mcq_multi", "QCM", "plusieurs réponses"],
            ["short_answer", "Réponse courte", "mot, nombre, donnée"],
            ["long_text", "Réponse rédigée", "corrigée à la main"],
            ["ordering", "Remettre en ordre", "étapes, procédure"],
            ["matching", "Associer", "deux colonnes"],
            ["hotspot", "Repérer", "code, log, mail, tableau"],
            ["terminal", "Défi terminal", "Linux simulé"],
            ["external", "Exercice outil", "Crime GeoGuess, Cybersup OS"],
          ] as [QType, string, string][]).map(([t, l, d]) => (
            <button key={t} className="text-left rounded-lg border border-line bg-surface px-3 py-2.5 hover:border-accent hover:bg-accent/5 transition-colors" onClick={() => addQuestion(t)}>
              <div className="text-sm font-semibold"><span className="text-accent">+</span> {l}</div>
              <div className="text-xs text-muted mt-0.5">{d}</div>
            </button>
          ))}
        </div>
      </div>

      {questions.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-2 text-sm">
          <input className="input !w-auto flex-1 min-w-[14rem]" placeholder="Rechercher dans les énoncés ou les domaines" value={qFilter} onChange={(e) => setQFilter(e.target.value)} aria-label="Rechercher une question" />
          <select className="input !w-auto" value={qType} onChange={(e) => setQType(e.target.value)} aria-label="Filtrer par type">
            <option value="">Tous les types</option>
            {Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l as string}</option>)}
          </select>
          <button className="btn-secondary !py-1.5" onClick={() => setOpenQ(new Set(questions.map((_, k) => k)))}>Tout déplier</button>
          <button className="btn-secondary !py-1.5" onClick={() => setOpenQ(new Set())}>Tout replier</button>
        </div>
      )}

      <div className="mt-4 space-y-4">
        {questions.map((q, i) => {
          const f = qFilter.trim().toLowerCase();
          if (qType && q.type !== qType) return null;
          if (f && !`${q.prompt || ""} ${q.domain || ""}`.toLowerCase().includes(f)) return null;
          const err = validateQuestion(q.type as any, q.options, q.correct);
          const isOpen = openQ.has(i);
          return (
          <div key={i} id={`q-${i}`} className={`card scroll-mt-20 ${isOpen ? "space-y-2 border-line-strong" : "!py-3"}`}>
            <div className="flex items-center gap-3">
              <button className="flex-1 min-w-0 flex items-center gap-3 text-left" onClick={() => toggleQ(i)} aria-expanded={isOpen}>
                <span className="text-faint font-mono text-xs w-8 shrink-0">Q{i + 1}</span>
                <span className="shrink-0 text-[11px] px-2 py-0.5 rounded-full bg-accent/15 text-accent font-semibold">{KIND_LABEL[q.type as keyof typeof KIND_LABEL] || q.type}</span>
                <span className={`truncate text-sm ${q.prompt ? "" : "text-faint italic"}`}>{(q.prompt || "Énoncé à écrire").replace(/\s+/g, " ").slice(0, 140)}</span>
                <span className="ml-auto shrink-0 flex items-center gap-2 text-xs text-muted">
                  {q.domain && <span className="hidden md:inline">{q.domain}</span>}
                  <span>{q.points} pt{q.points > 1 ? "s" : ""}</span>
                  {err && <span className="text-danger" title={err}>à compléter</span>}
                  <span aria-hidden className={`transition-transform ${isOpen ? "rotate-90" : ""}`}>›</span>
                </span>
              </button>
              <button className="text-danger text-xs shrink-0" onClick={() => { if (confirm(`Retirer la question ${i + 1} ?`)) { setQuestions((arr) => arr.filter((_, k) => k !== i)); setOpenQ(new Set()); } }}>Retirer</button>
            </div>
            {isOpen && <>
            {err && <p className="text-xs text-danger">À corriger avant d&apos;enregistrer : {err}</p>}
            <textarea className="input" placeholder="Énoncé de la question" value={q.prompt} onChange={(e) => {
              const v = e.target.value; setQuestions((arr) => arr.map((x, k) => k === i ? { ...x, prompt: v } : x));
            }} />
            <div className="grid sm:grid-cols-4 gap-2 text-sm">
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
              <label className="sm:col-span-4">Explication (équipe et fiche de correction, jamais le candidat)
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

            <label className="text-sm block">Points
              <input className="input mt-1" type="number" min={0} value={q.points} onChange={(e) => {
                const v = parseInt(e.target.value); setQuestions((arr) => arr.map((x, k) => k === i ? { ...x, points: v } : x));
              }} />
            </label>

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
            </>}
          </div>
          );
        })}
      </div>

      <div className="mt-6">
        <button className="btn" onClick={saveAll} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer les questions"}</button>
      </div>
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
