// gate-server/gate.test.mjs — run: node --test gate-server/gate.test.mjs
// The server-side gate (gate.mjs): nothing is served without a valid sign-in,
// no student opens a tutor page, and the keyed fetch opens only its own files.
import test from 'node:test';
import assert from 'node:assert/strict';
import { handle, passwordHash, normalise } from './gate.mjs';
import { newPassword } from './password.mjs';
import config from './config.mjs';

const SITE = 'https://app.example.pages.dev';
const config_ = { app: 'Test app', tutorPaths: ['/tutor-dashboard.html'], keyedPaths: ['/homework/assignments.js'] };
const STUDENT_PW = 'abcd-efgh-jkmn';
const TUTOR_PW = 'pqrs-tuvw-xyz2';
const env = async (extra = {}) => ({
  GATE_SECRET: 's'.repeat(40),
  GATE_USERS: JSON.stringify([
    { name: 'Student A', role: 'student', hash: await passwordHash(STUDENT_PW) },
    { name: 'Tutor', role: 'tutor', hash: await passwordHash(TUTOR_PW) },
  ]),
  GATE_FETCH_KEY: 'k'.repeat(40),
  ...extra,
});
const served = [];
const next = async () => { served.push(1); return new Response('FILE', { headers: { 'Cache-Control': 'public, max-age=3600' } }); };
const req = (path, init = {}) => new Request(SITE + path, init);
const go = async (r, e, now) => handle(r, e || await env(), next, config_, now);

async function signIn(password, e) {
  const body = new URLSearchParams({ password, next: '/index.html' });
  const r = await go(req('/__gate/login', { method: 'POST', body, headers: { Origin: SITE } }), e);
  const cookies = r.headers.getSetCookie();
  return { r, cookie: cookies.map((c) => c.split(';')[0]).join('; '), cookies };
}

test('every file needs a sign-in: pages redirect to the sign-in page, other files get 401', async () => {
  served.length = 0;
  const page = await go(req('/index.html'));
  assert.equal(page.status, 302);
  assert.equal(page.headers.get('Location'), '/__gate/login?next=%2Findex.html');
  const data = await go(req('/data-conventions.js'));
  assert.equal(data.status, 401);
  const root = await go(req('/'));
  assert.equal(root.status, 302);
  assert.equal(served.length, 0, 'no file was served');
});

test('missing or weak settings refuse everything (fails closed)', async () => {
  served.length = 0;
  for (const e of [{}, await env({ GATE_SECRET: 'short' }), await env({ GATE_USERS: '[]' }), await env({ GATE_USERS: 'not json' }),
    await env({ GATE_USERS: JSON.stringify([{ name: 'X', role: 'admin', hash: 'a'.repeat(64) }]) })]) {
    const r = await handle(req('/index.html'), e, next, config_);
    assert.equal(r.status, 503);
  }
  assert.equal(served.length, 0);
});

test('a student password signs in; the cookie opens files; a wrong password does not', async () => {
  const bad = await signIn('wrong-password');
  assert.equal(bad.r.status, 401);
  assert.match(await bad.r.text(), /Incorrect password/);
  const empty = await signIn('');
  assert.equal(empty.r.status, 401);

  const { r, cookie, cookies } = await signIn(' ABCD efgh-JKMN ');
  assert.equal(r.status, 303);
  assert.equal(r.headers.get('Location'), '/index.html');
  assert.ok(cookies.some((c) => c.startsWith('et_gate=') && /HttpOnly/.test(c) && /Secure/.test(c)));
  assert.ok(cookies.some((c) => c.startsWith('et_who=') && !/HttpOnly/.test(c)));
  served.length = 0;
  const ok = await go(req('/data-conventions.js', { headers: { Cookie: cookie } }));
  assert.equal(ok.status, 200);
  assert.equal(await ok.text(), 'FILE');
  assert.equal(ok.headers.get('Cache-Control'), 'private, no-cache');
  assert.equal(served.length, 1);
});

test('the page can read who signed in, and nothing more', async () => {
  const { cookies } = await signIn(STUDENT_PW);
  const who = cookies.find((c) => c.startsWith('et_who=')).split(';')[0].slice(7);
  const v = JSON.parse(Buffer.from(who, 'base64url').toString());
  assert.deepEqual(v, { n: 'Student A', r: 'student' });
});

test('a forged, altered or expired cookie is refused', async () => {
  const { cookie } = await signIn(STUDENT_PW);
  const gate = cookie.split('; ').find((c) => c.startsWith('et_gate='));
  const [body, sig] = gate.slice(8).split('.');
  const asTutor = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, 'base64url')), r: 'tutor', n: 'Tutor' })).toString('base64url');
  for (const c of [`et_gate=${asTutor}.${sig}`, `et_gate=${body}.${sig.slice(0, -2)}xx`, 'et_gate=abc', 'et_who=eyJuIjoiVHV0b3IiLCJyIjoidHV0b3IifQ']) {
    const r = await go(req('/tutor-dashboard.html', { headers: { Cookie: c } }));
    assert.equal(r.status, 302, c);
  }
  const later = await go(req('/index.html', { headers: { Cookie: cookie } }), null, Date.now() + 31 * 24 * 3600 * 1000);
  assert.equal(later.status, 302);
});

