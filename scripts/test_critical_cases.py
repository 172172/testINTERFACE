#!/usr/bin/env python3
"""Regression tests for politically sensitive data-quality cases.

These tests intentionally cover mistakes that would create a false political
picture even if the web app itself still ran correctly.
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"


def load(name: str):
    return json.loads((DATA / name).read_text(encoding="utf-8"))


def main() -> int:
    questions = load("questions.json")
    positions = load("positions.json")
    qmap = {q["id"]: q for q in questions}
    pmap = {(r["party"], r["question"]): r for r in positions}

    # The original overly broad tax question must never return to scoring.
    tax_precision = qmap["r001"]
    assert tax_precision["score"] is False and tax_precision["status"] == "research"
    assert all(pmap[(pid, "r001")]["position"] is None for pid in ("s", "m", "sd", "v", "c", "kd", "l", "mp", "op"))

    # The live high-income-tax dimension is exact and reproduces the parties'
    # own five-step 2026 answers. This is the concrete case that exposed the
    # earlier methodological problem.
    q = qmap["q033"]
    assert q["text"] == "Personer med höga inkomster bör betala mer skatt än de gör i dag."
    assert q["sourcePrompt"] == "Hur mycket ska höginkomsttagare betala i skatt?"
    expected = {
        "s": (1, "Lite mer"),
        "m": (-1, "Lite mindre"),
        "sd": (-1, "Lite mindre"),
        "v": (1, "Lite mer"),
        "c": (0, "Samma som i dag"),
        "kd": (-1, "Lite mindre"),
        "l": (-2, "Mycket mindre"),
        "mp": (1, "Lite mer"),
    }
    for pid, (value, label) in expected.items():
        row = pmap[(pid, "q033")]
        assert row["position"] == value, (pid, row["position"], value)
        assert row["sourceAnswer"] == label, (pid, row["sourceAnswer"], label)
        assert row["semanticMatch"] == "same-proposition-neutral-paraphrase"

    # Fail closed on a nearby-but-not-identical policy. ÖP says stop large wind
    # and give nearby property owners a veto; that is not an explicit answer on
    # the municipality's separate veto power.
    op_wind = pmap[("op", "q028")]
    assert op_wind["position"] is None
    assert op_wind["confidence"] == "unknown"
    assert op_wind["codingStatus"] == "insufficient-scope-match"
    assert op_wind["semanticMatch"] == "insufficient-specificity"

    # Direct official-program positions that really do cover the exact active
    # proposition remain available, but ÖP stays outside the main ranking.
    for qid, value in {"q014": -2, "q019": 2, "q021": 2, "q024": 2, "q027": 2, "q034": -2}.items():
        row = pmap[("op", qid)]
        assert row["position"] == value, (qid, row["position"], value)
        assert row["codingStatus"] == "verified"
        assert row["evidenceType"] == "official-election-program"

    print("Kritiska datakvalitetstester: GODKÄNDA")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
