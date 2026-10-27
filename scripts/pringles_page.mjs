// /pringles-index/ page, built from data/pringles_index_2026-10.json (scripts/build_pringles_data.py).
// Static, crawlable HTML (bars, tables) + a small script for the map, the per-100 g / per-can toggle and
// the low-confidence toggle. Reuses existing classes only (bar-row/bar-track/bar-fill, filter-btn, sb-table, map-tooltip).
import fs from 'node:fs';
import path from 'node:path';

const ISO_NUM = { TR: '792', HU: '348', CO: '170', RU: '643', AU: '036', PL: '616', CZ: '203', DK: '208', KR: '410', ZA: '710', BR: '076', MX: '484', CH: '756', AE: '784', GB: '826', NL: '528', SE: '752', TH: '764', ES: '724', NZ: '554', DE: '276', EG: '818', IT: '380', US: '840', JP: '392', PH: '608', CA: '124', ID: '360', CN: '156', IN: '356', FR: '250' };
const SLUG = { TR: 'turkey', CO: 'colombia', RU: 'russia', AU: 'australia', PL: 'poland', KR: 'south-korea', ZA: 'south-africa', BR: 'brazil', MX: 'mexico', GB: 'united-kingdom', NL: 'netherlands', SE: 'sweden', TH: 'thailand', ES: 'spain', NZ: 'new-zealand', DE: 'germany', EG: 'egypt', IT: 'italy', US: 'united-states', JP: 'japan', CA: 'canada', ID: 'indonesia', CN: 'china', IN: 'india', FR: 'france' };
const PT = { regular: 'regular price', mrp: 'MRP (legal max. retail price)', lowest_listed: 'lowest listed of several shops', marketplace: 'marketplace seller', estimate_midpoint: 'midpoint of a published range' };

