"""Build the World of Chips Pringles Index (Oct 2026) from hand-collected retailer prices.

Outputs: data/pringles_index_2026-10.csv, data/pringles_index_2026-10.json (run from anywhere).
Then run `node scripts/build_guides.mjs` to rebuild /pringles-index/.

Changes vs Michael's original (2026-10-27): India pack size 102 g -> 107 g (the BigBasket source URL
and listing are "Pringles Original 107 g"); outputs written to data/; methodology_note points to
docs/PRINGLES_INDEX_BRIEF.md.
"""
import csv, json, os
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")

RETRIEVED = "2026-10-27"

# ---------- FX: units of local currency per 1 USD ----------
# ECB euro reference rates, 26 Oct 2026 (via Banca d'Italia), units per 1 EUR
ECB_EUR = {
    "USD": 1.1188, "JPY": 176.15, "CZK": 24.369, "DKK": 7.4747, "GBP": 0.83820,
    "HUF": 367.45, "PLN": 4.4038, "SEK": 11.1385, "CHF": 0.9243, "NOK": 10.4545,
    "TRY": 55.6746, "AUD": 1.5927, "BRL": 6.2523, "CAD": 1.5695, "CNY": 7.4603,
    "IDR": 20320.32, "INR": 106.4935, "KRW": 1482.72, "MXN": 20.8271,
    "NZD": 1.9695, "PHP": 71.540, "SGD": 1.4327, "THB": 37.821, "ZAR": 18.6046,
}
FX = {c: r / ECB_EUR["USD"] for c, r in ECB_EUR.items()}
FX["USD"] = 1.0
FX["EUR"] = 1 / ECB_EUR["USD"]
FX_SOURCE = {c: "ECB reference rate 2026-10-26 (cross via EUR/USD 1.1188)" for c in FX}
FX_SOURCE["USD"] = "base"
# Currencies not covered by the ECB set
FX["COP"] = 3158.43;  FX_SOURCE["COP"] = "Colombia TRM 2026-10-26 (dolarhoy.co)"
FX["RUB"] = 81.1255;  FX_SOURCE["RUB"] = "Bank of Russia official rate 2026-10-23 (myfin.by archive)"
FX["EGP"] = 55.38;    FX_SOURCE["EGP"] = "Egyptian bank rate 2026-10-23 (banker.news)"
FX["AED"] = 3.6725;   FX_SOURCE["AED"] = "UAE dirham fixed USD peg"

