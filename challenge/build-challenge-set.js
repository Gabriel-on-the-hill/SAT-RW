#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────
// build-challenge-set.js — OFFLINE generator. Never shipped, never
// loaded by the app, never run in a browser.
//
//   node challenge/build-challenge-set.js Jeffrey
//
// Reads a student's real misses, selects sibling questions from the four
// banks, and emits (a) a human-review shortlist and (b) a frozen id list.
// It writes NOTHING that the app loads. A human reads the shortlist, cuts
// what doesn't belong, and pastes the reviewed ids into challenge/sets.js.
// That paste is the freeze point.
//
// ── What this generator may and may not use ──────────────────────
// MAY:  skill, ruleType, goalType, domain-level bars from the score report.
// MAY NOT: the student's progress ledger. Generation is ledger-blind, or the
//          denominator of "Mastered 9 of 28" drifts as he answers. Selection
//          is a pure function of (misses, bank, sort order). Deterministic:
//          candidates are ordered by id, never shuffled.
//
// ── Why difficulty is not a seed ─────────────────────────────────
// The Bluebook export carries no difficulty, and the labels in
// data-challenge-jeffrey-p8.js were inferred from question position. Rather
// than freeze a guess forever, every skill's quota is split across Medium
// and Hard. If we don't know which band he missed, make him master both —
// then the question stops mattering. Easy is a fallback, not a seed.
//
// ── Why domain quotas come from the bars, not the miss counts ────
// The export contains 16 of his 23 R&W misses. That sample over-represents
// Standard English Conventions (which the score report rates his 2nd
// strongest) and under-represents Information & Ideas (his weakest by far).
// Sizing by raw miss count would bake that bias in permanently. So the
// per-domain share is driven by the score report's deficit (1 - filled/total),
// and only the split WITHIN a domain follows the captured misses.
// ─────────────────────────────────────────────────────────────────
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const APP = path.join(__dirname, '..');
const BANK_FILES = ['data-craft-structure.js', 'data-expression-of-ideas.js',
                    'data-info-ideas.js', 'data-conventions.js'];

const SKILL_DOMAIN = {
    'Words in Context':                    'Craft & Structure',
    'Text Structure and Purpose':          'Craft & Structure',
    'Cross-Text Connections':              'Craft & Structure',
    'Rhetorical Synthesis':                'Expression of Ideas',
    'Transitions':                         'Expression of Ideas',
    'Central Ideas and Details':           'Information & Ideas',
    'Command of Evidence — Textual':       'Information & Ideas',
    'Command of Evidence — Quantitative':  'Information & Ideas',
    'Inferences':                          'Information & Ideas',
    'Boundaries':                          'Std. English Conv.',
    'Form, Structure, and Sense':          'Std. English Conv.',
};

const FLOOR_PER_SKILL = 2;   // every missed skill appears at least this often
const BANDS = ['Hard', 'Medium'];

// ═════════════════════════════════════════════════════════════════
// SPEC — one block per student per test. Everything here is evidence.
// ═════════════════════════════════════════════════════════════════
const STUDENTS = {
    Jeffrey: {
        setId:  'p8-rw',
        title:  'Practice 8 misses',
        source: 'SAT Practice Test 8',
        date:   '2026-07-04',
        target: 28,
        exclude: [],   // ids already committed to this student's earlier sets

        // Knowledge-and-Skills bars, 4 July 2026 score report. [filled, total]
        bars: {
            'Information & Ideas': [2, 7],
            'Craft & Structure':   [4, 7],
            'Std. English Conv.':  [5, 7],
            'Expression of Ideas': [5, 5],
        },

        // Coverage, stated so nobody forgets it.
        captured: 16,
        actualIncorrect: 23,

        // The misses are DERIVED from the debrief payload — one source of
        // truth. Edit the tags there and the seeds follow; they cannot drift.
        // (A student with only a score report and no transcribed questions
        // would instead declare an inline `misses: [{ skill, ruleType? }, …]`.)
        reviewFile: 'data-challenge-jeffrey-p8.js',
        reviewVar:  'CHALLENGE_P8',

        // Transcription errors found on 10 Jul and fixed in the debrief file.
        // Listed here only so the shortlist reminds a reviewer to re-check them.
        corrections: [
            { q: 'Q17',  fix: 'answer D → C ("emerged:"); ruleType Commas → Colon. "emerged, whereas A…, B…" leaves a comma splice.' },
            { q: 'Q20',  fix: 'answer C → A ("varied:"); ruleType Commas → Colon. "varied, while…" strands "others only six".' },
            { q: 'Q19b', fix: 'answer A → C ("works,"); skill Form/Structure/Sense → Boundaries, ruleType VTense → Commas. The sentence already prints the closing comma of the supplement.' },
        ],

        notes: [
            'The export holds 16 of 23 R&W misses. The 7 absent ones are almost certainly Information & Ideas: its bar is 2/7, yet the folder credits it with only 5 misses while Standard English Conventions (5/7) shows 6.',
            'Domain quotas therefore follow the score-report bars, not the captured miss counts.',
            'Difficulty is unknown. Each skill is split across Medium and Hard so he must master both bands.',
            'The 2 Math misses (Problem-Solving and Data Analysis) are excluded: no math bank exists here, and Michael SAT\'s Challenge_App already seeds Jeffrey on mean/median/histogram.',
        ],
    },
};

