// ══════════════════════════════════════════════════════════════════
// TIMER  (stopwatch + countdown)
// ══════════════════════════════════════════════════════════════════
// Uses shared globals declared in app.js: timerMode, userMode,
// secondsElapsed, countdownRemaining, timerInterval, activeQuestions, score.

// Effective timer kind, combining the setup choice with exam mode
// (exam mode implies a stopwatch when no other timer is configured).
function effectiveTimer() {
    if (timerMode === 'countdown') return 'countdown';
    if (timerMode === 'stopwatch' || userMode === 'exam') return 'stopwatch';
    return 'off';
}

function startTimer() {
    stopTimer();
    timerInterval = setInterval(() => {
        secondsElapsed++;
        if (effectiveTimer() === 'countdown') {
            countdownRemaining--;
            if (countdownRemaining <= 0) {
                countdownRemaining = 0;
                updateTimerDisplay();
                stopTimer();
                handleTimeUp();
                return;
            }
        }
        updateTimerDisplay();
    }, 1000);
}

function stopTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

function updateTimerDisplay() {
    const el = document.getElementById('timerDisplay');
    if (!el) return;
    const countdown = effectiveTimer() === 'countdown';
    const secs = countdown ? Math.max(0, countdownRemaining) : secondsElapsed;
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    el.textContent =
        `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    el.classList.toggle('timer-low', countdown && secs <= 30 && secs > 0);
}

// Show/hide and (re)start the timer based on the current mode + setting.
function applyTimerState() {
    const el = document.getElementById('timerDisplay');
    if (!el) return;
    if (effectiveTimer() === 'off') {
        stopTimer();
        el.classList.add('hidden');
        el.classList.remove('timer-low');
        return;
    }
    el.classList.remove('hidden');
    updateTimerDisplay();
    startTimer();
}

// Countdown ran out — finalise the session (mock exam included).
function handleTimeUp() {
    if (document.getElementById('completionScreen').style.display !== 'none') return;
    finalizeSession();   // defined in app.js
}
