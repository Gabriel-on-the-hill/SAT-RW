# Retired challenge set — p11-rw (Practice 11 misses)

**Retired 18 August 2026.** Commented out in `challenge/sets.js` so it is no longer served.
Kept because the 22 ids are the denominator of "Mastered N of 22" — a number already shown —
and rule 1 makes ids immutable.

**Why retired.** Superseded by the two skill sets committed the same day, `bnd-aug` and
`trn-aug`. The roster was cleared at the tutor's instruction so that the hub carries only the
current work for the last week before the exam. Retiring a set from the roster is not the same
act as editing it; the ids stay in `sets.js`, commented, so the number stays reconstructable.

**State at retirement:** not read. The browser ledger is authoritative and was not available.
The set was committed 9 August and served from then.

**Layer 1 note.** Its `review` layer pointed at `CHALLENGE_P11`, the 17 verbatim misses. Two of
those are partial and carry `partial: true` in the data file — one missing options C and D, one
holding its figure only. That data file is untouched by this retirement.

**To restore:** uncomment the block in `challenge/sets.js`. Nothing else needs to change.

---

## Pool note carried forward

The p11-rw header recorded, for whoever built the next set:

> Conventions still holds nine unseen Boundaries at Medium/Hard — move the quota there.

`bnd-aug` is that move. After it, the free Conventions pool is: **Semi/Hard 1 · Dash/Hard 1 ·
Colon/Hard 1 (`fba5d8d1`, the only unseen colon item in the bank — held back deliberately) ·
Commas Medium 10, Hard 8 · NoPunct Medium 2, Hard 3.** Commas is the only deep pool left.

`trn-aug` releases the 20 Transitions ids reserved by the legacy `transitions` entry in
`HW_ASSIGNMENTS`, which the hub and runner do not read. Eight are taken; **twelve remain**.
