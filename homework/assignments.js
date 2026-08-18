// ─────────────────────────────────────────────────────────────────
// homework/assignments.js — catalog of all homework assignments.
//
// ⚠ THE STUDENT CAN READ THIS FILE. homework-hub.html, homework-run.html and
// progress.html all load it, so his browser downloads the whole thing —
// comments included, and every student's plan, not just his own.
//
// Nothing in here may assess a student: not what they failed to do, not what
// they cannot yet do, not what we think is really going on. That reasoning
// lives in homework/PLAN-NOTES.md, which the app never loads. Comments here
// are for whoever edits the file next, and they stay impersonal.
//
// The three strings a student actually sees are `title`, `day.focus` and
// `day.tip`. Write them as instruction TO him, never as assessment OF him.
//
// ── SPACED REVIEW: read this before you write the next plan ────────
//
// Every day now serves up to 2 REVIEW questions on top of its own draw, pulled by
// dueForReview() from the WHOLE bank — across skills and across difficulties. It is
// the only draw that can do that. A day narrows the bank to (say) "Words in Context
// / Hard" before prioritizePool() ever sees the pool, so a due Text Structure
// question, or a Medium miss on a Hard-only day, cannot surface there at any sort
// order. Without this, nothing taught a month ago ever came back. It didn't.
//
// It only ever returns questions that have ALREADY been attempted and that the
// ladder in progress.js says are genuinely overdue. It never serves an unseen
// question, so it cannot hand anyone an untaught skill cold.
//
// THE DOSE resolves day → plan → 2 (the default).
//   • Write a new plan and do nothing: it gets review. That is deliberate. Spacing
//     should be what happens when the tutor forgets, not a thing to remember.
//   • `review: 0` on a DAY whose job is to teach one brand-new skill and needs the
//     full dose on it.
//   • `review: 0` on a PLAN freezes it entirely — which is why the plans below carry
//     it. They were already running when the ladder landed, and no set should grow by
//     two questions overnight. **Drop the line when you next re-assign.**
//
// AUTHOR THE COUNTS AROUND IT. A six-question day is now 4 new + 2 review, not 6 + 2.
// Short sets that get finished still beat long sets that get abandoned.
//
// Each entry defines ONE homework drill. The homework-run.html page
// reads `?assignment=<id>` from its URL and uses the matching entry
// to drive the entire session.
//
// To add a new homework: append a new object below. No HTML/JS edits
// elsewhere — homework-hub.html lists every entry automatically and
// homework-run.js applies the config generically.
//
// Schema:
//   id           — string, URL-safe. Used in ?assignment=<id> and as
//                  the per-assignment localStorage key suffix.
//   title        — short display name (e.g. shown on hub card + page logo).
//   description  — one-line summary shown on the hub card.
//   bank         — name of the global question-bank variable to draw
//                  from: 'EOI' | 'CON' | 'II' | 'CS'.
//   storageKey   — localStorage key for in-progress session state
//                  (per-assignment so multiple homeworks can coexist).
//   sections     — array of section configs. Each section:
//                    skill       — string (matches question.skill)
//                    difficulty  — 'Easy' | 'Medium' | 'Hard'
//                    strategy    — short label shown on section card
//                    count       — number of questions to pick
//                    ids         — optional curated id list (drained first)
//                    ruleWeights — optional { ruleType: count, ... }
//                                  for SEC-style sub-rule targeting
//   skillAbbr    — optional { 'Long Skill Name': 'Abbr' } for badges
// ─────────────────────────────────────────────────────────────────

const HW_BANK_LOOKUP = {
    EOI: () => (typeof questionBank_EOI !== 'undefined' ? questionBank_EOI : []),
    CON: () => (typeof questionBank_CON !== 'undefined' ? questionBank_CON : []),
    II:  () => (typeof questionBank_II  !== 'undefined' ? questionBank_II  : []),
    CS:  () => (typeof questionBank_CS  !== 'undefined' ? questionBank_CS  : []),
};

