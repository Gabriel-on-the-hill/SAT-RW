// ── Question bank (combined from domain files) ────────────────────
const questionBank = [
    ...(typeof questionBank_CS  !== 'undefined' ? questionBank_CS  : []),
    ...(typeof questionBank_EOI !== 'undefined' ? questionBank_EOI : []),
    ...(typeof questionBank_II  !== 'undefined' ? questionBank_II  : []),
    ...(typeof questionBank_CON !== 'undefined' ? questionBank_CON : []),
];

// ── Constants ─────────────────────────────────────────────────────
// TODO: update EXAM_DATE to Wayne's actual SAT test date
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

const STORAGE = {
    HISTORY: 'wayne_sat_history',
    SESSION: 'wayne_sat_session',
    SPLIT:   'wayne_sat_split',
};

// ── State ─────────────────────────────────────────────────────────
let currentQuestionIndex = 0;
let score                = 0;
let userMode             = 'assisted';
let timerInterval        = null;
let secondsElapsed       = 0;
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
    const diff = EXAM_DATE - new Date();
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

function buildActiveQuestions() {
    const skills = getSelectedSkills();
    const diffs  = getSelectedDiffs();
    const limit  = getLimit();

    let filtered = questionBank.filter(
        q => skills.includes(q.skill) && diffs.includes(q.difficulty)
    );

    // Fisher-Yates shuffle
    for (let i = filtered.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [filtered[i], filtered[j]] = [filtered[j], filtered[i]];
    }

    return limit > 0 ? filtered.slice(0, limit) : filtered;
}

