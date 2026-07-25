#!/usr/bin/env python3
"""
inventory_books.py — stage 1 of the question-extraction pipeline.

WHAT THIS IS FOR
    Before extracting anything, find out how much is actually there. This walks
    each source book, classifies every page, and reports how many extractable
    multiple-choice questions each one holds and on which pages. It writes no
    question data; it produces the map that stage 2 works from.

WHY IT LOOKS THE WAY IT DOES
    All three books are SCANS with an OCR text layer, not digital text. Three
    consequences drive every design choice here:

    1. The A/B/C/D bubbles are GRAPHICS. OCR renders them as junk -- "I<?> I",
       "- \\@ \\", "I<?> j". Option letters therefore cannot be read from text at
       all; they survive only as vertical position. So this script counts option
       LINES by their leading junk, never by their letter.
    2. Options sit in their own column and, in reading order, arrive AFTER the
       text of several questions at once. Anything that pairs a question with the
       options that follow it in reading order will pair them wrongly. Stage 2
       must use coordinates; stage 1 records the column geometry so we know it is
       feasible before committing.
    3. The OCR drops characters ("Gramm r", "Part Ill", "Tobe"). In a grammar
       book a dropped comma silently destroys the question. So this reports an
       OCR-damage estimate per book: it is the number that says how much of the
       work has to be done from the page image rather than the text layer.

USAGE
    python tools/inventory_books.py

    Writes _extract/inventory.json (machine) and _extract/INVENTORY.md (human).
    Both are gitignored: the source books are commercial and this repo is public.
"""

import json
import os
import re
import statistics
import sys
from collections import Counter

try:
    import fitz  # PyMuPDF
except ImportError:
    sys.exit("PyMuPDF is required:  pip install pymupdf")

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(HERE, "_extract")

BOOKS = [
    {
        "key": "grammar",
        "file": "Sixth Edition, The Ultimate Guide to SAT® Grammar.pdf",
        "feeds": ["Boundaries", "Form, Structure, and Sense", "Transitions"],
    },
    {
        "key": "critical_reader",
        "file": "The Critical Reader, Fifth Edition.pdf",
        "feeds": ["Central Ideas and Details", "Command of Evidence — Textual",
                  "Inferences", "Text Structure and Purpose", "Words in Context",
                  "Cross-Text Connections"],
    },
    {
        "key": "vocabulary",
        "file": "SAT Vocabulary a New Approach for the Digital SAT.pdf",
        "feeds": ["Words in Context"],
    },
]

# ── signals ──────────────────────────────────────────────────────────────────
# An option line is the OCR wreckage of a bubble followed by the choice text.
# The circled A/B/C/D glyphs OCR to ® (0xae), © (0xa9) and @ (0x40) -- verified
# by codepoint against grammar p.72 and critical_reader p.46. Real examples:
#     "I® I consumption, therefore,"
#     "- \\@ \\ consumption; therefore,"
#     "__ I @ I shutting down"
#     "I® j numbers: in Germany"
# The letter is NOT recoverable from these glyphs -- ® serves both A and B in
# the samples. Position is the only signal, which is why stage 2 must work from
# geometry. Here we only need to COUNT them, so the shape is: a little leading
# junk, a bubble glyph, an optional closing bar, then the choice text.
OPTION_LINE = re.compile(r"^.{0,8}?[®©@][\s]*[|Ij\\lI]?[\s]+(\S.{0,140})$")
BUBBLE_JUNK = re.compile(r"[®©@]")

# "1." / "12:"  (the colon form is an OCR error for the period, and it is common)
NUMBERED = re.compile(r"^\s*(\d{1,2})\s*[.:]\s+\S")
# a bare answer-key entry: "1.C" / "3: B" / "10. D"
KEY_ENTRY = re.compile(r"^\s*(\d{1,2})\s*[.:]?\s*\(?([A-D])\)?\s*$")
# an explanation opener: "5.A" then prose on the same or next line
EXPL_OPEN = re.compile(r"^\s*(\d{1,2})\s*[.:]?\s*\(?([A-D])\)?\s+\S")
BLANK = re.compile(r"_{2,}")
DASHBOX = re.compile(r"[~\-]{6,}")
MARK_FOR_REVIEW = re.compile(r"Mark\s+for\s+Review", re.I)

# Words that OCR of these books mangles in a detectable way. Presence of the
# broken form is evidence of character-dropping, which is the damage that
# matters -- a dropped comma looks like nothing at all.
OCR_TELLS = [
    r"\bTobe\b", r"\bTogo\b", r"\bWeare\b", r"\blam\b", r"\bIll\b(?!\s*ustrat)",
    r"\bGramm\s+r\b", r"\bth\s+t\b", r"\bwh\s+n\b", r"�",
]
OCR_TELL_RE = re.compile("|".join(OCR_TELLS))


