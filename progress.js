// ── SAT R&W Mastery — shared progress ledger ──────────────────────
// Storage key: 'satrw_progress'
// Shape: { [questionId]: { correct: number, wrong: number, lastSeen: number } }

// Per-student keys: the mastery ledger and trap stats are scoped to whoever is
// signed in (sessionStorage 'mastery_user' from gate.js), so multiple students
// can share a device without their progress mixing. Legacy un-suffixed keys
// ('satrw_progress' / 'satrw_trap_stats') are copied across on first read so
// existing data carries over.
var _hwMigrated = {};
function _hwUser() {
    var u;
    try { u = sessionStorage.getItem('mastery_user') || 'guest'; } catch (e) { u = 'guest'; }
    if (!_hwMigrated[u]) {
        _hwMigrated[u] = true;
        try {
            var lp = localStorage.getItem('satrw_progress');
            if (lp != null && localStorage.getItem('satrw_progress_' + u) == null)
                localStorage.setItem('satrw_progress_' + u, lp);
            var lt = localStorage.getItem('satrw_trap_stats');
            if (lt != null && localStorage.getItem('satrw_trap_stats_' + u) == null)
                localStorage.setItem('satrw_trap_stats_' + u, lt);
        } catch (e) {}
    }
    return u;
}
const MASTERY_THRESHOLD = 2;
const MASTERY_DECAY_MS  = 21 * 86_400_000; // 21 days
// After any answer, a question "rests" for this long before it can resurface in
// a new practice set — so answering a question sends it to the back of the queue
// instead of bringing it straight back in the next set. Long enough to clear a
// single sitting, short enough that a not-yet-mastered item returns the next day
// for reinforcement.
const REVIEW_COOLDOWN_MS = 20 * 3_600_000;  // 20 hours

// ── The review ladder ─────────────────────────────────────────────
// A correct answer does not FINISH a question. It SCHEDULES it. Each consecutive
// correct pushes the next sighting further out; a miss drops it to the bottom rung.
//
//   1st correct → back in 1 day    4th → back in 3 weeks
//   2nd         → 3 days           5th+ → back in 6 weeks, then it is maintenance
//   3rd         → 1 week
//
// This exists because the ledger had no way to bring a learned question BACK.
// Two corrects made a question "mastered" (bottom tier of the draw). At 21 days
// _isMastered() went false and — because `wrong` was still 0 — the question fell
// into softMastered, a tier that sits BEHIND `unseen`. The bank holds hundreds of
// questions and a set takes six, so `unseen` never ran out and the question was
// never drawn again. The 21-day decay only ever changed a label on the progress
// screen. A topic taught in April was gone by May and nothing brought it back.
//
// Spacing is the largest, most replicated effect in the learning literature
// (`MR-1`, `MR-3` in the root handbook). We had none of it. This is it.
const REVIEW_LADDER_DAYS = [1, 3, 7, 21, 42];
const DAY_MS = 86_400_000;

function getProgress() {
    try { return JSON.parse(localStorage.getItem('satrw_progress_' + _hwUser())) || {}; }
    catch(e) { return {}; }
}

function _saveProgress(ledger) {
    try { localStorage.setItem('satrw_progress_' + _hwUser(), JSON.stringify(ledger)); } catch(e) {}
}

// Call after every answered question.
// source: 'practice' | 'exam' | 'homework'  — exam answers count double.
// meta:   { skill, review } — optional. `review: true` means the ladder chose this
//         question (dueForReview), so the answer is a DELAYED retrieval and counts
//         toward retention. `skill` is the bucket it counts into. Both are ignored
//         when absent, so the three-argument callers keep working unchanged.
//
//         `source` says where the answer happened; `review` says why the question
//         was drawn. They are different questions and must not be folded together —
//         an exam answer still counts double whether or not it was a review.
function recordAnswer(id, isCorrect, source, meta) {
    const ledger = getProgress();
    if (!ledger[id]) ledger[id] = { correct: 0, wrong: 0, lastSeen: 0 };
    // Read the rung BEFORE touching anything. _streak() falls back to `correct` for
    // ledgers written before the ladder, so computing it after correct++ would count
    // a single right answer as two rungs and double-space the question.
    const rung = _streak(ledger[id]);
    ledger[id].lastSeen   = Date.now();
    ledger[id].lastSource = source || 'practice';
    ledger[id].lastResult = isCorrect ? 'correct' : 'wrong';
    if (isCorrect) {
        ledger[id].correct += (source === 'exam') ? 2 : 1;
        ledger[id].streak   = rung + 1;                  // climb a rung
    } else {
        ledger[id].wrong++;
        ledger[id].streak = 0;                            // back to the bottom
        if (ledger[id].correct > 0) ledger[id].correct--;
    }
    _saveProgress(ledger);
    if (meta && meta.review) _recordRetention(meta.skill, isCorrect);
}

