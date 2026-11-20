import app from '../server/index.js';

export const config = { api: { bodyParser: false } };

export default function handler(req, res) {
    const requestUrl = new URL(req.url || '/', 'http://vercel.local');
    const rewrittenPath = requestUrl.searchParams.get('__api_path');
    if (!rewrittenPath) return res.status(404).end();

    const pathname = rewrittenPath.startsWith('/api/')
        ? rewrittenPath
        : `/api/${rewrittenPath.replace(/^\/+/, '')}`;
    if (!pathname.startsWith('/api/')) return res.status(404).end();

    requestUrl.searchParams.delete('__api_path');
    const query = requestUrl.searchParams.toString();
    req.url = `${pathname}${query ? `?${query}` : ''}`;
    return app(req, res);
}
