# Working on this app

A no-build static site. Open the HTML, edit it, reload. No bundler, no package.json.

Known gaps and the backend question — auth, the sheet secret, per-student plan isolation, and why
none of it substitutes for reviewing the work with the student — are in [BACKLOG.md](BACKLOG.md).
Read it before proposing an architecture.

**Sister app:** `PSAT 8-9/app` (PSAT 8/9 R&W). It runs the **same homework engine from separate
files**. There is no shared module — a fix to `homework-run.html` here is *not* a fix there.
**Change one, change both, and run both test suites.**

## Run the tests before you claim anything works

```
npm install jsdom --prefix /tmp/j
NODE_PATH=/tmp/j/node_modules node homework/homework-run.test.js   # the learning loop
NODE_PATH=/tmp/j/node_modules node homework/assignments.test.js    # the plans are sane
NODE_PATH=/tmp/j/node_modules node homework/bank.test.js           # the bank is classified right
NODE_PATH=/tmp/j/node_modules node challenge/*.test.js             # the challenge feature
```

They skip cleanly without jsdom. Every one of them exists because something was silently
broken and nothing failed. Read a test's header before you change what it guards.

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
named minor. `PLAN-NOTES.md` is ignored for exactly that reason. If you ever need those notes
shared or backed up, put them in a **private** repo — never this one.

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

## The homework runner is a learning loop, not a quiz

Guarded by `homework/homework-run.test.js`. Do not remove these without a reason better than
"it's simpler":

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

## Writing a week of homework

Judgement, not code — but it is what the plans encode, and it is easy to lose:

- **Short sets she finishes beat long sets she abandons.** A student who opened three 8-question
  sets late and answered one question learned nothing. Six 6-question sets, one a day.
- **Only assign skills whose strategy has been taught in class.** Assigning a known weak spot
  cold, with no strategy to meet it, is the fastest way to lose a student.
- **Pace is a ladder.** Untimed → ~90s → ~80s → the real thing (SAT R&W is ~71s/question).

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

## A note on this codebase

`const questionBank_* = [...]` in `data-*.js` is a global *lexical* binding — a classic script
can see it, but it is **not** a property of `window`. Tests must inject a probe script to reach
it. `prioritizePool` and `recordAnswer` are function declarations, so they *are* on `window`,
which is how tests stub them. `challenge/challenge-ui.test.js` explains this too.
