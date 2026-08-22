# Baseline Screener — evaluation of the sister app's build, and what a port here needs

**Subject:** `PSAT 8-9/app` baseline module (`baseline-spec.js`, `baseline-grade.js`,
`baseline-store.js`, `baseline.html`, `baseline-recover.html`, five test suites).
**Written:** 22 Aug 2026. Every claim below was checked by reading the source or running it —
where a number appears, the command that produced it is named.

**Status:** Phase 0 is done. The five defects marked ✅ below were fixed in the sister app on
22 Aug and all sixteen of its suites are green (§2a). Nothing has been ported here yet — Phase 1
still has two decisions to settle and two blockers that are ours alone (§3.4).

---

## 1. How it was built, and what it got right

It was built twice. Version one was 18 hand-picked items in a JSON file
(`build_baseline.py` → `baseline_set.json`). An internal review on 20 Aug scored it 41/100 and
named nine defects. It was rebuilt the same day, and `build_baseline.py` now refuses to run so
nobody regenerates the old page over the new one.

The rebuild's method is the part worth copying, more than the code is. **It audited the bank
before writing a line, and the audit killed the original proposal.** The plan had been an
Easy/Medium screener with a Hard second stage; the tally said Easy was the *scarce* tier
(50 Easy / 138 Medium / 276 Hard, nine of eleven skills holding four or five Easy items in
total), so a fixed screener could not be anchored there. Medium became the anchor because it is
the only tier deep enough to supply three parallel forms *and* the modal difficulty of the real
section.

The design that fell out of that:

- **A uniform measurement base.** The same two Medium items per skill for every student, so
  the denominator never moves. An earlier draft scored difficulty-weighted points ÷ available
  points and was thrown out because an adaptive stage two gives one student a denominator of 4
  and another a denominator of 2, and 0.75 silently means two different things.
- **Per-skill routing, not a global router.** 2/2 spends a Hard ceiling probe; 0/2 spends a
  scarce Easy floor probe; 1/2 spends nothing, because *Developing* is already the honest
  answer. A half-right screener costs no follow-up at all, which is why stage two is typically
  6–8 questions rather than 11.
- **Five bands instead of a percentage**, because two items cannot support a percentage.
  *Priority* (has the idea, can't apply it) vs *Foundational* (the idea isn't there) is the
  distinction the old report could not draw, and it is the one that changes what a tutor does.
- **Skill weight derived from the bank at run time** — domain blueprint weight × the skill's
  share of its own domain. Ranking on bare domain weight put Cross-Text Connections above
  Rhetorical Synthesis, which is backwards. The test suite caught that, not the author.
- **A projection reported as a 60-point *range*,** and `baselineDelta()` refuses to call
  movement real unless two ranges fail to overlap. Telling a parent that ±30 of instrument
  noise is progress is how a baseline loses its credibility.
- **Forms A/B/C, provably disjoint,** seeded per *skill* so the three forms are slices of one
  ordering rather than three independent draws that could collide.
- **Preflight that throws rather than papers over.** A skill that cannot supply a form is a
  loud error, and a probe slot that cannot be filled is reported as a gap — never
  substituted with another skill, because that is precisely how coverage rots.
- **The record is written the instant the screener ends,** before the optional follow-up,
  because the follow-up may never happen.
- **A timing overlay** — non-attempt (<8s), rushed (<15s and wrong), laboured (>150s and
  wrong) — so "didn't know it" is separable from "ran out of clock". A skill whose items were
  all non-attempts reports `not-measured` rather than a band built on a coin flip.

That is a genuinely well-reasoned instrument, and the reasoning is written down in the file
headers where the next editor will actually meet it.

---

## 2. Verified state: three things are red right now

Run from `PSAT 8-9/app` with `NODE_PATH` pointed at the sibling `node_modules`.

| Suite | Result |
|---|---|
| `baseline.test.js` | **40 passed, 0 failed** |
| `baseline-store.test.js` | **17 passed, 0 failed** |
| `baseline.e2e.test.js` | **28 passed, 0 failed** |
| `baseline-sync.test.js` | **26 passed, 2 FAILED** |
| `baseline-recover.test.js` | **21 passed, 1 FAILED** |
| `cache-tags.test.js` | **17 stale tags** (app-wide; `baseline.html` itself is clean) |

