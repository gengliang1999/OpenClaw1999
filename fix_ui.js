const fs = require('fs');
const files = [
  'src/renderer/pages/settings.js',
  'src/renderer/pages/plugins.js',
  'src/renderer/pages/skills.js',
  'src/renderer/pages/memory.js',
  'src/renderer/pages/chat.js'
];
files.forEach(file => {
  if (!fs.existsSync(file)) return;
  let code = fs.readFileSync(file, 'utf8');
  
  // Replace literal backslash followed by backtick
  code = code.split('\\`').join('`');
  // Replace literal backslash followed by dollar sign
  code = code.split('\\$').join('$');
  
  // Replace hardcoded CSS fallback values with variables only
  code = code.replace(/var\(--bg-body,\s*#[0-9a-fA-F]+\)/g, 'var(--bg-app)');
  code = code.replace(/var\(--bg-card,\s*#[0-9a-fA-F]+\)/g, 'var(--bg-card)');
  code = code.replace(/var\(--border-light,\s*#[0-9a-fA-F]+\)/g, 'var(--border-light)');
  code = code.replace(/var\(--text-main,\s*#[0-9a-fA-F]+\)/g, 'var(--text-primary)');
  code = code.replace(/var\(--text-secondary,\s*#[0-9a-fA-F]+\)/g, 'var(--text-secondary)');
  code = code.replace(/var\(--text-muted,\s*#[0-9a-fA-F]+\)/g, 'var(--text-muted)');
  code = code.replace(/background:\s*#1c1c1e/gi, 'background: var(--bg-app)');
  code = code.replace(/background:\s*#2c2c2e/gi, 'background: var(--bg-card)');
  code = code.replace(/background:\s*#1e1e1e/gi, 'background: var(--bg-hover)');
  code = code.replace(/background:\s*rgba\(30,\s*30,\s*32,\s*0\.8\)/gi, 'background: var(--bg-panel)');
  code = code.replace(/color:\s*#fff/gi, 'color: var(--text-primary)');
  code = code.replace(/color:\s*#eee/gi, 'color: var(--text-primary)');
  
  fs.writeFileSync(file, code);
  console.log('Fixed ' + file);
});
