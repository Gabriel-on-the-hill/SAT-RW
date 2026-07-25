# Extracting questions from the source books — the complete brief

You have been asked to pull SAT R&W questions out of three textbooks in this folder and add the
ones we do not already have to the question bank.

**Read this file end to end before running anything.** Nearly everything in it was learned by
probing the actual files, and most of it contradicts what you would reasonably assume. The two
sentences that matter most:

> **All three books are scans, not digital text**, and the OCR drops characters.
> **The A/B/C/D letters cannot be read from the text layer at all.**

An extraction built on the naive assumption — parse the text, split on `A)`, join to the key —
produces a bank full of questions with no correct answer, and nothing anywhere will tell you.

## Read these first

| File | Why |
|---|---|
| `../AGENTS.md` (app) | House rules for the bank, the runner, and how homework is authored. Non-negotiable. |
| `../../../AGENTS.md` (root, at `c:\Antigravity`) | The teaching rules. "Truth is the floor" is the one this job can violate. |
| `../homework/bank.test.js` | The invariants your output must satisfy. Read the `id` guard's reasoning. |
| `../homework/assignments.js` (comments) | Explains `sections`, `review`, `ruleType`, and the pool floors. |
| `_extract/INVENTORY.md` | Page manifest from stage 1. Regenerate with `python tools/inventory_books.py`. |

## Why accuracy beats yield here

This bank is not a quiz. Its records drive a spaced-review ladder and a mastery ledger, and a
student is told they are wrong on the strength of the `answer` field. A question with a corrupted
option or a mis-joined answer key does not merely fail to teach — **it teaches a student that their
correct reasoning was wrong.** That is worse than the question not existing.

So the governing rule for every decision below: **when yield and accuracy conflict, accuracy wins,
and anything uncertain goes to a review queue rather than into the bank.**

---

# 1. Ground truth about the three sources

Established by probing, not assumed. Re-verify with `python tools/inventory_books.py` if the files
change.

| Book | Pages | Text layer | Q (layout) | Q (key) | Feeds |
|---|---:|---|---:|---:|---|
| `Sixth Edition, The Ultimate Guide to SAT® Grammar.pdf` | 218 | OCR, damaged | 112 | **131** | Boundaries, Form/Structure/Sense, Transitions |
| `The Critical Reader, Fifth Edition.pdf` | 175 | OCR, cleaner | 21 | **71** | Central Ideas, CoE—Textual, Inferences, Text Structure, Words in Context, Cross-Text |
| `SAT Vocabulary a New Approach for the Digital SAT.pdf` | 153 | **none** | — | — | Words in Context, Transitions |

Two independent estimates are reported on purpose. *Layout* counts groups of four option bubbles.
*Key* counts entries in the answer key and knows nothing about page layout. **Where they agree the
number is trustworthy; where they diverge, the gap is what you must recover by reading page
images.** Never quote one without the other.

### The bubble glyphs — the single most important fact

The circled A/B/C/D are **graphics**. OCR renders them as `®` (0xae), `©` (0xa9) and `@` (0x40).
Verified by codepoint on grammar p.72 and critical_reader p.46:

```
'I® I consumption, therefore, '     ← option 1
'I® I consumption, therefore '      ← option 2
'I© I consumption therefore, '      ← option 3
'- \@ \ consumption; therefore, '   ← option 4
```

`®` serves **both** A and B. **The letter is not recoverable from the text layer.** It survives only
as vertical position on the page, which is why segmentation must be geometric and why the answer key
is the only independent check on which option is which.

### Reading order is not question order

On grammar p.72 the text layer gives the *stems* of questions 14 and 15, and only then all eight of
their options in one run. Anything that pairs a question with the options following it in reading
order pairs them wrongly. **Use coordinates.** Stage 1 records `x_clusters` per page (median 3 for
the grammar book) so you can confirm the option column is separable before committing.

### The OCR drops characters

