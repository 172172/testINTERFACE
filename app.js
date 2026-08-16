import {
  buildPositionMap,
  calculateAllPartyScores,
  calculatePartyScore,
} from "./scoring.js";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const round = (value) =>
  value == null || !Number.isFinite(value) ? null : Math.round(value);

const formatPercent = (value) =>
  value == null || !Number.isFinite(value)
    ? "—"
    : `${Math.round(value)} %`;

const formatSigned = (value) =>
  value == null
    ? "Okänd"
    : `${value > 0 ? "+" : ""}${value}`;

const todayIso = () => new Date().toISOString().slice(0, 10);

const ANSWER_LABELS = {
  "-2": "Tar helt avstånd",
  "-1": "Tar delvis avstånd",
  "0": "Neutral / varken eller",
  "1": "Instämmer delvis",
  "2": "Instämmer helt",
};

const SHORT_ANSWER_LABELS = {
  "-2": "Helt emot",
  "-1": "Delvis emot",
  "0": "Neutral",
  "1": "Delvis för",
  "2": "Helt för",
};

const IMPORTANCE_LABELS = {
  0: "Spelar ingen roll",
  1: "Ganska oviktig",
  2: "Viktig",
  3: "Mycket viktig",
  5: "Avgörande fråga",
};

const CONFIDENCE_LABELS = {
  high: "Hög",
  medium: "Medel",
  low: "Låg",
  unknown: "Okänd",
};

async function loadData() {
  if (window.__VALKOMPASS_DATA__) {
    return window.__VALKOMPASS_DATA__;
  }

  const names = [
    "questions",
    "parties",
    "positions",
    "meta",
    "source-register",
  ];

  const loaded = await Promise.all(
    names.map(async (name) => {
      const response = await fetch(`data/${name}.json`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(
          `Kunde inte läsa data/${name}.json (${response.status}).`
        );
      }

      return response.json();
    })
  );

  return {
    questions: loaded[0],
    parties: loaded[1],
    positions: loaded[2],
    meta: loaded[3],
    sources: loaded[4],
  };
}

let DATA;

try {
  DATA = await loadData();
} catch (error) {
  document.querySelector("#app").innerHTML = `
    <section class="page narrow">
      <div class="callout danger">
        <h1>Webbappen kunde inte läsa sina datafiler</h1>
        <p>${escapeHtml(error.message)}</p>
        <p>
          Den modulära versionen måste köras från en webbserver.
          Öppna i stället filen
          <code>valkompass-2026-standalone.html</code>,
          som fungerar direkt genom dubbelklick.
        </p>
      </div>
    </section>
  `;

  throw error;
}

const {
  questions,
  parties,
  positions,
  meta,
  sources,
} = DATA;

const activeQuestions = questions
  .filter((q) => q.status === "active" && q.score === true)
  .sort((a, b) => a.order - b.order);

const researchQuestions = questions
  .filter((q) => q.status === "research" || q.score === false)
  .sort((a, b) => a.order - b.order);

const partyMap = Object.fromEntries(
  parties.map((party) => [party.id, party])
);

const questionMap = Object.fromEntries(
  questions.map((question) => [question.id, question])
);

const positionMap = buildPositionMap(positions);

const sourceMap = Object.fromEntries(
  sources.map((source) => [source.id, source])
);

const areaOrder = Object.keys(meta.activeAreaCounts || {});

const STORAGE_KEY =
  `oppen-valkompass-${meta.datasetVersion}-` +
  `${meta.dataFingerprintSha256.slice(0, 16)}`;

function validateRuntimeData() {
  const errors = [];

  const allowedPositions = new Set([
    -2,
    -1,
    0,
    1,
    2,
    null,
  ]);

  const questionIds = questions.map((q) => q.id);
  const partyIds = parties.map((p) => p.id);

  const sourceIds = new Set(
    sources.map((source) => source.id)
  );

  const coreParties = parties.filter(
    (party) => party.comparisonGroup === "core"
  );

  const provisionalParties = parties.filter(
    (party) => party.comparisonGroup === "provisional"
  );

  const activeIds = new Set(
    activeQuestions.map((q) => q.id)
  );

  const researchIds = new Set(
    researchQuestions.map((q) => q.id)
  );

  const seenRows = new Set();

  if (questionIds.length !== new Set(questionIds).size) {
    errors.push("Fråge-ID:n är inte unika.");
  }

  if (partyIds.length !== new Set(partyIds).size) {
    errors.push("Parti-ID:n är inte unika.");
  }

  if (sourceIds.size !== sources.length) {
    errors.push("Käll-ID:n är inte unika.");
  }

  if (questions.length !== meta.totalQuestionCount) {
    errors.push(
      "Antalet frågor stämmer inte med meta.json."
    );
  }

  if (activeQuestions.length !== meta.activeQuestionCount) {
    errors.push(
      "Antalet aktiva frågor stämmer inte med meta.json."
    );
  }

  if (researchQuestions.length !== meta.researchQuestionCount) {
    errors.push(
      "Antalet forskningsfrågor stämmer inte med meta.json."
    );
  }

  if (coreParties.length !== meta.corePartyIds.length) {
    errors.push(
      "Antalet jämförbara partier stämmer inte med meta.json."
    );
  }

  if (
    provisionalParties.length !==
    meta.provisionalPartyIds.length
  ) {
    errors.push(
      "Antalet preliminära partier stämmer inte med meta.json."
    );
  }

  if (
    positions.length !==
    questions.length * parties.length
  ) {
    errors.push(
      "Positionsmatrisen har fel antal rader."
    );
  }

  for (const question of activeQuestions) {
    if (
      question.score !== true ||
      !question.sourceReference ||
      !Number.isInteger(question.sourceQuestionOrdinal)
    ) {
      errors.push(
        `Den aktiva frågan ${question.id} saknar poäng- eller källmetadata.`
      );
    }
  }

  for (const question of researchQuestions) {
    if (question.score !== false) {
      errors.push(
        `Forskningsfrågan ${question.id} är felaktigt aktiverad.`
      );
    }
  }

  /*
    Kontroll av antal frågor per politikområde.

    VIKTIGT:
    Det finns ingen maxgräns här.

    Ett område får alltså ha exempelvis:
    Klimat och miljö = 10 frågor

    Balansen hanteras i scoring.js genom
    områdesnormalisering, inte genom att
    förbjuda fler frågor i ett område.
  */
  const areaCounts = new Map();

  for (const question of activeQuestions) {
    areaCounts.set(
      question.area,
      (areaCounts.get(question.area) || 0) + 1
    );
  }

  for (const [area, count] of areaCounts) {
    if (count < 2) {
      errors.push(
        `Området ${area} har ${count} aktiva frågor; minst 2 krävs.`
      );
    }

    if (meta.activeAreaCounts?.[area] !== count) {
      errors.push(
        `Området ${area} har ${count} aktiva frågor men ` +
        `meta.json anger ` +
        `${meta.activeAreaCounts?.[area] ?? "saknas"}.`
      );
    }
  }

  for (const row of positions) {
    const key = `${row.party}:${row.question}`;

    if (seenRows.has(key)) {
      errors.push(`Dubbel positionsrad: ${key}.`);
    }

    seenRows.add(key);

    if (!partyMap[row.party]) {
      errors.push(
        `Okänt parti i positionsrad: ${row.party}.`
      );
    }

    if (!questionMap[row.question]) {
      errors.push(
        `Okänd fråga i positionsrad: ${row.question}.`
      );
    }

    if (!allowedPositions.has(row.position)) {
      errors.push(
        `Ogiltig position i ${key}.`
      );
    }

    if (
      row.sourceId &&
      !sourceIds.has(row.sourceId)
    ) {
      errors.push(
        `Okänt käll-ID i ${key}.`
      );
    }

    if (
      row.position != null &&
      (
        !row.source ||
        !row.sourceId ||
        !row.verified ||
        !row.rationale ||
        row.codingStatus !== "verified"
      )
    ) {
      errors.push(
        `Känd position saknar obligatoriskt bevis i ${key}.`
      );
    }

    if (
      researchIds.has(row.question) &&
      row.position != null
    ) {
      errors.push(
        `Forskningsfrågan ${row.question} har en aktiv position.`
      );
    }
  }

  for (const party of coreParties) {
    for (const question of activeQuestions) {
      const row = positionMap.get(
        `${party.id}:${question.id}`
      );

      if (
        !row ||
        row.position == null ||
        row.codingStatus !== "verified" ||
        !row.source
      ) {
        errors.push(
          `Kärnmatrisen saknar verifierad position för ` +
          `${party.short}/${question.id}.`
        );
      }
    }
  }

  const verifiedCore = positions.filter(
    (row) =>
      activeIds.has(row.question) &&
      meta.corePartyIds.includes(row.party) &&
      row.position != null &&
      row.codingStatus === "verified"
  ).length;

  if (
    verifiedCore !== meta.readiness.coreMatrixRequired ||
    verifiedCore !== meta.readiness.coreMatrixVerified
  ) {
    errors.push(
      `Kärnmatrisens status är inkonsekvent ` +
      `(${verifiedCore}/${meta.readiness.coreMatrixRequired}).`
    );
  }

  return [...new Set(errors)];
}

