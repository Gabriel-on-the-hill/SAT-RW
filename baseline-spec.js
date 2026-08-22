// ══════════════════════════════════════════════════════════════════
// baseline-spec.js — form construction for the Baseline Screener
//
// WHY THIS FILE EXISTS
// A baseline has to measure every skill or the plan it produces is a guess
// about the skills it happened to sample. Coverage therefore has to be a
// build-time GUARANTEE, not the intention of whoever last edited a list. Every
// slot below has its skill pinned and its difficulty pinned; the stage-two
// router chooses difficulty and never chooses which skill, so coverage cannot
// drift no matter how a student performs.
//
// THE ANCHOR IS MEDIUM, AND THAT IS A DATA DECISION
// Our bank is 229 Easy / 224 Medium / 266 Hard across 719 questions. Medium is
// the modal difficulty of the real section, so it discriminates best on a
// student nobody has measured yet, and a FIXED anchor tier is what keeps the
// measurement base uniform: everybody answers the same two Medium items per
// skill, so a band means the same thing for every student. Easy and Hard are
// spent in stage two as floor and ceiling probes, only where the screener
// leaves the answer genuinely open (see baseline-grade.js).
//
// TWO FORMS, NOT THREE — AND THAT IS THE BANK TALKING
// The sister PSAT 8/9 app runs three parallel forms. We cannot, and the reason
// is one cell. Medium counts per skill here:
//
//     Words in Context 35 · Text Structure 33 · Rhetorical Synthesis 31
//     Boundaries 21 · Cross-Text 21 · Form/Structure/Sense 19 · CoE-Textual 17
//     Central Ideas 15 · Transitions 14 · Inferences 13
//     Command of Evidence — Quantitative ...................  5
//
// Three forms at two per skill needs six. Quantitative has five, and that is
// the real count, not a classification miss: only one Textual stem reads
// quantitative and it genuinely is one ("which quotation from a survey
// respondent…"), and all 28 chart-bearing items are already filed Quantitative.
// AGENTS.md records why that pool is worth re-checking before believing it —
// it was once THREE Medium in a 719-question bank, because the parser inferred
// the evidence type by counting digits and a bar graph contributes none.
//
// So: two forms. Not three with an exception for one skill, because an
// exception means Quantitative alone would repeat between sittings and the
// retake comparison on that skill would silently be measuring memory. Better a
// smaller honest number. baselinePreflight() is what will tell us the day the
// bank can support a third.
// ══════════════════════════════════════════════════════════════════

// baseline.html does not load app.js — 90 KB of session UI it has no use for —
// so these are defined here when they are not already present. Guarded, so
// app.js stays the single source of truth wherever both are loaded, and the two
// can never disagree about which domain a skill belongs to.
if (typeof SKILL_DOMAIN === 'undefined') {
    var SKILL_DOMAIN = {
        'Words in Context':                   'Craft & Structure',
        'Text Structure and Purpose':         'Craft & Structure',
        'Cross-Text Connections':             'Craft & Structure',
        'Rhetorical Synthesis':               'Expression of Ideas',
        'Transitions':                        'Expression of Ideas',
        'Central Ideas and Details':          'Information & Ideas',
        'Command of Evidence — Textual':      'Information & Ideas',
        'Command of Evidence — Quantitative': 'Information & Ideas',
        'Inferences':                         'Information & Ideas',
        'Boundaries':                         'Std. English Conv.',
        'Form, Structure, and Sense':         'Std. English Conv.',
    };
}

// The order the four domains appear in a real digital SAT R&W module.
//
// DO NOT copy this from the sister app. Its baseline carries its own list with
// the last two swapped, and AGENTS.md here is explicit that the real module
// runs Craft & Structure → Information & Ideas → Standard English Conventions →
// Expression of Ideas. A screener ordered the other way drills a sequence the
// student never meets on test day.
if (typeof RW_DOMAIN_ORDER === 'undefined') {
    var RW_DOMAIN_ORDER = [
        'Craft & Structure',
        'Information & Ideas',
        'Std. English Conv.',
        'Expression of Ideas',
    ];
}

