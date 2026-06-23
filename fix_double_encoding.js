const fs = require('fs');
const path = require('path');

function fixDir(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
    for (const f of files) {
        const fp = path.join(dir, f);
        let content = fs.readFileSync(fp, 'utf8');
        if (content.startsWith('"') && content.trim().endsWith('"')) {
            try {
                const unescaped = JSON.parse(content);
                fs.writeFileSync(fp, unescaped, 'utf8');
                console.log('Fixed double encoding in', fp);
            } catch(e) {
                console.log('Failed to parse', fp, e.message);
            }
        }
    }
}

fixDir('src/renderer/pages');
fixDir('src/renderer/components');
