#!/usr/bin/env python3
"""Build stages 4-7 from the verified stage-3 transcriptions."""

import argparse
import hashlib
import json
import re
import subprocess
import sys
from collections import Counter, OrderedDict, defaultdict
from pathlib import Path

import fitz
from PIL import Image

HERE = Path(__file__).resolve().parent.parent
STAGE3 = HERE / "_extract" / "stage3"
PENDING = HERE / "_extract" / "pending"
GRAMMAR_PDF = HERE / "Sixth Edition, The Ultimate Guide to SAT® Grammar.pdf"
CRITICAL_PDF = HERE / "The Critical Reader, Fifth Edition.pdf"

BASE_FILES = {
    "craft_structure": "data-craft-structure.js",
    "expression_ideas": "data-expression-of-ideas.js",
    "info_ideas": "data-info-ideas.js",
    "conventions": "data-conventions.js",
}

EXT_FILES = {
    "craft_structure": ("data-craft-structure-ext.js", "questionBank_CS_EXT", "questionBank_CS"),
    "expression_ideas": ("data-expression-of-ideas-ext.js", "questionBank_EOI_EXT", "questionBank_EOI"),
    "info_ideas": ("data-info-ideas-ext.js", "questionBank_II_EXT", "questionBank_II"),
    "conventions": ("data-conventions-ext.js", "questionBank_CON_EXT", "questionBank_CON"),
}

STRATEGIES = {
    "Words in Context": "Two-Filter Method",
    "Text Structure and Purpose": "Function Map",
    "Cross-Text Connections": "Perspective Synthesis",
    "Central Ideas and Details": "Main Idea Drill",
    "Inferences": "Inference Ceiling",
    "Command of Evidence — Textual": "Support Check",
    "Command of Evidence — Quantitative": "Data-to-Claim Match",
    "Transitions": "Direction Check",
    "Rhetorical Synthesis": "Goal-First Filter",
    "Boundaries": "Run-On Radar",
    "Form, Structure, and Sense": "Agreement Check",
}

CR_SKILLS = {
    "Sentence Completions": "Words in Context",
    "Meaning in Context": "Words in Context",
    "The Big Picture": "Central Ideas and Details",
    "Literal Comprehension": "Central Ideas and Details",
    "Function": "Text Structure and Purpose",
    "Text Completions": "Inferences",
    "Supporting and Undermining": "Command of Evidence — Textual",
    "Graphs and Charts": "Command of Evidence — Quantitative",
    "Paired Passages": "Cross-Text Connections",
}

FIGURE_BOXES = {
    152: (140, 410, 1190, 1230),
    153: (70, 330, 1130, 910),
    154: (130, 260, 1220, 1300),
    155: (150, 250, 1540, 1240),
    156: (180, 290, 1230, 1040),
}

FIGURE_CHECKS = {
    152: ["Bat Cries by Species", "Eastern Red Bat", "Big Brown Bat", "Average cries per night"],
    153: ["Yearly Rainfall in Los Angeles", "Average", "El Niño", "Jan", "Feb", "Mar"],
    154: ["Wavelength", "nanometers", "UV absorption", "Ultraviolet", "Red"],
    155: ["Study", "No. of Participants", "Sample", "Erickson", "Takeushi", "240"],
    156: ["Average Fundamental Frequency", "Seal A", "Seal F", "No Noise", "High Noise"],
}


def load_js_array(path):
    text = Path(path).read_text(encoding="utf-8")
    return json.loads(text[text.index("["):text.rindex("]") + 1])


def load_base():
    records = []
    for filename in BASE_FILES.values():
        records.extend(load_js_array(HERE / filename))
    return records


def load_frozen_ids():
    frozen = {}
    for filename, _, _ in EXT_FILES.values():
        path = HERE / filename
        if not path.exists():
            continue
        for record in load_js_array(path):
            source_ref = (record.get("source") or {}).get("ref")
            if not source_ref:
                continue
            if source_ref in frozen and frozen[source_ref] != record.get("id"):
                raise ValueError("source ref has multiple frozen ids: %s" % source_ref)
            frozen[source_ref] = record.get("id")
    return frozen


