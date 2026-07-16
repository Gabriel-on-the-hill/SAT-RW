// ─────────────────────────────────────────────────────────────────
// ns-migrate.test.js — renaming the namespace must not cost anyone their work.
//
//   npm install jsdom --prefix /tmp/j
//   NODE_PATH=/tmp/j/node_modules node ns-migrate.test.js
//
// Skips cleanly if jsdom is absent.
//
// WHY THIS EXISTS
//
// Every key in this app was prefixed `wayne_`, because the folder it happens to
// live in is named after a student. It is the shared SAT R&W Mastery app — Gabe,
// Jeffrey and Segun use it too — so the prefix was renamed to `satrw_`.
//
// The danger in that rename is not in this repo. It is in the students' browsers,
// where `wayne_progress_Gabe` and the rest hold their mastery ledger, their session
// history, their retention counter and their notes. A rename with no migration
// throws all of it away and NOTHING FAILS: no error, no blank screen — the app just
// greets each of them as a brand-new student, and the review ladder forgets every
// question they ever learned. It would look exactly like a fresh install, which is
// to say it would look fine.
//
// These assertions are the only thing standing between that rename and that
// outcome. If one fails, do not "fix the test" — the data is what matters.
// ─────────────────────────────────────────────────────────────────
'use strict';
const fs   = require('fs');
const path = require('path');

let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch (e) { console.log('SKIP — jsdom not installed (see header).'); process.exit(0); }

const SRC = fs.readFileSync(path.join(__dirname, 'ns-migrate.js'), 'utf8');

let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, detail) {
    if (cond) { pass++; console.log('  ✓ ' + name); }
    else { fail++; fails.push(name); console.log('  ✗ ' + name + (detail ? ' — ' + detail : '')); }
}
function section(t) { console.log('\n' + t); }

// A window with `seed` already in localStorage, then the migration run over it.
function migrate(seed) {
    const dom = new JSDOM('<!doctype html><body>', { runScripts: 'dangerously', url: 'https://x.test' });
    const w = dom.window;
    Object.entries(seed).forEach(([k, v]) => w.localStorage.setItem(k, v));
    const s = w.document.createElement('script');
    s.textContent = SRC;
    w.document.body.appendChild(s);
    return w;
}
const run = (w) => {
    const s = w.document.createElement('script');
    s.textContent = SRC;
    w.document.body.appendChild(s);
    return w;
};

// ── 1 · a real student's browser ─────────────────────────────────────────────
section("A student's existing work survives the rename");
{
    // This is Gabe's browser as it actually looks the moment before the rename ships.
    const w = migrate({
        'wayne_progress_Gabe':    JSON.stringify({ q1: { correct: 2, wrong: 0, streak: 2, lastSeen: 123 } }),
        'wayne_trap_stats_Gabe':  JSON.stringify({ 'Inferences — general': { skill: 'Inferences', total: 9, wrong: 2 } }),
        'wayne_retention_Gabe':   JSON.stringify({ 'Inferences': { correct: 3, total: 4 } }),
        'wayne_sat_history_Gabe': JSON.stringify([{ score: 5, total: 6 }]),
        'wayne_hw_Gabe_2026-06-01_1': '1',
        'wayne_theme_v2':         'dark',
    });
    const get = k => w.localStorage.getItem(k);

    ok('the mastery ledger is carried across',
        JSON.parse(get('satrw_progress_Gabe')).q1.streak === 2,
        'this is the ladder state — losing it un-learns everything he has learned');
    ok('the per-skill stats are carried across',
        JSON.parse(get('satrw_trap_stats_Gabe'))['Inferences — general'].total === 9);
    ok('the retention counter is carried across',
        JSON.parse(get('satrw_retention_Gabe')).Inferences.correct === 3,
        'retention only accrues on spaced reviews — it is the slowest thing here to re-earn');
    ok('session history is carried across', JSON.parse(get('satrw_sat_history_Gabe'))[0].score === 5);
    ok('the "day done" flag is carried across', get('satrw_hw_Gabe_2026-06-01_1') === '1');
    ok('even cosmetic state comes along', get('satrw_theme_v2') === 'dark');

    ok('the originals are left in place as the undo', get('wayne_progress_Gabe') !== null,
        'if this migration is ever wrong, the legacy copy is what makes it recoverable');
}

// ── 2 · it is generic, not a list ────────────────────────────────────────────
section('It migrates keys nobody remembered to list');
{
    // The whole point of doing this by prefix rather than by an enumerated list: a
    // list is a thing you forget to update, and the key you forget is someone's work.
    const w = migrate({ 'wayne_some_key_added_next_year': 'x' });
    ok('an unknown wayne_* key still moves', w.localStorage.getItem('satrw_some_key_added_next_year') === 'x');

    const u = migrate({ 'mastery_unlocked': '1', 'other_app_thing': 'y' });
    ok('keys outside the namespace are untouched',
        u.localStorage.getItem('mastery_unlocked') === '1' && u.localStorage.getItem('other_app_thing') === 'y');
    ok('and are not copied into the new namespace', u.localStorage.getItem('satrw_other_app_thing') === null);
}

