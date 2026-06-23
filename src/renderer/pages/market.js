/**
 * 模型市场 (Model Market) v3
 * 上方：云端模型服务（国内外主流厂商 + 详细配置）
 * 下方：本地运行时检测 + 模型大市场（可滚动）
 */

let settings = {};
let localStatus = { ollama: { running: false, models: [] }, lmstudio: { running: false, models: [] } };
let activeModelId = '';

// 国内外主流云端模型厂商（完整列表）
const cloudVendors = [
  // 海外厂商
  { id: 'openai', name: 'OpenAI', icon: '🌌', color: '#10a37f', desc: 'GPT-4o、GPT-4-Turbo、o1 系列旗舰模型', url: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1-preview', 'o1-mini', 'gpt-3.5-turbo'] },
  { id: 'anthropic', name: 'Anthropic', icon: '🧠', color: '#d97757', desc: 'Claude 4 Opus/Sonnet 等强力推理模型', url: 'https://api.anthropic.com/v1',
    models: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'] },
  { id: 'gemini', name: 'Google Gemini', icon: '✨', color: '#4285f4', desc: 'Gemini 2.0/1.5 Pro 多模态系列', url: 'https://generativelanguage.googleapis.com/v1beta',
    models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.0-pro'] },
  { id: 'groq', name: 'Groq', icon: '⚡', color: '#f55036', desc: '超高速推理，LPU 加速芯片', url: 'https://api.groq.com/openai/v1',
    models: ['llama-3.1-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it'] },
  { id: 'mistral', name: 'Mistral AI', icon: '🌀', color: '#ff7000', desc: 'Mistral Large/Medium 系列，欧洲领先', url: 'https://api.mistral.ai/v1',
    models: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest', 'open-mistral-nemo'] },
  // 国内厂商
  { id: 'deepseek', name: 'DeepSeek', icon: '🐳', color: '#4d6bfe', desc: '深度求索，高性价比代码与推理模型', url: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner'] },
  { id: 'qwen', name: '通义千问', icon: '☁️', color: '#615ced', desc: '阿里云 Qwen 全系列，QwQ 推理模型', url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: ['qwen-turbo', 'qwen-plus', 'qwen-max', 'qwen-long', 'qwq-plus'] },
  { id: 'zhipu', name: '智谱 AI', icon: '🔮', color: '#3269ff', desc: 'GLM-4 / GLM-4V 多模态系列', url: 'https://open.bigmodel.cn/api/paas/v4',
    models: ['glm-4-plus', 'glm-4-flash', 'glm-4v-plus', 'glm-4-air', 'glm-4-long'] },
  { id: 'moonshot', name: '月之暗面 (Kimi)', icon: '🌙', color: '#000', desc: 'Kimi 长文本理解，128K 上下文', url: 'https://api.moonshot.cn/v1',
    models: ['moonshot-v1-128k', 'moonshot-v1-32k', 'moonshot-v1-8k'] },
  { id: 'baidu', name: '百度文心', icon: '🐻', color: '#2932e1', desc: '文心大模型 4.5 系列，中文能力突出', url: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop',
    models: ['ernie-4.0-8k', 'ernie-3.5-8k', 'ernie-speed-128k', 'ernie-lite-8k'] },
  { id: 'bytedance', name: '豆包 (字节)', icon: '🫘', color: '#fe2c55', desc: '字节跳动豆包大模型，Doubao 系列', url: 'https://ark.cn-beijing.volces.com/api/v3',
    models: ['doubao-pro-32k', 'doubao-pro-128k', 'doubao-lite-32k', 'doubao-lite-128k'] },
  { id: 'minimax', name: 'MiniMax', icon: '🔵', color: '#1677ff', desc: 'MiniMax abab 系列，擅长角色扮演', url: 'https://api.minimax.chat/v1',
    models: ['abab6.5s-chat', 'abab6.5-chat', 'abab5.5-chat'] },
  { id: 'iflytek', name: '讯飞星火', icon: '🔥', color: '#ff6a00', desc: '科大讯飞星火大模型，语音+文本', url: 'https://spark-api-open.xf-yun.com/v1',
    models: ['generalv3.5', 'generalv3', 'pro-128k'] },
  { id: 'yi', name: '零一万物', icon: '🌱', color: '#00c853', desc: 'Yi 系列模型，高性价比', url: 'https://api.lingyiwanwu.com/v1',
    models: ['yi-large', 'yi-medium', 'yi-spark', 'yi-large-turbo'] },
];

export async function render(container) {
  try { settings = (await window.openClaw.settings.getAll()) || {}; } catch(e) { settings = {}; }
  try { const am = await window.openClaw.model.getActiveModel(); activeModelId = am?.id || ''; } catch(e) {}

  container.style.padding = '0';
  container.style.overflow = 'hidden';

  container.innerHTML = `
    <div class="model-market-page">
      <!-- 上方：云端模型服务 -->
      <div class="cloud-service-section" id="cloudServiceSection">
        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 20px;">
          <div>
            <h2 style="margin: 0 0 6px 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">☁️ 云端模型服务</h2>
            <p style="margin: 0; color: var(--text-muted); font-size: 13px;">配置国内外主流 AI 模型 API，点击厂商卡片进入详细配置。</p>
          </div>
          <button id="addCustomModelBtn" class="btn btn-primary" style="padding: 8px 18px; border-radius: 12px; font-size: 13px; font-weight: 600;">+ 自定义模型</button>
        </div>
        <div class="cloud-vendor-grid" id="cloudVendorGrid"></div>
      </div>

      <!-- 下方：模型市场（可滚动） -->
      <div class="local-market-section" id="localMarketSection">
        <!-- 本地运行时区域 -->
        <div style="margin-bottom: 32px;">
          <h3 style="font-size: 16px; font-weight: 600; margin: 0 0 14px 0; color: var(--text-secondary); display: flex; align-items: center; gap: 8px;">
            <span style="width: 4px; height: 18px; background: linear-gradient(180deg, #00d9ff, #6c63ff); border-radius: 2px;"></span>
            本地模型运行时
          </h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;" id="localRuntimeGrid">
            <!-- Ollama 卡片 -->
            <div id="ollamaCard" style="background: var(--bg-card); border: 1.5px solid var(--border-light); border-radius: 16px; padding: 22px; cursor: pointer; transition: all 0.25s; position: relative; overflow: hidden;">
              <div style="position: absolute; top: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, #00d9ff, #6c63ff); opacity: 0.5;"></div>
              <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 12px;">
                <div style="width: 48px; height: 48px; background: linear-gradient(135deg, rgba(0,217,255,0.15), rgba(108,99,255,0.15)); border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 24px;">🦙</div>
                <div style="flex: 1;">
                  <h3 style="margin: 0 0 2px 0; font-size: 18px; font-weight: 700;">Ollama</h3>
                  <div style="font-size: 12px; color: var(--text-muted);">轻量级本地大模型运行框架</div>
                </div>
                <div id="ollamaStatus" style="font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 16px;">检测中...</div>
              </div>
              <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 12px;">一键拉取 Llama、Qwen、DeepSeek 等主流开源模型，本地推理零延迟。</div>
              <div id="ollamaActions" style="display: flex; gap: 8px;"></div>
            </div>
            <!-- LM Studio 卡片 -->
            <div id="lmstudioCard" style="background: var(--bg-card); border: 1.5px solid var(--border-light); border-radius: 16px; padding: 22px; cursor: pointer; transition: all 0.25s; position: relative; overflow: hidden;">
              <div style="position: absolute; top: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, #ff9500, #ff2d55); opacity: 0.5;"></div>
              <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 12px;">
                <div style="width: 48px; height: 48px; background: linear-gradient(135deg, rgba(255,149,0,0.15), rgba(255,45,85,0.15)); border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 24px;">💻</div>
                <div style="flex: 1;">
                  <h3 style="margin: 0 0 2px 0; font-size: 18px; font-weight: 700;">LM Studio</h3>
                  <div style="font-size: 12px; color: var(--text-muted);">可视化本地模型管理与推理</div>
                </div>
                <div id="lmstudioStatus" style="font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 16px;">检测中...</div>
              </div>
              <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 12px;">支持 HuggingFace / ModelScope GGUF 模型，图形界面一键加载。</div>
              <div id="lmstudioActions" style="display: flex; gap: 8px;"></div>
            </div>
          </div>
        </div>

        <!-- 模型大市场入口 -->
        <div style="margin-bottom: 20px;">
          <h3 style="font-size: 16px; font-weight: 600; margin: 0 0 14px 0; color: var(--text-secondary); display: flex; align-items: center; gap: 8px;">
            <span style="width: 4px; height: 18px; background: linear-gradient(180deg, #34c759, #00d9ff); border-radius: 2px;"></span>
            模型大市场（本地拉取）
          </h3>
          <div id="modelMarketContainer" style="min-height: 200px;">
            <div style="text-align: center; padding: 40px; color: var(--text-muted);">正在加载模型市场数据...</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 云端模型配置 Modal -->
    <div class="cloud-config-modal" id="cloudConfigModal">
      <div class="cloud-config-panel">
        <div class="cloud-config-header">
          <div id="configVendorLogo" class="logo-upload-zone" title="点击上传自定义 Logo">
            <div class="upload-placeholder"><span>+</span>Logo</div>
          </div>
          <div style="flex:1;">
            <h3 id="configVendorName">配置</h3>
            <div id="configVendorDesc" style="font-size: 13px; color: var(--text-muted); margin-top: 2px;"></div>
          </div>
          <button id="closeCloudConfig" style="background: none; border: none; font-size: 28px; cursor: pointer; color: var(--text-muted); line-height: 1;">&times;</button>
        </div>
        <div class="cloud-config-body" id="cloudConfigBody"></div>
        <div class="cloud-config-footer">
          <button class="btn btn-default" id="cancelCloudConfig" style="border-radius: 10px;">取消</button>
          <button class="btn btn-danger" id="deleteCloudConfig" style="border-radius: 10px;">删除配置</button>
          <button class="btn btn-primary" id="saveCloudConfig" style="border-radius: 10px; font-weight: 600; padding: 0 28px;">保存配置</button>
        </div>
      </div>
    </div>

    <!-- 安装引导 Modal -->
    <div id="installGuideModal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 10000; align-items: center; justify-content: center; backdrop-filter: blur(4px);">
      <div style="background: var(--bg-app); width: 520px; max-width: 90%; border-radius: 20px; box-shadow: 0 24px 48px rgba(0,0,0,0.25); overflow: hidden;">
        <div style="padding: 20px 24px; border-bottom: 1px solid var(--border-light); display: flex; justify-content: space-between; align-items: center;">
          <h3 style="margin: 0; font-size: 18px;" id="installGuideTitle">安装引导</h3>
          <button id="closeInstallGuide" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-muted);">&times;</button>
        </div>
        <div id="installGuideBody" style="padding: 24px;"></div>
      </div>
    </div>

    <!-- 本地模型列表 Modal -->
    <div id="localModelsModal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 10000; align-items: center; justify-content: center; backdrop-filter: blur(4px);">
      <div style="background: var(--bg-app); width: 600px; max-width: 90%; max-height: 80vh; border-radius: 20px; box-shadow: 0 24px 48px rgba(0,0,0,0.25); overflow: hidden; display: flex; flex-direction: column;">
        <div style="padding: 20px 24px; border-bottom: 1px solid var(--border-light); display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
          <h3 style="margin: 0; font-size: 18px;" id="localModelsTitle">已部署模型</h3>
          <button id="closeLocalModels" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-muted);">&times;</button>
        </div>
        <div id="localModelsBody" style="padding: 24px; overflow-y: auto; flex: 1;"></div>
      </div>
    </div>
  `;

  // 隐藏的 file input for logo upload
  const logoInput = document.createElement('input');
  logoInput.type = 'file';
  logoInput.accept = 'image/*';
  logoInput.id = 'logoFileInput';
  logoInput.style.display = 'none';
  document.body.appendChild(logoInput);

  bindModalEvents();
  renderCloudVendors();
  await detectLocalRuntimes();
  await loadModelMarket();
}

function bindModalEvents() {
  // 关闭按钮通用
  ['closeInstallGuide','closeLocalModels'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', () => {
      document.getElementById(id).closest('[id$="Modal"]').style.display = 'none';
    });
  });
  // 背景点击关闭
  ['installGuideModal','localModelsModal'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', (e) => {
      if (e.target.id === id) e.target.style.display = 'none';
    });
  });
  // 云端配置 Modal 关闭
  const ccm = document.getElementById('cloudConfigModal');
  document.getElementById('closeCloudConfig').addEventListener('click', () => ccm.classList.remove('visible'));
  document.getElementById('cancelCloudConfig').addEventListener('click', () => ccm.classList.remove('visible'));
  ccm.addEventListener('click', (e) => { if (e.target === ccm) ccm.classList.remove('visible'); });
  // 自定义模型按钮
  document.getElementById('addCustomModelBtn').addEventListener('click', () => {
    openCloudConfig({ id: '_custom', name: '自定义模型', icon: '➕', color: '#888', desc: '添加任意 OpenAI 兼容 API', url: '', models: [] });
  });
  // Logo 上传
  document.getElementById('configVendorLogo').addEventListener('click', () => document.getElementById('logoFileInput').click());
  document.getElementById('logoFileInput').addEventListener('change', handleLogoUpload);
}

