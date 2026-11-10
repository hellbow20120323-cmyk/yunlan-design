import assert from "node:assert/strict";
import { test } from "node:test";
import { finalizeMergedHits } from "./aggregate.js";

test("finalizeMergedHits reserves magnet slots in blended search", () => {
  const pans = Array.from({ length: 100 }, (_, i) => ({
    id: `p-${i}`,
    cloudType: "quark",
    score: 100 - i,
    url: `https://pan.quark.cn/s/${i}`,
    title: `pan ${i}`,
  }));
  const magnets = Array.from({ length: 30 }, (_, i) => ({
    id: `m-${i}`,
    cloudType: "magnet",
    score: 10 - i,
    url: `magnet:?xt=urn:btih:${i}`,
    title: `mag ${i}`,
  }));
  const merged = finalizeMergedHits([...pans, ...magnets], [
    "baidu",
    "quark",
    "xunlei",
    "uc",
    "magnet",
  ]);
  const magnetCount = merged.filter((h) => h.cloudType === "magnet").length;
  assert.ok(magnetCount >= 10, `expected >=10 magnets, got ${magnetCount}`);
  assert.ok(merged.length <= 120);
});

test("finalizeMergedHits: magnet-only returns magnets by score", () => {
  const hits = [
    { cloudType: "magnet", score: 1, url: "magnet:?xt=1", title: "a" },
    { cloudType: "magnet", score: 9, url: "magnet:?xt=9", title: "b" },
  ];
  const out = finalizeMergedHits(hits, ["magnet"], 10);
  assert.equal(out.length, 2);
  assert.equal(out[0].score, 9);
});
