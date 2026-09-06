// ─────────────────────────────────────────────────────────────────
// session-flush.test.js — an unfinished sitting still reaches the tutor.
//
//   NODE_PATH=/tmp/j/node_modules node session-flush.test.js
//
// WHY THIS EXISTS
// The mastery ledger is written PER QUESTION (submitAnswer -> commitOne ->
// recordAnswer). The sheet was written ONCE, from finalizeSession(), which in
// practice mode is reachable only by pressing Next PAST the last question —
// there is no Submit button in that mode.
//
// So a session where every question was answered, but which was walked away from
// on the final question, wrote everything locally and NOTHING to the tutor. It
// happened for real: one lesson ran two full sessions and one reached the
// sheet. Nothing errored. `mode:'no-cors'` makes the response opaque, so a
// post that never happens is indistinguishable from one that succeeds — which is
// why it went unnoticed until the tutor compared the sheet against the lesson.
//
// The fix is history.js logPartialSession(), fired from a `pagehide` handler.
//
// PORTED FROM THE SISTER PSAT 8/9 APP, with one deliberate divergence: over there
// the partial and the complete row share a sessionId, because that backend has no
// dedupe. HERE the Session ID is an idempotency key and first write wins, so a
// shared id would store the fragment and discard the real result. The partial
// posts under `<id>_partial` instead, and §4 pins that.
// What this suite pins, in the order the bug actually bit:
//   1. a partial flush posts what WAS committed, and marks itself INCOMPLETE;
//   2. it posts nothing when nothing was committed (a blank is not a result);
//   3. it never fires twice, and never after a complete log;
//   4. sheet-sync.js NAMES the new keys — that payload is built key by key, so
//      an unnamed field is silently dropped, which is how `focus` was lost for
//      every practice session ever logged;
//   5. keepalive is set, or the browser cancels the request mid-unload and the
//      whole handler is theatre.
// ─────────────────────────────────────────────────────────────────
'use strict';
const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const APP = __dirname;
let pass = 0, fail = 0;
const t = (name, fn) => {
    try { fn(); console.log('  ✓ ' + name); pass++; }
    catch (e) { console.log('  ✗ ' + name + '\n      ' + e.message); fail++; }
};
const eq = (a, b, m) => {
    if (a !== b) throw new Error((m || '') + ' expected ' + JSON.stringify(b) +
                                ', got ' + JSON.stringify(a));
};
const ok = (v, m) => { if (!v) throw new Error(m || 'expected truthy'); };

// ── A sandbox holding just enough of the app for history.js to run ──
// session-responses.js is real (buildResults is the thing under test's input);
// everything else is the smallest honest stub.
function makeCtx(opts) {
    opts = opts || {};
    const posted = [];
    const store  = {};
    const ctx = {
        console,
        Date,
        Math,
        JSON,
        posted,
        // storage.js helpers, stubbed
        STORAGE: { HISTORY: 'h' },
        safeGetJSON: (k, f) => (store[k] ? JSON.parse(store[k]) : f),
        safeSet: (k, v) => { store[k] = v; return true; },
        saveSessionState: () => {},
        syncSessionToSheet: r => { posted.push(r); },
        getBlurCount: () => 0,
        // app.js globals history.js reads
        secondsElapsed: opts.secondsElapsed || 0,
        userMode: 'standard',
        SKILL_ABBR: {},
    };
    ctx.window = ctx;
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(APP, 'session-responses.js'), 'utf8'), ctx);
    vm.runInContext(fs.readFileSync(path.join(APP, 'history.js'), 'utf8'), ctx);
    return ctx;
}

// Six questions, `answered` of them committed. Deliberately two skills, so the
// INCOMPLETE marker has to survive a multi-skill focus string.
function seed(ctx, answered, correctOf) {
    const qs = [];
    for (let i = 0; i < 6; i++) {
        qs.push({
            id: 'q' + i,
            skill: i % 2 ? 'Inferences' : 'Central Ideas and Details',
            difficulty: 'Medium',
            answer: 'A',
            trapName: '',
        });
    }
    ctx.activeQuestions = qs;
    const resp = ctx.makeResponses(6);
    for (let i = 0; i < answered; i++) {
        resp[i].chosen    = (correctOf && correctOf.indexOf(i) < 0) ? 'B' : 'A';
        resp[i].committed = true;
        resp[i].secs      = 30;
    }
    ctx.responses = resp;
    ctx.sessionResults = ctx.buildResults(resp, qs);
    return qs;
}

console.log('\nsession-flush.test.js\n');

// ── 1. The bug itself ─────────────────────────────────────────────
console.log('a partial flush reports the work that was actually done');

t('posts a row when questions were committed but the set was never finished', () => {
    const ctx = makeCtx();
    ctx.setSessionId('sid-1');
    seed(ctx, 4, [0, 1, 2, 3]);
    eq(ctx.logPartialSession(), true, 'should have flushed:');
    eq(ctx.posted.length, 1, 'rows posted:');
});

