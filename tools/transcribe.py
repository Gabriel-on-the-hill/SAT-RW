#!/usr/bin/env python3
"""
transcribe.py -- stage 3 of the question-extraction pipeline: dual-channel read.

WHAT THIS IS FOR
    Stage 2 cut the books into questions and recorded a text-layer DRAFT of each
    one. The draft cannot be trusted: the books are scans, the OCR drops
    characters, and in a grammar book a dropped comma turns four distinct
    choices into three -- a question with no correct answer, which nothing in the
    app will ever report.

    So every question that lands is read TWICE:

        channel A   the PDF text layer            (stage 2, already on disk)
        channel B   the 300 dpi page image, read by eye

    Channel B is the source of truth; channel A is the CHECK. What the two
    channels disagree about is measured and reported, which is what makes
    "accurately transcribed" a number rather than a hope. Where channel B cannot
    be read either, the question goes to a review queue and does not land.

WHY PAGE IMAGES AND NOT THE PER-QUESTION CROPS
    Both were tried. A whole page at 300 dpi carries three to four questions,
    renders every comma, semicolon and em dash unambiguously, and costs less to
    read than the same questions' crops read one at a time. The crops stay
    useful for the odd question that needs a second look; the transcription
    itself is driven off `pages/<book>/pNNN.png`.

HOW THE GRAMMAR BOOK'S QUESTIONS ARE SELECTED
    The tutor settled (25 Jul) that only KEYED questions are taken, so that every
    record has an independent answer source. Stage 1's page labels are the wrong
    filter for this -- they call a page `instruction` whenever teaching prose
    shares it with an exercise, and that loses a third of the keyed questions
    (all five Practice Sets have items on `instruction` pages).

    The book itself supplies a better one. Every exercise is introduced by a
    heading -- "Exercise: Apostrophes (answers p. 206)" -- and the answer key on
    pp.202-207 repeats those headings verbatim over its groups. So a question is
    keyed when it sits under an exercise heading whose key group exists AND its
    printed number falls inside that group. Worked examples in the teaching text
    carry no number in the exercise's sequence and drop out on their own.

    Not every key group is a set of questions. "Sentences and Fragments" answers
    with rewritten sentences; "Identifying Parts of Speech" answers with parts of
    speech. A group only counts when its entries are BARE LETTERS.

USAGE
    python tools/transcribe.py --plan              # what to read, and in what order
    python tools/transcribe.py --merge             # compare the channels, promote, report
    python tools/transcribe.py --plan --books critical_reader

    Vision goes in _extract/stage3/vision/<book>/pNNN.json, one file per page:

        {"page": 78,
         "items": [{"n": 1,
                    "text": "When light travels ... its full ______ light ranges ...",
                    "options": ["spectrum, as the universe expands,", ...],
                    "letters": "ABCD"}]}

    `letters` is what is actually printed beside positions 1-4. It is recorded
    rather than assumed: it is the independent check on stage 2's geometry, and
    EXTRACTION-GUIDE section 9 lists a systematic off-by-one as the trap that
    would make every answer wrong, uniformly and silently.

WRITES
    _extract/stage3/<book>.json    promoted records, with both channels kept
    _extract/stage3/TRANSCRIPTION.md   the disagreement report and review queue
"""

import argparse
import difflib
import json
import os
import re
import sys
from collections import OrderedDict, defaultdict

try:
    import fitz  # PyMuPDF
except ImportError:
    sys.exit("PyMuPDF is required:  pip install pymupdf")

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(HERE, "_extract")
SEG = os.path.join(OUT, "segments")
STAGE3 = os.path.join(OUT, "stage3")
VISION = os.path.join(STAGE3, "vision")

BOOKS = OrderedDict([
    ("grammar", "Sixth Edition, The Ultimate Guide to SAT® Grammar.pdf"),
    ("critical_reader", "The Critical Reader, Fifth Edition.pdf"),
])

