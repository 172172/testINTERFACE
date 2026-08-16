#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";

const root = resolve(new URL("..", import.meta.url).pathname);
const output = resolve(root, "valkompass-2026-standalone.html");

const readText = (name) => readFile(resolve(root, name), "utf8");
const readJson = async (name) => JSON.parse(await readText(name));
const escapeScriptEnd = (text) => text.replaceAll("</script", "<\\/script");
const escapeStyleEnd = (text) => text.replaceAll("</style", "<\\/style");

const [html, css, scoringSource, appSource, questions, parties, positions, meta, sources] = await Promise.all([
  readText("index.html"),
  readText("styles.css"),
  readText("scoring.js"),
  readText("app.js"),
  readJson("data/questions.json"),
  readJson("data/parties.json"),
  readJson("data/positions.json"),
  readJson("data/meta.json"),
  readJson("data/source-register.json"),
]);

const scoring = scoringSource.replaceAll(/\bexport\s+(?=function|const|class)/g, "");
const app = appSource.replace(
  /^import\s*\{[\s\S]*?\}\s*from\s*["']\.\/scoring\.js["'];\s*/,
  "",
);
if (app === appSource) {
  throw new Error("Kunde inte ta bort scoring-importen ur app.js. Bygget avbröts.");
}

const embedded = JSON.stringify({ questions, parties, positions, meta, sources })
  .replaceAll("<", "\\u003c")
  .replaceAll("\u2028", "\\u2028")
  .replaceAll("\u2029", "\\u2029");

let standalone = html.replace(
  '<link rel="stylesheet" href="styles.css">',
  `<style>\n${escapeStyleEnd(css)}\n</style>`,
);
standalone = standalone.replace(
  '<script type="module" src="app.js"></script>',
  `<script>window.__VALKOMPASS_DATA__=${embedded};</script>\n<script>\n(async () => {\n${escapeScriptEnd(scoring)}\n\n${escapeScriptEnd(app)}\n})().catch((error) => console.error(error));\n</script>`,
);
standalone = standalone.replace(
  "En öppen, källgranskad och reproducerbar svensk valkompass inför riksdagsvalet 2026.",
  "En fristående, öppen och reproducerbar svensk valkompass inför riksdagsvalet 2026.",
);
standalone = `<!-- Genererad fil. Ändra källfilerna och kör npm run build. Dataset ${meta.datasetVersion}, SHA-256 ${meta.dataFingerprintSha256}. -->\n${standalone}`;

await writeFile(output, standalone, "utf8");
console.log(`Byggde ${output}`);
console.log(`Dataset ${meta.datasetVersion} · ${questions.length} frågor · ${positions.length} positionsrader`);
