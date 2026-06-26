"use strict";
// @ts-nocheck
const express = require('express');
module.exports = function (dependencies) {
    const router = express.Router();
    const { memoryStore } = dependencies;
    /** 获取记忆列表 */
    router.get('/', (req, res) => {
        try {
            const { page, pageSize, category } = req.query;
            const result = memoryStore.getAllMemories(parseInt(page) || 1, parseInt(pageSize) || 20, category);
            res.json(result);
        }
        catch (error) {
            res.status(500).json({ message: error.message });
        }
    });
    /** 添加记忆 */
    router.post('/', (req, res) => {
        try {
            const { content, category, tags } = req.body;
            if (!content)
                return res.status(400).json({ message: '内容不能为空' });
            const memory = memoryStore.addMemory(content, category, tags);
            res.json(memory);
        }
        catch (error) {
            res.status(500).json({ message: error.message });
        }
    });
    /** 删除记忆 */
    router.delete('/:id', (req, res) => {
        try {
            memoryStore.deleteMemory(req.params.id);
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ message: error.message });
        }
    });
    /** 搜索记忆 */
    router.get('/search', (req, res) => {
        try {
            const { q, limit } = req.query;
            const results = memoryStore.searchMemory(q || '', parseInt(limit) || 10);
            res.json(results);
        }
        catch (error) {
            res.status(500).json({ message: error.message });
        }
    });
    /** 导出记忆 */
    router.get('/export', (req, res) => {
        try {
            const data = memoryStore.exportData();
            res.json(data);
        }
        catch (error) {
            res.status(500).json({ message: error.message });
        }
    });
    /** 导入记忆 */
    router.post('/import', (req, res) => {
        try {
            memoryStore.importData(req.body);
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ message: error.message });
        }
    });
    return router;
};
