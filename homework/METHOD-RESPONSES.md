# Method responses

The written response is the deciding evidence for the taught method, not a guess at the answer wording. `strategy-response.js` selects a profile from the actual question's skill, grammar `ruleType` and relevant stem. Agreement asks for the controlling subject and number. Verb form asks for the subject, existing finite verb and job of the blank; tense has its own time relationship. Boundaries classify the actual parts and construction, including interruptions and lists. Transitions ask for relationship plus the actual ideas. Reading profiles distinguish main claims, details, inferences, function, organisation, evidence, data and writing goals.

Required fields check completeness only. “Not sure yet” is an honest response; it is not a correct method verdict. The selected answer remains the scored answer, and the tutor judges method quality. Prompts never inspect the key, explanation or correct option. They must not prefill the decisive subject, relationship or answer. A scaffolded method response does not prove the student independently identified the method.

Question-specific overrides use `responseProfile` on a class item/question, or `responses: {questionId: profile}` on a homework day. A profile name selects a standard method. An object can supply `title`, `instructions`, `phase` and 1–6 `fields` (`id`, `label`, optional `placeholder`, `kind: "text" | "select"`, and `options` for a select). Default phase is `before-options`. Use `with-options` when the taught decision needs inspection of the alternatives; those responses are labelled accordingly in the record and must not be described as pre-options predictions.

```js
responseProfile: {
  title: "Sentence construction",
  instructions: "Inspect what changes across the choices, then apply the method taught in class.",
  phase: "with-options",
  fields: [
    {id:"change", label:"Feature that changes across choices"},
    {id:"structure", label:"Sentence structure that decides it"}
  ]
}
```

Untimed work collects the written fields. Timed homework keeps a brief method cue and the existing one-click commitment; use short notes on paper and retain them for tutor review. Do not label that click as recorded written reasoning. Saved first answers and their original method notes remain fixed. New drafts retain their separate fields across navigation/reload. Labelled responses travel in the existing `prediction` string so the current SAT Prediction column and PSAT Raw payload keep them without a new backend schema.

Every class/homework planner must inspect the expected response as well as the item and key, use only methods confirmed taught, and specify any item override and option-visibility phase before publication. The shared planning rule lives above these apps in `C:/Antigravity/AGENTS.md` and `C:/Antigravity/Method_Response_Standard.md`; this document covers app mechanics only.
