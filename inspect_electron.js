const WebSocket = require('ws');

async function inspect() {
  const wsUrl = "ws://localhost:9222/devtools/page/7B69DBA11D697F7A05472FE6F2664A46";
  const ws = new WebSocket(wsUrl);

  ws.on('open', () => {
    console.log('CDP Connection opened');
    
    // 启用 Console 和 Runtime
    ws.send(JSON.stringify({ id: 1, method: "Console.enable" }));
    ws.send(JSON.stringify({ id: 2, method: "Runtime.enable" }));

    // 执行点击和打字模拟
    const expr = `(() => {
      const el = document.getElementById('chatInput');
      if (!el) return 'Element #chatInput not found';
      
      el.focus();
      el.value = '测试打字输入内容';
      // 触发 input 事件以调用它的 input 监听器
      el.dispatchEvent(new Event('input', { bubbles: true }));
      
      return {
        valueAfterInput: el.value,
        styleHeight: el.style.height
      };
    })()`;

    setTimeout(() => {
      ws.send(JSON.stringify({
        id: 3,
        method: "Runtime.evaluate",
        params: {
          expression: expr,
          returnByValue: true
        }
      }));
    }, 1000);

    setTimeout(() => {
      ws.close();
    }, 3000);
  });

  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.id === 3) {
      console.log('Evaluation result:', JSON.stringify(msg.result?.result?.value, null, 2));
    }
    if (msg.method === "Runtime.consoleAPICalled") {
      console.log('[BROWSER CONSOLE]:', msg.params.args.map(a => a.value || a.description).join(' '));
    }
  });

  ws.on('error', (err) => {
    console.error('WS Error:', err);
  });
}

inspect();
