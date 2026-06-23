const fs = require('fs');
const file = 'src/renderer/pages/chat.js';
let content = fs.readFileSync(file, 'utf8');

// 1. Fix stream error overriding
content = content.replace(/let fullContent = '';/, "let fullContent = '';\n  let hasError = false;");

content = content.replace(/\} else if \(data\.type === 'error'\) \{[\s\S]*?bubble\.innerHTML = `<span style="color:var\(--danger\)">生成失败: \$\{data\.message\}<\/span>`;/,
`} else if (data.type === 'error') {
              hasError = true;
              window.__toast?.error('模型返回错误: ' + data.message);
              fullContent = '<span style="color:var(--danger)">生成失败: ' + data.message + '</span>';
              bubble.innerHTML = fullContent;`);

content = content.replace(/bubble\.innerHTML = renderMarkdown\(fullContent\);\s*await loadMessages\(activeConvId\);/,
`if (!hasError) {
      bubble.innerHTML = renderMarkdown(fullContent);
      await loadMessages(activeConvId);
    }`);

// 2. Enhance Progress Bar visibility
content = content.replace(/<div id="contextUsageContainer" style="display: none; position: relative; width: 28px; height: 28px; cursor: pointer; margin-right: 4px;" title="上下文占用率 \(点击压缩\)">\s*<svg viewBox="0 0 36 36" style="width: 100%; height: 100%; transform: rotate\(-90deg\);">\s*<circle cx="18" cy="18" r="16" fill="none" stroke="rgba\(255,255,255,0\.1\)" stroke-width="3"><\/circle>\s*<circle id="tokenUsageCircle" cx="18" cy="18" r="16" fill="none" stroke="var\(--primary\)" stroke-width="3"/, 
`<div id="contextUsageContainer" style="display: none; position: relative; width: 36px; height: 36px; cursor: pointer; margin-right: 8px; background: rgba(0,0,0,0.2); border-radius: 50%; padding: 4px; box-shadow: 0 0 10px rgba(108,99,255,0.3);" title="上下文占用率 (点击压缩)">
                    <svg viewBox="0 0 36 36" style="width: 100%; height: 100%; transform: rotate(-90deg);">
                      <circle cx="18" cy="18" r="16" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="4"></circle>
                      <circle id="tokenUsageCircle" cx="18" cy="18" r="16" fill="none" stroke="var(--primary)" stroke-width="4"`);

fs.writeFileSync(file, content);
console.log('Fixed chat.js visual bugs');

const cssFile = 'src/renderer/index.css';
let css = fs.readFileSync(cssFile, 'utf8');

// 3. Enhance Toolbar Button Contrast & Colors
css = css.replace(/\.toolbar-btn \{[\s\S]*?box-shadow: 0 2px 6px rgba\(0,0,0,0\.15\);\s*\}/, 
`.toolbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  user-select: none;
  font-size: 14px;
  cursor: pointer;
  padding: 6px 14px;
  border-radius: 20px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-sizing: border-box;
  gap: 6px;
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: var(--text-primary);
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}

#modelSelectBtn {
  background: rgba(0, 217, 255, 0.15);
  border-color: rgba(0, 217, 255, 0.3);
}
#depthSelectBtn {
  background: rgba(108, 99, 255, 0.15);
  border-color: rgba(108, 99, 255, 0.3);
}
#fileUploadBtn {
  background: rgba(40, 200, 64, 0.15);
  border-color: rgba(40, 200, 64, 0.3);
}
#callBtn {
  background: rgba(255, 149, 0, 0.15);
  border-color: rgba(255, 149, 0, 0.3);
}
`);

fs.writeFileSync(cssFile, css);
console.log('Fixed index.css');
