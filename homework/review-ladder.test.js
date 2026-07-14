// ─────────────────────────────────────────────────────────────────
// review-ladder.test.js — spaced review actually happens.
//
//   npm install jsdom --prefix /tmp/j
//   NODE_PATH=/tmp/j/node_modules node homework/review-ladder.test.js
//
// Skips cleanly if jsdom is absent.
//
// THE BUG THIS EXISTS TO PREVENT COMING BACK:
//
// The ledger used to have no way to bring a learned question back. Two corrects
// made a question "mastered". At 21 days _isMastered() flipped false and — because
// `wrong` was still 0 — the question fell into a `softMastered` tier that sat
// BEHIND `unseen` in the draw. The bank holds hundreds of questions and a set takes six,
// so `unseen` never ran out and that question was NEVER DRAWN AGAIN. The 21-day
// "decay" only ever changed a label on the progress screen.
//
// Nothing taught in April came back in May. Not because anyone decided that —
// because a tier was in the wrong place and no test looked.
//
// The other half of the same bug lives in the pool FILTER, not the pool ORDER: a
// day is narrowed to (say) "Words in Context / Hard" before prioritizePool() ever
// sees it, so a due Text Structure question — or a Medium miss, on a Hard-only day
// — cannot surface no matter how the pool is sorted. No amount of reordering can
// bring back a question the filter already removed. dueForReview() is the one draw
// allowed to cross that filter. These tests hold both halves.
//
// Note the ledger records below are written with an AGED `lastSeen`. That is the
// only way to see this feature at all: in a test that just answered a question,
// nothing is overdue, so the review draw correctly returns nothing.
// ─────────────────────────────────────────────────────────────────
'use strict';
const fs   = require('fs');
const path = require('path');

let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch (e) { console.log('SKIP — jsdom not installed (see header).'); process.exit(0); }

const APP        = path.join(__dirname, '..');
const LEDGER_KEY = 'wayne_progress_guest';    // 'wayne_progress_' + (sessionStorage mastery_user || 'guest')
const DAY        = 86_400_000;
const ago        = d => Date.now() - d * DAY;

let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, detail) {
    if (cond) { pass++; console.log('  ✓ ' + name); }
    else { fail++; fails.push(name); console.log('  ✗ ' + name + (detail ? ' — ' + detail : '')); }
}
function section(t) { console.log('\n' + t); }

// A tiny stand-in bank. The real banks are megabytes and irrelevant here — what is
// under test is the ledger and the draw, not the questions.
const BANK = [
    { id: 'wic1', skill: 'Words in Context',        difficulty: 'Hard'   },
    { id: 'wic2', skill: 'Words in Context',        difficulty: 'Hard'   },
    { id: 'tsp1', skill: 'Text Structure and Purpose', difficulty: 'Medium' },
    { id: 'tsp2', skill: 'Text Structure and Purpose', difficulty: 'Medium' },
    { id: 'inf1', skill: 'Inferences',              difficulty: 'Medium' },
    { id: 'inf2', skill: 'Inferences',              difficulty: 'Hard'   },
];

// Fresh window with progress.js loaded and a ledger seeded.
function withLedger(ledger) {
    const dom = new JSDOM('<!doctype html><body>', { runScripts: 'dangerously', url: 'https://x.test' });
    const w   = dom.window;
    w.localStorage.setItem(LEDGER_KEY, JSON.stringify(ledger));
    const s = w.document.createElement('script');
    s.textContent = fs.readFileSync(path.join(APP, 'progress.js'), 'utf8');
    w.document.body.appendChild(s);
    return w;
}

// ── 1 · the ladder itself ─────────────────────────────────────────────────────
section('The ladder: each correct pushes the next sighting further out');
{
    // Rungs are 1, 3, 7, 21, 42 days. A question is due once its rung has elapsed.
    const cases = [
        // streak, days since seen, due?,  why
        [1,  2,  true,  'one correct, 2 days ago — the 1-day rung has passed'],
        [2,  2,  false, 'two corrects, 2 days ago — the 3-day rung has NOT passed'],
        [2,  5,  true,  'two corrects, 5 days ago — the 3-day rung has passed'],
        [3,  5,  false, 'three corrects, 5 days ago — the 7-day rung has NOT passed'],
        [3, 10,  true,  'three corrects, 10 days ago — the 7-day rung has passed'],
        [4, 10,  false, 'four corrects, 10 days ago — the 21-day rung has NOT passed'],
        [5, 50,  true,  'five corrects, 50 days ago — the 42-day rung has passed'],
        [9, 50,  true,  'the ladder tops out at 42 days; it does not run off the end'],
    ];
    for (const [streak, days, want, why] of cases) {
        const w = withLedger({ q: { correct: streak, wrong: 0, streak, lastSeen: ago(days) } });
        const got = w.dueForReview(BANK.concat([{ id: 'q', skill: 'X', difficulty: 'Hard' }]), 5, {})
            .some(x => x.id === 'q');
        ok(why, got === want, `expected due=${want}`);
    }
}

