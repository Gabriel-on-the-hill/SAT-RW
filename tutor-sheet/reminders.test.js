// ─────────────────────────────────────────────────────────────────
// reminders.test.js — homework reminders, the sheet-side script.
//
//   node tutor-sheet/reminders.test.js
//
// No network, no Google account. The code under test is EXTRACTED FROM
// reminders.md, so what you paste into the Apps Script editor is exactly what
// these assertions ran against. The same reminders.md lives in both apps
// (PSAT 8/9 and SAT R&W): change one, change both, run both copies of this file.
// ─────────────────────────────────────────────────────────────────
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const md = fs.readFileSync(path.join(__dirname, 'reminders.md'), 'utf8');
const m = md.match(/```javascript\r?\n([\s\S]*?)```/);
if (!m) { console.error('no javascript block in reminders.md'); process.exit(1); }
const CODE = m[1];

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; } else { fail++; console.error('FAIL ' + name); }
}
function eq(a, b, name) {
  const A = JSON.stringify(a), B = JSON.stringify(b);
  ok(A === B, name + (A === B ? '' : `\n   got ${A}\n  want ${B}`));
}

// ── A tiny Apps Script ────────────────────────────────────────────
function makeSheet(name, rows) {
  rows = rows || [];
  return {
    rows, getName: () => name,
    getLastRow: () => rows.length,
    getLastColumn: () => rows.reduce((mx, r) => Math.max(mx, r.length), 0),
    getDataRange: () => ({ getValues: () => rows.map(r => r.slice()) }),
    getRange: (a, b, nr, nc) => {
      if (typeof a === 'string') return { setNumberFormat() {} };
      return { getValues: () => rows.slice(a - 1, a - 1 + nr).map(r => {
        const o = []; for (let j = 0; j < nc; j++) o.push(r[b - 1 + j] === undefined ? '' : r[b - 1 + j]); return o; }) };
    },
    appendRow: r => rows.push(r.slice()),
    setFrozenRows() {}
  };
}
function fmt(d, tz, p) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric',
    month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(d).map(x => [x.type, x.value]));
  if (p === 'yyyy-MM-dd') return `${parts.year}-${parts.month}-${parts.day}`;
  if (p === 'H') return String(+parts.hour);
  throw new Error('fmt ' + p);
}
function makeEnv(tabs, plansSrc, opts) {
  opts = opts || {};
  const sheets = Object.entries(tabs || {}).map(([n, r]) => makeSheet(n, r));
  const ss = {
    getSheetByName: n => sheets.find(s => s.getName() === n) || null,
    insertSheet: n => { const s = makeSheet(n, []); sheets.push(s); return s; },
    getSheets: () => sheets
  };
  const sent = [], triggers = [];
  const ctx = {
    SpreadsheetApp: { getActiveSpreadsheet: () => ss },
    Session: { getScriptTimeZone: () => 'Africa/Lagos', getEffectiveUser: () => ({ getEmail: () => 'tutor@example.com' }) },
    Utilities: { formatDate: fmt },
    MailApp: {
      getRemainingDailyQuota: () => (opts.quota === undefined ? 100 : opts.quota),
      sendEmail: msg => { if (opts.mailThrows) throw new Error('mail down'); sent.push(msg); }
    },
    UrlFetchApp: { fetch: () => ({ getResponseCode: () => (opts.http || 200), getContentText: () => plansSrc }) },
    CacheService: { getScriptCache: () => ({ get: () => null, put() {} }) },
    ScriptApp: {
      getProjectTriggers: () => triggers.slice(),
      deleteTrigger: t => triggers.splice(triggers.indexOf(t), 1),
      newTrigger: fn => ({ timeBased: () => ({ everyHours: () => ({ create: () => triggers.push({ getHandlerFunction: () => fn }) }) }) })
    },
    Logger: { log() {} }, Date
  };
  vm.createContext(ctx);
  vm.runInContext(CODE, ctx);
  return { ctx, ss, sent, triggers, tab: n => ss.getSheetByName(n) };
}

