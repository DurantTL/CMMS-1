import test from "node:test";
import assert from "node:assert/strict";

import { buildCamporeeCategoryStandings, buildCamporeeTotalStandings } from "../lib/camporee";

test("camporee category standings rank clubs by score within each category", () => {
  const standings = buildCamporeeCategoryStandings([
    {
      category: "Drill",
      score: 91,
      registrationId: "reg-1",
      clubName: "Central Club",
      clubCode: "CENT",
    },
    {
      category: "Drill",
      score: 97,
      registrationId: "reg-2",
      clubName: "North Club",
      clubCode: "NORTH",
    },
    {
      category: "Inspection",
      score: 88,
      registrationId: "reg-1",
      clubName: "Central Club",
      clubCode: "CENT",
    },
  ]);

  assert.equal(standings.length, 2);
  assert.equal(standings[0]?.category, "Drill");
  assert.equal(standings[0]?.entries[0]?.clubName, "North Club");
  assert.equal(standings[0]?.entries[0]?.rank, 1);
  assert.equal(standings[0]?.entries[1]?.rank, 2);
});

test("camporee total standings aggregate category scores per registration", () => {
  const standings = buildCamporeeTotalStandings([
    {
      category: "Drill",
      score: 91,
      registrationId: "reg-1",
      clubName: "Central Club",
      clubCode: "CENT",
    },
    {
      category: "Inspection",
      score: 88,
      registrationId: "reg-1",
      clubName: "Central Club",
      clubCode: "CENT",
    },
    {
      category: "Drill",
      score: 97,
      registrationId: "reg-2",
      clubName: "North Club",
      clubCode: "NORTH",
    },
  ]);

  assert.equal(standings[0]?.clubName, "Central Club");
  assert.equal(standings[0]?.totalScore, 179);
  assert.deepEqual(standings[0]?.scoredCategories, ["Drill", "Inspection"]);
  assert.equal(standings[1]?.rank, 2);
});
