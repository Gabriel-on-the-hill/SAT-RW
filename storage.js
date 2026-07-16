// ══════════════════════════════════════════════════════════════════
// STORAGE  —  keys, safe localStorage helpers, session resume,
//             export / import, and full-backup resilience
// ══════════════════════════════════════════════════════════════════
// Loaded before timer.js / history.js / app.js. All cross-file globals
// (activeQuestions, score, questionBank, etc.) are referenced only inside
// function bodies, so they resolve at call time once app.js has evaluated.

// Per-student storage: history, in-progress session, and backups are scoped to
// whoever is signed in (gate.js stores the name in sessionStorage 'mastery_user'),
// so several students can share one device/browser without their data mixing.
// Computed getters mean every existing STORAGE.HISTORY/SESSION/BACKUP call site
// resolves to the current student's key with no other changes needed.
//
// Migration: the app previously used un-suffixed keys (e.g. 'satrw_sat_history').
// The first time a signed-in student's namespaced key is read and found empty,
// any legacy value is copied across (non-destructively) so existing progress
// carries over instead of disappearing.
var _satMigrated = {};
function _migrateLegacy(user) {
    if (_satMigrated[user]) return;
    _satMigrated[user] = true;
    try {
        var pairs = [
            ['satrw_sat_history',     'satrw_sat_history_' + user],
            ['satrw_sat_session',     'satrw_sat_session_' + user],
            ['satrw_sat_last_backup', 'satrw_sat_backup_'  + user],
        ];
        for (var i = 0; i < pairs.length; i++) {
            var legacy = localStorage.getItem(pairs[i][0]);
            if (legacy != null && localStorage.getItem(pairs[i][1]) == null) {
                localStorage.setItem(pairs[i][1], legacy);
            }
        }
    } catch (e) {}
}
function _storeUser() {
    var u;
    try { u = sessionStorage.getItem('mastery_user') || 'guest'; } catch (e) { u = 'guest'; }
    _migrateLegacy(u);
    return u;
}
const STORAGE = {
    get HISTORY() { return 'satrw_sat_history_' + _storeUser(); },
    get SESSION() { return 'satrw_sat_session_' + _storeUser(); },
    get BACKUP()  { return 'satrw_sat_backup_'  + _storeUser(); },
    SPLIT: 'satrw_sat_split',   // panel-size preference is cosmetic; shared is fine
};

// ── Safe wrappers (localStorage can throw: private mode, quota, etc.) ──
function safeGetJSON(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
}

function safeSet(key, value) {
    try { localStorage.setItem(key, value); return true; }
    catch (e) { return false; }
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
        timerMode,
        countdownTotal,
        countdownRemaining,
        savedAt:        Date.now(),
    };
    safeSet(STORAGE.SESSION, JSON.stringify(state));
}

function loadSessionState() {
    const state = safeGetJSON(STORAGE.SESSION, null);
    if (!state) return null;
    if (Date.now() - state.savedAt > 86_400_000) { clearSessionState(); return null; }
    return state;
}

function clearSessionState() {
    try { localStorage.removeItem(STORAGE.SESSION); } catch (e) {}
}

