const fs = require('fs');

function processDir(dir) {
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = dir + '/' + file;
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      // Update utils imports
      content = content.replace(/['"](\.\.?)\/utils\/(api|common|markdown)\.js['"]/g, "'$1/utils.js'");
      content = content.replace(/['"](\.\.?)\/utils\/(api|common|markdown)['"]/g, "'$1/utils'");
      
      // Update components imports
      content = content.replace(/['"](\.\.?)\/components\/(modal|toast|sandbox-confirm)\.js['"]/g, "'$1/components.js'");
      content = content.replace(/['"](\.\.?)\/components\/(modal|toast|sandbox-confirm)['"]/g, "'$1/components'");
      
      fs.writeFileSync(fullPath, content);
    }
  }
}
processDir('src/renderer');
console.log('Fixed missed .js imports');
