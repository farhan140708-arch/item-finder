const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

const SERPAPI_KEY = process.env.SERPAPI_KEY;

// ---------- category guessing ----------
// Extend this list as you find items that fall back to a raw item-name search.
// Keys are matched as substrings against the lowercased item text.
// `category` is used to switch on special handling (gender wording, brand
// preference, marketplace filtering) - leave it undefined for categories
// that don't need any of that.
const CATEGORY_HINTS = [
  { kw: ['chair', 'desk', 'sofa', 'couch', 'table', 'furniture', 'shelf', 'lamp', 'mattress', 'wardrobe'], term: 'furniture store' },
  { kw: ['phone', 'laptop', 'charger', 'headphone', 'earbud', 'camera', 'tv', 'electronics', 'monitor', 'speaker', 'cable'], term: 'electronics store' },
  { kw: ['computer', 'gaming', 'console', 'graphics card', 'keyboard', 'mouse'], term: 'computer store' },
  { kw: ['perfume', 'fragrance', 'cologne', 'attar'], term: 'perfume shop' },
  { kw: ['makeup', 'cosmetic', 'skincare', 'lipstick'], term: 'cosmetics store' },
  { kw: ['book', 'novel', 'textbook'], term: 'bookstore' },
  { kw: ['shoe', 'sneaker', 'trainer', 'boot', 'sandal', 'heels'], term: 'shoe store', category: 'shoes' },
  { kw: ['clothing', 'shirt', 't-shirt', 'tshirt', 'dress', 'jacket', 'trouser', 'jeans', 'suit', 'hoodie', 'skirt', 'coat', 'sweater', 'jumper', 'blazer', 'abaya', 'kandura', 'top', 'blouse', 'shorts'], term: 'clothing store', category: 'clothing' },
  { kw: ['tool', 'hardware', 'drill', 'screw', 'paint', 'nail', 'ladder'], term: 'hardware store' },
  { kw: ['medicine', 'pharmacy', 'supplement', 'vitamin', 'first aid'], term: 'pharmacy' },
  { kw: ['flower', 'bouquet', 'plant', 'succulent'], term: 'florist' },
  { kw: ['bike', 'bicycle', 'helmet'], term: 'bicycle shop' },
  { kw: ['car part', 'tyre', 'tire', 'battery', 'motor oil'], term: 'auto parts store' },
  { kw: ['jewelry', 'jewellery', 'ring', 'necklace', 'bracelet'], term: 'jewelry store' },
  { kw: ['watch'], term: 'watch shop' },
  { kw: ['glasses', 'sunglasses', 'eyewear', 'contact lens'], term: 'optician' },
  { kw: ['baby', 'stroller', 'crib', 'diaper'], term: 'baby store' },
  { kw: ['pet', 'dog', 'cat', 'aquarium', 'fish tank'], term: 'pet store' },
  { kw: ['garden', 'lawn', 'pot', 'soil', 'seeds'], term: 'garden centre' },
  { kw: ['kitchen', 'cookware', 'pan', 'pot set', 'utensil'], term: 'kitchenware store' },
  { kw: ['appliance', 'fridge', 'washing machine', 'microwave', 'oven', 'vacuum'], term: 'appliance store' },
  { kw: ['sport', 'gym', 'fitness', 'dumbbell', 'yoga mat', 'football', 'basketball'], term: 'sporting goods store' },
  { kw: ['guitar', 'piano', 'violin', 'drum', 'instrument'], term: 'music store' },
  { kw: ['art supply', 'paint brush', 'canvas', 'craft'], term: 'art supply store' },
  { kw: ['luggage', 'suitcase', 'backpack'], term: 'luggage store' },
  { kw: ['stationery', 'notebook', 'pen', 'pencil'], term: 'stationery store' },
  { kw: ['toy', 'lego', 'puzzle', 'board game'], term: 'toy store' },
  { kw: ['wine', 'liquor', 'beer', 'whisky', 'whiskey'], term: 'liquor store' },
  { kw: ['party', 'balloon', 'decoration'], term: 'party supply store' },
];

function guessCategoryInfo(item) {
  const lower = item.toLowerCase();
  for (const group of CATEGORY_HINTS) {
    if (group.kw.some((k) => lower.includes(k))) return group;
  }
  // Fallback: search the item text itself. Google is often smart enough to
  // surface something relevant even without a category hint.
  return { term: item, category: undefined };
}

// ---------- gender / apparel customization ----------
const GENDER_WORDING = {
  men: "men's",
  women: "women's",
  kids: "kids'",
  unisex: '',
  '': '',
};

