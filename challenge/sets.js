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

        // ══════════════════════════════════════════════════════════════
        // kill-word-1 — one procedure, a teaching layer, then prior attempts
        // ══════════════════════════════════════════════════════════════
        //
        // TWO LAYERS, AND THE ORDER IS THE DESIGN (the shape of the sister app's
        // ci-claim-1):
        //
        //   `review` — 7 AUTHORED items, UNSCORED, never recorded. One worked example
        //     of the four steps (target · kill · split · clock), then one drill per
        //     rule. Written for this set, so none of them is in the bank and none can
        //     be drawn by a homework day. No personal names in any of them.
        //
        //   `ids` — 12 bank items, SCORED. Command of Evidence (textual 5, quantitative 1),
        //     Inferences 2, Words in Context 2, Central Ideas 2; Hard 8 : Medium 4. All
        //     twelve have an earlier attempt on this key, so they sit in the needsWork
        //     tier: homework days draw unseen questions first and will not reach them
        //     while a cell still has unseen supply. That is why this set spends none of
        //     the thin unseen Hard pools the days need.
        //
        // RULE 3 HOLDS: no id below appears in p8-rw, p11-rw, bnd-trn-aug or
        // ii-claim-aug23. Selection read by hand; ordered by skill, never shuffled.
        {
            setId:  'kill-word-1',
            title:  'KILL-WORD — one dead word kills the option',
            source: 'earlier sets \u2014 with seven teaching items to work first',
            date:   '2026-09-27',
            reviewLabel: 'Start here — the four steps',
            reviewIntro: 'Seven short items that teach the routine this set is built on: target, kill, split, clock. Work them first, with your tutor. Nothing here counts toward mastery.',
            reviewCta:   'Work the 7 teaching items',
            review: [
              {
                source: "Worked example — the four steps, with your tutor",
                skill: "Words in Context",
                passage: "The committee's report was notably ______: it listed the three budget options, noted the cost of each, and made no recommendation, leaving the choice entirely to the council.",
                question: "Which choice completes the text with the most logical and precise word?",
                options: ["A. partisan", "B. evasive", "C. impartial", "D. exhaustive"],
                answer: "C",
                strategy: "1 TARGET: before the options, say what the answer must do — here, a word for a report that lays out options and takes no side. 2 KILL: for each option, find one word the text cannot prove and cross it out. 3 SPLIT: if two survive, write the two words where they differ and find the line that decides. 4 CLOCK: a hard question answered in under a minute goes back to step 1 once.",
                explanation: "Choice C is correct. TARGET: a report that sets out options and takes no side. KILL: A, partisan, means taking a side — \"made no recommendation\" rules it out. D, exhaustive, means covering everything — the text says three options and nothing about all of them. SPLIT: B and C remain. Evasive means avoiding something you should answer; impartial means favouring no side. The deciding line is \"leaving the choice entirely to the council\": the choice belonged to the council, so the report dodged nothing. Impartial survives.",
              },
              {
                source: "Drill — rule 2: on-topic is not support",
                skill: "Command of Evidence — Textual",
                passage: "An ecologist studying hedgerows—rows of shrubs planted between farm fields—in western Kenya hypothesizes that hedgerows increase crop yields in nearby fields mainly because they shelter insects that pollinate the crops, rather than because they reduce wind damage.",
                question: "Which finding, if true, would most directly support the ecologist's hypothesis?",
                options: ["A. Fields bordered by hedgerows had higher yields than fields without hedgerows, whether or not the crops in them required insect pollination.", "B. In fields bordered by hedgerows, yields rose for crops that require insect pollination but did not rise for wind-pollinated crops grown under the same conditions.", "C. Hedgerows reduced wind speed in nearby fields by roughly 30 percent.", "D. Many species of pollinating insects were observed nesting in the hedgerows."],
                answer: "B",
                strategy: "Say the claim's prediction before the options: if pollinators are the reason, yields should rise for crops that need pollinators and not for crops that don't. Then finish this sentence for each option: \"If this is true, the claim is more likely because ___.\" If you cannot finish it, the option is dead, however on-topic it sounds.",
                explanation: "Choice B is correct: yields rose only for insect-pollinated crops, which is what the pollinator explanation predicts and the wind explanation does not. A kills itself with \"whether or not the crops required insect pollination\" — that points away from pollinators. C supports the rival cause, wind. D is the trap: insects nesting in hedgerows is on topic, but it says nothing about yield, so it cannot make the claim more likely.",
              },
              {
                source: "Drill — rule 1: paraphrase yes, new facts no",
                skill: "Inferences",
                passage: "A sociologist found that residents of towns that built public swimming pools in the 1950s reported stronger ties to their neighbors decades later than did residents of similar towns that did not build pools. But the sociologist also found that the towns that built pools had, even before construction, more active civic associations, which often led the campaigns for the pools. Therefore, the sociologist's findings ______",
                question: "Which choice most logically completes the text?",
                options: ["A. show that public pools weaken civic associations over time.", "B. suggest that the stronger neighborly ties may reflect the towns' existing civic activity rather than the pools alone.", "C. prove that swimming pools had no effect on residents' ties to their neighbors.", "D. indicate that towns without pools lacked civic associations entirely."],
                answer: "B",
                strategy: "The right completion is the smallest thing that must follow from the text. \"May\" and \"suggest\" are not weak words; they are exactly as strong as the evidence. Kill \"prove\", \"entirely\", and any cause or effect the text never gave.",
                explanation: "Choice B is correct. The pool towns already had more civic activity, so that earlier activity could explain the stronger ties — the text supports \"may reflect\" and no more. A invents an effect (\"weaken\"). C says \"prove … no effect\", far stronger than the text, which only raises a second explanation. D's \"entirely\" has no line behind it.",
              },
              {
                source: "Drill — step 3: two survivors",
                skill: "Words in Context",
                passage: "Although the novelist's early reviewers dismissed her plots as thin, later critics argued that the apparent simplicity was ______: beneath the uneventful surface, each chapter carefully planted details whose significance emerged only at the novel's end.",
                question: "Which choice completes the text with the most logical and precise word?",
                options: ["A. deceptive", "B. accidental", "C. tedious", "D. transparent"],
                answer: "A",
                strategy: "When two options survive, write the two words side by side and ask what each needs the text to say. \"Transparent\" needs the simplicity to be easy to see through; \"deceptive\" needs it to hide something. Then find the line that decides.",
                explanation: "Choice A is correct: \"beneath the uneventful surface, each chapter carefully planted details\" — the simple surface hid a design, so the simplicity was deceptive. D, transparent, means obvious, which is the opposite of hidden. B, accidental, is killed by \"carefully planted\". C, tedious, is the early reviewers' view, not the later critics'.",
              },
              {
                source: "Drill — both halves, right person",
                skill: "Command of Evidence — Textual",
                passage: "The following text is from a story written for this exercise. The narrator's younger brother is about to leave home to work on a merchant ship. In the text, the narrator suggests that she regards her brother's confidence as admirable but naive.",
                question: "Which quotation from the text most effectively illustrates the claim?",
                options: ["A. \"My brother spoke of the voyage as though the sea had already agreed to his plans, and I could not help loving him for it, though I knew the sea agreed to nothing.\"", "B. \"He had packed his trunk a full week before the ship was due, folding each shirt with great care.\"", "C. \"Our mother worried aloud that he was too young to go so far alone.\"", "D. \"I told him that I would write every Sunday, and he promised to answer every letter.\""],
                answer: "A",
                strategy: "A claim with two parts needs a quotation that shows both parts, held by the right person. Split the claim first: admirable (the narrator approves) and naive (the narrator sees he is wrong). One half, or the right feeling in the wrong person's mouth, is dead.",
                explanation: "Choice A shows both halves: \"I could not help loving him for it\" (admirable) and \"though I knew the sea agreed to nothing\" (naive). B shows him eager but gives no judgement by the narrator. C is the mother's worry, not the narrator's view. D shows no attitude toward his confidence at all.",
              },
              {
                source: "Drill — a level is not a change",
                skill: "Command of Evidence — Quantitative",
                passage: "Germination rate of two tomato varieties, by soil temperature — Red Pearl: 62% at 18°C, 91% at 26°C. Coastal: 78% at 18°C, 84% at 26°C. Researchers concluded that Red Pearl's germination depends more strongly on soil temperature than Coastal's does.",
                question: "Which choice most effectively uses the data to support the researchers' conclusion?",
                options: ["A. At 26°C, Red Pearl had a higher germination rate than Coastal did.", "B. At 18°C, Coastal had a higher germination rate than Red Pearl did.", "C. Raising soil temperature from 18°C to 26°C increased Red Pearl's germination rate by 29 percentage points but increased Coastal's by only 6 percentage points.", "D. Both varieties germinated at higher rates at 26°C than at 18°C."],
                answer: "C",
                strategy: "Name the comparison the claim needs before reading the options. \"Depends more strongly on temperature\" is about the change between conditions, compared across the two varieties — not about which is higher at one temperature.",
                explanation: "Choice C gives both changes: up 29 points for Red Pearl, up 6 for Coastal. A and B each report one level at one temperature, which cannot show dependence. D is true of both varieties, so it compares nothing.",
              },
              {
                source: "Drill — one link, and every fact must allow it",
                skill: "Inferences",
                passage: "Archaeologists excavating a ninth-century settlement found bones of fish species that live only in deep ocean water, although the settlement lies 40 kilometers inland and no boats or fishing equipment were found at the site. The researchers concluded that the settlement's residents most likely ______",
                question: "Which choice most logically completes the text?",
                options: ["A. built boats that have since decayed completely.", "B. obtained deep-sea fish from people living elsewhere, perhaps through trade.", "C. lived on the coast before moving inland.", "D. preferred deep-sea fish to freshwater fish."],
                answer: "B",
                strategy: "When the answer has to add something, it may add one link that every fact requires, and nothing a fact rules out. List the facts first, then test each option against every one of them.",
                explanation: "Choice B fits every fact: deep-sea fish bones, 40 kilometers inland, no boats, no fishing gear — the fish came from somewhere else. A needs boats, and none were found at an inland site. C and D invent a past move and a preference that no line mentions.",
              },
            ],
            ids: [
                // Command of Evidence — Textual: support, on-topic traps (5)
                '124fdcd7', 'dd1757fd', '44da37eb', '22e4d633', '29cde5fa',
                // Command of Evidence — Quantitative (1)
                'f8244f7c',
                // Inferences: invented cause, smallest conclusion (2)
                'f27559d4', 'f942646f',
                // Words in Context: two close survivors (2)
                '697dcd7e', 'da80d2c1',
                // Central Ideas: detail vs claim, wrong comparison (2)
                '4d3e3c52', '409058ee',
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
