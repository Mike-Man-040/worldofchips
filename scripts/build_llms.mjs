#!/usr/bin/env node
// Build /llms.txt (llmstxt.org index) and /llms-full.txt (Markdown fact sheet) from the
// already-generated HTML pages + sitemap.xml, so they always match what is published.
// Run AFTER the other builders.  Usage: node scripts/build_llms.mjs [--check]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://worldofchips.com';
const CHECK = process.argv.includes('--check');

const unesc = (s) => s.replace(/<[^>]+>/g, '').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const locs = [...fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

const pages = locs.map((loc) => {
  const rel = loc.replace(SITE, '').replace(/^\//, '');
  const html = fs.readFileSync(path.join(ROOT, rel, 'index.html'), 'utf8');
  const title = unesc((html.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || loc).replace(/\s*\|\s*World of Chips$/, '');
  const desc = unesc((html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '');
  const graph = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .flatMap((m) => { const j = JSON.parse(m[1]); return j['@graph'] || [j]; });
  const faq = (graph.find((n) => n['@type'] === 'FAQPage') || { mainEntity: [] }).mainEntity
    .map((q) => [q.name, q.acceptedAnswer.text]);
  const facts = [...((html.match(/<table class="cp-facts">([\s\S]*?)<\/table>/) || [])[1] || '')
    .matchAll(/<th scope="row">([\s\S]*?)<\/th><td>([\s\S]*?)<\/td>/g)].map((m) => [unesc(m[1]), unesc(m[2])]);
  return { loc, rel, title, desc, faq, facts, isCountry: facts.length > 0 };
});

const home = pages.find((p) => p.rel === '');
const countries = pages.filter((p) => p.isCountry);
const flavors = pages.filter((p) => p.rel.startsWith('flavors/') && p.rel !== 'flavors/');
const guides = pages.filter((p) => p.rel && !p.isCountry && p.rel !== 'news/' && !flavors.includes(p));
const news = pages.filter((p) => p.rel === 'news/');
const fact = (p, k) => (p.facts.find(([n]) => n === k) || [, ''])[1];
const line = (p) => `- [${p.title}](${p.loc}): ${p.isCountry
  ? `Leading brands ${fact(p, 'Leading brands')}; signature flavors ${fact(p, 'Signature flavors')}; unique flavors, culture, FAQs and where to buy.`
  : p.desc}`;

const llms = `# World of Chips

> ${home.desc}

World of Chips is an independent guide to potato chip culture around the world: leading brands, popular and unique flavors, snacking occasions and where to buy chips from ${countries.length} countries, plus buyer's guides and chip news. Some links are Amazon affiliate links (World of Chips earns from qualifying purchases).

## Main

- [World of Chips: Global Chip Map](${home.loc}): Interactive world map and overview of every country guide.
${news.map(line).join('\n')}

## Country guides

${countries.map(line).join('\n')}

## Buyer's guides

${guides.map(line).join('\n')}

## Flavour pages

${flavors.map(line).join('\n')}

## Optional

- [Full fact sheet (Markdown)](${SITE}/llms-full.txt): Per-country quick facts and FAQs in one file.
- [Sitemap](${SITE}/sitemap.xml)
`;

const full = `# World of Chips — full fact sheet

> ${home.desc}

Source: ${SITE}/ . Generated from the published pages; every fact below appears on the linked page.

## Country guides

${countries.map((p) => `### ${p.title}

URL: ${p.loc}

${p.facts.map(([k, v]) => `- **${k}:** ${v}`).join('\n')}

${p.faq.map(([q, a]) => `**Q: ${q}**\nA: ${a}`).join('\n\n')}
`).join('\n')}
## Buyer's guides

${guides.map((p) => `### ${p.title}

URL: ${p.loc}

${p.desc}
${p.faq.length ? '\n' + p.faq.map(([q, a]) => `**Q: ${q}**\nA: ${a}`).join('\n\n') + '\n' : ''}`).join('\n')}
## News

${news.map(line).join('\n')}
`;

let stale = false;
for (const [f, body] of [['llms.txt', llms], ['llms-full.txt', full]]) {
  const fp = path.join(ROOT, f);
  if (CHECK) { if (!fs.existsSync(fp) || fs.readFileSync(fp, 'utf8') !== body) { console.error(`${f} is stale: run node scripts/build_llms.mjs`); stale = true; } }
  else fs.writeFileSync(fp, body);
}
if (stale) process.exit(1);
if (!CHECK) console.log(`Wrote llms.txt and llms-full.txt (${pages.length} pages, ${countries.length} countries).`);
