// ── Question bank (combined from domain files) ────────────────────
const questionBank = [
    ...(typeof questionBank_CS  !== 'undefined' ? questionBank_CS  : []),
    ...(typeof questionBank_EOI !== 'undefined' ? questionBank_EOI : []),
];

// ── Constants ─────────────────────────────────────────────────────
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
};

const SKILL_ABBR = {
    'Words in Context':           'WIC',
    'Text Structure and Purpose': 'TSP',
    'Cross-Text Connections':     'CTC',
    'Rhetorical Synthesis':       'RS',
    'Transitions':                'Trans',
};

const STORAGE = {
    HISTORY: 'wayne_sat_history',
    SESSION: 'wayne_sat_session',
    SPLIT:   'wayne_sat_split',
};

// ── State ─────────────────────────────────────────────────────────
let currentQuestionIndex = 0;
let score            = 0;
let userMode         = 'assisted';
let timerInterval    = null;
let secondsElapsed   = 0;
let isAnswered       = false;
let activeQuestions  = [];
let missedQuestions  = [];   // [{q, selected}]
let sessionResults   = [];   // [{q, selected, correct, isCorrect}]
let reviewMode       = false;

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

function buildActiveQuestions() {
    const skills = getSelectedSkills();
    const diffs  = getSelectedDiffs();
    const limit  = getLimit();

    let filtered = questionBank.filter(
        q => skills.includes(q.skill) && diffs.includes(q.difficulty)
    );

    // Fisher-Yates shuffle — unpredictable order every session
    for (let i = filtered.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [filtered[i], filtered[j]] = [filtered[j], filtered[i]];
    }

    return limit > 0 ? filtered.slice(0, limit) : filtered;
}

