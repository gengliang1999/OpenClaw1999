"use strict";
const fs = require('fs');
const path = require('path');
const { parseOffice } = require('officeparser');
async function test() {
    const dummyCsv = path.join(__dirname, 'dummy.csv');
    fs.writeFileSync(dummyCsv, 'Name,Age\nAlice,30\nBob,25');
    try {
        const parsed = await parseOffice(dummyCsv);
        const result = await parsed.to('markdown');
        console.log('--- CSV Parsing Success ---');
        console.log(result.value);
    }
    catch (e) {
        console.error('Failed to parse:', e);
    }
}
test();
