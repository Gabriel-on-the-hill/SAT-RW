// ─────────────────────────────────────────────────────────────────
// eliminator.test.js — the Bluebook cross-out tool on the practice / exam runner.
//
//   node eliminator.test.js          (needs jsdom; skips cleanly without it)
//
// The homework runner's half of this lives in homework/homework-run.test.js §13 and
// the class route's half in challenge/structured-class.test.js. This file covers the
// shared engine (eliminator.js) on index.html's runner, and what reaches the tutor.
//
// What must stay true:
//   1. Crossing out never selects, and selecting never crosses out.
//   2. The option buttons are unchanged: same count, same classes, same letters, so
//      keyboard selection, paintSelection() and every test that counts options hold.
//   3. Choosing a crossed-out choice brings it back (Bluebook's rule).
//   4. The selected choice cannot be crossed out; a graded question locks the tool.
//   5. Going Back to a question shows what was crossed out.
//   6. The session payload carries `elim` and `elimAnswer` per question.
// ─────────────────────────────────────────────────────────────────
'use strict';
const assert = require('assert/strict'), fs = require('fs'), path = require('path');
let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch (e) { console.log('SKIP — jsdom not installed.'); process.exit(0); }

const APP = __dirname, read = f => fs.readFileSync(path.join(APP, f), 'utf8');
const html = read('index.html').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<link\b[^>]*>/gi, '');
let count = 0;
function ok(c, m) { assert.ok(c, m); count++; console.log('  ✓ ' + m); }

const dom = new JSDOM(html, {
    url: 'http://localhost/index.html', runScripts: 'dangerously',
    beforeParse(w) {
        w.__posts = [];
        w.fetch = (u, o) => { try { w.__posts.push(JSON.parse(o.body)); } catch (e) { } return Promise.resolve({ ok: true }); };
        w.alert = () => { }; w.confirm = () => true; w.scrollTo = () => { };
    }
});
const w = dom.window, $ = id => w.document.getElementById(id);
w.sessionStorage.setItem('mastery_user', 'ElimTest');
function inject(s) { const e = w.document.createElement('script'); e.textContent = s; w.document.body.appendChild(e); }
for (const f of ['config.js', 'progress.js', 'sheet-sync.js', 'session-responses.js', 'storage.js', 'timer.js', 'history.js',
    'data-craft-structure.js', 'data-expression-of-ideas.js', 'data-info-ideas.js', 'data-conventions.js', 'eliminator.js', 'app.js'])
    inject(read(f));
inject('window.__peek=function(){return {questions:activeQuestions,answers:responses,bank:questionBank,mode:userMode};};');

async function main() {
    if (w.document.readyState === 'loading') await new Promise(r => w.document.addEventListener('DOMContentLoaded', r));
    const bank = w.__peek().bank.filter(q => q.options && q.options.length === 4 && !q.image).slice(0, 3);
    ok(w.launchSession(bank, 'exam', { mode: 'off', total: 0 }) !== false, 'an exam-mode sitting starts');
    const box = $('optionsContainer');
    const opts = () => [...box.querySelectorAll('.option-btn')];

    console.log('\n1 · The options are unchanged, and the tool is off until asked for');
    ok(opts().length === 4 && box.children.length === 4, 'exactly four option buttons, and nothing else in the container');
    ok(opts().every(b => b.querySelector('.opt-letter')), 'the letter markup is untouched');
    ok(!!w.document.querySelector('.elim-toggle'), 'a Cross out toggle is shown above the choices');
    ok(!w.document.documentElement.classList.contains('elim-on'), 'off by default');
    w.document.querySelector('.elim-toggle').click();
    ok(w.document.documentElement.classList.contains('elim-on'), 'the toggle turns it on');

    console.log('\n2 · Crossing out never selects; choosing a crossed-out choice restores it');
    const q0 = bank[0], right = q0.answer, wrong = ['A', 'B', 'C', 'D'].find(l => l !== right);
    const btn = l => opts().find(b => b.querySelector('.opt-letter').textContent.trim() === l + '.');
    btn(wrong).querySelector('.elim-x').click();
    ok(btn(wrong).classList.contains('elim-out'), 'the wrong choice is crossed out');
    ok(w.__peek().answers[0].chosen == null, 'and nothing was selected');
    btn(right).querySelector('.elim-x').click();
    btn(right).click();
    ok(!btn(right).classList.contains('elim-out') && w.__peek().answers[0].chosen === right, 'choosing the crossed-out right answer restores it and selects it');
    btn(right).querySelector('.elim-x').click();
    ok(!btn(right).classList.contains('elim-out'), 'the selected choice cannot be crossed out');

    console.log('\n3 · Shift + letter crosses out from the keyboard; plain letters still select');
    const third = ['A', 'B', 'C', 'D'].find(l => l !== right && l !== wrong);
    w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: third, shiftKey: true, bubbles: true }));
    ok(btn(third).classList.contains('elim-out'), 'Shift+' + third + ' crosses ' + third + ' out');
    ok(w.__peek().answers[0].chosen === right, 'without changing the selection');

    console.log('\n4 · Going Back shows what was crossed out');
    w.goToQuestion(1);
    ok(!opts().some(b => b.classList.contains('elim-out')), 'the next question starts with nothing crossed out');
    w.goToQuestion(0);
    ok(btn(wrong).classList.contains('elim-out') && btn(third).classList.contains('elim-out'), 'both cross-outs are still there on return');

    console.log('\n5 · The tutor receives what was crossed out');
    w.finalizeSession();
    const post = w.__posts.find(p => p.type === 'practice' && Array.isArray(p.questions) && p.questions.length === 3);
    ok(!!post, 'the sitting is posted');
    const pq = post.questions[0];
    ok(pq.elim === [wrong, third].sort().join(''), 'elim lists the crossed-out letters (got ' + pq.elim + ')');
    ok(pq.elimAnswer === true, 'elimAnswer records that the right answer was crossed out at some point');
    ok(post.questions[1].elim === '' && post.questions[1].elimAnswer === false, 'an untouched question sends empty fields');

    console.log('\nALL ' + count + ' ASSERTIONS PASSED');
    process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
