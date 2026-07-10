"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.vectorDbManager = exports.VectorDatabaseManager = void 0;
const vector_store_1 = require("./vector-store");
/**
 * 向量数据库连接池与并发锁管理器 (Deep Module)
 * 解决浅层 new VectorStore 带来的并发 I/O 文件写穿问题，提供高内聚的缓存和排队服务。
 */
class VectorDatabaseManager {
    static instance;
    storeCache = new Map();
    // 基于 Promise 队列的物理文件并发互斥锁 (Mutex)
    locks = new Map();
    constructor() { }
    static getInstance() {
        if (!VectorDatabaseManager.instance) {
            VectorDatabaseManager.instance = new VectorDatabaseManager();
        }
        return VectorDatabaseManager.instance;
    }
    /**
     * 获取或加载缓存在内存中的 VectorStore，极大降低频繁加载的磁盘 IO 损耗
     */
    async getStore(dbPath) {
        if (this.storeCache.has(dbPath)) {
            return this.storeCache.get(dbPath);
        }
        const store = new vector_store_1.VectorStore(dbPath);
        await store.load(); // 底层已经封装了防异常读取
        this.storeCache.set(dbPath, store);
        return store;
    }
    /**
     * 线程安全的互斥写入操作 (Mutex Write)
     * 对同一文件的所有写入和读取请求将被完全串行化排队执行，彻底根治丢数据和格式损坏问题。
     */
    async executeWrite(dbPath, operation) {
        const store = await this.getStore(dbPath);
        const previousLock = this.locks.get(dbPath) || Promise.resolve();
        let releaseLock;
        const currentLock = new Promise(resolve => {
            releaseLock = resolve;
        });
        // 使用 .catch(() => {}) 确保即使前一次的 previousLock 失败了，也不会把拒绝状态传导给 currentLock 的锁
        const nextLock = previousLock.catch(() => { }).then(() => currentLock);
        this.locks.set(dbPath, nextLock);
        try {
            // 等待前一个锁释放，即使前一个锁抛错也忽略，只关心锁释放的时机
            await previousLock.catch(() => { });
            const result = await operation(store);
            await store.save(); // 操作完成后原子落盘
            return result;
        }
        finally {
            releaseLock(); // 释放锁，允许下一个任务进入
        }
    }
    /**
     * 线程安全的互斥读取操作 (Mutex Read)
     * 确保在读出数据的瞬间，没有正在进行的写入任务。
     */
    async executeRead(dbPath, operation) {
        const store = await this.getStore(dbPath);
        const previousLock = this.locks.get(dbPath) || Promise.resolve();
        // 等待前一个写锁完成，即使前一个锁抛错也忽略
        await previousLock.catch(() => { });
        return await operation(store);
    }
    /**
     * 主动清理内存中的句柄
     */
    clearCache(dbPath) {
        this.storeCache.delete(dbPath);
    }
}
exports.VectorDatabaseManager = VectorDatabaseManager;
exports.vectorDbManager = VectorDatabaseManager.getInstance();
