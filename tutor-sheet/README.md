# Tutor sheet sync — Apps Scripts

Two Google Apps Scripts that receive completed sessions from the student apps
and log them for the tutor. One per subject, one spreadsheet each.

| File | Spreadsheet | Client that posts to it |
|---|---|---|
| [rw-apps-script.md](rw-apps-script.md) | SAT R&W tutor sheet | `sheet-sync.js` and `homework-run.html` in this app |
| [math-apps-script.md](math-apps-script.md) | Edutrack Math tutor sheet | `shared/session.js` in Michael SAT |

## Why they were rewritten

Both apps were **collecting rich per-question data and both scripts were throwing it away.** Every session posts, for each question, which answer the student chose, how long they took, and which named trap they fell for. Neither sheet had a column for any of it. The R&W sheet also dropped the tab-switch count that `anti-cheat.js` works to collect — the very field the app's own evaluation calls the highest-value change available.

The rewrite adds a **Questions** tab to each sheet (one row per question, joined on Session ID) and fixes four defects along the way. The per-script markdown explains each in detail; the short version:

- **R&W `setupHeaders()` wiped the sheet** — it called `sheet.clear()` under a "safe to re-run" comment. Fixed.
- **The Math dashboard silently read the wrong column** on any sheet migrated from an older layout. Now reads by header name.
- **Both could duplicate rows** — Apps Script's redirect defeats the clients' delivery checks, and Math actively retries. Both are now idempotent on Session ID.
- **Math stored duration in rounded minutes**, logging a 40-second session as `1`. Now seconds.

## Both sheets now share one schema

The first 16 columns are identical across subjects, so one student's week reads across both:

```
Timestamp · Student · Subject · App · Type · Assignment ID · Assignment ·
Score · Max · Percent · Duration (sec) · Avg/Q (sec) · Mode ·
Focus Losses · Session ID · Breakdown
```

Subject-specific columns follow on the right (R&W adds `Skills`, `Difficulties`, `Retention`; Math adds `Variant`, `Smart Mode`, `Exam Mode`, `Topic`, `Missed`, `Ungraded`).

> ## ⚠️ The R&W sheet is due a redeploy (16 Jul 2026)
>
> Two things only reach the sheet once you redeploy R&W from `rw-apps-script.md`:
>
> - **The per-question predictions.** These have **never** arrived. `homework-run.html` was fixed
>   long ago to post them, and `rw-apps-script.gs` was updated to read them — but the `.gs` is not
>   what you paste, the `.md` is, and the `.md` never got the change. The `Prediction`, `On text`
>   and `On options` columns have been silently dropped server-side ever since. (The `.gs` copies
>   are now deleted so this cannot happen again — the `.md` is the only source.)
> - **`Retention`** — the new durable-learning column: per-skill `{correct,total}` over the
>   questions the review ladder brought *back* after a delay. It is what lets the tutor dashboard
>   answer "is it staying learned?" rather than only "did they get it right on the day".
>
> Follow **Deploy** below. `ensureHeaders_` only appends headers to the right and never clears a
> cell, so your existing sheet and all its history are safe.

## Deploy (each sheet, once)

1. Open the spreadsheet → **Extensions → Apps Script**.
2. Delete what's there, paste the `javascript` block from the matching `.md`.
3. **Set the tab name at the top** — `SESSIONS_TAB` — to your existing log tab (likely `Sheet1`) so new rows keep landing beside the old ones.
4. Run **`setup`** (R&W) or **`setupAll`** (Math) once. Grant permissions. This is additive — it never clears a cell.
5. **Deploy → Manage deployments →** edit the existing web app → **New version → Deploy.** Keep the same URL so the clients need no change.

The client URLs are already wired: `SHEET_SYNC_ENDPOINT` in `sheet-sync.js`, `SYNC_URL` in Michael SAT's `shared/session.js`. Redeploying to the same deployment keeps them valid.

## Verify it works

Finish one session in each app, then check the sheet: a row in **Sessions** and, for R&W, one row per question in **Questions** carrying the trap names. Re-submitting the same session must **not** add a second row — that's the idempotency working.

## What the data now answers

The point of the Questions tab. In the sheet:

```
=QUERY(Questions!A:M,
  "SELECT G, M, COUNT(F), AVG(L)
   WHERE B = 'Jeffrey' AND K = FALSE AND M <> ''
   GROUP BY G, M ORDER BY COUNT(F) DESC
   LABEL G 'Skill', M 'Trap', COUNT(F) 'Times wrong', AVG(L) 'Avg secs'", 1)
```

— the traps Jeffrey repeatedly falls for, and how long he deliberates before falling for each. The Math **Student Detail** tab runs this automatically once the Math client sends `secs`/`trap` (a two-field change noted in `math-apps-script.md`).

## Tests

These scripts can't run outside Google, so the harness extracts the code **from the markdown** and replays payloads **captured from the running apps** through a stubbed `SpreadsheetApp`.

```bash
# once, anywhere:
npm install jsdom --prefix /tmp/j

# capture real payloads from both apps (writes fixtures.json):
NODE_PATH=/tmp/j/node_modules node tutor-sheet/capture-fixtures.js

# run the harness (no jsdom needed — reads the fixtures):
node tutor-sheet/apps-script.test.js
```

88 assertions: schema parity, per-question capture, idempotent re-POST, the two
different R&W payload shapes, v1→v2 migration keeping old values in place,
`setup()` never destroying data, and the Math dashboard reading the right
columns on a legacy sheet. Because the code is pulled from the `.md`, what you
paste into Apps Script is exactly what the tests ran against.
