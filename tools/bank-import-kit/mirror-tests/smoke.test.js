// Smoke-test for the search page.
//
// verify.py checks the DATA. This checks the PAGE — that the banks actually reach
// the screen, which is a separate failure and the one that bites in silence: the
// -ext files append themselves via `questionBank_X.push(...)`, so a missing or
// mis-ordered <script> tag drops 238 questions with no error anywhere. The count in
// the header would just read 571 and look completely normal.
//
// Run it:
//     npm install jsdom --prefix /tmp/j
//     NODE_PATH=/tmp/j/node_modules node smoke.test.js
//
// jsdom prints "Not implemented: Window's scrollTo()" a few times. That is jsdom,
// not the page.

const { JSDOM } = require('jsdom');
const path = require('path');

const DIR = __dirname;
let fails = 0;
function ok(name, cond, detail) {
  console.log(`${cond ? '  ok  ' : '  FAIL'} ${name}${detail ? '  — ' + detail : ''}`);
  if (!cond) fails++;
}

const dom = new JSDOM(require('fs').readFileSync(path.join(DIR, 'index.html'), 'utf8'), {
  runScripts: 'dangerously',
  resources: undefined,
  url: 'https://example.test/',
});
const { window } = dom;
const { document } = window;

// jsdom does not fetch <script src>. Concatenate the banks and the inline module into
// ONE eval: `const questionBank_X = [...]` is a lexical binding, so a per-file eval
// would give each file its own scope and the -ext files' push() would find nothing.
// A browser's classic scripts share one global lexical scope; this reproduces that.
const srcs = [...document.querySelectorAll('script[src]')]
  .map(el => require('fs').readFileSync(path.join(DIR, el.getAttribute('src').split('?')[0]), 'utf8'));
const inline = [...document.querySelectorAll('script:not([src])')].pop().textContent;
// A probe, because those consts are not properties of window (see AGENTS.md).
const probe = `window.__banks = { CON: questionBank_CON, CS: questionBank_CS,
  EOI: questionBank_EOI, II: questionBank_II };`;
window.eval(srcs.join('\n;\n') + '\n;\n' + probe + '\n;\n' + inline);
const BANK = window.__banks;

const $count = document.getElementById('count');
const $search = document.getElementById('search');

ok('all four core banks loaded', BANK.CON && BANK.CS &&
   BANK.EOI && BANK.II);

const total = BANK.CON.length + BANK.CS.length +
              BANK.EOI.length + BANK.II.length;
// Read every configured bank file independently of the page's script tags.
const bankContext = require('vm').createContext({});
['craft-structure', 'expression-of-ideas', 'info-ideas', 'conventions'].forEach(name => {
  ['', '-ext'].forEach(suffix => require('vm').runInContext(require('fs').readFileSync(path.join(DIR, `data-${name}${suffix}.js`), 'utf8'), bankContext));
});
const expectedIds = Array.from(require('vm').runInContext('[...questionBank_CS, ...questionBank_EOI, ...questionBank_II, ...questionBank_CON].map(q => q.id).sort()', bankContext));
const questions = Object.values(BANK).flat();
const provisional = questions.filter(q => q.difficultyStatus === 'provisional').length;
ok('every bank question reaches the page', JSON.stringify(questions.map(q => q.id).sort()) === JSON.stringify(expectedIds), `got ${total}`);
ok('header reports the bank total', $count.textContent.includes(`${total} questions`), $count.textContent);

const cards = document.querySelectorAll('.card');
ok('first page renders 30 cards', cards.length === 30, `got ${cards.length}`);
ok('load-more button present', !!document.getElementById('load-more'));

// A chart question must render its <img>, and the src must point at a file we copied.
const fs = require('fs');
const withImage = BANK.II.find(q => q.image);
ok('a chart question exists', !!withImage, withImage && withImage.id);
ok('its image file is on disk', withImage && fs.existsSync(path.join(DIR, withImage.image)),
   withImage && withImage.image);

// Search for that question's stem, then confirm the rendered card carries the figure.
$search.value = withImage.question.slice(0, 40);
$search.dispatchEvent(new window.Event('input'));
// the input handler debounces 80ms
setTimeout(() => {
  const figs = document.querySelectorAll('.card .figure img');
  ok('search result renders the figure', figs.length > 0, `${figs.length} <img>`);

  // Provisional filter.
  $search.value = '';
  $search.dispatchEvent(new window.Event('input'));
  setTimeout(() => {
    const chip = document.querySelector('.chip[data-origin="provisional"]');
    ok('provisional chip exists', !!chip);
    chip.dispatchEvent(new window.Event('click', { bubbles: true }));
    setTimeout(() => {
      ok('provisional filter matches the current bank', $count.textContent === `${provisional} of ${total}`, $count.textContent);
      const badges = document.querySelectorAll('.card .tag-prov');
      const shown = document.querySelectorAll('.card').length;
      ok('every provisional card is badged', badges.length === shown, `${badges.length}/${shown}`);
      ok('url carries the filter', window.location.search.includes('origin=provisional'),
         window.location.search);

      const conf = document.querySelector('.chip[data-origin="confirmed"]');
      chip.dispatchEvent(new window.Event('click', { bubbles: true }));
      conf.dispatchEvent(new window.Event('click', { bubbles: true }));
      setTimeout(() => {
        ok('confirmed filter matches the current bank', $count.textContent === `${total - provisional} of ${total}`, $count.textContent);
        ok('no confirmed card is badged', document.querySelectorAll('.card .tag-prov').length === 0);

        const aliasQuestion = Object.values(BANK).flat()
          .find(q => q.difficultyStatus !== 'provisional' && q.altIds && q.altIds.length);
        $search.value = aliasQuestion.altIds[0];
        $search.dispatchEvent(new window.Event('input'));
        setTimeout(() => {
          ok('a retired id finds its canonical question', $count.textContent === `1 of ${total}`, $count.textContent);
          ok('the result displays the canonical id',
             document.querySelector('.tag-id').textContent.includes(aliasQuestion.id));

          // The stale copy truncated options mid-sentence; the refreshed one must not.
          const eoi = BANK.EOI.find(q => /Lost Apple Project/.test((q.options || []).join(' ')));
          ok('truncated option text is repaired', eoi && /mid-1900s\./.test(eoi.options[0]),
             eoi && eoi.options[0].slice(-30));

          console.log(fails ? `\n${fails} FAILED` : '\nall passed');
          process.exit(fails ? 1 : 0);
        }, 150);
      }, 150);
    }, 150);
  }, 150);
}, 150);
