const fs = require('fs');
let c = fs.readFileSync('src/renderer/app.js', 'utf8');
c = c.replace(/window\.openClaw\.chat\./g, 'api.chat.');
if (!c.includes('import { api }')) {
  c = c.replace(/import toast from '.\/components\/toast\.js';/, "import toast from './components/toast.js';\nimport { api } from './utils/api.js';");
}
fs.writeFileSync('src/renderer/app.js', c);
console.log('Done!');
