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
// Gabe, Segun). Days unlock one per calendar day from `start`; missed
// days stay open. Build entries painlessly with assign.html — no need
// to hand-edit. This sits alongside the shared HW_ASSIGNMENTS catalog
// above; the homework hub/runner use the per-student plans below.
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

  // Jeffrey — 20 Jul class sets. Two in-class R&W sets, run back-to-back in
  // today's session, so this is deliberately NOT the week's homework (that lands
  // after the class):
  //   Set 1 — UNTIMED (minutes:0 → the runner asks him to TYPE the prediction),
  //           Information & Ideas: the surer half (evidence + central ideas) at
  //           Medium, then inference Medium→Hard. Hard is met untimed, on purpose.
  //   Set 2 — TIMED at test pace on a mixed draw, Medium-weighted with one Hard
  //           inference so pace and success stay honest.
  // Both carry review:0 so each runs as EXACTLY its authored count for the class.
  // start is 19 Jul so BOTH days unlock for today's session (cumulative unlock
  // opens Day 1 on start, Day 2 the next calendar day). The p8-rw challenge card
  // is set aside while these run; sets.js still holds the frozen set untouched.
  // Multi-skill days use `sections` or the draw collapses to one pool (AGENTS.md).
  // Rationale, and anything about the student, lives in homework/PLAN-NOTES.md.
  "Jeffrey": {
    title: "Today's class: Information & Ideas — predict, then check",
    start: "2026-07-19",
    unlock: "cumulative",
    days: [
      { n:1, focus:"Set 1 (untimed): Information & Ideas — say it before you look", minutes:0, review:0,
        tip:"Take your time — this set is untimed, so type your answer before the choices appear. For evidence and central-idea questions, write the exact claim in your own words first, then keep only the choice that truly supports it. For an inference, finish the thought the text stops just short of, using nothing but the text itself. The prediction is the work here — the letter comes after.",
        sections:[
          { skills:["Command of Evidence — Textual"], diffs:["Medium"], count:2 },
          { skills:["Central Ideas and Details"],     diffs:["Medium"], count:2 },
          { skills:["Inferences"],                    diffs:["Medium"], count:1 },
          { skills:["Inferences"],                    diffs:["Hard"],   count:1 }
        ] },
      { n:2, focus:"Set 2 (timed, ~75s): mixed — prove the check under the clock", minutes:10, review:0,
        tip:"One click to commit, about seventy-five seconds a question. Same move every time: name what the answer has to do before you open the choices, then eliminate in one pass. A choice can be completely true and still be the wrong answer — on-task beats true. Don't finish with time on the clock; spend whatever is left re-reading the two answers you were least sure of.",
        sections:[
          { skills:["Command of Evidence — Textual"], diffs:["Medium"],        count:1 },
          { skills:["Central Ideas and Details"],     diffs:["Medium"],        count:1 },
          { skills:["Inferences"],                    diffs:["Medium"],        count:1 },
          { skills:["Words in Context"],              diffs:["Easy","Medium"], count:2 },
          { skills:["Boundaries"],                    diffs:["Medium"],        count:1 },
          { skills:["Form, Structure, and Sense"],    diffs:["Medium"],        count:1 },
          { skills:["Inferences"],                    diffs:["Hard"],          count:1 }
        ] },
    ]
  },

  // Segun — week of 14 Jul. Four sets, Tue–Fri; Sat/Sun intentionally empty.
  // Every day untimed (minutes:0), so the runner asks him to TYPE the decision
  // rather than click a commit button — that written decision is the point of
  // the week.
  //
  // Days 2 and 4 split Boundaries by ruleType because the bank is lopsided
  // (Commas 33, NoPunct 12, Semi 6, Colon 4, Dash 6): an unfiltered draw is a
  // comma drill. assignments.test.js checks pool depth by skill+difficulty and
  // IGNORES ruleType, so it will NOT catch a thin ruleType draw. Day 4 was
  // tallied by hand — Semi M1+H4=5, Colon M1+H2=3, Dash M3+H3=6, each ≥ its
  // count of 2. Do not raise those counts without re-tallying.
  //
  // Rationale, and anything about the student, lives in homework/PLAN-NOTES.md.
  // This file is downloaded by his browser. Keep it free of assessment of him.
  "Segun": {
    title: "This week: boundaries and rhetorical synthesis",
    start: "2026-07-14",
    unlock: "cumulative",
    review: 0,                // ← FROZEN. This week was authored before the ladder landed;
                              //   the counts assume no review draw. Drop the line next week.
    days: [
      { n:1, focus:"Boundaries (take your time, notes open)", minutes:0,
        tip:"Two questions, in this order, before you look at the choices: is each side a complete sentence, and do the two sides belong in one sentence? Two complete sentences can only be joined by a period, a semicolon, or a comma + FANBOYS. Notes open — you are building the flowchart this week, not racing it.",
        sections:[
          { skills:["Boundaries"],          diffs:["Easy"],            count:2 },
          { skills:["Boundaries"],          diffs:["Medium"],          count:4 }
        ] },
      { n:2, focus:"Boundaries: comma, or nothing at all (notes open)", minutes:0,
        tip:"Most boundaries questions reduce to one decision: does anything belong here at all? Read the sentence with no punctuation in it first. If neither side stands alone, a semicolon and a period are both wrong before you even compare them. Write that decision out before you look at the choices.",
        sections:[
          { skills:["Boundaries"], diffs:["Easy","Medium"], ruleType:"Commas",  count:4 },
          { skills:["Boundaries"], diffs:["Easy","Medium"], ruleType:"NoPunct", count:2 }
        ] },
      { n:3, focus:"Rhetorical synthesis (take your time, notes open)", minutes:0,
        tip:"Find the 'The student wants to…' sentence and name the goal before you read a single choice: compare, define/explain, emphasize a trait, address an audience, specify, present a study, generalize, or overview. Say what the correct answer must do, then read the choices. The trap this skill is built on: a choice can be entirely true and still be off-task.",
        sections:[
          { skills:["Rhetorical Synthesis"], diffs:["Easy"],           count:2 },
          { skills:["Rhetorical Synthesis"], diffs:["Medium"],         count:4 }
        ] },
      { n:4, focus:"Boundaries: when the answer is not a comma (notes open)", minutes:0,
        tip:"The three marks you said you find hardest. Semicolon: two complete sentences, closely related. Colon: the first part sets something up, the second part delivers it — an explanation, a list, a definition. Dash: the colon's job, or a matched pair fencing off non-essential information. Name the job the mark has to do, then pick the mark.",
        sections:[
          { skills:["Boundaries"], diffs:["Medium","Hard"], ruleType:"Semi",  count:2 },
          { skills:["Boundaries"], diffs:["Medium","Hard"], ruleType:"Colon", count:2 },
          { skills:["Boundaries"], diffs:["Medium","Hard"], ruleType:"Dash",  count:2 }
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

// Days available so far (cumulative unlock by calendar day; Day 1 on start date).
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
  window.hwLoadPlan = hwLoadPlan;
  window.hwParseDate = hwParseDate;
}
