const fs = require('fs');
const file = 'src/renderer/pages/chat.js';
let content = fs.readFileSync(file, 'utf8');

const newFunc = `function updateTokenUsage(messages) {
  let totalChars = messages.reduce((acc, msg) => acc + (msg.content?.length || 0), 0);
  if (typeof activeExpert !== 'undefined' && activeExpert && activeExpert.prompt) totalChars += activeExpert.prompt.length;
  
  const activeModel = typeof availableModels !== 'undefined' ? availableModels.find(m => m.id === selectedModel) : null;
  const isLocal = activeModel && (activeModel.provider === 'Ollama' || activeModel.provider === 'LM Studio' || activeModel.type === 'local');
  const container = document.getElementById('contextUsageContainer');
  
  if (!isLocal) {
    if (container) container.style.display = 'none';
    return;
  }
  
  if (container) container.style.display = 'block';
  
  const estimatedTokens = Math.floor(totalChars * 0.4);
  const maxCtx = activeModel?.contextSize || 8192;
  const ratio = Math.min((estimatedTokens / maxCtx) * 100, 100);
  
  const circle = document.getElementById('tokenUsageCircle');
  if (circle) {
    const offset = 100 - ratio;
    circle.style.strokeDashoffset = offset;
    container.title = '上下文占用: ' + estimatedTokens + '/' + maxCtx + ' (' + ratio.toFixed(1) + '%)\\n点击可强制压缩上下文';
    
    if (ratio > 90) {
      circle.style.stroke = 'var(--danger)';
    } else if (ratio > 70) {
      circle.style.stroke = 'var(--warning)';
    } else {
      circle.style.stroke = 'var(--primary)';
    }
  }
}`;

content = content.replace(/function updateTokenUsage\(messages\) \{[\s\S]*?\}\s*(?=\/\/ === 工具函数 ===)/, newFunc + '\n\n  ');

// Add updateTokenUsage call in sendMessage after appending user message
content = content.replace(/inner\.appendChild\(userMsgEl\.firstElementChild\);\s*\n\s*\/\/ 清空输入/g, 
  "inner.appendChild(userMsgEl.firstElementChild);\n  updateTokenUsage([{content: finalMessage}]);\n  \n  // 清空输入");

fs.writeFileSync(file, content);
console.log('Fixed chat.js');
