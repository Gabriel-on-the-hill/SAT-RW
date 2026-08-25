// ══════════════════════════════════════════════════════════════════
// SESSION HISTORY + LIFETIME SKILL STATS
// ══════════════════════════════════════════════════════════════════
// Uses shared globals from app.js (SKILL_ABBR, sessionResults, secondsElapsed,
// userMode) and storage.js (STORAGE). Persistence is read/written through the
// safe* helpers in storage.js so a full localStorage never throws.
//
// -- THE LEDGER AND THE SHEET USED TO DISAGREE. Read this before changing it. --
//
// The mastery ledger is written PER QUESTION, the moment an answer is committed
// (app.js submitAnswer -> commitOne -> recordAnswer). The sheet was written ONCE,
// from finalizeSession(), which in practice mode is reachable only by pressing
// Next PAST the last question. There is no Submit button in that mode.
//
// So a session where every question was answered, but which was walked away from
// on the final question, wrote everything to the ledger and NOTHING to the sheet.
// It happened for real in the sister PSAT 8/9 app on 24 Aug 2026: two full
// sessions in one lesson, one reached the tutor. Nothing errored -- mode:'no-cors'
// makes the response opaque, so a post that never happens looks exactly like one
// that succeeded, and it went unnoticed until the sheet was read against the
// lesson. This app has the identical structure, so it had the identical bug.
//
// logPartialSession() below closes it: `pagehide` posts whatever has been
// committed so far, once, marked INCOMPLETE.
//
// !! THE SESSION ID IS AN IDEMPOTENCY KEY HERE, AND THAT CHANGES THE DESIGN.
// This app's Apps Script SKIPS a Session ID it has already stored -- first write
// wins (rw-apps-script.md, seenSessionIds_). So a partial and its later complete
// row must NOT share an id, or the partial would be stored first and the real
// result silently discarded as a duplicate. The partial therefore posts under
// `<sessionId>_partial`: both rows land, dedupe still protects a genuine re-POST
// of either, and the shared prefix is what joins them. This is the one place the
// port from the PSAT app had to diverge -- that backend has no dedupe at all.

// Identifies one SITTING, not one post. It used to be minted inside logSession,
// which was fine while there was only ever one post per sitting; a partial flush
// needs an id that exists before the session ends and survives a resume.
let _sessionId     = '';
let _sessionLogged = false;   // a COMPLETE row has gone up for this session
let _partialLogged = false;   // an INCOMPLETE row has gone up for this session