def clean_text(value):
    value = str(value or "")
    value = value.replace("\ufffd", "—")
    value = re.sub(r"\s+", " ", value).strip()
    return value


def norm_aggressive(value):
    value = clean_text(value).lower()
    value = value.translate(str.maketrans({"“": '"', "”": '"', "’": "'", "–": "-", "—": "-"}))
    return re.sub(r"[^a-z0-9]+", " ", value).strip()


def grams(value, size=4):
    value = norm_aggressive(value)
    if len(value) < size:
        return {value} if value else set()
    return {value[i:i + size] for i in range(len(value) - size + 1)}


def dice(left, right):
    a, b = grams(left), grams(right)
    return dice_sets(a, b)


def dice_sets(a, b):
    if not a or not b:
        return 0.0
    return 2 * len(a & b) / (len(a) + len(b))


def content_for_dedup(record):
    options = " | ".join(re.sub(r"^[A-D]\.\s*", "", x) for x in record.get("options", []))
    return " ".join([record.get("passage", ""), record.get("question", ""), options])


def mint_id(record):
    source = "\n".join([
        norm_aggressive(record.get("passage", "")),
        norm_aggressive(record.get("question", "")),
        "\n".join(clean_text(x) for x in record.get("options", [])),
    ])
    return hashlib.sha256(source.encode("utf-8")).hexdigest()[:8]


def critical_sections(doc):
    pattern = re.compile(r"^[ \t]*(Exercise|Answers):(.*)$", re.M)
    found = []
    for page in range(20, doc.page_count):
        for match in pattern.finditer(doc[page].get_text()):
            found.append((match.group(1), match.group(2).strip(), page))
    return found


def critical_key(name):
    name = re.sub(r"^(Reading for|Identifying)\s+", "", name.strip(), flags=re.I)
    return re.sub(r"[^a-z]+", "", name.lower())


def strip_answer_noise(text):
    kept = []
    for line in text.splitlines():
        line = line.strip()
        if not line or re.fullmatch(r"\d{1,3}", line):
            continue
        if any(ord(char) < 32 for char in line):
            continue
        if "Ms Ánh Day SAT" in line or line.startswith("HOTLINE:"):
            continue
        kept.append(line)
    return clean_text(" ".join(kept))


def critical_explanations():
    doc = fitz.open(CRITICAL_PDF)
    sections = critical_sections(doc)
    result = {}
    marker = re.compile(r"^\s*([0-9]{1,2})\s*[.:]\s*\(?([A-D])\)?\s*$", re.M)
    for index, (kind, name, start) in enumerate(sections):
        if kind != "Answers":
            continue
        end = sections[index + 1][2] if index + 1 < len(sections) else doc.page_count
        marker_pages = [page for page in range(start, end) if marker.search(doc[page].get_text())]
        if not marker_pages:
            continue
        end = max(marker_pages) + 1
        chunks = []
        page_offsets = []
        offset = 0
        for page in range(start, end):
            text = doc[page].get_text()
            chunks.append(text)
            page_offsets.append((offset, page))
            offset += len(text) + 1
        joined = "\n".join(chunks)
        matches = list(marker.finditer(joined))
        for item_index, match in enumerate(matches):
            stop = matches[item_index + 1].start() if item_index + 1 < len(matches) else len(joined)
            explanation = strip_answer_noise(joined[match.end():stop])
            page = max(p for pos, p in page_offsets if pos <= match.start())
            result[(critical_key(name), int(match.group(1)))] = {
                "answer": match.group(2),
                "explanation": explanation,
                "keyPage": page,
            }
    return result


