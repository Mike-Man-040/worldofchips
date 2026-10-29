#!/usr/bin/env node
// Build static, crawlable country pages for worldofchips.com.
//
// Source of truth: the inline country data/content JS inside index.html
// (countryData, brandUrls, countryContent, and the per-country shop picks).
// This script evaluates those exact snippets in a sandbox (no DOM, no deps),
// then writes:
//   /<slug>/index.html      one server-rendered page per country
//   /assets/site.css        the homepage's inline CSS, extracted verbatim
//   /sitemap.xml            homepage + every country URL (keeps /news/ and /snack-boxes/)
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
const siteNav = between(indexHtml, '<!-- SITE-NAV:START', '<!-- SITE-NAV:END -->').text + '<!-- SITE-NAV:END -->';

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

// Newsletter (MailerLite): the universal loader before </head> and the signup form markup
// (embed div + fallback + privacy note) are reused verbatim from index.html, so the form id
// and wording live in one place. Pages get a compact block around that shared markup.
const mlUniversal = between(indexHtml, '<!-- MailerLite Universal -->', '<!-- End MailerLite Universal -->').text +
  '<!-- End MailerLite Universal -->';
if (!/ml\('account', '\d+'\)/.test(mlUniversal)) throw new Error('MailerLite universal snippet not found / account id missing');
const nlFormRaw = between(indexHtml, '<!-- NEWSLETTER-FORM:START', '<!-- NEWSLETTER-FORM:END -->').text;
const nlForm = nlFormRaw.slice(nlFormRaw.indexOf('-->') + 3).split('\n').map((l) => l.replace(/^ {4}/, '')).join('\n').trim();
if (!/class="ml-embedded" data-form="[A-Za-z0-9]+"/.test(nlForm)) throw new Error('MailerLite embed div not found in NEWSLETTER-FORM region');
const newsletterBlock = (indent) => `<aside class="nl nl-compact" id="newsletter" aria-labelledby="nl-title">
<h2 id="nl-title">Get the monthly Chip Report</h2>
<p class="nl-pitch">New and weird chips from around the world, once a month. No spam.</p>
${nlForm}
</aside>`.split('\n').map((l, i) => (i ? indent + (l.startsWith('<aside') || l.startsWith('</aside') ? '' : '  ') + l : l)).join('\n');

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
    `<a href="${esc(l.u)}" target="_blank" rel="sponsored nofollow noopener" style="display:flex;align-items:center;gap:.8rem;padding:.7rem 1rem;background:var(--paper);border:1px solid var(--light-border);border-radius:10px;text-decoration:none;color:var(--ink);transition:all .3s"><div style="flex:1"><div style="font-weight:700;font-size:.88rem">${esc(l.n)}</div><div style="font-size:.72rem;color:var(--muted)">${esc(l.d)}</div></div><span style="color:var(--gold);font-weight:700">Shop &#8594;</span></a>`,
  ).join('\n            ');
}

function relatedCountries(x) {
  // Same region first, then alphabetical neighbours, max 6.
  const same = sorted.filter((o) => o.slug !== x.slug && o.d.region === x.d.region);
  const rest = sorted.filter((o) => o.slug !== x.slug && o.d.region !== x.d.region);
  return [...same, ...rest].slice(0, 6);
}

// Cross-link the Asian snack-box comparison (/snack-boxes/, built by build_snack_boxes.mjs).
const SNACK_BOX_COPY = {
  japan: 'Want a box of Japanese snacks delivered? We compared Bokksu, TokyoTreat, Sakuraco, Japan Candy Box and more on price, contents (including which ones pack chips) and shipping to Europe.',
  'south-korea': 'Want Korean snacks delivered? Our snack-box guide covers Daebak\u2019s seasonal SnackFever box from Seoul alongside the best Japanese boxes, with verified prices and shipping costs.',
};
function snackBoxCallout(slug) {
  if (!SNACK_BOX_COPY[slug]) return '';
  return `    <section class="cp-section" id="snack-boxes">
      <h2>Snack Box Subscriptions</h2>
      <p>${esc(SNACK_BOX_COPY[slug])}</p>
      <p><a href="/snack-boxes/" class="cp-explore-link">🍱 Compare Asian snack boxes &#8594;</a></p>
    </section>

`;
}

