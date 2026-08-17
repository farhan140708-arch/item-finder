# Findable

Search for any item, set a budget, and see where to get it online and near you —
with links to the shop's website, phone number, and exact map location.

## How it works

- **Online results** come from [SerpAPI](https://serpapi.com)'s Google Shopping engine, filtered by your budget and sorted by price.
- **Nearby results** come from SerpAPI's Google Local (Maps) engine — no separate Google Cloud billing needed, it uses the same SerpAPI key as the online search. The server guesses a shop category from your item (e.g. "leather chair" -> furniture store), searches that category near your town, and returns each place's phone number, website, map link, rating, and hours.
- **Gender / "For"** field: when the item looks like clothing or shoes, picking Women/Men/Kids/Unisex adjusts both the online and nearby search wording (e.g. "women's denim jacket"). It's ignored for non-apparel items.
- **Clothing & shoes get real retailers, not marketplaces.** For apparel, generic marketplace results (Amazon, eBay, AliExpress, Temu, etc.) are filtered out, and if a search comes back thin on recognizable brands, a second query nudges toward real clothing/shoe retailers (Zara, H&M, Uniqlo, Mango, COS, Massimo Dutti, Nike, Adidas, and more — see `RETAILER_TIERS` in `lib/search-logic.js`). Results are tagged **Everyday pick** or **Premium pick** so both budgets show up side by side, not just whichever is cheapest.
- **Budget stretch options**: if you set a budget, you'll also see a few "Worth stretching for" items just above it (up to 1.6x) instead of only ever seeing the cheapest options.

## Setup

1. Install dependencies:
```
npm install
```

2. Get one free API key:
- **SerpAPI**: serpapi.com -> sign up -> copy your API key from the dashboard (free tier: 100 searches/month). This single key powers both online shopping results and nearby shop results — no Google Cloud project or billing needed.

3. Copy `.env.example` to `.env` and paste in your key:
```
cp .env.example .env
```

4. Run it:
```
npm start
```
Then open http://localhost:3000

## Deploying to Netlify

The frontend (`public/`) is static and the search logic runs as a Netlify
serverless function (`netlify/functions/search.js`), so there's no always-on
server to manage.

1. **Push this project to a GitHub repo.** Netlify deploys from Git.
2. **In Netlify**: "Add new site" -> "Import an existing project" -> pick the repo.
3. Netlify reads `netlify.toml` automatically, so build settings (publish
directory `public`, functions directory `netlify/functions`) are already
set — you don't need to type them in.
4. **Add your API key**: Site configuration -> Environment variables -> add
`SERPAPI_KEY` with the value from your `.env`.
Never commit `.env` to the repo.
5. Click **Deploy site**. You'll get a live URL like `your-site.netlify.app`.
6. Every push to your main branch redeploys automatically.

The frontend still calls `/api/search` — the redirect rule in `netlify.toml`
forwards that to the function, so `app.js` needed no changes.

### Other hosts

Any Node host also works if you'd rather run the Express server as-is
(Render, Railway, Fly.io, a VPS): set the same environment variable and
run `npm start`.

## Honest limitations — read before you rely on this

- **"Any item in the world" is best-effort, not guaranteed.** The category guesser
(`CATEGORY_HINTS` in `lib/search-logic.js`) only knows a handful of categories out of
the box. For anything not on that list, it falls back to searching for the
item name directly, which works surprisingly often but not always. Add more
categories to the list as you find gaps.
- **Nearby results are "likely to carry this," not confirmed stock.** No public API
tells you whether a specific small shop has a specific item in stock right now.
The website and phone number are there so the user can call ahead and check —
that's the honest way to close this gap, not something to hide from the user.
- **Brand tiering is a best guess.** "Everyday pick" / "Premium pick" badges are
based on matching a known retailer name list, not a live price index — a store
not on that list simply won't get a badge.
- **Online prices can be stale** by the time someone clicks through — treat them as
a starting estimate, and the "View listing" link is the source of truth.
- **API costs**: SerpAPI meters usage per search, and apparel searches can use a
second call when brand results are thin. At real traffic you'll want to cache
repeat searches to keep costs down.
- **Caching**: repeat searches (same item + budget + currency + town + gender) are
cached in memory for 1 hour to cut API cost and latency. On Netlify this cache
only lives as long as a function instance stays warm — it's a real optimization,
not a durable shared cache. For that, swap `lib/search-logic.js`'s `Map` for
Netlify Blobs or Redis.

## Files

- `lib/search-logic.js` — shared logic: category guessing, gender wording, retailer tiering, cache, SerpAPI shopping + local calls
- `server.js` — Express server for local dev, calls `lib/search-logic.js`
- `netlify/functions/search.js` — the same logic, wrapped as a Netlify function for production
- `netlify.toml` — Netlify build config and the `/api/*` redirect
- `public/` — frontend (plain HTML/CSS/JS, no build step)
- `.env.example` — copy to `.env` and fill in your key (for local dev; on Netlify this goes in Site environment variables instead)