const HW_ASSIGNMENTS = [
    {
        id:          'transitions',
        title:       'Transitions Homework',
        description: '20 questions · Transitions · 8 Medium · 12 Hard',
        bank:        'EOI',
        storageKey:  'hw_run_transitions',
        skillAbbr:   { 'Transitions': 'Trans' },
        sections: [
            {
                skill: 'Transitions', difficulty: 'Medium',
                strategy: '4 Logical Relationships',
                count: 8,
                ids: ['39d1a519','221ecf0f','30438650','388b45aa','3fd0ab63','f8c4591b','17e49403','0c13dea9'],
            },
            {
                skill: 'Transitions', difficulty: 'Hard',
                strategy: '4 Logical Relationships',
                count: 12,
                ids: ['2df7b582','c071eca2','ecb31049','00221c00','f5959727','176edca6','974b5a8c','6e0c60da','9f1a0d91','edf30612','47e238be','e3edc138'],
            },
        ],
    },
    {
        id:          'sec',
        title:       'SEC Homework',
        description: '30 questions · Boundaries + Form, Structure & Sense · 2 Easy · 13 Medium · 15 Hard',
        bank:        'CON',
        storageKey:  'hw_run_sec',
        skillAbbr: {
            'Boundaries':                 'Bnd',
            'Form, Structure, and Sense': 'FSS',
        },
        sections: [
            {
                skill: 'Boundaries', difficulty: 'Medium',
                strategy: 'The Decision Flowchart',
                count: 7,
                ruleWeights: { Semi: 1, Colon: 1, Commas: 4, NoPunct: 1 },
            },
            {
                skill: 'Boundaries', difficulty: 'Hard',
                strategy: 'The Decision Flowchart',
                count: 8,
                ruleWeights: { Semi: 3, Colon: 2, Commas: 2, Dash: 1 },
            },
            {
                skill: 'Form, Structure, and Sense', difficulty: 'Easy',
                strategy: 'Apply the Sub-Rule',
                count: 2,
                ruleWeights: { Poss: 1, SVA: 1 },
            },
            {
                skill: 'Form, Structure, and Sense', difficulty: 'Medium',
                strategy: 'Apply the Sub-Rule',
                count: 6,
                ruleWeights: { Mod: 2, Poss: 2, SVA: 2 },
            },
            {
                skill: 'Form, Structure, and Sense', difficulty: 'Hard',
                strategy: 'Apply the Sub-Rule',
                count: 7,
                ruleWeights: { Mod: 4, Poss: 1, SVA: 2 },
            },
        ],
    },
    {
        id:          'ii',
        title:       'Info & Ideas Homework',
        description: '15 questions · Central Ideas + CoE-Textual + CoE-Quantitative · 3 Easy · 8 Medium · 4 Hard · ~20 min',
        note:        'You can take this set more than once. Each attempt gives you new questions, so come back to it whenever you want more practice.',
        bank:        'II',
        storageKey:  'hw_run_ii',
        skillAbbr: {
            'Central Ideas and Details':         'CI',
            'Command of Evidence — Textual':     'CoE-T',
            'Command of Evidence — Quantitative':'CoE-Q',
        },
        // No curated `ids`: questions are drawn from the full pool by
        // (skill, difficulty) and ordered unseen-first, so re-running the
        // set serves fresh questions each time.
        sections: [
            { skill: 'Central Ideas and Details',          difficulty: 'Easy',   strategy: 'Claim → Broadest Accurate Statement', count: 1 },
            { skill: 'Central Ideas and Details',          difficulty: 'Medium', strategy: 'Claim → Broadest Accurate Statement', count: 3 },
            { skill: 'Central Ideas and Details',          difficulty: 'Hard',   strategy: 'Claim → Broadest Accurate Statement', count: 1 },
            { skill: 'Command of Evidence — Textual',      difficulty: 'Easy',   strategy: 'Support Check', count: 1 },
            { skill: 'Command of Evidence — Textual',      difficulty: 'Medium', strategy: 'Support Check', count: 4 },
            { skill: 'Command of Evidence — Textual',      difficulty: 'Hard',   strategy: 'Support Check', count: 2 },
            { skill: 'Command of Evidence — Quantitative', difficulty: 'Easy',   strategy: 'Data-to-Claim Match', count: 1 },
            { skill: 'Command of Evidence — Quantitative', difficulty: 'Medium', strategy: 'Data-to-Claim Match', count: 1 },
            { skill: 'Command of Evidence — Quantitative', difficulty: 'Hard',   strategy: 'Data-to-Claim Match', count: 1 },
        ],
    },
    {
        id:          'boundaries',
        title:       'Boundaries Homework',
        description: '20 questions · Boundaries only · 4 Easy · 10 Medium · 6 Hard',
        bank:        'CON',
        storageKey:  'hw_run_boundaries',
        skillAbbr:   { 'Boundaries': 'Bnd' },
        sections: [
            {
                skill: 'Boundaries', difficulty: 'Easy',
                strategy: 'The Decision Flowchart',
                count: 4,
            },
            {
                skill: 'Boundaries', difficulty: 'Medium',
                strategy: 'The Decision Flowchart',
                count: 10,
            },
            {
                skill: 'Boundaries', difficulty: 'Hard',
                strategy: 'The Decision Flowchart',
                count: 6,
            },
        ],
    },
    {
        id:          'wic',
        title:       'Words in Context Homework',
        description: '30 questions · Words in Context · 6 Easy · 15 Medium · 9 Hard',
        bank:        'CS',
        storageKey:  'hw_run_wic',
        skillAbbr:   { 'Words in Context': 'WIC' },
        sections: [
            {
                skill: 'Words in Context', difficulty: 'Easy',
                strategy: 'Two-Filter Method',
                count: 6,
            },
            {
                skill: 'Words in Context', difficulty: 'Medium',
                strategy: 'Two-Filter Method',
                count: 15,
            },
            {
                skill: 'Words in Context', difficulty: 'Hard',
                strategy: 'Two-Filter Method',
                count: 9,
            },
        ],
    },
    {
        id:          'ii-hard',
        title:       'Info & Ideas — Hard (Inference Focus)',
        description: '30 questions · all Hard · 12 Inference · 8 CoE-Textual · 6 Central Ideas · 4 CoE-Quantitative',
        bank:        'II',
        storageKey:  'hw_run_ii_hard',
        skillAbbr: {
            'Inferences':                        'Inf',
            'Command of Evidence — Textual':     'CoE-T',
            'Central Ideas and Details':         'CID',
            'Command of Evidence — Quantitative':'CoE-Q',
        },
        sections: [
            {
                skill: 'Inferences', difficulty: 'Hard',
                strategy: 'Inference Ceiling — grounded, not too extreme',
                count: 12,
            },
            {
                skill: 'Command of Evidence — Textual', difficulty: 'Hard',
                strategy: 'Support Check — direct textual support',
                count: 8,
            },
            {
                skill: 'Central Ideas and Details', difficulty: 'Hard',
                strategy: 'Main Idea — broadest accurate statement',
                count: 6,
            },
            {
                skill: 'Command of Evidence — Quantitative', difficulty: 'Hard',
                strategy: 'Data-to-Claim Match — read the figure first',
                count: 4,
            },
        ],
    },
];

// Helper used by hub + runner.
function hwGetAssignment(id) {
    return HW_ASSIGNMENTS.find(a => a.id === id) || null;
}

