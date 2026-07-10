// ─────────────────────────────────────────────────────────────────
// challenge-core.test.js — run with:  node challenge/challenge-core.test.js
//
// Loads the app's REAL progress.js alongside challenge-core.js in one VM
// context with stubbed storage, so every assertion below is made against the
// ledger the app actually ships — not a reimplementation of it. If someone
// changes progress.js's mastery rule, these tests break, which is the point.
// ─────────────────────────────────────────────────────────────────
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const DAY = 86400000;
const HERE = __dirname;

function mkStorage() {
    const m = new Map();
    return {
        getItem: k => (m.has(k) ? m.get(k) : null),
        setItem: (k, v) => { m.set(k, String(v)); },
        removeItem: k => { m.delete(k); },
        clear: () => m.clear(),
    };
}

const ctx = { console, localStorage: mkStorage(), sessionStorage: mkStorage() };
vm.createContext(ctx);
for (const f of ['../progress.js', 'challenge-core.js']) {
    vm.runInContext(fs.readFileSync(path.join(HERE, f), 'utf8'), ctx, { filename: f });
}
const C = ctx.ChallengeCore;

// ── harness ──────────────────────────────────────────────────────
let pass = 0, fail = 0;
const failures = [];
function ok(name, cond, detail) {
    if (cond) { pass++; console.log('  ✓ ' + name); }
    else { fail++; failures.push(name + (detail ? ' — ' + detail : '')); console.log('  ✗ ' + name + (detail ? ' — ' + detail : '')); }
}
function eq(name, actual, expected) {
    const a = JSON.stringify(actual), e = JSON.stringify(expected);
    ok(name, a === e, a === e ? '' : 'got ' + a + ', want ' + e);
}
function section(t) { console.log('\n' + t); }

const now = () => Date.now();
function user(u) { ctx.sessionStorage.setItem('mastery_user', u); }
function setLedger(led, u) {
    ctx.localStorage.setItem('wayne_progress_' + (u || 'guest'), JSON.stringify(led));
}
function getLedger(u) {
    return JSON.parse(ctx.localStorage.getItem('wayne_progress_' + (u || 'guest')) || '{}');
}
const Q = id => ({ id, skill: 'Inferences', difficulty: 'Hard' });

// Fixture ledger covering every reachable state.
const FIX = {
    wrongFresh:    { correct: 0, wrong: 1, lastSeen: now() },
    wrongPartial:  { correct: 1, wrong: 1, lastSeen: now() },   // recovering, still wrong
    correctOnce:   { correct: 1, wrong: 0, lastSeen: now() },
    masteredClean: { correct: 2, wrong: 0, lastSeen: now() },
    masteredDirty: { correct: 2, wrong: 1, lastSeen: now() },   // raw counter >= 2
    decayedClean:  { correct: 2, wrong: 0, lastSeen: now() - 22 * DAY },
    decayedDirty:  { correct: 2, wrong: 1, lastSeen: now() - 22 * DAY },
};

// ═════════════════════════════════════════════════════════════════
section('1 · Segments are exhaustive, exclusive, and correctly labelled');
setLedger(FIX);
{
    const led = getLedger();
    eq('unseen id            → notAttempted', C.segmentOf(Q('nope'), led), 'notAttempted');
    eq('wrong once           → wrong',        C.segmentOf(Q('wrongFresh'), led), 'wrong');
    eq('wrong then 1 correct → wrong',        C.segmentOf(Q('wrongPartial'), led), 'wrong');
    eq('1 clean correct      → correctOnce',  C.segmentOf(Q('correctOnce'), led), 'correctOnce');
    eq('2 clean corrects     → mastered',     C.segmentOf(Q('masteredClean'), led), 'mastered');
    eq('2 corrects, 1 wrong  → mastered',     C.segmentOf(Q('masteredDirty'), led), 'mastered');

    const qs = Object.keys(FIX).map(Q).concat([Q('nope')]);
    const c = C.counts(qs, led);
    ok('counts sum to total', c.notAttempted + c.wrong + c.correctOnce + c.mastered === c.total,
        JSON.stringify(c));
}