function isApparel(categoryInfo) {
  return categoryInfo.category === 'clothing' || categoryInfo.category === 'shoes';
}

// Puts the gender word in front of the item only when it's actually
// clothing/shoes - a "men's" desk lamp would be nonsense, so gender is
// silently ignored for every other category.
function buildItemQuery(item, gender, categoryInfo) {
  if (isApparel(categoryInfo) && gender && GENDER_WORDING[gender]) {
    return `${GENDER_WORDING[gender]} ${item}`.trim();
  }
  return item;
}

// ---------- real clothing/shoe retailers, split by price tier ----------
// Used two ways: (1) to backfill a search that came back thin on real
// brand results, and (2) to label results with a tier badge so someone
// with a bigger budget still sees cheaper options alongside pricier ones,
// not just "the most expensive thing that fits."
const RETAILER_TIERS = {
  clothing: {
    budget: ['H&M', 'Zara', 'Uniqlo', 'Bershka', 'Pull&Bear', 'Mango', 'Primark', 'ASOS', 'Shein', 'Next'],
    premium: ['COS', 'Massimo Dutti', '& Other Stories', 'Sandro', 'Maje', 'Reiss', 'Ted Baker', 'Ralph Lauren', 'Hugo Boss', 'Tommy Hilfiger'],
  },
  shoes: {
    budget: ['Nike', 'Adidas', 'Puma', 'Skechers', 'New Balance', 'Foot Locker'],
    premium: ["Clarks", "Dr. Martens", 'Cole Haan', 'Church\'s', 'Salvatore Ferragamo'],
  },
};

// Marketplaces that turn up in Google Shopping for almost anything but
// aren't how people actually buy clothes - filtered out for apparel only.
const MARKETPLACE_BLOCKLIST = ['amazon', 'ebay', 'aliexpress', 'wish.com', 'alibaba', 'temu', 'ubuy', 'walmart', 'kogan', 'ozon', 'newegg', 'noon', 'jumia'];

function isMarketplaceSource(source) {
  const s = (source || '').toLowerCase();
  return MARKETPLACE_BLOCKLIST.some((m) => s.includes(m));
}

function classifyTier(source, categoryInfo) {
  const tiers = RETAILER_TIERS[categoryInfo.category];
  if (!tiers) return null;
  const s = (source || '').toLowerCase();
  if (tiers.budget.some((b) => s.includes(b.toLowerCase()))) return 'everyday';
  if (tiers.premium.some((p) => s.includes(p.toLowerCase()))) return 'premium';
  return null;
}

// ---------- tiny in-memory cache ----------
// Best-effort only: on Netlify this survives just for the life of a warm
// function instance, not across all users or deploys. It still cuts real
// API cost/latency for repeat searches within that window. For a durable
// shared cache across all users, swap this for Netlify Blobs or Redis.
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const cache = new Map();

function cacheKey(item, budget, currency, location, gender) {
  return [item.toLowerCase(), budget || '', currency, location.toLowerCase(), gender || ''].join('|');
}

