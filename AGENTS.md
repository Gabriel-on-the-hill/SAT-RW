# Working on this app

A no-build static site. Open the HTML, edit it, reload. No bundler, no package.json.

Known gaps and the backend question — auth, the sheet secret, per-student plan isolation, and why
none of it substitutes for reviewing the work with the student — are in [BACKLOG.md](BACKLOG.md).
Read it before proposing an architecture.

**Sister app:** `PSAT 8-9/app` (PSAT 8/9 R&W). It runs the **same homework engine from separate
files**. There is no shared module — a fix to `homework-run.html` here is *not* a fix there.
**Change one, change both, and run both test suites.**

**Adding questions to the bank from the source textbooks?** Read
[tools/EXTRACTION-GUIDE.md](tools/EXTRACTION-GUIDE.md) first, all of it. The three PDFs in this
folder are *scans* whose OCR silently drops characters and whose A/B/C/D letters are unrecoverable
from the text layer — an extraction built on the obvious assumptions produces questions with no
correct answer, and nothing in the app will tell you. Stages 1 and 2 are already done:
`python tools/inventory_books.py` regenerates `_extract/INVENTORY.md` (the page manifest) and
`python tools/segment_pages.py` regenerates `_extract/SEGMENTS.md` (the questions, with a review
queue and a 300 dpi crop each). **Stage 3 works from SEGMENTS.md, not INVENTORY.md** — the guide's
§13 says why.

## Run the tests before you claim anything works

**This is the whole list. If a suite is not on it, it does not get run — and a suite nobody
runs goes red and stays red.** `tutor-sheet/apps-script.test.js` was missing from this list and
sat failing for months while the fixture it guards drifted out of date; the bug it was there to
catch (the per-question predictions being dropped server-side) was live that entire time.

```
npm install jsdom --prefix /tmp/j
NODE_PATH=/tmp/j/node_modules node homework/homework-run.test.js   # the learning loop
NODE_PATH=/tmp/j/node_modules node homework/review-ladder.test.js  # spacing, retention, calibration
NODE_PATH=/tmp/j/node_modules node homework/assignments.test.js    # the plans are sane
NODE_PATH=/tmp/j/node_modules node homework/bank.test.js           # the bank is classified right
NODE_PATH=/tmp/j/node_modules node challenge/*.test.js             # the challenge feature
NODE_PATH=/tmp/j/node_modules node ns-migrate.test.js              # nobody loses their work
NODE_PATH=/tmp/j/node_modules node ratio-mix.test.js               # custom practice in a ratio
NODE_PATH=/tmp/j/node_modules node session-responses.test.js       # the answer model
NODE_PATH=/tmp/j/node_modules node session-nav.e2e.test.js         # ... wired to the real page
NODE_PATH=/tmp/j/node_modules node homework/homework-nav.test.js   # moving around a homework set
NODE_PATH=/tmp/j/node_modules node gate.test.js                    # no student opens a tutor page
NODE_PATH=/tmp/j/node_modules node baseline.test.js                # forms, bands, routing, weights
NODE_PATH=/tmp/j/node_modules node baseline-store.test.js          # the record survives the page
NODE_PATH=/tmp/j/node_modules node baseline.e2e.test.js            # the screener, driven for real
NODE_PATH=/tmp/j/node_modules node baseline-sync.test.js           # the tutor actually receives it
NODE_PATH=/tmp/j/node_modules node baseline-recover.test.js        # a stranded baseline can be sent
node tutor-sheet/apps-script.test.js                               # the sheet + dashboard join
node cache-tags.test.js                                            # students get the CURRENT files
```

`homework-run.test.js` takes several minutes — it stands up a fresh jsdom per case and each one
parses the whole question bank. Node buffers to a pipe, so it prints nothing until it finishes.
It is slow, not hung.

**Put jsdom on a local disk, and run the slow suites from one.** `--prefix /tmp/j` above is not
decoration. jsdom is thousands of small files and `data-*.js` is about a megabyte; loading either
across a synced or mounted folder turns a three-second suite into a three-minute one —
`baseline.e2e.test.js` measured 2m33s of wall time for 7s of CPU that way, and about three seconds
from `/tmp`. Combined with the buffering above, a suite in that state looks hung rather than slow,
and a suite that looks broken stops being run. That is not hypothetical either: the sister app
wrote five baseline suites, left them off its list, and two of them were red for three weeks.

