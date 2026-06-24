const http = require('http');

const data = JSON.stringify({
  conversationId: 'test',
  message: 'hi',
  modelId: 'some-model'
});

const req = http.request({
  hostname: '127.0.0.1',
  port: 3721,
  path: '/api/chat/stream',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
}, res => {
  res.on('data', d => process.stdout.write(d));
});

req.on('error', error => console.error(error));
req.write(data);
req.end();
