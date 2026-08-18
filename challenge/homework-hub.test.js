// ─────────────────────────────────────────────────────────────────
// homework-hub.test.js — does the homework hub route each student correctly?
//
//   NODE_PATH=/tmp/j/node_modules node challenge/homework-hub.test.js
//
// A plan carrying `challenge:` and no days must show a challenge card whose
// completion is mastery — never a "Done" tick. A plan carrying days must show an
// ordinary set list and no card. Both fixtures are DERIVED from the roster and
// from HOMEWORK, never named: on 18 Aug a hardcoded student key was cleared to a
// challenge plan and took four assertions red with it, which read as a hub bug
// and was only a re-assignment. Plans change weekly; they cannot be fixtures.
//
// The hub loads NO question banks. Its tally comes from the frozen ids plus the
// ledger, because segmentOf() reads only q.id. This test asserts that too: if
// someone later makes the hub depend on the banks, it fails here.
// ─────────────────────────────────────────────────────────────────
'use strict';
const fs = require('fs');
const path = require('path');

let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch (e) { console.log('SKIP — jsdom not installed.'); process.exit(0); }

const APP = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');

// ── Expectations are DERIVED FROM THE ROSTER, never written as literals ──
//
// This suite used to hardcode "Practice 8", "28 questions" and "50%". Those went
// stale the day that set was retired, and the failures read as product bugs when
// they were only fixture drift. The hub picks its set by `plan.challenge`, so
// that is what these read — a set appended, retired or renamed must not touch
// this file.
const HOMEWORK_SRC = (() => {
    const src = read('homework/assignments.js');
    return new Function(src + '; return HOMEWORK;')();
})();
const SETS_SRC = (() => { const w = {}; new Function('window', read('challenge/sets.js'))(w); return w.CHALLENGE_SETS; })();
const PLAN = HOMEWORK_SRC.Jeffrey;
const SET  = SETS_SRC.Jeffrey.filter(s => s.setId === PLAN.challenge)[0];
const N    = SET.ids.length;
const esc  = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const RAW = read('homework-hub.html');
const HTML = RAW.replace(/<script\b[^>]*src[^>]*><\/script>/gi, '').replace(/<link\b[^>]*>/gi, '');

// Exactly the scripts the page declares, in order — proof that this list is
// sufficient, and that no bank is among them.
const DECLARED = [...RAW.matchAll(/<script\s+src="([^"?]+)/gi)].map(m => m[1]);