They skip cleanly without jsdom (`apps-script.test.js` needs no jsdom at all). Every one of them
exists because something was silently broken and nothing failed. Read a test's header before you
change what it guards.

## Assigning homework

**Edit `homework/assignments.js`. That is the only file.** The runner, the hub and the
progress engine are generic and read the plan from there. A brand-new student also needs a
one-time password entry in `gate.js`, but that is setup, not assignment.

### The student can read assignments.js. Write it accordingly.

`homework-hub.html`, `homework-run.html` and `progress.html` all `<script src>` it, so the
student's browser downloads the entire file — **comments included, and every student's plan,
not just their own.**

So it holds no assessment of anyone: not what they failed to do, not what they cannot yet do,
not what we think is really going on. "He does not do the work" is a true and useful sentence,
and it does not belong in a file we hand him. **That reasoning goes in `homework/PLAN-NOTES.md`,
which nothing loads and which is `.gitignore`d.** Comments in `assignments.js` are for the next
editor and stay impersonal — shapes, pools, guardrails.

**And this repo is PUBLIC, with GitHub Pages on.** Committing a note about a student does not
just show it to that student, it publishes it to the internet at a stable URL, indexed, about a
named minor — the students on this app are school-age, and the sister app's are younger still.
`PLAN-NOTES.md` is ignored for exactly that reason. If you ever need those notes shared or backed
up, put them in a **private** repo — never this one.

### The gate names are the only names this repo gets

`gate.js` maps a password to a display name; that name lands in `sessionStorage.mastery_user`, and
every lookup in the app keys off it — plan, ledger, history, retention, challenge set. **Key a plan
by the gate name and nothing else.** Any other key fails silently: no error, no warning, just
*"No homework is assigned for X yet."* and you find out in class.

**Some gate names are a student's real first name. At least one is deliberately not.** Do not assume
which is which, and never "tidy" a gate name into a real one — for that student, the gate name is
the only thing standing between a public, indexed, permanent URL and their identity.

So the rule is: **the gate names are the complete list of personal names this repo may contain.**
Do not add another — not in code, a comment, a doc, a test fixture, or **a commit message**, which is
as public as the code and cannot be taken back. Everything else about a student goes in the tutors'
notes, outside version control.

And **never explain a name.** Do not write down which login belongs to whom, do not say where a name
came from, and do not enumerate who the *other* names are while discussing one — a mapping spelled
out in prose is still a mapping, and subtracting the named from a known list is how the unnamed one
gets identified. This applies to legacy identifiers you are cleaning up too: say what the string
*is*, never who it was.

**Parts of this history predate this rule and do not follow it. They are not precedent.** If you find
a name in an old commit, the fix is to stop repeating it — not to work out what it meant, and not to
add a note pointing at it, which only republishes the thing it warns about.

The student sees exactly three strings: `title`, `day.focus`, `day.tip`. Write them as
instruction **to** him, never as assessment **of** him. "Rhetorical synthesis (notes open)" —
not "the set you owe".

### A day naming more than one skill MUST use `sections`

This is the rule that bites hardest, because breaking it fails *silently*.

A plain `skills/diffs/count` day builds ONE pool and takes the top N. The pool is ordered, so
the draw clusters. A real 7-question "mixed dress rehearsal" was serving **7 questions of a
single skill**. It looked completely fine in the file.

```js
// WRONG — silently collapses to mostly one skill
{ n:6, skills:["Words in Context","Inferences","Transitions"], diffs:["Hard"], count:6 }

// RIGHT — an exact count per skill
{ n:6, sections:[
    { skills:["Words in Context"], diffs:["Hard"], count:2 },
    { skills:["Inferences"],       diffs:["Hard"], count:2 },
    { skills:["Transitions"],      diffs:["Hard"], count:2 },
  ] }
```

`assignments.test.js` fails if you forget. It also checks the pool actually holds enough
questions for the count, and that the skill names resolve (they use an em dash — `Command of
Evidence — Textual` — not a hyphen).

### Misses come back, but only from a matching pool

`prioritizePool()` draws questions the student has missed first. But it only draws from a pool
matching the set's skill **and** difficulty. So a Medium miss will never reappear in a
Hard-only set. If you want this week's misses to come back before the next class, the later
days must keep Medium in scope alongside Hard.

### `review: N` — the one draw that crosses the filter

