#!/usr/bin/env python3
"""Import usable potato-crisp rows from an Open Food Facts nightly CSV.

The input is the English nightly export, one download, not live product pages:

  https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv.gz

A row is imported when categories_tags contains en:potato-crisps, the row is
usable (product name, brand, an image URL, and ingredient text), and
countries_tags includes the United States, the United Kingdom, the Netherlands,
Mexico, or Japan. A product tagged in more than one of those countries is one
record. Pack-size variants with the same brand, cleaned name, and ingredient
text share a record. Generic names such as "chips" stay one record per barcode.

Barcodes already on a curated record in data/chips/records.json are not
imported again, and those curated slugs are left as they are.

Photographs are fetched from the image URL in the export, resized to at most
480px, and stored as WebP under CC BY-SA 3.0. Nothing is hotlinked.

Usage:
  python3 scripts/import_off.py /path/to/en.openfoodfacts.org.products.csv.gz
"""
import csv
import gzip
import json
import os
import re
import subprocess
import sys
import tempfile
import unicodedata
import urllib.request
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "chips" / "off.json"
RECORDS = ROOT / "data" / "chips" / "records.json"
MFDS = ROOT / "data" / "chips" / "mfds-kr.json"
PHOTOS = ROOT / "assets" / "photos"

CHECKED = "2026-11-16"
EXPORT_MODIFIED = "Mon, 16 Nov 2026 10:13:19 GMT"
EXPORT_URL = "https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv.gz"
CC_LICENCE = "CC BY-SA 3.0"
CC_URL = "https://creativecommons.org/licenses/by-sa/3.0/"
UA = "WorldOfChipsChipDb/1.0 (static nightly import; +https://worldofchips.com/chips/)"
TITLE_SUFFIX = " | World of Chips"
MAX_EDGE = 480
IMAGE_WORKERS = 8

