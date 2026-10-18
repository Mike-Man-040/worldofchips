#!/usr/bin/env node
// Build static, crawlable country pages for worldofchips.com.
//
// Source of truth: the inline country data/content JS inside index.html
// (countryData, brandUrls, countryContent, and the per-country shop picks).
// This script evaluates those exact snippets in a sandbox (no DOM, no deps),
// then writes:
//   /<slug>/index.html      one server-rendered page per country
//   /assets/site.css        the homepage's inline CSS, extracted verbatim
//   /sitemap.xml            homepage + every country URL
//   index.html              only the regions between BUILD:* markers
//
// Usage:  node scripts/build_country_pages.mjs [--lastmod YYYY-MM-DD]
// Requires Node 16+. No npm install needed.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://worldofchips.com';
const GA_ID = 'G-DNNP35ZL09';

const argv = process.argv.slice(2);
const lmIdx = argv.indexOf('--lastmod');
const LASTMOD = lmIdx >= 0 ? argv[lmIdx + 1] : new Date().toISOString().slice(0, 10);
if (!/^\d{4}-\d{2}-\d{2}$/.test(LASTMOD)) throw new Error('--lastmod must be YYYY-MM-DD');

const indexPath = path.join(ROOT, 'index.html');
let indexHtml = fs.readFileSync(indexPath, 'utf8');

// ---------- helpers ----------
function between(src, start, end, from = 0) {
  const a = src.indexOf(start, from);
  if (a < 0) throw new Error(`Marker not found: ${start}`);
  const b = src.indexOf(end, a + start.length);
  if (b < 0) throw new Error(`End marker not found after ${start}: ${end}`);
  return { a, b, text: src.slice(a, b) };
}
const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');
const jsonLd = (o) => JSON.stringify(o, null, 0).replace(/</g, '\\u003c');
function truncate(s, n) {
  if (s.length <= n) return s;
  const cut = s.slice(0, n - 1);
  return cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:\s]+$/, '') + '…';
}

