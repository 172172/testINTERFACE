#!/usr/bin/env python3
"""End-to-end smoke tests for the modular and standalone builds."""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
STANDALONE = ROOT / "valkompass-2026-standalone.html"
SCREENSHOT = ROOT.parent / "valkompass-2026-v0.4-preview.png"
CHROMIUM = os.environ.get("CHROMIUM_PATH", "/usr/bin/chromium")


def assert_equal(actual, expected, message: str) -> None:
    if actual != expected:
        raise AssertionError(f"{message}: väntade {expected!r}, fick {actual!r}")


def assert_true(value, message: str) -> None:
    if not value:
        raise AssertionError(message)


def run_app_flow_test(browser) -> dict:
    context = browser.new_context(viewport={"width": 1440, "height": 1000}, locale="sv-SE")
    page = context.new_page()
    console_errors: list[str] = []
    page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
    page.set_content(STANDALONE.read_text(encoding="utf-8"), wait_until="load")
    page.wait_for_function("window.__VALKOMPASS_READY__ === true")

    data_errors = page.evaluate("window.__VALKOMPASS_TEST__.dataErrors")
    assert_equal(data_errors, [], "Webbläsarens dataspärr")
    assert_equal(page.evaluate("window.__VALKOMPASS_TEST__.activeQuestions.length"), 43, "Antal aktiva frågor")
    assert_equal(page.locator(".hero-status .status-line").count(), 4, "Statusrader på startsidan")

    page.locator("#start-compass").click()
    page.wait_for_selector(".question-card")

    skipped = 0
    for index in range(43):
        if index == 7:
            page.locator("#skip-question").click()
            skipped += 1
        else:
            answer = [-2, -1, 0, 1, 2][index % 5]
            page.locator(f'[data-answer="{answer}"]').click()
            importance = [0, 1, 2, 3, 5][(index * 2) % 5]
            page.locator(f'[data-importance="{importance}"]').click()
        page.locator("#next-question").click()

    page.wait_for_selector(".results-page")
    page.wait_for_selector(".results-list")
    assert_equal(page.locator(".result-row").count(), 8, "Antal partier i huvudrankningen")
    assert_equal(page.locator(".provisional-section").count(), 1, "Separat ÖP-sektion")
    assert_true("Örebropartiet" in page.locator(".provisional-section").inner_text(), "ÖP ska visas separat")
    assert_true(page.locator(".results-heading h1").inner_text().startswith("Din högsta matchning"), "Resultatrubrik saknas")

    scores = page.evaluate("window.__VALKOMPASS_TEST__.getScores().map(x => ({id:x.party.id, eligible:x.eligibleForRanking, total:x.total, priority:x.priority, known:x.knownQuestionCount, answered:x.answeredQuestionCount}))")
    core = [row for row in scores if row["id"] != "op"]
    assert_equal(len(core), 8, "Kärnpartier i poängresultatet")
    assert_true(all(row["eligible"] for row in core), "Alla kärnpartier måste vara rankningsbara")
    assert_true(all(row["known"] == row["answered"] for row in core), "Kärnpartier får inte ha okända jämförelser")

    first_detail_href = page.locator(".result-row a").first.get_attribute("href")
    assert_true(first_detail_href and first_detail_href.startswith("#/party/"), "Partidetaljlänk saknas")
    page.locator(".result-row a").first.click()
    page.wait_for_selector(".comparison-list")
    assert_equal(page.locator(".comparison-card").count(), 43 - skipped, "Fråga-för-fråga-rader på partidetaljen")
    page.locator(".comparison-card").first.locator("summary").click()
    assert_true(page.locator(".comparison-card").first.locator(".source-panel a").count() == 1, "Källänk saknas i partidetaljen")

    page.evaluate("location.hash = '#/audit/integrity'")
    page.wait_for_selector(".integrity-list")
    assert_true("Godkänd" in page.locator(".integrity-list").inner_text(), "Integritetsvyn ska visa godkänd webbläsarspärr")

    page.evaluate("location.hash = '#/results'")
    page.wait_for_selector(".results-page")
    page.evaluate("document.documentElement.style.scrollBehavior = 'auto'; document.activeElement?.blur(); window.scrollTo(0, 0)")
    page.wait_for_timeout(500)
    page.screenshot(path=str(SCREENSHOT), full_page=False)

    assert_equal(console_errors, [], "JavaScript-fel i konsolen")
    context.close()
    return {"answered": 43 - skipped, "skipped": skipped, "screenshot": str(SCREENSHOT)}


def run_standalone_test(browser) -> dict:
    context = browser.new_context(viewport={"width": 1280, "height": 900}, locale="sv-SE")
    page = context.new_page()
    page.set_content(STANDALONE.read_text(encoding="utf-8"), wait_until="load")
    page.wait_for_function("window.__VALKOMPASS_READY__ === true")
    assert_equal(page.evaluate("window.__VALKOMPASS_TEST__.dataErrors"), [], "Fristående filens dataspärr")
    assert_true(page.locator(".hero").count() == 1, "Fristående fil ska visa startsidan")
    context.close()

    mobile = browser.new_context(viewport={"width": 390, "height": 844}, locale="sv-SE")
    mobile_page = mobile.new_page()
    mobile_page.set_content(STANDALONE.read_text(encoding="utf-8"), wait_until="load")
    mobile_page.wait_for_function("window.__VALKOMPASS_READY__ === true")
    overflow = mobile_page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
    assert_true(overflow <= 1, f"Mobilvyn har horisontell overflow på {overflow}px")
    mobile_page.locator("#start-compass").click()
    mobile_page.wait_for_selector(".question-card")
    overflow_question = mobile_page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
    assert_true(overflow_question <= 1, f"Mobil frågevy har horisontell overflow på {overflow_question}px")
    mobile.close()
    return {"file": str(STANDALONE), "mobileOverflow": overflow}


def run_guard_test(browser) -> dict:
    context = browser.new_context(viewport={"width": 1100, "height": 800}, locale="sv-SE")
    page = context.new_page()
    html = STANDALONE.read_text(encoding="utf-8")
    needle = '"party":"s","question":"q001","position":-1'
    replacement = '"party":"s","question":"q001","position":null'
    bad_html = html.replace(needle, replacement, 1)
    assert_true(bad_html != html, "Testet kunde inte manipulera den inbäddade kärnpositionen")
    page.set_content(bad_html, wait_until="load")
    page.wait_for_function("window.__VALKOMPASS_READY__ === true")
    errors = page.evaluate("window.__VALKOMPASS_TEST__.dataErrors")
    assert_true(len(errors) >= 1, "Dataspärren ska hitta en manipulerad kärnposition")
    assert_true(page.locator("text=Resultatberäkningen har stoppats").count() == 1, "Dataspärrens stoppsida visas inte")
    context.close()
    return {"detectedErrors": len(errors), "firstError": errors[0]}


def main() -> int:
    if not STANDALONE.exists():
        raise SystemExit(f"Saknar fristående fil: {STANDALONE}")

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            executable_path=CHROMIUM,
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--allow-file-access-from-files",
                "--disable-web-security",
            ],
        )
        try:
            modular = run_app_flow_test(browser)
            standalone = run_standalone_test(browser)
            guard = run_guard_test(browser)
        finally:
            browser.close()

    report = {"appFlow": modular, "standalone": standalone, "guard": guard}
    print("WEBBLÄSARTEST: GODKÄNT")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