test('removing a person, or changing their password, signs them out', async () => {
  const { cookie } = await signIn(STUDENT_PW);
  const removed = await env({ GATE_USERS: JSON.stringify([{ name: 'Tutor', role: 'tutor', hash: await passwordHash(TUTOR_PW) }]) });
  assert.equal((await go(req('/index.html', { headers: { Cookie: cookie } }), removed)).status, 302);
  const changed = await env({ GATE_USERS: JSON.stringify([{ name: 'Student A', role: 'student', hash: await passwordHash('new-pass-word') }]) });
  assert.equal((await go(req('/index.html', { headers: { Cookie: cookie } }), changed)).status, 302);
});

test('no student opens a tutor page; a tutor does', async () => {
  const student = await signIn(STUDENT_PW);
  const r = await go(req('/tutor-dashboard.html', { headers: { Cookie: student.cookie } }));
  assert.equal(r.status, 403);
  // Cloudflare Pages also serves /x.html as /x; every spelling must be refused.
  for (const p of ['/tutor-dashboard', '/tutor-dashboard/', '/Tutor-Dashboard.HTML', '/TUTOR-DASHBOARD']) {
    assert.equal((await go(req(p, { headers: { Cookie: student.cookie } }))).status, 403, p);
  }
  const tutor = await signIn(TUTOR_PW);
  assert.equal((await go(req('/tutor-dashboard.html', { headers: { Cookie: tutor.cookie } }))).status, 200);
});

test('the keyed fetch opens only its listed file, only with the right key', async () => {
  const k = 'k'.repeat(40);
  assert.equal((await go(req(`/homework/assignments.js?key=${k}`))).status, 200);
  assert.equal((await go(req('/homework/assignments.js?key=wrong'))).status, 401);
  assert.equal((await go(req('/homework/assignments.js'))).status, 401);
  assert.equal((await go(req(`/data-conventions.js?key=${k}`))).status, 401);
  assert.equal((await go(req(`/homework/assignments.js?key=${'k'.repeat(10)}`), await env({ GATE_FETCH_KEY: 'k'.repeat(10) }))).status, 401, 'a short key is ignored');
});

test('the gate code is never served, signed in or not', async () => {
  const { cookie } = await signIn(TUTOR_PW);
  for (const p of ['/gate-server/gate.mjs', '/functions/_middleware.js', '/gate-server/']) {
    assert.equal((await go(req(p, { headers: { Cookie: cookie } }))).status, 404, p);
  }
});

test('sign-in sends people back only to a path on this site, and refuses other origins', async () => {
  for (const [nextPath, expected] of [['/homework-hub.html?x=1', '/homework-hub.html?x=1'], ['https://evil.example', '/'], ['//evil.example', '/'], ['/\\evil.example', '/'], ['/__gate/logout', '/']]) {
    const body = new URLSearchParams({ password: STUDENT_PW, next: nextPath });
    const r = await go(req('/__gate/login', { method: 'POST', body, headers: { Origin: SITE } }));
    assert.equal(r.headers.get('Location'), expected, nextPath);
  }
  const cross = await go(req('/__gate/login', { method: 'POST', body: new URLSearchParams({ password: STUDENT_PW }), headers: { Origin: 'https://evil.example' } }));
  assert.equal(cross.status, 403);
});

test('the sign-in page escapes what it echoes', async () => {
  const r = await go(req('/__gate/login?next=%2F%22%3E%3Cscript%3E'));
  const html = await r.text();
  assert.equal(r.status, 200);
  assert.ok(!html.includes('"><script>'));
});

test('sign-out clears both cookies', async () => {
  const r = await go(req('/__gate/logout'));
  assert.equal(r.status, 303);
  const c = r.headers.getSetCookie();
  assert.ok(c.some((x) => x.startsWith('et_gate=;') && /Max-Age=0/.test(x)));
  assert.ok(c.some((x) => x.startsWith('et_who=;') && /Max-Age=0/.test(x)));
});

test('generated passwords are 12 characters from 31, typed in any case', async () => {
  const seen = new Set();
  for (let i = 0; i < 200; i++) {
    const p = newPassword();
    assert.match(p, /^[a-hjkmnp-z2-9]{4}-[a-hjkmnp-z2-9]{4}-[a-hjkmnp-z2-9]{4}$/);
    seen.add(p);
  }
  assert.equal(seen.size, 200);
  assert.equal(normalise('AB cd-EF'), 'abcdef');
});

test("this app's tutor pages are the ones that ask for a tutor in the browser", async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const found = [];
  const walk = (dir) => {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      if (['.git', 'node_modules', '_archive'].includes(f.name)) continue;
      const p = path.join(dir, f.name);
      if (f.isDirectory()) walk(p);
      else if (f.name.endsWith('.html') && /GATE_REQUIRE\s*=\s*['"]tutor['"]/.test(fs.readFileSync(p, 'utf8'))) found.push('/' + path.relative(root, p).split(path.sep).join('/'));
    }
  };
  walk(root);
  for (const p of found) assert.ok(config.tutorPaths.includes(p), `${p} asks for a tutor but is not in config.tutorPaths`);
});