const DATA_ERRORS = validateRuntimeData();

function emptyState() {
  return {
    version: meta.datasetVersion,
    index: 0,
    answers: {},
    completed: false,
    startedAt: null,
    completedAt: null,
    audit: {
      tab: "positions",
      party: "all",
      area: "all",
      status: "active",
      query: "",
    },
  };
}

function loadState() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(STORAGE_KEY)
    );

    if (saved?.version === meta.datasetVersion) {
      return {
        ...emptyState(),
        ...saved,
      };
    }
  } catch (_) {
    // Felaktig lokal data ignoreras.
  }

  return emptyState();
}

let state = loadState();

function saveState() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(state)
    );
  } catch (_) {
    // Kompassen fungerar även om lagring blockeras.
  }
}

function resetCompass() {
  state = {
    ...emptyState(),
    audit: state.audit || emptyState().audit,
  };

  saveState();
}

function answeredEntries() {
  return activeQuestions.filter((q) => {
    const answer = state.answers[q.id];

    return (
      answer &&
      !answer.skipped &&
      Number.isFinite(answer.value)
    );
  });
}

function handledCount() {
  return activeQuestions.filter(
    (q) => state.answers[q.id]
  ).length;
}

function skippedCount() {
  return activeQuestions.filter(
    (q) => state.answers[q.id]?.skipped
  ).length;
}

function isComplete() {
  return handledCount() === activeQuestions.length;
}

function answerLabel(value) {
  return (
    ANSWER_LABELS[String(value)] ??
    "Okänd"
  );
}

function positionBadge(row) {
  if (!row || row.position == null) {
    return `<span class="status unknown">Okänd</span>`;
  }

  const className =
    row.position < 0
      ? `n${Math.abs(row.position)}`
      : `p${row.position}`;

  return `
    <span class="status position p-${className}">
      ${escapeHtml(formatSigned(row.position))}
      ·
      ${escapeHtml(
        SHORT_ANSWER_LABELS[String(row.position)]
      )}
    </span>
  `;
}

function setDocumentTitle(title) {
  document.title = title
    ? `${title} – ${
        meta.title || "Öppen Valkompass 2026"
      }`
    : (
        meta.title ||
        "Öppen Valkompass 2026"
      );
}

function setBuildMeta() {
  const element = $("#build-meta");

  if (!element) return;

  element.textContent = DATA_ERRORS.length
    ? `Dataset ${meta.datasetVersion} · ` +
      `dataspärr aktiverad · ` +
      `${DATA_ERRORS.length} fel`
    : `Dataset ${meta.datasetVersion} · ` +
      `verifierat ${meta.verifiedThrough} · ` +
      `${meta.dataFingerprintSha256.slice(0, 12)}…`;
}