// ==================== 云端厂商渲染 ====================
function renderCloudVendors() {
  const grid = document.getElementById('cloudVendorGrid');
  grid.innerHTML = cloudVendors.map(v => {
    const conf = settings[v.id] || {};
    const isConfigured = conf.apiKey && conf.apiKey.trim() !== '';
    const customLogo = conf.customLogo || '';
    const displayName = conf.customName || v.name;
    return `
    <div class="cloud-vendor-card" data-id="${v.id}">
      ${isConfigured ? '<div class="configured-dot"></div>' : ''}
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
        <div class="vendor-logo" style="background: ${v.color}15;">
          ${customLogo ? `<img src="${customLogo}" alt="${v.name}" />` : `<span>${v.icon}</span>`}
        </div>
        <div class="vendor-info">
          <h4>${escapeHtml(displayName)}</h4>
          <div class="vendor-status">${isConfigured ? '✅ 已配置' : '未配置'}</div>
        </div>
      </div>
      <p class="vendor-desc">${v.desc}</p>
    </div>
  `}).join('');

  grid.querySelectorAll('.cloud-vendor-card').forEach(card => {
    card.addEventListener('click', () => {
      const v = cloudVendors.find(x => x.id === card.dataset.id);
      if (v) openCloudConfig(v);
    });
  });
}