def grammar_key_pages():
    sys.path.insert(0, str(HERE / "tools"))
    import transcribe
    doc = fitz.open(GRAMMAR_PDF)
    starts = transcribe.exercise_starts(doc, 200)
    wanted = {transcribe.heading_name(raw).lower(): transcribe.heading_name(raw) for _, raw, _ in starts}
    current = None
    pages = {}
    topics = {}
    for page in range(202, 215):
        for line in doc[page].get_text().splitlines():
            probe = line.strip().strip('"').strip()
            normalized = re.sub(r"\s+", " ", probe).lower()
            set_match = transcribe.SET_MARK.match(line) or re.match(r"^\s*Set\s*\d+\s*$", probe)
            if set_match:
                current = "Practice Sets: All Chapters/Set %d" % int(re.search(r"\d+", probe).group())
                continue
            if normalized in wanted:
                current = wanted[normalized]
                continue
            prefix = next((heading for key, heading in wanted.items()
                           if len(normalized) > 12 and key.startswith(normalized)), None)
            if prefix:
                current = prefix
                continue
            if current is None:
                continue
            for pattern, letter_index in ((transcribe.KEY_ENTRY, 2),
                                          (transcribe.KEY_CAT_ENTRY, 3),
                                          (transcribe.KEY_TOPIC_ENTRY, 2)):
                match = pattern.match(line)
                if not match:
                    continue
                number = 1 if match.group(1) == "l" else int(match.group(1))
                pages.setdefault((current, number, match.group(letter_index)), page - 1)
                if pattern is transcribe.KEY_TOPIC_ENTRY:
                    topics.setdefault((current, number), match.group(3).strip())
                break
    return pages, topics


def punctuation_rule(record):
    topic = clean_text(record.get("key_topic", "")).lower()
    correct = record["options"][ord(record["key_letter"]) - 65]
    if "—" in correct or "dash" in topic:
        return "Dash"
    if ":" in correct or "colon" in topic:
        return "Colon"
    if ";" in correct or ". " in correct or "semicolon" in topic \
            or "separating sentence" in topic or "joining sentence" in topic:
        return "Semi"
    if "comma" in topic or "," in correct:
        return "Commas"
    return "NoPunct"


def grammar_skill(record):
    exercise = record["exercise"]
    topic = clean_text(record.get("key_topic", ""))
    low = topic.lower()
    if "student notes" in low:
        return "Rhetorical Synthesis", None
    if "transition" in low and "punctuating" not in low:
        return "Transitions", None
    if any(word in low for word in ["separating", "joining", "comma", "dash", "punctuat"]):
        return "Boundaries", punctuation_rule(record)
    if "subject-verb" in low:
        return "Form, Structure, and Sense", "SVA"
    if "pronoun" in low:
        return "Form, Structure, and Sense", "Pron"
    if "modifier" in low:
        return "Form, Structure, and Sense", "Mod"
    if "parallel" in low or "verb form" in low:
        return "Form, Structure, and Sense", "VForm"
    if exercise.startswith("Transitions"):
        return "Transitions", None
    if exercise == "Student Notes":
        return "Rhetorical Synthesis", None
    if exercise in {"Joining and Separating Sentences", "Joining and Separating Sentences/Clauses",
                    "Quick Check: Punctuating Transitions", "Non-Essential Clauses with Commas, Dashes,",
                    "All Non-Essential and Essential Clauses", "Additional Comma Uses and Misuses"}:
        return "Boundaries", punctuation_rule(record)
    if exercise == "Cumulative Review: All Punctuation and Transitions":
        if all(len(option.split()) <= 3 for option in record["options"]):
            words = " ".join(record["options"]).lower()
            if any(word in words for word in ["however", "therefore", "indeed", "nonetheless", "moreover"]):
                return "Transitions", None
        return "Boundaries", punctuation_rule(record)
    if exercise == "Pronoun Agreement":
        return "Form, Structure, and Sense", "Pron"
    if exercise == "Apostrophes":
        return "Form, Structure, and Sense", "Poss"
    if exercise == "Modification":
        return "Form, Structure, and Sense", "Mod"
    if exercise == "Parallel Structure":
        return "Form, Structure, and Sense", "VForm"
    if exercise == "Subject-Verb Agreement and Tense":
        tense_markers = {"had", "will", "would", "remained", "evolved", "became", "become"}
        words = set(norm_aggressive(" ".join(record["options"])).split())
        return "Form, Structure, and Sense", "VTense" if words & tense_markers else "SVA"
    if exercise == "Cumulative Review: Chapters 8-12":
        by_number = {
            1: "SVA", 2: "Pron", 3: "VTense", 4: "SVA", 5: "VForm",
            6: "Mod", 7: "Pron", 8: "SVA", 9: "SVA", 10: "Mod",
            11: "SVA", 12: "VForm", 13: "Poss", 14: "SVA", 15: "Mod",
        }
        return "Form, Structure, and Sense", by_number[record["number"]]
    raise ValueError("unclassified grammar question: %s %s" % (record["qid"], exercise))


