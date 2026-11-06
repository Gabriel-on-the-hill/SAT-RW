// public/apps/hub-client.js
// The Hub client (plan D5 and Section 7; Phase 2 batch 3, design note
// docs/phase2/PHASE2_DESIGN.md Section 2b). One plain script, no build step,
// that the SAT R&W and PSAT 8/9 engines load in place of their own identity,
// storage and sync layers (gate.js, whoami.js, the localStorage history in
// storage.js, sheet-sync.js). It talks only to the Hub's learning routes:
//
//   GET  /api/learn/session            who is signed in, until when, lease timings
//   POST /api/learn/lease              one sign-in at a time (lib/lease.js)
//   POST /api/learn/attempts           start an assigned set, or a redo
//   GET  /api/learn/attempts/:id       the frozen questions, released feedback only
//   POST /api/learn/attempts/:id/commit, /submit
//   POST /api/learn/sync               queued answers, applied once
//
// Rules it keeps (plan Section 7, shared-device and offline rules):
// - Identity comes from the Hub session, never from a typed or remembered name.
// - Answers that cannot be saved are queued on the device under the account
//   and attempt they belong to, in the same format and key as the Hub's own
//   homework page (components/questions/attemptDraft.js), so either page can
//   send them. A queue is only ever sent while that same account is signed in.
// - The answer key never reaches the browser before release: grading comes
//   back from the server with the committed answer, or at submit.
// - The lease token lives in this tab's sessionStorage under the same key as
//   the Hub's pages (components/questions/leaseToken.js).
//
// In a browser it defines window.HubClient. In Node it exports the same
// object, for tests (tests/release/hub-client.test.mjs).

