import fs from 'fs';
import path from 'path';

async function check() {
  const files = [
    'd:/Code/OpenClawAssistant/src/renderer/pages/chat.js',
    'd:/Code/OpenClawAssistant/src/renderer/pages/model-market.js',
    'd:/Code/OpenClawAssistant/src/renderer/pages/experts.js',
    'd:/Code/OpenClawAssistant/src/renderer/pages/settings.js',
    'd:/Code/OpenClawAssistant/src/renderer/pages/memory.js'
  ];

  for (const file of files) {
    try {
      await import(`file:///${file}`);
      console.log(`[OK] ${file}`);
    } catch (e) {
      console.error(`[ERROR] ${file}:`, e.message);
      console.error(e.stack);
    }
  }
}

check();