function updateSetupUI() {
    const diffs = getSelectedDiffs();

    [
        ['Words in Context',           'count-wic'],
        ['Text Structure and Purpose', 'count-tsp'],
        ['Cross-Text Connections',     'count-ctx'],
        ['Rhetorical Synthesis',       'count-rhs'],
        ['Transitions',                'count-trans'],
    ].forEach(([skill, id]) => {
        const n = questionBank.filter(
            q => q.skill === skill && diffs.includes(q.difficulty)
        ).length;
        document.getElementById(id).textContent = n + ' q';
    });

    const total    = buildActiveQuestions().length;
    const summaryEl = document.getElementById('sessionSummary');
    const startBtn  = document.getElementById('startSessionBtn');

    if (total === 0) {
        summaryEl.textContent = 'No questions match — adjust your selections.';
        summaryEl.className   = 'session-summary session-summary-empty';
        startBtn.disabled     = true;
    } else {
        const labels = getSelectedSkills().map(s => SKILL_ABBR[s] || s);
        summaryEl.textContent =
            `${total} question${total !== 1 ? 's' : ''} — ${labels.join(' + ')} — ${diffs.join(' · ')}`;
        summaryEl.className = 'session-summary';
        startBtn.disabled   = false;
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
    document.getElementById('limitSelect').value = btn.dataset.limit;
    updateSetupUI();
}

function enterPractice() {
    document.getElementById('hubScreen').style.display = 'none';
    showSetup();
}

function showSetup() {
    stopTimer();
    document.getElementById('timerDisplay').classList.add('hidden');
    document.getElementById('setupScreen').style.display = 'flex';
    document.getElementById('app').style.display         = 'none';
    document.getElementById('completionScreen').style.display = 'none';
    updateSetupUI();
    renderHistory();
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
    const total = activeQuestions.length;
    const pct   = Math.round((score / total) * 100);

    // Big score
    document.getElementById('completionBigScore').textContent = `${score} / ${total}`;
    const pctEl = document.getElementById('completionPct');
    pctEl.textContent  = `${pct}%`;
    pctEl.className    = 'completion-pct ' +
        (pct >= 80 ? 'pct-pass' : pct >= 60 ? 'pct-warn' : 'pct-fail');

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
            const bar = Math.round(p / 5); // 0-20 blocks
            const filled = '█'.repeat(bar);
            const empty  = '░'.repeat(20 - bar);
            return `
            <div class="breakdown-row">
                <span class="breakdown-skill">${SKILL_ABBR[skill] || skill}</span>
                <span class="breakdown-bar">${filled}${empty}</span>
                <span class="breakdown-score ${cls}">${s.correct}/${s.total} (${p}%)</span>
            </div>`;
        }).join('');

    // Missed questions
    const missedListEl   = document.getElementById('missedList');
    const reviewBtn      = document.getElementById('reviewMissedBtn');
    const missedHeading  = document.getElementById('missedHeading');

    if (missedQuestions.length === 0) {
        missedHeading.textContent     = 'All correct \u2014 no misses this session';
        missedListEl.innerHTML        = '';
        reviewBtn.style.display       = 'none';
    } else {
        missedHeading.textContent     = `Missed (${missedQuestions.length})`;
        document.getElementById('missedCount').textContent = missedQuestions.length;
        reviewBtn.style.display = 'flex';

        missedListEl.innerHTML = missedQuestions.map(({ q, selected }) => {
            const shortQ     = q.question.length > 120
                ? q.question.slice(0, 120) + '\u2026'
                : q.question;
            const wrongOpt   = q.options.find(o => o.startsWith(selected + '.')) || '';
            const rightOpt   = q.options.find(o => o.startsWith(q.answer + '.'))  || '';
            const wrongText  = wrongOpt.slice(3).trim();
            const rightText  = rightOpt.slice(3).trim();
            const diffCls    = q.difficulty === 'Easy' ? 'badge-green'
                             : q.difficulty === 'Hard' ? 'badge-red' : 'badge-orange';
            return `
            <div class="missed-item">
                <div class="missed-meta">
                    <span class="badge ${diffCls}" style="font-size:0.65rem">${q.difficulty}</span>
                    <span class="missed-skill">${SKILL_ABBR[q.skill] || q.skill}</span>
                </div>
                <div class="missed-q">${escapeHtml(shortQ)}</div>
                <div class="missed-answers">
                    <span class="missed-wrong">\u2717 ${escapeHtml(wrongText)}</span>
                    <span class="missed-right">\u2713 ${escapeHtml(rightText)}</span>
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
    const toReview   = missedQuestions.map(m => m.q);
    reviewMode       = true;
    activeQuestions  = toReview;
    missedQuestions  = [];
    sessionResults   = [];
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

function formatText(text, skill) {
    if (!text) return '<em>No passage for this question.</em>';

    let html = text.replace(/\ufb01/g, 'fi').replace(/\ufb02/g, 'fl');

    // ── Rhetorical Synthesis: render notes as bullet list ────────
    if (skill === 'Rhetorical Synthesis') {
        const colonIdx = html.indexOf(':');
        if (colonIdx !== -1) {
            const intro    = escapeHtml(html.substring(0, colonIdx + 1));
            const notesRaw = html.substring(colonIdx + 1).trim();
            const notes    = notesRaw.split(/(?<=\.)\s+(?=[A-Z\u201c\u2018"])/);
            const items    = notes
                .map(n => n.trim()).filter(n => n.length > 0)
                .map(n => `<li>${escapeHtml(n)}</li>`)
                .join('');
            return `<p class="rs-intro">${intro}</p><ul class="rs-notes">${items}</ul>`;
        }
    }

    // ── Transitions: highlight the blank ─────────────────────────
    if (skill === 'Transitions') {
        html = escapeHtml(html);
        html = html.replace(/_{4,}/g, '<span class="trans-blank">______</span>');
        return html;
    }

    return escapeHtml(html);
}

// ══════════════════════════════════════════════════════════════════
// QUESTION DISPLAY
// ══════════════════════════════════════════════════════════════════

function loadQuestion(index) {
    isAnswered = false;
    const q    = activeQuestions[index];

    // Reset panels
    const feedbackContainer = document.getElementById('feedbackContainer');
    const optionsContainer  = document.getElementById('optionsContainer');
    const predictionStep    = document.getElementById('predictionStep');

    feedbackContainer.className = 'feedback-section';
    optionsContainer.innerHTML  = '';
    optionsContainer.classList.add('hidden');
    predictionStep.classList.add('hidden');

    // Badges
    document.getElementById('skillBadge').textContent = q.skill;
    const diffBadge = document.getElementById('difficultyBadge');
    diffBadge.textContent = q.difficulty;
    diffBadge.className   = 'badge ' + (
        q.difficulty === 'Easy' ? 'badge-green' :
        q.difficulty === 'Hard' ? 'badge-red'   : 'badge-orange'
    );
    document.getElementById('questionCounter').textContent =
        `Q ${index + 1} / ${activeQuestions.length}`;

    // Review mode label
    const reviewLabel = document.getElementById('reviewLabel');
    if (reviewLabel) reviewLabel.style.display = reviewMode ? 'inline-block' : 'none';

    // Passage
    document.getElementById('passageContent').innerHTML = formatText(q.passage, q.skill);

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

    // Assisted-mode hint
    if (userMode === 'assisted') {
        const hint = document.getElementById('predictionHint');
        if (q.skill === 'Words in Context') {
            hint.innerHTML =
                '&#128161; <strong>Two-Filter Method</strong><br>' +
                'Predict the meaning from context \u2014 then apply:<br>' +
                '<strong>Filter 1:</strong> Logical sense?&nbsp;&nbsp;' +
                '<strong>Filter 2:</strong> Right <em>tone and intensity</em>?';
        } else if (q.skill === 'Text Structure and Purpose') {
            hint.innerHTML =
                '&#128161; <strong>Function Map</strong><br>' +
                'What is the author <em>doing</em> \u2014 not what it\'s about.<br>' +
                '<em>Argues \u00b7 Describes \u00b7 Explains \u00b7 Compares \u00b7 Challenges \u00b7 Supports \u00b7 Narrates</em>';
        } else if (q.skill === 'Cross-Text Connections') {
            hint.innerHTML =
                '&#128161; <strong>Perspective Synthesis</strong><br>' +
                'Summarise each text, then name the relationship:<br>' +
                '<em>Agreement \u00b7 Disagreement \u00b7 Extension \u00b7 Qualification \u00b7 Exemplification</em>';
        } else if (q.skill === 'Rhetorical Synthesis') {
            hint.innerHTML =
                '&#128161; <strong>Goal-First Filter</strong><br>' +
                'Read the <em>writing goal</em> before the notes. Every answer must accomplish that exact goal.<br>' +
                'Cross out answers that accomplish the <em>wrong</em> goal \u2014 even if they use the notes accurately.';
        } else if (q.skill === 'Transitions') {
            hint.innerHTML =
                '&#128161; <strong>Direction Check</strong><br>' +
                'Identify the logical relationship between sentences <em>before</em> looking at options:<br>' +
                '<em>Contrast \u00b7 Addition \u00b7 Cause-Effect \u00b7 Example \u00b7 Sequence</em><br>' +
                'Wrong direction = wrong answer, even if the word sounds formal.';
        } else {
            hint.innerHTML = '&#128161; Predict your answer before revealing the options.';
        }
        predictionStep.classList.remove('hidden');
        applyHighlights(q);
    } else {
        optionsContainer.classList.remove('hidden');
    }

    // Build option buttons
    q.options.forEach(opt => {
        const btn    = document.createElement('button');
        btn.className = 'option-btn';
        btn.innerHTML = `<span>${escapeHtml(opt)}</span>`;
        const letter  = opt.trim()[0];
        btn.addEventListener('click', () => handleOptionClick(btn, letter, q));
        optionsContainer.appendChild(btn);
    });
}

function applyHighlights(q) {
    const passageEl = document.getElementById('passageContent');

    if (q.skill === 'Words in Context') {
        const match = q.question.match(/"([^"]+)"/);
        if (!match) return;
        const word  = match[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${word})`, 'gi');
        passageEl.innerHTML = passageEl.innerHTML.replace(
            regex, '<span class="highlight">$1</span>'
        );
    }
    // Transitions blank is highlighted inside formatText — nothing more needed
}

