# Chip database feasibility

Checked 16 November 2026. Counts are from one download of the Open Food Facts nightly product CSV, not from per-product API calls.

- File: `en.openfoodfacts.org.products.csv.gz`
- URL: https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv.gz
- HTTP `Last-Modified`: Mon, 16 Nov 2026 10:13:19 GMT
- Size: 1,537,068,803 bytes
- Rows in the file: 4,916,182

A row is a **potato crisp** when `categories_tags` contains the tag `en:potato-crisps`. A row is **usable** when it has all four of: a non-empty `product_name`, a non-empty `brands`, an image (`image_url` or `image_small_url`), and a non-empty `ingredients_text`. A product is counted in a country when `countries_tags` contains that country's tag (`en:united-states`, `en:united-kingdom`, `en:japan`, `en:south-korea`, `en:netherlands`, `en:mexico`). A product can sit in more than one country. No alias tag (`en:uk`, `en:usa`, `en:holland`, and the others tried) appeared without the canonical tag.

## Is it about 6,800?

The export does not contain a published total of 6,800. Two counts came out of the same file:

| Definition | Products |
|---|---:|
| `categories_tags` contains `en:potato-crisps` | 11,719 |
| `main_category` is `en:potato-crisps` | 6,617 |
| Usable, among the 11,719 | 6,730 |
| Usable, among the 6,617 whose main category is potato crisps | 2,873 |

6,617 is close to 6,800 and is the count of products whose **main** category is potato crisps. It is not an exact confirmation of 6,800. The wider tag (11,719) includes 5,102 products that carry `en:potato-crisps` but have a different main category.

## Pilot countries

"Tagged" uses the wide tag. "Usable" is the four-field test on those rows. "Main" is `main_category` = `en:potato-crisps`.

| Country | Tagged | Usable | Usable share | Main category | Main and usable |
|---|---:|---:|---:|---:|---:|
| United States | 1,740 | 985 | 56.6% | 1,529 | 804 |
| United Kingdom | 876 | 620 | 70.8% | 452 | 269 |
| Netherlands | 221 | 171 | 77.4% | 82 | 51 |
| Mexico | 60 | 53 | 88.3% | 27 | 23 |
| Japan | 49 | 32 | 65.3% | 36 | 22 |
| South Korea | 2 | 1 | 50% | 2 | 1 |

The United States, the United Kingdom and the Netherlands have enough usable rows to draft from. Mexico is small but mostly complete when a row exists. Japan is thin. South Korea is not usable as a source: two tagged rows, one of them passing the four-field test, and that row is an Orion product whose ingredient text starts with cornmeal.

## Data-quality issues

- **Ingredients are the hole.** Of the 11,719 tagged rows, 4,211 have no ingredient text. Names are missing on 355, brands on 1,627, images on 449.
- **Ingredient text is often a scan of the pack.** Several rows mix in marketing lines, allergy advice, or a broken first line. The median length of a non-empty ingredient field is 214 characters. 25 fields are shorter than 12 characters. The preview quotes the field as stored and does not correct it.
- **Names are generic.** Large groups are "Lay's" with an empty or generic name ("chips", "lays"), not a flavour.
- **Other categories share the tag.** Also tagged potato crisps: corn chips 40, crackers 33, prawn crackers 22, popcorn 4.
- **Country tags are contributor claims.** 1,453 tagged rows list more than one country. 38 list none. A barcode's country tag is where someone entered it, not a proof of the current range. The Haitai Honey Butter barcode in the preview is tagged United States; South Korea comes from the Wikipedia article, not from that tag.
- **Ownership fields go stale.** The Pringles Original barcode still has `brand_owner` "The Kellogg Company" (row last modified 3 Sep 2026). The Wikipedia article checked the same day says the brand was sold in 2012 to Kellanova and that Mars bought Kellanova in 2024. Both are shown. No Pringles Index number is used.
- **Japan and Korea need sources other than this export** before a public page is worth indexing. Wikimedia photographs and maker or Wikipedia pages covered the preview rows that the export could not.

## Duplicates and variants

There are no repeated barcodes in the potato-crisp slice (0 duplicate codes, 0 blank codes).

Rows with a name and a brand were grouped by a normalised brand plus name: lower case, punctuation removed, and a trailing weight such as `45 g` stripped. That produced:

- 8,589 groups
- 721 groups with more than one barcode (2,016 barcodes)
- 338 of those groups also have more than one quantity string (1,161 barcodes). These look like pack-size variants, mixed with generic names.
- 383 groups share a name and have the same quantity or a blank one (855 barcodes). These look more like duplicate entries than size variants.

This is an upper bound. The biggest groups are bad names ("Lay's" plus nothing, or "chips"), not confirmed twins of one recipe. A later import should group on barcode first, then on a cleaned flavour name, and should keep pack size as its own field rather than as a new product.

## What this means for a first public set

A page that only mirrors a usable Open Food Facts row can be drafted for the US, the UK and the Netherlands. Japan, South Korea and a lot of Mexico will need a photograph and a source outside this export, which is what the ten preview records do. The export is a starting file, not a catalogue of what is on shelf today.