Every day also serves up to **2 review questions by default**, drawn by `dueForReview()` in
`progress.js` from the **whole bank**, and mixed into the set at random positions. Set
`review: 0` on a day whose job is to teach one brand-new skill and needs the full dose on it.
Set `review: 4` to lean harder on maintenance.

This exists because reordering a pool **cannot** bring back a question the day's filter already
removed — which is the limitation above, and it is structural. A due Text Structure question
cannot appear in a Words-in-Context pool at any sort order. Review has to be drawn against the
whole bank or it does not happen.

It is self-limiting. It only returns questions the student has **already attempted** and that the
review ladder says are genuinely **overdue**, so early in a plan it adds nothing and the set is
exactly as authored. It never serves an unseen question — a "review" block that hands a student an
untaught skill cold is not review.

**The ladder** (`progress.js`): a correct answer does not finish a question, it *schedules* it.
1 day → 3 days → 1 week → 3 weeks → 6 weeks, climbing one rung per consecutive correct. A miss
drops it to the bottom. `homework/review-ladder.test.js` guards it, and its header explains the bug
it exists to prevent: for months, a question the student had *learned* was demoted into a tier that
sat behind `unseen`, and with hundreds of questions in the bank and 6 to a set, **it was never
drawn again.** Nothing taught in April came back in May. Not because anyone decided that — because
a tier was in the wrong place and no test looked.

## The homework runner is a learning loop, not a quiz

Guarded by `homework/homework-run.test.js`. Do not remove these without a reason better than
"it's simpler":

**These are not UI preferences. They are the house pedagogy, and the house rules are in the root
[AGENTS.md](../../AGENTS.md).** Each rule below has a name and a body of evidence behind it — the
prediction gate is retrieval practice (`PS-4`), untimed-before-timed is `AS-5`, `sections` is
interleaving (`MR-4`), misses coming back is spaced retrieval (`MR-1`). Look one up in
[Pedagogical-Design-Handbook.md](../../Pedagogical-Design-Handbook.md) before you decide it is
overhead. Every one of them makes the app feel *harder* than the obvious alternative. That is the
mechanism, not a bug in it.

- **The options stay hidden until the student commits a prediction.** This is the technique
  every student here is taught, and homework is the one place they can silently skip it.
- **Untimed → she TYPES the prediction. Timed → one click.** Never make her type under a
  clock: she cannot type on test day, and it corrupts the timing measurement. New skill →
  untimed. Known skill → clock. Set `minutes: 0` for untimed.
- **Time-on-text is recorded separately from time-on-options.** A Hard passage committed in
  four seconds means she did not read it. That is the signal; do not average it away.
- **Every question survives the set** — passage, her answer, the right answer, the explanation
  — re-readable, misses first, reopenable tomorrow from the hub.
- **A redo never rewrites the first attempt.** What she did under the clock is the honest
  record. The redo only adds "put right on the redo".
- **Running out of time must not destroy the set.** Submit what she has; show the review.

## A student can move around a set

Guarded by `session-responses.test.js` (the model), `session-nav.e2e.test.js` (the practice and
mock-exam session, driven for real) and `homework/homework-nav.test.js` (the homework runner).

For a long time the only way to reach question 2 was to answer question 1: `nextBtn` lived inside
`#feedbackContainer`, which is `display:none` until an answer exists, so the control that moves you
forward did not exist until you had committed. No Back, no Skip, and `handleOptionClick` opened with
`if (isAnswered) return`, so a misclick was permanent.

**This needed a data model, not buttons.** Answers lived in two places that could not represent a
changed mind — an append-only `sessionResults` pushed on click, and a one-shot `isAnswered` latch.
Bolting navigation onto that would have been worse than leaving it alone: every revision appends a
second row and writes `recordAnswer` a second time, so one question answered twice counts twice, and
a student who *corrects* a wrong answer still carries the wrong one in their mastery record.

`session-responses.js` holds one revisable slot per question instead —
`{ chosen, flagged, secs, committed }` — and enforces three rules:

1. **A blank is not a wrong answer.** Skipping writes nothing to the ledger. "Did not attempt" is
   not evidence about a skill, and recording it as a miss would send the review ladder off to
   re-teach something that was never tested.
2. **The ledger is written once per question per session.** `commitOne` is idempotent, because the
   review screen, the timer expiring and the Submit button can all reach it for the same question.
