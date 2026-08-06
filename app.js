// ── Question bank (combined from domain files) ────────────────────
const questionBank = [
    ...(typeof questionBank_CS  !== 'undefined' ? questionBank_CS  : []),
    ...(typeof questionBank_EOI !== 'undefined' ? questionBank_EOI : []),
    ...(typeof questionBank_II  !== 'undefined' ? questionBank_II  : []),
    ...(typeof questionBank_CON !== 'undefined' ? questionBank_CON : []),
];

// ── Constants ─────────────────────────────────────────────────────
// The countdown shown on the home screen. It is one date for the whole app, not a
// per-student one — several students share this build, so it can only ever be the
// nearest sitting they are all working toward. Update it when that changes.
const EXAM_DATE = new Date('2026-08-23');

const TRAP_SETS = {
    'Words in Context':
        'Familiar Definition · Fancy Synonym · Connotation Mismatch',
    'Text Structure and Purpose':
        'Topic Match Function Miss · Part-for-Whole · Intensity Mismatch',
    'Cross-Text Connections':
        'One-Sided Focus · Qualification as Disagreement · Shared Topic = Agreement',
    'Rhetorical Synthesis':
        'Wrong Goal · Accurate But Off-Task · Over-Inclusive',
    'Transitions':
        'Wrong Direction · Formal Without Logic · Sequence vs. Contrast',
    'Central Ideas and Details':
        'Too Broad · Too Narrow · Distortion · Off-Topic Detail',
    'Command of Evidence — Textual':
        'Out-of-Scope · Partial Support · Contradicts Claim · Irrelevant Detail',
    'Command of Evidence — Quantitative':
        'Misread Data · Wrong Trend · Ignores Key Column · Confuses Part/Whole',
    'Inferences':
        'Too Strong · Contradicts Text · Outside Scope · Plausible But Unsupported',
    'Boundaries':
        'Comma Splice · Run-On · Unnecessary Fragment · Wrong Connector',
    'Form, Structure, and Sense':
        'Wrong Tense · Number Mismatch · Wrong Pronoun · Redundancy',
};

const SKILL_ABBR = {
    'Words in Context':                       'WIC',
    'Text Structure and Purpose':             'TSP',
    'Cross-Text Connections':                 'CTC',
    'Rhetorical Synthesis':                   'RS',
    'Transitions':                            'Trans',
    'Central Ideas and Details':              'CID',
    'Command of Evidence — Textual':     'CoE-T',
    'Command of Evidence — Quantitative':'CoE-Q',
    'Inferences':                             'Inf',
    'Boundaries':                             'Bdry',
    'Form, Structure, and Sense':             'FSS',
};

// Rhetorical Synthesis goal-type labels (derived from the practice bank).
// Goal type is set per-question in data-expression-of-ideas.js as `goalType`.
const GOAL_TYPE_LABEL = {
    'Specify':            'Specify',
    'Emphasize-Trait':    'Emphasize Trait',
    'Compare':            'Compare',
    'Define-Explain':     'Define/Explain',
    'Generalize':         'Generalize',
    'Present-Study':      'Present Study',
    'Audience-Aware':     'Audience-Aware',
    'Overview-Introduce': 'Overview / Introduce',
};

// SEC rule-type labels (Bible-rooted + bank-extended, set per-question in
// data-conventions.js as `ruleType`).
const RULE_TYPE_LABEL = {
    'SVA':     'Subject-Verb Agreement',
    'VForm':   'Verb Forms',
    'VTense':  'Verb Tense',
    'Pron':    'Pronoun Reference',
    'Poss':    'Possessives',
    'Mod':     'Modifier Placement',
    'Commas':  'Commas',
    'Semi':    'Semicolons',
    'Colon':   'Colons',
    'Dash':    'Dashes / Parens',
    'NoPunct': 'No Punctuation',
};

const SKILL_DOMAIN = {
    'Words in Context':                       'Craft & Structure',
    'Text Structure and Purpose':             'Craft & Structure',
    'Cross-Text Connections':                 'Craft & Structure',
    'Rhetorical Synthesis':                   'Expression of Ideas',
    'Transitions':                            'Expression of Ideas',
    'Central Ideas and Details':              'Information & Ideas',
    'Command of Evidence — Textual':     'Information & Ideas',
    'Command of Evidence — Quantitative':'Information & Ideas',
    'Inferences':                             'Information & Ideas',
    'Boundaries':                             'Std. English Conv.',
    'Form, Structure, and Sense':             'Std. English Conv.',
};

// The order the four domains appear in a real digital SAT R&W module. R&W is
// NOT shuffled the way the Math module is: the section runs domain by domain,
// and within a domain the questions climb from easy to hard. Anything we build
// that claims to be "SAT-style" is ordered by this, so there is one rule and
// one place to change it.
const RW_DOMAIN_ORDER = [
    'Craft & Structure',
    'Information & Ideas',
    'Std. English Conv.',
    'Expression of Ideas',
];

const DIFF_RANK = { Easy: 0, Medium: 1, Hard: 2 };

const SKILL_COUNT_IDS = {
    'Central Ideas and Details':              'count-cid',
    'Command of Evidence — Textual':     'count-coe-t',
    'Command of Evidence — Quantitative':'count-coe-q',
    'Inferences':                             'count-inf',
    'Words in Context':                       'count-wic',
    'Text Structure and Purpose':             'count-tsp',
    'Cross-Text Connections':                 'count-ctc',
    'Rhetorical Synthesis':                   'count-rs',
    'Transitions':                            'count-trans',
    'Boundaries':                             'count-bdry',
    'Form, Structure, and Sense':             'count-fss',
};

// STORAGE keys + persistence helpers live in storage.js.

// ── State ─────────────────────────────────────────────────────────
let currentQuestionIndex = 0;
let score                = 0;
let userMode             = 'assisted';
let timerInterval        = null;
let secondsElapsed       = 0;
let timerMode            = 'off';   // 'off' | 'stopwatch' | 'countdown'
let countdownTotal       = 0;       // seconds (countdown only)
let countdownRemaining   = 0;       // seconds left (countdown only)
let isAnswered           = false;
let activeQuestions      = [];
let missedQuestions      = [];
let sessionResults       = [];
let reviewMode           = false;
let questionStartTime    = null;

// ══════════════════════════════════════════════════════════════════
// EXAM COUNTDOWN
// ══════════════════════════════════════════════════════════════════

function updateExamCountdown() {
    const el = document.getElementById('examCountdown');
    if (!el) return;
    // Read the date live so the tutor's Settings change takes effect without a reload.
    const examDate = (window.MasteryConfig ? MasteryConfig.getExamDate() : EXAM_DATE);
    const diff = examDate - new Date();
    if (diff <= 0) { el.textContent = ''; return; }
    const days = Math.ceil(diff / 86_400_000);
    el.textContent = `${days} day${days !== 1 ? 's' : ''} to SAT`;
}

// ══════════════════════════════════════════════════════════════════
// SETUP SCREEN
// ══════════════════════════════════════════════════════════════════

function getSelectedSkills() {
    return Array.from(document.querySelectorAll('input[name="skill"]:checked'))
        .map(el => el.value);
}

function getSelectedDiffs() {
    return Array.from(document.querySelectorAll('input[name="diff"]:checked'))
        .map(el => el.value);
}

function getLimit() {
    return parseInt(document.getElementById('limitSelect').value);
}

function getFilteredPool() {
    const skills = getSelectedSkills();
    const diffs  = getSelectedDiffs();
    return questionBank.filter(q => skills.includes(q.skill) && diffs.includes(q.difficulty));
}

// ══════════════════════════════════════════════════════════════════
// RATIO MIX  (custom practice in a proportion — ported from the Math app)
//
// The tutor asks for "five Transitions, three Boundaries, two Words in
// Context" by ticking "Mix in a ratio", setting the shares to 3 / 2 / 1 and
// the limit to 10. Shares are RELATIVE, never counts, so the same 3:2:1
// survives changing the limit from 10 to 27.
//
// The one property everything else rests on: **the toggle, and only the
// toggle, decides whether a ratio applies.** With it off, `isRatioOn()` is
// false, the whole mechanism sits out, and `buildActiveQuestions` returns
// precisely the slice it returned before this code existed. The default
// screen, every Quick Preset, the weak-area drill and the homework runner are
// therefore untouched — none of them turn it on.
//
// The Math app infers the same intent from whether the numbers differ. Do not
// copy that here. It costs you the even split: 1-and-1 is how you would ask
// for five and five, and it is also exactly what an untouched screen looks
// like, so the request is unaskable and fails silently as "whatever the queue
// had" — which for two skills is frequently ten of one and none of the other.
// ══════════════════════════════════════════════════════════════════

function isRatioOn() {
    const el = document.getElementById('ratioToggle');
    return !!(el && el.checked);
}

// A dimension can only be apportioned if something in it has a positive share.
// All-zero weights are a contradiction ("include these, give them none"), and
// dividing by that total is a NaN quota — so the dimension stands down.
function hasShares(weights) {
    const keys = Object.keys(weights || {});
    return keys.length > 0 && keys.reduce((a, k) => a + (weights[k] || 0), 0) > 0;
}