function build(student, ledger) {
    return new Promise(resolve => {
        const dom = new JSDOM(HTML, {
            runScripts: 'dangerously',
            url: 'http://localhost/homework-hub.html',
            beforeParse(w) { w.fetch = () => Promise.resolve({ ok: true }); },
        });
        const w = dom.window;
        w.sessionStorage.setItem('mastery_unlocked', '1');
        w.sessionStorage.setItem('mastery_user', student);
        if (ledger) w.localStorage.setItem('satrw_progress_' + student, JSON.stringify(ledger));
        for (const f of DECLARED) {
            const s = w.document.createElement('script');
            s.textContent = read(f);
            w.document.body.appendChild(s);
        }
        // the page's own inline <script> is still in HTML and ran during parse,
        // but it needs the externals above, so re-run it now.
        // \s* not \n — on a Windows checkout the working tree is CRLF, and a
        // literal \n silently fails to match, leaving `inline` null and crashing
        // the whole suite before a single assertion runs. A suite that dies
        // looks exactly like a suite that passes if you only read the exit line.
        const inline = RAW.match(/<script>\s*\(function\(\)\s*\{[\s\S]*?<\/script>/);
        if (!inline) throw new Error('could not find the inline <script> in homework-hub.html');
        const s = w.document.createElement('script');
        s.textContent = inline[0].replace(/^<script>/, '').replace(/<\/script>$/, '');
        w.document.body.appendChild(s);
        setTimeout(() => resolve(w), 0);
    });
}

let pass = 0, fail = 0;
const fails = [];
const ok = (n, c, d) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; fails.push(n); console.log('  ✗ ' + n + (d ? ' — ' + d : '')); } };
const eq = (n, a, b) => ok(n, a === b, 'got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b));
const txt = w => w.document.getElementById('list').textContent.replace(/\s+/g, ' ').trim();
const note = w => w.document.getElementById('note').textContent.replace(/\s+/g, ' ').trim();

async function main() {

console.log('\n1 · The hub loads no question banks');
{
    ok('no data-*.js among declared scripts', !DECLARED.some(f => /^data-/.test(f)), DECLARED.join(', '));
    ok('progress.js declared', DECLARED.includes('progress.js'));
    ok('challenge-core declared', DECLARED.includes('challenge/challenge-core.js'));
}

console.log('\n2 · Jeffrey gets a challenge card, not a day list');
{
    const w = await build('Jeffrey');
    const t = txt(w);
    eq('title is the challenge', w.document.getElementById('title').textContent, PLAN.title);
    ok('card names the set', new RegExp(esc(SET.title)).test(t), t);
    ok(N + ' questions', new RegExp(N + ' questions').test(t));
    ok('tally from the ledger', /mastered 0/.test(t) && new RegExp('not attempted ' + N).test(t), t);
    ok('shows 0%', />0%<|0%/.test(w.document.getElementById('list').innerHTML));
    ok('NO Done badge', !/>Done</.test(w.document.getElementById('list').innerHTML));
    ok('no day gate language', !/Start day/.test(t));
    ok('says it is not finished after one pass', new RegExp('not finished until all ' + N + ' are mastered').test(t), t);
    ok('links to the deep link', /index\.html\?challenge=1/.test(w.document.getElementById('list').innerHTML));
    ok('footer explains no daily sets', /no daily sets this week/.test(note(w)), note(w));
}

console.log('\n3 · The card tracks the ledger, and only ever says "mastered" when it is');
{
    // Ids come off the SERVED set, evaluated from the roster (see the header),
    // not scraped with a regex. The old scrape took the FIRST `ids: [...]` in
    // the file, which is only the served set by coincidence of ordering — and
    // it broke on comments, on retired blocks and on any set appended above.
    const ids = SET.ids;
    const halfN = Math.floor(N / 2);
    const pct   = Math.round(halfN / N * 100);
    const half = {}; ids.slice(0, halfN).forEach(id => { half[id] = { correct: 2, wrong: 0, lastSeen: Date.now() }; });
    const w1 = await build('Jeffrey', half);
    ok('half mastered → ' + pct + '%', new RegExp(pct + '%').test(w1.document.getElementById('list').innerHTML), txt(w1));
    ok('still not finished', new RegExp('not finished until all ' + N).test(txt(w1)));
    ok('still no Done badge', !/>Done</.test(w1.document.getElementById('list').innerHTML));

    const all = {}; ids.forEach(id => { all[id] = { correct: 2, wrong: 0, lastSeen: Date.now() }; });
    const w2 = await build('Jeffrey', all);
    ok('all mastered → Mastered badge', /Mastered</.test(w2.document.getElementById('list').innerHTML));
    ok('congratulates', /Every question is mastered/.test(txt(w2)), txt(w2));

    const once = {}; ids.forEach(id => { once[id] = { correct: 1, wrong: 0, lastSeen: Date.now() }; });
    const w3 = await build('Jeffrey', once);
    ok('confirm gate surfaces on the hub', /a second time to master them/.test(txt(w3)), txt(w3));
}

console.log('\n4 · Everyone else is untouched');
{
    // THE KEY IS DERIVED, NOT NAMED — and that is the whole point of this block.
    //
    // It used to read `build('Segun')`, because that key had a sequential day
    // list when the suite was written. On 18 Aug that plan was cleared to
    // `days: []` with a `challenge:`, and these four assertions went red — not
    // because the hub broke, but because the fixture had been re-taught. That is
    // the same failure the header warns about one level up: this file already
    // refuses to hardcode "Practice 8" or "28 questions", and hardcoding WHICH
    // STUDENT still has daily sets is the identical mistake. A plan is a thing
    // that gets re-assigned every week. It cannot be a fixture.
    //
    // So: take any key that carries a sequential day list. Assign, clear or swap
    // any student and this still tests the routing it was written to test. If NO
    // key has days, that is a real finding and the block says so rather than
    // silently asserting nothing.
    const daysKey = Object.keys(HOMEWORK_SRC).find(k =>
        HOMEWORK_SRC[k].unlock === 'sequential' && (HOMEWORK_SRC[k].days || []).length > 1);
    ok('some key still carries a sequential day list to test the routing against',
        !!daysKey, Object.keys(HOMEWORK_SRC).join(', '));

    if (daysKey) {
        // A day-list plan must get a normal set list and never a challenge card.
        // Under sequential unlock the wording is "set", later sets are gated on
        // finishing the one before, and the footer states BOTH rules — how they
        // open, and the window they are meant to be spread over. A student who is
        // not told the second one will sit and do the lot in an evening, which is
        // the spacing gone.
        const s = await build(daysKey);
        ok('a day-list plan gets a set list, not a challenge card',
            /Start set 1/.test(txt(s)), txt(s));
        ok('the second set is gated on finishing the first',
            /Opens when you finish set 1/.test(txt(s)), txt(s));
        ok('the footer explains that finishing one opens the next',
            /next set opens as soon as you submit/i.test(note(s)), note(s));
        ok('and gives the window, so he is not pushed to rush them',
            /spread them out/i.test(note(s)), note(s));
        ok('and no challenge card is shown', !/Open the Challenge/.test(txt(s)), txt(s));
    }
}

}

main().then(() => {
    console.log('\n' + '─'.repeat(64));
    console.log(fail === 0 ? `ALL ${pass} ASSERTIONS PASSED` : `${pass} passed, ${fail} FAILED:\n  - ` + fails.join('\n  - '));
    process.exit(fail === 0 ? 0 : 1);
}).catch(e => { console.error(e); process.exit(1); });
