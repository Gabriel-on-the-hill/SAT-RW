// ─────────────────────────────────────────────────────────────────
// apps-script.test.js — runs both Apps Scripts against an in-memory Sheet.
//
//   node tutor-sheet/apps-script.test.js
//
// The code under test is EXTRACTED FROM THE MARKDOWN, so what you paste into
// the Apps Script editor is exactly what these assertions ran against. The
// payloads come from fixtures.json, captured from the running apps.
//
// No jsdom, no network, no Google account. This is the only way to test an
// Apps Script without deploying it, and it catches the class of bug that
// broke the Math dashboard: a column read by the wrong name or position.
// ─────────────────────────────────────────────────────────────────
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const HERE = __dirname;
const FIX = JSON.parse(fs.readFileSync(path.join(HERE, 'fixtures.json'), 'utf8'));

/** The first ```javascript block in the markdown IS the script. */
function extract(mdName) {
    const md = fs.readFileSync(path.join(HERE, mdName), 'utf8');
    const m = md.match(/```javascript\n([\s\S]*?)```/);
    if (!m) throw new Error('no javascript block in ' + mdName);
    return m[1];
}

// ══════════════════════════════════════════════════════════════════
// A very small, honest Google Sheets
// ══════════════════════════════════════════════════════════════════
const CHAIN = ['setFontWeight', 'setBackground', 'setNumberFormat', 'setHorizontalAlignment',
    'setFontSize', 'setFontColor', 'setFontStyle', 'setDataValidation', 'merge', 'setFormula'];

function makeSheet(name, seed) {
    const rows = seed ? seed.map(r => r.slice()) : [];
    const pad = (r, n) => { while (r.length < n) r.push(''); return r; };

    function range(row, col, nr, nc) {
        if (typeof row === 'string') return dummyRange();          // A1 notation → not asserted on
        nr = nr || 1; nc = nc || 1;
        const r = {
            getValues() {
                const out = [];
                for (let i = 0; i < nr; i++) {
                    const src = rows[row - 1 + i] || [];
                    const line = [];
                    for (let j = 0; j < nc; j++) line.push(src[col - 1 + j] === undefined ? '' : src[col - 1 + j]);
                    out.push(line);
                }
                return out;
            },
            setValues(vals) {
                for (let i = 0; i < vals.length; i++) {
                    while (rows.length < row - 1 + i + 1) rows.push([]);
                    const target = rows[row - 1 + i];
                    pad(target, col - 1);
                    for (let j = 0; j < vals[i].length; j++) target[col - 1 + j] = vals[i][j];
                }
                return r;
            },
            setValue(v) { return r.setValues([[v]]); },
        };
        CHAIN.forEach(k => { if (!r[k]) r[k] = () => r; });
        return r;
    }
    function dummyRange() { const d = { getValues: () => [['']], setValues: () => d, setValue: () => d }; CHAIN.forEach(k => (d[k] = () => d)); return d; }

    return {
        _name: name, _rows: rows,
        getName: () => name,
        getRange: range,
        getLastRow: () => rows.length,
        getLastColumn: () => rows.reduce((m, r) => Math.max(m, r.length), 0),
        getDataRange() { return range(1, 1, Math.max(rows.length, 1), Math.max(this.getLastColumn(), 1)); },
        appendRow(arr) { rows.push(arr.slice()); },
        clear() { rows.length = 0; },
        setFrozenRows() {}, setColumnWidth() {}, setRowHeight() {}, hideColumns() {},
        setHiddenGridlines() {}, clearConditionalFormatRules() {},
        getConditionalFormatRules: () => [], setConditionalFormatRules() {},
    };
}

