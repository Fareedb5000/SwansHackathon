export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { code, redirect_uri, client_id } = req.body;

    if (!code || !redirect_uri || !client_id) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const client_secret = process.env.CLIO_CLIENT_SECRET;
    if (!client_secret) {
        return res.status(500).json({ error: 'CLIO_CLIENT_SECRET not configured on server' });
    }

    try {
        const params = new URLSearchParams({
            grant_type    : 'authorization_code',
            code,
            redirect_uri,
            client_id,
            client_secret,
        });

        const response = await fetch('https://app.clio.com/oauth/token', {
            method  : 'POST',
            headers : { 'Content-Type': 'application/x-www-form-urlencoded' },
            body    : params.toString(),
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({ error: data.error || 'Token exchange failed', detail: data });
        }

        return res.status(200).json(data);

    } catch (err) {
        return res.status(500).json({ error: 'Internal server error', detail: err.message });
    }
}