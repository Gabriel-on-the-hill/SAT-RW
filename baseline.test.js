// baseline.test.js — run: node baseline.test.js
//
// Verifies the screener against the REAL bank, not a fixture. A fixture would
// have hidden the finding that shaped the whole build here: Command of Evidence
// — Quantitative holds five Medium items, so this app runs TWO parallel forms
// where the sister PSAT app runs three. A fixture with a tidy ten-per-skill
// would have let a three-form design ship and fail on one skill, silently, on
// the first retake.
//
// Needs no jsdom. Everything here is pure functions over the bank.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ── load the bank the way the browser does ────────────────────────
const ctx = { console, module: undefined, exports: undefined };
vm.createContext(ctx);
['data-craft-structure.js', 'data-expression-of-ideas.js',
 'data-info-ideas.js', 'data-conventions.js'].forEach(f => {
    vm.runInContext(fs.readFileSync(path.join(__dirname, f), 'utf8'), ctx);
});
vm.runInContext(`
    var questionBank = [].concat(
        typeof questionBank_CS  !== 'undefined' ? questionBank_CS  : [],
        typeof questionBank_EOI !== 'undefined' ? questionBank_EOI : [],
        typeof questionBank_II  !== 'undefined' ? questionBank_II  : [],
        typeof questionBank_CON !== 'undefined' ? questionBank_CON : []
    );
`, ctx);

// spec + grade share the browser globals, so run them in the same context.
// `const` at script top level does NOT attach to the context object the way a
// function declaration does, so the constants are re-exported explicitly.
vm.runInContext(fs.readFileSync(path.join(__dirname, 'baseline-spec.js'), 'utf8')
    .replace(/if \(typeof module[\s\S]*$/, ''), ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'baseline-grade.js'), 'utf8')
    .replace(/if \(typeof module[\s\S]*$/, ''), ctx);
vm.runInContext(`
    globalThis.BASELINE_SKILLS      = BASELINE_SKILLS;
    globalThis.BASELINE_FORMS       = BASELINE_FORMS;
    globalThis.BASELINE_ITEMS_PER_SKILL  = BASELINE_ITEMS_PER_SKILL;
    globalThis.BASELINE_SECONDS_PER_ITEM = BASELINE_SECONDS_PER_ITEM;
    globalThis.BASELINE_BANDS       = BASELINE_BANDS;
    globalThis.BLUEPRINT_WEIGHT     = BLUEPRINT_WEIGHT;
    globalThis.BASELINE_SECONDS     = BASELINE_SECONDS;
    globalThis.RW_DOMAIN_ORDER      = RW_DOMAIN_ORDER;
    globalThis.SKILL_DOMAIN         = SKILL_DOMAIN;
    globalThis.BASELINE_SCALE_LOW   = BASELINE_SCALE_LOW;
    globalThis.BASELINE_SCALE_HIGH  = BASELINE_SCALE_HIGH;
`, ctx);

const bank = ctx.questionBank;

