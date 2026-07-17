import { _electron as electron } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

describe('OpenClaw E2E 功能测试与视觉走查', () => {
  let electronApp: any;
  let window: any;
  const screenshotDir = path.join(__dirname, 'screenshots');
  // 每次运行都使用完全随机、绝对隔离的用户数据文件夹，彻底杜绝僵尸进程带来的 Lock file 占有锁冲突
  const userDataDir = path.join(__dirname, 'test-user-data-' + Math.random().toString(36).substring(7));

  beforeAll(async () => {
    // 确保截图保存目录存在
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }

    // 编译后的主进程 js 入口
    const mainPath = path.join(__dirname, '../../dist/main/main.js');

    // 启动 Electron 进程，使用独立的临时 user-data-dir 隔离运行实例，避免 Lock file 冲突
    electronApp = await electron.launch({
      args: [
        mainPath,
        `--user-data-dir=${userDataDir}`
      ]
    });

    // 监听重定向主进程的标准输出及错误输出，使测试环境崩溃可见
    electronApp.process().stdout.on('data', (data: any) => {
      console.log('[E2E-主进程-STDOUT]:', data.toString());
    });
    electronApp.process().stderr.on('data', (data: any) => {
      console.error('[E2E-主进程-STDERR]:', data.toString());
    });

    // 延时等待窗口载入并抓取主窗口（过滤掉可能先启动的透明悬浮球或截图挂载窗口）
    await new Promise((resolve) => setTimeout(resolve, 8000));
    const windows = electronApp.windows();
    for (const w of windows) {
      const title = await w.title();
      if (title.includes('OpenClaw')) {
        window = w;
        break;
      }
    }

    if (!window) {
      window = await electronApp.firstWindow();
    }
    await window.waitForLoadState('domcontentloaded');
  }, 45000); // 45 秒启动超时

  afterAll(async () => {
    if (electronApp) {
      await electronApp.close();
    }
    // 测试完毕后清理临时数据目录以保持工作区干净
    try {
      if (fs.existsSync(userDataDir)) {
        fs.rmSync(userDataDir, { recursive: true, force: true });
      }
    } catch (e) {}
  });

  test('1. 验证主窗口启动及核心导航渲染', async () => {
    // 验证窗口标题是否正确
    const title = await window.title();
    expect(title).toBe('OpenClaw 智能助手');

    // 验证侧边栏存在核心导航节点
    const sidebarLogo = window.locator('#sidebarLogo');
    await sidebarLogo.waitFor({ state: 'visible', timeout: 5000 });
    expect(await sidebarLogo.isVisible()).toBe(true);

    // 对主界面抓取屏幕快照进行静默视觉走查
    await window.screenshot({ path: path.join(screenshotDir, 'main-dashboard.png') });
  }, 20000); // 20 秒用例超时限制

  test('2. 验证长期记忆页面载入与数据读写检索', async () => {
    // 切换路由至长期记忆管理页面
    await window.evaluate(() => {
      window.location.hash = '#/memory';
    });

    // 等待记忆管理页面的搜索输入框渲染就绪（使用 Playwright 隐式自适应状态等待代替写死等待）
    const searchInput = window.locator('#searchMemoryInput');
    await searchInput.waitFor({ state: 'visible', timeout: 15000 });
    expect(await searchInput.isVisible()).toBe(true);

    // 在页面载入后对长期记忆页进行截图视觉走查
    await window.screenshot({ path: path.join(screenshotDir, 'memory-page-loaded.png') });

    // 验证长期记忆数据库操作：在前端 evaluate 直接向 IPC 接口发送测试请求创建测试数据
    // 1. 清空旧数据以防止干扰测试（测试沙盒隔离原则）
    await window.evaluate(async () => {
      return await window.openClaw.apiCall('/memory/clear-all', { method: 'POST' });
    });

    // 2. 通过 IPC 写入两条干净的测试记忆（使用正确的路由 /memory 极其字段）
    await window.evaluate(async () => {
      return await window.openClaw.apiCall('/memory', {
        method: 'POST',
        body: { content: '系统测试数据：Jarvis 今天需要去采购新的服务器硬件', category: 'User Node', tags: ['Manual Override'] }
      });
    });

    await window.evaluate(async () => {
      return await window.openClaw.apiCall('/memory', {
        method: 'POST',
        body: { content: '系统测试数据：星期五计划下午三点与团队进行周会', category: 'User Node', tags: ['Manual Override'] }
      });
    });

    // 3. 重新加载该路由页面以重新渲染列表
    await window.evaluate(() => {
      window.location.hash = '#/settings'; // 切换出去
    });
    await window.evaluate(() => {
      window.location.hash = '#/memory'; // 重新切回
    });

    // 等待列表元素渲染
    const memoryList = window.locator('#memoryList');
    await memoryList.waitFor({ state: 'visible', timeout: 10000 });
    expect(await memoryList.isVisible()).toBe(true);

    // 自适应轮询等待数据从 SQLite 加载并完成 DOM 渲染，解决异步加载时延闪烁造成的误断言
    let contentText = '';
    const maxRetries = 15;
    for (let i = 0; i < maxRetries; i++) {
      contentText = await memoryList.textContent();
      if (contentText.includes('采购新的服务器硬件')) {
        break;
      }
      await window.waitForTimeout(500);
    }

    // 检索页面元素，验证我们刚刚写入的数据是否呈现在列表卡片中
    expect(contentText).toContain('采购新的服务器硬件');
    expect(contentText).toContain('周会');

    // 4. 测试“搜索记忆”输入检索功能
    await searchInput.fill('采购');
    
    // 自适应轮询等待 debounce 触发后列表刷新过滤（排除 loading 状态，等待真实数据呈现）
    for (let i = 0; i < maxRetries; i++) {
      contentText = await memoryList.textContent();
      if (!contentText.includes('周会') && !contentText.includes('突触链接中...')) {
        break;
      }
      await window.waitForTimeout(200);
    }
    
    expect(contentText).toContain('采购新的服务器硬件');
    expect(contentText).not.toContain('周会');

    // 对搜索过滤后的结果截屏存盘
    await window.screenshot({ path: path.join(screenshotDir, 'memory-search-filtered.png') });
  }, 30000); // 30 秒用例超时限制

  test('3. 验证编辑记忆卡片功能', async () => {
    // 重新切回全部列表
    const searchInput = window.locator('#searchMemoryInput');
    await searchInput.fill('');
    await window.waitForTimeout(1000);

    const memoryList = window.locator('#memoryList');
    
    // 点击第一个编辑按钮（✏️）
    const editBtn = window.locator('.edit-btn').first();
    await editBtn.waitFor({ state: 'visible', timeout: 5000 });
    await editBtn.click();

    // 等待 asyncPrompt 输入弹窗展示
    const promptInput = window.locator('textarea').last();
    await promptInput.waitFor({ state: 'visible', timeout: 5000 });
    
    // 填充修改后的内容
    await promptInput.fill('系统测试数据：Jarvis 今天需要去采购新的服务器硬件（修改版）');

    // 点击确定按钮
    const confirmBtn = window.locator('button', { hasText: '确认' });
    await confirmBtn.click();

    // 自适应轮询等待页面刷新并检查列表内容是否修改成功
    let updatedText = '';
    const maxRetries = 15;
    for (let i = 0; i < maxRetries; i++) {
      updatedText = await memoryList.textContent();
      if (updatedText.includes('（修改版）')) {
        break;
      }
      await window.waitForTimeout(500);
    }

    expect(updatedText).toContain('（修改版）');
    await window.screenshot({ path: path.join(screenshotDir, 'memory-edited.png') });
  }, 20000); // 20 秒用例超时限制
});