The rebuild doc claims "85 tests passing" — which is exactly 40 + 17 + 28, the three suites that
existed when it was written. The two suites added afterwards have never been green, and
**none of the five appear in that app's `AGENTS.md` run list.** That is the precise failure mode
its own `AGENTS.md` warns about in its opening lines: a suite nobody runs goes red and stays red.

## 2a. State after Phase 0 — 22 Aug

| Suite | Before | After |
|---|---|---|
| `baseline.test.js` | 40 / 0 | **44 / 0** (+4 served-order guards) |
| `baseline-store.test.js` | 17 / 0 | **17 / 0** |
| `baseline.e2e.test.js` | 28 / 0 | **32 / 0** (+4: ledger, review-draw, whole-question review, misses first) |
| `baseline-sync.test.js` | 26 / **2** | **28 / 0** |
| `baseline-recover.test.js` | 21 / **1** | **22 / 0** |
| `cache-tags.test.js` | **26 stale** | **OK — 66 references, none stale** |

The other ten suites on that app's list were run too and are green: `gate` 19, `ruletype` 5,
`session-responses` 24, `session-nav.e2e` 32, `review-ladder` 50, `assignments` 117, `bank` 7,
`homework-run` 77, `ratio-mix` 44, `tutor-dashboard` 45.

**One practical note that is most of why these stopped being run.** `baseline.e2e.test.js` took
2m33s wall for 7s of CPU: it was reading jsdom's thousands of small files, and a megabyte of
`data-*.js`, across the synced folder. Copy jsdom to a local disk (`--prefix /tmp/j`, and
`JSDOM_PATH` where a suite honours it) and run from a local copy of the app and the same suite
finishes in seconds. A three-minute suite gets skipped; a three-second one does not. Worth doing
here before we add five more.

---

## 3. Weaknesses

Ordered by how much damage they do. Everything in §3.1–3.4 must be settled before any of this
lands here; §3.5 onward can ship as known limitations if we say so out loud.
✅ = fixed in the sister app on 22 Aug and under test there; it arrives here already closed.

### 3.0 ✅ The review showed the answer but not the question

Found in use, not in the code. The results panel printed the skill, `Your answer: B · Correct: C`
and the rationale — with the stem, the passage and the four options nowhere on the page. There is
nothing to work through in that: the letters name options the student can no longer see, and the
rationale discusses a text that is gone. Our own rule, in `AGENTS.md`:

> **Every question survives the set** — passage, her answer, the right answer, the explanation
> — re-readable, misses first, reopenable tomorrow from the hub.

The runner has always honoured it. The baseline never did, and the baseline is the one sitting
most likely to be reviewed with a tutor afterwards — so the module whose entire output is "here
is what to work on" was the one you could not work through.

**Fixed:** each row opens to the passage or figure, the stem, and every option with the correct
one and the chosen one marked; explanation underneath; misses sorted to the top. Collapsed by
default, because 22–30 expanded passages is a wall nobody scrolls. Three e2e assertions hold it,
including one that checks every served stem actually appears with its full option count.

### 3.1 ✅ The baseline poisons the homework review queue — the one that worried me most

`finishScreener()` calls `recordAnswer(id, correct, 'baseline')` for all 22 items. That creates
ledger entries across **all eleven skills**, including every skill the student has never been
taught. A miss sets `streak = 0`, which is rung zero on the ladder — **due again in one day**.

`homework-run.html` (line 279 here, 332 there) splices in
`dueForReview(QB, reviewN, _inSet)`, and `dueForReview` filters on nothing but "has a ledger
record and is overdue". So the day after a baseline, the runner starts serving up to two review
questions a day drawn from skills nobody has taught yet.

Our `AGENTS.md` states the rule this breaks, in as many words:

> It never serves an unseen question — a "review" block that hands a student an untaught skill
> cold is not review.

The baseline makes 22–30 questions "seen" without teaching one of them, and it is *designed* to
produce misses everywhere. This is not a bug in either module read alone; it is a conflict
between them, and it is live in the sister app today.

**Fixed** by not writing to the ledger at all. Nothing is lost: the baseline record already
stores every item with the chosen letter, the correct letter and the elapsed seconds, which is
strictly more than the ledger kept. The record is the right home for baseline data; the ledger is
for questions that have been taught. Two e2e assertions hold it — one that the ledger is empty
after a full sitting, and one that `dueForReview` against the real bank returns nothing, which is
the statement of the rule rather than of its mechanism.

