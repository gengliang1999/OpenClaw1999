const fs = require('fs');
const files = ['memory.js', 'skills.js', 'plugins.js', 'market.js', 'settings.js'];

for (const f of files) {
  try {
    let content = fs.readFileSync('src/renderer/pages/' + f, 'utf8');
    
    // Check if we already injected it
    if (!content.includes('hideSidebar()')) {
       // Insert it at the beginning of the render function
       content = content.replace(
         /export async function render\(container\) \{/,
         `export async function render(container) {
  if (window.__app && window.__app.hideSidebar) window.__app.hideSidebar();`
       );
       fs.writeFileSync('src/renderer/pages/' + f, content);
       console.log('Injected hideSidebar into ' + f);
    }
  } catch(e) {
    console.error('Failed to process ' + f, e);
  }
}
