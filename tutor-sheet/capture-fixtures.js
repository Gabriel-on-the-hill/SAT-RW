// ─────────────────────────────────────────────────────────────────
// capture-fixtures.js — records the payloads the two apps ACTUALLY post.
//
//   NODE_PATH=/tmp/j/node_modules node tutor-sheet/capture-fixtures.js
//
// Writes tutor-sheet/fixtures.json, which apps-script.test.js replays through
// the Apps Script `doPost`. The practice and challenge payloads come from driving
// the real app in jsdom, and the Math payload from calling the real
// MathSession.logCompletion() and intercepting its fetch.
//
// The homework payload is the exception: the runner builds its body inline, so that
// one is reproduced by hand in captureHomework() and held to the real thing by an
// assertion in apps-script.test.js. Read the note there before editing it — it has
// drifted before.
// ─────────────────────────────────────────────────────────────────
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch (e) { console.log('SKIP — jsdom not installed.'); process.exit(0); }

const APP = path.join(__dirname, '..');
const MATH = path.join(APP, '..', '..', '..', 'Michael SAT');
const read = f => fs.readFileSync(f, 'utf8');

// ── R&W: drive the real app ──────────────────────────────────────
function captureRW() {
    return new Promise(resolve => {
        const HTML = read(path.join(APP, 'index.html'))
            .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<link\b[^>]*>/gi, '');
        const dom = new JSDOM(HTML, {
            runScripts: 'dangerously', url: 'http://localhost/index.html',
            beforeParse(w) {
                w.__posts = [];
                w.fetch = (u, o) => { w.__posts.push(JSON.parse(o.body)); return Promise.resolve({ ok: true }); };
                w.alert = () => {}; w.confirm = () => true; w.scrollTo = () => {};
            },
        });
        const w = dom.window;
        w.sessionStorage.setItem('mastery_unlocked', '1');
        w.sessionStorage.setItem('mastery_user', 'Jeffrey');
        const files = ['gate.js', 'anti-cheat.js', 'config.js', 'progress.js', 'sheet-sync.js', 'storage.js',
            'timer.js', 'history.js', 'data-craft-structure.js', 'data-expression-of-ideas.js',
            'data-info-ideas.js', 'data-conventions.js', 'app.js', null,
            'data-challenge-jeffrey-p8.js', 'challenge/sets.js', 'challenge/challenge-core.js', 'challenge/challenge.js'];
        for (const f of files) {
            const s = w.document.createElement('script');
            s.textContent = f === null ? 'window.__peek=function(){return {aq:activeQuestions};};' : read(path.join(APP, f));
            w.document.body.appendChild(s);
        }
        w.document.addEventListener('DOMContentLoaded', () => {
            const answer = () => {
                for (let i = 0; i < 40; i++) {
                    const aq = w.__peek().aq;
                    if (i >= aq.length) break;
                    const r = w.document.getElementById('revealChoicesBtn'); if (r) r.click();
                    const btns = [...w.document.querySelectorAll('#optionsContainer .option-btn')];
                    const hit = btns.find(b => b.querySelector('.opt-letter').textContent[0] === aq[i].answer);
                    (hit || btns[0]).click();
                    w.document.getElementById('nextBtn').click();
                }
            };
            w.openChallenge();
            w.document.getElementById('cHowMany').value = '3';
            w.document.getElementById('cBeginBtn').click();
            answer();
            const challenge = w.__posts[w.__posts.length - 1];

            w.goToHub();
            w.startWeakAreaDrill();
            answer();
            const practice = w.__posts[w.__posts.length - 1];
            resolve({ challenge, practice });
        });
    });
}