// ═════════════════════════════════════════════════════════════════
function loadBank() {
    const ctx = { console };
    vm.createContext(ctx);
    for (const f of BANK_FILES) vm.runInContext(fs.readFileSync(path.join(APP, f), 'utf8'), ctx, { filename: f });
    const names = ['questionBank_CS', 'questionBank_EOI', 'questionBank_II', 'questionBank_CON'];
    return names.reduce((all, n) => all.concat(vm.runInContext(n, ctx)), []);
}

// The misses come from the debrief payload when there is one, so the seeds and
// the questions the student is shown can never disagree. Every skill must be a
// skill this app teaches — that is what catches a stray Math question.
function resolveMisses(cfg) {
    let misses = cfg.misses;
    if (cfg.reviewFile) {
        const ctx = {};
        vm.createContext(ctx);
        vm.runInContext(fs.readFileSync(path.join(APP, cfg.reviewFile), 'utf8'), ctx, { filename: cfg.reviewFile });
        misses = vm.runInContext(cfg.reviewVar, ctx).map(q => ({ q: q.id, skill: q.skill, ruleType: q.ruleType }));
    }
    if (!misses || !misses.length) throw new Error('no misses declared');
    const strays = misses.filter(m => !SKILL_DOMAIN[m.skill]);
    if (strays.length) {
        throw new Error('miss(es) name a skill this app does not teach — remove them:\n  ' +
            strays.map(m => m.q + ' · ' + m.skill).join('\n  '));
    }
    if (cfg.captured && misses.length !== cfg.captured) {
        throw new Error('declared captured=' + cfg.captured + ' but found ' + misses.length + ' misses');
    }
    return misses;
}

// Largest-remainder apportionment: hand out `total` units across `weights`.
function apportion(total, weights) {
    const sum = weights.reduce((a, b) => a + b, 0);
    if (sum <= 0) return weights.map(() => 0);
    const exact = weights.map(w => (total * w) / sum);
    const base  = exact.map(Math.floor);
    let left    = total - base.reduce((a, b) => a + b, 0);
    exact.map((e, i) => [i, e - base[i]])
         .sort((a, b) => b[1] - a[1])
         .slice(0, left)
         .forEach(([i]) => base[i]++);
    return base;
}

// ── Quotas ───────────────────────────────────────────────────────
function computeQuotas(cfg) {
    const skills = [...new Set(cfg.misses.map(m => m.skill))];
    const missesBySkill = {};
    skills.forEach(s => { missesBySkill[s] = cfg.misses.filter(m => m.skill === s); });

    const domains = [...new Set(skills.map(s => SKILL_DOMAIN[s]))];
    const quota = {};
    skills.forEach(s => { quota[s] = FLOOR_PER_SKILL; });

    let remaining = cfg.target - skills.length * FLOOR_PER_SKILL;
    if (remaining < 0) throw new Error('target too small for ' + skills.length + ' skills');

    // Share by score-report deficit; fall back to miss count if every bar is full.
    let weights = domains.map(d => {
        const b = cfg.bars[d];
        return b ? 1 - b[0] / b[1] : 1;
    });
    if (weights.every(w => w === 0)) weights = domains.map(d => skills.filter(s => SKILL_DOMAIN[s] === d).length);

    const perDomain = apportion(remaining, weights);

    domains.forEach((d, di) => {
        const inD = skills.filter(s => SKILL_DOMAIN[s] === d);
        const add = apportion(perDomain[di], inD.map(s => missesBySkill[s].length));
        inD.forEach((s, i) => { quota[s] += add[i]; });
    });
    return { quota, missesBySkill, skills };
}

