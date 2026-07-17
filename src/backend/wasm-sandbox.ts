import path from 'path';
import fs from 'fs';

export interface ExecuteResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  success: boolean;
}

export class WasmSandboxExecutor {
  /**
   * 在内嵌 WASM 虚拟机中安全地执行 JS 代码
   * @param code - 待运行的 JavaScript 代码
   * @param workspaceDir - 当前受保护的 Workspace 根目录（可选，默认使用 process.cwd()）
   * @param timeoutMs - 虚拟机运行最大时长（默认 5000ms）
   */
  public async executeSafe(
    code: string,
    workspaceDir: string = process.cwd(),
    timeoutMs: number = 5000
  ): Promise<ExecuteResult> {
    let stdoutLogs: string[] = [];
    let stderr = '';
    let success = false;
    let exitCode = 0;

    // 动态载入单文件内嵌版 WASM 变体，防范 Electron 生产 ASAR 打包物理寻址丢失问题
    // @ts-ignore
    const { newQuickJSWASMModuleFromVariant } = await import('quickjs-emscripten-core');
    // @ts-ignore
    const variantModule = await import('@jitl/quickjs-singlefile-cjs-release-sync');
    const releaseVariant = (variantModule as any).default || variantModule;
    const qjs = await newQuickJSWASMModuleFromVariant(releaseVariant);
    const vm = qjs.newContext();

    try {
      // 1. 注入安全的 console.log 拦截器捕获输出
      const logHandle = vm.newFunction('log', (...args) => {
        const nativeArgs = args.map(arg => {
          try {
            return vm.dump(arg);
          } catch {
            return '[无法转义的复杂对象]';
          }
        });
        stdoutLogs.push(nativeArgs.map(x => (typeof x === 'object' ? JSON.stringify(x) : String(x))).join(' '));
      });
      const consoleObj = vm.newObject();
      vm.setProp(consoleObj, 'log', logHandle);
      vm.setProp(vm.global, 'console', consoleObj);
      logHandle.dispose();
      consoleObj.dispose();

      // 2. 注入安全的只读文件访问 API: openClaw.readFile(filePath)
      const readFileHandle = vm.newFunction('readFile', (filePathHandle) => {
        let filePath = '';
        try {
          filePath = vm.getString(filePathHandle);
        } catch {
          return vm.newString('Error: 无效的文件路径参数格式');
        }

        if (!filePath) {
          return vm.newString('Error: 文件路径不能为空');
        }

        try {
          // 统一斜杠并计算规范化后的绝对物理路径
          const resolvedPath = path.resolve(workspaceDir, filePath);
          const normalizedPath = resolvedPath.toLowerCase();

          // 同样规范化工作区路径，防止 Windows 下正反斜杠不匹配造成拦截误判
          const resolvedWorkspace = path.resolve(workspaceDir);
          const normalizedWorkspace = resolvedWorkspace.toLowerCase();

          // 核心安全策略拦截：仅限读取 Workspace 子目录文件或 temp_attachments 临时目录下的内容
          const isTempAttachment = normalizedPath.includes('temp_attachments');
          const isInWorkspace = normalizedPath.startsWith(normalizedWorkspace);

          if (!isTempAttachment && !isInWorkspace) {
            return vm.newString('Error: 越界读取！沙盒内仅被授权读取文本附件与工作区子目录。');
          }

          if (fs.existsSync(resolvedPath)) {
            // 只读取前 10MB 的文本防止读爆内存
            const stats = fs.statSync(resolvedPath);
            if (stats.size > 10 * 1024 * 1024) {
              return vm.newString('Error: 文件过大，禁止在沙盒中读取超过 10MB 的大文件');
            }
            const fileContent = fs.readFileSync(resolvedPath, 'utf8');
            return vm.newString(fileContent);
          } else {
            return vm.newString(`Error: 文件不存在: ${filePath}`);
          }
        } catch (e: any) {
          return vm.newString(`Error: 读取物理文件异常: ${e.message}`);
        }
      });

      const openClawObj = vm.newObject();
      vm.setProp(openClawObj, 'readFile', readFileHandle);
      vm.setProp(vm.global, 'openClaw', openClawObj);
      readFileHandle.dispose();
      openClawObj.dispose();

      // 3. 注入运行时间限制保护，防范死循环
      const startTime = Date.now();
      vm.runtime.setInterruptHandler(() => {
        if (Date.now() - startTime > timeoutMs) {
          return true; // 触发强行切断中断
        }
        return false;
      });

      // 4. 执行 JS 代码
      const result = vm.evalCode(code);
      if (result.error) {
        let errorObj: any = {};
        try {
          errorObj = vm.dump(result.error);
        } catch {
          errorObj = { message: 'WASM 沙箱执行遇到未知运行时异常' };
        }
        result.error.dispose();
        stderr = `[VM 语法/运行错误]: ${errorObj.message || '未知错误'}`;
        if (errorObj.stack) {
          stderr += `\n${errorObj.stack}`;
        }
        exitCode = 1;
      } else {
        (result as any).value.dispose();
        success = true;
      }
    } catch (e: any) {
      stderr = `[沙箱初始化/底层报错]: ${e.message}`;
      exitCode = 1;
    } finally {
      // 5. 销毁虚拟机，彻底清空内存防爆
      vm.dispose();
    }

    return {
      stdout: `[🤖 内嵌 WASM QuickJS 沙盒]\n` + stdoutLogs.join('\n'),
      stderr,
      exitCode,
      success
    };
  }
}