let pass = 0, fail = 0;
function t(name, fn) {
    try { fn(); console.log('  ok   ' + name); pass++; }
    catch (e) { console.log('  FAIL ' + name + '\n       ' + e.message); fail++; }
}
function eq(a, b, m) {
    if (JSON.stringify(a) !== JSON.stringify(b))
        throw new Error((m || '') + ' expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a));
}
function ok(c, m) { if (!c) throw new Error(m || 'expected truthy'); }

const N_ITEMS = ctx.BASELINE_SKILLS.length * ctx.BASELINE_ITEMS_PER_SKILL;

console.log('\nBANK\n----');
console.log('  items: ' + bank.length);

console.log('\nPREFLIGHT\n---------');
const pre = ctx.baselinePreflight(bank);
pre.errors.forEach(e => console.log('  ERROR   ' + e));
pre.warnings.forEach(w => console.log('  warn    ' + w));
t('preflight passes with zero errors', () => ok(pre.ok, pre.errors.join(' | ')));

// The constraint that set the form count. If this ever stops being true the
// warning in preflight will say so, and the constant should be revisited — but
// it must be a decision, not a drift.
t('the bank genuinely cannot supply a third form', () => {
    const need = 3 * ctx.BASELINE_ITEMS_PER_SKILL;
    const thin = ctx.BASELINE_SKILLS.filter(s =>
        bank.filter(q => q.skill === s && q.difficulty === 'Medium').length < need);
    ok(thin.length > 0,
       'the bank now supports three forms — revisit BASELINE_FORMS, do not leave it at two by inertia');
    ok(thin.includes('Command of Evidence — Quantitative'),
       'the thin skill is no longer the one the header explains: ' + thin.join(', '));
});

// Quantitative was once THREE Medium in a 719-question bank, because the parser
// inferred the evidence type by counting digits and a chart contributes none.
// AGENTS.md: "If a skill's pool ever looks implausibly thin, that is a build
// bug, not a fact about the test." This is the tripwire for the next rebuild.
t('Quantitative is still classified by stem, not by digit count', () => {
    const quant = bank.filter(q => q.skill === 'Command of Evidence — Quantitative');
    const textual = bank.filter(q => q.skill === 'Command of Evidence — Textual');
    ok(quant.length >= 20, 'Quantitative has collapsed to ' + quant.length + ' items');
    ok(quant.filter(q => q.image).length >= 20,
       'only ' + quant.filter(q => q.image).length + ' Quantitative items carry a figure');
    eq(textual.filter(q => q.image).length, 0,
       'a chart-bearing question is filed Textual, which is the old digit-count bug:');
});

console.log('\nFORM CONSTRUCTION\n-----------------');
const forms = ctx.BASELINE_FORMS.map(f => ctx.buildBaselineForm(bank, f));

t('every form has exactly ' + N_ITEMS + ' items', () => {
    forms.forEach(f => eq(f.questions.length, N_ITEMS, 'form ' + f.form + ':'));
});

t('every form covers all 11 skills, 2 each', () => {
    forms.forEach(f => {
        ctx.BASELINE_SKILLS.forEach(s => {
            const n = f.questions.filter(q => q.skill === s).length;
            eq(n, ctx.BASELINE_ITEMS_PER_SKILL, 'form ' + f.form + ' / ' + s + ':');
        });
    });
});

t('every screener item is Medium', () => {
    forms.forEach(f => f.questions.forEach(q => eq(q.difficulty, 'Medium', q.id)));
});

t('no item id is reused across forms', () => {
    const seen = new Map();
    forms.forEach(f => f.questions.forEach(q => {
        ok(!seen.has(q.id), q.id + ' in both ' + seen.get(q.id) + ' and ' + f.form);
        seen.set(q.id, f.form);
    }));
});

t('no shortfalls reported on any form', () => {
    forms.forEach(f => eq(f.shortfalls, [], 'form ' + f.form + ':'));
});

t('form build is deterministic across calls', () => {
    const a = ctx.buildBaselineForm(bank, 'A').questions.map(q => q.id);
    const b = ctx.buildBaselineForm(bank, 'A').questions.map(q => q.id);
    eq(a, b, 'form A drifted between builds:');
});

t('an unknown form letter throws rather than serving something', () => {
    let threw = false;
    try { ctx.buildBaselineForm(bank, 'Z'); } catch (e) { threw = true; }
    ok(threw, 'form Z was accepted');
});

console.log('\nORDER\n-----');

// Our domain order is NOT the sister app's. It carries C&S → I&I → EoI → SEC;
// AGENTS.md here says the real module runs Craft & Structure → Information &
// Ideas → Standard English Conventions → Expression of Ideas, and app.js's
// RW_DOMAIN_ORDER is the single source of truth for it. A screener ordered the
// other way drills a sequence the student never meets on test day.
t('the domain order matches app.js, not the sister app', () => {
    eq(ctx.RW_DOMAIN_ORDER, ['Craft & Structure', 'Information & Ideas',
                             'Std. English Conv.', 'Expression of Ideas']);
    const app = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
    const m = app.match(/const RW_DOMAIN_ORDER = \[([\s\S]*?)\]/);
    ok(m, 'app.js no longer declares RW_DOMAIN_ORDER — the two can now drift');
    const fromApp = m[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, ''))
                        .filter(Boolean);
    eq(fromApp, ctx.RW_DOMAIN_ORDER, 'baseline-spec.js and app.js disagree:');
});

