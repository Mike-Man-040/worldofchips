#!/usr/bin/env node
// Build the /snack-boxes/ comparison page of worldofchips.com.
//
// Source of truth: the BOXES / FAQS data below. Every price and fact was checked on the
// company's own website on LAST_CHECKED (URLs in each box's `sources`). When you re-check,
// update the data + LAST_CHECKED and re-run. Unverifiable facts must say "see site".
// Head bits (GA, fonts) and the footer are copied from index.html, like the country pages.
//
// Writes (deterministically, no timestamps):
//   snack-boxes/index.html   the comparison page
//   sitemap.xml              the https://worldofchips.com/snack-boxes/ <url> entry
//
// Usage:  node scripts/build_snack_boxes.mjs           write files
//         node scripts/build_snack_boxes.mjs --check   exit 1 if any output is out of date
// Requires Node 16+. No npm install needed.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.on('uncaughtException', (e) => { console.error(`build_snack_boxes: ${e.message}`); process.exit(1); });

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://worldofchips.com';
const CHECK = process.argv.includes('--check');
const LAST_CHECKED = '2026-10-18'; // ISO date the facts below were verified
const LAST_CHECKED_LABEL = 'October 2026';
const AMAZON_TAG = 'worldofchips-20';

// ---------- helpers ----------
const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');
const jsonLd = (o) => JSON.stringify(o).replace(/</g, '\\u003c');
const stripTags = (s) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#8217;/g, '\u2019')
  .replace(/&#8211;/g, '\u2013').replace(/&#8212;/g, '\u2014').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
function between(src, start, end) {
  const a = src.indexOf(start);
  if (a < 0) throw new Error(`Marker not found: ${start}`);
  const b = src.indexOf(end, a + start.length);
  if (b < 0) throw new Error(`End marker not found after ${start}: ${end}`);
  return { a, b, text: src.slice(a, b) };
}
// Official brand link: plain homepage for now; swap href for the affiliate URL later
// (and add "sponsored" to rel) by searching for data-affiliate="<brand>".
const brandLink = (b, label, href) =>
  `<a href="${esc(href || b.url)}" target="_blank" rel="nofollow noopener" data-affiliate="${b.affiliate}">${label}</a>`;
const srcLink = (u) => `<a href="${esc(u)}" target="_blank" rel="nofollow noopener">${esc(u.replace(/^https?:\/\//, ''))}</a>`;
const amazon = (q) => `https://www.amazon.com/s?k=${q.trim().split(/\s+/).map(encodeURIComponent).join('+')}&tag=${AMAZON_TAG}`;

// ---------- data (verified on the official sites, see `sources`) ----------
const BOXES = [
  {
    id: 'bokksu', name: 'Bokksu', affiliate: 'bokksu', url: 'https://www.bokksu.com/', flag: '🇯🇵',
    tagline: 'Premium, traditional Japanese snacks from family makers',
    focus: 'Traditional / artisan', chips: 'Some (chips &amp; senbei among the mix)', chipScore: 2,
    items: '20&#8211;22 snacks + a tea',
    priceFrom: '$32.99', priceTo: '$39.99', cadence: 'monthly',
    plans: [['1 month', '$39.99/box'], ['3 months', '$35.99/box'], ['6 months', '$33.99/box ($203.94 every 6 months)'], ['12 months', '$32.99/box']],
    shipEU: 'Yes', shipEUCost: '$15.99/box', shipUS: '$13.99/box + $3 US import duty',
    inside: 'A monthly themed box of Japanese snacks, sweets and a tea sourced from small, often centuries-old family makers. Bokksu lists mochi, senbei (rice crackers), cakes, cookies and chips among the treats and promises a &#8220;great balance of sweet &amp; savory flavors&#8221;, plus a 20&#8211;24-page culture guide with origins and allergen notes. New subscribers start with its &#8220;Seasons of Japan&#8221; box; 3-, 6- and 12-month plans add free gifts.',
    shipping: 'Ships from Japan. Bokksu&#8217;s FAQ (rates as of 1 May 2026) lists $15.99 per box to the UK, EU, Canada and Australia and $13.99 plus a $3 import duty to the US. Its country list includes most EU countries, the UK, Norway and Switzerland. Bokksu warns that EU parcels may need a passport or tax ID number and a duty payment before customs releases them, and (since March 2026) that some shipments to Europe may be delayed by airline route changes.',
    bestFor: 'Gift-givers and anyone who wants the &#8220;real Japan&#8221; experience: regional, artisan snacks and tea rather than supermarket candy.',
    sources: ['https://www.bokksu.com/', 'https://www.bokksu.com/products/classic-bokksu', 'https://www.bokksu.com/pages/faq'],
  },
  {
    id: 'tokyotreat', name: 'TokyoTreat', affiliate: 'tokyotreat', url: 'https://tokyotreat.com/', flag: '🇯🇵',
    tagline: 'Full-size modern Japanese candy, chips and noodles',
    focus: 'Modern / pop candy + savory', chips: 'Yes (a &#8220;chips &amp; salty treats&#8221; category)', chipScore: 3,
    items: '12&#8211;15 full-size snacks',
    priceFrom: '$32.50', priceTo: '$37.50', cadence: 'monthly',
    plans: [['Monthly', '$37.50/box'], ['3 months', '$35.50/box'], ['6 months', '$33.50/box'], ['12 months', '$32.50/box ($390 every 12 months)']],
    shipEU: 'Yes', shipEUCost: '$16.99/box', shipUS: '$16.99/box (+ US taxes/duties at checkout)',
    inside: 'TokyoTreat&#8217;s help center says each box holds 12 to 15 full-sized Japanese snacks that are hard to find outside Japan: chocolates, salty chips, gummies, DIY candy kits and dagashi. The pricing page also lists Japan-exclusive KitKat flavors, baked goods, instant noodles, mochi and jellies, and gacha toys, plus a 20-page booklet with allergen information. Longer plans come with a free bonus item.',
    shipping: 'Ships from Japan with tracking. TokyoTreat&#8217;s shipping table (updated 1 October 2026) lists $16.99 per box to the US, UK and most of Europe, with an estimated 7&#8211;28 days after dispatch. For the EU, VAT is collected at checkout, but since 1 July 2026 a customs duty may be charged on delivery. For the US, TokyoTreat adds taxes and duties at checkout.',
    bestFor: 'Snackers who want big-brand Japanese flavors (KitKat, Pocky, Calbee, Hi-Chew) in full-size packs, with a good share of savory snacks.',
    sources: ['https://tokyotreat.com/subscribe', 'https://help.tokyotreat.com/hc/en-us/articles/360060928653-What-do-I-get-in-my-TokyoTreat-box', 'https://help.tokyotreat.com/hc/en-us/articles/360059099914-Shipping-Information', 'https://help.tokyotreat.com/hc/en-us/articles/59161212385689-Update-for-E-U-Subscribers-Regarding-the-Customs-Duty-Changes-Updated-on-June-19-2026'],
  },
  {
    id: 'sakuraco', name: 'Sakuraco', affiliate: 'sakuraco', url: 'https://sakura.co/', flag: '🇯🇵',
    tagline: 'TokyoTreat&#8217;s sister box: wagashi, tea and a home good',
    focus: 'Traditional / wagashi + tea', chips: 'A little (senbei, savory bites)', chipScore: 1,
    items: 'Up to 20 items incl. tea + a home good',
    priceFrom: '$32.50', priceTo: '$37.50', cadence: 'monthly',
    plans: [['1 month', '$37.50/box'], ['3 months', '$35.50/box'], ['6 months', '$33.50/box'], ['12 months', '$32.50/box ($390 every 12 months)'], ['Premium Tea Pairing add-on', '+$10/month']],
    shipEU: 'Yes', shipEUCost: '$16.99/box', shipUS: '$16.99/box',
    inside: 'Up to 20 authentic Japanese sweets, snacks and teas from local makers, built around a region or season each month (November 2026 is &#8220;Sakai&#8217;s Autumn Wonders&#8221;). Every box adds a Japanese home good such as ceramics, chopsticks or furoshiki, plus a 24-page culture guide. It leans toward traditional wagashi, with some savory items like senbei.',
    shipping: 'Uses the same shipping table as TokyoTreat: $16.99 per box to the US, UK and most of Europe, an estimated 7&#8211;28 days after dispatch, and the same EU duty notes.',
    bestFor: 'Tea drinkers and fans of traditional Japanese sweets. It is the closest rival to Bokksu, with a home good in every box.',
    sources: ['https://sakura.co/', 'https://sakura.co/subscribe', 'https://help.tokyotreat.com/hc/en-us/articles/360059107554-What-do-I-get-in-my-Sakuraco-box', 'https://help.tokyotreat.com/hc/en-us/articles/360059099914-Shipping-Information'],
  },
  {
    id: 'daebak', name: 'Daebak SnackFever', affiliate: 'daebak', url: 'https://daebak.co/', flag: '🇰🇷',
    tagline: 'Korean convenience-store snacks, shipped from Seoul each season',
    focus: 'Korean snacks: chips, jellies, sweets', chips: 'Yes (chips &amp; crackers in every box)', chipScore: 3,
    items: '8+ (Original) or 12+ (Deluxe) snacks',
    priceFrom: '$40', priceTo: '$55', cadence: 'per seasonal box (4 a year)',
    plans: [['Original, one box', '$40'], ['Deluxe, one box', '$55'], ['Seasonal subscription', '10% off every box'], ['Annual (4 boxes, prepaid)', '15% off every box']],
    shipEU: 'Yes', shipEUCost: 'from $6.99/box, VAT &amp; duties included', shipUS: '$4.99 (Original) / $9.99 (Deluxe)',
    inside: 'Daebak&#8217;s Korean snack box is called SnackFever: a surprise mix of what is trending in Seoul convenience stores, including jellies, chips and crackers, chocolate and candy. Daebak names Haitai Honey Butter Chips, Pepero, Choco Pie, Buldak noodles and Nongshim shrimp crackers as typical picks. Note that it is <strong>seasonal, not monthly</strong>: four boxes a year. Daebak also sells the Daebak Box ($50/$70), a mixed K-beauty, snack and lifestyle box.',
    shipping: 'Ships from Seoul to 100+ countries, and VAT and customs duties are included in the shipping fee, so nothing extra is due on delivery. Per-box rates for Original/Deluxe: France, Italy, Spain and Poland $6.99/$9.99; the Netherlands $8.99/$9.99; the UK $6.99/$13.99; Sweden, Denmark, Greece and others $8.99/$17.99; Austria, Belgium, Finland, Portugal and others $10.99/$19.99; US and Canada $4.99/$9.99. Rates for other countries (including Germany) are shown at checkout. The first box usually arrives within 15&#8211;20 days.',
    bestFor: 'Korean snack fans, chip lovers, and European buyers who want a box with no surprise customs bill.',
    sources: ['https://daebak.co/', 'https://daebak.co/products/snackfever', 'https://daebak.co/pages/faq'],
  },
  {
    id: 'japancandybox', name: 'Japan Candy Store / Japan Candy Box', affiliate: 'japancandystore', url: 'https://www.japancandystore.com/', flag: '🇯🇵',
    boxUrl: 'https://www.japancandybox.com/',
    tagline: 'Budget monthly box of Japanese candy and snacks, plus a big à-la-carte shop',
    focus: 'Candy-led, some salty snacks', chips: 'Some (&#8220;chips &amp; salty treats&#8221; listed)', chipScore: 2,
    items: '10+ snacks',
    priceFrom: '$25', priceTo: '$31', cadence: 'monthly',
    plans: [['Monthly', '$31/box'], ['3 months', '$29/box'], ['6 months', '$27/box'], ['12 months', '$25/box ($300 every 12 months)']],
    shipEU: 'Yes (worldwide)', shipEUCost: 'see site (shown at checkout)', shipUS: 'see site (tariffs included)',
    inside: 'Japan Candy Store is an online shop with 2,900+ Japanese snacks (free shipping over $100), and it links to a monthly subscription called Japan Candy Box. The box promises 10+ Japan-exclusive candies and snacks each month: rare KitKat flavors, Pocky, Hi-Chew and gummies, Japanese noodles, and a &#8220;chips &amp; salty treats&#8221; category.',
    shipping: 'Shipped from Tokyo and delivered worldwide; the shipping fee is shown at checkout (see site). Its shipping policy says US orders include all tariffs, while EU and UK customers may have to pay VAT, duties and other import charges on delivery.',
    bestFor: 'The cheapest way into a monthly Japanese candy box, or for picking exact snacks from the shop instead of a surprise.',
    sources: ['https://www.japancandystore.com/', 'https://www.japancandybox.com/products/subscribe', 'https://www.japancandybox.com/policies/shipping-policy', 'https://www.japancandystore.com/policies/shipping-policy'],
  },
  {
    id: 'universalyums', name: 'Universal Yums', affiliate: 'universalyums', url: 'https://www.universalyums.com/', flag: '🌍',
    tagline: 'A different country every month (Japan and South Korea included)',
    focus: 'Rotating countries, sweet + savory', chips: 'Usually (always a sweet &amp; savory mix)', chipScore: 2,
    items: '5&#8211;7, 10&#8211;12 or 15&#8211;18 snacks',
    priceFrom: '$18', priceTo: '$47', cadence: 'monthly',
    plans: [['Yum Box (5&#8211;7 snacks)', '$20 monthly &middot; $19/box on 6 months &middot; $18/box on 12 months'], ['Yum Yum Box (10&#8211;12 snacks)', '$31 &middot; $29 &middot; $27'], ['Super Yum Box (15&#8211;18 snacks + a drink)', '$47 &middot; $44 &middot; $41']],
    shipEU: 'No (US &amp; Canada only)', shipEUCost: 'n/a', shipUS: 'Free (contiguous US)',
    inside: 'Not an Asian box as such: each month features a different country, with a mix of sweet and savory snacks (some full-size) and a booklet with trivia and games. For your first box you can choose from a list that currently includes Japan and South Korea; after that you get the featured country each month. Recent boxes list chips and crackers, such as shrimp chips in the South Korea box.',
    shipping: 'Ships only to the US (including territories and military addresses) and Canada. Shipping is free in the contiguous US; Canada costs $5, $8 or $10 per box depending on size. <strong>No shipping to Europe.</strong>',
    bestFor: 'Families and curious snackers in the US or Canada who want variety beyond Asia at a low entry price.',
    sources: ['https://www.universalyums.com/', 'https://www.universalyums.com/join', 'https://www.universalyums.com/faq'],
  },
];

const JAPAN_CRATE = {
  name: 'Japan Crate', affiliate: 'japancrate', url: 'https://japancrate.com/',
  text: 'Japan Crate was one of the original Japanese snack boxes, launched in 2014, but it has <strong>shut down</strong>. Its homepage now shows a &#8220;Farewell from Japan Crate&#8221; notice, says the company is focusing on its other brands, and sends former subscribers to Bokksu (for a monthly snack box) and Sugoi Mart (one-off pop-culture shopping). We could not check any current Japan Crate prices or plans because none are offered. If you see old Japan Crate prices elsewhere, treat them as out of date.',
  sources: ['https://japancrate.com/'],
};

const AMAZON = [
  { n: 'Calbee Japanese potato chips', d: 'Japan&#8217;s biggest chip brand: Nori Shio, Consommé Punch and more.', q: 'calbee potato chips' },
  { n: 'Koikeya Karamucho hot chili chips', d: 'Koikeya&#8217;s cult spicy chips from Japan.', q: 'koikeya karamucho' },
  { n: 'Haitai Honey Butter Chips', d: 'The sweet-salty Korean chip that sparked a craze.', q: 'haitai honey butter chips' },
  { n: 'Nongshim Shrimp Crackers', d: 'Korea&#8217;s classic savory shrimp snack.', q: 'nongshim shrimp crackers' },
  { n: 'Glico Pocky variety pack', d: 'For when you want something sweet between the chips.', q: 'pocky variety pack' },
];

const FAQS = [
  ['What is the best Japanese snack box in 2026?',
    'It depends on what you like. For traditional, artisan snacks and tea, Bokksu ($32.99&#8211;$39.99 a box) and its closest rival Sakuraco ($32.50&#8211;$37.50) lead. For full-size modern candy, KitKats and chips, TokyoTreat ($32.50&#8211;$37.50) is the pick. On a budget, Japan Candy Box starts at $25 a box on a 12-month plan. Shipping is extra for all of them.'],
  ['TokyoTreat vs Bokksu: what is the difference?',
    'TokyoTreat sends 12&#8211;15 full-size, mostly big-brand modern Japanese snacks (KitKat, Pocky, chips, noodles, gacha) for $32.50&#8211;$37.50 a box plus $16.99 shipping. Bokksu sends 20&#8211;22 snacks plus a tea, mostly from small traditional makers, for $32.99&#8211;$39.99 a box plus $13.99 (US) or $15.99 (UK/EU/Canada/Australia) shipping. Pick TokyoTreat for pop snacks and chips, Bokksu for an artisan, gift-style box.'],
  ['Which snack box has the most chips and savory snacks?',
    'Daebak&#8217;s Korean SnackFever box (chips and crackers in every box) and TokyoTreat (a dedicated chips and salty treats category) are the most savory-friendly. Bokksu and Japan Candy Box include some chips and rice crackers; Sakuraco is mostly traditional sweets. No company promises a set number of chips per box.'],
  ['Is there a Korean snack box?',
    'Yes. Daebak&#8217;s SnackFever ships Korean convenience-store snacks from Seoul: 8+ snacks for $40 (Original) or 12+ for $55 (Deluxe). It is seasonal (four boxes a year), with 10% off on a seasonal subscription or 15% off on an annual plan. Universal Yums also lets you pick South Korea as your first box (US and Canada only).'],
  ['Which snack boxes ship to Europe, and will I pay customs?',
    'Bokksu ($15.99 a box to the UK and EU), TokyoTreat and Sakuraco ($16.99), Daebak (from $6.99) and Japan Candy Box (fee shown at checkout) all ship to Europe. Universal Yums does not. Daebak includes VAT and duties in its shipping price. TokyoTreat and Sakuraco collect EU VAT at checkout but warn that customs duty may be charged on delivery since the EU dropped its low-value duty exemption on 1 July 2026. Bokksu and Japan Candy Box say EU buyers may have to pay duties or VAT on import.'],
  ['What happened to Japan Crate?',
    'Japan Crate has shut down its snack box. Its homepage now shows a farewell message and points former subscribers to Bokksu and Sugoi Mart. If you want a similar monthly box, look at TokyoTreat (modern snacks) or Bokksu (traditional snacks).'],
  ['Is Sakuraco the same company as TokyoTreat?',
    'Sakuraco is TokyoTreat&#8217;s sister box. TokyoTreat lists it among its brands, the two share a help center and shipping table, and they currently have the same plan prices. The boxes are very different, though: Sakuraco focuses on traditional sweets, tea and a home good; TokyoTreat on modern snacks.'],
  ['What is the cheapest snack box subscription?',
    'Universal Yums&#8217; smallest Yum Box costs $18&#8211;$20 a month with free shipping in the contiguous US (US and Canada only). For a Japan-only box, Japan Candy Box starts at $25 a box on a 12-month plan, plus shipping.'],
];

// ---------- page ----------
const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const siteNav = between(indexHtml, '<!-- SITE-NAV:START', '<!-- SITE-NAV:END -->').text + '<!-- SITE-NAV:END -->';
const gaSnippet = between(indexHtml, '<!-- Google tag (gtag.js) -->', '<meta charset').text.trim();
const fontsLink = (indexHtml.match(/<link href="https:\/\/fonts\.googleapis\.com[^>]*>/) || [])[0];
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

const url = `${SITE}/snack-boxes/`;
const h1 = 'Best Asian Snack Boxes in 2026: Bokksu vs TokyoTreat vs Sakuraco vs Daebak (and more)';
const title = 'Best Asian Snack Boxes 2026: Bokksu vs TokyoTreat vs Daebak & More | World of Chips';
const desc = 'Bokksu vs TokyoTreat vs Sakuraco vs Daebak vs Japan Candy Box vs Universal Yums: verified 2026 prices, what\u2019s inside, shipping to Europe, and the best box for chip lovers.';

const ld = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Article',
      '@id': `${url}#article`,
      headline: h1,
      description: desc,
      url,
      mainEntityOfPage: { '@type': 'WebPage', '@id': url },
      inLanguage: 'en',
      dateModified: LAST_CHECKED,
      author: { '@type': 'Organization', name: 'World of Chips', url: `${SITE}/` },
      publisher: { '@type': 'Organization', name: 'World of Chips', url: `${SITE}/` },
      isPartOf: { '@type': 'WebSite', name: 'World of Chips', url: `${SITE}/` },
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'World of Chips', item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: 'Asian Snack Boxes Compared', item: url },
      ],
    },
    {
      '@type': 'FAQPage',
      '@id': `${url}#faq`,
      mainEntity: FAQS.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: stripTags(a) } })),
    },
  ],
};

