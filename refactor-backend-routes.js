const fs = require('fs');
const path = require('path');

const routesDir = 'src/backend/routes';

let chatCode = fs.readFileSync(path.join(routesDir, 'chat.ts'), 'utf8');
let memoryCode = fs.readFileSync(path.join(routesDir, 'memory.ts'), 'utf8');
let modelsCode = fs.readFileSync(path.join(routesDir, 'models.ts'), 'utf8');

chatCode = chatCode.replace(/module\.exports = function\(dependencies\) \{/, 'module.exports.createChatRouter = function(dependencies) {');
memoryCode = memoryCode.replace(/module\.exports = function\(dependencies\) \{/, 'module.exports.createMemoryRouter = function(dependencies) {');
modelsCode = modelsCode.replace(/module\.exports = function\(dependencies\) \{/, 'module.exports.createModelsRouter = function(dependencies) {');

// Remove redundant imports in combined file
chatCode = chatCode.replace(/\/\/ @ts-nocheck\n/g, '').replace(/const express = require\(['"]express['"]\);\n/g, '');
memoryCode = memoryCode.replace(/\/\/ @ts-nocheck\n/g, '').replace(/const express = require\(['"]express['"]\);\n/g, '');
modelsCode = modelsCode.replace(/\/\/ @ts-nocheck\n/g, '').replace(/const express = require\(['"]express['"]\);\n/g, '');
modelsCode = modelsCode.replace(/const fs = require\(['"]fs['"]\);\n/g, '');
modelsCode = modelsCode.replace(/const path = require\(['"]path['"]\);\n/g, '');
modelsCode = modelsCode.replace(/const systemInfo = require\(['"]\.\.\/system-info['"]\);\n/g, '');
modelsCode = modelsCode.replace(/const \{ MODEL_MARKETPLACE \} = require\(['"]\.\.\/registry['"]\);\n/g, '');

const combined = `// @ts-nocheck
const express = require('express');
const fs = require('fs');
const path = require('path');
const systemInfo = require('./system-info');
const { MODEL_MARKETPLACE } = require('./registry');

// ================== chat.ts ==================
${chatCode}

// ================== memory.ts ==================
${memoryCode}

// ================== models.ts ==================
${modelsCode}
`;

fs.writeFileSync('src/backend/routes.ts', combined);

// Update server.ts
let serverCode = fs.readFileSync('src/backend/server.ts', 'utf8');
serverCode = serverCode.replace(/const chatRouter = require\('\.\/routes\/chat'\)\(\{/g, "const { createChatRouter } = require('./routes');\n  const chatRouter = createChatRouter({");
serverCode = serverCode.replace(/const modelsRouter = require\('\.\/routes\/models'\)\(\{/g, "const { createModelsRouter } = require('./routes');\n  const modelsRouter = createModelsRouter({");
serverCode = serverCode.replace(/const memoryRouter = require\('\.\/routes\/memory'\)\(\{/g, "const { createMemoryRouter } = require('./routes');\n  const memoryRouter = createMemoryRouter({");
fs.writeFileSync('src/backend/server.ts', serverCode);

fs.rmSync('src/backend/routes', { recursive: true, force: true });
console.log('Backend routes refactor complete');
