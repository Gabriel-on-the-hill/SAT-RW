// session-responses.test.js — run: node session-responses.test.js
//
// The whole point of this model is that free navigation must not corrupt the
// mastery ledger. Most of what follows is about counting exactly once.

const R = require('./session-responses.js');

let pass = 0, fail = 0;
const t = (n, f) => { try { f(); console.log('  ok   ' + n); pass++; }
                      catch (e) { console.log('  FAIL ' + n + '\n       ' + e.message); fail++; } };
const ok = (c, m) => { if (!c) throw new Error(m || 'expected truthy'); };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b))
    throw new Error((m || '') + ' expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a)); };

const Q = [
    { id: 'q1', answer: 'A', skill: 'Transitions' },
    { id: 'q2', answer: 'B', skill: 'Boundaries' },
    { id: 'q3', answer: 'C', skill: 'Inferences' },
];
// A stand-in for recordAnswer that just records what it was told.
const spy = () => { const calls = []; const fn = (id, ok, src) => calls.push({ id, ok, src }); fn.calls = calls; return fn; };

console.log('\nBASICS\n------');

t('a fresh set of responses is entirely blank', () => {
    const r = R.makeResponses(3);
    eq(r.length, 3);
    r.forEach(x => { eq(x.chosen, null); eq(x.flagged, false); eq(x.secs, 0); eq(x.committed, false); });
});

t('a choice can be set and then changed', () => {
    const r = R.makeResponses(3);
    R.setChoice(r, 0, 'A');
    eq(r[0].chosen, 'A');
    R.setChoice(r, 0, 'D');
    eq(r[0].chosen, 'D', 'a student must be able to change their mind:');
});

t('a choice can be cleared back to blank', () => {
    const r = R.makeResponses(3);
    R.setChoice(r, 0, 'A');
    R.clearChoice(r, 0);
    eq(r[0].chosen, null);
});

t('flags toggle independently of answers', () => {
    const r = R.makeResponses(3);
    eq(R.toggleFlag(r, 1), true);
    eq(r[1].flagged, true);
    eq(r[1].chosen, null, 'flagging must not imply answering');
    eq(R.toggleFlag(r, 1), false);
});

console.log('\nTIME ACCUMULATES ACROSS VISITS\n------------------------------');

t('revisiting a question adds to its time rather than replacing it', () => {
    const r = R.makeResponses(3);
    R.addTime(r, 0, 20);
    R.addTime(r, 0, 35);
    eq(r[0].secs, 55, 'a question read twice was worked on twice:');
});

t('nonsense time values are ignored', () => {
    const r = R.makeResponses(3);
    R.addTime(r, 0, -5); R.addTime(r, 0, 0); R.addTime(r, 0, undefined);
    eq(r[0].secs, 0);
});

console.log('\nTHE LEDGER IS WRITTEN EXACTLY ONCE\n----------------------------------');

t('committing an answered question writes once', () => {
    const r = R.makeResponses(3); const rec = spy();
    R.setChoice(r, 0, 'A');
    R.commitOne(r, 0, Q[0], 'exam', rec);
    eq(rec.calls, [{ id: 'q1', ok: true, src: 'exam' }]);
});

t('committing twice does NOT write twice', () => {
    const r = R.makeResponses(3); const rec = spy();
    R.setChoice(r, 0, 'A');
    R.commitOne(r, 0, Q[0], 'exam', rec);
    R.commitOne(r, 0, Q[0], 'exam', rec);
    R.commitOne(r, 0, Q[0], 'exam', rec);
    eq(rec.calls.length, 1, 'the ledger was written more than once for one question:');
});

t('changing an answer before commit records only the final one', () => {
    const r = R.makeResponses(3); const rec = spy();
    R.setChoice(r, 0, 'D');          // wrong
    R.setChoice(r, 0, 'B');          // still wrong
    R.setChoice(r, 0, 'A');          // right, and this is the one that counts
    R.commitOne(r, 0, Q[0], 'exam', rec);
    eq(rec.calls, [{ id: 'q1', ok: true, src: 'exam' }]);
});

t('an answer cannot be changed after commit', () => {
    const r = R.makeResponses(3);
    R.setChoice(r, 0, 'A');
    R.commitOne(r, 0, Q[0], 'practice', spy());
    eq(R.setChoice(r, 0, 'D'), false, 'a committed answer was editable');
    eq(r[0].chosen, 'A');
});

console.log('\nA BLANK IS NOT A WRONG ANSWER\n-----------------------------');

t('committing a blank writes NOTHING to the ledger', () => {
    const r = R.makeResponses(3); const rec = spy();
    R.commitOne(r, 0, Q[0], 'exam', rec);
    eq(rec.calls, [], 'a skipped question was recorded as evidence about a skill:');
    eq(r[0].committed, true, 'it should still be closed to further answering');
});

t('commitAll writes only the answered ones', () => {
    const r = R.makeResponses(3); const rec = spy();
    R.setChoice(r, 0, 'A');          // right
    // q2 left blank
    R.setChoice(r, 2, 'D');          // wrong
    const n = R.commitAll(r, Q, 'exam', rec);
    eq(n, 2, 'commitAll should report 2 ledger writes:');
    eq(rec.calls, [
        { id: 'q1', ok: true,  src: 'exam' },
        { id: 'q3', ok: false, src: 'exam' },
    ]);
});

t('commitAll is safe to call twice', () => {
    const r = R.makeResponses(3); const rec = spy();
    R.setChoice(r, 0, 'A');
    R.commitAll(r, Q, 'exam', rec);
    R.commitAll(r, Q, 'exam', rec);
    eq(rec.calls.length, 1);
});

console.log('\nRESULTS ARE IN QUESTION ORDER, NOT CLICK ORDER\n---------------------------------------------');

t('results follow the question order even when answered out of order', () => {
    const r = R.makeResponses(3);
    R.setChoice(r, 2, 'C');          // answered third question first
    R.setChoice(r, 0, 'A');
    const rows = R.buildResults(r, Q);
    eq(rows.map(x => x.q.id), ['q1', 'q2', 'q3']);
});

t('a blank row is marked unanswered and not counted wrong', () => {
    const r = R.makeResponses(3);
    R.setChoice(r, 0, 'A');
    const rows = R.buildResults(r, Q);
    eq(rows[1].answered, false);
    eq(rows[1].isCorrect, false);
    eq(rows[1].selected, null);
    eq(R.countCorrect(r, Q), 1);
});

t('a blank never counts as correct even if the key is null-ish', () => {
    const r = R.makeResponses(1);
    const rows = R.buildResults(r, [{ id: 'x', answer: null }]);
    eq(rows[0].isCorrect, false, 'null === null must not read as a correct answer');
});

t('flags survive into the results', () => {
    const r = R.makeResponses(3);
    R.toggleFlag(r, 1);
    eq(R.buildResults(r, Q)[1].flagged, true);
});

console.log('\nREVIEW SCREEN SUMMARY\n---------------------');

t('summary counts answered, blank and flagged correctly', () => {
    const r = R.makeResponses(3);
    R.setChoice(r, 0, 'A');
    R.toggleFlag(r, 0);
    R.toggleFlag(r, 2);
    const s = R.responseSummary(r, Q);
    eq(s.total, 3); eq(s.answered, 1); eq(s.blank, 2); eq(s.flagged, 2);
    eq(s.blankIndexes, [1, 2]);
    eq(s.flaggedIndexes, [0, 2]);
});

t('a question can be both answered and flagged', () => {
    const r = R.makeResponses(3);
    R.setChoice(r, 0, 'A'); R.toggleFlag(r, 0);
    const s = R.responseSummary(r, Q);
    eq(s.answered, 1); eq(s.flagged, 1); eq(s.blank, 2);
});

console.log('\nRESUME\n------');

t('pack/unpack round-trips every field', () => {
    const r = R.makeResponses(3);
    R.setChoice(r, 0, 'A'); R.addTime(r, 0, 42); R.toggleFlag(r, 0);
    R.commitOne(r, 0, Q[0], 'practice', spy());
    R.setChoice(r, 2, 'B');
    const back = R.unpackResponses(R.packResponses(r), 3);
    eq(back[0], { chosen: 'A', flagged: true, secs: 42, committed: true });
    eq(back[1], { chosen: null, flagged: false, secs: 0, committed: false });
    eq(back[2].chosen, 'B');
});

t('a corrupt or missing packed blob degrades to blanks', () => {
    eq(R.unpackResponses(null, 2), R.makeResponses(2));
    eq(R.unpackResponses('nonsense', 2), R.makeResponses(2));
    eq(R.unpackResponses([['A', 1, 5, 0], 'junk'], 2)[1], R.makeResponses(2)[1]);
});

t('a resumed session cannot re-answer what it already committed', () => {
    const r = R.makeResponses(2);
    R.setChoice(r, 0, 'A');
    R.commitOne(r, 0, Q[0], 'practice', spy());
    const back = R.unpackResponses(R.packResponses(r), 2);
    const rec = spy();
    eq(R.setChoice(back, 0, 'D'), false);
    R.commitOne(back, 0, Q[0], 'practice', rec);
    eq(rec.calls, [], 'a resumed session re-wrote an already-committed answer:');
});

console.log('\nFULL EXAM WALKTHROUGH\n---------------------');

t('answer, skip, flag, revisit, revise, submit — ledger written once each', () => {
    const r = R.makeResponses(3); const rec = spy();
    R.addTime(r, 0, 30); R.setChoice(r, 0, 'D');   // wrong first pass
    R.addTime(r, 1, 12); R.toggleFlag(r, 1);       // skipped, flagged for later
    R.addTime(r, 2, 40); R.setChoice(r, 2, 'C');   // right
    // comes back to Q1 and fixes it, and to Q2 and finally answers it
    R.addTime(r, 0, 25); R.setChoice(r, 0, 'A');
    R.addTime(r, 1, 30); R.setChoice(r, 1, 'B');

    const s = R.responseSummary(r, Q);
    eq(s.answered, 3); eq(s.blank, 0); eq(s.flagged, 1);

    R.commitAll(r, Q, 'exam', rec);
    eq(rec.calls.length, 3, 'one write per question:');
    eq(rec.calls.every(c => c.ok), true, 'all three should be correct after revision');
    eq(r[0].secs, 55, 'time across two visits:');
    eq(R.countCorrect(r, Q), 3);
});

t('running out of time commits whatever is there, blanks and all', () => {
    const r = R.makeResponses(3); const rec = spy();
    R.setChoice(r, 0, 'A');
    R.commitAll(r, Q, 'exam', rec);              // clock expires
    eq(rec.calls.length, 1, 'only the answered question should reach the ledger');
    const rows = R.buildResults(r, Q);
    eq(rows.filter(x => !x.answered).length, 2);
    eq(R.countCorrect(r, Q), 1);
});

console.log('\n' + '='.repeat(46));
console.log(`${pass} passed, ${fail} failed`);
console.log('='.repeat(46) + '\n');
process.exit(fail ? 1 : 0);
