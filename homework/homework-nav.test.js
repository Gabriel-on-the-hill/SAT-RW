// ─────────────────────────────────────────────────────────────────
// homework-nav.test.js — a student can move around a homework set.
//
//   NODE_PATH=/path/to/node_modules node homework/homework-nav.test.js
//
// Skips cleanly if jsdom is absent.
//
// The runner used to reveal Next only once a question had been answered, so
// answering was the only way to reach the next question: no skipping, no going
// back, no changing your mind. Navigation now follows the clock:
//
//   TIMED   → a rehearsal for a test that lets you move, revise and flag, so the
//             set does too. That forces feedback to the END: going back to change
//             an answer is meaningless once you have been shown the right one.
//   UNTIMED → keeps instant feedback, because the explanation is the point. Gains
//             a Skip so nothing forces a guess, and a Submit so a misclick is
//             survivable.
//
// The invariant underneath both: a question reaches the mastery ledger ONCE, an
// answer that was revised counts as revised, and a BLANK never counts at all.
// ─────────────────────────────────────────────────────────────────
'use strict';
const fs = require('fs');
const path = require('path');

let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch (e) { console.log('SKIP — jsdom not installed (see header).'); process.exit(0); }

const CFG = { userKey: 'mastery_user' };   // gate.js
const APP = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');

const RAW = read('homework-run.html');
const HTML = RAW.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<link\b[^>]*>/gi, '');
const SRCS = [...RAW.matchAll(/<script\s+src="([^"?]+)/gi)].map(m => m[1]);
const INLINE = RAW.match(/<script>\n?([\s\S]*?)<\/script>/)[1];

const PROBE = `window.__QB = function () {
    return [].concat(
        typeof questionBank_CS  !== 'undefined' ? questionBank_CS  : [],
        typeof questionBank_EOI !== 'undefined' ? questionBank_EOI : [],
        typeof questionBank_II  !== 'undefined' ? questionBank_II  : [],
        typeof questionBank_CON !== 'undefined' ? questionBank_CON : []);
};
window.__ledger = function(){ return getProgress(); };`;

const PLAN = {
    title: 'test', start: '2020-01-01', unlock: 'cumulative',
    days: [
        { n: 1, focus: 'untimed', skills: ['Inferences'], diffs: ['Medium'], count: 3, minutes: 0, tip: 'x' },
        { n: 2, focus: 'timed',   skills: ['Inferences'], diffs: ['Medium'], count: 3, minutes: 9, tip: 'x' },
        { n: 3, focus: 'expiring',skills: ['Inferences'], diffs: ['Medium'], count: 3, minutes: 1 / 60, tip: 'x' },
    ],
};

