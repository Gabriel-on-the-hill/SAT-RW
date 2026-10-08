#!/usr/bin/env python3
"""PHASE 1 — read the College Board question-bank PDFs and decide what is new.

  python kit/extract.py CONFIG

Text comes from `pdftotext -raw` only (exact characters; -layout misplaces dashes and quotes).
Writes WORK/extracted.json and WORK/phase1-report.json. Stops (exit 2) on anything a human must decide:
a content match in the 0.85–0.93 band, an unparseable item, or an export for the wrong assessment."""
import json, os, re, subprocess, sys, hashlib
from difflib import SequenceMatcher
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

def safe_fix(t):
    if not t: return t
    t = re.sub(r"[ \t]+([,.;!?])", r"\1", t)
    for a, b in [("ﬀ", "ff"), ("ﬁ", "fi"), ("ﬂ", "fl"), ("ﬃ", "ffi"), ("ﬄ", "ffl")]:
        t = t.replace(a, b)
    return t.replace("______blank", "______")
def one_line(s): return safe_fix(re.sub(r"\s+", " ", (s or "").strip()))
def norm(t):
    if not t: return t
    out = []
    for p in re.split(r"\n{4,}", t.replace("\r", "")):
        p = re.sub(r"[ \t]{2,}", " ", re.sub(r"\s*\n\s*", " ", p)).strip()
        if p and not re.fullmatch(r"[‘’'\"().,;:—–\-\s]+", p): out.append(safe_fix(p))
    return safe_fix("\n\n".join(out))

def parse_block(block, cfg):
    rec = {"flags": []}
    flat = re.sub(r"\s+", " ", block)
    mid = re.search(r"Question ID:\s*([0-9a-fA-F]+)", block)
    if not mid: return None
    rec["id"] = mid.group(1)
    head = flat[:400]
    if cfg["assessment_label"] not in head: rec["flags"].append("WRONG ASSESSMENT")
    diff = re.search(r"\b(Easy|Medium|Hard)\b", block); rec["difficulty"] = diff.group(1) if diff else None
    rec["skill"] = "Unknown"
    for prefix, name in cfg["skill_prefixes"]:
        if prefix.lower() in head.lower(): rec["skill"] = name; break
    if rec["skill"] == "Unknown" and "Text 1" in flat and "Text 2" in flat: rec["skill"] = cfg.get("cross_text_skill", "Unknown")
    mbody = re.search(r"(?ms)^\s*Question\s*$(.*?)^\s*Answer\s*$", block); body = mbody.group(1) if mbody else ""
    mans = re.search(r"Correct Answer:\s*([A-D])", block); rec["answer"] = mans.group(1) if mans else None
    mrat = re.search(r"\bRationale\b(.*)$", block, re.S); rec["explanation"] = norm(mrat.group(1)) if mrat else ""
    # options line by line: a line opens a new option only if it starts with the NEXT expected letter,
    # so "B. terrenus" or "A. fasciatus" inside an option cannot be read as a label
    rec["options"] = []
    mo = re.search(r"(?ms)^Answer\n(.*?)^Correct Answer:", block)
    if mo:
        opts = []
        for ln in mo.group(1).split("\n"):
            ln = ln.strip()
            if not ln: continue
            if len(opts) < 4 and ln.startswith("ABCD"[len(opts)] + ". "): opts.append(ln)
            elif opts: opts[-1] += " " + ln
        rec["options"] = [o[:3] + one_line(o[3:]) for o in opts]
    # passage / prompt split: the LAST standard prompt opening wins (a passage may itself ask "What is…?")
    nb = body.strip()
    starts = list(re.finditer(cfg["prompt_regex"], nb))
    if starts:
        k = starts[-1].start(); rec["passage"] = norm(nb[:k]); rec["question"] = one_line(nb[k:])
    else:
        flatb = re.sub(r"\s+", " ", nb).strip(); m2 = re.search(r"([A-Z][^.?!]*\?)\s*$", flatb)
        if m2: rec["passage"], rec["question"] = norm(flatb[:m2.start()]), one_line(m2.group(1))
        else: rec["passage"], rec["question"] = norm(nb), ""
        rec["flags"].append("PROMPT: no standard prompt opening; check the split")
    # figure items: a prompt that names a graph/table/chart/figure
    if rec["skill"] == cfg["evidence_skill"]:
        rec["skill"] = cfg["figure_skill"] if re.search(r"\b(graph|table|chart|figure|map)\b", rec["question"], re.I) else cfg["textual_skill"]
    if rec["skill"] == cfg["figure_skill"]: rec["flags"].append("FIGURE")
    if "underlined" in (rec["question"] + " " + rec["passage"]).lower(): rec["flags"].append("UNDERLINE")
    if not rec["answer"] or len(rec["options"]) != 4 or not rec["question"]: rec["flags"].append("PARSE")
    return rec