function restoreSession(state) {
    const idMap     = Object.fromEntries(questionBank.map(q => [q.id, q]));
    activeQuestions = state.questionIds.map(id => idMap[id]).filter(Boolean);
    if (activeQuestions.length === 0) { clearSessionState(); return false; }

    currentQuestionIndex = Math.min(state.index, activeQuestions.length - 1);
    score                = state.score          || 0;
    secondsElapsed       = state.secondsElapsed || 0;
    userMode             = state.mode           || 'assisted';
    timerMode            = state.timerMode      || 'off';
    countdownTotal       = state.countdownTotal || 0;
    countdownRemaining   = state.countdownRemaining != null
        ? state.countdownRemaining : countdownTotal;
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
// MODAL HELPERS  (shared dataModal)
// ══════════════════════════════════════════════════════════════════

function getDataModalEls() {
    // Drop any buttons/inputs a previous modal injected, so they don't linger.
    document.querySelectorAll('#dataModal .modal-extra').forEach(el => el.remove());
    return {
        modal:     document.getElementById('dataModal'),
        title:     document.getElementById('modalTitle'),
        desc:      document.getElementById('modalDesc'),
        textarea:  document.getElementById('modalTextarea'),
        actionBtn: document.getElementById('modalActionBtn'),
    };
}

// Trigger a client-side file download (no server needed).
function downloadJSONFile(filename, obj) {
    try {
        const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return true;
    } catch (e) { return false; }
}

function wireCopyButton(actionBtn, textarea) {
    actionBtn.textContent = 'Copy to Clipboard';
    actionBtn.onclick = () => {
        navigator.clipboard.writeText(textarea.value)
            .then(() => {
                actionBtn.textContent = 'Copied!';
                setTimeout(() => { actionBtn.textContent = 'Copy to Clipboard'; }, 2000);
            })
            .catch(() => { textarea.select(); document.execCommand('copy'); });
    };
}

// ══════════════════════════════════════════════════════════════════
// EXPORT / IMPORT  —  session history
// ══════════════════════════════════════════════════════════════════

function openExportModal() {
    const { modal, title, desc, textarea, actionBtn } = getDataModalEls();
    const data = { history: safeGetJSON(STORAGE.HISTORY, []) };
    title.textContent = 'Export Session Data';
    desc.textContent  = 'Copy this JSON to back up your history.';
    desc.style.color  = '';
    textarea.value    = JSON.stringify(data, null, 2);
    textarea.readOnly = true;
    wireCopyButton(actionBtn, textarea);
    modal.style.display = 'flex';
}

function openImportModal() {
    const { modal, title, desc, textarea, actionBtn } = getDataModalEls();
    title.textContent    = 'Import Session Data';
    desc.textContent     = 'Paste exported JSON here. New records will be merged with existing history.';
    desc.style.color     = '';
    textarea.value       = '';
    textarea.readOnly    = false;
    textarea.placeholder = 'Paste JSON here…';
    actionBtn.textContent = 'Import';
    actionBtn.onclick = () => {
        try {
            const incoming = JSON.parse(textarea.value);
            if (!incoming.history || !Array.isArray(incoming.history))
                throw new Error('Invalid format — expected { history: [...] }');
            mergeHistory(incoming.history);
            modal.style.display = 'none';
            renderHistory();
            renderLifetimeStats();
        } catch (e) {
            desc.textContent = 'Error: ' + e.message + '. Check your JSON and try again.';
            desc.style.color = 'var(--red, #e53e3e)';
        }
    };
    modal.style.display = 'flex';
}

// De-duplicate by date, newest first, cap at 50.
function mergeHistory(incoming) {
    const existing      = safeGetJSON(STORAGE.HISTORY, []);
    const existingDates = new Set(existing.map(r => r.date));
    const merged = [
        ...incoming.filter(r => !existingDates.has(r.date)),
        ...existing,
    ].sort((a, b) => new Date(b.date) - new Date(a.date));
    if (merged.length > 100) merged.splice(100);
    safeSet(STORAGE.HISTORY, JSON.stringify(merged));
}

// ══════════════════════════════════════════════════════════════════
// EXPORT / IMPORT  —  mastery progress (ledger)
// ══════════════════════════════════════════════════════════════════

function openExportProgressModal() {
    const { modal, title, desc, textarea, actionBtn } = getDataModalEls();
    title.textContent = 'Export Progress';
    desc.textContent  = 'Copy this JSON to back up mastery progress.';
    desc.style.color  = '';
    textarea.value    = JSON.stringify({ progress: getProgress() }, null, 2);
    textarea.readOnly = true;
    wireCopyButton(actionBtn, textarea);
    modal.style.display = 'flex';
}

function openImportProgressModal() {
    const { modal, title, desc, textarea, actionBtn } = getDataModalEls();
    title.textContent    = 'Import Progress';
    desc.textContent     = 'Paste exported progress JSON. Records will be merged with existing.';
    desc.style.color     = '';
    textarea.value       = '';
    textarea.readOnly    = false;
    textarea.placeholder = 'Paste JSON here…';
    actionBtn.textContent = 'Import';
    actionBtn.onclick = () => {
        try {
            const incoming = JSON.parse(textarea.value);
            if (!incoming.progress || typeof incoming.progress !== 'object')
                throw new Error('Invalid format — expected { progress: {...} }');
            mergeProgress(incoming.progress);
            modal.style.display = 'none';
            updateSetupUI();
        } catch (e) {
            desc.textContent = 'Error: ' + e.message;
            desc.style.color = 'var(--red, #e53e3e)';
        }
    };
    modal.style.display = 'flex';
}

// ══════════════════════════════════════════════════════════════════
// FULL BACKUP  —  one file that holds history + progress together,
//                 so neither half can be forgotten.
// ══════════════════════════════════════════════════════════════════

function buildFullBackup() {
    return {
        type:       'satrw-backup',
        version:    1,
        exportedAt: new Date().toISOString(),
        history:    safeGetJSON(STORAGE.HISTORY, []),
        progress:   (typeof getProgress === 'function') ? getProgress() : {},
        trapStats:  (typeof getTrapStats === 'function') ? getTrapStats() : {},
        // Retention is measured on spaced reviews only, so it accumulates slowly and
        // cannot be reconstructed from anything else in this file. Left out of the
        // backup, a device change would silently reset the one number that says
        // whether any of this stuck.
        retention:  (typeof getRetentionStats === 'function') ? getRetentionStats() : {},
    };
}

function markBackupDone() {
    const meta = { at: Date.now(), atCount: safeGetJSON(STORAGE.HISTORY, []).length };
    safeSet(STORAGE.BACKUP, JSON.stringify(meta));
    renderBackupReminder();
}

function openBackupAllModal() {
    const { modal, title, desc, textarea, actionBtn } = getDataModalEls();
    title.textContent = 'Back Up Everything';
    desc.textContent  = 'This bundles your session history AND mastery progress into one file. '
                      + 'Copy it somewhere safe (email it to yourself, or save a .txt). '
                      + 'Restore it any time, even on a new device.';
    desc.style.color  = '';
    textarea.value    = JSON.stringify(buildFullBackup(), null, 2);
    textarea.readOnly = true;
    actionBtn.textContent = 'Copy to Clipboard';
    actionBtn.onclick = () => {
        navigator.clipboard.writeText(textarea.value)
            .then(() => {
                actionBtn.textContent = 'Copied!';
                markBackupDone();
                setTimeout(() => { actionBtn.textContent = 'Copy to Clipboard'; }, 2000);
            })
            .catch(() => { textarea.select(); document.execCommand('copy'); markBackupDone(); });
    };

    // Download-as-file: the robust way to move data between devices.
    const dl = document.createElement('button');
    dl.className   = 'btn modal-extra';
    dl.textContent = '↓ Download .json';
    dl.onclick = () => {
        const name = `satrw-backup-${new Date().toISOString().slice(0, 10)}.json`;
        if (downloadJSONFile(name, buildFullBackup())) markBackupDone();
    };
    const actions = modal.querySelector('.modal-actions');
    if (actions) actions.insertBefore(dl, document.getElementById('modalCloseBtn'));

    modal.style.display = 'flex';
}

function openRestoreAllModal() {
    const { modal, title, desc, textarea, actionBtn } = getDataModalEls();
    title.textContent    = 'Restore From Backup';
    desc.textContent     = 'Load a backup file (or paste its JSON). History and progress are both merged with what you have now.';
    desc.style.color     = '';
    textarea.value       = '';
    textarea.readOnly    = false;
    textarea.placeholder = 'Paste backup JSON here, or use “Load file…”';
    actionBtn.textContent = 'Restore';

    // File picker → fills the textarea, then the student hits Restore.
    const fileInput = document.createElement('input');
    fileInput.type      = 'file';
    fileInput.accept    = '.json,application/json,text/plain';
    fileInput.className  = 'modal-extra';
    fileInput.style.display = 'none';
    fileInput.onchange = () => {
        const f = fileInput.files && fileInput.files[0];
        if (!f) return;
        const reader = new FileReader();
        reader.onload  = () => { textarea.value = reader.result; };
        reader.onerror = () => { desc.textContent = 'Could not read that file.'; desc.style.color = 'var(--red, #e53e3e)'; };
        reader.readAsText(f);
    };
    const loadBtn = document.createElement('button');
    loadBtn.className   = 'btn modal-extra';
    loadBtn.textContent = '↑ Load file…';
    loadBtn.onclick     = () => fileInput.click();
    const actions = modal.querySelector('.modal-actions');
    if (actions) actions.insertBefore(loadBtn, actionBtn);
    if (modal.querySelector('.modal-card')) modal.querySelector('.modal-card').appendChild(fileInput);
    actionBtn.onclick = () => {
        try {
            const incoming = JSON.parse(textarea.value);
            let restored = 0;
            if (Array.isArray(incoming.history)) { mergeHistory(incoming.history); restored++; }
            if (incoming.progress && typeof incoming.progress === 'object'
                && typeof mergeProgress === 'function') { mergeProgress(incoming.progress); restored++; }
            if (incoming.trapStats && typeof incoming.trapStats === 'object'
                && typeof mergeTrapStats === 'function') { mergeTrapStats(incoming.trapStats); }
            if (incoming.retention && typeof incoming.retention === 'object'
                && typeof mergeRetention === 'function') { mergeRetention(incoming.retention); }
            if (restored === 0)
                throw new Error('No history or progress found in this file.');
            modal.style.display = 'none';
            renderHistory();
            renderLifetimeStats();
            updateSetupUI();
            renderBackupReminder();
        } catch (e) {
            desc.textContent = 'Error: ' + e.message;
            desc.style.color = 'var(--red, #e53e3e)';
        }
    };
    modal.style.display = 'flex';
}

// Gentle nudge on the setup screen when un-backed-up work piles up.
const BACKUP_REMIND_AFTER = 5;   // new sessions since last full backup

function renderBackupReminder() {
    const el = document.getElementById('backupReminder');
    if (!el) return;
    const count = safeGetJSON(STORAGE.HISTORY, []).length;
    const meta  = safeGetJSON(STORAGE.BACKUP, null);
    const since = meta ? (count - (meta.atCount || 0)) : count;

    if (count >= 3 && since >= BACKUP_REMIND_AFTER) {
        const msg = meta
            ? `${since} sessions since your last backup.`
            : `You have ${count} sessions saved and haven't backed up yet.`;
        el.querySelector('.backup-reminder-text').textContent = msg;
        el.style.display = 'flex';
    } else {
        el.style.display = 'none';
    }
}