// Split a skill's quota across ruleTypes he actually missed, then across bands.
function splitSkill(skill, n, misses) {
    const rules = misses.map(m => m.ruleType).filter(Boolean);
    const slots = [];
    if (rules.length) {
        const uniq = [...new Set(rules)];
        const per  = apportion(n, uniq.map(r => rules.filter(x => x === r).length));
        uniq.forEach((r, i) => { for (let k = 0; k < per[i]; k++) slots.push(r); });
    } else {
        for (let k = 0; k < n; k++) slots.push(null);
    }
    // Alternate Hard, Medium, Hard, … so an odd quota leans Hard.
    return slots.map((r, i) => ({ ruleType: r, difficulty: BANDS[i % 2] }));
}

// ── Selection with the fallback ladder ───────────────────────────
// 1. skill + difficulty + ruleType
// 2. skill + difficulty            (drop ruleType)
// 3. skill + other band            (Medium <-> Hard)
// 4. skill + Easy
// 5. under-fill, loudly.  Never substitute across skills.
function pick(bank, slot, skill, used) {
    const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);   // deterministic
    const other = slot.difficulty === 'Hard' ? 'Medium' : 'Hard';
    const ladders = [
        { why: 'exact',      f: q => q.difficulty === slot.difficulty && (!slot.ruleType || q.ruleType === slot.ruleType) },
        { why: 'no-rule',    f: q => q.difficulty === slot.difficulty },
        { why: 'other-band', f: q => q.difficulty === other && (!slot.ruleType || q.ruleType === slot.ruleType) },
        { why: 'any-band',   f: q => q.difficulty === other },
        { why: 'easy',       f: q => q.difficulty === 'Easy' },
    ];
    const pool = bank.filter(q => q.skill === skill && !used.has(q.id));
    for (const rung of ladders) {
        const c = pool.filter(rung.f).sort(byId);
        if (c.length) { used.add(c[0].id); return { q: c[0], via: rung.why }; }
    }
    return null;
}

