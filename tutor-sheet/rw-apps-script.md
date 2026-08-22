# SAT R&W — Tutor Sheet Apps Script (v2)

Paste the whole block below into the Apps Script editor bound to the **R&W** spreadsheet, then run `setup` once and redeploy the web app.

**Do not keep a `.gs` copy in this repo.** There was one once; nothing deployed it and nothing tested it, so when `Prediction` / `On text` / `On options` were added they were added *there* instead of here, and the predictions the class reviews together went nowhere for months while the sheet looked fine. `apps-script.test.js` parses the ```javascript block below, so this file is the only thing under test. When you need a paste-able file:

```
node tutor-sheet/extract-script.js > /tmp/rw.gs      # or: … math
```

It prints the same block the test reads, and refuses if that block is missing, truncated, or does not parse.

## v2.1 — the baseline needed somewhere to land

`EXTRA_COLUMNS` gains `Baseline Projection`, `Baseline Plan` and `Baseline`. This script builds every row **key by key**, so anything the client posts with no column here is dropped silently into a row that still looks fine — which is how a tutor would have opened the sheet after a baseline screener and found `Type: baseline · Score 14 · Max 22` with every band, the projected range and the ranked plan gone, and nothing anywhere saying so. `Baseline` is a JSON catch-all on purpose, so the next thing the client learns to send is not lost waiting on a redeploy. Blank on every non-baseline row, and **blank is not zero**: it means the session was not a baseline, not that the baseline found nothing.

Redeploy is required for this. `ensureHeaders_` adds the columns to the right of the existing schema on the next POST, so nothing is reordered and no existing row loses data.

## What changed, and why

**It captures what the app was already sending and the sheet was throwing away.**

| Field the app POSTs | v1 | v2 |
|---|:--:|:--:|
| `questions[]` — per-question `chosen`, `correct`, `secs`, **`trap`** | ❌ dropped | ✅ one row each in a **Questions** tab |
| `blurCount` — tab-switches during the session | ❌ dropped | ✅ `Focus Losses` |
| `assignmentId` (e.g. `p8-rw`) | ❌ merged away | ✅ its own column |
| `sessionId` | — (didn't exist) | ✅ idempotency key |

**Four defects fixed.**

1. `setupHeaders()` called `sheet.clear()` under a comment saying *"Safe to re-run."* It wiped every logged session. `setup()` is now strictly additive and never deletes a cell.
2. `getActiveSheet()` wrote to whichever tab happened to be selected. It now writes to a named tab, creating it if missing.
3. There was no `sessionId`, so a re-POST duplicated the row and nothing could be joined. Sessions are now **idempotent**: a Session ID already present is skipped.
4. The homework runner POSTs a *different* shape (`focus`, `seconds`, `at`, `day`) than `sheet-sync.js` does. v1 silently dropped most of it. v2 normalises both.

**Migration is safe.** Rows are written by *header name*, not position, and legacy headers are renamed in place — `Total → Max`, `% → Percent`, `Skill Stats → Breakdown` — so existing rows keep their data and their columns. Nothing is reordered.

> **Set `SESSIONS_TAB` to the name of your current log tab** (probably `Sheet1`) if you want new rows to keep landing beside the old ones. Leave it as `Sessions` to start a clean tab.

## The script

```javascript
/**
 * SAT R&W — Tutor Sheet sync.  Deploy: Extensions → Apps Script → paste →
 * run `setup` once → Deploy → Web app → Execute as: me → Access: Anyone.
 *
 * Accepts two payload shapes:
 *   sheet-sync.js      practice / exam / challenge sessions (full diagnostics)
 *   homework-run.html  homework days  { type, student, day, focus, score, total, seconds, at }
 *
 * Writes two tabs:
 *   Sessions   one row per completed session
 *   Questions  one row per question answered, joined on Session ID
 */

// ── Settings ──────────────────────────────────────────────────────
var SESSIONS_TAB  = 'Sessions';   // ← set to 'Sheet1' to keep using your existing tab
var QUESTIONS_TAB = 'Questions';
var SHARED_SECRET = '';           // must equal SHEET_SYNC_SECRET in sheet-sync.js
var SUBJECT       = 'R&W';
var APP_NAME      = 'SAT R&W Mastery';