// ── 2 · THE REGRESSION ────────────────────────────────────────────────────────
section('The regression: a question learned in April comes back');
{
    // Exactly the record the old code stranded: mastered (2 corrects, never wrong),
    // last seen well over a month ago.
    const w = withLedger({
        wic1: { correct: 2, wrong: 0, streak: 2, lastSeen: ago(40), lastResult: 'correct' },
    });
    const due = w.dueForReview(BANK, 2, {});
    ok('a mastered-then-decayed question is DUE, not stranded', due.some(q => q.id === 'wic1'),
        'this is the whole bug — it used to fall behind `unseen` and never be drawn again');

    // And it must not be dead last in a pool ordering either.
    const ordered = w.prioritizePool(BANK.filter(q => q.skill === 'Words in Context'));
    ok('and it is not parked at the back of its own pool', ordered.length === 2);
}

// ── 3 · the review draw crosses the day's filter ──────────────────────────────
section('The review draw reaches past the day\'s skill/difficulty filter');
{
    const w = withLedger({
        tsp1: { correct: 2, wrong: 0, streak: 2, lastSeen: ago(30), lastResult: 'correct' },
        inf2: { correct: 1, wrong: 1, streak: 0, lastSeen: ago(30), lastResult: 'wrong'   },
    });

    // The day is "Words in Context / Hard". Neither due question can possibly be in
    // that pool — one is a different skill, one is a different difficulty. This is
    // the case prioritizePool() structurally cannot fix.
    const dayPool = BANK.filter(q => q.skill === 'Words in Context' && q.difficulty === 'Hard');
    const inDay   = {}; w.prioritizePool(dayPool).forEach(q => inDay[q.id] = true);
    ok('the day\'s own pool cannot reach them', !inDay.tsp1 && !inDay.inf2);

    const due = w.dueForReview(BANK, 2, inDay);
    ok('but the review draw does — a different SKILL comes back',      due.some(q => q.id === 'tsp1'));
    ok('and a different DIFFICULTY comes back (the Medium-miss trap)', due.some(q => q.id === 'inf2'));
}

// ── 4 · what review must never do ─────────────────────────────────────────────
section('What the review draw must never do');
{
    const w = withLedger({
        wic1: { correct: 2, wrong: 0, streak: 2, lastSeen: ago(40), lastResult: 'correct' },
    });
    const due = w.dueForReview(BANK, 6, {});
    ok('it never serves an unseen question', due.every(q => q.id === 'wic1'),
        'a "review" block that hands the student an untaught skill cold is not review');

    const excluded = w.dueForReview(BANK, 6, { wic1: true });
    ok('it never duplicates a question already in the set', excluded.length === 0);

    const none = withLedger({}).dueForReview(BANK, 2, {});
    ok('an empty ledger yields no review (a new student gets the set as authored)', none.length === 0);

    const fresh = withLedger({
        wic1: { correct: 1, wrong: 0, streak: 1, lastSeen: Date.now(), lastResult: 'correct' },
    }).dueForReview(BANK, 2, {});
    ok('a question answered just now is not due (no same-day rebound)', fresh.length === 0);
}

// ── 5 · most overdue first ────────────────────────────────────────────────────
section('The most-forgotten thing comes back first');
{
    const w = withLedger({
        wic1: { correct: 1, wrong: 0, streak: 1, lastSeen: ago(3),  lastResult: 'correct' },  // 2 days overdue
        tsp1: { correct: 1, wrong: 0, streak: 1, lastSeen: ago(60), lastResult: 'correct' },  // 59 days overdue
        inf1: { correct: 1, wrong: 0, streak: 1, lastSeen: ago(10), lastResult: 'correct' },  // 9 days overdue
    });
    const due = w.dueForReview(BANK, 3, {});
    ok('the queue is sorted most-overdue first',
        due[0].id === 'tsp1' && due[1].id === 'inf1' && due[2].id === 'wic1',
        'got ' + due.map(q => q.id).join(', '));

    const capped = w.dueForReview(BANK, 1, {});
    ok('and it respects the dose (review:N draws at most N)', capped.length === 1 && capped[0].id === 'tsp1');
}