def page_features(page):
    text = page.get_text("text")
    lines = text.split("\n")
    opt_lines = [ln for ln in lines if OPTION_LINE.match(ln)]
    feats = {
        "chars": len(text.strip()),
        "option_lines": len(opt_lines),
        "bubble_junk": len(BUBBLE_JUNK.findall(text)),
        "numbered": len(NUMBERED.findall(text)),
        "key_entries": sum(1 for ln in lines if KEY_ENTRY.match(ln)),
        "expl_opens": sum(1 for ln in lines if EXPL_OPEN.match(ln)),
        "blanks": len(BLANK.findall(text)),
        "dashboxes": len(DASHBOX.findall(text)),
        "mark_for_review": len(MARK_FOR_REVIEW.findall(text)),
        "ocr_tells": len(OCR_TELL_RE.findall(text)),
        "images": len(page.get_images(full=True)),
    }
    # Column geometry: how many distinct left edges do the text blocks use?
    # Stage 2 needs an options column that is separable by x-position.
    xs = [round(b[0]) for b in page.get_text("blocks") if b[6] == 0]
    feats["x_clusters"] = len(_cluster(xs, tol=25)) if xs else 0
    feats["_first_line"] = next((ln.strip() for ln in lines if ln.strip()), "")[:70]
    return feats


def _cluster(values, tol):
    out = []
    for v in sorted(values):
        if out and v - out[-1][-1] <= tol:
            out[-1].append(v)
        else:
            out.append([v])
    return out


def classify(f):
    """One label per page. Order matters: the tests run most-specific first."""
    if f["chars"] < 20:
        return "image_only" if f["images"] else "blank"
    # A key page is dense with bare "N. X" entries and little else.
    if f["key_entries"] >= 6 and f["key_entries"] * 12 > f["chars"] / 8:
        return "answer_key"
    # Explanations: numbered letter openers followed by real prose.
    if f["expl_opens"] >= 2 and f["chars"] > 900 and f["option_lines"] < 4:
        return "explanations"
    # An exercise page carries option groups, or SAT blanks with numbered items.
    # Deliberately NOT keyed on a bare bubble glyph: this book's own running
    # header is "The Ultimate Guide to SAT® Grammar", so a loose ® test marks
    # every page in the book an exercise. Only the full option-line shape counts.
    if f["option_lines"] >= 4:
        return "exercise"
    if f["blanks"] >= 2 and f["numbered"] >= 2:
        return "exercise"
    if f["chars"] < 260:
        return "divider"
    return "instruction"


def estimate_questions(f, label):
    """Extractable MCQ count for a page. Deliberately conservative.

    Options come in groups of four, so the option-line count is the most direct
    evidence a page carries questions. Where the bubbles are too mangled to
    match, fall back to SAT blanks (one per question) and then to numbered items.

    This is only ONE of the two estimates. The other -- counting entries in the
    answer key -- is independent of the page layout entirely, and the gap between
    them is the honest measure of how much this detector is missing. Never report
    one without the other.
    """
    if label != "exercise":
        return 0
    if f["option_lines"] >= 4:
        return f["option_lines"] // 4
    # A page of SAT blanks whose bubbles were too mangled to match: one blank is
    # one question. Requires numbered items too, so prose with a stray "__" in it
    # does not score.
    if f["blanks"] >= 2 and f["numbered"] >= 2:
        return min(f["blanks"], f["numbered"])
    return 0


def run_book(spec):
    path = os.path.join(HERE, spec["file"])
    if not os.path.exists(path):
        return {"key": spec["key"], "file": spec["file"], "error": "NOT FOUND"}

    doc = fitz.open(path)
    pages, labels = [], Counter()
    for i, page in enumerate(doc):
        f = page_features(page)
        label = classify(f)
        f["label"] = label
        f["questions_est"] = estimate_questions(f, label)
        f["page"] = i          # 0-based PDF index
        f["printed"] = None    # book page number, resolved below
        pages.append(f)
        labels[label] += 1

    _resolve_printed_numbers(doc, pages)

    text_pages = [p for p in pages if p["chars"] >= 20]
    damaged = [p for p in text_pages if p["ocr_tells"] > 0]
    has_text = len(text_pages) > len(pages) * 0.5
    return {
        "key": spec["key"],
        "file": spec["file"],
        "feeds": spec["feeds"],
        "pages": len(doc),
        "labels": dict(labels),
        # Estimate 1: from page layout. None when there is no text to read.
        "questions_est": sum(p["questions_est"] for p in pages) if has_text else None,
        # Estimate 2: from the answer key, independent of page layout.
        "questions_from_key": sum(p["key_entries"] for p in pages) if has_text else None,
        "needs_vision": not has_text,
        "has_text_layer": has_text,
        "ocr_damage_pct": round(100 * len(damaged) / max(1, len(text_pages))),
        "median_x_clusters": int(statistics.median(
            [p["x_clusters"] for p in pages if p["x_clusters"]] or [0])),
        "runs": _runs(pages),
        "page_detail": pages,
    }


