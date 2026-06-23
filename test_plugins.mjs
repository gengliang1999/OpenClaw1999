/**
 * MCP 连接与自动化沙盒中心 (MCP & Automation Center)
 * 功能：管理 AI 工具的接入（本地文件系统、终端沙盒、GitHub、Web Search 等）。
 * 结合 Cursor 的沙盒白名单模式，实现安全的外部交互。
 */

import { openModal, confirmModal } from '../components/modal.js';
import sandboxConfirm from '../components/sandbox-confirm.js';

// MCP 服务数据
let MCP_SERVERS = [
  {
    id: 'mcp-fs',
    name: '本地文件系统 (Local FS)',
    icon: '📁',
    description: '允许 AI 读取、修改和创建本地文件系统中的文件。所有操作受全局安全沙盒的读写范围保护。',
    status: 'online',
    installed: true,
    type: 'core',
    configFields: [
      { key: 'workspace', label: '默认工作区路径', type: 'text', placeholder: 'C:\\Users\\...' },
      { key: 'allowHidden', label: '允许读取隐藏文件', type: 'switch', value: false },
    ],
  },
  {
    id: 'mcp-terminal',
    name: '安全终端沙盒 (Terminal)',
    icon: '💻',
    description: '允许 AI 在受控环境中执行命令（如 npm, git）。危险指令（如 rm -rf, 敏感网络请求）将触发二次确认。',
    status: 'online',
    installed: true,
    type: 'core',
    configFields: [
      { key: 'autoConfirm', label: '跳过低风险命令确认', type: 'switch', value: true },
      { key: 'shellPath', label: '自定义 Shell 路径', type: 'text', placeholder: '/bin/bash 或 powershell.exe' },
    ],
  },
  {
    id: 'mcp-github',
    name: 'GitHub MCP',
    icon: '🐙',
    description: '官方 MCP 协议接入，使 AI 能读取您的代码仓库、自动提交 PR、Review 代码及管理 Issues。',
    status: 'not-installed',
    installed: false,
    type: 'external',
    configFields: [
      { key: 'ghToken', label: 'GitHub Personal Token', type: 'password', placeholder: 'ghp_...' },
      { key: 'autoMerge', label: '允许自动合并低风险 PR', type: 'switch', value: false },
    ],
  },
  {
    id: 'mcp-web',
    name: '实时联网搜索 (Web)',
    icon: '🌐',
    description: '基于 DuckDuckGo 和 Google 搜索 API 的实时联网能力，允许模型获取最新外部知识。',
    status: 'offline',
    installed: true,
    type: 'external',
    configFields: [
      { key: 'searchEngine', label: '默认搜索引擎', type: 'text', placeholder: 'google' },
      { key: 'apiKey', label: 'API Key (如使用 Google)', type: 'password', placeholder: 'AIza...' },
    ],
  },
  {
    id: 'mcp-db',
    name: '数据库交互 (SQL MCP)',
    icon: 's🗄️',
    description: '直连 MySQL / PostgreSQL 数据库，允许模型自动分析表结构、生成并执行 SQL 查询进行数据洞察。',
    status: 'not-installed',
    installed: false,
    type: 'external',
    configFields: [
      { key: 'connString', label: '数据库连接字符串', type: 'password', placeholder: 'postgresql://user:pass@localhost/db' },
      { key: 'readonly', label: '只读模式 (禁止 UPDATE/DELETE)', type: 'switch', value: true },
    ],
  }
];

const STATUS_LABELS = {
  'online': '运行中',
  'offline': '已停用',
  'not-installed': '未接入',
};

const STATUS_CLASSES = {
  'online': 'online',
  'offline': 'offline',
  'not-installed': 'not-installed',
};