// A plans file shaped like the real ones: browser hooks at top level, unguarded.
function plansFile(plans) {
  return '// plans\nconst HOMEWORK = ' + JSON.stringify(plans) + ';\n' +
    'function hwDayOpen(){ return localStorage.getItem("x"); }\n' +
    'window.HOMEWORK = HOMEWORK;\n';
}
const SETTINGS = [['Setting', 'Value'], ['App name', 'SAT Reading and Writing'],
  ['Plans URL', 'https://example.com/homework/assignments.js'], ['Hub URL', 'https://example.com/homework-hub.html'],
  ['Tutor email', 'tutor@example.com'], ['Tutor time zone', 'Africa/Lagos'], ['Tutor digest hour', 7],
  ['Sign-off', 'Your tutor'], ['Mode', 'live']];
const CONTACT_HEAD = ['Student', 'Name in messages', 'Email', 'Send hour', 'Time zone', 'Class day', 'Active', 'Notes'];
const LOG_HEAD = ['Sent at', 'Student', 'Kind', 'Plan start', 'Set', 'To', 'Status', 'Detail'];
const lagos = (d, h) => new Date(Date.parse(d + 'T00:00:00Z') + (h - 1) * 3600e3);   // Lagos = UTC+1

const PLAN = {
  title: 'Three short sets', start: '2026-10-05', through: '2026-10-08', unlock: 'cumulative',
  days: [
    { n: 1, focus: 'Prove the claim — no clock', sections: [{ count: 3 }, { count: 2 }] },
    { n: 2, focus: 'Grammar, one sitting', count: 6 },
    { n: 3, focus: 'Mixed at real pace', count: 6, minutes: 7 }
  ]
};

// ── 1. Schedule ───────────────────────────────────────────────────
{
  const { ctx } = makeEnv();
  const s = ctx.rmSchedule_(PLAN);
  eq(s.days.map(d => [d.n, d.date, d.questions, d.minutes]),
     [[1, '2026-10-05', 5, 0], [2, '2026-10-06', 6, 0], [3, '2026-10-07', 6, 7]], 'schedule: one set a day from start, sizes from sections');
  eq(s.lastDate, '2026-10-08', 'schedule: through extends the window');
  const c = ctx.rmSchedule_({ start: '2026-09-28', days: [{ n: 1, focus: 'In class — one test module' }, { n: 2, focus: 'Mixed' }, { n: 3, focus: 'x', remind: false }] });
  eq(c.days.map(d => d.inClass), [true, false, true], 'schedule: in-class and remind:false days are never messaged');
  eq(ctx.rmAddDays_('2026-10-31', 1), '2026-11-01', 'dates: month rollover');
  eq(ctx.rmDaysBetween_('2026-10-05', '2026-10-08'), 3, 'dates: days between');
  eq(ctx.rmWeekday_('2026-10-12'), 'mon', 'dates: weekday');
}

// ── 2. Which sets are done ────────────────────────────────────────
{
  const { ctx } = makeEnv();
  const sets = ctx.rmSchedule_(PLAN).days;
  const ev = (o) => Object.assign({ student: 'A', date: '2026-10-06', day: 0, focus: '', partial: false, sid: '' }, o);
  let r = ctx.rmDoneSets_(sets, [ev({ day: 1, focus: 'Day 1 · Prove the claim — no clock' })]);
  eq(Object.keys(r.done), ['1'], 'done: PSAT-style focus cell matches its set');
  r = ctx.rmDoneSets_(sets, [ev({ day: 1, focus: 'Day 1 · Prove the claim — no clock — INCOMPLETE (2 of 5 answered)', partial: true })]);
  eq(Object.keys(r.done), [], 'done: a partial sitting is activity, not completion');
  eq(r.lastActivity, '2026-10-06', 'done: a partial sitting still counts as activity');
  r = ctx.rmDoneSets_(sets, [ev({ day: 2, focus: 'Some other week\'s day 2' })]);
  eq(Object.keys(r.done), [], 'done: same day number from a different plan does not count');
  r = ctx.rmDoneSets_(sets, [ev({ sid: 'hw_aaa' }), ev({ sid: 'hw_bbb_partial', partial: true })]);
  eq(Object.keys(r.done), ['1'], 'done: an unnamed finished hw_ session fills the lowest undone set');
  r = ctx.rmDoneSets_(sets, [ev({ sid: 'hw_ccc', day: 2, focus: 'Old focus' }), ev({ sid: 'hw_ccc' })]);
  eq(Object.keys(r.done), [], 'done: a session named elsewhere is never also counted as anonymous');
}

