#!/usr/bin/env node
// Build the buyer's guide pages of worldofchips.com:
//   /best-japanese-chips/                   best Japanese chips to buy online
//   /where-to-buy-asian-chips-europe/       where to buy Takis, Honey Butter Chip & co. in Europe
//   /best-international-chip-variety-packs/ best international chip variety packs & samplers online
//
// Source of truth: the GUIDES data below. Every fact and price was checked on LAST_CHECKED on the
// page listed in that section's `sources`. Prices are only quoted with that date; re-check and
// update LAST_CHECKED before changing any figure. Amazon product links are tagged amazon.com
// searches unless the ASIN page itself was opened and showed the item in stock (VERIFIED_ASINS).
// Head bits (GA, fonts, MailerLite) and the footer are copied from index.html, like the other pages.
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
import morePages from './guides_more.mjs';

process.on('uncaughtException', (e) => { console.error(`build_guides: ${e.message}`); process.exit(1); });

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://worldofchips.com';
const CHECK = process.argv.includes('--check');
const LAST_CHECKED = '2026-10-22';
const LAST_CHECKED_LABEL = '22 October 2026';
const AMAZON_TAG = 'worldofchips-20';

// ASIN pages opened on LAST_CHECKED and showing the product in stock on amazon.com.
const VERIFIED_ASINS = {
  B01K9A9V50: 'Haitai Honey Butter Chips, 2.11 oz, pack of 3: $14.50, in stock (2026-10-22; page re-opened 2026-10-26, add-to-cart shown)',
  // Opened (untagged) on 2026-10-26; product title matched and an add-to-cart button was shown.
  // Prices were not recorded (geo-located currency), so the new guides quote no prices.
  B0D14XB2HR: 'Takis Fuego 17 oz Fiesta Size, pack of 2',
  B09FYHFZGS: 'Takis Fuego Potato Chip Crisps, 5.5 oz can',
  B0G44XCDZL: 'Takis Blue Heat Crisps, pack of 3 cans',
  B0D9YF3CC2: 'Pringles Hot Ones Los Calientes Rojo, 5.5 oz can',
  B073BYBQBJ: 'Ruffles Flaming Hot Potato Chips 8.5 oz party bag (2)',
  B0GBYDCTXL: "Chip's Jalapeno Potato Chips, pack of 3",
  B0FBYHGB9L: 'Cape Cod Sweet & Spicy Jalapeno Chips 7.5 oz, pack of 4',
  B00FBGL0CK: 'Broadway Basketeers Towering Food Gift Boxes, 6 boxes',
  B0GGVB8P7F: 'Ultimate Variety Sampler Care Package, 40 count',
  B00E230CKE: 'Frito-Lay Flavor Variety Pack, 50 oz',
  B0HJLYJ4QJ: 'Wise Snacks Grab & Snack 42 Variety Pack, 39 oz',
  B0FBXZDS3Q: 'Takis 18 pc / 1 oz Variety Pack',
  B01L7Z11SQ: 'Red Rock Deli Variety 10 Pack 280 g',
  B004ISJK38: 'Walkers MEGA Monster Munch Pickled Onion 6 Pack',
  B0GFPXTYHH: 'Orion Turtle Chips, Sweet Corn',
  B0BWSKY5FZ: 'ORION Turtle Chip Official Gift Box (Choco, 2 packs)',
  B0H7F3D75L: 'Nongshim Shrimp Crackers Original 14.1 oz, pack of 2',
  B07PZ92784: 'Orion Baked Marine Boy Sharing Box',
  // Already live on the site as country-page shop picks (csm in index.html). Amazon served a captcha on
  // 2026-10-26 so these were NOT re-opened that day; guides using them quote no prices or stock claims.
  B0DG6345BV: 'Takis Variety Pack 18 bags (Mexico shop pick)',
  B009R489PI: 'Takis Fuego 9.9 oz (Mexico shop pick)',
  B0BQZD5QR6: 'Sabritas Chile Limon Mix 30 bags (Mexico shop pick)',
  B083FKKRYY: "Lay's Limon 12.5 oz (Mexico shop pick)",
  B0B8NW4ZLM: 'Walkers Variety Multipack (UK shop pick)',
  B017IQA7R4: 'Walkers Salt & Shake (UK shop pick)',
  B01G2873H6: "Tyrrell's Sea Salt & Cider Vinegar (UK shop pick)",
};

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const jsonLd = (o) => JSON.stringify(o).replace(/</g, '\\u003c');
const stripTags = (s) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/\s+/g, ' ').trim();
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
        <li><strong>Want variety instead?</strong> Compare one-off sampler bundles in our <a href="/best-international-chip-variety-packs/">international chip variety packs guide</a>, or see our <a href="/snack-boxes/">snack box comparison</a> for monthly boxes from Japan.</li>
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
      'https://faq.calbee.jp/faq_detail.html?id=1209',
      'https://koike-ya.com/en/',
    ],
    related: [['japan', '🇯🇵 Japan chip guide'], ['south-korea', '🇰🇷 South Korea'], ['best-international-chip-variety-packs', '🌍 International variety packs'], ['snack-boxes', '🍱 Snack boxes compared'], ['where-to-buy-asian-chips-europe', '🇪🇺 Buying in Europe']],
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
        <li><strong>Amazon.com</strong> has the widest choice of Japanese chips and multi-country bundles (see our <a href="/best-japanese-chips/">best Japanese chips guide</a> and <a href="/best-international-chip-variety-packs/">international chip variety packs guide</a>), but it is the US store: check at checkout whether an item ships to your country and what import fees apply.</li>
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
    related: [['south-korea', '🇰🇷 South Korea chip guide'], ['mexico', '🇲🇽 Mexico'], ['united-kingdom', '🇬🇧 United Kingdom'], ['best-international-chip-variety-packs', '🌍 International variety packs'], ['best-japanese-chips', '🇯🇵 Best Japanese chips'], ['snack-boxes', '🍱 Snack boxes compared']],
  },
  {
    slug: 'best-international-chip-variety-packs',
    flag: '🌍',
    crumb: 'International Chip Variety Packs',
    h1: 'Best Place to Buy International-Flavor Potato Chips Online: Variety Packs & Samplers (2026)',
    title: 'Best International Chip Variety Packs & Where to Buy World Chips Online (2026) | World of Chips',
    desc: 'Where to buy international-flavor potato chips online in 2026: Amazon exotic chip variety packs vs. subscription snack boxes, verified prices, and how to avoid stale or overpriced bundles.',
    introDark: 'How to order exotic Asian Lay&#8217;s, Japanese Calbee, Korean Honey Butter, British Walkers and European paprika chips online &#8212; comparing Amazon sampler packs, snack boxes and specialist grocers.',
    intro: 'Looking for the <strong>best place to buy international-flavor potato chips online</strong>? Whether you want Chinese Lay&#8217;s in Cucumber or Sichuan Hot Pot, Japanese Calbee Norishio, Korean Honey Butter Chips, Mexican Sabritas or German paprika crisps, you have three main routes: <strong>one-off variety packs on Amazon</strong>, <strong>monthly or seasonal snack boxes</strong>, and <strong>regional online grocers</strong>. Below we compare the best international chip variety packs to buy on Amazon right now, break down how they stack up against subscription boxes (with prices checked in October 2026), and share what to check before you order so you don&#8217;t get crushed or short-dated bags.',
    sections: [
      { id: 'picks', h2: 'Best International Chip Variety Packs & Samplers on Amazon', items: [
        ['Exotic Asian Potato Chips Variety Packs (China, Taiwan &amp; Japan Assortments)', 'Third-party sampler bundles that mix regional Lay&#8217;s and Asian chip bags in flavours rarely sold in Western supermarkets &#8212; such as Chinese Lay&#8217;s Cucumber, Spicy Crayfish, Sichuan Hot Pot and Roasted Garlic Oyster alongside Japanese seaweed and broth flavours. Ideal for a tasting night when you want five to ten different international bags in one box.', amazonSearch('exotic asian potato chips variety pack')],
        ['Calbee &amp; Koikeya Japanese Potato Chip Multipacks', 'Multi-bag assortments built around Japan&#8217;s classic thin-cut repertoire: Calbee Usushio (launched 1975), Norishio seaweed salt (1976), Consomm&#233; Punch (1978) and Koikeya Karamucho hot chili (1984). See our <a href="/best-japanese-chips/">full guide to the best Japanese chips</a> for tasting notes on each bag.', amazonSearch('japanese potato chips variety pack calbee koikeya')],
        ['Haitai Honey Butter Chips (3-Pack) &amp; Korean Savory Bundles', 'Haitai&#8217;s sweet-and-salty acacia-honey and gourmet-butter potato chip sparked a nationwide convenience-store shortage in South Korea in August 2014. On ${LAST_CHECKED_LABEL}, the 3-pack of 2.11 oz (60 g) bags was in stock on Amazon.com at $14.50.', amazonDp('B01K9A9V50')],
        ['Sabritas Chile Lim&#243;n Mix &amp; Takis Rolled Tortilla Variety Packs (Mexico)', 'PepsiCo Mexico&#8217;s Sabritas (founded in Mexico City in 1943) and Grupo Bimbo&#8217;s Barcel (creator of Takis in 1999) define Mexican <em>botana</em> snacking. Multi-bag packs let you sample Adobadas, Chile &amp; Lim&#243;n, Habanero and Takis Fuego (launched 2006) without buying full-size cases.', amazonSearch('sabritas variety pack mexican chips')],
        ['Walkers Classic British Crisps Variety Multipack (UK)', 'Founded in Leicester in 1948, Walkers is Britain&#8217;s biggest crisp brand. Variety multipacks bundle the classic UK pub and packed-lunch quartet &#8212; Cheese &amp; Onion (introduced in 1954), Salt &amp; Vinegar (1967), Ready Salted and Prawn Cocktail &#8212; in individual 25 g packets.', amazonSearch('walkers crisps variety pack uk')],
        ['German &amp; European Paprika Chip Bundles (funny-frisch, Lorenz Crunchips &amp; Chio)', 'Paprika is the default chip flavour across Germany, the Netherlands and Central Europe: Germans bought 95.7 million kg of potato chips in 2024 and nearly half were paprika. Multi-packs of funny-frisch Chipsfrisch ungarisch (since 1968), Lorenz Crunchips (1992) and Chio (1962) let you taste Europe&#8217;s smoky-sweet staple at home.', amazonSearch('german paprika potato chips funny frisch chio')],
        ['Universal Yums &amp; One-Off World Snack Sampler Boxes', 'If you want a curated country-by-country box of sweet and savoury snacks (including regional chips and crackers) without committing to a recurring subscription on a separate website, look for single-purchase world snack boxes sold directly on Amazon.', amazonSearch('universal yums snack box')],
      ] },
    ],
    extra: `
    <section class="cp-section" id="where-to-buy">
      <h2>Best Place to Buy International-Flavor Potato Chips Online: 3 Options Compared</h2>
      <p>Depending on whether you want <em>only</em> potato chips or a broader country tasting box &#8212; and whether you live in North America or Europe &#8212; here is how the three main online buying channels compare (prices checked October 2026):</p>
      <div class="sb-table-wrap">
      <table class="sb-table">
        <thead><tr><th scope="col">Buying Channel</th><th scope="col">Typical Price (USD / EUR)</th><th scope="col">Share of Chips</th><th scope="col">Best For</th></tr></thead>
        <tbody>
        <tr>
          <th scope="row">${amz(amazonSearch('international potato chips variety pack'), 'Variety Packs &amp; Multipacks on Amazon')}</th>
          <td>$14.50 (3-pack Haitai Honey Butter) to $49.98 (12-pack Koikeya Karamucho)</td>
          <td><strong>100% chips</strong> (you pick the exact brands &amp; flavours)</td>
          <td>US buyers who only want potato chips, one-off gifts, and Prime-eligible multipacks without a subscription</td>
        </tr>
        <tr>
          <th scope="row"><a href="/snack-boxes/">Subscription &amp; Seasonal Snack Boxes</a></th>
          <td><strong>Universal Yums:</strong> $18&#8211;$47/box (free contiguous US shipping)<br><strong>TokyoTreat:</strong> $32.50&#8211;$37.50 + $16.99 shipping<br><strong>Bokksu:</strong> $32.99&#8211;$39.99 + $13.99 US / $15.99 EU shipping<br><strong>Daebak SnackFever:</strong> $40/$55 seasonal box (+ from $4.99 US / $6.99 EU shipping, duties included)</td>
          <td><strong>1&#8211;4 savory bags per box</strong> alongside candy, cakes, noodles &amp; drinks (Daebak &amp; TokyoTreat pack the most chips)</td>
          <td>Tasting a whole country&#8217;s snack culture, gifting, or getting Japan/Korea exclusives shipped worldwide</td>
        </tr>
        <tr>
          <th scope="row"><a href="/where-to-buy-asian-chips-europe/">Regional Online Grocers (EU &amp; Worldwide)</a></th>
          <td><strong>EU Asian grocers (Nanuko, Aasia Market, MAOMAO, World of Sweets, Phomifood):</strong> &#8364;2.79&#8211;&#8364;3.93 per 60 g Haitai bag + domestic/EU shipping<br><strong>Japan Candy Store:</strong> &#224;-la-carte Tokyo shop (2,900+ items, free shipping over $100)</td>
          <td><strong>100% custom basket</strong> (pick individual bags of Calbee, Koikeya, Haitai, Orion or Takis)</td>
          <td>European shoppers avoiding post-July 2026 non-EU customs duties, or snackers building a custom multi-brand cart</td>
        </tr>
        </tbody>
      </table>
      </div>
      <p>For a full breakdown of every box&#8217;s plan prices, item counts and customs rules, read our <a href="/snack-boxes/">2026 Asian snack box comparison</a>. If you are ordering to the UK or the EU, check our <a href="/where-to-buy-asian-chips-europe/">guide to buying Takis, Honey Butter Chip and Asian chips in Europe</a>.</p>
    </section>

    <section class="cp-section" id="checklist">
      <h2>4 Things to Check Before Buying an Exotic Chip Variety Pack on Amazon</h2>
      <ul class="sb-list">
        <li><strong>1. Compare price per ounce (or 100 g), not just bag count.</strong> International bags are often smaller than standard US supermarket bags: British Walkers multipack bags are typically 25 g (0.88 oz), and Japanese or Korean bags are usually 55&#8211;60 g (around 2 oz). Always verify whether a listing is a single bag, a 3-pack or a 12-pack before clicking buy.</li>
        <li><strong>2. Understand Chinese manufacturing dates vs. best-before dates.</strong> This is the #1 complaint on Amazon reviews for exotic Asian Lay&#8217;s variety packs: bags made in mainland China print the <strong>production date</strong> (manufacture date) on the package seal rather than the expiration date, with a shelf life of 6 to 9 months from that date. Japanese bags (<em>賞味期限</em>) and European bags print the actual <strong>best-before date</strong>.</li>
        <li><strong>3. Factory-sealed brand cases vs. third-party repacked assortments.</strong> A 3-pack of Haitai Honey Butter Chips or a 12-pack of Koikeya Karamucho comes from a single manufacturer, whereas &#8220;10-flavor exotic Asian Lay&#8217;s sampler&#8221; boxes are assembled by third-party importers. For repacked samplers, pick listings that ship in a rigid outer box so the nitrogen-flushed bags don&#8217;t arrive crushed.</li>
        <li><strong>4. Watch out for EU import duties on US/Asia shipments.</strong> On 1 July 2026 the European Union ended its customs-duty exemption for parcels valued under &#8364;150. If you live in the EU, ordering from an EU-based online grocer (or a duty-included box like Daebak SnackFever) avoids surprise customs handling fees on delivery.</li>
      </ul>
    </section>`,
    faqs: [
      ['What is the best place to buy international-flavor potato chips online?', 'If you only want potato chips and want to pick exact flavours (such as Chinese Lay&#8217;s Cucumber, Japanese Calbee Consomm&#233; Punch, Korean Haitai Honey Butter Chip or British Walkers Cheese &amp; Onion), Amazon variety packs and &#224;-la-carte Asian grocers (like Japan Candy Store worldwide, or Nanuko and World of Sweets inside the EU) are the best choice. If you want a curated surprise box of 10&#8211;20 snacks from a country, subscription boxes like TokyoTreat, Daebak SnackFever, Bokksu and Universal Yums lead.'],
      ['Why do Chinese Lay&#8217;s chips in variety packs look expired?', 'Food packaging in mainland China prints the manufacturing date (production date) on the bag rather than the expiration date. Most Chinese Lay&#8217;s potato chips have a shelf life of 6 to 9 months from that printed date. Japanese, Korean, British and EU bags print the best-before date instead.'],
      ['Which snack box has the most international potato chips?', 'Among subscription boxes we checked in October 2026, Daebak&#8217;s Korean SnackFever box ($40 Original / $55 Deluxe per seasonal box, with chips and crackers in every box) and Japan&#8217;s TokyoTreat ($32.50&#8211;$37.50/box, with a dedicated chips and salty treats category among its 12&#8211;15 full-size items) are the strongest picks for chip lovers. Universal Yums ($18&#8211;$47/box, US and Canada only) rotates to a new country each month and includes savoury chips and crackers alongside sweets.'],
      ['How much do imported chips cost on Amazon?', 'Expect to pay roughly $4 to $5 per small 55&#8211;60 g imported bag when buying multipacks on Amazon.com: for example, when we checked on 22 October 2026, a 3-pack of 2.11 oz Haitai Honey Butter Chips was $14.50 ($4.83/bag) and a 12-pack of 2.01 oz Koikeya Karamucho Hot Chili was $49.98 ($4.17/bag), because air/sea freight and importer handling are built into the price.'],
    ],
    sources: [
      'https://www.calbee.co.jp/en/corporate/history/product.php',
      'https://koike-ya.com/en/',
      'https://tokyotreat.com/subscribe',
      'https://www.bokksu.com/products/classic-bokksu',
      'https://daebak.co/products/snackfever',
      'https://www.universalyums.com/join',
      'https://www.japancandystore.com/',
    ],
    related: [['snack-boxes', '🍱 Snack boxes compared'], ['best-japanese-chips', '🇯🇵 Best Japanese chips'], ['where-to-buy-asian-chips-europe', '🇪🇺 Buying in Europe'], ['japan', '🇯🇵 Japan'], ['south-korea', '🇰🇷 South Korea'], ['mexico', '🇲🇽 Mexico'], ['france', '🇫🇷 France'], ['netherlands', '🇳🇱 Netherlands']],
  },
  {
    slug: 'spiciest-chips-you-can-buy',
    checked: '2026-10-26', checkedLabel: '26 October 2026',
    flag: '🌶️',
    crumb: 'Spiciest Chips',
    h1: 'The Spiciest Chips You Can Buy Online (2026)',
    title: 'Spiciest Chips You Can Buy Online in 2026: Takis, Pringles Hot Ones & More | World of Chips',
    desc: 'Seven hot chips you can order on Amazon.com, from Takis Fuego and Blue Heat (rated Extreme on the Takis Heat-O-Meter) to Pringles Hot Ones Los Calientes and Cape Cod Sweet & Spicy Jalape\u00f1o.',
    introDark: 'Seven hot chips you can actually order online, with the heat claims each maker puts on its own listing.',
    intro: 'Spicy chips are one of the fastest ways to taste how different countries do heat: Mexico&#8217;s chilli-and-lime, American hot-sauce flavours and jalape&#241;o kettle chips. Below are seven spicy chips with Amazon.com product pages that we opened on ${LAST_CHECKED_LABEL} and that showed an add-to-cart button. We don&#8217;t rank them on a Scoville scale, because no maker publishes one for its chips. Instead we quote how each brand describes its own heat. We don&#8217;t quote prices either, because they change often and vary by seller.',
    sections: [
      { id: 'picks', h2: 'The Spicy Chips', note: '', items: [
        ['Takis Fuego Rolled Tortilla Chips (17 oz, pack of 2)', 'Barcel&#8217;s best-known flavour. The listing calls it &#8220;zesty and intensely hot chili pepper and lime&#8221;, rated <strong>Extreme</strong> on the Takis Heat-O-Meter. Takis were invented in Mexico; see our <a href="/mexico/">Mexico chip guide</a>.', 'dp:B0D14XB2HR'],
        ['Takis Fuego Potato Crisps (5.5 oz can)', 'The same Fuego chilli-and-lime seasoning on stackable potato crisps in a can rather than rolled tortillas. Also rated <strong>Extreme</strong> on the Heat-O-Meter.', 'dp:B09FYHFZGS'],
        ['Takis Blue Heat Potato Crisps (pack of 3 cans)', 'A hot chilli pepper flavour in a bright blue colour, described as one that &#8220;battles for our hottest snack&#8221;. Rated <strong>Extreme</strong> on the Heat-O-Meter.', 'dp:B0G44XCDZL'],
        ['Pringles x Hot Ones Los Calientes Rojo (5.5 oz can)', 'A collaboration with the Hot Ones interview show, made with the medium-spice jalape&#241;o and habanero flavours of Los Calientes Rojo hot sauce. The listing notes it contains milk and wheat.', 'dp:B0D9YF3CC2'],
        ['Ruffles Flaming Hot Potato Chips (8.5 oz party bag, pack of 2)', 'Ridged Ruffles potato chips in the Flamin&#8217; Hot style. The listing warns buyers to check which pack variation they are choosing.', 'dp:B073BYBQBJ'],
        ['Chip&#8217;s Jalape&#241;o Potato Chips (pack of 3)', 'Barcel&#8217;s Mexican-style potato chips, seasoned with jalape&#241;o and salt. Barcel makes Chip&#8217;s potato chips as well as Takis.', 'dp:B0GBYDCTXL'],
        ['Cape Cod Sweet &amp; Spicy Jalape&#241;o Kettle Chips (7.5 oz, pack of 4)', 'The mildest pick: kettle-cooked potato chips with jalape&#241;o and a sweet touch. The listing says they are gluten-free, with no artificial flavours or preservatives.', 'dp:B0FBYHGB9L'],
      ] },
    ],
    extra: `
    <section class="cp-section" id="compare">
      <h2>Comparison Table</h2>
      <div class="sb-table-wrap">
      <table class="sb-table">
        <thead><tr><th scope="col">Chip</th><th scope="col">Type</th><th scope="col">Flavour</th><th scope="col">Heat (maker&#8217;s own claim)</th></tr></thead>
        <tbody>
        <tr><th scope="row">Takis Fuego</th><td>Rolled corn tortilla</td><td>Chilli pepper &amp; lime</td><td>Extreme (Heat-O-Meter)</td></tr>
        <tr><th scope="row">Takis Fuego Crisps</th><td>Stackable potato crisps</td><td>Chilli pepper &amp; lime</td><td>Extreme (Heat-O-Meter)</td></tr>
        <tr><th scope="row">Takis Blue Heat Crisps</th><td>Stackable potato crisps</td><td>Hot chilli pepper</td><td>Extreme (Heat-O-Meter)</td></tr>
        <tr><th scope="row">Pringles x Hot Ones Rojo</th><td>Stackable potato crisps</td><td>Jalape&#241;o &amp; habanero hot sauce</td><td>&#8220;Blazin&#8217; hot&#8221;</td></tr>
        <tr><th scope="row">Ruffles Flaming Hot</th><td>Ridged potato chips</td><td>Flamin&#8217; Hot</td><td>&#8220;Can you handle the heat?&#8221;</td></tr>
        <tr><th scope="row">Chip&#8217;s Jalape&#241;o</th><td>Potato chips</td><td>Jalape&#241;o &amp; salt</td><td>&#8220;Bold, spicy&#8221;</td></tr>
        <tr><th scope="row">Cape Cod Sweet &amp; Spicy</th><td>Kettle-cooked potato chips</td><td>Jalape&#241;o with a sweet touch</td><td>Sweet heat</td></tr>
        </tbody>
      </table>
      </div>
      <p class="sb-muted">Heat descriptions are quoted from each product&#8217;s Amazon listing as of ${'${LAST_CHECKED_LABEL}'}. They are marketing claims, not lab measurements.</p>
    </section>`,
    faqs: [
      ['What are the spiciest Takis?', 'On the Amazon listings we checked, Takis rates both Fuego (chilli pepper and lime) and Blue Heat (hot chilli pepper) as Extreme on its own Heat-O-Meter. The Blue Heat listing describes it as a flavour that battles for the brand&#8217;s hottest snack.'],
      ['Are Takis potato chips?', 'Classic Takis are rolled corn tortilla chips made by Barcel, Grupo Bimbo&#8217;s snack arm. Takis also sells stackable potato crisps in cans, such as Fuego Crisps and Blue Heat Crisps, with the same seasonings.'],
      ['Is there a Scoville rating for spicy chips?', 'Not for the chips in this guide. None of the makers publishes a Scoville figure for these chips, so we quote each brand&#8217;s own heat description instead of inventing a ranking.'],
      ['What is a milder spicy chip to start with?', 'Cape Cod Sweet &amp; Spicy Jalape&#241;o pairs jalape&#241;o with a sweet touch on kettle-cooked chips. Pringles x Hot Ones Rojo uses medium-spice jalape&#241;o and habanero hot-sauce flavours.'],
    ],
    sources: [],
    related: [['mexico', '🇲🇽 Mexico chip guide'], ['united-states', '🇺🇸 United States'], ['japan', '🇯🇵 Japan (Karamucho)'], ['best-chip-gift-boxes', '🎁 Chip gift boxes'], ['best-international-chip-variety-packs', '🌍 International variety packs']],
  },
  {
    slug: 'best-chip-gift-boxes',
    checked: '2026-10-26', checkedLabel: '26 October 2026',
    flag: '🎁',
    crumb: 'Chip Gift Boxes',
    h1: 'The Best Chip Gift Boxes and Snack Variety Packs to Send (2026)',
    title: 'Best Chip Gift Boxes & Snack Variety Packs to Buy Online (2026) | World of Chips',
    desc: 'Chip gift boxes and variety packs on Amazon.com: Broadway Basketeers gift tower, 40-count care package, Frito-Lay and Wise variety packs, Takis 18-bag mix, Australian Red Rock Deli and British Monster Munch.',
    introDark: 'Ready-to-gift snack towers, big variety packs and imported multipacks for chip lovers.',
    intro: 'A chip gift doesn&#8217;t have to be a fruit basket with a token bag of crisps. Below are seven Amazon.com listings we opened on ${LAST_CHECKED_LABEL}, all showing an add-to-cart button. There are two ready-to-gift boxes, three big US variety packs and two imported multipacks for someone who already has every American flavour. Details come from each listing. We don&#8217;t quote prices, because they change often and vary by seller. For monthly subscription boxes from Japan and Korea, see our <a href="/snack-boxes/">snack box comparison</a>.',
    sections: [
      { id: 'picks', h2: 'Gift Boxes &amp; Variety Packs', note: '', items: [
        ['Broadway Basketeers Towering Food Gift Boxes (6 boxes)', 'A ready-to-gift tower of six stacked boxes (6&#8243; &#215; 6&#8243; &#215; 14&#8243;) with about 4 lb of sweet and savoury snacks, including chips, popcorn, cookies and trail mix. The listing says it is certified kosher, arrives fully assembled and includes a gift tag.', 'dp:B00FBGL0CK'],
        ['Ultimate Variety Sampler Care Package (40 count)', 'A 40-item box (12&#8243; &#215; 11&#8243; &#215; 3&#8243;) mixing chips, cookies, bars, popcorn and crackers. The listing says gift wrapping and a message can be added at checkout.', 'dp:B0GGVB8P7F'],
        ['Frito-Lay Flavor Variety Pack (50 bags)', 'Fifty single-serve bags from the Frito-Lay range, 50 oz in total. It suits office or party gifting rather than a dressed-up present.', 'dp:B00E230CKE'],
        ['Wise Snacks Grab &amp; Snack Variety Pack (42 bags)', 'Forty-two individually packed bags from Wise, 39 oz in total. The listing pitches it for lunchboxes, offices and parties.', 'dp:B0HJLYJ4QJ'],
        ['Takis Variety Pack (18 &#215; 1 oz)', 'Eighteen 1 oz bags of Takis rolled tortilla chips: five Fuego, five Blue Heat, four Nitro and four Crunchy Fajitas. The listing title also says &#8220;Pack of 2&#8221;, so check the quantity at checkout. A good gift for a spice fan; see also our <a href="/spiciest-chips-you-can-buy/">spiciest chips guide</a>.', 'dp:B0FBXZDS3Q'],
        ['Red Rock Deli Variety 10 Pack (Australia)', 'Ten bags of Australian Red Rock Deli chips in flavours such as Sea Salt, Honey Soy Chicken, Sweet Chilli &amp; Sour Cream, and Sea Salt &amp; Balsamic Vinegar. More in our <a href="/australia/">Australia chip guide</a>.', 'dp:B01L7Z11SQ'],
        ['Walkers MEGA Monster Munch Pickled Onion (6 pack)', 'A British classic: six bags of pickled onion Monster Munch corn snacks, in the bigger MEGA size. More British crisps in our <a href="/united-kingdom/">UK chip guide</a>.', 'dp:B004ISJK38'],
      ] },
    ],
    extra: `
    <section class="cp-section" id="compare">
      <h2>Comparison Table</h2>
      <div class="sb-table-wrap">
      <table class="sb-table">
        <thead><tr><th scope="col">Pick</th><th scope="col">Format</th><th scope="col">Size (per listing)</th><th scope="col">Best for</th></tr></thead>
        <tbody>
        <tr><th scope="row">Broadway Basketeers tower</th><td>Ready-to-gift stacked boxes</td><td>6 boxes, about 4 lb</td><td>A formal gift, sweet and savoury</td></tr>
        <tr><th scope="row">Ultimate Variety Sampler</th><td>Care-package box</td><td>40 items</td><td>Students and care packages</td></tr>
        <tr><th scope="row">Frito-Lay Variety Pack</th><td>Single-serve bags</td><td>50 bags, 50 oz</td><td>Offices and parties</td></tr>
        <tr><th scope="row">Wise Grab &amp; Snack</th><td>Single-serve bags</td><td>42 bags, 39 oz</td><td>Lunchboxes and offices</td></tr>
        <tr><th scope="row">Takis Variety Pack</th><td>Single-serve bags</td><td>18 &#215; 1 oz</td><td>Spice fans</td></tr>
        <tr><th scope="row">Red Rock Deli 10 Pack</th><td>Imported multipack</td><td>10 bags</td><td>Trying Australian flavours</td></tr>
        <tr><th scope="row">Walkers MEGA Monster Munch</th><td>Imported multipack</td><td>6 bags</td><td>British expats and crisp fans</td></tr>
        </tbody>
      </table>
      </div>
    </section>`,
    faqs: [
      ['What is a good gift for someone who loves chips?', 'For a dressed-up present, a ready-to-gift box such as the Broadway Basketeers tower (six stacked boxes with chips, popcorn and cookies) works well. For a pure chip fan, an imported multipack, like Australian Red Rock Deli or British Monster Munch, offers flavours they probably can&#8217;t buy locally.'],
      ['Can I add a gift message on Amazon?', 'The Ultimate Variety Sampler listing says gift wrapping and a message are available at checkout. The Broadway Basketeers tower comes with a gift tag. For other items, check the gift options shown at checkout.'],
      ['Are there chip gift boxes with international flavours?', 'Yes. Imported multipacks such as Red Rock Deli (Australia) and Walkers Monster Munch (UK) are sold on Amazon.com. For a monthly box of Japanese or Korean snacks, see our snack box comparison.'],
      ['What is the difference between a gift box and a variety pack?', 'A gift box is packaged to be given, often with mixed sweet and savoury snacks and a tag or message. A variety pack is a bulk box of single-serve chip bags, better value for offices, parties or stocking a pantry, but plainly packaged.'],
    ],
    sources: [],
    related: [['snack-boxes', '🍱 Snack boxes compared'], ['best-international-chip-variety-packs', '🌍 International variety packs'], ['spiciest-chips-you-can-buy', '🌶️ Spiciest chips'], ['united-states', '🇺🇸 United States'], ['australia', '🇦🇺 Australia'], ['united-kingdom', '🇬🇧 United Kingdom']],
  },
  {
    slug: 'best-korean-chips-to-buy-online',
    checked: '2026-10-26', checkedLabel: '26 October 2026',
    flag: '🇰🇷',
    crumb: 'Best Korean Chips',
    h1: 'The Best Korean Chips and Snacks to Buy Online (2026)',
    title: 'Best Korean Chips to Buy Online in 2026: Honey Butter Chip, Turtle Chips & More | World of Chips',
    desc: 'Korean chips you can order on Amazon.com: Haitai Honey Butter Chips, Orion Turtle Chips (sweet corn and choco), Nongshim Shrimp Crackers and Orion Marine Boy, with what each tastes like.',
    introDark: 'Korea&#8217;s cult chips and crackers that you can order from the US Amazon store.',
    intro: 'Korean convenience-store snacks lean sweet-savoury: honey and butter on a potato chip, corn soup on a four-layer chip, real shrimp on a baked cracker. Below are five Korean snacks with Amazon.com product pages that we opened on ${LAST_CHECKED_LABEL}, all showing an add-to-cart button. Descriptions come from each listing. We don&#8217;t quote prices, because import listings change often. For the history of Korean chips, see our <a href="/south-korea/">South Korea chip guide</a>.',
    sections: [
      { id: 'picks', h2: 'Korean Chips &amp; Snacks', note: '', items: [
        ['Haitai Honey Butter Chips (pack of 3)', 'The sweet-and-buttery potato chip from Haitai that became a Korean craze in 2014. If you only try one Korean chip, make it this one.', 'dp:B01K9A9V50'],
        ['Orion Turtle Chips, Sweet Corn', 'Orion&#8217;s four-layer chip. The listing says the layered structure adds crunch, with a lightly sweet, creamy corn-soup flavour. Made in Korea.', 'dp:B0GFPXTYHH'],
        ['Orion Turtle Chip Official Gift Box (Choco, 2 packs)', 'The chocolate version of Turtle Chips, sold as a two-pack gift box.', 'dp:B0BWSKY5FZ'],
        ['Nongshim Shrimp Crackers, Original (14.1 oz, pack of 2)', 'A Korean classic, baked rather than fried. The listing says it is made with ground fresh shrimp and cooked with heated salt (&#8220;parching&#8221;), so it tastes light and savoury, not greasy.', 'dp:B0H7F3D75L'],
        ['Orion Marine Boy (Gorae-bap) Sharing Box', 'Baked crackers shaped like sea creatures, sold as a sharing gift box.', 'dp:B07PZ92784'],
      ] },
    ],
    extra: `
    <section class="cp-section" id="compare">
      <h2>Comparison Table</h2>
      <div class="sb-table-wrap">
      <table class="sb-table">
        <thead><tr><th scope="col">Snack</th><th scope="col">Maker</th><th scope="col">Type</th><th scope="col">Flavour</th></tr></thead>
        <tbody>
        <tr><th scope="row">Honey Butter Chip</th><td>Haitai</td><td>Potato chip</td><td>Honey and butter, sweet-savoury</td></tr>
        <tr><th scope="row">Turtle Chips Sweet Corn</th><td>Orion</td><td>Four-layer corn chip</td><td>Lightly sweet corn soup</td></tr>
        <tr><th scope="row">Turtle Chips Choco</th><td>Orion</td><td>Four-layer chip</td><td>Chocolate</td></tr>
        <tr><th scope="row">Shrimp Crackers</th><td>Nongshim</td><td>Baked cracker</td><td>Shrimp, lightly salty</td></tr>
        <tr><th scope="row">Marine Boy (Gorae-bap)</th><td>Orion</td><td>Baked shaped cracker</td><td>Savoury</td></tr>
        </tbody>
      </table>
      </div>
    </section>`,
    faqs: [
      ['What is the most famous Korean chip?', 'Haitai&#8217;s Honey Butter Chip, a sweet-and-buttery potato chip that became a craze in South Korea in 2014. It is sold on Amazon.com in a three-bag pack, and in Europe through Asian grocers.'],
      ['What are Turtle Chips?', 'Turtle Chips are an Orion snack built from four thin layers, which its listing says gives extra crunch. The sweet corn version tastes like a lightly sweet, creamy corn soup. A chocolate version is also sold.'],
      ['Are Nongshim Shrimp Crackers fried?', 'No. According to the listing, Nongshim Shrimp Crackers are baked using heated salt (a method it calls parching) rather than fried in oil. They are made with ground fresh shrimp.'],
      ['Can I buy Korean chips in Europe?', 'Yes. Several EU Asian grocers stock Haitai Honey Butter Chip; see our guide to buying Asian chips in Europe for shops and prices. Amazon.com links in this guide go to the US store.'],
    ],
    sources: [],
    related: [['south-korea', '🇰🇷 South Korea chip guide'], ['where-to-buy-asian-chips-europe', '🇪🇺 Buying in Europe'], ['snack-boxes', '🍱 Snack boxes (Daebak)'], ['best-japanese-chips', '🇯🇵 Best Japanese chips'], ['best-international-chip-variety-packs', '🌍 International variety packs']],
  },
  {
    slug: 'best-mexican-chips-to-buy-online',
    checked: '2026-10-26', checkedLabel: '26 October 2026',
    flag: '🇲🇽',
    crumb: 'Best Mexican Chips',
    h1: 'The Best Mexican Chips to Buy Online (2026)',
    title: 'Best Mexican Chips to Buy Online (2026): Takis, Sabritas & Barcel | World of Chips',
    desc: 'Mexican chips you can order on Amazon.com: Takis Fuego and variety packs, Sabritas Chile Limón, Lay\u2019s Limón and Barcel Chip\u2019s Jalapeño. Chilli, lime and the brands behind them.',
    introDark: 'Chilli, lime and the two snack giants behind them: Sabritas and Barcel.',
    intro: 'Mexican snacking runs on lime, salt, chamoy, tamarind and chile. Two companies dominate. <strong>Sabritas</strong> began in Mexico City in 1943 and joined PepsiCo in 1966. <strong>Barcel</strong>, Grupo Bimbo&#8217;s snack arm, began in 1977 and makes Chip&#8217;s potato chips and Takis. Takis were invented in 1999, and the purple-bag Fuego arrived in 2006. Below are seven Amazon.com listings, all already featured on our site: four on the <a href="/mexico/">Mexico page</a> and three in our <a href="/spiciest-chips-you-can-buy/">spiciest chips guide</a>. We don&#8217;t quote prices, because they change often.',
    sections: [
      { id: 'picks', h2: 'Mexican Chips to Buy', note: '', items: [
        ['Takis Variety Pack (18 bags)', 'Fuego, Blue Heat and more from Barcel in one box: the easiest way to find your Takis flavour.', 'dp:B0DG6345BV'],
        ['Takis Fuego (9.9 oz)', 'Chilli pepper and lime rolled tortilla chips, sold in the purple bag since 2006.', 'dp:B009R489PI'],
        ['Takis Fuego (17 oz, pack of 2)', 'The big fiesta-size bags. The listing rates Fuego <strong>Extreme</strong> on the Takis Heat-O-Meter.', 'dp:B0D14XB2HR'],
        ['Takis Fuego Potato Crisps (5.5 oz can)', 'The Fuego seasoning on stackable potato crisps instead of rolled tortillas.', 'dp:B09FYHFZGS'],
        ['Sabritas Chile Lim&#243;n Mix (30 bags)', 'A chilli-lime snack mix from Sabritas, Mexico&#8217;s original chip brand.', 'dp:B0BQZD5QR6'],
        ['Lay&#8217;s Lim&#243;n (12.5 oz)', 'Real-lime chips from Sabritas&#8217; US sister brand.', 'dp:B083FKKRYY'],
        ['Barcel Chip&#8217;s Jalape&#241;o (pack of 3)', 'Potato chips seasoned with jalape&#241;o and salt, from Barcel&#8217;s Chip&#8217;s range.', 'dp:B0GBYDCTXL'],
      ] },
    ],
    extra: `
    <section class="cp-section" id="compare">
      <h2>Comparison Table</h2>
      <div class="sb-table-wrap">
      <table class="sb-table">
        <thead><tr><th scope="col">Pick</th><th scope="col">Maker</th><th scope="col">Type</th><th scope="col">Flavour</th></tr></thead>
        <tbody>
        <tr><th scope="row">Takis Variety Pack</th><td>Barcel</td><td>Rolled tortilla chips</td><td>Fuego, Blue Heat and more</td></tr>
        <tr><th scope="row">Takis Fuego</th><td>Barcel</td><td>Rolled tortilla chips</td><td>Chilli pepper &amp; lime</td></tr>
        <tr><th scope="row">Takis Fuego Crisps</th><td>Barcel</td><td>Stackable potato crisps</td><td>Chilli pepper &amp; lime</td></tr>
        <tr><th scope="row">Sabritas Chile Lim&#243;n Mix</th><td>Sabritas</td><td>Snack mix</td><td>Chilli &amp; lime</td></tr>
        <tr><th scope="row">Lay&#8217;s Lim&#243;n</th><td>Lay&#8217;s (PepsiCo)</td><td>Potato chips</td><td>Lime</td></tr>
        <tr><th scope="row">Chip&#8217;s Jalape&#241;o</th><td>Barcel</td><td>Potato chips</td><td>Jalape&#241;o &amp; salt</td></tr>
        </tbody>
      </table>
      </div>
    </section>`,
    faqs: [
      ['What is the most popular chip brand in Mexico?', 'Sabritas, founded in Mexico City in 1943 and part of PepsiCo since 1966, is Mexico&#8217;s original chip brand. Its main rival is Barcel, Grupo Bimbo&#8217;s snack arm, which makes Takis and Chip&#8217;s.'],
      ['Are Takis Mexican?', 'Yes. Takis are made by Barcel, part of Mexico&#8217;s Grupo Bimbo. They were invented in 1999, first sold as &#8220;Taquis&#8221;, and the purple-bag Fuego (chilli and lime) arrived in 2006.'],
      ['What flavours are typical of Mexican chips?', 'Lime, salt and chile above all, often with chamoy or tamarind. In Mexico, chips are often &#8220;prepared&#8221; with hot sauce, lime and toppings rather than eaten plain.'],
    ],
    sources: [],
    related: [['mexico', '🇲🇽 Mexico chip guide'], ['spiciest-chips-you-can-buy', '🌶️ Spiciest chips'], ['united-states', '🇺🇸 United States'], ['best-chip-gift-boxes', '🎁 Chip gift boxes']],
  },
  {
    slug: 'best-british-crisps-to-buy-online',
    checked: '2026-10-26', checkedLabel: '26 October 2026',
    flag: '🇬🇧',
    crumb: 'Best British Crisps',
    h1: 'The Best British Crisps to Buy Online (2026)',
    title: 'Best British Crisps to Buy Online (2026): Walkers, Tyrrell\u2019s & Monster Munch | World of Chips',
    desc: 'British crisps you can order on Amazon.com: Walkers multipacks, Cheese & Onion and Salt & Shake, Tyrrell\u2019s Sea Salt & Cider Vinegar and Walkers MEGA Monster Munch, with the history behind them.',
    introDark: 'Walkers&#8217; big three, hand-cooked Tyrrell&#8217;s and a pickled-onion classic, delivered.',
    intro: 'Britain gave the world the flavoured crisp. In 1954 Ireland&#8217;s Tayto created cheese &amp; onion, and Walkers launched its own Cheese &amp; Onion the same year. Walkers was founded in Leicester in 1948 and is now Britain&#8217;s largest crisp maker. Its Salt &amp; Shake revives the old Smith&#8217;s idea of a twist of salt in the bag. Below are five crisps you can order from Amazon.com. Four link to listings already featured on our site; Cheese &amp; Onion links to an Amazon search. We don&#8217;t quote prices, because they change often. More history is in our <a href="/united-kingdom/">UK chip guide</a>.',
    sections: [
      { id: 'picks', h2: 'British Crisps to Buy', items: [
        ['Walkers Variety Multipack', 'A multipack from Britain&#8217;s biggest crisp maker: the easiest way to try Walkers&#8217; range.', 'dp:B0B8NW4ZLM'],
        ['Walkers Cheese &amp; Onion', 'A Walkers flavour since 1954, inspired by the ploughman&#8217;s lunch.', amazonSearch('walkers cheese and onion crisps')],
        ['Walkers Salt &amp; Shake', 'Plain crisps with a twist of salt to add yourself, an old-school idea first sold by Smith&#8217;s.', 'dp:B017IQA7R4'],
        ['Tyrrell&#8217;s Sea Salt &amp; Cider Vinegar', 'Thicker, hand-cooked British crisps, an alternative to the classic Walkers style.', 'dp:B01G2873H6'],
        ['Walkers MEGA Monster Munch Pickled Onion (6 pack)', 'Pickled onion Monster Munch corn snacks in the bigger MEGA size.', 'dp:B004ISJK38'],
      ] },
    ],
    extra: `
    <section class="cp-section" id="compare">
      <h2>Comparison Table</h2>
      <div class="sb-table-wrap">
      <table class="sb-table">
        <thead><tr><th scope="col">Crisp</th><th scope="col">Maker</th><th scope="col">Style</th><th scope="col">Good to know</th></tr></thead>
        <tbody>
        <tr><th scope="row">Walkers multipack</th><td>Walkers</td><td>Thin, classic</td><td>Britain&#8217;s largest crisp maker</td></tr>
        <tr><th scope="row">Cheese &amp; Onion</th><td>Walkers</td><td>Thin, classic</td><td>Flavour since 1954</td></tr>
        <tr><th scope="row">Salt &amp; Shake</th><td>Walkers</td><td>Plain, salt sachet</td><td>Revives the old Smith&#8217;s idea</td></tr>
        <tr><th scope="row">Sea Salt &amp; Cider Vinegar</th><td>Tyrrell&#8217;s</td><td>Thick, hand-cooked</td><td>A vinegar crisp</td></tr>
        <tr><th scope="row">MEGA Monster Munch</th><td>Walkers</td><td>Corn snack</td><td>Pickled onion</td></tr>
        </tbody>
      </table>
      </div>
    </section>`,
    faqs: [
      ['What are the most popular British crisp flavours?', 'Walkers&#8217; big three are Ready Salted, Cheese &amp; Onion (since 1954) and Salt &amp; Vinegar (since 1967, a nod to fish and chips).'],
      ['What is the biggest crisp brand in the UK?', 'Walkers, founded in Leicester in 1948 and owned by PepsiCo since 1989, is Britain&#8217;s largest crisp maker. Tyrrell&#8217;s, Pipers, Kettle and McCoy&#8217;s are other well-known names.'],
      ['Who invented cheese and onion crisps?', 'Cheese &amp; onion is widely credited to Joe &#8220;Spud&#8221; Murphy of Ireland&#8217;s Tayto and his employee Seamus Burke in 1954. Walkers launched its own Cheese &amp; Onion the same year.'],
    ],
    sources: [],
    related: [['united-kingdom', '🇬🇧 UK chip guide'], ['best-chip-gift-boxes', '🎁 Chip gift boxes'], ['where-to-buy-asian-chips-europe', '🇪🇺 Buying in Europe'], ['best-international-chip-variety-packs', '🌍 International variety packs']],
  },
];