# ── the grammar book's exercise headings ─────────────────────────────────────
HEADING = re.compile(r'^[ \t]*(Exercise:|Cumulative Review:|Quick Check:|Practice Sets:)(.*)$', re.M)
# "Exercise: Apostrophes (answers p. 206)"  ->  "Apostrophes"
TRAILER = re.compile(r'\s*\(answers?\s+pp?\.[^)]*\)\s*$', re.I)


def heading_name(raw):
    """The part of a heading that the answer key repeats over its group."""
    s = TRAILER.sub('', raw).strip()
    s = re.sub(r'^Exercise:\s*', '', s)
    return s.strip().strip('"').strip()


def exercise_starts(doc, last_page):
    """[(page_index, raw_heading, key_page_or_None)] in page order."""
    out = []
    for p in range(6, last_page):
        text = doc[p].get_text()
        for m in HEADING.finditer(text):
            raw = (m.group(1) + m.group(2)).strip()
            kp = re.search(r'answers?\s+pp?\.\s*(\d+)', raw, re.I)
            out.append((p, raw, int(kp.group(1)) if kp else None))
    return out


# ── the answer key ───────────────────────────────────────────────────────────
# Grouped under headings that repeat the exercise headings. Entries are
# "1. C", "2.C", and -- OCR noise the guide warns about -- "3: C" and "l.A".
#
# The negative lookahead for a colon is load-bearing. Without it the
# parts-of-speech drill's "1. A: noun; B: noun; C: preposition" reads as
# "question 1, answer A" and an eight-entry group of ANSWERS appears where the
# book has eight entries of grammar terminology. Those questions are the
# pre-digital `inline_letters` format this app cannot use at all, so a bad parse
# there does not merely add noise -- it invents a key for questions that have
# none and files four of them with a wrong answer.
#
# Every pattern is anchored to a WHOLE LINE. Matching mid-line reads
# "15. A new software called DXplain, some hospitals report, ..." -- the first
# line of a rewritten-sentence answer -- as "question 15, answer A", and quietly
# adds an answer to a group that has no multiple-choice questions in it at all.
KEY_ENTRY = re.compile(r'^\s*([0-9]{1,2}|l)\s*[.:]\s*([A-D])\s*$')
# "Transitions 1" names the relationship before the letter: "2. Cause-and-Effect: B"
KEY_CAT_ENTRY = re.compile(r'^\s*([0-9]{1,2}|l)\s*[.:]\s*([A-Za-z][A-Za-z-]{2,})\s*:\s*([A-D])\s*$')
# The Practice Sets name the rule AFTER the letter: "4. C: Dashes". That label is
# the book's own classification of the question and stage 6 uses it for ruleType.
# The topic must START WITH A CAPITAL. That is what keeps the parts-of-speech
# drill's "1. A: noun; B: noun; C: preposition" out: it has the same shape and
# its "answer" is a part of speech, not a choice.
KEY_TOPIC_ENTRY = re.compile(r'^\s*([0-9]{1,2}|l)\s*[.:]\s*([A-D])\s*:\s*([A-Z][A-Za-z,;&/ -]*[A-Za-z])\s*$')
SET_MARK = re.compile(r'^\s*Set\s*(\d+)\s*$', re.M)


