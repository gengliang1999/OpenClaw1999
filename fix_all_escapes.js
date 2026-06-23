const fs = require('fs');
const path = require('path');

const dir = 'src/renderer/pages';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));

for (const f of files) {
  const filePath = path.join(dir, f);
  let s = fs.readFileSync(filePath, 'utf8');

  const orig = s;
  s = s.replace(/\\`/g, '`');
  s = s.replace(/\\\${/g, '${');

  if (s !== orig) {
     fs.writeFileSync(filePath, s, 'utf8');
     console.log('Fixed backslash escapes in', f);
  }
}

const comps = fs.readdirSync('src/renderer/components').filter(f => f.endsWith('.js'));
for (const f of comps) {
  const filePath = path.join('src/renderer/components', f);
  let s = fs.readFileSync(filePath, 'utf8');

  const orig = s;
  s = s.replace(/\\`/g, '`');
  s = s.replace(/\\\${/g, '${');

  if (s !== orig) {
     fs.writeFileSync(filePath, s, 'utf8');
     console.log('Fixed backslash escapes in', f);
  }
}
