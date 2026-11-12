// gate-server/password.mjs — make a password and its GATE_USERS entry.
//
//   node gate-server/password.mjs "<label>" student
//   node gate-server/password.mjs "<label>" tutor
//
// Prints a new random password (give it to that person) and the JSON entry to
// add to the GATE_USERS secret in Cloudflare Pages. The label is what the tutor
// sheet records, as the old gate's labels were. Nothing is written to disk;
// never commit a password or a GATE_USERS value.
//
// Passwords are 12 characters from 31 (letters and digits without 0, 1, i, l, o):
// about 59 bits, so a fast hash in a secret setting is enough (gate.mjs).
// Spaces, hyphens and capitals are ignored when typed.

import { pathToFileURL } from 'node:url';
import { passwordHash } from './gate.mjs';

const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

export function newPassword() {
  const out = [];
  const bytes = new Uint8Array(32);
  while (out.length < 12) {
    crypto.getRandomValues(bytes);
    for (const b of bytes) if (b < 248 && out.length < 12) out.push(ALPHABET[b % 31]);
  }
  return [0, 4, 8].map((i) => out.slice(i, i + 4).join('')).join('-');
}

async function main() {
  const [name, role] = process.argv.slice(2);
  if (!name || !['student', 'tutor'].includes(role)) {
    console.error('Usage: node gate-server/password.mjs "<label>" student|tutor');
    process.exit(2);
  }
  const password = newPassword();
  console.log(`Password for ${name}: ${password}`);
  console.log('GATE_USERS entry:');
  console.log(JSON.stringify({ name, role, hash: await passwordHash(password) }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
