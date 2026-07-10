// ─────────────────────────────────────────────────────────────────
// challenge.js — the Challenge module's UI. Load AFTER app.js.
//
// Additive: it edits no existing file. It injects its own hub tile and its
// own screen, and it wraps four of app.js's screen functions rather than
// modifying them. The drill itself runs on the shared engine via
// launchSession(), so the challenge inherits Assisted mode, the split-pane,
// strategy hints, trap analytics, resume and per-question timing for free.
//
// ── Two layers ───────────────────────────────────────────────────
//   Layer 1  the debrief — the verbatim questions he missed on the test.
//            UNSCORED. Never calls recordAnswer. Its ids are in no bank.
//   Layer 2  the challenge set — frozen bank questions, siblings of those
//            misses. Scored through the shared mastery ledger.
//
// ── The exam-mode guard ──────────────────────────────────────────
// app.js records `userMode === 'exam' ? 'exam' : 'practice'`, and progress.js
// gives an exam-sourced correct answer DOUBLE credit (`correct += 2`). Since
// mastery is `correct >= 2`, one correct answer in Exam mode masters a
// never-seen question. The header's mode dropdown can be changed mid-session.
// So for the length of a challenge session we disable the Exam option and pin
// userMode to 'assisted'. Without this the whole 28 can be "mastered" in one
// pass, and the denominator we froze becomes meaningless.
//
// ── Why there is no in-session requeue ───────────────────────────
// launchSession() takes a fixed array. A question therefore cannot come back
// within a single session, so no question can be mastered in one sitting —
// two clean corrects means two passes. That is the two-stage design falling
// out for free: pass one drives everything to correct-once-or-better, the
// confirm pass promotes it to mastered. ChallengeCore.requeue() exists for a
// future in-session loop; this UI does not need it.
// ─────────────────────────────────────────────────────────────────

