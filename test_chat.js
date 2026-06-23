const http = require('http');

function evaluate(wsUrl, expression) {
  return new Promise((resolve, reject) => {
    const WebSocket = require('ws');
    const ws = new WebSocket(wsUrl);
    ws.on('open', () => {
      ws.send(JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: {
          expression: `(async () => {
            try {
              let out = '';
              const response = await window.openClaw.chat.sendMessageStream('test_conv', 'hello', 'qwen2.5:7b');
              const reader = response.body.getReader();
              const decoder = new TextDecoder();
              while(true) {
                const {done, value} = await reader.read();
                if(done) break;
                out += decoder.decode(value);
              }
              return out;
            } catch(e) {
              return 'ERROR: ' + e.message;
            }
          })()`,
          awaitPromise: true,
          returnByValue: true
        }
      }));
    });
    ws.on('message', data => {
      const msg = JSON.parse(data);
      if (msg.id === 1) {
        if (msg.result.exceptionDetails) {
          resolve('Exception: ' + JSON.stringify(msg.result.exceptionDetails));
        } else {
          resolve(msg.result.result.value);
        }
        ws.close();
      }
    });
    ws.on('error', reject);
  });
}

http.get('http://127.0.0.1:9222/json', async res => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', async () => {
    const targets = JSON.parse(data);
    const page = targets.find(t => t.type === 'page');
    if (page) {
      console.log('Testing on:', page.title);
      try {
        const result = await evaluate(page.webSocketDebuggerUrl);
        console.log('Result:', result);
      } catch(e) {
        console.error(e);
      }
    } else {
      console.log('No page target found');
    }
  });
});
