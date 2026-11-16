#!/usr/bin/env node
// Chip database. Reads data/chips/records.json, data/chips/off.json, and
// data/chips/mfds-kr.json. Writes public pages at /chips/<brand>/<product>/,
// /brands/<brand>/, and /chips/, plus the ODbL export and sitemap-chips.xml.
// A product page is indexable only when completeness is 60 or more and an
// ingredient text is present. Korean Ministry rows stay noindex and out of the
// ODbL files. Does not edit the nav, country pages, flavour pages, sitemap.xml,
// or /pringles-index/. Leaves /chips/_preview/aisle/ alone.
//
//   node scripts/build_chip_db.mjs           write files
//   node scripts/build_chip_db.mjs --check   exit 1 if the generated files are stale
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tagFor, snackBoxLead, daebakBox, bolBox } from './affiliate_tags.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://worldofchips.com';
const CHECK = process.argv.includes('--check');
const PREVIEW = 'chips/_preview';
const CHIP_TAG = tagFor('guides'); // existing section tag. No new Associates id.
const INDEX_MIN = 60;
// A public product page is indexable only when both are true. Ministry rows stay noindex either way.
function hasIngredients(p) {
  return !!(p.ingredients_text && String(p.ingredients_text.text || '').trim());
}
function publicIndexable(p, score) {
  return score >= INDEX_MIN && hasIngredients(p);
}
function pageNoindex(p, score) {
  return isMfds(p) || !publicIndexable(p, score);
}
const RECORDS_PATH = path.join(ROOT, 'data', 'chips', 'records.json');
const OFF_PATH = path.join(ROOT, 'data', 'chips', 'off.json');
const MFDS_PATH = path.join(ROOT, 'data', 'chips', 'mfds-kr.json');
const MFDS_URL = 'https://various.foodsafetykorea.go.kr/nutrient/general/down/list.do';
const UNSTATED_LICENCE = 'unstated (government data, used with attribution)';
const MFDS_CREDIT = 'Source: Ministry of Food and Drug Safety (식품의약품안전처), processed food nutrient database';

const FLAVOURS = ['prawn-cocktail', 'ketchup', 'salt-and-vinegar', 'sour-cream-and-onion', 'paprika', 'nori-seaweed', 'bbq', 'dill-pickle', 'flamin-hot', 'cheese-and-onion'];
const FLAVOUR_LABEL = {
  'prawn-cocktail': 'Prawn Cocktail',
  ketchup: 'Ketchup',
  'salt-and-vinegar': 'Salt & Vinegar',
  'sour-cream-and-onion': 'Sour Cream & Onion',
  paprika: 'Paprika',
  'nori-seaweed': 'Nori / Seaweed',
  bbq: 'BBQ',
  'dill-pickle': 'Dill Pickle',
  'flamin-hot': "Flamin' Hot",
  'cheese-and-onion': 'Cheese & Onion',
};
const TYPES = ['potato-chip', 'stacked', 'kettle', 'ridged', 'tortilla'];
const TYPE_LABEL = {
  'potato-chip': 'potato chip',
  stacked: 'stacked potato chip',
  kettle: 'kettle-cooked potato chip',
  ridged: 'ridged potato chip',
  tortilla: 'tortilla chip',
};
const STATUS = ['current', 'limited', 'discontinued', 'unknown'];
// Rungs from the spice ladder in scripts/guides_more.mjs. heat_level is that rung, or null.
const SPICE_LADDER = {
  'cape-cod-sweet-spicy-jalapeno': 1,
  'chips-jalapeno-barcel': 2,
  'ruffles-flamin-hot': 3,
  'pringles-hot-ones-los-calientes-rojo': 4,
  'takis-fuego': 5,
  'takis-blue-heat': 6,
  'route-11-mama-zumas-revenge': 7,
  'lowcountry-kettle-carolina-reaper': 8,
  'paqui-haunted-ghost-pepper': 9,
  'red-hot-reaper-chip-challenge': 10,
  'paqui-one-chip-challenge': 11,
};
const COUNTRY = {
  'united-states': 'United States',
  'united-kingdom': 'United Kingdom',
  japan: 'Japan',
  'south-korea': 'South Korea',
  netherlands: 'Netherlands',
  mexico: 'Mexico',
  canada: 'Canada',
  belgium: 'Belgium',
  bolivia: 'Bolivia',
  ireland: 'Ireland',
  peru: 'Peru',
  australia: 'Australia',
  france: 'France',
  germany: 'Germany',
  spain: 'Spain',
  italy: 'Italy',
  sweden: 'Sweden',
  poland: 'Poland',
  brazil: 'Brazil',
  india: 'India',
  china: 'China',
  thailand: 'Thailand',
  indonesia: 'Indonesia',
  argentina: 'Argentina',
  colombia: 'Colombia',
  peru: 'Peru',
  nigeria: 'Nigeria',
  egypt: 'Egypt',
  turkey: 'Turkey',
  'south-africa': 'South Africa',
  russia: 'Russia',
  'new-zealand': 'New Zealand',
};
const SHIPS = {
  'universal-yums': new Set(['united-states', 'canada']),
  bol: new Set(['netherlands', 'belgium']),
  daebak: null,
  amazon: null,
};
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DIETARY = /\b(vegan|vegetarians?|halal|kosher|gluten[\s-]?free|dairy[\s-]?free|lactose[\s-]?free|nut[\s-]?free|sugar[\s-]?free|fat[\s-]?free|non[\s-]?gmo|organic|keto|paleo)\b/i;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const longDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
};
const countryName = (slug) => COUNTRY[slug] || slug.replace(/-/g, ' ');
const between = (src, start, end) => {
  const a = src.indexOf(start);
  if (a < 0) throw new Error(`Marker not found: ${start}`);
  const b = src.indexOf(end, a + start.length);
  if (b < 0) throw new Error(`End marker not found after ${start}`);
  return src.slice(a, b);
};

function die(msg) { throw new Error(`chip-db: ${msg}`); }

function scoreOf(p) {
  const parts = [
    ['name_en', 10, !!p.name_en],
    ['name_local', 8, !!p.name_local],
    ['brand', 8, !!p.brand],
    ['parent_company', 6, !!p.parent_company],
    ['barcodes', 8, p.barcodes.length > 0],
    ['type', 6, TYPES.includes(p.type)],
    ['flavour_family', 6, !!p.flavour_family],
    ['countries_sold', 12, p.countries_sold.length > 0],
    ['equivalents', 10, p.equivalents.length > 0],
    ['pack_sizes_g', 6, p.pack_sizes_g.length > 0],
    ['ingredients_text', 10, !!(p.ingredients_text && p.ingredients_text.text)],
    ['image', 6, !!(p.image && !p.image.placeholder && p.image.credit && p.image.licence && p.image.source)],
    ['where_to_buy', 4, p.where_to_buy.length > 0],
  ];
  const total = parts.reduce((n, [, w, ok]) => n + (ok ? w : 0), 0);
  if (parts.reduce((n, [, w]) => n + w, 0) !== 100) die('completeness weights must sum to 100');
  return { total, parts };
}

