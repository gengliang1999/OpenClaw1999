const fs = require('fs');
const readline = require('readline');
const path = require('path');

const transcripts = [
  'C:/Users/15966/.gemini/antigravity/brain/91c99326-ee0f-4f61-bf78-75e6dd284dff/.system_generated/logs/transcript.jsonl'
];

let fileContents = {};

async function processTranscript(filePath) {
    if (!fs.existsSync(filePath)) return;
    console.log('Processing', filePath);
    const rl = readline.createInterface({
      input: fs.createReadStream(filePath)
    });

    for await (const line of rl) {
      if (line.includes('write_to_file')) {
         try {
           const obj = JSON.parse(line);
           if (obj.tool_calls) {
              for (let t of obj.tool_calls) {
                 if (t.name === 'write_to_file') {
                     const argsRaw = t.arguments || t.args || t.function?.arguments;
                     const args = typeof argsRaw === 'string' ? JSON.parse(argsRaw) : argsRaw;
                     if (args && args.CodeContent && args.TargetFile) {
                        let target = args.TargetFile.replace(/\\/g, '/').replace(/"/g, '');
                        if (target.includes('src/renderer/pages') || target.includes('src/renderer/components')) {
                            let code = args.CodeContent;
                            if (typeof code === 'string' && code.startsWith('"')) {
                                try { code = JSON.parse(code); } catch(e) {}
                            }
                            // Store the latest version found
                            fileContents[target] = code;
                        }
                     }
                 }
              }
           }
         } catch(e) {}
      }
    }
}

async function main() {
    for (let t of transcripts) {
        await processTranscript(t);
    }
    
    let count = 0;
    for (const [targetPath, content] of Object.entries(fileContents)) {
        // extract the filename to map back to our local project
        const match = targetPath.match(/(src\/renderer\/(pages|components)\/[^/]+)$/);
        if (match) {
            const relPath = match[1];
            const fullLocalPath = path.join('d:/Code/OpenClawAssistant', relPath);
            fs.writeFileSync(fullLocalPath, content, 'utf8');
            console.log('Restored', relPath);
            count++;
        }
    }
    console.log(`Restored ${count} files.`);
}

main();
