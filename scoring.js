/**
 * Pure, dependency-free scoring functions for Öppen Valkompass 2026.
 *
 * Similarity for question i:
 *   s_i = 1 - |u_i - p_i| / 4
 *
 * To prevent an area with more questions from automatically weighing more,
 * each answered question receives the base factor 1 / n_a, where n_a is the
 * number of answered questions in the same policy area.
 *
 * Total match:
 *   100 * sum((1/n_a) * s_i) / sum(1/n_a)
 *
 * Priority match:
 *   100 * sum((w_i/n_a) * s_i) / sum(w_i/n_a)
 *
 * This is equivalent to first calculating a match inside each area and then
 * combining areas. Unknown party positions never become neutral positions.
 */

export function similarity(userValue, partyValue) {
  if (!Number.isFinite(userValue) || !Number.isFinite(partyValue)) return null;
  return 1 - Math.abs(userValue - partyValue) / 4;
}

export function buildPositionMap(positions) {
  return new Map(positions.map((row) => [`${row.party}:${row.question}`, row]));
}

function readPosition(positionMap, partyId, questionId) {
  if (positionMap instanceof Map) return positionMap.get(`${partyId}:${questionId}`);
  return positionMap?.[`${partyId}:${questionId}`];
}

function percent(value) {
  return value == null || !Number.isFinite(value) ? null : Math.max(0, Math.min(100, value * 100));
}

function answeredItem(question, answers) {
  const answer = answers?.[question.id];
  if (!answer || answer.skipped || !Number.isFinite(answer.value)) return null;
  const importance = Number.isFinite(answer.importance) ? answer.importance : 2;
  return { question, answer: { ...answer, importance } };
}

export function calculatePartyScore({
  partyId,
  questions,
  answers,
  positionMap,
  minimumAnswered = 12,
}) {
  const activeQuestions = questions.filter((q) => q.score !== false && q.status !== "research");
  const answered = activeQuestions.map((q) => answeredItem(q, answers)).filter(Boolean);
  const byArea = new Map();
  for (const item of answered) {
    const area = item.question.area;
    if (!byArea.has(area)) byArea.set(area, []);
    byArea.get(area).push(item);
  }

  let knownQuestionCount = 0;
  let totalKnownWeight = 0;
  let totalAllWeight = 0;
  let totalKnownSimilarity = 0;
  let priorityKnownWeight = 0;
  let priorityAllWeight = 0;
  let priorityKnownSimilarity = 0;
  const areaScores = {};

  for (const [area, items] of byArea) {
    const count = items.length;
    const baseFactor = 1 / count;
    let areaKnownCount = 0;
    let areaKnownSimilarity = 0;
    let areaKnownPriorityWeight = 0;
    let areaAllPriorityWeight = 0;
    let areaKnownPrioritySimilarity = 0;
    const comparisons = [];

    for (const item of items) {
      const row = readPosition(positionMap, partyId, item.question.id);
      const known = row && Number.isFinite(row.position);
      const weight = item.answer.importance;
      const effectivePriorityWeight = weight * baseFactor;

      totalAllWeight += baseFactor;
      priorityAllWeight += effectivePriorityWeight;
      areaAllPriorityWeight += weight;

      let sim = null;
      if (known) {
        sim = similarity(item.answer.value, row.position);
        knownQuestionCount += 1;
        areaKnownCount += 1;
        totalKnownWeight += baseFactor;
        totalKnownSimilarity += baseFactor * sim;
        priorityKnownWeight += effectivePriorityWeight;
        priorityKnownSimilarity += effectivePriorityWeight * sim;
        areaKnownSimilarity += sim;
        areaKnownPriorityWeight += weight;
        areaKnownPrioritySimilarity += weight * sim;
      }

      comparisons.push({
        question: item.question,
        answer: item.answer,
        position: row || null,
        similarity: sim == null ? null : percent(sim),
        distance: known ? Math.abs(item.answer.value - row.position) : null,
      });
    }

    const totalObserved = areaKnownCount ? areaKnownSimilarity / areaKnownCount : null;
    const totalLower = areaKnownSimilarity / count;
    const totalUpper = (areaKnownSimilarity + (count - areaKnownCount)) / count;
    const priorityObserved = areaKnownPriorityWeight
      ? areaKnownPrioritySimilarity / areaKnownPriorityWeight
      : null;
    const priorityLower = areaAllPriorityWeight
      ? areaKnownPrioritySimilarity / areaAllPriorityWeight
      : null;
    const priorityUpper = areaAllPriorityWeight
      ? (areaKnownPrioritySimilarity + (areaAllPriorityWeight - areaKnownPriorityWeight)) / areaAllPriorityWeight
      : null;

    areaScores[area] = {
      answeredCount: count,
      knownCount: areaKnownCount,
      countCoverage: count ? areaKnownCount / count : 0,
      priorityCoverage: areaAllPriorityWeight
        ? areaKnownPriorityWeight / areaAllPriorityWeight
        : (count ? areaKnownCount / count : 0),
      totalObserved: percent(totalObserved),
      totalLower: percent(totalLower),
      totalUpper: percent(totalUpper),
      priorityObserved: percent(priorityObserved),
      priorityLower: percent(priorityLower),
      priorityUpper: percent(priorityUpper),
      comparisons,
    };
  }

  const unknownQuestionCount = answered.length - knownQuestionCount;
  const totalObserved = totalKnownWeight ? totalKnownSimilarity / totalKnownWeight : null;
  const totalLower = totalAllWeight ? totalKnownSimilarity / totalAllWeight : null;
  const totalUpper = totalAllWeight
    ? (totalKnownSimilarity + (totalAllWeight - totalKnownWeight)) / totalAllWeight
    : null;
  const priorityObserved = priorityKnownWeight ? priorityKnownSimilarity / priorityKnownWeight : null;
  const priorityLower = priorityAllWeight ? priorityKnownSimilarity / priorityAllWeight : null;
  const priorityUpper = priorityAllWeight
    ? (priorityKnownSimilarity + (priorityAllWeight - priorityKnownWeight)) / priorityAllWeight
    : null;
  const completeForAnswered = answered.length > 0 && unknownQuestionCount === 0;

  return {
    partyId,
    answeredQuestionCount: answered.length,
    knownQuestionCount,
    unknownQuestionCount,
    areaCount: byArea.size,
    countCoverage: answered.length ? knownQuestionCount / answered.length : 0,
    totalCoverage: totalAllWeight ? totalKnownWeight / totalAllWeight : 0,
    priorityCoverage: priorityAllWeight
      ? priorityKnownWeight / priorityAllWeight
      : (totalAllWeight ? totalKnownWeight / totalAllWeight : 0),
    total: percent(totalObserved),
    totalLower: percent(totalLower),
    totalUpper: percent(totalUpper),
    priority: percent(priorityObserved),
    priorityLower: percent(priorityLower),
    priorityUpper: percent(priorityUpper),
    completeForAnswered,
    eligibleForRanking: completeForAnswered && answered.length >= minimumAnswered,
    areaScores,
  };
}

export function calculateAllPartyScores({
  parties,
  questions,
  answers,
  positions,
  minimumAnswered = 12,
}) {
  const positionMap = positions instanceof Map ? positions : buildPositionMap(positions);
  return parties.map((party) => ({
    party,
    ...calculatePartyScore({
      partyId: party.id,
      questions,
      answers,
      positionMap,
      minimumAnswered,
    }),
  }));
}
