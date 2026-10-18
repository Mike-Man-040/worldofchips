#!/usr/bin/env node
// Build the chip-news section of worldofchips.com from data/news.json.
//
// Source of truth: data/news.json (array of stories, see README "Chip news").
// Writes (deterministically, no timestamps, so re-running without data
// changes produces no diff):
//   index.html     only the region between <!-- BUILD:NEWS:START/END --> (latest 6 cards)
//   news/index.html  static archive page with every story, newest first
//   sitemap.xml    the https://worldofchips.com/news/ <url> entry (lastmod = newest story)
//
// Usage:  node scripts/build_news.mjs           write files
//         node scripts/build_news.mjs --check   exit 1 if any output is out of date
// Requires Node 16+. No npm install needed.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

process.on('uncaughtException', (e) => { console.error(`build_news: ${e.message}`); process.exit(1); });

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://worldofchips.com';
const HOME_CARDS = 6;
const CHECK = process.argv.includes('--check');

const CATEGORIES = {
  'Industry': 'var(--gold),var(--red)',
  'New Flavor': 'var(--gold),var(--green)',
  'Safety Recall': 'var(--red),var(--red-dark)',
  'Innovation': 'var(--teal),var(--green)',
  'Sustainability': 'var(--green),var(--teal)',
  'Investment': 'var(--blue),var(--teal)',
  'Regional': 'var(--gold),var(--blue)',
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// ---------- helpers ----------
const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');
const jsonLd = (o) => JSON.stringify(o).replace(/</g, '\\u003c');
function between(src, start, end) {
  const a = src.indexOf(start);
  if (a < 0) throw new Error(`Marker not found: ${start}`);
  const b = src.indexOf(end, a + start.length);
  if (b < 0) throw new Error(`End marker not found after ${start}: ${end}`);
  return { a, b, text: src.slice(a, b) };
}
const fmtDate = (d) => { const [y, m, dd] = d.split('-'); return `${Number(dd)} ${MONTHS[Number(m) - 1]} ${y}`; };
const fmtMonth = (d) => { const [y, m] = d.split('-'); return `${MONTHS_LONG[Number(m) - 1]} ${y}`; };

// ---------- 1. inputs ----------
const indexPath = path.join(ROOT, 'index.html');
const indexHtml = fs.readFileSync(indexPath, 'utf8');
const stories = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'news.json'), 'utf8'));
if (!Array.isArray(stories) || !stories.length) throw new Error('data/news.json must be a non-empty array');

// Country names/flags/slugs from the same inline data the country pages use.
const main = [...indexHtml.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1])
  .find((s) => s.includes('const countryData='));
if (!main) throw new Error('Could not find the main inline <script> with countryData');
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(
  between(main, 'const countryData=', '// Consumption data').text + '\n' +
  between(main, 'const countryContent = {};', '// Generate and show a country page').text +
  '\nthis.out={countryData,countryContent};', sandbox);
const { countryData, countryContent } = sandbox.out;
const countries = Object.keys(countryData).map((name) => ({ name, slug: countryContent[name].slug, flag: countryData[name].flag }))
  .sort((x, y) => x.name.localeCompare(y.name));
const bySlug = new Map(countries.map((c) => [c.slug, c]));
const THE = new Set(['United States', 'United Kingdom', 'Netherlands']);
const inName = (n) => (THE.has(n) ? `the ${n}` : n);

// Minimal structural validation (the full field check lives in validate_site.py).
const ids = new Set();
for (const s of stories) {
  for (const k of ['id', 'date', 'title', 'summary', 'category', 'source_name', 'source_url']) {
    if (typeof s[k] !== 'string' || !s[k].trim()) throw new Error(`story ${s.id || '?'}: missing ${k}`);
  }
  if (ids.has(s.id)) throw new Error(`duplicate story id ${s.id}`);
  ids.add(s.id);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.date)) throw new Error(`story ${s.id}: date must be YYYY-MM-DD`);
  if (!CATEGORIES[s.category]) throw new Error(`story ${s.id}: unknown category ${s.category}`);
  if (s.country && !bySlug.has(s.country)) throw new Error(`story ${s.id}: unknown country slug ${s.country}`);
  if (!/^https?:\/\//.test(s.source_url)) throw new Error(`story ${s.id}: source_url must be absolute`);
}
// Newest first; ties broken by id so the order is stable.
const sorted = [...stories].sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : x.id.localeCompare(y.id)));
const LATEST = sorted[0].date;

