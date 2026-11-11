import assert from "node:assert/strict";
import { test } from "node:test";
import {
  WELL_KNOWN_TITLES,
  collectSuggestions,
  isSuggestableQuery,
  rankLocalSuggestions,
  titlesFromHotPayload,
} from "./suggest.js";

test("rankLocalSuggestions: 星球 → 星球大战", () => {
  const hits = rankLocalSuggestions("星球", WELL_KNOWN_TITLES);
  assert.ok(hits.includes("星球大战"));
  assert.equal(hits[0].startsWith("星球"), true);
});

test("rankLocalSuggestions: prefix ranks before contains", () => {
  const hits = rankLocalSuggestions("沙丘", ["奥本海默与沙丘", "沙丘2", "沙丘"]);
  assert.deepEqual(hits, ["沙丘2", "奥本海默与沙丘"]);
});

test("isSuggestableQuery rejects empty and overlong", () => {
  assert.equal(isSuggestableQuery(""), false);
  assert.equal(isSuggestableQuery("星"), true);
  assert.equal(isSuggestableQuery("a"), false);
  assert.equal(isSuggestableQuery("ab"), true);
});

test("titlesFromHotPayload reads keyword/title", () => {
  const titles = titlesFromHotPayload({
    movies: [{ keyword: "奥德赛", title: "The Odyssey" }],
    tv: [{ keyword: "尚公主" }],
  });
  assert.ok(titles.includes("奥德赛"));
  assert.ok(titles.includes("尚公主"));
});

test("collectSuggestions merges well-known even if remote empty", async () => {
  const items = await collectSuggestions("星球", []);
  assert.ok(items.some((item) => item.text.includes("星球大战")));
});