// ── Schema ────────────────────────────────────────────────────────
// The first 16 are the columns the Math sheet also uses, in the same order,
// so a student's week can be read across both subjects.
var SESSION_COLUMNS = [
  'Timestamp', 'Student', 'Subject', 'App', 'Type', 'Assignment ID', 'Assignment',
  'Score', 'Max', 'Percent', 'Duration (sec)', 'Avg/Q (sec)', 'Mode',
  'Focus Losses', 'Session ID', 'Breakdown'
];
// 'Retention' is R&W-only and appended last, so it lands to the right of the
// existing columns and the Math sheet's shared schema is untouched.
//
// It is the per-session retention tally: {skill:{correct,total}} over the questions
// the review ladder brought BACK after a delay. Accuracy says "did they get it
// right"; this says "did they get it right weeks later". Only the second one
// answers "is it staying learned?", which is the claim the monthly report makes to
// a parent — and until this column existed that claim was uncheckable away from the
// student's own device.
//
// Blank is not zero. Blank means no review was due in that session, which is the
// honest "we do not know yet" — do not fill it in with a 0.
//
// The three Baseline columns exist because this script builds every row KEY BY
// KEY from the list above. Anything the client posts that has no column here is
// dropped — silently, into a row that still looks completely fine. The baseline
// screener posts a whole block the practice payload has no concept of: a
// per-skill band with its confidence, a projected score RANGE, which parallel
// form was sat, which sitting it was, and the ranked plan derived from all of
// it. Without somewhere to put it, a tutor opening the sheet after a baseline
// sees `Type: baseline · Score 14 · Max 22` and nothing else — every finding
// the sitting produced, gone, with no error anywhere to say so. That happened
// in the sister app: its script has a catch-all column and ours did not, which
// is the only reason its baseline reached a sheet at all.
//
// `Baseline` is that catch-all, and it is deliberately the whole JSON block:
// the two readable columns beside it are for a human skimming the sheet, and
// the JSON is so that the next thing the client learns to send is not lost
// waiting on a redeploy.
//
// Blank on every non-baseline row, and blank is not zero — it means this
// session was not a baseline, not that the baseline found nothing.
var EXTRA_COLUMNS = ['Skills', 'Difficulties', 'Retention',
                     'Baseline Projection', 'Baseline Plan', 'Baseline'];   // R&W only

// The first 13 are the shared core, identical to the Math script and in the same
// order, so a student's week reads across both subjects. R&W's three extras are
// appended LAST on purpose: ensureHeaders_ adds new headers to the right, so a
// sheet written by the Math script stays readable and existing rows keep their data.
//
// Prediction is the one that matters. The homework runner makes the student write
// what the answer must be BEFORE the choices appear, and that sentence is the
// reasoning the class reviews together — a right answer reached by bad reasoning is
// as much a target as a wrong one, and the score alone never shows it.
//
// On text is the integrity signal: a Hard passage committed in four seconds was not
// read. Do not average it into a single per-question time — that is exactly what
// hides it.
var QUESTION_COLUMNS = [
  'Timestamp', 'Student', 'Subject', 'Session ID', '#', 'Question ID',
  'Skill', 'Difficulty', 'Chosen', 'Correct', 'Right', 'Seconds', 'Trap',
  'Prediction', 'On text', 'On options'
];

// Old header → new header. Applied in place, so existing rows keep their data.
var LEGACY_RENAMES = { 'Total': 'Max', '%': 'Percent', 'Skill Stats': 'Breakdown' };

// ── Entry points ──────────────────────────────────────────────────

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (SHARED_SECRET && body.secret !== SHARED_SECRET) {
      return json_({ ok: false, error: 'bad secret' });
    }
    var norm = normalise_(body);
    if (!norm['Student']) return json_({ ok: false, error: 'no student' });
    return json_(appendSession_(norm));
  } catch (err) {
    return json_({ ok: false, error: String((err && err.message) || err) });
  }
}

function doGet() {
  return json_({ ok: true, message: 'SAT R&W session sync. POST sessions here.' });
}

/** Run once. Creates the tabs and headers. Never clears a cell. */
function setup() {
  ensureHeaders_(tab_(SESSIONS_TAB), SESSION_COLUMNS.concat(EXTRA_COLUMNS), LEGACY_RENAMES);
  ensureHeaders_(tab_(QUESTIONS_TAB), QUESTION_COLUMNS, null);
}

// ── Normalisation ─────────────────────────────────────────────────
// Both inbound shapes collapse to one row keyed by header name.