function loadRecords() {
  const records = JSON.parse(fs.readFileSync(RECORDS_PATH, 'utf8'));
  if (!Array.isArray(records) || records.length < 1) die('records.json must be a non-empty array');
  if (!fs.existsSync(OFF_PATH)) die('missing data/chips/off.json');
  const off = JSON.parse(fs.readFileSync(OFF_PATH, 'utf8'));
  if (!Array.isArray(off) || off.length < 1) die('off.json must be a non-empty array');
  records.push(...off);
  if (!fs.existsSync(MFDS_PATH)) die('missing data/chips/mfds-kr.json');
  const mfds = JSON.parse(fs.readFileSync(MFDS_PATH, 'utf8'));
  if (!Array.isArray(mfds) || mfds.length < 1) die('mfds-kr.json must be a non-empty array');
  records.push(...mfds);
  const ids = new Set();
  const paths = new Set();
  const titles = new Set();
  for (const p of records) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.id)) die(`${p.id}: bad id`);
    if (ids.has(p.id)) die(`duplicate id ${p.id}`);
    ids.add(p.id);
    const key = `${p.brand_slug}/${p.slug}`;
    if (paths.has(key)) die(`reused slug ${key}`);
    paths.add(key);
    if (!p.title || p.title.length > 65) die(`${p.id}: title missing or longer than 65 (${p.title && p.title.length})`);
    if (titles.has(p.title)) die(`duplicate title ${p.title}`);
    titles.add(p.title);
    if (!p.description || p.description.length < 40) die(`${p.id}: description too short`);
    if (!TYPES.includes(p.type)) die(`${p.id}: bad type`);
    if (p.flavour_family != null && !FLAVOURS.includes(p.flavour_family)) die(`${p.id}: flavour_family is not in the site taxonomy`);
    if (!STATUS.includes(p.status)) die(`${p.id}: bad status`);
    const rung = SPICE_LADDER[p.id];
    if (p.heat_level == null) {
      if (rung) die(`${p.id}: this id is spice-ladder rung ${rung}; set heat_level or remove it from the ladder map`);
    } else if (rung !== p.heat_level) {
      die(`${p.id}: heat_level ${p.heat_level} does not match spice-ladder rung ${rung == null ? 'none' : rung}`);
    }
    if (p.price_per_100g != null) {
      const price = p.price_per_100g;
      for (const k of ['country', 'amount', 'currency', 'source', 'checked']) if (price[k] == null || price[k] === '') die(`${p.id}: price_per_100g missing ${k}`);
      if (/pringles-index|worldofchips\.com/i.test(price.source)) die(`${p.id}: price source must be a retailer, not the Pringles Index`);
      if (!DATE_RE.test(price.checked)) die(`${p.id}: price date`);
    }
    for (const c of p.countries_sold) {
      if (!c.country || !c.source || !DATE_RE.test(c.checked)) die(`${p.id}: country row needs country, source, checked`);
    }
    for (const e of p.equivalents) {
      if (!e.name || !e.note || !e.source || !DATE_RE.test(e.checked)) die(`${p.id}: equivalent missing fields`);
      if (e.id != null && !ids.has(e.id) && !records.some((r) => r.id === e.id)) die(`${p.id}: equivalent id ${e.id} is not a record`);
    }
    for (const row of p.where_to_buy) {
      if (!row.channels || !row.channels.length) die(`${p.id}: where_to_buy needs a channel`);
      if (!row.channels.includes('amazon')) die(`${p.id}: where_to_buy should include an Amazon search behind any partner link`);
      for (const ch of row.channels) {
        if (!Object.prototype.hasOwnProperty.call(SHIPS, ch)) die(`${p.id}: unknown channel ${ch}`);
        const allow = SHIPS[ch];
        if (allow && !allow.has(row.country)) die(`${p.id}: ${ch} does not ship to ${row.country}`);
      }
    }
    if (!p.sources || !p.sources.length) die(`${p.id}: sources required`);
    for (const s of p.sources) if (!s.field || !s.url || !DATE_RE.test(s.checked)) die(`${p.id}: source needs field, url, checked`);
    if (p.ingredients_text) {
      if (!p.ingredients_text.text || !p.ingredients_text.source || !DATE_RE.test(p.ingredients_text.checked)) die(`${p.id}: ingredients need text, source, checked`);
    }
    const img = p.image;
    for (const f of ['file', 'alt', 'licence', 'licence_url', 'credit', 'source']) if (!img || !img[f]) die(`${p.id}: image missing ${f}`);
    if (img.photo_host === 'openfoodfacts') {
      if (img.licence !== 'CC BY-SA 3.0') die(`${p.id}: an Open Food Facts photo must stay CC BY-SA 3.0`);
      if (img.placeholder) die(`${p.id}: an Open Food Facts photo is not a placeholder`);
      if (!fs.existsSync(path.join(ROOT, 'assets', 'photos', `${img.file}-480.webp`))) die(`${p.id}: missing assets/photos/${img.file}-480.webp`);
    } else {
      for (const suffix of [`${img.file}-960.webp`, `${img.file}-480.webp`]) {
        if (!fs.existsSync(path.join(ROOT, 'assets', 'photos', suffix))) die(`${p.id}: missing assets/photos/${suffix}`);
      }
      if (!fs.existsSync(path.join(ROOT, 'assets', 'photos', `og-${img.file}.jpg`))) die(`${p.id}: missing og image for ${img.file}`);
    }
    if (p.certifications) {
      for (const c of p.certifications) {
        if (!c.label || !c.source || !DATE_RE.test(c.checked)) die(`${p.id}: certification needs label, source, checked`);
      }
    }
    const fromMfds = (p.sources || []).some((s) => s.url === MFDS_URL) || p.source_licence === UNSTATED_LICENCE;
    if (fromMfds) {
      if (p.source_licence !== UNSTATED_LICENCE) die(`${p.id}: a Ministry row needs source_licence "${UNSTATED_LICENCE}"`);
      if (!(p.sources || []).length || !(p.sources || []).every((s) => s.url === MFDS_URL && s.checked === '2026-11-16')) {
        die(`${p.id}: every Ministry citation needs ${MFDS_URL} checked 2026-11-16`);
      }
      if (p.ingredients_text) die(`${p.id}: a Ministry row has no ingredient list`);
      if (!p.image || p.image.placeholder !== true) die(`${p.id}: a Ministry row uses the photo placeholder`);
      if (!p.product_report_number) die(`${p.id}: item report number is required`);
      const nut = p.nutrition_per_100g;
      if (!nut || nut.basis !== '100g' || nut.source !== MFDS_URL || nut.checked !== '2026-11-16') die(`${p.id}: nutrition must be per 100 g from the Ministry file`);
      for (const k of ['energy_kcal', 'protein_g', 'fat_g', 'carbohydrate_g', 'sugars_g', 'sodium_mg', 'saturated_fat_g', 'trans_fat_g']) {
        if (typeof nut[k] !== 'number') die(`${p.id}: nutrition ${k} must be a number`);
      }
    }
    // name_local, manufacturer and importer are the source's own words, same as an ingredient quote.
    const proseObj = { ...p, ingredients_text: null, name_local: null, manufacturer: null, importer: null, certifications: null };
    if (String(p.id).startsWith('off-')) proseObj.name_en = null;
    if (p.brand && DIETARY.test(p.brand) && String(p.id).startsWith('off-')) proseObj.brand = null;
    const prose = JSON.stringify(proseObj);
    const hit = prose.match(DIETARY);
    if (hit) die(`${p.id}: dietary wording "${hit[0]}" outside a source quotation. Quote a certification as "labelled as" only when the pack shows it.`);
  }
  return records;
}

