const fs = require('fs');
const readline = require('readline');
const path = require('path');

const transcripts = [
  'C:/Users/15966/.gemini/antigravity/brain/91c99326-ee0f-4f61-bf78-75e6dd284dff/.system_generated/logs/transcript.jsonl',
  'C:/Users/15966/.gemini/antigravity/brain/a37dc8f0-6f8b-45ae-887f-065e80b5d8c3/.system_generated/logs/transcript.jsonl'
];

let viewFileOutputs = {};

async function processTranscript(filePath) {
    if (!fs.existsSync(filePath)) return;
    console.log('Processing', filePath);
    const rl = readline.createInterface({
      input: fs.createReadStream(filePath)
    });

    for await (const line of rl) {
        try {
            const obj = JSON.parse(line);
            // Tool responses are typically in obj.output or inside obj.content if it's an environment response
            // or obj.tool_calls results
            if (obj.type === 'ENVIRONMENT_RESPONSE' || obj.type === 'TOOL_RESPONSE' || obj.output || (obj.tool_responses && obj.tool_responses.length > 0)) {
                let responses = [];
                if (obj.output) responses.push(obj.output);
                if (obj.tool_responses) {
                    for (let tr of obj.tool_responses) {
                        if (tr.output) responses.push(tr.output);
                    }
                }
                if (obj.content && typeof obj.content === 'string') responses.push(obj.content);
                
                for (let text of responses) {
                    if (typeof text !== 'string') continue;
                    
                    const match = text.match(/File Path: `file:\/\/\/[^`]*?(src\/renderer\/(pages|components)\/[^`]+)`/);
                    if (match) {
                        const relPath = match[1];
                        // Extract lines
                        const lines = text.split('\n');
                        let codeLines = [];
                        let capturing = false;
                        for (let l of lines) {
                            if (l.includes('The following code has been modified to include a line number')) {
                                capturing = true;
                                continue;
                            }
                            if (l.includes('The above content shows the entire')) {
                                capturing = false;
                                break;
                            }
                            if (capturing) {
                                // Match "123: content"
                                const lineMatch = l.match(/^\d+:\s?(.*)$/);
                                if (lineMatch) {
                                    codeLines.push(lineMatch[1]);
                                } else if (l.trim() === '') {
                                    codeLines.push('');
                                } else {
                                    // Sometimes lines wrap or don't have numbers if they were broken, but view_file guarantees numbers
                                }
                            }
                        }
                        if (codeLines.length > 0) {
                            viewFileOutputs[relPath] = codeLines.join('\n');
                        }
                    }
                }
            }
        } catch(e) {}
    }
}

async function main() {
    for (let t of transcripts) {
        await processTranscript(t);
    }
    
    let count = 0;
    for (const [relPath, content] of Object.entries(viewFileOutputs)) {
        const fullLocalPath = path.join('d:/Code/OpenClawAssistant', relPath);
        fs.writeFileSync(fullLocalPath, content, 'utf8');
        console.log('Restored from view_file:', relPath, content.length, 'bytes');
        count++;
    }
    console.log(`Restored ${count} files from view_file logs.`);
}

main();
