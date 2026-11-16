#!/usr/bin/env node
// Chip database, phase 0. Reads data/chips/records.json and writes a review-only
// preview under /chips/_preview/ plus an ODbL JSON/CSV export. Does not edit the
// sitemap, the nav, country pages, flavour pages, or /pringles-index/.
//
//   node scripts/build_chip_db.mjs           write files
//   node scripts/build_chip_db.mjs --check   exit 1 if the generated files are stale
//
// Publishing is not implemented. --publish fails on purpose.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tagFor, snackBoxLead, daebakBox, bolBox } from './affiliate_tags.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://worldofchips.com';
const CHECK = process.argv.includes('--check');
const PREVIEW = 'chips/_preview';
const CHIP_TAG = tagFor('guides'); // existing section tag. No new Associates id.
const NOINDEX_BELOW = 60;
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

function shell({ title, description, canonical, image, imageAlt, jsonLd, body }) {
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
${mlUniversal}
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
  const equivHtml = p.equivalents.length
    ? `<ul class="sb-list">${p.equivalents.map((e) => {
      const href = e.id ? productPath(all.find((r) => r.id === e.id)) : '';
      const name = href ? `<a href="${href}">${esc(e.name)}</a>` : esc(e.name);
      return `<li><strong>${name}</strong> (${esc(e.region)}). ${esc(e.note)} <span class="sb-muted">Source checked ${esc(longDate(e.checked))}.</span></li>`;
    }).join('')}</ul>`
    : '<p>No same-product equivalent is recorded. A blank here means the sources we checked did not name one.</p>';
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
  const thresholdNote = score.total < NOINDEX_BELOW
    ? ` This score is below ${NOINDEX_BELOW}, so the page would stay noindex even after a later publish.`
    : ` This score meets the proposed threshold of ${NOINDEX_BELOW}. The preview is noindex anyway until publishing is switched on.`;
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
      <p class="sb-muted">Completeness ${score.total}/100. Proposed rule: noindex below ${NOINDEX_BELOW}.${thresholdNote} Heat and price are not part of the score. A null heat level is correct when the product is not on the spice ladder.</p>
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
    return {
      ...p,
      completeness: score.total,
      noindex: true,
      noindex_reason: score.total < NOINDEX_BELOW ? `below ${NOINDEX_BELOW}` : 'phase 0 preview',
    };
  });
  const doc = {
    name: 'World of Chips chip database (phase 0 preview)',
    license: 'ODbL-1.0',
    license_url: 'https://opendatacommons.org/licenses/odbl/1-0/',
    attribution: 'Contains information from Open Food Facts (https://world.openfoodfacts.org), which is made available under the Open Database License. Photographs are not part of this database; each image.licence applies to that file only.',
    noindex_below: NOINDEX_BELOW,
    preview: true,
    products,
  };
  const json = JSON.stringify(doc, null, 2) + '\n';
  const header = ['id', 'slug', 'brand_slug', 'brand', 'parent_company', 'name_local', 'name_en', 'type', 'flavour_family', 'heat_level', 'status', 'barcodes', 'countries_sold', 'pack_sizes_g', 'ingredients_text', 'ingredients_source', 'image_file', 'image_licence', 'image_credit', 'image_source', 'completeness', 'price_per_100g'];
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
      p.completeness, '',
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

Proposed rule for a later public site: a product page with completeness below ${NOINDEX_BELOW} stays noindex.
`;
  return { json, csv, attribution };
}

function build() {
  const records = loadRecords().slice().sort((a, b) => a.id.localeCompare(b.id));
  const files = new Map();
  files.set(`${PREVIEW}/index.html`, indexPage(records));
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
