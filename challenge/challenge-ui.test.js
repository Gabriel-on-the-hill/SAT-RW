// ─────────────────────────────────────────────────────────────────
// challenge-ui.test.js — integration smoke test for the Challenge UI.
//
// Needs jsdom, which this app does not otherwise depend on (it is a no-build
// static site). Install it anywhere and point NODE_PATH at it:
//
//   npm install jsdom --prefix /tmp/j
//   NODE_PATH=/tmp/j/node_modules node challenge/challenge-ui.test.js
//
// Skips cleanly if jsdom is absent.
//
// It loads the REAL index.html and the REAL app.js, and injects every script
// as a <script> element rather than eval()ing it. That matters: `let userMode`
// and `const questionBank` are global *lexical* bindings, which eval would
// scope away. The exam-mode guard depends on a later classic script being able
// to reassign `userMode`, so the test has to reproduce that mechanism exactly.
// ─────────────────────────────────────────────────────────────────
'use strict';
const fs = require('fs');
const path = require('path');

let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch (e) { console.log('SKIP — jsdom not installed (see header).'); process.exit(0); }

const APP = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');

// index.html, minus its own <script>/<link> tags — we inject the local ones
// ourselves, in order, and never touch the network.
const HTML = read('index.html')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<link\b[^>]*>/gi, '');

const SCRIPTS = [
    'gate.js', 'config.js', 'progress.js', 'sheet-sync.js', 'storage.js', 'timer.js', 'history.js',
    'data-craft-structure.js', 'data-expression-of-ideas.js', 'data-info-ideas.js', 'data-conventions.js',
    'app.js',
    // test-only probe: a classic script, so it closes over app.js's lexical globals
    null,
    'data-challenge-jeffrey-p8.js', 'challenge/sets.js', 'challenge/challenge-core.js', 'challenge/challenge.js',
];
const PROBE = 'window.__peek = function(){ return { activeQuestions: activeQuestions, userMode: userMode }; };';

