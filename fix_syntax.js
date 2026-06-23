const fs = require('fs');
let s = fs.readFileSync('src/renderer/pages/chat.js', 'utf8');

// The problematic lines that have missing quotes / parens:
// window.__toast?.warning('请先输入简短的需??);
s = s.replace(/window\.__toast\?\.warning\([^)]*;/g, "window.__toast?.warning('请输入');");

// window.__toast?.error('鍙戦€佸け?? ${error.message}');
s = s.replace(/window\.__toast\?\.error\([^)]*;/g, "window.__toast?.error('发生错误');");

// if (!confirm('纭畾瑕佷粠涓婁笅鏂囧垹闄よ繖鏉℃秷鎭悧??)) return;
s = s.replace(/if \(!confirm\([^)]*\)/g, "if (!confirm('确定吗?'))");

// if (confirm('纭畾瑕佹竻绌哄綋鍓嶅璇濈殑鎵€鏈変笂涓嬫枃鍚楋紵杩欏皢涓嶅彲鎭㈠??)) {
s = s.replace(/if \(confirm\([^)]*\)/g, "if (confirm('确定吗?'))");

// Replace any template literals that have unclosed backticks on a single line
s = s.replace(/chatInput\.value = `.*\{text\}.*;/g, "chatInput.value = text;");

fs.writeFileSync('src/renderer/pages/chat.js', s, 'utf8');
console.log('Fixed syntax!');
