// ── Wayne's SAT — shared progress ledger ──────────────────────────
// Storage key: 'wayne_progress'
// Shape: { [questionId]: { correct: number, wrong: number, lastSeen: number } }

// Per-student keys: the mastery ledger and trap stats are scoped to whoever is
// signed in (sessionStorage 'mastery_user' from gate.js), so multiple students
// can share a device without their progress mixing. Legacy un-suffixed keys
// ('wayne_progress' / 'wayne_trap_stats') are copied across on first read so
// existing data carries over.
var _hwMigrated = {};
function _hwUser() {
    var u;
    try { u = sessionStorage.getItem('mastery_user') || 'guest'; } catch (e) { u = 'guest'; }
    if (!_hwMigrated[u]) {
        _hwMigrated[u] = true;
        try {
            var lp = localStorage.getItem('wayne_progress');
            if (lp != null && localStorage.getItem('wayne_progress_' + u) == null)
                localStorage.setItem('wayne_progress_' + u, lp);
            var lt = localStorage.getItem('wayne_trap_stats');
            if (lt != null && localStorage.getItem('wayne_trap_stats_' + u) == null)
                localStorage.setItem('wayne_trap_stats_' + u, lt);
        } catch (e) {}
    }
    return u;
}
const MASTERY_THRESHOLD = 2;
const MASTERY_DECAY_MS  = 21 * 86_400_000; // 21 days

function getProgress() {
    try { return JSON.parse(localStorage.getItem('wayne_progress_' + _hwUser())) || {}; }
    catch(e) { return {}; }
}

function _saveProgress(ledger) {
    try { localStorage.setItem('wayne_progress_' + _hwUser(), JSON.stringify(ledger)); } catch(e) {}
}

// Call after every answered question.
// source: 'practice' | 'exam' | 'homework'  — exam answers count double.
function recordAnswer(id, isCorrect, source) {
    const ledger = getProgress();
    if (!ledger[id]) ledger[id] = { correct: 0, wrong: 0, lastSeen: 0 };
    ledger[id].lastSeen   = Date.now();
    ledger[id].lastSource = source || 'practice';
    if (isCorrect) {
        ledger[id].correct += (source === 'exam') ? 2 : 1;
    } else {
        ledger[id].wrong++;
        if (ledger[id].correct > 0) ledger[id].correct--;
    }
    _saveProgress(ledger);
}

function _isMastered(record) {
    if (!record) return false;
    // Mastery expires after MASTERY_DECAY_MS of not seeing the question
    if (record.lastSeen && Date.now() - record.lastSeen > MASTERY_DECAY_MS) return false;
    return record.correct >= MASTERY_THRESHOLD;
}

// Reorder pool with FOUR tiers:
//   1. needsWork    — seen, has had at least one wrong answer, not yet mastered.
//                     Surfaces FIRST so the student practises their misses.
//   2. unseen       — never answered.
//   3. softMastered — answered correctly at least once with NO wrongs ever,
//                     but hasn't hit MASTERY_THRESHOLD yet. Parked toward the
//                     back so a single correct answer doesn't bounce the same
//                     question right back in the next session. A second
//                     correct in a future session promotes it to mastered.
//   4. mastered     — correct >= MASTERY_THRESHOLD and not decayed.
// Each tier is shuffled independently so order within a tier is random.
function prioritizePool(pool) {
    const ledger       = getProgress();
    const needsWork    = [];
    const unseen       = [];
    const softMastered = [];
    const mastered     = [];

    pool.forEach(q => {
        const r = ledger[q.id];
        if (!r) {
            unseen.push(q);
        } else if (_isMastered(r)) {
            mastered.push(q);
        } else if ((r.wrong || 0) > 0) {
            needsWork.push(q); // has had at least one miss
        } else {
            softMastered.push(q); // correct >= 1, never wrong, not yet at threshold
        }
    });

    return [
        ..._fyShuffle(needsWork),
        ..._fyShuffle(unseen),
        ..._fyShuffle(softMastered),
        ..._fyShuffle(mastered),
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

// Clear the entire ledger (use when Wayne wants a fresh start).
function resetLedger() {
    localStorage.removeItem('wayne_progress_' + _hwUser());
    try { localStorage.removeItem('wayne_trap_stats_' + _hwUser()); } catch (e) {}
}

// ── Trap analytics ────────────────────────────────────────────────
// Tallies how often a student gets caught by each trap type. Questions
// with a specific `trapName` are tracked by that name; everything else
// falls back to a per-skill bucket. Shape:
//   { [bucket]: { wrong: number, total: number, skill: string } }

function getTrapStats() {
    try { return JSON.parse(localStorage.getItem('wayne_trap_stats_' + _hwUser())) || {}; }
    catch (e) { return {}; }
}

function _saveTrapStats(stats) {
    try { localStorage.setItem('wayne_trap_stats_' + _hwUser(), JSON.stringify(stats)); } catch (e) {}
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

function _fyShuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
