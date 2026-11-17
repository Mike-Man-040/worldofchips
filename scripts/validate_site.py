#!/usr/bin/env python3
"""Sanity-check the generated site (stdlib only; needs `node` on PATH for JS syntax checks).

Usage: python3 scripts/validate_site.py
"""
import re as _re
import datetime, glob, html, json, os, re, subprocess, sys, tempfile, xml.etree.ElementTree as ET
from html.parser import HTMLParser
# Allowed Amazon tracking IDs: read from scripts/affiliate_tags.mjs (single source of truth).
AMAZON_TAGS = set(_re.findall(r"'((?:worldofchips|woc-[a-z]+)-20)'", open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'affiliate_tags.mjs')).read()))

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://worldofchips.com"
NEWS_CATEGORIES = {"Industry", "New Flavor", "Safety Recall", "Innovation", "Sustainability", "Investment", "Regional"}
NEWS_FIELDS = ("id", "date", "title", "summary", "category", "source_name", "source_url")
# Pages whose daebak.co links must use our referral (sca_ref) link.
DAEBAK_PAGES = {"south-korea", "best-korean-chips-to-buy-online", "snack-boxes", "christmas-chip-gifts-2026", "christmas-snack-box-comparison-2026"}
AFFILIATE_BRANDS = {"bokksu", "tokyotreat", "sakuraco", "japancrate", "daebak", "japancandystore", "universalyums", "mexicrate", "snackcrate", "bol"}
VOID = {"area","base","br","col","embed","hr","img","input","link","meta","source","track","wbr"}


class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack, self.errors, self.scripts, self.links = [], [], [], []
        self.title, self.canonical, self.desc, self._in_title = "", None, None, False
        self._script = None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag not in VOID:
            self.stack.append(tag)
        if tag == "title":
            self._in_title = True
        if tag == "script" and "src" not in a:
            self._script = [a.get("type", "text/javascript"), ""]
        if tag == "link" and a.get("rel") == "canonical":
            self.canonical = a.get("href")
        if tag == "meta" and a.get("name") == "description":
            self.desc = a.get("content")
        if tag == "a":
            self.links.append(a)

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        if not self.stack or self.stack[-1] != tag:
            self.errors.append(f"unbalanced </{tag}> at {self.getpos()} (open: {self.stack[-3:]})")
            if tag in self.stack:
                while self.stack and self.stack.pop() != tag:
                    pass
            return
        self.stack.pop()
        if tag == "title":
            self._in_title = False
        if tag == "script" and self._script:
            self.scripts.append(tuple(self._script))
            self._script = None

    def handle_data(self, data):
        if self._in_title:
            self.title += data
        if self._script is not None:
            self._script[1] += data


def check_newsletter(rel, html, problems, form_ids):
    """Every page carries the MailerLite universal loader (in <head>) and exactly one empty embed div."""
    head = html.split("</head>", 1)[0]
    if head.count("https://assets.mailerlite.com/js/universal.js") != 1 or not re.search(r"ml\('account', '\d+'\)", head):
        problems.append(f"{rel}: MailerLite universal snippet missing from <head> (or duplicated)")
    embeds = re.findall(r'<div class="ml-embedded" data-form="([A-Za-z0-9]+)"></div>', html)
    n = html.count('class="ml-embedded"')
    if len(embeds) != 1 or n != 1:
        problems.append(f"{rel}: expected exactly one empty ml-embedded div with a data-form, found {n} ml-embedded div(s), {len(embeds)} valid")
    form_ids.update(embeds)