// ── Retention: is it STAYING learned? ─────────────────────────────
// The ledger has always known whether an answer was right. It could not, until
// now, tell "learned and retained" from "learned and forgotten" — and that is the
// exact claim a monthly report makes to a parent.
//
// The difference between the two is delay. Getting a question right the first time
// you meet it is ACQUISITION. Getting it right when the ladder brings it back
// weeks later is RETENTION, and only the second is evidence that anything stuck
// (`AN-4`, `MR-8`). The spacing ladder already creates the delayed retrievals;
// this is what finally counts them.
//
// So exactly one thing lands here: an answer to a question dueForReview() chose.
// A first attempt must never be counted. Acquisition accuracy always looks good,
// so a first attempt leaking in moves this number in the flattering direction —
// and a flattering number that ends up in a report is a lie (`M1`). Nor does a
// redo count: the redo is untimed with notes open, and it is not a memory test.
//
// Shape: { [skill]: { correct, total } }
function getRetentionStats() {
    try { return JSON.parse(localStorage.getItem('satrw_retention_' + _hwUser())) || {}; }
    catch (e) { return {}; }
}

function _saveRetentionStats(stats) {
    try { localStorage.setItem('satrw_retention_' + _hwUser(), JSON.stringify(stats)); } catch (e) {}
}

function _recordRetention(skill, isCorrect) {
    if (!skill) return;
    const stats = getRetentionStats();
    if (!stats[skill]) stats[skill] = { correct: 0, total: 0 };
    stats[skill].total += 1;
    if (isCorrect) stats[skill].correct += 1;
    _saveRetentionStats(stats);
}

// The durable-learning readout: retention rate per skill, plus overall.
// Returns { bySkill: { [skill]: { correct, total, rate } }, overall: { correct, total, rate } }.
//
// The counts come back with the rates on purpose. "100%" off a single delayed
// retrieval is not a retention claim, and any surface showing this must be able to
// say 1/1 rather than imply a month of evidence.
function getRetention() {
    const stats   = getRetentionStats();
    const bySkill = {};
    let correct = 0, total = 0;
    Object.entries(stats).forEach(([skill, s]) => {
        const c = s.correct || 0, t = s.total || 0;
        if (!t) return;
        bySkill[skill] = { correct: c, total: t, rate: c / t };
        correct += c; total += t;
    });
    return {
        bySkill,
        overall: { correct, total, rate: total ? correct / total : 0 },
    };
}

function mergeRetention(incoming) {
    if (!incoming || typeof incoming !== 'object') return;
    const existing = getRetentionStats();
    Object.entries(incoming).forEach(([skill, s]) => {
        if (!existing[skill]) existing[skill] = { correct: 0, total: 0 };
        existing[skill].correct += s.correct || 0;
        existing[skill].total   += s.total   || 0;
    });
    _saveRetentionStats(existing);
}

// ── The ladder ────────────────────────────────────────────────────
// Consecutive corrects. Ledgers written before the ladder existed carry no
// `streak`, so infer one rather than resetting real students to zero: a record
// whose last answer was wrong sits at the bottom; otherwise credit the corrects
// it already banked.
function _streak(record) {
    if (!record) return 0;
    if (typeof record.streak === 'number') return record.streak;
    return record.lastResult === 'wrong' ? 0 : (record.correct || 0);
}

