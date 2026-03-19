export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { code, redirect_uri, client_id } = req.body;

    if (!code || !redirect_uri || !client_id) {
        return res.status(400).json({ error: 'Missing required parameters' });
    }

    const clientSecret = process.env.CLIO_CLIENT_SECRET;
    if (!clientSecret) {
        return res.status(500).json({ error: 'Server misconfiguration: missing client secret' });
    }

    try {
        const response = await fetch('https://app.clio.com/oauth/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type    : 'authorization_code',
                client_id     : client_id,
                client_secret : clientSecret,
                code          : code,
                redirect_uri  : redirect_uri,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Clio token error:', data);
            return res.status(response.status).json({ 
                error  : 'Token exchange failed', 
                detail : data 
            });
        }

        return res.status(200).json(data);

    } catch (err) {
        console.error('Token exchange exception:', err);
        return res.status(500).json({ 
            error  : 'Internal server error', 
            detail : err.message 
        });
    }
}