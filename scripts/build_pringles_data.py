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
FX["RUB"] = 81.1255;  FX_SOURCE["RUB"] = "Bank of Russia official rate 2026-10-23 (myfin.by archive)"
FX["EGP"] = 55.38;    FX_SOURCE["EGP"] = "Egyptian bank rate 2026-10-23 (banker.news)"
FX["AED"] = 3.6725;   FX_SOURCE["AED"] = "UAE dirham fixed USD peg"

# ---------- Prices ----------
# price = regular (non-promo) shelf price for one can of Pringles Original, local currency, incl. VAT/GST
# where a market only had a promo or range, that is flagged in `price_type` and `confidence`.
ROWS = [
  # iso, country, region, currency, price, grams, retailer, price_type, observed, confidence, url, notes
  ("US","United States","North America","USD",2.38,147.4,"Walmart (regular price)","regular","2026-10","high",
   "https://www.walmart.com/ip/Pringles-Original-Potato-Crisps-Chips-Lunch-Snacks-5-2-oz-Canister/47217461","5.2 oz (147.4 g) can. Walmart regular (non-sale) price $2.38, checked 29 Oct 2026 (sale price $2.00 not used). Other regular prices: Target $2.49 (https://www.target.com/p/pringles-original-flavored-potato-crisps-chips-5-2oz/-/A-13053936), Kroger $2.50-2.59 (https://www.kroger.com/p/pringles-original-potato-crisps-chips/0003800013841). US shelf prices exclude sales tax. BASE COUNTRY."),
  ("CA","Canada","North America","CAD",2.97,148,"Walmart Canada","regular","2026-10","high",
   "https://www.walmart.ca/en/c/brand/pringles","Walmart.ca listing, $2.01/100g."),
  ("MX","Mexico","Latin America","MXN",54.00,134,"Walmart México","regular","2026-10","high",
   "https://www.walmart.com.mx/ip/papas-pringles-sabor-original-134-g/00750100806957","Soriana sells the 124 g can at the same MXN 54."),
  ("BR","Brazil","Latin America","BRL",13.49,104,"Drogaria Araujo","regular","2026-10","medium",
   "https://www.araujo.com.br/pringles","Marketplace listings (Magalu) range R$10.99-14.90."),
  ("GB","United Kingdom","Europe","GBP",2.50,165,"Tesco / Sainsbury's","regular","2026-10","high",
   "https://www.trolley.co.uk/product/pringles-original/XMH650","Heavily promoted: Morrisons/Iceland £1.75, Poundland £1.00."),
  ("DE","Germany","Europe","EUR",2.49,165,"Rossmann","regular","2026-10","high",
   "https://www.rossmann.de/de/lebensmittel-pringles-original-gesalzene-chips/p/5053990127726","€15.09/kg. REWE was €2.49 when it cut the can from 185 g to 165 g (2024, vzhh)."),
  ("NL","Netherlands","Europe","EUR",2.69,165,"Albert Heijn","regular","2026-10","high",
   "https://www.ah.nl/producten/product/wi233276","Normal price €16.30/kg; promo €1.69 at time of check."),
  ("ES","Spain","Europe","EUR",2.65,165,"Ahorramas","regular","2026-10","medium",
   "https://finditapp.es/product/297707/snack-de-patata-pringles-165g-original","Via Findit price aggregator."),
  ("FR","France","Europe","EUR",1.89,195,"Intermarché","regular","2026-08","medium",
   "https://www.promocatalogues.fr/offres/pringles/intermarche","'Prix habituel' from Intermarché 2+1 promos (Jul-Sep 2026: €5.67 for 3). Intermarché, Auchan and Leclerc sell a 195 g can; Carrefour sells 175 g at €2.05-2.09 (Open Prices, 2026), other chains €1.72-2.35 for 175 g."),
  ("IT","Italy","Europe","EUR",2.55,175,"U2 Supermercato","regular","unknown","low",
   "https://www.spesaonline.unes.it/u2/Dispensa-salata/Snack-salati-e-salse/Patatine-e-pop-corn/Pringles-Original-175-g/p/78775","€14.57/kg; listing currently out of stock, date unverified."),
  ("SE","Sweden","Europe","SEK",29.90,165,"Jula","regular","2026-10","medium",
   "https://www.jula.se/catalog/hem-och-hushall/dagligvaror/godis/notter/pringles-032787/","181.21 kr/kg. Jula is a hardware/variety chain."),
  ("DK","Denmark","Europe","DKK",28.00,165,"PriceRunner (lowest of 4 shops)","lowest_listed","2026-10","low",
   "https://www.pricerunner.dk/sp/pringles-chips.html","Lowest listed price; may be a promo."),
  ("CH","Switzerland","Europe","CHF",3.30,185,"Denner","regular","2026-10","high",
   "https://www.denner.ch/fr/actions-et-assortiment/pringles-chips-original~p1022736","CHF 1.78/100g, checked 29 Oct 2026. Lidl CHF 3.29, Müller CHF 3.25, Volg CHF 3.90 for the same 185 g can."),
  ("CZ","Czechia","Europe","CZK",95.90,165,"Rohlík","regular","2026-10","medium",
   "https://www.rohlik.cz/1294001-pringles-original-potato-chips","Discounted to CZK 79.90 at time of check."),
  ("HU","Hungary","Europe","HUF",1699,165,"Auchan / Tesco","regular","2026-10","high",
   "https://auchan.hu/shop/pringles-original-natur-snack-165-g.p-579820","Standard 165 g can, 1,699 Ft at Auchan and Tesco (https://bevasarlas.tesco.hu/shop/hu-HU/products/209563878), checked 29 Oct 2026. A smaller 125 g can also exists (1,499 Ft at Kifli, a higher per-100 g price); not used under the standard-can rule."),
  ("PL","Poland","Europe","PLN",17.81,165,"Kaufland.pl marketplace seller","marketplace","2026-10","low",
   "https://www.kaufland.pl/product/491849545/","Third-party seller on Kaufland marketplace, not a store shelf price."),
  ("TR","Turkey","Europe","TRY",325.00,165,"Trendyol","regular","2026-10","medium",
   "https://www.trendyol.com/pringles/original-sade-165-g-p-36822599","Checked 29 Oct 2026. Second source: Hepsiburada 345 TL (via Cimri, 27 Oct 2026). Online marketplace prices. Imported (Poland/Belgium); high inflation, price moves fast."),
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
  ("IN","India","Asia","INR",110,107,"Blinkit","mrp","2026-10","high",
   "https://blinkit.com/prn/pringles-original-potato-chips-crispy-snack/prid/594","MRP (legal max retail price) for the 107 g can, checked 29 Oct 2026. Blinkit sells at ₹101."),
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


# ---------- VAT / GST applied to potato crisps (checked 29 Oct 2026) ----------
# (rate %, status, basis, source). rate None = not confirmed -> no ex-VAT figure.
# US and CA shelf prices are shown before tax, so ex-tax = shelf (rate 0, basis "pre-tax shelf").
VAT = {
 "US": (0, "n/a", "Shelf price excludes state/local sales tax (varies by state; many states exempt groceries)", ""),
 "CA": (0, "n/a", "Shelf price excludes GST/HST (snack foods incl. potato chips are taxable at 5-15% at the till)", "https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/4-3/basic-groceries.html"),
 "TR": (1, "confirmed", "Reduced: KDV List I (A) item 16, all goods of HS chapter 20", "https://cdn.gib.gov.tr/api/gibportal-file/file/getFileResources?objectKey=arsiv%2Fyardim-kaynaklar%2Fyararli-bilgiler%2Fkdv-oranlari.pdf"),
 "HU": (27, "confirmed", "Standard rate; crisps not in the 5%/18% lists", "https://nav.gov.hu/ado/adozasi_kerdes/20261.-adozasi-kerdes---a-18-os-afakulcs-ala-tartozo-termekekrol"),
 "GB": (20, "confirmed", "Standard rate; potato crisps excepted from zero-rating (VAT Notice 701/14)", "https://www.gov.uk/guidance/food-products-and-vat-notice-70114"),
 "SE": (6, "confirmed", "Reduced food rate (6% from 1 Apr 2026)", "https://skatteverket.se/omoss/pressochmedia/nyheter/2026/nyheter/livsmedelsmomsensankstill6procent.5.70685bee19c85dd5dd0a3f.html"),
 "IN": (5, "confirmed", "GST 5% since 22 Sep 2025 (Notification 9/2025-Central Tax (Rate))", "https://d23z1tp9il9etb.cloudfront.net/download/gstlaw/09-2025-CTR-eng1758171501.pdf"),
 "DE": (7, "confirmed", "Reduced food rate (UStG Anlage 2)", "https://www.gesetze-im-internet.de/ustg_1980/anlage_2.html"),
 "FR": (5.5, "confirmed", "Reduced food rate (CGI art. 278-0 bis; crisps not in the 20% exclusions)", "https://bofip.impots.gouv.fr/bofip/2033-PGP.html/identifiant%3DBOI-TVA-LIQ-30-10-10-20251119"),
 "ES": (10, "confirmed", "Reduced 10% (processed foods not on the 4% list)", "https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/manual-iva-2026/capitulo-04-sujetos-pasivos-repercusion-impositivo/tipo-impositivo/tipo-impositivo-reducido-10-ciento.html"),
 "NL": (9, "confirmed", "Reduced food rate", "https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/btw/tarieven_en_vrijstellingen/goederen_9_btw/voedingsmiddelen/voedingsmiddelen"),
 "DK": (25, "confirmed", "Single standard rate; no reduced food rate", "https://info.skat.dk/data.aspx?oid=1921136"),
 "CH": (2.6, "confirmed", "Reduced rate for foodstuffs", "https://www.estv.admin.ch/en/vat-rates-switzerland"),
 "JP": (8, "confirmed", "Reduced consumption-tax rate for food (excl. alcohol, dining in)", "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shohi/6303.htm"),
 "AU": (10, "confirmed", "Standard GST; potato crisps not GST-free (GST Act Sch. 1 item 15)", "https://www.ato.gov.au/businesses-and-organisations/gst-excise-and-indirect-taxes/gst/in-detail/your-industry/gst-and-food/taxable-food"),
 "ID": (11, "confirmed", "PPN 12% on DPP of 11/12 = 11% effective (PMK 131/2024)", "https://www.pajak.go.id/index.php/id/artikel/pmk-1312024-tarif-ppn-sebelas-dua-belas"),
 "CN": (13, "confirmed", "Standard 13%; 9% covers only primary agricultural products", "https://fgk.chinatax.gov.cn/zcfgk/c102416/c5247431/5247431/files/%E9%80%82%E7%94%A89%E5%A2%9E%E5%80%BC%E7%A8%8E%E7%A8%8E%E7%8E%87%E8%B4%A7%E7%89%A9%E8%8C%83%E5%9B%B4%E6%B3%A8%E9%87%8A.pdf"),
 "ZA": (15, "confirmed", "Standard rate; crisps not on the zero-rated basic foods list (VAT Act Sch. 2 Part B)", "https://www.sars.gov.za/wp-content/uploads/Legal/Rulings/BGR/LAPD-IntR-R-BGR-2016-06-BGR35-VAT-treatment-of-the-supply-and-importation-of-frozen-potato-products.pdf"),
 "AE": (5, "confirmed", "Standard rate; food standard-rated", "https://tax.gov.ae/en/faq.aspx?keyword=What+is+the+standard+rate+of+VAT+in+the+UAE%3F"),
 "TH": (7, "confirmed", "Reduced VAT 7% (statutory 10%); processed food taxable", "https://www.rd.go.th/37821.html"),
 "PL": (5, "unconfirmed", "Likely 5% if classified CN 2005 20 (23% if CN 21); Pringles classification not confirmed", ""),
 "CZ": (12, "unconfirmed", "Likely reduced food rate 12% (official source not checked)", ""),
 "RU": (22, "unconfirmed", "Standard rate rose to 22% on 1 Jan 2026 (FNS); crisps assumed not on the 10% food list", "https://www.nalog.gov.ru/rn25/news/activities_fts/16596495/"),
 "NZ": (15, "unconfirmed", "Single GST rate 15% (IRD source not opened)", ""),
 "KR": (10, "unconfirmed", "Standard 10%; processed food taxable (NTS source not opened)", ""),
 "PH": (12, "unconfirmed", "Standard 12%; processed food taxable (BIR source not opened)", ""),
 "EG": (14, "unconfirmed", "Standard 14% (ETA source not opened)", ""),
 "IT": (None, "unconfirmed", "4% (plain potato + oil, Tabella A II n.6) or 10%; rate for Pringles not confirmed", "https://www.agenziaentrate.gov.it/portale/documents/20143/304451/Risoluzione+92+del+01102012_RIS+92e+del+01+10+12.pdf/1dfa8007-417f-dc36-7c61-32435619d0bf"),
 "MX": (None, "unconfirmed", "IVA 0% vs 16% for botanas not confirmed (IEPS 8% excise also applies to high-calorie snacks)", ""),
 "BR": (None, "unconfirmed", "ICMS/PIS/Cofins vary by state; no single rate", ""),
}

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
        "usd_per_100g": r(usd_100g, 4),
        "usd_per_165g_equiv": r(usd_100g * 1.65, 2),
        "index_vs_us": r(usd_100g / base_usd_100g * 100, 1),
        "implied_ppp_rate": r(implied_ppp, 4),
        "currency_valuation_pct": r((implied_ppp / fx - 1) * 100, 1),
        "retrieved": RETRIEVED,
    })
    rate, st, basis, src = VAT[x["iso2"]]
    x.update({"vat_rate_pct": rate, "vat_status": st, "vat_basis": basis, "vat_source": src,
              "usd_per_100g_ex_vat": None if rate is None else r(usd_100g / (1 + rate / 100), 4)})
