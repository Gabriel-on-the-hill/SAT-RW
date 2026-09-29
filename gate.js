// ─────────────────────────────────────────────────────────────────
// gate.js  —  Session-only password gate for the SAT Mastery app
//
// Load this as the FIRST script in <head> on every protected page:
//   <script src="gate.js"></script>
//
// Behaviour:
//   • If the session is already unlocked, does nothing — page renders normally.
//   • Otherwise, hides the page, shows a centered prompt overlay, and only
//     reveals the page after a correct password is entered.
//   • Unlock state lives in sessionStorage, so closing the tab re-locks the app.
//   • Case-insensitive: input is lowercased before hashing.
//
// Adding a new password later:
//   1. Compute its SHA-256 (lowercased) — e.g. in a terminal:
//        node -e "const c=require('crypto'); console.log(
//          c.createHash('sha256').update('newpassword').digest('hex'))"
//      or in a browser console:
//        crypto.subtle.digest('SHA-256', new TextEncoder().encode('newpassword'))
//          .then(b => console.log([...new Uint8Array(b)]
//            .map(x => x.toString(16).padStart(2,'0')).join('')));
//   2. Add an entry to ACCEPTED_HASHES below as: 'thehex': 'Firstname'.
//      Use ONLY the first name (Title-Cased version of the password) as the
//      display label — the watermark uses this label, and we keep watermarks
//      to first names by convention so they read cleanly across the page.
//      No other code change needed.
//
// The passwords are NOT listed here, and the line that used to list them has
// been removed. This repo is public with Pages on, so a comment spelling out
// every login is a published mapping — and AGENTS.md is explicit that the gate
// names are the only personal names this repo may contain and that none of them
// may be explained. The hashes below are the whole record; if you need to know
// whether a password is already taken, hash it and look.
// ─────────────────────────────────────────────────────────────────

