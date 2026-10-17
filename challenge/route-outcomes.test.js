'use strict';
// ─────────────────────────────────────────────────────────────────
// route-outcomes.test.js — every taught rule is checked in BOTH directions.
//
//   node challenge/route-outcomes.test.js
//
// Needs no jsdom. Same file in the PSAT 8/9 app and the SAT MasteryApp.
//
// Why this exists (17 Oct 2026). A verb-form lesson taught one direction only:
// "an independent clause needs a finite verb". Every example and check needed a
// finite verb. A week later the student was choosing a finite verb even where the
// sentence already had its main verb ("This hypothesis suggests … cannot stand";
// "Richard Serra intends …, assembles"). She had learned "pick the finite verb",
// not the check. A transitions lesson built on contrast cues did the same thing:
// she began labelling sequences as contrast. Nothing failed; the record just got worse.
//
// The rule (house Session_Plan_Standard §10, Method_Response_Standard): a method is a
// check with at least two outcomes, and the student must meet each outcome. For every
// class route dated 2026-10-17 or later, each cycle (and each alternate) must declare
//   outcomes: [ { label: "…", ids: [...] }, { label: "…", ids: [...] }, … ]
// and this test asserts:
//   1. at least two outcomes, each with a label and at least one item;
//   2. every outcome id belongs to that cycle (model, checks or reserves);
//   3. the model and every check are each assigned to exactly one outcome;
//   4. the three silent checks between them cover at least two outcomes.
// A known one-sided cycle can be listed in WAIVED with its reason: it prints a warning
// instead of failing. Do not add to WAIVED to get a new route through; fix the items.
// ─────────────────────────────────────────────────────────────────
const assert = require('assert/strict'), fs = require('fs'), path = require('path'), vm = require('vm');
const FROM = '2026-10-17';
const WAIVED = {
  // SAT MasteryApp, Ayodeji, 17 Oct: all three tense checks are "same time as the anchor";
  // only the model needs the earlier (past perfect) outcome. Raised with Gabriel on 17 Oct.
  'verb-tense-cycles-20261017#tense': 'tense checks cover one outcome only'
};
const g = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'sets.js'), 'utf8'), g);
let count = 0, warned = 0;
function ok(c, m) { assert.ok(c, m); count++; }
const routes = Object.entries(g.window.CHALLENGE_SETS).flatMap(([who, sets]) =>
  sets.filter(s => s.learningPath && Array.isArray(s.learningPath.cycles) && String(s.date || '') >= FROM).map(s => [who, s]));
for (const [who, set] of routes) {
  const parts = set.learningPath.cycles.flatMap(c => [c].concat(c.alternate ? [Object.assign({ id: c.id + '-alt' }, c.alternate)] : []));
  for (const c of parts) {
    const where = who + ' · ' + set.setId + ' · ' + (c.id || c.title);
    const own = [c.model.bankId].concat(c.checks.map(q => q.bankId), (c.reserves || []).map(q => q.bankId));
    const scored = [c.model.bankId].concat(c.checks.map(q => q.bankId));
    const o = c.outcomes;
    ok(Array.isArray(o) && o.length >= 2, where + ': declares at least two outcomes');
    ok(o.every(x => x && typeof x.label === 'string' && x.label.trim().split(/\s+/).length >= 3 && Array.isArray(x.ids) && x.ids.length > 0), where + ': each outcome has a label and items');
    ok(o.flatMap(x => x.ids).every(id => own.includes(id)), where + ': outcome ids belong to this cycle');
    ok(scored.every(id => o.filter(x => x.ids.includes(id)).length === 1), where + ': the model and every check sit under exactly one outcome');
    const covered = o.filter(x => c.checks.some(q => x.ids.includes(q.bankId))).length;
    const key = set.setId + '#' + c.id;
    if (covered < 2 && WAIVED[key]) { warned++; console.warn('WARN — ' + where + ': ' + WAIVED[key]); continue; }
    ok(covered >= 2, where + ': the three silent checks test at least two outcomes, not just the one the lesson led with');
  }
}
console.log('ALL ' + count + ' ASSERTIONS PASSED' + (warned ? ' (' + warned + ' waived cycle' + (warned > 1 ? 's' : '') + ' warned)' : '') + ' — ' + routes.length + ' route(s) dated ' + FROM + ' or later.');
