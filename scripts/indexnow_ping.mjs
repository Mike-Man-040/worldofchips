#!/usr/bin/env node
// Submit every sitemap URL to IndexNow (Bing, Yandex, Seznam, Naver, ... share submissions).
// Run AFTER the key file /<key>.txt is live on https://worldofchips.com (i.e. after deploy).
// Usage: node scripts/indexnow_ping.mjs [--dry-run]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOST = 'worldofchips.com';
const KEY = '70db554b0a1ac11d64c90d0d452d821e';
const keyFile = path.join(ROOT, `${KEY}.txt`);
if (!fs.existsSync(keyFile) || fs.readFileSync(keyFile, 'utf8').trim() !== KEY) throw new Error(`${KEY}.txt missing or wrong`);

const urlList = [...fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const body = { host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList };
if (process.argv.includes('--dry-run')) { console.log(JSON.stringify(body, null, 2)); process.exit(0); }

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify(body),
});
console.log(`IndexNow: HTTP ${res.status} for ${urlList.length} URLs`);
if (res.status >= 400) { console.error(await res.text()); process.exit(1); }
