// ─────────────────────────────────────────────────────────────────
// challenge-core.js — the Challenge module's logic. Nothing else.
//
// No DOM. No storage. No network. And, deliberately, NO GENERATOR:
// there is no function in this file that can invent a challenge set.
//
// ── The invariant ────────────────────────────────────────────────
//   Generation is offline and ledger-blind.  The runtime only resolves.
//
// A challenge set is a committed artifact: a frozen list of question ids
// in challenge/sets.js, produced offline from a student's real misses,
// reviewed by a human, and changed only by us when a new practice test is
// analysed. Nothing here reads progress in order to decide WHICH questions
// are in a set. Progress decides only the ORDER they are served in.
//
// If a set's `ids` is empty, no challenge is served. We do not helpfully
// build one on the fly — that would reintroduce the drift the freeze exists
// to prevent.
//
// ── Where the definitions live ───────────────────────────────────
// Mastery, decay, and the four tiers are progress.js's, not ours. When
// progress.js is present we delegate to its `_isMastered` so the two can
// never drift apart. The fallback below exists only so this file can be
// unit-tested standalone, and must stay byte-for-byte equivalent.
//
// Note what is NOT here: `_isResting` / REVIEW_COOLDOWN_MS. The 20-hour
// cooldown governs freshness for the general practice pool. Applying it
// inside a challenge set would strand the student — finish a pass, every
// question rests, nothing is servable, and the confirm-and-master flow can
// never run. Segments plus back-of-queue are the anti-repeat mechanism here.
// ─────────────────────────────────────────────────────────────────

