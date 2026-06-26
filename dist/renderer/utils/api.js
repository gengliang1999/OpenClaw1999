export const api = {
    get: async (url, options = {}) => {
        let fetchOpts = { method: options.method || 'GET', headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } };
        if (options.signal)
            fetchOpts.signal = options.signal;
        if (options.body && options.method !== 'GET')
            fetchOpts.body = JSON.stringify(options.body);
        const res = await fetch(url, fetchOpts);
        if (!res.ok)
            throw new Error(await res.text());
        if (options.stream)
            return res.body;
        return res.json();
    },
    post: async (url, data, options = {}) => api.get(url, { ...options, method: 'POST', body: data }),
    put: async (url, data, options = {}) => api.get(url, { ...options, method: 'PUT', body: data }),
    delete: async (url, options = {}) => api.get(url, { ...options, method: 'DELETE' }),
};
