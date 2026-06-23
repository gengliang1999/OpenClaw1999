/**
 * 模型市场 (Model Market) v3
 * 上方：云端模型服务（国内外主流厂商 + 详细配置）
 * 下方：本地运行时检测 + 模型大市场（可滚动）
 */

let settings = {};
let localStatus = { ollama: { running: false, models: [] }, lmstudio: { running: false, models: [] } };
let activeModelId = '';

// 国内外主流云端模型厂商（模型列表通过 API 拉取）
const cloudVendors = [
  { id: 'openai', name: 'OpenAI', icon: '🌌', color: '#10a37f', desc: 'GPT-4o、GPT-4-Turbo、o1 系列旗舰模型', url: 'https://api.openai.com/v1' },
  { id: 'anthropic', name: 'Anthropic', icon: '🧠', color: '#d97757', desc: 'Claude 4 Opus/Sonnet 等强力推理模型', url: 'https://api.anthropic.com/v1' },
  { id: 'gemini', name: 'Google Gemini', icon: '✨', color: '#4285f4', desc: 'Gemini 2.0/1.5 Pro 多模态系列', url: 'https://generativelanguage.googleapis.com/v1beta' },
  { id: 'groq', name: 'Groq', icon: '⚡', color: '#f55036', desc: '超高速推理，LPU 加速芯片', url: 'https://api.groq.com/openai/v1' },
  { id: 'mistral', name: 'Mistral AI', icon: '🌀', color: '#ff7000', desc: 'Mistral Large/Medium 系列，欧洲领先', url: 'https://api.mistral.ai/v1' },
  { id: 'deepseek', name: 'DeepSeek', icon: '🐳', color: '#4d6bfe', desc: '深度求索，高性价比代码与推理模型', url: 'https://api.deepseek.com/v1' },
  { id: 'qwen', name: '通义千问', icon: '☁️', color: '#615ced', desc: '阿里云 Qwen 全系列，QwQ 推理模型', url: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
  { id: 'zhipu', name: '智谱 AI', icon: '🔮', color: '#3269ff', desc: 'GLM-4 / GLM-4V 多模态系列', url: 'https://open.bigmodel.cn/api/paas/v4' },
  { id: 'moonshot', name: '月之暗面 (Kimi)', icon: '🌙', color: '#000', desc: 'Kimi 长文本理解，128K 上下文', url: 'https://api.moonshot.cn/v1' },
  { id: 'baidu', name: '百度文心', icon: '🐻', color: '#2932e1', desc: '文心大模型 4.5 系列，中文能力突出', url: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop' },
  { id: 'bytedance', name: '豆包 (字节)', icon: '🫘', color: '#fe2c55', desc: '字节跳动豆包大模型，Doubao 系列', url: 'https://ark.cn-beijing.volces.com/api/v3' },
  { id: 'minimax', name: 'MiniMax', icon: '🔵', color: '#1677ff', desc: 'MiniMax abab 系列，擅长角色扮演', url: 'https://api.minimax.chat/v1' },
  { id: 'iflytek', name: '讯飞星火', icon: '🔥', color: '#ff6a00', desc: '科大讯飞星火大模型，语音+文本', url: 'https://spark-api-open.xf-yun.com/v1' },
  { id: 'yi', name: '零一万物', icon: '🌱', color: '#00c853', desc: 'Yi 系列模型，高性价比', url: 'https://api.lingyiwanwu.com/v1' },
];

export async function render(container) {
  try { settings = (await window.openClaw.settings.getAll()) || {}; } catch(e) { settings = {}; }
  try { const am = await window.openClaw.model.getActiveModel(); activeModelId = am?.id || ''; } catch(e) {}

  container.style.padding = '0';
  container.style.overflow = 'auto';

  container.innerHTML = `
    <div class="model-market-page">
      <!-- 页面标题 -->
      <div style="margin-bottom: 28px;">
        <h2 style="margin: 0 0 6px 0; font-size: 26px; font-weight: 700; letter-spacing: -0.5px;">🛒 模型市场</h2>
        <p style="margin: 0; color: var(--text-muted); font-size: 13px;">一站式管理云端 API、本地运行时与开源模型。</p>
      </div>

      <!-- Section 1: 云端模型 -->
      <div class="market-section-block">
        <div class="market-section-header">
          <h3>
            <span class="section-bar" style="background: linear-gradient(180deg, #6c63ff, #af52de);"></span>
            云端模型
          </h3>
          <button id="addCustomModelBtn" class="btn btn-primary" style="padding: 6px 16px; border-radius: 10px; font-size: 12px; font-weight: 600;">+ 自定义模型</button>
        </div>
        <div class="cloud-vendor-grid" id="cloudVendorGrid"></div>
      </div>

      <!-- Section 2: 本地模型 -->
      <div class="market-section-block">
        <div class="market-section-header">
          <h3>
            <span class="section-bar" style="background: linear-gradient(180deg, #00d9ff, #6c63ff);"></span>
            本地模型
          </h3>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px;" id="localRuntimeGrid"></div>
      </div>

      <!-- Section 3: 模型下载平台 -->
      <div class="market-section-block">
        <div class="market-section-header">
          <h3>
            <span class="section-bar" style="background: linear-gradient(180deg, #34c759, #00d9ff);"></span>
            模型下载平台
          </h3>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px;" id="marketPlatformGrid"></div>
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
          <button class="btn btn-ghost" id="testConnectionBtn" style="border-radius: 10px;">🔗 测试连接</button>
          <button class="btn btn-primary" id="saveCloudConfig" style="border-radius: 10px; font-weight: 600; padding: 0 28px;">保存配置</button>
        </div>
      </div>
    </div>

    <!-- 安装引导 Modal -->
    <div id="installGuideModal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 99999; align-items: center; justify-content: center; backdrop-filter: blur(4px);">
      <div style="background: var(--bg-app); width: 520px; max-width: 90%; border-radius: 20px; box-shadow: 0 24px 48px rgba(0,0,0,0.25); overflow: hidden;">
        <div style="padding: 20px 24px; border-bottom: 1px solid var(--border-light); display: flex; justify-content: space-between; align-items: center;">
          <h3 style="margin: 0; font-size: 18px;" id="installGuideTitle">安装引导</h3>
          <button id="closeInstallGuide" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-muted);">&times;</button>
        </div>
        <div id="installGuideBody" style="padding: 24px;"></div>
      </div>
    </div>

    <!-- 本地模型列表 Modal -->
    <div id="localModelsModal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 99999; align-items: center; justify-content: center; backdrop-filter: blur(4px);">
      <div style="background: var(--bg-app); width: 600px; max-width: 90%; max-height: 80vh; border-radius: 20px; box-shadow: 0 24px 48px rgba(0,0,0,0.25); overflow: hidden; display: flex; flex-direction: column;">
        <div style="padding: 20px 24px; border-bottom: 1px solid var(--border-light); display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
          <h3 style="margin: 0; font-size: 18px;" id="localModelsTitle">已部署模型</h3>
          <button id="closeLocalModels" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-muted);">&times;</button>
        </div>
        <div id="localModelsBody" style="padding: 24px; overflow-y: auto; flex: 1;"></div>
      </div>
    </div>
  `;

  // 清理 body 上残留的旧模态框（页面每次导航都会重新 render）
  ['cloudConfigModal', 'installGuideModal', 'localModelsModal', 'logoFileInput'].forEach(id => {
    const old = document.getElementById(id);
    if (old && old.parentNode === document.body) old.remove();
  });

  // 将新创建的模态框从页面容器移到 body
  // 原因：.page 有 CSS animation 含 transform，会导致 position:fixed 子元素定位失效
  ['cloudConfigModal', 'installGuideModal', 'localModelsModal'].forEach(id => {
    const el = document.getElementById(id);
    if (el) document.body.appendChild(el);
  });

  // 隐藏的 file input for logo upload
  const logoInput = document.createElement('input');
  logoInput.type = 'file';
  logoInput.accept = 'image/*';
  logoInput.id = 'logoFileInput';
  logoInput.style.display = 'none';
  document.body.appendChild(logoInput);

  bindModalEvents();
  renderCloudVendors();
  renderLocalRuntimes();
  renderMarketPlatforms();
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

  // 内置厂商
  let html = cloudVendors.map(v => {
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

  // 自定义模型（settings 中以 custom_ 开头的）
  const customKeys = Object.keys(settings).filter(k => k.startsWith('custom_'));
  html += customKeys.map(key => {
    const conf = settings[key];
    const displayName = conf.customName || '自定义模型';
    const modelCount = conf.models?.length || 0;
    return `
    <div class="cloud-vendor-card" data-id="${key}">
      <div class="configured-dot"></div>
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
        <div class="vendor-logo" style="background: #88888815;">
          <span>➕</span>
        </div>
        <div class="vendor-info">
          <h4>${escapeHtml(displayName)}</h4>
          <div class="vendor-status">✅ ${modelCount} 个模型</div>
        </div>
      </div>
      <p class="vendor-desc">${escapeHtml(conf.baseUrl || '自定义 API')}</p>
    </div>
  `}).join('');

  grid.innerHTML = html;

  grid.querySelectorAll('.cloud-vendor-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.id;
      // 查找内置厂商或自定义模型
      const v = cloudVendors.find(x => x.id === id);
      if (v) {
        openCloudConfig(v);
      } else if (id.startsWith('custom_') && settings[id]) {
        // 自定义模型：构造 vendor 对象
        const conf = settings[id];
        openCloudConfig({
          id: id,
          name: conf.customName || '自定义模型',
          icon: '➕',
          color: '#888',
          desc: conf.baseUrl || '',
          url: conf.baseUrl || '',
        });
      }
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
  const models = conf.models || [];
  body.innerHTML = `
    <div class="config-form-group">
      <label>自定义名称</label>
      <input type="text" class="input" id="cfgName" value="${escapeHtml(conf.customName || vendor.name)}" placeholder="${vendor.name}" />
    </div>

    <div class="config-form-group">
      <label>API 地址</label>
      <input type="text" class="input" id="cfgBaseUrl" value="${escapeHtml(conf.baseUrl || vendor.url || '')}" placeholder="https://api.example.com/v1" />
    </div>

    <div class="config-form-group">
      <label>API Key</label>
      <input type="password" class="input" id="cfgApiKey" value="${escapeHtml(conf.apiKey || '')}" placeholder="sk-..." />
    </div>

    <div class="config-form-group">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
        <label style="margin: 0; display: inline;">模型列表</label>
        <button class="btn btn-default" id="cfgFetchModels" style="border-radius: 10px; font-size: 12px; padding: 4px 14px;">🔄 获取模型</button>
      </div>
      <div style="display: flex; gap: 8px; align-items: center;">
        <select class="input select" id="cfgModelSelect" style="flex: 1;">
          <option value="">-- 获取模型或手动输入 --</option>
        </select>
        <button class="btn btn-primary" id="cfgAddSelectedModel" style="border-radius: 10px; flex-shrink: 0; padding: 6px 14px;">添加</button>
      </div>
      <div class="cloud-model-list" id="cfgModelList" style="margin-top: 8px;">
        ${models.map(m => `
          <div class="cloud-model-tag">
            <span class="model-tag-name">${escapeHtml(m)}</span>
            <button class="model-tag-remove">&times;</button>
          </div>
        `).join('')}
      </div>
      <div id="cfgFetchStatus" style="font-size: 12px; margin-top: 6px; min-height: 18px;"></div>
    </div>

    <div class="config-form-group">
      <label>默认模型</label>
      <select class="input select" id="cfgDefaultModel">
        <option value="">-- 请选择 --</option>
        ${models.map(m => `<option value="${m}" ${conf.defaultModel === m ? 'selected' : ''}>${m}</option>`).join('')}
      </select>
    </div>

    <div class="config-form-group">
      <div style="display: flex; gap: 8px;">
        <input type="text" class="input" id="cfgNewModel" placeholder="手动输入模型 ID" style="flex: 1;" />
        <button class="btn btn-default" id="cfgAddModelBtn" style="border-radius: 10px; flex-shrink: 0;">+ 添加</button>
      </div>
    </div>

    <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--border-light); text-align: right;">
      <button class="btn btn-danger" id="deleteCloudConfig" style="border-radius: 10px; font-size: 12px;">🗑 删除配置</button>
    </div>
  `;

  // 模型列表删除
  body.querySelectorAll('.model-tag-remove').forEach(btn => {
    btn.addEventListener('click', () => { btn.closest('.cloud-model-tag').remove(); refreshModelSelect(); });
  });

  // 从下拉表选择并添加
  body.querySelector('#cfgAddSelectedModel').addEventListener('click', () => {
    const sel = body.querySelector('#cfgModelSelect');
    const val = sel.value;
    if (!val) { window.__toast?.error('请先选择一个模型'); return; }
    addModelToList(val);
    sel.value = '';
  });

  // 手动添加
  body.querySelector('#cfgAddModelBtn').addEventListener('click', () => {
    const input = body.querySelector('#cfgNewModel');
    const name = input.value.trim();
    if (!name) return;
    addModelToList(name);
    addModelToDropdown(name);
    input.value = '';
  });
  body.querySelector('#cfgNewModel').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); body.querySelector('#cfgAddModelBtn').click(); }
  });

  // 获取模型
  body.querySelector('#cfgFetchModels').addEventListener('click', () => fetchModelsFromApi());

  // 保存
  const saveBtn = document.getElementById('saveCloudConfig');
  const newSaveBtn = saveBtn.cloneNode(true);
  saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
  newSaveBtn.addEventListener('click', () => saveCloudConfig(vendor));

  // 测试连接
  const testBtn = document.getElementById('testConnectionBtn');
  const newTestBtn = testBtn.cloneNode(true);
  testBtn.parentNode.replaceChild(newTestBtn, testBtn);
  newTestBtn.addEventListener('click', () => testConnection());

  // 删除配置
  const delBtn = document.getElementById('deleteCloudConfig');
  delBtn.addEventListener('click', async () => {
    try {
      await window.openClaw.model.removeModel?.(vendor.id);
      delete settings[vendor.id];
      modal.classList.remove('visible');
      renderCloudVendors();
      window.__toast?.success('配置已删除');
    } catch(e) { window.__toast?.error(e.message); }
  });

  modal.classList.add('visible');
}

async function saveCloudConfig(vendor) {
  const body = document.getElementById('cloudConfigBody');
  const modelTags = body.querySelectorAll('.cloud-model-tag .model-tag-name');
  const models = Array.from(modelTags).map(el => el.textContent.trim()).filter(Boolean);
  const defaultModel = body.querySelector('#cfgDefaultModel').value || models[0] || '';
  const customName = body.querySelector('#cfgName').value.trim() || vendor.name;
  const apiKey = body.querySelector('#cfgApiKey').value.trim();
  const baseUrl = body.querySelector('#cfgBaseUrl').value.trim() || vendor.url;

  if (!apiKey && !baseUrl) { window.__toast?.error('请填写 API 地址或 API Key'); return; }
  if (models.length === 0) { window.__toast?.error('请先获取或手动添加至少一个模型'); return; }
  if (!defaultModel) { window.__toast?.error('请选择一个默认模型'); return; }

  // 确定 settings key：自定义模型用 stable key（不再每次生成新的）
  let settingsKey = vendor.id;
  if (vendor.id === '_custom') {
    // 检查是否已有同名自定义模型
    const existing = Object.keys(settings).find(k => k.startsWith('custom_') && settings[k].customName === customName);
    settingsKey = existing || `custom_${Date.now()}`;
  }

  const config = { customName, apiKey, baseUrl, models, defaultModel, customLogo: currentLogoDataUrl || settings[settingsKey]?.customLogo || '' };

  try {
    await window.openClaw.model.addModel({
      id: settingsKey,
      name: customName,
      type: 'cloud',
      provider: 'Custom',
      apiKey,
      baseUrl,
      modelName: defaultModel,
    });
    settings[settingsKey] = config;
    // 持久化到存储（确保自定义模型不丢失）
    try { await window.openClaw.settings.set(settingsKey, config); } catch(e) { console.warn('settings.set 失败:', e); }
    window.__toast?.success(`${customName} 配置已保存！`);
    document.getElementById('cloudConfigModal').classList.remove('visible');
    renderCloudVendors();
  } catch(e) {
    window.__toast?.error('保存失败: ' + e.message);
  }
}

// ==================== 模型列表辅助 ====================
function addModelToList(name) {
  const list = document.getElementById('cfgModelList');
  if (!list) return;
  // 去重
  const existing = list.querySelectorAll('.model-tag-name');
  for (const el of existing) { if (el.textContent.trim() === name) return; }
  const tag = document.createElement('div');
  tag.className = 'cloud-model-tag';
  tag.style.cursor = 'pointer';
  tag.innerHTML = `<span class="model-tag-name">${escapeHtml(name)}</span><button class="model-tag-remove">&times;</button>`;
  // 点击选为默认模型
  tag.addEventListener('click', (e) => {
    if (e.target.classList.contains('model-tag-remove')) return;
    const sel = document.getElementById('cfgDefaultModel');
    if (sel) { sel.value = name; }
    // 高亮当前选中
    list.querySelectorAll('.cloud-model-tag').forEach(t => t.style.borderColor = 'var(--border-light)');
    tag.style.borderColor = 'var(--primary)';
  });
  tag.querySelector('.model-tag-remove').addEventListener('click', (e) => { e.stopPropagation(); tag.remove(); refreshModelSelect(); });
  list.appendChild(tag);
  refreshModelSelect();
}

function addModelToDropdown(name) {
  const sel = document.getElementById('cfgModelSelect');
  if (!sel) return;
  const opts = sel.querySelectorAll('option');
  for (const o of opts) { if (o.value === name) return; }
  const opt = document.createElement('option');
  opt.value = name;
  opt.textContent = name;
  sel.appendChild(opt);
}

function refreshModelSelect() {
  const list = document.getElementById('cfgModelList');
  const sel = document.getElementById('cfgDefaultModel');
  if (!list || !sel) return;
  const current = sel.value;
  const names = Array.from(list.querySelectorAll('.model-tag-name')).map(el => el.textContent.trim());
  sel.innerHTML = '<option value="">-- 请选择 --</option>' + names.map(n => `<option value="${escapeHtml(n)}" ${n === current ? 'selected' : ''}>${escapeHtml(n)}</option>`).join('');
}

// ==================== 从 API 拉取模型列表（通过后端代理） ====================
async function fetchModelsFromApi() {
  const statusEl = document.getElementById('cfgFetchStatus');
  const btn = document.getElementById('cfgFetchModels');
  const baseUrl = document.getElementById('cfgBaseUrl').value.trim();
  const apiKey = document.getElementById('cfgApiKey').value.trim();

  if (!baseUrl) { window.__toast?.error('请先填写 API 地址'); return; }

  btn.disabled = true;
  btn.textContent = '⏳ 拉取中...';
  statusEl.innerHTML = '<span style="color:var(--text-muted);">正在通过后端请求模型列表...</span>';

  try {
    const data = await window.openClaw.model.proxyFetchModels(baseUrl, apiKey);
    let modelIds = [];

    // OpenAI / DeepSeek / 通义千问 格式: { data: [{ id: "..." }] }
    if (Array.isArray(data.data)) {
      modelIds = data.data.map(m => m.id).filter(Boolean);
    }
    // 直接数组
    else if (Array.isArray(data)) {
      modelIds = data.map(m => typeof m === 'string' ? m : m.id || m.name).filter(Boolean);
    }
    // Ollama 格式: { models: [{ name: "..." }] }
    else if (Array.isArray(data.models)) {
      modelIds = data.models.map(m => m.name || m.id).filter(Boolean);
    }
    // Anthropic 格式: { data: [{ id: "claude-..." }] } 或 { models: [...] }
    else if (data.models && typeof data.models === 'object') {
      modelIds = Object.keys(data.models);
    }

    if (modelIds.length === 0) {
      statusEl.innerHTML = '<span style="color:var(--warning);">⚠ 未获取到模型，请检查 API 地址和 Key 是否正确</span>';
      return;
    }

    // 填入下拉表 + 已选标签
    const sel = document.getElementById('cfgModelSelect');
    if (sel) {
      sel.innerHTML = '<option value="">-- 请选择模型 --</option>';
      modelIds.forEach(id => {
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = id;
        sel.appendChild(opt);
      });
    }
    const list = document.getElementById('cfgModelList');
    list.innerHTML = '';
    modelIds.forEach(id => addModelToList(id));

    statusEl.innerHTML = `<span style="color:var(--success);">✅ 成功获取 ${modelIds.length} 个模型</span>`;
    window.__toast?.success(`已获取 ${modelIds.length} 个模型`);
  } catch(e) {
    statusEl.innerHTML = `<span style="color:var(--danger);">❌ ${e.message}</span>`;
    window.__toast?.error('获取模型失败: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '🔄 获取模型';
  }
}

// ==================== 连通测试（通过后端代理） ====================
async function testConnection() {
  const btn = document.getElementById('testConnectionBtn');
  const baseUrl = document.getElementById('cfgBaseUrl').value.trim();
  const apiKey = document.getElementById('cfgApiKey').value.trim();

  if (!baseUrl) { window.__toast?.error('请先填写 API 地址'); return; }

  btn.disabled = true;
  const origText = btn.textContent;
  btn.textContent = '⏳ 测试中...';

  try {
    const result = await window.openClaw.model.proxyTest(baseUrl, apiKey);
    if (result.ok) {
      window.__toast?.success(`✅ ${result.message}`);
    } else {
      window.__toast?.error(`❌ ${result.message}`);
    }
  } catch(e) {
    window.__toast?.error(`❌ 连接失败: ${e.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = origText;
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

// ==================== 模型下载平台 ====================
const marketPlatforms = [
  { id: 'modelscope', name: 'ModelScope 魔搭社区', icon: '🔴', color: '#ff3b30', desc: '国内主流开源模型平台，高速下载', url: 'https://modelscope.cn/models' },
  { id: 'ollama', name: 'Ollama Library', icon: '🦙', color: '#00d9ff', desc: '一键 ollama pull，最便捷', url: 'https://ollama.com/library' },
  { id: 'huggingface', name: 'HuggingFace', icon: '🤗', color: '#ff9f0a', desc: '全球最大开源模型社区', url: 'https://huggingface.co/models?sort=trending' },
  { id: 'hf-mirror', name: 'HF 镜像站', icon: '🪞', color: '#5856d6', desc: '国内 HuggingFace 镜像，高速下载', url: 'https://hf-mirror.com/models' },
  { id: 'wisemodel', name: '始智AI', icon: '🟢', color: '#34c759', desc: '国产中立开源模型平台', url: 'https://www.wisemodel.cn/models' },
  { id: 'openi', name: 'OpenI 启智', icon: '🔵', color: '#007aff', desc: '鹏城实验室开源 AI 社区', url: 'https://openi.pcl.ac.cn/models' },
];

// ==================== 本地运行时配置 ====================
const localRuntimes = [
  { id: 'ollama', name: 'Ollama', icon: '🦙', color1: '#00d9ff', color2: '#6c63ff', desc: '命令行本地模型框架', detail: '一键拉取 Llama、Qwen、DeepSeek 等开源模型，本地推理零延迟。', downloadUrl: 'https://ollama.com/download', detect: true },
  { id: 'lmstudio', name: 'LM Studio', icon: '💻', color1: '#ff9500', color2: '#ff2d55', desc: '可视化模型管理', detail: '支持 HuggingFace / ModelScope GGUF 模型，图形界面一键加载。', downloadUrl: 'https://lmstudio.ai/', detect: true },
  { id: 'gpt4all', name: 'GPT4All', icon: '🤖', color1: '#34c759', color2: '#00d9ff', desc: 'Nomic AI 出品，隐私优先', detail: '开箱即用的本地 AI 助手，无需 GPU，支持 CPU 推理。', downloadUrl: 'https://gpt4all.io/', detect: false },
  { id: 'jan', name: 'Jan', icon: '🪶', color1: '#af52de', color2: '#ff2d55', desc: 'Menlo 出品，类 ChatGPT 体验', detail: '完全离线运行，支持多模型切换，自带聊天界面。', downloadUrl: 'https://jan.ai/', detect: false },
  { id: 'localai', name: 'LocalAI', icon: '🔧', color1: '#ff9500', color2: '#ff3b30', desc: 'OpenAI API 兼容本地网关', detail: 'Drop-in 替代 OpenAI API，支持 LLM / 图片生成 / 音频。', downloadUrl: 'https://localai.io/', detect: false },
  { id: 'vllm', name: 'vLLM', icon: '⚡', color1: '#5856d6', color2: '#007aff', desc: '高吞吐量 GPU 推理引擎', detail: 'PagedAttention 优化，适合多卡服务器部署，吞吐量极高。', downloadUrl: 'https://docs.vllm.ai/', detect: false },
];

// 渲染本地运行时卡片（动态生成，统一布局）
function renderLocalRuntimes() {
  const grid = document.getElementById('localRuntimeGrid');
  if (!grid) return;

  grid.innerHTML = localRuntimes.map(rt => `
    <div class="local-rt-card" data-rt="${rt.id}" style="background: var(--bg-card); border: 1.5px solid var(--border-light); border-radius: 16px; padding: 20px; transition: all 0.25s; position: relative; overflow: hidden;">
      <div style="position: absolute; top: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, ${rt.color1}, ${rt.color2}); opacity: 0.5;"></div>
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 10px;">
        <div style="width: 42px; height: 42px; background: linear-gradient(135deg, ${rt.color1}20, ${rt.color2}20); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0;">${rt.icon}</div>
        <div style="flex: 1; min-width: 0;">
          <h3 style="margin: 0; font-size: 16px; font-weight: 700;">${rt.name}</h3>
          <div style="font-size: 11px; color: var(--text-muted);">${rt.desc}</div>
        </div>
        <div id="${rt.id}Status" style="font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 16px; flex-shrink: 0;">检测中...</div>
      </div>
      <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.4; margin-bottom: 10px;">${rt.detail}</div>
      <div id="${rt.id}Actions" style="display: flex; gap: 8px;"></div>
    </div>
  `).join('');

  // 检测状态
  detectAllRuntimes();
}

// 检测所有运行时状态
async function detectAllRuntimes() {
  // Ollama 和 LM Studio 通过后端检测
  try {
    localStatus = await window.openClaw.model.detectLocal();
  } catch(e) {
    localStatus = { ollama: { running: false, models: [] }, lmstudio: { running: false, models: [] } };
  }

  // Ollama
  updateRuntimeCard('ollama', localStatus.ollama.running, localStatus.ollama.models.length);

  // LM Studio
  updateRuntimeCard('lmstudio', localStatus.lmstudio.running, localStatus.lmstudio.models.length);

  // 其他运行时：未检测到，显示下载按钮
  ['gpt4all', 'jan', 'localai', 'vllm'].forEach(id => {
    updateRuntimeCard(id, false, 0);
  });
}

function updateRuntimeCard(rtId, running, modelCount) {
  const rt = localRuntimes.find(r => r.id === rtId);
  if (!rt) return;
  const statusEl = document.getElementById(`${rtId}Status`);
  const actionsEl = document.getElementById(`${rtId}Actions`);
  if (!statusEl || !actionsEl) return;

  if (running) {
    statusEl.style.background = 'rgba(52,199,89,0.12)';
    statusEl.style.color = 'var(--success)';
    statusEl.style.border = '1px solid rgba(52,199,89,0.3)';
    statusEl.textContent = `● 已连接 · ${modelCount} 个模型`;

    actionsEl.innerHTML = `
      <button class="btn btn-primary btn-sm local-manage-btn" data-rt="${rtId}" style="border-radius:8px; font-size:12px;">管理模型</button>
      <button class="btn btn-default btn-sm local-reload-btn" data-rt="${rtId}" style="border-radius:8px; font-size:12px;">🔄 刷新</button>
    `;
    actionsEl.querySelector('.local-manage-btn').addEventListener('click', () => openLocalModelsModal(rtId));
    actionsEl.querySelector('.local-reload-btn').addEventListener('click', detectAllRuntimes);
  } else {
    statusEl.style.background = 'rgba(255,59,48,0.1)';
    statusEl.style.color = 'var(--danger)';
    statusEl.style.border = '1px solid rgba(255,59,48,0.2)';
    statusEl.textContent = '○ 未运行';

    actionsEl.innerHTML = `
      <button class="btn btn-primary btn-sm local-download-btn" data-url="${rt.downloadUrl}" style="border-radius:8px; font-size:12px;">📥 下载 ${rt.name}</button>
    `;
    actionsEl.querySelector('.local-download-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      const url = e.currentTarget.dataset.url;
      if (window.openClaw?.system?.openExternal) window.openClaw.system.openExternal(url);
      else window.open(url, '_blank');
    });
  }
}

function renderMarketPlatforms() {
  const grid = document.getElementById('marketPlatformGrid');
  grid.innerHTML = marketPlatforms.map(p => `
    <div style="background:var(--bg-card); border:1.5px solid var(--border-light); border-radius:14px; padding:16px; cursor:pointer; transition:all 0.2s; display:flex; align-items:center; gap:12px;" class="platform-card" data-url="${p.url}">
      <div style="width:40px; height:40px; background:${p.color}15; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:20px; flex-shrink:0;">${p.icon}</div>
      <div style="flex:1; min-width:0;">
        <div style="font-size:14px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${p.name}</div>
        <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">${p.desc}</div>
      </div>
    </div>
  `).join('');
  grid.querySelectorAll('.platform-card').forEach(card => {
    card.addEventListener('click', () => {
      const url = card.dataset.url;
      if (window.openClaw?.system?.openExternal) window.openClaw.system.openExternal(url);
      else window.open(url, '_blank');
    });
    card.addEventListener('mouseenter', () => { card.style.transform = 'translateY(-2px)'; card.style.borderColor = 'var(--primary)'; card.style.boxShadow = 'var(--shadow-md)'; });
    card.addEventListener('mouseleave', () => { card.style.transform = ''; card.style.borderColor = 'var(--border-light)'; card.style.boxShadow = ''; });
  });
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
    <!-- 全选 + 批量删除 -->
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; padding:0 4px;">
      <label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer; color:var(--text-secondary);">
        <input type="checkbox" id="selectAllLocalModels" style="width:16px; height:16px; cursor:pointer;" /> 全选
      </label>
      <button class="btn btn-danger btn-sm" id="batchDeleteLocalModels" style="border-radius:8px; font-size:12px; display:none;">🗑 删除选中</button>
    </div>
    <div style="display: flex; flex-direction: column; gap: 10px;" id="localModelList">
      ${models.map(m => {
        const isDefault = activeModelId === m.id || activeModelId === (isOllama ? m.id : `lmstudio_${m.id}`);
        return `
        <div class="local-model-item" data-id="${m.id}" data-name="${m.name}" style="background: var(--bg-card); border: 1.5px solid ${isDefault ? 'var(--primary)' : 'var(--border-light)'}; border-radius: 12px; padding: 14px 18px; display: flex; align-items: center; gap: 12px; transition: all 0.2s; ${isDefault ? 'box-shadow: 0 0 0 3px var(--primary-light);' : ''}">
          <input type="checkbox" class="local-model-cb" data-id="${m.id}" data-name="${m.name}" style="width:16px; height:16px; cursor:pointer; flex-shrink:0;" />
          <div style="width:36px; height:36px; background:${isDefault ? 'var(--primary)' : 'var(--bg-hover)'}; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:16px; color:${isDefault ? '#fff' : 'var(--text-primary)'}; flex-shrink:0;">${isOllama ? '🦙' : '💻'}</div>
          <div style="flex:1; min-width:0;">
            <div style="font-size:14px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(m.name)}</div>
            <div style="font-size:11px; color:var(--text-muted); display:flex; gap:10px; margin-top:2px; flex-wrap:wrap;">
              ${m.size ? `<span>📦 ${m.size}</span>` : ''}
              ${m.parameterSize ? `<span>🔢 ${m.parameterSize}</span>` : ''}
              ${m.family ? `<span>👨‍👩‍👧 ${m.family}</span>` : ''}
              ${isDefault ? '<span style="color:var(--primary);font-weight:600;">⭐ 默认</span>' : ''}
            </div>
          </div>
          <div style="display:flex; gap:6px; flex-shrink:0;">
            ${!isDefault ? `<button class="btn btn-primary btn-sm set-default-btn" data-provider="${provider}" data-id="${m.id}" data-name="${m.name}" style="border-radius:8px;">设为默认</button>` : ''}
            <button class="btn btn-default btn-sm use-model-btn" data-provider="${provider}" data-id="${m.id}" data-name="${m.name}" style="border-radius:8px;">使用</button>
          </div>
        </div>
      `}).join('')}
    </div>
  `;

  // 全选逻辑
  const selectAll = document.getElementById('selectAllLocalModels');
  const batchBtn = document.getElementById('batchDeleteLocalModels');
  const checkboxes = body.querySelectorAll('.local-model-cb');

  function updateBatchBtn() {
    const checked = body.querySelectorAll('.local-model-cb:checked');
    batchBtn.style.display = checked.length > 0 ? '' : 'none';
    batchBtn.textContent = `🗑 删除选中 (${checked.length})`;
    selectAll.checked = checked.length === checkboxes.length && checkboxes.length > 0;
  }

  selectAll.addEventListener('change', () => {
    checkboxes.forEach(cb => { cb.checked = selectAll.checked; });
    updateBatchBtn();
  });
  checkboxes.forEach(cb => cb.addEventListener('change', updateBatchBtn));

  // 批量删除
  batchBtn.addEventListener('click', async () => {
    const checked = body.querySelectorAll('.local-model-cb:checked');
    if (checked.length === 0) return;
    if (!confirm(`确定要删除 ${checked.length} 个模型吗？此操作不可恢复。`)) return;

    let success = 0, fail = 0;
    for (const cb of checked) {
      try {
        await window.openClaw.model.deleteLocalModel(provider, cb.dataset.id);
        success++;
      } catch(e) { fail++; console.warn('删除失败:', cb.dataset.id, e); }
    }

    if (success > 0) window.__toast?.success(`已删除 ${success} 个模型`);
    if (fail > 0) window.__toast?.error(`${fail} 个模型删除失败`);
    openLocalModelsModal(provider); // 刷新列表
  });

  // 设为默认
  body.querySelectorAll('.set-default-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        await window.openClaw.model.addLocalModel(btn.dataset.provider, btn.dataset.id, btn.dataset.name, true);
        activeModelId = btn.dataset.provider === 'ollama' ? btn.dataset.id : `lmstudio_${btn.dataset.id}`;
        window.__toast?.success(`已将 ${btn.dataset.name} 设为默认模型`);
        openLocalModelsModal(provider);
      } catch(e) { window.__toast?.error(e.message); }
    });
  });

  // 使用
  body.querySelectorAll('.use-model-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        await window.openClaw.model.addLocalModel(btn.dataset.provider, btn.dataset.id, btn.dataset.name, false);
        window.__toast?.success(`已添加模型 ${btn.dataset.name}`);
      } catch(e) { window.__toast?.error(e.message); }
    });
  });
}

function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