// Skill names carry spaces, commas and em-dashes, all of which are legal inside
// a double-quoted CSS attribute value. Only a quote or a backslash would break
// the selector. Hand-rolled rather than CSS.escape() because this has to run
// under jsdom in the test suite as well as in a browser.
const _attrEsc = v => String(v).replace(/(["\\])/g, '\\$1');

// Read the weight beside each CHECKED box. Unchecked rows are absent, not
// zero — a zero weight is a real instruction ("include this skill, give it
// none of the set"), and conflating the two would make unticking a skill and
// zeroing it mean different things in the summary.
function readWeights(selector, attr, selected) {
    const out = {};
    selected.forEach(key => {
        const el = document.querySelector(`${selector}[${attr}="${_attrEsc(key)}"]`);
        let v = el ? parseFloat(el.value) : 1;
        if (!isFinite(v) || v < 0) v = 1;
        out[key] = v;
    });
    return out;
}

function getSkillWeights() {
    return readWeights('.weight-input', 'data-skill', getSelectedSkills());
}

function getDiffWeights() {
    return readWeights('.weight-input', 'data-diff', getSelectedDiffs());
}

// Largest-remainder apportionment of `count` across weighted keys.
// Plain rounding loses or invents questions — 10 split 1:1:1 rounds to 3+3+3=9,
// and the student is handed nine questions when the screen promised ten.
// Largest remainder hands the leftovers to the keys that were rounded down
// hardest, so the parts always sum to exactly `count`.
function apportion(weights, count) {
    const keys = Object.keys(weights);
    const total = keys.reduce((a, k) => a + (weights[k] || 0), 0);
    const out = {};
    if (total <= 0 || count <= 0) { keys.forEach(k => { out[k] = 0; }); return out; }
    const parts = keys.map(k => {
        const exact = count * (weights[k] || 0) / total;
        return { k, n: Math.floor(exact), rem: exact - Math.floor(exact) };
    });
    let assigned = parts.reduce((a, p) => a + p.n, 0);
    // Ties go to the key that comes first, which keeps the split deterministic.
    const byRemainder = parts.slice().sort((a, b) => b.rem - a.rem);
    let i = 0;
    while (assigned < count && byRemainder.length) {
        byRemainder[i % byRemainder.length].n++;
        assigned++;
        i++;
    }
    parts.forEach(p => { out[p.k] = p.n; });
    return out;
}

// Choose `count` from an ALREADY-QUEUED pool, honouring the skill and
// difficulty shares as closely as the pool allows.
//
// `pool` arrives in the order prioritizePool built — unseen first, then misses,
// least-recent first. Every pass below walks it in that order and only ever
// filters, so within a quota the student still gets the questions he most
// needs. The ratio decides how MANY of each; the queue decides WHICH.
//
// ── The difficulty split is PER SKILL, not across the set ──────────
//
// The obvious implementation treats the two dimensions as independent
// marginals: apportion `count` by skill, apportion `count` by difficulty, and
// take anything that fits both. It satisfies both sets of totals and is wrong
// in a way that only shows up in the interior. Measured on this bank, Cross-Text
// 1 : Transitions 1 crossed with Medium 1 : Hard 1 at a limit of 10 gave
//
//     Cross-Text  4 Hard / 1 Medium        Transitions  1 Hard / 4 Medium
//
// Five of each skill and five of each difficulty — both marginals exactly
// right — and yet almost all the Hard landed on one skill. Nothing is wrong
// with the arithmetic; the first pass simply walks the queue and whichever
// cell it meets first eats the allowance. A tutor who sets both dimensions
// means "half of EACH skill hard", and that is a claim about the cells.
//
// So: apportion by skill first, then apportion each skill's quota by
// difficulty. The grid is the target; the marginals fall out of it.
//
// Three passes per cell, because a cell the pool cannot fill must not cost the
// set its length. Cross-Text with no Hard questions left still owes its skill
// quota, so the shortfall is spent on that skill's other difficulties before
// anything else claims it — the skill split is the stronger promise, since it
// is the one the tutor states first. Only after every cell and every skill has
// had its turn does the set backfill in raw queue order. A quota the pool
// cannot satisfy degrades; it never truncates the session.
function allocateByRatio(pool, count, diffWeights, skillWeights) {
    const diffOn  = hasShares(diffWeights);
    const skillOn = hasShares(skillWeights);
    if (!diffOn && !skillOn) return pool.slice(0, count);

    const picked = [];
    const used   = new Set();
    const sweep = accept => {
        for (const q of pool) {
            if (picked.length >= count) return;
            if (used.has(q)) continue;
            if (accept(q)) { picked.push(q); used.add(q); }
        }
    };

    // "Still owed" counters. `claim` spends one if the quota has room, and says
    // whether it did — a sweep takes the question only when something was spent,
    // so a counter can never go negative and a question is never double-counted.
    const claim = (bucket, key) => {
        if (!bucket || !(bucket[key] > 0)) return false;
        bucket[key]--;
        return true;
    };

    // Difficulty only. No skill shares to nest inside, so this is the plain
    // one-dimensional case.
    if (!skillOn) {
        const owedDiff = apportion(diffWeights, count);
        sweep(q => claim(owedDiff, q.difficulty));
        sweep(() => true);
        return picked;
    }

    const owedSkill = apportion(skillWeights, count);

    // Skill only.
    if (!diffOn) {
        sweep(q => claim(owedSkill, q.skill));
        sweep(() => true);
        return picked;
    }

    // Both — every skill's quota is itself split by the difficulty shares.
    const owedCell = {};                        // skill → { difficulty → still owed }
    Object.keys(owedSkill).forEach(s => {
        owedCell[s] = apportion(diffWeights, owedSkill[s]);
    });

    // Pass 1 · fill the grid cell by cell. Spending a cell also spends the
    // skill's overall quota, so pass 2 only ever sees a genuine shortfall.
    sweep(q => {
        if (!claim(owedCell[q.skill], q.difficulty)) return false;
        owedSkill[q.skill]--;
        return true;
    });
    // Pass 2 · a cell the pool ran dry on is made up from the SAME skill at any
    // difficulty, so the skill split survives a difficulty the bank is thin in.
    sweep(q => claim(owedSkill, q.skill));
    // Pass 3 · whatever is still short comes from the queue, weakest first.
    sweep(() => true);

    return picked;
}

// How big a set can honour this ratio exactly, given what the pool actually
// holds? Used for "All matching questions", where there is no total to divide.
// Without this, picking a ratio and leaving the limit on "All" would appear to
// do nothing — the least useful possible outcome of setting a ratio.
//
// For each key, `have / share` is how many whole sets its supply can cover; the
// scarcest key sets the ceiling. Two Cross-Text questions at a 1-in-5 share
// caps the sitting at ten, not at the eighty the other skills could fill.
function ratioCapacity(pool, weights, keyOf) {
    const keys  = Object.keys(weights);
    const total = keys.reduce((a, k) => a + (weights[k] || 0), 0);
    if (total <= 0) return 0;
    let cap = Infinity;
    keys.forEach(k => {
        const share = weights[k] || 0;
        if (share <= 0) return;                 // a zero-weight key never binds
        const have = pool.filter(q => keyOf(q) === k).length;
        cap = Math.min(cap, Math.floor(have * total / share));
    });
    return isFinite(cap) ? cap : pool.length;
}

// The set size to apportion when the limit is "All matching questions".
function ratioTotalForWholePool(pool, diffWeights, skillWeights) {
    let cap = pool.length;
    if (hasShares(diffWeights))  cap = Math.min(cap, ratioCapacity(pool, diffWeights,  q => q.difficulty));
    if (hasShares(skillWeights)) cap = Math.min(cap, ratioCapacity(pool, skillWeights, q => q.skill));
    return cap;
}

// Order a set the way a real R&W module is ordered: domain by domain in
// RW_DOMAIN_ORDER, and easy → hard inside each domain. Skills interleave
// within their domain exactly as they do on the test.
//
// This is where R&W deliberately parts company with the Math app, which
// shuffles its custom set — Math genuinely is presented mixed. Copying the
// shuffle here would teach a question order the student will never meet.
//
// Array.prototype.sort is stable, so questions tied on domain AND difficulty
// keep the queue order prioritizePool gave them: the weakest still come first
// within the block.
function orderSATStyle(questions) {
    const domainRank = skill => {
        const i = RW_DOMAIN_ORDER.indexOf(SKILL_DOMAIN[skill]);
        return i === -1 ? RW_DOMAIN_ORDER.length : i;   // unmapped skills sort last
    };
    return questions.slice().sort((a, b) => {
        const d = domainRank(a.skill) - domainRank(b.skill);
        if (d !== 0) return d;
        const ra = DIFF_RANK[a.difficulty], rb = DIFF_RANK[b.difficulty];
        return (ra === undefined ? 1 : ra) - (rb === undefined ? 1 : rb);
    });
}

// Split a pool by whether the student has already answered it correctly.
//   • fresh  = never seen (unseen) OR previously missed (needs review)
//   • parked = answered correctly with no pending miss (soft- or fully-mastered)
// A practice session serves fresh questions first; parked ones are only pulled
// back in to fill a requested limit, or when no fresh questions remain — so a
// question you got right doesn't reappear in the very next session.
function splitPoolByFreshness(pool) {
    const ledger = getProgress();
    const fresh = [], parked = [];
    pool.forEach(q => {
        (_isResting(ledger[q.id]) ? parked : fresh).push(q);
    });
    return { fresh, parked };
}

function buildActiveQuestions() {
    const limit    = getLimit();
    const diffW    = getDiffWeights();
    const skillW   = getSkillWeights();
    const ratioOn  = isRatioOn() && (hasShares(diffW) || hasShares(skillW));
    const { fresh, parked } = splitPoolByFreshness(getFilteredPool());
    const orderedFresh = prioritizePool(fresh);   // unseen first, then misses

    if (limit > 0) {
        // The candidate queue the ratio draws from. Parked (already-correct)
        // questions are appended, least-recent first, exactly as before — a
        // ratio must not be denied its quota just because the fresh questions
        // for that skill have run out this week.
        const ledger = (typeof getProgress === 'function') ? getProgress() : {};
        const topUp  = parked.slice().sort((a, b) =>
            ((ledger[a.id] && ledger[a.id].lastSeen) || 0) -
            ((ledger[b.id] && ledger[b.id].lastSeen) || 0));
        const queue = orderedFresh.concat(topUp);

        if (!ratioOn) {
            // Unchanged: fresh first, top up only if fresh runs short.
            return orderedFresh.length >= limit
                ? orderedFresh.slice(0, limit)
                : queue.slice(0, limit);
        }
        return orderSATStyle(allocateByRatio(queue, limit, diffW, skillW));
    }

    // "All matching questions": serve only what's genuinely due. When nothing is
    // due (everything answered recently or mastered) this is empty, and the setup
    // screen shows a "caught up" state instead of re-serving what you just answered.
    if (!ratioOn) return orderedFresh;

    // A ratio with no stated total means "the biggest set this ratio can fill
    // from what's due" — see ratioTotalForWholePool.
    const total = ratioTotalForWholePool(orderedFresh, diffW, skillW);
    if (total <= 0) return [];
    return orderSATStyle(allocateByRatio(orderedFresh, total, diffW, skillW));
}

// Launch a session over the whole filtered pool, ignoring the review cooldown.
// Used by the "practice anyway" link when everything is resting.
function startPracticeAnyway() {
    const setupModeEl = document.getElementById('setupModeSelect');
    const mode  = setupModeEl ? setupModeEl.value : 'assisted';
    const tModeEl = document.getElementById('timerModeSelect');
    const tmode = tModeEl ? tModeEl.value : 'off';
    let total = 600;
    if (tmode === 'countdown') {
        const durEl = document.getElementById('timerDurationSelect');
        total = durEl ? Math.max(60, Math.min(10800, (parseInt(durEl.value, 10) || 10) * 60)) : 600;
    }
    const limit  = getLimit();
    const diffW  = getDiffWeights();
    const skillW = getSkillWeights();
    const pool   = prioritizePool(getFilteredPool());
    let qs = pool;
    if (isRatioOn() && (hasShares(diffW) || hasShares(skillW))) {
        // The ratio holds here too. "Practice anyway" ignores the review
        // cooldown, not the mix the tutor asked for.
        const total = limit > 0 ? limit : ratioTotalForWholePool(pool, diffW, skillW);
        qs = orderSATStyle(allocateByRatio(pool, total, diffW, skillW));
    } else if (limit > 0) {
        qs = pool.slice(0, limit);
    }
    launchSession(qs, mode, { mode: tmode, total });
}

// ══════════════════════════════════════════════════════════════════
// SESSION LAUNCH  (shared by Start button, weak-area drill, mock exam)
// ══════════════════════════════════════════════════════════════════

function launchSession(questions, mode, timer) {
    if (!questions || questions.length === 0) return false;
    activeQuestions = questions;
    reviewMode      = false;
    missedQuestions = [];
    sessionResults  = [];
    mockExam        = false;
    userMode        = mode || 'assisted';
    const headerModeEl = document.getElementById('modeSelect');
    if (headerModeEl) headerModeEl.value = userMode;
    resetProgress();
    clearSessionState();
    timer     = timer || {};
    timerMode = timer.mode || 'off';
    if (timerMode === 'countdown') {
        countdownTotal     = timer.total || 600;
        countdownRemaining = countdownTotal;
    }
    document.getElementById('hubScreen').style.display        = 'none';
    document.getElementById('setupScreen').style.display      = 'none';
    document.getElementById('completionScreen').style.display = 'none';
    document.getElementById('app').style.display              = 'flex';
    loadQuestion(0);
    applyTimerState();
    _pushScreen('session');
    return true;
}

// End-of-session finalisation (shared by Next on the last question + time-up).
function finalizeSession() {
    stopTimer();
    clearSessionState();
    const skills = [...new Set(activeQuestions.map(q => q.skill))];
    const diffs  = [...new Set(activeQuestions.map(q => q.difficulty))];
    logSession(skills, diffs, score, activeQuestions.length);
    mockScoreEstimate = mockExam ? estimateRWScore(score, activeQuestions.length) : null;
    mockExam = false;
    showCompletion();
    _pushScreen('completion');
}

// ══════════════════════════════════════════════════════════════════
// WEAK-AREA DRILL  (one-tap, coached, untimed — missed + weakest skills)
// ══════════════════════════════════════════════════════════════════

function buildWeakAreaSet(limit) {
    limit = limit || 15;
    const ledger = getProgress();
    const skills = [...new Set(questionBank.map(q => q.skill))];
    const rate = {};
    skills.forEach(s => {
        const sum = getPoolSummary(questionBank.filter(q => q.skill === s));
        rate[s] = sum.total ? sum.mastered / sum.total : 0;
    });
    // Questions he's missed (and not yet mastered) come first.
    const needsWork = questionBank.filter(q => {
        const r = ledger[q.id];
        return r && (r.wrong || 0) > 0 && !_isMastered(r);
    });
    // Then unseen questions, weakest skills first.
    const unseen = questionBank.filter(q => !ledger[q.id]);
    unseen.sort((a, b) => rate[a.skill] - rate[b.skill]);
    return _fyShuffle(needsWork).concat(unseen).slice(0, limit);
}

function startWeakAreaDrill() {
    const set = buildWeakAreaSet(15);
    if (set.length === 0) { alert('No questions available yet.'); return; }
    launchSession(set, 'assisted', { mode: 'off' });
}

// ══════════════════════════════════════════════════════════════════
// MOCK SAT — READING & WRITING  (one module)
// Mirrors a real digital R&W module: 27 questions, 32 minutes, ordered by
// domain in the College Board blueprint proportions, a realistic
// easy/medium/hard spread, exam conditions (no feedback, blind score), and
// an estimated 200–800 R&W section score at the end.
// ══════════════════════════════════════════════════════════════════

const MOCK_MODULE_SIZE    = 27;
const MOCK_MODULE_SECONDS = 32 * 60;            // 32 minutes
// Domain → #questions (≈ blueprint weights). The ORDER here is not the
// presentation order — orderSATStyle owns that, via RW_DOMAIN_ORDER. Keeping
// the two in step by eye is how they drift, so this only says how many.
const MOCK_DOMAIN_MIX     = [
    ['Craft & Structure',   8],                 // ~28%
    ['Information & Ideas', 7],                 // ~26%
    ['Std. English Conv.',  7],                 // ~26%
    ['Expression of Ideas', 5],                 // ~20%
];
let mockExam          = false;
let mockScoreEstimate = null;

function buildMockExam() {
    const out  = [];
    MOCK_DOMAIN_MIX.forEach(([domain, n]) => {
        const pool = questionBank.filter(q => SKILL_DOMAIN[q.skill] === domain);
        const byDiff = {
            Easy:   _fyShuffle(pool.filter(q => q.difficulty === 'Easy')),
            Medium: _fyShuffle(pool.filter(q => q.difficulty === 'Medium')),
            Hard:   _fyShuffle(pool.filter(q => q.difficulty === 'Hard')),
        };
        // Realistic level spread per domain: ~30% Easy, ~45% Medium, ~25% Hard.
        const tE = Math.round(n * 0.30), tH = Math.round(n * 0.25), tM = n - tE - tH;
        const picked = [];
        const take = (arr, k) => { while (k-- > 0 && arr.length) picked.push(arr.shift()); };
        take(byDiff.Easy, tE); take(byDiff.Medium, tM); take(byDiff.Hard, tH);
        // Backfill if a domain is thin in a difficulty.
        const rest = _fyShuffle([...byDiff.Easy, ...byDiff.Medium, ...byDiff.Hard]);
        while (picked.length < n && rest.length) picked.push(rest.shift());
        out.push(...picked);
    });
    // Domain blocks in test order, easy → hard within each. Same rule the
    // custom ratio set uses; changing one changes both, on purpose.
    return orderSATStyle(out);
}

function startMockExam() {
    if (!confirm(
        'Mock SAT — Reading & Writing module\n\n' +
        '27 questions · 32 minutes · timed, no feedback until the end — just like the real test.\n' +
        "You'll get an estimated R&W score (200–800) at the finish.\n\n" +
        'Start now?')) return;
    if (!launchSession(buildMockExam(), 'exam', { mode: 'countdown', total: MOCK_MODULE_SECONDS })) return;
    mockExam = true;
}

// Approximate digital SAT R&W section score (200–800) from raw % on the module.
// Anchored to typical conversion curves; clearly an estimate, not official.
function estimateRWScore(correct, total) {
    const pct = total ? correct / total : 0;
    const pts = [[0,200],[0.2,300],[0.35,420],[0.5,520],[0.6,580],[0.7,640],[0.8,700],[0.9,750],[1,800]];
    for (let i = 1; i < pts.length; i++) {
        if (pct <= pts[i][0]) {
            const a = pts[i - 1], b = pts[i];
            return Math.round((a[1] + (b[1] - a[1]) * (pct - a[0]) / (b[0] - a[0])) / 10) * 10;
        }
    }
    return 800;
}

// A share box is live only while the ratio is switched on AND its own skill is
// ticked. An editable box that nothing reads is a lie: the tutor types 3 / 2 / 1,
// sees the numbers sitting there, and gets a set built by something else.
function syncWeightInputs() {
    const on = isRatioOn();
    document.querySelectorAll('input[name="skill"]').forEach(cb => {
        const w = document.querySelector(`.weight-input[data-skill="${_attrEsc(cb.value)}"]`);
        if (w) w.disabled = !on || !cb.checked;
    });
    document.querySelectorAll('input[name="diff"]').forEach(cb => {
        const w = document.querySelector(`.weight-input[data-diff="${_attrEsc(cb.value)}"]`);
        if (w) w.disabled = !on || !cb.checked;
    });
}

// "Trans 5 · Bdry 3 · WIC 2" — the mix actually built, in the order it will be
// served. What the tutor asked for and what the pool could supply are not
// always the same thing, so this reports the SET, never the requested ratio.
function describeMix(questions) {
    const counts = new Map();
    questions.forEach(q => counts.set(q.skill, (counts.get(q.skill) || 0) + 1));
    return [...counts.entries()]
        .map(([skill, n]) => `${SKILL_ABBR[skill] || skill} ${n}`)
        .join(' \xb7 ');
}

function updateSetupUI() {
    syncWeightInputs();

    const diffs = getSelectedDiffs();

    Object.entries(SKILL_COUNT_IDS).forEach(([skill, id]) => {
        const el = document.getElementById(id);
        if (!el) return;
        const n = questionBank.filter(
            q => q.skill === skill && diffs.includes(q.difficulty)
        ).length;
        el.textContent = n + ' q';
    });

    const filtered  = getFilteredPool();
    const limit     = getLimit();
    // Reflect the real session the builder will produce (correct answers held back).
    const built     = buildActiveQuestions();
    const total     = built.length;
    const ratioOn   = isRatioOn() && (hasShares(getDiffWeights()) || hasShares(getSkillWeights()));
    const excluded  = (limit === 0) ? (filtered.length - total) : 0;
    const summaryEl = document.getElementById('sessionSummary');
    const startBtn  = document.getElementById('startSessionBtn');

    if (filtered.length === 0) {
        summaryEl.textContent = 'No questions match — adjust your selections.';
        summaryEl.className   = 'session-summary session-summary-empty';
        startBtn.disabled     = true;
    } else {
        const labels      = getSelectedSkills().map(s => SKILL_ABBR[s] || s);
        const allMastered = isPoolAllMastered(filtered);
        if (allMastered) {
            summaryEl.innerHTML =
                `${total} question${total !== 1 ? 's' : ''} &mdash; all mastered &mdash; ` +
                `<a href="#" onclick="resetLedger();updateSetupUI();return false;" ` +
                `style="color:var(--primary);font-weight:700">reset progress</a>`;
            summaryEl.className = 'session-summary session-summary-mastered';
            startBtn.disabled   = false;
        } else if (total === 0) {
            summaryEl.innerHTML =
                `All caught up &mdash; you&rsquo;ve practised these recently. ` +
                `They reopen for review over the next day. ` +
                `<a href="#" onclick="startPracticeAnyway();return false;" ` +
                `style="color:var(--primary);font-weight:700">practice anyway</a>`;
            summaryEl.className = 'session-summary';
            startBtn.disabled   = true;
        } else {
            const note = excluded > 0
                ? ` \xb7 ${excluded} already correct (hidden)` : '';
            // With a ratio on, the per-skill counts ARE the useful information —
            // "WIC + Trans + Bdry" doesn't tell you whether you got 5/3/2 or
            // 8/1/1. Show the realised mix instead of the skill list.
            const body = ratioOn
                ? describeMix(built)
                : labels.join(' + ');
            summaryEl.textContent =
                `${total} question${total !== 1 ? 's' : ''} — ${body} — ${diffs.join(' \xb7 ')}${note}`;
            summaryEl.className = 'session-summary';
            startBtn.disabled   = false;
        }
    }
}

function applyPreset(btn) {
    const skills = btn.dataset.skills.split(',');
    const diffs  = btn.dataset.diffs.split(',');

    document.querySelectorAll('input[name="skill"]').forEach(el => {
        el.checked = skills.includes(el.value);
    });
    document.querySelectorAll('input[name="diff"]').forEach(el => {
        el.checked = diffs.includes(el.value);
    });
    // A preset states a whole set-up, so it clears any ratio left over from the
    // last one. Without this, "Craft & Structure · All" would quietly inherit a
    // 3:1 mix from a click two minutes ago and serve a set nobody asked for.
    const ratioToggle = document.getElementById('ratioToggle');
    if (ratioToggle) ratioToggle.checked = false;
    document.querySelectorAll('.weight-input').forEach(el => { el.value = '1'; });
    document.getElementById('limitSelect').value = btn.dataset.limit;
    updateSetupUI();
}

function enterPractice() {
    document.getElementById('hubScreen').style.display = 'none';
    showSetup();
    _pushScreen('setup');
}

function goToHub() {
    stopTimer();
    document.getElementById('setupScreen').style.display      = 'none';
    document.getElementById('completionScreen').style.display = 'none';
    document.getElementById('app').style.display              = 'none';
    document.getElementById('hubScreen').style.display        = 'flex';
    renderDueToday();
    _pushScreen('hub');
}

// ── In-app browser-history integration ──────────────────────────────
// Each forward screen transition pushes a history entry; the browser's
// back button (or popstate from history.back()) shows the previous
// screen instead of exiting the page. Hub is the implicit initial
// state (history.state === null), so back from Hub still exits.

function _pushScreen(name) {
    // Avoid pushing duplicate consecutive entries.
    if (history.state && history.state.mScreen === name) return;
    history.pushState({ mScreen: name }, '');
}

function _showScreenOnly(name) {
    document.getElementById('hubScreen').style.display        = 'none';
    document.getElementById('setupScreen').style.display      = 'none';
    document.getElementById('app').style.display              = 'none';
    document.getElementById('completionScreen').style.display = 'none';
    switch (name) {
        case 'setup':
            stopTimer();
            document.getElementById('setupScreen').style.display = 'flex';
            break;
        case 'session':
            document.getElementById('app').style.display = 'flex';
            break;
        case 'completion':
            document.getElementById('completionScreen').style.display = 'flex';
            break;
        case 'hub':
        default:
            document.getElementById('hubScreen').style.display = 'flex';
            break;
    }
}

window.addEventListener('popstate', e => {
    _showScreenOnly(e.state && e.state.mScreen ? e.state.mScreen : 'hub');
});

function showSetup() {
    stopTimer();
    document.getElementById('timerDisplay').classList.add('hidden');
    document.getElementById('setupScreen').style.display      = 'flex';
    document.getElementById('app').style.display              = 'none';
    document.getElementById('completionScreen').style.display = 'none';
    updateSetupUI();
    updateExamCountdown();
    renderHistory();
    renderLifetimeStats();
    renderTopTraps();
    renderBackupReminder();
    checkForSavedSession();
}

function hideSetup() {
    document.getElementById('setupScreen').style.display = 'none';
    document.getElementById('app').style.display         = 'flex';
}

// ══════════════════════════════════════════════════════════════════
// COMPLETION SCREEN
// ══════════════════════════════════════════════════════════════════

function showCompletion() {
    const total   = activeQuestions.length;
    const pct     = Math.round((score / total) * 100);
    // Prefer per-question times — works in all modes, not just exam
    const perQSum = sessionResults.reduce((sum, r) => sum + (r.secs || 0), 0);
    const duration= perQSum > 0 ? perQSum : secondsElapsed;
    const mins    = Math.floor(duration / 60);
    const secs    = duration % 60;
    const avgSecs = total > 0 ? Math.round(duration / total) : 0;

    document.getElementById('completionBigScore').textContent = `${score} / ${total}`;
    const pctEl = document.getElementById('completionPct');
    pctEl.textContent = `${pct}%`;
    pctEl.className   = 'completion-pct ' +
        (pct >= 80 ? 'pct-pass' : pct >= 60 ? 'pct-warn' : 'pct-fail');

    const timeEl = document.getElementById('completionTime');
    if (timeEl && duration > 0) {
        timeEl.textContent   = `${mins}m ${secs}s total · ${avgSecs}s per question`;
        timeEl.style.display = 'block';
    }

    // Mock-exam estimated R&W score (200–800)
    const mockEl = document.getElementById('mockScore');
    if (mockEl) {
        if (mockScoreEstimate != null) {
            mockEl.innerHTML = `Estimated SAT R&amp;W score &nbsp;<b>~${mockScoreEstimate}</b>` +
                ` <span class="mock-score-note">/ 800 · approximate</span>`;
            mockEl.style.display = 'block';
        } else {
            mockEl.style.display = 'none';
        }
    }

    // Per-skill breakdown
    const stats = {};
    sessionResults.forEach(r => {
        if (!stats[r.q.skill]) stats[r.q.skill] = { correct: 0, total: 0 };
        stats[r.q.skill].total++;
        if (r.isCorrect) stats[r.q.skill].correct++;
    });

    document.getElementById('skillBreakdown').innerHTML =
        Object.entries(stats).map(([skill, s]) => {
            const p   = Math.round(s.correct / s.total * 100);
            const cls = p >= 80 ? 'bd-pass' : p >= 60 ? 'bd-warn' : 'bd-fail';
            const bar = Math.round(p / 5);
            return `
            <div class="breakdown-row">
                <span class="breakdown-skill">${SKILL_ABBR[skill] || skill}</span>
                <span class="breakdown-bar">${'█'.repeat(bar)}${'░'.repeat(20 - bar)}</span>
                <span class="breakdown-score ${cls}">${s.correct}/${s.total} (${p}%)</span>
            </div>`;
        }).join('');

    // Goal-type breakdown for Rhetorical Synthesis (only when RS in this session)
    const goalEl = document.getElementById('goalTypeBreakdown');
    if (goalEl) {
        const goalStats = {};
        sessionResults.forEach(r => {
            if (r.q.skill !== 'Rhetorical Synthesis' || !r.q.goalType) return;
            if (!goalStats[r.q.goalType]) goalStats[r.q.goalType] = { correct: 0, total: 0 };
            goalStats[r.q.goalType].total++;
            if (r.isCorrect) goalStats[r.q.goalType].correct++;
        });

        if (Object.keys(goalStats).length === 0) {
            goalEl.innerHTML = '';
            goalEl.style.display = 'none';
        } else {
            goalEl.style.display = '';
            goalEl.innerHTML =
                '<div class="breakdown-subhead">RS Goal Types</div>' +
                Object.entries(goalStats).map(([gt, s]) => {
                    const p   = Math.round(s.correct / s.total * 100);
                    const cls = p >= 80 ? 'bd-pass' : p >= 60 ? 'bd-warn' : 'bd-fail';
                    const bar = Math.round(p / 5);
                    return `
                    <div class="breakdown-row">
                        <span class="breakdown-skill">${GOAL_TYPE_LABEL[gt] || gt}</span>
                        <span class="breakdown-bar">${'█'.repeat(bar)}${'░'.repeat(20 - bar)}</span>
                        <span class="breakdown-score ${cls}">${s.correct}/${s.total} (${p}%)</span>
                    </div>`;
                }).join('');
        }
    }

    // Rule-type breakdown for Standard English Conventions (only when SEC in this session)
    const ruleEl = document.getElementById('ruleTypeBreakdown');
    if (ruleEl) {
        const ruleStats = {};
        sessionResults.forEach(r => {
            const isSec = r.q.skill === 'Boundaries' || r.q.skill === 'Form, Structure, and Sense';
            if (!isSec || !r.q.ruleType) return;
            if (!ruleStats[r.q.ruleType]) ruleStats[r.q.ruleType] = { correct: 0, total: 0 };
            ruleStats[r.q.ruleType].total++;
            if (r.isCorrect) ruleStats[r.q.ruleType].correct++;
        });

        if (Object.keys(ruleStats).length === 0) {
            ruleEl.innerHTML = '';
            ruleEl.style.display = 'none';
        } else {
            ruleEl.style.display = '';
            ruleEl.innerHTML =
                '<div class="breakdown-subhead">SEC Rules</div>' +
                Object.entries(ruleStats).map(([rt, s]) => {
                    const p   = Math.round(s.correct / s.total * 100);
                    const cls = p >= 80 ? 'bd-pass' : p >= 60 ? 'bd-warn' : 'bd-fail';
                    const bar = Math.round(p / 5);
                    return `
                    <div class="breakdown-row">
                        <span class="breakdown-skill">${RULE_TYPE_LABEL[rt] || rt}</span>
                        <span class="breakdown-bar">${'█'.repeat(bar)}${'░'.repeat(20 - bar)}</span>
                        <span class="breakdown-score ${cls}">${s.correct}/${s.total} (${p}%)</span>
                    </div>`;
                }).join('');
        }
    }

    const missedListEl  = document.getElementById('missedList');
    const reviewBtn     = document.getElementById('reviewMissedBtn');
    const missedHeading = document.getElementById('missedHeading');

    if (missedQuestions.length === 0) {
        missedHeading.textContent = 'All correct — no misses this session';
        missedListEl.innerHTML    = '';
        reviewBtn.style.display   = 'none';
    } else {
        missedHeading.textContent = `Missed (${missedQuestions.length})`;
        document.getElementById('missedCount').textContent = missedQuestions.length;
        reviewBtn.style.display = 'flex';

        missedListEl.innerHTML = missedQuestions.map(({ q, selected }) => {
            const shortQ    = q.question.length > 120
                ? q.question.slice(0, 120) + '…' : q.question;
            const opts      = (q.options && q.options.length) ? q.options : ['A', 'B', 'C', 'D'];
            // Match by leading letter so bare-letter (snapshot) options work too.
            const optText   = ltr => {
                const o = opts.find(x => x.trim()[0] === ltr);
                return o ? o.trim().slice(2).trim() : '';
            };
            const wrongLabel = selected ? `${selected}. ${optText(selected)}`.trim() : 'Not answered';
            const rightLabel = `${q.answer}. ${optText(q.answer)}`.trim();
            const imgThumb  = q.image
                ? `<img class="missed-thumb" src="${escapeHtml(q.image)}" alt="Question figure" loading="lazy">` : '';
            const diffCls   = q.difficulty === 'Easy' ? 'badge-green'
                            : q.difficulty === 'Hard' ? 'badge-red' : 'badge-orange';
            return `
            <div class="missed-item">
                <div class="missed-meta">
                    <span class="badge ${diffCls}" style="font-size:0.65rem">${q.difficulty}</span>
                    <span class="missed-skill">${SKILL_ABBR[q.skill] || q.skill}</span>
                </div>
                <div class="missed-q">${escapeHtml(shortQ)}</div>
                ${imgThumb}
                <div class="missed-answers">
                    <span class="missed-wrong">✗ ${escapeHtml(wrongLabel)}</span>
                    <span class="missed-right">✓ ${escapeHtml(rightLabel)}</span>
                </div>
            </div>`;
        }).join('');
    }

    document.getElementById('completionScreen').style.display = 'flex';
    document.getElementById('app').style.display              = 'none';
}

function hideCompletion() {
    document.getElementById('completionScreen').style.display = 'none';
}

function startReviewMissed() {
    const toReview  = missedQuestions.map(m => m.q);
    reviewMode      = true;
    activeQuestions = toReview;
    missedQuestions = [];
    sessionResults  = [];
    hideCompletion();
    resetProgress();
    hideSetup();
    document.getElementById('app').style.display = 'flex';
    loadQuestion(0);
}

// ══════════════════════════════════════════════════════════════════
// PASSAGE FORMATTING
// ══════════════════════════════════════════════════════════════════

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function tryBuildHTMLTable(lines) {
    for (let n = 2; n <= 4; n++) {
        const rows = lines.map(l => l.trim().split(/\s{2,}/));
        if (rows.every(r => r.length === n) && rows.length >= 2) {
            const th = rows[0].map(h => `<th>${escapeHtml(h)}</th>`).join('');
            const td = rows.slice(1).map(r =>
                `<tr>${r.map(c => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`
            ).join('');
            return `<table class="data-table-html"><thead><tr>${th}</tr></thead><tbody>${td}</tbody></table>`;
        }
    }
    return null;
}

function formatCoEQ(text) {
    const lines   = text.split('\n');
    const blocks  = [];
    let current   = { label: '', lines: [] };

    lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) {
            if (current.lines.length > 0) { blocks.push(current); current = { label: '', lines: [] }; }
            return;
        }
        if (/^(Table\s*\d*|Figure\s*\d*|Graph\s*\d*|Chart\s*\d*|Note:|Source:)/i.test(trimmed)) {
            if (current.lines.length > 0) { blocks.push(current); current = { label: '', lines: [] }; }
            current.label = trimmed;
        } else {
            current.lines.push(trimmed);
        }
    });
    if (current.lines.length > 0) blocks.push(current);

    return blocks.map(b => {
        const labelHtml = b.label
            ? `<div class="data-block-label">${escapeHtml(b.label)}</div>` : '';
        const tableHtml = tryBuildHTMLTable(b.lines);
        const bodyHtml  = tableHtml
            ? tableHtml
            : `<pre class="data-pre">${escapeHtml(b.lines.join('\n'))}</pre>`;
        return `<div class="data-block">${labelHtml}${bodyHtml}</div>`;
    }).join('');
}

