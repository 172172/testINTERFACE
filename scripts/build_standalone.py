#!/usr/bin/env python3
"""Build one HTML file containing CSS, JavaScript and the complete dataset."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
OUTPUT = ROOT / "valkompass-2026-standalone.html"
VERSIONED_OUTPUT = ROOT / "valkompass-2026-standalone-v0.4.html"


def read_json(name: str):
    return json.loads((DATA_DIR / name).read_text(encoding="utf-8"))


def safe_script_json(value) -> str:
    # Prevent a data string from ending the surrounding script element.
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")


def safe_style_text(value: str) -> str:
    # Prevent an accidental literal closing style tag in embedded CSS.
    return value.replace("</style", "<\\/style")


def safe_script_text(value: str) -> str:
    # Prevent an accidental literal closing script tag in embedded JavaScript.
    return value.replace("</script", "<\\/script")


def main() -> None:
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    css = (ROOT / "styles.css").read_text(encoding="utf-8")
    scoring = (ROOT / "scoring.js").read_text(encoding="utf-8")
    app = (ROOT / "app.js").read_text(encoding="utf-8")

    dataset = {
        "questions": read_json("questions.json"),
        "parties": read_json("parties.json"),
        "positions": read_json("positions.json"),
        "meta": read_json("meta.json"),
        "sources": read_json("source-register.json"),
    }

    # The standalone build puts both modules in one module scope.
    scoring = re.sub(r"^export\s+", "", scoring, flags=re.MULTILINE)
    app = re.sub(
        r'^import\s*\{[\s\S]*?\}\s*from\s*["\']\.\/scoring\.js["\'];\s*',
        "",
        app,
        count=1,
    )

    html, stylesheet_replacements = re.subn(
        r'<link\s+rel=["\']stylesheet["\']\s+href=["\']styles\.css["\']\s*/?>',
        lambda _match: f"<style>\n{safe_style_text(css)}\n</style>",
        html,
        count=1,
        flags=re.IGNORECASE,
    )
    if stylesheet_replacements != 1:
        raise RuntimeError("Kunde inte bädda in styles.css: stylesheet-taggen hittades inte exakt en gång.")
    embedded = f"<script>window.__VALKOMPASS_DATA__={safe_script_json(dataset)};</script>"
    application_source = safe_script_text(f"{scoring}\n\n{app}")
    application = (
        "<script>\n"
        "(async () => {\n"
        f"{application_source}\n"
        "})().catch((error) => console.error(error));\n"
        "</script>"
    )
    html, script_replacements = re.subn(
        r'<script\s+type=["\']module["\']\s+src=["\']app\.js["\']\s*></script>',
        lambda _match: f"{embedded}\n  {application}",
        html,
        count=1,
        flags=re.IGNORECASE,
    )
    if script_replacements != 1:
        raise RuntimeError("Kunde inte bädda in app.js: module-scriptet hittades inte exakt en gång.")
    html = re.sub(
        r"(<title>\s*Öppen\s+Valkompass\s+2026)(\s*</title>)",
        r"\1 – fristående\2",
        html,
        count=1,
        flags=re.IGNORECASE,
    )

    if 'href="styles.css"' in html or 'src="app.js"' in html:
        raise RuntimeError("Standalone-bygget innehåller fortfarande externa lokala beroenden.")

    OUTPUT.write_text(html, encoding="utf-8")
    VERSIONED_OUTPUT.write_text(html, encoding="utf-8")
    print(f"Built {OUTPUT} ({OUTPUT.stat().st_size:,} bytes)")
    print(f"Built {VERSIONED_OUTPUT} ({VERSIONED_OUTPUT.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
