// @ts-nocheck
/**
 * 模型大市场 (Model Marketplace) - 国内源极速拉取重构版
 * 采用全屏三级钻取视图交互：Provider -> Series -> Version
 */
import { api } from '../utils.js';
let marketData = [];
let currentProvider = null;
let currentSeries = null;
let hwInfo = null;
export async function render(container) {
    // 移除旧的分栏样式
    container.classList.remove('page-layout-split');
    container.style.padding = '0';
    // 主结构：容器使用绝对定位用于动画
    container.innerHTML = `
    <div class="market-view-container" id="marketViewContainer">
      <!-- Providers 视图 -->
      <div class="market-view view-active" id="viewProviders">
        <div class="market-header">
          <h2>模型市场 (本地拉取)</h2>
          <p>从高速国内节点拉取顶级开源模型，直接生成本地离线引擎。</p>
        </div>
        <div class="provider-grid" id="providerGrid">
          <div style="text-align: center; color: var(--text-muted); grid-column: 1 / -1; padding: 40px;">
            正在获取市场数据...
          </div>
        </div>
      </div>

      <!-- Series 视图 -->
      <div class="market-view view-hidden-right" id="viewSeries">
        <div class="breadcrumb">
          <span class="breadcrumb-item" id="bcBackToProviders">所有厂商</span>
          <span class="breadcrumb-separator">/</span>
          <span class="breadcrumb-current" id="bcProviderName">...</span>
        </div>
        <h2 style="font-size: 24px; margin-bottom: 24px;" id="seriesTitle">选择系列</h2>
        <div class="series-grid" id="seriesGrid"></div>
      </div>

      <!-- Versions 视图 -->
      <div class="market-view view-hidden-right" id="viewVersions">
        <div class="breadcrumb">
          <span class="breadcrumb-item" id="bcBackToProviders2">所有厂商</span>
          <span class="breadcrumb-separator">/</span>
          <span class="breadcrumb-item" id="bcBackToSeries"><span id="bcProviderName2">...</span></span>
          <span class="breadcrumb-separator">/</span>
          <span class="breadcrumb-current" id="bcSeriesName">...</span>
        </div>
        <h2 style="font-size: 24px; margin-bottom: 8px;" id="versionTitle">版本下载</h2>
        <p style="color: var(--text-secondary); margin-bottom: 24px;" id="versionDesc">...</p>
        
        <!-- 硬件状态 -->
        <div id="hardwareStatus" style="background: rgba(0,217,255,0.05); border: 1px solid rgba(0,217,255,0.1); padding: 12px 16px; border-radius: 12px; margin-bottom: 24px; display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-light);">
        </div>

        <div class="version-list" id="versionList"></div>
      </div>
    </div>
  `;
    // 绑定面包屑事件
    document.getElementById('bcBackToProviders').addEventListener('click', showProvidersView);
    document.getElementById('bcBackToProviders2').addEventListener('click', showProvidersView);
    document.getElementById('bcBackToSeries').addEventListener('click', () => {
        if (currentProvider)
            showSeriesView(currentProvider);
    });
    await loadMarketData();
}
async function loadMarketData() {
    try {
        const data = await api.model.getMarketplace();
        marketData = data.models || [];
        hwInfo = data.hardware;
        updateHardwareStatus();
        renderProviders();
    }
    catch (err) {
        console.error('Failed to load market data', err);
        window.__toast?.error('加载模型市场失败');
    }
}
function updateHardwareStatus() {
    if (!hwInfo)
        return;
    const el = document.getElementById('hardwareStatus');
    el.innerHTML = `
    <span>💻</span> 
    <span>${hwInfo.cpuModel}</span>
    <span style="opacity:0.3;">|</span>
    <b>RAM: ${hwInfo.freeRamGB.toFixed(1)} GB 可用 / 共 ${hwInfo.totalRamGB.toFixed(1)} GB</b>
  `;
}
// ================== 视图渲染 ==================
function renderProviders() {
    const grid = document.getElementById('providerGrid');
    grid.innerHTML = '';
    marketData.forEach(provider => {
        const card = document.createElement('div');
        card.className = 'provider-card';
        card.innerHTML = `
      <div class="provider-logo">${provider.logo}</div>
      <div class="provider-name">${provider.provider}</div>
      <div class="provider-desc">${provider.description}</div>
    `;
        card.addEventListener('click', () => {
            currentProvider = provider;
            showSeriesView(provider);
        });
        grid.appendChild(card);
    });
}
function renderSeries(provider) {
    const grid = document.getElementById('seriesGrid');
    grid.innerHTML = '';
    document.getElementById('bcProviderName').textContent = provider.provider;
    document.getElementById('bcProviderName2').textContent = provider.provider;
    provider.series.forEach(series => {
        const card = document.createElement('div');
        card.className = 'series-card';
        card.innerHTML = `
      <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px; color: var(--text-primary);">${series.name}</div>
      <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 16px;">${series.description}</div>
      <div style="font-size: 12px; color: var(--primary); background: rgba(108,99,255,0.1); display: inline-block; padding: 4px 8px; border-radius: 4px;">
        包含 ${series.versions.length} 个参数版本
      </div>
    `;
        card.addEventListener('click', () => {
            currentSeries = series;
            showVersionsView(series);
        });
        grid.appendChild(card);
    });
}
function renderVersions(series) {
    const list = document.getElementById('versionList');
    list.innerHTML = '';
    document.getElementById('bcSeriesName').textContent = series.name;
    document.getElementById('versionTitle').textContent = series.name;
    document.getElementById('versionDesc').textContent = series.description;
    series.versions.forEach(version => {
        const item = document.createElement('div');
        item.className = 'version-item';
        const comp = version.compatibility;
        const isOk = comp.level === 'success';
        const isWarn = comp.level === 'warning';
        const statusColor = isOk ? '#34c759' : (isWarn ? '#ff9500' : '#ff3b30');
        item.innerHTML = `
      <div style="flex: 1;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 6px;">
          <span style="font-size: 16px; font-weight: 600; color: var(--text-primary);">${version.name}</span>
          <span style="font-size: 12px; background: ${statusColor}20; color: ${statusColor}; padding: 2px 8px; border-radius: 4px; border: 1px solid ${statusColor}40;">
            ${comp.message}
          </span>
        </div>
        <div style="font-size: 12px; color: var(--text-secondary); display: flex; gap: 16px;">
          <span>📦 大小: ${version.sizeGB} GB</span>
          <span>🧠 预估占用内存: ${(version.paramsBillion * 0.7 + 1).toFixed(1)} GB</span>
        </div>
      </div>
      
      <div style="display: flex; flex-direction: column; align-items: flex-end; width: 300px;">
        <button class="btn btn-primary" id="btn-download-${version.id.replace(/:/g, '-')}" style="width: 140px; justify-content: center;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          下载安装
        </button>
        <div id="progress-container-${version.id.replace(/:/g, '-')}" style="width: 100%; margin-top: 12px; display: none;">
          <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px; color: var(--text-light);">
            <span id="progress-text-${version.id.replace(/:/g, '-')}">准备中...</span>
            <span id="progress-percent-${version.id.replace(/:/g, '-')}">0%</span>
          </div>
          <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">
            <div id="progress-bar-${version.id.replace(/:/g, '-')}" style="height: 100%; width: 0%; background: var(--primary); transition: width 0.3s ease;"></div>
          </div>
        </div>
      </div>
    `;
        list.appendChild(item);
        const btn = document.getElementById(`btn-download-${version.id.replace(/:/g, '-')}`);
        btn.addEventListener('click', () => {
            startDownload(version);
        });
    });
}
// ================== 下载逻辑 ==================
async function startDownload(version) {
    const safeId = version.id.replace(/:/g, '-');
    const btn = document.getElementById(`btn-download-${safeId}`);
    const progressContainer = document.getElementById(`progress-container-${safeId}`);
    btn.disabled = true;
    btn.style.display = 'none';
    progressContainer.style.display = 'block';
    setTimeout(() => {
        if (window.__toast)
            window.__toast.info("本地模型流式下载管线正在重构为 IPC，请使用外部工具下载。");
        btn.disabled = false;
        btn.style.display = 'inline-block';
        progressContainer.style.display = 'none';
    }, 500);
}
// ================== 视图切换动画 ==================
function showProvidersView() {
    document.getElementById('viewProviders').className = 'market-view view-active';
    document.getElementById('viewSeries').className = 'market-view view-hidden-right';
    document.getElementById('viewVersions').className = 'market-view view-hidden-right';
}
function showSeriesView(provider) {
    renderSeries(provider);
    document.getElementById('viewProviders').className = 'market-view view-hidden-left';
    document.getElementById('viewSeries').className = 'market-view view-active';
    document.getElementById('viewVersions').className = 'market-view view-hidden-right';
}
function showVersionsView(series) {
    renderVersions(series);
    document.getElementById('viewProviders').className = 'market-view view-hidden-left';
    document.getElementById('viewSeries').className = 'market-view view-hidden-left';
    document.getElementById('viewVersions').className = 'market-view view-active';
}