function updateSetupUI() {
    const diffs = getSelectedDiffs();

    Object.entries(SKILL_COUNT_IDS).forEach(([skill, id]) => {
        const el = document.getElementById(id);
        if (!el) return;
        const n = questionBank.filter(
            q => q.skill === skill && diffs.includes(q.difficulty)
        ).length;
        el.textContent = n + ' q';
    });

    const total     = buildActiveQuestions().length;
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
    document.getElementById('setupScreen').style.display      = 'flex';
    document.getElementById('app').style.display              = 'none';
    document.getElementById('completionScreen').style.display = 'none';
    updateSetupUI();
    updateExamCountdown();
    renderHistory();
    renderLifetimeStats();
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
            const wrongOpt  = q.options.find(o => o.startsWith(selected + '.')) || '';
            const rightOpt  = q.options.find(o => o.startsWith(q.answer + '.'))  || '';
            const wrongText = wrongOpt.slice(3).trim();
            const rightText = rightOpt.slice(3).trim();
            const diffCls   = q.difficulty === 'Easy' ? 'badge-green'
                            : q.difficulty === 'Hard' ? 'badge-red' : 'badge-orange';
            return `
            <div class="missed-item">
                <div class="missed-meta">
                    <span class="badge ${diffCls}" style="font-size:0.65rem">${q.difficulty}</span>
                    <span class="missed-skill">${SKILL_ABBR[q.skill] || q.skill}</span>
                </div>
                <div class="missed-q">${escapeHtml(shortQ)}</div>
                <div class="missed-answers">
                    <span class="missed-wrong">✗ ${escapeHtml(wrongText)}</span>
                    <span class="missed-right">✓ ${escapeHtml(rightText)}</span>
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
            const t1 = escapeHtml(html.slice(0, t2idx).trim());
            const t2 = escapeHtml(html.slice(t2idx).trim());
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

    return escapeHtml(html);
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

    document.getElementById('passageContent').innerHTML = formatPassage(q.passage, q.skill);

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

    // Build option buttons
    q.options.forEach(opt => {
        const btn     = document.createElement('button');
        btn.className = 'option-btn';
        const letter  = opt.trim()[0];
        const text    = opt.trim().slice(2).trim();
        btn.innerHTML = `<span class="opt-letter">${escapeHtml(letter)}.</span><span>${escapeHtml(text)}</span>`;
        btn.addEventListener('click', () => handleOptionClick(btn, letter, q));
        optionsContainer.appendChild(btn);
    });
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
    const feedbackContainer = document.getElementById('feedbackContainer');
    const feedbackTitle     = document.getElementById('feedbackTitle');
    const optionsContainer  = document.getElementById('optionsContainer');

    sessionResults.push({ q, selected: selectedLetter, correct: q.answer, isCorrect, secs });
    if (!isCorrect) missedQuestions.push({ q, selected: selectedLetter });

    if (isCorrect) {
        btn.classList.add('correct');
        score++;
        document.getElementById('currentScore').textContent = score;
        feedbackTitle.textContent   = 'Correct!';
        feedbackContainer.className = 'feedback-section visible feedback-success';
    } else {
        btn.classList.add('incorrect');
        Array.from(optionsContainer.children).forEach(b => {
            const ltr = b.querySelector('.opt-letter');
            if (ltr && ltr.textContent.trim() === q.answer + '.') b.classList.add('correct');
        });
        feedbackTitle.textContent   = 'Not quite.';
        feedbackContainer.className = 'feedback-section visible feedback-error';
    }

    document.getElementById('feedbackText').innerText   = q.explanation;
    document.getElementById('strategyName').textContent = q.strategy || 'Standard POE';
    document.getElementById('trapName').textContent     =
        TRAP_SETS[q.skill] || q.trapName || '—';

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
        if (Date.now() - state.savedAt > 86_400_000) { clearSessionState(); return null; }
        return state;
    } catch(e) { return null; }
}

function clearSessionState() {
    localStorage.removeItem(STORAGE.SESSION);
}

function restoreSession(state) {
    const idMap     = Object.fromEntries(questionBank.map(q => [q.id, q]));
    activeQuestions = state.questionIds.map(id => idMap[id]).filter(Boolean);
    if (activeQuestions.length === 0) { clearSessionState(); return false; }

    currentQuestionIndex = Math.min(state.index, activeQuestions.length - 1);
    score                = state.score          || 0;
    secondsElapsed       = state.secondsElapsed || 0;
    userMode             = state.mode           || 'assisted';
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
        `Saved session — Q${answered + 1}/${valid} · ${state.score} correct so far · ${remaining} remaining`;
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

    const record = {
        date: new Date().toISOString(),
        skills, diffs,
        score:  sessionScore,
        total,
        pct:    Math.round((sessionScore / total) * 100),
        duration,
        avgSecs,
        skillStats,
    };
    let history = [];
    try { history = JSON.parse(localStorage.getItem(STORAGE.HISTORY)) || []; } catch(e) {}
    history.unshift(record);
    if (history.length > 50) history = history.slice(0, 50);
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

// ══════════════════════════════════════════════════════════════════
// LIFETIME SKILL STATS
// ══════════════════════════════════════════════════════════════════

function renderLifetimeStats() {
    const section   = document.getElementById('lifetimeSection');
    const container = document.getElementById('lifetimeStats');
    if (!section || !container) return;

    let history = [];
    try { history = JSON.parse(localStorage.getItem(STORAGE.HISTORY)) || []; } catch(e) {}

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

// ══════════════════════════════════════════════════════════════════
// EXPORT / IMPORT
// ══════════════════════════════════════════════════════════════════

function openExportModal() {
    const modal     = document.getElementById('dataModal');
    const title     = document.getElementById('modalTitle');
    const desc      = document.getElementById('modalDesc');
    const textarea  = document.getElementById('modalTextarea');
    const actionBtn = document.getElementById('modalActionBtn');

    const data = { history: JSON.parse(localStorage.getItem(STORAGE.HISTORY) || '[]') };
    title.textContent     = 'Export Session Data';
    desc.textContent      = 'Copy this JSON to back up your history.';
    textarea.value        = JSON.stringify(data, null, 2);
    textarea.readOnly     = true;
    actionBtn.textContent = 'Copy to Clipboard';
    actionBtn.onclick     = () => {
        navigator.clipboard.writeText(textarea.value)
            .then(() => {
                actionBtn.textContent = 'Copied!';
                setTimeout(() => { actionBtn.textContent = 'Copy to Clipboard'; }, 2000);
            })
            .catch(() => { textarea.select(); document.execCommand('copy'); });
    };
    modal.style.display = 'flex';
}

function openImportModal() {
    const modal     = document.getElementById('dataModal');
    const title     = document.getElementById('modalTitle');
    const desc      = document.getElementById('modalDesc');
    const textarea  = document.getElementById('modalTextarea');
    const actionBtn = document.getElementById('modalActionBtn');

    title.textContent      = 'Import Session Data';
    desc.textContent       = 'Paste exported JSON here. New records will be merged with existing history.';
    desc.style.color       = '';
    textarea.value         = '';
    textarea.readOnly      = false;
    textarea.placeholder   = 'Paste JSON here…';
    actionBtn.textContent  = 'Import';
    actionBtn.onclick      = () => {
        try {
            const incoming = JSON.parse(textarea.value);
            if (!incoming.history || !Array.isArray(incoming.history))
                throw new Error('Invalid format — expected { history: [...] }');

            let existing = [];
            try { existing = JSON.parse(localStorage.getItem(STORAGE.HISTORY)) || []; } catch(e) {}

            const existingDates = new Set(existing.map(r => r.date));
            const merged = [
                ...incoming.history.filter(r => !existingDates.has(r.date)),
                ...existing,
            ].sort((a, b) => new Date(b.date) - new Date(a.date));
            if (merged.length > 50) merged.splice(50);

            localStorage.setItem(STORAGE.HISTORY, JSON.stringify(merged));
            modal.style.display = 'none';
            renderHistory();
            renderLifetimeStats();
        } catch(e) {
            desc.textContent = 'Error: ' + e.message + '. Check your JSON and try again.';
            desc.style.color = 'var(--red, #e53e3e)';
        }
    };
    modal.style.display = 'flex';
}

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
// INIT
// ══════════════════════════════════════════════════════════════════

function init() {
    updateExamCountdown();

    document.querySelectorAll('input[name="skill"], input[name="diff"]')
        .forEach(el => el.addEventListener('change', updateSetupUI));
    document.getElementById('limitSelect').addEventListener('change', updateSetupUI);

    document.querySelectorAll('.preset-btn')
        .forEach(btn => btn.addEventListener('click', () => applyPreset(btn)));

    document.getElementById('startSessionBtn').addEventListener('click', () => {
        activeQuestions = buildActiveQuestions();
        if (activeQuestions.length === 0) return;
        reviewMode      = false;
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

    document.getElementById('reviewMissedBtn').addEventListener('click', startReviewMissed);
    document.getElementById('newSessionBtn').addEventListener('click', () => {
        reviewMode = false;
        showSetup();
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

    const exportBtn = document.getElementById('exportBtn');
    const importBtn = document.getElementById('importBtn');
    if (exportBtn) exportBtn.addEventListener('click', openExportModal);
    if (importBtn) importBtn.addEventListener('click', openImportModal);

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
    checkForSavedSession();
}

init();
