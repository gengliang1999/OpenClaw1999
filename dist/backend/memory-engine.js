"use strict";
/**
 * OpenClaw 记忆智能引擎 (Memory Engine)
 *
 * 封装所有高级记忆操作：
 * - 双轨触发器（Tool Call / 正则 Fallback）
 * - LLM 冲突合并器（Conflict Reconciler）
 * - 实体三元组提取器（Entity Extractor）
 * - 情景摘要生成器（Episode Summarizer）
 * - 统一检索融合器（Query Router）
 */
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
exports.MemoryEngine = exports.EXPECTED_EMBEDDING_DIM = void 0;
const path = __importStar(require("path"));
/** 预期嵌入向量维度（nomic-embed-text 为 768）。写入前校验，不一致拒写。 */
exports.EXPECTED_EMBEDDING_DIM = 768;
class MemoryEngine {
    modelManager;
    memoryStore;
    dataDir;
    constructor(modelManager, memoryStore, dataDir) {
        this.modelManager = modelManager;
        this.memoryStore = memoryStore;
        this.dataDir = dataDir;
    }
    // =============================================
    // 1. 双轨触发器 (Dual-Track Extractor)
    // =============================================
    /**
     * 检测当前模型是否支持 Tool Call (Function Calling)
     */
    supportsToolCall() {
        const active = this.modelManager.getActiveModel?.();
        if (!active)
            return false;
        // 云端大模型一般支持 Function Calling
        const cloudProviders = ['OpenAI', 'Anthropic', 'Google', 'DeepSeek'];
        return cloudProviders.some(p => (active.provider || '').includes(p));
    }
    /**
     * 获取注册给大模型的记忆工具函数定义（用于支持 Tool Call 的云端模型）
     */
    getMemoryTools() {
        return [
            {
                type: 'function',
                function: {
                    name: 'save_memory',
                    description: '当你在对话中发现了关于用户的持久性事实、偏好或习惯时，调用此工具将其永久保存。',
                    parameters: {
                        type: 'object',
                        properties: {
                            fact: { type: 'string', description: '要记住的事实内容' },
                            category: { type: 'string', description: '分类标签，如：个人信息、技术偏好、工作项目、兴趣爱好', enum: ['个人信息', '技术偏好', '工作项目', '兴趣爱好', '通用'] }
                        },
                        required: ['fact', 'category']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'search_memory',
                    description: '当用户询问"你还记得我说过什么吗"或需要回忆之前的事实时，调用此工具搜索长期记忆。',
                    parameters: {
                        type: 'object',
                        properties: {
                            query: { type: 'string', description: '搜索关键词或语义描述' }
                        },
                        required: ['query']
                    }
                }
            }
        ];
    }
    /**
     * 从正则标记中提取记忆（用于不支持 Tool Call 的本地小模型）
     * 支持格式: [SAVE_MEMORY|分类] 内容  或  [SAVE_MEMORY: 内容]
     */
    extractMemoriesFromRegex(reply) {
        const results = [];
        // 新格式: [SAVE_MEMORY|分类] 内容
        const newFormatRegex = /\[SAVE_MEMORY\|([^\]]+)\]\s*(.+?)(?=\[SAVE_MEMORY|$)/gs;
        let match;
        while ((match = newFormatRegex.exec(reply)) !== null) {
            results.push({ category: match[1].trim(), fact: match[2].trim() });
        }
        // 兼容旧格式: [SAVE_MEMORY: 内容]
        if (results.length === 0) {
            const oldFormatRegex = /\[SAVE_MEMORY:([\s\S]*?)\]/g;
            while ((match = oldFormatRegex.exec(reply)) !== null) {
                const fact = match[1].trim();
                if (fact) {
                    results.push({ fact, category: '通用' });
                }
            }
        }
        return results;
    }
    // =============================================
    // 2. LLM 冲突合并器 (Conflict Reconciler)
    // =============================================
    /**
     * 在写入新记忆前，检查是否与现有记忆冲突，并调用大模型仲裁
     * @returns 处理结果: 'inserted' | 'updated' | 'ignored'
     */
    async reconcileAndStore(fact, category) {
        const { vectorDbManager } = require('./vector-db-manager');
        const dbPath = path.join(this.dataDir, 'memories_vectors.json');
        // 1. 语义检索已有记忆，找到最相似的（嵌入不可用则退化为直接新增）
        let topMatch = null;
        try {
            const embedding = await this.modelManager.getEmbedding(fact);
            if (embedding && Array.isArray(embedding) && embedding.length === exports.EXPECTED_EMBEDDING_DIM) {
                await vectorDbManager.executeRead(dbPath, async (memVecStore) => {
                    const candidates = await memVecStore.search(embedding, fact, 1);
                    if (candidates && candidates.length > 0 && candidates[0].score > 0.75) {
                        topMatch = candidates[0];
                    }
                });
            }
        }
        catch (e) { }
        // 2. 如果没有高度相似的旧记忆，直接新增
        if (!topMatch) {
            const memory = this.memoryStore.addMemory(fact, category, ['auto']);
            await vectorDbManager.executeWrite(dbPath, async (memVecStore) => {
                await this._vectorizeMemory(memVecStore, fact, memory.id);
            });
            return 'inserted';
        }
        // 3. 有高度相似的旧记忆，调用大模型仲裁
        const oldFact = topMatch.doc.content;
        const reconcilePrompt = [
            {
                role: 'system',
                content: `你是一个记忆冲突仲裁专家。请严格以 JSON 格式输出判断结果，不要包含任何 markdown 或多余文字。
格式：{"action": "CONTRADICT" 或 "APPEND" 或 "IGNORE", "merged_fact": "合并后的新事实（仅 CONTRADICT 时需要）", "reason": "简短理由"}`
            },
            {
                role: 'user',
                content: `已有事实：「${oldFact}」\n新事实：「${fact}」\n请判断两者的关系。`
            }
        ];
        try {
            const reply = await this.modelManager.chat(reconcilePrompt, { temperature: 0.1 });
            const clean = reply.replace(/```json/g, '').replace(/```/g, '').trim();
            const result = JSON.parse(clean);
            if (result.action === 'CONTRADICT') {
                // 更新旧记忆内容
                const oldMemoryId = topMatch.doc.metadata?.memoryId;
                if (oldMemoryId) {
                    this.memoryStore.updateMemoryContent(oldMemoryId, result.merged_fact || fact);
                }
                // 更新向量库中的旧记录
                await vectorDbManager.executeWrite(dbPath, async (memVecStore) => {
                    await memVecStore.removeBySource(oldFact);
                    await this._vectorizeMemory(memVecStore, result.merged_fact || fact, oldMemoryId);
                });
                console.log(`[记忆引擎] 🔄 冲突合并：「${oldFact}」→「${result.merged_fact}」`);
                return 'updated';
            }
            else if (result.action === 'APPEND') {
                const memory = this.memoryStore.addMemory(fact, category, ['auto']);
                await vectorDbManager.executeWrite(dbPath, async (memVecStore) => {
                    await this._vectorizeMemory(memVecStore, fact, memory.id);
                });
                console.log(`[记忆引擎] ➕ 追加新记忆：「${fact}」`);
                return 'inserted';
            }
            else {
                console.log(`[记忆引擎] 🚫 忽略重复记忆：「${fact}」`);
                return 'ignored';
            }
        }
        catch (e) {
            // 大模型解析失败时，退回到直接新增（安全兜底）
            console.warn('[记忆引擎] LLM 冲突仲裁失败，退回直接新增:', e.message);
            const memory = this.memoryStore.addMemory(fact, category, ['auto']);
            await vectorDbManager.executeWrite(dbPath, async (memVecStore) => {
                await this._vectorizeMemory(memVecStore, fact, memory.id);
            });
            return 'inserted';
        }
    }
    async _vectorizeMemory(vecStore, fact, memoryId) {
        try {
            const embedding = await this.modelManager.getEmbedding(fact);
            // fail-fast：嵌入失败或维度异常时不写入随机/非法向量，仅 BM25 关键词召回
            if (!embedding || !Array.isArray(embedding) || embedding.length !== exports.EXPECTED_EMBEDDING_DIM) {
                console.warn(`[记忆引擎] ⚠️ 嵌入不可用或维度异常（${embedding ? embedding.length : 'null'}），跳过向量化，仅 BM25 召回，记忆标记为 pending_vectorization`);
                this.memoryStore.tagMemory?.(memoryId, 'pending_vectorization');
                return;
            }
            await vecStore.addDocuments([{
                    id: require('crypto').randomUUID(),
                    content: fact,
                    metadata: { source: fact, memoryId, timestamp: new Date().toISOString() },
                    embedding
                }]);
        }
        catch (e) {
            console.error('[记忆引擎] 向量化失败:', e.message);
        }
    }
    // =============================================
    // 3. 实体三元组提取器 (Entity Extractor)
    // =============================================
    /**
     * 从事实中提取实体关系三元组并写入 SQLite
     */
    async extractAndStoreEntities(fact, memoryId) {
        const prompt = [
            {
                role: 'system',
                content: `从以下事实中提取实体关系三元组。严格以 JSON 数组格式输出，不要包含任何 markdown。
格式：[{"subject": "主体", "predicate": "关系", "object": "客体"}]
如果无法提取，返回空数组 []。`
            },
            { role: 'user', content: fact }
        ];
        try {
            const reply = await this.modelManager.chat(prompt, { temperature: 0.1 });
            const clean = reply.replace(/```json/g, '').replace(/```/g, '').trim();
            const triples = JSON.parse(clean);
            if (Array.isArray(triples)) {
                for (const t of triples) {
                    if (t.subject && t.predicate && t.object) {
                        this.memoryStore.addEntityRelation(t.subject, t.predicate, t.object, memoryId);
                        console.log(`[记忆引擎] 🔗 实体关系：${t.subject} -[${t.predicate}]-> ${t.object}`);
                    }
                }
            }
        }
        catch (e) {
            console.warn('[记忆引擎] 实体提取失败（非致命）:', e.message);
        }
    }
    // =============================================
    // 4. 情景摘要生成器 (Episode Summarizer)
    // =============================================
    /**
     * 为指定对话生成精华摘要并存入情景记忆库
     */
    async generateEpisodeSummary(conversationId) {
        const history = this.memoryStore.getConversationHistory(conversationId);
        if (!history || history.length < 4)
            return; // 对话太短不值得摘要
        // 取最近 20 条消息进行摘要
        const recentMessages = history.slice(-20);
        const transcript = recentMessages.map((m) => `${m.role === 'user' ? '用户' : 'AI'}：${typeof m.content === 'string' ? m.content.slice(0, 300) : '[多模态内容]'}`).join('\n');
        const prompt = [
            {
                role: 'system',
                content: `请用 2-3 句话精炼地总结以下对话的核心内容和结论。同时提取 2-5 个关键主题标签。
严格以 JSON 格式输出：{"summary": "摘要内容", "topics": ["主题1", "主题2"]}`
            },
            { role: 'user', content: transcript }
        ];
        try {
            const reply = await this.modelManager.chat(prompt, { temperature: 0.3 });
            const clean = reply.replace(/```json/g, '').replace(/```/g, '').trim();
            const result = JSON.parse(clean);
            if (result.summary) {
                this.memoryStore.saveEpisode(conversationId, result.summary, result.topics || []);
                // 将摘要向量化存入情景向量库
                const { vectorDbManager } = require('./vector-db-manager');
                const dbPath = path.join(this.dataDir, 'episodes_vectors.json');
                const embedding = await this.modelManager.getEmbedding(result.summary);
                if (embedding && Array.isArray(embedding) && embedding.length === exports.EXPECTED_EMBEDDING_DIM) {
                    await vectorDbManager.executeWrite(dbPath, async (episodeVecStore) => {
                        await episodeVecStore.addDocuments([{
                                id: require('crypto').randomUUID(),
                                content: result.summary,
                                metadata: {
                                    conversationId,
                                    topics: result.topics,
                                    timestamp: new Date().toISOString()
                                },
                                embedding
                            }]);
                    });
                }
                else {
                    console.warn('[记忆引擎] 情景摘要嵌入不可用，已保存文本摘要但未写入向量（BM25 可召回）。');
                }
                console.log(`[记忆引擎] 📖 情景摘要已生成：「${result.summary.slice(0, 60)}...」`);
            }
        }
        catch (e) {
            console.warn('[记忆引擎] 情景摘要生成失败（非致命）:', e.message);
        }
    }
    // =============================================
    // 5. 统一检索融合器 (Query Router)
    // =============================================
    /**
     * 三路并发召回：记忆 + 知识库 + 情景摘要，按加权分数融合
     */
    async unifiedRetrieval(query, knowledgeCategory = '默认知识库') {
        const { vectorDbManager } = require('./vector-db-manager');
        const results = [];
        let queryEmbedding = null;
        try {
            const emb = await this.modelManager.getEmbedding(query);
            if (emb && Array.isArray(emb) && emb.length === exports.EXPECTED_EMBEDDING_DIM) {
                queryEmbedding = emb;
            }
        }
        catch (e) {
            return results;
        }
        // 嵌入不可用：明确降级为 BM25 关键词召回，绝不参与向量排序
        if (!queryEmbedding) {
            console.warn('[记忆引擎] 嵌入模型不可用，统一检索降级为 BM25 关键词召回，未污染向量排序。');
            return results;
        }
        // 三路并发检索
        const tasks = [];
        // 路径 A: 长期记忆 (应用艾宾浩斯遗忘曲线)
        tasks.push((async () => {
            try {
                const dbPath = path.join(this.dataDir, 'memories_vectors.json');
                await vectorDbManager.executeRead(dbPath, async (memStore) => {
                    const hits = await memStore.search(queryEmbedding, query, 5); // 增加初筛数量以防过滤
                    for (const h of (hits || [])) {
                        let scoreModifier = 1.0;
                        let recallCount = 0;
                        let diffHours = 0;
                        let retention = 1.0;
                        let isPromoted = false;
                        let memoryId = h.doc.metadata?.memoryId;
                        // 记忆库自愈绑定：针对旧系统创建的、没有绑定 SQLite row ID 的旧向量记录
                        if (!memoryId) {
                            try {
                                const matches = this.memoryStore.db.exec('SELECT id FROM memories WHERE content = ? LIMIT 1', [h.doc.content]);
                                if (matches && matches.length > 0 && matches[0].values.length > 0) {
                                    memoryId = matches[0].values[0][0];
                                    h.doc.metadata = h.doc.metadata || {};
                                    h.doc.metadata.memoryId = memoryId;
                                    // 异步写回向量存储库存盘
                                    setImmediate(async () => {
                                        try {
                                            await vectorDbManager.executeWrite(dbPath, () => { });
                                        }
                                        catch (e) { }
                                    });
                                    console.log(`[记忆引擎] 🩹 成功自愈旧记忆向量的 memoryId 绑定：「${h.doc.content.slice(0, 20)}...」`);
                                }
                            }
                            catch (e) { }
                        }
                        if (memoryId) {
                            const memoryDetail = this.memoryStore.getMemory(memoryId);
                            if (memoryDetail) {
                                // 遗漏过滤：如果该记忆已被晋升为知识库文档，则跳过召回，防止双重冗余
                                let tagsArray = [];
                                try {
                                    tagsArray = typeof memoryDetail.tags === 'string'
                                        ? JSON.parse(memoryDetail.tags)
                                        : (memoryDetail.tags || []);
                                }
                                catch (e) { }
                                if (tagsArray.includes('promoted')) {
                                    isPromoted = true;
                                }
                                recallCount = memoryDetail.recall_count || 0;
                                // 0. 置顶锁定免遗忘：如果被用户置顶锁定 (is_pinned = 1)，则免于艾宾浩斯衰减，保持率恒为 100%
                                if (memoryDetail.is_pinned === 1) {
                                    retention = 1.0;
                                    scoreModifier = 1.0;
                                    diffHours = 0;
                                }
                                else {
                                    const lastRecalled = memoryDetail.last_recalled_at || memoryDetail.created_at;
                                    if (lastRecalled) {
                                        const lastTime = new Date(lastRecalled).getTime();
                                        const now = Date.now();
                                        // 1. 防灾防负数：若用户本地系统时钟发生跳跃或倒退，确保时间差非负
                                        diffHours = Math.max(0, (now - lastTime) / (1000 * 60 * 60)); // 换算为小时差
                                        // 2. 防除零错误：强制记忆强度 S 至少为 1 小时
                                        const strength = Math.max(1, 24 * (1 + recallCount * 1.5));
                                        // 3. 计算保持率并强限制在 [0.0, 1.0] 区间内
                                        retention = Math.exp(-diffHours / strength);
                                        retention = Math.min(1.0, Math.max(0.0, retention));
                                        scoreModifier = retention;
                                    }
                                }
                            }
                        }
                        // 过滤已晋升知识库的记忆
                        if (isPromoted) {
                            console.log(`[艾宾浩斯检索] 📦 记忆已晋升为知识，过滤避免双重召回: 「${h.doc.content.slice(0, 25)}...」`);
                            continue;
                        }
                        // 艾宾浩斯过滤器：如果保持率低于 5% (遗忘深度达 95%)，该记忆被遗忘过滤
                        if (retention < 0.05) {
                            console.log(`[艾宾浩斯遗忘曲线] 🍂 记忆已遗忘，过滤召回: 「${h.doc.content.slice(0, 30)}...」`);
                            continue;
                        }
                        console.log(`[艾宾浩斯遗忘曲线] 🎯 记忆唤醒: 「${h.doc.content.slice(0, 25)}...」 | 唤醒次数: ${recallCount} | 距离上次: ${diffHours.toFixed(1)}h | 当前记忆率: ${(retention * 100).toFixed(1)}%`);
                        results.push({ content: h.doc.content, source: '用户记忆', score: h.score * 1.2 * scoreModifier });
                        // 增加召回计数
                        if (memoryId) {
                            this.memoryStore.bumpRecallCount(memoryId);
                        }
                    }
                });
            }
            catch (e) { }
        })());
        // 路径 B: 知识库
        tasks.push((async () => {
            try {
                const knowledgeDir = path.join(this.dataDir, 'knowledge');
                let dbPath = path.join(knowledgeDir, `${knowledgeCategory}.json`);
                const fs = require('fs');
                if (!fs.existsSync(dbPath)) {
                    const oldPath = path.join(this.dataDir, 'vectors.json');
                    if (fs.existsSync(oldPath))
                        dbPath = oldPath;
                    else
                        return;
                }
                await vectorDbManager.executeRead(dbPath, async (kbStore) => {
                    const hits = await kbStore.search(queryEmbedding, query, 5);
                    for (const h of (hits || [])) {
                        const content = h.doc.metadata?.parentContent || h.doc.content;
                        results.push({ content, source: '知识库', score: h.score * 1.0 });
                    }
                });
            }
            catch (e) { }
        })());
        // 路径 C: 情景记忆摘要
        tasks.push((async () => {
            try {
                const dbPath = path.join(this.dataDir, 'episodes_vectors.json');
                await vectorDbManager.executeRead(dbPath, async (epStore) => {
                    const hits = await epStore.search(queryEmbedding, query, 2);
                    for (const h of (hits || [])) {
                        results.push({ content: h.doc.content, source: '历史对话', score: h.score * 0.8 });
                    }
                });
            }
            catch (e) { }
        })());
        await Promise.all(tasks);
        // 实体关系补充查询
        try {
            const entityHits = this.memoryStore.queryEntityRelations(query);
            if (entityHits && entityHits.length > 0) {
                const entityContext = entityHits.map((e) => `${e.subject} -[${e.predicate}]-> ${e.object}`).join('；');
                results.push({ content: `[实体关系] ${entityContext}`, source: '实体图谱', score: 1.1 });
            }
        }
        catch (e) { }
        // 按加权分数降序排列
        results.sort((a, b) => b.score - a.score);
        return results.slice(0, 8);
    }
    /**
     * 异步后台处理记忆提取全流程（从对话回复中提取 → 冲突合并 → 实体抽取 → 向量化）
     */
    async processMemoryExtractionAsync(reply) {
        const memories = this.extractMemoriesFromRegex(reply);
        for (const mem of memories) {
            const result = await this.reconcileAndStore(mem.fact, mem.category);
            if (result === 'inserted' || result === 'updated') {
                await this.extractAndStoreEntities(mem.fact, 'auto');
            }
        }
    }
    /**
     * 启动时一次性扫描存量记忆向量库，清理维度异常的孤儿向量（触发重算/删除）。
     * 旧版随机 3 维向量、维度不匹配的向量将被识别为孤儿并移除，避免污染召回。
     * @returns 被清理的孤儿向量条数
     */
    async cleanupOrphanVectors() {
        const fs = require('fs');
        const dbPath = path.join(this.dataDir, 'memories_vectors.json');
        if (!fs.existsSync(dbPath))
            return 0;
        try {
            const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
            if (!Array.isArray(data))
                return 0;
            const valid = data.filter((d) => d && Array.isArray(d.embedding) && d.embedding.length === exports.EXPECTED_EMBEDDING_DIM);
            const orphans = data.length - valid.length;
            if (orphans > 0) {
                fs.writeFileSync(dbPath, JSON.stringify(valid), 'utf8');
                console.warn(`[记忆引擎] 🧹 启动时清理 ${orphans} 条维度异常的孤儿向量（维度 != ${exports.EXPECTED_EMBEDDING_DIM}），已触发重算/删除。`);
            }
            return orphans;
        }
        catch (e) {
            console.error('[记忆引擎] 孤儿向量清理失败（非致命）:', e.message);
            return 0;
        }
    }
}
exports.MemoryEngine = MemoryEngine;