// When this question should next be put in front of the student.
function _dueAt(record) {
    if (!record || !record.lastSeen) return 0;
    const s = _streak(record);
    // A miss is not on the ladder — it comes back as soon as the cooldown clears,
    // which is what makes "misses come back" true.
    if (s <= 0) return record.lastSeen + REVIEW_COOLDOWN_MS;
    const rung = REVIEW_LADDER_DAYS[Math.min(s, REVIEW_LADDER_DAYS.length) - 1];
    return record.lastSeen + rung * DAY_MS;
}

function _isDue(record) {
    if (!record || !record.lastSeen) return false;
    return Date.now() >= _dueAt(record);
}

// How long overdue, in ms. Negative means not due yet. Used to sort the review
// queue so the most-forgotten thing comes back first.
function _overdueBy(record) {
    if (!record || !record.lastSeen) return -Infinity;
    return Date.now() - _dueAt(record);
}

// ── The review draw ───────────────────────────────────────────────
// Up to `n` questions that are DUE, most overdue first.
//
// This is the one draw that is allowed to ignore the day's skill and difficulty
// filter, and it is the whole point of it. A homework day narrows the bank to
// (say) Words in Context / Hard before prioritizePool() ever sees it, so a
// Text Structure question due for review — or a Medium miss, when the day is
// Hard-only — CANNOT surface there, no matter how the pool is ordered. Review
// has to be drawn against the whole bank or it does not happen at all.
//
// It never returns an unseen question. A review block may only bring back
// something the student has actually been taught and has actually attempted;
// handing them a cold skill under the banner of "review" is the fastest way to
// lose them (`CD-2` — never assign what has not been taught).
function dueForReview(bank, n, excludeIds) {
    if (!bank || !bank.length || !n) return [];
    const ledger = getProgress();
    const skip   = excludeIds || {};
    return bank
        .filter(q => !skip[q.id] && ledger[q.id] && _isDue(ledger[q.id]))
        .map(q => ({ q, over: _overdueBy(ledger[q.id]) }))
        .sort((a, b) => b.over - a.over)
        .slice(0, n)
        .map(x => x.q);
}

function _isMastered(record) {
    if (!record) return false;
    // Mastery expires after MASTERY_DECAY_MS of not seeing the question
    if (record.lastSeen && Date.now() - record.lastSeen > MASTERY_DECAY_MS) return false;
    return record.correct >= MASTERY_THRESHOLD;
}

// True when a question should be held back from a NEW practice set for now, so
// it doesn't reappear immediately after being answered — it goes to the back of
// the queue instead:
//   • mastered → rest (until 21-day decay re-opens it, handled by _isMastered);
//   • answered (right OR wrong) within the cooldown → rest;
//   • cooldown elapsed on a not-yet-mastered item → due again, so misses come
//     back for review and single corrects come back to confirm mastery.
// Unseen questions (no record) are never resting. Same-session review of a miss
// is still available on demand via the "Review missed" and weak-area buttons.
function _isResting(record) {
    if (!record) return false;
    if (_isMastered(record)) return true;
    if (record.lastSeen && (Date.now() - record.lastSeen) < REVIEW_COOLDOWN_MS) return true;
    return false;
}

