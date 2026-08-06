// ─────────────────────────────────────────────────────────────────
// explain.js — stage 6 of the extraction pipeline: build an explanation.
//
//   node tools/explain.js --self-test          # run it on stage 2's own output
//   node tools/explain.js questions.json       # annotate a batch, JSON to stdout
//
// WHAT THIS IS FOR
//   The grammar book's answer key is bare letters. No explanations exist to
//   extract, so they have to be built. The tutor settled (25 Jul) that no
//   hand-written per-question line is affordable at ~160 questions.
//
//   This produces one anyway, WITHOUT inventing reasoning, in three parts:
//
//     1. THE DERIVED LINE — question-specific, computed. On a conventions item
//        the four choices are the same words differing at one point, so diffing
//        them yields the exact decision: "all four differ only in what follows
//        'supplies'." On a transitions item the four choices are four different
//        relationship words, so each one's category names what picking it would
//        assert. Nothing here is authored; it falls out of the options.
//
//     2. THE RULE — the house rule prose, loaded from sec.html and
//        transitions.html AT RUNTIME. Never copied into this file. A second copy
//        of the rule is a second version of the truth, and within a month nobody
//        knows which is current.
//
//     3. THE ANSWER — which choice the key gives.
//
//   What it deliberately does NOT do is argue why the right answer is right in
//   this particular sentence. That is the one part that needs judgement, and the
//   grammar book gives no independent check on it — the key is a letter. Handing
//   the student the exact decision point plus the diagnostic to apply is honest;
//   inventing the reasoning and being wrong teaches them their own correct
//   thinking was mistaken, which is the worst outcome this bank can produce.
//
//   The Critical Reader needs none of this. Its key carries a written
//   explanation per question — use those directly and do not call this.
//
// PLAIN TEXT, NOT HTML
//   Every place `explanation` reaches a student it goes through textContent,
//   esc() or innerText — homework-run.html:496 and :630, homework-run.js:624,
//   app.js:1009. The rule prose in sec.html is full of <strong> and &mdash;, so
//   this strips tags and decodes entities. Emit HTML here and the student reads
//   the markup.
// ─────────────────────────────────────────────────────────────────
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const APP = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');

// ── the rule prose, loaded from the note modules ─────────────────────────────
// `const X = [...]` inside a page is a lexical binding, NOT a property of the
// context — the same quirk AGENTS.md documents for the question banks. So the
// arrays are pulled out by name and re-exported with an assignment.
function evalArray(html, name) {
    const m = html.match(new RegExp('const ' + name + ' = \\[[\\s\\S]*?\\n\\];'));
    if (!m) throw new Error('could not find `const ' + name + '` — has the note module changed shape?');
    const ctx = {};
    vm.createContext(ctx);
    vm.runInContext(m[0] + '\n__out = ' + name + ';', ctx);
    return ctx.__out;
}

