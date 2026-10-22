#!/usr/bin/env node
// Build the buyer's guide pages of worldofchips.com:
//   /best-japanese-chips/              best Japanese chips to buy online
//   /where-to-buy-asian-chips-europe/  where to buy Takis, Honey Butter Chip & co. in Europe
//
// Source of truth: the GUIDES data below. Every fact and price was checked on LAST_CHECKED on the
// page listed in that section's `sources`. Prices are only quoted with that date; re-check and
// update LAST_CHECKED before changing any figure. Amazon product links are tagged amazon.com
// searches unless the ASIN page itself was opened and showed the item in stock (VERIFIED_ASINS).
// Head bits (GA, fonts) and the footer are copied from index.html, like the other generated pages.
//
// Writes (deterministically, no timestamps):
//   <slug>/index.html for each guide
//   sitemap.xml        one <url> entry per guide (after /snack-boxes/)
//
// Usage:  node scripts/build_guides.mjs           write files
//         node scripts/build_guides.mjs --check   exit 1 if any output is out of date
// build_country_pages.mjs, build_news.mjs and build_snack_boxes.mjs preserve these sitemap entries.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.on('uncaughtException', (e) => { console.error(`build_guides: ${e.message}`); process.exit(1); });

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://worldofchips.com';
const CHECK = process.argv.includes('--check');
const LAST_CHECKED = '2026-10-22';
const LAST_CHECKED_LABEL = '22 October 2026';
const AMAZON_TAG = 'wordofchipspr-20';