def domain_for(skill):
    if skill in {"Words in Context", "Text Structure and Purpose", "Cross-Text Connections"}:
        return "craft_structure"
    if skill in {"Transitions", "Rhetorical Synthesis"}:
        return "expression_ideas"
    if skill in {"Boundaries", "Form, Structure, and Sense"}:
        return "conventions"
    return "info_ideas"


def build_records():
    grammar = json.loads((STAGE3 / "grammar.json").read_text(encoding="utf-8"))
    critical = json.loads((STAGE3 / "critical_reader.json").read_text(encoding="utf-8"))
    grammar_pages, grammar_topics = grammar_key_pages()
    explanations = critical_explanations()
    records = []
    stage4 = []
    for source in grammar:
        skill, rule_type = grammar_skill(source)
        key = (source["exercise"], source["number"], source["key_letter"])
        key_page = grammar_pages.get(key, source.get("key_page"))
        question = source.get("prompt") or (
            "Which choice completes the text with the most logical transition?"
            if skill == "Transitions" else
            "Which choice best accomplishes the student's goal?"
            if skill == "Rhetorical Synthesis" else
            "Which choice completes the text so that it conforms to the conventions of Standard English?"
        )
        record = {
            "skill": skill,
            "passage": clean_text(source["text"]),
            "question": clean_text(question),
            "options": [chr(65 + i) + ". " + clean_text(option) for i, option in enumerate(source["options"])],
            "answer": source["key_letter"],
            "strategy": STRATEGIES[skill],
            "source": {"book": "The Ultimate Guide to SAT Grammar, Sixth Edition",
                       "questionPage": source["printed"], "keyPage": key_page,
                       "ref": source["qid"]},
            "_sourceQid": source["qid"],
            "_domain": domain_for(skill),
        }
        if rule_type:
            record["ruleType"] = rule_type
        records.append(record)
        stage4.append((source["qid"], source["key_letter"], key_page, source["letters"]))
    for source in critical:
        skill = CR_SKILLS[source["exercise"]]
        explanation = explanations.get((critical_key(source["exercise"]), source["number"]))
        if not explanation:
            raise ValueError("missing Critical Reader explanation for %s" % source["qid"])
        if explanation["answer"] != source["key_letter"]:
            raise ValueError("Critical Reader key disagreement for %s" % source["qid"])
        record = {
            "skill": skill,
            "passage": clean_text(source["text"]),
            "question": clean_text(source["prompt"]),
            "options": [chr(65 + i) + ". " + clean_text(option) for i, option in enumerate(source["options"])],
            "answer": source["key_letter"],
            "explanation": explanation["explanation"],
            "strategy": STRATEGIES[skill],
            "source": {"book": "The Critical Reader, Fifth Edition",
                       "questionPage": source["printed"], "keyPage": explanation["keyPage"],
                       "ref": source["qid"]},
            "_sourceQid": source["qid"],
            "_sourcePage": source["page"],
            "_domain": domain_for(skill),
        }
        records.append(record)
        stage4.append((source["qid"], source["key_letter"], explanation["keyPage"], source["letters"]))
    return records, stage4