const ENTITIES = {
    mdash: '—', ndash: '–', hellip: '…', rarr: '→',
    apos: "'", amp: '&', lt: '<', gt: '>', nbsp: ' ', quot: '"',
    lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
};
function plain(s) {
    return String(s == null ? '' : s)
        .replace(/<[^>]+>/g, '')
        .replace(/&([a-zA-Z]+);/g, (m, n) => (n in ENTITIES ? ENTITIES[n] : m))
        .replace(/&#(\d+);/g, (m, d) => String.fromCharCode(+d))
        .replace(/\s+/g, ' ')
        .trim();
}

// ruleType as written in the bank -> the `key` used in sec.html
const RULE_KEY = {
    Commas: 'commas', Semi: 'semi', Colon: 'colon', Dash: 'dash', NoPunct: 'nopunct',
    SVA: 'sva', VForm: 'vform', VTense: 'vtense', Pron: 'pron', Poss: 'poss', Mod: 'mod',
};

let _rules = null, _trans = null;
function rules() {
    if (_rules) return _rules;
    const sec = read('sec.html');
    _rules = {};
    for (const b of [...evalArray(sec, 'BOUNDARIES'), ...evalArray(sec, 'FSS')]) _rules[b.key] = b;
    return _rules;
}
// transitions.html holds the TEACHING core — the words a student is drilled on,
// not every transition the SAT can print. Extending it there would change a
// student-facing page for a tooling need, so the rest of the tested lexicon
// lives here, mapped onto the same five category names. This is reference data,
// not a second copy of a rule: if a word is in both, the note module wins.
const EXTRA_TRANSITIONS = {
    CONTRAST: ['nevertheless', 'nonetheless', 'alternatively', 'conversely', 'instead',
        'rather', 'still', 'yet', 'although', 'though', 'even so', 'despite this',
        'in spite of this', 'on the contrary', 'on the other hand', 'regardless',
        'notwithstanding', 'whereas', 'while'],
    CONTINUATION: ['moreover', 'furthermore', 'additionally', 'in addition', 'also',
        'likewise', 'similarly', 'indeed', 'in fact', 'besides', 'further', 'what is more',
        'equally', 'as well'],
    'CAUSE – EFFECT': ['therefore', 'thus', 'hence', 'consequently', 'accordingly',
        'as a result', 'for this reason', 'so', 'because of this', 'then'],
    'EXAMPLE / SPECIFICATION': ['for example', 'for instance', 'specifically',
        'in particular', 'to illustrate', 'namely', 'that is', 'in other words',
        'particularly', 'notably'],
    SEQUENCE: ['first', 'second', 'third', 'next', 'finally', 'meanwhile', 'subsequently',
        'previously', 'earlier', 'later', 'afterward', 'afterwards', 'eventually',
        'ultimately', 'in the meantime', 'to begin with'],
};

function transitions() {
    if (_trans) return _trans;
    _trans = new Map();
    for (const [cat, words] of Object.entries(EXTRA_TRANSITIONS)) {
        for (const w of words) _trans.set(norm(w), { category: pretty(cat), signal: '' });
    }
    // the note module wins on any word it also defines
    for (const cat of evalArray(read('transitions.html'), 'CATEGORIES')) {
        for (const it of (cat.items || [])) {
            _trans.set(norm(it.word), { category: pretty(plain(cat.title)), signal: plain(it.signal) });
        }
    }
    return _trans;
}

const pretty = t => plain(t).toLowerCase()
    .replace(/\s*[–—-]\s*/g, ' and ')          // "CAUSE – EFFECT" -> "cause and effect"
    .replace(/\s*\/\s*/g, ' or ');             // "EXAMPLE / SPECIFICATION"

// ── option helpers ───────────────────────────────────────────────────────────
const LETTER = /^\s*[A-D][.):]\s*/;          // the bank stores "A. text"; stage 2 does not
const strip = s => String(s || '').replace(LETTER, '').trim();
const norm = s => strip(s).toLowerCase().replace(/[^a-z' -]+/g, '').replace(/\s+/g, ' ').trim();
const LETTERS = ['A', 'B', 'C', 'D'];

const WORDC = c => /[A-Za-z0-9']/.test(c || '');
function commonPrefix(list) {
    let i = 0;
    outer: for (; i < list[0].length; i++) {
        for (const s of list) if (s[i] !== list[0][i]) break outer;
    }
    // Back off ONLY when the split lands inside a word. Backing off to the
    // nearest whitespace instead ate the anchor: the choices share "supplies"
    // and diverge at the punctuation straight after it, so the common prefix
    // ends at a perfectly good word boundary with no space before it, and a
    // whitespace test unwound the whole prefix to zero. That alone cost this
    // branch nearly every conventions question it was written for.
    while (i > 0 && WORDC(list[0][i - 1]) && WORDC(list[0][i])) i--;
    return i;
}
function commonSuffix(list, from) {
    let i = 0;
    const room = Math.min(...list.map(s => s.length - from));
    outer: for (; i < room; i++) {
        const c = list[0][list[0].length - 1 - i];
        for (const s of list) if (s[s.length - 1 - i] !== c) break outer;
    }
    while (i > 0 && !/\s/.test(list[0][list[0].length - i])) i--;
    return i;
}

const PUNCT_NAME = [
    [/;/, 'a semicolon'], [/:/, 'a colon'], [/—|--| - /, 'a dash'],
    [/\./, 'a full stop'], [/,/, 'a comma'],
];
function describeGap(gap) {
    const t = gap.trim();
    if (!t) return 'nothing';
    const marks = PUNCT_NAME.filter(([re]) => re.test(t)).map(([, n]) => n);
    const words = t.replace(/[^A-Za-z' -]+/g, ' ').trim();
    if (marks.length && !words) return marks.length > 1 ? marks.join(' and ') : marks[0];
    if (!marks.length && words) return '"' + words + '"';
    return '"' + t + '"';
}

// ── 1. the derived, question-specific line ───────────────────────────────────
function derivedLine(options, ruleType) {
    const o = options.map(strip);
    if (o.length !== 4 || o.some(x => !x)) return null;

    // (a) transitions: four short standalone words, each naming a relationship.
    // ALL FOUR must be known. An earlier version described the ones it knew and
    // wrote "D is not a standard transition" for the rest — which was not true,
    // only unknown to our list, and a false sentence in an explanation is the
    // one thing this bank must never ship. Unknown words fail the whole line and
    // are reported by --self-test so the lexicon can be extended once.
    if (o.every(x => x.length <= 24)) {
        const cats = o.map(x => transitions().get(norm(x)));
        if (cats.every(Boolean)) {
            const named = o.map((x, i) => LETTERS[i] + ' signals ' + cats[i].category);
            const distinct = new Set(cats.map(c => c.category)).size;
            return 'All four choices are transitions, and they do not assert the same thing: '
                 + named.join('; ') + '. '
                 + (distinct === 1
                    ? 'They fall in one category, so the decision is which shade of it the text needs.'
                    : 'Decide what the text does between the two sentences before choosing.');
        }
    }

    // (c) four short alternatives that are not transitions — pronouns, verb
    // forms, possessives. There is no shared sentence to diff because the
    // underlined portion IS the choice, so the specific line comes from the
    // ruleType instead. Needs stage 6 to have classified it; until then this
    // branch is silent, which is why --self-test reports it separately.
    const NOUN = {
        Pron: 'pronouns', Poss: 'possessive forms', VForm: 'verb forms',
        VTense: 'verb tenses', SVA: 'verbs', Mod: 'openings',
    };
    if (ruleType && NOUN[ruleType] && o.every(x => x.length <= 24)
        && new Set(o.map(norm)).size === 4) {
        return 'The four choices are four different ' + NOUN[ruleType] + ': '
             + o.map((x, i) => LETTERS[i] + ' "' + x + '"').join(', ')
             + '. The sentence around them decides which one is possible.';
    }

    // (b) conventions: one sentence differing at a single point
    const p = commonPrefix(o);
    const s = commonSuffix(o, p);
    if (p >= 4) {
        const anchor = o[0].slice(0, p).trim().split(/\s+/).slice(-1)[0];
        let gaps = o.map(x => x.slice(p, x.length - s));
        if (gaps.every(g => g.length)) {
            const gp = commonPrefix(gaps), gs = commonSuffix(gaps, gp);
            const trimmed = gaps.map(g => g.slice(gp, g.length - gs));
            if (trimmed.some(t => t.trim())) gaps = trimmed;
        }
        const uniq = new Set(gaps.map(g => g.trim()));
        if (uniq.size >= 3) {
            const leads = gaps.map(g => (g.match(/^[^A-Za-z0-9]*/) || [''])[0].replace(/\s+/g, ''));
            const useLead = new Set(leads).size >= 3;
            const listed = gaps.map((g, i) => LETTERS[i] + ' '
                + describeGap(useLead ? leads[i] : g)).join(', ');
            return 'The four choices are the same words. They differ only in what comes after "'
                 + anchor + '": ' + listed + '.';
        }
    }
    return null;
}

// ── 2 + 3. assemble ──────────────────────────────────────────────────────────
function explain(q) {
    const parts = [];
    const line = derivedLine(q.options || [], q.ruleType);
    if (line) parts.push(line);

    const block = rules()[RULE_KEY[q.ruleType]];
    if (block) {
        parts.push(plain(block.rule));
        if (block.diagnostic) {
            const d = plain(block.diagnostic);
            // Strip any leading "Ask:" and re-add exactly one, so this stays
            // idempotent however the note module is edited later. An earlier
            // version tested /^ask/ and a stray 0x08 byte landed in the
            // pattern, which no grep or sed rendered visibly.
            parts.push('Ask: ' + d.replace(/^\s*ask\s*:\s*/i, ''));
        }
    } else if (line && /transitions/.test(line)) {
        const idx = LETTERS.indexOf(q.answer);
        const c = idx >= 0 ? transitions().get(norm((q.options || [])[idx])) : null;
        if (c) parts.push(c.signal);
    }

    const idx = LETTERS.indexOf(q.answer);
    if (idx >= 0 && (q.options || [])[idx]) {
        parts.push('The answer is ' + q.answer + ', "' + strip(q.options[idx]) + '".');
    }
    const out = parts.join(' ');
    return { explanation: out, derived: !!line, hasRule: !!block, ok: parts.length >= 2 };
}

// ── CLI ──────────────────────────────────────────────────────────────────────
function selfTest() {
    const seg = p => JSON.parse(fs.readFileSync(path.join(APP, '_extract', 'segments', p), 'utf8'));
    let inv = {};
    try {
        for (const b of JSON.parse(fs.readFileSync(path.join(APP, '_extract', 'inventory.json'), 'utf8')))
            if (b.key === 'grammar') for (const p of b.page_detail) inv[p.page] = p.label;
    } catch (e) { console.log('(_extract/inventory.json missing — not filtering to keyed pages)'); }

    let qs;
    try { qs = seg('grammar.json').questions; }
    catch (e) { console.log('SKIP — run tools/segment_pages.py first.'); return; }

    // The tutor's decision: keyed exercise pages only.
    qs = qs.filter(q => (!Object.keys(inv).length || inv[q.page] === 'exercise')
                     && q.n_options === 4 && q.options.every(o => o.text));

    let derived = 0, shown = 0;
    const unknown = new Map();      // near-miss transition words, so the gap is fixable
    console.log('grammar, keyed pages, four clean options: ' + qs.length + '\n');
    for (const q of qs) {
        const opts = q.options.map(o => o.text);
        // stage 4 supplies `answer`; stand in with position 1 so the shape is visible
        const r = explain({ options: opts, answer: 'A', ruleType: q.ruleType || null });
        if (r.derived) derived++;
        else if (opts.every(x => strip(x).length <= 24)) {
            for (const x of opts) {
                if (!transitions().get(norm(x))) unknown.set(norm(x), (unknown.get(norm(x)) || 0) + 1);
            }
        }
        if (r.derived && shown < 5) {
            shown++;
            console.log('  ' + q.qid + '  (printed p.' + q.printed + ')');
            console.log('    options : ' + opts.map(o => o.slice(0, 32)).join(' | '));
            console.log('    derived : ' + derivedLine(opts) + '\n');
        }
    }
    console.log('derived line produced for ' + derived + ' of ' + qs.length
                + ' (' + Math.round(100 * derived / Math.max(1, qs.length)) + '%)');
    console.log('rule blocks loaded: ' + Object.keys(rules()).length + ' — '
                + Object.keys(rules()).join(', '));
    console.log('transition words known: ' + transitions().size);
    if (unknown.size) {
        // Two different things end up here and they have different remedies.
        // A word with a dropped leading letter ("ndeed" for "Indeed", "n contrast"
        // for "In contrast") is OCR damage, and stage 3's visual read fixes it —
        // nothing to add to the lexicon. A pronoun or verb form is not a
        // transition at all and is waiting on stage 6 to classify its ruleType.
        const damaged = [...unknown].filter(([w]) => transitions().get('i' + w)
                                                   || transitions().get('l' + w));
        const other = [...unknown].filter(([w]) => !damaged.some(d => d[0] === w));
        const sum = a => a.reduce((n, [, c]) => n + c, 0);
        console.log('\nwhy the rest have no derived line yet:');
        console.log('  ' + sum(damaged) + ' option words look like OCR dropped a leading letter ('
                    + damaged.slice(0, 4).map(([w]) => JSON.stringify(w)).join(', ')
                    + ') — STAGE 3 fixes these, nothing to add here');
        console.log('  ' + sum(other) + ' are not transitions at all ('
                    + other.slice(0, 6).map(([w]) => JSON.stringify(w)).join(', ')
                    + ') — these need ruleType, which STAGE 6 assigns; branch (c) then covers them');
        console.log('\nSo 47% is the floor measured on damaged drafts with no ruleType,');
        console.log('not the coverage this will have when it actually runs.');
    }
}

if (require.main === module) {
    const arg = process.argv[2];
    if (!arg || arg === '--self-test') selfTest();
    else {
        const qs = JSON.parse(fs.readFileSync(arg, 'utf8'));
        console.log(JSON.stringify(qs.map(q => Object.assign({}, q, { explanation: explain(q).explanation })), null, 1));
    }
}

module.exports = { explain, derivedLine, plain, rules, transitions };