t('counts only what was committed, not what was planned', () => {
    const ctx = makeCtx();
    ctx.setSessionId('sid-2');
    seed(ctx, 4, [0, 1, 2]);          // 4 answered, 3 of them right
    ctx.logPartialSession();
    const r = ctx.posted[0];
    eq(r.total, 4, 'total should be answered-count, not 6:');
    eq(r.score, 3, 'score:');
    eq(r.answered, 4, 'answered:');
    eq(r.planned, 6, 'planned:');
});

t('marks itself INCOMPLETE in the Assignment cell, which needs no redeploy', () => {
    const ctx = makeCtx();
    ctx.setSessionId('sid-3');
    seed(ctx, 2, [0, 1]);
    ctx.logPartialSession();
    const f = ctx.posted[0].assignmentTitle;
    ok(/INCOMPLETE/.test(f), 'marker must say INCOMPLETE, got: ' + f);
    ok(/2 of 6/.test(f), 'marker must show the shortfall, got: ' + f);
    eq(ctx.posted[0].partial, true, 'partial flag:');
});

t('carries the per-question detail, so the tutor can still read the work', () => {
    const ctx = makeCtx();
    ctx.setSessionId('sid-4');
    seed(ctx, 3, [0, 1, 2]);
    ctx.logPartialSession();
    eq(ctx.posted[0].questions.length, 3, 'question rows:');
    eq(ctx.posted[0].questions[0].id, 'q0', 'first question id:');
});

// ── 2. A blank is not a result ────────────────────────────────────
console.log('\nand stays quiet when there is nothing to say');

t('posts nothing when no question was committed', () => {
    const ctx = makeCtx();
    ctx.setSessionId('sid-5');
    seed(ctx, 0);
    eq(ctx.logPartialSession(), false, 'should not flush:');
    eq(ctx.posted.length, 0, 'rows posted:');
});

t('ignores a selection that was never committed', () => {
    const ctx = makeCtx();
    ctx.setSessionId('sid-6');
    seed(ctx, 0);
    ctx.responses[0].chosen = 'A';        // picked, never submitted
    eq(ctx.logPartialSession(), false, 'an uncommitted pick is not an answer:');
});

t('posts nothing when there is no session at all', () => {
    const ctx = makeCtx();
    ctx.setSessionId('sid-7');
    ctx.activeQuestions = [];
    ctx.responses = [];
    eq(ctx.logPartialSession(), false, 'no session, no row:');
});

// ── 3. Never twice ────────────────────────────────────────────────
console.log('\nand never doubles a row');

t('a second flush is a no-op', () => {
    const ctx = makeCtx();
    ctx.setSessionId('sid-8');
    seed(ctx, 3, [0, 1, 2]);
    ctx.logPartialSession();
    eq(ctx.logPartialSession(), false, 'second flush:');
    eq(ctx.posted.length, 1, 'rows posted:');
});

t('a finished session is never flushed as partial afterwards', () => {
    const ctx = makeCtx();
    ctx.setSessionId('sid-9');
    seed(ctx, 6, [0, 1, 2, 3, 4, 5]);
    ctx.logSession(['Inferences'], ['Medium'], 6, 6);
    eq(ctx.posted.length, 1, 'the complete row:');
    eq(!!ctx.posted[0].partial, false, 'complete row must not be marked partial:');
    eq(ctx.logPartialSession(), false, 'pagehide after finishing:');
    eq(ctx.posted.length, 1, 'still one row:');
});

t('a resumed session keeps its id, so a partial and its finish are joinable', () => {
    const ctx = makeCtx();
    ctx.setSessionId('sid-10');
    seed(ctx, 2, [0, 1]);
    ctx.logPartialSession();
    // …page reloads; storage.js restoreSession replays the saved id + flag.
    ctx.setSessionId('sid-10', { partial: true });
    eq(ctx.logPartialSession(), false, 'must not re-post the same partial:');
    seed(ctx, 6, [0, 1, 2, 3, 4, 5]);
    ctx.logSession(['Inferences'], ['Medium'], 6, 6);
    eq(ctx.posted.length, 2, 'partial + complete:');
    eq(ctx.posted[0].sessionId, ctx.posted[1].sessionId + '_partial',
       'the partial must be the complete id plus _partial, or dedupe eats one of them:');
});

t('a new sitting gets a new id and may flush again', () => {
    const ctx = makeCtx();
    ctx.setSessionId('sid-11');
    seed(ctx, 2, [0, 1]);
    ctx.logPartialSession();
    ctx.setSessionId(ctx.newSessionId());     // launchSession does this
    seed(ctx, 2, [0, 1]);
    eq(ctx.logPartialSession(), true, 'a fresh session must be flushable:');
    ok(ctx.posted[0].sessionId !== ctx.posted[1].sessionId, 'ids must differ');
});

