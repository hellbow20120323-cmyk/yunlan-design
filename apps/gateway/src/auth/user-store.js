import crypto from "node:crypto";
import { dataPath } from "../paths.js";
import { JsonStore } from "../json-store.js";

const store = new JsonStore(dataPath("users.json"), () => ({ users: [] }), {
  normalize: (d) => ({ ...d, users: Array.isArray(d?.users) ? d.users : [] }),
});

/** 内存索引：邮箱 → 用户；随文件对象变化自动重建 */
let indexSource = null;
let emailIndex = new Map();

function normEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function index() {
  const data = store.read();
  if (indexSource !== data || emailIndex.size !== data.users.length) {
    emailIndex = new Map(data.users.map((u) => [u.email, u]));
    indexSource = data;
  }
  return emailIndex;
}

export function findUserByEmail(email) {
  const norm = normEmail(email);
  if (!norm) return null;
  return index().get(norm) || null;
}

export function findUserById(id) {
  return store.read().users.find((u) => u.id === id) || null;
}

export function createUser(email, passwordHash) {
  const norm = normEmail(email);
  if (!norm) throw new Error("邮箱无效");
  if (findUserByEmail(norm)) throw new Error("该邮箱已注册");
  const data = store.read();
  const user = {
    id: crypto.randomUUID(),
    email: norm,
    passwordHash,
    createdAt: new Date().toISOString(),
  };
  data.users.push(user);
  store.write();
  return { id: user.id, email: user.email, createdAt: user.createdAt };
}