def check(path, problems, form_ids=None):
    html = open(path, encoding="utf-8").read()
    if form_ids is not None:
        check_newsletter(os.path.relpath(path, ROOT), html, problems, form_ids)
    p = Page()
    p.feed(html)
    p.close()
    rel = os.path.relpath(path, ROOT)
    problems += [f"{rel}: {e}" for e in p.errors]
    if p.stack:
        problems.append(f"{rel}: unclosed tags {p.stack}")
    if "amzn.to" in html:
        problems.append(f"{rel}: amzn.to shortlinks are not allowed; use canonical amazon.com URLs with tag=worldofchips-20")
    if "wordofchipspr" in html:
        problems.append(f"{rel}: legacy affiliate tag found; use tag=worldofchips-20")
    for u in re.findall(r"https?://(?:www\.)?amazon\.com[^\s\"'<>]*", html):
        if "tag=" not in u or not any(f"tag={t}" in u for t in AMAZON_TAGS):
            problems.append(f"{rel}: amazon.com URL without affiliate tag: {u}")
    for typ, body in p.scripts:
        if typ == "application/ld+json":
            try:
                json.loads(body)
            except ValueError as e:
                problems.append(f"{rel}: bad JSON-LD: {e}")
        else:
            for pat in ('href="/${', 'href="\'+', 'href="/\'+'):
                if pat in body:
                    problems.append(f"{rel}: script contains literal {pat} (crawlers extract it as a URL); build links via the DOM")
            with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False) as f:
                f.write(body)
            r = subprocess.run(["node", "--check", f.name], capture_output=True, text=True)
            os.unlink(f.name)
            if r.returncode:
                problems.append(f"{rel}: JS syntax error: {r.stderr.strip()[:300]}")
    for a in p.links:
        href = a.get("href", "")
        rels = set((a.get("rel") or "").split())
        if "amzn.to" in href:
            problems.append(f"{rel}: amzn.to shortlink not allowed: {href}")
        if "amazon." in href:
            if a.get("target") != "_blank" or not {"sponsored", "noopener"} <= rels:
                problems.append(f"{rel}: affiliate link missing target/rel: {href}")
            if "amazon.com" in href and ("tag=" not in href or not any(f"tag={t}" in href for t in AMAZON_TAGS)):
                problems.append(f"{rel}: amazon link without affiliate tag: {href}")
        if "awin1.com" in href:
            # Awin affiliate links (Universal Yums): must be sponsored, nofollow, noopener, new tab.
            if a.get("target") != "_blank" or not {"sponsored", "nofollow", "noopener"} <= rels:
                problems.append(f"{rel}: awin affiliate link missing target/rel sponsored nofollow noopener: {href}")
            if "awinaffid=3136222" not in href:
                problems.append(f"{rel}: awin link with unexpected publisher id: {href}")
        if "daebak.co" in href and "sca_ref=" in href:
            # Daebak referral links: must carry our sca_ref, be sponsored, nofollow, noopener, new tab.
            if a.get("target") != "_blank" or not {"sponsored", "nofollow", "noopener"} <= rels:
                problems.append(f"{rel}: daebak affiliate link missing target/rel sponsored nofollow noopener: {href}")
            if "sca_ref=12575992." not in href:
                problems.append(f"{rel}: daebak link with unexpected sca_ref: {href}")
        if rel.split("/")[0] in DAEBAK_PAGES and a.get("data-affiliate") == "daebak" and "sca_ref=12575992." not in href:
            problems.append(f"{rel}: daebak affiliate link missing sca_ref param: {href}")
        if "partner.bol.com" in href:
            # bol.com affiliate deeplinks (NL/BE): site id 1555738, search URLs only, sponsored nofollow.
            if a.get("target") != "_blank" or not {"sponsored", "nofollow", "noopener"} <= rels:
                problems.append(f"{rel}: bol affiliate link missing target/rel sponsored nofollow noopener: {href}")
            if not href.startswith("https://partner.bol.com/click/click?p=2&t=url&s=1555738&f=TXL&url=https%3A%2F%2Fwww.bol.com%2F"):
                problems.append(f"{rel}: bol link with unexpected format or site id: {href}")
        if "data-affiliate" in a:
            # Swappable brand links (e.g. /snack-boxes/): known brand, external, never followed.
            if a.get("data-affiliate") not in AFFILIATE_BRANDS:
                problems.append(f"{rel}: unknown data-affiliate={a.get('data-affiliate')!r} on {href}")
            if not href.startswith("https://") or not {"nofollow", "noopener"} <= rels or a.get("target") != "_blank":
                problems.append(f"{rel}: data-affiliate link needs https, target=_blank, rel nofollow+noopener: {href}")
        if a.get("target") == "_blank" and "noopener" not in (a.get("rel") or "").split():
            problems.append(f"{rel}: target=_blank link without rel=noopener: {href}")
        if href.startswith("/") and not href.startswith("//"):
            target = href.split("#")[0].split("?")[0]
            if target and target != "/" and not os.path.exists(os.path.join(ROOT, target.strip("/"), "index.html")) and not os.path.isfile(os.path.join(ROOT, target.strip("/"))):
                problems.append(f"{rel}: broken internal link {href}")
    return p