// ---------- 2. card markup (shared by homepage and archive) ----------
function card(s) {
  const c = s.country && bySlug.get(s.country);
  const countryLink = c ? `<a class="news-card-country" href="/${c.slug}/">${c.flag} Chips in ${esc(inName(c.name))} &#8594;</a>` : '';
  return `<article class="news-card" id="${esc(s.id)}"><div class="news-card-top" style="background:linear-gradient(90deg,${CATEGORIES[s.category]})"></div>` +
    `<div class="news-card-body"><span class="news-card-cat">${esc(s.category)}</span>` +
    `<h3><a href="${esc(s.source_url)}" target="_blank" rel="noopener">${esc(s.title)}</a></h3>` +
    `<p>${esc(s.summary)}</p>${countryLink}</div>` +
    `<div class="news-card-meta"><time datetime="${s.date}">${fmtDate(s.date)}</time>` +
    `<a href="${esc(s.source_url)}" target="_blank" rel="noopener">${esc(s.source_name)} &#8599;</a></div></article>`;
}

// ---------- 3. homepage region ----------
const homeRegion = `<!-- Generated by scripts/build_news.mjs from data/news.json -->
  <div class="news-grid">
    ${sorted.slice(0, HOME_CARDS).map(card).join('\n    ')}
  </div>
  <p class="news-more"><a href="/news/">All chip news &#8594;</a></p>`;
function replaceRegion(html, key, body) {
  const start = `<!-- BUILD:${key}:START -->`;
  const end = `<!-- BUILD:${key}:END -->`;
  const { a, b } = between(html, start, end);
  return html.slice(0, a + start.length) + '\n  ' + body + '\n  ' + html.slice(b);
}
const newIndex = replaceRegion(indexHtml, 'NEWS', homeRegion);

// ---------- 4. archive page ----------
const gaSnippet = between(indexHtml, '<!-- Google tag (gtag.js) -->', '<meta charset').text.trim();
const fontsLink = (indexHtml.match(/<link href="https:\/\/fonts\.googleapis\.com[^>]*>/) || [])[0];
const footerHtml = between(indexHtml, '<footer>', '</footer>').text + '</footer>';

const url = `${SITE}/news/`;
const title = 'Potato Chip News: New Flavors, Recalls & Industry Moves | World of Chips';
const desc = `Potato chip and crisps news from around the world, updated weekly: new flavor launches, food-safety recalls, industry deals and regional snack trends. Updated ${fmtDate(LATEST)}.`;
const ld = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'CollectionPage',
      '@id': `${url}#page`,
      name: 'Potato Chip News & Trends',
      description: desc,
      url,
      inLanguage: 'en',
      dateModified: LATEST,
      isPartOf: { '@type': 'WebSite', name: 'World of Chips', url: `${SITE}/` },
      publisher: { '@type': 'Organization', name: 'World of Chips', url: `${SITE}/` },
      mainEntity: { '@id': `${url}#stories` },
    },
    {
      '@type': 'ItemList',
      '@id': `${url}#stories`,
      name: 'Chip news stories, newest first',
      itemListOrder: 'https://schema.org/ItemListOrderDescending',
      numberOfItems: sorted.length,
      itemListElement: sorted.map((s, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: s.title,
        url: s.source_url,
      })),
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'World of Chips', item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: 'Chip News', item: url },
      ],
    },
  ],
};

// Group by month for scannable headings.
const groups = [];
for (const s of sorted) {
  const key = s.date.slice(0, 7);
  if (!groups.length || groups[groups.length - 1].key !== key) groups.push({ key, label: fmtMonth(s.date), items: [] });
  groups[groups.length - 1].items.push(s);
}
const mentioned = countries.filter((c) => sorted.some((s) => s.country === c.slug));
const link = (c) => `<a href="/${c.slug}/" class="cp-explore-link">${c.flag} ${esc(c.name)}</a>`;

