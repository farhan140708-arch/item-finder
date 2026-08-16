const { runSearch } = require('../../lib/search-logic');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { item, budget, currency = 'USD', location } = body;

  if (!item || typeof item !== 'string' || !item.trim()) {
    return { statusCode: 400, body: JSON.stringify({ error: 'item is required' }) };
  }
  if (!location || typeof location !== 'string' || !location.trim()) {
    return { statusCode: 400, body: JSON.stringify({ error: 'location is required' }) };
  }

  try {
    const result = await runSearch({ item: item.trim(), budget, currency, location: location.trim() });
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(result) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