(function () {
    // Hash → display label. The label is stored in sessionStorage on
    // successful unlock so the watermark (anti-cheat.js) can personalize
    // itself for whoever is using the app this session.
    const ACCEPTED_HASHES = {
        'a459891617d735655dcfed3e37db66fa07f0175866ebf35f9de8ccc59c0840bb': 'Jeffrey',
        '17fc19d5d0ffa46dbe6a1c7c57e969aa6d5760544d96d5f2b0e96a1f66c7ea4b': 'Bruce',
        '72831924521887e6638e686d6d004cd6cefe48168d2d4e2c40d29115b9c611b9': 'Gabe',
        '87149c612bf9e736233e4e88c19a565d8356d45b7eb36d0d78785f59ac60fdf1': 'Segun',
        '0b38f144b7790ef62e4d0e8a72958b1cbebb9bb9bf81f4aa1c2bbc05c323b496': 'Ayodeji',
    };

    // Tutor-only. A random passphrase, NOT a first name: the hash is public, so
    // the password's entropy is the only thing standing behind it, and a short
    // guessable word is a trivial brute-force. To change it, hash the new one
    // (recipe above) and replace this entry.
    const TUTOR_HASHES = {
        'd90f66ff3910800f3fc101e28f33997503c3bc09505201560045c33e00d43833': 'Tutor',
    };

    const STORAGE_KEY  = 'mastery_unlocked';
    const USER_KEY     = 'mastery_user';
    const ROLE_KEY     = 'mastery_role';
    const SESSION_FLAG = '1';

    // What this page demands. Default 'student' keeps every existing page
    // unchanged. A page that must not be opened by a student declares, BEFORE
    // loading this file:
    //     <script>window.GATE_REQUIRE = 'tutor';</script>
    //     <script src="gate.js"></script>
    //
    // This exists because tutor-dashboard.html loaded the same gate as the app,
    // so any student's own password opened a page showing EVERY student's
    // accuracy, retention, weakest skills and tab-switch counts. That is an
    // assessment of a student, and the house rule is that a student never reads
    // one — about themselves or anyone else.
    const REQUIRE = (typeof window !== 'undefined' && window.GATE_REQUIRE) || 'student';
    // A tutor can open the student pages; a student cannot open a tutor page.
    const TABLE = (REQUIRE === 'tutor')
        ? TUTOR_HASHES
        : Object.assign({}, ACCEPTED_HASHES, TUTOR_HASHES);

    // ── One login at a time ──────────────────────────────────────────
    // A student password opens the app in ONE tab, on ONE device, at a time.
    // When the password is accepted the gate asks the tutor-sheet Apps Script
    // for a LEASE on the student's name, beats it once a minute, and releases
    // it when the tab closes. A second tab or device asking for a name that is
    // already live is refused. A tab whose lease is lost (another screen took
    // the name after this one slept past the TTL) signs itself out.
    //
    //   • Same tab, new page: same token (sessionStorage), so it walks back in.
    //   • A DUPLICATED tab copies sessionStorage, token and all, so a token alone
    //     cannot tell it apart — a BroadcastChannel hello does: if a live page in
    //     this browser already answers for the token, the newcomer is the second
    //     login and signs out.
    //   • Tutor sessions never take a lease.
    //   • FAILS OPEN. If the script cannot be reached (offline, not redeployed,
    //     slow), the student is let in and the next beat tries again. A script
    //     outage must never lock a class out mid-lesson.
    //
    // This is a deterrent, not security: it runs in the browser, and a student
    // who edits the page can skip it. The Login Log tab is the useful half.
    // The server side is in tutor-sheet/rw-apps-script.md (lease_).
    //
    // Must equal SHEET_SYNC_ENDPOINT in sheet-sync.js — gate.js loads first, so
    // it cannot read that one. gate.test.js asserts the two match.
    const LEASE_ENDPOINT  =
        'https://script.google.com/macros/s/AKfycbzR0dumI5CEeyhDmsH_Yx57wHO7hK4xA953a4SMWxt9_CI3cw66Vs9ppa2DxkUPO2Bj/exec';
    const LEASE_APP       = 'SAT R&W';
    const LEASE_TOKEN_KEY = 'mastery_lease';
    const LEASE_MSG_KEY   = 'mastery_lease_msg';
    const LEASE_BEAT_MS   = 60000;
    const LEASE_WAIT_MS   = 8000;
    const LEASE_CHANNEL   = 'mastery-lease';

    const MSG_REFUSED = 'This account is already open on another screen or tab. Close it there first. '
                      + 'If you have just closed it, wait a minute and try again.';
    const MSG_DUPLICATE = 'This account is already open in another tab. Use that tab, or close it and sign in here.';
    const MSG_LOST = 'This account was opened on another screen, so this one has been signed out. '
                   + 'Your answers so far are saved on this device.';

    function ss(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
    function newToken() {
        const b = new Uint8Array(12);
        try { crypto.getRandomValues(b); } catch (e) { for (let i = 0; i < b.length; i++) b[i] = Math.random() * 256; }
        return [...b].map(x => x.toString(16).padStart(2, '0')).join('');
    }

    // JSONP: a static page on another origin can only READ a reply from Apps
    // Script through a <script> tag. Resolves null when the script cannot be
    // reached or does not answer in time — never rejects.
    function jsonp(params) {
        return new Promise(resolve => {
            if (!LEASE_ENDPOINT) { resolve(null); return; }
            const cb = '__gateLease' + Math.random().toString(36).slice(2);
            const s = document.createElement('script');
            let done = false;
            const finish = v => {
                if (done) return; done = true;
                clearTimeout(timer);
                try { delete window[cb]; } catch (e) { window[cb] = undefined; }
                if (s.parentNode) s.parentNode.removeChild(s);
                resolve(v);
            };
            const timer = setTimeout(() => finish(null), LEASE_WAIT_MS);
            window[cb] = data => finish(data && typeof data === 'object' ? data : null);
            s.onerror = () => finish(null);
            s.src = LEASE_ENDPOINT + '?' + Object.keys(params)
                .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(params[k])).join('&')
                + '&callback=' + cb + '&_=' + Date.now();
            (document.head || document.documentElement).appendChild(s);
        });
    }

    function leaseCall(op, student, token) {
        const params = { action: 'lease', op: op, student: student, token: token, app: LEASE_APP };
        // Tests replace the network with a function; nothing else sets this.
        if (typeof window.__gateLeaseTransport === 'function') {
            return Promise.resolve().then(() => window.__gateLeaseTransport(op, params)).catch(() => null);
        }
        return jsonp(params);
    }

    // On the way out there is no time to wait for a reply — sendBeacon is the
    // one request a closing page is guaranteed to get out.
    function leaseRelease(student, token) {
        const params = { action: 'lease', op: 'release', student: student, token: token, app: LEASE_APP };
        if (typeof window.__gateLeaseTransport === 'function') {
            try { window.__gateLeaseTransport('release', params); } catch (e) {}
            return;
        }
        try {
            if (LEASE_ENDPOINT && navigator.sendBeacon) navigator.sendBeacon(LEASE_ENDPOINT, JSON.stringify(params));
        } catch (e) {}
    }

    const lease = { student: null, token: null, timer: null, lastBeat: 0, dead: false, id: newToken(), ch: null };

    function signOut(msg, keepToken) {
        lease.dead = true;
        if (lease.timer) clearInterval(lease.timer);
        try { if (lease.ch) lease.ch.close(); } catch (e) {}
        try {
            sessionStorage.removeItem(STORAGE_KEY);
            sessionStorage.removeItem(USER_KEY);
            sessionStorage.removeItem(ROLE_KEY);
            if (!keepToken) sessionStorage.removeItem(LEASE_TOKEN_KEY);
            sessionStorage.setItem(LEASE_MSG_KEY, msg);
        } catch (e) {}
        (window.__gateReload || function () { location.reload(); })();
    }

    function beat() {
        if (lease.dead || !lease.token) return Promise.resolve(null);
        lease.lastBeat = Date.now();
        return leaseCall('beat', lease.student, lease.token).then(r => {
            // Only an explicit refusal signs out. null (unreachable) keeps working.
            if (r && r.ok === false && r.reason === 'held' && !lease.dead) signOut(MSG_LOST);
            return r;
        });
    }

    // Keep the lease alive for as long as this page is open.
    //   announce — this page loaded already unlocked, so it may be a DUPLICATED
    //   tab. It says hello on the channel; an established page holding the same
    //   token answers "here", and whenever that answer arrives — however late,
    //   a heavy page can block the main thread for a second — the newcomer signs
    //   out. Only a page alive for over a second answers, so two tabs booting at
    //   the same instant do not sign each other out.
    function holdLease(student, token, firstBeatMs, announce) {
        lease.student = student; lease.token = token; lease.born = Date.now();
        try { sessionStorage.setItem(LEASE_TOKEN_KEY, token); } catch (e) {}
        lease.timer = setInterval(beat, LEASE_BEAT_MS);
        // Two early beats, not one: this page's first beat can reach the script
        // BEFORE the previous page's release beacon does, and that late release
        // would age the lease. The second beat, ten seconds on, renews it.
        if (firstBeatMs != null) { setTimeout(beat, firstBeatMs); setTimeout(beat, firstBeatMs + 10000); }
        document.addEventListener('visibilitychange', () => {
            // A laptop waking up: check straight away rather than on the next tick.
            if (document.visibilityState === 'visible' && Date.now() - lease.lastBeat > 10000) beat();
        });
        window.addEventListener('pageshow', e => { if (e.persisted) beat(); });
        window.addEventListener('pagehide', () => { if (!lease.dead) leaseRelease(lease.student, lease.token); });
        try {
            lease.ch = new BroadcastChannel(LEASE_CHANNEL);
            lease.ch.onmessage = e => {
                const m = e.data || {};
                if (lease.dead || m.token !== lease.token) return;
                if (m.t === 'hello' && m.id !== lease.id && Date.now() - lease.born > 1000) {
                    lease.ch.postMessage({ t: 'here', token: lease.token, to: m.id });
                } else if (m.t === 'here' && m.to === lease.id) {
                    signOut(MSG_DUPLICATE, true);    // keep the token: it belongs to the other tab
                }
            };
            if (announce) lease.ch.postMessage({ t: 'hello', token: token, id: lease.id });
        } catch (e) { /* no BroadcastChannel: duplicated tabs go undetected, nothing else changes */ }
    }

    // Test hook. Read-only view plus a way to force a beat without waiting a minute.
    window.__gateLease = { beat: beat, state: () => ({ student: lease.student, token: lease.token, dead: lease.dead }) };

    // Expose a global lock function so the hub can offer a "Lock" button.
    // Defined unconditionally so it works whether or not the gate fired.
    window.lockMastery = function () {
        if (lease.token && !lease.dead) { lease.dead = true; leaseRelease(lease.student, lease.token); }
        sessionStorage.removeItem(LEASE_TOKEN_KEY);
        sessionStorage.removeItem(STORAGE_KEY);
        sessionStorage.removeItem(USER_KEY);
        sessionStorage.removeItem(ROLE_KEY);
        location.reload();
    };

    // Already unlocked? Render normally — but an unlock is not a blank cheque.
    // The session flag alone said "somebody typed a valid password", which let a
    // student who had unlocked the app walk straight into a tutor page. On a
    // tutor page the ROLE must match; anything else re-prompts.
    //
    // A student page that is already unlocked still owes the lease a check: a
    // beat, which re-claims a free lease and signs this page out if another
    // screen holds it, and a hello in case this is a duplicated tab. The page
    // renders meanwhile.
    try {
        if (sessionStorage.getItem(STORAGE_KEY) === SESSION_FLAG) {
            if (REQUIRE !== 'tutor' || sessionStorage.getItem(ROLE_KEY) === 'tutor') {
                if (ss(ROLE_KEY) === 'student' && ss(USER_KEY)) {
                    holdLease(ss(USER_KEY), ss(LEASE_TOKEN_KEY) || newToken(), 0, true);
                }
                return;
            }
        }
    } catch (e) { /* sessionStorage unavailable — fall through to gate */ }

    // Inject a stylesheet that hides the page until either the overlay is
    // mounted or the gate is dismissed. Done inline so it applies before
    // any layout/paint happens.
    const hideStyle = document.createElement('style');
    hideStyle.id = '__gateHideStyle';
    hideStyle.textContent = 'html{visibility:hidden!important}';
    (document.head || document.documentElement).appendChild(hideStyle);

    function onReady(fn) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn, { once: true });
        } else {
            fn();
        }
    }

    async function sha256Hex(text) {
        const buf  = new TextEncoder().encode(text);
        const hash = await crypto.subtle.digest('SHA-256', buf);
        return [...new Uint8Array(hash)]
            .map(b => b.toString(16).padStart(2, '0')).join('');
    }

    onReady(() => {
        const overlay = document.createElement('div');
        overlay.id = '__gateOverlay';
        overlay.style.cssText = [
            'position:fixed', 'inset:0', 'z-index:2147483647',
            'background:#0f172a',
            'display:flex', 'align-items:center', 'justify-content:center',
            'padding:1.5rem',
            'font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif',
        ].join(';');

        overlay.innerHTML = `
          <div style="background:#fff;border-radius:1rem;padding:2rem 1.75rem;
                      max-width:380px;width:100%;
                      box-shadow:0 20px 50px rgba(0,0,0,0.35)">
            <div style="display:flex;align-items:center;gap:0.5rem;
                        font-size:0.78rem;font-weight:700;color:#2563eb;
                        margin-bottom:1.25rem;letter-spacing:0.04em;
                        text-transform:uppercase">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2.5">
                <rect x="3" y="11" width="18" height="11" rx="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              SAT Mastery
            </div>
            <h2 style="margin:0 0 0.4rem;font-size:1.25rem;font-weight:700;
                       color:#0f172a">Password required</h2>
            <p style="margin:0 0 1.25rem;color:#64748b;font-size:0.88rem;
                      line-height:1.45">
              Enter your password to unlock the app for this browser session.
            </p>
            <input id="__gateInput" type="password" autocomplete="off"
                   spellcheck="false" autocapitalize="off"
                   placeholder="Password"
                   style="width:100%;padding:0.7rem 0.85rem;border:1.5px solid #e2e8f0;
                          border-radius:0.55rem;font-size:1rem;outline:none;
                          box-sizing:border-box;font-family:inherit;
                          transition:border-color 0.15s"/>
            <div id="__gateError"
                 style="color:#dc2626;font-size:0.8rem;margin-top:0.5rem;
                        min-height:1.2rem;font-weight:600"></div>
            <button id="__gateBtn"
                    style="margin-top:0.5rem;width:100%;padding:0.75rem;
                           background:#2563eb;color:#fff;border:none;
                           border-radius:0.55rem;font-size:0.95rem;font-weight:600;
                           cursor:pointer;font-family:inherit;
                           transition:background 0.15s">
              Unlock
            </button>
          </div>
        `;
        document.body.appendChild(overlay);

        // Reveal html now that the overlay is in place — the overlay covers
        // the underlying page until unlock succeeds.
        hideStyle.remove();

        const input = document.getElementById('__gateInput');
        const errEl = document.getElementById('__gateError');
        const btn   = document.getElementById('__gateBtn');

        input.focus();
        const pending = ss(LEASE_MSG_KEY);
        if (pending) { errEl.textContent = pending; try { sessionStorage.removeItem(LEASE_MSG_KEY); } catch (e) {} }
        input.addEventListener('focus', () => { input.style.borderColor = '#2563eb'; });
        input.addEventListener('blur',  () => { input.style.borderColor = '#e2e8f0'; });
        btn.addEventListener('mouseenter', () => { btn.style.background = '#1d4ed8'; });
        btn.addEventListener('mouseleave', () => { btn.style.background = '#2563eb'; });

        async function tryUnlock() {
            const pwd = (input.value || '').trim().toLowerCase();
            if (!pwd) return;
            btn.disabled = true;
            let hash;
            try {
                hash = await sha256Hex(pwd);
            } catch (e) {
                errEl.textContent = 'Browser does not support SHA-256';
                btn.disabled = false;
                return;
            }
            // TABLE, not ACCEPTED_HASHES: on a tutor page it holds only the
            // tutor passphrase, so a student password does not open it.
            if (TABLE[hash]) {
                const isTutor = !!TUTOR_HASHES[hash];
                const token = newToken();
                if (!isTutor) {
                    // One login at a time. Only an explicit refusal keeps the
                    // gate shut; no answer at all lets the student in.
                    btn.textContent = 'Checking\u2026';
                    const r = await leaseCall('acquire', TABLE[hash], token);
                    btn.textContent = 'Unlock';
                    if (r && r.ok === false && r.reason === 'held') {
                        errEl.textContent = MSG_REFUSED;
                        input.value = '';
                        input.focus();
                        btn.disabled = false;
                        return;
                    }
                }
                try {
                    sessionStorage.setItem(STORAGE_KEY, SESSION_FLAG);
                    sessionStorage.setItem(USER_KEY, TABLE[hash]);
                    sessionStorage.setItem(ROLE_KEY, isTutor ? 'tutor' : 'student');
                } catch (e) {}
                if (!isTutor) holdLease(TABLE[hash], token, 5000, false);
                overlay.remove();
            } else {
                errEl.textContent = 'Incorrect password';
                input.value = '';
                input.focus();
                btn.disabled = false;
            }
        }

        btn.addEventListener('click', tryUnlock);
        input.addEventListener('input',   () => { errEl.textContent = ''; });
        input.addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); tryUnlock(); }
        });
    });
})();