// ==================== 云端模型配置 Modal ====================
let currentConfigVendor = null;
let currentLogoDataUrl = '';

function openCloudConfig(vendor) {
  currentConfigVendor = vendor;
  currentLogoDataUrl = '';
  const modal = document.getElementById('cloudConfigModal');
  const conf = settings[vendor.id] || {};

  // Header
  const logoEl = document.getElementById('configVendorLogo');
  if (conf.customLogo) {
    logoEl.innerHTML = `<img src="${conf.customLogo}" alt="logo" />`;
  } else {
    logoEl.innerHTML = `<div class="upload-placeholder"><span>${vendor.icon || '+'}</span>Logo</div>`;
    logoEl.style.background = (vendor.color || '#888') + '15';
  }
  document.getElementById('configVendorName').textContent = conf.customName || vendor.name;
  document.getElementById('configVendorDesc').textContent = vendor.desc || '';

  // Body
  const body = document.getElementById('cloudConfigBody');
  const models = conf.models || vendor.models || [];
  body.innerHTML = `
    <!-- 基本信息 -->
    <div class="config-form-group">
      <label>自定义名称</label>
      <input type="text" class="input" id="cfgName" value="${escapeHtml(conf.customName || vendor.name)}" placeholder="${vendor.name}" />
    </div>

    <div class="config-form-group">
      <label>API Key</label>
      <input type="password" class="input" id="cfgApiKey" value="${escapeHtml(conf.apiKey || '')}" placeholder="sk-..." />
    </div>

    <div class="config-form-group">
      <label>API 地址</label>
      <input type="text" class="input" id="cfgBaseUrl" value="${escapeHtml(conf.baseUrl || vendor.url || '')}" placeholder="https://api.example.com/v1" />
    </div>

    <!-- 模型列表 -->
    <div class="config-form-group">
      <label>模型列表 <span style="font-weight:400;color:var(--text-muted);">（点击 × 删除，下方添加新模型）</span></label>
      <div class="cloud-model-list" id="cfgModelList">
        ${models.map(m => `
          <div class="cloud-model-tag">
            <span class="model-tag-name">${escapeHtml(m)}</span>
            <button class="model-tag-remove" data-model="${escapeHtml(m)}">&times;</button>
          </div>
        `).join('')}
      </div>
      <div class="add-model-row">
        <input type="text" class="input" id="cfgNewModel" placeholder="输入模型 ID，如 gpt-4o" />
        <button class="btn btn-default" id="cfgAddModelBtn" style="border-radius: 10px; flex-shrink: 0;">+ 添加</button>
      </div>
    </div>

    <!-- 高级参数 -->
    <div class="config-form-group">
      <label>默认模型</label>
      <select class="input select" id="cfgDefaultModel">
        <option value="">-- 请选择 --</option>
        ${models.map(m => `<option value="${m}" ${conf.defaultModel === m ? 'selected' : ''}>${m}</option>`).join('')}
      </select>
    </div>

    <div class="config-form-row">
      <div class="config-form-group">
        <label>最大 Token 数</label>
        <input type="number" class="input" id="cfgMaxTokens" value="${conf.maxTokens || 4096}" min="1" max="1000000" />
      </div>
      <div class="config-form-group">
        <label>上下文窗口 (tokens)</label>
        <input type="number" class="input" id="cfgContextWindow" value="${conf.contextWindow || 4096}" min="1" />
      </div>
    </div>

    <div class="config-form-row">
      <div class="config-form-group">
        <label>Temperature <span style="font-weight:400;color:var(--text-muted);">创造力</span></label>
        <div class="range-row">
          <input type="range" id="cfgTemperature" min="0" max="2" step="0.1" value="${conf.temperature ?? 0.7}" />
          <span class="range-value" id="cfgTempVal">${conf.temperature ?? 0.7}</span>
        </div>
      </div>
      <div class="config-form-group">
        <label>Top P <span style="font-weight:400;color:var(--text-muted);">采样</span></label>
        <div class="range-row">
          <input type="range" id="cfgTopP" min="0" max="1" step="0.05" value="${conf.topP ?? 1}" />
          <span class="range-value" id="cfgTopPVal">${conf.topP ?? 1}</span>
        </div>
      </div>
    </div>

    <div class="config-form-group">
      <label>系统提示词 (System Prompt)</label>
      <textarea class="input" id="cfgSystemPrompt" rows="3" style="resize: vertical;" placeholder="可选，全局系统提示词...">${escapeHtml(conf.systemPrompt || '')}</textarea>
    </div>

    <div class="config-form-row">
      <div class="config-form-group">
        <label style="display:flex;align-items:center;gap:8px;">
          启用流式输出
          <label class="switch" style="margin:0;">
            <input type="checkbox" id="cfgStream" ${conf.stream !== false ? 'checked' : ''} />
            <span class="switch-slider"></span>
          </label>
        </label>
      </div>
      <div class="config-form-group">
        <label>超时时间 (秒)</label>
        <input type="number" class="input" id="cfgTimeout" value="${conf.timeout || 60}" min="5" max="600" />
      </div>
    </div>
  `;

  // 滑块实时显示
  body.querySelector('#cfgTemperature').addEventListener('input', (e) => {
    body.querySelector('#cfgTempVal').textContent = e.target.value;
  });
  body.querySelector('#cfgTopP').addEventListener('input', (e) => {
    body.querySelector('#cfgTopPVal').textContent = e.target.value;
  });

  // 模型列表删除
  body.querySelectorAll('.model-tag-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.cloud-model-tag').remove();
    });
  });

  // 添加模型
  body.querySelector('#cfgAddModelBtn').addEventListener('click', () => {
    const input = body.querySelector('#cfgNewModel');
    const name = input.value.trim();
    if (!name) return;
    const list = body.querySelector('#cfgModelList');
    const tag = document.createElement('div');
    tag.className = 'cloud-model-tag';
    tag.innerHTML = `<span class="model-tag-name">${escapeHtml(name)}</span><button class="model-tag-remove">&times;</button>`;
    tag.querySelector('.model-tag-remove').addEventListener('click', () => tag.remove());
    list.appendChild(tag);
    // 同时加入 select
    const sel = body.querySelector('#cfgDefaultModel');
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    sel.appendChild(opt);
    input.value = '';
  });

  // 保存按钮
  const saveBtn = document.getElementById('saveCloudConfig');
  const newSaveBtn = saveBtn.cloneNode(true);
  saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
  newSaveBtn.addEventListener('click', () => saveCloudConfig(vendor));

  // 删除按钮
  const delBtn = document.getElementById('deleteCloudConfig');
  const newDelBtn = delBtn.cloneNode(true);
  delBtn.parentNode.replaceChild(newDelBtn, delBtn);
  if (vendor.id === '_custom') {
    newDelBtn.style.display = 'none';
  } else {
    newDelBtn.style.display = '';
    newDelBtn.addEventListener('click', async () => {
      try {
        await window.openClaw.model.removeModel?.(vendor.id);
        delete settings[vendor.id];
        modal.classList.remove('visible');
        renderCloudVendors();
        window.__toast?.success('配置已删除');
      } catch(e) { window.__toast?.error(e.message); }
    });
  }

  modal.classList.add('visible');
}