3. **Time accumulates across visits.** A question read twice was worked twice.

### Navigation follows the clock, in both runners

- **Timed / exam** — Back and Next throughout, answers revisable, Mark for review, and an
  end-of-module check showing every question as answered/blank/flagged before submitting. This
  **forces feedback to the end**, and that is the point rather than a side effect: going back to
  change an answer is meaningless once you have been shown the right one. It costs nothing, because
  the review screen has always shown every question with its explanation — it just stops the set
  answering itself as the student goes.
- **Untimed / practice** — instant feedback stays, because there is no test to rehearse and the
  explanation is the whole exercise. It gains a **Skip**, so no question forces a guess, and a
  **Submit** step, so a misclick is survivable. Once graded it stays graded: going back is a
  re-read, not a second attempt.

`sessionResults` is rebuilt in **question order** at finalise, blanks included — click order stopped
meaning anything the moment question 9 could be answered before question 3. Blanks land in
`missedQuestions` too, so Review Missed re-serves them.

**A redo resets the navigation state.** A redo is a different, shorter set; carrying `nav[]` across
meant question 1 of the redo inherited "prediction already made" from question 1 of the original and
skipped the predict step, which is the one part of a redo that matters.

## Tutor pages are tutor-only

`gate.js` reads `window.GATE_REQUIRE`, declared **before** it loads:

```html
<script>window.GATE_REQUIRE = 'tutor';</script>
<script src="gate.js?v=…"></script>
```

Student pages accept students and the tutor; a `'tutor'` page accepts only the tutor passphrase, and
**re-prompts a session that is unlocked as a student** — `mastery_unlocked` on its own only ever
meant "somebody typed a valid password", which is how a student who had opened the app walked
straight into `tutor-dashboard.html` and a page listing every student's accuracy, retention, weakest
skills and tab-switch counts. That is an assessment, and a student never reads one, about themselves
or anyone else.

**This is a deterrent, not security.** Public repo, static site: every hash in `gate.js` is readable.
The student passwords are their own first names, so the tutor password is a random passphrase
instead — its entropy is the only thing standing behind a public hash. `gate.test.js` holds the line,
including that no student password opens the dashboard and that the tutor password is not a name or
a common word.

**The header does not list the passwords, and must not start.** A comment spelling out every live
login is a published mapping. `gate.test.js` derives the roster from the labels already in the file
and asserts the header stays quiet.

## The baseline screener

`baseline.html`, plus `baseline-spec.js` (form construction), `baseline-grade.js` (routing, bands,
projection, skill weights) and `baseline-store.js` (the durable record). Five suites, all on the
list above. `baseline-recover.html` re-sends a sitting that reached a browser but never reached
the sheet.

22 questions, two per skill, all Medium, ~26 minutes. Then an optional per-skill follow-up: a skill
that scored 2/2 gets one **Hard** ceiling probe, one that scored 0/2 gets one **Easy** floor probe,
and 1/2 gets nothing because *Developing* is already the honest answer. Five bands out the other
end, ranked into a plan by severity × skill weight.

### It reports a BAND, not a percentage, and that is the design

Two items cannot support a percentage. With four options chance alone earns a quarter of them, and
a two-item skill can only score 0, 50 or 100 — so "Inferences 50%" invites a tutor to act on a coin
flip, and two students of identical ability get two different study plans. The measurement base is
therefore fixed (the same two Medium items for everyone) and the probe moves a student one rung up
or down from it. Uniform base, ordinal ladder, no denominator drift.

`Priority` vs `Foundational` is the pair that earns its keep: more drilling is right for one and
wrong for the other. If two bands would lead to the same lesson they should be one band.

### Two forms, and that is the bank talking

Three forms at two per skill needs six Medium items in every skill. **Command of Evidence —
Quantitative has five.** That is the real count — only one Textual stem reads quantitative and it
genuinely is one, and all 28 chart-bearing items are already filed Quantitative — so the answer is
two forms, not three with an exception for one skill. An exception would mean Quantitative alone
repeated between sittings, and the retake comparison on that skill would silently be measuring
memory. `baselinePreflight()` fails the build if a form cannot be supplied, and warns when the bank
has grown enough to support another. `baseline.test.js` asserts the constraint is still real, so
two forms stays a decision rather than becoming inertia.

### The baseline does NOT write to the mastery ledger

