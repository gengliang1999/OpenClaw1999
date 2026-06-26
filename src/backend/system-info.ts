// @ts-nocheck
/**
 * OpenClaw 智能助手 - 硬件系统检测
 * 用于评估模型市场的本地硬件兼容性
 */

const os = require('os');
const child_process = require('child_process');
const util = require('util');
const execFile = util.promisify(child_process.execFile);

class SystemInfo {
  constructor() {
    this.totalRamGB = os.totalmem() / (1024 ** 3);
    this.platform = os.platform();
    this.arch = os.arch();
    this.cpus = os.cpus();
    this.gpuInfo = null;
  }

  get freeRamGB() {
    return os.freemem() / (1024 ** 3);
  }

  async getHardwareInfo() {
    // 异步获取额外的硬件信息（如 GPU）
    if (!this.gpuInfo) {
      this.gpuInfo = await this._detectGPU();
    }
    
    return {
      totalRamGB: parseFloat(this.totalRamGB.toFixed(1)),
      freeRamGB: parseFloat(this.freeRamGB.toFixed(1)),
      platform: this.platform,
      arch: this.arch,
      cpuCoreCount: this.cpus.length,
      cpuModel: this.cpus[0]?.model || 'Unknown',
      gpu: this.gpuInfo,
    };
  }

  async _detectGPU() {
    try {
      const execOpts = { timeout: 2000 }; // 2秒超时，防止wmic卡死
      if (this.platform === 'win32') {
        const { stdout } = await execFile('wmic', ['path', 'win32_VideoController', 'get', 'name'], execOpts);
        const gpus = stdout.split('\n')
          .map(l => l.trim())
          .filter(l => l && l !== 'Name');
        return gpus.length > 0 ? gpus.join(', ') : 'Unknown Windows GPU';
      } else if (this.platform === 'darwin') {
        const { stdout } = await execFile('system_profiler', ['SPDisplaysDataType'], execOpts);
        const match = stdout.match(/Chipset Model:\s*(.*)/);
        return match ? match[1] : 'Unknown Mac GPU';
      } else {
        const { stdout } = await execFile('lspci', [], execOpts);
        const match = stdout.match(/VGA compatible controller:\s*(.*)/);
        return match ? match[1] : 'Unknown Linux GPU';
      }
    } catch (e) {
      console.warn('[SystemInfo] GPU detect failed:', e.message);
      return 'Unknown GPU';
    }
  }

  /**
   * 评估指定模型大小（参数量，单位 B，例如 7B 就是 7）所需的硬件资源并返回兼容性状态
   * @param {number} paramsBillion 模型参数量 B (Billion)
   */
  evaluateCompatibility(paramsBillion) {
    // 粗略估算：量化后 1B 参数大约需要 0.7GB 内存
    const requiredRamGB = paramsBillion * 0.7 + 1.5; // 基础操作系统预留 1.5GB
    
    let isCompatible = true;
    let message = '硬件资源充足，推荐使用';
    let level = 'success';

    if (this.totalRamGB < requiredRamGB) {
      isCompatible = false;
      message = `系统内存不足 (需 ${requiredRamGB.toFixed(1)} GB，当前仅 ${this.totalRamGB.toFixed(1)} GB)，可能无法运行。`;
      level = 'danger';
    } else if (this.freeRamGB < requiredRamGB * 0.8) {
      // 可用内存较少，但总内存够
      message = `空闲内存较低，运行可能会导致系统卡顿，建议关闭其他程序。`;
      level = 'warning';
    }

    return {
      requiredRamGB: parseFloat(requiredRamGB.toFixed(1)),
      isCompatible,
      message,
      level, // success | warning | danger
    };
  }
}

module.exports = new SystemInfo();
