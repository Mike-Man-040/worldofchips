#!/usr/bin/env node
// Chip database, phase 0. Reads data/chips/records.json and writes a review-only
// preview under /chips/_preview/ (index, brand hubs, product pages, and the
// aisle at /chips/_preview/aisle/) plus an ODbL JSON/CSV export. Does not edit the
// sitemap, the nav, country pages, flavour pages, llms.txt, or /pringles-index/.
//
//   node scripts/build_chip_db.mjs           write files
//   node scripts/build_chip_db.mjs --check   exit 1 if the generated files are stale
//
// Publishing is not implemented. --publish fails on purpose.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tagFor, snackBoxLead, daebakBox, bolBox, UNIVERSAL_YUMS_AWIN, AWIN_REL, DAEBAK_LINK, DAEBAK_REL, BOL_REL, bolLink, bolSearchUrl } from './affiliate_tags.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://worldofchips.com';
const CHECK = process.argv.includes('--check');
const PREVIEW = 'chips/_preview';
const CHIP_TAG = tagFor('guides'); // existing section tag. No new Associates id.
const INDEX_MIN = 60;
// A public product page is indexable only when both are true. Preview pages are noindex either way.
function hasIngredients(p) {
  return !!(p.ingredients_text && String(p.ingredients_text.text || '').trim());
}
function publicIndexable(p, score) {
  return score >= INDEX_MIN && hasIngredients(p);
}
const RECORDS_PATH = path.join(ROOT, 'data', 'chips', 'records.json');

if (process.argv.includes('--publish')) {
  console.error('build_chip_db: phase 0 does not publish. Pages stay under /chips/_preview/.');
  process.exit(1);
}

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
    ['image', 6, !!(p.image && p.image.credit && p.image.licence && p.image.source)],
    ['where_to_buy', 4, p.where_to_buy.length > 0],
  ];
  const total = parts.reduce((n, [, w, ok]) => n + (ok ? w : 0), 0);
  if (parts.reduce((n, [, w]) => n + w, 0) !== 100) die('completeness weights must sum to 100');
  return { total, parts };
}

function loadRecords() {
  const records = JSON.parse(fs.readFileSync(RECORDS_PATH, 'utf8'));
  if (!Array.isArray(records) || records.length < 1) die('records.json must be a non-empty array');
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
    for (const suffix of [`${img.file}-960.webp`, `${img.file}-480.webp`]) {
      if (!fs.existsSync(path.join(ROOT, 'assets', 'photos', suffix))) die(`${p.id}: missing assets/photos/${suffix}`);
    }
    if (!fs.existsSync(path.join(ROOT, 'assets', 'photos', `og-${img.file}.jpg`))) die(`${p.id}: missing og image for ${img.file}`);
    const prose = JSON.stringify({ ...p, ingredients_text: null });
    const hit = prose.match(DIETARY);
    if (hit) die(`${p.id}: dietary wording "${hit[0]}" outside ingredients_text. Quote a certification as "labelled as" only when the pack shows it.`);
  }
  return records;
}