// ── R&W homework: the one payload that is reproduced, not driven ──
// homework-run.html builds its body inline rather than through sheet-sync.js, and
// driving the whole runner here would mean standing up a plan and answering a set.
// So this mirrors that literal — and apps-script.test.js §4 asserts the key set
// still matches what the file actually sends, which is the only thing keeping the
// two honest.
//
// IT HAS ALREADY DRIFTED ONCE. This fixture went months without `questions` after
// the runner started sending them, so the guard that exists to catch a wrong key
// was itself failing and the suite's one red line was ignored. If you add a field
// to postLog(), add it here in the same commit.
function captureHomework() {
    return {
        type: 'homework', student: 'Segun', day: 2, focus: 'Transitions, at pace',
        score: 7, total: 10, seconds: 431, at: new Date().toISOString(),
        sessionId: 'hw_test_abc123',
        // Per-skill tally over the questions the review ladder brought BACK — the
        // durable-learning number. Only delayed retrievals, only ones reached.
        retention: { 'Inferences': { correct: 1, total: 2 } },
        questions: [
            // A spaced review, remembered.
            { id: 'inf-h-01', skill: 'Inferences', difficulty: 'Hard', chosen: 'B', correct: 'B',
              isCorrect: true, secs: 74, onText: 41, onOpts: 33,
              prediction: 'the author is about to concede a point' },
            // A spaced review, forgotten — this is what retention exists to show.
            { id: 'inf-m-04', skill: 'Inferences', difficulty: 'Medium', chosen: 'A', correct: 'C',
              isCorrect: false, secs: 52, onText: 30, onOpts: 22,
              prediction: 'a contrast is coming' },
            // A first meeting: acquisition, and deliberately NOT in `retention`.
            { id: 'tra-m-09', skill: 'Transitions', difficulty: 'Medium', chosen: 'D', correct: 'D',
              isCorrect: true, secs: 38, onText: 19, onOpts: 19,
              prediction: 'the second sentence gives the result' },
        ],
    };
}

// ── Math: call the real MathSession.logCompletion, intercept its POST ────
function captureMath() {
    return new Promise(resolve => {
        const store = new Map();
        const posts = [];
        const ctx = {
            console,
            window: {},
            localStorage: {
                getItem: k => (store.has(k) ? store.get(k) : null),
                setItem: (k, v) => store.set(k, String(v)),
                removeItem: k => store.delete(k),
            },
            fetch: (u, o) => { posts.push(JSON.parse(o.body)); return Promise.resolve({ ok: true }); },
            Promise,
            setTimeout,
        };
        vm.createContext(ctx);
        vm.runInContext(read(path.join(MATH, 'shared', 'session.js')), ctx, { filename: 'session.js' });

        // Exactly the object Challenge_App/challenge-app.js finish() passes.
        ctx.window.MathSession.logCompletion({
            sessionId: 'challenge_1752163200000',
            appId: 'Challenge_App', appName: 'Challenge Set', module: 'challenge',
            variant: 'drill', topicTitle: 'Challenge Set',
            score: 8, gradable: 10, ungraded: 0, missed: 2,
            durationMs: 412000, startedAt: 1752162788000, completedAt: 1752163200000,
            studentName: 'Jeffrey',
            domainBreakdown: 'Algebra 5/6; Problem-Solving and Data Analysis 3/4 · mastered 4/28',
            detail: [
                { id: 'hard_0121a235', app: 'Algebra_App', domain: 'Algebra', difficulty: 'hard', answered: true, correct: true },
                { id: 'hard_9d935bd8', app: 'PSDA_App', domain: 'Problem-Solving and Data Analysis', difficulty: 'hard', answered: true, correct: false },
            ],
        });
        setTimeout(() => resolve(posts[posts.length - 1]), 50);
    });
}

(async () => {
    const rw = await captureRW();
    const math = await captureMath();
    const fixtures = {
        _note: 'Captured from the running apps by capture-fixtures.js. Do not hand-edit.',
        capturedAt: new Date().toISOString(),
        rw_challenge: rw.challenge,
        rw_practice: rw.practice,
        rw_homework: captureHomework(),
        math_challenge: math,
    };
    const out = path.join(__dirname, 'fixtures.json');
    fs.writeFileSync(out, JSON.stringify(fixtures, null, 2));
    console.log('wrote ' + path.relative(APP, out));
    console.log('  rw_challenge   type=' + rw.challenge.type + ' questions=' + rw.challenge.questions.length + ' sessionId=' + !!rw.challenge.sessionId);
    console.log('  rw_practice    type=' + rw.practice.type + ' questions=' + rw.practice.questions.length);
    console.log('  math_challenge key=' + math.key + ' detail=' + math.payload.detail.length + ' sessionId=' + math.payload.sessionId);
})().catch(e => { console.error(e); process.exit(1); });
