# Retired challenge set — bnd-trn-aug (Punctuation and transitions — name it before you look)

**Retired 23 August 2026.** Commented out in `challenge/sets.js` so it is no longer served.
Kept because the 18 ids are the denominator of "Mastered N of 18" — a number already shown —
and rule 1 makes ids immutable.

**Why retired.** Not because it failed. Because it worked and the target moved.

The set was committed 18 August against the first module of the section, which had been the
constraint since July. Two score reports since then state the first-module figure outright
instead of leaving it to be back-solved — **22 of 27, then 25 of 27**, against back-solves near
16 in early August. Both reports also say, in the student's own account, that the loss has moved
to the **second** module, and the second report puts the other section at its lowest on record
off an equally strong first module. Four points remain where this set was aimed. Twenty days
remain before the next sitting.

Superseded by `ii-claim-aug23`, committed the same day this one was retired, which is Hard-only
and aimed at the second module. Retiring a set from the roster is not the same act as editing
it; the ids stay in `sets.js`, commented, so the number stays reconstructable.

**State at retirement:** not read. The browser ledger is authoritative and was not available
here. The set was committed 18 August and served from then, across the week of the 22 August
sitting.

**To restore:** uncomment the block in `challenge/sets.js` and point `challenge:` in
`homework/assignments.js` back at `bnd-trn-aug`. Nothing else needs to change. Note that
restoring it as the LAST entry is what makes it served again — `boot()` takes
`sets[sets.length - 1]`.

---

## The ids

Eighteen, in the committed order: ten punctuation selected by `ruleType`, eight transitions
selected by category, alternating in blocks so a short first pass met both skills.

```
790fc366  f78997cf  a9e5b788  78b88c04
176edca6  974b5a8c  e3edc138  2df7b582
78e978b5  403d7bb5  6d4b2e1e
221ecf0f  f8c4591b  3fd0ab63  17e49403
109d5bbb  1aa3f174
5670a657
```

---

## Pool notes carried forward

The bnd-trn-aug header recorded that **Colon** was left alone at one unseen item bank-wide on
this key, and that a one-item pool cannot support a scored slot. That still holds.

`ii-claim-aug23` adds one of its own, and it is the sharper constraint for whoever builds next:
**Command of Evidence — Quantitative is down to two Hard items on this key.** Nothing in the
bank replaces them. A set or a homework section asking for CoE-Q at Hard will silently backfill
and test nothing. Draw it at Medium, or import fresh items.
