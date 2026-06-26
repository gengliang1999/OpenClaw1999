const fs = require('fs');
const path = require('path');

const dataDir = 'src/backend/data';
const dataFiles = ['model-marketplace.ts', 'plugin-registry.ts', 'skill-market.ts'];
let registryMerged = '// @ts-nocheck\n';
for (const file of dataFiles) {
  let content = fs.readFileSync(path.join(dataDir, file), 'utf8');
  content = content.replace(/\/\/ @ts-nocheck\n/g, ''); // remove internal nochecks
  registryMerged += `// ================== ${file} ==================\n` + content + '\n';
}
fs.writeFileSync('src/backend/registry.ts', registryMerged);

// Update server.ts
let serverCode = fs.readFileSync('src/backend/server.ts', 'utf8');
serverCode = serverCode.replace(/require\(['"]\.\/data\/skill-market['"]\)/g, "require('./registry')");
serverCode = serverCode.replace(/require\(['"]\.\/data\/plugin-registry['"]\)/g, "require('./registry')");
serverCode = serverCode.replace(/require\(['"]\.\/data\/model-marketplace['"]\)/g, "require('./registry')");
fs.writeFileSync('src/backend/server.ts', serverCode);

// Update models.ts
let modelsCode = fs.readFileSync('src/backend/routes/models.ts', 'utf8');
modelsCode = modelsCode.replace(/require\(['"]\.\.\/data\/model-marketplace['"]\)/g, "require('../registry')");
fs.writeFileSync('src/backend/routes/models.ts', modelsCode);

fs.rmSync('src/backend/data', { recursive: true, force: true });
console.log('Backend data refactor complete');