// ═════════════════════════════════════════════════════════════════
function build(name) {
    const cfg = STUDENTS[name];
    if (!cfg) { console.error('unknown student: ' + name); process.exit(1); }
    const bank = loadBank();
    cfg.misses = resolveMisses(cfg);
    const used = new Set(cfg.exclude);
    const { quota, missesBySkill, skills } = computeQuotas(cfg);

    const chosen = [], shortfall = [];
    skills.forEach(skill => {
        splitSkill(skill, quota[skill], missesBySkill[skill]).forEach(slot => {
            const got = pick(bank, slot, skill, used);
            if (got) chosen.push({ ...got.q, _via: got.via, _want: slot });
            else shortfall.push({ skill, slot });
        });
    });

    // ── report ───────────────────────────────────────────────────
    const byDomain = {};
    chosen.forEach(q => { const d = SKILL_DOMAIN[q.skill]; (byDomain[d] = byDomain[d] || []).push(q); });

    const L = [];
    L.push('# ' + name + ' — ' + cfg.title + ' — review shortlist', '');
    L.push('Source: **' + cfg.source + '**, ' + cfg.date + '. Set id `' + cfg.setId + '`.', '');
    L.push('Auto-selected **' + chosen.length + '** questions from ' + bank.length + ' in the banks. ' +
           'Cut anything that is not the intended type, then paste the reviewed ids into `challenge/sets.js`.', '');
    L.push('> **Coverage: ' + cfg.captured + ' of ' + cfg.actualIncorrect + ' R&W misses were captured.** ' +
           'Domain quotas are sized from the score-report bars, not the captured counts.', '');

    if (cfg.reviewFile) L.push('Seeds derived from `' + cfg.reviewFile + '` (' + cfg.misses.length + ' misses). Edit the tags there, not here.', '');

    if ((cfg.corrections || []).length) {
        L.push('## ⚠ Transcription corrections already applied — re-check them', '');
        L.push('| Q | what changed |', '|---|---|');
        cfg.corrections.forEach(c => L.push('| ' + c.q + ' | ' + c.fix + ' |'));
        L.push('');
    }

    L.push('## Notes', '');
    cfg.notes.forEach(n => L.push('- ' + n));
    L.push('');

    L.push('## Quotas', '', '| domain | bar | deficit | skill | misses | quota |', '|---|:--:|:--:|---|:--:|:--:|');
    Object.keys(byDomain).sort().forEach(d => {
        const b = cfg.bars[d];
        const def = b ? (100 - Math.round(b[0] / b[1] * 100)) + '%' : '—';
        skills.filter(s => SKILL_DOMAIN[s] === d).forEach((s, i) => {
            L.push('| ' + (i === 0 ? d : '') + ' | ' + (i === 0 && b ? b[0] + '/' + b[1] : '') + ' | ' + (i === 0 ? def : '') +
                   ' | ' + s + ' | ' + missesBySkill[s].length + ' | **' + quota[s] + '** |');
        });
    });
    L.push('');

    L.push('## Selected', '', '| keep | id | domain | skill | diff | ruleType | via |', '|:---:|---|---|---|:--:|---|---|');
    chosen.slice().sort((a, b) => (SKILL_DOMAIN[a.skill] + a.skill + a.difficulty).localeCompare(SKILL_DOMAIN[b.skill] + b.skill + b.difficulty))
        .forEach(q => L.push('| [ ] | `' + q.id + '` | ' + SKILL_DOMAIN[q.skill] + ' | ' + q.skill + ' | ' + q.difficulty +
                             ' | ' + (q.ruleType || '—') + ' | ' + (q._via === 'exact' ? '' : '⚠ ' + q._via) + ' |'));
    L.push('');

    if (shortfall.length) {
        L.push('## ⚠ Under-filled — the bank could not satisfy these slots', '');
        shortfall.forEach(s => L.push('- ' + s.skill + ' · ' + s.slot.difficulty + (s.slot.ruleType ? ' · ' + s.slot.ruleType : '')));
        L.push('');
    }

    const ids = chosen.map(q => q.id);
    L.push('## Frozen ids — paste into `challenge/sets.js` after review', '', '```js', 'ids: [',
        ...chunk(ids, 4).map(row => '    ' + row.map(i => "'" + i + "'").join(', ') + ','), '],', '```', '');

    const slPath = path.join(__dirname, 'shortlist-' + name.toLowerCase() + '-' + cfg.setId + '.md');
    fs.writeFileSync(slPath, L.join('\n'), 'utf8');

    // ── console summary ──────────────────────────────────────────
    console.log('\n=== ' + name + ' · ' + cfg.setId + ' ===');
    console.log('  bank            : ' + bank.length);
    console.log('  coverage        : ' + cfg.captured + '/' + cfg.actualIncorrect + ' R&W misses captured');
    console.log('  selected        : ' + chosen.length + ' / target ' + cfg.target);
    console.log('  duplicates      : ' + (new Set(ids).size === ids.length ? 'none' : 'YES — BUG'));
    console.log('  fallbacks used  : ' + chosen.filter(q => q._via !== 'exact').length +
                (shortfall.length ? '   under-filled: ' + shortfall.length : ''));
    console.log('  by domain       :');
    Object.keys(byDomain).sort().forEach(d => {
        const b = cfg.bars[d];
        console.log('      ' + d.padEnd(22) + String(byDomain[d].length).padStart(2) + '   (bar ' + (b ? b[0] + '/' + b[1] : '—') + ')');
    });
    console.log('  by skill        :');
    skills.forEach(s => {
        const got = chosen.filter(q => q.skill === s);
        const bands = BANDS.map(b => b[0] + ':' + got.filter(q => q.difficulty === b).length).join(' ');
        console.log('      ' + s.padEnd(34) + String(got.length).padStart(2) + '   ' + bands);
    });
    console.log('\n  shortlist       : ' + path.relative(APP, slPath));
    console.log('  → review it, then paste the ids block into challenge/sets.js. That paste is the freeze point.\n');
}

function chunk(a, n) { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; }

build(process.argv[2] || 'Jeffrey');
