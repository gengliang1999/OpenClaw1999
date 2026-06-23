/**
 * 模型市场 (Model Market) - 与设置中模型配置合并版
 * 实现：厂商浏览 -> 模型列表 -> 直接配置 API Key / 下载本地
 */

let currentLevel = 'vendor'; // vendor, models
let currentVendor = null;
let settings = {};

const vendors = [
  { id: 'ollama', name: 'Ollama', icon: '🦙', isLocal: true, desc: '运行在本地的轻量级开源大模型', url: 'http://127.0.0.1:11434/v1' },
  { id: 'lmstudio', name: 'LM Studio', icon: '💻', isLocal: true, desc: '支持从 ModelScope / HuggingFace 国内镜像下载 GGUF 模型', url: 'http://127.0.0.1:1234/v1' },
  { id: 'openai', name: 'OpenAI', icon: '🌌', isLocal: false, desc: 'GPT-4o, GPT-4-Turbo 等旗舰模型', url: 'https://api.openai.com/v1' },
  { id: 'anthropic', name: 'Anthropic', icon: '🧠', isLocal: false, desc: 'Claude 3.5 Sonnet 等强力逻辑模型', url: 'https://api.anthropic.com/v1' },
  { id: 'gemini', name: 'Google Gemini', icon: '✨', isLocal: false, desc: 'Gemini 1.5 Pro 多模态系列', url: 'https://generativelanguage.googleapis.com/v1beta' },
  { id: 'deepseek', name: 'DeepSeek', icon: '🐳', isLocal: false, desc: '国产深度求索，高性价比代码模型', url: 'https://api.deepseek.com/v1' },
  { id: 'qwen', name: '通义千问', icon: '☁️', isLocal: false, desc: '阿里云通义千问全系列', url: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
  { id: 'zhipu', name: '智谱 AI', icon: '🔮', isLocal: false, desc: 'GLM-4, GLM-4V 多模态系列', url: 'https://open.bigmodel.cn/api/paas/v4' },
  { id: 'moonshot', name: '月之暗面 (Kimi)', icon: '🌙', isLocal: false, desc: 'Moonshot V1 系列', url: 'https://api.moonshot.cn/v1' },
  { id: 'baidu', name: '百度文心', icon: '🐾', isLocal: false, desc: '文心一言 ERNIE 系列', url: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop' },
  { id: 'minimax', name: 'MiniMax', icon: '🤖', isLocal: false, desc: 'abab 系列大模型', url: 'https://api.minimax.chat/v1' }
];

const mockModels = {
  ollama: [
    { id: 'llama3', name: 'Llama 3 8B', size: '4.7GB', tags: ['指令跟随', '快速'] },
    { id: 'qwen2-7b', name: 'Qwen 2 7B', size: '4.4GB', tags: ['中文优化', '全能'] },
    { id: 'phi3', name: 'Phi-3 Mini', size: '2.3GB', tags: ['轻量', '推理'] }
  ],
  lmstudio: [
    { id: 'glm4-9b', name: 'GLM 4 9B (GGUF)', size: '5.2GB', tags: ['魔塔镜像', '量化'] }
  ],
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o', size: 'Cloud', tags: ['旗舰', '多模态'] },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', size: 'Cloud', tags: ['逻辑能力'] },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', size: 'Cloud', tags: ['快速', '低价'] }
  ],
  anthropic: [
    { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', size: 'Cloud', tags: ['高速', '代码生成'] },
    { id: 'claude-3-opus', name: 'Claude 3 Opus', size: 'Cloud', tags: ['旗舰', '深度推理'] }
  ],
  gemini: [
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', size: 'Cloud', tags: ['100万token', '多模态'] }
  ],
  deepseek: [
    { id: 'deepseek-chat', name: 'DeepSeek Chat', size: 'Cloud', tags: ['代码', '中文'] },
    { id: 'deepseek-coder', name: 'DeepSeek Coder', size: 'Cloud', tags: ['编程专精'] }
  ],
  qwen: [
    { id: 'qwen-plus', name: 'Qwen Plus', size: 'Cloud', tags: ['通用', '中文'] },
    { id: 'qwen-max', name: 'Qwen Max', size: 'Cloud', tags: ['旗舰'] }
  ],
  zhipu: [
    { id: 'glm-4', name: 'GLM-4', size: 'Cloud', tags: ['多模态', '对话'] }
  ],
  moonshot: [
    { id: 'moonshot-v1-8k', name: 'Moonshot V1 8K', size: 'Cloud', tags: ['8K上下文'] }
  ]
};

export async function render(container) {
  try {
    settings = (await window.openClaw.settings.get()) || {};
  } catch(e) {
    settings = {};
  }
  if (!settings.providers) settings.providers = {};

  container.className = 'page-layout-full';

  container.innerHTML = `
    <div class="page-header" style="display: flex; flex-direction: column; gap: 16px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <h2 style="margin: 0; font-size: 24px; font-weight: 600;">🛒 模型市场</h2>
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="font-size: 13px; color: var(--success); display: flex; align-items: center; gap: 6px; background: rgba(52, 199, 89, 0.1); padding: 6px 12px; border-radius: 20px;">
             <span style="width: 8px; height: 8px; background: var(--success); border-radius: 50%; display: inline-block;"></span>
             国内镜像源已连通
          </div>
          <button id="addCustomModelBtn" class="btn btn-primary" style="padding: 6px 16px; border-radius: 20px; font-size: 13px;">+ 自定义模型</button>
        </div>
      </div>

      <!-- 面包屑导航 -->
      <div id="breadcrumb" style="display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 500;">
         <span class="crumb-link" data-target="vendor" style="color: var(--primary); cursor: pointer;">🏠 全部厂商</span>
      </div>
    </div>

    <div class="page-content" id="marketContent" style="padding-top: 0;"></div>

    <!-- 自定义模型 Modal -->
    <div id="customModelModal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1000; align-items: center; justify-content: center; backdrop-filter: blur(4px);">
       <div style="background: var(--bg-app); width: 500px; max-width: 90%; border-radius: 20px; box-shadow: 0 24px 48px rgba(0,0,0,0.2); overflow: hidden;">
          <div style="padding: 20px 24px; border-bottom: 1px solid var(--border-light); display: flex; justify-content: space-between; align-items: center;">
             <h3 style="margin: 0; font-size: 18px;">➕ 添加自定义模型</h3>
             <button id="closeCustomModal" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-muted);">&times;</button>
          </div>
          <div style="padding: 24px; display: flex; flex-direction: column; gap: 16px;">
             <div>
               <label style="display: block; font-size: 13px; font-weight: 500; margin-bottom: 6px; color: var(--text-muted);">模型名称</label>
               <input type="text" id="cmName" class="input" placeholder="如: Ollama Llama3" style="width: 100%;" />
             </div>
             <div>
               <label style="display: block; font-size: 13px; font-weight: 500; margin-bottom: 6px; color: var(--text-muted);">API 地址</label>
               <input type="text" id="cmUrl" class="input" placeholder="如: http://127.0.0.1:11434/v1" style="width: 100%;" />
             </div>
             <div>
               <label style="display: block; font-size: 13px; font-weight: 500; margin-bottom: 6px; color: var(--text-muted);">API Key (可选)</label>
               <input type="password" id="cmKey" class="input" placeholder="sk-..." style="width: 100%;" />
             </div>
             <button class="btn btn-primary" id="saveCustomModelBtn" style="width: 100%;">保存</button>
          </div>
       </div>
    </div>

    <!-- API Key 配置 Modal -->
    <div id="apiKeyModal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1000; align-items: center; justify-content: center; backdrop-filter: blur(4px);">
       <div style="background: var(--bg-app); width: 450px; max-width: 90%; border-radius: 20px; box-shadow: 0 24px 48px rgba(0,0,0,0.2); overflow: hidden;">
          <div style="padding: 20px 24px; border-bottom: 1px solid var(--border-light); display: flex; justify-content: space-between; align-items: center;">
             <h3 style="margin: 0; font-size: 18px;" id="apiKeyModalTitle">配置 API Key</h3>
             <button id="closeApiKeyModal" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-muted);">&times;</button>
          </div>
          <div style="padding: 24px; display: flex; flex-direction: column; gap: 16px;">
             <div>
               <label style="display: block; font-size: 13px; font-weight: 500; margin-bottom: 6px; color: var(--text-muted);">API Key</label>
               <input type="password" id="apiKeyInput" class="input" placeholder="sk-..." style="width: 100%;" />
             </div>
             <div>
               <label style="display: block; font-size: 13px; font-weight: 500; margin-bottom: 6px; color: var(--text-muted);">API 地址 (可自定义代理)</label>
               <input type="text" id="apiUrlInput" class="input" style="width: 100%;" />
             </div>
             <button class="btn btn-primary" id="saveApiKeyBtn" style="width: 100%;">保存配置</button>
          </div>
       </div>
    </div>
  `;

  // 面包屑
  document.getElementById('breadcrumb').addEventListener('click', (e) => {
    const link = e.target.closest('.crumb-link');
    if (!link) return;
    if (link.dataset.target === 'vendor') {
      currentLevel = 'vendor';
      currentVendor = null;
      renderView();
    }
  });

  // 自定义模型 Modal
  document.getElementById('addCustomModelBtn').addEventListener('click', () => {
    document.getElementById('customModelModal').style.display = 'flex';
  });
  document.getElementById('closeCustomModal').addEventListener('click', () => {
    document.getElementById('customModelModal').style.display = 'none';
  });
  document.getElementById('customModelModal').addEventListener('click', (e) => {
    if(e.target.id === 'customModelModal') e.target.style.display = 'none';
  });
  document.getElementById('saveCustomModelBtn').addEventListener('click', async () => {
    const name = document.getElementById('cmName').value.trim();
    const url = document.getElementById('cmUrl').value.trim();
    const key = document.getElementById('cmKey').value.trim();
    if (!name || !url) {
      if (window.__toast) window.__toast.error('名称和地址不能为空');
      return;
    }
    const id = 'custom_' + Date.now();
    settings.providers[id] = { baseUrl: url, apiKey: key, customName: name };
    try { await window.openClaw.settings.save(settings); } catch(e) {}
    if (window.__toast) window.__toast.success('自定义模型已添加！');
    document.getElementById('customModelModal').style.display = 'none';
  });

  // API Key Modal
  document.getElementById('closeApiKeyModal').addEventListener('click', () => {
    document.getElementById('apiKeyModal').style.display = 'none';
  });
  document.getElementById('apiKeyModal').addEventListener('click', (e) => {
    if(e.target.id === 'apiKeyModal') e.target.style.display = 'none';
  });

  renderView();
}

let pendingVendorId = null;

function openApiKeyModal(vendorId, vendorName, defaultUrl) {
  pendingVendorId = vendorId;
  document.getElementById('apiKeyModalTitle').textContent = `配置 ${vendorName} API Key`;
  const existing = settings.providers[vendorId] || {};
  document.getElementById('apiKeyInput').value = existing.apiKey || '';
  document.getElementById('apiUrlInput').value = existing.baseUrl || defaultUrl || '';
  document.getElementById('apiKeyModal').style.display = 'flex';

  // 替换保存按钮监听器
  const saveBtn = document.getElementById('saveApiKeyBtn');
  const newBtn = saveBtn.cloneNode(true);
  saveBtn.parentNode.replaceChild(newBtn, saveBtn);
  newBtn.addEventListener('click', async () => {
    const key = document.getElementById('apiKeyInput').value.trim();
    const url = document.getElementById('apiUrlInput').value.trim();
    settings.providers[pendingVendorId] = { apiKey: key, baseUrl: url };
    try { await window.openClaw.settings.save(settings); } catch(e) {}
    if (window.__toast) window.__toast.success('配置已保存！');
    document.getElementById('apiKeyModal').style.display = 'none';
    renderView(); // 刷新状态
  });
}

function renderView() {
  const content = document.getElementById('marketContent');
  const breadcrumb = document.getElementById('breadcrumb');

  if (currentLevel === 'vendor') {
    breadcrumb.innerHTML = `<span style="color: var(--text-primary);">🏠 全部厂商</span>`;

    content.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; margin-top: 20px;">
        ${vendors.map(v => {
          const conf = settings.providers[v.id] || {};
          const isConfigured = conf.apiKey && conf.apiKey.trim() !== '';
          return `
          <div class="card vendor-card" data-id="${v.id}" style="cursor: pointer; position: relative; overflow: hidden; transition: all 0.2s;">
            <!-- 配置状态标识 -->
            <div style="position: absolute; top: 16px; right: 16px; display: flex; gap: 8px;">
              ${isConfigured ? `<span style="font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 12px; background: rgba(52,199,89,0.15); color: var(--success); border: 1px solid rgba(52,199,89,0.3);">已配置</span>` : ''}
              <span style="font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 12px; background: ${v.isLocal ? 'rgba(0, 217, 255, 0.1)' : 'rgba(108, 99, 255, 0.1)'}; color: ${v.isLocal ? '#00d9ff' : '#6c63ff'}; border: 1px solid currentColor;">
                 ${v.isLocal ? '本地' : '云端'}
              </span>
            </div>
            <div style="font-size: 40px; margin-bottom: 16px;">${v.icon}</div>
            <h3 style="margin: 0 0 8px 0; font-size: 18px;">${v.name}</h3>
            <p style="margin: 0; font-size: 13px; color: var(--text-muted); line-height: 1.5;">${v.desc}</p>
            <div style="margin-top: 16px; display: flex; gap: 8px;">
              <button class="btn btn-secondary browse-models-btn" data-id="${v.id}" style="flex: 1; padding: 6px 12px; border-radius: 12px; font-size: 13px;">浏览模型</button>
              <button class="btn ${isConfigured ? 'btn-secondary' : 'btn-primary'} config-btn" data-id="${v.id}" style="flex: 1; padding: 6px 12px; border-radius: 12px; font-size: 13px;">${isConfigured ? '修改配置' : '快速配置'}</button>
            </div>
          </div>
        `}).join('')}
      </div>
    `;

    // 浏览模型
    document.querySelectorAll('.browse-models-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        currentVendor = vendors.find(x => x.id === id);
        currentLevel = 'models';
        renderView();
      });
    });

    // 快速配置
    document.querySelectorAll('.config-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const v = vendors.find(x => x.id === id);
        openApiKeyModal(id, v.name, v.url);
      });
    });

    // 卡片点击进入模型
    document.querySelectorAll('.vendor-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        const id = card.dataset.id;
        currentVendor = vendors.find(x => x.id === id);
        currentLevel = 'models';
        renderView();
      });
    });

  } else if (currentLevel === 'models') {
    breadcrumb.innerHTML = `
      <span class="crumb-link" data-target="vendor" style="color: var(--primary); cursor: pointer;">🏠 全部厂商</span>
      <span style="color: var(--text-muted);">/</span>
      <span style="color: var(--text-primary);">${currentVendor.icon} ${currentVendor.name}</span>
    `;

    const modelsList = mockModels[currentVendor.id] || [];
    const conf = settings.providers[currentVendor.id] || {};
    const isConfigured = conf.apiKey && conf.apiKey.trim() !== '';

    content.innerHTML = `
      <!-- 厂商信息头 -->
      <div class="card" style="margin-top: 20px; padding: 20px; display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 16px;">
          <div style="font-size: 36px;">${currentVendor.icon}</div>
          <div>
            <h3 style="margin: 0 0 4px 0; font-size: 20px;">${currentVendor.name}</h3>
            <div style="font-size: 13px; color: var(--text-muted);">${currentVendor.desc}</div>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 12px;">
          ${isConfigured
            ? `<span style="display: flex; align-items: center; gap: 6px; color: var(--success); font-size: 13px;">
                 <span style="width: 8px; height: 8px; background: var(--success); border-radius: 50%; display: inline-block;"></span>
                 已配置
               </span>`
            : `<span style="color: var(--text-muted); font-size: 13px;">未配置</span>`
          }
          <button class="btn ${isConfigured ? 'btn-secondary' : 'btn-primary'}" id="vendorConfigBtn" style="padding: 6px 16px; border-radius: 12px;">${isConfigured ? '修改 API Key' : '配置 API Key'}</button>
        </div>
      </div>

      <!-- 模型列表 -->
      <div style="margin-top: 20px; display: flex; flex-direction: column; gap: 12px;">
        ${modelsList.length === 0
          ? `<div style="text-align: center; padding: 60px 20px; color: var(--text-muted);">
               <div style="font-size: 48px; margin-bottom: 16px;">🚧</div>
               <div>此厂商暂无模型展示</div>
             </div>`
          : modelsList.map(m => `
          <div class="card" style="display: flex; align-items: center; justify-content: space-between; padding: 16px 20px;">
             <div style="display: flex; align-items: center; gap: 16px;">
                <div style="width: 40px; height: 40px; background: var(--bg-active); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 20px;">
                   ${currentVendor.icon}
                </div>
                <div>
                   <h4 style="margin: 0 0 4px 0; font-size: 16px;">${m.name}</h4>
                   <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                     ${m.tags.map(t => `<span style="font-size: 11px; background: var(--bg-app); padding: 2px 6px; border-radius: 4px; border: 1px solid var(--border-light);">${t}</span>`).join('')}
                     <span style="font-size: 11px; color: var(--text-muted); padding: 2px 6px;">${m.size}</span>
                   </div>
                </div>
             </div>
             <button class="btn btn-primary model-action-btn" data-model="${m.id}" style="padding: 6px 16px; border-radius: 20px;">
               ${currentVendor.isLocal ? '下载部署' : (isConfigured ? '使用此模型' : '需先配置')}
             </button>
          </div>
        `).join('')}
      </div>
    `;

    document.getElementById('vendorConfigBtn').addEventListener('click', () => {
      openApiKeyModal(currentVendor.id, currentVendor.name, currentVendor.url);
    });

    document.querySelectorAll('.model-action-btn').forEach(btn => {
       btn.addEventListener('click', () => {
          if (currentVendor.isLocal) {
             if (window.__toast) window.__toast.success('已加入国内镜像下载队列！');
          } else if (!isConfigured) {
             openApiKeyModal(currentVendor.id, currentVendor.name, currentVendor.url);
          } else {
             if (window.__toast) window.__toast.success(`已选用模型: ${btn.dataset.model}`);
          }
       });
    });
  }
}
