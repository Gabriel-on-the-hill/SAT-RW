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
        // p8-rw  (Practice 8)  retired 11 Aug 2026 — see challenge/_retired/p8-rw.md.
        // p11-rw (Practice 11) retired 18 Aug 2026 — see challenge/_retired/p11-rw.md.
        // Removed from the roster, not edited: their ids stay reconstructable there.
        //
        // ── One set, committed 18 Aug 2026 ─────────────────────────────
        // A SKILL set, not a test set: selected from the bank by ruleType and by
        // category rather than from one test's verbatim misses, so it carries no
        // `review` layer. The schema allows that ("Omit when you only have a
        // score report") and challenge.js renders no debrief button without one.
        //
        // WHY ONE SET AND NOT TWO. This was authored as a punctuation set of 10
        // and a transitions set of 8. Only one can ever be served: boot() takes
        // sets[sets.length - 1], and there is no picker, no query param and no
        // way to reach an earlier entry. Two sets would have meant the second
        // one being unreachable until a mid-week edit swapped them over — a code
        // change three days before an exam, on a file whose ids are immutable.
        //
        // The module already solves this. #cHowMany sets the session size and
        // defaults to 10, and the set is "not finished until all 18 are
        // mastered", so it is worked across several sittings by design. Both
        // skills also get contact on night one instead of transitions waiting
        // two days, which matters because the class reached eight punctuation
        // items and only two transitions.
        //
        // EXCLUSIONS APPLIED at selection: the 22 ids of p11-rw, the 28 ids of
        // p8-rw, and the 16 ids worked in the 17 Aug class. Rule 3 holds — no id
        // below appears in any other set on this key, live or retired.
        {
            setId:  'bnd-trn-aug',
            title:  'Punctuation and transitions — name it before you look',
            source: 'Conventions and Expression of Ideas, selected on ruleType and category',
            date:   '2026-08-18',

            // ── Punctuation (10) ──────────────────────────────────────
            // NO COLON ITEM, and it is not an oversight. Colon is 1 Medium and
            // 2 Hard bank-wide; p8-rw holds two of those three, and the
            // remaining Hard item (fba5d8d1) is the only unseen colon question
            // in the bank. A one-item pool cannot support a scored set.
            //
            // SPLIT BY ruleType so the draw exercises the branch decision rather
            // than defaulting to commas, which is 33 of the 61 Boundaries items.
            // Semi/Hard takes the largest quota: it is the most rule-bound
            // family in the bank and therefore the cheapest per repetition — the
            // same repetitions-to-learn weighting used on p11-rw.
            //
            // 78e978b5 is tagged NoPunct but tests the colon boundary from the
            // other side: the list is not preceded by a complete clause. It is
            // the closest the unseen pool gets to the colon rule.
            //
            // ── Transitions (8) ───────────────────────────────────────
            // SELECTED ON CATEGORY, NOT DIRECTION. In every one, at least two
            // options share the direction of the answer and differ only in
            // category — concession, emphasis, restatement, result. 176edca6 and
            // 974b5a8c turn on a concession word against a contrast that reads
            // more naturally; e3edc138 and 2df7b582 turn on restatement. A
            // same-or-opposite reading does not resolve any of them.
            //
            // RELEASES THE 20 IDS RESERVED BY THE LEGACY `transitions` ENTRY in
            // HW_ASSIGNMENTS. The hub and the runner read the per-student plans
            // in HOMEWORK, not that catalogue, so those ids have never been
            // servable on this key. p11-rw excluded them as a precaution;
            // honouring it here leaves 2 Medium and 1 Hard free, which is not a
            // set. Eight are taken; twelve remain if that entry is ever wired
            // into a plan.
            //
            // POOL NOTE FOR THE NEXT SET: this takes 3 of the 4 free Semi/Hard
            // and 2 of the 3 free Dash/Hard. Commas is the only deep Boundaries
            // pool left — Medium 10, Hard 8 free after this.
            //
            // ORDER IS DELIBERATE: the two skills alternate in blocks rather
            // than running 10 then 8, so a short session drawn off the top meets
            // both. buildQueue() reorders by ledger state, so this only governs
            // the very first pass — which is the one that happens tonight.
            //
            // DO NOT EDIT. These ids are the denominator of "Mastered N of 18".
            ids: [
                // Semi — two independent clauses, adverb in the joint (4)
                '790fc366', 'f78997cf', 'a9e5b788', '78b88c04',
                // Transitions Hard — concession and restatement vs a contrast pull (4)
                '176edca6', '974b5a8c', 'e3edc138', '2df7b582',
                // NoPunct — no mark belongs at the break (3)
                '78e978b5', '403d7bb5', '6d4b2e1e',
                // Transitions Medium — category discrimination (4)
                '221ecf0f', 'f8c4591b', '3fd0ab63', '17e49403',
                // Dash — paired, never mixed with a comma (2)
                '109d5bbb', '1aa3f174',
                // Commas (1)
                '5670a657',
            ],
        },

        /* RETIRED 18 AUG 2026 — see challenge/_retired/p11-rw.md
        {
            setId:  'p11-rw',
            title:  'Practice 11 misses',
            source: 'SAT Practice Test 11',
            date:   '2026-08-08',

            // Layer 1 — the debrief. 17 verbatim R&W misses, UNSCORED: these ids
            // are in no bank, so they never enter the mastery denominator. The
            // score report records 17 R&W incorrect, so the capture is complete
            // in count. TWO ARE PARTIAL and flagged `partial: true` in the data
            // file — one is missing options C and D, one has its figure only.
            review: (typeof CHALLENGE_P11 !== 'undefined') ? CHALLENGE_P11 : null,

            // Layer 2 — FROZEN 9 August 2026 from
            // "Jeffrey Ejike/Jeffrey_p11rw_Shortlist_2026-08-09.md".
            // 22 bank questions: siblings of the misses, matched on skill,
            // difficulty, and — where the bank carries them — ruleType and
            // goalType. Exclusion list was the 251 ids in the app's own question
            // export, the 28 ids of p8-rw above, the 20 ids reserved by the
            // standing Transitions Homework assignment, and one item that the
            // export could not know about because it was worked in a session.
            //
            // WEIGHTED BY REPETITIONS-TO-LEARN, NOT BY MISS COUNT. Rule-bound
            // skills need few reps and get few slots; procedural skills
            // (both Commands of Evidence, Rhetorical Synthesis, Transitions)
            // carry the set. Inferences is deliberately BELOW its miss count:
            // judgement does not automate with repetition, and the unseen pool
            // is two deep at Medium.
            //
            // POOL NOTE FOR WHOEVER BUILDS p12: this set takes BOTH remaining
            // unseen verb-tense items and the last unseen Hard Quantitative
            // item. A next set cannot repeat this shape. Conventions still holds
            // nine unseen Boundaries at Medium/Hard — move the quota there.
            //
            // DO NOT EDIT. These ids are the denominator of "Mastered N of 22".
            ids: [
                // Command of Evidence — Textual (4)
                'e946a32e', 'dc87adf4', '87023f34', '5d6ab069',
                // Command of Evidence — Quantitative (4)
                '626a1308', 'a9ac31e4', '89f71526', 'a9040290',
                // Central Ideas and Details (3)
                '14189fbb', '96802cc0', '659c6c1d',
                // Inferences (2)
                'f1bfbed3', 'db876fd5',
                // Transitions (2)
                'ad729337', '11df9b99',
                // Rhetorical Synthesis (2) — both goalType: Compare
                'c34d6bff', '1b94a80a',
                // Words in Context (2)
                'ae31c343', 'a5831311',
                // Text Structure and Purpose (1)
                'fca04045',
                // Form, Structure & Sense — verb tense (2)
                'd46ac7e7', 'db2e480a',
            ],
        },
        */
    ],

    'Bruce': [],
    'Gabe':  [],
    'Segun': [],
};
