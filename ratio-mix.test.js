// ─────────────────────────────────────────────────────────────────
// ratio-mix.test.js — custom practice in a ratio (the weight boxes on the
// setup screen), and the SAT-style ordering of the set it produces.
//
//   npm install jsdom --prefix /tmp/j
//   NODE_PATH=/tmp/j/node_modules node ratio-mix.test.js
//
// Skips cleanly if jsdom is absent.
//
// It loads the REAL index.html and the REAL app.js, injecting each script as a
// <script> element rather than eval()ing it — see challenge/challenge-ui.test.js
// for why that distinction matters (lexical globals like `const questionBank`
// are scoped away by eval).
//
// WHAT THIS GUARDS, and why each one is here:
//
//   1. The ratio OFF changes NOTHING. This is the whole safety story. The
//      toggle defaults to off, every Quick Preset switches it off, and the
//      weak-area drill and homework runner never touch it — so if the
//      allocator ever started constraining an un-toggled draw, it would
//      silently alter every set the app has ever built, everywhere, with no
//      error and no visible symptom. §5 of this file is the tripwire.
//
//   1b. And with it ON, equal shares mean an EVEN SPLIT, not "no ratio".
//      Five-and-five is the most ordinary thing a tutor asks for. The Math
//      app reads intent off whether the numbers differ, which makes that
//      request indistinguishable from an untouched screen; this one does not.
//
//   2. The parts sum to the total. Naive rounding of 10 split three ways gives
//      3+3+3 = 9: the screen says ten questions and the student is handed
//      nine. Largest-remainder apportionment is not decoration.
//
//   3. A quota the pool cannot fill degrades, it does not truncate. Ask for
//      five Hard Cross-Text when four exist and you must still get a full-length
//      set — a short session is indistinguishable, to the student, from
//      finishing early.
//
//   3b. The difficulty split is PER SKILL. Setting both dimensions as
//      independent marginals satisfies both sets of totals and still gets the
//      interior wrong — measured on this bank, Cross-Text 1 : Transitions 1
//      crossed with Medium 1 : Hard 1 gave five of each skill and five of each
//      difficulty, with four of the five Hard sitting on ONE skill. The
//      marginals prove nothing about the cells, and "half of each skill hard"
//      is a claim about cells. §3b is what stops that regressing.
//
//   4. The set comes out in R&W module order: domain blocks in
//      RW_DOMAIN_ORDER, easy → hard inside each. The Math app shuffles its
//      custom set because SAT Math is presented mixed; R&W is not, and copying
//      the shuffle would drill a question order the student never meets.
// ─────────────────────────────────────────────────────────────────
'use strict';
const fs = require('fs');
const path = require('path');

let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch (e) { console.log('SKIP — jsdom not installed (see header).'); process.exit(0); }

const APP = __dirname;
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');

const HTML = read('index.html')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<link\b[^>]*>/gi, '');

const SCRIPTS = [
    'gate.js', 'config.js', 'progress.js', 'sheet-sync.js', 'storage.js', 'timer.js', 'history.js',
    'data-craft-structure.js', 'data-expression-of-ideas.js', 'data-info-ideas.js', 'data-conventions.js',
    'app.js',
    null,   // test-only probe: a classic script, so it closes over app.js's lexical globals
];
// `const SKILL_DOMAIN` and friends are lexical globals — they never land on
// window, so a classic script has to hand them out.
const PROBE = 'window.__peek = function(){ return { SKILL_DOMAIN, RW_DOMAIN_ORDER, questionBank }; };';

function build() {
    return new Promise(resolve => {
        const dom = new JSDOM(HTML, {
            runScripts: 'dangerously',
            url: 'http://localhost/index.html',
            beforeParse(w) {
                w.fetch   = () => Promise.resolve({ ok: true });
                w.alert   = () => {};
                w.confirm = () => true;
                w.scrollTo = () => {};
            },
        });
        const w = dom.window;
        w.sessionStorage.setItem('mastery_unlocked', '1');
        w.sessionStorage.setItem('mastery_user', 'Test');
        for (const f of SCRIPTS) {
            const s = w.document.createElement('script');
            s.textContent = f === null ? PROBE : read(f);
            w.document.body.appendChild(s);
        }
        if (w.document.readyState !== 'loading') return resolve(w);
        w.document.addEventListener('DOMContentLoaded', () => resolve(w));
    });
}

