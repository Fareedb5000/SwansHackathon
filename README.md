# Richards & Law — Internal Case Intake
## Vercel + Google Cloud Vision Setup Guide

---

### Project Structure

```
richards-law/
├── api/
│   └── ocr.js          ← Vercel serverless function (holds your API key securely)
├── public/
│   └── index.html      ← The front-end UI
├── vercel.json         ← Routing config
└── README.md
```

---

### Step 1 — Get a Google Cloud Vision API Key

1. Go to https://console.cloud.google.com
2. Create a new project (or select an existing one)
3. Search for **"Cloud Vision API"** and click **Enable**
4. Go to **APIs & Services → Credentials → Create Credentials → API Key**
5. Copy the key. Optionally restrict it to the Vision API only for security.

---

### Step 2 — Deploy to Vercel

1. Install the Vercel CLI (if you haven't):
   ```bash
   npm install -g vercel
   ```

2. From the project root, run:
   ```bash
   vercel
   ```
   Follow the prompts. Choose to deploy as a new project.

---

### Step 3 — Add Your API Key as an Environment Variable

**Never paste the API key into code.** Instead:

1. Go to your project on https://vercel.com/dashboard
2. Click your project → **Settings → Environment Variables**
3. Add a new variable:
   - **Name:** `GOOGLE_CLOUD_VISION_API_KEY`
   - **Value:** your key from Step 1
   - **Environments:** Production, Preview, Development (tick all)
4. Click **Save**
5. **Redeploy** your project so the variable takes effect:
   ```bash
   vercel --prod
   ```

---

### Step 4 — Update the Front-End Webhooks

Open `public/index.html` and replace the two placeholder URLs near the top of the `<script>` block:

```js
const WEBHOOK_EXTRACT = 'YOUR_MAKE_WEBHOOK_1_URL';  // Make.com: raw text → structured JSON
const WEBHOOK_CLIO    = 'YOUR_MAKE_WEBHOOK_2_URL';  // Make.com: push structured data to Clio
```

---

### How It Works (Data Flow)

```
Browser                    Vercel (server-side)        External Services
───────                    ────────────────────        ─────────────────
1. User uploads PDF
2. PDF.js renders each
   page to a PNG image
3. PNG sent to /api/ocr ──→ api/ocr.js receives it
                            Calls Google Cloud Vision
                            with API key from env var  → Google Vision API
                         ←─ Returns extracted text    ←─
4. Text accumulated
   across all pages
5. Full text sent to ───────────────────────────────→ Make.com Webhook 1
   Make.com                                           (structures the text
                                                       via Claude/GPT)
6. Structured JSON ←────────────────────────────────
   shown in UI for
   human verification
7. Approved → sent to ──────────────────────────────→ Make.com Webhook 2
   Make.com                                           (writes to Clio)
```

---

### Local Development

To run locally with live environment variables:

```bash
vercel dev
```

This starts a local server at `http://localhost:3000` with your Vercel env vars
loaded automatically. No need to create a `.env` file.

---

### Adjusting OCR Quality

In `public/index.html`, find:

```js
const RENDER_SCALE = 2.5;
```

- **Higher** (e.g. `3.0`) → better OCR on low-quality scans, but larger payloads
- **Lower** (e.g. `1.5`) → faster, smaller, but may miss fine print

The Vision API has a **10MB per image** limit. At scale `2.5`, a typical letter-size
page renders to roughly 2–3MB, well within limits.
