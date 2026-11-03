"""Exporte les QCM de Dylan (avec leurs variantes) pour l'éditeur d'épreuves.
Usage : python3 supabase/seed/admission-2026/src/export_editor.py  (après gen.py)
Sortie : public/banque/qcm-dylan.json, chargé à la demande par l'éditeur.
"""
import json, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[4]
SEED = ROOT / "supabase" / "seed" / "admission-2026"
OUT = ROOT / "public" / "banque" / "qcm-dylan.json"
LABEL = {"b1": "Bachelor 1 Cyber", "b3": "Bachelor 3 Cyber", "mastere": "Mastère 1 Cyber"}
VERSION = {"b1": "v2", "b3": "v5", "mastere": "v2"}

bank = {}
for name in ["b1", "b3", "mastere"]:
    d = json.loads((SEED / f"{name}.json").read_text())
    qs = [{"type": q["type"], "prompt": q["prompt"], "domain": q["domain"], "points": q["points"],
           "options": q["options"], "correct": q["correct"], "explanation": q.get("explanation"),
           "variant_group": q["variant_group"], "variant": q["variant"]}
          for q in d["questions"] if q["type"] in ("mcq_single", "mcq_multi")]
    domains = []
    for q in qs:
        if q["domain"] not in domains:
            domains.append(q["domain"])
    bank[name] = {"label": LABEL[name], "version": VERSION[name], "domains": domains, "questions": qs}

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(bank, ensure_ascii=False, separators=(",", ":")))
print(OUT, sum(len(b["questions"]) for b in bank.values()), "questions")
