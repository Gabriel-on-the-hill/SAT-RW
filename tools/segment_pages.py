#!/usr/bin/env python3
"""
segment_pages.py — stage 2 of the question-extraction pipeline.

WHAT THIS IS FOR
    Stage 1 said how many questions each book holds and on which pages. Stage 2
    cuts those pages into QUESTIONS: it renders each page that carries one at 300
    dpi, works out by coordinate which option bubbles belong to which stem, and
    writes one crop per question for the visual read in stage 3.

    It transcribes nothing that matters. The text it records is a DRAFT for stage
    3 to compare against -- the page image is the source of truth, because the OCR
    drops characters and a dropped comma silently destroys a grammar question.

WHY IT LOOKS THE WAY IT DOES
    Every rule below was measured against the actual books, not assumed.

    1. THE OPTION IS FOUND BY ITS GLYPH, NOT ITS LETTER. The circled A/B/C/D are
       graphics; OCR renders them as (R) U+00AE, (C) U+00A9 and @ U+0040, and (R)
       serves both A and B. So we locate options by the glyph SPAN and record only
       their POSITION down the page. No letter is written anywhere in this file's
       output. Stage 4 assigns letters, from position cross-checked with the key.

    2. ROWS MUST BE BUILT PER COLUMN. Measured, and it is the difference between
       88% and 66% of groups landing at exactly four. On grammar p.72 the stem
       "14. Food waste ..." sits at y=74 in the left column and an option sits at
       y=71 in the right. Cluster the page's spans into rows by y alone and the
       two merge, burying the "14." that marks where the question starts. So the
       option column is found first, and rows are built on each side of it.

    3. THE ANCHOR IS WHAT SPLITS THE COLUMN. Options run down one column in an
       unbroken stream; the vertical gap between two questions' options (43pt on
       grammar p.72) is not reliably bigger than the gap inside one (25-39pt), so
       gaps alone cannot cut it. Each book supplies a different anchor: the
       grammar book numbers its stems ("14."), the Critical Reader stamps each
       question "Mark for Review". Both are read here; gap-chunking is the last
       resort and is flagged when used.

    4. PAGE LABELS FIND FAR FEWER QUESTIONS THAN GEOMETRY DOES. Stage 1 walked
       page labels and called 14 of the Critical Reader's 175 pages exercises,
       estimating 21 questions. Working from bubble geometry instead finds 108
       across 73 pages, and 105 "Mark for Review" markers agree. The labels are
       not wrong so much as blind: a Critical Reader page carries a question AND
       its explanation prose, so it classifies as instruction and its question
       disappears. Read the whole book here, never stage 1's exercise pages.

    5. AN ANCHOR WITH NO OPTIONS IS STILL A QUESTION. Where a marker is found and
       no bubble under it survived, the record is emitted anyway, with its crop
       and the flag `no_options`, so stage 3 reads it from the image rather than
       nobody ever learning it was there.

    Nothing is dropped silently. Every question that does not come out at exactly
    four options is emitted anyway, carrying a flag that says what is wrong with
    it, and counted in the review queue at the end of SEGMENTS.md.

DETERMINISM
    Same PDFs in, byte-identical JSON and Markdown out. Nothing is sampled and
    nothing depends on dict order. Renders are skipped when the file already
    exists, so a re-run is cheap and an interrupted run resumes.

USAGE
    python tools/segment_pages.py                      # grammar, then critical_reader
    python tools/segment_pages.py --books grammar      # one book
    python tools/segment_pages.py --books vocabulary   # contact sheets only (no text layer)
    python tools/segment_pages.py --no-render          # geometry only, ~30x faster

    Writes into _extract/ , which is gitignored: the source books are commercial
    and this repo is public.

WHAT THIS DOES NOT DO
    It does not read the answer key (stage 4), does not deduplicate (stage 5) and
    does not mint bank ids (stage 6, from a content hash, per EXTRACTION-GUIDE §4).
    The `qid` here is a LOCATION -- book, page, position -- and is not a bank id.
"""

import argparse
import json
import os
import re
import sys
from collections import Counter

try:
    import fitz  # PyMuPDF
except ImportError:
    sys.exit("PyMuPDF is required:  pip install pymupdf")

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(HERE, "_extract")

DPI = 300                      # EXTRACTION-GUIDE §8 asks for 300-400
RENDER = fitz.Matrix(DPI / 72, DPI / 72)

