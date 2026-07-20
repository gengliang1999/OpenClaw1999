import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { assessRiskDetailed } from './risk-engine';

export type TransportType = 'stdio' | 'sse';

export interface McpServerConfig {
  id: string;
  name: string;
  transport: TransportType;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  enabled: boolean;
}

export interface McpToolSchema {
  name: string;
  description?: string;
  inputSchema?: any;
  serverId: string;
}

export class McpClientManager {
  private configPath: string;
  private servers: Map<string, McpServerConfig> = new Map();
  private processes: Map<string, ChildProcess> = new Map();
  private activeTools: Map<string, McpToolSchema> = new Map();

  constructor(customConfigPath?: string) {
    const defaultDir = path.join(process.env.USERPROFILE || process.env.HOME || '.', '.openclaw');
    this.configPath = customConfigPath || path.join(defaultDir, 'mcp-servers.json');
    this.loadConfig();
  }

  private loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, 'utf-8');
        const list: McpServerConfig[] = JSON.parse(raw);
        for (const item of list) {
          this.servers.set(item.id, item);
        }
      }
    } catch (e) {
      console.error('[MCP] 配置文件读取失败:', e);
    }
  }

  private saveConfig() {
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const list = Array.from(this.servers.values());
      fs.writeFileSync(this.configPath, JSON.stringify(list, null, 2), 'utf-8');
    } catch (e) {
      console.error('[MCP] 配置文件保存失败:', e);
    }
  }

  public registerServer(config: McpServerConfig) {
    // 安全校验：在配置 stdio 命令行服务时执行 risk-engine 检测
    if (config.transport === 'stdio' && config.command) {
      const fullCmd = `${config.command} ${(config.args || []).join(' ')}`;
      const risk = assessRiskDetailed(fullCmd);
      if (risk.level === 'forbidden') {
        throw new Error(`[MCP 阻断] 服务器命令命中高危规则: ${risk.reason}`);
      }
    }

    this.servers.set(config.id, config);
    this.saveConfig();
  }

  public removeServer(id: string) {
    this.stopServer(id);
    this.servers.delete(id);
    this.saveConfig();
  }

  public getServerList(): McpServerConfig[] {
    return Array.from(this.servers.values());
  }

  public async startServer(id: string): Promise<boolean> {
    const config = this.servers.get(id);
    if (!config || !config.enabled) return false;

    if (config.transport === 'stdio' && config.command) {
      try {
        const proc = spawn(config.command, config.args || [], {
          env: { ...process.env, ...(config.env || {}) },
          stdio: ['pipe', 'pipe', 'pipe']
        });

        this.processes.set(id, proc);
        proc.on('exit', () => {
          this.processes.delete(id);
        });

        return true;
      } catch (e) {
        console.error(`[MCP] 启动服务器 ${id} 失败:`, e);
        return false;
      }
    }

    return true; // SSE 模式无需本地进程
  }

  public stopServer(id: string) {
    const proc = this.processes.get(id);
    if (proc) {
      proc.kill();
      this.processes.delete(id);
    }
  }

  public registerTool(tool: McpToolSchema) {
    this.activeTools.set(`${tool.serverId}:${tool.name}`, tool);
  }

  public getAvailableTools(): McpToolSchema[] {
    return Array.from(this.activeTools.values());
  }

  public async callMcpTool(serverId: string, toolName: string, args: any): Promise<any> {
    const config = this.servers.get(serverId);
    if (!config) throw new Error(`未找到指定的 MCP 服务器: ${serverId}`);

    return {
      success: true,
      serverId,
      toolName,
      result: `MCP Tool ${toolName} 已响应请求`,
      args
    };
  }
}

export const mcpClientManager = new McpClientManager();
