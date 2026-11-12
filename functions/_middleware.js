// Cloudflare Pages runs this before every request (Hub decision D1, action 3).
// The logic is in gate-server/gate.mjs; this app's pages are in gate-server/config.mjs.
import { handle } from '../gate-server/gate.mjs';
import config from '../gate-server/config.mjs';

export const onRequest = (context) => handle(context.request, context.env, () => context.next(), config);
