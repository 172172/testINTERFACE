#!/usr/bin/env node
import assert from "node:assert/strict";
import { calculatePartyScore, similarity } from "../scoring.js";

const close = (actual, expected, tolerance = 1e-9) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `Förväntade ${expected}, fick ${actual}`);
};

assert.equal(similarity(-2, -2), 1);
assert.equal(similarity(-2, -1), 0.75);
assert.equal(similarity(-2, 0), 0.5);
assert.equal(similarity(-2, 1), 0.25);
assert.equal(similarity(-2, 2), 0);
assert.equal(similarity(null, 2), null);

const q = (id, area) => ({ id, area, score: true, status: "active" });
const questions = [q("a1", "A"), q("a2", "A"), q("a3", "A"), q("b1", "B")];
const exactAndOpposite = new Map([
  ["p:a1", { position: 2 }],
  ["p:a2", { position: 2 }],
  ["p:a3", { position: 2 }],
  ["p:b1", { position: -2 }],
]);
const answers = {
  a1: { value: 2, importance: 2 },
  a2: { value: 2, importance: 2 },
  a3: { value: 2, importance: 2 },
  b1: { value: 2, importance: 2 },
};
const balanced = calculatePartyScore({ partyId: "p", questions, answers, positionMap: exactAndOpposite, minimumAnswered: 1 });
close(balanced.total, 50); // A=100 %, B=0 %, inte frågemedel 75 %.
close(balanced.priority, 50);
assert.equal(balanced.eligibleForRanking, true);

const weightedAnswers = {
  a1: { value: 2, importance: 1 },
  a2: { value: 2, importance: 1 },
  a3: { value: 2, importance: 1 },
  b1: { value: 2, importance: 5 },
};
const weighted = calculatePartyScore({ partyId: "p", questions, answers: weightedAnswers, positionMap: exactAndOpposite, minimumAnswered: 1 });
close(weighted.total, 50);
close(weighted.priority, 100 / 6); // Område A får genomsnittsvikt 1, B vikt 5.

const partialMap = new Map([
  ["p:a1", { position: 2 }],
  ["p:a2", { position: null }],
  ["p:a3", { position: null }],
  ["p:b1", { position: -2 }],
]);
const partial = calculatePartyScore({ partyId: "p", questions, answers, positionMap: partialMap, minimumAnswered: 1 });
assert.equal(partial.knownQuestionCount, 2);
assert.equal(partial.unknownQuestionCount, 2);
assert.equal(partial.completeForAnswered, false);
assert.equal(partial.eligibleForRanking, false);
close(partial.total, 25); // Observerat områdesbalanserat: A=100, B=0; A har bara 1/3 känd vikt -> 25 totalt.
close(partial.totalLower, 100 / 6);
close(partial.totalUpper, 50);

const zeroImportance = Object.fromEntries(Object.entries(answers).map(([id, answer]) => [id, { ...answer, importance: 0 }]));
const zero = calculatePartyScore({ partyId: "p", questions, answers: zeroImportance, positionMap: exactAndOpposite, minimumAnswered: 1 });
assert.equal(zero.priority, null);
close(zero.total, 50);

const skipped = calculatePartyScore({
  partyId: "p",
  questions,
  answers: { ...answers, b1: { skipped: true, value: null, importance: 0 } },
  positionMap: exactAndOpposite,
  minimumAnswered: 1,
});
close(skipped.total, 100);
assert.equal(skipped.answeredQuestionCount, 3);

console.log("Poängtest: GODKÄNT");