let pass = 0, fail = 0, failed = [];
function section(t) { console.log('\n' + t + '\n' + '─'.repeat(t.length)); }
function ok(name, cond) {
    if (cond) { console.log('  ✓ ' + name); pass++; }
    else { console.log('  ✗ ' + name); fail++; failed.push(name); }
}
function eq(name, a, b) {
    if (JSON.stringify(a) === JSON.stringify(b)) { console.log('  ✓ ' + name); pass++; }
    else { console.log('  ✗ ' + name + ' — got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b));
           fail++; failed.push(name); }
}

const $   = (w, id) => w.document.getElementById(id);
const all = (w, sel) => Array.from(w.document.querySelectorAll(sel));
const shown = el => !!el && !el.classList.contains('hidden');
const live  = (w, id) => shown($(w, id));

function build(day) {
    const dom = new JSDOM(HTML, {
        runScripts: 'dangerously',
        url: `http://localhost/homework-run.html?student=__TEST__&day=${day}`,
        beforeParse(w) {
            w.__posts = [];
            w.fetch = (url, opt) => {
                try { w.__posts.push(JSON.parse((opt && opt.body) || '{}')); } catch (e) {}
                return Promise.resolve({ ok: true });
            };
            w.scrollTo = () => {}; w.alert = () => {}; w.confirm = () => true;
        },
    });
    const w = dom.window;
    w.sessionStorage.setItem('mastery_unlocked', '1');
    w.sessionStorage.setItem(CFG.userKey, '__TEST__');
    for (const f of SRCS) {
        const s = w.document.createElement('script');
        s.textContent = read(f);
        w.document.body.appendChild(s);
    }
    const probe = w.document.createElement('script');
    probe.textContent = PROBE;
    w.document.body.appendChild(probe);
    w.HOMEWORK['__TEST__'] = JSON.parse(JSON.stringify(PLAN));
    w.__realPrioritize = w.prioritizePool;
    w.prioritizePool = pool => pool.slice();
    installClock(w);
    const s = w.document.createElement('script');
    s.textContent = INLINE;
    w.document.body.appendChild(s);
    return w;
}

// The runner never publishes its answer key; mirror the frozen draw to learn it.
function answersFor(w, dayIdx) {
    const QB = w.__QB();
    const spec = PLAN.days[dayIdx];
    const pool = QB.filter(q => spec.skills.indexOf(q.skill) >= 0
                             && spec.diffs.indexOf(q.difficulty) >= 0);
    return pool.slice(0, spec.count).map(q => q.answer);
}
// The untimed set holds the choices shut until she has been on the text long
// enough to have read it, and until she has typed a prediction. Both are real
// gates with their own tests; here they are just satisfied.
let CLOCK_SKEW = 0;
function installClock(w) {
    const real = w.Date.now.bind(w.Date);
    w.Date.now = () => real() + CLOCK_SKEW;
}
function reveal(w, text) {
    if ($(w, 'predText')) $(w, 'predText').value = text || 'my prediction';
    CLOCK_SKEW += 60000;                 // 60s > the read-gate cap
    const g = $(w, 'predGo');
    if (g) g.click();
}
function pick(w, letter) {
    const b = all(w, '.opt').find(x => x.dataset.l === letter);
    if (b) b.click();
    return !!b;
}
function otherThan(w, letter) {
    const b = all(w, '.opt').find(x => x.dataset.l !== letter);
    if (b) b.click();
    return b ? b.dataset.l : null;
}
const ledgerSize = w => Object.keys(w.__ledger()).length;

// saveRecs() stores { at, recs }, not a bare array.
const recs = w => {
    const k = Object.keys(w.localStorage).find(x => x.indexOf('satrw_hwrec_') === 0);
    if (!k) return [];
    try { return JSON.parse(w.localStorage.getItem(k)).recs || []; } catch (e) { return []; }
};

// ═════════════════════════════════════════════════════════════════
section('1 · UNTIMED — nothing forces a guess, and a misclick is survivable');
{
    const w = build(1);
    const KEY = answersFor(w, 0);

    ok('Back is hidden on the first question', !live(w, 'back'));
    reveal(w);
    ok('Skip is offered once the choices are open', live(w, 'skip'));
    ok('Submit is not offered before anything is chosen', !live(w, 'submit'));
    ok('Next is not offered before the question is done', !live(w, 'next'));

    $(w, 'skip').click();
    ok('skipping moves to the next question', /Question 2/.test($(w, 'run').querySelector('.t').textContent));
    eq('a skip writes NOTHING to the mastery ledger', ledgerSize(w), 0);
    ok('Back is offered once past the first question', live(w, 'back'));

    $(w, 'back').click();
    ok('Back returns to the skipped question', /Question 1/.test($(w, 'run').querySelector('.t').textContent));
    ok('the prediction is not demanded a second time', !$(w, 'predText'));
    ok('the choices are still open from last time', shown($(w, 'opts')));
    ok('and it is still answerable', live(w, 'skip'));

    const wrong = otherThan(w, KEY[0]);
    ok('choosing an option does not grade it', !$(w, 'fb').classList.contains('show'));
    eq('and does not write the ledger', ledgerSize(w), 0);
    ok('the choice shows as selected, not as marked', all(w, '.opt.sel').length === 1);
    ok('Submit appears once something is chosen', live(w, 'submit'));

    pick(w, KEY[0]);
    ok('a misclick can be corrected before submitting',
       all(w, '.opt.sel')[0].dataset.l === KEY[0]);

    $(w, 'submit').click();
    ok('Submit grades it', $(w, 'fb').classList.contains('show'));
    eq('and writes the ledger exactly once', ledgerSize(w), 1);
    ok('Submit and Skip retire once graded', !live(w, 'submit') && !live(w, 'skip'));
    ok('Next takes over', live(w, 'next'));

    otherThan(w, KEY[0]);
    ok('a graded answer cannot be changed',
       all(w, '.opt.sel')[0].dataset.l === KEY[0]);

    $(w, 'next').click();
    $(w, 'back').click();
    ok('returning to a graded question shows the grade again',
       $(w, 'fb').classList.contains('show'));
    eq('and does not re-write the ledger', ledgerSize(w), 1);
}

// ═════════════════════════════════════════════════════════════════
section('2 · TIMED — move, revise and flag, exactly like the real thing');
{
    const w = build(2);
    const KEY = answersFor(w, 1);

    reveal(w);
    ok('no per-question Submit under a clock', !live(w, 'submit'));
    ok('no Skip under a clock — a blank is just a blank', !live(w, 'skip'));
    ok('Mark for review is offered', !!$(w, 'flagq'));
    ok('Next is available immediately', live(w, 'next'));

    const first = otherThan(w, KEY[0]);
    ok('choosing shows NO feedback under a clock', !$(w, 'fb').classList.contains('show'));
    eq('and writes nothing to the ledger yet', ledgerSize(w), 0);

    pick(w, KEY[0]);
    ok('the answer can be revised freely', all(w, '.opt.sel')[0].dataset.l === KEY[0]);

    $(w, 'next').click();
    reveal(w);
    $(w, 'flagq').click();
    ok('flagging marks the question', /Flagged/.test($(w, 'flagq').textContent));
    ok('without answering it', all(w, '.opt.sel').length === 0);

    $(w, 'next').click();
    reveal(w);
    $(w, 'back').click();
    ok('going back keeps the flag', /Flagged/.test($(w, 'flagq').textContent));
    $(w, 'back').click();
    ok('and keeps the revised answer', all(w, '.opt.sel')[0].dataset.l === KEY[0]);
    ok('the prediction is not demanded again', !$(w, 'predict'));

    // Walk to the end.
    $(w, 'next').click(); $(w, 'next').click();
    eq('the last question offers a review, not a finish',
       $(w, 'next').textContent.trim(), 'Review answers');

    $(w, 'next').click();
    ok('the end-of-set check appears', shown($(w, 'hwReview')));
    eq('every question has a cell', all(w, '#hwRevGrid .qcell').length, 3);
    eq('one is answered', all(w, '#hwRevGrid .qcell.answered').length, 1);
    eq('two are blank', all(w, '#hwRevGrid .qcell.blank').length, 2);
    eq('one is flagged', all(w, '#hwRevGrid .qcell.flagged').length, 1);
    eq('nothing is graded until the set is submitted', ledgerSize(w), 0);

    all(w, '#hwRevGrid .qcell')[1].click();
    ok('a cell jumps back to that question', !shown($(w, 'hwReview')));
    ok('and lands on the right one', /Question 2/.test($(w, 'run').querySelector('.t').textContent));

    // Answer it now, then submit for real.
    pick(w, KEY[1]);
    $(w, 'next').click();
    $(w, 'next').click();
    $(w, 'hwRevSubmit').click();

    eq('submitting grades the answered questions only', ledgerSize(w), 2);
    ok('the review screen is reached', shown($(w, 'finish')));
    ok('feedback is finally available, all at once', all(w, '.rv').length === 3);
    ok('the blank is shown as not reached', all(w, '.rv.skip').length === 1);
}

// ═════════════════════════════════════════════════════════════════
section('3 · A revised answer counts once, as revised');
{
    const w = build(2);
    const KEY = answersFor(w, 1);
    reveal(w);
    otherThan(w, KEY[0]);            // wrong first
    pick(w, KEY[0]);                 // then corrected
    $(w, 'next').click(); $(w, 'next').click(); $(w, 'next').click();
    $(w, 'hwRevSubmit').click();

    const R = recs(w);
    ok('a record was written at all', R.length > 0);
    eq('the record holds the revised answer', R[0].chosen, KEY[0]);
    eq('and marks it correct', R[0].ok, true);
    eq('exactly one question reached the ledger', ledgerSize(w), 1);
    const row = Object.values(w.__ledger())[0];
    eq('the discarded wrong answer was never counted', row.wrong || 0, 0);
    ok('and the correct one was', (row.correct || 0) > 0);
}

// ═════════════════════════════════════════════════════════════════
// Async, and it has to be. The runner's clock is a real setInterval, so a
// busy-wait here would block Node's event loop and the timer would never fire —
// the test would "prove" the expiry path by preventing it from running.
(async function () {
    section('4 · The clock running out still grades what she did');
    const w = build(3);                  // 1-second clock
    const KEY = answersFor(w, 2);
    reveal(w);
    pick(w, KEY[0]);

    const done = () => shown($(w, 'finish'));
    const until = Date.now() + 6000;
    while (!done() && Date.now() < until) {
        await new Promise(r => setTimeout(r, 100));
    }

    ok('the set still ends on the review screen', done());
    eq('the answered question was graded and recorded', ledgerSize(w), 1);
    eq('the unanswered ones are kept as not reached', all(w, '.rv.skip').length, 2);
    ok('the end-of-set check is not left floating over the review',
       !shown($(w, 'hwReview')));

    console.log('\n' + '─'.repeat(64));
    if (fail) { console.log(fail + ' FAILED: ' + failed.join(' · ')); process.exit(1); }
    console.log('ALL ' + pass + ' ASSERTIONS PASSED');
})();
