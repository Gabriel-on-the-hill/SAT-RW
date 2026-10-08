"""Shared helpers. Nothing here is app-specific; the app is described by a config file."""
import json, os, re, sys, hashlib, unicodedata, datetime

def load_config(path):
    cfg = json.load(open(path, encoding="utf-8"))
    base = os.path.dirname(os.path.abspath(path))
    for k in ("app_dir", "work_dir", "pdf_dir", "overrides"):
        cfg[k] = os.path.normpath(os.path.join(base, cfg[k]))
    cfg["config_path"] = os.path.abspath(path)
    cfg.setdefault("today", datetime.date.today().isoformat())
    os.makedirs(cfg["work_dir"], exist_ok=True)
    return cfg

def wpath(cfg, *p): return os.path.join(cfg["work_dir"], *p)

# ---- the canonical normalization (MERGE-RUNBOOK §3). Do not "improve" it: duplicate counts depend on it.
def clean(t):
    t = unicodedata.normalize('NFKD', str(t or ''))
    for a, b in [('’', "'"), ('‘', "'"), ('“', '"'), ('”', '"'), ('—', '-'), ('–', '-')]:
        t = t.replace(a, b)
    return re.sub(r'[^a-z0-9]', '', t.lower())
def qkey(q): return clean(q.get('passage')) + clean(q.get('question'))
def qhash(q): return hashlib.md5(qkey(q).encode()).hexdigest()

# letters-and-digits only, used to align two renderings of the same text
def ck(t): return re.sub(r'[^a-z0-9]', '', unicodedata.normalize('NFKD', str(t or '')).lower())
def align_index(text):
    """positions in `text` of every character that survives ck(), and the ck() stream itself"""
    idx = [i for i, ch in enumerate(text) if ck(ch)]
    return idx, "".join(ck(text[i]) for i in idx)

# ---- bank files: `const NAME = [ ... ];` serialized exactly like json.dumps(indent=2, ensure_ascii=False)
def read_bank(path):
    """Returns (head, records, tail). Line endings are detected and restored on write, so a CRLF
    working copy (Windows checkout) stays CRLF and an LF one stays LF."""
    s = open(path, encoding="utf-8", newline="").read()
    eol = "\r\n" if "\r\n" in s else "\n"
    s = s.replace("\r\n", "\n")
    head, body, tail = s[:s.index('[')], s[s.index('['):s.rindex(']') + 1], s[s.rindex(']') + 1:]
    arr = json.loads(body)
    if head + json.dumps(arr, ensure_ascii=False, indent=2) + tail != s:
        sys.exit(f"STOP: {path} does not round-trip through json.dumps(indent=2). Add a serializer for this app first.")
    return (head, eol), arr, tail
def write_bank(path, head, arr, tail):
    head, eol = head if isinstance(head, tuple) else (head, "\n")
    text = head + json.dumps(arr, ensure_ascii=False, indent=2) + tail
    open(path, "w", encoding="utf-8", newline="").write(text.replace("\n", eol))

def load_banks(cfg, app_dir=None):
    app = app_dir or cfg["app_dir"]
    return {k: read_bank(os.path.join(app, b["file"])) for k, b in cfg["banks"].items()}

def all_records(banks): return [q for k in banks for q in banks[k][1]]

def is_official(cfg, q): return q.get(cfg["origin_field"], cfg["origin_value"]) == cfg["origin_value"]
def is_retiring(cfg, q): return q.get(cfg["origin_field"]) in cfg.get("retire", {}).get("origins", [])