// Reorder pool with THREE tiers:
//   1. unseen    — never answered. COVERAGE FIRST.
//   2. needsWork — seen, has had at least one wrong answer, not yet mastered.
//   3. resting   — owes nothing right now: never missed, or missed and since
//                  mastered. Sorted by how OVERDUE it is (see the review ladder),
//                  not shuffled: when a narrow pool runs out of unseen questions,
//                  the thing the student is closest to forgetting comes back.
// The first two tiers are shuffled so order within them is random.
//
// WHY unseen LEADS (changed 22 Jul 2026 — it used to be needsWork).
// The review ladder is the review instrument: dueForReview() draws against the
// WHOLE bank on its own schedule (1/3/7/21/42 days) and splices its dose into the
// set. This function's job is the OTHER half — the new material the day exists to
// teach. Putting misses first here meant review arrived twice, through a scheduled
// channel and an unscheduled one, and the unscheduled one had no spacing at all.
//
// It bites hardest exactly where it hurts most: a narrow pool. `Poss` holds five
// questions at Medium+Hard, so a misses-first draw re-serves the same two every
// time and the other three are never met. What that trains is recall of those
// answers rather than the rule behind them, and the two are indistinguishable in
// the score.
//
// `opts.missesFirst` restores the old order for the two callers that genuinely
// want it: a Challenge set (a fixed list of the student's own test misses — there
// is no coverage to gain, only mastery of those items), and a homework day where
// the ladder turned out to have nothing due, so misses would otherwise get no
// channel at all that day.
function prioritizePool(pool, opts) {
    const ledger    = getProgress();
    const needsWork = [];
    const unseen    = [];
    const resting   = [];

    pool.forEach(q => {
        const r = ledger[q.id];
        if (!r) {
            unseen.push(q);
        } else if ((r.wrong || 0) > 0 && !_isMastered(r)) {
            needsWork.push(q); // has had at least one miss
        } else {
            resting.push(q);   // previously correct — the ladder decides when it returns
        }
    });

    resting.sort((a, b) => _overdueBy(ledger[b.id]) - _overdueBy(ledger[a.id]));

    const missesFirst = !!(opts && opts.missesFirst);
    const lead = missesFirst ? needsWork : unseen;
    const next = missesFirst ? unseen    : needsWork;

    return [
        ..._fyShuffle(lead),
        ..._fyShuffle(next),
        ...resting,
    ];
}

// Returns true when every question in the pool is currently mastered.
function isPoolAllMastered(pool) {
    if (!pool || pool.length === 0) return false;
    const ledger = getProgress();
    return pool.every(q => _isMastered(ledger[q.id]));
}

// Returns { mastered, struggling, unseen, total } counts for a given question pool.
function getPoolSummary(pool) {
    const ledger  = getProgress();
    const summary = { mastered: 0, struggling: 0, unseen: 0, total: pool.length };
    pool.forEach(q => {
        const r = ledger[q.id];
        if (!r)               summary.unseen++;
        else if (_isMastered(r)) summary.mastered++;
        else                  summary.struggling++;
    });
    return summary;
}

// Merge an imported ledger into the existing one (take higher correct, sum wrongs).
function mergeProgress(incoming) {
    if (!incoming || typeof incoming !== 'object') return;
    const existing = getProgress();
    Object.entries(incoming).forEach(([id, r]) => {
        if (!existing[id]) {
            existing[id] = r;
        } else {
            existing[id].correct  = Math.max(existing[id].correct  || 0, r.correct  || 0);
            existing[id].wrong    = (existing[id].wrong || 0) + (r.wrong || 0);
            existing[id].lastSeen = Math.max(existing[id].lastSeen || 0, r.lastSeen || 0);
        }
    });
    _saveProgress(existing);
}

// Clear the entire ledger (use when a student wants a fresh start).
function resetLedger() {
    localStorage.removeItem('satrw_progress_' + _hwUser());
    try { localStorage.removeItem('satrw_trap_stats_' + _hwUser()); } catch (e) {}
    try { localStorage.removeItem('satrw_retention_' + _hwUser()); } catch (e) {}
}

// ── Trap analytics ────────────────────────────────────────────────
// Tallies how often a student gets caught by each trap type. Questions
// with a specific `trapName` are tracked by that name; everything else
// falls back to a per-skill bucket. Shape:
//   { [bucket]: { wrong: number, total: number, skill: string } }

function getTrapStats() {
    try { return JSON.parse(localStorage.getItem('satrw_trap_stats_' + _hwUser())) || {}; }
    catch (e) { return {}; }
}

function _saveTrapStats(stats) {
    try { localStorage.setItem('satrw_trap_stats_' + _hwUser(), JSON.stringify(stats)); } catch (e) {}
}