def key_groups(doc, first, last, known_headings):
    """
    Split the key pages into groups and read the bare-letter entries out of each.

    Returns {heading: {number: letter}}. A group whose entries are prose (the
    rewrite drills, the parts-of-speech drills) comes back empty and is dropped
    by the caller -- EXTRACTION-GUIDE section 1: not everything in a key is a
    question.
    """
    text = "\n".join(doc[p].get_text() for p in range(first, last + 1))
    # running heads and page numbers sit inside the key text; they never start a group
    lines = [ln.rstrip() for ln in text.split("\n")]

    wanted = {h.lower(): h for h in known_headings}
    groups = OrderedDict()
    topics = {}
    cur = None
    set_no = 0
    for ln in lines:
        probe = ln.strip().strip('"').strip()
        probe_n = re.sub(r'\s+', ' ', probe).lower()
        m = SET_MARK.match(ln)
        if m or re.match(r'^\s*Set\s*\d+\s*$', probe):
            set_no = int(re.search(r'\d+', probe).group())
            cur = "Practice Sets: All Chapters/Set %d" % set_no
            groups.setdefault(cur, OrderedDict())
            continue
        if probe_n in wanted:
            cur = wanted[probe_n]
            groups.setdefault(cur, OrderedDict())
            continue
        # A heading can be broken across two lines in the key ("Non-Essential
        # Clauses with Commas, Dashes," / "and Parentheses"). Match on a prefix.
        hit = None
        for k, h in wanted.items():
            if len(probe_n) > 12 and k.startswith(probe_n):
                hit = h
                break
        if hit:
            cur = hit
            groups.setdefault(cur, OrderedDict())
            continue
        if cur is None:
            continue
        for pat, letter_at in ((KEY_ENTRY, 2), (KEY_CAT_ENTRY, 3), (KEY_TOPIC_ENTRY, 2)):
            m = pat.match(ln)
            if not m:
                continue
            n = 1 if m.group(1) == 'l' else int(m.group(1))
            groups[cur].setdefault(n, m.group(letter_at))
            if pat is KEY_TOPIC_ENTRY:
                topics.setdefault(cur, {}).setdefault(n, m.group(3).strip())
            break
    return groups, topics


# ── candidate selection ──────────────────────────────────────────────────────
STEM_NUM = re.compile(r'(?<![0-9])([0-9]{1,2})\s*\.\s+[A-Z"“(]')


def stem_number(q):
    """The printed number, preferring the stem text over stage 2's anchor.

    Stage 2's `number` comes from the anchor span and mis-reads a two-digit
    number often enough to matter -- "10." arrives as 1, "18." as 1. The stem
    draft usually still carries the digits, so it wins where it is unambiguous.
    """
    m = STEM_NUM.search((q.get('stem_draft') or '')[:40])
    if m:
        return int(m.group(1))
    if q.get('number') and str(q['number']).isdigit():
        return int(q['number'])
    return None


def grammar_candidates(doc, seg):
    starts = exercise_starts(doc, 200)
    names = [heading_name(raw) for _, raw, _ in starts]
    groups, topics = key_groups(doc, 202, 214, set(names))

    # exercise ranges
    ranges = []
    for i, (p, raw, kp) in enumerate(starts):
        end = starts[i + 1][0] if i + 1 < len(starts) else 201
        ranges.append((p, end, heading_name(raw), kp))

    qs = sorted(seg['questions'], key=lambda q: (q['page'], q['band'][0]))
    out = []
    for start, end, name, kp in ranges:
        block = [q for q in qs if start <= q['page'] < end]
        if not block:
            continue
        if name == "Practice Sets: All Chapters":
            # Five sets of ten, each restarting at 1. Splitting on "the number
            # went back to 1" is not safe -- three of the five sets open with a
            # question whose "1." the OCR lost. The book prints "Set N" at the
            # top of each set's first page and the key repeats it, so the page
            # header is the split, and it is the same signal on both sides.
            starts_at = {}
            for pg in sorted({q['page'] for q in block}):
                head = doc[pg].get_text()[:400]
                m = re.search(r'\bSet\s*(\d+)\b', head)
                if m:
                    starts_at[pg] = int(m.group(1))
            sets = defaultdict(list)
            cur = None
            for q in block:
                if q['page'] in starts_at:
                    cur = starts_at[q['page']]
                if cur is None:
                    continue
                sets[cur].append(q)
            for si in sorted(sets):
                gname = "Practice Sets: All Chapters/Set %d" % si
                out += _assign(sets[si], groups.get(gname, {}), gname, kp,
                               topics.get(gname, {}))
        else:
            out += _assign(block, groups.get(name, {}), name, kp, topics.get(name, {}))
    return out, groups


