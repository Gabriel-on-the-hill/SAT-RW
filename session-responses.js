// ══════════════════════════════════════════════════════════════════
// session-responses.js — what the student has actually said so far
//
// WHY THIS EXISTS
// The session used to hold answers in two places that could not represent a
// changed mind: `sessionResults`, an append-only array pushed on every click,
// and `isAnswered`, a one-shot latch. handleOptionClick() wrote straight to the
// mastery ledger on the first click and then refused all further input. That is
// why a student could not go back, could not skip, and could not correct a
// misclick — the data model had nowhere to put a second thought.
//
// Making navigation free without changing the model would have been worse than
// leaving it alone: every revision would have appended a second row to
// sessionResults and written the ledger a second time, so one question answered
// twice would count twice, and a student who corrected a wrong answer would
// still carry the wrong one in their mastery record.
//
// So answers live here instead — one slot per question, revisable, with the
// ledger written exactly once at commit.
//
//   responses[i] = { chosen, flagged, secs, committed }
//
// THREE RULES THIS FILE ENFORCES
//   1. A blank is not a wrong answer. Skipping writes NOTHING to the mastery
//      ledger. "Did not attempt" is not evidence about a skill, and recording
//      it as a miss would tell the review ladder to re-teach something that was
//      never tested.
//   2. The ledger is written once per question per session. commit() is
//      idempotent; calling it twice is a no-op.
//   3. Time accumulates across visits. A student who reads a question, moves
//      on, and comes back has spent both intervals on it.
// ══════════════════════════════════════════════════════════════════

function makeResponses(n) {
    const out = [];
    for (let i = 0; i < n; i++) {
        out.push({ chosen: null, flagged: false, secs: 0, committed: false });
    }
    return out;
}

function setChoice(responses, i, letter) {
    const r = responses[i];
    if (!r || r.committed) return false;      // committed answers are final
    r.chosen = letter;
    return true;
}

function clearChoice(responses, i) {
    const r = responses[i];
    if (!r || r.committed) return false;
    r.chosen = null;
    return true;
}

function toggleFlag(responses, i) {
    const r = responses[i];
    if (!r) return false;
    r.flagged = !r.flagged;
    return r.flagged;
}

function addTime(responses, i, secs) {
    const r = responses[i];
    if (!r || !(secs > 0)) return;
    r.secs += secs;
}

// Commit one question to the mastery ledger. Idempotent by design: the exam
// review screen, the timer expiring, and the Submit button can all reach this
// for the same question, and only the first may count.
//
// `record` is injected rather than calling recordAnswer() directly so this file
// stays testable without the whole app loaded.
function commitOne(responses, i, question, source, record) {
    const r = responses[i];
    if (!r || r.committed) return false;
    r.committed = true;
    // Rule 1: a blank writes nothing. It is still committed, so it cannot be
    // answered later, but the ledger never hears about it.
    if (r.chosen === null) return false;
    const isCorrect = r.chosen === question.answer;
    if (typeof record === 'function') record(question.id, isCorrect, source);
    return true;
}

function commitAll(responses, questions, source, record) {
    let n = 0;
    for (let i = 0; i < questions.length; i++) {
        if (commitOne(responses, i, questions[i], source, record)) n++;
    }
    return n;
}

// Rebuild the shape the completion screen and history already expect, in
// question order, with blanks included. sessionResults was previously in click
// order, which stopped being the same thing the moment navigation went free.
function buildResults(responses, questions) {
    return questions.map((q, i) => {
        const r = responses[i] || { chosen: null, secs: 0, flagged: false };
        const answered = r.chosen !== null;
        return {
            q,
            selected:  r.chosen,
            correct:   q.answer,
            isCorrect: answered && r.chosen === q.answer,
            answered,
            flagged:   !!r.flagged,
            secs:      r.secs,
        };
    });
}

function countCorrect(responses, questions) {
    return buildResults(responses, questions).filter(r => r.isCorrect).length;
}

// What the end-of-module review screen reports, and what the Submit
// confirmation warns about.
function responseSummary(responses, questions) {
    const rows = buildResults(responses, questions);
    return {
        total:    rows.length,
        answered: rows.filter(r => r.answered).length,
        blank:    rows.filter(r => !r.answered).length,
        flagged:  rows.filter(r => r.flagged).length,
        blankIndexes:   rows.map((r, i) => (!r.answered ? i : -1)).filter(i => i >= 0),
        flaggedIndexes: rows.map((r, i) => (r.flagged   ? i : -1)).filter(i => i >= 0),
    };
}

// Persisted so a resumed session does not silently lose revisions and flags.
// Kept compact: this rides along in the same localStorage record as the rest of
// the session state.
function packResponses(responses) {
    return responses.map(r =>
        [r.chosen, r.flagged ? 1 : 0, r.secs, r.committed ? 1 : 0]);
}

function unpackResponses(packed, n) {
    const out = makeResponses(n);
    if (!Array.isArray(packed)) return out;
    packed.slice(0, n).forEach((p, i) => {
        if (!Array.isArray(p)) return;
        out[i].chosen    = p[0] == null ? null : p[0];
        out[i].flagged   = !!p[1];
        out[i].secs      = p[2] || 0;
        out[i].committed = !!p[3];
    });
    return out;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        makeResponses, setChoice, clearChoice, toggleFlag, addTime,
        commitOne, commitAll, buildResults, countCorrect, responseSummary,
        packResponses, unpackResponses,
    };
}
