# worldofchips

Static site for https://worldofchips.com (served as plain files, no build step on the host).

## Country pages

Every country has a static, crawlable page at `/<slug>/` (e.g. `/japan/`, `/south-korea/`).
These are **generated** from the country data that lives in the inline `<script>` of `index.html`
(`countryData`, `brandUrls`, `countryContent`, and the shop picks `csm`).

After editing country data in `index.html`, regenerate and commit:

```sh
node scripts/build_country_pages.mjs            # lastmod = today
node scripts/build_country_pages.mjs --lastmod 2026-10-17
python3 scripts/validate_site.py                # HTML/JSON-LD/JS/link + news checks
```

The build writes `/<slug>/index.html`, `assets/site.css` (copied from index.html's `<style>`),
`sitemap.xml`, and the `BUILD:*` marker regions in `index.html`. Do not edit those by hand.
No npm install is needed (Node 16+, Python 3 stdlib).

## Chip news (weekly update)

The homepage `#news` grid (latest 6 stories), the `/news/` archive page and the `/news/` entry in
`sitemap.xml` are **generated** from `data/news.json`. Do not edit those by hand.

Each story in `data/news.json` (an array; order doesn't matter, the build sorts newest first):

| field | notes |
| --- | --- |
| `id` | unique lowercase-hyphen slug, e.g. `calbee-norishio-50th-anniversary-renewal` (also the card's `#anchor` on `/news/`) |
| `date` | `YYYY-MM-DD`, the date the source published/announced it |
| `title` | our own headline (≤ 110 chars) |
| `summary` | 40–80 words in **our own words** – never copy the source's text |
| `category` | one of `Industry`, `New Flavor`, `Safety Recall`, `Innovation`, `Sustainability`, `Investment`, `Regional` |
| `country` | optional country-page slug (e.g. `japan`, `united-kingdom`) – adds a link to that guide |
| `source_name` / `source_url` | the credible page you verified the story on (company release, regulator, trade/news outlet) |

Weekly workflow:

```sh
# 1. add new stories to data/news.json (keep old ones; they stay in the /news/ archive)
node scripts/build_news.mjs          # regenerates index.html #news, news/index.html, sitemap /news/ lastmod
python3 scripts/validate_site.py     # field checks + "generated files in sync" check
git add -A && git commit -m "News: week of YYYY-MM-DD"
```

The build is deterministic (no timestamps), so re-running it without data changes produces no diff;
`node scripts/build_news.mjs --check` exits non-zero if the generated files are stale.
`scripts/build_country_pages.mjs` keeps the `/news/` sitemap entry too, so the two builds can run in any order.