export function render(container) {
  container.innerHTML = `
    <div class="page-layout" style="flex-direction: column; padding: 0; background: var(--bg-body); overflow: hidden; height: 100%;">
      
      <!-- 顶部 Banner -->
      <div style="background: var(--bg-card); border-bottom: 1px solid var(--border-light); padding: 40px 48px; position: relative; overflow: hidden; flex-shrink: 0;">
        <div style="position: absolute; right: 0; top: 0; width: 300px; height: 100%; background: linear-gradient(90deg, rgba(108,99,255,0) 0%, rgba(108,99,255,0.1) 100%);"></div>
        <div style="position: relative; z-index: 1;">
          <h2 style="font-size: 28px; font-weight: 700; margin: 0 0 12px 0; display: flex; align-items: center; gap: 12px;">
            <span>🔌</span> MCP 连接与自动化沙盒
          </h2>
          <p style="margin: 0 0 20px 0; font-size: 15px; color: var(--text-light); max-width: 600px; line-height: 1.6;">
            通过 <strong>Model Context Protocol (MCP)</strong> 为 AI 赋予感知外部世界和自动执行任务的能力。为了保障您的设备安全，我们采用了严格的沙盒白名单模式，一切危险指令都需要您的二次授权。
          </p>
          <div style="display: flex; gap: 12px;">
            <button class="btn btn-primary" id="btnTestSandbox" style="border-radius: 20px;">
              🛡️ 模拟高危指令拦截测试
            </button>
            <button class="btn btn-default" style="border-radius: 20px;" onclick="window.location.hash='#/settings'">
              ⚙️ 管理沙盒白名单
            </button>
          </div>
        </div>
      </div>

      <!-- 内容区 -->
      <div style="flex: 1; overflow-y: auto; padding: 40px 48px;">
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
          <h3 style="font-size: 18px; margin: 0;">已配置的 MCP 服务器</h3>
          <div style="display: flex; gap: 8px;">
            <input type="text" class="input" id="mcpSearch" placeholder="搜索组件..." style="width: 200px; border-radius: 20px; background: var(--bg-card);" />
          </div>
        </div>

        <!-- 核心内置能力 -->
        <div style="margin-bottom: 40px;">
          <div style="font-size: 13px; font-weight: 600; color: var(--text-muted); margin-bottom: 16px; text-transform: uppercase; letter-spacing: 1px;">核心系统级能力</div>
          <div class="market-grid" id="mcpCoreGrid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 20px;"></div>
        </div>

        <!-- 外部扩展能力 -->
        <div>
          <div style="font-size: 13px; font-weight: 600; color: var(--text-muted); margin-bottom: 16px; text-transform: uppercase; letter-spacing: 1px;">外部 MCP 扩展</div>
          <div class="market-grid" id="mcpExternalGrid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 20px;"></div>
        </div>
        
      </div>
    </div>
  `;
}

export function init(container) {
  renderMcpGrids();

  // 绑定搜索
  document.getElementById('mcpSearch').addEventListener('input', (e) => {
    renderMcpGrids(e.target.value.toLowerCase());
  });

  // 绑定沙盒测试按钮
  document.getElementById('btnTestSandbox').addEventListener('click', async () => {
    const result = await sandboxConfirm.showSandboxConfirm({
      command: 'rm -rf /*',
      riskLevel: 'high',
      description: '尝试删除系统根目录下所有文件'
    });
    
    if (result === 'allow_once') {
      window.__toast?.success('已允许执行一次');
    } else if (result === 'allow_always') {
      window.__toast?.success('已添加到白名单并允许执行');
    } else {
      window.__toast?.error('操作被拒绝');
    }
  });
}

function renderMcpGrids(searchQuery = '') {
  let list = [...MCP_SERVERS];
  if (searchQuery) {
    list = list.filter(p => p.name.toLowerCase().includes(searchQuery) || p.description.toLowerCase().includes(searchQuery));
  }

  const coreList = list.filter(p => p.type === 'core');
  const externalList = list.filter(p => p.type === 'external');

  document.getElementById('mcpCoreGrid').innerHTML = coreList.map(renderMcpCard).join('');
  document.getElementById('mcpExternalGrid').innerHTML = externalList.map(renderMcpCard).join('');

  bindCardEvents();
}

function renderMcpCard(mcp) {
  const statusClass = STATUS_CLASSES[mcp.status] || 'not-installed';
  const statusLabel = STATUS_LABELS[mcp.status] || '未知';

  return `
    <div class="plugin-card" data-id="${mcp.id}" style="background: var(--bg-card); border: 1px solid var(--border-light); border-radius: 16px; padding: 24px; display: flex; flex-direction: column; cursor: pointer; transition: all 0.2s; position: relative;">
      
      ${mcp.type === 'core' ? '<div style="position: absolute; top: 16px; right: 16px; background: rgba(0,217,255,0.1); color: var(--secondary); font-size: 10px; padding: 2px 6px; border-radius: 6px; border: 1px solid rgba(0,217,255,0.2);">核心内置</div>' : ''}
      
      <div style="display: flex; gap: 16px; align-items: flex-start; margin-bottom: 16px;">
        <div style="width: 56px; height: 56px; background: rgba(255,255,255,0.05); border-radius: 14px; display: flex; justify-content: center; align-items: center; font-size: 28px;">
          ${mcp.icon}
        </div>
        <div>
          <h3 style="margin: 0 0 6px 0; font-size: 16px; font-weight: 600;">${mcp.name}</h3>
          <div style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-light);">
            <span class="status-dot ${statusClass}"></span> ${statusLabel}
          </div>
        </div>
      </div>
      
      <p style="margin: 0 0 20px 0; font-size: 13px; color: var(--text-light); line-height: 1.5; flex: 1;">
        ${mcp.description}
      </p>
      
      <div style="display: flex; gap: 8px;">
        ${mcp.installed 
          ? '<button class="btn btn-sm btn-ghost mcp-config-btn" data-id="' + mcp.id + '" style="flex: 1; border: 1px solid var(--border-light);">⚙️ 配置参数</button>' +
            (mcp.type === 'external' ? '<button class="btn btn-sm btn-ghost mcp-uninstall-btn" data-id="' + mcp.id + '" style="color: #ff3b30; border: 1px solid var(--border-light);">断开</button>' : '')
          : '<button class="btn btn-sm btn-primary mcp-install-btn" data-id="' + mcp.id + '" style="flex: 1;">➕ 接入服务</button>'
        }
      </div>
    </div>
  `;
}

