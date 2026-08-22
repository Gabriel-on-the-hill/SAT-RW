// baseline-recover.test.js — can a stranded baseline still be sent?
// Run: NODE_PATH=/tmp/j/node_modules node baseline-recover.test.js
//
// A baseline is saved to the browser the instant it finishes, before anything
// goes over the network. That is the right order — a dead endpoint must never
// cost a student their result — but it means a sitting can end up complete,
// correct and invisible: the sync was down, the page was open before the sheet
// knew about baselines, or it was sat without signing in and filed under
// "guest". baseline-recover.html is the way back, and this drives it.

const fs = require('fs');
const path = require('path');

let JSDOM, VirtualConsole;
try {
    const p = process.env.JSDOM_PATH || 'jsdom';
    ({ JSDOM, VirtualConsole } = require(p));
} catch (e) {
    console.log('SKIP — jsdom not found. npm install jsdom --prefix /tmp/j, '
              + 'then NODE_PATH=/tmp/j/node_modules node baseline-recover.test.js');
    process.exit(0);
}

let pass = 0, fail = 0;
const t = (n, f) => { try { f(); console.log('  ok   ' + n); pass++; }
                      catch (e) { console.log('  FAIL ' + n + '\n       ' + e.message); fail++; } };
const ok = (c, m) => { if (!c) throw new Error(m || 'expected truthy'); };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b))
    throw new Error((m || '') + ' expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a)); };

// A record shaped exactly like one baseline.html writes, small enough to assert
// on line by line. Three skills, six items, one probe.
const REC = {
    takenAt: 1750000000000,
    savedAt: 1750000000000,
    sitting: 1,
    form: 'A',
    stage: 'screener',
    version: 1,
    correct: 3,
    total: 6,
    blurCount: 2,
    projection: { low: 480, high: 540, accuracy: 50, blanks: 0, domains: {}, caveat: 'x' },
    skills: {
        'Inferences':  { band: 'Priority',   confidence: 'provisional',
                         screenCorrect: 0, screenTotal: 2, probeTier: null,
                         probeCorrect: null, routedProbe: 'Easy', flags: [], note: null },
        'Boundaries':  { band: 'Proficient', confidence: 'provisional',
                         screenCorrect: 2, screenTotal: 2, probeTier: null,
                         probeCorrect: null, routedProbe: 'Hard', flags: [], note: null },
        'Transitions': { band: 'Developing', confidence: 'resolved',
                         screenCorrect: 1, screenTotal: 2, probeTier: null,
                         probeCorrect: null, routedProbe: null, flags: [], note: null },
    },
    focus: [
        { skill: 'Inferences',  band: 'Priority',   weight: 0.075, score: 0.15 },
        { skill: 'Transitions', band: 'Developing', weight: 0.082, score: 0.082 },
    ],
    items: [
        { id: 'i1', skill: 'Inferences',  difficulty: 'Medium', stage: 1, chosen: 'A', correct: false, seconds: 40 },
        { id: 'i2', skill: 'Inferences',  difficulty: 'Medium', stage: 1, chosen: 'B', correct: false, seconds: 40 },
        { id: 'b1', skill: 'Boundaries',  difficulty: 'Medium', stage: 1, chosen: 'C', correct: true,  seconds: 40 },
        { id: 'b2', skill: 'Boundaries',  difficulty: 'Medium', stage: 1, chosen: 'D', correct: true,  seconds: 40 },
        { id: 't1', skill: 'Transitions', difficulty: 'Medium', stage: 1, chosen: 'A', correct: true,  seconds: 35 },
        { id: 't2', skill: 'Transitions', difficulty: 'Medium', stage: 1, chosen: 'B', correct: false, seconds: 35 },
    ],
};

const pageErrors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => pageErrors.push(e.message.split('\n')[0]));

