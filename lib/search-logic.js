const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const SERPAPI_KEY = process.env.SERPAPI_KEY;

// ---------- category guessing ----------
// Extend this list as you find items that fall back to a raw item-name search.
// Keys are matched as substrings against the lowercased item text.
const CATEGORY_HINTS = [
  { kw: ['chair', 'desk', 'sofa', 'couch', 'table', 'furniture', 'shelf', 'lamp', 'mattress', 'wardrobe'], term: 'furniture store' },
  { kw: ['phone', 'laptop', 'charger', 'headphone', 'earbud', 'camera', 'tv', 'electronics', 'monitor', 'speaker', 'cable'], term: 'electronics store' },
  { kw: ['computer', 'gaming', 'console', 'graphics card', 'keyboard', 'mouse'], term: 'computer store' },
  { kw: ['perfume', 'fragrance', 'cologne', 'attar'], term: 'perfume shop' },
  { kw: ['makeup', 'cosmetic', 'skincare', 'lipstick'], term: 'cosmetics store' },
  { kw: ['book', 'novel', 'textbook'], term: 'bookstore' },
  { kw: ['shoe', 'sneaker', 'boot', 'sandal'], term: 'shoe store' },
  { kw: ['clothing', 'shirt', 'dress', 'jacket', 'trouser', 'jeans', 'suit'], term: 'clothing store' },
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

function guessSearchTerm(item) {
  const lower = item.toLowerCase();
  for (const group of CATEGORY_HINTS) {
    if (group.kw.some((k) => lower.includes(k))) return group.term;
  }
  // Fallback: search the item text itself as a place query. Google Places
  // text search is often smart enough to surface a relevant shop even
  // without a category hint — this is what makes "anything" work at all.
  return item;
}

// ---------- tiny in-memory cache ----------
// Best-effort only: on Netlify this survives just for the life of a warm
// function instance, not across all users or deploys. It still cuts real
// API cost/latency for repeat searches within that window. For a durable
// shared cache across all users, swap this for Netlify Blobs or Redis.
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const cache = new Map();

function cacheKey(item, budget, currency, location) {
  return [item.toLowerCase(), budget || '', currency, location.toLowerCase()].join('|');
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

// ---------- nearby (Google Places) ----------

async function searchNearby(item, location) {
  if (!GOOGLE_MAPS_API_KEY) throw new Error('GOOGLE_MAPS_API_KEY is not set');

  const searchTerm = guessSearchTerm(item);
  const query = `${searchTerm} near ${location}`;

  const textSearchUrl = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
  textSearchUrl.searchParams.set('query', query);
  textSearchUrl.searchParams.set('key', GOOGLE_MAPS_API_KEY);

  const textRes = await fetch(textSearchUrl).then((r) => r.json());
  if (textRes.status !== 'OK' && textRes.status !== 'ZERO_RESULTS') {
    throw new Error(`Places text search failed: ${textRes.status} ${textRes.error_message || ''}`);
  }

  const topResults = (textRes.results || []).slice(0, 6);

  const detailed = await Promise.all(
    topResults.map(async (place) => {
      const detailsUrl = new URL('https://maps.googleapis.com/maps/api/place/details/json');
      detailsUrl.searchParams.set('place_id', place.place_id);
      detailsUrl.searchParams.set(
        'fields',
        'name,formatted_address,formatted_phone_number,international_phone_number,website,geometry,url,opening_hours,rating'
      );
      detailsUrl.searchParams.set('key', GOOGLE_MAPS_API_KEY);
      const detailsRes = await fetch(detailsUrl).then((r) => r.json());
      const d = detailsRes.result || {};
      return {
        name: d.name || place.name,
        address: d.formatted_address || place.formatted_address,
        phone: d.formatted_phone_number || d.international_phone_number || null,
        website: d.website || null,
        mapsUrl: d.url || `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
        lat: d.geometry?.location?.lat ?? place.geometry?.location?.lat,
        lng: d.geometry?.location?.lng ?? place.geometry?.location?.lng,
        openNow: d.opening_hours?.open_now ?? null,
        rating: d.rating ?? null,
      };
    })
  );

  return { searchTerm, results: detailed };
}

// ---------- online (SerpAPI Google Shopping) ----------

async function searchOnline(item, budget, currency) {
  if (!SERPAPI_KEY) throw new Error('SERPAPI_KEY is not set');

  const url = new URL('https://serpapi.com/search.json');
  url.searchParams.set('engine', 'google_shopping');
  url.searchParams.set('q', item);
  url.searchParams.set('api_key', SERPAPI_KEY);

  const res = await fetch(url).then((r) => r.json());
  const shoppingResults = res.shopping_results || [];

  const parsed = shoppingResults
    .map((r) => ({
      title: r.title,
      price: r.extracted_price ?? null,
      source: r.source,
      link: r.product_link || r.link,
      thumbnail: r.thumbnail,
    }))
    .filter((r) => r.price !== null);

  const withinBudget = budget ? parsed.filter((r) => r.price <= budget) : parsed;
  withinBudget.sort((a, b) => a.price - b.price);

  return { currency, results: withinBudget.slice(0, 10), totalFound: parsed.length };
}

// ---------- combined search with cache ----------

async function runSearch({ item, budget, currency = 'USD', location }) {
  const key = cacheKey(item, budget, currency, location);
  const cached = getCached(key);
  if (cached) return { ...cached, cached: true };

  const [onlineResult, nearbyResult] = await Promise.allSettled([
    searchOnline(item, budget ? Number(budget) : null, currency),
    searchNearby(item, location),
  ]);

  const payload = {
    item,
    location,
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

module.exports = { runSearch, guessSearchTerm, CATEGORY_HINTS };