let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, detail) {
    if (cond) { pass++; console.log('  ✓ ' + name); }
    else { fail++; fails.push(name); console.log('  ✗ ' + name + (detail ? ' — ' + detail : '')); }
}
function section(t) { console.log('\n' + t); }

// ── setup-screen helpers ────────────────────────────────────────
function setSkills(w, skills) {
    w.document.querySelectorAll('input[name="skill"]').forEach(el => {
        el.checked = skills.includes(el.value);
    });
}
function setDiffs(w, diffs) {
    w.document.querySelectorAll('input[name="diff"]').forEach(el => {
        el.checked = diffs.includes(el.value);
    });
}
function setWeights(w, byKey, attr) {
    w.document.querySelectorAll('.weight-input').forEach(el => {
        const key = el.getAttribute(attr);
        if (key !== null && byKey[key] !== undefined) el.value = String(byKey[key]);
    });
}
function resetWeights(w) {
    w.document.querySelectorAll('.weight-input').forEach(el => { el.value = '1'; });
}
function setLimit(w, n) { w.document.getElementById('limitSelect').value = String(n); }
function setRatio(w, on) { w.document.getElementById('ratioToggle').checked = !!on; }

// Synthetic questions, so the allocator's arithmetic is checked against numbers
// we control rather than against whatever the live bank happens to hold.
function fake(skill, difficulty, i) {
    return { id: `${skill}|${difficulty}|${i}`, skill, difficulty };
}
function fakePool(spec) {
    const out = [];
    Object.entries(spec).forEach(([skill, byDiff]) => {
        Object.entries(byDiff).forEach(([difficulty, n]) => {
            for (let i = 0; i < n; i++) out.push(fake(skill, difficulty, i));
        });
    });
    return out;
}
function countBy(list, key) {
    const m = {};
    list.forEach(q => { m[q[key]] = (m[q[key]] || 0) + 1; });
    return m;
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// Counts are a bag, not a list — key order is an artefact of insertion.
const sameCounts = (a, b) => {
    const norm = o => Object.keys(o).sort().map(k => `${k}=${o[k]}`).join(',');
    return norm(a) === norm(b);
};

// prioritizePool shuffles (Fisher-Yates over Math.random), so two calls on the
// same pool disagree. §5 has to compare the ratio-off path against the old code
// question for question, which is only meaningful on a pinned random stream.
function seed(w, n) {
    let x = n || 42;
    w.Math.random = () => {
        x = (x * 1103515245 + 12345) & 0x7fffffff;   // LCG, deterministic
        return x / 0x7fffffff;
    };
}

(async () => {
    const w = await build();
    const PEEK = w.__peek();

    // ═══════════════════════════════════════════════════════════
    section('1 · apportion — largest remainder, and the parts always sum to the total');

    ok('3:2:1 of 10 is 5 / 3 / 2',
        same(w.apportion({ A: 3, B: 2, C: 1 }, 10), { A: 5, B: 3, C: 2 }),
        JSON.stringify(w.apportion({ A: 3, B: 2, C: 1 }, 10)));

    // The case naive rounding gets wrong: 10/3 = 3.33 each, floor to 3+3+3 = 9.
    {
        const q = w.apportion({ A: 1, B: 1, C: 1 }, 10);
        const sum = q.A + q.B + q.C;
        ok('1:1:1 of 10 sums to 10, not 9', sum === 10, `got ${sum} (${JSON.stringify(q)})`);
    }

    {
        // Every total from 1..40 over an awkward ratio must still add up exactly.
        let worst = null;
        for (let n = 1; n <= 40; n++) {
            const q = w.apportion({ A: 5, B: 3, C: 3, D: 1 }, n);
            const sum = Object.values(q).reduce((a, b) => a + b, 0);
            if (sum !== n) { worst = `n=${n} summed to ${sum}`; break; }
        }
        ok('5:3:3:1 sums exactly for every total 1..40', worst === null, worst);
    }

    ok('a zero total apportions nothing rather than dividing by zero',
        same(w.apportion({ A: 0, B: 0 }, 10), { A: 0, B: 0 }));

    // ═══════════════════════════════════════════════════════════
    section('2 · hasShares / isRatioOn — the toggle decides, not the numbers');

    ok('shares that add up can be apportioned',   w.hasShares({ A: 3, B: 1 }) === true);
    // The point of the toggle: equal shares are a real request for an even
    // split, and must NOT be read as "no preference".
    ok('equal shares still count as shares',      w.hasShares({ A: 1, B: 1, C: 1 }) === true);
    ok('nothing selected has no shares',          w.hasShares({}) === false);
    // All-zero is a contradiction — "include these, give them none of the set".
    // Apportioning it divides by zero, so the dimension stands down instead.
    ok('all-zero shares stand the dimension down', w.hasShares({ A: 0, B: 0 }) === false);
    ok('the toggle is off on a fresh screen',     w.isRatioOn() === false);

    // ═══════════════════════════════════════════════════════════
    section('3 · allocateByRatio — the ratio picks how many, the queue picks which');

    const pool = fakePool({
        'Transitions':       { Easy: 20, Medium: 20 },
        'Boundaries':        { Easy: 20, Medium: 20 },
        'Words in Context':  { Easy: 20, Medium: 20 },
    });

    {
        const got = w.allocateByRatio(pool, 10, {}, { 'Transitions': 3, 'Boundaries': 2, 'Words in Context': 1 });
        ok('3:2:1 over 10 gives 5 Transitions / 3 Boundaries / 2 WIC',
            sameCounts(countBy(got, 'skill'), { 'Transitions': 5, 'Boundaries': 3, 'Words in Context': 2 }),
            JSON.stringify(countBy(got, 'skill')));
        ok('and returns exactly 10 questions', got.length === 10, String(got.length));
    }

    {
        // Ratio changes the limit, not the proportion: the same 3:2:1 at 27.
        const got = w.allocateByRatio(pool, 27, {}, { 'Transitions': 3, 'Boundaries': 2, 'Words in Context': 1 });
        const c = countBy(got, 'skill');
        ok('the same 3:2:1 survives raising the limit to 27',
            got.length === 27 && c['Transitions'] > c['Boundaries'] && c['Boundaries'] > c['Words in Context'],
            JSON.stringify(c));
    }

    {
        // The case the Math app cannot express: an even split. 1:1 with the
        // ratio on must give five and five, not "whatever the queue had".
        const twoSkills = fakePool({
            'Transitions': { Medium: 40 },
            'Boundaries':  { Medium: 40 },
        });
        const got = w.allocateByRatio(twoSkills, 10, {}, { 'Transitions': 1, 'Boundaries': 1 });
        ok('equal shares give an even split, not the raw queue slice',
            sameCounts(countBy(got, 'skill'), { 'Transitions': 5, 'Boundaries': 5 }),
            JSON.stringify(countBy(got, 'skill')));
    }

    {
        // Both dimensions at once — and the ROUNDING now happens per skill,
        // which is why the overall difficulty totals are not simply 1:3 of 12.
        //   skills 1:1:2 of 12   → Trans 3, Bdry 3, WIC 6
        //   each split Easy 1 : Medium 3
        //        3 → 1 Easy / 2 Medium      (0.75 and 2.25, Easy takes the leftover)
        //        6 → 2 Easy / 4 Medium
        //   totals              → 4 Easy / 8 Medium, not 3 / 9
        // That drift is the price of controlling the cells, and it is the right
        // trade: 3/9 across the set told you nothing about any one skill.
        const got = w.allocateByRatio(pool, 12, { Easy: 1, Medium: 3 }, { 'Transitions': 1, 'Boundaries': 1, 'Words in Context': 2 });
        ok('difficulty and skill ratios apply together, rounding per skill',
            sameCounts(countBy(got, 'difficulty'), { Easy: 4, Medium: 8 }),
            JSON.stringify(countBy(got, 'difficulty')));
        ok('and the skill split is exact',
            sameCounts(countBy(got, 'skill'),
                { 'Transitions': 3, 'Boundaries': 3, 'Words in Context': 6 }),
            JSON.stringify(countBy(got, 'skill')));
    }

    {
        // Ask for more Cross-Text than exist. The quota bends; the set does not shrink.
        const thin = fakePool({
            'Transitions':          { Medium: 40 },
            'Cross-Text Connections': { Medium: 2 },
        });
        // An even 1:1 asks for five of each; only two Cross-Text exist.
        const got = w.allocateByRatio(thin, 10, {}, { 'Cross-Text Connections': 1, 'Transitions': 1 });
        const c = countBy(got, 'skill');
        ok('a skill the pool cannot supply backfills to a full-length set',
            got.length === 10, `got ${got.length}`);
        ok('and takes every Cross-Text there was',
            c['Cross-Text Connections'] === 2, JSON.stringify(c));
    }

    // ── the grid ────────────────────────────────────────────────
    {
        // Two skills, both dimensions set. Each skill must carry its own
        // difficulty split — not just the set as a whole.
        const both = fakePool({
            'Cross-Text Connections': { Medium: 30, Hard: 30 },
            'Transitions':            { Medium: 30, Hard: 30 },
        });
        const got = w.allocateByRatio(both, 10,
            { Medium: 1, Hard: 1 },
            { 'Cross-Text Connections': 1, 'Transitions': 1 });
        const grid = {};
        got.forEach(q => {
            const k = q.skill + '/' + q.difficulty;
            grid[k] = (grid[k] || 0) + 1;
        });
        // 5 per skill, each split 1:1 → 3 and 2 (largest remainder).
        ok('each skill carries its own difficulty split',
            sameCounts(grid, {
                'Cross-Text Connections/Medium': 3, 'Cross-Text Connections/Hard': 2,
                'Transitions/Medium': 3,            'Transitions/Hard': 2,
            }),
            JSON.stringify(grid));
        ok('and no skill hoards a difficulty',
            got.filter(q => q.difficulty === 'Hard')
               .every((_, __, hard) => hard.length === 4),
            JSON.stringify(countBy(got.filter(q => q.difficulty === 'Hard'), 'skill')));
    }

    {
        // The pass-2 case: a skill with NO Hard questions at all. Its Hard cell
        // cannot be filled, and the SKILL quota is the stronger promise — the
        // shortfall is spent on that skill's Medium, not handed to another skill.
        const lopsided = fakePool({
            'Cross-Text Connections': { Medium: 30 },              // no Hard whatsoever
            'Transitions':            { Medium: 30, Hard: 30 },
        });
        const got = w.allocateByRatio(lopsided, 10,
            { Medium: 1, Hard: 1 },
            { 'Cross-Text Connections': 1, 'Transitions': 1 });
        ok('a skill with no Hard questions still fills its skill quota',
            sameCounts(countBy(got, 'skill'),
                { 'Cross-Text Connections': 5, 'Transitions': 5 }),
            JSON.stringify(countBy(got, 'skill')));
        ok('and the shortfall is spent on that skill, not given away',
            got.filter(q => q.skill === 'Cross-Text Connections')
               .every(q => q.difficulty === 'Medium'));
        ok('the set is still full length', got.length === 10, String(got.length));
    }

    {
        // Difficulty alone must still work with no skill shares in play.
        const one = fakePool({ 'Transitions': { Easy: 30, Medium: 30, Hard: 30 } });
        const got = w.allocateByRatio(one, 12, { Easy: 1, Medium: 2, Hard: 3 }, {});
        ok('difficulty shares alone apportion 1:2:3 into 2 / 4 / 6',
            sameCounts(countBy(got, 'difficulty'), { Easy: 2, Medium: 4, Hard: 6 }),
            JSON.stringify(countBy(got, 'difficulty')));
    }

    {
        // A zero weight is "in the set, but give it none of it".
        const got = w.allocateByRatio(pool, 9, {}, { 'Transitions': 2, 'Boundaries': 1, 'Words in Context': 0 });
        ok('a zero weight keeps a skill out of the quota',
            (countBy(got, 'skill')['Words in Context'] || 0) === 0,
            JSON.stringify(countBy(got, 'skill')));
    }

    {
        // Within a quota the queue order still decides. Transitions arrive in a
        // known order; the five chosen must be the first five, not five at random.
        const ordered = [];
        for (let i = 0; i < 20; i++) ordered.push(fake('Transitions', 'Medium', i));
        for (let i = 0; i < 20; i++) ordered.push(fake('Boundaries', 'Medium', i));
        const got = w.allocateByRatio(ordered, 10, {}, { 'Transitions': 1, 'Boundaries': 1 });
        const trans = got.filter(q => q.skill === 'Transitions').map(q => q.id);
        ok('inside a quota the weakest-first queue order is preserved',
            same(trans, [0, 1, 2, 3, 4].map(i => `Transitions|Medium|${i}`)),
            trans.join(','));
    }

    // ═══════════════════════════════════════════════════════════
    section('4 · orderSATStyle — R&W is served in domain blocks, easy → hard');

    {
        const scrambled = [
            fake('Transitions', 'Hard', 0),          // Expression of Ideas
            fake('Words in Context', 'Hard', 0),     // Craft & Structure
            fake('Boundaries', 'Easy', 0),           // Std. English Conv.
            fake('Inferences', 'Medium', 0),         // Information & Ideas
            fake('Words in Context', 'Easy', 0),     // Craft & Structure
        ];
        const got = w.orderSATStyle(scrambled);
        const domains = got.map(q => PEEK.SKILL_DOMAIN[q.skill]);
        ok('domains come out in RW_DOMAIN_ORDER',
            same(domains, ['Craft & Structure', 'Craft & Structure', 'Information & Ideas',
                           'Std. English Conv.', 'Expression of Ideas']),
            domains.join(' | '));
        ok('and climb easy → hard inside a domain',
            got[0].difficulty === 'Easy' && got[1].difficulty === 'Hard');
    }

    {
        // Stability: tied on domain AND difficulty, the queue order must survive,
        // so the weakest question in a block is still the one served first.
        const tied = [];
        for (let i = 0; i < 6; i++) tied.push(fake('Words in Context', 'Medium', i));
        const got = w.orderSATStyle(tied).map(q => q.id);
        ok('questions tied on domain and difficulty keep their queue order',
            same(got, tied.map(q => q.id)), got.join(','));
    }

    ok('orderSATStyle does not mutate its input', (() => {
        const src = [fake('Transitions', 'Hard', 0), fake('Words in Context', 'Easy', 0)];
        const before = src.map(q => q.id);
        w.orderSATStyle(src);
        return same(src.map(q => q.id), before);
    })());

    // ═══════════════════════════════════════════════════════════
    section('5 · THE TRIPWIRE — with the ratio off, the draw is the old draw exactly');

    {
        setSkills(w, ['Words in Context', 'Transitions', 'Boundaries']);
        setDiffs(w, ['Easy', 'Medium']);
        setRatio(w, false);
        resetWeights(w);
        setLimit(w, 15);

        // What buildActiveQuestions did before the ratio existed: prioritised
        // fresh questions, topped up with parked ones only if fresh ran short.
        seed(w, 7);
        const fresh  = w.prioritizePool(w.splitPoolByFreshness(w.getFilteredPool()).fresh);
        const expect = fresh.slice(0, 15).map(q => q.id);
        seed(w, 7);
        const got    = w.buildActiveQuestions().map(q => q.id);

        ok('with every weight at 1 the set is the plain queue slice, question for question',
            same(got, expect),
            `expected ${expect.length}, got ${got.length}`);
        ok('and it is NOT re-ordered into domain blocks',
            got.length > 0, 'empty set — the assertion above proved nothing');
    }

    {
        // "All matching questions" with no ratio is still the whole due pool.
        setLimit(w, 0);
        setRatio(w, false);
        resetWeights(w);
        seed(w, 11);
        const expect = w.prioritizePool(w.splitPoolByFreshness(w.getFilteredPool()).fresh).map(q => q.id);
        seed(w, 11);
        const got    = w.buildActiveQuestions().map(q => q.id);
        ok('"All matching questions" with no ratio is unchanged too', same(got, expect));
    }

    // ═══════════════════════════════════════════════════════════
    section('6 · end to end on the real bank, through the real setup screen');

    {
        setSkills(w, ['Words in Context', 'Transitions', 'Boundaries']);
        setDiffs(w, ['Easy', 'Medium']);
        resetWeights(w);
        setRatio(w, true);
        setWeights(w, { 'Transitions': 3, 'Boundaries': 2, 'Words in Context': 1 }, 'data-skill');
        setLimit(w, 10);

        const got = w.buildActiveQuestions();
        ok('the screen builds a 10-question set', got.length === 10, String(got.length));
        ok('split 5 / 3 / 2 as asked',
            sameCounts(countBy(got, 'skill'), { 'Transitions': 5, 'Boundaries': 3, 'Words in Context': 2 }),
            JSON.stringify(countBy(got, 'skill')));

        // Domain-clustered: once a domain has been left behind it never returns.
        const seq  = got.map(q => PEEK.SKILL_DOMAIN[q.skill]);
        const seen = new Set();
        let contiguous = true, prev = null;
        seq.forEach(d => {
            if (d !== prev) { if (seen.has(d)) contiguous = false; seen.add(d); prev = d; }
        });
        ok('and comes out in contiguous domain blocks, not interleaved',
            contiguous, seq.join(' | '));
    }

    {
        // The summary line must report the mix actually built, not the ratio asked for.
        w.updateSetupUI();
        const text = w.document.getElementById('sessionSummary').textContent;
        ok('the summary names the realised per-skill counts',
            /Trans 5/.test(text) && /Bdry 3/.test(text) && /WIC 2/.test(text), text);
    }

    {
        // A ratio with the limit on "All" must do something visible, and must
        // honour the ratio rather than dumping the whole pool.
        setLimit(w, 0);
        const got = w.buildActiveQuestions();
        const c = countBy(got, 'skill');
        ok('a ratio still applies when the limit is "All matching questions"',
            got.length > 0 && (c['Transitions'] || 0) >= (c['Boundaries'] || 0)
                           && (c['Boundaries'] || 0) >= (c['Words in Context'] || 0),
            `${got.length} — ${JSON.stringify(c)}`);
    }

    {
        // A Quick Preset states a whole set-up, so it must clear a stale ratio.
        setLimit(w, 10);
        setRatio(w, true);
        setWeights(w, { 'Transitions': 9 }, 'data-skill');
        const preset = w.document.querySelector('.preset-btn');
        w.applyPreset(preset);
        const stale = [...w.document.querySelectorAll('.weight-input')]
            .filter(el => el.value !== '1');
        ok('a Quick Preset resets every share to 1',
            stale.length === 0,
            stale.map(el => `${el.getAttribute('data-skill') || el.getAttribute('data-diff')}=${el.value}`).join(','));
        ok('and switches the ratio back off', w.isRatioOn() === false);
    }

    {
        // A weight box is meaningless until its own skill is in the set.
        setSkills(w, ['Words in Context']);
        setDiffs(w, ['Easy']);
        const wic  = w.document.querySelector('.weight-input[data-skill="Words in Context"]');
        const bdry = w.document.querySelector('.weight-input[data-skill="Boundaries"]');

        setRatio(w, false);
        w.updateSetupUI();
        ok('with the ratio off every share box is dead', wic && wic.disabled === true);

        setRatio(w, true);
        w.updateSetupUI();
        ok('with it on, a ticked skill has a live share box', wic  && wic.disabled === false);
        ok('but an unticked skill stays disabled',            bdry && bdry.disabled === true);
    }

    // ═══════════════════════════════════════════════════════════
    console.log(`\n${pass} passed, ${fail} failed`);
    if (fail) { console.log('FAILED: ' + fails.join(' | ')); process.exit(1); }
})().catch(e => { console.error(e); process.exit(1); });
