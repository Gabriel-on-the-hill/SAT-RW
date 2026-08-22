// baseline-store.test.js — persistence, retake forms, the mid-sitting draft,
// growth deltas, the sheet payload, and a full run through
// and one full sitting end to end.
// Run: node baseline-store.test.js
//
// Needs no jsdom: localStorage and sessionStorage are shimmed below, which is
// also how the suite proves the store degrades safely when storage misbehaves.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ── browser shims ─────────────────────────────────────────────────
function mkStorage() {
    const m = new Map();
    return {
        get length() { return m.size; },
        key: i => [...m.keys()][i] ?? null,
        getItem: k => (m.has(k) ? m.get(k) : null),
        setItem: (k, v) => m.set(k, String(v)),
        removeItem: k => m.delete(k),
        clear: () => m.clear(),
        _dump: () => Object.fromEntries(m),
    };
}

const ctx = {
    console,
    localStorage: mkStorage(),
    sessionStorage: mkStorage(),
    Date, JSON, Math, String, Object, Array, Number, Boolean, Error, isNaN, Set, Map,
};
vm.createContext(ctx);

['data-craft-structure.js', 'data-expression-of-ideas.js',
 'data-info-ideas.js', 'data-conventions.js'].forEach(f => {
    vm.runInContext(fs.readFileSync(path.join(__dirname, f), 'utf8'), ctx);
});
vm.runInContext(`
    var questionBank = [].concat(questionBank_CS, questionBank_EOI,
                                 questionBank_II, questionBank_CON);
`, ctx);

