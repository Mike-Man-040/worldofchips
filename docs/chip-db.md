# Chip database schema

Phase 0 stores records in `data/chips/records.json` and validates their shape with `data/chips/schema.json`. `node scripts/build_chip_db.mjs` (Node 16+, no npm) writes the preview and the open-data files. It does not edit the sitemap, the nav, flavour pages, country guides, or anything under `/pringles-index/`.

```sh
node scripts/build_chip_db.mjs
python3 scripts/validate_site.py
```

`--publish` exits with an error. Publishing is not built yet.

## URLs

Approved public paths, not generated in this phase:

- `/chips/` search index
- `/chips/<brand>/<product>/` one product
- `/brands/<brand>/` brand hub

Phase 0 writes the same shape under `/chips/_preview/`, including brand hubs at `/chips/_preview/brands/<brand>/`. Every preview page is `noindex, nofollow`, omitted from `sitemap.xml` and from the nav, and disallowed in `robots.txt`.

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
| `equivalents` | The same product under another brand. A brand-name note (Lay's / Walkers / Smith's / Sabritas) is allowed when the source says that, and the note must say it is the brand, not a shared recipe, unless the source says otherwise. |
| `pack_sizes_g` | Grams per country, each with a source and date. No converted ounces unless the source already states the grams. |
| `price_per_100g` | Null, or `{country, amount, currency, source, checked}`. The source has to be a retailer. A Pringles Index URL is rejected. The preview leaves this null. |
| `status` | `current`, `limited`, `discontinued`, `unknown`. Unknown when the source does not say it is on shelf now. |
| `ingredients_text` | Verbatim, plus source and date. Null when we do not have a text. Not edited for spelling. |
| `image` | File key, pixel size, alt, licence, licence URL, credit, Commons file page. Files are `assets/photos/<file>-960.webp`, `-480.webp`, and `og-<file>.jpg`. |
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

**Proposed rule:** a public page with a score **below 60** stays noindex. A score of 60 meets the line. Three preview records (Sabritas American Brisket, Takis Fuego, Doritos Nacho Cheese) score 60 with no ingredient text, because that text was not in the potato-crisp slice. If ingredients should be required before a page is indexed, the threshold needs to be higher than 60, or the ingredient points need to rise. Phase 0 marks every preview page noindex regardless of score.

## Open data

`data/chips/export/chips.json`, `chips.csv` and `ATTRIBUTION.txt` are the derived database.

- **Database:** Open Database License 1.0 (https://opendatacommons.org/licenses/odbl/1-0/). Attribute Open Food Facts (https://world.openfoodfacts.org) and World of Chips. Share-alike applies to the database: a public reuse of the database stays under the ODbL.
- **Photographs:** not part of the database. Each file keeps its own Commons licence (CC BY, CC BY-SA, CC0 or public domain). BY and BY-SA need the credit on the page. BY-SA also means an adapted photograph stays under that licence.
- **Trademarks:** names and pack designs in the photographs belong to their owners. A photo licence is not a trademark licence.

These files are in the repository for review. They are not a publish decision. Michael needs to accept the ODbL and the photo terms before any of this is linked from the public site.

## What the builder will not do

- It will not write `/pringles-index/`, the Index JSON or CSV, or the Index share image. `validate_site.py` hashes those files.
- It will not add country guides, flavour links, or nav items. Those links, when wanted, go through the existing builders later.
- It will not invent a price, a barcode, an ingredient line, or a dietary claim.