// ══════════════════════════════════════════════════════════════════
// PER-STUDENT DAILY HOMEWORK  (per-student plans that unlock by date)
// ------------------------------------------------------------------
// The tutor "assigns" by adding an entry below, keyed to the student's
// name (the name their password maps to in gate.js — Jeffrey, Bruce,
// Gabe, Segun). Build entries painlessly with assign.html — no need to
// hand-edit. This sits alongside the shared HW_ASSIGNMENTS catalog
// above; the homework hub/runner use the per-student plans below.
//
// UNLOCK — `sequential` is the default and what new plans should use:
//   unlock: "sequential"  Set 1 is open; each later set opens when the
//                         one before it is submitted. Pair it with
//                         `through: "YYYY-MM-DD"` — the hub then tells
//                         the student the window the sets are meant to
//                         be spread over, so nothing pushes them to do
//                         the lot in one sitting. See hwDayOpen().
//   unlock: "cumulative"  Legacy: one set per calendar day from `start`,
//                         missed days stay open.
//
// Where plans come from:
//   HW_USE_SHEET = false → from this file (reliable, instant, no backend) ← default
//   HW_USE_SHEET = true  → fetched from the tutor's Google Sheet "Plans" tab
// The homework/session LOG to the sheet works either way (sheet-sync.js).
// ══════════════════════════════════════════════════════════════════
const HOMEWORK = {
  // Sample plan — edit or replace. Use assign.html to generate new ones.
  "Gabe": {
    title: "This week — mixed Reading & Writing review",
    start: "2026-06-22",      // YYYY-MM-DD: the day Day 1 becomes available
    unlock: "cumulative",     // missed days stay open
    review: 0,                // ← FROZEN (predates the ladder). Drop this line when you re-assign.
    days: [
      { n:1, focus:"Transitions",        skills:["Transitions"], diffs:["Easy","Medium"], count:6, minutes:0,
        tip:"Name the connection between the two sentences before you look at the choices." },
      { n:2, focus:"Boundaries",         skills:["Boundaries"], diffs:["Easy","Medium"], count:6, minutes:0,
        tip:"Decide whether each part is a complete sentence, then walk the punctuation flowchart." },
      { n:3, focus:"Words in Context",   skills:["Words in Context"], diffs:["Easy","Medium"], count:6, minutes:0,
        tip:"Cover the blank, predict your own word, then match it to a choice." },
      // Days 4-6 name more than one skill, so they MUST use sections. A plain
      // skills/diffs/count day draws from one ordered pool and takes the top N, which
      // clusters — day 6 was serving six questions of a single skill, not a mix.
      // Same skills, same difficulties, same totals; sections just make the mix real.
      { n:4, focus:"Information & Ideas", minutes:0,
        sections:[
          { skills:["Central Ideas and Details"], diffs:["Medium"], count:4 },
          { skills:["Inferences"],                diffs:["Medium"], count:4 },
        ],
        tip:"For the main idea, cover the whole text. For inferences, stay close to what the text says." },
      { n:5, focus:"Command of Evidence", minutes:0,
        sections:[
          { skills:["Command of Evidence — Textual"],      diffs:["Medium"], count:4 },
          { skills:["Command of Evidence — Quantitative"], diffs:["Medium"], count:4 },
        ],
        tip:"Match the evidence to the whole claim. Read the figure before the choices." },
      { n:6, focus:"Mixed review", minutes:0,
        sections:[
          { skills:["Transitions"],      diffs:["Easy","Medium","Hard"], count:2 },
          { skills:["Boundaries"],       diffs:["Easy","Medium","Hard"], count:2 },
          { skills:["Words in Context"], diffs:["Easy","Medium","Hard"], count:2 },
        ],
        tip:"A short mix before our session." },
    ]
  },

  // Jeffrey — 12 Aug. ONE set. Replaces the 6–14 Aug five-set plan, which is
  // cleared: days 1, 2 and 3 were run on 5–6 Aug; days 4 and 5 never opened.
  // Re-authored on the tutor's instruction for the night of the 12 Aug class.
  //
  // THIS IS A HOMEWORK DAY, NOT A CHALLENGE SET, and that is load-bearing twice:
  //   - predictMode() lives in homework-run.html and returns 'type' only when
  //     minutes === 0. The Challenge runner has no typed-prediction state at all,
  //     and typing the prediction is the entire point of this set.
  //   - prioritizePool() leads with `unseen` for a homework day. A Challenge set
  //     passes missesFirst and leads with items he has already answered wrong.
  //     The brief was to prioritise what he has NOT done.
  // challenge/sets.js was therefore not touched. It is append-only, and its ids
  // are the denominator of "Mastered N of 22"; p11-rw has already been run twice.
  //
  // minutes:0 IS LOAD-BEARING — see above. review:0 keeps all ten questions on the
  // three named skills; a ladder splice inserts other skills at random positions.
  //
  // POOL — re-tallied 12 Aug against the banks, net of the 186 ids in his export
  // and the 50 committed to p8-rw and p11-rw. Free items remaining:
  //   Words in Context            E 42   M 19   H 47
  //   CoE — Textual               E 16   M  3   H 13    <- Medium nearly gone
  //   CoE — Quantitative          E 13   M  2   H  2    <- THINNEST IN THE BANK
  // This day draws WiC 1E/2M, CoE-T 2E/1M/1H, CoE-Q 2E/1M, and deliberately leaves
  // 1 Medium + 2 Hard Quantitative for the 13-14 Aug sets. Do not raise the
  // Quantitative counts without re-tallying.
  //
  // WHY EASY-WEIGHTED, 5 of 10. Seven of the seventeen Practice 11 misses were
  // Easy against one Hard, and both Command-of-Evidence misses on that test were
  // Easy. Sixteen Easy CoE-Textual items have never been served at all. On an
  // untimed set an Easy miss is a pure process failure, which is the most
  // diagnostic single result this set can produce.
  //
  // Sections are SINGLE-DIFFICULTY on purpose: a two-value `diffs` routes through
  // _calibratedPick(), leans 70% to the easy end, and would silently reshape the
  // ratio this day is built on.
  //
  // Rationale, and anything about the student, lives in homework/PLAN-NOTES.md.
  // This file is downloaded by his browser. Keep it free of assessment of him.
  // CLEARED 18 AUG 2026 — `days: []`, deliberately, at the tutor's instruction.
  // The hub carries no set on this key for the last week before the exam; the
  // current work is two sets in the Challenge module (challenge/sets.js) and one
  // full practice test sat outside the app. An empty `days` renders an empty hub,
  // which is the intended state — it is not an unfinished edit.
  //
  // `start` AND THE TWO DAYS ARE KEPT, COMMENTED, BELOW. Do not delete them and
  // do not change `start` if this key is ever re-authored: it is the storage key
  // for records already written, and the note under it explains what moving it
  // cost on 14 Aug. To re-assign, uncomment and append — do not rebuild from
  // scratch against a new date.
  // `challenge:` NAMES THE SET THE HUB CARDS. It must match a live setId in
  // challenge/sets.js — and challenge.js serves sets[length-1], so it must name
  // the LAST entry there. On 20 Aug, when the second set is uncommented, this
  // string moves to 'trn-aug' in the same edit. assignments.test.js asserts that
  // a plan with no days carries this field; without it the hub renders empty.
  "Jeffrey": {
    title: "This week: your punctuation challenge",
    start: "2026-08-11",
    through: "2026-08-21",
    unlock: "sequential",
    challenge: "bnd-aug",
    days: [],
  },

  /* CLEARED 18 AUG 2026 — the 11–15 Aug block, kept verbatim for the `start` key
     and the two authored days. Uncomment to restore.

  "Jeffrey_cleared_2026-08-18": {
    title: "Into Saturday: type it, then prove it survives a clock",
    // ⚠ DO NOT CHANGE `start` ONCE A SET HAS BEEN SUBMITTED. It is not a display
    // date — it is the KEY for completion and review records:
    //   satrw_hw_<student>_<start>_<n>      (submitted)
    //   satrw_hwrec_<student>_<start>_<n>   (his answers, for reopening)
    // Moving it orphans every flag already written. On 14 Aug this file was edited
    // from 2026-08-12 to 2026-08-13 after day 1 had been submitted; his 10/10
    // stopped being recognised, day 1 re-read as "Available", and day 2 locked
    // itself behind a set the app no longer believed he had finished.
    //
    // THE VALUE BELOW IS THE ONE THAT WAS DEPLOYED, not the one that matches the
    // calendar. HEAD (commit 12 Aug 17:08) shipped start: "2026-08-11", and day 1
    // was submitted against that build at 00:38 on 13 Aug — so the flag in his
    // browser reads satrw_hw_Jeffrey_2026-08-11_1. The key follows the deploy, and
    // the deploy is the only thing his browser has ever seen.
    // Use `through` for the window — that one IS display only and is safe to move.
    start: "2026-08-11",
    through: "2026-08-15",
    unlock: "sequential",
    days: [
      { n:1, focus:"Words in context and evidence (untimed — type it out)", minutes:0, review:0,
        tip:"No clock on this one. Ten questions, and the typing is the set.\n\nBefore the choices appear you have to type what the answer has to do. Not which one you think it is — what it has to DO. The choices are only where you check it.\n\nWhat to type, by question type:\n\nWORDS IN CONTEXT — the meaning in your own words, AND the words in the sentence that gave it to you. If you cannot point at the phrase that defines it, you are guessing from the topic. The sentence almost always defines the blank; find that part first and quote it.\n\nEVIDENCE FROM A TEXT — the live word in the claim. One word, the one the evidence has to satisfy. Write it down, then test each quotation against that word alone. A quotation can be accurate, well written and about the right person, and still not touch the word. True is not the test; on-task is.\n\nEVIDENCE FROM A TABLE OR GRAPH — read the axis labels and the units before you read a single choice. Then type what the data shows in one plain sentence, and say which row, column or axis you read it from. If a range is given, say which end you are using.\n\nThen: cross out on the first failure. Do not rank them, and do not pick a favourite and defend it. The question is never which is best — it is which three fail. If two survive, the one that names the specific thing in the claim wins.\n\nOne word is not a prediction. About thirty minutes. One sitting, phone in another room.",
        sections:[
          { skills:["Words in Context"],                   diffs:["Easy"],   count:1 },
          { skills:["Words in Context"],                   diffs:["Medium"], count:2 },
          { skills:["Command of Evidence — Textual"],      diffs:["Easy"],   count:2 },
          { skills:["Command of Evidence — Textual"],      diffs:["Medium"], count:1 },
          { skills:["Command of Evidence — Textual"],      diffs:["Hard"],   count:1 },
          { skills:["Command of Evidence — Quantitative"], diffs:["Easy"],   count:2 },
          { skills:["Command of Evidence — Quantitative"], diffs:["Medium"], count:1 }
        ] },
      // Day 2 — RE-CUT 14 Aug as a WARM-UP for the practice test on the 15th.
      // It was authored on the 13th as a 15-question, 15-minute mixed set with a
      // review splice. Its job changed, so its shape did.
      //
      // WHAT DAY 1 RETURNED, and why this set is easier than it was going to be.
      // 10/10 untimed, and the mechanism moved, not just the score: across the two
      // 5-6 Aug module reps he spent 1 second on the text against 4 in the options
      // on grammar items (1:4.1, 63%). On day 1 that inverted to 1:0.4 — 1,078
      // seconds on the text against 398 in the options — with a MEDIAN of 94
      // seconds on the text, and every prediction typed as a real claim rather
      // than the word "choices". The method is installed. What is NOT established
      // is that it survives a clock: day 1 ran at 159 s/q untimed and one Hard
      // CoE-Textual item took 428 seconds. The test gives him ~71.
      //
      // SO THIS IS A WARM-UP, NOT A TEST. Ten questions, ten minutes, 60 s/q. Its
      // job is to start the clock-habit and END ON SUCCESS the morning of a test —
      // not to find his ceiling. Everything is at or below the difficulty he has
      // just cleared.
      //
      // TWO DELIBERATE REMOVALS, both reversals of the 13 Aug draft:
      //   - review:0, not review:3. The ladder splices at RANDOM POSITIONS and can
      //     serve an old Hard miss last. A warm-up has to be predictable and has to
      //     finish well. The ladder gets unfrozen in Sunday's post-test set, which
      //     is the right place for it and has been since July.
      //   - No Hard CoE-Textual. The 13 Aug draft carried two. That skill at Hard
      //     cost him seven minutes on day 1; two of them inside a ten-minute warm-up
      //     is a way to walk into the test rattled.
      //
      // POOL — Quantitative draws EASY ONLY. The bank holds 1 Medium and 2 Hard
      // Quantitative unseen and they are reserved for Sunday. Easy has 11 free.
      { n:2, focus:"Ten minutes, mixed — the warm-up", minutes:10, review:0,
        tip:"Do this in the twenty minutes before the test, not the night before. Ten questions, ten minutes, one timer.\n\nThis is a warm-up. It is not a test and it is not a last-minute fix. Nothing in it is harder than what you did on Wednesday night, and you got all ten of those right.\n\nWhat you did on Wednesday is the thing to repeat. You spent your time IN THE TEXT and almost none of it shuffling the choices, and you typed a real prediction every time. That is the whole method and it is already yours. Today the only thing added is a clock, and sixty seconds a question is more than the test gives you.\n\nSame three moves:\n\nWords in context — cover the choices, find the part of the sentence that defines the word, say your own word first.\nEvidence from a text — name the live word in the claim before you read a single quotation.\nA table or a graph — axis, units, one sentence about what the data shows, and which row you read it from.\n\nYou told me on Wednesday that you overthink and triple-check when the clock is tight. You were right, and it is the one thing that costs you points. The rule for both, and you already have it: once you have chosen, you are done. If it still nags, write the number down and move on.\n\nOne clarification for today, because these sound like opposites and are not: you may SKIP a question before you answer it. You may not RE-OPEN one after you have answered it. Skipping early is cheap. Re-deciding is what ran the clock out in Module 1.\n\nIf a question here goes past ninety seconds, answer it and move. Then close the laptop and go and take the test.",
        sections:[
          { skills:["Words in Context"],                   diffs:["Easy"],   count:1 },
          { skills:["Words in Context"],                   diffs:["Medium"], count:1 },
          { skills:["Command of Evidence — Textual"],      diffs:["Easy"],   count:2 },
          { skills:["Command of Evidence — Textual"],      diffs:["Medium"], count:1 },
          { skills:["Command of Evidence — Quantitative"], diffs:["Easy"],   count:2 },
          { skills:["Central Ideas and Details"],          diffs:["Medium"], count:1 },
          { skills:["Inferences"],                         diffs:["Medium"], count:1 },
          { skills:["Text Structure and Purpose"],         diffs:["Medium"], count:1 }
        ] },
    ]
  },
  */

  // Segun — 11–14 Aug. FOUR sets, THREE untimed then ONE timed, `sequential`.
  // Replaces the 22 Jul block, which is retired: set 1 of it was submitted and
  // sets 2–4 never opened. Re-authored rather than flipped, per AGENTS.md.
  // `through` is 14 Aug so the hub prints the window and asks for the sets to be
  // spread out — under sequential that request is the only spacing left.
  //
  // THE HARD SECTIONS SIT IN THE READING DOMAINS, WHICH IS WHERE THE BANK IS
  // DEEPEST. Free Hard depth, tallied by hand on 11 Aug net of every id already
  // served on this plan key: Words in Context 49, Text Structure 35, Cross-Text
  // 27, Inferences 26, CoE-Textual 20, Central Ideas 16, CoE-Quantitative 7.
  // Nothing in this block repeats and nothing is near a floor.
  //
  // CONVENTIONS IS THE DEPLETED DOMAIN AND THIS BLOCK STAYS OFF IT. Free at
  // Medium+Hard: FSS Medium 4 (SVA 2, Pron 2), Semi H1, Colon H1, Dash H2,
  // Commas M8 H8, NoPunct M2 H3, Mod H9. DO NOT BUILD A CONVENTIONS SET off this
  // pool — Colon in particular cannot support one. Maintenance on those skills
  // rides the default 2-question review draw, which crosses the day's filter.
  //
  // THE ORDER IS LOAD-BEARING. Under sequential unlock the sets are met in this
  // order, every time, so each is placed to set up a later one:
  //   1 → 2  Inferences gets its untimed rep in 1, then carries 4 of 6 in 2
  //   1 → 4  Words in Context untimed in 1, back under the clock in 4
  //   2 → 3  evidence-from-text in 2 before two-text comparison in 3
  //   1,2,3 → 4  every skill in the timed set has had an untimed rep first
  // Set 1 is the most STARTABLE at six questions with no clock, which matters
  // because under sequential unlock a stall on set 1 blocks the week. Do not
  // reorder without rebuilding that chain.
  //
  // DAYS 1-3 MUST STAY minutes:0. predictMode() keys off the clock and untimed is
  // the only state in which the runner makes the prediction be TYPED. These three
  // sets are first contact with the Hard tier of these skills, so the typed step
  // is the whole point. Day 4 is timed because pace under a mixed draw is the
  // separate thing being rehearsed. Untimed before timed, per AS-5.
  //
  // EVERY SECTION IS SINGLE-DIFFICULTY, DELIBERATELY. A two-value diffs range
  // routes through _calibratedPick(), and below CALIBRATE_DOWN_BELOW it leans 70%
  // to the easy end — which silently removes the Hard exposure these sets exist
  // for. One difficulty per section bypasses calibration. Do not merge sections
  // and do not widen a range to "give some room".
  //
  // Day 4 is 6 Hard of 10 authored, with 4 Medium carrying Expression of Ideas
  // and Conventions so the set stays landable and so Medium misses stay in scope
  // for prioritizePool() — a Medium miss can never reappear in a Hard-only set.
  //
  // `minutes` budgets the WHOLE set, review included: 10+2 = 12 @ ~71s = 852s,
  // which is 14 min, not 12. It was authored at 12 — the arithmetic was run on the
  // 10 authored questions and the review dose was left out of it. At 12 the set
  // runs at 60 s/q, tighter than the test, and the pace it measures is then a
  // property of the budget rather than of the sitting. CORRECTED TO 14 ON 17 AUG.
  // Whenever a day's count changes, re-run this line: (count + review) x 71 / 60.
  //
  // assignments.test.js checks pool depth by skill+difficulty and IGNORES
  // ruleType, so the two ruleType draws on Day 4 were tallied by hand: Commas
  // Medium 8, Pron Medium 2. Pron is the tight one — do not raise it past 1 and
  // do not add a second FSS Medium section anywhere in this block.
  //
  // `review` is omitted throughout, so every day is its authored count + the
  // default 2. The counts were written around that dose.
  //
  // Rationale, and anything about the student, lives in homework/PLAN-NOTES.md.
  // This file is downloaded by his browser and this repo is public. Keep it free
  // of assessment of him — shapes, pools and guardrails only.
  "Segun": {
    title: "This week: the reading questions, at the hard end",
    start: "2026-08-12",
    through: "2026-08-14",
    unlock: "sequential",
    days: [
      { n:1, focus:"Word meaning and inference (untimed — type it out)", minutes:0,
        tip:"No clock on this one. Six questions, and the typing is the set.\n\nBefore the choices appear you have to type what the answer has to do.\n\nWORD MEANING — say the meaning in your own words, AND quote the part of the sentence that gave it to you. If you cannot point at the phrase that defines it, you are working from the topic instead of the sentence. The familiar meaning of a word is the trap; the sentence decides.\n\nINFERENCE — finish the thought the text has already started. It has to be grounded in the text, in scope, and complete. If you have to add a fact of your own, it is wrong.\n\nThen cross out on the first failure. Do not rank the choices and do not pick a favourite and defend it. The question is never which is best. It is which three fail.\n\nThese are hard on purpose. About fifteen minutes, one sitting.",
        sections:[
          { skills:["Words in Context"], diffs:["Hard"], count:4 },
          { skills:["Inferences"],       diffs:["Hard"], count:2 }
        ] },
      { n:2, focus:"Inference and evidence (untimed — type it out)", minutes:0,
        tip:"Same method, still no clock.\n\nINFERENCE — grounded, in scope, complete. Say it before you look.\n\nEVIDENCE FROM A TEXT — find the live word in the claim. One word, the one the evidence has to satisfy. Type it, then test each quotation against that word alone.\n\nA quotation can be accurate, well written, about the right person and the right study, and still not touch the word. True is not the test. On-task is.",
        sections:[
          { skills:["Inferences"],                    diffs:["Hard"], count:4 },
          { skills:["Command of Evidence — Textual"], diffs:["Hard"], count:2 }
        ] },
      { n:3, focus:"Two texts, main ideas, and data (untimed — type it out)", minutes:0,
        tip:"No clock.\n\nTWO TEXTS — read the second text first and name its position in one sentence. Then read the first. The question is almost always what the second writer would say about the first.\n\nMAIN IDEA — cover the whole text, not the opening line. The answer has to hold for every part of it.\n\nDATA — read the axis labels and the units before you read a single choice. Then say in one plain sentence what the figure shows, and name the row or the axis you read it from. If a range is given, say which end you are using.",
        sections:[
          { skills:["Cross-Text Connections"],             diffs:["Hard"],   count:3 },
          { skills:["Central Ideas and Details"],          diffs:["Hard"],   count:2 },
          { skills:["Command of Evidence — Quantitative"], diffs:["Medium"], count:1 }
        ] },
      { n:4, focus:"Mixed review at test pace", minutes:14,
        tip:"Test pace, about seventy seconds a question.\n\nSay what the answer has to DO before you open the choices, then eliminate in one pass. Once you have decided, do not go back and re-argue an option.\n\nWord meaning → cover the blank and supply your own word first.\nInference → grounded, in scope, complete.\nTwo texts → read the second one first.\nSynthesis → a choice can be completely true and still be off-task.\nTransition → name the relationship before you read the words.\n\nSix of these ten are hard on purpose. A miss there is information, not a verdict. What is not optional is the prediction. Answering fast and answering slow are the same mistake when the method has not run.",
        sections:[
          { skills:["Words in Context"],           diffs:["Hard"],   count:2 },
          { skills:["Inferences"],                 diffs:["Hard"],   count:2 },
          { skills:["Cross-Text Connections"],     diffs:["Hard"],   count:1 },
          { skills:["Rhetorical Synthesis"],       diffs:["Hard"],   count:1 },
          { skills:["Text Structure and Purpose"], diffs:["Medium"], count:1 },
          { skills:["Transitions"],                diffs:["Medium"], count:1 },
          { skills:["Boundaries"],                 diffs:["Medium"], ruleType:"Commas", count:1 },
          { skills:["Form, Structure, and Sense"], diffs:["Medium"], ruleType:"Pron",   count:1 }
        ] },
    ]
  },

  // Bruce — 11–20 Aug. FIVE sets, `sequential`, `through` 20 Aug so the hub prints
  // the window and asks for them to be spread out. Replaces the 18 Jul block, which
  // is retired: all five sets of it were submitted. Re-authored, not flipped, per
  // AGENTS.md.
  //
  // Sets 1–4 are unchanged from the 11 Aug authoring — set 1 is submitted and the
  // draw for 2–4 is fixed. Two TIPS were corrected afterwards (set 2's prediction
  // requirement, set 3's verb-form rule); no section, count or difficulty moved.
  //
  // SET 5 ADDED 12 AUG. Boundaries, untimed, split by ruleType so the draw exercises
  // the branch decision rather than defaulting to commas. Free depth on this key
  // when it was authored: NoPunct M3 H5, Commas M12 H8, Semi M1 H4, Colon M1 H2,
  // Dash M2 H2. The draw takes NoPunct M2 H2, Commas M1, Semi H1 — NoPunct Medium
  // is left with 1 and set 4's unfiltered Boundaries draw can also land on it, so
  // DO NOT RAISE THE NoPunct COUNTS. assignments.test.js ignores ruleType and will
  // not catch it. Colon is untouched here: M1 H2 is too thin to author against.
  //
  // SET 1 IS RUN IN THE ROOM, THE REST AT HOME. That is why it is the only set with
  // no review dose and an exact ten: it has to be exactly ten at pace, and it has to
  // be the first thing met under sequential unlock.
  //
  // WHAT THIS BLOCK DELIBERATELY DOES NOT DRAW, and why:
  //   Form, Structure & Sense at HARD — 4 free items left on this key out of 23.
  //     A Hard FSS section here would mostly re-serve. Set 3 works the same domain
  //     at Medium, split by ruleType, where there is still depth.
  //   Command of Evidence — Quantitative — thinnest pool in the bank and reserved
  //     for another key's 12 Aug sets. Nothing here draws it. Note the em dash in
  //     the skill name; a hyphen will not resolve.
  //
  // WHERE THE DEPTH IS. Tallied by hand on 11 Aug, free items on this key:
  //   Text Structure and Purpose   E 28   M 33   H 35     <- never drawn before
  //   Central Ideas and Details    E 16   M 15   H 16     <- never drawn before
  //   CoE — Textual                E 16   M 17   H 19
  //   Boundaries                   E 16   M 21   H 22
  //   Transitions                  E 20   M 14   H 13
  // Sets 1, 2 and 4 sit on those five skills. Nothing in them is near a floor.
  //
  // SET 3 IS THE TIGHT ONE AND assignments.test.js WILL NOT CATCH IT — it checks
  // pool depth by skill + difficulty and IGNORES ruleType. Tallied by hand, free
  // Form, Structure & Sense at Medium: SVA 3, VForm 2, VTense 1, Pron 2, Mod 2.
  // VForm 2 and VTense 1 are exactly their counts. _pickSectionQuestions backfills
  // from the same difficulty before it spills to another, so a short ruleType pool
  // degrades to a plain Medium draw rather than a short set — but the sub-rule
  // targeting is what set 3 exists for. DO NOT RAISE THOSE COUNTS, and do not
  // author VForm or VTense at Medium again on this key without re-tallying.
  //
  // EVERY SECTION IS SINGLE-DIFFICULTY, DELIBERATELY. A two-value diffs range
  // routes through _calibratedPick() and leans to the easy end, which would
  // silently reshape the Medium/Hard ratio each set is built on. One difficulty
  // per section bypasses calibration. Do not merge sections and do not widen a
  // range to "give some room".
  //
  // THE ORDER IS LOAD-BEARING under sequential unlock:
  //   1 → 2  the five reading skills meet the clock first, then get an untimed,
  //          TYPED rep at the hard end — the reverse of the usual order, because
  //          set 1 is a cold read and its value dies if it is rehearsed first
  //   2 → 4  every skill in the closing timed set has had its untimed rep
  //   3 → 4  conventions at Medium, then only via the review draw
  //
  // minutes: set 1 is 10+0 @ ~71s = 12. Set 2 is untimed (minutes:0 is the ONLY
  // state in which predictMode() makes the prediction be typed — do not put a
  // clock on it). Set 3 is 6+0 @ 90s = 9. Set 4 is 8 + the default 2 = 10 @ ~72s
  // = 12, which is the one set in this block authored to INCLUDE the review dose:
  // by the time it opens, sets 1–3 are past the 20h cooldown and the ladder should
  // finally serve. If it does not, that set runs loose at 90s and the ladder needs
  // looking at, not the plan.
  //
  // Rationale, and anything about the student, lives in homework/PLAN-NOTES.md.
  // This file is downloaded by his browser and this repo is public. Keep it free
  // of assessment of him — shapes, pools and guardrails only.
  "Bruce": {
    title: "This week: the parts of the paper we have not been looking at",
    start: "2026-08-12",
    through: "2026-08-20",
    unlock: "sequential",
    days: [
      { n:1, focus:"Ten questions at test pace — punctuation, transitions, purpose, evidence", minutes:12, review:0,
        tip:"Ten questions, about seventy seconds each, and five skills that have had almost no reps in here: punctuation, transitions, the purpose of a text, evidence from a passage, and main ideas.\n\nOne click to commit, so the discipline is yours to keep. The click is the commitment: read the text and decide what the answer has to DO before you open the choices. Opening them early does not save time — it removes the only thing you can eliminate against.\n\nPUNCTUATION — is each side of the mark a complete sentence? Two complete sides take a period or a semicolon. One complete and one fragment takes a comma, a colon or a dash. And sometimes nothing belongs at all; that choice is on the paper for a reason.\nTRANSITIONS — name the relationship between the two sentences in your own words BEFORE you read the four words on offer. Contrast, continuation, example, cause and effect.\nPURPOSE — the question is what the text is DOING, not what it is about. A choice can name the right topic and the wrong job.\nEVIDENCE — find the live word in the claim, the one the quotation has to satisfy, and test each option against that word alone.\nMAIN IDEA — it has to hold for the whole text, not just the opening line.\n\nEliminate on the first failure and move. If you run out of time, submit what you have; the set is not lost.",
        sections:[
          { skills:["Boundaries"],                    diffs:["Medium"], count:2 },
          { skills:["Boundaries"],                    diffs:["Hard"],   count:1 },
          { skills:["Transitions"],                   diffs:["Medium"], count:1 },
          { skills:["Transitions"],                   diffs:["Hard"],   count:1 },
          { skills:["Text Structure and Purpose"],    diffs:["Medium"], count:1 },
          { skills:["Text Structure and Purpose"],    diffs:["Hard"],   count:1 },
          { skills:["Command of Evidence — Textual"], diffs:["Medium"], count:1 },
          { skills:["Command of Evidence — Textual"], diffs:["Hard"],   count:1 },
          { skills:["Central Ideas and Details"],     diffs:["Medium"], count:1 }
        ] },
      { n:2, focus:"Purpose, main ideas and evidence (untimed — type it out)", minutes:0,
        tip:"No clock on this one, and the typing is the set. Before the choices appear you have to type what the answer has to do — not which one you think it is, what it has to DO.\n\nONE RULE FOR WHAT YOU TYPE: it has to contain a word you copied out of the text. \"Answer choices\" is not a prediction — there are no choices on the screen yet, which is the entire point of the screen. If you cannot yet name what the answer has to do, you are not finished reading, and the box is telling you so rather than getting in your way.\n\nPURPOSE — one sentence: what is this text doing, and for whom? Describing, arguing, correcting, illustrating, introducing? Then say which part of the text told you. The trap is a choice that names the right topic and the wrong job, and it is the single most common wrong answer in this part of the paper.\n\nMAIN IDEA — cover the whole text, not the first line. Write the claim in your own words and check it against the last sentence as well as the first.\n\nEVIDENCE — write the live word in the claim before you read a quotation. One word. Then test each quotation against that word alone. A quotation can be accurate, well written, about the right person and the right study, and still not touch the word. True is not the test. On-task is.\n\nTRANSITION — name the relationship in your own words first.\n\nThese are at the hard end on purpose, and untimed on purpose: this is the mode your best work has always come from. Take the time and write the reasoning down.",
        sections:[
          { skills:["Text Structure and Purpose"],    diffs:["Hard"],   count:2 },
          { skills:["Command of Evidence — Textual"], diffs:["Hard"],   count:2 },
          { skills:["Central Ideas and Details"],     diffs:["Medium"], count:1 },
          { skills:["Transitions"],                   diffs:["Medium"], count:1 }
        ] },
      { n:3, focus:"Verbs — form, agreement and tense, at ninety seconds", minutes:9, review:0,
        tip:"Six questions, ninety seconds each. All six are about verbs, and the whole exercise is deciding WHICH verb question you are looking at before you choose.\n\nVERB FORM — this is the rule from class, with the missing step added. Work the blank's OWN clause, not the whole sentence.\n1. Count the real verbs already in that clause. `-ing` and `to-` are not real verbs; they cannot hold a clause up on their own.\n2. NONE — the blank has to BE the real verb.\n3. ONE — now look at the word joining the blank to it. If that word is `and`, `but` or `or` and the subject has not changed, the blank is a SECOND real verb sharing that subject, and it must match the tense of the first. Anything else joining it — a comma, a `which`, a `that`, nothing at all — and the blank takes the -ing or to- form.\n\nStep 3 is the part we did not have last week. Without it the rule tells you to write `developing` where the sentence wants `developed`. Watch out for an `and` that joins two -ing words to each other rather than joining the blank to a real verb — that one does not count.\n\nSUBJECT-VERB AGREEMENT — cross out everything between the subject and the blank, then read what is left. The words in between are there to make a singular subject look plural.\n\nVERB TENSE — find the other time marker in the sentence and match it. If one past event happened before another past event, the earlier one takes `had`.\n\nHow to tell them apart: look at what the four options differ by. If they differ by -ing / to- / plain verb, it is form. If they differ by is/are or an -s ending, it is agreement. If they differ by when it happened, it is tense. The rule is hiding in the options, not in the sentence.",
        sections:[
          { skills:["Form, Structure, and Sense"], diffs:["Medium"], ruleType:"VForm",  count:2 },
          { skills:["Form, Structure, and Sense"], diffs:["Medium"], ruleType:"SVA",    count:2 },
          { skills:["Form, Structure, and Sense"], diffs:["Medium"], ruleType:"VTense", count:1 },
          { skills:["Form, Structure, and Sense"], diffs:["Hard"],   ruleType:"VTense", count:1 }
        ] },
      { n:4, focus:"Mixed review at test pace", minutes:12,
        tip:"Ten questions at about seventy seconds each — eight new, and the rest are questions from earlier this week coming back round. That is deliberate: the ones that return are the ones worth checking you have kept.\n\nEverything mixed, no warning which is which. The paper gives no warning either.\n\nName the job before you open the choices, then eliminate in one pass. Once you have decided, do not go back and re-argue an option — every question you reopen after choosing is paid for by the next one.\n\nPunctuation → is each side a complete sentence?\nTransition → name the relationship first.\nPurpose → what is it doing, not what is it about.\nEvidence → find the live word in the claim.\nTwo texts → read the second one first, then ask what its author would say about the first.\nInference → grounded, in scope, complete. Nothing of yours added.\n\nOne sitting, phone in another room. If a question is going nowhere, leave an answer behind before you move on — a marked question with no answer is a guaranteed zero, and a guess is not.",
        sections:[
          { skills:["Boundaries"],                    diffs:["Medium"], count:1 },
          { skills:["Boundaries"],                    diffs:["Hard"],   count:1 },
          { skills:["Transitions"],                   diffs:["Medium"], count:1 },
          { skills:["Text Structure and Purpose"],    diffs:["Hard"],   count:1 },
          { skills:["Command of Evidence — Textual"], diffs:["Medium"], count:1 },
          { skills:["Central Ideas and Details"],     diffs:["Medium"], count:1 },
          { skills:["Inferences"],                    diffs:["Hard"],   count:1 },
          { skills:["Cross-Text Connections"],        diffs:["Hard"],   count:1 }
        ] },
      { n:5, focus:"Punctuation — which of the two questions is it? (untimed — type it out)", minutes:0,
        tip:"Six punctuation questions, no clock, and one decision to make before every one of them.\n\nSTEP 0 — look at what sits beside the mark. Is it a chunk that could be printed on its own as a whole sentence? Or is it a descriptive add-on hanging off a noun? That answer sends you down one of two roads, and taking the wrong road is how these get missed.\n\nROAD A — JOINING. Cover the mark and check each side.\nComplete + complete: a full stop, a semicolon, or a comma with and/but/so/for/or/nor/yet. A colon only if the right side explains the left.\nComplete + fragment: a comma, a colon, a dash — or nothing.\nFragment + complete: a comma, a dash — or nothing.\n\"Complete\" means its own subject and its own real verb, printable alone. A chunk starting with that, which, because or although is NOT complete, however long it is.\n\nROAD B — AN ADD-ON. Take the chunk out and read the sentence without it.\nStill works, still means the same thing: it is non-essential, so fence it with a MATCHING PAIR — two commas, or two dashes. Never one of each.\nBreaks, or you can no longer tell WHICH thing is being talked about: it is essential, so NO punctuation at all.\n\nAnd the number worth carrying in: about one in five of these has \"no punctuation\" as the right answer. The option with nothing in it is a real answer, not a throwaway.\n\nType which road you are on, and why, before the choices appear.",
        sections:[
          { skills:["Boundaries"], diffs:["Medium"], ruleType:"NoPunct", count:2 },
          { skills:["Boundaries"], diffs:["Hard"],   ruleType:"NoPunct", count:2 },
          { skills:["Boundaries"], diffs:["Medium"], ruleType:"Commas",  count:1 },
          { skills:["Boundaries"], diffs:["Hard"],   ruleType:"Semi",    count:1 }
        ] },
    ]
  }
};