t('items are built in real domain order', () => {
    forms.forEach(f => {
        const seq = f.questions.map(q => ctx.RW_DOMAIN_ORDER.indexOf(ctx.SKILL_DOMAIN[q.skill]));
        seq.forEach((v, i) => ok(i === 0 || seq[i - 1] <= v,
            'form ' + f.form + ' domain order broken at index ' + i));
    });
});

// ── the four below are about the order actually SERVED ────────────
// The page does not serve buildBaselineForm's output; it serves
// spreadBaseline(built.questions). In the sister app the spread quietly undid
// the domain blocking the build had just done — it round-robined all eleven
// skill lanes across the whole set, so the student met C&S, I&I, EoI, SEC and
// then all four again: two identical sweeps, item n always the same skill as
// item n+11. Its unit test asserted on the built array, which the page never
// serves, and its e2e test only checked non-adjacency. Nothing failed for
// months. Test the array that reaches the student.
t('the SERVED order keeps the domain blocks', () => {
    forms.forEach(f => {
        const served = ctx.spreadBaseline(f.questions);
        const seq = served.map(q => ctx.RW_DOMAIN_ORDER.indexOf(ctx.SKILL_DOMAIN[q.skill]));
        seq.forEach((v, i) => ok(i === 0 || seq[i - 1] <= v,
            'form ' + f.form + ' leaves and re-enters a domain at index ' + i
            + ' (' + served.map(q => ctx.SKILL_DOMAIN[q.skill][0]).join('') + ')'));
    });
});

t('the SERVED order never puts a skill next to itself', () => {
    forms.forEach(f => {
        const served = ctx.spreadBaseline(f.questions).map(q => q.skill);
        served.forEach((s, i) => ok(i === 0 || served[i - 1] !== s,
            'form ' + f.form + ' repeats ' + s + ' at index ' + i));
    });
});

t('the SERVED order is not one repeating cycle of every skill', () => {
    forms.forEach(f => {
        const served = ctx.spreadBaseline(f.questions).map(q => q.skill);
        const period = ctx.BASELINE_SKILLS.length;
        const cyclic = served.every((s, i) =>
            i + period >= served.length || served[i + period] === s);
        ok(!cyclic, 'form ' + f.form + ' repeats the whole skill sequence every '
            + period + ' items');
    });
});

t('every item survives the spread', () => {
    forms.forEach(f => {
        const served = ctx.spreadBaseline(f.questions);
        eq(served.length, f.questions.length, 'form ' + f.form + ' lost items:');
        eq(served.map(q => q.id).sort(), f.questions.map(q => q.id).sort(),
            'form ' + f.form + ' changed which items it serves:');
    });
});

console.log('\nPACING\n------');
t('the clock is the real section pace, not the sister app\'s', () => {
    eq(ctx.BASELINE_SECONDS_PER_ITEM, 71, 'SAT R&W runs ~71 s/question:');
    eq(ctx.BASELINE_SECONDS, N_ITEMS * 71);
    ok(ctx.BASELINE_SECONDS > 1500 && ctx.BASELINE_SECONDS < 1600,
       'the sitting is ' + Math.round(ctx.BASELINE_SECONDS / 60) + ' minutes');
});