### 3.2 ✅ The served order is a repeating eleven-skill cycle

Defect #8 of the original review was "predictable item order… learnable across retakes". The
rebuild claims it is fixed: *"Real domain order, skill pairs never adjacent."* It is not fixed.

`buildBaselineForm` returns `orderBaselineSAT(...)` — correct domain blocks. Then `baseline.html`
runs the result through `spreadBaseline()`, which round-robins the eleven skill lanes. I printed
the served order for Form A:

```
 1 C&S   Cross-Text Connections        12 C&S   Cross-Text Connections
 2 C&S   Text Structure and Purpose    13 C&S   Text Structure and Purpose
 3 C&S   Words in Context              14 C&S   Words in Context
 4 I&I   Central Ideas and Details     15 I&I   Central Ideas and Details
 5 I&I   Command of Evidence — Quant   16 I&I   Command of Evidence — Quant
 …                                     …
11 SEC   Form, Structure, and Sense    22 SEC   Form, Structure, and Sense
```

Two identical sweeps, period exactly 11. It is the *most* predictable order available, and it
also destroys the domain blocking the file's own comment says is essential — the student crosses
all four domains twice. Both goals are satisfiable at once: spread **within** each domain
(C&S: A B C A B C; SEC: A B A B). The e2e suite passes because it only asserts "every item is
Medium" and "all 11 skills appear".

**Fixed:** `spreadBaseline` now groups by domain first and round-robins the skill lanes inside
each group, so Form A serves `C&S×6 → I&I×4 → I&I×4 → EoI×4 → SEC×4` in blocks with no skill
adjacent to itself. Four new assertions in `baseline.test.js`, and they test the **served**
array — the reason this survived so long is that the existing order test asserted on
`buildBaselineForm`'s output, which the page never serves.

### 3.3 ✅ The plan never reaches the tutor — and the two failing sync assertions say so

`baseline-sync.test.js` fails on:

- `baseline.sitting` — expected 1, got `undefined`. `baselineSheetPayload()` never emits it, so
  the sheet cannot tell a first sitting from a retake.
- `baseline.focus` — "no focus list". The ranked focus queue is written to
  `localStorage` and **nothing sends it anywhere.** The tutor sees bands but not the ordered
  plan derived from them.

Both are small omissions in `baselineSheetPayload()`. They matter because they are the last hop
of the thing the rebuild was for.

The `baseline-recover.test.js` failure is different — a test bug. It compares every key of the
raw builder output against the posted body, but `sheet-sync.js` deliberately renames `source` →
`type`, so `source` is reported missing. The exclusion list already skips `assignmentId` and
`blurCount`; `source` belongs on it. Red is still red, though, and it means nobody has run this
suite since it was written.

**Fixed:** `sitting` is stamped by `saveBaseline()` — on the device, at the time, so a record
recovered months later still knows it was the second baseline — and the focus queue now goes into
the record as well as into its own key, with one `slimFocusQueue()` shape shared by the live key,
the record and the payload. The recover test's exclusion list picked up `source`, with a comment
saying why: `type` is asserted separately, so comparing `source` here only asserted that the
rename had not happened.

### 3.4 A port here hits two hard blockers the sister app never had

**(a) The bank cannot supply three forms.** Same audit, our data
(`data-*.js`, 719 questions):

| Skill | Easy | Medium | Hard |
|---|---|---|---|
| Boundaries | 16 | 21 | 24 |
| Central Ideas and Details | 16 | 15 | 16 |
| **Command of Evidence — Quantitative** | 16 | **5** | 7 |
| Command of Evidence — Textual | 16 | 17 | 20 |
| Cross-Text Connections | 22 | 21 | 27 |
| Form, Structure, and Sense | 17 | 19 | 23 |
| Inferences | 13 | 13 | 26 |
| Rhetorical Synthesis | 18 | 31 | 21 |
| Text Structure and Purpose | 28 | 33 | 35 |
| Transitions | 20 | 14 | 15 |
| Words in Context | 47 | 35 | 52 |
| **Totals** | **229** | **224** | **266** |

Three forms at two per skill needs six Medium. **Command of Evidence — Quantitative has five.**
Preflight would throw, correctly. Note the shape of our bank is the *opposite* of theirs —
Easy is not scarce here, Medium is only just adequate, and it is thin in exactly one place.

