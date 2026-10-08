"""Propose a ruleType for a Conventions item. Fixed vocabulary (app/ruletype.test.js):
Boundaries: Commas, Semi, Colon, Dash, NoPunct.  Form, Structure, and Sense: SVA, VTense, VForm, Pron, Poss, Mod."""
import re
def _opt(q, L):
    for o in q['options']:
        if o.startswith(L + "."): return o[2:].strip()
    return ""
def phrase(q):
    m = re.search(r"convention being tested(?: here)? is (?:the )?(.+?)\.", q.get('explanation', ''))
    return (m.group(1) if m else "").lower()
def classify(q):
    ph, ex = phrase(q), q.get('explanation', '').lower()
    ans = _opt(q, q['answer']); opts = [o[2:].strip() for o in q['options']]
    if q['skill'] == 'Form, Structure, and Sense':
        if 'subject-verb' in ph or 'agree in number with the' in ex and 'verb' in ex and 'pronoun' not in ph: return 'SVA', 'high' if ph else 'low'
        if 'tense' in ph: return 'VTense', 'high'
        if 'modifier' in ph or 'dangling' in ex: return 'Mod', 'high'
        if 'possessive noun' in ph or 'plural and possessive' in ph or ('possessive' in ph and 'determiner' not in ph): return 'Poss', 'high'
        if 'pronoun' in ph or 'determiner' in ph: return 'Pron', 'high'
        if 'verb form' in ph or 'finite' in ph: return 'VForm', 'high'
        # no phrase: the rationale's own vocabulary, most specific first
        for kw, t in [('dangling', 'Mod'), ('modif', 'Mod'), ('possessive', 'Poss'), ('pronoun', 'Pron'),
                      ('determiner', 'Pron'), ('tense', 'VTense'), ('singular verb', 'SVA'), ('plural verb', 'SVA'),
                      ('agree', 'SVA'), ('finite', 'VForm'), ('infinitive', 'VForm'), ('participle', 'VForm')]:
            if kw in ex: return t, 'low'
        # last resort: look at the options
        if all(re.search(r"’|'", o) for o in opts): return 'Poss', 'low'
        if any(w in " ".join(opts).lower().split() for w in ['it', 'they', 'its', 'their', 'this', 'these', 'that', 'those']): return 'Pron', 'low'
        if any(re.search(r"\b(to \w+|\w+ing|having \w+)\b", o) for o in opts): return 'VForm', 'low'
        return 'VTense', 'low'
    # Boundaries: tag by the mark the CORRECT option uses (the bank's convention: a full stop or
    # question mark between sentences files under Commas; no mark at all is NoPunct).
    if re.search(r"[—()]", ans): return 'Dash', 'high'
    if ':' in ans: return 'Colon', 'high'
    if ';' in ans: return 'Semi', 'high'
    if ',' in ans: return 'Commas', 'high'
    if re.search(r"[.?!]", ans): return 'Commas', 'low'
    return 'NoPunct', 'high'