BOOKS = {
    "grammar": {
        "file": "Sixth Edition, The Ultimate Guide to SAT® Grammar.pdf",
        "anchor": "number",          # stems are numbered: "14."
    },
    "critical_reader": {
        "file": "The Critical Reader, Fifth Edition.pdf",
        "anchor": "mark_for_review",  # digital-format question boxes
    },
    "vocabulary": {
        "file": "SAT Vocabulary a New Approach for the Digital SAT.pdf",
        "anchor": None,               # no text layer at all -- vision only
        "contact_from": 50,           # word list runs to ~p50; questions after
    },
}
DEFAULT_BOOKS = ["grammar", "critical_reader"]   # the guide's order; vocab is opt-in

# ── signals ──────────────────────────────────────────────────────────────────
# The bubble glyphs, by codepoint. Verified by census over every exercise page of
# both text-layer books: 608 in the grammar book, 110 in the Critical Reader, and
# nothing else in that range appears at the head of a short line.
BUBBLE = re.compile(r"[®©@]")
ALNUM = re.compile(r"[0-9A-Za-z]")
# "Mark for Review", as the scan actually renders it: "Mark. for Review" on
# grammar p.83, "Mark  for Review" elsewhere. Anchored loosely on purpose.
MARK_FOR_REVIEW = re.compile(r"Mark\W{0,4}f[o0]r\W{0,4}Review", re.I)
# A numbered stem. Two digits max, so a year ("1990.") cannot match, and the
# lookbehind stops it matching the tail of a longer number.
NUMBERED = re.compile(r"(?<!\d)(\d{1,2})\s*[.:]\s")
# Everything OCR leaves behind around a bubble: box edges, rules, stray bars.
JUNK_ONLY = re.compile(r"^[\sI|jl\\/:.,\-_~'`·•®©@\[\]{}()]*$")
LEADING_JUNK = re.compile(r"^[\sI|jl\\/:,\-_~'`·•®©@\[\]{}]+")
# The scanned box rules around every question, as OCR leaves them: long runs of
# dashes, sometimes spaced out. Stripped from the DRAFT text only. The SAT blank
# ("human __ food waste") is left alone -- it is the question, not decoration --
# so underscores are only cut at the length the books use for a fill-in line.
BOX_ART = re.compile(r"(?:[-~=]\s*){4,}")
FILL_LINE = re.compile(r"_{8,}")
CONTROL = re.compile(r"[\x00-\x08\x0b-\x1f]")
BARE_NUMBER = re.compile(r"^\s*\d{1,3}\s*$")
# The pre-digital "identify the error" format: (A)...(B)...(C)...(D) inline in the
# sentence, with empty bubbles at the right. Grammar p.45 is one. Those questions
# are the wrong SHAPE for this app however cleanly they extract, so they are
# flagged here rather than discovered at stage 6.
INLINE_LETTERS = re.compile(r"\(\s*[ABCD]\s*\)")

# ── tuned constants, each measured ───────────────────────────────────────────
GLYPH_COL_TOL = 30    # x spread of one column of bubbles (measured max 26)
MIN_COL_GLYPHS = 3    # 3 not 4: a group missing one bubble is still a question
ANCHOR_TOL = 30       # a stem may sit this far BELOW its first option (p.72: 11)
ROW_TOL = 5           # y tolerance when grouping spans into a visual row
TEXT_TOL = 8          # an option's words may sit this far ABOVE its own bubble
CROP_PAD = 8          # pt of margin around a question's own content
# How far above its anchor a question's crop starts, and it is NOT one number.
# A "Mark for Review" stamp sits inside the question box with the passage beside
# and above it, so the crop has to reach back for it. A numbered stem IS the top
# of its question, and reaching back 55pt there cut the previous question's
# option D clean off the bottom of its own crop.
CROP_PRE = {"mark": 55, "number": 15}


# ── geometry primitives ──────────────────────────────────────────────────────

