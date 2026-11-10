/**
 * 轻量 JSON 文件存储：内存缓存 + 原子写入 + 0600 权限。
 *
 * 之前每个请求都会同步「读盘 + JSON.parse」，额度模块甚至每次读都会写盘。
 * 这里改为：
 * - 读：命中内存缓存；仅在文件 mtime 变化（人工编辑）时重新加载，一次 stat 代替读+解析
 * - 写：先写临时文件再 rename，避免进程中途退出产生半截 JSON
 * - 可选 flushMs：高频写入（积分）合并为延迟落盘，进程退出时同步刷盘
 * - 目录 0700、文件 0600：users.json 含密码哈希，不应对其他系统用户可读
 */
import fs from "node:fs";
import path from "node:path";

/** @type {Set<JsonStore>} */
const dirtyStores = new Set();
let exitHooked = false;

/** 把所有尚未落盘的存储同步写入磁盘（进程退出前调用） */
export function flushAllStores() {
  for (const s of [...dirtyStores]) s.flush();
}

function hookExit() {
  if (exitHooked) return;
  exitHooked = true;
  // 只挂 exit：信号交给入口的优雅关闭逻辑处理，避免抢先 process.exit 打断收尾
  process.on("exit", flushAllStores);
}

export class JsonStore {
  /**
   * @param {string} filePath
   * @param {() => any} makeDefault
   * @param {{ flushMs?: number, normalize?: (data: any) => any }} [opts]
   */
  constructor(filePath, makeDefault, opts = {}) {
    this.filePath = filePath;
    this.makeDefault = makeDefault;
    this.flushMs = opts.flushMs || 0;
    this.normalize = opts.normalize || ((d) => d);
    /** @type {any} */
    this.data = null;
    this.mtimeMs = 0;
    this.dirty = false;
    /** @type {NodeJS.Timeout | null} */
    this.timer = null;
  }

  ensureDir() {
    const dir = path.dirname(this.filePath);
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }

  statMtime() {
    try {
      return fs.statSync(this.filePath).mtimeMs;
    } catch {
      return 0;
    }
  }

  load() {
    this.ensureDir();
    const mtime = this.statMtime();
    if (!mtime) {
      this.data = this.normalize(this.makeDefault());
      this.mtimeMs = 0;
      return;
    }
    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, "utf8"));
      this.data = this.normalize(parsed && typeof parsed === "object" ? parsed : this.makeDefault());
    } catch {
      this.data = this.normalize(this.makeDefault());
    }
    this.mtimeMs = mtime;
    // 历史遗留文件可能是 0644，启动时顺手收紧
    try {
      fs.chmodSync(this.filePath, 0o600);
    } catch {
      /* ignore */
    }
  }

  /** 返回可直接修改的内存对象；修改后须调用 write() */
  read() {
    if (!this.data) {
      this.load();
    } else if (!this.dirty) {
      const mtime = this.statMtime();
      if (mtime !== this.mtimeMs) this.load();
    }
    return this.data;
  }

  write() {
    if (!this.data) this.load();
    this.dirty = true;
    if (!this.flushMs) {
      this.flush();
      return;
    }
    dirtyStores.add(this);
    hookExit();
    if (!this.timer) {
      this.timer = setTimeout(() => {
        this.timer = null;
        this.flush();
      }, this.flushMs);
      this.timer.unref?.();
    }
  }

  flush() {
    if (!this.dirty || !this.data) return;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.ensureDir();
    const tmp = `${this.filePath}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), { mode: 0o600 });
    fs.renameSync(tmp, this.filePath);
    this.mtimeMs = this.statMtime();
    this.dirty = false;
    dirtyStores.delete(this);
  }
}
