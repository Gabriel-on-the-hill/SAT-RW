// ══════════════════════════════════════════════════════════════════
// baseline-grade.js — banding, routing, projection, and the plan
//
// This file reports a BAND per skill, not a percentage, and that is the whole
// design rather than a presentation choice. Two items cannot support a
// percentage: with four options, chance alone earns about a quarter of them,
// and a skill measured by two questions can only score 0, 50 or 100. A report
// that prints "Inferences 50%" is inviting a tutor to act on a coin flip, and
// two students of identical ability would be handed two different study plans.
//
// WHY THE BASE MUST STAY FIXED
// An earlier version of this idea, in the sister app, scored each skill as
// difficulty-weighted points ÷ available points. It does not survive contact
// with an adaptive second stage: a student routed to a Hard probe has a
// denominator of 4 and a student routed to an Easy probe has a denominator of
// 2, so 0.75 silently means two different things and the thresholds stop being
// comparable between students. The fix is to keep the MEASUREMENT base fixed —
// the same two Medium items for everyone — and let the probe move a student one
// rung up or down from it. Uniform base, ordinal ladder, no denominator drift.
// ══════════════════════════════════════════════════════════════════

// Five bands, each with a genuinely different instructional consequence. If two
// bands would lead to the same lesson, they should be one band.
//
// Priority vs Foundational is the pair that earns its keep: more drilling is
// the right answer for one and the wrong answer for the other, and a report
// that cannot tell them apart sends a tutor to drill a student who needs
// teaching — which fails, slowly, and looks like the student's fault.
const BASELINE_BANDS = {
    Secure: {
        rank: 5,
        label: 'Secure',
        meaning: 'Handles this skill at the hardest level the test asks for.',
        action: 'Maintain with spaced review only. Do not spend teaching time here.',
    },
    Proficient: {
        rank: 4,
        label: 'Proficient',
        meaning: 'Solid at test level; the hardest variants are not there yet.',
        action: 'Light practice at Hard difficulty. Not a teaching priority.',
    },
    Developing: {
        rank: 3,
        label: 'Developing',
        meaning: 'Inconsistent at test level — gets it sometimes.',
        action: 'Targeted practice at Medium, then push to Hard. Reachable gains.',
    },
    Priority: {
        rank: 2,
        label: 'Priority',
        meaning: 'Has the underlying idea but cannot apply it at test level.',
        action: 'Teach the method, then drill Medium. This is where points are.',
    },
    Foundational: {
        rank: 1,
        label: 'Foundational',
        meaning: 'The underlying skill is not in place yet.',
        action: 'Pre-teach from scratch. Drilling test questions will not fix this.',
    },
};

// ── timing overlay ────────────────────────────────────────────────
// A wrong answer means at least three different things and the remedy differs
// for each. Without per-item time you cannot tell "does not know it" from "ran
// out of clock", and those two prescriptions are opposites: one is more
// teaching, the other is less reading time and a decision rule.
//
// This is the same signal AGENTS.md protects in the homework runner — "a Hard
// passage committed in four seconds means she did not read it. That is the
// signal; do not average it away."
const T_NON_ATTEMPT = 8;     // under 8 s on a passage item = did not read it
const T_RUSHED      = 15;    // under 15 s = answered, but not deliberately
const T_LABOURED    = 150;   // over 150 s = engaged and stuck, not indifferent

function classifyTiming(item) {
    const s = item.seconds;
    if (typeof s !== 'number' || s < 0) return null;
    if (s < T_NON_ATTEMPT) return 'non-attempt';
    if (!item.correct && s < T_RUSHED) return 'rushed';
    if (!item.correct && s > T_LABOURED) return 'laboured';
    if (item.correct && s > T_LABOURED) return 'slow-correct';
    return null;
}

