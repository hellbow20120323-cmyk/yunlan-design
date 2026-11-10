import assert from "node:assert/strict";
import { test } from "node:test";
import { mergeShuffleTvLists } from "./subhd-hot.js";

test("mergeShuffleTvLists 去重并保留豆瓣条目", () => {
  const douban = [
    {
      id: "douban-12345",
      title: "狂飙",
      keyword: "狂飙",
      imageUrl: "https://img3.doubanio.com/x.jpg",
      source: "douban",
    },
    {
      id: "douban-99999",
      title: "新剧",
      keyword: "新剧",
      imageUrl: "https://img3.doubanio.com/y.jpg",
      source: "douban",
    },
  ];
  const subhd = [
    {
      id: "12345",
      title: "狂飙 SubHD 标题",
      keyword: "狂飙",
      imageUrl: "https://img.subhd.me/poster/douban/12345_600.webp",
      source: "toptv",
    },
    {
      id: "88888",
      title: "字幕站独剧",
      keyword: "字幕站独剧",
      imageUrl: "https://img.subhd.me/poster/douban/88888_600.webp",
      source: "toptv",
    },
  ];
  const out = mergeShuffleTvLists(douban, subhd, 10);
  assert.equal(out.length, 3);
  const titles = new Set(out.map((x) => x.keyword));
  assert.ok(titles.has("狂飙"));
  assert.ok(titles.has("新剧"));
  assert.ok(titles.has("字幕站独剧"));
  const kb = out.find((x) => x.keyword === "狂飙");
  assert.equal(kb?.source, "douban");
});