const BASELINE_SKILLS = [
    'Words in Context',
    'Text Structure and Purpose',
    'Cross-Text Connections',
    'Central Ideas and Details',
    'Command of Evidence — Textual',
    'Command of Evidence — Quantitative',
    'Inferences',
    'Rhetorical Synthesis',
    'Transitions',
    'Boundaries',
    'Form, Structure, and Sense',
];

const BASELINE_ITEMS_PER_SKILL = 2;              // 11 skills × 2 = 22 items
const BASELINE_ANCHOR_TIER     = 'Medium';
const BASELINE_FORMS           = ['A', 'B'];     // see the header: the bank's limit, not a choice

// 22 items at the real section's pace. SAT R&W runs ~71 s/question, so a
// screener that is honest about time is ~26 minutes — longer than the sister
// app's 22, because the sister app is pacing a different test.
//
// This is the one number most likely to be argued about, so: the alternative is
// to keep the sitting near 20 minutes by cutting to eight or nine skills, and
// the skills that would go are the thin ones — which are exactly the ones we
// have the least idea about. A shorter screener that omits a skill does not
// measure it faster, it stops measuring it. If 26 minutes proves too long in
// practice the answer is to split it into two sittings, not to drop coverage.
const BASELINE_SECONDS_PER_ITEM = 71;
const BASELINE_SECONDS = BASELINE_SKILLS.length
                       * BASELINE_ITEMS_PER_SKILL
                       * BASELINE_SECONDS_PER_ITEM;   // 1562 s ≈ 26 min

// Blueprint weights for the real R&W section. The screener deliberately does
// NOT match these — uniform 2-per-skill coverage forces Information & Ideas to
// 8/22 (36% vs a real ~26%) because it owns four of the eleven skills, and
// pushes Std. English Conv. down to 4/22 (18%). That distortion is the price of
// measuring every skill in 22 items, and for a DIAGNOSTIC it is the right
// price: buildMockExam is what owes you blueprint fidelity.
//
// The projection corrects for it by scoring per domain and re-weighting, so a
// student is never rewarded or punished for the instrument's own shape.
const BLUEPRINT_WEIGHT = {
    'Craft & Structure':   0.28,
    'Information & Ideas': 0.26,
    'Std. English Conv.':  0.26,
    'Expression of Ideas': 0.20,
};

// ── deterministic RNG ─────────────────────────────────────────────
// Form A must be the same 22 questions for every student who sits Form A, or
// comparing two students' baselines is meaningless and comparing a retake to a
// first sitting is measuring the form rather than the student. mulberry32 keeps
// the selection reproducible from the form letter alone — no stored manifest to
// drift out of date, and a rebuilt bank changes the draw visibly rather than
// leaving a JSON file pointing at ids that no longer exist.
function _seedFrom(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
        h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
    }
    return h >>> 0;
}

