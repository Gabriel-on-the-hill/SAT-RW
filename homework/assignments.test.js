// ─────────────────────────────────────────────────────────────────
// assignments.test.js — the plans themselves have to be sane.
//
//   npm install jsdom --prefix /tmp/j
//   NODE_PATH=/tmp/j/node_modules node homework/assignments.test.js
//
// Skips cleanly if jsdom is absent.
//
// Assigning homework means editing homework/assignments.js and nothing else. That
// is the point — but it also means a typo or a bad shape is a silent, student-facing
// bug that no code review would catch. These are the three that actually bite:
//
//   1. A MULTI-SKILL DAY MUST USE `sections`.
//      A plain skills/diffs/count day builds ONE pool and takes the top N. The pool
//      is ordered, so the draw clusters: a real 7-question "mixed dress rehearsal"
//      came out as 7 questions of a single skill. It looked fine in the file and it
//      was broken for the student. `sections` draws an exact count per skill.
//
//   2. EVERY SKILL NAME MUST EXIST IN THE BANK, AT THE DIFFICULTY NAMED.
//      The names carry an em dash ("Command of Evidence — Textual"). A hyphen
//      instead, or a difficulty the bank does not stock, yields an empty pool and a
//      student staring at "No questions available for this day."
//
//   3. THE POOL MUST BE BIG ENOUGH FOR THE COUNT.
//      Asking for 6 Hard when the bank holds 3 silently short-changes the set.
//
// This test reads the REAL plans, so it fails when next week's homework is wrong.
// That is the intent: it is a lint for the tutor, not a test of the engine.
// ─────────────────────────────────────────────────────────────────
'use strict';
const fs = require('fs');
const path = require('path');

let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch (e) { console.log('SKIP — jsdom not installed (see header).'); process.exit(0); }

const APP = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');

const BANKS = ['data-craft-structure.js', 'data-craft-structure-ext.js',
    'data-expression-of-ideas.js', 'data-expression-of-ideas-ext.js',
    'data-info-ideas.js', 'data-info-ideas-ext.js',
    'data-conventions.js', 'data-conventions-ext.js'];
// The banks are `const questionBank_*`, i.e. global LEXICAL bindings that never land
// on window. A classic script can see them; the test cannot. Hence the probe.
const PROBE = `window.__QB = function () {
    return [].concat(
        typeof questionBank_CS  !== 'undefined' ? questionBank_CS  : [],
        typeof questionBank_EOI !== 'undefined' ? questionBank_EOI : [],
        typeof questionBank_II  !== 'undefined' ? questionBank_II  : [],
        typeof questionBank_CON !== 'undefined' ? questionBank_CON : []);
};`;

const dom = new JSDOM('<!doctype html><body>', { runScripts: 'dangerously' });
const w = dom.window;
for (const f of [...BANKS, 'progress.js', 'homework/assignments.js']) {
    const s = w.document.createElement('script');
    s.textContent = read(f);
    w.document.body.appendChild(s);
}
const probe = w.document.createElement('script');
probe.textContent = PROBE;
w.document.body.appendChild(probe);

const QB = w.__QB();
const HOMEWORK = w.HOMEWORK;

let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, detail) {
    if (cond) { pass++; console.log('  ✓ ' + name); }
    else { fail++; fails.push(name); console.log('  ✗ ' + name + (detail ? ' — ' + detail : '')); }
}
function section(t) { console.log('\n' + t); }

const poolFor = (skills, diffs) =>
    QB.filter(q => skills.includes(q.skill) && diffs.includes(q.difficulty));

ok('the banks loaded', QB.length > 0, `${QB.length} questions`);
ok('there are plans to check', !!HOMEWORK && Object.keys(HOMEWORK).length > 0);

