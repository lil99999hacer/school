const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS — allow all origins (lock this down to your domain in production)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-proxy-target', 'x-user-agent'],
}));

app.use(express.text({ type: '*/*', limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));

// Keep-awake ping
app.get('/ping', (req, res) => {
  res.json({ status: 'ONLINE', ts: Date.now() });
});

// Main proxy route
app.all('/proxy', async (req, res) => {
  const targetUrl = req.headers['x-proxy-target'];
  const userAgent = req.headers['x-user-agent'] || 'X-Cloud-HyperSurf/4.0';

  if (!targetUrl) {
    return res.status(400).json({ error: 'Missing x-proxy-target header' });
  }

  // Validate URL
  let parsedUrl;
  try {
    parsedUrl = new URL(targetUrl);
  } catch {
    return res.status(400).json({ error: 'Invalid target URL' });
  }

  const method = req.method;
  const hasBody = ['POST', 'PUT', 'PATCH'].includes(method);

  const fetchOptions = {
    method,
    headers: {
      'User-Agent': userAgent,
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  };

  // Forward body if present
  if (hasBody && req.body) {
    const bodyStr = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    fetchOptions.body = bodyStr;
    fetchOptions.headers['Content-Type'] = req.headers['content-type'] || 'application/json';
  }

  try {
    const response = await fetch(parsedUrl.toString(), fetchOptions);
    const contentType = response.headers.get('content-type') || 'text/plain';
    const body = await response.text();

    res.status(response.status);
    res.set('Content-Type', contentType);
    res.set('X-Proxy-Status', String(response.status));
    res.set('X-Proxy-Target', targetUrl);
    res.send(body);
  } catch (err) {
    console.error('[PROXY ERROR]', err.message);
    res.status(502).json({ error: 'Proxy fetch failed', detail: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`X-CLOUD PROXY GATEWAY running on port ${PORT}`);
});