function figure(img, eager) {
  const big = `/assets/photos/${img.file}-960.webp`;
  const small = `/assets/photos/${img.file}-480.webp`;
  const lic = img.licence === 'Public domain'
    ? 'public domain'
    : `<a href="${esc(img.licence_url)}" target="_blank" rel="nofollow noopener">${esc(img.licence)}</a>`;
  const resized = /BY/.test(img.licence) ? ', resized' : '';
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
</style>`;

function shell({ title, description, canonical, image, imageAlt, jsonLd, body, extraCss = '' }) {
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
<meta name="robots" content="noindex, nofollow">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="article">
<meta property="og:url" content="${canonical}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:site_name" content="World of Chips">
<meta property="og:image" content="${SITE}${image}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
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
${extraCss ? `${extraCss}\n` : ''}${mlUniversal}
</head>
<body>
<p class="chip-review">Review copy, not published. This page is noindex and is not in the site menu or the sitemap. <a href="/${PREVIEW}/">All preview records</a></p>
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
  const html = items.map((it, i) => i === items.length - 1
    ? `<span>${esc(it.name)}</span>`
    : `<a href="${it.href}">${esc(it.name)}</a>`).join(' &#8250; ');
  return `<nav class="cp-crumbs" aria-label="Breadcrumb">${html}</nav>`;
}

function breadcrumbLd(items) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem', position: i + 1, name: it.name, item: it.href.startsWith('http') ? it.href : `${SITE}${it.href}`,
    })),
  };
}

function productPath(p) { return `/${PREVIEW}/${p.brand_slug}/${p.slug}/`; }
function brandPath(slug) { return `/${PREVIEW}/brands/${slug}/`; }

function buySection(p) {
  return p.where_to_buy.map((row) => {
    const bits = [];
    if (row.channels.includes('universal-yums')) bits.push(snackBoxLead({ indent: '    ' }));
    if (row.channels.includes('daebak') && !row.channels.includes('universal-yums')) bits.push(daebakBox());
    if (row.channels.includes('bol')) bits.push(bolBox([{ n: `${p.brand} ${p.name_en}`, q: row.amazon_query }]));
    if (row.channels.includes('amazon')) {
      bits.push(`
    <p>${amazonLink(row.amazon_query, `Find ${esc(p.brand)} ${esc(p.name_en)} on Amazon &#8594;`)}</p>
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
  const crumbItems = [
    { name: 'Home', href: '/' },
    { name: 'Chip database', href: `/${PREVIEW}/` },
    { name: p.brand, href: brandHref },
    { name: p.name_en, href: urlPath },
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
    ['Brand', esc(p.brand)],
    ['Parent company', parent],
    ['Type', esc(TYPE_LABEL[p.type])],
    ['Flavour family', flavour],
    ['Spice ladder', heat],
    ['Barcodes', bars],
    ['Status', esc(p.status)],
    ['Pack size', packs],
    ['Price per 100 g', 'Not recorded'],
  ];
  const equivList = p.equivalents.length
    ? `<ul class="sb-list">${p.equivalents.map((e) => {
      const href = e.id ? productPath(all.find((r) => r.id === e.id)) : '';
      const name = href ? `<a href="${href}">${esc(e.name)}</a>` : esc(e.name);
      return `<li><strong>${name}</strong> (${esc(e.region)}). ${esc(e.note)} <span class="sb-muted">Source checked ${esc(longDate(e.checked))}.</span></li>`;
    }).join('')}</ul>`
    : '<p>No brand-name equivalent is recorded. A blank here means the sources we checked did not name one.</p>';
  const equivHtml = `<p class="chip-pack">These are brand names as stated by the sources. Recipes may differ.</p>\n      ${equivList}`;
  const soldRows = p.countries_sold.map((c) => `<tr><td>${countryLink(c.country)}</td><td><a href="${esc(c.source)}" target="_blank" rel="nofollow noopener">${esc(c.source.replace(/^https?:\/\//, ''))}</a></td><td>${esc(longDate(c.checked))}</td></tr>`).join('');
  const ing = p.ingredients_text
    ? `<blockquote class="chip-ingredients">${esc(p.ingredients_text.text)}</blockquote>
      <p class="sb-muted">Copied from the source dated ${esc(longDate(p.ingredients_text.checked))}${p.ingredients_text.note ? `. ${esc(p.ingredients_text.note)}` : ''}</p>`
    : '<p>No ingredient text is recorded. The note in Sources says where we looked.</p>';
  const sourceItems = p.sources.map((s) => `<li><strong>${esc(s.field)}</strong>, checked ${esc(longDate(s.checked))}: <a href="${esc(s.url)}" target="_blank" rel="nofollow noopener">${esc(s.url)}</a>${s.note ? `. ${esc(s.note)}` : ''}</li>`).join('');
  const similar = [];
  if (p.flavour_family) similar.push(`<a href="/flavors/${p.flavour_family}/" class="cp-explore-link">${esc(FLAVOUR_LABEL[p.flavour_family])}</a>`);
  if (p.heat_level != null) similar.push('<a href="/spiciest-chips/" class="cp-explore-link">Spice ladder</a>');
  similar.push('<a href="/flavors/" class="cp-explore-link">All flavour pages</a>');
  const indexable = publicIndexable(p, score.total);
  const thresholdNote = indexable
    ? ` A public page would be indexable: completeness is ${score.total} and an ingredient text is present. This preview is noindex until publishing is switched on.`
    : ` This page would stay noindex. A public page is indexable only when completeness is ${INDEX_MIN} or more and an ingredient text is present.`;
  const gtin = p.barcodes.find((b) => /^\d{8,14}$/.test(b));
  const productLd = {
    '@type': 'Product',
    '@id': `${canonical}#product`,
    name: `${p.brand} ${p.name_en}`,
    description: p.description,
    image: `${SITE}/assets/photos/${p.image.file}-960.webp`,
    brand: { '@type': 'Brand', name: p.brand },
    category: TYPE_LABEL[p.type],
    sku: p.id,
    url: canonical,
  };
  if (gtin) productLd.gtin = gtin;
  const jsonLd = { '@context': 'https://schema.org', '@graph': [productLd, breadcrumbLd(crumbItems)] };
  const body = `<article class="country-page active">
  <div class="cp-hero">
    <a href="/${PREVIEW}/" class="cp-back">&#8592; Chip database preview</a>
    ${crumbs(crumbItems)}
    <h1 class="cp-title">${esc(p.brand)} ${esc(p.name_en)}</h1>
    <span class="cp-region">Sources checked ${esc(longDate('2026-11-16'))}</span>
    <p class="cp-intro-dark">${esc(p.description)}</p>
  </div>
  <div class="cp-body">
    <p class="aff-disc sb-top-disc">${DISCLOSURE}</p>
    ${figure(p.image, true)}
    <p class="chip-pack">Check the pack; recipes change.</p>
    <section class="cp-section" id="facts">
      <h2>Facts</h2>
      <div class="sb-table-wrap"><table class="sb-table"><tbody>
        ${rows.map(([k, v]) => `<tr><th scope="row">${k}</th><td>${v}</td></tr>`).join('\n        ')}
      </tbody></table></div>
      <p class="sb-muted">Completeness ${score.total}/100.${thresholdNote} Heat and price are not part of the score. A null heat level is correct when the product is not on the spice ladder.</p>
    </section>
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
      <div class="sb-table-wrap"><table class="sb-table"><thead><tr><th>Country</th><th>Source</th><th>Checked</th></tr></thead><tbody>
        ${soldRows}
      </tbody></table></div>
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
  return shell({
    title: p.title,
    description: p.description,
    canonical,
    image: `/assets/photos/og-${p.image.file}.jpg`,
    imageAlt: p.image.alt,
    jsonLd,
    body,
  });
}

function newsletter() {
  return `<aside class="nl nl-compact" id="newsletter" aria-labelledby="nl-title">
<h2 id="nl-title">Get the monthly Chip Report</h2>
<p class="nl-pitch">New and weird chips from around the world, once a month. No spam.</p>
${nlForm}
</aside>`;
}

function indexPage(records) {
  const title = 'Chip Database Preview | World of Chips';
  const description = 'Review-only index of ten sourced chip records. Search runs in the browser. These pages are noindex and are not in the sitemap.';
  const items = records.map((p, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: `${p.brand} ${p.name_en}`,
    url: `${SITE}${productPath(p)}`,
  }));
  const searchData = records.map((p) => ({
    name: `${p.brand} ${p.name_en}`,
    brand: p.brand,
    type: TYPE_LABEL[p.type],
    countries: p.countries_sold.map((c) => countryName(c.country)).join(', '),
    flavour: p.flavour_family ? FLAVOUR_LABEL[p.flavour_family] : '',
    url: productPath(p),
  }));
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'ItemList', name: 'Chip database preview', itemListElement: items },
      breadcrumbLd([{ name: 'Home', href: '/' }, { name: 'Chip database', href: `/${PREVIEW}/` }]),
    ],
  };
  const body = `<article class="country-page active">
  <div class="cp-hero">
    <a href="/" class="cp-back">&#8592; Back to World of Chips</a>
    ${crumbs([{ name: 'Home', href: '/' }, { name: 'Chip database', href: `/${PREVIEW}/` }])}
    <h1 class="cp-title">Chip database preview</h1>
    <p class="cp-intro-dark">${esc(description)}</p>
  </div>
  <div class="cp-body">
    <p class="cp-intro">Ten sample products across the United States, the United Kingdom, the Netherlands, Japan, South Korea and Mexico. Nothing here is in the public menu. Check the pack; recipes change.</p>
    <p class="cp-intro"><a href="/${PREVIEW}/aisle/">Browse the same ten records as a chip aisle</a>. That page is review-only too: noindex, and not in the menu or the sitemap.</p>
    <label for="chip-q">Search by name, brand, country or type</label>
    <input id="chip-q" class="chip-search" type="search" placeholder="Try salt, Calbee, Mexico, ridged">
    <div id="chip-list" class="chip-list"></div>
    <p id="chip-empty" class="sb-muted" hidden>No records match.</p>
    <section class="cp-section"><h2>Brands</h2><div class="cp-explore-grid">${[...new Set(records.map((p) => p.brand_slug))].sort().map((s) => {
      const name = records.find((p) => p.brand_slug === s).brand;
      return `<a class="cp-explore-link" href="${brandPath(s)}">${esc(name)}</a>`;
    }).join('')}</div></section>
    ${newsletter()}
  </div>
</article>
<script>
(function () {
  var data = ${JSON.stringify(searchData)};
  var q = document.getElementById('chip-q');
  var list = document.getElementById('chip-list');
  var empty = document.getElementById('chip-empty');
  function draw() {
    var s = q.value.toLowerCase();
    while (list.firstChild) list.removeChild(list.firstChild);
    var n = 0;
    data.forEach(function (p) {
      var hay = (p.name + ' ' + p.brand + ' ' + p.countries + ' ' + p.type + ' ' + p.flavour).toLowerCase();
      if (s && hay.indexOf(s) === -1) return;
      n += 1;
      var a = document.createElement('a');
      a.href = p.url;
      var h = document.createElement('strong');
      h.textContent = p.name;
      var m = document.createElement('span');
      m.textContent = p.countries + ' · ' + p.type;
      a.appendChild(h);
      a.appendChild(m);
      list.appendChild(a);
    });
    empty.hidden = n !== 0;
  }
  q.addEventListener('input', draw);
  draw();
})();
</script>`;
  return shell({
    title, description, canonical: `${SITE}/${PREVIEW}/`, image: '/assets/photos/og-lays-classic.jpg', imageAlt: "Lay's Classic potato chips", jsonLd, body,
  });
}

// Public pages that already discuss this record. Country pages, flavour pages and the
// spice ladder are added in guideLinks when the record points at them. A missing file
// is a build error so a renamed guide cannot leave a broken link.
const GUIDE_PAGES = {
  'calbee-usushio': [['/best-japanese-chips/', 'Japanese chips guide']],
  'haitai-honey-butter-chip': [
    ['/best-korean-chips-to-buy-online/', 'Korean chips guide'],
    ['/where-to-buy-honey-butter-chip-europe/', 'Where to buy Honey Butter Chip'],
  ],
  'takis-fuego': [
    ['/where-to-buy-takis-europe/', 'Where to buy Takis'],
    ['/best-mexican-chips-to-buy-online/', 'Mexican chips guide'],
  ],
  'walkers-salt-and-vinegar': [['/best-british-crisps-to-buy-online/', 'British crisps guide']],
  'pringles-original': [['/pringles-index/', 'Pringles Index']],
};
const PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

function pageExists(href) {
  const rel = href.replace(/^\//, '').replace(/\/$/, '');
  return fs.existsSync(path.join(ROOT, rel, 'index.html'));
}

function licensedImage(p) {
  const img = p.image;
  if (!img || !img.file || !img.alt || !img.licence || !img.licence_url || !img.credit || !img.source) return null;
  for (const suffix of [`${img.file}-480.webp`, `${img.file}-960.webp`]) {
    if (!fs.existsSync(path.join(ROOT, 'assets', 'photos', suffix))) return null;
  }
  return img;
}

function creditCaption(img) {
  const lic = img.licence === 'Public domain'
    ? 'public domain'
    : `<a href="${esc(img.licence_url)}" target="_blank" rel="nofollow noopener">${esc(img.licence)}</a>`;
  const resized = /BY/.test(img.licence) ? ', resized' : '';
  return `Photo: <a href="${esc(img.source)}" target="_blank" rel="nofollow noopener">${esc(img.credit)}</a> via Wikimedia Commons, ${lic}${resized}.`;
}

function guideLinks(p) {
  const out = [{ href: productPath(p), label: 'Sourced record' }];
  const seen = new Set(out.map((l) => l.href));
  const add = (href, label) => {
    if (!href || seen.has(href)) return;
    if (!pageExists(href)) die(`${p.id}: missing page ${href}`);
    seen.add(href);
    out.push({ href, label });
  };
  if (p.flavour_family) add(`/flavors/${p.flavour_family}/`, FLAVOUR_LABEL[p.flavour_family]);
  if (p.heat_level != null) add('/spiciest-chips/', `Spice ladder, rung ${p.heat_level}`);
  for (const [href, label] of GUIDE_PAGES[p.id] || []) add(href, label);
  for (const c of p.countries_sold) {
    const href = `/${c.country}/`;
    if (!pageExists(href) || seen.has(href)) continue;
    seen.add(href);
    out.push({ href, label: countryName(c.country) });
  }
  return out;
}

function countryBits(p) {
  if (!p.countries_sold.length) return 'Country not recorded';
  return p.countries_sold.map((c) => {
    const name = esc(countryName(c.country));
    return pageExists(`/${c.country}/`) ? `<a href="/${c.country}/">${name}</a>` : name;
  }).join(', ');
}

function dealBlock(p) {
  const channels = new Set(p.where_to_buy.flatMap((row) => row.channels));
  const bits = [];
  if (channels.has('universal-yums')) {
    bits.push(`<a href="${esc(UNIVERSAL_YUMS_AWIN)}" target="_blank" rel="${AWIN_REL}" class="buy-btn" data-affiliate="universalyums">Universal Yums snack box &#8594;</a>`);
  }
  if (channels.has('daebak')) {
    bits.push(`<a href="${esc(DAEBAK_LINK)}" target="_blank" rel="${DAEBAK_REL}" class="buy-btn" data-affiliate="daebak">Daebak Korean snack box &#8594;</a>`);
  }
  if (channels.has('bol')) {
    const row = p.where_to_buy.find((r) => r.channels.includes('bol'));
    const q = (row && row.amazon_query) || `${p.brand} ${p.name_en}`;
    bits.push(`<a href="${esc(bolLink(bolSearchUrl(q), `${p.brand} ${p.name_en}`))}" target="_blank" rel="${BOL_REL}" class="buy-btn" data-affiliate="bol">bol.com search &#8594;</a>`);
  }
  const amazonRows = [];
  const seenQ = new Set();
  for (const row of p.where_to_buy) {
    if (!row.channels.includes('amazon') || !row.amazon_query || seenQ.has(row.amazon_query)) continue;
    seenQ.add(row.amazon_query);
    amazonRows.push(row);
  }
  amazonRows.forEach((row) => {
    const label = amazonRows.length > 1
      ? `Find it on Amazon (${countryName(row.country)})`
      : `Find ${p.brand} ${p.name_en} on Amazon`;
    bits.push(amazonLink(row.amazon_query, `${esc(label)} &#8594;`));
  });
  return bits.join('\n      ');
}