function bindCardEvents() {
  document.querySelectorAll('.mcp-config-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const mcp = MCP_SERVERS.find(p => p.id === btn.dataset.id);
      if (mcp) showMcpConfig(mcp);
    });
  });

  document.querySelectorAll('.mcp-install-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleMcpInstall(btn.dataset.id);
    });
  });

  document.querySelectorAll('.mcp-uninstall-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const mcp = MCP_SERVERS.find(p => p.id === btn.dataset.id);
      if (!mcp) return;
      const confirmed = await confirmModal('断开连接', `确定要断开与「${mcp.name}」的连接吗？`);
      if (confirmed) {
        mcp.installed = false;
        mcp.status = 'not-installed';
        window.__toast?.success('已断开连接');
        renderMcpGrids();
      }
    });
  });
}

function handleMcpInstall(id) {
  const mcp = MCP_SERVERS.find(p => p.id === id);
  if (!mcp) return;
  mcp.installed = true;
  mcp.status = 'offline';
  window.__toast?.success(`已添加 ${mcp.name}，请完善配置以启动服务`);
  renderMcpGrids();
  setTimeout(() => showMcpConfig(mcp), 500);
}

function showMcpConfig(mcp) {
  const formContent = document.createElement('div');
  formContent.innerHTML = `
    <p style="color: var(--text-light); margin-bottom: 24px; font-size: 13px;">
      配置「${mcp.icon} ${mcp.name}」的连接参数和运行权限。
    </p>
    ${mcp.configFields.map(field => {
      if (field.type === 'switch') {
        return `
          <div class="form-row" style="padding: 12px 0;">
            <div class="form-row-label">
              <span style="font-weight: 500;">${field.label}</span>
            </div>
            <label class="switch">
              <input type="checkbox" ${field.value ? 'checked' : ''} />
              <span class="switch-slider"></span>
            </label>
          </div>
        `;
      }
      return `
        <div class="form-group" style="margin-bottom: 16px;">
          <label class="form-label" style="font-weight: 500;">${field.label}</label>
          <input type="${field.type || 'text'}" class="input" placeholder="${field.placeholder || ''}" />
        </div>
      `;
    }).join('')}
    
    <div style="margin-top: 24px; padding-top: 16px; border-top: 1px dashed var(--border-light);">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-weight: 500; margin-bottom: 4px;">服务状态</div>
          <div style="font-size: 12px; color: var(--text-muted);">当前状态：<span class="${STATUS_CLASSES[mcp.status]}">${STATUS_LABELS[mcp.status]}</span></div>
        </div>
        <button class="btn btn-sm ${mcp.status === 'online' ? 'btn-ghost' : 'btn-success'}" id="toggleStatusBtn">
          ${mcp.status === 'online' ? '⏸️ 停止服务' : '▶️ 启动服务'}
        </button>
      </div>
    </div>
  `;

  const modal = openModal({
    title: `⚙️ ${mcp.name} 配置`,
    content: formContent,
    confirmText: '保存配置',
    size: 'medium',
    onConfirm: () => {
      window.__toast?.success('配置已更新');
    },
  });

  setTimeout(() => {
    const toggleBtn = document.getElementById('toggleStatusBtn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        if (mcp.status === 'online') {
          mcp.status = 'offline';
          window.__toast?.info('服务已停止');
        } else {
          mcp.status = 'online';
          window.__toast?.success('服务已启动');
        }
        modal.close();
        renderMcpGrids();
      });
    }
  }, 100);
}
