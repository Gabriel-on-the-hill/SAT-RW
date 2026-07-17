# Pedagogy Alignment — SAT R&W app (MasteryApp)

> **The backlog that carries this app to 100% handbook alignment.** Implementation-ready: every item
> says *what, why, where, how,* and *how to prove it.* Work top to bottom — items are ranked by
> learning impact per unit of effort, not by difficulty.

**Read first:** [AGENTS.md](AGENTS.md) (this app's mechanics) · root [AGENTS.md](../../../AGENTS.md)
(the house rules — *whether*) ·
[Pedagogical-Design-Handbook.md](../../../Pedagogical-Design-Handbook.md) (the *why*, by ID). The
full evaluation this backlog comes from is the "app-pedagogy-eval" artifact.

> **Sister app:** `PSAT 8-9/app` runs the same engine from separate files and carries an identical
> copy of this backlog. **Every change here is a change there. Do both, keep both files in sync, run
> both test suites.**

---

## Where this app stands (16 Jul 2026)

The reference implementation — closest of the three app families to the handbook. The active loop
*is* the product: prediction-before-options (retrieval), un-telegraphed interleaved quizzes,
untimed→timed, a redo that never overwrites the clocked attempt, real spaced retrieval, and — since
this session — a durable-learning metric and difficulty that calibrates itself toward ~85%.

| Category | Status | |
|---|---|---|
| Cognitive load | ◐ partial | scaffolding fades untimed→timed |
| Memory & retention | ● solid | spacing ladder + `sections` interleaving |
| Mastery & sequencing | ◐ partial | tutor-authored, not graph-gated (by design) |
| Assessment & feedback | ● solid | immediate, un-telegraphed, truth-preserving |
| Motivation & UX | ◐ partial | honest progress; no gamification |
| Adaptive & analytics | ● solid | rich diagnostics **and** a retention metric |

Items 1 and 2 are **shipped**. Item 3 is by design and is documented, not built. What is left is one
follow-on that needs the tutor, in §4.

---

## 1 · Measure retention, not just acquisition — `AN-4`, `MR-8` · **SHIPPED 16 Jul 2026**

**The gap it closed.** The app recorded whether an answer was right, but never whether it was right
*after a delay*. So it could not tell "learned and retained" from "learned and forgotten" — the exact
claim the monthly reports make to parents. The spacing ladder *created* delayed retrievals; nothing
*counted* them.

**What shipped.**
- `progress.js` — a sibling store, `satrw_retention_<user>`, shape `{ [skill]: { correct, total } }`.
  `recordAnswer(id, isCorrect, source, meta)` takes a 4th argument, `{ skill, review }`, and tallies
  retention only when `review` is true. `getRetention()` returns
  `{ bySkill: { [skill]: {correct,total,rate} }, overall: {…} }` — **rates always ship with their
  counts**, because "100%" off one retrieval is not a retention claim and a surface that cannot say
  `1/1` will imply it was. `mergeRetention()` + `resetLedger()` clear-down.
- `homework-run.html` — tags the `dueForReview()` picks (`_isReviewQ`) and passes
  `{ skill, review }` on every answer. The student is **never** told which questions are reviews: a
  flagged question is answered differently, and the measurement would be of the flag, not the memory.
- `progress.html` — a **Retention** summary cell next to Overall accuracy, and a per-skill **kept
  N% (c/t)** figure next to each accuracy bar. The pair is the point: a 90% bar beside a 50% kept is
  practice landing and memory not.
- `storage.js` — backup and restore carry `retention`.

**Why `meta` rather than the `source: 'review'` this backlog originally specified.** `source` says
*where* an answer happened (`practice` / `exam` / `homework`); `review` says *why the question was
drawn*. Folding them together would have lost provenance and broken the exam-counts-double rule for
any review inside an exam. They are orthogonal, so they are separate arguments.

**What does NOT count, and why each one would flatter the number:** a first attempt (that is
acquisition), a redo (untimed, notes open — not a memory test), and any legacy 3-argument caller.
`homework/review-ladder.test.js` §10–11 holds all of it.

---

## 2 · Calibrate difficulty toward ~85% success — `AS-4` · **SHIPPED 16 Jul 2026**

**The gap it closed.** Difficulty was whatever the tutor typed into the day. Nothing nudged a
cruising student up or an overloaded one down toward the ~85%-success band where learning is
maximised.

**What shipped.**
- `progress.js` — `getSkillAccuracy()` rebuilds rolling per-skill accuracy from the trap buckets
  (the only per-skill record the app keeps; the mastery ledger is keyed by question id and does not
  know a question's skill). `recommendDifficulty(skills)` takes a name or an array and returns a
  **bias**, never a difficulty: `>0.90 → 'up'`, `<0.80 → 'down'`, else `'hold'`.
- `homework-run.html` — `_calibratedPick()` replaces `_pick()` in the section builder. A section
  listing a **range** (`diffs:["Medium","Hard"]`) leans ~70% of its count toward the target end and
  still mixes the other in; the result is shuffled so the section does not serve a Hard block then a
  Medium block, which is the blocking `sections` exists to prevent.
- `homework-run.html` also now calls `recordTrapOutcome()` — **homework never fed the per-skill
  stats; only the practice app did.** The trap analytics, and calibration with them, were blind to
  the work the students actually do most of. This was not in the original plan for this item and is
  what makes it work at all.

**Two design calls this backlog did not specify.**
- **`MIN_CALIBRATION_ATTEMPTS = 8`.** 3-for-3 on a skill is a coin landing heads three times, not
  evidence of cruising. Under the threshold it holds, so a student's first day on a new skill runs
  exactly as authored.
- **It leans, it does not lurch** (`CALIBRATE_LEAN = 0.7`). A cruising student gets harder work, not
  a wall; a drowning one gets relief, not a demotion.

**The guardrails, and where they are held.** Calibration only ever acts inside a range the tutor
allowed; a day that pins one difficulty is a decision, not a range, and is untouched. The per-skill
exact count survives calibration even when the leaning end is thin. `homework/homework-run.test.js`
§11 drives the real page and asserts all three.

---

## 3 · Retention on the tutor dashboard — `AN-4` · **SHIPPED 16 Jul 2026 · ONE MANUAL STEP LEFT**

> ### ⚠️ The tutor must redeploy the Apps Script, or none of this reaches the sheet
> `tutor-sheet/README.md` → **Deploy**: open the Sheet → Extensions → Apps Script → delete what is
> there → paste the `javascript` block from **`tutor-sheet/rw-apps-script.md`** → Deploy → Manage
> deployments → edit the existing web app → **New version → Deploy**. Keep the same URL.
> `ensureHeaders_` only ever appends headers to the right and never clears a cell, so this is safe on
> the live sheet with all its history. **Until it is redeployed the `Retention` column is never
> written, and the dashboard shows `kept —` for everyone.**

The retention pair now reaches the tutor without the student's device:

- `homework-run.html` — `sessionRetention()` tallies the session's delayed retrievals per skill and
  posts them as `retention`. Same rules as the ledger's own counter, because two numbers for one
  thing that disagree are worse than one: only questions the ladder chose, and **only ones actually
  reached** — `finish()` backfills not-reached questions as `ok:false` so the review screen can show
  them, and counting those would report a student as forgetting work they never saw.
- `tutor-sheet/rw-apps-script.md` — a `Retention` column, R&W-only, appended last.
- `tutor-dashboard.html` — acquisition and retention side by side per student, plus an overall tile.

**Blank is not zero, and the UI says so.** No review due means "we don't know yet". A `review: 0`
plan never generates any.

### What this uncovered — three live bugs, all silent

1. **The dashboard could not read its own sheet.** It asked for the *payload's* field names (`pct`,
   `date`, `blurCount`, `skillStats`); the script writes the *sheet's* headers (`Percent`,
   `Timestamp`, `Focus Losses`, `Breakdown`). A missing column returns `''` rather than throwing, so
   dates, percentages, tab-switches and the whole "Weakest" line rendered blank — indistinguishable
   from a tutor with no data. Fixed with a `COL` map (current name first, legacy names after) and a
   `Percent` reader that understands the fraction the script actually stores.
