#!/usr/bin/env python3
"""Build data/chips/mfds-kr.json from a name-filtered MFDS processed-food extract.

The input is a CSV already limited to names that matched a wide chip filter.
This script applies the tighter cut and writes one record per kept row.

Tighter cut, all required:
  - 식품명 contains 감자칩, 포테이토칩, 포테토칩 or 감자스낵 as a contiguous token
  - 식품소분류명 is 과자
  - 대표식품명 is 스낵과자 or 일반과자
  - 출처명 is 식품의약품안전처

Then drop rows that are clearly not potato chips, and keep one row per
식품명 + 제조사명 (exact strings). When 제조사명 is 해당없음, the importer
is the manufacturer key so two importers of an unnamed maker do not collapse.
The kept row is the latest 데이터생성일자, then the greatest 품목제조보고번호.
Nutrition is copied from that row. It is not averaged.

Nothing in the output is translated. name_en is null. brand is set only when
the manufacturer (or the importer, if there is no manufacturer) is itself the
brand. parent_company is null.

Usage:
  python3 scripts/import_mfds_kr.py path/to/chip_rows.csv
"""
import csv
import json
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "chips" / "mfds-kr.json"
RECORDS = ROOT / "data" / "chips" / "records.json"

MFDS_URL = "https://various.foodsafetykorea.go.kr/nutrient/general/down/list.do"
CHECKED = "2026-11-16"
FILE_VERSION = "2026-09-29"
UNSTATED = "unstated (government data, used with attribution)"
NA = "해당없음"
TERMS = ("감자칩", "포테이토칩", "포테토칩", "감자스낵")
NUT_KEYS = (
    "에너지(kcal)", "단백질(g)", "지방(g)", "탄수화물(g)", "당류(g)",
    "나트륨(mg)", "포화지방산(g)", "트랜스지방산(g)",
)
DIETARY = re.compile(
    r"(?i)\b(vegan|vegetarians?|halal|kosher|gluten[\s-]?free|dairy[\s-]?free|"
    r"lactose[\s-]?free|nut[\s-]?free|sugar[\s-]?free|fat[\s-]?free|non[\s-]?gmo|"
    r"organic|keto|paleo)\b"
)
TITLE_SUFFIX = " | World of Chips"

CHO = ["g", "kk", "n", "d", "tt", "r", "m", "b", "pp", "s", "ss", "", "j", "jj", "ch", "k", "t", "p", "h"]
JUNG = ["a", "ae", "ya", "yae", "eo", "e", "yeo", "ye", "o", "wa", "wae", "oe", "yo", "u", "wo", "we", "wi", "yu", "eu", "ui", "i"]
JONG = ["", "k", "k", "k", "n", "n", "n", "t", "l", "k", "m", "l", "l", "l", "p", "l", "m", "p", "p", "t", "t", "ng", "t", "t", "k", "t", "p", "t"]
LEGAL = re.compile(
    r"\b(inc|ltd|llc|l\.l\.c|gmbh|corp|corporation|company|limited|co|kg|"
    r"s\.p\.a|s\.l|s\.a|s\.r\.l|bhd|sdn|plc|pty|fzc|ag|nv|bv)\b\.?",
    re.I,
)


def romanize(text):
    out = []
    for ch in text:
        o = ord(ch)
        if 0xAC00 <= o <= 0xD7A3:
            i = o - 0xAC00
            cho, jung, jong = i // 588, (i % 588) // 28, i % 28
            out.append(CHO[cho] + JUNG[jung] + JONG[jong])
        else:
            out.append(ch)
    return "".join(out)


def slugify(text, limit=48):
    text = romanize(unicodedata.normalize("NFKC", text)).lower().replace("'", "").replace("’", "")
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    text = re.sub(r"-{2,}", "-", text)
    if len(text) > limit:
        text = text[:limit].rstrip("-")
    return text or "item"