function routeParts() {
  return (
    location.hash ||
    "#/home"
  )
    .replace(/^#\/?/, "")
    .split("/")
    .filter(Boolean);
}

function navigate(hash) {
  if (location.hash === hash) {
    renderRoute();
  } else {
    location.hash = hash;
  }
}

function renderDataFailure() {
  setDocumentTitle("Dataspärr");

  $("#app").innerHTML = `
    <section class="page narrow">
      <div class="eyebrow danger-text">
        Dataspärr aktiverad
      </div>

      <h1>Resultatberäkningen har stoppats</h1>

      <p class="lead">
        Webbappen hittade fel i den jämförbara
        positionsmatrisen. Den visar därför ingen
        ranking i stället för att gissa, ignorera
        luckor eller låta partier försvinna ur
        resultatet.
      </p>

      <div class="callout danger">
        <strong>Upptäckta fel</strong>
        <ul>
          ${DATA_ERRORS
            .map(
              (error) =>
                `<li>${escapeHtml(error)}</li>`
            )
            .join("")}
        </ul>
      </div>

      <div class="actions">
        <a
          class="button primary"
          href="#/audit/integrity"
        >
          Öppna dataintegriteten
        </a>

        <a
          class="button secondary"
          href="#/audit/positions"
        >
          Granska positionerna
        </a>
      </div>
    </section>
  `;
}

function updateNavigation(route) {
  $$(".topbar nav a").forEach((link) => {
    const destination = (
      link.getAttribute("href") || ""
    )
      .replace(/^#\//, "")
      .split("/")[0];

    if (
      destination === route ||
      (
        route === "party" &&
        destination === "results"
      )
    ) {
      link.setAttribute(
        "aria-current",
        "page"
      );
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

function renderRoute() {
  const [
    route = "home",
    parameter,
  ] = routeParts();

  $("#app").classList.remove("loading");

  if (
    DATA_ERRORS.length &&
    !["audit", "method"].includes(route)
  ) {
    renderDataFailure();
  } else if (route === "compass") {
    renderCompass();
  } else if (route === "results") {
    renderResults();
  } else if (route === "party") {
    renderParty(parameter);
  } else if (route === "audit") {
    renderAudit(
      parameter ||
      state.audit.tab ||
      "positions"
    );
  } else if (route === "method") {
    renderMethod();
  } else {
    renderHome();
  }

  updateNavigation(route);
  setBuildMeta();

  window.scrollTo({
    top: 0,
    behavior: "auto",
  });
}

window.addEventListener(
  "hashchange",
  renderRoute
);

function renderHome() {
  setDocumentTitle("");

  const progress = handledCount();

  const hasProgress =
    progress > 0 &&
    !state.completed;

  const knownCore =
    meta.readiness?.coreMatrixVerified ??
    344;

  const coreRequired =
    meta.readiness?.coreMatrixRequired ??
    344;

  $("#app").innerHTML = `
    <section class="hero page">
      <div class="eyebrow">
        Riksdagsvalet ${escapeHtml(meta.electionDate)}
      </div>

      <div class="hero-grid">
        <div>
          <h1>
            Du behöver inte lita på kompassen.
            <br>
            Du kan kontrollera den.
          </h1>

          <p class="lead">
            En fristående svensk valkompass
            med öppna data, mekanisk
            poängberäkning och en synlig
            källa bakom varje position som
            används.
          </p>

          <div class="actions">
            <button
              class="button primary"
              id="start-compass"
            >
              ${
                hasProgress
                  ? `Fortsätt från fråga ${
                      clamp(
                        state.index + 1,
                        1,
                        activeQuestions.length
                      )
                    }`
                  : "Starta valkompassen"
              }
            </button>

            <a
              class="button secondary"
              href="#/audit/positions"
            >
              Granska alla positioner
            </a>
          </div>

          ${
            hasProgress
              ? `
                <button
                  class="text-button"
                  id="restart-compass"
                >
                  Börja om och radera sparade svar
                </button>
              `
              : ""
          }
        </div>

        <aside class="hero-status card">
          <div class="status-line">
            <strong>
              ${activeQuestions.length}
            </strong>
            <span>
              frågor i verifierad kärna
            </span>
          </div>

          <div class="status-line">
            <strong>
              ${knownCore}/${coreRequired}
            </strong>
            <span>
              källkodade kärnpositioner
            </span>
          </div>
        </aside>
      </div>
    </section>

    <section class="page section-space">
      <div class="grid three">
        <article class="card feature">
          <span class="feature-number">
            01
          </span>

          <h2>
            Samma underlag för åtta partier
          </h2>

          <p>
            Den verifierade kärnan använder
            partiernas egna svar på samma
            nationella frågor och de
            kompletterande miljöfrågorna
            använder källkodade positioner
            enligt samma öppna metod.
          </p>
        </article>

        <article class="card feature">
          <span class="feature-number">
            02
          </span>

          <h2>
            Okänd är inte neutral
          </h2>

          <p>
            När en exakt position saknas
            används <code>null</code>.
            Den blir aldrig automatiskt
            0 och får därför inte låtsas
            vara en mittenposition.
          </p>
        </article>

        <article class="card feature">
          <span class="feature-number">
            03
          </span>

          <h2>
            Områden balanseras
          </h2>

          <p>
            Varje politikområde väger lika
            i totalmatchningen. Din egen
            viktning styr prioritetsmatchningen
            utan att ett område får större
            vikt bara för att det innehåller
            fler frågor.
          </p>
        </article>
      </div>
    </section>

    <section class="page section-space split">
      <article>
        <div class="eyebrow">
          Publiceringsprincip
        </div>

        <h2>
          Hellre kontrollerade frågor
          än påhittade svar
        </h2>

        <p>
          Projektet innehåller totalt
          ${questions.length}
          preciserade frågor.
          ${activeQuestions.length}
          används just nu i matchningen.
          De övriga
          ${researchQuestions.length}
          är synliga i granskningsläget
          men påverkar ingen poäng förrän
          samma beviskrav är uppfyllt.
        </p>
      </article>

      <aside class="callout warning">
        <strong>
          Örebropartiet behandlas
          med samma beviskrav.
        </strong>

        <p>
          Partiets nationella 2026-program
          publiceras successivt.
          Därför visas ÖP separat med
          källtäckning och ett möjligt
          matchningsintervall.
        </p>
      </aside>
    </section>
  `;

  $("#start-compass").onclick = () => {
    if (!state.startedAt) {
      state.startedAt =
        new Date().toISOString();
    }

    saveState();
    navigate("#/compass");
  };

  if ($("#restart-compass")) {
    $("#restart-compass").onclick = () => {
      if (
        confirm(
          "Radera alla sparade svar och börja om?"
        )
      ) {
        resetCompass();
        renderHome();
      }
    };
  }
}

function renderCompass(message = "") {
  setDocumentTitle("Valkompassen");

  state.index = clamp(
    state.index,
    0,
    activeQuestions.length - 1
  );

  const question =
    activeQuestions[state.index];

  const saved =
    state.answers[question.id] ||
    null;

  const currentValue =
    saved?.skipped
      ? null
      : saved?.value;

  const currentImportance =
    saved &&
    !saved.skipped
      ? saved.importance
      : 2;

  const progress =
    (
      (state.index + 1) /
      activeQuestions.length
    ) * 100;

  const handled =
    handledCount();

  $("#app").innerHTML = `
    <section class="page compass-page">
      <div class="question-topline">
        <div>
          <span class="eyebrow">
            ${escapeHtml(question.area)}
          </span>

          <h1 class="question-count">
            Fråga
            ${state.index + 1}
            av
            ${activeQuestions.length}
          </h1>
        </div>

        <div class="progress-stats">
          <strong>${handled}</strong>
          hanterade
          ·
          <strong>
            ${skippedCount()}
          </strong>
          hoppade över
        </div>
      </div>

      <div
        class="progress"
        aria-label="Framsteg"
      >
        <span
          style="width:${progress}%"
        ></span>
      </div>

      <article class="question-card card">
        <h2>
          ${escapeHtml(question.text)}
        </h2>

        <div class="scope-box">
          <strong>
            Exakt avgränsning
          </strong>

          <p>
            ${escapeHtml(question.scope)}
          </p>
        </div>

        <fieldset class="answer-fieldset">
          <legend>
            Vad tycker du?
          </legend>

          <div class="answer-options">
            ${[-2, -1, 0, 1, 2]
              .map(
                (value) => `
                  <button
                    type="button"
                    class="choice ${
                      currentValue === value
                        ? "selected"
                        : ""
                    }"
                    data-answer="${value}"
                    aria-pressed="${
                      currentValue === value
                    }"
                  >
                    <span class="choice-value">
                      ${value > 0 ? "+" : ""}
                      ${value}
                    </span>

                    <span>
                      ${escapeHtml(
                        ANSWER_LABELS[
                          String(value)
                        ]
                      )}
                    </span>
                  </button>
                `
              )
              .join("")}
          </div>

          <p class="microcopy">
            <strong>Neutral</strong>
            är ett politiskt svar.
            <strong>Hoppa över</strong>
            betyder att frågan inte ska
            räknas alls.
          </p>
        </fieldset>

        <fieldset
          class="importance-fieldset ${
            saved?.skipped
              ? "disabled"
              : ""
          }"
        >
          <legend>
            Hur viktig är frågan för dig?
          </legend>

          <div class="importance-options">
            ${meta.scoring.importanceScale
              .map(
                (value) => `
                  <button
                    type="button"
                    class="importance-choice ${
                      currentImportance === value &&
                      !saved?.skipped
                        ? "selected"
                        : ""
                    }"
                    data-importance="${value}"
                    aria-pressed="${
                      currentImportance === value &&
                      !saved?.skipped
                    }"
                    ${
                      saved?.skipped
                        ? "disabled"
                        : ""
                    }
                  >
                    <strong>
                      ${value}
                    </strong>

                    <span>
                      ${escapeHtml(
                        IMPORTANCE_LABELS[value]
                      )}
                    </span>
                  </button>
                `
              )
              .join("")}
          </div>
        </fieldset>

        ${
          message
            ? `
              <div
                class="inline-message"
                role="alert"
              >
                ${escapeHtml(message)}
              </div>
            `
            : ""
        }
      </article>

      <div class="question-actions">
        <button
          class="button secondary"
          id="previous-question"
          ${
            state.index === 0
              ? "disabled"
              : ""
          }
        >
          Föregående
        </button>

        <button
          class="button ghost"
          id="skip-question"
        >
          ${
            saved?.skipped
              ? "Överhoppad"
              : "Hoppa över"
          }
        </button>

        <button
          class="button primary"
          id="next-question"
        >
          ${
            state.index ===
            activeQuestions.length - 1
              ? "Visa resultat"
              : "Nästa fråga"
          }
        </button>
      </div>
    </section>
  `;

  $$("[data-answer]").forEach(
    (button) => {
      button.onclick = () => {
        state.answers[question.id] = {
          value: Number(
            button.dataset.answer
          ),
          importance:
            saved &&
            !saved.skipped
              ? saved.importance
              : 2,
          skipped: false,
        };

        saveState();
        renderCompass();
      };
    }
  );

  $$("[data-importance]").forEach(
    (button) => {
      button.onclick = () => {
        const existing =
          state.answers[question.id];

        if (
          !existing ||
          existing.skipped ||
          !Number.isFinite(
            existing.value
          )
        ) {
          renderCompass(
            "Välj först vad du tycker, därefter hur viktig frågan är."
          );
          return;
        }

        existing.importance =
          Number(
            button.dataset.importance
          );

        saveState();
        renderCompass();
      };
    }
  );

  $("#skip-question").onclick = () => {
    state.answers[question.id] = {
      value: null,
      importance: 0,
      skipped: true,
    };

    saveState();
    renderCompass();
  };

  $("#previous-question").onclick = () => {
    if (state.index > 0) {
      state.index -= 1;
      saveState();
      renderCompass();
    }
  };

  $("#next-question").onclick = () => {
    if (!state.answers[question.id]) {
      renderCompass(
        "Välj ett svar eller använd ”Hoppa över” innan du fortsätter."
      );
      return;
    }

    if (
      state.index <
      activeQuestions.length - 1
    ) {
      state.index += 1;
      saveState();
      renderCompass();
      return;
    }

    state.completed =
      isComplete();

    state.completedAt =
      new Date().toISOString();

    saveState();
    navigate("#/results");
  };
}

function getScores() {
  if (DATA_ERRORS.length) {
    throw new Error(
      "Dataspärren hindrar resultatberäkning."
    );
  }

  return calculateAllPartyScores({
    parties,
    questions: activeQuestions,
    answers: state.answers,
    positions,
    minimumAnswered:
      meta.minimumAnsweredForResult,
  });
}

function resultMetric(score) {
  return (
    score.priority ??
    score.total ??
    -1
  );
}

function resultRow(result, rank) {
  return `
    <article class="result-row card">
      <div
        class="rank"
        aria-label="Placering ${rank}"
      >
        ${rank}
      </div>

      <div class="result-party">
        <h3>
          ${escapeHtml(result.party.name)}
        </h3>

        <span class="muted">
          ${result.knownQuestionCount}/${
            result.answeredQuestionCount
          }
          jämförbara svar
        </span>
      </div>

      <div class="result-metrics">
        <div>
          <span>
            Prioritetsmatchning
          </span>

          <strong>
            ${formatPercent(
              result.priority
            )}
          </strong>
        </div>

        <div class="meter">
          <span
            style="width:${
              clamp(
                result.priority ?? 0,
                0,
                100
              )
            }%"
          ></span>
        </div>

        <small>
          Total, områdesbalanserad:
          ${formatPercent(result.total)}
        </small>
      </div>

      <a
        class="button small secondary"
        href="#/party/${result.party.id}"
      >
        Se varför
      </a>
    </article>
  `;
}

function renderResults() {
  setDocumentTitle("Resultat");

  if (!isComplete()) {
    state.index =
      activeQuestions.findIndex(
        (q) => !state.answers[q.id]
      );

    if (state.index < 0) {
      state.index = 0;
    }

    saveState();
    navigate("#/compass");
    return;
  }

  const answered =
    answeredEntries().length;

  const allScores =
    getScores();

  const coreResults =
    allScores
      .filter(
        (result) =>
          result.party.comparisonGroup ===
            "core" &&
          result.eligibleForRanking
      )
      .sort(
        (a, b) =>
          resultMetric(b) -
            resultMetric(a) ||
          a.party.sortOrder -
            b.party.sortOrder
      );

  const provisional =
    allScores.find(
      (result) =>
        result.party.id === "op"
    );

  if (
    answered <
    meta.minimumAnsweredForResult
  ) {
    $("#app").innerHTML = `
      <section class="page narrow">
        <div class="callout danger">
          <h1>
            För få frågor är besvarade
          </h1>

          <p>
            Du har besvarat
            ${answered}
            frågor. Minst
            ${meta.minimumAnsweredForResult}
            behövs för att visa ett
            meningsfullt resultat.
            Överhoppade frågor räknas inte.
          </p>

          <button
            class="button primary"
            id="return-to-compass"
          >
            Gå tillbaka till frågorna
          </button>
        </div>
      </section>
    `;

    $("#return-to-compass").onclick =
      () => {
        const firstSkipped =
          activeQuestions.findIndex(
            (q) =>
              state.answers[
                q.id
              ]?.skipped
          );

        state.index =
          firstSkipped >= 0
            ? firstSkipped
            : 0;

        saveState();
        navigate("#/compass");
      };

    return;
  }

  const top =
    coreResults[0];

  $("#app").innerHTML = `
    <section class="page results-page">
      <div class="eyebrow">
        Ditt resultat ·
        ${answered}
        besvarade frågor
      </div>

      <div class="results-heading">
        <div>
          <h1>
            Din högsta matchning är
            ${
              top
                ? escapeHtml(
                    top.party.name
                  )
                : "inte beräkningsbar"
            }
          </h1>

          <p class="lead">
            Det här är en matematisk
            likhetsmätning, inte en
            rekommendation. Öppna varje
            parti för att se exakt vilka
            frågor, vikter och källor
            som skapade resultatet.
          </p>
        </div>

        ${
          top
            ? `
              <div class="top-score card">
                <span>
                  Prioritetsmatchning
                </span>

                <strong>
                  ${formatPercent(
                    top.priority
                  )}
                </strong>

                <small>
                  Total
                  ${formatPercent(
                    top.total
                  )}
                </small>
              </div>
            `
            : ""
        }
      </div>

      <div class="callout info compact">
        <strong>
          Jämförbar huvudranking:
        </strong>
        alla åtta partier nedan har
        positioner på exakt samma
        besvarade frågor.
      </div>

      <div class="results-list">
        ${coreResults
          .map(
            (result, index) =>
              resultRow(
                result,
                index + 1
              )
          )
          .join("")}
      </div>

      <section
        class="provisional-section section-space"
      >
        <div class="section-heading">
          <div>
            <div class="eyebrow">
              Separat, ofullständigt underlag
            </div>

            <h2>
              Örebropartiet
            </h2>
          </div>

          <a
            class="button small secondary"
            href="#/party/op"
          >
            Granska ÖP-underlaget
          </a>
        </div>

        <article
          class="card provisional-result"
        >
          <div>
            <strong>
              ${
                provisional?.knownQuestionCount ??
                0
              }
              av
              ${
                provisional?.answeredQuestionCount ??
                0
              }
            </strong>

            <span>
              av dina besvarade frågor
              har en verifierad ÖP-position
            </span>
          </div>

          <div>
            <strong>
              ${formatPercent(
                provisional?.priority
              )}
            </strong>

            <span>
              observerad matchning på
              den kända delmängden
            </span>
          </div>

          <div>
            <strong>
              ${formatPercent(
                provisional?.priorityLower
              )}
              –
              ${formatPercent(
                provisional?.priorityUpper
              )}
            </strong>

            <span>
              möjligt intervall
            </span>
          </div>
        </article>
      </section>

      <div class="actions section-space">
        <button
          class="button secondary"
          id="download-result"
        >
          Exportera mitt resultat som JSON
        </button>

        <button
          class="button ghost"
          id="edit-answers"
        >
          Ändra svar
        </button>

        <button
          class="button ghost danger-text"
          id="reset-results"
        >
          Radera och börja om
        </button>
      </div>
    </section>
  `;

  $("#download-result").onclick =
    () => exportUserResult(allScores);

  $("#edit-answers").onclick =
    () => {
      state.index = 0;
      saveState();
      navigate("#/compass");
    };

  $("#reset-results").onclick =
    () => {
      if (
        confirm(
          "Radera alla svar och börja om?"
        )
      ) {
        resetCompass();
        navigate("#/home");
      }
    };
}

function comparisonClass(distance) {
  if (distance == null) {
    return "unknown";
  }

  if (distance === 0) {
    return "same";
  }

  if (distance === 1) {
    return "close";
  }

  return "different";
}

function comparisonLabel(distance) {
  if (distance == null) {
    return "Okänd partiposition";
  }

  if (distance === 0) {
    return "Samma svar";
  }

  if (distance === 1) {
    return "Närliggande svar";
  }

  if (distance === 2) {
    return "Tydlig skillnad";
  }

  return "Motsatt svar";
}

function sourceDetails(
  row,
  party,
  question
) {
  if (
    !row ||
    row.position == null
  ) {
    return `
      <div class="source-panel unknown-source">
        <strong>
          Ingen position används
        </strong>

        <p>
          ${escapeHtml(
            row?.rationale ||
            "Tillräckligt exakt underlag saknas."
          )}
        </p>

        ${
          row?.source
            ? `
              <a
                href="${escapeHtml(
                  row.source
                )}"
                target="_blank"
                rel="noopener noreferrer"
              >
                Se materialet ↗
              </a>
            `
            : ""
        }
      </div>
    `;
  }

  const typeLabel =
    row.evidenceType ===
    "party-self-report-established-compass"
      ? "Partiets eget kompassvar"
      : "Officiellt partimaterial";

  return `
    <div class="source-panel">
      <div class="source-meta">
        <span>
          ${escapeHtml(typeLabel)}
        </span>

        <span>
          Verifierad
          ${escapeHtml(row.verified)}
        </span>

        <span>
          Säkerhet:
          ${escapeHtml(
            CONFIDENCE_LABELS[
              row.confidence
            ] ||
            row.confidence
          )}
        </span>
      </div>

      ${
        question?.sourcePrompt &&
        row.evidenceType ===
          "party-self-report-established-compass"
          ? `
            <p>
              <strong>
                Källans exakta fråga:
              </strong>
              ${escapeHtml(
                question.sourcePrompt
              )}
            </p>
          `
          : ""
      }

      ${
        question?.sourceQuestionOrdinal &&
        row.evidenceType ===
          "party-self-report-established-compass"
          ? `
            <p>
              <strong>
                Källfråga:
              </strong>
              nummer
              ${question.sourceQuestionOrdinal}
            </p>
          `
          : ""
      }

      ${
        row.sourceAnswer
          ? `
            <p>
              <strong>
                Källans svar/linje:
              </strong>
              ${escapeHtml(
                row.sourceAnswer
              )}
            </p>
          `
          : ""
      }

      <p>
        ${escapeHtml(row.rationale)}
      </p>

      <a
        href="${escapeHtml(row.source)}"
        target="_blank"
        rel="noopener noreferrer"
      >
        Visa källa:
        ${escapeHtml(
          row.sourceTitle ||
          party.name
        )}
        ↗
      </a>
    </div>
  `;
}

