/**
 * Vercel Serverless Function: /api/notify
 *
 * Two roles:
 *  1. POST — Make.com calls this when the retainer email has been sent
 *             Body: { matterId, email, status: "sent" }
 *
 *  2. GET  — The browser polls this every 3 seconds after clicking Approve
 *             Query: ?matterId=xxx
 *             Returns: { status: "pending" } or { status: "sent", email: "..." }
 *
 * Storage: Vercel Edge Config or simply an in-memory store.
 * Note: Serverless functions are stateless between invocations, so we use
 * Vercel KV (Redis) if available, or fall back to a lightweight in-process
 * cache that works for single-instance dev/low-traffic use.
 *
 * For production with multiple Vercel instances, set up Vercel KV:
 *   https://vercel.com/docs/storage/vercel-kv
 * and uncomment the KV section below.
 */

// ── In-memory fallback (works fine for low traffic / single instance) ─────────
const store = {};

// ── Uncomment this block if you've set up Vercel KV ──────────────────────────
// import { kv } from '@vercel/kv';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    // ── POST: Make.com notifies us that the retainer was sent ─────────────────
    if (req.method === 'POST') {
        const { matterId, email, status } = req.body;

        if (!matterId) {
            return res.status(400).json({ error: 'Missing matterId' });
        }

        // Store in memory (replace with kv.set for production)
        store[matterId] = {
            status: status || 'sent',
            email:  email  || '',
            timestamp: Date.now()
        };

        // Uncomment for Vercel KV:
        // await kv.set(`notify:${matterId}`, { status, email, timestamp: Date.now() }, { ex: 3600 });

        console.log(`Retainer sent for matter ${matterId} → ${email}`);
        return res.status(200).json({ ok: true });
    }

    // ── GET: Browser polls for status ─────────────────────────────────────────
    if (req.method === 'GET') {
        const { matterId } = req.query;

        if (!matterId) {
            return res.status(400).json({ error: 'Missing matterId' });
        }

        // Read from memory (replace with kv.get for production)
        const record = store[matterId];

        // Uncomment for Vercel KV:
        // const record = await kv.get(`notify:${matterId}`);

        if (!record) {
            return res.status(200).json({ status: 'pending' });
        }

        // Clean up after delivering the result
        delete store[matterId];

        return res.status(200).json({
            status: record.status,
            email:  record.email
        });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
