/**
 * 知识库页面模块 (Knowledge UI)
 * 用于提供 RAG 本地知识引擎管理、暂存审查与后台任务队列的综合交互界面
 */
import { api } from '../utils.js';
let pollInterval = null;
export function render(container) {
    container.innerHTML = `
    <div class="page-container" style="padding: 20px; color: var(--text-primary); display: flex; flex-direction: column; height: 100%; box-sizing: border-box; overflow: hidden; background: transparent;">
      
      <!-- 头部 -->
      <div class="page-header" style="margin-bottom: 20px; flex-shrink: 0;">
        <h2 style="margin: 0; font-size: 24px; display: flex; align-items: center; gap: 8px;">
          <span>📚</span> 本地私有知识引擎
        </h2>
        <p style="margin: 5px 0 0 0; color: var(--text-secondary); font-size: 13px;">
          拖拽投递本地文档。OpenClaw 后台任务队列将自动对文章进行深度清洗、大模型鉴伪核查，最终收纳进专属知识库。
        </p>
      </div>

      <!-- 工作台主区 -->
      <div class="knowledge-workspace" style="display: flex; gap: 20px; flex: 1; min-height: 0; overflow: hidden;">
        
        <!-- 左侧：多功能选项卡与文档管理 -->
        <div class="knowledge-sidebar" style="flex: 1.3; border: 1px solid var(--border-color); border-radius: 12px; display: flex; flex-direction: column; background: var(--bg-card); overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
          
          <!-- 选项卡导航栏 -->
          <div class="sidebar-tabs" style="display: flex; border-bottom: 1px solid var(--border-light); background: rgba(255,255,255,0.02); flex-shrink: 0;">
            <div class="sidebar-tab active" data-tab="verified" style="flex: 1; text-align: center; padding: 12px; cursor: pointer; border-bottom: 2px solid var(--primary); font-size: 13px; font-weight: 600; transition: all 0.2s;">
              已入库知识
            </div>
            <div class="sidebar-tab" data-tab="staging" style="flex: 1; text-align: center; padding: 12px; cursor: pointer; border-bottom: 2px solid transparent; font-size: 13px; color: var(--text-secondary); transition: all 0.2s;">
              暂存隔离区
            </div>
            <div class="sidebar-tab" data-tab="jobs" style="flex: 1; text-align: center; padding: 12px; cursor: pointer; border-bottom: 2px solid transparent; font-size: 13px; color: var(--text-secondary); transition: all 0.2s;">
              后台作业队列
            </div>
          </div>

          <!-- 内容展示容器 -->
          <div class="tab-content" style="flex: 1; display: flex; flex-direction: column; overflow-y: auto; padding: 15px; position: relative; min-height: 0;">
            
            <!-- 上传拖拽投放区 (当且仅当正式库为空或手动激活时显示) -->
            <div id="dropZone" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; border: 2px dashed var(--border-color); border-radius: 8px; transition: all 0.3s; cursor: pointer; min-height: 200px; background: rgba(255,255,255,0.01);">
              <div style="font-size: 40px; margin-bottom: 10px;">📥</div>
              <div style="font-weight: 600; font-size: 14px; color: var(--text-primary);">点击或将本地文件拖拽到此上传</div>
              <div style="font-size: 11px; color: var(--text-secondary); margin-top: 5px;">支持 .txt, .md, .json 文档格式</div>
              <input type="file" id="fileUploadInput" multiple accept=".txt,.md,.json" style="display: none;" />
            </div>

            <!-- 列表滚动区 -->
            <div id="listContainer" style="display: none; flex-direction: column; height: 100%; min-height: 0;">
              <div style="flex: 1; overflow-y: auto; min-height: 0;">
                <ul id="dataList" style="list-style: none; padding: 0; margin: 0;">
                  <!-- 动态异步列表项 -->
                </ul>
              </div>
              
              <!-- 仅在“已入库”选项卡展示投递按钮 -->
              <button id="addMoreBtn" style="margin-top: 15px; width: 100%; padding: 9px; border-radius: 6px; border: 1px dashed var(--primary); background: transparent; color: var(--primary); cursor: pointer; font-weight: 600; font-size: 12px; transition: all 0.2s; flex-shrink: 0;">
                + 投递新文件/网页
              </button>
              
              <!-- 批量导入与导出备份按钮 -->
              <div id="knowledgeBackupActions" style="display: flex; gap: 10px; margin-top: 10px; flex-shrink: 0;">
                <button id="importKnowledgeBtn" style="flex: 1; padding: 9px; border-radius: 6px; border: 1px solid var(--border-light); background: rgba(255,255,255,0.02); color: var(--text-primary); cursor: pointer; font-weight: 600; font-size: 12px; transition: all 0.2s;" onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background='rgba(255,255,255,0.02)'">📥 批量导入</button>
                <button id="exportKnowledgeBtn" style="flex: 1; padding: 9px; border-radius: 6px; border: 1px solid var(--border-light); background: rgba(255,255,255,0.02); color: var(--text-primary); cursor: pointer; font-weight: 600; font-size: 12px; transition: all 0.2s;" onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background='rgba(255,255,255,0.02)'">📤 导出全部</button>
              </div>
            </div>
            
          </div>
        </div>

        <!-- 右侧：语义检索测试区 -->
        <div class="knowledge-test" style="flex: 1; border: 1px solid var(--border-color); border-radius: 12px; padding: 15px; display: flex; flex-direction: column; background: var(--bg-card); box-shadow: 0 4px 12px rgba(0,0,0,0.1); min-height: 0;">
           <h3 style="margin-top: 0; font-size: 14px; border-bottom: 1px solid var(--border-light); padding-bottom: 8px; color: var(--text-primary);">
             向量空间检索测试 (RAG Test)
           </h3>
           <textarea id="searchQuery" rows="3" placeholder="输入你想召回或搜索的语义关键词..." style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-input); color: var(--text-primary); font-size: 13px; resize: none; margin-bottom: 10px; box-sizing: border-box; outline: none;"></textarea>
           <button id="searchBtn" style="padding: 8px 16px; background: var(--primary); color: #fff; border: none; border-radius: 6px; font-weight: 600; font-size: 12px; cursor: pointer; align-self: flex-end; transition: all 0.2s;">
             🔍 检索测试
           </button>
           
           <div id="searchResults" style="margin-top: 15px; flex: 1; overflow-y: auto; font-size: 13px; color: var(--text-secondary); border-top: 1px dashed var(--border-light); padding-top: 10px; min-height: 0;">
             <div style="text-align: center; padding: 30px 10px; color: var(--text-secondary); font-size: 12px;">
               输入查询后点击检索，测试本地混合粗排与二次 Rerank 重排召回。
             </div>
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
    const listContainer = container.querySelector('#listContainer');
    const addMoreBtn = container.querySelector('#addMoreBtn');
    const dataList = container.querySelector('#dataList');
    const tabs = container.querySelectorAll('.sidebar-tab');
    let activeTab = 'verified'; // 'verified' | 'staging' | 'jobs'
    // Tab 切换逻辑
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => {
                t.classList.remove('active');
                t.style.borderBottomColor = 'transparent';
                t.style.color = 'var(--text-secondary)';
                t.style.fontWeight = 'normal';
            });
            tab.classList.add('active');
            tab.style.borderBottomColor = 'var(--primary)';
            tab.style.color = 'var(--text-primary)';
            tab.style.fontWeight = '600';
            activeTab = tab.dataset.tab || 'verified';
            loadTabData();
        });
    });
    // 加载当前 Tab 数据
    async function loadTabData() {
        // 每次切换标签，先清空历史轮询定时器
        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }
        dataList.innerHTML = '<div style="text-align:center; padding:30px; font-size:12px; color:var(--text-secondary);">正在加载列表...</div>';
        try {
            const backupActions = container.querySelector('#knowledgeBackupActions');
            if (activeTab === 'verified') {
                dropZone.style.display = 'none';
                listContainer.style.display = 'flex';
                addMoreBtn.style.display = 'block';
                if (backupActions)
                    backupActions.style.display = 'flex';
                const files = await api.get('/knowledge/files?category=默认知识库');
                if (!files || files.length === 0) {
                    dropZone.style.display = 'flex';
                    listContainer.style.display = 'none';
                }
                else {
                    renderVerifiedFiles(files);
                }
            }
            else if (activeTab === 'staging') {
                dropZone.style.display = 'none';
                listContainer.style.display = 'flex';
                addMoreBtn.style.display = 'none';
                if (backupActions)
                    backupActions.style.display = 'none';
                const stagingItems = await api.get('/knowledge/staging');
                renderStagingItems(stagingItems);
            }
            else if (activeTab === 'jobs') {
                dropZone.style.display = 'none';
                listContainer.style.display = 'flex';
                addMoreBtn.style.display = 'none';
                if (backupActions)
                    backupActions.style.display = 'none';
                // 拉取首屏，并建立 3 秒轮询
                await fetchAndRenderJobs();
                pollInterval = setInterval(fetchAndRenderJobs, 3000);
            }
        }
        catch (e) {
            dataList.innerHTML = `<div style="color:red; padding:15px; font-size:12px;">加载失败: ${e.message}</div>`;
        }
    }
    // 渲染已入库列表
    function renderVerifiedFiles(files) {
        dataList.innerHTML = '';
        files.forEach(f => {
            const li = document.createElement('li');
            li.style.padding = '10px';
            li.style.marginBottom = '8px';
            li.style.background = 'rgba(255,255,255,0.02)';
            li.style.border = '1px solid var(--border-color)';
            li.style.borderRadius = '8px';
            li.style.display = 'flex';
            li.style.justifyContent = 'space-between';
            li.style.alignItems = 'center';
            li.innerHTML = `
        <div style="flex: 1; min-width: 0; padding-right: 10px;">
          <div style="font-weight:600; font-size:13px; text-overflow: ellipsis; overflow:hidden; white-space:nowrap;">📄 ${f.source}</div>
          <div style="font-size:11px; color:var(--text-secondary); margin-top:3px;">切片数: ${f.chunkCount} 块 | 时间: ${new Date(f.timestamp).toLocaleString()}</div>
        </div>
        <div style="display: flex; gap: 6px; flex-shrink: 0;">
          <button class="edit-file-btn" data-source="${f.source}" style="padding: 4px 8px; border-radius: 4px; border: 1px solid var(--border-color); background: transparent; color: #00f2fe; font-size:11px; cursor:pointer; transition:all 0.2s;">
            ✏️ 编辑
          </button>
          <button class="delete-file-btn" data-source="${f.source}" style="padding: 4px 8px; border-radius: 4px; border: 1px solid var(--border-color); background: transparent; color: #ff3b30; font-size:11px; cursor:pointer; transition:all 0.2s;">
            🗑️ 删除
          </button>
        </div>
      `;
            const editBtn = li.querySelector('.edit-file-btn');
            editBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                showEditKnowledgeModal(f.source, '默认知识库', () => {
                    loadTabData();
                });
            });
            const deleteBtn = li.querySelector('.delete-file-btn');
            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (confirm(`确定要物理删除该知识文档吗？（删除后对应的原子记忆将联动失去 promoted 标识重回艾宾浩斯降权测试区）\n文件名: ${f.source}`)) {
                    deleteBtn.disabled = true;
                    deleteBtn.innerText = '正在删除...';
                    try {
                        await api.delete('/knowledge/files', { source: f.source, category: '默认知识库' });
                        loadTabData();
                    }
                    catch (err) {
                        alert('删除失败: ' + err.message);
                        deleteBtn.disabled = false;
                        deleteBtn.innerText = '🗑️ 删除';
                    }
                }
            });
            dataList.appendChild(li);
        });
    }
    // 渲染暂存区列表
    function renderStagingItems(items) {
        dataList.innerHTML = '';
        if (!items || items.length === 0) {
            dataList.innerHTML = '<div style="text-align:center; padding:30px; font-size:12px; color:var(--text-secondary);">暂存隔离区空空如也</div>';
            return;
        }
        items.forEach(item => {
            const li = document.createElement('li');
            li.style.padding = '12px';
            li.style.marginBottom = '8px';
            li.style.background = 'rgba(255,255,255,0.02)';
            li.style.border = '1px solid var(--border-color)';
            li.style.borderRadius = '8px';
            li.style.display = 'flex';
            li.style.flexDirection = 'column';
            const isFailed = item.status === 'failed_verification';
            const statusBadge = isFailed
                ? `<span style="background: rgba(255, 59, 48, 0.15); color: #ff3b30; border: 1px solid rgba(255, 59, 48, 0.3); padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight:600; margin-left:6px;">⚠️ AI 鉴伪拦截</span>`
                : `<span style="background: rgba(255, 149, 0, 0.15); color: #ff9500; border: 1px solid rgba(255, 149, 0, 0.3); padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight:600; margin-left:6px;">待核查</span>`;
            li.innerHTML = `
        <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <div style="font-weight:600; font-size:13px; flex:1; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">
            🔍 ${item.source} ${statusBadge}
          </div>
          <div style="display:flex; gap:6px; flex-shrink:0;">
            <button class="stage-approve-btn" style="padding: 3px 8px; background: var(--primary); color:#fff; border:none; border-radius:4px; font-size:11px; cursor:pointer; font-weight:600;">✔️ 批准</button>
            <button class="stage-reject-btn" style="padding: 3px 8px; border:1px solid var(--border-color); background:transparent; color:#ff3b30; border-radius:4px; font-size:11px; cursor:pointer;">❌ 丢弃</button>
          </div>
        </div>
        <div style="font-size:11px; color:var(--text-secondary);">暂存切片: ${item.chunkCount} 块 | 分类属性: ${item.category || '默认知识库'}</div>
        ${isFailed && item.failReason ? `
          <div style="color: #ff3b30; font-size: 11px; margin-top: 8px; padding: 8px; background: rgba(255, 59, 48, 0.05); border-left: 2px solid #ff3b30; border-radius: 4px; line-height: 1.4;">
            <strong>AI 研判理由：</strong>${item.failReason}
          </div>
        ` : ''}
      `;
            // 绑定批准按钮
            const approveBtn = li.querySelector('.stage-approve-btn');
            approveBtn.addEventListener('click', async () => {
                approveBtn.disabled = true;
                try {
                    await api.post('/knowledge/staging/action', {
                        source: item.source,
                        action: 'approve',
                        category: item.category || '默认知识库'
                    });
                    loadTabData();
                }
                catch (err) {
                    alert('审批通过失败: ' + err.message);
                    approveBtn.disabled = false;
                }
            });
            // 绑定丢弃按钮
            const rejectBtn = li.querySelector('.stage-reject-btn');
            rejectBtn.addEventListener('click', async () => {
                if (confirm('确定要永久丢弃该暂存区文档吗？')) {
                    rejectBtn.disabled = true;
                    try {
                        await api.post('/knowledge/staging/action', {
                            source: item.source,
                            action: 'reject'
                        });
                        loadTabData();
                    }
                    catch (err) {
                        alert('丢弃失败: ' + err.message);
                        rejectBtn.disabled = false;
                    }
                }
            });
            dataList.appendChild(li);
        });
    }
    // 轮询获取后台任务
    async function fetchAndRenderJobs() {
        try {
            const jobs = await api.get('/system/background-jobs');
            renderJobs(jobs);
        }
        catch (e) {
            console.error('轮询后台任务队列失败:', e.message);
        }
    }
    // 渲染任务队列
    function renderJobs(jobs) {
        // 仅在当前选项卡依然为 jobs 时才执行绘制，防止网络竞态延迟导致覆盖其他 Tab
        if (activeTab !== 'jobs')
            return;
        dataList.innerHTML = '';
        if (!jobs || jobs.length === 0) {
            dataList.innerHTML = '<div style="text-align:center; padding:30px; font-size:12px; color:var(--text-secondary);">后台任务队列空闲，没有积压的提炼或合并任务</div>';
            return;
        }
        jobs.forEach(job => {
            const li = document.createElement('li');
            li.style.padding = '10px 12px';
            li.style.marginBottom = '8px';
            li.style.background = 'rgba(255,255,255,0.02)';
            li.style.border = '1px solid var(--border-color)';
            li.style.borderRadius = '8px';
            li.style.display = 'flex';
            li.style.flexDirection = 'column';
            let statusBadge = '';
            if (job.status === 'pending') {
                statusBadge = `<span style="background: rgba(142, 142, 147, 0.15); color: #8e8e93; border: 1px solid rgba(142, 142, 147, 0.3); padding: 2px 6px; border-radius: 4px; font-size: 10px;">⏳ 排队中</span>`;
            }
            else if (job.status === 'processing') {
                statusBadge = `<span style="background: rgba(255, 204, 0, 0.15); color: #ffcc00; border: 1px solid rgba(255, 204, 0, 0.3); padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight:600;">⚙️ AI 提炼中</span>`;
            }
            else if (job.status === 'retry') {
                statusBadge = `<span style="background: rgba(0, 122, 255, 0.15); color: #007aff; border: 1px solid rgba(0, 122, 255, 0.3); padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight:600;">⚠️ 异常重试 (第 ${job.retry_count} 次)</span>`;
            }
            else if (job.status === 'failed') {
                statusBadge = `<span style="background: rgba(255, 59, 48, 0.15); color: #ff3b30; border: 1px solid rgba(255, 59, 48, 0.3); padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight:600;">💀 任务失败</span>`;
            }
            let typeName = job.task_type;
            if (job.task_type === 'memory-extraction')
                typeName = '🧠 长期记忆原子提取';
            else if (job.task_type === 'memory-consolidation')
                typeName = '🔄 SQLite 记忆反刍整理';
            else if (job.task_type === 'url')
                typeName = '🕸️ 采集源网页爬取鉴伪';
            li.innerHTML = `
        <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <div style="font-weight:600; font-size:12px; color: var(--text-primary);">${typeName}</div>
          <div>${statusBadge}</div>
        </div>
        <div style="font-size:11px; color:var(--text-secondary);">创建时间: ${new Date(job.created_at).toLocaleString()} | 任务ID: ${job.id.substring(0, 8)}...</div>
        ${job.last_error ? `
          <div style="color: #ff3b30; font-size: 11px; margin-top: 6px; padding: 6px; background: rgba(255, 59, 48, 0.04); border-left: 2px solid #ff3b30; border-radius: 4px; font-family: monospace;">
            <strong>错误报告:</strong> ${job.last_error}
          </div>
        ` : ''}
      `;
            dataList.appendChild(li);
        });
    }
    // 上传与拖拽交互绑定
    dropZone.addEventListener('click', () => {
        fileInput.click();
    });
    fileInput.addEventListener('change', (e) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            handleFiles(Array.from(files));
        }
    });
    addMoreBtn.addEventListener('click', () => {
        fileInput.click();
    });
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.background = 'rgba(255,255,255,0.03)';
        dropZone.style.borderColor = 'var(--primary)';
    });
    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.style.background = 'rgba(255,255,255,0.01)';
        dropZone.style.borderColor = 'var(--border-color)';
    });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.background = 'rgba(255,255,255,0.01)';
        dropZone.style.borderColor = 'var(--border-color)';
        if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
            handleFiles(Array.from(e.dataTransfer.files));
        }
    });
    // 处理拖投文件
    async function handleFiles(files) {
        dropZone.style.display = 'none';
        listContainer.style.display = 'flex';
        dataList.innerHTML = '<div style="text-align:center; padding:30px; font-size:12px; color:var(--text-secondary);">正在对文件进行断句、父子分块切片并投递队列...</div>';
        const fileDataPayload = [];
        for (const f of files) {
            const content = await f.text();
            fileDataPayload.push({ name: f.name, content });
        }
        try {
            const res = await api.post('/knowledge/add', { files: fileDataPayload, trustLevel: 'trusted' });
            if (res && res.success) {
                console.log(`[RAG Frontend] 文档切片投递完成，切片总数: ${res.chunksGenerated}`);
            }
        }
        catch (e) {
            console.error('切片投递异常:', e.message);
        }
        finally {
            // 成功投递后，强制刷新并展示已入库列表
            activeTab = 'verified';
            const verifiedTab = container.querySelector('[data-tab="verified"]');
            if (verifiedTab) {
                verifiedTab.click();
            }
            else {
                loadTabData();
            }
        }
    }
    // 检索功能绑定
    const searchBtn = container.querySelector('#searchBtn');
    const searchQuery = container.querySelector('#searchQuery');
    const searchResults = container.querySelector('#searchResults');
    searchBtn.addEventListener('click', async () => {
        const q = searchQuery.value.trim();
        if (!q)
            return;
        searchResults.innerHTML = '<div style="text-align:center; padding:30px; font-size:12px; color:var(--text-secondary);">正在发起双路召回并调用大模型进行二次 Rerank 重排...</div>';
        try {
            const res = await api.post('/knowledge/search', { query: q });
            if (res && res.results && res.results.length > 0) {
                let html = '';
                res.results.forEach((r) => {
                    html += `
            <div style="margin-bottom:12px; padding:12px; background:rgba(255,255,255,0.01); border:1px solid var(--border-light); border-radius:8px; border-left:3px solid var(--primary);">
              <div style="font-size:11px; color:var(--text-secondary); margin-bottom:5px; display:flex; justify-content:space-between;">
                <span>📂 来源: ${r.doc.metadata?.source || '本地录入'}</span>
                <span style="color:var(--primary); font-weight:600;">匹配权重 Score: ${r.score.toFixed(4)}</span>
              </div>
              <div style="line-height:1.4; font-size:12px; color:var(--text-primary); white-space:pre-wrap;">${r.doc.content}</div>
            </div>`;
                });
                searchResults.innerHTML = html;
            }
            else {
                searchResults.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-secondary); font-size:12px;">向量空间中无相关的高相关度切片候选</div>';
            }
        }
        catch (e) {
            searchResults.innerHTML = `<div style="color:#ff3b30; padding: 10px; font-size:12px;">检索测试异常：${e.message}</div>`;
        }
    });
    // 绑定批量导入与导出物理备份按钮事件
    const importKnowledgeBtn = container.querySelector('#importKnowledgeBtn');
    const exportKnowledgeBtn = container.querySelector('#exportKnowledgeBtn');
    if (importKnowledgeBtn) {
        importKnowledgeBtn.addEventListener('click', async () => {
            try {
                const res = await api.post('/knowledge/import', { category: '默认知识库' });
                if (res && res.success) {
                    alert(`已成功投递 ${res.importedCount} 个本地 file 至队列中进行后台自愈清洗与向量提炼！`);
                    const jobsTab = container.querySelector('.sidebar-tab[data-tab="jobs"]');
                    if (jobsTab)
                        jobsTab.click();
                }
            }
            catch (e) {
                alert('批量导入失败: ' + e.message);
            }
        });
    }
    if (exportKnowledgeBtn) {
        exportKnowledgeBtn.addEventListener('click', async () => {
            try {
                const res = await api.post('/knowledge/export', { category: '默认知识库' });
                if (res && res.success) {
                    alert(`知识库所有物理归档源文档成功导出备份至：\n${res.exportDir}`);
                }
            }
            catch (e) {
                alert('导出物理文档失败: ' + e.message);
            }
        });
    }
    // 首次渲染加载已入库选项卡数据
    loadTabData();
}
export function unmount() {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
        console.log('[Knowledge UI] 🛑 卸载页面，已成功销毁后台任务队列轮询计时器');
    }
}
// 物理归档文档整文编辑弹窗
function showEditKnowledgeModal(source, category, onSaved) {
    const loading = document.createElement('div');
    loading.style.position = 'fixed';
    loading.style.top = '0';
    loading.style.left = '0';
    loading.style.width = '100vw';
    loading.style.height = '100vh';
    loading.style.background = 'rgba(0,0,0,0.5)';
    loading.style.backdropFilter = 'blur(6px)';
    loading.style.display = 'flex';
    loading.style.justifyContent = 'center';
    loading.style.alignItems = 'center';
    loading.style.zIndex = '2000';
    loading.style.color = '#fff';
    loading.style.fontSize = '15px';
    loading.style.fontWeight = '600';
    loading.innerHTML = '🧬 正在读取物理源文档数据，请稍候...';
    document.body.appendChild(loading);
    api.get(`/knowledge/files/content?source=${encodeURIComponent(source)}&category=${encodeURIComponent(category)}`)
        .then(res => {
        loading.remove();
        if (res && res.success) {
            openEditor(res.content);
        }
        else {
            alert('读取源文档失败');
        }
    })
        .catch(e => {
        loading.remove();
        alert('读取源文档失败: ' + e.message);
    });
    function openEditor(originalText) {
        const modal = document.createElement('div');
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100vw';
        modal.style.height = '100vh';
        modal.style.background = 'rgba(0,0,0,0.6)';
        modal.style.backdropFilter = 'blur(15px)';
        modal.style.display = 'flex';
        modal.style.justifyContent = 'center';
        modal.style.alignItems = 'center';
        modal.style.zIndex = '1999';
        modal.innerHTML = `
      <div style="width: 800px; max-width: 95%; background: var(--bg-card); border: 1px solid var(--border-light); border-radius: 16px; padding: 24px; display: flex; flex-direction: column; gap: 16px; box-shadow: 0 20px 40px rgba(0,0,0,0.3); box-sizing: border-box; animation: scaleUp 0.3s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;">
        <div>
          <h3 style="margin: 0 0 6px 0; font-size: 18px; color: var(--text-primary); display:flex; align-items:center; gap:6px;">
            <span>✏️</span> 编辑知识文档物理内容
          </h3>
          <p style="margin: 0; color: var(--text-secondary); font-size: 12px;">直接修改文档内容。保存后，系统将在后台自动删除旧的索引切片，并重新执行文档的父子切片与向量 Embedding 计算。</p>
        </div>

        <textarea id="editKnowledgeTextarea" style="width: 100%; height: 420px; padding: 12px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-input); color: var(--text-primary); font-family: monospace; font-size: 13px; line-height: 1.5; resize: none; outline: none; box-sizing: border-box;"></textarea>

        <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 10px;">
          <button id="cancelEditKnowledgeBtn" style="padding: 10px 20px; border-radius: 8px; border: 1px solid var(--border-color); background: transparent; color: var(--text-secondary); cursor: pointer; font-size: 13px;">取消</button>
          <button id="saveEditKnowledgeBtn" style="padding: 10px 20px; border-radius: 8px; border: none; background: var(--primary); color: #fff; cursor: pointer; font-size: 13px; font-weight: 600; box-shadow: 0 4px 12px rgba(0,122,255,0.2);">✔️ 保存修改</button>
        </div>
      </div>
    `;
        document.body.appendChild(modal);
        const textarea = modal.querySelector('#editKnowledgeTextarea');
        textarea.value = originalText;
        const cancelBtn = modal.querySelector('#cancelEditKnowledgeBtn');
        const saveBtn = modal.querySelector('#saveEditKnowledgeBtn');
        cancelBtn.addEventListener('click', () => {
            modal.remove();
        });
        saveBtn.addEventListener('click', async () => {
            saveBtn.disabled = true;
            saveBtn.innerText = '正在保存并重算向量...';
            try {
                await api.post('/knowledge/files/update', {
                    source,
                    category,
                    content: textarea.value
                });
                modal.remove();
                if (window.__toast)
                    window.__toast.success('文档已更新，后台重新提炼中！');
                else
                    alert('文档更新成功，后台已启动向量切分重算！');
                onSaved();
            }
            catch (e) {
                alert('保存文档修改失败: ' + e.message);
                saveBtn.disabled = false;
                saveBtn.innerText = '✔️ 保存修改';
            }
        });
    }
}