Tagging the writes `'baseline'` looks careful and does nothing. A ledger row makes a question
*seen*; a miss lands on rung zero of the review ladder, due again in one day; and `dueForReview()`
draws from the whole bank filtered on nothing but "seen and overdue". A baseline is *designed* to
miss across all eleven skills, so writing it seeds the next morning's homework with review from
skills nobody has taught — which is the one thing the review block must never do (see `review: N`
above). Nothing is lost: the record already stores every item with the chosen letter, the correct
letter and the elapsed seconds, which is more than the ledger kept. Two assertions in
`baseline.e2e.test.js` hold it, one on the ledger and one on the real `dueForReview` draw.

### Order: spread WITHIN a domain, never across the set

`orderBaselineSAT` builds the real domain blocks from `RW_DOMAIN_ORDER`; `spreadBaseline` keeps a
skill's two items apart *inside* each domain. Do not spread across the whole set: the sister app
does, and its served order became C&S → I&I → EoI → SEC and then the same four again — the domain
blocking gone and the sequence one repeating eleven-item cycle, which is the most learnable order
there is. Its unit test asserted on `buildBaselineForm`'s output, which the page never serves.
**Test the array that reaches the student.** §ORDER of `baseline.test.js` does.

**And our domain order is not the sister app's.** It runs Expression of Ideas before Standard
English Conventions; the real SAT module does not. `baseline-spec.js` reads `RW_DOMAIN_ORDER` and a
test compares it against the copy in `app.js`, so the two cannot drift.

### The review carries the whole question

Passage, stem, every option with the chosen and the correct one marked, then the explanation, misses
first. The sister app printed the skill, two letters and a rationale about a text no longer on the
page — nothing a student can work through, and the baseline is the sitting most likely to be
reviewed with a tutor afterwards. Same rule as the runner, and it is a house rule, not a preference.

### What survives, and what reaches the tutor

`saveBaseline()` writes the instant the screener ends, before the optional probes, because the
probes may never happen. It stamps `sitting`, and the focus queue goes *into* the record as well as
into `satrw_focus_*` — a plan that lives only in the key reaches nobody. Records append; a retake
is a second data point, never a correction. A mid-sitting **draft** is saved every ten seconds
under `satrw_baseline_draft_*` and cleared on completion; it is scratch and must never be counted
as a sitting.

`baselineSheetPayload()` builds the sheet row from the **saved record**, not live page state, so a
row recovered months later is identical to the one that would have gone up at the time. It derives
a stable `sessionId` — the Questions tab joins on it and the script skips a repeat as a duplicate,
so a blank one strands every per-question row, and a shared one would make the completed sitting
vanish as a duplicate of the screener.

**The sheet needs a column or the block is dropped.** `sheet-sync.js` and the Apps Script both
build their payload key by key, so anything unnamed disappears with no error and a row that still
looks fine. `Baseline`, `Baseline Projection` and `Baseline Plan` are in `EXTRA_COLUMNS` in
`tutor-sheet/rw-apps-script.md`; changing what the client sends means changing the script and
redeploying it, and `apps-script.test.js` is the half that proves the sheet keeps what the client
posts.

**A client change that needs a column is not live until the script is redeployed.** The two halves
fail independently and neither can see the other: `baseline-sync.test.js` proves the page posts the
block, `apps-script.test.js` proves the sheet keeps it, and both are green while the deployed script
is still last month's. Redeploy in the same sitting as the change.

## Deploying the Apps Script

The markdown in `tutor-sheet/` is the source of truth and the only thing under test.
**Do not add a `.gs` copy to this repo.** There was one; nothing deployed it and nothing tested it,
so `Prediction` / `On text` / `On options` were added to *it* rather than to the tested file, and the
predictions the class reviews together went nowhere for months while the sheet looked fine.
`apps-script.test.js` still carries the note.

```
node tutor-sheet/extract-script.js > /tmp/rw.gs      # or: … math
```

That prints the exact block the test parses, and refuses if it is missing, truncated or unparseable.
Paste it over `Code.gs`, run `setup` once — it is strictly additive and never clears a cell — then
**Deploy → Manage deployments → edit the existing web app → New version**. Editing the existing
deployment matters: a new one gets a new `/exec` URL and `sheet-sync.js` quietly stops reaching it.

### The plan is for the tutor, not for the question selector