export default function pringlesPage({ esc, ROOT, CK }) {
  const D = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'pringles_index_2026-10.json'), 'utf8'));
  const C = D.countries, M = D.meta, base = M.base_usd_per_100g;
  for (const c of C) {
    if (!ISO_NUM[c.iso2]) throw new Error(`pringles: no ISO numeric code for ${c.iso2}`);
    if (SLUG[c.iso2] && !fs.existsSync(path.join(ROOT, SLUG[c.iso2], 'index.html'))) throw new Error(`pringles: missing /${SLUG[c.iso2]}/`);
  }
  const top = C[0], cheap = C[C.length - 1];
  const name = (c) => (SLUG[c.iso2] ? `<a href="/${SLUG[c.iso2]}/">${esc(c.country)}</a>` : esc(c.country)) + (c.confidence === 'low' ? ' *' : '');
  const mx100 = Math.max(...C.map((c) => c.usd_per_100g)), mxCan = Math.max(...C.map((c) => c.usd_price_can));
  const col = (c) => (c.iso2 === 'US' ? 'var(--brown)' : c.index_vs_us > 100 ? 'var(--red)' : 'var(--green)');
  const bars = C.map((c) => `<div class="bar-row" data-low="${c.confidence === 'low' ? 1 : 0}" data-v100="${c.usd_per_100g}" data-vcan="${c.usd_price_can}"><div class="bar-label" style="width:150px">${name(c)}</div><div class="bar-track"><div class="bar-fill" style="width:${(c.usd_per_100g / mx100 * 100).toFixed(1)}%;background:${col(c)}" data-w100="${(c.usd_per_100g / mx100 * 100).toFixed(1)}" data-wcan="${(c.usd_price_can / mxCan * 100).toFixed(1)}">$${c.usd_per_100g.toFixed(2)}</div></div></div>`).join('\n        ');
  const vmax = Math.max(...C.map((c) => Math.abs(c.currency_valuation_pct)));
  const vbars = C.filter((c) => c.iso2 !== 'US').map((c) => {
    const w = Math.abs(c.currency_valuation_pct) / vmax * 50, pos = c.currency_valuation_pct >= 0;
    return `<div class="bar-row" data-low="${c.confidence === 'low' ? 1 : 0}"><div class="bar-label" style="width:150px">${esc(c.country)}${c.confidence === 'low' ? ' *' : ''} ${pos ? '+' : ''}${c.currency_valuation_pct.toFixed(0)}%</div><div class="bar-track"><div class="bar-fill" style="width:${w.toFixed(1)}%;margin-left:${(pos ? 50 : 50 - w).toFixed(1)}%;background:${pos ? 'var(--red)' : 'var(--green)'}"></div></div></div>`;
  }).join('\n        ');
  const rows = C.map((c) => `<tr><th scope="row">${name(c)}</th><td><a href="${esc(c.source_url)}" target="_blank" rel="nofollow noopener">${esc(c.retailer)}</a></td><td>${esc(c.currency)} ${c.local_price.toLocaleString('en-GB')}</td><td>${c.pack_grams} g</td><td>$${c.usd_price_can.toFixed(2)}</td><td>$${c.usd_per_100g.toFixed(2)}</td><td>${c.index_vs_us.toFixed(0)}</td><td>${c.price_observed === 'unknown' ? '<strong>date unknown</strong>' : esc(c.price_observed)}</td><td>${esc(c.confidence)}${c.price_type !== 'regular' ? `; ${esc(PT[c.price_type] || c.price_type)}` : ''}</td><td>${esc(c.notes || '')}</td></tr>`).join('\n          ');
  const bl = D.backlog;
  const fxPending = bl.filter((b) => /rate/i.test(b.reason)).map((b) => b.country);
  const excluded = bl.filter((b) => !/rate/i.test(b.reason)).map((b) => `${esc(b.country)} (${esc(b.reason.replace(/\.$/, ''))})`);
  const mapData = Object.fromEntries(C.map((c) => [ISO_NUM[c.iso2], [c.country, c.currency, c.local_price, c.pack_grams, c.usd_per_100g, c.index_vs_us, c.retailer, c.confidence]]));
  const pngUrl = 'https://worldofchips.com/assets/pringles-index-2026-10.png';
  const embed = `<a href="https://worldofchips.com/pringles-index/"><img src="${pngUrl}" alt="The World of Chips Pringles Index, ${M.edition}" width="1200" height="1404" style="max-width:100%;height:auto"></a>`;
  const body = `
    <section class="cp-section" id="headline">
      <h2>A can of Pringles costs ${(top.index_vs_us / 100).toFixed(1)}&#215; more in ${esc(top.country)} than in the US</h2>
      <p>Per 100 g, Pringles Original costs <strong>$${top.usd_per_100g.toFixed(2)}</strong> in ${esc(top.country)} against a US baseline of <strong>$${base.toFixed(2)}</strong> (a ${C.find((c) => c.iso2 === 'US').pack_grams} g can at $${C.find((c) => c.iso2 === 'US').local_price.toFixed(2)}, Walmart). The cheapest markets in this edition are ${esc(cheap.country)} and ${esc(C[C.length - 2].country)} at about $${cheap.usd_per_100g.toFixed(2)}. ${C.length} markets, prices checked ${esc(M.retrieved)}.</p>
    </section>
    <section class="cp-section" id="map">
      <h2>The Map</h2>
      <p class="sb-muted">Colour = index vs US (100). Green is cheaper than the US and red is pricier. Grey means not in this edition.</p>
      <div class="map-wrapper"><svg id="piMap" viewBox="0 0 960 500" role="img" aria-label="World map of the Pringles Index"></svg></div>
      <div class="map-tooltip" id="piTip"></div>
    </section>
    <section class="cp-section" id="ranking">
      <h2>The Ranking</h2>
      <div class="map-controls">
        <button type="button" class="filter-btn active" data-metric="100">Per 100 g</button>
        <button type="button" class="filter-btn" data-metric="can">Per local can</button>
        <button type="button" class="filter-btn" id="piLow" aria-pressed="false">Hide low-confidence *</button>
      </div>
      <p class="sb-muted" id="piMetricNote">USD per 100 g: the fair comparison, because can sizes run from 102 g to 195 g.</p>
      <div id="piBars">
        ${bars}
      </div>
    </section>
    <section class="cp-section" id="valuation">
      <h2>Over- or Undervalued? (Big Mac Index style)</h2>
      <p>If 100 g of Pringles should cost the same everywhere, how far is each currency from that &#8220;Pringles parity&#8221;? Red bars mean Pringles are pricier than in the US at today&#8217;s exchange rate, which by the Big Mac logic makes the currency look overvalued. Green bars mean cheaper, so the currency looks undervalued. Taxes, import duties and local competition matter at least as much, so treat this as a conversation starter, not a currency forecast.</p>
      <div id="piVal">
        ${vbars}
      </div>
    </section>
    <section class="cp-section" id="stories">
      <h2>What Stands Out</h2>
      <ul class="sb-list">
        <li><strong>Turkey:</strong> about ${(top.index_vs_us / 100).toFixed(1)}&#215; the US price per 100 g. Pringles are imported, and prices move fast with inflation.</li>
        <li><strong>Colombia</strong> ranks high largely because the peso has strengthened in 2026, a reminder of how much exchange rates drive any price index.</li>
        <li><strong>France and India</strong> are cheapest: France sells a 195 g can at a &#8364;1.89 regular price (taken from a promo leaflet&#8217;s &#8220;prix habituel&#8221;), and India&#8217;s figure is the legal maximum retail price.</li>
        <li><strong>United Kingdom:</strong> the regular price is &#163;2.50, but the same can is &#163;1.75 at Morrisons and Iceland and &#163;1.00 at Poundland. Promotions matter.</li>
        <li><strong>Germany:</strong> the can shrank from 185 g to 165 g in 2024 at the same &#8364;2.49 (Verbraucherzentrale Hamburg, per our source notes).</li>
      </ul>
      <p>Pringles are cheapest in France and India, but you don&#8217;t have to fly there for the flavours. Try an <a href="/best-international-chip-variety-packs/">international chip variety pack</a> at home.</p>
    </section>
    <section class="cp-section" id="method">
      <h2>Methodology</h2>
      <ol class="sb-list">
        <li>One standard can of Pringles Original at its regular supermarket shelf price (not a promotion), including VAT/GST where prices are shown with tax. <strong>US prices exclude sales tax.</strong></li>
        <li>Local price &#247; can weight &#215; 100 = local price per 100 g, converted to USD at the market rate.</li>
        <li>Index vs US = country USD/100 g &#247; US USD/100 g &#215; 100.</li>
        <li>Implied PPP rate = the rate that would make 100 g cost the same as in the US; valuation = implied rate &#247; actual rate &#8722; 1.</li>
      </ol>
      <p class="sb-muted">One retailer per country, one point in time: a snapshot, not a statistical average. FX: ${esc(M.fx_date)}. * Low confidence: a range, marketplace, undated or possibly promotional price. These are shown but can be hidden with the toggle.</p>
    </section>
    <section class="cp-section" id="sources">
      <h2>Prices &amp; Sources</h2>
      <div class="sb-table-wrap">
      <table class="sb-table">
        <thead><tr><th scope="col">Country</th><th scope="col">Retailer (source)</th><th scope="col">Local price</th><th scope="col">Can</th><th scope="col">USD / can</th><th scope="col">USD / 100 g</th><th scope="col">Index</th><th scope="col">Price date</th><th scope="col">Confidence</th><th scope="col">Notes</th></tr></thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
      </div>
      <p class="sb-sources">Not yet included: ${esc(fxPending.join(', '))} (price found, exchange rate still to be sourced); ${excluded.join('; ')}. Prices researched ${esc(M.retrieved)} by World of Chips. Raw data: <a href="/data/pringles_index_2026-10.csv">CSV</a> &#183; <a href="/data/pringles_index_2026-10.json">JSON</a>.</p>
    </section>
    <section class="cp-section" id="share">
      <h2>Share or Embed</h2>
      <p><a href="/assets/pringles-index-2026-10.png"><img src="/assets/pringles-index-2026-10.png" alt="Pringles Index ranking chart, ${esc(M.edition)}" width="600" height="702" loading="lazy" style="max-width:100%;height:auto;border-radius:12px;border:1px solid var(--light-border)"></a></p>
      <p>Journalists and bloggers are welcome to use the chart with a link back to this page. Embed code:</p>
      <pre style="white-space:pre-wrap;word-break:break-all;background:var(--paper);border:1px solid var(--light-border);border-radius:12px;padding:.8rem;font-size:.75rem">${esc(embed)}</pre>
    </section>`;
  const script = `(function(){
var D=${JSON.stringify(mapData)};
var bars=document.getElementById('piBars'),btns=document.querySelectorAll('[data-metric]'),low=document.getElementById('piLow'),note=document.getElementById('piMetricNote'),hide=false,metric='100';
function render(){var rows=[].slice.call(bars.children);rows.sort(function(a,b){return b.getAttribute('data-v'+metric)-a.getAttribute('data-v'+metric);});
rows.forEach(function(r){var f=r.querySelector('.bar-fill');f.style.width=f.getAttribute('data-w'+metric)+'%';f.textContent='$'+(+r.getAttribute('data-v'+metric)).toFixed(2);r.style.display=(hide&&r.getAttribute('data-low')==='1')?'none':'';bars.appendChild(r);});
[].forEach.call(document.querySelectorAll('#piVal .bar-row'),function(r){r.style.display=(hide&&r.getAttribute('data-low')==='1')?'none':'';});
note.textContent=metric==='100'?'USD per 100 g: the fair comparison, because can sizes run from 102 g to 195 g.':'USD per local can: cans differ in size (102 g to 195 g), so this ranking is not like-for-like.';}
[].forEach.call(btns,function(b){b.addEventListener('click',function(){metric=b.getAttribute('data-metric');[].forEach.call(btns,function(x){x.classList.toggle('active',x===b);});render();});});
low.addEventListener('click',function(){hide=!hide;low.classList.toggle('active',hide);low.setAttribute('aria-pressed',hide);render();});
if(!window.d3||!window.topojson)return;
var svg=d3.select('#piMap'),tip=document.getElementById('piTip'),proj=d3.geoNaturalEarth1().scale(170).translate([480,260]),gp=d3.geoPath(proj);
var color=d3.scaleLinear().domain([70,100,260]).range(['#4A8C5C','#F5ECD7','#D44B2C']).clamp(true);
fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json').then(function(r){return r.json();}).catch(function(){return fetch('https://unpkg.com/world-atlas@2/countries-110m.json').then(function(r){return r.json();});}).then(function(w){
var f=topojson.feature(w,w.objects.countries).features.filter(function(x){return x.id!=='010';});
svg.selectAll('path').data(f).enter().append('path').attr('d',gp).attr('stroke','#FFF8EC').attr('stroke-width',.4)
.attr('fill',function(x){var d=D[x.id];return d?color(d[5]):'#D4C4A0';})
.on('mousemove',function(e,x){var d=D[x.id];if(!d){tip.style.opacity=0;return;}tip.textContent=d[0]+': '+d[1]+' '+d[2]+' for '+d[3]+' g = $'+d[4].toFixed(2)+'/100 g (index '+Math.round(d[5])+'), '+d[6]+(d[7]==='low'?' (low confidence)':'');tip.style.left=(e.pageX+12)+'px';tip.style.top=(e.pageY-28)+'px';tip.style.opacity=1;tip.classList.add('visible');})
.on('mouseleave',function(){tip.style.opacity=0;tip.classList.remove('visible');});});
})();`;
  const dataset = { '@type': 'Dataset', name: `World of Chips Pringles Index ${M.edition}`, description: `Regular shelf price of a can of Pringles Original in ${C.length} countries, normalised to USD per 100 g, with a Big Mac Index-style currency valuation.`, url: 'https://worldofchips.com/pringles-index/', creator: { '@type': 'Organization', name: 'World of Chips' }, dateModified: M.retrieved, distribution: [{ '@type': 'DataDownload', encodingFormat: 'text/csv', contentUrl: 'https://worldofchips.com/data/pringles_index_2026-10.csv' }, { '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: 'https://worldofchips.com/data/pringles_index_2026-10.json' }] };
  return { slug: 'pringles-index', flag: '📊', crumb: 'Pringles Index', ...CK, disc: false,
    h1: `The Pringles Index (${M.edition})`,
    title: `The Pringles Index 2026: What a Can of Pringles Costs in ${C.length} Countries | World of Chips`,
    desc: `A Big Mac Index for chips: the regular price of Pringles Original in ${C.length} countries per 100 g in USD. ${top.country} is the priciest at ${(top.index_vs_us / 100).toFixed(1)}x the US; ${cheap.country} and France are the cheapest. Sources for every price.`,
    introDark: `What one can of Pringles Original costs in ${C.length} countries, in US dollars per 100 g.`,
    intro: 'Pringles are sold in almost the same can around the world, which makes them a handy, if crunchy, way to compare prices around the world. Like The Economist&#8217;s Big Mac Index, this is a light-hearted guide to price levels and exchange rates, not a precise measure. Every price below is linked to its source.',
    sections: [], body, scriptSrc: ['https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/topojson/3.0.2/topojson.min.js'], script, ogImage: '/assets/pringles-index-2026-10.png', ldExtra: [dataset],
    faqs: [
      [`Where are Pringles most expensive?`, `In this ${M.edition} edition, ${top.country}: $${top.usd_per_100g.toFixed(2)} per 100 g, about ${(top.index_vs_us / 100).toFixed(1)} times the US price of $${base.toFixed(2)} per 100 g.`],
      ['Where are Pringles cheapest?', `${cheap.country} and ${C[C.length - 2].country}, at about $${cheap.usd_per_100g.toFixed(2)} per 100 g. India&#8217;s figure is the legal maximum retail price, and France&#8217;s 195 g can sells at a €1.89 regular price.`],
      ['Why compare per 100 g instead of per can?', 'Pringles cans differ by market, from about 102 g in parts of Asia to 165 g in most of Europe and 195 g in France, so comparing whole cans would be misleading.'],
      ['How reliable is the Pringles Index?', 'It is one retailer per country at one point in time, a snapshot rather than an average. Low-confidence rows (ranges, marketplace or undated prices) are marked with an asterisk and can be hidden.'],
    ],
    sources: [], related: [['best-international-chip-variety-packs', '🌍 International variety packs'], ['flavors', '🌍 Chip flavours'], ['limited-edition-chips', '📅 Limited-edition drops']] };
}
