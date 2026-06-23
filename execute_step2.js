const fs = require('fs');

const file = 'src/renderer/pages/settings.js';
let content = fs.readFileSync(file, 'utf8');

// 1. Replace the header section (Title)
content = content.replace(/<!-- 页面标题 -->[\s\S]*?<\/div>/, 
`<!-- 页面标题 -->
      <div style="margin-bottom: 32px; display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px;">
        <div>
          <h2 style="font-size: 28px; font-weight: 700; margin: 0 0 8px 0; color: var(--text-primary);">模型配置中心</h2>
          <p style="color: var(--text-secondary); margin: 0; font-size: 14px;">一站式管理您的本地大模型与所有云端主流大模型服务接口</p>
        </div>
        <div style="display: flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.05); padding: 8px 16px; border-radius: 8px; border: 1px solid var(--border-light);">
          <input type="checkbox" id="autoPreloadToggle" style="width: 16px; height: 16px; accent-color: var(--primary); cursor: pointer;" />
          <label for="autoPreloadToggle" style="font-size: 14px; cursor: pointer; user-select: none;">启动时自动加载默认本地模型到显存</label>
        </div>
      </div>`);

// 2. Replace 分区 1 Header
content = content.replace(/<h3 style="font-size: 18px; font-weight: 600; margin: 0 0 16px 0; display: flex; align-items: center; gap: 8px;">[\s\S]*?<\/h3>/,
`<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h3 style="font-size: 18px; font-weight: 600; margin: 0; display: flex; align-items: center; gap: 8px;">
            <span style="color: #34c759;">🟢</span> 已配置模型
          </h3>
          <button class="btn btn-primary" id="autoSyncLocalBtn" style="display: flex; align-items: center; gap: 6px; border: none; box-shadow: 0 2px 8px rgba(108, 99, 255, 0.4);">
            ✨ 自动扫描全盘模型
          </button>
        </div>`);

// 3. Replace 分区 2 Header
content = content.replace(/<!-- 分区 2：未配置厂商接入 -->\s*<div class="settings-section">\s*<h3[\s\S]*?<\/h3>/,
`<!-- 分区 2：未配置厂商接入 -->
      <div class="settings-section">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h3 style="font-size: 18px; font-weight: 600; margin: 0; display: flex; align-items: center; gap: 8px;">
            <span style="color: #0a84ff;">⚡</span> 发现与接入
          </h3>
          <button class="btn btn-default" id="customModelBtn" style="display: flex; align-items: center; gap: 6px; border-color: var(--primary); color: var(--primary); background: rgba(108, 99, 255, 0.1);">
            ⚙️ 添加自定义模型 (兼容第三方)
          </button>
        </div>`);

// 4. Inject Event Listeners at the end of render()
content = content.replace(/document\.head\.appendChild\(style\);\s*\}/,
`document.head.appendChild(style);
  }

  setTimeout(async () => {
    // 绑定自动预加载开关
    try {
      const res = await fetch('http://127.0.0.1:3721/api/settings');
      const settings = await res.json();
      const toggle = document.getElementById('autoPreloadToggle');
      if (toggle) {
        toggle.checked = !!settings.autoPreloadLocalModel;
        toggle.addEventListener('change', async (e) => {
          await fetch('http://127.0.0.1:3721/api/settings/autoPreloadLocalModel', {
            method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ value: e.target.checked })
          });
          window.__toast?.success('设置已保存');
        });
      }
    } catch(e) {}

    // 绑定自动扫描按钮
    document.getElementById('autoSyncLocalBtn')?.addEventListener('click', async () => {
      const btn = document.getElementById('autoSyncLocalBtn');
      btn.innerHTML = '🔄 正在扫描...';
      btn.disabled = true;
      try {
        const res = await window.openClaw.model.syncLocalModels();
        if (res.count > 0) {
          window.__toast?.success('成功扫描并添加了 ' + res.count + ' 个本地模型！');
          await loadModels();
        } else {
          window.__toast?.info('未发现新的本地模型');
        }
      } catch(e) {
        window.__toast?.error('扫描失败: ' + e.message);
      } finally {
        btn.innerHTML = '✨ 自动扫描全盘模型';
        btn.disabled = false;
      }
    });

    // 绑定自定义配置按钮
    document.getElementById('customModelBtn')?.addEventListener('click', () => {
      showCustomProviderConfig();
    });
  }, 100);
}`);

// 5. Inject Preload Button in renderConfiguredModels
content = content.replace(/<div style="display: flex; gap: 8px; margin-top: auto; padding-top: 12px; border-top: 1px solid var\(--border-light\);">/,
`<div style="display: flex; gap: 8px; margin-top: auto; padding-top: 12px; border-top: 1px solid var(--border-light);">
          \${isLocal ? \`<button class="btn btn-default preload-model-btn" data-id="\${m.id}" style="flex: 1; padding: 6px;">📥 预热显存</button>\` : ''}`);

// 6. Inject Preload Event Listener in renderConfiguredModels
content = content.replace(/document\.querySelectorAll\('\.set-active-btn'\)\.forEach/,
`document.querySelectorAll('.preload-model-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = '预热中...';
      try {
        const res = await window.openClaw.model.preloadModel(btn.dataset.id);
        window.__toast?.success(res.message || '已触发预热请求');
      } catch (err) {
        window.__toast?.error('加载失败: ' + err.message);
      } finally {
        setTimeout(() => {
          btn.disabled = false;
          btn.textContent = '📥 预热显存';
        }, 1500);
      }
    });
  });

  document.querySelectorAll('.set-active-btn').forEach`);

fs.writeFileSync(file, content);
console.log('Patched settings.js successfully.');
