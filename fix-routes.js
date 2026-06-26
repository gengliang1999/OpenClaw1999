const fs = require('fs');

let content = fs.readFileSync('src/backend/routes.ts', 'utf8');

// Strip out ALL standard requires from the file globally
content = content.replace(/^const express = require\('express'\);\r?\n/gm, '');
content = content.replace(/^const fs = require\('fs'\);\r?\n/gm, '');
content = content.replace(/^const path = require\('path'\);\r?\n/gm, '');
content = content.replace(/^const systemInfo = require\('\.\/?system-info'\);\r?\n/gm, '');
content = content.replace(/^const \{ MODEL_MARKETPLACE \} = require\('\.\/?registry'\);\r?\n/gm, '');
content = content.replace(/\/\/ @ts-nocheck\r?\n/g, '');

const header = `// @ts-nocheck
const express = require('express');
const fs = require('fs');
const path = require('path');
const systemInfo = require('./system-info');
const { MODEL_MARKETPLACE } = require('./registry');
`;

content = header + content;

fs.writeFileSync('src/backend/routes.ts', content, 'utf8');
console.log('Fixed overlapping imports completely.');