function comparisonCard(
  comparison,
  party
) {
  const row =
    comparison.position;

  const status =
    comparisonClass(
      comparison.distance
    );

  return `
    <details
      class="comparison-card ${status}"
    >
      <summary>
        <span class="comparison-status">
          ${escapeHtml(
            comparisonLabel(
              comparison.distance
            )
          )}
        </span>

        <span class="comparison-question">
          ${escapeHtml(
            comparison.question.text
          )}
        </span>

        <span class="comparison-score">
          ${
            comparison.similarity == null
              ? "—"
              : `${round(
                  comparison.similarity
                )} %`
          }
        </span>
      </summary>

      <div class="comparison-body">
        <div class="comparison-grid">
          <div>
            <span>Du</span>

            <strong>
              ${escapeHtml(
                answerLabel(
                  comparison.answer.value
                )
              )}
            </strong>

            <small>
              Vikt
              ${
                comparison.answer.importance
              }
              ·
              ${escapeHtml(
                IMPORTANCE_LABELS[
                  comparison.answer.importance
                ]
              )}
            </small>
          </div>

          <div>
            <span>
              ${escapeHtml(party.short)}
            </span>

            <strong>
              ${
                row?.position == null
                  ? "Okänd"
                  : escapeHtml(
                      answerLabel(
                        row.position
                      )
                    )
              }
            </strong>

            <small>
              ${
                row?.position == null
                  ? "Räknas inte"
                  : `Kod ${formatSigned(
                      row.position
                    )}`
              }
            </small>
          </div>
        </div>

        <p class="scope-inline">
          <strong>
            Avgränsning:
          </strong>

          ${escapeHtml(
            comparison.question.scope
          )}
        </p>

        ${sourceDetails(
          row,
          party,
          comparison.question
        )}
      </div>
    </details>
  `;
}

