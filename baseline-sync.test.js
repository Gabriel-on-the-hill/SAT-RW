// baseline-sync.test.js — does the baseline actually reach the tutor?
// Run: NODE_PATH=/tmp/j/node_modules node baseline-sync.test.js
//
// A result that exists only in the browser it was sat in is not a baseline: the
// tutor cannot see it, the dashboard cannot chart it, and the parent report has
// no anchor. This drives the real page with fetch stubbed and asserts on what
// would have gone up the wire.
//
// It exists because sheet-sync.js rebuilds the payload KEY BY KEY. Anything not
// named there is dropped with no error and a row that still looks fine — which
// is precisely how the sister app's bands, projection and plan went nowhere for
// three weeks while its own suite sat red and unlisted.
//
// NOTE: this proves the CLIENT posts. Whether the row lands intact depends on
// the Apps Script at SHEET_SYNC_ENDPOINT having somewhere to put a `baseline`
// block — see tutor-sheet/rw-apps-script.md and its test, which is the other
// half of this and cannot be checked from here.

const fs = require('fs');
const path = require('path');

let JSDOM, VirtualConsole;
try {
    const p = process.env.JSDOM_PATH || 'jsdom';
    ({ JSDOM, VirtualConsole } = require(p));
} catch (e) {
    console.log('SKIP — jsdom not found. npm install jsdom --prefix /tmp/j, '
              + 'then NODE_PATH=/tmp/j/node_modules node baseline-sync.test.js');
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

let html = fs.readFileSync(path.join(__dirname, 'baseline.html'), 'utf8');
const inlined = [];
html = html.replace(/<script src="([^"]+?)(?:\?[^"]*)?"><\/script>/g, (whole, src) => {
    if (/^https?:/.test(src)) return '';
    const file = path.join(__dirname, src);
    if (!fs.existsSync(file)) throw new Error('page references a missing file: ' + src);
    inlined.push(src);
    return '<script>' + fs.readFileSync(file, 'utf8').replace(/<\/script/gi, '<\\/script') + '</script>';
});
html = html.replace(/<link[^>]*fonts\.googleapis[^>]*>/g, '');

console.log('\nBOOTING\n-------');
const posts = [];
const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    url: 'http://localhost/baseline.html',
    virtualConsole: vc,
    beforeParse(win) {
        win.confirm = () => true;
        win.alert = () => {};
        win.scrollTo = () => {};
        // Capture what the page tries to upload instead of letting it out.
        win.fetch = (url, opts) => {
            let body = null;
            try { body = JSON.parse((opts && opts.body) || 'null'); } catch (e) { body = (opts || {}).body; }
            posts.push({ url, opts, body });
            return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('') });
        };
        win.sessionStorage.setItem('mastery_unlocked', '1');
        win.sessionStorage.setItem('mastery_user', 'Tester');
        win.sessionStorage.setItem('mastery_role', 'student');
    },
});
const win = dom.window;
const ev  = expr => win.eval(expr);

t('the page loads sheet-sync at all', () => ok(inlined.includes('sheet-sync.js')));
t('the page boots clean', () => eq(pageErrors, []));
t('nothing is posted before the student finishes', () => eq(posts.length, 0));

console.log('\nA COMPLETED SCREENER POSTS ONE ROW\n' + '-'.repeat(34));
win.startTest();
ev(`
  var _seen = {};
  Q.forEach(function (q, i) {
    var d = SKILL_DOMAIN[q.skill];
    var n = (_seen[q.skill] = (_seen[q.skill] || 0) + 1);
    var right = (d === 'Std. English Conv.') ? true
              : (d === 'Expression of Ideas') ? false
              : (n === 1);
    answers[i] = right ? q.answer
      : q.options.map(function (o) { return o.trim()[0]; })
                 .filter(function (l) { return l !== q.answer; })[0];
    times[i] = 60;
  });
`);
win.finishScreener();

const p1 = posts[0];

t('exactly one row went up', () => eq(posts.length, 1));
t('it went to the configured endpoint', () => {
    ok(/script\.google\.com/.test(p1.url), 'posted to ' + p1.url);
});
t('it is attributed to the signed-in student', () => eq(p1.body.student, 'Tester'));

// Without this the row is indistinguishable from an ordinary practice session,
// and every figure a tutor reads off the sheet quietly includes a diagnostic.
t('the tutor can tell it apart from practice', () =>
    eq(p1.body.type, 'baseline', 'the row is typed as:'));

t('score, total and percentage are present', () => {
    eq(p1.body.total, 22);
    ok(typeof p1.body.score === 'number', 'score is ' + JSON.stringify(p1.body.score));
    ok(typeof p1.body.pct === 'number', 'pct is ' + JSON.stringify(p1.body.pct));
});

t('per-skill stats cover all 11 skills', () =>
    eq(Object.keys(p1.body.skillStats).length, 11));

t('every question is reported with its timing', () => {
    eq(p1.body.questions.length, 22);
    ok(p1.body.questions.every(q => q.id && typeof q.secs === 'number'),
       'per-question timing did not survive');
});