`AGENTS.md` already tells us why that cell is thin: the source PDFs label evidence questions only
"Command of Evidence", the parser infers the kind from the stem, and this pool was once **3**
Medium in a 719-question bank because the old inference counted digits and a bar graph
contributes none. Five is the post-fix number. So the first thing to do is re-audit that
classification — if it is still under-calling Quantitative, the blocker dissolves. If five is
the true count, the honest options are two forms (A/B needs four) or a form-C exception for
that one skill, declared loudly rather than papered over.

**(b) Nothing we send would survive the backend.** The PSAT Apps Script has a `Raw payload`
column that catches anything the schema has no home for — which is the only reason their
`payload.baseline` block reaches the sheet at all. **Our `rw-apps-script.md` has no such
column.** `normalise_()` builds each row key by key from a fixed list, so bands, projection,
form and focus would be dropped server-side without an error, and the tutor would get a bare
row reading `Type: baseline · Score 14 · Max 22`. That is a backend change plus a redeploy, and
`tutor-sheet/apps-script.test.js` parses the header row out of the checked-in script, so it has
to move in the same commit.

### 3.5 Smaller, real, and worth fixing while we are in there

- **Sitting 4 silently re-serves Form A.** `nextBaselineForm()` falls back to
  `BASELINE_FORMS[taken.length % 3]`, and the intro still prints *"different questions from last
  time"* — a statement that becomes false. Either build a fourth form or say "you have seen
  these before".
- **Probes are `pool[0]`.** The screener is carefully seed-shuffled; the probe then takes the
  first matching item in bank order, so every student gets the identical Hard question for a
  skill, on every retake. Seed it the way the forms are seeded.
- **"Confirmed" is the wrong word for a 1/2 screener.** `confidence` is `'confirmed'` whenever
  no probe was routed — and 1/2 routes no probe. So the *least* informative outcome carries the
  same label as a probe-resolved one. It means "no further probe planned", not "measured
  reliably". Rename it, or the tutor over-reads it.
- **No mid-sitting persistence.** Answers and per-item times live in page memory. A crash, a
  closed tab or a flat battery costs the whole 22 minutes with nothing recoverable. The
  homework runner grew `session-responses.js` for exactly this; the baseline has no equivalent.
- **`anti-cheat.js` is not wired in.** `blurCount` posts blank. Practice sessions record tab
  switches; the one sitting whose integrity matters most does not.
- **Running out of time is scored as not knowing.** Unanswered items count as wrong in the
  projection with no caveat. The per-skill overlay catches this (`not-measured`), the projection
  does not. At minimum the caveat line should say so when blanks exist.
- **`skillWeights` caches on `bank.length`.** Two different banks of equal length return the
  first one's weights. Only bites in tests, but it will bite there.
- **The projection is uncalibrated** (their doc says so) and **two items per skill is thin**
  (their doc says that too). Both are honest limitations, not defects — keep the disclosure.
- **Client-side, device-local everything.** Form rotation, the record and the growth delta all
  live in one browser's `localStorage`. Sit the baseline on the tutor's laptop and retake at
  home and you get Form A twice. `baseline-recover.html` exists because of this fragility; it
  recovers the record but not the rotation.
- **The focus queue is written and nothing reads it.** Their own "not done yet". Here that is
  more than an omission — our `AGENTS.md` says *"Assigning homework means editing
  `homework/assignments.js` and nothing else."* An auto-generated queue that steers question
  selection would break that rule silently. See §4.

---

## 4. What to build here, and in what order

### Phase 0 — ✅ done, in the sister app, 22 Aug

Copying a module with three red suites duplicates the red, so the fixes were made at the source.
What changed there:

1. **The review carries the whole question again (§3.0)** — passage, stem, marked options,
   explanation, misses first.
2. **No ledger write (§3.1).** The write is gone from both stages; two e2e assertions hold it,
   one on the ledger and one on the real `dueForReview` draw.
3. **Order spreads within a domain (§3.2)**, with four assertions on the array the page actually
   serves — including one that fails if the skill sequence ever becomes periodic again.
4. **`sitting` and `focus` reach the sheet (§3.3);** the recover test's rename exclusion is fixed.
5. **All five suites are on that app's `AGENTS.md` run list,** under a note explaining what
   omitting them cost, and it now has a full baseline section covering the Medium-anchor
   rationale, the no-ledger rule, the order rule and the known limits. All **26** stale `?v=`
   tags cleared; `cache-tags.test.js` green.

