const form = document.getElementById('search-form');
const statusEl = document.getElementById('status');
const btn = document.getElementById('search-btn');
const resultsEl = document.getElementById('results');
const onlineList = document.getElementById('online-list');
const nearbyList = document.getElementById('nearby-list');
const nearbyCol = document.getElementById('nearby-col');

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function renderOnline(online) {
  onlineList.innerHTML = '';
  if (online.error) {
    onlineList.innerHTML = `<p class="empty">Online search unavailable: ${esc(online.error)}</p>`;
    return;
  }
  if (!online.results.length) {
    onlineList.innerHTML = '<p class="empty">No online listings found in your budget.</p>';
    return;
  }
  online.results.forEach((r) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <p class="card-title">${esc(r.title)}</p>
      <p class="card-meta">${esc(r.source || '')}</p>
      <p class="card-price">${esc(online.currency)} ${r.price.toLocaleString()}</p>
      <div class="card-links">
        <a href="${esc(r.link)}" target="_blank" rel="noopener">View listing</a>
      </div>`;
    onlineList.appendChild(card);
  });
}

function renderNearby(nearby) {
  nearbyList.innerHTML = '';
  // Hide the whole column unless we actually have in-person places to show —
  // no placeholder text for "disabled" or "no results", just skip it.
  if (nearby.disabled || nearby.error || !nearby.results.length) {
    nearbyCol.hidden = true;
    resultsEl.classList.add('single-col');
    return;
  }
  nearbyCol.hidden = false;
  resultsEl.classList.remove('single-col');
  nearby.results.forEach((r) => {
    const mapsLink = r.lat && r.lng
      ? `https://www.google.com/maps/search/?api=1&query=${r.lat},${r.lng}`
      : r.mapsUrl;
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <p class="card-title">${esc(r.name)}</p>
      <p class="card-meta">${esc(r.address || '')}${r.rating ? ' &middot; ' + r.rating + ' rating' : ''}${r.openNow === true ? ' &middot; open now' : r.openNow === false ? ' &middot; closed now' : ''}</p>
      <div class="card-links">
        ${r.phone ? `<a href="tel:${esc(r.phone)}">${esc(r.phone)}</a>` : ''}
        ${r.website ? `<a href="${esc(r.website)}" target="_blank" rel="noopener">Shop website</a>` : ''}
        <a href="${esc(mapsLink)}" target="_blank" rel="noopener">Map</a>
      </div>`;
    nearbyList.appendChild(card);
  });
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const item = document.getElementById('item').value.trim();
  const budget = document.getElementById('budget').value;
  const currency = document.getElementById('currency').value;
  const location = document.getElementById('location').value.trim();

  if (!item) {
    statusEl.textContent = 'Enter an item to search for.';
    statusEl.className = 'status error';
    return;
  }
  if (!location) {
    statusEl.textContent = 'Enter your town or city.';
    statusEl.className = 'status error';
    return;
  }

  btn.disabled = true;
  statusEl.className = 'status';
  statusEl.textContent = 'Searching online stores and shops near you...';
  resultsEl.hidden = true;

  try {
    const res = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item, budget: budget || null, currency, location }),
    });
    const data = await res.json();

    if (!res.ok) {
      statusEl.textContent = data.error || 'Something went wrong.';
      statusEl.className = 'status error';
      return;
    }

    statusEl.textContent = '';
    renderOnline(data.online);
    renderNearby(data.nearby);
    resultsEl.hidden = false;
  } catch (err) {
    statusEl.textContent = 'Could not reach the server. Is it running?';
    statusEl.className = 'status error';
  } finally {
    btn.disabled = false;
  }
});
