// baseline.e2e.test.js — loads the real page in jsdom and drives a student
// through it. Catches what static checks cannot: a null element, a handler that
// throws, a results panel that renders empty, a script order that leaves the
// store reading someone else's namespace.
//
// Run: NODE_PATH=/tmp/j/node_modules node baseline.e2e.test.js
//      (or JSDOM_PATH=/path/to/jsdom node baseline.e2e.test.js)
//
// SLOW, NOT HUNG. It stands up a jsdom and parses the whole 719-question bank,
// and Node buffers to a pipe, so it prints nothing until it finishes. Keep
// jsdom on a local disk — across a synced folder this suite takes minutes
// instead of seconds, and a suite that looks broken stops being run.
//
// NOTE ON ACCESS: baseline.html declares its state with top-level `const`/`let`
// in a classic script. Those create bindings in the global LEXICAL environment,
// which is shared across scripts but is NOT exposed as properties of `window` —
// so `win.questionBank` is undefined even though the page works perfectly.
// Everything here therefore reads page state through win.eval().

const fs = require('fs');
const path = require('path');

let JSDOM, VirtualConsole;
try {
    const p = process.env.JSDOM_PATH || 'jsdom';
    ({ JSDOM, VirtualConsole } = require(p));
} catch (e) {
    console.log('SKIP — jsdom not found. npm install jsdom --prefix /tmp/j, '
              + 'then NODE_PATH=/tmp/j/node_modules node baseline.e2e.test.js');
    process.exit(0);
}

let pass = 0, fail = 0;
function t(name, fn) {
    try { fn(); console.log('  ok   ' + name); pass++; }
    catch (e) { console.log('  FAIL ' + name + '\n       ' + e.message); fail++; }
}
function ok(c, m) { if (!c) throw new Error(m || 'expected truthy'); }
function eq(a, b, m) {
    if (JSON.stringify(a) !== JSON.stringify(b))
        throw new Error((m || '') + ' expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a));
}

const pageErrors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => pageErrors.push(e.message.split('\n')[0]));