# ---------- Prices ----------
# price = regular (non-promo) shelf price for one can of Pringles Original, local currency, incl. VAT/GST
# where a market only had a promo or range, that is flagged in `price_type` and `confidence`.
ROWS = [
  # iso, country, region, currency, price, grams, retailer, price_type, observed, confidence, url, notes
  ("US","United States","North America","USD",2.27,147.4,"Walmart","regular","2026-10","high",
   "https://www.walmart.com/ip/17979017291","5.2 oz can. US shelf prices exclude sales tax. BASE COUNTRY."),
  ("CA","Canada","North America","CAD",2.97,148,"Walmart Canada","regular","2026-10","high",
   "https://www.walmart.ca/en/c/brand/pringles","Walmart.ca listing, $2.01/100g."),
  ("MX","Mexico","Latin America","MXN",54.00,134,"Walmart México","regular","2026-10","high",
   "https://www.walmart.com.mx/ip/papas-pringles-sabor-original-134-g/00750100806957","Soriana sells the 124 g can at the same MXN 54."),
  ("BR","Brazil","Latin America","BRL",13.49,104,"Drogaria Araujo","regular","2026-10","medium",
   "https://www.araujo.com.br/pringles","Marketplace listings (Magalu) range R$10.99-14.90."),
  ("CO","Colombia","Latin America","COP",13300,124,"Éxito","regular","2026-10","high",
   "https://www.exito.com/papas-original-901873/p","Promo price COP 8,645 at time of check; Mercacentro COP 16,200."),
  ("GB","United Kingdom","Europe","GBP",2.50,165,"Tesco / Sainsbury's","regular","2026-10","high",
   "https://www.trolley.co.uk/product/pringles-original/XMH650","Heavily promoted: Morrisons/Iceland £1.75, Poundland £1.00."),
  ("DE","Germany","Europe","EUR",2.49,165,"Rossmann","regular","2026-10","high",
   "https://www.rossmann.de/de/lebensmittel-pringles-original-gesalzene-chips/p/5053990127726","€15.09/kg. REWE was €2.49 when it cut the can from 185 g to 165 g (2024, vzhh)."),
  ("NL","Netherlands","Europe","EUR",2.69,165,"Albert Heijn","regular","2026-10","high",
   "https://www.ah.nl/producten/product/wi233276","Normal price €16.30/kg; promo €1.69 at time of check."),
  ("ES","Spain","Europe","EUR",2.65,165,"Ahorramas","regular","2026-10","medium",
   "https://finditapp.es/product/297707/snack-de-patata-pringles-165g-original","Via Findit price aggregator."),
  ("FR","France","Europe","EUR",1.89,195,"Intermarché","regular","2026-08","medium",
   "https://www.promocatalogues.fr/offres/pringles/intermarche","'Prix habituel' from a 2+1 promo (Jul-Aug 2026: €5.67 for 3). French can is 195 g."),
  ("IT","Italy","Europe","EUR",2.55,175,"U2 Supermercato","regular","unknown","low",
   "https://www.spesaonline.unes.it/u2/Dispensa-salata/Snack-salati-e-salse/Patatine-e-pop-corn/Pringles-Original-175-g/p/78775","€14.57/kg; listing currently out of stock, date unverified."),
  ("SE","Sweden","Europe","SEK",29.90,165,"Jula","regular","2026-10","medium",
   "https://www.jula.se/catalog/hem-och-hushall/dagligvaror/godis/notter/pringles-032787/","181.21 kr/kg. Jula is a hardware/variety chain."),
  ("DK","Denmark","Europe","DKK",28.00,165,"PriceRunner (lowest of 4 shops)","lowest_listed","2026-10","low",
   "https://www.pricerunner.dk/sp/pringles-chips.html","Lowest listed price; may be a promo."),
  ("CH","Switzerland","Europe","CHF",3.30,185,"Coop","regular","2026-10","medium",
   "https://www.coop.ch/en/food/sweets-snacks/crisps-snacks/crisps-popcorn/plain-crisps/pringles-original/p/7253883","CHF 1.78/100g. Volg sells the same can at CHF 3.90."),
  ("CZ","Czechia","Europe","CZK",95.90,165,"Rohlík","regular","2026-10","medium",
   "https://www.rohlik.cz/1294001-pringles-original-potato-chips","Discounted to CZK 79.90 at time of check."),
  ("HU","Hungary","Europe","HUF",1499,125,"Kifli","regular","2026-10","medium",
   "https://www.kifli.hu/en-HU/122699-pringles-original","Hungarian listing is a 125 g can."),
  ("PL","Poland","Europe","PLN",17.81,165,"Kaufland.pl marketplace seller","marketplace","2026-10","low",
   "https://www.kaufland.pl/product/491849545/","Third-party seller on Kaufland marketplace, not a store shelf price."),
  ("TR","Turkey","Europe","TRY",325.00,165,"Trendyol","regular","2026-10","medium",
   "https://www.trendyol.com/pringles-cips-x-b107770-c103949","Akakçe lowest of 4 sellers was 345 TL on 2026-09-10. Imported; high inflation, price moves fast."),
  ("RU","Russia","Europe","RUB",399,165,"VkusVill","regular","2026-10","medium",
   "https://vkusvill.ru/goods/chipsy-kartofelnye-pringles-original-165-g-79909/",""),
  ("AU","Australia","Oceania","AUD",5.50,134,"Coles","regular","2026-10","high",
   "https://www.coles.com.au/product/pringles-original-salted-stacked-potato-chips-134g-2784047","$4.10/100g; frequently on special at $4.00 or half price."),
  ("NZ","New Zealand","Oceania","NZD",4.19,134,"Pak'nSave","regular","2026-10","medium",
   "https://www.paknsave.co.nz/shop/product/5092356_ea_000pns","$3.13/100g. Pak'nSave is a discount banner."),
  ("JP","Japan","Asia","JPY",240,105,"Market range (supermarket/drugstore)","estimate_midpoint","2026-04","low",
   "https://www.pricey.jp/web/articles/2393","Pringles Japan has no RRP (open pricing). Reported range ¥200-280 for the 105 g M-can; midpoint used."),
  ("KR","South Korea","Asia","KRW",3690,110,"11st (single-can listing)","regular","unknown","low",
   "https://www.11st.co.kr/products/1578768215","Multi-pack prices on Coupang/Kurly work out to roughly ₩1,700-1,900 per can."),
  ("CN","China","Asia","CNY",8.50,110,"JD.com Pringles flagship","regular","unknown","low",
   "https://www.cnpp.cn/focus/233044.html","From a product ranking page; date not shown."),
  ("IN","India","Asia","INR",110,107,"BigBasket","mrp","2026-10","high",
   "https://www.bigbasket.com/pd/100550/pringles-original-107-g/","MRP (legal max retail price). BigBasket sells at ₹99."),
  ("ID","Indonesia","Asia","IDR",27600,107,"Indomaret","regular","2026-06","medium",
   "https://www.hemat.id/katalog-indomaret/pringles./","'Harga normal' at KlikIndomaret; promos down to ~Rp19,900."),
  ("TH","Thailand","Asia","THB",62.00,102,"Big C","regular","2026-10","high",
   "https://www.bigc.co.th/product/pringles-potato-chips-original-flavor-102-g.932",""),
  ("PH","Philippines","Asia","PHP",98.75,107,"Watsons","regular","2026-10","medium",
   "https://www.watsons.com.ph/pringles-original-107g/p/BP_10082521",""),
  ("ZA","South Africa","Africa","ZAR",68.99,165,"Clicks","regular","2026-10","high",
   "https://clicks.co.za/pringles_potato-chips-original-165g/p/384733","Promo 2 for R110 until 23 Nov 2026."),
  ("EG","Egypt","Africa","EGP",149.99,165,"Carrefour Egypt","regular","2026-10","medium",
   "https://www.carrefouregypt.com/mafegy/en/c/FEGY1730101",""),
  ("AE","United Arab Emirates","Middle East","AED",12.95,165,"Lulu Hypermarket","regular","2026-10","medium",
   "https://gcc.luluhypermarket.com/en-ae/pringles-original-chips-165-g/p/22635",""),
]