function bagMedia(img, defer) {
  // Shelf slots are about 150px, so the 480px file is enough. The 960px file stays on the product page.
  const small = `/assets/photos/${img.file}-480.webp`;
  const common = `width="${img.width}" height="${img.height}" alt="${esc(img.alt)}" decoding="async"`;
  if (!defer) return `<img ${common} src="${small}" loading="lazy">`;
  return `<img class="aisle-lazy" ${common} src="${PIXEL}" data-src="${small}" loading="lazy">`;
}

function ghostBag(p) {
  let n = 0;
  for (const ch of p.id) n = (n + ch.charCodeAt(0)) % 8;
  return `<span class="aisle-ghost" style="--bag:${n}" aria-hidden="true"><span class="aisle-ghost-crimp"></span><span class="aisle-ghost-brand">${esc(p.brand)}</span><span class="aisle-ghost-name">${esc(p.name_en)}</span></span>`;
}

function shelfTitle(slug) {
  return slug === 'unrecorded' ? 'Country not recorded' : countryName(slug);
}

const AISLE_CSS = `<style>
.cp-hero{padding:1.35rem 1.25rem 1.2rem}
.cp-back{margin-bottom:.55rem}
.cp-title{font-size:clamp(1.8rem,4vw,2.7rem)}
.aisle{margin:0 -2rem 2rem;background:#1a1108;color:#fff8ec;padding:.85rem 0 1.15rem;scroll-margin-top:64px}
.aisle-help{margin:0 1rem .85rem;color:#f5ecd7;font-size:.95rem;line-height:1.5}
.aisle-skip{color:#f5d78e;font-weight:700}
.aisle-shelf{margin:0 0 1.15rem}
.aisle-shelf-head{display:flex;align-items:baseline;justify-content:space-between;gap:.75rem;padding:0 1rem .4rem}
.aisle-shelf h2{margin:0;font-family:'Zilla Slab',serif;font-size:1.15rem;letter-spacing:.08em;text-transform:uppercase;color:#f5d78e}
.aisle-shelf h2 a{color:inherit;text-decoration:underline;text-underline-offset:.15em}
.aisle-count{color:#c4a574;font-size:.85rem}
.aisle-row{display:flex;align-items:center;gap:.35rem;padding:0 .45rem}
.aisle-nudge{flex:0 0 48px;width:48px;height:48px;border-radius:999px;border:2px solid #e8a838;background:#2a1c10;color:#fff8ec;font-size:1.7rem;line-height:1;cursor:pointer}
.aisle-nudge:focus-visible,.aisle-bag:focus-visible,.aisle-close:focus-visible,.aisle-text-link:focus-visible{outline:3px solid #f5d78e;outline-offset:3px}
.aisle-track{min-width:0;flex:1;display:flex;gap:.65rem;overflow-x:auto;scroll-snap-type:x mandatory;scroll-padding-inline:.55rem;padding:.7rem .55rem .85rem;background:linear-gradient(#c4a574,#a68456) bottom/100% 12px no-repeat,linear-gradient(#5c4630,#3d2b1a);border-radius:4px 4px 12px 12px;box-shadow:0 8px 0 #2a1c10;overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch}
.aisle-track::-webkit-scrollbar{height:8px}
.aisle-track::-webkit-scrollbar-thumb{background:#e8a838;border-radius:8px}
.aisle-bag{position:relative;flex:0 0 9.25rem;width:9.25rem;scroll-snap-align:start;display:flex;padding:.35rem;border-radius:12px;text-decoration:none;color:#fff8ec}
.aisle-bag-face{height:11.5rem;width:100%;display:grid;place-items:center;background:#fff8ec;border-radius:10px;overflow:hidden;box-shadow:0 6px 0 rgba(0,0,0,.28)}
.aisle-bag-face img{max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain}
.aisle-bag-caption{position:absolute;left:.35rem;right:.35rem;bottom:.35rem;padding:.4rem .45rem .5rem;background:rgba(26,17,8,.9);border-radius:0 0 10px 10px}
.aisle-bag-name{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;font-size:.92rem;font-weight:700;line-height:1.25;color:#fff8ec}
.aisle-bag-where{display:block;margin-top:.1rem;font-size:.85rem;color:#f5d78e}
.aisle-ghost{width:5.6rem;height:8.2rem;border-radius:1.15rem 1.15rem .7rem .7rem;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:.2rem;padding:.35rem .3rem .55rem;text-align:center;color:#fff8ec;background:linear-gradient(hsl(calc(var(--bag) * 42), 68%, 42%), hsl(calc(var(--bag) * 42), 58%, 30%))}
.aisle-ghost-crimp{width:100%;height:.55rem;margin-bottom:auto;background:repeating-linear-gradient(90deg,#0003 0 6px,#fff6 6px 12px)}
.aisle-ghost-brand,.aisle-ghost-name{font-size:.68rem;font-weight:700;line-height:1.15}
.aisle-catalog{list-style:none;padding:0;margin:1rem 0 0;display:grid;gap:1rem}
.aisle-catalog>li{background:var(--paper);border:1px solid var(--light-border);border-radius:14px;padding:1rem}
.aisle-catalog h3{font-family:'Playfair Display',serif;font-size:1.25rem;color:var(--brown);margin:0 0 .15rem}
.aisle-local,.aisle-type{margin:.1rem 0;color:var(--muted);font-size:.9rem}
.aisle-countries{margin:.25rem 0 .5rem}
.aisle-read,.aisle-deals{display:flex;flex-wrap:wrap;gap:.5rem;margin-top:.75rem}
.aisle-text-link{display:inline-flex;align-items:center;min-height:48px;padding:.4rem .9rem;border-radius:999px;border:1px solid var(--light-border);background:var(--cream);color:#1a4570;text-decoration:none;font-weight:600}
.aisle-deals .buy-btn{margin:0}
.aisle-catalog .woc-photo{margin:.4rem 0}
.aisle-catalog .woc-photo img{max-height:200px}
.aisle-dialog{position:fixed;top:50%;left:50%;right:auto;bottom:auto;transform:translate(-50%,-50%);height:auto;margin:0;border:none;border-radius:16px;padding:0 1.1rem 1rem;width:min(22.5rem,calc(100vw - 1.5rem));max-height:92vh;overflow:auto;background:var(--paper);color:var(--ink);box-shadow:0 18px 50px rgba(26,17,8,.35)}
.aisle-dialog::backdrop{background:rgba(26,17,8,.66)}
.aisle-dialog-bar{position:sticky;top:0;display:flex;justify-content:flex-end;background:var(--paper);padding-top:.35rem;z-index:1}
.aisle-close{min-width:48px;min-height:48px;border:0;background:transparent;font:inherit;font-weight:700;color:var(--brown);cursor:pointer}
.aisle-dialog h2{font-family:'Playfair Display',serif;font-size:1.35rem;color:var(--brown);margin:0 0 .35rem}
.aisle-card-photo img{display:block;max-width:100%;height:auto;max-height:140px;margin:0 auto .35rem;object-fit:contain}
.aisle-card-photo figcaption,.aisle-catalog figcaption{font-size:.75rem;line-height:1.4;color:var(--muted)}
.aisle-dialog .aisle-read,.aisle-dialog .aisle-deals{flex-direction:column;align-items:stretch}
.aisle-dialog .buy-btn,.aisle-dialog .aisle-text-link{justify-content:center;width:100%;box-sizing:border-box}
@media (hover:hover){
  .aisle-bag:hover{transform:translateY(-4px)}
}
@media (prefers-reduced-motion: reduce){
  .aisle-bag,.aisle-nudge,.aisle-track{scroll-behavior:auto;transition:none}
  .aisle-bag:hover{transform:none}
}
@media (max-width:600px){
  .cp-body .aisle{margin-left:-2rem;margin-right:-2rem}
  .aisle-bag{flex-basis:10.5rem;width:10.5rem}
}
</style>`;

