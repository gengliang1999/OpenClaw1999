const fs = require('fs');
const path = require('path');

// 1. Merge utils
const utilsDir = 'src/renderer/utils';
const utilFiles = ['api.ts', 'common.ts', 'markdown.ts'];
let utilsMerged = '// @ts-nocheck\n';
for (const file of utilFiles) {
  let content = fs.readFileSync(path.join(utilsDir, file), 'utf8');
  content = content.replace(/\/\/ @ts-nocheck\n/g, ''); // remove internal nochecks
  utilsMerged += `// ================== ${file} ==================\n` + content + '\n';
}
fs.writeFileSync('src/renderer/utils.ts', utilsMerged);

// 2. Merge components
const compDir = 'src/renderer/components';
const compFiles = ['modal.ts', 'toast.ts', 'sandbox-confirm.ts'];
let compsMerged = '// @ts-nocheck\n';
for (const file of compFiles) {
  let content = fs.readFileSync(path.join(compDir, file), 'utf8');
  content = content.replace(/\/\/ @ts-nocheck\n/g, ''); // remove internal nochecks
  compsMerged += `// ================== ${file} ==================\n` + content + '\n';
}
fs.writeFileSync('src/renderer/components.ts', compsMerged);

// 3. Update all renderer files
function processDir(dir) {
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.ts') && !fullPath.includes('utils.ts') && !fullPath.includes('components.ts') && !fullPath.includes('utils\\') && !fullPath.includes('components\\')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      // Update utils imports
      content = content.replace(/['"](\.\.?)\/utils\/(api|common|markdown)['"]/g, "'$1/utils'");
      // Merge multiple lines of imports from the same file into one? 
      // Actually TS/bundlers allow multiple imports from the same module, so just replacing the path is fine!
      
      // Update components imports
      content = content.replace(/['"](\.\.?)\/components\/(modal|toast|sandbox-confirm)['"]/g, "'$1/components'");
      
      fs.writeFileSync(fullPath, content);
    }
  }
}
processDir('src/renderer');

// 4. Delete old dirs
fs.rmSync('src/renderer/utils', { recursive: true, force: true });
fs.rmSync('src/renderer/components', { recursive: true, force: true });

console.log("Frontend refactor complete.");
