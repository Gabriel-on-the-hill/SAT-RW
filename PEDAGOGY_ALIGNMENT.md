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
- `progress.js` — a sibling store, `wayne_retention_<user>`, shape `{ [skill]: { correct, total } }`.
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

## 3 · Retention on the tutor dashboard — `AN-4` · **needs an Apps Script redeploy; not built**

This backlog said to surface retention on `tutor-dashboard.html`. **That was written on a wrong
assumption and the item moved.** The dashboard does not load `progress.js` and never has: it reads a
published Google Sheet CSV, and the retention counter lives in the student's `localStorage`, on the
student's device. A retention readout added there would render `—` forever, or — worse — quietly show
whoever's browser the tutor happened to open it in. So it went on `progress.html` instead, which does
load the ledger and is the screen the student's `LEDGER.md` already sends the tutor to.

**That is the right surface for reviewing work with a student. It is not enough for the monthly
report**, which is written away from the student's device and is exactly where an unbacked retention
claim would do the most damage.

To close it properly, in one commit, all three of:
1. `homework-run.html` `postLog()` — add `review: !!_isReviewQ[r.id]` to each row of `questions`.
2. `tutor-sheet/rw-apps-script.gs` — add `'Review'` to `QUESTION_COLUMNS` and read `q.review` in
   `appendQuestions_`. `ensureHeaders_` adds new headers on the right and never clears a cell, so
   this is safe on the live sheet — **but the tutor must redeploy the Web App**, which is why this is
   not shipped: half of it (posting a field nothing reads) is precisely the bug the comment above
   `postLog()` exists to warn about, and it would fail silently.
3. `tutor-dashboard.html` — aggregate retention per student from the Questions tab.

Until then the honest answer to "is it staying learned?" is on the student's own progress screen.

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

Items 1 and 2 are shipped and green in both sister apps, and acquisition and retention now sit side
by side on `progress.html`, so "is it staying learned?" is answerable at a glance with the student in
front of you.

**What remains is §3** — carrying that same pair to the tutor dashboard, so the claim in a monthly
report is backed by a number the tutor can see without the student's device. It needs an Apps Script
redeploy and is therefore a decision, not a task an assistant should take alone.

At that point every handbook category above is ● except mastery-gating, which is ◐ **by choice**,
documented in §4.

## What this leaves for the tutor to notice

Retention starts at `—` and stays there for days: it can only count questions the ladder brings
*back*, so it earns its first data point one rung after a question is first answered. **An empty
retention figure is not a bug and not a zero.** It is the honest state of "we do not know yet", which
is the state the app was silently asserting an answer to before this.

Calibration is quieter still. It does nothing until a skill has 8 attempts, and nothing at all on a
day that pins one difficulty — which, today, is nearly every day in `assignments.js`. **To actually
use it, author a day with a range** (`diffs:["Medium","Hard"]`) and let the student's record pick the
end.