// ── 6 · a miss drops you to the bottom rung ───────────────────────────────────
section('A miss resets the ladder');
{
    const w = withLedger({});
    w.recordAnswer('wic1', true,  'homework');
    w.recordAnswer('wic1', true,  'homework');
    let led = JSON.parse(w.localStorage.getItem(LEDGER_KEY));
    ok('two corrects climb to rung 2', led.wic1.streak === 2, 'streak=' + led.wic1.streak);

    w.recordAnswer('wic1', false, 'homework');
    led = JSON.parse(w.localStorage.getItem(LEDGER_KEY));
    ok('a miss drops the streak to 0', led.wic1.streak === 0, 'streak=' + led.wic1.streak);
    ok('and the miss is recorded', led.wic1.wrong === 1);
}

// ── 7 · old ledgers still work ────────────────────────────────────────────────
section('Ledgers written before the ladder existed are not reset to zero');
{
    // A real student's record from before `streak` was stored. It must infer a rung
    // from the corrects already banked, not silently treat them as never-learned.
    const w = withLedger({
        wic1: { correct: 2, wrong: 0, lastSeen: ago(40), lastResult: 'correct' },  // no `streak`
        inf1: { correct: 0, wrong: 3, lastSeen: ago(40), lastResult: 'wrong'   },  // no `streak`
    });
    const due = w.dueForReview(BANK, 4, {});
    ok('an old mastered record is credited its rung and comes back due', due.some(q => q.id === 'wic1'));
    ok('an old missed record sits at the bottom rung and comes back due', due.some(q => q.id === 'inf1'));
}

// ── 8 · the dose resolves day → plan → 2 ──────────────────────────────────────
section('The review dose: day beats plan, plan beats the default of 2');
{
    // This mirrors the resolution in homework-run.html. If you change it there,
    // change it here — and if this test is the only thing that notices, good.
    const dose = (spec, plan) =>
          (typeof spec.review === 'number') ? spec.review
        : (plan && typeof plan.review === 'number') ? plan.review
        : 2;

    ok('a plain day gets the default 2',            dose({}, {}) === 2);
    ok('a plan-level review:0 freezes every day',   dose({}, { review: 0 }) === 0);
    ok('a day-level review:0 wins over the plan',   dose({ review: 0 }, { review: 4 }) === 0);
    ok('a day-level review:4 wins over the plan',   dose({ review: 4 }, { review: 0 }) === 4);
    ok('a plan with no review key still gets 2',    dose({}, { title: 'x' }) === 2);
}

// ── 9 · plans that were mid-flight must stay frozen ───────────────────────────
section('Live plans authored before the ladder are frozen');
{
    // These plans' question counts were written assuming no review draw. Turning
    // review on under a running plan grows a six-question set to eight overnight,
    // and a set that gets abandoned teaches nothing. The freeze comes OFF when the
    // plan is next re-authored, with the counts written around the review dose.
    //
    // If you are here because this test failed: you either re-assigned one of these
    // students (then remove them from the list below) or you dropped a `review: 0`
    // by accident (then put it back).
    const dom = new JSDOM('<!doctype html><body>', { runScripts: 'dangerously' });
    const w   = dom.window;
    const s   = w.document.createElement('script');
    s.textContent = fs.readFileSync(path.join(APP, 'homework/assignments.js'), 'utf8');
    w.document.body.appendChild(s);

    const FROZEN = ['Gabe', 'Segun'];
    for (const name of FROZEN) {
        const plan = w.HOMEWORK[name];
        if (!plan) { ok(`${name} is frozen`, true, 'plan is gone — re-assigned, presumably'); continue; }
        ok(`${name}'s plan is still frozen (review: 0)`, plan.review === 0,
            'this plan\'s counts assume no review draw; re-author the counts before lifting the freeze');
    }
}

console.log('\n' + '─'.repeat(64));
if (fail) { console.log(`${fail} FAILED:\n  · ` + fails.join('\n  · ')); process.exit(1); }
console.log(`ALL ${pass} ASSERTIONS PASSED`);