TARGETS = {
    "en:united-states": "united-states",
    "en:united-kingdom": "united-kingdom",
    "en:netherlands": "netherlands",
    "en:mexico": "mexico",
    "en:japan": "japan",
}
# English name only when every country tag is one of these. A mix with a
# non-English country is not treated as an English pack name.
ENGLISH_COUNTRIES = {
    "united-states", "united-kingdom", "canada", "ireland", "australia", "new-zealand",
}
COUNTRY_NAMES = {
    "united-states": "the United States",
    "united-kingdom": "the United Kingdom",
    "netherlands": "the Netherlands",
    "mexico": "Mexico",
    "japan": "Japan",
    "canada": "Canada",
    "ireland": "Ireland",
    "australia": "Australia",
    "new-zealand": "New Zealand",
    "belgium": "Belgium",
    "france": "France",
    "germany": "Germany",
    "spain": "Spain",
    "italy": "Italy",
    "south-korea": "South Korea",
    "brazil": "Brazil",
    "india": "India",
    "china": "China",
    "thailand": "Thailand",
    "sweden": "Sweden",
    "poland": "Poland",
    "peru": "Peru",
    "colombia": "Colombia",
    "nigeria": "Nigeria",
    "egypt": "Egypt",
    "turkey": "Turkey",
    "south-africa": "South Africa",
    "indonesia": "Indonesia",
    "argentina": "Argentina",
    "russia": "Russia",
    "bolivia": "Bolivia",
}
GENERIC_NAMES = {
    "chips", "chip", "crisps", "crisp", "potato chips", "potato crisps",
    "potato chip", "potato crisp", "lays", "walkers", "pringles", "ruffles",
    "doritos", "snack", "snacks", "potato", "potatoes", "chip bag",
}
DIETARY = re.compile(
    r"(?i)\b(vegan|vegetarians?|halal|kosher|gluten[\s-]?free|dairy[\s-]?free|"
    r"lactose[\s-]?free|nut[\s-]?free|sugar[\s-]?free|fat[\s-]?free|non[\s-]?gmo|"
    r"organic|keto|paleo)\b"
)
WEIGHT_RE = re.compile(
    r"(?i)[\s,]*\d+(?:[.,]\d+)?\s?(?:kg|g|gr|gram|grams|ml|cl|oz|ounce|ounces|lb|lbs)\b\.?"
)
GRAM_RE = re.compile(
    r"(?i)(?<![A-Za-z])(\d+(?:[.,]\d+)?)\s*(?:grams|gram|gr|g)\b"
)
FLAVOUR_PATTERNS = (
    ("flamin-hot", re.compile(r"flamin['’]? ?hot|flaming hot", re.I)),
    ("dill-pickle", re.compile(r"dill[\s-]+pickle", re.I)),
    ("prawn-cocktail", re.compile(r"prawn cocktail|shrimp cocktail", re.I)),
    ("salt-and-vinegar", re.compile(r"salt\s*(?:and|&)\s*vinegar|zout\s*(?:en|&)\s*azijn", re.I)),
    ("sour-cream-and-onion", re.compile(r"sour cream\s*(?:and|&)\s*onion", re.I)),
    ("cheese-and-onion", re.compile(r"cheese\s*(?:and|&)\s*onion|kaas\s*(?:en|&)\s*ui", re.I)),
    ("nori-seaweed", re.compile(r"\bnori\b|seaweed|海苔", re.I)),
    ("ketchup", re.compile(r"\bketchup\b", re.I)),
    ("paprika", re.compile(r"\bpaprika\b", re.I)),
    ("bbq", re.compile(r"\bbbq\b|barbecue|barbeque", re.I)),
)
CERT_TAGS = {
    "en:organic": "organic",
    "en:eu-organic": "EU organic",
    "en:usda-organic": "USDA organic",
    "en:vegan": "vegan",
    "en:vegetarian": "vegetarian",
    "en:halal": "halal",
    "en:kosher": "kosher",
    "en:gluten-free": "gluten-free",
    "en:no-gluten": "gluten-free",
    "en:dairy-free": "dairy-free",
    "en:lactose-free": "lactose-free",
    "en:nut-free": "nut-free",
    "en:sugar-free": "sugar-free",
    "en:fat-free": "fat-free",
    "en:non-gmo": "non-GMO",
    "en:keto": "keto",
    "en:paleo": "paleo",
    "en:fair-trade": "fair trade",
    "en:rainforest-alliance": "Rainforest Alliance",
    "en:utz-certified": "UTZ",
}
STACKED_TAGS = {"en:stacked-potato-chips", "en:stackable-potato-chips", "en:pringles"}
RIDGE_TAGS = {"en:ridged-potato-chips", "en:ridged-crisps", "en:crinkle-cut-potato-chips", "en:wavy-potato-chips"}
KETTLE_NEEDLE = "kettle"
TORTILLA_TAGS = {"en:tortilla-chips", "en:tortilla-chip", "en:corn-chips"}
SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
CHO = ["g", "kk", "n", "d", "tt", "r", "m", "b", "pp", "s", "ss", "", "j", "jj", "ch", "k", "t", "p", "h"]
JUNG = ["a", "ae", "ya", "yae", "eo", "e", "yeo", "ye", "o", "wa", "wae", "oe", "yo", "u", "wo", "we", "wi", "yu", "eu", "ui", "i"]
JONG = ["", "k", "k", "k", "n", "n", "n", "t", "l", "k", "m", "l", "l", "l", "p", "l", "m", "p", "p", "t", "t", "ng", "t", "t", "k", "t", "p", "t"]