function normalise_(b) {
  var score = num_(b.score);
  var max   = num_(b.total);
  var dur   = num_(b.duration != null ? b.duration : b.seconds);

  var row = {
    'Timestamp':      new Date(b.date || b.at || Date.now()),
    'Student':        String(b.student || '').trim(),
    'Subject':        SUBJECT,
    'App':            APP_NAME,
    'Type':           b.type || 'practice',
    'Assignment ID':  b.assignmentId || (b.day != null ? 'day-' + b.day : ''),
    'Assignment':     b.assignmentTitle || b.focus || '',
    'Score':          score,
    'Max':            max,
    'Percent':        max ? score / max : '',
    'Duration (sec)': present_(dur),
    'Avg/Q (sec)':    b.avgSecs != null ? b.avgSecs : (max && dur ? Math.round(dur / max) : ''),
    'Mode':           b.mode || '',
    'Focus Losses':   present_(b.blurCount),
    'Session ID':     b.sessionId || '',
    'Breakdown':      b.skillStats ? JSON.stringify(b.skillStats) : '',
    'Retention':      b.retention  ? JSON.stringify(b.retention)  : '',
    'Skills':         Array.isArray(b.skills) ? b.skills.join(', ') : '',
    'Difficulties':   Array.isArray(b.diffs) ? b.diffs.join(', ') : '',
    'Baseline Projection': baselineRange_(b),
    'Baseline Plan':       baselinePlan_(b),
    // Everything the baseline sent, verbatim, plus whether the row was
    // backfilled from a device long after the fact — a late arrival must not
    // read as a sitting that happened today.
    'Baseline': b.baseline
      ? JSON.stringify(b.recovered ? mergeRecovered_(b.baseline) : b.baseline)
      : ''
  };

  // sheet-sync.js sends: { id, skill, difficulty, chosen, correct, isCorrect, secs, trap }
  row.__questions = (Array.isArray(b.questions) ? b.questions : []).map(function (q) {
    return {
      id: q.id, skill: q.skill, difficulty: q.difficulty,
      chosen: q.chosen, correct: q.correct, right: q.isCorrect,
      secs: q.secs, trap: q.trap,
      prediction: q.prediction, onText: q.onText, onOpts: q.onOpts
    };
  });
  return row;
}

// ── baseline helpers ──────────────────────────────────────────────
// Two columns a human can skim without opening the JSON.

// "480–540 (sitting 1, form A)". A RANGE, never a point: a 22-item screener
// cannot support a point estimate, and a single number in a spreadsheet cell
// invites reading ±30 of instrument noise as progress.
function baselineRange_(b) {
  var x = b && b.baseline;
  if (!x || x.projectionLow == null || x.projectionHigh == null) return '';
  var tail = [];
  if (x.sitting) tail.push('sitting ' + x.sitting);
  if (x.form)    tail.push('form ' + x.form);
  return x.projectionLow + '–' + x.projectionHigh
       + (tail.length ? ' (' + tail.join(', ') + ')' : '');
}

// The ranked plan, top three, in order. This is the output of the exercise —
// the bands say which skills are weak, the plan says which one to teach first —
// and it is the part the sister app computed and then posted nowhere.
function baselinePlan_(b) {
  var x = b && b.baseline;
  if (!x || !x.focus || !x.focus.length) return '';
  return x.focus.slice(0, 3).map(function (f) {
    return f.skill + (f.band ? ' (' + f.band + ')' : '');
  }).join(' · ');
}

function mergeRecovered_(baseline) {
  var out = {};
  for (var k in baseline) if (baseline.hasOwnProperty(k)) out[k] = baseline[k];
  out.recovered = true;
  return out;
}

// ══════════════════════════════════════════════════════════════════
// COMMON CORE — byte-for-byte identical in the Math script.
// Apps Script has no imports across projects, so it is duplicated on purpose.
// Change one, change the other.
// ══════════════════════════════════════════════════════════════════