async function saveCloudConfig(vendor) {
  const body = document.getElementById('cloudConfigBody');
  const modelTags = body.querySelectorAll('.cloud-model-tag .model-tag-name');
  const models = Array.from(modelTags).map(el => el.textContent.trim()).filter(Boolean);

  const config = {
    customName: body.querySelector('#cfgName').value.trim() || vendor.name,
    apiKey: body.querySelector('#cfgApiKey').value.trim(),
    baseUrl: body.querySelector('#cfgBaseUrl').value.trim() || vendor.url,
    models: models,
    defaultModel: body.querySelector('#cfgDefaultModel').value,
    maxTokens: parseInt(body.querySelector('#cfgMaxTokens').value) || 4096,
    contextWindow: parseInt(body.querySelector('#cfgContextWindow').value) || 4096,
    temperature: parseFloat(body.querySelector('#cfgTemperature').value),
    topP: parseFloat(body.querySelector('#cfgTopP').value),
    systemPrompt: body.querySelector('#cfgSystemPrompt').value,
    stream: body.querySelector('#cfgStream').checked,
    timeout: parseInt(body.querySelector('#cfgTimeout').value) || 60,
    customLogo: currentLogoDataUrl || settings[vendor.id]?.customLogo || '',
  };

  try {
    await window.openClaw.model.addModel({
      id: vendor.id === '_custom' ? `custom_${Date.now()}` : vendor.id,
      name: config.customName,
      type: 'cloud',
      provider: vendor.name,
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      modelName: config.defaultModel || models[0] || vendor.id,
      maxTokens: config.maxTokens,
      temperature: config.temperature,
    });
    settings[vendor.id] = config;
    window.__toast?.success(`${config.customName} 配置已保存！`);
    document.getElementById('cloudConfigModal').classList.remove('visible');
    renderCloudVendors();
  } catch(e) {
    window.__toast?.error('保存失败: ' + e.message);
  }
}

