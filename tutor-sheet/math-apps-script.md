# Edutrack Math — Tutor Sheet Apps Script (v2)

Paste the whole block below into the Apps Script editor bound to the **Math** spreadsheet, then run `setupAll` once and redeploy.

## What changed, and why

**It captures `payload.detail[]`.** Every Math session already POSTs a per-question array — `id`, `domain`, `difficulty`, whether it was answered, whether it was right — and v1 had no column for it. It now becomes one row per question in a **Questions** tab, joined on Session ID, sharing its schema with the R&W sheet.

**Three defects fixed.**

1. **The dashboard silently breaks on any pre-existing sheet.** v1's `_ensureHeaders()` preserved old headers and appended new ones on the right, so on a sheet that ran the older version — `Student` / `App` / `Module` / `Out Of` in columns B–F — `Student Name` landed out past column N while `refreshDashboard()` kept reading `r[1]`. And `ensureRawHeaders_()` could not catch it: its guard was `row1[1].toLowerCase().startsWith('student')`, and the stale `"Student"` passes. v2 **renames legacy headers in place** and the dashboard **reads by header name**, never by position.

2. **The retry queue could duplicate rows.** `shared/session.js` re-POSTs anything whose response it could not read, and Apps Script `/exec` 302-redirects — so a session that landed but whose reply was lost got sent again, inflating every average on the dashboard. v2 is **idempotent**: a Session ID already stored is skipped. The client's retries are now free.

3. **`Duration (min)` destroyed the data it stored.** `Math.round(durationMs / 60000)` logs a 40-second session as `1` and a 25-second one as `0`. v2 stores `Duration (sec)`. The old column is left untouched — its values can't be recovered, so nothing pretends they can.

Also: `Percent` was the string `"85%"` and would not sort. It is now a number formatted as a percent. And the `(Complete)` marker the dashboard filtered on was appended to *every* row by `doPost`, so it filtered nothing; the filter is now `Student` present and `Max > 0`.

**Migration is safe.** Nothing is reordered and no cell is cleared. `Student Name → Student`, `App Name → App`, `Max Score → Max`, `Topic & Section → Topic`, `Detailed Scores → Breakdown`, and the older `Out Of → Max`, `Module → Topic`.

## The script

