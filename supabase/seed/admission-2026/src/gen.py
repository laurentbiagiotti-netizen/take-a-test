"""Régénère admission-2026.sql et les fichiers JSON à partir des sources.
Usage : python3 supabase/seed/admission-2026/src/gen.py

Sources (dans ce dossier) :
  b1.py, b3.py, mastere.py      QCM d'origine (Dylan) ; ENIGMES ajoutées en B1
  patch_v3.py                   mauvaises réponses réécrites à la relecture
  *_variantes.py                une variante jumelle par question (même compétence, même difficulté)
  missions/*.json               mission terminal (B3 et Mastère), générées par missions/build.py
  entretiens/*.md               grille d'entretien oral affichée sur la fiche jury
"""
import json, sys, collections, importlib.util, pathlib
SRC = pathlib.Path(__file__).resolve().parent
OUT = SRC.parent.parent
sys.path.insert(0, str(SRC))
from patch_v3 import P

# Plancher par domaine : en dessous de 30 % dans un domaine, le candidat est signalé
# au jury même si son total dépasse le seuil. À ajuster après les premières sessions.
FLOOR = 0.3
MISSION_MINUTES = 8
NO_FLOOR = {"Énigmes CYBEROKU", "Mission terminal"}


def load(name):
    spec = importlib.util.spec_from_file_location(name, SRC / f"{name}.py")
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def q(s):
    assert "$q$" not in s
    return "$q$" + s + "$q$"


def make_item(name, pos, prompt, opts, ans, domain, expl, group, variant):
    ids = ["a", "b", "c", "d"]
    assert len(opts) == 4 and all(a in "ABCD" for a in ans.split(",")), (name, pos)
    correct = [ids["ABCD".index(a)] for a in ans.split(",")]
    return {"position": pos, "variant_group": group, "variant": variant,
            "type": "mcq_multi" if len(correct) > 1 else "mcq_single",
            "domain": domain.replace(" & ", " et "), "prompt": prompt,
            "options": [{"id": k, "text": t} for k, t in zip(ids, opts)],
            "correct": correct, "points": 1, "explanation": expl}


sql = ["-- Épreuves d'admission 2026 (QCM proposés par Dylan Charré, relus ; voir RELECTURE.md).",
       "-- Fichier généré par src/gen.py : ne pas modifier à la main.",
       "-- À exécuter après schema.sql, quand au moins un compte admin existe. Les épreuves sont créées",
       "-- NON publiées, sur invitation, une variante tirée au hasard par question pour chaque candidat.",
       "do $seed$", "declare v_owner uuid; v_test uuid; v_q uuid;", "begin",
       "  select id into v_owner from profiles where role = 'admin' order by created_at limit 1;",
       "  if v_owner is null then raise exception 'Créez d''abord un compte admin'; end if;"]

for name in ["b1", "b3", "mastere"]:
    m = load(name)
    base = []
    for i, (p, o, a, d, e) in enumerate(m.Q, 1):
        o = list(o)
        for L, t in P.get(name, {}).get(i, {}).items():
            assert L not in a, (name, i, L)
            o["ABCD".index(L)] = t
        base.append((p, o, a, d, e))
    base += getattr(m, "ENIGMES", [])

    var_path = SRC / f"{name}_variantes.py"
    variants = {}
    if var_path.exists():
        for (pos, p, o, a, e) in load(f"{name}_variantes").V:
            variants[pos] = (p, list(o), a, e)
        assert sorted(variants) == list(range(1, len(base) + 1)), f"{name} : variantes incomplètes"

    items = []
    for pos, (p, o, a, d, e) in enumerate(base, 1):
        group = f"{name}-q{pos:02d}" if variants else None
        items.append(make_item(name, pos, p, o, a, d, e, group, "A"))
        if variants:
            vp, vo, va, ve = variants[pos]
            assert len(va.split(",")) == len(a.split(",")), (name, pos, "nombre de bonnes réponses")
            items.append(make_item(name, pos, vp, vo, va, d, ve, group, "B"))

    mission = None
    mpath = SRC / "missions" / f"{name}.json"
    if mpath.exists():
        mission = json.loads(mpath.read_text())
        n_obj = len(mission["scenario"]["objectives"])
        items.append({"position": len(base) + 1, "variant_group": None, "variant": None, "type": "terminal",
                      "domain": "Mission terminal", "prompt": mission["prompt"], "options": None,
                      "correct": None, "points": n_obj, "scenario": mission["scenario"],
                      "explanation": "Missions vérifiées automatiquement sur l'état de la machine simulée."})

    n_q = len(base)
    total = n_q + (len(mission["scenario"]["objectives"]) if mission else 0)
    duration = n_q + (MISSION_MINUTES if mission else 0)
    pass_mark = (total + 1) // 2
    domains = sorted({it["domain"] for it in items})
    floors = {d: FLOOR for d in domains if d not in NO_FLOOR}
    guide = (SRC / "entretiens" / f"{name}.md").read_text()
    desc = m.DESC
    if mission:
        desc = desc.replace("50 minutes", f"{duration} minutes").replace("Seuil d'admissibilité proposé : 25/50.",
               f"Plus une mission terminal de {MISSION_MINUTES} minutes ({total - n_q} points). Seuil d'admissibilité proposé : {pass_mark}/{total}.")

    print(name, f"{n_q} questions x {2 if variants else 1} variante(s)", "+ mission" if mission else "",
          f"| {total} pts, {duration} min, seuil {pass_mark}", dict(collections.Counter(it["domain"] for it in items if it.get("variant") != "B")))

    json.dump({"title": m.TITLE, "description": desc, "duration_minutes": duration, "pass_mark": pass_mark,
               "domain_floors": floors, "questions": items},
              open(OUT / "admission-2026" / f"{name}.json", "w"), ensure_ascii=False, indent=1)

    sql.append("  insert into tests(owner_id, title, description, duration_minutes, is_published, invite_only, shuffle_questions,")
    sql.append("                    shuffle_options, max_violations, pass_mark, domain_floors, interview_guide)")
    sql.append(f"    values (v_owner, {q(m.TITLE)}, {q(desc)}, {duration}, false, true, true, true, 3, {pass_mark},")
    sql.append(f"            {q(json.dumps(floors, ensure_ascii=False))}::jsonb, {q(guide)}) returning id into v_test;")
    for it in items:
        grp = f"'{it['variant_group']}'" if it["variant_group"] else "null"
        if it["type"] == "terminal":
            sql.append(f"  insert into questions(test_id, position, type, prompt, points, domain) values (v_test, {it['position']}, 'terminal', {q(it['prompt'])}, {it['points']}, {q(it['domain'])}) returning id into v_q;")
            sql.append(f"  insert into question_terminals(question_id, scenario, flag) values (v_q, {q(json.dumps(it['scenario'], ensure_ascii=False))}::jsonb, null);")
            continue
        sql.append(f"  insert into questions(test_id, position, type, prompt, options, points, domain, variant_group) values (v_test, {it['position']}, '{it['type']}', {q(it['prompt'])}, {q(json.dumps(it['options'], ensure_ascii=False))}::jsonb, 1, {q(it['domain'])}, {grp}) returning id into v_q;")
        sql.append(f"  insert into answer_keys(question_id, correct) values (v_q, '{json.dumps(it['correct'])}'::jsonb);")

sql += ["end", "$seed$;", ""]
(OUT / "admission-2026.sql").write_text("\n".join(sql))