console.log('\nROUTING\n-------');
t('2/2 routes to a Hard ceiling probe', () => {
    eq(ctx.routeSkill(2), { provisional: 'Proficient', probe: 'Hard' });
});
t('1/2 spends no probe', () => {
    eq(ctx.routeSkill(1), { provisional: 'Developing', probe: null });
});
t('0/2 routes to an Easy floor probe', () => {
    eq(ctx.routeSkill(0), { provisional: 'Priority', probe: 'Easy' });
});

console.log('\nBANDING — all routing paths\n---------------------------');
const paths = [
    [2, 'Hard', true,  'Secure'],
    [2, 'Hard', false, 'Proficient'],
    [1, null,   null,  'Developing'],
    [0, 'Easy', true,  'Priority'],
    [0, 'Easy', false, 'Foundational'],
];
paths.forEach(([c, tier, res, want]) => {
    t(`${c}/2 + ${tier || 'no'} probe ${tier ? (res ? 'passed' : 'failed') : ''} -> ${want}`, () => {
        eq(ctx.finalBand(c, tier, res), want);
    });
});

t('unprobed 2/2 stays Proficient, never Secure', () => {
    eq(ctx.finalBand(2, null, null), 'Proficient');
});
t('unprobed 0/2 stays Priority, never Foundational', () => {
    eq(ctx.finalBand(0, null, null), 'Priority');
});

console.log('\nTIMING OVERLAY\n--------------');
t('sub-8s counts as a non-attempt', () =>
    eq(ctx.classifyTiming({ correct: false, seconds: 4 }), 'non-attempt'));
t('wrong under 15s is rushed', () =>
    eq(ctx.classifyTiming({ correct: false, seconds: 12 }), 'rushed'));
t('wrong over 150s is laboured', () =>
    eq(ctx.classifyTiming({ correct: false, seconds: 190 }), 'laboured'));
t('normal wrong answer carries no flag', () =>
    eq(ctx.classifyTiming({ correct: false, seconds: 60 }), null));
t('missing timing degrades to null, never throws', () =>
    eq(ctx.classifyTiming({ correct: true }), null));

console.log('\nPROFILE\n-------');
const formA = forms[0].questions;
const mkItems = (fn) => formA.map((q, i) => ({
    id: q.id, skill: q.skill, difficulty: q.difficulty,
    stage: 1, chosen: 'A', ...fn(q, i),
}));

t('a perfect screener routes every skill to a Hard probe', () => {
    const prof = ctx.buildBaselineProfile(mkItems(() => ({ correct: true, seconds: 55 })));
    eq(Object.keys(prof).length, 11);
    Object.values(prof).forEach(s => {
        eq(s.routedProbe, 'Hard', s.skill + ':');
        eq(s.band, 'Proficient', s.skill + ':');
        eq(s.confidence, 'provisional', s.skill + ':');
    });
});

t('a blank screener routes every skill to an Easy probe', () => {
    const prof = ctx.buildBaselineProfile(mkItems(() => ({ correct: false, seconds: 55 })));
    Object.values(prof).forEach(s => eq(s.routedProbe, 'Easy', s.skill + ':'));
});

// The sister app labels this state `confirmed`, and a tutor reading that word
// beside a two-item result will over-trust it. 1/2 is the LEAST informative
// outcome and it is exactly the one that routes no probe, so it must not carry
// the same word as a probe-resolved band.
t('a 1/2 skill is "resolved", never "confirmed"', () => {
    let flip = 0;
    const prof = ctx.buildBaselineProfile(mkItems(() => ({ correct: (flip++ % 2 === 0), seconds: 55 })));
    Object.values(prof).forEach(s => {
        eq(s.band, 'Developing', s.skill + ':');
        eq(s.confidence, 'resolved', s.skill + ':');
        ok(s.confidence !== 'confirmed', s.skill + ' claims a two-item reading is confirmed');
    });
});

t('a skill answered in 3s is reported as not-measured, not Foundational', () => {
    const prof = ctx.buildBaselineProfile(mkItems((q) =>
        q.skill === 'Inferences'
            ? { correct: false, seconds: 3 }
            : { correct: true, seconds: 55 }));
    eq(prof['Inferences'].band, null);
    eq(prof['Inferences'].confidence, 'not-measured');
    ok(/Re-test/.test(prof['Inferences'].note || ''));
});

