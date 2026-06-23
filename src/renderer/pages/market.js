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

      <!-- Section 1: 云端模型服务 -->
      <div class="market-section-block">
        <div class="market-section-header">
          <h3>
            <span class="section-bar" style="background: linear-gradient(180deg, #6c63ff, #af52de);"></span>
            云端模型服务
          </h3>
          <button id="addCustomModelBtn" class="btn btn-primary" style="padding: 6px 16px; border-radius: 10px; font-size: 12px; font-weight: 600;">+ 自定义模型</button>
        </div>
        <div class="cloud-vendor-grid" id="cloudVendorGrid"></div>
      </div>

      <!-- Section 2: 本地模型运行时 -->
      <div class="market-section-block">
        <div class="market-section-header">
          <h3>
            <span class="section-bar" style="background: linear-gradient(180deg, #00d9ff, #6c63ff);"></span>
            本地模型运行时
          </h3>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px;" id="localRuntimeGrid">
          <!-- Ollama -->
          <div id="ollamaCard" style="background: var(--bg-card); border: 1.5px solid var(--border-light); border-radius: 16px; padding: 20px; cursor: pointer; transition: all 0.25s; position: relative; overflow: hidden;">
            <div style="position: absolute; top: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, #00d9ff, #6c63ff); opacity: 0.5;"></div>
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 10px;">
              <div style="width: 42px; height: 42px; background: linear-gradient(135deg, rgba(0,217,255,0.15), rgba(108,99,255,0.15)); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 20px;">🦙</div>
              <div style="flex: 1;">
                <h3 style="margin: 0; font-size: 16px; font-weight: 700;">Ollama</h3>
                <div style="font-size: 11px; color: var(--text-muted);">命令行本地模型框架</div>
              </div>
              <div id="ollamaStatus" style="font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 16px;">检测中...</div>
            </div>
            <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.4; margin-bottom: 10px;">一键拉取 Llama、Qwen、DeepSeek 等开源模型，本地推理零延迟。</div>
            <div id="ollamaActions" style="display: flex; gap: 8px;"></div>
          </div>
          <!-- LM Studio -->
          <div id="lmstudioCard" style="background: var(--bg-card); border: 1.5px solid var(--border-light); border-radius: 16px; padding: 20px; cursor: pointer; transition: all 0.25s; position: relative; overflow: hidden;">
            <div style="position: absolute; top: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, #ff9500, #ff2d55); opacity: 0.5;"></div>
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 10px;">
              <div style="width: 42px; height: 42px; background: linear-gradient(135deg, rgba(255,149,0,0.15), rgba(255,45,85,0.15)); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 20px;">💻</div>
              <div style="flex: 1;">
                <h3 style="margin: 0; font-size: 16px; font-weight: 700;">LM Studio</h3>
                <div style="font-size: 11px; color: var(--text-muted);">可视化模型管理</div>
              </div>
              <div id="lmstudioStatus" style="font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 16px;">检测中...</div>
            </div>
            <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.4; margin-bottom: 10px;">支持 HuggingFace / ModelScope GGUF 模型，图形界面一键加载。</div>
            <div id="lmstudioActions" style="display: flex; gap: 8px;"></div>
          </div>
          <!-- GPT4All -->
          <div style="background: var(--bg-card); border: 1.5px solid var(--border-light); border-radius: 16px; padding: 20px; transition: all 0.25s; position: relative; overflow: hidden;">
            <div style="position: absolute; top: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, #34c759, #00d9ff); opacity: 0.5;"></div>
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 10px;">
              <div style="width: 42px; height: 42px; background: linear-gradient(135deg, rgba(52,199,89,0.15), rgba(0,217,255,0.15)); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 20px;">🤖</div>
              <div style="flex: 1;">
                <h3 style="margin: 0; font-size: 16px; font-weight: 700;">GPT4All</h3>
                <div style="font-size: 11px; color: var(--text-muted);">Nomic AI 出品，隐私优先</div>
              </div>
            </div>
            <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.4; margin-bottom: 10px;">开箱即用的本地 AI 助手，无需 GPU，支持 CPU 推理。</div>
            <a href="https://gpt4all.io/" target="_blank" style="font-size: 12px; color: var(--primary); text-decoration: none;">🔗 gpt4all.io</a>
          </div>
          <!-- Jan -->
          <div style="background: var(--bg-card); border: 1.5px solid var(--border-light); border-radius: 16px; padding: 20px; transition: all 0.25s; position: relative; overflow: hidden;">
            <div style="position: absolute; top: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, #af52de, #ff2d55); opacity: 0.5;"></div>
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 10px;">
              <div style="width: 42px; height: 42px; background: linear-gradient(135deg, rgba(175,82,222,0.15), rgba(255,45,85,0.15)); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 20px;">🪶</div>
              <div style="flex: 1;">
                <h3 style="margin: 0; font-size: 16px; font-weight: 700;">Jan</h3>
                <div style="font-size: 11px; color: var(--text-muted);">Menlo 出品，类 ChatGPT 体验</div>
              </div>
            </div>
            <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.4; margin-bottom: 10px;">完全离线运行，支持多模型切换，自带聊天界面。</div>
            <a href="https://jan.ai/" target="_blank" style="font-size: 12px; color: var(--primary); text-decoration: none;">🔗 jan.ai</a>
          </div>
          <!-- LocalAI -->
          <div style="background: var(--bg-card); border: 1.5px solid var(--border-light); border-radius: 16px; padding: 20px; transition: all 0.25s; position: relative; overflow: hidden;">
            <div style="position: absolute; top: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, #ff9500, #ff3b30); opacity: 0.5;"></div>
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 10px;">
              <div style="width: 42px; height: 42px; background: linear-gradient(135deg, rgba(255,149,0,0.15), rgba(255,59,48,0.15)); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 20px;">🔧</div>
              <div style="flex: 1;">
                <h3 style="margin: 0; font-size: 16px; font-weight: 700;">LocalAI</h3>
                <div style="font-size: 11px; color: var(--text-muted);">OpenAI API 兼容本地网关</div>
              </div>
            </div>
            <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.4; margin-bottom: 10px;">Drop-in 替代 OpenAI API，支持 LLM / 图片生成 / 音频。</div>
            <a href="https://localai.io/" target="_blank" style="font-size: 12px; color: var(--primary); text-decoration: none;">🔗 localai.io</a>
          </div>
          <!-- vLLM -->
          <div style="background: var(--bg-card); border: 1.5px solid var(--border-light); border-radius: 16px; padding: 20px; transition: all 0.25s; position: relative; overflow: hidden;">
            <div style="position: absolute; top: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, #5856d6, #007aff); opacity: 0.5;"></div>
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 10px;">
              <div style="width: 42px; height: 42px; background: linear-gradient(135deg, rgba(88,86,214,0.15), rgba(0,122,255,0.15)); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 20px;">⚡</div>
              <div style="flex: 1;">
                <h3 style="margin: 0; font-size: 16px; font-weight: 700;">vLLM</h3>
                <div style="font-size: 11px; color: var(--text-muted);">高吞吐量 GPU 推理引擎</div>
              </div>
            </div>
            <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.4; margin-bottom: 10px;">PagedAttention 优化，适合多卡服务器部署，吞吐量极高。</div>
            <a href="https://docs.vllm.ai/" target="_blank" style="font-size: 12px; color: var(--primary); text-decoration: none;">🔗 docs.vllm.ai</a>
          </div>
        </div>
      </div>

      <!-- Section 3: 模型大市场 -->
      <div class="market-section-block">
        <div class="market-section-header">
          <h3>
            <span class="section-bar" style="background: linear-gradient(180deg, #34c759, #00d9ff);"></span>
            模型大市场（本地部署）
          </h3>
        </div>
        <!-- 平台入口 -->
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; margin-bottom: 20px;" id="marketPlatformGrid"></div>
        <!-- 筛选栏 + 模型列表 -->
        <div id="modelMarketContainer"></div>
      </div>
    </div>

    <!-- 模型详情 Modal -->
    <div id="modelDetailModal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:10000; align-items:center; justify-content:center; backdrop-filter:blur(4px);">
      <div style="background:var(--bg-app); width:640px; max-width:92%; max-height:85vh; border-radius:20px; box-shadow:0 32px 64px rgba(0,0,0,0.3); overflow:hidden; display:flex; flex-direction:column;">
        <div style="padding:20px 24px; border-bottom:1px solid var(--border-light); display:flex; justify-content:space-between; align-items:center; flex-shrink:0;">
          <h3 style="margin:0; font-size:18px;" id="modelDetailTitle">模型详情</h3>
          <button id="closeModelDetail" style="background:none; border:none; font-size:24px; cursor:pointer; color:var(--text-muted);">&times;</button>
        </div>
        <div id="modelDetailBody" style="padding:24px; overflow-y:auto; flex:1;"></div>
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
  renderMarketPlatforms();
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
  // 模型详情 Modal
  document.getElementById('closeModelDetail').addEventListener('click', () => document.getElementById('modelDetailModal').style.display = 'none');
  document.getElementById('modelDetailModal').addEventListener('click', (e) => { if (e.target.id === 'modelDetailModal') e.target.style.display = 'none'; });
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
  const models = conf.models || [];
  body.innerHTML = `
    <!-- 基本信息 -->
    <div class="config-form-group">
      <label>自定义名称</label>
      <input type="text" class="input" id="cfgName" value="${escapeHtml(conf.customName || vendor.name)}" placeholder="${vendor.name}" />
    </div>

    <div class="config-form-group">
      <label>API 地址</label>
      <div style="display: flex; gap: 8px;">
        <input type="text" class="input" id="cfgBaseUrl" value="${escapeHtml(conf.baseUrl || vendor.url || '')}" placeholder="https://api.example.com/v1" style="flex:1;" />
        <button class="btn btn-default" id="cfgFetchModels" style="border-radius: 10px; flex-shrink: 0; font-size: 12px;">🔄 获取模型</button>
      </div>
    </div>

    <div class="config-form-group">
      <label>API Key</label>
      <input type="password" class="input" id="cfgApiKey" value="${escapeHtml(conf.apiKey || '')}" placeholder="sk-..." />
    </div>

    <!-- 模型列表（通过 API 拉取） -->
    <div class="config-form-group">
      <label>模型列表 <span style="font-weight:400;color:var(--text-muted);">（点击上方「获取模型」自动拉取，或手动添加）</span></label>
      <div class="cloud-model-list" id="cfgModelList">
        ${models.map(m => `
          <div class="cloud-model-tag">
            <span class="model-tag-name">${escapeHtml(m)}</span>
            <button class="model-tag-remove">&times;</button>
          </div>
        `).join('')}
      </div>
      <div class="add-model-row">
        <input type="text" class="input" id="cfgNewModel" placeholder="手动输入模型 ID" />
        <button class="btn btn-default" id="cfgAddModelBtn" style="border-radius: 10px; flex-shrink: 0;">+ 添加</button>
      </div>
      <div id="cfgFetchStatus" style="font-size: 12px; margin-top: 6px; min-height: 18px;"></div>
    </div>

    <!-- 高级参数 -->
    <div class="config-form-group">
      <label>默认模型</label>
      <select class="input select" id="cfgDefaultModel">
        <option value="">-- 请先获取模型列表 --</option>
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

    <!-- 删除配置（底部） -->
    <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--border-light); text-align: right;">
      <button class="btn btn-danger" id="deleteCloudConfig" style="border-radius: 10px; font-size: 12px;">🗑 删除配置</button>
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
      refreshModelSelect();
    });
  });

  // 手动添加模型
  body.querySelector('#cfgAddModelBtn').addEventListener('click', () => {
    const input = body.querySelector('#cfgNewModel');
    const name = input.value.trim();
    if (!name) return;
    addModelToList(name);
    input.value = '';
  });

  // 获取模型按钮
  body.querySelector('#cfgFetchModels').addEventListener('click', () => fetchModelsFromApi(vendor));

  // 保存按钮
  const saveBtn = document.getElementById('saveCloudConfig');
  const newSaveBtn = saveBtn.cloneNode(true);
  saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
  newSaveBtn.addEventListener('click', () => saveCloudConfig(vendor));

  // 测试连接按钮
  const testBtn = document.getElementById('testConnectionBtn');
  const newTestBtn = testBtn.cloneNode(true);
  testBtn.parentNode.replaceChild(newTestBtn, testBtn);
  newTestBtn.addEventListener('click', () => testConnection(vendor));

  // 删除按钮（在 body 底部）
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

// ==================== 模型列表辅助 ====================
function addModelToList(name) {
  const list = document.getElementById('cfgModelList');
  if (!list) return;
  // 去重
  const existing = list.querySelectorAll('.model-tag-name');
  for (const el of existing) { if (el.textContent.trim() === name) return; }
  const tag = document.createElement('div');
  tag.className = 'cloud-model-tag';
  tag.innerHTML = `<span class="model-tag-name">${escapeHtml(name)}</span><button class="model-tag-remove">&times;</button>`;
  tag.querySelector('.model-tag-remove').addEventListener('click', () => { tag.remove(); refreshModelSelect(); });
  list.appendChild(tag);
  refreshModelSelect();
}

function refreshModelSelect() {
  const list = document.getElementById('cfgModelList');
  const sel = document.getElementById('cfgDefaultModel');
  if (!list || !sel) return;
  const current = sel.value;
  const names = Array.from(list.querySelectorAll('.model-tag-name')).map(el => el.textContent.trim());
  sel.innerHTML = '<option value="">-- 请选择 --</option>' + names.map(n => `<option value="${escapeHtml(n)}" ${n === current ? 'selected' : ''}>${escapeHtml(n)}</option>`).join('');
}

// ==================== 从 API 拉取模型列表 ====================
async function fetchModelsFromApi(vendor) {
  const statusEl = document.getElementById('cfgFetchStatus');
  const btn = document.getElementById('cfgFetchModels');
  const baseUrl = document.getElementById('cfgBaseUrl').value.trim();
  const apiKey = document.getElementById('cfgApiKey').value.trim();

  if (!baseUrl) { window.__toast?.error('请先填写 API 地址'); return; }

  btn.disabled = true;
  btn.textContent = '⏳ 拉取中...';
  statusEl.innerHTML = '<span style="color:var(--text-muted);">正在请求模型列表...</span>';

  try {
    // 尝试 OpenAI 兼容的 /models 端点
    const modelsUrl = baseUrl.replace(/\/+$/, '') + '/models';
    const headers = { 'Accept': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const resp = await fetch(modelsUrl, { headers, signal: AbortSignal.timeout(15000) });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const data = await resp.json();
    let modelIds = [];

    // OpenAI 格式: { data: [{ id: "..." }, ...] }
    if (Array.isArray(data.data)) {
      modelIds = data.data.map(m => m.id).filter(Boolean);
    }
    // 直接数组: ["model1", ...]
    else if (Array.isArray(data)) {
      modelIds = data.map(m => typeof m === 'string' ? m : m.id || m.name).filter(Boolean);
    }
    // Ollama 格式: { models: [{ name: "..." }, ...] }
    else if (Array.isArray(data.models)) {
      modelIds = data.models.map(m => m.name || m.id).filter(Boolean);
    }

    if (modelIds.length === 0) {
      statusEl.innerHTML = '<span style="color:var(--warning);">⚠ 未获取到模型，请检查地址和 Key</span>';
      return;
    }

    // 清空旧列表，填入新模型
    const list = document.getElementById('cfgModelList');
    list.innerHTML = '';
    modelIds.forEach(id => addModelToList(id));

    statusEl.innerHTML = `<span style="color:var(--success);">✅ 成功获取 ${modelIds.length} 个模型</span>`;
    window.__toast?.success(`已获取 ${modelIds.length} 个模型`);
  } catch(e) {
    statusEl.innerHTML = `<span style="color:var(--danger);">❌ 获取失败: ${e.message}</span>`;
    window.__toast?.error('获取模型失败: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '🔄 获取模型';
  }
}

// ==================== 连通测试 ====================
async function testConnection(vendor) {
  const btn = document.getElementById('testConnectionBtn');
  const baseUrl = document.getElementById('cfgBaseUrl').value.trim();
  const apiKey = document.getElementById('cfgApiKey').value.trim();
  const sel = document.getElementById('cfgDefaultModel');
  const modelId = sel?.value || '';

  if (!baseUrl) { window.__toast?.error('请先填写 API 地址'); return; }

  btn.disabled = true;
  const origText = btn.textContent;
  btn.textContent = '⏳ 测试中...';

  try {
    // 使用 /models 端点做轻量级连通测试
    const modelsUrl = baseUrl.replace(/\/+$/, '') + '/models';
    const headers = { 'Accept': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const resp = await fetch(modelsUrl, { headers, signal: AbortSignal.timeout(10000) });

    if (resp.ok) {
      const data = await resp.json();
      const count = Array.isArray(data.data) ? data.data.length : Array.isArray(data.models) ? data.models.length : '?';
      window.__toast?.success(`✅ 连接成功！API 可用，共 ${count} 个模型`);
    } else {
      window.__toast?.warning(`⚠ 服务器响应 HTTP ${resp.status}，请检查配置`);
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

// ==================== 模型大市场 ====================

// 主流下载平台
const marketPlatforms = [
  { id: 'ollama', name: 'Ollama Library', icon: '🦙', color: '#00d9ff', desc: '一键 pull，最便捷', url: 'https://ollama.com/library' },
  { id: 'huggingface', name: 'HuggingFace', icon: '🤗', color: '#ff9f0a', desc: '全球最大开源模型社区', url: 'https://huggingface.co/models?sort=trending' },
  { id: 'modelscope', name: 'ModelScope', icon: '🔴', color: '#ff3b30', desc: '国内高速下载，魔搭社区', url: 'https://modelscope.cn/models' },
  { id: 'hf-mirror', name: 'HF 镜像站', icon: '🪞', color: '#5856d6', desc: '国内 HuggingFace 镜像', url: 'https://hf-mirror.com/models' },
];

// 预置热门本地模型库（人工维护，用户可参考）
const localModelDB = [
  { name: 'Qwen2.5-7B-Instruct', family: 'Qwen', params: '7B', ram: 6, gpu: 0, category: 'chat', tags: ['中文','代码','推理'], downloads: 850000, source: 'modelscope', license: 'Apache-2.0', desc: '阿里通义千问，中英双语，代码能力强' },
  { name: 'Qwen2.5-14B-Instruct', family: 'Qwen', params: '14B', ram: 12, gpu: 8, category: 'chat', tags: ['中文','代码','推理'], downloads: 420000, source: 'modelscope', license: 'Apache-2.0', desc: '通义千问中杯，综合能力均衡' },
  { name: 'Qwen2.5-72B-Instruct', family: 'Qwen', params: '72B', ram: 48, gpu: 24, category: 'chat', tags: ['中文','旗舰'], downloads: 310000, source: 'modelscope', license: 'Apache-2.0', desc: '通义千问旗舰，接近 GPT-4 水平' },
  { name: 'DeepSeek-V3', family: 'DeepSeek', params: '671B MoE', ram: 48, gpu: 24, category: 'chat', tags: ['中文','代码','MoE'], downloads: 520000, source: 'modelscope', license: 'MIT', desc: '深度求索 V3，MoE 架构，极高性价比' },
  { name: 'DeepSeek-R1-Distill-Qwen-7B', family: 'DeepSeek', params: '7B', ram: 6, gpu: 0, category: 'reasoning', tags: ['推理','蒸馏','数学'], downloads: 680000, source: 'huggingface', license: 'MIT', desc: 'R1 蒸馏版，推理能力远超同参数模型' },
  { name: 'DeepSeek-Coder-V2-Lite', family: 'DeepSeek', params: '16B', ram: 12, gpu: 8, category: 'code', tags: ['代码','编程'], downloads: 290000, source: 'huggingface', license: 'MIT', desc: '代码专用，支持 300+ 编程语言' },
  { name: 'Llama-3.1-8B-Instruct', family: 'Llama', params: '8B', ram: 6, gpu: 0, category: 'chat', tags: ['英文','通用'], downloads: 1200000, source: 'huggingface', license: 'Llama-3.1', desc: 'Meta 开源，英文能力顶尖' },
  { name: 'Llama-3.1-70B-Instruct', family: 'Llama', params: '70B', ram: 48, gpu: 24, category: 'chat', tags: ['英文','旗舰'], downloads: 650000, source: 'huggingface', license: 'Llama-3.1', desc: 'Meta 旗舰开源模型' },
  { name: 'Mistral-7B-Instruct-v0.3', family: 'Mistral', params: '7B', ram: 6, gpu: 0, category: 'chat', tags: ['英文','快速'], downloads: 980000, source: 'huggingface', license: 'Apache-2.0', desc: 'Mistral 出品，小巧高效' },
  { name: 'Mixtral-8x7B-Instruct', family: 'Mistral', params: '8x7B MoE', ram: 32, gpu: 16, category: 'chat', tags: ['MoE','多语言'], downloads: 560000, source: 'huggingface', license: 'Apache-2.0', desc: 'MoE 架构，性能接近 Llama-70B' },
  { name: 'Yi-1.5-9B-Chat', family: 'Yi', params: '9B', ram: 8, gpu: 0, category: 'chat', tags: ['中文','英文','通用'], downloads: 180000, source: 'modelscope', license: 'Apache-2.0', desc: '零一万物出品，中英双语' },
  { name: 'GLM-4-9B-Chat', family: 'GLM', params: '9B', ram: 8, gpu: 0, category: 'chat', tags: ['中文','工具调用'], downloads: 320000, source: 'modelscope', license: 'Apache-2.0', desc: '智谱 AI，擅长工具调用和 Agent' },
  { name: 'InternLM2.5-7B-Chat', family: 'InternLM', params: '7B', ram: 6, gpu: 0, category: 'chat', tags: ['中文','数学','推理'], downloads: 210000, source: 'modelscope', license: 'Apache-2.0', desc: '上海 AI Lab，数学推理强' },
  { name: 'Phi-3.5-mini-instruct', family: 'Phi', params: '3.8B', ram: 4, gpu: 0, category: 'chat', tags: ['轻量','端侧','快速'], downloads: 750000, source: 'huggingface', license: 'MIT', desc: '微软出品，极小模型但能力惊人' },
  { name: 'Gemma-2-9B-IT', family: 'Gemma', params: '9B', ram: 8, gpu: 0, category: 'chat', tags: ['英文','快速'], downloads: 440000, source: 'huggingface', license: 'Gemma', desc: 'Google 出品，轻量高效' },
  { name: 'CodeLlama-7B-Instruct', family: 'Llama', params: '7B', ram: 6, gpu: 0, category: 'code', tags: ['代码','编程'], downloads: 520000, source: 'huggingface', license: 'Llama-2', desc: 'Meta 代码专用模型' },
  { name: 'StarCoder2-7B', family: 'StarCoder', params: '7B', ram: 6, gpu: 0, category: 'code', tags: ['代码','开源'], downloads: 280000, source: 'huggingface', license: 'BigCode', desc: 'BigCode 社区代码模型' },
  { name: 'ChatGLM3-6B', family: 'GLM', params: '6B', ram: 5, gpu: 0, category: 'chat', tags: ['中文','轻量','经典'], downloads: 1500000, source: 'modelscope', license: 'Apache-2.0', desc: '智谱经典中文模型，社区生态丰富' },
  { name: 'Baichuan2-7B-Chat', family: 'Baichuan', params: '7B', ram: 6, gpu: 0, category: 'chat', tags: ['中文','通用'], downloads: 340000, source: 'modelscope', license: 'Apache-2.0', desc: '百川智能，中文理解优秀' },
  { name: 'MiniCPM-2B', family: 'MiniCPM', params: '2.4B', ram: 3, gpu: 0, category: 'chat', tags: ['端侧','极轻量','中文'], downloads: 410000, source: 'modelscope', license: 'Apache-2.0', desc: '面壁小钢炮，手机可跑' },
];

const categoryMap = {
  chat: '💬 对话聊天',
  code: '💻 代码编程',
  reasoning: '🧮 推理数学',
  vision: '👁 多模态',
  creative: '🎨 创意写作',
};

let currentHwInfo = null;
let currentSort = 'downloads';
let currentCategory = 'all';

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

async function loadModelMarket() {
  const container = document.getElementById('modelMarketContainer');

  // 检测硬件
  try { currentHwInfo = await window.openClaw.model.getMarketplace?.(); currentHwInfo = currentHwInfo?.hardware || null; } catch(e) {}
  const freeRam = currentHwInfo?.freeRamGB || 8;
  const hasGpu = currentHwInfo?.hasGpu ?? false;

  // 渲染筛选栏
  container.innerHTML = `
    <!-- 硬件推荐提示 -->
    <div id="hwBanner" style="background:rgba(0,122,255,0.06); border:1px solid rgba(0,122,255,0.15); border-radius:12px; padding:12px 16px; margin-bottom:16px; display:flex; align-items:center; gap:12px; font-size:13px;">
      <span style="font-size:20px;">💻</span>
      <div>
        <span style="font-weight:600;">当前设备：</span>
        ${currentHwInfo ? `可用内存 <b>${freeRam.toFixed(1)} GB</b>，${hasGpu ? '已检测到 GPU' : '仅 CPU 推理'}` : '正在检测硬件...'}
        <span style="color:var(--text-muted); margin-left:8px;">已为你筛选可运行的模型（灰色标签表示内存不足）</span>
      </div>
    </div>

    <!-- 筛选排序栏 -->
    <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:16px; align-items:center;" id="marketFilterBar">
      <span style="font-size:12px; color:var(--text-muted); margin-right:4px;">用途：</span>
      <button class="market-filter-btn active" data-cat="all">全部</button>
      <button class="market-filter-btn" data-cat="chat">💬 对话</button>
      <button class="market-filter-btn" data-cat="code">💻 代码</button>
      <button class="market-filter-btn" data-cat="reasoning">🧮 推理</button>
      <div style="flex:1;"></div>
      <span style="font-size:12px; color:var(--text-muted); margin-right:4px;">排序：</span>
      <select class="input select" id="marketSortSelect" style="width:130px; border-radius:8px; font-size:12px; height:30px;">
        <option value="downloads">🔥 下载量</option>
        <option value="ram">📦 内存占用</option>
        <option value="params">🔢 参数量</option>
        <option value="name">🔤 名称</option>
      </select>
    </div>

    <!-- 模型列表 -->
    <div id="marketModelGrid" style="display:flex; flex-direction:column; gap:10px;"></div>
  `;

  // 筛选按钮事件
  container.querySelectorAll('.market-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.market-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentCategory = btn.dataset.cat;
      renderModelList();
    });
  });
  // 排序事件
  container.querySelector('#marketSortSelect').addEventListener('change', (e) => {
    currentSort = e.target.value;
    renderModelList();
  });

  renderModelList();
}

function renderModelList() {
  const grid = document.getElementById('marketModelGrid');
  const freeRam = currentHwInfo?.freeRamGB || 8;

  // 筛选
  let list = [...localModelDB];
  if (currentCategory !== 'all') {
    list = list.filter(m => m.category === currentCategory);
  }

  // 排序
  list.sort((a, b) => {
    if (currentSort === 'downloads') return b.downloads - a.downloads;
    if (currentSort === 'ram') return a.ram - b.ram;
    if (currentSort === 'params') return a.ram - b.ram; // 用 ram 代理参数大小
    return a.name.localeCompare(b.name);
  });

  grid.innerHTML = list.map(m => {
    const canRun = m.ram <= freeRam;
    const statusColor = canRun ? 'var(--success)' : 'var(--text-muted)';
    const statusText = canRun ? '✅ 可运行' : '⚠ 内存不足';
    const dlText = m.downloads >= 1000000 ? (m.downloads / 1000000).toFixed(1) + 'M' : m.downloads >= 1000 ? (m.downloads / 1000).toFixed(0) + 'K' : m.downloads;

    return `
    <div class="market-model-card" data-model='${JSON.stringify(m).replace(/'/g, "&#39;")}' style="background:var(--bg-card); border:1.5px solid ${canRun ? 'var(--border-light)' : 'rgba(0,0,0,0.04)'}; border-radius:14px; padding:16px 20px; display:flex; align-items:center; gap:16px; cursor:pointer; transition:all 0.2s; ${canRun ? '' : 'opacity:0.55;'}">
      <div style="width:44px; height:44px; background:${canRun ? 'var(--primary-light)' : 'var(--bg-hover)'}; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:20px; flex-shrink:0;">${m.category === 'code' ? '💻' : m.category === 'reasoning' ? '🧮' : '💬'}</div>
      <div style="flex:1; min-width:0;">
        <div style="font-size:14px; font-weight:600; margin-bottom:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(m.name)}</div>
        <div style="font-size:12px; color:var(--text-muted); display:flex; flex-wrap:wrap; gap:8px;">
          <span>🔢 ${m.params}</span>
          <span>📦 ${m.ram} GB RAM</span>
          <span>⬇ ${dlText}</span>
          <span style="color:${statusColor}; font-weight:600;">${statusText}</span>
        </div>
      </div>
      <div style="display:flex; gap:6px; flex-shrink:0;">
        ${m.tags.map(t => `<span style="font-size:11px; padding:2px 8px; border-radius:6px; background:var(--bg-hover); color:var(--text-secondary);">${t}</span>`).join('')}
      </div>
    </div>
    `;
  }).join('');

  grid.querySelectorAll('.market-model-card').forEach(card => {
    card.addEventListener('click', () => openModelDetail(JSON.parse(card.dataset.model)));
    card.addEventListener('mouseenter', () => { card.style.transform = 'translateY(-1px)'; card.style.boxShadow = 'var(--shadow-md)'; });
    card.addEventListener('mouseleave', () => { card.style.transform = ''; card.style.boxShadow = ''; });
  });
}

function openModelDetail(model) {
  const modal = document.getElementById('modelDetailModal');
  const body = document.getElementById('modelDetailBody');
  const freeRam = currentHwInfo?.freeRamGB || 8;
  const canRun = model.ram <= freeRam;

  // 根据来源拼接下载链接
  const sourceLinks = {
    huggingface: `https://huggingface.co/models?search=${encodeURIComponent(model.family)}`,
    modelscope: `https://modelscope.cn/models?name=${encodeURIComponent(model.family)}`,
    ollama: `https://ollama.com/library/${model.family.toLowerCase()}`,
  };

  document.getElementById('modelDetailTitle').textContent = model.name;
  body.innerHTML = `
    <div style="margin-bottom:20px;">
      <div style="font-size:13px; color:var(--text-secondary); line-height:1.7;">${model.desc}</div>
    </div>

    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:20px;">
      <div style="background:var(--bg-hover); border-radius:10px; padding:12px 14px;">
        <div style="font-size:11px; color:var(--text-muted); margin-bottom:4px;">参数量</div>
        <div style="font-size:16px; font-weight:700;">${model.params}</div>
      </div>
      <div style="background:var(--bg-hover); border-radius:10px; padding:12px 14px;">
        <div style="font-size:11px; color:var(--text-muted); margin-bottom:4px;">推荐内存</div>
        <div style="font-size:16px; font-weight:700;">${model.ram} GB</div>
      </div>
      <div style="background:var(--bg-hover); border-radius:10px; padding:12px 14px;">
        <div style="font-size:11px; color:var(--text-muted); margin-bottom:4px;">GPU 需求</div>
        <div style="font-size:16px; font-weight:700;">${model.gpu === 0 ? '仅 CPU 即可' : model.gpu + ' GB VRAM'}</div>
      </div>
      <div style="background:${canRun ? 'rgba(52,199,89,0.08)' : 'rgba(255,59,48,0.08)'}; border-radius:10px; padding:12px 14px;">
        <div style="font-size:11px; color:var(--text-muted); margin-bottom:4px;">你的设备</div>
        <div style="font-size:16px; font-weight:700; color:${canRun ? 'var(--success)' : 'var(--danger)'};">${canRun ? '✅ 可以运行' : '⚠ 内存不足'}</div>
      </div>
    </div>

    <div style="margin-bottom:20px;">
      <div style="font-size:13px; font-weight:600; margin-bottom:8px;">标签</div>
      <div style="display:flex; flex-wrap:wrap; gap:6px;">
        ${model.tags.map(t => `<span style="font-size:12px; padding:4px 12px; border-radius:8px; background:var(--primary-light); color:var(--primary); font-weight:500;">${t}</span>`).join('')}
        <span style="font-size:12px; padding:4px 12px; border-radius:8px; background:var(--bg-hover); color:var(--text-secondary);">📜 ${model.license}</span>
      </div>
    </div>

    <div style="font-size:13px; font-weight:600; margin-bottom:10px;">下载渠道</div>
    <div style="display:flex; flex-wrap:wrap; gap:10px;">
      ${Object.entries(sourceLinks).map(([key, url]) => {
        const p = marketPlatforms.find(x => x.id === key);
        return p ? `<a href="${url}" target="_blank" style="display:inline-flex; align-items:center; gap:8px; padding:10px 16px; background:var(--bg-card); border:1px solid var(--border-light); border-radius:10px; text-decoration:none; color:var(--text-primary); font-size:13px; font-weight:500; transition:all 0.2s;" onmouseenter="this.style.borderColor='var(--primary)';this.style.transform='translateY(-1px)'" onmouseleave="this.style.borderColor='var(--border-light)';this.style.transform=''">
          <span style="font-size:18px;">${p.icon}</span> ${p.name}
        </a>` : '';
      }).join('')}
      <a href="https://ollama.com/library/${model.name.split('-')[0].toLowerCase()}" target="_blank" style="display:inline-flex; align-items:center; gap:8px; padding:10px 16px; background:var(--bg-card); border:1px solid var(--border-light); border-radius:10px; text-decoration:none; color:var(--text-primary); font-size:13px; font-weight:500; transition:all 0.2s;" onmouseenter="this.style.borderColor='var(--primary)';this.style.transform='translateY(-1px)'" onmouseleave="this.style.borderColor='var(--border-light)';this.style.transform=''">
        <span style="font-size:18px;">🦙</span> Ollama
      </a>
    </div>
  `;

  modal.style.display = 'flex';
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