// ==================== Logo 上传与压缩 ====================
function handleLogoUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    compressAndSetLogo(ev.target.result);
  };
  reader.readAsDataURL(file);
  e.target.value = ''; // reset
}

function compressAndSetLogo(dataUrl) {
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    const MAX = 128; // 最大 128px
    let w = img.width, h = img.height;
    if (w > MAX || h > MAX) {
      const ratio = Math.min(MAX / w, MAX / h);
      w = Math.round(w * ratio);
      h = Math.round(h * ratio);
    }
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    const compressed = canvas.toDataURL('image/webp', 0.7); // WebP 格式，70% 质量
    currentLogoDataUrl = compressed;
    const logoEl = document.getElementById('configVendorLogo');
    logoEl.innerHTML = `<img src="${compressed}" alt="logo" />`;
    window.__toast?.success('Logo 已压缩并设置');
  };
  img.src = dataUrl;
}

// ==================== 本地运行时检测 ====================
async function detectLocalRuntimes() {
  const ollamaStatus = document.getElementById('ollamaStatus');
  const lmstudioStatus = document.getElementById('lmstudioStatus');

  try {
    localStatus = await window.openClaw.model.detectLocal();
  } catch(e) {
    localStatus = { ollama: { running: false, models: [] }, lmstudio: { running: false, models: [] } };
  }

  if (localStatus.ollama.running) {
    ollamaStatus.style.background = 'rgba(52,199,89,0.12)';
    ollamaStatus.style.color = 'var(--success)';
    ollamaStatus.style.border = '1px solid rgba(52,199,89,0.3)';
    ollamaStatus.textContent = `● 已连接 · ${localStatus.ollama.models.length} 个模型`;
    document.getElementById('ollamaActions').innerHTML = `
      <button class="btn btn-primary ollama-manage-btn" style="flex:1;border-radius:10px;font-weight:600;font-size:12px;">管理模型</button>
      <button class="btn btn-default ollama-reload-btn" style="border-radius:10px;font-size:12px;">🔄 刷新</button>
    `;
    document.querySelector('.ollama-manage-btn').addEventListener('click', () => openLocalModelsModal('ollama'));
    document.querySelector('.ollama-reload-btn').addEventListener('click', detectLocalRuntimes);
  } else {
    ollamaStatus.style.background = 'rgba(255,59,48,0.1)';
    ollamaStatus.style.color = 'var(--danger)';
    ollamaStatus.style.border = '1px solid rgba(255,59,48,0.2)';
    ollamaStatus.textContent = '○ 未运行';
    document.getElementById('ollamaActions').innerHTML = `
      <button class="btn btn-primary ollama-install-btn" style="flex:1;border-radius:10px;font-weight:600;font-size:12px;">📥 安装 Ollama</button>
    `;
    document.querySelector('.ollama-install-btn').addEventListener('click', () => openInstallGuide('ollama'));
  }

  if (localStatus.lmstudio.running) {
    lmstudioStatus.style.background = 'rgba(52,199,89,0.12)';
    lmstudioStatus.style.color = 'var(--success)';
    lmstudioStatus.style.border = '1px solid rgba(52,199,89,0.3)';
    lmstudioStatus.textContent = `● 已连接 · ${localStatus.lmstudio.models.length} 个模型`;
    document.getElementById('lmstudioActions').innerHTML = `
      <button class="btn btn-primary lm-manage-btn" style="flex:1;border-radius:10px;font-weight:600;font-size:12px;">管理模型</button>
      <button class="btn btn-default lm-reload-btn" style="border-radius:10px;font-size:12px;">🔄 刷新</button>
    `;
    document.querySelector('.lm-manage-btn').addEventListener('click', () => openLocalModelsModal('lmstudio'));
    document.querySelector('.lm-reload-btn').addEventListener('click', detectLocalRuntimes);
  } else {
    lmstudioStatus.style.background = 'rgba(255,59,48,0.1)';
    lmstudioStatus.style.color = 'var(--danger)';
    lmstudioStatus.style.border = '1px solid rgba(255,59,48,0.2)';
    lmstudioStatus.textContent = '○ 未运行';
    document.getElementById('lmstudioActions').innerHTML = `
      <button class="btn btn-primary lm-install-btn" style="flex:1;border-radius:10px;font-weight:600;font-size:12px;">📥 安装 LM Studio</button>
    `;
    document.querySelector('.lm-install-btn').addEventListener('click', () => openInstallGuide('lmstudio'));
  }
}