def _assign(block, key, group_name, key_page, topics=None):
    """Attach a key letter to each question in one exercise, by printed number.

    Position is used only to repair a number the OCR mangled, and only when the
    repair is unambiguous: the neighbours on either side must pin it down. A
    number that cannot be pinned down gets no key entry and is reviewed.
    """
    if not key:
        return []
    # The `inline_letters` format -- (A)...(D) marked inside the sentence, empty
    # bubbles beside it -- is the wrong shape for this app whatever its key says.
    block = [q for q in block if 'inline_letters' not in q['flags']]
    if not block:
        return []
    nums = [stem_number(q) for q in block]
    # "Student Notes" prints no numbers at all: one question to a page, five
    # pages, five key entries. Order down the book is then the only join there
    # is, and it is only safe when the counts match exactly -- one missing
    # question would shift every letter by one and every answer would be wrong.
    if all(n is None for n in nums) and len(block) == len(key) == max(key):
        nums = list(range(1, len(block) + 1))
    # repair: a None or an out-of-range number between two good neighbours
    for i, n in enumerate(nums):
        if n is not None and 1 <= n <= max(key):
            continue
        prev = next((nums[j] for j in range(i - 1, -1, -1) if nums[j]), None)
        nxt = next((nums[j] for j in range(i + 1, len(nums)) if nums[j]), None)
        if prev is not None and nxt is not None and nxt - prev == 2:
            nums[i] = prev + 1
        elif prev is not None and nxt is None and prev + 1 <= max(key):
            nums[i] = prev + 1
        elif prev is None and nxt is not None and nxt - 1 >= 1:
            nums[i] = nxt - 1

    out, used = [], set()
    for q, n in zip(block, nums):
        if n is None or n not in key or n in used:
            continue
        used.add(n)
        out.append({
            'qid': q['qid'], 'page': q['page'], 'printed': q['printed'],
            'exercise': group_name, 'number': n,
            'key_letter': key[n], 'key_page': key_page,
            'key_topic': (topics or {}).get(n),
            'n_options': q['n_options'], 'flags': q['flags'],
            'draft_stem': q['stem_draft'],
            'draft_options': [o['text'] for o in q['options']],
            'crop_image': q['crop_image'], 'page_image': q['page_image'],
        })
    return out


# ── the Critical Reader ──────────────────────────────────────────────────────
# Its questions are one per short passage, stamped "Mark for Review". Same rule
# as the grammar book: only what the book itself answers independently lands.
# Every chapter runs "Exercise: <name>" ... "Answers: <name>", the exercise
# numbers its questions from 1, and the answers page gives a letter AND a
# written explanation per number. Worked examples in the teaching pages, which
# the book argues through in surrounding prose, are dropped -- there are ~30 of
# them and they are the same call the tutor already made for the grammar book.
CR_HEADING = re.compile(r'^[ \t]*(Exercise|Answers):(.*)$', re.M)
CR_ANSWER = re.compile(r'^\s*([0-9]{1,2})\s*[.:]\s*\(?([A-D])\)?\s*$', re.M)
# Teaching drills whose "options" are sub-questions ("What does 'they' refer to?")
DRILL = re.compile(r'^\s*What (does|do) ["“]', re.I)


def cr_sections(doc):
    """[(kind, name, page)] for every Exercise:/Answers: heading, in page order."""
    out = []
    for p in range(20, doc.page_count):
        for m in CR_HEADING.finditer(doc[p].get_text()):
            out.append((m.group(1), m.group(2).strip(), p))
    return out


