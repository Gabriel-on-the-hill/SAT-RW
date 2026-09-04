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

// THREE bands. One sitting, one submit, and the reading is whatever those two
// Medium items support — no more.
//
// There were five. Secure and Foundational are gone because they were never
// readable from the screener: each one needed a second-stage probe, a Hard item
// to find the ceiling or an Easy item to find the floor, served AFTER the
// student had already finished. That follow-up is removed. Once a student
// submits, that is the whole sitting.
//
// What that costs is worth writing down rather than discovering later.
// Foundational was the "the underlying skill is not in place — teach it, do not
// drill it" reading, and 0/2 on its own cannot tell that from "knows the idea,
// cannot apply it at test level". Both now report as Priority. A screener is
// triage, and triage is allowed to say "this one needs a closer look" without
// pretending to have taken it: if a skill needs a floor or ceiling read, that
// is a homework set, which is the tutor's call and belongs in
// homework/assignments.js — not a second instrument bolted onto a check the
// student has already finished.
const BASELINE_BANDS = {
    Proficient: {
        rank: 3,
        label: 'Proficient',
        meaning: 'Solid at test level.',
        action: 'Not a teaching priority. Keep it fresh with spaced review.',
    },
    Developing: {
        rank: 2,
        label: 'Developing',
        meaning: 'Inconsistent at test level — gets it sometimes.',
        action: 'Targeted practice at Medium, then push to Hard. Reachable gains.',
    },
    Priority: {
        rank: 1,
        label: 'Priority',
        meaning: 'Not working at test level yet.',
        action: 'Teach the method before drilling. Check whether the underlying '
              + 'skill is there — two questions cannot tell you that.',
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

// ── the band, from the two screener items and nothing else ────────
// 2/2 → Proficient · 1/2 → Developing · 0/2 → Priority.
//
// That is the whole ladder. It is deliberately not more: two four-option items
// can support an ordinal reading and cannot support anything finer, and a
// report that claims finer is inviting a tutor to act on a coin flip.
function bandFor(correctCount) {
    if (correctCount >= 2) return 'Proficient';
    if (correctCount === 1) return 'Developing';
    return 'Priority';
}

// ── the profile ───────────────────────────────────────────────────
// items: [{ id, skill, difficulty, correct, seconds }]
//
// `stage` is still tolerated on an item so that a record written before the
// follow-up was removed still reads: those sittings have stage-2 rows, and they
// are simply not counted toward the band. A stored baseline is the anchor every
// later claim of progress is measured against, and it must not become
// unreadable because the instrument changed.
function buildBaselineProfile(items) {
    const skills = {};

    items.filter(i => i.stage === undefined || i.stage === 1).forEach(i => {
        const s = skills[i.skill] || (skills[i.skill] = {
            skill: i.skill, screenCorrect: 0, screenTotal: 0,
            flags: [], items: [],
        });
        s.screenTotal++;
        if (i.correct) s.screenCorrect++;
        const t = classifyTiming(i);
        if (t) s.flags.push(t);
        s.items.push(i);
    });

    Object.values(skills).forEach(s => {
        s.band       = bandFor(s.screenCorrect);
        // One sitting, one reading. `measured` means exactly "these two items
        // were genuinely attempted" — not that the skill is settled. Two items
        // never settle a skill, which is what the note on the results screen
        // says out loud.
        s.confidence = 'measured';

        // A skill whose items were not genuinely attempted has not been
        // measured. Say so rather than reporting a band built on a coin flip: a
        // false "Priority" sends a tutor to re-teach something the student
        // already knows, which is the most expensive mistake this report can
        // make and the one a student will not correct out loud.
        const nonAttempts = s.items.filter(i =>
            classifyTiming(i) === 'non-attempt').length;
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
    const all = bank || (typeof questionBank !== 'undefined' ? questionBank : []);
    const src = all.filter(q => typeof baselineEligibleQuestion !== 'function' || baselineEligibleQuestion(q));

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
        // Proficient stays out of the plan; Developing and Priority are the
        // teaching range.
        .filter(s => s.band && BASELINE_BANDS[s.band].rank <= 2)
        .map(s => {
            const w = weights[s.skill] || 0.05;
            const severity = 3 - BASELINE_BANDS[s.band].rank;   // Dev 1, Pri 2
            return { ...s, weight: w, priorityScore: severity * w };
        })
        .sort((a, b) => b.priorityScore - a.priorityScore);
    return limit ? scored.slice(0, limit) : scored;
}

// There is no buildProbeSet, and there is no stage two. The sitting is 22
// questions and it ends when the student submits.
//
// It used to route a Hard ceiling probe at every 2/2 skill and an Easy floor
// probe at every 0/2 one, offered on the results screen after the student had
// already finished. That is what produced the five-band ladder, and it is gone
// on purpose: a check the student has completed should be complete. If a band
// needs resolving, resolve it with taught practice — a homework set — not by
// re-opening a finished assessment.

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        BASELINE_BANDS, classifyTiming, bandFor, skillWeights,
        buildBaselineProfile, projectBaseline, baselineFocusQueue,
        BASELINE_SCALE_LOW, BASELINE_SCALE_HIGH,
        T_NON_ATTEMPT, T_RUSHED, T_LABOURED,
    };
}