function renderParty(partyId) {
  const party =
    partyMap[partyId];

  if (!party) {
    navigate("#/results");
    return;
  }

  setDocumentTitle(
    party.name
  );

  const score =
    calculatePartyScore({
      partyId,
      questions: activeQuestions,
      answers: state.answers,
      positionMap,
      minimumAnswered:
        meta.minimumAnsweredForResult,
    });

  const provisional =
    party.comparisonGroup ===
    "provisional";

  const comparisons =
    Object.values(
      score.areaScores
    ).flatMap(
      (area) =>
        area.comparisons
    );

  const orderedComparisons =
    [...comparisons].sort(
      (a, b) => {
        if (
          a.distance == null &&
          b.distance != null
        ) {
          return 1;
        }

        if (
          a.distance != null &&
          b.distance == null
        ) {
          return -1;
        }

        return (
          (b.distance ?? -1) -
            (a.distance ?? -1) ||
          b.answer.importance -
            a.answer.importance
        );
      }
    );

  const areas =
    Object.entries(
      score.areaScores
    ).sort(
      ([a], [b]) => {
        const ai =
          areaOrder.indexOf(a);

        const bi =
          areaOrder.indexOf(b);

        return (
          (
            ai < 0
              ? 999
              : ai
          ) -
            (
              bi < 0
                ? 999
                : bi
            ) ||
          a.localeCompare(
            b,
            "sv"
          )
        );
      }
    );

  $("#app").innerHTML = `
    <section class="page party-page">
      <a
        class="back-link"
        href="#/results"
      >
        ← Tillbaka till resultatet
      </a>

      <div class="party-heading">
        <div>
          <div class="eyebrow">
            ${
              provisional
                ? "Preliminärt källunderlag"
                : "Fullständigt jämförbar kärna"
            }
          </div>

          <h1>
            ${escapeHtml(party.name)}
          </h1>
        </div>

        ${
          provisional
            ? `
              <span class="status unknown">
                Inte rangordnat
              </span>
            `
            : `
              <span class="status verified">
                100 % källtäckning
              </span>
            `
        }
      </div>

      <div
        class="score-cards grid ${
          provisional
            ? "four"
            : "three"
        }"
      >
        <article class="card score-card">
          <span>
            ${
              provisional
                ? "Observerad prioritetsmatchning"
                : "Prioritetsmatchning"
            }
          </span>

          <strong>
            ${formatPercent(
              score.priority
            )}
          </strong>

          <small>
            ${
              provisional
                ? "Endast kända positioner"
                : "Din viktning, områdesbalanserad"
            }
          </small>
        </article>

        <article class="card score-card">
          <span>
            Total matchning
          </span>

          <strong>
            ${formatPercent(
              score.total
            )}
          </strong>

          <small>
            Alla besvarade frågor
          </small>
        </article>

        <article class="card score-card">
          <span>
            Källtäckning
          </span>

          <strong>
            ${formatPercent(
              score.priorityCoverage *
              100
            )}
          </strong>

          <small>
            ${score.knownQuestionCount}/${
              score.answeredQuestionCount
            }
            frågor kända
          </small>
        </article>

        ${
          provisional
            ? `
              <article class="card score-card">
                <span>
                  Möjligt intervall
                </span>

                <strong>
                  ${formatPercent(
                    score.priorityLower
                  )}
                  –
                  ${formatPercent(
                    score.priorityUpper
                  )}
                </strong>

                <small>
                  Okända svar:
                  värsta–bästa fall
                </small>
              </article>
            `
            : ""
        }
      </div>

      <section class="section-space">
        <div class="section-heading">
          <div>
            <div class="eyebrow">
              Områdesanalys
            </div>

            <h2>
              Matchning per politikområde
            </h2>
          </div>
        </div>

        <div class="area-table card">
          ${areas
            .map(
              ([area, areaScore]) => {
                const display =
                  areaScore.priorityObserved ??
                  areaScore.totalObserved;

                return `
                  <div class="area-row">
                    <div>
                      <strong>
                        ${escapeHtml(area)}
                      </strong>

                      <small>
                        ${areaScore.knownCount}/${
                          areaScore.answeredCount
                        }
                        kända positioner
                      </small>
                    </div>

                    <div class="meter">
                      <span
                        style="width:${
                          clamp(
                            display ?? 0,
                            0,
                            100
                          )
                        }%"
                      ></span>
                    </div>

                    <strong>
                      ${formatPercent(
                        display
                      )}
                    </strong>
                  </div>
                `;
              }
            )
            .join("")}
        </div>
      </section>

      <section class="section-space">
        <div class="section-heading">
          <div>
            <div class="eyebrow">
              Fråga för fråga
            </div>

            <h2>
              Se exakt varför
            </h2>
          </div>

          <div class="legend">
            <span class="dot same"></span>
            Samma

            <span class="dot close"></span>
            Nära

            <span class="dot different"></span>
            Olika

            <span class="dot unknown"></span>
            Okänd
          </div>
        </div>

        <div class="comparison-list">
          ${orderedComparisons
            .map(
              (comparison) =>
                comparisonCard(
                  comparison,
                  party
                )
            )
            .join("")}
        </div>
      </section>
    </section>
  `;
}