const byId = Object.fromEntries(BOXES.map((b) => [b.id, b]));
const row = (b) => `<tr>
          <th scope="row">${b.flag} ${brandLink(b, esc(b.name).replace(/&amp;#/g, '&#'))}</th>
          <td>${b.priceFrom}${b.priceTo !== b.priceFrom ? `&#8211;${b.priceTo}` : ''} <span class="sb-muted">${esc(b.cadence)}</span></td>
          <td>${b.items}</td>
          <td>${b.focus}</td>
          <td>${b.chips}</td>
          <td>${b.shipEU}${b.shipEUCost !== 'n/a' ? `<br><span class="sb-muted">${b.shipEUCost}</span>` : ''}</td>
          <td>${b.shipUS}</td>
        </tr>`;

const card = (b) => `<article class="sb-box" id="${b.id}">
      <h3>${b.flag} ${esc(b.name)}</h3>
      <p class="sb-tagline">${b.tagline}</p>
      <dl class="sb-facts">
        <dt>Price (USD)</dt><dd><ul>${b.plans.map(([k, v]) => `<li><strong>${k}:</strong> ${v}</li>`).join('')}</ul><span class="sb-muted">Shipping is extra unless noted. Prices checked ${LAST_CHECKED_LABEL}.</span></dd>
        <dt>What&#8217;s inside</dt><dd>${b.inside}</dd>
        <dt>Shipping</dt><dd>${b.shipping}</dd>
        <dt>Best for</dt><dd>${b.bestFor}</dd>
      </dl>
      <p class="sb-cta">${brandLink(b, `Visit ${esc(b.name.split(' / ')[0])} &#8599;`)}${b.boxUrl ? ` ${brandLink(b, 'Japan Candy Box subscription &#8599;', b.boxUrl)}` : ''}</p>
      <p class="sb-sources">Sources: ${b.sources.map(srcLink).join(', ')}</p>
    </article>`;

const chipRank = [...BOXES].filter((b) => b.chipScore >= 2).sort((a, b) => b.chipScore - a.chipScore);
const otherGuides = [['best-international-chip-variety-packs', '🌍 International chip variety packs'], ['best-japanese-chips', '🇯🇵 Best Japanese chips'], ['where-to-buy-asian-chips-europe', '🇪🇺 Buying in Europe'], ['japan', '🇯🇵 Japan'], ['south-korea', '🇰🇷 South Korea'], ['china', '🇨🇳 China'], ['thailand', '🇹🇭 Thailand'], ['indonesia', '🇮🇩 Indonesia']];
for (const [s] of otherGuides) if (!fs.existsSync(path.join(ROOT, s, 'index.html'))) throw new Error(`missing country page /${s}/`);

const page = `<!DOCTYPE html>
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
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="stylesheet" href="/assets/site.css">
<style>
.nav-logo a{color:inherit;text-decoration:none;display:flex;align-items:center;gap:.5rem}
.cp-crumbs{font-size:.75rem;color:var(--muted);margin-bottom:1rem}
.cp-crumbs a{color:var(--gold);text-decoration:none}
.cp-intro-dark{color:var(--muted);max-width:640px;margin:1rem auto 0;font-size:.95rem}
.cp-cta h2{font-family:'Playfair Display',serif;font-size:1.3rem;color:var(--brown);margin-bottom:.6rem}
.sb-top-disc{margin:0 auto 2rem;padding-top:0;border-top:none}
.sb-picks{list-style:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:.8rem;margin-top:1rem}
.sb-picks li{background:var(--paper);border:1px solid var(--light-border);border-radius:12px;padding:.9rem 1rem;font-size:.9rem;line-height:1.5}
.sb-picks a{color:#1A4570}
.sb-picks strong{display:block;color:var(--brown);font-family:'Playfair Display',serif;font-size:1rem}
.sb-table-wrap{overflow-x:auto;margin-top:1rem;border:1px solid var(--light-border);border-radius:12px}
.sb-table{border-collapse:collapse;width:100%;min-width:760px;font-size:.82rem;background:var(--paper)}
.sb-table th,.sb-table td{padding:.65rem .7rem;text-align:left;vertical-align:top;border-bottom:1px solid var(--light-border)}
.sb-table thead th{background:var(--dark);color:var(--cream);font-size:.72rem;text-transform:uppercase;letter-spacing:.06em}
.sb-table tbody th{font-weight:700;min-width:140px}
.sb-table a{color:#1A4570}
.sb-muted{color:var(--muted);font-size:.85em}
.sb-box{background:var(--paper);border:1px solid var(--light-border);border-radius:14px;padding:1.4rem 1.5rem;margin-top:1.2rem}
.sb-box h3{font-family:'Playfair Display',serif;font-size:1.35rem;color:var(--brown)}
.sb-tagline{color:var(--muted);font-size:.9rem;margin:.2rem 0 1rem}
.sb-facts dt{font-weight:700;font-size:.75rem;text-transform:uppercase;letter-spacing:.08em;color:var(--gold-dark);margin-top:.9rem}
.sb-facts dd{font-size:.92rem;line-height:1.7;margin:.2rem 0 0}
.sb-facts ul{margin:.2rem 0 .3rem 1.1rem}
.sb-cta{margin-top:1rem;display:flex;flex-wrap:wrap;gap:.6rem}
.sb-cta a{display:inline-block;background:var(--gold);color:var(--dark);font-weight:700;text-decoration:none;padding:.5rem 1rem;border-radius:100px;font-size:.85rem}
.sb-sources{font-size:.72rem;color:var(--muted);margin-top:.8rem;word-break:break-word}
.sb-sources a{color:var(--muted)}
.sb-closed{border-left:4px solid var(--red)}
.sb-faq h3{font-size:1rem;color:var(--brown);margin-top:1.2rem}
.sb-faq p{margin-top:.3rem}
.cp-section ol,.cp-section ul.sb-list{margin:.5rem 0 1rem 1.3rem;font-size:.95rem;line-height:1.8}
</style>
${mlUniversal}
</head>
<body>

${siteNav}

<main>
<article class="country-page active" id="snack-boxes">
  <div class="cp-hero">
    <a href="/" class="cp-back">← Back to World of Chips</a>
    <nav class="cp-crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <span>Snack Boxes</span></nav>
    <span class="cp-flag">🍱</span>
    <h1 class="cp-title">${esc(h1)}</h1>
    <span class="cp-region">Last checked ${LAST_CHECKED_LABEL}</span>
    <p class="cp-intro-dark">An honest comparison of the Japanese and Korean snack subscription boxes you can actually buy right now. Prices, box contents and shipping rules come from each company&#8217;s own website.</p>
  </div>
  <div class="cp-body">
    <p class="aff-disc sb-top-disc">As an Amazon Associate, World of Chips earns from qualifying purchases. This doesn&#8217;t affect our editorial content &#8212; we only feature products we genuinely think chip lovers will enjoy.</p>

    <p class="cp-intro">Snack boxes are the easiest way to taste chips, candy and regional treats you won&#8217;t find at home, but they vary a lot. Some send traditional sweets from family makers, some send full-size convenience-store favourites, and one well-known box no longer exists. Below you&#8217;ll find quick picks, a side-by-side table, a section for chip lovers, a full write-up of each box, and FAQs. All prices are in US dollars, per box, before shipping, and were checked in ${LAST_CHECKED_LABEL}. Where a company doesn&#8217;t publish a figure, we say &#8220;see site&#8221; rather than guess.</p>

    <section class="cp-section" id="quick-picks">
      <h2>Quick Picks</h2>
      <ul class="sb-picks">
        <li><strong>Best traditional box</strong>${brandLink(byId.bokksu, 'Bokksu')}: 20&#8211;22 artisan snacks + tea, $32.99&#8211;$39.99</li>
        <li><strong>Best for full-size modern snacks</strong>${brandLink(byId.tokyotreat, 'TokyoTreat')}: 12&#8211;15 full-size snacks, $32.50&#8211;$37.50</li>
        <li><strong>Best for tea &amp; wagashi</strong>${brandLink(byId.sakuraco, 'Sakuraco')}: up to 20 items + a home good, $32.50&#8211;$37.50</li>
        <li><strong>Best Korean box (and for chip lovers)</strong>${brandLink(byId.daebak, 'Daebak SnackFever')}: 8+ or 12+ snacks, $40/$55 per seasonal box</li>
        <li><strong>Cheapest Japanese monthly box</strong>${brandLink(byId.japancandybox, 'Japan Candy Box', byId.japancandybox.boxUrl)}: 10+ snacks, $25&#8211;$31</li>
        <li><strong>Best for variety (US/Canada)</strong>${brandLink(byId.universalyums, 'Universal Yums')}: a new country each month, from $18</li>
      </ul>
    </section>

    <section class="cp-section" id="comparison">
      <h2>Snack Box Comparison Table</h2>
      <p>Prices are per box in USD before shipping; the lower number is the longest prepaid plan. &#8220;Europe&#8221; shipping is the published rate for most EU countries.</p>
      <div class="sb-table-wrap">
      <table class="sb-table">
        <thead><tr><th scope="col">Box</th><th scope="col">Price / box</th><th scope="col">Items</th><th scope="col">Focus</th><th scope="col">Chips / savory?</th><th scope="col">Ships to Europe</th><th scope="col">US shipping</th></tr></thead>
        <tbody>
        ${BOXES.map(row).join('\n        ')}
        <tr>
          <th scope="row">🇯🇵 ${brandLink(JAPAN_CRATE, 'Japan Crate')}</th>
          <td colspan="6"><strong>Closed.</strong> No longer sold; see <a href="#japan-crate">what happened</a>.</td>
        </tr>
        </tbody>
      </table>
      </div>
    </section>

    <section class="cp-section" id="chip-lovers">
      <h2>Best Snack Box for Chip Lovers</h2>
      <p>We&#8217;re World of Chips, so here&#8217;s the question we care about most: which boxes actually include crunchy, savory snacks? Based on what each company says goes in the box:</p>
      <ol>
        ${chipRank.map((b) => `<li><strong>${esc(b.name)}</strong>: ${b.chips}.</li>`).join('\n        ')}
      </ol>
      <p>Sakuraco is the least chip-friendly: it&#8217;s mainly traditional sweets and tea, with the odd senbei. No company promises a set number of chips, so if you only want chips, buying single bags (below) or browsing our <a href="/japan/">Japan</a> and <a href="/south-korea/">South Korea</a> chip guides is the surer bet.</p>
    </section>

    <section class="cp-section" id="reviews">
      <h2>The Boxes, One by One</h2>
      ${BOXES.map(card).join('\n      ')}
      <article class="sb-box sb-closed" id="japan-crate">
        <h3>🇯🇵 Japan Crate (closed)</h3>
        <p class="sb-tagline">The original Japanese snack crate. No longer sold.</p>
        <p>${JAPAN_CRATE.text}</p>
        <p class="sb-cta">${brandLink(JAPAN_CRATE, 'Japan Crate&#8217;s farewell page &#8599;')}</p>
        <p class="sb-sources">Source: ${JAPAN_CRATE.sources.map(srcLink).join(', ')}</p>
      </article>
    </section>

    <section class="cp-section" id="europe">
      <h2>Ordering from Europe?</h2>
      <p>Every box here except Universal Yums ships to Europe, but the final cost varies. Daebak is the simplest: VAT and duties are included in its shipping fee. TokyoTreat and Sakuraco collect EU VAT at checkout but warn that, since the EU removed its duty exemption for parcels under &#8364;150 on 1 July 2026, customs duty may be charged on delivery. Bokksu and Japan Candy Box both say EU buyers may need to pay duties or VAT on import. The UK, Norway and Switzerland have their own customs rules.</p>
    </section>

    <section class="cp-section" id="amazon">
      <h2>Prefer Single Snacks? Buy on Amazon</h2>
      <p>Not ready for a subscription? Pick up the chips you actually want:</p>
      <div style="display:flex;flex-direction:column;gap:.5rem;margin-top:.8rem">
        ${AMAZON.map((l) => `<a href="${esc(amazon(l.q))}" target="_blank" rel="sponsored nofollow noopener" style="display:flex;align-items:center;gap:.8rem;padding:.7rem 1rem;background:var(--paper);border:1px solid var(--light-border);border-radius:10px;text-decoration:none;color:var(--ink);transition:all .3s"><div style="flex:1"><div style="font-weight:700;font-size:.88rem">${l.n}</div><div style="font-size:.72rem;color:var(--muted)">${l.d}</div></div><span style="color:var(--gold);font-weight:700">Shop &#8594;</span></a>`).join('\n        ')}
      </div>
      <p class="aff-disc">As an Amazon Associate, World of Chips earns from qualifying purchases. This doesn&#8217;t affect our editorial content &#8212; we only feature products we genuinely think chip lovers will enjoy.</p>
    </section>

    <section class="cp-section sb-faq" id="faq">
      <h2>Snack Box FAQs</h2>
      ${FAQS.map(([q, a]) => `<h3>${esc(q)}</h3>\n      <p>${a}</p>`).join('\n      ')}
    </section>

    <section class="cp-section" id="method">
      <h2>How We Checked</h2>
      <p>Every price, plan, item count and shipping rule on this page was read from the company&#8217;s own website or help center in ${LAST_CHECKED_LABEL}. The sources are listed under each box. Prices, shipping fees and customs rules change often, and promotions come and go, so always confirm the total at checkout. We haven&#8217;t been paid by any of these companies, and the snack-box links on this page are plain links to their official sites.</p>
    </section>

    ${newsletterBlock('    ')}

    <nav class="cp-cta" aria-label="More chip guides">
      <h2>More Chip Guides</h2>
      <div class="cp-explore-grid">${otherGuides.map(([s, l]) => `<a href="/${s}/" class="cp-explore-link">${l}</a>`).join('')}<a href="/news/" class="cp-explore-link">📰 Chip News</a></div>
      <p style="margin-top:2rem"><a href="/" class="cp-explore-link">🌍 Back to the Global Chip Map</a></p>
    </nav>
  </div>
</article>
</main>

${footerHtml}

</body>
</html>
`;

// ---------- sitemap entry ----------
const sitemapPath = path.join(ROOT, 'sitemap.xml');
const sitemap = fs.readFileSync(sitemapPath, 'utf8');
const block = `  <url>\n    <loc>${url}</loc>\n    <lastmod>${LAST_CHECKED}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
const stripped = sitemap.replace(/  <url>\n    <loc>https:\/\/worldofchips\.com\/snack-boxes\/<\/loc>\n[\s\S]*?<\/url>\n/, '');
// Insert after /news/ if present, else after the homepage (same order build_country_pages.mjs writes).
const newsAt = stripped.indexOf(`<loc>${SITE}/news/</loc>`);
const anchor = newsAt >= 0 ? stripped.indexOf('</url>\n', newsAt) : stripped.indexOf('</url>\n');
if (anchor < 0) throw new Error('sitemap.xml has no <url> entries');
const newSitemap = stripped.slice(0, anchor + 7) + block + stripped.slice(anchor + 7);

// ---------- write / check ----------
const outputs = [
  [path.join(ROOT, 'snack-boxes', 'index.html'), page],
  [sitemapPath, newSitemap],
];
if (CHECK) {
  const stale = outputs.filter(([p, body]) => !fs.existsSync(p) || fs.readFileSync(p, 'utf8') !== body)
    .map(([p]) => path.relative(ROOT, p));
  if (stale.length) {
    console.error(`Snack-box output out of date: ${stale.join(', ')}. Run: node scripts/build_snack_boxes.mjs`);
    process.exit(1);
  }
  console.log(`Snack-box page up to date (${BOXES.length} boxes, checked ${LAST_CHECKED}).`);
} else {
  fs.mkdirSync(path.join(ROOT, 'snack-boxes'), { recursive: true });
  for (const [p, body] of outputs) fs.writeFileSync(p, body);
  console.log(`Built /snack-boxes/ (${BOXES.length} boxes + Japan Crate note, checked ${LAST_CHECKED}).`);
}
