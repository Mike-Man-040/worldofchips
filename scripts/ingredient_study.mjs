// "What's in a bag of chips?" — ingredient study built from data/chips/off.json
// (Open Food Facts nightly export of 16 Nov 2026, ODbL). Used by:
//   guides_more.mjs     the /whats-in-a-bag-of-chips/ page
//   build_chip_db.mjs   data/chips/export/ingredients-by-country.csv
// Counts are of products listed in Open Food Facts, not sales. A product counts in every
// study country it is tagged with. Ingredient lists are matched as printed (English,
// Dutch, Spanish, French, German), after removing negated claims such as "no added MSG".
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const STUDY_DATE = '2026-11-16';
export const STUDY_COUNTRIES = [
  ['united-states', 'United States'],
  ['united-kingdom', 'United Kingdom'],
  ['netherlands', 'Netherlands'],
  ['mexico', 'Mexico'],
];
// France is left out: most of its records are UK supermarket products also tagged France.

const L = 'a-zà-ÿ';
const NEG = new RegExp(`\\b(?:no added|no|free from|without|zonder(?: toegevoegde?)?|sin(?: a[nñ]adidos?)?|sans(?: ajout de)?)\\s+(?:[${L}]+\\s+){0,2}?(?:msg|sugars?|monosodium glutamate|palm oil|suiker|az[uú]car|sucre|glutamate|artificial colou?rs)\\b`, 'g');

export const MEASURES = [
  { key: 'msg', label: 'MSG (monosodium glutamate, E621)', re: /mono\w*\s*-?\s*glut\w*|natrium\s*glutama\w*|natriumglutama\w*|glutamato monos[oó]dico|glutamate monosodique|\bmsg\b|\b(?:e|ins) ?621\b|l-glutamate/ },
  { key: 'yeast', label: 'Yeast extract', re: /yeast extract|gistextract|extracto de levadura|extrait de levure/ },
  { key: 'sugar', label: 'Sugar or dextrose', re: /\bsugars?\b|\bsuiker\b|az[uú]car(?:es)?\b|\bdextrose\b|\bdextrosa\b|\bsucre\b/ },
  { key: 'sunflower', label: 'Sunflower oil', re: /sunflower|zonnebloem|girasol|tournesol/ },
  { key: 'rapeseed', label: 'Rapeseed (canola) oil', re: /rapeseed|canola|koolzaad|raapzaad|colza/ },
  { key: 'cottonseed', label: 'Cottonseed oil', re: /cottonseed|algod[oó]n/ },
  { key: 'palm', label: 'Palm oil', re: /\bpalm\b|palmolie|\bpalma\b/ },
];

function normalise(text) { return String(text).toLowerCase().replace(NEG, ' '); }

// Rough ingredient count: drop bracketed sub-ingredients, split on commas, semicolons,
// middle dots and spaced dashes, keep pieces that contain a letter.
export function ingredientCount(text) {
  const t = String(text).replace(/\[[^\]]*\]|\([^)]*\)/g, '').replace(/·/g, ',').replace(/;/g, ',').replace(/ - /g, ',');
  return t.split(',').map((x) => x.trim()).filter((x) => new RegExp(`[${L}]`).test(x.toLowerCase())).length;
}

// Wilson 95% interval, in percent, one decimal.
export function wilson(k, n) {
  if (!n) return [0, 0];
  const z = 1.96, p = k / n, d = 1 + z * z / n;
  const c = (p + z * z / (2 * n)) / d, h = (z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / d;
  return [Math.round(Math.max(0, c - h) * 1000) / 10, Math.round(Math.min(1, c + h) * 1000) / 10];
}
const pct = (k, n) => Math.round((1000 * k) / n) / 10;
function median(a) {
  const s = [...a].sort((x, y) => x - y), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

let cached = null;
export function ingredientStudy() {
  if (cached) return cached;
  const off = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'chips', 'off.json'), 'utf8'));
  const ids = new Set();
  const rows = STUDY_COUNTRIES.map(([slug, name]) => {
    const ps = off.filter((p) => p.ingredients_text && p.ingredients_text.text && p.countries_sold.some((c) => c.country === slug));
    ps.forEach((p) => ids.add(p.id));
    const n = ps.length;
    const counts = Object.fromEntries(MEASURES.map((m) => [m.key, 0]));
    const items = [];
    let plain = 0;
    for (const p of ps) {
      const t = normalise(p.ingredients_text.text);
      for (const m of MEASURES) if (m.re.test(t)) counts[m.key] += 1;
      const k = ingredientCount(p.ingredients_text.text);
      items.push(k);
      if (k <= 3) plain += 1;
    }
    const measures = Object.fromEntries(MEASURES.map((m) => [m.key, { count: counts[m.key], pct: pct(counts[m.key], n), ci: wilson(counts[m.key], n) }]));
    return { slug, name, n, median_ingredients: median(items), plain: { count: plain, pct: pct(plain, n), ci: wilson(plain, n) }, measures };
  });
  cached = { date: STUDY_DATE, unique_products: ids.size, rows };
  return cached;
}

export function ingredientStudyCsv() {
  const s = ingredientStudy();
  const head = ['country', 'products', 'median_ingredients', 'plain_count', 'plain_pct'];
  for (const m of MEASURES) head.push(`${m.key}_count`, `${m.key}_pct`, `${m.key}_ci95_low`, `${m.key}_ci95_high`);
  const lines = [head.join(',')];
  for (const r of s.rows) {
    const cells = [r.slug, r.n, r.median_ingredients, r.plain.count, r.plain.pct];
    for (const m of MEASURES) { const v = r.measures[m.key]; cells.push(v.count, v.pct, v.ci[0], v.ci[1]); }
    lines.push(cells.join(','));
  }
  return `# World of Chips ingredient study, Open Food Facts export of ${s.date}. Counts of listed products, not sales. ODbL 1.0: contains information from Open Food Facts. Method: https://worldofchips.com/whats-in-a-bag-of-chips/\n${lines.join('\n')}\n`;
}
