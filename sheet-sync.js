// ─────────────────────────────────────────────────────────────────
// sheet-sync.js — fire-and-forget upload of every completed session
// to the tutor-owned Google Sheet (via Apps Script Web App).
//
// Behaviour:
//   • Never blocks the UI. The student doesn't wait for the network.
//   • Local history (wayne_sat_history) keeps working regardless.
//   • Failures are logged to console only — no user-visible error.
//   • Includes the student's name from the gate (sessionStorage.mastery_user).
//
// To rotate the endpoint or disable sync, edit the URL below.
// Set ENDPOINT = '' to disable upload entirely.
// ─────────────────────────────────────────────────────────────────

const SHEET_SYNC_ENDPOINT =
    'https://script.google.com/macros/s/AKfycbzR0dumI5CEeyhDmsH_Yx57wHO7hK4xA953a4SMWxt9_CI3cw66Vs9ppa2DxkUPO2Bj/exec';

// If your Apps Script has SHARED_SECRET set, put the same string here.
const SHEET_SYNC_SECRET = '';

function syncSessionToSheet(record) {
    if (!SHEET_SYNC_ENDPOINT) return;
    if (!record) return;

    let student = '';
    try { student = sessionStorage.getItem('mastery_user') || ''; }
    catch (e) {}

    const payload = {
        date:            record.date || new Date().toISOString(),
        student,
        // Idempotency key. The Apps Script skips a Session ID it has already
        // stored, so a re-POST is harmless, and the per-question rows in the
        // Questions tab join back to this session on it.
        sessionId:       record.sessionId || '',
        type:            record.source || 'practice',
        assignmentId:    record.assignmentId    || '',
        assignmentTitle: record.assignmentTitle || '',
        score:           record.score ?? '',
        total:           record.total ?? '',
        pct:             record.pct   ?? '',
        skills:          Array.isArray(record.skills) ? record.skills : [],
        diffs:           Array.isArray(record.diffs)  ? record.diffs  : [],
        mode:            record.mode || '',
        duration:        record.duration ?? '',
        avgSecs:         record.avgSecs  ?? '',
        skillStats:      record.skillStats || {},
        // Integrity signal: tab-switches / focus-losses during the session.
        blurCount:       record.blurCount ?? '',
        // Per-question diagnostics: [{id,skill,difficulty,chosen,correct,isCorrect,secs,trap}]
        questions:       Array.isArray(record.questions) ? record.questions : [],
    };
    if (SHEET_SYNC_SECRET) payload.secret = SHEET_SYNC_SECRET;

    // Apps Script /exec redirects to googleusercontent.com and CORS headers
    // don't reliably survive that hop. We use mode:'no-cors' so the POST goes
    // through reliably — the trade-off is we can't read the response. The
    // request still lands and the row still appears in the Sheet.
    // Body is a plain string so fetch defaults to text/plain;charset=UTF-8,
    // which avoids the CORS preflight that application/json would trigger.
    try {
        fetch(SHEET_SYNC_ENDPOINT, {
            method:    'POST',
            mode:      'no-cors',
            redirect:  'follow',
            cache:     'no-store',
            body:      JSON.stringify(payload),
            keepalive: true, // keeps the request alive across page unload
        })
        .then(() => {
            console.log('[sync] session posted:', payload.type, payload.assignmentTitle || payload.skills.join(','));
        })
        .catch(err => {
            console.warn('[sync] upload failed (silent):', err);
        });
    } catch (e) {
        console.warn('[sync] threw synchronously:', e);
    }
}
