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

  // Jeffrey — 6 to 14 Aug, into the dress-rehearsal test on 15 Aug. FIVE sets,
  // `sequential`, `through` 14 Aug so the day before the test stays clear.
  //
  // THE SHAPE CHANGED. The 25 Jul plan trained one block per set and then ran the
  // three blocks end to end at ten and twelve questions. Sets 1, 3 and 4 here are
  // full 27-question modules instead, because a 27-question module is the only
  // thing that has ever exposed what a ten-question set does not: the module is
  // 27 q in 32 min and nothing shorter reproduces the last five questions of it.
  //
  // THE ORDER INSIDE EACH REP IS LOAD-BEARING and matches the test-order routine:
  //   SEC + Expression (12) -> Craft / Words in Context (8) -> Info & Ideas (7).
  // Sections concatenate in authored order, so `review: 0` is structural on every
  // rep — review questions splice in at RANDOM POSITIONS and would break the block
  // order the reps exist to rehearse. Do not drop it from days 1, 3 or 4.
  //
  // Day 2 MUST stay minutes:0. predictMode() keys off the clock, and untimed is
  // the only state in which the runner makes him TYPE the prediction. It is the
  // only typed-prediction set in the plan, which is why it is not also timed.
  //
  // `minutes` is a LABEL on the hub card, not a countdown — homework-run.html
  // reads it only through predictMode(). The 32 on the reps tells him the module
  // length; the clock itself has to be external. The tips carry the two wall-clock
  // checkpoints rather than per-question paces, because a checkpoint survives
  // pressure and a per-question target does not.
  //
  // Pool depth re-tallied against the bank for three reps plus day 2:
  // Boundaries Medium draws 12 of 21, FSS Medium 6 of 19, Inferences Medium 6 of 13,
  // CoE-Textual Medium 6 of 17, Transitions Medium 9 of 49, Rhetorical Synthesis
  // Medium 9 of 70, Words in Context Medium 12 of 134, Text Structure 6 of 96,
  // Cross-Text 6 of 70, Central Ideas Medium 6 of 47.
  // CoE-QUANTITATIVE IS THE THINNEST POOL IN THE BANK — M5 H7 = 12 total. This plan
  // draws 3 Medium and 4 Hard, so 7 of 12. Every CoE-Q section is written at a
  // SINGLE difficulty on purpose: a two-value range routes through
  // _calibratedPick(), leans 70% to the easy end below CALIBRATE_DOWN_BELOW, and
  // would drain the five Medium without saying so. Do not raise these counts
  // without re-tallying.
  //
  // Rationale, and anything about the student, lives in homework/PLAN-NOTES.md.
  // This file is downloaded by his browser. Keep it free of assessment of him.
  "Jeffrey": {
    title: "Two weeks out: the full module, three times",
    start: "2026-08-06",
    through: "2026-08-14",
    unlock: "sequential",
    days: [
      { n:1, focus:"The full module, in test order — one clock", minutes:32, review:0,
        tip:"Twenty-seven questions, thirty-two minutes, one clock. Start it on your phone and put the phone across the room, face down.\n\nWork them in the order they come. Two checkpoints, and they are clock times, not per-question targets — glance at the timer, not at every question:\n\n10:00 — the twelve grammar questions are done, start Words in Context.\n17:20 — start the reading block.\nIf it is past 19:00 and you are not in the reading block yet, go there anyway.\n\nThe last two minutes go to the two answers you were least sure of. Do not finish with time on the clock, and do not finish before question twenty-seven.\n\nOne sitting. Every question gets an answer you could explain out loud.",
        sections:[
          // Block 1 — SEC + Expression (12), the reorder's first stop
          { skills:["Boundaries"],                        diffs:["Medium"], count:4 },
          { skills:["Form, Structure, and Sense"],         diffs:["Medium"], count:2 },
          { skills:["Transitions"],                        diffs:["Medium"], count:3 },
          { skills:["Rhetorical Synthesis"],               diffs:["Medium"], count:3 },
          // Block 2 — Craft / Words in Context (8)
          { skills:["Words in Context"],                   diffs:["Medium"], count:4 },
          { skills:["Text Structure and Purpose"],         diffs:["Medium"], count:2 },
          { skills:["Cross-Text Connections"],             diffs:["Medium"], count:2 },
          // Block 3 — Information & Ideas (7), the slow block
          { skills:["Central Ideas and Details"],          diffs:["Medium"], count:2 },
          { skills:["Command of Evidence — Textual"],      diffs:["Medium"], count:2 },
          { skills:["Command of Evidence — Quantitative"], diffs:["Medium"], count:1 },
          { skills:["Inferences"],                         diffs:["Medium"], count:2 }
        ] },
      { n:2, focus:"Evidence and data (untimed — type it out)", minutes:0,
        tip:"No clock on this one, and it is the only set in the plan like that.\n\nType what the answer has to do before the choices appear. Every question. That sentence is the work — the choices are just where you check it.\n\nWrite the exact claim the evidence has to support, in your own words, then test each choice against that sentence. A choice can be completely true and still be wrong; on-task beats true.\n\nFor a figure: read the axis and the units before you read anything else. Then say what the data shows in one plain sentence, and only then look at what each choice claims about it.\n\nAbout twenty minutes. One sitting, phone in another room.",
        sections:[
          { skills:["Command of Evidence — Quantitative"], diffs:["Medium"], count:2 },
          { skills:["Command of Evidence — Quantitative"], diffs:["Hard"],   count:2 },
          { skills:["Rhetorical Synthesis"],               diffs:["Medium"], count:2 }
        ] },
      { n:3, focus:"The full module again — same clock, same order", minutes:32, review:0,
        tip:"Same set-up as the first one. Twenty-seven questions, thirty-two minutes, one clock, phone across the room.\n\n10:00 — grammar done.\n17:20 — reading block started.\nPast 19:00, go to the reading block wherever you are.\n\nThe number that matters is not the score. It is whether all twenty-seven got an answer, and where the clock stood when the grammar was finished. Write both down before you close the laptop.\n\nIf a question will not crack, commit to your best choice, note it, and move. A question you spend four minutes on costs you two others.",
        sections:[
          // Block 1 — SEC + Expression (12), the reorder's first stop
          { skills:["Boundaries"],                        diffs:["Medium"], count:4 },
          { skills:["Form, Structure, and Sense"],         diffs:["Medium"], count:2 },
          { skills:["Transitions"],                        diffs:["Medium"], count:3 },
          { skills:["Rhetorical Synthesis"],               diffs:["Medium"], count:3 },
          // Block 2 — Craft / Words in Context (8)
          { skills:["Words in Context"],                   diffs:["Medium"], count:4 },
          { skills:["Text Structure and Purpose"],         diffs:["Medium"], count:2 },
          { skills:["Cross-Text Connections"],             diffs:["Medium"], count:2 },
          // Block 3 — Information & Ideas (7), the slow block
          { skills:["Central Ideas and Details"],          diffs:["Medium"], count:2 },
          { skills:["Command of Evidence — Textual"],      diffs:["Medium"], count:2 },
          { skills:["Command of Evidence — Quantitative"], diffs:["Hard"], count:1 },
          { skills:["Inferences"],                         diffs:["Medium"], count:2 }
        ] },
      // Day 4 added 9 Aug. Information & Ideas only, untimed, EASY-weighted.
      //
      // WHY EASY, WHEN EVERY OTHER SET HERE IS MEDIUM. The Easy tier is not filler
      // in this domain: on the 8 Aug practice test, seven of the Information &
      // Ideas items marked Easy were the ones missed. A Medium or Hard set cannot
      // measure whether that is fixed, because it does not ask the question. Six of
      // the ten below are Easy for that reason, with a Medium tail so the set is
      // not uniformly below test level.
      //
      // POOL NOTE — this day costs nothing from the thin pool. CoE-Quantitative is
      // M5 H7 = 12 usable and days 1-3 and 5 already draw 7 of those 12. The two
      // CoE-Q items here are drawn from the EASY tier (16 items), which no other
      // day in this plan touches. Do not "upgrade" them to Medium without
      // re-tallying: it would drain the five Medium and starve day 5.
      //
      // minutes:0 IS LOAD-BEARING, same as day 2. predictMode() keys off the clock
      // and untimed is the only state where the runner makes him TYPE the
      // prediction before the choices render. Typing it is the whole set.
      //
      // review:0 keeps the full dose on one domain. This day exists to cover one
      // domain densely; a cross-skill review splice would spend two of the ten.
      //
      // Sections are SINGLE-DIFFICULTY on purpose. A two-value `diffs` routes
      // through _calibratedPick() and leans 70% to one end, which would silently
      // reshape the Easy/Medium ratio this day is built on.
      { n:4, focus:"Information & Ideas — say what the answer has to do (untimed)", minutes:0, review:0,
        tip:"No clock. Ten questions, all from the reading block, and the whole set is one habit.\n\nBefore the choices appear, type what the answer has to do. Not what you think the answer is — what it has to DO. One clause. \"It has to say the wolf was brought back because the elk overgrazed.\" Then open the choices and find the one that does it.\n\nFour steps, every question:\n\n1. Underline the exact thing that has to be proved. Not the topic — the claim.\n2. Say that claim back in your own words before you look at anything else.\n3. Test each choice against it and cross out on the first failure. Do not rank them. The question is never which is best; it is which three fail.\n4. If two survive, the one that names the specific thing in the claim wins.\n\nOn a table or a graph: read the axis labels and the units before you read the text, and say in one plain sentence what the data shows.\n\nA choice can be completely true and still be wrong. True is not the test. On-task is.\n\nAbout thirty minutes. One sitting, phone in another room.",
        sections:[
          { skills:["Central Ideas and Details"],          diffs:["Easy"],   count:2 },
          { skills:["Command of Evidence — Textual"],      diffs:["Easy"],   count:2 },
          { skills:["Command of Evidence — Quantitative"], diffs:["Easy"],   count:2 },
          { skills:["Inferences"],                         diffs:["Easy"],   count:3 },
          { skills:["Inferences"],                         diffs:["Medium"], count:1 }
        ] },
      { n:5, focus:"The last full module before Saturday", minutes:32, review:0,
        tip:"Twenty-seven questions, thirty-two minutes, one clock. The last rehearsal before the test.\n\nSame two checkpoints: 10:00 and 17:20.\n\nSome of these are hard on purpose. Getting one wrong after a real attempt is a good outcome; answering in eight seconds is not — if you could not say why in a sentence, it was a guess, and a guess costs the same as a wrong answer but teaches you nothing.\n\nFinish nothing early. Spend whatever is left on the two you were least sure of.",
        sections:[
          // Block 1 — SEC + Expression (12), the reorder's first stop
          { skills:["Boundaries"],                        diffs:["Medium"], count:4 },
          { skills:["Form, Structure, and Sense"],         diffs:["Medium"], count:2 },
          { skills:["Transitions"],                        diffs:["Medium"], count:3 },
          { skills:["Rhetorical Synthesis"],               diffs:["Medium"], count:3 },
          // Block 2 — Craft / Words in Context (8)
          { skills:["Words in Context"],                   diffs:["Medium"], count:4 },
          { skills:["Text Structure and Purpose"],         diffs:["Medium"], count:2 },
          { skills:["Cross-Text Connections"],             diffs:["Medium"], count:2 },
          // Block 3 — Information & Ideas (7), the slow block
          { skills:["Central Ideas and Details"],          diffs:["Medium"], count:2 },
          { skills:["Command of Evidence — Textual"],      diffs:["Medium"], count:2 },
          { skills:["Command of Evidence — Quantitative"], diffs:["Hard"], count:1 },
          { skills:["Inferences"],                         diffs:["Medium"], count:2 }
        ] },
    ]
  },

  // Segun — week of 22 Jul. FOUR sets, TWO untimed then TWO timed, `sequential`:
  // set 1 is open now and each later set opens when the one before it is
  // submitted. `through` is 26 Jul, so the hub tells him the window to spread
  // them over — nothing stops him doing all four tonight except being asked not
  // to, and being asked is the honest version. Exam is 22 Aug.
  //
  // THE ORDER IS LOAD-BEARING. Under sequential unlock he meets these in exactly
  // this order, every time, so each set is placed to set up a later one:
  //   1 → 4  semicolon/dash get their untimed rep here, and come back timed in 4
  //   2 → 3  modifiers and subject-verb get their untimed rep, timed in 3
  //   3 → 4  the pace ladder, 90 s/q before test pace
  // Set 1 is also the most STARTABLE — one decision procedure, a skill family he
  // has recent success in — because under sequential unlock a stall on set 1
  // blocks the whole week. Do not reorder these without rebuilding that chain.
  //
  // The clock arrives this week, but graded by fluency rather than flat: it goes
  // on skills already carried at a workable pace, and stays off first contact
  // with a rule that is not automatic yet. Every skill is written untimed BEFORE
  // it is written timed. Which skills sit on which side, and the pace data behind
  // that call, are in PLAN-NOTES.md — not here.
  //
  // Days 1-2 MUST stay minutes:0. predictMode() keys off the clock, and untimed
  // is the only state in which the runner makes him TYPE the prediction. Timing
  // all four sets would delete the typed step for the whole week.
  //
  // Day 4 writes Rhetorical Synthesis as TWO single-difficulty sections, not one
  // ["Medium","Hard"] range. A two-value range routes through _calibratedPick(),
  // and below CALIBRATE_DOWN_BELOW it leans 70% to the easy end — which would
  // silently drop the Hard exposure this set exists for. One difficulty per
  // section bypasses calibration. Do not merge them.
  //
  // Hard is deliberate on Day 4 and it is capped at 2 of 10, so the rest of the
  // set stays landable — that ratio is what makes meeting Hard survivable rather
  // than demoralising. Misses drop to the bottom of the ladder and come back on
  // their own; there is no need to schedule the revisit.
  //
  // `minutes` budgets the WHOLE set, review questions included, not just `count`.
  // Day 3: 8+2 = 10 @ 90s = 15. Day 4: 8+2 = 10 @ ~71s = 12.
  //
  // Boundaries and FSS are split by ruleType because both banks are lopsided; an
  // unfiltered Boundaries draw is a comma drill. assignments.test.js checks pool
  // depth by skill+difficulty and IGNORES ruleType, so it will NOT catch a thin
  // ruleType draw. Tallied by hand — Boundaries: Semi M1+H4=5, Colon M1+H2=3,
  // Dash M3+H3=6. FSS: Mod M2+H10=12, SVA E5+M6=11, VTense E5+M2=7, Poss E2+M3=5,
  // Pron E2+M4=6. This week draws Mod 5, Semi 3, Colon 1, Dash 2.
  //
  // COLON AND SEMI ARE AT THE FLOOR. After this week the bank holds 2 colon and
  // 2 semicolon questions at Medium+Hard, for four remaining weeks. Do not raise
  // either count without re-tallying, and treat it as a content gap to fill.
  //
  // Modifiers are Hard-only in practice: E0 M2 H10. The range cannot lower them,
  // which is exactly what Day 1 being untimed is there to carry.
  //
  // `review: 0` is gone. Every day is now its authored count + the default 2
  // review, and maintenance on earlier skills rides that draw instead of costing
  // a whole set. The counts above were written around that dose.
  //
  // Rationale, and anything about the student, lives in homework/PLAN-NOTES.md.
  // This file is downloaded by his browser. Keep it free of assessment of him.
  "Segun": {
    title: "This week: the harder punctuation, modifiers, then the same work at pace",
    start: "2026-07-22",
    through: "2026-07-26",
    unlock: "sequential",
    days: [
      { n:1, focus:"Semicolons, colons and dashes (untimed, notes open)", minutes:0,
        tip:"Two questions, in this order:\n1. Is each side a complete sentence?\n2. What job does the mark have to do?\n\nSemicolon → two complete sentences, closely related.\nColon → first part sets up, second part delivers.\nDash → the colon's job, or a pair fencing off extra information.\n\nName the job before you pick the mark." ,
        sections:[
          { skills:["Boundaries"], diffs:["Medium","Hard"], ruleType:"Semi",  count:2 },
          { skills:["Boundaries"], diffs:["Medium","Hard"], ruleType:"Colon", count:1 },
          { skills:["Boundaries"], diffs:["Medium","Hard"], ruleType:"Dash",  count:1 }
        ] },
      { n:2, focus:"Modifiers and agreement (untimed, notes open)", minutes:0,
        tip:"Modifier: name the noun the opening phrase describes. That noun must be the FIRST thing after the comma.\n\"Racing through the park, the dog…\" ✓  \"…the trash can…\" ✗\n\nAgreement: find the real subject, ignore everything between the commas, then use the odd-one-out check.\n\nWrite the rule down before you look at the choices.",
        sections:[
          { skills:["Form, Structure, and Sense"], diffs:["Medium","Hard"], ruleType:"Mod", count:3 },
          { skills:["Form, Structure, and Sense"], diffs:["Easy","Medium"], ruleType:"SVA", count:1 }
        ] },
      { n:3, focus:"Conventions and transitions, at pace", minutes:15,
        tip:"About 90 seconds a question — a little more than the real test gives you.\n\nModifier → the noun goes straight after the comma.\nSubject-verb → find the real subject, use odd-one-out.\nPossessive → who owns it, and are they one or many? Pronouns never take an apostrophe.\nPronoun → name the exact noun it stands for.\nTransition → name the relationship before you read the choices.\n\nRead, decide, commit, move.",
        sections:[
          { skills:["Form, Structure, and Sense"], diffs:["Medium","Hard"], ruleType:"Mod",    count:2 },
          { skills:["Form, Structure, and Sense"], diffs:["Easy","Medium"], ruleType:"SVA",    count:1 },
          { skills:["Form, Structure, and Sense"], diffs:["Easy","Medium"], ruleType:"VTense", count:1 },
          { skills:["Form, Structure, and Sense"], diffs:["Easy","Medium"], ruleType:"Poss",   count:1 },
          { skills:["Form, Structure, and Sense"], diffs:["Easy","Medium"], ruleType:"Pron",   count:1 },
          { skills:["Transitions"],                diffs:["Medium","Hard"],                    count:2 }
        ] },
      { n:4, focus:"Mixed review at test pace", minutes:12,
        tip:"Test pace — about 70 seconds a question.\n\nSay what the answer has to DO before you open the choices. Then eliminate in one pass.\n\nOnce you have decided, do not go back and re-argue an option. That is the habit costing you marks.\n\nSynthesis: a choice can be completely true and still be off-task.\nWord meaning: cover the blank and supply your own word first.\n\nTwo synthesis questions here are hard on purpose. A miss there is information, not a verdict.",
        sections:[
          { skills:["Rhetorical Synthesis"], diffs:["Medium"],                        count:2 },
          { skills:["Rhetorical Synthesis"], diffs:["Hard"],                          count:2 },
          { skills:["Words in Context"],     diffs:["Medium"],                        count:2 },
          { skills:["Boundaries"],           diffs:["Medium","Hard"], ruleType:"Semi", count:1 },
          { skills:["Boundaries"],           diffs:["Medium","Hard"], ruleType:"Dash", count:1 }
        ] },
    ]
  },

  // Bruce — week of 18 Jul. Five sets, Sat–Wed, building to a ten-question set at
  // test pace on the Wednesday.
  //
  // ENFORCE, THEN ENCOURAGE. predictMode() keys off the clock: untimed → he TYPES
  // the prediction; timed → one click. Typing is the only thing that can make the
  // reasoning step happen, and it can only happen with no clock on. So days 1–2 are
  // untimed and days 3–5 are timed, and every skill is written untimed BEFORE it is
  // written timed. The clock then tightens 90s → 80s → 71s (SAT R&W pace) rather
  // than arriving all at once.
  //
  // `minutes` budgets the WHOLE set, review questions included — not just `count`.
  // Day 3: 4+2 = 6 @ 90s = 9. Day 4: 6+2 = 8 @ 80s = 11. Day 5: 10+0 @ ~71s = 12.
  //
  // Day 1 splits Form, Structure and Sense by ruleType. assignments.test.js checks
  // pool depth by skill + difficulty and IGNORES ruleType, so it will NOT catch a
  // thin ruleType draw. Tallied by hand at Medium+Hard: Mod 12 (M2 H10), Poss 5
  // (M3 H2), Pron 6 (M4 H2) — each ≥ its count of 2, but Poss and Pron sit near the
  // floor. Do not raise those counts without re-tallying.
  //
  // Modifiers are Hard-only in practice (2 Medium in a 719-question bank), so the
  // range cannot lower them. That is what day 1 being untimed is for: hold the
  // difficulty, add the scaffold.
  //
  // Command of Evidence — Quantitative is the THINNEST pool in the bank: M5 H7 = 12
  // at Medium+Hard. It carries count:2 and no more, and the week draws 6 of the 12.
  // If it ever looks thinner than this, that is a parser regression, not a fact
  // about the test — see AGENTS.md and bank.test.js. Note the em dash in the skill
  // name; a hyphen will not resolve.
  //
  // Every day gives a RANGE, not a fixed difficulty, so recommendDifficulty() may
  // lean the draw toward the end that keeps him near ~85% success. It holds until a
  // skill has 8 attempts, so early days run exactly as authored.
  //
  // Counts are authored around the review dose: day 1 is 6+0 (an empty ledger has
  // nothing due yet), days 2–4 carry +2, day 5 is 10+0 so the rehearsal is exactly
  // ten at pace.
  //
  // Rationale, and anything about the student, lives in homework/PLAN-NOTES.md.
  // This file is downloaded by his browser. Keep it free of assessment of him.
  "Bruce": {
    title: "This week: lock the focus, then find it under a clock",
    start: "2026-07-18",
    unlock: "cumulative",
    days: [
      { n:1, focus:"Form, structure & sense — modifiers, possessives, pronouns", minutes:0, review:0,
        tip:"Untimed on purpose: type what the sentence needs before the choices appear. Modifier — name the noun the opening phrase describes, then check that that noun is the first thing after the comma. Possessive — decide who owns it, and whether they are one or many, before you place the apostrophe. Pronoun — say the noun it stands for out loud; if you cannot name it, the pronoun is wrong. Write the rule you are using, not just the answer.",
        sections:[
          { skills:["Form, Structure, and Sense"], diffs:["Medium","Hard"], ruleType:"Mod",  count:2 },
          { skills:["Form, Structure, and Sense"], diffs:["Medium","Hard"], ruleType:"Poss", count:2 },
          { skills:["Form, Structure, and Sense"], diffs:["Medium","Hard"], ruleType:"Pron", count:2 }
        ] },
      { n:2, focus:"Evidence and inferences — say it before you look", minutes:0,
        tip:"Still untimed, still typed. Two texts: in one sentence, say what each author would say to the other, and name the exact point they part on. Inference: finish the thought the text stops just short of — it has to follow from the text alone, with nothing of yours added. Charts and tables: read the axis labels and the UNITS before you read a single choice, and say what the data shows in your own words. Every one of these is the same move — decide what the answer must do, then go looking.",
        sections:[
          { skills:["Cross-Text Connections"],              diffs:["Medium","Hard"], count:2 },
          { skills:["Inferences"],                          diffs:["Medium","Hard"], count:2 },
          { skills:["Command of Evidence — Quantitative"],  diffs:["Medium","Hard"], count:2 }
        ] },
      { n:3, focus:"Form, structure & sense — same rules, now on a clock", minutes:9,
        tip:"Saturday's rules at ninety seconds a question. One click to commit this time, so the discipline is yours to keep: read the whole sentence, decide what it needs, and only then open the choices. Eliminate in one pass. If you catch yourself going back and forth between a choice and the text, you never locked an answer — go back to the sentence and decide first.",
        skills:["Form, Structure, and Sense"], diffs:["Medium","Hard"], count:4 },
      { n:4, focus:"Evidence and inferences — eighty seconds a question", minutes:11,
        tip:"Same order as Sunday, ten seconds tighter. Name what the answer must do before you read a single option, then eliminate once and move. Two traps to watch: an option can be entirely true and still be the wrong answer — true is not the test, on-task is. And on a chart, a choice that misreads the units is designed to look right to someone who never checked them.",
        sections:[
          { skills:["Cross-Text Connections"],              diffs:["Medium","Hard"], count:2 },
          { skills:["Inferences"],                          diffs:["Medium","Hard"], count:2 },
          { skills:["Command of Evidence — Quantitative"],  diffs:["Medium","Hard"], count:2 }
        ] },
      { n:5, focus:"Mixed set — ten questions at test pace", minutes:12, review:0,
        tip:"Ten questions at about seventy seconds each: this is the real thing, and it is the longest set of the week on purpose. Everything mixed, no warning which is which — the test gives no warning either. Read, decide what the answer must do, open the choices, eliminate once, move on. Every question you reopen after choosing is paid for by the next one. If you run out of time, submit what you have; the set is not lost.",
        sections:[
          { skills:["Form, Structure, and Sense"],          diffs:["Medium","Hard"], count:3 },
          { skills:["Inferences"],                          diffs:["Medium","Hard"], count:3 },
          { skills:["Cross-Text Connections"],              diffs:["Medium","Hard"], count:2 },
          { skills:["Command of Evidence — Quantitative"],  diffs:["Medium","Hard"], count:2 }
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