function auditTabs(activeTab) {
  const tabs = [
    [
      "positions",
      "Partipositioner",
    ],
    [
      "questions",
      `Alla ${questions.length} frågor`,
    ],
    [
      "sources",
      "Källregister",
    ],
    [
      "integrity",
      "Dataintegritet",
    ],
  ];

  return `
    <nav
      class="tabs"
      aria-label="Granskningsvyer"
    >
      ${tabs
        .map(
          ([id, label]) => `
            <a
              class="${
                activeTab === id
                  ? "active"
                  : ""
              }"
              href="#/audit/${id}"
            >
              ${escapeHtml(label)}
            </a>
          `
        )
        .join("")}
    </nav>
  `;
}

function exportButtons() {
  return `
    <div class="export-buttons">
      <button
        class="button small secondary"
        data-export="dataset-json"
      >
        Hela datasetet · JSON
      </button>

      <button
        class="button small secondary"
        data-export="positions-csv"
      >
        Positioner · CSV
      </button>

      <button
        class="button small secondary"
        data-export="questions-csv"
      >
        Frågor · CSV
      </button>
    </div>
  `;
}

function renderAudit(
  tab = "positions"
) {
  state.audit.tab =
    [
      "positions",
      "questions",
      "sources",
      "integrity",
    ].includes(tab)
      ? tab
      : "positions";

  saveState();

  setDocumentTitle(
    "Granska kompassen"
  );

  let content = "";

  if (
    state.audit.tab ===
    "questions"
  ) {
    content =
      renderAuditQuestions();
  } else if (
    state.audit.tab ===
    "sources"
  ) {
    content =
      renderAuditSources();
  } else if (
    state.audit.tab ===
    "integrity"
  ) {
    content =
      renderAuditIntegrity();
  } else {
    content =
      renderAuditPositions();
  }

  $("#app").innerHTML = `
    <section class="page audit-page">
      <div class="eyebrow">
        Full insyn
      </div>

      <div class="audit-heading">
        <div>
          <h1>
            Granska kompassen
          </h1>

          <p class="lead">
            Frågor, positioner, källor,
            verifieringsdatum,
            osäkerheter och exportfiler
            ligger öppet här.
          </p>
        </div>

        ${exportButtons()}
      </div>

      ${auditTabs(
        state.audit.tab
      )}

      ${content}
    </section>
  `;

  bindAuditEvents();
}