function aislePage(records) {
  const title = 'Chip Aisle Preview | World of Chips';
  if (title.length > 65) die(`aisle title too long (${title.length})`);
  const description = 'Review-only shelves of the ten sourced chip records, grouped by country. Noindex, and not in the sitemap or the menu.';
  const groups = new Map();
  for (const p of records) {
    const slugs = p.countries_sold.length ? p.countries_sold.map((c) => c.country) : ['unrecorded'];
    for (const slug of slugs) {
      if (!groups.has(slug)) groups.set(slug, []);
      if (!groups.get(slug).some((row) => row.id === p.id)) groups.get(slug).push(p);
    }
  }
  for (const list of groups.values()) list.sort((a, b) => `${a.brand} ${a.name_en}`.localeCompare(`${b.brand} ${b.name_en}`));
  const shelfSlugs = [...groups.keys()].sort((a, b) => {
    const diff = groups.get(b).length - groups.get(a).length;
    return diff || shelfTitle(a).localeCompare(shelfTitle(b));
  });
  const listed = [];
  const seen = new Set();
  for (const slug of shelfSlugs) {
    for (const p of groups.get(slug)) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      listed.push(p);
    }
  }
  const any = { yums: false, daebak: false, bol: false };
  for (const p of records) {
    for (const row of p.where_to_buy) {
      if (row.channels.includes('universal-yums')) any.yums = true;
      if (row.channels.includes('daebak')) any.daebak = true;
      if (row.channels.includes('bol')) any.bol = true;
    }
  }
  const partnerNotes = [
    any.yums ? 'Universal Yums ships snack boxes to the US and Canada only.' : '',
    any.daebak ? 'Daebak is a Korean snack box that ships internationally.' : '',
    any.bol ? 'bol.com delivers to the Netherlands and Belgium.' : '',
  ].filter(Boolean).join(' ');
  const shelves = shelfSlugs.map((slug) => {
    const bags = groups.get(slug);
    const heading = slug === 'unrecorded' || !pageExists(`/${slug}/`)
      ? esc(shelfTitle(slug))
      : `<a href="/${slug}/">${esc(shelfTitle(slug))}</a>`;
    const trackId = `aisle-track-${slug}`;
    const cards = bags.map((p, i) => {
      const img = licensedImage(p);
      const face = img ? bagMedia(img, i > 0) : ghostBag(p);
      return `<a class="aisle-bag" href="#aisle-item-${p.id}">
        <span class="aisle-bag-face">${face}</span>
        <span class="aisle-bag-caption"><span class="aisle-bag-name">${esc(p.brand)} ${esc(p.name_en)}</span><span class="aisle-bag-where">${esc(shelfTitle(slug))}</span></span>
      </a>`;
    }).join('\n        ');
    const noun = bags.length === 1 ? 'bag' : 'bags';
    return `<section class="aisle-shelf" aria-labelledby="aisle-h-${slug}">
      <div class="aisle-shelf-head"><h2 id="aisle-h-${slug}">${heading}</h2><span class="aisle-count">${bags.length} ${noun}</span></div>
      <div class="aisle-row">
        <button type="button" class="aisle-nudge" data-dir="-1" aria-controls="${trackId}" aria-label="Scroll the ${esc(shelfTitle(slug))} shelf back"><span aria-hidden="true">&#8249;</span></button>
        <div class="aisle-track" id="${trackId}" tabindex="0">
        ${cards}
        </div>
        <button type="button" class="aisle-nudge" data-dir="1" aria-controls="${trackId}" aria-label="Scroll the ${esc(shelfTitle(slug))} shelf forward"><span aria-hidden="true">&#8250;</span></button>
      </div>
    </section>`;
  }).join('\n    ');
  const items = listed.map((p) => {
    const img = licensedImage(p);
    const local = p.name_local && p.name_local !== p.name_en ? `<p class="aisle-local">${esc(p.name_local)}</p>` : '';
    const photo = img ? `<figure class="woc-photo"><img src="/assets/photos/${img.file}-480.webp" sizes="200px" width="${img.width}" height="${img.height}" alt="${esc(img.alt)}" loading="lazy" decoding="async"><figcaption>${creditCaption(img)}</figcaption></figure>` : `<p class="aisle-type">No licensed photo is on file. The shelf shows a drawn bag.</p>`;
    const reads = guideLinks(p).map((l) => `<a class="aisle-text-link" href="${l.href}">${esc(l.label)}</a>`).join('\n        ');
    return `<li id="aisle-item-${p.id}">
      <h3>${esc(p.brand)} ${esc(p.name_en)}</h3>
      ${local}
      <p class="aisle-countries">Sold in ${countryBits(p)}.</p>
      <p class="aisle-type">${esc(TYPE_LABEL[p.type])}</p>
      ${photo}
      <div class="aisle-read">${reads}</div>
      <div class="aisle-deals">${dealBlock(p)}</div>
    </li>`;
  }).join('\n      ');
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'ItemList',
        name: 'Chip aisle preview',
        itemListElement: listed.map((p, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: `${p.brand} ${p.name_en}`,
          url: `${SITE}${productPath(p)}`,
        })),
      },
      breadcrumbLd([
        { name: 'Home', href: '/' },
        { name: 'Chip database', href: `/${PREVIEW}/` },
        { name: 'Aisle', href: `/${PREVIEW}/aisle/` },
      ]),
    ],
  };
  const body = `<article class="country-page active">
  <div class="cp-hero">
    <a href="/${PREVIEW}/" class="cp-back">&#8592; Chip database preview</a>
    ${crumbs([{ name: 'Home', href: '/' }, { name: 'Chip database', href: `/${PREVIEW}/` }, { name: 'Aisle', href: `/${PREVIEW}/aisle/` }])}
    <h1 class="cp-title">Chip aisle</h1>
    <p class="cp-intro-dark">The same ten sourced records as the <a href="/${PREVIEW}/">chip database preview</a>, on country shelves. This is not a second index. It is noindex, and it is not in the menu or the sitemap.</p>
  </div>
  <div class="cp-body">
    <div class="aisle">
      <p class="aisle-help"><a class="aisle-skip" href="#aisle-list">Skip to the list</a>. Swipe a shelf, or use the round buttons. Arrow keys move between bags. Select a bag for its name and country.</p>
      <noscript><p class="aisle-help">The shelves need JavaScript. Every bag is in the list below, with the same links.</p></noscript>
      ${shelves}
    </div>
    <section class="cp-section" id="aisle-list">
      <h2>Bags on this aisle</h2>
      <p class="aff-disc">${DISCLOSURE}</p>
      <p>One entry per record, in shelf order. A bag sold in two countries is on both shelves and only once in this list. The links are in the HTML, so they do not depend on JavaScript. ${partnerNotes} Snack-box links are above the Amazon search. A box or a search is not a claim that it contains this bag. Check the pack; recipes change.</p>
      <p class="sb-muted">Packaging in a photograph is a trademark of its owner. The photo licence is not a trademark licence. Where a record has no licensed photo, the shelf draws a bag instead of using someone else's picture.</p>
      <ol class="aisle-catalog">
      ${items}
      </ol>
    </section>
    <dialog id="aisle-dialog" class="aisle-dialog" aria-labelledby="aisle-dialog-title">
      <div class="aisle-dialog-bar"><button type="button" class="aisle-close">Close</button></div>
      <h2 id="aisle-dialog-title"></h2>
      <div id="aisle-dialog-slot"></div>
      <p class="sb-muted">A snack box or a search is not this bag. Check the pack; recipes change. Affiliate links: World of Chips may earn a commission, at no extra cost to you.</p>
    </dialog>
    ${newsletter()}
  </div>
</article>
<script>
(function () {
  var dialog = document.getElementById('aisle-dialog');
  var slot = document.getElementById('aisle-dialog-slot');
  var title = document.getElementById('aisle-dialog-title');
  var lastFocus = null;
  var reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  function motion() { return reduceQuery.matches ? 'auto' : 'smooth'; }
  function loadImg(img) {
    if (!img) return;
    var src = img.getAttribute('data-src');
    if (src) {
      img.src = src;
      img.removeAttribute('data-src');
    }
    var set = img.getAttribute('data-srcset');
    if (set) {
      img.srcset = set;
      img.removeAttribute('data-srcset');
    }
  }
  function scrollTrack(track, dir) {
    track.scrollBy({ left: dir * Math.max(160, track.clientWidth * 0.75), behavior: motion() });
  }
  document.querySelectorAll('.aisle-nudge').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var track = document.getElementById(btn.getAttribute('aria-controls'));
      if (track) scrollTrack(track, Number(btn.getAttribute('data-dir')) || 1);
    });
  });
  document.querySelectorAll('.aisle-track').forEach(function (track) {
    var imgs = track.querySelectorAll('img.aisle-lazy');
    if (!('IntersectionObserver' in window)) {
      imgs.forEach(loadImg);
    } else if (imgs.length) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          loadImg(en.target);
          io.unobserve(en.target);
        });
      }, { root: track, rootMargin: '120px', threshold: 0.01 });
      imgs.forEach(function (img) { io.observe(img); });
    }
    track.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' || e.altKey || e.metaKey || e.ctrlKey) return;
      var bags = Array.prototype.slice.call(track.querySelectorAll('.aisle-bag'));
      var index = bags.indexOf(document.activeElement);
      if (index >= 0) {
        var next = bags[index + (e.key === 'ArrowRight' ? 1 : -1)];
        if (!next) return;
        e.preventDefault();
        next.focus();
        next.scrollIntoView({ inline: 'start', block: 'nearest', behavior: motion() });
        return;
      }
      e.preventDefault();
      scrollTrack(track, e.key === 'ArrowRight' ? 1 : -1);
    });
  });
  function openCard(bag) {
    if (!dialog || !dialog.showModal) return;
    var id = (bag.getAttribute('href') || '').split('#')[1];
    var item = id && document.getElementById(id);
    if (!item) return;
    var head = item.querySelector('h3');
    title.textContent = head ? head.textContent : '';
    while (slot.firstChild) slot.removeChild(slot.firstChild);
    var sourceImg = bag.querySelector('img');
    var caption = item.querySelector('figcaption');
    if (sourceImg || caption) {
      if (sourceImg) loadImg(sourceImg);
      var fig = document.createElement('figure');
      fig.className = 'aisle-card-photo';
      if (sourceImg && sourceImg.getAttribute('src') && sourceImg.getAttribute('src').indexOf('data:') !== 0) {
        var pic = document.createElement('img');
        pic.alt = sourceImg.alt;
        pic.src = sourceImg.currentSrc || sourceImg.getAttribute('src');
        pic.width = 240;
        pic.height = 160;
        pic.decoding = 'async';
        fig.appendChild(pic);
      }
      if (caption) fig.appendChild(caption.cloneNode(true));
      if (fig.firstChild) slot.appendChild(fig);
    }
    ['.aisle-local', '.aisle-countries', '.aisle-type', '.aisle-read', '.aisle-deals'].forEach(function (sel) {
      var node = item.querySelector(sel);
      if (node) slot.appendChild(node.cloneNode(true));
    });
    lastFocus = bag;
    dialog.showModal();
    var closeBtn = dialog.querySelector('.aisle-close');
    if (closeBtn) closeBtn.focus();
  }
  document.querySelectorAll('.aisle-bag').forEach(function (bag) {
    bag.addEventListener('click', function (e) {
      if (!dialog || !dialog.showModal) return;
      e.preventDefault();
      openCard(bag);
    });
  });
  if (dialog) {
    dialog.addEventListener('close', function () {
      if (lastFocus) lastFocus.focus();
    });
    dialog.addEventListener('click', function (e) {
      var rect = dialog.getBoundingClientRect();
      var inside = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
      if (!inside) dialog.close();
    });
    var closeBtn = dialog.querySelector('.aisle-close');
    if (closeBtn) closeBtn.addEventListener('click', function () { dialog.close(); });
  }
})();
</script>`;
  return shell({
    title,
    description,
    canonical: `${SITE}/${PREVIEW}/aisle/`,
    image: '/assets/photos/og-sabritas-shelf.jpg',
    imageAlt: 'A supermarket display stacked with many varieties of Sabritas chips in Mexico',
    jsonLd,
    body,
    extraCss: AISLE_CSS,
  });
}