let html = fs.readFileSync(path.join(__dirname, 'baseline-recover.html'), 'utf8');
const inlined = [];
html = html.replace(/<script src="([^"]+?)(?:\?[^"]*)?"><\/script>/g, (whole, src) => {
    if (/^https?:/.test(src)) return '';
    const file = path.join(__dirname, src);
    if (!fs.existsSync(file)) throw new Error('page references a missing file: ' + src);
    inlined.push(src);
    return '<script>' + fs.readFileSync(file, 'utf8').replace(/<\/script/gi, '<\\/script') + '</script>';
});
html = html.replace(/<link[^>]*fonts\.googleapis[^>]*>/g, '');

const posts = [];
console.log('\nBOOTING WITH A GUEST-FILED RECORD\n' + '-'.repeat(33));
const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    url: 'http://localhost/baseline-recover.html',
    virtualConsole: vc,
    beforeParse(win) {
        win.alert = () => {}; win.confirm = () => true; win.scrollTo = () => {};
        win.fetch = (url, opts) => {
            let body = null;
            try { body = JSON.parse((opts && opts.body) || 'null'); } catch (e) {}
            posts.push({ url, body });
            return Promise.resolve({ ok: true, status: 200 });
        };
        win.URL.createObjectURL = () => 'blob:stub';
        win.URL.revokeObjectURL = () => {};
        // Sat without signing in, so it is under "guest" — the case most likely
        // to need recovering, and the one nobody can attribute after the fact.
        win.localStorage.setItem('satrw_baseline_guest', JSON.stringify([REC]));
        win.sessionStorage.setItem('mastery_unlocked', '1');
        win.sessionStorage.setItem('mastery_user', 'Tester');
        win.sessionStorage.setItem('mastery_role', 'student');
    },
});
const win = dom.window;
const doc = win.document;
const ev  = e => win.eval(e);
const $   = id => doc.getElementById(id);

function waitFor(fn, ms) {
    const end = Date.now() + (ms || 15000);
    return new Promise((res, rej) => {
        (function poll() {
            let v = false; try { v = fn(); } catch (e) { v = false; }
            if (v) return res(true);
            if (Date.now() > end) return rej(new Error('timed out booting'));
            setTimeout(poll, 40);
        })();
    });
}