t('the integrity signal rides along', () => {
    ok('blurCount' in p1.body, 'no blurCount field — anti-cheat is not wired in');
});

console.log('\nTHE BASELINE-SPECIFIC PAYLOAD\n' + '-'.repeat(29));
t('the baseline block survives sheet-sync\'s key-by-key rebuild', () => {
    ok(p1.body.baseline, 'the whole baseline block was dropped');
});

t('it carries the form and the sitting number', () => {
    eq(p1.body.baseline.form, 'A');
    eq(p1.body.baseline.sitting, 1);
});

t('it carries the projected RANGE, not a single number', () => {
    const b = p1.body.baseline;
    ok(b.projectionLow > 0 && b.projectionHigh > b.projectionLow,
       'projection is not a range: ' + b.projectionLow + '-' + b.projectionHigh);
    ok(b.projectionLow >= 200 && b.projectionHigh <= 800,
       'off the SAT scale: ' + b.projectionLow + '-' + b.projectionHigh);
});

t('it carries a band for every skill', () => {
    const bands = p1.body.baseline.bands;
    eq(Object.keys(bands).length, 11);
    Object.entries(bands).forEach(([skill, v]) => {
        ok(v.band, skill + ' has no band');
        ok(/^\d+\/\d+$/.test(v.screener), skill + ' screener reads ' + v.screener);
    });
});

t('bands are marked provisional before the follow-up', () => {
    const bands = p1.body.baseline.bands;
    ok(bands['Boundaries'].confidence === 'provisional',
       'a skill awaiting a probe is marked ' + bands['Boundaries'].confidence);
});

// The bands say which skills are weak. The queue says which one to teach on
// Saturday. Only one of those is the output of the exercise, and it was the one
// going nowhere in the sister app.
t('it carries the ranked focus queue the tutor should act on', () => {
    ok(Array.isArray(p1.body.baseline.focus), 'no focus list');
    ok(p1.body.baseline.focus.length > 0, 'focus list is empty');
    const f = p1.body.baseline.focus;
    ok(f[0].score >= f[f.length - 1].score, 'the plan is not in ranked order');
    ok(f[0].skill && f[0].band, 'a focus entry has no skill or band');
});

console.log('\nAFTER THE FOLLOW-UP\n' + '-'.repeat(19));
const beforeProbe = posts.length;
win.startProbes();
ev(`
  Q.forEach(function (q, i) {
    answers[i] = q.probeTier === 'Hard' ? q.answer
      : q.options.map(function (o) { return o.trim()[0]; })
                 .filter(function (l) { return l !== q.answer; })[0];
    times[i] = 70;
  });
`);
win.finishProbes();
const p2 = posts[posts.length - 1];

t('the follow-up posts a second row', () => eq(posts.length, beforeProbe + 1));
t('the second row is marked complete, not screener', () => {
    eq(p2.body.type, 'baseline');
    eq(p2.body.baseline.stage, 'complete');
});
t('its bands are resolved rather than provisional', () => {
    eq(p2.body.baseline.bands['Boundaries'].confidence, 'probed');
});
t('probe results are reported with their tier', () => {
    ok(/^Hard:(passed|missed)$/.test(p2.body.baseline.bands['Boundaries'].probe),
       'probe reads "' + p2.body.baseline.bands['Boundaries'].probe + '"');
});

// The sheet is an append-only log and the screener row is what the tutor may
// already have acted on. A second row, not an edit.
t('the screener row is not overwritten — both rows stand', () => {
    eq(posts.filter(p => p.body && p.body.type === 'baseline').length, 2);
    eq(posts[0].body.baseline.stage, 'screener');
});

t('the sitting number does not change between the two rows', () => {
    eq(p2.body.baseline.sitting, p1.body.baseline.sitting);
});

// The Apps Script skips a Session ID it has already stored. If both rows posted
// the same one, the second — the row carrying the resolved bands — would be
// silently discarded as a duplicate.
t('the two rows carry different session ids, or the second is discarded', () => {
    ok(p1.body.sessionId, 'the screener row has no session id');
    ok(p2.body.sessionId, 'the follow-up row has no session id');
    ok(p1.body.sessionId !== p2.body.sessionId,
       'both rows post as ' + p1.body.sessionId);
});

t('per-question rows have an id to join back on', () => {
    ok(p2.body.sessionId && p2.body.questions.length,
       'questions posted with nothing to join them to the session');
});

console.log('\nFAILURE IS SILENT\n' + '-'.repeat(17));
t('a failing upload never costs the student their result', () => {
    // The record is written BEFORE the post, so a dead network loses nothing.
    const list = JSON.parse(ev('JSON.stringify(getBaselines())'));
    eq(list.length, 1);
    eq(list[0].stage, 'complete');
});

t('no script errors across the whole run', () => eq(pageErrors, []));

console.log('\n' + '='.repeat(48));
console.log(`${pass} passed, ${fail} failed`);
console.log('='.repeat(48) + '\n');
win.close();
process.exit(fail ? 1 : 0);