// ASIN pages opened on LAST_CHECKED and showing the product in stock on amazon.com.
const VERIFIED_ASINS = {
  B01K9A9V50: 'Haitai Honey Butter Chips, 2.11 oz, pack of 3: $14.50, in stock',
};

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const jsonLd = (o) => JSON.stringify(o).replace(/</g, '\\u003c');
const stripTags = (s) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#8217;/g, '\u2019')
  .replace(/&#8211;/g, '\u2013').replace(/&#8212;/g, '\u2014').replace(/&#8364;/g, '\u20ac').replace(/&#163;/g, '\u00a3')
  .replace(/&#233;/g, '\u00e9').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
function between(src, start, end) {
  const a = src.indexOf(start);
  if (a < 0) throw new Error(`Marker not found: ${start}`);
  const b = src.indexOf(end, a + start.length);
  if (b < 0) throw new Error(`End marker not found after ${start}: ${end}`);
  return { a, b, text: src.slice(a, b) };
}
const amazonSearch = (q) => `https://www.amazon.com/s?k=${q.trim().split(/\s+/).map(encodeURIComponent).join('+')}&tag=${AMAZON_TAG}`;
const amazonDp = (asin) => {
  if (!VERIFIED_ASINS[asin]) throw new Error(`ASIN ${asin} not in VERIFIED_ASINS`);
  return `https://www.amazon.com/dp/${asin}?tag=${AMAZON_TAG}`;
};
const amz = (href, label) => `<a href="${esc(href)}" target="_blank" rel="sponsored nofollow noopener">${label}</a>`;
const ext = (href, label) => `<a href="${esc(href)}" target="_blank" rel="nofollow noopener">${label}</a>`;
const srcLink = (u) => ext(u, esc(u.replace(/^https?:\/\//, '')));
const DISCLOSURE = 'As an Amazon Associate, World of Chips earns from qualifying purchases. Links marked &#8220;on Amazon&#8221; are affiliate links. This doesn&#8217;t affect our editorial content &#8212; we only feature products we genuinely think chip lovers will enjoy.';

// ---------- guide data ----------
const GUIDES = [
  {
    slug: 'best-japanese-chips',
    flag: '🇯🇵',
    crumb: 'Best Japanese Chips',
    h1: 'The Best Japanese Chips to Buy Online (2026 Guide)',
    title: 'Best Japanese Chips to Buy Online in 2026: Calbee, Koikeya & More | World of Chips',
    desc: 'The Japanese potato chips worth ordering online: Calbee Usushio, Norishio and Consomm\u00e9 Punch, Koikeya Karamucho and more, with launch dates, what each tastes like and where to buy.',
    introDark: 'The classic bags Japan has been crunching since the 1960s and 70s, which ones to try first, and how to get them delivered without overpaying.',
    intro: 'Japanese chips are thin, light and built around savoury seasonings &#8212; seaweed, consomm&#233;, chilli with an umami backbone &#8212; rather than the vinegar-and-cheese profiles of Europe and the US. Two companies dominate the shelf: <strong>Calbee</strong>, which launched its first potato chip in 1975, and <strong>Koikeya</strong>, which launched its seaweed-salt Norishio chip back in 1962. Below are the bags we think are worth importing, why, and how to buy them sensibly from outside Japan.',
    sections: [
      { id: 'picks', h2: 'Our Picks', items: [
        ['Calbee Potato Chips Usushio (Lightly Salted)', 'Calbee&#8217;s very first potato chip, launched in 1975. Lightly salted and very thin &#8212; the baseline every other Japanese flavour is measured against.', amazonSearch('calbee usushio potato chips')],
        ['Calbee Potato Chips Norishio (Seaweed Salt)', 'Released in 1976 as the first &#8220;different flavour&#8221; in Calbee&#8217;s potato chip line. Aonori seaweed and salt: the most distinctly Japanese of the classics.', amazonSearch('calbee norishio potato chips')],
        ['Calbee Consomm&#233; Punch', 'Launched in 1978; &#8220;punch&#8221; was 70s slang for energy. Sold as plain &#8220;Consomm&#233;&#8221; from 1980 to 1992 before the original name returned. A meaty, onion-and-broth flavour with no real Western equivalent.', amazonSearch('calbee consomme punch potato chips')],
        ['Koikeya Karamucho Hot Chili', 'Koikeya&#8217;s hot-chilli chip, made since 1984. The heat comes layered on a meat-and-vegetable savoury base, so it is spicy but not one-note. Also sold as thin potato sticks.', amazonSearch('koikeya karamucho hot chili potato chips')],
        ['Koikeya Pride Potato Kami-Norishio', 'Koikeya&#8217;s premium line. Kami-Norishio uses three kinds of seaweed plus chilli pepper and sesame oil &#8212; a richer take on the classic norishio.', amazonSearch('koikeya pride potato')],
        ['Calbee Potato Chips Louisiana', 'Calbee&#8217;s 1983 thick, crinkle-cut chip, made for people who wanted a harder chip for dipping. Harder to find abroad than the thin classics.', amazonSearch('calbee louisiana potato chips')],
      ] },
    ],
    extra: `
    <section class="cp-section" id="buying-tips">
      <h2>How to Buy Japanese Chips Online Without Overpaying</h2>
      <ul class="sb-list">
        <li><strong>Check the pack count and weight.</strong> Japanese bags are small (often around 55&#8211;60 g), and import listings range from a single bag to cases of 12, so compare the price per ounce or per 100 g rather than the headline price. On one Consomm&#233; Punch listing, a reviewer complained they expected 12 bags and received one.</li>
        <li><strong>Expect import prices.</strong> When we searched Amazon.com on ${LAST_CHECKED_LABEL}, Koikeya Karamucho Hot Chili 2.01 oz in a pack of 12 was listed at $49.98 &#8212; several times the Japanese shelf price. That&#8217;s normal for imported chips; buy multipacks to spread the shipping cost.</li>
        <li><strong>Check who ships it.</strong> Many listings are third-party importers. Look at the &#8220;ships from / sold by&#8221; line and the best-before date where it is shown.</li>
        <li><strong>In Europe?</strong> Amazon.com links go to the US store. See our <a href="/where-to-buy-asian-chips-europe/">guide to buying Asian chips in Europe</a> for EU-based shops, and note that the EU ended its customs-duty exemption for parcels under &#8364;150 on 1 July 2026.</li>
        <li><strong>Want variety instead?</strong> A Japanese snack box sends a mix of chips, candy and seasonal snacks. Our <a href="/snack-boxes/">snack box comparison</a> shows which boxes include the most chips.</li>
      </ul>
    </section>`,
    faqs: [
      ['What is the most popular Japanese chip brand?', 'Calbee is Japan&#8217;s best-known potato chip maker; its first potato chip, Usushio (lightly salted), launched in 1975. Koikeya is the other big name and is even older in chips: it launched its Norishio seaweed-salt chip in 1962.'],
      ['What does Consomm&#233; Punch taste like?', 'It is seasoned like a consomm&#233; broth: savoury, meaty and oniony rather than salty-sour. Calbee launched it in 1978 and it sold as plain &#8220;Consomm&#233;&#8221; between 1980 and 1992.'],
      ['Are Karamucho chips very spicy?', 'Karamucho is Koikeya&#8217;s hot-chilli chip, made since 1984. Koikeya describes it as chilli heat mixed with a meat-and-vegetable savoury flavour, so it is noticeably hot but rounder than a pure chilli chip.'],
      ['Why are Japanese chips so expensive on Amazon?', 'Most listings are imported multipacks sold by third-party sellers, so you pay for shipping and handling as well as the chips. Compare price per ounce and buy larger packs to get a better unit price.'],
    ],
    sources: [
      'https://www.calbee.co.jp/en/corporate/history/product.php',
      'https://note.calbee.jp/n/n216c069a4898?hl=en',
      'https://faq.calbee.co.jp/faq_detail.html?id=1209',
      'https://koike-ya.com/en/',
    ],
    related: [['japan', '🇯🇵 Japan chip guide'], ['south-korea', '🇰🇷 South Korea'], ['snack-boxes', '🍱 Snack boxes compared'], ['where-to-buy-asian-chips-europe', '🇪🇺 Buying in Europe']],
  },
  {
    slug: 'where-to-buy-asian-chips-europe',
    flag: '🇪🇺',
    crumb: 'Where to Buy in Europe',
    h1: 'Where to Buy Takis, Honey Butter Chip and Other Imported Chips in Europe',
    title: 'Where to Buy Takis & Honey Butter Chip in Europe (2026) | World of Chips',
    desc: 'Which UK supermarkets stock Takis, which EU online shops sell Haitai Honey Butter Chip and at what price, and how to get Japanese and Korean chips delivered in Europe. Checked October 2026.',
    introDark: 'Real stockists and real prices, checked on the shops&#8217; own pages, for the viral chips Europeans keep asking about.',
    intro: 'Social media made Takis and Korea&#8217;s Honey Butter Chip famous far beyond their home markets, but finding them in a European shop is still hit-and-miss. This guide lists where they are actually sold, what they cost when we checked on ${LAST_CHECKED_LABEL}, and what to know about ordering from abroad. Prices change often, so treat them as a guide and confirm at checkout.',
    sections: [],
    extra: `
    <section class="cp-section" id="takis">
      <h2>Takis in the UK and Europe</h2>
      <p>Takis, the rolled tortilla chips made by Grupo Bimbo&#8217;s Barcel, first reached UK shelves in 2021 with the Fuego flavour. The brand&#8217;s first permanent UK supermarket listing came in February 2024, when Co-op put Fuego and Volcano into 600 stores. Blue Heat (chilli and lime, coloured with E133 Brilliant Blue) followed in 2025 at Co-op and Morrisons Daily, with a larger 180 g bag at Aldi. In July 2026 Takis added 55 g non-pricemarked packs of Fuego, Intense Nacho and Smokin&#8217; BBQ aimed at meal deals and vending.</p>
      <p><strong>Where to find them in the UK</strong> (according to the independent tracker Takis Near Me, updated 26 September 2026):</p>
      <ul class="sb-list">
        <li><strong>Morrisons</strong>: the most widely available, usually Fuego and Blue Heat in the main crisps aisle.</li>
        <li><strong>Co-op</strong>: medium and larger stores; the only confirmed stockist of Volcano.</li>
        <li><strong>Iceland</strong>: the widest in-store range (Fuego, Blue Heat, Intense Nacho, Smokin&#8217; BBQ).</li>
        <li><strong>Farmfoods</strong>: usually the cheapest, around &#163;1.49&#8211;&#163;1.59 a bag.</li>
        <li><strong>Aldi</strong>: as a rotating Specialbuy, not a permanent line.</li>
      </ul>
      <p>Tesco, Sainsbury&#8217;s, Asda and Lidl did not carry Takis as a regular range in 2026. Outside the UK, Takis has a European marketing team, but availability varies by country; Asian and American-food specialist shops and online import stores are the most reliable bet.</p>
      <p class="sb-sources">Sources: ${['https://www.thegrocer.co.uk/news/viral-tiktok-snacking-brand-takis-bags-permanent-co-op-listing/688264.article', 'https://www.thegrocer.co.uk/news/viral-snacking-brand-takis-brings-blue-heat-tortilla-chips-to-the-uk/701561.article', 'https://www.conveniencestore.co.uk/products/three-takis-flavours-are-to-get-new-non-pricemarked-packs/721928.article', 'https://www.takisnearme.co.uk/advice/where-to-buy-takis-in-the-uk', 'https://www.takisnearme.co.uk/advice/do-tesco-sainsburys-asda-lidl-sell-takis'].map(srcLink).join(', ')}</p>
    </section>

    <section class="cp-section" id="honey-butter-chip">
      <h2>Haitai Honey Butter Chip in Europe</h2>
      <p>Haitai&#8217;s Honey Butter Chip, the sweet-and-buttery potato chip that became a Korean craze in 2014, is imported into Europe in its 60 g bag. These EU shops listed it when we checked on ${LAST_CHECKED_LABEL} (prices include VAT, shipping extra):</p>
      <div class="sb-table-wrap">
      <table class="sb-table">
        <thead><tr><th scope="col">Shop</th><th scope="col">Based in</th><th scope="col">Price (60 g)</th><th scope="col">Notes</th></tr></thead>
        <tbody>
        <tr><th scope="row">${ext('https://www.nanuko.de/en/p/haitai-honey-butter-chip-60g', 'Nanuko')}</th><td>Germany</td><td>&#8364;2.79</td><td>Delivers across the EU, no minimum order</td></tr>
        <tr><th scope="row">${ext('https://www.aasiamarket.fi/en/product/honey-butter-chips/', 'Aasia Market')}</th><td>Finland</td><td>&#8364;3.20</td><td>Shown in stock at its Oulu and Tampere stores</td></tr>
        <tr><th scope="row">${ext('https://mao-mao.de/en/products/haitai-honigbutter-kartoffelchips-60g', 'MAOMAO')}</th><td>Germany</td><td>&#8364;3.49</td><td>Listed as in stock</td></tr>
        <tr><th scope="row">${ext('https://www.worldofsweets.de/Produkte/Marke+Haitai/', 'World of Sweets')}</th><td>Germany</td><td>&#8364;3.49</td><td>Quoted delivery 2&#8211;4 days</td></tr>
        <tr><th scope="row">${ext('https://phomifood.com/products/haitai-honey-butter-chip-60-g', 'Phomifood')}</th><td>EU warehouse</td><td>&#8364;3.93</td><td>Delivers to 25+ European countries</td></tr>
        </tbody>
      </table>
      </div>
      <p>In the US, the 3-bag pack on Amazon.com (${amz(amazonDp('B01K9A9V50'), 'Haitai Honey Butter Chips on Amazon')}) was $14.50 and in stock on ${LAST_CHECKED_LABEL}.</p>
    </section>

    <section class="cp-section" id="japanese-korean">
      <h2>Japanese and Korean Chips: Other Options</h2>
      <ul class="sb-list">
        <li><strong>Asian supermarkets.</strong> Most large European cities have Asian grocers that carry Calbee, Koikeya, Orion and Nongshim; the German importer Kim&#8217;s Asia Import-Export supplies Honey Butter Chip to shops such as Nanuko.</li>
        <li><strong>Snack boxes.</strong> Bokksu, TokyoTreat, Sakuraco, Daebak and Japan Candy Box all ship to Europe. Our <a href="/snack-boxes/">snack box comparison</a> lists the European shipping prices and which boxes include the most chips.</li>
        <li><strong>Amazon.com</strong> has the widest choice of Japanese chips (see our <a href="/best-japanese-chips/">best Japanese chips guide</a>), but it is the US store: check at checkout whether an item ships to your country and what import fees apply.</li>
      </ul>
    </section>

    <section class="cp-section" id="customs">
      <h2>Customs and VAT When Ordering From Outside the EU</h2>
      <p>The EU removed its customs-duty exemption for parcels worth under &#8364;150 on 1 July 2026, so orders shipped from the US, Japan or Korea may now be charged duty on delivery as well as VAT. Buying from a shop that ships from inside the EU, like those in the table above, avoids that. The UK, Norway and Switzerland have their own rules.</p>
    </section>`,
    faqs: [
      ['Can you buy Takis in the UK?', 'Yes. According to Takis Near Me (updated September 2026), Morrisons, Co-op, Iceland, Farmfoods and Aldi (as a Specialbuy) stock Takis. Tesco, Sainsbury&#8217;s, Asda and Lidl did not carry them as a regular range in 2026.'],
      ['Where can I buy Honey Butter Chip in Europe?', 'EU online Asian grocers such as Nanuko (&#8364;2.79), Aasia Market (&#8364;3.20), MAOMAO and World of Sweets (&#8364;3.49 each) and Phomifood (&#8364;3.93) listed the 60 g bag when we checked on 22 October 2026. Shipping is extra.'],
      ['Do I pay customs on snacks ordered from the US or Asia?', 'Possibly. The EU dropped its duty exemption for parcels under &#8364;150 on 1 July 2026, so duty and VAT may be due on delivery. Ordering from a shop that ships from within the EU avoids this.'],
    ],
    sources: [],
    related: [['south-korea', '🇰🇷 South Korea chip guide'], ['mexico', '🇲🇽 Mexico'], ['united-kingdom', '🇬🇧 United Kingdom'], ['best-japanese-chips', '🇯🇵 Best Japanese chips'], ['snack-boxes', '🍱 Snack boxes compared']],
  },
];

// ---------- page template ----------
const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const gaSnippet = between(indexHtml, '<!-- Google tag (gtag.js) -->', '<meta charset').text.trim();
const fontsLink = (indexHtml.match(/<link href="https:\/\/fonts\.googleapis\.com[^>]*>/) || [])[0];
const footerHtml = between(indexHtml, '<footer>', '</footer>').text + '</footer>';

function render(g) {
  const url = `${SITE}/${g.slug}/`;
  for (const [s] of g.related) if (!fs.existsSync(path.join(ROOT, s, 'index.html')) && !GUIDES.some((x) => x.slug === s)) throw new Error(`missing page /${s}/`);
  const intro = g.intro.replace('${LAST_CHECKED_LABEL}', LAST_CHECKED_LABEL);
  const ld = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'Article', '@id': `${url}#article`, headline: g.h1, description: g.desc, url, mainEntityOfPage: { '@type': 'WebPage', '@id': url },
      inLanguage: 'en', dateModified: LAST_CHECKED,
      author: { '@type': 'Organization', name: 'World of Chips', url: `${SITE}/` },
      publisher: { '@type': 'Organization', name: 'World of Chips', url: `${SITE}/` },
      isPartOf: { '@type': 'WebSite', name: 'World of Chips', url: `${SITE}/` } },
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'World of Chips', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: g.crumb, item: url }] },
    ...(g.sections.length ? [{ '@type': 'ItemList', name: g.sections[0].h2, itemListElement: g.sections[0].items.map(([n], i) => ({ '@type': 'ListItem', position: i + 1, name: stripTags(n) })) }] : []),
    { '@type': 'FAQPage', '@id': `${url}#faq`, mainEntity: g.faqs.map(([q, a]) => ({ '@type': 'Question', name: stripTags(q), acceptedAnswer: { '@type': 'Answer', text: stripTags(a) } })) },
  ] };
  const sections = g.sections.map((s) => `
    <section class="cp-section" id="${s.id}">
      <h2>${s.h2}</h2>
      <ol class="gd-picks">
        ${s.items.map(([n, d, href]) => `<li><strong>${n}</strong><p>${d}</p><p>${amz(href, `Find ${n} on Amazon &#8594;`)}</p></li>`).join('\n        ')}
      </ol>
      <p class="sb-muted">We link to Amazon searches rather than single listings because import listings for these chips go in and out of stock often; pick a listing that shows as in stock and check the pack size.</p>
    </section>`).join('');
  return `<!DOCTYPE html>
<html lang="en">
<head>
${gaSnippet}
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(g.title)}</title>
<meta name="description" content="${esc(g.desc)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="article">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${esc(g.title)}">
<meta property="og:description" content="${esc(g.desc)}">
<meta property="og:site_name" content="World of Chips">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${esc(g.title)}">
<meta name="twitter:description" content="${esc(g.desc)}">
<script type="application/ld+json">
${jsonLd(ld)}
</script>
${fontsLink}
<link rel="stylesheet" href="/assets/site.css">
<style>
.nav-logo a{color:inherit;text-decoration:none;display:flex;align-items:center;gap:.5rem}
.cp-crumbs{font-size:.75rem;color:var(--muted);margin-bottom:1rem}
.cp-crumbs a{color:var(--gold);text-decoration:none}
.cp-intro-dark{color:var(--muted);max-width:640px;margin:1rem auto 0;font-size:.95rem}
.cp-cta h2{font-family:'Playfair Display',serif;font-size:1.3rem;color:var(--brown);margin-bottom:.6rem}
.sb-top-disc{margin:0 auto 2rem;padding-top:0;border-top:none}
.gd-picks{margin:1rem 0 0 1.3rem}
.gd-picks li{background:var(--paper);border:1px solid var(--light-border);border-radius:12px;padding:.9rem 1rem;margin-bottom:.8rem;font-size:.92rem;line-height:1.6}
.gd-picks strong{color:var(--brown);font-family:'Playfair Display',serif;font-size:1.05rem}
.gd-picks a,.cp-section a{color:#1A4570}
.sb-table-wrap{overflow-x:auto;margin-top:1rem;border:1px solid var(--light-border);border-radius:12px}
.sb-table{border-collapse:collapse;width:100%;min-width:560px;font-size:.85rem;background:var(--paper)}
.sb-table th,.sb-table td{padding:.65rem .7rem;text-align:left;vertical-align:top;border-bottom:1px solid var(--light-border)}
.sb-table thead th{background:var(--dark);color:var(--cream);font-size:.72rem;text-transform:uppercase;letter-spacing:.06em}
.sb-muted{color:var(--muted);font-size:.85em;margin-top:.6rem}
.sb-sources{font-size:.72rem;color:var(--muted);margin-top:.8rem;word-break:break-word}
.sb-sources a{color:var(--muted)}
.sb-faq h3{font-size:1rem;color:var(--brown);margin-top:1.2rem}
.sb-faq p{margin-top:.3rem}
.cp-section ul.sb-list{margin:.5rem 0 1rem 1.3rem;font-size:.95rem;line-height:1.8}
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
    <a href="/snack-boxes/">Snack Boxes</a>
    <a href="/#shop">Where to Buy</a>
  </div>
</nav>

<main>
<article class="country-page active" id="${g.slug}">
  <div class="cp-hero">
    <a href="/" class="cp-back">← Back to World of Chips</a>
    <nav class="cp-crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <span>${esc(g.crumb)}</span></nav>
    <span class="cp-flag">${g.flag}</span>
    <h1 class="cp-title">${esc(g.h1)}</h1>
    <span class="cp-region">Last checked ${LAST_CHECKED_LABEL}</span>
    <p class="cp-intro-dark">${g.introDark}</p>
  </div>
  <div class="cp-body">
    <p class="aff-disc sb-top-disc">${DISCLOSURE}</p>

    <p class="cp-intro">${intro}</p>
${sections}${g.extra}

    <section class="cp-section sb-faq" id="faq">
      <h2>FAQs</h2>
      ${g.faqs.map(([q, a]) => `<h3>${q}</h3>\n      <p>${a}</p>`).join('\n      ')}
    </section>
${g.sources.length ? `
    <section class="cp-section" id="sources">
      <h2>Sources</h2>
      <p class="sb-sources">Checked on ${LAST_CHECKED_LABEL}: ${g.sources.map(srcLink).join(', ')}</p>
    </section>
` : ''}
    <p class="aff-disc">${DISCLOSURE}</p>

    <nav class="cp-cta" aria-label="More chip guides">
      <h2>More Chip Guides</h2>
      <div class="cp-explore-grid">${g.related.map(([s, l]) => `<a href="/${s}/" class="cp-explore-link">${l}</a>`).join('')}<a href="/news/" class="cp-explore-link">📰 Chip News</a></div>
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

// ---------- sitemap entries (after /snack-boxes/, else /news/, else homepage) ----------
const sitemapPath = path.join(ROOT, 'sitemap.xml');
let sm = fs.readFileSync(sitemapPath, 'utf8');
for (const g of GUIDES) sm = sm.replace(new RegExp(`  <url>\\n    <loc>${SITE.replace(/\./g, '\\.')}/${g.slug}/</loc>\\n[\\s\\S]*?</url>\\n`), '');
let at = -1;
for (const p of ['snack-boxes/', 'news/', '']) { const i = sm.indexOf(`<loc>${SITE}/${p}</loc>`); if (i >= 0) { at = sm.indexOf('</url>\n', i); break; } }
if (at < 0) throw new Error('sitemap.xml has no <url> entries');
const blocks = GUIDES.map((g) => `  <url>\n    <loc>${SITE}/${g.slug}/</loc>\n    <lastmod>${LAST_CHECKED}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`).join('');
const newSitemap = sm.slice(0, at + 7) + blocks + sm.slice(at + 7);

const outputs = [...GUIDES.map((g) => [path.join(ROOT, g.slug, 'index.html'), render(g)]), [sitemapPath, newSitemap]];
if (CHECK) {
  const stale = outputs.filter(([p, body]) => !fs.existsSync(p) || fs.readFileSync(p, 'utf8') !== body).map(([p]) => path.relative(ROOT, p));
  if (stale.length) { console.error(`Guide output out of date: ${stale.join(', ')}. Run: node scripts/build_guides.mjs`); process.exit(1); }
  console.log(`Guide pages up to date (${GUIDES.length}, checked ${LAST_CHECKED}).`);
} else {
  for (const [p, body] of outputs) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, body); }
  console.log(`Built ${GUIDES.map((g) => `/${g.slug}/`).join(', ')} (checked ${LAST_CHECKED}).`);
}