// ═════════════════════════════════════════════════════════════════
section('2 · segmentOf is one-to-one with prioritizePool\'s four tiers');
{
    const led = getLedger();
    const pool = ['masteredClean', 'nope', 'correctOnce', 'wrongFresh', 'wrongPartial'].map(Q);
    const RANK = { wrong: 0, notAttempted: 1, correctOnce: 2, mastered: 3 };
    const ordered = ctx.prioritizePool(pool);          // the app's own orderer
    const ranks = ordered.map(q => RANK[C.segmentOf(q, led)]);
    ok('prioritizePool emits wrong → unseen → softMastered → mastered',
        ranks.every((r, i) => i === 0 || ranks[i - 1] <= r), JSON.stringify(ranks));
    ok('our SERVE_ORDER is that order minus mastered',
        JSON.stringify(C.SERVE_ORDER) === JSON.stringify(['wrong', 'notAttempted', 'correctOnce']));
}

// ═════════════════════════════════════════════════════════════════
section('3 · A question you ever got wrong never enters correctOnce');
{
    setLedger({});
    const seen = [];
    const step = correct => {
        ctx.recordAnswer('x', correct, 'practice');
        seen.push(C.segmentOf(Q('x'), getLedger()));
    };
    step(false); step(true); step(true);
    eq('wrong → correct → correct', seen, ['wrong', 'wrong', 'mastered']);
    ok('never passed through correctOnce', seen.indexOf('correctOnce') === -1);
    ok('two clean corrects master it after one miss', seen[2] === 'mastered');
}

// ═════════════════════════════════════════════════════════════════
section('4 · Exam-source answers count double  ⚠  (challenge must not run in Exam mode)');
{
    setLedger({});
    ctx.recordAnswer('e', true, 'exam');
    eq('one exam correct masters an unseen question', C.segmentOf(Q('e'), getLedger()), 'mastered');
    setLedger({});
    ctx.recordAnswer('p', true, 'practice');
    eq('one practice correct does not', C.segmentOf(Q('p'), getLedger()), 'correctOnce');
}

// ═════════════════════════════════════════════════════════════════
section('5 · 21-day decay returns a question to its history, not to limbo');
{
    const led = getLedger();
    setLedger(FIX);
    const l = getLedger();
    eq('decayed, clean history → correctOnce', C.segmentOf(Q('decayedClean'), l), 'correctOnce');
    eq('decayed, ever wrong    → wrong',       C.segmentOf(Q('decayedDirty'), l), 'wrong');
}

// ═════════════════════════════════════════════════════════════════
section('6 · Serving order; mastered excluded unless reattempting all');
{
    setLedger(FIX);
    const led = getLedger();
    const qs = ['masteredClean', 'nope', 'correctOnce', 'wrongFresh'].map(Q);
    const id = a => a;                                  // identity shuffle: deterministic
    const q1 = C.buildQueue(qs, led, { shuffle: id });
    eq('queue = wrong, notAttempted, correctOnce', q1.map(q => q.id),
        ['wrongFresh', 'nope', 'correctOnce']);
    ok('mastered never served', q1.every(q => q.id !== 'masteredClean'));

    const q2 = C.buildQueue(qs, led, { shuffle: id, includeMastered: true });
    eq('reattempt-all appends mastered last', q2.map(q => q.id),
        ['wrongFresh', 'nope', 'correctOnce', 'masteredClean']);
}

// ═════════════════════════════════════════════════════════════════
section('7 · Requeue sends an answered question to the BACK of the queue');
{
    setLedger(FIX);
    const led = getLedger();
    const queue = [Q('nope'), Q('correctOnce')];
    C.requeue(queue, Q('wrongFresh'), led, {});
    eq('unmastered → back, behind everything unserved', queue.map(q => q.id),
        ['nope', 'correctOnce', 'wrongFresh']);

    const q2 = [Q('nope')];
    C.requeue(q2, Q('masteredClean'), led, {});
    eq('newly mastered leaves the rotation', q2.map(q => q.id), ['nope']);

    const q3 = [Q('nope')];
    C.requeue(q3, Q('masteredClean'), led, { includeMastered: true });
    eq('reattempt-all keeps it in rotation', q3.map(q => q.id), ['nope', 'masteredClean']);
}

// ═════════════════════════════════════════════════════════════════
section('8 · The 20-hour cooldown does NOT apply inside a challenge set');
{
    setLedger(FIX);
    const led = getLedger();
    ok('progress.js would park a just-answered question', ctx._isResting(FIX.wrongFresh) === true);
    const q = C.buildQueue([Q('wrongFresh')], led, { shuffle: a => a });
    ok('the challenge serves it anyway', q.length === 1 && q[0].id === 'wrongFresh');
}

