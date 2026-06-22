// ─────────────────────────────────────────────────────────────────
// homework-run.js  —  Generic homework runner.
//
// Reads ?assignment=<id> from the URL, loads the matching entry from
// homework/assignments.js, and drives the whole launch → question →
// results flow. Replaces homework.js / homework-sec.js / homework-ii.js.
//
// Selection logic supports BOTH:
//   • curated `ids` arrays  (Transitions, I&I homework)
//   • `ruleWeights` per-rule quotas  (SEC homework)
// Within every pool, prioritizePool() orders wrong → unseen → mastered,
// so mastered items only re-appear if the bank is exhausted.
// ─────────────────────────────────────────────────────────────────

// ── Resolve the assignment from the URL ───────────────────────────
const _hwUrlParams = new URLSearchParams(location.search);
const _hwAssignmentId = _hwUrlParams.get('assignment');
const ASSIGN = hwGetAssignment(_hwAssignmentId);

if (!ASSIGN) {
    // Bad/missing id — punt back to the hub.
    location.replace('homework-hub.html');
    throw new Error('Unknown assignment id: ' + _hwAssignmentId);
}

// Bank & config derived from the assignment.
const HW_BANK       = HW_BANK_LOOKUP[ASSIGN.bank] ? HW_BANK_LOOKUP[ASSIGN.bank]() : [];
const HW_SECTIONS   = ASSIGN.sections || [];
const HW_SKILL_ABBR = ASSIGN.skillAbbr || {};
const HW_STORAGE    = ASSIGN.storageKey || ('hw_run_' + ASSIGN.id);
const HW_TOTAL_Q    = HW_SECTIONS.reduce((sum, s) => sum + (s.count || (s.ids && s.ids.length) || 0), 0);

// ── Mutable session state ─────────────────────────────────────────
let hwMode           = null;  // 'structured' | 'mixed'
let hwQuestions      = [];    // question objects, each with .sectionIdx
let hwIndex          = 0;
let hwAnswers        = {};    // { [questionIndex]: 'A'|'B'|'C'|'D' }
let visitedSections  = new Set();
let hwMissed         = [];
let hwReviewCount    = 0;

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
    let html = String(text).replace(/ﬁ/g, 'fi').replace(/ﬂ/g, 'fl');
    html = hwEsc(html);
    html = html.replace(/&lt;u&gt;/g, '<u>').replace(/&lt;\/u&gt;/g, '</u>');
    // Highlight blank-completion slots when present (transitions, conventions, CoE-Textual).
    html = html.replace(/_{4,}/g,
        '<span style="background:#dbeafe;padding:0 2px;border-radius:3px;font-weight:700">______</span>');
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

// ── Pick questions for one section ────────────────────────────────
// Tier-aware fill. For each section:
//   (1) curated ids are drained first;
//   (2) ruleWeights draw N from each (skill, difficulty, ruleType) pool;
//   (3) same-difficulty backfill if still short;
//   (4) other-difficulty spillover as a last resort.
//
// Every pool is ordered by prioritizePool (wrong → unseen → mastered)
// so previously-missed questions are picked first.
function _pickSectionQuestions(sec, used, idMap) {
    const quota  = sec.count || (sec.ids && sec.ids.length) || 0;
    const picked = [];

    const drain = (pool, targetSize) => {
        const ordered = prioritizePool(pool.filter(q => !used.has(q.id)));
        for (const q of ordered) {
            if (picked.length >= targetSize) break;
            picked.push(q);
            used.add(q.id);
        }
    };

    if (sec.ids && sec.ids.length) {
        drain(sec.ids.map(id => idMap[id]).filter(Boolean), quota);
    }
    if (sec.ruleWeights) {
        for (const [rule, n] of Object.entries(sec.ruleWeights)) {
            const target = Math.min(picked.length + n, quota);
            const pool   = HW_BANK.filter(q =>
                q.skill === sec.skill &&
                q.difficulty === sec.difficulty &&
                q.ruleType === rule
            );
            drain(pool, target);
        }
    }
    if (picked.length < quota) {
        drain(HW_BANK.filter(q =>
            q.skill === sec.skill && q.difficulty === sec.difficulty
        ), quota);
    }
    if (picked.length < quota) {
        drain(HW_BANK.filter(q =>
            q.skill === sec.skill && q.difficulty !== sec.difficulty
        ), quota);
    }

    return picked;
}