COLS = ["iso2","country","region","currency","local_price","pack_grams","retailer","price_type",
        "price_observed","confidence","source_url","notes"]

# Markets with a price but no sourced FX rate, or too weak to include -> backlog for the agent
BACKLOG = [
  {"iso2":"TW","country":"Taiwan","currency":"TWD","local_price":62,"pack_grams":102,"retailer":"PX Mart (regular price)","source_url":"https://uptogo.com.tw/美食/一罐品客多少錢？/","reason":"Need a TWD/USD rate"},
  {"iso2":"CL","country":"Chile","currency":"CLP","local_price":2520,"pack_grams":104,"retailer":"Jumbo","source_url":"https://www.jumbo.cl/pringles","reason":"Need a CLP/USD rate"},
  {"iso2":"PK","country":"Pakistan","currency":"PKR","local_price":1099,"pack_grams":165,"retailer":"foodpanda mart (imported)","source_url":"https://www.foodpanda.pk/groceries/product/EG9HJ3/pringles-original-165g","reason":"Need a PKR/USD rate"},
  {"iso2":"KW","country":"Kuwait","currency":"KWD","local_price":0.795,"pack_grams":165,"retailer":"Lulu","source_url":"https://gcc.luluhypermarket.com/en-kw/pringles-original-chips-165-g/p/22635/","reason":"Need a KWD/USD rate"},
  {"iso2":"OM","country":"Oman","currency":"OMR","local_price":0.990,"pack_grams":165,"retailer":"Lulu","source_url":"https://gcc.luluhypermarket.com/en-om/pringles-original-chips-165-g/p/22635/","reason":"Need an OMR/USD rate"},
  {"iso2":"NG","country":"Nigeria","currency":"NGN","local_price":1500,"pack_grams":165,"retailer":"GoMed (pharmacy, 'last known price')","source_url":"https://gomed.ng/p/9828-pringles-original-165g","reason":"Only an outdated price found"},
  {"iso2":"BE","country":"Belgium","currency":"EUR","local_price":1.93,"pack_grams":165,"retailer":"Belgian supermarket test (DH)","source_url":"https://www.dhnet.be/conso/consommation/2025/04/21/le-grand-test-des-marques-les-chips-pringles-et-leur-tube-mythique-sont-mis-face-a-la-concurrence-comparatif-FO6UR75C2BFQ7N46PSNKVI643M/","reason":"April 2025, too old"},
  {"iso2":"AR","country":"Argentina","currency":"ARS","local_price":None,"pack_grams":None,"retailer":None,"source_url":None,"reason":"No price found"},
  {"iso2":"PE","country":"Peru","currency":"PEN","local_price":None,"pack_grams":None,"retailer":None,"source_url":None,"reason":"No price found"},
  {"iso2":"NO","country":"Norway","currency":"NOK","local_price":None,"pack_grams":None,"retailer":None,"source_url":None,"reason":"No price found"},
  {"iso2":"SG","country":"Singapore","currency":"SGD","local_price":None,"pack_grams":None,"retailer":None,"source_url":None,"reason":"Only multipacks found"},
]

