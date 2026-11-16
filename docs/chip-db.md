# Chip database schema

Records live in `data/chips/records.json` (the curated set), `data/chips/off.json` (the Open Food Facts import), and `data/chips/mfds-kr.json` (Korean nutrient rows). `data/chips/schema.json` is the shape. `node scripts/build_chip_db.mjs` (Node 16+, no npm) writes the public pages, `sitemap-chips.xml`, and the open-data files. It does not edit `sitemap.xml`, the nav, flavour pages, country guides, or anything under `/pringles-index/`. It leaves `/chips/_preview/aisle/` alone.

```sh
python3 scripts/import_off.py /path/to/en.openfoodfacts.org.products.csv.gz
node scripts/build_chip_db.mjs
node scripts/build_llms.mjs
python3 scripts/validate_site.py
```

## URLs

- `/chips/` search index, from `/chips/search-index.json`
- `/chips/<brand>/<product>/` one product
- `/brands/<brand>/` brand hub

Indexable product and brand URLs are listed in `sitemap-chips.xml`, not in `sitemap.xml`. `/chips/_preview/` stays disallowed in `robots.txt`. The aisle preview under `/chips/_preview/aisle/` is not part of this build.

`id` is the stable key. `brand_slug` + `slug` is the path. Neither is reused. A discontinued product stays in the file with `status: "discontinued"`. Do not delete it to free the slug.

## Fields

| Field | Rule |
|---|---|
| `id`, `slug`, `brand_slug` | Lowercase hyphen slugs. `id` never reused. |
| `title`, `description` | Our own wording. Title at most 65 characters, unique. |
| `barcodes` | Digits only, 8–14. Empty when we have no barcode. |
| `brand`, `parent_company` | Parent is null when no source names one. |
| `name_local`, `name_en` | Local is the name on the pack or in the source language. |
| `type` | `potato-chip`, `stacked`, `kettle`, `ridged`, `tortilla`. |
| `flavour_family` | One of the ten pages under `/flavors/`, or null. The slugs are `prawn-cocktail`, `ketchup`, `salt-and-vinegar`, `sour-cream-and-onion`, `paprika`, `nori-seaweed`, `bbq`, `dill-pickle`, `flamin-hot`, `cheese-and-onion`. |
| `heat_level` | The rung on `/spiciest-chips/` when this product is that rung, otherwise null. It is not a Scoville number. The map lives in `scripts/build_chip_db.mjs`. |
| `countries_sold` | `{country, source, checked}` for each country. `checked` is `YYYY-MM-DD`. |
| `equivalents` | Brand names as stated by the sources (Lay's / Walkers / Smith's / Sabritas, and the others a source names). The page says recipes may differ. This is not a claim that the recipes match. |
| `pack_sizes_g` | Grams per country, each with a source and date. No converted ounces unless the source already states the grams. |
| `price_per_100g` | Null, or `{country, amount, currency, source, checked}`. The source has to be a retailer. A Pringles Index URL is rejected. The preview leaves this null. |
| `status` | `current`, `limited`, `discontinued`, `unknown`. Unknown when the source does not say it is on shelf now. |
| `ingredients_text` | Verbatim, plus source and date. Null when we do not have a text. Not edited for spelling. |
| `image` | File key, pixel size, alt, licence, licence URL, credit, and a source page. Wikimedia files are `assets/photos/<file>-960.webp`, `-480.webp`, and `og-<file>.jpg`. Open Food Facts files are a local `<file>-480.webp` under CC BY-SA 3.0. |
| `where_to_buy` | Per country. Channels are `universal-yums` (US and Canada only), `daebak` (ships internationally; used for South Korea), `bol` (Netherlands and Belgium), and `amazon`. Amazon uses the existing guides tag `woc-guides-20`. Partner links render above the Amazon search. A box link is not a claim that the box contains the bag. |
| `sources` | `{field, url, checked}` for every non-trivial field, with an optional note. |

Pages also print: **Check the pack; recipes change.**

