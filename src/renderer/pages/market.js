/**
 * 模型市场 (Model Market) v2
 * 顶部：本地运行时检测 (Ollama / LM Studio) — 自动检测、引导安装、模型管理
 * 下方：云端厂商配置
 */

let settings = {};
let localStatus = { ollama: { running: false, models: [] }, lmstudio: { running: false, models: [] } };
let activeModelId = '';

const cloudVendors = [
  { id: 'openai', name: 'OpenAI', icon: '🌌', desc: 'GPT-4o, GPT-4-Turbo 等旗舰模型', url: 'https://api.openai.com/v1' },
  { id: 'anthropic', name: 'Anthropic', icon: '🧠', desc: 'Claude 3.5 Sonnet 等强力逻辑模型', url: 'https://api.anthropic.com/v1' },
  { id: 'gemini', name: 'Google Gemini', icon: '✨', desc: 'Gemini 1.5 Pro 多模态系列', url: 'https://generativelanguage.googleapis.com/v1beta' },
  { id: 'deepseek', name: 'DeepSeek', icon: '🐳', desc: '国产深度求索，高性价比代码模型', url: 'https://api.deepseek.com/v1' },
  { id: 'qwen', name: '通义千问', icon: '☁️', desc: '阿里云通义千问全系列', url: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
  { id: 'zhipu', name: '智谱 AI', icon: '🔮', desc: 'GLM-4, GLM-4V 多模态系列', url: 'https://open.bigmodel.cn/api/paas/v4' },
  { id: 'moonshot', name: '月之暗面 (Kimi)', icon: '🌙', desc: 'Moonshot V1 系列', url: 'https://api.moonshot.cn/v1' },
];

export async function render(container) {
  try { settings = (await window.openClaw.settings.getAll()) || {}; } catch(e) { settings = {}; }
  try { const am = await window.openClaw.model.getActiveModel(); activeModelId = am?.id || ''; } catch(e) {}

  container.style.padding = '0';
  container.style.overflow = 'auto';

  container.innerHTML = `
    <!-- 页面头 -->
    <div style="padding: 32px 40px 0;">
      <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 28px;">
        <div>
          <h2 style="margin: 0 0 8px 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">🛒 模型市场</h2>
          <p style="margin: 0; color: var(--text-muted); font-size: 14px;">管理本地模型运行时与云端 API，一站式配置所有模型。</p>
        </div>
        <button id="addCustomModelBtn" class="btn btn-primary" style="padding: 8px 20px; border-radius: 12px; font-size: 13px; font-weight: 600;">+ 自定义模型</button>
      </div>

      <!-- 本地运行时区域 -->
      <div style="margin-bottom: 36px;">
        <h3 style="font-size: 16px; font-weight: 600; margin: 0 0 16px 0; color: var(--text-secondary); display: flex; align-items: center; gap: 8px;">
          <span style="width: 4px; height: 18px; background: linear-gradient(180deg, #00d9ff, #6c63ff); border-radius: 2px;"></span>
          本地模型运行时
        </h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;" id="localRuntimeGrid">
          <!-- Ollama 卡片 -->
          <div id="ollamaCard" class="local-rt-card" data-provider="ollama" style="background: var(--bg-card); border: 1.5px solid var(--border-light); border-radius: 20px; padding: 28px; cursor: pointer; transition: all 0.25s cubic-bezier(0.25,1,0.5,1); position: relative; overflow: hidden;">
            <div style="position: absolute; top: 0; left: 0; right: 0; height: 4px; background: linear-gradient(90deg, #00d9ff, #6c63ff); opacity: 0.5;"></div>
            <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 16px;">
              <div style="width: 56px; height: 56px; background: linear-gradient(135deg, rgba(0,217,255,0.15), rgba(108,99,255,0.15)); border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 28px;">🦙</div>
              <div style="flex: 1;">
                <h3 style="margin: 0 0 4px 0; font-size: 20px; font-weight: 700;">Ollama</h3>
                <div style="font-size: 13px; color: var(--text-muted);">轻量级本地大模型运行框架</div>
              </div>
              <div id="ollamaStatus" style="font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 20px;">检测中...</div>
            </div>
            <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.6; margin-bottom: 16px;">
              一键拉取 Llama、Qwen、DeepSeek 等主流开源模型，本地推理零延迟。
            </div>
            <div id="ollamaActions" style="display: flex; gap: 10px;"></div>
          </div>

          <!-- LM Studio 卡片 -->
          <div id="lmstudioCard" class="local-rt-card" data-provider="lmstudio" style="background: var(--bg-card); border: 1.5px solid var(--border-light); border-radius: 20px; padding: 28px; cursor: pointer; transition: all 0.25s cubic-bezier(0.25,1,0.5,1); position: relative; overflow: hidden;">
            <div style="position: absolute; top: 0; left: 0; right: 0; height: 4px; background: linear-gradient(90deg, #ff9500, #ff2d55); opacity: 0.5;"></div>
            <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 16px;">
              <div style="width: 56px; height: 56px; background: linear-gradient(135deg, rgba(255,149,0,0.15), rgba(255,45,85,0.15)); border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 28px;">💻</div>
              <div style="flex: 1;">
                <h3 style="margin: 0 0 4px 0; font-size: 20px; font-weight: 700;">LM Studio</h3>
                <div style="font-size: 13px; color: var(--text-muted);">可视化本地模型管理与推理</div>
              </div>
              <div id="lmstudioStatus" style="font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 20px;">检测中...</div>
            </div>
            <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.6; margin-bottom: 16px;">
              支持 HuggingFace / ModelScope GGUF 模型，图形界面一键加载。
            </div>
            <div id="lmstudioActions" style="display: flex; gap: 10px;"></div>
          </div>
        </div>
      </div>

      <!-- 云端厂商区域 -->
      <div style="margin-bottom: 40px;">
        <h3 style="font-size: 16px; font-weight: 600; margin: 0 0 16px 0; color: var(--text-secondary); display: flex; align-items: center; gap: 8px;">
          <span style="width: 4px; height: 18px; background: linear-gradient(180deg, #6c63ff, #af52de); border-radius: 2px;"></span>
          云端模型服务
        </h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px;" id="cloudVendorGrid"></div>
      </div>
    </div>

    <!-- 安装引导 Modal -->
    <div id="installGuideModal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1000; align-items: center; justify-content: center; backdrop-filter: blur(4px);">
      <div style="background: var(--bg-app); width: 520px; max-width: 90%; border-radius: 20px; box-shadow: 0 24px 48px rgba(0,0,0,0.25); overflow: hidden;">
        <div style="padding: 20px 24px; border-bottom: 1px solid var(--border-light); display: flex; justify-content: space-between; align-items: center;">
          <h3 style="margin: 0; font-size: 18px;" id="installGuideTitle">安装引导</h3>
          <button id="closeInstallGuide" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-muted);">&times;</button>
        </div>
        <div id="installGuideBody" style="padding: 24px;"></div>
      </div>
    </div>

    <!-- 本地模型列表 Modal -->
    <div id="localModelsModal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1000; align-items: center; justify-content: center; backdrop-filter: blur(4px);">
      <div style="background: var(--bg-app); width: 600px; max-width: 90%; max-height: 80vh; border-radius: 20px; box-shadow: 0 24px 48px rgba(0,0,0,0.25); overflow: hidden; display: flex; flex-direction: column;">
        <div style="padding: 20px 24px; border-bottom: 1px solid var(--border-light); display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
          <h3 style="margin: 0; font-size: 18px;" id="localModelsTitle">已部署模型</h3>
          <button id="closeLocalModels" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-muted);">&times;</button>
        </div>
        <div id="localModelsBody" style="padding: 24px; overflow-y: auto; flex: 1;"></div>
      </div>
    </div>

    <!-- 自定义模型 Modal -->
    <div id="customModelModal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1000; align-items: center; justify-content: center; backdrop-filter: blur(4px);">
      <div style="background: var(--bg-app); width: 500px; max-width: 90%; border-radius: 20px; box-shadow: 0 24px 48px rgba(0,0,0,0.2); overflow: hidden;">
        <div style="padding: 20px 24px; border-bottom: 1px solid var(--border-light); display: flex; justify-content: space-between; align-items: center;">
          <h3 style="margin: 0; font-size: 18px;">➕ 添加自定义模型</h3>
          <button id="closeCustomModal" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-muted);">&times;</button>
        </div>
        <div style="padding: 24px; display: flex; flex-direction: column; gap: 16px;">
          <div><label style="display:block;font-size:13px;font-weight:500;margin-bottom:6px;color:var(--text-muted);">模型名称</label><input type="text" id="cmName" class="input" placeholder="如: My Custom Model" /></div>
          <div><label style="display:block;font-size:13px;font-weight:500;margin-bottom:6px;color:var(--text-muted);">API 地址</label><input type="text" id="cmUrl" class="input" placeholder="http://127.0.0.1:11434/v1" /></div>
          <div><label style="display:block;font-size:13px;font-weight:500;margin-bottom:6px;color:var(--text-muted);">API Key (可选)</label><input type="password" id="cmKey" class="input" placeholder="sk-..." /></div>
          <button class="btn btn-primary" id="saveCustomModelBtn" style="width:100%;border-radius:12px;">保存</button>
        </div>
      </div>
    </div>

    <!-- API Key Modal -->
    <div id="apiKeyModal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1000; align-items: center; justify-content: center; backdrop-filter: blur(4px);">
      <div style="background: var(--bg-app); width: 450px; max-width: 90%; border-radius: 20px; box-shadow: 0 24px 48px rgba(0,0,0,0.2); overflow: hidden;">
        <div style="padding: 20px 24px; border-bottom: 1px solid var(--border-light); display: flex; justify-content: space-between; align-items: center;">
          <h3 style="margin: 0; font-size: 18px;" id="apiKeyModalTitle">配置 API Key</h3>
          <button id="closeApiKeyModal" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-muted);">&times;</button>
        </div>
        <div style="padding: 24px; display: flex; flex-direction: column; gap: 16px;">
          <div><label style="display:block;font-size:13px;font-weight:500;margin-bottom:6px;color:var(--text-muted);">API Key</label><input type="password" id="apiKeyInput" class="input" placeholder="sk-..." /></div>
          <div><label style="display:block;font-size:13px;font-weight:500;margin-bottom:6px;color:var(--text-muted);">API 地址</label><input type="text" id="apiUrlInput" class="input" /></div>
          <button class="btn btn-primary" id="saveApiKeyBtn" style="width:100%;border-radius:12px;">保存配置</button>
        </div>
      </div>
    </div>
  `;

  // === 事件绑定 ===
  bindModalEvents();
  renderCloudVendors();
  await detectLocalRuntimes();
}

function bindModalEvents() {
  // 关闭按钮通用
  ['closeInstallGuide','closeLocalModels','closeCustomModal','closeApiKeyModal'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', () => {
      document.getElementById(id).closest('[id$="Modal"]').style.display = 'none';
    });
  });
  // 背景点击关闭
  ['installGuideModal','localModelsModal','customModelModal','apiKeyModal'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', (e) => {
      if (e.target.id === id) e.target.style.display = 'none';
    });
  });
  // 自定义模型
  document.getElementById('addCustomModelBtn').addEventListener('click', () => {
    document.getElementById('customModelModal').style.display = 'flex';
  });
  document.getElementById('saveCustomModelBtn').addEventListener('click', async () => {
    const name = document.getElementById('cmName').value.trim();
    const url = document.getElementById('cmUrl').value.trim();
    const key = document.getElementById('cmKey').value.trim();
    if (!name || !url) { if (window.__toast) window.__toast.error('名称和地址不能为空'); return; }
    try {
      await window.openClaw.model.addModel({ name, type: 'cloud', provider: 'Custom', apiKey: key, baseUrl: url, modelName: name, maxTokens: 4096, temperature: 0.7 });
      if (window.__toast) window.__toast.success('自定义模型已添加！');
      document.getElementById('customModelModal').style.display = 'none';
    } catch(e) { if (window.__toast) window.__toast.error(e.message); }
  });
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

  // Ollama 状态
  if (localStatus.ollama.running) {
    ollamaStatus.style.background = 'rgba(52,199,89,0.12)';
    ollamaStatus.style.color = 'var(--success)';
    ollamaStatus.style.border = '1px solid rgba(52,199,89,0.3)';
    ollamaStatus.textContent = `● 已连接 · ${localStatus.ollama.models.length} 个模型`;
    document.getElementById('ollamaActions').innerHTML = `
      <button class="btn btn-primary ollama-manage-btn" style="flex:1;border-radius:12px;font-weight:600;">管理模型</button>
      <button class="btn btn-default ollama-reload-btn" style="border-radius:12px;">🔄 刷新</button>
    `;
    document.querySelector('.ollama-manage-btn').addEventListener('click', () => openLocalModelsModal('ollama'));
    document.querySelector('.ollama-reload-btn').addEventListener('click', detectLocalRuntimes);
  } else {
    ollamaStatus.style.background = 'rgba(255,59,48,0.1)';
    ollamaStatus.style.color = 'var(--danger)';
    ollamaStatus.style.border = '1px solid rgba(255,59,48,0.2)';
    ollamaStatus.textContent = '○ 未运行';
    document.getElementById('ollamaActions').innerHTML = `
      <button class="btn btn-default ollama-cancel-btn" style="flex:1;border-radius:12px;">取消</button>
      <button class="btn btn-primary ollama-install-btn" style="flex:1;border-radius:12px;font-weight:600;">📥 安装 Ollama</button>
    `;
    document.querySelector('.ollama-cancel-btn').addEventListener('click', () => {});
    document.querySelector('.ollama-install-btn').addEventListener('click', () => openInstallGuide('ollama'));
  }

  // LM Studio 状态
  if (localStatus.lmstudio.running) {
    lmstudioStatus.style.background = 'rgba(52,199,89,0.12)';
    lmstudioStatus.style.color = 'var(--success)';
    lmstudioStatus.style.border = '1px solid rgba(52,199,89,0.3)';
    lmstudioStatus.textContent = `● 已连接 · ${localStatus.lmstudio.models.length} 个模型`;
    document.getElementById('lmstudioActions').innerHTML = `
      <button class="btn btn-primary lm-manage-btn" style="flex:1;border-radius:12px;font-weight:600;">管理模型</button>
      <button class="btn btn-default lm-reload-btn" style="border-radius:12px;">🔄 刷新</button>
    `;
    document.querySelector('.lm-manage-btn').addEventListener('click', () => openLocalModelsModal('lmstudio'));
    document.querySelector('.lm-reload-btn').addEventListener('click', detectLocalRuntimes);
  } else {
    lmstudioStatus.style.background = 'rgba(255,59,48,0.1)';
    lmstudioStatus.style.color = 'var(--danger)';
    lmstudioStatus.style.border = '1px solid rgba(255,59,48,0.2)';
    lmstudioStatus.textContent = '○ 未运行';
    document.getElementById('lmstudioActions').innerHTML = `
      <button class="btn btn-default lm-cancel-btn" style="flex:1;border-radius:12px;">取消</button>
      <button class="btn btn-primary lm-install-btn" style="flex:1;border-radius:12px;font-weight:600;">📥 安装 LM Studio</button>
    `;
    document.querySelector('.lm-cancel-btn').addEventListener('click', () => {});
    document.querySelector('.lm-install-btn').addEventListener('click', () => openInstallGuide('lmstudio'));
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

// ==================== 云端厂商列表 ====================
function renderCloudVendors() {
  const grid = document.getElementById('cloudVendorGrid');
  grid.innerHTML = cloudVendors.map(v => {
    const conf = settings[v.id] || {};
    const isConfigured = conf.apiKey && conf.apiKey.trim() !== '';
    return `
    <div class="cloud-vendor-card" data-id="${v.id}" style="background: var(--bg-card); border: 1px solid var(--border-light); border-radius: 16px; padding: 20px; cursor: pointer; transition: all 0.2s; position: relative;">
      ${isConfigured ? '<div style="position:absolute;top:14px;right:14px;width:8px;height:8px;background:var(--success);border-radius:50;"></div>' : ''}
      <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 12px;">
        <div style="font-size: 32px;">${v.icon}</div>
        <div>
          <h4 style="margin: 0; font-size: 16px; font-weight: 600;">${v.name}</h4>
          <div style="font-size: 12px; color: var(--text-muted);">${isConfigured ? '✅ 已配置' : '未配置'}</div>
        </div>
      </div>
      <p style="margin: 0; font-size: 13px; color: var(--text-secondary); line-height: 1.5;">${v.desc}</p>
    </div>
  `}).join('');

  grid.querySelectorAll('.cloud-vendor-card').forEach(card => {
    card.addEventListener('click', () => {
      const v = cloudVendors.find(x => x.id === card.dataset.id);
      openApiKeyModal(v);
    });
    card.addEventListener('mouseenter', () => { card.style.transform = 'translateY(-2px)'; card.style.boxShadow = 'var(--shadow-md)'; });
    card.addEventListener('mouseleave', () => { card.style.transform = 'translateY(0)'; card.style.boxShadow = 'none'; });
  });
}

function openApiKeyModal(vendor) {
  const modal = document.getElementById('apiKeyModal');
  document.getElementById('apiKeyModalTitle').textContent = `配置 ${vendor.name}`;
  const existing = settings[vendor.id] || {};
  document.getElementById('apiKeyInput').value = existing.apiKey || '';
  document.getElementById('apiUrlInput').value = existing.baseUrl || vendor.url || '';
  modal.style.display = 'flex';

  const saveBtn = document.getElementById('saveApiKeyBtn');
  const newBtn = saveBtn.cloneNode(true);
  saveBtn.parentNode.replaceChild(newBtn, saveBtn);
  newBtn.addEventListener('click', async () => {
    const key = document.getElementById('apiKeyInput').value.trim();
    const url = document.getElementById('apiUrlInput').value.trim();
    try {
      await window.openClaw.model.addModel({ id: vendor.id, name: vendor.name, type: 'cloud', provider: vendor.name, apiKey: key, baseUrl: url, modelName: vendor.id, maxTokens: 4096, temperature: 0.7 });
      settings[vendor.id] = { apiKey: key, baseUrl: url };
      if (window.__toast) window.__toast.success(`${vendor.name} 配置已保存！`);
      modal.style.display = 'none';
      renderCloudVendors();
    } catch(e) { if (window.__toast) window.__toast.error(e.message); }
  });
}

function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
