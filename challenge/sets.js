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
        // p8-rw      (Practice 8)  retired 11 Aug 2026 — see challenge/_retired/p8-rw.md.
        // p11-rw     (Practice 11) retired 18 Aug 2026 — see challenge/_retired/p11-rw.md.
        // bnd-trn-aug (skill set)  retired 23 Aug 2026 — see challenge/_retired/bnd-trn-aug.md.
        // Removed from the roster, not edited: their ids stay reconstructable there.
        //
        /* RETIRED 23 AUG 2026 — see challenge/_retired/bnd-trn-aug.md
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
        END OF THE 18 AUG SET — RETIRED 23 AUG 2026 */

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

        // ── One set, committed 23 Aug 2026 ─────────────────────────────
        // A SKILL set, not a test set: selected from the bank by skill and
        // difficulty rather than from one test's verbatim misses, so it carries
        // no `review` layer. The schema allows that ("Omit when you only have a
        // score report") and challenge.js renders no debrief button without one.
        //
        // WHY THE ROSTER TURNED OVER. The set this replaces was punctuation and
        // transitions, and that work is finished. Two consecutive score reports
        // now state the first-module figure instead of leaving it to be
        // back-solved: 22 of 27, then 25 of 27, against back-solves near 16 in
        // early August. The grammar block is where the first module is won and
        // it has been won. What both reports also say is that the loss has moved
        // to the second module, which is the harder one and which no set on this
        // key has ever targeted. This set targets it.
        //
        // WHY HARD ONLY, AND IT IS THE POINT OF THE SET. Every set on this key
        // has mixed Easy, Medium and Hard. The second module is not mixed. A set
        // that averages three difficulties trains for a module that does not
        // exist, which is the likeliest reason the second module keeps arriving
        // as a surprise. All sixteen are Hard.
        //
        // WHY THIS SKILL. Information & Ideas is roughly a quarter of the
        // section and it printed 2 of 7 on the August report, its floor. It has
        // had no sustained teaching since 13 July, when it was designated
        // manage-not-solve — a judgement that was correct while the first module
        // was the constraint and is wrong now. A hard second module is
        // disproportionately built from this skill.
        //
        // SIXTEEN, NOT TWENTY-FOUR. MASTERY_THRESHOLD is 2 and requeue() cannot
        // promote within a sitting, so 16 ids is a floor of 32 attempts across at
        // least two sittings. Twenty days is what that fits, alongside a weekly
        // practice test and the maths work.
        //
        // ARCHETYPES — the selection is on the shape of the WRONG answer, because
        // the failure this set is built against is a first move, not a topic:
        // reading the options before the claim has been named.
        //   Inferences / Hard (6) — one per failure shape: ce4448b7 requires
        //     carrying the direction of a hypothesis the researchers expected to
        //     REVERSE; e185a21f offers a "must have" overreach beside the modest
        //     true reading; aaddd60f turns a negative premise into what follows,
        //     with an instrument-reliability option that changes the subject;
        //     3f236877 carries a confidentiality clause to an unintended
        //     consequence past two topic-plausible options; 4ba0695d turns on the
        //     DIRECTION of gene flow, i.e. which party the claim is about;
        //     95dbdf51 asks for a named theorist's logic applied to a case, so
        //     the claim to be extracted is the theory's, not the passage's.
        //   CoE — Textual / Hard (4) — 156ff681 is the only WEAKEN item here and
        //     is deliberately included: the direction of the task is exactly what
        //     a skipped claim loses. 09f9edb0 needs a finding about two named
        //     traditions that bears on homogenisation rather than on either one.
        //     63e7799d must distinguish between two competing mechanisms, not
        //     merely agree with the conclusion. c83e0b43 is a QUOTATION item
        //     rather than a finding item — the second module mixes the two.
        //   CoE — Quantitative / Hard (3) — the standing gap: zero converted in
        //     July. Each has a distractor that is TRUE ON THE TABLE and does not
        //     bear on the claim, which is the trap named in his own handout.
        //     b2e54b50 is correlations, where the comparison is distance from
        //     zero and two of the values are negative; 2c06139b is two variables
        //     across three conditions, where the largest difference is not the
        //     supporting one; 56f477fb is a subgroup-versus-overall percentage.
        //   Central Ideas / Hard (3) — d1b8a9ad is the true-but-narrow detail
        //     against the whole-text point; 35b46381 is a granted-concession
        //     structure ("having granted that…") in dense science prose;
        //     1a2b29c9 is literary and turns on tone, which the second module
        //     always carries and which no recent set has held.
        //
        // WHAT IS DELIBERATELY ABSENT. Boundaries, Transitions and the rest of
        // Expression of Ideas. Not because they are mastered outright, but
        // because 25 of 27 leaves four points there and this set has twenty days.
        //
        // EXCLUSIONS APPLIED at selection: every id in p8-rw, p11-rw and
        // bnd-trn-aug, live or retired, and the ids worked in the 17 Aug class.
        // Rule 3 holds — no id below appears in any other set on this key.
        // Ids held on OTHER keys are not excluded and must not be: the schema
        // says the same bank question may appear in several sets, and per-student
        // progress is independent.
        //
        // POOL NOTE FOR THE NEXT SET, counted net of this key's exclusions.
        // Hard remaining after this draw: Inferences 16, CoE-Textual 13,
        // Central Ideas 11, and CoE — QUANTITATIVE 2. ⚠️ CoE-Q IS NOW THE THIN
        // POOL ON THIS KEY — two Hard items left and nothing in the bank
        // replaces them. A future set or homework section asking for CoE-Q at
        // Hard will backfill and test nothing. Draw it at Medium, or draw it
        // from a fresh import.
        //
        // ORDER IS DELIBERATE: the four skills alternate so that a first session
        // drawn off the top at the default 10 meets every one of them — the
        // first ten below are 3 Inferences, 3 CoE-Textual, 2 CoE-Quantitative
        // and 2 Central Ideas. buildQueue() reorders by ledger state, so this
        // governs the first pass only, which is the one that happens tonight.
        //
        // DO NOT EDIT. These ids are the denominator of "Mastered N of 16".
        {
            setId:  'ii-claim-aug23',
            title:  'Information and Ideas — name the claim before you look',
            source: 'Information & Ideas, Hard only, selected on the shape of the wrong answer',
            date:   '2026-08-23',
            ids: [
                // Inferences — a reversed hypothesis (1)
                'ce4448b7',
                // CoE — Textual — WEAKEN, not support (1)
                '156ff681',
                // CoE — Quantitative — correlations, distance from zero (1)
                'b2e54b50',
                // Central Ideas — the true-but-narrow detail (1)
                'd1b8a9ad',
                // Inferences — "must have" overreach beside the modest reading (1)
                'e185a21f',
                // CoE — Textual — bears on homogenisation, not on either tradition (1)
                '09f9edb0',
                // CoE — Quantitative — two variables, three conditions (1)
                '2c06139b',
                // Central Ideas — granted concession, dense science prose (1)
                '35b46381',
                // Inferences — negative premise, and a change-of-subject option (1)
                'aaddd60f',
                // CoE — Textual — distinguishes two competing mechanisms (1)
                '63e7799d',
                // CoE — Quantitative — subgroup versus overall percentage (1)
                '56f477fb',
                // Central Ideas — literary, and it turns on tone (1)
                '1a2b29c9',
                // Inferences — a clause carried to an unintended consequence (1)
                '3f236877',
                // CoE — Textual — a QUOTATION item, not a finding item (1)
                'c83e0b43',
                // Inferences — the direction of the transfer (1)
                '4ba0695d',
                // Inferences — apply the named theorist's logic, not the passage's (1)
                '95dbdf51',
            ],
        },
    ],

    'Bruce': [
        // ── One set, committed 19 Aug 2026 ─────────────────────────────
        // A SKILL set, not a test set. No practice test has landed since 25 Jul,
        // so there are no verbatim misses to debrief and no `review` layer —
        // the schema allows that and challenge.js renders no debrief button
        // without one. Selected from the bank by ruleType and by the shape of
        // the options, on the four families worked in the 19 Aug class.
        //
        // ONE SET ONLY. boot() takes sets[sets.length - 1] and there is no
        // picker, so a second entry here would be unreachable. #cHowMany
        // defaults to 10, and the set is not finished until all 14 are
        // mastered, so it is worked across several sittings by design.
        //
        // THE FOUR FAMILIES, and why these are one set and not four:
        //
        //   COMPLEX LIST — a list whose items already contain commas, so the
        //   separators must become semicolons. Three items exist in the bank
        //   that genuinely test it; 5cc85f01 is the control that LOOKS like one
        //   and is not.
        //
        //   THE ADVERB IN THE JOINT — however, though, rather. These are not
        //   coordinating conjunctions and cannot join two complete clauses. The
        //   question is always which clause the word belongs to, decided before
        //   the mark is chosen. Four items, and the options differ only by where
        //   the word sits.
        //
        //   NO MARK AT ALL — the blank falls mid-clause, or the following name
        //   is essential to identifying the noun. The empty option is the
        //   answer in every one of these. It is ~1 in 5 of the Boundaries bank
        //   and it is the family most often walked past.
        //
        //   COLON AND DASH — the two thinnest rule pools, and the ones a
        //   flowchart drilled on comma/semicolon never reaches. 707461d8 puts a
        //   closing parenthesis against a sentence boundary; c8540a5b offers a
        //   bracket, a dash, a comma and nothing for the same slot.
        //
        // WHY MEDIUM IS ONLY 4 OF 14. Every family above is decided by a rule,
        // not by judgement, so difficulty here is the number of competing rules
        // in the options rather than the reading load. The Hard items are the
        // ones where two families collide, which is the whole point of the set.
        //
        // THREE OF THESE HAVE BEEN SERVED ON THIS KEY BEFORE (c04e9136,
        // 790fc366, 403d7bb5) and were the anchors of a class. A first correct
        // on a recently worked item can be recall rather than retrieval, which
        // is exactly what the two-correct rule is for: MASTERY_THRESHOLD is 2
        // and REATTEMPT_ORDER sends a correct-once question to the back of the
        // queue, so the confirming pass lands a sitting or more later. Repeats
        // are the design here, not contamination.
        //
        // DELIBERATELY EXCLUDED: 59094d87 (comma + coordinating conjunction).
        // It was the fourth miss of 18 Aug, but it is the one rule of the four
        // that is not in dispute, and a set that includes it invites the
        // flowchart back in. RESERVE, if a 15th is ever wanted: 6d4b2e1e — the
        // essential-appositive sibling of 80aa7690.
        //
        // ⚠️ POOL NOTE FOR THE NEXT SET. This takes FIVE OF THE SIX Semi items
        // in the bank; only 1724dac2 (Easy) remains. It also takes 4 of 12
        // NoPunct, 1 of 4 Colon and 2 of 6 Dash. NO FUTURE SET OR HOMEWORK DAY
        // CAN DRAW ruleType:"Semi" — a section asking for it will silently
        // backfill from Commas and test nothing. Commas (33) is the only deep
        // Boundaries pool left.
        //
        // DO NOT EDIT. These ids are the denominator of "Mastered N of 14".
        {
            setId:  'bnd-aug19',
            title:  'Punctuation — the four that are not on the flowchart',
            source: 'Conventions, selected on ruleType and on the shape of the options',
            date:   '2026-08-19',
            ids: [
                // Complex list — items carrying their own commas (3)
                'c04e9136', '78b88c04', '5cc85f01',
                // The adverb in the joint — however, though, rather (4)
                '790fc366', 'f78997cf', '2bb7416a', 'a9e5b788',
                // No mark at all — mid-clause, and the essential name (4)
                '403d7bb5', '80aa7690', '6ea8c23f', '594b4a94',
                // Colon and dash — the thin pools (3)
                'c468db1c', '707461d8', 'c8540a5b',
            ],
        },
    ],
    'Gabe':  [],
    'Segun': [
        // ── One set, committed 18 Aug 2026 ─────────────────────────────
        // A SKILL set, not a test set: selected from the bank by skill, difficulty
        // and archetype rather than from one test's verbatim misses, so it carries
        // no `review` layer. The schema allows that ("Omit when you only have a
        // score report") and challenge.js renders no debrief button without one.
        // No full question-level report has ever arrived for this key; only a
        // score and a partial list, which is not a set of verbatim misses.
        //
        // WHY ONE SET AND NOT THREE. boot() takes sets[sets.length - 1]. There is
        // no picker, no query param and no way to reach an earlier entry, so a
        // second set would be unreachable until a mid-week edit swapped it in —
        // a code change days before an exam, on a file whose ids are immutable.
        // #cHowMany sets the session size and defaults to 10, and the set is not
        // finished until all 16 are mastered, so it is worked across sittings by
        // design. Every skill gets contact on night one instead of waiting.
        //
        // SIXTEEN, NOT TWENTY-FOUR. MASTERY_THRESHOLD is 2 and requeue() cannot
        // promote within a sitting, so 16 ids is a floor of 32 attempts across at
        // least two sittings. Four days is what that fits.
        //
        // ARCHETYPES, which is what the selection is actually on:
        //   Words in Context / Medium (4) — in every one the defining phrase sits
        //     in the NEXT clause or the next sentence, and a topic-plausible
        //     option is available to anyone who answers from the subject matter
        //     instead. 340b33cd and f1be2bd1 additionally turn on a second sense
        //     of a common word. The twin records now canonicalized as eb59336c and
        //     e1474ac4 are duplicate
        //     items and are excluded; take only one of a pair.
        //   Inferences / Hard (4) — one per failure shape, deliberately: a13c1c66
        //     offers two true generalities that answer a different question;
        //     58e9e497 requires carrying an exclusion ("barring the possibility");
        //     4b3d6062 has a directionally-right but incomplete option beside the
        //     complete one; 6b8a7c74 turns on which party the claim is about.
        //   Rhetorical Synthesis / Hard (4) — selected so that no two share a goal
        //     verb: generalise-and-support, quote-to-show-a-problem, emphasise a
        //     RELATIVE quantity, identify an accomplishment. In each, at least one
        //     option is accurate about the notes and off-task for the goal.
        //   CoE — Quantitative / Hard (2) — 040583a5 is the only two-series graph
        //     in the free pool (axis plus legend, not one row); cca6fae9 is a
        //     four-column table containing a "no data available" cell.
        //   Form, Structure & Sense / Hard, ruleType Mod (2) — both put the
        //     modifier in first position with the subject choice after the comma,
        //     one appositive list and one participial. Mod is Easy 0, Medium 2,
        //     Hard 10 bank-wide, so Hard is the only tier that can carry it.
        //
        // WHAT IS DELIBERATELY ABSENT. Cross-Text, Central Ideas and CoE-Textual
        // are not here: they were all drawn at Hard on this key on 17 Aug and the
        // set has four days to cover ground those draws did not. Boundaries is
        // not here either — free Semi/Hard on this key is ONE item, which cannot
        // carry a scored slot, and Commas is the only deep family left.
        //
        // EXCLUSIONS APPLIED at selection: all 94 ids ever served on this key,
        // read from the question export. Rule 3 is vacuous here — this is the
        // first set on the key — but it binds the next one, which must exclude
        // these 16 as well.
        //
        // POOL NOTE FOR THE NEXT SET, counted net of the 94: this takes 4 of 30
        // free WiC Medium, 4 of 20 Inferences Hard, 4 of 15 RS Hard, 2 of 7
        // CoE-Q Hard and 2 of 9 Mod Hard. CoE-Q is the one to watch — 5 Hard and
        // 3 Medium remain and nothing else in the bank replaces them.
        //
        // ORDER IS DELIBERATE: the five skills alternate so that a first session
        // drawn off the top at the default 10 meets every one of them.
        // buildQueue() reorders by ledger state, so this governs the first pass
        // only — which is the one that happens tonight.
        //
        // DO NOT EDIT. These ids are the denominator of "Mastered N of 16".
        {
            setId:  'read-syn-aug',
            title:  'Reading and synthesis — finish the sentence before you look',
            source: 'Craft & Structure, Information & Ideas and Expression of Ideas, selected on archetype',
            date:   '2026-08-18',
            ids: [
                // Words in Context, Medium — the defining phrase is not in the clause with the blank (2)
                '340b33cd', 'eb59336c',
                // Inferences, Hard — true-but-off-task, and a carried exclusion (2)
                'a13c1c66', '58e9e497',
                // Rhetorical Synthesis, Hard — generalise-and-support, quote-to-show-a-problem (2)
                'b0620764', 'fdd9a360',
                // CoE — Quantitative, Hard — two-series graph, axis and legend (1)
                '040583a5',
                // Form, Structure & Sense, Hard, Mod — appositive list before the subject (1)
                '5b8f9cf2',
                // Words in Context, Medium — second sense of a common word (2)
                '3067b065', 'f1be2bd1',
                // Inferences, Hard — incomplete vs complete, and which party (2)
                '4b3d6062', '6b8a7c74',
                // Rhetorical Synthesis, Hard — a RELATIVE quantity, and one accomplishment (2)
                '5fa51c86', '87d34a39',
                // CoE — Quantitative, Hard — table with a missing cell (1)
                'cca6fae9',
                // Form, Structure & Sense, Hard, Mod — participial before the subject (1)
                'd2b81427',
            ],
        },
    ],
};
