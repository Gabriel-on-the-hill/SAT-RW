// ── State ────────────────────────────────────────────────────────
let currentQuestionIndex = 0;
let score = 0;
let userMode = 'assisted';
let timerInterval = null;
let secondsElapsed = 0;
let isAnswered = false;
let activeQuestions = [];

// ── Trap sets shown in the feedback box after every answer ────────
const TRAP_SETS = {
    'Words in Context':
        'Familiar Definition · Fancy Synonym · Connotation Mismatch',
    'Text Structure and Purpose':
        'Topic Match Function Miss · Part-for-Whole · Intensity Mismatch',
    'Cross-Text Connections':
        'One-Sided Focus · Qualification as Disagreement · Shared Topic = Agreement',
};

// ── Difficulty sort order ─────────────────────────────────────────
const DIFF_ORDER = { Easy: 0, Medium: 1, Hard: 2 };

// ── Session setup helpers ─────────────────────────────────────────
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

    // Sort Easy → Medium → Hard, then alphabetically by skill within same difficulty
    filtered.sort((a, b) => {
        const byDiff = DIFF_ORDER[a.difficulty] - DIFF_ORDER[b.difficulty];
        return byDiff !== 0 ? byDiff : a.skill.localeCompare(b.skill);
    });

    return limit > 0 ? filtered.slice(0, limit) : filtered;
}

function updateSetupUI() {
    const diffs = getSelectedDiffs();

    // Per-skill live counts
    [
        ['Words in Context',           'count-wic'],
        ['Text Structure and Purpose', 'count-tsp'],
        ['Cross-Text Connections',     'count-ctx'],
    ].forEach(([skill, id]) => {
        const n = questionBank.filter(
            q => q.skill === skill && diffs.includes(q.difficulty)
        ).length;
        document.getElementById(id).textContent = n + ' q';
    });

    const total = buildActiveQuestions().length;
    const summaryEl = document.getElementById('sessionSummary');
    const startBtn  = document.getElementById('startSessionBtn');

    if (total === 0) {
        summaryEl.textContent = 'No questions match — adjust your selections.';
        summaryEl.className = 'session-summary session-summary-empty';
        startBtn.disabled = true;
    } else {
        const skillLabels = getSelectedSkills().map(s =>
            s === 'Words in Context'           ? 'WIC'       :
            s === 'Text Structure and Purpose' ? 'TSP'       : 'Cross-Text'
        );
        summaryEl.textContent =
            `${total} question${total !== 1 ? 's' : ''} — ${skillLabels.join(' + ')} — ${diffs.join(' · ')}`;
        summaryEl.className = 'session-summary';
        startBtn.disabled = false;
    }
}

function applyPreset(btn) {
    const skills = btn.dataset.skills.split(',');
    const diffs  = btn.dataset.diffs.split(',');
    const limit  = btn.dataset.limit;

    document.querySelectorAll('input[name="skill"]').forEach(el => {
        el.checked = skills.includes(el.value);
    });
    document.querySelectorAll('input[name="diff"]').forEach(el => {
        el.checked = diffs.includes(el.value);
    });
    document.getElementById('limitSelect').value = limit;
    updateSetupUI();
}

// ── Show / hide setup overlay ─────────────────────────────────────
function showSetup() {
    stopTimer();
    document.getElementById('timerDisplay').classList.add('hidden');
    document.getElementById('setupScreen').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
    updateSetupUI();
}