def difficulty_model(base, records):
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.model_selection import train_test_split
    from sklearn.pipeline import FeatureUnion
    from sklearn.svm import LinearSVC
    labels = [record["difficulty"] for record in base]
    texts = ["skill_%s %s" % (record["skill"].replace(" ", "_"), content_for_dedup(record)) for record in base]
    train_x, test_x, train_y, test_y = train_test_split(
        texts, labels, test_size=0.2, random_state=23, stratify=labels)
    features = FeatureUnion([
        ("word", TfidfVectorizer(ngram_range=(1, 2), min_df=2, max_features=18000, sublinear_tf=True)),
        ("char", TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), min_df=2,
                                 max_features=22000, sublinear_tf=True)),
    ])
    train_matrix = features.fit_transform(train_x)
    model = LinearSVC(class_weight="balanced", random_state=23)
    model.fit(train_matrix, train_y)
    predicted = model.predict(features.transform(test_x))
    correct = sum(a == b for a, b in zip(test_y, predicted))
    rank = {"Easy": 0, "Medium": 1, "Hard": 2}
    adjacent = sum(a != b and abs(rank[a] - rank[b]) == 1 for a, b in zip(test_y, predicted))
    wild = sum(abs(rank[a] - rank[b]) == 2 for a, b in zip(test_y, predicted))
    model.fit(features.transform(texts), labels)
    incoming = ["skill_%s %s" % (record["skill"].replace(" ", "_"), content_for_dedup(record))
                for record in records]
    output = list(model.predict(features.transform(incoming)))
    return output, {"total": len(test_y), "correct": correct, "accuracy": correct / len(test_y),
                    "adjacent": adjacent, "wild": wild, "confusion": Counter(zip(test_y, predicted))}


def deduplicate(records, base):
    dropped = []
    review = []
    accepted = []
    top_base = []
    base_grams = [(grams(content_for_dedup(old)), old) for old in base]
    accepted_grams = []
    for record in records:
        candidate_text = content_for_dedup(record)
        candidate_grams = grams(candidate_text)
        nearest = max(((dice_sets(candidate_grams, old_grams), old) for old_grams, old in base_grams),
                      key=lambda item: item[0])
        top_base.append((nearest[0], record["_sourceQid"], nearest[1]["id"]))
        if nearest[0] >= 0.95:
            dropped.append((record, "base", nearest[0], nearest[1]["id"]))
            continue
        duplicate = None
        passage_grams = grams(record["passage"])
        for prior_grams, prior in accepted_grams:
            score = dice_sets(passage_grams, prior_grams)
            if score >= 0.95:
                duplicate = (score, prior)
                break
            if score >= 0.70:
                review.append((score, record["_sourceQid"], prior["_sourceQid"]))
        if duplicate:
            dropped.append((record, "batch", duplicate[0], duplicate[1]["_sourceQid"]))
            continue
        accepted.append(record)
        accepted_grams.append((passage_grams, record))
    return accepted, dropped, sorted(review, reverse=True), sorted(top_base, reverse=True)


def apply_grammar_explanations(records):
    grammar = [record for record in records if record["_domain"] in {"conventions", "expression_ideas"}
               and record["source"]["book"].startswith("The Ultimate")]
    path = PENDING / "grammar-for-explain.json"
    path.write_text(json.dumps(grammar, ensure_ascii=False), encoding="utf-8")
    result = subprocess.run(["node", str(HERE / "tools" / "explain.js"), str(path)],
                            cwd=HERE, check=True, capture_output=True, text=True, encoding="utf-8")
    explained = {record["_sourceQid"]: record["explanation"] for record in json.loads(result.stdout)}
    for record in grammar:
        record["explanation"] = explained[record["_sourceQid"]]


def withhold_weak_feedback(records):
    withheld = []
    kept = []
    for record in records:
        is_grammar = record["source"]["book"].startswith("The Ultimate")
        if is_grammar and re.match(r"^The answer is [A-D],", record.get("explanation", "")):
            withheld.append(record)
        else:
            kept.append(record)
    return kept, withheld


