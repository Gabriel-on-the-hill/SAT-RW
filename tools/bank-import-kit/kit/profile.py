#!/usr/bin/env python3
"""PHASE 0 — profile an app you have not imported into before, and draft its config.

  python kit/profile.py APP_DIR [PDF ...] > draft.json

Reads every `const NAME = [ ... ]` bank file, checks it round-trips, inventories fields, origins,
skills and difficulties, finds the pages that load each bank and their ?v= tags, the test files,
and (if PDFs are given) the assessment label and skills the exports use. The draft is a starting
point: a human confirms every field before PHASE 1 (see RUNBOOK §2)."""
import json, os, re, sys, glob, subprocess, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import read_bank

app = os.path.abspath(sys.argv[1]); pdfs = sys.argv[2:]
banks, fields, origins, skills, diffs, report = {}, collections.Counter(), collections.Counter(), collections.Counter(), collections.Counter(), {}
for p in sorted(glob.glob(os.path.join(app, "**", "*.js"), recursive=True)):
    if "node_modules" in p or ".test." in p: continue
    head = open(p, encoding="utf-8", errors="ignore").read(300)
    m = re.match(r"\s*(?://[^\n]*\n\s*)*(?:const|var|let)\s+(\w+)\s*=\s*\[", head)
    if not m: continue
    rel = os.path.relpath(p, app)
    try:
        (h, eol), arr, tail = read_bank(p)
    except (SystemExit, ValueError) as e:
        report.setdefault("unparseable_or_not_roundtrip", []).append(rel); continue
    if not arr or not isinstance(arr[0], dict) or "id" not in arr[0]: continue
    key = re.sub(r"^questionBank_?", "", m.group(1)) or m.group(1)
    banks[key] = {"file": rel.replace(os.sep, "/"), "var": m.group(1), "count": len(arr), "eol": "CRLF" if eol == "\r\n" else "LF"}
    for q in arr:
        fields.update(q.keys()); origins[q.get("origin", "(none)")] += 1; skills[q.get("skill")] += 1; diffs[q.get("difficulty")] += 1
    banks[key]["field_order_first_record"] = list(arr[0].keys())
pages = {}
for p in glob.glob(os.path.join(app, "**", "*.html"), recursive=True):
    t = open(p, encoding="utf-8", errors="ignore").read()
    for b in banks.values():
        for mm in re.finditer(re.escape(os.path.basename(b["file"])) + r"(\?v=[^\"']*)?", t):
            pages.setdefault(os.path.relpath(p, app), set()).add(mm.group(0))
tests = sorted(os.path.relpath(p, app) for p in glob.glob(os.path.join(app, "**", "*.test.js"), recursive=True) if "node_modules" not in p)
plan_like = sorted(os.path.relpath(p, app) for p in glob.glob(os.path.join(app, "**", "*.js"), recursive=True)
                   if re.search(r"assign|plan|sets|challenge|class", os.path.basename(p), re.I) and ".test." not in p and "node_modules" not in p)
exports = {}
for pdf in pdfs:
    t = subprocess.run(["pdftotext", "-raw", "-l", "40", pdf, "-"], capture_output=True, text=True).stdout
    heads = re.findall(r"Assessment Test Domain Skill Difficulty\n(.+?)\nQuestion\n", t, re.S)
    exports[os.path.basename(pdf)] = {"questions_in_first_40_pages": t.count("Question ID:"), "header_samples": [re.sub(r"\s+", " ", h)[:120] for h in heads[:5]]}
print(json.dumps({"app_dir": app, "banks": banks, "fields": fields.most_common(), "origins": origins.most_common(),
                  "skills": skills.most_common(), "difficulties": diffs.most_common(),
                  "pages_loading_banks": {k: sorted(v) for k, v in pages.items()}, "test_files": tests,
                  "files_that_may_name_question_ids": plan_like, "exports": exports, "problems": report}, ensure_ascii=False, indent=1, default=list))
