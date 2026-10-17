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
python3 scripts/validate_site.py                # HTML/JSON-LD/JS/link checks
```

The build writes `/<slug>/index.html`, `assets/site.css` (copied from index.html's `<style>`),
`sitemap.xml`, and the `BUILD:*` marker regions in `index.html`. Do not edit those by hand.
No npm install is needed (Node 16+, Python 3 stdlib).