def r(x, n=2):
    return None if x is None else round(x, n)

records = [dict(zip(COLS, row)) for row in ROWS]
base = next(x for x in records if x["iso2"] == "US")
base_usd_100g = base["local_price"] / base["pack_grams"] * 100

for x in records:
    fx = FX[x["currency"]]
    usd_can = x["local_price"] / fx
    usd_100g = usd_can / x["pack_grams"] * 100
    local_100g = x["local_price"] / x["pack_grams"] * 100
    # Big Mac-style: implied PPP rate makes the per-100g price equal to the US one
    implied_ppp = local_100g / base_usd_100g
    x.update({
        "fx_local_per_usd": r(fx, 4),
        "fx_source": FX_SOURCE[x["currency"]],
        "usd_price_can": r(usd_can, 2),
        "local_price_per_100g": r(local_100g, 2),
        "usd_per_100g": r(usd_100g, 3),
        "usd_per_165g_equiv": r(usd_100g * 1.65, 2),
        "index_vs_us": r(usd_100g / base_usd_100g * 100, 1),
        "implied_ppp_rate": r(implied_ppp, 4),
        "currency_valuation_pct": r((implied_ppp / fx - 1) * 100, 1),
        "retrieved": RETRIEVED,
    })

records.sort(key=lambda x: -x["usd_per_100g"])
for i, x in enumerate(records, 1):
    x["rank_most_expensive"] = i

OUT_COLS = ["rank_most_expensive","iso2","country","region","currency","local_price","pack_grams",
            "local_price_per_100g","fx_local_per_usd","usd_price_can","usd_per_100g","usd_per_165g_equiv",
            "index_vs_us","implied_ppp_rate","currency_valuation_pct","retailer","price_type",
            "price_observed","confidence","source_url","notes","fx_source","retrieved"]

with open(os.path.join(OUT, "pringles_index_2026-10.csv"), "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=OUT_COLS)
    w.writeheader()
    for x in records:
        w.writerow({k: x[k] for k in OUT_COLS})

meta = {
    "title": "World of Chips Pringles Index",
    "edition": "2026-10",
    "retrieved": RETRIEVED,
    "product": "Pringles Original, one standard can (size varies by market)",
    "base_country": "US",
    "base_usd_per_100g": round(base_usd_100g, 3),
    "fx_date": "2026-10-26 (ECB); COP 2026-10-26; RUB/EGP 2026-10-23; AED peg",
    "methodology_note": "See docs/PRINGLES_INDEX_BRIEF.md",
    "countries_published": len(records),
}
with open(os.path.join(OUT, "pringles_index_2026-10.json"), "w", encoding="utf-8") as f:
    json.dump({"meta": meta,
               "countries": [{k: x[k] for k in OUT_COLS} for x in records],
               "backlog": BACKLOG,
               "fx_local_per_usd": {k: round(v, 4) for k, v in sorted(FX.items())}},
              f, ensure_ascii=False, indent=2)

print(f"base US $/100g = {base_usd_100g:.3f}")
print(f"{'#':>2} {'country':22} {'$/can':>6} {'$/100g':>7} {'idx':>6} {'val%':>7} conf")
for x in records:
    print(f"{x['rank_most_expensive']:>2} {x['country']:22} {x['usd_price_can']:>6} {x['usd_per_100g']:>7} "
          f"{x['index_vs_us']:>6} {x['currency_valuation_pct']:>7} {x['confidence']}")