(function () {
    'use strict';

    if (typeof ChallengeCore === 'undefined' || !window.CHALLENGE_SETS) return;
    var CC = ChallengeCore;

    var state = { set: null, questions: [], missing: [], sessionActive: false, modeLocked: false, guardWired: false };

    function $(id) { return document.getElementById(id); }
    function studentName() { try { return sessionStorage.getItem('mastery_user') || ''; } catch (e) { return ''; } }
    function ledger() { return (typeof getProgress === 'function') ? getProgress() : {}; }
    function theBank() { return (typeof questionBank !== 'undefined') ? questionBank : []; }
    function counts() { return CC.counts(state.questions, ledger()); }
    function budget() { return (window.MasteryConfig && MasteryConfig.getQuestionBudget()) || 100; }
    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function blanks(s) {
        return esc(s).replace(/_{4,}/g,
            '<span style="background:#dbeafe;padding:0 2px;border-radius:3px;font-weight:700">______</span>');
    }

    // ── The exam-mode guard ──────────────────────────────────────
    function lockMode() {
        var sel = $('modeSelect');
        if (!sel) return;
        var opt = sel.querySelector('option[value="exam"]');
        if (opt) { opt.disabled = true; opt.hidden = true; }
        sel.value = 'assisted';
        try { userMode = 'assisted'; } catch (e) {}
        state.modeLocked = true;
        if (!state.guardWired) {          // wired late, so it runs after app.js's own listener
            state.guardWired = true;
            sel.addEventListener('change', function () {
                if (!state.modeLocked || sel.value !== 'exam') return;
                sel.value = 'assisted';
                try { userMode = 'assisted'; } catch (e) {}
            });
        }
    }
    function unlockMode() {
        state.modeLocked = false;
        var sel = $('modeSelect');
        if (!sel) return;
        var opt = sel.querySelector('option[value="exam"]');
        if (opt) { opt.disabled = false; opt.hidden = false; }
    }
    function endChallengeSession() { state.sessionActive = false; unlockMode(); }

    // ── Styles ───────────────────────────────────────────────────
    function injectCss() {
        if ($('challenge-css')) return;
        var st = document.createElement('style');
        st.id = 'challenge-css';
        st.textContent = [
            '.hub-quick-challenge{grid-column:1/-1;order:-1;border-color:#c4b5fd}',
            '.hub-quick-challenge:hover{border-color:#7c3aed}',
            '#challengeScreen{position:fixed;inset:0;background:var(--background,#f5f7fa);z-index:500;overflow-y:auto;padding:1.5rem 1rem;display:none}',
            '#challengeScreen .cwrap{max-width:680px;margin:0 auto}',
            '#challengeScreen h1{font-size:1.6rem;font-weight:700;margin-bottom:.15rem}',
            '#challengeScreen .csrc{color:var(--text-muted,#64748b);font-size:.85rem;margin-bottom:1.1rem}',
            '.ctally{background:var(--surface,#fff);border:2px solid var(--border,#e2e8f0);border-radius:1rem;padding:1.15rem 1.25rem;margin-bottom:1rem}',
            '.ctally .big{font-size:1.35rem;font-weight:700}',
            '.ctally .pctbar{height:8px;border-radius:99px;background:#e2e8f0;overflow:hidden;margin:.7rem 0}',
            '.ctally .pctbar i{display:block;height:100%;background:#7c3aed}',
            '.cchips{display:flex;flex-wrap:wrap;gap:.4rem}',
            '.cchip{font-size:.75rem;font-weight:600;padding:.2rem .55rem;border-radius:99px;background:#f1f5f9;color:#475569}',
            '.cchip.w{background:#fee2e2;color:#b91c1c}.cchip.m{background:#dcfce7;color:#15803d}.cchip.c{background:#fef3c7;color:#92400e}',
            '.cnote{font-size:.8rem;color:var(--text-muted,#64748b);line-height:1.45;margin-bottom:1rem}',
            '.cbanner{background:#fee2e2;border:1px solid #fca5a5;color:#7f1d1d;border-radius:.6rem;padding:.7rem .85rem;font-size:.85rem;margin-bottom:1rem}',
            '.cmsg{background:#f1f5f9;border-radius:.7rem;padding:.85rem 1rem;font-size:.9rem;margin-bottom:1rem}',
            '.cmsg.ok{background:#dcfce7}',
            '.cbox{background:var(--surface,#fff);border:2px solid var(--border,#e2e8f0);border-radius:1rem;padding:1.15rem 1.25rem;margin-bottom:1rem}',
            '.cbox label{display:block;font-size:.85rem;font-weight:600;margin-bottom:.35rem}',
            '.cbox input[type=number]{width:6rem;padding:.45rem .6rem;border:1.5px solid var(--border,#e2e8f0);border-radius:.5rem;font-family:inherit;font-size:1rem}',
            '.cbox .chk{display:flex;align-items:center;gap:.45rem;margin-top:.75rem;font-size:.85rem;font-weight:500}',
            '.cbtn{border:0;border-radius:.6rem;background:#7c3aed;color:#fff;font-weight:700;font-size:.95rem;padding:.7rem 1.2rem;cursor:pointer;font-family:inherit}',
            '.cbtn:hover{filter:brightness(1.08)}',
            '.cbtn.ghost{background:var(--surface,#fff);color:var(--text,#1a2233);border:1.5px solid var(--border,#e2e8f0)}',
            '.crow{display:flex;gap:.6rem;flex-wrap:wrap;margin-top:.9rem}',
            '.cq{background:var(--surface,#fff);border:1px solid var(--border,#e2e8f0);border-radius:.8rem;padding:1rem 1.1rem;margin-bottom:.8rem;white-space:pre-line;line-height:1.6}',
            '.copt{display:block;width:100%;text-align:left;border:1.5px solid var(--border,#e2e8f0);background:#fff;border-radius:.6rem;padding:.65rem .8rem;margin-bottom:.5rem;cursor:pointer;font-family:inherit;font-size:.95rem}',
            '.copt:hover{border-color:#7c3aed}',
            '.copt.right{border-color:#15803d;background:#eef8f0}.copt.wrong{border-color:#b91c1c;background:#fdeced}',
            '.cexpl{background:#f8fafc;border-radius:.6rem;padding:.85rem 1rem;font-size:.88rem;line-height:1.55;white-space:pre-line;margin-top:.6rem}',
            '.cunscored{font-size:.75rem;color:var(--text-muted,#64748b);font-style:italic;margin-top:.6rem}',
            '#challengeCompletion{background:#f5f3ff;border:1.5px solid #ddd6fe;border-radius:.8rem;padding:.9rem 1.1rem;margin:0 0 1rem}',
        ].join('');
        document.head.appendChild(st);
    }

    // ── Hub tile ─────────────────────────────────────────────────
    function injectTile() {
        var row = document.querySelector('.hub-quick');
        if (!row || $('challengeTile')) return;
        var b = document.createElement('button');
        b.type = 'button';
        b.id = 'challengeTile';
        b.className = 'hub-quick-btn hub-quick-challenge';
        b.onclick = function () { openChallenge(); };
        row.appendChild(b);
        refreshTile();
    }
    function refreshTile() {
        var b = $('challengeTile');
        if (!b || !state.set) return;
        var c = counts();
        var pct = c.total ? Math.round(c.mastered / c.total * 100) : 0;
        b.innerHTML =
            '<span class="hub-quick-icon">&#9876;</span>' +
            '<span class="hub-quick-title">Challenge &mdash; ' + esc(state.set.title) + '</span>' +
            '<span class="hub-quick-sub">Built from the questions you missed on ' + esc(state.set.source) +
            ' &middot; <b>Mastered ' + c.mastered + ' of ' + c.total + '</b> (' + pct + '%)</span>';
    }

    // ── Screen ───────────────────────────────────────────────────
    function screenEl() {
        var el = $('challengeScreen');
        if (el) return el;
        el = document.createElement('div');
        el.id = 'challengeScreen';
        el.innerHTML = '<div class="cwrap"></div>';
        document.body.appendChild(el);
        return el;
    }
    function paint(html) { screenEl().querySelector('.cwrap').innerHTML = html; }

    function tallyHtml(c) {
        var pct = c.total ? Math.round(c.mastered / c.total * 100) : 0;
        return '<div class="ctally">' +
            '<div class="big">Mastered ' + c.mastered + ' of ' + c.total + ' <span style="color:#7c3aed">(' + pct + '%)</span></div>' +
            '<div class="pctbar"><i style="width:' + pct + '%"></i></div>' +
            '<div class="cchips">' +
                '<span class="cchip">not attempted ' + c.notAttempted + '</span>' +
                '<span class="cchip w">to fix ' + c.wrong + '</span>' +
                '<span class="cchip c">correct once ' + c.correctOnce + '</span>' +
                '<span class="cchip m">mastered ' + c.mastered + '</span>' +
            '</div></div>';
    }

    function header() {
        return '<h1>' + esc(state.set.title) + '</h1>' +
               '<p class="csrc">' + esc(state.set.source) + ' &middot; ' + esc(state.set.date) + '</p>' +
               (state.missing.length
                   ? '<div class="cbanner"><b>' + state.missing.length + ' question(s) in this set no longer exist in the bank.</b> ' +
                     'The mastery total is wrong until this is fixed. Missing: ' + esc(state.missing.join(', ')) + '</div>'
                   : '');
    }

    function renderStart() {
        var c = counts(), g = CC.gate(c);
        var reviewN = (state.set.review || []).length;
        var html = header() + tallyHtml(c);

        if (g === 'empty') {
            paint(header() + '<div class="cmsg">No challenge set has been assigned to your account yet.</div>' + backRow());
            return;
        }

        if (reviewN) {
            html += '<div class="cbox"><label>Before you drill</label>' +
                '<div class="cnote" style="margin:0 0 .7rem">Read back through the ' + reviewN + ' questions you actually missed. ' +
                'This is a review of the test itself &mdash; nothing here counts toward mastery.</div>' +
                '<button class="cbtn ghost" id="cDebriefBtn">Review your ' + reviewN + ' misses</button></div>';
        }

        if (g === 'done') {
            html += '<div class="cmsg ok">Every question in this set is mastered.</div>' +
                '<div class="crow"><button class="cbtn ghost" id="cReattemptBtn">Reattempt all ' + c.total + '</button></div>';
        } else if (g === 'confirm') {
            html += '<div class="cmsg">You have answered every question correctly at least once. ' +
                'Answer the <b>' + c.correctOnce + '</b> you have only got right once a second time to master them.</div>' +
                '<div class="crow"><button class="cbtn" id="cConfirmBtn">Confirm the ' + c.correctOnce +
                ' you only got right once</button></div>';
        } else {
            var avail = c.total - c.mastered;
            var def = CC.defaultSessionSize(c);
            html += '<div class="cbox">' +
                '<label for="cHowMany">How many questions? <span style="font-weight:400;color:#64748b">(' + avail + ' available)</span></label>' +
                '<input type="number" id="cHowMany" min="1" max="' + avail + '" value="' + def + '">' +
                '<label class="chk"><input type="checkbox" id="cTimed"> Timed &mdash; ' + budget() + 's per question</label>' +
                '<div class="crow"><button class="cbtn" id="cBeginBtn">Begin</button></div></div>';
        }

        html += '<p class="cnote">Answers here count toward the same mastery record as Practice and Homework. ' +
                'A question needs two clean correct answers to be mastered, and mastery lapses after 21 days without contact.</p>';
        paint(html + backRow());

        wire('cDebriefBtn', renderDebrief);
        wire('cBeginBtn', function () {
            var n = parseInt(($('cHowMany') || {}).value, 10) || 1;
            begin(n, false, !!($('cTimed') || {}).checked);
        });
        wire('cConfirmBtn', function () { begin(counts().correctOnce, false, false); });
        wire('cReattemptBtn', function () { begin(counts().total, true, false); });
        wire('cHubBtn', function () { goToHub(); });
    }

    function backRow() {
        return '<div class="crow"><button class="cbtn ghost" id="cHubBtn">&larr; Hub</button></div>';
    }
    function wire(id, fn) { var el = $(id); if (el) el.onclick = fn; }

    // ── Layer 1: the debrief. Unscored. Never records an answer. ──
    function renderDebrief() {
        var qs = state.set.review || [];
        var i = 0;
        function show() {
            var q = qs[i], answered = false;
            var html = header() +
                '<div class="cnote"><b>Review ' + (i + 1) + ' of ' + qs.length + '</b> &middot; ' + esc(q.source) +
                ' &middot; ' + esc(q.skill) + (q.ruleType ? ' &middot; ' + esc(q.ruleType) : '') + '</div>' +
                (q.passage ? '<div class="cq">' + blanks(q.passage) + '</div>' : '') +
                '<div class="cq" style="font-weight:600">' + esc(q.question) + '</div>' +
                '<div id="cOpts">' + q.options.map(function (o) {
                    return '<button class="copt" data-l="' + esc(o.trim()[0]) + '">' + esc(o) + '</button>';
                }).join('') + '</div>' +
                '<div id="cReveal"></div>' +
                '<p class="cunscored">Review only. Nothing on this screen counts toward mastery.</p>' +
                '<div class="crow">' +
                    '<button class="cbtn ghost" id="cShowBtn">Show the answer</button>' +
                    (i + 1 < qs.length ? '<button class="cbtn" id="cNextBtn">Next</button>'
                                       : '<button class="cbtn" id="cDoneBtn">Done reviewing</button>') +
                '</div>' +
                '<div class="crow"><button class="cbtn ghost" id="cBackBtn">&larr; Back to challenge</button></div>';
            paint(html);

            function reveal(chosen) {
                if (answered) return;
                answered = true;
                Array.prototype.forEach.call(document.querySelectorAll('#cOpts .copt'), function (b) {
                    b.disabled = true;
                    if (b.dataset.l === q.answer) b.classList.add('right');
                    else if (chosen && b.dataset.l === chosen) b.classList.add('wrong');
                });
                $('cReveal').innerHTML =
                    (q.strategy ? '<div class="cexpl"><b>Approach:</b> ' + esc(q.strategy) + '</div>' : '') +
                    '<div class="cexpl">' + esc(q.explanation) + '</div>';
            }
            Array.prototype.forEach.call(document.querySelectorAll('#cOpts .copt'), function (b) {
                b.onclick = function () { reveal(b.dataset.l); };   // deliberately no recordAnswer
            });
            wire('cShowBtn', function () { reveal(null); });
            wire('cNextBtn', function () { i++; show(); });
            wire('cDoneBtn', renderStart);
            wire('cBackBtn', renderStart);
        }
        show();
    }

    // ── Layer 2: hand a slice of the queue to the shared engine ──
    function begin(n, includeMastered, timed) {
        var queue = CC.buildQueue(state.questions, ledger(), { includeMastered: !!includeMastered });
        if (!queue.length) { renderStart(); return; }
        n = Math.max(1, Math.min(n || 1, queue.length));
        var slice = queue.slice(0, n);

        var timer = timed ? { mode: 'countdown', total: n * budget() } : { mode: 'off' };
        screenEl().style.display = 'none';
        state.sessionActive = true;
        if (!launchSession(slice, 'assisted', timer)) { state.sessionActive = false; renderStart(); return; }
        lockMode();   // must come AFTER launchSession, which sets modeSelect.value from its `mode` argument
    }

    // ── Completion, decorated with the challenge's own gates ─────
    function decorateCompletion() {
        var card = document.querySelector('#completionScreen .completion-card');
        if (!card) return;
        var c = counts(), g = CC.gate(c);
        var pct = c.total ? Math.round(c.mastered / c.total * 100) : 0;

        var box = $('challengeCompletion');
        if (!box) {
            box = document.createElement('div');
            box.id = 'challengeCompletion';
            var anchor = $('skillBreakdown');
            card.insertBefore(box, anchor || card.firstChild);
        }
        box.innerHTML =
            '<div style="font-weight:700;margin-bottom:.2rem">' + esc(state.set.title) + '</div>' +
            '<div style="font-size:.9rem">Mastered <b>' + c.mastered + '</b> of <b>' + c.total + '</b> (' + pct + '%)' +
            ' &middot; to fix ' + c.wrong + ' &middot; correct once ' + c.correctOnce + '</div>' +
            (g === 'done'    ? '<div style="margin-top:.5rem;color:#15803d;font-weight:600">Every question in this set is mastered.</div>' : '') +
            (g === 'confirm' ? '<div style="margin-top:.5rem">Nothing left unattempted or wrong. Answer the ' + c.correctOnce +
                               ' you only got right once a second time to master them.</div>' : '');

        var actions = document.querySelector('#completionScreen .completion-actions');
        if (actions && !$('cBackToChallenge')) {
            var b = document.createElement('button');
            b.id = 'cBackToChallenge';
            b.className = 'btn btn-primary completion-action-btn';
            b.textContent = 'Back to Challenge';
            b.onclick = function () { openChallenge(); };
            actions.insertBefore(b, actions.firstChild);
        }
    }

    // ── Entry point + wrappers around app.js's screen functions ──
    window.openChallenge = function () {
        endChallengeSession();
        if (!state.set) { return; }
        ['hubScreen', 'setupScreen', 'app', 'completionScreen'].forEach(function (id) {
            var el = $(id); if (el) el.style.display = 'none';
        });
        screenEl().style.display = 'block';
        renderStart();
        if (typeof _pushScreen === 'function') _pushScreen('challenge');
    };

    function wrap(name, before, after) {
        var orig = window[name];
        if (typeof orig !== 'function') return;
        window[name] = function () {
            if (before) before.apply(null, arguments);
            var r = orig.apply(this, arguments);
            if (after) after.apply(null, arguments);
            return r;
        };
    }

    // history.js hardcodes `source: 'practice'` on every record it builds, so a
    // challenge session would reach the tutor's sheet looking like idle drilling.
    // Stamp the upload — not the local history, which app.js owns — so the sheet
    // can tell his most targeted work of the week apart from everything else.
    function stampSheetUploads() {
        var orig = window.syncSessionToSheet;
        if (typeof orig !== 'function') return;
        window.syncSessionToSheet = function (record) {
            if (state.sessionActive && record && state.set) {
                record = Object.assign({}, record, {
                    source:          'challenge',
                    assignmentId:    state.set.setId,
                    assignmentTitle: state.set.title,
                });
            }
            return orig(record);
        };
    }

    function boot() {
        var sets = CC.setsFor(studentName(), window.CHALLENGE_SETS);
        state.set = sets.length ? sets[0] : null;
        if (!state.set) return;                       // no tile, no screen, nothing served

        var problems = CC.validateSet(state.set);
        var r = CC.resolveSet(state.set, theBank());
        state.questions = r.questions;
        state.missing = r.missing;
        if (problems.length) console.warn('[challenge] ' + state.set.setId + ': ' + problems.join('; '));
        if (r.missing.length) {
            console.error('[challenge] ' + state.set.setId + ': ' + r.missing.length +
                ' id(s) do not resolve against the bank — the mastery total is wrong: ' + r.missing.join(', '));
        }
        if (!state.questions.length) return;          // empty ids: the debrief alone is not a challenge

        injectCss();
        injectTile();
        stampSheetUploads();

        // Any navigation away from the challenge ends the session and unlocks Exam.
        wrap('goToHub', function () { var el = $('challengeScreen'); if (el) el.style.display = 'none'; endChallengeSession(); }, refreshTile);
        wrap('showSetup', function () { var el = $('challengeScreen'); if (el) el.style.display = 'none'; endChallengeSession(); });
        wrap('showCompletion', null, function () { if (state.sessionActive) decorateCompletion(); });

        // Browser back/forward: teach the screen switcher about 'challenge'.
        var origShow = window._showScreenOnly;
        if (typeof origShow === 'function') {
            window._showScreenOnly = function (name) {
                if (name === 'challenge') {
                    ['hubScreen', 'setupScreen', 'app', 'completionScreen'].forEach(function (id) {
                        var el = $(id); if (el) el.style.display = 'none';
                    });
                    screenEl().style.display = 'block';
                    renderStart();
                    return;
                }
                var el = $('challengeScreen'); if (el) el.style.display = 'none';
                return origShow(name);
            };
        }

        // Deep link. The homework hub sends a student straight here, so the
        // challenge is one tap from the habit he already has.
        if (/[?&]challenge=1\b/.test(location.search) || location.hash === '#challenge') openChallenge();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
