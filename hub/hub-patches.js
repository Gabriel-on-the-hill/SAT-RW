// hub/hub-patches.js — how EduTrack Hub serves this runner.
//
// The Hub (Gabriel-on-the-hill/edutrack-hub) copies homework-run.html into
// public/apps/ with scripts/vendor-runners.mjs, and changes it only where listed
// here. Keep this file equal to that script's PATCHES list: hub-runner.test.js
// applies these patches to THIS repo's runner, so a change here that moves an
// anchor fails the test before the Hub's copy is refreshed.
//
// What the Hub copy does not load: the question banks (data-*.js), gate.js,
// whoami.js, the plan file, sheet-sync.js, progress.js. Identity, questions,
// marking and saving come from hub/hub-client.js and hub/hub-runner.js.
'use strict';

const KEEP = ['strategy-response.js', 'eliminator.js'];

const PATCHES = [
  ['Parameters come from the attempt, never a name',
    "var p=new URLSearchParams(location.search);",
    "var p=new URLSearchParams(window.HubRunner?HubRunner.params():location.search);"],
  ['Untimed: commit to the Hub, then mark from its reply',
    "document.getElementById('submit').onclick=function(){ gradeCurrent(q); };",
    "document.getElementById('submit').onclick=function(){ if(window.HubRunner && !isRedo) HubRunner.commit(q, navOf(idx), function(){ gradeCurrent(q); }); else gradeCurrent(q); };"],
  ['Timed: send each choice as it is made',
    "if(navMode()==='exam') writeRec(q, /*grade*/false);",
    "if(navMode()==='exam'){ writeRec(q, /*grade*/false); if(window.HubRunner) HubRunner.answer(q, navOf(idx)); }"],
  ['Timed submit closes the attempt on the Hub first',
    "function submitHwSet(){",
    "function submitHwSet(){\n    if(window.HubRunner && !HubRunner.submitted()) return HubRunner.submit(set, submitHwSet);"],
  ['Finishing (or the clock) closes the attempt on the Hub first',
    "function finish(expired){",
    "function finish(expired){\n    if(window.HubRunner && !isRedo && !HubRunner.submitted()) return HubRunner.submit(set, function(){ finish(expired); });"],
  ['The record takes the answer the Hub released (submit)',
    "if(r){ r.ok=okk; r.chosen=n.chosen;",
    "if(r){ r.answer=q.answer; r.ok=okk; r.chosen=n.chosen;"],
  ['The record takes the answer the Hub released (clock)',
    "if(gr){ gr.ok=gok;",
    "if(gr){ gr.answer=gq.answer; gr.ok=gok;"],
  ['The clock starts from the time left on the Hub, in whole seconds',
    "var remain = spec.minutes * 60",
    "var remain = Math.round(spec.minutes * 60)"],
  ['No link to the app\'s home page, which the Hub does not serve',
    "<a class=\"btn\" href=\"index.html\">Home</a>",
    ""],
];

/** The runner as the Hub serves it. Throws if an anchor is missing or repeated. */
function hubRunner(html) {
  for (const [why, find, replace] of PATCHES) {
    const n = html.split(find).length - 1;
    if (n !== 1) throw new Error('Hub patch "' + why + '" matched ' + n + ' times');
    html = html.replace(find, replace);
  }
  return html.replaceAll('homework-hub.html', '/learn');
}

module.exports = { KEEP, PATCHES, hubRunner };