// ── stage 1 → provisional band, and the routing decision ──────────
// 2/2 → the open question is the CEILING, so spend a Hard item.
// 1/2 → Developing is already the honest answer; a probe buys nothing, so spend
//       nothing. This is why the follow-up is short: a student who is genuinely
//       middling on most skills sits almost no second stage.
// 0/2 → the open question is the FLOOR, so spend an Easy item, which is the one
//       place it is decisive — it separates "cannot apply it" from "has not got
//       it", and those are different lessons.
function routeSkill(correctCount) {
    if (correctCount >= 2) return { provisional: 'Proficient', probe: 'Hard'  };
    if (correctCount === 1) return { provisional: 'Developing', probe: null   };
    return                         { provisional: 'Priority',   probe: 'Easy' };
}

// ── stage 2 → final band ──────────────────────────────────────────
function finalBand(correctCount, probeTier, probeCorrect) {
    if (probeTier === null || probeCorrect === null || probeCorrect === undefined) {
        return routeSkill(correctCount).provisional;
    }
    if (probeTier === 'Hard') return probeCorrect ? 'Secure' : 'Proficient';
    if (probeTier === 'Easy') return probeCorrect ? 'Priority' : 'Foundational';
    return routeSkill(correctCount).provisional;
}

// ── the profile ───────────────────────────────────────────────────
// items: [{ id, skill, difficulty, correct, seconds, stage, probeTier }]
function buildBaselineProfile(items) {
    const skills = {};

    items.filter(i => i.stage === 1).forEach(i => {
        const s = skills[i.skill] || (skills[i.skill] = {
            skill: i.skill, screenCorrect: 0, screenTotal: 0,
            probeTier: null, probeCorrect: null, flags: [], items: [],
        });
        s.screenTotal++;
        if (i.correct) s.screenCorrect++;
        const t = classifyTiming(i);
        if (t) s.flags.push(t);
        s.items.push(i);
    });

    items.filter(i => i.stage === 2).forEach(i => {
        const s = skills[i.skill];
        if (!s) return;
        s.probeTier    = i.probeTier || i.difficulty;
        s.probeCorrect = !!i.correct;
        const t = classifyTiming(i);
        if (t) s.flags.push(t);
        s.items.push(i);
    });

    Object.values(skills).forEach(s => {
        const route = routeSkill(s.screenCorrect);
        s.routedProbe  = route.probe;
        s.provisional  = route.provisional;
        s.band         = finalBand(s.screenCorrect, s.probeTier, s.probeCorrect);

        // `resolved` means "no further probe is planned", which is NOT the same
        // as "measured reliably" — a 1/2 screener is the least informative
        // outcome there is and it is precisely the one that routes no probe.
        // The sister app calls this state `confirmed`, and a tutor reading that
        // word next to a two-item result will over-trust it. Say what is true.
        s.confidence = s.probeTier ? 'probed' : (route.probe ? 'provisional' : 'resolved');

        // A skill whose screener items were not genuinely attempted has not been
        // measured. Say so rather than reporting a band built on a coin flip: a
        // false "Foundational" sends a tutor to re-teach something the student
        // already knows, which is the most expensive mistake this report can
        // make and the one a student will not correct out loud.
        const nonAttempts = s.items.filter(i =>
            i.stage === 1 && classifyTiming(i) === 'non-attempt').length;
        if (nonAttempts >= s.screenTotal) {
            s.band = null;
            s.confidence = 'not-measured';
            s.note = 'Not attempted — no reliable reading. Re-test this skill.';
        } else if (nonAttempts > 0) {
            s.confidence = 'low';
            s.note = 'One item was not genuinely attempted; treat with caution.';
        } else if (s.flags.includes('rushed')) {
            s.note = 'Missed at speed — check whether this is pacing, not knowledge.';
        } else if (s.flags.includes('laboured')) {
            s.note = 'Engaged but slow and wrong — a method gap, not effort.';
        }
    });

    return skills;
}

