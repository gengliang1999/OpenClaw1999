const fs = require('fs');

// Fix api.ts
let apiCode = fs.readFileSync('src/renderer/utils/api.ts', 'utf8');
apiCode = apiCode.replace(/if \(options\.body/g, 'let fetchOptions: any = { method: options.method || "GET", headers: { "Content-Type": "application/json", ...options.headers }, signal: options.signal };\n    if (options.body');
apiCode = apiCode.replace(/const res = await fetch\(url, \{\s*method:.*?\s*headers:.*?\s*signal:.*?\s*\}\);/s, '');
// Wait, I will just rewrite api.ts entirely safely
apiCode = `
export const api = {
  get: async (url: string, options: any = {}) => {
    let fetchOpts: any = { method: options.method || 'GET', headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } };
    if (options.signal) fetchOpts.signal = options.signal;
    if (options.body && options.method !== 'GET') fetchOpts.body = JSON.stringify(options.body);
    const res = await fetch(url, fetchOpts);
    if (!res.ok) throw new Error(await res.text());
    if (options.stream) return res.body;
    return res.json();
  },
  post: async (url: string, data: any, options: any = {}) => api.get(url, { ...options, method: 'POST', body: data }),
  put: async (url: string, data: any, options: any = {}) => api.get(url, { ...options, method: 'PUT', body: data }),
  delete: async (url: string, options: any = {}) => api.get(url, { ...options, method: 'DELETE' }),
};
`;
fs.writeFileSync('src/renderer/utils/api.ts', apiCode);

// Fix settings.ts
let settingsCode = fs.readFileSync('src/renderer/pages/settings.ts', 'utf8');
settingsCode = settingsCode.replace(/await api\.settings\.get\(\)/g, 'await api.get("/api/settings")'); // api.settings doesn't exist
fs.writeFileSync('src/renderer/pages/settings.ts', settingsCode);

console.log('Fixed api.ts');
