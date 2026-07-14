# Backlog — integrity, auth, and the backend question

Open engineering work, in the order I'd do it. Nothing here is urgent; all of it is known.

**This file is committed to a public repo.** Keep it about the *system*. Notes about a student go
in `homework/PLAN-NOTES.md`, which is `.gitignore`d. See AGENTS.md.

---

## The thing to understand before doing any of it

`data-*.js` ships **every question and its answer** to the browser. Any student who opens
DevTools can read the key. No backend that still serves the bank client-side changes that —
including every option below.

Fixing it properly means serving one question at a time and grading server-side. That is a
rewrite, and for a handful of students it is not worth it.

**So none of this is a substitute for the review.** The control that actually works is going
through the work together and asking the student to explain how they got there. Reasoning cannot
be faked, and a score always can. Build these because they make the *data* more honest, not
because they make the app secure.

---

## Done

- **The read-gate.** `commit()` in `homework-run.html` now locks the choices until the student has
  been on the text long enough to have plausibly read it (`minReadSecs()`: passage length at
  ~360 wpm, floor 8s, cap 45s; never under a clock; redos exempt). Previously the predict box
  accepted any **three characters**, so `abc` cleared it — which is how a ten-question set came
  back in four seconds. Length was the wrong gate: a correct prediction is often a single word
  ("semicolon", "contrast"), so a stricter length check punishes the students doing it right.
  Time doesn't have that problem. Guarded by `homework/homework-run.test.js` §1 and §2.
  **Applied to the sister app too** (`PSAT 8-9/app`) — same engine, separate files.

---

- **The predict prompt is now per skill.** The app asked one question for all eleven —
  *"In your own words, what should the answer say?"* — which is unanswerable for **Boundaries**
  (all four choices are the same words, differing only in punctuation) and a trap for
  **Rhetorical Synthesis** (the answer is a sentence built from notes; no one can predict its
  phrasing). `PREDICT_PROMPTS` in `homework-run.html` now asks for the right object per skill: a
  verdict for Boundaries, a goal for Synthesis, a relationship for Transitions, a word for Words
  in Context. The prediction is still never graded — the app cannot judge free text and must not
  try. Its job is to make the student COMMIT before the choices anchor them.

- **The homework logger reached the sheet.** `postLog()` posted its per-question array under
  `detail`, with its own field names; the Apps Script reads `body.questions` with sheet-sync.js's
  names. Wrong key, so the array was dropped server-side and **not one homework question row was
  ever written** — the score still arrived, so the sheet looked fine, while every homework row
  came back with its per-question columns blank. Predictions, time-on-text and time-on-options
  now land in the Questions tab. Pinned by `homework-run.test.js` §10, which asserts the wire
  contract; **rename a field there and you must rename it in the Apps Script in the same commit.**
  ⚠ Requires **redeploying the Apps Script** — new `Prediction`, `On text`, `On options` columns.

---

## Next, cheapest first

### 1. Passwords that aren't the student's own name

`gate.js` SHA-256s the password **client-side** and ships the accepted hashes in the file. The
passwords are the students' first names — `segun` unlocks Segun. This is an affordance, not
auth: anyone can read the source, and anyone can guess it.

Give each student a real password. It costs one line each and it is still client-side — but it
stops the trivial case of a student opening another student's plan out of curiosity.

### 2. Give the PSAT backend a Questions tab

**The two apps have two different Apps Scripts, and only the SAT one is structured.**

- SAT → `tutor-sheet/rw-apps-script.gs` (endpoint `AKfycbzR0…`): Sessions **and** Questions tabs,
  `QUESTION_COLUMNS`, reads `b.questions`. This is the one the `detail`/`questions` bug hit, and
  the one that needed redeploying.
- PSAT → `PSAT 8-9/Tutor Backend (Apps Script).gs` (endpoint `AKfycbww5…`): 92 lines, **one row
  per session**, and it `JSON.stringify`s the whole payload into a `Raw payload` column. It never
  read `detail` *or* `questions`, so it never dropped anything and the rename passed straight
  through — no redeploy was needed.

Consequence: **PSAT predictions and time-on-text are captured but unreadable**, buried in a JSON
blob in a spreadsheet cell. Fine while PSAT homework isn't reviewed line by line; a real gap the
moment it is. The fix is to port `appendQuestions_()` and `QUESTION_COLUMNS` across — not a
redeploy, a small piece of work.

### 3. Set `SHARED_SECRET` on the Apps Script

`SHEET_SYNC_SECRET` in `sheet-sync.js` is `''`, and the Apps Script only checks the secret if one
is set. So anyone who finds the endpoint can POST rows into the tutor's Sheet.

Set it on both sides. **Honest limit:** the secret ships in client JS, so it stops noise and
outsiders, not a determined student. It is worth doing anyway — it is five minutes.

---

## The backend question

**Do we need one? Mostly no.** The reason to want one was per-student privacy — `assignments.js`
is loaded by the hub, the runner and the progress page, so every student's browser downloads
*every* student's plan. But the plan data is "Boundaries, Medium, 6 questions." That is not
sensitive. The genuinely sensitive material — tutor assessment of a student — is now out of the
served file entirely, which cost a file move rather than an architecture.

Build a backend for **integrity**, if at all. Not for privacy.

### Option A — extend the Apps Script you already own · **already built in the sister app**

`hwLoadPlan()` already supports `HW_USE_SHEET = true`: it fetches a plan by student over JSONP and
falls back to the local file. The SAT script's `doGet()` doesn't implement it — **but the PSAT
one does.** `PSAT 8-9/Tutor Backend (Apps Script).gs` already serves `action=plan&student=…` from
a "Plans" tab, with a JSONP callback. So this option is not hypothetical; it is running, and it
can be ported rather than designed.

To finish it for SAT: port that `doGet`, add a per-student **token** (the PSAT version keys on the
student *name*, so anyone can request anyone's plan), and flip `HW_USE_SHEET`.
**Zero new infrastructure, stays no-build, you already own the Sheet.** Downside: Apps Script is
slow (~1s+) and quota-limited, and JSONP means the token rides in a URL.

Right choice if you want per-student isolation without leaving Google.

### Option B — Cloudflare Worker + KV

Free tier, fast, roughly sixty lines. Serves per-student plans behind a token, receives the
session logs, and holds the sync secret **server-side** where it actually means something. Can
rate-limit. The frontend stays a static site on Pages with no build step.

Right choice if the app grows past a handful of students, or if you ever want a log you can trust.

### Option C — Supabase / Firebase

Real auth, real per-user rows. **Skip it.** It drags in an SDK and a build step, and it would cost
the property that makes this app maintainable by one person: open the HTML, edit it, reload.

---

## Also worth knowing

- **This repo is public and serves GitHub Pages.** Anything committed is world-readable at a
  stable URL and indexed. Two early commits contain tutor comments assessing named students; the
  current files are clean, but history is not. If that ever matters, the repo is small enough that
  a history rewrite is cheap — or make it private (Pages from a private repo needs a paid plan).
- **The engine is duplicated.** `homework-run.html` here and in `PSAT 8-9/app` are separate files
  running the same loop. Every fix must be applied twice and both suites run. A shared module
  would end this, and is probably the highest-value refactor in the codebase.