// Escape HTML but keep <u>…</u> markup so "underlined claim" questions show the underline.
function escapePassage(str) {
    return escapeHtml(str).replace(/&lt;u&gt;/g, '<u>').replace(/&lt;\/u&gt;/g, '</u>');
}

function formatPassage(text, skill) {
    if (!text) {
        if (skill === 'Boundaries' || skill === 'Form, Structure, and Sense') {
            return '<em class="no-passage-note">Sentence is embedded in the question →</em>';
        }
        return '<em>No passage for this question.</em>';
    }

    let html = text.replace(/ﬁ/g, 'fi').replace(/ﬂ/g, 'fl');

    if (skill === 'Command of Evidence — Quantitative') {
        return formatCoEQ(html);
    }

    if (skill === 'Cross-Text Connections') {
        const t2idx = html.search(/\bText\s*2\b/i);
        if (t2idx !== -1) {
            const t1 = escapePassage(html.slice(0, t2idx).trim());
            const t2 = escapePassage(html.slice(t2idx).trim());
            return `<div class="cross-text-label">Text 1</div>
            <div class="cross-text-body">${t1}</div>
            <div class="cross-text-label cross-text-label-2">Text 2</div>
            <div class="cross-text-body">${t2}</div>`;
        }
    }

    if (skill === 'Rhetorical Synthesis') {
        const colonIdx = html.indexOf(':');
        if (colonIdx !== -1) {
            const intro    = escapeHtml(html.substring(0, colonIdx + 1));
            const notesRaw = html.substring(colonIdx + 1).trim();
            const notes    = notesRaw.split(/(?<=\.)\s+(?=[A-Z“‘"])/);
            const items    = notes.map(n => n.trim()).filter(n => n)
                .map(n => `<li>${escapeHtml(n)}</li>`).join('');
            return `<p class="rs-intro">${intro}</p><ul class="rs-notes">${items}</ul>`;
        }
    }

    if (skill === 'Transitions') {
        html = escapeHtml(html);
        html = html.replace(/_{4,}/g, '<span class="trans-blank">______</span>');
        return html;
    }

    if (skill === 'Boundaries' || skill === 'Form, Structure, and Sense') {
        html = escapeHtml(html);
        html = html.replace(/_{4,}/g, '<span class="q-blank">______</span>');
        return html;
    }

    return escapePassage(html);
}

function buildStrategyHint(skill) {
    switch (skill) {
        case 'Words in Context':
            return '<strong>Two-Filter Method</strong><br>' +
                'Predict the meaning from context &mdash; then apply:<br>' +
                '<strong>Filter 1:</strong> Logical sense?&nbsp;&nbsp;' +
                '<strong>Filter 2:</strong> Right <em>tone and intensity</em>?';
        case 'Text Structure and Purpose':
            return '<strong>Function Map</strong><br>' +
                'What is the author <em>doing</em> &mdash; not what it\'s about.<br>' +
                '<em>Argues &middot; Describes &middot; Explains &middot; Compares &middot; Challenges &middot; Supports &middot; Narrates</em>';
        case 'Cross-Text Connections':
            return '<strong>Perspective Synthesis</strong><br>' +
                'Summarise each text in one sentence, then name the relationship:<br>' +
                '<em>Agreement &middot; Disagreement &middot; Extension &middot; Qualification &middot; Exemplification</em>';
        case 'Rhetorical Synthesis':
            return '<strong>Goal-First Filter</strong><br>' +
                'Read the <em>writing goal</em> before the notes. Every answer must accomplish that exact goal.<br>' +
                'Cross out answers that accomplish the <em>wrong</em> goal &mdash; even if they use the notes accurately.';
        case 'Transitions':
            return '<strong>Direction Check</strong><br>' +
                'Identify the logical relationship between sentences <em>before</em> looking at options:<br>' +
                '<em>Contrast &middot; Addition &middot; Cause-Effect &middot; Example &middot; Sequence</em><br>' +
                'Wrong direction = wrong answer, even if the word sounds formal.';
        case 'Central Ideas and Details':
            return '<strong>Main Idea Drill</strong><br>' +
                'Ask: what is the <em>whole text</em> primarily about? Reject anything too narrow (one detail), too broad (beyond text), or distorted.<br>' +
                'The correct answer must be supported by <em>most</em> of the passage, not just one sentence.';
        case 'Command of Evidence — Textual':
            return '<strong>Support Check</strong><br>' +
                'Find the specific claim or conclusion in the question, then locate <em>direct textual evidence</em>.<br>' +
                'The correct answer must logically support or illustrate the claim &mdash; not merely relate to the same topic.';
        case 'Command of Evidence — Quantitative':
            return '<strong>Data-to-Claim Match</strong><br>' +
                'Read the data carefully <em>before</em> the options. Identify the exact trend or value the question references.<br>' +
                'Eliminate answers that misread data, reverse a trend, or reference a column not mentioned in the question.';
        case 'Inferences':
            return '<strong>Inference Ceiling</strong><br>' +
                'The answer must be <em>directly supported</em> by the text &mdash; not assumed or implied beyond what\'s written.<br>' +
                'Ask: "Does the text give me specific evidence for this?" If not, eliminate it.';
        case 'Boundaries':
            return '<strong>Run-On Radar</strong><br>' +
                'Test the sentence with a <em>stop test</em>: can each side of the punctuation stand alone?<br>' +
                '<em>Period / semicolon</em> = two complete ideas. A comma alone cannot join two independent clauses.';
        case 'Form, Structure, and Sense':
            return '<strong>Agreement Check</strong><br>' +
                'Identify subject, verb tense, and pronoun antecedent <em>before</em> looking at options.<br>' +
                'Ask: singular or plural? Past, present, or future? Does the pronoun clearly match its noun?';
        default:
            return 'Predict your answer before revealing the options.';
    }
}

// ══════════════════════════════════════════════════════════════════
// QUESTION DISPLAY
// ══════════════════════════════════════════════════════════════════

function applyPassageHighlights(q) {
    const passageEl = document.getElementById('passageContent');

    if (q.skill === 'Words in Context') {
        // Handle straight quotes, curly quotes, and smart single quotes
        const match = q.question.match(/["“”‘’]([^"“”‘’]+)["“”‘’]/);
        if (!match) return;
        const word  = match[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b(${word})\\b`, 'gi');
        passageEl.innerHTML = passageEl.innerHTML.replace(
            regex, '<span class="wic-highlight">$1</span>'
        );
    }
}

function loadQuestion(index) {
    isAnswered        = false;
    questionStartTime = Date.now();
    const q           = activeQuestions[index];

    const feedbackContainer = document.getElementById('feedbackContainer');
    const optionsContainer  = document.getElementById('optionsContainer');
    const predictionStep    = document.getElementById('predictionStep');

    feedbackContainer.className = 'feedback-section';
    optionsContainer.innerHTML  = '';
    optionsContainer.classList.add('hidden');
    predictionStep.classList.add('hidden');

    // Badges
    document.getElementById('skillBadge').textContent = q.skill;
    const domainBadge = document.getElementById('domainBadge');
    if (domainBadge) domainBadge.textContent = SKILL_DOMAIN[q.skill] || '';

    const diffBadge = document.getElementById('difficultyBadge');
    diffBadge.textContent = q.difficulty;
    diffBadge.className   = 'badge ' + (
        q.difficulty === 'Easy' ? 'badge-green' :
        q.difficulty === 'Hard' ? 'badge-red'   : 'badge-orange'
    );
    document.getElementById('questionCounter').textContent =
        `Q ${index + 1} / ${activeQuestions.length}`;

    const reviewLabel = document.getElementById('reviewLabel');
    if (reviewLabel) reviewLabel.style.display = reviewMode ? 'inline-block' : 'none';

    document.getElementById('passageContent').innerHTML =
        q.image ? renderQuestionImage(q.image) : formatPassage(q.passage, q.skill);

    // Question text — highlight RS writing goal in assisted mode
    const questionEl = document.getElementById('questionText');
    if (q.skill === 'Rhetorical Synthesis' && userMode === 'assisted') {
        const escaped = escapeHtml(q.question);
        const highlighted = escaped.replace(
            /(wants to\s+)(.+?)(\.\s+Which choice)/i,
            '$1<span class="rs-goal">$2</span>$3'
        );
        questionEl.innerHTML = highlighted;
    } else {
        questionEl.textContent = q.question;
    }

    if (userMode === 'assisted') {
        const hint = document.getElementById('predictionHint');
        hint.innerHTML = '&#128161; ' + buildStrategyHint(q.skill);
        predictionStep.classList.remove('hidden');
        applyPassageHighlights(q);
    } else {
        optionsContainer.classList.remove('hidden');
    }

    // Build option buttons. Snapshot questions may carry the choices inside
    // the image; when q.options is empty we fall back to bare A–D buttons.
    const opts = (q.options && q.options.length) ? q.options : ['A', 'B', 'C', 'D'];
    opts.forEach(opt => {
        const btn     = document.createElement('button');
        btn.className = 'option-btn';
        const letter  = opt.trim()[0];
        const text    = opt.trim().slice(2).trim();
        // Always render the letter as "A." so keyboard shortcuts and the
        // correct-answer highlight (which match on ".opt-letter") keep working
        // for snapshot questions whose choices live inside the image.
        btn.innerHTML = text
            ? `<span class="opt-letter">${escapeHtml(letter)}.</span><span>${escapeHtml(text)}</span>`
            : `<span class="opt-letter">${escapeHtml(letter)}.</span><span class="opt-letter-only">Choice ${escapeHtml(letter)}</span>`;
        btn.addEventListener('click', () => handleOptionClick(btn, letter, q));
        optionsContainer.appendChild(btn);
    });
}

// Renders a question snapshot (used for Command of Evidence — Quantitative
// and any other item whose figure/table is supplied as an image).
function renderQuestionImage(src) {
    return `<img class="full-q-image" src="${escapeHtml(src)}" alt="Question figure" loading="lazy">`;
}

// ══════════════════════════════════════════════════════════════════
// ANSWER HANDLING
// ══════════════════════════════════════════════════════════════════

function handleOptionClick(btn, selectedLetter, q) {
    if (isAnswered) return;
    isAnswered = true;

    const secs              = questionStartTime
        ? Math.round((Date.now() - questionStartTime) / 1000) : 0;
    const isCorrect         = selectedLetter === q.answer;
    recordAnswer(q.id, isCorrect, userMode === 'exam' ? 'exam' : 'practice');
    recordTrapOutcome(q.skill, q.trapName, isCorrect);
    const feedbackContainer = document.getElementById('feedbackContainer');
    const feedbackTitle     = document.getElementById('feedbackTitle');
    const optionsContainer  = document.getElementById('optionsContainer');

    sessionResults.push({ q, selected: selectedLetter, correct: q.answer, isCorrect, secs });
    if (!isCorrect) missedQuestions.push({ q, selected: selectedLetter });
    if (isCorrect) score++;

    // ── Exam mode: blind lock — no correctness, no explanation, score
    //    hidden. The student reviews everything on the completion screen. ──
    if (userMode === 'exam') {
        btn.classList.add('selected');
        Array.from(optionsContainer.children).forEach(b => { b.disabled = true; });
        feedbackTitle.textContent   = 'Answer locked — keep going';
        feedbackContainer.className = 'feedback-section visible feedback-exam';
        saveSessionState();
        return;
    }

    document.getElementById('currentScore').textContent = score;
    if (isCorrect) {
        btn.classList.add('correct');
        feedbackTitle.textContent   = "Nice — that's right.";
        feedbackContainer.className = 'feedback-section visible feedback-success';
    } else {
        btn.classList.add('incorrect');
        Array.from(optionsContainer.children).forEach(b => {
            const ltr = b.querySelector('.opt-letter');
            if (ltr && ltr.textContent.trim() === q.answer + '.') b.classList.add('correct');
        });
        feedbackTitle.textContent   = "Not quite — here's why.";
        feedbackContainer.className = 'feedback-section visible feedback-error';
    }

    document.getElementById('feedbackText').innerText   = q.explanation;
    document.getElementById('strategyName').textContent = q.strategy || 'Standard POE';
    document.getElementById('trapName').textContent     =
        TRAP_SETS[q.skill] || q.trapName || '—';

    saveSessionState();
}

// Session resume (save/load/restore/checkForSavedSession) lives in storage.js.

// ══════════════════════════════════════════════════════════════════
// PROGRESS / TIMER
// ══════════════════════════════════════════════════════════════════

function resetProgress() {
    currentQuestionIndex = 0;
    score                = 0;
    secondsElapsed       = 0;
    if (!reviewMode) { missedQuestions = []; sessionResults = []; }
    // Exam mode hides the running score so correctness isn't revealed mid-test.
    document.getElementById('currentScore').textContent    = (userMode === 'exam') ? '—' : '0';
    document.getElementById('questionCounter').textContent =
        `Q 1 / ${activeQuestions.length}`;
    updateTimerDisplay();
}

// ══════════════════════════════════════════════════════════════════
// DUE TODAY  (hub nudge — what needs review/practice on open)
// ══════════════════════════════════════════════════════════════════

function renderDueToday() {
    const el = document.getElementById('dueToday');
    if (!el || typeof getPoolSummary !== 'function') return;

    const skills = [...new Set(questionBank.map(q => q.skill))];
    const rows = skills.map(skill => {
        const s = getPoolSummary(questionBank.filter(q => q.skill === skill));
        return { skill, review: s.struggling, unseen: s.unseen };
    });
    const totalReview = rows.reduce((n, r) => n + r.review, 0);
    const totalUnseen = rows.reduce((n, r) => n + r.unseen, 0);

    if (totalReview === 0 && totalUnseen === 0) { el.style.display = 'none'; return; }

    const topReview = rows.filter(r => r.review > 0)
        .sort((a, b) => b.review - a.review)
        .slice(0, 3)
        .map(r => `${SKILL_ABBR[r.skill] || r.skill} (${r.review})`)
        .join(' · ');

    const headline = totalReview > 0
        ? `<b>${totalReview}</b> to review${totalUnseen ? ` · <b>${totalUnseen}</b> new` : ''}`
        : `<b>${totalUnseen}</b> new question${totalUnseen !== 1 ? 's' : ''} to try`;

    el.style.display = 'block';
    el.innerHTML = `
        <div class="due-today-text">
            <span class="due-today-head">${headline}</span>
            ${topReview ? `<span class="due-today-skills">Focus: ${topReview}</span>` : ''}
        </div>
        ${totalReview > 0
            ? `<button type="button" class="btn btn-primary due-today-btn" onclick="reviewWeakAreas()">Review now</button>`
            : ''}`;
}

// One-tap coached drill of missed + weakest-skill questions.
function reviewWeakAreas() {
    startWeakAreaDrill();
}

// ══════════════════════════════════════════════════════════════════
// TOP TRAPS  (lifetime — most-fallen-for trap types)
// ══════════════════════════════════════════════════════════════════

function renderTopTraps() {
    const section   = document.getElementById('topTrapsSection');
    const container = document.getElementById('topTrapsList');
    if (!section || !container) return;
    if (typeof getTopTraps !== 'function') { section.style.display = 'none'; return; }

    const traps = getTopTraps(3, 6);
    if (traps.length === 0) { section.style.display = 'none'; return; }

    section.style.display = 'block';
    container.innerHTML = traps.map(t => {
        const pct = Math.round(t.rate * 100);
        const cls = pct >= 50 ? 'lt-fail' : pct >= 30 ? 'lt-warn' : 'lt-pass';
        const skillAbbr = SKILL_ABBR[t.skill] || t.skill || '';
        return `
        <div class="lifetime-row trap-row">
            <span class="trap-bucket" title="${escapeHtml(t.bucket)}">${escapeHtml(t.bucket)}</span>
            <span class="trap-skilltag">${escapeHtml(skillAbbr)}</span>
            <span class="lifetime-score ${cls}">${t.wrong}/${t.total} missed (${pct}%)</span>
        </div>`;
    }).join('');
}

// Timer logic (effectiveTimer/startTimer/stopTimer/updateTimerDisplay/
// applyTimerState/handleTimeUp) lives in timer.js.
// Session history + lifetime stats (logSession/renderHistory/
// renderLifetimeStats) live in history.js.
// Export / import / full-backup modals live in storage.js.

// ══════════════════════════════════════════════════════════════════
// RESIZABLE PANELS
// ══════════════════════════════════════════════════════════════════

function initResizablePanel() {
    const handle     = document.getElementById('resizeHandle');
    const leftPanel  = document.querySelector('.passage-panel');
    const rightPanel = document.querySelector('.question-panel');
    const container  = document.querySelector('.main-content');
    if (!handle || !leftPanel || !rightPanel) return;

    const saved = localStorage.getItem(STORAGE.SPLIT);
    if (saved) {
        leftPanel.style.flex  = 'none';
        leftPanel.style.width = saved + 'px';
        rightPanel.style.flex = '1';
    }

    let dragging = false, startX = 0, startWidth = 0;

    const onStart = (clientX) => {
        dragging    = true;
        startX      = clientX;
        startWidth  = leftPanel.getBoundingClientRect().width;
        document.body.style.cursor     = 'col-resize';
        document.body.style.userSelect = 'none';
    };
    const onMove = (clientX) => {
        if (!dragging) return;
        const containerW = container.getBoundingClientRect().width - handle.offsetWidth;
        const newW = Math.max(260, Math.min(containerW - 260, startWidth + (clientX - startX)));
        leftPanel.style.flex  = 'none';
        leftPanel.style.width = newW + 'px';
        rightPanel.style.flex = '1';
    };
    const onEnd = () => {
        if (!dragging) return;
        dragging                       = false;
        document.body.style.cursor     = '';
        document.body.style.userSelect = '';
        try {
            localStorage.setItem(STORAGE.SPLIT, leftPanel.getBoundingClientRect().width);
        } catch(e) {}
    };

    handle.addEventListener('mousedown', e => { onStart(e.clientX); e.preventDefault(); });
    document.addEventListener('mousemove', e => onMove(e.clientX));
    document.addEventListener('mouseup', onEnd);

    handle.addEventListener('touchstart', e => {
        onStart(e.touches[0].clientX); e.preventDefault();
    }, { passive: false });
    document.addEventListener('touchmove', e => {
        if (dragging) { onMove(e.touches[0].clientX); e.preventDefault(); }
    }, { passive: false });
    document.addEventListener('touchend', onEnd);

    handle.addEventListener('dblclick', () => {
        leftPanel.style.flex  = '1';
        leftPanel.style.width = '';
        rightPanel.style.flex = '1';
        try { localStorage.removeItem(STORAGE.SPLIT); } catch(e) {}
    });
}

// ══════════════════════════════════════════════════════════════════
// KEYBOARD SHORTCUTS
// ══════════════════════════════════════════════════════════════════

function initKeyboardShortcuts() {
    document.addEventListener('keydown', e => {
        if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;

        // Ctrl+Shift+P — toggle tutor progress panel from any screen
        if (e.ctrlKey && e.shiftKey && e.key.toUpperCase() === 'P') {
            e.preventDefault();
            const panel = document.getElementById('progressPanel');
            if (panel && panel.style.display !== 'none') closeProgressPanel();
            else showProgressPanel();
            return;
        }

        const onSetup      = document.getElementById('setupScreen').style.display      !== 'none';
        const onCompletion = document.getElementById('completionScreen').style.display !== 'none';
        if (onSetup || onCompletion) return;

        const key = e.key.toUpperCase();

        if (key === ' ' || key === 'ENTER') {
            e.preventDefault();
            const predStep = document.getElementById('predictionStep');
            if (!predStep.classList.contains('hidden')) {
                predStep.classList.add('hidden');
                document.getElementById('optionsContainer').classList.remove('hidden');
            } else if (isAnswered) {
                document.getElementById('nextBtn').click();
            }
            return;
        }

        if (key === 'ARROWRIGHT' && isAnswered) {
            e.preventDefault();
            document.getElementById('nextBtn').click();
            return;
        }

        const letterMap = { A:'A', B:'B', C:'C', D:'D', '1':'A', '2':'B', '3':'C', '4':'D' };
        if (letterMap[key]) {
            const optContainer = document.getElementById('optionsContainer');
            if (optContainer.classList.contains('hidden') || isAnswered) return;
            const target = Array.from(optContainer.querySelectorAll('.option-btn')).find(b => {
                const ltr = b.querySelector('.opt-letter');
                return ltr && ltr.textContent.trim() === letterMap[key] + '.';
            });
            if (target) { e.preventDefault(); target.click(); }
        }
    });
}

// ══════════════════════════════════════════════════════════════════
// PROGRESS PANEL  (tutor view — Ctrl+Shift+P)
// ══════════════════════════════════════════════════════════════════

function showProgressPanel() {
    const panel = document.getElementById('progressPanel');
    const body  = document.getElementById('progressBody');
    if (!panel || !body) return;

    const global = getPoolSummary(questionBank);
    const skills = [...new Set(questionBank.map(q => q.skill))];
    const DIFFS  = ['Easy', 'Medium', 'Hard'];

    const skillRows = skills.map(skill => {
        const diffHtml = DIFFS.map(d => {
            const pool = questionBank.filter(q => q.skill === skill && q.difficulty === d);
            if (pool.length === 0) return '';
            const s   = getPoolSummary(pool);
            const pct = Math.round(s.mastered / s.total * 100);
            const bar = Math.round(pct / 10);
            return `<div style="display:grid;grid-template-columns:60px 100px 100px 70px;gap:0.4rem;align-items:center;font-size:0.77rem;padding:0.15rem 0">
                <span style="color:var(--text-muted)">${d}</span>
                <span style="font-family:monospace;font-size:0.7rem;color:#15803d">${'█'.repeat(bar)}${'░'.repeat(10 - bar)}</span>
                <span style="color:#15803d;font-weight:600">${s.mastered}/${s.total}</span>
                <span style="color:#c2410c;font-size:0.72rem">${s.struggling > 0 ? s.struggling + ' stuck' : ''}</span>
            </div>`;
        }).join('');
        return `<div style="margin-bottom:0.9rem">
            <div style="font-size:0.8rem;font-weight:700;color:var(--text);margin-bottom:0.25rem">${SKILL_ABBR[skill] || skill} &mdash; <span style="font-weight:400;color:var(--text-muted)">${skill}</span></div>
            ${diffHtml}
        </div>`;
    }).join('');

    body.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.75rem;margin-bottom:1.25rem;text-align:center">
            <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:0.6rem;padding:0.6rem">
                <div style="font-size:1.4rem;font-weight:700;color:#15803d">${global.mastered}</div>
                <div style="font-size:0.72rem;color:#15803d;font-weight:600">Mastered</div>
            </div>
            <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:0.6rem;padding:0.6rem">
                <div style="font-size:1.4rem;font-weight:700;color:#c2410c">${global.struggling}</div>
                <div style="font-size:0.72rem;color:#c2410c;font-weight:600">Struggling</div>
            </div>
            <div style="background:#f8fafc;border:1px solid var(--border);border-radius:0.6rem;padding:0.6rem">
                <div style="font-size:1.4rem;font-weight:700;color:var(--text-muted)">${global.unseen}</div>
                <div style="font-size:0.72rem;color:var(--text-muted);font-weight:600">Unseen</div>
            </div>
        </div>
        <p style="font-size:0.71rem;color:var(--text-muted);text-align:center;margin-bottom:1.25rem">
            Mastered = &ge;${MASTERY_THRESHOLD} correct &middot; within 21 days &middot; exam answer counts double
        </p>
        ${skillRows}
        <div style="margin-top:0.5rem;padding-top:1rem;border-top:1px solid var(--border)">
            <div style="font-size:0.85rem;font-weight:700;margin-bottom:0.7rem">Settings</div>
            <div style="display:flex;flex-direction:column;gap:0.65rem;font-size:0.82rem">
                <label style="display:flex;justify-content:space-between;align-items:center;gap:0.75rem">
                    <span>SAT exam date</span>
                    <input type="date" id="cfgExamDate" style="padding:0.3rem 0.5rem;border:1px solid var(--border);border-radius:0.4rem;font-family:inherit">
                </label>
                <label style="display:flex;justify-content:space-between;align-items:center;gap:0.75rem">
                    <span>Homework seconds / question</span>
                    <input type="number" id="cfgBudget" min="20" max="600" step="5" style="width:5rem;padding:0.3rem 0.5rem;border:1px solid var(--border);border-radius:0.4rem;font-family:inherit">
                </label>
                <label style="display:flex;align-items:flex-start;gap:0.5rem;line-height:1.4">
                    <input type="checkbox" id="cfgRelax" style="margin-top:0.15rem">
                    <span>Relax anti-cheat — allow text selection &amp; shortcuts (for assistive tech or open-book review). Watermark &amp; tab-switch logging stay on.</span>
                </label>
                <div style="display:flex;align-items:center;gap:0.75rem">
                    <button class="btn btn-primary" id="cfgSaveBtn" style="font-size:0.8rem">Save settings</button>
                    <span id="cfgSaved" style="color:#15803d;font-size:0.78rem;font-weight:700;display:none">Saved &#10003;</span>
                    <span style="color:var(--text-muted);font-size:0.72rem">Relax/budget changes apply on next page load.</span>
                </div>
            </div>
        </div>
        <div style="padding-top:1rem;margin-top:1rem;border-top:1px solid var(--border);display:flex;justify-content:flex-end">
            <button onclick="resetLedger();showProgressPanel();" class="btn"
                style="font-size:0.8rem;border-color:#fecaca;color:#dc2626">
                Reset All Progress
            </button>
        </div>`;

    // Wire the settings form to MasteryConfig.
    if (window.MasteryConfig) {
        const ed = document.getElementById('cfgExamDate');
        const bd = document.getElementById('cfgBudget');
        const rx = document.getElementById('cfgRelax');
        const sv = document.getElementById('cfgSaveBtn');
        if (ed) ed.value     = MasteryConfig.getExamDateStr();
        if (bd) bd.value     = MasteryConfig.getQuestionBudget();
        if (rx) rx.checked   = MasteryConfig.isAntiCheatRelaxed();
        if (sv) sv.onclick = () => {
            if (ed && ed.value) MasteryConfig.setExamDate(ed.value);
            if (bd) MasteryConfig.setQuestionBudget(bd.value);
            if (rx) MasteryConfig.setAntiCheatRelaxed(rx.checked);
            updateExamCountdown();
            const saved = document.getElementById('cfgSaved');
            if (saved) { saved.style.display = 'inline'; setTimeout(() => { saved.style.display = 'none'; }, 1600); }
        };
    }

    panel.style.display = 'block';
}

function closeProgressPanel() {
    const panel = document.getElementById('progressPanel');
    if (panel) panel.style.display = 'none';
}

// ══════════════════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════════════════

function init() {
    updateExamCountdown();

    document.querySelectorAll('input[name="skill"], input[name="diff"]')
        .forEach(el => el.addEventListener('change', updateSetupUI));
    // 'input' as well as 'change': typing a weight should redraw the mix as you
    // type, not only when the box loses focus. A tutor who sets 3 / 2 / 1 and
    // hits Start without clicking away must still see the split it produced.
    document.querySelectorAll('.weight-input').forEach(el => {
        el.addEventListener('input',  updateSetupUI);
        el.addEventListener('change', updateSetupUI);
    });
    const ratioToggle = document.getElementById('ratioToggle');
    if (ratioToggle) ratioToggle.addEventListener('change', updateSetupUI);
    document.getElementById('limitSelect').addEventListener('change', updateSetupUI);

    const timerModeSelect = document.getElementById('timerModeSelect');
    if (timerModeSelect) {
        const durEl  = document.getElementById('timerDurationWrap');
        const hintEl = document.getElementById('timerHint');
        const syncTimerSetup = () => {
            const isCountdown = timerModeSelect.value === 'countdown';
            if (durEl) durEl.style.display = isCountdown ? 'block' : 'none';
            if (hintEl) {
                if (timerModeSelect.value === 'off') {
                    hintEl.style.display = 'none';
                } else {
                    hintEl.style.display = 'block';
                    hintEl.textContent = isCountdown
                        ? "Session ends automatically when time runs out — any unanswered questions count as missed."
                        : "A stopwatch counts your total time; the session isn't time-limited.";
                }
            }
        };
        timerModeSelect.addEventListener('change', syncTimerSetup);
        syncTimerSetup();
    }

    document.querySelectorAll('.preset-btn')
        .forEach(btn => btn.addEventListener('click', () => applyPreset(btn)));

    document.getElementById('startSessionBtn').addEventListener('click', () => {
        const setupModeEl = document.getElementById('setupModeSelect');
        const mode  = setupModeEl ? setupModeEl.value : 'assisted';
        const tModeEl = document.getElementById('timerModeSelect');
        const tmode = tModeEl ? tModeEl.value : 'off';
        let total = 600;
        if (tmode === 'countdown') {
            const durEl = document.getElementById('timerDurationSelect');
            total = durEl ? Math.max(60, Math.min(10800, (parseInt(durEl.value, 10) || 10) * 60)) : 600;
        }
        launchSession(buildActiveQuestions(), mode, { mode: tmode, total });
    });

    document.getElementById('changeSessionBtn').addEventListener('click', () => {
        showSetup();
        _pushScreen('setup');
    });

    document.getElementById('modeSelect').addEventListener('change', e => {
        userMode = e.target.value;
        // Let the timer follow the current mode + setup choice. A countdown or
        // stopwatch picked at setup keeps running regardless of mode switches.
        applyTimerState();
    });

    document.getElementById('revealChoicesBtn').addEventListener('click', () => {
        document.getElementById('predictionStep').classList.add('hidden');
        document.getElementById('optionsContainer').classList.remove('hidden');
    });

    document.getElementById('nextBtn').addEventListener('click', () => {
        currentQuestionIndex++;
        if (currentQuestionIndex < activeQuestions.length) {
            loadQuestion(currentQuestionIndex);
        } else {
            finalizeSession();
        }
    });

    document.getElementById('reviewMissedBtn').addEventListener('click', () => {
        startReviewMissed();
        _pushScreen('session');
    });
    document.getElementById('newSessionBtn').addEventListener('click', () => {
        reviewMode = false;
        showSetup();
        _pushScreen('setup');
    });

    document.getElementById('historyToggle').addEventListener('click', () => {
        const list    = document.getElementById('historyList');
        const chevron = document.getElementById('historyChevron');
        const open    = list.style.display !== 'none';
        list.style.display  = open ? 'none' : 'block';
        chevron.textContent = open ? '▸' : '▾';
    });

    const lifetimeToggle = document.getElementById('lifetimeToggle');
    if (lifetimeToggle) {
        lifetimeToggle.addEventListener('click', () => {
            const panel   = document.getElementById('lifetimeStats');
            const chevron = document.getElementById('lifetimeChevron');
            if (!panel) return;
            const open    = panel.style.display !== 'none';
            panel.style.display = open ? 'none' : 'block';
            if (chevron) chevron.textContent = open ? '▸' : '▾';
        });
    }

    const topTrapsToggle = document.getElementById('topTrapsToggle');
    if (topTrapsToggle) {
        topTrapsToggle.addEventListener('click', () => {
            const panel   = document.getElementById('topTrapsList');
            const chevron = document.getElementById('topTrapsChevron');
            if (!panel) return;
            const open    = panel.style.display !== 'none';
            panel.style.display = open ? 'none' : 'block';
            if (chevron) chevron.textContent = open ? '▸' : '▾';
        });
    }

    document.getElementById('resumeBtn').addEventListener('click', () => {
        const state = loadSessionState();
        if (state && restoreSession(state)) {
            clearSessionState();
            document.getElementById('resumeBanner').style.display = 'none';
            document.getElementById('modeSelect').value = userMode;
            hideSetup();
            loadQuestion(currentQuestionIndex);
            applyTimerState();
            _pushScreen('session');
        }
    });

    document.getElementById('discardBtn').addEventListener('click', () => {
        clearSessionState();
        document.getElementById('resumeBanner').style.display = 'none';
    });

    const exportBtn = document.getElementById('exportBtn');
    const importBtn = document.getElementById('importBtn');
    if (exportBtn) exportBtn.addEventListener('click', openExportModal);
    if (importBtn) importBtn.addEventListener('click', openImportModal);

    const exportProgressBtn = document.getElementById('exportProgressBtn');
    const importProgressBtn = document.getElementById('importProgressBtn');
    if (exportProgressBtn) exportProgressBtn.addEventListener('click', openExportProgressModal);
    if (importProgressBtn) importProgressBtn.addEventListener('click', openImportProgressModal);

    const backupAllBtn  = document.getElementById('backupAllBtn');
    const restoreAllBtn = document.getElementById('restoreAllBtn');
    if (backupAllBtn)  backupAllBtn.addEventListener('click', openBackupAllModal);
    if (restoreAllBtn) restoreAllBtn.addEventListener('click', openRestoreAllModal);

    const dataModal     = document.getElementById('dataModal');
    const modalCloseBtn = document.getElementById('modalCloseBtn');
    if (modalCloseBtn) modalCloseBtn.addEventListener('click', () => {
        dataModal.style.display = 'none';
    });
    if (dataModal) dataModal.addEventListener('click', e => {
        if (e.target === dataModal) dataModal.style.display = 'none';
    });

    initResizablePanel();
    initKeyboardShortcuts();
    updateSetupUI();
    renderHistory();
    renderLifetimeStats();
    renderTopTraps();
    renderBackupReminder();
    renderDueToday();
    checkForSavedSession();
}

init();
