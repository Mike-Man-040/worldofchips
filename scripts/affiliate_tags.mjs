// Amazon Associates tracking IDs, one per site section. Change a section's tag here (one line) and
// rebuild; every amazon.com link generated for that section picks it up. Pages are built with the
// default tag and retagged at write time by retag(), so source data can keep plain links.
// The Pringles Index (/pringles-index/) is deliberately excluded and keeps the default tag.
export const DEFAULT_AMAZON_TAG = 'worldofchips-20';
export const AMAZON_TAGS = {
  country: 'woc-country-20', // /<country>/ pages (build_country_pages.mjs)
  gift: 'woc-gift-20',       // /christmas-chip-gifts-2026/
  flavor: 'woc-flavor-20',   // /flavors/ and /flavors/<flavour>/
  spice: 'woc-spice-20',     // /spiciest-chips/ (spice ladder)
  guides: 'woc-guides-20',   // all other build_guides.mjs pages
};
export const ALL_AMAZON_TAGS = [DEFAULT_AMAZON_TAG, ...Object.values(AMAZON_TAGS)];
export const tagFor = (section) => AMAZON_TAGS[section] || DEFAULT_AMAZON_TAG;
export function guideSection(slug) {
  if (slug === 'pringles-index') return null;
  if (slug === 'christmas-chip-gifts-2026') return 'gift';
  if (slug === 'flavors' || slug.startsWith('flavors/')) return 'flavor';
  if (slug === 'spiciest-chips') return 'spice';
  return 'guides';
}
export const retag = (html, section) => (section
  ? html.replace(/(amazon\.com\/[^\s"'<>]*?[?&](?:amp;)?tag=)worldofchips-20/g, `$1${tagFor(section)}`)
  : html);

// Daebak (daebak.co) referral programme: 10% commission on Korean snack boxes.
// Copy is limited to: Korean snack subscription box, ships internationally from daebak.co.
export const DAEBAK_LINK = 'https://daebak.co?sca_ref=12575992.ZFUvl8WKOqs2QeWy';
export const DAEBAK_REL = 'sponsored nofollow noopener';
// Box styled like the "Shop on Amazon" / Universal Yums boxes (.shop-top/.buy-btn-lg); place ABOVE Amazon picks.
export const daebakBox = (indent = '    ') => `
${indent}<aside class="cp-section shop-top daebak-top" id="daebak" aria-labelledby="daebak-top-title">
${indent}  <h2 id="daebak-top-title">🇰🇷 Korean snack box: Daebak</h2>
${indent}  <p>Daebak is a Korean snack subscription box that ships internationally from daebak.co.</p>
${indent}  <a href="${DAEBAK_LINK}" target="_blank" rel="${DAEBAK_REL}" class="buy-btn buy-btn-lg" data-affiliate="daebak">🇰🇷 Get the Daebak box &#8594;</a>
${indent}  <p class="aff-disc">Affiliate link: World of Chips may earn a commission if you subscribe, at no extra cost to you.</p>
${indent}</aside>
`;

// Universal Yums via Awin (advertiser 90729, publisher 3136222): $10 per new subscription,
// 30-day cookie, US programme. Use this instead of plain universalyums.com links.
export const UNIVERSAL_YUMS_AWIN = 'https://www.awin1.com/cread.php?awinmid=90729&awinaffid=3136222&ued=https%3A%2F%2Fwww.universalyums.com%2F';
export const AWIN_REL = 'sponsored nofollow noopener';
// Prominent Universal Yums box, placed ABOVE Amazon picks (higher-paying snack-box affiliate).
// Copy is limited to facts on universalyums.com (checked 2 Nov 2026). Uses the .shop-top /
// .buy-btn-lg styles of the "Shop on Amazon" boxes; YUMS_BOX_CSS carries them for pages without.
export const YUMS_BOX_CSS = `.shop-top{background:var(--paper);border:2px solid var(--gold);border-radius:14px;padding:1.3rem 1.4rem;margin:1.2rem 0 1.6rem;text-align:center;box-shadow:0 6px 18px rgba(232,168,56,.18)}
.shop-top h2{margin-bottom:.4rem}
.shop-top p{margin:.3rem 0}
.buy-btn.buy-btn-lg{justify-content:center;min-height:58px;font-size:1.15rem;padding:1rem 2.4rem;margin:.7rem 0 .4rem;box-shadow:0 4px 12px rgba(196,138,32,.35)}
@media(max-width:600px){.buy-btn.buy-btn-lg{display:flex;width:100%}}
`;
export const yumsBox = (indent = '    ') => `
${indent}<aside class="cp-section shop-top yums-top" id="universal-yums" aria-labelledby="yums-top-title">
${indent}  <h2 id="yums-top-title">🌍 Our Snack-Box Pick: Universal Yums</h2>
${indent}  <p>A monthly international snack box with sweet and savory snacks from a different country each month, plus a booklet with trivia and games. Choose the Yum Box (5&#8211;7 snacks), Yum Yum Box (10&#8211;12) or Super Yum Box (15&#8211;18, with a specialty drink or food).</p>
${indent}  <p>Universal Yums ships from the US, with free US shipping (US and Canada delivery only).</p>
${indent}  <a href="${UNIVERSAL_YUMS_AWIN.replace(/&/g, '&amp;')}" target="_blank" rel="${AWIN_REL}" class="buy-btn buy-btn-lg" data-affiliate="universalyums">🌍 Get Universal Yums &#8594;</a>
${indent}  <p class="aff-disc">Affiliate link: World of Chips may earn a commission if you subscribe, at no extra cost to you.</p>
${indent}</aside>
`;

// Short snack-box lead for high-traffic pages. Place ABOVE Amazon. Facts are only those already
// in yumsBox / daebakBox (checked on the company sites). No country is named as a featured
// Universal Yums box unless that claim already exists; Canada is the shipping exception.
// Daebak stays in an expandable section so the visible CTA stays the higher-value Yums link.
export const snackBoxLead = ({ shipsToCanada = false, tone = 'country', indent = '    ' } = {}) => {
  const ship = shipsToCanada
    ? 'It ships to Canada and the US, with free shipping in the contiguous US.'
    : 'It ships to the US and Canada only, with free shipping in the contiguous US.';
  const heading = tone === 'canada'
    ? 'A snack box that ships to Canada'
    : tone === 'spice'
      ? 'A box of snacks from around the world'
      : 'Taste snacks from another country at home';
  const yumsLabel = tone === 'spice' ? 'See what Universal Yums sends' : 'Open a Universal Yums box';
  const summary = tone === 'spice' ? 'Or a Korean box, shipped internationally' : 'Prefer a Korean snack box?';
  return `
${indent}<aside class="cp-section shop-top yums-top" id="snack-box" aria-labelledby="snack-box-title">
${indent}  <h2 id="snack-box-title">${heading}</h2>
${indent}  <p>Universal Yums sends sweet and savory snacks from a different country each month, plus a booklet with trivia and games. ${ship}</p>
${indent}  <a href="${UNIVERSAL_YUMS_AWIN.replace(/&/g, '&amp;')}" target="_blank" rel="${AWIN_REL}" class="buy-btn buy-btn-lg" data-affiliate="universalyums">🌍 ${yumsLabel} &#8594;</a>
${indent}  <p><a href="/snack-boxes/" class="cp-explore-link">See the boxes side by side &#8594;</a></p>
${indent}  <details class="snack-more">
${indent}    <summary>${summary}</summary>
${indent}    <p>Daebak is a Korean snack subscription box that ships internationally from daebak.co.</p>
${indent}    <p><a href="${DAEBAK_LINK}" target="_blank" rel="${DAEBAK_REL}" class="buy-btn" data-affiliate="daebak">🇰🇷 See the Daebak box &#8594;</a></p>
${indent}  </details>
${indent}  <p class="aff-disc" style="border:none;padding-top:.35rem;margin:.45rem auto 0">Affiliate links: World of Chips may earn a commission if you subscribe, at no extra cost to you.</p>
${indent}</aside>
`;
};

// bol.com affiliate programme (Site ID 1555738), for readers in the Netherlands & Belgium.
// Deeplink format per affiliate.bol.com/nl/handleiding/handleiding-productlink/ (checked 3 Nov 2026):
// https://partner.bol.com/click/click?p=2&t=url&s=<SiteID>&f=TXL&url=<encoded bol URL>&name=<name>
// Only link to real bol.com search/category URLs (no invented product IDs).
export const BOL_SITE_ID = '1555738';
export const BOL_TAG = BOL_SITE_ID;
export const BOL_REL = 'sponsored nofollow noopener';
export const bolSearchUrl = (q) => `https://www.bol.com/nl/nl/s/?searchtext=${encodeURIComponent(q)}`;
export const bolLink = (bolUrl, name) =>
  `https://partner.bol.com/click/click?p=2&t=url&s=${BOL_SITE_ID}&f=TXL&url=${encodeURIComponent(bolUrl)}&name=${encodeURIComponent(name)}`;
// Box styled like the "Shop on Amazon" box (.shop-top/.buy-btn); placed beside/below Amazon.
// links: [{ n: 'Label', q: 'search text' }]
export const bolBox = (links, indent = '    ') => {
  const a = (l, cls) => `<a href="${bolLink(bolSearchUrl(l.q), l.id || l.n).replace(/&/g, '&amp;')}" target="_blank" rel="${BOL_REL}" class="${cls}" data-affiliate="bol">${l.n} &#8594;</a>`;
  const [first, ...rest] = links;
  return `
${indent}<aside class="cp-section shop-top bol-box" id="bol" aria-labelledby="bol-title">
${indent}  <h2 id="bol-title">🇳🇱🇧🇪 For readers in the Netherlands &amp; Belgium</h2>
${indent}  <p>Shopping from the Netherlands or Belgium? bol.com delivers these to NL and BE addresses. Links open a bol.com search, so check what&#8217;s in stock and the current price there.</p>
${indent}  ${a({ ...first, id: first.n, n: `🛒 ${first.n} on bol.com` }, 'buy-btn buy-btn-lg')}
${rest.length ? `${indent}  <div class="buy-grid" style="display:flex;flex-wrap:wrap;gap:.5rem;justify-content:center">
${indent}    ${rest.map((l) => a(l, 'buy-btn')).join(`\n${indent}    `)}
${indent}  </div>
` : ''}${indent}  <p class="aff-disc">Affiliate links: World of Chips may earn a commission from bol.com purchases, at no extra cost to you.</p>
${indent}</aside>
`;
};
