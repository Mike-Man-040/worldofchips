# World of Chips Pringles Index: build brief (edition 2026-10)

This brief goes with the dataset files. It explains what the data is, how the numbers were made, and how the page should present them.

## Files

| File | What it is |
|---|---|
| `pringles_index_2026-10.json` | Main data file for the page. Contains `meta`, `countries` (31 published markets), `backlog` (markets not ready to publish) and `fx_local_per_usd`. |
| `pringles_index_2026-10.csv` | The same 31 country rows as a flat table, for spreadsheets or a CMS import. |
| `build_index.py` | Script that produced both files. Edit a price or FX rate in it and rerun `python3 build_index.py` to regenerate everything. |

## What the index measures

The product is **one standard can of Pringles Original** as sold in a supermarket in each country, at its **regular shelf price** (not a promotion), including VAT/GST where the country shows prices with tax.

Pringles uses different can sizes by market: 165 g in most of Europe, 147 g in the US, 134 g in Australia and Mexico, 102 to 110 g across Asia, 195 g in France. Comparing cans directly would be misleading, so **the headline metric is USD per 100 g**.

### Method (Big Mac Index style)

1. Local price ÷ can weight × 100 = local price per 100 g.
2. Convert to USD at the market exchange rate = **USD per 100 g**.
3. **Index vs US** = country USD/100 g ÷ US USD/100 g × 100. The US is 100.
4. **Implied PPP rate** = the exchange rate that would make a 100 g of Pringles cost the same as in the US.
5. **Currency valuation %** = implied PPP rate ÷ actual rate − 1. Positive means Pringles are pricier than in the US at today's exchange rate (by the Big Mac logic, the currency looks overvalued). Negative means cheaper (looks undervalued).

Exchange rates: ECB euro reference rates of 26 Oct 2026, crossed through EUR/USD 1.1188. Rates the ECB does not publish came from national sources: Colombia TRM (26 Oct), Bank of Russia (23 Oct), Egyptian bank rate (23 Oct), and the fixed UAE dirham peg.

## Field definitions

| Field | Meaning |
|---|---|
| `rank_most_expensive` | 1 = highest USD per 100 g |
| `iso2`, `country`, `region` | Market. Use `iso2` to join to the existing country pages and the D3 map |
| `currency`, `local_price`, `pack_grams` | The raw observation |
| `local_price_per_100g` | Local currency per 100 g |
| `fx_local_per_usd` | Units of local currency per 1 USD |
| `usd_price_can` | Price of the local can in USD (different sizes, so not the ranking metric) |
| `usd_per_100g` | **Headline metric** |
| `usd_per_165g_equiv` | USD per 100 g × 1.65. Useful for a friendly "what a standard can costs" display |
| `index_vs_us` | US = 100 |
| `implied_ppp_rate`, `currency_valuation_pct` | Big Mac style outputs (see method) |
| `retailer`, `source_url` | Where the price came from. Link these in a sources table |
| `price_type` | `regular`, `mrp` (India's legal maximum retail price), `lowest_listed` (cheapest of several shops), `marketplace` (third-party seller), `estimate_midpoint` (published price range) |
| `price_observed` | Month the price applies to, or `unknown` |
| `confidence` | `high` = regular price on a major grocer's own page, current. `medium` = good source but aggregator, non-grocery chain, or slightly dated. `low` = range, marketplace, undated or possibly promotional |
| `notes` | Promo prices seen, alternative retailers, caveats |
| `retrieved` | Date the research was done (2026-10-27) |

## Headline results

US baseline: **$1.54 per 100 g** (a 147 g can at $2.27 in Walmart).

Most expensive per 100 g: Turkey $3.96, Hungary $3.65, Colombia $3.40, Russia $2.98, Australia $2.88.

Cheapest per 100 g: France $1.08, India $1.13, China $1.16, Indonesia $1.42, Canada $1.43.

Stories worth pulling out on the page:
- **Turkey costs about 2.6× the US.** Pringles are imported there and Turkish media treat them as a premium snack.
- **Colombia ranks third mainly because the peso has strengthened sharply** (the dollar is down roughly 15 to 18% against the peso in 2026). This shows how much exchange rates drive the index.
- **France is the cheapest in the set**, because its can is 195 g at a €1.89 regular price. Verify this in a French store page before using it as a headline.
- **The UK shows how promotions distort prices.** The regular price is £2.50, but the same can is £1.75 at Morrisons and Iceland and £1.00 at Poundland.
- **Germany: 2024 shrinkflation.** The can went from 185 g to 165 g at the same €2.49 (Hamburg consumer centre).

## Caveats to show on the page

- Single retailer per country, one point in time. This is a snapshot, not a statistical average.
- US prices exclude sales tax. Other countries include VAT.
- Exchange rates move daily. Note the FX date next to the chart.
- Low-confidence rows: Italy, Denmark, Poland, Japan, South Korea, China. Either show a "low confidence" marker or hide them behind a toggle.
- Japan is a midpoint of a published ¥200 to ¥280 range for the 105 g can (no recommended retail price exists there).

## Suggested page build

1. **Hero stat:** "A can of Pringles costs 2.6× more in Turkey than in the US," with the US baseline under it.
2. **Choropleth map:** reuse the existing D3 world map, coloured by `index_vs_us` (diverging scale centred on 100). Tooltip shows local price, can size, USD per 100 g, retailer.
3. **Ranked bar chart:** all 31 markets by `usd_per_100g`, US marked as the reference line.
4. **"Over/undervalued" chart:** `currency_valuation_pct` as a diverging bar chart, for the Big Mac Index angle.
5. **Toggle:** "per 100 g" vs "per can" so readers see why the size normalisation matters.
6. **Sources table:** country, retailer (linked `source_url`), price, size, date, confidence.
7. **Methodology section:** a short version of the method above.
8. **Country page links:** each row links to `/{country-slug}/`. 25 of the 31 markets already have a country guide on the site; Denmark, Switzerland, Czechia, Hungary, the Philippines and the UAE do not. Three site countries are not in the index yet: Argentina, Nigeria and Peru.
9. **Affiliate hook:** "Pringles are cheapest in France and India. Try international flavours at home" linking to the variety-pack guide.
10. **Share/embed:** a static PNG of the ranking for journalists and Reddit, plus an embed code. Backlinks are the main point of this page.

Use the regional `region` field if you want filters (Europe, Asia, Latin America, etc.).

## Backlog (in the JSON under `backlog`)

- **Price found, FX rate still needed:** Taiwan (NT$62 / 102 g), Chile (CLP 2,520 / 104 g), Pakistan (PKR 1,099 / 165 g), Kuwait (KWD 0.795 / 165 g), Oman (OMR 0.990 / 165 g). Add a rate in `build_index.py` and move them into `ROWS`.
- **Do not publish:** Nigeria (₦1,500 is a stale "last known price"), Belgium (April 2025).
- **No price found yet:** Argentina, Peru, Norway, Singapore (only multipacks).
- **Should be upgraded:** Sweden (Jula, not a grocer; try ICA, Coop or Willys), Poland (marketplace seller; try Frisco, Carrefour or Auchan), Italy (undated).

## Refresh process

Re-run quarterly or twice a year. Keep each edition as its own file (`pringles_index_YYYY-MM.json`) so the page can later show price changes and shrinkflation over time. That time series is a second story on its own.