def blocks_of(raw):
    pages = raw.split("\f"); offs, acc = [], 0
    for pg in pages: offs.append(acc); acc += len(pg) + 1
    full = "\f".join(pages)
    starts = [(i, offs[i] + m.start()) for i, pg in enumerate(pages) for m in re.finditer(r"Question ID:", pg)]
    for k, (pi, p) in enumerate(starts):
        yield pi, full[p: starts[k + 1][1] if k + 1 < len(starts) else len(full)].replace("\f", "\n")

def generic_source_repairs(block):
    # options numbered 1-4 instead of A-D
    if re.search(r"(?m)^Answer\n1\. ", block):
        block = re.sub(r"(?m)^([1-4])\. ", lambda m: "ABCD"[int(m.group(1)) - 1] + ". ", block)
    return block

def main(cfg):
    require_owner_confirmation(cfg)
    ov = json.load(open(cfg["overrides"], encoding="utf-8")) if cfg.get("overrides") else {}
    for qid, repair in ov.items():
        if qid.startswith("_"): continue
        if not repair.get("why", "").strip(): raise SystemExit(f"STOP: override {qid} needs why")
    os.makedirs(wpath(cfg, "cache"), exist_ok=True)
    recs, problems = [], []
    for pdf in cfg["pdfs"]:
        cache = wpath(cfg, "cache", pdf + ".txt")
        pdfpath = os.path.join(cfg["pdf_dir"], pdf)
        digest = hashlib.sha256(open(pdfpath, "rb").read()).hexdigest()
        meta = cache + ".sha256"
        if os.path.exists(cache) and (not os.path.exists(meta) or open(meta).read() != digest):
            raise SystemExit(f"STOP: source changed for {pdf}; use a fresh work_dir")
        if not os.path.exists(cache):
            result = subprocess.run(["pdftotext", "-raw", pdfpath, "-"], capture_output=True, encoding="utf-8", errors="strict")
            if result.returncode or "Question ID:" not in result.stdout:
                raise SystemExit(f"STOP: {pdf} failed or contained no questions: {result.stderr}")
            raw = result.stdout
            open(cache, "w", encoding="utf-8").write(raw)
            open(meta, "w").write(digest)
        raw = open(cache, encoding="utf-8").read()
        for page, block in blocks_of(raw):
            original_block = block
            block = generic_source_repairs(block)
            qid = re.search(r"Question ID:\s*([0-9a-fA-F]+)", block)
            o = ov.get(qid.group(1), {}) if qid else {}
            for a, b in o.get("block_replace", []):
                if block.count(a) != 1: raise SystemExit(f"STOP: block override {qid.group(1)} must match exactly once")
                block = block.replace(a, b)
            r = parse_block(block, cfg)
            if not r: continue
            for a, b in o.get("passage_replace", []):
                if r["passage"].count(a) != 1: raise SystemExit(f"STOP: passage override {r['id']} must match exactly once")
                r["passage"] = r["passage"].replace(a, b)
            if "question_strip_prefix" in o and r["question"].startswith(o["question_strip_prefix"]):
                r["question"] = r["question"][len(o["question_strip_prefix"]):]
                r["passage"] += o.get("passage_append", "")      # only when the prefix really was there
            r.update({"_source_block": original_block, "_effective_block": block, "_pdf": pdf, "_page": page, "_rawblock_ck": ck(block),
                      "_rawblock_nows": re.sub(r"\s+", "", safe_fix(block))})
            if o: r["flags"].append("OVERRIDE: " + o.get("why", "see overrides file"))
            recs.append(r)
            if any(f in r["flags"] for f in ("PARSE", "WRONG ASSESSMENT")) or r["skill"] == "Unknown":
                problems.append((r["id"], pdf, r["skill"], [f for f in r["flags"] if not f.startswith("OVERRIDE")]))

    banks = load_banks(cfg); bank = all_records(banks)
    # retired records still count: an official copy of one comes in with the retired id as its alias
    rf = (cfg.get("retire") or {}).get("retired_file")
    if rf and os.path.exists(os.path.join(cfg["app_dir"], rf)):
        s = open(os.path.join(cfg["app_dir"], rf), encoding="utf-8").read()
        bank = bank + [dict(q, **{cfg["origin_field"]: q.get(cfg["origin_field"])}) for q in json.loads(s[s.index('['):s.rindex(']') + 1])]
    official_ids, retiring_alias = set(), {}
    for q in bank:
        for i in [q["id"]] + list(q.get("altIds") or []):
            (official_ids.add(i) if not is_retiring(cfg, q) else retiring_alias.__setitem__(i, q["id"]))
    seen_ids = {}
    for r in recs:
        if r["id"] in seen_ids: problems.append((r["id"], "appears twice in the exports", seen_ids[r["id"]], r["_pdf"]))
        seen_ids[r["id"]] = r["_pdf"]
    in_bank = [r for r in recs if r["id"] in official_ids]
    cand = [r for r in recs if r["id"] not in official_ids]
    for r in cand:
        if r["id"] in retiring_alias and retiring_alias[r["id"]] != r["id"]:
            r["altIds"] = [retiring_alias[r["id"]]]; r["flags"].append("REPLACES " + retiring_alias[r["id"]])
    keys = {q["id"]: qkey(q) for q in bank}; org = {q["id"]: q for q in bank}
    hashes = {}
    for q in bank: hashes.setdefault(qhash(q), q["id"])
    exact, near, band, new = [], [], [], []
    adjudicated = {k: v for k, v in ov.items() if "duplicate_of" in v or "not_duplicate_of" in v}
    bank_digest = hashlib.sha256(json.dumps(bank, ensure_ascii=False, sort_keys=True).encode()).hexdigest()
    cache_path = wpath(cfg, "dedup-cache.json")
    cached = json.load(open(cache_path, encoding="utf-8")) if os.path.exists(cache_path) else {}
    cached = cached.get("matches", {}) if cached.get("bank_digest") == bank_digest else {}
    matched = {}
    for r in cand:
        k = qkey(r); hit, ratio = hashes.get(hashlib.md5(k.encode()).hexdigest()), 1.0
        if r["id"] in cached and cached[r["id"]]["key"] == k:
            hit, ratio = cached[r["id"]]["hit"], cached[r["id"]]["ratio"]
        elif not hit:
            best = (0, None)
            for bid, kk in keys.items():
                if abs(len(kk) - len(k)) > 0.15 * max(len(k), 1): continue
                sm = SequenceMatcher(None, k, kk)
                if sm.real_quick_ratio() < 0.85 or sm.quick_ratio() < 0.85: continue
                rt = sm.ratio()
                if rt > best[0]: best = (rt, bid)
            ratio, hit = best
            if ratio < 0.85: hit = None
        matched[r["id"]] = {"key": k, "hit": hit, "ratio": ratio}
        a = adjudicated.get(r["id"], {})
        if hit and a.get("not_duplicate_of") == hit: hit = None
        if hit and (ratio >= 0.93 or a.get("duplicate_of") == hit):
            if not is_retiring(cfg, org[hit]):
                (exact if ratio == 1.0 else near).append([r["id"], hit, round(ratio, 4)]); continue
            r["altIds"] = list(dict.fromkeys([hit] + list(org[hit].get("altIds") or []))); r["flags"].append("REPLACES " + hit)
        elif hit:
            band.append([r["id"], hit, round(ratio, 4)]); continue
        new.append(r)
    inbatch = {}
    for r in new: inbatch.setdefault(qkey(r), []).append(r["id"])
    inbatch = [v for v in inbatch.values() if len(v) > 1]
    save(cfg, "dedup-cache.json", {"bank_digest": bank_digest, "matches": matched})
    save(cfg, "extracted.json", {"all": recs, "new": new})
    report = {"extracted": len(recs), "already_in_bank": len(in_bank), "duplicate_exact": exact, "duplicate_near": near,
              "review_band": band, "in_batch_duplicates": inbatch, "new": len(new), "problems": problems}
    save(cfg, "phase1-report.json", report)
    print(f"extracted {len(recs)} | already in bank {len(in_bank)} | exact dup {len(exact)} | near dup {len(near)} | "
          f"REVIEW BAND {len(band)} | new {len(new)} | problems {len(problems)}")
    ok = gate(bool(recs), "at least one question extracted")
    ok &= gate(len(recs) == len(in_bank) + len(exact) + len(near) + len(band) + len(new), "every extracted question is accounted for")
    ok &= gate(not band, "no content match left for a human in the 0.85–0.93 band (adjudicate in overrides)", band)
    ok &= gate(not inbatch, "no question appears twice in the batch", inbatch)
    ok &= gate(not problems, "every question parsed cleanly (fix with overrides or a generic repair)", problems)
    sys.exit(0 if ok else 2)

if __name__ == "__main__": main(load_config(sys.argv[1]))
