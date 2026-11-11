import assert from "node:assert/strict";
import { test } from "node:test";
import {
  TREE_MAX_FILES,
  applyShareListItem,
  isShareDir,
  itemFileId,
  itemFileName,
  joinSharePath,
  parseShare,
  passwordFromShareUrl,
  sanitizeShareName,
} from "./share-meta.js";

test("parseShare 认夸克、UC 与阿里云盘公开分享", () => {
  assert.equal(parseShare("https://pan.quark.cn/s/abc123XYZ")?.provider, "quark");
  assert.equal(parseShare("https://drive.uc.cn/s/ucShare01")?.provider, "uc");
  assert.equal(parseShare("https://pan.uc.cn/s/ucShare02")?.provider, "uc");
  assert.equal(parseShare("https://www.alipan.com/s/ali01")?.provider, "aliyun");
  assert.equal(parseShare("https://www.aliyundrive.com/s/P941RTqpKxe")?.shareId, "P941RTqpKxe");
  assert.equal(parseShare("https://alipan.com/s/Bb4ekjhf8pe")?.provider, "aliyun");
  assert.equal(parseShare("https://pan.baidu.com/s/1xxxx"), null);
  assert.equal(parseShare("javascript:alert(1)"), null);
});

test("sanitizeShareName 去掉控制字符与路径分隔符", () => {
  assert.equal(sanitizeShareName("a/b\\c"), "a_b_c");
  assert.equal(sanitizeShareName("  E01.mkv  "), "E01.mkv");
  assert.equal(sanitizeShareName(""), "未命名");
  assert.equal(sanitizeShareName("a".repeat(200)).length, 180);
});

test("joinSharePath 拼相对路径并截断", () => {
  assert.equal(joinSharePath("", "E01.mkv"), "E01.mkv");
  assert.equal(joinSharePath("S01", "E01.mkv"), "S01/E01.mkv");
  assert.ok(joinSharePath("p".repeat(200), "n".repeat(80)).length <= 240);
});

test("applyShareListItem 只收录文件名/路径/大小，目录进入队列", () => {
  const state = {
    fileCount: 0,
    sizeBytes: 0,
    files: [],
    dirQueue: [],
    treeTruncated: false,
  };
  applyShareListItem(
    { file_name: "S01", dir: true, fid: "dir1", download_url: "http://evil" },
    "",
    state
  );
  applyShareListItem(
    { file_name: "E01.mkv", file_type: 1, size: 1024, fid: "f1", download_url: "secret" },
    "S01",
    state
  );

  assert.deepEqual(state.dirQueue, [{ fid: "dir1", path: "S01" }]);
  assert.equal(state.fileCount, 1);
  assert.equal(state.sizeBytes, 1024);
  assert.deepEqual(state.files, [{ name: "E01.mkv", path: "S01/E01.mkv", sizeBytes: 1024 }]);
  assert.equal("fid" in state.files[0], false);
  assert.equal("download_url" in state.files[0], false);
});

test("applyShareListItem 预览条数封顶", () => {
  const state = {
    fileCount: 0,
    sizeBytes: 0,
    files: [],
    dirQueue: [],
    treeTruncated: false,
  };
  for (let i = 0; i < TREE_MAX_FILES + 5; i += 1) {
    applyShareListItem({ file_name: `f${i}.mkv`, size: 10, file_type: 1 }, "", state);
  }
  assert.equal(state.fileCount, TREE_MAX_FILES + 5);
  assert.equal(state.files.length, TREE_MAX_FILES);
  assert.equal(state.treeTruncated, true);
});

test("itemFileName / isShareDir 兼容字段别名", () => {
  assert.equal(itemFileName({ filename: "a.mkv" }), "a.mkv");
  assert.equal(isShareDir({ file_type: 0 }), true);
  assert.equal(isShareDir({ dir: true }), true);
  assert.equal(isShareDir({ file_type: 1 }), false);
  assert.equal(isShareDir({ type: "folder", file_id: "abc" }), true);
  assert.equal(isShareDir({ type: "file", file_id: "def" }), false);
  assert.equal(itemFileId({ file_id: "aliFid" }), "aliFid");
});

test("passwordFromShareUrl 读取 pwd 查询参数", () => {
  assert.equal(passwordFromShareUrl("https://www.alipan.com/s/abc?pwd=xy12"), "xy12");
  assert.equal(passwordFromShareUrl("https://pan.quark.cn/s/abc"), "");
});

test("applyShareListItem 兼容阿里云盘 name/type/file_id", () => {
  const state = {
    fileCount: 0,
    sizeBytes: 0,
    files: [],
    dirQueue: [],
    treeTruncated: false,
  };
  applyShareListItem({ name: "S01", type: "folder", file_id: "dirA", download_url: "nope" }, "", state);
  applyShareListItem({ name: "E01.mkv", type: "file", size: 2048, file_id: "fA" }, "S01", state);
  assert.deepEqual(state.dirQueue, [{ fid: "dirA", path: "S01" }]);
  assert.deepEqual(state.files, [{ name: "E01.mkv", path: "S01/E01.mkv", sizeBytes: 2048 }]);
  assert.equal("file_id" in state.files[0], false);
});
