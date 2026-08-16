# Findable

Search for any item, set a budget, and see where to get it online and near you —
with links to the shop's website, phone number, and exact map location.

## How it works

- **Online results** come from [SerpAPI](https://serpapi.com)'s Google Shopping engine, filtered by your budget and sorted by price.
- **Nearby results** come from the Google Places API. The server guesses a shop category from your item (e.g. "leather chair" -> furniture store), searches that category near your town, then pulls each place's phone number, website, and map link via the Place Details API.

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Get two free API keys:
   - **Google Maps Platform**: console.cloud.google.com -> create a project -> enable "Places API" -> enable billing (Google gives $200/month free credit, which covers thousands of searches) -> create an API key under Credentials.
   - **SerpAPI**: serpapi.com -> sign up -> copy your API key from the dashboard (free tier: 100 searches/month).

3. Copy `.env.example` to `.env` and paste in your keys:
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
4. **Add your API keys**: Site configuration -> Environment variables -> add
   `GOOGLE_MAPS_API_KEY` and `SERPAPI_KEY` with the values from your `.env`.
   Never commit `.env` to the repo.
5. Click **Deploy site**. You'll get a live URL like `your-site.netlify.app`.
6. Every push to your main branch redeploys automatically.

The frontend still calls `/api/search` — the redirect rule in `netlify.toml`
forwards that to the function, so `app.js` needed no changes.

### Other hosts

Any Node host also works if you'd rather run the Express server as-is
(Render, Railway, Fly.io, a VPS): set the same two environment variables and
run `npm start`.

## Honest limitations — read before you rely on this

- **"Any item in the world" is best-effort, not guaranteed.** The category guesser
  (`CATEGORY_HINTS` in `server.js`) only knows a handful of categories out of the box.
  For anything not on that list, it falls back to searching Google Places for the
  item name directly, which works surprisingly often but not always. Add more
  categories to the list as you find gaps.
- **Nearby results are "likely to carry this," not confirmed stock.** No public API
  tells you whether a specific small shop has a specific item in stock right now.
  The website and phone number are there so the user can call ahead and check —
  that's the honest way to close this gap, not something to hide from the user.
- **Online prices can be stale** by the time someone clicks through — treat them as
  a starting estimate, and the "View listing" link is the source of truth.
- **API costs**: Places API and SerpAPI both meter usage. At real traffic you'll
  want to cache repeat searches (e.g. same item + same city within a day) to keep
  costs down.

- **Caching**: repeat searches (same item + budget + currency + town) are cached
  in memory for 1 hour to cut API cost and latency. On Netlify this cache only
  lives as long as a function instance stays warm — it's a real optimization,
  not a durable shared cache. For that, swap `lib/search-logic.js`'s `Map` for
  Netlify Blobs or Redis.

## Files

- `lib/search-logic.js` — shared logic: category guessing, cache, Places + SerpAPI calls
- `server.js` — Express server for local dev, calls `lib/search-logic.js`
- `netlify/functions/search.js` — the same logic, wrapped as a Netlify function for production
- `netlify.toml` — Netlify build config and the `/api/*` redirect
- `public/` — frontend (plain HTML/CSS/JS, no build step)
- `.env.example` — copy to `.env` and fill in your keys (for local dev; on Netlify these go in Site environment variables instead)