// ==================== 模型大市场加载 ====================
async function loadModelMarket() {
  const container = document.getElementById('modelMarketContainer');
  try {
    const data = await window.openClaw.model.getMarketplace();
    const models = data.models || [];
    if (models.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted);">暂无可用模型</div>';
      return;
    }
    container.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px;">
        ${models.map(p => `
          <div style="background: var(--bg-card); border: 1px solid var(--border-light); border-radius: 12px; padding: 16px; text-align: center; cursor: pointer; transition: all 0.2s;" class="market-provider-card" data-provider='${JSON.stringify(p).replace(/'/g, "&#39;")}'>
            <div style="font-size: 28px; margin-bottom: 8px;">${p.logo || '🤖'}</div>
            <div style="font-size: 14px; font-weight: 600; margin-bottom: 4px;">${escapeHtml(p.provider)}</div>
            <div style="font-size: 11px; color: var(--text-muted);">${p.series?.length || 0} 个系列</div>
          </div>
        `).join('')}
      </div>
    `;
    container.querySelectorAll('.market-provider-card').forEach(card => {
      card.addEventListener('click', () => {
        try { openMarketDetail(JSON.parse(card.dataset.provider)); } catch(e) { console.error(e); }
      });
      card.addEventListener('mouseenter', () => { card.style.transform = 'translateY(-2px)'; card.style.boxShadow = 'var(--shadow-md)'; });
      card.addEventListener('mouseleave', () => { card.style.transform = ''; card.style.boxShadow = ''; });
    });
  } catch(e) {
    container.innerHTML = `<div style="text-align:center;padding:30px;color:var(--danger);">加载失败: ${e.message}</div>`;
  }
}

function openMarketDetail(provider) {
  const container = document.getElementById('modelMarketContainer');
  container.innerHTML = `
    <div style="margin-bottom: 16px;">
      <span style="color: var(--primary); cursor: pointer; font-size: 13px;" id="marketBackBtn">← 返回</span>
      <h3 style="margin: 8px 0 0; font-size: 18px; font-weight: 600;">${provider.logo || '🤖'} ${escapeHtml(provider.provider)}</h3>
    </div>
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px;" id="marketSeriesGrid"></div>
  `;
  document.getElementById('marketBackBtn').addEventListener('click', loadModelMarket);
  const grid = document.getElementById('marketSeriesGrid');
  (provider.series || []).forEach(series => {
    const card = document.createElement('div');
    card.style.cssText = 'background:var(--bg-card);border:1px solid var(--border-light);border-radius:12px;padding:16px;cursor:pointer;transition:all 0.2s;';
    card.innerHTML = `
      <div style="font-size:15px;font-weight:600;margin-bottom:4px;">${escapeHtml(series.name)}</div>
      <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;">${escapeHtml(series.description || '')}</div>
      <div style="font-size:11px;color:var(--primary);background:var(--primary-light);display:inline-block;padding:2px 8px;border-radius:4px;">${series.versions?.length || 0} 个版本</div>
    `;
    card.addEventListener('mouseenter', () => { card.style.borderColor = 'var(--primary)'; });
    card.addEventListener('mouseleave', () => { card.style.borderColor = 'var(--border-light)'; });
    card.addEventListener('click', () => openMarketVersions(provider, series));
    grid.appendChild(card);
  });
}

function openMarketVersions(provider, series) {
  const container = document.getElementById('modelMarketContainer');
  container.innerHTML = `
    <div style="margin-bottom: 16px;">
      <span style="color: var(--primary); cursor: pointer; font-size: 13px;" id="marketBackBtn2">← ${escapeHtml(provider.provider)}</span>
      <h3 style="margin: 8px 0 4px; font-size: 18px; font-weight: 600;">${escapeHtml(series.name)}</h3>
      <p style="color:var(--text-muted);font-size:13px;margin:0;">${escapeHtml(series.description || '')}</p>
    </div>
    <div style="display: flex; flex-direction: column; gap: 10px;" id="marketVersionList"></div>
  `;
  document.getElementById('marketBackBtn2').addEventListener('click', () => openMarketDetail(provider));
  const list = document.getElementById('marketVersionList');
  (series.versions || []).forEach(version => {
    const item = document.createElement('div');
    item.style.cssText = 'background:var(--bg-card);border:1px solid var(--border-light);border-radius:12px;padding:14px 18px;display:flex;align-items:center;justify-content:space-between;transition:all 0.2s;';
    const comp = version.compatibility || {};
    const color = comp.level === 'success' ? '#34c759' : comp.level === 'warning' ? '#ff9500' : '#ff3b30';
    item.innerHTML = `
      <div>
        <div style="font-size:14px;font-weight:600;margin-bottom:4px;">${escapeHtml(version.name)}</div>
        <div style="font-size:12px;color:var(--text-muted);display:flex;gap:12px;">
          <span>📦 ${version.sizeGB} GB</span>
          <span style="color:${color};">${comp.message || ''}</span>
        </div>
      </div>
      <button class="btn btn-primary market-download-btn" data-version='${JSON.stringify(version).replace(/'/g, "&#39;")}' style="border-radius:10px;font-size:12px;">下载安装</button>
    `;
    item.addEventListener('mouseenter', () => { item.style.borderColor = 'var(--primary)'; });
    item.addEventListener('mouseleave', () => { item.style.borderColor = 'var(--border-light)'; });
    list.appendChild(item);
  });
  list.querySelectorAll('.market-download-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      try { startMarketDownload(JSON.parse(btn.dataset.version), btn); } catch(e) { console.error(e); }
    });
  });
}

async function startMarketDownload(version, btn) {
  btn.disabled = true;
  btn.textContent = '下载中...';
  try {
    const req = await fetch('http://localhost:3721/api/models/pull', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modelName: version.id, ggufUrl: version.ggufUrl })
    });
    if (!req.ok) throw new Error('请求后端失败');
    const reader = req.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const data = JSON.parse(line.slice(6));
          if (data.error) throw new Error(data.error);
          if (data.status === 'success') {
            btn.textContent = '✓ 已安装';
            btn.style.background = 'var(--success)';
            window.__toast?.success(`${version.name} 安装完成`);
            return;
          }
          if (data.status === 'downloading') btn.textContent = `下载中 ${data.detail || ''}`;
        } catch(e) { console.warn('SSE parse:', e); }
      }
    }
  } catch(e) {
    btn.textContent = '重试';
    btn.disabled = false;
    window.__toast?.error('下载失败: ' + e.message);
  }
}

// ==================== 安装引导弹窗 ====================
function openInstallGuide(provider) {
  const modal = document.getElementById('installGuideModal');
  const title = document.getElementById('installGuideTitle');
  const body = document.getElementById('installGuideBody');

  const guides = {
    ollama: {
      title: '🦙 安装 Ollama',
      url: 'https://ollama.com/download',
      steps: [
        { step: 1, text: '点击下方按钮前往 Ollama 官网下载安装包' },
        { step: 2, text: '运行安装程序，按向导完成安装（全程 Next 即可）' },
        { step: 3, text: '安装完成后 Ollama 会自动启动（系统托盘可见图标）' },
        { step: 4, text: '回到本页面，点击「刷新」按钮检测连接状态' },
      ],
      tip: '💡 安装后可在终端运行 ollama pull llama3 快速下载模型',
    },
    lmstudio: {
      title: '💻 安装 LM Studio',
      url: 'https://lmstudio.ai/',
      steps: [
        { step: 1, text: '点击下方按钮前往 LM Studio 官网下载安装包' },
        { step: 2, text: '运行安装程序，选择安装目录后完成安装' },
        { step: 3, text: '打开 LM Studio，搜索并下载一个 GGUF 模型' },
        { step: 4, text: '加载模型后启动本地服务（默认端口 1234）' },
        { step: 5, text: '回到本页面，点击「刷新」按钮检测连接状态' },
      ],
      tip: '💡 推荐从 ModelScope 国内镜像下载，速度更快',
    },
  };

  const guide = guides[provider];
  title.textContent = guide.title;

  body.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 16px;">
      ${guide.steps.map(s => `
        <div style="display: flex; align-items: flex-start; gap: 12px;">
          <div style="width: 28px; height: 28px; border-radius: 50%; background: var(--primary-light); color: var(--primary); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; flex-shrink: 0;">${s.step}</div>
          <div style="font-size: 14px; color: var(--text-primary); line-height: 1.6; padding-top: 3px;">${s.text}</div>
        </div>
      `).join('')}
      <div style="background: rgba(0,122,255,0.06); border: 1px solid rgba(0,122,255,0.15); border-radius: 12px; padding: 12px 16px; font-size: 13px; color: var(--primary); margin-top: 4px;">
        ${guide.tip}
      </div>
      <div style="display: flex; gap: 12px; margin-top: 8px;">
        <button class="btn btn-default" onclick="document.getElementById('installGuideModal').style.display='none'" style="flex:1;border-radius:12px;">取消</button>
        <button class="btn btn-primary" id="goDownloadBtn" style="flex:1;border-radius:12px;font-weight:600;">🌐 前往下载</button>
      </div>
    </div>
  `;

  document.getElementById('goDownloadBtn').addEventListener('click', () => {
    if (window.openClaw?.system?.openExternal) {
      window.openClaw.system.openExternal(guide.url);
    } else {
      window.open(guide.url, '_blank');
    }
  });

  modal.style.display = 'flex';
}

