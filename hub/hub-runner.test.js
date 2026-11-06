// ─────────────────────────────────────────────────────────────────
// hub-runner.test.js — this runner, served by EduTrack Hub, still teaches.
//
//   npm install jsdom --prefix /tmp/j
//   NODE_PATH=/tmp/j/node_modules node hub/hub-runner.test.js
//
// Skips cleanly if jsdom is absent.
//
// The Hub serves a copy of homework-run.html (hub/hub-patches.js says exactly
// how it differs) with its own identity, questions and saving in place of
// gate.js, the banks and the tutor sheet (hub/hub-client.js, hub/hub-runner.js,
// copied from the Hub). This drives THIS repo's runner through that path
// against a fake Hub, so a change here that breaks the Hub's copy fails here
// first. The questions are this repo's own bank, used as fixtures only: the
// Hub never serves them.
//
//   1. The page knows no answer until the Hub releases it.
//   2. Untimed: Submit sends the answer with her method notes; the runner
//      marks it from the Hub's reply, and a miss says why her choice was wrong.
//   3. Timed: one click, each choice sent as she makes it, nothing marked until
//      the Hub has closed the set.
//   4. Every question survives to the review screen with the right answer.
//   5. Another screen holding the account stops the page before any work.
// ─────────────────────────────────────────────────────────────────
'use strict';
const fs = require('fs');
const path = require('path');

let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch (e) { console.log('SKIP — jsdom not installed (see header).'); process.exit(0); }

const { KEEP, hubRunner } = require('./hub-patches');

const APP = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');
const RAW = read('homework-run.html');
const SERVED = hubRunner(RAW);
const HTML = SERVED.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<link\b[^>]*>/gi, '');
const INLINE = SERVED.match(/<script>\n?([\s\S]*?)<\/script>/)[1];
const BANKS = [...RAW.matchAll(/<script\s+src="(data-[^"?]+)/gi)].map(m => m[1]);

