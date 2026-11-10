import assert from "node:assert/strict";
import { test } from "node:test";
import { correctFormatTyposInQuery, prepareSearchKeywords } from "./queryOptimize.js";

test("correctFormatTyposInQuery: FALC → FLAC", () => {
  assert.equal(correctFormatTyposInQuery("张雨生 FALC"), "张雨生 FLAC");
  assert.equal(correctFormatTyposInQuery("flc 专辑"), "flac 专辑");
});

test("prepareSearchKeywords: fallbacks", () => {
  const p = prepareSearchKeywords("张雨生 FALC");
  assert.equal(p.normalized, "张雨生 FLAC");
  assert.ok(p.corrected);
  assert.ok(p.upstreamTerms.includes("张雨生 FLAC"));
  assert.ok(p.upstreamTerms.includes("张雨生"));
});