def crop_figures(records):
    for record in records:
        if record["skill"] != "Command of Evidence — Quantitative":
            continue
        page = record["_sourcePage"]
        box = FIGURE_BOXES[page]
        image = Image.open(HERE / "_extract" / "pages" / "critical_reader" / ("p%03d.png" % page))
        crop = image.crop(box)
        if crop.width < 500 or crop.height < 250:
            raise ValueError("quantitative crop too small on p.%s" % page)
        filename = "coeq_%s.png" % record["id"]
        crop.save(HERE / "assets" / filename)
        record["image"] = "assets/" + filename
        record["figureChecks"] = FIGURE_CHECKS[page]


def public_record(record):
    order = ["id", "image", "skill", "difficulty", "difficultyStatus", "passage", "question",
             "options", "answer", "explanation", "strategy", "ruleType", "source", "figureChecks"]
    return OrderedDict((key, record[key]) for key in order if key in record)


def write_extensions(records):
    grouped = defaultdict(list)
    for record in records:
        grouped[record["_domain"]].append(public_record(record))
    for domain, (filename, ext_name, base_name) in EXT_FILES.items():
        payload = json.dumps(grouped[domain], ensure_ascii=False, indent=2)
        text = "const %s = %s;\n%s.push(...%s);\n" % (ext_name, payload, base_name, ext_name)
        (HERE / filename).write_text(text, encoding="utf-8", newline="\n")
    return grouped


def write_reports(records, stage4, deduped_count, dropped, withheld, review, top_base, metrics, grouped):
    PENDING.mkdir(parents=True, exist_ok=True)
    letters = Counter(record["answer"] for record in records)
    skill_counts = Counter(record["skill"] for record in records)
    rule_counts = Counter(record.get("ruleType") for record in records if record.get("ruleType"))
    lines = ["# Stages 4-7 — extraction report", "", "## Stage 4 — answer join", "",
             "Every promoted record has visual option order `ABCD`, a matching key letter, and exact question/key pages.", "",
             "| book | joined |", "|---|---:|",
             "| grammar | %d |" % sum(qid.startswith("grammar_") for qid, _, _, _ in stage4),
             "| Critical Reader | %d |" % sum(qid.startswith("critical_") for qid, _, _, _ in stage4),
             "", "## Stage 5 — deduplication", "",
             "| result | count |", "|---|---:|", "| promoted after dedup | %d |" % deduped_count,
             "| dropped as duplicates | %d |" % len(dropped),
             "| manual-review pairs (0.70-0.95) | %d |" % len(review), ""]
    for record, where, score, other in dropped:
        lines.append("- Dropped `%s` against %s `%s` (%.3f)." %
                     (record["_sourceQid"], where, other, score))
    if review:
        lines.extend(["", "Review band:"])
        lines.extend("- %.3f: `%s` / `%s`" % item for item in review)
    lines.extend(["", "Highest new-vs-base similarities:"])
    lines.extend("- %.3f: `%s` / `%s`" % item for item in top_base[:10])
    lines.extend(["", "## Stage 6 — schema", "", "### Difficulty classifier", "",
                  "Holdout agreement: **%d/%d (%.1f%%)**; adjacent errors: **%d**; wild Easy↔Hard errors: **%d**." %
                  (metrics["correct"], metrics["total"], 100 * metrics["accuracy"],
                   metrics["adjacent"], metrics["wild"]), "",
                  "Every label is stored with `difficultyStatus: \"provisional\"`.", "",
                  "### Feedback gate", "",
                  "Withheld **%d** keyed grammar questions whose generated feedback only revealed the answer." % len(withheld), ""])
    lines.extend("- `%s` (%s)" % (record["_sourceQid"], record["skill"]) for record in withheld)
    lines.extend(["",
                  "### Skills", "", "| skill | count |", "|---|---:|"])
    lines.extend("| %s | %d |" % item for item in sorted(skill_counts.items()))
    lines.extend(["", "### Convention rule types", "", "| ruleType | count |", "|---|---:|"])
    lines.extend("| %s | %d |" % item for item in sorted(rule_counts.items()))
    lines.extend(["", "## Stage 7 — gates", "", "| gate | result |", "|---|---:|",
                  "| records | %d |" % len(records),
                  "| answer A/B/C/D | %s |" % ", ".join("%s=%d" % item for item in sorted(letters.items())),
                  "| ext files | %s |" % ", ".join("%s=%d" % (EXT_FILES[key][0], len(grouped[key])) for key in EXT_FILES),
                  "| quantitative figures | %d |" % sum(bool(record.get("image")) for record in records), ""])
    (PENDING / "EXTRACTION-REPORT.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    (PENDING / "questions.json").write_text(
        json.dumps([public_record(record) for record in records], ensure_ascii=False, indent=2), encoding="utf-8")