for (const [student, plan] of Object.entries(HOMEWORK)) {
    section(`${student} — "${plan.title}"`);

    if (!plan.days || !plan.days.length) {
        ok(`${student} has days (or is a challenge plan)`, !!plan.challenge,
            'no days and no challenge — this student would see an empty hub');
        continue;
    }

    for (const day of plan.days) {
        const tag = `${student} day ${day.n}`;

        // ── 1 · a multi-skill day must use sections ────────────────────────────
        if (!day.sections) {
            const n = (day.skills || []).length;
            ok(`${tag}: single-skill day may skip sections (${n} skill)`, n <= 1,
                `${n} skills without sections — the draw will cluster and the "mixed" set ` +
                `will be mostly ONE skill. Split it into sections with an explicit count each.`);
        }

        // ── 2 & 3 · every draw must resolve to enough real questions ───────────
        const draws = day.sections
            ? day.sections.map(s => ({ skills: s.skills, diffs: s.diffs, count: s.count }))
            : [{ skills: day.skills, diffs: day.diffs, count: day.count }];

        for (const d of draws) {
            const pool = poolFor(d.skills || [], d.diffs || []);
            const label = (d.skills || []).join(' + ') + ' @ ' + (d.diffs || []).join('/');
            ok(`${tag}: "${label}" exists in the bank`, pool.length > 0,
                'EMPTY POOL — check the skill name (it uses an em dash "—", not a hyphen) ' +
                'and that the bank stocks that difficulty');
            if (pool.length > 0) {
                ok(`${tag}: "${label}" has enough for ${d.count}`, pool.length >= d.count,
                    `only ${pool.length} in the bank`);
            }
        }

        // ── and a sections day must genuinely span its skills ──────────────────
        if (day.sections) {
            const used = {};
            let set = [];
            for (const sec of day.sections) {
                const pool = QB.filter(q => !used[q.id] && sec.skills.includes(q.skill) && sec.diffs.includes(q.difficulty));
                const picked = w.prioritizePool(pool).slice(0, sec.count);
                picked.forEach(q => used[q.id] = true);
                set = set.concat(picked);
            }
            const want = day.sections.reduce((a, s) => a + (s.count || 0), 0);
            const wantSkills = new Set(day.sections.flatMap(s => s.skills));
            ok(`${tag}: the draw yields all ${want} questions`, set.length === want, `got ${set.length}`);
            ok(`${tag}: and spans all ${wantSkills.size} skills it names`,
                new Set(set.map(q => q.skill)).size === wantSkills.size,
                `got ${new Set(set.map(q => q.skill)).size}`);
        }
    }
}

// ── The calendar floor under sequential unlock ────────────────────────────
// Ported from the sister app 6 Sep 2026, where sequential deadlocked for real. A
// student answered all ten questions of set 1, closed the tab without reaching
// the score screen, and the completion flag was never written — so the four sets
// behind it, that week's entire new skill, never opened. Nothing errored. The hub
// listed all five, so she was looking at four sets she could not start.
//
// A missing flag must therefore stop a set being EARNED EARLY, never lock it.
// Submit and the next one opens at once; do not, and the calendar still releases
// it on its own day. The worst case is cumulative's pace, not a dead plan.
section('the calendar floor under sequential unlock');
{
    // This JSDOM is built without a URL, so its origin is opaque and touching
    // window.localStorage throws. hwDayOpen catches that and returns true by
    // design — broken storage must never lock a student out — which would make
    // every assertion below pass for the wrong reason. So stub the store.
    const store = {};
    Object.defineProperty(w, 'localStorage', {
        configurable: true,
        value: {
            getItem: k => (k in store ? store[k] : null),
            setItem: (k, v) => { store[k] = String(v); },
            removeItem: k => { delete store[k]; },
            clear: () => { for (const k of Object.keys(store)) delete store[k]; },
        },
    });
    ok('the localStorage stub is live, so these assertions mean something',
        (w.localStorage.setItem('probe', '1'), w.localStorage.getItem('probe') === '1'));
    w.localStorage.clear();

    const ymd = n => {
        const d = new Date(); d.setDate(d.getDate() - n);
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
             + '-' + String(d.getDate()).padStart(2, '0');
    };
    const isOpen = (start, n, submitted) => {
        w.localStorage.clear();
        for (const i of (submitted || [])) w.localStorage.setItem('satrw_hw_T_' + start + '_' + i, '1');
        const plan = { start, unlock: 'sequential', days: [1, 2, 3, 4, 5].map(x => ({ n: x })) };
        return w.hwDayOpen('T', plan, n);
    };

    ok('set 1 is always open', isOpen(ymd(0), 1, []) === true);
    ok('an unsubmitted set 1 still gates set 2 on day one',
        isOpen(ymd(0), 2, []) === false,
        'the floor must not hand out the whole week at once — that is what sequential replaced');
    ok('submitting set 1 still opens set 2 immediately',
        isOpen(ymd(0), 2, [1]) === true,
        'sequential must keep letting a student earn the next set ahead of its day');
    ok('a submitted run opens the set after it, ahead of its calendar day',
        isOpen(ymd(0), 3, [1, 2]) === true);
    ok('THE REGRESSION: an unsubmitted set no longer deadlocks the ones behind it',
        [2, 3, 4, 5].every(n => isOpen(ymd(17), n, []) === true),
        'a missing completion flag stranded the rest of the plan for seventeen days');
    ok('the floor releases only the days that have actually arrived',
        isOpen(ymd(2), 5, []) === false,
        'set 5 is not due two days into the plan');
}

console.log('\n' + '─'.repeat(64));
if (fail) { console.log(`${fail} FAILED:\n  · ` + fails.join('\n  · ')); process.exit(1); }
console.log(`ALL ${pass} ASSERTIONS PASSED`);
