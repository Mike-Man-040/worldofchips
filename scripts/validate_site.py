#!/usr/bin/env python3
"""Sanity-check the generated site (stdlib only; needs `node` on PATH for JS syntax checks).

Usage: python3 scripts/validate_site.py
"""
import glob, json, os, subprocess, sys, tempfile, xml.etree.ElementTree as ET
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://worldofchips.com"
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


def check(path, problems):
    p = Page()
    p.feed(open(path, encoding="utf-8").read())
    p.close()
    rel = os.path.relpath(path, ROOT)
    problems += [f"{rel}: {e}" for e in p.errors]
    if p.stack:
        problems.append(f"{rel}: unclosed tags {p.stack}")
    for typ, body in p.scripts:
        if typ == "application/ld+json":
            try:
                json.loads(body)
            except ValueError as e:
                problems.append(f"{rel}: bad JSON-LD: {e}")
        else:
            with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False) as f:
                f.write(body)
            r = subprocess.run(["node", "--check", f.name], capture_output=True, text=True)
            os.unlink(f.name)
            if r.returncode:
                problems.append(f"{rel}: JS syntax error: {r.stderr.strip()[:300]}")
    for a in p.links:
        href = a.get("href", "")
        if "amazon." in href or "amzn.to" in href:
            if a.get("target") != "_blank" or a.get("rel") != "sponsored noopener":
                problems.append(f"{rel}: affiliate link missing target/rel: {href}")
            if "amazon.com" in href and "tag=wordofchipspr-20" not in href:
                problems.append(f"{rel}: amazon link without affiliate tag: {href}")
        if href.startswith("/") and not href.startswith("//"):
            target = href.split("#")[0]
            if target and target != "/" and not os.path.exists(os.path.join(ROOT, target.strip("/"), "index.html")):
                problems.append(f"{rel}: broken internal link {href}")
    return p


def main():
    problems = []
    pages = {}
    for path in [os.path.join(ROOT, "index.html")] + sorted(glob.glob(os.path.join(ROOT, "*", "index.html"))):
        pages[path] = check(path, problems)
    titles = [p.title for p in pages.values()]
    if len(set(titles)) != len(titles):
        problems.append("duplicate <title>s")
    for path, p in pages.items():
        slug = os.path.basename(os.path.dirname(path))
        if os.path.dirname(path) == ROOT:
            continue
        if p.canonical != f"{SITE}/{slug}/":
            problems.append(f"{slug}: canonical is {p.canonical}")
        if not p.desc:
            problems.append(f"{slug}: missing meta description")
    ns = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    locs = [e.text for e in ET.parse(os.path.join(ROOT, "sitemap.xml")).getroot().findall("s:url/s:loc", ns)]
    expected = {f"{SITE}/"} | {p.canonical for path, p in pages.items() if os.path.dirname(path) != ROOT}
    if set(locs) != expected:
        problems.append(f"sitemap mismatch: {set(locs) ^ expected}")
    print(f"Checked {len(pages)} HTML files, {len(locs)} sitemap URLs.")
    for pr in problems:
        print("PROBLEM:", pr)
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()