def _resolve_printed_numbers(doc, pages):
    """Book page numbers sit in the text as a bare integer. Stage 2 needs them:
    the answer keys refer to exercises by PRINTED page, not PDF index."""
    for p in pages:
        page = doc[p["page"]]
        nums = [ln.strip() for ln in page.get_text("text").split("\n")
                if re.fullmatch(r"\d{1,3}", ln.strip())]
        if nums:
            # the one closest to this page's PDF index is almost certainly it
            p["printed"] = min((int(n) for n in nums),
                               key=lambda n: abs(n - p["page"]))


def _runs(pages):
    """Collapse the page list into contiguous labelled runs -- the manifest."""
    out = []
    for p in pages:
        if out and out[-1]["label"] == p["label"]:
            out[-1]["to"] = p["page"]
            out[-1]["questions_est"] += p["questions_est"]
        else:
            out.append({"label": p["label"], "from": p["page"], "to": p["page"],
                        "questions_est": p["questions_est"]})
    return out


def markdown(results):
    L = ["# Source-book inventory", "",
         "Stage 1 of the extraction pipeline. Page indices are **0-based PDF**",
         "indices; the printed book number is usually one lower.", ""]
    L += ["Two independent estimates are reported. **From layout** counts groups of",
          "four option bubbles on the page. **From key** counts entries in the answer",
          "key, which knows nothing about page layout. Where they disagree, the larger",
          "is the better guide to what is there and the gap is what stage 2 must",
          "recover by reading the page image.", "",
          "| Book | Pages | Text layer | OCR damage | Q from layout | Q from key |",
          "|---|---:|---|---:|---:|---:|"]
    for r in results:
        if r.get("error"):
            L.append(f"| {r['file']} | — | — | — | — | **{r['error']}** |")
            continue
        est = "**vision required**" if r["needs_vision"] else f"**{r['questions_est']}**"
        key = "—" if r["needs_vision"] else f"**{r['questions_from_key']}**"
        L.append(f"| {r['key']} | {r['pages']} | "
                 f"{'yes' if r['has_text_layer'] else '**none**'} | "
                 f"{r['ocr_damage_pct']}% | {est} | {key} |")
    L.append("")
    for r in results:
        if r.get("error"):
            continue
        L += [f"## {r['key']} — `{r['file']}`", "",
              f"Feeds: {', '.join(r['feeds'])}", "",
              "Page composition: " + ", ".join(
                  f"{v} {k}" for k, v in sorted(r["labels"].items(),
                                                key=lambda kv: -kv[1])), "",
              f"Median distinct text columns per page: {r['median_x_clusters']}", "",
              "| Pages | Kind | Est. Q |", "|---|---|---:|"]
        for run in r["runs"]:
            if run["label"] in ("blank", "divider") and run["questions_est"] == 0:
                continue
            span = (f"{run['from']}" if run["from"] == run["to"]
                    else f"{run['from']}–{run['to']}")
            L.append(f"| {span} | {run['label']} | {run['questions_est'] or ''} |")
        L.append("")
    return "\n".join(L)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    results = [run_book(b) for b in BOOKS]

    with open(os.path.join(OUT_DIR, "inventory.json"), "w", encoding="utf-8") as fh:
        json.dump(results, fh, indent=1)
    with open(os.path.join(OUT_DIR, "INVENTORY.md"), "w", encoding="utf-8") as fh:
        fh.write(markdown(results))

    for r in results:
        if r.get("error"):
            print(f"{r['key']:16} {r['error']}")
            continue
        print(f"{r['key']:16} {r['pages']:>4}pp  "
              f"text={'yes' if r['has_text_layer'] else 'NONE'!s:<4}  "
              f"ocr_damage={r['ocr_damage_pct']:>3}%  "
              f"est_layout={str(r['questions_est']):>4}  est_key={str(r['questions_from_key']):>4}  "
              f"{dict(sorted(r['labels'].items(), key=lambda kv: -kv[1]))}")
    print(f"\nwrote {OUT_DIR}\\inventory.json and INVENTORY.md")


if __name__ == "__main__":
    main()
