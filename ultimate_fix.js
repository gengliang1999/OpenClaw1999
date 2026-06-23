const fs = require('fs');
const readline = require('readline');

let targetScript = null;

const rl = readline.createInterface({
  input: fs.createReadStream('C:/Users/15966/.gemini/antigravity/brain/91c99326-ee0f-4f61-bf78-75e6dd284dff/.system_generated/logs/transcript.jsonl')
});

rl.on('line', (line) => {
  if (line.includes('chat.js') && line.includes('CodeContent')) {
     try {
       const obj = JSON.parse(line);
       if (obj.tool_calls) {
          for (let t of obj.tool_calls) {
             const argsRaw = t.arguments || t.args || (t.function && t.function.arguments);
             const args = typeof argsRaw === 'string' ? JSON.parse(argsRaw) : argsRaw;
             if (args && args.CodeContent && args.TargetFile && args.TargetFile.includes('chat.js')) {
                let code = args.CodeContent;
                if (typeof code === 'string' && code.startsWith('"')) {
                    try { code = JSON.parse(code); } catch(e) {}
                }
                targetScript = code;
             }
          }
       }
     } catch(e) {}
  }
});

rl.on('close', () => {
    if (!targetScript) {
        console.log('Target script not found.');
        return;
    }

    let content = targetScript;

    // Apply ONLY the safe feature replacements
    content = content.replace("let selectedModel = 'GPT-4o';", "let selectedModel = 'GPT-4o';\nlet activeExpert = null;");

    content = content.replace('export async function render(container) {', 'export async function render(container) {\n  isGenerating = false;\n  if (window.currentChatController) {\n    try { window.currentChatController.abort(); } catch(e) {}\n    window.currentChatController = null;\n  }');

    content = content.replace('<option value="">加载模型中...</option>\n          </select>\n        </div>', '<option value="">加载模型中...</option>\n          </select>\n        </div>\n        <div id="expertIndicator" style="display: none; align-items: center; gap: 8px; font-size: 13px; background: rgba(108, 99, 255, 0.1); color: var(--primary); padding: 4px 12px; border-radius: 16px; margin-left: 12px; border: 1px solid rgba(108, 99, 255, 0.2);">\n          <span id="expertName"></span>\n          <button id="clearExpertBtn" style="background: transparent; border: none; color: inherit; cursor: pointer; font-size: 14px; padding: 0 4px; opacity: 0.7;" title="退出专家模式">&times;</button>\n        </div>');

    content = content.replace("max-height: 200px;", "max-height: 60vh; overflow-y: auto;");

    content = content.replace("this.style.height = Math.min(this.scrollHeight, 150) + 'px';", "this.style.height = this.scrollHeight + 'px';");

    content = content.replace('// 初始化模型列表\n  await loadModels();', '// 初始化模型列表\n  await loadModels();\n\n  loadActiveExpert();');

    const loadActiveExpertCode = `
function loadActiveExpert() {
  const data = localStorage.getItem('activeExpert');
  const indicator = document.getElementById('expertIndicator');
  if (data) {
    try {
      activeExpert = JSON.parse(data);
      document.getElementById('expertName').textContent = \`\${activeExpert.icon} \${activeExpert.name}\`;
      indicator.style.display = 'flex';
      setTimeout(() => {
        const input = document.getElementById('chatInput');
        if (input) input.focus();
      }, 100);
      createNewChat();
    } catch(e) {
      activeExpert = null;
    }
  } else {
    activeExpert = null;
    indicator.style.display = 'none';
  }

  const clearBtn = document.getElementById('clearExpertBtn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      localStorage.removeItem('activeExpert');
      activeExpert = null;
      indicator.style.display = 'none';
      if (window.__toast) window.__toast.info('已退出专家模式，恢复常规对话');
    });
  }
}

`;
    content = content.replace('async function loadModels() {', loadActiveExpertCode + 'async function loadModels() {');

    // Fix the `systemPrompt` part where it passes options
    // Actually the original `chat.js` did NOT have `systemPrompt` passed to `window.__chat.sendMessage`!
    // So let me just replace the options object.
    content = content.replace(
      /conversationId: conv\.id,[\s\S]*?onData:/g,
      "conversationId: conv.id,\n        systemPrompt: activeExpert ? activeExpert.prompt : undefined,\n        onData:"
    );

    fs.writeFileSync('src/renderer/pages/chat.js', content, 'utf8');
    console.log('Successfully fully restored and patched chat.js!');
});
