require('dotenv').config();
const express = require('express');
const path = require('path');
const { runSearch } = require('./lib/search-logic');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/search', async (req, res) => {
  const { item, budget, currency = 'USD', location, gender = '' } = req.body || {};

  if (!item || typeof item !== 'string' || !item.trim()) {
    return res.status(400).json({ error: 'item is required' });
  }
  if (!location || typeof location !== 'string' || !location.trim()) {
    return res.status(400).json({ error: 'location is required' });
  }

  try {
    const result = await runSearch({ item: item.trim(), budget, currency, location: location.trim(), gender });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Item finder running at http://localhost:${PORT}`);
});
