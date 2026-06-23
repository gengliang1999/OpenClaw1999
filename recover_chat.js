const fs = require('fs');
const readline = require('readline');

let lastScript = null;

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
                lastScript = args.CodeContent;
             }
          }
       }
     } catch(e) {}
  }
});

rl.on('close', () => {
    if (!lastScript) {
        console.log('Script not found.');
        return;
    }

    try {
      let code = lastScript;
      if (typeof code === 'string' && code.startsWith('"')) {
          try { code = JSON.parse(code); } catch(e) {}
      }
      fs.writeFileSync('src/renderer/pages/chat_last.js', code, 'utf8');
      console.log('Wrote chat_last.js');
    } catch (e) {
      console.log('Error', e);
    }
});
