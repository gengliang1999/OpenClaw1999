const fs = require('fs');

// 1. Fix src/renderer/utils/api.ts
let apiCode = fs.readFileSync('src/renderer/utils/api.ts', 'utf8');
apiCode = apiCode.replace(/options = \{\}/g, 'options: any = {}');
fs.writeFileSync('src/renderer/utils/api.ts', apiCode);

// 2. Fix settings.ts
let settingsCode = fs.readFileSync('src/renderer/pages/settings.ts', 'utf8');
settingsCode = settingsCode.replace(/let globalConfig = \{\};/, 'let globalConfig: any = {};');
fs.writeFileSync('src/renderer/pages/settings.ts', settingsCode);

// 3. Fix missing api import in plugins.ts
let pluginsCode = fs.readFileSync('src/renderer/pages/plugins.ts', 'utf8');
if (!pluginsCode.includes('import { api }')) {
  pluginsCode = "import { api } from '../utils/api';\n" + pluginsCode;
  fs.writeFileSync('src/renderer/pages/plugins.ts', pluginsCode);
}

// 4. Fix missing api import in skills.ts
let skillsCode = fs.readFileSync('src/renderer/pages/skills.ts', 'utf8');
if (!skillsCode.includes('import { api }')) {
  skillsCode = "import { api } from '../utils/api';\n" + skillsCode;
  fs.writeFileSync('src/renderer/pages/skills.ts', skillsCode);
}
console.log('Fixed typescript typings');