2. **The predictions never reached the sheet — and still had not, after the fix.** `rw-apps-script.gs`
   carried `Prediction` / `On text` / `On options`; **`rw-apps-script.md` did not, and the `.md` is
   what the README tells you to paste.** The fix for "homework logging" landed in a file nothing
   deploys and nothing tests. The reasoning the class reviews together has been dropped server-side
   this whole time. Both `.gs` files are now **deleted** — a second copy that is neither deployed nor
   tested is what caused this — and the `.md` carries the fix.
3. **Two guards were rotten.** `apps-script.test.js` asserted the two subjects' Questions columns were
   *exactly* equal, which is what made bug 2 unfixable in the right file; it now asserts a shared core
   with R&W's extras appended to the right, which is what the code always said it wanted. And the
   fixture guard flattened nested keys, so it went permanently red the day `questions` was added — a
   guard that can never pass is a guard nobody reads. Both fixed, plus a new §7 that posts a real
   payload and asserts every column the dashboard asks for resolves against the header row that
   actually comes out.

---

## 4 · Mastery gating — `M5`, `CD-2` · **by design; documented, not built**

This app gates on mastery through *tutor discipline* (`assignments.js` only names taught skills) plus
the student's `LEDGER.md`, not through a code-enforced knowledge graph. That is the deliberate
architecture: the tutor authors the path. **Do not "fix" this into automated gating** without a
decision — it would be a re-architecture, and the tutor's judgement is the feature. The one code
guard already exists: `assignments.test.js` fails on empty/thin pools. Leave this here as a known,
accepted stance, not a task.