const newsPage = `<!DOCTYPE html>
<html lang="en">
<head>
${gaSnippet}
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:site_name" content="World of Chips">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<script type="application/ld+json">
${jsonLd(ld)}
</script>
${fontsLink}
<link rel="stylesheet" href="/assets/site.css">
<style>
.nav-logo a{color:inherit;text-decoration:none;display:flex;align-items:center;gap:.5rem}
.cp-crumbs{font-size:.75rem;color:var(--muted);margin-bottom:1rem}
.cp-crumbs a{color:var(--gold);text-decoration:none}
.cp-intro-dark{color:var(--muted);max-width:620px;margin:1rem auto 0;font-size:.95rem}
.news-month{font-family:'Playfair Display',serif;color:var(--gold);font-size:1.3rem;max-width:1100px;margin:2.5rem auto 1rem}
.news-month:first-of-type{margin-top:0}
.cp-cta h2{font-family:'Playfair Display',serif;font-size:1.3rem;color:var(--brown);margin-bottom:.6rem}
</style>
</head>
<body>

<nav class="nav">
  <div class="nav-logo"><a href="/">🥔 World of Chips</a></div>
  <div class="nav-links">
    <a href="/#countries">Countries</a>
    <a href="/#map-section">Map</a>
    <a href="/#consumption">Consumption</a>
    <a href="/news/" aria-current="page">News</a>
    <a href="/#shop">Where to Buy</a>
  </div>
</nav>

<main>
<div class="country-page active" id="news-archive">
  <div class="cp-hero">
    <a href="/" class="cp-back">← Back to World of Chips</a>
    <nav class="cp-crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <span>Chip News</span></nav>
    <span class="cp-flag">📰</span>
    <h1 class="cp-title">Potato Chip News &amp; Trends</h1>
    <span class="cp-region">Updated ${fmtDate(LATEST)}</span>
    <p class="cp-intro-dark">New flavors, recalls, industry moves and regional snack trends from around the world. Every story is summarised in our own words and links to its original source.</p>
  </div>
  <section id="news" class="content-section" aria-label="All chip news, newest first">
${groups.map((g) => `    <h2 class="news-month">${g.label}</h2>
    <div class="news-grid">
      ${g.items.map(card).join('\n      ')}
    </div>`).join('\n')}
  </section>
  <div class="cp-body">
    <nav class="cp-cta" aria-label="Country guides">
      <h2>Chip Guides for Countries in the News</h2>
      <div class="cp-explore-grid">${mentioned.map(link).join('')}</div>
      <p style="margin-top:2rem">Explore chip culture in every country we cover:</p>
      <div class="cp-explore-grid">${countries.map(link).join('')}</div>
      <p style="margin-top:2rem"><a href="/" class="cp-explore-link">🌍 Back to the Global Chip Map</a></p>
    </nav>
  </div>
</div>
</main>

${footerHtml}

</body>
</html>
`;

// ---------- 5. sitemap entry ----------
const sitemapPath = path.join(ROOT, 'sitemap.xml');
const sitemap = fs.readFileSync(sitemapPath, 'utf8');
const newsUrlBlock = (lastmod) =>
  `  <url>\n    <loc>${SITE}/news/</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
const stripped = sitemap.replace(/  <url>\n    <loc>https:\/\/worldofchips\.com\/news\/<\/loc>\n[\s\S]*?<\/url>\n/, '');
const homeEnd = stripped.indexOf('</url>\n');
if (homeEnd < 0) throw new Error('sitemap.xml has no <url> entries');
const newSitemap = stripped.slice(0, homeEnd + 7) + newsUrlBlock(LATEST) + stripped.slice(homeEnd + 7);

// ---------- 6. write / check ----------
const outputs = [
  [indexPath, newIndex],
  [path.join(ROOT, 'news', 'index.html'), newsPage],
  [sitemapPath, newSitemap],
];
if (CHECK) {
  const stale = outputs.filter(([p, body]) => !fs.existsSync(p) || fs.readFileSync(p, 'utf8') !== body)
    .map(([p]) => path.relative(ROOT, p));
  if (stale.length) {
    console.error(`News output out of date: ${stale.join(', ')}. Run: node scripts/build_news.mjs`);
    process.exit(1);
  }
  console.log(`News output up to date (${sorted.length} stories, latest ${LATEST}).`);
} else {
  fs.mkdirSync(path.join(ROOT, 'news'), { recursive: true });
  for (const [p, body] of outputs) fs.writeFileSync(p, body);
  console.log(`Built news: ${sorted.length} stories (latest ${LATEST}); homepage shows ${Math.min(HOME_CARDS, sorted.length)}.`);
}