def validate(records, base):
    ids = [record["id"] for record in base] + [record["id"] for record in records]
    if len(ids) != len(set(ids)):
        raise ValueError("duplicate id across merged bank")
    valid_skills = {record["skill"] for record in base}
    for record in records:
        if len(record["options"]) != 4 or record["answer"] not in "ABCD":
            raise ValueError("invalid options/answer: %s" % record["_sourceQid"])
        if record["skill"] not in valid_skills:
            raise ValueError("unknown skill: %s" % record["skill"])
        if record["skill"] in {"Boundaries", "Form, Structure, and Sense"} and not record.get("ruleType"):
            raise ValueError("missing ruleType: %s" % record["_sourceQid"])
        for field in ["passage", "question", "explanation", "strategy"]:
            if not clean_text(record.get(field)):
                raise ValueError("empty %s: %s" % (field, record["_sourceQid"]))
        if len(record["explanation"]) > 6000 or re.search(r"Answers:|Exercise:|Mark for Review", record["explanation"]):
            raise ValueError("explanation boundary leak: %s" % record["_sourceQid"])
        if record["source"]["book"].startswith("The Ultimate") \
                and re.match(r"^The answer is [A-D],", record["explanation"]):
            raise ValueError("answer-only feedback: %s" % record["_sourceQid"])
        if record.get("image") and not (HERE / record["image"]).exists():
            raise ValueError("missing image: %s" % record["image"])
        if not all(record["source"].get(field) is not None
                   for field in ["book", "questionPage", "keyPage", "ref"]):
            raise ValueError("incomplete provenance: %s" % record["_sourceQid"])
    refs = [record["source"]["ref"] for record in records]
    if len(refs) != len(set(refs)):
        raise ValueError("duplicate source ref in extension bank")
    counts = Counter(record["answer"] for record in records)
    if max(counts.values()) / len(records) > 0.40:
        raise ValueError("implausible answer distribution: %r" % counts)


def build():
    PENDING.mkdir(parents=True, exist_ok=True)
    base = load_base()
    frozen_ids = load_frozen_ids()
    records, stage4 = build_records()
    records, dropped, review, top_base = deduplicate(records, base)
    deduped_count = len(records)
    difficulties, metrics = difficulty_model(base, records)
    for record, difficulty in zip(records, difficulties):
        record["difficulty"] = difficulty
        record["difficultyStatus"] = "provisional"
        record["id"] = frozen_ids.get(record["_sourceQid"], mint_id(record))
    apply_grammar_explanations(records)
    records, withheld = withhold_weak_feedback(records)
    crop_figures(records)
    validate(records, base)
    grouped = write_extensions(records)
    write_reports(records, stage4, deduped_count, dropped, withheld, review, top_base, metrics, grouped)
    print("built %d questions; dropped %d duplicates; withheld %d for feedback; review pairs %d" %
          (len(records), len(dropped), len(withheld), len(review)))
    print("difficulty holdout %.1f%% (%d adjacent, %d wild)" %
          (100 * metrics["accuracy"], metrics["adjacent"], metrics["wild"]))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.parse_args()
    build()
