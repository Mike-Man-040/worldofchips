// Properly licensed photos (Wikimedia Commons, CC0 / public domain / CC BY / CC BY-SA) used on the site.
// Every entry lists the Commons file page, author and licence; the credit is printed in each figure's caption.
// Files in /assets/photos/: <key>-480.webp and <key>-960.webp (resized from Commons, quality 78) and
// og-<key>.jpg (1200x630 centre crop for og:image). No retailer or Amazon product images.
// The Pringles Index (/pringles-index/) deliberately has no entry here.
const CC = {
  'CC0': 'https://creativecommons.org/publicdomain/zero/1.0/',
  'CC BY 4.0': 'https://creativecommons.org/licenses/by/4.0/',
  'CC BY-SA 2.5': 'https://creativecommons.org/licenses/by-sa/2.5/',
  'CC BY-SA 3.0': 'https://creativecommons.org/licenses/by-sa/3.0/',
  'CC BY-SA 4.0': 'https://creativecommons.org/licenses/by-sa/4.0/',
  'Public domain': 'https://commons.wikimedia.org/wiki/Help:Public_domain',
};
const C = 'https://commons.wikimedia.org/wiki/File:';
export const PHOTOS = {
  'potato-chips-pile': { w: 960, h: 720, alt: 'A close-up pile of golden kettle-cooked potato chips', author: 'Evan-Amos', lic: 'Public domain', page: C + 'Potato-Chips.jpg' },
  'christmas-party-snacks': { w: 960, h: 892, alt: 'A table laid with snacks and bowls at a Christmas party, with a red bow on the cabinet behind', author: 'Crisco 1492', lic: 'CC BY-SA 4.0', page: C + 'Snacks_at_a_Christmas_party,_Chatham,_Ontario,_2014-12-13.jpg' },
  'bowl-of-snacks': { w: 960, h: 960, alt: 'A red bowl of mixed snacks: Cheetos, Lay\u2019s, Doritos and Ruffles', author: 'Toby Scratch Fanatic', lic: 'CC0', page: C + 'A_bowl_of_snacks.jpg' },
  'chips-bowl-party': { w: 960, h: 786, alt: 'A paper-lined bowl full of potato chips at a party', author: 'Tomwsulcer', lic: 'CC0', page: C + 'Chips_in_a_bowl_at_a_party.JPG' },
  'japanese-snacks': { w: 960, h: 723, alt: 'A large round Japanese rice cracker snack on its printed packaging', author: 'Syced', lic: 'CC0', page: C + 'Japanese_snack.jpg' },
  takis: { w: 960, h: 1280, alt: 'Boxes of Takis rolled tortilla chips stacked on a pallet in a shop', author: 'knucklebone55', lic: 'CC BY-SA 3.0', page: C + 'Takis.jpg' },
  'honey-butter-chip': { w: 960, h: 640, alt: 'An open bag of Haitai Honey Butter Chip with the chips spilling out', author: '\uC218\uC6D0\uC54C\uB9BC\uC774 *\uB77C\uD504*', lic: 'CC BY 4.0', page: C + '%ED%95%B4%ED%83%9C%EC%A0%9C%EA%B3%BC_%ED%97%88%EB%8B%88%EB%B2%84%ED%84%B0%EC%B9%A9_1.jpg' },
  'honey-butter-chip-2': { w: 960, h: 640, alt: 'Haitai Honey Butter Chip potato chips in their open yellow bag', author: '\uC218\uC6D0\uC54C\uB9BC\uC774 *\uB77C\uD504*', lic: 'CC BY 4.0', page: C + '%ED%95%B4%ED%83%9C%EC%A0%9C%EA%B3%BC_%ED%97%88%EB%8B%88%EB%B2%84%ED%84%B0%EC%B9%A9_2.jpg' },
  'calbee-norishio': { w: 960, h: 640, alt: 'A single Calbee seaweed-salt (norishio) potato chip, flecked with green aonori', author: '\u4E9B\u7D30\u306A\u65E5\u5E38', lic: 'CC BY-SA 4.0', page: C + 'Potato-chips.jpg' },
  'sabritas-shelf': { w: 960, h: 1280, alt: 'A supermarket display stacked with many varieties of Sabritas chips in Mexico', author: 'CodleexOrg', lic: 'CC BY-SA 4.0', page: C + 'Estante_de_sabritas.jpg' },
  'walkers-salt-vinegar': { w: 960, h: 640, alt: 'An open packet of Walkers Salt & Vinegar crisps', author: 'Gerolsteiner91', lic: 'CC BY-SA 2.5', page: C + 'Salt-and-Vinegar.JPG' },
  'lays-crab': { w: 960, h: 541, alt: 'Lay\u2019s crab-flavoured potato chips, a Russian favourite', author: 'Sergey A. Demidov', lic: 'CC BY 4.0', page: C + '20251210_Lay%27s_chips_with_crab.jpg' },
  'lays-delivery-poland': { w: 960, h: 720, alt: 'A yellow Lay\u2019s delivery van unloading chips at a shop in Tomasz\u00F3w Mazowiecki, Poland', author: 'WrS.tm.pl', lic: 'Public domain', page: C + 'Delivery_of_Lay%27s_chips_to_a_store_in_the_center_of_Tomasz%C3%B3w_Mazowiecki,_Poland.jpg' },
  doritos: { w: 900, h: 805, alt: 'A pile of orange nacho cheese Doritos tortilla chips', author: 'Scott Ehardt', lic: 'Public domain', page: C + 'Doritos.jpg' },
};
// page slug ('' = homepage) -> photo key
export const PAGE_PHOTO = {
  '': 'potato-chips-pile',
  'christmas-chip-gifts-2026': 'christmas-party-snacks',
  'best-chip-gift-boxes': 'bowl-of-snacks',
  'christmas-snack-box-comparison-2026': 'chips-bowl-party',
  'snack-boxes': 'japanese-snacks',
  'where-to-buy-takis-europe': 'takis',
  'where-to-buy-honey-butter-chip-europe': 'honey-butter-chip',
  japan: 'calbee-norishio',
  'south-korea': 'honey-butter-chip-2',
  mexico: 'sabritas-shelf',
  'united-kingdom': 'walkers-salt-vinegar',
  russia: 'lays-crab',
  poland: 'lays-delivery-poland',
  'united-states': 'doritos',
};
const e = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const photoFor = (slug) => (slug === 'pringles-index' ? null : PAGE_PHOTO[slug] || null);
export const ogPhoto = (slug) => { const k = photoFor(slug); return k ? { src: `/assets/photos/og-${k}.jpg`, alt: PHOTOS[k].alt } : null; };
export const PHOTO_CSS_LINK = '<link rel="stylesheet" href="/assets/extras.css">';
export function photoFigure(key, { eager = false, indent = '    ' } = {}) {
  const p = PHOTOS[key];
  if (!p) throw new Error(`photos: unknown photo ${key}`);
  const big = `/assets/photos/${key}-960.webp`, small = `/assets/photos/${key}-480.webp`;
  const licLink = p.lic === 'Public domain' ? 'public domain' : `<a href="${CC[p.lic]}" target="_blank" rel="nofollow noopener license">${p.lic}</a>`;
  const mod = /BY/.test(p.lic) ? ', resized' : '';
  return `
${indent}<figure class="woc-photo">
${indent}  <img src="${big}" srcset="${small} 480w, ${big} ${p.w}w" sizes="(max-width: 820px) 100vw, 780px" width="${p.w}" height="${p.h}" alt="${e(p.alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">
${indent}  <figcaption>Photo: <a href="${p.page}" target="_blank" rel="nofollow noopener">${e(p.author)}</a> via Wikimedia Commons, ${licLink}${mod}.</figcaption>
${indent}</figure>
`;
}
// Plain share links (no scripts, no tracking). url/title are the page's canonical URL and title.
export function shareRow(url, title, indent = '    ') {
  const u = encodeURIComponent(url), t = encodeURIComponent(title.replace(/ \| World of Chips$/, ''));
  const k = photoFor(url.replace(/^https:\/\/worldofchips\.com\/?/, '').replace(/\/$/, ''));
  const media = k ? `&media=${encodeURIComponent(`https://worldofchips.com/assets/photos/og-${k}.jpg`)}` : '';
  const L = [
    ['Pinterest', `https://www.pinterest.com/pin/create/button/?url=${u}${media}&description=${t}`],
    ['X', `https://x.com/intent/post?url=${u}&text=${t}`],
    ['Facebook', `https://www.facebook.com/sharer/sharer.php?u=${u}`],
    ['WhatsApp', `https://wa.me/?text=${t}%20${u}`],
  ];
  return `
${indent}<nav class="woc-share" aria-label="Share this page">
${indent}  <span>Share:</span>${L.map(([n, h]) => `<a href="${e(h)}" target="_blank" rel="nofollow noopener">${n}</a>`).join('')}<a href="${e(url)}" class="woc-copy" title="Copy this link" onclick="if(navigator.clipboard){navigator.clipboard.writeText(this.href);this.textContent='Link copied';return false}">Copy link</a>
${indent}</nav>
`;
}