def page_spans(page):
    """Every non-empty span on the page, with its bbox. The span is the unit
    because the bubble glyph is always its own span ('I(R) ', '@ ', '\\@ ') --
    verified on grammar p.72 and critical_reader p.38/p.113.

    Two things are dropped here rather than downstream, because both are page
    furniture that would otherwise be read as part of a question: the printed
    folio at the foot of the page (it landed inside an option: "secure 38") and
    the Critical Reader's control-character watermark."""
    foot = page.rect.y1 * 0.955
    out = []
    for blk in page.get_text("dict")["blocks"]:
        if blk["type"] != 0:
            continue
        for line in blk["lines"]:
            for sp in line["spans"]:
                if not sp["text"].strip():
                    continue
                if CONTROL.search(sp["text"]):
                    continue
                if sp["bbox"][1] >= foot and BARE_NUMBER.match(sp["text"]):
                    continue
                out.append({"bbox": tuple(sp["bbox"]), "text": sp["text"]})
    return out


def is_glyph(span):
    """A bubble, not a word containing one. The grammar book's running header is
    'The Ultimate Guide to SAT(R) Grammar', so the test cannot be the character
    alone; a real bubble span carries almost no letters (the box edge 'I' at most)."""
    return bool(BUBBLE.search(span["text"])) and len(ALNUM.findall(span["text"])) <= 3


def cluster(values, tol):
    out = []
    for v in sorted(values):
        if out and v - out[-1][-1] <= tol:
            out[-1].append(v)
        else:
            out.append([v])
    return out


def rows(spans, tol=ROW_TOL):
    """Spans grouped into visual rows by y-top, each row left-to-right.

    Only ever call this on spans from ONE column -- see the module docstring."""
    out = []
    for s in sorted(spans, key=lambda s: (round(s["bbox"][1] / tol), s["bbox"][0])):
        if out and abs(s["bbox"][1] - out[-1][0]["bbox"][1]) <= tol:
            out[-1].append(s)
        else:
            out.append([s])
    return [sorted(r, key=lambda s: s["bbox"][0]) for r in out]


def row_text(row):
    return re.sub(r"\s+", " ", " ".join(s["text"] for s in row)).strip()


def draft(spans_):
    """Reading-order text for a stem or a question head, with the box art cut."""
    return clean(" ".join(row_text(r) for r in rows(spans_)))


def clean(text):
    """Strip the box edges OCR leaves around an option, keep the option."""
    text = FILL_LINE.sub(" ", BOX_ART.sub(" ", text))
    return re.sub(r"\s+", " ", LEADING_JUNK.sub("", text)).strip()


def union(boxes):
    return (min(b[0] for b in boxes), min(b[1] for b in boxes),
            max(b[2] for b in boxes), max(b[3] for b in boxes))


# ── segmentation ─────────────────────────────────────────────────────────────

def find_option_column(glyphs):
    """The option column is the largest x-cluster of bubble glyphs. Returns its
    left edge, its members in page order, and the glyphs left over.

    Strays are returned rather than ignored: a stray is either a false positive
    (a (R) in prose) or a second column this does not handle, and the difference
    matters enough to put in the report."""
    groups = cluster([g["bbox"][0] for g in glyphs], GLYPH_COL_TOL)
    groups.sort(key=len, reverse=True)
    if not groups or len(groups[0]) < MIN_COL_GLYPHS:
        return None, [], glyphs
    lo, hi = min(groups[0]) - 1, max(groups[0]) + 1
    inside = sorted([g for g in glyphs if lo <= g["bbox"][0] <= hi],
                    key=lambda g: (g["bbox"][1], g["bbox"][0]))
    stray = [g for g in glyphs if not (lo <= g["bbox"][0] <= hi)]
    return lo, inside, stray


def find_anchors(spans, col_x, kind):
    """The y positions where questions start.

    `mark_for_review` is read first wherever it appears, because the Critical
    Reader stamps every question with it and the grammar book uses it too in its
    digital-format worked examples (p.83). Numbering is the fallback, read from
    the LEFT of the option column, which is where the grammar book puts stems."""
    found = []
    left = [s for s in spans if col_x is None or s["bbox"][2] <= col_x - 2]

    for row in rows(spans):
        if MARK_FOR_REVIEW.search(row_text(row)):
            found.append(("mark", row[0]["bbox"][1]))
    if found or kind != "number":
        return sorted(set(found), key=lambda t: t[1])

    for row in rows(left):
        m = NUMBERED.search(row_text(row)[:22])
        if m:
            found.append(("n" + m.group(1), row[0]["bbox"][1]))
    return sorted(set(found), key=lambda t: t[1])


