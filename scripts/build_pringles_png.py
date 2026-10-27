"""Static ranking PNG for /pringles-index/ (share/embed). Run after build_pringles_data.py. Needs Pillow."""
import json, os
from PIL import Image, ImageDraw, ImageFont
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
d = json.load(open(os.path.join(ROOT, "data", "pringles_index_2026-10.json"))); C = d["countries"]
pf = "/usr/share/fonts/truetype/sand-box/google/Playfair Display/PlayfairDisplay-VariableFont_wght.ttf"
sans = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"; sb = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
W = 1200; rowh = 34; top = 200; H = top + rowh * len(C) + 150
im = Image.new("RGB", (W, H), "#FFF8EC"); g = ImageDraw.Draw(im)
f = ImageFont.truetype(pf, 54); f.set_variation_by_name("Bold")
g.text((60, 50), "The World of Chips Pringles Index", font=f, fill="#3D2B0F")
g.text((60, 125), f"USD per 100 g of Pringles Original, regular shelf price, {d['meta']['edition']}. US = ${d['meta']['base_usd_per_100g']:.2f} (index 100).", font=ImageFont.truetype(sans, 22), fill="#6B5A3E")
mx = max(c["usd_per_100g"] for c in C); x0 = 330; bw = W - x0 - 140
for i, c in enumerate(C):
    y = top + i * rowh
    g.text((x0 - 15, y + 4), c["country"] + (" *" if c["confidence"] == "low" else ""), font=ImageFont.truetype(sb if c["iso2"] == "US" else sans, 20), fill="#1A1108", anchor="ra")
    w = int(bw * c["usd_per_100g"] / mx); col = "#3D2B0F" if c["iso2"] == "US" else ("#D44B2C" if c["index_vs_us"] > 100 else "#4A8C5C")
    g.rounded_rectangle([x0, y + 3, x0 + w, y + rowh - 7], radius=5, fill=col)
    g.text((x0 + w + 10, y + 4), f"${c['usd_per_100g']:.2f}", font=ImageFont.truetype(sans, 20), fill="#1A1108")
ux = x0 + int(bw * d["meta"]["base_usd_per_100g"] / mx); g.line([ux, top - 10, ux, top + rowh * len(C)], fill="#3D2B0F", width=2)
s17 = ImageFont.truetype(sans, 17)
g.text((60, H - 120), "* Low confidence: range, marketplace, undated or possibly promotional price.", font=s17, fill="#6B5A3E")
g.text((60, H - 95), "One main source per country, one point in time. FX: ECB 26 Oct 2026 and national sources.", font=s17, fill="#6B5A3E")
g.text((60, H - 60), "worldofchips.com/pringles-index/", font=ImageFont.truetype(sb, 24), fill="#C48A20")
im.save(os.path.join(ROOT, "assets", "pringles-index-2026-10.png"), optimize=True)
print("wrote assets/pringles-index-2026-10.png", W, H)
