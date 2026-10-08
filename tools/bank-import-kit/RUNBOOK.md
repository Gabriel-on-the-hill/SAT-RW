# Question-bank import runbook

Read this file and the app's AGENTS.md before starting. This kit imports College Board question-bank PDF exports with the Question ID / Assessment / Test / Domain / Skill / Difficulty layout. It does not import scanned textbooks. Textbook extraction has its own guide at ../EXTRACTION-GUIDE.md.

## Invariants

1. IDs and their complete alias chains are permanent. The owner authorized retirement of book/provisional and PSAT-source records. Preserve retired records in an unloaded archive; keep every surviving record unchanged except separately listed source-verified repairs.
2. Phases 0-5 write only to the configured work folder. Figure crops are staged too. The live app and search mirror are untouched until installation.
3. Extract text with pdftotext -raw. Geometry controls layout and underlines, never characters. Preserve every option's punctuation and the complete explanation.
4. Put source repairs and duplicate decisions in the overrides file with a nonempty why. A configured file must exist; replacements must match exactly once. Keep the original source block alongside the effective block.
5. A gate failure means stop and fix its cause. Do not edit generated JSON or weaken an app test to make it pass.
6. Installation requires successful app and mirror tests, explicit owner review, and fingerprints matching the exact inputs, current app, and staged output. Any subsequent change requires verification again.
7. Source PDFs, extraction caches, reports, and rollback snapshots stay local in _bank-import-work/ and are ignored by Git. No student assessments or additional personal identifiers belong in public files. No attribution lines are added.
8. Do not commit or push. Hand the owner a scoped staging command. Do not run index-writing Git commands or move an index lock without first establishing that no Git operation is using it.

## 2 · Settle these with the owner BEFORE Phase 1

Ask the six questions from the source runbook together. extract.py and build.py stop with exit 3 unless owner_confirmation contains today's date, confirmed_by, and all six answers: pdfs_complete, retire, plan_files, follow_up_days, ruletype, mirrors. The actual calendar date is checked, so changing the config's today field cannot reuse an old confirmation. Configuration must agree with the answers. Do not fill in confirmation from inferred scope or an earlier import. Record the respondent as owner without adding personal identifiers.

## Confirmed scope for this import

- App: MasteryApp. PDFs: SAT R&W EASY.pdf, SAT R&W MEDIUM.pdf, SAT R&W HARD.pdf.
- Keep all existing official SAT records. Retire the 238 book/provisional records into an unloaded archive. No PSAT-source records are present; mapped PSAT difficulty is metadata, not provenance. No retiring IDs are referenced by production plans or sets, so no holds or follow-up interval are needed. Restore the truncated A-C options of 2bca654a from the visually checked new export; preserve its ID, answer, and alias chain. Preserve the four skipped export IDs as additional aliases on their existing canonical records; their choices and answer keys were compared before recording the mapping. Refresh the 136 older SAT difficulty labels that disagree with the new SAT export headers, plus their derived legacy mappings; retain their IDs, skills, and answer keys. Source IDs and reasons are listed under existing_repairs. Preserve existing homework plans and baseline settings.
- Compare candidates against all eight bank files, including extension files and historical aliases.
- SAT difficulty comes from the SAT export. The legacy PSAT metadata remains separate, using the established mapping; SAT draws still use difficulty.
- The standalone RW-Search mirror has its own bank copies and must receive the same changed banks and figures. Its smoke test is required.
- No homework engine change is part of a bank import. Any engine fix must also be applied to the sister app and both required suites run.

## Prerequisites and paths

Python 3 with pdfplumber and Pillow; Poppler's pdftotext and pdftoppm on PATH; Node and jsdom on a local disk. Set PYTHONUTF8=1 on Windows. All configured paths, including overrides and mirrors, are relative to the config file. Run the commands below from the app root. config/sat.json contains explicit runtime paths for this workstation; update them when moving the kit.

PowerShell environment setup:

```powershell
$env:PYTHONUTF8 = '1'
$env:PATH = 'PATH_TO_POPPLER_BIN;' + $env:PATH
```

Bash environment setup:

```bash
export PYTHONUTF8=1
export PATH="PATH_TO_POPPLER_BIN:$PATH"
```

Use the workstation's Python executable if python points to another installation. The test runner uses the node and node_modules paths in the config and rejects skipped suites.

## Phases

### 0. Profile and settle scope

```text
python tools/bank-import-kit/kit/profile.py . "SAT R&W EASY.pdf" "SAT R&W MEDIUM.pdf" "SAT R&W HARD.pdf"
```

Check the assessment headers and every configured bank's JSON round trip. A heuristic match on an unrelated JavaScript array is not a bank. Inventory neighboring folders for separate bank copies; list all mirrors explicitly. For a new app, settle PDFs, retirement policy, ID references, field vocabulary, mirror locations, and required tests before extraction.

### 1. Extract and adjudicate duplicates

```text
python tools/bank-import-kit/kit/extract.py tools/bank-import-kit/config/sat.json
```