// ── 3 · running twice must be safe ───────────────────────────────────────────
section('It is idempotent, and never clobbers newer work');
{
    // Every page load runs this. If a second run overwrote the new key with the stale
    // legacy one, a student would silently lose a session's work every navigation —
    // answer six questions, click Progress, and they are gone.
    const w = migrate({ 'wayne_progress_Gabe': JSON.stringify({ q1: { correct: 1 } }) });

    w.localStorage.setItem('satrw_progress_Gabe', JSON.stringify({ q1: { correct: 9 } }));  // a fresh session's work
    run(w);                                                                                  // navigate to another page
    ok('a second run does not overwrite newer data with the legacy copy',
        JSON.parse(w.localStorage.getItem('satrw_progress_Gabe')).q1.correct === 9,
        'losing a session per page-navigation is the worst version of this bug');

    ok('the run is marked so it does not repeat needlessly',
        w.localStorage.getItem('satrw_ns_migrated_v1') === '1');
}

// ── 4 · a key that already exists is not clobbered on the FIRST run either ───
section('A pre-existing new-namespace value always wins');
{
    const w = migrate({
        'wayne_progress_Gabe': JSON.stringify({ q1: { correct: 1 } }),
        'satrw_progress_Gabe': JSON.stringify({ q1: { correct: 7 } }),
    });
    ok('the newer namespace value is kept',
        JSON.parse(w.localStorage.getItem('satrw_progress_Gabe')).q1.correct === 7);
}

// ── 5 · a new student, and a hostile browser ─────────────────────────────────
section('It is harmless when there is nothing to do');
{
    const w = migrate({});
    ok('a brand-new student migrates nothing and does not throw',
        w.localStorage.getItem('satrw_ns_migrated_v1') === '1');

    // Private mode / disabled storage must not take the page down. The app has to
    // load even if it cannot remember anything.
    const dom = new JSDOM('<!doctype html><body>', { runScripts: 'dangerously', url: 'https://x.test' });
    const win = dom.window;
    Object.defineProperty(win, 'localStorage', {
        get() { throw new Error('SecurityError: storage is disabled'); },
    });
    let threw = false;
    try {
        const s = win.document.createElement('script');
        s.textContent = SRC;
        win.document.body.appendChild(s);
    } catch (e) { threw = true; }
    ok('a browser with storage disabled does not break the page', !threw);
}

// ── 6 · the shim must actually run first ─────────────────────────────────────
section('Every page that reads storage runs the migration before it reads');
{
    // Order is the whole feature. progress.js, storage.js and config.js read their
    // keys at load time — if the shim runs second, they have already read an empty
    // store and the student's work looks deleted for that whole page view.
    const pages = fs.readdirSync(__dirname).filter(f => f.endsWith('.html'));
    const misordered = [];
    const missing    = [];
    for (const p of pages) {
        const html = fs.readFileSync(path.join(__dirname, p), 'utf8');
        const srcs = [...html.matchAll(/<script[^>]*\bsrc="([^"?]+)/gi)].map(m => m[1]);
        const readsStorage = /localStorage|sessionStorage/.test(html)
            || srcs.some(s => ['progress.js', 'storage.js', 'config.js', 'app.js',
                               'gate.js', 'anti-cheat.js', 'history.js'].includes(s));
        if (!readsStorage) continue;
        const i = srcs.indexOf('ns-migrate.js');
        if (i < 0) missing.push(p);
        else if (i !== 0) misordered.push(p + ' (position ' + i + ')');
    }
    ok('every storage-touching page loads the migration', missing.length === 0, missing.join(', '));
    ok('and loads it FIRST, before anything reads a key', misordered.length === 0, misordered.join(', '));
}

// ── 7 · the legacy prefix is gone from the code itself ───────────────────────
section('Nothing still writes to the old namespace');
{
    // A single missed `wayne_` write is a key that migrates once and then diverges:
    // the student's work splits across two namespaces and half of it stops being read.
    const files = [];
    (function walk(dir) {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            if (e.name === 'node_modules' || e.name === '.git') continue;
            const full = path.join(dir, e.name);
            if (e.isDirectory()) walk(full);
            else if (/\.(js|html)$/.test(e.name) && e.name !== 'ns-migrate.js'
                     && e.name !== 'ns-migrate.test.js' && !/^_gen/.test(e.name)) files.push(full);
        }
    })(__dirname);

    const offenders = files.filter(f => /['"]wayne[_-]/.test(fs.readFileSync(f, 'utf8')))
        .map(f => path.relative(__dirname, f));
    ok('no file still reads or writes a wayne_* key', offenders.length === 0, offenders.join(', '));
}

console.log('\n' + '─'.repeat(64));
if (fail) { console.log(`${fail} FAILED:\n  · ` + fails.join('\n  · ')); process.exit(1); }
console.log(`ALL ${pass} ASSERTIONS PASSED`);
