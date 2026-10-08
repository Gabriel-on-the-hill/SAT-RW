#!/usr/bin/env python3
"""PHASE 3 — repair the text from the line geometry.

  python kit/repair.py CONFIG

Characters always come from the -raw text; geometry only decides where breaks and tags go:
paragraph / verse / © breaks, words that -raw ran together, and underlined spans as <u>…</u>.
Writes WORK/assembled.json and WORK/phase3-report.json."""
import json, os, re, statistics, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

def para_breaks(lines):
    """Break before lines[i] when: the previous line stopped early (the next line's first word would
    have fitted on it), the indent steps back or steps in from the intro, or the gap widens.
    A deeper indent INSIDE an indented excerpt is a wrapped verse line, so it joins."""
    if len(lines) < 2: return []
    base = min(l['x0'] for l in lines)
    right = {}
    for l in lines:
        k = round(l['x0'] / 6); right[k] = max(right.get(k, 0), l['x1'])
    gaps = [b['top'] - a['top'] for a, b in zip(lines, lines[1:]) if a['page'] == b['page'] and 0 < b['top'] - a['top'] < 60]
    step = statistics.median(gaps) if gaps else 12
    overall = max(l['x1'] for l in lines)
    count = {}
    for l in lines: k = round(l['x0'] / 6); count[k] = count.get(k, 0) + 1
    cuts = []
    for i, (a, b) in enumerate(zip(lines, lines[1:]), 1):
        first = (b['words'] or [''])[0]
        k = round(a['x0'] / 6)
        # verse: the indented block never comes near the margin, so every line is its own line
        # (continuation lines sit one indent deeper and land in their own group)
        verse = a['x0'] > base + 12 and (right.get(k, 0) < 0.72 * overall or right.get(round((a['x0'] - 18) / 6), overall) < 0.72 * overall)
        blockright = right[round(a['x0'] / 6)]
        short = a['x1'] + 5.2 * len(first) + 6 < blockright
        wrap = b['x0'] > a['x0'] + 12 and a['x0'] > base + 12 and len(b['words']) <= 3   # hanging-indent tail of a long verse line
        indent = abs(b['x0'] - a['x0']) > 12 and not wrap
        gap = a['page'] == b['page'] and (b['top'] - a['top']) > step * 1.45
        if wrap: continue
        if verse or short or indent or gap: cuts.append(i)
    return cuts

def apply_breaks(passage, lines, cuts):
    flat = re.sub(r"\s+", " ", passage).strip()
    target = ck(flat)
    idx = [i for i, ch in enumerate(flat) if ck(ch)]
    lens = [len(ck(l['text'])) for l in lines]
    stream = ck("".join(l['text'] for l in lines))
    if not stream.startswith(target):   # geometry must contain the raw passage as its prefix
        return None
    out, last, pos = [], 0, 0
    starts = [sum(lens[:i]) for i in range(len(lines))]
    for i in cuts:
        p = starts[i]
        if p <= 0 or p >= len(target): continue
        c = idx[p]
        while c > 0 and not flat[c - 1].isspace(): c -= 1
        if c <= last: continue
        out.append(flat[last:c].strip()); last = c
    out.append(flat[last:].strip())
    res = "\n\n".join(x for x in out if x)
    return re.sub(r"[ \t]+(©)", r"\n\n\1", res)

def fix_spacing(text, words):
    vocab = set(ck(w) for w in words if ck(w))
    pairs = {}
    ws = [ck(w) for w in words]
    for a, b in zip(ws, ws[1:]):
        if a and b: pairs[a + b] = (a, b)
    fixed = []
    def rep(m):
        tok = m.group(0); k = ck(tok)
        if k in vocab or k not in pairs or not tok.isalpha(): return tok
        a, b = pairs[k]
        fixed.append(tok)
        return tok[:len(a)] + " " + tok[len(a):]
    return re.sub(r"[A-Za-z]{4,}", rep, text), fixed

def underline_runs(lines, n_passage_lines):
    runs, cur = [], []
    for l in lines[:n_passage_lines]:
        for w, u in zip(l['words'], [w in l['u'] for w in l['words']]):
            pass
    # rebuild with flags in order
    seq = []
    L = lines[:n_passage_lines]
    def find_all(words, u):
        return [i for i in range(len(words) - len(u) + 1) if words[i:i + len(u)] == u]
    for k, l in enumerate(L):
        words, u = l['words'], list(l['u'])
        flags = [False] * len(words)
        if u:
            occ = find_all(words, u)
            if occ:
                nxt = L[k + 1] if k + 1 < len(L) else None
                cont = bool(nxt and nxt['u'] and nxt['words'][:1] == nxt['u'][:1])
                i = occ[-1] if cont else occ[0]      # a run that carries on to the next line ends this one
                for j in range(i, i + len(u)): flags[j] = True
            else:                                     # not contiguous: fall back to in-order matching
                ui = 0
                for j, w in enumerate(words):
                    if ui < len(u) and w == u[ui]: flags[j] = True; ui += 1
        seq += list(zip(words, flags))
    # a single word the detector missed inside a run (a line-end word whose rule sits a hair
    # off) must not split it in two, so bridge gaps of one word
    flags = [u for _, u in seq]
    for i in range(1, len(flags) - 1):
        if not flags[i] and flags[i - 1] and flags[i + 1]: flags[i] = True
    for (w, _), u in zip(seq, flags):
        if u: cur.append(w)
        elif cur: runs.append(cur); cur = []
    if cur: runs.append(cur)
    return [r for r in runs if len(ck(" ".join(r))) >= 3]

