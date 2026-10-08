#!/usr/bin/env python3
"""PHASE 2 — line geometry, underlines and figure crops. Runs wherever the PDFs are (pdfplumber,
pdftoppm, Pillow). Resumable and time-boxed, so it fits a short shell window:

  python kit/geometry.py CONFIG [SECONDS=150] [SHARD=0] [NSHARDS=1]

Re-run until it prints `remaining 0`. Two shards in parallel on a two-core machine halve the time.
Writes WORK/geo/<id>.json and WORK/figures/<asset_dir>/<asset_prefix><id>.png for every figure item."""
import json, os, sys, time, glob, subprocess, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
import pdfplumber
from PIL import Image

DPI = 150; SCALE = DPI / 72.0

def rows_of(pg):
    words = pg.extract_words(use_text_flow=True)
    # underline rules are thin rects/lines a hair ABOVE or below the word's bottom (these exports
    # report word boxes ~1pt tall, so the rule can sit up to 2.5pt above `bottom`)
    segs = [(l["x0"], l["x1"], l["top"]) for l in pg.lines if abs(l["top"] - l["bottom"]) <= 1.5 and l["x1"] - l["x0"] > 4]
    segs += [(r["x0"], r["x1"], r["top"]) for r in pg.rects if abs(r["bottom"] - r["top"]) <= 2 and r["x1"] - r["x0"] > 4]
    rows = []
    for w in words:
        u = any(-2.5 <= sy - w["bottom"] <= 4 and not (w["x1"] < x0 - 1 or w["x0"] > x1 + 1) for x0, x1, sy in segs)
        w = {"t": w["text"], "x0": w["x0"], "x1": w["x1"], "top": w["top"], "u": u}
        if rows and abs(w["top"] - rows[-1]["top"]) < 2.5: rows[-1]["w"].append(w)
        else: rows.append({"top": w["top"], "w": [w]})
    for r in rows:
        r["w"].sort(key=lambda w: w["x0"]); r["x0"] = r["w"][0]["x0"]; r["x1"] = max(w["x1"] for w in r["w"])
        r["text"] = " ".join(w["t"] for w in r["w"])
    return rows

def crop(pdf_path, pdf, idx, qid, prompt, out):
    page = pdf.pages[idx]; W = page.width
    words = page.extract_words(use_text_flow=False)
    ql = [w for w in words if w["text"] == "Question"]
    top = ql[1]["bottom"] if len(ql) >= 2 else (ql[0]["bottom"] if ql else 90)
    first = (prompt.split() or ["Which"])[0]
    cand = [w for w in words if w["text"].strip(".,") == first.strip(".,") and w["top"] > top] or \
           [w for w in words if w["text"] == "Answer" and w["top"] > top]
    bottom = (cand[0]["top"] - 12) if cand else (top + 360)
    if bottom <= top: bottom = top + 360
    with tempfile.TemporaryDirectory() as td:
        subprocess.run(["pdftoppm", "-png", "-r", str(DPI), "-f", str(idx + 1), "-l", str(idx + 1), pdf_path,
                        os.path.join(td, "p")], capture_output=True)
        rendered = glob.glob(os.path.join(td, "p*.png"))
        if not rendered: return None
        img = Image.open(rendered[0])
        px = [int(round(v * SCALE)) for v in (8, top + 4, W - 8, bottom)]
        px = (max(0, px[0]), max(0, px[1]), min(img.width, px[2]), min(img.height, px[3]))
        img.crop(px).save(out)
    return out

def main(cfg, budget=150, shard=0, nshard=1):
    t0 = time.time(); os.makedirs(wpath(cfg, "geo"), exist_ok=True)
    data = load(cfg, "extracted.json")["new"]; pdfs = {}; done = 0
    adir = wpath(cfg, "figures", cfg["asset_dir"]); os.makedirs(adir, exist_ok=True)
    for k, r in enumerate(data):
        if k % nshard != shard: continue
        out = wpath(cfg, "geo", r["id"] + ".json")
        if os.path.exists(out): continue
        if time.time() - t0 > budget: break
        path = os.path.join(cfg["pdf_dir"], r["_pdf"]); pdf = pdfs.get(r["_pdf"])
        if pdf is None: pdf = pdfs[r["_pdf"]] = pdfplumber.open(path)
        lines, on, fin = [], False, False
        for pi in range(r["_page"], min(r["_page"] + 3, len(pdf.pages))):
            for row in rows_of(pdf.pages[pi]):
                t = row["text"].strip()
                if t.startswith("Question ID:") and r["id"] not in t and on: fin = True; break
                if t == "Question" and not on: on = True; continue
                if t == "Answer" and on: fin = True; break
                if on: lines.append({"text": row["text"], "x0": row["x0"], "x1": row["x1"], "top": row["top"], "page": pi,
                                     "u": [w["t"] for w in row["w"] if w["u"]], "words": [w["t"] for w in row["w"]], "u_flags": [w["u"] for w in row["w"]]})
            if fin: break
        rec = {"id": r["id"], "lines": lines, "width": float(pdf.pages[r["_page"]].width)}
        if r["skill"] == cfg["figure_skill"]:
            img = os.path.join(adir, cfg["asset_prefix"] + r["id"] + ".png")
            rec["image"] = cfg["asset_dir"] + "/" + cfg["asset_prefix"] + r["id"] + ".png" if crop(path, pdf, r["_page"], r["id"], r["question"], img) else None
        json.dump(rec, open(out, "w"), ensure_ascii=False); done += 1
    left = sum(1 for r in data if not os.path.exists(wpath(cfg, "geo", r["id"] + ".json")))
    print(f"done this run {done}, remaining {left}, {time.time() - t0:.0f}s")

if __name__ == "__main__":
    a = sys.argv
    main(load_config(a[1]), float(a[2]) if len(a) > 2 else 150, int(a[3]) if len(a) > 3 else 0, int(a[4]) if len(a) > 4 else 1)