function renderAuditPositions() {
  const areas =
    [
      ...new Set(
        activeQuestions.map(
          (q) => q.area
        )
      ),
    ].sort(
      (a, b) =>
        a.localeCompare(
          b,
          "sv"
        )
    );

  const filter =
    state.audit;

  const rows =
    positions.filter(
      (row) => {
        const q =
          questionMap[
            row.question
          ];

        if (!q) {
          return false;
        }

        if (
          filter.status ===
            "active" &&
          q.status !==
            "active"
        ) {
          return false;
        }

        if (
          filter.status ===
            "research" &&
          q.status !==
            "research"
        ) {
          return false;
        }

        if (
          filter.status ===
            "known" &&
          row.position == null
        ) {
          return false;
        }

        if (
          filter.status ===
            "unknown" &&
          row.position != null
        ) {
          return false;
        }

        if (
          filter.party !==
            "all" &&
          row.party !==
            filter.party
        ) {
          return false;
        }

        if (
          filter.area !==
            "all" &&
          q.area !==
            filter.area
        ) {
          return false;
        }

        if (filter.query) {
          const haystack =
            `${q.text} ${q.scope} ` +
            `${partyMap[row.party]?.name} ` +
            `${row.rationale || ""}`;

          if (
            !haystack
              .toLocaleLowerCase("sv")
              .includes(
                filter.query
                  .toLocaleLowerCase("sv")
              )
          ) {
            return false;
          }
        }

        return true;
      }
    );

  return `
    <section class="audit-content">
      <div class="audit-summary grid four">
        <article class="card stat">
          <strong>
            ${
              meta.readiness
                .coreMatrixVerified
            }/${
              meta.readiness
                .coreMatrixRequired
            }
          </strong>

          <span>
            verifierade kärnpositioner
          </span>
        </article>

        <article class="card stat">
          <strong>
            ${
              meta.readiness
                .provisionalKnown
            }/${activeQuestions.length}
          </strong>

          <span>
            verifierade ÖP-positioner
          </span>
        </article>

        <article class="card stat">
          <strong>
            ${activeQuestions.length}
          </strong>

          <span>
            frågor som påverkar poäng
          </span>
        </article>

        <article class="card stat">
          <strong>
            ${researchQuestions.length}
          </strong>

          <span>
            forskningsfrågor, avstängda
          </span>
        </article>
      </div>

      <div class="filters card">
        <label>
          Parti

          <select id="audit-party">
            <option value="all">
              Alla partier
            </option>

            ${parties
              .map(
                (p) => `
                  <option
                    value="${p.id}"
                    ${
                      filter.party === p.id
                        ? "selected"
                        : ""
                    }
                  >
                    ${escapeHtml(
                      p.name
                    )}
                  </option>
                `
              )
              .join("")}
          </select>
        </label>

        <label>
          Område

          <select id="audit-area">
            <option value="all">
              Alla områden
            </option>

            ${areas
              .map(
                (area) => `
                  <option
                    value="${escapeHtml(
                      area
                    )}"
                    ${
                      filter.area === area
                        ? "selected"
                        : ""
                    }
                  >
                    ${escapeHtml(
                      area
                    )}
                  </option>
                `
              )
              .join("")}
          </select>
        </label>

        <label>
          Status

          <select id="audit-status">
            <option
              value="active"
              ${
                filter.status ===
                "active"
                  ? "selected"
                  : ""
              }
            >
              Aktiva frågor
            </option>

            <option
              value="research"
              ${
                filter.status ===
                "research"
                  ? "selected"
                  : ""
              }
            >
              Forskningsfrågor
            </option>

            <option
              value="known"
              ${
                filter.status ===
                "known"
                  ? "selected"
                  : ""
              }
            >
              Endast kända
            </option>

            <option
              value="unknown"
              ${
                filter.status ===
                "unknown"
                  ? "selected"
                  : ""
              }
            >
              Endast okända
            </option>

            <option
              value="all"
              ${
                filter.status ===
                "all"
                  ? "selected"
                  : ""
              }
            >
              Alla rader
            </option>
          </select>
        </label>

        <label>
          Sök

          <input
            id="audit-query"
            type="search"
            value="${escapeHtml(
              filter.query
            )}"
            placeholder="Fråga, parti eller motivering"
          >
        </label>
      </div>

      <p class="muted table-count">
        Visar ${rows.length} rader.
      </p>

      <div class="table-wrap card">
        <table class="audit-table">
          <thead>
            <tr>
              <th>Fråga</th>
              <th>Område</th>
              <th>Parti</th>
              <th>Position</th>
              <th>Underlag</th>
              <th>Verifierad</th>
            </tr>
          </thead>

          <tbody>
            ${rows
              .map(
                (row) => {
                  const q =
                    questionMap[
                      row.question
                    ];

                  const party =
                    partyMap[
                      row.party
                    ];

                  return `
                    <tr>
                      <td>
                        <strong>
                          ${escapeHtml(
                            q.text
                          )}
                        </strong>

                        <details>
                          <summary>
                            Avgränsning och motivering
                          </summary>

                          <p>
                            <strong>
                              Avgränsning:
                            </strong>

                            ${escapeHtml(
                              q.scope
                            )}
                          </p>

                          <p>
                            <strong>
                              Motivering:
                            </strong>

                            ${escapeHtml(
                              row.rationale
                            )}
                          </p>
                        </details>
                      </td>

                      <td>
                        ${escapeHtml(
                          q.area
                        )}

                        <br>

                        <span
                          class="status ${
                            q.status ===
                            "active"
                              ? "verified"
                              : "research"
                          }"
                        >
                          ${
                            q.status ===
                            "active"
                              ? "Poängsatt"
                              : "Forskningskö"
                          }
                        </span>
                      </td>

                      <td>
                        ${escapeHtml(
                          party.name
                        )}
                      </td>

                      <td>
                        ${positionBadge(
                          row
                        )}

                        <br>

                        <small>
                          Säkerhet:
                          ${escapeHtml(
                            CONFIDENCE_LABELS[
                              row.confidence
                            ] ||
                            row.confidence
                          )}
                        </small>
                      </td>

                      <td>
                        ${
                          row.source
                            ? `
                              <a
                                href="${escapeHtml(
                                  row.source
                                )}"
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                ${escapeHtml(
                                  row.sourceTitle ||
                                  "Visa källa"
                                )}
                                ↗
                              </a>
                            `
                            : `
                              <span class="muted">
                                Ingen källa ännu
                              </span>
                            `
                        }
                      </td>

                      <td>
                        ${escapeHtml(
                          row.verified ||
                          "—"
                        )}
                      </td>
                    </tr>
                  `;
                }
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderAuditQuestions() {
  return `
    <section class="audit-content">
      <div class="callout info">
        <strong>
          ${activeQuestions.length}
          publicerade +
          ${researchQuestions.length}
          i forskningskö =
          ${questions.length}
          frågor.
        </strong>

        Forskningsfrågorna är synliga
        och exporteras, men de har
        <code>score: false</code>
        och påverkar inte matchningen.
      </div>

      <div class="question-audit-list">
        ${questions
          .map(
            (q) => `
              <article
                class="card audit-question"
              >
                <div
                  class="audit-question-head"
                >
                  <span
                    class="status ${
                      q.status ===
                      "active"
                        ? "verified"
                        : "research"
                    }"
                  >
                    ${
                      q.status ===
                      "active"
                        ? "Aktiv"
                        : "Forskningskö"
                    }
                  </span>

                  <span>
                    ${escapeHtml(q.area)}
                  </span>

                  <code>
                    ${escapeHtml(q.id)}
                  </code>
                </div>

                <h3>
                  ${escapeHtml(q.text)}
                </h3>

                <p>
                  <strong>
                    Avgränsning:
                  </strong>

                  ${escapeHtml(q.scope)}
                </p>

                <details>
                  <summary>
                    Kodningsregel
                  </summary>

                  ${Object.entries(
                    q.codingRule || {}
                  )
                    .map(
                      ([key, value]) => `
                        <p>
                          <code>
                            ${escapeHtml(key)}
                          </code>

                          ${escapeHtml(value)}
                        </p>
                      `
                    )
                    .join("")}
                </details>

                ${
                  q.sourceReference
                    ? `
                      <a
                        href="${escapeHtml(
                          q.sourceReference
                        )}"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Öppna frågekällan ↗
                      </a>
                    `
                    : `
                      <p class="muted">
                        Ingen partimatris
                        kopplad ännu.
                      </p>
                    `
                }
              </article>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderAuditSources() {
  return `
    <section class="audit-content">
      <div class="source-register">
        ${sources
          .map(
            (source) => `
              <article
                class="card source-card"
              >
                <div class="source-card-head">
                  <span class="status verified">
                    ${escapeHtml(
                      source.sourceType
                    )}
                  </span>

                  <span>
                    Verifierad
                    ${escapeHtml(
                      source.verified
                    )}
                  </span>
                </div>

                <h3>
                  ${escapeHtml(
                    source.title
                  )}
                </h3>

                <p>
                  <strong>
                    ${escapeHtml(
                      source.publisher
                    )}
                  </strong>
                </p>

                <p>
                  ${escapeHtml(
                    source.note ||
                    ""
                  )}
                </p>

                <a
                  href="${escapeHtml(
                    source.url
                  )}"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Öppna källan ↗
                </a>
              </article>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderAuditIntegrity() {
  return `
    <section
      class="audit-content narrow-content"
    >
      <div class="grid two">
        <article class="card">
          <div class="eyebrow">
            Fingeravtryck
          </div>

          <h2>
            SHA-256 för datasetet
          </h2>

          <p class="hash">
            ${escapeHtml(
              meta.dataFingerprintSha256
            )}
          </p>

          <p>
            Fingeravtrycket beräknas från
            frågor, partier, positioner och
            källregister.
          </p>
        </article>

        <article class="card">
          <div class="eyebrow">
            Automatisk validering
          </div>

          <h2>
            Kontroller som måste passera
          </h2>

          <p>
            Projektets webbläsarvalidering
            kräver bland annat unika ID:n,
            komplett kärnmatris, giltiga
            skalvärden och fullständig
            källinformation.
          </p>

          <p>
            Det finns ingen övre gräns
            för antal frågor i ett
            politikområde. Balansen
            hanteras av poängmodellen.
          </p>
        </article>
      </div>

      <article
        class="card section-space"
      >
        <h2>
          Nuvarande status
        </h2>

        <dl class="integrity-list">
          <div>
            <dt>
              Datasetversion
            </dt>

            <dd>
              ${escapeHtml(
                meta.datasetVersion
              )}
            </dd>
          </div>

          <div>
            <dt>
              Verifierad till och med
            </dt>

            <dd>
              ${escapeHtml(
                meta.verifiedThrough
              )}
            </dd>
          </div>

          <div>
            <dt>
              Kärnmatris
            </dt>

            <dd>
              ${
                meta.readiness
                  .coreMatrixVerified
              }/${
                meta.readiness
                  .coreMatrixRequired
              }
              godkända
            </dd>
          </div>

          <div>
            <dt>
              Aktiva frågor
            </dt>

            <dd>
              ${activeQuestions.length}
            </dd>
          </div>

          <div>
            <dt>
              Klimat och miljö
            </dt>

            <dd>
              ${
                meta.activeAreaCounts?.[
                  "Klimat och miljö"
                ] ?? "—"
              }
              aktiva frågor
            </dd>
          </div>

          <div>
            <dt>
              Okänd representation
            </dt>

            <dd>
              <code>null</code>,
              aldrig
              <code>0</code>
            </dd>
          </div>

          <div>
            <dt>
              Webbläsarens dataspärr
            </dt>

            <dd>
              ${
                DATA_ERRORS.length
                  ? `${DATA_ERRORS.length} fel`
                  : "Godkänd"
              }
            </dd>
          </div>
        </dl>
      </article>

      ${
        DATA_ERRORS.length
          ? `
            <div
              class="callout danger section-space"
            >
              <strong>
                Dataspärren har stoppat
                rankningen:
              </strong>

              <ul>
                ${DATA_ERRORS
                  .map(
                    (error) => `
                      <li>
                        ${escapeHtml(error)}
                      </li>
                    `
                  )
                  .join("")}
              </ul>
            </div>
          `
          : `
            <div
              class="callout info section-space"
            >
              <strong>
                Webbläsarkontroll godkänd:
              </strong>

              den aktiva kärnmatrisen
              är komplett.
            </div>
          `
      }
    </section>
  `;
}

function bindAuditEvents() {
  $$("[data-export]").forEach(
    (button) => {
      button.onclick = () => {
        if (
          button.dataset.export ===
          "dataset-json"
        ) {
          exportDatasetJson();
        } else if (
          button.dataset.export ===
          "positions-csv"
        ) {
          exportPositionsCsv();
        } else if (
          button.dataset.export ===
          "questions-csv"
        ) {
          exportQuestionsCsv();
        }
      };
    }
  );

  if ($("#audit-party")) {
    $("#audit-party").onchange =
      (event) => {
        state.audit.party =
          event.target.value;

        saveState();
        renderAudit(
          "positions"
        );
      };

    $("#audit-area").onchange =
      (event) => {
        state.audit.area =
          event.target.value;

        saveState();
        renderAudit(
          "positions"
        );
      };

    $("#audit-status").onchange =
      (event) => {
        state.audit.status =
          event.target.value;

        saveState();
        renderAudit(
          "positions"
        );
      };

    let timer;

    $("#audit-query").oninput =
      (event) => {
        clearTimeout(timer);

        timer =
          setTimeout(
            () => {
              state.audit.query =
                event.target.value.trim();

              saveState();

              renderAudit(
                "positions"
              );
            },
            180
          );
      };
  }
}

function renderMethod() {
  setDocumentTitle(
    "Om metoden"
  );

  $("#app").innerHTML = `
    <section class="page method-page">
      <div class="eyebrow">
        Metod version
        ${escapeHtml(
          meta.questionDesignVersion
        )}
      </div>

      <h1>
        Exakt så fungerar kompassen
      </h1>

      <p class="lead">
        Inga dolda bonuspoäng,
        inga partivisa korrigeringar
        och ingen AI som fyller
        i luckor.
      </p>

      <section
        class="method-section grid two"
      >
        <article class="card">
          <h2>
            1. Samma skala
          </h2>

          <p>
            Ditt svar och partiets
            position kodas som
            −2, −1, 0, +1 eller +2.
          </p>

          <pre><code>sᵢ = 1 − |uᵢ − pᵢ| / 4</code></pre>
        </article>

        <article class="card">
          <h2>
            2. Områdesbalansering
          </h2>

          <p>
            Om ett område har
            <code>nₐ</code>
            besvarade frågor får varje
            sådan fråga grundfaktorn
            <code>1/nₐ</code>.
          </p>

          <pre><code>Total = 100 × Σ[(1/nₐ)·sᵢ] / Σ(1/nₐ)</code></pre>

          <p>
            Därför väger inte klimat
            och miljö automatiskt mer
            bara för att området har
            fler frågor.
          </p>
        </article>

        <article class="card">
          <h2>
            3. Din prioritering
          </h2>

          <p>
            Vikten kan vara
            0, 1, 2, 3 eller 5.
          </p>

          <pre><code>Prioritet = 100 × Σ[(wᵢ/nₐ)·sᵢ] / Σ(wᵢ/nₐ)</code></pre>
        </article>

        <article class="card">
          <h2>
            4. Okända positioner
          </h2>

          <p>
            <code>null</code>
            betyder att en säker
            position saknas.
            Den räknas aldrig
            som neutral.
          </p>
        </article>
      </section>

    </section>
  `;
}

function csvCell(value) {
  const text =
    value == null
      ? ""
      : String(value);

  return `"${text.replaceAll(
    '"',
    '""'
  )}"`;
}