// Parse a start date robustly: accepts "YYYY-MM-DD", a Date, ISO, or locale
// formats like "6/22/2026". Returns a local Date at midnight, or null.
function hwParseDate(s) {
  if (s instanceof Date) return isNaN(s) ? null : new Date(s.getFullYear(), s.getMonth(), s.getDate());
  if (!s) return null;
  s = String(s).trim();
  var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  var d = new Date(s);
  return isNaN(d) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// Is set `n` open to this student yet?
//
// THE DEFAULT IS `sequential`: Set 1 is always open, and each later set opens
// when the one before it is submitted. A set is earned, not waited for. This
// replaced `cumulative` (one per calendar day) because a student who sat down
// on a Saturday with time to work could only ever reach that day's set, and a
// student who fell behind saw a wall of everything at once.
//
// The trade sequential makes is that it stops enforcing SPACING — nothing now
// prevents all five sets in one evening, which is the one thing the design
// cannot afford. So a sequential plan should also carry `through`, and the hub
// shows the student the window the sets are meant to be spread across. The
// pacing is asked for honestly rather than imposed by a lock.
//
// If localStorage cannot be read we OPEN the set rather than strand the
// student. Broken storage must never be able to lock someone out of homework.
function hwDayOpen(student, plan, n) {
  if (!plan) return n === 1;
  if (plan.unlock === 'sequential') {
    if (n <= 1) return true;
    try {
      for (var i = 1; i < n; i++) {
        if (localStorage.getItem('satrw_hw_' + student + '_' + plan.start + '_' + i) !== '1') return false;
      }
      return true;
    } catch (e) { return true; }
  }
  return n <= hwDaysAvailable(plan.start);
}

// Days available so far (cumulative unlock by calendar day; Day 1 on start date).
// Only `unlock: "cumulative"` plans use this now — see hwDayOpen above.
function hwDaysAvailable(startStr) {
  var start = hwParseDate(startStr);
  if (!start) return 1;   // if the date is missing/odd, open Day 1 rather than lock everything
  var now = new Date();
  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.floor((today - start) / 86400000) + 1);
}

