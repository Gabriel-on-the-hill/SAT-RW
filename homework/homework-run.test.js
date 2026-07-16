// ─────────────────────────────────────────────────────────────────
// homework-run.test.js — the homework runner is a LEARNING loop, not a quiz.
//
//   npm install jsdom --prefix /tmp/j
//   NODE_PATH=/tmp/j/node_modules node homework/homework-run.test.js
//
// Skips cleanly if jsdom is absent.
//
// This file exists because every invariant it guards was once absent, and their
// absence was invisible. The old runner scored her and threw the questions away —
// it even told her to "look back over the explanations" when there was nowhere to
// look back to. Nothing failed. It just quietly taught her nothing.
//
// So: these are not style preferences. Each assertion is a thing a student needs
// in order to learn from a set, and each one is easy to delete by accident.
//
//   1. The options stay hidden until she has committed to a prediction.
//   2. Untimed → she TYPES the prediction. Timed → one click. Never typing under
//      a clock: she cannot type on test day, and it would corrupt the timing.
//   3. Every question survives the set — passage, her answer, the right answer, why.
//   4. Misses ask her to name the error and write the prediction that would have worked.
//   5. Her tags and notes persist, so she and the tutor can reopen them before class.
//   6. A redo never rewrites the first attempt. What she did under the clock is the
//      honest record; the redo only adds "put right on the redo".
//   7. Running out of time does not destroy the set.
//   8. A `sections` day draws an exact count per skill — see assignments.test.js for
//      why a multi-skill day without sections silently collapses to ONE skill.
//
// The test drives a synthetic __TEST__ plan, never a real student's, so that the
// tutor editing next week's homework can never break the suite.
// ─────────────────────────────────────────────────────────────────
'use strict';
const fs = require('fs');
const path = require('path');

let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch (e) { console.log('SKIP — jsdom not installed (see header).'); process.exit(0); }

// ── The only lines that differ between this app and the PSAT 8/9 app. ──────────
const CFG = {
    userKey: 'mastery_user',     // gate.js
    hwPrefix: 'wayne_hw_',       // "day done" flag
    recPrefix: 'wayne_hwrec_',   // the per-question record
};

const APP = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');

const RAW = read('homework-run.html');
const HTML = RAW.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<link\b[^>]*>/gi, '');
const SRCS = [...RAW.matchAll(/<script\s+src="([^"?]+)/gi)].map(m => m[1]);
const INLINE = RAW.match(/<script>\n?([\s\S]*?)<\/script>/)[1];

// data-*.js declares `const questionBank_II = [...]`. A top-level const is a global
// LEXICAL binding — the page's inline script can see it, but it never becomes a
// property of window, so the test cannot. This probe is a classic script injected
// after the banks, so it closes over them and hands them back.
// (prioritizePool/recordAnswer are function declarations, which DO land on window —
// that is why freezeDraw() can replace one.)
const PROBE = `window.__QB = function () {
    return [].concat(
        typeof questionBank_CS  !== 'undefined' ? questionBank_CS  : [],
        typeof questionBank_EOI !== 'undefined' ? questionBank_EOI : [],
        typeof questionBank_II  !== 'undefined' ? questionBank_II  : [],
        typeof questionBank_CON !== 'undefined' ? questionBank_CON : []);
};`;

// A plan we control. Real plans change every week; the engine must not.
const PLAN = {
    title: 'test',
    start: '2020-01-01',      // long past, so every day is unlocked
    unlock: 'cumulative',
    days: [
        { n: 1, focus: 'untimed', skills: ['Inferences'], diffs: ['Medium'], count: 3, minutes: 0, tip: 'x' },
        { n: 2, focus: 'timed', skills: ['Inferences'], diffs: ['Medium'], count: 3, minutes: 9, tip: 'x' },
        {
            n: 3, focus: 'mixed', minutes: 8, tip: 'x',
            sections: [
                { skills: ['Inferences'], diffs: ['Medium', 'Hard'], count: 1 },
                { skills: ['Central Ideas and Details'], diffs: ['Medium', 'Hard'], count: 1 },
                { skills: ['Words in Context'], diffs: ['Medium', 'Hard'], count: 1 },
            ],
        },
        // 1/60 min = a 1-second clock, so the expiry path runs for real rather than
        // being faked. minutes is only ever multiplied by 60, so a fraction is fine.
        { n: 4, focus: 'expiring', skills: ['Inferences'], diffs: ['Medium'], count: 3, minutes: 1 / 60, tip: 'x' },
    ],
};