(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) module.exports = factory();
    else root.ChallengeCore = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    // Must match progress.js. Used only by the standalone fallback below.
    var MASTERY_THRESHOLD = 2;
    var MASTERY_DECAY_MS  = 21 * 86400000;

    // Serving order. `mastered` is never served unless the student explicitly
    // asks to reattempt everything.
    var SERVE_ORDER     = ['wrong', 'notAttempted', 'correctOnce'];
    var REATTEMPT_ORDER = ['wrong', 'notAttempted', 'correctOnce', 'mastered'];

    function _fallbackIsMastered(r) {
        if (!r) return false;
        if (r.lastSeen && Date.now() - r.lastSeen > MASTERY_DECAY_MS) return false;
        return (r.correct || 0) >= MASTERY_THRESHOLD;
    }

    // Delegate to the app's definition whenever it is loaded.
    function isMastered(r) {
        if (typeof _isMastered === 'function') return _isMastered(r);
        return _fallbackIsMastered(r);
    }

    function _shuffle(a, rng) {
        var r = rng || Math.random;
        for (var i = a.length - 1; i > 0; i--) {
            var j = Math.floor(r() * (i + 1));
            var t = a[i]; a[i] = a[j]; a[j] = t;
        }
        return a;
    }

    // ── Segments ─────────────────────────────────────────────────
    // Exhaustive and mutually exclusive. One-to-one with the four tiers
    // prioritizePool() uses:
    //   wrong = needsWork · notAttempted = unseen · correctOnce = softMastered
    //
    // The branch order matters and mirrors progress.js exactly.
    //
    // SERVE_ORDER, however, deliberately does NOT match prioritizePool's default
    // any more (22 Jul 2026). That default now leads with `unseen`, because a
    // homework day's job is to cover new material and spaced review arrives on the
    // ladder. A Challenge is the opposite instrument: a fixed, closed list of the
    // student's own test misses, where there is no coverage to win and the only
    // goal is mastering those items. So a Challenge keeps misses first — which is
    // exactly prioritizePool(pool, { missesFirst: true }).
    //
    // Consequence worth knowing: a question you have EVER got wrong never
    // enters `correctOnce`. `wrong` is defined by wrong > 0, and its only
    // exit is mastery. So `correctOnce` holds only questions never missed,
    // and the confirm pass is a lap over clean single-corrects — not a
    // remediation pass. Misses are remediated inside the first pass,
    // because `wrong` is served first.
    function segmentOf(q, ledger) {
        var r = ledger[q.id];
        if (!r) return 'notAttempted';
        if (isMastered(r)) return 'mastered';
        if ((r.wrong || 0) > 0) return 'wrong';
        return 'correctOnce';
    }

    function counts(questions, ledger) {
        var c = { notAttempted: 0, wrong: 0, correctOnce: 0, mastered: 0, total: questions.length };
        questions.forEach(function (q) { c[segmentOf(q, ledger)]++; });
        return c;
    }

    // ── Serving ──────────────────────────────────────────────────
    function buildQueue(questions, ledger, opts) {
        opts = opts || {};
        var shuffle = opts.shuffle || function (a) { return _shuffle(a, opts.rng); };
        var order   = opts.includeMastered ? REATTEMPT_ORDER : SERVE_ORDER;
        var by = { wrong: [], notAttempted: [], correctOnce: [], mastered: [] };
        questions.forEach(function (q) { by[segmentOf(q, ledger)].push(q); });
        var out = [];
        order.forEach(function (s) { out = out.concat(shuffle(by[s].slice())); });
        return out;
    }

    // After grading, a question that is not now mastered goes to the BACK of
    // the live queue — behind everything still unserved. It cannot resurface
    // until the remaining queue has cycled. Mastered questions leave the
    // rotation entirely (unless this is a reattempt-all pass).
    function requeue(queue, q, ledger, opts) {
        if ((opts && opts.includeMastered) || segmentOf(q, ledger) !== 'mastered') queue.push(q);
        return queue;
    }

    // ── Completion gates ─────────────────────────────────────────
    // Evaluated over the WHOLE set, never the session.
    //   empty   — nothing resolved
    //   normal  — work remains in `wrong` or `notAttempted`
    //   confirm — every question is correct-once-or-better, not all mastered
    //   done    — every question mastered
    function gate(c) {
        if (!c.total) return 'empty';
        if (c.mastered === c.total) return 'done';
        if (c.notAttempted === 0 && c.wrong === 0) return 'confirm';
        return 'normal';
    }

    function defaultSessionSize(c) {
        if (gate(c) === 'confirm') return Math.max(1, c.correctOnce);
        return Math.max(1, Math.min(10, c.total - c.mastered));
    }

    // ── Resolution ───────────────────────────────────────────────
    // Resolve a frozen id list against the bank. Missing ids are RETURNED,
    // never silently dropped: a silent drop shrinks the denominator and
    // "Mastered 9 of 28" quietly becomes "9 of 27". The caller must surface
    // `missing` — loudly.
    function resolveSet(setDef, bank) {
        var idx = {};
        bank.forEach(function (q) { idx[q.id] = q; });
        var questions = [], missing = [];
        (setDef.ids || []).forEach(function (id) {
            if (idx[id]) questions.push(idx[id]); else missing.push(id);
        });
        return { questions: questions, missing: missing };
    }

    // Static checks a committed set must pass. Run at load, and offline.
    function validateSet(setDef) {
        var problems = [];
        if (!setDef || !setDef.setId) problems.push('missing setId');
        var ids = (setDef && setDef.ids) || [];
        if (!ids.length) problems.push('empty ids — no challenge will be served');
        var seen = {};
        ids.forEach(function (id) {
            if (seen[id]) problems.push('duplicate id: ' + id);
            seen[id] = 1;
        });
        return problems;
    }

    // Sets belonging to the signed-in student. Identity is the caller's job
    // (sessionStorage.mastery_user); this stays a pure lookup.
    function setsFor(student, roster) {
        if (!student || !roster) return [];
        return roster[student] || [];
    }

    return {
        segmentOf: segmentOf,
        counts: counts,
        buildQueue: buildQueue,
        requeue: requeue,
        gate: gate,
        defaultSessionSize: defaultSessionSize,
        resolveSet: resolveSet,
        validateSet: validateSet,
        setsFor: setsFor,
        isMastered: isMastered,
        SERVE_ORDER: SERVE_ORDER,
        REATTEMPT_ORDER: REATTEMPT_ORDER,
        MASTERY_THRESHOLD: MASTERY_THRESHOLD,
        MASTERY_DECAY_MS: MASTERY_DECAY_MS,
    };
}));