def group_options(col, anchors):
    """Assign each bubble to the question it belongs to.

    A bubble belongs to the last anchor at or above it, allowing ANCHOR_TOL for
    the stem that sits a few points below its own first option. Where that leaves
    a group at a multiple of four, an anchor was missed rather than a question
    having eight options, so it is cut into fours and flagged. Where it leaves
    anything else, the group is emitted as it is and sent to review."""
    if not anchors:
        return [(None, col)] if col else []
    buckets = {}
    for g in col:
        above = [a for a in anchors if a[1] <= g["bbox"][1] + ANCHOR_TOL]
        buckets.setdefault(above[-1] if above else None, []).append(g)
    out = []
    for a in sorted(buckets, key=lambda a: (a is None, a[1] if a else 0)):
        members = buckets[a]
        if len(members) > 4 and len(members) % 4 == 0:
            for i in range(0, len(members), 4):
                out.append((a if i == 0 else None, members[i:i + 4]))
        else:
            out.append((a, members))
    return out


def chunk_four(col):
    """No anchor anywhere on the page. Bubbles come in fours down one column, so
    consecutive fours is the only reading available; it is always flagged."""
    return [(None, col[i:i + 4]) for i in range(0, len(col), 4)]


def distribute_option_text(members, band, text_end):
    """Hand every word in the option column to the bubble it belongs to.

    A span goes to the LAST bubble at or above it, allowing TEXT_TOL for the fact
    that the scan sets an option's words a few points HIGHER than its own bubble
    (critical_reader p.38: bubble at y=280.3, "dazzling" at y=277.5). Doing this
    in one pass rather than per bubble is what stops option 1 swallowing option
    2's words, which it did on four Critical Reader pages.

    Returns one (text, boxes) pair per member, plus the spans it consumed."""
    x_min = min(m["bbox"][0] for m in members)
    picked = {id(m): [] for m in members}
    used = set()
    for s in band:
        if any(s is m for m in members) or JUNK_ONLY.match(s["text"]):
            continue
        if s["bbox"][0] < x_min or s["bbox"][1] >= text_end:
            continue
        above = [m for m in members if m["bbox"][1] <= s["bbox"][1] + TEXT_TOL]
        if not above:
            continue                      # sits above the first bubble: it is stem
        picked[id(above[-1])].append(s)
        used.add(id(s))
    out = []
    for m in members:
        # An option that wraps starts its second line at the same left edge as
        # its first -- these are boxed choices, not prose. So a lower row that
        # starts somewhere else is not this option continuing; it is the page's
        # next paragraph, whose mid-line spans happen to begin right of the
        # option column. Grammar p.17 read "for instance, the sentence, we can
        # cross it out and consider" as choice D before this test existed.
        got = []
        for k, row in enumerate(rows(picked[id(m)])):
            if k and abs(row[0]["bbox"][0] - got[0]["bbox"][0]) > 8:
                break
            got.extend(row)
        used.difference_update(id(s) for s in picked[id(m)] if s not in got)
        out.append((clean(" ".join(s["text"] for s in got)),
                    [s["bbox"] for s in got]))
    return out, used


