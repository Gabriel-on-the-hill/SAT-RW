// ─────────────────────────────────────────────────────────────────
// cache-tags.test.js — a returning student must not be served last month's app.
//
//   node cache-tags.test.js
//
// Needs no jsdom. Skips cleanly outside a git checkout.
//
// There is no build step here. The `?v=YYYYMMDD` on every <script> and <link> IS
// the entire cache-busting mechanism: change a file without changing its tag and
// every browser that already has the old copy keeps it, indefinitely. Nothing
// errors. The page loads, the app runs, and it runs the old code.
//
// That is not hypothetical. On 25 Jul 2026 ELEVEN files were stale, some by
// nineteen days:
//
//   app.js                     tagged 3 Jul,  changed 22 Jul
//   progress.js                tagged 16 Jul, changed 22 Jul
//   challenge/challenge-core.js  tagged 10 Jul, changed 22 Jul
//   homework/assignments.js    tagged 14 Jul, changed 22 Jul
//   data-info-ideas.js         tagged 3 Jul,  changed 12 Jul
//   ...and six more
//
// So a student who had opened the app before 3 July was still being served the
// bank without the July Information & Ideas questions, the draw order from
// before "unseen before misses", and last week's homework plan — while the
// tutor read their results as if they were sitting the current app. Wrong
// homework, wrong questions, wrong conclusions about the student, and not one
// symptom anywhere.
//
// The convention this asserts: a file's tag is the date that file last changed.
// Bump the tag in the same commit as the file, or this fails.
//
//   1. Every ?v= tag is at least as new as the file's last commit date.
//   2. Every versioned reference points at a file that exists — a typo is a 404,
//      and a 404'd bank is a global that never defines and a page that silently
//      serves half a set.
// ─────────────────────────────────────────────────────────────────
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const APP = __dirname;

function lastCommitDate(file) {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%ad',
      '--date=format:%Y%m%d', '--', file], { cwd: APP, encoding: 'utf8' }).trim();
    return out || null;   // untracked: nothing to compare against
  } catch (e) { return undefined; }   // git missing or not a repo
}

if (lastCommitDate('AGENTS.md') === undefined) {
  console.log('SKIP — not a git checkout (see header).');
  process.exit(0);
}

const REF = /(?:src|href)="([^"?]+)\?v=(\d{8})"/g;
const htmls = fs.readdirSync(APP)
  .filter(f => f.endsWith('.html'))
  .concat(fs.readdirSync(path.join(APP, 'challenge'))
    .filter(f => f.endsWith('.html')).map(f => 'challenge/' + f));

let checked = 0;
const stale = [];
const missing = [];

for (const html of htmls) {
  const src = fs.readFileSync(path.join(APP, html), 'utf8');
  for (const m of src.matchAll(REF)) {
    const [, file, tag] = m;
    if (/^(https?:)?\/\//.test(file)) continue;      // off-site asset, not ours
    checked++;
    if (!fs.existsSync(path.join(APP, file))) {
      missing.push(`${html} -> ${file}`);
      continue;
    }
    const changed = lastCommitDate(file);
    if (changed && changed > tag) {
      stale.push(`${html} -> ${file}  tagged ${tag}, changed ${changed}`);
    }
  }
}

const fail = [];
if (!checked) fail.push('no versioned references found at all — has the ?v= convention been dropped?');
for (const m of missing) fail.push('MISSING FILE  ' + m);
for (const s of new Set(stale)) fail.push('STALE TAG     ' + s);

if (fail.length) {
  console.error(`cache-tags.test.js: ${fail.length} problem(s)\n`);
  fail.forEach(f => console.error('  ' + f));
  console.error('\nFix: set each tag to the date that file last changed (YYYYMMDD).');
  console.error('A stale tag means returning browsers keep serving the OLD file.');
  process.exit(1);
}

console.log(`cache-tags.test.js: OK — ${checked} versioned references, none stale.`);