No dietary claim (vegan, halal, gluten-free, and the rest of the list in `scripts/validate_site.py`) unless a later record quotes a certification as "labelled as …" with a date. The ingredient quotation is excluded from that check because it is the source text.

## Completeness

The builder scores 0–100. Heat and price are not scored: null is the right value when they do not apply. Status is not scored.

| Field | Points |
|---|---:|
| English name | 10 |
| Local name | 8 |
| Brand | 8 |
| Parent company | 6 |
| At least one barcode | 8 |
| Type | 6 |
| Flavour family | 6 |
| At least one country, with source and date | 12 |
| At least one equivalent, with source and date | 10 |
| At least one pack size | 6 |
| Ingredient text, with source and date | 10 |
| Credited image | 6 |
| A where-to-buy row | 4 |

**Indexing rule, approved 16 November 2026.** A public product page is indexable only when completeness is **60 or more** and `ingredients_text` is present. Otherwise it is noindex. Both conditions are required. Sabritas American Brisket, Takis Fuego and Doritos Nacho Cheese score 60 and have no ingredient text, so their pages stay noindex. Korean nutrient rows have no ingredient text, so they stay noindex as well.

## Open data

`data/chips/export/chips.json`, `chips.csv` and `ATTRIBUTION.txt` are the derived database.

- **Database:** Open Database License 1.0 (https://opendatacommons.org/licenses/odbl/1-0/). Attribute Open Food Facts (https://world.openfoodfacts.org) and World of Chips. Share-alike applies to the database: a public reuse of the database stays under the ODbL.
- **Photographs:** not part of the database. Wikimedia files keep their own Commons licence (CC BY, CC BY-SA, CC0 or public domain). Open Food Facts photographs are CC BY-SA 3.0, resized to at most 480px, and stored as local WebP. BY and BY-SA need the credit on the page. BY-SA also means an adapted photograph stays under that licence.
- **Trademarks:** names and pack designs in the photographs belong to their owners. A photo licence is not a trademark licence.

`data/chips/mfds-kr.json` is a separate set. Those rows come from the Korean Ministry of Food and Drug Safety processed-food nutrient database (가공식품DB, file version 2026-09-29), checked at https://various.foodsafetykorea.go.kr/nutrient/general/down/list.do on 16 November 2026. The download states no licence. Each record has `source_licence` set to `unstated (government data, used with attribution)`. The builder previews them and leaves them out of `chips.json` and `chips.csv`. `validate_site.py` fails if one of those ids appears in either open file.

Regenerate the Ministry file from a name-filtered extract with `python3 scripts/import_mfds_kr.py path/to.csv`, then `node scripts/build_chip_db.mjs`.

## South Korea nutrient rows

The import keeps a row only when the name contains `감자칩`, `포테이토칩`, `포테토칩` or `감자스낵`, the subclass is `과자`, and the representative food is `스낵과자` or `일반과자`. It drops sweet potato, Jerusalem artichoke, and one schisandra snack whose nutrients are not a chip. The same name and manufacturer keep the later row. Nutrition is copied per 100 g and is not averaged or corrected.

`name_en` stays null. `brand` is set only when the manufacturer or importer string is itself the brand (`농심`, `오리온`, `해태가루비`, `KEOGHS`, `AMICA CHIPS`, `SAN NICASIO`, `PAPAS ARGENTE`, or Dieffenbach's). `parent_company` stays null. There is no barcode, ingredient list, pack size, price, or photograph. The page uses the placeholder image. Pages are published at `/chips/<brand>/<product>/` and stay noindex. They are not in `sitemap-chips.xml` or the country guides.

The ODbL and CC BY-SA obligations were accepted before this publish. The open download is linked from `/chips/`.

## What the builder will not do

- It will not write `/pringles-index/`, the Index JSON or CSV, or the Index share image. `validate_site.py` hashes those files.
- It will not add country guides, flavour links, or nav items. Those links, when wanted, go through the existing builders later.
- It will not invent a price, a barcode, an ingredient line, or a dietary claim.
