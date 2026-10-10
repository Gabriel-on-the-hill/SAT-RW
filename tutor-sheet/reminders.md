# Homework reminders — sheet-side script

**The same file lives in both apps** (`PSAT 8-9/app/tutor-sheet/reminders.md` and
`MasteryApp/tutor-sheet/reminders.md`). Change one, change both, and run
`node tutor-sheet/reminders.test.js` in both. The test parses the `javascript` block below,
so this file is the only source: do not keep a `.gs` copy anywhere.

## What it does

An hourly trigger on the tutor sheet reads the plans file the hub itself reads
(`homework/assignments.js` on the live site), checks which sets each student has submitted, and
sends email. At most one message per student per day.

| Message | To | When | Stops when |
|---|---|---|---|
| Set open: which set, how many questions, how long | Student | The day a set opens, at the student's own hour | That set is done |
| Nudge: the set still waiting | Student | 2 days with no homework while a set is waiting, once the last set has opened | Any homework arrives; at most 2 per plan, 2 days apart |
| Digest: who needs a follow-up | Tutor | 3 days with no homework, or class tomorrow with sets undone; daily, only when there is something to say | The plan ended more than 3 days ago |

It never messages a parent, never sends after a plan's last day, and never messages about a
class-only plan, an in-class set (focus says "in class"), or a day marked `remind: false`.

**How a set counts as done.** A finished (not partial) homework row whose day number AND focus
match the set. Matching on focus means last week's "Day 2" never counts as this week's. A
homework session known only by its `hw_` Session ID (no day) fills the lowest undone set, so a
missing session row errs toward fewer messages, never more.

**Contact details live only in the private sheet** (`Reminder Contacts`). Both apps are public
repositories: never put an email address in this file, a plan, or a commit.

## Install (each tutor sheet, once)

1. Open the tutor spreadsheet → **Extensions → Apps Script**.
2. **Add a new script file** (＋ → Script), name it `Reminders`, and paste the `javascript` block
   below. Do not replace the existing script; this file sits beside it. No redeploy is needed.
3. Run **`setupRemindersPSAT`** (PSAT sheet) or **`setupRemindersSAT`** (SAT sheet) and grant the
   permissions it asks for (send email, read the plans file, run on a schedule). It creates three
   tabs, lists every student who has a plan with Active = N, and installs the hourly trigger.
   Re-running it is safe: it never overwrites a value and never stacks triggers.
4. In **Reminder Contacts**, for each student: Email, Send hour (0–23, their local time),
   Time zone (e.g. `America/Chicago`, `Africa/Lagos`), Class day (`Mon`…`Sun`), Active = `Y`.
   "Name in messages" is optional; it defaults to the login name.
5. Run **`previewReminders`** and read the log (View → Logs). It lists what today would send and
   sends nothing.

**Settings** (`Reminder Settings` tab): put your name in `Sign-off`; it closes every student message. `Mode` is `live`, `preview` (log only, send nothing) or
`off`. `Tutor digest hour` is in the tutor's time zone. `stopReminders` removes the trigger.

Every send, preview and failure is written to **Reminder Log**. A failed send is logged as
`error` and retried on the next hourly run.

## The script