// Cross-link the buyer's guides (built by build_guides.mjs).
const GUIDE_LINKS = {
  japan: [['christmas-chip-gifts-2026', '🎄 Christmas chip gift guide 2026'], ['best-japanese-chips', '🇯🇵 Best Japanese chips to buy online'], ['best-international-chip-variety-packs', '🌍 Best international chip variety packs'], ['where-to-buy-asian-chips-europe', '🇪🇺 Where to buy Asian chips in Europe']],
  'south-korea': [['christmas-chip-gifts-2026', '🎄 Christmas chip gift guide 2026'], ['best-korean-chips-to-buy-online', '🇰🇷 Best Korean chips to buy online'], ['where-to-buy-asian-chips-europe', '🇪🇺 Where to buy Honey Butter Chip in Europe'], ['best-international-chip-variety-packs', '🌍 Best international chip variety packs'], ['best-japanese-chips', '🇯🇵 Best Japanese chips to buy online']],
  mexico: [['christmas-chip-gifts-2026', '🎄 Christmas chip gift guide 2026'], ['best-mexican-chips-to-buy-online', '🇲🇽 Best Mexican chips to buy online'], ['spiciest-chips-you-can-buy', '🌶️ Spiciest chips you can buy (Takis & more)'], ['where-to-buy-asian-chips-europe', '🇪🇺 Where to buy Takis in the UK & Europe'], ['best-international-chip-variety-packs', '🌍 Best international chip variety packs']],
  'united-kingdom': [['christmas-chip-gifts-2026', '🎄 Christmas chip gift guide 2026'], ['best-british-crisps-to-buy-online', '🇬🇧 Best British crisps to buy online'], ['best-chip-gift-boxes', '🎁 Chip gift boxes (incl. Monster Munch)'], ['where-to-buy-asian-chips-europe', '🇬🇧 Where to buy Takis & imported chips in the UK'], ['best-international-chip-variety-packs', '🌍 Best international chip variety packs']],
  'united-states': [['spiciest-chips-you-can-buy', '🌶️ Spiciest chips you can buy'], ['best-chip-gift-boxes', '🎁 Best chip gift boxes'], ['best-international-chip-variety-packs', '🌍 Best international chip variety packs to buy online'], ['best-japanese-chips', '🇯🇵 Best Japanese chips to buy online']],
  germany: [['best-international-chip-variety-packs', '🌍 Best international chip variety packs'], ['where-to-buy-asian-chips-europe', '🇪🇺 Where to buy imported chips in Europe']],
  china: [['christmas-chip-gifts-2026', '🎄 Christmas chip gift guide 2026'], ['best-international-chip-variety-packs', '🌍 Best exotic Asian chip variety packs'], ['best-japanese-chips', '🇯🇵 Best Japanese chips to buy online']],
  france: [['best-international-chip-variety-packs', '🌍 Best international chip variety packs'], ['where-to-buy-asian-chips-europe', '🇪🇺 Where to buy imported chips in Europe']],
  netherlands: [['best-international-chip-variety-packs', '🌍 Best international chip variety packs'], ['where-to-buy-asian-chips-europe', '🇪🇺 Where to buy imported chips in Europe']],
  poland: [['best-international-chip-variety-packs', '🌍 Best international chip variety packs'], ['where-to-buy-asian-chips-europe', '🇪🇺 Where to buy imported chips in Europe']],
  russia: [['best-international-chip-variety-packs', '🌍 Best international chip variety packs']],
  argentina: [['best-international-chip-variety-packs', '🌍 Best international chip variety packs']],
  egypt: [['best-international-chip-variety-packs', '🌍 Best international chip variety packs']],
  thailand: [['best-international-chip-variety-packs', '🌍 Best exotic Asian chip variety packs']],
  india: [['best-international-chip-variety-packs', '🌍 Best international chip variety packs']],
  spain: [['best-international-chip-variety-packs', '🌍 Best international chip variety packs']],
  brazil: [['best-international-chip-variety-packs', '🌍 Best international chip variety packs']],
  sweden: [['best-international-chip-variety-packs', '🌍 Best international chip variety packs'], ['where-to-buy-asian-chips-europe', '🇪🇺 Where to buy imported chips in Europe']],
};
// Community finds: moderated visitor submissions from data/community_flavors.json (see README).
// Entry: { "id": "2026-11-uk-1", "country": "united-kingdom", "city": "Leeds", "flavor": "Chip Shop Curry",
//   "brand": "Seabrook", "description": "...", "credit": "@handle" (or ""), "photo": "/assets/community/x.jpg" (or ""),
//   "approved": "2026-11-02" }
const COMMUNITY = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'community_flavors.json'), 'utf8'));
for (const e of COMMUNITY) {
  for (const k of ['id', 'country', 'flavor', 'brand', 'description', 'approved']) if (!e[k]) throw new Error(`community_flavors.json: entry ${e.id || '?'} missing ${k}`);
  if (!fs.existsSync(path.join(ROOT, e.country, 'index.html')) && !Object.values(countryContent).some((c) => c.slug === e.country)) throw new Error(`community_flavors.json: unknown country ${e.country}`);
  if (e.photo && !fs.existsSync(path.join(ROOT, e.photo.replace(/^\//, '')))) throw new Error(`community_flavors.json: photo not found ${e.photo}`);
}
function communityCard(e, withCountry) {
  return `<li style="background:var(--paper);border:1px solid var(--light-border);border-radius:12px;padding:.9rem 1rem;margin-bottom:.8rem;list-style:none">${e.photo ? `<img src="${esc(e.photo)}" alt="${esc(e.brand + ' ' + e.flavor)}" loading="lazy" style="width:100%;max-width:320px;height:auto;border-radius:8px;display:block;margin-bottom:.5rem">` : ''}<strong style="font-family:'Playfair Display',serif;color:var(--brown)">${esc(e.brand)} ${esc(e.flavor)}</strong>${withCountry ? ` &#183; <a href="/${esc(e.country)}/">${esc(e.country.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' '))}</a>` : ''}${e.city ? ` &#183; ${esc(e.city)}` : ''}<p style="margin:.3rem 0 0">${esc(e.description)}</p><p style="font-size:.75rem;color:var(--muted);margin-top:.3rem">${e.credit ? `Spotted by ${esc(e.credit)}` : 'Community submission'}, added ${esc(e.approved)}</p></li>`;
}
function communitySection(slug) {
  const list = COMMUNITY.filter((e) => e.country === slug);
  if (!list.length) return '';
  return `    <section class="cp-section" id="community">
      <h2>Community Finds</h2>
      <ul style="margin:1rem 0 0">${list.map((e) => communityCard(e, false)).join('')}</ul>
      <p><a href="/submit-a-flavor/" class="buy-btn">+ Add your local flavour</a></p>
    </section>

`;
}

function sourcesCallout(c) {
  if (!c.sources || !c.sources.length) return '';
  return `    <section class="cp-section" id="sources">
      <h2>Sources</h2>
      <p style="font-size:.75rem;color:var(--muted);line-height:1.6;word-break:break-word">${c.sources.map((u) => `<a href="${esc(u)}" target="_blank" rel="nofollow noopener" style="color:var(--muted)">${esc(u.replace(/^https?:\/\//, ''))}</a>`).join(', ')}</p>
    </section>

`;
}
function guideCallout(slug) {
  if (!GUIDE_LINKS[slug]) return '';
  return `    <section class="cp-section" id="buying-guides">
      <h2>Buying Guides</h2>
      <div class="cp-explore-grid">${GUIDE_LINKS[slug].map(([s, l]) => `<a href="/${s}/" class="cp-explore-link">${l} &#8594;</a>`).join('')}</div>
    </section>

`;
}


// ---------- Quick Facts + FAQ (for AI/LLM search) ----------
// Built ONLY from fields already rendered on the page (countryData / countryContent / shop picks /
// guide links). The 15 fully researched countries get 4 Q&As; the thinner ones get 3 conservative
// ones (brands, flavours, where to buy) and no history/"what makes it unique" answer.
const RESEARCHED = new Set(['japan', 'south-korea', 'united-kingdom', 'united-states', 'mexico', 'germany',
  'france', 'netherlands', 'poland', 'russia', 'argentina', 'egypt', 'thailand', 'india', 'spain', 'china', 'australia', 'italy', 'indonesia', 'canada', 'brazil', 'sweden']);
const listAnd = (a) => (a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`);
const sentences = (t) => t.match(/[^.!?]+[.!?]+(?=\s|$)/g)?.map((x) => x.trim()) || [t];
const words = (t) => t.split(/\s+/).filter(Boolean).length;
function capWords(parts, max = 65) {
  const out = [];
  for (const p of parts) { if (out.length && words([...out, p].join(' ')) > max) break; out.push(p); }
  return out.join(' ');
}
function shopNames(name) { return (csm[name] || defaultShop).map((l) => l.n); }
function buildFaq(x) {
  const { name, slug, d, c } = x;
  const N = inName(name);
  const qa = [];
  qa.push([`What are the most popular potato chip brands in ${N}?`,
    `The leading potato chip brands in ${N} are ${listAnd(d.topBrands)}, with ${d.topBrands[0]} at the top. ` +
    `They compete for shelf space in supermarkets, convenience stores and online` +
    (d.marketSize ? `, in a market estimated at ${d.marketSize}.` : '.') + ` An average bag costs about ${d.avgCost}.`]);
  qa.push([`What potato chip flavors are popular in ${N}?`,
    `The bestselling, most widely available flavors in ${N} are ${listAnd(d.popularFlavors)}. ` +
    `For something more distinctive, look for local specialities such as ${listAnd(d.uniqueFlavors)}. ` +
    `Chips are typically eaten during ${listAnd(d.occasions.slice(0, 3).map((o) => o.charAt(0).toLowerCase() + o.slice(1)))}.`]);
  if (RESEARCHED.has(slug)) {
    qa.push([`What makes potato chips in ${N} unique?`,
      capWords([...sentences(c.intro).slice(0, 2), d.funFact], 70)]);
  }
  const picks = shopNames(name).slice(0, 3);
  const guides = (GUIDE_LINKS[slug] || []).map(([, l]) => l.replace(/^\S+\s/, ''));
  qa.push([`Where can I buy chips from ${N} outside the country?`,
    `The easiest option is online: World of Chips lists Amazon picks for chips from ${N}, including ${listAnd(picks)}. ` +
    (guides.length ? `For more options, see our guides: ${listAnd(guides.slice(0, 2))}. ` : `Each pick links straight to its Amazon listing from this page. `) +
    'As an Amazon Associate, World of Chips earns from qualifying purchases.']);
  return qa;
}
function buyBox(x) {
  const picks = (csm[x.name] || defaultShop).slice(0, 3);
  return `    <aside class="cp-section buy-box" id="buy" aria-labelledby="buy-title">
      <h2 id="buy-title">Buy ${esc(inName(x.name))} Chips on Amazon</h2>
      <p>Our picks to taste ${esc(x.name)}&#8217;s chips at home:</p>
      <div class="buy-grid">
        ${picks.map((l) => `<a href="${esc(l.u)}" target="_blank" rel="sponsored nofollow noopener" class="buy-btn">${esc(l.n)} &#8594;</a>`).join('\n        ')}
      </div>
      <p class="aff-disc">As an Amazon Associate, World of Chips earns from qualifying purchases. <a href="#shop">More picks below</a>.</p>
    </aside>

`;
}
function quickFacts(x) {
  const { name, d, c } = x;
  const rows = [
    ['Leading brands', listAnd(d.topBrands)],
    ['Signature flavors', listAnd(d.popularFlavors)],
    ['Unique flavors', listAnd(d.uniqueFlavors)],
    ...(d.marketSize ? [['Market size', d.marketSize]] : []),
    ...(d.perCapita ? [['Per capita / year', d.perCapita]] : []),
    ['Average bag price', d.avgCost],
    ['Annual growth', d.growth],
    ['Typical occasions', listAnd(d.occasions)],
    ['Notable fact', d.funFact],
    ['Where to buy', `Online via Amazon (e.g. ${listAnd(shopNames(name).slice(0, 2))})`],
  ];
  return `    <section class="cp-section" id="quick-facts">
      <h2>Quick Facts: Chips in ${esc(inName(name))}</h2>
      <table class="cp-facts">
        <caption>Key facts about potato chips in ${esc(inName(name))}</caption>
        <tbody>
${rows.map(([k, v]) => `          <tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`).join('\n')}
        </tbody>
      </table>
    </section>

`;
}
function faqSection(x, qa) {
  return `    <section class="cp-section cp-faq" id="faq">
      <h2>FAQ: Potato Chips in ${esc(inName(x.name))}</h2>
${qa.map(([q, a]) => `      <h3>${esc(q)}</h3>\n      <p>${esc(a)}</p>`).join('\n')}
    </section>

`;
}

let FAQ_COUNT = 0;
const PC_SRC = { 'United States': ['IndexBox, 2024', 'https://www.indexbox.io/blog/potato-chips-world-market-overview-2024-5/'], 'Italy': ['IndexBox, 2024', 'https://www.indexbox.io/blog/potato-chips-world-market-overview-2024-5/'], 'Germany': ['IndexBox, 2024', 'https://www.indexbox.io/blog/potato-chips-world-market-overview-2024-5/'], 'South Korea': ['IndexBox, 2024', 'https://www.indexbox.io/blog/potato-chips-asia-market-overview-2024-3/'], 'Thailand': ['IndexBox, 2024', 'https://www.indexbox.io/blog/potato-chips-asia-market-overview-2024-3/'], 'United Kingdom': ['Euromonitor via Potato Business, 2017', 'https://www.potatobusiness.com/market/snackex-2017-the-brits-buy-65-of-total-savory-snacks-in-europe/'] };
const HOME_GUIDES = [['christmas-chip-gifts-2026', '🎄 Christmas chip gifts 2026'], ['christmas-snack-box-comparison-2026', '🍱 Christmas snack boxes compared'], ['pringles-index', '📊 The Pringles Index'], ['flavors', '🌍 Chip flavours of the world'], ['spiciest-chips', '🌶️ The chip spice ladder'], ['limited-edition-chips', '📅 Limited-edition drops'], ['which-chip-are-you', '❓ Which country\u2019s chip are you?'], ['make-chips-at-home', '🥔 Make chips at home'],['spiciest-chips-you-can-buy', '🌶️ Spiciest chips you can buy'], ['best-chip-gift-boxes', '🎁 Best chip gift boxes'],
  ['best-korean-chips-to-buy-online', '🇰🇷 Best Korean chips'], ['best-mexican-chips-to-buy-online', '🇲🇽 Best Mexican chips'],
  ['best-british-crisps-to-buy-online', '🇬🇧 Best British crisps'], ['best-japanese-chips', '🇯🇵 Best Japanese chips'],
  ['best-international-chip-variety-packs', '🌍 International variety packs'], ['where-to-buy-asian-chips-europe', '🇪🇺 Buying chips in Europe'],
  ['snack-boxes', '🍱 Snack boxes compared']];
const link = (o) => `<a href="/${o.slug}/" class="cp-explore-link">${o.d.flag} ${esc(o.name)}</a>`;

// Hand-written SEO titles/descriptions for pages already ranking on page 1 (GSC, Oct 2026). Facts from each page's own data.
const SEO = {
  argentina: ['Argentina Chips: Asado & Jamón Serrano Flavors | World of Chips', "Argentina's chips beyond Lay's: Pehuamar, Krachitos and flavors like Jamón Serrano and Asado. Top brands, unique flavors and where to buy."],
  poland: ['Polish Chips: Green Onion, Paprika & Crunchips | World of Chips', "Why Poles love Zielona Cebulka (green onion) chips: Lay's, Crunchips and Pringles in Poland, top flavors, unique picks and where to buy."],
  russia: ['Russian Chips: Crab & Sour Cream Flavors | World of Chips', "Crab and sour cream & herbs chips: Lay's, Московский Картофель and Русская Картошка. Russia's top brands, odd flavors and where to buy."],
  brazil: ['Brazilian Chips: Ruffles, Churrasco & More | World of Chips', "Churrasco-flavored chips and more: Ruffles, Lay's and Pringles in Brazil, the flavors Brazilians buy, unique picks and where to find them."],
  peru: ['Peruvian Chips: Ají Amarillo & Limón y Sal | World of Chips', "Ají Amarillo and Limón y Sal chips: Lay's, Pringles and Mr. Chips in Peru. Top brands, Peruvian flavors and where to buy them."],
  colombia: ['Colombian Chips: Margarita, Super Ricas & More | World of Chips', "Margarita, Super Ricas and De Todito: Colombia's top chip brands, Limón and Chicharrón flavors, fun facts and where to buy."],
  france: ['French Chips: Poulet Rôti, Bret\'s & Vico | World of Chips', "Roast-chicken chips and goat's cheese & chilli: Lay's, Bret's and Vico in France. Top brands, unique flavors and where to buy."],
  'south-korea': ['Korean Chips: Honey Butter, Octopus & More | World of Chips', "Honey Butter, Octopus and more: Nongshim, Orion and Calbee chips in South Korea. Top brands, the flavors to try and where to buy."],
  germany: ['German Chips: Currywurst, Paprika & Lorenz | World of Chips', "Currywurst and Döner chips: Lorenz, Funny-Frisch and Chio in Germany. Why Paprika rules, unique flavors and where to buy."],
};
// ---------- 3. page template ----------
function renderPage(x) {
  const { name, slug, d, c } = x;
  const url = `${SITE}/${slug}/`;
  const title = SEO[slug] ? SEO[slug][0] : `Potato Chips in ${inName(name)}: ${d.topBrands.slice(0, 2).join(', ')} & Top Flavors | World of Chips`;
  const desc = truncate(
    `Potato chips in ${inName(name)}: top brands like ${d.topBrands.slice(0, 3).join(', ')}, ` +
    `popular flavors such as ${d.popularFlavors.slice(0, 2).join(' and ')}, unique flavors like ` +
    `${d.uniqueFlavors.slice(0, 2).join(' and ')}, fun facts and where to buy.`, 160);
  const descFinal = SEO[slug] ? SEO[slug][1] : desc;
  const faq = buildFaq(x);
  FAQ_COUNT += faq.length;
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
      {
        '@type': 'FAQPage',
        '@id': `${url}#faq`,
        mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
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
<meta name="description" content="${esc(descFinal)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="article">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(descFinal)}">
<meta property="og:site_name" content="World of Chips">
<meta property="og:image" content="${SITE}/assets/og/${slug}.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(title)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/assets/og/${slug}.png">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(descFinal)}">
<script type="application/ld+json">
${jsonLd(ld)}
</script>
${fontsLink}
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="stylesheet" href="/assets/site.css">
<style>
.nav-logo a{color:inherit;text-decoration:none;display:flex;align-items:center;gap:.5rem}
.cp-crumbs{font-size:.75rem;color:var(--muted);margin-bottom:1rem}
.cp-crumbs a{color:var(--gold);text-decoration:none}
.cp-facts{width:100%;border-collapse:collapse;font-size:.88rem;background:var(--paper);border:1px solid var(--light-border);border-radius:10px;overflow:hidden}
.cp-facts caption{text-align:left;font-size:.75rem;color:var(--muted);padding-bottom:.4rem}
.cp-facts th,.cp-facts td{padding:.55rem .9rem;border-bottom:1px solid var(--light-border);text-align:left;vertical-align:top}
.cp-facts th{width:34%;color:var(--brown);font-weight:700}
.buy-box{background:var(--paper);border:2px solid var(--gold);border-radius:14px;padding:1.2rem 1.3rem}
.buy-grid{display:flex;flex-wrap:wrap;gap:.6rem;margin:.8rem 0}
.buy-btn{display:inline-flex;align-items:center;min-height:48px;background:var(--gold);color:#fff;font-weight:700;padding:.8rem 1.5rem;border-radius:999px;text-decoration:none;font-size:.98rem}
.buy-btn:hover{filter:brightness(1.08)}
.cp-faq h3{font-size:1rem;color:var(--brown);margin-top:1.2rem}
.cp-faq p{margin-top:.3rem}
.cp-cta h2{font-family:'Playfair Display',serif;font-size:1.3rem;color:var(--brown);margin-bottom:.6rem}
</style>
${mlUniversal}
</head>
<body>

${siteNav}

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

${quickFacts(x)}${buyBox(x)}
    <div class="cp-stats">
${d.marketSize ? `      <div class="cp-stat"><div class="val">${esc(d.marketSize)}</div><div class="lbl">Market Size</div></div>\n` : ''}${d.perCapita ? `      <div class="cp-stat"><div class="val">${esc(d.perCapita)}</div><div class="lbl">Per Capita / Year</div></div>\n` : ''}      <div class="cp-stat"><div class="val">${esc(d.avgCost)}</div><div class="lbl">Avg. Bag Price</div></div>
      <div class="cp-stat"><div class="val">${esc(d.growth)}</div><div class="lbl">Annual Growth</div></div>
    </div>
    ${PC_SRC[name] ? `<p style="font-size:.72rem;color:var(--muted);margin-top:.4rem">Per-capita source: <a href="${PC_SRC[name][1]}" target="_blank" rel="nofollow noopener" style="color:var(--muted)">${PC_SRC[name][0]}</a> (potato-chip consumption per person; methods differ between sources).</p>` : ''}${d.perCapita && d.perCapita.includes('est.') ? '<p style="font-size:.72rem;color:var(--muted);margin-top:.4rem">Per-capita figure is an editorial estimate, not an official statistic. <a href="/#consumption">How we estimate</a>.</p>' : ''}

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

${faqSection(x, faq)}${snackBoxCallout(slug)}${guideCallout(slug)}${communitySection(slug)}${sourcesCallout(c)}    <section class="cp-section" id="shop">
      <h2>Try ${esc(name)} Chips at Home</h2>
      <p>Want to taste authentic ${esc(name)} flavors? Check out our top picks on Amazon:</p>
      <div style="display:flex;flex-direction:column;gap:.5rem;margin-top:.8rem">
            ${shopLinks(name)}
      </div>
      <p class="aff-disc">As an Amazon Associate, World of Chips earns from qualifying purchases. This doesn&#8217;t affect our editorial content &#8212; we only feature products we genuinely think chip lovers will enjoy.</p>
    </section>

    ${newsletterBlock('    ')}

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
// Likewise /snack-boxes/ is owned by scripts/build_snack_boxes.mjs; keep it with the
// lastmod (dateModified) of the generated page.
const snackPath = path.join(ROOT, 'snack-boxes', 'index.html');
const snackLastmod = fs.existsSync(snackPath)
  ? (fs.readFileSync(snackPath, 'utf8').match(/"dateModified":"(\d{4}-\d{2}-\d{2})"/) || [])[1]
  : null;
if (fs.existsSync(snackPath) && !snackLastmod) throw new Error('snack-boxes/index.html has no dateModified');
// Buyer's guides and the other pages built by build_guides.mjs (flavours, calendar, quiz...) own their
// sitemap entries; keep every existing entry this script doesn't own, in order, if its page still exists.
const ownLocs = new Set([`${SITE}/`, `${SITE}/news/`, `${SITE}/snack-boxes/`, ...sorted.map((x) => `${SITE}/${x.slug}/`)]);
const prevSitemap = fs.existsSync(path.join(ROOT, 'sitemap.xml')) ? fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8') : '';
const guideUrls = [...prevSitemap.matchAll(/<url>\s*<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>\s*<changefreq>([^<]+)<\/changefreq>\s*<priority>([^<]+)<\/priority>\s*<\/url>/g)]
  .filter((m) => !ownLocs.has(m[1]) && fs.existsSync(path.join(ROOT, m[1].slice(SITE.length + 1), 'index.html')))
  .map((m) => ({ loc: m[1], lastmod: m[2], freq: m[3], pri: m[4] }));
const urls = [
  { loc: `${SITE}/`, freq: 'weekly', pri: '1.0' },
  ...(newsLastmod ? [{ loc: `${SITE}/news/`, freq: 'weekly', pri: '0.7', lastmod: newsLastmod }] : []),
  ...(snackLastmod ? [{ loc: `${SITE}/snack-boxes/`, freq: 'monthly', pri: '0.8', lastmod: snackLastmod }] : []),
  ...guideUrls,
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
const recent = [...COMMUNITY].sort((a, b) => b.approved.localeCompare(a.approved)).slice(0, 6);
indexHtml = replaceRegion(indexHtml, 'COMMUNITY',
`<!-- Generated by scripts/build_country_pages.mjs from data/community_flavors.json -->
${recent.length ? `<h3 class="section-sub" style="margin-top:2rem;font-weight:700">Community Finds</h3>
<ul style="margin:1rem auto 0;max-width:720px;padding:0">${recent.map((e) => communityCard(e, true)).join('')}</ul>
` : ''}<p style="text-align:center;margin-top:1.5rem"><a href="/submit-a-flavor/" class="btn-primary">+ Add your local flavour</a></p>`);
indexHtml = replaceRegion(indexHtml, 'COUNTRY-LINKS',
`<!-- Generated by scripts/build_country_pages.mjs -->
<section id="countries" class="content-section">
  <div class="section-eyebrow">Country Guides</div>
  <h2 class="section-title">Explore Chips by Country</h2>
  <p class="section-sub">Brands, flavors, snacking culture and shop picks for every country we cover.</p>
  <div class="cp-explore-grid">
    ${sorted.map(link).join('\n    ')}
  </div>
  <h3 class="section-sub" style="margin-top:2.5rem;font-weight:700">Buying Guides</h3>
  <div class="cp-explore-grid">
    ${HOME_GUIDES.map(([s, l]) => `<a href="/${s}/" class="cp-explore-link">${l}</a>`).join('\n    ')}
  </div>
</section>`);
fs.writeFileSync(indexPath, indexHtml);

console.log(`Built ${countries.length} country pages (lastmod ${LASTMOD}), ${FAQ_COUNT} FAQ Q&As:`);
for (const x of sorted) console.log(`  /${x.slug}/`);