function hideSetup() {
    document.getElementById('setupScreen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
}

// ── Question display ──────────────────────────────────────────────
function loadQuestion(index) {
    isAnswered = false;
    const q = activeQuestions[index];

    // Reset panel
    const feedbackContainer = document.getElementById('feedbackContainer');
    const optionsContainer  = document.getElementById('optionsContainer');
    const predictionStep    = document.getElementById('predictionStep');

    feedbackContainer.className = 'feedback-section';
    optionsContainer.innerHTML  = '';
    optionsContainer.classList.add('hidden');
    predictionStep.classList.add('hidden');

    // Badges
    document.getElementById('skillBadge').textContent      = q.skill;
    const diffBadge = document.getElementById('difficultyBadge');
    diffBadge.textContent = q.difficulty;
    diffBadge.className   = 'badge ' + (
        q.difficulty === 'Easy' ? 'badge-green' :
        q.difficulty === 'Hard' ? 'badge-red'   : 'badge-orange'
    );
    document.getElementById('questionCounter').textContent =
        `Q ${index + 1} / ${activeQuestions.length}`;

    // Content
    document.getElementById('passageContent').innerHTML = formatText(q.passage);
    document.getElementById('questionText').textContent  = q.question;

    // Assisted-mode hint — tailored per skill
    if (userMode === 'assisted') {
        const hint = document.getElementById('predictionHint');
        if (q.skill === 'Words in Context') {
            hint.innerHTML =
                '&#128161; <strong>Two-Filter Method</strong><br>' +
                'Predict the meaning from context — then apply:<br>' +
                '<strong>Filter 1:</strong> Logical sense?&nbsp;&nbsp;' +
                '<strong>Filter 2:</strong> Right <em>tone and intensity</em>?';
        } else if (q.skill === 'Text Structure and Purpose') {
            hint.innerHTML =
                '&#128161; <strong>Function Map</strong><br>' +
                'What is the author <em>doing</em> — not what it\'s about.<br>' +
                '<em>Argues · Describes · Explains · Compares · Challenges · Supports · Narrates</em>';
        } else if (q.skill === 'Cross-Text Connections') {
            hint.innerHTML =
                '&#128161; <strong>Perspective Synthesis</strong><br>' +
                'Summarise each text, then name the relationship:<br>' +
                '<em>Agreement · Disagreement · Extension · Qualification · Exemplification · Different Aspect</em>';
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
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.innerHTML = `<span>${opt}</span>`;
        const letter = opt.trim()[0];
        btn.addEventListener('click', () => handleOptionClick(btn, letter, q));
        optionsContainer.appendChild(btn);
    });
}

function formatText(text) {
    if (!text) return '<em>No passage for this question.</em>';
    return text.replace(/\ufb01/g, 'fi').replace(/\ufb02/g, 'fl');
}

function applyHighlights(q) {
    if (q.skill !== 'Words in Context') return;
    const passageEl = document.getElementById('passageContent');
    const match = q.question.match(/"([^"]+)"/);
    if (!match) return;
    const word  = match[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // escape regex chars
    const regex = new RegExp(`(${word})`, 'gi');
    passageEl.innerHTML = passageEl.innerHTML.replace(
        regex, '<span class="highlight">$1</span>'
    );
}

function handleOptionClick(btn, selectedLetter, q) {
    if (isAnswered) return;
    isAnswered = true;

    const isCorrect = selectedLetter === q.answer;
    const feedbackContainer = document.getElementById('feedbackContainer');
    const feedbackTitle     = document.getElementById('feedbackTitle');
    const optionsContainer  = document.getElementById('optionsContainer');

    if (isCorrect) {
        btn.classList.add('correct');
        score++;
        document.getElementById('currentScore').textContent = score;
        feedbackTitle.textContent   = 'Correct!';
        feedbackContainer.className = 'feedback-section visible feedback-success';
    } else {
        btn.classList.add('incorrect');
        Array.from(optionsContainer.children).forEach(b => {
            if (b.innerText.trim().startsWith(q.answer + '.')) b.classList.add('correct');
        });
        feedbackTitle.textContent   = 'Not quite.';
        feedbackContainer.className = 'feedback-section visible feedback-error';
    }

    document.getElementById('feedbackText').innerText   = q.explanation;
    document.getElementById('strategyName').textContent = q.strategy || 'Standard POE';
    document.getElementById('trapName').textContent     = TRAP_SETS[q.skill] || q.trapName || '—';
}

// ── Progress helpers ──────────────────────────────────────────────
function resetProgress() {
    currentQuestionIndex = 0;
    score = 0;
    secondsElapsed = 0;
    document.getElementById('currentScore').textContent     = '0';
    document.getElementById('questionCounter').textContent  =
        `Q 1 / ${activeQuestions.length}`;
    updateTimerDisplay();
}

// ── Timer ─────────────────────────────────────────────────────────
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

// ── Init ──────────────────────────────────────────────────────────
function init() {

    // 1. Wire ALL event listeners first — before any setup screen logic
    //    This guarantees listeners exist even if updateSetupUI has an issue.

    document.querySelectorAll('input[name="skill"], input[name="diff"]').forEach(el => {
        el.addEventListener('change', updateSetupUI);
    });

    document.getElementById('limitSelect').addEventListener('change', updateSetupUI);

    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => applyPreset(btn));
    });

    document.getElementById('startSessionBtn').addEventListener('click', () => {
        activeQuestions = buildActiveQuestions();
        if (activeQuestions.length === 0) return; // safety guard
        resetProgress();
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
            const pct = Math.round((score / activeQuestions.length) * 100);
            alert(`Session complete!\n\nScore: ${score} / ${activeQuestions.length} (${pct}%)`);
        }
    });

    // 2. Show setup screen after all listeners are attached
    showSetup();
}

init();
