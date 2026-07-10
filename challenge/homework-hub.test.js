// ─────────────────────────────────────────────────────────────────
// homework-hub.test.js — does the homework hub route each student correctly?
//
//   NODE_PATH=/tmp/j/node_modules node challenge/homework-hub.test.js
//
// Jeffrey's plan carries `challenge: 'p8-rw'` and no days, so the hub must show
// a challenge card whose completion is mastery — never a "Done" tick. Segun's
// plan still has days, so his must be untouched.
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
        if (ledger) w.localStorage.setItem('wayne_progress_' + student, JSON.stringify(ledger));
        for (const f of DECLARED) {
            const s = w.document.createElement('script');
            s.textContent = read(f);
            w.document.body.appendChild(s);
        }
        // the page's own inline <script> is still in HTML and ran during parse,
        // but it needs the externals above, so re-run it now.
        const inline = RAW.match(/<script>\n\(function\(\)\{[\s\S]*?<\/script>/);
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
    eq('title is the challenge', w.document.getElementById('title').textContent, 'This week: your Practice 8 Challenge');
    ok('card names the set', /Practice 8 misses/.test(t), t);
    ok('28 questions', /28 questions/.test(t));
    ok('tally from the ledger', /mastered 0/.test(t) && /not attempted 28/.test(t), t);
    ok('shows 0%', />0%<|0%/.test(w.document.getElementById('list').innerHTML));
    ok('NO Done badge', !/>Done</.test(w.document.getElementById('list').innerHTML));
    ok('no day gate language', !/Start day/.test(t));
    ok('says it is not finished after one pass', /not finished until all 28 are mastered/.test(t), t);
    ok('links to the deep link', /index\.html\?challenge=1/.test(w.document.getElementById('list').innerHTML));
    ok('footer explains no daily sets', /no daily sets this week/.test(note(w)), note(w));
}

console.log('\n3 · The card tracks the ledger, and only ever says "mastered" when it is');
{
    const ids = JSON.parse(read('challenge/sets.js').match(/ids: \[([\s\S]*?)\]/)[1]
        .replace(/'/g, '"').replace(/,\s*$/, '').replace(/^/, '[') + ']');
    const half = {}; ids.slice(0, 14).forEach(id => { half[id] = { correct: 2, wrong: 0, lastSeen: Date.now() }; });
    const w1 = await build('Jeffrey', half);
    ok('half mastered → 50%', /50%/.test(w1.document.getElementById('list').innerHTML), txt(w1));
    ok('still not finished', /not finished until all 28/.test(txt(w1)));
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
    const s = await build('Segun');
    ok('Segun still gets days', /Start day 1/.test(txt(s)), txt(s));
    ok('Segun keeps the day-gate footer', /A new day opens each day/.test(note(s)));

    const b = await build('Bruce');
    ok('Bruce still sees no homework', /No homework is assigned for Bruce/.test(txt(b)), txt(b));
}

}

main().then(() => {
    console.log('\n' + '─'.repeat(64));
    console.log(fail === 0 ? `ALL ${pass} ASSERTIONS PASSED` : `${pass} passed, ${fail} FAILED:\n  - ` + fails.join('\n  - '));
    process.exit(fail === 0 ? 0 : 1);
}).catch(e => { console.error(e); process.exit(1); });
