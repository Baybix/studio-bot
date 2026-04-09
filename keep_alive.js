const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Bot actif !');
});

server.listen(3000, () => {
  console.log('✅ Serveur keep-alive actif sur le port 3000');
});