function tab_(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

/**
 * Guarantees every wanted header exists. Renames known legacy headers in place
 * (so old rows keep their values) and appends anything still missing on the
 * right. Existing columns never move. Returns the live header row.
 */
function ensureHeaders_(sheet, wanted, renames) {
  var lastCol = sheet.getLastColumn();
  var headers = lastCol > 0
    ? sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (v) { return String(v).trim(); })
    : [];
  while (headers.length && headers[headers.length - 1] === '') headers.pop();

  var changed = false;
  if (renames) {
    for (var i = 0; i < headers.length; i++) {
      var to = renames[headers[i]];
      if (to && headers.indexOf(to) === -1) { headers[i] = to; changed = true; }
    }
  }
  wanted.forEach(function (name) {
    if (headers.indexOf(name) === -1) { headers.push(name); changed = true; }
  });

  if (changed || lastCol === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return headers;
}

function rowFrom_(headers, obj) {
  return headers.map(function (h) {
    return Object.prototype.hasOwnProperty.call(obj, h) ? obj[h] : '';
  });
}

/** Session IDs already stored, so a re-POST is a no-op rather than a duplicate. */
function seenSessionIds_(sheet, headers) {
  var col = headers.indexOf('Session ID');
  var last = sheet.getLastRow();
  var seen = {};
  if (col < 0 || last < 2) return seen;
  var vals = sheet.getRange(2, col + 1, last - 1, 1).getValues();
  for (var i = 0; i < vals.length; i++) {
    var v = String(vals[i][0] || '').trim();
    if (v) seen[v] = true;
  }
  return seen;
}

function appendSession_(norm) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);                       // concurrent POSTs must not interleave
  try {
    var sheet   = tab_(SESSIONS_TAB);
    var headers = ensureHeaders_(sheet, SESSION_COLUMNS.concat(EXTRA_COLUMNS), LEGACY_RENAMES);

    var id = norm['Session ID'];
    if (id && seenSessionIds_(sheet, headers)[id]) {
      return { ok: true, duplicate: true, sessionId: id };
    }

    sheet.appendRow(rowFrom_(headers, norm));
    var r = sheet.getLastRow();
    var p = headers.indexOf('Percent');
    if (p >= 0) sheet.getRange(r, p + 1).setNumberFormat('0%');
    var t = headers.indexOf('Timestamp');
    if (t >= 0) sheet.getRange(r, t + 1).setNumberFormat('yyyy-mm-dd HH:mm');

    appendQuestions_(norm, norm.__questions);
    return { ok: true, sessionId: id, questions: (norm.__questions || []).length };
  } finally {
    lock.releaseLock();
  }
}

function appendQuestions_(norm, qs) {
  if (!qs || !qs.length) return;
  var sheet   = tab_(QUESTIONS_TAB);
  var headers = ensureHeaders_(sheet, QUESTION_COLUMNS, null);
  var rows = qs.map(function (q, i) {
    return rowFrom_(headers, {
      'Timestamp':   norm['Timestamp'],
      'Student':     norm['Student'],
      'Subject':     norm['Subject'],
      'Session ID':  norm['Session ID'],
      '#':           i + 1,
      'Question ID': q.id || '',
      'Skill':       q.skill || '',
      'Difficulty':  q.difficulty || '',
      'Chosen':      q.chosen || '',
      'Correct':     q.correct || '',
      'Right':       q.right === undefined || q.right === null ? '' : !!q.right,
      'Seconds':     present_(q.secs),
      'Trap':        q.trap || '',
      'Prediction':  q.prediction || '',
      'On text':     present_(q.onText),
      'On options':  present_(q.onOpts)
    });
  });
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
}

/** Keeps a real 0 but turns undefined/null/'' into a blank cell. */
function present_(v) {
  return (v === undefined || v === null || v === '') ? '' : v;
}

function num_(v) {
  var n = Number(v);
  return isNaN(n) ? 0 : n;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
```

## What you can now ask the sheet

The **Questions** tab is the point of all this. Every row carries the trap the student fell for and the seconds they spent. For example, Jeffrey's most expensive traps:

```text
=QUERY(Questions!A:M,
  "SELECT G, M, COUNT(F), AVG(L)
   WHERE B = 'Jeffrey' AND K = FALSE AND M <> ''
   GROUP BY G, M
   ORDER BY COUNT(F) DESC
   LABEL G 'Skill', M 'Trap', COUNT(F) 'Times wrong', AVG(L) 'Avg secs'", 1)
```

Or how his challenge set is going, session by session:

```text
=QUERY(Sessions!A:P,
  "SELECT A, H, I, J, N WHERE B = 'Jeffrey' AND F = 'p8-rw' ORDER BY A DESC", 1)
```

`Focus Losses` (column N) is the tab-switch count. It was being collected by `anti-cheat.js`, posted by `sheet-sync.js`, and discarded by the old script.

## Two things this does not fix

- The R&W client posts with `mode: 'no-cors'`, so it cannot read the `{ok:true}` reply and cannot tell a lost session from a delivered one. Now that the server is idempotent, a retry queue would be safe to add — that is a client change, not a script one.
- `Duration (sec)` will read `0` for sessions logged before the per-question timer was wired up. Old rows are left exactly as they were.