```javascript
/**
 * Homework reminders — one file, used unchanged by both tutor sheets
 * (PSAT 8/9 R&W and SAT R&W). Add it as a SECOND script file in the sheet's
 * Apps Script project (File → + → Script, name it "Reminders"). It does not
 * touch doPost/doGet, so the web app needs no redeploy.
 *
 * Setup, once per sheet:
 *   1. Run setupRemindersPSAT  (PSAT sheet)  or  setupRemindersSAT  (SAT sheet).
 *      It creates three tabs, lists every student who has a plan (inactive),
 *      and installs an hourly trigger. Grant the email permission it asks for.
 *   2. In "Reminder Contacts": add each student's email, set Active to Y.
 *   3. Run previewReminders to see what today would send. Nothing is sent.
 *
 * What it sends (at most one message per student per day):
 *   open   to the student, the morning a set opens, at their own hour
 *   nudge  to the student, after NUDGE_AFTER_DAYS days with no homework while
 *          a set is waiting; at most MAX_NUDGES per plan
 *   digest to the tutor, once a day, only when a student has gone
 *          ALERT_AFTER_DAYS days without homework or has class tomorrow with
 *          sets undone
 *
 * Contact details live only in this private sheet. Never copy them into an
 * app repository: both apps are public.
 */

var RM_SETTINGS_TAB = 'Reminder Settings';
var RM_CONTACTS_TAB = 'Reminder Contacts';
var RM_LOG_TAB      = 'Reminder Log';

var RM_NUDGE_AFTER_DAYS = 2;   // student nudge after this many days with no homework
var RM_ALERT_AFTER_DAYS = 3;   // tutor alert after this many
var RM_MAX_NUDGES       = 2;   // per student per plan
var RM_SEND_WINDOW_HRS  = 3;   // a missed hourly run still sends within this window
var RM_DIGEST_GRACE_DAYS = 3;  // tutor digest keeps watching this long after a plan ends

var RM_CONTACT_COLUMNS = ['Student', 'Name in messages', 'Email', 'Send hour',
                          'Time zone', 'Class day', 'Active', 'Notes'];
var RM_LOG_COLUMNS     = ['Sent at', 'Student', 'Kind', 'Plan start', 'Set',
                          'To', 'Status', 'Detail'];

var RM_PRESETS = {
  PSAT: {
    'App name':  'PSAT 8/9 Reading and Writing',
    'Plans URL': 'https://gabriel-on-the-hill.github.io/PSAT-8-9-R-W/homework/assignments.js',
    'Hub URL':   'https://gabriel-on-the-hill.github.io/PSAT-8-9-R-W/homework-hub.html'
  },
  SAT: {
    'App name':  'SAT Reading and Writing',
    'Plans URL': 'https://gabriel-on-the-hill.github.io/SAT-RW/homework/assignments.js',
    'Hub URL':   'https://gabriel-on-the-hill.github.io/SAT-RW/homework-hub.html'
  }
};

// ── Entry points ──────────────────────────────────────────────────

function setupRemindersPSAT() { rmSetup_(RM_PRESETS.PSAT); }
function setupRemindersSAT()  { rmSetup_(RM_PRESETS.SAT); }

/** Hourly trigger target. Sends what is due now and logs every send. */
function runReminders() { return rmRun_(new Date(), false); }

/** Shows what would go out today, ignoring send hours. Sends and logs nothing. */
function previewReminders() {
  var out = rmRun_(new Date(), true);
  Logger.log(out.join('\n') || 'Nothing would be sent today.');
  return out;
}

/** Removes the hourly trigger. The tabs and log stay. */
function stopReminders() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'runReminders') ScriptApp.deleteTrigger(t);
  });
}

// ── Setup ─────────────────────────────────────────────────────────

function rmSetup_(preset) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var me = Session.getEffectiveUser().getEmail();
  var tz = Session.getScriptTimeZone();

  var st = ss.getSheetByName(RM_SETTINGS_TAB) || ss.insertSheet(RM_SETTINGS_TAB);
  var have = rmReadSettings_(ss);
  var wanted = [
    ['App name', preset['App name']],
    ['Plans URL', preset['Plans URL']],
    ['Hub URL', preset['Hub URL']],
    ['Tutor email', me],
    ['Tutor time zone', tz],
    ['Tutor digest hour', 7],
    ['Sign-off', ''],
    ['Mode', 'live']
  ];
  if (st.getLastRow() === 0) st.appendRow(['Setting', 'Value']);
  wanted.forEach(function (kv) {
    if (!(kv[0] in have)) st.appendRow(kv);       // additive: never overwrites a value
  });
  st.setFrozenRows(1);

  var ct = ss.getSheetByName(RM_CONTACTS_TAB) || ss.insertSheet(RM_CONTACTS_TAB);
  if (ct.getLastRow() === 0) { ct.appendRow(RM_CONTACT_COLUMNS); ct.setFrozenRows(1); }
  var listed = {};
  rmReadContacts_(ss, true).forEach(function (c) { listed[c.student.toLowerCase()] = true; });
  try {
    var plans = rmFetchPlans_(rmReadSettings_(ss)['Plans URL']);
    Object.keys(plans).forEach(function (name) {
      if (name.indexOf('_') >= 0 || listed[name.toLowerCase()]) return;
      ct.appendRow([name, '', '', 18, tz, '', 'N', '']);
    });
  } catch (e) { Logger.log('Could not read plans: ' + e); }

  var lg = ss.getSheetByName(RM_LOG_TAB) || ss.insertSheet(RM_LOG_TAB);
  if (lg.getLastRow() === 0) { lg.appendRow(RM_LOG_COLUMNS); lg.setFrozenRows(1); }
  lg.getRange('D:D').setNumberFormat('@');   // dates stay text, so the log reads back exactly
  lg.getRange('H:H').setNumberFormat('@');

  stopReminders();
  ScriptApp.newTrigger('runReminders').timeBased().everyHours(1).create();
}

// ── The run ───────────────────────────────────────────────────────

function rmRun_(now, preview) {
  var ss       = SpreadsheetApp.getActiveSpreadsheet();
  var settings = rmReadSettings_(ss);
  var mode     = String(settings['Mode'] || 'live').toLowerCase();
  if (mode === 'off') return [];
  var dry      = preview || mode === 'preview';

  var plans, planErr = '';
  try { plans = rmFetchPlans_(settings['Plans URL']); }
  catch (e) { plans = {}; planErr = String(e); }

  var contacts = rmReadContacts_(ss, false);
  var events   = rmReadHomeworkEvents_(ss);
  var log      = rmReadLog_(ss);
  var out      = [];
  var states   = [];

  contacts.forEach(function (c) {
    var tz    = c.tz || settings['Tutor time zone'] || Session.getScriptTimeZone();
    var today = rmFmt_(now, tz, 'yyyy-MM-dd');
    var hour  = Number(rmFmt_(now, tz, 'H'));
    var plan  = rmPlanFor_(plans, c.student);
    var state = rmStudentState_(c, plan, events, today);
    states.push(state);
    if (!c.email) return;
    var inWindow = preview || (hour >= c.sendHour && hour < c.sendHour + RM_SEND_WINDOW_HRS);
    if (!inWindow) return;

    var action = rmStudentAction_(state, log, today);
    if (!action) return;
    var msg = rmStudentMessage_(action, state, c, settings);
    out.push('[' + c.student + '] ' + msg.subject);
    if (preview) return;
    rmSend_(ss, dry, c.email, msg, {
      student: c.student, kind: action.kind, planStart: state.start,
      set: action.n, detail: today
    });
    log.push({ student: c.student, kind: action.kind, planStart: state.start,
               set: action.n, date: today, status: dry ? 'preview' : 'sent' });
  });

  // Tutor digest, once a day at the tutor's hour.
  var ttz   = settings['Tutor time zone'] || Session.getScriptTimeZone();
  var tday  = rmFmt_(now, ttz, 'yyyy-MM-dd');
  var thour = Number(rmFmt_(now, ttz, 'H'));
  var dHour = Number(settings['Tutor digest hour']);
  if (isNaN(dHour)) dHour = 7;
  var digestDue = preview || (thour >= dHour && thour < dHour + RM_SEND_WINDOW_HRS);
  var already = log.some(function (r) { return r.kind === 'digest' && r.date === tday; });
  if (digestDue && (preview || !already)) {
    var d = rmDigest_(states, settings, planErr);
    if (d) {
      out.push('[tutor] ' + d.subject);
      if (!preview && settings['Tutor email']) {
        rmSend_(ss, dry, settings['Tutor email'], d,
                { student: '', kind: 'digest', planStart: '', set: '', detail: tday });
      }
    }
  }
  return out;
}

function rmSend_(ss, dry, to, msg, meta) {
  var status = dry ? 'preview' : 'sent', detail = meta.detail;
  if (!dry) {
    try {
      if (MailApp.getRemainingDailyQuota() < 1) throw new Error('daily email quota used up');
      MailApp.sendEmail({ to: to, subject: msg.subject, body: msg.body });
    } catch (e) { status = 'error'; detail = meta.detail + ' ' + e; }
  }
  var lg = ss.getSheetByName(RM_LOG_TAB) || ss.insertSheet(RM_LOG_TAB);
  if (lg.getLastRow() === 0) lg.appendRow(RM_LOG_COLUMNS);
  lg.appendRow([new Date(), meta.student, meta.kind, meta.planStart, meta.set, to, status, detail]);
}

// ── Decisions (pure: no sheet, no mail; tested in reminders.test.js) ──

/**
 * Where a student stands today on their current plan.
 * today: 'YYYY-MM-DD' in the student's time zone.
 */
function rmStudentState_(c, plan, events, today) {
  var s = { student: c.student, name: c.name || c.student, classDay: c.classDay,
            today: today, live: false, sets: [], done: {}, lastActivity: '',
            start: '', lastDate: '', title: '', hasEmail: !!c.email, noPlan: !plan,
            watch: false };
  if (!plan || plan.classOnly || !plan.days || !plan.days.length) return s;
  var sched = rmSchedule_(plan);
  if (!sched.start) return s;
  s.start = sched.start; s.lastDate = sched.lastDate; s.title = plan.title || '';
  s.sets = sched.days;
  s.live = today >= sched.start && today <= sched.lastDate;
  // The tutor keeps hearing for a few days after the plan's last day: a week that
  // ended unopened still matters on the day before class.
  s.watch = today >= sched.start && today <= rmAddDays_(sched.lastDate, RM_DIGEST_GRACE_DAYS);

  var mine = events.filter(function (e) {
    return e.student.toLowerCase() === c.student.toLowerCase() &&
           e.date >= rmAddDays_(sched.start, -1);
  });
  var r = rmDoneSets_(sched.days, mine);
  s.done = r.done;
  s.lastActivity = r.lastActivity;
  return s;
}

/** Each set's opening date, size and length, from the plan as the hub reads it. */
function rmSchedule_(plan) {
  var start = rmDateStr_(plan.start);
  if (!start) return { start: '', days: [], lastDate: '' };
  var days = plan.days.map(function (d, i) {
    var n = Number(d.n) || (i + 1);
    var q = Number(d.count) || 0;
    if (!q && d.sections) d.sections.forEach(function (x) { q += Number(x.count) || 0; });
    if (!q && d.questionIds) q = d.questionIds.length;
    var focus = String(d.focus || '');
    return {
      n: n, date: rmAddDays_(start, n - 1), focus: focus, questions: q,
      minutes: Number(d.minutes) || 0,
      inClass: d.remind === false || /\bin class\b/i.test(focus)
    };
  });
  var last = days.reduce(function (m, d) { return d.date > m ? d.date : m; }, start);
  var through = rmDateStr_(plan.through);
  if (through && through > last) last = through;
  return { start: start, days: days, lastDate: last };
}

/**
 * Which sets are done, from the homework events.
 * A set is done when a finished (not partial) row names its day and its focus.
 * Sessions known only by an hw_ Session ID (no day) fill the lowest undone sets,
 * so a missing session row errs toward FEWER messages, never more.
 */
function rmDoneSets_(sets, events) {
  var done = {}, last = '', byDaySids = {}, anon = {};
  events.forEach(function (e) {
    if (e.date > last) last = e.date;
    if (e.day && e.sid) byDaySids[e.sid] = true;   // a named session is never anonymous
    if (e.partial) return;
    if (e.day) {
      var set = sets.filter(function (s) { return s.n === e.day; })[0];
      if (set && (!e.focus || !set.focus || rmSameFocus_(e.focus, set.focus))) done[set.n] = true;
    } else if (e.sid && /^hw_/.test(e.sid)) {
      anon[e.sid] = true;
    }
  });
  var extra = Object.keys(anon).filter(function (sid) { return !byDaySids[sid]; }).length;
  sets.slice().sort(function (a, b) { return a.n - b.n; }).forEach(function (s) {
    if (extra > 0 && !done[s.n] && !s.inClass) { done[s.n] = true; extra--; }
  });
  return { done: done, lastActivity: last };
}

function rmSameFocus_(a, b) {
  var f = function (x) {
    return String(x).replace(/^Day \d+\s*·\s*/, '').replace(/\s*—\s*INCOMPLETE.*$/, '')
      .toLowerCase().replace(/\s+/g, ' ').trim();
  };
  var x = f(a), y = f(b);
  return x === y || x.indexOf(y) === 0 || y.indexOf(x) === 0;
}

/** Sets that are open today (by date) and not done, excluding in-class sets. */
function rmWaiting_(s) {
  return s.sets.filter(function (x) {
    return x.date <= s.today && !s.done[x.n] && !x.inClass;
  });
}

/** At most one student message today: the set-open note, else a nudge. */
function rmStudentAction_(s, log, today) {
  if (!s.live) return null;
  var mine = log.filter(function (r) {
    return r.student.toLowerCase() === s.student.toLowerCase() && r.planStart === s.start;
  });
  if (mine.some(function (r) { return r.date === today && r.kind !== 'digest'; })) return null;

  var opening = s.sets.filter(function (x) {
    return x.date === today && !s.done[x.n] && !x.inClass;
  })[0];
  if (opening) return { kind: 'open', n: opening.n };

  var waiting = rmWaiting_(s);
  if (!waiting.length) return null;
  var ref = s.lastActivity && s.lastActivity > s.start ? s.lastActivity : s.start;
  if (rmDaysBetween_(ref, today) < RM_NUDGE_AFTER_DAYS) return null;
  var nudges = mine.filter(function (r) { return r.kind === 'nudge'; });
  if (nudges.length >= RM_MAX_NUDGES) return null;
  var lastNudge = nudges.reduce(function (m, r) { return r.date > m ? r.date : m; }, '');
  if (lastNudge && rmDaysBetween_(lastNudge, today) < RM_NUDGE_AFTER_DAYS) return null;
  return { kind: 'nudge', n: waiting[0].n };
}

function rmStudentMessage_(action, s, c, settings) {
  var set = s.sets.filter(function (x) { return x.n === action.n; })[0];
  var others = rmWaiting_(s).filter(function (x) { return x.n !== action.n; })
    .map(function (x) { return 'Set ' + x.n; });
  var size = set.questions ? set.questions + ' questions, ' : '';
  var time = set.minutes ? set.minutes + ' minutes on the clock'
                         : 'no clock, about ' + Math.max(5, Math.round((set.questions || 6) * 1.5)) + ' minutes';
  var hub = settings['Hub URL'] || '';
  var sign = settings['Sign-off'] || '';
  var app = settings['App name'] || 'homework';
  var lines;
  if (action.kind === 'open') {
    lines = [
      'Hi ' + s.name + ',', '',
      'Set ' + set.n + ' of this week\'s ' + app + ' homework is open' +
        (set.focus ? ': ' + set.focus : '') + '.',
      size + time + '.',
      others.length ? 'Still waiting from earlier: ' + others.join(', ') + '.' : '',
      '', 'Open it here: ' + hub, '', sign
    ];
    return { subject: 'Homework: Set ' + set.n + ' is open', body: rmJoin_(lines) };
  }
  lines = [
    'Hi ' + s.name + ',', '',
    'Set ' + set.n + (set.focus ? ' (' + set.focus + ')' : '') + ' is still waiting' +
      (others.length ? ', along with ' + others.join(', ') : '') + '.',
    size + time + '. One sitting is enough.',
    '', 'Open it here: ' + hub, '', sign
  ];
  return { subject: 'Homework: Set ' + set.n + ' is still waiting', body: rmJoin_(lines) };
}

/** One email for the tutor, or null when nobody needs attention. */
function rmDigest_(states, settings, planErr) {
  var lines = [];
  states.forEach(function (s) {
    if (!s.watch) return;
    var waiting = rmWaiting_(s);
    var undone = s.sets.filter(function (x) { return !s.done[x.n] && !x.inClass; });
    var ref = s.lastActivity && s.lastActivity > s.start ? s.lastActivity : s.start;
    var gap = rmDaysBetween_(ref, s.today);
    var reasons = [];
    if (waiting.length && gap >= RM_ALERT_AFTER_DAYS) reasons.push(gap + ' days with no homework');
    if (undone.length && s.classDay && rmWeekday_(rmAddDays_(s.today, 1)) === s.classDay) {
      reasons.push('class tomorrow, ' + undone.length + ' set' + (undone.length > 1 ? 's' : '') + ' not done');
    }
    if (!reasons.length) return;
    var doneCount = s.sets.filter(function (x) { return s.done[x.n]; }).length;
    var counted = s.sets.filter(function (x) { return !x.inClass; }).length;
    lines.push('- ' + s.student + ': ' + reasons.join('; ') + '. ' + doneCount + ' of ' +
      counted + ' sets done; last homework ' + (s.lastActivity && s.lastActivity >= s.start ?
      s.lastActivity : 'none since the plan started ' + s.start) + '.' +
      (s.hasEmail ? '' : ' (No email on file, so no reminders went to them.)'));
  });
  if (planErr) lines.push('- The plans file could not be read, so no reminders went out: ' + planErr);
  if (!lines.length) return null;
  return {
    subject: (settings['App name'] || 'Homework') + ': ' + lines.length +
             (lines.length > 1 ? ' students need' : ' student needs') + ' a follow-up',
    body: rmJoin_(['Homework follow-ups for today:', ''].concat(lines))
  };
}

// ── Reading the sheet ─────────────────────────────────────────────

function rmReadSettings_(ss) {
  var sh = ss.getSheetByName(RM_SETTINGS_TAB), out = {};
  if (!sh || sh.getLastRow() < 2) return out;
  sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().forEach(function (r) {
    var k = String(r[0] || '').trim();
    if (k) out[k] = (typeof r[1] === 'string') ? r[1].trim() : r[1];
  });
  return out;
}

function rmReadContacts_(ss, includeInactive) {
  var sh = ss.getSheetByName(RM_CONTACTS_TAB);
  if (!sh || sh.getLastRow() < 2) return [];
  var vals = sh.getDataRange().getValues(), head = vals.shift().map(String), col = {};
  head.forEach(function (h, i) { col[h.trim()] = i; });
  var get = function (r, k) { return col[k] == null ? '' : r[col[k]]; };
  return vals.map(function (r) {
    var hour = Number(get(r, 'Send hour'));
    return {
      student:  String(get(r, 'Student') || '').trim(),
      name:     String(get(r, 'Name in messages') || '').trim(),
      email:    String(get(r, 'Email') || '').trim(),
      sendHour: (get(r, 'Send hour') === '' || isNaN(hour)) ? 18 : hour,
      tz:       String(get(r, 'Time zone') || '').trim(),
      classDay: rmDayName_(get(r, 'Class day')),
      active:   /^(y|yes|true|1)$/i.test(String(get(r, 'Active')).trim())
    };
  }).filter(function (c) { return c.student && (includeInactive || c.active); });
}

function rmReadLog_(ss) {
  var sh = ss.getSheetByName(RM_LOG_TAB);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, RM_LOG_COLUMNS.length).getValues()
    .filter(function (r) { return String(r[6]) === 'sent' || String(r[6]) === 'preview'; })
    .map(function (r) {
      return { student: String(r[1] || ''), kind: String(r[2] || ''),
               planStart: rmDateStr_(r[3]), set: Number(r[4]) || '',
               date: rmDateStr_(r[7]) || String(r[7] || '').slice(0, 10), status: String(r[6]) };
    });
}

/**
 * Every homework submission the sheet holds, whatever app wrote it.
 * Reads any tab with a Student column and either a Type column (session rows:
 * PSAT "Homework", SAT "Sessions") or a Session ID column (question rows).
 */
function rmReadHomeworkEvents_(ss) {
  var tz = Session.getScriptTimeZone(), seen = {}, out = [];
  ss.getSheets().forEach(function (sh) {
    var name = sh.getName();
    if (name === RM_SETTINGS_TAB || name === RM_CONTACTS_TAB || name === RM_LOG_TAB) return;
    if (sh.getLastRow() < 2 || sh.getLastColumn() < 2) return;
    var vals = sh.getDataRange().getValues();
    rmEventsFromRows_(vals, tz).forEach(function (e) {
      var key = e.sid ? 'sid:' + e.sid + (e.day ? ':' + e.day : '')
                      : e.student + '|' + e.at + '|' + e.day;
      if (seen[key]) return;
      seen[key] = true;
      out.push(e);
    });
  });
  return out;
}

function rmEventsFromRows_(vals, tz) {
  var head = vals[0].map(function (h) { return String(h).trim(); });
  var ix = function (k) { return head.indexOf(k); };
  var cStu = ix('Student'), cType = ix('Type'), cSid = ix('Session ID');
  var cAt = ix('Logged at') >= 0 ? ix('Logged at') : ix('Timestamp');
  var cAid = ix('Assignment ID'), cAsg = ix('Assignment'), cFocus = ix('Day / Focus / Skills');
  var cRaw = ix('Raw payload');
  if (cStu < 0 || cAt < 0 || (cType < 0 && cSid < 0)) return [];
  var out = [];
  for (var i = 1; i < vals.length; i++) {
    var r = vals[i];
    var student = String(r[cStu] || '').trim();
    var at = r[cAt];
    if (!student || at === '' || at == null) continue;
    var date = rmDateOf_(at, tz);
    if (!date) continue;
    var sid = cSid >= 0 ? String(r[cSid] || '').trim() : '';
    var type = cType >= 0 ? String(r[cType] || '').trim().toLowerCase() : '';
    if (cType >= 0 && type !== 'homework') continue;
    if (cType < 0 && !/^hw_/.test(sid)) continue;   // question rows: homework sessions only

    var focusCell = cFocus >= 0 ? String(r[cFocus] || '') : (cAsg >= 0 ? String(r[cAsg] || '') : '');
    var day = 0, m;
    if (cAid >= 0 && (m = String(r[cAid] || '').match(/^day-(\d+)$/))) day = Number(m[1]);
    if (!day && (m = focusCell.match(/^Day (\d+)\b/))) day = Number(m[1]);
    var partial = /_partial$/.test(sid) || /INCOMPLETE/.test(focusCell);
    if (cRaw >= 0 && r[cRaw]) {
      try { var p = JSON.parse(r[cRaw]); if (p.partial) partial = true; if (!day && p.day) day = Number(p.day); }
      catch (e) {}
    }
    out.push({ student: student, date: date, at: String(at), day: day,
               focus: focusCell, partial: partial, sid: sid });
  }
  return out;
}

/** The plans file the hub itself reads, evaluated the way the hub evaluates it. */
function rmFetchPlans_(url) {
  if (!url) throw new Error('no Plans URL in Reminder Settings');
  var cache = CacheService.getScriptCache();
  var src = cache.get('rm_plans_src');
  if (!src) {
    var res = UrlFetchApp.fetch(url + (url.indexOf('?') < 0 ? '?' : '&') + 't=' + Date.now(),
                                { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) throw new Error('plans file HTTP ' + res.getResponseCode());
    src = res.getContentText();
    if (src.length < 90000) cache.put('rm_plans_src', src, 900);
  }
  return rmEvalPlans_(src);
}

function rmEvalPlans_(src) {
  // The file is written for a browser. Give it an empty window and nothing else,
  // so its top-level browser hooks are harmless and only HOMEWORK comes back.
  var plans = new Function('window', 'document', 'localStorage',
    src + '\n;return (typeof HOMEWORK !== "undefined") ? HOMEWORK : {};')({}, undefined, undefined);
  return plans || {};
}

function rmPlanFor_(plans, student) {
  var key = Object.keys(plans).filter(function (k) {
    return k.toLowerCase() === student.toLowerCase();
  })[0];
  return key ? plans[key] : null;
}

// ── Dates (strings 'YYYY-MM-DD' throughout; no time-zone drift) ──

function rmFmt_(date, tz, pattern) { return Utilities.formatDate(date, tz, pattern); }

function rmDateOf_(v, tz) {
  if (v instanceof Date) return isNaN(v) ? '' : rmFmt_(v, tz, 'yyyy-MM-dd');
  var s = String(v).trim(), m;
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) return m[1] + '-' + m[2] + '-' + m[3];
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/))) {
    return m[3] + '-' + ('0' + m[1]).slice(-2) + '-' + ('0' + m[2]).slice(-2);
  }
  var d = new Date(s);
  return isNaN(d) ? '' : rmFmt_(d, tz, 'yyyy-MM-dd');
}

function rmDateStr_(v) {
  if (!v) return '';
  if (v instanceof Date) {
    return v.getFullYear() + '-' + ('0' + (v.getMonth() + 1)).slice(-2) + '-' + ('0' + v.getDate()).slice(-2);
  }
  var m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[1] + '-' + m[2] + '-' + m[3] : '';
}

function rmAddDays_(s, k) {
  var p = s.split('-').map(Number);
  var d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + k));
  return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2);
}

function rmDaysBetween_(a, b) {
  var pa = a.split('-').map(Number), pb = b.split('-').map(Number);
  return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / 86400000);
}

var RM_DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function rmWeekday_(s) {
  var p = s.split('-').map(Number);
  return RM_DAYS[new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay()];
}

function rmDayName_(v) {
  var k = String(v || '').trim().toLowerCase().slice(0, 3);
  return RM_DAYS.indexOf(k) >= 0 ? k : '';
}

function rmJoin_(lines) {
  return lines.filter(function (l, i) {
    return l !== '' || (i > 0 && lines[i - 1] !== '');   // drop empty filler lines
  }).join('\n').trim();
}
```
