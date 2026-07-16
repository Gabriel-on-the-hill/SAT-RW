// ─────────────────────────────────────────────────────────────────
// challenge/sets.js — the challenge roster. A FROZEN ARTIFACT.
//
// This file is the set of record. It is produced offline from a student's
// real misses on a practice test, reviewed by a human, and committed. That
// commit is the freeze point. Nothing in the running app may write to it,
// and nothing in the running app may generate a set that is not here.
//
// ── Rules ────────────────────────────────────────────────────────
//
//  1. `ids` is immutable once committed. Never edit a set's ids to "improve"
//     it — the ids are the denominator of "Mastered 9 of 28", and changing
//     them silently redefines every number the student has ever seen.
//
//  2. A new practice test APPENDS a new set. It never mutates an old one.
//     Practice 9 does not overwrite Practice 8. Sets are append-only.
//
//  3. The offline generator must EXCLUDE every id already committed to that
//     student's earlier sets. Otherwise mastering one question bumps two
//     tallies and progress reads inflated. The union of a student's sets is
//     a growing, non-overlapping curriculum built from his own errors.
//
//  4. `ids` must resolve against the question banks. A missing id is a loud
//     error, not a silent drop. See ChallengeCore.resolveSet.
//
//  5. Empty `ids` means no challenge is served for that set. That is the
//     correct behaviour while a set awaits generation. The app must never
//     fill it in.
//
//  6. This roster is client-side and readable. Jeffrey can open devtools and
//     see Bruce's set, exactly as he can read gate.js. Accept it; don't put
//     anything here that shouldn't be readable.
//
// ── Schema ───────────────────────────────────────────────────────
//   setId   — stable, unique per student. Display and dedupe only; no storage.
//   title   — what the student sees.
//   source  — which test the misses came from.
//   date    — when he sat it (YYYY-MM-DD).
//   review  — OPTIONAL. The verbatim missed questions, for a one-time
//             debrief. UNSCORED: their ids are not in the bank, so they are
//             not part of the mastery denominator. Omit when you only have
//             a score report.
//   ids     — the frozen, scored challenge set: bank questions selected
//             offline as siblings of his misses (same skill, same difficulty,
//             same ruleType/goalType where present).
//
// The Challenge module introduces ZERO new storage. Mastery, counts and
// completion are all derived from `satrw_progress_<student>`, which gate.js
// already scopes per student. Two students may hold the same set with wholly
// independent progress; the same bank question may appear in several sets.
// ─────────────────────────────────────────────────────────────────

window.CHALLENGE_SETS = {

    'Jeffrey': [
        {
            // `-rw` because his Practice 8 MATH misses are a separate set, in a
            // separate app: Michael SAT's Challenge_App/data/jeffrey.js.
            setId:  'p8-rw',
            title:  'Practice 8 misses',
            source: 'SAT Practice Test 8',
            date:   '2026-07-04',

            // Layer 1 — the debrief. 16 verbatim R&W misses, UNSCORED: these
            // ids are in no bank, so they never enter the mastery denominator.
            // The score report records 23 R&W incorrect, so 7 are absent.
            review: (typeof CHALLENGE_P8 !== 'undefined') ? CHALLENGE_P8 : null,

            // Layer 2 — FROZEN 10 July 2026 from challenge/shortlist-jeffrey-p8-rw.md.
            // 28 bank questions: siblings of his misses, matched on skill and (for
            // Conventions) ruleType, each skill carrying at least one Hard and one
            // Medium. Per-domain quotas come from the 4 July score-report bars, not
            // from the captured miss counts — the capture over-samples Standard
            // English Conventions (bar 5/7) and under-samples Information & Ideas
            // (bar 2/7). Selected with zero fallbacks: every id is an exact match.
            //
            // DO NOT EDIT. These ids are the denominator of "Mastered N of 28".
            // A new practice test appends a new set; it never rewrites this one.
            ids: [
                '0094f813', '084e8a77', '0252e6a1', '133abbda',
                '0b5ecf0e', '032fd227', '0c61d9c0', '105ea6de',
                '03080769', '17bf10de', '040583a5', '0c622cfb',
                '04cbeca3', '1d08c7ee', '03701ef3', '299c5303',
                '08395130', '350e2336', '0dba14e6', '3882ddf6',
                '10cd0327', '0778b4ac', 'c468db1c', 'c101fc44',
                '2bb7416a', '50801257', '67614549', 'de3dd17d',
            ],
        },
    ],

    'Bruce': [],
    'Gabe':  [],
    'Segun': [],
};
