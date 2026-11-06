// public/apps/hub-runner.js
// Runs an app's homework runner (public/apps/<app>/homework-run.html) on a
// Hub attempt (Phase 2 batch 3b, design note docs/phase2/PHASE2_DESIGN.md
// Section 2b). Loaded after hub-client.js and before the runner's own script.
//
// The runner is kept as the app wrote it, with the patches listed in
// scripts/vendor-runners.mjs. This file supplies what the runner used to get
// from the app's other files:
//
// - hwLoadPlan: the attempt instead of the tutor's plan file. One section per
//   question, in the Hub's order, so the runner's own draw serves exactly the
//   questions the Hub froze at start. No review draw (the review ladder is not
//   served yet).
// - The bank: the attempt's questions in the runner's shape, with no answer.
// - Marking (owner, 6 Nov 2026): the runner marks only after the Hub replies.
//   Untimed, each Submit commits the answer and the reply brings the key and
//   explanation. Timed, each choice is sent as it is made, and Submit (or the
//   clock) closes the attempt on the Hub, which then releases every answer.
// - Identity and one sign-in at a time: the Hub session and lease.
//
// Nothing goes to the app's tutor sheet: its sync script is not loaded here.

(function () {
  var script = document.currentScript;
  var app = (script && script.getAttribute('data-app')) || '';
  var client = window.HubClient.create();
  var search = new URLSearchParams(location.search);
  var attemptId = search.get('attempt') || '';
  // The catalog's names, except where an app spells a skill its own way.
  var APP_LABELS = { 'II.COE_T': 'Command of Evidence — Textual', 'II.COE_Q': 'Command of Evidence — Quantitative' };
  var MAX_PREDICTION = 600;
  var state = { attempt: null, submitted: false, byId: {}, chain: Promise.resolve() };

  function hubPage() { return '/learn/attempts/' + encodeURIComponent(attemptId); }

  function notice(title, text, action) {
    var run = document.getElementById('run');
    var tip = document.getElementById('tip');
    if (tip) tip.style.display = 'none';
    if (!run) return;
    run.innerHTML = '';
    var card = document.createElement('div'); card.className = 'done-card'; card.setAttribute('role', 'alert');
    var h = document.createElement('div'); h.className = 'big'; h.textContent = title; card.appendChild(h);
    var p = document.createElement('p'); p.style.marginTop = '.6rem'; p.textContent = text; card.appendChild(p);
    var nav = document.createElement('div'); nav.className = 'nav'; nav.style.justifyContent = 'center'; nav.style.marginTop = '1rem';
    var a = document.createElement('a'); a.className = 'btn'; a.href = action ? action.href : '/learn'; a.textContent = action ? action.label : 'Back to homework';
    nav.appendChild(a); card.appendChild(nav); run.appendChild(card);
  }
  function status(text) {
    var fb = document.getElementById('fb');
    if (!fb) return;
    fb.className = 'fb show no';
    document.getElementById('fbh').textContent = 'Not saved yet';
    document.getElementById('fbt').textContent = text;
  }
  var HELD = 'This account is open on another screen. Close it there, or wait three minutes and try again.';

  /** One served question in the runner's shape. */
  function toRunner(item) {
    var q = window.HubClient.toEngineQuestion(item);
    q.id = 'hub-' + item.position;
    var s = item.skill || {};
    q.skill = APP_LABELS[s.id] || s.name || '';
    q.skillId = s.id || '';
    return q;
  }

  /** What the Hub released for a question: the key, and the explanation with why the chosen answer is wrong. */
  function release(q, feedback, chosen) {
    if (!feedback) return;
    q.answer = feedback.key;
    var reason = chosen && chosen !== feedback.key && feedback.reasons && feedback.reasons[chosen];
    q.explanation = (reason ? 'Why not ' + chosen + ': ' + reason.why + '\n\n' : '') + (feedback.explanation || '');
  }

  function written(n) {
    var out = {};
    var text = String(n.prediction || '').trim();
    if (text) out.prediction = text.slice(0, MAX_PREDICTION);
    if (n.firstSeen && n.revealTs) {
      var textMs = Math.max(0, Math.round(n.revealTs - n.firstSeen));
      out.textMs = textMs;
      out.optionMs = Math.max(0, Math.round((n.secs || 0) * 1000 - textMs));
    }
    return out;
  }

  window.HubRunner = {
    /** The runner's own URL parameters: one set, keyed by the attempt (never a name). */
    params: function () { return 'student=hub-' + encodeURIComponent(attemptId) + '&day=1'; },
    submitted: function () { return state.submitted; },

    /** Untimed: commit the chosen answer, then let the runner mark it from the reply. */
    commit: function (q, n, done) {
      if (!n.revealed || n.graded || n.chosen === null) return done();
      var pos = Number(String(q.id).slice(4));
      client.answer(pos, n.chosen, state.attempt.timed ? {} : written(n)).then(function (r) {
        if (r.result === 'SAVED' && r.reply.feedback) { release(q, r.reply.feedback, n.chosen); return done(); }
        if (r.result === 'SAVED') return done();
        if (r.result === 'KEPT') return status(r.held ? HELD : 'No connection. Your answer is kept on this device; press Submit again when you are back online.');
        if (r.result === 'CLOSED') return location.replace(hubPage());
        status(r.error || 'Your answer was not saved. Please try again.');
      });
    },

    /** Timed: send each choice as it is made; the last one before submit counts. */
    answer: function (q, n) {
      if (n.chosen === null) return;
      // One at a time, in the order chosen, so a slow earlier choice never lands after a later one.
      var pos = Number(String(q.id).slice(4)), choice = n.chosen;
      state.chain = state.chain.then(function () { return client.answer(pos, choice, {}); });
    },

    /** Close the attempt on the Hub, take every released answer, then let the runner finish. */
    submit: function (set, done) {
      state.chain.then(function () { return client.submit(); }).then(function (r) {
        if (!r.ok && !(r.data && r.data.closed)) {
          return window.alert((r.data && r.data.error) || 'Could not submit. Please try again.');
        }
        var after = r.ok ? Promise.resolve({ ok: true, attempt: r.data.attempt }) : client.openAttempt(attemptId);
        after.then(function (o) {
          if (!o.ok) return window.alert('Could not load your results. Please reload the page.');
          state.submitted = true;
          o.attempt.items.forEach(function (it) {
            var q = state.byId['hub-' + it.position];
            if (q) release(q, it.feedback, it.answer);
          });
          done();
        });
      });
    },
  };

  /** The runner asks for its plan; the Hub's attempt answers. */
  window.hwLoadPlan = function (student, cb) {
    (async function () {
      if (!attemptId) return notice('Not found', 'This work was not found.');
      var me = await client.whoami();
      if (!me) return location.replace('/login');
      var lease = await client.startLease(function () { notice('Opened on another screen', HELD, { href: location.href, label: 'Try again' }); });
      if (lease === 'held') return notice('Open on another screen', HELD, { href: location.href, label: 'Try again' });
      document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') client.wake(); });
      window.addEventListener('pagehide', function () { client.stopLease(true); });

      var o = await client.openAttempt(attemptId);
      if (!o.ok) return notice('Not available', (o.data && o.data.error) || 'This work could not be opened.');
      var a = o.attempt;
      state.attempt = a;
      // Closed work, a redo, or a set this runner cannot mark the Hub's way opens on the Hub's own page.
      var fits = a.timed || a.feedback === 'PER_ITEM';
      if (a.status !== 'OPEN' || a.redo || !fits) return location.replace(hubPage());
      if (o.pending) await client.flush();

      // Untimed: answers already committed are final, so the runner serves the rest.
      var items = a.timed ? a.items : a.items.filter(function (it) { return !it.committed; });
      if (!items.length) {
        await client.submit();
        return location.replace(hubPage());
      }
      var qs = items.map(toRunner);
      qs.forEach(function (q) { state.byId[q.id] = q; });
      window.questionBank_CS = qs;
      var minutes = 0;
      if (a.timed && a.deadline) {
        var skew = new Date(a.now).getTime() - Date.now();
        var left = Math.floor((new Date(a.deadline).getTime() - (Date.now() + skew)) / 1000);
        if (left <= 0) { await client.submit(); return location.replace(hubPage()); }
        minutes = left / 60;
      }
      cb({
        start: 'hub-' + attemptId, title: a.title, review: 0,
        days: [{
          n: 1, focus: a.title, tip: a.instructions || '', minutes: minutes, review: 0,
          sections: qs.map(function (q) { return { questionIds: [q.id], count: 1 }; }),
        }],
      }, 'hub');
      var hdr = document.getElementById('hdr');
      if (hdr) hdr.textContent = a.title + (a.leftOut ? ' · ' + (a.items.length) + ' of ' + (a.items.length + a.leftOut) + ' questions' : '');
      if (!a.instructions) { var tip = document.getElementById('tip'); if (tip) tip.style.display = 'none'; }
    })().catch(function () { notice('Something went wrong', 'Please reload the page.'); });
  };
}());