// ══════════════════════════════════════════════════════════════════
// ANSWER HANDLING
// ══════════════════════════════════════════════════════════════════

function handleOptionClick(btn, selectedLetter, q) {
    if (isAnswered) return;
    isAnswered = true;

    const isCorrect         = selectedLetter === q.answer;
    const feedbackContainer = document.getElementById('feedbackContainer');
    const feedbackTitle     = document.getElementById('feedbackTitle');
    const optionsContainer  = document.getElementById('optionsContainer');

    // Track result
    sessionResults.push({ q, selected: selectedLetter, correct: q.answer, isCorrect });
    if (!isCorrect) missedQuestions.push({ q, selected: selectedLetter });

    if (isCorrect) {
        btn.classList.add('correct');
        score++;
        document.getElementById('currentScore').textContent = score;
        feedbackTitle.textContent   = 'Correct!';
        feedbackContainer.className = 'feedback-section visible feedback-success';
    } else {
        btn.classList.add('incorrect');
        // Reveal correct answer
        Array.from(optionsContainer.children).forEach(b => {
            if (b.innerText.trim().startsWith(q.answer + '.')) b.classList.add('correct');
        });
        feedbackTitle.textContent   = 'Not quite.';
        feedbackContainer.className = 'feedback-section visible feedback-error';
    }

    document.getElementById('feedbackText').innerText   = q.explanation;
    document.getElementById('strategyName').textContent = q.strategy || 'Standard POE';
    document.getElementById('trapName').textContent     = TRAP_SETS[q.skill] || q.trapName || '\u2014';

    // Persist session state after every answer
    saveSessionState();
}