// ---------- 1. extract data from index.html ----------
const scripts = [...indexHtml.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const main = scripts.find((s) => s.includes('const countryData='));
if (!main) throw new Error('Could not find the main inline <script> with countryData');

const segData = between(main, 'const countryData=', '// Consumption data').text;
const segContent = between(main, 'const countryContent = {};', '// Generate and show a country page').text;
const segShop = between(main, 'var csm = {', '\n  };').text + '\n  };';
const fallbackMatch = main.match(/var lnks=csm\[name\]\|\|(\[[\s\S]*?\]);/);
if (!fallbackMatch) throw new Error('Could not find default shop links (var lnks=csm[name]||[...])');

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(
  `${segData}\n${segContent}\n${segShop}\nvar defaultShop=${fallbackMatch[1]};\n` +
  'this.out={countryData,brandUrls,countryContent,csm,defaultShop};',
  sandbox,
);
const { countryData, brandUrls, countryContent, csm, defaultShop } = sandbox.out;

// Head bits reused verbatim from the homepage
const gaSnippet = between(indexHtml, '<!-- Google tag (gtag.js) -->', '<meta charset').text.trim();
if (!gaSnippet.includes(GA_ID)) throw new Error('GA snippet not found / id changed');
const fontsLink = (indexHtml.match(/<link href="https:\/\/fonts\.googleapis\.com[^>]*>/) || [])[0];
const css = between(indexHtml, '<style>', '</style>').text.slice('<style>'.length).trim() + '\n';
const footerHtml = between(indexHtml, '<footer>', '</footer>').text + '</footer>';

// ---------- 2. derived country list ----------
const names = Object.keys(countryData);
const countries = names.map((name) => {
  const slug = countryContent[name].slug;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error(`Bad slug for ${name}: ${slug}`);
  return { name, slug, d: countryData[name], c: countryContent[name] };
});
const bySlug = new Map(countries.map((x) => [x.slug, x]));
if (bySlug.size !== countries.length) throw new Error('Duplicate slugs');
const sorted = [...countries].sort((x, y) => x.name.localeCompare(y.name));

// "the United States" reads better in titles/headings; body copy is left as-is.
const THE = new Set(['United States', 'United Kingdom', 'Netherlands']);
const inName = (n) => (THE.has(n) ? `the ${n}` : n);

function brandTag(b) {
  const url = brandUrls[b];
  if (url) return `<a href="${esc(url)}" target="_blank" rel="sponsored noopener" style="text-decoration:none">${esc(b)} ↗</a>`;
  return esc(b);
}

function shopLinks(name) {
  const lnks = csm[name] || defaultShop;
  return lnks.map((l) =>
    `<a href="${esc(l.u)}" target="_blank" rel="sponsored noopener" style="display:flex;align-items:center;gap:.8rem;padding:.7rem 1rem;background:var(--paper);border:1px solid var(--light-border);border-radius:10px;text-decoration:none;color:var(--ink);transition:all .3s"><div style="flex:1"><div style="font-weight:700;font-size:.88rem">${esc(l.n)}</div><div style="font-size:.72rem;color:var(--muted)">${esc(l.d)}</div></div><span style="color:var(--gold);font-weight:700">Shop &#8594;</span></a>`,
  ).join('\n            ');
}

function relatedCountries(x) {
  // Same region first, then alphabetical neighbours, max 6.
  const same = sorted.filter((o) => o.slug !== x.slug && o.d.region === x.d.region);
  const rest = sorted.filter((o) => o.slug !== x.slug && o.d.region !== x.d.region);
  return [...same, ...rest].slice(0, 6);
}

const link = (o) => `<a href="/${o.slug}/" class="cp-explore-link">${o.d.flag} ${esc(o.name)}</a>`;

// ---------- 3. page template ----------
function renderPage(x) {
  const { name, slug, d, c } = x;
  const url = `${SITE}/${slug}/`;
  const title = `Potato Chips in ${inName(name)}: Brands, Flavors & Culture | World of Chips`;
  const desc = truncate(
    `Potato chips in ${inName(name)}: top brands like ${d.topBrands.slice(0, 3).join(', ')}, ` +
    `popular flavors such as ${d.popularFlavors.slice(0, 2).join(' and ')}, unique flavors like ` +
    `${d.uniqueFlavors.slice(0, 2).join(' and ')}, fun facts and where to buy.`, 160);
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        '@id': `${url}#article`,
        headline: `Potato Chips in ${inName(name)}`,
        description: desc,
        url,
        mainEntityOfPage: { '@type': 'WebPage', '@id': url },
        inLanguage: 'en',
        dateModified: LASTMOD,
        about: { '@type': 'Country', name },
        author: { '@type': 'Organization', name: 'World of Chips', url: `${SITE}/` },
        publisher: { '@type': 'Organization', name: 'World of Chips', url: `${SITE}/` },
        isPartOf: { '@type': 'WebSite', name: 'World of Chips', url: `${SITE}/` },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'World of Chips', item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: `Potato Chips in ${inName(name)}`, item: url },
        ],
      },
    ],
  };
  const related = relatedCountries(x);
  const others = sorted.filter((o) => o.slug !== slug);

  return `<!DOCTYPE html>
<html lang="en">
<head>
${gaSnippet}
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="article">
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
    <a href="/news/">News</a>
    <a href="/#shop">Where to Buy</a>
  </div>
</nav>

<main>
<article class="country-page active" id="cp-${slug}">
  <div class="cp-hero">
    <a href="/" class="cp-back">← Back to World of Chips</a>
    <nav class="cp-crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <span>${esc(name)}</span></nav>
    <span class="cp-flag">${d.flag}</span>
    <h1 class="cp-title">Potato Chips in ${esc(inName(name))}</h1>
    <span class="cp-region">${esc(d.region)}</span>
  </div>
  <div class="cp-body">
    <p class="cp-intro">${esc(c.intro)}</p>

    <div class="cp-stats">
      <div class="cp-stat"><div class="val">${esc(d.marketSize)}</div><div class="lbl">Market Size</div></div>
      <div class="cp-stat"><div class="val">${esc(d.perCapita)}</div><div class="lbl">Per Capita / Year</div></div>
      <div class="cp-stat"><div class="val">${esc(d.avgCost)}</div><div class="lbl">Avg. Bag Price</div></div>
      <div class="cp-stat"><div class="val">${esc(d.growth)}</div><div class="lbl">Annual Growth</div></div>
    </div>

    <section class="cp-section">
      <h2>Top Potato Chip Brands in ${esc(inName(name))}</h2>
      <p>${esc(c.brandStory)}</p>
      <div class="cp-brand-list">
        ${d.topBrands.map((b) => `<span class="cp-tag brand">${brandTag(b)}</span>`).join('\n        ')}
      </div>
    </section>

    <section class="cp-section">
      <h2>Most Popular Chip Flavors</h2>
      <p>These are the bestselling, most widely available potato chip flavors you'll find on shelves across ${esc(name)}.</p>
      <div class="cp-flavor-grid">
        ${d.popularFlavors.map((f) => `<div class="cp-flavor-card"><div class="cp-flavor-name">${esc(f)}</div><div class="cp-flavor-type">Popular</div></div>`).join('\n        ')}
      </div>
    </section>

    <section class="cp-section">
      <h2>Unique &amp; Exotic Flavors</h2>
      <p>These distinctive flavors are what make ${esc(name)}'s chip culture truly unique — flavors you're unlikely to find anywhere else in the world.</p>
      <div class="cp-flavor-grid">
        ${d.uniqueFlavors.map((f) => `<div class="cp-flavor-card"><div class="cp-flavor-name">${esc(f)}</div><div class="cp-flavor-type">Unique to ${esc(name)}</div></div>`).join('\n        ')}
      </div>
    </section>

    <section class="cp-section">
      <h2>Snacking Culture &amp; Occasions</h2>
      <p>${esc(c.snackCulture)}</p>
      <ul class="cp-occasions">
        ${d.occasions.map((o) => `<li>${esc(o)}</li>`).join('\n        ')}
      </ul>
    </section>

    <section class="cp-section">
      <h2>Did You Know?</h2>
      <div class="cp-funfact">
        <p>${esc(d.funFact)}</p>
      </div>
    </section>

    <section class="cp-section" id="shop">
      <h2>Try ${esc(name)} Chips at Home</h2>
      <p>Want to taste authentic ${esc(name)} flavors? Check out our top picks on Amazon:</p>
      <div style="display:flex;flex-direction:column;gap:.5rem;margin-top:.8rem">
            ${shopLinks(name)}
      </div>
      <p class="aff-disc">As an Amazon Associate, World of Chips earns from qualifying purchases. This doesn&#8217;t affect our editorial content &#8212; we only feature products we genuinely think chip lovers will enjoy.</p>
    </section>

    <nav class="cp-cta" aria-label="More country guides">
      <h2>More Chip Guides</h2>
      <div class="cp-explore-grid">${related.map(link).join('')}</div>
      <p style="margin-top:2rem">Explore chip culture in other countries:</p>
      <div class="cp-explore-grid">${others.map(link).join('')}</div>
      <p style="margin-top:2rem"><a href="/" class="cp-explore-link">🌍 Back to the Global Chip Map</a></p>
    </nav>
  </div>
</article>
</main>

${footerHtml}

</body>
</html>
`;
}

