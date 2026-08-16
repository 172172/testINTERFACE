#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import re
import sys
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
ALLOWED_POSITIONS = {-2, -1, 0, 1, 2, None}
ALLOWED_CONFIDENCE = {"high", "medium", "low", "unknown"}
ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
PROPOSITION_LABELS = {
    -2: "Mycket dåligt förslag",
    -1: "Ganska dåligt förslag",
    1: "Ganska bra förslag",
    2: "Mycket bra förslag",
}
SLIDER_LABELS = {
    -2: "Mycket mindre",
    -1: "Lite mindre",
    0: "Samma som i dag",
    1: "Lite mer",
    2: "Mycket mer",
}


def load(name: str) -> Any:
    return json.loads((DATA / name).read_text(encoding="utf-8"))


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    h.update(path.read_bytes())
    return h.hexdigest()


def valid_iso_date(value: Any) -> bool:
    if not isinstance(value, str) or not ISO_DATE.fullmatch(value):
        return False
    try:
        date.fromisoformat(value)
    except ValueError:
        return False
    return True


def main() -> int:
    questions = load("questions.json")
    parties = load("parties.json")
    positions = load("positions.json")
    sources = load("source-register.json")
    meta = load("meta.json")

    errors: list[str] = []
    warnings: list[str] = []

    qids = [q.get("id") for q in questions]
    pids = [p.get("id") for p in parties]
    source_id_list = [s.get("id") for s in sources]
    source_ids = set(source_id_list)
    active = sorted(
        [q for q in questions if q.get("status") == "active" and q.get("score") is True],
        key=lambda q: q.get("order", 9999),
    )
    research = sorted(
        [q for q in questions if q.get("status") == "research" and q.get("score") is False],
        key=lambda q: q.get("order", 9999),
    )
    core = sorted(
        [p for p in parties if p.get("comparisonGroup") == "core"],
        key=lambda p: p.get("sortOrder", 9999),
    )
    provisional = sorted(
        [p for p in parties if p.get("comparisonGroup") == "provisional"],
        key=lambda p: p.get("sortOrder", 9999),
    )

    if len(qids) != len(set(qids)):
        errors.append("Question IDs are not unique.")
    if len(pids) != len(set(pids)):
        errors.append("Party IDs are not unique.")
    if len(source_id_list) != len(source_ids):
        errors.append("Source IDs are not unique.")
    if len(questions) != meta.get("totalQuestionCount") or len(questions) != 60:
        errors.append(f"Expected 60 questions and a matching meta count, got {len(questions)} / {meta.get('totalQuestionCount')}.")
    if len(active) != meta.get("activeQuestionCount") or len(active) != 35:
        errors.append(f"Expected 35 active questions and a matching meta count, got {len(active)} / {meta.get('activeQuestionCount')}.")
    if len(research) != meta.get("researchQuestionCount") or len(research) != 25:
        errors.append(f"Expected 25 research questions and a matching meta count, got {len(research)} / {meta.get('researchQuestionCount')}.")
    if len(parties) != 9 or len(core) != 8 or len(provisional) != 1:
        errors.append(f"Expected 9 parties (8 core + 1 provisional), got {len(parties)} ({len(core)} + {len(provisional)}).")
    if len(positions) != len(questions) * len(parties):
        errors.append(f"Expected {len(questions) * len(parties)} position rows, got {len(positions)}.")

    expected_core_ids = [p["id"] for p in core]
    expected_provisional_ids = [p["id"] for p in provisional]
    if meta.get("corePartyIds") != expected_core_ids:
        errors.append("meta.corePartyIds does not match the parties marked as core.")
    if meta.get("provisionalPartyIds") != expected_provisional_ids:
        errors.append("meta.provisionalPartyIds does not match the parties marked as provisional.")
    if not valid_iso_date(meta.get("verifiedThrough")):
        errors.append("meta.verifiedThrough is not a valid ISO date.")
    if not valid_iso_date(meta.get("electionDate")):
        errors.append("meta.electionDate is not a valid ISO date.")

    qmap = {q["id"]: q for q in questions if q.get("id")}
    pmap = {p["id"]: p for p in parties if p.get("id")}
    rows_by_party: dict[str, dict[str, dict[str, Any]]] = defaultdict(dict)
    seen: set[tuple[str, str]] = set()

    active_ordinals = [q.get("sourceQuestionOrdinal") for q in active]
    if active_ordinals != list(range(1, 36)):
        errors.append(f"Active sourceQuestionOrdinal values must be exactly 1..35, got {active_ordinals}.")

    area_counts = Counter(q.get("area") for q in active)
    if not area_counts or min(area_counts.values()) < 2 or max(area_counts.values()) > 3:
        errors.append(f"Active area counts must be balanced at 2–3 questions per area, got {dict(area_counts)}.")
    if meta.get("activeAreaCounts") != dict(area_counts):
        errors.append("meta.activeAreaCounts is stale or ordered differently from generated data.")

    for q in questions:
        qid = q.get("id")
        for field in ("id", "area", "text", "scope", "status", "score", "codingRule", "order"):
            if field not in q or q[field] in (None, ""):
                errors.append(f"Question {qid} is missing {field}.")
        if q.get("status") == "active":
            for field in ("sourceReference", "sourceSet", "sourceQuestionOrdinal", "sourceQuestionType", "sourcePrompt", "wordingMethod"):
                if not q.get(field):
                    errors.append(f"Active question {qid} is missing {field}.")
            if q.get("sourceQuestionType") not in {"proposition", "directional-slider"}:
                errors.append(f"Active question {qid} has invalid sourceQuestionType {q.get('sourceQuestionType')!r}.")
        elif q.get("status") == "research":
            if q.get("score") is not False:
                errors.append(f"Research question {qid} is incorrectly active.")
        else:
            errors.append(f"Question {qid} has an unsupported status/score combination.")

    for source in sources:
        sid = source.get("id")
        for field in ("id", "publisher", "title", "url", "sourceType", "verified"):
            if not source.get(field):
                errors.append(f"Source {sid} is missing {field}.")
        if source.get("url") and not str(source["url"]).startswith("https://"):
            errors.append(f"Source {sid} does not use HTTPS.")
        if source.get("verified") and not valid_iso_date(source.get("verified")):
            errors.append(f"Source {sid} has an invalid verified date.")

    for row in positions:
        party_id = row.get("party")
        question_id = row.get("question")
        key = (party_id, question_id)
        key_text = f"{party_id}:{question_id}"
        if key in seen:
            errors.append(f"Duplicate position row: {key_text}.")
        seen.add(key)
        party = pmap.get(party_id)
        question = qmap.get(question_id)
        if not party:
            errors.append(f"Unknown party in position row: {party_id}.")
            continue
        if not question:
            errors.append(f"Unknown question in position row: {question_id}.")
            continue
        rows_by_party[party_id][question_id] = row

        if row.get("comparisonGroup") != party.get("comparisonGroup"):
            errors.append(f"Position row {key_text} has a stale comparisonGroup.")
        if row.get("position") not in ALLOWED_POSITIONS:
            errors.append(f"Invalid position {row.get('position')} for {key_text}.")
        if row.get("confidence") not in ALLOWED_CONFIDENCE:
            errors.append(f"Invalid confidence {row.get('confidence')!r} for {key_text}.")
        if row.get("sourceId") and row.get("sourceId") not in source_ids:
            errors.append(f"Unknown sourceId {row.get('sourceId')} for {key_text}.")
        if row.get("verified") and not valid_iso_date(row.get("verified")):
            errors.append(f"Invalid verified date for {key_text}.")

        known = row.get("position") is not None
        if known:
            for field in ("source", "sourceId", "sourceTitle", "sourcePublisher", "verified", "rationale", "confidence", "sourceAnswer", "evidenceType", "semanticMatch"):
                if not row.get(field):
                    errors.append(f"Known row {key_text} is missing {field}.")
            if row.get("codingStatus") != "verified":
                errors.append(f"Known row {key_text} must have codingStatus=verified.")
            if not str(row.get("source", "")).startswith("https://"):
                errors.append(f"Known row {key_text} has a non-HTTPS source URL.")
        else:
            if row.get("codingStatus") == "verified":
                errors.append(f"Unknown row {key_text} may not have codingStatus=verified.")
            if row.get("confidence") != "unknown":
                errors.append(f"Unknown row {key_text} must have confidence=unknown.")

        if question.get("status") == "research":
            if known:
                errors.append(f"Research question {question_id} has an active position for {party_id}.")
            if row.get("codingStatus") != "not-in-scoring-matrix":
                errors.append(f"Research row {key_text} must have codingStatus=not-in-scoring-matrix.")

        # For the eight-party common matrix, the numeric value must be a purely
        # mechanical translation of the source answer label.
        if row.get("evidenceType") == "party-self-report-established-compass" and known:
            expected_labels = SLIDER_LABELS if question.get("sourceQuestionType") == "directional-slider" else PROPOSITION_LABELS
            expected = expected_labels.get(row["position"])
            if expected is None:
                errors.append(f"Position {row['position']} cannot be used on {question.get('sourceQuestionType')} question {key_text}.")
            elif row.get("sourceAnswer") != expected:
                errors.append(
                    f"Mechanical mapping mismatch for {key_text}: position {row['position']} requires {expected!r}, got {row.get('sourceAnswer')!r}."
                )
            if row.get("semanticMatch") != "same-proposition-neutral-paraphrase":
                errors.append(f"Core source row {key_text} has an unexpected semanticMatch.")

    active_ids = {q["id"] for q in active}
    research_ids = {q["id"] for q in research}
    core_ids = {p["id"] for p in core}
    provisional_ids = {p["id"] for p in provisional}

    missing_core: list[str] = []
    for pid in sorted(core_ids):
        for qid in sorted(active_ids):
            row = rows_by_party.get(pid, {}).get(qid)
            if not row or row.get("position") is None or row.get("codingStatus") != "verified":
                missing_core.append(f"{pid}:{qid}")
    if missing_core:
        errors.append("Incomplete core scoring matrix: " + ", ".join(missing_core[:12]) + (" …" if len(missing_core) > 12 else ""))

    research_known = [r for r in positions if r.get("question") in research_ids and r.get("position") is not None]

    canonical_payload = json.dumps(
        {"questions": questions, "parties": parties, "positions": positions, "sources": sources},
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    actual_fingerprint = hashlib.sha256(canonical_payload).hexdigest()
    if actual_fingerprint != meta.get("dataFingerprintSha256"):
        errors.append("Dataset fingerprint in meta.json does not match canonical data.")

    expected_core = len(active) * len(core)
    verified_core = sum(
        r.get("question") in active_ids
        and r.get("party") in core_ids
        and r.get("codingStatus") == "verified"
        and r.get("position") is not None
        for r in positions
    )
    known_provisional = sum(
        r.get("question") in active_ids
        and r.get("party") in provisional_ids
        and r.get("position") is not None
        and r.get("codingStatus") == "verified"
        for r in positions
    )

    readiness = meta.get("readiness", {})
    if readiness.get("coreMatrixRequired") != expected_core:
        errors.append("meta.readiness.coreMatrixRequired is stale.")
    if readiness.get("coreMatrixVerified") != verified_core:
        errors.append("meta.readiness.coreMatrixVerified is stale.")
    if readiness.get("provisionalKnown") != known_provisional:
        errors.append("meta.readiness.provisionalKnown is stale.")
    if readiness.get("researchIncludedInScoring") is not False:
        errors.append("meta.readiness.researchIncludedInScoring must be false.")
    if verified_core != expected_core:
        errors.append(f"Core matrix expected {expected_core} verified rows, got {verified_core}.")
    if known_provisional < 1:
        warnings.append("No provisional party positions are known.")

    print("ÖPPEN VALKOMPASS 2026 – DATASETVALIDERING")
    print("=" * 47)
    print(f"Version:                 {meta.get('datasetVersion')}")
    print(f"Verifierad t.o.m.:       {meta.get('verifiedThrough')}")
    print(f"Datafingeravtryck:       {actual_fingerprint}")
    print(f"Frågor totalt:           {len(questions)}")
    print(f"Aktiva / forskning:      {len(active)} / {len(research)}")
    print(f"Aktiva politikområden:   {len(area_counts)}")
    print(f"Områdesfördelning:       {dict(sorted(area_counts.items()))}")
    print(f"Partier:                 {len(parties)} ({len(core)} jämförbara + {len(provisional)} preliminärt)")
    print(f"Kärnmatris:              {verified_core}/{expected_core} verifierade positioner")
    print(f"Preliminära positioner:  {known_provisional}/{len(active) * len(provisional)}")
    print(f"Forskningsrader i poäng: {len(research_known)}")
    print(f"Positionsrader totalt:   {len(positions)}")
    print()
    print("Filkontroller:")
    for filename in ("questions.json", "parties.json", "positions.json", "source-register.json", "meta.json"):
        path = DATA / filename
        print(f"  {filename:<22} {sha256(path)}")
    print()
    if warnings:
        print("VARNINGAR:")
        for warning in warnings:
            print(f"  - {warning}")
        print()
    if errors:
        print("FEL:")
        for error in errors:
            print(f"  - {error}")
        print("\nRESULTAT: UNDERKÄND")
        return 1
    print("RESULTAT: GODKÄND")
    print("Den jämförbara kärnan är komplett, varje kärnkod matchar källans svarsetikett, forskningsfrågorna är avstängda och okända värden förblir null.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
