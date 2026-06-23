const fs = require('fs');
let s = fs.readFileSync('src/renderer/pages/chat.js', 'utf8');

// The file might contain \` or \${ literally because of my write_to_file mistake
s = s.replace(/\\`/g, '`');
s = s.replace(/\\\${/g, '${');

fs.writeFileSync('src/renderer/pages/chat.js', s, 'utf8');
console.log('Fixed all remaining backslash escapes in chat.js');