def segment_page(page, pno, printed, book_key, kind):
    """One page in, a list of question records out. See the module docstring."""
    spans = page_spans(page)
    if not spans:
        return []
    glyphs = [s for s in spans if is_glyph(s)]
    col_x, col, stray = find_option_column(glyphs)
    anchors = find_anchors(spans, col_x, kind)

    # A "Mark for Review" stamp is a question box and nothing else, so it stands
    # on its own. A bare "7." is not: the grammar book numbers its contents pages
    # and its prose lists too, and trusting those alone invented 249 questions on
    # pages with no bubble anywhere. A number only counts where bubbles are.
    if not col:
        anchors = [a for a in anchors if a[0] == "mark"]
    if not col and not anchors:
        return []

    if col:
        groups = group_options(col, anchors)
        if not anchors:
            groups = chunk_four(col)
        # An anchor with no bubbles under it is still a question -- the Critical
        # Reader's whole recovery gap lives here. Emit it with a crop and no
        # options, unless it falls INSIDE a group, where it is a false anchor
        # (a numbered line inside a passage) rather than a question of its own.
        used = {a for a, _ in groups if a}
        spans_of = [(m[0]["bbox"][1], m[-1]["bbox"][1]) for _, m in groups if m]
        for a in anchors:
            if a in used:
                continue
            if any(top - ANCHOR_TOL <= a[1] <= bottom for top, bottom in spans_of):
                continue
            groups.append((a, []))
        groups.sort(key=lambda t: (t[1][0]["bbox"][1] if t[1]
                                   else (t[0][1] if t[0] else 0)))
    else:
        col_x = None
        groups = [(a, []) for a in anchors]

    # y boundaries: a question runs from just above its anchor (or its first
    # bubble) to wherever the next one starts.
    starts = []
    for anchor, members in groups:
        ys = [m["bbox"][1] for m in members]
        pre = CROP_PRE["mark" if anchor and anchor[0] == "mark" else "number"]
        if anchor and members:
            starts.append(min(anchor[1] - pre, min(ys) - CROP_PAD))
        elif anchor:
            starts.append(anchor[1] - pre)
        else:
            starts.append(min(ys) - CROP_PAD)
    # A question's crop may never begin above the bottom of the one before it.
    # Without this clamp the pre-roll eats the previous question's last option,
    # and a crop missing option D is exactly the silent failure this stage is for.
    for i in range(1, len(starts)):
        _, prev = groups[i - 1]
        if prev:
            starts[i] = max(starts[i], prev[-1]["bbox"][3] + 3)

    # Two different lower bounds are needed and conflating them cost every last
    # option its words. The CROP runs to where the next question's crop starts,
    # which is CROP_PRE points ABOVE that question's anchor -- generous on
    # purpose. The TEXT must stop short of the next question's first bubble, or
    # the last option reads nothing (its own words are below the crop boundary)
    # and the next question's first option is read twice.
    col_ys = sorted(g["bbox"][1] for g in col) if col else []

    records = []
    page_bottom = page.rect.y1
    for i, (anchor, members) in enumerate(groups):
        y_from = max(0.0, starts[i])
        y_to = starts[i + 1] if i + 1 < len(starts) else page_bottom
        y_to = max(y_to, y_from + 20)

        band = [s for s in spans if y_from - 1 <= s["bbox"][1] < page_bottom]
        options, flags = [], []
        if members:
            after = [y for y in col_ys if y > members[-1]["bbox"][1] + 1]
            text_end = (after[0] - TEXT_TOL - 1) if after else page_bottom
            # ...and never past the next question's anchor. Without this the last
            # option on critical_reader p.38 read "realistic r::::l Mark for
            # Review Female hyenas remain within their cla".
            nxt = [a for a, _ in groups[i + 1:] if a]
            if nxt:
                text_end = min(text_end, nxt[0][1] - 2)
            # ...and, for the LAST question on a page, no further below its last
            # bubble than the spacing of its own options. Nothing marks where the
            # options stop, so critical_reader p.40 read the exercise's closing
            # sentence as part of choice D.
            ys = [m["bbox"][1] for m in members]
            gaps = [b - a for a, b in zip(ys, ys[1:])]
            reach = max(gaps) if gaps else 40
            text_end = min(text_end, ys[-1] + reach)
            texts, used = distribute_option_text(members, band, text_end)
            for j, (g, (txt, boxes)) in enumerate(zip(members, texts)):
                options.append({
                    "pos": j + 1,                  # 1-based, top of column downward
                    "glyph": BUBBLE.search(g["text"]).group(0),
                    "bbox": [round(v, 1) for v in g["bbox"]],
                    "text": txt,
                    "text_bbox": [round(v, 1) for v in union(boxes)] if boxes else None,
                })
                if not txt:
                    flags.append("empty_option_text")
        else:
            used = set()

        # The stem: on a grammar page it is left of the option column; on a
        # Critical Reader page it is in the same column, above the first bubble.
        # "Above" is defined by what the options did NOT consume, so a stem line
        # set level with the first bubble is not lost.
        first_y = members[0]["bbox"][1] if members else y_to
        head_cut = first_y if members else y_to
        # The head starts at the anchor, NOT at the top of the crop: the crop
        # deliberately reaches CROP_PRE points higher to catch the passage, and
        # reading the head from there dragged the previous question's last option
        # into this one's stem.
        head_from = (anchor[1] - 12) if anchor else y_from
        in_band = [s for s in band if s["bbox"][1] < y_to]
        if col_x is not None:
            stem_spans = [s for s in in_band if s["bbox"][2] <= col_x - 2]
            head_spans = [s for s in in_band
                          if s["bbox"][0] >= col_x - 8 and id(s) not in used
                          and head_from <= s["bbox"][1] < head_cut and not is_glyph(s)]
        else:
            stem_spans = []
            head_spans = [s for s in in_band if head_from <= s["bbox"][1] < head_cut]
        stem, head = draft(stem_spans), draft(head_spans)

        n = len(options)
        if n == 0:
            flags.append("no_options")
        elif n < 4:
            flags.append("few_options")
        elif n > 4:
            flags.append("many_options")
        if anchor is None and members:
            flags.append("no_anchor")
        # The pre-digital format is (A)..(D) marked INSIDE the sentence with empty
        # bubbles beside it. Both halves are required: the Critical Reader's
        # explanation prose says "(B) is correct" all over the page, and on that
        # alone this flag fired on 31 perfectly ordinary questions.
        inline = set(INLINE_LETTERS.findall(re.sub(r"\s+", "", stem + " " + head)))
        if len(inline) >= 3 and options and all(not o["text"] for o in options):
            flags.append("inline_letters")

        boxes = [o["bbox"] for o in options]
        boxes += [s["bbox"] for s in stem_spans + head_spans]
        content = union(boxes) if boxes else (0, y_from, page.rect.x1, y_to)

        records.append({
            "qid": f"{book_key}_p{pno:03d}_q{i + 1:02d}",
            "page": pno,
            "printed": printed,
            "number": anchor[0][1:] if anchor and anchor[0].startswith("n") else None,
            "anchor": anchor[0] if anchor else None,
            "band": [round(y_from, 1), round(y_to, 1)],
            "content_bbox": [round(v, 1) for v in content],
            "stem_draft": stem,
            "head_draft": head,
            "n_options": n,
            "options": options,
            "flags": sorted(set(flags)),
            "status": "ok" if not flags else "review",
        })

    if stray:
        for r in records[:1]:
            r["flags"] = sorted(set(r["flags"] + ["stray_glyphs_on_page"]))
            r["status"] = "review"
    return records


