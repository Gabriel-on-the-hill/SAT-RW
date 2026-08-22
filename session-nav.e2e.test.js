// session-nav.e2e.test.js — drives the real index.html in jsdom.
// Run: node session-nav.e2e.test.js
//
// The unit tests in session-responses.test.js prove the model counts correctly.
// This proves the buttons are actually wired to it — that Back exists before an
// answer does, that Skip leaves a blank, and above all that revising an answer
// in exam mode writes the mastery ledger ONCE.

const fs = require('fs');
const path = require('path');
const nodecrypto = require('crypto');

// This app keeps no node_modules of its own — it is a no-build static site —
// so jsdom is wherever you installed it. AGENTS.md's convention is
// `npm install jsdom --prefix /tmp/j` plus NODE_PATH, which the bare require
// below picks up; JSDOM_PATH is the override, and a missing jsdom SKIPS rather
// than failing, so a machine without it does not report a false red.
let JSDOM, VirtualConsole;
try {
    ({ JSDOM, VirtualConsole } = require(process.env.JSDOM_PATH || 'jsdom'));
} catch (e) {
    console.log('SKIP — jsdom not found. npm install jsdom --prefix /tmp/j, '
              + 'then NODE_PATH=/tmp/j/node_modules node session-nav.e2e.test.js');
    process.exit(0);
}

let pass = 0, fail = 0;
const t = (n, f) => { try { f(); console.log('  ok   ' + n); pass++; }
                      catch (e) { console.log('  FAIL ' + n + '\n       ' + e.message); fail++; } };
const ok = (c, m) => { if (!c) throw new Error(m || 'expected truthy'); };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b))
    throw new Error((m || '') + ' expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a)); };

const pageErrors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => pageErrors.push(e.message.split('\n')[0]));

// Inline local scripts. gate.js carries a literal </script> in its header
// comment, which would end the block early — escape it.
let html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
html = html.replace(/<script src="([^"]+?)(?:\?[^"]*)?"><\/script>/g, (whole, src) => {
    if (/^https?:/.test(src)) return '';
    try {
        const js = fs.readFileSync(path.join(__dirname, src), 'utf8')
                     .replace(/<\/script/gi, '<\\/script');
        return '<script>' + js + '<\/script>';
    } catch (e) { return ''; }
});
html = html.replace(/<link[^>]*fonts\.googleapis[^>]*>/g, '');

console.log('\nBOOTING\n-------');
const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    url: 'http://localhost/index.html',
    virtualConsole: vc,
    beforeParse(w) {
        w.scrollTo = () => {};
        w.alert = () => {};
        w.confirm = () => true;                 // auto-accept the blank-submit warning
        w.matchMedia = w.matchMedia || (() => ({ matches: false, addListener(){}, removeListener(){} }));
    },
});
const win = dom.window;
const doc = win.document;
const ev  = (expr) => win.eval(expr);

function waitFor(fn, ms) {
    const end = Date.now() + (ms || 20000);
    return new Promise((res, rej) => {
        (function poll() {
            let v = false; try { v = fn(); } catch (e) { v = false; }
            if (v) return res(true);
            if (Date.now() > end) return rej(new Error('timed out booting the page'));
            setTimeout(poll, 50);
        })();
    });
}

const $ = id => doc.getElementById(id);
const visible = id => { const el = $(id); return !!el && !el.classList.contains('hidden'); };
const optButtons = () => Array.from(doc.querySelectorAll('#optionsContainer .option-btn'));
const clickLetter = (letter) => {
    const b = optButtons().find(x => {
        const l = x.querySelector('.opt-letter');
        return l && l.textContent.trim() === letter + '.';
    });
    ok(b, 'no option button for ' + letter);
    b.dispatchEvent(new win.Event('click'));
};

// Start a session of n questions in a given mode, bypassing the setup screen.
function startSession(n, mode) {
    ev(`
      (function(){
        var qs = questionBank.slice(0, ${n});
        launchSession(qs, '${mode}', { mode: 'off' });
      })();
    `);
}
const idx    = () => ev('currentQuestionIndex');
const resp   = (i) => JSON.parse(ev('JSON.stringify(responses[' + i + '])'));
const ledger = () => JSON.parse(ev('JSON.stringify(getProgress())'));
const qid    = (i) => ev('activeQuestions[' + i + '].id');
const answerOf = (i) => ev('activeQuestions[' + i + '].answer');
const wrongOf  = (i) => ev(`(function(){
    var q = activeQuestions[${i}];
    return q.options.map(function(o){return o.trim()[0];})
                    .filter(function(l){return l !== q.answer;})[0];
})()`);