function buildHwQuestions(mode) {
    const idMap   = Object.fromEntries(HW_BANK.map(q => [q.id, q]));
    const ledger  = getProgress();
    const used    = new Set();
    const list    = [];
    let   reviewN = 0;

    const tierOf = (q) => {
        const r = ledger[q.id];
        if (!r) return 'unseen';
        if (_isMastered(r)) return 'mastered';
        return 'wrong';
    };

    HW_SECTIONS.forEach((sec, si) => {
        const picked = _pickSectionQuestions(sec, used, idMap);
        picked.forEach(q => {
            if (tierOf(q) === 'wrong') reviewN++;
            list.push({ ...q, sectionIdx: si });
        });
    });

    hwReviewCount = reviewN;
    return mode === 'mixed' ? hwShuffle(list) : list;
}

// Launch-screen preview of the upcoming pool, showing the fresh / review /
// mastered breakdown so the student knows what kind of mix to expect.
function analyzeHwTiers() {
    const idMap  = Object.fromEntries(HW_BANK.map(q => [q.id, q]));
    const ledger = getProgress();
    const used   = new Set();
    let fresh = 0, review = 0, mastered = 0, total = 0;

    HW_SECTIONS.forEach(sec => {
        const picked = _pickSectionQuestions(sec, used, idMap);
        picked.forEach(q => {
            total++;
            const r = ledger[q.id];
            if (!r) fresh++;
            else if (_isMastered(r)) mastered++;
            else review++;
        });
    });

    return { fresh, review, mastered, total };
}

// ── Persistence ───────────────────────────────────────────────────
// 7-day TTL: closing the tab on Friday and reopening Monday still resumes,
// but stale week-old sessions are cleared.
const HW_RESUME_TTL_MS = 7 * 86_400_000;

function saveHwState() {
    const state = {
        mode:        hwMode,
        ids:         hwQuestions.map(q => q.id),
        sectionIdxs: hwQuestions.map(q => q.sectionIdx),
        answers:     hwAnswers,
        index:       hwIndex,
        visited:     [...visitedSections],
        timings:     hwTimer.getAll(),
        savedAt:     Date.now(),
    };
    try { localStorage.setItem(HW_STORAGE, JSON.stringify(state)); } catch(e) {}
}

function loadHwState() {
    try {
        const raw = localStorage.getItem(HW_STORAGE);
        if (!raw) return null;
        const s = JSON.parse(raw);
        if (Date.now() - s.savedAt > HW_RESUME_TTL_MS) { clearHwState(); return null; }
        return s;
    } catch(e) { return null; }
}

function clearHwState() { localStorage.removeItem(HW_STORAGE); }

function discardAndReset() {
    clearHwState();
    document.getElementById('resumeBanner').classList.add('hidden');
    renderLaunchInfo();
}

// ── Launch screen population ──────────────────────────────────────
function populateLaunch() {
    // Title bar
    document.title = ASSIGN.title + ' — SAT Mastery';
    document.getElementById('hwTitle').textContent    = ASSIGN.title;
    document.getElementById('hwSubtitle').textContent = ASSIGN.description || '';

    // Optional assignment note (e.g. "re-run for fresh questions")
    const noteEl = document.getElementById('hwNote');
    if (noteEl) {
        if (ASSIGN.note) { noteEl.textContent = ASSIGN.note; noteEl.classList.remove('hidden'); }
        else { noteEl.classList.add('hidden'); }
    }

    // Stats chips — total + each section's "N skill · diff"
    const statsEl = document.getElementById('hwStats');
    statsEl.innerHTML = '';
    const totalChip = document.createElement('span');
    totalChip.className = 'hw-stat';
    totalChip.textContent = `${HW_TOTAL_Q} questions`;
    statsEl.appendChild(totalChip);

    // Difficulty mix chip — aggregate counts by difficulty
    const diffMix = {};
    HW_SECTIONS.forEach(s => {
        const n = s.count || (s.ids && s.ids.length) || 0;
        diffMix[s.difficulty] = (diffMix[s.difficulty] || 0) + n;
    });
    const order = ['Easy', 'Medium', 'Hard'];
    const diffParts = order.filter(d => diffMix[d]).map(d => `${diffMix[d]} ${d}`);
    if (diffParts.length) {
        const diffChip = document.createElement('span');
        diffChip.className = 'hw-stat';
        diffChip.textContent = diffParts.join(' · ');
        statsEl.appendChild(diffChip);
    }

    // Mode sequence on the Structured card
    const seqEl = document.getElementById('modeSequence');
    seqEl.innerHTML = '';
    HW_SECTIONS.forEach((sec, i) => {
        const num = ['①','②','③','④','⑤','⑥','⑦','⑧'][i] || `(${i+1})`;
        const n = sec.count || (sec.ids && sec.ids.length) || 0;
        const abbr = HW_SKILL_ABBR[sec.skill] || sec.skill;
        const line = document.createElement('span');
        line.textContent = `${num} ${abbr} ${sec.difficulty} (${n})`;
        seqEl.appendChild(line);
    });
}