t('one non-attempt out of two lowers confidence but keeps a band', () => {
    let n = 0;
    const prof = ctx.buildBaselineProfile(mkItems((q) => {
        if (q.skill !== 'Transitions') return { correct: true, seconds: 55 };
        return (n++ === 0) ? { correct: false, seconds: 3 } : { correct: true, seconds: 55 };
    }));
    eq(prof['Transitions'].confidence, 'low');
    ok(prof['Transitions'].band, 'a half-attempted skill lost its band entirely');
});

t('probe results promote and demote correctly', () => {
    const base = mkItems(() => ({ correct: true, seconds: 55 }));
    const probes = [
        { id: 'p1', skill: 'Transitions', difficulty: 'Hard',
          stage: 2, probeTier: 'Hard', correct: true,  seconds: 70 },
        { id: 'p2', skill: 'Boundaries',  difficulty: 'Hard',
          stage: 2, probeTier: 'Hard', correct: false, seconds: 70 },
    ];
    const prof = ctx.buildBaselineProfile(base.concat(probes));
    eq(prof['Transitions'].band, 'Secure');
    eq(prof['Transitions'].confidence, 'probed');
    eq(prof['Boundaries'].band, 'Proficient');
    eq(prof['Boundaries'].confidence, 'probed');
});

console.log('\nPROBE SET\n---------');
t('a probe exists for every routed skill, in the right tier', () => {
    const prof = ctx.buildBaselineProfile(mkItems(() => ({ correct: false, seconds: 55 })));
    const { probes, gaps } = ctx.buildProbeSet(bank, prof, formA.map(q => q.id), 'A');
    eq(gaps, [], 'unfillable probe slots:');
    eq(probes.length, 11);
    probes.forEach(p => eq(p.difficulty, 'Easy', p.skill + ':'));
});

t('ceiling probes are all available too', () => {
    const prof = ctx.buildBaselineProfile(mkItems(() => ({ correct: true, seconds: 55 })));
    const { probes, gaps } = ctx.buildProbeSet(bank, prof, formA.map(q => q.id), 'A');
    eq(gaps, []);
    eq(probes.length, 11);
    probes.forEach(p => eq(p.difficulty, 'Hard', p.skill + ':'));
});

t('probes never reuse a screener item', () => {
    const prof = ctx.buildBaselineProfile(mkItems(() => ({ correct: false, seconds: 55 })));
    const used = formA.map(q => q.id);
    const { probes } = ctx.buildProbeSet(bank, prof, used, 'A');
    probes.forEach(p => ok(!used.includes(p.id), p.id + ' reused from screener'));
});

t('a half-right screener spends no probes at all', () => {
    let flip = 0;
    const prof = ctx.buildBaselineProfile(mkItems(() => ({ correct: (flip++ % 2 === 0), seconds: 55 })));
    const { probes } = ctx.buildProbeSet(bank, prof, formA.map(q => q.id), 'A');
    eq(probes.length, 0, 'Developing skills should not consume probe items:');
});

// The sister app takes pool[0], so every student gets the identical Hard item
// for a skill on every sitting — which the forms go to real trouble to avoid,
// and then the probe hands straight back.
t('probes are seeded, not just the first match in bank order', () => {
    const prof = ctx.buildBaselineProfile(mkItems(() => ({ correct: true, seconds: 55 })));
    const used = formA.map(q => q.id);
    const a = ctx.buildProbeSet(bank, prof, used, 'A').probes.map(p => p.id);
    const b = ctx.buildProbeSet(bank, prof, used, 'B').probes.map(p => p.id);
    ok(a.some((id, i) => id !== b[i]),
       'form A and form B probe with an identical set — the seed is not being used');
});