(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HubClient = api;
}(typeof self !== 'undefined' ? self : globalThis, function () {
  const DRAFT_PREFIX = 'edutrack:attempt:';
  const LEASE_KEY = 'edutrack:lease';
  const LEASE_HEADER = 'X-Hub-Lease';
  const LEASE_CHANNEL = 'edutrack-lease';
  const LABELS = ['A', 'B', 'C', 'D'];

  // --- Shared with components/questions/attemptDraft.js (a parity test holds them equal).
  const draftKey = (userId, attemptId) => DRAFT_PREFIX + userId + ':' + attemptId;
  function readDraft(storage, key) {
    try {
      const d = JSON.parse((storage && storage.getItem(key)) || 'null');
      if (!d || typeof d !== 'object') return { choice: {}, notes: {}, pending: [] };
      return Object.assign({}, d, { choice: d.choice || {}, notes: d.notes || {}, pending: Array.isArray(d.pending) ? d.pending : [] });
    } catch (e) { return { choice: {}, notes: {}, pending: [] }; }
  }
  function writeDraft(storage, key, draft) {
    try { storage.setItem(key, JSON.stringify(draft)); return true; } catch (e) { return false; }
  }
  function nextSeq(current, lastClientSeq, pending) {
    return Math.max.apply(null, [current, lastClientSeq || 0].concat(pending.map((b) => b.clientSeq))) + 1;
  }
  function outcome(res) {
    const r = res || {};
    if (r.ok) return 'SAVED';
    if (!r.status || r.status >= 500 || r.status === 401 || r.status === 429) return 'KEEP';
    if (r.data && r.data.lease === 'held') return 'KEEP';
    if (r.data && r.data.closed) return 'CLOSED';
    return 'REFUSED';
  }

  // --- The catalog question in the engines' shape (data-*.js): passage, question,
  // options as "A. text", and no answer. Underlines use the engines' <u> markup;
  // a table uses their "Table" label and columns split by two spaces.
  function passageOf(stimulus) {
    const s = stimulus || {};
    const parts = [];
    (s.texts || []).forEach((t) => { parts.push(t.label); parts.push(t.text); });
    if (s.intro !== undefined) parts.push([s.intro].concat((s.notes || []).map((n) => '• ' + n)).join('\n'));
    if (s.table) {
      parts.push(['Table: ' + (s.table.title || '')].concat([s.table.columns].concat(s.table.rows).map((r) => r.join('  '))).join('\n'));
    }
    if (s.text !== undefined) {
      const u = s.underline;
      const at = u ? s.text.indexOf(u) : -1;
      parts.push(at < 0 ? s.text : s.text.slice(0, at) + '<u>' + u + '</u>' + s.text.slice(at + u.length));
    }
    return parts.join('\n\n');
  }
  function toEngineQuestion(item) {
    const q = item.question;
    const out = {
      id: 'hub-' + item.position,
      position: item.position,
      passage: passageOf(q.stimulus),
      question: q.stem,
      options: q.options.map((o) => o.label + '. ' + o.text),
    };
    if (item.feedback) Object.assign(out, { answer: item.feedback.key, explanation: item.feedback.explanation });
    return out;
  }

  function hex(n, cryptoObj) {
    const bytes = new Uint8Array(n);
    cryptoObj.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * A client bound to one tab. Every dependency can be passed in (tests do);
   * in a browser the defaults are the window's own.
   */
  function create(opts) {
    const o = opts || {};
    const g = typeof globalThis !== 'undefined' ? globalThis : {};
    const doFetch = o.fetch || g.fetch.bind(g);
    const local = o.localStorage !== undefined ? o.localStorage : safe(() => g.localStorage);
    const session = o.sessionStorage !== undefined ? o.sessionStorage : safe(() => g.sessionStorage);
    const timers = o.timers || { setInterval: g.setInterval.bind(g), clearInterval: g.clearInterval.bind(g), setTimeout: g.setTimeout.bind(g) };
    const now = o.now || (() => Date.now());
    const randomId = o.randomId || (() => hex(16, g.crypto));
    const base = o.base || '';

    function safe(fn) { try { return fn(); } catch (e) { return null; } }
    const leaseToken = () => safe(() => session.getItem(LEASE_KEY)) || '';
    const setLeaseToken = (t) => safe(() => (t ? session.setItem(LEASE_KEY, t) : session.removeItem(LEASE_KEY)));

    async function call(path, method, body, extra) {
      const headers = {};
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      const token = method !== 'GET' ? leaseToken() : '';
      if (token) headers[LEASE_HEADER] = token;
      let res;
      try {
        res = await doFetch(base + path, Object.assign({ method, credentials: 'same-origin', headers }, body !== undefined ? { body: JSON.stringify(body) } : {}, extra || {}));
      } catch (e) { return { ok: false, status: 0, data: {} }; }
      let data = {};
      try { data = await res.json(); } catch (e) { data = {}; }
      return { ok: res.ok, status: res.status, data };
    }

    const state = { user: null, expiresAt: null, attempt: null, seq: 0 };

    /** Who is signed in. Null when signed out, or while the Hub's learning switch is off. */
    async function whoami() {
      const r = await call('/api/learn/session', 'GET');
      if (!r.ok) return null;
      if (state.user && state.user.id !== r.data.user.id) state.attempt = null; // another account: drop this tab's open work
      state.user = r.data.user;
      state.expiresAt = r.data.expiresAt ? new Date(r.data.expiresAt).getTime() : null;
      return r.data;
    }

    // --- One sign-in at a time.
    const lease = { timer: null, early: null, dead: false, lastBeat: 0, onLost: null, ch: null, id: '', born: 0 };
    const Channel = o.BroadcastChannel !== undefined ? o.BroadcastChannel : g.BroadcastChannel;

    // A duplicated tab inherits this tab's sessionStorage, token included, so the
    // server cannot tell the two apart. As in the apps' gate.js: a page that
    // opened with a token says hello; a page holding the same token for more
    // than a second answers, and the newcomer gives way (keeping no token).
    function listen() {
      if (!Channel || lease.ch) return;
      try {
        lease.ch = new Channel(LEASE_CHANNEL);
        lease.ch.onmessage = (e) => {
          const m = (e && e.data) || {};
          const token = leaseToken();
          if (lease.dead || !token || m.token !== token) return;
          if (m.t === 'hello' && m.id !== lease.id && now() - lease.born > 1000) lease.ch.postMessage({ t: 'here', token, to: m.id });
          else if (m.t === 'here' && m.to === lease.id) { stopLease(false); setLeaseToken(''); if (lease.onLost) lease.onLost(); }
        };
      } catch (e) { lease.ch = null; }
    }
    async function leaseAsk(op) {
      lease.lastBeat = now();
      const r = await call('/api/learn/lease', 'POST', { op, token: leaseToken() || undefined });
      if (lease.dead) return 'dead';
      if (r.ok && r.data.ok && r.data.token) { setLeaseToken(r.data.token); return 'ok'; }
      if (r.ok && r.data.staff) return 'ok';
      if (r.ok && r.data.reason === 'held') {
        if (op === 'beat') { stopLease(false); setLeaseToken(''); if (lease.onLost) lease.onLost(); return 'lost'; }
        return 'held';
      }
      return 'unknown'; // no answer: keep working; the server checks every write
    }
    /** Ask for the lease and keep it. Resolves 'ok', 'held' or 'unknown'. onLost runs if another screen takes it later. */
    async function startLease(onLost) {
      lease.dead = false; lease.onLost = onLost || null; lease.id = randomId(); lease.born = now();
      const inherited = leaseToken();
      listen();
      const first = await leaseAsk('acquire');
      if (first === 'held') return first;
      if (inherited && lease.ch && leaseToken()) lease.ch.postMessage({ t: 'hello', token: leaseToken(), id: lease.id });
      const beatMs = 60 * 1000;
      lease.early = timers.setTimeout(() => { if (!lease.dead) leaseAsk('beat'); }, 10 * 1000);
      lease.timer = timers.setInterval(() => { if (!lease.dead) leaseAsk('beat'); }, beatMs);
      return first;
    }
    /** Stop beating; with release, let the account go (it frees 20 seconds later). */
    function stopLease(release) {
      if (lease.timer) timers.clearInterval(lease.timer);
      lease.timer = null;
      const token = leaseToken();
      if (release && token && !lease.dead) call('/api/learn/lease', 'POST', { op: 'release', token }, { keepalive: true });
      lease.dead = true;
      if (lease.ch) { try { lease.ch.close(); } catch (e) { /* already closed */ } lease.ch = null; }
    }
    /** For visibilitychange: beat now if the last one was more than 10 seconds ago. */
    function wake() { if (!lease.dead && lease.timer && now() - lease.lastBeat > 10 * 1000) leaseAsk('beat'); }

    // --- Work.
    async function startWork(recipientId) { return call('/api/learn/attempts', 'POST', { recipientId }); }
    async function startRedo(attemptId) { return call('/api/learn/attempts', 'POST', { redoOf: attemptId }); }

    /** Open an attempt: the server's view, the questions in the engines' shape, and what waits on this device. */
    async function openAttempt(attemptId) {
      if (!state.user) await whoami();
      if (!state.user) return { ok: false, status: 401, data: { error: 'Sign in to the Hub first.' } };
      const r = await call('/api/learn/attempts/' + encodeURIComponent(attemptId), 'GET');
      if (!r.ok) return r;
      state.attempt = r.data.attempt;
      state.seq = Math.max(state.seq, state.attempt.lastClientSeq || 0);
      const d = readDraft(local, draftKey(state.user.id, attemptId));
      state.seq = Math.max.apply(null, [state.seq].concat(d.pending.map((b) => b.clientSeq)));
      return { ok: true, attempt: state.attempt, questions: state.attempt.items.map(toEngineQuestion), pending: d.pending.length };
    }

    function queue(entry) {
      const key = draftKey(state.user.id, state.attempt.id);
      const d = readDraft(local, key);
      state.seq = nextSeq(state.seq, state.attempt.lastClientSeq, d.pending);
      d.pending.push({ batchId: randomId(), clientSeq: state.seq, entries: [entry] });
      return writeDraft(local, key, d);
    }

    /**
     * Commit one answer. Saved: the server's reply (with correct and feedback
     * when the set releases them per question). Kept: no connection, or
     * another screen has the account; the answer waits on this device.
     */
    async function answer(position, choice, written) {
      if (!state.attempt) return { result: 'REFUSED', error: 'Open the work first.' };
      if (LABELS.indexOf(choice) < 0) return { result: 'REFUSED', error: 'Choose an answer.' };
      const entry = Object.assign({ type: 'answer', position, answer: choice }, written || {});
      const d = readDraft(local, draftKey(state.user.id, state.attempt.id));
      // Behind a queue, an answer joins it, so answers reach the server in the order given.
      if (d.pending.length) return { result: queue(entry) ? 'KEPT' : 'REFUSED', stored: true };
      const r = await call('/api/learn/attempts/' + encodeURIComponent(state.attempt.id) + '/commit', 'POST', Object.assign({ position, answer: choice }, written || {}));
      const out = outcome(r);
      if (out === 'KEEP') return { result: queue(entry) ? 'KEPT' : 'REFUSED', stored: true, held: r.data && r.data.lease === 'held' };
      if (out === 'SAVED') return { result: 'SAVED', reply: r.data };
      return { result: out, error: r.data.error };
    }

    /** Send what waits on this device, in order, while the same account is signed in. */
    async function flush() {
      if (!state.attempt) return { saved: 0, lost: [] };
      const owner = state.user && state.user.id;
      const me = await whoami();
      if (!me || me.user.id !== owner) return { saved: 0, lost: [], kept: true };
      const key = draftKey(owner, state.attempt.id);
      let saved = 0; const lost = [];
      const d = readDraft(local, key);
      const order = d.pending.slice().sort((x, y) => x.clientSeq - y.clientSeq);
      for (let i = 0; i < order.length; i++) {
        const b = order[i];
        const r = await call('/api/learn/sync', 'POST', { batchId: b.batchId, attemptId: state.attempt.id, clientSeq: b.clientSeq, entries: b.entries });
        const out = outcome(r);
        if (out === 'KEEP') break;
        d.pending = d.pending.filter((x) => x.batchId !== b.batchId);
        if (out === 'SAVED') { saved += 1; continue; }
        b.entries.forEach((e) => lost.push(e.position));
        if (out === 'CLOSED') { d.pending.forEach((x) => x.entries.forEach((e) => lost.push(e.position))); d.pending = []; break; }
      }
      writeDraft(local, key, d);
      return { saved, lost };
    }

    async function submit() {
      if (!state.attempt) return { ok: false, status: 0, data: { error: 'Open the work first.' } };
      await flush();
      const d = readDraft(local, draftKey(state.user.id, state.attempt.id));
      if (d.pending.length) return { ok: false, status: 0, data: { error: 'Some answers are not saved yet. Submit when you are back online.' } };
      const r = await call('/api/learn/attempts/' + encodeURIComponent(state.attempt.id) + '/submit', 'POST', {});
      if (r.ok) state.attempt = r.data.attempt;
      return r;
    }

    return {
      whoami, startLease, stopLease, wake, startWork, startRedo, openAttempt, answer, flush, submit,
      get user() { return state.user; },
      get expiresAt() { return state.expiresAt; },
      get attempt() { return state.attempt; },
    };
  }

  return { create, toEngineQuestion, passageOf, draftKey, outcome, nextSeq, LEASE_KEY, LEASE_HEADER, LEASE_CHANNEL };
}));
