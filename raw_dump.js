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

    fs.writeFileSync('src/renderer/pages/chat_raw.txt', targetScript, 'utf8');
    console.log('Wrote chat_raw.txt');
});