function getCached(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.time > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

function setCached(key, value) {
  cache.set(key, { value, time: Date.now() });
}

// ---------- nearby (SerpAPI Google Local - no Google Cloud billing needed) ----------

async function searchNearby(item, location, gender, categoryInfo) {
  if (!SERPAPI_KEY) {
    return { searchTerm: null, results: [], disabled: true };
  }

  // Search the shop category (e.g. "women's clothing store"), not the exact
  // item - that's what actually finds real shops on Google Local.
  const searchTerm = buildItemQuery(categoryInfo.term, gender, categoryInfo);

  const url = new URL('https://serpapi.com/search.json');
  url.searchParams.set('engine', 'google_local');
  url.searchParams.set('q', searchTerm);
  url.searchParams.set('location', location);
  url.searchParams.set('api_key', SERPAPI_KEY);

  const res = await fetch(url).then((r) => r.json());
  if (res.error) throw new Error(`Google Local search failed: ${res.error}`);

  const local = res.local_results || [];
  const results = local.slice(0, 8).map((p) => ({
    name: p.title,
    address: p.address || null,
    phone: p.phone || null,
    website: p.links?.website || null,
    mapsUrl: p.gps_coordinates
      ? `https://www.google.com/maps/search/?api=1&query=${p.gps_coordinates.latitude},${p.gps_coordinates.longitude}`
      : p.place_id
      ? `https://www.google.com/maps/place/?q=place_id:${p.place_id}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.title + ' ' + location)}`,
    lat: p.gps_coordinates?.latitude ?? null,
    lng: p.gps_coordinates?.longitude ?? null,
    hours: p.hours || null,
    rating: p.rating ?? null,
  }));

  return { searchTerm, results };
}

// ---------- online (SerpAPI Google Shopping) ----------

// Currency the user picked -> country code SerpAPI should search from.
// Google Shopping shows prices in the currency used in that country, so this
// is what actually controls whether you get $ or AED back, not the currency
// code alone.
const CURRENCY_TO_COUNTRY = {
  USD: 'us',
  AED: 'ae',
  GBP: 'gb',
  EUR: 'de',
  INR: 'in',
};

async function fetchShopping(q, gl, location) {
  const url = new URL('https://serpapi.com/search.json');
  url.searchParams.set('engine', 'google_shopping');
  url.searchParams.set('q', q);
  url.searchParams.set('gl', gl);
  url.searchParams.set('location', location);
  url.searchParams.set('api_key', SERPAPI_KEY);

  const res = await fetch(url).then((r) => r.json());
  const shoppingResults = res.shopping_results || [];

  return shoppingResults
    .map((r) => ({
      title: r.title,
      price: r.extracted_price ?? null,
      source: r.source,
      link: r.product_link || r.link,
      thumbnail: r.thumbnail,
    }))
    .filter((r) => r.price !== null);
}

function dedupeByTitleAndSource(list) {
  const seen = new Set();
  return list.filter((r) => {
    const key = `${r.title}|${r.source}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function searchOnline(item, budget, currency, location, gender, categoryInfo) {
  if (!SERPAPI_KEY) throw new Error('SERPAPI_KEY is not set');

  const gl = CURRENCY_TO_COUNTRY[currency] || 'us';
  const query = buildItemQuery(item, gender, categoryInfo);
  const apparel = isApparel(categoryInfo);

  let parsed = await fetchShopping(query, gl, location);

  if (apparel) {
    parsed = parsed.filter((r) => !isMarketplaceSource(r.source));

    // Thin on recognizable retailers? Run one extra query nudged toward
    // real clothing brands so results are actual shops, not marketplace
    // clutter - this is what makes brand-appropriate results possible.
    if (parsed.length < 6) {
      const tiers = RETAILER_TIERS[categoryInfo.category];
      const brandHint = [...tiers.budget.slice(0, 3), ...tiers.premium.slice(0, 2)].join(' OR ');
      const extra = await fetchShopping(`${query} ${brandHint}`, gl, location);
      parsed = dedupeByTitleAndSource([...parsed, ...extra.filter((r) => !isMarketplaceSource(r.source))]);
    }

    parsed = parsed.map((r) => ({ ...r, tier: classifyTier(r.source, categoryInfo) }));
  }

  parsed.sort((a, b) => a.price - b.price);

  let inBudget = budget ? parsed.filter((r) => r.price <= budget) : parsed;
  let higherEnd = [];

  // Someone with a real budget should still see cheaper options AND a few
  // pricier ones worth stretching for - not just everything crammed under
  // the cap. If a budget is set, add a small "worth stretching for" set
  // just above it instead of hiding pricier brands entirely.
  if (budget) {
    higherEnd = parsed
      .filter((r) => r.price > budget && r.price <= budget * 1.6)
      .slice(0, 3)
      .map((r) => ({ ...r, aboveBudget: true }));
  }

  const combined = [...inBudget.slice(0, 8), ...higherEnd];

  return { currency, results: combined, totalFound: parsed.length };
}

// ---------- combined search with cache ----------

async function runSearch({ item, budget, currency = 'USD', location, gender = '' }) {
  const categoryInfo = guessCategoryInfo(item);
  const key = cacheKey(item, budget, currency, location, gender);
  const cached = getCached(key);
  if (cached) return { ...cached, cached: true };

  const [onlineResult, nearbyResult] = await Promise.allSettled([
    searchOnline(item, budget ? Number(budget) : null, currency, location, gender, categoryInfo),
    searchNearby(item, location, gender, categoryInfo),
  ]);

  const payload = {
    item,
    location,
    category: categoryInfo.category || null,
    online:
      onlineResult.status === 'fulfilled'
        ? onlineResult.value
        : { error: onlineResult.reason.message, results: [] },
    nearby:
      nearbyResult.status === 'fulfilled'
        ? nearbyResult.value
        : { error: nearbyResult.reason.message, results: [] },
  };

  setCached(key, payload);
  return { ...payload, cached: false };
}

module.exports = { runSearch, guessCategoryInfo, CATEGORY_HINTS };
