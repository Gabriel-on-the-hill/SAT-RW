// ─────────────────────────────────────────────────────────────────
// bank.test.js — the question bank has to be classified correctly.
//
//   npm install jsdom --prefix /tmp/j
//   NODE_PATH=/tmp/j/node_modules node homework/bank.test.js
//
// Skips cleanly if jsdom is absent.
//
// A misfiled question is the worst kind of bug here, because nothing breaks. The
// app runs, the set builds, the student practises — she is just never served the
// skill you thought you were teaching her.
//
// That is exactly what happened. The source PDFs label these items only "Command of
// Evidence", never saying which kind, so the parser had to guess — and it guessed by
// counting digits in the extracted passage text. A bar graph is an IMAGE and
// contributes no digits, so every chart-based question scored zero and was filed as
// Textual. Eleven of them. The Quantitative pool was left with 3 Medium questions in
// a 719-question bank, which is why a 4-question homework section could not be filled.
//
// The stem is the honest signal: a quantitative item always asks the student to use
// the graph or the table. This test asserts that, so the next rebuild cannot quietly
// undo the fix. (See _infer_coe_type in ../../parse_new_banks.py.)
// ─────────────────────────────────────────────────────────────────
'use strict';
const fs = require('fs');
const path = require('path');

let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch (e) { console.log('SKIP — jsdom not installed (see header).'); process.exit(0); }

const APP = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');
const BANKS = ['data-craft-structure.js', 'data-expression-of-ideas.js', 'data-info-ideas.js', 'data-conventions.js'];
const PROBE = `window.__QB = function () {
    return [].concat(
        typeof questionBank_CS  !== 'undefined' ? questionBank_CS  : [],
        typeof questionBank_EOI !== 'undefined' ? questionBank_EOI : [],
        typeof questionBank_II  !== 'undefined' ? questionBank_II  : [],
        typeof questionBank_CON !== 'undefined' ? questionBank_CON : []);
};`;

const dom = new JSDOM('<!doctype html><body>', { runScripts: 'dangerously' });
const w = dom.window;
for (const f of BANKS) {
    const s = w.document.createElement('script');
    s.textContent = read(f);
    w.document.body.appendChild(s);
}
const probe = w.document.createElement('script');
probe.textContent = PROBE;
w.document.body.appendChild(probe);
const QB = w.__QB();

let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, detail) {
    if (cond) { pass++; console.log('  ✓ ' + name); }
    else { fail++; fails.push(name); console.log('  ✗ ' + name + (detail ? '\n      ' + detail : '')); }
}
function section(t) { console.log('\n' + t); }

const QUANT = 'Command of Evidence — Quantitative';

// "…uses data from the graph…", "…data in the table…", "…according to the chart…"
const asksAboutData = q => /\b(?:data|information)\b[^.?]*\bfrom the\s+(?:graph|table|chart|figure)|\bdata in the\s+(?:graph|table|chart|figure)|\baccording to the\s+(?:graph|table|chart|figure)/i
    .test(q.question || '');

section('The bank loaded');
ok('there are questions', QB.length > 0, `${QB.length} questions`);
ok('every question has a skill', QB.every(q => !!q.skill));
ok('every question has a difficulty', QB.every(q => ['Easy', 'Medium', 'Hard'].includes(q.difficulty)));

section('Data questions are filed as Quantitative');
{
    const misfiled = QB.filter(q => asksAboutData(q) && q.skill !== QUANT);
    ok('no question that asks the student to read a graph/table is filed elsewhere',
        misfiled.length === 0,
        misfiled.map(q => `${q.id} [${q.skill} · ${q.difficulty}] "${(q.question || '').slice(0, 70)}…"`).join('\n      '));
}

section('Every question a figure is attached to actually resolves');
{
    const withImg = QB.filter(q => q.image);
    const missing = withImg.filter(q => !fs.existsSync(path.join(APP, q.image)));
    ok('every referenced image exists on disk', missing.length === 0,
        missing.map(q => `${q.id} → ${q.image}`).join('\n      '));
}

section('The Quantitative pool can actually support a homework set');
{
    // This is the check that would have caught it. A skill you teach must have enough
    // questions at each difficulty to build a set from; 3 in a bank this size is a
    // symptom, not a fact of life.
    const quant = QB.filter(q => q.skill === QUANT);
    const by = d => quant.filter(q => q.difficulty === d).length;
    console.log(`      Quantitative: ${quant.length} total · Easy ${by('Easy')} · Medium ${by('Medium')} · Hard ${by('Hard')}`);
    ok('Quantitative has a workable pool at every difficulty',
        by('Easy') >= 4 && by('Medium') >= 4 && by('Hard') >= 4,
        'too thin to draw a homework section from — check the classifier in parse_new_banks.py');
}

console.log('\n' + '─'.repeat(64));
if (fail) { console.log(`${fail} FAILED:\n  · ` + fails.join('\n  · ')); process.exit(1); }
console.log(`ALL ${pass} ASSERTIONS PASSED`);
