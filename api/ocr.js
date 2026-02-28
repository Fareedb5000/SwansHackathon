/**
 * Vercel Serverless Function: /api/ocr
 *
 * Receives a base64-encoded image (one PDF page) from the browser,
 * forwards it to Azure Computer Vision's Read API (best for scanned docs),
 * and returns the extracted text.
 *
 * Environment variables required (set in Vercel dashboard):
 *   AZURE_VISION_KEY       — your Azure Computer Vision Key 1
 *   AZURE_VISION_ENDPOINT  — e.g. https://richards-law-ocr.cognitiveservices.azure.com
 */

export default async function handler(req, res) {
  // ── CORS ───────────────────────────────────────────────────────────────────
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { imageBase64 } = req.body;
  if (!imageBase64) return res.status(400).json({ error: 'Missing imageBase64 in request body' });

  const key      = process.env.AZURE_VISION_KEY;
  const endpoint = process.env.AZURE_VISION_ENDPOINT?.replace(/\/$/, ''); // strip trailing slash

  if (!key || !endpoint) {
    console.error('Azure env vars missing');
    return res.status(500).json({ error: 'Server misconfiguration: Azure credentials missing' });
  }

  try {
    // Convert base64 → binary buffer to POST as raw image bytes
    const imageBuffer = Buffer.from(imageBase64, 'base64');

    // ── Step 1: Submit image to the Read API (async operation) ───────────────
    const submitRes = await fetch(
      `${endpoint}/vision/v3.2/read/analyze`,
      {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': key,
          'Content-Type': 'image/png',
        },
        body: imageBuffer,
      }
    );

    if (!submitRes.ok) {
      const errBody = await submitRes.text();
      console.error('Azure submit error:', errBody);
      return res.status(502).json({ error: 'Azure OCR submission failed', detail: errBody });
    }

    // Azure returns the polling URL in the Operation-Location header
    const operationUrl = submitRes.headers.get('Operation-Location');
    if (!operationUrl) {
      return res.status(502).json({ error: 'Azure did not return an Operation-Location header' });
    }

    // ── Step 2: Poll until the operation is complete ─────────────────────────
    let result;
    for (let attempt = 0; attempt < 20; attempt++) {
      await sleep(1000); // wait 1 second between polls

      const pollRes = await fetch(operationUrl, {
        headers: { 'Ocp-Apim-Subscription-Key': key },
      });

      if (!pollRes.ok) {
        const errBody = await pollRes.text();
        console.error('Azure poll error:', errBody);
        return res.status(502).json({ error: 'Azure OCR polling failed', detail: errBody });
      }

      result = await pollRes.json();
      if (result.status === 'succeeded') break;
      if (result.status === 'failed') {
        return res.status(502).json({ error: 'Azure OCR operation failed', detail: result });
      }
      // status === 'running' or 'notStarted' → keep polling
    }

    if (result?.status !== 'succeeded') {
      return res.status(504).json({ error: 'Azure OCR timed out' });
    }

    // ── Step 3: Extract text from the result ─────────────────────────────────
    const lines = result.analyzeResult.readResults.flatMap(page =>
      page.lines.map(line => line.text)
    );
    const text = lines.join('\n');

    return res.status(200).json({ text });

  } catch (err) {
    console.error('Unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
