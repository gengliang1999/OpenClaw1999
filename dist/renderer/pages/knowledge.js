/**
 * 知识库页面模块 (Knowledge UI)
 * 用于提供极简的 RAG 本地知识引擎前端拖拽交互界面
 */
import { api } from '../utils.js';
export function render(container) {
    container.innerHTML = `
    <div class="page-container" style="padding: 20px; color: var(--text-primary); display: flex; flex-direction: column; height: 100%; box-sizing: border-box; overflow: hidden;">
      <div class="page-header" style="margin-bottom: 20px;">
        <h2 style="margin: 0; font-size: 24px;">📚 本地私有知识引擎</h2>
        <p style="margin: 5px 0 0 0; color: var(--text-secondary); font-size: 14px;">
          在此处拖拽或上传 PDF/Markdown 文档。OpenClaw 将在纯本地对文件进行切片与向量化，构建您的专属超级记忆。
        </p>
      </div>

      <div class="knowledge-workspace" style="display: flex; gap: 20px; flex: 1; min-height: 0;">
        
        <!-- 左侧：知识库列表与上传区 -->
        <div class="knowledge-sidebar" style="flex: 1; border: 1px dashed var(--border-color); border-radius: 12px; display: flex; flex-direction: column; background: var(--bg-card); position: relative; overflow: hidden;">
          <div id="dropZone" style="position: absolute; top:0; left:0; right:0; bottom:0; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(0,0,0,0.02); z-index: 10; transition: all 0.3s; cursor: pointer;">
            <div style="font-size: 48px; margin-bottom: 10px;">📥</div>
            <div style="font-weight: 600; font-size: 16px;">点击或拖拽文档到此处上传</div>
            <div style="font-size: 12px; color: var(--text-secondary); margin-top: 5px;">支持 .txt, .md (PDF即将在下版本接入)</div>
            <input type="file" id="fileUploadInput" multiple accept=".txt,.md,.json" style="display: none;" />
          </div>
          
          <div id="docListContainer" style="display: none; padding: 15px; flex: 1; overflow-y: auto; z-index: 15; background: var(--bg-card);">
             <h3 style="margin-top: 0; font-size: 14px; border-bottom: 1px solid var(--border-light); padding-bottom: 8px;">已入库文档</h3>
             <ul id="docList" style="list-style: none; padding: 0; margin: 0; font-size: 13px;">
               <!-- 文档列表 -->
             </ul>
             <button id="addMoreBtn" style="margin-top: 15px; width: 100%; padding: 8px; border-radius: 6px; border: 1px dashed var(--primary); background: transparent; color: var(--primary); cursor: pointer;">+ 继续上传</button>
          </div>
        </div>

        <!-- 右侧：检索测试区 -->
        <div class="knowledge-test" style="flex: 1; border: 1px solid var(--border-color); border-radius: 12px; padding: 15px; display: flex; flex-direction: column; background: var(--bg-card);">
           <h3 style="margin-top: 0; font-size: 14px; border-bottom: 1px solid var(--border-light); padding-bottom: 8px;">向量检索测试 (RAG Test)</h3>
           <textarea id="searchQuery" rows="3" placeholder="输入你想提问或搜索的关键词..." style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-input); color: var(--text-primary); font-size: 13px; resize: none; margin-bottom: 10px; box-sizing: border-box;"></textarea>
           <button id="searchBtn" style="padding: 8px 16px; background: var(--primary); color: #fff; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; align-self: flex-end;">🔍 测试检索</button>
           
           <div id="searchResults" style="margin-top: 15px; flex: 1; overflow-y: auto; font-size: 13px; color: var(--text-secondary); border-top: 1px dashed var(--border-light); padding-top: 10px;">
              在此处展示切片召回结果...
           </div>
        </div>
      </div>
    </div>
  `;
    bindEvents(container);
}
function bindEvents(container) {
    const dropZone = container.querySelector('#dropZone');
    const fileInput = container.querySelector('#fileUploadInput');
    const docListContainer = container.querySelector('#docListContainer');
    const addMoreBtn = container.querySelector('#addMoreBtn');
    // 简单的交互事件
    dropZone.addEventListener('click', () => {
        fileInput.click();
    });
    fileInput.addEventListener('change', (e) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            handleFiles(Array.from(files), dropZone, docListContainer);
        }
    });
    addMoreBtn.addEventListener('click', () => {
        fileInput.click();
    });
    // 拖拽支持
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.background = 'rgba(0,0,0,0.05)';
    });
    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.style.background = 'rgba(0,0,0,0.02)';
    });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.background = 'rgba(0,0,0,0.02)';
        if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
            handleFiles(Array.from(e.dataTransfer.files), dropZone, docListContainer);
        }
    });
    // 测试检索
    const searchBtn = container.querySelector('#searchBtn');
    const searchQuery = container.querySelector('#searchQuery');
    const searchResults = container.querySelector('#searchResults');
    searchBtn.addEventListener('click', async () => {
        const q = searchQuery.value.trim();
        if (!q)
            return;
        searchResults.innerHTML = '<div style="text-align:center; padding:20px;">正在向量空间中检索...</div>';
        try {
            const res = await window.api.post('/knowledge/search', { query: q });
            if (res && res.results && res.results.length > 0) {
                let html = '';
                res.results.forEach((r) => {
                    html += `<div style="margin-bottom:10px; padding:10px; background:rgba(0,0,0,0.03); border-radius:6px; border-left:3px solid var(--primary);">
            <div style="font-size:11px; color:var(--text-secondary); margin-bottom:4px;">匹配得分: ${r.score.toFixed(4)} | 来源: ${r.doc.metadata?.source || '未知'}</div>
            <div>${r.doc.content}</div>
          </div>`;
                });
                searchResults.innerHTML = html;
            }
            else {
                searchResults.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-secondary);">未找到相关内容</div>';
            }
        }
        catch (e) {
            searchResults.innerHTML = `<div style="color:red; padding: 10px;">检索失败：${e.message}</div>`;
        }
    });
}
async function handleFiles(files, dropZone, docListContainer) {
    dropZone.style.display = 'none';
    docListContainer.style.display = 'flex';
    docListContainer.style.flexDirection = 'column';
    const list = document.getElementById('docList');
    const fileDataPayload = [];
    if (list) {
        for (const f of files) {
            const li = document.createElement('li');
            li.id = 'doc-' + f.name.replace(/[^a-zA-Z0-9]/g, '');
            li.style.padding = '8px 0';
            li.style.borderBottom = '1px solid var(--border-light)';
            li.innerHTML = `📄 ${f.name} <span style="float:right; color: var(--primary); font-size:11px;">[正在入库...]</span>`;
            list.appendChild(li);
            const content = await f.text();
            fileDataPayload.push({ name: f.name, content });
        }
    }
    try {
        const res = await api.post('/knowledge/add', { files: fileDataPayload });
        if (res && res.success) {
            if (list) {
                for (const f of files) {
                    const li = document.getElementById('doc-' + f.name.replace(/[^a-zA-Z0-9]/g, ''));
                    if (li) {
                        li.innerHTML = `📄 ${f.name} <span style="float:right; color: #34c759; font-size:11px;">[已切片 ${res.chunksGenerated} 块]</span>`;
                    }
                }
            }
        }
    }
    catch (e) {
        console.error('上传入库失败:', e);
    }
}
export function unmount() {
    // 卸载钩子，符合红线要求。
}
