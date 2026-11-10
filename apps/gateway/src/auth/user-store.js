import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "../paths.js";
import crypto from "node:crypto";

const USERS_PATH = path.join(DATA_DIR, "users.json");

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readStore() {
  ensureDataDir();
  if (!fs.existsSync(USERS_PATH)) {
    return { users: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(USERS_PATH, "utf8"));
  } catch {
    return { users: [] };
  }
}

function writeStore(store) {
  ensureDataDir();
  fs.writeFileSync(USERS_PATH, JSON.stringify(store, null, 2), "utf8");
}

export function findUserByEmail(email) {
  const norm = String(email || "")
    .trim()
    .toLowerCase();
  if (!norm) return null;
  const store = readStore();
  return store.users.find((u) => u.email === norm) || null;
}

export function findUserById(id) {
  const store = readStore();
  return store.users.find((u) => u.id === id) || null;
}

export function createUser(email, passwordHash) {
  const norm = String(email || "")
    .trim()
    .toLowerCase();
  if (!norm) throw new Error("邮箱无效");
  if (findUserByEmail(norm)) throw new Error("该邮箱已注册");
  const store = readStore();
  const user = {
    id: crypto.randomUUID(),
    email: norm,
    passwordHash,
    createdAt: new Date().toISOString(),
  };
  store.users.push(user);
  writeStore(store);
  return { id: user.id, email: user.email, createdAt: user.createdAt };
}
