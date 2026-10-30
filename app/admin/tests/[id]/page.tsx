"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { genCode } from "@/lib/security/tokens";

type QType = "mcq_single" | "mcq_multi" | "long_text";
type Option = { id: string; text: string; image_url?: string | null };
type Question = {
  id?: string; test_id: string; position: number; type: QType;
  prompt: string; options: Option[] | null; correct: string[] | null;
  points: number; image_url?: string | null;
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
      const withKeys = (qs || []).map((q: any) => ({ ...q, correct: keyMap.get(q.id) || null }));
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
    const { error } = await supabase.from("test_secrets").upsert(next);
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
    if (!/^image\/(png|jpe?g|gif|webp)$/i.test(file.type)) { alert("Only PNG / JPG / GIF / WebP images allowed."); return null; }
    if (file.size > 5 * 1024 * 1024) { alert("Image too large (max 5 MB)."); return null; }
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${id}/${crypto.randomUUID()}.${ext}`;
    const up = await supabase.storage.from("question-images").upload(path, file, { contentType: file.type });
    if (up.error) { alert(up.error.message); return null; }
    const { data: pub } = supabase.storage.from("question-images").getPublicUrl(path);
    return pub.publicUrl;
  };

  const addQuestion = (type: QType) => {
    const isMcq = type !== "long_text";
    setQuestions((qs) => [...qs, {
      test_id: id, position: qs.length, type, prompt: "",
      options: isMcq ? [{ id: crypto.randomUUID(), text: "" }, { id: crypto.randomUUID(), text: "" }] : null,
      correct: isMcq ? [] : null, points: 1, image_url: null,
    }]);
  };

  const saveAll = async () => {
    if (locked) { alert("Des candidats ont déjà composé : les questions sont verrouillées. Dupliquez le test pour le modifier."); return; }
    setSaving(true);
    const del = await supabase.from("questions").delete().eq("test_id", id);
    if (del.error) { setSaving(false); alert(del.error.message); return; }
    if (questions.length) {
      const rows = questions.map((q, i) => ({
        test_id: id, position: i, type: q.type, prompt: q.prompt,
        options: q.options, points: q.points,
        image_url: q.image_url ?? null,
      }));
      const { data: inserted } = await supabase.from("questions").insert(rows).select("id");
      // Re-attach answer keys (only for MCQ)
      const keyRows = (inserted || []).map((row: any, idx: number) => ({
        question_id: row.id, correct: questions[idx].correct ?? [],
      })).filter((_, idx) => questions[idx].type !== "long_text");
      if (keyRows.length) await supabase.from("answer_keys").upsert(keyRows);
    }
    setSaving(false);
  };

  if (!test) return <main className="p-10">Loading…</main>;

  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <a href="/admin" className="text-sm text-slate-600">← Back</a>
      <div className="flex items-center justify-between mt-2">
        <h1 className="text-2xl font-bold">Edit test</h1>
        <button
          className="text-sm text-red-600 underline"
          onClick={async () => {
            if (!confirm(`Delete "${test.title}"?\n\nThis will also delete all questions, attempts, answers, invites, and proctor events for this test. This cannot be undone.`)) return;
            const { error } = await supabase.from("tests").delete().eq("id", id);
            if (error) return alert(error.message);
            window.location.href = "/admin";
          }}
        >Delete test</button>
      </div>

      <div className="card mt-4 space-y-3">
        <input className="input" value={test.title} onChange={(e) => updateTest({ title: e.target.value })} />
        <textarea className="input" value={test.description || ""} onChange={(e) => updateTest({ description: e.target.value })} placeholder="Description" />
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
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={test.require_webcam !== false} onChange={(e) => updateTest({ require_webcam: e.target.checked })} />
            Webcam obligatoire avec photos régulières
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={!!test.require_id_check} onChange={(e) => updateTest({ require_id_check: e.target.checked })} />
            Vérification d&apos;identité (pièce + selfie) avant l&apos;épreuve
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={!!test.allow_resume} onChange={(e) => updateTest({ allow_resume: e.target.checked })} />
            Autoriser la reprise sur un autre appareil sans intervention du surveillant
          </label>
          <div className="grid grid-cols-3 gap-3 pt-1">
            <label>Infractions max
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
        </div>

        <div className="border-t pt-3">
          <div className="text-sm font-medium">Code d&apos;accès global</div>
          <p className="text-xs text-slate-500 mt-1">Uniquement pour un test non restreint aux invités. Les invités utilisent leur code personnel.</p>
          <div className="flex gap-2 mt-2">
            <input className="input font-mono" placeholder="(aucun)" value={secrets.access_code || ""}
              onChange={(e) => updateSecrets({ access_code: e.target.value.toUpperCase() || null })} />
            <button className="btn-secondary" onClick={generateCode} type="button">Générer</button>
            {secrets.access_code && <button className="btn-secondary" onClick={() => updateSecrets({ access_code: null })} type="button">Effacer</button>}
          </div>
        </div>

        <div className="border-t pt-3 space-y-2 text-sm">
          <div className="font-medium">Clés Safe Exam Browser</div>
          <p className="text-xs text-slate-500">Téléchargez le .seb, ouvrez-le dans l&apos;outil de configuration SEB, onglet « Exam », et collez la <b>Config Key</b> (recommandé, valable pour tous les postes) et/ou les Browser Exam Keys. Une clé de 64 caractères hexadécimaux par ligne.</p>
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
          {test.require_seb && !(secrets.seb_config_keys?.length || secrets.seb_browser_exam_keys?.length) &&
            <p className="text-red-600 text-xs">SEB est obligatoire mais aucune clé n&apos;est configurée : personne ne pourra composer.</p>}
        </div>
        {msg && <p className="text-red-600 text-sm">{msg}</p>}
        {locked && <p className="text-amber-700 text-sm">Des candidats ont composé : les questions sont verrouillées.</p>}

        <div className="border-t pt-3">
          <a href={`/admin/tests/${id}/invites`} className="btn-secondary">Manage candidate invites →</a>
        </div>

        {test.is_published && (
          <div className="space-y-2 border-t pt-3">
            <div className="text-sm bg-slate-100 rounded p-2 break-all">
              Share link: <code>{link}</code>
              {secrets.access_code && <div className="text-xs text-slate-600 mt-1">Code : <code className="font-mono">{secrets.access_code}</code></div>}
            </div>
            <div className="text-sm bg-amber-50 border border-amber-200 rounded p-3">
              <b>Safe Exam Browser (recommended)</b>
              <p className="mt-1 text-slate-700">Opening this link launches SEB in lockdown mode (no alt-tab, no screen share, no clipboard).</p>
              <div className="mt-2"><a className="underline text-blue-700" href={`/api/seb/${id}`}>Download .seb config</a></div>
              <p className="mt-1 text-xs text-slate-500">Candidates need SEB installed: <a className="underline" href="https://safeexambrowser.org/download_en.html" target="_blank" rel="noreferrer">safeexambrowser.org</a></p>
            </div>
          </div>
        )}
      </div>

      <h2 className="font-semibold mt-8">Questions</h2>
      <div className="mt-2 flex gap-2">
        <button className="btn-secondary" onClick={() => addQuestion("mcq_single")}>+ MCQ (single)</button>
        <button className="btn-secondary" onClick={() => addQuestion("mcq_multi")}>+ MCQ (multi)</button>
        <button className="btn-secondary" onClick={() => addQuestion("long_text")}>+ Long answer</button>
      </div>

      <div className="mt-4 space-y-4">
        {questions.map((q, i) => (
          <div key={i} className="card space-y-2">
            <div className="flex justify-between items-center">
              <b>Q{i + 1} · {q.type}</b>
              <button className="text-red-600 text-sm" onClick={() => setQuestions((arr) => arr.filter((_, k) => k !== i))}>Remove</button>
            </div>
            <textarea className="input" placeholder="Question prompt" value={q.prompt} onChange={(e) => {
              const v = e.target.value; setQuestions((arr) => arr.map((x, k) => k === i ? { ...x, prompt: v } : x));
            }} />

            <div className="flex items-center gap-2 text-sm">
              <label className="btn-secondary cursor-pointer">
                {q.image_url ? "Change image" : "+ Image"}
                <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                  const f = e.target.files?.[0]; if (!f) return;
                  const url = await uploadImage(f);
                  if (url) setQuestions((arr) => arr.map((x, k) => k === i ? { ...x, image_url: url } : x));
                }} />
              </label>
              {q.image_url && (
                <>
                  <a className="text-xs underline" href={q.image_url} target="_blank" rel="noreferrer">view</a>
                  <button className="text-xs text-red-600" onClick={() => setQuestions((arr) => arr.map((x, k) => k === i ? { ...x, image_url: null } : x))}>remove</button>
                </>
              )}
            </div>
            {q.image_url && <img src={q.image_url} alt="" className="max-h-40 rounded border mt-1" />}

            <label className="text-sm block">Points
              <input className="input mt-1" type="number" min={0} value={q.points} onChange={(e) => {
                const v = parseInt(e.target.value); setQuestions((arr) => arr.map((x, k) => k === i ? { ...x, points: v } : x));
              }} />
            </label>

            {q.type !== "long_text" && q.options && (
              <div className="space-y-2">
                {q.options.map((opt, j) => (
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
                            else cur = e.target.checked ? [...cur, opt.id] : cur.filter((c) => c !== opt.id);
                            return { ...x, correct: cur };
                          }));
                        }}
                      />
                      <input className="input flex-1" placeholder={`Option ${j + 1}`} value={opt.text} onChange={(e) => {
                        const v = e.target.value;
                        setQuestions((arr) => arr.map((x, k) => k === i ? { ...x, options: x.options!.map((o) => o.id === opt.id ? { ...o, text: v } : o) } : x));
                      }} />
                      <label className="btn-secondary text-xs cursor-pointer">
                        {opt.image_url ? "img ✓" : "img"}
                        <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                          const f = e.target.files?.[0]; if (!f) return;
                          const url = await uploadImage(f);
                          if (url) setQuestions((arr) => arr.map((x, k) => k === i ? { ...x, options: x.options!.map((o) => o.id === opt.id ? { ...o, image_url: url } : o) } : x));
                        }} />
                      </label>
                      <button className="text-sm text-slate-500" onClick={() => setQuestions((arr) => arr.map((x, k) => k === i ? { ...x, options: x.options!.filter((o) => o.id !== opt.id), correct: (x.correct || []).filter((c) => c !== opt.id) } : x))}>×</button>
                    </div>
                    {opt.image_url && <img src={opt.image_url} alt="" className="max-h-24 rounded border ml-7" />}
                  </div>
                ))}
                <button className="btn-secondary text-xs" onClick={() => setQuestions((arr) => arr.map((x, k) => k === i ? { ...x, options: [...(x.options || []), { id: crypto.randomUUID(), text: "" }] } : x))}>+ Add option</button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6">
        <button className="btn" onClick={saveAll} disabled={saving}>{saving ? "Saving…" : "Save questions"}</button>
      </div>
    </main>
  );
}