`getFocusQueue()` exists, and nothing in the draw reads it. That is deliberate: **assigning homework
means editing `homework/assignments.js` and nothing else**, and a screener that quietly re-pointed
the weak-area draw would break that rule with no error and no symptom. The queue goes to the sheet
and the dashboard; a human turns it into a week. Wiring it into `buildWeakAreaSet()` is a separate
decision with its own test, not a tidy-up.

### Known limits — say them, do not quietly fix them wrong

- **Two items per skill is triage, not certification.** Hence the `provisional` / `probed` /
  `resolved` / `low` / `not-measured` marker. Note `resolved` means "no further probe planned" —
  a 1/2 screener is the least informative outcome and it is the one that routes no probe. The
  sister app calls that state `confirmed`; do not copy the word back.
- **The 200–800 projection is uncalibrated,** anchored to the range rather than to score data.
  It is a 60-point band, and `baselineDelta()` refuses to call movement real unless two bands fail
  to overlap. Do not turn it into a point estimate.
- **A blank scores as wrong,** which is what the real test does — but the projection cannot tell a
  pacing failure from a knowledge gap, so it names the blank count in its caveat when there is one.
- **Everything is device-local** — the record, the form rotation, the growth delta. Sit it on one
  machine and retake on another and you get Form A twice. `baseline-recover.html` rescues the
  record; nothing rescues the rotation.

## Custom practice in a ratio

The setup screen can divide a sitting between skills in a proportion — "five Transitions, three
Boundaries, two Words in Context" is the ratio toggle plus shares of 3 / 2 / 1 and a limit of 10.
Ported from the Math app's Custom Practice (`shared/engine.js`, `_quota` / `_allocate`). Guarded by
`ratio-mix.test.js`.

**The toggle decides whether a ratio applies. Not whether the numbers differ.** The Math app infers
intent from whether the shares are unequal, and pays for it: 1-and-1 is how you would ask for an
even five-and-five split, and it is also exactly what an untouched screen looks like — so that
request is unaskable there, and fails silently as "whatever the queue had", which for two skills is
frequently ten of one and none of the other. Here the switch says it out loud. Do not replace it
with a heuristic.

With the toggle off, `buildActiveQuestions` returns precisely the slice it returned before any of
this existed. That is the property everything rests on: the default screen, every Quick Preset, the
weak-area drill and the homework runner never turn it on, so if the allocator ever started
constraining an un-toggled draw it would quietly change every set the app has ever built, with no
error and no symptom. §5 of `ratio-mix.test.js` is the tripwire, and it pins `Math.random` because
`prioritizePool` shuffles.

Three things the allocator must keep doing:

- **The difficulty split is PER SKILL, not across the set.** Apportion by skill, then apportion each
  skill's quota by difficulty. Treating the two as independent marginals is the obvious
  implementation and it is wrong in a way only the interior shows: on this bank, Cross-Text 1 :
  Transitions 1 crossed with Medium 1 : Hard 1 at a limit of 10 gave five of each skill and five of
  each difficulty — both sets of totals exactly right — with **four of the five Hard on one skill.**
  A tutor who sets both dimensions means "half of *each* skill hard", which is a claim about cells,
  and marginals prove nothing about cells. The cost is that per-skill rounding makes the overall
  difficulty totals drift off the stated ratio (1:3 over 12 lands 4/8, not 3/9). That is the right
  trade. §3b of `ratio-mix.test.js` holds it.
- **A quota the pool cannot fill bends; the set does not shrink.** Ask for five Hard Cross-Text when
  none exist and you still get a full-length sitting: the shortfall is spent on that skill's other
  difficulties first, because **the skill split is the stronger promise** — it is the one the tutor
  states first — and only then on raw queue order. A short session is indistinguishable, to the
  student, from having finished.
- **The ratio picks how MANY, the queue picks WHICH.** Every pass walks the already-prioritised
  pool in order and only filters, so inside a quota the weakest questions still come first.

**R&W orders the result in domain blocks, easy → hard — `orderSATStyle`, keyed to `RW_DOMAIN_ORDER`.
The Math app shuffles its custom set; do not copy that here.** SAT Math genuinely is presented
mixed and R&W is not: the real module runs Craft & Structure → Information & Ideas → Standard
English Conventions → Expression of Ideas. Shuffling would drill a question order the student never
meets. `buildMockExam` uses the same function, so the two cannot drift.