---

## The bar for anything new (future-proofing)

Any new skill, question bank, homework shape, or feature added to this app must clear this before it
ships — this is the handbook's §19 checklist, scoped to here:

- [ ] **Attempt before answer.** The predict-first gate is never bypassed for a new question type.
- [ ] **Mixed, not blocked.** A multi-skill day uses `sections`. A new bank has enough Medium *and*
      Hard to interleave and to calibrate (guarded by `bank.test.js`).
- [ ] **Enrolled in spacing.** Any new practice surface records answers through `progress.js` so the
      ladder schedules them. Nothing is "answer once and done."
- [ ] **Measured, and honestly.** A new surface passes `{ skill, review }` to `recordAnswer`, so its
      delayed retrievals count toward retention and its first attempts never do. If it can be
      answered with notes open or after the answer has been seen, it counts as neither.
- [ ] **Un-telegraphed assessment.** No new quiz previews its contents, and none goes timed before the
      student has untimed competence.
- [ ] **No answer-revealing help.** A new hint coaches the next move; it never contains the answer.
- [ ] **Truth preserved.** A new redo/retry path never overwrites the first clocked attempt.
- [ ] **Nothing student-readable assesses the student** (`assignments.js` is public — root rule 6).
- [ ] **A test guards it.** If it broke silently, there is a `*.test.js` that now fails.

## Definition of 100% aligned

**Reached, in code, on 16 Jul 2026.** Items 1, 2 and 3 are shipped and green; acquisition and
retention sit side by side both on `progress.html` (with the student) and on `tutor-dashboard.html`
(when writing the report). Every handbook category above is ● except mastery-gating, which is ◐ **by
choice** and documented in §4.

**One manual step stands between "aligned in code" and "aligned in fact": the Apps Script redeploy in
§3.** Until that is done the `Retention` column is never written and the tutor dashboard shows
`kept —` for everyone — and, more urgently, the per-question **predictions have never reached the
sheet at all** (§3, bug 2). That is not a new regression; it is a fix that landed in the wrong file
months ago and has been silently dropped ever since. The redeploy is what finally lands it.

## A note on the storage namespace (16 Jul 2026)

Every key was prefixed `wayne_` — a legacy namespace inherited from the directory this app was first
built in, and never a name that belonged in the app. This is the shared SAT R&W Mastery app and the
prefix was nobody's, so it is now `satrw_`, pairing with the sister app's `psat89_`.

**Gate names are the app's only identities, and they are not real names.** `gate.js` maps a password
to a display name, that name lands in `sessionStorage.mastery_user`, and every lookup keys off it —
plan, ledger, history, retention, challenge set. This repo is public, so a gate name is deliberately
not the student's own. Do not add a real name to this repository to "clarify" one; the mapping lives
in the tutor's notes, outside version control.

**The rename is not the risky part; the data is.** The old keys are in the students' browsers,
holding their ledger, history, retention and notes. `ns-migrate.js` copies `wayne_*` → `satrw_*` once,
first, on every page that reads storage — before `progress.js`/`storage.js`/`config.js` read anything,
because they read at load time. It is generic rather than a list (a list is a thing you forget to
update, and the key you forget is someone's work), idempotent, never clobbers a newer value, and
leaves the originals in place as the undo. `ns-migrate.test.js` holds all of it, including that every
storage page loads it **first**.

## What this leaves for the tutor to notice

Retention starts at `—` and stays there for days: it can only count questions the ladder brings
*back*, so it earns its first data point one rung after a question is first answered. **An empty
retention figure is not a bug and not a zero.** It is the honest state of "we do not know yet", which
is the state the app was silently asserting an answer to before this.

Calibration is quieter still. It does nothing until a skill has 8 attempts, and nothing at all on a
day that pins one difficulty — which, today, is nearly every day in `assignments.js`. **To actually
use it, author a day with a range** (`diffs:["Medium","Hard"]`) and let the student's record pick the
end.
