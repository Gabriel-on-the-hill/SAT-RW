// ══════════════════════════════════════════════════════════════════
// config.js  —  Tutor-adjustable settings, persisted in localStorage.
// ══════════════════════════════════════════════════════════════════
// Load BEFORE app.js (index.html) and BEFORE hw-timer.js (homework-run.html).
// All values have safe defaults, so the app works even if nothing is set.
//
// Settings the tutor can change (via the progress panel on the Practice page):
//   • Exam date            — drives the "N days to SAT" countdown.
//   • Per-question budget  — the homework countdown timer (seconds).
//   • Relax anti-cheat     — allow text selection / shortcuts (read directly
//                            by anti-cheat.js from the same key).

const CFG_KEYS = {
    EXAM_DATE: 'satrw_cfg_exam_date',  // 'YYYY-MM-DD'
    Q_BUDGET:  'satrw_cfg_q_budget',   // integer seconds
    RELAX:     'satrw_cfg_relax',      // '1' = relaxed
};

const CFG_DEFAULTS = {
    // The sitting is SATURDAY 12 SEPTEMBER 2026, confirmed in the 11 Aug class.
    // Two earlier values were wrong and both reached the student's home screen:
    // 2026-08-23 (a Sunday — no sitting falls on one) and then 2026-08-22, which
    // was the right weekday for the wrong month.
    //
    // THIS DEFAULT ONLY APPLIES TO A DEVICE THAT HAS NEVER HAD A DATE SET.
    // getExamDateStr() prefers the localStorage value whenever it parses, so a
    // device carrying an older date keeps it and this edit does not reach it.
    // Setting it on HIS device, from the progress panel, is a separate action.
    EXAM_DATE: '2026-09-12',
    Q_BUDGET:  100,
};

const MasteryConfig = {
    _get(key) { try { return localStorage.getItem(key); } catch (e) { return null; } },
    _set(key, val) { try { localStorage.setItem(key, val); return true; } catch (e) { return false; } },

    getExamDateStr() {
        const v = this._get(CFG_KEYS.EXAM_DATE);
        return (v && /^\d{4}-\d{2}-\d{2}$/.test(v)) ? v : CFG_DEFAULTS.EXAM_DATE;
    },
    getExamDate() {
        // Parse as local midnight to avoid timezone-off-by-one on the countdown.
        const [y, m, d] = this.getExamDateStr().split('-').map(Number);
        return new Date(y, m - 1, d);
    },
    setExamDate(str) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(str || '')) return false;
        return this._set(CFG_KEYS.EXAM_DATE, str);
    },

    getQuestionBudget() {
        const n = parseInt(this._get(CFG_KEYS.Q_BUDGET), 10);
        return (Number.isFinite(n) && n >= 20 && n <= 600) ? n : CFG_DEFAULTS.Q_BUDGET;
    },
    setQuestionBudget(n) {
        n = parseInt(n, 10);
        if (!Number.isFinite(n) || n < 20 || n > 600) return false;
        return this._set(CFG_KEYS.Q_BUDGET, String(n));
    },

    isAntiCheatRelaxed() { return this._get(CFG_KEYS.RELAX) === '1'; },
    setAntiCheatRelaxed(on) { return this._set(CFG_KEYS.RELAX, on ? '1' : '0'); },
};

// Expose globally for non-module scripts.
window.MasteryConfig = MasteryConfig;