// ══════════════════════════════════════════════════════════════════
// SESSION STATE  (resume on refresh)
// ══════════════════════════════════════════════════════════════════

function saveSessionState() {
    const state = {
        questionIds:    activeQuestions.map(q => q.id),
        index:          currentQuestionIndex,
        score,
        mode:           userMode,
        missedIds:      missedQuestions.map(m => m.q.id),
        secondsElapsed,
        savedAt:        Date.now(),
    };
    try { localStorage.setItem(STORAGE.SESSION, JSON.stringify(state)); } catch(e) {}
}

function loadSessionState() {
    try {
        const raw = localStorage.getItem(STORAGE.SESSION);
        if (!raw) return null;
        const state = JSON.parse(raw);
        // Expire after 24 hours
        if (Date.now() - state.savedAt > 86_400_000) { clearSessionState(); return null; }
        return state;
    } catch(e) { return null; }
}

function clearSessionState() {
    localStorage.removeItem(STORAGE.SESSION);
}

function restoreSession(state) {
    const idMap      = Object.fromEntries(questionBank.map(q => [q.id, q]));
    activeQuestions  = state.questionIds.map(id => idMap[id]).filter(Boolean);
    if (activeQuestions.length === 0) { clearSessionState(); return false; }

    currentQuestionIndex = Math.min(state.index, activeQuestions.length - 1);
    score                = state.score        || 0;
    secondsElapsed       = state.secondsElapsed || 0;
    userMode             = state.mode          || 'assisted';
    missedQuestions      = (state.missedIds || [])
        .map(id => idMap[id]).filter(Boolean).map(q => ({ q }));
    return true;
}

function checkForSavedSession() {
    const banner = document.getElementById('resumeBanner');
    if (!banner) return;
    const state = loadSessionState();
    if (!state) { banner.style.display = 'none'; return; }

    const idMap   = Object.fromEntries(questionBank.map(q => [q.id, q]));
    const valid   = state.questionIds.filter(id => idMap[id]).length;
    if (valid === 0) { clearSessionState(); banner.style.display = 'none'; return; }

    const answered  = state.index;
    const remaining = valid - answered;
    document.getElementById('resumeInfo').textContent =
        `Saved session \u2014 Q${answered + 1}/${valid} \u00b7 ${state.score} correct so far \u00b7 ${remaining} remaining`;
    banner.style.display = 'flex';
}

// ══════════════════════════════════════════════════════════════════
// PROGRESS / TIMER
// ══════════════════════════════════════════════════════════════════

