import assert from "node:assert/strict";
import { test } from "node:test";
import { keywordFromDoubanTitle } from "./douban-tv-hot.js";

test("keywordFromDoubanTitle 截取中文主标题", () => {
  assert.equal(keywordFromDoubanTitle("狂飙 The Knockout"), "狂飙");
  assert.equal(keywordFromDoubanTitle("庆余年 第二季"), "庆余年");
  assert.equal(keywordFromDoubanTitle("繁花"), "繁花");
});