function brandPage(slug, records) {
  const mine = records.filter((p) => p.brand_slug === slug);
  const brand = mine[0].brand;
  const title = `${brand} Chip Records | World of Chips`;
  if (title.length > 65) die(`brand title too long: ${title}`);
  const description = `Preview records for ${brand}. Review only: noindex, and not in the sitemap or the site menu.`;
  const urlPath = brandPath(slug);
  const crumbItems = [
    { name: 'Home', href: '/' },
    { name: 'Chip database', href: `/${PREVIEW}/` },
    { name: brand, href: urlPath },
  ];
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'ItemList',
        name: `${brand} preview records`,
        itemListElement: mine.map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: `${p.brand} ${p.name_en}`, url: `${SITE}${productPath(p)}` })),
      },
      breadcrumbLd(crumbItems),
    ],
  };
  const body = `<article class="country-page active">
  <div class="cp-hero">
    <a href="/${PREVIEW}/" class="cp-back">&#8592; Chip database preview</a>
    ${crumbs(crumbItems)}
    <h1 class="cp-title">${esc(brand)}</h1>
    <p class="cp-intro-dark">${esc(description)}</p>
  </div>
  <div class="cp-body">
    <section class="cp-section"><h2>Records</h2><div class="cp-explore-grid">${mine.map((p) => `<a class="cp-explore-link" href="${productPath(p)}">${esc(p.name_en)}</a>`).join('')}</div></section>
    <p class="chip-pack">Check the pack; recipes change.</p>
    ${newsletter()}
  </div>
</article>`;
  return shell({
    title, description, canonical: `${SITE}${urlPath}`, image: `/assets/photos/og-${mine[0].image.file}.jpg`, imageAlt: mine[0].image.alt, jsonLd, body,
  });
}