Everything that lands here therefore lands already fixed. The remaining phases are ours.

### Phase 1 — decide the three things the bank and the backend force

- **Forms.** Re-audit `Command of Evidence — Quantitative` Medium first. Then choose: two forms,
  three with a declared exception, or a widened anchor for that skill alone.
- **Scale.** Theirs projects 120–720 (PSAT 8/9). Ours is **200–800**. The centre formula
  (`120 + (0.15 + acc × 0.72) × 600`) is anchored to that range and has to be re-derived, not
  rescaled by eye. It stays a range, and it stays labelled uncalibrated.
- **Pacing.** They run 22 items in 22 min (60 s). Real SAT R&W is ~71 s/question, so a faithful
  22-item sitting here is ~26 minutes. That is a real length for a first session — worth a
  decision, not a default.

### Phase 2 — port, adapting rather than copying

Same "same engine, separate files" discipline as the homework runner: five new files here, no
shared module, both suites run on every change.

| File | Change from theirs |
|---|---|
| `baseline-spec.js` | Skill list identical. **Delete `BASELINE_DOMAIN_ORDER`** — ours is C&S → I&I → **SEC** → **EoI**; theirs has the last two swapped. Use `RW_DOMAIN_ORDER` / `orderSATStyle` from `app.js`, or a guarded copy, so the two cannot drift. Forms per Phase 1. Preflight unchanged; it is the part that will catch our bank. |
| `baseline-grade.js` | Bands, routing and timing carry over unchanged. Re-derive the projection for 200–800. Skill weights recompute from our bank automatically — for reference they come out Boundaries 13.2 / Form-Structure-Sense 12.8 / Words in Context 12.5 / Rhetorical Synthesis 11.8 / Text Structure 9.0 / Transitions 8.2 / CoE-Textual 7.7 / Inferences 7.5 / Central Ideas 6.8 / Cross-Text 6.5 / CoE-Quant 4.0. Fix the length-keyed cache. |
| `baseline-store.js` | `psat89_` → **`satrw_`**; `psat89_user` → **`mastery_user`**. Add `sitting` and `focus` to the payload. |
| `baseline.html` | **`ns-migrate.js` must be the first script on the page** — before `gate.js`, before everything. It is not on their page because they have no legacy namespace; skip it here and a returning student's ledger reads empty. Gate second. Domain-spread order. Wire `anti-cheat.js`. Add mid-sitting persistence. `?v=` tag on every script, dated. |
| `baseline-recover.html` | Straight port once the store keys change. |
| `tutor-sheet/rw-apps-script.md` | Either add the baseline columns explicitly or add a `Raw payload` catch-all like theirs. Update `apps-script.test.js` in the same commit, then redeploy. |
| `cache-tags.test.js` | Picks the new page up automatically; run it before claiming anything is live. |
| `AGENTS.md` | A baseline section, and every new suite on the run list. Non-negotiable given §2. |

### Phase 3 — the handoff, done our way

The focus queue should feed **the tutor**, not the question selector. Concretely: post it to the
sheet, surface it on `tutor-dashboard.html`, and let a human turn it into a week in
`homework/assignments.js`. That keeps the house rule intact, keeps the diagnosis reviewable
before it becomes a plan, and avoids the sister app's dead end where a queue is written and
nothing reads it. If we later want it to drive `buildWeakAreaSet()`, that is a separate decision
with its own test.

### Testing

Port all five suites — they arrive carrying the §3.0–3.3 guards already — plus:

- a preflight case pinned to **our** bank, so the day someone rebuilds `data-*.js` and thins a
  Medium pool, the baseline fails loudly instead of quietly shipping a hole;
- a `review-ladder.test.js` case here as well, since the no-ledger rule is a claim about *our*
  review draw and the two apps share no code;
- an `apps-script.test.js` case for whatever we add to the backend in §3.4(b).

And put every one of them on our `AGENTS.md` list in the same commit. That list already carries
the warning; the sister app is what happens when five suites are written and not added to it.

**Run them off a local disk.** `baseline.e2e.test.js` took 2m33s of wall time for 7s of CPU
reading jsdom and the bank across the synced folder, and about three seconds from `/tmp`. Node
buffers to a pipe, so a slow suite prints nothing at all until it finishes and reads as hung.
A suite that takes three minutes and looks broken is a suite that stops being run — which is the
whole mechanism behind §2.