```javascript
/**
 * Edutrack Math — Tutor Sheet sync + dashboard.
 * Deploy: Extensions → Apps Script → paste → run `setupAll` → Deploy → Web app.
 *
 * Inbound (shared/session.js):
 *   { key, type:'session', payload:{ sessionId, appId, appName, module, variant,
 *     topicTitle, score, gradable, ungraded, missed, durationMs, startedAt,
 *     completedAt, studentName, smartMode, isExamMode, domainBreakdown, detail[] } }
 *
 * Tabs:
 *   Sessions   one row per completed session   (cols 1–16 match the R&W sheet)
 *   Questions  one row per question, joined on Session ID
 *   Dashboard / Student Detail  reporting, rebuilt on demand
 */

// ── Settings ──────────────────────────────────────────────────────
var SESSIONS_TAB  = 'Sheet1';     // ← your existing log tab; rename here if you move it
var QUESTIONS_TAB = 'Questions';
var DASH_TAB      = 'Dashboard';
var DETAIL_TAB    = 'Student Detail';
var SHARED_KEY    = 'edutrack-math-v1';   // must equal SYNC_KEY in shared/session.js
var SUBJECT       = 'Math';

// ── Schema ────────────────────────────────────────────────────────
// The first 16 are the columns the R&W sheet also uses, in the same order.
var SESSION_COLUMNS = [
  'Timestamp', 'Student', 'Subject', 'App', 'Type', 'Assignment ID', 'Assignment',
  'Score', 'Max', 'Percent', 'Duration (sec)', 'Avg/Q (sec)', 'Mode',
  'Focus Losses', 'Session ID', 'Breakdown'
];
var EXTRA_COLUMNS = ['Variant', 'Smart Mode', 'Exam Mode', 'Topic', 'Missed', 'Ungraded'];

var QUESTION_COLUMNS = [
  'Timestamp', 'Student', 'Subject', 'Session ID', '#', 'Question ID',
  'Skill', 'Difficulty', 'Chosen', 'Correct', 'Right', 'Seconds', 'Trap'
];

// Old header → new header. Applied in place, so existing rows keep their values.
// 'Duration (min)' has no target: its minutes cannot be turned back into seconds,
// so it is left alone as a dead column rather than silently reinterpreted.
var LEGACY_RENAMES = {
  'Student Name': 'Student', 'App Name': 'App', 'Max Score': 'Max',
  'Topic & Section': 'Topic', 'Detailed Scores': 'Breakdown',
  'Out Of': 'Max', 'Module': 'Topic'
};

// ── Entry points ──────────────────────────────────────────────────

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (!body || body.key !== SHARED_KEY) return json_({ ok: false, error: 'bad key' });
    if (body.type !== 'session') return json_({ ok: true, ignored: body.type });

    var norm = normalise_(body.payload || {});
    if (!norm['Student']) return json_({ ok: false, error: 'no student' });
    return json_(appendSession_(norm));
  } catch (err) {
    return json_({ ok: false, error: String((err && err.message) || err) });
  }
}

function setupAll() {
  ensureHeaders_(tab_(SESSIONS_TAB), SESSION_COLUMNS.concat(EXTRA_COLUMNS), LEGACY_RENAMES);
  ensureHeaders_(tab_(QUESTIONS_TAB), QUESTION_COLUMNS, null);
  setupDashboard();
  setupStudentDetail();
  try { SpreadsheetApp.getUi().alert('Setup complete.'); } catch (e) {}
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Edutrack')
    .addItem('Refresh dashboard', 'refreshDashboard')
    .addSeparator()
    .addItem('Setup everything', 'setupAll')
    .addItem('Rebuild Dashboard tab', 'setupDashboard')
    .addItem('Rebuild Student Detail tab', 'setupStudentDetail')
    .addToUi();
  if (SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DASH_TAB)) {
    try { refreshDashboard(); } catch (e) {}
  }
}

// ── Normalisation ─────────────────────────────────────────────────

function normalise_(p) {
  var score = num_(p.score);
  var max   = num_(p.gradable);
  var dur   = p.durationMs ? Math.round(p.durationMs / 1000) : '';

  var row = {
    'Timestamp':      p.completedAt ? new Date(p.completedAt) : new Date(),
    'Student':        String(p.studentName || '').trim(),
    'Subject':        SUBJECT,
    'App':            p.appName || p.appId || '',
    'Type':           p.module === 'challenge' ? 'challenge' : (p.isExamMode ? 'exam' : 'practice'),
    'Assignment ID':  p.appId || '',
    'Assignment':     p.topicTitle || p.module || '',
    'Score':          score,
    'Max':            max,
    'Percent':        max ? score / max : '',
    'Duration (sec)': present_(dur),
    'Avg/Q (sec)':    (max && dur) ? Math.round(dur / max) : '',
    'Mode':           p.variant || '',
    'Focus Losses':   '',                       // the Math app has no integrity layer
    'Session ID':     p.sessionId || '',
    'Breakdown':      p.domainBreakdown || '',
    'Variant':        p.variant || '',
    'Smart Mode':     p.smartMode ? 'Yes' : '',
    'Exam Mode':      p.isExamMode ? 'Yes' : '',
    'Topic':          p.module || '',
    'Missed':         present_(p.missed),
    'Ungraded':       present_(p.ungraded)
  };

  // shared/session.js sends: { id, app, domain, difficulty, answered, correct }
  // where `correct` is a BOOLEAN (was it right), not the correct answer.
  // `secs` / `trap` are blank until the Math client starts sending them.
  row.__questions = (Array.isArray(p.detail) ? p.detail : []).map(function (d) {
    return {
      id: d.id, skill: d.domain || '', difficulty: d.difficulty || '',
      chosen: d.chosen || '', correct: '', right: d.correct,
      secs: d.secs, trap: d.trap
    };
  });
  return row;
}

// ══════════════════════════════════════════════════════════════════
// COMMON CORE — byte-for-byte identical in the R&W script.
// Apps Script has no imports across projects, so it is duplicated on purpose.
// Change one, change the other.
// ══════════════════════════════════════════════════════════════════

function tab_(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

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
  lock.waitLock(20000);
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
      'Trap':        q.trap || ''
    });
  });
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
}

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

// ══════════════════════════════════════════════════════════════════
// DASHBOARD — reads by header NAME. Adding or moving a column cannot
// silently point it at the wrong data, which is what v1 did.
// ══════════════════════════════════════════════════════════════════

function idx_(headers, name) { return headers.indexOf(name); }

function colLetter_(i) {          // 0-based index → 'A', 'B', … 'AA'
  var s = '';
  i += 1;
  while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = (i - m - 1) / 26; }
  return s;
}

function setupDashboard() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(DASH_TAB);
  if (sheet) ss.deleteSheet(sheet);
  ss.insertSheet(DASH_TAB);
  refreshDashboard();
}

function refreshDashboard() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(DASH_TAB) || ss.insertSheet(DASH_TAB);
  sheet.clear();
  sheet.clearConditionalFormatRules();
  sheet.setHiddenGridlines(true);

  var raw = ss.getSheetByName(SESSIONS_TAB);
  if (!raw || raw.getLastRow() < 2) {
    sheet.getRange(1, 1).setValue('No data yet — students need to complete at least one session.');
    return;
  }
  var data = raw.getDataRange().getValues();
  var headers = data[0].map(function (v) { return String(v).trim(); });
  var cTs = idx_(headers, 'Timestamp'), cStu = idx_(headers, 'Student');
  var cApp = idx_(headers, 'App'), cScore = idx_(headers, 'Score'), cMax = idx_(headers, 'Max');
  if (cStu < 0 || cScore < 0 || cMax < 0) {
    sheet.getRange(1, 1).setValue('Run "Setup everything" first — the Sessions headers are not set up.');
    return;
  }

  var now = new Date();
  var weekAgo = new Date(now.getTime() - 7 * 86400000);
  var byStudent = {}, byApp = {};

  data.slice(1).forEach(function (r) {
    var student = String(r[cStu] || '').trim();
    var max = Number(r[cMax]) || 0;
    if (!student || !max) return;                        // the only completeness test we need
    var ts = new Date(r[cTs]);
    var appName = String(r[cApp] || '').trim();
    var score = Number(r[cScore]) || 0;

    var s = byStudent[student] || (byStudent[student] = {
      name: student, lastActive: null, sessions7d: 0, sessionsAll: 0,
      scoreSum7d: 0, maxSum7d: 0, scoreSumAll: 0, maxSumAll: 0,
      history: [], appScores: {}, appCounts: {}
    });
    if (!s.lastActive || ts > s.lastActive) s.lastActive = ts;
    s.sessionsAll++; s.scoreSumAll += score; s.maxSumAll += max;
    s.history.push({ ts: ts, pct: score / max });
    if (ts >= weekAgo) { s.sessions7d++; s.scoreSum7d += score; s.maxSum7d += max; }
    var a1 = s.appScores[appName] || (s.appScores[appName] = { score: 0, max: 0 });
    a1.score += score; a1.max += max;
    s.appCounts[appName] = (s.appCounts[appName] || 0) + 1;

    var a = byApp[appName] || (byApp[appName] = { name: appName, sessions: 0, score: 0, max: 0, students: {} });
    a.sessions++; a.score += score; a.max += max; a.students[student] = true;
  });

  var students = Object.keys(byStudent).map(function (k) { return byStudent[k]; });
  students.forEach(function (s) {
    s.history.sort(function (a, b) { return a.ts - b.ts; });
    var recent = s.history.slice(-5), prev = s.history.slice(-10, -5);
    var ra = recent.length ? recent.reduce(function (a, b) { return a + b.pct; }, 0) / recent.length : 0;
    var pa = prev.length ? prev.reduce(function (a, b) { return a + b.pct; }, 0) / prev.length : ra;
    s.trend = Math.round((ra - pa) * 100);

    var worst = '—', worstPct = 2;
    Object.keys(s.appScores).forEach(function (k) {
      var x = s.appScores[k];
      if (!x.max) return;
      if (x.score / x.max < worstPct) { worstPct = x.score / x.max; worst = prettyApp_(k); }
    });
    s.weakest = worst;
  });

  sheet.getRange(1, 1).setValue('Tutor Dashboard').setFontSize(18).setFontWeight('bold');
  sheet.getRange(1, 7).setValue('Last refreshed:').setHorizontalAlignment('right');
  sheet.getRange(1, 8).setValue(now).setNumberFormat('yyyy-mm-dd HH:mm');

  sheet.getRange(3, 1).setValue('KEY METRICS').setFontWeight('bold').setBackground('#e0f2fe');
  sheet.getRange(4, 2).setValue('This week').setFontWeight('bold');
  sheet.getRange(4, 3).setValue('All time').setFontWeight('bold');

  var sum = function (f) { return students.reduce(function (a, s) { return a + f(s); }, 0); };
  var s7 = sum(function (s) { return s.scoreSum7d; }), m7 = sum(function (s) { return s.maxSum7d; });
  var sa = sum(function (s) { return s.scoreSumAll; }), ma = sum(function (s) { return s.maxSumAll; });
  sheet.getRange(5, 1, 3, 3).setValues([
    ['Active students', students.filter(function (s) { return s.sessions7d > 0; }).length, students.length],
    ['Sessions', sum(function (s) { return s.sessions7d; }), sum(function (s) { return s.sessionsAll; })],
    ['Average score', m7 ? s7 / m7 : '—', ma ? sa / ma : '—']
  ]);
  sheet.getRange(7, 2, 1, 2).setNumberFormat('0%');

  var sStart = 9;
  sheet.getRange(sStart, 1).setValue('STUDENTS (most recent first)').setFontWeight('bold').setBackground('#e0f2fe');
  var sHeaders = ['Name', 'Last active', 'Sessions (7d)', 'Sessions (all)', 'Avg % (7d)', 'Avg % (all)', 'Trend', 'Weakest area', 'Sparkline'];
  sheet.getRange(sStart + 1, 1, 1, sHeaders.length).setValues([sHeaders]).setFontWeight('bold').setBackground('#f1f5f9');

  students.sort(function (a, b) { return (b.lastActive || 0) - (a.lastActive || 0); });
  var sRows = students.map(function (s) {
    var d = s.lastActive ? Math.round((now - s.lastActive) / 86400000) : null;
    var lastTxt = d === 0 ? 'today' : d === 1 ? 'yesterday' : d + ' days ago';
    var trendTxt = (s.trend > 2 ? '+' : s.trend < -2 ? '' : '') + s.trend;
    return [s.name, lastTxt, s.sessions7d, s.sessionsAll,
      s.maxSum7d ? s.scoreSum7d / s.maxSum7d : null,
      s.maxSumAll ? s.scoreSumAll / s.maxSumAll : null,
      trendTxt, s.weakest, ''];
  });
  if (sRows.length) {
    sheet.getRange(sStart + 2, 1, sRows.length, sHeaders.length).setValues(sRows);
    sheet.getRange(sStart + 2, 5, sRows.length, 2).setNumberFormat('0%');
    students.forEach(function (s, i) {
      if (s.history.length >= 2) {
        var pcts = s.history.slice(-10).map(function (x) { return x.pct.toFixed(3); }).join(';');
        sheet.getRange(sStart + 2 + i, 9).setFormula(
          '=SPARKLINE({' + pcts + '}, {"charttype","line";"color1","#38bdf8";"linewidth",2})');
      }
    });
    applyPercentColors_(sheet, sStart + 2, 5, sRows.length, 2);
  }

  var aStart = sStart + 2 + sRows.length + 2;
  sheet.getRange(aStart, 1).setValue('APP FOCUS (lowest average first)').setFontWeight('bold').setBackground('#e0f2fe');
  sheet.getRange(aStart + 1, 1, 1, 4).setValues([['App', 'Sessions', 'Avg %', 'Students']])
    .setFontWeight('bold').setBackground('#f1f5f9');
  var aRows = Object.keys(byApp).map(function (k) {
    var a = byApp[k];
    return [prettyApp_(a.name), a.sessions, a.max ? a.score / a.max : null, Object.keys(a.students).length];
  }).sort(function (a, b) { return (a[2] == null ? 2 : a[2]) - (b[2] == null ? 2 : b[2]); });
  if (aRows.length) {
    sheet.getRange(aStart + 2, 1, aRows.length, 4).setValues(aRows);
    sheet.getRange(aStart + 2, 3, aRows.length, 1).setNumberFormat('0%');
    applyPercentColors_(sheet, aStart + 2, 3, aRows.length, 1);
  }

  sheet.setColumnWidth(1, 220);
  for (var i = 2; i <= 7; i++) sheet.setColumnWidth(i, 100);
  sheet.setColumnWidth(8, 180);
  sheet.setColumnWidth(9, 140);
}

function setupStudentDetail() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(DETAIL_TAB);
  if (sheet) ss.deleteSheet(sheet);
  sheet = ss.insertSheet(DETAIL_TAB);
  sheet.setHiddenGridlines(true);

  // Column letters are resolved from the live header row, so the queries below
  // survive a schema change instead of quietly reading the wrong column.
  var raw = tab_(SESSIONS_TAB);
  var headers = ensureHeaders_(raw, SESSION_COLUMNS.concat(EXTRA_COLUMNS), LEGACY_RENAMES);
  var L = function (n) { return colLetter_(idx_(headers, n)); };
  var ts = L('Timestamp'), stu = L('Student'), app = L('App'),
      asg = L('Assignment'), sc = L('Score'), mx = L('Max'), sid = L('Session ID');

  sheet.getRange('Z1').setFormula(
    '=SORT(UNIQUE(FILTER(' + SESSIONS_TAB + '!' + stu + '2:' + stu + ', ' + SESSIONS_TAB + '!' + stu + '2:' + stu + '<>"")))');
  sheet.hideColumns(26);

  sheet.getRange(1, 1).setValue('Student:').setFontWeight('bold').setFontSize(14);
  var cell = sheet.getRange(1, 2);
  cell.setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInRange(sheet.getRange('Z1:Z100'), true).setAllowInvalid(false).build());
  cell.setBackground('#fef3c7').setFontSize(12).setFontWeight('bold');

  sheet.getRange(4, 1).setValue('LAST 10 SESSIONS').setFontWeight('bold').setBackground('#e0f2fe');
  sheet.getRange(5, 1).setFormula(
    '=IFERROR(QUERY(' + SESSIONS_TAB + '!A2:Z, "SELECT ' + ts + ', ' + app + ', ' + asg + ', ' + sc + ', ' + mx +
    ' WHERE ' + stu + ' = \'" & B1 & "\' AND ' + mx + ' > 0 ORDER BY ' + ts + ' DESC LIMIT 10' +
    ' LABEL ' + ts + ' \'When\', ' + app + ' \'App\', ' + asg + ' \'Assignment\', ' + sc + ' \'Score\', ' + mx + ' \'Max\'", 0),' +
    ' "(pick a student or no sessions yet)")');

  sheet.getRange(18, 1).setValue('MOST-FALLEN-FOR TRAPS').setFontWeight('bold').setBackground('#e0f2fe');
  sheet.getRange(19, 1).setFormula(
    '=IFERROR(QUERY(' + QUESTIONS_TAB + '!A2:M, "SELECT G, M, COUNT(F) WHERE B = \'" & B1 &' +
    ' "\' AND K = FALSE AND M <> \'\' GROUP BY G, M ORDER BY COUNT(F) DESC LIMIT 10' +
    ' LABEL G \'Skill\', M \'Trap\', COUNT(F) \'Times wrong\'", 0), "(no per-question data yet)")');

  sheet.setColumnWidth(1, 220);
  sheet.setColumnWidth(2, 220);
  for (var i = 3; i <= 6; i++) sheet.setColumnWidth(i, 110);
}

function prettyApp_(appName) {
  if (!appName) return '—';
  return appName.replace(/_App.*$/, '').replace(/_v\d+$/i, '').replace(/_/g, ' ').trim();
}

function applyPercentColors_(sheet, row, col, numRows, numCols) {
  var range = sheet.getRange(row, col, numRows, numCols);
  var rules = sheet.getConditionalFormatRules();
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenNumberLessThan(0.5).setBackground('#fee2e2').setFontColor('#991b1b').setRanges([range]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenNumberBetween(0.5, 0.7499).setBackground('#fef3c7').setFontColor('#92400e').setRanges([range]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenNumberGreaterThanOrEqualTo(0.75).setBackground('#d1fae5').setFontColor('#065f46').setRanges([range]).build());
  sheet.setConditionalFormatRules(rules);
}
```

## One client change worth making

`shared/session.js` builds each `detail[]` entry as `{ id, app, domain, difficulty, answered, correct }`. `challenge-app.js` already measures `elapsed` per question and already knows `q.trapName` — it just doesn't put either in `detail`. Two fields, and the Math sheet gets the same trap analysis the R&W sheet gets:

```javascript
// challenge-app.js, in grade()
S.detail.push({
  id: q.id, app: q.app, domain: q.domain || '', difficulty: q.difficulty || '',
  answered: true, correct: !!isCorrect,
  secs: Math.round(elapsed / 1000),   // already computed, currently discarded
  trap: q.trapName || ''              // already displayed, currently discarded
});
```

The script above writes `Seconds` and `Trap` the moment they arrive, and leaves them blank until then.

## Note on `Duration (min)`

If your sheet already has that column, v2 leaves it in place and starts writing `Duration (sec)` beside it. Minutes cannot be converted back into seconds, so the old values are neither migrated nor pretended about. Delete the column when you no longer need the history.