// ═════════════════════════════════════════════════════════════════
section('9 · Completion gates');
{
    const g = (na, w, co, m) => C.gate({ notAttempted: na, wrong: w, correctOnce: co, mastered: m, total: na + w + co + m });
    eq('nothing resolved                       → empty',   g(0, 0, 0, 0), 'empty');
    eq('work remains unattempted               → normal',  g(3, 0, 1, 2), 'normal');
    eq('a miss is still outstanding            → normal',  g(0, 1, 4, 2), 'normal');
    eq('all correct-once-or-better, not all M  → confirm', g(0, 0, 4, 2), 'confirm');
    eq('all mastered                           → done',    g(0, 0, 0, 6), 'done');

    ok('confirm is unreachable while any miss is outstanding',
        [[0, 1, 0, 0], [0, 5, 3, 1], [2, 1, 0, 0]].every(a => g(...a) !== 'confirm'));

    eq('default size, normal  = min(10, unmastered)',
        C.defaultSessionSize({ notAttempted: 20, wrong: 4, correctOnce: 0, mastered: 4, total: 28 }), 10);
    eq('default size, confirm = the correct-once items',
        C.defaultSessionSize({ notAttempted: 0, wrong: 0, correctOnce: 4, mastered: 2, total: 6 }), 4);
}

// ═════════════════════════════════════════════════════════════════
section('10 · A wrong answer during reattempt-all un-masters (decision #1)');
{
    setLedger({ m: { correct: 2, wrong: 0, lastSeen: now() } });
    eq('before', C.segmentOf(Q('m'), getLedger()), 'mastered');
    ctx.recordAnswer('m', false, 'practice');
    eq('after a miss', C.segmentOf(Q('m'), getLedger()), 'wrong');
}

// ═════════════════════════════════════════════════════════════════
section('11 · Resolution is loud: missing ids are reported, never dropped');
{
    const bank = [Q('a'), Q('b')];
    const r = C.resolveSet({ setId: 's', ids: ['a', 'ghost', 'b'] }, bank);
    eq('resolved', r.questions.map(q => q.id), ['a', 'b']);
    eq('missing reported', r.missing, ['ghost']);
    ok('caller can detect denominator drift', r.missing.length > 0);
}

// ═════════════════════════════════════════════════════════════════
section('12 · validateSet catches the ways a committed set goes wrong');
{
    eq('clean set', C.validateSet({ setId: 'p8', ids: ['a', 'b'] }), []);
    ok('duplicate id', C.validateSet({ setId: 'p8', ids: ['a', 'a'] }).some(p => /duplicate/.test(p)));
    ok('empty ids', C.validateSet({ setId: 'p8', ids: [] }).some(p => /empty ids/.test(p)));
    ok('missing setId', C.validateSet({ ids: ['a'] }).some(p => /setId/.test(p)));
}

// ═════════════════════════════════════════════════════════════════
section('13 · Multi-student: one frozen set, independent progress, zero new storage');
{
    const SET = { setId: 'p8', ids: ['q1', 'q2'] };
    const bank = [Q('q1'), Q('q2')];
    const { questions } = C.resolveSet(SET, bank);

    user('Jeffrey');
    setLedger({ q1: { correct: 2, wrong: 0, lastSeen: now() } }, 'Jeffrey');
    const jc = C.counts(questions, ctx.getProgress());

    user('Bruce');
    setLedger({ q1: { correct: 0, wrong: 1, lastSeen: now() } }, 'Bruce');
    const bc = C.counts(questions, ctx.getProgress());

    eq('Jeffrey: 1 mastered, 1 unseen', [jc.mastered, jc.notAttempted, jc.wrong], [1, 1, 0]);
    eq('Bruce:   0 mastered, 1 wrong, 1 unseen', [bc.mastered, bc.notAttempted, bc.wrong], [0, 1, 1]);
    ok('same denominator for both', jc.total === bc.total && jc.total === 2);
    ok('no challenge-specific storage key exists',
        ctx.localStorage.getItem('wayne_challenge_p8') === null);
}

// ═════════════════════════════════════════════════════════════════
section('14 · There is no generator in the runtime');
{
    const surface = Object.keys(C);
    ok('no function that can invent a set',
        !surface.some(k => /generat|build.*set|select|seed|sibling/i.test(k)),
        surface.join(', '));
    ok('resolveSet only ever returns bank questions named by ids',
        C.resolveSet({ setId: 's', ids: [] }, [Q('a')]).questions.length === 0);
}

// ═════════════════════════════════════════════════════════════════
console.log('\n' + '─'.repeat(64));
console.log(fail === 0
    ? `ALL ${pass} ASSERTIONS PASSED`
    : `${pass} passed, ${fail} FAILED:\n  - ` + failures.join('\n  - '));
process.exit(fail === 0 ? 0 : 1);
