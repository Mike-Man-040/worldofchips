// Extra pages rendered by build_guides.mjs with the same template (header, footer, newsletter, CSS):
// make-chips-at-home cluster, spice ladder, flavour pages, limited-edition calendar and the chip quiz.
// Facts are sourced (see each page's Sources). Product links are Amazon searches for named models
// (Amazon served captchas, so single ASIN pages were not re-verified); no prices or specs are quoted.
import fs from 'node:fs';
import path from 'node:path';
import pringlesPage from './pringles_page.mjs';

const WP = (t) => `https://en.wikipedia.org/wiki/${t}`;
const FOOD52 = 'https://food52.com/recipes/18123-homemade-potato-chips';
const BBCGF_AIR = 'https://www.bbcgoodfood.com/recipes/air-fryer-crisps';
const BBC_CRISPS = 'https://www.bbc.co.uk/food/crisps';
const CK = { checked: '2026-10-27', checkedLabel: '27 October 2026' };
const SEARCH_NOTE = 'Links open an Amazon search for the named model, because single listings change often. Pick a listing sold by the brand or a reputable seller, and check the current model, size and price there.';

export default function morePages({ amazonSearch, esc, ROOT }) {
  const S = (q) => amazonSearch(q);
  const buy = (href, label) => `<a href="${esc(href)}" target="_blank" rel="sponsored nofollow noopener">${label}</a>`;
  const homeRelated = [['make-chips-at-home', '🥔 Make chips at home'], ['homemade-crisps-recipe', '📌 Homemade crisps recipe'], ['best-mandoline-slicers-for-chips', '🔪 Mandoline slicers'], ['best-deep-fryers-for-chips', '🍳 Deep fryers'], ['best-air-fryers-for-chips', '💨 Air fryers'], ['chip-seasoning-powders', '🧂 Chip seasonings']];
  const rel = (self) => homeRelated.filter(([s]) => s !== self);

  // ---------- make chips at home cluster ----------
  const cluster = [
    { slug: 'best-mandoline-slicers-for-chips', flag: '🔪', crumb: 'Mandoline Slicers', parent: ['make-chips-at-home', 'Make Chips at Home'],
      h1: 'Best Mandoline Slicers for Homemade Chips',
      title: 'Best Mandoline Slicers for Homemade Potato Chips (2026) | World of Chips',
      desc: 'Five well-known mandoline slicers for cutting paper-thin potato slices for homemade chips and crisps, from OXO and Benriner to KitchenAid, plus a pair of cut-resistant gloves.',
      introDark: 'Thin, even slices are the single biggest factor in crisp homemade chips.',
      intro: 'Recipe writers agree on the tool: the mandoline. Food52&#8217;s homemade potato chip recipe slices at a 1.3&#160;mm setting, and BBC Food recommends a mandoline &#8220;to get the thinnest possible slices&#8221;. Below are five widely sold mandolines plus cut-resistant gloves. We don&#8217;t quote prices or blade specs, because they change between model years and sellers; check the listing.',
      sections: [{ id: 'picks', h2: 'Mandolines to Consider', items: [
        ['OXO Good Grips Chef&#8217;s Mandoline Slicer', 'OXO&#8217;s full-size mandoline with a stand. A sensible pick if you want one tool for chips, fries and vegetables.', S('OXO Good Grips Chefs Mandoline Slicer')],
        ['OXO Good Grips V-Blade Mandoline Slicer', 'A V-shaped blade, which slices round potatoes from two angles at once. Compare it with the Chef&#8217;s model before buying.', S('OXO Good Grips V-Blade Mandoline Slicer')],
        ['Benriner Japanese Mandoline', 'The plastic-bodied Japanese slicer many cooks keep for paper-thin cuts. It&#8217;s compact, with fewer extras than the OXO models.', S('Benriner Japanese Mandoline Slicer')],
        ['KitchenAid Mandoline Slicer', 'A kitchen-brand option if you prefer to buy from a maker you already use.', S('KitchenAid Mandoline Slicer')],
        ['Mueller Multi Blade Mandoline', 'A budget-friendly multi-blade slicer that is widely sold on Amazon. Check the reviews of the current version before you buy.', S('Mueller mandoline slicer')],
        ['Cut-resistant kitchen gloves', 'Recipe writers stress always using the guard, and gloves add a second layer of protection. Pick a pair rated for cut resistance.', S('cut resistant gloves kitchen')],
      ] }],
      extra: `
    <section class="cp-section" id="tips">
      <h2>How to Use a Mandoline for Chips</h2>
      <ul class="sb-list">
        <li>Always use the hand guard. Food52 notes that you should leave the last stub of each potato for soup rather than risk your fingertips.</li>
        <li>Aim for very thin slices; Food52 uses a 1.3&#160;mm setting.</li>
        <li>Put the slices straight into cold water to rinse off surface starch, then dry them well. Our <a href="/homemade-crisps-recipe/">homemade crisps recipe</a> covers each step.</li>
      </ul>
    </section>`,
      faqs: [
        ['What thickness should homemade chips be?', 'Very thin. Food52&#8217;s homemade potato chip recipe uses a 1.3 mm mandoline setting, and BBC Food recommends the thinnest possible slices from a mandoline or a sharp peeler.'],
        ['Can I make chips without a mandoline?', 'Yes. BBC Food says a sharp potato peeler does a similar job if you don&#8217;t own a mandoline, though the slices are less even.'],
        ['Are mandolines dangerous?', 'The blades are very sharp. Always use the guard, and consider cut-resistant gloves.'],
      ],
      sources: [FOOD52, BBC_CRISPS], related: rel('best-mandoline-slicers-for-chips') },

    { slug: 'best-deep-fryers-for-chips', flag: '🍳', crumb: 'Deep Fryers', parent: ['make-chips-at-home', 'Make Chips at Home'],
      h1: 'Best Deep Fryers for Homemade Chips',
      title: 'Best Deep Fryers for Homemade Potato Chips & Crisps (2026) | World of Chips',
      desc: 'Five well-known home deep fryers for frying homemade potato chips at a steady 180°C/350°F, from T-fal and Cuisinart to the Presto FryDaddy, with safety tips.',
      introDark: 'A thermostat-controlled fryer keeps the oil at the 180°C (350°F) that chip recipes call for.',
      intro: 'Classic chip recipes fry thin slices in small batches at around 180&#160;&#176;C (350&#160;&#176;F). That is the temperature in Food52&#8217;s homemade potato chip recipe and BBC Good Food&#8217;s deep-fried matchstick chips. An electric deep fryer with a thermostat makes that easier to hold than a pan on the hob. Below are five widely sold fryers. We don&#8217;t quote capacities or prices, which differ by model and region.',
      sections: [{ id: 'picks', h2: 'Deep Fryers to Consider', items: [
        ['T-fal Ultimate EZ Clean Deep Fryer', 'Known for its built-in oil filtration and storage system, which drains and stores the oil after frying. Check the listing for the current model.', S('T-fal Ultimate EZ Clean deep fryer')],
        ['Presto FryDaddy Electric Deep Fryer', 'A long-running, simple, compact fryer. Look at the current listing for its temperature control, which is more basic than on larger fryers.', S('Presto FryDaddy electric deep fryer')],
        ['Cuisinart Deep Fryer', 'A stainless-steel countertop fryer from a major kitchen brand.', S('Cuisinart deep fryer stainless')],
        ['Hamilton Beach Professional-Style Deep Fryer', 'A basket fryer with an adjustable temperature dial. Hamilton Beach sells several sizes.', S('Hamilton Beach professional style deep fryer')],
        ['Breville Smart Fryer', 'A higher-end fryer from Breville; compare it with the others if you fry often.', S('Breville Smart Fryer')],
      ] }],
      extra: `
    <section class="cp-section" id="safety">
      <h2>Frying Safety</h2>
      <ul class="sb-list">
        <li>Dry the slices thoroughly. BBC Food warns that hot oil will spit unless the potatoes are as dry as possible.</li>
        <li>Fry in small batches so the chips don&#8217;t stick together (Food52), and never leave hot oil unattended (BBC Good Food).</li>
        <li>Prefer less oil? See our <a href="/best-air-fryers-for-chips/">air fryer guide</a>.</li>
      </ul>
    </section>`,
      faqs: [
        ['What temperature should I fry homemade chips at?', 'Around 180 °C (350 °F). That is the frying temperature in Food52&#8217;s homemade potato chip recipe and in BBC Good Food&#8217;s deep-fried matchstick chips.'],
        ['How long do thin crisps take to fry?', 'Very little time. Food52 says a minute or two, until the bubbling calms, and BBC Food warns that very thin slices can cook in 10 to 15 seconds, so watch them closely.'],
        ['Do I need a deep fryer?', 'No. A heavy pan and a thermometer work, but a thermostat-controlled fryer holds the temperature more easily. An air fryer is a lower-oil alternative.'],
      ],
      sources: [FOOD52, 'https://www.bbcgoodfood.com/recipes/matchstick-chips', BBC_CRISPS], related: rel('best-deep-fryers-for-chips') },

    { slug: 'best-air-fryers-for-chips', flag: '💨', crumb: 'Air Fryers', parent: ['make-chips-at-home', 'Make Chips at Home'],
      h1: 'Best Air Fryers for Homemade Chips',
      title: 'Best Air Fryers for Homemade Potato Chips & Crisps (2026) | World of Chips',
      desc: 'Five popular air fryers for making lower-oil homemade potato crisps, from Ninja and COSORI to Instant and Philips, with BBC Good Food\'s air-fryer crisp method.',
      introDark: 'Lower-oil crisps: thin slices, a little oil, a hot basket and a shake halfway through.',
      intro: 'BBC Good Food&#8217;s air-fryer crisps soak mandoline-thin slices in ice-cold water for 15 minutes and dry them thoroughly. The slices are tossed with a little oil and seasoning, then cooked at 210&#160;&#176;C for 12 to 15 minutes, with a shake halfway. Basket size matters most here, because the slices need to sit in a single layer. Below are five widely sold air fryers. We don&#8217;t quote capacities or prices; check the listing.',
      sections: [{ id: 'picks', h2: 'Air Fryers to Consider', items: [
        ['Ninja Air Fryer (AF101 and successors)', 'Ninja&#8217;s basic basket air fryer is one of the best-known models. Check which generation the listing is selling.', S('Ninja air fryer AF101')],
        ['Ninja Foodi DualZone Air Fryer', 'Two separate baskets, which lets you cook two batches of slices, or two seasonings, at the same time.', S('Ninja Foodi DualZone air fryer')],
        ['COSORI Pro LE Air Fryer', 'A popular COSORI basket model.', S('COSORI Pro LE air fryer')],
        ['Instant Vortex Plus Air Fryer', 'From the maker of the Instant Pot. Several sizes are sold under the Vortex name.', S('Instant Vortex Plus air fryer')],
        ['Philips Essential Airfryer', 'Philips&#8217; mainstream basket air fryer.', S('Philips Essential Airfryer')],
      ] }],
      extra: `
    <section class="cp-section" id="method">
      <h2>Air-Fryer Crisps in Brief</h2>
      <ul class="sb-list">
        <li>Slice thinly with a <a href="/best-mandoline-slicers-for-chips/">mandoline</a> and soak the slices in ice-cold water for 15 minutes.</li>
        <li>Pat them completely dry. BBC Good Food notes they won&#8217;t crisp if even slightly wet.</li>
        <li>Toss with a little oil and <a href="/chip-seasoning-powders/">seasoning</a>, then cook in a single layer at 210&#160;&#176;C for 12&#8211;15 minutes, shaking halfway.</li>
      </ul>
    </section>`,
      faqs: [
        ['Can you make crisps in an air fryer?', 'Yes. BBC Good Food&#8217;s method soaks thin slices in ice-cold water for 15 minutes, dries them thoroughly and tosses them with a little oil and seasoning. They cook at 210 °C for 12 to 15 minutes, shaken halfway.'],
        ['Why are my air-fryer crisps soggy?', 'Usually the slices were too thick, still wet or overlapping. Slice thinly, dry them well and cook in a single layer, in batches if needed.'],
        ['Which air fryer size is best for chips?', 'A larger basket fits more slices in one layer, which means fewer batches. Dual-basket models let you run two batches at once.'],
      ],
      sources: [BBCGF_AIR], related: rel('best-air-fryers-for-chips') },

    { slug: 'chip-seasoning-powders', flag: '🧂', crumb: 'Chip Seasonings', parent: ['make-chips-at-home', 'Make Chips at Home'],
      h1: 'Chip Seasoning Powders for Homemade Crisps',
      title: 'Chip Seasoning Powders: How to Flavour Homemade Crisps (2026) | World of Chips',
      desc: 'Six seasonings you can buy to flavour homemade potato chips, including Tajín, Old Bay, ranch seasoning, smoked paprika, salt & vinegar powder and popcorn seasonings, plus when to add them.',
      introDark: 'Season while the chips are still warm, so the powder sticks.',
      intro: 'Factory chips are seasoned in a tumbling drum straight after frying. At home, the equivalent is to toss warm chips in a bowl with the seasoning; BBC Food says to season crisps while they&#8217;re still warm. BBC Good Food&#8217;s air-fryer recipe suggests barbecue rub, garlic granules or paprika. Below are six widely sold seasonings that work on chips. Each one links to an Amazon search; check the ingredients and pack size on the listing.',
      sections: [{ id: 'picks', h2: 'Seasonings to Try', items: [
        ['Tajín Clásico Seasoning', 'Mexico&#8217;s chilli-lime-salt seasoning, close to the chile-and-lime chips in our <a href="/mexico/">Mexico guide</a>.', S('Tajin Clasico seasoning')],
        ['Old Bay Seasoning', 'The classic Chesapeake Bay seafood seasoning, also used on chips in the US. <a href="/united-states/">United States guide</a>.', S('Old Bay seasoning')],
        ['Ranch seasoning mix', 'Dry ranch mix (for example Hidden Valley) gives a ranch-style chip. Toss it on the chips sparingly, because the mixes are salty.', S('Hidden Valley ranch seasoning mix')],
        ['Smoked paprika', 'For a paprika chip like the ones popular in <a href="/germany/">Germany</a>, <a href="/netherlands/">the Netherlands</a> and <a href="/poland/">Poland</a>. See our <a href="/flavors/paprika/">paprika chips page</a>.', S('smoked paprika')],
        ['Salt &amp; vinegar seasoning powder', 'Vinegar powder gives the sharp tang of <a href="/flavors/salt-and-vinegar/">salt &amp; vinegar crisps</a> without making the chips soggy. Several brands sell it.', S('salt and vinegar seasoning powder')],
        ['Popcorn seasoning variety pack', 'Popcorn powders (for example Kernel Season&#8217;s) are finely ground, so they cling to chips well.', S('Kernel Seasons popcorn seasoning variety pack')],
      ] }],
      faqs: [
        ['When should I season homemade chips?', 'While they are still warm. BBC Food says to season crisps while they&#8217;re warm, and Food52 tosses the chips in a large bowl with the seasoning, flipping them to coat.'],
        ['How do I make salt and vinegar chips at home?', 'Liquid vinegar makes chips soggy, so use a vinegar powder or a salt &amp; vinegar seasoning and toss the chips while they are warm.'],
        ['What seasonings suit air-fryer crisps?', 'BBC Good Food suggests barbecue rub, garlic granules or paprika, tossed with the oiled slices before cooking.'],
      ],
      sources: [BBC_CRISPS, FOOD52, BBCGF_AIR], related: rel('chip-seasoning-powders') },
  ];

  const recipeLd = { '@type': 'Recipe', name: 'Homemade Potato Crisps (Chips)', image: ['https://worldofchips.com/assets/pins/homemade-crisps-pin.png'],
    description: 'Thin homemade potato crisps, deep-fried at 180°C or air-fried at 210°C, seasoned while warm.',
    author: { '@type': 'Organization', name: 'World of Chips' }, recipeCategory: 'Snack', recipeCuisine: 'International',
    keywords: 'homemade crisps, homemade potato chips, air fryer crisps', recipeYield: '2-4 servings as a snack',
    recipeIngredient: ['3 large floury potatoes (e.g. russet)', 'Vegetable, sunflower or canola oil for frying (or 3 tbsp for the air fryer)', 'Fine salt or seasoning of your choice'],
    recipeInstructions: [
      { '@type': 'HowToStep', name: 'Slice', text: 'Slice the potatoes very thinly with a mandoline, using the guard (about 1.3 mm).' },
      { '@type': 'HowToStep', name: 'Rinse', text: 'Put the slices in cold water to rinse off surface starch, then drain.' },
      { '@type': 'HowToStep', name: 'Dry', text: 'Pat the slices completely dry with a clean towel or kitchen paper.' },
      { '@type': 'HowToStep', name: 'Cook', text: 'Deep-fry small batches at 180°C (350°F) until light golden and the bubbling calms, about 1-2 minutes; or toss with a little oil and air-fry in a single layer at 210°C for 12-15 minutes, shaking halfway.' },
      { '@type': 'HowToStep', name: 'Season', text: 'Drain on a rack or paper and season while still warm.' },
    ] };

  const hubAndRecipe = [
    { slug: 'make-chips-at-home', flag: '🥔', crumb: 'Make Chips at Home', disc: true,
      h1: 'Make Chips at Home: Tools, Seasonings & Recipe',
      title: 'How to Make Potato Chips at Home: Tools, Seasonings & Recipe | World of Chips',
      desc: 'Everything you need to make potato chips and crisps at home: a step-by-step recipe, plus guides to mandoline slicers, deep fryers, air fryers and chip seasonings.',
      introDark: 'From potato to crisp in four steps: slice, rinse, dry, fry. Here&#8217;s the kit and the method.',
      intro: 'Homemade chips need very little: a way to slice potatoes paper-thin, a way to cook them hot and fast, and something to season them with. Start with the recipe, then use the guides below to choose your kit.',
      sections: [],
      body: `
    <section class="cp-section" id="what-you-need">
      <div style="background:var(--paper);border:1px solid var(--light-border);border-radius:12px;padding:1rem 1.2rem">
      <h2 style="margin-top:0">What You&#8217;ll Need</h2>
      <ul class="sb-list">
        <li><strong>Potatoes, oil and salt.</strong> See the <a href="/homemade-crisps-recipe/">homemade crisps recipe</a> for quantities and method.</li>
        <li><strong>A mandoline slicer</strong> for even, paper-thin slices: <a href="/best-mandoline-slicers-for-chips/">our mandoline guide</a> &#183; ${buy(S('OXO Good Grips Chefs Mandoline Slicer'), 'OXO Good Grips Chef&#8217;s Mandoline on Amazon')} &#183; ${buy(S('cut resistant gloves kitchen'), 'cut-resistant gloves on Amazon')}</li>
        <li><strong>A deep fryer</strong> (classic crisps): <a href="/best-deep-fryers-for-chips/">our deep fryer guide</a> &#183; ${buy(S('T-fal Ultimate EZ Clean deep fryer'), 'T-fal Ultimate EZ Clean on Amazon')}</li>
        <li><strong>Or an air fryer</strong> (less oil): <a href="/best-air-fryers-for-chips/">our air fryer guide</a> &#183; ${buy(S('Ninja air fryer AF101'), 'Ninja Air Fryer on Amazon')}</li>
        <li><strong>Seasoning</strong>: <a href="/chip-seasoning-powders/">our chip seasoning guide</a> &#183; ${buy(S('Tajin Clasico seasoning'), 'Taj&#237;n Cl&#225;sico on Amazon')} &#183; ${buy(S('smoked paprika'), 'smoked paprika on Amazon')}</li>
      </ul>
      <p class="sb-muted">${SEARCH_NOTE}</p>
      </div>
    </section>
    <section class="cp-section" id="guides">
      <h2>The Make-at-Home Guides</h2>
      <div class="cp-explore-grid">
        <a href="/homemade-crisps-recipe/" class="cp-explore-link">📌 Homemade crisps recipe</a>
        <a href="/best-mandoline-slicers-for-chips/" class="cp-explore-link">🔪 Best mandoline slicers</a>
        <a href="/best-deep-fryers-for-chips/" class="cp-explore-link">🍳 Best deep fryers</a>
        <a href="/best-air-fryers-for-chips/" class="cp-explore-link">💨 Best air fryers</a>
        <a href="/chip-seasoning-powders/" class="cp-explore-link">🧂 Chip seasoning powders</a>
      </div>
    </section>
    <section class="cp-section" id="basics">
      <h2>The Four Steps</h2>
      <ol class="sb-list">
        <li><strong>Slice</strong> very thin, ideally on a mandoline with the guard on.</li>
        <li><strong>Rinse</strong> the slices in cold water to remove surface starch.</li>
        <li><strong>Dry</strong> them thoroughly. Wet slices spit in hot oil and won&#8217;t crisp in an air fryer.</li>
        <li><strong>Cook</strong> in small batches (deep-fry at about 180&#160;&#176;C, or air-fry at 210&#160;&#176;C), then season while warm.</li>
      </ol>
      <p>Want to taste how the professionals season them? Browse our <a href="/flavors/">flavour pages</a>.</p>
    </section>`,
      faqs: [
        ['What potatoes are best for homemade chips?', 'Food52&#8217;s homemade potato chip recipe uses russet potatoes. BBC Good Food recommends floury varieties such as Maris Piper for fried chips.'],
        ['Is it cheaper to make chips at home?', 'It can be, but it depends on oil, energy and potato prices where you live, so we don&#8217;t quote a figure. The main reason to make them is control over thickness, oil and seasoning.'],
      ],
      sources: [FOOD52, BBC_CRISPS, BBCGF_AIR], related: rel('make-chips-at-home').concat([['flavors', '🌍 Chip flavours']]) },

    { slug: 'homemade-crisps-recipe', flag: '📌', crumb: 'Homemade Crisps Recipe', parent: ['make-chips-at-home', 'Make Chips at Home'],
      ogImage: '/assets/pins/homemade-crisps-pin.png', ldExtra: [recipeLd],
      h1: 'Homemade Potato Crisps Recipe (Fried or Air-Fried)',
      title: 'Homemade Potato Crisps Recipe: Fried or Air Fryer | World of Chips',
      desc: 'A simple homemade potato crisps (chips) recipe: slice thin, rinse, dry, then deep-fry at 180°C or air-fry at 210°C and season while warm. Pin-friendly step-by-step.',
      introDark: 'Four steps, two cooking methods, one very crunchy snack.',
      intro: 'This method follows two tested sources: Food52&#8217;s homemade potato chips (deep-fried) and BBC Good Food&#8217;s air-fryer crisps. We&#8217;ve condensed them into one card and credited both below.',
      sections: [],
      body: `
    <section class="cp-section" id="recipe">
      <h2>Recipe Card</h2>
      <p style="text-align:center"><img src="/assets/pins/homemade-crisps-pin.png" alt="Homemade potato crisps: slice thin, rinse, dry, fry in small batches, then salt" width="300" height="450" loading="lazy" style="border-radius:12px;max-width:100%;height:auto" data-pin-description="Homemade potato crisps recipe, fried or air-fried, from World of Chips"></p>
      <h3>Ingredients</h3>
      <ul class="sb-list">
        <li>3 large floury potatoes (Food52 uses russets)</li>
        <li>Oil for deep-frying, or about 3 tbsp for the air fryer</li>
        <li>Fine salt or a <a href="/chip-seasoning-powders/">chip seasoning</a></li>
      </ul>
      <h3>Equipment</h3>
      <ul class="sb-list">
        <li>A <a href="/best-mandoline-slicers-for-chips/">mandoline</a> (with guard) or a sharp peeler</li>
        <li>A <a href="/best-deep-fryers-for-chips/">deep fryer</a> or heavy pan with a thermometer, <em>or</em> an <a href="/best-air-fryers-for-chips/">air fryer</a></li>
      </ul>
      <h3>Method</h3>
      <ol class="sb-list">
        <li><strong>Slice</strong> the potatoes very thinly (Food52 uses a 1.3&#160;mm mandoline setting).</li>
        <li><strong>Rinse</strong>: cover the slices with cold water, swish and drain. For the air fryer, BBC Good Food soaks them in ice-cold water for 15 minutes.</li>
        <li><strong>Dry</strong> the slices completely in a clean towel.</li>
        <li><strong>Cook.</strong> <em>Deep-fried:</em> heat oil to 180&#160;&#176;C (350&#160;&#176;F) and fry in small batches for a minute or two, until light golden and the bubbling calms. <em>Air fryer:</em> toss with a little oil and seasoning, then cook in a single layer at 210&#160;&#176;C for 12&#8211;15 minutes, shaking halfway.</li>
        <li><strong>Season</strong> while warm. Food52 says the chips are best eaten the same day and keep for a day or two in an airtight container.</li>
      </ol>
      <p class="sb-muted">Hot oil is dangerous: never leave it unattended, and make sure the slices are dry before they go in.</p>
    </section>`,
      faqs: [
        ['Why soak potato slices before frying?', 'Rinsing or soaking removes surface starch. BBC Food says this helps make ultra-crunchy crisps, and drying the slices afterwards stops the hot oil from spitting.'],
        ['How long do homemade crisps keep?', 'Food52 says they are best eaten the day you make them but will keep for a day or two in an airtight container. BBC Food gives up to 2 to 3 days in a cool, dry place.'],
        ['Can I bake crisps instead?', 'Yes. BBC Food suggests baking dried slices with a little oil in a hot oven at 200 °C (390 °F, gas 6) until golden and crisp.'],
      ],
      sources: [FOOD52, BBCGF_AIR, BBC_CRISPS], related: rel('homemade-crisps-recipe') },
  ];

  // ---------- spice ladder ----------
  const rungs = [
    [1, 'Cape Cod Sweet &amp; Spicy Jalape&#241;o', 'Jalape&#241;o with a sweet touch on kettle chips. Jalape&#241;os usually measure 4,000&#8211;8,500 SHU as a pepper (Wikipedia).', 'dp:B0FBYHGB9L'],
    [2, 'Chip&#8217;s Jalape&#241;o (Barcel)', 'A straight jalape&#241;o-and-salt potato chip, sold by the brand as &#8220;bold, spicy&#8221;.', 'dp:B0GBYDCTXL'],
    [3, 'Pringles x Hot Ones Los Calientes Rojo', 'Built on the medium-spice jalape&#241;o and habanero Los Calientes Rojo hot sauce. Habaneros are rated 100,000&#8211;350,000 SHU as a pepper (Wikipedia).', 'dp:B0D9YF3CC2'],
    [4, 'Ruffles Flamin&#8217; Hot', 'Ridged chips with Frito-Lay&#8217;s Flamin&#8217; Hot seasoning. See our <a href="/flavors/flamin-hot/">Flamin&#8217; Hot history</a>.', 'dp:B073BYBQBJ'],
    [5, 'Takis Fuego', 'Chilli pepper and lime, rated &#8220;Extreme&#8221; on Takis&#8217; own Heat-O-Meter.', 'dp:B0D14XB2HR'],
    [6, 'Takis Blue Heat', 'Also rated &#8220;Extreme&#8221;; the listing says it &#8220;battles for our hottest snack&#8221;.', 'dp:B0G44XCDZL'],
    [7, 'Paqui Haunted Ghost Pepper chips', 'Tortilla chips seasoned with ghost pepper (bhut jolokia), measured at roughly 855,000&#8211;1,041,427 SHU as a pepper (Wikipedia). Availability varies, so this links to a search.', 'Paqui Haunted Ghost Pepper tortilla chips'],
    [8, 'Paqui One Chip Challenge (discontinued)', 'A single Carolina Reaper chip; Guinness certified the Reaper pepper at an average of 1,641,183 SHU in 2013. Paqui pulled the chip from sale in September 2023 after the death of a teenager who had eaten it, so there is no buy link. Don&#8217;t try to recreate it.', ''],
  ];
  const ladderItems = rungs.map(([n, name, note, h]) => {
    const btn = !h ? '' : h.startsWith('dp:') ? `<p><a href="https://www.amazon.com/dp/${h.slice(3)}?tag=worldofchips-20" target="_blank" rel="sponsored nofollow noopener" class="buy-btn">Buy on Amazon &#8594;</a></p>` : `<p>${buy(S(h), `Find ${name} on Amazon &#8594;`)}</p>`;
    return `<li data-heat="${n}"><strong>${n}. ${name}</strong><p>${note}</p>${btn}</li>`;
  }).join('\n        ');
  const spice = { slug: 'spiciest-chips', flag: '🌶️', crumb: 'Spice Ladder', ...CK,
    h1: 'Spiciest Chips Ranked by Heat: The Chip Spice Ladder',
    title: 'Spiciest Chips Ranked by Heat: Mild to One Chip Challenge | World of Chips',
    desc: 'A heat ranking, not a shopping list: eight spicy chips ranked on one ladder, from Cape Cod Sweet & Spicy Jalapeño through Takis Blue Heat to the discontinued Paqui One Chip Challenge, with pepper Scoville figures only where a source exists.',
    introDark: 'A heat ranking in eight rungs, from a gentle jalapeño kettle chip to the Carolina Reaper chip that was pulled from sale.',
    intro: 'Chip makers don&#8217;t publish Scoville ratings for their chips, so this is an <strong>editorial ranking</strong> of relative heat. It&#8217;s based on the peppers each chip uses and the makers&#8217; own heat claims. Where we quote Scoville heat units (SHU), they describe the <em>pepper</em>, not the finished chip, and come from the cited source. Disagree with the order? Good: tell us via the newsletter. Just want to order something hot? Our buying guide, <a href="/spiciest-chips-you-can-buy/">spicy chips to buy online</a>, lists seven picks with in-stock Amazon pages.',
    sections: [],
    body: `
    <section class="cp-section" id="ladder">
      <h2>The Ladder</h2>
      <p><label for="heat">Show rungs up to heat level <output id="heat-out" for="heat">8</output> of 8</label><br>
      <input type="range" id="heat" min="1" max="8" value="8" step="1" style="width:100%;max-width:360px;accent-color:var(--gold)"></p>
      <ol class="gd-picks" id="ladder-list" style="list-style:none;margin-left:0">
        ${ladderItems}
      </ol>
      <p class="sb-muted">Ranking: World of Chips editorial, ${'${LAST_CHECKED_LABEL}'}. Pepper Scoville figures: Wikipedia (Jalape&#241;o, Habanero, Bhut jolokia, Carolina Reaper). Heat claims: each product&#8217;s Amazon listing.</p>
    </section>`,
    script: `(function(){var r=document.getElementById('heat'),o=document.getElementById('heat-out'),li=document.querySelectorAll('#ladder-list li');function u(){o.textContent=r.value;for(var i=0;i<li.length;i++){li[i].style.display=(+li[i].getAttribute('data-heat')<=+r.value)?'':'none';}}r.addEventListener('input',u);u();})();`,
    faqs: [
      ['What is the spiciest chip ever sold?', 'The Paqui One Chip Challenge chip, made with Carolina Reaper (and later Naga Viper) peppers, was marketed as one of the hottest. Paqui withdrew it in September 2023 after a teenager died, so it is no longer sold.'],
      ['Do spicy chips have a Scoville rating?', 'Makers don&#8217;t publish Scoville ratings for their chips. Scoville figures on this page describe the peppers used, such as the jalape&#241;o or ghost pepper, not the finished chip.'],
      ['Are Takis hotter than Flamin&#8217; Hot chips?', 'Takis rates Fuego and Blue Heat as Extreme on its own Heat-O-Meter. We rank them above Ruffles Flamin&#8217; Hot, but that is our editorial judgement, not a lab measurement.'],
    ],
    sources: [WP('One_Chip_Challenge'), WP('Carolina_Reaper'), WP('Bhut_jolokia'), WP('Habanero'), WP('Jalape%C3%B1o')],
    related: [['spiciest-chips-you-can-buy', '🌶️ Spicy chips to buy online'], ['flavors/flamin-hot', '🔥 Flamin\u2019 Hot history'], ['mexico', '🇲🇽 Mexico'], ['which-chip-are-you', '❓ Which country\u2019s chip are you?']] };

  // ---------- flavour pages ----------
  const F = [
    { s: 'prawn-cocktail', n: 'Prawn Cocktail', flag: '🦐', countries: [['united-kingdom', '🇬🇧 United Kingdom']],
      lead: 'Prawn cocktail crisps are a sweet, tangy, tomato-and-seafood-sauce flavour and a fixture of British crisp aisles.',
      hist: 'Walkers introduced Prawn Cocktail in the 1970s, inspired by the prawn cocktail starter that was fashionable at the time. As of 2010 it ranked fourth among Walkers&#8217; flavours, after Cheese &amp; Onion, Ready Salted and Salt &amp; Vinegar. Ireland&#8217;s Tayto also sells a Prawn Cocktail crisp.',
      buy: 'Walkers Prawn Cocktail', src: [WP('Walkers_(snack_foods)'), WP('Tayto_(Republic_of_Ireland)')] },
    { s: 'ketchup', n: 'Ketchup', flag: '🍅', countries: [['canada', '🇨🇦 Canada']],
      lead: 'Ketchup chips are Canada&#8217;s signature flavour: tangy-sweet tomato, sugar and vinegar, closer to &#8220;inspired by ketchup&#8221; than the real thing.',
      hist: 'Ketchup chips appeared by the 1970s. Their Canadian introduction is usually credited to Hostess Potato Chips, which experimented with new flavours in the early 1970s. They are available in almost every Canadian grocery store. Supply in the United States is limited: Old Dutch stopped selling them there, and Frito-Lay doesn&#8217;t sell its ketchup chips in the US. Walkers made a Heinz-partnered ketchup crisp in the UK from 2001.',
      buy: 'ketchup potato chips Canada', src: [WP('Ketchup_chips')] },
    { s: 'salt-and-vinegar', n: 'Salt &amp; Vinegar', flag: '🧂', countries: [['united-kingdom', '🇬🇧 United Kingdom'], ['canada', '🇨🇦 Canada'], ['united-states', '🇺🇸 United States']],
      lead: 'Salt &amp; vinegar is the sharp, mouth-puckering classic, and in Britain it&#8217;s inseparable from fish and chips.',
      hist: 'In the UK, Smith&#8217;s answered Golden Wonder&#8217;s cheese &amp; onion with salt &amp; vinegar. It was tested first by its north-east England subsidiary Tudor and launched nationally in 1967, starting a two-decade flavour war. Walkers launched its own Salt and Vinegar in 1967, inspired by fish and chips. In a 2024 Perspectus Global survey of British crisp eaters, Walkers Salt &amp; Vinegar came third.',
      buy: 'salt and vinegar chips', src: [WP('Potato_chip'), WP('Walkers_(snack_foods)')] },
    { s: 'sour-cream-and-onion', n: 'Sour Cream &amp; Onion', flag: '🧅', countries: [['united-states', '🇺🇸 United States'], ['sweden', '🇸🇪 Sweden'], ['germany', '🇩🇪 Germany']],
      lead: 'Sour cream &amp; onion is creamy, tangy and oniony, and one of the best-selling chip flavours from the US to Scandinavia.',
      hist: 'We haven&#8217;t found a reliable source for the first sour cream &amp; onion chip, so we don&#8217;t give a date. The flavour mirrors America&#8217;s French onion (&#8220;California&#8221;) dip of sour cream and onion soup mix, which an unknown cook in Los Angeles created in 1954 and which is usually served with potato chips. Today it&#8217;s a signature flavour in our United States and Sweden guides, and Lay&#8217;s sells it in markets as far away as Indonesia.',
      buy: 'sour cream and onion chips', src: [WP('French_onion_dip'), WP('Lay%27s')] },
    { s: 'paprika', n: 'Paprika', flag: '🫑', countries: [['germany', '🇩🇪 Germany'], ['netherlands', '🇳🇱 Netherlands'], ['poland', '🇵🇱 Poland']],
      lead: 'Paprika chips are mild, sweet-smoky and red-dusted, and continental Europe&#8217;s answer to cheese &amp; onion.',
      hist: 'Paprika is a signature flavour in our Germany, Netherlands and Poland guides, and German Wikipedia notes that flavoured chips commonly use spices such as paprika. We haven&#8217;t found a reliable source for who sold the first paprika chip or when, so we don&#8217;t give one. Paprika chips are much less common in the UK and US, which is why expats often hunt for them online.',
      buy: 'paprika potato chips', src: ['https://de.wikipedia.org/wiki/Kartoffelchips'] },
    { s: 'nori-seaweed', n: 'Nori / Seaweed', flag: '🌊', countries: [['japan', '🇯🇵 Japan'], ['indonesia', '🇮🇩 Indonesia']],
      lead: 'Nori chips, Japan&#8217;s <em>norishio</em> (seaweed and salt), are savoury and oceanic, with flecks of green laver.',
      hist: 'Calbee introduced Potato Chips Nori-Shio in 1976 as its second-ever chip. In 2026, ahead of the flavour&#8217;s 50th anniversary, Calbee reworked the recipe after 171 test batches, switching its hidden umami note from scallop to bonito extract (see <a href="/news/#calbee-norishio-50th-anniversary-renewal">our news story</a>). Norishio is one of Japan&#8217;s standard chip flavours, and Lay&#8217;s sells a nori seaweed flavour in Indonesia.',
      buy: 'Calbee nori potato chips', src: ['https://www.calbee.co.jp/news/pdf/4283-23934.pdf', WP('Potato_chip'), WP('Lay%27s')] },
    { s: 'bbq', n: 'BBQ', flag: '🔥', countries: [['united-states', '🇺🇸 United States'], ['canada', '🇨🇦 Canada']],
      lead: 'Barbecue chips are smoky, sweet and savoury, and America&#8217;s oldest flavoured chip.',
      hist: 'Wikipedia traces the first flavoured chips in the United States, barbecue, to 1954. It also credits Herr&#8217;s with introducing barbecue-flavoured potato chips in Pennsylvania in 1958. BBQ remains a signature flavour in our United States guide, and versions are sold worldwide, from Walkers in the UK to Jack &#8217;n Jill in Hong Kong.',
      buy: 'BBQ potato chips', src: [WP('Potato_chip'), WP('Herr%27s')] },
    { s: 'dill-pickle', n: 'Dill Pickle', flag: '🥒', countries: [['canada', '🇨🇦 Canada'], ['united-states', '🇺🇸 United States']],
      lead: 'Dill pickle chips are vinegary, garlicky and herby: a North American cult favourite.',
      hist: 'Wikipedia lists dill pickle, with all-dressed and ketchup, among Canada&#8217;s regional chip varieties. Dill Pickle is also one of the unique flavours in our United States guide. We haven&#8217;t found a reliable first-launch date, so we don&#8217;t give one. Sweden has its own dill take: Dill &amp; Gr&#228;ddfil, a dill and sour cream chip.',
      buy: 'dill pickle potato chips', src: [WP('Potato_chip')] },
    { s: 'flamin-hot', n: 'Flamin&#8217; Hot', flag: '🌶️', countries: [['united-states', '🇺🇸 United States'], ['mexico', '🇲🇽 Mexico']],
      lead: 'Flamin&#8217; Hot is Frito-Lay&#8217;s red-dusted chilli seasoning, used on Cheetos, Lay&#8217;s, Ruffles, Doritos and more.',
      hist: 'Frito-Lay filed a trademark for Flamin&#8217; Hot in June 1990. From August 1990 it test-marketed spicy Lay&#8217;s, Cheetos, Fritos and Bakenets in Chicago, Detroit and Houston. Former Frito-Lay employee Richard Monta&#241;ez says he invented Flamin&#8217; Hot Cheetos, a story told in the 2023 film <em>Flamin&#8217; Hot</em>. Frito-Lay told the LA Times it does not credit the creation to him, and credits a team managed by Lynne Greenfeld.',
      buy: 'Flamin Hot chips', src: [WP('Flamin%27_Hot')] },
    { s: 'cheese-and-onion', n: 'Cheese &amp; Onion', flag: '🧀', countries: [['united-kingdom', '🇬🇧 United Kingdom']],
      lead: 'Cheese &amp; onion is where flavoured crisps began, and it&#8217;s still Britain&#8217;s favourite.',
      hist: 'In 1954, Joe &#8220;Spud&#8221; Murphy, owner of Ireland&#8217;s Tayto, developed a way to add cheese and onion seasoning during production, creating the first flavoured crisps. Walkers followed with its own Cheese and Onion, inspired by the ploughman&#8217;s lunch, and as of 2010 it was the brand&#8217;s most popular flavour. A 2024 Perspectus Global survey also put Walkers Cheese &amp; Onion first among British crisp eaters.',
      buy: 'cheese and onion crisps', src: [WP('Walkers_(snack_foods)'), WP('Tayto_(Republic_of_Ireland)')] },
  ];
  const plain = (s) => s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&amp;/g, '&');
  const flavorPages = F.map((f) => ({ slug: `flavors/${f.s}`, flag: f.flag, crumb: plain(f.n), parent: ['flavors', 'Flavours'], ...CK,
    h1: `${plain(f.n)} Chips: Origin, History & Where to Buy`,
    title: `${plain(f.n)} Chips: Where They Came From & Where to Buy | World of Chips`,
    desc: `${plain(f.lead.replace(/<[^>]+>/g, ''))} Sourced history, the countries that love it, and where to buy ${plain(f.n).toLowerCase()} chips online.`,
    introDark: f.lead, intro: f.lead, sections: [],
    body: `
    <section class="cp-section" id="history">
      <h2>Origin &amp; History</h2>
      <p>${f.hist}</p>
    </section>
    <section class="cp-section" id="countries">
      <h2>Where It&#8217;s Big</h2>
      <div class="cp-explore-grid">${f.countries.map(([s, l]) => `<a href="/${s}/" class="cp-explore-link">${l} chip guide</a>`).join('')}</div>
    </section>
    <section class="cp-section" id="buy">
      <h2>Where to Buy</h2>
      <p>Imported bags go in and out of stock, so this links to an Amazon search rather than a single listing. Check the pack size and seller.</p>
      <p><a href="${esc(S(f.buy))}" target="_blank" rel="sponsored nofollow noopener" class="buy-btn">Find ${plain(f.n)} chips on Amazon &#8594;</a></p>
      <p>Want to make your own? Try our <a href="/homemade-crisps-recipe/">homemade crisps recipe</a> and <a href="/chip-seasoning-powders/">seasoning guide</a>.</p>
    </section>`,
    faqs: [
      [`Where did ${plain(f.n).toLowerCase()} chips come from?`, f.hist.replace(/<[^>]+>/g, '').split(/(?<=\.)\s/).slice(0, 2).join(' ')],
      [`Where can I buy ${plain(f.n).toLowerCase()} chips?`, `In shops in ${f.countries.map(([, l]) => l.replace(/^\S+\s/, '')).join(', ')}, and online through importers and Amazon sellers. Stock changes often, so check the pack size and seller before ordering.`],
    ],
    sources: f.src,
    related: [['flavors', '🌍 All chip flavours'], ...F.filter((x) => x.s !== f.s).slice(0, 3).map((x) => [`flavors/${x.s}`, `${x.flag} ${plain(x.n)}`])],
  }));
  const flavorIndex = { slug: 'flavors', flag: '🌍', crumb: 'Flavours', ...CK,
    h1: 'Chip Flavours of the World',
    title: 'Chip Flavours of the World: Origins & Where to Buy | World of Chips',
    desc: 'One page per classic chip flavour, from prawn cocktail and ketchup to nori, paprika and Flamin\' Hot, with sourced origin stories and where to buy them.',
    introDark: 'The stories behind the flavours in our ticker, with sources.',
    intro: 'Every country has a flavour it can&#8217;t live without. Each page below covers where a flavour came from (with sources, and no invented dates), the countries that love it most, and where to buy it.',
    sections: [], disc: true,
    body: `
    <section class="cp-section" id="all-flavors">
      <h2>All Flavour Pages</h2>
      <div class="cp-explore-grid">${F.map((f) => `<a href="/flavors/${f.s}/" class="cp-explore-link">${f.flag} ${f.n}</a>`).join('')}</div>
      <p style="margin-top:1rem">Like it hot? Climb the <a href="/spiciest-chips/">chip spice ladder</a>.</p>
    </section>`,
    faqs: [['What was the first flavoured crisp?', 'Cheese and onion. In 1954 Joe &#8220;Spud&#8221; Murphy of Ireland&#8217;s Tayto developed a way to add cheese and onion seasoning during production (Wikipedia, Walkers article).'], ['What flavour of chips is most popular in the UK?', 'Cheese &amp; onion. It was Walkers&#8217; most popular flavour as of 2010, and a 2024 Perspectus Global survey of British crisp eaters also put it first.']],
    sources: [WP('Walkers_(snack_foods)')], related: [['spiciest-chips', '🌶️ Spice ladder'], ['limited-edition-chips', '📅 Limited-edition drops'], ['make-chips-at-home', '🥔 Make chips at home']] };

  // ---------- limited-edition calendar (data/limited_editions.json) ----------
  const drops = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'limited_editions.json'), 'utf8')).sort((a, b) => b.date.localeCompare(a.date));
  const names = {}; for (const d of drops) { const p = path.join(ROOT, d.country, 'index.html'); if (!fs.existsSync(p)) throw new Error(`limited_editions.json: unknown country ${d.country}`); names[d.country] = (fs.readFileSync(p, 'utf8').match(/<span class="cp-flag">([^<]+)<\/span>/) || [, ''])[1] + ' ' + d.country.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' '); }
  const months = [...new Set(drops.map((d) => d.date.slice(0, 7)))];
  const mLabel = (ym) => new Date(`${ym}-01T00:00:00Z`).toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const calBody = months.map((ym) => {
    const inM = drops.filter((d) => d.date.startsWith(ym));
    const byC = [...new Set(inM.map((d) => d.country))];
    return `
    <section class="cp-section" id="m-${ym}">
      <h2>${mLabel(ym)}</h2>
      ${byC.map((c) => `<h3 style="font-size:1rem;color:var(--brown);margin-top:1rem"><a href="/${c}/">${esc(names[c])}</a></h3>
      <ul class="sb-list">
        ${inM.filter((d) => d.country === c).map((d) => `<li><strong>${esc(d.when)}</strong>: ${esc(d.brand)} ${esc(d.product)}. ${esc(d.note)} <span class="sb-muted">Source: <a href="${esc(d.source_url)}" target="_blank" rel="nofollow noopener">${esc(d.source_name)}</a>${d.news_id ? ` &#183; <a href="/news/#${esc(d.news_id)}">our story</a>` : ''}</span></li>`).join('\n        ')}
      </ul>`).join('\n      ')}
    </section>`;
  }).join('');
  const lastDrop = drops.map((d) => d.date).filter((d) => d <= CK.checked).sort().pop();
  const calendar = { slug: 'limited-edition-chips', flag: '📅', crumb: 'Limited-Edition Drops', ...CK, disc: false,
    h1: 'Limited-Edition Chip Drop Calendar',
    title: 'Limited-Edition Chip Calendar 2026: New & Seasonal Flavour Drops | World of Chips',
    desc: 'A running calendar of limited-edition and new chip flavours by month and country, from Lay\'s Holi-LAY\'S to KETTLE festive editions and Korean collaborations, each with a source.',
    introDark: 'New and limited-edition chips by month and country, updated weekly from our news desk.',
    intro: `Each entry links to its source and, where we covered it, to our news story. Dates are on-shelf dates from the source. Where the source only reported a launch, we show &#8220;Reported&#8221; with the article date. The calendar is updated weekly (${drops.length} drops listed; last checked ${CK.checkedLabel}). Know a launch we missed? Reply to the newsletter.`,
    sections: [], body: calBody,
    faqs: [['How often is the limited-edition calendar updated?', 'Weekly, from launches covered by our news desk and from brand press releases and trade press. Every entry carries its source.'], ['What are the Lay\'s holiday flavours for 2026?', 'According to PepsiCo, the Holi-LAY\'S lineup is Cheddar Scalloped-Style Potatoes and Roasted Holiday Turkey (25 October), Maple Bacon (8 November), and chocolate-covered Wavy Milk Chocolate and Dubai-Style Dark Chocolate at select retailers from 1 December.']],
    nlEarly: 'Get the monthly drop calendar', sources: [], related: [['news', '📰 Chip news'], ['flavors', '🌍 Chip flavours'], ['spiciest-chips', '🌶️ Spice ladder']] };
  void lastDrop;

  // ---------- quiz ----------
  const Q = [
    ['Pick a Saturday-night snack mood:', [['Something sharp and tangy', 'united-kingdom canada'], ['Big, bold and spicy', 'mexico thailand'], ['Delicate and savoury', 'japan spain'], ['Sweet-meets-salty', 'south-korea united-states']]],
    ['Your ideal dip or topping:', [['Malt vinegar', 'united-kingdom'], ['Lime and chilli', 'mexico'], ['Seaweed and salt', 'japan'], ['Honey butter', 'south-korea'], ['Ketchup', 'canada'], ['Paprika', 'germany']]],
    ['Where would you rather eat chips?', [['At the pub', 'united-kingdom germany'], ['At a street-food stall', 'mexico thailand india'], ['On a bullet train', 'japan'], ['Tailgating before a game', 'united-states canada'], ['With tapas and a drink', 'spain']]],
    ['Pick a texture:', [['Ultra-thin and light', 'japan spain'], ['Thick, crunchy kettle', 'united-states united-kingdom'], ['Rolled and dense', 'mexico'], ['Wavy', 'india germany']]],
    ['How hot can you go?', [['No heat, please', 'spain japan germany'], ['A gentle kick', 'united-kingdom canada south-korea'], ['Properly spicy', 'india thailand'], ['Bring the fire', 'mexico united-states']]],
  ];
  const R = { 'united-kingdom': ['🇬🇧', 'a British crisp', 'Sharp, tangy and pub-ready: think cheese &amp; onion and salt &amp; vinegar.'], canada: ['🇨🇦', 'a Canadian ketchup chip', 'Tangy, a little sweet and proudly regional.'], mexico: ['🇲🇽', 'a Mexican chile-lime chip', 'Bold, loud and spicy, from Takis to Sabritas.'], japan: ['🇯🇵', 'a Japanese nori chip', 'Subtle, savoury and precise.'], 'south-korea': ['🇰🇷', 'a Korean honey butter chip', 'Sweet-meets-salty and a little bit viral.'], 'united-states': ['🇺🇸', 'an American kettle chip', 'Big flavours and crunch, from BBQ to Flamin\u2019 Hot.'], germany: ['🇩🇪', 'a German paprika chip', 'Mild, smoky-sweet and reliable.'], spain: ['🇪🇸', 'a Spanish olive-oil chip', 'Simple, salty and made for tapas.'], thailand: ['🇹🇭', 'a Thai tom yum chip', 'Hot, sour and fragrant.'], india: ['🇮🇳', 'an Indian Magic Masala chip', 'Spiced, tangy and moreish.'] };
  for (const s of Object.keys(R)) if (!fs.existsSync(path.join(ROOT, s, 'index.html'))) throw new Error(`quiz result /${s}/ missing`);
  const quizBody = `
    <section class="cp-section" id="quiz">
      <h2>Take the Quiz</h2>
      <form id="chip-quiz">
        ${Q.map(([q, opts], i) => `<fieldset style="border:1px solid var(--light-border);border-radius:12px;padding:.9rem 1rem;margin-bottom:.8rem;background:var(--paper)"><legend style="font-weight:700;color:var(--brown);padding:0 .3rem">${i + 1}. ${q}</legend>
          ${opts.map(([l, v], j) => `<label style="display:block;margin:.3rem 0;cursor:pointer"><input type="radio" name="q${i}" value="${v}"${j ? '' : ' required'}> ${l}</label>`).join('\n          ')}
        </fieldset>`).join('\n        ')}
        <p><button type="submit" class="buy-btn" style="border:0;cursor:pointer">Show my chip &#8594;</button></p>
      </form>
      <div id="quiz-result" class="gd-picks" hidden style="margin-left:0"></div>
    </section>
    <noscript><p>The quiz needs JavaScript. Browse the <a href="/#countries">country guides</a> instead.</p></noscript>`;
  const quizScript = `(function(){var R=${JSON.stringify(R)};var f=document.getElementById('chip-quiz'),out=document.getElementById('quiz-result');
function link(path,text,cls){var a=document.createElement('a');a.setAttribute('href',path);a.textContent=text;if(cls)a.className=cls;return a;}
function show(k,push){var r=R[k];if(!r)return;out.innerHTML='';var h=document.createElement('h3');h.style.fontFamily="'Playfair Display',serif";h.style.color='var(--brown)';h.textContent=r[0]+' You are '+r[1].replace(/&amp;/g,'&')+'!';var p=document.createElement('p');p.innerHTML=r[2];
var g=document.createElement('p');g.appendChild(link('/'+k+'/','Read your country guide and where to buy \u2192','buy-btn'));
var u=location.origin+'/which-chip-are-you/r/'+k+'/';var s=document.createElement('p');var b=document.createElement('button');b.type='button';b.className='cp-explore-link';b.style.cursor='pointer';b.textContent='Share my result';
b.addEventListener('click',function(){if(navigator.share){navigator.share({title:'Which country\u2019s chip are you?',url:u}).catch(function(){});}else if(navigator.clipboard){navigator.clipboard.writeText(u);b.textContent='Link copied!';}});
s.appendChild(b);s.appendChild(document.createTextNode(' '));s.appendChild(link(location.pathname,'Retake the quiz','cp-explore-link'));
out.appendChild(h);out.appendChild(p);out.appendChild(g);out.appendChild(s);out.hidden=false;if(push&&history.replaceState)history.replaceState(null,'','?r='+k);out.scrollIntoView({behavior:'smooth',block:'start'});}
f.addEventListener('submit',function(e){e.preventDefault();var sc={},best=null;var d=new FormData(f);d.forEach(function(v){v.split(' ').forEach(function(c){sc[c]=(sc[c]||0)+1;});});
Object.keys(sc).forEach(function(c){if(!best||sc[c]>sc[best])best=c;});show(best,true);});
var m=location.search.match(/[?&]r=([a-z-]+)/);if(m)show(m[1],false);})();`;
  const quiz = { slug: 'which-chip-are-you', flag: '❓', crumb: 'Chip Quiz', ...CK, disc: false,
    h1: 'Which Country\u2019s Chip Are You?',
    title: 'Quiz: Which Country\'s Chip Are You? | World of Chips',
    desc: 'Five quick questions match you to a country\'s signature chip, from British salt & vinegar to Korean honey butter, then take you to that country\'s chip guide. Shareable result link.',
    introDark: 'Five questions. Ten countries. One chip that is unmistakably you.',
    intro: 'Answer five quick questions and we&#8217;ll match you to a country&#8217;s signature chip, then send you to that country&#8217;s guide, with brands, flavours and where to buy. Your result gets its own link to share. Just for fun: the matching is our own light-hearted scoring.',
    sections: [], body: quizBody, script: quizScript,
    faqs: [['How does the chip quiz work?', 'Each answer adds points to one or more countries, and the country with the most points is your result. The scoring is our own light-hearted editorial mapping, not a scientific test.'], ['Can I share my quiz result?', 'Yes. Your result gets its own link (for example worldofchips.com/which-chip-are-you/r/japan/) that opens straight to the same result.']],
    sources: [], related: [['flavors', '🌍 Chip flavours'], ['spiciest-chips', '🌶️ Spice ladder'], ['make-chips-at-home', '🥔 Make chips at home']], quizResults: R };


  // ---------- community flavour submission (FormSubmit.co, no backend) ----------
  const countryOpts = fs.readdirSync(ROOT).filter((d) => /cp-facts/.test(fs.existsSync(path.join(ROOT, d, 'index.html')) ? fs.readFileSync(path.join(ROOT, d, 'index.html'), 'utf8') : ''))
    .sort().map((d) => d.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' '));
  const fld = 'display:block;width:100%;max-width:520px;padding:.55rem .7rem;border:1px solid var(--light-border);border-radius:8px;font:inherit;background:#fff;margin:.25rem 0 .9rem';
  const lab = (id, text, input) => `<label for="${id}" style="font-weight:700;color:var(--brown);font-size:.9rem">${text}</label>\n        ${input}`;
  const submitBody = `
    <section class="cp-section" id="thanks" hidden>
      <h2>Thank you!</h2>
      <p>Your flavour is in our inbox. We review every submission by hand and will add approved finds to the map and the country page, with credit if you gave a name or handle.</p>
    </section>
    <section class="cp-section" id="form">
      <h2>Submit a Flavour</h2>
      <form action="https://formsubmit.co/michaelvdlooij@mail.grokbot.com" method="POST" enctype="multipart/form-data" id="flavor-form">
        <input type="hidden" name="_subject" value="New World of Chips flavour submission">
        <input type="hidden" name="_captcha" value="true">
        <input type="hidden" name="_template" value="table">
        <input type="hidden" name="_next" value="https://worldofchips.com/submit-a-flavor/?sent=1">
        <input type="text" name="_honey" tabindex="-1" autocomplete="off" aria-hidden="true" style="display:none">
        ${lab('f-credit', 'Name or handle for credit (optional)', `<input id="f-credit" name="credit" type="text" maxlength="60" style="${fld}">`)}
        ${lab('f-country', 'Country', `<input id="f-country" name="country" type="text" list="f-countries" required maxlength="60" style="${fld}"><datalist id="f-countries">${countryOpts.map((c) => `<option value="${c}"></option>`).join('')}</datalist>`)}
        ${lab('f-city', 'City (optional)', `<input id="f-city" name="city" type="text" maxlength="60" style="${fld}">`)}
        ${lab('f-flavor', 'Flavour or chip name', `<input id="f-flavor" name="flavor" type="text" required maxlength="80" style="${fld}">`)}
        ${lab('f-brand', 'Brand', `<input id="f-brand" name="brand" type="text" required maxlength="60" style="${fld}">`)}
        ${lab('f-desc', 'Short description (what does it taste like, where did you find it?)', `<textarea id="f-desc" name="description" required maxlength="500" rows="4" style="${fld}"></textarea>`)}
        ${lab('f-photo', 'Photo of the bag (JPG or PNG, max 10 MB)', `<input id="f-photo" name="attachment" type="file" accept="image/jpeg,image/png,image/webp" required style="${fld}">`)}
        ${lab('f-email', 'Email (optional, only to ask you a question; never published)', `<input id="f-email" name="email" type="email" maxlength="120" style="${fld}">`)}
        <label style="display:block;margin:.3rem 0 1rem;font-size:.9rem"><input type="checkbox" name="consent" value="yes" required> I took this photo and allow World of Chips to publish it with credit</label>
        <p><button type="submit" class="buy-btn" style="border:0;cursor:pointer">Send my flavour &#8594;</button></p>
        <p class="sb-muted">Submissions are sent by email via FormSubmit.co and reviewed by hand before anything is published. We only publish the name or handle you enter above.</p>
      </form>
    </section>`;
  const submit = { slug: 'submit-a-flavor', flag: '📸', crumb: 'Add Your Local Flavour', ...CK, disc: false,
    h1: 'Add Your Local Flavour to the Map',
    title: 'Add Your Local Chip Flavour to the World of Chips Map | World of Chips',
    desc: 'Spotted a local chip flavour we are missing? Send us a photo and a few details. Approved finds appear on the Global Chip Map and the country page, credited to you.',
    introDark: 'Found a chip flavour we haven&#8217;t covered? Snap the bag and tell us about it.',
    intro: 'Every approved submission gets a &#8220;Community finds&#8221; spot on the <a href="/#map-section">Global Chip Map</a> and on its country page, credited to the name or handle you choose. We check each entry by hand, so it can take a few days to appear.',
    sections: [], body: submitBody,
    script: `(function(){if(/[?&]sent=1/.test(location.search)){document.getElementById('thanks').hidden=false;document.getElementById('form').hidden=true;}})();`,
    faqs: [['How do I add a chip flavour to World of Chips?', 'Fill in the form on this page with the brand, flavour, country and a photo of the bag you took yourself. We review submissions by hand and add approved ones to the map and the country page.'], ['Will my email address be published?', 'No. Email is optional and only used if we have a question. We publish only the name or handle you enter for credit, or no name if you leave it blank.']],
    sources: [], related: [['flavors', '🌍 Chip flavours'], ['limited-edition-chips', '📅 Limited-edition drops'], ['which-chip-are-you', '❓ Chip quiz']] };

  // ---------- shrinkflation tracker (data/shrinkflation.json) ----------
  const SH = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'shrinkflation.json'), 'utf8'));
  const cname = (slug) => slug.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
  for (const c of SH.cases) { for (const k of ['year', 'country', 'brand', 'product', 'old', 'new', 'source_name', 'source_url']) if (!c[k]) throw new Error(`shrinkflation.json: case missing ${k}`); if (!fs.existsSync(path.join(ROOT, c.country, 'index.html'))) throw new Error(`shrinkflation.json: unknown country ${c.country}`); }
  const srcA = (c) => c.source_url.startsWith('/') ? `<a href="${esc(c.source_url)}">${esc(c.source_name)}</a>` : `<a href="${esc(c.source_url)}" target="_blank" rel="nofollow noopener">${esc(c.source_name)}</a>`;
  const shRows = SH.cases.map((c) => `<tr><th scope="row">${esc(c.brand)} ${esc(c.product)}</th><td><a href="/${esc(c.country)}/">${esc(cname(c.country))}</a></td><td>${esc(c.old)}</td><td>${esc(c.new)}</td><td>${c.pct.toFixed(1)}%</td><td>${esc(c.year)}</td><td>${esc(c.note)} ${srcA(c)}</td></tr>`).join('\n          ');
  const biggest = [...SH.cases].sort((a, b) => a.pct - b.pct)[0];
  const shrink = { slug: 'shrinkflation', flag: '📉', crumb: 'Shrinkflation Tracker', ...CK, disc: false,
    h1: 'The Chip Shrinkflation Tracker',
    title: 'Chip Shrinkflation Tracker: Lay\'s, Walkers, Pringles & More, Sourced | World of Chips',
    desc: `A sourced log of chip and crisp packs that got smaller: ${SH.cases.length} cases from Lay's, Walkers, Pringles, Doritos and others in the UK, US, Germany and the Netherlands, with old and new sizes.`,
    introDark: 'Same price, fewer crisps. Every case below links to its source.',
    intro: `Shrinkflation is when a pack gets smaller while the price stays the same or rises. This is a curated log of chip and crisp cases reported by consumer groups and the press, with the old and new size, the year and the source. It lists ${SH.cases.length} cases so far; the change percentages are worked out from the sizes shown. Seen a pack shrink? <a href="/submit-a-flavor/">Tell us</a>.`,
    sections: [],
    body: `
    <section class="cp-section" id="cases">
      <h2>The Log</h2>
      <div class="sb-table-wrap">
      <table class="sb-table">
        <thead><tr><th scope="col">Product</th><th scope="col">Country</th><th scope="col">Before</th><th scope="col">After</th><th scope="col">Change</th><th scope="col">Year</th><th scope="col">Notes &amp; source</th></tr></thead>
        <tbody>
          ${shRows}
        </tbody>
      </table>
      </div>
      <p class="sb-muted">Pack counts (multipacks) are shown where the source reports bags rather than grams. ShrinkRadar entries link to its Lay&#8217;s page, which cites the original consumer-group or press source shown in brackets.</p>
    </section>
    <section class="cp-section" id="background">
      <h2>The Bigger Picture</h2>
      <ul class="sb-list">
        ${SH.background.map((b) => `<li>${esc(b.text)} <span class="sb-muted">Source: <a href="${esc(b.source_url)}" target="_blank" rel="nofollow noopener">${esc(b.source_name)}</a></span></li>`).join('\n        ')}
      </ul>
      <p>Comparing prices across countries instead? See the <a href="/pringles-index/">Pringles Index</a>, which compares every country per 100 g.</p>
    </section>`,
    faqs: [
      ['What is shrinkflation?', 'Shrinkflation is when a product gets smaller, or a multipack loses items, while the price stays the same or rises, so you pay more per gram.'],
      ['Have Lay\'s bags got smaller?', 'Yes, in several markets. For example, Verbraucherzentrale Hamburg recorded German Lay\'s Paprika going from 175 g to 150 g in 2022, and Mouseprint recorded a US Lay\'s bag going from 15.25 oz to 13 oz in 2020 (both via ShrinkRadar).'],
      ['What is the biggest chip shrinkflation case in the log?', `${biggest.brand} ${biggest.product} (${cname(biggest.country)}, ${biggest.year}), which went from ${biggest.old} to ${biggest.new}, a change of ${biggest.pct.toFixed(1)}%.`],
    ],
    sources: [], related: [['pringles-index', '📊 Pringles Index'], ['limited-edition-chips', '📅 Limited-edition drops'], ['united-kingdom', '🇬🇧 United Kingdom']] };

  return [...hubAndRecipe, ...cluster.map((g) => ({ ...CK, ...g })), spice, flavorIndex, ...flavorPages, calendar, quiz, submit, pringlesPage({ esc, ROOT, CK }), shrink].map((g) => ({ ...CK, ...g }));
}
