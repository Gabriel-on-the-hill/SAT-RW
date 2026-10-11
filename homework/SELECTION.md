# Precise homework

Use `assign.html` as a tutor to select a skill, a grammar method where applicable, one difficulty per question, and a purpose. Inspect questions and tutor keys before choosing preferred IDs and ordered backups. The fill button uses matching official items and avoids spending later primaries as reserves. Review the counts, distribution, history coverage and backup warnings before copying the generated plan into `homework/assignments.js`.

The daily runner accepts ordered `slots`. Existing sections and catalogue plans retain their previous behaviour. A slot has `skills`, `diffs`, optional `ruleType`, `intent` (`fresh`, `review`, or `follow-up`), `preferredId`, `reserveIds` and optional `allowPool`. Without `allowPool: true`, exhausted reserves leave a visible unresolved question. Fallback, when enabled, stays within the exact skill, method and difficulty. Canonical IDs and aliases are one item. Baseline forms and explicit plan/day `heldIds` are protected from new selection.

```js
{ n:1, focus:"Agreement practice", review:0, minutes:0,
  slots:[{skills:["Form, Structure, and Sense"], diffs:["Medium"],
    ruleType:"SVA", intent:"fresh", preferredId:"OFFICIAL_ID",
    reserveIds:["MATCHED_BACKUP_ID"], allowPool:false}],
  tip:"Predict before looking at the choices." }
```

Replace the illustrative IDs with verified bank IDs. Author a new set rather than changing one after answers have been committed. Precise sets reopen as review after completion; they do not redraw a second first attempt. Add deliberate review slots explicitly; the legacy automatic review ladder does not append questions to precise sets. Repeated work is not labelled fresh, and a deliberate review slot alone does not prove delayed retention.

## Private history imports

Import a Questions CSV containing `Student` and `Question ID`, or the student-only JSON file exported by the builder. Imports retain only that student's IDs in browser storage and merge conservatively with local mastery, exposure, baseline and class records. An import never credits mastery. Unknown IDs are retained and reported. A score without identifiable questions cannot establish exposure.

Transfer the student-only history file privately to the student's browser; the daily runner accepts it before each new set or when an untimed slot needs a backup. Updated external practice requires another import. **This release checks snapshots and local records. It does not fetch live history from the private sheet.** The import timestamp and source's last-row timestamp are displayed. No recorded exposure means the available records contain no match, not proof the student has never encountered it. Do not commit student histories or assessment notes to this public repository.

## Sitting integrity

The runner saves a manifest, resolved IDs, substitutions, navigation, predictions, answers and clock deadline. Reload resumes that sitting. Updated imports may replace unanswered untimed questions; committed answers stay fixed. In untimed fresh work, “I've seen this question before” records recognition without a scored attempt and tries a matching backup. An unresolved slot cannot complete the set; the other untimed questions remain accessible.

A timed set waits for every slot to resolve and an explicit Start. Once started, its questions and deadline stay fixed, including across reloads. Recognition during timed work is reported and excluded from fresh mastery evidence; the ordinary result still contains the answer under its actual conditions. Recognitions and substitutions are included in the existing session payload. A browser that cannot save the timed sitting cannot start it.

The old Plans sheet format cannot preserve slots and reserves. Use the generated assignment code for this version. Live cross-device refresh requires a separate private backend change and deployment, with real per-student access controls; the existing login lease is a deterrent, not sufficient authorization to expose question histories.

Before publishing the SAT frontend, redeploy the updated `tutor-sheet/rw-apps-script.md` script and run `setup` to append `Homework Selection`. Older deployments drop that field; question answers still arrive, but the selection manifest does not. PSAT already retains the entire session in its separate Raw payload column and does not need this schema change.

Run `homework/selection.test.js` with jsdom and the prescribed application suite before release. Mirror the feature in both R&W apps while preserving their difficulty scales, storage namespaces and different tutor-sheet backends.
