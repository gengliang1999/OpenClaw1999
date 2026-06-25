const express = require('express');
const fs = require('fs');
const path = require('path');
const systemInfo = require('../system-info');
const { MODEL_MARKETPLACE } = require('../data/model-marketplace');

module.exports = function(dependencies) {
  const router = express.Router();
  const { modelManager, dataDir } = dependencies;

/** 获取所有模型 */
  router.get('/', (req, res) => {
    res.json(modelManager.listModels());
  });

  /** 获取当前活跃模型 */
  router.get('/active', (req, res) => {
    res.json(modelManager.getActiveModel());
  });

  /** 设置活跃模型 */
  router.put('/active', (req, res) => {
    try {
      const result = modelManager.setActiveModel(req.body.modelId);
      res.json(result);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });

  /** 添加模型 */
  router.post('/', (req, res) => {
    try {
      const model = modelManager.addModel(req.body);
      res.json(model);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });

  /** 删除模型 */
  router.delete('/:id', (req, res) => {
    try {
      modelManager.removeModel(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });

  /** 获取旗舰级本地模型市场列表（附带硬件评估） */
  router.get('/marketplace', async (req, res) => {
    try {
      const hwInfo = await systemInfo.getHardwareInfo();
      const marketData = MODEL_MARKETPLACE;

      // 递归评估所有版本的硬件兼容性
      const evaluatedData = marketData.map(provider => ({
        ...provider,
        series: provider.series.map(series => ({
          ...series,
          versions: series.versions.map(version => {
            const compatibility = systemInfo.evaluateCompatibility(version.paramsBillion);
            return {
              ...version,
              compatibility
            };
          })
        }))
      }));

      res.json({
        hardware: hwInfo,
        models: evaluatedData
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  /** 同步第三方本地模型 (Ollama / LM Studio) */
  router.post('/sync', async (req, res) => {
    try {
      const count = await modelManager.syncThirdPartyLocalModels();
      res.json({ success: true, count });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  /** 检测本地运行时状态（Ollama / LM Studio） */
  router.get('/local-detect', async (req, res) => {
    const result = { ollama: { running: false, models: [] }, lmstudio: { running: false, models: [] } };

    // 检测 Ollama
    try {
      const ollamaRes = await fetch('http://127.0.0.1:11434/api/tags', { signal: AbortSignal.timeout(3000) });
      if (ollamaRes.ok) {
        result.ollama.running = true;
        const data = await ollamaRes.json();
        result.ollama.models = (data.models || []).map(m => ({
          id: m.name,
          name: m.name,
          size: m.size ? (m.size / 1024 / 1024 / 1024).toFixed(1) + ' GB' : '未知',
          sizeBytes: m.size || 0,
          modified: m.modified_at || '',
          details: m.details || {},
        }));
      }
    } catch (e) { /* Ollama 未运行 */ }

    // 检测 LM Studio
    try {
      const lmRes = await fetch('http://127.0.0.1:1234/v1/models', { signal: AbortSignal.timeout(3000) });
      if (lmRes.ok) {
        result.lmstudio.running = true;
        const data = await lmRes.json();
        result.lmstudio.models = (data.data || []).map(m => ({
          id: m.id,
          name: m.id.split('/').pop() || m.id,
          size: '已加载',
        }));
      }
    } catch (e) { /* LM Studio 未运行 */ }

    res.json(result);
  });

  /** 获取 Ollama 已安装模型列表（详细） */
  router.get('/ollama/list', async (req, res) => {
    try {
      const ollamaRes = await fetch('http://127.0.0.1:11434/api/tags', { signal: AbortSignal.timeout(5000) });
      if (!ollamaRes.ok) throw new Error('Ollama 连接失败');
      const data = await ollamaRes.json();
      const models = (data.models || []).map(m => ({
        id: m.name,
        name: m.name,
        size: m.size ? (m.size / 1024 / 1024 / 1024).toFixed(1) + ' GB' : '未知',
        sizeBytes: m.size || 0,
        modified: m.modified_at || '',
        family: m.details?.family || '',
        format: m.details?.format || '',
        parameterSize: m.details?.parameter_size || '',
      }));
      res.json({ success: true, models });
    } catch (error) {
      res.status(503).json({ success: false, message: 'Ollama 未运行: ' + error.message });
    }
  });

  /** 获取 LM Studio 已加载模型列表 */
  router.get('/lmstudio/list', async (req, res) => {
    try {
      const lmRes = await fetch('http://127.0.0.1:1234/v1/models', { signal: AbortSignal.timeout(5000) });
      if (!lmRes.ok) throw new Error('LM Studio 连接失败');
      const data = await lmRes.json();
      const models = (data.data || []).map(m => ({
        id: m.id,
        name: m.id.split('/').pop() || m.id,
        fullName: m.id,
        owned_by: m.owned_by || '',
      }));
      res.json({ success: true, models });
    } catch (error) {
      res.status(503).json({ success: false, message: 'LM Studio 未运行: ' + error.message });
    }
  });

  /** 添加本地模型到已配置列表并可选设为默认 */
  router.post('/local/add', async (req, res) => {
    try {
      const { provider, modelId, modelName, setDefault } = req.body;
      if (!modelId) return res.status(400).json({ message: 'modelId 不能为空' });

      const id = provider === 'ollama' ? modelId : `lmstudio_${modelId}`;
      const exists = modelManager.models.find(m => m.id === id);
      if (!exists) {
        const modelConfig = provider === 'ollama'
          ? { id, name: `[Ollama] ${modelName || modelId}`, type: 'local', provider: 'Ollama', sizeGB: 0 }
          : { id, name: `[LM Studio] ${modelName || modelId}`, type: 'cloud', provider: 'LM Studio', apiKey: 'lm-studio', baseUrl: 'http://127.0.0.1:1234/v1', modelName: modelId, maxTokens: 4096, temperature: 0.7 };
        modelManager.addModel(modelConfig);
      }

      if (setDefault) {
        modelManager.setActiveModel(id);
      }

      res.json({ success: true, model: modelManager.models.find(m => m.id === id) });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  /** 代理请求外部 API 的 /models 端点（解决 CORS） */
  router.post('/proxy-fetch', async (req, res) => {
    try {
      const { baseUrl, apiKey } = req.body;
      if (!baseUrl) return res.status(400).json({ message: 'baseUrl 不能为空' });

      const modelsUrl = baseUrl.replace(/\/+$/, '') + '/models';
      const headers = { 'Accept': 'application/json' };
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

      const resp = await fetch(modelsUrl, { headers, signal: AbortSignal.timeout(15000) });
      if (!resp.ok) return res.status(resp.status).json({ message: `上游返回 HTTP ${resp.status}` });

      const data = await resp.json();
      res.json(data);
    } catch (error) {
      res.status(502).json({ message: `请求失败: ${error.message}` });
    }
  });

  /** 代理连通测试 */
  router.post('/proxy-test', async (req, res) => {
    try {
      const { baseUrl, apiKey } = req.body;
      if (!baseUrl) return res.status(400).json({ message: 'baseUrl 不能为空' });

      const modelsUrl = baseUrl.replace(/\/+$/, '') + '/models';
      const headers = { 'Accept': 'application/json' };
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

      const resp = await fetch(modelsUrl, { headers, signal: AbortSignal.timeout(10000) });
      if (!resp.ok) return res.json({ ok: false, status: resp.status, message: `HTTP ${resp.status}` });

      const data = await resp.json();
      const count = Array.isArray(data.data) ? data.data.length : Array.isArray(data.models) ? data.models.length : 0;
      res.json({ ok: true, count, message: `连接成功，共 ${count} 个模型` });
    } catch (error) {
      res.json({ ok: false, message: `连接失败: ${error.message}` });
    }
  });

  /** 删除本地模型（Ollama） */
  router.delete('/local/:provider/:modelId', async (req, res) => {
    try {
      const { provider, modelId } = req.params;
      if (provider === 'ollama') {
        const resp = await fetch('http://127.0.0.1:11434/api/delete', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: modelId })
        });
        if (!resp.ok && resp.status !== 200) {
          // Ollama 有些版本返回 200 无 body
          const text = await resp.text().catch(() => '');
          if (text) return res.status(resp.status).json({ message: text });
        }
        // 同时从已配置列表移除
        modelManager.removeModel(modelId).catch(() => {});
        res.json({ success: true });
      } else {
        // LM Studio 没有标准删除 API，只从配置移除
        modelManager.removeModel(`lmstudio_${modelId}`).catch(() => {});
        res.json({ success: true });
      }
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  /** 预加载模型到显存 */
  router.post('/preload', async (req, res) => {
    try {
      const { modelId } = req.body;
      const model = modelManager.models.find(m => m.id === modelId);
      if (!model) return res.status(404).json({ message: '模型不存在' });
      
      if (model.provider === 'Ollama') {
        const baseUrl = model.baseUrl || 'http://127.0.0.1:11434';
        const modelName = model.modelName || model.name.replace(/^\[.*?\]\s*/, '');
        // 发送一个空请求让 Ollama 将模型加载进显存
        fetch(`${baseUrl}/api/generate`, {
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

  /** 触发 Ollama 自动拉取模型或国内源拉取 */
  router.post('/pull', async (req, res) => {
    try {
      const { modelName, ggufUrl } = req.body;
      if (!modelName) return res.status(400).json({ message: 'Missing modelName' });

      // 发送一个异步任务给本地 ollama 服务，流式返回进度
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      if (!ggufUrl) {
        // Fallback: 官方源拉取
        const ollamaRes = await fetch('http://127.0.0.1:11434/api/pull', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: modelName })
        });

        if (!ollamaRes.ok) {
          res.write(`data: ${JSON.stringify({ error: 'Ollama pull failed' })}\n\n`);
          return res.end();
        }

        const decoder = new TextDecoder();
        try {
          for await (const chunk of ollamaRes.body) {
            const textChunk = typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true });
            const lines = textChunk.split('\n').filter(Boolean);
            for (const line of lines) {
              try {
                const data = JSON.parse(line);
                res.write(`data: ${JSON.stringify(data)}\n\n`);
              } catch(e) {}
            }
          }
          res.write(`data: ${JSON.stringify({ status: 'success' })}\n\n`);
        } catch (err) {
          res.write(`data: ${JSON.stringify({ error: 'Stream error: ' + err.message })}\n\n`);
        }
        return res.end();
      }

      // 国内镜像源拉取
      try {
        const tempDir = path.join(dataDir, 'temp_downloads');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
        
        const filePath = path.join(tempDir, `${modelName.replace(/:/g, '_')}.gguf`);
        
        res.write(`data: ${JSON.stringify({ status: 'connecting', detail: '连接到国内镜像源...' })}\n\n`);
        
        const response = await fetch(ggufUrl);
        if (!response.ok) throw new Error('镜像源连接失败');
        
        const totalBytes = parseInt(response.headers.get('content-length'), 10) || 0;
        let downloadedBytes = 0;
        
        const dest = fs.createWriteStream(filePath);
        
        let lastReportTime = Date.now();
        let lastReportBytes = 0;
        
        // 使用 ReadableStream 异步迭代
        for await (const chunk of response.body) {
          dest.write(chunk);
          downloadedBytes += chunk.length;
          
          const now = Date.now();
          if (now - lastReportTime > 500) {
            const speed = (downloadedBytes - lastReportBytes) / ((now - lastReportTime) / 1000); // Bytes per sec
            const speedMB = (speed / 1024 / 1024).toFixed(2);
            res.write(`data: ${JSON.stringify({ 
              status: 'downloading', 
              detail: `正在极速下载 GGUF (国内节点) ... ${speedMB} MB/s`,
              completed: downloadedBytes,
              total: totalBytes
            })}\n\n`);
            lastReportTime = now;
            lastReportBytes = downloadedBytes;
          }
        }
        
        dest.end();
        
        res.write(`data: ${JSON.stringify({ status: 'creating', detail: '下载完成，正在转换为本地可运行模型...' })}\n\n`);
        
        const modelfilePath = path.join(tempDir, `Modelfile_${modelName.replace(/:/g, '_')}`);
        // Windows 环境下路径需处理斜杠
        const normalizedFilePath = filePath.replace(/\\/g, '/');
        fs.writeFileSync(modelfilePath, `FROM ${normalizedFilePath}\n`);
        
        const createRes = await fetch('http://127.0.0.1:11434/api/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: modelName, path: modelfilePath })
        });
        
        const decoder = new TextDecoder();
        for await (const chunk of createRes.body) {
          const textChunk = typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true });
          const lines = textChunk.split('\n').filter(Boolean);
          for (const line of lines) {
            try {
              const data = JSON.parse(line);
              res.write(`data: ${JSON.stringify({ status: 'pulling', detail: data.status || '配置模型中...' })}\n\n`);
            } catch(e) {}
          }
        }
        
        // 清理临时文件 (可选，或让用户自行处理)
        try {
          fs.unlinkSync(filePath);
          fs.unlinkSync(modelfilePath);
        } catch(e) {
          console.error('清理临时文件失败', e);
        }
        
        res.write(`data: ${JSON.stringify({ status: 'success' })}\n\n`);
        res.end();
      } catch (err) {
        res.write(`data: ${JSON.stringify({ error: 'GGUF下载失败: ' + err.message })}\n\n`);
        res.end();
      }

    } catch (error) {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  });

  
  return router;
};