// Call after every answered question that has a known skill.
function recordTrapOutcome(skill, trapName, isCorrect) {
    if (!skill) return;
    const bucket = (trapName && String(trapName).trim())
        ? String(trapName).trim()
        : skill + ' — general';
    const stats = getTrapStats();
    if (!stats[bucket]) stats[bucket] = { wrong: 0, total: 0, skill };
    stats[bucket].total += 1;
    if (!isCorrect) stats[bucket].wrong += 1;
    stats[bucket].skill = skill;
    _saveTrapStats(stats);
}

// Most-fallen-for traps: buckets with at least `minTotal` attempts,
// sorted by wrong-rate then volume. Returns [{ bucket, skill, wrong, total, rate }].
function getTopTraps(minTotal = 3, limit = 6) {
    const stats = getTrapStats();
    return Object.entries(stats)
        .map(([bucket, s]) => ({
            bucket, skill: s.skill || '',
            wrong: s.wrong || 0, total: s.total || 0,
            rate: s.total ? (s.wrong || 0) / s.total : 0,
        }))
        .filter(t => t.total >= minTotal && t.wrong > 0)
        .sort((a, b) => (b.rate - a.rate) || (b.wrong - a.wrong))
        .slice(0, limit);
}

function mergeTrapStats(incoming) {
    if (!incoming || typeof incoming !== 'object') return;
    const existing = getTrapStats();
    Object.entries(incoming).forEach(([bucket, s]) => {
        if (!existing[bucket]) {
            existing[bucket] = { wrong: s.wrong || 0, total: s.total || 0, skill: s.skill || '' };
        } else {
            existing[bucket].wrong += s.wrong || 0;
            existing[bucket].total += s.total || 0;
            existing[bucket].skill = s.skill || existing[bucket].skill;
        }
    });
    _saveTrapStats(existing);
}

// ── Difficulty calibration ────────────────────────────────────────
// Rolling per-skill accuracy, rebuilt from the trap buckets — every bucket already
// carries its `skill`, `total` and `wrong`, so this is the one per-skill accuracy
// the app has. (The mastery ledger is keyed by question id and does not know what
// skill a question is.)
// Returns { [skill]: { correct, total, rate } }.
function getSkillAccuracy() {
    const out = {};
    Object.values(getTrapStats()).forEach(s => {
        const skill = s.skill;
        if (!skill) return;
        if (!out[skill]) out[skill] = { correct: 0, total: 0, rate: 0 };
        out[skill].total   += s.total || 0;
        out[skill].correct += (s.total || 0) - (s.wrong || 0);
    });
    Object.values(out).forEach(v => { v.rate = v.total ? v.correct / v.total : 0; });
    return out;
}

// ~85% success is where learning is maximised: below ~80% is overload and
// demoralisation, above ~90% there is no desirable difficulty left and the student
// is just being told what they already know (`AS-4`).
//
// This returns a BIAS — 'up' | 'hold' | 'down' — and never a difficulty. The tutor's
// homework day says which difficulties are allowed; calibration only chooses within
// what the day already permits. A day that pins one difficulty is a decision, not a
// range, and nothing here may touch it: never override the tutor.
//
// MIN_CALIBRATION_ATTEMPTS exists because 3-for-3 on a skill is a coin landing
// heads three times, not evidence of cruising. Under the threshold we hold, so a
// student's first day on a new skill runs exactly as authored.
const MIN_CALIBRATION_ATTEMPTS = 8;
const CALIBRATE_UP_ABOVE       = 0.90;
const CALIBRATE_DOWN_BELOW     = 0.80;

// `skills` is a skill name or an array of them. A section naming several skills is
// calibrated off their combined accuracy — one bias for the one draw it controls.
function recommendDifficulty(skills) {
    const names = Array.isArray(skills) ? skills : [skills];
    const acc   = getSkillAccuracy();
    let correct = 0, total = 0;
    names.forEach(n => {
        const a = acc[n];
        if (a) { correct += a.correct; total += a.total; }
    });
    if (total < MIN_CALIBRATION_ATTEMPTS) return 'hold';
    const rate = correct / total;
    if (rate > CALIBRATE_UP_ABOVE)   return 'up';
    if (rate < CALIBRATE_DOWN_BELOW) return 'down';
    return 'hold';
}

function _fyShuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