// Inline every local <script src> before parsing. Keeps the test off the
// network and off jsdom's resource loader; the page under test is still the
// real file, just with its own dependencies pasted in.
let pageHtml = fs.readFileSync(path.join(__dirname, 'baseline.html'), 'utf8');
const inlined = [];
pageHtml = pageHtml.replace(
    /<script src="([^"]+?)(?:\?[^"]*)?"><\/script>/g,
    (whole, src) => {
        if (/^https?:/.test(src)) return whole;
        const file = path.join(__dirname, src);
        if (!fs.existsSync(file)) throw new Error('page references a missing file: ' + src);
        inlined.push(src);
        return '<script>' + fs.readFileSync(file, 'utf8')
            .replace(/<\/script/gi, '<\\/script') + '</script>';
    });
pageHtml = pageHtml.replace(/<link[^>]*fonts\.googleapis[^>]*>/g, '');

console.log('\nBOOTING PAGE\n------------');
const dom = new JSDOM(pageHtml, {
    runScripts: 'dangerously',
    // A real origin is required or localStorage throws SecurityError on the
    // default opaque one — the page would still degrade safely, but then the
    // persistence assertions below would be testing nothing.
    url: 'http://localhost/baseline.html',
    virtualConsole: vc,
    beforeParse(win) {
        win.confirm = () => true;
        win.alert = (m) => { win.__alerts = (win.__alerts || []).concat(m); };
        win.scrollTo = () => {};
        win.fetch = () => Promise.resolve({ ok: true, status: 200 });
        win.sessionStorage.setItem('mastery_unlocked', '1');
        win.sessionStorage.setItem('mastery_user', 'Tester');
        win.sessionStorage.setItem('mastery_role', 'student');
    },
});
const win = dom.window;
const doc = win.document;
const ev  = (expr) => win.eval(expr);

// ── the script order is load-bearing, so assert it rather than trusting it ──
t('page loads all of its own dependencies', () => {
    ['ns-migrate.js', 'gate.js', 'anti-cheat.js', 'progress.js', 'sheet-sync.js',
     'baseline-spec.js', 'baseline-grade.js', 'baseline-store.js']
        .forEach(f => ok(inlined.includes(f), 'page does not load ' + f));
});

// ns-migrate.js reads and rewrites every key at load time. Anything that reads
// storage before it has run sees an empty store: no error, the student is
// simply greeted as brand new with no history. The sister app's baseline has no
// such line because it has no legacy namespace — its script block is not the
// model for this one.
t('ns-migrate runs before anything that reads storage', () => {
    const order = inlined.indexOf('ns-migrate.js');
    eq(order, 0, 'ns-migrate.js is not the first script:');
    ok(order < inlined.indexOf('progress.js'), 'progress.js reads storage first');
    ok(order < inlined.indexOf('baseline-store.js'), 'baseline-store.js reads storage first');
});

// Ungated, the page is open to anyone with the URL AND — worse — mastery_user
// is never set, so the screener is sat as "guest": the record files under
// satrw_baseline_guest and the sheet row is attributed to nobody.
t('the page is gated', () => {
    ok(inlined.indexOf('gate.js') === 1, 'gate.js is not immediately after ns-migrate');
});

t('page boots with no script errors', () => eq(pageErrors, []));
t('bank assembled in the page', () => eq(ev('questionBank.length'), 719));
t('form built to 22 items', () => eq(ev('Q.length'), 22));
t('the clock is the SAT sitting, not the sister app\'s', () =>
    eq(ev('remaining'), 22 * 71));

t('form note tells the student which sitting this is', () => {
    const s = doc.getElementById('formNote').textContent;
    ok(/Form A/.test(s) && /first sitting/.test(s), 'got: ' + s);
});

t('no resume box on a clean device', () => {
    ok(doc.getElementById('resumeBox').classList.contains('hidden'));
});

console.log('\nTHE SERVED ORDER\n----------------');
const servedSkills = JSON.parse(ev('JSON.stringify(Q.map(function(q){return q.skill;}))'));
const servedDomains = JSON.parse(ev(
    'JSON.stringify(Q.map(function(q){return SKILL_DOMAIN[q.skill];}))'));

t('every served item is Medium difficulty', () => {
    const d = JSON.parse(ev('JSON.stringify(Q.map(function(q){return q.difficulty;}))'));
    ok(d.every(x => x === 'Medium'), 'served: ' + [...new Set(d)].join(', '));
});

t('all 11 skills are served, twice each', () => {
    const c = {};
    servedSkills.forEach(s => { c[s] = (c[s] || 0) + 1; });
    eq(Object.keys(c).length, 11);
    Object.entries(c).forEach(([s, n]) => eq(n, 2, s + ':'));
});

t('the two items of a skill are never adjacent', () => {
    servedSkills.forEach((s, i) => ok(i === 0 || servedSkills[i - 1] !== s,
        'adjacent duplicate skill at ' + i + ': ' + s));
});

// The order the STUDENT meets, not the order the builder produced. In the
// sister app the spread undid the domain blocking and the sequence became one
// repeating eleven-item cycle; its e2e suite passed because it only checked
// non-adjacency.
t('the served order runs in real domain blocks', () => {
    const idx = servedDomains.map(d => JSON.parse(ev('JSON.stringify(RW_DOMAIN_ORDER)')).indexOf(d));
    idx.forEach((v, i) => ok(i === 0 || idx[i - 1] <= v,
        'leaves and re-enters a domain at ' + i + ': ' + servedDomains.join(',')));
});

t('and Conventions comes before Expression, as on the real test', () => {
    ok(servedDomains.lastIndexOf('Std. English Conv.')
       < servedDomains.indexOf('Expression of Ideas'),
       'domain order is the sister app\'s, not ours: ' + servedDomains.join(','));
});

console.log('\nDRIVING THE SCREENER\n--------------------');

t('start reveals the test and hides the intro', () => {
    win.startTest();
    ok(doc.getElementById('intro').classList.contains('hidden'), 'intro still visible');
    ok(!doc.getElementById('test').classList.contains('hidden'), 'test not visible');
});

t('every question renders a stem and at least two options', () => {
    const n = ev('Q.length');
    for (let i = 0; i < n; i++) {
        ev('idx = ' + i); win.render();
        const stem = doc.querySelector('.qtext');
        const opts = doc.querySelectorAll('.opt');
        ok(stem && stem.textContent.trim().length > 0, 'question ' + (i + 1) + ' has no stem');
        ok(opts.length >= 2, 'question ' + (i + 1) + ' rendered ' + opts.length + ' options');
    }
});

t('selecting an option marks it', () => {
    ev('idx = 0'); win.render();
    doc.querySelectorAll('.opt')[1].dispatchEvent(new win.Event('click'));
    ok(doc.querySelectorAll('.opt')[1].classList.contains('sel'), 'selection not shown');
});

// A crashed tab must not cost 26 minutes. The draft is scratch and must never
// be mistaken for a finished sitting.
t('a part-finished sitting is written to a draft', () => {
    const d = JSON.parse(ev('JSON.stringify(getBaselineDraft())'));
    ok(d, 'nothing was drafted after an answer was chosen');
    eq(d.form, 'A');
    ok(d.answers.some(a => a !== null), 'the draft holds no answers');
});

t('the draft is not a baseline', () => {
    eq(JSON.parse(ev('JSON.stringify(getBaselines())')), [],
       'a half-finished sitting is being counted as a sitting');
});

t('a full run of answers is accepted', () => {
    // Conventions perfect (→ ceiling probes), Expression blank (→ floor probes),
    // everything else exactly one of two (→ Developing, no probe at all).
    //
    // Count PER SKILL, not with a global alternating flip. A flip alternating
    // down the served order looks like it gives every skill 1/2, and it does —
    // but only in a domain with an odd number of skills. Information & Ideas
    // owns four, so a skill's two items land on the same parity and it comes
    // out 2/2 or 0/2. That is how this test first asked for four probes and got
    // eight, and it is worth knowing: the served order is domain-blocked, so
    // anything that assumes a simple stride across it will be wrong in exactly
    // one domain.
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
    eq(ev('answers.filter(function(a){return a===null;}).length'), 0);
});

t('finishing the screener renders results without error', () => {
    win.finishScreener();
    ok(!doc.getElementById('results').classList.contains('hidden'), 'results hidden');
    ok(doc.getElementById('results').innerHTML.length > 500, 'results panel is empty');
    eq(pageErrors, []);
});

t('finishing clears the draft', () => {
    eq(JSON.parse(ev('JSON.stringify(getBaselineDraft())')), null,
       'the scratch draft survived a completed sitting');
});

console.log('\nRESULTS PANEL\n-------------');
t('a score RANGE is shown, never a single number', () => {
    const big = doc.querySelector('#results .big').textContent;
    ok(/^\d{3}–\d{3}$/.test(big.trim()), 'got: ' + big);
    const [lo, hi] = big.trim().split('–').map(Number);
    ok(hi > lo, 'collapsed to a point');
    ok(lo >= 200 && hi <= 800, 'off the SAT 200–800 scale: ' + big);
});

t('all 11 skills appear in the results table', () => {
    const rows = doc.querySelectorAll('#results table.diag tr');
    ok(rows.length >= 12, 'only ' + rows.length + ' rows including the header');
});

t('a ranked plan is rendered', () => {
    const f = doc.querySelectorAll('#results .focus');
    ok(f.length > 0, 'no focus items');
    ok(/1\./.test(f[0].textContent), 'the plan is not numbered');
});

t('the follow-up is offered with a real count', () => {
    const html = doc.getElementById('results').innerHTML;
    ok(/Optional follow-up/.test(html), 'no follow-up offered');
    ok(/\d+ question/.test(html), 'no question count in the offer');
});

t('the screener is persisted the moment it finishes', () => {
    const list = JSON.parse(ev('JSON.stringify(getBaselines())'));
    eq(list.length, 1);
    eq(list[0].stage, 'screener');
    eq(list[0].total, 22);
    eq(list[0].sitting, 1);
    ok(list[0].projection.low > 0, 'no projection stored');
    eq(Object.keys(list[0].skills).length, 11);
    ok(list[0].items.every(i => typeof i.seconds === 'number'), 'per-item timing not stored');
});

t('it is filed under the signed-in student, not guest', () => {
    ok(ev('localStorage.getItem("satrw_baseline_Tester")'), 'not filed under the student');
    eq(ev('localStorage.getItem("satrw_baseline_guest")'), null, 'a guest record was written');
});

// ── the rule that made this port worth doing ──────────────────────
// A ledger row makes a question SEEN; a miss lands on rung zero of the review
// ladder, due in one day; and dueForReview() draws from the whole bank on
// nothing but "seen and overdue". A baseline is designed to miss across all
// eleven skills, so writing it would seed the next morning's homework with
// review from skills nobody has taught. AGENTS.md: "a 'review' block that hands
// a student an untaught skill cold is not review."
t('the baseline never touches the mastery ledger', () => {
    const ledger = JSON.parse(ev('JSON.stringify(getProgress())'));
    const rows = Object.entries(ledger);
    eq(rows.length, 0, 'the baseline wrote ' + rows.length + ' ledger rows: '
        + rows.slice(0, 3).map(([id]) => id).join(', '));
});

t('and so nothing it served can be drawn for review tomorrow', () => {
    // The end-to-end statement of the rule, against the real draw rather than
    // against the ledger it reads. If someone re-adds the write, this is the
    // test that says what it costs.
    const due = JSON.parse(ev(
        'JSON.stringify((dueForReview(questionBank, 50, {})||[]).map(function(q){return q.id;}))'));
    eq(due, [], 'the baseline made ' + due.length + ' questions due for review');
});

t('the focus queue is handed off to the app', () => {
    const fq = JSON.parse(ev('JSON.stringify(getFocusQueue())'));
    ok(fq && fq.skills.length > 0, 'focus queue empty');
    ok(fq.skills[0].score >= fq.skills[fq.skills.length - 1].score, 'queue unsorted');
});

t('the same queue is in the record, for the sheet', () => {
    const rec = JSON.parse(ev('JSON.stringify(latestBaseline())'));
    const fq  = JSON.parse(ev('JSON.stringify(getFocusQueue())'));
    eq(rec.focus, fq.skills, 'the record and the live key disagree about the plan:');
});

t('conventions routed to a ceiling probe, expression to a floor probe', () => {
    const s = JSON.parse(ev('JSON.stringify(latestBaseline().skills)'));
    eq(s['Boundaries'].routedProbe, 'Hard');
    eq(s['Form, Structure, and Sense'].routedProbe, 'Hard');
    eq(s['Rhetorical Synthesis'].routedProbe, 'Easy');
    eq(s['Transitions'].routedProbe, 'Easy');
    eq(s['Words in Context'].routedProbe, null, 'a half-right skill spent a probe:');
});

console.log('\nDRIVING THE FOLLOW-UP\n---------------------');
t('the follow-up starts and serves only routed skills at the right tier', () => {
    win.startProbes();
    const set = JSON.parse(ev(
        'JSON.stringify(Q.map(function(q){return [q.skill,q.difficulty];}))'));
    eq(set.length, 4, 'expected 2 ceiling + 2 floor probes, got ' + set.length);
    set.forEach(([skill, diff]) => {
        const want = (skill === 'Boundaries' || skill === 'Form, Structure, and Sense')
            ? 'Hard' : 'Easy';
        eq(diff, want, skill + ':');
    });
});

t('probes never reuse a screener question', () => {
    const probeIds = JSON.parse(ev('JSON.stringify(Q.map(function(q){return q.id;}))'));
    const seenIds  = JSON.parse(ev('JSON.stringify(screenerItems.map(function(i){return i.id;}))'));
    probeIds.forEach(id => ok(!seenIds.includes(id), id + ' was already served'));
});

t('finishing the follow-up amends the same record', () => {
    ev(`
      Q.forEach(function (q, i) {
        answers[i] = q.probeTier === 'Hard' ? q.answer
          : q.options.map(function (o) { return o.trim()[0]; })
                     .filter(function (l) { return l !== q.answer; })[0];
        times[i] = 70;
      });
    `);
    win.finishProbes();
    const list = JSON.parse(ev('JSON.stringify(getBaselines())'));
    eq(list.length, 1, 'the follow-up created a second record:');
    eq(list[0].stage, 'complete');
    eq(list[0].items.length, 26);
});

t('bands resolve in both directions after the probes', () => {
    const s = JSON.parse(ev('JSON.stringify(latestBaseline().skills)'));
    eq(s['Boundaries'].band, 'Secure', 'a passed ceiling probe did not promote:');
    eq(s['Rhetorical Synthesis'].band, 'Foundational', 'a failed floor probe did not demote:');
    eq(s['Boundaries'].confidence, 'probed');
});

t('the follow-up offer disappears once it is done', () => {
    ok(!/Optional follow-up/.test(doc.getElementById('results').innerHTML),
       'still offering a follow-up that has been sat');
});

t('the ledger is still untouched after the probes', () => {
    eq(Object.keys(JSON.parse(ev('JSON.stringify(getProgress())'))).length, 0);
});

console.log('\nTHE REVIEW\n----------');
t('review shows every item with its explanation', () => {
    const revs = doc.querySelectorAll('#results .rev');
    ok(revs.length >= 26, 'only ' + revs.length + ' review rows');
    ok(doc.querySelectorAll('#results details.exp').length >= 26, 'explanations missing');
});

// The review panel used to print the skill, two letters and the rationale — and
// nothing else. No stem, no passage, no options. "Your answer: B · Correct: C"
// is not something a student can work through, and the rationale referred to a
// text no longer on the page. AGENTS.md: "Every question survives the set —
// passage, her answer, the right answer, the explanation — re-readable." The
// baseline is the sitting most likely to be reviewed with a tutor, and it was
// the one sitting you could not review.
t('the review carries the whole question, not just the letters', () => {
    const revs = [...doc.querySelectorAll('#results .rev')];
    // textContent walks a subtree that now holds a whole passage, so compute it
    // once per row rather than once per row per lookup.
    const revText = revs.map(r => r.textContent);

    const served = JSON.parse(ev(
        'JSON.stringify(screenerItems.map(function(i){'
        + 'var q=questionBank.find(function(x){return x.id===i.id;});'
        + 'return {stem:q.question, n:(q.options||[]).length};}))'));

    served.forEach(s => {
        const at = revText.findIndex(x => x.indexOf(s.stem.slice(0, 40)) !== -1);
        ok(at !== -1, 'no review row carries the stem: ' + s.stem.slice(0, 60));
        const opts = revs[at].querySelectorAll('.opt');
        eq(opts.length, s.n, 'review row shows ' + opts.length
            + ' of ' + s.n + ' options for: ' + s.stem.slice(0, 40));
    });
});

t('the review marks the right answer and the one that was chosen', () => {
    const html = doc.getElementById('results').innerHTML;
    ok(/correct/i.test(html), 'nothing in the review is marked correct');
    ok(/you chose this/i.test(html),
       'a wrong answer is never pointed at, so the student cannot see what they did');
});

t('misses come first', () => {
    const tags = [...doc.querySelectorAll('#results .rev .tag')].map(e => e.textContent.trim());
    const firstCorrect = tags.indexOf('Correct');
    const lastMiss     = tags.lastIndexOf('Review');
    ok(firstCorrect === -1 || lastMiss === -1 || lastMiss < firstCorrect,
       'correct items are mixed in above misses: ' + tags.join(','));
});

t('no script errors across the entire session', () => eq(pageErrors, []));

console.log('\n' + '='.repeat(46));
console.log(`${pass} passed, ${fail} failed`);
console.log('='.repeat(46) + '\n');
win.close();
process.exit(fail ? 1 : 0);
