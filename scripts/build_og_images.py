"""Share images (1200x630 PNG) for og:image / twitter:image: assets/og/<slug>.png for every built page
(slug = path with "/" -> "-", homepage = "home"), incl. one per quiz result (/which-chip-are-you/r/<country>/).
Text comes from each page's <h1>. Run after the HTML builders. Needs Pillow."""
import glob, html, os, re
from PIL import Image, ImageDraw, ImageFont
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT = os.path.join(ROOT, "assets", "og"); os.makedirs(OUT, exist_ok=True)
PF = "/usr/share/fonts/truetype/sand-box/google/Playfair Display/PlayfairDisplay-VariableFont_wght.ttf"
SANS = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"; SB = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
CREAM, DARK, BROWN, GOLD, MUTED = "#FFF8EC", "#1A1108", "#3D2B0F", "#C48A20", "#6B5A3E"

def pf(size):
    f = ImageFont.truetype(PF, size); f.set_variation_by_name("Bold"); return f

def clean(s):
    s = html.unescape(re.sub(r"<[^>]+>", "", s))
    return re.sub(r"\s+", " ", "".join(ch for ch in s if ord(ch) < 0x2190 or ch in "’‘“”–—")).strip()

def wrap(g, text, font, width):
    lines, cur = [], ""
    for w in text.split():
        t = (cur + " " + w).strip()
        if g.textlength(t, font=font) <= width or not cur: cur = t
        else: lines.append(cur); cur = w
    return lines + [cur]

def kicker(slug):
    if slug == "home": return "Brands, flavours & where to buy them"
    if slug.startswith("which-chip-are-you-r-"): return "Which country’s chip are you? Take the quiz"
    if slug.startswith("flavors-"): return "Chip flavour guide"
    if slug == "which-chip-are-you": return "Five questions. Ten countries. One chip."
    if slug == "pringles-index": return "What a can of Pringles costs in 31 countries"
    return None

def draw(slug, title, sub):
    im = Image.new("RGB", (1200, 630), CREAM); g = ImageDraw.Draw(im)
    g.rectangle([0, 0, 1200, 92], fill=DARK); g.rectangle([0, 92, 1200, 98], fill=GOLD)
    g.text((60, 46), "World of Chips", font=pf(40), fill="#F5ECD7", anchor="lm")
    g.text((1140, 46), "worldofchips.com", font=ImageFont.truetype(SB, 24), fill=GOLD, anchor="rm")
    size = 76
    while True:
        f = pf(size); lines = wrap(g, title, f, 1080)
        if len(lines) <= 3 or size <= 44: break
        size -= 4
    y = 150 + (3 - len(lines)) * size * 0.35
    for ln in lines:
        g.text((60, y), ln, font=f, fill=BROWN); y += size * 1.18
    if sub:
        g.text((60, 520), sub, font=ImageFont.truetype(SANS, 30), fill=MUTED)
    g.rounded_rectangle([60, 575, 260, 585], radius=5, fill=GOLD)
    im.save(os.path.join(OUT, slug + ".png"), optimize=True)

n = 0
for p in sorted(glob.glob(os.path.join(ROOT, "**", "index.html"), recursive=True)):
    rel = os.path.relpath(os.path.dirname(p), ROOT)
    if rel.startswith(("node_modules", ".")) and rel != ".": continue
    slug = "home" if rel == "." else rel.replace(os.sep, "-")
    src = open(p, encoding="utf-8").read()
    m = re.search(r"<h1[^>]*>(.*?)</h1>", src, re.S)
    if not m: continue
    title = clean(m.group(1))
    if slug.startswith("which-chip-are-you-r-"): title = title.replace("You are", "I’m", 1)
    if slug == "home": title = "Potato Chips Around the World"
    sub = kicker(slug)
    if sub is None:
        d = re.search(r'<span class="cp-region">([^<]*)</span>', src); sub = clean(d.group(1)) if d else None
        if sub and 'cp-facts' in src: sub = f'Brands, flavours & where to buy · {sub}'
    draw(slug, title, sub); n += 1
print(f"wrote {n} images to assets/og/")