// false = plans from this file (reliable) · true = fetch from the Google Sheet
var HW_USE_SHEET = false;

// Load a student's plan: built-in by default; optional JSONP sheet fetch with
// fallback. Either way the callback receives (plan|null, source).
function hwLoadPlan(student, cb) {
  var local = (typeof HOMEWORK !== "undefined" && HOMEWORK[student]) ? HOMEWORK[student] : null;
  var ep = (typeof SHEET_SYNC_ENDPOINT === "string") ? SHEET_SYNC_ENDPOINT : "";
  if (!HW_USE_SHEET || !ep) { cb(local, "local"); return; }
  var done = false, name = "__hwcb" + Math.random().toString(36).slice(2), sc;
  function finish(plan) { if (done) return; done = true;
    try { delete window[name]; } catch (e) {}
    if (sc && sc.parentNode) sc.parentNode.removeChild(sc);
    var ok = plan && plan.days && plan.days.length;
    cb(ok ? plan : local, ok ? "sheet" : "default"); }
  var timer = setTimeout(function(){ finish(null); }, 9000);
  window[name] = function(data){ clearTimeout(timer); finish(data); };
  sc = document.createElement("script");
  sc.src = ep + (ep.indexOf("?") < 0 ? "?" : "&") + "action=plan&student=" + encodeURIComponent(student) + "&callback=" + name;
  sc.onerror = function(){ clearTimeout(timer); finish(null); };
  document.body.appendChild(sc);
}

if (typeof window !== "undefined") {
  window.HOMEWORK = HOMEWORK;
  window.hwDaysAvailable = hwDaysAvailable;
  window.hwDayOpen = hwDayOpen;
  window.hwLoadPlan = hwLoadPlan;
  window.hwParseDate = hwParseDate;
}
