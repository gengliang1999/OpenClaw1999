"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const path = __importStar(require("path"));
const agent_loop_1 = require("./agent-loop");
const evolution_engine_1 = require("./evolution-engine");
// Mock ModelManager for testing
class MockModelManager {
    async chatStream(messages, options, onChunk) {
        onChunk(`正在思考...`);
        let full = '';
        if (messages.length === 1) {
            full = `<execute>echo "Hello Jarvis E2E Test"</execute>`;
        }
        else {
            full = `任务已完成，结果已观察到。`;
        }
        onChunk(full);
        return full;
    }
}
// Mock Sandbox
class MockSandbox {
    async execute(cmd, options) {
        if (cmd.includes('echo')) {
            return { stdout: 'Hello Jarvis E2E Test', needsConfirmation: false };
        }
        return { needsConfirmation: true, riskLevel: 'HIGH', message: 'Blocked high risk command' };
    }
}
async function runE2ETest() {
    console.log('--- 开始 E2E 测试: Agent Loop ---');
    const baseDataDir = path.join(__dirname, '..', '..', '.test_data');
    const modelManager = new MockModelManager();
    const sandbox = new MockSandbox();
    const memoryStore = { saveMessage: () => { }, addMemory: () => { } };
    const evolutionEngine = new evolution_engine_1.EvolutionEngine(baseDataDir, memoryStore, modelManager);
    const agentLoop = new agent_loop_1.AgentLoop({
        modelManager,
        sandbox,
        memoryStore,
        evolutionEngine,
        onChunk: (chunk) => {
            console.log('[Chunk]', chunk.trim());
        },
        onRequiresConfirmation: (cmd, risk, msg) => {
            console.log('[Security Block]', cmd, risk, msg);
        }
    });
    const context = {
        convId: 'test_conv_1',
        messages: [{ role: 'user', content: '测试执行一个安全命令' }],
        modelId: 'test_model',
        temperature: 0.1,
        signal: new AbortController().signal
    };
    const context2 = {
        convId: 'test_conv_2',
        messages: [{ role: 'user', content: '测试执行一个必定失败的错误命令' }],
        modelId: 'test_model',
        temperature: 0.1,
        signal: new AbortController().signal
    };
    class MockErrorSandbox {
        async execute(cmd, options) {
            throw new Error('模拟的极度严重系统内核报错 (Permission Denied)');
        }
    }
    class MockErrorEvolutionEngine {
        async evolve(errorCtx, taskGoal) {
            return `> 🧬 **[系统进化完成]** 测试: 我已学习如何处理 "${taskGoal}" 的失败: "${errorCtx}"，固化技能成功。`;
        }
    }
    const agentLoopError = new agent_loop_1.AgentLoop({
        modelManager: new MockModelManager(),
        sandbox: new MockErrorSandbox(),
        memoryStore,
        evolutionEngine: new MockErrorEvolutionEngine(),
        onChunk: (chunk) => console.log('[Chunk]', chunk.trim()),
        onRequiresConfirmation: () => { }
    });
    console.log('\n--- 开始 E2E 测试: Evolution Engine (自进化) ---');
    const finalReplyError = await agentLoopError.run(context2);
    console.log('\n--- 最终回复 (自进化流) ---');
    console.log(finalReplyError);
    console.log('--- 测试完成 ---');
}
runE2ETest().catch(console.error);
