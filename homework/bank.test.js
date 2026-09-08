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
const BANKS = ['data-craft-structure.js', 'data-craft-structure-ext.js',
    'data-expression-of-ideas.js', 'data-expression-of-ideas-ext.js',
    'data-info-ideas.js', 'data-info-ideas-ext.js',
    'data-conventions.js', 'data-conventions-ext.js'];
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

section('Merge metadata and content identity are sound');
{
    const clean = value => String(value || '').normalize('NFKD').toLowerCase()
        .replace(/[^a-z0-9]/g, '');
    // Image-only questions legitimately share boilerplate stems; include the
    // image's alt text (or its path as a last resort) in the drawable-content key.
    const contentKey = q => clean(q.passage || q.alt || q.image) + clean(q.question);
    const seenContent = new Map();
    const duplicateContent = [];
    for (const q of QB) {
        const key = contentKey(q);
        if (seenContent.has(key)) duplicateContent.push([seenContent.get(key), q.id]);
        else seenContent.set(key, q.id);
    }
    ok('every question has merge provenance', QB.every(q =>
        ['cb-psat89', 'cb-sat', 'book-ugsg'].includes(q.origin) &&
        [undefined, 'official', 'provisional'].includes(q.difficultyStatus) &&
        ['native', 'mapped-from-sat'].includes(q.psatDifficultyFrom)));
    ok('every question has a drawable PSAT difficulty', QB.every(q =>
        ['Easy', 'Medium', 'Hard'].includes(q.psatDifficulty)));
    ok('no normalized drawable passage + stem appears twice', duplicateContent.length === 0,
        duplicateContent.slice(0, 8).map(pair => pair.join(' / ')).join(', '));

    const canonicalIds = new Set(QB.map(q => q.id));
    const aliases = QB.flatMap(q => (q.altIds || []).map(id => [id, q.id]));
    ok('retired ids are aliases, never competing drawable ids', aliases.every(([id, canonical]) =>
        id !== canonical && !canonicalIds.has(id)));
}

section('Underline references have one coherent target');
{
    const broken = QB.filter(q => {
        const passage = String(q.passage || '');
        const question = String(q.question || '');
        if (!/underlin/i.test(question) && !/<u>/i.test(passage)) return false;
        const opens = (passage.match(/<u>/gi) || []).length;
        const closes = (passage.match(/<\/u>/gi) || []).length;
        const singular = /underlined\s+(?:sentence|claim|portion|phrase|line)\b/i.test(question);
        return (!q.image && opens === 0) || opens !== closes || opens > 3 ||
            (singular && opens > 1) || /<u>[\s\S]*<u>/i.test(passage);
    });
    ok('no underline target is missing, scattered, nested, or unbalanced', broken.length === 0,
        broken.map(q => q.id).join(', '));
}

// ── The id is the spine of everything ────────────────────────────────────────
// `id` is not a label. It is the only thing joining a question to the student:
// the mastery ledger, the review ladder, the retention counter and the saved
// per-question record are ALL keyed by it, and the runner's section builder
// de-duplicates on it.
//
// So a question with no id, or an id shared with another question, does not fail.
// It does something much worse — it does the wrong thing quietly:
//
//   • `_used[q.id]` in homework-run.html. The first id-less question sets
//     `_used[undefined] = true`, and every OTHER id-less question is then filtered
//     out of every later section. A `sections` day silently serves short.
//   • `recordAnswer(undefined, …)` writes `ledger[undefined]`, so every id-less
//     question in the bank shares ONE record. Answer one correctly twice and the
//     lot of them are "mastered" — including ones the student has never seen.
//   • `dueForReview` skips on `skip[q.id]`, so once one is in the set they are all
//     excluded from review. They are never brought back.
//   • Two questions sharing an id share a ladder rung and a retention tally. The
//     student is credited with remembering something they were never asked.
//
// The parser reads ids from the source PDFs (`ID:` lines), so this holds today by
// luck of the export rather than by construction. If a rebuild ever drops or
// reuses one, this is the only thing that will say so.
section('Every question has its own id');
{
    const missing = QB.filter(q => !q.id);
    ok('every question has an id', missing.length === 0,
        `${missing.length} without one, e.g. [${(missing[0] || {}).skill}] "${((missing[0] || {}).question || '').slice(0, 60)}…"`);

    const seen = new Map();
    const dupes = [];
    for (const q of QB) {
        if (!q.id) continue;
        if (seen.has(q.id)) dupes.push(q.id); else seen.set(q.id, q);
    }
    ok('no two questions share an id', dupes.length === 0,
        `${dupes.length} duplicated: ${[...new Set(dupes)].slice(0, 5).join(', ')}`);

    // Ids travel into localStorage keys and a Google Sheet column. Something
    // unstringifyable here is a rebuild that changed shape, not a new question.
    const odd = QB.filter(q => q.id && typeof q.id !== 'string');
    ok('every id is a string', odd.length === 0,
        `${odd.length} non-string, e.g. ${JSON.stringify((odd[0] || {}).id)}`);
}