t('probing is deterministic for a given form', () => {
    const prof = ctx.buildBaselineProfile(mkItems(() => ({ correct: true, seconds: 55 })));
    const used = formA.map(q => q.id);
    eq(ctx.buildProbeSet(bank, prof, used, 'A').probes.map(p => p.id),
       ctx.buildProbeSet(bank, prof, used, 'A').probes.map(p => p.id),
       'the probe set drifted between identical calls:');
});

console.log('\nPROJECTION\n----------');
const projItems = (rate) => formA.map((q, i) => ({
    skill: q.skill, stage: 1, chosen: 'A',
    correct: (i / formA.length) < rate, seconds: 60,
}));

t('projection is monotonic in accuracy', () => {
    let prev = -1;
    [0, 0.25, 0.5, 0.75, 1].forEach(rate => {
        const p = ctx.projectBaseline(projItems(rate));
        ok(p.low >= prev, 'projection fell as accuracy rose: ' + p.low + ' after ' + prev);
        prev = p.low;
    });
});

// The SAT R&W section score is 200–800. The sister app projects 120–720, which
// is the PSAT 8/9 scale — copying its constants would have produced a report
// that looks right and reads a full grade low.
t('projection stays inside the SAT section scale, not the PSAT one', () => {
    eq(ctx.BASELINE_SCALE_LOW, 200);
    eq(ctx.BASELINE_SCALE_HIGH, 800);
    [0, 0.5, 1].forEach(rate => {
        const p = ctx.projectBaseline(projItems(rate));
        ok(p.low >= 200 && p.high <= 800, 'out of scale: ' + p.low + '-' + p.high);
        ok(p.low % 10 === 0 && p.high % 10 === 0, 'not on the 10-point grid');
    });
});

t('a perfect screener does not project the top of the scale', () => {
    // All-Medium: clearing it reliably is not evidence of an 800, because the
    // real section carries Hard items the screener never showed.
    const p = ctx.projectBaseline(projItems(1));
    ok(p.high < 800, 'a Medium-only screener projected ' + p.high);
});

t('it is always a range, never a point', () => {
    [0, 0.5, 1].forEach(rate => {
        const p = ctx.projectBaseline(projItems(rate));
        ok(p.high > p.low, 'collapsed to a point at rate ' + rate);
    });
});

t('projection re-weights domains rather than using raw totals', () => {
    // Information & Ideas owns 8 of 22 items (36%) against a real ~26%. A
    // student who misses only I&I must not be punished for the instrument's
    // shape, so the re-weighted figure has to beat the raw one.
    const items = formA.map(q => ({
        skill: q.skill, stage: 1, chosen: 'A', seconds: 60,
        correct: ctx.SKILL_DOMAIN[q.skill] !== 'Information & Ideas',
    }));
    const p = ctx.projectBaseline(items);
    const raw = Math.round(items.filter(i => i.correct).length / items.length * 100);
    ok(p.accuracy > raw, 're-weighting did not help: ' + p.accuracy + '% vs raw ' + raw + '%');
});

// A blank and a wrong answer score the same, which is what the real test does —
// but only one of them is a knowledge problem, and the projection cannot tell
// them apart. It has to say so rather than quietly reading low.
t('blanks are counted and disclosed in the caveat', () => {
    const items = formA.map((q, i) => ({
        skill: q.skill, stage: 1, seconds: 60,
        chosen: i < 4 ? null : 'A', correct: false,
    }));
    const p = ctx.projectBaseline(items);
    eq(p.blanks, 4);
    ok(/blank/i.test(p.caveat), 'the caveat never mentions the blanks: ' + p.caveat);
});

t('a fully answered sitting carries no blank caveat', () => {
    const p = ctx.projectBaseline(projItems(0.5));
    eq(p.blanks, 0);
    ok(!/blank/i.test(p.caveat));
});