def check_news(problems, sitemap_root, ns):
    """Validate data/news.json and that the generated news output is in sync with it."""
    path = os.path.join(ROOT, "data", "news.json")
    try:
        stories = json.load(open(path, encoding="utf-8"))
    except (OSError, ValueError) as e:
        problems.append(f"data/news.json: cannot load: {e}")
        return 0
    if not isinstance(stories, list) or not stories:
        problems.append("data/news.json: must be a non-empty JSON array")
        return 0
    seen_ids, seen_urls = set(), set()
    latest_allowed = datetime.date.today() + datetime.timedelta(days=1)
    for i, s in enumerate(stories):
        sid = s.get("id", f"#{i}") if isinstance(s, dict) else f"#{i}"
        where = f"data/news.json [{sid}]"
        if not isinstance(s, dict):
            problems.append(f"{where}: not an object")
            continue
        for k in NEWS_FIELDS:
            if not isinstance(s.get(k), str) or not s[k].strip():
                problems.append(f"{where}: missing/empty '{k}'")
        unknown = set(s) - set(NEWS_FIELDS) - {"country"}
        if unknown:
            problems.append(f"{where}: unknown fields {sorted(unknown)}")
        if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", s.get("id", "")):
            problems.append(f"{where}: id must be a lowercase-hyphen slug")
        if s.get("id") in seen_ids:
            problems.append(f"{where}: duplicate id")
        seen_ids.add(s.get("id"))
        try:
            d = datetime.date.fromisoformat(s.get("date", ""))
            if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", s["date"]):
                raise ValueError
            if d > latest_allowed:
                problems.append(f"{where}: date {d} is in the future")
        except (ValueError, TypeError):
            problems.append(f"{where}: date must be a real YYYY-MM-DD date")
        words = len(str(s.get("summary", "")).split())
        if not 40 <= words <= 80:
            problems.append(f"{where}: summary has {words} words (want 40-80, original wording)")
        if len(str(s.get("title", ""))) > 110:
            problems.append(f"{where}: title longer than 110 characters")
        if s.get("category") not in NEWS_CATEGORIES:
            problems.append(f"{where}: category must be one of {sorted(NEWS_CATEGORIES)}")
        c = s.get("country")
        if c is not None and not (isinstance(c, str) and os.path.exists(os.path.join(ROOT, c, "index.html"))):
            problems.append(f"{where}: country '{c}' is not an existing country page slug")
        u = str(s.get("source_url", ""))
        if not re.match(r"https?://[^\s/]+\.[^\s/]+", u) or "worldofchips.com" in u:
            problems.append(f"{where}: source_url must be an absolute external URL")
        if u in seen_urls:
            problems.append(f"{where}: duplicate source_url")
        seen_urls.add(u)
    # Generated files in sync with the data?
    r = subprocess.run(["node", os.path.join(ROOT, "scripts", "build_news.mjs"), "--check"], capture_output=True, text=True)
    if r.returncode:
        problems.append((r.stderr or r.stdout).strip()[:300])
    # Sitemap lastmod for /news/ = newest story date
    dates = sorted(s.get("date", "") for s in stories if isinstance(s, dict))
    for u in sitemap_root.findall("s:url", ns):
        if u.findtext("s:loc", namespaces=ns) == f"{SITE}/news/":
            if u.findtext("s:lastmod", namespaces=ns) != dates[-1]:
                problems.append(f"sitemap: /news/ lastmod should be {dates[-1]}")
    return len(stories)


def check_snack_boxes(problems, pages):
    """The /snack-boxes/ page is generated by build_snack_boxes.mjs; check it is in sync and complete."""
    path = os.path.join(ROOT, "snack-boxes", "index.html")
    if path not in pages:
        problems.append("snack-boxes/index.html is missing")
        return
    r = subprocess.run(["node", os.path.join(ROOT, "scripts", "build_snack_boxes.mjs"), "--check"], capture_output=True, text=True)
    if r.returncode:
        problems.append((r.stderr or r.stdout).strip()[:300])
    p = pages[path]
    seen = {a.get("data-affiliate") for a in p.links if "data-affiliate" in a}
    missing = (AFFILIATE_BRANDS - {"mexicrate", "snackcrate"}) - seen  # those two only appear on /christmas-snack-box-comparison-2026/
    if missing:
        problems.append(f"snack-boxes: no data-affiliate link for {sorted(missing)}")
    types = set()
    for typ, body in p.scripts:
        if typ == "application/ld+json":
            try:
                for node in json.loads(body).get("@graph", []):
                    types.add(node.get("@type"))
            except (ValueError, AttributeError):
                pass
    if "FAQPage" not in types:
        problems.append("snack-boxes: missing FAQPage JSON-LD")
    for slug in ("japan", "south-korea"):
        pg = pages.get(os.path.join(ROOT, slug, "index.html"))
        if pg and not any(a.get("href") == "/snack-boxes/" for a in pg.links):
            problems.append(f"{slug}: no link to /snack-boxes/")
    home = pages.get(os.path.join(ROOT, "index.html"))
    if home and not any(a.get("href") == "/snack-boxes/" for a in home.links):
        problems.append("index.html: no link to /snack-boxes/")


def check_photos(problems, pages):
    """Photos: local licensed files only (no Amazon/retailer image hosts), alt text, lazy loading below the fold,
    a credit caption, and titles of about 60 characters. /pringles-index/ is frozen and skipped."""
    for path, p in pages.items():
        rel = os.path.relpath(path, ROOT)
        if rel.startswith("pringles-index"):
            continue
        h = open(path, encoding="utf-8").read()
        if re.search(r'<img[^>]+src="https?://[^"]*(media-amazon|images-amazon|ssl-images-amazon|bol\.com|walmartimages|target\.scene7)', h):
            problems.append(f"{rel}: retailer-hosted product image")
        for img in re.findall(r"<img\b[^>]*>", h):
            if 'alt="' not in img or 'alt=""' in img:
                problems.append(f"{rel}: <img> without alt text")
            m = re.search(r'src="(/assets/photos/[^"]+)"', img)
            if m and not os.path.isfile(os.path.join(ROOT, m.group(1).lstrip("/"))):
                problems.append(f"{rel}: missing photo file {m.group(1)}")
        for fig in re.findall(r'<figure class="woc-photo">.*?</figure>', h, re.S):
            if "commons.wikimedia.org" not in fig or "<figcaption>" not in fig:
                problems.append(f"{rel}: photo without a Wikimedia Commons credit caption")
        title = html.unescape(p.title.strip())
        if len(title) > 65:
            problems.append(f"{rel}: <title> is {len(title)} characters (keep to about 60)")


