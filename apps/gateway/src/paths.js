import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** 仓库根目录（含 version.json、apps/、engine/） */
export const REPO_ROOT = path.resolve(__dirname, "../../..");

/** 网关运行数据：用户、额度、订单、热门缓存、微博配置等（gitignored） */
export const DATA_DIR = path.resolve(process.env.YUNLAN_DATA_DIR || path.join(REPO_ROOT, ".data"));

export const WEB_DIST = path.join(REPO_ROOT, "apps", "web", "dist");

export const VERSION_PATH = path.join(REPO_ROOT, "version.json");

export function dataPath(name) {
  return path.join(DATA_DIR, name);
}