def save(cfg, name, obj): json.dump(obj, open(wpath(cfg, name), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
def load(cfg, name): return json.load(open(wpath(cfg, name), encoding="utf-8"))

def gate(ok, name, detail=""):
    print(("  PASS  " if ok else "  FAIL  ") + name + ("" if ok or not detail else "\n        " + str(detail)[:1500]))
    return ok


def underline_ranges(lines):
    ranges=[];offset=0;start=None
    for line in lines:
        for word,flag in zip(line['words'],line['u_flags']):
            size=len(ck(word))
            if flag and size and start is None:start=offset
            if not flag and size and start is not None:ranges.append((start,offset));start=None
            offset+=size
    if start is not None:ranges.append((start,offset))
    return ranges

def apply_geometry_underlines(text,lines):
    target=ck(text);stream=ck(' '.join(w for line in lines for w in line['words']))
    if stream!=target:return text,False
    ranges=underline_ranges(lines)
    if not ranges:return text,False
    indices=[i for i,ch in enumerate(text) if ck(ch)]
    spans=[]
    for start,end in ranges:
        if end<=start or end>len(indices):return text,False
        a,b=indices[start],indices[end-1]+1
        # Include adjacent punctuation when the PDF's underlined final token includes it.
        # Geometry provides positions; all characters still come from the raw text.
        while b<len(text) and not text[b].isspace() and not ck(text[b]) and text[b]!='<':b+=1
        spans.append((a,b))
    for a,b in reversed(spans):text=text[:a]+'<u>'+text[a:b]+'</u>'+text[b:]
    return text,True

# ---- owner confirmation (RUNBOOK §2). Enforced: no import and no build without a same-day sign-off.
OWNER_QUESTIONS = [
    ("pdfs_complete", "Which PDFs are being imported, and are they the complete set (every difficulty) you intend to have? Any still to come?"),
    ("retire", "Should anything be retired (hidden, never deleted) — e.g. SAT-bank or book questions? Name the sources, or say none."),
    ("plan_files", "Which files name questions by id (homework plans, challenge sets, class routes)? Those questions are held, not retired."),
    ("follow_up_days", "If questions are held, how many days until the follow-up to deal with them?"),
    ("ruletype", "Does the app tag grammar questions by rule? If yes, confirm the rule vocabulary."),
    ("mirrors", "Does any other tool keep its own copy of the bank (a search page, reports)? Name its folder, or say none."),
]

def owner_prompt():
    lines = ["Before I import anything, I need your answers to these (they decide what the import does):", ""]
    lines += [f"{i}. {q}" for i, (_, q) in enumerate(OWNER_QUESTIONS, 1)]
    lines += ["", "I'll record your answers and today's date in the config. A run on any other day asks again."]
    return "\n".join(lines)

def require_owner_confirmation(cfg):
    c = cfg.get("owner_confirmation") or {}
    missing = [k for k, _ in OWNER_QUESTIONS if k not in (c.get("answers") or {})]
    problems = []
    today = datetime.date.today().isoformat()
    if c.get("date") != today: problems.append(f"confirmation is dated {c.get('date')!r}, today is {today}")
    if cfg.get("today", today) != today: problems.append("configured import date is stale")
    if not c.get("confirmed_by"): problems.append("no `confirmed_by`")
    if missing: problems.append("unanswered: " + ", ".join(missing))
    if problems:
        print("STOP — owner confirmation required (RUNBOOK §2): " + "; ".join(problems) + "\n")
        print("Ask the owner, word for word:\n")
        print(owner_prompt())
        print("\nThen record the answers in the config under `owner_confirmation` "
              "({\"date\": \"YYYY-MM-DD\", \"confirmed_by\": \"name\", \"answers\": {...}}) and make the config "
              "fields (`pdfs`, `retire`, `ruletype`, `mirrors`) match them.")
        sys.exit(3)
    # the config must agree with what the owner said
    a = c["answers"]; drift = []
    if str(a.get("retire", "")).strip().lower() in ("none", "no", "nothing", "") and cfg.get("retire"):
        drift.append("owner said retire nothing, but config has `retire`")
    if str(a.get("mirrors", "")).strip().lower() in ("none", "no", "") and cfg.get("mirrors"):
        drift.append("owner said no mirrors, but config has `mirrors`")
    if drift:
        print("STOP — config disagrees with the owner's answers: " + "; ".join(drift)); sys.exit(3)

def source_repair_values(q, repair, sources):
    if not repair.get('why'): raise SystemExit('STOP: source repair needs why')
    source = sources[repair.get('source_id', q['id'])]
    values = {field: source[field] for field in repair['fields']}
    if repair.get('derive_psat_difficulty'):
        values['psatDifficulty'] = {'Easy':'Medium', 'Medium':'Hard', 'Hard':'Hard'}[source['difficulty']]
    return values