def check_ai_search(problems, pages):
    """llms.txt / llms-full.txt, IndexNow key, AI crawler robots rules, country FAQPage JSON-LD."""
    for f in ("llms.txt", "llms-full.txt"):
        if not os.path.isfile(os.path.join(ROOT, f)):
            problems.append(f"{f} is missing")
    r = subprocess.run(["node", os.path.join(ROOT, "scripts", "build_llms.mjs"), "--check"], capture_output=True, text=True)
    if r.returncode:
        problems.append((r.stderr or r.stdout).strip()[:300])
    if os.path.isfile(os.path.join(ROOT, "llms.txt")):
        txt = open(os.path.join(ROOT, "llms.txt"), encoding="utf-8").read()
        if not txt.startswith("# "):
            problems.append("llms.txt must start with an H1")
        for path in pages:
            if os.path.dirname(path) != ROOT:
                url = f"{SITE}/{os.path.relpath(os.path.dirname(path), ROOT).replace(os.sep, '/')}/"
                if f"({url})" not in txt:
                    problems.append(f"llms.txt does not link {url}")
    keys = [f for f in os.listdir(ROOT) if re.fullmatch(r"[0-9a-f]{32}\.txt", f)]
    if len(keys) != 1:
        problems.append(f"expected exactly one IndexNow key file, found {keys}")
    elif open(os.path.join(ROOT, keys[0])).read().strip() != keys[0][:-4]:
        problems.append(f"{keys[0]} does not contain its own key")
    robots = open(os.path.join(ROOT, "robots.txt")).read()
    for bot in ("OAI-SearchBot", "GPTBot", "ChatGPT-User", "PerplexityBot", "Perplexity-User", "ClaudeBot",
                "Claude-SearchBot", "Claude-User", "Google-Extended", "Bingbot", "Applebot-Extended"):
        if not re.search(rf"User-agent: {re.escape(bot)}\nAllow: /\n", robots):
            problems.append(f"robots.txt: no 'Allow: /' for {bot}")
    if "Disallow: /cdn-cgi/" not in robots:
        problems.append("robots.txt: missing Disallow: /cdn-cgi/")
    if not os.path.isfile(os.path.join(ROOT, "favicon.ico")):
        problems.append("favicon.ico is missing")
    for path in pages:
        if '<link rel="icon" href="/favicon.ico"' not in open(path, encoding="utf-8").read():
            problems.append(f"{os.path.relpath(path, ROOT)}: no favicon <link>")
    if f"Sitemap: {SITE}/sitemap.xml" not in robots:
        problems.append("robots.txt: missing Sitemap line")
    for path, p in pages.items():
        html = open(path, encoding="utf-8").read()
        if 'class="cp-facts"' not in html:
            continue  # only country pages carry Quick Facts
        slug = os.path.basename(os.path.dirname(path))
        faq = None
        for typ, body in p.scripts:
            if typ == "application/ld+json":
                try:
                    for node in json.loads(body).get("@graph", []):
                        if node.get("@type") == "FAQPage":
                            faq = node
                except (ValueError, AttributeError) as e:
                    problems.append(f"{slug}: JSON-LD does not parse: {e}")
        if not faq or not faq.get("mainEntity"):
            problems.append(f"{slug}: missing FAQPage JSON-LD")
            continue
        for q in faq["mainEntity"]:
            if q.get("name") and html.count(">" + q["name"].replace("&", "&amp;").replace("'", "&#x27;") + "<") == 0 and q["name"].split("?")[0][:30] not in html.replace("&#x27;", "'"):
                problems.append(f"{slug}: FAQ question not visible on page: {q['name']}")


# Frozen Pringles Index files. A deliberate Index edit has to update these hashes in the same change.
PRINGLES_SHA256 = {
    "pringles-index/index.html": "0a95d6733ea046c222a348f8adcaf60fb6de61ab3b2aaa7376f31a64302d9427",
    "data/pringles_index_2026-10.json": "0f40693d8f8122400b5d2728cb44890eeb6504b29a7bf372cdefb92b34f07dd0",
    "data/pringles_index_2026-10.csv": "50d080aad9a5f74b003d263deb7e18de2bf506270d5f2eb0e2faa1d16fc95916",
    "assets/og/pringles-index.png": "6c7b2e0c0f05d3004b23647643b707db4f7b13b2e47e40fb743da1c25c094970",
    "assets/pringles-index-2026-10.png": "c784739fa8c6bc0ecf06814ea490a7e1b3eabee77193611a4e4e0eaf0bf82194",
}
DIETARY_RE = re.compile(r"(?i)\b(vegan|vegetarians?|halal|kosher|gluten[\s-]?free|dairy[\s-]?free|lactose[\s-]?free|nut[\s-]?free|sugar[\s-]?free|fat[\s-]?free|non[\s-]?gmo|organic|keto|paleo)\b")
CHIP_PREVIEW = os.path.join("chips", "_preview")