// ── 3. What the student gets today ───────────────────────────────
{
  const { ctx } = makeEnv();
  const st = (today, events) => ctx.rmStudentState_({ student: 'A', email: 'a@x' }, PLAN, events || [], today);
  const L = (o) => Object.assign({ student: 'A', planStart: '2026-10-05', set: 1, status: 'sent' }, o);
  eq(ctx.rmStudentAction_(st('2026-10-05'), [], '2026-10-05'), { kind: 'open', n: 1 }, 'action: set-open on its day');
  eq(ctx.rmStudentAction_(st('2026-10-05'), [L({ kind: 'open', date: '2026-10-05' })], '2026-10-05'), null, 'action: one message a day');
  eq(ctx.rmStudentAction_(st('2026-10-04'), [], '2026-10-04'), null, 'action: nothing before the plan starts');
  eq(ctx.rmStudentAction_(st('2026-10-09'), [], '2026-10-09'), null, 'action: nothing after the plan ends');
  const done2 = [{ student: 'A', date: '2026-10-06', day: 2, focus: 'Grammar, one sitting', partial: false, sid: '' }];
  eq(ctx.rmStudentAction_(st('2026-10-06', done2), [], '2026-10-06'), null, 'action: no open note for a set already done');
  eq(ctx.rmStudentAction_(st('2026-10-08'), [], '2026-10-08'), { kind: 'nudge', n: 1 }, 'action: nudge after two quiet days');
  const act = [{ student: 'A', date: '2026-10-07', day: 0, focus: '', partial: true, sid: '' }];
  eq(ctx.rmStudentAction_(st('2026-10-08', act), [], '2026-10-08'), null, 'action: recent activity holds the nudge');
  const twoNudges = [L({ kind: 'nudge', date: '2026-10-01' }), L({ kind: 'nudge', date: '2026-10-03' })];
  eq(ctx.rmStudentAction_(st('2026-10-08'), twoNudges, '2026-10-08'), null, 'action: at most two nudges a plan');
  eq(ctx.rmStudentAction_(st('2026-10-08'), [L({ kind: 'nudge', date: '2026-10-07' })], '2026-10-08'), null, 'action: nudges are spaced');
  const none = ctx.rmStudentState_({ student: 'A', email: 'a@x' }, { classOnly: true, start: '2026-10-05', days: [] }, [], '2026-10-06');
  eq(ctx.rmStudentAction_(none, [], '2026-10-06'), null, 'action: a class-only plan sends nothing');

  const msg = ctx.rmStudentMessage_({ kind: 'open', n: 3 }, st('2026-10-07'), {}, { 'Hub URL': 'H', 'Sign-off': 'S', 'App name': 'SAT' });
  ok(/Set 3/.test(msg.subject) && /7 minutes on the clock/.test(msg.body) && /Still waiting from earlier: Set 1, Set 2/.test(msg.body) && /H/.test(msg.body),
     'message: open note names the set, its clock, what is still waiting, and the link');
  const nmsg = ctx.rmStudentMessage_({ kind: 'nudge', n: 1 }, st('2026-10-08'), {}, { 'Hub URL': 'H' });
  ok(/still waiting/.test(nmsg.subject) && /5 questions, no clock, about 8 minutes/.test(nmsg.body), 'message: nudge gives size and time');
}

