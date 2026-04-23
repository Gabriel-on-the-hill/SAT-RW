// ─────────────────────────────────────────────────────────────────
// homework.js  —  Wayne's SAT Homework (Craft & Structure)
// ─────────────────────────────────────────────────────────────────

// ── Data ──────────────────────────────────────────────────────────
const HW_BANK = typeof questionBank_CS !== 'undefined' ? questionBank_CS : [];

const HW_SECTIONS = [
    {
        skill: 'Words in Context', difficulty: 'Hard', strategy: 'Two-Filter Method',
        ids: ['697dcd7e','2a6209ef','55c05ddf','0094f813','4531fbbf','16e2ce52','ecbd6424','e65f9b81','64af9749','7b434da9'],
    },
    {
        skill: 'Text Structure and Purpose', difficulty: 'Hard', strategy: 'Function Map',
        ids: ['cc76d23a','733d2605','9492c926','d60bc86d','fb16e2c2','493479db','8ece0047','3cd6524f','8a991dc8','19217740'],
    },
];

const HW_SKILL_ABBR = {
    'Words in Context':           'WiC',
    'Text Structure and Purpose': 'TSP',
};
const HW_STORAGE  = 'wayne_hw_state';
const QS_PER_SEC  = 10;

// ── State ─────────────────────────────────────────────────────────
let hwMode           = null;  // 'structured' | 'mixed'
let hwQuestions      = [];    // question objects, each with .sectionIdx
let hwIndex          = 0;     // current question index
let hwAnswers        = {};    // { [questionIndex]: 'A'|'B'|'C'|'D' }
let visitedSections  = new Set();
let hwMissed         = [];

