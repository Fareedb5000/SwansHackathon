/**
 * Vercel Serverless Function: /api/ocr
 *
 * Receives a base64-encoded image (one PDF page) from the browser,
 * forwards it to Google Cloud Vision's DOCUMENT_TEXT_DETECTION endpoint,
 * and returns the extracted text.
 *
 * Environment variable required (set in Vercel dashboard):
 *   GOOGLE_CLOUD_VISION_API_KEY  — your GCV API key (never sent to the browser)
 */

export default async function handler(req, res) {
  // ── CORS headers so your HTML page can call this endpoint ──────────────────
  res.setHeader('Access-Control-Allow-Origin', '*');       // tighten to your domain in production
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Pre-flight
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Only accept POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { imageBase64, mimeType = 'image/png' } = req.body;

  if (!imageBase64) {
    return res.status(400).json({ error: 'Missing imageBase64 in request body' });
  }

  const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;
  if (!apiKey) {
    console.error('GOOGLE_CLOUD_VISION_API_KEY is not set');
    return res.status(500).json({ error: 'Server misconfiguration: API key missing' });
  }

  try {
    const visionRes = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [
            {
              image: {
                content: imageBase64   // raw base64, no data-URI prefix
              },
              features: [
                {
                  type: 'DOCUMENT_TEXT_DETECTION',  // best for scanned docs / dense text
                  maxResults: 1
                }
              ]
            }
          ]
        })
      }
    );

    if (!visionRes.ok) {
      const errBody = await visionRes.text();
      console.error('Vision API error:', errBody);
      return res.status(502).json({ error: 'Vision API request failed', detail: errBody });
    }

    const visionData = await visionRes.json();

    // fullTextAnnotation gives the cleanest, layout-aware text block
    const text =
      visionData.responses?.[0]?.fullTextAnnotation?.text ?? '';

    return res.status(200).json({ text });

  } catch (err) {
    console.error('Unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
}
