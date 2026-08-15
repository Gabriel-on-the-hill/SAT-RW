# Retired challenge set — p8-rw (Practice 8 misses)

**Retired 11 August 2026.** Removed from `challenge/sets.js` so it is no longer served.
Kept here verbatim because the 28 ids are the denominator of "Mastered 9 of 28" — a number
Jeffrey has already been shown — and rule 1 of `sets.js` makes ids immutable.

**Why retired.** Superseded by `p11-rw`. At 02:23 on 10 August it was run by accident: `p11-rw`
had been promised but not yet committed, so this was the only set in his hub.

**State at retirement**, reconstructed from the app's question export (his browser ledger is
authoritative and was not readable): 28 ids · 9 mastered · 17 seen not mastered · 2 never
served (`03080769`, `08395130`).

**To restore:** paste the block below back into `window.CHALLENGE_SETS.Jeffrey`, above `p11-rw`.

```js
p8-rw is commented out, not deleted. Its ids are the denominator of
"Mastered 9 of 28" — a number he has already been shown — and rule 1
says they are immutable. Retiring a set from the roster is not the
same act as editing it, but the ids stay in the file so the number
stays reconstructable.
        //
WHY IT IS RETIRED. It is the Practice 8 set, frozen 10 July and
superseded by p11-rw. At 02:23 on 10 August it was run by accident:
p11-rw had been promised but not yet committed, so it was the only
set in the hub. Removing it removes that failure mode.
        //
STATE AT RETIREMENT, reconstructed from the app's own question export
(his browser ledger is authoritative and was not readable):
  28 ids · 9 mastered · 17 seen not mastered · 2 never served
  (never served: 03080769, 08395130)
        //
To restore it, uncomment. Nothing else needs to change.
{
// `-rw` because his Practice 8 MATH misses are a separate set, in a
// separate app: Michael SAT's Challenge_App/data/jeffrey.js.
setId:  'p8-rw',
title:  'Practice 8 misses',
source: 'SAT Practice Test 8',
date:   '2026-07-04',
        //
// Layer 1 — the debrief. 16 verbatim R&W misses, UNSCORED: these
// ids are in no bank, so they never enter the mastery denominator.
// The score report records 23 R&W incorrect, so 7 are absent.
review: (typeof CHALLENGE_P8 !== 'undefined') ? CHALLENGE_P8 : null,
        //
// Layer 2 — FROZEN 10 July 2026 from challenge/shortlist-jeffrey-p8-rw.md.
// 28 bank questions: siblings of his misses, matched on skill and (for
// Conventions) ruleType, each skill carrying at least one Hard and one
// Medium. Per-domain quotas come from the 4 July score-report bars, not
// from the captured miss counts — the capture over-samples Standard
// English Conventions (bar 5/7) and under-samples Information & Ideas
// (bar 2/7). Selected with zero fallbacks: every id is an exact match.
//
// DO NOT EDIT. These ids are the denominator of "Mastered N of 28".
// A new practice test appends a new set; it never rewrites this one.
ids: [
'0094f813', '084e8a77', '0252e6a1', '133abbda',
'0b5ecf0e', '032fd227', '0c61d9c0', '105ea6de',
'03080769', '17bf10de', '040583a5', '0c622cfb',
'04cbeca3', '1d08c7ee', '03701ef3', '299c5303',
'08395130', '350e2336', '0dba14e6', '3882ddf6',
'10cd0327', '0778b4ac', 'c468db1c', 'c101fc44',
'2bb7416a', '50801257', '67614549', 'de3dd17d',
],
},
```
