export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        return res.status(401).json({ error: 'Missing Authorization header' });
    }

    // Take whatever path+query comes after /api/clio-proxy
    // e.g. /api/clio-proxy?path=/v4/matters.json&fields=id,display_number...
    const clioPath = req.query.path;
    if (!clioPath) {
        return res.status(400).json({ error: 'Missing path param' });
    }

    // Forward all other query params to Clio
    const forwardParams = new URLSearchParams();
    for (const [key, val] of Object.entries(req.query)) {
        if (key !== 'path') forwardParams.append(key, val);
    }

    const clioUrl = `https://app.clio.com/api${clioPath}?${forwardParams.toString()}`;

    try {
        const clioRes = await fetch(clioUrl, {
            headers: {
                'Authorization' : authHeader,
                'Content-Type'  : 'application/json',
            },
        });

        const data = await clioRes.json();
        return res.status(clioRes.status).json(data);

    } catch (err) {
        return res.status(500).json({ error: 'Proxy error', detail: err.message });
    }
}