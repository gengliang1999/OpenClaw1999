const fs = require('fs');

const chatJs = fs.readFileSync('src/renderer/pages/chat.js', 'utf8');

// Escape backticks and template variables for string literal
const escapedChatJs = chatJs
  .replace(/\\/g, '\\\\')
  .replace(/`/g, '\\`')
  .replace(/\$\{/g, '\\${');

const buildChatJs = `const fs = require('fs');

const code = \`${escapedChatJs}\`;

fs.writeFileSync('src/renderer/pages/chat.js', code);
console.log('Built chat.js');
`;

fs.writeFileSync('build_chat.js', buildChatJs, 'utf8');
console.log('Successfully synced build_chat.js');