function makeCtx(code, seedTabs) {
    const tabs = new Map();
    for (const [n, seed] of Object.entries(seedTabs || {})) tabs.set(n, makeSheet(n, seed));
    const ss = {
        getSheetByName: n => tabs.get(n) || null,
        insertSheet: n => { const s = makeSheet(n); tabs.set(n, s); return s; },
        deleteSheet: s => tabs.delete(s._name),
        setActiveSheet() {}, moveActiveSheet() {},
    };
    const builder = () => { const b = new Proxy({}, { get: (_, k) => (k === 'build' ? () => ({}) : () => b) }); return b; };
    const ctx = {
        console,
        SpreadsheetApp: {
            getActiveSpreadsheet: () => ss,
            newConditionalFormatRule: builder,
            newDataValidation: builder,
            getUi: () => { throw new Error('no ui'); },
        },
        ContentService: {
            MimeType: { JSON: 'json' },
            createTextOutput: s => ({ _s: s, setMimeType() { return this; }, getContent() { return this._s; } }),
        },
        LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
        Date, Math, JSON, String, Number, Array, Object, isNaN,
    };
    vm.createContext(ctx);
    vm.runInContext(code, ctx, { filename: 'apps-script' });
    ctx.__tabs = tabs;
    ctx.__post = body => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(body) } }).getContent());
    ctx.__rows = name => (tabs.get(name) || { _rows: [] })._rows;
    ctx.__byName = (name, rowIdx) => {
        const rows = ctx.__rows(name);
        const h = rows[0] || [];
        const r = rows[rowIdx] || [];
        const o = {};
        h.forEach((k, i) => (o[k] = r[i] === undefined ? '' : r[i]));
        return o;
    };
    return ctx;
}

// ══════════════════════════════════════════════════════════════════
let pass = 0, fail = 0; const fails = [];
const ok = (n, c, d) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; fails.push(n); console.log('  ✗ ' + n + (d ? ' — ' + d : '')); } };
const eq = (n, a, b) => ok(n, a === b, 'got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b));
const sec = t => console.log('\n' + t);

const RW = extract('rw-apps-script.md');
const MA = extract('math-apps-script.md');

// ══════════════════════════════════════════════════════════════════
sec('1 · The two sheets share one schema');
{
    const a = makeCtx(RW), b = makeCtx(MA);
    eq('same 16 canonical columns', JSON.stringify(a.SESSION_COLUMNS), JSON.stringify(b.SESSION_COLUMNS));
    eq('same Questions columns', JSON.stringify(a.QUESTION_COLUMNS), JSON.stringify(b.QUESTION_COLUMNS));
    ok('Session ID is in the schema', a.SESSION_COLUMNS.indexOf('Session ID') >= 0);
    ok('Focus Losses is in the schema', a.SESSION_COLUMNS.indexOf('Focus Losses') >= 0);
}

// ══════════════════════════════════════════════════════════════════
sec('2 · R&W: a real challenge session lands whole');
{
    const c = makeCtx(RW);
    const p = FIX.rw_challenge;
    const res = c.__post(p);
    ok('accepted', res.ok === true);
    eq('questions written', res.questions, p.questions.length);

    const row = c.__byName('Sessions', 1);
    eq('Student', row['Student'], 'Jeffrey');
    eq('Subject', row['Subject'], 'R&W');
    eq('Type', row['Type'], 'challenge');
    eq('Assignment ID survives', row['Assignment ID'], 'p8-rw');
    eq('Assignment title survives', row['Assignment'], 'Practice 8 misses');
    eq('Score', row['Score'], p.score);
    eq('Max', row['Max'], p.total);
    eq('Percent is a fraction, not a string', row['Percent'], p.score / p.total);
    eq('Session ID stored', row['Session ID'], p.sessionId);
    eq('Focus Losses kept as a number, not blanked', row['Focus Losses'], 0);
    ok('Breakdown is the skillStats JSON', /"correct"/.test(row['Breakdown']));
    ok('Skills listed', row['Skills'].length > 0);

    const q = c.__byName('Questions', 1);
    eq('question joins on Session ID', q['Session ID'], p.sessionId);
    eq('question #', q['#'], 1);
    eq('Question ID', q['Question ID'], p.questions[0].id);
    eq('Chosen', q['Chosen'], p.questions[0].chosen);
    eq('Correct', q['Correct'], p.questions[0].correct);
    eq('Right is a boolean', q['Right'], p.questions[0].isCorrect);
    eq('Trap captured', q['Trap'], p.questions[0].trap);
    eq('one row per question', c.__rows('Questions').length - 1, p.questions.length);
}

// ══════════════════════════════════════════════════════════════════
sec('3 · R&W: a re-POST is a no-op, not a duplicate');
{
    const c = makeCtx(RW);
    c.__post(FIX.rw_challenge);
    const again = c.__post(FIX.rw_challenge);
    ok('reported as duplicate', again.duplicate === true);
    eq('still one session row', c.__rows('Sessions').length - 1, 1);
    eq('still one set of question rows', c.__rows('Questions').length - 1, FIX.rw_challenge.questions.length);

    c.__post(FIX.rw_practice);
    eq('a different session still appends', c.__rows('Sessions').length - 1, 2);
    eq('and its questions too', c.__rows('Questions').length - 1,
        FIX.rw_challenge.questions.length + FIX.rw_practice.questions.length);
}

// ══════════════════════════════════════════════════════════════════
sec('4 · R&W: the homework runner posts a different shape and still lands');
{
    // Guard: the fixture must still match what homework-run.html actually sends.
    const src = fs.readFileSync(path.join(HERE, '..', 'homework-run.html'), 'utf8');
    const lit = src.match(/body:JSON\.stringify\(\{type:'homework'[\s\S]*?\)\}\)/);
    const keys = [...lit[0].matchAll(/([a-zA-Z]+)\s*:/g)].map(m => m[1])
        .filter(k => !['body', 'JSON', 'stringify', 'toISOString', 'toString', 'slice', 'now', 'random'].includes(k));
    ok('fixture keys match homework-run.html', keys.every(k => k in FIX.rw_homework), keys.join(','));

    const c = makeCtx(RW);
    const res = c.__post(FIX.rw_homework);
    ok('accepted', res.ok === true);
    const row = c.__byName('Sessions', 1);
    eq('Student', row['Student'], 'Segun');
    eq('Type', row['Type'], 'homework');
    eq('day becomes an Assignment ID', row['Assignment ID'], 'day-2');
    eq('focus becomes the Assignment', row['Assignment'], 'Transitions, at pace');
    eq('seconds become Duration', row['Duration (sec)'], 431);
    eq('Avg/Q derived', row['Avg/Q (sec)'], Math.round(431 / 10));
    eq('Percent computed', row['Percent'], 0.7);
    ok('no question rows (homework does not send them)', !c.__tabs.has('Questions') || c.__rows('Questions').length <= 1);
}