function resetProgress() {
    currentQuestionIndex = 0;
    score                = 0;
    secondsElapsed       = 0;
    if (!reviewMode) { missedQuestions = []; sessionResults = []; }
    document.getElementById('currentScore').textContent    = '0';
    document.getElementById('questionCounter').textContent =
        `Q 1 / ${activeQuestions.length}`;
    updateTimerDisplay();
}

function startTimer() {
    stopTimer();
    timerInterval = setInterval(() => { secondsElapsed++; updateTimerDisplay(); }, 1000);
}

function stopTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

function updateTimerDisplay() {
    const m = Math.floor(secondsElapsed / 60);
    const s = secondsElapsed % 60;
    document.getElementById('timerDisplay').textContent =
        `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// ══════════════════════════════════════════════════════════════════
// SESSION HISTORY
// ══════════════════════════════════════════════════════════════════

function logSession(skills, diffs, sessionScore, total) {
    const record = {
        date:   new Date().toISOString(),
        skills, diffs,
        score:  sessionScore,
        total,
        pct:    Math.round((sessionScore / total) * 100),
    };
    let history = [];
    try { history = JSON.parse(localStorage.getItem(STORAGE.HISTORY)) || []; } catch(e) {}
    history.unshift(record);
    if (history.length > 20) history = history.slice(0, 20);
    try { localStorage.setItem(STORAGE.HISTORY, JSON.stringify(history)); } catch(e) {}
}

function renderHistory() {
    const container = document.getElementById('historyList');
    if (!container) return;

    let history = [];
    try { history = JSON.parse(localStorage.getItem(STORAGE.HISTORY)) || []; } catch(e) {}

    if (history.length === 0) {
        container.innerHTML = '<p class="history-empty">No sessions yet.</p>';
        return;
    }

    container.innerHTML = history.slice(0, 8).map(r => {
        const d       = new Date(r.date);
        const dateStr = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        const timeStr = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        const labels  = r.skills.map(s => SKILL_ABBR[s] || s).join(' + ');
        const cls     = r.pct >= 80 ? 'hist-pass' : r.pct >= 60 ? 'hist-warn' : 'hist-fail';
        return `
        <div class="hist-row">
            <span class="hist-date">${dateStr} ${timeStr}</span>
            <span class="hist-skills">${labels}</span>
            <span class="hist-score ${cls}">${r.score}/${r.total} (${r.pct}%)</span>
        </div>`;
    }).join('');
}

// ══════════════════════════════════════════════════════════════════
// RESIZABLE PANELS
// ══════════════════════════════════════════════════════════════════

function initResizablePanel() {
    const handle    = document.getElementById('resizeHandle');
    const leftPanel = document.querySelector('.passage-panel');
    const rightPanel= document.querySelector('.question-panel');
    const container = document.querySelector('.main-content');
    if (!handle || !leftPanel || !rightPanel) return;

    // Restore saved split
    const saved = localStorage.getItem(STORAGE.SPLIT);
    if (saved) {
        leftPanel.style.flex  = 'none';
        leftPanel.style.width = saved + 'px';
        rightPanel.style.flex = '1';
    }

    let dragging = false, startX = 0, startWidth = 0;

    handle.addEventListener('mousedown', e => {
        dragging    = true;
        startX      = e.clientX;
        startWidth  = leftPanel.getBoundingClientRect().width;
        document.body.style.cursor     = 'col-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
    });

    document.addEventListener('mousemove', e => {
        if (!dragging) return;
        const containerW = container.getBoundingClientRect().width - handle.offsetWidth;
        const newW       = Math.max(260, Math.min(containerW - 260, startWidth + (e.clientX - startX)));
        leftPanel.style.flex  = 'none';
        leftPanel.style.width = newW + 'px';
        rightPanel.style.flex = '1';
    });

    document.addEventListener('mouseup', () => {
        if (!dragging) return;
        dragging                       = false;
        document.body.style.cursor     = '';
        document.body.style.userSelect = '';
        try {
            localStorage.setItem(STORAGE.SPLIT,
                leftPanel.getBoundingClientRect().width);
        } catch(e) {}
    });

    // Double-click handle to reset 50/50
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
        // Ignore when typing
        if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;

        const onSetup      = document.getElementById('setupScreen').style.display      !== 'none';
        const onCompletion = document.getElementById('completionScreen').style.display !== 'none';
        if (onSetup || onCompletion) return;

        const key = e.key.toUpperCase();

        // Space / Enter — reveal choices OR advance
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

        // Arrow-right — advance when answered
        if (key === 'ARROWRIGHT' && isAnswered) {
            e.preventDefault();
            document.getElementById('nextBtn').click();
            return;
        }

        // A/B/C/D or 1/2/3/4 — select answer
        const letterMap = { A:'A', B:'B', C:'C', D:'D', '1':'A', '2':'B', '3':'C', '4':'D' };
        if (letterMap[key]) {
            const optContainer = document.getElementById('optionsContainer');
            if (optContainer.classList.contains('hidden') || isAnswered) return;
            const target = Array.from(optContainer.querySelectorAll('.option-btn'))
                .find(b => b.innerText.trim().startsWith(letterMap[key] + '.'));
            if (target) { e.preventDefault(); target.click(); }
        }
    });
}

// ══════════════════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════════════════

function init() {

    // Setup screen listeners
    document.querySelectorAll('input[name="skill"], input[name="diff"]')
        .forEach(el => el.addEventListener('change', updateSetupUI));

    document.getElementById('limitSelect').addEventListener('change', updateSetupUI);

    document.querySelectorAll('.preset-btn')
        .forEach(btn => btn.addEventListener('click', () => applyPreset(btn)));

    document.getElementById('startSessionBtn').addEventListener('click', () => {
        activeQuestions = buildActiveQuestions();
        if (activeQuestions.length === 0) return;
        reviewMode   = false;
        missedQuestions = [];
        sessionResults  = [];
        resetProgress();
        clearSessionState();
        hideSetup();
        loadQuestion(0);
        if (userMode === 'exam') {
            document.getElementById('timerDisplay').classList.remove('hidden');
            startTimer();
        }
    });

    document.getElementById('changeSessionBtn').addEventListener('click', showSetup);

    document.getElementById('modeSelect').addEventListener('change', e => {
        userMode = e.target.value;
        const timerDisplay = document.getElementById('timerDisplay');
        if (userMode === 'exam') {
            timerDisplay.classList.remove('hidden');
            startTimer();
        } else {
            timerDisplay.classList.add('hidden');
            stopTimer();
        }
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
            stopTimer();
            clearSessionState();
            const skills = [...new Set(activeQuestions.map(q => q.skill))];
            const diffs  = [...new Set(activeQuestions.map(q => q.difficulty))];
            logSession(skills, diffs, score, activeQuestions.length);
            showCompletion();
        }
    });

    // Completion screen
    document.getElementById('reviewMissedBtn').addEventListener('click', startReviewMissed);
    document.getElementById('newSessionBtn').addEventListener('click', () => {
        reviewMode = false;
        showSetup();
    });

    // History toggle
    document.getElementById('historyToggle').addEventListener('click', () => {
        const list    = document.getElementById('historyList');
        const chevron = document.getElementById('historyChevron');
        const open    = list.style.display !== 'none';
        list.style.display  = open ? 'none' : 'block';
        chevron.textContent = open ? '\u25b8' : '\u25be';
    });

    // Resume banner
    document.getElementById('resumeBtn').addEventListener('click', () => {
        const state = loadSessionState();
        if (state && restoreSession(state)) {
            clearSessionState();
            document.getElementById('resumeBanner').style.display = 'none';
            document.getElementById('modeSelect').value = userMode;
            hideSetup();
            loadQuestion(currentQuestionIndex);
            if (userMode === 'exam') {
                document.getElementById('timerDisplay').classList.remove('hidden');
                startTimer();
            }
        }
    });

    document.getElementById('discardBtn').addEventListener('click', () => {
        clearSessionState();
        document.getElementById('resumeBanner').style.display = 'none';
    });

    // Features
    initResizablePanel();
    initKeyboardShortcuts();
}

init();
