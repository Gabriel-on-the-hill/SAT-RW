# Snapshot (image) questions — how to add them

This folder holds **question snapshots** — PNG/JPG images of question stems whose
figure, table, or graph can't be represented faithfully as text. The pattern
mirrors the Math mastery apps: the visual lives in an image, the answer/choices/
explanation stay as structured data so the rest of the app (mastery ledger,
scoring, history, sync, review) keeps working exactly as it does for text
questions.

Primary use: **Command of Evidence — Quantitative** (R&W), which is graph/table heavy.
The mechanism is generic, so any question can use it.

---

## 1. Add the image

Drop the snapshot in this folder. Recommended name: `coeq_<id>.png`, where `<id>`
matches the question's `id`. Crop tightly to the figure + stem; choices can be
inside the image or typed as text (see below). PNG is best for charts/tables.

## 2. Add the question record

Append an object to the relevant bank array. Command of Evidence — Quantitative
lives in **`data-info-ideas.js`** (`const questionBank_II = [ ... ]`). Add it
before the closing `];`.

A snapshot record is a normal question record with one extra field — `image` —
and (optionally) an empty `options` array when the four choices are already
visible inside the image:

```js
  {
    "id": "q8a1f2c0",                                   // unique 8-char id
    "skill": "Command of Evidence — Quantitative",      // exact skill string
    "difficulty": "Medium",                             // Easy | Medium | Hard
    "image": "assets/coeq_q8a1f2c0.png",                // the snapshot
    "question": "Which choice most effectively uses data from the graph to complete the statement?",
    "options": [],                                       // [] = choices are in the image → A–D buttons
    "answer": "C",                                       // correct letter
    "explanation": "Choice C is correct because ...\n\nChoice A is incorrect because ...",
    "strategy": "Data-to-Claim Match"                   // optional; shown in feedback
  },
```

If you'd rather type the choices as text (so they're selectable and screen-reader
friendly), supply them in `options` instead of `[]`:

```js
    "options": [
      "A. The value rose every year from 2010 to 2020.",
      "B. The value fell after 2015.",
      "C. The value peaked in 2018, then declined.",
      "D. The value stayed constant."
    ],
```

Either way works. When `options` is empty the app shows plain **A · B · C · D**
buttons; when it has text, it shows the text.

---

## Field checklist (so nothing breaks elsewhere)

| Field        | Required | Used by                                                        |
|--------------|----------|----------------------------------------------------------------|
| `id`         | ✅       | Mastery ledger, resume, sync, de-duping                         |
| `skill`      | ✅       | Setup counts, filtering, per-skill breakdowns, trap buckets    |
| `difficulty` | ✅       | Filters, badges, difficulty mix                                |
| `answer`     | ✅       | Scoring, correct-answer highlight, review                      |
| `explanation`| ✅       | Feedback (Practice) and the review accordion (Homework/Exam)   |
| `image`      | ✅*      | Renders the snapshot in the passage panel (*for snapshot items)|
| `question`   | ✅       | Prompt text shown beside/under the image                       |
| `options`    | optional | Choice text; `[]` → bare A–D buttons                           |
| `strategy`   | optional | Shown in feedback ("Strategy: …")                              |
| `trapName`   | optional | Feeds the Top-Traps analytics (else falls back to skill)       |
| `passage`    | omit     | Ignored when `image` is present                                |

Notes:
- Images are automatically protected by the anti-cheat layer (no drag/right-click).
- Snapshots appear identically in Practice (Assisted/Standard/Exam) and Homework,
  including the end-of-session review, which now shows the image too.
- Keep ids unique across **all** banks — the mastery ledger is keyed on `id`.