def is_chip_preview(path):
    rel = os.path.relpath(path, ROOT)
    return rel == os.path.join(CHIP_PREVIEW, "index.html") or rel.startswith(CHIP_PREVIEW + os.sep)


def is_chip_page(path):
    """Published chip database pages, brand hubs, and the preview tree. They use sitemap-chips.xml."""
    if is_chip_preview(path):
        return True
    rel = os.path.relpath(path, ROOT)
    top = rel.split(os.sep, 1)[0]
    return top in ("chips", "brands")


def check_pringles_untouched(problems):
    import hashlib
    for rel, want in PRINGLES_SHA256.items():
        p = os.path.join(ROOT, rel)
        if not os.path.isfile(p):
            problems.append(f"pringles-index: missing frozen file {rel}")
            continue
        got = hashlib.sha256(open(p, "rb").read()).hexdigest()
        if got != want:
            problems.append(f"pringles-index: {rel} changed (sha256 {got[:12]}). The Index stays untouched.")


def check_chip_db(problems):
    """Published chip pages: sourced, credited, no unquoted dietary claims, valid affiliate tags.
    A product page is eligible at completeness >= 60 with ingredients and indexed only when it is also in
    release wave 1 (wave_1). A brand hub is indexed only with 3+ indexed products. Korean rows stay noindex
    and out of the ODbL export. Indexable URLs live in sitemap-chips.xml, not sitemap.xml."""
    r = subprocess.run(["node", os.path.join(ROOT, "scripts", "build_chip_db.mjs"), "--check"], capture_output=True, text=True)
    if r.returncode:
        problems.append((r.stderr or r.stdout).strip()[:400])
    preview_root = os.path.join(ROOT, CHIP_PREVIEW)
    aisle = os.path.join(preview_root, "aisle")
    if os.path.isdir(preview_root):
        for path in glob.glob(os.path.join(preview_root, "**", "index.html"), recursive=True):
            if os.path.commonpath([os.path.abspath(path), aisle]) == aisle:
                continue
            problems.append(f"chip-db: preview page should have moved out of /chips/_preview/: {os.path.relpath(path, ROOT)}")
    home = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()
    nav = home.split("<!-- SITE-NAV:START", 1)[1].split("<!-- SITE-NAV:END -->", 1)[0]
    if "/chips/_preview" in nav:
        problems.append("chip-db: site nav links to the chip preview")
    primary = nav.split('<details class="nav-more">', 1)[0]
    if 'href="/chips/"' in primary:
        problems.append("chip-db: /chips/ belongs under More, not in the main nav")
    more = nav.split('<details class="nav-more">', 1)[1].split('</details>', 1)[0] if '<details class="nav-more">' in nav else ''
    mobile = nav.split('<details class="nav-mobile">', 1)[1] if '<details class="nav-mobile">' in nav else ''
    if 'href="/chips/">Chip database</a>' not in more or 'href="/chips/">Chip database</a>' not in mobile:
        problems.append("chip-db: More menu and the mobile menu must link /chips/ as Chip database")
    sm = open(os.path.join(ROOT, "sitemap.xml"), encoding="utf-8").read()
    if "/chips/" in sm or "/brands/" in sm:
        problems.append("chip-db: sitemap.xml must not list /chips/ or /brands/ URLs")
    robots = open(os.path.join(ROOT, "robots.txt"), encoding="utf-8").read()
    if "Disallow: /chips/_preview/" not in robots:
        problems.append("chip-db: robots.txt does not disallow /chips/_preview/")
    if f"Sitemap: {SITE}/sitemap-chips.xml" not in robots:
        problems.append("chip-db: robots.txt does not list sitemap-chips.xml")
    export = os.path.join(ROOT, "data", "chips", "export", "chips.json")
    off_path = os.path.join(ROOT, "data", "chips", "off.json")
    mfds_path = os.path.join(ROOT, "data", "chips", "mfds-kr.json")
    for required in (export, off_path, mfds_path, os.path.join(ROOT, "sitemap-chips.xml"), os.path.join(ROOT, "chips", "index.html"), os.path.join(ROOT, "chips", "search-index.json")):
        if not os.path.isfile(required):
            problems.append(f"chip-db: missing {os.path.relpath(required, ROOT)}")
            return
    blob = open(export, encoding="utf-8").read()
    if "ODbL" not in blob or "Open Food Facts" not in blob:
        problems.append("chip-db: export is missing the ODbL / Open Food Facts attribution")
    try:
        data = json.loads(blob)
        off = json.load(open(off_path, encoding="utf-8"))
        base = json.load(open(os.path.join(ROOT, "data", "chips", "records.json"), encoding="utf-8"))
        mfds = json.load(open(mfds_path, encoding="utf-8"))
        search = json.load(open(os.path.join(ROOT, "chips", "search-index.json"), encoding="utf-8"))
    except ValueError as e:
        problems.append(f"chip-db: JSON does not parse: {e}")
        return
    if data.get("preview") is not False or data.get("index_min") != 60:
        problems.append("chip-db: export must be the published database and keep index_min 60")
    unstated = "unstated (government data, used with attribution)"
    if unstated in blob or unstated in open(os.path.join(ROOT, "data", "chips", "export", "chips.csv"), encoding="utf-8").read():
        problems.append("chip-db: ODbL JSON or CSV contains a record marked with an unstated licence")
    export_ids = {p.get("id") for p in data.get("products") or []}
    csv_ids = set()
    for line in open(os.path.join(ROOT, "data", "chips", "export", "chips.csv"), encoding="utf-8").read().splitlines()[1:]:
        csv_ids.add(line.split(",", 1)[0].strip('"'))
    open_ids = {r.get("id") for r in list(base) + list(off) if r.get("source_licence") != unstated}
    if export_ids != open_ids or csv_ids != open_ids:
        problems.append(f"chip-db: ODbL JSON/CSV must contain the open records and nothing else (export {len(export_ids)}, csv {len(csv_ids)}, open {len(open_ids)})")
    by_id = {p.get("id"): p for p in data.get("products") or []}
    indexable_products = []
    for p in data.get("products") or []:
        ing = p.get("ingredients_text")
        has_ing = isinstance(ing, dict) and str(ing.get("text") or "").strip() != ""
        expect = (p.get("completeness") or 0) >= 60 and has_ing
        pid = p.get("id", "?")
        if p.get("ingredients_present") is not has_ing:
            problems.append(f"chip-db: {pid} ingredients_present does not match ingredients_text")
        if p.get("public_indexable") is not expect:
            problems.append(f"chip-db: {pid} public_indexable must be true only when completeness is 60 or more and ingredients_text is present")
        wave = p.get("wave_1") is True
        if wave and not expect:
            problems.append(f"chip-db: {pid} is in wave 1 but not eligible (completeness 60+ and ingredients)")
        indexed = expect and wave
        if p.get("noindex") is indexed:
            problems.append(f"chip-db: {pid} noindex must be the opposite of public_indexable and wave_1")
        page = os.path.join(ROOT, "chips", p.get("brand_slug", ""), p.get("slug", ""), "index.html")
        if not os.path.isfile(page):
            problems.append(f"chip-db: missing page for {pid}")
            continue
        page_html = open(page, encoding="utf-8").read()
        if indexed and 'content="index, follow"' not in page_html:
            problems.append(f"chip-db: {pid} is in wave 1 but its page is not index, follow")
        if not indexed and 'content="noindex' not in page_html:
            problems.append(f"chip-db: {pid} is outside wave 1 but its page is indexable")
        if indexed:
            indexable_products.append(p)
    if len(indexable_products) > int(data.get("wave_size") or 0):
        problems.append(f"chip-db: {len(indexable_products)} indexed products exceed wave_size {data.get('wave_size')}")
    brand_counts = {}
    for p in indexable_products:
        brand_counts[p.get("brand_slug")] = brand_counts.get(p.get("brand_slug"), 0) + 1
    indexable_brands = {b for b, n in brand_counts.items() if n >= 3}
    chip_sm = ET.parse(os.path.join(ROOT, "sitemap-chips.xml")).getroot()
    ns = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    locs = {e.text for e in chip_sm.findall("s:url/s:loc", ns)}
    expected_locs = {f"{SITE}/chips/"}
    expected_locs |= {f"{SITE}/brands/{slug}/" for slug in indexable_brands}
    expected_locs |= {f"{SITE}/chips/{p.get('brand_slug')}/{p.get('slug')}/" for p in indexable_products}
    if locs != expected_locs:
        extra, missing = locs - expected_locs, expected_locs - locs
        problems.append(f"chip-db: sitemap-chips.xml mismatch extra {len(extra)} missing {len(missing)}")
    if len(search) != len(base) + len(off) + len(mfds):
        problems.append(f"chip-db: search index has {len(search)} rows, records have {len(base) + len(off) + len(mfds)}")
    pages = [os.path.join(ROOT, "chips", "index.html")]
    pages += sorted(glob.glob(os.path.join(ROOT, "brands", "*", "index.html")))
    pages += sorted(glob.glob(os.path.join(ROOT, "chips", "*", "*", "index.html")))
    pages = [q for q in pages if not is_chip_preview(q)]
    titles = []
    form_ids = set()
    for path in pages:
        rel = os.path.relpath(path, ROOT).replace(os.sep, "/")
        html = open(path, encoding="utf-8").read()
        check(path, problems, form_ids)
        titles.append(re.search(r"<title>(.*?)</title>", html, re.S).group(1) if "<title>" in html else "")
        visible = re.sub(r"<script\b[\s\S]*?</script>", " ", html)
        visible = re.sub(r'<blockquote class="chip-ingredients">[\s\S]*?</blockquote>', " ", visible)
        visible = re.sub(r'<span class="chip-source-text">[\s\S]*?</span>', " ", visible)
        for m in DIETARY_RE.finditer(visible):
            window = visible[max(0, m.start() - 80):m.end() + 40]
            if re.search(r"labelled as|labeled as", window, re.I) and re.search(r"\d{4}", window):
                continue
            problems.append(f"{rel}: dietary claim {m.group(0)!r} (quote a certification as labelled as, with a date)")
        is_product = rel.startswith("chips/") and rel.count("/") >= 3 and "/brands/" not in rel
        if is_product:
            if "Check the pack; recipes change." not in html:
                problems.append(f"{rel}: missing pack-check line")
            if 'class="chip-ingredients"' not in html and "No ingredient text is recorded" not in html:
                problems.append(f"{rel}: missing ingredients")
            if 'id="sources"' not in html or "checked" not in html.lower():
                problems.append(f"{rel}: missing sources")
            if "Recipes may differ." not in html:
                problems.append(f"{rel}: equivalents section must say recipes may differ")
            figs = re.findall(r'<figure class="woc-photo(?:\s[^"]*)?"[\s\S]*?</figure>', html)
            if 'data-photo="placeholder"' in html:
                if "No product photograph is available." not in html:
                    problems.append(f"{rel}: placeholder must say that no product photograph is available")
                if any("commons.wikimedia.org" in f for f in figs if 'data-photo="placeholder"' in f):
                    problems.append(f"{rel}: placeholder must not claim a Wikimedia Commons photograph")
            elif 'data-photo="openfoodfacts"' in html:
                if not figs or any("openfoodfacts.org" not in f or "CC BY-SA" not in f or "<figcaption>" not in f for f in figs):
                    problems.append(f"{rel}: Open Food Facts photo needs a CC BY-SA credit")
            elif not figs or any("commons.wikimedia.org" not in f or "<figcaption>" not in f for f in figs):
                problems.append(f"{rel}: photo needs a Wikimedia Commons credit")
            if "aggregateRating" in html or '"review"' in html or '"ratingValue"' in html:
                problems.append(f"{rel}: Product structured data must not include ratings")
            if '"@type":"Product"' not in html.replace(" ", "") and '"@type": "Product"' not in html:
                problems.append(f"{rel}: missing Product structured data")
            if "BreadcrumbList" not in html:
                problems.append(f"{rel}: missing breadcrumb markup")
            for img in re.findall(r"<img\b[^>]*>", html):
                if 'alt="' not in img or 'alt=""' in img:
                    problems.append(f"{rel}: <img> without alt text")
                m = re.search(r'src="(/assets/photos/[^"]+)"', img)
                if m and not os.path.isfile(os.path.join(ROOT, m.group(1).lstrip("/"))):
                    problems.append(f"{rel}: missing photo file {m.group(1)}")
    if len(form_ids) > 1:
        problems.append(f"chip-db: pages use different MailerLite form ids {sorted(form_ids)}")
    if len(set(titles)) != len(titles):
        problems.append("chip-db: duplicate titles")
    index_html = open(os.path.join(ROOT, "chips", "index.html"), encoding="utf-8").read()
    if 'content="noindex' in index_html:
        problems.append("chips/index.html: the database index should be indexable")
    if "Check the pack; recipes change." not in index_html:
        problems.append("chips/index.html: missing pack-check line")
    for p in data.get("products") or []:
        pid = p.get("id", "?")
        page = os.path.join(ROOT, "chips", p.get("brand_slug", ""), p.get("slug", ""), "index.html")
        if not os.path.isfile(page):
            continue
        html = open(page, encoding="utf-8").read()
        rel = os.path.relpath(page, ROOT)
        expect = p.get("public_indexable") is True and p.get("noindex") is False
        if expect:
            if 'content="index, follow"' not in html:
                problems.append(f"{rel}: indexable product page must be index, follow")
        else:
            if 'content="noindex' not in html:
                problems.append(f"{rel}: {pid} must be noindex")
        if re.search(r"Completeness \d+/100|This page is (?:noindex|indexable)", html):
            problems.append(f"{rel}: internal indexing notes must not show on the page")
    for slug in indexable_brands:
        page = os.path.join(ROOT, "brands", slug, "index.html")
        if not os.path.isfile(page):
            problems.append(f"chip-db: missing brand page /brands/{slug}/")
            continue
        html = open(page, encoding="utf-8").read()
        if 'content="noindex' in html:
            problems.append(f"brands/{slug}/index.html: brand with an indexable product must be indexable")
    credit = "Source: Ministry of Food and Drug Safety (식품의약품안전처), processed food nutrient database"
    mfds_url = "https://various.foodsafetykorea.go.kr/nutrient/general/down/list.do"
    korea = open(os.path.join(ROOT, "south-korea", "index.html"), encoding="utf-8").read()
    korea_body = korea.split("<!-- SITE-NAV:END -->", 1)[-1]
    if "/chips/" in korea_body or "/brands/" in korea_body:
        problems.append("chip-db: south-korea country guide must not link the chip records")
    for row in mfds:
        pid = row.get("id", "?")
        if row.get("source_licence") != unstated:
            problems.append(f"chip-db: {pid} must use the unstated government-data licence")
        if pid in export_ids or pid in csv_ids:
            problems.append(f"chip-db: {pid} must be excluded from the ODbL JSON and CSV")
        if row.get("ingredients_text"):
            problems.append(f"chip-db: {pid} has no ingredient list, so it cannot be indexed")
        if not (row.get("image") or {}).get("placeholder"):
            problems.append(f"chip-db: {pid} must use the photo placeholder")
        cited = row.get("sources") or []
        if not cited or any(s.get("url") != mfds_url or s.get("checked") != "2026-11-16" for s in cited):
            problems.append(f"chip-db: {pid} must cite the Ministry URL checked 2026-11-16")
        page = os.path.join(ROOT, "chips", row.get("brand_slug", ""), row.get("slug", ""), "index.html")
        if not os.path.isfile(page):
            problems.append(f"chip-db: missing published page for {pid}")
            continue
        html = open(page, encoding="utf-8").read()
        rel = os.path.relpath(page, ROOT)
        if 'content="noindex' not in html:
            problems.append(f"{rel}: Ministry page must stay noindex")
        if credit not in html:
            problems.append(f"{rel}: missing Ministry source credit")
        if mfds_url not in html or "16 November 2026" not in html:
            problems.append(f"{rel}: Ministry page must show the source URL and the 16 November 2026 check")
        canon = f"{SITE}/chips/{row.get('brand_slug')}/{row.get('slug')}/"
        if canon not in html:
            problems.append(f"{rel}: Ministry page must be published at {canon}")
        if f"{SITE}/chips/_preview/" in html:
            problems.append(f"{rel}: Ministry page still points at the preview")