// ── Resume detection ──────────────────────────────────────────────
function checkResume() {
    try {
        const state = loadHwState();
        if (state && Array.isArray(state.ids)) {
            const idMap = Object.fromEntries(HW_BANK.map(q => [q.id, q]));
            const valid = state.ids.filter(id => idMap[id]).length;
            if (valid > 0) {
                const answered  = Object.keys(state.answers || {}).length;
                const remaining = valid - answered;
                document.getElementById('resumeInfo').textContent =
                    `Q${(state.index || 0) + 1}/${valid} · ${answered} answered · ${remaining} remaining`;
                document.getElementById('resumeBanner').classList.remove('hidden');
                if (state.mode) selectMode(state.mode);
                return;
            }
            clearHwState();
        }
    } catch(e) {
        clearHwState();
    }
    renderLaunchInfo();
}

function renderLaunchInfo() {
    const el = document.getElementById('launchInfo');
    if (!el) return;
    const { fresh, review, mastered, total } = analyzeHwTiers();
    if (!total || fresh === total) { el.classList.add('hidden'); return; }

    const parts = [];
    if (review > 0)   parts.push(`<b>${review}</b> review (missed before)`);
    if (mastered > 0) parts.push(`<b>${mastered}</b> already mastered`);
    if (fresh > 0)    parts.push(`<b>${fresh}</b> new`);
    el.innerHTML = parts.join(' · ');
    el.classList.remove('hidden');
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
        hwTimer.setAll(state.timings || {});
    } else {
        hwQuestions     = buildHwQuestions(hwMode);
        hwAnswers       = {};
        hwIndex         = 0;
        visitedSections = new Set();
        hwTimer.reset();
    }

    clearHwState();
    document.getElementById('launchScreen').style.display = 'none';
    document.getElementById('questionScreen').classList.remove('hidden');
    _pushHwScreen('question');
    hwInitResizable();
    hwInitKeyboard();

    if (hwMode === 'structured' && !resume && hwQuestions.length > 0) {
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
        'badge ' + (sec.difficulty === 'Hard'   ? 'badge-red' :
                    sec.difficulty === 'Medium' ? 'badge-orange' :
                                                  'badge-green');
    document.getElementById('secStrategy').textContent = sec.strategy || '';

    const overlay = document.getElementById('sectionTransition');
    overlay.classList.remove('hidden');

    document.getElementById('beginSectionBtn').onclick = () => {
        overlay.classList.add('hidden');
        visitedSections.add(sectionIdx);
        onBegin();
    };
}