// ── projection ────────────────────────────────────────────────────
// The SAT R&W section score runs 200–800. (The sister app projects 120–720,
// which is the PSAT 8/9 scale — do not copy its numbers.)
//
// Score per domain, then re-weight to the real blueprint. Without this the
// screener's own shape leaks into the estimate: uniform 2-per-skill coverage
// gives Information & Ideas 8 of 22 items, 36% against a real ~26%, purely
// because it owns four skills. A student weak in I&I would be under-projected
// by the instrument rather than by their ability.
const BASELINE_SCALE_LOW  = 200;
const BASELINE_SCALE_HIGH = 800;

function projectBaseline(items) {
    const dom = {};
    let blanks = 0;
    items.filter(i => i.stage === 1).forEach(i => {
        if (!i.chosen) blanks++;
        const d = (typeof SKILL_DOMAIN !== 'undefined' && SKILL_DOMAIN[i.skill]) || null;
        if (!d) return;
        const rec = dom[d] || (dom[d] = { c: 0, t: 0 });
        rec.t++;
        if (i.correct) rec.c++;
    });

    let weighted = 0, weightUsed = 0;
    Object.entries(BLUEPRINT_WEIGHT).forEach(([d, w]) => {
        if (!dom[d] || !dom[d].t) return;
        weighted   += (dom[d].c / dom[d].t) * w;
        weightUsed += w;
    });
    const acc = weightUsed ? weighted / weightUsed : 0;

    // The screener is all-Medium. A student who clears Medium reliably is not at
    // the top of the scale, because the real section carries Hard items too, so
    // mapping Medium accuracy straight onto 200–800 would overstate a strong
    // student and understate a weak one. Compress toward the middle of the
    // range and — this is the important part — report a WIDTH, never a point.
    // Twenty-two items cannot support a point estimate, and a single number
    // invites a parent to read ±60 of instrument noise as progress.
    const span   = BASELINE_SCALE_HIGH - BASELINE_SCALE_LOW;     // 600
    const centre = BASELINE_SCALE_LOW + (0.15 + acc * 0.72) * span;
    const half   = 30;                                           // ±30 → 60-point band
    const lo = Math.max(BASELINE_SCALE_LOW,  Math.round((centre - half) / 10) * 10);
    const hi = Math.min(BASELINE_SCALE_HIGH, Math.round((centre + half) / 10) * 10);

    // A blank scores as wrong, which is what the real test does — but a student
    // who ran out of clock and a student who did not know are being given the
    // same number here, and only one of them has a knowledge problem. The
    // per-skill overlay separates them; the projection cannot, so it says so.
    let caveat = 'Estimated from a 22-question medium-difficulty screener. '
               + 'A full mock exam gives a tighter figure.';
    if (blanks) {
        caveat += ' ' + blanks + ' question' + (blanks > 1 ? 's were' : ' was')
               +  ' left blank and counted wrong, so this may read low if the clock ran out.';
    }

    return { low: lo, high: hi, accuracy: Math.round(acc * 100), domains: dom, blanks, caveat };
}

// ── how much is a skill actually worth? ───────────────────────────
// Domain weight alone is the wrong ruler. Craft & Structure carries 28% but
// splits it across THREE skills; Expression of Ideas carries 20% across TWO.
// Ranking on the domain figure therefore says Cross-Text Connections outranks
// Rhetorical Synthesis, which is backwards — Cross-Text is rare on the real
// section and Rhetorical Synthesis is everywhere.
//
// Within-domain frequency is not uniform either, so splitting evenly is only
// marginally better. The bank was extracted from real released material, so a
// skill's share of its own domain's items is a usable empirical proxy for how
// often the real section asks it:
//
//     skill weight = domain blueprint weight × skill's share of its domain
//
// On this bank that gives Boundaries 13.2%, Form/Structure/Sense 12.8%, Words in
// Context 12.5%, Rhetorical Synthesis 11.8% at the top, and Cross-Text 6.5% and
// Command of Evidence — Quantitative 4.0% at the bottom. Derived at run time, so
// it stays honest as the bank grows.
let _skillWeightCache = null;

