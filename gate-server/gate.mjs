// gate-server/gate.mjs — the server-side password check (Hub decision D1, action 3).
//
// Runs as Cloudflare Pages middleware (functions/_middleware.js) in front of
// EVERY request, before any file is served. A visitor without a valid sign-in
// cookie gets the sign-in page and nothing else. The same file is used by the
// three apps; keep the copies identical (gate.test.mjs checks behaviour, not
// the copies).
//
// Settings (Cloudflare Pages → Settings → Variables and Secrets, type Secret):
//   GATE_SECRET     random, 32+ characters; signs the sign-in cookie.
//   GATE_USERS      JSON list, one entry per person:
//                   [{"name":"<label>","role":"student"|"tutor","hash":"<64 hex>"}]
//                   hash = SHA-256 of "edutrack-gate:" + the normalised password
//                   (gate-server/password.mjs prints entries; it also makes the password).
//   GATE_FETCH_KEY  optional, 32+ characters; lets the tutor sheet's Apps Script
//                   fetch the files listed in config.keyedPaths with ?key=<value>.
// Nothing is configured → every request is refused (fails closed).
//
// Why SHA-256 and not a slow hash: passwords are generated (about 59 bits, see
// password.mjs), the hashes live only in a secret setting, and the free plan
// allows about 10 ms of CPU per request; a slow hash per person would exceed it.
//
// Signing out of the app (the existing Lock / Log out buttons) goes through
// /__gate/logout, which clears the cookie. Removing a person from GATE_USERS
// signs them out on their next request.

const COOKIE = 'et_gate';
const WHO = 'et_who'; // readable by the page: who signed in, for gate.js (not a credential)
const MAX_AGE = 30 * 24 * 3600;
const enc = new TextEncoder();

export function normalise(password) {
  return String(password || '').toLowerCase().replace(/[\s-]+/g, '');
}

export async function passwordHash(password) {
  const buf = await crypto.subtle.digest('SHA-256', enc.encode('edutrack-gate:' + normalise(password)));
  return hex(buf);
}

function hex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function b64url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(text) {
  const s = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

function same(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

async function sign(secret, text) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(text))));
}

/** The settings, or null when they are missing or malformed. */
export function settings(env) {
  const secret = env?.GATE_SECRET;
  if (typeof secret !== 'string' || secret.length < 32) return null;
  let users;
  try { users = JSON.parse(env.GATE_USERS || ''); } catch { return null; }
  if (!Array.isArray(users) || !users.length) return null;
  const clean = users.filter((u) => u && typeof u.name === 'string' && u.name.trim()
    && (u.role === 'student' || u.role === 'tutor') && /^[0-9a-f]{64}$/.test(u.hash || ''));
  if (clean.length !== users.length) return null;
  const fetchKey = typeof env.GATE_FETCH_KEY === 'string' && env.GATE_FETCH_KEY.length >= 32 ? env.GATE_FETCH_KEY : null;
  return { secret, users: clean, fetchKey };
}

async function readSession(request, s, now) {
  const raw = cookie(request, COOKIE);
  if (!raw || !raw.includes('.')) return null;
  const [body, sig] = raw.split('.');
  if (!same(sig, await sign(s.secret, body))) return null;
  let v;
  try { v = JSON.parse(new TextDecoder().decode(fromB64url(body))); } catch { return null; }
  if (!v || typeof v.exp !== 'number' || v.exp * 1000 <= now) return null;
  // Still listed, with the same role and password: removing or changing an entry signs the person out.
  const u = s.users.find((x) => x.name === v.n && x.role === v.r);
  return u && same(await mark(s.secret, u.hash), v.h) ? { name: u.name, role: u.role } : null;
}

// Ties a cookie to the password it was issued for, without putting the hash in the cookie.
async function mark(secret, hash) {
  return (await sign(secret, 'password:' + hash)).slice(0, 16);
}

function cookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