const strip = f => fs.readFileSync(path.join(__dirname, f), 'utf8')
    .replace(/if \(typeof module[\s\S]*$/, '');
vm.runInContext(strip('baseline-spec.js'), ctx);
vm.runInContext(strip('baseline-grade.js'), ctx);
vm.runInContext(strip('baseline-store.js'), ctx);
vm.runInContext(`
    globalThis.BASELINE_FORMS         = BASELINE_FORMS;
    globalThis.BASELINE_SKILLS        = BASELINE_SKILLS;
    globalThis.BASELINE_BANDS         = BASELINE_BANDS;
    globalThis.BASELINE_SECONDS       = BASELINE_SECONDS;
    globalThis.BASELINE_STORE_VERSION = BASELINE_STORE_VERSION;
    globalThis.BASELINE_KEY_PREFIX    = BASELINE_KEY_PREFIX;
    globalThis.BASELINE_FOCUS_PREFIX  = BASELINE_FOCUS_PREFIX;
`, ctx);

let pass = 0, fail = 0;
function t(name, fn) {
    try { fn(); console.log('  ok   ' + name); pass++; }
    catch (e) { console.log('  FAIL ' + name + '\n       ' + e.message); fail++; }
}
function eq(a, b, m) {
    if (JSON.stringify(a) !== JSON.stringify(b))
        throw new Error((m || '') + ' expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a));
}
function ok(c, m) { if (!c) throw new Error(m || 'expected truthy'); }
function reset() { ctx.localStorage.clear(); ctx.sessionStorage.clear(); }

const bank = ctx.questionBank;

// helper: run one screener with a given correctness predicate
function sit(formId, isCorrect, seconds) {
    const form = ctx.buildBaselineForm(bank, formId);
    const items = form.questions.map((q, i) => ({
        id: q.id, skill: q.skill, difficulty: q.difficulty, stage: 1,
        chosen: 'A', correct: isCorrect(q, i), seconds: seconds || 55,
    }));
    const profile    = ctx.buildBaselineProfile(items);
    const projection = ctx.projectBaseline(items);
    const queue      = ctx.baselineFocusQueue(profile, null, bank);
    const skills = {};
    Object.values(profile).forEach(s => {
        skills[s.skill] = {
            band: s.band, confidence: s.confidence,
            screenCorrect: s.screenCorrect, screenTotal: s.screenTotal,
            flags: s.flags, note: s.note || null,
        };
    });
    ctx.saveBaseline({
        takenAt: Date.now(), form: formId, stage: 'complete',
        correct: items.filter(i => i.correct).length, total: items.length,
        projection, skills, items, focus: ctx.slimFocusQueue(queue),
    });
    ctx.saveFocusQueue(queue);
    return { items, profile, projection, queue };
}

console.log('\nNAMESPACE\n---------');
// Getting this wrong is silent: the record saves, the app never finds it, and
// the student looks like they have never sat a baseline.
t('keys are namespaced satrw_, matching the rest of the app', () => {
    reset();
    ctx.sessionStorage.setItem('mastery_user', 'Tester');
    sit('A', () => true);
    const keys = Object.keys(ctx.localStorage._dump());
    ok(keys.includes('satrw_baseline_Tester'), 'keys written: ' + keys.join(', '));
    ok(keys.includes('satrw_focus_Tester'), 'no focus key: ' + keys.join(', '));
    ok(!keys.some(k => k.indexOf('psat89') === 0), 'a PSAT-namespaced key was written');
});

t('the user comes from mastery_user, not the sister app\'s key', () => {
    reset();
    ctx.sessionStorage.setItem('psat89_user', 'Wrong');
    ctx.sessionStorage.setItem('mastery_user', 'Right');
    sit('A', () => true);
    ok(ctx.localStorage.getItem('satrw_baseline_Right'), 'filed under the wrong key');
});

t('an unsigned-in sitting files under guest rather than throwing', () => {
    reset();
    sit('A', () => true);
    ok(ctx.localStorage.getItem('satrw_baseline_guest'));
});

console.log('\nSAVING AND APPENDING\n--------------------');
t('a sitting is saved and readable', () => {
    reset();
    ctx.sessionStorage.setItem('mastery_user', 'Tester');
    sit('A', () => true);
    const list = ctx.getBaselines();
    eq(list.length, 1);
    eq(list[0].form, 'A');
    eq(list[0].total, 22);
    eq(list[0].version, ctx.BASELINE_STORE_VERSION);
});

// The first baseline is the anchor. A retake is a second data point, and
// overwriting would destroy the only thing a baseline is for.
t('a retake appends, it never overwrites the anchor', () => {
    reset();
    ctx.sessionStorage.setItem('mastery_user', 'Tester');
    sit('A', () => true);
    sit('B', () => false);
    const list = ctx.getBaselines();
    eq(list.length, 2);
    eq(list[0].form, 'A');
    eq(list[1].form, 'B');
    eq(list[0].correct, 22, 'the first sitting was altered:');
});

t('sitting number is stamped at save time', () => {
    reset();
    ctx.sessionStorage.setItem('mastery_user', 'Tester');
    sit('A', () => true);
    sit('B', () => true);
    eq(ctx.getBaselines().map(b => b.sitting), [1, 2]);
});

t('two students never see each other\'s baselines', () => {
    reset();
    ctx.sessionStorage.setItem('mastery_user', 'One');
    sit('A', () => true);
    ctx.sessionStorage.setItem('mastery_user', 'Two');
    eq(ctx.getBaselines(), []);
    sit('A', () => false);
    eq(ctx.getBaselines().length, 1);
    ctx.sessionStorage.setItem('mastery_user', 'One');
    eq(ctx.getBaselines().length, 1);
    eq(ctx.getBaselines()[0].correct, 22);
});

console.log('\nFORM ROTATION\n-------------');
t('the first sitting gets form A', () => {
    reset();
    eq(ctx.nextBaselineForm(), 'A');
    ok(ctx.baselineFormIsFresh());
});

t('the second sitting advances to a form not yet sat', () => {
    reset();
    ctx.sessionStorage.setItem('mastery_user', 'Tester');
    sit('A', () => true);
    eq(ctx.nextBaselineForm(), 'B');
    ok(ctx.baselineFormIsFresh());
});

// Only two forms exist here — the bank's limit, see baseline-spec.js. The
// sister app wraps round silently while its intro still promises "different
// questions from last time", which turns a true sentence into a false one on
// exactly the sitting where the student would notice.
t('once the forms run out it says so instead of promising freshness', () => {
    reset();
    ctx.sessionStorage.setItem('mastery_user', 'Tester');
    ctx.BASELINE_FORMS.forEach(f => sit(f, () => true));
    ok(!ctx.baselineFormIsFresh(), 'claims a fresh form after every form is sat');
    ok(ctx.BASELINE_FORMS.includes(ctx.nextBaselineForm()),
       'wrapped round to something that is not a form');
});

console.log('\nTHE MID-SITTING DRAFT\n---------------------');
// 26 minutes is a long time to lose to a closed tab, and the student who loses
// it is unlikely to sit down and do it again the same evening.
t('a draft round-trips', () => {
    reset();
    ctx.sessionStorage.setItem('mastery_user', 'Tester');
    ctx.saveBaselineDraft({ form: 'A', idx: 5, answers: ['A', null, 'C'], times: [30, 0, 12], remaining: 900 });
    const d = ctx.getBaselineDraft();
    eq(d.form, 'A'); eq(d.idx, 5); eq(d.remaining, 900);
    eq(d.answers, ['A', null, 'C']);
});

t('a draft is scratch — it never shows up as a sitting', () => {
    reset();
    ctx.sessionStorage.setItem('mastery_user', 'Tester');
    ctx.saveBaselineDraft({ form: 'A', idx: 1, answers: ['A'], times: [10], remaining: 900 });
    eq(ctx.getBaselines(), [], 'a half-finished sitting is being counted as a baseline');
    eq(ctx.nextBaselineForm(), 'A', 'an unfinished draft consumed a form');
});

t('clearing the draft leaves the records alone', () => {
    reset();
    ctx.sessionStorage.setItem('mastery_user', 'Tester');
    sit('A', () => true);
    ctx.saveBaselineDraft({ form: 'B', idx: 2, answers: ['A'], times: [9], remaining: 800 });
    ctx.clearBaselineDraft();
    eq(ctx.getBaselineDraft(), null);
    eq(ctx.getBaselines().length, 1, 'clearing the draft ate a real sitting');
});

t('one student\'s draft is not offered to another', () => {
    reset();
    ctx.sessionStorage.setItem('mastery_user', 'One');
    ctx.saveBaselineDraft({ form: 'A', idx: 3, answers: ['B'], times: [20], remaining: 700 });
    ctx.sessionStorage.setItem('mastery_user', 'Two');
    eq(ctx.getBaselineDraft(), null);
});

console.log('\nAMENDING AFTER THE PROBES\n-------------------------');
t('amending updates the newest record in place', () => {
    reset();
    ctx.sessionStorage.setItem('mastery_user', 'Tester');
    sit('A', () => true);
    ctx.amendLatestBaseline({ stage: 'complete' });
    const list = ctx.getBaselines();
    eq(list.length, 1, 'the amend created a second record:');
    eq(list[0].stage, 'complete');
    ok(list[0].amendedAt, 'no amendedAt stamp');
});

t('amending with no prior record fails safely', () => {
    reset();
    eq(ctx.amendLatestBaseline({ stage: 'complete' }), false);
});

console.log('\nGROWTH\n------');
t('one sitting yields no delta', () => {
    reset();
    ctx.sessionStorage.setItem('mastery_user', 'Tester');
    sit('A', () => true);
    eq(ctx.baselineDelta(), null);
});

t('a delta reports which bands moved and in which direction', () => {
    reset();
    ctx.sessionStorage.setItem('mastery_user', 'Tester');
    sit('A', () => false);         // everything Priority
    sit('B', () => true);          // everything Proficient
    const d = ctx.baselineDelta();
    ok(d, 'no delta from two sittings');
    Object.values(d.skills).forEach(s => {
        eq(s.was, 'Priority'); eq(s.now, 'Proficient');
        ok(s.moved > 0, 'improvement recorded as ' + s.moved);
    });
});

// Telling a parent that ±30 of instrument noise is progress is how a baseline
// loses its credibility, and it only gets to happen once.
t('movement inside the band is NOT reported as real', () => {
    reset();
    ctx.sessionStorage.setItem('mastery_user', 'Tester');
    let n = 0;
    sit('A', () => (n++ % 2 === 0));
    let m = 0;
    sit('B', () => (m++ % 2 === 0));
    const d = ctx.baselineDelta();
    ok(d.projection, 'no projection comparison');
    eq(d.projection.meaningful, false,
       'overlapping ranges were reported as movement:');
});

t('a genuine jump clears the noise floor', () => {
    reset();
    ctx.sessionStorage.setItem('mastery_user', 'Tester');
    sit('A', () => false);
    sit('B', () => true);
    const d = ctx.baselineDelta();
    eq(d.projection.meaningful, true, 'a 0% -> 100% change was called noise:');
});

console.log('\nTHE FOCUS QUEUE\n---------------');
t('the queue is written where the app can read it', () => {
    reset();
    ctx.sessionStorage.setItem('mastery_user', 'Tester');
    sit('A', () => false);
    const fq = ctx.getFocusQueue();
    ok(fq && fq.skills.length, 'no focus queue');
    ok(fq.skills[0].score >= fq.skills[fq.skills.length - 1].score, 'queue unsorted');
});

// One shape, used by the live key, the record and the payload. Three hand-rolled
// projections of the same list is how the app and the dashboard end up
// disagreeing about what the plan was.
t('the queue in the record matches the queue in the key', () => {
    reset();
    ctx.sessionStorage.setItem('mastery_user', 'Tester');
    sit('A', () => false);
    eq(ctx.latestBaseline().focus, ctx.getFocusQueue().skills);
});

console.log('\nTHE SHEET PAYLOAD\n-----------------');
t('the payload carries the form, the sitting and the plan', () => {
    reset();
    ctx.sessionStorage.setItem('mastery_user', 'Tester');
    sit('A', () => false);
    const p = ctx.baselineSheetPayload(ctx.latestBaseline(), 'Tester');
    eq(p.source, 'baseline');
    eq(p.baseline.form, 'A');
    eq(p.baseline.sitting, 1);
    ok(Array.isArray(p.baseline.focus) && p.baseline.focus.length,
       'the ranked plan is missing from the payload');
});

t('it carries a band for every skill, with its confidence', () => {
    reset();
    ctx.sessionStorage.setItem('mastery_user', 'Tester');
    sit('A', () => false);
    const p = ctx.baselineSheetPayload(ctx.latestBaseline(), 'Tester');
    eq(Object.keys(p.baseline.bands).length, 11);
    Object.values(p.baseline.bands).forEach(b => {
        ok(b.band, 'a band is blank');
        ok(b.confidence, 'a confidence marker is blank');
        ok(/^\d+\/\d+$/.test(b.screener), 'screener reads ' + b.screener);
    });
});

t('it carries the projected RANGE, not a single number', () => {
    reset();
    ctx.sessionStorage.setItem('mastery_user', 'Tester');
    sit('A', () => true);
    const b = ctx.baselineSheetPayload(ctx.latestBaseline(), 'Tester').baseline;
    ok(b.projectionHigh > b.projectionLow,
       'projection is not a range: ' + b.projectionLow + '-' + b.projectionHigh);
    ok(b.projectionLow >= 200 && b.projectionHigh <= 800, 'off the SAT scale');
});

t('every question is reported with its timing', () => {
    reset();
    ctx.sessionStorage.setItem('mastery_user', 'Tester');
    sit('A', () => true, 61);
    const p = ctx.baselineSheetPayload(ctx.latestBaseline(), 'Tester');
    eq(p.questions.length, 22);
    ok(p.questions.every(q => q.id && q.secs === 61), 'per-question timing lost');
    eq(p.duration, 22 * 61);
    ok(!('seconds' in p), 'a `seconds` key is back — this app\'s script reads `duration`');
});

// Built from the SAVED record, not live page state, so a row recovered months
// later is identical to the one that would have gone up at the time.
t('the payload is a pure function of the record', () => {
    reset();
    ctx.sessionStorage.setItem('mastery_user', 'Tester');
    sit('A', () => true);
    const rec = ctx.latestBaseline();
    const a = ctx.baselineSheetPayload(rec, 'Tester');
    reset();                                   // a different device, months later
    const b = ctx.baselineSheetPayload(rec, 'Tester');
    eq(a, b, 'the payload depends on ambient state:');
});

t('a null record yields null rather than a half-built row', () => {
    eq(ctx.baselineSheetPayload(null, 'Tester'), null);
});

// The Apps Script joins the Questions tab to the session on this, and skips a
// repeat as a duplicate. Blank, and the per-question timing lands attached to
// nothing.
t('the payload carries a session id', () => {
    reset();
    ctx.sessionStorage.setItem('mastery_user', 'Tester');
    sit('A', () => true);
    const p = ctx.baselineSheetPayload(ctx.latestBaseline(), 'Tester');
    ok(p.sessionId, 'no session id — the Questions rows cannot join');
    ok(/^bl_A_\d+_complete$/.test(p.sessionId), 'got ' + p.sessionId);
});

t('the id is stable, so a recovered row is not a second row', () => {
    reset();
    ctx.sessionStorage.setItem('mastery_user', 'Tester');
    sit('A', () => true);
    const rec = ctx.latestBaseline();
    eq(ctx.baselineSheetPayload(rec, 'Tester').sessionId,
       ctx.baselineSheetPayload(rec, 'Someone Else').sessionId);
});

// One sitting posts one row. There was a second row when the follow-up existed
// — the screener, then the completed sitting with the probes resolved — and its
// id had to differ or the Apps Script would drop it as a duplicate. With no
// second stage, two sittings on the same form must still differ, and they do
// because the id carries takenAt.
t('two sittings never share a session id', () => {
    reset();
    ctx.sessionStorage.setItem('mastery_user', 'Tester');
    sit('A', () => true);
    const first = ctx.baselineSheetPayload(ctx.getBaselines()[0], 'Tester').sessionId;
    sit('B', () => true);
    const second = ctx.baselineSheetPayload(ctx.latestBaseline(), 'Tester').sessionId;
    ok(first !== second, 'both sittings would post as ' + first);
});

console.log('\nMERGING A RESTORE\n-----------------');
t('merging adds records the device does not have', () => {
    reset();
    ctx.sessionStorage.setItem('mastery_user', 'Tester');
    sit('A', () => true);
    const incoming = [{ takenAt: 1, form: 'B', skills: {}, items: [] }];
    eq(ctx.mergeBaselines(incoming), true);
    eq(ctx.getBaselines().length, 2);
});

t('merging the same file twice does not duplicate', () => {
    reset();
    ctx.sessionStorage.setItem('mastery_user', 'Tester');
    const incoming = [{ takenAt: 1, form: 'B', skills: {}, items: [] }];
    ctx.mergeBaselines(incoming);
    eq(ctx.mergeBaselines(incoming), false);
    eq(ctx.getBaselines().length, 1);
});

t('merged records land in date order', () => {
    reset();
    ctx.sessionStorage.setItem('mastery_user', 'Tester');
    ctx.mergeBaselines([
        { takenAt: 300, form: 'B', skills: {}, items: [] },
        { takenAt: 100, form: 'A', skills: {}, items: [] },
    ]);
    eq(ctx.getBaselines().map(b => b.takenAt), [100, 300]);
});

t('merging rubbish is refused rather than stored', () => {
    reset();
    eq(ctx.mergeBaselines(null), false);
    eq(ctx.mergeBaselines([]), false);
    eq(ctx.mergeBaselines(['not an object']), false);
    eq(ctx.getBaselines(), []);
});

console.log('\nBROKEN STORAGE\n--------------');
// Storage fails in the wild — quota, private mode, a corrupt value. None of it
// may throw on a page a student is mid-sitting on.
t('corrupt storage degrades to empty rather than throwing', () => {
    reset();
    ctx.sessionStorage.setItem('mastery_user', 'Tester');
    ctx.localStorage.setItem('satrw_baseline_Tester', '{not json');
    eq(ctx.getBaselines(), []);
    eq(ctx.latestBaseline(), null);
    eq(ctx.baselineDelta(), null);
});

t('a corrupt draft degrades to null', () => {
    reset();
    ctx.sessionStorage.setItem('mastery_user', 'Tester');
    ctx.localStorage.setItem('satrw_baseline_draft_Tester', '{{{');
    eq(ctx.getBaselineDraft(), null);
});

t('a corrupt focus queue degrades to null', () => {
    reset();
    ctx.sessionStorage.setItem('mastery_user', 'Tester');
    ctx.localStorage.setItem('satrw_focus_Tester', 'nope');
    eq(ctx.getFocusQueue(), null);
});

console.log('\nEND TO END — one sitting, one submit\n' + '-'.repeat(36));
t('a full sitting writes one record and one plan', () => {
    reset();
    ctx.sessionStorage.setItem('mastery_user', 'Tester');
    let flip = 0;
    const { items, profile } = sit('A', () => (flip++ % 2 === 0));

    const list = ctx.getBaselines();
    eq(list.length, 1);
    eq(list[0].stage, 'complete', 'a sitting is complete when it is submitted:');
    eq(list[0].items.length, 22, 'the sitting is 22 questions and no more:');
    ok(list[0].items.every(i => i.stage === 1 || i.stage === undefined),
       'a stage-2 item reached the record');
    eq(Object.keys(profile).length, 11);
});

t('nothing in the profile carries a probe any more', () => {
    reset();
    ctx.sessionStorage.setItem('mastery_user', 'Tester');
    const { profile } = sit('A', () => false);
    Object.values(profile).forEach(s => {
        ok(!('routedProbe' in s), s.skill + ' still routes a probe');
        ok(!('probeTier'  in s),  s.skill + ' still carries a probe tier');
    });
});

console.log('\n' + '='.repeat(48));
console.log(`${pass} passed, ${fail} failed`);
console.log('='.repeat(48) + '\n');
process.exit(fail ? 1 : 0);