function plainPublic(text) {
  const raw = String(text || '');
  if (!DIETARY.test(raw) && !/[&<>"]/.test(raw)) return raw;
  const cleaned = raw.replace(DIETARY, ' ').replace(/[&<>"]/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned || 'potato crisps';
}
function quoted(text) {
  if (text == null || text === '') return '';
  if (DIETARY.test(text)) return `<span class="chip-source-text">${esc(text)}</span>`;
  return esc(text);
}
function figure(img, eager) {
  const big = `/assets/photos/${img.file}-960.webp`;
  const small = `/assets/photos/${img.file}-480.webp`;
  if (img.placeholder) {
    return `<figure class="woc-photo chip-photo-placeholder" data-photo="placeholder">
  <img src="${big}" width="${img.width}" height="${img.height}" alt="${esc(img.alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">
  <figcaption>No product photograph is available.</figcaption>
</figure>`;
  }
  const lic = img.licence === 'Public domain'
    ? 'public domain'
    : `<a href="${esc(img.licence_url)}" target="_blank" rel="nofollow noopener">${esc(img.licence)}</a>`;
  const resized = /BY/.test(img.licence) ? ', resized' : '';
  if (img.photo_host === 'openfoodfacts') {
    return `<figure class="woc-photo" data-photo="openfoodfacts">
  <img src="${small}" width="${img.width}" height="${img.height}" alt="${esc(img.alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">
  <figcaption>Photo: <a href="${esc(img.source)}" target="_blank" rel="nofollow noopener">${esc(img.credit)}</a> via Open Food Facts, ${lic}${resized}.</figcaption>
</figure>
<p class="sb-muted">Packaging in the photograph is a trademark of its owner. The photo licence is not a trademark licence. This file is a resized copy and stays under the same CC BY-SA licence.</p>`;
  }
  return `<figure class="woc-photo">
  <img src="${big}" width="${img.width}" height="${img.height}" alt="${esc(img.alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">
  <figcaption>Photo: <a href="${esc(img.source)}" target="_blank" rel="nofollow noopener">${esc(img.credit)}</a> via Wikimedia Commons, ${lic}${resized}.</figcaption>
</figure>
<p class="sb-muted">Packaging in the photograph is a trademark of its owner. The photo licence is not a trademark licence.</p>`;
}

function amazonLink(query, label) {
  // Percent-encode the query so an apostrophe cannot truncate the URL in the site validator.
  const k = encodeURIComponent(query.trim()).replace(/%20/g, '+').replace(/'/g, '%27');
  const href = `https://www.amazon.com/s?k=${k}&tag=${CHIP_TAG}`;
  return `<a href="${esc(href)}" target="_blank" rel="sponsored nofollow noopener" class="buy-btn">${label}</a>`;
}

function countryLink(slug) {
  const name = countryName(slug);
  const page = path.join(ROOT, slug, 'index.html');
  return fs.existsSync(page) ? `<a href="/${slug}/">${esc(name)}</a>` : esc(name);
}

const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const siteNav = between(indexHtml, '<!-- SITE-NAV:START', '<!-- SITE-NAV:END -->') + '<!-- SITE-NAV:END -->';
const gaSnippet = between(indexHtml, '<!-- Google tag (gtag.js) -->', '<meta charset').trim();
const fontsLink = (indexHtml.match(/<link href="https:\/\/fonts\.googleapis\.com[^>]*>/) || [])[0];
const footerHtml = between(indexHtml, '<footer>', '</footer>') + '</footer>';
const mlUniversal = between(indexHtml, '<!-- MailerLite Universal -->', '<!-- End MailerLite Universal -->') + '<!-- End MailerLite Universal -->';
const nlFormRaw = between(indexHtml, '<!-- NEWSLETTER-FORM:START', '<!-- NEWSLETTER-FORM:END -->');
const nlForm = nlFormRaw.slice(nlFormRaw.indexOf('-->') + 3).split('\n').map((l) => l.replace(/^ {4}/, '')).join('\n').trim();
const DISCLOSURE = 'As an Amazon Associate, World of Chips earns from qualifying purchases. Links marked &#8220;on Amazon&#8221; are affiliate links. Partner boxes above Amazon are affiliate links too, where that programme is already used on this site. This doesn&#8217;t affect the sourced facts.';

const PAGE_CSS = `<style>
.nav-logo a{color:inherit;text-decoration:none;display:flex;align-items:center;gap:.5rem}
.cp-crumbs{font-size:.75rem;color:var(--muted);margin-bottom:1rem}
.cp-crumbs a{color:var(--gold);text-decoration:none}
.cp-intro-dark{color:var(--muted);max-width:640px;margin:1rem auto 0;font-size:.95rem}
.chip-review{background:#3d2914;color:#fff8e8;margin:0;padding:.65rem 1rem;text-align:center;font-size:.85rem}
.chip-review a{color:#f0c36a}
.shop-top{background:var(--paper);border:2px solid var(--gold);border-radius:14px;padding:1.3rem 1.4rem;margin:1.2rem 0 1.6rem;text-align:center;box-shadow:0 6px 18px rgba(232,168,56,.18)}
.shop-top h2{margin-bottom:.4rem}
.shop-top p{margin:.3rem 0}
.buy-btn.buy-btn-lg{justify-content:center;min-height:58px;font-size:1.15rem;padding:1rem 2.4rem;margin:.7rem 0 .4rem;box-shadow:0 4px 12px rgba(196,138,32,.35)}
@media(max-width:600px){.buy-btn.buy-btn-lg{display:flex;width:100%}}
.snack-more{margin:.7rem auto 0;max-width:34rem;text-align:left}
.snack-more summary{cursor:pointer;font-weight:700;color:var(--brown)}
.snack-more .buy-btn{margin-top:.35rem}
.gd-picks a,.cp-section a{color:#1A4570}
.buy-btn{display:inline-flex;align-items:center;min-height:48px;background:var(--gold);color:#fff;font-weight:700;padding:.8rem 1.5rem;border-radius:999px;text-decoration:none;font-size:.98rem}
.buy-btn:hover{filter:brightness(1.08)}
.sb-table-wrap{overflow-x:auto;margin-top:1rem;border:1px solid var(--light-border);border-radius:12px}
.sb-table{border-collapse:collapse;width:100%;min-width:520px;font-size:.85rem;background:var(--paper)}
.sb-table th,.sb-table td{padding:.65rem .7rem;text-align:left;vertical-align:top;border-bottom:1px solid var(--light-border)}
.sb-table thead th{background:var(--dark);color:var(--cream);font-size:.72rem;text-transform:uppercase;letter-spacing:.06em}
.sb-muted{color:var(--muted);font-size:.85em;margin-top:.6rem}
.sb-sources{font-size:.78rem;color:var(--muted);margin-top:.4rem;word-break:break-word}
.sb-sources a{color:var(--muted)}
.chip-ingredients{background:var(--paper);border-left:4px solid var(--gold);margin:1rem 0;padding:.8rem 1rem;font-size:.92rem;white-space:pre-wrap}
.chip-pack{font-weight:700;color:var(--brown)}
.woc-photo{overflow:visible}
.woc-photo img{width:auto;max-width:100%;max-height:460px;height:auto;aspect-ratio:auto;object-fit:contain;display:block;margin:0 auto}
.chip-search{width:100%;max-width:36rem;font:inherit;font-size:1rem;padding:.8rem 1rem;border:2px solid var(--gold);border-radius:999px;background:var(--paper)}
.chip-list{display:grid;gap:.7rem;margin-top:1rem}
.chip-list a{display:block;background:var(--paper);border:1px solid var(--light-border);border-radius:12px;padding:.9rem 1rem;text-decoration:none;color:inherit}
.chip-list strong{display:block;color:var(--brown);font-family:'Playfair Display',serif;font-size:1.05rem}
.chip-list span{color:var(--muted);font-size:.85rem}
.chip-source-credit{background:#fff8e8;border:2px solid var(--gold);border-radius:12px;padding:.8rem 1rem;margin:0 0 1rem;font-weight:700;color:var(--brown)}
.chip-photo-placeholder{background:var(--paper);border:1px dashed var(--gold);border-radius:12px;padding:1rem}
</style>`;

function shell({ title, description, canonical, image, imageAlt, imageWidth, imageHeight, jsonLd, body, noindex }) {
  const nl = `<aside class="nl nl-compact" id="newsletter" aria-labelledby="nl-title">
<h2 id="nl-title">Get the monthly Chip Report</h2>
<p class="nl-pitch">New and weird chips from around the world, once a month. No spam.</p>
${nlForm}
</aside>`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
${gaSnippet}
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="${noindex ? 'noindex, follow' : 'index, follow'}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="article">
<meta property="og:url" content="${canonical}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:site_name" content="World of Chips">
<meta property="og:image" content="${SITE}${image}">
<meta property="og:image:width" content="${imageWidth || 1200}">
<meta property="og:image:height" content="${imageHeight || 630}">
<meta property="og:image:alt" content="${esc(imageAlt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}${image}">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<script type="application/ld+json">
${JSON.stringify(jsonLd)}
</script>
${fontsLink}
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="stylesheet" href="/assets/site.css">
<link rel="stylesheet" href="/assets/extras.css">
${PAGE_CSS}
${mlUniversal}
</head>
<body>
${siteNav}
<main>
${body}
</main>
${footerHtml}
</body>
</html>
`;
}

function crumbs(items) {
  const html = items.map((it, i) => {
    const name = it.html ? it.name : esc(it.name);
    return i === items.length - 1
    ? `<span>${name}</span>`
    : `<a href="${it.href}">${name}</a>`;
  }).join(' &#8250; ');
  return `<nav class="cp-crumbs" aria-label="Breadcrumb">${html}</nav>`;
}

function breadcrumbLd(items) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem', position: i + 1, name: it.plain || it.name, item: it.href.startsWith('http') ? it.href : `${SITE}${it.href}`,
    })),
  };
}

function productPath(p) { return `/chips/${p.brand_slug}/${p.slug}/`; }
function brandPath(slug) { return `/brands/${slug}/`; }
function photoSrc(img) {
  if (img.photo_host === 'openfoodfacts') return { src: `/assets/photos/${img.file}-480.webp`, width: img.width, height: img.height };
  return { src: `/assets/photos/og-${img.file}.jpg`, width: 1200, height: 630 };
}
function productLabel(p) { return p.name_en || p.name_local; }
function itemName(p) {
  const name = productLabel(p);
  return p.brand ? `${p.brand} ${name}` : name;
}
function partyPlain(p) { return p.brand || p.manufacturer || p.importer || 'Maker'; }
function isMfds(p) { return p.source_licence === UNSTATED_LICENCE; }
function creditParagraph() { return `<p class="chip-source-credit">${esc(MFDS_CREDIT)}</p>`; }
function hubLabel(mine) {
  const brands = [...new Set(mine.map((p) => p.brand).filter(Boolean))];
  if (brands.length === 1 && mine.every((p) => !p.brand || p.brand === brands[0])) return brands[0];
  return mine[0].manufacturer || mine[0].importer || mine[0].brand_slug;
}
function titleSafe(text) {
  return String(text).replace(DIETARY, ' ').replace(/\s+/g, ' ').trim() || 'Maker';
}
function hubTitle(label) {
  const suffix = ' | World of Chips';
  const cleaned = titleSafe(label);
  const full = `${cleaned} Chip Records${suffix}`;
  if (full.length <= 65) return full;
  const shorter = `${cleaned} records${suffix}`;
  if (shorter.length <= 65) return shorter;
  const room = 65 - suffix.length - ' records'.length - 1;
  return `${cleaned.slice(0, Math.max(room, 1)).trim()}… records${suffix}`;
}
function hubDescription(label, indexable) {
  const tail = indexable
    ? 'Sourced chip records. Check the pack; recipes change.'
    : 'Sourced chip records. This page is noindex.';
  if (DIETARY.test(label)) {
    const text = `Records for this maker. ${tail}`;
    return text.length <= 200 ? text : tail;
  }
  const text = `Records for ${label}. ${tail}`;
  return text.length <= 200 ? text : `Records for this maker. ${tail}`;
}
function nutritionSection(p) {
  const n = p.nutrition_per_100g;
  if (!n) return '';
  const lines = [
    ['Energy', `${n.energy_kcal} kcal`],
    ['Protein', `${n.protein_g} g`],
    ['Fat', `${n.fat_g} g`],
    ['Carbohydrate', `${n.carbohydrate_g} g`],
    ['Sugars', `${n.sugars_g} g`],
    ['Sodium', `${n.sodium_mg} mg`],
    ['Saturated fat', `${n.saturated_fat_g} g`],
    ['Trans fat', `${n.trans_fat_g} g`],
  ];
  return `
    <section class="cp-section" id="nutrition">
      <h2>Nutrition per 100 g</h2>
      <div class="sb-table-wrap"><table class="sb-table"><tbody>
        ${lines.map(([k, v]) => `<tr><th scope="row">${k}</th><td>${esc(v)}</td></tr>`).join('\n        ')}
      </tbody></table></div>
      <p class="sb-muted">Copied per 100 g from the source checked ${esc(longDate(n.checked))}. The numbers are not a health claim.</p>
    </section>`;
}

function buySection(p) {
  return p.where_to_buy.map((row) => {
    const bits = [];
    if (row.channels.includes('universal-yums')) bits.push(snackBoxLead({ indent: '    ' }));
    if (row.channels.includes('daebak') && !row.channels.includes('universal-yums')) bits.push(daebakBox());
    if (row.channels.includes('bol')) bits.push(bolBox([{ n: plainPublic(itemName(p)), q: row.amazon_query }]));
    if (row.channels.includes('amazon')) {
      bits.push(`
    <p>${amazonLink(row.amazon_query, `Find ${quoted(itemName(p))} on Amazon &#8594;`)}</p>
    <p class="sb-muted">Amazon opens a search, not a single listing. Check the seller, the pack size and whether it ships to you.</p>`);
    }
    return `
    <section class="cp-section" id="buy-${row.country}">
      <h2>Where to buy: ${esc(countryName(row.country))}</h2>
      <p>A snack-box or shop link is a way to browse. It is not a claim that the box or the search result is this exact bag.</p>
      ${bits.join('\n')}
    </section>`;
  }).join('\n');
}

function productPage(p, all) {
  const score = scoreOf(p);
  const urlPath = productPath(p);
  const canonical = `${SITE}${urlPath}`;
  const brandHref = brandPath(p.brand_slug);
  const partyCrumb = {
    name: quoted(p.brand || partyPlain(p)),
    href: brandHref,
    html: true,
    plain: p.brand || partyPlain(p),
  };
  const crumbItems = [
    { name: 'Home', href: '/' },
    { name: 'Chip database', href: '/chips/' },
    partyCrumb,
    { name: quoted(productLabel(p)), href: urlPath, html: true, plain: productLabel(p) },
  ];
  const flavour = p.flavour_family
    ? `<a href="/flavors/${p.flavour_family}/">${esc(FLAVOUR_LABEL[p.flavour_family])}</a>`
    : 'Not one of the ten flavour pages';
  const heat = p.heat_level == null
    ? 'Not on the spice ladder'
    : `<a href="/spiciest-chips/">Rung ${p.heat_level} of 11</a>`;
  const packs = p.pack_sizes_g.length
    ? p.pack_sizes_g.map((s) => `${esc(countryName(s.country))}: ${s.grams} g`).join('<br>')
    : 'Not recorded';
  const bars = p.barcodes.length ? p.barcodes.map(esc).join(', ') : 'Not recorded';
  const parent = p.parent_company ? esc(p.parent_company) : 'Not recorded';
  const rows = [
    ['Brand', p.brand ? quoted(p.brand) : 'Not recorded'],
    ['Parent company', parent],
    ['Type', esc(TYPE_LABEL[p.type])],
    ['Flavour family', flavour],
    ['Spice ladder', heat],
    ['Barcodes', bars],
    ['Status', esc(p.status)],
    ['Pack size', packs],
    ['Price per 100 g', 'Not recorded'],
  ];
  if (p.manufacturer) rows.push(['Manufacturer', `<span class="chip-source-text">${esc(p.manufacturer)}</span>`]);
  if (p.importer) rows.push(['Importer', `<span class="chip-source-text">${esc(p.importer)}</span>`]);
  if (p.product_report_number) rows.push(['Item report', `<span class="chip-source-text">${esc(p.product_report_number)}</span>`]);
  const equivList = p.equivalents.length
    ? `<ul class="sb-list">${p.equivalents.map((e) => {
      const href = e.id ? productPath(all.find((r) => r.id === e.id)) : '';
      const name = href ? `<a href="${href}">${quoted(e.name)}</a>` : quoted(e.name);
      return `<li><strong>${name}</strong> (${esc(e.region)}). ${esc(e.note)} <span class="sb-muted">Source checked ${esc(longDate(e.checked))}.</span></li>`;
    }).join('')}</ul>`
    : '<p>No brand-name equivalent is recorded. A blank here means the sources we checked did not name one.</p>';
  const equivHtml = `<p class="chip-pack">These are brand names as stated by the sources. Recipes may differ.</p>\n      ${equivList}`;
  const soldRows = p.countries_sold.map((c) => `<tr><td>${countryLink(c.country)}</td><td><a href="${esc(c.source)}" target="_blank" rel="nofollow noopener">${esc(c.source.replace(/^https?:\/\//, ''))}</a></td><td>${esc(longDate(c.checked))}</td></tr>`).join('');
  const soldInner = p.countries_sold.length
    ? `<div class="sb-table-wrap"><table class="sb-table"><thead><tr><th>Country</th><th>Source</th><th>Checked</th></tr></thead><tbody>
        ${soldRows}
      </tbody></table></div>`
    : '<p>Not recorded.</p>';
  const ing = p.ingredients_text
    ? `<blockquote class="chip-ingredients">${esc(p.ingredients_text.text)}</blockquote>
      <p class="sb-muted">Copied from the source dated ${esc(longDate(p.ingredients_text.checked))}${p.ingredients_text.note ? `. ${esc(p.ingredients_text.note)}` : ''}</p>`
    : '<p>No ingredient text is recorded. The note in Sources says where we looked.</p>';
  const sourceItems = p.sources.map((s) => `<li><strong>${esc(s.field)}</strong>, checked ${esc(longDate(s.checked))}: <a href="${esc(s.url)}" target="_blank" rel="nofollow noopener">${esc(s.url)}</a>${s.note ? `. ${esc(s.note)}` : ''}</li>`).join('');
  const similar = [];
  if (p.flavour_family) similar.push(`<a href="/flavors/${p.flavour_family}/" class="cp-explore-link">${esc(FLAVOUR_LABEL[p.flavour_family])}</a>`);
  if (p.heat_level != null) similar.push('<a href="/spiciest-chips/" class="cp-explore-link">Spice ladder</a>');
  similar.push('<a href="/flavors/" class="cp-explore-link">All flavour pages</a>');
  const indexable = !pageNoindex(p, score.total);
  const thresholdNote = indexable
    ? ` This page is indexable: completeness is ${score.total} and an ingredient text is present.`
    : ` This page is noindex. A page is indexable only when completeness is ${INDEX_MIN} or more and an ingredient text is present.`;
  const certs = (p.certifications || []).map((c) => `Labelled as ${esc(c.label)} (checked ${esc(longDate(c.checked))}).`).join(' ');
  const certHtml = certs
    ? `<p>${certs}</p><p class="sb-muted">That is the certification label stored on the source record, not a check by World of Chips.</p>`
    : '';
  const gtin = p.barcodes.find((b) => /^\d{8,14}$/.test(b));
  const productLd = {
    '@type': 'Product',
    '@id': `${canonical}#product`,
    name: p.brand ? `${p.brand} ${productLabel(p)}` : productLabel(p),
    description: p.description,
    image: `${SITE}${p.image.photo_host === 'openfoodfacts' ? `/assets/photos/${p.image.file}-480.webp` : `/assets/photos/${p.image.file}-960.webp`}`,
    ...(p.brand ? { brand: { '@type': 'Brand', name: p.brand } } : {}),
    category: TYPE_LABEL[p.type],
    sku: p.id,
    url: canonical,
  };
  if (gtin) productLd.gtin = gtin;
  const jsonLd = { '@context': 'https://schema.org', '@graph': [productLd, breadcrumbLd(crumbItems)] };
  const body = `<article class="country-page active">
  <div class="cp-hero">
    <a href="/chips/" class="cp-back">&#8592; Chip database</a>
    ${crumbs(crumbItems)}
    <h1 class="cp-title">${p.brand ? `${quoted(p.brand)} ${quoted(productLabel(p))}` : quoted(productLabel(p))}</h1>
    <span class="cp-region">Sources checked ${esc(longDate('2026-11-16'))}</span>
    <p class="cp-intro-dark">${esc(p.description)}</p>
  </div>
  <div class="cp-body">
${isMfds(p) ? `    ${creditParagraph()}\n` : ''}    <p class="aff-disc sb-top-disc">${DISCLOSURE}</p>
    ${figure(p.image, true)}
    <p class="chip-pack">Check the pack; recipes change.</p>
    <section class="cp-section" id="facts">
      <h2>Facts</h2>
      <div class="sb-table-wrap"><table class="sb-table"><tbody>
        ${rows.map(([k, v]) => `<tr><th scope="row">${k}</th><td>${v}</td></tr>`).join('\n        ')}
      </tbody></table></div>
      <p class="sb-muted">Completeness ${score.total}/100.${thresholdNote} Heat and price are not part of the score. A null heat level is correct when the product is not on the spice ladder.</p>
      ${certHtml}
    </section>${nutritionSection(p)}
    <section class="cp-section" id="ingredients">
      <h2>Ingredients</h2>
      ${ing}
      <p class="chip-pack">Check the pack; recipes change.</p>
    </section>
    <section class="cp-section" id="equivalents">
      <h2>Same product, other brand</h2>
      ${equivHtml}
    </section>
    <section class="cp-section" id="sold">
      <h2>Where sold</h2>
      ${soldInner}
    </section>
    ${buySection(p)}
    <section class="cp-section" id="similar">
      <h2>Similar flavours</h2>
      <div class="cp-explore-grid">${similar.join('')}</div>
    </section>
    <section class="cp-section" id="sources">
      <h2>Sources</h2>
      <ul class="sb-sources">${sourceItems}</ul>
    </section>
    <p class="aff-disc">${DISCLOSURE}</p>
    ${newsletter()}
  </div>
</article>`;
  const og = photoSrc(p.image);
  return shell({
    title: p.title,
    description: p.description,
    canonical,
    image: og.src,
    imageAlt: p.image.alt,
    imageWidth: og.width,
    imageHeight: og.height,
    jsonLd,
    body,
    noindex: !indexable,
  });
}

function newsletter() {
  return `<aside class="nl nl-compact" id="newsletter" aria-labelledby="nl-title">
<h2 id="nl-title">Get the monthly Chip Report</h2>
<p class="nl-pitch">New and weird chips from around the world, once a month. No spam.</p>
${nlForm}
</aside>`;
}

function searchIndex(records) {
  return JSON.stringify(records.map((p) => ({
    name: itemName(p),
    brand: p.brand || '',
    maker: p.manufacturer || p.importer || '',
    type: TYPE_LABEL[p.type],
    countries: p.countries_sold.map((c) => countryName(c.country)).join(', '),
    flavour: p.flavour_family ? FLAVOUR_LABEL[p.flavour_family] : '',
    url: productPath(p),
  })));
}

function indexPage(records) {
  const nMinistry = records.filter(isMfds).length;
  const nOff = records.filter((p) => String(p.id).startsWith('off-')).length;
  const title = 'Chip Database | World of Chips';
  const description = 'Search sourced potato crisp records from Open Food Facts, plus Korean nutrient rows kept out of the open download. Check the pack; recipes change.';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: 'Chip database',
        url: `${SITE}/chips/`,
        description,
        isPartOf: { '@type': 'WebSite', name: 'World of Chips', url: `${SITE}/` },
      },
      breadcrumbLd([{ name: 'Home', href: '/' }, { name: 'Chip database', href: '/chips/' }]),
    ],
  };
  const body = `<article class="country-page active">
  <div class="cp-hero">
    <a href="/" class="cp-back">&#8592; Back to World of Chips</a>
    ${crumbs([{ name: 'Home', href: '/' }, { name: 'Chip database', href: '/chips/' }])}
    <h1 class="cp-title">Chip database</h1>
    <p class="cp-intro-dark">${esc(description)}</p>
  </div>
  <div class="cp-body">
    <p class="cp-intro">${nOff} Open Food Facts potato-crisp records and ${nMinistry} Korean nutrient-database rows. A product page is indexed only when its completeness is ${INDEX_MIN} or more and an ingredient text is present. The Korean rows stay noindex. Check the pack; recipes change.</p>
    ${creditParagraph()}
    <p>Open download, ODbL 1.0: <a href="/data/chips/export/chips.json">chips.json</a>, <a href="/data/chips/export/chips.csv">chips.csv</a>, <a href="/data/chips/export/ATTRIBUTION.txt">attribution</a>. The database attributes Open Food Facts. Photographs are separate: Open Food Facts photos are CC BY-SA 3.0, and the Korean rows are not in the download.</p>
    <label for="chip-q">Search by name, brand, country or type</label>
    <input id="chip-q" class="chip-search" type="search" placeholder="Try salt, Calbee, Mexico, ridged">
    <div id="chip-list" class="chip-list"></div>
    <p id="chip-empty" class="sb-muted" hidden>No records match.</p>
    <p id="chip-more" class="sb-muted" hidden></p>
    <noscript><p class="sb-muted">Search runs in the browser. The brand list below works without JavaScript.</p></noscript>
    <section class="cp-section"><h2>Brands</h2><div class="cp-explore-grid">${[...new Set(records.map((p) => p.brand_slug))].sort().map((s) => {
      const label = hubLabel(records.filter((p) => p.brand_slug === s));
      const text = DIETARY.test(label) ? `<span class="chip-source-text">${esc(label)}</span>` : esc(label);
      return `<a class="cp-explore-link" href="${brandPath(s)}">${text}</a>`;
    }).join('')}</div></section>
    ${newsletter()}
  </div>
</article>
<script>
(function () {
  var q = document.getElementById('chip-q');
  var list = document.getElementById('chip-list');
  var empty = document.getElementById('chip-empty');
  var more = document.getElementById('chip-more');
  function draw(data) {
    var s = q.value.toLowerCase();
    while (list.firstChild) list.removeChild(list.firstChild);
    var matched = 0;
    var shown = 0;
    data.forEach(function (p) {
      var hay = (p.name + ' ' + p.brand + ' ' + p.maker + ' ' + p.countries + ' ' + p.type + ' ' + p.flavour).toLowerCase();
      if (s && hay.indexOf(s) === -1) return;
      matched += 1;
      if (shown >= 80) return;
      shown += 1;
      var a = document.createElement('a');
      a.href = p.url;
      var h = document.createElement('strong');
      h.textContent = p.name;
      var m = document.createElement('span');
      m.textContent = (p.countries || 'Country not recorded') + ' · ' + p.type;
      a.appendChild(h);
      a.appendChild(m);
      list.appendChild(a);
    });
    empty.hidden = matched !== 0;
    more.hidden = matched <= 80;
    more.textContent = matched + ' matches. Showing the first 80.';
  }
  fetch('/chips/search-index.json').then(function (r) { return r.json(); }).then(function (data) {
    q.addEventListener('input', function () { draw(data); });
    draw(data);
  }).catch(function () {
    empty.hidden = false;
    empty.textContent = 'Search index failed to load.';
  });
})();
</script>`;
  return shell({
    title, description, canonical: `${SITE}/chips/`, image: '/assets/photos/og-lays-classic.jpg', imageAlt: "Lay's Classic potato chips", jsonLd, body, noindex: false,
  });
}

function brandPage(slug, records) {
  const mine = records.filter((p) => p.brand_slug === slug);
  const label = hubLabel(mine);
  const title = hubTitle(label);
  if (title.length > 65) die(`brand title too long: ${title}`);
  const indexable = mine.some((p) => !pageNoindex(p, scoreOf(p).total));
  const description = hubDescription(label, indexable);
  const urlPath = brandPath(slug);
  const crumbItems = [
    { name: 'Home', href: '/' },
    { name: 'Chip database', href: '/chips/' },
    { name: titleSafe(label), href: urlPath, plain: label },
  ];
  const heading = DIETARY.test(label)
    ? `<span class="chip-source-text">${esc(label)}</span>`
    : esc(label);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'ItemList',
        name: `${titleSafe(label)} chip records`,
        itemListElement: mine.map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: itemName(p), url: `${SITE}${productPath(p)}` })),
      },
      breadcrumbLd(crumbItems),
    ],
  };
  const credit = mine.some(isMfds) ? `\n    ${creditParagraph()}` : '';
  const body = `<article class="country-page active">
  <div class="cp-hero">
    <a href="/chips/" class="cp-back">&#8592; Chip database</a>
    ${crumbs(crumbItems)}
    <h1 class="cp-title">${heading}</h1>
    <p class="cp-intro-dark">${esc(description)}</p>
  </div>
  <div class="cp-body">${credit}
    <section class="cp-section"><h2>Records</h2><div class="cp-explore-grid">${mine.map((p) => `<a class="cp-explore-link" href="${productPath(p)}">${quoted(productLabel(p))}</a>`).join('')}</div></section>
    <p class="chip-pack">Check the pack; recipes change.</p>
    ${newsletter()}
  </div>
</article>`;
  const og = photoSrc(mine[0].image);
  return shell({
    title, description, canonical: `${SITE}${urlPath}`, image: og.src, imageAlt: mine[0].image.alt, imageWidth: og.width, imageHeight: og.height, jsonLd, body, noindex: !indexable,
  });
}

function csvEscape(v) {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportsFor(records) {
  const open = records.filter((p) => p.source_licence !== UNSTATED_LICENCE);
  const heldBack = records.length - open.length;
  const products = open.map((p) => {
    const score = scoreOf(p);
    const indexable = publicIndexable(p, score.total);
    return {
      ...p,
      completeness: score.total,
      ingredients_present: hasIngredients(p),
      public_indexable: indexable,
      noindex: !indexable,
      noindex_reason: indexable ? '' : [
        score.total < INDEX_MIN ? `completeness below ${INDEX_MIN}` : '',
        hasIngredients(p) ? '' : 'ingredients_text missing',
      ].filter(Boolean).join('; '),
    };
  });
  const doc = {
    name: 'World of Chips chip database',
    license: 'ODbL-1.0',
    license_url: 'https://opendatacommons.org/licenses/odbl/1-0/',
    attribution: 'Contains information from Open Food Facts (https://world.openfoodfacts.org), which is made available under the Open Database License. Photographs are not part of this database; each image.licence applies to that file only.',
    index_rule: `A public product page is indexable only when completeness is ${INDEX_MIN} or more and ingredients_text is present. Otherwise it is noindex.`,
    index_min: INDEX_MIN,
    preview: false,
    products,
  };
  const json = JSON.stringify(doc, null, 2) + '\n';
  const header = ['id', 'slug', 'brand_slug', 'brand', 'parent_company', 'name_local', 'name_en', 'type', 'flavour_family', 'heat_level', 'status', 'barcodes', 'countries_sold', 'pack_sizes_g', 'ingredients_text', 'ingredients_source', 'image_file', 'image_licence', 'image_credit', 'image_source', 'completeness', 'ingredients_present', 'public_indexable', 'noindex', 'price_per_100g'];
  const lines = [header.join(',')];
  for (const p of products) {
    lines.push([
      p.id, p.slug, p.brand_slug, p.brand, p.parent_company, p.name_local, p.name_en, p.type,
      p.flavour_family, p.heat_level, p.status, p.barcodes.join('|'),
      p.countries_sold.map((c) => c.country).join('|'),
      p.pack_sizes_g.map((s) => `${s.country}:${s.grams}`).join('|'),
      p.ingredients_text ? p.ingredients_text.text : '',
      p.ingredients_text ? p.ingredients_text.source : '',
      p.image.file, p.image.licence, p.image.credit, p.image.source,
      p.completeness, p.ingredients_present, p.public_indexable, p.noindex, '',
    ].map(csvEscape).join(','));
  }
  const csv = lines.join('\n') + '\n';
  const attribution = `${doc.name}
License: Open Database License (ODbL) 1.0
${doc.license_url}

${doc.attribution}

You may share and adapt this database if you attribute Open Food Facts and World of Chips, keep the database under the ODbL (share-alike), and do not treat a photograph's licence as a trademark licence. Product names and pack designs are trademarks of their owners.

Photographs live in assets/photos/ and stay under the licence named in image_licence. CC BY and CC BY-SA photographs also require a credit and, for BY-SA, share-alike on the adapted photograph.

Open Food Facts photographs copied for this database are CC BY-SA 3.0, resized to at most 480 pixels on the long side, and stored locally. They are not part of the ODbL database. Wikimedia photographs keep the licence named in image_licence. CC BY and CC BY-SA photographs also require a credit and, for BY-SA, share-alike on the adapted photograph.

price_per_100g is empty. Do not fill it from the Pringles Index.

Indexing rule, approved 16 Nov 2026: a public product page is indexable only when completeness is ${INDEX_MIN} or more and ingredients_text is present. Otherwise it is noindex.

Equivalents are brand names as stated by the sources. Recipes may differ.

${heldBack} records from the Korean Ministry of Food and Drug Safety processed-food nutrient database are stored in data/chips/mfds-kr.json. That download states no licence. Those records are not in chips.json or chips.csv and are not part of this ODbL database. Their pages are published at /chips/ and stay noindex.
`;
  return { json, csv, attribution };
}

function chipsSitemap(records) {
  const urls = [{ loc: `${SITE}/chips/`, pri: '0.8' }];
  const byBrand = new Map();
  for (const p of records) {
    if (!byBrand.has(p.brand_slug)) byBrand.set(p.brand_slug, []);
    byBrand.get(p.brand_slug).push(p);
  }
  for (const slug of [...byBrand.keys()].sort()) {
    const mine = byBrand.get(slug);
    if (mine.some((p) => !pageNoindex(p, scoreOf(p).total))) urls.push({ loc: `${SITE}/brands/${slug}/`, pri: '0.6' });
  }
  for (const p of records) {
    if (!pageNoindex(p, scoreOf(p).total)) urls.push({ loc: `${SITE}${productPath(p)}`, pri: '0.5' });
  }
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map((u) => `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>2026-11-16</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>${u.pri}</priority>\n  </url>\n`).join('') +
    '</urlset>\n';
}

function build() {
  const records = loadRecords().slice().sort((a, b) => a.id.localeCompare(b.id));
  const files = new Map();
  files.set('chips/index.html', indexPage(records));
  files.set('chips/search-index.json', searchIndex(records));
  for (const slug of [...new Set(records.map((p) => p.brand_slug))].sort()) {
    files.set(`brands/${slug}/index.html`, brandPage(slug, records));
  }
  for (const p of records) files.set(`chips/${p.brand_slug}/${p.slug}/index.html`, productPage(p, records));
  const exp = exportsFor(records);
  files.set('data/chips/export/chips.json', exp.json);
  files.set('data/chips/export/chips.csv', exp.csv);
  files.set('data/chips/export/ATTRIBUTION.txt', exp.attribution);
  files.set('sitemap-chips.xml', chipsSitemap(records));
  const titles = new Map();
  for (const [rel, text] of files) {
    if (!rel.endsWith('.html')) continue;
    const m = text.match(/<title>([^<]*)<\/title>/);
    const t = m ? m[1] : '';
    if (!t) die(`missing title in ${rel}`);
    if (titles.has(t)) die(`duplicate title ${t} (${rel} and ${titles.get(t)})`);
    titles.set(t, rel);
  }
  return files;
}

const AISLE = path.join(ROOT, 'chips', '_preview', 'aisle');
function listOwnedHtml() {
  const out = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (p === AISLE || p.startsWith(AISLE + path.sep)) continue;
      if (ent.isDirectory()) walk(p);
      else if (ent.name === 'index.html') out.push(path.relative(ROOT, p).split(path.sep).join('/'));
    }
  }
  walk(path.join(ROOT, 'chips'));
  walk(path.join(ROOT, 'brands'));
  return out;
}

function main() {
  const files = build();
  const owned = new Set(listOwnedHtml());
  const stale = [];
  for (const rel of owned) if (!files.has(rel)) stale.push(rel);
  for (const [rel, text] of files) {
    const dest = path.join(ROOT, rel);
    if (CHECK) {
      const cur = fs.existsSync(dest) ? fs.readFileSync(dest, 'utf8') : null;
      if (cur !== text) stale.push(rel);
    } else {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, text);
    }
  }
  if (!CHECK) {
    for (const rel of owned) {
      if (!files.has(rel)) fs.rmSync(path.join(ROOT, rel), { force: true });
    }
  }
  if (CHECK) {
    if (stale.length) {
      console.error(`chip-db stale: ${stale.slice(0, 8).join(', ')}`);
      process.exit(1);
    }
    console.log(`chip-db OK (${files.size} files).`);
    return;
  }
  const indexable = [...files.keys()].filter((rel) => rel.startsWith('chips/') && rel.endsWith('/index.html') && !rel.includes('/_preview/') && !files.get(rel).includes('content="noindex')).length;
  console.log(`Wrote ${files.size} chip-db files. Product pages with index, follow: ${indexable - 1}.`);
}

try { main(); }
catch (e) { console.error(e.message || e); process.exit(1); }
