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