(async function run() {
    await waitFor(() => ev('typeof launchSession') === 'function'
                     && ev('typeof questionBank !== "undefined" && questionBank.length') > 10);

    t('page boots clean', () => eq(pageErrors, []));
    t('the response model is loaded', () => eq(ev('typeof makeResponses'), 'function'));

    // ══════════════════════════════════════════════════════════════
    console.log('\nPRACTICE — NAVIGATION EXISTS BEFORE AN ANSWER DOES\n' + '-'.repeat(50));
    ev('resetLedger && resetLedger()');
    startSession(5, 'standard');

    t('Skip is offered on an unanswered question', () => {
        eq(idx(), 0);
        ok(visible('skipBtn'), 'Skip is not available — a student is forced to guess');
    });

    t('Next and Submit are hidden until there is something to do', () => {
        ok(!visible('nextBtn'), 'Next is live before the question was attempted');
        ok(!visible('submitBtn'), 'Submit is live before anything was selected');
    });

    t('Back is hidden on the first question only', () => {
        ok(!visible('backBtn'), 'Back offered on question 1');
    });

    t('skipping moves on and leaves the question genuinely blank', () => {
        $('skipBtn').dispatchEvent(new win.Event('click'));
        eq(idx(), 1);
        eq(resp(0).chosen, null);
        eq(resp(0).committed, false, 'a skip must not close the question');
    });

    t('a skip writes NOTHING to the mastery ledger', () => {
        eq(Object.keys(ledger()).length, 0,
           'skipping recorded evidence about a skill the student never attempted');
    });

    t('Back is offered once past the first question', () => {
        ok(visible('backBtn'), 'no way back');
    });

    t('going back returns to the skipped question, still answerable', () => {
        $('backBtn').dispatchEvent(new win.Event('click'));
        eq(idx(), 0);
        ok(visible('skipBtn'), 'the skipped question is no longer answerable');
    });

    console.log('\nPRACTICE — SELECT, THEN CONFIRM\n' + '-'.repeat(31));

    t('selecting an option does not commit it', () => {
        clickLetter(wrongOf(0));
        eq(resp(0).committed, false, 'a single click committed the answer');
        eq(Object.keys(ledger()).length, 0, 'the ledger was written before Submit');
        ok(visible('submitBtn'), 'Submit did not appear after selecting');
    });

    t('a selection shows as pending, not as graded', () => {
        ok(doc.querySelector('#optionsContainer .option-btn.pending'), 'no pending highlight');
        ok(!doc.querySelector('#optionsContainer .option-btn.correct'), 'graded too early');
    });

    t('a misclick can be corrected before submitting', () => {
        clickLetter(answerOf(0));
        eq(resp(0).chosen, answerOf(0), 'the selection did not change');
        eq(resp(0).committed, false);
    });

    t('Submit commits, grades, and writes the ledger once', () => {
        $('submitBtn').dispatchEvent(new win.Event('click'));
        eq(resp(0).committed, true);
        const led = ledger();
        eq(Object.keys(led).length, 1);
        eq(led[qid(0)].lastSource, 'baseline' === led[qid(0)].lastSource ? 'baseline' : 'practice');
        eq(led[qid(0)].lastResult, 'correct');
    });

    t('feedback appears and Next replaces Submit', () => {
        ok($('feedbackContainer').className.indexOf('visible') >= 0, 'no feedback shown');
        ok(!visible('submitBtn'), 'Submit still live after grading');
        ok(!visible('skipBtn'), 'Skip still live after grading');
        ok(visible('nextBtn'), 'no way forward after grading');
    });

    t('a graded answer cannot be changed', () => {
        clickLetter(wrongOf(0));
        eq(resp(0).chosen, answerOf(0), 'a committed answer was overwritten');
    });

    t('re-clicking Submit does not double-write the ledger', () => {
        const before = ledger()[qid(0)].correct;
        $('submitBtn').dispatchEvent(new win.Event('click'));
        eq(ledger()[qid(0)].correct, before, 'the ledger moved on a second submit');
    });

    t('returning to a graded question shows the grade again, not a blank slate', () => {
        $('nextBtn').dispatchEvent(new win.Event('click'));   // to Q2
        $('backBtn').dispatchEvent(new win.Event('click'));   // back to Q1
        eq(idx(), 0);
        ok($('feedbackContainer').className.indexOf('visible') >= 0,
           'the feedback vanished on return');
        ok(doc.querySelector('#optionsContainer .option-btn.correct'), 'grading not restored');
    });

    // ══════════════════════════════════════════════════════════════
    console.log('\nEXAM — FREE NAVIGATION, ONE LEDGER WRITE\n' + '-'.repeat(40));
    ev('resetLedger && resetLedger()');
    startSession(4, 'exam');

    t('exam mode has no per-question Submit and no Skip', () => {
        ok(!visible('submitBtn'), 'exam mode showed a Submit step');
        ok(!visible('skipBtn'), 'exam mode showed a Skip button');
        ok(visible('nextBtn'), 'no Next in exam mode');
    });

    t('Mark for review is offered in exam mode', () => {
        ok(visible('flagBtn'), 'no flag control in exam mode');
    });

    t('selecting an answer writes nothing until the module is submitted', () => {
        clickLetter(wrongOf(0));
        eq(resp(0).chosen, wrongOf(0));
        eq(Object.keys(ledger()).length, 0, 'exam mode wrote the ledger mid-module');
    });

    t('an exam answer can be changed freely', () => {
        clickLetter(answerOf(0));
        eq(resp(0).chosen, answerOf(0));
        eq(resp(0).committed, false);
    });

    t('flagging marks the question without answering it', () => {
        $('nextBtn').dispatchEvent(new win.Event('click'));    // Q2
        $('flagBtn').dispatchEvent(new win.Event('click'));
        eq(resp(1).flagged, true);
        eq(resp(1).chosen, null, 'flagging answered the question');
        ok($('flagBtn').classList.contains('flagged'), 'flag not shown as set');
    });

    t('navigating away and back preserves the answer and the flag', () => {
        $('nextBtn').dispatchEvent(new win.Event('click'));    // Q3
        $('backBtn').dispatchEvent(new win.Event('click'));    // Q2
        eq(idx(), 1);
        eq(resp(1).flagged, true);
        $('backBtn').dispatchEvent(new win.Event('click'));    // Q1
        eq(resp(0).chosen, answerOf(0), 'the answer was lost on the way back');
        ok(doc.querySelector('#optionsContainer .option-btn.pending'), 'selection not repainted');
    });

    console.log('\nEXAM — END-OF-MODULE REVIEW\n' + '-'.repeat(27));

    t('the last question offers Review answers, not Finish', () => {
        ev('goToQuestion(3)');
        eq(idx(), 3);
        eq($('nextBtn').textContent.trim(), 'Review answers');
    });

    t('the review screen opens and counts answered, blank and flagged', () => {
        $('nextBtn').dispatchEvent(new win.Event('click'));
        ok(visible('examReview'), 'no review screen');
        const cells = doc.querySelectorAll('#examReviewGrid .qcell');
        eq(cells.length, 4);
        eq(doc.querySelectorAll('#examReviewGrid .qcell.answered').length, 1);
        eq(doc.querySelectorAll('#examReviewGrid .qcell.blank').length, 3);
        eq(doc.querySelectorAll('#examReviewGrid .qcell.flagged').length, 1);
        ok(/blank/i.test($('examReviewLede').textContent), 'lede does not mention blanks');
    });

    t('a review cell jumps back to that question', () => {
        doc.querySelectorAll('#examReviewGrid .qcell')[1]
           .dispatchEvent(new win.Event('click'));
        ok(!visible('examReview'), 'review screen stayed up');
        eq(idx(), 1);
    });

    t('Keep working closes the review without submitting', () => {
        ev('goToQuestion(3)');
        $('nextBtn').dispatchEvent(new win.Event('click'));
        $('examReviewBackBtn').dispatchEvent(new win.Event('click'));
        ok(!visible('examReview'));
        eq(Object.keys(ledger()).length, 0, 'closing the review submitted the module');
    });

    t('submitting the module writes each answered question exactly once', () => {
        // answer one more, leave two blank
        ev('goToQuestion(1)');
        clickLetter(wrongOf(1));
        ev('goToQuestion(3)');
        $('nextBtn').dispatchEvent(new win.Event('click'));      // open review
        $('examReviewSubmitBtn').dispatchEvent(new win.Event('click'));

        const led = ledger();
        eq(Object.keys(led).length, 2, 'expected exactly the two answered questions:');
        ok(led[qid(0)], 'Q1 missing from the ledger');
        ok(led[qid(1)], 'Q2 missing from the ledger');
        eq(led[qid(0)].lastResult, 'correct');
        eq(led[qid(1)].lastResult, 'wrong');
        eq(led[qid(0)].lastSource, 'exam');
        ok(!led[qid(2)] && !led[qid(3)], 'a blank question reached the mastery ledger');
    });

    t('the revised answer counted, not the one it replaced', () => {
        // Q1 was answered wrong, then corrected. It must read as one correct
        // answer, not one right and one wrong.
        const rec = ledger()[qid(0)];
        eq(rec.wrong || 0, 0, 'the discarded first answer was still counted:');
        ok((rec.correct || 0) > 0, 'the corrected answer was not counted');
    });

    t('results are in question order with blanks preserved', () => {
        const rows = JSON.parse(ev('JSON.stringify(sessionResults.map(function(r){'
            + 'return {id:r.q.id, answered:r.answered, correct:r.isCorrect};}))'));
        eq(rows.length, 4);
        eq(rows.map(r => r.answered), [true, true, false, false]);
        eq(rows.filter(r => r.correct).length, 1);
    });

    t('skipped questions land in Review Missed', () => {
        const missed = JSON.parse(ev('JSON.stringify(missedQuestions.map(function(m){return m.q.id;}))'));
        eq(missed.length, 3, 'expected 1 wrong + 2 blank:');
    });

    t('no script errors across the whole session', () => eq(pageErrors, []));

    console.log('\n' + '='.repeat(50));
    console.log(`${pass} passed, ${fail} failed`);
    console.log('='.repeat(50) + '\n');
    win.close();
    process.exit(fail ? 1 : 0);
})().catch(e => {
    console.error('\nHARNESS ERROR: ' + e.message);
    console.error(pageErrors.slice(0, 6).join('\n'));
    process.exit(1);
});