function _mulberry32(a) {
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function _seededShuffle(arr, rand) {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

// ── the manifest ──────────────────────────────────────────────────
// 22 slots, skill pinned, tier pinned to Medium. That is the whole contract.
function baselineManifest() {
    const slots = [];
    BASELINE_SKILLS.forEach(skill => {
        for (let n = 0; n < BASELINE_ITEMS_PER_SKILL; n++) {
            slots.push({ skill, tier: BASELINE_ANCHOR_TIER, stage: 1 });
        }
    });
    return slots;
}

// ── form construction ─────────────────────────────────────────────
// Partition each skill's Medium pool across the forms so Form B never reuses a
// Form A item. A retake that re-serves the same questions measures memory.
function buildBaselineForm(bank, formId) {
    const idx = BASELINE_FORMS.indexOf(formId);
    if (idx === -1) throw new Error('baseline: unknown form "' + formId + '"');

    const out = [];
    const shortfalls = [];

    BASELINE_SKILLS.forEach(skill => {
        const pool = bank.filter(q =>
            q.skill === skill && q.difficulty === BASELINE_ANCHOR_TIER);
        // Shuffle once per skill with a skill-stable seed, THEN slice by form.
        // Seeding on the skill rather than the form is what makes the forms
        // disjoint slices of one ordering, instead of independent draws that
        // could collide — a collision would be invisible and would quietly turn
        // a retake into a memory test on whichever items happened to repeat.
        const ordered = _seededShuffle(pool, _mulberry32(_seedFrom('baseline::' + skill)));
        const start = idx * BASELINE_ITEMS_PER_SKILL;
        const take  = ordered.slice(start, start + BASELINE_ITEMS_PER_SKILL);

        if (take.length < BASELINE_ITEMS_PER_SKILL) {
            shortfalls.push({ skill, got: take.length, want: BASELINE_ITEMS_PER_SKILL });
        }
        take.forEach(q => out.push(q));
    });

    if (shortfalls.length) {
        // Loud, not silent. A thin pool must never be papered over by quietly
        // substituting another skill — that is exactly how coverage rots, and
        // the report would still claim to have measured the skill it dropped.
        console.error('baseline: form ' + formId + ' is under-supplied', shortfalls);
    }

    return { form: formId, questions: orderBaselineSAT(out), shortfalls };
}

function _domainOf(q) {
    return (typeof SKILL_DOMAIN !== 'undefined' && SKILL_DOMAIN[q.skill])
        || RW_DOMAIN_ORDER[0];
}

// Present in the real section's domain order. R&W is not shuffled: the section
// runs domain by domain, so a screener that interleaves randomly feels wrong to
// a student who has sat a real test and adds a task-switching cost that has
// nothing to do with the skills being measured.
function orderBaselineSAT(questions) {
    return questions.slice().sort((a, b) => {
        const da = RW_DOMAIN_ORDER.indexOf(_domainOf(a));
        const db = RW_DOMAIN_ORDER.indexOf(_domainOf(b));
        if (da !== db) return da - db;
        return a.skill === b.skill ? 0 : String(a.skill).localeCompare(String(b.skill));
    });
}

// Keep the two items of any one skill apart WITHOUT breaking the domain blocks
// orderBaselineSAT just built.
//
// The sister app treated these two goals as if they conflicted and round-robined
// all eleven skill lanes across the whole set. They do not conflict, and the
// cost of assuming they did was the worst of both: the served order became
// C&S, I&I, EoI, SEC and then the same four again — two identical sweeps, period
// exactly eleven, item n always the same skill as item n+11. The domain blocking
// was gone AND the sequence was the most learnable one available, which is the
// opposite of what the spread was added to achieve.
//
// Spread INSIDE each domain instead. Three skills give A B C A B C, two give
// A B A B: blocks intact, no skill adjacent to itself, no whole-set cycle.
function spreadBaseline(questions) {
    const byDomain = new Map();
    questions.forEach(q => {
        const d = _domainOf(q);
        if (!byDomain.has(d)) byDomain.set(d, []);
        byDomain.get(d).push(q);
    });

    const out = [];
    byDomain.forEach(group => {
        const bySkill = new Map();
        group.forEach(q => {
            if (!bySkill.has(q.skill)) bySkill.set(q.skill, []);
            bySkill.get(q.skill).push(q);
        });
        const lanes = [...bySkill.values()];
        let n = 0, wrote = 0;
        while (wrote < group.length) {
            let any = false;
            lanes.forEach(l => { if (l[n]) { out.push(l[n]); wrote++; any = true; } });
            n++;
            if (!any || n > 50) break;            // paranoia guard
        }
    });
    return out;
}

// ── preflight ─────────────────────────────────────────────────────
// Run this in the test suite against the REAL bank. If it throws, the build is
// wrong and shipping it would hand a tutor a report with a silent hole in it.
//
// This is the tripwire for the whole module. `data-*.js` is generated from the
// source PDFs, and the day somebody rebuilds it and a Medium pool comes back
// thinner — which has happened, to this exact bank — the baseline must fail
// loudly rather than quietly serve a form that is short one skill.
function baselinePreflight(bank) {
    const errors = [];
    const warnings = [];

    // 1. Every skill can supply every form at the anchor tier.
    const need = BASELINE_FORMS.length * BASELINE_ITEMS_PER_SKILL;
    BASELINE_SKILLS.forEach(skill => {
        const have = bank.filter(q =>
            q.skill === skill && q.difficulty === BASELINE_ANCHOR_TIER).length;
        if (have < need) {
            errors.push(`${skill}: only ${have} ${BASELINE_ANCHOR_TIER} items, need ${need} for ${BASELINE_FORMS.length} forms`);
        }
    });

    // 2. Probe pools are non-empty in BOTH directions for every skill, or a
    //    student can route to a probe that does not exist.
    BASELINE_SKILLS.forEach(skill => {
        const easy = bank.filter(q => q.skill === skill && q.difficulty === 'Easy').length;
        const hard = bank.filter(q => q.skill === skill && q.difficulty === 'Hard').length;
        if (easy === 0) errors.push(`${skill}: no Easy items — floor probe impossible`);
        if (hard === 0) errors.push(`${skill}: no Hard items — ceiling probe impossible`);
        if (easy > 0 && easy < 3) warnings.push(`${skill}: only ${easy} Easy items — floor probe repeats across retakes`);
        if (hard > 0 && hard < 3) warnings.push(`${skill}: only ${hard} Hard items — ceiling probe repeats across retakes`);
    });

    // 3. Forms are disjoint and complete.
    const seen = new Map();
    BASELINE_FORMS.forEach(f => {
        const { questions } = buildBaselineForm(bank, f);
        if (questions.length !== BASELINE_SKILLS.length * BASELINE_ITEMS_PER_SKILL) {
            errors.push(`form ${f}: ${questions.length} items, expected ${BASELINE_SKILLS.length * BASELINE_ITEMS_PER_SKILL}`);
        }
        questions.forEach(q => {
            if (seen.has(q.id)) errors.push(`id ${q.id} appears in form ${seen.get(q.id)} and form ${f}`);
            else seen.set(q.id, f);
        });
        BASELINE_SKILLS.forEach(skill => {
            const n = questions.filter(q => q.skill === skill).length;
            if (n !== BASELINE_ITEMS_PER_SKILL) {
                errors.push(`form ${f}: ${skill} has ${n} items, expected ${BASELINE_ITEMS_PER_SKILL}`);
            }
        });
    });

    // 4. Could the bank support one more form than we ship? Not an error — a
    //    note, so the constant above gets revisited when the bank grows instead
    //    of staying at two forever because nobody looked.
    const couldSupply = BASELINE_SKILLS.every(skill =>
        bank.filter(q => q.skill === skill && q.difficulty === BASELINE_ANCHOR_TIER).length
            >= (BASELINE_FORMS.length + 1) * BASELINE_ITEMS_PER_SKILL);
    if (couldSupply) {
        warnings.push(`the bank can now supply ${BASELINE_FORMS.length + 1} forms — consider adding one`);
    }

    return { ok: errors.length === 0, errors, warnings };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        BASELINE_SKILLS, BASELINE_ITEMS_PER_SKILL, BASELINE_ANCHOR_TIER,
        BASELINE_SECONDS, BASELINE_SECONDS_PER_ITEM, BASELINE_FORMS,
        BLUEPRINT_WEIGHT, RW_DOMAIN_ORDER,
        baselineManifest, buildBaselineForm, orderBaselineSAT, spreadBaseline,
        baselinePreflight,
    };
}
