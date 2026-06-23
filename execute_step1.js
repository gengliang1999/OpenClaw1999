const fs = require('fs');

// 1. Modifying preload.js
const preloadFile = 'src/main/preload.js';
let preloadContent = fs.readFileSync(preloadFile, 'utf8');

if (!preloadContent.includes('syncLocalModels:')) {
  preloadContent = preloadContent.replace(/getMarketplace: \(\) => apiRequest\('\/models\/marketplace'\),/, 
`getMarketplace: () => apiRequest('/models/marketplace'),

    /** 同步第三方本地模型 */
    syncLocalModels: () => apiRequest('/models/sync', { method: 'POST' }),

    /** 预加载本地模型到显存 */
    preloadModel: (modelId) => apiRequest('/models/preload', { method: 'POST', body: { modelId } }),`);
  fs.writeFileSync(preloadFile, preloadContent);
  console.log('Patched preload.js');
}

// 2. Modifying server.js
const serverFile = 'src/backend/server.js';
let serverContent = fs.readFileSync(serverFile, 'utf8');

if (!serverContent.includes('/api/models/preload')) {
  serverContent = serverContent.replace(/\/\*\* 触发 Ollama 自动拉取模型或国内源拉取 \*\//,
`/** 预加载模型到显存 */
  app.post('/api/models/preload', async (req, res) => {
    try {
      const { modelId } = req.body;
      const model = modelManager.models.find(m => m.id === modelId);
      if (!model) return res.status(404).json({ message: '模型不存在' });
      
      if (model.provider === 'Ollama') {
        const baseUrl = model.baseUrl || 'http://127.0.0.1:11434';
        const modelName = model.modelName || model.name.replace(/^\\[.*?\\]\\s*/, '');
        // 发送一个空请求让 Ollama 将模型加载进显存
        fetch(\`\${baseUrl}/api/generate\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: modelName })
        }).catch(e => console.log('Ollama preload skip:', e.message));
        return res.json({ success: true, message: '已发送预加载请求' });
      }
      res.json({ success: true, message: '该模型无需或不支持预加载' });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  /** 触发 Ollama 自动拉取模型或国内源拉取 */`);
}

// 3. Modifying server.js auto-preload on startup
if (!serverContent.includes('// 自动预加载默认模型')) {
  serverContent = serverContent.replace(/app\.listen\(port, \(\) => \{[\s\S]*?\}\);/,
`app.listen(port, () => {
      console.log(\`[API 服务器] 已启动: http://127.0.0.1:\${port}\`);
      
      // 自动预加载默认模型
      if (settings.autoPreloadLocalModel) {
        const activeId = modelManager.getActiveModel()?.id;
        if (activeId) {
          const model = modelManager.models.find(m => m.id === activeId);
          if (model && model.provider === 'Ollama') {
            const baseUrl = model.baseUrl || 'http://127.0.0.1:11434';
            const modelName = model.modelName || model.name.replace(/^\\[.*?\\]\\s*/, '');
            console.log(\`[API 服务器] 正在开机预加载本地模型 \${modelName} 到显存...\`);
            fetch(\`\${baseUrl}/api/generate\`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ model: modelName })
            }).catch(() => {});
          }
        }
      }
    });`);
  fs.writeFileSync(serverFile, serverContent);
  console.log('Patched server.js');
}
