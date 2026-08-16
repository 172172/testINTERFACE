#!/usr/bin/env python3
"""Generate a human-readable source-to-code audit matrix."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
OUT = ROOT / "SOURCE_AUDIT.md"

questions = json.loads((DATA / "questions.json").read_text(encoding="utf-8"))
parties = json.loads((DATA / "parties.json").read_text(encoding="utf-8"))
positions = json.loads((DATA / "positions.json").read_text(encoding="utf-8"))
meta = json.loads((DATA / "meta.json").read_text(encoding="utf-8"))

q_active = [q for q in questions if q.get("score") is True and q.get("status") == "active"]
core = [p for p in parties if p.get("comparisonGroup") == "core"]
op = next(p for p in parties if p["id"] == "op")
pmap = {(r["party"], r["question"]): r for r in positions}

lines = [
    "# Källmatris – Öppen Valkompass 2026",
    "",
    f"Dataset: `{meta['datasetVersion']}`  ",
    f"Verifierad t.o.m.: `{meta['verifiedThrough']}`  ",
    f"SHA-256-fingeravtryck: `{meta['dataFingerprintSha256']}`",
    "",
    "Detta dokument visar **källfråga → partiets eget källsvar → numerisk kod** för den jämförbara kärnan. Kodningen för de åtta riksdagspartierna är mekanisk. Ingen kommentar får flytta ett parti upp eller ned på skalan.",
    "",
    "Skala: `Mycket dåligt/Mycket mindre = -2`, `Ganska dåligt/Lite mindre = -1`, `Samma som i dag = 0`, `Ganska bra/Lite mer = +1`, `Mycket bra/Mycket mer = +2`.",
    "",
]

for q in q_active:
    lines += [
        f"## {q['id']} – {q['text']}",
        "",
        f"**Avgränsning:** {q['scope']}",
        "",
        f"**Källans exakta fråga:** {q['sourcePrompt']}",
        "",
        "| Parti | Källans svar | Kod | Källa |",
        "|---|---|---:|---|",
    ]
    for party in core:
        row = pmap[(party["id"], q["id"])]
        code = f"{row['position']:+d}" if isinstance(row.get("position"), int) else "okänd"
        lines.append(f"| {party['name']} | {row.get('sourceAnswer') or '—'} | `{code}` | {row.get('sourceTitle') or '—'} |")
    orow = pmap[(op["id"], q["id"])]
    if orow.get("position") is not None or q["id"] == "q028":
        code = f"{orow['position']:+d}" if isinstance(orow.get("position"), int) else "okänd"
        lines += [
            "",
            f"**Örebropartiet:** `{code}` – {orow['rationale']}",
        ]
    lines.append("")

lines += [
    "## Viktig begränsning",
    "",
    "En tekniskt verifierad kod visar att den lagrade koden följer den angivna källans svar. Det är inte samma sak som att hela partiets politik kan sammanfattas av en enda fråga. Därför visas avgränsningen, originalfrågan och källsvaret tillsammans.",
    "",
    "Örebropartiet rankas inte mot kärnpartierna förrän en tillräckligt komplett jämförbar matris finns. `q028` är medvetet okänd trots närliggande vindkraftspolitik, eftersom publicerat material inte uttryckligen besvarar den kommunala vetorätten.",
]

OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
print(f"Generated {OUT}")