function downloadBlob(
  filename,
  content,
  type
) {
  const blob =
    new Blob(
      [content],
      { type }
    );

  const url =
    URL.createObjectURL(
      blob
    );

  const anchor =
    document.createElement(
      "a"
    );

  anchor.href =
    url;

  anchor.download =
    filename;

  document.body.append(
    anchor
  );

  anchor.click();
  anchor.remove();

  setTimeout(
    () =>
      URL.revokeObjectURL(
        url
      ),
    500
  );
}

function exportDatasetJson() {
  downloadBlob(
    `valkompass-dataset-${meta.datasetVersion}.json`,
    JSON.stringify(
      {
        meta,
        questions,
        parties,
        positions,
        sources,
      },
      null,
      2
    ),
    "application/json;charset=utf-8"
  );
}

function exportQuestionsCsv() {
  const headers = [
    "id",
    "status",
    "score",
    "order",
    "area",
    "question",
    "scope",
    "source_prompt",
    "source_reference",
  ];

  const rows =
    questions.map(
      (q) => [
        q.id,
        q.status,
        q.score,
        q.order,
        q.area,
        q.text,
        q.scope,
        q.sourcePrompt,
        q.sourceReference,
      ]
    );

  const csv =
    `\uFEFF${
      [
        headers,
        ...rows,
      ]
        .map(
          (row) =>
            row
              .map(csvCell)
              .join(",")
        )
        .join("\r\n")
    }`;

  downloadBlob(
    `valkompass-fragor-${meta.datasetVersion}.csv`,
    csv,
    "text/csv;charset=utf-8"
  );
}

function exportPositionsCsv() {
  const headers = [
    "party_id",
    "party",
    "question_id",
    "question",
    "source_prompt",
    "area",
    "question_status",
    "position",
    "confidence",
    "coding_status",
    "source_answer",
    "source_title",
    "source_url",
    "verified",
    "semantic_match",
    "rationale",
    "review_notes",
  ];

  const rows =
    positions.map(
      (row) => {
        const q =
          questionMap[
            row.question
          ];

        const party =
          partyMap[
            row.party
          ];

        return [
          row.party,
          party?.name,
          row.question,
          q?.text,
          q?.sourcePrompt,
          q?.area,
          q?.status,
          row.position,
          row.confidence,
          row.codingStatus,
          row.sourceAnswer,
          row.sourceTitle,
          row.source,
          row.verified,
          row.semanticMatch,
          row.rationale,
          row.reviewNotes,
        ];
      }
    );

  const csv =
    `\uFEFF${
      [
        headers,
        ...rows,
      ]
        .map(
          (row) =>
            row
              .map(csvCell)
              .join(",")
        )
        .join("\r\n")
    }`;

  downloadBlob(
    `valkompass-positioner-${meta.datasetVersion}.csv`,
    csv,
    "text/csv;charset=utf-8"
  );
}

function exportUserResult(scores) {
  const payload = {
    exportedAt:
      new Date().toISOString(),

    datasetVersion:
      meta.datasetVersion,

    dataFingerprintSha256:
      meta.dataFingerprintSha256,

    answers:
      activeQuestions.map(
        (q) => ({
          question: q.id,
          text: q.text,
          area: q.area,
          ...(
            state.answers[q.id] ||
            {}
          ),
        })
      ),

    scores:
      scores.map(
        (score) => ({
          party:
            score.party.id,

          partyName:
            score.party.name,

          comparisonGroup:
            score.party
              .comparisonGroup,

          priority:
            score.priority,

          total:
            score.total,

          priorityLower:
            score.priorityLower,

          priorityUpper:
            score.priorityUpper,

          countCoverage:
            score.countCoverage,

          knownQuestionCount:
            score.knownQuestionCount,

          answeredQuestionCount:
            score.answeredQuestionCount,

          eligibleForRanking:
            score.eligibleForRanking,
        })
      ),
  };

  downloadBlob(
    `mitt-valkompassresultat-${todayIso()}.json`,
    JSON.stringify(
      payload,
      null,
      2
    ),
    "application/json;charset=utf-8"
  );
}

renderRoute();

window.__VALKOMPASS_READY__ =
  true;

window.__VALKOMPASS_TEST__ = {
  meta,
  questions,
  activeQuestions,
  researchQuestions,
  parties,
  positions,
  dataErrors:
    DATA_ERRORS,
  calculatePartyScore,
  calculateAllPartyScores,
  getScores,
};
