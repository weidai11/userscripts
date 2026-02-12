import http from 'http';
import fs from 'fs';

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const filePath = 'c:\\Users\\Wei Dai\\Code\\userscripts\\dist\\power-reader.user.js';
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      res.writeHead(500);
      res.end('Error reading file: ' + err.message);
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/javascript' });
    res.end(data);
  });
});

server.listen(8080, '0.0.0.0', () => {
  console.log('Server running at http://localhost:8080/');
});