function csvEscape(v) {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportsFor(records) {
  const products = records.map((p) => {
    const score = scoreOf(p);
    const indexable = publicIndexable(p, score.total);
    return {
      ...p,
      completeness: score.total,
      ingredients_present: hasIngredients(p),
      public_indexable: indexable,
      noindex: true,
      noindex_reason: indexable ? 'phase 0 preview' : ['phase 0 preview'].concat([
        score.total < INDEX_MIN ? `completeness below ${INDEX_MIN}` : '',
        hasIngredients(p) ? '' : 'ingredients_text missing',
      ].filter(Boolean)).join('; '),
    };
  });
  const doc = {
    name: 'World of Chips chip database (phase 0 preview)',
    license: 'ODbL-1.0',
    license_url: 'https://opendatacommons.org/licenses/odbl/1-0/',
    attribution: 'Contains information from Open Food Facts (https://world.openfoodfacts.org), which is made available under the Open Database License. Photographs are not part of this database; each image.licence applies to that file only.',
    index_rule: `A public product page is indexable only when completeness is ${INDEX_MIN} or more and ingredients_text is present. Otherwise it is noindex. Preview pages are noindex regardless.`,
    index_min: INDEX_MIN,
    preview: true,
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

price_per_100g is empty in this preview. Do not fill it from the Pringles Index.

Indexing rule, approved 16 Nov 2026: a public product page is indexable only when completeness is ${INDEX_MIN} or more and ingredients_text is present. Otherwise it is noindex. This preview is noindex either way.

Equivalents are brand names as stated by the sources. Recipes may differ.
`;
  return { json, csv, attribution };
}

function build() {
  const records = loadRecords().slice().sort((a, b) => a.id.localeCompare(b.id));
  const files = new Map();
  files.set(`${PREVIEW}/index.html`, indexPage(records));
  files.set(`${PREVIEW}/aisle/index.html`, aislePage(records));
  for (const slug of [...new Set(records.map((p) => p.brand_slug))].sort()) {
    files.set(`${PREVIEW}/brands/${slug}/index.html`, brandPage(slug, records));
  }
  for (const p of records) files.set(`${PREVIEW}/${p.brand_slug}/${p.slug}/index.html`, productPage(p, records));
  const exp = exportsFor(records);
  files.set('data/chips/export/chips.json', exp.json);
  files.set('data/chips/export/chips.csv', exp.csv);
  files.set('data/chips/export/ATTRIBUTION.txt', exp.attribution);
  return files;
}

function main() {
  const files = build();
  const stale = [];
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
  if (CHECK) {
    if (stale.length) {
      console.error(`chip-db stale: ${stale.slice(0, 8).join(', ')}`);
      process.exit(1);
    }
    console.log(`chip-db OK (${files.size} files).`);
    return;
  }
  console.log(`Wrote ${files.size} chip-db files under /${PREVIEW}/ and data/chips/export/.`);
}

try { main(); }
catch (e) { console.error(e.message || e); process.exit(1); }
