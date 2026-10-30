"""Régénère admission-2026.sql et les fichiers JSON à partir des QCM sources.
Usage : python3 supabase/seed/admission-2026/src/gen.py
"""
import json, sys, collections, importlib.util, pathlib
SRC = pathlib.Path(__file__).resolve().parent
out = str(SRC.parent.parent)
sql = ["-- Épreuves d'admission 2026 (QCM proposés par Dylan Charré, dossier Drive « Proposition test et entretien d'admission Cyber 2026 »).",
       "-- À exécuter une fois, après schema.sql, quand au moins un compte admin existe : les trois épreuves sont créées NON publiées,",
       "-- sur invitation, 1 minute et 1 point par question (tout ou rien sur les questions à plusieurs réponses).",
       "-- Les explications de chaque réponse sont dans supabase/seed/admission-2026/*.json (pour la correction et le debrief).",
       "do $seed$", "declare v_owner uuid; v_test uuid; v_q uuid;", "begin",
       "  select id into v_owner from profiles where role = 'admin' order by created_at limit 1;",
       "  if v_owner is null then raise exception 'Créez d''abord un compte admin'; end if;"]
def q(s): return "$q$" + s + "$q$"
for name in ["b1", "b3", "mastere"]:
    spec = importlib.util.spec_from_file_location(name, str(SRC / f"{name}.py")); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
    sys.path.insert(0, str(SRC)); from patch_v3 import P
    Q = []
    for i, (p, o, a, d, e) in enumerate(m.Q, 1):
        o = list(o)
        for L, t in P.get(name, {}).get(i, {}).items():
            assert L not in a, (name, i, L)
            o["ABCD".index(L)] = t
        Q.append((p, o, a, d, e))
    Q += getattr(m, "ENIGMES", [])
    m.Q = Q
    dom = collections.Counter(x[3] for x in m.Q)
    prompts = [x[0] for x in m.Q]
    assert len(set(prompts)) == len(prompts), name
    print(name, len(m.Q), dict(dom))
    items = []
    for i, (p, opts, ans, d, expl) in enumerate(m.Q):
        assert len(opts) == 4 and all(a in "ABCD" for a in ans.split(","))
        ids = ["a", "b", "c", "d"]
        correct = [ids["ABCD".index(a)] for a in ans.split(",")]
        typ = "mcq_multi" if len(correct) > 1 else "mcq_single"
        items.append({"position": i + 1, "type": typ, "domain": d.replace(" & ", " et "), "prompt": p, "options": [{"id": k, "text": t} for k, t in zip(ids, opts)], "correct": correct, "points": 1, "explanation": expl})
    n = len(items); json.dump({"title": m.TITLE, "description": m.DESC, "duration_minutes": n, "pass_mark": (n + 1) // 2, "questions": items}, open(f"{out}/admission-2026/{name}.json", "w"), ensure_ascii=False, indent=1)
    sql.append(f"  insert into tests(owner_id, title, description, duration_minutes, is_published, invite_only, shuffle_questions, shuffle_options, max_violations)")
    sql.append(f"    values (v_owner, {q(m.TITLE)}, {q(m.DESC)}, {n}, false, true, true, true, 3) returning id into v_test;")
    for it in items:
        sql.append(f"  insert into questions(test_id, position, type, prompt, options, points) values (v_test, {it['position']}, '{it['type']}', {q(it['prompt'])}, {q(json.dumps(it['options'], ensure_ascii=False))}::jsonb, 1) returning id into v_q;")
        sql.append(f"  insert into answer_keys(question_id, correct) values (v_q, '{json.dumps(it['correct'])}'::jsonb);")
sql += ["end", "$seed$;", ""]
open(f"{out}/admission-2026.sql", "w").write("\n".join(sql))