// ── Helpers ───────────────────────────────────────────────────────
function hwShuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function hwEsc(s) {
    return String(s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function hwFormatPassage(text, skill) {
    if (!text) {
        return '<em style="color:var(--text-muted)">No passage — question is self-contained.</em>';
    }
    let html = String(text).replace(/\ufb01/g, 'fi').replace(/\ufb02/g, 'fl');
    html = hwEsc(html);
    if (skill === 'Transitions') {
        html = html.replace(/_{4,}/g,
            '<span style="background:#dbeafe;padding:0 2px;border-radius:3px;font-weight:700">______</span>');
    }
    return html;
}

// ── Mode selection (HTML onclick) ─────────────────────────────────
function selectMode(mode) {
    hwMode = mode;
    document.querySelectorAll('.hw-mode-card').forEach(c =>
        c.classList.toggle('selected', c.dataset.mode === mode)
    );
    document.getElementById('startBtn').disabled = false;
}

// ── Build question list ───────────────────────────────────────────
function buildHwQuestions(mode) {
    const list = [];
    HW_SECTIONS.forEach((sec, si) => {
        let pool;
        if (sec.ids && sec.ids.length) {
            const idMap = Object.fromEntries(HW_BANK.map(q => [q.id, q]));
            pool = sec.ids.map(id => idMap[id]).filter(Boolean);
        } else {
            const all = HW_BANK.filter(q => q.skill === sec.skill && q.difficulty === sec.difficulty);
            pool = prioritizePool(all).slice(0, QS_PER_SEC);
        }
        pool.forEach(q => list.push({ ...q, sectionIdx: si }));
    });
    return mode === 'mixed' ? hwShuffle(list) : list;
}

// ── Persistence ───────────────────────────────────────────────────
function saveHwState() {
    const state = {
        mode:        hwMode,
        ids:         hwQuestions.map(q => q.id),
        sectionIdxs: hwQuestions.map(q => q.sectionIdx),
        answers:     hwAnswers,
        index:       hwIndex,
        visited:     [...visitedSections],
        savedAt:     Date.now(),
    };
    try { localStorage.setItem(HW_STORAGE, JSON.stringify(state)); } catch(e) {}
}

function loadHwState() {
    try {
        const raw = localStorage.getItem(HW_STORAGE);
        if (!raw) return null;
        const s = JSON.parse(raw);
        if (Date.now() - s.savedAt > 86_400_000) { clearHwState(); return null; }
        return s;
    } catch(e) { return null; }
}

function clearHwState() { localStorage.removeItem(HW_STORAGE); }

function discardAndReset() {
    clearHwState();
    document.getElementById('resumeBanner').classList.add('hidden');
}

// ── Check for saved session on page load ──────────────────────────
function checkResume() {
    try {
        const state = loadHwState();
        if (!state || !Array.isArray(state.ids)) return;
        const idMap = Object.fromEntries(HW_BANK.map(q => [q.id, q]));
        const valid = state.ids.filter(id => idMap[id]).length;
        if (valid === 0) { clearHwState(); return; }

        const answered  = Object.keys(state.answers || {}).length;
        const remaining = valid - answered;
        document.getElementById('resumeInfo').textContent =
            `Q${(state.index || 0) + 1}/${valid} · ${answered} answered · ${remaining} remaining`;
        document.getElementById('resumeBanner').classList.remove('hidden');

        if (state.mode) selectMode(state.mode);
    } catch(e) {
        clearHwState();
    }
}

// ── Start / resume homework ───────────────────────────────────────
function startHomework(resume) {
    if (resume) {
        const state = loadHwState();
        if (!state) return;
        hwMode = state.mode;
        const idMap = Object.fromEntries(HW_BANK.map(q => [q.id, q]));
        hwQuestions = (state.ids || []).map((id, i) => {
            const q = idMap[id];
            return q ? { ...q, sectionIdx: (state.sectionIdxs || [])[i] ?? -1 } : null;
        }).filter(Boolean);
        hwAnswers       = state.answers || {};
        hwIndex         = state.index   || 0;
        visitedSections = new Set(state.visited || []);
    } else {
        hwQuestions     = buildHwQuestions(hwMode);
        hwAnswers       = {};
        hwIndex         = 0;
        visitedSections = new Set();
    }

    clearHwState();
    document.getElementById('launchScreen').style.display = 'none';
    document.getElementById('questionScreen').classList.remove('hidden');
    hwInitResizable();
    hwInitKeyboard();

    if (hwMode === 'structured' && !resume && hwQuestions.length > 0) {
        // Show first section transition before question 1
        showSectionTransition(0, () => renderQuestion(0));
    } else {
        renderQuestion(hwIndex);
    }
}

// ── Section transition overlay ────────────────────────────────────
function showSectionTransition(sectionIdx, onBegin) {
    const sec = HW_SECTIONS[sectionIdx];
    document.getElementById('secNum').textContent      = `Section ${sectionIdx + 1} of ${HW_SECTIONS.length}`;
    document.getElementById('secSkill').textContent    = sec.skill;
    document.getElementById('secDiff').textContent     = sec.difficulty;
    document.getElementById('secDiff').className       =
        'badge ' + (sec.difficulty === 'Hard' ? 'badge-red' : 'badge-orange');
    document.getElementById('secStrategy').textContent = sec.strategy;

    const overlay = document.getElementById('sectionTransition');
    overlay.classList.remove('hidden');

    document.getElementById('beginSectionBtn').onclick = () => {
        overlay.classList.add('hidden');
        visitedSections.add(sectionIdx);
        onBegin();
    };
}

// ── Render question ───────────────────────────────────────────────
function renderQuestion(index) {
    hwIndex = index;
    const q     = hwQuestions[index];
    const total = hwQuestions.length;

    // Progress bar (based on answered count)
    const answered = Object.keys(hwAnswers).length;
    document.getElementById('progressBar').style.width =
        `${Math.round((answered / total) * 100)}%`;

    // Dots + counter
    renderHwDots(index, total);
    document.getElementById('qCounter').textContent = `${index + 1} / ${total}`;

    // Section label (structured only)
    const labelEl = document.getElementById('sectionLabel');
    if (hwMode === 'structured' && q.sectionIdx >= 0) {
        const sec = HW_SECTIONS[q.sectionIdx];
        labelEl.textContent = `Section ${q.sectionIdx + 1}: ${sec.skill} · ${sec.difficulty}`;
        labelEl.classList.remove('hidden');
    } else {
        labelEl.classList.add('hidden');
    }

    // Passage
    const passageEl = document.getElementById('hwPassage');
    passageEl.innerHTML = hwFormatPassage(q.passage, q.skill);

    // WiC: highlight the target word in the passage
    if (q.skill === 'Words in Context') {
        const m = q.question.match(/"([^"]+)"/);
        if (m) {
            const escaped = m[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            passageEl.innerHTML = passageEl.innerHTML.replace(
                new RegExp(`(${escaped})`, 'gi'),
                '<span class="highlight">$1</span>'
            );
        }
    }

    // Badges
    document.getElementById('hwSkillBadge').textContent = HW_SKILL_ABBR[q.skill] || q.skill;
    const diffBadge = document.getElementById('hwDiffBadge');
    diffBadge.textContent = q.difficulty;
    diffBadge.className   = 'badge ' + (q.difficulty === 'Hard' ? 'badge-red' : 'badge-orange');

    // Question text
    document.getElementById('hwQuestion').textContent = q.question;

    // Options
    const optEl = document.getElementById('hwOptions');
    optEl.innerHTML = '';
    q.options.forEach(opt => {
        const letter = opt.trim()[0];
        const btn    = document.createElement('button');
        btn.className = 'option-btn' + (hwAnswers[index] === letter ? ' hw-selected' : '');
        btn.innerHTML = `<span>${hwEsc(opt)}</span>`;
        btn.addEventListener('click', () => hwSelectOption(index, letter));
        optEl.appendChild(btn);
    });

    // Nav buttons
    const isLast  = (index === total - 1);
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const subBtn  = document.getElementById('submitBtn');
    prevBtn.disabled = (index === 0);
    nextBtn.classList.toggle('hidden', isLast);
    subBtn.classList.toggle('hidden', !isLast);

    saveHwState();
}

function renderHwDots(current, total) {
    const container = document.getElementById('hwDots');
    container.innerHTML = '';
    hwQuestions.forEach((_, i) => {
        const dot = document.createElement('div');
        dot.className = 'hw-dot';
        if (hwAnswers[i] !== undefined) dot.classList.add('hw-dot-answered');
        if (i === current)              dot.classList.add('hw-dot-current');
        dot.title = `Q${i + 1}`;
        dot.addEventListener('click', () => hwGoTo(i));
        container.appendChild(dot);
    });
}

// ── Option selection ──────────────────────────────────────────────
function hwSelectOption(index, letter) {
    hwAnswers[index] = letter;

    // Refresh option buttons for the current question
    document.querySelectorAll('#hwOptions .option-btn').forEach((btn, i) => {
        const optLetter = (hwQuestions[index].options[i] || '').trim()[0];
        btn.classList.toggle('hw-selected', optLetter === letter);
    });

    // Update progress bar and dots
    const total    = hwQuestions.length;
    const answered = Object.keys(hwAnswers).length;
    document.getElementById('progressBar').style.width =
        `${Math.round((answered / total) * 100)}%`;
    renderHwDots(index, total);
    saveHwState();
}

// ── Navigation ────────────────────────────────────────────────────
function navigate(dir) {
    const next = hwIndex + dir;
    if (next < 0 || next >= hwQuestions.length) return;
    hwGoTo(next);
}

function hwGoTo(targetIdx) {
    if (hwMode === 'structured') {
        const targetSec = hwQuestions[targetIdx].sectionIdx;
        if (!visitedSections.has(targetSec)) {
            showSectionTransition(targetSec, () => renderQuestion(targetIdx));
            return;
        }
    }
    renderQuestion(targetIdx);
}

// ── Submit ────────────────────────────────────────────────────────
function confirmSubmit() {
    const total      = hwQuestions.length;
    const answered   = Object.keys(hwAnswers).length;
    const unanswered = total - answered;

    if (unanswered > 0) {
        const ok = confirm(
            `You have ${unanswered} unanswered question${unanswered !== 1 ? 's' : ''}.\nSubmit anyway?`
        );
        if (!ok) return;
    }

    clearHwState();
    showHwResults();
}

// ── Results ───────────────────────────────────────────────────────
function showHwResults() {
    document.getElementById('questionScreen').classList.add('hidden');
    document.getElementById('resultsScreen').classList.remove('hidden');

    // Record answers into the shared progress ledger before rendering results
    hwQuestions.forEach((q, i) => {
        if (hwAnswers[i] !== undefined) recordAnswer(q.id, hwAnswers[i] === q.answer, 'homework');
    });
    hwMissed = hwQuestions.filter((q, i) => hwAnswers[i] !== q.answer);

    const total   = hwQuestions.length;
    let   correct = 0;
    hwQuestions.forEach((q, i) => { if (hwAnswers[i] === q.answer) correct++; });

    const pct   = total > 0 ? Math.round((correct / total) * 100) : 0;
    const pctCls = pct >= 80 ? 'pct-pass' : pct >= 60 ? 'pct-warn' : 'pct-fail';

    document.getElementById('rBigScore').textContent = `${correct} / ${total}`;
    const pctEl = document.getElementById('rPct');
    pctEl.textContent = `${pct}%`;
    pctEl.className   = 'completion-pct ' + pctCls;

    // Per-section breakdown
    const stats = {};
    hwQuestions.forEach((q, i) => {
        const key = `${HW_SKILL_ABBR[q.skill] || q.skill} · ${q.difficulty}`;
        if (!stats[key]) stats[key] = { correct: 0, total: 0 };
        stats[key].total++;
        if (hwAnswers[i] === q.answer) stats[key].correct++;
    });

    document.getElementById('rBreakdown').innerHTML =
        Object.entries(stats).map(([label, s]) => {
            const p   = Math.round(s.correct / s.total * 100);
            const cls = p >= 80 ? 'bd-pass' : p >= 60 ? 'bd-warn' : 'bd-fail';
            const bar = Math.round(p / 5);
            return `
            <div class="breakdown-row">
              <span class="breakdown-skill">${label}</span>
              <span class="breakdown-bar">${'█'.repeat(bar)}${'░'.repeat(20 - bar)}</span>
              <span class="breakdown-score ${cls}">${s.correct}/${s.total} (${p}%)</span>
            </div>`;
        }).join('');

    // Per-question accordion — wrong answers open by default
    document.getElementById('rReview').innerHTML =
        hwQuestions.map((q, i) => {
            const selected  = hwAnswers[i];
            const isCorrect = selected === q.answer;
            const shortQ    = q.question.length > 90
                ? q.question.slice(0, 90) + '…'
                : q.question;

            // All four options with correct/wrong markers
            const optionsHtml = q.options.map(opt => {
                const letter   = opt.trim()[0];
                const isRight  = letter === q.answer;
                const isChosen = letter === selected;
                let cls = 'rq-opt';
                let marker = '';
                if (isRight)              { cls += ' rq-opt-correct'; marker = ' ✓'; }
                if (isChosen && !isRight) { cls += ' rq-opt-wrong';   marker = ' ✗'; }
                return `<div class="${cls}">${hwEsc(opt)}${marker}</div>`;
            }).join('');

            const skippedLine = !selected
                ? `<div class="rq-wrong-ans" style="margin-bottom:0.6rem">— Not answered</div>` : '';

            return `
            <details class="rq-item ${isCorrect ? 'rq-correct' : 'rq-wrong'}" ${isCorrect ? '' : 'open'}>
              <summary class="rq-summary">
                <span class="rq-num">Q${i + 1}</span>
                <span class="rq-icon">${isCorrect ? '✓' : '✗'}</span>
                <span class="rq-q">${hwEsc(shortQ)}</span>
              </summary>
              <div class="rq-body">
                <div style="font-size:0.85rem;font-weight:600;line-height:1.5;margin-bottom:0.75rem;color:var(--text)">${hwEsc(q.question)}</div>
                ${skippedLine}
                <div style="display:flex;flex-direction:column;gap:0.3rem;margin-bottom:0.75rem">${optionsHtml}</div>
                <div class="rq-explanation">${hwEsc(q.explanation)}</div>
              </div>
            </details>`;
        }).join('');

    const retryBtn = document.getElementById('hwRetryBtn');
    if (retryBtn) {
        if (hwMissed.length > 0) {
            retryBtn.textContent  = `Retry ${hwMissed.length} Missed`;
            retryBtn.style.display = '';
        } else {
            retryBtn.style.display = 'none';
        }
    }
}

// ── Retry missed questions ────────────────────────────────────────
function hwRetryMissed() {
    hwQuestions     = hwMissed.slice();
    hwAnswers       = {};
    hwIndex         = 0;
    visitedSections = new Set();
    hwMode          = 'mixed';
    clearHwState();

    document.getElementById('resultsScreen').classList.add('hidden');
    document.getElementById('questionScreen').classList.remove('hidden');
    renderQuestion(0);
}

// ── Resizable panels ──────────────────────────────────────────────
function hwInitResizable() {
    const handle     = document.querySelector('#questionScreen .resize-handle');
    const leftPanel  = document.querySelector('#questionScreen .passage-panel');
    const rightPanel = document.querySelector('#questionScreen .question-panel');
    const container  = document.querySelector('#questionScreen .main-content');
    if (!handle || !leftPanel || !rightPanel) return;

    let dragging = false, startX = 0, startWidth = 0;

    handle.addEventListener('mousedown', e => {
        dragging   = true;
        startX     = e.clientX;
        startWidth = leftPanel.getBoundingClientRect().width;
        document.body.style.cursor     = 'col-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
    });

    document.addEventListener('mousemove', e => {
        if (!dragging) return;
        const cw   = container.getBoundingClientRect().width - handle.offsetWidth;
        const newW = Math.max(220, Math.min(cw - 220, startWidth + (e.clientX - startX)));
        leftPanel.style.flex  = 'none';
        leftPanel.style.width = newW + 'px';
        rightPanel.style.flex = '1';
    });

    document.addEventListener('mouseup', () => {
        if (!dragging) return;
        dragging                       = false;
        document.body.style.cursor     = '';
        document.body.style.userSelect = '';
    });

    handle.addEventListener('dblclick', () => {
        leftPanel.style.flex  = '1';
        leftPanel.style.width = '';
        rightPanel.style.flex = '1';
    });
}

// ── Keyboard shortcuts ────────────────────────────────────────────
function hwInitKeyboard() {
    document.addEventListener('keydown', e => {
        if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
        if (document.getElementById('questionScreen').classList.contains('hidden')) return;
        if (!document.getElementById('sectionTransition').classList.contains('hidden')) return;

        const key = e.key.toUpperCase();

        if (key === 'ARROWLEFT')  { e.preventDefault(); navigate(-1); return; }
        if (key === 'ARROWRIGHT') { e.preventDefault(); navigate(1);  return; }

        if (key === 'ENTER' || key === ' ') {
            e.preventDefault();
            if (hwIndex === hwQuestions.length - 1) confirmSubmit();
            else navigate(1);
            return;
        }

        const map = { A:'A', B:'B', C:'C', D:'D', '1':'A', '2':'B', '3':'C', '4':'D' };
        if (map[key]) {
            e.preventDefault();
            const btns   = document.querySelectorAll('#hwOptions .option-btn');
            const target = [...btns].find(b => b.textContent.trim().startsWith(map[key] + '.'));
            if (target) target.click();
        }
    });
}

// ── Init ──────────────────────────────────────────────────────────
checkResume();
