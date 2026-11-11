/**
 * 支付渠道密钥读取：优先环境变量内联内容，其次文件路径。
 * 不引入第三方依赖，PEM 统一由 Node 内置 crypto 解析。
 */
import fs from "node:fs";

/** 读取密钥原文；path/inline 都为空时返回空串 */
export function readKeyMaterial(pathValue, inlineValue) {
  const inline = String(inlineValue || "").trim();
  if (inline) return inline.replace(/\\n/g, "\n");
  const file = String(pathValue || "").trim();
  if (!file) return "";
  return fs.readFileSync(file, "utf8");
}

/** 支付宝控制台导出的密钥可能不含 PEM 头，这里补齐 */
export function normalizePem(raw, label) {
  const s = String(raw || "").trim();
  if (!s) return "";
  if (s.includes("-----BEGIN")) return s;
  const body = s.replace(/\s+/g, "");
  const lines = body.match(/.{1,64}/g)?.join("\n") || body;
  return `-----BEGIN ${label}-----\n${lines}\n-----END ${label}-----`;
}