// ══════════════════════════════════════════════════════════════════
sec('5 · R&W: migrating a v1 sheet keeps every old value where it was');
{
    const legacy = [
        ['Timestamp', 'Student', 'Type', 'Assignment', 'Score', 'Total', '%', 'Skills', 'Difficulties', 'Mode', 'Duration (sec)', 'Avg/Q (sec)', 'Skill Stats'],
        ['2026-07-01', 'Bruce', 'practice', '', 8, 10, 80, 'Inferences', 'Hard', 'assisted', 300, 30, '{}'],
    ];
    const c = makeCtx(RW, { Sessions: legacy });
    c.__post(FIX.rw_challenge);

    const h = c.__rows('Sessions')[0];
    ok("'Total' renamed to 'Max' in place", h[5] === 'Max', h.join('|'));
    ok("'%' renamed to 'Percent' in place", h[6] === 'Percent');
    ok("'Skill Stats' renamed to 'Breakdown'", h[12] === 'Breakdown');
    ok('new columns appended on the right', h.indexOf('Session ID') > 12);

    const old = c.__byName('Sessions', 1);
    eq('old row keeps its student', old['Student'], 'Bruce');
    eq("old row's Total is now read as Max, same cell", old['Max'], 10);
    eq('old row untouched at Score', old['Score'], 8);

    const fresh = c.__byName('Sessions', 2);
    eq('new row lands in the renamed columns', fresh['Max'], FIX.rw_challenge.total);
    eq('and fills the new ones', fresh['Session ID'], FIX.rw_challenge.sessionId);
}

// ══════════════════════════════════════════════════════════════════
sec('6 · R&W: setup() never destroys data  (v1 called sheet.clear())');
{
    const seeded = [['Timestamp', 'Student'], ['2026-07-01', 'Bruce'], ['2026-07-02', 'Gabe']];
    const c = makeCtx(RW, { Sessions: seeded });
    c.setup();
    eq('rows survive setup', c.__rows('Sessions').length, 3);
    eq('Bruce still there', c.__byName('Sessions', 1)['Student'], 'Bruce');
    ok('headers extended', c.__rows('Sessions')[0].length >= 16);
}