// ── Render a question ─────────────────────────────────────────────
function renderQuestion(index) {
    hwTimer.init();
    hwTimer.stop();
    hwIndex = index;
    const q     = hwQuestions[index];
    const total = hwQuestions.length;

    const answered = Object.keys(hwAnswers).length;
    document.getElementById('progressBar').style.width =
        `${Math.round((answered / total) * 100)}%`;

    renderHwDots(index, total);
    document.getElementById('qCounter').textContent = `${index + 1} / ${total}`;

    const labelEl = document.getElementById('sectionLabel');
    if (hwMode === 'structured' && q.sectionIdx >= 0) {
        const sec = HW_SECTIONS[q.sectionIdx];
        labelEl.textContent = `Section ${q.sectionIdx + 1}: ${sec.skill} · ${sec.difficulty}`;
        labelEl.classList.remove('hidden');
    } else {
        labelEl.classList.add('hidden');
    }

    const passageEl = document.getElementById('hwPassage');
    passageEl.innerHTML = q.image
        ? `<img class="full-q-image" src="${hwEsc(q.image)}" alt="Question figure" loading="lazy">`
        : hwFormatPassage(q.passage, q.skill);

    // Words-in-Context: highlight the target word in the passage
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

    document.getElementById('hwSkillBadge').textContent = HW_SKILL_ABBR[q.skill] || q.skill;
    const diffBadge = document.getElementById('hwDiffBadge');
    diffBadge.textContent = q.difficulty;
    diffBadge.className   = 'badge ' + (q.difficulty === 'Hard'   ? 'badge-red' :
                                        q.difficulty === 'Medium' ? 'badge-orange' :
                                                                    'badge-green');

    document.getElementById('hwQuestion').textContent = q.question;

    const optEl = document.getElementById('hwOptions');
    optEl.innerHTML = '';
    // Snapshot questions may carry the choices inside the image; fall back to
    // bare A–D buttons when no option text is provided.
    const hwOpts = (q.options && q.options.length) ? q.options : ['A', 'B', 'C', 'D'];
    hwOpts.forEach(opt => {
        const letter = opt.trim()[0];
        const btn    = document.createElement('button');
        btn.className = 'option-btn' + (hwAnswers[index] === letter ? ' hw-selected' : '');
        btn.innerHTML = `<span>${hwEsc(opt)}</span>`;
        btn.addEventListener('click', () => hwSelectOption(index, letter));
        optEl.appendChild(btn);
    });

    const isLast  = (index === total - 1);
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const subBtn  = document.getElementById('submitBtn');
    prevBtn.disabled = (index === 0);
    nextBtn.classList.toggle('hidden', isLast);
    subBtn.classList.toggle('hidden', !isLast);

    saveHwState();
    hwTimer.start(index);
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

    document.querySelectorAll('#hwOptions .option-btn').forEach(btn => {
        // Read the letter from the button text so this works for both
        // text options ("A. …") and bare-letter snapshot options ("A").
        const optLetter = (btn.textContent || '').trim()[0];
        btn.classList.toggle('hw-selected', optLetter === letter);
    });

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
    hwTimer.stop();
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
    _pushHwScreen('results');

    // Record answers into the shared progress ledger + trap analytics
    hwQuestions.forEach((q, i) => {
        if (hwAnswers[i] !== undefined) {
            const ok = hwAnswers[i] === q.answer;
            recordAnswer(q.id, ok, 'homework');
            if (typeof recordTrapOutcome === 'function') recordTrapOutcome(q.skill, q.trapName, ok);
        }
    });
    hwMissed = hwQuestions.filter((q, i) => hwAnswers[i] !== q.answer);

    // Log this session to shared history so it shows up on the Progress
    // page alongside Practice sessions.
    _logHwSession();

    const total   = hwQuestions.length;
    let   correct = 0;
    hwQuestions.forEach((q, i) => { if (hwAnswers[i] === q.answer) correct++; });

    const pct    = total > 0 ? Math.round((correct / total) * 100) : 0;
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

    // Session-stats banner
    const timings   = hwTimer.getAll();
    const totalSecs = hwTimer.totalSeconds();
    const avgSecs   = total > 0 ? Math.round(totalSecs / total) : 0;
    const blurs     = (typeof getBlurCount === 'function') ? getBlurCount() : 0;
    const fmtSecs   = s => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;
    const blurNote  = blurs > 0
        ? ` &middot; <span style="color:#b45309;font-weight:700">${blurs} tab-switch${blurs!==1?'es':''}</span>`
        : '';
    const oldStats = document.getElementById('sessionStats');
    if (oldStats) oldStats.remove();
    const statsDiv = document.createElement('div');
    statsDiv.id = 'sessionStats';
    statsDiv.style.cssText = 'background:#f8fafc;border:1px solid #e2e8f0;border-radius:0.6rem;padding:0.6rem 0.85rem;margin-bottom:1rem;font-size:0.83rem;color:#475569;line-height:1.5';
    statsDiv.innerHTML = `Total time: <b>${fmtSecs(totalSecs)}</b> &middot; Avg per question: <b>${fmtSecs(avgSecs)}</b>${blurNote}`;
    const breakdownEl = document.getElementById('rBreakdown');
    breakdownEl.parentNode.insertBefore(statsDiv, breakdownEl);

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
            const secs      = timings[i] || 0;
            const tColor    = secs > 100 ? '#dc2626' : secs > 80 ? '#b45309' : '#64748b';
            const tBadge    = `<span style="font-variant-numeric:tabular-nums;font-size:0.74rem;color:${tColor};font-weight:700;margin-left:0.1rem;flex-shrink:0">${fmtSecs(secs)}</span>`;

            const rOpts = (q.options && q.options.length) ? q.options : ['A', 'B', 'C', 'D'];
            const optionsHtml = rOpts.map(opt => {
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

            // Show the snapshot in review so image-based items stay reviewable.
            const imgHtml = q.image
                ? `<img class="full-q-image" src="${hwEsc(q.image)}" alt="Question figure" loading="lazy" style="margin:0 0 0.75rem">` : '';

            return `
            <details class="rq-item ${isCorrect ? 'rq-correct' : 'rq-wrong'}" ${isCorrect ? '' : 'open'}>
              <summary class="rq-summary">
                <span class="rq-num">Q${i + 1}</span>
                ${tBadge}
                <span class="rq-icon">${isCorrect ? '✓' : '✗'}</span>
                <span class="rq-q">${hwEsc(shortQ)}</span>
              </summary>
              <div class="rq-body">
                ${imgHtml}
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

// ── Session history logging ───────────────────────────────────────
// Writes a record to the same `wayne_sat_history` key that Practice
// (app.js) uses, in the same shape so the existing renderers (and our
// new progress.html) can show Practice + Homework rows side-by-side.
// Adds `source`/`assignmentId`/`assignmentTitle` so the progress page
// can label and filter homework rows. Capped at 100 records.
const HW_HISTORY_KEY = 'wayne_sat_history';
const HW_HISTORY_CAP = 100;

function _logHwSession() {
    const total   = hwQuestions.length;
    if (total === 0) return;

    let correct = 0;
    const skillStats = {};
    hwQuestions.forEach((q, i) => {
        const isRight = hwAnswers[i] === q.answer;
        if (isRight) correct++;
        if (!skillStats[q.skill]) skillStats[q.skill] = { correct: 0, total: 0 };
        skillStats[q.skill].total++;
        if (isRight) skillStats[q.skill].correct++;
    });

    const duration = hwTimer.totalSeconds();
    const avgSecs  = total > 0 ? Math.round(duration / total) : 0;

    const skills = [...new Set(hwQuestions.map(q => q.skill))];
    const diffs  = [...new Set(hwQuestions.map(q => q.difficulty))];

    const timings   = hwTimer.getAll();
    const blurCount = (typeof getBlurCount === 'function') ? getBlurCount() : 0;
    // Per-question diagnostics for the tutor (upload only — not stored locally).
    const questions = hwQuestions.map((q, i) => ({
        id:         q.id,
        skill:      q.skill,
        difficulty: q.difficulty,
        chosen:     hwAnswers[i] || '',
        correct:    q.answer,
        isCorrect:  hwAnswers[i] === q.answer,
        secs:       timings[i] || 0,
        trap:       q.trapName || '',
    }));

    const record = {
        date:            new Date().toISOString(),
        skills, diffs,
        score:           correct,
        total,
        pct:             Math.round((correct / total) * 100),
        duration,
        avgSecs,
        skillStats,
        blurCount,
        source:          'homework',
        assignmentId:    ASSIGN.id,
        assignmentTitle: ASSIGN.title,
        mode:            hwMode || 'mixed',
    };

    let history = [];
    try { history = JSON.parse(localStorage.getItem(HW_HISTORY_KEY)) || []; } catch (e) {}
    history.unshift(record);
    if (history.length > HW_HISTORY_CAP) history = history.slice(0, HW_HISTORY_CAP);
    try { localStorage.setItem(HW_HISTORY_KEY, JSON.stringify(history)); } catch (e) {}

    // Fire-and-forget upload to the tutor's Google Sheet — per-question detail
    // is included in the upload only, not the capped local history.
    if (typeof syncSessionToSheet === 'function') syncSessionToSheet({ ...record, questions });
}

// ── Retry missed questions ────────────────────────────────────────
function hwRetryMissed() {
    hwTimer.reset();
    hwQuestions     = hwMissed.slice();
    hwAnswers       = {};
    hwIndex         = 0;
    visitedSections = new Set();
    hwMode          = 'mixed';
    clearHwState();

    document.getElementById('resultsScreen').classList.add('hidden');
    document.getElementById('questionScreen').classList.remove('hidden');
    _pushHwScreen('question');
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
            const target = [...btns].find(b => b.textContent.trim()[0] === map[key]);
            if (target) target.click();
        }
    });
}

// ── Browser-history integration ──────────────────────────────────
function _pushHwScreen(name) {
    if (history.state && history.state.hwScreen === name) return;
    history.pushState({ hwScreen: name }, '');
}

function _showHwScreenOnly(name) {
    const launch  = document.getElementById('launchScreen');
    const quest   = document.getElementById('questionScreen');
    const results = document.getElementById('resultsScreen');
    if (name === 'question') {
        launch.style.display = 'none';
        quest.classList.remove('hidden');
        results.classList.add('hidden');
    } else if (name === 'results') {
        launch.style.display = 'none';
        quest.classList.add('hidden');
        results.classList.remove('hidden');
    } else {
        launch.style.display = '';
        quest.classList.add('hidden');
        results.classList.add('hidden');
    }
}

window.addEventListener('popstate', e => {
    _showHwScreenOnly(e.state && e.state.hwScreen ? e.state.hwScreen : 'launch');
});

// ── Init ──────────────────────────────────────────────────────────
populateLaunch();
checkResume();