def main():
    problems = []
    pages, form_ids = {}, set()
    share_stub = lambda q: os.sep + os.path.join("which-chip-are-you", "r") + os.sep in q
    for path in [os.path.join(ROOT, "index.html")] + [q for q in sorted(glob.glob(os.path.join(ROOT, "**", "index.html"), recursive=True)) if os.path.dirname(q) != ROOT]:
        if is_chip_page(path):
            continue
        if share_stub(path):
            # Quiz-result share pages: meta tags for social previews, then a redirect to the quiz. noindex, not in sitemap.
            h = open(path, encoding="utf-8").read(); k = os.path.basename(os.path.dirname(path))
            if 'content="noindex' not in h or f"/assets/og/which-chip-are-you-r-{k}.png" not in h or f"/which-chip-are-you/?r={k}" not in h:
                problems.append(f"{os.path.relpath(path, ROOT)}: share page needs noindex, its og image and the quiz redirect")
            continue
        pages[path] = check(path, problems, form_ids)
    for path, p in pages.items():
        h = open(path, encoding="utf-8").read()
        m = re.search(r'<meta property="og:image" content="https://worldofchips\.com(/[^"]+)"', h)
        if not m:
            problems.append(f"{os.path.relpath(path, ROOT)}: missing og:image")
        elif not os.path.isfile(os.path.join(ROOT, m.group(1).lstrip("/"))):
            problems.append(f"{os.path.relpath(path, ROOT)}: og:image file missing {m.group(1)} (run scripts/build_og_images.py)")
    check_photos(problems, pages)
    if len(form_ids) > 1:
        problems.append(f"newsletter: pages use different MailerLite form ids {sorted(form_ids)}")
    titles = [p.title for p in pages.values()]
    if len(set(titles)) != len(titles):
        problems.append("duplicate <title>s")
    for path, p in pages.items():
        slug = os.path.relpath(os.path.dirname(path), ROOT).replace(os.sep, "/")
        if os.path.dirname(path) == ROOT:
            continue
        if p.canonical != f"{SITE}/{slug}/":
            problems.append(f"{slug}: canonical is {p.canonical}")
        if not p.desc:
            problems.append(f"{slug}: missing meta description")
    ns = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    sitemap_root = ET.parse(os.path.join(ROOT, "sitemap.xml")).getroot()
    locs = [e.text for e in sitemap_root.findall("s:url/s:loc", ns)]
    expected = {f"{SITE}/"} | {p.canonical for path, p in pages.items() if os.path.dirname(path) != ROOT}
    if set(locs) != expected:
        problems.append(f"sitemap mismatch: {set(locs) ^ expected}")
    n_news = check_news(problems, sitemap_root, ns)
    check_snack_boxes(problems, pages)
    check_ai_search(problems, pages)
    r = subprocess.run(["node", os.path.join(ROOT, "scripts", "build_guides.mjs"), "--check"], capture_output=True, text=True)
    if r.returncode:
        problems.append((r.stderr or r.stdout).strip()[:300])
    check_pringles_untouched(problems)
    check_chip_db(problems)
    n_ld = sum(1 for p in pages.values() for t, _ in p.scripts if t == "application/ld+json")
    n_country = sum(1 for path in pages if 'class="cp-facts"' in open(path, encoding="utf-8").read())
    print(f"Checked {n_ld} JSON-LD blocks, {n_country} country pages with Quick Facts + FAQPage, llms.txt, robots.txt, IndexNow key.")
    print(f"Checked {len(pages)} HTML files, {len(locs)} sitemap URLs, {n_news} news stories.")
    for pr in problems:
        print("PROBLEM:", pr)
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()
