// ─────────────────────────────────────────────────────────────────
// set-number.test.js — a set is found by its number, not its place in the list.
//
//   NODE_PATH=/path/to/node_modules node homework/set-number.test.js
//
// A plan that keeps its start date (so earlier completion keys survive) continues the
// calendar numbering, so its only set can be { n: 15 }. The hub listed that set and
// linked to day=15, but the runner looked up plan.days[14] and showed "This homework
// day was not found" — the set could not be opened at all. Sequential unlock had the
// same assumption: it required sets 1…14 before set 15 would open.
// ─────────────────────────────────────────────────────────────────
'use strict';
const fs = require('fs');
const path = require('path');
let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch (e) { console.log('SKIP — jsdom not installed (see header).'); process.exit(0); }

const APP = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');
const RAW = read('homework-run.html');
const HTML = RAW.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<link\b[^>]*>/gi, '');
const SRCS = [...RAW.matchAll(/<script\s+src="([^"?]+)/gi)].map(m => m[1]);
const INLINE = RAW.match(/<script>\n?([\s\S]*?)<\/script>/)[1];

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name); } }

function iso(daysAgo) { const d = new Date(); d.setDate(d.getDate() - daysAgo);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

function build(plan, day, seed) {
  const dom = new JSDOM(HTML, { runScripts: 'dangerously',
    url: 'http://localhost/homework-run.html?student=__TEST__&day=' + day,
    beforeParse(w) { w.fetch = () => Promise.resolve({ ok: true }); w.scrollTo = () => {}; w.alert = () => {}; w.confirm = () => true; } });
  const w = dom.window;
  w.sessionStorage.setItem('mastery_unlocked', '1');
  w.sessionStorage.setItem('mastery_user', '__TEST__');
  Object.entries(seed || {}).forEach(([k, v]) => w.localStorage.setItem(k, v));
  for (const f of SRCS) { const s = w.document.createElement('script'); s.textContent = read(f); w.document.body.appendChild(s); }
  w.HOMEWORK['__TEST__'] = plan;
  const s = w.document.createElement('script'); s.textContent = INLINE; w.document.body.appendChild(s);
  return w;
}
const text = w => w.document.getElementById('run').textContent;

console.log('\nA plan whose only set is n:15');
const start = iso(20);
const p15 = { title: 't', start, unlock: 'cumulative',
  days: [{ n: 15, focus: 'later set', minutes: 0, review: 0,
    sections: [{ skills: ['Inferences'], diffs: ['Medium'], count: 2 }], tip: 'x' }] };
let w = build(JSON.parse(JSON.stringify(p15)), 15);
ok('the runner opens set 15', !/not found/.test(text(w)) && /Question 1 of/.test(text(w)));
w = build(JSON.parse(JSON.stringify(p15)), 1);
ok('day=1 does not silently open the first listed set', /not found/.test(text(w)));

console.log('\nSequential numbering that starts at 15');
const seq = { title: 't', start: iso(0), unlock: 'sequential',
  days: [{ n: 15, focus: 'a', minutes: 0, count: 2, skills: ['Inferences'], diffs: ['Medium'], tip: 'x' },
         { n: 16, focus: 'b', minutes: 0, count: 2, skills: ['Inferences'], diffs: ['Medium'], tip: 'x' }] };
w = build(JSON.parse(JSON.stringify(seq)), 15);
ok('the first set of the plan is open', w.hwDayOpen('__TEST__', seq, 15) === true);
ok('the second waits for the first', w.hwDayOpen('__TEST__', seq, 16) === false);
w.localStorage.setItem('satrw_hw___TEST___' + seq.start + '_15', '1');
ok('and opens once set 15 is submitted', w.hwDayOpen('__TEST__', seq, 16) === true);

console.log('\n' + '─'.repeat(64));
if (fail) { console.log(fail + ' FAILED'); process.exit(1); }
console.log('ALL ' + pass + ' ASSERTIONS PASSED');
