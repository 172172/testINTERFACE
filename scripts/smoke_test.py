#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def fail(message: str) -> None:
    print(f"FEL: {message}")
    raise SystemExit(1)


def main() -> int:
    required = [
        "index.html", "styles.css", "app.js", "scoring.js",
        "data/questions.json", "data/parties.json", "data/positions.json",
        "data/source-register.json", "data/meta.json",
        "valkompass-2026-standalone.html",
    ]
    for name in required:
        if not (ROOT / name).is_file():
            fail(f"Saknar {name}")

    questions = json.loads((ROOT / "data/questions.json").read_text(encoding="utf-8"))
    parties = json.loads((ROOT / "data/parties.json").read_text(encoding="utf-8"))
    positions = json.loads((ROOT / "data/positions.json").read_text(encoding="utf-8"))
    meta = json.loads((ROOT / "data/meta.json").read_text(encoding="utf-8"))
    standalone = (ROOT / "valkompass-2026-standalone.html").read_text(encoding="utf-8")

    if len(questions) != 60 or len(parties) != 9 or len(positions) != 540:
        fail("Oväntade datamängder")
    if "window.__VALKOMPASS_DATA__=" not in standalone:
        fail("Standalone-filen saknar inbäddat dataset")
    if 'src="app.js"' in standalone or 'href="styles.css"' in standalone:
        fail("Standalone-filen har kvar externa app- eller CSS-beroenden")
    if meta["dataFingerprintSha256"] not in standalone:
        fail("Standalone-filen saknar datasetets fingeravtryck")
    if not re.search(r"<script>[\s\S]+\(async \(\) => \{[\s\S]+renderRoute\(\);", standalone):
        fail("Standalone-filen saknar körbar appkod")

    print("Statisk smoke test: GODKÄND")
    return 0


if __name__ == "__main__":
    sys.exit(main())