function skillWeights(bank) {
    const src = bank || (typeof questionBank !== 'undefined' ? questionBank : []);

    // Key the cache on a cheap fingerprint, not on length alone. Two different
    // banks of equal size are common in tests — a fixture and the real bank
    // often match by accident — and a length-keyed cache hands the second one
    // the first one's weights with no symptom at all.
    const stamp = src.length + ':' + (src[0] && src[0].id) + ':' + (src[src.length - 1] && src[src.length - 1].id);
    if (_skillWeightCache && _skillWeightCache.stamp === stamp) return _skillWeightCache.w;

    const domainTotal = {};
    const skillTotal  = {};
    src.forEach(q => {
        const d = (typeof SKILL_DOMAIN !== 'undefined' && SKILL_DOMAIN[q.skill]) || null;
        if (!d) return;
        domainTotal[d]      = (domainTotal[d]      || 0) + 1;
        skillTotal[q.skill] = (skillTotal[q.skill] || 0) + 1;
    });

    const w = {};
    Object.keys(skillTotal).forEach(s => {
        const d = SKILL_DOMAIN[s];
        const share = domainTotal[d] ? skillTotal[s] / domainTotal[d] : 0;
        w[s] = (BLUEPRINT_WEIGHT[d] || 0.2) * share;
    });

    _skillWeightCache = { stamp, w };
    return w;
}

// ── the plan ──────────────────────────────────────────────────────
// Rank by severity × skill weight, so teaching time goes where the points are
// rather than simply where the score is lowest. A Foundational reading on a
// skill the section asks twice a paper is worth less of a tutor's Saturday than
// a Priority reading on one it asks eight times.
function baselineFocusQueue(profile, limit, bank) {
    const weights = skillWeights(bank);
    const scored = Object.values(profile)
        .filter(s => s.band && BASELINE_BANDS[s.band].rank <= 3)
        .map(s => {
            const w = weights[s.skill] || 0.05;
            const severity = 4 - BASELINE_BANDS[s.band].rank;   // Dev 1, Pri 2, Found 3
            return { ...s, weight: w, priorityScore: severity * w };
        })
        .sort((a, b) => b.priorityScore - a.priorityScore);
    return limit ? scored.slice(0, limit) : scored;
}

// Build the stage-2 probe set: one item per skill that routed to a probe, drawn
// from the correct tier and excluding anything already served.
function buildProbeSet(bank, profile, excludeIds, seed) {
    const exclude = new Set(excludeIds || []);
    const out = [];
    const gaps = [];
    Object.values(profile).forEach(s => {
        if (!s.routedProbe) return;
        const pool = bank.filter(q =>
            q.skill === s.skill && q.difficulty === s.routedProbe && !exclude.has(q.id));
        if (!pool.length) {
            // Never substitute another skill to fill the slot. Report the gap:
            // a probe from the wrong skill would resolve a band that was never
            // tested, which is worse than leaving it provisional.
            gaps.push({ skill: s.skill, tier: s.routedProbe });
            return;
        }
        // Seeded, not pool[0]. Taking the first match means every student gets
        // the identical Hard question for a skill on every sitting — which the
        // forms go to real trouble to avoid, and then the probe hands back. The
        // seed carries the form letter, so a retake probes with a different item.
        const rand = _mulberry32(_seedFrom('probe::' + (seed || '') + '::' + s.skill));
        const pick = pool[Math.floor(rand() * pool.length)] || pool[0];
        out.push({ ...pick, stage: 2, probeTier: s.routedProbe });
        exclude.add(pick.id);
    });
    return { probes: out, gaps };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        BASELINE_BANDS, classifyTiming, routeSkill, finalBand, skillWeights,
        buildBaselineProfile, projectBaseline, baselineFocusQueue, buildProbeSet,
        BASELINE_SCALE_LOW, BASELINE_SCALE_HIGH,
        T_NON_ATTEMPT, T_RUSHED, T_LABOURED,
    };
}