def critical_reader_candidates(doc, seg):
    heads = cr_sections(doc)
    answers = {}
    for kind, name, p in heads:
        if kind == 'Answers':
            answers.setdefault(_cr_key(name), p)

    # exercise ranges: heading page up to the next heading of any kind
    ranges = []
    for i, (kind, name, p) in enumerate(heads):
        if kind != 'Exercise':
            continue
        end = heads[i + 1][2] if i + 1 < len(heads) else doc.page_count
        ranges.append((name, p, end, answers.get(_cr_key(name))))

    qs = sorted(seg['questions'], key=lambda q: (q['page'], q['band'][0]))
    out = []
    for name, start, end, apage in ranges:
        if apage is None:
            continue
        key = {}
        for m in CR_ANSWER.finditer("\n".join(
                doc[p].get_text() for p in range(apage, min(apage + 6, doc.page_count)))):
            key.setdefault(int(m.group(1)), m.group(2))
        if not key:
            continue
        block = [q for q in qs if start <= q['page'] < end]
        block = [q for q in block
                 if not any(DRILL.match(o['text'] or '') for o in q['options'])]
        if not block:
            continue
        # numbering restarts at 1 and runs down the exercise in page order
        for i, q in enumerate(block, 1):
            if i not in key:
                continue
            out.append({
                'qid': q['qid'], 'page': q['page'], 'printed': q['printed'],
                'exercise': name, 'number': i,
                'key_letter': key[i], 'key_page': apage,
                'n_options': q['n_options'], 'flags': q['flags'],
                'draft_stem': q['stem_draft'],
                'draft_options': [o['text'] or '' for o in q['options']],
                'crop_image': q['crop_image'], 'page_image': q['page_image'],
            })
    return out, {}


def _cr_key(name):
    """'Reading for Function' and 'Function' name the same chapter."""
    s = re.sub(r'^(Reading for|Identifying)\s+', '', name.strip(), flags=re.I)
    return re.sub(r'[^a-z]+', '', s.lower())