def apply_underlines(text, runs):
    """Locate each underlined run by its letters only (pdfplumber splits "Baxandall’s" and dashes
    into separate tokens) and wrap the matching span of the -raw text."""
    idx = [i for i, ch in enumerate(text) if ck(ch)]
    stream = "".join(ck(text[i]) for i in idx)
    spans = []; frm = 0
    for r in runs:
        key = ck(" ".join(r))
        p = stream.find(key, frm)        # runs are in reading order: search after the previous one
        frm = p + len(key) if p >= 0 else frm
        if p < 0 or not key: return text, False
        a, b = idx[p], idx[p + len(key) - 1] + 1
        while b < len(text) and not text[b].isspace() and text[b] not in "<" and not ck(text[b]): b += 1   # trailing . , ” etc.
        if not ck(r[0][:1]):                                                          # run began with a mark
            while a > 0 and not text[a - 1].isspace() and not ck(text[a - 1]): a -= 1
        spans.append((a, b))
    for a, b in sorted(spans, reverse=True):
        text = text[:a] + "<u>" + text[a:b] + "</u>" + text[b:]
    return text, True


def apply_layout_override(text, repair):
    original = re.sub(r"\s+", "", text)
    if repair.get("layout_single_paragraph"):
        text = re.sub(r"\s+", " ", text).strip()
    for a, b in repair.get("layout_replace", []):
        if text.count(a) != 1: raise SystemExit("STOP: layout override must match exactly once")
        text = text.replace(a, b)
    if re.sub(r"\s+", "", text) != original:
        raise SystemExit("STOP: layout overrides may change whitespace only")
    return text

def main(cfg):
    overrides = json.load(open(cfg["overrides"], encoding="utf-8"))
    data = load(cfg, "extracted.json")
    rep = {"paragraphed": 0, "geometry_mismatch": [], "spacing_fixed": [], "underlined": 0, "underline_failed": [], "missing_geometry": []}
    for r in data["new"]:
        gp = wpath(cfg, "geo", r["id"] + ".json")
        if not os.path.exists(gp): rep["missing_geometry"].append(r["id"]); continue
        g = json.load(open(gp, encoding="utf-8"))
        if r["skill"] == cfg["figure_skill"]:
            img = g.get("image") or ""
            r["image"] = img[4:] if img.startswith("app/") else img
            continue
        lines = g["lines"]
        qk = ck(r["question"])[:25]; n = len(lines)
        for i in range(len(lines)):
            if ck(" ".join(l['text'] for l in lines[i:])).startswith(qk): n = i; break
        pl = lines[:n]
        r["passage"], fx = fix_spacing(r["passage"], [w for l in pl for w in l['words']])
        if fx: rep["spacing_fixed"].append([r["id"], fx])
        new = apply_breaks(r["passage"], pl, para_breaks(pl))
        if new is None: rep["geometry_mismatch"].append(r["id"])
        else:
            rep["paragraphed"] += "\n\n" in new; r["passage"] = new
        r["passage"] = apply_layout_override(r["passage"], overrides.get(r["id"], {}))
        if "UNDERLINE" in r["flags"]:
            t, ok = apply_geometry_underlines(r["passage"], pl)
            if ok: r["passage"] = t; rep["underlined"] += 1
            else: rep["underline_failed"].append(r["id"])
    save(cfg, "assembled.json", data); save(cfg, "phase3-report.json", rep)
    print({k: (v if isinstance(v, int) else len(v)) for k, v in rep.items()})
    ok = gate(not rep["missing_geometry"], "every new item has geometry (re-run geometry.py)", rep["missing_geometry"][:20])
    ok &= gate(not rep["underline_failed"], "every underlined item got its <u> span", rep["underline_failed"])
    gate(True, f"{len(rep['geometry_mismatch'])} items kept as one paragraph (geometry text did not match; checked in verify)")
    sys.exit(0 if ok else 2)

if __name__ == "__main__": main(load_config(sys.argv[1]))