// ── 4. The tutor digest ───────────────────────────────────────────
{
  const { ctx } = makeEnv();
  const st = (today, c) => ctx.rmStudentState_(Object.assign({ student: 'A', email: 'a@x' }, c || {}), PLAN, [], today);
  eq(ctx.rmDigest_([st('2026-10-07')], {}, ''), null, 'digest: quiet until three days');
  const d = ctx.rmDigest_([st('2026-10-08')], { 'App name': 'SAT' }, '');
  ok(d && /A: 3 days with no homework/.test(d.body) && /0 of 3 sets done/.test(d.body), 'digest: three quiet days flags the student');
  const t = ctx.rmDigest_([st('2026-10-06', { classDay: 'wed' })], {}, '');
  ok(t && /class tomorrow, 3 sets not done/.test(t.body), 'digest: class tomorrow with sets undone');
  ok(ctx.rmDigest_([st('2026-10-11')], {}, '') !== null, 'digest: keeps watching for three days after the plan ends');
  eq(ctx.rmDigest_([st('2026-10-12')], {}, ''), null, 'digest: then stops');
  const e = ctx.rmDigest_([], {}, 'plans file HTTP 404');
  ok(e && /could not be read/.test(e.body), 'digest: tells the tutor when the plans file fails');
  const ne = ctx.rmDigest_([ctx.rmStudentState_({ student: 'B', email: '' }, PLAN, [], '2026-10-08')], {}, '');
  ok(ne && /No email on file/.test(ne.body), 'digest: flags a student with no email');
}

// ── 5. Reading both apps' sheets ─────────────────────────────────
{
  const { ctx } = makeEnv();
  const psat = [['Logged at', 'Student', 'Type', 'Day / Focus / Skills', 'Score', 'Total', 'Seconds', 'Raw payload'],
    [lagos('2026-10-06', 21), 'Pat', 'homework', 'Day 2 · Grammar, one sitting', 5, 6, 400, '{"day":2}'],
    [lagos('2026-10-06', 20), 'Pat', 'homework', 'Day 1 · Prove the claim — no clock — INCOMPLETE (1 of 5 answered)', 1, 1, 90, '{"partial":true}'],
    [lagos('2026-10-06', 22), 'Pat', 'practice', 'Boundaries', 3, 5, 200, '{}']];
  const ev = ctx.rmEventsFromRows_(psat, 'Africa/Lagos');
  eq(ev.map(e => [e.day, e.partial, e.date]), [[2, false, '2026-10-06'], [1, true, '2026-10-06']], 'read: PSAT Homework tab, practice rows ignored');
  const sat = [['Timestamp', 'Student', 'Subject', 'App', 'Type', 'Assignment ID', 'Assignment', 'Session ID'],
    [lagos('2026-10-06', 19), 'Kim', 'R&W', 'x', 'homework', 'day-1', 'Prove the claim — no clock', 'hw_x1'],
    [lagos('2026-10-06', 19), 'Kim', 'R&W', 'x', 'challenge', 'p8', 'y', 'rw_x2']];
  eq(ctx.rmEventsFromRows_(sat, 'Africa/Lagos').map(e => [e.day, e.sid]), [[1, 'hw_x1']], 'read: SAT Sessions tab by Assignment ID');
  const q = [['Timestamp', 'Student', 'Subject', 'Session ID', '#', 'Question ID'],
    [lagos('2026-10-06', 19), 'Kim', 'R&W', 'hw_x1', 1, 'a'], [lagos('2026-10-06', 19), 'Kim', 'R&W', 'rw_x9', 1, 'b'],
    [lagos('2026-10-07', 19), 'Kim', 'R&W', 'hw_x3_partial', 1, 'c']];
  eq(ctx.rmEventsFromRows_(q, 'Africa/Lagos').map(e => [e.sid, e.partial]), [['hw_x1', false], ['hw_x3_partial', true]], 'read: SAT Questions tab, homework sessions only');
  eq(ctx.rmEventsFromRows_([['Timestamp', 'Student', 'Event']], 'Africa/Lagos'), [], 'read: unrelated tabs are skipped');
  const plans = ctx.rmEvalPlans_(plansFile({ A: PLAN }));
  eq(Object.keys(plans), ['A'], 'read: plans file evaluates despite unguarded browser hooks');
}