def romanize(text):
    out = []
    for ch in text:
        o = ord(ch)
        if 0xAC00 <= o <= 0xD7A3:
            i = o - 0xAC00
            out.append(CHO[i // 588] + JUNG[(i % 588) // 28] + JONG[i % 28])
        else:
            out.append(ch)
    return "".join(out)


def slugify(text, limit=48):
    text = romanize(unicodedata.normalize("NFKC", text or ""))
    text = text.lower().replace("'", "").replace("’", "").replace("&", " and ")
    text = DIETARY.sub(" ", text)
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    text = re.sub(r"-{2,}", "-", text)
    if len(text) > limit:
        text = text[:limit].rstrip("-")
    return text


def collapse(text):
    return re.sub(r"\s+", " ", (text or "").replace("\u00a0", " ")).strip()


def clean_name(name):
    s = unicodedata.normalize("NFKC", name or "").casefold().replace("’", "'").replace("'", "")
    prev = None
    while prev != s:
        prev = s
        s = WEIGHT_RE.sub("", s).strip(" -_,.;")
    s = re.sub(r"[^\w]+", " ", s, flags=re.UNICODE)
    return re.sub(r"\s+", " ", s).strip()


def norm_ingredients(text):
    return re.sub(r"\s+", " ", (text or "").casefold()).strip()


def tags_of(value):
    return [t.strip() for t in (value or "").split(",") if t.strip()]


def product_url(code):
    return f"https://world.openfoodfacts.org/product/{code}"


def country_slug(tag):
    if not tag.startswith("en:"):
        return None
    slug = tag[3:]
    if not SLUG_RE.fullmatch(slug):
        return None
    return slug


def chip_type(tag_set):
    if tag_set & TORTILLA_TAGS:
        return "tortilla"
    if tag_set & STACKED_TAGS:
        return "stacked"
    if any(KETTLE_NEEDLE in t for t in tag_set):
        return "kettle"
    if tag_set & RIDGE_TAGS:
        return "ridged"
    return "potato-chip"


def flavour_of(name):
    for slug, pat in FLAVOUR_PATTERNS:
        if pat.search(name or ""):
            return slug
    return None


def certs_of(tag_list):
    found = []
    seen = set()
    for tag in tag_list:
        label = CERT_TAGS.get(tag)
        if not label and (tag.endswith(":organic") or tag.endswith(":vegan") or tag.endswith(":halal") or tag.endswith(":kosher")):
            label = tag.split(":")[-1].replace("-", " ")
        if label and label not in seen:
            seen.add(label)
            found.append(label)
    return found


def grams_of(quantity, product_quantity):
    """Gram figures the export states. Ounce conversions are not invented."""
    text = quantity or ""
    found = []
    for raw in GRAM_RE.findall(text):
        try:
            n = float(raw.replace(",", "."))
        except ValueError:
            continue
        if 1 <= n <= 5000:
            found.append(n if n != int(n) else int(n))
    if found:
        return found, "stated in the quantity string"
    if text.strip():
        return [], ""
    raw_q = (product_quantity or "").strip()
    if not raw_q:
        return [], ""
    try:
        n = float(raw_q.replace(",", "."))
    except ValueError:
        return [], ""
    if 1 <= n <= 5000:
        value = n if n != int(n) else int(n)
        return [value], "product_quantity is in grams; the quantity string is empty"
    return [], ""


def safe_text(text):
    return collapse(DIETARY.sub(" ", text or ""))


def jpeg_size(data):
    if data[:2] != b"\xff\xd8":
        return None
    i = 2
    sof = {0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF}
    while i + 8 < len(data):
        if data[i] != 0xFF:
            i += 1
            continue
        marker = data[i + 1]
        if marker in (0xD8, 0xD9) or 0xD0 <= marker <= 0xD7:
            i += 2
            continue
        if i + 4 > len(data):
            return None
        length = int.from_bytes(data[i + 2:i + 4], "big")
        if marker in sof and i + 9 <= len(data):
            h = int.from_bytes(data[i + 5:i + 7], "big")
            w = int.from_bytes(data[i + 7:i + 9], "big")
            if w and h:
                return w, h
        if length < 2:
            return None
        i += 2 + length
    return None


def image_size(data):
    if data[:8] == b"\x89PNG\r\n\x1a\n" and len(data) >= 24:
        w = int.from_bytes(data[16:20], "big")
        h = int.from_bytes(data[20:24], "big")
        return (w, h) if w and h else None
    if data[:2] == b"\xff\xd8":
        return jpeg_size(data)
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP" and len(data) >= 30:
        if data[12:16] == b"VP8X":
            w = 1 + int.from_bytes(data[24:27], "little")
            h = 1 + int.from_bytes(data[27:30], "little")
            return w, h
        if data[12:16] == b"VP8 " and len(data) >= 30:
            w = int.from_bytes(data[26:28], "little") & 0x3FFF
            h = int.from_bytes(data[28:30], "little") & 0x3FFF
            return w, h
    return None


def webp_size(path):
    try:
        out = subprocess.run(["webpinfo", str(path)], capture_output=True, text=True, check=False)
    except OSError:
        return None
    w = h = None
    for line in (out.stdout or "").splitlines():
        if "Width:" in line:
            w = int(line.split(":")[-1].strip())
        elif "Height:" in line:
            h = int(line.split(":")[-1].strip())
    if w and h:
        return w, h
    return None


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=40) as resp:
        return resp.read()


def convert_image(data, dest):
    size = image_size(data)
    fd, tmp = tempfile.mkstemp(suffix=".img")
    os.close(fd)
    try:
        with open(tmp, "wb") as f:
            f.write(data)
        cmd = ["cwebp", "-quiet", "-q", "68", "-m", "4"]
        if size and max(size) > MAX_EDGE:
            w, h = size
            cmd += ["-resize", "480", "0"] if w >= h else ["-resize", "0", "480"]
        cmd += [tmp, "-o", str(dest)]
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode != 0 or not dest.exists() or dest.stat().st_size < 32:
            return None
        return webp_size(dest)
    finally:
        try:
            os.remove(tmp)
        except OSError:
            pass


def download_one(job):
    dest = PHOTOS / f"{job['file']}-480.webp"
    if dest.exists() and dest.stat().st_size > 32:
        wh = webp_size(dest)
        if wh:
            return job["id"], wh, dest.stat().st_size, None
    last = None
    for url in job["urls"]:
        try:
            data = fetch(url)
        except Exception as e:
            last = str(e)
            continue
        if len(data) < 32:
            last = "empty image"
            continue
        wh = convert_image(data, dest)
        if wh:
            return job["id"], wh, dest.stat().st_size, None
        last = "cwebp failed"
        if dest.exists():
            dest.unlink()
    return job["id"], None, 0, last or "no image url"


def placeholder_image(code):
    return {
        "file": "no-product-photo",
        "width": 960,
        "height": 720,
        "alt": "No product photograph is available",
        "licence": "placeholder",
        "licence_url": product_url(code),
        "credit": "No product photograph is available",
        "source": product_url(code),
        "placeholder": True,
    }


def off_image(file_key, wh, alt, credit, code):
    return {
        "file": file_key,
        "width": wh[0],
        "height": wh[1],
        "alt": alt,
        "licence": CC_LICENCE,
        "licence_url": CC_URL,
        "credit": credit,
        "source": product_url(code),
        "photo_host": "openfoodfacts",
    }


def make_title(brand, name, code, used):
    b = "" if not brand or DIETARY.search(brand) else brand
    n = safe_text(name)
    head = collapse(f"{b} {n}")
    if len(head) < 2:
        head = f"Potato crisp {code[-6:]}"
    room = 65 - len(TITLE_SUFFIX)

    def clip(h):
        h = collapse(h)
        if len(h) + len(TITLE_SUFFIX) <= 65:
            return h + TITLE_SUFFIX
        return h[:room].rstrip() + TITLE_SUFFIX

    title = clip(head)
    ntry = 0
    while title in used:
        ntry += 1
        title = clip(f"{head} {code[-4:]}{'' if ntry == 1 else '-' + str(ntry)}")
        if ntry > 30:
            title = clip(f"Potato crisp {code}")
            break
    used.add(title)
    return title


def make_description(brand, countries, code):
    b = "" if not brand or DIETARY.search(brand) else brand
    names = [COUNTRY_NAMES.get(c, c.replace("-", " ")) for c in countries[:3]]
    places = ", ".join(names) if names else "a listed country"
    if len(countries) > 3:
        places += f" and {len(countries) - 3} more"
    lead = f"{b} potato crisp" if b else "Potato crisp"
    text = f"{lead} in Open Food Facts record {code}, tagged {places}. Ingredients are copied from that record."
    text = collapse(text)
    if len(text) > 200 or DIETARY.search(text):
        text = f"Potato crisp in Open Food Facts record {code}. Ingredients are copied from that record."
    if len(text) < 40:
        text += " Check the pack; recipes change."
    return text[:200]


def load_existing():
    curated = json.loads(RECORDS.read_text(encoding="utf-8"))
    mfds = json.loads(MFDS.read_text(encoding="utf-8"))
    paths = set()
    titles = set()
    barcodes = set()
    brands = {}
    for row in curated + mfds:
        paths.add(f"{row['brand_slug']}/{row['slug']}")
        titles.add(row["title"])
        if row.get("brand") and row["brand_slug"] not in brands:
            brands[row["brand_slug"]] = row["brand"]
        for code in row.get("barcodes") or []:
            barcodes.add(code)
            barcodes.add(code.lstrip("0") or "0")
            if len(code) < 14:
                barcodes.add(code.zfill(13))
                barcodes.add(code.zfill(14))
    return paths, titles, barcodes, brands


def code_taken(code, barcodes):
    if code in barcodes:
        return True
    stripped = code.lstrip("0") or "0"
    if stripped in barcodes:
        return True
    if len(code) < 14 and (code.zfill(13) in barcodes or code.zfill(14) in barcodes):
        return True
    return False


def channels_for(country):
    channels = []
    if country in ("united-states", "canada"):
        channels.append("universal-yums")
    if country in ("netherlands", "belgium"):
        channels.append("bol")
    if country == "south-korea":
        channels.append("daebak")
    channels.append("amazon")
    return channels


def amazon_query(brand, name, code):
    b = "" if not brand or DIETARY.search(brand) else brand
    n = safe_text(name)
    q = collapse(f"{b} {n} potato chips") or f"potato chips {code}"
    return q[:80]


def alt_text(brand, name):
    raw = collapse(f"{brand or ''} {name or ''}")
    if raw and not DIETARY.search(raw):
        return raw[:180]
    cleaned = safe_text(raw)
    return (cleaned or "Potato crisp")[:180]


def credit_for(creator):
    c = collapse(creator)
    if not c or len(c) > 60 or DIETARY.search(c) or "http" in c.lower() or "@" in c:
        return "Open Food Facts contributors"
    return c


def source(field, code, note):
    row = {"field": field, "url": product_url(code), "checked": CHECKED}
    if note:
        row["note"] = note
    return row


def build_record(group, paths, titles, brand_names):
    rows = group["rows"]
    rows.sort(key=lambda r: (len(r["code"]), r["code"]))
    primary = next((r for r in rows if r["image_urls"]), rows[0])
    code = min((r["code"] for r in rows), key=lambda c: (int(c), c))
    brand_slug = slugify(rows[0]["brand"], 42) or f"b{code[:8]}"
    if not SLUG_RE.fullmatch(brand_slug):
        brand_slug = f"b{code[:8]}"
    known = brand_names.get(brand_slug)
    brand = known or rows[0]["brand"]
    name_local = primary["name"]
    countries = []
    seen_c = set()
    for r in rows:
        for c in r["countries"]:
            if c not in seen_c:
                seen_c.add(c)
                countries.append(c)
    english = all(c in ENGLISH_COUNTRIES for c in countries) and not re.search(r"[\u0400-\u04FF\u0600-\u06FF\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF]", name_local)
    name_en = name_local if english else None
    flavour = flavour_of(name_en or name_local)
    owners = {r["owner"] for r in rows if r["owner"] and not DIETARY.search(r["owner"])}
    parent = next(iter(owners)) if len(owners) == 1 else None
    barcodes = []
    for r in rows:
        if r["code"] not in barcodes:
            barcodes.append(r["code"])
    packs = []
    seen_packs = set()
    for r in rows:
        for country in r["countries"]:
            for grams in r["grams"]:
                key = (country, grams)
                if key in seen_packs:
                    continue
                seen_packs.add(key)
                note = r["grams_note"] or "Gram figure stated on the row."
                if r["quantity"] and not DIETARY.search(r["quantity"]):
                    note = f"{note} Quantity field: {r['quantity']}."
                packs.append({
                    "country": country,
                    "grams": grams,
                    "source": product_url(r["code"]),
                    "checked": CHECKED,
                    "note": note,
                })
    certs = []
    seen_certs = set()
    for r in rows:
        for label in r["certs"]:
            if label not in seen_certs:
                seen_certs.add(label)
                certs.append({"label": label, "source": product_url(r["code"]), "checked": CHECKED})
    basis = name_en or name_local
    slug = slugify(basis, 48) or f"b{code}"
    if not slug:
        slug = f"b{code}"
    path = f"{brand_slug}/{slug}"
    if path in paths:
        slug = slugify(f"{slug}-{code[-6:]}", 56) or f"b{code}"
        path = f"{brand_slug}/{slug}"
    n = 2
    while path in paths or not SLUG_RE.fullmatch(slug):
        slug = f"b{code}" if n == 2 and not SLUG_RE.fullmatch(slug) else f"b{code}-{n}"
        path = f"{brand_slug}/{slug}"
        n += 1
        if n > 20:
            break
    paths.add(path)
    title = make_title(brand if not DIETARY.search(brand) else "", name_local, code, titles)
    description = make_description(brand, countries, code)
    file_key = f"off-{code}"
    record = {
        "id": f"off-{code}",
        "slug": slug,
        "brand_slug": brand_slug,
        "title": title,
        "description": description,
        "barcodes": barcodes,
        "brand": brand,
        "parent_company": parent,
        "name_local": name_local,
        "name_en": name_en,
        "type": rows[0]["type"],
        "flavour_family": flavour,
        "heat_level": None,
        "countries_sold": [
            {"country": c, "source": product_url(next(r["code"] for r in rows if c in r["countries"])), "checked": CHECKED}
            for c in countries
        ],
        "equivalents": [],
        "pack_sizes_g": packs,
        "price_per_100g": None,
        "status": "unknown",
        "ingredients_text": {
            "text": primary["ingredients"],
            "source": product_url(primary["code"]),
            "checked": CHECKED,
            "note": f"Copied from ingredients_text in the Open Food Facts nightly CSV (Last-Modified {EXPORT_MODIFIED}). Not edited.",
        },
        "image": placeholder_image(code),
        "where_to_buy": [
            {"country": c, "channels": channels_for(c), "amazon_query": amazon_query(brand, name_en or name_local, code)}
            for c in countries
        ],
        "sources": [],
    }
    if primary.get("lang_hint"):
        record["ingredients_text"]["lang"] = primary["lang_hint"]
    if certs:
        record["certifications"] = certs
    notes = {
        "name_local": "product_name on the primary barcode, copied as stored.",
        "name_en": "Set only when every country tag is an English-speaking country and the name is Latin script. Otherwise null. Not a translation.",
        "brand": "First brand in the brands field.",
        "parent_company": "brand_owner on the row. Ownership fields in the export can lag a sale." if parent else "brand_owner is empty or the merged rows disagree, so parent_company is null.",
        "type": "categories_tags includes en:potato-crisps. A more specific category tag sets stacked, kettle, ridged, or tortilla; otherwise potato-chip.",
        "flavour_family": "The product name matches one of the ten flavour pages." if flavour else "The product name does not match one of the ten flavour pages, so flavour_family is null.",
        "heat_level": "This barcode is not a rung on the spice ladder, so heat_level is null.",
        "countries_sold": "countries_tags on the barcode. A tag is where a contributor entered the product, not a proof it is on shelf today.",
        "barcodes": "Codes " + ", ".join(barcodes[:12]) + ("…" if len(barcodes) > 12 else "") + ". The product page is /product/ plus the code.",
        "pack_sizes_g": "Gram figures stated on the row. Ounces are not converted." if packs else "No gram figure is stated in quantity or product_quantity, so pack size is empty.",
        "ingredients_text": f"Nightly CSV Last-Modified {EXPORT_MODIFIED}.",
        "image": "Front or main image URL on the row, resized to at most 480px. The photograph stays under CC BY-SA 3.0.",
        "status": "A row in the export is not a shelf check, so status is unknown.",
        "equivalents": "This Open Food Facts row does not name another brand as the same product. Equivalents stays empty.",
        "where_to_buy": "Universal Yums ships to the US and Canada only (company site, already recorded 2 Nov 2026). bol.com is the partner for the Netherlands and Belgium. Daebak is the partner used for South Korea. Amazon is a search link, not a stock check.",
        "price_per_100g": "The export is not a retailer price. price_per_100g is null. The Pringles Index is not a source.",
        "certifications": "labels_tags on the row. Quoted on the page as labelled as, with this date. Not a check by World of Chips.",
    }
    where_url = "https://www.universalyums.com/" if any(c in ("united-states", "canada") for c in countries) else product_url(code)
    where_checked = "2026-11-02" if where_url.startswith("https://www.universalyums.com") else CHECKED
    for field, note in notes.items():
        if field == "certifications" and not certs:
            continue
        if field == "where_to_buy":
            record["sources"].append({"field": field, "url": where_url, "checked": where_checked, "note": note})
        elif field == "heat_level":
            record["sources"].append({"field": field, "url": "https://worldofchips.com/spiciest-chips/", "checked": CHECKED, "note": note})
        else:
            record["sources"].append(source(field, code, note))
    job = {
        "id": record["id"],
        "file": file_key,
        "urls": primary["image_urls"],
        "alt": alt_text(brand, name_local),
        "credit": credit_for(primary["creator"]),
        "code": code,
    }
    return record, job


def parse(path, taken):
    counts = Counter()
    groups = {}
    skipped_barcode = 0
    rows_in = 0
    csv.field_size_limit(min(sys.maxsize, 2**31 - 1))
    with gzip.open(path, "rt", encoding="utf-8", errors="replace", newline="") as f:
        reader = csv.DictReader(f, delimiter="\t")
        for row in reader:
            rows_in += 1
            if rows_in % 400000 == 0:
                print(f"  scanned {rows_in:,} rows, kept {sum(counts.values()):,}", file=sys.stderr)
            cat_tags = tags_of(row.get("categories_tags"))
            if "en:potato-crisps" not in cat_tags:
                continue
            country_tags = tags_of(row.get("countries_tags"))
            country_slugs = []
            hit = False
            for tag in country_tags:
                slug = country_slug(tag)
                if not slug:
                    continue
                if tag in TARGETS:
                    hit = True
                if slug not in country_slugs:
                    country_slugs.append(slug)
            if not hit:
                continue
            name = collapse(row.get("product_name"))
            brand = collapse((row.get("brands") or "").split(",")[0])
            ingredients = (row.get("ingredients_text") or "").strip()
            image_urls = []
            for key in ("image_small_url", "image_url"):
                url = collapse(row.get(key))
                if url.startswith("http") and url not in image_urls:
                    image_urls.append(url)
            if not (name and brand and ingredients and image_urls):
                continue
            for tag, slug in TARGETS.items():
                if tag in country_tags:
                    counts[slug] += 1
            code = collapse(row.get("code"))
            if not re.fullmatch(r"\d{8,14}", code):
                continue
            if code_taken(code, taken):
                skipped_barcode += 1
                continue
            grams, grams_note = grams_of(row.get("quantity"), row.get("product_quantity"))
            tag_set = set(cat_tags)
            item = {
                "code": code,
                "name": name,
                "brand": brand,
                "ingredients": ingredients,
                "image_urls": image_urls,
                "countries": [s for s in country_slugs],
                "grams": grams,
                "grams_note": grams_note,
                "quantity": collapse(row.get("quantity")),
                "owner": collapse(row.get("brand_owner")),
                "certs": certs_of(tags_of(row.get("labels_tags"))),
                "type": chip_type(tag_set),
                "creator": collapse(row.get("creator")),
            }
            name_key = clean_name(name)
            brand_key = clean_name(brand)
            specific = bool(name_key) and name_key not in GENERIC_NAMES and name_key != brand_key and len(name_key) >= 3
            if specific:
                key = ("n", brand_key, name_key, norm_ingredients(ingredients), item["type"])
            else:
                key = ("b", code)
            groups.setdefault(key, {"rows": []})["rows"].append(item)
    print(f"Scanned {rows_in:,} rows.", file=sys.stderr)
    return counts, groups, skipped_barcode


def main():
    if len(sys.argv) != 2:
        print("usage: python3 scripts/import_off.py path/to/en.openfoodfacts.org.products.csv.gz", file=sys.stderr)
        return 2
    src = Path(sys.argv[1])
    paths, titles, barcodes, brand_names = load_existing()
    print("Parsing nightly export…", file=sys.stderr)
    counts, groups, skipped = parse(src, barcodes)
    print("Usable rows (a row can count in more than one country):", file=sys.stderr)
    for slug in ("united-states", "united-kingdom", "netherlands", "mexico", "japan"):
        print(f"  {slug}: {counts[slug]}", file=sys.stderr)
    print(f"Skipped barcodes already on a curated record: {skipped}", file=sys.stderr)
    print(f"Groups after the name/ingredient dedupe: {len(groups)}", file=sys.stderr)
    records = []
    jobs = []
    for key in sorted(groups, key=lambda k: json.dumps(k, ensure_ascii=False)):
        record, job = build_record(groups[key], paths, titles, brand_names)
        records.append(record)
        jobs.append(job)
    records.sort(key=lambda r: r["id"])
    by_id = {r["id"]: r for r in records}
    PHOTOS.mkdir(parents=True, exist_ok=True)
    print(f"Downloading {len(jobs)} images…", file=sys.stderr)
    failures = 0
    total_bytes = 0
    done = 0
    with ThreadPoolExecutor(max_workers=IMAGE_WORKERS) as pool:
        futs = [pool.submit(download_one, job) for job in jobs]
        job_by_id = {j["id"]: j for j in jobs}
        for fut in as_completed(futs):
            rid, wh, nbytes, err = fut.result()
            done += 1
            job = job_by_id[rid]
            if wh:
                by_id[rid]["image"] = off_image(job["file"], wh, job["alt"], job["credit"], job["code"])
                total_bytes += nbytes
            else:
                failures += 1
                if done <= 8 or failures <= 5:
                    print(f"  image skip {rid}: {err}", file=sys.stderr)
            if done % 200 == 0:
                print(f"  images {done}/{len(jobs)}, {total_bytes/1e6:.1f} MB, {failures} skipped", file=sys.stderr)
    OUT.write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    summary = {
        "usable_rows": {k: counts[k] for k in ("united-states", "united-kingdom", "netherlands", "mexico", "japan")},
        "skipped_curated_barcodes": skipped,
        "records": len(records),
        "image_files": len(records) - failures,
        "image_failures": failures,
        "image_bytes": total_bytes,
        "export_last_modified": EXPORT_MODIFIED,
        "export_url": EXPORT_URL,
    }
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
