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
