const fs = require('fs');

const s = fs.readFileSync('C:/Users/15966/.gemini/antigravity/brain/91c99326-ee0f-4f61-bf78-75e6dd284dff/.system_generated/logs/transcript.jsonl', 'utf8');

const match = s.match(/"TargetFile":"\\"d:\/Code\/OpenClawAssistant\/src\/renderer\/pages\/chat\.js\\"".*?"CodeContent":"(.*?)"/);
if (match) {
   let rawContent = match[1];
   // rawContent is the literal string inside the JSON string
   // We need to unescape it.
   // It's escaped with JSON rules, so we can just parse it!
   let decoded = JSON.parse('"' + rawContent + '"');
   
   if (decoded.startsWith('"') && decoded.endsWith('"')) {
       // It was double encoded
       decoded = JSON.parse(decoded);
   }

   // Now decoded should be the actual source code!
   fs.writeFileSync('src/renderer/pages/chat.js', decoded, 'utf8');
   console.log('Restored using Regex!', decoded.substring(0, 100));
} else {
   console.log('Not found via regex!');
}