// ══════════════════════════════════════════════════════════════════
sec('7 · Math: a real challenge session lands whole');
{
    const c = makeCtx(MA);
    const p = FIX.math_challenge;
    ok('bad key rejected', c.__post({ key: 'wrong', type: 'session', payload: {} }).ok === false);
    ok('non-session ignored', c.__post({ key: p.key, type: 'ping' }).ignored === 'ping');

    const res = c.__post(p);
    ok('accepted', res.ok === true);
    eq('detail becomes question rows', res.questions, p.payload.detail.length);

    const row = c.__byName('Sheet1', 1);
    eq('Student (was "Student Name")', row['Student'], 'Jeffrey');
    eq('Subject', row['Subject'], 'Math');
    eq('Type derived from module', row['Type'], 'challenge');
    eq('Max (was "Max Score")', row['Max'], 10);
    eq('Percent is numeric, not "80%"', row['Percent'], 0.8);
    eq('Duration in SECONDS, not rounded minutes', row['Duration (sec)'], 412);
    eq('Focus Losses blank — Math has no integrity layer', row['Focus Losses'], '');
    eq('Session ID stored', row['Session ID'], p.payload.sessionId);
    ok('Breakdown kept', /mastered 4\/28/.test(row['Breakdown']));

    const q1 = c.__byName('Questions', 1), q2 = c.__byName('Questions', 2);
    eq('domain becomes Skill', q1['Skill'], 'Algebra');
    eq('detail.correct is the Right boolean', q1['Right'], true);
    eq('…and false when wrong', q2['Right'], false);
    eq('Correct column blank — Math never sends the answer', q1['Correct'], '');
    eq('joins on Session ID', q1['Session ID'], p.payload.sessionId);
}

// ══════════════════════════════════════════════════════════════════
sec("8 · Math: the retry queue can't duplicate any more");
{
    const c = makeCtx(MA);
    c.__post(FIX.math_challenge);
    const again = c.__post(FIX.math_challenge);          // exactly what _pushToTutor re-sends
    ok('reported as duplicate', again.duplicate === true);
    eq('one session row', c.__rows('Sheet1').length - 1, 1);
    eq('question rows not doubled', c.__rows('Questions').length - 1, 2);
}

// ══════════════════════════════════════════════════════════════════
sec('9 · Math: the dashboard bug is fixed  (v1 read a column nothing wrote)');
{
    // A sheet left over from the OLD old version: Student/App/Module/Out Of in B–F.
    const legacy = [
        ['Timestamp', 'Student', 'App', 'Module', 'Score', 'Out Of'],
        ['2026-07-01', 'Bruce', 'Algebra_App', 'linear', 7, 10],
    ];
    const c = makeCtx(MA, { Sheet1: legacy });
    c.__post(FIX.math_challenge);

    const h = c.__rows('Sheet1')[0];
    eq("'Out Of' renamed to 'Max' in place", h[5], 'Max');
    eq("'Module' renamed to 'Topic' in place", h[3], 'Topic');
    eq('Student stays in column B', h[1], 'Student');

    const fresh = c.__byName('Sheet1', 2);
    eq('new row writes the student into column B', fresh['Student'], 'Jeffrey');
    eq('and its Max into the renamed column', fresh['Max'], 10);

    c.refreshDashboard();
    const dash = c.__rows('Dashboard').map(r => r.join('|')).join('\n');
    ok('dashboard names Jeffrey', /Jeffrey/.test(dash), dash.slice(0, 200));
    ok('dashboard names Bruce (the legacy row)', /Bruce/.test(dash));
    ok('dashboard shows an app', /Algebra|Challenge/.test(dash));

    let threw = null;
    try { c.setupStudentDetail(); } catch (e) { threw = e; }
    ok('setupStudentDetail builds its queries without throwing', threw === null, threw && threw.message);
}

// ══════════════════════════════════════════════════════════════════
sec('10 · Cross-subject: one student, one schema, two sheets');
{
    const rw = makeCtx(RW); rw.__post(FIX.rw_challenge);
    const ma = makeCtx(MA); ma.__post(FIX.math_challenge);
    const a = rw.__byName('Sessions', 1), b = ma.__byName('Sheet1', 1);
    eq('same student key', a['Student'], b['Student']);
    ok('distinguishable by Subject', a['Subject'] === 'R&W' && b['Subject'] === 'Math');
    ok('both carry a Session ID', !!a['Session ID'] && !!b['Session ID']);
    ok('both carry a numeric Percent', typeof a['Percent'] === 'number' && typeof b['Percent'] === 'number');
    ok('both carry Duration in seconds', typeof a['Duration (sec)'] === 'number' && typeof b['Duration (sec)'] === 'number');
}

// ══════════════════════════════════════════════════════════════════
console.log('\n' + '─'.repeat(64));
console.log(fail === 0 ? `ALL ${pass} ASSERTIONS PASSED` : `${pass} passed, ${fail} FAILED:\n  - ` + fails.join('\n  - '));
process.exit(fail === 0 ? 0 : 1);
