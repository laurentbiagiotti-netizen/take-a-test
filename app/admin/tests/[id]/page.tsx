"use client";
import { notify } from "@/components/Toaster";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { genCode } from "@/lib/security/tokens";
import TypeEditor from "@/components/admin/TypeEditor";
import { validateQuestion, TYPE_LABEL as KIND_LABEL } from "@/lib/questions/kinds";

type QType = "mcq_single" | "mcq_multi" | "long_text" | "terminal" | "ordering" | "matching" | "hotspot" | "short_answer";
const FUN_TYPES: QType[] = ["ordering", "matching", "hotspot", "short_answer"];
type Option = { id: string; text: string; image_url?: string | null };
type Question = {
  id?: string; test_id: string; position: number; type: QType;
  prompt: string; options: Option[] | any; correct: string[] | any;
  points: number; image_url?: string | null;
  domain?: string | null; variant_group?: string | null;
  terminal?: { scenario: string; flag: string } | null;
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
  const domains = Array.from(new Set(questions.map((q) => q.domain?.trim()).filter(Boolean) as string[])).sort();
  const [link, setLink] = useState("");

  useEffect(() => {
    (async () => {
      const { data: t } = await supabase.from("tests").select("*").eq("id", id).single();
      setTest(t);
      const { data: sec } = await supabase.from("test_secrets").select("*").eq("test_id", id).maybeSingle();
      if (sec) setSecrets(sec);
      const { count } = await supabase.from("attempts").select("id", { count: "exact", head: true }).eq("test_id", id).neq("status", "pending");
      setLocked((count ?? 0) > 0);
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
      const withKeys = (qs || []).map((q: any) => ({ ...q, correct: keyMap.get(q.id) || null, terminal: termMap.get(q.id) || null }));
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
    setQuestions((qs) => [...qs, {
      test_id: id, position: qs.length, type,
      prompt: type === "terminal" ? "Connecte-toi au serveur et retrouve le flag au format CYBER{...}." : "",
      options: isMcq ? [{ id: crypto.randomUUID(), text: "" }, { id: crypto.randomUUID(), text: "" }] : null,
      correct: isMcq ? [] : type === "short_answer" ? { answers: [], case_sensitive: false } : null, points: 1, image_url: null,
      ...(type === "hotspot" ? { options: { layout: "code", multi: false, segments: [] }, correct: [] } : {}),
      terminal: type === "terminal" ? { scenario: JSON.stringify(TERMINAL_TEMPLATE, null, 2), flag: "CYBER{exemple_a_changer}" } : null,
    }]);
  };

  const saveAll = async () => {
    if (locked) { notify("Des candidats ont déjà composé : les questions sont verrouillées. Dupliquez le test pour le modifier."); return; }
    for (const [i, q] of questions.entries()) {
      if (FUN_TYPES.includes(q.type)) {
        const err = validateQuestion(q.type as any, q.options, q.correct);
        if (err) { notify(`Question ${i + 1} : ${err}`); return; }
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
    }
    setSaving(false);
  };

  if (!test) return <main className="p-10">Chargement…</main>;

  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <a href="/admin" className="text-sm text-muted">← Retour</a>
      <div className="flex items-center justify-between mt-2">
        <h1 className="h1">Modifier l&apos;examen</h1>
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

      <div className="card mt-4 space-y-3">
        <input className="input" value={test.title} onChange={(e) => updateTest({ title: e.target.value })} />
        <textarea className="input" value={test.description || ""} onChange={(e) => updateTest({ description: e.target.value })} placeholder="Description (visible par les candidats)" />
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

        <div className="border-t pt-3 space-y-2 text-sm">
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
          <div className="grid grid-cols-3 gap-3 pt-1">
            <label title="Au-delà, le surveillant est alerté ; l'épreuve n'est jamais arrêtée automatiquement">Seuil d&apos;alerte (infractions)
              <input className="input mt-1" type="number" min={1} max={50} value={test.max_violations} onChange={(e) => updateTest({ max_violations: parseInt(e.target.value) || 1 })} />
            </label>
            <label>Tolérance fin (s)
              <input className="input mt-1" type="number" min={0} max={600} value={test.grace_seconds} onChange={(e) => updateTest({ grace_seconds: parseInt(e.target.value) || 0 })} />
            </label>
            <label>Conservation photos (j)
              <input className="input mt-1" type="number" min={1} max={3650} value={test.retention_days} onChange={(e) => updateTest({ retention_days: parseInt(e.target.value) || 90 })} />
            </label>
          </div>
        </div>

        <div className="border-t pt-3 space-y-2 text-sm">
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

        <div className="border-t pt-3 space-y-2 text-sm">
          <div className="font-medium">Admission</div>
          <label className="block">Seuil d&apos;admissibilité (points, vide = aucun)
            <input className="input mt-1 w-32" type="number" min={0} step={0.5} value={test.pass_mark ?? ""} onChange={(e) => updateTest({ pass_mark: e.target.value === "" ? null : Number(e.target.value) })} />
          </label>
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

        <div className="border-t pt-3">
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

      <h2 className="h2 mt-8">Questions</h2>
      <div className="mt-2 flex flex-wrap gap-2">
        <button className="btn-secondary" onClick={() => addQuestion("mcq_single")}>+ QCM (une réponse)</button>
        <button className="btn-secondary" onClick={() => addQuestion("mcq_multi")}>+ QCM (plusieurs réponses)</button>
        <button className="btn-secondary" onClick={() => addQuestion("long_text")}>+ Réponse rédigée</button>
        <button className="btn-secondary" onClick={() => addQuestion("terminal")}>+ Défi terminal</button>
        <button className="btn-secondary" onClick={() => addQuestion("ordering")}>+ Remettre dans l&apos;ordre</button>
        <button className="btn-secondary" onClick={() => addQuestion("matching")}>+ Associer</button>
        <button className="btn-secondary" onClick={() => addQuestion("hotspot")}>+ Repérer (code, log, mail, tableau)</button>
        <button className="btn-secondary" onClick={() => addQuestion("short_answer")}>+ Réponse courte / données</button>
      </div>

      <div className="mt-4 space-y-4">
        {questions.map((q, i) => (
          <div key={i} className="card space-y-2">
            <div className="flex justify-between items-center">
              <b>Q{i + 1} · {KIND_LABEL[q.type as keyof typeof KIND_LABEL] || q.type}</b>
              <button className="text-danger text-sm" onClick={() => setQuestions((arr) => arr.filter((_, k) => k !== i))}>Retirer</button>
            </div>
            <textarea className="input" placeholder="Énoncé de la question" value={q.prompt} onChange={(e) => {
              const v = e.target.value; setQuestions((arr) => arr.map((x, k) => k === i ? { ...x, prompt: v } : x));
            }} />
            <div className="grid sm:grid-cols-2 gap-2 text-sm">
              <label>Domaine (compétence)
                <input className="input mt-1" list="domains" value={q.domain || ""} placeholder="ex. Réseaux" onChange={(e) => {
                  const v = e.target.value; setQuestions((arr) => arr.map((x, k) => k === i ? { ...x, domain: v } : x));
                }} />
              </label>
              <label title="Les questions d'un même groupe sont des variantes : une seule est tirée pour chaque candidat">Groupe de variantes (facultatif)
                <input className="input mt-1" value={q.variant_group || ""} placeholder="ex. reseau-q03" onChange={(e) => {
                  const v = e.target.value; setQuestions((arr) => arr.map((x, k) => k === i ? { ...x, variant_group: v } : x));
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
        ))}
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
