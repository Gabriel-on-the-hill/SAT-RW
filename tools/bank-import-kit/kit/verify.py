#!/usr/bin/env python3
"""PHASE 5 — gates. Every gate must PASS before anything is copied into the app.

  python kit/verify.py CONFIG [--run-tests]

Checks WORK/out/ against the extraction and the geometry, writes the human-review pack to
WORK/review/ (figure contact sheets, a rendered sample, the ruleType list), and with --run-tests
overlays WORK/out/ on a temporary copy of the app and runs the app's own test command."""
import json, os, re, sys, glob, random, shutil, subprocess, tempfile, html, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

def main(cfg, run_tests=False):
    require_owner_confirmation(cfg)
    out = wpath(cfg, "out"); rv = wpath(cfg, "review"); os.makedirs(rv, exist_ok=True)
    p1, man = load(cfg, "phase1-report.json"), load(cfg, "manifest.json")
    ext = load(cfg, "extracted.json"); raw = {r["id"]: r for r in ext["all"]}
    asm = {r["id"]: r for r in load(cfg, "assembled.json")["new"]}
    banks = {k: read_bank(os.path.join(out if os.path.exists(os.path.join(out, b["file"])) else cfg["app_dir"], b["file"]))
             for k, b in cfg["banks"].items()}
    QB = all_records(banks); byid = {q["id"]: q for q in QB}
    added = [i for v in man["new"].values() for i in v]; NEW = [byid[i] for i in added]
    ok = True
    print("Accounting")
    ok &= gate(p1["extracted"] == p1["already_in_bank"] + len(p1["duplicate_exact"]) + len(p1["duplicate_near"]) + len(p1["review_band"]) + p1["new"],
               f"extracted {p1['extracted']} = in bank {p1['already_in_bank']} + duplicates {len(p1['duplicate_exact']) + len(p1['duplicate_near'])} + new {p1['new']}")
    ok &= gate(p1["new"] == len(added) + len(man["deferred"]), f"new {p1['new']} = added {len(added)} + deferred {len(man['deferred'])}")
    ok &= gate(not p1["review_band"], "no unadjudicated review-band match")
    print("Identity")
    ids = [q["id"] for q in QB]; dup = [i for i, n in collections.Counter(ids).items() if n > 1]
    ok &= gate(not dup, "every id is unique across the bank files", dup)
    canon = set(ids); bad = [(a, q["id"]) for q in QB for a in q.get("altIds") or [] if a in canon or a == q["id"]]
    ok &= gate(not bad, "aliases never collide with a drawable id", bad)
    keyf = lambda q: clean(q.get("passage") or q.get("alt") or q.get("image")) + clean(q.get("question"))
    seen, dups = {}, []
    for q in QB:
        k = keyf(q); (dups.append((seen[k], q["id"])) if k in seen else seen.__setitem__(k, q["id"]))
    ok &= gate(not dups, "no passage + prompt appears twice", dups[:10])
    print("Each new question against its source")
    st = [q["id"] for q in NEW if [o[:2] for o in q["options"]] != ["A.", "B.", "C.", "D."] or q["answer"] not in "ABCD"
          or not q["question"] or len(q["explanation"]) < 80 or (not q.get("image") and not q["passage"].strip())]
    ok &= gate(not st, "four options labelled A–D, an answer, a prompt, a rationale, a passage or figure", st)
    # exact characters, punctuation included (in Conventions the punctuation IS the question);
    # only whitespace is ignored, since repair adds paragraph breaks and splits run-together words
    nows = lambda t: re.sub(r"\s+", "", re.sub(r"</?u>", "", t or ""))
    exn = {r["id"]: r for r in ext["new"]}
    badopt = [q["id"] for q in NEW if not all(nows(o) in raw[q["id"]]["_rawblock_nows"] for o in q["options"])]
    ok &= gate(not badopt, "every option appears character for character in its source block", badopt)
    badq = [q["id"] for q in NEW if nows(q["question"]) not in raw[q["id"]]["_rawblock_nows"]]
    ok &= gate(not badq, "every prompt appears character for character in its source block", badq)
    badans = [q["id"] for q in NEW if q["answer"] != raw[q["id"]]["answer"] or ("CorrectAnswer:" + q["answer"]) not in raw[q["id"]]["_rawblock_nows"]]
    ok &= gate(not badans, "every answer key matches the source's Correct Answer", badans)
    chars = [q["id"] for q in NEW if not q.get("image") and nows(q["passage"]) != nows(exn[q["id"]]["passage"])]
    ok &= gate(not chars, "repair changed no character of any passage (only breaks, spaces and <u>)", chars)
    src = [q["id"] for q in NEW if not q.get("image") and "OVERRIDE" not in " ".join(raw[q["id"]]["flags"])
           and nows(exn[q["id"]]["passage"]).replace("______", "") not in raw[q["id"]]["_rawblock_nows"].replace("______blank", "").replace("______", "")]
    ok &= gate(not src, "every passage appears character for character in its source block", src)
    badu = []
    for q in NEW:
        if "<u>" in q["passage"] or "UNDERLINE" in raw[q["id"]]["flags"]:
            g = json.load(open(wpath(cfg, "geo", q["id"] + ".json"), encoding="utf-8"))
            if q.get("image"): continue
            if ck(" ".join(w for l in g["lines"] for w in l["u"])) != ck(" ".join(re.findall(r"<u>(.*?)</u>", q["passage"], re.S))): badu.append(q["id"])
    ok &= gate(not badu, "underlined text equals what the PDF underlines", badu)
    nest = [q["id"] for q in QB if q["passage"].count("<u>") != q["passage"].count("</u>") or re.search(r"<u>(?:(?!</u>)[\s\S])*<u>", q["passage"])]
    ok &= gate(not nest, "no unbalanced or nested <u>", nest)
    print("Figures")
    figs = [q for q in NEW if q.get("image")]; missing = []; dims = []
    try:
        from PIL import Image
    except ImportError: Image = None
    for q in figs:
        p = os.path.join(out, q["image"])
        if not os.path.exists(p) or os.path.getsize(p) < 1000: missing.append(q["id"]); continue
        if Image:
            w, h = Image.open(p).size
            if not (80 <= h <= 3000): dims.append((q["id"], w, h))
    ok &= gate(not missing, f"{len(figs)} figure images exist and are not empty", missing)
    ok &= gate(not dims, "every crop has a plausible height (80–3000 px)", dims)
    alts = collections.Counter(q.get("alt") for q in figs)
    ok &= gate(all(q.get("alt") and alts[q["alt"]] == 1 for q in figs), "every figure has its own alt text",
               [q["id"] for q in figs if not q.get("alt") or alts[q["alt"]] > 1])
    asks = lambda q: re.search(r"\b(graph|table|chart|figure|map)\b", q.get("question", ""), re.I)
    mis = [q["id"] for q in QB if asks(q) and q["skill"] != cfg["figure_skill"] and q["skill"] in (cfg["figure_skill"], cfg["textual_skill"])]
    ok &= gate(not mis, "every question that asks about a graph/table is filed as the figure skill", mis)
    rt = cfg.get("ruletype")
    if rt:
        print("Rule types")
        voc = rt["vocabulary"]
        off = [q["id"] for q in QB if q["skill"] in voc and q.get(rt.get("field", "ruleType")) not in voc[q["skill"]]]
        ok &= gate(not off, "every rule-tagged skill carries a ruleType from the fixed vocabulary", off[:20])
    ret = cfg.get("retire")
    if ret:
        print("Retirement")
        rf = os.path.join(out, ret["retired_file"])
        if not os.path.exists(rf): rf = os.path.join(cfg["app_dir"], ret["retired_file"])
        s = open(rf, encoding="utf-8").read() if os.path.exists(rf) else "[]"
        R = json.loads(s[s.index('['):s.rindex(']') + 1])
        back = [q["id"] for q in R if q["id"] in canon]
        ok &= gate(not back, "no retired record is in a bank file", back)
        loaders = []
        for base, dirs, files in os.walk(cfg["app_dir"]):
            dirs[:] = [d for d in dirs if d not in {".git", "node_modules", "_bank-import-work", "_extract", "__pycache__", "bank-import-kit"}]
            for name in files:
                p = os.path.join(base, name); rel = os.path.relpath(p, cfg["app_dir"])
                if not re.search(r"\.(html|js)$", p) or rel == ret["retired_file"] or ".test." in name: continue
                t = open(os.path.join(out, rel), encoding="utf-8").read() if os.path.exists(os.path.join(out, rel)) else open(p, encoding="utf-8", errors="ignore").read()
                if os.path.basename(ret["retired_file"]) in t or ret["retired_var"] in t: loaders.append(rel)
        ok &= gate(not loaders, "no page or script loads the retired file", loaders)
        ok &= gate(all(not is_official(cfg, q) for q in QB if q.get("retireAfter")), "only retiring-origin records carry retireAfter")
    print("Format and cache")
    tag = cfg.get("release_tag", cfg["today"].replace("-", "")); stale = []
    for pat in cfg.get("pages", ["*.html"]):
        for p in glob.glob(os.path.join(cfg["app_dir"], pat), recursive=True):
            rel = os.path.relpath(p, cfg["app_dir"]); t = open(os.path.join(out, rel) if os.path.exists(os.path.join(out, rel)) else p, encoding="utf-8", newline="").read()
            if os.path.exists(os.path.join(out, rel)) and (b"\r\n" in open(p, "rb").read()) != (b"\r\n" in open(os.path.join(out, rel), "rb").read()):
                stale.append((rel, "line endings changed"))
            for b in cfg["banks"].values():
                if b["file"] not in man.get("files_changed", [b["file"]]): continue
                for m in re.finditer(re.escape(b["file"]) + r"\?v=(\d{8}(?:&rev=[^\"\'\s<>]+)?)", t):
                    if m.group(1) != tag: stale.append((rel, b["file"], m.group(1)))
    ok &= gate(not stale, "every page loads the changed data files with today's tag", stale)
    # ---- review pack
    review = ["# Human review pack\n", f"{len(figs)} figure crops: open `figures_*.png` and look at every one.",
              f"{len(man['ruletype_review'])} ruleType proposals to confirm (below).", "`sample.html`: a rendered sample of the text items — skim for broken paragraphs, stray marks, wrong underlines.\n"]
    for i, sk, d, t in man["ruletype_review"]:
        q = byid[i]; k = q["passage"].find("______")
        review.append(f"- `{i}` {sk} · {d} · proposed **{t}** — …{q['passage'][max(0, k - 70):k + 50]}… — answer {q['answer']}: " + " · ".join(q["options"]))
    open(os.path.join(rv, "REVIEW.md"), "w", encoding="utf-8").write("\n".join(review) + "\n")
    if Image and figs:
        W, cols, per = 600, 3, 12
        for s0 in range(0, len(figs), per):
            tiles = []
            for q in figs[s0:s0 + per]:
                im = Image.open(os.path.join(out, q["image"])).convert("RGB"); im = im.resize((W, int(im.height * W / im.width)))
                from PIL import ImageDraw
                d = ImageDraw.Draw(im); d.rectangle([0, 0, 90, 16], fill="yellow"); d.text((3, 2), q["id"], fill="black"); tiles.append(im)
            rows = [tiles[i:i + cols] for i in range(0, len(tiles), cols)]
            sheet = Image.new("RGB", (cols * (W + 8), sum(max(t.height for t in r) + 8 for r in rows)), "gray"); y = 0
            for r in rows:
                x = 0
                for t in r: sheet.paste(t, (x, y)); x += W + 8
                y += max(t.height for t in r) + 8
            sheet.save(os.path.join(rv, f"figures_{s0 // per:02d}.png"))
    random.seed(1); bysk = collections.defaultdict(list)
    for q in NEW:
        if not q.get("image"): bysk[q["skill"]].append(q)
    parts = ["<!doctype html><meta charset=utf-8><title>Import sample</title><style>body{font:15px/1.5 Georgia,serif;max-width:760px;margin:24px auto;padding:0 16px}"
             ".q{border-top:1px solid #ccc;padding:14px 0}.m{font:12px monospace;color:#666}p{margin:.5em 0}</style>"]
    for sk, qs in sorted(bysk.items()):
        for q in random.sample(qs, min(4, len(qs))):
            body = "".join("<p>" + html.escape(p).replace("&lt;u&gt;", "<u>").replace("&lt;/u&gt;", "</u>") + "</p>" for p in q["passage"].split("\n\n"))
            parts.append(f"<div class=q><div class=m>{q['id']} · {html.escape(sk)} · {q['difficulty']}</div>{body}<p><b>{html.escape(q['question'])}</b></p>"
                         + "".join(f"<div>{html.escape(o)}</div>" for o in q["options"]) + f"<div class=m>answer {q['answer']}</div><p>{html.escape(q['explanation'])}</p></div>")
    open(os.path.join(rv, "sample.html"), "w", encoding="utf-8").write("\n".join(parts))
    if run_tests and cfg.get("test_command"):
        print("App test suite on a copy with WORK/out/ overlaid")
        td = tempfile.mkdtemp(); app_copy = os.path.join(td, os.path.basename(cfg["app_dir"]))
        shutil.copytree(cfg["app_dir"], app_copy, ignore=shutil.ignore_patterns(".git", "node_modules", "*.pdf", "_bank-import-work", "_extract", "__pycache__"))
        for p in glob.glob(os.path.join(out, "**", "*"), recursive=True):
            if os.path.isfile(p):
                dst = os.path.join(app_copy, os.path.relpath(p, out)); os.makedirs(os.path.dirname(dst), exist_ok=True); shutil.copy(p, dst)
        r = subprocess.run(cfg["test_command"], shell=isinstance(cfg["test_command"], str), cwd=app_copy, capture_output=True, text=True, encoding="utf-8", errors="replace")
        open(os.path.join(rv, "tests.txt"), "w").write(r.stdout + r.stderr)
        ok &= gate(r.returncode == 0, "app test suite passes", (r.stdout + r.stderr)[-1200:])
    from safety import strict_gates, write_receipt, prepare_mirrors
    ok &= strict_gates(cfg, out, NEW, raw, QB, run_tests)
    if ok and run_tests:
        prepare_mirrors(cfg)
        write_receipt(cfg)
    print("\nALL GATES PASSED" if ok else "\nGATES FAILED — fix and re-run; do not install")
    sys.exit(0 if ok else 1)

if __name__ == "__main__": main(load_config(sys.argv[1]), "--run-tests" in sys.argv)
