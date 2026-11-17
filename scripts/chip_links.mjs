// Links from editorial pages into the chip database's indexed pages.
// Reads data/chips/indexed.json, written by scripts/build_chip_db.mjs (run that first).
// Used by build_country_pages.mjs (country guides) and guides_more.mjs (flavour pages).
// A section appears only when at least MIN indexed products match; otherwise it returns ''.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'data', 'chips', 'indexed.json');
const MIN = 3;
const SHOW = 12;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
let cache = null;
function load() {
  if (!cache) cache = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  return cache;
}

// Spread the picks across brands: one per brand in turn, names sorted within each brand.
// Names of one word (often just the brand) say little, so skip them when there are enough others.
function pick(products) {
  const named = products.filter((p) => p.name.split(/\s+/).length >= 2);
  const pool = named.length >= SHOW ? named : products;
  const groups = new Map();
  for (const p of [...pool].sort((a, b) => a.name.localeCompare(b.name))) {
    if (!groups.has(p.brand_slug)) groups.set(p.brand_slug, []);
    groups.get(p.brand_slug).push(p);
  }
  const order = [...groups.keys()].sort((a, b) => groups.get(b).length - groups.get(a).length || a.localeCompare(b));
  const out = [];
  while (out.length < SHOW && order.some((k) => groups.get(k).length)) {
    for (const k of order) {
      const g = groups.get(k);
      if (g.length && out.length < SHOW) out.push(g.shift());
    }
  }
  return out;
}

function section({ id, heading, lead, products, brands }) {
  const shown = pick(products);
  const more = products.length > shown.length
    ? `Showing ${shown.length} of ${products.length}. `
    : '';
  const brandRow = brands.length
    ? `\n      <p style="margin-top:1rem"><strong>Brand pages:</strong> ${brands.map((b) => `<a href="${b.url}">${esc(b.name)}</a>`).join(', ')}</p>`
    : '';
  return `
    <section class="cp-section" id="${id}">
      <h2>${heading}</h2>
      <p>${lead}</p>
      <div class="cp-explore-grid">${shown.map((p) => `<a href="${p.url}" class="cp-explore-link">${esc(p.name)}</a>`).join('')}</div>${brandRow}
      <p style="margin-top:1rem">${more}<a href="/chips/">Search the full chip database &#8594;</a></p>
    </section>
`;
}

// Brand hubs with at least MIN of these products, most products first, at most SHOW.
function brandsFor(products) {
  const { brands } = load();
  const n = new Map();
  for (const p of products) n.set(p.brand_slug, (n.get(p.brand_slug) || 0) + 1);
  return brands
    .filter((b) => (n.get(b.slug) || 0) >= MIN)
    .sort((a, b) => n.get(b.slug) - n.get(a.slug) || a.name.localeCompare(b.name))
    .slice(0, SHOW);
}

export function countryChipsSection(slug, displayName) {
  const products = load().products.filter((p) => p.countries.includes(slug));
  if (products.length < MIN) return '';
  return section({
    id: 'chip-database',
    heading: `Chips Sold in ${esc(displayName)}: From Our Database`,
    lead: `${products.length} chips in our database are recorded as sold in ${esc(displayName)}. Each page lists the ingredients, pack size and barcode, with sources. Check the pack; recipes change.`,
    products,
    brands: brandsFor(products),
  });
}

export function flavourChipsSection(flavourSlug, label) {
  const products = load().products.filter((p) => p.flavour_family === flavourSlug);
  if (products.length < MIN) return '';
  return section({
    id: 'chip-database',
    heading: `${label} Chips in Our Database`,
    lead: `${products.length} ${label.toLowerCase()} chips in our database, with ingredients, pack sizes and where each is sold. Check the pack; recipes change.`,
    products,
    brands: brandsFor(products),
  });
}