def party_slug(text):
    text = unicodedata.normalize("NFKC", text)
    text = text.replace("(주)", " ").replace("㈜", " ").replace("주식회사", " ")
    text = re.sub(r"제\s*\d+\s*[가-힣A-Za-z]*공장", " ", text)
    text = LEGAL.sub(" ", text)
    # A legal name can contain a dietary word. The URL slug is not a claim.
    text = DIETARY.sub(" ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return slugify(text, 42)


def collapse(text):
    return re.sub(r"\s+", " ", (text or "").strip())


def blank(text):
    text = collapse(text)
    return None if text in ("", NA) else text


def parse_num(text):
    d = Decimal(text.strip())
    if d == d.to_integral():
        return int(d)
    return float(d)


def has_term(name):
    return any(term in name for term in terms_in(name))


def terms_in(name):
    return [term for term in TERMS if term in name]


def chip_type(name):
    if any(word in name for word in ("웨이브", "웨이비", "크링클")):
        return "ridged"
    if "케틀" in name:
        return "kettle"
    if "스택스" in name:
        return "stacked"
    return "potato-chip"


def type_note(kind, name):
    if kind == "ridged":
        return "The name includes 웨이브, 웨이비 or 크링클, so type is ridged."
    if kind == "kettle":
        return "The name includes 케틀, so type is kettle."
    if kind == "stacked":
        return "The name includes 스택스, so type is stacked."
    hit = ", ".join(terms_in(name))
    return (
        f"The name contains {hit}, 식품소분류명 is 과자, and 대표식품명 is "
        "스낵과자 or 일반과자, so type is potato-chip."
    )


def evident_brand(party):
    """Brand only when the company string is the brand. No English translation."""
    if not party:
        return None
    if "농심" in party:
        return "농심"
    if "오리온" in party:
        return "오리온"
    if "해태가루비" in party:
        return "해태가루비"
    upper = party.upper()
    if "KEOGHS" in upper:
        return "KEOGHS"
    if "AMICA CHIPS" in upper:
        return "AMICA CHIPS"
    if "DIEFFENBACH" in upper:
        return party
    if "SAN NICASIO" in upper:
        return "SAN NICASIO"
    if "PAPAS ARGENTE" in upper:
        return "PAPAS ARGENTE"
    return None


def not_potato_reason(name):
    if "돼지감자" in name:
        return "돼지감자 is Jerusalem artichoke (sunchoke), not potato. The token 감자스낵 is only a substring."
    if "스위트포테이토" in name:
        return "스위트포테이토 is sweet potato, not a potato chip."
    if name == "문경 오미자 감자스낵":
        return (
            "오미자 (schisandra) snack. Per 100 g the row lists 157 kcal, 2.40 g fat and "
            "0.15 g protein, which is not a potato chip."
        )
    return None


def fit_title(name, extra):
    core = name if not extra else f"{name} ({extra})"
    if len(core) + len(TITLE_SUFFIX) <= 65:
        return core + TITLE_SUFFIX
    reserve = 0 if not extra else len(extra) + 3
    room = 65 - len(TITLE_SUFFIX) - reserve - 1
    shown = name[:max(room, 1)].rstrip() + "…"
    core = shown if not extra else f"{shown} ({extra})"
    while len(core) + len(TITLE_SUFFIX) > 65 and len(shown) > 2:
        shown = shown[:-2].rstrip() + "…"
        core = shown if not extra else f"{shown} ({extra})"
    title = core + TITLE_SUFFIX
    if len(title) > 65:
        raise SystemExit(f"title still too long: {title}")
    return title


def make_description(name, report, food_code):
    text = (
        f"Nutrient-database row {food_code} (item report {report}) gives per-100 g figures for {name}. "
        "No ingredient list is in the row."
    )
    if len(text) <= 200 and len(text) >= 40 and not DIETARY.search(text):
        return text
    short = name
    while len(text) > 200 and len(short) > 8:
        short = short[:-2].rstrip() + "…"
        text = (
            f"Nutrient-database row {food_code} (item report {report}) gives per-100 g figures for {short}. "
            "No ingredient list is in the row."
        )
    if not 40 <= len(text) <= 200 or DIETARY.search(text):
        raise SystemExit(f"bad description ({len(text)}): {text}")
    return text


def maker_key(row):
    manufacturer = collapse(row["제조사명"])
    if manufacturer not in ("", NA):
        return manufacturer
    importer = collapse(row["수입업체명"])
    return "importer:" + importer


def load_rows(path):
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def classify(rows):
    """Return (kept groups, exclusion counts and examples)."""
    exclusions = []

    def drop(row, reason, bucket):
        exclusions.append({
            "bucket": bucket,
            "reason": reason,
            "name": collapse(row["식품명"]),
            "manufacturer": collapse(row["제조사명"]),
            "report": collapse(row["품목제조보고번호"]),
            "subclass": row["식품소분류명"],
            "representative": row["대표식품명"],
            "source": row["출처명"],
        })

    candidates = []
    for row in rows:
        name = collapse(row["식품명"])
        token = bool(terms_in(name))
        subclass_ok = row["식품소분류명"] == "과자"
        rep_ok = row["대표식품명"] in ("스낵과자", "일반과자")
        if not (token and subclass_ok and rep_ok):
            if not token:
                bucket = "name token"
                reason = "Name does not contain 감자칩, 포테이토칩, 포테토칩 or 감자스낵 as a contiguous token."
            elif not subclass_ok:
                bucket = "subclass"
                reason = f"식품소분류명 is {row['식품소분류명']}, not 과자."
            else:
                bucket = "representative food"
                reason = f"대표식품명 is {row['대표식품명']}, not 스낵과자 or 일반과자."
            drop(row, reason, bucket)
            continue
        if row["출처명"] != "식품의약품안전처":
            drop(row, f"출처명 is {row['출처명']}, not the Ministry of Food and Drug Safety.", "other source")
            continue
        if row["영양성분함량기준량"] != "100g":
            drop(row, f"Nutrition basis is {row['영양성분함량기준량']}, not 100 g.", "basis")
            continue
        reason = not_potato_reason(name)
        if reason:
            drop(row, reason, "not a potato chip")
            continue
        if any(not str(row[key]).strip() for key in NUT_KEYS):
            drop(row, "A per-100 g nutrient cell is empty.", "nutrition")
            continue
        if not collapse(row["품목제조보고번호"]):
            drop(row, "No item-report number.", "report")
            continue
        candidates.append(row)

    groups = defaultdict(list)
    for row in candidates:
        groups[(collapse(row["식품명"]), maker_key(row))].append(row)

    kept = []
    for key, group in groups.items():
        group.sort(key=lambda row: (row["데이터생성일자"], row["품목제조보고번호"], row["식품코드"]))
        winner = group[-1]
        dropped = group[:-1]
        kept.append((winner, dropped))
        for row in dropped:
            drop(
                row,
                "Same 식품명 and 제조사명 as a later row. Kept "
                f"{collapse(winner['품목제조보고번호'])} (데이터생성일자 {winner['데이터생성일자']}).",
                "duplicate",
            )
    return kept, exclusions


def source(field, note):
    item = {"field": field, "url": MFDS_URL, "checked": CHECKED}
    if note:
        item["note"] = note
    return item


def build_record(row, dropped, brand_slug, slug, title, reserved_slugs):
    name = collapse(row["식품명"])
    manufacturer = blank(row["제조사명"])
    importer = blank(row["수입업체명"])
    report = collapse(row["품목제조보고번호"])
    food_code = collapse(row["식품코드"])
    kind = chip_type(name)
    brand = evident_brand(manufacturer) or (None if manufacturer else evident_brand(importer))
    base_note = (
        f"Processed-food nutrient database (가공식품DB), file version {FILE_VERSION}, "
        f"food code {food_code}. The download page was checked on {CHECKED}. "
        "The file states no licence. Nutrition basis in the file is 100 g."
    )
    dup_note = ""
    if dropped:
        others = ", ".join(
            f"{collapse(item['품목제조보고번호'])} ({item['데이터생성일자']})" for item in dropped
        )
        same_nut = all(tuple(item[key] for key in NUT_KEYS) == tuple(row[key] for key in NUT_KEYS) for item in dropped)
        dup_note = (
            f" Other rows with this name and manufacturer were not merged: {others}. "
            + ("Nutrition on those rows matches this one." if same_nut else "Nutrition on those rows differs. This record does not average them.")
        )
    description = make_description(name, report, food_code)
    if DIETARY.search(description) or DIETARY.search(title) or DIETARY.search(base_note + dup_note):
        raise SystemExit(f"dietary wording in our prose for {food_code}")
    nutrition = {
        "basis": "100g",
        "energy_kcal": parse_num(row["에너지(kcal)"]),
        "protein_g": parse_num(row["단백질(g)"]),
        "fat_g": parse_num(row["지방(g)"]),
        "carbohydrate_g": parse_num(row["탄수화물(g)"]),
        "sugars_g": parse_num(row["당류(g)"]),
        "sodium_mg": parse_num(row["나트륨(mg)"]),
        "saturated_fat_g": parse_num(row["포화지방산(g)"]),
        "trans_fat_g": parse_num(row["트랜스지방산(g)"]),
        "source": MFDS_URL,
        "checked": CHECKED,
    }
    sources = [
        source("name_local", base_note + dup_note),
        source("product_report_number", f"품목제조보고번호 on food code {food_code}."),
        source("nutrition_per_100g", "Figures are copied per 100 g as published. They are not a health claim."),
        source("type", type_note(kind, name)),
        source("status", "The row does not say the product is on a shelf, so status is unknown."),
        source("image", "The source file has no photograph. The picture on the page is a placeholder."),
        source("source_licence", "The download page states no licence. The row is published with attribution and is left out of the ODbL download."),
        source("name_en", "No English name is certain from the Korean name alone, so name_en is null."),
        source("flavour_family", "The ten flavour pages are not assigned from a Korean name in this import, so flavour_family is null."),
        source("parent_company", "No parent company is stated by the manufacturer string, so parent_company is null."),
    ]
    if manufacturer:
        sources.insert(1, source("manufacturer", "제조사명 as published. 해당없음 is stored as null."))
    else:
        sources.insert(1, source("manufacturer", "제조사명 is 해당없음, so manufacturer is null."))
    if importer:
        sources.insert(2, source("importer", "수입업체명 as published."))
    else:
        sources.insert(2, source("importer", "수입업체명 is 해당없음, so importer is null."))
    if brand:
        sources.append(source("brand", "The brand is the company name in the manufacturer or importer field. It is not a separate lookup."))
    else:
        sources.append(source("brand", "The manufacturer string does not name a single consumer brand, so brand is null."))
    record = {
        "id": "kr-" + food_code.lower(),
        "slug": slug,
        "brand_slug": brand_slug,
        "title": title,
        "description": description,
        "barcodes": [],
        "brand": brand,
        "parent_company": None,
        "name_local": name,
        "name_en": None,
        "manufacturer": manufacturer,
        "importer": importer,
        "product_report_number": report,
        "type": kind,
        "flavour_family": None,
        "heat_level": None,
        "countries_sold": [],
        "equivalents": [],
        "pack_sizes_g": [],
        "price_per_100g": None,
        "nutrition_per_100g": nutrition,
        "status": "unknown",
        "ingredients_text": None,
        "image": {
            "file": "no-product-photo",
            "width": 960,
            "height": 720,
            "alt": "No product photograph is available",
            "licence": "placeholder",
            "licence_url": MFDS_URL,
            "credit": "No product photograph is available",
            "source": MFDS_URL,
            "placeholder": True,
        },
        "where_to_buy": [],
        "source_licence": UNSTATED,
        "sources": sources,
    }
    if brand_slug in reserved_slugs:
        raise SystemExit(f"brand_slug collides with an existing record: {brand_slug}")
    return record


def assign_slugs(kept, reserved):
    raw_by_slug = defaultdict(set)
    slug_of = {}
    for row, _dropped in kept:
        party = blank(row["제조사명"]) or blank(row["수입업체명"]) or "unknown-maker"
        raw_by_slug[party_slug(party)].add(party)
    # If two different party strings share a slug, keep the slug. The records
    # still store each legal name. A collision with an Open Food Facts brand is refused later.
    taken_product = set()
    records = []
    name_counts = Counter(collapse(row["식품명"]) for row, _d in kept)
    used_titles = {item["title"] for item in json.loads(RECORDS.read_text(encoding="utf-8"))}
    for row, dropped in sorted(kept, key=lambda pair: pair[0]["식품코드"]):
        party = blank(row["제조사명"]) or blank(row["수입업체명"]) or "unknown-maker"
        brand_slug = party_slug(party)
        if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", brand_slug):
            raise SystemExit(f"bad brand_slug {brand_slug} from {party}")
        tail = "-".join(collapse(row["식품코드"]).lower().split("-")[-2:])
        name_slug = slugify(collapse(row["식품명"]), 36)
        slug = f"{name_slug}-{tail}"
        if (brand_slug, slug) in taken_product:
            slug = f"{name_slug}-{collapse(row['식품코드']).lower()}"
        taken_product.add((brand_slug, slug))
        extra = tail.split("-")[-1] if name_counts[collapse(row["식품명"])] > 1 else None
        title = fit_title(collapse(row["식품명"]), extra)
        if title in used_titles:
            title = fit_title(collapse(row["식품명"]), tail)
        if title in used_titles:
            raise SystemExit(f"duplicate title {title}")
        used_titles.add(title)
        records.append(build_record(row, dropped, brand_slug, slug, title, reserved))
    return records, raw_by_slug


def main():
    if len(sys.argv) != 2:
        raise SystemExit("usage: python3 scripts/import_mfds_kr.py CSV")
    rows = load_rows(Path(sys.argv[1]))
    kept, exclusions = classify(rows)
    existing = json.loads(RECORDS.read_text(encoding="utf-8"))
    reserved = {item["brand_slug"] for item in existing}
    records, raw_by_slug = assign_slugs(kept, reserved)
    ids = [item["id"] for item in records]
    if len(ids) != len(set(ids)):
        raise SystemExit("duplicate id")
    paths = [(item["brand_slug"], item["slug"]) for item in records]
    if len(paths) != len(set(paths)):
        raise SystemExit("duplicate path")
    for item in records:
        if item["name_en"] is not None or item["parent_company"] is not None:
            raise SystemExit("unexpected English name or parent")
        if item["ingredients_text"] is not None or item["where_to_buy"] or item["countries_sold"]:
            raise SystemExit("invented field")
        if item["source_licence"] != UNSTATED:
            raise SystemExit("licence")
        if not item["image"]["placeholder"]:
            raise SystemExit("photo")
        for src in item["sources"]:
            if src["url"] != MFDS_URL or src["checked"] != CHECKED:
                raise SystemExit("source citation")
    records.sort(key=lambda item: item["id"])
    OUT.write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    buckets = Counter(item["bucket"] for item in exclusions)
    print(f"input_rows {len(rows)}")
    print(f"kept {len(records)}")
    print(f"excluded {len(exclusions)}")
    for bucket, count in sorted(buckets.items()):
        print(f"  {bucket}: {count}")
    print(f"brands_set {sum(1 for item in records if item['brand'])}")
    print(f"name_en_null {sum(1 for item in records if item['name_en'] is None)}")
    print(f"brand_slugs {len({item['brand_slug'] for item in records})}")
    print("type", dict(Counter(item["type"] for item in records)))
    merged = {slug: sorted(names) for slug, names in raw_by_slug.items() if len(names) > 1}
    print(f"party_slug_groups_with_multiple_legal_names {len(merged)}")
    for slug, names in sorted(merged.items()):
        print(f"  {slug}: {names}")
    # A few exclusion examples per bucket, for the PR notes.
    shown = Counter()
    print("examples:")
    for item in exclusions:
        if shown[item["bucket"]] >= 3:
            continue
        shown[item["bucket"]] += 1
        print(f"  [{item['bucket']}] {item['name']} | {item['manufacturer']} | {item['reason']}")


if __name__ == "__main__":
    main()