Real examples: `Gramm r` (for "Grammar"), `Part Ill` (for "Part III"), `Tobe`, `Togo`, `Weare`,
`lam`. In a grammar book, **a dropped comma silently destroys the question** — the options become
indistinguishable and no correct answer exists. This is the reason the page image, not the text
layer, is the source of truth.

### Answer keys

- **Grammar**: pages 202–207, ~130 pages away from the questions. Compressed (`1.C`, `2.C`, `10. B`)
  with its own OCR noise — `3:` appears where `3.` belongs. Grouped under exercise headings
  ("Transitions 1", "Apostrophes", "Modification", "Cumulative Review: All Punctuation and
  Transitions"). **Bare letters only — no explanations.**
- **Critical Reader**: keys carry a full per-question explanation inline (`5.A` followed by the
  reasoning). These records arrive nearly schema-complete. Use them.
- **Not everything in a key is a question.** Page 203 reads `9. Sentence / 10. Fragment` — those are
  non-MCQ drills. They are not bank-shaped. Skip them.

### The vocabulary book

Zero text layer, so it is vision-only — but its 300 dpi scan is **visibly cleaner than the other two
books' OCR**, so it may extract *more* accurately, not less. Structure, from a contact sheet:

- ~p1–50: word list with definitions and context paragraphs. **Not questions.** (Possible future
  feed for `vocab.html`, out of scope here.)
- ~p55 onward: worked examples and question sets.
- ~p90: Words-in-Context questions in clean Bluebook layout, with real circled Ⓐ–Ⓓ.
- ~p118–125: Transitions exercises (Identifying Continuation / Sequence / Reversal /
  Cause-and-Effect Words).
- ~p145: its own answer key.

To survey an image-only book cheaply, tile pages into one contact sheet and read that, rather than
rendering dozens of separate images. See `_extract/probe/vocab_contact.png` for the pattern.

---

# 2. The record you must produce

Every question in the bank has exactly these fields. Nothing may be omitted.

```js
{
  id:         "6f626ae5",                        // 8 hex, minted once — see §4
  skill:      "Command of Evidence — Textual",   // EM DASH, must match the bank exactly
  difficulty: "Easy" | "Medium" | "Hard",
  passage:    "...",
  question:   "Which quotation ... illustrates the claim?",
  options:    ["A. ...", "B. ...", "C. ...", "D. ..."],   // letter prefix included
  answer:     "A",                               // single letter A–D
  explanation:"...",                             // shown after the student commits
  strategy:   "Agreement Check",                 // short label on the section card
  ruleType:   "Semi",                            // CONVENTIONS ONLY — mandatory, see §7
  image:      "assets/coeq_6f626ae5.png"         // only when a figure is required
}
```

Valid `skill` values, with current pool depth (thinnest first — this is your priority order):

```
  28  Command of Evidence — Quantitative     ← thinnest, and 28/28 need images
  47  Central Ideas and Details
  49  Transitions
  52  Inferences
  53  Command of Evidence — Textual
  59  Form, Structure, and Sense
  61  Boundaries
  70  Cross-Text Connections
  70  Rhetorical Synthesis
  96  Text Structure and Purpose
 134  Words in Context                       ← already deepest, lowest priority
```

Valid `ruleType` values, with current depth:

```
Boundaries:                 Colon 4 · Commas 33 · Dash 6 · NoPunct 12 · Semi 6
Form, Structure, and Sense: Mod 12 · Poss 7 · Pron 8 · SVA 17 · VForm 6 · VTense 9
```

Colon, Semi and Dash are at the floor. **Filling them is the main reason this job exists.**

---

# 3. Decisions already made — do not relitigate

These were settled with the tutor. Implement them; do not redesign them.

**Output goes in separate files, appended into the canonical array.** One file per domain, e.g.
`data-conventions-ext.js`, ending with:

```js
const questionBank_CON_EXT = [ /* ... */ ];
questionBank_CON.push(...questionBank_CON_EXT);
```

Add the `<script>` tag **after** its base bank in every HTML that loads banks. This matters: the
globals are read in `homework/assignments.js`, `app.js`, `homework-run.html` and
`challenge/build-challenge-set.js` plus three test files. Appending into the canonical array means
**every one of those read sites works untouched**. A `.concat()` in the accessor would require
editing each of them and would silently diverge if you missed one.

**No encryption, no private hosting.** The tutor decided the questions ship as plain committed `.js`
like the existing 719. The three PDFs stay gitignored.

**Difficulty is provisional and there is no quota.** See §5.

**Difficulty calibration reads timed, standard-mode attempts only.** Untimed work is usually
tutor-guided and is not a test of unaided ability. The review ladder still counts all attempts —
only the *difficulty* signal filters. Weight rather than exclude, following the existing pattern in
`progress.js`: `ledger[id].correct += (source === 'exam') ? 2 : 1;`

**Explanations**: the grammar book's key has none. Build them from the eleven `ruleType` templates —
the rule prose already exists in `sec.html` (49 rule blocks) and the other note modules
(`transitions.html`, `rs.html`, `ii.html`, `cs.html`) — plus one question-specific line naming which
clause or word triggered the rule. The tutor writes that line. The Critical Reader's own inline
explanations should be used directly.

---

# 4. Question ids

`id` is not a label. Per the guard commit (`eadb23f`): *"It is the only join between a question and
the student: the mastery ledger, the review ladder, the retention counter and the saved per-question
record are all keyed by it, and the runner's section builder de-duplicates on it."* A missing or
duplicated id does not throw — a `sections` day just serves short and looks fine.

The existing 719 ids came from `ID:` lines in College Board's own PDFs. **Our books have no
equivalent, so you must mint them.**

- **Mint** as the first 8 hex of SHA-256 over the normalised question stem + options + passage.
  Deterministic, so re-running extraction on the same page yields the same id and never orphans a
  student's progress.
- **Then freeze.** A content hash is the right way to *generate* an id and the wrong way to
  *maintain* one. If ids are recomputed on every build, fixing an OCR typo changes the hash and that
  question's rung, streak and retention history silently reset. Write the id into the data file and
  treat it as immutable regardless of later edits.
- **Mint before cropping.** Figure filenames embed the id (`assets/coeq_<id>.png`). Do it backwards
  and you have orphaned images.
- Collision risk at ~1,000 questions is roughly 1 in 10,000, and `bank.test.js` already asserts
  uniqueness across the whole bank, so it fails loudly rather than silently.

---

# 5. Difficulty

**Neither book labels difficulty anywhere.** Verified — zero hits for Easy/Medium/Hard/Moderate/
Difficult/Challenging across both text-layer books. It has to be derived.

**The method:** the existing 719 carry College Board's own labels — ground truth from the people who
write the test. Fit a classifier on those, hold out a fifth, and **report the actual agreement
rate.** Chance is 33% on three classes. Around 70% is genuinely useful; near 40% means do not use
it. Also report whether errors are *adjacent* (Medium↔Hard) or *wild* (Easy↔Hard) — adjacent errors
barely matter for an 85% success target, wild ones do.

Features worth trying: passage length, words per sentence, lexical rarity, skill, and the one that
most defines a hard SAT item — how semantically close the distractors are to the key.

**Every extracted question is marked provisional.** Empirical confirmation will not complete at this
scale: four students, ~2–3 timed sets each per week, ~300 new questions — even a lenient three
attempts each needs about 45 weeks. So provisional is a permanent state for most questions, not a
temporary one. That is fine. It means "labelled by us, not by the test maker."

**There is no confirmed/provisional ratio in timed sets.** It was considered and dropped: a
permanent 25% cap would permanently under-use the questions filling the very pools this job targets.
Keep the *label* — it costs nothing and it is what makes a wholesale relabel possible if the
classifier turns out biased, plus the filter is one field in `assignments.js` if success rates sag.

**Keep provisional difficulty out of `recommendDifficulty()`'s calibration** until confirmed, or a
few hundred guesses skew the targeting for a whole skill.

---

# 6. Deduplication

Many questions in these books are already in the bank. Getting this wrong in either direction is
expensive, and the obvious approach fails badly.

**Exact hashing finds nothing.** The existing ids are College Board's, not content hashes, so a
newly minted id will never collide with an existing one. And the OCR text differs from the clean
bank text by dropped characters, so even normalised exact matching catches almost nothing. This has
to be fuzzy from the start.

**The normaliser must be field-aware.** This is the trap. Stripping punctuation — the standard first
move — destroys **59% of the conventions bank**, because for a Boundaries or Form/Structure question
the punctuation *is* the content:

```
A. Umuofia's traditions will be affected.
B. will Umuofia's traditions be affected.
C. Umuofia's traditions will be affected?
D. will Umuofia's traditions be affected?
   → all four normalise to "umuofias traditions will be affected"
```

So: aggressive normalisation on `passage` and `question` (lowercase, collapse whitespace, unify
quotes and dashes, strip bubble glyphs) — **conservative on `options`**, especially for conventions.

**Block on passage, decide on stem plus options.** The passage is long and distinctive, which cheaply
narrows 719 × ~300 to a few candidates each. But a shared passage with a *different* stem is a new
question, not a duplicate — textbooks legitimately write fresh questions on released passages.
Character 4-gram similarity over stem+options settles it. Brute force is fine at this scale; no
clustering machinery needed.

**Measure the threshold, do not guess it.** Run all pairs, sort by similarity, read the
distribution. Above ~0.95 is almost certainly the same question, below ~0.70 almost certainly is
not, and the band between is small enough to review by hand.

**Bias toward catching.** A false positive drops one question of 300 — trivial. A false negative
admits a twin carrying a *different id*, and then the ladder treats them as two items: a student can
"master" one while the other sits at rung 1, the retention counter double-counts, and a mixed set can
serve the same question twice without anything noticing.

**Run it within the batch too** — the three books overlap each other, and both Meltzer titles draw on
the same released material.

**Make it a test, not a script.** A near-duplicate assertion belongs beside the id guard in
`bank.test.js`, so a future batch cannot silently reintroduce what this one filtered out.

---

# 7. Figures (Command of Evidence — Quantitative)

In scope, and it is the thinnest pool — but **28 of 28 existing CoE-Quant questions have images**, so
text extraction alone yields nothing usable here.

Because the books are scans, the table is not an embedded image you can extract — it is pixels inside
the page scan and must be cropped from a render. The region is boundable: the figure sits in the gap
between two text blocks (passage above, stem below), and PyMuPDF gives both bboxes, so the whitespace
between them is your crop rect. Render at 300 dpi and save as `assets/coeq_<id>.png`.

**Verification is mandatory and there is a precedent for it in this repo.** `_gen.js` already asserts
that specific table values survived:

```js
const must=['9.28','15.81','12.64','18.93','12.48','18.87','adult females','adult males'];
must.forEach(m=>{ if(!q.passage.includes(m)) throw new Error('QUANT VERIFY FAIL: '+m); });
```

Do the same: read the crop back and confirm every header, unit and value the question depends on is
inside it. **A table cropped mid-column is worse than no table** — the student simply gets an
unanswerable question, and nothing errors.

---

# 8. The pipeline

**Stage 1 — inventory (done).** `python tools/inventory_books.py` → `_extract/INVENTORY.md` and
`inventory.json`. Re-run if sources change. Gives the page manifest and both question estimates.

**Stage 2 — render and segment.** Render pages at 300–400 dpi. Segment questions by geometry, not
reading order. Each question travels with its own options column, in page order, so option *position*
is preserved even though the letter is not.

**Stage 3 — dual-channel transcription.** Read the crop visually; take the text layer as a parallel
draft; normalise both and compare. **Agreement promotes the record; disagreement sends it to a review
queue.** This is what makes "accurate" a measurable claim rather than a hope. Expect a large queue on
the grammar book and a small one on the Critical Reader.

**Stage 4 — join the answer key.** A separate, separately-verified step. Record the source page of
*both* the question and its key entry on every record, so any later dispute is one lookup. The letter
comes from geometry cross-checked against the key — never from the text layer.

**Stage 5 — dedup.** Per §6, against the merged bank and within the batch.

**Stage 6 — complete the schema.** `skill`, `difficulty` (§5), `ruleType` (§7 below), `strategy`,
`explanation`, `image`.

**Stage 7 — gates, then land.** Nothing enters the bank directly; extracted questions sit in a pending
file and promote only on passing §9.

Work **one book and one chapter at a time**, checkpointing to disk. 546 pages is not a one-shot job,
and a resumable pipeline is the difference between a bad batch costing an hour and costing a day.

**Order: grammar book first.** Its two estimates agree (112 vs 131), so the count is trustworthy, and
it feeds the `ruleType` pools that are actually at the floor. Critical Reader second. Vocabulary last
— it is vision-only, and its main yield is Words in Context, already the deepest pool at 134, though
its Transitions section is worth having.

---

# 9. The traps — every one of these fails silently

Nothing on this list throws an error. Each one produces a bank that looks fine and behaves wrongly.

**`ruleType` missing on a conventions question.** It becomes invisible to every ruleType-filtered
draw, so the colon/semicolon/dash holes this job exists to fill stay exactly as they are.
`assignments.js` states it plainly: *"assignments.test.js checks pool depth by skill+difficulty and
IGNORES ruleType, so it will NOT catch a thin ruleType draw."* **Classify `ruleType` for every
conventions question or the job has failed at its main purpose.**

**Option letter taken from the text layer.** `®` serves both A and B. Geometry plus key, always.

**A systematic off-by-one in letter assignment.** Silent and uniform — every answer wrong,
consistently. Cheap detector: the correct-answer distribution across a batch should be roughly
uniform across A/B/C/D. If a batch comes out 60% C, the geometry is wrong. **Assert this.**

**A dropped comma in a Boundaries option.** Produces a question with no correct answer. Only the page
image catches it.

**Punctuation-stripping normaliser.** 59% false duplicate rate on conventions. See §6.

**A duplicate or missing `id`.** Ledger corruption; see §4 and the `eadb23f` commit message.

**Ext script loaded before its base bank.** `questionBank_CON` does not exist yet and the `push`
throws. Worth a line in the test suite rather than a comment.

**`?v=` not bumped.** The bank scripts are all served as `?v=20260703` (3 July), but
`data-info-ideas.js` was last committed 12 July — so a browser holding the 3 July copy has **not
refetched the 12 July questions.** Bumping the tag is the fix, and it must be part of the landing
checklist for the new questions. It is also a live pre-existing bug in its own right — see §12.

**The unseen flood.** The day's draw is `unseen → needsWork → resting`, so ~300 new questions make
every set almost entirely new material until it has attempt data. Review survives — `9395e38` moved
spacing onto `dueForReview()` as a separate channel deliberately — but expect success rates to dip
for a couple of weeks after the merge, and tell the tutor **not to read that as students regressing.**

**Provisional difficulty reaching `recommendDifficulty()`.** Skews calibration for a whole skill, not
just the new questions.

---

# 10. Gates — nothing lands until all of these pass

Per question:
- exactly 4 options; `answer` matches `/^[A-D]$/`
- no empty `passage`, `question`, `explanation`, `strategy`
- `skill` matches a bank value **exactly**, em dash included
- `ruleType` present for every Boundaries / Form, Structure, and Sense question
- `image` file exists on disk for every record that names one
- provenance recorded: source book, question page, key page

Per batch:
- every `id` unique across the **merged** bank (base + all ext files)
- answer-letter distribution roughly uniform
- near-duplicate check clean against merged bank and within batch
- classifier holdout agreement reported, with adjacent-vs-wild error split

Then run the tests. **`npx jest` finds no config in this repo and silently does nothing** — it exits
0 having run nothing at all, which reads exactly like a pass. Use the canonical list from
`../AGENTS.md`, which is authoritative and complete; do not run a subset:

```
npm install jsdom --prefix /tmp/j
NODE_PATH=/tmp/j/node_modules node homework/homework-run.test.js   # the learning loop (slow)
NODE_PATH=/tmp/j/node_modules node homework/review-ladder.test.js  # spacing, retention, calibration
NODE_PATH=/tmp/j/node_modules node homework/assignments.test.js    # the plans are sane
NODE_PATH=/tmp/j/node_modules node homework/bank.test.js           # the bank is classified right
NODE_PATH=/tmp/j/node_modules node challenge/*.test.js             # the challenge feature
NODE_PATH=/tmp/j/node_modules node ns-migrate.test.js              # nobody loses their work
node tutor-sheet/apps-script.test.js                               # the sheet + dashboard join
```

`homework-run.test.js` buffers to a pipe and prints nothing until it finishes. It is not hung.

**Also change the sister app.** `PSAT 8-9/app` runs the same homework engine from separate files
with no shared module. If this work touches the engine rather than only the data, the same fix is
needed there, and both suites must be run.

---

# 11. Ask the tutor, do not guess

- The question-specific line for each grammar `explanation` (§3). The rule template is yours; the
  "which word triggered it here" sentence is theirs.
- Any question the dual-channel check flags as disagreeing and you cannot resolve from the image.
- Whether the Critical Reader is digital-format throughout. Page 46 is correct — "Mark for Review",
  one question per short passage — but if earlier sections use the old long-passage-many-questions
  shape, those questions are the wrong form for this app regardless of how cleanly they extract.
  **Verify before extracting that book.**

Finally: this repo is public and names of students must never appear in app prose or in committed
files. Tutor-facing notes belong in `homework/PLAN-NOTES.md`, which is gitignored.

---

# 12. Deferred fixes — pre-existing, not caused by this work

Two repo problems were found while preparing this pipeline and consciously **left for stage 2 to
clear**, because they are small and it is wasteful to make a separate pass for them. Neither is caused
by the extraction. Both are recorded here so they are not lost — a deferred fix that is not written
down is a fix that does not happen.

**1. The bank cache tag is stale (student-facing, fix regardless of extraction).**
All four bank scripts are loaded as `data-*.js?v=20260703` across `index.html`, `homework-run.html`,
`ii.html` and `sec.html`, but `data-info-ideas.js` was last committed **12 July** — after that tag.
The `?v=` string is the whole cache-busting mechanism (there is no build step), so a returning
student's browser serves the 3 July bank and silently never refetches. Jeffrey's Info & Ideas draws
in particular may be running against a stale file right now. **Fix:** bump every `?v=20260703` to the
day the new questions land, in one pass across all HTML that loads a bank. Since stage 2 adds the
`-ext.js` files and their `<script>` tags to those same HTML files, do it in the same edit — and see
§9, this is the trap the new questions themselves will hit if the tag is not bumped.

**2. `MasteryApp/AGENTS.md` has two broken doc links (off by one directory).**
Lines 162 and 165 point to `../../../AGENTS.md` and `../../../Pedagogical-Design-Handbook.md`. Those
resolved when the app lived at `SAT GUIDES/WAYNE/MasteryApp`; it has since moved up one level to
`SAT GUIDES/MasteryApp`, so from `MasteryApp/AGENTS.md` the correct paths are now **`../../AGENTS.md`**
and **`../../Pedagogical-Design-Handbook.md`** (verified: `../../../` misses, `../../` resolves).
**Fix:** change `../../../` to `../../` on both lines. Nothing else in the file is affected.
*(For the record: the `pedagogy` skill's identical-looking `../../../` references were checked and
are correct from that skill's own location — do not "fix" those.)*
