const http = require('http');

const payload = JSON.stringify({
  conversationId: 'test_conv_123',
  message: 'hi',
  modelId: 'qwen2.5:7b',
  systemPrompt: 'You are a helpful assistant.',
  temperature: 0.7
});

const req = http.request({
  hostname: '127.0.0.1',
  port: 3721,
  path: '/api/chat/stream',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
}, res => {
  console.log(`STATUS: ${res.statusCode}`);
  res.setEncoding('utf8');
  res.on('data', chunk => {
    console.log(`BODY: ${chunk}`);
  });
  res.on('end', () => {
    console.log('No more data in response.');
  });
});

req.on('error', e => {
  console.error(`problem with request: ${e.message}`);
});

req.write(payload);
req.end();