// ---------- 4. write outputs ----------
fs.mkdirSync(path.join(ROOT, 'assets'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'assets', 'site.css'),
  '/* GENERATED by scripts/build_country_pages.mjs from the <style> block in index.html. Do not edit by hand. */\n' + css);

for (const x of countries) {
  const dir = path.join(ROOT, x.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), renderPage(x));
}

// The /news/ entry is owned by scripts/build_news.mjs; keep it (lastmod = newest story)
// so running either build leaves the same sitemap.
const newsPath = path.join(ROOT, 'data', 'news.json');
const newsLastmod = fs.existsSync(newsPath)
  ? JSON.parse(fs.readFileSync(newsPath, 'utf8')).map((s) => s.date).sort().pop()
  : null;
const urls = [
  { loc: `${SITE}/`, freq: 'weekly', pri: '1.0' },
  ...(newsLastmod ? [{ loc: `${SITE}/news/`, freq: 'weekly', pri: '0.7', lastmod: newsLastmod }] : []),
  ...sorted.map((x) => ({ loc: `${SITE}/${x.slug}/`, freq: 'monthly', pri: '0.8' })),
];
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'),
  '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls.map((u) => `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${u.lastmod || LASTMOD}</lastmod>\n    <changefreq>${u.freq}</changefreq>\n    <priority>${u.pri}</priority>\n  </url>\n`).join('') +
  '</urlset>\n');

// index.html: generated regions only
function replaceRegion(html, key, body) {
  const start = `<!-- BUILD:${key}:START -->`;
  const end = `<!-- BUILD:${key}:END -->`;
  const { a, b } = between(html, start, end);
  return html.slice(0, a + start.length) + '\n' + body + '\n' + html.slice(b);
}
const slugList = JSON.stringify(sorted.map((x) => x.slug));
indexHtml = replaceRegion(indexHtml, 'HASH-REDIRECT',
`<!-- Generated by scripts/build_country_pages.mjs: legacy #/chips/<slug> URLs redirect to /<slug>/ -->
<script>
(function(){var m=location.hash.match(/^#\\/chips\\/([a-z0-9-]+)\\/?$/i);if(!m)return;var s=m[1].toLowerCase(),k=${slugList};if(k.indexOf(s)>-1)location.replace('/'+s+'/');})();
</script>`);
indexHtml = replaceRegion(indexHtml, 'COUNTRY-LINKS',
`<!-- Generated by scripts/build_country_pages.mjs -->
<section id="countries" class="content-section">
  <div class="section-eyebrow">Country Guides</div>
  <h2 class="section-title">Explore Chips by Country</h2>
  <p class="section-sub">Brands, flavors, snacking culture and shop picks for every country we cover.</p>
  <div class="cp-explore-grid">
    ${sorted.map(link).join('\n    ')}
  </div>
</section>`);
fs.writeFileSync(indexPath, indexHtml);

console.log(`Built ${countries.length} country pages (lastmod ${LASTMOD}):`);
for (const x of sorted) console.log(`  /${x.slug}/`);
