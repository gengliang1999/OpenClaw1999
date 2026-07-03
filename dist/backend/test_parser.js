"use strict";
const officeParser = require('officeparser');
const fs = require('fs');
const path = require('path');
async function run() {
    try {
        const dummyPath = path.join(__dirname, 'dummy.txt');
        fs.writeFileSync(dummyPath, 'This is a test');
        console.log('officeparser loaded:', typeof officeParser.parseOfficeAsync);
        console.log('All tests passed.');
    }
    catch (e) {
        console.error('Test failed:', e);
    }
}
run();