// Scripts run while document.readyState === 'loading', exactly as they do in a
// browser for tags at the end of <body>. challenge.js therefore defers boot()
// to DOMContentLoaded, and the test has to wait for it.
function build(student, search) {
    return new Promise(resolve => {
        const dom = new JSDOM(HTML, {
            runScripts: 'dangerously',
            url: 'http://localhost/index.html' + (search || ''),
            beforeParse(w) {
                w.__posts = [];
                w.fetch = (url, opts) => { w.__posts.push(JSON.parse(opts.body)); return Promise.resolve({ ok: true }); };
                w.alert = () => {};
                w.confirm = () => true;
                w.scrollTo = () => {};
            },
        });
        const w = dom.window;
        w.sessionStorage.setItem('mastery_unlocked', '1');
        w.sessionStorage.setItem('mastery_user', student);
        for (const f of SCRIPTS) {
            const s = w.document.createElement('script');
            s.textContent = f === null ? PROBE : read(f);
            w.document.body.appendChild(s);
        }
        if (w.document.readyState !== 'loading') return resolve(w);
        // registered after challenge.js's, so boot() has already run
        w.document.addEventListener('DOMContentLoaded', () => resolve(w));
    });
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
const txt = el => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
const ledger = w => JSON.parse(w.localStorage.getItem('satrw_progress_Jeffrey') || 'null');

async function main() {
// ═════════════════════════════════════════════════════════════════
section('1 · The tile appears only for a student who has a set');
{
    const w = await build('Jeffrey');
    const tile = $(w, 'challengeTile');
    ok('Jeffrey gets a tile', !!tile);
    ok('tile shows the live tally', /Mastered 0 of 28/.test(txt(tile)), txt(tile));
    ok('tile names the source', /Practice Test 8/.test(txt(tile)));

    const b = await build('Bruce');
    ok('Bruce gets no tile', !$(b, 'challengeTile'));
    ok('Bruce gets no challenge screen', !$(b, 'challengeScreen'));
}

// ═════════════════════════════════════════════════════════════════
section('2 · The start screen and its gates');
{
    const w = await build('Jeffrey');
    w.openChallenge();
    const scr = $(w, 'challengeScreen');
    eq('screen is shown', scr.style.display, 'block');
    ok('tally rendered', /Mastered 0 of 28 \(0%\)/.test(txt(scr)));
    ok('segments rendered', /not attempted 28/.test(txt(scr)));
    eq('default session size', $(w, 'cHowMany').value, '10');
    ok('debrief offered for 16 misses', /Review your 16 misses/.test(txt(scr)));
    ok('Begin offered (gate=normal)', !!$(w, 'cBeginBtn'));

    // Drive the ledger to "every question correct once" → confirm gate.
    const ids = w.CHALLENGE_SETS.Jeffrey[0].ids;
    const led = {};
    ids.forEach(id => { led[id] = { correct: 1, wrong: 0, lastSeen: Date.now() }; });
    w.localStorage.setItem('satrw_progress_Jeffrey', JSON.stringify(led));
    w.openChallenge();
    ok('confirm gate: no Begin button', !$(w, 'cBeginBtn'));
    ok('confirm gate: offers the confirm pass', /Confirm the 28 you only got right once/.test(txt($(w, 'challengeScreen'))));

    // …and to "all mastered" → done gate.
    ids.forEach(id => { led[id] = { correct: 2, wrong: 0, lastSeen: Date.now() }; });
    w.localStorage.setItem('satrw_progress_Jeffrey', JSON.stringify(led));
    w.openChallenge();
    ok('done gate: declares mastery', /Every question in this set is mastered/.test(txt($(w, 'challengeScreen'))));
    ok('done gate: offers reattempt-all', !!$(w, 'cReattemptBtn'));
}

// ═════════════════════════════════════════════════════════════════
section('3 · Layer 1 (debrief) never touches the mastery ledger');
{
    const w = await build('Jeffrey');
    w.openChallenge();
    $(w, 'cDebriefBtn').click();
    const scr = $(w, 'challengeScreen');
    ok('debrief opens on the first miss', /Review 1 of 16/.test(txt(scr)));
    ok('debrief is labelled unscored', /Nothing on this screen counts toward mastery/.test(txt(scr)));

    const before = w.localStorage.getItem('satrw_progress_Jeffrey');
    w.document.querySelector('#cOpts .copt').click();      // answer it
    ok('explanation revealed', /Choice/.test(txt($(w, 'cReveal'))));
    ok('correct choice highlighted', !!w.document.querySelector('#cOpts .copt.right'));
    eq('ledger untouched', w.localStorage.getItem('satrw_progress_Jeffrey'), before);
    eq('ledger is still empty', ledger(w), null);
}

// ═════════════════════════════════════════════════════════════════
section('4 · The exam-mode guard  (the reason this test exists)');
{
    const w = await build('Jeffrey');

    // First, prove the hazard is real: an exam-sourced correct answer is
    // worth 2, so one answer masters a never-seen question.
    w.recordAnswer('probe', true, 'exam');
    eq('exam credit is double', ledger(w).probe.correct, 2);
    ok('…which alone clears the mastery threshold', w._isMastered(ledger(w).probe) === true);
    w.localStorage.removeItem('satrw_progress_Jeffrey');

    // Now start a challenge session and try to switch into Exam mode.
    w.openChallenge();
    $(w, 'cHowMany').value = '3';
    $(w, 'cBeginBtn').click();

    eq('session is running', $(w, 'app').style.display, 'flex');
    ok('three questions served', /Q 1 \/ 3/.test(txt($(w, 'questionCounter'))));

    const sel = $(w, 'modeSelect');
    const examOpt = sel.querySelector('option[value="exam"]');
    ok('Exam option disabled', examOpt.disabled === true);
    ok('Exam option hidden', examOpt.hidden === true);
    eq('mode pinned to assisted', sel.value, 'assisted');
    eq('userMode pinned to assisted', w.__peek().userMode, 'assisted');

    // Force it anyway, the way a determined student with devtools would.
    sel.value = 'exam';
    sel.dispatchEvent(new w.Event('change'));
    eq('guard reverts the select', sel.value, 'assisted');
    eq('guard reverts userMode', w.__peek().userMode, 'assisted');

    // Answer all three correctly and check the credit actually recorded.
    for (let i = 0; i < 3; i++) {
        const q = w.__peek().activeQuestions[i];
        const reveal = $(w, 'revealChoicesBtn');
        if (reveal) reveal.click();
        const btns = [...w.document.querySelectorAll('#optionsContainer .option-btn')];
        btns.find(b => b.querySelector('.opt-letter').textContent[0] === q.answer).click();
        $(w, 'nextBtn').click();
    }
    const led = ledger(w);
    const answered = Object.keys(led);
    eq('three questions recorded', answered.length, 3);
    ok('every answer sourced as practice', answered.every(k => led[k].lastSource === 'practice'));
    ok('every correct worth exactly 1', answered.every(k => led[k].correct === 1));
    ok('nothing mastered in a single pass', answered.every(k => !w._isMastered(led[k])));
}

// ═════════════════════════════════════════════════════════════════
section('5 · Completion is decorated with the challenge tally');
{
    const w = await build('Jeffrey');
    w.openChallenge();
    $(w, 'cHowMany').value = '1';
    $(w, 'cBeginBtn').click();
    const q = w.__peek().activeQuestions[0];
    const reveal = $(w, 'revealChoicesBtn');
    if (reveal) reveal.click();
    [...w.document.querySelectorAll('#optionsContainer .option-btn')]
        .find(b => b.querySelector('.opt-letter').textContent[0] === q.answer).click();
    $(w, 'nextBtn').click();

    eq('completion shown', $(w, 'completionScreen').style.display, 'flex');
    const box = $(w, 'challengeCompletion');
    ok('challenge tally injected', !!box);
    ok('tally counts the set, not the session', /Mastered 0 of 28/.test(txt(box)), txt(box));
    ok('correct-once reflected', /correct once 1/.test(txt(box)), txt(box));
    ok('Back to Challenge offered', !!$(w, 'cBackToChallenge'));

    // Leaving the challenge must release the Exam option.
    w.goToHub();
    const examOpt = $(w, 'modeSelect').querySelector('option[value="exam"]');
    ok('Exam re-enabled after leaving', examOpt.disabled === false && examOpt.hidden === false);
    eq('challenge screen hidden', $(w, 'challengeScreen').style.display, 'none');
    ok('hub tile tally refreshed', /Mastered 0 of 28/.test(txt($(w, 'challengeTile'))));
}

// ═════════════════════════════════════════════════════════════════
section('6 · index.html?challenge=1 opens the challenge directly');
{
    const plain = await build('Jeffrey');
    eq('no deep link → hub stays up', $(plain, 'hubScreen').style.display, 'flex');

    const deep = await build('Jeffrey', '?challenge=1');
    eq('deep link → challenge screen', $(deep, 'challengeScreen').style.display, 'block');
    eq('deep link → hub hidden', $(deep, 'hubScreen').style.display, 'none');
    ok('start screen rendered', /Mastered 0 of 28/.test(txt($(deep, 'challengeScreen'))));
}

// ═════════════════════════════════════════════════════════════════
section("7 · The tutor's sheet can tell challenge work apart");
{
    const w = await build('Jeffrey');
    const answerAll = () => {
        for (let i = 0; i < 40; i++) {
            const aq = w.__peek().activeQuestions;
            if (i >= aq.length) break;
            const reveal = $(w, 'revealChoicesBtn');
            if (reveal) reveal.click();
            const btns = [...w.document.querySelectorAll('#optionsContainer .option-btn')];
            const hit = btns.find(b => b.querySelector('.opt-letter').textContent[0] === aq[i].answer);
            (hit || btns[0]).click();
            $(w, 'nextBtn').click();
        }
    };

    w.openChallenge();
    $(w, 'cHowMany').value = '1';
    $(w, 'cBeginBtn').click();
    answerAll();

    const post = w.__posts[w.__posts.length - 1];
    ok('a session was posted', !!post);
    eq('type is challenge, not practice', post.type, 'challenge');
    eq('carries the set id', post.assignmentId, 'p8-rw');
    eq('carries the set title', post.assignmentTitle, 'Practice 8 misses');
    ok('per-question diagnostics survive', Array.isArray(post.questions) && post.questions.length === 1);

    // Ordinary practice must still post as practice — the stamp is scoped.
    w.goToHub();
    w.startWeakAreaDrill();
    answerAll();
    const last = w.__posts[w.__posts.length - 1];
    eq('practice still posts as practice', last.type, 'practice');
    eq('and carries no assignment id', last.assignmentId, '');
}

}

main().then(() => {
    console.log('\n' + '─'.repeat(64));
    console.log(fail === 0 ? `ALL ${pass} ASSERTIONS PASSED`
                           : `${pass} passed, ${fail} FAILED:\n  - ` + fails.join('\n  - '));
    process.exit(fail === 0 ? 0 : 1);
    
}).catch(e => { console.error(e); process.exit(1); });
