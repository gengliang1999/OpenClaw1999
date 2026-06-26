const fs = require('fs');
let code = fs.readFileSync('src/renderer/pages/chat.ts', 'utf8');

const startIdx = code.indexOf('async function loadModels() {');
const endFuncStr = 'async function createNewChat() {';
const endIdx = code.indexOf(endFuncStr);

if (startIdx !== -1 && endIdx !== -1) {
  const newLoadModels = `async function loadModels() {
  try {
    const res = await api.model.getModels();
    
    // 移除重复模型，保留最后一个唯一 ID
    const uniqueMap = new Map();
    (res || []).forEach(m => uniqueMap.set(m.id, m));
    models = Array.from(uniqueMap.values());
    
    const isLocal = (m) => m.type === 'local' || m.provider === 'LM Studio' || m.provider === 'Ollama' || m.id.toLowerCase().includes('local') || m.id.toLowerCase().includes('ollama');
    
    const localModels = models.filter(m => isLocal(m));
    const cloudModelsConfigured = models.filter(m => !isLocal(m) && m.configured !== false);
    
    // 渲染云端模型（直接展示所有可用模型）
    const renderedCloud = cloudModelsConfigured.map(m => \`
      <div class="model-select-card" data-id="\${m.id}" data-configured="true" style="padding: 12px; border: 1px solid var(--border-light); border-radius: 12px; cursor: pointer; transition: all 0.2s; background: var(--bg-card); display: flex; flex-direction: column; gap: 4px;">
         <div style="font-weight: 600; font-size: 14px; display: flex; align-items: center; justify-content: space-between;">
           <span style="display: flex; align-items: center; gap: 6px;">
             <span>☁️</span> \${m.name || m.id}
           </span>
           <span style="display: inline-block; width: 8px; height: 8px; background-color: var(--success, #00c853); border-radius: 50%; box-shadow: 0 0 8px var(--success, #00c853);" title="模型就绪"></span>
         </div>
         <div style="font-size: 11px; color: var(--text-muted); display: flex; align-items: center; justify-content: space-between;">
           <span>厂商: \${m.provider || '未知'}</span>
           <span title="底层调用模型名称">[\${m.modelName || '未知'}]</span>
         </div>
      </div>
    \`).join('');

    const renderLocalCard = (m) => \`
      <div class="model-select-card" data-id="\${m.id}" data-configured="true" style="padding: 12px; border: 1px solid var(--border-light); border-radius: 12px; cursor: pointer; transition: all 0.2s; background: var(--bg-card); display: flex; flex-direction: column; gap: 4px;">
         <div style="font-weight: 600; font-size: 14px; display: flex; align-items: center; justify-content: space-between;">
           <span style="display: flex; align-items: center; gap: 6px;">
             <span>💻</span> \${m.name || m.id}
           </span>
           <span style="display: inline-block; width: 8px; height: 8px; background-color: var(--success, #00c853); border-radius: 50%; box-shadow: 0 0 8px var(--success, #00c853);" title="模型就绪"></span>
         </div>
         <div style="font-size: 11px; color: var(--text-muted); display: flex; align-items: center; justify-content: space-between;">
           <span>厂商: \${m.provider || '本地引擎'}</span>
           <span title="底层调用模型名称">[\${m.modelName || m.id}]</span>
         </div>
      </div>
    \`;

    (document.getElementById('cloudModelsGrid') as any).innerHTML = renderedCloud.length > 0 ? renderedCloud : '<div style="color:var(--text-muted); font-size: 12px;">暂未配置可用云端模型</div>';
    (document.getElementById('localModelsGrid') as any).innerHTML = localModels.length > 0 ? localModels.map(renderLocalCard).join('') : '<div style="color:var(--text-muted); font-size: 12px;">暂未配置可用本地模型</div>';
    
    // 绑定弹窗内模型点击
    document.querySelectorAll('.model-select-card').forEach(card => {
       card.addEventListener('click', async () => {
          const id = card.getAttribute('data-id');
          activeModelId = id;
          const modelObj = models.find(x => x.id === activeModelId);
          if(modelObj) {
            (document.getElementById('activeModelLabel') as any).textContent = modelObj.name || id;
          }
          
          // 通知后端更新 activeModelId
          if (api.model && api.model.setActiveModel) {
            await api.model.setActiveModel(id).catch(e=>console.error(e));
          }

          (document.getElementById('modelSelectionModal') as any).style.display = 'none';
          if(window.__toast) window.__toast.success(\`已切换为: \${modelObj?.name || id}\`);
       });
    });

    const activeRes = await api.model.getActiveModel();
    if (activeRes && activeRes.id) {
      activeModelId = activeRes.id;
    } else if (models.length > 0) {
      activeModelId = models[0].id;
    }
    
    const initialModel = models.find(x => x.id === activeModelId);
    if(initialModel) {
       (document.getElementById('activeModelLabel') as any).textContent = initialModel.name || initialModel.id;
    } else if (activeModelId) {
       (document.getElementById('activeModelLabel') as any).textContent = activeModelId;
    }
  } catch (e) {
    console.error('Failed to load models:', e);
  }
}

`;
  code = code.substring(0, startIdx) + newLoadModels + code.substring(endIdx);
  fs.writeFileSync('src/renderer/pages/chat.ts', code, 'utf8');
  console.log('Fixed encoding in chat.ts successfully.');
} else {
  console.log('Failed to find loadModels boundaries.');
}
