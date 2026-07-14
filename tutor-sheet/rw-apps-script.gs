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
var EXTRA_COLUMNS = ['Skills', 'Difficulties'];   // R&W only

// 'Prediction', 'On text' and 'On options' are appended LAST on purpose: new
// headers are added to the right, so existing rows keep their data.
//
// Prediction is the one that matters. The homework runner makes the student write
// what the answer must be BEFORE the choices appear, and that sentence is the
// reasoning the class reviews together — a right answer reached by bad reasoning
// is as much a target as a wrong one, and the score alone never shows it.
//
// On text is the integrity signal: a Hard passage committed in four seconds was
// not read. Do not average it into a single per-question time — that is exactly
// what hides it.
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
    'Skills':         Array.isArray(b.skills) ? b.skills.join(', ') : '',
    'Difficulties':   Array.isArray(b.diffs) ? b.diffs.join(', ') : ''
  };

  // sheet-sync.js sends: { id, skill, difficulty, chosen, correct, isCorrect, secs, trap }
  // homework-run.html adds:            { prediction, onText, onOpts }
  // Practice sends no prediction; those cells stay blank, which is correct — only
  // homework asks for one.
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
