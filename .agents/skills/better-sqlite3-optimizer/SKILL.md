---
name: better-sqlite3-optimizer
description: 当需要诊断本地 SQLite（主要是 better-sqlite3）的读写卡顿、设计与优化数据库表索引（Indexes）、处理 WAL 预写日志配置以及进行多版本数据库结构迁移（Migration）时调用此技能。
---

# Better-SQLite3 Optimizer (SQLite 本地数据库优化专家)

当本软件在大规模对话历史加载出现明显延迟、或 SQLite 报出 “database is locked”、或需要修改表结构又担心丢失用户本地聊天记录时，必须遵循本规程执行。

## 性能调优三大黄金律

### 1. 索引覆盖 (Indexes Verification)
- 对频繁用于 `WHERE` 或 `ORDER BY` 的列必须建立索引：
  - `messages` 表：必须对 `conversation_id` 建立索引以加速加载历史记录。
  - 关系链表：对于连接表，对关联键（外键等）建立联合索引。
- 诊断 SQL 查询性能可执行 `EXPLAIN QUERY PLAN <SQL语句>;`，确保查询不走 `SCAN TABLE` 而是 `SEARCH TABLE USING INDEX`。

### 2. 启用 WAL 模式与同步优化
- SQLite 默认事务模式较为保守，写入速度极慢。在初始化数据库连接时，必须执行以下指令提速：
  ```sql
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA temp_store = MEMORY;
  ```
- **WAL 模式优点**：读写不互斥，写入时不会阻塞前端页面的历史消息加载。
- **Normal 同步级**：极大地加速写入，同时保留了掉电保护。

### 3. 数据无损安全迁移 (Safe Migration)
- 禁止在版本更新时简单粗暴地执行 `DROP TABLE IF EXISTS`。
- 修改表结构时，应使用标准的增量变更语句：
  ```sql
  -- 检查列是否存在，如果不存在则添加
  ALTER TABLE messages ADD COLUMN source TEXT DEFAULT 'USER_INPUT';
  ```
- 如果涉及复杂的重构，可采用临时表备份法：
  1. `CREATE TABLE temp_messages AS SELECT * FROM messages;`
  2. 重建并优化新 `messages` 表结构。
  3. `INSERT INTO messages SELECT ... FROM temp_messages;`
  4. `DROP TABLE temp_messages;`
