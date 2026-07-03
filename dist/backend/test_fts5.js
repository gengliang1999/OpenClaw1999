"use strict";
const initSqlJs = require('sql.js');
initSqlJs().then(SQL => {
    const db = new SQL.Database();
    db.run(`CREATE VIRTUAL TABLE t USING fts5(text);`);
    db.run(`INSERT INTO t VALUES ('如果甲方违约，需支付违约金100万');`);
    // 测试精确词匹配
    let res = db.exec(`SELECT * FROM t WHERE t MATCH '违约金'`);
    console.log('Result for 违约金:', JSON.stringify(res));
    // 测试单字匹配
    res = db.exec(`SELECT * FROM t WHERE t MATCH '"违" "约" "金"'`);
    console.log('Result for 单字组合:', JSON.stringify(res));
    // 默认情况下如果搜索 '甲方' 可能匹配不到因为没有分词
    res = db.exec(`SELECT * FROM t WHERE t MATCH '甲方'`);
    console.log('Result for 甲方:', JSON.stringify(res));
});