function newSessionId() {
    return 'rw_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

// Called by launchSession() (new sitting) and restoreSession() (resumed one).
function setSessionId(id, opts) {
    _sessionId     = id || newSessionId();
    _sessionLogged = !!(opts && opts.logged);
    _partialLogged = !!(opts && opts.partial);
    return _sessionId;
}
function getSessionId()     { return _sessionId; }
function wasPartialLogged() { return _partialLogged; }

function logSession(skills, diffs, sessionScore, total) {
    // Prefer per-question times (tracked in all modes); fall back to exam-timer total
    const perQSum  = sessionResults.reduce((sum, r) => sum + (r.secs || 0), 0);
    const duration = perQSum > 0 ? perQSum : secondsElapsed;
    const avgSecs  = total > 0 ? Math.round(duration / total) : 0;

    const skillStats = {};
    sessionResults.forEach(r => {
        if (!skillStats[r.q.skill]) skillStats[r.q.skill] = { correct: 0, total: 0 };
        skillStats[r.q.skill].total++;
        if (r.isCorrect) skillStats[r.q.skill].correct++;
    });

    // Per-question diagnostics for the tutor (kept out of the local cap logic).
    const questions = sessionResults.map(r => ({
        id:         r.q.id,
        skill:      r.q.skill,
        difficulty: r.q.difficulty,
        chosen:     r.selected,
        correct:    r.correct,
        isCorrect:  r.isCorrect,
        secs:       r.secs || 0,
        trap:       r.q.trapName || '',
    }));
    const blurCount = (typeof getBlurCount === 'function') ? getBlurCount() : 0;

    const record = {
        date: new Date().toISOString(),
        // Idempotency key. The tutor's Apps Script skips a Session ID it has
        // already stored, which makes a re-POST harmless and lets the per-question
        // rows in the Questions tab join back to this session.
        sessionId: _sessionId || newSessionId(),
        skills, diffs,
        score:  sessionScore,
        total,
        pct:    Math.round((sessionScore / total) * 100),
        duration,
        avgSecs,
        skillStats,
        blurCount,
        source: 'practice',
        mode:   userMode,
    };
    let history = safeGetJSON(STORAGE.HISTORY, []);
    history.unshift(record);
    // Cap matches homework (_logHwSession) so neither engine trims the other's rows.
    if (history.length > 100) history = history.slice(0, 100);
    safeSet(STORAGE.HISTORY, JSON.stringify(history));

    // Fire-and-forget upload to the tutor's Google Sheet — include the heavy
    // per-question detail only in the upload, not the capped local history.
    if (typeof syncSessionToSheet === 'function') {
        syncSessionToSheet({ ...record, questions });
    }
    // From here on, pagehide has nothing to add: the complete row is up.
    _sessionLogged = true;
    if (typeof saveSessionState === 'function') { try { saveSessionState(); } catch (e) {} }
}

// -- The pagehide flush ------------------------------------------------------
// Posts the committed part of a session that is being walked away from. Local
// history is deliberately NOT touched: an unfinished sitting is not a result,
// and the hub's history list should not fill up with fragments. This exists so
// the tutor sees the work, nothing more.
//
// PAGEHIDE ONLY, NOT visibilitychange. These sessions are screen-shared and
// tab-switched constantly; visibilitychange would post a row every time the
// student alt-tabs. `pagehide` fires on navigate-away and on close, which is the
// case that actually loses data.
//
// The id carries a `_partial` suffix -- see the idempotency note at the top of
// this file. Without it the Apps Script would keep this row and discard the real
// one as a duplicate, which is worse than the bug being fixed.
function logPartialSession() {
    if (_sessionLogged || _partialLogged) return false;
    if (typeof syncSessionToSheet !== 'function') return false;
    if (!Array.isArray(activeQuestions) || !activeQuestions.length) return false;
    if (typeof buildResults !== 'function' || !Array.isArray(responses)) return false;

    // Only questions actually committed to the ledger. A blank is not a result,
    // and an uncommitted selection is not an answer -- same rule the ledger keeps.
    const rows = buildResults(responses, activeQuestions)
        .filter((r, i) => responses[i] && responses[i].committed && r.answered);
    if (!rows.length) return false;

    const done     = rows.length;
    const correct  = rows.filter(r => r.isCorrect).length;
    const duration = rows.reduce((sum, r) => sum + (r.secs || 0), 0) || secondsElapsed;

    const skillStats = {};
    rows.forEach(r => {
        if (!skillStats[r.q.skill]) skillStats[r.q.skill] = { correct: 0, total: 0 };
        skillStats[r.q.skill].total++;
        if (r.isCorrect) skillStats[r.q.skill].correct++;
    });

    const skills = [...new Set(activeQuestions.map(q => q.skill))];
    const diffs  = [...new Set(activeQuestions.map(q => q.difficulty))];

    // The marker rides in assignmentTitle, which lands in the 'Assignment' column
    // and is empty for a practice session anyway. Chosen because it needs NO
    // script change and no redeploy to be visible. `partial` is also sent in the
    // body for a future 'Partial' entry in EXTRA_COLUMNS -- see rw-apps-script.md.
    syncSessionToSheet({
        date:  new Date().toISOString(),
        sessionId: (_sessionId || newSessionId()) + '_partial',
        skills, diffs,
        assignmentTitle: 'INCOMPLETE - ' + done + ' of ' + activeQuestions.length + ' answered',
        partial: true,
        answered: done,
        planned:  activeQuestions.length,
        score: correct,
        total: done,
        pct:   Math.round((correct / done) * 100),
        duration,
        avgSecs: Math.round(duration / done),
        skillStats,
        blurCount: (typeof getBlurCount === 'function') ? getBlurCount() : 0,
        source: 'practice',
        mode:   userMode,
        questions: rows.map(r => ({
            id: r.q.id, skill: r.q.skill, difficulty: r.q.difficulty,
            chosen: r.selected, correct: r.correct, isCorrect: r.isCorrect,
            secs: r.secs || 0, trap: r.q.trapName || '',
        })),
    });

    _partialLogged = true;
    if (typeof saveSessionState === 'function') { try { saveSessionState(); } catch (e) {} }
    return true;
}

function renderHistory() {
    const container = document.getElementById('historyList');
    if (!container) return;

    const history = safeGetJSON(STORAGE.HISTORY, []);

    if (history.length === 0) {
        container.innerHTML = '<p class="history-empty">No sessions yet.</p>';
        return;
    }

    container.innerHTML = history.slice(0, 10).map(r => {
        const d       = new Date(r.date);
        const dateStr = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        const timeStr = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        const labels  = r.skills.map(s => SKILL_ABBR[s] || s).join(' + ');
        const cls     = r.pct >= 80 ? 'hist-pass' : r.pct >= 60 ? 'hist-warn' : 'hist-fail';
        const timeInfo = r.avgSecs
            ? ` <span class="hist-time">· ${r.avgSecs}s/q</span>` : '';
        return `
        <div class="hist-row">
            <span class="hist-date">${dateStr} ${timeStr}</span>
            <span class="hist-skills">${labels}</span>
            <span class="hist-score ${cls}">${r.score}/${r.total} (${r.pct}%)${timeInfo}</span>
        </div>`;
    }).join('');
}

function renderLifetimeStats() {
    const section   = document.getElementById('lifetimeSection');
    const container = document.getElementById('lifetimeStats');
    if (!section || !container) return;

    const history = safeGetJSON(STORAGE.HISTORY, []);

    if (history.length === 0) { section.style.display = 'none'; return; }

    const agg = {};
    history.forEach(r => {
        if (!r.skillStats) return;
        Object.entries(r.skillStats).forEach(([skill, s]) => {
            if (!agg[skill]) agg[skill] = { correct: 0, total: 0 };
            agg[skill].correct += s.correct;
            agg[skill].total   += s.total;
        });
    });

    const entries = Object.entries(agg)
        .map(([skill, s]) => ({ skill, ...s, pct: Math.round(s.correct / s.total * 100) }))
        .sort((a, b) => a.pct - b.pct);

    if (entries.length === 0) { section.style.display = 'none'; return; }

    section.style.display = 'block';
    container.innerHTML = entries.map(e => {
        const cls = e.pct >= 80 ? 'lt-pass' : e.pct >= 60 ? 'lt-warn' : 'lt-fail';
        const bar = Math.round(e.pct / 5);
        return `
        <div class="lifetime-row">
            <span class="lifetime-skill">${SKILL_ABBR[e.skill] || e.skill}</span>
            <span class="lifetime-bar">${'█'.repeat(bar)}${'░'.repeat(20 - bar)}</span>
            <span class="lifetime-score ${cls}">${e.correct}/${e.total} (${e.pct}%)</span>
        </div>`;
    }).join('');
}