GUIDES.push(...morePages({ amazonSearch, esc, ROOT }));

// ---------- page template ----------
const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
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

function render(g) {
  const CK = g.checked || LAST_CHECKED, CKL = g.checkedLabel || LAST_CHECKED_LABEL;
  const fill = (t) => t.replace(/\$\{LAST_CHECKED_LABEL\}/g, CKL);
  const href = (h) => (h.startsWith('dp:') ? amazonDp(h.slice(3)) : h);
  const url = `${SITE}/${g.slug}/`;
  for (const [s] of g.related) if (!fs.existsSync(path.join(ROOT, s, 'index.html')) && !GUIDES.some((x) => x.slug === s)) throw new Error(`missing page /${s}/`);
  const intro = fill(g.intro);
  const ld = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'Article', '@id': `${url}#article`, headline: g.h1, description: g.desc, url, mainEntityOfPage: { '@type': 'WebPage', '@id': url },
      inLanguage: 'en', dateModified: CK,
      author: { '@type': 'Organization', name: 'World of Chips', url: `${SITE}/` },
      publisher: { '@type': 'Organization', name: 'World of Chips', url: `${SITE}/` },
      isPartOf: { '@type': 'WebSite', name: 'World of Chips', url: `${SITE}/` } },
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'World of Chips', item: `${SITE}/` },
      ...(g.parent ? [{ '@type': 'ListItem', position: 2, name: g.parent[1], item: `${SITE}/${g.parent[0]}/` }] : []),
      { '@type': 'ListItem', position: g.parent ? 3 : 2, name: g.crumb, item: url }] },
    ...(g.sections.length ? [{ '@type': 'ItemList', name: g.sections[0].h2, itemListElement: g.sections[0].items.map(([n], i) => ({ '@type': 'ListItem', position: i + 1, name: stripTags(n) })) }] : []),
    ...(g.ldExtra || []),
    { '@type': 'FAQPage', '@id': `${url}#faq`, mainEntity: g.faqs.map(([q, a]) => ({ '@type': 'Question', name: stripTags(q), acceptedAnswer: { '@type': 'Answer', text: stripTags(a) } })) },
  ] };
  const sections = g.sections.map((s) => `
    <section class="cp-section" id="${s.id}">
      <h2>${s.h2}</h2>
      <ol class="gd-picks">
        ${s.items.map(([n, d, h]) => `<li><strong>${n}</strong><p>${fill(d)}</p><p>${h.startsWith('dp:') ? `<a href="${esc(href(h))}" target="_blank" rel="sponsored nofollow noopener" class="buy-btn">Buy on Amazon &#8594;</a>` : amz(h, `Find ${n} on Amazon &#8594;`)}</p></li>`).join('\n        ')}
      </ol>
      ${s.note === '' ? '' : '<p class="sb-muted">We link to Amazon searches where single import listings go in and out of stock often; pick a listing that shows as in stock and check the pack size.</p>'}
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
${g.ogImage ? `<meta property="og:image" content="${SITE}${g.ogImage}">\n<meta name="twitter:image" content="${SITE}${g.ogImage}">\n` : ''}<meta name="twitter:card" content="${g.ogImage ? 'summary_large_image' : 'summary'}">
<meta name="twitter:title" content="${esc(g.title)}">
<meta name="twitter:description" content="${esc(g.desc)}">
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
.gd-picks{margin:1rem 0 0 1.3rem}
.gd-picks li{background:var(--paper);border:1px solid var(--light-border);border-radius:12px;padding:.9rem 1rem;margin-bottom:.8rem;font-size:.92rem;line-height:1.6}
.gd-picks strong{color:var(--brown);font-family:'Playfair Display',serif;font-size:1.05rem}
.gd-picks a,.cp-section a{color:#1A4570}
.buy-btn{display:inline-block;background:var(--gold);color:#fff;font-weight:700;padding:.55rem 1.1rem;border-radius:999px;text-decoration:none;font-size:.88rem}
.buy-btn:hover{filter:brightness(1.08)}
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
${mlUniversal}
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
    <a href="/flavors/">Flavours</a>
    <a href="/#shop">Where to Buy</a>
  </div>
</nav>

<main>
<article class="country-page active" id="${g.slug}">
  <div class="cp-hero">
    <a href="/" class="cp-back">← Back to World of Chips</a>
    <nav class="cp-crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › ${g.parent ? `<a href="/${g.parent[0]}/">${esc(g.parent[1])}</a> › ` : ''}<span>${esc(g.crumb)}</span></nav>
    <span class="cp-flag">${g.flag}</span>
    <h1 class="cp-title">${esc(g.h1)}</h1>
    <span class="cp-region">Last checked ${CKL}</span>
    <p class="cp-intro-dark">${g.introDark}</p>
  </div>
  <div class="cp-body">
${g.disc === false ? '' : `    <p class="aff-disc sb-top-disc">${DISCLOSURE}</p>`}

    <p class="cp-intro">${intro}</p>
${sections}${fill(g.body || '')}${fill(g.extra || '')}

    <section class="cp-section sb-faq" id="faq">
      <h2>FAQs</h2>
      ${g.faqs.map(([q, a]) => `<h3>${q}</h3>\n      <p>${a}</p>`).join('\n      ')}
    </section>
${g.sources.length ? `
    <section class="cp-section" id="sources">
      <h2>Sources</h2>
      <p class="sb-sources">Checked on ${CKL}: ${g.sources.map(srcLink).join(', ')}</p>
    </section>
` : ''}
${g.disc === false ? '' : `    <p class="aff-disc">${DISCLOSURE}</p>
`}
    ${newsletterBlock('    ')}

    <nav class="cp-cta" aria-label="More chip guides">
      <h2>More Chip Guides</h2>
      <div class="cp-explore-grid">${g.related.map(([s, l]) => `<a href="/${s}/" class="cp-explore-link">${l}</a>`).join('')}<a href="/news/" class="cp-explore-link">📰 Chip News</a></div>
      <p style="margin-top:2rem"><a href="/" class="cp-explore-link">🌍 Back to the Global Chip Map</a></p>
    </nav>
  </div>
</article>
</main>

${footerHtml}
${(g.scriptSrc || []).map((u) => `<script src="${u}"></script>\n`).join('')}${g.script ? `<script>\n${g.script}\n</script>\n` : ''}
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
const blocks = GUIDES.map((g) => `  <url>\n    <loc>${SITE}/${g.slug}/</loc>\n    <lastmod>${g.checked || LAST_CHECKED}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`).join('');
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