section('Extension questions are safe to merge');
{
    const incoming = QB.filter(q => q.difficultyStatus === 'provisional');
    const base = QB.filter(q => q.difficultyStatus !== 'provisional');
    const normalise = value => String(value || '').toLowerCase()
        .replace(/[“”]/g, '"').replace(/[’]/g, "'").replace(/[–—]/g, '-')
        .replace(/[^a-z0-9]+/g, ' ').trim();
    const grams = value => {
        const text = normalise(value);
        const result = new Set();
        for (let i = 0; i <= text.length - 4; i++) result.add(text.slice(i, i + 4));
        return result;
    };
    const dice = (left, right) => {
        if (!left.size || !right.size) return 0;
        let overlap = 0;
        for (const gram of left) if (right.has(gram)) overlap++;
        return 2 * overlap / (left.size + right.size);
    };
    const content = q => [q.passage, q.question]
        .concat((q.options || []).map(option => option.replace(/^[A-D]\.\s*/, ''))).join(' ');

    ok('each extension loads immediately after its base',
        ['craft-structure', 'expression-of-ideas', 'info-ideas', 'conventions'].every(name =>
            BANKS.indexOf(`data-${name}-ext.js`) === BANKS.indexOf(`data-${name}.js`) + 1));
    ok('the extension bank is present', incoming.length > 0, `${incoming.length} provisional questions`);
    ok('every extension question has complete provenance', incoming.every(q => q.source && q.source.book &&
        q.source.ref && Number.isInteger(q.source.questionPage) && Number.isInteger(q.source.keyPage)));
    const sourceRefs = incoming.map(q => q.source.ref);
    ok('every extension source reference is unique', new Set(sourceRefs).size === sourceRefs.length);
    ok('every extension question has a complete four-choice record', incoming.every(q =>
        q.passage && q.question && q.explanation && q.strategy && q.options && q.options.length === 4 && /^[A-D]$/.test(q.answer)));
    ok('every extension conventions question has a ruleType', incoming.every(q =>
        !['Boundaries', 'Form, Structure, and Sense'].includes(q.skill) || !!q.ruleType));
    const answerOnly = incoming.filter(q => /^The answer is [A-D],/.test(q.explanation));
    ok('no extension question gives answer-only feedback', answerOnly.length === 0,
        answerOnly.map(q => q.id).join(', '));

    const baseGrams = base.map(q => [q, grams(content(q))]);
    const repeatedBase = [];
    for (const question of incoming) {
        const candidate = grams(content(question));
        for (const [prior, priorGrams] of baseGrams) {
            const score = dice(candidate, priorGrams);
            if (score >= 0.95) { repeatedBase.push([question.id, prior.id, score]); break; }
        }
    }
    ok('no extension question duplicates the base bank', repeatedBase.length === 0,
        repeatedBase.slice(0, 5).map(([id, prior, score]) => `${id} / ${prior} (${score.toFixed(3)})`).join('\n      '));

    const passageGrams = incoming.map(q => [q, grams(q.passage)]);
    const repeatedIncoming = [];
    for (let i = 0; i < passageGrams.length; i++) {
        for (let j = 0; j < i; j++) {
            const score = dice(passageGrams[i][1], passageGrams[j][1]);
            if (score >= 0.95) repeatedIncoming.push([passageGrams[i][0].id, passageGrams[j][0].id, score]);
        }
    }
    ok('no two extension questions repeat the same passage', repeatedIncoming.length === 0,
        repeatedIncoming.slice(0, 5).map(([id, prior, score]) => `${id} / ${prior} (${score.toFixed(3)})`).join('\n      '));

    const letters = incoming.reduce((counts, q) => {
        counts[q.answer] = (counts[q.answer] || 0) + 1;
        return counts;
    }, {});
    const largestShare = Math.max(...Object.values(letters)) / incoming.length;
    ok('extension answer positions are plausibly distributed',
        'ABCD'.split('').every(letter => letters[letter]) && largestShare <= 0.40,
        JSON.stringify(letters));
}

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
