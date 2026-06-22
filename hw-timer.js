// ─────────────────────────────────────────────────────────────────
// hw-timer.js  —  Per-question timer used by every homework screen.
//
// Goals:
//   • A visible live timer in the homework header so the student feels
//     test-day time pressure — cheating costs more time than the question
//     window allows, so it's faster to actually attempt the question.
//   • Records seconds spent on each question so the tutor can spot
//     anomalies (e.g. a Hard item answered correctly in 12 seconds, or
//     a Medium item that absorbed 3 minutes — both worth a conversation).
//
// Integration (each homework-*.js):
//   • Call hwTimer.init()                 — idempotent; sets up the badge.
//   • Call hwTimer.stop() at the top of renderQuestion(i) — captures the
//     previous question's elapsed seconds.
//   • Call hwTimer.start(i) at the bottom of renderQuestion(i) — starts
//     ticking for the new question.
//   • Call hwTimer.stop() at the top of confirmSubmit().
//   • Persist hwTimer.getAll() inside saveHwState; restore with
//     hwTimer.setAll(state.timings) when resuming.
//   • Read hwTimer.getAll() + hwTimer.totalSeconds() inside showHwResults
//     to surface per-question and session-total timing.
// ─────────────────────────────────────────────────────────────────

(function () {
    // Per-question budget (seconds). Tutor-adjustable via config.js / Settings;
    // defaults to 100s (90s original proposal + 10s slack).
    const QUESTION_BUDGET = (window.MasteryConfig)
        ? MasteryConfig.getQuestionBudget() : 100;

    const timer = {
        QUESTION_BUDGET,
        timings: {},      // { questionIndex: secondsAccumulated }
        currentIdx: null,
        startTs: null,
        interval: null,
        badge: null,

        init() {
            if (this.badge && document.body.contains(this.badge)) return;
            const header  = document.querySelector('.hw-header');
            if (!header) return;
            const counter = header.querySelector('.hw-counter');
            if (!counter) return;

            const badge = document.createElement('span');
            badge.id = 'hwTimerBadge';
            badge.className = 'hw-counter';
            badge.style.cssText = [
                'margin-left:0.6rem',
                'font-variant-numeric:tabular-nums',
                'color:#64748b',
                'min-width:2.6rem',
                'text-align:right',
            ].join(';');
            badge.textContent = this.format(QUESTION_BUDGET);
            counter.insertAdjacentElement('afterend', badge);
            this.badge = badge;
        },

        start(idx) {
            this.stop();
            this.currentIdx = idx;
            this.startTs    = Date.now();
            this._render();
            this.interval   = setInterval(() => this._render(), 1000);
        },

        stop() {
            if (this.interval) { clearInterval(this.interval); this.interval = null; }
            if (this.currentIdx != null && this.startTs != null) {
                const elapsed = Math.floor((Date.now() - this.startTs) / 1000);
                this.timings[this.currentIdx] = (this.timings[this.currentIdx] || 0) + elapsed;
            }
            this.startTs = null;
        },

        _render() {
            if (!this.badge) return;
            const stored = this.timings[this.currentIdx] || 0;
            const live   = this.startTs ? Math.floor((Date.now() - this.startTs) / 1000) : 0;
            const total  = stored + live;
            const remaining = QUESTION_BUDGET - total;
            // Display: countdown while under budget; "-M:SS" overage in red
            // when over. Per-question; leftover does NOT pool across questions.
            if (remaining >= 0) {
                this.badge.textContent = this.format(remaining);
                this.badge.style.color = remaining > 20 ? '#64748b' : '#b45309';
            } else {
                this.badge.textContent = '-' + this.format(-remaining);
                this.badge.style.color = '#dc2626';
            }
        },

        format(s) {
            s = Math.max(0, s | 0);
            const m   = Math.floor(s / 60);
            const sec = s % 60;
            return `${m}:${sec.toString().padStart(2, '0')}`;
        },

        getAll()       { return { ...this.timings }; },
        setAll(t)      { this.timings = { ...(t || {}) }; },
        totalSeconds() {
            return Object.values(this.timings).reduce((a, b) => a + (b || 0), 0);
        },
        reset() {
            this.stop();
            this.timings   = {};
            this.currentIdx = null;
            if (this.badge) {
                this.badge.textContent = this.format(QUESTION_BUDGET);
                this.badge.style.color = '#64748b';
            }
        },
    };

    window.hwTimer = timer;
})();