// ── 4. The wire contract ──────────────────────────────────────────
// sheet-sync.js builds its payload key by key and drops anything unnamed. That
// is not a quirk: it is why the baseline reached localStorage and nothing else,
// and why `focus` never arrived for a single practice session.
console.log('\nand the payload actually carries the new fields');

t('sheet-sync.js names partial, sessionId and assignmentTitle', () => {
    const src = fs.readFileSync(path.join(APP, 'sheet-sync.js'), 'utf8');
    const body = src.slice(src.indexOf('const payload = {'), src.indexOf('if (record.baseline)'));
    ['partial', 'sessionId', 'assignmentTitle'].forEach(k => {
        ok(new RegExp('\\b' + k + ':').test(body),
           'payload must name `' + k + '` or the script never sees it');
    });
});

t('the partial never reuses the complete id — dedupe is first-write-wins here', () => {
    const ctx = makeCtx();
    ctx.setSessionId('rw_x');
    seed(ctx, 2, [0, 1]);
    ctx.logPartialSession();
    ok(/_partial$/.test(ctx.posted[0].sessionId),
       'partial id must be suffixed, got: ' + ctx.posted[0].sessionId);
});

t('homework partial uses a suffixed id too', () => {
    const src = fs.readFileSync(path.join(APP, 'homework-run.html'), 'utf8');
    ok(/_hwSessionId\s*\+\s*\(partial\s*\?\s*'_partial'/.test(src),
       'the homework partial must not reuse the finished set id');
});

t('sheet-sync.js keeps keepalive on the fetch', () => {
    const src = fs.readFileSync(path.join(APP, 'sheet-sync.js'), 'utf8');
    ok(/keepalive:\s*true/.test(src),
       'without keepalive the browser cancels the post during unload');
});

t('homework-run.html posts with keepalive too', () => {
    const src = fs.readFileSync(path.join(APP, 'homework-run.html'), 'utf8');
    const post = src.slice(src.indexOf('function postLog'), src.indexOf('function postLog') + 2200);
    ok(/keepalive:\s*true/.test(post),
       'the homework post never set keepalive; a set submitted as the tab closed could vanish');
});

t('homework-run.html flushes a part-answered set, and COMMITS a fully answered one', () => {
    const src = fs.readFileSync(path.join(APP, 'homework-run.html'), 'utf8');
    ok(/addEventListener\('pagehide'/.test(src), 'no pagehide handler in the homework runner');
    const hidx = src.indexOf("addEventListener('pagehide'");
    const handler = src.slice(hidx, hidx + 1200);
    ok(/_hwLogged\s*\|\|\s*_hwPartialLogged/.test(handler),
       'the handler must skip a set that has already reported');
    ok(/postLog\([\s\S]*?,\s*true\s*\)/.test(handler),
       'a part-answered set must still post with partial=true');

    // Ported from the sister app 6 Sep 2026, where this cost a student seventeen
    // days. The partial flush was written for a set abandoned halfway and it
    // treated EVERY unpressed set the same way. So a student who answered all ten
    // questions and closed the tab was filed to the tutor as "INCOMPLETE (10 of 10
    // answered)" — not a description of anything — and the completion flag was
    // still never written, which under sequential unlock shut every later set
    // behind it. It was invisible: the score screen had already shown a
    // finished-looking result and the tutor reviewed it with the student.
    //
    // Reaching the score screen is how the STUDENT sees the result. It is not what
    // makes the work exist.
    ok(/answered\s*>=\s*daySet\.length/.test(handler),
       'pagehide must recognise a fully answered set');
    ok(/localStorage\.setItem\('satrw_hw_'/.test(handler),
       'a fully answered set must write its completion flag, or the plan deadlocks behind it');
    ok(/postLog\(secs\)\s*;/.test(handler),
       'a fully answered set must post a REAL row, not one marked INCOMPLETE');
});

t('app.js wires the pagehide flush, and does NOT use visibilitychange', () => {
    const src = fs.readFileSync(path.join(APP, 'app.js'), 'utf8');
    ok(/initSessionFlush/.test(src), 'initSessionFlush missing');
    ok(/addEventListener\('pagehide'/.test(src), 'no pagehide handler in app.js');
    const fn = src.slice(src.indexOf('function initSessionFlush'),
                         src.indexOf('function initSessionFlush') + 900);
    eq(/visibilitychange/.test(fn), false,
       'visibilitychange fires on every alt-tab; these sessions are screen-shared');
});

t('storage.js carries the session id across a resume', () => {
    const src = fs.readFileSync(path.join(APP, 'storage.js'), 'utf8');
    ok(/sessionId:/.test(src), 'saveSessionState must persist sessionId');
    ok(/partialLogged/.test(src), 'saveSessionState must persist partialLogged');
    ok(/setSessionId\(state\.sessionId/.test(src), 'restoreSession must replay it');
});

console.log('\n' + '='.repeat(50));
console.log(pass + ' passed, ' + fail + ' failed');
console.log('='.repeat(50) + '\n');
process.exit(fail ? 1 : 0);