// ── 6. End to end ─────────────────────────────────────────────────
function world(opts) {
  return makeEnv({
    'Reminder Settings': SETTINGS.map(r => r.slice()),
    'Reminder Contacts': [CONTACT_HEAD, ['A', 'Friend', 'a@example.com', 18, 'Africa/Lagos', '', 'Y', ''],
                          ['B', '', 'b@example.com', 18, 'Africa/Lagos', '', 'N', '']],
    'Reminder Log': [LOG_HEAD],
    'Sessions': [['Timestamp', 'Student', 'Type', 'Assignment ID', 'Assignment', 'Session ID']]
  }, plansFile({ A: PLAN, B: PLAN }), opts);
}
{
  const w = world();
  w.ctx.runReminders.call(null);   // whatever "now" is: must not throw
  const out = w.ctx.rmRun_(lagos('2026-10-05', 17), false);
  eq(out, [], 'run: nothing before the send hour');
  w.ctx.rmRun_(lagos('2026-10-05', 18), false);
  eq(w.sent.map(s => [s.to, s.subject]), [['a@example.com', 'Homework: Set 1 is open']], 'run: open note at the hour, inactive students skipped');
  ok(/^Hi Friend,/.test(w.sent[0].body), 'run: uses the name in messages');
  w.ctx.rmRun_(lagos('2026-10-05', 19), false);
  eq(w.sent.length, 1, 'run: the next hourly run does not repeat it');
  eq(w.tab('Reminder Log').rows.length, 2, 'run: every send is logged');
  w.ctx.rmRun_(lagos('2026-10-08', 7), false);
  ok(w.sent.some(s => s.to === 'tutor@example.com'), 'run: digest at the tutor hour');
  const before = w.sent.length;
  w.ctx.rmRun_(lagos('2026-10-08', 8), false);
  eq(w.sent.length, before, 'run: one digest a day');
}
{
  const w = world({ mailThrows: true });
  w.ctx.rmRun_(lagos('2026-10-05', 18), false);
  const row = w.tab('Reminder Log').rows[1];
  eq(row[6], 'error', 'run: a failed send is logged as an error');
  eq(w.ctx.rmReadLog_(w.ss).length, 0, 'run: an error does not count as sent, so the next run retries');
}
{
  const w = world();
  w.tab('Reminder Settings').rows.find(r => r[0] === 'Mode')[1] = 'off';
  eq(w.ctx.rmRun_(lagos('2026-10-05', 18), false), [], 'mode off: nothing runs');
  w.tab('Reminder Settings').rows.find(r => r[0] === 'Mode')[1] = 'preview';
  w.ctx.rmRun_(lagos('2026-10-05', 18), false);
  eq(w.sent.length, 0, 'mode preview: logs but sends nothing');
  eq(w.tab('Reminder Log').rows[1][6], 'preview', 'mode preview: logged as preview');
}
{
  const w = world();
  const out = w.ctx.previewReminders();
  eq(w.sent.length, 0, 'previewReminders: sends nothing');
  eq(w.tab('Reminder Log').rows.length, 1, 'previewReminders: logs nothing');
  ok(Array.isArray(out), 'previewReminders: returns what would go out');
}
{
  const w = world({ http: 404 });
  w.ctx.rmRun_(lagos('2026-10-05', 18), false);
  eq(w.sent.length, 0, 'plans unreadable: no student messages');
  w.ctx.rmRun_(lagos('2026-10-06', 7), false);
  ok(w.sent.some(s => /could not be read/.test(s.body)), 'plans unreadable: the tutor is told');
}
{
  const w = makeEnv({ 'Reminder Settings': [['Setting', 'Value'], ['Sign-off', 'Keep me']] }, plansFile({ A: PLAN, A_cleared_2026: PLAN }));
  w.ctx.setupRemindersSAT();
  const s = Object.fromEntries(w.tab('Reminder Settings').rows.slice(1));
  eq(s['Sign-off'], 'Keep me', 'setup: never overwrites a setting');
  ok(/SAT-RW/.test(s['Plans URL']) && s['Tutor email'] === 'tutor@example.com', 'setup: fills the SAT preset and tutor email');
  eq(w.tab('Reminder Contacts').rows.map(r => r[0]), ['Student', 'A'], 'setup: lists plan students, skips archived keys');
  eq(w.tab('Reminder Contacts').rows[1][6], 'N', 'setup: new students start inactive');
  eq(w.triggers.length, 1, 'setup: one hourly trigger');
  w.ctx.setupRemindersSAT();
  eq(w.triggers.length, 1, 'setup: re-running does not stack triggers');
  eq(w.tab('Reminder Contacts').rows.length, 2, 'setup: re-running does not duplicate students');
  w.ctx.stopReminders();
  eq(w.triggers.length, 0, 'stopReminders: removes the trigger');
}

console.log(`reminders: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