for x in records:
    ev = x["usd_per_100g_ex_vat"]
    x["index_ex_vat_vs_us"] = None if ev is None else r(ev / base_usd_100g * 100, 1)

records.sort(key=lambda x: -x["usd_per_100g"])
for i, x in enumerate(records, 1):
    x["rank_most_expensive"] = i

OUT_COLS = ["rank_most_expensive","iso2","country","region","currency","local_price","pack_grams",
            "local_price_per_100g","fx_local_per_usd","usd_price_can","usd_per_100g","usd_per_165g_equiv",
            "index_vs_us","implied_ppp_rate","currency_valuation_pct","retailer","price_type",
            "price_observed","confidence","source_url","notes","fx_source","retrieved",
            "vat_rate_pct","vat_status","vat_basis","vat_source","usd_per_100g_ex_vat","index_ex_vat_vs_us"]

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
    "fx_date": "ECB reference rates, 26 Oct 2026 (RUB and EGP: national rates of 23 Oct 2026; AED: fixed USD peg)",
    "prices_collected": "27 Oct 2026; US, Hungary, Switzerland, India, France and Turkey re-checked 29 Oct 2026",
    "updated": "2026-10-29",
    "correction_note": "Updated 29 Oct 2026: corrected US base price source, Hungary pack size, removed Colombia.",
    "removed_note": "Colombia was removed on 29 Oct 2026 pending verification of pack size and regular price.",
    "pack_rule": "Use the market's standard can closest to 165 g, at the regular shelf price (not a promo or loyalty-card price).",
    "vat_note": "Ex-VAT view: shelf price / (1 + VAT rate on potato crisps). US and Canada shelf prices are already pre-tax, so ex-tax = shelf. Rates checked 29 Oct 2026 against tax-authority sources; unconfirmed rates are flagged and blank rates are left out of the ex-VAT index.",
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
