// ─────────────────────────────────────────────────────────────────
// homework/assignments.js — catalog of all homework assignments.
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
    days: [
      { n:1, focus:"Transitions",        skills:["Transitions"], diffs:["Easy","Medium"], count:6, minutes:0,
        tip:"Name the connection between the two sentences before you look at the choices." },
      { n:2, focus:"Boundaries",         skills:["Boundaries"], diffs:["Easy","Medium"], count:6, minutes:0,
        tip:"Decide whether each part is a complete sentence, then walk the punctuation flowchart." },
      { n:3, focus:"Words in Context",   skills:["Words in Context"], diffs:["Easy","Medium"], count:6, minutes:0,
        tip:"Cover the blank, predict your own word, then match it to a choice." },
      { n:4, focus:"Information & Ideas", skills:["Central Ideas and Details","Inferences"], diffs:["Medium"], count:8, minutes:0,
        tip:"For the main idea, cover the whole text. For inferences, stay close to what the text says." },
      { n:5, focus:"Command of Evidence",skills:["Command of Evidence — Textual","Command of Evidence — Quantitative"], diffs:["Medium"], count:8, minutes:0,
        tip:"Match the evidence to the whole claim. Read the figure before the choices." },
      { n:6, focus:"Mixed review",       skills:["Transitions","Boundaries","Words in Context"], diffs:["Easy","Medium","Hard"], count:6, minutes:0,
        tip:"A short mix before our session." },
    ]
  },

  // Jeffrey: Practice 8 Review
  "Jeffrey": {
    title: "Practice 8 R&W Challenge",
    start: "2026-07-09",
    unlock: "cumulative",
    days: [
      { n:1, focus:"Practice 8 R&W Challenge", minutes:20,
        tip:"This set targets the exact skills you missed on Practice Test 8. Take your time, these are all Hard difficulty.",
        sections:[
          { skills:["Words in Context"], diffs:["Hard"], count:2 },
          { skills:["Text Structure and Purpose"], diffs:["Hard"], count:1 },
          { skills:["Cross-Text Connections"], diffs:["Hard"], count:1 },
          { skills:["Command of Evidence — Textual"], diffs:["Hard"], count:2 },
          { skills:["Inferences"], diffs:["Hard"], count:3 },
          { skills:["Rhetorical Synthesis"], diffs:["Hard"], count:1 },
          { skills:["Boundaries"], diffs:["Hard"], count:3 },
          { skills:["Form, Structure, and Sense"], diffs:["Hard"], count:3 }
        ] }
    ]
  },

  // Segun (Joshua): three days on Expression of Ideas, into Monday's session.
  // He went 0/6 on Q22–27 of Practice 6 (all Expression of Ideas) — but he sat
  // that test on Jun 28, before transitions (Jun 29) or rhetorical synthesis
  // (Jul 6) had been taught, so the domain is untouched rather than broken.
  //
  // Day 1 encodes rhetorical synthesis untimed, notes open — the taxonomy is
  // two days old. Day 2 is transitions as spaced retrieval, deliberately at
  // 66s/q (under the 71s test average) because transitions should run fast and
  // bank time for the synthesis questions that follow them at the module tail.
  // Day 3 repeats Day 1's skill at Medium under a clock: if Day 1 is strong and
  // Day 3 collapses, the problem is pacing, not synthesis. That is the question
  // Monday should open with.
  //
  // Craft & Structure is deliberately absent. Bluebook rates it his strongest
  // domain (Hard, 4/4 on Practice 6); the words-in-context gap from the baseline
  // has closed. Pool check: RS = 18 Easy / 31 Medium / 21 Hard, Transitions =
  // 20 / 14 / 15, so no day repeats a question and Day 3 stays unseen-first.
  "Segun": {
    title: "This week: transitions and rhetorical synthesis, before Monday",
    start: "2026-07-10",
    unlock: "cumulative",
    days: [
      { n:1, focus:"Rhetorical synthesis (take your time, notes open)", minutes:0,
        tip:"Before you read the choices, say what the question is asking you to do: define, describe, explain, emphasize, or present a finding. Then keep only the choices that actually do that job and use the notes.",
        sections:[
          { skills:["Rhetorical Synthesis"],              diffs:["Easy"],          count:4 },
          { skills:["Rhetorical Synthesis"],              diffs:["Medium"],        count:6 }
        ] },
      { n:2, focus:"Transitions, at pace", minutes:11,
        tip:"Name the relationship between the two sentences before you look at the choices — contrast, continuation, cause and effect, or sequence. These should be quick; the time you save here is time you spend on synthesis.",
        sections:[
          { skills:["Transitions"],                       diffs:["Easy"],          count:2 },
          { skills:["Transitions"],                       diffs:["Medium"],        count:5 },
          { skills:["Transitions"],                       diffs:["Hard"],          count:3 }
        ] },
      { n:3, focus:"Rhetorical synthesis, timed (no notes)", minutes:12,
        tip:"Same questions as Day 1, now on the clock and without notes. Watch your total time, not each question. If a choice is close but leaves something out, it is wrong — move on rather than reread.",
        sections:[
          { skills:["Rhetorical Synthesis"],              diffs:["Medium"],        count:10 }
        ] }
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