function build(day) {
    const dom = new JSDOM(HTML, {
        runScripts: 'dangerously',
        url: `http://localhost/homework-run.html?student=__TEST__&day=${day}`,
        beforeParse(w) {
            // Capture, don't discard: §10 asserts the shape of what we post. The
            // homework logger posted its questions under the wrong key for months
            // and nothing failed, because nothing looked.
            w.__posts = [];
            w.fetch = (url, opt) => {
                try { w.__posts.push(JSON.parse((opt && opt.body) || '{}')); } catch (e) {}
                return Promise.resolve({ ok: true });
            };
            w.scrollTo = () => {};
            w.alert = () => {};
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
    freezeDraw(w);
    installClock(w);
    const s = w.document.createElement('script');
    s.textContent = INLINE;
    w.document.body.appendChild(s);
    return w;
}

// prioritizePool() Fisher-Yates-shuffles each bucket, so a real draw is random and
// a test cannot know which option is right. These tests are about the RUNNER, not
// the draw, so we freeze the draw and keep the real one for section 9, which is
// where the shuffle and the requeue actually get tested.
function freezeDraw(w) {
    w.__realPrioritize = w.prioritizePool;
    w.prioritizePool = pool => pool.slice();
}

// Reopen the same page with the same localStorage — i.e. what she sees tomorrow.
function reopen(day, store, mode) {
    const dom = new JSDOM(HTML, {
        runScripts: 'dangerously',
        url: `http://localhost/homework-run.html?student=__TEST__&day=${day}` + (mode ? '&mode=' + mode : ''),
        beforeParse(w) { w.fetch = () => Promise.resolve({ ok: true }); w.scrollTo = () => {}; },
    });
    const w = dom.window;
    w.sessionStorage.setItem('mastery_unlocked', '1');
    w.sessionStorage.setItem(CFG.userKey, '__TEST__');
    for (const [k, v] of Object.entries(store)) w.localStorage.setItem(k, v);
    for (const f of SRCS) {
        const s = w.document.createElement('script');
        s.textContent = read(f);
        w.document.body.appendChild(s);
    }
    const probe = w.document.createElement('script');
    probe.textContent = PROBE;
    w.document.body.appendChild(probe);
    w.HOMEWORK['__TEST__'] = JSON.parse(JSON.stringify(PLAN));
    freezeDraw(w);
    installClock(w);
    const s = w.document.createElement('script');
    s.textContent = INLINE;
    w.document.body.appendChild(s);
    return w;
}

let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, detail) {
    if (cond) { pass++; console.log('  ✓ ' + name); }
    else { fail++; fails.push(name); console.log('  ✗ ' + name + (detail ? ' — ' + detail : '')); }
}
function eq(name, a, b) { ok(name, a === b, 'got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b)); }
function section(t) { console.log('\n' + t); }

const $ = (w, id) => w.document.getElementById(id);
const all = (w, sel) => [...w.document.querySelectorAll(sel)];
const shown = el => !!el && !el.classList.contains('hidden');
const recs = w => {
    const k = Object.keys(w.localStorage).find(x => x.startsWith(CFG.recPrefix));
    return k ? JSON.parse(w.localStorage.getItem(k)).recs : null;
};
const dump = w => {
    const o = {};
    for (let i = 0; i < w.localStorage.length; i++) { const k = w.localStorage.key(i); o[k] = w.localStorage.getItem(k); }
    return o;
};

// The choices are locked until she has been on the text long enough to have read
// it (minReadSecs). A test cannot sit through that, so it advances a virtual clock
// instead — every helper that reveals the choices first jumps far enough forward
// that the read-gate is satisfied. See "the read-gate" section for the tests that
// deliberately do NOT skip, and assert the lock holds.
let CLOCK_SKEW = 0;
function installClock(w) {
    const real = w.Date.now.bind(w.Date);
    w.Date.now = () => real() + CLOCK_SKEW;
}
function waitOutReadGate() { CLOCK_SKEW += 60000; }   // 60s > the 45s cap

function commit(w, text) {
    if ($(w, 'predText')) $(w, 'predText').value = text || 'my prediction';
    waitOutReadGate();
    $(w, 'predGo').click();
}

// The runner builds its set inside a closure and never publishes the answer key,
// so setAnswersFor() mirrors the build to learn it. That lets a test MISS on
// purpose — without which there is nothing to review, redo or tag.
function pickWrong(w) {
    const qNo = +$(w, 'run').querySelector('.t').textContent.match(/Question (\d+)/)[1];
    const ans = w.__setAnswers[qNo - 1];
    all(w, '.opt').find(b => b.dataset.l !== ans).click();
}
function pickRight(w) {
    const qNo = +$(w, 'run').querySelector('.t').textContent.match(/Question (\d+)/)[1];
    const ans = w.__setAnswers[qNo - 1];
    all(w, '.opt').find(b => b.dataset.l === ans).click();
}

// Mirrors the runner's build to learn the answer key. Safe only because
// freezeDraw() made the draw deterministic.
function setAnswersFor(w, dayIdx) {
    const QB = w.__QB();
    const spec = PLAN.days[dayIdx];
    const pick = (pool, n) => w.prioritizePool(pool).slice(0, n);
    let set = [];
    if (spec.sections) {
        const used = {};
        spec.sections.forEach(sec => {
            const pool = QB.filter(q => !used[q.id] && sec.skills.includes(q.skill) && sec.diffs.includes(q.difficulty));
            const got = pick(pool, sec.count);
            got.forEach(q => used[q.id] = true);
            set = set.concat(got);
        });
    } else {
        set = pick(QB.filter(q => spec.skills.includes(q.skill) && spec.diffs.includes(q.difficulty)), spec.count);
    }
    w.__setAnswers = set.map(q => q.answer);
    w.__setSkills = set.map(q => q.skill);
    return set;
}

// ═════════════════════════════════════════════════════════════════
section('1 · The options are hidden until she has predicted');
{
    const w = build(1);
    setAnswersFor(w, 0);
    ok('a prediction step is shown', !!$(w, 'predict'));
    ok('the options are HIDDEN', !shown($(w, 'opts')));
    ok('untimed → she must TYPE the prediction', !!$(w, 'predText'));
    ok('untimed → no clock', $(w, 'timer').style.display !== 'inline-block');

    // ── the read-gate ──────────────────────────────────────────────────────────
    // The predict box used to ask only that she type SOMETHING: three characters
    // cleared it, so "abc" ten times submitted a full set in FOUR SECONDS. Length
    // is the wrong gate — a correct prediction here is often one word ("semicolon")
    // — so the gate is TIME on the text. These two assertions are that gate.
    $(w, 'predGo').click();                       // instantly, without reading
    ok('the choices stay LOCKED if she has not been on the text', !shown($(w, 'opts')));
    ok('and she is told why, not just left with a dead button',
        $(w, 'readErr').classList.contains('show'));

    waitOutReadGate();
    $(w, 'predGo').click();                       // read the text, but predicted nothing
    ok('an empty prediction is refused', $(w, 'predErr').classList.contains('show'));
    ok('the options are STILL hidden', !shown($(w, 'opts')));

    commit(w, 'the author is conceding a point');
    ok('committing reveals the options', shown($(w, 'opts')));
    ok('the prediction step is retired', !$(w, 'predict'));
    ok('her prediction is shown back to her', /conceding/.test($(w, 'yourpred').textContent));
}

// ═════════════════════════════════════════════════════════════════
section('2 · A timed set gates the options WITHOUT making her type');
{
    const w = build(2);
    ok('a prediction step is still shown', !!$(w, 'predict'));
    ok('the options are hidden', !shown($(w, 'opts')));
    ok('timed → NO textarea (she cannot type on test day)', !$(w, 'predText'));
    ok('timed → the clock is running', $(w, 'timer').style.display === 'inline-block');
    $(w, 'predGo').click();
    ok('one click reveals the options', shown($(w, 'opts')));
    // NOT read-gated, deliberately. Under a clock the pressure IS the clock, and a
    // locked reveal could cost her the last question — "running out of time must
    // not destroy the set". The gate belongs on the untimed sets, where she is
    // learning the method and there is nothing else stopping her clicking through.
    ok('a timed set is NOT read-gated — the reveal is instant', shown($(w, 'opts')));
}

// ═════════════════════════════════════════════════════════════════
section('3 · Every question survives the set, and the misses ask for work');
let store, missCount;
{
    const w = build(1);
    setAnswersFor(w, 0);
    for (let i = 0; i < 3; i++) {
        commit(w, 'prediction ' + (i + 1));
        pickWrong(w);                       // miss everything, so there is work to review
        $(w, 'next').click();
    }
    ok('the review screen appears', shown($(w, 'finish')));

    const cards = all(w, '.rv');
    eq('every question is on the review screen', cards.length, 3);
    eq('every explanation is re-readable', all(w, '.rv .exp').length, 3);
    ok('the passage can be reopened', all(w, '.rv details summary').length === 3);
    ok('her answer and the right answer are both shown', all(w, '.rv .ans').length >= 6);
    ok('her prediction is replayed', all(w, '.rv .yourpred').length === 3);
    ok('time-on-text is recorded', /on the text/.test(all(w, '.rv .rvm')[0].textContent));

    missCount = all(w, '.rv.miss').length;
    eq('all three are logged as misses', missCount, 3);
    eq('every miss asks what went wrong', all(w, '.rv.miss .tags').length, 3);
    eq('every miss asks for the prediction that would have worked', all(w, '.rv.miss .fix').length, 3);

    // Name the error and write the fix.
    all(w, '.rv.miss .tag')[0].click();
    eq('a reason can be tagged', all(w, '.rv.miss .tag.on').length, 1);
    const fix = all(w, '.rv.miss .fix')[0];
    fix.value = 'should have predicted: the author concedes a point';
    fix.dispatchEvent(new w.Event('input'));

    const r = recs(w);
    ok('the record is persisted', Array.isArray(r) && r.length === 3);
    ok('the tag is persisted', r.some(x => x.tag));
    store = dump(w);
}

// ═════════════════════════════════════════════════════════════════
section('4 · Correct answers are not given busywork');
{
    const w = build(1);
    setAnswersFor(w, 0);
    for (let i = 0; i < 3; i++) { commit(w, 'my prediction'); pickRight(w); $(w, 'next').click(); }
    eq('all three correct', all(w, '.rv.ok').length, 3);
    eq('no miss-tagging on a question she nailed', all(w, '.rv.ok .tags').length, 0);
    eq('nothing left to redo', all(w, '#redo').length, 0);
}

// ═════════════════════════════════════════════════════════════════
section('5 · It is all still there tomorrow');
{
    // The debounced save needs a beat before we snapshot; re-save synchronously by
    // reopening from the store captured above.
    const w = reopen(1, store, 'review');
    eq('the whole set survives a reload', all(w, '.rv').length, 3);
    ok('her tag survives', all(w, '.rv.miss .tag.on').length >= 1);
    ok('the explanations are still there', all(w, '.rv .exp').length === 3);
}

// ═════════════════════════════════════════════════════════════════
section('6 · A redo never rewrites the honest first attempt');
{
    const w = build(1);
    setAnswersFor(w, 0);
    for (let i = 0; i < 3; i++) { commit(w, 'my prediction'); pickWrong(w); $(w, 'next').click(); }

    const before = JSON.parse(JSON.stringify(recs(w)));
    ok('a redo is offered', !!$(w, 'redo'));
    ok('the redo names the count', /Redo the 3 you missed/.test($(w, 'redo').textContent));

    $(w, 'redo').click();
    ok('the redo is untimed, so she types again', !!$(w, 'predText'));
    ok('the redo is labelled a redo', /redo/.test($(w, 'run').querySelector('.t').textContent));

    // Answer them correctly this time.
    for (let i = 0; i < 3; i++) {
        commit(w, 'second attempt');
        const id = all(w, '.opt');
        const want = recs(w).filter(r => !r.ok && !r.redoOk)[0].answer;
        id.find(b => b.dataset.l === want).click();
        $(w, 'next').click();
    }

    const after = recs(w);
    eq('the redo marks them put right', all(w, '.rv .fixed').length, 3);
    eq('they are STILL shown as misses — the first attempt stands', all(w, '.rv.miss').length, 3);
    ok('what she chose first was not overwritten', after.every((r, i) => r.chosen === before[i].chosen));
    ok('whether she got it first time was not overwritten', after.every((r, i) => r.ok === before[i].ok));
    ok('the redo result is recorded separately', after.every(r => r.redoOk === true));
    eq('nothing left to redo', all(w, '#redo').length, 0);
}

// ═════════════════════════════════════════════════════════════════
section('7 · Running out of time does not destroy the set');
{
    const w = build(4);
    setAnswersFor(w, 3);
    commit(w, 'only answering the first one');
    pickRight(w);
    // Do NOT click next. Let the clock run out.
    setTimeout(() => {
        ok('the review screen is shown anyway', shown($(w, 'finish')));
        const r = recs(w);
        ok('the answered question is kept', r[0].chosen !== null);
        ok('the unanswered ones are kept as not-reached', r.slice(1).every(x => x.chosen === null));
        ok('and are tagged as out of time', r.slice(1).every(x => x.tag === 'I ran out of time'));
        ok('the review names them "Not reached"', /Not reached/.test($(w, 'finish').textContent));
        finish();
    }, 1600);   // the set's clock is 1 second; give it room to fire
}

function finish() {
    // ═════════════════════════════════════════════════════════════════
    section('8 · A sections day draws from every skill it names');
    {
        const w = build(3);
        const set = setAnswersFor(w, 2);
        eq('the set is the sum of its sections', set.length, 3);
        eq('and spans all three skills', new Set(w.__setSkills).size, 3);
    }

    // ═════════════════════════════════════════════════════════════════
    section('9 · The REAL draw brings her misses back');
    {
        // Everything above freezes the draw. Here we use the genuine one, because a
        // miss that never comes back is a miss she never learns from.
        const w = build(1);
        const real = w.__realPrioritize;
        const QB = w.__QB();
        const pool = QB.filter(q => q.skill === 'Inferences' && q.difficulty === 'Medium');

        ok('there is a pool to draw from', pool.length >= 4);
        w.recordAnswer(pool[pool.length - 1].id, false, 'homework');   // miss the LAST one
        const drawn = real(pool).slice(0, 1).map(q => q.id);
        eq('a missed question is drawn first next time', drawn[0], pool[pool.length - 1].id);

        // ...but only from a pool that matches its skill AND difficulty. This is the
        // trap that makes a plan's difficulty ladder silently drop her misses.
        const harder = QB.filter(q => q.skill === 'Inferences' && q.difficulty === 'Hard');
        ok('a Medium miss cannot return in a Hard-only pool',
            !real(harder).some(q => q.id === pool[pool.length - 1].id));
    }

    // ═════════════════════════════════════════════════════════════════
    section('10 · The tutor actually receives the prediction');
    {
        // This is the bug that hid for months. postLog() posted its per-question array
        // under `detail`, with its own field names; the Apps Script reads `questions`
        // with sheet-sync.js's names. Wrong key → the array was dropped server-side and
        // NOT ONE homework question row was ever written. The score still arrived, so
        // the sheet looked fine. The predictions — the reasoning the class reviews
        // together — went nowhere.
        //
        // These assertions pin the wire contract. If you rename a field here, rename it
        // in tutor-sheet/rw-apps-script.gs in the same commit.
        const w = build(1);                         // day 1 is a 3-question set
        setAnswersFor(w, 0);
        commit(w, 'the author is conceding a point');
        pickRight(w);
        $(w, 'next').click();
        commit(w, 'a contrast is coming');
        pickWrong(w);
        $(w, 'next').click();
        commit(w, 'the study failed to replicate');
        pickRight(w);
        $(w, 'next').click();                       // last question → finish() → postLog()

        const post = (w.__posts || []).find(p => p.type === 'homework');
        ok('a homework session is posted at all', !!post);
        ok('the per-question array is under `questions` (NOT `detail`)',
            Array.isArray(post && post.questions), 'got keys: ' + Object.keys(post || {}));

        const q0 = (post && post.questions && post.questions[0]) || {};
        ok('the prediction she typed is in the payload',
            /conceding/.test(q0.prediction || ''), 'got ' + JSON.stringify(q0.prediction));
        ok('time-on-text is sent separately, not averaged away', typeof q0.onText === 'number');
        ok('and time-on-options with it', typeof q0.onOpts === 'number');

        // The names the Apps Script destructures. A typo here writes blank columns.
        for (const f of ['id', 'skill', 'difficulty', 'chosen', 'correct', 'isCorrect', 'secs'])
            ok('the field the Apps Script reads is present: ' + f, f in q0);
    }

    // ═════════════════════════════════════════════════════════════════
    section('11 · Difficulty calibration leans a range, and never overrides the tutor');
    {
        // ~85% success is where learning is maximised (`AS-4`). Calibration nudges a
        // cruising student up and an overloaded one down — but ONLY inside a range the
        // tutor already allowed. The recommender itself is unit-tested in
        // review-ladder.test.js; what is tested here is the thing that could actually
        // hurt a student: the draw.
        //
        // Day 3's sections list diffs ["Medium","Hard"] — a range, i.e. the tutor
        // saying either end is fine. Day 1 pins ["Medium"] — a decision, not a range.
        const TRAP = 'wayne_trap_stats___TEST__';
        const traps = pct => JSON.stringify({
            'Inferences — general': { skill: 'Inferences', total: 20, wrong: Math.round(20 * (1 - pct)) },
        });

        // Both ends of the range must actually exist, or this section would "pass" by
        // drawing the only thing available.
        {
            const QB = build(1).__QB();
            const inf = d => QB.filter(q => q.skill === 'Inferences' && q.difficulty === d).length;
            ok('the bank holds both ends of the range to choose between', inf('Medium') > 0 && inf('Hard') > 0,
                `Medium=${inf('Medium')} Hard=${inf('Hard')}`);
        }

        const runDay = (day, store) => {
            const w = reopen(day, store);
            for (let i = 0; i < 3; i++) { commit(w, 'p'); all(w, '.opt')[0].click(); $(w, 'next').click(); }
            return recs(w);
        };

        // Section 1 of day 3 is the Inferences section, and it is drawn first.
        const up = runDay(3, { [TRAP]: traps(0.95) })[0];
        ok('a student cruising at 95% is drawn UP to Hard within the range',
            up.skill === 'Inferences' && up.difficulty === 'Hard', JSON.stringify(up));

        const down = runDay(3, { [TRAP]: traps(0.70) })[0];
        ok('a student overloaded at 70% is drawn DOWN to Medium in the same section',
            down.skill === 'Inferences' && down.difficulty === 'Medium', JSON.stringify(down));

        // THE GUARDRAIL. A day that pins one difficulty is the tutor's explicit choice
        // and calibration must not perturb it by so much as a question. The draw is
        // frozen here, so an identical set is a real assertion and not luck.
        const plain    = runDay(1, {}).map(r => r.id);
        const cruising = runDay(1, { [TRAP]: traps(0.95) }).map(r => r.id);
        ok('a day that PINS a difficulty is untouched, however well the student is doing',
            JSON.stringify(plain) === JSON.stringify(cruising),
            'never promote a student to a difficulty the day did not list');

        // And the exact-count guarantee that `sections` exists for survives all of it.
        eq('a calibrated sections day still draws its exact count', runDay(3, { [TRAP]: traps(0.95) }).length, 3);
    }

    console.log('\n' + '─'.repeat(64));
    if (fail) { console.log(`${fail} FAILED: ` + fails.join(' · ')); process.exit(1); }
    console.log(`ALL ${pass} ASSERTIONS PASSED`);
}