## Writing a week of homework

Judgement, not code — but it is what the plans encode, and it is easy to lose:

- **Short sets she finishes beat long sets she abandons.** A student who opened three 8-question
  sets late and answered one question learned nothing. Six 6-question sets, one a day.
- **Only assign skills whose strategy has been taught in class.** Assigning a known weak spot
  cold, with no strategy to meet it, is the fastest way to lose a student.
- **Pace is a ladder.** Untimed → ~90s → ~80s → the real thing (SAT R&W is ~71s/question).

### Sets unlock on completion, and the order is the teaching sequence

`unlock: "sequential"` is the default for new plans: set 1 is open, and each later set opens when
the one before it is **submitted**. `unlock: "cumulative"` (one per calendar day) is legacy — it
meant a student with a free Saturday could still only reach that day's set, while a student who
fell behind was met by a wall. Do not flip a plan that is already running; re-author it instead.

Because the student now meets the sets in exactly the authored order, every time, **order them so
that finishing one helps with the ones after it.** Name the chain in the plan's comment block:

- an **untimed** rep of a skill before the **timed** rep of that same skill;
- a **pace ladder** across sets (~90s before ~71s);
- a skill from an early set **returning inside a later mixed set**;
- the **most startable** set first — under sequential unlock, a stall on set 1 blocks the week.

If the sets genuinely do not relate, the order is a judgement call. Say so in the comment so the
next person knows it was a decision and not an oversight.

**A sequential plan MUST carry `through: "YYYY-MM-DD"`.** Sequential unlock stops enforcing
spacing — nothing prevents the whole week in one sitting, which is the one thing the design cannot
afford. The hub prints the window and asks the student to spread the sets out. That request is the
only spacing mechanism left, so it is not optional, and the student has to meet it *before* the
first set: a locked card with no explanation reads as a broken app.

`hwDayOpen()` in `homework/assignments.js` is the shared gate; the hub and the runner both call it,
so the order cannot be walked past with a bookmark. It deliberately **opens** a set when
`localStorage` cannot be read — broken storage must never lock a student out of their homework.

### Tips are plain text with newlines

The hub renders a tip with `innerHTML`; the runner sets it with `textContent`. HTML tags therefore
show up literally in the runner. **Newlines are the only formatting that works in both**, and both
`.tip` rules carry `white-space: pre-line` so they survive. Keep tips short and scannable — a wall
of prose gets skipped, and a skipped tip is a tip that was never written.

## The bank

`data-*.js` are generated by `../parse_new_banks.py` from the source PDFs. If you rebuild
them, run `homework/bank.test.js`.

**The source PDFs label evidence questions only "Command of Evidence" — never which kind.**
The parser has to infer it. It used to infer by counting digits in the extracted passage text,
which mis-filed every question whose data lives in a *chart*: a bar graph is an image and
contributes no digits. Eleven questions reading "which choice most effectively uses data from
the graph…" sat in the Textual bucket, and Quantitative was left with **3 Medium questions in a
719-question bank** — too thin to build a homework section from.

Classify by the **stem** (`_infer_coe_type`), and let `bank.test.js` hold the line. If a skill's
pool ever looks implausibly thin, that is a build bug, not a fact about the test.

## Shipping a change: bump the file's `?v=` tag in the same commit

There is no build step. The `?v=YYYYMMDD` on every `<script>` and `<link>` is the whole
cache-busting mechanism, and **the tag is the date that file last changed**. Edit a file
without bumping its tag and every browser holding the old copy keeps it — no error, no
symptom, the app simply runs last month's code for the students who use it most.

That had happened to eleven files at once, some nineteen days stale: `app.js` still on the
3 July build after the 22 July draw-order change, `data-info-ideas.js` missing the July
Information & Ideas questions, `homework/assignments.js` serving the previous week's plan.
The tutor was reading those results as if they came from the current app.

`cache-tags.test.js` fails on a stale tag and on a `?v=` pointing at a file that does not
exist. Run it before you claim a change is live.

## A note on this codebase

`const questionBank_* = [...]` in `data-*.js` is a global *lexical* binding — a classic script
can see it, but it is **not** a property of `window`. Tests must inject a probe script to reach
it. `prioritizePool` and `recordAnswer` are function declarations, so they *are* on `window`,
which is how tests stub them. `challenge/challenge-ui.test.js` explains this too.