# ── rendering ────────────────────────────────────────────────────────────────

def render_page(doc, pno, path):
    if os.path.exists(path):
        return False
    doc[pno].get_pixmap(matrix=RENDER).save(path)
    return True


def render_crop(doc, rec, path):
    """The crop is a READING AID for stage 3, so it is deliberately generous: the
    full page width over the question's own y band. A question cropped tight
    enough to lose its passage is worse than one with a neighbour's edge in it.

    The bottom is the band OR this question's own content, whichever is lower.
    The band ends where the next question's crop begins, and an option that wraps
    onto a second line reaches past that -- which is how option D first came out
    sliced in half."""
    if os.path.exists(path):
        return False
    page = doc[rec["page"]]
    y0, y1 = rec["band"]
    y1 = max(y1, rec["content_bbox"][3] + 6)
    clip = fitz.Rect(0, max(0, y0 - 4), page.rect.x1, min(page.rect.y1, y1 + 4))
    page.get_pixmap(matrix=RENDER, clip=clip).save(path)
    return True


def contact_sheets(doc, book_key, first, do_render):
    """The vocabulary book has NO text layer, so there is no geometry to segment.
    What stage 2 can give it is a cheap way to look: 12 pages tiled per sheet, so
    a whole book is a handful of images rather than 150. Pattern established in
    stage 1 (_extract/probe/vocab_contact.png)."""
    out = os.path.join(OUT_DIR, "contact", book_key)
    os.makedirs(out, exist_ok=True)
    per, cols, thumb = 12, 4, 3.0   # 3x = ~216 dpi equivalent per tile at 1/4 size
    sheets = []
    for start in range(first, len(doc), per):
        pages = list(range(start, min(start + per, len(doc))))
        path = os.path.join(out, f"sheet_{start:03d}-{pages[-1]:03d}.png")
        sheets.append(os.path.relpath(path, OUT_DIR).replace("\\", "/"))
        if not do_render or os.path.exists(path):
            continue
        tiles = [doc[p].get_pixmap(matrix=fitz.Matrix(thumb / 4, thumb / 4))
                 for p in pages]
        w, h = max(t.width for t in tiles), max(t.height for t in tiles)
        rows_n = (len(tiles) + cols - 1) // cols
        sheet = fitz.Pixmap(fitz.csRGB, fitz.IRect(0, 0, w * cols, h * rows_n))
        sheet.clear_with(255)
        for i, t in enumerate(tiles):
            t.set_origin((i % cols) * w, (i // cols) * h)
            sheet.copy(t, t.irect)
        sheet.save(path)
    return sheets


# ── driver ───────────────────────────────────────────────────────────────────

def load_printed():
    """Printed book page numbers, resolved by stage 1. The answer keys refer to
    exercises by PRINTED page, so stage 4 needs them on every record."""
    path = os.path.join(OUT_DIR, "inventory.json")
    if not os.path.exists(path):
        return {}
    with open(path, encoding="utf-8") as fh:
        inv = json.load(fh)
    return {b["key"]: {p["page"]: p["printed"] for p in b.get("page_detail", [])}
            for b in inv if not b.get("error")}


def run_book(book_key, printed_map, do_render):
    spec = BOOKS[book_key]
    path = os.path.join(HERE, spec["file"])
    if not os.path.exists(path):
        return {"key": book_key, "file": spec["file"], "error": "NOT FOUND"}

    doc = fitz.open(path)
    printed = printed_map.get(book_key, {})

    if spec["anchor"] is None:
        sheets = contact_sheets(doc, book_key, spec.get("contact_from", 0), do_render)
        return {"key": book_key, "file": spec["file"], "pages": len(doc),
                "text_layer": False, "questions": [], "contact_sheets": sheets,
                "note": "no text layer: segmentation is a vision task for stage 3"}

    os.makedirs(os.path.join(OUT_DIR, "pages", book_key), exist_ok=True)
    os.makedirs(os.path.join(OUT_DIR, "crops", book_key), exist_ok=True)

    questions, rendered = [], 0
    for pno in range(len(doc)):
        recs = segment_page(doc[pno], pno, printed.get(pno), book_key, spec["anchor"])
        if not recs:
            continue
        page_png = os.path.join(OUT_DIR, "pages", book_key, f"p{pno:03d}.png")
        if do_render:
            rendered += render_page(doc, pno, page_png)
        for r in recs:
            crop = os.path.join(OUT_DIR, "crops", book_key, r["qid"] + ".png")
            if do_render:
                rendered += render_crop(doc, r, crop)
            r["page_image"] = os.path.relpath(page_png, OUT_DIR).replace("\\", "/")
            r["crop_image"] = os.path.relpath(crop, OUT_DIR).replace("\\", "/")
        questions.extend(recs)

    # `rendered` is a run statistic and is deliberately NOT part of the record:
    # writing it into the JSON would make the file differ between a fresh run and
    # a re-run, and byte-identical output is how this stays checkable.
    return {"key": book_key, "file": spec["file"], "pages": len(doc),
            "text_layer": True, "dpi": DPI, "questions": questions,
            "_rendered": rendered}


def summarise(book):
    qs = book.get("questions", [])
    return {
        "questions": len(qs),
        "clean": sum(1 for q in qs if q["status"] == "ok"),
        "review": sum(1 for q in qs if q["status"] == "review"),
        "pages": len({q["page"] for q in qs}),
        "flags": Counter(f for q in qs for f in q["flags"]),
    }


def markdown(results):
    L = ["# Segmentation — stage 2", "",
         "Produced by `python tools/segment_pages.py`. Page indices are **0-based",
         "PDF** indices, matching `INVENTORY.md`.", "",
         "A question is **clean** when exactly four option bubbles were found under",
         "one anchor. Everything else is emitted too, with a flag saying what is",
         "wrong with it — nothing is dropped. Option **position** is recorded and",
         "the option **letter** is not: the bubbles are graphics that OCR renders",
         "as `®`/`©`/`@`, and `®` serves both A and B. Letters are stage 4's job,",
         "from position cross-checked against the answer key.", "",
         "| Book | Pages w/ Q | Questions | Clean | Review |",
         "|---|---:|---:|---:|---:|"]
    for r in results:
        if r.get("error"):
            L.append(f"| {r['key']} | — | — | — | **{r['error']}** |")
            continue
        if not r.get("text_layer"):
            L.append(f"| {r['key']} | — | — | — | *no text layer* |")
            continue
        s = summarise(r)
        L.append(f"| {r['key']} | {s['pages']} | **{s['questions']}** | "
                 f"{s['clean']} | {s['review']} |")
    L.append("")

    for r in results:
        if r.get("error"):
            continue
        L += [f"## {r['key']} — `{r['file']}`", ""]
        if not r.get("text_layer"):
            L += [f"{r['note']}.", "",
                  f"Contact sheets ({len(r['contact_sheets'])}), 12 pages each:", ""]
            L += [f"- `{p}`" for p in r["contact_sheets"]]
            L.append("")
            continue
        s = summarise(r)
        L += [f"{s['questions']} questions across {s['pages']} pages, rendered at "
              f"{r['dpi']} dpi.", "",
              "Flags raised (a question may carry more than one):", "",
              "| Flag | Count | Means |", "|---|---:|---|"]
        for flag, n in sorted(s["flags"].items(), key=lambda kv: (-kv[1], kv[0])):
            L.append(f"| `{flag}` | {n} | {FLAG_MEANS.get(flag, '')} |")
        L += ["", "### Review queue", "",
              "Every question not at exactly four clean options, in page order.", "",
              "| qid | printed p. | options | flags | first option (draft) |",
              "|---|---:|---:|---|---|"]
        for q in r["questions"]:
            if q["status"] == "ok":
                continue
            draft = (q["options"][0]["text"] if q["options"] else "")[:46]
            L.append(f"| `{q['qid']}` | {q['printed'] or '—'} | {q['n_options']} | "
                     f"{', '.join(q['flags'])} | {draft.replace('|', '/')} |")
        L.append("")
    return "\n".join(L)


FLAG_MEANS = {
    "no_options": "anchor found, no bubbles survived OCR — **read from the image**",
    "few_options": "fewer than four bubbles — one was lost, recover from the image",
    "many_options": "more than four under one anchor and not a multiple of it",
    "empty_option_text": "bubble found, its words did not — read from the image",
    "no_anchor": "grouped as consecutive fours; no stem number or marker found",
    "inline_letters": "pre-digital *identify the error* format — wrong shape for this app",
    "stray_glyphs_on_page": "bubbles outside the main column; check for a second column",
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--books", default=",".join(DEFAULT_BOOKS),
                    help="comma-separated: " + ", ".join(BOOKS))
    ap.add_argument("--no-render", action="store_true",
                    help="geometry only; skip page and crop images")
    args = ap.parse_args()

    keys = [k.strip() for k in args.books.split(",") if k.strip()]
    for k in keys:
        if k not in BOOKS:
            sys.exit(f"unknown book {k!r}; known: {', '.join(BOOKS)}")

    os.makedirs(OUT_DIR, exist_ok=True)
    printed_map = load_printed()
    if not printed_map:
        print("note: _extract/inventory.json missing — printed page numbers will be "
              "null. Run tools/inventory_books.py first.")

    results = [run_book(k, printed_map, not args.no_render) for k in keys]

    for r in results:
        if r.get("error"):
            continue
        path = os.path.join(OUT_DIR, "segments", r["key"] + ".json")
        os.makedirs(os.path.dirname(path), exist_ok=True)
        record = {k: v for k, v in r.items() if not k.startswith("_")}
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(record, fh, indent=1, ensure_ascii=False, sort_keys=True)

    # The report covers every book with a record on disk, not just the ones this
    # run touched. `--books vocabulary` used to rewrite SEGMENTS.md with only the
    # vocabulary line in it, silently deleting the grammar and Critical Reader
    # sections from the one file a human actually reads.
    on_disk = []
    for key in BOOKS:
        path = os.path.join(OUT_DIR, "segments", key + ".json")
        fresh = next((r for r in results if r["key"] == key and not r.get("error")), None)
        if fresh:
            on_disk.append(fresh)
        elif os.path.exists(path):
            with open(path, encoding="utf-8") as fh:
                on_disk.append(json.load(fh))

    with open(os.path.join(OUT_DIR, "SEGMENTS.md"), "w", encoding="utf-8") as fh:
        fh.write(markdown(on_disk))

    for r in results:
        if r.get("error"):
            print(f"{r['key']:16} {r['error']}")
        elif not r.get("text_layer"):
            print(f"{r['key']:16} no text layer — {len(r['contact_sheets'])} "
                  f"contact sheets")
        else:
            s = summarise(r)
            print(f"{r['key']:16} {s['questions']:>4} questions  "
                  f"clean={s['clean']:>4}  review={s['review']:>3}  "
                  f"pages={s['pages']:>3}  rendered={r['_rendered']:>4}  "
                  f"{dict(sorted(s['flags'].items()))}")
    print(f"\nwrote {OUT_DIR}\\segments\\*.json and SEGMENTS.md")


if __name__ == "__main__":
    main()