console.log('\nSKILL WEIGHTS\n-------------');
t('skill weight beats bare domain weight for within-domain frequency', () => {
    const w = ctx.skillWeights(bank);
    // Same domain: the common skill must outweigh the rare one.
    ok(w['Words in Context'] > w['Cross-Text Connections'],
       'Words in Context ' + w['Words in Context'] + ' vs Cross-Text ' + w['Cross-Text Connections']);
    // Across domains: Rhetorical Synthesis is frequent inside a 20% domain and
    // must outrank Cross-Text Connections, which is rare inside a 28% one.
    ok(w['Rhetorical Synthesis'] > w['Cross-Text Connections'],
       'bare domain weight is still winning');
});

t('skill weights sum to ~1.0 across the four domains', () => {
    const w = ctx.skillWeights(bank);
    const sum = Object.values(w).reduce((a, b) => a + b, 0);
    ok(Math.abs(sum - 1) < 0.01, 'weights sum to ' + sum.toFixed(3));
});

// The sister app keys this cache on bank.length alone. Two different banks of
// equal size are common in tests — a fixture and the real bank matching by
// accident is exactly the case — and the second caller silently gets the first
// one's weights.
t('the weight cache does not confuse two banks of the same length', () => {
    const real = ctx.skillWeights(bank);
    const skewed = bank.slice(0, bank.length - 1).concat([{
        id: '__probe__', skill: 'Cross-Text Connections', difficulty: 'Medium',
    }]);
    const other = ctx.skillWeights(skewed);
    ok(JSON.stringify(real) !== JSON.stringify(other) || bank.length === 0,
       'a different bank of the same length returned the cached weights');
    // and the real bank still returns its own answer afterwards
    eq(ctx.skillWeights(bank), real, 'the cache corrupted the real weights:');
});

console.log('\nFOCUS QUEUE\n-----------');
const weakProfile = () => ctx.buildBaselineProfile(mkItems((q) => {
    if (q.skill === 'Cross-Text Connections') return { correct: false, seconds: 55 };
    if (q.skill === 'Boundaries')             return { correct: false, seconds: 55 };
    return { correct: true, seconds: 55 };
}));

t('queue ranks by severity x skill weight', () => {
    const q = ctx.baselineFocusQueue(weakProfile(), null, bank);
    ok(q.length >= 2);
    for (let i = 1; i < q.length; i++) {
        ok(q[i - 1].priorityScore >= q[i].priorityScore, 'queue is not sorted');
    }
});

t('a heavy skill outranks a light one at the same band', () => {
    const q = ctx.baselineFocusQueue(weakProfile(), null, bank);
    const b = q.findIndex(x => x.skill === 'Boundaries');
    const c = q.findIndex(x => x.skill === 'Cross-Text Connections');
    ok(b > -1 && c > -1, 'both weak skills should be queued');
    ok(b < c, 'Boundaries (13.2%) should outrank Cross-Text (6.5%) at the same band');
});

t('Secure and Proficient skills stay out of the queue', () => {
    const q = ctx.baselineFocusQueue(weakProfile(), null, bank);
    q.forEach(x => ok(ctx.BASELINE_BANDS[x.band].rank <= 3,
        x.skill + ' is ' + x.band + ' and should not be in the plan'));
});

t('not-measured skills never enter the queue', () => {
    const prof = ctx.buildBaselineProfile(mkItems((q) =>
        q.skill === 'Inferences' ? { correct: false, seconds: 2 }
                                 : { correct: true, seconds: 55 }));
    const q = ctx.baselineFocusQueue(prof, null, bank);
    ok(!q.some(x => x.skill === 'Inferences'),
       'a skill that was never attempted is being planned around');
});

t('limit slices without reordering', () => {
    const full = ctx.baselineFocusQueue(weakProfile(), null, bank).map(x => x.skill);
    const two  = ctx.baselineFocusQueue(weakProfile(), 2, bank).map(x => x.skill);
    eq(two, full.slice(0, 2));
});

console.log('\n' + '='.repeat(46));
console.log(`${pass} passed, ${fail} failed`);
console.log('='.repeat(46) + '\n');
process.exit(fail ? 1 : 0);