# ── plan ─────────────────────────────────────────────────────────────────────
def plan(books):
    os.makedirs(STAGE3, exist_ok=True)
    report = ["# Stage 3 -- what to read\n",
              "Generated by `python tools/transcribe.py --plan`. Every page below carries at",
              "least one question that will land, and is read from `_extract/pages/<book>/`.",
              "Transcribe from the IMAGE only -- the text-layer draft is the check, and a",
              "check you have read first is not a check.\n"]
    allplan = {}
    for book in books:
        doc = fitz.open(os.path.join(HERE, BOOKS[book]))
        seg = json.load(open(os.path.join(SEG, book + ".json"), encoding="utf-8"))
        if book == "grammar":
            cands, groups = grammar_candidates(doc, seg)
        else:
            cands, groups = critical_reader_candidates(doc, seg)
        allplan[book] = cands

        pages = OrderedDict()
        for c in cands:
            pages.setdefault(c['page'], []).append(c)
        report.append("\n## %s -- %d questions on %d pages\n" % (book, len(cands), len(pages)))
        if groups:
            report.append("Key groups with bare-letter entries: %d\n" % len(groups))
            report.append("| exercise | entries | key p. |")
            report.append("|---|---:|---:|")
            byex = OrderedDict()
            for c in cands:
                byex.setdefault(c['exercise'], []).append(c)
            for name, items in byex.items():
                ns = sorted(groups.get(name, {}))
                gap = ns and ns != list(range(ns[0], ns[-1] + 1))
                report.append("| %s%s | %d of %d | %s |" % (
                    name, " **(key has gaps: %s)**" % ns if gap else "",
                    len(items), len(ns), items[0]['key_page'] or '-'))
            report.append("")
            report.append("A gap costs those questions their key and nothing else: the join is by "
                          "printed number, never by position in the list, so a missing entry "
                          "cannot shift the ones after it.\n")
        report.append("| page image | printed p. | questions |")
        report.append("|---|---:|---|")
        for pg, items in pages.items():
            done = os.path.exists(os.path.join(VISION, book, "p%03d.json" % pg))
            report.append("| `pages/%s/p%03d.png`%s | %s | %s |" % (
                book, pg, " **done**" if done else "", items[0]['printed'],
                ", ".join(str(i['number'] or i['qid'].split('_')[-1]) for i in items)))
        report.append("")

    with open(os.path.join(STAGE3, "PLAN.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(report) + "\n")
    with open(os.path.join(STAGE3, "plan.json"), "w", encoding="utf-8") as f:
        json.dump(allplan, f, indent=1, ensure_ascii=False, sort_keys=True)
    for book, cands in allplan.items():
        pages = sorted({c['page'] for c in cands})
        print("%-16s %4d questions   %3d pages   %3d transcribed" % (
            book, len(cands), len(pages),
            sum(1 for p in pages if os.path.exists(os.path.join(VISION, book, "p%03d.json" % p)))))
    print("\n-> _extract/stage3/PLAN.md")


# ── merge ────────────────────────────────────────────────────────────────────
def norm_cmp(s):
    """Normalisation for the CHANNEL COMPARISON only.

    Deliberately aggressive -- it is measuring whether the two channels read the
    same words, not whether two questions are the same question. Dedup (stage 5)
    normalises quite differently, and conservatively, because there the
    punctuation IS the content.
    """
    s = (s or '').lower()
    s = s.replace('’', "'").replace('‘', "'")
    s = s.replace('“', '"').replace('”', '"')
    s = re.sub(r'[–—]', '-', s)
    s = re.sub(r'[^a-z0-9]+', ' ', s)
    return ' '.join(s.split())


def sim(a, b):
    return difflib.SequenceMatcher(None, norm_cmp(a), norm_cmp(b)).ratio()


def merge(books):
    plan_path = os.path.join(STAGE3, "plan.json")
    if not os.path.exists(plan_path):
        sys.exit("run --plan first")
    allplan = json.load(open(plan_path, encoding="utf-8"))
    report = ["# Stage 3 -- dual-channel transcription\n",
              "Generated by `python tools/transcribe.py --merge`.\n",
              "Channel A is stage 2's text-layer draft. Channel B is the 300 dpi page image,",
              "read by eye. **B is the record; A is the check.** The agreement column below is",
              "what makes the accuracy claim measurable: where the two channels read the same",
              "words the record is promoted, and where they do not, B is what lands and the",
              "difference is printed here so it can be looked at.\n"]
    totals = {}
    for book in books:
        cands = allplan.get(book, [])
        by_page = OrderedDict()
        for c in cands:
            by_page.setdefault(c['page'], []).append(c)

        promoted, review, disagree = [], [], []
        opt_pairs = opt_agree = 0
        letters_bad = []
        for pg, items in by_page.items():
            vpath = os.path.join(VISION, book, "p%03d.json" % pg)
            if not os.path.exists(vpath):
                for c in items:
                    review.append((c, 'not transcribed'))
                continue
            vis = json.load(open(vpath, encoding="utf-8"))
            vitems = vis.get('items', [])
            # match on printed number where the book prints one; otherwise on
            # the order down the page, which is what stage 2 recorded too
            used = set()
            for c in items:
                hit = None
                if c.get('number'):
                    for i, v in enumerate(vitems):
                        if i not in used and v.get('n') == c['number']:
                            hit = (i, v)
                            break
                if hit is None:
                    for i, v in enumerate(vitems):
                        if i not in used and v.get('qid') == c['qid']:
                            hit = (i, v)
                            break
                if hit is None:
                    review.append((c, 'no vision record on the page'))
                    continue
                i, v = hit
                used.add(i)
                if v.get('skip'):
                    review.append((c, 'skipped by eye: ' + v['skip']))
                    continue
                opts = v.get('options') or []
                if len(opts) != 4 or any(not o.strip() for o in opts):
                    review.append((c, 'not four readable options in the image'))
                    continue
                letters = (v.get('letters') or 'ABCD').upper()
                if letters != 'ABCD':
                    letters_bad.append((c['qid'], letters))
                    review.append((c, 'options are not printed A,B,C,D top to bottom: ' + letters))
                    continue
                # channel agreement, option by option
                worst = 1.0
                for a, b in zip(c['draft_options'], opts):
                    if not (a or '').strip():
                        continue
                    opt_pairs += 1
                    s = sim(a, b)
                    worst = min(worst, s)
                    if s >= 0.90:
                        opt_agree += 1
                stem_s = sim(c['draft_stem'], v.get('text', ''))
                rec = dict(c)
                rec.update({
                    'text': v['text'], 'options': opts, 'letters': letters,
                    'prompt': v.get('prompt'), 'notes': v.get('notes'),
                    'kind': v.get('kind'),
                    'agree_options': round(worst, 3), 'agree_stem': round(stem_s, 3),
                })
                promoted.append(rec)
                if worst < 0.90 or stem_s < 0.75:
                    disagree.append(rec)

        totals[book] = dict(promoted=len(promoted), review=len(review),
                            opt_pairs=opt_pairs, opt_agree=opt_agree)
        with open(os.path.join(STAGE3, book + ".json"), "w", encoding="utf-8") as f:
            json.dump(promoted, f, indent=1, ensure_ascii=False, sort_keys=True)

        report.append("\n## %s\n" % book)
        report.append("| | |")
        report.append("|---|---:|")
        report.append("| candidates | %d |" % len(cands))
        report.append("| **promoted** | **%d** |" % len(promoted))
        report.append("| in the review queue | %d |" % len(review))
        if opt_pairs:
            report.append("| option texts compared | %d |" % opt_pairs)
            report.append("| channels agreed (>=0.90) | %d (%d%%) |" % (
                opt_agree, round(100 * opt_agree / opt_pairs)))
        report.append("")
        if letters_bad:
            report.append("**Letters not in A,B,C,D order** -- geometry check failed, "
                          "these did NOT land:\n")
            for qid, l in letters_bad:
                report.append("- `%s` read as `%s`" % (qid, l))
            report.append("")
        if disagree:
            report.append("### Where the channels disagreed (%d)\n" % len(disagree))
            report.append("The image is what landed. Listed worst first.\n")
            report.append("| qid | opt | stem | text layer said | image says |")
            report.append("|---|---:|---:|---|---|")
            for r in sorted(disagree, key=lambda r: r['agree_options'])[:60]:
                pair = min(zip(r['draft_options'], r['options']),
                           key=lambda ab: sim(*ab) if ab[0].strip() else 2)
                report.append("| `%s` | %.2f | %.2f | %s | %s |" % (
                    r['qid'], r['agree_options'], r['agree_stem'],
                    (pair[0] or '(empty)').replace('|', '\\|')[:60],
                    pair[1].replace('|', '\\|')[:60]))
            report.append("")
        if review:
            report.append("### Review queue -- did not land (%d)\n" % len(review))
            report.append("| qid | printed p. | why |")
            report.append("|---|---:|---|")
            for c, why in review:
                report.append("| `%s` | %s | %s |" % (c['qid'], c['printed'], why))
            report.append("")

    with open(os.path.join(STAGE3, "TRANSCRIPTION.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(report) + "\n")
    for book, t in totals.items():
        pct = (100 * t['opt_agree'] / t['opt_pairs']) if t['opt_pairs'] else 0
        print("%-16s promoted %4d   review %3d   channel agreement %3d%% of %d options" % (
            book, t['promoted'], t['review'], round(pct), t['opt_pairs']))
    print("\n-> _extract/stage3/TRANSCRIPTION.md")


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--books", nargs="*", default=list(BOOKS))
    ap.add_argument("--plan", action="store_true")
    ap.add_argument("--merge", action="store_true")
    a = ap.parse_args()
    books = [b for b in a.books if b in BOOKS]
    if a.merge:
        merge(books)
    else:
        plan(books)


if __name__ == "__main__":
    main()