// ==================== 本地模型列表弹窗 ====================
async function openLocalModelsModal(provider) {
  const modal = document.getElementById('localModelsModal');
  const title = document.getElementById('localModelsTitle');
  const body = document.getElementById('localModelsBody');

  const isOllama = provider === 'ollama';
  title.textContent = isOllama ? '🦙 Ollama 已部署模型' : '💻 LM Studio 已加载模型';
  body.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-muted);">加载中...</div>';
  modal.style.display = 'flex';

  let models = [];
  try {
    if (isOllama) {
      const res = await window.openClaw.model.getOllamaModels();
      models = res.models || [];
    } else {
      const res = await window.openClaw.model.getLMStudioModels();
      models = res.models || [];
    }
  } catch(e) {
    body.innerHTML = `<div style="text-align:center;padding:40px;color:var(--danger);">加载失败: ${e.message}</div>`;
    return;
  }

  if (models.length === 0) {
    body.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--text-muted);">
        <div style="font-size: 48px; margin-bottom: 16px;">📭</div>
        <div style="font-size: 15px; margin-bottom: 8px;">暂无已部署的模型</div>
        <div style="font-size: 13px;">${isOllama ? '请先运行 ollama pull <模型名> 下载模型' : '请在 LM Studio 中加载一个模型'}</div>
      </div>
    `;
    return;
  }

  body.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 12px;">
      ${models.map(m => {
        const isDefault = activeModelId === m.id || activeModelId === (isOllama ? m.id : `lmstudio_${m.id}`);
        return `
        <div class="local-model-item" data-id="${m.id}" data-name="${m.name}" style="background: var(--bg-card); border: 1.5px solid ${isDefault ? 'var(--primary)' : 'var(--border-light)'}; border-radius: 14px; padding: 16px 20px; display: flex; align-items: center; justify-content: space-between; transition: all 0.2s; ${isDefault ? 'box-shadow: 0 0 0 3px var(--primary-light);' : ''}">
          <div style="display: flex; align-items: center; gap: 14px;">
            <div style="width: 40px; height: 40px; background: ${isDefault ? 'var(--primary)' : 'var(--bg-hover)'}; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 18px; color: ${isDefault ? '#fff' : 'var(--text-primary)'};">${isOllama ? '🦙' : '💻'}</div>
            <div>
              <div style="font-size: 15px; font-weight: 600;">${escapeHtml(m.name)}</div>
              <div style="font-size: 12px; color: var(--text-muted); display: flex; gap: 12px; margin-top: 2px;">
                ${m.size ? `<span>📦 ${m.size}</span>` : ''}
                ${m.parameterSize ? `<span>🔢 ${m.parameterSize}</span>` : ''}
                ${m.family ? `<span>👨‍👩‍👧 ${m.family}</span>` : ''}
                ${m.owned_by ? `<span>🏷️ ${m.owned_by}</span>` : ''}
                ${isDefault ? '<span style="color: var(--primary); font-weight: 600;">⭐ 默认模型</span>' : ''}
              </div>
            </div>
          </div>
          <div style="display: flex; gap: 8px;">
            ${!isDefault ? `<button class="btn btn-primary set-default-btn" data-provider="${provider}" data-id="${m.id}" data-name="${m.name}" style="border-radius: 10px; font-size: 12px; padding: 6px 14px;">设为默认</button>` : ''}
            <button class="btn btn-default use-model-btn" data-provider="${provider}" data-id="${m.id}" data-name="${m.name}" style="border-radius: 10px; font-size: 12px; padding: 6px 14px;">使用</button>
          </div>
        </div>
      `}).join('')}
    </div>
  `;

  // 设为默认
  body.querySelectorAll('.set-default-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        await window.openClaw.model.addLocalModel(btn.dataset.provider, btn.dataset.id, btn.dataset.name, true);
        activeModelId = btn.dataset.provider === 'ollama' ? btn.dataset.id : `lmstudio_${btn.dataset.id}`;
        if (window.__toast) window.__toast.success(`已将 ${btn.dataset.name} 设为默认模型`);
        openLocalModelsModal(provider); // 刷新列表
      } catch(e) { if (window.__toast) window.__toast.error(e.message); }
    });
  });

  // 使用模型
  body.querySelectorAll('.use-model-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        await window.openClaw.model.addLocalModel(btn.dataset.provider, btn.dataset.id, btn.dataset.name, false);
        if (window.__toast) window.__toast.success(`已添加模型 ${btn.dataset.name}`);
      } catch(e) { if (window.__toast) window.__toast.error(e.message); }
    });
  });
}

function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

