import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { verifySession } from './sessions.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });
const adminFile = path.join(dataDir, 'admin.json');

function loadAdminHash() {
  if (fs.existsSync(adminFile)) {
    try {
      return JSON.parse(fs.readFileSync(adminFile, 'utf8')).hash;
    } catch {
      // fall through to reseed below
    }
  }
  const plain = process.env.ADMIN_PASSWORD;
  if (!plain) {
    throw new Error(
      'No admin password set. Set ADMIN_PASSWORD in server/.env before the first run, ' +
      'or delete server/data/admin.json to reseed it.'
    );
  }
  const hash = bcrypt.hashSync(plain, 10);
  fs.writeFileSync(adminFile, JSON.stringify({ hash }, null, 2));
  return hash;
}

let cachedHash = loadAdminHash();

export function verifyAdminPassword(candidate) {
  return typeof candidate === 'string' && candidate.length > 0 && bcrypt.compareSync(candidate, cachedHash);
}

export function changeAdminPassword(newPlain) {
  cachedHash = bcrypt.hashSync(newPlain, 10);
  fs.writeFileSync(adminFile, JSON.stringify({ hash: cachedHash }, null, 2));
}

function bearerToken(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

export function requireAdmin(req, res, next) {
  if (verifySession(bearerToken(req))) return next();
  res.status(401).json({ error: 'not_admin' });
}

export function isAdminRequest(req) {
  return verifySession(bearerToken(req));
}
