import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applySeoToHtml,
  buildSitemapXml,
  escapeHtml,
  isSeoBot,
  searchCanonical,
  searchPageDescription,
  searchPageTitle,
} from "./seo.js";

test("searchPageTitle 含关键词与条数", () => {
  assert.equal(searchPageTitle("三体", 12), "三体 - 12条公开资料 | 云览");
  assert.match(searchPageTitle("", 0), /云览/);
});

test("searchCanonical 编码查询词", () => {
  assert.equal(searchCanonical("三体"), "https://panso.hellbow.xyz/?q=%E4%B8%89%E4%BD%93");
  assert.equal(searchCanonical(""), "https://panso.hellbow.xyz/");
});

test("applySeoToHtml 写入 title / description / canonical / json-ld", () => {
  const html =
    '<html><head><title>旧</title><meta name="description" content="x" /></head><body><div id="root"></div></body></html>';
  const out = applySeoToHtml(html, {
    kw: "三体",
    total: 3,
    results: [{ title: "三体 4K", url: "https://pan.quark.cn/s/abc", cloudType: "quark" }],
    prerender: true,
    searchEnabled: true,
  });
  assert.match(out, /<title>三体 - 3条公开资料 \| 云览<\/title>/);
  assert.match(out, /rel="canonical" href="https:\/\/panso\.hellbow\.xyz\/\?q=%E4%B8%89%E4%BD%93"/);
  assert.match(out, /application\/ld\+json/);
  assert.match(out, /<h1>三体 公开资料<\/h1>/);
  assert.match(out, /三体 4K/);
});

test("搜索开关关闭时忽略查询词，工具页 / 支持页使用对应 meta", () => {
  const html =
    '<html><head><title>旧</title><meta name="description" content="x" /></head><body><div id="root"></div></body></html>';
  const off = applySeoToHtml(html, { kw: "三体", total: 3, prerender: true, searchEnabled: false });
  assert.doesNotMatch(off, /三体/);
  assert.match(off, /免费在线文档与文本工具站/);

  const tools = applySeoToHtml(html, { path: "/tools/json", searchEnabled: false });
  assert.match(tools, /<title>JSON 格式化与校验工具/);
  assert.match(tools, /rel="canonical" href="https:\/\/panso\.hellbow\.xyz\/tools\/json"/);

  const support = applySeoToHtml(html, { path: "/support", searchEnabled: false });
  assert.match(support, /name="robots" content="noindex,follow"/);
});

test("sitemap 关闭搜索时只收录工具页", () => {
  const off = buildSitemapXml([{ keyword: "三体" }], { searchEnabled: false });
  assert.match(off, /\/tools\/text/);
  assert.doesNotMatch(off, /%E4%B8%89%E4%BD%93/);

  const on = buildSitemapXml([{ keyword: "三体" }], { searchEnabled: true });
  assert.match(on, /%E4%B8%89%E4%BD%93/);
});

test("escapeHtml 防注入", () => {
  assert.equal(escapeHtml('<script>"x"'), "&lt;script&gt;&quot;x&quot;");
});

test("isSeoBot 识别常见爬虫", () => {
  assert.equal(isSeoBot("Mozilla/5.0 (compatible; Baiduspider/2.0)"), true);
  assert.equal(isSeoBot("Googlebot/2.1"), true);
  assert.equal(isSeoBot("Mozilla/5.0 Chrome/120"), false);
});

test("searchPageDescription 含关键词", () => {
  assert.match(searchPageDescription("奥本海默", 5), /奥本海默/);
});
