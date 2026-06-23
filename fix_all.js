const fs = require('fs');
['chat.js', 'experts.js', 'memory.js', 'model-market.js', 'settings.js', 'plugins.js'].forEach(file => {
  let content = fs.readFileSync('src/renderer/pages/' + file, 'utf8');
  if (content.includes('\\`') || content.includes('\\$')) {
    content = content.replaceAll('\\`', '`').replaceAll('\\$', '$');
    fs.writeFileSync('src/renderer/pages/' + file, content, 'utf8');
    console.log('Fixed ' + file);
  }
});
