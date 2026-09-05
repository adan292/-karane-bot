const fs = require("fs");
const path = require("path");

const authDir = __dirname; // ./auth
const linkDir = path.join(__dirname, "..", "data", "linkcodes");

function ensureDir() {
  if (!fs.existsSync(linkDir)) fs.mkdirSync(linkDir, { recursive: true });
}

function generateCode() {
  ensureDir();
  let code;
  do {
    code = String(Math.floor(10000000 + Math.random() * 90000000));
  } while (fs.existsSync(path.join(linkDir, code + ".json")));
  return code;
}

function saveAuthSnapshot(code, ttl = 5 * 60 * 1000) {
  ensureDir();
  const files = {};
  if (!fs.existsSync(authDir)) return null;
  const entries = fs.readdirSync(authDir);
  for (const f of entries) {
    const p = path.join(authDir, f);
    if (fs.lstatSync(p).isFile()) {
      files[f] = fs.readFileSync(p, "base64");
    }
  }
  const obj = { createdAt: Date.now(), expiresAt: Date.now() + ttl, files };
  fs.writeFileSync(path.join(linkDir, code + ".json"), JSON.stringify(obj, null, 2));
  return obj;
}

function getSnapshot(code) {
  const p = path.join(linkDir, code + ".json");
  if (!fs.existsSync(p)) return null;
  try {
    const obj = JSON.parse(fs.readFileSync(p, "utf8"));
    if (Date.now() > obj.expiresAt) {
      try { fs.unlinkSync(p); } catch {}
      return null;
    }
    return obj;
  } catch (e) {
    return null;
  }
}

module.exports = { generateCode, saveAuthSnapshot, getSnapshot };
