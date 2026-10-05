const http = require('http');

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  console.log('Fake API request:', req.method, req.url);
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.url === '/') {
    res.writeHead(200);
    res.end('OK');
    return;
  }

  // Simulate API base URL
  if (req.url.startsWith('/physical-assets/')) {
    if (req.headers['authorization'] === 'Bearer fake-jwt-token-for-security') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        assetRef: req.url.split('/').pop(),
        lifecycleStatus: 'REGISTERED',
        currentCustodianRef: 'CUST-1',
        currentLocation: 'LOC-1',
        quantity: 1,
        unitOfMeasure: 'EA',
        campaignRef: 'CAMP-1',
        donorRef: 'DON-1', // This should be discarded by the client
        extraField: 'extra'
      }));
    } else {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
    }
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(3002, () => {
  console.log('Fake backend listening on port 3002');
});
