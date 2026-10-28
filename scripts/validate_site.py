#!/usr/bin/env python3
"""Sanity-check the generated site (stdlib only; needs `node` on PATH for JS syntax checks).

Usage: python3 scripts/validate_site.py
"""
import datetime, glob, json, os, re, subprocess, sys, tempfile, xml.etree.ElementTree as ET
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://worldofchips.com"
NEWS_CATEGORIES = {"Industry", "New Flavor", "Safety Recall", "Innovation", "Sustainability", "Investment", "Regional"}
NEWS_FIELDS = ("id", "date", "title", "summary", "category", "source_name", "source_url")
AFFILIATE_BRANDS = {"bokksu", "tokyotreat", "sakuraco", "japancrate", "daebak", "japancandystore", "universalyums", "mexicrate", "snackcrate"}
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
        if "tag=" not in u or "tag=worldofchips-20" not in u:
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
            if "amazon.com" in href and ("tag=" not in href or "tag=worldofchips-20" not in href):
                problems.append(f"{rel}: amazon link without affiliate tag: {href}")
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


def main():
    problems = []
    pages, form_ids = {}, set()
    share_stub = lambda q: os.sep + os.path.join("which-chip-are-you", "r") + os.sep in q
    for path in [os.path.join(ROOT, "index.html")] + [q for q in sorted(glob.glob(os.path.join(ROOT, "**", "index.html"), recursive=True)) if os.path.dirname(q) != ROOT]:
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
    n_ld = sum(1 for p in pages.values() for t, _ in p.scripts if t == "application/ld+json")
    n_country = sum(1 for path in pages if 'class="cp-facts"' in open(path, encoding="utf-8").read())
    print(f"Checked {n_ld} JSON-LD blocks, {n_country} country pages with Quick Facts + FAQPage, llms.txt, robots.txt, IndexNow key.")
    print(f"Checked {len(pages)} HTML files, {len(locs)} sitemap URLs, {n_news} news stories.")
    for pr in problems:
        print("PROBLEM:", pr)
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()
