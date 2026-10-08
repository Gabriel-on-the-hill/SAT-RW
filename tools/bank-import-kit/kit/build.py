#!/usr/bin/env python3
"""PHASE 4 — build the new bank files into WORK/out/ (the app is not touched).

  python kit/build.py CONFIG

 - appends the new official questions, fields in the order the config's `record` template gives
 - retire policy (optional, config `retire`): records whose origin is listed move to the retired file,
   which no page loads; records named by id in a plan/set file stay, marked `retireAfter`
 - official copies whose alias is a held record are deferred (challenge pages look up by id only)
 - bumps the ?v= tag of every changed data file in every page that loads it (copies in WORK/out/)
Writes WORK/out/* and WORK/manifest.json."""
import json, os, re, sys, glob, datetime, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
from ruletype import classify

def figure_title(r, g, rawp):
    lines = sorted(g["lines"], key=lambda l: (l['page'], l['top']))
    if not lines: return ""
    take = [lines[0]]
    for l in lines[1:4]:
        prev = take[-1]
        c, c0 = (l['x0'] + l['x1']) / 2, (take[0]['x0'] + take[0]['x1']) / 2
        num = sum(bool(re.fullmatch(r"[\d.,%–-]+", w)) for w in l['words'])
        wide = (l['x1'] - l['x0']) > 1.6 * (take[0]['x1'] - take[0]['x0'])
        if wide or l['page'] != prev['page'] or l['top'] - prev['top'] > 22 or abs(c - c0) > 60 or num > len(l['words']) / 2: break
        take.append(l)
    key = ck(" ".join(l['text'] for l in take))
    if not key or re.fullmatch(r"\d+", key): return ""
    rawp = re.sub(r"\s+", " ", rawp); idx, stream = align_index(rawp); p = stream.find(key)
    if p >= 0: return rawp[idx[p]: idx[p + len(key) - 1] + 1].strip()
    return re.sub(r"\s+’\s*s\b", "’s", " ".join(l['text'] for l in take)).strip()

def make_record(cfg, r, extra):
    src = dict(r, **extra); rec = {}
    for name, how in cfg["record"]:
        opt = how.endswith("?"); how = how.rstrip("?")
        if how.startswith("const:"): rec[name] = how[6:]
        elif how.startswith("copy:"): rec[name] = src[how[5:]]
        elif how == "altIds": rec[name] = list(src.get("altIds") or [])
        elif how in src and (src[how] is not None or not opt): rec[name] = src[how]
        elif not opt: raise SystemExit(f"STOP: {r['id']} has no value for required field {name}")
    return rec