(async function run() {
    await waitFor(() => ev('typeof findAllBaselines') === 'function');
    ev('render()');

    t('the page boots clean', () => eq(pageErrors, []));
    t('it is gated like every other page', () => ok(inlined.includes('gate.js')));

    // ns-migrate is what puts a legacy record under the name this page looks it
    // up by. Skip it and the page truthfully reports "nothing found" about a
    // record sitting right there.
    t('ns-migrate runs first, or the hunt looks in the wrong namespace', () =>
        eq(inlined.indexOf('ns-migrate.js'), 0, 'script order is ' + inlined.join(' → ') + ':'));

    t('it finds a record filed under guest', () => {
        const txt = $('out').textContent;
        ok(/guest/i.test(txt), 'guest record not listed: ' + txt.slice(0, 120));
        ok(/Form A/.test(txt), 'form not shown');
        ok(/3\/6/.test(txt), 'score not shown: ' + txt.slice(0, 200));
        ok(/480–540/.test(txt), 'projected range not shown');
    });

    t('it says the record is unattributed and what to do', () => {
        ok(/guest/i.test($('out').textContent));
        ok(doc.querySelector('.warn'), 'no warning about the missing name');
    });

    t('it will not send an unnamed row', () => {
        $('name-0-0').value = '';
        $('send-0-0').dispatchEvent(new win.Event('click'));
        eq(posts.length, 0, 'a row with no student name went up');
        ok(/name/i.test($('msg-0-0').textContent), 'no explanation given');
    });

    console.log('\nSENDING IT\n' + '-'.repeat(10));
    $('name-0-0').value = 'Tester';
    $('send-0-0').dispatchEvent(new win.Event('click'));

    t('one row goes up', () => eq(posts.length, 1));
    const p = posts[0];

    t('it is attributed to the name that was typed, not the session', () =>
        eq(p.body.student, 'Tester'));

    t('it is typed as a baseline', () => eq(p.body.type, 'baseline'));

    t('the whole baseline block survives', () => {
        ok(p.body.baseline, 'the baseline block was dropped');
        eq(p.body.baseline.form, 'A');
        eq(p.body.baseline.sitting, 1);
        eq(p.body.baseline.projectionLow, 480);
        eq(p.body.baseline.projectionHigh, 540);
    });

    t('every band survives, with its confidence', () => {
        const b = p.body.baseline.bands;
        eq(Object.keys(b).length, 3);
        eq(b['Inferences'].band, 'Priority');
        eq(b['Inferences'].screener, '0/2');
        eq(b['Boundaries'].confidence, 'provisional');
        eq(b['Transitions'].band, 'Developing');
    });

    t('the ranked plan survives', () => {
        eq(p.body.baseline.focus.length, 2);
        eq(p.body.baseline.focus[0].skill, 'Inferences');
    });

    t('per-question detail survives', () => {
        eq(p.body.questions.length, 6);
        ok(p.body.questions.every(q => q.id && typeof q.secs === 'number'));
    });

    t('the duration column is populated', () => eq(p.body.duration, 230));

    t('the row is marked as a backfill, not mistaken for a live sitting', () => {
        eq(p.body.recovered, true);
    });

    t('the button disables so it cannot be double-posted', () => {
        $('send-0-0').dispatchEvent(new win.Event('click'));
        eq(posts.length, 1, 'the row went up twice');
    });

    console.log('\nIT MATCHES WHAT A LIVE SITTING WOULD HAVE SENT\n' + '-'.repeat(45));

    t('the payload builder is shared with baseline.html', () => {
        const live = JSON.parse(ev('JSON.stringify(baselineSheetPayload('
            + JSON.stringify(REC) + ', "Tester"))'));
        // `recovered` is the only field the recovery page adds.
        const sent = Object.assign({}, p.body);
        delete sent.recovered;
        // sheet-sync fills a couple of defaults the raw builder leaves out, and
        // renames one: the builder's `source` is what sheet-sync posts as
        // `type`, asserted separately above. Comparing it here would only
        // assert that the rename did not happen.
        // `sessionId` is NOT on this list. It used to be, and that exclusion was
        // hiding the fact that the builder emitted none — which left every
        // per-question row in the sheet with nothing to join back to.
        ['assignmentId'].forEach(k => delete sent[k]);
        delete live.source;
        Object.keys(live).forEach(k => {
            eq(sent[k], live[k], 'field "' + k + '" differs from a live row:');
        });
    });

    console.log('\nA DRAFT IS NOT A SITTING\n' + '-'.repeat(24));
    // The mid-sitting draft lives under the same prefix. A half-finished
    // screener must never be offered for upload as though it were a result.
    t('an unfinished draft is not listed as recoverable', () => {
        ev(`localStorage.setItem('satrw_baseline_draft_Tester',
              JSON.stringify({form:'A',idx:3,answers:['A'],times:[10],remaining:900}));`);
        ev('render()');
        ok(!/draft/i.test($('out').textContent),
           'a scratch draft is being offered as a baseline: ' + $('out').textContent.slice(0, 160));
    });

    console.log('\nAN EMPTY DEVICE SAYS SO PLAINLY\n' + '-'.repeat(31));

    t('a browser with no baseline reports nothing found', () => {
        ev('localStorage.removeItem("satrw_baseline_guest")');
        ev('localStorage.removeItem("satrw_baseline_draft_Tester")');
        ev('render()');
        ok(/No baseline found/i.test($('out').textContent),
           'an empty device did not say so: ' + $('out').textContent.slice(0, 120));
    });

    t('no script errors across the whole run', () => eq(pageErrors, []));

    console.log('\n' + '='.repeat(48));
    console.log(`${pass} passed, ${fail} failed`);
    console.log('='.repeat(48) + '\n');
    win.close();
    process.exit(fail ? 1 : 0);
})().catch(e => {
    console.error('\nHARNESS ERROR: ' + e.message);
    console.error(pageErrors.slice(0, 5).join('\n'));
    process.exit(1);
});
