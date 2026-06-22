// ══════════════════════════════════════════════════════════════════
// SESSION HISTORY + LIFETIME SKILL STATS
// ══════════════════════════════════════════════════════════════════
// Uses shared globals from app.js (SKILL_ABBR, sessionResults, secondsElapsed,
// userMode) and storage.js (STORAGE). Persistence is read/written through the
// safe* helpers in storage.js so a full localStorage never throws.

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