def main(cfg):
    require_owner_confirmation(cfg)
    out = wpath(cfg, "out")
    from pathlib import Path
    import shutil, time
    work = Path(cfg["work_dir"]).resolve(); op = Path(out).resolve()
    if not op.is_relative_to(work) or op.name != "out": raise SystemExit("STOP: unsafe staging path")
    if op.exists():
        archive = work / "build-archive"; archive.mkdir(exist_ok=True)
        shutil.move(str(op), str(archive / str(time.time_ns())))
    os.makedirs(out)
    if Path(wpath(cfg, "figures")).exists(): shutil.copytree(wpath(cfg, "figures"), out, dirs_exist_ok=True)
    banks = load_banks(cfg); allq = all_records(banks)
    official = {i for q in allq if not is_retiring(cfg, q) for i in [q["id"]] + list(q.get("altIds") or [])}
    ret = cfg.get("retire") or {}
    refs = {}
    for rel in ret.get("plan_files", []):
        p = os.path.join(cfg["app_dir"], rel)
        if os.path.exists(p):
            t = open(p, encoding="utf-8").read()
            for q in allq:
                if q["id"] in t: refs.setdefault(q["id"], set()).add(rel)
    extracted = load(cfg, "extracted.json")
    raw = {r["id"]: r for r in extracted["new"]}
    all_sources = {r["id"]: r for r in extracted["all"]}
    data = load(cfg, "assembled.json")["new"]
    rt_cfg = cfg.get("ruletype") or {}
    new_by, review, deferred = collections.defaultdict(list), [], []
    for r in data:
        if r["id"] in official: raise SystemExit(f"STOP: {r['id']} is already an official record")
        if ret and set(r.get("altIds") or []) & set(refs):
            deferred.append([r["id"], r["altIds"]]); continue
        extra = {"strategy": cfg.get("strategies", {}).get(r["skill"], ""), "psatDifficulty": {"Easy":"Medium", "Medium":"Hard", "Hard":"Hard"}[r["difficulty"]]}
        if r["skill"] in rt_cfg.get("skills", []):
            t, conf = classify(r); extra["ruleType"] = t
            if conf == "low" or cfg.get("review_all_ruletypes", True): review.append([r["id"], r["skill"], r["difficulty"], t])
        if r["skill"] == cfg["figure_skill"]:
            g = json.load(open(wpath(cfg, "geo", r["id"] + ".json"), encoding="utf-8"))
            title = figure_title(r, g, raw[r["id"]]["passage"])
            extra.update({"passage": "", "image": r["image"],
                          "alt": "Data figure and accompanying text: " + re.sub(r"\s+", " ", raw[r["id"]]["passage"]).strip()})
        dom = cfg["skill_bank"][r["skill"]]
        new_by[dom].append(make_record(cfg, r, extra))
    retired, held = [], []
    follow = (datetime.date.fromisoformat(cfg["today"]) + datetime.timedelta(days=ret.get("follow_up_days", 7))).isoformat() if ret else None
    for k in banks:
        head, arr, tail = banks[k]; keep = []
        for q in arr:
            additions = cfg.get("alias_additions", {}).get(q["id"], [])
            if additions: q = dict(q, altIds=list(dict.fromkeys(list(q.get("altIds") or []) + additions)))
            repair = cfg.get("existing_repairs", {}).get(q["id"])
            if repair:
                if not repair.get("why"): raise SystemExit("STOP: existing repair needs why")
                q = dict(q, **source_repair_values(q, repair, all_sources))
            if ret and is_retiring(cfg, q):
                q = dict(q)
                if q["id"] in refs:            # still named by a plan or set: hold it, dated
                    q.setdefault("retireAfter", follow); keep.append(q)
                    held.append([q["id"], q.get(cfg["origin_field"]), q["skill"], q.get("psatDifficulty", q.get("difficulty")), sorted(refs[q["id"]])])
                else:                          # nothing names it: hide it
                    q.pop("retireAfter", None); q["retiredOn"] = cfg["today"]; q["retiredFrom"] = cfg["banks"][k]["file"]; retired.append(q)
            else:
                keep.append(q)
        banks[k] = (head, keep + new_by[k], tail)
    changed = []
    for k, b in cfg["banks"].items():          # only files whose records actually changed
        live = read_bank(os.path.join(cfg["app_dir"], b["file"]))[1]
        if live != banks[k][1]:
            write_bank(os.path.join(out, b["file"]), *banks[k]); changed.append(b["file"])
    if ret and retired:
        rf = ret["retired_file"]; prior = []
        live_rf = os.path.join(cfg["app_dir"], rf)
        if os.path.exists(live_rf):
            s = open(live_rf, encoding="utf-8").read(); prior = json.loads(s[s.index('['):s.rindex(']') + 1])
        os.makedirs(os.path.dirname(os.path.join(out, rf)), exist_ok=True)
        open(os.path.join(out, rf), "w", encoding="utf-8").write(
            "// RETIRED QUESTIONS. Not loaded by any page, so no draw can reach them.\n"
            "// " + ret.get("note", "Retired by the bank-import kit.") + "\n"
            "// To bring one back, move its record into the data file named in `retiredFrom` and delete\n"
            "// `retiredOn` / `retiredFrom`. Ids are permanent; never renumber.\n"
            "const " + ret["retired_var"] + " = " + json.dumps(prior + retired, ensure_ascii=False, indent=2) + ";\n")
    tag = cfg.get("release_tag", cfg["today"].replace("-", "")); pages = []
    for pat in cfg.get("pages", ["*.html"]):
        for p in glob.glob(os.path.join(cfg["app_dir"], pat), recursive=True):
            s = open(p, encoding="utf-8", newline="").read(); t = s   # newline="": keep CRLF pages CRLF
            for f in changed + cfg.get('cache_tag_repairs', []): t = re.sub(re.escape(f) + r"\?v=\d{8}(?:&rev=[^\"\'\s<>]+)?", f + "?v=" + tag, t)
            if t != s:
                rel = os.path.relpath(p, cfg["app_dir"]); os.makedirs(os.path.dirname(os.path.join(out, rel)) or out, exist_ok=True)
                open(os.path.join(out, rel), "w", encoding="utf-8", newline="").write(t); pages.append(rel)
    save(cfg, "manifest.json", {"new": {k: [q["id"] for q in v] for k, v in new_by.items()}, "retired": [q["id"] for q in retired],
                                "held": held, "deferred": deferred, "ruletype_review": review, "pages_retagged": pages, "files_changed": changed,
                                "repaired": cfg.get("existing_repairs", {}), "alias_additions": cfg.get("alias_additions", {}), "bank_totals": {k: len(banks[k][1]) for k in banks}})
    print("new:", {k: len(v) for k, v in new_by.items()}, "| retired:", len(retired), "| held:", len(held),
          "| deferred:", len(deferred), "| ruleType to review:", len(review), "| pages retagged:", len(pages))
    print("bank totals:", {k: len(banks[k][1]) for k in banks})

if __name__ == "__main__": main(load_config(sys.argv[1]))