Extraction must succeed and each PDF must contain questions. Cache files carry the source PDF's SHA-256; changed inputs require a fresh work_dir. Repeat duplicate comparisons may reuse a cache only when the complete bank fingerprint and normalized candidate identity match. Accounting includes already-present IDs, exact and near duplicates, review-band matches, and new items. No parse problems or in-batch duplicates may remain.

The canonical passage + prompt normalization is the one in MERGE-RUNBOOK section 3. Never compare boilerplate stems alone. Exact matches and near matches >=0.93 are logged; 0.85-0.93 matches require a recorded decision. Inspect different-ID matches with differing punctuation, choices, or keys before accepting the duplicate decision. Keep all existing aliases when replacing a record under an explicitly configured retirement policy.

### 2. Geometry and figures

```text
python tools/bank-import-kit/kit/geometry.py tools/bank-import-kit/config/sat.json 150
```

Repeat until remaining 0. To divide work, run shard 0/2 and shard 1/2 in separate terminals. Crop figures into WORK/figures/assets/, never the app. Transfer the config, original-source checksum files, text cache, geo folder, and figures folder together when changing machines. Source PDFs are needed for geometry and final fingerprint verification.

### 3. Repair layout

```text
python tools/bank-import-kit/kit/repair.py tools/bank-import-kit/config/sat.json
```

Every candidate needs geometry. Every question asking about an underline needs a nonempty span. Geometry mismatches, unusual paragraph or verse layouts, source repairs, and underline questions enter the review queue. Corrections belong in reproducible repairs or overrides, not assembled.json.

### 4. Build a fresh staged output

```text
python tools/bank-import-kit/kit/build.py tools/bank-import-kit/config/sat.json
```

Previous out/ folders are moved into a local build archive, so stale files cannot survive a rebuild. New figures are copied into out/. Records follow the configured field order. Each new grammar tag is included in review. Changed bank references receive the release_tag, including a revision so two releases on the same date differ.

### 5. Verify and review

```text
python tools/bank-import-kit/kit/verify.py tools/bank-import-kit/config/sat.json --run-tests
```

Required checks include source-text duplicate comparisons for figures already represented in the exports; accounting; unique canonical IDs and globally unique aliases; complete conservation of active and archived records; complete passage + prompt, complete A-D options, answer key, and complete explanation against source; actual nonempty underlines; figure presence and dimensions; grammar vocabulary; cache references and line endings. Images and mirror updates are verified from staging.

The app's required suites come from the canonical list in AGENTS.md. Run them on a temporary local copy with out/ overlaid; reject skips. The cache suite checks staged pages against the source checkout's commit dates, including revision tags. Run the mirror's smoke test on a temporary copy with mirror output overlaid. Test changes must preserve the behavior guarded in their headers and be described separately.

**Human checkpoint (mandatory).** The owner reviews WORK/review/all-items.html, every figures_*.png sheet, all flagged items, and every proposed grammar tag. Source text and complete explanations accompany the rendered items. Sample ordinary items across skill and difficulty. Verification creates verified.json with human_reviewed false; it does not imply owner approval.

Only after explicit owner approval:

```text
python tools/bank-import-kit/kit/approve.py tools/bank-import-kit/config/sat.json --reviewed
```

Any input, script, app, mirror, or staged output change invalidates the checksum-bound approval. Rebuild or repair from the responsible phase, verify again, and review the changed items again.

### 6. Install and verify the checkout

```text
python tools/bank-import-kit/kit/install.py tools/bank-import-kit/config/sat.json
python tools/bank-import-kit/kit/run_tests.py .
```

Installation refuses missing, failed, unreviewed, or stale verification. It checks every destination against the configured app/mirror roots, snapshots every existing destination, copies the exact staged files, and verifies every SHA-256. The mirror receives replacement crops even when filenames already exist. Run the mirror's smoke test in its checkout after installation too.

## Rollback

The installer records absolute destinations, original backups, and installed checksums in WORK/rollback/DATE/restore.json. Before restoring, check that the installed checksum still matches so later owner edits are not overwritten. Restore only listed files from the saved backups. For files that did not exist before, move them to a local quarantine after checking their paths remain inside the configured root. Restore the original pages as well as banks, rerun the required app and mirror tests, and compare the saved baseline IDs and checksums. Never reset the whole checkout.

## Completion checklist

- Every export accounted for; all ambiguity decisions and source repairs recorded.
- Every existing record and alias preserved in the active bank or authorized retirement archive; no new duplicate content.
- Figures and flagged layouts inspected; all grammar tags reviewed by the owner.
- Required app and mirror tests passed, without unreported skips.
- Owner approval matches the exact verified output.
- Installed files and mirrors match the manifest; checkout tests pass.
- Rollback snapshot retained locally; PDFs and work files remain ignored.
- Scoped staging commands handed to the owner; no commit or push performed.

## Limits

Layout and underline detection remain heuristics and need visual review. Raw extraction can faithfully reproduce a source defect; the original PDF is the visual authority. Similarity is a duplicate candidate signal, especially where a single punctuation mark changes a grammar question. Tables remain images; title-based alt text does not make their values accessible to a screen reader. This import does not change the app's assessment design or homework selection rules.