let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, detail) {
    if (cond) { pass++; console.log('  ✓ ' + name); }
    else { fail++; fails.push(name); console.log('  ✗ ' + name + (detail ? ' — ' + detail : '')); }
}
function eq(name, a, b) { ok(name, a === b, 'got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b)); }
function section(t) { console.log('\n' + t); }

// ── Fixtures: three questions from this repo's own bank, in the Hub's shape. ──
// The catalog's skill IDs and names; the runner shows the app's own label.
const CATALOG = {
    'Inferences': ['II.INF', 'Inferences'],
    'Words in Context': ['CS.WIC', 'Words in Context'],
    'Transitions': ['EOI.TRA', 'Transitions'],
    'Command of Evidence — Textual': ['II.COE_T', 'Command of Evidence (Textual)'],
};
function bank() {
    const dom = new JSDOM('<body></body>', { runScripts: 'dangerously' });
    for (const f of BANKS) { const s = dom.window.document.createElement('script'); s.textContent = read(f); dom.window.document.body.appendChild(s); }
    const probe = dom.window.document.createElement('script');
    probe.textContent = 'window.__QB=[].concat(typeof questionBank_CS!=="undefined"?questionBank_CS:[],typeof questionBank_EOI!=="undefined"?questionBank_EOI:[],typeof questionBank_II!=="undefined"?questionBank_II:[],typeof questionBank_CON!=="undefined"?questionBank_CON:[]);';
    dom.window.document.body.appendChild(probe);
    const all = dom.window.__QB;
    dom.window.close();
    return all;
}
const QB = bank();
const usable = q => q && !q.image && q.passage && Array.isArray(q.options) && q.options.length === 4 && /^[A-D]$/.test(q.answer) && !q.retireAfter;
const FIX = ['Inferences', 'Command of Evidence — Textual', 'Words in Context']
    .map(skill => QB.find(q => q.skill === skill && usable(q)));

function hubItem(q, position) {
    const [id, name] = CATALOG[q.skill];
    return {
        position, key: q.answer, explanation: q.explanation,
        skill: { id, name },
        question: {
            stimulus: { text: q.passage }, stem: q.question,
            options: q.options.map(o => ({ label: o.trim()[0], text: o.trim().slice(2).trim() })),
        },
    };
}

// ── A fake Hub: the routes hub-client.js calls, with one attempt. ──
function fakeHub({ timed = false, held = false } = {}) {
    const items = FIX.map((q, i) => Object.assign(hubItem(q, i + 1), { committed: false, answer: null }));
    const feedback = it => ({ key: it.key, explanation: it.explanation, reasons: { A: { why: 'Reason A.' }, B: { why: 'Reason B.' }, C: { why: 'Reason C.' }, D: { why: 'Reason D.' } } });
    const hub = { calls: [], status: 'OPEN' };
    hub.attempt = () => ({
        id: 'att1', status: hub.status, title: 'Hub set', instructions: '', redo: false, leftOut: 0,
        feedback: timed ? 'AT_SUBMIT' : 'PER_ITEM', timed, now: new Date().toISOString(), lastClientSeq: 0,
        deadline: timed ? new Date(Date.now() + 10 * 60000).toISOString() : null,
        items: items.map(({ key, explanation, ...it }) => Object.assign({ shown: false, firstAnswer: it.answer }, it,
            hub.status === 'OPEN' ? {} : { correct: it.answer === key, feedback: feedback({ key, explanation }) })),
    });
    hub.fetch = (url, opt) => {
        const u = new URL(url, 'http://hub.test');
        const body = opt && opt.body ? JSON.parse(opt.body) : undefined;
        hub.calls.push({ path: u.pathname, method: (opt && opt.method) || 'GET', body, headers: (opt && opt.headers) || {} });
        let status = 200, data;
        const p = u.pathname;
        if (p === '/api/learn/session') data = { user: { id: 'stu1', name: 'Test Student', role: 'STUDENT' }, expiresAt: new Date(Date.now() + 864e5).toISOString() };
        else if (p === '/api/learn/lease') data = held && body.op !== 'release' ? { ok: false, reason: 'held' } : { ok: true, token: 'a'.repeat(32) };
        else if (p === '/api/learn/attempts/att1') data = { attempt: hub.attempt() };
        else if (p === '/api/learn/attempts/att1/commit') {
            const it = items.find(i => i.position === body.position);
            it.committed = true; it.answer = body.answer;
            data = Object.assign({ position: it.position, answer: body.answer, kept: false }, timed ? {} : { correct: body.answer === it.key, feedback: feedback(it) });
        } else if (p === '/api/learn/attempts/att1/submit') { hub.status = 'SUBMITTED'; data = { attempt: hub.attempt() }; }
        else if (p === '/api/learn/sync') data = { applied: 1 };
        else { status = 404; data = { error: 'Not found' }; }
        return Promise.resolve({ ok: status < 300, status, json: () => Promise.resolve(data) });
    };
    hub.writes = path => hub.calls.filter(c => c.path === path && c.method === 'POST');
    return hub;
}

// ── The page, as the Hub serves it. ──
let SKEW = 0;
function open(hub) {
    const dom = new JSDOM(HTML, {
        runScripts: 'dangerously',
        url: 'http://hub.test/apps/runner/homework-run.html?attempt=att1',
        beforeParse(w) {
            w.fetch = hub.fetch; w.scrollTo = () => {}; w.alert = () => {}; w.confirm = () => true;
            const real = w.Date.now.bind(w.Date); w.Date.now = () => real() + SKEW;
        },
    });
    const w = dom.window;
    const add = code => { const s = w.document.createElement('script'); s.textContent = code; w.document.body.appendChild(s); };
    add(read('hub/hub-client.js'));
    add(read('hub/hub-runner.js'));
    for (const f of KEEP) add(read(f));
    add(INLINE);
    return w;
}
const ticks = async (n = 30) => { for (let i = 0; i < n; i++) await new Promise(r => setImmediate(r)); };
const $ = (w, id) => w.document.getElementById(id);
const hidden = el => !el || el.classList.contains('hidden');
async function reveal(w) {
    SKEW += 60000; // past the read-the-text gate
    for (const el of w.document.querySelectorAll('#predict textarea')) { el.value = 'the deciding information'; el.dispatchEvent(new w.Event('input', { bubbles: true })); }
    for (const el of w.document.querySelectorAll('#predict select')) { el.selectedIndex = 1; el.dispatchEvent(new w.Event('change', { bubbles: true })); }
    $(w, 'predGo').click();
    await ticks(5);
}
const choose = (w, l) => w.document.querySelector('.opt[data-l="' + l + '"]').click();
const wrongOf = l => ['A', 'B', 'C', 'D'].find(x => x !== l);

(async () => {
    section('The fixtures');
    ok('three usable questions from this bank', FIX.every(Boolean));
    ok('every Hub patch matches this runner exactly once', SERVED !== RAW); // hubRunner() throws otherwise

    section('1–2, 4. Untimed: marked only from the Hub, every question kept');
    let wrong;
    {
        const hub = fakeHub();
        const w = open(hub);
        await ticks();
        ok('the first question is on screen', !!w.document.querySelector('.qtext'));
        eq('the header is the set title', $(w, 'hdr').textContent, 'Hub set');
        ok('no question on the page carries its answer', w.questionBank_CS.every(q => !('answer' in q)));
        ok('the skill shows in the app\'s own words', w.questionBank_CS[1].skill === 'Command of Evidence — Textual');
        ok('the options are hidden before the prediction', hidden($(w, 'opts')));
        await reveal(w);
        choose(w, FIX[0].answer);
        $(w, 'submit').click();
        await ticks();
        const c1 = hub.writes('/api/learn/attempts/att1/commit')[0];
        ok('Submit sends the answer to the Hub', c1 && c1.body.position === 1 && c1.body.answer === FIX[0].answer);
        ok('with her method notes', c1 && typeof c1.body.prediction === 'string' && c1.body.prediction.length > 0);
        ok('and the lease token', c1 && c1.headers['X-Hub-Lease'] === 'a'.repeat(32));
        ok('marked right from the reply', $(w, 'fb').classList.contains('ok'));

        $(w, 'next').click(); await ticks(5);
        await reveal(w);
        wrong = wrongOf(FIX[1].answer);
        choose(w, wrong);
        $(w, 'submit').click();
        await ticks();
        ok('a miss is marked as a miss', $(w, 'fb').classList.contains('no'));
        ok('and says why her choice was wrong', $(w, 'fbt').textContent.startsWith('Why not ' + wrong + ': Reason ' + wrong + '.'));
        eq('the right answer is shown', (w.document.querySelector('.opt.correct') || {}).dataset && w.document.querySelector('.opt.correct').dataset.l, FIX[1].answer);

        $(w, 'next').click(); await ticks(5);
        await reveal(w);
        $(w, 'skip').click();
        await ticks();
        ok('finishing closes the set on the Hub', hub.writes('/api/learn/attempts/att1/submit').length === 1);
        ok('the review screen opens', !hidden($(w, 'finish')));
        // The runner's own record of the set (what its review screen and redo read).
        const recKey = Object.keys(w.localStorage).find(k => /_hwrec_hub-att1_/.test(k));
        const recs = recKey ? JSON.parse(w.localStorage.getItem(recKey)).recs : [];
        eq('every question keeps the right answer the Hub released', JSON.stringify(recs.map(r => r && r.answer)), JSON.stringify(FIX.map(q => q.answer)));
        eq('and what she chose', JSON.stringify(recs.map(r => r && r.chosen)), JSON.stringify([FIX[0].answer, wrong, null]));
        ok('the review screen shows every explanation', FIX.every(q => $(w, 'finish').textContent.includes(q.explanation.slice(0, 40))));
        ok('and no link to a page the Hub does not serve', ![...w.document.querySelectorAll('#finish a')].some(a => /^(index|homework-hub)\.html/.test(a.getAttribute('href'))));
        eq('two answers were sent', hub.writes('/api/learn/attempts/att1/commit').length, 2);
        ok('nothing went anywhere but the Hub\'s learning routes', hub.calls.every(c => c.path.startsWith('/api/learn/')));
        w.close();
    }

    section('3. Timed: one click, sent as chosen, marked after the Hub closes the set');
    {
        const hub = fakeHub({ timed: true });
        const w = open(hub);
        await ticks();
        ok('the clock runs from the Hub\'s deadline', /^(9|10):\d\d$/.test($(w, 'timer').textContent), $(w, 'timer').textContent);
        ok('no typing under the clock', !$(w, 'predText'));
        const picks = [FIX[0].answer, wrongOf(FIX[1].answer), FIX[2].answer];
        for (const l of picks) { $(w, 'predGo').click(); choose(w, l); await ticks(5); $(w, 'next').click(); await ticks(5); }
        const sent = hub.writes('/api/learn/attempts/att1/commit').map(c => [c.body.position, c.body.answer, 'prediction' in c.body]);
        eq('each choice was sent, in order, with nothing written', JSON.stringify(sent), JSON.stringify(picks.map((l, i) => [i + 1, l, false])));
        ok('nothing is marked before submit', !w.document.querySelector('.opt.correct'));
        $(w, 'hwRevSubmit').click();
        await ticks();
        ok('submit closes the set on the Hub', hub.writes('/api/learn/attempts/att1/submit').length === 1);
        ok('the review screen opens', !hidden($(w, 'finish')));
        ok('with the released explanations', FIX.every(q => $(w, 'finish').textContent.includes(q.explanation.slice(0, 40))));
        w.close();
    }

    section('5. Another screen holds the account');
    {
        const hub = fakeHub({ held: true });
        const w = open(hub);
        await ticks();
        ok('the page says so', /open on another screen/i.test($(w, 'run').textContent));
        ok('and opens no work', !hub.calls.some(c => c.path.startsWith('/api/learn/attempts')));
        w.close();
    }

    console.log('\n────────────────────────────────────────────────────────────────');
    if (fail) { console.log(fail + ' FAILED: ' + fails.join('; ')); process.exit(1); }
    console.log('ALL ' + pass + ' ASSERTIONS PASSED');
    process.exit(0);
})();
