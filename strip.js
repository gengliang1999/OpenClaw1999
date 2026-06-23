const fs = require('fs');
let s = fs.readFileSync('src/renderer/pages/chat.js', 'utf8');
if (s.startsWith('"')) s = s.substring(1);
if (s.endsWith('"')) s = s.substring(0, s.length - 1);
fs.writeFileSync('src/renderer/pages/chat.js', s, 'utf8');
console.log('Stripped!');