function page(status, title, inner, headers = {}) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${title}</title><style>
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0f172a;
font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:16px;box-sizing:border-box}
main{background:#fff;border-radius:16px;padding:28px 24px;width:100%;max-width:360px;box-sizing:border-box}
h1{margin:0 0 16px;font-size:20px;color:#0f172a}label{display:block;font-size:14px;color:#334155;margin-bottom:6px}
input{width:100%;box-sizing:border-box;padding:12px;border:1.5px solid #cbd5e1;border-radius:10px;font-size:16px}
button,a.b{display:block;width:100%;box-sizing:border-box;margin-top:14px;padding:12px;border:0;border-radius:10px;
background:#2563eb;color:#fff;font-size:16px;font-weight:600;text-align:center;text-decoration:none;cursor:pointer}
p.e{color:#b91c1c;font-size:14px;margin:10px 0 0}</style></head><body><main>${inner}</main></body></html>`;
  return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex', ...headers } });
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function signInPage(status, next, error, appName) {
  return page(status, `Sign in - ${esc(appName)}`, `<h1>${esc(appName)}</h1>
<form method="post" action="/__gate/login"><label for="p">Password</label>
<input id="p" name="password" type="password" autocomplete="current-password" autocapitalize="off" spellcheck="false" required autofocus>
<input type="hidden" name="next" value="${esc(next)}">${error ? `<p class="e">${esc(error)}</p>` : ''}
<button type="submit">Sign in</button></form>`);
}

/** Only a path on this site: no scheme, no host, no backslash tricks. */
function safeNext(next) {
  return typeof next === 'string' && /^\/(?![/\\])[^\s]*$/.test(next) && !next.startsWith('/__gate') ? next : '/';
}

function wantsPage(request, path) {
  return request.method === 'GET' && (path.endsWith('/') || path.endsWith('.html') || (request.headers.get('Accept') || '').includes('text/html'));
}

/**
 * Handle one request. `next` serves the static file (context.next() on Pages).
 * config: { app, tutorPaths: ['/tutor-dashboard.html', ...], keyedPaths: ['/homework/assignments.js'] }
 */
export async function handle(request, env, next, config, now = Date.now()) {
  const url = new URL(request.url);
  const path = decodeURIComponent(url.pathname);
  // The gate's own code and the build folders are never served.
  if (/^\/(gate-server|functions)(\/|$)/.test(path)) return new Response('Not found', { status: 404 });

  const s = settings(env);
  if (!s) return page(503, 'Not available', '<h1>Not available</h1><p class="e">Sign-in is not set up yet.</p>');

  if (path === '/__gate/logout') {
    const clear = (n) => `${n}=; Path=/; Max-Age=0; Secure; SameSite=Lax`;
    return new Response(null, { status: 303, headers: [['Location', '/__gate/login'], ['Cache-Control', 'no-store'], ['Set-Cookie', `${clear(COOKIE)}; HttpOnly`], ['Set-Cookie', clear(WHO)]] });
  }

  if (path === '/__gate/login') {
    if (request.method === 'GET') return signInPage(200, safeNext(url.searchParams.get('next')), '', config.app);
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, POST' } });
    const origin = request.headers.get('Origin');
    if (origin && origin !== url.origin) return new Response('Forbidden', { status: 403 });
    let form;
    try { form = await request.formData(); } catch { form = new FormData(); }
    const next = safeNext(form.get('next'));
    const hash = await passwordHash(form.get('password'));
    const user = normalise(form.get('password')) ? s.users.find((u) => same(u.hash, hash)) : null;
    if (!user) return signInPage(401, next, 'Incorrect password', config.app);
    const body = b64url(enc.encode(JSON.stringify({ n: user.name, r: user.role, h: await mark(s.secret, user.hash), exp: Math.floor(now / 1000) + MAX_AGE })));
    const who = b64url(enc.encode(JSON.stringify({ n: user.name, r: user.role })));
    const attrs = `Path=/; Max-Age=${MAX_AGE}; Secure; SameSite=Lax`;
    return new Response(null, { status: 303, headers: [['Location', next], ['Cache-Control', 'no-store'],
      ['Set-Cookie', `${COOKIE}=${body}.${await sign(s.secret, body)}; ${attrs}; HttpOnly`], ['Set-Cookie', `${WHO}=${who}; ${attrs}`]] });
  }

  // The tutor sheet's Apps Script reads these files from Google's servers, with a key.
  if (config.keyedPaths?.includes(path) && s.fetchKey && same(url.searchParams.get('key') || '', s.fetchKey)) {
    return privately(await next());
  }

  const who = await readSession(request, s, now);
  if (!who) {
    if (wantsPage(request, path)) {
      return new Response(null, { status: 302, headers: { Location: `/__gate/login?next=${encodeURIComponent(path + url.search)}`, 'Cache-Control': 'no-store' } });
    }
    return new Response('Sign in first', { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
  const tutorPage = config.tutorPaths?.includes(path) || (path.endsWith('/') && config.tutorPaths?.includes(path + 'index.html'));
  if (tutorPage && who.role !== 'tutor') {
    return page(403, 'Tutors only', '<h1>Tutors only</h1><a class="b" href="/__gate/logout">Sign in as a tutor</a>');
  }
  return privately(await next());
}

// Signed-in content must not sit in a shared cache.
function privately(response) {
  const r = new Response(response.body, response);
  r.headers.set('Cache-Control', 'private, no-cache');
  r.headers.set('X-Robots-Tag', 'noindex');
  return r;
}
